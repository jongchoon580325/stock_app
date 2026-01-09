import React, { useState, useEffect, useMemo } from 'react';
import { Calculator, TrendingUp, DollarSign, Download, Loader2, Settings, RefreshCw, RotateCcw } from 'lucide-react';
import { AssetRecord } from '../types';
import { calculateCurrentPortfolio, calculateRealizedGainByYear, PortfolioItem } from '../logic/usTaxEngine';
import { buildExemptionSafePlan, buildTargetAmountPlan, StrategyPlan } from '../logic/taxStrategyService';
import { generateTaxReport } from '../logic/taxReportService'; // Import Report Service
import { fetchBatchPrices } from '../logic/stockPriceService'; // Import Stock Price Service

import { NotificationModal } from './NotificationModal';
import { ApiKeyModal } from './ApiKeyModal'; // Import new modal

interface TaxSimulatorProps {
    records: AssetRecord[];
    currentFxRate: number;
}

export const TaxSimulator: React.FC<TaxSimulatorProps> = ({ records, currentFxRate }) => {
    // State for user inputs
    const [priceMap, setPriceMap] = useState<Map<string, number>>(new Map());
    const [targetAmount, setTargetAmount] = useState<number>(0);
    const [simulatedPlan, setSimulatedPlan] = useState<StrategyPlan | null>(null);
    const [isGeneratingReport, setIsGeneratingReport] = useState(false); // Report Loading State
    const [isFetchingPrices, setIsFetchingPrices] = useState(false); // Price Fetching State

    // API Key State (Persist in LocalStorage logic would be in useEffect, but let's lazy init)
    const [apiKey, setApiKey] = useState<string>(() => localStorage.getItem('finnhubApiKey') || '');
    const [isApiKeyModalOpen, setIsApiKeyModalOpen] = useState(false); // New Modal State

    // Initial Data Loading
    const { inventory, realizedSummary } = useMemo(() => {
        const inv = calculateCurrentPortfolio(records);
        const realized = calculateRealizedGainByYear(records);
        const currentYear = new Date().getFullYear();
        const thisYearSummary = realized.find(r => r.year === currentYear);
        return {
            inventory: inv,
            realizedSummary: thisYearSummary || { totalRealizedGain: 0, totalSellAmount: 0, year: currentYear, trades: [] }
        };
    }, [records]);

    // Initialize PriceMap with last known prices (if needed) or 0
    // Actually, we want to let user input fresh prices.
    // Maybe pre-fill with 'current holdings' having 0.
    useEffect(() => {
        setPriceMap(prev => {
            const next = new Map(prev);
            inventory.forEach((item, symbol) => {
                if (!next.has(symbol)) {
                    // Try to find last price from records? Or just 0
                    // Let's leave it 0 or user fills it.
                    next.set(symbol, 0);
                }
            });
            return next;
        });
    }, [inventory]);

    const handlePriceChange = (symbol: string, val: string) => {
        const num = parseFloat(val);
        setPriceMap(prev => {
            const next = new Map(prev);
            next.set(symbol, isNaN(num) ? 0 : num);
            return next;
        });
    };

    const handleSaveApiKey = (newKey: string) => {
        const trimmed = newKey.trim();
        setApiKey(trimmed);
        localStorage.setItem('finnhubApiKey', trimmed);
        setIsApiKeyModalOpen(false);
        // Optional: Auto trigger fetch if key was just added? 
        // Let's stick to user clicking button again to imply intent, or just close.
    };

    const handleAutoFillPrices = async () => {
        if (!apiKey) {
            // Open Modal instead of confirm/prompt
            setIsApiKeyModalOpen(true);
            return;
        }

        setIsFetchingPrices(true);
        try {
            const symbols = Array.from(inventory.keys());
            // Filter out validation skipped items? No, logic handles it.

            const fetchedPrices = await fetchBatchPrices(symbols, apiKey);

            let updateCount = 0;
            setPriceMap(prev => {
                const next = new Map(prev);
                fetchedPrices.forEach((price, symbol) => {
                    if (price > 0) {
                        next.set(symbol, price);
                        updateCount++;
                    }
                });
                return next;
            });

            if (updateCount > 0) {
                // alert(`${ updateCount }개 종목의 시세를 업데이트했습니다.`);
            } else {
                alert("업데이트할 시세 정보를 가져오지 못했습니다.\nAPI Key 확인 혹은 장 운영 시간을 확인해주세요.");
            }

        } catch (error) {
            console.error(error);
            alert("시세 조회 중 오류가 발생했습니다.");
        } finally {
            setIsFetchingPrices(false);
        }
    };

    const handleDownloadReport = async () => {
        if (!simulatedPlan) return;
        await generateTaxReport(
            simulatedPlan,
            realizedSummary,
            () => setIsGeneratingReport(true),
            () => setIsGeneratingReport(false)
        );
    };

    // --- Strategy Handlers ---

    const validatePrices = (): boolean => {
        // Check if any holding has 0 price
        const missingPrices: string[] = [];
        inventory.forEach((item, symbol) => {
            const price = priceMap.get(symbol);
            if (!price || price <= 0) {
                missingPrices.push(symbol);
            }
        });

        if (missingPrices.length > 0) {
            alert(`다음 종목의 현재가(USD)가 입력되지 않았습니다: \n${missingPrices.join(', ')} \n\n왼쪽 목록에서 시세($)를 입력해주세요.`);
            return false;
        }
        return true;
    };

    const runExemptionStrategy = () => {
        if (!validatePrices()) return;

        const plan = buildExemptionSafePlan(
            inventory,
            priceMap,
            currentFxRate,
            realizedSummary.totalRealizedGain
        );
        setSimulatedPlan(plan);
    };

    const runTargetStrategy = () => {
        if (targetAmount <= 0) {
            alert("목표 매도 금액을 입력해주세요.");
            return;
        }
        if (!validatePrices()) return;

        const plan = buildTargetAmountPlan(
            inventory,
            priceMap,
            currentFxRate,
            targetAmount,
            realizedSummary.totalRealizedGain
        );
        setSimulatedPlan(plan);
    };

    // Calculate Unrealized Gains for Display
    const holdingsList = Array.from(inventory.values()).map(item => {
        const currentPrice = priceMap.get(item.symbol) || 0;
        const marketValueKRW = currentPrice * currentFxRate * item.qty;
        const unrealizedGain = marketValueKRW - item.totalCostKRW;
        return { ...item, currentPrice, marketValueKRW, unrealizedGain };
    });

    return (
        <div className="flex flex-col lg:flex-row gap-6 h-full min-h-[600px]">
            {/* LEFT PANEL: Holdings & Price Input */}
            <div className="w-full lg:w-1/3 flex flex-col gap-4 bg-white p-4 rounded-lg border border-slate-200 shadow-sm">
                <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                    <h3 className="font-bold text-slate-700 flex items-center gap-2">
                        <DollarSign className="w-5 h-5 text-green-600" />
                        보유 종목 & 시세
                    </h3>
                    <button onClick={handleAutoFillPrices} className="text-xs text-blue-600 hover:underline">
                        최신가 불러오기
                    </button>
                </div>

                <div className="overflow-y-auto flex-1 pr-1">
                    <table className="w-full text-sm text-left">
                        <thead className="text-xs text-slate-500 bg-slate-50 sticky top-0">
                            <tr>
                                <th className="py-2 pl-2">종목</th>
                                <th className="py-2 text-right">보유수량</th>
                                <th className="py-2 text-right">현재가($)</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {holdingsList.map(item => (
                                <tr key={item.symbol} className="hover:bg-slate-50">
                                    <td className="py-3 pl-2 font-medium text-slate-700">{item.symbol}</td>
                                    <td className="py-3 text-right text-slate-600">
                                        {item.qty.toLocaleString()}
                                    </td>
                                    <td className="py-3 text-right">
                                        <input
                                            type="number"
                                            value={priceMap.get(item.symbol) || ''}
                                            onChange={(e) => handlePriceChange(item.symbol, e.target.value)}
                                            className="w-20 text-right border border-slate-300 rounded px-1 py-0.5 focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                                            placeholder="0.00"
                                        />
                                    </td>
                                </tr>
                            ))}
                            {holdingsList.length === 0 && (
                                <tr>
                                    <td colSpan={3} className="py-8 text-center text-slate-400">
                                        보유중인 미국 주식이 없습니다.
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>

                <div className="bg-slate-50 p-3 rounded text-xs text-slate-500">
                    <p>ℹ️ <strong>현재 환율:</strong> {currentFxRate.toLocaleString()}원/USD</p>
                    <p className="mt-1">정확한 시뮬레이션을 위해 매도하려는 시점의 예상 주가를 입력해주세요.</p>
                </div>
            </div>

            {/* RIGHT PANEL: Simulation Dashboard */}
            <div className="flex-1 flex flex-col gap-6">

                {/* 1. Status Cards */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="bg-white p-4 rounded-lg border border-slate-200 shadow-sm">
                        <div className="text-xs font-bold text-slate-500 mb-1">올해 실현 수익 (확정)</div>
                        <div className="text-lg font-bold text-slate-800">
                            {Math.round(realizedSummary.totalRealizedGain).toLocaleString()}원
                        </div>
                    </div>
                    <div className="bg-white p-4 rounded-lg border border-slate-200 shadow-sm">
                        <div className="text-xs font-bold text-slate-500 mb-1">비과세 남은 한도</div>
                        <div className="text-lg font-bold text-green-600">
                            {Math.max(0, 2500000 - realizedSummary.totalRealizedGain).toLocaleString()}원
                        </div>
                    </div>
                    <div className="bg-white p-4 rounded-lg border border-slate-200 shadow-sm">
                        <div className="text-xs font-bold text-red-600 mb-1">예상 양도 소득세</div>
                        <div className="text-lg font-bold text-red-600">
                            {simulatedPlan ? Math.round(simulatedPlan.totalTaxableDetail.finalTax).toLocaleString() : '-'}원
                        </div>
                    </div>
                </div>

                {/* 2. Controls */}
                <div className="bg-indigo-50 p-5 rounded-lg border border-indigo-100 flex flex-col md:flex-row items-center gap-6">
                    <div className="flex-1 w-full text-center md:text-left">
                        <h4 className="font-bold text-indigo-900 mb-1">절세 전략 시뮬레이션</h4>
                        <p className="text-sm text-indigo-700">원하는 전략을 선택하여 최적의 매도 플랜을 확인하세요.</p>
                    </div>

                    {/* Reset Button */}
                    <button
                        onClick={() => {
                            setSimulatedPlan(null);
                            setTargetAmount(0);
                        }}
                        className="p-2 text-indigo-400 hover:text-indigo-600 hover:bg-indigo-100 rounded-full transition-colors"
                        title="시뮬레이션 결과 초기화"
                    >
                        <RotateCcw className="w-5 h-5" />
                    </button>

                    <div className="flex flex-col sm:flex-row gap-3 w-full md:w-auto">
                        <button
                            onClick={runExemptionStrategy}
                            className="bg-white border border-indigo-200 text-indigo-700 px-4 py-2 rounded-md hover:bg-indigo-100 font-medium text-sm flex items-center justify-center gap-2 shadow-sm"
                        >
                            <TrendingUp className="w-4 h-4" />
                            비과세 한도 채우기
                        </button>

                        <div className="flex items-center gap-2 bg-white border border-indigo-200 rounded-md px-2 py-1 shadow-sm">
                            <input
                                type="number"
                                placeholder="목표 금액(원)"
                                className="w-32 px-2 py-1 text-sm outline-none bg-transparent"
                                value={targetAmount || ''}
                                onChange={e => setTargetAmount(Number(e.target.value))}
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter') runTargetStrategy();
                                }}
                            />
                            <button
                                onClick={runTargetStrategy}
                                className="bg-indigo-600 text-white px-3 py-1.5 rounded text-sm font-bold hover:bg-indigo-700"
                            >
                                계산
                            </button>
                        </div>
                    </div>
                </div>

                {/* 3. Results Table */}
                <div className="flex-1 bg-white rounded-lg border border-slate-200 shadow-sm flex flex-col overflow-hidden">
                    <div className="p-4 border-b border-slate-100 bg-slate-50 flex justify-between items-center">
                        <div className="flex items-center gap-3">
                            <h4 className="font-bold text-slate-700">시뮬레이션 결과</h4>
                            {simulatedPlan && (
                                <span className="text-xs bg-green-100 text-green-700 px-2 py-1 rounded-full font-bold">
                                    {simulatedPlan.strategyName}
                                </span>
                            )}
                        </div>

                        {/* Download PDF Button */}
                        {simulatedPlan && (
                            <button
                                onClick={handleDownloadReport}
                                disabled={isGeneratingReport}
                                className="text-sm flex items-center gap-1.5 text-slate-500 hover:text-indigo-600 disabled:opacity-50 transition-colors"
                            >
                                {isGeneratingReport ? (
                                    <>
                                        <Loader2 className="w-4 h-4 animate-spin" />
                                        생성중...
                                    </>
                                ) : (
                                    <>
                                        <Download className="w-4 h-4" />
                                        PDF 리포트
                                    </>
                                )}
                            </button>
                        )}
                    </div>

                    <div className="flex-1 overflow-auto p-0">
                        {!simulatedPlan ? (
                            <div className="h-full flex flex-col items-center justify-center text-slate-400 gap-2 p-10">
                                <Calculator className="w-10 h-10 opacity-20" />
                                <p>전략을 실행하면 종목별 매도 추천 내역이 여기에 표시됩니다.</p>
                            </div>
                        ) : (
                            <table className="w-full text-sm text-left">
                                <thead className="bg-white text-xs text-slate-500 border-b border-slate-200">
                                    <tr>
                                        <th className="px-4 py-3">종목</th>
                                        <th className="px-4 py-3 text-right">매도수량</th>
                                        <th className="px-4 py-3 text-right">매도금액(KRW)</th>
                                        <th className="px-4 py-3 text-right">예상실현이익</th>
                                        <th className="px-4 py-3 text-center">비고</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                    {simulatedPlan.items.map((item, idx) => (
                                        <tr key={idx} className="hover:bg-slate-50">
                                            <td className="px-4 py-3 font-medium text-slate-800">{item.symbol}</td>
                                            <td className="px-4 py-3 text-right text-blue-600 font-bold">{item.sellQty.toLocaleString()}주</td>
                                            <td className="px-4 py-3 text-right text-slate-600">{Math.round(item.proceedsKRW).toLocaleString()}</td>
                                            <td className={`px-4 py-3 text-right font-medium ${item.realizedGainKRW >= 0 ? 'text-red-500' : 'text-blue-500'}`}>
                                                {item.realizedGainKRW > 0 ? '+' : ''}{Math.round(item.realizedGainKRW).toLocaleString()}
                                            </td>
                                            <td className="px-4 py-3 text-center text-xs text-slate-400">
                                                {item.fxRate}원/$
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                                <tfoot className="bg-slate-50 font-bold text-slate-700 border-t border-slate-200">
                                    <tr>
                                        <td className="px-4 py-3 text-right" colSpan={2}>합계</td>
                                        <td className="px-4 py-3 text-right">{Math.round(simulatedPlan.items.reduce((sum, i) => sum + i.proceedsKRW, 0)).toLocaleString()}</td>
                                        <td className="px-4 py-3 text-right text-red-600">{Math.round(simulatedPlan.totalTaxableDetail.totalGain - realizedSummary.totalRealizedGain).toLocaleString()}</td>
                                        <td></td>
                                    </tr>
                                </tfoot>
                            </table>
                        )}
                    </div>
                    <ApiKeyModal
                        isOpen={isApiKeyModalOpen}
                        onClose={() => setIsApiKeyModalOpen(false)}
                        onSave={handleSaveApiKey}
                        initialKey={apiKey}
                    />
                </div>
            </div>
        </div>
    );
};
