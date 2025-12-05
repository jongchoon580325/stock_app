import React from 'react';
import { SummaryStats, AccountType } from '../types';

interface StatsCardsProps {
  stats: SummaryStats;
  accountType: AccountType;
}

export const StatsCards: React.FC<StatsCardsProps> = ({ stats, accountType }) => {
  const formatCurrency = (num: number) => new Intl.NumberFormat('ko-KR').format(num);

  return (
    <div className="flex flex-col md:flex-row gap-0 border border-slate-300 rounded-lg overflow-hidden shadow-sm bg-white">
      {/* Taxable Distribution Total - Only for General */}
      {accountType === 'general' && (
        <div className="flex-1 flex flex-col justify-between border-b md:border-b-0 md:border-r border-slate-200">
          <div className="bg-slate-600 text-white text-sm px-3 py-1 font-medium text-center">
            과세분배금총금액
          </div>
          <div className="p-3 text-center">
            <span className="text-xl font-bold text-fuchsia-700">
              {formatCurrency(stats.totalTaxableDistribution)}
            </span>
          </div>
        </div>
      )}

      {/* Tax Total - Only for General */}
      {accountType === 'general' && (
        <div className="flex-1 flex flex-col justify-between border-b md:border-b-0 md:border-r border-slate-200">
          <div className="bg-slate-600 text-white text-sm px-3 py-1 font-medium text-center">
            과세 총 금액
          </div>
          <div className="p-3 text-center">
            <span className="text-xl font-bold text-fuchsia-700">
              {formatCurrency(stats.totalTaxAmount)}
            </span>
          </div>
        </div>
      )}

      {/* Placeholder for Empty/Spacer if needed to match screenshot exactness, but we will combine net here */}

      {/* Total Received */}
      <div className="flex-1 flex flex-col justify-between">
        <div className="bg-slate-600 text-white text-sm px-3 py-1 font-medium text-center">
          총 수령액
        </div>
        <div className="p-3 text-center">
          <span className="text-xl font-bold text-fuchsia-700">
            {formatCurrency(stats.totalReceived)}
          </span>
        </div>
      </div>
    </div>
  );
};
