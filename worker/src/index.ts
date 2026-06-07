/**
 * FinDesk Cloudflare Worker — API proxy
 * Routes:
 *   /api/spy/constituents  → SSGA SPY daily holdings XLSX (free, no auth)
 *   /api/fmp/*             → FMP stable API (requires FMP_API_KEY; Starter+ plan for sp500_constituent)
 *   /api/alpaca/bars/:ticker → Alpaca historical bars
 *   /api/alpaca/quote/:ticker → Alpaca latest quote
 *
 * Secrets (set via `wrangler secret put`):
 *   FMP_API_KEY, ALPACA_KEY_ID, ALPACA_SECRET_KEY
 *
 * KV namespace: FINDESK_CACHE
 */

// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore — xlsx is bundled by wrangler/esbuild; types not strictly needed
import * as XLSX from 'xlsx';

export interface Env {
  FMP_API_KEY:        string;
  ALPACA_KEY_ID:      string;
  ALPACA_SECRET_KEY:  string;
  FINDESK_CACHE:      KVNamespace;
}

const FMP_BASE        = 'https://financialmodelingprep.com/stable';
const ALPACA_BASE     = 'https://data.alpaca.markets/v2';
const SPY_HOLDINGS_URL = 'https://www.ssga.com/library-content/products/fund-data/etfs/us/holdings-daily-us-en-spy.xlsx';

const ALLOWED_ORIGINS = [
  'http://localhost:5173',
  'http://localhost:4173',
];

// ── CORS helpers ──────────────────────────────────────────────────────────────

function corsHeaders(origin: string | null): Record<string, string> {
  const allowed = origin && (ALLOWED_ORIGINS.includes(origin) || origin.endsWith('.vercel.app'));
  return {
    'Access-Control-Allow-Origin': allowed ? origin! : ALLOWED_ORIGINS[0],
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  };
}

function preflight(origin: string | null): Response {
  return new Response(null, { status: 204, headers: corsHeaders(origin) });
}

function jsonResponse(data: unknown, status = 200, origin: string | null = null): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', ...corsHeaders(origin) },
  });
}

// ── KV cache helper ───────────────────────────────────────────────────────────

