import type {
  SP500Constituent,
  IncomeStatement,
  BalanceSheet,
  KeyMetrics,
  SearchResult,
} from '@/types';
import { mapIncomeStatement, mapBalanceSheet } from './calculations';

const WORKER_URL = import.meta.env.VITE_WORKER_URL as string;

async function workerFetch<T>(path: string): Promise<T> {
  const url = `${WORKER_URL}${path}`;
  const res = await fetch(url);
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`API error ${res.status}: ${text}`);
  }
  return res.json() as Promise<T>;
}

// ── S&P 500 ────────────────────────────────────────────────────────────────────
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapConstituent(raw: any, index: number): SP500Constituent {
  return {
    rank: index + 1,
    ticker: raw.symbol ?? raw.ticker ?? '',
    company: raw.name ?? raw.companyName ?? '',
    weightPct: typeof raw.weight === 'number' ? raw.weight : 0,
    price: typeof raw.price === 'number' ? raw.price : 0,
    change1dPct: typeof raw.changesPercentage === 'number' ? raw.changesPercentage : 0,
    ytdReturnPct: typeof raw.ytdReturn === 'number' ? raw.ytdReturn : 0,
  };
}

export async function fetchSP500Constituents(): Promise<SP500Constituent[]> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const data = await workerFetch<any[]>('/api/fmp/sp500_constituent');
  return data.map(mapConstituent);
}

// ── Company search ─────────────────────────────────────────────────────────────
export async function searchCompanies(query: string): Promise<SearchResult[]> {
  if (!query.trim()) return [];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const data = await workerFetch<any[]>(`/api/fmp/search-ticker?query=${encodeURIComponent(query)}&limit=10`);
  return data.map((r) => ({
    ticker: r.symbol ?? '',
    name: r.name ?? '',
    exchange: r.exchangeShortName ?? '',
    type: r.type ?? 'stock',
  }));
}

// ── Income statement ───────────────────────────────────────────────────────────
export async function fetchIncomeStatements(
  ticker: string,
  period: 'annual' | 'quarterly' = 'annual',
  limit = 5,
): Promise<IncomeStatement[]> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const data = await workerFetch<any[]>(
    `/api/fmp/income-statement/${ticker}?period=${period}&limit=${limit}`,
  );
  return data.map((r) => mapIncomeStatement(r, period));
}

// ── Balance sheet ──────────────────────────────────────────────────────────────
export async function fetchBalanceSheets(
  ticker: string,
  period: 'annual' | 'quarterly' = 'annual',
  limit = 5,
): Promise<BalanceSheet[]> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const data = await workerFetch<any[]>(
    `/api/fmp/balance-sheet-statement/${ticker}?period=${period}&limit=${limit}`,
  );
  return data.map((r) => mapBalanceSheet(r, period));
}

// ── Cash flow (merges into income statements) ──────────────────────────────────
export async function fetchCashFlows(
  ticker: string,
  period: 'annual' | 'quarterly' = 'annual',
  limit = 5,
): Promise<Record<string, { operatingCashFlow: number | null; capitalExpenditure: number | null; freeCashFlow: number | null; dividendsPaid: number | null }>> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const data = await workerFetch<any[]>(
    `/api/fmp/cash-flow-statement/${ticker}?period=${period}&limit=${limit}`,
  );
  const n = (v: unknown) => (typeof v === 'number' ? v / 1e6 : null);
  return Object.fromEntries(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    data.map((r: any) => [
      r.date,
      {
        operatingCashFlow: n(r.operatingCashFlow),
        capitalExpenditure: n(r.capitalExpenditure),
        freeCashFlow: n(r.freeCashFlow),
        dividendsPaid: n(r.dividendsPaid),
      },
    ]),
  );
}

// ── Key metrics ────────────────────────────────────────────────────────────────
export async function fetchKeyMetrics(
  ticker: string,
  period: 'annual' | 'quarterly' = 'annual',
  limit = 5,
): Promise<KeyMetrics[]> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const data = await workerFetch<any[]>(
    `/api/fmp/key-metrics/${ticker}?period=${period}&limit=${limit}`,
  );
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return data.map((r: any) => ({
    period: {
      label: period === 'annual' ? `FY${r.calendarYear}` : `${r.period} ${r.calendarYear}`,
      end: r.date ?? '',
      type: period,
    },
    grossMarginPct: typeof r.grossProfitMargin === 'number' ? r.grossProfitMargin * 100 : null,
    operatingMarginPct: typeof r.operatingProfitMargin === 'number' ? r.operatingProfitMargin * 100 : null,
    netMarginPct: typeof r.netProfitMargin === 'number' ? r.netProfitMargin * 100 : null,
    ebitdaMarginPct: null,
    currentRatio: r.currentRatio ?? null,
    debtToEquity: r.debtToEquity ?? null,
    interestCoverage: r.interestCoverage ?? null,
    freeCashFlowYield: r.freeCashFlowYield ? r.freeCashFlowYield * 100 : null,
    peRatio: r.peRatio ?? null,
    evToEbitda: r.evToEBITDA ?? null,
  }));
}

// ── Alpaca historical prices ───────────────────────────────────────────────────
export interface PriceBar {
  date: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export async function fetchHistoricalPrices(
  ticker: string,
  from: string, // YYYY-MM-DD
  to: string,
): Promise<PriceBar[]> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const data = await workerFetch<any>(
    `/api/alpaca/bars/${ticker}?start=${from}&end=${to}&timeframe=1Day`,
  );
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const bars: any[] = data?.bars ?? data ?? [];
  return bars.map((b) => ({
    date: b.t?.slice(0, 10) ?? b.date ?? '',
    open: b.o ?? b.open ?? 0,
    high: b.h ?? b.high ?? 0,
    low: b.l ?? b.low ?? 0,
    close: b.c ?? b.close ?? 0,
    volume: b.v ?? b.volume ?? 0,
  }));
}

// ── Date helpers ───────────────────────────────────────────────────────────────
export function daysAgo(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString().slice(0, 10);
}

export function today(): string {
  return new Date().toISOString().slice(0, 10);
}
