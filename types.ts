export type AccountType = 'general' | 'tax-free' | 'asset-config';

export interface AssetRecord {
  id: string;
  stockType: '개별주식' | 'ETF주식' | string;
  country: 'USA' | 'KOR' | string;
  date: string;
  broker: string;
  name: string;
  accountNumber?: string;
  accountType: '일반계좌' | 'ISA' | '연금저축계좌' | '비과세저축계좌' | '일반배당계좌' | string;
  tradeType: '매수' | '매도';
  dividendCycle: string;
  price: number;
  quantity: number;
  amount: number;
  sellAmount?: number;
  exchangeRate?: number;
  note?: string;
}

export interface DividendRecord {
  id: string;
  date: string; // YYYY-MM-DD
  stockName: string;
  quantity: number;
  currentPrice: number;
  priceChange: number; // 주가등락
  dividendPerShare: number; // 분배금
  dividendChange: number; // 분배금등락
  taxBase: number; // 과세표준
  taxableDistribution: number; // 과세분배금
  taxAmount: number; // 과세금액
  // Calculated fields handled in logic usually, but useful to store if manual override
  // grossDistribution: number; // Quantity * DivPerShare
  // totalReceived: number; // Gross - Tax (or similar logic depending on account type)
}

export interface MonthlyStats {
  month: string;
  totalAmount: number;
}

export interface SummaryStats {
  totalTaxableDistribution: number; // 과세분배금총금액
  totalTaxAmount: number; // 과세 총 금액
  totalReceived: number; // 총 수령액
}
export interface CashHolding {
  id: string; // Singleton use 'default'
  krwBalance: number;
  usdBalance: number;
  updatedAt: string;
}
