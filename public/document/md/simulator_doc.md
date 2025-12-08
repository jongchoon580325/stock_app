# 미국주식 매도 시뮬레이터

**Page Title**: Simulator

지금까지는 **"매수·매도 = 포지션/수익률 계산"**이었고, 이제 여기에 **"미국주식 양도세 + 절세 전략 엔진"**을 하나 더 얹는 단계임.

---

## 0. 먼저 짚어야 할 숨은 전제 (놓치기 쉬운 부분들)

### 1. 세금은 "수익률"이 아니라 "실현 이익(Realized Gain)" 기준
- 이미 팔아서 확정된 이익만 과세 대상
- 아직 들고 있는 종목의 평가손익은 참고용 지표일 뿐 세금엔 안 들어감

### 2. 연 2,500,000원 비과세 한도 = "해당 과세연도 실현이익 합계" 기준
- 올해 이미 1,000,000원 이익 실현했으면 → 남은 비과세 한도 = 1,500,000원
- 이 "연도별 누적 실현이익"을 추적하는 연도 단위 집계 로직이 필요해

### 3. 모든 계산은 KRW 기준으로 통일
- 거래 자체는 USD지만, 세금/한도는 KRW로 계산
- 매도 시점/매수 시점의 환율을 어떻게 적용할지 결정 필요
- 실무에선 "각 거래일의 기준환율"을 쓰는 게 일반적 → 우리는 fxRate 컬럼 사용

### 4. 원가 계산 방식(FIFO / 평균법)을 명확히 고정해야 함
- 이미 평균단가 기반 포지션 로직을 짰으니
- 세금계산도 동일한 평균단가 기준으로 가는 게 구현상 가장 깔끔함
- 나중에 필요하면 `costMethod: 'AVG' | 'FIFO'`로 확장 가능

### 5. 과세 로직은 "전역 설정값"으로 분리해 두는 게 좋다
나중에 세율이나 비과세 한도가 바뀌면 코드 수정 없이 설정만 변경:

```typescript
const TAX_CONFIG = {
  usStockTaxRate: 0.22,
  usStockAnnualExemption: 2_500_000,
};
```

---

## 1. "미국 주식만 필터링 + 세금 대상 트랜잭션 추출" 레이어

### 1) 미국 주식 필터링 기준
- `country === 'USA'`
- 필요하다면 `stockType === '미국주식'` 같은 추가 필터

```typescript
const usStockTrades = trades.filter(
  t => t.country === 'USA' // && t.stockType === '미국주식'
);
```

### 2) 세금 대상은 "SELL 트랜잭션"만
- 매수(BUY)는 원가/보유수량 계산용
- 실제 과세 대상 이익은 매도(SELL)에서만 발생

```typescript
const usSellTrades = usStockTrades.filter(t => t.tradeType === 'SELL');
```

---

## 2. "연도별 실현이익(Realized Gain in KRW)" 계산 엔진

이미 만들어둔 포지션 로직(평균단가 기반)을 KRW 버전으로 확장하면 돼.

### 핵심 아이디어

각 종목+계좌별로 시간 순으로 순회하면서:

**BUY:**
- `totalQty += qty`
- `totalCostKRW += qty * priceUSD * fxRateBuy`

**SELL:**
- `avgCostKRW = totalCostKRW / totalQty`
- `proceedsKRW = qty * priceUSD * fxRateSell`
- `realizedGainKRW = proceedsKRW - (avgCostKRW * qty)`
- 연도별로 누적: `gainByYear[year] += realizedGainKRW`
- 포지션 업데이트:
  - `totalQty -= qty`
  - `totalCostKRW -= avgCostKRW * qty`

이렇게 하면:
- 연도별 실현이익
- 종목별/계좌별 실현이익
- 개별 매도 건별 실현이익

까지 한 번에 구할 수 있어.

---

## 3. 22% 세율 + 2,500,000원 비과세 한도 적용 로직

### 3-1) 연도별 과세표 계산

1. 특정 연도 year에 대해:
   - `totalRealizedGainKRW` 계산 (음수면 0으로 처리 또는 이월 로직 별도 고려)
