import React, { useState, useEffect } from 'react';
import { Key, ExternalLink } from 'lucide-react';

interface ApiKeyModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSave: (apiKey: string) => void;
    initialKey?: string;
}

export const ApiKeyModal: React.FC<ApiKeyModalProps> = ({
    isOpen,
    onClose,
    onSave,
    initialKey = ''
}) => {
    const [apiKey, setApiKey] = useState(initialKey);

    // Sync with prop when modal opens
    useEffect(() => {
        if (isOpen) {
            setApiKey(initialKey);
        }
    }, [isOpen, initialKey]);

    if (!isOpen) return null;

    const handleSave = () => {
        onSave(apiKey);
        onClose();
    };

    return (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 backdrop-blur-[2px] p-4 transition-all">
            <div className="relative w-full max-w-sm bg-white rounded-2xl shadow-2xl overflow-hidden transform transition-all animate-in fade-in zoom-in duration-300 border-t-8 border-indigo-400">
                <div className="p-6 flex flex-col items-center text-center">

                    {/* Icon Circle */}
                    <div className="w-16 h-16 rounded-full flex items-center justify-center mb-4 shadow-sm bg-indigo-100 text-indigo-500">
                        <Key className="w-8 h-8" />
                    </div>

                    <h3 className="text-xl font-bold text-slate-800 mb-2">
                        API Key 설정
                    </h3>

                    <p className="text-slate-500 text-sm leading-relaxed mb-4">
                        실시간 시세를 불러오기 위해<br />
                        Finnhub API Key가 필요합니다.
                    </p>

                    <input
                        type="text"
                        value={apiKey}
                        onChange={(e) => setApiKey(e.target.value)}
                        placeholder="Finnhub API Key 입력"
                        className="w-full px-4 py-3 mb-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-800 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all font-mono"
                    />

                    <a
                        href="https://finnhub.io/register"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-1 text-xs text-indigo-500 hover:text-indigo-700 hover:underline mb-6 transition-colors"
                    >
                        <span>Finnhub에서 무료 키 발급받기</span>
                        <ExternalLink className="w-3 h-3" />
                    </a>

                    <div className="flex w-full gap-3">
                        <button
                            onClick={onClose}
                            className="flex-1 py-2.5 px-4 bg-slate-100 text-slate-600 rounded-xl font-bold hover:bg-slate-200 transition-colors text-sm"
                        >
                            취소
                        </button>

                        <button
                            onClick={handleSave}
                            className="flex-1 py-2.5 px-4 bg-indigo-500 text-white rounded-xl font-bold hover:bg-indigo-600 shadow-md shadow-indigo-200 transition-transform active:scale-95 text-sm"
                        >
                            저장
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};
