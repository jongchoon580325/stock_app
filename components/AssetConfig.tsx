import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Download, PlusCircle, RotateCcw, Search, Upload } from 'lucide-react';
import { AssetRecord } from '../types';
import { AssetTable } from './AssetTable';
import { ASSET_SAMPLE_RECORDS } from '../constants';
import { NotificationModal } from './NotificationModal';
import { AssetFormModal } from './AssetFormModal';
import { TaxSimulator } from './TaxSimulator';
import { Calculator, LayoutList } from 'lucide-react';

export const AssetConfig: React.FC = () => {
    const [records, setRecords] = useState<AssetRecord[]>([]);
    const [resetWarningOpen, setResetWarningOpen] = useState(false);
    const [importWarningOpen, setImportWarningOpen] = useState(false);
    const [importSuccessOpen, setImportSuccessOpen] = useState(false);
    const [pendingImportRecords, setPendingImportRecords] = useState<AssetRecord[]>([]);
    // Data Integrity State
    const [missingExchangeRateCount, setMissingExchangeRateCount] = useState(0);
    const fileInputRef = useRef<HTMLInputElement>(null);

    // Modal state for asset form
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingRecord, setEditingRecord] = useState<AssetRecord | null>(null);

    // Tab state
    const [activeTab, setActiveTab] = useState<'assets' | 'simulator'>('assets');

    // Search state
    const [searchQuery, setSearchQuery] = useState('');

    // Exchange rate state
    const [exchangeRate, setExchangeRate] = useState(1470); // Default fallback
    const [isLoadingRate, setIsLoadingRate] = useState(true);

    // Load from LocalStorage
    useEffect(() => {
        const saved = localStorage.getItem('asset_config_data');
        if (saved) {
            try {
                const loaded = JSON.parse(saved);
                setRecords(loaded);

                // DATA HEALTH CHECK: Check for US Buy records with 0 exchange rate
                const badCount = loaded.filter((r: AssetRecord) =>
                    r.country === 'USA' &&
                    r.tradeType === '매수' &&
                    (!r.exchangeRate || r.exchangeRate <= 0)
                ).length;
                setMissingExchangeRateCount(badCount);

            } catch (e) {
                console.error('Failed to parse asset data', e);
            }
        }
    }, []);

    // Fetch real-time USD/KRW exchange rate
    useEffect(() => {
        const fetchExchangeRate = async () => {
            try {
                const response = await fetch('https://api.exchangerate-api.com/v4/latest/USD');
                const data = await response.json();
                if (data.rates && data.rates.KRW) {
                    setExchangeRate(data.rates.KRW);
                }
            } catch (error) {
                console.error('Failed to fetch exchange rate:', error);
                // Keep default fallback rate
            } finally {
                setIsLoadingRate(false);
            }
        };

        fetchExchangeRate();
        // Refresh every 10 minutes
        const interval = setInterval(fetchExchangeRate, 10 * 60 * 1000);
        return () => clearInterval(interval);
    }, []);

    // Save to LocalStorage (skip initial empty save)
    useEffect(() => {
        if (records.length > 0) {
            localStorage.setItem('asset_config_data', JSON.stringify(records));
        }
    }, [records]);

    // Filter records based on search query and sort by date (newest first)
    const filteredRecords = useMemo(() => {
        let results = records;

        if (searchQuery.trim()) {
            const query = searchQuery.toLowerCase();
            results = results.filter(record =>
                record.name.toLowerCase().includes(query) ||
                record.broker.toLowerCase().includes(query) ||
                record.stockType.toLowerCase().includes(query)
            );
        }

        // Sort by date descending (newest first)
        return results.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    }, [records, searchQuery]);

    // Stats Calculation (Calculate Portfolio Holdings based on transactions)
    const stats = useMemo(() => {
        // Group by ID (Symbol + Account) to calculate positions
        const positionMap = new Map<string, { qty: number, cost: number, country: string }>();

        // Sort by date ascending for accurate FIFO/AvgCost calculation
        const sorted = [...filteredRecords].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

        sorted.forEach(r => {
            const key = `${r.name}_${r.accountNumber || 'N/A'}`;
            if (!positionMap.has(key)) {
                positionMap.set(key, { qty: 0, cost: 0, country: r.country });
            }
            const pos = positionMap.get(key)!;

            if (r.tradeType === '매수') {
                pos.qty += r.quantity;
                pos.cost += r.amount; // Buy Amount
            } else if (r.tradeType === '매도') {
                if (pos.qty > 0) {
                    const avgCost = pos.cost / pos.qty;
                    // Reduce cost proportionally
                    pos.cost -= avgCost * r.quantity;
                    pos.qty -= r.quantity;
                }
                // If we sell more than we have, cost goes to 0 or negative? 
                // Validation in Form prevents this, but here we should clamp to 0 safety
                if (pos.qty < 0) { pos.qty = 0; pos.cost = 0; }
            }
            // Update country if needed (unlikely to change)
        });

        let krwTotal = 0;
        let usdTotal = 0;

        positionMap.forEach(pos => {
            if (pos.qty > 0) { // Only count current holdings
                if (pos.country === 'USA') {
                    usdTotal += pos.cost;
                } else {
                    krwTotal += pos.cost;
                }
            }
        });

        // Convert USD to KRW using real-time exchange rate
        const usdInKrw = usdTotal * exchangeRate;
        const grandTotal = krwTotal + usdInKrw;

        return { krwTotal, usdTotal, grandTotal };
    }, [filteredRecords, exchangeRate]);

    // Helper: parse number from various formats (with/without comma, currency symbols)
    const parseNumber = (value: string | undefined): number => {
        if (!value || value.trim() === '') return 0;
        // Remove currency symbols, commas, spaces
        const cleaned = value.toString().replace(/[$₩,\s]/g, '').trim();
        const num = parseFloat(cleaned);
        return isNaN(num) ? 0 : num;
    };

    // Unified CSV Headers (same for sample, export, import)
    const CSV_HEADERS = [
        '주식구분', '국가', '거래일', '증권사', '종목명',
        '계좌번호', '계좌유형', '거래유형', '분배주기', '매입주가', '수량',
        '매수금액', '매도금액', '적용환율'
    ];

    // Sample CSV Download Logic
    const handleDownloadSample = () => {
        const rows = ASSET_SAMPLE_RECORDS.map(r => [
            r.stockType,
            r.country,
            r.date,
            r.broker,
            r.name,
            r.accountNumber || '',
            r.accountType,
            r.tradeType,
            r.dividendCycle,
            r.price,
            r.quantity,
            r.amount,
            r.sellAmount || 0,
            r.exchangeRate || 0
        ].join(','));

        const csvContent = [CSV_HEADERS.join(','), ...rows].join('\n');
        const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        const today = new Date().toISOString().slice(0, 10);
        link.download = `${today}-asset_config_샘플양식.csv`;
        link.style.display = 'none';
        document.body.appendChild(link);
        link.click();

        setTimeout(() => {
            document.body.removeChild(link);
            URL.revokeObjectURL(url);
        }, 100);
    };

    // Export Current Data as CSV
    const handleExportCSV = () => {
        const rows = records.map(r => [
            r.stockType,
            r.country,
            r.date,
            r.broker,
            r.name,
            r.accountNumber || '',
            r.accountType,
            r.tradeType,
            r.dividendCycle,
            r.price,
            r.quantity,
            r.amount,
            r.sellAmount || 0,
            r.exchangeRate || 0
        ].join(','));

        const csvContent = [CSV_HEADERS.join(','), ...rows].join('\n');
        const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        const today = new Date().toISOString().slice(0, 10);
        link.download = `${today}-asset_config_내보내기.csv`;
        link.style.display = 'none';
        document.body.appendChild(link);
        link.click();

        setTimeout(() => {
            document.body.removeChild(link);
            URL.revokeObjectURL(url);
        }, 100);
    };

    // Import CSV
    const handleImportClick = () => {
        fileInputRef.current?.click();
    };

    // CSV parser that handles quoted fields (e.g., "100,791")
    const parseCSVLine = (line: string): string[] => {
        const result: string[] = [];
        let current = '';
        let inQuotes = false;

        for (let i = 0; i < line.length; i++) {
            const char = line[i];

            if (char === '"') {
                inQuotes = !inQuotes;
            } else if (char === ',' && !inQuotes) {
                result.push(current.trim());
                current = '';
            } else if (char === '\t' && !inQuotes) {
                // Handle tab delimiter
                result.push(current.trim());
                current = '';
            } else {
                current += char;
            }
        }
        result.push(current.trim()); // Add last field

        return result;
    };

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (event) => {
            const buffer = event.target?.result as ArrayBuffer;
            let text = '';

            // Try decoding as UTF-8 first
            try {
                const decoder = new TextDecoder('utf-8', { fatal: true });
                text = decoder.decode(buffer);
            } catch (e) {
                // If failed, try EUC-KR (common for Korean CSVs)
                try {
                    const decoder = new TextDecoder('euc-kr');
                    text = decoder.decode(buffer);
                } catch (e2) {
                    alert('파일 인코딩을 확인할 수 없습니다. (UTF-8 또는 EUC-KR만 지원)');
                    return;
                }
            }

            try {
                const lines = text.split(/\r?\n/).map(l => l.trim()).filter(l => l);
                const dataLines = lines.slice(1); // Skip header

                const newRecords: AssetRecord[] = dataLines.map((line, idx) => {
                    const cols = parseCSVLine(line);

                    if (cols.length < 10) throw new Error(`Line ${idx + 2} has insufficient columns (${cols.length})`);

                    return {
                        id: crypto.randomUUID(),
                        stockType: (cols[0] as '개별주식' | 'ETF주식') || '개별주식',
                        country: (cols[1] as 'USA' | 'KOR') || 'USA',
                        date: cols[2] || new Date().toISOString().split('T')[0],
                        broker: cols[3] || '',
                        name: cols[4] || '',
                        accountNumber: cols[5] || '',
                        accountType: (cols[6] as any) || '일반계좌',
                        tradeType: (cols[7] as '매수' | '매도') || '매수',
                        dividendCycle: cols[8] || '없음',
                        price: parseNumber(cols[9]),
                        quantity: parseNumber(cols[10]),
                        amount: parseNumber(cols[11]),
                        sellAmount: parseNumber(cols[12]),
                        exchangeRate: parseNumber(cols[13]),
                        note: cols[14] || ''
                    };
                });

                setPendingImportRecords(newRecords);
                setImportWarningOpen(true);

            } catch (err) {
                alert('CSV 파일 형식이 올바르지 않습니다.\n' + err);
                console.error(err);
            }
            // Warn if imported data has missing exchange rates
            if (fileInputRef.current) fileInputRef.current.value = '';
        };
        reader.readAsArrayBuffer(file);
    };

    const executeImport = () => {
        setRecords(pendingImportRecords);

        // Re-check health after import
        const badCount = pendingImportRecords.filter(r =>
            r.country === 'USA' &&
            r.tradeType === '매수' &&
            (!r.exchangeRate || r.exchangeRate <= 0)
        ).length;
        setMissingExchangeRateCount(badCount);

        setImportWarningOpen(false);
        setImportSuccessOpen(true);
        setPendingImportRecords([]);
    };

    const handleReset = () => {
        setRecords([]);
        setMissingExchangeRateCount(0); // Reset warning
        setResetWarningOpen(false);
    };

    // Modal handlers
    const openAddModal = () => {
        setEditingRecord(null);
        setIsModalOpen(true);
    };

    const openEditModal = (record: AssetRecord) => {
        setEditingRecord(record);
        setIsModalOpen(true);
    };

    const closeModal = () => {
        setIsModalOpen(false);
        setEditingRecord(null);
    };

    const handleSaveRecord = (record: AssetRecord) => {
        if (editingRecord) {
            setRecords(records.map(r => r.id === record.id ? record : r));
        } else {
            setRecords([...records, record]);
        }
        closeModal();
    };

    const handleDeleteRecord = (id: string) => {
        setRecords(records.filter(r => r.id !== id));
        closeModal();
    };

    return (
        <div className="space-y-6">
            <AssetFormModal
                isOpen={isModalOpen}
                onClose={closeModal}
                onSave={handleSaveRecord}
                onDelete={handleDeleteRecord}
                initialData={editingRecord}
                existingRecords={records}
            />

            {/* Data Health Check Warning Banner */}
            {missingExchangeRateCount > 0 && (
                <div className="mb-4 p-3 bg-amber-50 border border-amber-200 rounded-lg flex items-start gap-3">
                    <div className="p-1 bg-amber-100 rounded-full text-amber-600 mt-0.5">
                        <Search className="w-4 h-4" />
                    </div>
                    <div>
                        <h4 className="text-sm font-bold text-amber-800">환율 정보 누락 감지</h4>
                        <p className="text-xs text-amber-700 mt-1">
                            미국주식 매수 내역 중 <strong>{missingExchangeRateCount}건</strong>의 적용환율 정보가 누락되어 있습니다.<br />
                            정확한 양도세 시뮬레이션을 위해 해당 내역을 수정하여 환율을 입력해주세요.
                        </p>
                    </div>
                </div>
            )}

            {/* 1. Dashboard Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {/* Total Assets */}
                <div className="bg-gradient-to-br from-slate-50 to-slate-100 p-5 rounded-lg border border-slate-200 shadow-sm">
                    <div className="flex items-center justify-between mb-2">
                        <h3 className="text-sm font-semibold text-slate-600">총 자산 (추정)</h3>
                    </div>
                    <div className="text-2xl font-bold text-slate-800 mb-1">
                        {new Intl.NumberFormat('ko-KR', { style: 'currency', currency: 'KRW', minimumFractionDigits: 0 }).format(stats.grandTotal)}
                    </div>
                    <div className="text-xs text-slate-500">
                        * USD 환산기준 (현재환율: ₩{exchangeRate.toFixed(2)})
                    </div>
                </div>

                {/* USD Assets */}
                <div className="bg-white p-5 rounded-lg border border-slate-200 shadow-sm relative overflow-hidden">
                    <div className="absolute top-0 right-0 p-4 opacity-10">
                        <span className="text-6xl font-bold text-blue-900">$</span>
                    </div>
                    <div className="text-sm text-slate-500 font-medium mb-1 flex items-center gap-2">
                        🇺🇸 USD 자산
                    </div>
                    <div className="text-2xl font-bold text-blue-600">
                        {new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(stats.usdTotal)}
                    </div>
                </div>

                {/* KRW Assets */}
                <div className="bg-white p-5 rounded-lg border border-slate-200 shadow-sm relative overflow-hidden">
                    <div className="absolute top-0 right-0 p-4 opacity-10">
                        <span className="text-6xl font-bold text-red-900">₩</span>
                    </div>
                    <div className="text-sm text-slate-500 font-medium mb-1 flex items-center gap-2">
                        🇰🇷 KRW 자산
                    </div>
                    <div className="text-2xl font-bold text-slate-700">
                        {new Intl.NumberFormat('ko-KR', { style: 'currency', currency: 'KRW' }).format(stats.krwTotal)}
                    </div>
                </div>
            </div>

            {/* Tab Navigation */}
            <div className="flex space-x-1 bg-slate-100 p-1 rounded-lg w-fit">
                <button
                    onClick={() => setActiveTab('assets')}
                    className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-all ${activeTab === 'assets'
                            ? 'bg-white text-slate-800 shadow-sm'
                            : 'text-slate-500 hover:text-slate-700'
                        }`}
                >
                    <LayoutList className="w-4 h-4" />
                    자산 관리
                </button>
                <button
                    onClick={() => setActiveTab('simulator')}
                    className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-all ${activeTab === 'simulator'
                            ? 'bg-white text-indigo-800 shadow-sm'
                            : 'text-slate-500 hover:text-indigo-600'
                        }`}
                >
                    <Calculator className="w-4 h-4" />
                    절세 시뮬레이터
                </button>
            </div>

            {activeTab === 'assets' ? (
                <>
                    {/* 2. Control Bar */}
                    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white p-4 rounded-lg border border-slate-200 shadow-sm">
                        <div className="relative w-full sm:w-64">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                            <input
                                type="text"
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                placeholder="자산 검색 (종목명, 증권사)"
                                className="w-full pl-9 pr-4 py-2 text-sm border border-slate-200 rounded-md focus:outline-none focus:ring-2 focus:ring-slate-500"
                            />
                        </div>

                        <div className="flex gap-2 w-full sm:w-auto">
                            {/* Hidden File Input */}
                            <input
                                type="file"
                                accept=".csv"
                                ref={fileInputRef}
                                onChange={handleFileChange}
                                className="hidden"
                            />

                            <button
                                onClick={handleDownloadSample}
                                className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-3 py-2 text-emerald-600 hover:bg-emerald-50 rounded-md text-sm font-medium transition-colors border border-emerald-200"
                            >
                                <Download className="w-4 h-4" />
                                샘플 양식
                            </button>

                            <div className="h-8 w-px bg-slate-300 mx-1 hidden md:block"></div>

                            <button
                                onClick={handleExportCSV}
                                className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-3 py-2 text-slate-600 hover:bg-slate-100 rounded-md text-sm font-medium transition-colors border border-slate-200"
                            >
                                <Download className="w-4 h-4" />
                                내보내기
                            </button>

                            <button
                                onClick={handleImportClick}
                                className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-3 py-2 text-slate-600 hover:bg-slate-100 rounded-md text-sm font-medium transition-colors border border-slate-200"
                            >
                                <Upload className="w-4 h-4" />
                                가져오기
                            </button>

                            <div className="h-8 w-px bg-slate-300 mx-1 hidden md:block"></div>

                            <button
                                onClick={() => setResetWarningOpen(true)}
                                className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-3 py-2 text-red-600 hover:bg-red-50 rounded-md text-sm font-medium transition-colors border border-red-200"
                            >
                                <RotateCcw className="w-4 h-4" />
                                초기화
                            </button>
                            <button
                                onClick={openAddModal}
                                className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-4 py-2 bg-slate-800 text-white text-sm font-medium rounded-md hover:bg-slate-700 transition-colors shadow-sm ml-2"
                            >
                                <PlusCircle className="w-4 h-4" />
                                자산 등록
                            </button>
                        </div>
                    </div>

                    <AssetTable
                        records={filteredRecords}
                        onRowClick={openEditModal}
                        isFiltered={searchQuery.trim().length > 0}
                    />
                </>
            ) : (
                <TaxSimulator
                    records={records}
                    currentFxRate={exchangeRate}
                />
            )}

            <NotificationModal
                isOpen={resetWarningOpen}
                onClose={() => setResetWarningOpen(false)}
                type="warning"
                title="자산 데이터 초기화"
                message={`모든 자산 관리 데이터를 삭제하시겠습니까?\n이 작업은 되돌릴 수 없습니다.`}
                onConfirm={handleReset}
            />

            <NotificationModal
                isOpen={importWarningOpen}
                onClose={() => setImportWarningOpen(false)}
                type="warning"
                title="데이터 가져오기"
                message={`총 ${pendingImportRecords.length}건의 자산 데이터를 불러왔습니다.\n기존 데이터는 모두 삭제되고 새로운 데이터로 대체됩니다.\n계속하시겠습니까?`}
                onConfirm={executeImport}
                confirmLabel="네, 가져옵니다"
            />

            <NotificationModal
                isOpen={importSuccessOpen}
                onClose={() => setImportSuccessOpen(false)}
                type="success"
                title="가져오기 완료"
                message="자산 데이터를 성공적으로 불러왔습니다."
                confirmLabel="확인"
            />
        </div>
    );
};