2. `exemptLimit = 2_500_000`
3. `taxableGain = max(0, totalRealizedGainKRW - exemptLimit)`
4. `tax = taxableGain * 0.22`

이건 "올해 전체를 다 팔았다면 실제 세금은 얼마냐?" 를 보여주는 기준 표.

---

## 4. 전략 1 – "연 2,500,000원 한도 내에서 매도 전략 세우기"

"올해 아직 2,500,000원까지 여유가 얼마나 남았는지 보고, 그 범위 안에서 어떤 종목/계좌를 얼마나 팔 수 있는지 추천해 달라"는 요구.

### 4-1) 현재까지 확정된 이익(이미 발생한 SELL) 계산

올해 날짜 기준으로 이미 발생한 실현이익 합계:

```typescript
const realizedYtd = gainByYear[currentYear] ?? 0;
const remainingExemption = Math.max(
  0,
  TAX_CONFIG.usStockAnnualExemption - realizedYtd
);
```

### 4-2) "추가로 매도했을 때" 이익 시뮬레이션

아직 보유 중인 포지션(HOLDING)에 대해:
- 현재가 + 평균원가(KRW 기준)를 사용해 → "지금 전량 매도 시 예상 실현이익" 을 계산
- 이를 종목+계좌별로 리스트업: `symbol, accountNo, holdingQty, expectedGainIfSellAllKRW`

### 4-3) 절세 전략 아이디어(알고리즘 관점)

- **1순위: 손실/저수익 종목부터 정리**
  - 이익이 아니라 손실이 나는 종목은 실현손실로 → 다른 종목의 이익과 상쇄 효과 (세금 최소화)
- **2순위: 이익은 작지만 현금화하고 싶은 종목**
  - gain / 매도금액 비율이 낮은 순서 = "세율을 덜 건드리는 매도"
- **3순위: 한도(remainingExemption)를 꽉 채우되 넘지 않도록 조합**
  - 이건 간단한 knapsack(배낭) 문제로 볼 수 있지만,
  - 현실적으로는 "이익 작은 순서대로 쌓다가 한도 직전에서 멈추는 greedy"로도 충분히 쓸 만함

이걸 기반으로: **"비과세 한도 내에서 매도 가능한 후보 리스트"**를 종목별/계좌별로 추천해 주는 게 1번 전략의 골자임.

---

## 5. 전략 2 – "사용자가 선택한 종목/계좌에 대한 현황표"

사용자가 UI에서 특정 종목/계좌를 체크박스로 선택 → 그 집합에 대해서만 매도/세금 시나리오를 계산.

### 5-1) 입력
- 선택된 키: `(symbol, accountNo)` 리스트
- 매도 전략:
  - "전량 매도" or
  - "수량 입력 매도(부분 매도)"

### 5-2) 출력해야 하는 현황표 항목

종목별/계좌별로:
- 현재 보유수량
- 평균매입단가 (USD, KRW)
- 현재가 (USD, KRW)
- 예상 매도금액(원화)
- 예상 실현이익(원화)
- 연도 기준 비과세 한도 대비 추가 이익
- 해당 매도까지 포함했을 때 예상 과세표
  - 연도별 총 실현이익
  - 과세 대상 이익
  - 예상 양도세 22%

이걸 테이블 + 요약 카드로 보여주면 됨.

---

## 6. 전략 3 – "예상 총 매도금액을 입력하면, 종목/수량 조합을 제안"

사용자가 "올해 미국주식에서 한 30,000,000원 정도 팔고 싶다"라고 입력하면, 그 금액에 맞춰 세금을 최소화하는 매도 조합을 추천.

### 6-1) 준비 데이터

각 종목+계좌에 대해:
- `maxSellQty = 보유수량`
- 전량 매도 시:
  - `maxSellAmountKRW`
  - `maxGainKRW`

그리고 필요하다면 부분매도 시 이익 비율이 거의 선형이라고 가정해서:
- `gainPerAmountRatio = maxGainKRW / maxSellAmountKRW`

