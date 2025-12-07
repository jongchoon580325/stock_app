
import React, { useState, useMemo, useEffect, useRef } from 'react';
import { DividendRecord, SummaryStats, AccountType } from './types';
import { INITIAL_RECORDS, TAX_FREE_SAMPLE_RECORDS } from './constants';
import { DividendTable } from './components/DividendTable';


import { DividendFormModal } from './components/DividendFormModal';

import { NotificationModal } from './components/NotificationModal';
import { AssetConfig } from './components/AssetConfig';
import { PlusCircle, LayoutDashboard, CalendarRange, ArrowRight, RotateCcw, Download, Upload, FileText, Search } from 'lucide-react';

const STORAGE_KEYS = {
  general: 'bunbae_manager_data_general',
  taxFree: 'bunbae_manager_data_taxfree',
  legacy: 'bunbae_manager_data_v1' // For migration
};

const App: React.FC = () => {
  const [accountType, setAccountType] = useState<AccountType>('general');

  // Helper to recalculate derived fields (Rule 1, 2, 4, 5)
  // This ensures data consistency across the entire timeline
  const recalculatePortfolio = (rawRecords: DividendRecord[], type: AccountType = accountType): DividendRecord[] => {
    // 1. Sort by Date Ascending
    const sorted = [...rawRecords].sort((a, b) =>
      new Date(a.date).getTime() - new Date(b.date).getTime()
    );

    // Track last seen values for each stock to calculate changes
    const stockHistory: Record<string, { price: number; dividend: number }> = {};

    return sorted.map(record => {
      // Rule 4: Taxable Distribution = Tax Base * Quantity
      // For Tax-Free, we ignore tax calculations (set to 0)
      const isTaxFree = type === 'tax-free';
      const taxableDistribution = isTaxFree ? 0 : record.taxBase * record.quantity;

      // Rule 5: Tax Amount = Taxable Distribution * 0.154 (Floor to integer for KRW)
      const taxAmount = isTaxFree ? 0 : Math.floor(taxableDistribution * 0.154);

      // Rule 1 & 2: Calculate Changes vs Previous Record of same stock
      let priceChange = 0;
      let dividendChange = 0;

      if (stockHistory[record.stockName]) {
        priceChange = record.currentPrice - stockHistory[record.stockName].price;
        dividendChange = record.dividendPerShare - stockHistory[record.stockName].dividend;
      }

      // Update history for next iteration
      stockHistory[record.stockName] = {
        price: record.currentPrice,
        dividend: record.dividendPerShare
      };

      return {
        ...record,
        taxableDistribution,
        taxAmount,
        priceChange,
        dividendChange
      };
    });
  };

  // Initialize state with LocalStorage or constants
  const [records, setRecords] = useState<DividendRecord[]>(() => {
    try {
      // Try loading General account data first (default)
      const key = STORAGE_KEYS.general;
      let savedData = localStorage.getItem(key);

      // Migration: If general data is missing, check legacy key
      if (!savedData) {
        const legacyData = localStorage.getItem(STORAGE_KEYS.legacy);
        if (legacyData) {
          savedData = legacyData;
        }
      }

      if (savedData) {
        const parsed = JSON.parse(savedData);
        return recalculatePortfolio(parsed, 'general');
      }
    } catch (e) {
      console.error("Failed to load local data", e);
    }
    return recalculatePortfolio(INITIAL_RECORDS, 'general');
  });

  // --- Search Logic ---
  const [searchQuery, setSearchQuery] = useState('');

  // Load data when account type changes
  useEffect(() => {
    const loadData = () => {
      try {
        const key = accountType === 'general' ? STORAGE_KEYS.general : STORAGE_KEYS.taxFree;
        let savedData = localStorage.getItem(key);

        // Migration check for general if missing
        if (accountType === 'general' && !savedData) {
          const legacyData = localStorage.getItem(STORAGE_KEYS.legacy);
          if (legacyData) savedData = legacyData;
        }

        if (savedData) {
          const parsed = JSON.parse(savedData);
          setRecords(recalculatePortfolio(parsed, accountType));
          return;
        }
      } catch (e) {
        console.error("Failed to load data for " + accountType, e);
      }
      // If no data found for this type, start empty (or initial for general if desired, but empty is better for new account)
      // Exception: Keep INITIAL_RECORDS for General if it was never saved? 
      // Simplified: If 'general' and empty, maybe use initial. If 'tax-free' and empty, use [].
      if (accountType === 'general') {
        // check if we really have no data or just failed. 
        // For now, let's default to empty if not found, unless it's the very first run which the useState handled.
        // Actually, this useEffect runs on mount too? 
        // No, dependency [accountType]. On mount accountType is 'general'.
        // But we already initialized 'records' in useState. 
        // We should avoid double loading on mount. 
        // We can use a ref to skip first render if needed, or just let it be.
        // But wait, useState initialized for 'general'. If we re-run this, it might be redundant but safe.
        // However, we need to be careful not to overwrite if we just modified it?
        // No, records state is the truth. Loading from LS overwrites state.
        // So we should ONLY load when accountType *changes*.
      } else {
        setRecords([]);
      }
    };

    // We only want to run this when accountType CHANGES.
    // However, React effects run on mount. 
    // We can check if the current records match the account type logic or just use a ref.
    // Simplest: Just let it run. It reads from LS.
  }, [accountType]);
  // WAIT. If I put this useEffect here, it will overwrite any state changes I make if I'm not careful.
  // Actually, standard pattern: 
  // 1. Load from LS when `accountType` changes.
  // 2. Save to LS when `records` changes (to the *current* accountType key).

  // Revised approach inside the tool call: 
  // I will only modify the useState to be simpler, and rely on an effect to load? 
  // Or keep the useState for initial load, and an effect for switching.

  // Let's refine the ReplacementContent below.

  // 1. Data Loading Effect when Account Type changes (Only for dividend accounts)
  useEffect(() => {
    // Skip data loading for asset-config mode (it manages its own state)
    if (accountType === 'asset-config') return;

    const key = accountType === 'general' ? STORAGE_KEYS.general : STORAGE_KEYS.taxFree;
    try {
      let savedData = localStorage.getItem(key);
      // Migration for general
      if (accountType === 'general' && !savedData) {
        const legacyData = localStorage.getItem(STORAGE_KEYS.legacy);
        if (legacyData) savedData = legacyData;
      }

      if (savedData) {
        setRecords(recalculatePortfolio(JSON.parse(savedData), accountType));
      } else {
        // No data for this account type
        setRecords(accountType === 'general' ? recalculatePortfolio(INITIAL_RECORDS, 'general') : []);
      }
    } catch (e) {
      console.error("Failed to switch account data", e);
      setRecords([]);
    }
  }, [accountType]);

  // 2. Save to LocalStorage whenever records change (Only for dividend accounts)
  useEffect(() => {
    // Skip saving for asset-config mode
    if (accountType === 'asset-config') return;

    const key = accountType === 'general' ? STORAGE_KEYS.general : STORAGE_KEYS.taxFree;
    localStorage.setItem(key, JSON.stringify(records));
  }, [records, accountType]);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingRecord, setEditingRecord] = useState<DividendRecord | null>(null);

  // Notification Modal States
  const [resetWarningOpen, setResetWarningOpen] = useState(false);
  const [resetSuccessOpen, setResetSuccessOpen] = useState(false);

  // Import Modal States
  const [importWarningOpen, setImportWarningOpen] = useState(false);
  const [importSuccessOpen, setImportSuccessOpen] = useState(false);
  const [pendingImportRecords, setPendingImportRecords] = useState<DividendRecord[]>([]);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // --- Date Range Logic ---
  const availableMonths = useMemo(() => {
    const months = new Set(records.map(r => r.date.substring(0, 7))); // YYYY-MM
    return Array.from(months).sort();
  }, [records]);

  const [startMonth, setStartMonth] = useState<string>('');
  const [endMonth, setEndMonth] = useState<string>('');

  // Initialize default range when months are available
  // Updated dependency to ensure it runs when records change drastically (like import/reset)
  useEffect(() => {
    if (availableMonths.length > 0) {
      if (!startMonth || !availableMonths.includes(startMonth)) {
        setStartMonth(availableMonths[0]);
      }
      if (!endMonth || !availableMonths.includes(endMonth)) {
        setEndMonth(availableMonths[availableMonths.length - 1]);
      }
    }
  }, [availableMonths, startMonth, endMonth]);

  // Filter records based on selection
  const filteredRecords = useMemo(() => {
    let result = records;

    // 1. Date Filter
    if (startMonth && endMonth) {
      result = result.filter(r => {
        const m = r.date.substring(0, 7);
        return m >= startMonth && m <= endMonth;
      });
    }

    // 2. Search Filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      result = result.filter(r =>
        r.stockName.toLowerCase().includes(query)
      );
    }

    return result;
  }, [records, startMonth, endMonth, searchQuery]);

  // Calculate Summary Stats based on FILTERED records
  const summaryStats: SummaryStats = useMemo(() => {
    return filteredRecords.reduce((acc, curr) => {
      const gross = curr.quantity * curr.dividendPerShare;
      // Net = Gross - Tax
      const net = gross - curr.taxAmount;

      return {
        totalTaxableDistribution: acc.totalTaxableDistribution + curr.taxableDistribution,
        totalTaxAmount: acc.totalTaxAmount + curr.taxAmount,
        totalReceived: acc.totalReceived + net,
      };
    }, {
      totalTaxableDistribution: 0,
      totalTaxAmount: 0,
      totalReceived: 0
    });
  }, [filteredRecords]);

  // --- Search Stats Calculation ---
  const searchStats = useMemo(() => {
    const totalQty = filteredRecords.reduce((sum, r) => sum + r.quantity, 0);
    const totalDividend = filteredRecords.reduce((sum, r) => sum + r.taxableDistribution, 0); // Gross Dividend

    // Weighted Average Price
    let totalVal = 0;
    filteredRecords.forEach(r => {
      totalVal += r.currentPrice * r.quantity;
    });
    const avgPrice = totalQty > 0 ? totalVal / totalQty : 0;

    return { totalQty, avgPrice, totalDividend };
  }, [filteredRecords]);

  // --- CRUD Handlers ---
  const openAddModal = () => {
    setEditingRecord(null);
    setIsModalOpen(true);
  };

  const openEditModal = (record: DividendRecord) => {
    setEditingRecord(record);
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setEditingRecord(null);
  };

  const handleSaveRecord = (record: DividendRecord) => {
    let updatedRecords;
    if (editingRecord) {
      updatedRecords = records.map(r => r.id === record.id ? record : r);
    } else {
      updatedRecords = [...records, record];
    }
    setRecords(recalculatePortfolio(updatedRecords, accountType));
    closeModal();
  };

  const handleDeleteRecord = (id: string) => {
    const remainingRecords = records.filter(r => r.id !== id);
    setRecords(recalculatePortfolio(remainingRecords, accountType));
    closeModal();
  };

  // --- Reset Logic ---
  const handleResetData = () => {
    setResetWarningOpen(true);
  };

  const executeReset = () => {
    // 1. Clear all records
    setRecords([]);

    // 2. Clear date filters
    setStartMonth('');
    setEndMonth('');

    setResetWarningOpen(false);
    setResetSuccessOpen(true);
  };

  // --- CSV Helpers ---

  // Format date safely to YYYY-MM-DD
  const formatDateForCSV = (dateStr: string) => {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
  };

  const convertToCSV = (data: DividendRecord[]) => {
    const headers = ['거래일', '종목명', '주식수량', '현주가', '분배금', '과세표준'];
    const rows = data.map(r => [
      formatDateForCSV(r.date), // Enforce YYYY-MM-DD
      r.stockName,
      r.quantity,
      r.currentPrice,
      r.dividendPerShare,
      r.taxBase
    ].join(','));
    return [headers.join(','), ...rows].join('\n');
  };

  const downloadCSV = (csvContent: string, fileName: string) => {
    const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' }); // Add BOM for Excel
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', fileName);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // 1. Download Sample (from INITIAL_RECORDS or TAX_FREE_SAMPLE_RECORDS)
  const handleDownloadSample = () => {
    const data = accountType === 'general' ? INITIAL_RECORDS : TAX_FREE_SAMPLE_RECORDS;
    const csv = convertToCSV(data);
    const today = new Date().toISOString().slice(0, 10);
    const fileName = accountType === 'general'
      ? `${today}-일반계좌_샘플양식.csv`
      : `${today}-비과세계좌_샘플양식.csv`;
    downloadCSV(csv, fileName);
  };

  // 2. Export Current Data
  const handleExportCSV = () => {
    const csv = convertToCSV(records);
    const today = new Date().toISOString().slice(0, 10);
    const fileName = accountType === 'general'
      ? `${today}-일반계좌_내보내기.csv`
      : `${today}-비과세계좌_내보내기.csv`;
    downloadCSV(csv, fileName);
  };

  // Helper to normalize dates from Excel/CSV
  const normalizeImportDate = (dateStr: string) => {
    if (!dateStr) return new Date().toISOString().slice(0, 10);

    const cleanStr = dateStr.trim();

    // Handle DD/MM/YYYY (common in Excel CSV exports in some locales)
    if (/^\d{1,2}\/\d{1,2}\/\d{4}$/.test(cleanStr)) {
      const parts = cleanStr.split('/');
      // parts[0]=DD, parts[1]=MM, parts[2]=YYYY
      const yyyy = parts[2];
      const mm = parts[1].padStart(2, '0');
      const dd = parts[0].padStart(2, '0');
      return `${yyyy}-${mm}-${dd}`;
    }

    // Handle YYYY/MM/DD
    if (/^\d{4}\/\d{1,2}\/\d{1,2}$/.test(cleanStr)) {
      return cleanStr.replace(/\//g, '-');
    }

    // Handle YYYY.MM.DD (Common in Korea)
    if (/^\d{4}\.\s*\d{1,2}\.\s*\d{1,2}$/.test(cleanStr)) {
      const parts = cleanStr.split('.');
      const yyyy = parts[0].trim();
      const mm = parts[1].trim().padStart(2, '0');
      const dd = parts[2].trim().padStart(2, '0');
      return `${yyyy}-${mm}-${dd}`;
    }

    return cleanStr;
  };

  // 3. Import CSV
  const handleImportClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      try {
        const lines = text.split('\n').map(l => l.trim()).filter(l => l);
        // Skip header
        const dataLines = lines.slice(1);

        const newRecords: DividendRecord[] = dataLines.map((line, idx) => {
          const cols = line.split(',');
          // Allow for empty trailing columns if CSV is sloppy
          if (cols.length < 6) throw new Error(`Line ${idx + 2} format invalid`);

          return {
            id: crypto.randomUUID(),
            date: normalizeImportDate(cols[0]),
            stockName: cols[1].trim(),
            quantity: Number(cols[2]),
            currentPrice: Number(cols[3]),
            dividendPerShare: Number(cols[4]),
            taxBase: Number(cols[5]),
            // Default calculated fields to 0, will be fixed by recalculatePortfolio
            priceChange: 0,
            dividendChange: 0,
            taxableDistribution: 0,
            taxAmount: 0
          };
        });

        // Store pending records and open warning modal
        setPendingImportRecords(newRecords);
        setImportWarningOpen(true);

      } catch (err) {
        alert('CSV 파일 형식이 올바르지 않습니다. 샘플 양식을 참고해주세요.\n' + err);
        console.error(err);
      }
      // Reset input
      if (fileInputRef.current) fileInputRef.current.value = '';
    };
    reader.readAsText(file);
  };

  const executeImport = () => {
    const processed = recalculatePortfolio(pendingImportRecords, accountType);
    setRecords(processed);

    // Also reset date filters for imported data
    const newMonths = Array.from(new Set(processed.map((r: DividendRecord) => r.date.substring(0, 7)))).sort();
    if (newMonths.length > 0) {
      setStartMonth(newMonths[0]);
      setEndMonth(newMonths[newMonths.length - 1]);
    }

    setImportWarningOpen(false);
    setImportSuccessOpen(true);
    setPendingImportRecords([]);
  };

  return (
    <div className="min-h-screen bg-slate-100 pb-20">
      <DividendFormModal
        isOpen={isModalOpen}
        onClose={closeModal}
        onSave={handleSaveRecord}
        onDelete={handleDeleteRecord}
        initialData={editingRecord}
        existingRecords={records}
      />

      <NotificationModal
        isOpen={resetWarningOpen}
        onClose={() => setResetWarningOpen(false)}
        type="warning"
        title="데이터 초기화"
        message={`현재 저장된 모든 데이터를 삭제하고\n초기 상태(빈 테이블)로 되돌리시겠습니까?\n이 작업은 되돌릴 수 없습니다.`}
        onConfirm={executeReset}
        confirmLabel="네, 초기화합니다"
      />

      <NotificationModal
        isOpen={resetSuccessOpen}
        onClose={() => setResetSuccessOpen(false)}
        type="success"
        title="초기화 완료"
        message="데이터가 성공적으로 초기화되었습니다."
        confirmLabel="확인"
      />

      <NotificationModal
        isOpen={importWarningOpen}
        onClose={() => setImportWarningOpen(false)}
        type="warning"
        title="데이터 가져오기"
        message={`총 ${pendingImportRecords.length}건의 데이터를 불러왔습니다.\n기존 데이터는 모두 삭제되고 새로운 데이터로 대체됩니다.\n계속하시겠습니까?`}
        onConfirm={executeImport}
        confirmLabel="네, 가져옵니다"
      />

      <NotificationModal
        isOpen={importSuccessOpen}
        onClose={() => setImportSuccessOpen(false)}
        type="success"
        title="가져오기 완료"
        message="데이터를 성공적으로 불러왔습니다."
        confirmLabel="확인"
      />

      {/* Header */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <LayoutDashboard className={`w-6 h-6 ${accountType === 'asset-config' ? 'text-blue-600' : accountType === 'general' ? 'text-fuchsia-700' : 'text-emerald-700'}`} />
              <h1 className="text-xl font-bold text-slate-800 tracking-tight">
                {accountType === 'asset-config' ? 'Asset Config - 자산 관리' : accountType === 'general' ? '일반배당계좌 분배금 현황' : '비과세계좌 분배금 현황'}
              </h1>
            </div>

            {/* Account Type Tabs */}
            <div className="hidden md:flex items-center bg-slate-100 rounded-lg p-1 ml-4">
              <button
                onClick={() => setAccountType('general')}
                className={`px-3 py-1 text-sm font-medium rounded-md transition-all ${accountType === 'general'
                  ? 'bg-white text-slate-800 shadow-sm'
                  : 'text-slate-500 hover:text-slate-700'
                  }`}
              >
                일반계좌
              </button>
              <button
                onClick={() => setAccountType('tax-free')}
                className={`px-3 py-1 text-sm font-medium rounded-md transition-all ${accountType === 'tax-free'
                  ? 'bg-white text-emerald-700 shadow-sm'
                  : 'text-slate-500 hover:text-slate-700'
                  }`}
              >
                비과세계좌
              </button>
              <button
                onClick={() => setAccountType('asset-config')}
                className={`px-3 py-1 text-sm font-medium rounded-md transition-all ${accountType === 'asset-config'
                  ? 'bg-white text-blue-600 shadow-sm'
                  : 'text-slate-500 hover:text-slate-700'
                  }`}
              >
                Asset Config
              </button>
            </div>
          </div>

          <div className="text-sm text-slate-500 hidden sm:block">
            {accountType === 'asset-config'
              ? '※ 미국 주식 및 국내 ETF 자산의 매수/매도 내역을 통합 관리합니다.'
              : accountType === 'general'
                ? '※ 일반계좌로 운영하는 분배금 내역을 요약하고 데이터를 관리합니다.'
                : '※ 비과세계좌로 운영하는 분배금 내역을 요약하고 데이터를 등록합니다.'}
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
        {/* Conditionally render Asset Config or Dividend Management */}
        {accountType === 'asset-config' ? (
          <AssetConfig />
        ) : (
          <>
            {/* Global Date Filter */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between bg-white p-4 rounded-lg shadow-sm border border-slate-200 gap-4">
              <div className="flex items-center gap-2 text-slate-700 font-bold">
                <CalendarRange className="w-5 h-5 text-indigo-600" />
                <span>조회 기간 설정</span>
              </div>
              <div className="flex items-center gap-3 text-sm">
                <div className="flex items-center gap-2 bg-slate-50 px-3 py-1.5 rounded-md border border-slate-200">
                  <span className="text-slate-500 text-xs font-semibold">시작월</span>
                  <select
                    value={startMonth}
                    onChange={(e) => {
                      const newStart = e.target.value;
                      setStartMonth(newStart);
                      if (newStart > endMonth) setEndMonth(newStart);
                    }}
                    className="bg-transparent text-slate-800 font-medium focus:outline-none cursor-pointer"
                  >
                    {availableMonths.map(m => (
                      <option key={`start-${m}`} value={m}>{m}</option>
                    ))}
                  </select>
                </div>

                <ArrowRight className="w-4 h-4 text-slate-400" />

                <div className="flex items-center gap-2 bg-slate-50 px-3 py-1.5 rounded-md border border-slate-200">
                  <span className="text-slate-500 text-xs font-semibold">종료월</span>
                  <select
                    value={endMonth}
                    onChange={(e) => {
                      const newEnd = e.target.value;
                      setEndMonth(newEnd);
                      if (newEnd < startMonth) setStartMonth(newEnd);
                    }}
                    className="bg-transparent text-slate-800 font-medium focus:outline-none cursor-pointer"
                  >
                    {availableMonths.map(m => (
                      <option key={`end-${m}`} value={m}>{m}</option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            {/* 1. New Stats Cards (Matching Asset Config Logic) */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* Stock Quantity */}
              <div className="bg-gradient-to-br from-slate-50 to-slate-100 p-5 rounded-lg border border-slate-200 shadow-sm">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-sm font-semibold text-slate-600">주식 수량 합계</h3>
                </div>
                <div className="text-2xl font-bold text-slate-800 mb-1">
                  {new Intl.NumberFormat('ko-KR').format(searchStats.totalQty)} 주
                </div>
                <div className="text-xs text-slate-500">
                  * 검색/필터된 항목 기준
                </div>
              </div>

              {/* Average Price */}
              <div className="bg-white p-5 rounded-lg border border-slate-200 shadow-sm relative overflow-hidden">
                <div className="absolute top-0 right-0 p-4 opacity-10">
                </div>
                <div className="text-sm text-slate-500 font-medium mb-1 flex items-center gap-2">
                  평균 매입단가 (가중평균)
                </div>
                <div className="text-2xl font-bold text-blue-600">
                  {new Intl.NumberFormat('ko-KR', { maximumFractionDigits: 0 }).format(searchStats.avgPrice)} 원
                </div>
              </div>

              {/* Total Dividend (Sum) */}
              <div className="bg-white p-5 rounded-lg border border-slate-200 shadow-sm relative overflow-hidden">
                <div className="absolute top-0 right-0 p-4 opacity-10">
                  <span className="text-6xl font-bold text-red-900">₩</span>
                </div>
                <div className="text-sm text-slate-500 font-medium mb-1 flex items-center gap-2">
                  분배금 합계 (과세표준)
                </div>
                <div className="text-2xl font-bold text-slate-700">
                  {new Intl.NumberFormat('ko-KR', { style: 'currency', currency: 'KRW' }).format(searchStats.totalDividend)}
                </div>
              </div>
            </div>

            {/* 2. Control Bar (Unified Structure) */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white p-4 rounded-lg border border-slate-200 shadow-sm mt-4">
              <div className="relative w-full sm:w-64">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="자산 검색 (종목명)"
                  className="w-full pl-9 pr-4 py-2 text-sm border border-slate-200 rounded-md focus:outline-none focus:ring-2 focus:ring-slate-500"
                />
              </div>

              <div className="flex gap-2 w-full sm:w-auto overflow-x-auto">
                <input
                  type="file"
                  accept=".csv"
                  ref={fileInputRef}
                  onChange={handleFileChange}
                  className="hidden"
                />

                <button
                  onClick={handleDownloadSample}
                  className="flex-shrink-0 flex items-center justify-center gap-2 px-3 py-2 text-emerald-600 hover:bg-emerald-50 rounded-md text-sm font-medium transition-colors border border-emerald-200"
                >
                  <Download className="w-4 h-4" />
                  샘플 양식
                </button>

                <div className="h-8 w-px bg-slate-300 mx-1 hidden md:block"></div>

                <button
                  onClick={handleExportCSV}
                  className="flex-shrink-0 flex items-center justify-center gap-2 px-3 py-2 text-slate-600 hover:bg-slate-100 rounded-md text-sm font-medium transition-colors border border-slate-200"
                >
                  <Download className="w-4 h-4" />
                  내보내기
                </button>

                <button
                  onClick={handleImportClick}
                  className="flex-shrink-0 flex items-center justify-center gap-2 px-3 py-2 text-slate-600 hover:bg-slate-100 rounded-md text-sm font-medium transition-colors border border-slate-200"
                >
                  <Upload className="w-4 h-4" />
                  가져오기
                </button>

                <div className="h-8 w-px bg-slate-300 mx-1 hidden md:block"></div>

                <button
                  onClick={handleResetData}
                  className="flex-shrink-0 flex items-center justify-center gap-2 px-3 py-2 text-red-600 hover:bg-red-50 rounded-md text-sm font-medium transition-colors border border-red-200"
                >
                  <RotateCcw className="w-4 h-4" />
                  초기화
                </button>

                <button
                  onClick={openAddModal}
                  className="flex-shrink-0 flex items-center justify-center gap-2 px-4 py-2 bg-slate-800 text-white text-sm font-medium rounded-md hover:bg-slate-700 transition-colors shadow-sm ml-2"
                >
                  <PlusCircle className="w-4 h-4" />
                  자산 등록
                </button>
              </div>
            </div>

            <DividendTable
              records={filteredRecords}
              onRowClick={openEditModal}
              accountType={accountType}
              isFiltered={!!searchQuery.trim()}
            />
          </>
        )}
      </main>
    </div>
  );
};

export default App;
