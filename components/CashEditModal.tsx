import React, { useState, useEffect } from 'react';
import { Wallet, DollarSign } from 'lucide-react';

interface CashEditModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSave: (krw: number, usd: number) => void;
    initialKrw: number;
    initialUsd: number;
}

export const CashEditModal: React.FC<CashEditModalProps> = ({
    isOpen,
    onClose,
    onSave,
    initialKrw,
    initialUsd
}) => {
    const [krwAmount, setKrwAmount] = useState<string>('');
    const [usdAmount, setUsdAmount] = useState<string>('');

    useEffect(() => {
        if (isOpen) {
            setKrwAmount(initialKrw.toString());
            setUsdAmount(initialUsd.toString());
        }
    }, [isOpen, initialKrw, initialUsd]);

    if (!isOpen) return null;

    const handleSave = () => {
        const krw = parseFloat(krwAmount.replace(/,/g, '')) || 0;
        const usd = parseFloat(usdAmount.replace(/,/g, '')) || 0;
        onSave(krw, usd);
        onClose();
    };

    const formatDisplayValue = (val: string) => {
        if (!val) return '';
        // Split integer and decimal parts
        const parts = val.split('.');
        const integerPart = parts[0] ? parseInt(parts[0], 10).toLocaleString() : '0';

        // Return structured string to preserve trailing dot or zeros
        if (parts.length > 1) {
            return `${integerPart}.${parts[1]}`;
        } else if (val.endsWith('.')) {
            return `${integerPart}.`;
        }
        return parseInt(val, 10).toLocaleString();
    };

    const handleKrwChange = (val: string) => {
        const raw = val.replace(/,/g, '');
        // KRW: Integer only
        if (raw === '' || /^\d+$/.test(raw)) {
            setKrwAmount(raw);
        }
    };

    const handleUsdChange = (val: string) => {
        const raw = val.replace(/,/g, '');
        // USD: Allow decimals up to 2 places
        if (raw === '' || /^\d*\.?\d{0,2}$/.test(raw)) {
            setUsdAmount(raw);
        }
    };

    return (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 backdrop-blur-[2px] p-4 transition-all">
            <div className="relative w-full max-w-sm bg-white rounded-2xl shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-300 border-t-8 border-emerald-500">
                <div className="p-6 flex flex-col items-center">

                    {/* Icon Circle */}
                    <div className="w-16 h-16 rounded-full flex items-center justify-center mb-4 shadow-sm bg-emerald-100 text-emerald-600">
                        <Wallet className="w-8 h-8" />
                    </div>

                    <h3 className="text-xl font-bold text-slate-800 mb-2">
                        현금성 자산 관리
                    </h3>

                    <p className="text-slate-500 text-sm leading-relaxed mb-6 text-center">
                        현재 계좌에 보유 중인<br />
                        원화 및 외화 예수금을 입력해주세요.
                    </p>

                    <div className="w-full space-y-4 mb-6">
                        {/* KRW Input */}
                        <div className="space-y-1">
                            <label className="text-xs font-bold text-slate-500 ml-1">🇰🇷 원화 예수금 (KRW)</label>
                            <div className="relative">
                                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 font-bold">₩</span>
                                <input
                                    type="text"
                                    value={krwAmount ? parseInt(krwAmount).toLocaleString() : ''}
                                    onChange={(e) => handleKrwChange(e.target.value)}
                                    placeholder="0"
                                    className="w-full pl-8 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-lg text-slate-800 font-medium focus:outline-none focus:ring-2 focus:ring-emerald-500 transition-all text-right"
                                />
                            </div>
                        </div>

                        {/* USD Input */}
                        <div className="space-y-1">
                            <label className="text-xs font-bold text-slate-500 ml-1">🇺🇸 외화 예수금 (USD)</label>
                            <div className="relative">
                                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 font-bold">$</span>
                                <input
                                    type="text"
                                    value={formatDisplayValue(usdAmount)}
                                    onChange={(e) => handleUsdChange(e.target.value)}
                                    placeholder="0.00"
                                    className="w-full pl-8 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-lg text-slate-800 font-medium focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all text-right"
                                />
                            </div>
                        </div>
                    </div>

                    <div className="flex w-full gap-3">
                        <button
                            onClick={onClose}
                            className="flex-1 py-3 px-4 bg-slate-100 text-slate-600 rounded-xl font-bold hover:bg-slate-200 transition-colors text-sm"
                        >
                            취소
                        </button>

                        <button
                            onClick={handleSave}
                            className="flex-1 py-3 px-4 bg-emerald-600 text-white rounded-xl font-bold hover:bg-emerald-700 shadow-md shadow-emerald-200 transition-transform active:scale-95 text-sm"
                        >
                            저장하기
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};
