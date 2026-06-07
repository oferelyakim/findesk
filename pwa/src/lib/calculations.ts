import type {
  SP500Constituent,
  StressBaseInputs,
  StressAssumptions,
  StressResult,
  StressScenario,
  IncomeStatement,
  BalanceSheet,
} from '@/types';

// ── Formatting ─────────────────────────────────────────────────────────────────
export function fmtMillions(value: number | null | undefined): string {
  if (value === null || value === undefined) return '—';
  const abs = Math.abs(value);
  const sign = value < 0 ? '(' : '';
  const end  = value < 0 ? ')' : '';
  if (abs >= 1000) return `${sign}$${(abs / 1000).toFixed(1)}B${end}`;
  return `${sign}$${abs.toFixed(0)}M${end}`;
}

export function fmtPct(value: number | null | undefined, decimals = 1): string {
  if (value === null || value === undefined) return '—';
  return `${(value * 100).toFixed(decimals)}%`;
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
export function computeWeightDeltas(
  constituents: SP500Constituent[],
): SP500Constituent[] {
  const rIndex = constituents.reduce(
    (sum, c) => sum + (c.weight / 100) * (c.changesPercentage / 100),
    0,
  );

  return constituents.map((c) => {
    const rStock   = c.changesPercentage / 100;
    const wDeltaBps = (c.weight * (rStock - rIndex)) / (1 + rIndex) * 100;
    return {
      ...c,
      weightDeltaBps: parseFloat(wDeltaBps.toFixed(3)),
      weightPrev: parseFloat((c.weight - wDeltaBps / 100).toFixed(4)),
    };
  });
}

// ── Stress test calculation engine ────────────────────────────────────────────
export function computeStressTest(
  base: StressBaseInputs,
  assumptions: StressAssumptions,
): StressResult {
  // ── Base scenario ──
  const baseFcf = base.ebitda - base.interestExpense - base.capex;
  const baseCoverage = base.interestExpense > 0 ? base.ebitda / base.interestExpense : null;
  const baseDebtEbitda = base.ebitda > 0 ? base.totalDebt / base.ebitda : null;
  const baseEligibleAR = base.accountsReceivable * (1 - assumptions.arIneligiblesPct / 100);
  const baseEligibleInv = base.inventory * (assumptions.inventoryQualityCapPct / 100);
  const baseBBNet = base.cashAndEquivalents + baseEligibleAR + baseEligibleInv - base.accountsPayable;

  const baseScenario: StressScenario = {
    revenue:   base.revenue,
    grossProfit: base.grossProfit,
    ebitda:    base.ebitda,
    interestExpense: base.interestExpense,
    freeCashFlow: baseFcf,
    cashflowCoverageMultiple: baseCoverage,
    adjFundedDebtToEbitda: baseDebtEbitda,
    borrowingBase: {
      cash: base.cashAndEquivalents,
      eligibleAR: baseEligibleAR,
      eligibleInventory: baseEligibleInv,
      payables: base.accountsPayable,
      net: baseBBNet,
    },
  };

  // ── Stressed scenario ──
  const stressedRevenue = base.revenue * (1 - assumptions.salesDeclinePct / 100);
  const baseGpm = base.revenue > 0 ? base.grossProfit / base.revenue : 0;
  const stressedGpm = baseGpm - assumptions.grossMarginCompressionPct / 100;
  const stressedGrossProfit = stressedRevenue * stressedGpm;
  // SGA ≈ grossProfit - ebitda (simplification)
  const baseSga = base.grossProfit - base.ebitda;
  const stressedEbitda = stressedGrossProfit - baseSga;
  const stressedInterest = base.interestExpense * (1 + assumptions.interestRateIncreasePct / 100);
  const stressedFcf = stressedEbitda - stressedInterest - base.capex;
  const stressedCoverage = stressedInterest > 0 ? stressedEbitda / stressedInterest : null;
  const stressedDebtEbitda = stressedEbitda > 0 ? base.totalDebt / stressedEbitda : null;

  const stressedEligibleAR = base.accountsReceivable * (1 - assumptions.arIneligiblesPct / 100);
  const stressedInvBalance = base.inventory * (1 + assumptions.inventorySlowdownPct / 100);
  const stressedEligibleInv = stressedInvBalance * (assumptions.inventoryQualityCapPct / 100);
  const stressedBBNet = base.cashAndEquivalents + stressedEligibleAR + stressedEligibleInv - base.accountsPayable;

  const stressedScenario: StressScenario = {
    revenue: stressedRevenue,
    grossProfit: stressedGrossProfit,
    ebitda: stressedEbitda,
    interestExpense: stressedInterest,
    freeCashFlow: stressedFcf,
    cashflowCoverageMultiple: stressedCoverage,
    adjFundedDebtToEbitda: stressedDebtEbitda,
    borrowingBase: {
      cash: base.cashAndEquivalents,
      eligibleAR: stressedEligibleAR,
      eligibleInventory: stressedEligibleInv,
      payables: base.accountsPayable,
      net: stressedBBNet,
    },
  };

  return { base: baseScenario, stressed: stressedScenario };
}

// ── Color helpers ──────────────────────────────────────────────────────────────
export type ColorLevel = 'green' | 'amber' | 'red' | 'neutral';

export function marginColor(pct: number | null): ColorLevel {
  if (pct === null) return 'neutral';
  if (pct > 30) return 'green';
  if (pct > 10) return 'amber';
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
  const n = (v: unknown) => (typeof v === 'number' ? v / 1e6 : null);
  return {
    date: raw.date ?? '',
    period: type,
    revenue:    n(raw.revenue),
    costOfRevenue: n(raw.costOfRevenue),
    grossProfit: n(raw.grossProfit),
    researchAndDevelopment: n(raw.researchAndDevelopmentExpenses),
    researchAndDevelopmentExpenses: n(raw.researchAndDevelopmentExpenses),
    sellingGeneralAdministrativeExpenses: n(raw.sellingGeneralAndAdministrativeExpenses),
    operatingIncome: n(raw.operatingIncome),
    depreciationAmortization: n(raw.depreciationAndAmortization),
    depreciationAndAmortization: n(raw.depreciationAndAmortization),
    ebitda: n(raw.ebitda),
    interestExpense: n(raw.interestExpense),
    incomeBeforeTax: n(raw.incomeBeforeTax),
    incomeTaxExpense: n(raw.incomeTaxExpense),
    netIncome: n(raw.netIncome),
    epsDiluted: typeof raw.epsdiluted === 'number' ? raw.epsdiluted : (typeof raw.epsDiluted === 'number' ? raw.epsDiluted : null),
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function mapBalanceSheet(raw: any, type: 'annual' | 'quarterly'): BalanceSheet {
  const n = (v: unknown) => (typeof v === 'number' ? v / 1e6 : null);
  return {
    date: raw.date ?? '',
    period: type,
    cashAndEquivalents:     n(raw.cashAndCashEquivalents),
    shortTermInvestments:   n(raw.shortTermInvestments),
    netReceivables:         n(raw.netReceivables),
    inventory:              n(raw.inventory),
    currentAssets:          n(raw.totalCurrentAssets),
    propertyPlantEquipmentNet: n(raw.propertyPlantEquipmentNet),
    goodwill:               n(raw.goodwill),
    intangibleAssets:       n(raw.intangibleAssets),
    totalAssets:            n(raw.totalAssets),
    accountPayables:        n(raw.accountPayables),
    shortTermDebt:          n(raw.shortTermDebt),
    currentLiabilities:     n(raw.totalCurrentLiabilities),
    longTermDebt:           n(raw.longTermDebt),
    totalDebt:              n(raw.totalDebt),
    totalStockholdersEquity: n(raw.totalStockholdersEquity),
    totalEquity:            n(raw.totalStockholdersEquity),
  };
}

// ── Derived metrics ────────────────────────────────────────────────────────────
export function tangibleNetWorth(bs: BalanceSheet): number | null {
  if (bs.totalEquity === null) return null;
  const gw = (bs.goodwill ?? 0) + (bs.intangibleAssets ?? 0);
  return bs.totalEquity - gw;
}

export function bookLeverage(bs: BalanceSheet): number | null {
  if (bs.totalDebt === null || bs.totalEquity === null || bs.totalEquity === 0) return null;
  return bs.totalDebt / bs.totalEquity;
}
