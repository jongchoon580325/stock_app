import React, { useState } from 'react';
import { Menu, X } from 'lucide-react';
import { AccountType } from '../types';

interface MobileMenuProps {
    accountType: AccountType;
    setAccountType: (type: AccountType) => void;
}

export const MobileMenu: React.FC<MobileMenuProps> = ({ accountType, setAccountType }) => {
    const [isOpen, setIsOpen] = useState(false);

    const handleMenuClick = (type: AccountType) => {
        setAccountType(type);
        setIsOpen(false);
    };

    return (
        <div className="md:hidden">
            <button
                onClick={() => setIsOpen(!isOpen)}
                className="p-2 text-slate-600 hover:bg-slate-100 rounded-md transition-colors"
                aria-label="Toggle menu"
            >
                {isOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
            </button>

            {isOpen && (
                <div className="absolute top-16 left-0 right-0 bg-white border-b border-slate-200 shadow-lg z-50">
                    <div className="flex flex-col p-2 space-y-1">
                        <button
                            onClick={() => handleMenuClick('general')}
                            className={`px-4 py-3 text-left text-sm font-medium rounded-md transition-all ${accountType === 'general'
                                    ? 'bg-slate-50 text-fuchsia-700 shadow-sm border border-slate-100'
                                    : 'text-slate-600 hover:bg-slate-50 hover:text-slate-800'
                                }`}
                        >
                            일반계좌
                        </button>
                        <button
                            onClick={() => handleMenuClick('tax-free')}
                            className={`px-4 py-3 text-left text-sm font-medium rounded-md transition-all ${accountType === 'tax-free'
                                    ? 'bg-slate-50 text-emerald-700 shadow-sm border border-slate-100'
                                    : 'text-slate-600 hover:bg-slate-50 hover:text-slate-800'
                                }`}
                        >
                            비과세계좌
                        </button>
                        <button
                            onClick={() => handleMenuClick('asset-config')}
                            className={`px-4 py-3 text-left text-sm font-medium rounded-md transition-all ${accountType === 'asset-config'
                                    ? 'bg-slate-50 text-blue-600 shadow-sm border border-slate-100'
                                    : 'text-slate-600 hover:bg-slate-50 hover:text-slate-800'
                                }`}
                        >
                            Asset Config
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
};
