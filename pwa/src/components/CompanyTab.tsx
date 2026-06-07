import { useState, useMemo, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip as ReTooltip, Legend, ResponsiveContainer,
} from 'recharts';
import { Search, RefreshCw, Download, Save } from 'lucide-react';
import * as XLSX from 'xlsx';
import { searchCompanies, fetchIncomeStatements, fetchBalanceSheets, fetchKeyMetrics } from '@/lib/api';
import {
  commonSizePct, fmtMillions, fmtPct,
} from '@/lib/calculations';
import { saveAnalysis } from '@/lib/supabase';
import { useFinDeskStore } from '@/store';
import type { IncomeStatement, BalanceSheet, KeyMetrics } from '@/types';

// ── helpers ──────────────────────────────────────────────────────────────────

function useDebouncedValue<T>(value: T, ms: number): T {
  const [debouncedValue, setDebouncedValue] = useState(value);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedValue(value), ms);
    return () => clearTimeout(timer);
  }, [value, ms]);

  return debouncedValue;
}

type CellVal = number | null | undefined;

function pctCell(val: CellVal, base: CellVal) {
  const p = commonSizePct(val ?? null, base ?? null);
  if (p === null) return <span style={{ color: 'var(--muted)' }}>—</span>;
  const color = p < 0 ? 'var(--red)' : p > 30 ? 'var(--green)' : 'var(--text)';
  return <span style={{ color }}>{fmtPct(p / 100, 1)}</span>;
}

function dollarCell(val: CellVal) {
  if (val == null) return <span style={{ color: 'var(--muted)' }}>—</span>;
  const isNeg = val < 0;
  return <span style={{ color: isNeg ? 'var(--red)' : 'var(--text)' }}>{fmtMillions(val)}</span>;
}

function KpiCard({ label, value, sub, color }: { label: string; value: string; sub?: string; color?: string }) {
  return (
    <div className="rounded-xl p-4" style={{ background: 'var(--card)', border: '1px solid var(--border)' }}>
      <div className="text-xs mb-1" style={{ color: 'var(--muted)' }}>{label}</div>
      <div className="text-lg font-bold" style={{ color: color ?? 'var(--text)' }}>{value}</div>
      {sub && <div className="text-xs mt-0.5" style={{ color: 'var(--muted)' }}>{sub}</div>}
    </div>
  );
}

// ── Income statement table ────────────────────────────────────────────────────

const IS_ROWS: { label: string; key: keyof IncomeStatement; separator?: boolean }[] = [
  { label: 'Revenue', key: 'revenue' },
  { label: 'Cost of Revenue', key: 'costOfRevenue' },
  { label: 'Gross Profit', key: 'grossProfit', separator: true },
  { label: 'SG&A', key: 'sellingGeneralAdministrativeExpenses' },
  { label: 'R&D', key: 'researchAndDevelopmentExpenses' },
  { label: 'EBITDA', key: 'ebitda', separator: true },
  { label: 'Depreciation & Amortization', key: 'depreciationAndAmortization' },
  { label: 'Operating Income', key: 'operatingIncome', separator: true },
  { label: 'Interest Expense', key: 'interestExpense' },
  { label: 'Pretax Income', key: 'incomeBeforeTax' },
  { label: 'Income Tax', key: 'incomeTaxExpense' },
  { label: 'Net Income', key: 'netIncome', separator: true },
  { label: 'EPS (diluted)', key: 'epsDiluted' },
];

const BS_ROWS: { label: string; key: keyof BalanceSheet; isSubtotal?: boolean }[] = [
  { label: 'Cash & Equivalents', key: 'cashAndEquivalents' },
  { label: 'Short-Term Investments', key: 'shortTermInvestments' },
  { label: 'Accounts Receivable', key: 'netReceivables' },
  { label: 'Inventory', key: 'inventory' },
  { label: 'Total Current Assets', key: 'currentAssets', isSubtotal: true },
  { label: 'PP&E (net)', key: 'propertyPlantEquipmentNet' },
  { label: 'Goodwill', key: 'goodwill' },
  { label: 'Intangible Assets', key: 'intangibleAssets' },
  { label: 'Total Assets', key: 'totalAssets', isSubtotal: true },
  { label: 'Accounts Payable', key: 'accountPayables' },
  { label: 'Short-Term Debt', key: 'shortTermDebt' },
  { label: 'Total Current Liabilities', key: 'currentLiabilities', isSubtotal: true },
  { label: 'Long-Term Debt', key: 'longTermDebt' },
  { label: 'Total Debt', key: 'totalDebt', isSubtotal: true },
  { label: 'Total Equity', key: 'totalStockholdersEquity', isSubtotal: true },
];

