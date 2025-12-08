import { AssetRecord } from '../types';

export interface RealizedGainDetail {
    year: number;
    symbol: string;
    tradeDate: string;
    sellQty: number;
    sellPriceUSD: number;
    exchangeRate: number;
    sellAmountKRW: number;
    costBasisKRW: number; // Avg Cost at time of sell
    realizedGainKRW: number;
}

export interface RealizedGainByYear {
    year: number;
    totalRealizedGain: number;
    totalSellAmount: number;
    trades: RealizedGainDetail[];
}

/**
 * Calculates Realized Gain for US Stocks using Weighted Average Cost method.
 * All amounts are in KRW.
 */
export const calculateRealizedGainByYear = (records: AssetRecord[]): RealizedGainByYear[] => {
    // 1. Filter US Stocks & Sort by Date (Past -> Future)
    // EXCEPTION: Exclude '외화-RP' (Foreign Currency RP) from tax calculations
    const usRecords = records
        .filter(r => r.country === 'USA' && r.name !== '외화-RP')
        .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

    // 2. Track Inventory per Symbol
    // Key: Symbol, Value: { qty, totalCostKRW }
    const inventory = new Map<string, { qty: number; totalCostKRW: number }>();
    const realizedGains: RealizedGainDetail[] = [];

    // 3. Process Transactions
    usRecords.forEach(r => {
        const symbol = r.name;
        if (!inventory.has(symbol)) {
            inventory.set(symbol, { qty: 0, totalCostKRW: 0 });
        }
        const pos = inventory.get(symbol)!;

        // Ensure exchange rate defaults to 0 if missing (should be caught by health check, but safe coding)
        const fx = r.exchangeRate || 0;

        if (r.tradeType === '매수') {
            // BUY: Add to Inventory
            const amountKRW = r.amount * fx; // (Price * Qty) * Fx (Wait, r.amount is Price*Qty in USD for US stock?)
            // Actually, in AssetFormModal: amount = price * quantity. So it is in USD.

            // Correction: For US stock, r.amount is in USD. We need to convert to KRW.
            const buyAmountUSD = r.amount;
            const buyCostKRW = buyAmountUSD * fx;

            pos.qty += r.quantity;
            pos.totalCostKRW += buyCostKRW;

        } else if (r.tradeType === '매도') {
            // SELL: Calculate Gain
            if (pos.qty <= 0) {
                // Selling without holding? Skip or handle error. 
                // For simulator, we assume data integrity.
                return;
            }

            // Weighted Average Cost per Share (KRW)
            const avgCostPerShareKRW = pos.totalCostKRW / pos.qty;

            // Cost Basis for this Sell
            const sellCostBasisKRW = avgCostPerShareKRW * r.quantity;

            // Sell Proceeds (KRW)
            // r.sellAmount is USD.
            const sellProceedsUSD = r.sellAmount || (r.price * r.quantity);
            const sellProceedsKRW = sellProceedsUSD * fx;

            // Realized Gain
            const gainKRW = sellProceedsKRW - sellCostBasisKRW;

            // Record Gain
            realizedGains.push({
                year: new Date(r.date).getFullYear(),
                symbol: symbol,
                tradeDate: r.date,
                sellQty: r.quantity,
                sellPriceUSD: r.price,
                exchangeRate: fx,
                sellAmountKRW: sellProceedsKRW,
                costBasisKRW: sellCostBasisKRW, // Total Cost Basis for this chunk
                realizedGainKRW: gainKRW
            });

            // Update Inventory
            pos.qty -= r.quantity;
            pos.totalCostKRW -= sellCostBasisKRW;

            // Floating point safety clamp
            if (pos.qty < 1e-9) {
                pos.qty = 0;
                pos.totalCostKRW = 0;
            }
        }
    });

    // 4. Group by Year
    const gainsByYear = new Map<number, RealizedGainByYear>();

    realizedGains.forEach(gain => {
        if (!gainsByYear.has(gain.year)) {
            gainsByYear.set(gain.year, {
                year: gain.year,
                totalRealizedGain: 0,
                totalSellAmount: 0,
                trades: []
            });
        }
        const yearGroup = gainsByYear.get(gain.year)!;
        yearGroup.trades.push(gain);
        yearGroup.totalRealizedGain += gain.realizedGainKRW;
        yearGroup.totalSellAmount += gain.sellAmountKRW;
    });

    // 5. Convert to Array and Sort by Year Descending
    return Array.from(gainsByYear.values()).sort((a, b) => b.year - a.year);
};

export interface PortfolioItem {
    symbol: string;
    qty: number;
    totalCostKRW: number;
    avgCostKRW: number;
}

/**
 * Calculates the current portfolio state (Inventory) based on transaction history.
 * Returns map of Symbol -> PortfolioItem
 */
export const calculateCurrentPortfolio = (records: AssetRecord[]): Map<string, PortfolioItem> => {
    // 1. Filter US Stocks & Sort by Date
    // EXCEPTION: Exclude '외화-RP' (Foreign Currency RP) from simulator inventory
    const usRecords = records
        .filter(r => r.country === 'USA' && r.name !== '외화-RP')
        .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

    // 2. Track Inventory
    const inventory = new Map<string, PortfolioItem>();

    usRecords.forEach(r => {
        const symbol = r.name;
        if (!inventory.has(symbol)) {
            inventory.set(symbol, { symbol, qty: 0, totalCostKRW: 0, avgCostKRW: 0 });
        }
        const pos = inventory.get(symbol)!;
        const fx = r.exchangeRate || 0;

        if (r.tradeType === '매수') {
            const buyCostKRW = r.amount * fx; // r.amount is USD for US stocks
            pos.qty += r.quantity;
            pos.totalCostKRW += buyCostKRW;
        } else if (r.tradeType === '매도') {
            if (pos.qty > 0) {
                // Weighted Avg Cost Logic
                const avgCost = pos.totalCostKRW / pos.qty;
                const costOfSell = avgCost * r.quantity;

                pos.qty -= r.quantity;
                pos.totalCostKRW -= costOfSell;
            }
            if (pos.qty < 1e-9) {
                pos.qty = 0;
                pos.totalCostKRW = 0;
            }
        }

        // Update Avg Cost
        pos.avgCostKRW = pos.qty > 0 ? pos.totalCostKRW / pos.qty : 0;
    });

    // Remove empty positions
    for (const [key, val] of inventory) {
        if (val.qty <= 0) inventory.delete(key);
    }

    return inventory;
};
