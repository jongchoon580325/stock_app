import { PortfolioItem } from './usTaxEngine';

export interface SimulationResult {
    symbol: string;
    sellQty: number;
    priceUSD: number;
    fxRate: number;
    proceedsKRW: number;
    costBasisKRW: number;
    realizedGainKRW: number;
    taxEstimate: number; // 22% of (Gain - Deduction) (simplified for item-level?)
    // Actually tax is calculated on global net gain.
}

export interface StrategyPlan {
    strategyName: string;
    description: string;
    items: SimulationResult[];
    totalProceeds: number;
    totalGain: number;
    totalTaxableDetail: {
        totalGain: number;
        deduction: number;
        taxableBase: number;
        finalTax: number;
    };
}

const TAX_RATE = 0.22;
const YEARLY_DEDUCTION = 2500000;

/**
 * Strategy 1: Exemption Safe Plan
 * Recommend selling stocks to utilize the remaining annual deduction (2.5M KRW).
 * Logic: Prioritize stocks with Gains to fill the bucket.
 * NOTE: This is a simple advisor -> It suggests "Optimization Candidates".
 * Actually, to be useful, it should probably try to fill exactly 2.5M.
 * 
 * However, since the user might want to keep some stocks, we will just list
 * "How many shares of X to sell to fill the remaining limit" for EACH stock.
 * Rather than a combined portfolio mix (which is complex).
 * 
 * Wait, the requirements said "recommendations...".
 * Let's implement a mode that returns a list of "Single Stock Options".
 * E.g. "If you sell Apple only, sell N shares."
 * "If you sell Tesla only, sell M shares."
 */
export const buildExemptionSafePlan = (
    portfolio: Map<string, PortfolioItem>,
    priceMap: Map<string, number>, // Symbol -> Current Price USD
    fxRate: number,
    alreadyRealizedGain: number
): StrategyPlan => {
    const remainingLimit = Math.max(0, YEARLY_DEDUCTION - alreadyRealizedGain);
    const items: SimulationResult[] = [];

    // Check each holding
    portfolio.forEach((item) => {
        const currentPrice = priceMap.get(item.symbol) || 0;
        if (currentPrice <= 0) return;

        const currentPriceKRW = currentPrice * fxRate;
        const gainPerShare = currentPriceKRW - item.avgCostKRW;

        if (gainPerShare > 0) {
            // How many shares to sell to hit remainingLimit?
            // gainPerShare * Qty = remainingLimit
            const maxQtyToFill = Math.floor(remainingLimit / gainPerShare);
            const sellQty = Math.min(item.qty, maxQtyToFill);

            if (sellQty > 0) {
                const proceeds = sellQty * currentPriceKRW;
                const cost = sellQty * item.avgCostKRW;
                const gain = proceeds - cost;

                items.push({
                    symbol: item.symbol,
                    sellQty: sellQty,
                    priceUSD: currentPrice,
                    fxRate: fxRate,
                    proceedsKRW: proceeds,
                    costBasisKRW: cost,
                    realizedGainKRW: gain,
                    taxEstimate: 0 // Ideally 0 because we represent filling the limit
                });
            }
        }
    });

    // Strategy Plan wrapper (This is a list of independent options)
    return {
        strategyName: '비과세 한도 채우기 (단일 종목 기준)',
        description: `남은 비과세 한도(${Math.floor(remainingLimit).toLocaleString()}원)를 채우기 위해 각 종목별로 매도 가능한 수량을 계산했습니다. (종목 배분 아님)`,
        items: items, // independent items
        totalProceeds: 0, // N/A
        totalGain: 0, // N/A
        totalTaxableDetail: {
            totalGain: alreadyRealizedGain,
            deduction: Math.min(alreadyRealizedGain, YEARLY_DEDUCTION),
            taxableBase: 0,
            finalTax: 0
        }
    };
};

/**
 * Strategy 3: Target Sell Amount Plan
 * Goal: Generate target proceeds (KRW).
 * Objective: Minimize Tax -> Prioritize Low Gain (or Loss) items.
 */
