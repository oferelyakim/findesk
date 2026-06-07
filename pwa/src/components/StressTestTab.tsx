import { useState, useMemo } from 'react';
import { AlertTriangle, Save, ChevronRight, RefreshCw } from 'lucide-react';
import { computeStressTest, fmtMillions, fmtPct } from '@/lib/calculations';
import { saveStressTest } from '@/lib/supabase';
import { useFinDeskStore } from '@/store';
import { LabelWithTip } from '@/components/Tooltip';
import type { StressBaseInputs, StressAssumptions } from '@/types';

// ── Color helpers ─────────────────────────────────────────────────────────────

function coverageColor(v: number | null): string {
  if (v === null) return 'var(--muted)';
  if (v < 1.25) return 'var(--red)';
  if (v < 2.0)  return 'var(--gold)';
  return 'var(--green)';
}

function leverageColor(v: number | null): string {
  if (v === null) return 'var(--muted)';
  if (v > 5.0) return 'var(--red)';
  if (v > 3.0) return 'var(--gold)';
  return 'var(--green)';
}

function coverageBg(v: number | null): string {
  if (v === null) return 'transparent';
  if (v < 1.25) return 'rgba(239,68,68,0.1)';
  if (v < 2.0)  return 'rgba(245,158,11,0.1)';
  return 'rgba(34,197,94,0.1)';
}

function leverageBg(v: number | null): string {
  if (v === null) return 'transparent';
  if (v > 5.0) return 'rgba(239,68,68,0.1)';
  if (v > 3.0) return 'rgba(245,158,11,0.1)';
  return 'rgba(34,197,94,0.1)';
}

// ── Input row ─────────────────────────────────────────────────────────────────

function InputRow({
  label, tip, value, onChange, prefix = '', suffix = '', step = '0.1', min,
}: {
  label: string; tip: string; value: number; onChange: (v: number) => void;
  prefix?: string; suffix?: string; step?: string; min?: string;
}) {
  return (
    <div className="flex items-center gap-4 py-2.5" style={{ borderBottom: '1px solid var(--border)' }}>
      <div className="flex-1">
        <LabelWithTip label={label} tip={tip} />
      </div>
      <div className="relative" style={{ width: 130 }}>
        {prefix && (
          <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-sm" style={{ color: 'var(--muted)' }}>{prefix}</span>
        )}
        <input
          type="number"
          value={value}
          step={step}
          min={min}
          onChange={(e) => onChange(parseFloat(e.target.value) || 0)}
          className={`text-right ${prefix ? 'pl-6' : ''} ${suffix ? 'pr-8' : ''}`}
          style={{ width: '100%' }}
        />
        {suffix && (
          <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs" style={{ color: 'var(--muted)' }}>{suffix}</span>
        )}
      </div>
    </div>
  );
}

// ── Output row ────────────────────────────────────────────────────────────────

function OutputRow({
  label, base, stress, delta, isColorRow, colorFn, bgFn,
}: {
  label: string; base: string; stress: string; delta: string;
  isColorRow?: boolean;
  colorFn?: (v: number | null) => string;
  bgFn?: (v: number | null) => string;
}) {
  return (
    <tr style={{ borderTop: '1px solid var(--border)' }}>
      <td className="px-3 py-2.5 text-sm" style={{ color: 'var(--muted)', minWidth: 200 }}>{label}</td>
      <td className="px-3 py-2.5 text-right text-sm font-medium">{base}</td>
      <td className="px-3 py-2.5 text-right text-sm font-medium"
        style={isColorRow && colorFn && bgFn ? { color: colorFn(parseFloat(stress) || null), background: bgFn(parseFloat(stress) || null) } : {}}>
        {stress}
      </td>
      <td className="px-3 py-2.5 text-right text-sm" style={{ color: 'var(--muted)' }}>{delta}</td>
    </tr>
  );
}

// ── Default inputs ────────────────────────────────────────────────────────────

const DEFAULT_BASE: StressBaseInputs = {
  ticker: '',
  revenue: 0,
  grossProfit: 0,
  ebitda: 0,
  interestExpense: 0,
  totalDebt: 0,
  cashAndEquivalents: 0,
  accountsReceivable: 0,
  inventory: 0,
  accountsPayable: 0,
  capex: 0,
};

