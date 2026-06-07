// ── S&P 500 ────────────────────────────────────────────────────────────────────
export interface SP500Constituent {
  symbol: string;
  name: string;
  weight: number;            // current index weight %
  price: number;
  changesPercentage: number; // 1-day price change %
  // Computed after load
  weightDeltaBps?: number;   // daily weight change in basis points
  weightPrev?: number;       // estimated previous weight %
}

// ── Financial Statements ───────────────────────────────────────────────────────
export type PeriodType = 'annual' | 'quarterly';

export interface IncomeStatement {
  date: string;
  period: PeriodType;
  revenue: number | null;
  costOfRevenue: number | null;
  grossProfit: number | null;
  researchAndDevelopment: number | null;
  sellingGeneralAdministrativeExpenses: number | null;
  operatingIncome: number | null;
  depreciationAmortization: number | null;
  ebitda: number | null;
  interestExpense: number | null;
  incomeBeforeTax: number | null;
  incomeTaxExpense: number | null;
  netIncome: number | null;
  epsDiluted: number | null;
  researchAndDevelopmentExpenses: number | null;
  depreciationAndAmortization: number | null;
}

export interface BalanceSheet {
  date: string;
  period: PeriodType;
  cashAndEquivalents: number | null;
  shortTermInvestments: number | null;
  netReceivables: number | null;
  inventory: number | null;
  currentAssets: number | null;
  propertyPlantEquipmentNet: number | null;
  goodwill: number | null;
  intangibleAssets: number | null;
  totalAssets: number | null;
  accountPayables: number | null;
  shortTermDebt: number | null;
  currentLiabilities: number | null;
  longTermDebt: number | null;
  totalDebt: number | null;
  totalStockholdersEquity: number | null;
  totalEquity: number | null;
}

export interface KeyMetrics {
  date: string;
  period: PeriodType;
  peRatio: number | null;
  evToEbitda: number | null;
  netProfitMargin: number | null;
  roe: number | null;
  debtToEquity: number | null;
  currentRatio: number | null;
  grossProfitMargin: number | null;
  operatingProfitMargin: number | null;
  interestCoverage: number | null;
  freeCashFlowYield: number | null;
}

export interface PriceBar {
  t: string;  // timestamp
  o: number;  // open
  h: number;  // high
  l: number;  // low
  c: number;  // close
  v: number;  // volume
}

// ── Stress Test ────────────────────────────────────────────────────────────────
export interface StressBaseInputs {
  ticker: string;
  revenue: number;
  grossProfit: number;
  ebitda: number;
  interestExpense: number;
  totalDebt: number;
  cashAndEquivalents: number;
  accountsReceivable: number;
  inventory: number;
  accountsPayable: number;
  capex: number;
}

export interface StressAssumptions {
  salesDeclinePct: number;
  grossMarginCompressionPct: number;
  arIneligiblesPct: number;
  inventorySlowdownPct: number;
  inventoryQualityCapPct: number;
  interestRateIncreasePct: number;
}

export interface StressScenario {
  revenue: number | null;
  grossProfit: number | null;
  ebitda: number | null;
  interestExpense: number | null;
  freeCashFlow: number | null;
  cashflowCoverageMultiple: number | null;
  adjFundedDebtToEbitda: number | null;
  borrowingBase: {
    cash: number | null;
    eligibleAR: number | null;
    eligibleInventory: number | null;
    payables: number | null;
    net: number | null;
  } | null;
}

export interface StressResult {
  base: StressScenario;
  stressed: StressScenario;
}

// ── Saved items ────────────────────────────────────────────────────────────────
export interface SavedAnalysis {
  id: string;
  ticker: string;
  note: string | null;
  incomeStatements: IncomeStatement[];
  balanceSheets: BalanceSheet[];
  savedAt: string;
}

export interface SavedStressTest {
  id: string;
  base: StressBaseInputs;
  assumptions: StressAssumptions;
  result: StressResult | null;
  savedAt: string;
}

// ── API responses ──────────────────────────────────────────────────────────────
export interface SearchResult {
  symbol: string;
  name: string;
  exchangeShortName: string;
  exchange: string;
  type: string;
}

export type AppTab = 'sp500' | 'company' | 'stress' | 'saved';
