import { GoogleGenAI } from "@google/genai";
import { DividendRecord } from "../types";

const createClient = () => {
  const apiKey = import.meta.env.VITE_API_KEY;
  if (!apiKey) {
    console.warn("API_KEY not found in environment variables.");
    return null;
  }
  return new GoogleGenAI({ apiKey });
};

export const analyzePortfolio = async (records: DividendRecord[]): Promise<string> => {
  const ai = createClient();
  if (!ai) {
    return "API Key is missing. Please configure your environment to use AI features.";
  }

  const dataContext = JSON.stringify(records, null, 2);

  const prompt = `
    You are a professional financial analyst specializing in Korean Stock Market dividends and ETFs.
    
    Here is a JSON dataset representing a user's "General Dividend Account Distribution Status" (일반배당계좌 분배금 현황).
    The columns are:
    - Stock Name (종목명)
    - Date (거래일)
    - Quantity (수량)
    - Dividend Amount (분배금)
    - Tax details (Taxable amount, tax amount)

    Dataset:
    ${dataContext}

    Please provide a concise analysis in Korean (Hangul) covering:
    1. **Monthly Income Trend**: Is the income increasing or decreasing?
    2. **Portfolio Efficiency**: Which stock provides better consistency?
    3. **Tax Note**: Brief comment on the tax burden based on the data.
    4. **Recommendation**: One simple sentence on what to watch out for.

    Keep the tone professional yet encouraging.
  `;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
    });
    return response.text || "분석을 완료할 수 없습니다.";
  } catch (error) {
    console.error("Gemini Analysis Error:", error);
    return "AI 분석 중 오류가 발생했습니다. 잠시 후 다시 시도해주세요.";
  }
};
