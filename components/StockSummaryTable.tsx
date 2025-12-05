
import React, { useMemo } from 'react';
import { DividendRecord, AccountType } from '../types';
import { TrendingUp, TrendingDown, Minus, CalendarRange } from 'lucide-react';

interface StockSummaryTableProps {
  filteredRecords: DividendRecord[];
  startMonth: string;
  endMonth: string;
  accountType: AccountType;
}

export const StockSummaryTable: React.FC<StockSummaryTableProps> = ({ filteredRecords, startMonth, endMonth, accountType }) => {
  const formatNumber = (num: number) => new Intl.NumberFormat('ko-KR').format(num);

  // Calculation Logic based on props
  const summaryData = useMemo(() => {
    if (filteredRecords.length === 0) return [];

    // Group by stock
    const stockGroups: Record<string, DividendRecord[]> = {};
    filteredRecords.forEach(r => {
      if (!stockGroups[r.stockName]) {
        stockGroups[r.stockName] = [];
      }
      stockGroups[r.stockName].push(r);
    });

    return Object.keys(stockGroups).map(stockName => {
      const stockRecs = stockGroups[stockName];
      // Sort by date ascending to find earliest and latest in range
      stockRecs.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

      const earliestRecord = stockRecs[0];
      const latestRecord = stockRecs[stockRecs.length - 1];

      // A. Total Income (Sum of Net Income in range)
      const totalIncome = stockRecs.reduce((sum, r) => {
        const net = (r.quantity * r.dividendPerShare) - r.taxAmount;
        return sum + net;
      }, 0);

      // B. Changes Logic
      // If Start != End, calc difference between Latest and Earliest in range.
      // If Start == End, use the record's inherent change value (change vs previous month).
      // However, if filteredRecords only has 1 item because start==end, we use that item's stored change.
      // If filteredRecords has 1 item but start!=end (data gap), we still default to that item's stored change or 0.

      let calculatedPriceChange = 0;
      let calculatedDividendChange = 0;

      // Check if we are looking at a range or a single point in time effectively
      const isRangeView = startMonth !== endMonth && stockRecs.length > 1;

      if (isRangeView) {
        calculatedPriceChange = latestRecord.currentPrice - earliestRecord.currentPrice;
        calculatedDividendChange = latestRecord.dividendPerShare - earliestRecord.dividendPerShare;
      } else {
        // Fallback to the latest record's stored change (vs its immediate history)
        calculatedPriceChange = latestRecord.priceChange;
        calculatedDividendChange = latestRecord.dividendChange;
      }

      return {
        stockName,
        totalIncome,
        priceChange: calculatedPriceChange,
        dividendChange: calculatedDividendChange,
        latestPrice: latestRecord.currentPrice,
        count: stockRecs.length
      };
    });
  }, [filteredRecords, startMonth, endMonth]);

  const renderChange = (val: number) => {
    if (val === 0) return <span className="text-slate-400 flex items-center justify-end gap-1"><Minus className="w-3 h-3" /> 0</span>;
    const isPositive = val > 0;
    return (
      <span className={`flex items-center justify-end gap-1 font-medium ${isPositive ? 'text-red-500' : 'text-blue-600'}`}>
        {isPositive ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
        {formatNumber(val)}
      </span>
    );
  };

  const displayDate = startMonth === endMonth ? startMonth : `${startMonth} ~ ${endMonth}`;

  return (
    <div className="bg-white rounded-lg shadow-sm border border-slate-200 overflow-hidden flex flex-col h-full">
      {/* Header */}
      <div className="bg-slate-50 px-4 py-3 border-b border-slate-200 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <CalendarRange className="w-5 h-5 text-indigo-600" />
          <h3 className="font-bold text-slate-700">종목별 기간 수익 분석</h3>
        </div>
        <span className="text-xs font-medium text-slate-500 bg-white px-2 py-1 rounded border border-slate-200">
          {displayDate}
        </span>
      </div>

      {/* Summary Table */}
      <div className="overflow-x-auto flex-1">
        <table className="w-full text-sm text-left">
          <thead className="bg-white text-slate-600 font-medium border-b border-slate-200 sticky top-0">
            <tr>
              <th className="px-4 py-3 bg-slate-50/50">종목명</th>
              <th className="px-4 py-3 text-right bg-slate-50/50">
                {accountType === 'general' ? '총 수입 (세후)' : '총 수입'}
              </th>
              <th className="px-4 py-3 text-right bg-slate-50/50">주가등락</th>
              <th className="px-4 py-3 text-right bg-slate-50/50">분배금등락</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {summaryData.map((item) => (
              <tr key={item.stockName} className="hover:bg-slate-50 transition-colors">
                <td className="px-4 py-3 font-medium text-slate-800">
                  {item.stockName}
                  <div className="text-xs text-slate-400 font-normal mt-0.5">
                    {item.count}건 데이터 합산
                  </div>
                </td>
                <td className="px-4 py-3 text-right font-bold text-fuchsia-700">
                  {formatNumber(item.totalIncome)}원
                </td>
                <td className="px-4 py-3 text-right">
                  {renderChange(item.priceChange)}
                </td>
                <td className="px-4 py-3 text-right">
                  {renderChange(item.dividendChange)}
                </td>
              </tr>
            ))}
            {summaryData.length === 0 && (
              <tr>
                <td colSpan={4} className="text-center py-8 text-slate-400">
                  선택한 기간에 데이터가 없습니다.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};
