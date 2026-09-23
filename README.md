# Noman_trading — Gold Market Analytics

A working gold (XAU/USD) analytics dashboard: live spot price, a 20-signal cycle
timeline you can time-travel through, 70 charts and a browser-side alert engine.
Everything is computed from real market data — no mock values anywhere.

## Open it

Double-click `index.html`. That is the whole install — no build step, no server,
no npm. (Fonts are embedded so it also renders correctly from `file://`.)

Prefer a local URL (needed for desktop notifications)?

    serve.bat            # Windows: starts http://localhost:8899 and opens it

## Pages

- **Dashboard** — live gold pulse (spot, cycle index, breadth, gold/silver ratio),
  the Signal Timeline heatmap (click any column to time-travel the whole page),
  and the eight pinned charts as cards.
- **Charts** — the full library of 70 charts grouped by category, each with a
  preview sparkline. Open one for the full-size chart with range pills
  (1M/3M/6M/YTD/1Y/3Y/5Y/10Y/All), linear↔log scale, per-series toggles,
  comparison series on either axis, a 50/200-day MA overlay, gold milestone
  markers, gradient fill, a custom date range, a spreadsheet view of the
  underlying data, CSV download, PNG export and an embed link.
- **Signals** — cycle spectrum, consensus and 30d momentum, top movers, a watch
  list, and a table of 19 signals + the composite Cycle Index: score 0-100,
  7d/30d/90d/1y change, phase, position, 1y trend. Click a row for the score
  chart and the underlying metric. Tops & bottoms filter, category and phase
  filters, and a time machine date picker.
- **Monitor** — a live event feed: every threshold crossing, moving-average
  cross, new high, drawdown step and cycle-phase change detected from the price
  history, plus a "right now" state panel and the watch list.
- **Alerts** — price / 24h-change / RSI / cycle / drawdown / phase-change alerts.
  Evaluated in your browser every 20s against the live feed, with toasts, a
  beep and (on http or localhost) desktop notifications. Stored in localStorage.
- **About** — sources, method and disclaimer.

Sidebar: search (`/` focuses it), pinned charts (click the star to pin), and the
full A-Z chart list. Header: live price, light/dark theme, About.

## Hosted copies

    https://noman-trading.vercel.app      # public — share this with friends
    http://43.135.172.152:8899            # VPS (systemd service, always on)

Redeploy after a change (the project is already linked in `.vercel/`):

    vercel deploy --prod --yes

## Data

| Series | Source |
|---|---|
| Gold daily OHLC (2000→today, 6,540 sessions) | COMEX front-month futures (GC=F) via Yahoo Finance |
| Gold since 1968 | LBMA Gold PM auction, USD/oz |
| Silver, platinum, copper, crude, DXY, GDX, S&P 500 | Yahoo Finance (daily closes) |
| Inflation, 10Y real yield | FRED: CPIAUCSL, DFII10 |
| Live spot + intraday shape | gold-api.com (XAU) with a Binance PAXG/USDT fallback |

Indicators (RSI, MACD, Bollinger, ATR, realised volatility, z-scores, drawdowns,
rolling correlations, VaR, seasonality, CPI-adjusted price, cross-asset ratios)
are computed from those series. Signals are the rolling five-year percentile rank
of each metric, mapped to four phases: Bottom 0-25, Bearish 25-50, Bullish 50-75,
Top 75-100. The Cycle Index is the equal-weighted average of the signals.

## Refresh the data

    python tools/build_data.py             # fetch fresh data and rebuild
    python tools/build_data.py --offline    # rebuild from tools/raw/* only

Writes `js/data/nt-data.js`. Reload the page afterwards.

## Layout

    index.html          app shell
    css/app.css         design system (light + dark tokens, self-contained)
    js/app.js           router, shell, live gold feed, alert engine
    js/pages.js         dashboard / charts / signals / alerts / about
    js/charts.js        data facade, Highcharts theme, chart factory
    js/catalogue.js     the 70 chart definitions and stat tiles
    js/data/nt-data.js  generated dataset
    js/vendor/*         Highcharts 11 (offline, no CDN)
    tools/build_data.py data pipeline
    tools/raw/*         cached raw source files

Analytics and research only — not investment advice.