### 6-2) 알고리즘(실무용 근사 전략)

1. **손실 종목/손실 계좌 먼저 풀로 매도 후보에 포함**
   - 손실이 나는 만큼 "비과세 여유 + 세액절감 효과"가 생김
2. **그 다음 gainPerAmountRatio(이익률)가 낮은 순서대로 후보를 쌓으면서**
   - 누적 매도금액이 사용자가 입력한 targetSellAmount에 도달할 때까지
   - 각 후보에서 부분매도(partialQty)를 사용해 정확히 맞춰감
3. **이 과정에서 연도별 비과세 한도(2,500,000원) 도 함께 체크**
   - "현재까지 확정 이익 + 이번 전략 시뮬레이션 이익"이 한도를 얼마나 넘는지/안 넘는지를 계산해
   - 넘는 부분만큼에 22% 세율을 적용한 예상 세액을 같이 출력

### 6-3) 출력 포맷(현황표)

**행**: 매도할 종목/계좌/수량

**열**:
- 종목명
- 계좌번호
- 매도 수량
- 매도 단가
- 매도 금액(원화)
- 예상 실현이익(원화)
- 비과세 한도 내/초과 여부 플래그

**하단 요약**:
- 총 매도금액
- 총 실현이익
- 비과세 한도 사용량 / 남은 한도
- 과세 대상 이익
- 예상 양도세 (22%)

---

## 7. "절세 전략 팁"을 시스템에 녹여 넣는 방법

구현 차원에서 넣을 수 있는 실질 팁들:

### 1. 손실 실현(택소스 하베스팅) 제안
- 평가손실이 큰 종목들을 리스트업해서
- "이 종목을 일부/전부 매도하면, 올해 과세이익이 얼마 줄어듦"을 계산해 제안

### 2. 한도 근처에서 멈추게 하는 안전 여유값
- 실제 신고 시 오차를 감안해서
- 시스템 상 한도는 2,400,000원 정도로 커트라인 설정
- 사용자가 "민감도 옵션"을 선택 가능하게:
  - 보수적(2,300,000) / 기본(2,400,000) / 공격적(2,500,000) 같은 프리셋

### 3. 연도 경계(12월 말) 알림/추천
- 연말이 다가오면:
- "올해 남은 비과세 여유 OOO원, 지금 이 조합을 팔면 내년으로 이월 없이 절세 가능"
- 라는 형태의 리포트를 자동 생성하는 것도 가능

---

## 8. PDF 보고서 구조 설계

"위 3가지 전략 내용을 '보고서 형태로 PDF 출력' 기능"

### 8-1) 보고서 섹션 구성

#### 1. 요약 섹션
- 대상 연도
- 현재까지 실현이익, 남은 비과세 한도
- 이번 전략으로 예상되는
  - 총 매도금액
  - 총 실현이익
  - 과세 대상 이익
  - 예상 세액

#### 2. 전략 1 – 한도 내 매도 후보 리스트
- 종목/계좌별 추천 매도안 테이블

#### 3. 전략 2 – 사용자가 선택한 내역 분석 결과
- 선택된 종목/계좌 목록
- 매도 시나리오별 비교(전량/부분)

#### 4. 전략 3 – 목표 매도금액 기반 최적 조합
- 제안된 매도 조합 테이블
- 세금 관점 비교 그래프("전략 사용 vs 아무 생각 없이 전부 매도했을 경우")

#### 5. 주의사항 / 디스클레이머
- "실제 세법/신고는 사용자 책임"
- "세율/규정 변경 가능성 안내"

### 8-2) 구현 방식(Next.js 관점)

- HTML + CSS로 리포트 페이지 구성
- 서버에서 puppeteer 또는 playwright로 HTML을 PDF로 렌더링
- `GET /api/report/tax?year=2025` → PDF 스트림 응답
- 또는 `@react-pdf/renderer`로 리액트 컴포넌트를 바로 PDF로 렌더링

---

## 9. 데이터 구조/모듈 레벨 정리

