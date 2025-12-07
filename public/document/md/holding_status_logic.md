# 보유현황 및 매도 로직 설계 문서

## 1. 개요

본 문서는 주식 거래 시스템에서 매수/매도 거래 내역을 관리하고, 이를 기반으로 보유현황을 계산하는 로직 설계 방안을 제시한다. 특히 부분매도와 전체매도를 통합 처리하는 아키텍처를 정의한다.

## 2. 핵심 설계 원칙

### 2.1 데이터 모델 구조

현재 CSV 파일은 **보유현황 테이블이 아닌 거래 히스토리(Transaction History) 테이블**로 설계되어 있기에 필수적으로 변경이 필요하다.

**거래 히스토리 테이블 컬럼 구조:**

- 주식구분, 국가, 거래일, 증권사, 종목명
- 계좌번호, 계좌유형, 거래유형, 분배주기
- 매입주가, 수량, 매수금액, 매도금액, 적용환율

### 2.2 처리 방식

- 현재 파일은 “현재 얼마 들고 있냐”를 저장하는 게 아니라 “언제, 어떤 종목을, 얼마나 사고(매수), 팔았는지(매도)” = 거래 내역을 저장하는 구조라는 것.
- 따라서 매도 로직은 “보유 테이블을 직접 수정”이 아니라 “거래 내역(트랜잭션)을 추가하고, 그걸 다시 집계해서 보유현황을 만드는 방식”으로 가야 함.

## 3. 데이터 타입 정의

### 3.1 Trade 타입 (types/trade.ts)

```typescript
export type TradeType = 'BUY' | 'SELL';

export interface Trade {
  id: string;
  stockType: string;      // ETF주식 등
  country: string;        // USA
  tradeDate: string;      // YYYY-MM-DD
  broker: string;         // 증권사
  symbol: string;         // 종목명 or 종목코드
  accountNo: string;      // 계좌번호
  accountType: string;    // 계좌유형
  tradeType: TradeType;   // BUY | SELL
  distributionCycle: string; // 분배주기
  price: number;          // 매입가 or 매도가
  qty: number;            // 항상 양수
  buyAmount: number;      // BUY일 때만 사용
  sellAmount: number;     // SELL일 때만 사용
  fxRate: number;         // 환율
}
```

### 3.2 매수/매도 데이터 규칙

| 거래유형 | 수량 | 매수금액 | 매도금액 |
|---------|------|---------|---------|
| 매수(BUY) | 양수 | 값 존재 | 0 |
| 매도(SELL) | 양수 | 0 | 값 존재 |

## 4. 보유 포지션 계산 로직

### 4.1 PositionSummary 인터페이스

```typescript
export interface PositionSummary {
  totalQty: number;       // 총 보유수량
  avgCost: number;        // 평균단가
  totalCost: number;      // 총 매입원가
  realizedPnL: number;    // 실현손익
}
```

### 4.2 포지션 계산 알고리즘

```typescript
export function calculatePosition(trades: Trade[]): PositionSummary {
  let totalQty = 0;
  let totalCost = 0;
  let realizedPnL = 0;

  // 거래일 기준 시간순 정렬
  const sorted = [...trades].sort(
    (a, b) => new Date(a.tradeDate).getTime() - new Date(b.tradeDate).getTime()
  );

  for (const t of sorted) {
    if (t.tradeType === 'BUY') {
      totalQty += t.qty;
      totalCost += t.qty * t.price;
    }

    if (t.tradeType === 'SELL') {
      if (t.qty > totalQty) {
        throw new Error('보유 수량 초과 매도');
      }

      const avgCost = totalCost / totalQty;
      realizedPnL += (t.price - avgCost) * t.qty;

      totalQty -= t.qty;
      totalCost -= avgCost * t.qty;
    }
  }

  return {
    totalQty,
    avgCost: totalQty > 0 ? totalCost / totalQty : 0,
    totalCost,
    realizedPnL,
  };
}
```

### 4.3 계산 로직 상세

**매수 시:**

- `totalQty += 매수수량`
- `totalCost += 매수수량 × 매입주가`
- `avgCost = totalCost / totalQty`

**매도 시 (평균단가법):**

- 매도 전 상태: `beforeQty`, `beforeAvgCost`, `beforeTotalCost`
- 실현손익: `realizedPnL += (매도가 - beforeAvgCost) × 매도수량`
- 매도 후 수량: `afterQty = beforeQty - 매도수량`
- 매도 후 원가: `afterTotalCost = beforeTotalCost - (beforeAvgCost × 매도수량)`
- 매도 후 평균단가: `afterAvgCost = afterQty > 0 ? afterTotalCost / afterQty : 0`

## 5. 매도 처리 로직

### 5.1 부분매도 vs 전체매도

부분매도와 전체매도는 별도의 로직이 아니라, **보유수량 대비 매도수량의 비율**로 자동 판별된다.

| 조건 | 결과 |
|-----|------|
| `sellQty < positionQty` | 부분매도 (잔여 수량 존재) |
| `sellQty === positionQty` | 전체매도 (포지션 청산) |
| `sellQty > positionQty` | 에러: 보유 수량 초과 |

