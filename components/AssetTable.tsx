import React, { useState, useMemo, useEffect } from 'react';
import { AssetRecord } from '../types';
import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from 'lucide-react';

interface AssetTableProps {
  records: AssetRecord[];
  onRowClick: (record: AssetRecord) => void;
  isFiltered?: boolean;
}

export const AssetTable: React.FC<AssetTableProps> = ({ records, onRowClick, isFiltered = false }) => {
  const [currentPage, setCurrentPage] = useState(1);
  const [showSummary, setShowSummary] = useState(false);
  const [itemsPerPage, setItemsPerPage] = useState(10);

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

  const formatCurrency = (amount: number, country: 'USA' | 'KOR') => {
    if (country === 'USA') {
      return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD',
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      }).format(amount);
    } else {
      return new Intl.NumberFormat('ko-KR', {
        style: 'currency',
        currency: 'KRW',
        minimumFractionDigits: 0,
        maximumFractionDigits: 0,
      }).format(amount);
    }
  };

  // Calculate summary statistics
  const summary = useMemo(() => {
    if (records.length === 0) return null;

    const totalQuantity = records.reduce((sum, r) => sum + r.quantity, 0);
    const totalAmount = records.reduce((sum, r) => sum + r.amount, 0);
    const averagePrice = totalQuantity > 0 ? totalAmount / totalQuantity : 0;

    // Determine currency based on first record's country (assume same currency in filtered results)
    const country = records[0]?.country || 'KOR';

    return {
      averagePrice,
      totalQuantity,
      totalAmount,
      country
    };
  }, [records]);

  // Helper for badges
  const getCountryBadge = (country: string) => {
    const isUSA = country === 'USA';
    return (
      <span className={`px-2 py-0.5 rounded text-xs font-semibold ${isUSA ? 'bg-blue-100 text-blue-700' : 'bg-red-100 text-red-700'
        }`}>
        {isUSA ? '🇺🇸 USA' : '🇰🇷 KOR'}
      </span>
    );
  };

  const getAccountBadge = (type: string) => {
    let colorClass = 'bg-slate-100 text-slate-700';
    if (type.includes('ISA')) colorClass = 'bg-amber-100 text-amber-700';
    if (type.includes('연금')) colorClass = 'bg-emerald-100 text-emerald-700';
    if (type.includes('비과세')) colorClass = 'bg-indigo-100 text-indigo-700';

    return (
      <span className={`px-2 py-0.5 rounded text-xs font-medium ${colorClass}`}>
        {type}
      </span>
    );
  };

  // Pagination logic
  const totalPages = Math.ceil(records.length / itemsPerPage);
  const paginatedRecords = useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    return records.slice(startIndex, startIndex + itemsPerPage);
  }, [records, currentPage, itemsPerPage]);

  const goToPage = (page: number) => {
    setCurrentPage(Math.max(1, Math.min(page, totalPages)));
  };

  if (records.length === 0) {
    return (
      <div className="text-center py-20 bg-white rounded-lg shadow-sm border border-slate-200">
        <p className="text-slate-500 mb-2">등록된 자산 내역이 없습니다.</p>
        <p className="text-sm text-slate-400">새로운 자산을 등록하거나 샘플 양식을 다운로드하여 시작해보세요.</p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow-sm border border-slate-200 overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm text-left">
          <thead className="bg-slate-50 text-slate-600 border-b border-slate-200">
            <tr>
              <th className="px-4 py-3 font-semibold text-xs uppercase tracking-wider">주식구분</th>
              <th className="px-4 py-3 font-semibold text-xs uppercase tracking-wider">국가</th>
              <th className="px-4 py-3 font-semibold text-xs uppercase tracking-wider">거래일</th>
              <th className="px-4 py-3 font-semibold text-xs uppercase tracking-wider">증권사</th>
              <th className="px-4 py-3 font-semibold text-xs uppercase tracking-wider">종목명</th>
              <th className="px-4 py-3 font-semibold text-xs uppercase tracking-wider">계좌유형</th>
              <th className="px-4 py-3 font-semibold text-xs uppercase tracking-wider">거래</th>
              <th className="px-4 py-3 font-semibold text-xs uppercase tracking-wider">주기</th>
              <th className="px-4 py-3 font-semibold text-xs uppercase tracking-wider text-right">매입단가</th>
              <th className="px-4 py-3 font-semibold text-xs uppercase tracking-wider text-right">수량</th>
              <th className="px-4 py-3 font-semibold text-xs uppercase tracking-wider text-right">매수금액</th>
              <th className="px-4 py-3 font-semibold text-xs uppercase tracking-wider text-right">매도금액</th>
              <th className="px-4 py-3 font-semibold text-xs uppercase tracking-wider text-right">적용환율</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {paginatedRecords.map((record) => (
              <tr
                key={record.id}
                className="hover:bg-slate-50 transition-colors cursor-pointer"
                onClick={() => onRowClick(record)}
              >
                <td className="px-4 py-3 text-slate-500">{record.stockType}</td>
                <td className="px-4 py-3">{getCountryBadge(record.country)}</td>
                <td className="px-4 py-3 text-slate-600 font-mono">{record.date}</td>
                <td className="px-4 py-3 text-slate-600">{record.broker}</td>
                <td className="px-4 py-3 font-medium text-slate-800">{record.name}</td>
                <td className="px-4 py-3">{getAccountBadge(record.accountType)}</td>
                <td className={`px-4 py-3 font-medium ${record.tradeType === '매수' ? 'text-red-600' : 'text-blue-600'}`}>
                  {record.tradeType}
                </td>
                <td className="px-4 py-3 text-slate-500">{record.dividendCycle}</td>
                <td className="px-4 py-3 text-right font-mono">
                  {formatCurrency(record.price, record.country)}
                </td>
                <td className="px-4 py-3 text-right font-mono">{record.quantity.toLocaleString()}</td>
                <td className="px-4 py-3 text-right font-medium font-mono text-slate-800">
                  {formatCurrency(record.amount, record.country)}
                </td>
                <td className="px-4 py-3 text-right font-medium font-mono text-slate-800">
                  {record.sellAmount ? formatCurrency(record.sellAmount, record.country) : '-'}
                </td>
                <td className="px-4 py-3 text-right text-slate-500 font-mono">
                  {record.exchangeRate && record.exchangeRate > 0 ? record.exchangeRate.toFixed(2) : '-'}
                </td>
              </tr>
            ))}

            {/* Summary Row */}
            {showSummary && summary && (
              <tr className="bg-red-50 border-t-2 border-red-200">
                <td colSpan={8} className="px-4 py-3"></td>
                <td className="px-4 py-3 text-right font-bold text-red-700">
                  <div className="text-xs text-slate-500 mb-1">평단가</div>
                  {formatCurrency(summary.averagePrice, summary.country)}
                </td>
                <td className="px-4 py-3 text-right font-bold text-red-700">
                  <div className="text-xs text-slate-500 mb-1">수량합계</div>
                  {summary.totalQuantity.toLocaleString()} 주
                </td>
                <td className="px-4 py-3 text-right font-bold text-red-700">
                  <div className="text-xs text-slate-500 mb-1">매수총금액</div>
                  {formatCurrency(summary.totalAmount, summary.country)}
                </td>
                <td colSpan={2}></td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination Controls */}
      <div className="flex items-center justify-between px-4 py-3 bg-slate-50 border-t border-slate-200">
        <div className="flex items-center gap-4">
          <div className="text-sm text-slate-600">
            {records.length}건 중 {((currentPage - 1) * itemsPerPage) + 1}-{Math.min(currentPage * itemsPerPage, records.length)} 표시
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

        {totalPages > 1 && (
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
        )}
      </div>
    </div>
  );
};