async function cachedFetch(
  env: Env,
  cacheKey: string,
  fetchFn: () => Promise<Response>,
  ttlSeconds: number,
): Promise<unknown> {
  const cached = await env.FINDESK_CACHE.get(cacheKey, 'json');
  if (cached !== null) return cached;
  const response = await fetchFn();
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Upstream ${response.status}: ${text.slice(0, 200)}`);
  }
  const data = await response.json();
  await env.FINDESK_CACHE.put(cacheKey, JSON.stringify(data), { expirationTtl: ttlSeconds });
  return data;
}

// ── SPY daily holdings (SSGA) ─────────────────────────────────────────────────

interface SpyHolding {
  symbol: string;
  name:   string;
  weight: number; // percentage (e.g. 7.01 = 7.01%)
}

function parseSPYXlsx(buffer: ArrayBuffer): SpyHolding[] {
  // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
  const workbook = XLSX.read(new Uint8Array(buffer), { type: 'array' });
  // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
  const sheetName = workbook.SheetNames[0] as string;
  // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
  const sheet = workbook.Sheets[sheetName];
  // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
  const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: null }) as unknown[][];

  // Find header row that contains the "Weight" column
  let headerIdx = -1;
  for (let i = 0; i < Math.min(rows.length, 20); i++) {
    const row = rows[i];
    if (Array.isArray(row) &&
        row.some(c => typeof c === 'string' && c.toLowerCase().trim() === 'weight')) {
      headerIdx = i;
      break;
    }
  }
  if (headerIdx === -1) throw new Error('SPY XLSX: header row not found');

  const headers  = (rows[headerIdx] as unknown[]).map(h => String(h ?? '').toLowerCase().trim());
  const nameIdx   = headers.findIndex(h => h === 'name');
  const tickerIdx = headers.findIndex(h => h === 'ticker');
  const weightIdx = headers.findIndex(h => h === 'weight');

  if (nameIdx === -1 || tickerIdx === -1 || weightIdx === -1) {
    throw new Error(`SPY XLSX: missing columns — found: ${headers.join(', ')}`);
  }

  const holdings: SpyHolding[] = [];
  for (let i = headerIdx + 1; i < rows.length; i++) {
    const row    = rows[i] as unknown[];
    const symbol = String(row[tickerIdx] ?? '').trim();
    const name   = String(row[nameIdx]   ?? '').trim();
    const raw    = row[weightIdx];
    const weight = typeof raw === 'number' ? raw : parseFloat(String(raw ?? '0'));
    // Skip cash/empty rows
    if (!symbol || symbol === '-' || symbol.toLowerCase().includes('cash') || isNaN(weight)) continue;
    holdings.push({ symbol, name, weight });
  }
  return holdings;
}

async function handleSpyConstituents(env: Env, origin: string | null): Promise<Response> {
  const todayStr = new Date().toISOString().slice(0, 10);
  const prevStr  = new Date(Date.now() - 86_400_000).toISOString().slice(0, 10);
  const todayKey = `spy:${todayStr}`;
  const prevKey  = `spy:${prevStr}`;

  // Fetch today's holdings (from KV cache or live SSGA)
  let todayHoldings = await env.FINDESK_CACHE.get(todayKey, 'json') as SpyHolding[] | null;
  if (!todayHoldings) {
    const res = await fetch(SPY_HOLDINGS_URL, {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; FinDesk/1.0; +https://findesk.vercel.app)' },
    });
    if (!res.ok) throw new Error(`SSGA fetch failed: HTTP ${res.status}`);
    const buffer = await res.arrayBuffer();
    todayHoldings = parseSPYXlsx(buffer);
    // Cache for 8 hours — file updates once per trading day
    await env.FINDESK_CACHE.put(todayKey, JSON.stringify(todayHoldings), { expirationTtl: 8 * 3600 });
  }

  // Load previous snapshot for weight-delta calculation
  const prevHoldings = await env.FINDESK_CACHE.get(prevKey, 'json') as SpyHolding[] | null;
  const prevMap = new Map<string, number>((prevHoldings ?? []).map((h: SpyHolding) => [h.symbol, h.weight]));

  const result = todayHoldings.map((h: SpyHolding) => ({
    symbol:            h.symbol,
    name:              h.name,
    weight:            h.weight,
    price:             0,             // price data not in XLSX; enrich via Alpaca if needed
    changesPercentage: 0,             // daily % change not in XLSX
    weightDeltaBps:    prevMap.size > 0
      ? parseFloat(((h.weight - (prevMap.get(h.symbol) ?? h.weight)) * 100).toFixed(2))
      : null,                         // null on first load (no prior snapshot yet)
  }));

  return jsonResponse(result, 200, origin);
}

// ── Company search (Yahoo Finance — free, no auth) ────────────────────────────

async function handleSearch(query: string, env: Env, origin: string | null): Promise<Response> {
  if (!query.trim()) return jsonResponse([], 200, origin);
  const cacheKey = `search:${query.toLowerCase()}`;
  const cached = await env.FINDESK_CACHE.get(cacheKey, 'json');
  if (cached) return jsonResponse(cached, 200, origin);

  const url = `https://query1.finance.yahoo.com/v1/finance/search?q=${encodeURIComponent(query)}&quotesCount=10&newsCount=0&listsCount=0`;
  const res = await fetch(url, {
    headers: { 'User-Agent': 'Mozilla/5.0 (compatible; FinDesk/1.0)' },
  });
  if (!res.ok) throw new Error(`Yahoo search failed: HTTP ${res.status}`);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const data = await res.json() as any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const quotes: unknown[] = (data?.quotes ?? []).filter((q: any) =>
    q.quoteType === 'EQUITY' && q.symbol && !q.symbol.includes('.')
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  ).map((q: any) => ({
    symbol:            q.symbol,
    name:              q.shortname ?? q.longname ?? q.symbol,
    exchangeShortName: q.exchDisp ?? q.exchange ?? '',
    exchange:          q.exchDisp ?? '',
    type:              'stock',
  }));

  await env.FINDESK_CACHE.put(cacheKey, JSON.stringify(quotes), { expirationTtl: 300 });
  return jsonResponse(quotes, 200, origin);
}