### 5.2 매도 검증 및 생성 함수

```typescript
export function createSellTrade(
  existingTrades: Trade[],
  sellQty: number,
  sellPrice: number,
  baseInfo: Omit<Trade, 'tradeType' | 'qty' | 'price' | 'buyAmount' | 'sellAmount'>
): Trade {
  const position = calculatePosition(existingTrades);

  if (sellQty > position.totalQty) {
    throw new Error(`매도 수량 오류: 현재 보유 ${position.totalQty}주`);
  }

  const sellTrade: Trade = {
    ...baseInfo,
    id: crypto.randomUUID(),
    tradeType: 'SELL',
    qty: sellQty,
    price: sellPrice,
    buyAmount: 0,
    sellAmount: sellQty * sellPrice,
  };

  return sellTrade;
}
```

## 6. Next.js 구현 가이드

### 6.1 매도 API 라우트

```typescript
// app/api/trade/sell/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { createSellTrade } from '@/lib/createSellTrade';

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { existingTrades, sellQty, sellPrice, baseInfo } = body;

  try {
    const sellTrade = createSellTrade(
      existingTrades,
      sellQty,
      sellPrice,
      baseInfo
    );

    // DB 저장
    // await db.trade.create({ data: sellTrade })

    return NextResponse.json({ success: true, sellTrade });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, message: err.message },
      { status: 400 }
    );
  }
}
```

### 6.2 프론트엔드 매도 처리

```typescript
async function submitSell() {
  const res = await fetch('/api/trade/sell', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      existingTrades,
      sellQty,
      sellPrice,
      baseInfo,
    }),
  });

  const result = await res.json();

  if (!result.success) {
    alert(result.message);
  } else {
    alert('매도 완료');
  }
}
```

### 6.3 매도 UI 플로우

1. **보유현황 테이블에서 종목 선택** → 매도 버튼 클릭
2. **매도 모달 표시**
   - 계좌 / 종목명: 자동 입력 (수정 불가)
   - 매도수량: 사용자 입력 (최대값 = 현재 보유수량)
   - 매도가: 사용자 입력
   - 거래일, 증권사, 환율 등: 기본값 자동 설정
3. **서버 검증 및 저장**
   - 해당 계좌+종목의 모든 거래 내역 조회
   - 현재 보유수량 및 평균단가 계산
   - 매도수량 유효성 검증
   - 새로운 SELL 트랜잭션 추가
4. **UI 업데이트**
   - 보유수량 감소 또는 0으로 변경
   - 실현손익 업데이트
   - 전체매도 시 해당 종목 리스트에서 제거 또는 '청산' 상태 표시

## 7. 종목별 포지션 집계

### 7.1 PositionCalcResult 인터페이스

```typescript
export interface PositionCalcResult {
  symbol: string;
  accountNo: string;
  totalQty: number;
  avgCost: number;
  totalBuyAmount: number;
  totalSellAmount: number;
  realizedPnL: number;
}
```

### 7.2 다중 종목 포지션 계산

```typescript
export function calculatePositions(trades: Trade[]): PositionCalcResult[] {
  const map = new Map<string, Trade[]>();

  // 종목 + 계좌 기준 그룹화
  for (const t of trades) {
    const key = `${t.symbol}_${t.accountNo}`;
    if (!map.has(key)) map.set(key, []);
    map.get(key)!.push(t);
  }

  const results: PositionCalcResult[] = [];

  for (const [key, groupedTrades] of map.entries()) {
    let totalQty = 0;
    let totalCost = 0;
    let realizedPnL = 0;
    let totalBuyAmount = 0;
    let totalSellAmount = 0;

    const sorted = groupedTrades.sort(
      (a, b) => new Date(a.tradeDate).getTime() - new Date(b.tradeDate).getTime()
    );

    for (const t of sorted) {
      if (t.tradeType === 'BUY') {
        totalQty += t.qty;
        totalCost += t.qty * t.price;
        totalBuyAmount += t.buyAmount;
      }

      if (t.tradeType === 'SELL') {
        const avgCost = totalCost / totalQty;
        const pnl = (t.price - avgCost) * t.qty;

        realizedPnL += pnl;
        totalSellAmount += t.sellAmount;

        totalQty -= t.qty;
        totalCost -= avgCost * t.qty;
      }
    }

    const [symbol, accountNo] = key.split('_');

    results.push({
      symbol,
      accountNo,
      totalQty,
      avgCost: totalQty > 0 ? totalCost / totalQty : 0,
      totalBuyAmount,
      totalSellAmount,
      realizedPnL,
    });
  }

  return results;
}
```

## 8. 평가손익 계산

### 8.1 시장가격 적용

