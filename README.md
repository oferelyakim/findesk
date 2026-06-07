# FinDesk — Investment Analytics PWA

Personal investment analytics dashboard for an investment consultant.

## Features
- **S&P 500 tab** — daily weight changes (bps), top movers chart, sortable table, drill-down price charts
- **Company Analysis** — common-size P&L, balance sheet, key ratios, margin trends (any public company)
- **Credit Stress Test** — structured base vs. stressed model with color-coded coverage/leverage metrics
- **Saved Analyses** — save, reload, and export any analysis to Excel

## Stack
- React 18 + Vite + TypeScript strict
- TailwindCSS + CSS variables (dark theme)
- Zustand (UI state) + TanStack Query (server state, 5min stale)
- Recharts for all charts
- Supabase for auth + data persistence
- Cloudflare Worker as API proxy (FMP + Alpaca, with KV caching)
- Custom FMP MCP server for Claude Desktop integration
- vite-plugin-pwa for installable PWA

## Project structure
```
findesk/
├── pwa/          ← React PWA → Vercel
├── worker/       ← Cloudflare Worker API proxy
├── mcp-fmp/      ← Custom FMP MCP for Claude Desktop
├── supabase/     ← DB schema + RLS policies
└── docs/         ← Installation + User Guide
```

## Quick start (local dev)
```bash
# 1. Start the worker locally
cd worker && npm install && wrangler dev

# 2. In another terminal, start the PWA
cd pwa
cp .env.example .env.local  # fill in your values
npm install && npm run dev
```

## Deploy
See [`docs/INSTALLATION.md`](docs/INSTALLATION.md) for full setup including Supabase, Cloudflare, Vercel, and Claude Desktop MCP.

## Cost
$0/month at consultant scale:
- Vercel Hobby: free
- Supabase Free: 500MB, pauses after 1wk inactivity
- Cloudflare Worker Free: 100K req/day
- FMP Free: 250 API calls/day (cached via KV)
- Alpaca Free: 200 calls/min, 7yr history
