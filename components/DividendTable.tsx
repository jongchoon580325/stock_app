
import React, { useMemo, useState, useEffect } from 'react';
import { DividendRecord, AccountType } from '../types';
import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from 'lucide-react';

interface DividendTableProps {
  records: DividendRecord[];
  onRowClick: (record: DividendRecord) => void;
  accountType: AccountType;
  isFiltered?: boolean;
}

export const DividendTable: React.FC<DividendTableProps> = ({ records, onRowClick, accountType, isFiltered = false }) => {
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);
  const [showSummary, setShowSummary] = useState(false);

  // Reset page to 1 when records change (e.g., account type switch, data load)
  useEffect(() => {
    setCurrentPage(1);
  }, [records]);

  // Show summary 2 seconds after records change (only when filtered)
  useEffect(() => {
    setShowSummary(false);
    if (isFiltered && records.length > 0) {
      const timer = setTimeout(() => {
        setShowSummary(true);
      }, 2000);
      return () => clearTimeout(timer);
    }
  }, [records, isFiltered]);

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
    const sorted = [...records].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

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
  // Fix: Find original index from enrichedRecords using record.id
  const getMonthlyTotal = (record: typeof enrichedRecords[0]) => {
    const currentMonth = record.date.substring(0, 7); // YYYY-MM

    // Find the original index in enrichedRecords
    const originalIndex = enrichedRecords.findIndex(r => r.id === record.id);
    const nextRecord = enrichedRecords[originalIndex + 1];
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

  // Pagination logic
  const totalPages = Math.ceil(enrichedRecords.length / itemsPerPage);
  const paginatedRecords = useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    return enrichedRecords.slice(startIndex, startIndex + itemsPerPage);
  }, [enrichedRecords, currentPage, itemsPerPage]);

  const goToPage = (page: number) => {
    setCurrentPage(Math.max(1, Math.min(page, totalPages)));
  };

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
          {paginatedRecords.map((record, index) => {
            const monthlyTotal = getMonthlyTotal(record);
            const isLastRow = index === paginatedRecords.length - 1;

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
        {/* Summary Footer: Only show if showSummary is true AND summary exists */}
        {showSummary && summary && (
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

      {/* Pagination Controls */}
      <div className="flex items-center justify-between px-4 py-3 bg-slate-50 border-t border-slate-200 mt-auto">
        <div className="flex items-center gap-4">
          <div className="text-sm text-slate-600">
            {enrichedRecords.length}건 중 {((currentPage - 1) * itemsPerPage) + 1}-{Math.min(currentPage * itemsPerPage, enrichedRecords.length)} 표시
          </div>
          <select
            value={itemsPerPage}
            onChange={(e) => {
              setItemsPerPage(Number(e.target.value));
              setCurrentPage(1);
            }}
            className="text-sm border border-slate-300 rounded px-2 py-1 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            <option value={10}>10개씩</option>
            <option value={20}>20개씩</option>
            <option value={30}>30개씩</option>
          </select>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => goToPage(1)}
            disabled={currentPage === 1}
            className="p-1.5 rounded hover:bg-slate-200 disabled:opacity-50 disabled:hover:bg-transparent disabled:cursor-not-allowed"
            title="처음"
          >
            <ChevronsLeft className="w-4 h-4 text-slate-600" />
          </button>
          <button
            onClick={() => goToPage(currentPage - 1)}
            disabled={currentPage === 1}
            className="p-1.5 rounded hover:bg-slate-200 disabled:opacity-50 disabled:hover:bg-transparent disabled:cursor-not-allowed"
            title="이전"
          >
            <ChevronLeft className="w-4 h-4 text-slate-600" />
          </button>

          {/* Page Numbers */}
          <div className="flex items-center gap-1">
            {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
              let pageNum: number;
              if (totalPages <= 5) {
                pageNum = i + 1;
              } else if (currentPage <= 3) {
                pageNum = i + 1;
              } else if (currentPage >= totalPages - 2) {
                pageNum = totalPages - 4 + i;
              } else {
                pageNum = currentPage - 2 + i;
              }
              return (
                <button
                  key={pageNum}
                  onClick={() => goToPage(pageNum)}
                  className={`px-3 py-1 text-sm rounded ${currentPage === pageNum
                    ? 'bg-indigo-600 text-white font-medium'
                    : 'hover:bg-slate-200 text-slate-700'
                    }`}
                >
                  {pageNum}
                </button>
              );
            })}
          </div>

          <button
            onClick={() => goToPage(currentPage + 1)}
            disabled={currentPage === totalPages}
            className="p-1.5 rounded hover:bg-slate-200 disabled:opacity-50 disabled:hover:bg-transparent disabled:cursor-not-allowed"
            title="다음"
          >
            <ChevronRight className="w-4 h-4 text-slate-600" />
          </button>
          <button
            onClick={() => goToPage(totalPages)}
            disabled={currentPage === totalPages}
            className="p-1.5 rounded hover:bg-slate-200 disabled:opacity-50 disabled:hover:bg-transparent disabled:cursor-not-allowed"
            title="끝"
          >
            <ChevronsRight className="w-4 h-4 text-slate-600" />
          </button>
        </div>

      </div>
    </div >
  );
};