```typescript
export interface MarketPrice {
  symbol: string;
  price: number;
}

export interface PositionWithMarket extends PositionCalcResult {
  currentPrice: number;
  evaluationAmount: number;
  unrealizedPnL: number;
  returnRate: number;
}

export function applyMarketPrices(
  positions: PositionCalcResult[],
  prices: MarketPrice[]
): PositionWithMarket[] {
  return positions.map(pos => {
    const market = prices.find(p => p.symbol === pos.symbol);
    const currentPrice = market?.price ?? 0;

    const evaluationAmount = pos.totalQty * currentPrice;
    const buyCost = pos.totalQty * pos.avgCost;
    const unrealizedPnL = evaluationAmount - buyCost;

    const returnRate = buyCost > 0 ? (unrealizedPnL / buyCost) * 100 : 0;

    return {
      ...pos,
      currentPrice,
      evaluationAmount,
      unrealizedPnL,
      returnRate,
    };
  });
}
```

## 9. 대시보드 ViewModel

### 9.1 ViewModel 구조

```typescript
export interface PositionDashboardVM {
  symbol: string;
  accountNo: string;
  totalQty: number;
  avgCost: number;
  currentPrice: number;
  evaluationAmount: number;
  realizedPnL: number;
  unrealizedPnL: number;
  returnRate: number;
  status: 'HOLDING' | 'CLOSED';
}

export function buildDashboardViewModel(
  positions: PositionWithMarket[]
): PositionDashboardVM[] {
  return positions.map(pos => ({
    symbol: pos.symbol,
    accountNo: pos.accountNo,
    totalQty: pos.totalQty,
    avgCost: pos.avgCost,
    currentPrice: pos.currentPrice,
    evaluationAmount: pos.evaluationAmount,
    realizedPnL: pos.realizedPnL,
    unrealizedPnL: pos.unrealizedPnL,
    returnRate: pos.returnRate,
    status: pos.totalQty > 0 ? 'HOLDING' : 'CLOSED',
  }));
}
```

### 9.2 대시보드 API

```typescript
// app/api/dashboard/positions/route.ts
import { NextResponse } from 'next/server';
import { calculatePositions } from '@/lib/calculatePositions';
import { applyMarketPrices } from '@/lib/applyMarketPrices';
import { buildDashboardViewModel } from '@/lib/buildDashboardViewModel';

export async function GET() {
  // 1. DB에서 모든 거래 조회
  const trades = await db.trade.findMany();

  // 2. 현재가 조회 (외부 API 연동)
  const marketPrices = [
    { symbol: 'TSLA', price: 248 },
    { symbol: 'SPYG', price: 67 },
  ];

  // 3. 집계 처리
  const positions = calculatePositions(trades);
  const withMarket = applyMarketPrices(positions, marketPrices);
  const dashboardVM = buildDashboardViewModel(withMarket);

  return NextResponse.json(dashboardVM);
}
```

### 9.3 응답 데이터 예시

```json
{
  "symbol": "TSLA",
  "accountNo": "123-01",
  "totalQty": 12,
  "avgCost": 210.3,
  "currentPrice": 248,
  "evaluationAmount": 2976,
  "realizedPnL": 180,
  "unrealizedPnL": 451,
  "returnRate": 17.9,
  "status": "HOLDING"
}
```

## 10. CSV/Excel 업로드 처리

### 10.1 업로드 파일 형식 규칙

매수/매도 거래를 동시에 처리하기 위한 CSV 형식:

| 컬럼 | 매수(BUY) | 매도(SELL) |
|-----|----------|-----------|
| 거래유형 | "매수" | "매도" |
| 수량 | 양수 | 양수 |
| 매수금액 | 값 존재 | 0 |
| 매도금액 | 0 | 값 존재 |

### 10.2 파싱 로직

```typescript
tradeType = row.거래유형 === '매수' ? 'BUY' : 'SELL';
qty = Number(row.수량);
buyAmount = tradeType === 'BUY' ? Number(row.매수금액) : 0;
sellAmount = tradeType === 'SELL' ? Number(row.매도금액) : 0;
```

## 11. 시스템 아키텍처 요약

| 계층 | 역할 | 특징 |
|-----|------|------|
| **Trade 테이블** | 모든 매수/매도 거래 원본 저장 | 불변(Immutable) 데이터 |
| **calculatePosition** | 보유수량, 평균단가, 실현손익 계산 | 순수 함수(Pure Function) |
| **createSellTrade** | 매도 검증 및 트랜잭션 생성 | 부분/전체매도 자동 판별 |
| **API Route** | 매도 트랜잭션 서버 저장 | 비즈니스 로직 처리 |
| **Dashboard** | Position 재계산 결과 시각화 | 읽기 전용 뷰 |

## 12. 설계 원칙 정리

1. ✅ **Trade 테이블은 원본 데이터이며 절대 수정하지 않는다**
2. ✅ **모든 매수/매도는 거래 추가(Insert) 방식으로 처리**
3. ✅ **Position은 거래 집계 결과로 서버에서 계산**
4. ✅ **부분매도/전체매도는 자동 계산 결과이며 별도 로직 분기 없음**
5. ✅ **대시보드는 ViewModel만 사용하여 표시**

---

**문서 버전:** 1.0  
**최종 수정일:** 2025-12-07
