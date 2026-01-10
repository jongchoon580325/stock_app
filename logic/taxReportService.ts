import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { StrategyPlan } from './taxStrategyService';
import { RealizedGainByYear, calculateHoldingsByAccount } from './usTaxEngine';
import { AssetRecord } from '../types';

// Extend jsPDF type to include autoTable
interface jsPDFWithAutoTable extends jsPDF {
    lastAutoTable: { finalY: number };
}

/**
 * Fetches Noto Sans KR font from a CDN and adds it to the PDF document.
 * Returns true if successful, false otherwise.
 */
const loadKoreanFont = async (doc: jsPDF): Promise<boolean> => {
    try {
        // Google Fonts via GitHub Raw (Canonical Source) - Verified HTTP 200 & CORS
        const fontUrl = 'https://raw.githubusercontent.com/google/fonts/main/ofl/nanumgothic/NanumGothic-Regular.ttf';

        console.log(`Fetching font from verified source: ${fontUrl}`);
        const response = await fetch(fontUrl);
        if (!response.ok) {
            throw new Error(`Failed to fetch font: ${response.status} ${response.statusText}`);
        }

        const blob = await response.blob();
        const reader = new FileReader();

        return new Promise((resolve) => {
            reader.onloadend = () => {
                const base64data = reader.result as string;
                // Google Fonts might return binary, FileReader reads as data:application/octet-stream;base64,... or similar
                // We need to carefully split strictly at the comma.
                const base64Content = base64data.split(',')[1];

                if (!base64Content) {
                    console.error('Base64 extraction failed', base64data.substring(0, 50));
                    resolve(false);
                    return;
                }

                // Use a simpler name
                doc.addFileToVFS('NanumGothic.ttf', base64Content);
                doc.addFont('NanumGothic.ttf', 'NanumGothic', 'normal');
                // Register the SAME font as 'bold' to prevent fallback to Helvetica in table headers
                doc.addFont('NanumGothic.ttf', 'NanumGothic', 'bold');

                doc.setFont('NanumGothic');
                console.log('Korean font (NanumGothic) loaded successfully (Normal & Bold mapped)');
                resolve(true);
            };
            reader.readAsDataURL(blob);
        });
    } catch (e) {
        console.error('Failed to load Korean font details:', e);
        return false;
    }
};

