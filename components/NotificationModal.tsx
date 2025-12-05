
import React from 'react';
import { AlertTriangle, CheckCircle, X } from 'lucide-react';

interface NotificationModalProps {
  isOpen: boolean;
  onClose: () => void;
  type: 'warning' | 'success';
  title: string;
  message: string;
  onConfirm?: () => void;
  confirmLabel?: string;
}

export const NotificationModal: React.FC<NotificationModalProps> = ({
  isOpen,
  onClose,
  type,
  title,
  message,
  onConfirm,
  confirmLabel = '확인',
}) => {
  if (!isOpen) return null;

  const isWarning = type === 'warning';

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 backdrop-blur-[2px] p-4 transition-all">
      <div 
        className={`
          relative w-full max-w-sm bg-white rounded-2xl shadow-2xl overflow-hidden transform transition-all animate-in fade-in zoom-in duration-300
          ${isWarning ? 'border-t-8 border-rose-400' : 'border-t-8 border-emerald-400'}
        `}
      >
        <div className="p-6 flex flex-col items-center text-center">
          {/* Icon Circle */}
          <div className={`
            w-16 h-16 rounded-full flex items-center justify-center mb-4 shadow-sm
            ${isWarning ? 'bg-rose-100 text-rose-500' : 'bg-emerald-100 text-emerald-500'}
          `}>
            {isWarning ? <AlertTriangle className="w-8 h-8" /> : <CheckCircle className="w-8 h-8" />}
          </div>

          <h3 className="text-xl font-bold text-slate-800 mb-2">
            {title}
          </h3>
          
          <p className="text-slate-500 text-sm leading-relaxed mb-6 whitespace-pre-wrap">
            {message}
          </p>

          <div className="flex w-full gap-3">
            {isWarning && (
              <button
                onClick={onClose}
                className="flex-1 py-2.5 px-4 bg-slate-100 text-slate-600 rounded-xl font-bold hover:bg-slate-200 transition-colors text-sm"
              >
                취소
              </button>
            )}
            
            <button
              onClick={() => {
                if (onConfirm) onConfirm();
                else onClose();
              }}
              className={`
                flex-1 py-2.5 px-4 rounded-xl font-bold text-white shadow-md transition-transform active:scale-95 text-sm
                ${isWarning 
                  ? 'bg-rose-500 hover:bg-rose-600 shadow-rose-200' 
                  : 'bg-emerald-500 hover:bg-emerald-600 shadow-emerald-200'}
              `}
            >
              {confirmLabel}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
