// ── S&P 500 ────────────────────────────────────────────────────────────────────
export interface SP500Constituent {
  rank: number;
  ticker: string;
  company: string;
  weightPct: number;       // current index weight %
  price: number;
  change1dPct: number;     // 1-day price change %
  ytdReturnPct: number;
  // Computed after load
  weightDeltaBps?: number; // daily weight change in basis points
  weightPrev?: number;     // estimated previous weight %
}

// ── Financial Statements ───────────────────────────────────────────────────────
export type PeriodType = 'annual' | 'quarterly';

export interface FinancialPeriod {
  label: string;   // e.g. "FY2024", "Q3 2024"
  end: string;     // period end date string
  type: PeriodType;
  months?: number; // for interim periods
}

export interface IncomeStatement {
  period: FinancialPeriod;
  revenue: number | null;
  costOfRevenue: number | null;
  grossProfit: number | null;
  researchAndDevelopment: number | null;
  sellingGeneralAdmin: number | null;
  operatingIncome: number | null;
  depreciationAmortization: number | null;
  ebitda: number | null;
  interestExpense: number | null;
  preTaxIncome: number | null;
  incomeTax: number | null;
  netIncome: number | null;
  operatingCashFlow: number | null;
  capitalExpenditure: number | null;
  freeCashFlow: number | null;
  dividendsPaid: number | null;
}

export interface BalanceSheet {
  period: FinancialPeriod;
  cashAndEquivalents: number | null;
  currentAssets: number | null;
  currentLiabilities: number | null;
  totalAssets: number | null;
  totalLiabilities: number | null;
  totalDebt: number | null;     // funded debt
  goodwillAndIntangibles: number | null;
  totalEquity: number | null;   // book equity
}

export interface KeyMetrics {
  period: FinancialPeriod;
  grossMarginPct: number | null;
  operatingMarginPct: number | null;
  netMarginPct: number | null;
  ebitdaMarginPct: number | null;
  currentRatio: number | null;
  debtToEquity: number | null;
  interestCoverage: number | null;
  freeCashFlowYield: number | null;
  peRatio: number | null;
  evToEbitda: number | null;
}

export interface CompanyAnalysis {
  ticker: string;
  companyName: string;
  currency: string;
  incomeStatements: IncomeStatement[];
  balanceSheets: BalanceSheet[];
  keyMetrics: KeyMetrics[];
  fetchedAt: string;
}

// ── Stress Test ────────────────────────────────────────────────────────────────
export interface StressBaseInputs {
  sales: number;
  cogs: number;
  grossProfit: number;
  gpmPct: number;
  ebitda: number;
  da: number;
  interestExpense: number;
  cpltd: number;       // current portion of long-term debt
  capex: number;
  incomeTax: number;
  dividends: number;
  freeCashFlow: number;
  fundedDebt: number;
  cash: number;
  accountsReceivable: number;
  inventory: number;
  payables: number;
  rentalExpense: number;
}

export interface StressAssumptions {
  salesDeclinePct: number;       // e.g. 15
  stressedGpmPct: number;        // e.g. 59.7
  arIneligiblesPct: number;      // e.g. 3
  inventorySlowdownMonths: number; // e.g. 1
  inventoryQualityCapPct: number;  // e.g. 85
  interestRateIncreasePct: number; // e.g. 0
}

export interface StressResult {
  // Stressed income metrics
  stressedSales: number;
  stressedGrossProfit: number;
  stressedGpmPct: number;
  stressedEbitda: number;
  stressedEbitdaPct: number;
  ebitdar: number;
  // Deductions
  cpltd: number;
  interest: number;
  capex: number;
  incomeTax: number;
  dividends: number;
  rentalExpense: number;
  // Coverage
  cashflowCoverageMultiple: number; // EBITDA / (CPLTD + Interest)
  freeCashFlow: number;
  // Borrowing base
  eligibleCash: number;
  eligibleAR: number;
  eligibleInventory: number;
  payables: number;
  adjustedFundedDebt: number;
  // Ratios
  adjFundedDebtToEbitda: number;
  adjFundedDebtToFcfPlusCpltd: number;
}

// ── Saved items ────────────────────────────────────────────────────────────────
export interface SavedAnalysis {
  id: string;
  ticker: string;
  companyName: string;
  data: CompanyAnalysis;
  note: string | null;
  createdAt: string;
}

export interface SavedStressTest {
  id: string;
  ticker: string | null;
  companyName: string | null;
  baseData: StressBaseInputs;
  assumptions: StressAssumptions;
  results: StressResult;
  note: string | null;
  createdAt: string;
}

// ── API responses ──────────────────────────────────────────────────────────────
export interface SearchResult {
  ticker: string;
  name: string;
  exchange: string;
  type: string;
}

export type AppTab = 'sp500' | 'company' | 'stress' | 'saved';
