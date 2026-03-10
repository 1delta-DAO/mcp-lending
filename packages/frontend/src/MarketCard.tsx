import React from 'react';

export interface Market {
  marketUid: string;
  symbol: string;
  tokenAddress?: string;
  decimals?: number;
  priceUsd?: number;
  depositRate?: number;
  variableBorrowRate?: number;
  totalDepositsUsd?: number;
  availableLiquidityUsd?: number;
  utilization?: number;
  risk?: { score: number; label: string };
}

function parseMarketUid(uid: string): { lender: string; chainId: string } {
  const parts = uid.split(':');
  return { lender: parts[0] ?? uid, chainId: parts[1] ?? '' };
}

function fPct(v?: number) {
  if (v == null) return '—';
  return v.toFixed(2) + '%';
}

function fUsd(v?: number) {
  if (v == null) return '—';
  if (v >= 1_000_000_000) return '$' + (v / 1_000_000_000).toFixed(2) + 'B';
  if (v >= 1_000_000) return '$' + (v / 1_000_000).toFixed(2) + 'M';
  if (v >= 1_000) return '$' + (v / 1_000).toFixed(2) + 'K';
  return '$' + v.toFixed(2);
}

const RISK_COLORS: Record<string, string> = {
  safe: 'text-green-600 dark:text-green-400',
  low: 'text-green-600 dark:text-green-400',
  medium: 'text-yellow-600 dark:text-yellow-400',
  elevated: 'text-orange-500 dark:text-orange-400',
  high: 'text-red-600 dark:text-red-400',
};

function MarketCard({ market }: { market: Market }) {
  const [expanded, setExpanded] = React.useState(false);
  const { lender, chainId } = parseMarketUid(market.marketUid);
  const riskColor = RISK_COLORS[market.risk?.label ?? ''] ?? 'text-gray-500';

  const rows: [string, string | undefined][] = [
    ['Market UID', market.marketUid],
    ['Token address', market.tokenAddress],
    ['Decimals', market.decimals != null ? String(market.decimals) : undefined],
    ['Price', market.priceUsd != null ? '$' + market.priceUsd.toFixed(4) : undefined],
    ['Deposit APR', fPct(market.depositRate)],
    ['Borrow APR (variable)', fPct(market.variableBorrowRate)],
    ['Total deposits', fUsd(market.totalDepositsUsd)],
    ['Available liquidity', fUsd(market.availableLiquidityUsd)],
    ['Utilization', market.utilization != null ? (market.utilization * 100).toFixed(2) + '%' : undefined],
    ['Risk', market.risk != null ? `${market.risk.label} (${market.risk.score}/5)` : undefined],
  ];

  return (
    <div className="rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden text-xs">
      <button
        onClick={() => setExpanded(v => !v)}
        className="w-full flex items-center gap-2 px-3 py-2 bg-gray-50 dark:bg-gray-900 hover:bg-gray-100 dark:hover:bg-gray-800 transition text-left"
      >
        <span className="font-semibold text-gray-900 dark:text-gray-100 flex-shrink-0">{market.symbol}</span>
        <span className="text-gray-400 dark:text-gray-600">·</span>
        <span
          className="text-gray-600 dark:text-gray-400 flex-shrink-0 max-w-[12rem] truncate"
          title={lender}
        >{lender}</span>
        <span className="text-gray-400 dark:text-gray-600">·</span>
        <span className="text-gray-500 dark:text-gray-500 flex-shrink-0">Chain {chainId}</span>
        <span className="flex-1" />
        <span className="font-mono text-green-600 dark:text-green-400 flex-shrink-0">{fPct(market.depositRate)} dep</span>
        <span className="text-gray-300 dark:text-gray-600">·</span>
        <span className="font-mono text-red-500 dark:text-red-400 flex-shrink-0">{fPct(market.variableBorrowRate)} borrow</span>
        {market.risk && (
          <>
            <span className="text-gray-300 dark:text-gray-600">·</span>
            <span className={`font-medium flex-shrink-0 ${riskColor}`}>{market.risk.label} risk</span>
          </>
        )}
        <svg
          className={`w-3.5 h-3.5 text-gray-400 transition-transform flex-shrink-0 ml-1 ${expanded ? 'rotate-180' : ''}`}
          fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {expanded && (
        <table className="w-full bg-white dark:bg-gray-800 divide-y divide-gray-100 dark:divide-gray-700">
          <tbody>
            {rows.filter(([, v]) => v != null).map(([label, value]) => (
              <tr key={label} className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                <td className="px-3 py-1 text-gray-500 dark:text-gray-400 w-36 flex-shrink-0">{label}</td>
                <td className="px-3 py-1 font-mono text-gray-900 dark:text-gray-100 break-all">{value}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

export function MarketList({ markets }: { markets: Market[] }) {
  if (markets.length === 0) return null;
  return (
    <div className="mt-3 space-y-1.5">
      {markets.map(m => (
        <MarketCard key={m.marketUid} market={m} />
      ))}
    </div>
  );
}
