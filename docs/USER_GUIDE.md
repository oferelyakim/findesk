# FinDesk — User Guide

> FinDesk is your personal investment analytics dashboard. It pulls live financial data so you can analyze companies the way a bank analyst would — common-size P&L, balance sheet trends, and credit stress testing.

---

## Getting started

1. Open FinDesk in your browser (or install it as an app — click "Add to Home Screen" in Safari/Chrome)
2. Sign in with your email and password
3. You'll land on the **S&P 500** tab — already loaded with today's data

---

## Tab 1 — S&P 500

**What it shows:** Every company in the S&P 500, ranked by how much they shifted the index today.

**Key number — Weight Δ (bps):** This tells you how much a company *moved the index*, in basis points (1 bps = 0.01%). A company up 5% but with only 0.1% index weight barely matters; a company up 2% with 7% weight moves the needle a lot.

**How to use it:**
- The bar chart shows the 15 biggest movers today — use the tabs to switch between Weight Δ, 1-Day price %, or current index weight
- The table below shows all companies — click any column header to sort
- Click **View** next to any company for a 30-day price chart
- Use the search box to find a specific company
- Click **Export Excel** to download the full table

---

## Tab 2 — Company Analysis

**What it shows:** A bank-analyst-style P&L and balance sheet for any public company.

**How to use it:**
1. Type a company name or ticker in the search box (e.g. "Apple" or "AAPL")
2. Select from the dropdown — data loads automatically
3. Toggle **Annual / Quarterly** to switch periods
4. The **% Rev column** shows every P&L line as a % of total revenue — this is "common size" analysis, ideal for comparing margins across years or against competitors

**What the numbers mean:**
- **Gross Margin:** Revenue − Cost of Goods. Higher is better. Tech companies often 60-80%, retailers 20-40%.
- **EBITDA Margin:** Operating earnings before non-cash items. Proxy for cash generation capacity.
- **Operating Margin:** After SG&A and R&D. Measures core business efficiency.
- **Net Margin:** Bottom line after everything. Varies hugely by industry.

**The margin chart** at the top shows how margins changed over time — a falling line is a red flag.

**Saving your work:**
- Click **Save Analysis** and add an optional note (e.g. "Q4 review for client deck")
- This saves to your account — reload anytime from the **Saved** tab
- Saving also pre-fills the Stress Test tab with this company's latest figures

---

## Tab 3 — Credit Stress Test

**What it shows:** A structured model asking: *what happens to this company's ability to service debt if business deteriorates?*

**Three sections:**

**Section A — Base Figures ($M)**
The company's current financial position. If you saved a Company Analysis, click **"Load from [TICKER]"** to auto-fill from live FMP data. Or type in your own figures from a 10-K.

**Section B — Stress Assumptions**
How bad could it get?
- **Sales Decline %:** If revenues fell by X%, what happens? (e.g. 10 = down 10%)
- **Gross Margin Compression:** How many margin points are lost? (e.g. 3 = GPM falls by 3 percentage points)
- **AR Ineligibles %:** What % of receivables might not be collectible? (e.g. 15 = 15% excluded from borrowing base)
- **Inventory Slowdown %:** How much longer would inventory take to sell? (e.g. 20 = 20% slower turnover)
- **Inventory Quality Cap %:** Max % of inventory that counts toward lending value
- **Rate Increase %:** If floating-rate debt repriced higher by X% (e.g. 2 = +200 bps)

**Section C — Results**
The model computes Base vs Stressed side-by-side. Key metrics:

| Metric | What it means | Healthy |
|--------|--------------|---------|
| **Cashflow Coverage Multiple** | EBITDA ÷ (Interest + CPLTD). Can they pay debt from operations? | >2.0x ✅ |
| **Adj. Funded Debt / EBITDA** | How many years of earnings to repay debt? | <3.0x ✅ |
| **Net Borrowing Base** | Estimated working capital available as collateral | Positive |

**Color codes:**
- 🟢 **Green** — healthy range
- 🟡 **Amber** — watch closely
- 🔴 **Red** — distressed / needs attention

Click **Save Test** to store the scenario in your account.

---

## Tab 4 — Saved

**What it shows:** All your previously saved company analyses and stress tests.

**How to use it:**
- Click **Open** on any item to reload it into the relevant tab
- For analyses, reloading also pre-fills the Stress Test base figures
- Click the trash icon to delete (you'll be asked to confirm)
- Click **Export All** (analyses section) to download everything to Excel

---

## Using FinDesk with Claude (AI Analysis)

If your setup includes the FMP MCP server in Claude Desktop, you can ask Claude to analyze any company using live data. Try these prompts:

### S&P 500 Analysis
```
Using findesk-fmp, pull the S&P 500 constituent list and tell me which sectors are most overweighted today vs their historical average.
```

### Common-size P&L
```
Use findesk-fmp to get Apple's last 4 annual income statements. Build a common-size P&L and highlight any margin compression or expansion trends.
```

### Peer comparison
```
Using findesk-fmp, compare the gross margins, operating margins, and EV/EBITDA of AAPL, MSFT, and GOOGL for the last 3 years.
```

### Balance sheet health
```
Get Microsoft's last 3 annual balance sheets using findesk-fmp. How has their debt/equity changed? Is leverage increasing or decreasing?
```

### Stress test setup
```
Use findesk-fmp to get Nike's latest income statement and balance sheet. Based on those figures, suggest stress test inputs for a scenario where consumer spending falls 15% and interest rates rise 200 bps.
```

### Credit risk
```
Using findesk-fmp, get the key metrics and financial ratios for three retailers: WMT, TGT, COST. Which one has the strongest coverage ratios and lowest leverage? Rank them by credit quality.
```

### Quick snapshot
```
Using findesk-fmp, give me a one-paragraph investment thesis summary for Tesla based on the last 3 years of financial data.
```

### Find companies
```
Use findesk-fmp to search for semiconductor companies. Pick 3 and compare their R&D spending as a % of revenue.
```

### Sector deep dive
```
Get the income statements for the top 5 S&P 500 companies by weight using findesk-fmp. What is the combined revenue growth rate and blended net margin for this group?
```

### Dividend analysis
```
Use findesk-fmp key metrics to find which S&P 500 companies have dividend yields above 3% and payout ratios below 60%. List them with their current P/E and debt/equity.
```

---

## Tips for non-technical users

- **All data is live** — each time you open a company, FinDesk fetches fresh data from financial databases
- **The $ numbers are in millions** — so "1,234" means $1.234 billion
- **Negative numbers appear in red** — losses, debt increases, or cash outflows
- **You can't break anything** — all saves and edits are yours only; no one else sees your data
- **Install as an app** — in Chrome/Edge, click the install icon in the address bar for a desktop app experience

---

*FinDesk is for informational purposes only. Not financial advice. Always verify important figures with official filings (SEC EDGAR, company IR pages).*
