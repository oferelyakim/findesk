import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip as ReTooltip, ResponsiveContainer,
  LineChart, Line, CartesianGrid, Legend,
} from 'recharts';
import { RefreshCw, Download, X, TrendingUp, TrendingDown, Activity, Search } from 'lucide-react';
import * as XLSX from 'xlsx';
import { fetchSP500Constituents, fetchHistoricalPrices, daysAgo, today } from '@/lib/api';
import { computeWeightDeltas, fmtPct, fmtMillions } from '@/lib/calculations';
import type { SP500Constituent } from '@/types';

// ── helpers ──────────────────────────────────────────────────────────────────

function DeltaPill({ bps }: { bps: number | null }) {
  if (bps === null) return <span style={{ color: 'var(--muted)' }}>—</span>;
  const color = bps > 0 ? 'var(--green)' : bps < 0 ? 'var(--red)' : 'var(--muted)';
  const bg   = bps > 0 ? 'rgba(34,197,94,0.12)' : bps < 0 ? 'rgba(239,68,68,0.12)' : 'rgba(255,255,255,0.06)';
  return (
    <span className="px-2 py-0.5 rounded-full text-xs font-medium" style={{ color, background: bg }}>
      {bps > 0 ? '+' : ''}{bps.toFixed(1)} bps
    </span>
  );
}

function KpiCard({ label, value, sub }: { label: string; value: string | number; sub?: string }) {
  return (
    <div className="rounded-xl p-4" style={{ background: 'var(--card)', border: '1px solid var(--border)' }}>
      <div className="text-xs mb-1" style={{ color: 'var(--muted)' }}>{label}</div>
      <div className="text-xl font-bold">{value}</div>
      {sub && <div className="text-xs mt-0.5" style={{ color: 'var(--muted)' }}>{sub}</div>}
    </div>
  );
}

// ── Drill-down modal ──────────────────────────────────────────────────────────

function DrillModal({ constituent, onClose }: { constituent: SP500Constituent; onClose: () => void }) {
  const { data: prices, isLoading } = useQuery({
    queryKey: ['price-history', constituent.symbol],
    queryFn: () => fetchHistoricalPrices(constituent.symbol, daysAgo(30), today()),
    staleTime: 5 * 60 * 1000,
  });

  const chartData = useMemo(() => {
    if (!prices) return [];
    return Object.entries(prices)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, bar]) => ({ date: date.slice(5), close: (bar as { c: number }).c }));
  }, [prices]);

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.7)' }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        className="w-full max-w-2xl rounded-2xl p-6"
        style={{ background: 'var(--card)', border: '1px solid var(--border)' }}
      >
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-lg font-bold">{constituent.symbol}</h2>
            <p className="text-sm" style={{ color: 'var(--muted)' }}>{constituent.name}</p>
          </div>
          <button onClick={onClose} style={{ color: 'var(--muted)', background: 'none', border: 'none', cursor: 'pointer' }}>
            <X size={20} />
          </button>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-3 mb-5">
          <div className="rounded-lg p-3 text-center" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
            <div className="text-xs mb-1" style={{ color: 'var(--muted)' }}>Index Weight</div>
            <div className="font-semibold">{fmtPct(constituent.weight, 2)}</div>
          </div>
          <div className="rounded-lg p-3 text-center" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
            <div className="text-xs mb-1" style={{ color: 'var(--muted)' }}>Weight Δ</div>
            <DeltaPill bps={constituent.weightDeltaBps ?? null} />
          </div>
          <div className="rounded-lg p-3 text-center" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
            <div className="text-xs mb-1" style={{ color: 'var(--muted)' }}>1-Day Price</div>
            <span style={{ color: constituent.changesPercentage >= 0 ? 'var(--green)' : 'var(--red)', fontWeight: 600 }}>
              {constituent.changesPercentage >= 0 ? '+' : ''}{fmtPct(constituent.changesPercentage / 100, 2)}
            </span>
          </div>
        </div>

        {/* Price chart */}
        <div className="text-sm font-medium mb-3">30-Day Price History</div>
        {isLoading ? (
          <div className="h-48 flex items-center justify-center skeleton rounded-lg" />
        ) : chartData.length > 0 ? (
          <ResponsiveContainer width="100%" height={200}>
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
              <XAxis dataKey="date" tick={{ fontSize: 10, fill: 'var(--muted)' }} />
              <YAxis domain={['auto', 'auto']} tick={{ fontSize: 10, fill: 'var(--muted)' }} tickFormatter={(v) => `$${v.toFixed(0)}`} />
              <ReTooltip
                contentStyle={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8 }}
                formatter={(v: number) => [`$${v.toFixed(2)}`, 'Close']}
              />
              <Line type="monotone" dataKey="close" stroke="var(--accent)" strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        ) : (
          <div className="h-48 flex items-center justify-center text-sm" style={{ color: 'var(--muted)' }}>
            No price data available
          </div>
        )}
      </div>
    </div>
  );
}

