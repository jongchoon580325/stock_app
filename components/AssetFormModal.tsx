import React, { useState, useEffect } from 'react';
import { X, Save, Trash2 } from 'lucide-react';
import { AssetRecord } from '../types';
import { NotificationModal } from './NotificationModal';

interface AssetFormModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSave: (record: AssetRecord) => void;
    onDelete: (id: string) => void;
    initialData?: AssetRecord | null;
    existingRecords: AssetRecord[];
}

const EMPTY_RECORD: Omit<AssetRecord, 'id'> = {
    stockType: '개별주식',
    country: 'USA',
    date: new Date().toISOString().split('T')[0],
    broker: '',
    name: '',
    accountNumber: '',
    accountType: '일반계좌',
    tradeType: '매수',
    dividendCycle: '없음',
    price: 0,
    quantity: 0,
    amount: 0,
    sellAmount: 0,
    exchangeRate: 0,
    note: ''
};

export const AssetFormModal: React.FC<AssetFormModalProps> = ({
    isOpen,
    onClose,
    onSave,
    onDelete,
    initialData,
    existingRecords,
}) => {
    const [formData, setFormData] = useState<Omit<AssetRecord, 'id'>>({ ...EMPTY_RECORD });
    const [isDeleteWarningOpen, setIsDeleteWarningOpen] = useState(false);

    // Extract unique brokers from existing records
    const uniqueBrokers = React.useMemo(() => {
        const brokers = new Set(existingRecords.map(r => r.broker).filter(b => b));
        return Array.from(brokers).sort();
    }, [existingRecords]);

    // Extract unique stock names filtered by selected country
    const filteredStockNames = React.useMemo(() => {
        const stocks = existingRecords
            .filter(r => r.country === formData.country)
            .map(r => r.name)
            .filter(n => n);
        return Array.from(new Set(stocks)).sort();
    }, [existingRecords, formData.country]);

    // Extract unique account numbers
    const uniqueAccountNumbers = React.useMemo(() => {
        const accounts = new Set(existingRecords.map(r => r.accountNumber).filter(a => a));
        return Array.from(accounts).sort();
    }, [existingRecords]);

    useEffect(() => {
        if (initialData) {
            const { id, ...rest } = initialData;
            setFormData(rest);
        } else {
            setFormData({ ...EMPTY_RECORD, date: new Date().toISOString().split('T')[0] });
        }
    }, [initialData, isOpen]);

    // Auto-calculate amount when price or quantity changes
    useEffect(() => {
        if (!isOpen) return;
        const calculatedAmount = formData.price * formData.quantity;
        if (formData.amount !== calculatedAmount) {
            setFormData(prev => ({ ...prev, amount: calculatedAmount }));
        }
    }, [formData.price, formData.quantity, isOpen]);

    if (!isOpen) return null;

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        const { name, value, type } = e.target;
        setFormData((prev) => ({
            ...prev,
            [name]: type === 'number' ? (value === '' ? 0 : Number(value)) : value,
        }));
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        onSave({
            ...formData,
            broker: formData.broker.trim(),
            name: formData.name.trim(),
            accountNumber: formData.accountNumber?.trim() || '',
            stockType: formData.stockType.trim() || '개별주식',
            country: (formData.country.trim() as 'USA' | 'KOR') || 'USA',
            accountType: (formData.accountType.trim() as any) || '일반계좌',
            id: initialData?.id || crypto.randomUUID(),
        });
    };

    const handleDeleteClick = () => {
        if (initialData) {
            setIsDeleteWarningOpen(true);
        }
    };

    const confirmDelete = () => {
        if (initialData) {
            onDelete(initialData.id);
            setIsDeleteWarningOpen(false);
        }
    };

    const inputClass = "w-full rounded-md border border-slate-500 bg-slate-700 text-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent placeholder-slate-400";
    const readOnlyClass = "w-full rounded-md border border-slate-600 bg-slate-800 text-slate-300 px-3 py-2 text-sm focus:outline-none cursor-not-allowed font-medium";
    const labelClass = "block text-xs font-semibold text-slate-500 mb-1";
    const selectClass = "w-full rounded-md border border-slate-500 bg-slate-700 text-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500";

    return (
        <>
            <NotificationModal
                isOpen={isDeleteWarningOpen}
                onClose={() => setIsDeleteWarningOpen(false)}
                type="warning"
                title="데이터 삭제"
                message={`정말 이 항목을 삭제하시겠습니까?\n삭제된 데이터는 복구할 수 없습니다.`}
                onConfirm={confirmDelete}
                confirmLabel="삭제"
            />
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
                <div className="bg-white rounded-xl shadow-2xl w-full max-w-3xl max-h-[90vh] overflow-y-auto flex flex-col">
                    <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
                        <h2 className="text-xl font-bold text-slate-800">
                            {initialData ? '자산 내역 수정' : '새로운 자산 등록'}
                        </h2>
                        <button
                            onClick={onClose}
                            className="text-slate-400 hover:text-slate-600 hover:bg-slate-100 p-2 rounded-full transition-colors"
                        >
                            <X className="w-5 h-5" />
                        </button>
                    </div>

                    <form onSubmit={handleSubmit} className="p-6 space-y-6 flex-1 overflow-y-auto">
                        {/* Section 1: Basic Info */}
                        <div className="space-y-4">
                            <h3 className="text-sm font-bold text-slate-800 border-l-4 border-indigo-500 pl-2">기본 정보</h3>
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                <div>
                                    <label className={labelClass}>주식구분</label>
                                    <select
                                        name="stockType"
                                        value={['개별주식', 'ETF주식'].includes(formData.stockType) ? formData.stockType : (formData.stockType ? '__custom__' : '')}
                                        onChange={(e) => {
                                            if (e.target.value === '__custom__') setFormData(p => ({ ...p, stockType: '' }));
                                            else handleChange(e);
                                        }}
                                        className={selectClass}
                                    >
                                        <option value="개별주식">개별주식</option>
                                        <option value="ETF주식">ETF주식</option>
                                        <option value="__custom__">직접 입력...</option>
                                    </select>
                                    {!['개별주식', 'ETF주식', ''].includes(formData.stockType) && (
                                        <input
                                            type="text"
                                            name="stockType"
                                            value={formData.stockType}
                                            onChange={handleChange}
                                            placeholder="주식구분 입력"
                                            className={`${inputClass} mt-2`}
                                            autoFocus
                                        />
                                    )}
                                    {/* Handle case where user just selected custom but value is empty */}
                                    {formData.stockType === '' && (
                                        <input
                                            type="text"
                                            name="stockType"
                                            value=""
                                            onChange={handleChange}
                                            placeholder="주식구분 입력"
                                            className={`${inputClass} mt-2`}
                                            autoFocus
                                        />
                                    )}
                                </div>
                                <div>
                                    <label className={labelClass}>국가</label>
                                    <select
                                        name="country"
                                        value={['USA', 'KOR'].includes(formData.country) ? formData.country : (formData.country ? '__custom__' : '')}
                                        onChange={(e) => {
                                            if (e.target.value === '__custom__') setFormData(p => ({ ...p, country: 'USA' })); // Default fallback or empty? Let's treat unsafe typing carefully.
                                            // Actually for country, changing it affects currency.
                                            if (e.target.value === '__custom__') setFormData(p => ({ ...p, country: '' as any }));
                                            else handleChange(e);
                                        }}
                                        className={selectClass}
                                    >
                                        <option value="USA">USA</option>
                                        <option value="KOR">KOR</option>
                                        <option value="__custom__">직접 입력...</option>
                                    </select>
                                    {!['USA', 'KOR'].includes(formData.country) && (
                                        <input
                                            type="text"
                                            name="country"
                                            value={formData.country}
                                            onChange={handleChange}
                                            placeholder="국가 코드 입력 (예: JPN)"
                                            className={`${inputClass} mt-2`}
                                            autoFocus
                                        />
                                    )}
                                </div>
                                <div>
                                    <label className={labelClass}>거래일</label>
                                    <input
                                        required
                                        type="date"
                                        name="date"
                                        value={formData.date}
                                        onChange={handleChange}
                                        className={inputClass}
                                        style={{ colorScheme: 'dark' }}
                                    />
                                </div>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                <div>
                                    <label className={labelClass}>증권사</label>
                                    <select
                                        name="broker"
                                        value={uniqueBrokers.includes(formData.broker) ? formData.broker : (formData.broker && formData.broker.trim() !== '' ? '__custom__' : '')}
                                        onChange={(e) => {
                                            if (e.target.value === '__custom__') setFormData(p => ({ ...p, broker: ' ' })); // Space hack to trigger input
                                            else handleChange(e);
                                        }}
                                        className={selectClass}
                                    >
                                        <option value="">증권사 선택</option>
                                        {uniqueBrokers.map(broker => (
                                            <option key={broker} value={broker}>{broker}</option>
                                        ))}
                                        <option value="__custom__">직접 입력...</option>
                                    </select>
                                    {/* Show input if custom (not in list) and not empty (or is space hack) */}
                                    {((!uniqueBrokers.includes(formData.broker) && formData.broker !== '') || formData.broker === ' ') && (
                                        <input
                                            type="text"
                                            name="broker"
                                            value={formData.broker === ' ' ? '' : formData.broker}
                                            onChange={handleChange}
                                            placeholder="증권사명 입력"
                                            className={`${inputClass} mt-2`}
                                            autoFocus
                                        />
                                    )}
                                </div>
                                <div>
                                    <label className={labelClass}>계좌번호</label>
                                    <input
                                        type="text"
                                        name="accountNumber"
                                        value={formData.accountNumber || ''}
                                        onChange={handleChange}
                                        placeholder="123-45-67890"
                                        className={inputClass}
                                    />
                                </div>
                                <div>
                                    <label className={labelClass}>종목명</label>
                                    <input
                                        required
                                        type="text"
                                        name="name"
                                        value={formData.name}
                                        onChange={handleChange}
                                        list="asset-suggestions"
                                        placeholder={`${formData.country === 'USA' ? '미국' : '국내'} 종목명 검색 또는 입력`}
                                        className={inputClass}
                                        autoComplete="off"
                                    />
                                    <datalist id="asset-suggestions">
                                        {filteredStockNames.map(stock => (
                                            <option key={stock} value={stock} />
                                        ))}
                                    </datalist>
                                </div>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div>
                                    <label className={labelClass}>계좌유형</label>
                                    <select name="accountType" value={formData.accountType} onChange={handleChange} className={selectClass}>
                                        <option value="일반계좌">일반계좌</option>
                                        <option value="ISA">ISA</option>
                                        <option value="연금저축계좌">연금저축계좌</option>
                                        <option value="비과세저축계좌">비과세저축계좌</option>
                                        <option value="일반배당계좌">일반배당계좌</option>
                                    </select>
                                </div>
                                <div>
                                    <label className={labelClass}>거래유형</label>
                                    <select name="tradeType" value={formData.tradeType} onChange={handleChange} className={selectClass}>
                                        <option value="매수">매수</option>
                                        <option value="매도">매도</option>
                                    </select>
                                </div>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div>
                                    <label className={labelClass}>분배주기</label>
                                    <select name="dividendCycle" value={formData.dividendCycle} onChange={handleChange} className={selectClass}>
                                        <option value="없음">없음</option>
                                        <option value="월초">월초</option>
                                        <option value="월중">월중</option>
                                        <option value="월말">월말</option>
                                        <option value="분기">분기</option>
                                        <option value="반기">반기</option>
                                        <option value="년">년</option>
                                    </select>
                                </div>
                                <div>
                                    <label className={labelClass}>적용환율 (USD인 경우)</label>
                                    <input
                                        type="number"
                                        name="exchangeRate"
                                        value={formData.exchangeRate || ''}
                                        onChange={handleChange}
                                        step="0.01"
                                        placeholder="1420.50"
                                        className={inputClass}
                                    />
                                </div>
                            </div>
                        </div>

                        {/* Section 2: Transaction Details */}
                        <div className="space-y-4">
                            <h3 className="text-sm font-bold text-slate-800 border-l-4 border-fuchsia-500 pl-2">거래 상세</h3>
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                                <div>
                                    <label className={labelClass}>매입단가</label>
                                    <input
                                        type="number"
                                        name="price"
                                        value={formData.price || ''}
                                        onChange={handleChange}
                                        step="0.01"
                                        required
                                        className={inputClass}
                                    />
                                </div>
                                <div>
                                    <label className={labelClass}>수량</label>
                                    <input
                                        type="number"
                                        name="quantity"
                                        value={formData.quantity || ''}
                                        onChange={handleChange}
                                        required
                                        className={inputClass}
                                    />
                                </div>
                                <div>
                                    <label className={labelClass}>매수금액 (자동)</label>
                                    <input
                                        type="number"
                                        name="amount"
                                        value={formData.amount}
                                        readOnly
                                        className={readOnlyClass}
                                    />
                                </div>
                                <div>
                                    <label className={labelClass}>매도금액</label>
                                    <input
                                        type="number"
                                        name="sellAmount"
                                        value={formData.sellAmount || ''}
                                        onChange={handleChange}
                                        step="0.01"
                                        placeholder="0"
                                        className={inputClass}
                                    />
                                </div>
                            </div>

                            <div>
                                <label className={labelClass}>비고</label>
                                <input
                                    type="text"
                                    name="note"
                                    value={formData.note || ''}
                                    onChange={handleChange}
                                    placeholder="추가 메모"
                                    className={inputClass}
                                />
                            </div>
                        </div>
                    </form>

                    <div className="flex items-center justify-between px-6 py-4 bg-slate-50 border-t border-slate-200">
                        <div>
                            {initialData && (
                                <button
                                    type="button"
                                    onClick={handleDeleteClick}
                                    className="flex items-center gap-1.5 px-3 py-2 text-red-600 hover:bg-red-50 rounded-md transition-colors text-sm font-medium"
                                >
                                    <Trash2 className="w-4 h-4" />
                                    삭제
                                </button>
                            )}
                        </div>
                        <div className="flex gap-3">
                            <button
                                type="button"
                                onClick={onClose}
                                className="px-4 py-2 text-slate-700 hover:bg-slate-200 rounded-md text-sm font-medium transition-colors"
                            >
                                취소
                            </button>
                            <button
                                onClick={handleSubmit}
                                className="flex items-center gap-2 px-5 py-2 bg-indigo-600 text-white rounded-md text-sm font-bold hover:bg-indigo-700 shadow-sm transition-colors"
                            >
                                <Save className="w-4 h-4" />
                                저장
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </>
    );
};
