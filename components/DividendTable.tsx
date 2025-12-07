
import React, { useMemo } from 'react';
import { DividendRecord, AccountType } from '../types';

interface DividendTableProps {
  records: DividendRecord[];
  onRowClick: (record: DividendRecord) => void;
  accountType: AccountType;
}

export const DividendTable: React.FC<DividendTableProps> = ({ records, onRowClick, accountType }) => {
  const formatNumber = (num: number) => new Intl.NumberFormat('ko-KR').format(num);

  // Helper to determine text color for changes
  const getChangeColor = (val: number) => {
    if (val > 0) return 'text-red-500 font-medium';
    if (val < 0) return 'text-blue-600 font-medium';
    return 'text-slate-900';
  };

  // Process records to add calculated fields for display
  const enrichedRecords = useMemo(() => {
    // Records are already sorted by date in App.tsx typically, but ensure safety
    const sorted = [...records].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

    return sorted.map(rec => {
      // Rule 3: Gross Distribution = Dividend * Quantity
      const grossDistribution = rec.dividendPerShare * rec.quantity;

      // Net = Gross - Tax Amount
      const totalNet = grossDistribution - rec.taxAmount;

      return {
        ...rec,
        grossDistribution,
        totalNet
      };
    });
  }, [records]);

  // Rule 6: Function to calculate monthly sum of 'Total Net'
  const getMonthlyTotal = (index: number, currentRecord: typeof enrichedRecords[0]) => {
    const currentMonth = currentRecord.date.substring(0, 7); // YYYY-MM
    const nextRecord = enrichedRecords[index + 1];
    const nextMonth = nextRecord ? nextRecord.date.substring(0, 7) : null;

    // Display total only on the last row of the month
    if (currentMonth !== nextMonth) {
      // Calculate sum of 'totalNet' for this month
      const sum = enrichedRecords
        .filter(r => r.date.startsWith(currentMonth))
        .reduce((acc, curr) => acc + curr.totalNet, 0);
      return sum;
    }
    return null;
  };

  // Calculate Summary Stats for Footer
  const summary = useMemo(() => {
    if (enrichedRecords.length === 0) return null;

    const totalQuantity = enrichedRecords.reduce((sum, r) => sum + r.quantity, 0);
    const totalGross = enrichedRecords.reduce((sum, r) => sum + r.grossDistribution, 0); // Sum of Receipt Amount

    // Weighted Average Price (Current Price)
    let totalVal = 0;
    enrichedRecords.forEach(r => {
      totalVal += r.currentPrice * r.quantity;
    });
    const averagePrice = totalQuantity > 0 ? totalVal / totalQuantity : 0;

    return { totalQuantity, totalGross, averagePrice };
  }, [enrichedRecords]);

  return (
    <div className="w-full overflow-x-auto border border-slate-400 shadow-sm">
      <table className="w-full min-w-[1000px] text-sm border-collapse bg-white">
        <thead>
          <tr className="bg-slate-700 text-white h-10">
            <th className="border-r border-slate-500 px-2 py-1 font-medium w-24">거래일</th>
            <th className="border-r border-slate-500 px-2 py-1 font-medium text-left">종목명</th>
            <th className="border-r border-slate-500 px-2 py-1 font-medium w-20">주식수량</th>
            <th className="border-r border-slate-500 px-2 py-1 font-medium w-20">현주가</th>
            <th className="border-r border-slate-500 px-2 py-1 font-medium w-20">주가등락</th>
            <th className="border-r border-slate-500 px-2 py-1 font-medium w-20">분배금</th>
            <th className="border-r border-slate-500 px-2 py-1 font-medium w-20">분배금등락</th>
            <th className="border-r border-slate-500 px-2 py-1 font-medium w-24">분배금수령액</th>
            {accountType === 'general' && (
              <>
                <th className="border-r border-slate-500 px-2 py-1 font-medium w-16">과세표준</th>
                <th className="border-r border-slate-500 px-2 py-1 font-medium w-24">과세분배금</th>
                <th className="border-r border-slate-500 px-2 py-1 font-medium w-20">과세금액</th>
              </>
            )}
            <th className="border-r border-slate-500 px-2 py-1 font-medium w-24">합계</th>
            <th className="px-2 py-1 font-medium w-24">월 수령액</th>
          </tr>
        </thead>
        <tbody>
          {enrichedRecords.map((record, index) => {
            const monthlyTotal = getMonthlyTotal(index, record);
            const isLastRow = index === enrichedRecords.length - 1;

            return (
              <tr
                key={record.id}
                onClick={() => onRowClick(record)}
                className={`group hover:bg-indigo-50 cursor-pointer transition-colors ${!isLastRow ? 'border-b border-slate-300' : ''} h-9 relative`}
              >
                <td className="border-r border-slate-300 px-2 text-center text-slate-800">
                  <div className="flex items-center justify-center gap-1">
                    {record.date}
                  </div>
                </td>
                <td className="border-r border-slate-300 px-2 text-slate-800 truncate max-w-xs group-hover:text-indigo-700 font-medium" title={record.stockName}>
                  {record.stockName}
                </td>
                <td className="border-r border-slate-300 px-2 text-right text-slate-800">{formatNumber(record.quantity)}</td>
                <td className="border-r border-slate-300 px-2 text-right text-slate-800">{record.currentPrice > 0 ? formatNumber(record.currentPrice) : ''}</td>
                <td className={`border-r border-slate-300 px-2 text-right ${getChangeColor(record.priceChange)}`}>
                  {record.priceChange !== 0 ? formatNumber(record.priceChange) : '0'}
                </td>
                <td className="border-r border-slate-300 px-2 text-right text-slate-800">{formatNumber(record.dividendPerShare)}</td>
                <td className={`border-r border-slate-300 px-2 text-right ${getChangeColor(record.dividendChange)}`}>
                  {record.dividendChange !== 0 ? formatNumber(record.dividendChange) : '0'}
                </td>
                {/* Rule 3: Gross Distribution */}
                <td className="border-r border-slate-300 px-2 text-right text-slate-800">{formatNumber(record.grossDistribution)}</td>
                {accountType === 'general' && (
                  <>
                    <td className="border-r border-slate-300 px-2 text-right text-slate-800">{record.taxBase > 0 ? record.taxBase : '0'}</td>
                    <td className="border-r border-slate-300 px-2 text-right text-slate-800">{formatNumber(record.taxableDistribution)}</td>
                    <td className="border-r border-slate-300 px-2 text-right text-slate-800">{formatNumber(record.taxAmount)}</td>
                  </>
                )}
                <td className="border-r border-slate-300 px-2 text-right text-slate-800 font-medium bg-slate-50 group-hover:bg-indigo-100">
                  {formatNumber(record.totalNet)}
                </td>
                {/* Rule 6: Monthly Total */}
                <td className="px-2 text-right font-bold text-fuchsia-600 bg-white group-hover:bg-indigo-50">
                  {monthlyTotal !== null ? formatNumber(monthlyTotal) : ''}
                </td>
              </tr>
            );
          })}
          {enrichedRecords.length === 0 && (
            <tr>
              <td colSpan={accountType === 'general' ? 13 : 10} className="text-center py-8 text-slate-400">
                데이터가 없습니다. 상단 '데이터 등록' 버튼을 눌러 추가해주세요.
              </td>
            </tr>
          )}
        </tbody>

        {/* Summary Footer displayed as part of table body/footer depending on structure, here inside tbody just like AssetTable or after rows */}
        {/* Actually AssetTable puts it INSIDE tbody. Let's do same. */}
        {summary && (
          <tfoot className="bg-red-50 border-t-2 border-red-200">
            <tr>
              {/* Spacers for Date, Name */}
              <td colSpan={2} className="px-2 py-2 border-r border-red-100"></td>

              {/* Total Qty (Under Qty - Col 3) */}
              <td className="px-2 py-2 text-right font-bold text-red-700 border-r border-red-100 bg-red-50">
                <div className="text-[10px] text-red-400 mb-0.5">수량합계</div>
                {formatNumber(summary.totalQuantity)}
              </td>

              {/* Avg Price (Under Current Price - Col 4) */}
              <td className="px-2 py-2 text-right font-bold text-red-700 border-r border-red-100 bg-red-50">
                <div className="text-[10px] text-red-400 mb-0.5">평단가</div>
                {formatNumber(Math.round(summary.averagePrice))}
              </td>

              {/* Spacers for PriceChange, Dividend, DivChange */}
              <td colSpan={3} className="px-2 py-2 border-r border-red-100"></td>

              {/* Total Gross Dist (Under Receipt Amount - Col 8) */}
              <td className="px-2 py-2 text-right font-bold text-red-700 border-r border-red-100 bg-red-50">
                <div className="text-[10px] text-red-400 mb-0.5">합계</div>
                {formatNumber(summary.totalGross)}
              </td>

              {/* Remaining Spacers */}
              <td colSpan={accountType === 'general' ? 5 : 2} className="px-2 py-2"></td>
            </tr>
          </tfoot>
        )}
      </table>
    </div >
  );
};