// ── Main tab ──────────────────────────────────────────────────────────────────

type ChartMode = 'delta' | 'price1d' | 'weight';

export default function SP500Tab() {
  const [sortBy, setSortBy] = useState<keyof SP500Constituent | 'weightDeltaBps'>('weightDeltaBps');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');
  const [search, setSearch] = useState('');
  const [chartMode, setChartMode] = useState<ChartMode>('delta');
  const [drillTarget, setDrillTarget] = useState<SP500Constituent | null>(null);

  const { data: raw, isLoading, isFetching, refetch } = useQuery({
    queryKey: ['sp500-constituents'],
    queryFn: async () => {
      const raw = await fetchSP500Constituents();
      return computeWeightDeltas(raw);
    },
    staleTime: 5 * 60 * 1000,
  });

  const constituents = raw ?? [];

  // KPI calculations
  const kpis = useMemo(() => {
    if (!constituents.length) return null;
    const gainers = constituents.filter((c) => (c.weightDeltaBps ?? 0) > 0);
    const losers  = constituents.filter((c) => (c.weightDeltaBps ?? 0) < 0);
    const sorted  = [...constituents].sort((a, b) => Math.abs(b.weightDeltaBps ?? 0) - Math.abs(a.weightDeltaBps ?? 0));
    return {
      total: constituents.length,
      gainers: gainers.length,
      losers: losers.length,
      topGainer: sorted.find((c) => (c.weightDeltaBps ?? 0) > 0),
      topLoser:  sorted.find((c) => (c.weightDeltaBps ?? 0) < 0),
      totalChurn: sorted.reduce((s, c) => s + Math.abs(c.weightDeltaBps ?? 0), 0),
    };
  }, [constituents]);

  // Chart data — top 15 by abs weight delta
  const chartData = useMemo(() => {
    return [...constituents]
      .filter((c) => c.weightDeltaBps !== undefined)
      .sort((a, b) => Math.abs(b.weightDeltaBps ?? 0) - Math.abs(a.weightDeltaBps ?? 0))
      .slice(0, 15)
      .map((c) => ({
        name: c.symbol,
        value:
          chartMode === 'delta'   ? (c.weightDeltaBps ?? 0) :
          chartMode === 'price1d' ? (c.changesPercentage ?? 0) :
          (c.weight ?? 0),
        fill:
          chartMode === 'delta'   ? ((c.weightDeltaBps ?? 0) >= 0 ? '#22c55e' : '#ef4444') :
          chartMode === 'price1d' ? ((c.changesPercentage ?? 0) >= 0 ? '#22c55e' : '#ef4444') :
          '#6366f1',
      }));
  }, [constituents, chartMode]);

  // Filtered/sorted table
  const tableData = useMemo(() => {
    let rows = constituents.filter((c) =>
      !search ||
      c.symbol.toLowerCase().includes(search.toLowerCase()) ||
      c.name.toLowerCase().includes(search.toLowerCase())
    );
    rows = [...rows].sort((a, b) => {
      const av = (a as Record<string, unknown>)[sortBy] as number ?? 0;
      const bv = (b as Record<string, unknown>)[sortBy] as number ?? 0;
      return sortDir === 'desc' ? bv - av : av - bv;
    });
    return rows;
  }, [constituents, search, sortBy, sortDir]);

  const handleSort = (col: typeof sortBy) => {
    if (col === sortBy) setSortDir((d) => (d === 'desc' ? 'asc' : 'desc'));
    else { setSortBy(col); setSortDir('desc'); }
  };

  const exportCSV = () => {
    const rows = tableData.map((c, i) => ({
      Rank: i + 1, Ticker: c.symbol, Company: c.name,
      'Weight %': c.weight?.toFixed(4) ?? '',
      'Δ bps': c.weightDeltaBps?.toFixed(1) ?? '',
      'Price ($)': c.price ?? '',
      '1-Day %': c.changesPercentage?.toFixed(2) ?? '',
    }));
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'SP500');
    XLSX.writeFile(wb, 'sp500-weight-changes.xlsx');
  };

  const thStyle = (col: typeof sortBy) => ({
    cursor: 'pointer',
    userSelect: 'none' as const,
    color: sortBy === col ? 'var(--accent)' : 'var(--muted)',
    whiteSpace: 'nowrap' as const,
    padding: '10px 12px',
    fontSize: 12,
    fontWeight: 500,
    textAlign: 'left' as const,
    background: 'var(--surface)',
  });

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="h-20 rounded-xl skeleton" />
          ))}
        </div>
        <div className="h-72 rounded-xl skeleton" />
        <div className="h-64 rounded-xl skeleton" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* ── Header row ── */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-bold">S&P 500 Weight Changes</h1>
          <p className="text-sm" style={{ color: 'var(--muted)' }}>Daily weight shift per constituent in basis points</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => refetch()}
            disabled={isFetching}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm transition-colors"
            style={{ background: 'var(--card)', border: '1px solid var(--border)', color: isFetching ? 'var(--muted)' : 'var(--text)' }}
          >
            <RefreshCw size={14} className={isFetching ? 'animate-spin' : ''} />
            Refresh
          </button>
          <button
            onClick={exportCSV}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm"
            style={{ background: 'var(--accent)', color: '#fff' }}
          >
            <Download size={14} />
            Export Excel
          </button>
        </div>
      </div>

      {/* ── KPI cards ── */}
      {kpis && (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          <KpiCard label="Constituents" value={kpis.total} />
          <KpiCard label="Gainers (weight)" value={kpis.gainers} sub="positive bps" />
          <KpiCard label="Losers (weight)" value={kpis.losers} sub="negative bps" />
          <KpiCard
            label="Top Gainer"
            value={kpis.topGainer?.symbol ?? '—'}
            sub={kpis.topGainer ? `+${kpis.topGainer.weightDeltaBps?.toFixed(1)} bps` : ''}
          />
          <KpiCard
            label="Top Loser"
            value={kpis.topLoser?.symbol ?? '—'}
            sub={kpis.topLoser ? `${kpis.topLoser.weightDeltaBps?.toFixed(1)} bps` : ''}
          />
        </div>
      )}

      {/* ── Bar chart ── */}
      <div className="rounded-xl p-5" style={{ background: 'var(--card)', border: '1px solid var(--border)' }}>
        <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
          <h2 className="font-semibold">Top 15 Movers</h2>
          <div className="flex gap-1">
            {(['delta', 'price1d', 'weight'] as ChartMode[]).map((mode) => (
              <button
                key={mode}
                onClick={() => setChartMode(mode)}
                className="px-3 py-1 rounded-lg text-xs font-medium"
                style={{
                  background: chartMode === mode ? 'var(--accent)' : 'var(--surface)',
                  color: chartMode === mode ? '#fff' : 'var(--muted)',
                  border: '1px solid var(--border)',
                }}
              >
                {mode === 'delta' ? 'Weight Δ bps' : mode === 'price1d' ? '1-Day %' : 'Weight %'}
              </button>
            ))}
          </div>
        </div>
        <ResponsiveContainer width="100%" height={260}>
          <BarChart data={chartData} layout="horizontal">
            <XAxis dataKey="name" tick={{ fontSize: 11, fill: 'var(--muted)' }} />
            <YAxis tick={{ fontSize: 11, fill: 'var(--muted)' }} />
            <ReTooltip
              contentStyle={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8 }}
              formatter={(v: number) =>
                chartMode === 'delta' ? [`${v.toFixed(2)} bps`, 'Weight Δ'] :
                chartMode === 'price1d' ? [`${v.toFixed(2)}%`, '1-Day'] :
                [`${v.toFixed(4)}%`, 'Weight']
              }
            />
            <Bar dataKey="value" isAnimationActive={false}>
              {chartData.map((entry, index) => (
                <rect key={index} fill={entry.fill} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* ── Table ── */}
      <div className="rounded-xl overflow-hidden" style={{ background: 'var(--card)', border: '1px solid var(--border)' }}>
        <div className="flex items-center justify-between p-4" style={{ borderBottom: '1px solid var(--border)' }}>
          <h2 className="font-semibold">All Constituents</h2>
          <div className="relative">
            <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2" style={{ color: 'var(--muted)' }} />
            <input
              type="text"
              placeholder="Search ticker or name…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-8 py-1.5 text-sm"
              style={{ width: 200 }}
            />
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr>
                <th style={thStyle('symbol')}>#</th>
                <th style={thStyle('symbol')} onClick={() => handleSort('symbol')}>Ticker {sortBy === 'symbol' ? (sortDir === 'desc' ? '▼' : '▲') : ''}</th>
                <th style={{ ...thStyle('symbol'), minWidth: 180 }}>Company</th>
                <th style={thStyle('weight')} onClick={() => handleSort('weight')}>Weight% {sortBy === 'weight' ? (sortDir === 'desc' ? '▼' : '▲') : ''}</th>
                <th style={thStyle('weightDeltaBps')} onClick={() => handleSort('weightDeltaBps')}>Δ bps {sortBy === 'weightDeltaBps' ? (sortDir === 'desc' ? '▼' : '▲') : ''}</th>
                <th style={thStyle('price')} onClick={() => handleSort('price')}>Price {sortBy === 'price' ? (sortDir === 'desc' ? '▼' : '▲') : ''}</th>
                <th style={thStyle('changesPercentage')} onClick={() => handleSort('changesPercentage')}>1-Day% {sortBy === 'changesPercentage' ? (sortDir === 'desc' ? '▼' : '▲') : ''}</th>
                <th style={{ ...thStyle('symbol'), textAlign: 'center' }}>Detail</th>
              </tr>
            </thead>
            <tbody>
              {tableData.map((c, i) => (
                <tr
                  key={c.symbol}
                  style={{ borderTop: '1px solid var(--border)' }}
                  className="hover:brightness-110 transition-all"
                >
                  <td className="px-3 py-2.5 text-xs" style={{ color: 'var(--muted)' }}>{i + 1}</td>
                  <td className="px-3 py-2.5 font-semibold" style={{ color: 'var(--accent)' }}>{c.symbol}</td>
                  <td className="px-3 py-2.5" style={{ color: 'var(--text)', maxWidth: 240, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.name}</td>
                  <td className="px-3 py-2.5 text-right">{c.weight?.toFixed(4) ?? '—'}%</td>
                  <td className="px-3 py-2.5 text-right"><DeltaPill bps={c.weightDeltaBps ?? null} /></td>
                  <td className="px-3 py-2.5 text-right">${c.price?.toFixed(2) ?? '—'}</td>
                  <td className="px-3 py-2.5 text-right" style={{ color: (c.changesPercentage ?? 0) >= 0 ? 'var(--green)' : 'var(--red)' }}>
                    {c.changesPercentage != null ? `${c.changesPercentage >= 0 ? '+' : ''}${c.changesPercentage.toFixed(2)}%` : '—'}
                  </td>
                  <td className="px-3 py-2.5 text-center">
                    <button
                      onClick={() => setDrillTarget(c)}
                      className="px-2 py-0.5 rounded text-xs"
                      style={{ background: 'var(--surface)', border: '1px solid var(--border)', color: 'var(--muted)', cursor: 'pointer' }}
                    >
                      View
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── Drill modal ── */}
      {drillTarget && (
        <DrillModal constituent={drillTarget} onClose={() => setDrillTarget(null)} />
      )}
    </div>
  );
}
