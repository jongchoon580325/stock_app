
import React, { useState } from 'react';
import { Sparkles, Loader2, RefreshCw, ChevronDown, ChevronUp } from 'lucide-react';
import { DividendRecord } from '../types';
import { analyzePortfolio } from '../services/geminiService';
import ReactMarkdown from 'react-markdown';

interface AnalysisSectionProps {
  records: DividendRecord[];
}

export const AnalysisSection: React.FC<AnalysisSectionProps> = ({ records }) => {
  const [analysis, setAnalysis] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [isOpen, setIsOpen] = useState(true);

  const handleAnalyze = async (e: React.MouseEvent) => {
    e.stopPropagation(); // Prevent toggling when clicking analyze button
    setLoading(true);
    if (!isOpen) setIsOpen(true); // Auto open if closed
    const result = await analyzePortfolio(records);
    setAnalysis(result);
    setLoading(false);
  };

  return (
    <div className="bg-white rounded-lg shadow-sm border border-slate-200 w-full overflow-hidden">
      <div 
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center justify-between p-4 cursor-pointer hover:bg-slate-50 transition-colors select-none"
      >
        <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
          <Sparkles className="w-5 h-5 text-indigo-500" />
          AI 포트폴리오 분석
        </h3>
        <div className="flex items-center gap-3">
            <button
            onClick={handleAnalyze}
            disabled={loading}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-50 text-indigo-700 text-sm font-medium rounded-md hover:bg-indigo-100 transition-colors disabled:opacity-50"
            >
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
            {analysis ? '다시 분석' : '분석 시작'}
            </button>
            {isOpen ? <ChevronUp className="w-5 h-5 text-slate-400" /> : <ChevronDown className="w-5 h-5 text-slate-400" />}
        </div>
      </div>

      {isOpen && (
        <div className="p-4 pt-0 border-t border-slate-100 mt-2">
            <div className="min-h-[100px] bg-slate-50 rounded-md p-4 text-sm text-slate-700 leading-relaxed border border-slate-100 mt-2">
                {loading ? (
                    <div className="flex flex-col items-center justify-center h-24 gap-2 text-slate-400">
                        <Loader2 className="w-6 h-6 animate-spin" />
                        <span>데이터를 분석하고 있습니다...</span>
                    </div>
                ) : analysis ? (
                    <article className="prose prose-sm prose-slate max-w-none">
                        <ReactMarkdown>{analysis}</ReactMarkdown>
                    </article>
                ) : (
                    <p className="text-slate-400 text-center py-4">
                        '분석 시작' 버튼을 눌러 현재 포트폴리오에 대한 AI 리포트를 받아보세요.
                    </p>
                )}
            </div>
        </div>
      )}
    </div>
  );
};
