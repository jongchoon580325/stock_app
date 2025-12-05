import React, { useState, useMemo, useEffect } from 'react';
import { AssetRecord } from '../types';
import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from 'lucide-react';

interface AssetTableProps {
  records: AssetRecord[];
  onRowClick: (record: AssetRecord) => void;
}

const ITEMS_PER_PAGE = 20;

export const AssetTable: React.FC<AssetTableProps> = ({ records, onRowClick }) => {
  const [currentPage, setCurrentPage] = useState(1);
  const [showSummary, setShowSummary] = useState(false);

  // Show summary 2 seconds after records change (from search)
  useEffect(() => {
    setShowSummary(false);
    const timer = setTimeout(() => {
      if (records.length > 0) {
        setShowSummary(true);
      }
    }, 2000);

    return () => clearTimeout(timer);
  }, [records]);

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
  const totalPages = Math.ceil(records.length / ITEMS_PER_PAGE);
  const paginatedRecords = useMemo(() => {
    const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
    return records.slice(startIndex, startIndex + ITEMS_PER_PAGE);
  }, [records, currentPage]);

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
      {totalPages > 1 && (
        <div className="flex items-center justify-between px-4 py-3 bg-slate-50 border-t border-slate-200">
          <div className="text-sm text-slate-600">
            {records.length}건 중 {((currentPage - 1) * ITEMS_PER_PAGE) + 1}-{Math.min(currentPage * ITEMS_PER_PAGE, records.length)} 표시
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => goToPage(1)}
              disabled={currentPage === 1}
              className="p-2 rounded-md text-slate-600 hover:bg-slate-200 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
              title="처음"
            >
              <ChevronsLeft className="w-4 h-4" />
            </button>

            <button
              onClick={() => goToPage(currentPage - 1)}
              disabled={currentPage === 1}
              className="p-2 rounded-md text-slate-600 hover:bg-slate-200 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
              title="이전"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>

            <div className="flex items-center gap-1">
              {Array.from({ length: totalPages }, (_, i) => i + 1).map(page => {
                // Show first page, last page, current page, and pages around current
                const showPage = page === 1 || page === totalPages || Math.abs(page - currentPage) <= 1;
                const showEllipsis = (page === currentPage - 2 && currentPage > 3) || (page === currentPage + 2 && currentPage < totalPages - 2);

                if (showEllipsis) {
                  return <span key={page} className="px-2 text-slate-400">…</span>;
                }

                if (!showPage && page !== currentPage - 2 && page !== currentPage + 2) {
                  return null;
                }

                return (
                  <button
                    key={page}
                    onClick={() => goToPage(page)}
                    className={`min-w-[32px] px-3 py-1 rounded-md text-sm font-medium transition-colors ${page === currentPage
                      ? 'bg-indigo-600 text-white'
                      : 'text-slate-600 hover:bg-slate-200'
                      }`}
                  >
                    {page}
                  </button>
                );
              })}
            </div>

            <button
              onClick={() => goToPage(currentPage + 1)}
              disabled={currentPage === totalPages}
              className="p-2 rounded-md text-slate-600 hover:bg-slate-200 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
              title="다음"
            >
              <ChevronRight className="w-4 h-4" />
            </button>

            <button
              onClick={() => goToPage(totalPages)}
              disabled={currentPage === totalPages}
              className="p-2 rounded-md text-slate-600 hover:bg-slate-200 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
              title="끝"
            >
              <ChevronsRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
