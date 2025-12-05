# Asset Config 개발 계획서

## 1. 개요 (Overview)

* **목표**: 기존 '분배금 관리' 중심에서 **'통합 자산 관리(Asset Config)'**로 시스템 확장.
* **핵심 기능**: 미국 주식(USD) 및 국내 상장 ETF(KRW)의 매수/매도 이력 통합 관리 및 포트폴리오 분석.
* **UI/UX**: 기존 디자인 시스템을 유지하되, 자산 특성(국가, 통화, 계좌유형)을 직관적으로 보여주는 **Badge & Tag** 시스템 도입.

## 2. 데이터 구조 설계 (Data Structure)

새로운 `AssetRecord` 타입을 정의하여 기존 `DividendRecord`와 분리 관리.

```typescript
type Currency = 'KRW' | 'USD';
type TradeType = 'BUY' | 'SELL';

interface AssetRecord {
  id: string;
  date: string;            // 거래일
  broker: string;          // 증권사 (키움, 토스 등)
  accountType: string;     // 계좌유형 (일반, ISA, 연금저축)
  stockType: string;       // 주식구분 (개별주식, ETF)
  country: string;         // 국가 (USA, KOR)
  name: string;            // 종목명
  currency: Currency;      // 통화
  tradeType: TradeType;    // 거래유형 (매수, 매도)
  quantity: number;        // 수량
  price: number;           // 단가 (매입가/매도가)
  exchangeRate?: number;   // 환율 (USD인 경우 필수)
  amount: number;          // 총 거래금액 (원화 환산액 포함)
  note?: string;           // 비고
}
```

## 3. 주요 기능 명세 (Feature Spec)

### A. 데이터 관리 (CRUD)

* [ ] **Asset Config 탭 추가**: 상단 헤더에 3번째 탭으로 추가.
* [ ] **통합 입력 폼**: 환율 자동 계산 및 통화 선택 기능이 포함된 입력 모달 구현.
* [ ] **데이터 그리드**: 국가/통화/계좌별 필터링 및 정렬이 가능한 고도화된 테이블.

### B. 시각화 및 분석 (Dashboard)

* [ ] **자산 요약 카드**: 총 평가금액, 환차손익(예정), 포트폴리오 비중.
* [ ] **뱃지(Badge) 시스템**:
  * 국가: 🇺🇸 USA (Blue), 🇰🇷 KOR (Red)
  * 통화: 💲 USD (Green), ₩ KRW (Slate)
  * 계좌: 🏦 ISA (Gold), 🏠 일반 (Gray)

## 4. 개발 일정 (Phase)

1. **Phase 1: 구조 설계**
    * `AssetRecord` 타입 정의 및 로컬 스토리지(`asset_config_data`) 구성.
2. **Phase 2: UI 구현**
    * 헤더 탭 확장 및 `AssetConfig` 메인 컴포넌트 개발.
    * 테이블 및 입력 폼(Modal) UI 제작.
3. **Phase 3: 로직 연결**
    * 매수/매도 금액 계산 로직 (환율 적용).
    * CRUD 연동.
4. **Phase 4: 검증 및 최적화**
    * 샘플 데이터 테스트 및 오차 검증.

## 5. UI 레이아웃 스케치 (Concept)

*(생성될 이미지 참조)*
* 상단: **Asset Dashboard** (총 자산, 달러 자산, 원화 자산 요약)
* 중단: **Control Bar** (기간 필터, 검색, 추가 버튼)
* 하단: **Asset Table** (상세 거래 내역 리스트)
