import type {
  SP500Constituent,
  StressBaseInputs,
  StressAssumptions,
  StressResult,
  IncomeStatement,
  BalanceSheet,
} from '@/types';

// ── Formatting ─────────────────────────────────────────────────────────────────
export function fmtMillions(value: number | null | undefined): string {
  if (value === null || value === undefined) return '—';
  const abs = Math.abs(value);
  const sign = value < 0 ? '(' : '';
  const end = value < 0 ? ')' : '';
  if (abs >= 1000) return `${sign}$${(abs / 1000).toFixed(1)}B${end}`;
  return `${sign}$${abs.toFixed(0)}M${end}`;
}

export function fmtPct(value: number | null | undefined, decimals = 1): string {
  if (value === null || value === undefined) return '—';
  return `${value.toFixed(decimals)}%`;
}

export function fmtNumber(value: number | null | undefined, decimals = 2): string {
  if (value === null || value === undefined) return '—';
  return value.toFixed(decimals);
}

// ── Common-size ────────────────────────────────────────────────────────────────
export function commonSizePct(
  value: number | null,
  revenue: number | null,
): number | null {
  if (value === null || revenue === null || revenue === 0) return null;
  return (value / revenue) * 100;
}

// ── Weight delta (S&P 500) ─────────────────────────────────────────────────────
/**
 * Computes daily weight delta in basis points for each constituent.
 * Formula: w_prev × (r_stock − r_index) / (1 + r_index) × 10,000
 * r_index = weighted average of all constituent 1-day returns.
 */
export function computeWeightDeltas(
  constituents: SP500Constituent[],
): SP500Constituent[] {
  // Estimated index return = weighted average of 1-day changes
  const rIndex = constituents.reduce(
    (sum, c) => sum + (c.weightPct / 100) * (c.change1dPct / 100),
    0,
  );

  return constituents.map((c) => {
    const rStock = c.change1dPct / 100;
    const wDeltaBps =
      (c.weightPct * (rStock - rIndex)) / (1 + rIndex) * 100; // bps
    return {
      ...c,
      weightDeltaBps: parseFloat(wDeltaBps.toFixed(3)),
      weightPrev: parseFloat((c.weightPct - wDeltaBps / 100).toFixed(4)),
    };
  });
}

// ── Stress test calculation engine ────────────────────────────────────────────
export function computeStressTest(
  base: StressBaseInputs,
  assumptions: StressAssumptions,
): StressResult {
  const salesDecimally = assumptions.salesDeclinePct / 100;
  const stressedSales = base.sales * (1 - salesDecimally);
  const stressedGrossProfit = stressedSales * (assumptions.stressedGpmPct / 100);
  const stressedGpmPct = assumptions.stressedGpmPct;
  const cogsDelta = base.ebitda - (base.grossProfit - base.da); // approx SG&A
  const stressedEbitda = stressedGrossProfit - (base.sales - base.grossProfit) * 0 - cogsDelta;
  // Simpler: stressed EBITDA = stressed GP - (base SGA) where SGA ≈ base GP - base EBITDA - base DA
  const baseSga = base.grossProfit - base.ebitda - base.da;
  const cleanStressedEbitda = stressedGrossProfit - baseSga;
  const stressedEbitdaPct = stressedSales > 0 ? (cleanStressedEbitda / stressedSales) * 100 : 0;
  const ebitdar = cleanStressedEbitda + base.rentalExpense;

  // Interest adjusts for rate increase
  const stressedInterest = base.interestExpense * (1 + assumptions.interestRateIncreasePct / 100);

  // Cashflow coverage = EBITDA / (CPLTD + Interest)
  const cpltdPlusInterest = base.cpltd + stressedInterest;
  const cashflowCoverageMultiple =
    cpltdPlusInterest > 0 ? cleanStressedEbitda / cpltdPlusInterest : 0;

  // Free cash flow under stress
  const taxRate = base.sales > 0 ? base.incomeTax / base.sales : 0.25;
  const stressedTax = Math.max(0, (cleanStressedEbitda - base.da - stressedInterest) * taxRate);
  const stressedFcf =
    cleanStressedEbitda - base.da - stressedInterest - base.cpltd - base.capex - stressedTax - base.dividends;

  // Borrowing base components
  const eligibleAR = base.accountsReceivable * (1 - assumptions.arIneligiblesPct / 100);
  // Inventory slowdown increases inventory balance, quality cap limits eligibility
  const inventorySlowdownFactor = 1 + assumptions.inventorySlowdownMonths / 12;
  const stressedInventory = base.inventory * inventorySlowdownFactor;
  const eligibleInventory = stressedInventory * (assumptions.inventoryQualityCapPct / 100);
  const eligibleCash = base.cash;

  // Adjusted Funded Debt = Funded Debt − Cash − eligible AR − eligible Inventory + Payables
  const adjustedFundedDebt =
    base.fundedDebt - eligibleCash - eligibleAR - eligibleInventory + base.payables;

  const adjFundedDebtToEbitda =
    cleanStressedEbitda !== 0 ? adjustedFundedDebt / cleanStressedEbitda : 0;
  const fcfPlusCpltd = stressedFcf + base.cpltd;
  const adjFundedDebtToFcfPlusCpltd =
    fcfPlusCpltd !== 0 ? adjustedFundedDebt / fcfPlusCpltd : 0;

  return {
    stressedSales,
    stressedGrossProfit,
    stressedGpmPct,
    stressedEbitda: cleanStressedEbitda,
    stressedEbitdaPct,
    ebitdar,
    cpltd: base.cpltd,
    interest: stressedInterest,
    capex: base.capex,
    incomeTax: stressedTax,
    dividends: base.dividends,
    rentalExpense: base.rentalExpense,
    cashflowCoverageMultiple,
    freeCashFlow: stressedFcf,
    eligibleCash,
    eligibleAR,
    eligibleInventory,
    payables: base.payables,
    adjustedFundedDebt,
    adjFundedDebtToEbitda,
    adjFundedDebtToFcfPlusCpltd,
  };
}