// ── FMP proxy (requires Starter+ plan for index/constituent endpoints) ─────────

async function handleFMP(path: string, searchParams: URLSearchParams, env: Env): Promise<unknown> {
  const fmpPath = path.replace(/^\/api\/fmp/, '');
  const params = new URLSearchParams(searchParams);
  params.set('apikey', env.FMP_API_KEY);
  const url      = `${FMP_BASE}${fmpPath}?${params.toString()}`;
  const cacheKey = `fmp:${fmpPath}:${params.toString()}`;
  const isStatement =
    fmpPath.includes('income-statement') ||
    fmpPath.includes('balance-sheet') ||
    fmpPath.includes('cash-flow') ||
    fmpPath.includes('key-metrics') ||
    fmpPath.includes('financial-ratios');
  return cachedFetch(env, cacheKey, () => fetch(url), isStatement ? 3600 : 300);
}

// ── Alpaca proxy ──────────────────────────────────────────────────────────────

function alpacaHeaders(env: Env): Record<string, string> {
  return {
    'APCA-API-KEY-ID':     env.ALPACA_KEY_ID,
    'APCA-API-SECRET-KEY': env.ALPACA_SECRET_KEY,
    'Accept':              'application/json',
  };
}

async function handleAlpacaBars(ticker: string, searchParams: URLSearchParams, env: Env): Promise<unknown> {
  const params = new URLSearchParams(searchParams);
  params.set('symbols', ticker);
  const url = `${ALPACA_BASE}/stocks/bars?${params.toString()}`;
  return cachedFetch(env, `alpaca:bars:${ticker}:${params}`, () => fetch(url, { headers: alpacaHeaders(env) }), 300);
}

async function handleAlpacaQuote(ticker: string, env: Env): Promise<unknown> {
  const url = `${ALPACA_BASE}/stocks/${ticker}/quotes/latest`;
  return cachedFetch(env, `alpaca:quote:${ticker}`, () => fetch(url, { headers: alpacaHeaders(env) }), 60);
}

// ── Router ────────────────────────────────────────────────────────────────────

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url    = new URL(request.url);
    const path   = url.pathname;
    const origin = request.headers.get('Origin');

    if (request.method === 'OPTIONS') return preflight(origin);
    if (request.method !== 'GET') return jsonResponse({ error: 'Method not allowed' }, 405, origin);

    try {
      // SPY holdings (free — SSGA daily XLSX)
      if (path === '/api/spy/constituents') {
        return await handleSpyConstituents(env, origin);
      }

      // Company search (Yahoo Finance — free)
      if (path === '/api/search') {
        const query = url.searchParams.get('query') ?? '';
        return await handleSearch(query, env, origin);
      }

      // FMP proxy (free tier: fundamentals/search; premium: index constituents)
      if (path.startsWith('/api/fmp/')) {
        const data = await handleFMP(path, url.searchParams, env);
        return jsonResponse(data, 200, origin);
      }

      // Alpaca bars
      const alpacaBarsMatch = path.match(/^\/api\/alpaca\/bars\/(.+)$/);
      if (alpacaBarsMatch) {
        const data = await handleAlpacaBars(alpacaBarsMatch[1].toUpperCase(), url.searchParams, env);
        return jsonResponse(data, 200, origin);
      }

      // Alpaca quote
      const alpacaQuoteMatch = path.match(/^\/api\/alpaca\/quote\/(.+)$/);
      if (alpacaQuoteMatch) {
        const data = await handleAlpacaQuote(alpacaQuoteMatch[1].toUpperCase(), env);
        return jsonResponse(data, 200, origin);
      }

      if (path === '/health') {
        return jsonResponse({ status: 'ok', service: 'findesk-worker' }, 200, origin);
      }

      return jsonResponse({ error: 'Not found', path }, 404, origin);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      console.error('[worker]', message);
      return jsonResponse({ error: message }, 502, origin);
    }
  },
};
