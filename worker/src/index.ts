/**
 * FinDesk Cloudflare Worker — API proxy
 * Routes: /api/fmp/* → FMP stable API
 *         /api/alpaca/bars/:ticker → Alpaca historical bars
 *         /api/alpaca/quote/:ticker → Alpaca latest quote
 *
 * Secrets (set via `wrangler secret put`):
 *   FMP_API_KEY, ALPACA_KEY_ID, ALPACA_SECRET_KEY
 *
 * KV namespace: FINDESK_CACHE
 */

export interface Env {
  FMP_API_KEY:        string;
  ALPACA_KEY_ID:      string;
  ALPACA_SECRET_KEY:  string;
  FINDESK_CACHE:      KVNamespace;
}

const FMP_BASE    = 'https://financialmodelingprep.com/stable';
const ALPACA_BASE = 'https://data.alpaca.markets/v2';

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
    headers: {
      'Content-Type': 'application/json',
      ...corsHeaders(origin),
    },
  });
}

// ── KV cache helper ───────────────────────────────────────────────────────────

async function cachedFetch(
  env: Env,
  cacheKey: string,
  fetchFn: () => Promise<Response>,
  ttlSeconds: number
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

// ── FMP proxy ─────────────────────────────────────────────────────────────────

async function handleFMP(path: string, searchParams: URLSearchParams, env: Env): Promise<unknown> {
  const fmpPath = path.replace(/^\/api\/fmp/, '');

  // Build query string (forward all params + add apikey)
  const params = new URLSearchParams(searchParams);
  params.set('apikey', env.FMP_API_KEY);

  const url = `${FMP_BASE}${fmpPath}?${params.toString()}`;
  const cacheKey = `fmp:${fmpPath}:${params.toString()}`;

  // Use shorter TTL for price/quote endpoints, longer for statements
  const isStatementEndpoint =
    fmpPath.includes('income-statement') ||
    fmpPath.includes('balance-sheet') ||
    fmpPath.includes('cash-flow') ||
    fmpPath.includes('key-metrics') ||
    fmpPath.includes('financial-ratios');

  const ttl = isStatementEndpoint ? 3600 : 300; // 1hr for statements, 5min for price/index data

  return cachedFetch(env, cacheKey, () => fetch(url), ttl);
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
  const cacheKey = `alpaca:bars:${ticker}:${params.toString()}`;

  return cachedFetch(env, cacheKey, () => fetch(url, { headers: alpacaHeaders(env) }), 300);
}

async function handleAlpacaQuote(ticker: string, env: Env): Promise<unknown> {
  const url = `${ALPACA_BASE}/stocks/${ticker}/quotes/latest`;
  const cacheKey = `alpaca:quote:${ticker}`;

  return cachedFetch(env, cacheKey, () => fetch(url, { headers: alpacaHeaders(env) }), 60);
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
      if (path.startsWith('/api/fmp/')) {
        const data = await handleFMP(path, url.searchParams, env);
        return jsonResponse(data, 200, origin);
      }

      const alpacaBarsMatch = path.match(/^\/api\/alpaca\/bars\/(.+)$/);
      if (alpacaBarsMatch) {
        const ticker = alpacaBarsMatch[1].toUpperCase();
        const data = await handleAlpacaBars(ticker, url.searchParams, env);
        return jsonResponse(data, 200, origin);
      }

      const alpacaQuoteMatch = path.match(/^\/api\/alpaca\/quote\/(.+)$/);
      if (alpacaQuoteMatch) {
        const ticker = alpacaQuoteMatch[1].toUpperCase();
        const data = await handleAlpacaQuote(ticker, env);
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