interface FinTableProps {
  rows: { label: string; key: string; separator?: boolean; isSubtotal?: boolean }[];
  periods: (IncomeStatement | BalanceSheet)[];
  revenueKey?: string;
  periodLabel: string;
}

function FinTable({ rows, periods, revenueKey, periodLabel }: FinTableProps) {
  const [showPct, setShowPct] = useState(true);

  return (
    <div className="rounded-xl overflow-hidden" style={{ border: '1px solid var(--border)' }}>
      <div className="flex items-center justify-between px-3 py-2.5" style={{ background: 'var(--surface)', borderBottom: '1px solid var(--border)' }}>
        <h3 className="font-semibold text-sm">{periodLabel}</h3>
        <button
          onClick={() => setShowPct(!showPct)}
          className="text-xs px-2 py-1 rounded"
          style={{ background: 'var(--card)', border: '1px solid var(--border)', color: 'var(--muted)' }}
        >
          {showPct ? 'Hide % column' : 'Show % column'}
        </button>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr style={{ borderBottom: '1px solid var(--border)', background: 'var(--surface)' }}>
              <th className="text-left px-3 py-2 text-xs font-medium" style={{ color: 'var(--muted)', minWidth: 200 }}>Line Item</th>
              {periods.map((p) => (
                <>
                  <th key={`${p.date}-$`} className="text-right px-3 py-2 text-xs font-medium whitespace-nowrap" style={{ color: 'var(--muted)' }}>
                    {p.date.slice(0, 4)} ($M)
                  </th>
                  {showPct && revenueKey && (
                    <th key={`${p.date}-%`} className="text-right px-3 py-2 text-xs font-medium" style={{ color: 'var(--muted)' }}>
                      % Rev
                    </th>
                  )}
                </>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map(({ label, key, separator, isSubtotal }) => (
              <tr
                key={key}
                style={{
                  borderTop: separator || isSubtotal ? '2px solid var(--border)' : '1px solid var(--border)',
                  background: isSubtotal ? 'var(--surface)' : 'transparent',
                  fontWeight: isSubtotal ? 600 : 400,
                }}
              >
                <td className="px-3 py-2" style={{ color: isSubtotal ? 'var(--text)' : 'var(--muted)' }}>
                  {isSubtotal ? label : <span className="pl-2">{label}</span>}
                </td>
                {periods.map((p) => {
                  const val = (p as unknown as Record<string, unknown>)[key] as CellVal;
                  const rev = revenueKey ? (p as unknown as Record<string, unknown>)[revenueKey] as CellVal : null;
                  return (
                    <>
                      <td key={`${p.date}-$`} className="px-3 py-2 text-right">{dollarCell(val)}</td>
                      {showPct && revenueKey && (
                        <td key={`${p.date}-%`} className="px-3 py-2 text-right">{pctCell(val, rev)}</td>
                      )}
                    </>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ── Margin chart ──────────────────────────────────────────────────────────────

function MarginChart({ statements }: { statements: IncomeStatement[] }) {
  const data = useMemo(() =>
    [...statements].reverse().map((s) => ({
      year: s.date.slice(0, 4),
      Gross:     commonSizePct(s.grossProfit, s.revenue),
      Operating: commonSizePct(s.operatingIncome, s.revenue),
      Net:       commonSizePct(s.netIncome, s.revenue),
      EBITDA:    commonSizePct(s.ebitda, s.revenue),
    })),
    [statements]
  );

  return (
    <div className="rounded-xl p-5" style={{ background: 'var(--card)', border: '1px solid var(--border)' }}>
      <h3 className="font-semibold text-sm mb-4">Margin Trend (%)</h3>
      <ResponsiveContainer width="100%" height={220}>
        <LineChart data={data}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
          <XAxis dataKey="year" tick={{ fontSize: 11, fill: 'var(--muted)' }} />
          <YAxis tick={{ fontSize: 11, fill: 'var(--muted)' }} tickFormatter={(v) => `${v?.toFixed(0)}%`} />
          <ReTooltip
            contentStyle={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8 }}
            formatter={(v: number) => [`${v?.toFixed(1)}%`]}
          />
          <Legend wrapperStyle={{ fontSize: 12 }} />
          <Line type="monotone" dataKey="Gross"     stroke="#22c55e" strokeWidth={2} dot />
          <Line type="monotone" dataKey="Operating" stroke="#6366f1" strokeWidth={2} dot />
          <Line type="monotone" dataKey="Net"       stroke="#f59e0b" strokeWidth={2} dot />
          <Line type="monotone" dataKey="EBITDA"    stroke="#38bdf8" strokeWidth={2} dot />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export default function CompanyTab() {
  const [searchQuery, setSearchQuery] = useState('');
  const [ticker, setTicker] = useState('');
  const [period, setPeriod] = useState<'annual' | 'quarterly'>('annual');
  const [showResults, setShowResults] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveNote, setSaveNote] = useState('');
  const [showSaveDialog, setShowSaveDialog] = useState(false);

  const debouncedQuery = useDebouncedValue(searchQuery, 350);
  const { setStressBaseFromAnalysis, setActiveTicker } = useFinDeskStore();

  const { data: searchResults } = useQuery({
    queryKey: ['search', debouncedQuery],
    queryFn: () => searchCompanies(debouncedQuery),
    enabled: debouncedQuery.length >= 1,
    staleTime: 60 * 1000,
  });

  const { data: incomeRaw, isLoading: isLoadingIS, error: errorIS, refetch: refetchIS } = useQuery({
    queryKey: ['income', ticker, period],
    queryFn: () => fetchIncomeStatements(ticker, period, 4),
    enabled: !!ticker,
    staleTime: 5 * 60 * 1000,
    retry: 1,
  });

  const { data: balanceRaw, isLoading: isLoadingBS, refetch: refetchBS } = useQuery({
    queryKey: ['balance', ticker, period],
    queryFn: () => fetchBalanceSheets(ticker, period, 4),
    enabled: !!ticker,
    staleTime: 5 * 60 * 1000,
    retry: 1,
  });

  const { data: metricsRaw, isLoading: isLoadingKM } = useQuery({
    queryKey: ['keymetrics', ticker, period],
    queryFn: () => fetchKeyMetrics(ticker, period, 1),
    enabled: !!ticker,
    staleTime: 5 * 60 * 1000,
  });

  const incomeStatements: IncomeStatement[] = useMemo(() => incomeRaw ?? [], [incomeRaw]);
  const balanceSheets: BalanceSheet[]       = useMemo(() => balanceRaw ?? [], [balanceRaw]);

  const latestMetrics: KeyMetrics | null = useMemo(() => {
    if (!metricsRaw?.length) return null;
    return metricsRaw[0] ?? null;
  }, [metricsRaw]);

  const isLoading = isLoadingIS || isLoadingBS || isLoadingKM;

  const selectTicker = (sym: string) => {
    setTicker(sym);
    setSearchQuery(sym);
    setShowResults(false);
    setActiveTicker(sym);
  };

  const handleSave = async () => {
    if (!ticker || !incomeStatements.length) return;
    setSaving(true);
    try {
      await saveAnalysis({
        ticker,
        note: saveNote,
        incomeStatements,
        balanceSheets,
        savedAt: new Date().toISOString(),
      });
      // Populate stress test base from latest IS
      const latest = incomeStatements[0];
      const latestBS = balanceSheets[0];
      if (latest && latestBS) {
        setStressBaseFromAnalysis({
          ticker,
          revenue: latest.revenue ?? 0,
          grossProfit: latest.grossProfit ?? 0,
          ebitda: latest.ebitda ?? 0,
          interestExpense: latest.interestExpense ?? 0,
          totalDebt: latestBS.totalDebt ?? 0,
          cashAndEquivalents: latestBS.cashAndEquivalents ?? 0,
          accountsReceivable: latestBS.netReceivables ?? 0,
          inventory: latestBS.inventory ?? 0,
          accountsPayable: latestBS.accountPayables ?? 0,
          capex: 0,
        });
      }
      setShowSaveDialog(false);
      setSaveNote('');
    } catch (err) {
      console.error('Failed to save analysis:', err);
    } finally {
      setSaving(false);
    }
  };

  const exportExcel = () => {
    if (!incomeStatements.length) return;
    const wb = XLSX.utils.book_new();

    const isRows = IS_ROWS.map(({ label, key }) => {
      const row: Record<string, unknown> = { 'Line Item': label };
      incomeStatements.forEach((s) => {
        row[s.date.slice(0, 4)] = (s as unknown as Record<string, unknown>)[key] ?? null;
      });
      return row;
    });
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(isRows), 'Income Statement');

    const bsRows = BS_ROWS.map(({ label, key }) => {
      const row: Record<string, unknown> = { 'Line Item': label };
      balanceSheets.forEach((s) => {
        row[s.date.slice(0, 4)] = (s as unknown as Record<string, unknown>)[key] ?? null;
      });
      return row;
    });
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(bsRows), 'Balance Sheet');

    XLSX.writeFile(wb, `${ticker}-analysis.xlsx`);
  };

  return (
    <div className="space-y-6">
      {/* ── Header ── */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-bold">Company Analysis</h1>
          <p className="text-sm" style={{ color: 'var(--muted)' }}>Common-size P&L, balance sheet, margins</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          {ticker && (
            <>
              <button
                onClick={() => { refetchIS(); refetchBS(); }}
                className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm"
                style={{ background: 'var(--card)', border: '1px solid var(--border)' }}
              >
                <RefreshCw size={14} />
                Refresh
              </button>
              <button
                onClick={exportExcel}
                className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm"
                style={{ background: 'var(--card)', border: '1px solid var(--border)' }}
              >
                <Download size={14} />
                Export
              </button>
              <button
                onClick={() => setShowSaveDialog(true)}
                className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm"
                style={{ background: 'var(--accent)', color: '#fff' }}
              >
                <Save size={14} />
                Save Analysis
              </button>
            </>
          )}
        </div>
      </div>

      {/* ── Search + period toggle ── */}
      <div className="flex gap-3 flex-wrap items-end">
        <div className="relative flex-1" style={{ minWidth: 280 }}>
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--muted)' }} />
          <input
            type="text"
            placeholder="Search company or ticker (e.g. AAPL, Apple)"
            value={searchQuery}
            onChange={(e) => { setSearchQuery(e.target.value); setShowResults(true); }}
            onFocus={() => setShowResults(true)}
            className="pl-9 py-2.5 text-sm w-full"
          />
          {showResults && searchResults && searchResults.length > 0 && (
            <div
              className="absolute top-full left-0 right-0 mt-1 rounded-xl shadow-xl z-50 overflow-hidden"
              style={{ background: 'var(--card)', border: '1px solid var(--border)' }}
            >
              {(searchResults as { symbol: string; name: string; exchangeShortName: string }[]).map((r) => (
                <button
                  key={r.symbol}
                  className="w-full text-left px-4 py-2.5 text-sm transition-colors hover:brightness-110"
                  style={{ borderBottom: '1px solid var(--border)', background: 'none' }}
                  onClick={() => selectTicker(r.symbol)}
                  onMouseDown={(e) => e.preventDefault()}
                >
                  <span className="font-semibold" style={{ color: 'var(--accent)' }}>{r.symbol}</span>
                  <span className="ml-2" style={{ color: 'var(--muted)' }}>{r.name}</span>
                  <span className="ml-1 text-xs" style={{ color: 'var(--muted)' }}>({r.exchangeShortName})</span>
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="flex rounded-lg overflow-hidden" style={{ border: '1px solid var(--border)' }}>
          {(['annual', 'quarterly'] as const).map((p) => (
            <button
              key={p}
              onClick={() => setPeriod(p)}
              className="px-4 py-2.5 text-sm font-medium capitalize"
              style={{
                background: period === p ? 'var(--accent)' : 'var(--card)',
                color: period === p ? '#fff' : 'var(--muted)',
              }}
            >
              {p === 'annual' ? 'Annual' : 'Quarterly'}
            </button>
          ))}
        </div>
      </div>

      {/* ── Loading skeletons ── */}
      {ticker && isLoading && (
        <div className="space-y-4">
          <div className="grid grid-cols-3 md:grid-cols-6 gap-3">
            {Array.from({ length: 6 }).map((_, i) => <div key={i} className="h-20 rounded-xl skeleton" />)}
          </div>
          <div className="h-56 rounded-xl skeleton" />
          <div className="h-72 rounded-xl skeleton" />
        </div>
      )}

      {/* ── Results ── */}
      {ticker && !isLoading && incomeStatements.length > 0 && (
        <div className="space-y-6">
          {/* Key ratio KPI cards */}
          {latestMetrics && (
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
              <KpiCard label="P/E Ratio" value={latestMetrics.peRatio != null ? latestMetrics.peRatio.toFixed(1) : '—'} />
              <KpiCard label="EV/EBITDA" value={latestMetrics.evToEbitda != null ? latestMetrics.evToEbitda.toFixed(1) : '—'} />
              <KpiCard label="Net Margin" value={latestMetrics.netProfitMargin != null ? fmtPct(latestMetrics.netProfitMargin, 1) : '—'} />
              <KpiCard label="ROE" value={latestMetrics.roe != null ? fmtPct(latestMetrics.roe, 1) : '—'} />
              <KpiCard label="Debt/Equity" value={latestMetrics.debtToEquity != null ? latestMetrics.debtToEquity.toFixed(2) : '—'} />
              <KpiCard label="Current Ratio" value={latestMetrics.currentRatio != null ? latestMetrics.currentRatio.toFixed(2) : '—'} />
            </div>
          )}

          {/* Margin trend */}
          <MarginChart statements={incomeStatements} />

          {/* Income statement */}
          <FinTable
            rows={IS_ROWS as { label: string; key: string; separator?: boolean }[]}
            periods={incomeStatements}
            revenueKey="revenue"
            periodLabel="Income Statement ($M)"
          />

          {/* Balance sheet */}
          {balanceSheets.length > 0 && (
            <FinTable
              rows={BS_ROWS as { label: string; key: string; isSubtotal?: boolean }[]}
              periods={balanceSheets}
              periodLabel="Balance Sheet ($M)"
            />
          )}
        </div>
      )}

      {/* ── Error state ── */}
      {ticker && !isLoading && errorIS && (
        <div className="flex flex-col items-center justify-center py-16 text-center gap-3">
          <div className="rounded-xl p-6 max-w-lg" style={{ background: 'var(--card)', border: '1px solid var(--red)' }}>
            <p className="font-semibold mb-2" style={{ color: 'var(--red)' }}>Could not load data for {ticker}</p>
            <p className="text-sm mb-4" style={{ color: 'var(--muted)' }}>{(errorIS as Error).message}</p>
            <button onClick={() => { refetchIS(); refetchBS(); }} className="px-4 py-2 rounded-lg text-sm" style={{ background: 'var(--accent)', color: '#fff' }}>Retry</button>
          </div>
        </div>
      )}

      {/* ── Empty state ── */}
      {!ticker && (
        <div className="flex flex-col items-center justify-center py-24 text-center">
          <Search size={40} style={{ color: 'var(--muted)' }} className="mb-4" />
          <h2 className="font-semibold text-lg mb-2">Search for a company</h2>
          <p className="text-sm max-w-sm" style={{ color: 'var(--muted)' }}>
            Type a ticker or company name in the search box above — results appear as you type. Click a result to load the financial statements.
          </p>
          <div className="mt-6 flex gap-3 flex-wrap justify-center">
            {['AAPL', 'MSFT', 'NVDA', 'AMZN', 'GOOGL'].map((sym) => (
              <button
                key={sym}
                onClick={() => selectTicker(sym)}
                className="px-3 py-1.5 rounded-lg text-sm font-medium"
                style={{ background: 'var(--card)', border: '1px solid var(--border)', color: 'var(--accent)' }}
              >
                {sym}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* ── Save dialog ── */}
      {showSaveDialog && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center p-4"
          style={{ background: 'rgba(0,0,0,0.7)' }}
          onClick={(e) => { if (e.target === e.currentTarget) setShowSaveDialog(false); }}
        >
          <div
            className="w-full max-w-sm rounded-2xl p-6"
            style={{ background: 'var(--card)', border: '1px solid var(--border)' }}
          >
            <h2 className="font-semibold mb-4">Save Analysis — {ticker}</h2>
            <label className="text-xs mb-1.5 block" style={{ color: 'var(--muted)' }}>Note (optional)</label>
            <textarea
              value={saveNote}
              onChange={(e) => setSaveNote(e.target.value)}
              placeholder="E.g. Q4 review for client deck…"
              rows={3}
              className="w-full mb-4 text-sm"
              style={{ resize: 'vertical' }}
            />
            <div className="flex gap-2">
              <button
                onClick={() => setShowSaveDialog(false)}
                className="flex-1 py-2 rounded-lg text-sm"
                style={{ border: '1px solid var(--border)', color: 'var(--muted)' }}
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={saving}
                className="flex-1 py-2 rounded-lg text-sm font-medium"
                style={{ background: 'var(--accent)', color: '#fff', opacity: saving ? 0.6 : 1 }}
              >
                {saving ? 'Saving…' : 'Save'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
