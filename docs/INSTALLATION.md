# FinDesk — Installation Guide

> Step-by-step setup for the full FinDesk stack: PWA + Cloudflare Worker + FMP MCP server.
> Estimated time: ~30 minutes.

---

## Prerequisites

| Tool | Version | Install |
|------|---------|---------|
| Node.js | 20+ | https://nodejs.org |
| npm | 10+ | bundled with Node |
| Git | any | https://git-scm.com |
| Wrangler CLI | 3+ | `npm install -g wrangler` |
| A Cloudflare account | free | https://dash.cloudflare.com/sign-up |
| A Supabase account | free | https://supabase.com |
| A Vercel account | free | https://vercel.com |
| FMP API key | free | https://financialmodelingprep.com/developer/docs |
| Alpaca API key | free | https://app.alpaca.markets (create paper account) |

---

## Step 1 — Clone the repo to GitHub

1. Create a new GitHub repository (e.g. `findesk`)
2. In the `C:\Users\OferElyakim\findesk` folder run:
   ```
   git init
   git add .
   git commit -m "feat(findesk): initial commit"
   git remote add origin https://github.com/YOUR_USERNAME/findesk.git
   git push -u origin main
   ```

---

## Step 2 — Create Supabase project

1. Go to https://supabase.com and sign in
2. Click **New project**, name it `findesk` (different from your other projects)
3. Choose a region close to you, set a database password, click **Create project**
4. Once created, go to **Settings → API** and copy:
   - **Project URL** → save as `VITE_SUPABASE_URL`
   - **anon public** key → save as `VITE_SUPABASE_ANON_KEY`
5. Go to **SQL Editor**, paste the contents of `supabase/schema.sql`, click **Run**
6. Go to **Authentication → Providers → Email** — confirm it's enabled

---

## Step 3 — Set up Cloudflare Worker

1. Log in to Cloudflare: `wrangler login`
2. Create a KV namespace:
   ```
   wrangler kv namespace create FINDESK_CACHE
   ```
   Copy the `id` from the output and paste it into `worker/wrangler.toml`:
   ```toml
   id = "YOUR_KV_NAMESPACE_ID_HERE"
   ```
3. Set secrets (replace with your actual keys):
   ```
   cd findesk/worker
   wrangler secret put FMP_API_KEY
   wrangler secret put ALPACA_KEY_ID
   wrangler secret put ALPACA_SECRET_KEY
   ```
4. Install worker deps and deploy:
   ```
   npm install
   wrangler deploy
   ```
5. Note the deployed URL (e.g. `https://findesk-worker.YOUR.workers.dev`) — save as `VITE_WORKER_URL`

---

## Step 4 — Configure PWA environment

1. In `pwa/` create a file called `.env.local`:
   ```
   VITE_WORKER_URL=https://findesk-worker.YOUR.workers.dev
   VITE_SUPABASE_URL=https://YOUR_PROJECT.supabase.co
   VITE_SUPABASE_ANON_KEY=eyJ...
   ```
2. Test locally:
   ```
   cd findesk/pwa
   npm install
   npm run dev
   ```
   Open http://localhost:5173 — sign up, check S&P 500 tab loads

---

## Step 5 — Deploy PWA to Vercel

1. Go to https://vercel.com → **Add New Project**
2. Import from GitHub, select your `findesk` repo
3. Set **Root Directory** to `pwa`
4. Under **Environment Variables**, add all three:
   - `VITE_WORKER_URL`
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
5. Click **Deploy** — note your `.vercel.app` URL

6. Back in Cloudflare Worker, update CORS to allow your Vercel URL:
   The worker already allows any `*.vercel.app` origin — no change needed.

---

## Step 6 — Set up Alpaca MCP (optional, for Claude Desktop)

The official Alpaca MCP server works for market data in Claude Desktop:
```
npm install -g @alpacahq/alpaca-mcp-server
```

Add to your Claude Desktop config (`claude_desktop_config.json`):
```json
{
  "mcpServers": {
    "alpaca": {
      "command": "alpaca-mcp-server",
      "env": {
        "ALPACA_API_KEY_ID": "YOUR_ALPACA_KEY",
        "ALPACA_API_SECRET_KEY": "YOUR_ALPACA_SECRET",
        "ALPACA_PAPER": "true"
      }
    }
  }
}
```

---

## Step 7 — Set up FMP MCP for Claude Desktop

1. Build the MCP server:
   ```
   cd findesk/mcp-fmp
   npm install
   npm run build
   ```
2. Add to your Claude Desktop config:
   ```json
   {
     "mcpServers": {
       "findesk-fmp": {
         "command": "node",
         "args": ["C:/Users/OferElyakim/findesk/mcp-fmp/dist/index.js"],
         "env": {
           "FMP_API_KEY": "YOUR_FMP_API_KEY"
         }
       }
     }
   }
   ```
   On Windows, `claude_desktop_config.json` is at:
   `C:\Users\YOUR_USERNAME\AppData\Roaming\Claude\claude_desktop_config.json`

3. Restart Claude Desktop — you should see `findesk-fmp` in the MCP list

---

## Step 8 — Verify end-to-end

- [ ] PWA loads at your Vercel URL
- [ ] Sign up with an email and confirm
- [ ] S&P 500 tab loads data (may take a few seconds on first load)
- [ ] Company Analysis: search "AAPL" → P&L table populates
- [ ] Stress Test: enter some numbers → Section C auto-updates
- [ ] Save an analysis → appears in Saved tab
- [ ] Claude Desktop: try "Use the findesk-fmp tool to get Apple's income statement"

---

## Troubleshooting

| Symptom | Likely cause | Fix |
|---------|-------------|-----|
| S&P 500 tab shows "Error" | Worker not deployed or CORS | Check `VITE_WORKER_URL`, re-deploy worker |
| "Invalid URL" in supabase.ts | Missing env vars | Add `.env.local` to `pwa/` folder |
| Worker returns 502 | FMP key invalid or missing | Re-run `wrangler secret put FMP_API_KEY` |
| MCP tools not appearing | Config path or build missing | Run `npm run build` in `mcp-fmp/`, check config path |
| Auth not working | Supabase email confirmation | Check Supabase Auth settings → confirm email |
