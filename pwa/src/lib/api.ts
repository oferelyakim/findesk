import type { SP500Constituent, IncomeStatement, BalanceSheet, KeyMetrics, SearchResult, PriceBar } from '@/types';
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

// ── S&P 500 / SPY constituents ────────────────────────────────────────────────
// Source: SSGA SPY daily holdings XLSX (free, no auth required)
// The Worker fetches the file, parses weights, computes delta-bps vs yesterday's KV snapshot.
//
// FMP premium alternative (uncomment + comment out the free call below if you upgrade to Starter+):
// export async function fetchSP500Constituents(): Promise<SP500Constituent[]> {
//   const data = await workerFetch<any[]>('/api/fmp/sp500_constituent');
//   return data.map((raw: any) => ({
//     symbol: raw.symbol ?? '', name: raw.name ?? '',
//     weight: raw.weight ?? 0, price: raw.price ?? 0,
//     changesPercentage: raw.changesPercentage ?? 0,
//   }));
// }

export async function fetchSP500Constituents(): Promise<SP500Constituent[]> {
  return workerFetch<SP500Constituent[]>('/api/spy/constituents');
}

// ── Company search ─────────────────────────────────────────────────────────────
export async function searchCompanies(query: string): Promise<SearchResult[]> {
  if (!query.trim()) return [];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const data = await workerFetch<any[]>(`/api/fmp/search-ticker?query=${encodeURIComponent(query)}&limit=10`);
  return data.map((r) => ({
    symbol: r.symbol ?? '',
    name:   r.name ?? '',
    exchangeShortName: r.exchangeShortName ?? '',
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

// ── Cash flow ──────────────────────────────────────────────────────────────────
export async function fetchCashFlows(
  ticker: string,
  period: 'annual' | 'quarterly' = 'annual',
  limit = 5,
): Promise<Record<string, { operatingCashFlow: number | null; capitalExpenditure: number | null; freeCashFlow: number | null }>> {
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
        operatingCashFlow:  n(r.operatingCashFlow),
        capitalExpenditure: n(r.capitalExpenditure),
        freeCashFlow:       n(r.freeCashFlow),
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
  return data.map((r: any): KeyMetrics => ({
    date:   r.date ?? '',
    period: period,
    peRatio:   r.peRatio ?? null,
    evToEbitda: r.evToEBITDA ?? null,
    netProfitMargin: r.netProfitMargin ?? null,
    roe:       r.roe ?? null,
    debtToEquity: r.debtToEquity ?? null,
    currentRatio: r.currentRatio ?? null,
    grossProfitMargin: r.grossProfitMargin ?? null,
    operatingProfitMargin: r.operatingProfitMargin ?? null,
    interestCoverage: r.interestCoverage ?? null,
    freeCashFlowYield: r.freeCashFlowYield ?? null,
  }));
}

// ── Alpaca historical prices ───────────────────────────────────────────────────
export async function fetchHistoricalPrices(
  ticker: string,
  from: string,
  to: string,
): Promise<Record<string, PriceBar>> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const data = await workerFetch<any>(
    `/api/alpaca/bars/${ticker}?start=${from}&end=${to}&timeframe=1Day`,
  );
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const bars: any[] = data?.bars?.[ticker] ?? data?.bars ?? data ?? [];
  return Object.fromEntries(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    bars.map((b: any) => {
      const date = (b.t ?? b.date ?? '').slice(0, 10);
      return [date, { t: date, o: b.o ?? 0, h: b.h ?? 0, l: b.l ?? 0, c: b.c ?? 0, v: b.v ?? 0 }];
    }),
  );
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