// ── Derived balance sheet metrics ──────────────────────────────────────────────
export function tangibleNetWorth(bs: BalanceSheet): number | null {
  if (bs.totalEquity === null) return null;
  const gw = bs.goodwillAndIntangibles ?? 0;
  return bs.totalEquity - gw;
}

export function bookLeverage(bs: BalanceSheet): number | null {
  if (bs.totalDebt === null || bs.totalEquity === null || bs.totalEquity === 0) return null;
  return bs.totalDebt / bs.totalEquity;
}

// ── Color helpers ──────────────────────────────────────────────────────────────
export type ColorLevel = 'green' | 'amber' | 'red' | 'neutral';

export function marginColor(pct: number | null): ColorLevel {
  if (pct === null) return 'neutral';
  if (pct > 30) return 'green';
  if (pct > 10) return 'amber';
  if (pct >= 0) return 'red';
  return 'red';
}

export function coverageColor(multiple: number): ColorLevel {
  if (multiple > 2.0) return 'green';
  if (multiple >= 1.25) return 'amber';
  return 'red';
}

export function leverageColor(ratio: number): ColorLevel {
  if (ratio < 3.0) return 'green';
  if (ratio <= 5.0) return 'amber';
  return 'red';
}

// ── Data mappers (FMP API response → internal types) ──────────────────────────
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function mapIncomeStatement(raw: any, type: 'annual' | 'quarterly'): IncomeStatement {
  const n = (v: unknown) => (typeof v === 'number' ? v / 1e6 : null); // raw → $M
  return {
    period: {
      label: type === 'annual' ? `FY${raw.calendarYear}` : `${raw.period} ${raw.calendarYear}`,
      end: raw.date ?? '',
      type,
    },
    revenue: n(raw.revenue),
    costOfRevenue: n(raw.costOfRevenue),
    grossProfit: n(raw.grossProfit),
    researchAndDevelopment: n(raw.researchAndDevelopmentExpenses),
    sellingGeneralAdmin: n(raw.sellingGeneralAndAdministrativeExpenses),
    operatingIncome: n(raw.operatingIncome),
    depreciationAmortization: n(raw.depreciationAndAmortization),
    ebitda: n(raw.ebitda),
    interestExpense: n(raw.interestExpense),
    preTaxIncome: n(raw.incomeBeforeTax),
    incomeTax: n(raw.incomeTaxExpense),
    netIncome: n(raw.netIncome),
    operatingCashFlow: null, // from cash flow statement
    capitalExpenditure: null,
    freeCashFlow: null,
    dividendsPaid: null,
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function mapBalanceSheet(raw: any, type: 'annual' | 'quarterly'): BalanceSheet {
  const n = (v: unknown) => (typeof v === 'number' ? v / 1e6 : null);
  return {
    period: {
      label: type === 'annual' ? `FY${raw.calendarYear}` : `${raw.period} ${raw.calendarYear}`,
      end: raw.date ?? '',
      type,
    },
    cashAndEquivalents: n(raw.cashAndCashEquivalents),
    currentAssets: n(raw.totalCurrentAssets),
    currentLiabilities: n(raw.totalCurrentLiabilities),
    totalAssets: n(raw.totalAssets),
    totalLiabilities: n(raw.totalLiabilities),
    totalDebt: n(raw.totalDebt),
    goodwillAndIntangibles: n(
      ((raw.goodwill ?? 0) + (raw.intangibleAssets ?? 0)) as number,
    ),
    totalEquity: n(raw.totalStockholdersEquity),
  };
}