### 1. usTaxEngine.ts
- `filterUsTrades(trades)`
- `calculateRealizedGainByYear(usTrades)`
- `simulateSellScenario(...)`  (전략 1, 2, 3 공통 코어)

### 2. taxStrategyService.ts
- `buildExemptionSafePlan(...)`
- `buildUserSelectionPlan(...)`
- `buildTargetAmountPlan(...)`

### 3. taxReportService.ts
- 위 시뮬레이션 결과를 받아서
- PDF용 ViewModel 생성

이렇게 나누면:
- 핵심 수학/계산(도메인 로직) 과
- UI/API/보고서 출력을 완전히 분리할 수 있어서 유지보수/테스트가 아주 편해진다.

---

## 10. 두 줄로 정리하면 다음과 같음

사용자가 만들고 싶은 건
1. **"미국주식 양도세 최적화 시뮬레이션 엔진 + 리포트 시스템"**이고,
2. 기존의 매수/매도/포지션 엔진 위에 **"연도별 실현이익 + 한도관리 + 조합 추천 알고리즘"**을 하나 더 올리는 구조야.

---

## 11. 다음은 중요한 TS Code 몇 가지

### 🔧 공통 타입 & 설정

```typescript
// 이미 가지고 있는 Trade 타입 예시
export type TradeType = 'BUY' | 'SELL';

export interface Trade {
  id: string;
  stockType: string;      // ETF주식, 미국주식 등
  country: string;        // 'USA' 등
  tradeDate: string;      // '2025-11-07' 같은 포맷
  broker: string;
  symbol: string;
  accountNo: string;
  accountType: string;
  tradeType: TradeType;
  distributionCycle: string;
  price: number;          // USD 기준 가격
  qty: number;            // 항상 양수
  buyAmount: number;      // BUY일 때만 사용
  sellAmount: number;     // SELL일 때만 사용
  fxRate: number;         // 해당 거래일 환율 (KRW/USD)
}

// 세법 관련 설정값
export interface TaxConfig {
  usStockTaxRate: number;        // 예: 0.22
  usStockAnnualExemption: number; // 예: 2_500_000
}

// 기본값
export const DEFAULT_TAX_CONFIG: TaxConfig = {
  usStockTaxRate: 0.22,
  usStockAnnualExemption: 2_500_000,
};
```

### 1️⃣ calculateRealizedGainByYear()

미국주식 전체 거래를 받아서 연도별 실현이익(KRW) + 개별 매도건 상세 를 계산.

