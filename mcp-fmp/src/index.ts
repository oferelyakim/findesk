#!/usr/bin/env node
/**
 * FinDesk MCP — FMP Financial Data
 * Tools for Claude Desktop to pull financials directly from FMP
 *
 * Usage in claude_desktop_config.json:
 *   {
 *     "mcpServers": {
 *       "findesk-fmp": {
 *         "command": "node",
 *         "args": ["C:/Users/OferElyakim/findesk/mcp-fmp/dist/index.js"],
 *         "env": { "FMP_API_KEY": "<your-key>" }
 *       }
 *     }
 *   }
 */

import { Server }                  from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport }    from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';

const FMP_BASE = 'https://financialmodelingprep.com/stable';
const API_KEY  = process.env.FMP_API_KEY ?? '';

if (!API_KEY) {
  process.stderr.write('[findesk-mcp-fmp] WARNING: FMP_API_KEY is not set\n');
}

// ── Fetch helper ──────────────────────────────────────────────────────────────

async function fmpGet(path: string, params: Record<string, string> = {}): Promise<unknown> {
  const qs = new URLSearchParams({ ...params, apikey: API_KEY });
  const url = `${FMP_BASE}${path}?${qs}`;
  const res = await fetch(url);
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`FMP ${res.status}: ${text.slice(0, 200)}`);
  }
  return res.json();
}

// ── Tool definitions ──────────────────────────────────────────────────────────

const TOOLS = [
  {
    name: 'get_income_statement',
    description: 'Fetch income statements (P&L) for a company from FMP. Returns revenue, gross profit, EBITDA, operating income, net income, EPS for annual or quarterly periods.',
    inputSchema: {
      type: 'object',
      properties: {
        ticker: { type: 'string', description: 'Stock ticker symbol, e.g. AAPL' },
        period: { type: 'string', enum: ['annual', 'quarter'], description: 'Period type (default: annual)' },
        limit:  { type: 'number', description: 'Number of periods to return (default: 4)' },
      },
      required: ['ticker'],
    },
  },
  {
    name: 'get_balance_sheet',
    description: 'Fetch balance sheet statements for a company from FMP. Returns assets, liabilities, debt, equity, cash, inventory, receivables.',
    inputSchema: {
      type: 'object',
      properties: {
        ticker: { type: 'string', description: 'Stock ticker symbol' },
        period: { type: 'string', enum: ['annual', 'quarter'] },
        limit:  { type: 'number' },
      },
      required: ['ticker'],
    },
  },
  {
    name: 'get_cash_flow',
    description: 'Fetch cash flow statements for a company from FMP. Returns operating, investing, financing cash flows; free cash flow; capex.',
    inputSchema: {
      type: 'object',
      properties: {
        ticker: { type: 'string' },
        period: { type: 'string', enum: ['annual', 'quarter'] },
        limit:  { type: 'number' },
      },
      required: ['ticker'],
    },
  },
  {
    name: 'get_key_metrics',
    description: 'Fetch key financial metrics and valuation ratios for a company from FMP. Returns P/E, EV/EBITDA, P/FCF, debt/equity, ROE, ROA, current ratio, etc.',
    inputSchema: {
      type: 'object',
      properties: {
        ticker: { type: 'string' },
        period: { type: 'string', enum: ['annual', 'quarter'] },
        limit:  { type: 'number' },
      },
      required: ['ticker'],
    },
  },
  {
    name: 'get_financial_ratios',
    description: 'Fetch detailed financial ratios for a company from FMP. Returns profitability, liquidity, solvency, and efficiency ratios.',
    inputSchema: {
      type: 'object',
      properties: {
        ticker: { type: 'string' },
        period: { type: 'string', enum: ['annual', 'quarter'] },
        limit:  { type: 'number' },
      },
      required: ['ticker'],
    },
  },
  {
    name: 'get_sp500_constituents',
    description: 'Fetch the current list of S&P 500 constituents with their weights, prices, and recent performance from FMP.',
    inputSchema: {
      type: 'object',
      properties: {},
      required: [],
    },
  },
  {
    name: 'search_companies',
    description: 'Search for companies by name or ticker symbol. Returns matching companies with their exchange and sector.',
    inputSchema: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'Company name or ticker symbol to search for' },
        limit: { type: 'number', description: 'Maximum results to return (default: 10)' },
      },
      required: ['query'],
    },
  },
  {
    name: 'get_company_profile',
    description: 'Fetch company profile including description, sector, industry, CEO, employees, headquarters, website.',
    inputSchema: {
      type: 'object',
      properties: {
        ticker: { type: 'string' },
      },
      required: ['ticker'],
    },
  },
];

// ── Tool handlers ─────────────────────────────────────────────────────────────

async function callTool(name: string, args: Record<string, unknown>): Promise<string> {
  const ticker = (args.ticker as string | undefined)?.toUpperCase() ?? '';
  const period = (args.period as string | undefined) ?? 'annual';
  const limit  = String(args.limit ?? 4);
  const query  = args.query as string | undefined;

  let data: unknown;

  switch (name) {
    case 'get_income_statement':
      data = await fmpGet(`/income-statement/${ticker}`, { period, limit });
      break;
    case 'get_balance_sheet':
      data = await fmpGet(`/balance-sheet-statement/${ticker}`, { period, limit });
      break;
    case 'get_cash_flow':
      data = await fmpGet(`/cash-flow-statement/${ticker}`, { period, limit });
      break;
    case 'get_key_metrics':
      data = await fmpGet(`/key-metrics/${ticker}`, { period, limit });
      break;
    case 'get_financial_ratios':
      data = await fmpGet(`/ratios/${ticker}`, { period, limit });
      break;
    case 'get_sp500_constituents':
      data = await fmpGet('/sp500_constituent');
      break;
    case 'search_companies':
      data = await fmpGet('/search-ticker', { query: query ?? '', limit: String(args.limit ?? 10) });
      break;
    case 'get_company_profile':
      data = await fmpGet(`/profile/${ticker}`);
      break;
    default:
      throw new Error(`Unknown tool: ${name}`);
  }

  return JSON.stringify(data, null, 2);
}

// ── Server ────────────────────────────────────────────────────────────────────

const server = new Server(
  { name: 'findesk-mcp-fmp', version: '1.0.0' },
  { capabilities: { tools: {} } }
);

server.setRequestHandler(ListToolsRequestSchema, async () => ({ tools: TOOLS }));

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args = {} } = request.params;
  try {
    const text = await callTool(name, args as Record<string, unknown>);
    return { content: [{ type: 'text', text }] };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return {
      content: [{ type: 'text', text: `Error: ${message}` }],
      isError: true,
    };
  }
});

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  process.stderr.write('[findesk-mcp-fmp] Server started\n');
}

main().catch((err) => {
  process.stderr.write(`[findesk-mcp-fmp] Fatal: ${err}\n`);
  process.exit(1);
});