const DEFAULT_ASSUMPTIONS: StressAssumptions = {
  salesDeclinePct:         10,
  grossMarginCompressionPct: 3,
  arIneligiblesPct:        15,
  inventorySlowdownPct:    20,
  inventoryQualityCapPct:  75,
  interestRateIncreasePct:  2,
};

// ── Main ──────────────────────────────────────────────────────────────────────

export default function StressTestTab() {
  const { stressBaseFromAnalysis, lastAnalysis } = useFinDeskStore();
  const [base, setBase]              = useState<StressBaseInputs>(stressBaseFromAnalysis ?? DEFAULT_BASE);
  const [assumptions, setAssumptions] = useState<StressAssumptions>(DEFAULT_ASSUMPTIONS);
  const [saving, setSaving]          = useState(false);
  const [saved, setSaved]            = useState(false);

  const result = useMemo(() => computeStressTest(base, assumptions), [base, assumptions]);

  const loadFromSaved = () => {
    if (stressBaseFromAnalysis) {
      setBase(stressBaseFromAnalysis);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await saveStressTest({ base, assumptions, result, savedAt: new Date().toISOString() });
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (err) {
      console.error('Failed to save stress test:', err);
    } finally {
      setSaving(false);
    }
  };

  const setB = (key: keyof StressBaseInputs) => (v: number) =>
    setBase((prev) => ({ ...prev, [key]: v }));

  const setA = (key: keyof StressAssumptions) => (v: number) =>
    setAssumptions((prev) => ({ ...prev, [key]: v }));

  const fmt = (v: number | null | undefined) =>
    v != null ? fmtMillions(v) : '—';

  const fmtMultiple = (v: number | null | undefined) =>
    v != null ? v.toFixed(2) + 'x' : '—';

  const delta = (b: number | null | undefined, s: number | null | undefined) => {
    if (b == null || s == null) return '—';
    const d = s - b;
    return `${d >= 0 ? '+' : ''}${d.toFixed(2)}`;
  };

  return (
    <div className="space-y-6">
      {/* ── Header ── */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-bold">Credit Stress Test</h1>
          <p className="text-sm" style={{ color: 'var(--muted)' }}>Base vs Stressed — cashflow coverage, leverage, borrowing base</p>
        </div>
        <div className="flex gap-2">
          {stressBaseFromAnalysis && (
            <button
              onClick={loadFromSaved}
              className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm"
              style={{ background: 'var(--card)', border: '1px solid var(--border)' }}
            >
              <RefreshCw size={14} />
              Load from {stressBaseFromAnalysis.ticker}
            </button>
          )}
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium"
            style={{ background: saved ? 'var(--green)' : 'var(--accent)', color: '#fff', opacity: saving ? 0.6 : 1 }}
          >
            <Save size={14} />
            {saved ? 'Saved!' : saving ? 'Saving…' : 'Save Test'}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* ── Section A — Base inputs ── */}
        <div className="rounded-xl overflow-hidden" style={{ border: '1px solid var(--border)' }}>
          <div className="px-4 py-3 font-semibold text-sm flex items-center gap-2"
            style={{ background: 'var(--surface)', borderBottom: '1px solid var(--border)' }}>
            <span className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold"
              style={{ background: 'var(--accent)', color: '#fff' }}>A</span>
            Base Figures ($M)
          </div>
          <div className="p-4 space-y-0">
            <InputRow label="Ticker" tip="Company ticker symbol" value={0}
              onChange={() => {}} prefix="" suffix="" step="1" />
            <div className="flex items-center gap-4 py-2.5" style={{ borderBottom: '1px solid var(--border)' }}>
              <div className="flex-1 text-sm font-medium" style={{ color: 'var(--text)' }}>Ticker</div>
              <input
                type="text"
                value={base.ticker}
                onChange={(e) => setBase((prev) => ({ ...prev, ticker: e.target.value }))}
                placeholder="AAPL"
                className="text-right"
                style={{ width: 130 }}
              />
            </div>
            <InputRow label="Revenue" tip="Total net revenue / sales" value={base.revenue} onChange={setB('revenue')} prefix="$" step="1" />
            <InputRow label="Gross Profit" tip="Revenue minus cost of goods sold" value={base.grossProfit} onChange={setB('grossProfit')} prefix="$" step="1" />
            <InputRow label="EBITDA" tip="Earnings Before Interest, Taxes, Depreciation & Amortization" value={base.ebitda} onChange={setB('ebitda')} prefix="$" step="1" />
            <InputRow label="Interest Expense" tip="Annual interest payments on all debt" value={base.interestExpense} onChange={setB('interestExpense')} prefix="$" step="1" />
            <InputRow label="Capex" tip="Capital expenditures (used for FCF calc)" value={base.capex} onChange={setB('capex')} prefix="$" step="1" />
            <InputRow label="Total Debt" tip="Short-term + long-term debt" value={base.totalDebt} onChange={setB('totalDebt')} prefix="$" step="1" />
            <InputRow label="Cash & Equivalents" tip="Cash and short-term investments" value={base.cashAndEquivalents} onChange={setB('cashAndEquivalents')} prefix="$" step="1" />
            <InputRow label="Accounts Receivable" tip="Outstanding customer receivables" value={base.accountsReceivable} onChange={setB('accountsReceivable')} prefix="$" step="1" />
            <InputRow label="Inventory" tip="Raw materials + WIP + finished goods" value={base.inventory} onChange={setB('inventory')} prefix="$" step="1" />
            <InputRow label="Accounts Payable" tip="Outstanding payments owed to suppliers" value={base.accountsPayable} onChange={setB('accountsPayable')} prefix="$" step="1" />
          </div>
        </div>

        {/* ── Section B — Stress assumptions ── */}
        <div className="rounded-xl overflow-hidden" style={{ border: '1px solid var(--border)' }}>
          <div className="px-4 py-3 font-semibold text-sm flex items-center gap-2"
            style={{ background: 'var(--surface)', borderBottom: '1px solid var(--border)' }}>
            <span className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold"
              style={{ background: '#ef4444', color: '#fff' }}>B</span>
            Stress Assumptions
          </div>
          <div className="p-4">
            <InputRow
              label="Sales Decline"
              tip="Revenue drop in stressed scenario. E.g. 10 means revenues fall by 10% from base."
              value={assumptions.salesDeclinePct}
              onChange={setA('salesDeclinePct')}
              suffix="%"
              step="0.5"
              min="0"
            />
            <InputRow
              label="Gross Margin Compression"
              tip="How many gross margin percentage points are lost under stress. E.g. 3 means gross margin falls by 3 ppts."
              value={assumptions.grossMarginCompressionPct}
              onChange={setA('grossMarginCompressionPct')}
              suffix="ppts"
              step="0.5"
              min="0"
            />
            <InputRow
              label="AR Ineligibles"
              tip="% of AR excluded from borrowing base (past-due, concentrated, foreign, etc.). E.g. 15 = 15% ineligible."
              value={assumptions.arIneligiblesPct}
              onChange={setA('arIneligiblesPct')}
              suffix="%"
              step="1"
              min="0"
            />
            <InputRow
              label="Inventory Slowdown"
              tip="% increase in days inventory outstanding under stress. Increases inventory carrying requirement."
              value={assumptions.inventorySlowdownPct}
              onChange={setA('inventorySlowdownPct')}
              suffix="%"
              step="1"
              min="0"
            />
            <InputRow
              label="Inventory Quality Cap"
              tip="Maximum % of stressed inventory included in borrowing base (accounts for obsolescence risk)."
              value={assumptions.inventoryQualityCapPct}
              onChange={setA('inventoryQualityCapPct')}
              suffix="%"
              step="1"
              min="0"
            />
            <InputRow
              label="Interest Rate Increase"
              tip="Additional interest rate increase under stress scenario (e.g. 2 = +200 bps). Applied to all variable-rate debt."
              value={assumptions.interestRateIncreasePct}
              onChange={setA('interestRateIncreasePct')}
              suffix="%"
              step="0.25"
              min="0"
            />

            {/* Legend */}
            <div className="mt-6 p-3 rounded-lg text-xs space-y-1.5" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
              <div className="font-semibold mb-2" style={{ color: 'var(--text)' }}>Coverage Multiple thresholds</div>
              <div className="flex gap-2"><span className="w-2.5 h-2.5 rounded-full mt-0.5" style={{ background: 'var(--green)', flexShrink: 0 }} /><span style={{ color: 'var(--muted)' }}><strong style={{ color: 'var(--green)' }}>&gt;2.0x</strong> — Healthy. Comfortable debt service.</span></div>
              <div className="flex gap-2"><span className="w-2.5 h-2.5 rounded-full mt-0.5" style={{ background: 'var(--gold)', flexShrink: 0 }} /><span style={{ color: 'var(--muted)' }}><strong style={{ color: 'var(--gold)' }}>1.25–2.0x</strong> — Caution. Monitor closely.</span></div>
              <div className="flex gap-2"><span className="w-2.5 h-2.5 rounded-full mt-0.5" style={{ background: 'var(--red)', flexShrink: 0 }} /><span style={{ color: 'var(--muted)' }}><strong style={{ color: 'var(--red)' }}>&lt;1.25x</strong> — Distress. Cannot service debt from operations.</span></div>
              <div className="font-semibold mt-3 mb-1" style={{ color: 'var(--text)' }}>Leverage (Debt/EBITDA) thresholds</div>
              <div className="flex gap-2"><span className="w-2.5 h-2.5 rounded-full mt-0.5" style={{ background: 'var(--green)', flexShrink: 0 }} /><span style={{ color: 'var(--muted)' }}><strong style={{ color: 'var(--green)' }}>&lt;3.0x</strong> — Investment grade range.</span></div>
              <div className="flex gap-2"><span className="w-2.5 h-2.5 rounded-full mt-0.5" style={{ background: 'var(--gold)', flexShrink: 0 }} /><span style={{ color: 'var(--muted)' }}><strong style={{ color: 'var(--gold)' }}>3.0–5.0x</strong> — Elevated. Typical for leveraged loans.</span></div>
              <div className="flex gap-2"><span className="w-2.5 h-2.5 rounded-full mt-0.5" style={{ background: 'var(--red)', flexShrink: 0 }} /><span style={{ color: 'var(--muted)' }}><strong style={{ color: 'var(--red)' }}>&gt;5.0x</strong> — Highly leveraged / distressed.</span></div>
            </div>
          </div>
        </div>
      </div>

      {/* ── Section C — Results ── */}
      <div className="rounded-xl overflow-hidden" style={{ border: '1px solid var(--border)' }}>
        <div className="px-4 py-3 font-semibold text-sm flex items-center gap-2"
          style={{ background: 'var(--surface)', borderBottom: '1px solid var(--border)' }}>
          <span className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold"
            style={{ background: 'var(--gold)', color: '#000' }}>C</span>
          Output — Base vs Stressed
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border)', background: 'var(--surface)' }}>
                <th className="text-left px-3 py-2.5 text-xs font-medium" style={{ color: 'var(--muted)', minWidth: 200 }}>Metric</th>
                <th className="text-right px-3 py-2.5 text-xs font-medium" style={{ color: 'var(--muted)' }}>Base</th>
                <th className="text-right px-3 py-2.5 text-xs font-medium" style={{ color: 'var(--red)' }}>Stressed</th>
                <th className="text-right px-3 py-2.5 text-xs font-medium" style={{ color: 'var(--muted)' }}>Δ</th>
              </tr>
            </thead>
            <tbody>
              {/* Income */}
              <tr style={{ background: 'var(--surface)', borderTop: '1px solid var(--border)' }}>
                <td colSpan={4} className="px-3 py-1.5 text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--muted)' }}>
                  Income
                </td>
              </tr>
              <OutputRow label="Revenue"       base={fmt(result.base.revenue)}       stress={fmt(result.stressed.revenue)}       delta={delta(result.base.revenue, result.stressed.revenue)} />
              <OutputRow label="Gross Profit"  base={fmt(result.base.grossProfit)}    stress={fmt(result.stressed.grossProfit)}   delta={delta(result.base.grossProfit, result.stressed.grossProfit)} />
              <OutputRow label="EBITDA"        base={fmt(result.base.ebitda)}         stress={fmt(result.stressed.ebitda)}        delta={delta(result.base.ebitda, result.stressed.ebitda)} />
              <OutputRow label="Interest (stressed)" base={fmt(result.base.interestExpense)} stress={fmt(result.stressed.interestExpense)} delta={delta(result.base.interestExpense, result.stressed.interestExpense)} />
              <OutputRow label="Free Cash Flow" base={fmt(result.base.freeCashFlow)} stress={fmt(result.stressed.freeCashFlow)}  delta={delta(result.base.freeCashFlow, result.stressed.freeCashFlow)} />

              {/* Key ratios */}
              <tr style={{ background: 'var(--surface)', borderTop: '2px solid var(--border)' }}>
                <td colSpan={4} className="px-3 py-1.5 text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--muted)' }}>
                  Credit Ratios
                </td>
              </tr>
              <tr style={{ borderTop: '1px solid var(--border)' }}>
                <td className="px-3 py-2.5 text-sm" style={{ color: 'var(--muted)' }}>Cashflow Coverage Multiple</td>
                <td className="px-3 py-2.5 text-right text-sm font-bold"
                  style={{ color: coverageColor(result.base.cashflowCoverageMultiple), background: coverageBg(result.base.cashflowCoverageMultiple) }}>
                  {fmtMultiple(result.base.cashflowCoverageMultiple)}
                </td>
                <td className="px-3 py-2.5 text-right text-sm font-bold"
                  style={{ color: coverageColor(result.stressed.cashflowCoverageMultiple), background: coverageBg(result.stressed.cashflowCoverageMultiple) }}>
                  {fmtMultiple(result.stressed.cashflowCoverageMultiple)}
                </td>
                <td className="px-3 py-2.5 text-right text-sm" style={{ color: 'var(--muted)' }}>
                  {delta(result.base.cashflowCoverageMultiple, result.stressed.cashflowCoverageMultiple)}x
                </td>
              </tr>
              <tr style={{ borderTop: '1px solid var(--border)' }}>
                <td className="px-3 py-2.5 text-sm" style={{ color: 'var(--muted)' }}>Adj. Funded Debt / EBITDA</td>
                <td className="px-3 py-2.5 text-right text-sm font-bold"
                  style={{ color: leverageColor(result.base.adjFundedDebtToEbitda), background: leverageBg(result.base.adjFundedDebtToEbitda) }}>
                  {fmtMultiple(result.base.adjFundedDebtToEbitda)}
                </td>
                <td className="px-3 py-2.5 text-right text-sm font-bold"
                  style={{ color: leverageColor(result.stressed.adjFundedDebtToEbitda), background: leverageBg(result.stressed.adjFundedDebtToEbitda) }}>
                  {fmtMultiple(result.stressed.adjFundedDebtToEbitda)}
                </td>
                <td className="px-3 py-2.5 text-right text-sm" style={{ color: 'var(--muted)' }}>
                  {delta(result.base.adjFundedDebtToEbitda, result.stressed.adjFundedDebtToEbitda)}x
                </td>
              </tr>

              {/* Borrowing base */}
              <tr style={{ background: 'var(--surface)', borderTop: '2px solid var(--border)' }}>
                <td colSpan={4} className="px-3 py-1.5 text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--muted)' }}>
                  Borrowing Base
                </td>
              </tr>
              <OutputRow label="Cash"             base={fmt(result.base.borrowingBase?.cash)}         stress={fmt(result.stressed.borrowingBase?.cash)}         delta={delta(result.base.borrowingBase?.cash, result.stressed.borrowingBase?.cash)} />
              <OutputRow label="Eligible AR"      base={fmt(result.base.borrowingBase?.eligibleAR)}   stress={fmt(result.stressed.borrowingBase?.eligibleAR)}   delta={delta(result.base.borrowingBase?.eligibleAR, result.stressed.borrowingBase?.eligibleAR)} />
              <OutputRow label="Eligible Inventory" base={fmt(result.base.borrowingBase?.eligibleInventory)} stress={fmt(result.stressed.borrowingBase?.eligibleInventory)} delta={delta(result.base.borrowingBase?.eligibleInventory, result.stressed.borrowingBase?.eligibleInventory)} />
              <OutputRow label="Less: Payables"   base={fmt(result.base.borrowingBase?.payables)}     stress={fmt(result.stressed.borrowingBase?.payables)}     delta={delta(result.base.borrowingBase?.payables, result.stressed.borrowingBase?.payables)} />
              <tr style={{ borderTop: '2px solid var(--border)', fontWeight: 700 }}>
                <td className="px-3 py-2.5 text-sm">Net Borrowing Base</td>
                <td className="px-3 py-2.5 text-right text-sm">{fmt(result.base.borrowingBase?.net)}</td>
                <td className="px-3 py-2.5 text-right text-sm" style={{ color: 'var(--red)' }}>{fmt(result.stressed.borrowingBase?.net)}</td>
                <td className="px-3 py-2.5 text-right text-sm" style={{ color: 'var(--muted)' }}>{delta(result.base.borrowingBase?.net, result.stressed.borrowingBase?.net)}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