export const buildTargetAmountPlan = (
    portfolio: Map<string, PortfolioItem>,
    priceMap: Map<string, number>,
    fxRate: number,
    targetAmountKRW: number,
    alreadyRealizedGain: number
): StrategyPlan => {
    const items: SimulationResult[] = [];

    // 1. Convert portfolio to 'Sellable Units' (all shares) and sort by Tax Efficiency
    // Tax Efficiency = Gain / Proceeds. Lower is better (Loss is negative).

    interface Candidate {
        symbol: string;
        priceKRW: number;
        costKRW: number;
        gainKRW: number;
        gainRatio: number; // gain / proceeds
    }

    const candidates: Candidate[] = [];

    portfolio.forEach((item) => {
        const currentPrice = priceMap.get(item.symbol) || 0;
        if (currentPrice <= 0) return;
        const priceKRW = currentPrice * fxRate;
        if (item.qty > 0) {
            candidates.push({
                symbol: item.symbol,
                priceKRW: priceKRW,
                costKRW: item.avgCostKRW,
                gainKRW: priceKRW - item.avgCostKRW,
                gainRatio: (priceKRW - item.avgCostKRW) / priceKRW
            });
        }
    });

    // 2. Sort candidates: Lowest Gain Ratio first (Loss -> Low Gain -> High Gain)
    candidates.sort((a, b) => a.gainRatio - b.gainRatio);

    // 3. Greedy Fill
    let currentProceeds = 0;
    const planMap = new Map<string, number>(); // Symbol -> SellQty

    for (const cand of candidates) {
        if (currentProceeds >= targetAmountKRW) break;

        const maxQty = portfolio.get(cand.symbol)!.qty;

        // Needed Proceeds
        const needed = targetAmountKRW - currentProceeds;

        // How many shares needed?
        const sharesNeeded = Math.ceil(needed / cand.priceKRW);
        const sellQty = Math.min(maxQty, sharesNeeded);

        planMap.set(cand.symbol, sellQty);
        currentProceeds += sellQty * cand.priceKRW;
    }

    // 4. Transform to StrategyPlan
    let totalPlanGain = 0;
    let totalPlanProceeds = 0;

    planMap.forEach((qty, symbol) => {
        const priceUSD = priceMap.get(symbol)!;
        const priceKRW = priceUSD * fxRate;
        const item = portfolio.get(symbol)!;
        const cost = qty * item.avgCostKRW;
        const gain = (priceKRW * qty) - cost;

        totalPlanGain += gain;
        totalPlanProceeds += (priceKRW * qty);

        items.push({
            symbol: symbol,
            sellQty: qty,
            priceUSD: priceUSD,
            fxRate: fxRate,
            proceedsKRW: priceKRW * qty,
            costBasisKRW: cost,
            realizedGainKRW: gain,
            taxEstimate: 0 // Calculated globally
        });
    });

    // Final Tax Calc
    const finalTotalGain = alreadyRealizedGain + totalPlanGain;
    const deduction = Math.min(finalTotalGain, YEARLY_DEDUCTION); // This logic assumes no carry-over loss? Correct, KR law.
    // Wait, deduction applies to Net Gain.
    const taxableBase = Math.max(0, finalTotalGain - YEARLY_DEDUCTION);
    const finalTax = taxableBase * TAX_RATE;

    return {
        strategyName: `목표 금액 확보 (${(targetAmountKRW / 10000).toLocaleString()}만원)`,
        description: `세금을 최소화하는 순서(손실 → 이익률 낮은 순)로 매도 종목을 주입했습니다.`,
        items: items,
        totalProceeds: totalPlanProceeds,
        totalGain: totalPlanGain,
        totalTaxableDetail: {
            totalGain: finalTotalGain,
            deduction: YEARLY_DEDUCTION, // Fixed limit
            taxableBase: taxableBase,
            finalTax: finalTax
        }
    };
};