export const generateTaxReport = async (
    plan: StrategyPlan,
    yearSummary: RealizedGainByYear,
    allRecords: AssetRecord[], // New argument for account lookup
    startLoading: () => void,
    endLoading: () => void
) => {
    startLoading();

    try {
        const doc = new jsPDF() as jsPDFWithAutoTable;

        // 1. Load Font
        const fontLoaded = await loadKoreanFont(doc);
        if (!fontLoaded) {
            alert("한글 폰트 로드에 실패하여 PDF에 한글이 깨질 수 있습니다.");
        }

        const pageWidth = doc.internal.pageSize.getWidth();
        const today = new Date().toISOString().split('T')[0];

        // 2. Title
        doc.setFontSize(22);
        doc.text('미국주식 절세 전략 리포트', pageWidth / 2, 20, { align: 'center' });

        doc.setFontSize(10);
        doc.setTextColor(100);
        doc.text(`생성일: ${today}`, pageWidth - 15, 30, { align: 'right' });
        doc.setTextColor(0);

        // 3. Executive Summary
        let currentY = 40;
        doc.setFontSize(14);
        doc.text('1. 요약 (Executive Summary)', 15, currentY);
        currentY += 10;

        doc.setFontSize(11);
        doc.text(`• 현재 확정된 실현 수익 (올해): ${Math.round(yearSummary.totalRealizedGain).toLocaleString()}원`, 20, currentY);
        currentY += 7;

        const remainingLimit = Math.max(0, 2500000 - yearSummary.totalRealizedGain);
        doc.text(`• 남은 비과세 한도: ${Math.round(remainingLimit).toLocaleString()}원`, 20, currentY);
        currentY += 7;

        doc.text(`• 시뮬레이션 예상 세금: ${Math.round(plan.totalTaxableDetail.finalTax).toLocaleString()}원`, 20, currentY);
        currentY += 15;

        // 4. Strategy Details
        doc.setFontSize(14);
        doc.text('2. 선택된 전략 (Selected Strategy)', 15, currentY);
        currentY += 10;

        doc.setFontSize(12);
        doc.setTextColor(0, 0, 139); // Dark Blue
        doc.text(`[${plan.strategyName}]`, 20, currentY);
        doc.setTextColor(0);
        currentY += 8;

        doc.setFontSize(10);
        // Split long description text
        const splitDescription = doc.splitTextToSize(`설명: ${plan.description}`, pageWidth - 40);
        doc.text(splitDescription, 20, currentY);
        currentY += (splitDescription.length * 5) + 5;

        // 5. Action Plan Table
        doc.setFontSize(14);
        doc.text('3. 매도 추천 내역 (Action Plan)', 15, currentY);

        // Add Estimated Tax Display (Right aligned or center)
        if (plan.totalTaxableDetail.finalTax > 0) {
            doc.setFontSize(12);
            doc.setTextColor(220, 38, 38); // Red color
            const taxText = `예상 양도세: ${Math.round(plan.totalTaxableDetail.finalTax).toLocaleString()} 원`;
            doc.text(taxText, pageWidth - 15, currentY, { align: 'right' });
            doc.setTextColor(0);
        }

        currentY += 5;

        // 1. Get Current Holdings Snapshot by Account
        const holdingsByAccount = calculateHoldingsByAccount(allRecords);

        const tableBody = plan.items.map(item => {
            // Logic: Distribute 'item.sellQty' among accounts holding this symbol
            const symbolHoldings = holdingsByAccount.get(item.symbol);
            let accountDisplay = '-';

            if (symbolHoldings && symbolHoldings.size > 0) {
                let remainingSellQty = item.sellQty;
                const allocations: string[] = [];

                // Sort accounts by quantity descending (Prioritize selling from large buckets)
                // Or just stable sort by account name
                const sortedAccounts = Array.from(symbolHoldings.entries())
                    .sort((a, b) => b[1] - a[1]); // Descending Qty

                for (const [acct, heldQty] of sortedAccounts) {
                    if (remainingSellQty <= 0) break;

                    const take = Math.min(heldQty, remainingSellQty);
                    allocations.push(`${acct}(${take.toLocaleString()}주)`);
                    remainingSellQty -= take;
                }

                // Fallback if needed
                if (remainingSellQty > 0) {
                    // allocations.push(`미상세(${remainingSellQty}주)`);
                }

                accountDisplay = allocations.join(', ');
            } else {
                accountDisplay = '-';
            }

            return [
                item.symbol,
                accountDisplay, // Display "Account(Qty)"
                `${item.sellQty.toLocaleString()}주`,
                `${Math.round(item.proceedsKRW).toLocaleString()}`,
                `${Math.round(item.realizedGainKRW).toLocaleString()}`,
                `${item.fxRate}`
            ];
        });

        // Add Summary Row
        const totalProceeds = plan.items.reduce((sum, i) => sum + i.proceedsKRW, 0);
        const totalGain = plan.totalTaxableDetail.totalGain - yearSummary.totalRealizedGain;
        tableBody.push(['합계', '-', '-', `${Math.round(totalProceeds).toLocaleString()}`, `${Math.round(totalGain).toLocaleString()}`, '-']);

        autoTable(doc, {
            startY: currentY,
            head: [['종목', '계좌번호', '매도수량', '매도금액(KRW)', '예상실현이익', '적용환율']],
            body: tableBody,
            styles: { font: fontLoaded ? 'NanumGothic' : 'helvetica', fontSize: 10 },
            headStyles: { fillColor: [66, 66, 66] },
            footStyles: { fillColor: [240, 240, 240], textColor: [0, 0, 0], fontStyle: 'bold' },
            theme: 'grid',
            columnStyles: {
                0: { cellWidth: 35 }, // Symbol
                1: { cellWidth: 50 }, // Account Number (Allocated more space)
                // Auto for others
            }
        });

        const finalY = (doc as any).lastAutoTable.finalY || currentY;

        // 6. Disclaimer
        doc.setFontSize(8);
        doc.setTextColor(150);
        const disclaimer = "면책 조항: 본 리포트는 시뮬레이션 결과일 뿐이며, 실제 과세 결과와 다를 수 있습니다. 정확한 세금 신고를 위해서는 전문가와 상담하시기 바랍니다.";
        doc.text(disclaimer, pageWidth / 2, finalY + 20, { align: 'center' });

        // Save
        doc.save(`${today}-tax_report.pdf`);

    } catch (error) {
        console.error("PDF Generation Error", error);
        alert("리포트 생성 중 오류가 발생했습니다.");
    } finally {
        endLoading();
    }
};
