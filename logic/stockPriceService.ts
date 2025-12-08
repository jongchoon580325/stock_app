/**
 * Service to fetch real-time stock prices.
 * Currently supports Finnhub.io free API.
 */

interface FinnhubQuote {
    c: number; // Current price
    d: number; // Change
    dp: number; // Percent change
    h: number; // High
    l: number; // Low
    o: number; // Open
    pc: number; // Previous close
    t: number; // Timestamp
}

/**
 * Fetches the current price for a single symbol from Finnhub.
 * @param symbol Stock Symbol (e.g. AAPL)
 * @param apiKey Finnhub API Key
 * @returns Current Price (c) or null if failed
 */
export const fetchFinnhubPrice = async (symbol: string, apiKey: string): Promise<number | null> => {
    try {
        // Clean symbol (remove hangul description if present, e.g. "SMH-반도체" -> "SMH")
        // Assumes symbol format is "TICKER" or "TICKER-DESC"
        const cleanSymbol = symbol.split('-')[0].trim();

        const response = await fetch(`https://finnhub.io/api/v1/quote?symbol=${cleanSymbol}&token=${apiKey}`);

        if (!response.ok) {
            throw new Error(`API Error: ${response.status}`);
        }

        const data: FinnhubQuote = await response.json();

        // Finnhub returns 0 for 'c' if symbol is invalid usually, but let's check.
        if (data.c === 0 && data.pc === 0) {
            console.warn(`Symbol ${cleanSymbol} might be invalid or no data.`);
            return null;
        }

        return data.c;
    } catch (error) {
        console.error(`Failed to fetch price for ${symbol}:`, error);
        return null;
    }
};

/**
 * Fetches prices for multiple symbols.
 * Finnhub Free Tier Limit: 60 calls/minute (1 per second roughly, actually burstable but be careful).
 * We will process them nicely.
 */
export const fetchBatchPrices = async (
    symbols: string[],
    apiKey: string,
    onProgress?: (current: number, total: number) => void
): Promise<Map<string, number>> => {
    const results = new Map<string, number>();
    let processed = 0;

    // Parallel execution? Finnhub limit is 30 calls/sec.
    // If user has < 30 stocks, Promise.all is reasonably safe.
    // If more, we might need chunking. Assuming < 20 usually.

    const promises = symbols.map(async (sym) => {
        const price = await fetchFinnhubPrice(sym, apiKey);
        if (price !== null) {
            results.set(sym, price);
        }
        processed++;
        if (onProgress) onProgress(processed, symbols.length);
    });

    await Promise.all(promises);
    return results;
};