```typescript
// 개별 매도건 단위 상세
export interface RealizedGainDetail {
  year: number;
  tradeId: string;
  symbol: string;
  accountNo: string;
  qty: number;
  proceedsKRW: number;
  costKRW: number;
  gainKRW: number;
}

// 연도별 합계 구조
export interface RealizedGainByYear {
  [year: number]: {
    totalGainKRW: number;
    details: RealizedGainDetail[];
  };
}

/**
 * 미국 주식 거래만 대상으로, 연도별 실현이익(KRW 기준)을 계산.
 * 평균단가(원화) 기준.
 */
export function calculateRealizedGainByYear(
  trades: Trade[]
): RealizedGainByYear {
  // 1) 미국 주식 + SELL/BUY 전부 포함
  const usTrades = trades.filter(t => t.country === 'USA');

  // 2) 종목+계좌별로 그룹
  const map = new Map<string, Trade[]>();
  for (const t of usTrades) {
    const key = `${t.symbol}_${t.accountNo}`;
    if (!map.has(key)) map.set(key, []);
    map.get(key)!.push(t);
  }

  const result: RealizedGainByYear = {};

  // 3) 각 종목+계좌별로 시간순 순회하며 실현이익 계산
  for (const [key, group] of map.entries()) {
    const sorted = group.sort(
      (a, b) =>
        new Date(a.tradeDate).getTime() - new Date(b.tradeDate).getTime()
    );

    let totalQty = 0;
    let totalCostKRW = 0; // 보유 중인 포지션의 원가 합 (KRW)

    for (const t of sorted) {
      if (t.tradeType === 'BUY') {
        const costKRW = t.qty * t.price * t.fxRate;
        totalQty += t.qty;
        totalCostKRW += costKRW;
      } else if (t.tradeType === 'SELL') {
        if (totalQty <= 0) {
          throw new Error(
            `보유 수량이 없는 상태에서 매도 발생: ${key}, tradeId=${t.id}`
          );
        }
        const avgCostKRW = totalCostKRW / totalQty;

        const proceedsKRW = t.qty * t.price * t.fxRate;
        const costKRW = avgCostKRW * t.qty;
        const gainKRW = proceedsKRW - costKRW;

        const year = new Date(t.tradeDate).getFullYear();

        if (!result[year]) {
          result[year] = { totalGainKRW: 0, details: [] };
        }

        result[year].totalGainKRW += gainKRW;
        result[year].details.push({
          year,
          tradeId: t.id,
          symbol: t.symbol,
          accountNo: t.accountNo,
          qty: t.qty,
          proceedsKRW,
          costKRW,
          gainKRW,
        });

        // 포지션 감소
        totalQty -= t.qty;
        totalCostKRW -= costKRW;

        if (totalQty < 0) {
          throw new Error(`매도 후 보유 수량이 음수: ${key}`);
        }
      }
    }
  }

  return result;
}

###2️⃣ buildExemptionSafePlan()

  올해 남은 비과세 한도(2,500,000원) 안에서 “어떤 종목/계좌를 얼마나 팔면 좋은지” 추천하는 전략.

  이 함수는 이미 보유 중인 포지션 정보가 필요해서 아래처럼 간단한 TaxPosition 구조를 한 번 정의해서 받도록 할게.

// 세금 시뮬레이션용 포지션 정보 (전량 매도 기준)
export interface TaxPosition {
  symbol: string;
  accountNo: string;
  qty: number;              // 보유 수량
  avgCostKRW: number;       // 1주당 평균 원가(KRW)
  currentPriceKRW: number;  // 1주당 현재가(KRW)
}

// 추천 매도안 한 줄
export interface SellRecommendation {
  symbol: string;
  accountNo: string;
  qtyToSell: number;
  fullPosition: boolean;
  expectedProceedsKRW: number;
  expectedGainKRW: number;
}

// 비과세 한도 내 전략 결과
export interface ExemptionSafePlanResult {
  year: number;
  realizedGainYtdKRW: number;
  remainingExemptionKRW: number;
  plannedAdditionalGainKRW: number;
  recommendations: SellRecommendation[];
}

/**
 * 연 2,500,000원 비과세 한도 내에서
 * 추가로 매도해도 되는 추천안 생성 (greedy 근사)
 *
 * safetyMargin: 0.9 ~ 1.0 정도로 잡아서
 * 실제 한도보다 약간 보수적으로 맞추게 할 수 있음.
 */
export function buildExemptionSafePlan(
  positions: TaxPosition[],
  realizedGainByYear: RealizedGainByYear,
  year: number,
  taxConfig: TaxConfig = DEFAULT_TAX_CONFIG,
  safetyMargin: number = 0.96
): ExemptionSafePlanResult {
  const realizedYtd =
    realizedGainByYear[year]?.totalGainKRW ?? 0;

  const rawRemaining =
    taxConfig.usStockAnnualExemption - realizedYtd;

  const remainingExemptionKRW = Math.max(0, rawRemaining);
  const targetGainLimit = remainingExemptionKRW * safetyMargin;

  // 각 포지션 전량 매도 시 예상 이익 계산
  const candidates = positions.map(pos => {
    const maxGainKRW =
      (pos.currentPriceKRW - pos.avgCostKRW) * pos.qty;
    const maxProceedsKRW = pos.currentPriceKRW * pos.qty;

    return {
      ...pos,
      maxGainKRW,
      maxProceedsKRW,
    };
  });

  // 손실(음수 gain) 먼저, 그 다음 gain 작은 순서대로 정렬
  candidates.sort(
    (a, b) => a.maxGainKRW - b.maxGainKRW
  );

  const recommendations: SellRecommendation[] = [];
  let accumulatedGain = 0;

  for (const c of candidates) {
    // 손실 포지션은 한도와 무관하게 전량 매도 추천(세금에 유리)
    if (c.maxGainKRW <= 0) {
      recommendations.push({
        symbol: c.symbol,
        accountNo: c.accountNo,
        qtyToSell: c.qty,
        fullPosition: true,
        expectedProceedsKRW: c.maxProceedsKRW,
        expectedGainKRW: c.maxGainKRW,
      });
      accumulatedGain += c.maxGainKRW; // 음수면 한도 여유를 더 만듦
      continue;
    }

    // 여기서부터는 양의 이익. 남은 한도를 체크.
    const remainingGainRoom = targetGainLimit - accumulatedGain;

    if (remainingGainRoom <= 0) {
      break; // 더 팔면 한도 초과
    }

    if (c.maxGainKRW <= remainingGainRoom) {
      // 전량 매도해도 한도 안에 들어옴
      recommendations.push({
        symbol: c.symbol,
        accountNo: c.accountNo,
        qtyToSell: c.qty,
        fullPosition: true,
        expectedProceedsKRW: c.maxProceedsKRW,
        expectedGainKRW: c.maxGainKRW,
      });
      accumulatedGain += c.maxGainKRW;
    } else {
      // 부분 매도가 필요. gain이 거의 선형이라고 가정하고 비례 배분.
      const fraction = remainingGainRoom / c.maxGainKRW;
      const partialQty = Math.floor(c.qty * fraction);

      if (partialQty > 0) {
        const partialProceeds =
          partialQty * c.currentPriceKRW;
        const partialGain =
          (c.currentPriceKRW - c.avgCostKRW) * partialQty;

        recommendations.push({
          symbol: c.symbol,
          accountNo: c.accountNo,
          qtyToSell: partialQty,
          fullPosition: false,
          expectedProceedsKRW: partialProceeds,
          expectedGainKRW: partialGain,
        });
        accumulatedGain += partialGain;
      }

      // 한도에 거의 맞춰졌으므로 루프 종료
      break;
    }
  }

  return {
    year,
    realizedGainYtdKRW: realizedYtd,
    remainingExemptionKRW,
    plannedAdditionalGainKRW: accumulatedGain,
    recommendations,
  };
}

###3️⃣ buildTargetAmountPlan()

사용자가 “올해 미국 주식에서 XX원 정도 팔고 싶다” 라고 입력했을 때,
그 금액에 맞춰 세금을 최소화하는 매도 조합 을 제안.

export interface TargetAmountPlanResult {
  year: number;
  targetProceedsKRW: number;
  realizedGainYtdKRW: number;
  additionalGainKRW: number;
  totalProceedsKRW: number;
  taxableGainKRW: number;
  estimatedTaxKRW: number;
  recommendations: SellRecommendation[];
}

/**
 * 목표 매도금액(targetProceedsKRW)에 최대한 근접하게,
 * 세금을 최소화하는 방향으로 포지션 조합을 추천.
 *
 * 1. 손실 포지션 먼저 전량 매도 (세금 방어)
 * 2. 나머지는 gain/proceeds 비율이 낮은 순서대로 greedy
 */
export function buildTargetAmountPlan(
  positions: TaxPosition[],
  realizedGainByYear: RealizedGainByYear,
  year: number,
  targetProceedsKRW: number,
  taxConfig: TaxConfig = DEFAULT_TAX_CONFIG
): TargetAmountPlanResult {
  const realizedYtd =
    realizedGainByYear[year]?.totalGainKRW ?? 0;

  // 후보 데이터에 계산 값 추가
  const candidates = positions.map(pos => {
    const maxProceedsKRW = pos.currentPriceKRW * pos.qty;
    const maxGainKRW =
      (pos.currentPriceKRW - pos.avgCostKRW) * pos.qty;
    const gainPerProceeds =
      maxProceedsKRW !== 0
        ? maxGainKRW / maxProceedsKRW
        : 0;

    return {
      ...pos,
      maxProceedsKRW,
      maxGainKRW,
      gainPerProceeds,
    };
  });

  const recommendations: SellRecommendation[] = [];
  let totalProceedsKRW = 0;
  let additionalGainKRW = 0;

  // 1️⃣ 손실 포지션 먼저 전량 매도
  const lossPositions = candidates.filter(c => c.maxGainKRW < 0);
  const nonLossPositions = candidates.filter(c => c.maxGainKRW >= 0);

  for (const c of lossPositions) {
    if (totalProceedsKRW >= targetProceedsKRW) break;

    recommendations.push({
      symbol: c.symbol,
      accountNo: c.accountNo,
      qtyToSell: c.qty,
      fullPosition: true,
      expectedProceedsKRW: c.maxProceedsKRW,
      expectedGainKRW: c.maxGainKRW,
    });

    totalProceedsKRW += c.maxProceedsKRW;
    additionalGainKRW += c.maxGainKRW; // 음수 → 세금 방어 효과
  }

  // 2️⃣ 나머지는 gain/proceeds 비율이 낮은 순으로 greedy
  nonLossPositions.sort(
    (a, b) => a.gainPerProceeds - b.gainPerProceeds
  );

  for (const c of nonLossPositions) {
    if (totalProceedsKRW >= targetProceedsKRW) break;

    const remainingProceeds =
      targetProceedsKRW - totalProceedsKRW;

    if (remainingProceeds <= 0) break;

    if (c.maxProceedsKRW <= remainingProceeds) {
      // 전량 매도
      recommendations.push({
        symbol: c.symbol,
        accountNo: c.accountNo,
        qtyToSell: c.qty,
        fullPosition: true,
        expectedProceedsKRW: c.maxProceedsKRW,
        expectedGainKRW: c.maxGainKRW,
      });
      totalProceedsKRW += c.maxProceedsKRW;
      additionalGainKRW += c.maxGainKRW;
    } else {
      // 부분 매도 비율 계산
      const fraction = remainingProceeds / c.maxProceedsKRW;
      const partialQty = Math.floor(c.qty * fraction);

      if (partialQty > 0) {
        const partialProceeds =
          partialQty * c.currentPriceKRW;
        const partialGain =
          (c.currentPriceKRW - c.avgCostKRW) * partialQty;

        recommendations.push({
          symbol: c.symbol,
          accountNo: c.accountNo,
          qtyToSell: partialQty,
          fullPosition: false,
          expectedProceedsKRW: partialProceeds,
          expectedGainKRW: partialGain,
        });

        totalProceedsKRW += partialProceeds;
        additionalGainKRW += partialGain;
      }

      break; // 목표 금액 근처까지 왔다고 보고 종료
    }
  }

  // 세금 계산
  const totalGainAfterPlan = realizedYtd + additionalGainKRW;
  const taxableGain = Math.max(
    0,
    totalGainAfterPlan - taxConfig.usStockAnnualExemption
  );
  const estimatedTax = taxableGain * taxConfig.usStockTaxRate;

  return {
    year,
    targetProceedsKRW,
    realizedGainYtdKRW: realizedYtd,
    additionalGainKRW,
    totalProceedsKRW,
    taxableGainKRW: taxableGain,
    estimatedTaxKRW: estimatedTax,
    recommendations,
  };
}

***어떻게 이어서 쓰면 좋냐면...***
	1.실제 거래 데이터(Trade[]) → calculateRealizedGainByYear()
      → 연도별 실현이익 맵 확보
	2.현재 보유 포지션 + 환율/현재가 → TaxPosition[] 생성
	3.비과세 한도 전략은 buildExemptionSafePlan()
	4.목표 매도금액 전략은 buildTargetAmountPlan()
	5.두 결과를 기반으로
	 • 대시보드 테이블
	 • PDF 리포트용 ViewModel을 만들면 전체 플로우가 완성됨.

    이미 구현해 둔 매수/매도 테이블 + 대시보드 위에 이 세 함수만 잘 얹으면, 거의 “미국주식 절세 시뮬레이터” 수준까지 올라감.
 