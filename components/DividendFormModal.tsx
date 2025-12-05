
import React, { useState, useEffect } from 'react';
import { X, Save, Trash2 } from 'lucide-react';
import { DividendRecord } from '../types';
import { NotificationModal } from './NotificationModal';

interface DividendFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (record: DividendRecord) => void;
  onDelete: (id: string) => void;
  initialData?: DividendRecord | null;
  existingRecords: DividendRecord[];
}

const EMPTY_RECORD: Omit<DividendRecord, 'id'> = {
  date: new Date().toISOString().split('T')[0],
  stockName: '',
  quantity: 0,
  currentPrice: 0,
  priceChange: 0,
  dividendPerShare: 0,
  dividendChange: 0,
  taxBase: 0,
  taxableDistribution: 0,
  taxAmount: 0,
};

export const DividendFormModal: React.FC<DividendFormModalProps> = ({
  isOpen,
  onClose,
  onSave,
  onDelete,
  initialData,
  existingRecords,
}) => {
  const [formData, setFormData] = useState<Omit<DividendRecord, 'id'>>({ ...EMPTY_RECORD });
  const [isDeleteWarningOpen, setIsDeleteWarningOpen] = useState(false);

  // Extract unique stock names for the datalist (Smart Input)
  const uniqueStocks = React.useMemo(() => {
    const names = new Set(existingRecords.map(r => r.stockName));
    return Array.from(names).sort();
  }, [existingRecords]);

  useEffect(() => {
    if (initialData) {
      const { id, ...rest } = initialData;
      setFormData(rest);
    } else {
      setFormData({ ...EMPTY_RECORD, date: new Date().toISOString().split('T')[0] });
    }
  }, [initialData, isOpen]);

  // Rule 4 & 5: Auto-calculate Tax details when inputs change
  useEffect(() => {
    if (!isOpen) return;

    // Rule 4: Taxable Distribution = Tax Base * Quantity
    const calculatedTaxable = (formData.taxBase || 0) * (formData.quantity || 0);

    // Rule 5: Tax Amount = Taxable Distribution * 0.154
    const calculatedTaxAmount = Math.floor(calculatedTaxable * 0.154);

    setFormData(prev => {
      // Only update if values differ to avoid loop
      if (prev.taxableDistribution === calculatedTaxable && prev.taxAmount === calculatedTaxAmount) {
        return prev;
      }
      return {
        ...prev,
        taxableDistribution: calculatedTaxable,
        taxAmount: calculatedTaxAmount
      };
    });
  }, [formData.taxBase, formData.quantity, isOpen]);


  if (!isOpen) return null;

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
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

  // Updated input class: Dark background (bg-slate-700), White text (text-white), Lighter border (border-slate-500)
  const inputClass = "w-full rounded-md border border-slate-500 bg-slate-700 text-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent placeholder-slate-400";
  const readOnlyClass = "w-full rounded-md border border-slate-600 bg-slate-800 text-slate-300 px-3 py-2 text-sm focus:outline-none cursor-not-allowed font-medium";
  const labelClass = "block text-xs font-semibold text-slate-500 mb-1";

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
        <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto flex flex-col">
          <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
            <h2 className="text-xl font-bold text-slate-800">
              {initialData ? '분배금 내역 수정' : '새로운 내역 등록'}
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
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
                <div>
                  <label className={labelClass}>종목명</label>
                  <input
                    required
                    type="text"
                    name="stockName"
                    value={formData.stockName}
                    onChange={handleChange}
                    list="stock-suggestions" // Connect to datalist
                    placeholder="종목명 검색 또는 입력"
                    className={inputClass}
                    autoComplete="off"
                  />
                  {/* Smart Dropdown List */}
                  <datalist id="stock-suggestions">
                    {uniqueStocks.map(stock => (
                      <option key={stock} value={stock} />
                    ))}
                  </datalist>
                </div>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div>
                  <label className={labelClass}>주식수량</label>
                  <input
                    type="number"
                    name="quantity"
                    value={formData.quantity || ''}
                    onChange={handleChange}
                    className={inputClass}
                    required
                  />
                </div>
                <div>
                  <label className={labelClass}>현주가</label>
                  <input
                    type="number"
                    name="currentPrice"
                    value={formData.currentPrice || ''}
                    onChange={handleChange}
                    className={inputClass}
                  />
                </div>
                <div>
                  <label className={labelClass}>분배금(주당)</label>
                  <input
                    type="number"
                    name="dividendPerShare"
                    value={formData.dividendPerShare || ''}
                    onChange={handleChange}
                    className={inputClass}
                  />
                </div>
                <div>
                  <label className={labelClass}>과세표준</label>
                  <input
                    type="number"
                    name="taxBase"
                    value={formData.taxBase}
                    onChange={handleChange}
                    min={0}
                    step={1}
                    required
                    className={inputClass}
                  />
                </div>
              </div>
            </div>

            {/* Section 2: Tax & Amounts */}
            <div className="space-y-4">
              <h3 className="text-sm font-bold text-slate-800 border-l-4 border-fuchsia-500 pl-2">자동 계산 내역 (수정 불가)</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className={labelClass}>과세분배금 (과세표준 × 수량)</label>
                  <input
                    type="number"
                    name="taxableDistribution"
                    value={formData.taxableDistribution}
                    readOnly
                    className={readOnlyClass}
                  />
                </div>
                <div>
                  <label className={labelClass}>과세금액 (과세분배금 × 15.4%)</label>
                  <input
                    type="number"
                    name="taxAmount"
                    value={formData.taxAmount}
                    readOnly
                    className={readOnlyClass}
                  />
                </div>
              </div>
              <p className="text-xs text-slate-400 mt-2">
                * 주가등락 및 분배금등락은 이전 거래 내역을 바탕으로 자동 계산되어 저장됩니다.
              </p>
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
