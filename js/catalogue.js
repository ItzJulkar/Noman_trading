/* ==========================================================================
   Noman_trading — chart catalogue
   Every entry is backed by real, computed market data in js/data/nt-data.js
   ========================================================================== */
(function () {
  const C = window.NT_PALETTE = {
    ink: '#1f1e1c', primary: '#c96442', blue: '#2f6fb2', green: '#3b8f5a',
    gold: '#c8a24a', red: '#c0392b', violet: '#7c6bd1', grey: '#8d8a83', teal: '#2f8f8a'
  };

  // Gold market milestones — long-history charts get these as vertical markers
  const MILESTONES = window.NT_MILESTONES = [
    { d: '2001-04-02', label: 'Bull market begins' },
    { d: '2008-03-17', label: 'GFC peak' },
    { d: '2011-09-06', label: '2011 all-time high' },
    { d: '2013-04-15', label: '2013 sell-off' },
    { d: '2015-12-03', label: 'Cycle low' },
    { d: '2018-08-13', label: 'Breakout' },
    { d: '2020-08-06', label: 'COVID high' },
    { d: '2022-03-08', label: 'Rate shock' },
    { d: '2024-03-05', label: 'Central-bank buying surge' },
    { d: '2025-10-08', label: '$4,000 break' }
  ];

  const s = (id, label, color, extra) => Object.assign({ id, label, color }, extra || {});

  // ------------------------------------------------------------------ charts
  const charts = [
    /* ---------------------------------------------------------------- price */
    {
      slug: 'gold-price-ohlc', title: 'Gold Price (OHLC)', cat: 'Price', unit: 'usd', type: 'ohlc',
      log: true, popular: true, milestone: true, zoom: 'max',
      desc: 'Daily open-high-low-close for COMEX gold futures (front month, continuous series), the deepest liquid gold price series available. Log scale by default because the price has grown by a factor of eleven since 2000.',
      series: [s('gold_ohlc', 'Gold', C.primary)],
      stats: ['last', 'chg1d', 'high52', 'low52', 'ath']
    },
    {
      slug: 'gold-price', title: 'Gold Price (Close)', cat: 'Price', unit: 'usd', type: 'area',
      log: true, popular: false, milestone: true, zoom: 'max',
      desc: 'Daily closing price of gold, drawn as an area so the long-run trend and the major drawdowns are readable at a glance.',
      series: [s('gold_close', 'Gold close', C.primary, { area: true })],
      stats: ['last', 'chg1d', 'cagr', 'ath']
    },
    {
      slug: 'gold-since-1968', title: 'Gold since 1968 (LBMA PM fix)', cat: 'Price', unit: 'usd', type: 'line',
      log: true, popular: true, zoom: 'max', lbma: true,
      desc: 'The London PM auction price since April 1968 — the free-market price of gold after the London Gold Pool collapsed. Weekly sampling of the daily LBMA benchmark.',
      series: [{ id: 'lbma_close', label: 'LBMA gold PM', color: C.gold }],
      stats: ['lbmaLast', 'lbmaCagr', 'lbmaAth']
    },
    {
      slug: 'real-gold-price', title: 'Real (CPI-adjusted) gold price', cat: 'Price', unit: 'usd', type: 'line',
      log: false, popular: false, milestone: true, zoom: 'max',
      desc: 'Gold deflated by US CPI (CPIAUCSL, interpolated to a daily grid) and expressed in today\'s dollars. This is the honest way to compare the 1980, 2011 and 2026 highs.',
      series: [s('real_price', 'Real gold price', C.primary), s('gold_close', 'Nominal gold', C.grey, { width: 1.2 })],
      stats: ['realLast', 'realAth', 'realDd']
    },
    {
      slug: 'gold-price-drawdown', title: 'Drawdown from all-time high (%)', cat: 'Price', unit: 'pct', type: 'area',
      log: false, popular: true, zoom: 'max', negFill: true,
      desc: 'Percentage below the running all-time high. Gold rarely falls more than 45% from a peak outside of the 1980-1999 and 2011-2015 bear markets.',
      series: [s('drawdown', 'Drawdown', C.red, { area: true })],
      stats: ['ddLast', 'ddWorst', 'ddDays']
    },
    {
      slug: 'distance-from-200dma', title: 'Distance from 200-day MA (%)', cat: 'Price', unit: 'pct', type: 'line',
      log: false, popular: false, milestone: true, zoom: 'max',
      desc: 'How stretched the price is versus its 200-day average. Sustained readings above +15% have historically been late-cycle, below -10% late-bear.',
      series: [s('dist200', 'Distance 200DMA', C.primary)],
      stats: ['d200Last', 'd200Max', 'd200Min']
    },
    {
      slug: 'distance-from-200wma', title: 'Distance from 200-week MA (%)', cat: 'Price', unit: 'pct', type: 'line',
      log: false, popular: false, zoom: 'max',
      desc: 'The 200-week moving average is the classic long-term gold valuation line. Deep discounts have been generational buying zones.',
      series: [s('dist200w', 'Distance 200WMA', C.blue)],
      stats: ['d200wLast', 'd200wMax', 'd200wMin']
    },
    {
      slug: 'price-52w-range', title: 'Position in the 52-week range', cat: 'Price', unit: 'pct', type: 'area',
      log: false, popular: false, zoom: '10y',
      desc: 'Where the current price sits between the trailing 52-week low (0%) and high (100%).',
      series: [s('p52', 'Range position %', C.teal, { area: true })],
      computed: 'p52',
      stats: ['p52Last']
    },
    {
      slug: 'rolling-12m-return', title: 'Rolling 12-month return (%)', cat: 'Price', unit: 'pct', type: 'column',
      log: false, popular: false, milestone: true, zoom: 'max',
      desc: 'Trailing one-year return, the cleanest measure of gold\'s momentum regime.',
      series: [s('mom365', 'Rolling 12M return', C.primary)],
      stats: ['r12Last', 'r12Max', 'r12Min']
    },
    {
      slug: 'gold-log-returns', title: 'Daily returns distribution (1Y)', cat: 'Price', unit: 'pct', type: 'histogram',
      log: false, popular: false, zoom: 'max',
      desc: 'Histogram of the last 252 daily log returns — the shape of gold\'s day-to-day risk.',
      series: [s('ret1y', 'Daily returns', C.blue)],
      computed: 'ret1y',
      stats: ['retMean', 'retSd', 'retBest', 'retWorst']
    },

    /* ----------------------------------------------------- moving averages */
    {
      slug: 'moving-averages', title: 'Price vs moving averages (50/100/200D)', cat: 'Moving averages', unit: 'usd', type: 'line',
      log: true, popular: true, milestone: true, zoom: '10y',
      desc: 'Gold with the 50-day, 100-day and 200-day simple moving averages. Crossovers between the 50-day and 200-day are the standard trend filter.',
      series: [s('gold_close', 'Gold', C.ink, { width: 2 }), s('ma50', '50D MA', C.primary),
               s('ma100', '100D MA', C.blue), s('ma200', '200D MA', C.green)],
      stats: ['last', 'ma50x', 'ma200x']
    },
    {
      slug: 'weekly-moving-averages', title: 'Price vs weekly moving averages (50W/200W)', cat: 'Moving averages', unit: 'usd', type: 'line',
      log: true, popular: true, milestone: true, zoom: 'max',
      desc: 'The 50-week and 200-week averages smoothed on weekly closes. The 200-week line has marked the floor of every modern gold bear market.',
      series: [s('gold_close', 'Gold', C.ink, { width: 2 }), s('ma50w', '50W MA', C.primary),
               s('ma200w', '200W MA', C.violet)],
      stats: ['last', 'ma50wx', 'ma200wx']
    },
    {
      slug: 'golden-cross', title: 'Golden cross spread (50D - 200D, %)', cat: 'Moving averages', unit: 'pct', type: 'column',
      log: false, popular: false, zoom: 'max',
      desc: 'The gap between the 50-day and 200-day averages. Above zero is the bullish regime; the cross through zero is the signal traders watch.',
      series: [s('gc_spread', '50D - 200D %', C.primary)],
      computed: 'gc_spread',
      stats: ['gcLast']
    },
    {
      slug: 'bollinger-bands', title: 'Bollinger Bands (20, 2σ)', cat: 'Moving averages', unit: 'usd', type: 'line',
      log: true, popular: false, zoom: '5y',
      desc: '20-day moving average with two standard-deviation bands — a volatility envelope that shows when price is statistically extended in either direction.',
      series: [s('gold_close', 'Gold', C.ink, { width: 2 }), s('bb_up', 'Upper band', C.primary, { dash: 'ShortDash' }),
               s('bb_mid', '20D MA', C.grey), s('bb_dn', 'Lower band', C.blue, { dash: 'ShortDash' })],
      stats: ['last', 'bbPos']
    },
    {
      slug: 'ma-ribbon', title: 'MA ribbon (20/50/100/200D)', cat: 'Moving averages', unit: 'usd', type: 'line',
      log: true, popular: false, zoom: '5y',
      desc: 'Four moving averages on one axis. When the ribbon is fanned upward in order, the trend is aligned across every horizon.',
      series: [s('ma20', '20D MA', C.primary), s('ma50', '50D MA', C.gold),
               s('ma100', '100D MA', C.blue), s('ma200', '200D MA', C.green),
               s('gold_close', 'Gold', C.ink, { width: 2 })],
      stats: ['last', 'ma20']
    },
    {
      slug: 'price-vs-200wma', title: 'Price vs 200-week MA (dual axis)', cat: 'Moving averages', unit: 'usd', type: 'line',
      log: true, popular: false, zoom: 'max',
      desc: 'A closer look at the long-term valuation line: gold and its 200-week average, each on its own axis.',
      series: [s('gold_close', 'Gold', C.primary), s('ma200w', '200W MA', C.ink, { yAxis: 1 })],
      y2: true, stats: ['last', 'ma200wx']
    },
    {
      slug: 'atr', title: 'Average true range (ATR 14)', cat: 'Moving averages', unit: 'usd', type: 'area',
      log: false, popular: false, zoom: '5y',
      desc: '14-day average true range in dollars — the daily travelling range of gold, useful for positioning stops.',
      series: [s('atr14', 'ATR 14', C.violet, { area: true })],
      stats: ['atrLast', 'atrAvg']
    },

    /* ------------------------------------------------------------ momentum */
    {
      slug: 'rsi-14', title: 'RSI (14D)', cat: 'Momentum', unit: 'idx', type: 'line',
      log: false, popular: true, zoom: 'max', bands: [30, 70], min: 0, max: 100, milestone: true,
      desc: 'Wilder\'s Relative Strength Index on daily closes. Above 70 is overbought, below 30 oversold; in a bull market gold can hold 60-90 for months.',
      series: [s('rsi14', 'RSI 14D', C.violet)],
      stats: ['rsiLast', 'rsiD30', 'rsiExt']
    },
    {
      slug: 'rsi-weekly', title: 'RSI (14W weekly)', cat: 'Momentum', unit: 'idx', type: 'line',
      log: false, popular: false, zoom: 'max', bands: [30, 70], min: 0, max: 100,
      desc: 'Weekly RSI is the cycle filter — it turns only a handful of times per decade and has topped above 80 in every major gold peak.',
      series: [s('rsiw', 'RSI 14W', C.primary)],
      stats: ['rsiwLast']
    },
    {
      slug: 'macd', title: 'MACD (12, 26, 9)', cat: 'Momentum', unit: 'usd', type: 'macd',
      log: false, popular: false, zoom: '5y',
      desc: 'MACD line, signal line and histogram. The histogram flipping sign is the classic trend-change trigger.',
      series: [s('macd', 'MACD', C.blue), s('macd_sig', 'Signal', C.primary),
               s('macd_hist', 'Histogram', C.grey, { type: 'column' })],
      stats: ['macdLast', 'macdSig']
    },
    {
      slug: 'momentum-30d', title: 'Momentum 30D (%)', cat: 'Momentum', unit: 'pct', type: 'column',
      log: false, popular: false, zoom: 'max',
      desc: 'One-month rate of change. Sharp monthly spikes above +10% have clustered near short-term tops.',
      series: [s('mom30', 'Momentum 30D', C.primary)],
      stats: ['m30Last', 'm30Max', 'm30Min']
    },
    {
      slug: 'momentum-90d', title: 'Momentum 90D (%)', cat: 'Momentum', unit: 'pct', type: 'column',
      log: false, popular: false, zoom: 'max',
      desc: 'Quarterly rate of change — the medium-term trend leg.',
      series: [s('mom90', 'Momentum 90D', C.blue)],
      stats: ['m90Last']
    },
    {
      slug: 'momentum-180d', title: 'Momentum 180D (%)', cat: 'Momentum', unit: 'pct', type: 'area',
      log: false, popular: false, zoom: 'max',
      desc: 'Six-month momentum, the horizon that best separates gold bull legs from bear rallies.',
      series: [s('mom180', 'Momentum 180D', C.teal, { area: true })],
      stats: ['m180Last']
    },
    {
      slug: 'rate-of-change-12m', title: 'Rate of change 12M (%)', cat: 'Momentum', unit: 'pct', type: 'line',
      log: false, popular: false, milestone: true, zoom: 'max',
      desc: 'Year-over-year change. Readings above +40% have appeared in 1980, 2005-2006, 2011 and 2025-2026.',
      series: [s('mom365', 'RoC 12M', C.primary)],
      stats: ['r12Last']
    },
    {
      slug: 'weekly-returns', title: 'Weekly returns', cat: 'Momentum', unit: 'pct', type: 'column',
      log: false, popular: false, zoom: '5y',
      desc: 'Week-over-week percentage change. Useful for spotting the volatility clusters around macro events.',
      series: [s('wret', 'Weekly return', C.blue)],
      computed: 'wret',
      stats: ['wretLast', 'wretSd']
    },
    {
      slug: 'rsi-extremes', title: 'Days with RSI above 70 / below 30', cat: 'Momentum', unit: 'idx', type: 'column',
      log: false, popular: false, zoom: 'max',
      desc: 'Rolling 60-day count of overbought and oversold days — a persistence measure for trend strength.',
      series: [s('rsi70', 'Days RSI > 70', C.red), s('rsi30', 'Days RSI < 30', C.blue)],
      computed: 'rsiExtremes',
      stats: ['overbought', 'oversold']
    },

    /* ---------------------------------------------------------- volatility */
    {
      slug: 'realized-vol-30', title: 'Realized volatility 30D (ann. %)', cat: 'Volatility', unit: 'pct', type: 'area',
      log: false, popular: false, zoom: 'max',
      desc: 'Annualised standard deviation of the last 30 daily log returns. Gold typically lives between 10% and 25% annualised.',
      series: [s('vol30', 'Vol 30D', C.violet, { area: true })],
      stats: ['v30Last', 'v30Avg']
    },
    {
      slug: 'realized-vol-90', title: 'Realized volatility 90D (ann. %)', cat: 'Volatility', unit: 'pct', type: 'line',
      log: false, popular: false, zoom: 'max',
      desc: 'Quarterly realised volatility — the slower regime measure.',
      series: [s('vol90', 'Vol 90D', C.blue), s('vol365', 'Vol 1Y', C.grey)],
      stats: ['v90Last', 'v365Last']
    },
    {
      slug: 'vol-regime', title: 'Volatility regime (30D vs 1Y)', cat: 'Volatility', unit: 'pct', type: 'line',
      log: false, popular: false, zoom: '10y',
      desc: 'Short-term volatility divided by long-term volatility. Above 1 = turbulent market, below 1 = calm.',
      series: [s('volratio', 'Vol ratio', C.primary)],
      computed: 'volratio',
      stats: ['vrLast']
    },
    {
      slug: 'bollinger-width', title: 'Bollinger band width (%)', cat: 'Volatility', unit: 'pct', type: 'area',
      log: false, popular: false, zoom: 'max',
      desc: 'Band width compresses before every expansion. Squeezes below 5% have preceded gold\'s largest moves.',
      series: [s('bb_w', 'Band width', C.teal, { area: true })],
      stats: ['bbwLast', 'bbwAvg']
    },
    {
      slug: 'daily-range', title: 'Daily trading range (%)', cat: 'Volatility', unit: 'pct', type: 'column',
      log: false, popular: false, zoom: '2y',
      desc: 'High minus low as a percentage of the close, for every session of the last two years.',
      series: [s('drage', 'Daily range %', C.blue)],
      computed: 'drage',
      stats: ['drLast', 'drAvg']
    },
    {
      slug: 'vol-vs-price', title: 'Gold vs realized volatility (dual axis)', cat: 'Volatility', unit: 'usd', type: 'line',
      log: true, popular: false, zoom: '10y', y2: true,
      desc: 'Price on the left (log) axis and 30-day realised volatility on the right. Volatility spikes cluster at trend reversals, not trend ends.',
      series: [s('gold_close', 'Gold', C.ink), s('vol30', 'Vol 30D (right)', C.violet, { yAxis: 1 })],
      stats: ['last', 'v30Last']
    },

    /* ----------------------------------------------------------- valuation */
    {
      slug: 'stretch-zscore', title: 'Stretch Z-Score vs 200DMA', cat: 'Valuation', unit: 'z', type: 'line',
      log: false, popular: true, milestone: true, zoom: 'max',
      desc: 'How many standard deviations the price sits from its 200-day average. It is gold\'s closest analogue to the equity "overvaluation" z-score.',
      series: [s('z200', 'Z-score', C.violet)],
      stats: ['zLast', 'zMax', 'zMin']
    },
    {
      slug: 'zscore-zones', title: 'Z-Score with valuation zones', cat: 'Valuation', unit: 'z', type: 'line',
      log: false, popular: false, zoom: 'max', bands: [1, 2], negBands: [-1, -2], milestone: true,
      desc: 'The same z-score with ±1σ and ±2σ bands. Beyond ±2σ, mean reversion historically becomes the dominant force.',
      series: [s('z200', 'Z-score', C.primary)],
      stats: ['zLast', 'zMax', 'zMin']
    },
    {
      slug: 'real-price-drawdown', title: 'Real price drawdown (%)', cat: 'Valuation', unit: 'pct', type: 'area',
      log: false, popular: false, zoom: 'max',
      desc: 'Drawdown measured on the inflation-adjusted price — this is why 1980 and 2011 both took two decades to recover nominally.',
      series: [s('real_dd', 'Real drawdown', C.red, { area: true })],
      stats: ['rddLast', 'rddWorst']
    },
    {
      slug: 'cpi-vs-gold', title: 'Gold vs US CPI index', cat: 'Valuation', unit: 'idx', type: 'line',
      log: true, popular: false, zoom: 'max', y2: true,
      desc: 'Gold against the US consumer price index, both rebased to 100 at the start. Gold\'s job is to track the debasement of the currency — imperfectly, but over decades.',
      series: [s('gold_idx', 'Gold (rebased)', C.primary), s('cpi_idx', 'US CPI (rebased)', C.blue, { yAxis: 1 })],
      computed: 'rebased',
      stats: ['goldIdx', 'cpiIdx', 'gapIdx']
    },
    {
      slug: 'gold-vs-real-yield', title: 'Gold vs 10Y real yield', cat: 'Valuation', unit: 'usd', type: 'line',
      log: true, popular: true, zoom: 'max', y2: true, invert2: true,
      desc: 'Gold (left, log) against the US 10-year TIPS real yield (right, inverted). Real yields are gold\'s opportunity cost; the inverse correlation is the single cleanest macro relationship in the metal.',
      series: [s('gold_close', 'Gold', C.primary), s('realyield', '10Y real yield (right, inverted)', C.blue, { yAxis: 1 })],
      stats: ['last', 'ryLast', 'ryAvg']
    },
    {
      slug: 'real-yield', title: 'US 10Y real yield (%)', cat: 'Valuation', unit: 'pct', type: 'line',
      log: false, popular: false, zoom: 'max',
      desc: 'The 10-year TIPS yield (FRED DFII10) — the real cost of money. Rising real yields are a headwind for a zero-coupon asset like gold.',
      series: [s('realyield', '10Y real yield', C.blue)],
      stats: ['ryLast', 'ryMax', 'ryMin']
    },
    {
      slug: 'gold-vs-ma-premium', title: 'Premium to fair-value trend (%)', cat: 'Valuation', unit: 'pct', type: 'area',
      log: false, popular: false, zoom: 'max',
      desc: 'Percentage premium over the long-term log-linear trend of gold — a simple fair-value model that makes 1980, 2011 and 2025 comparable.',
      series: [s('trend_gap', 'Premium to trend', C.primary, { area: true })],
      computed: 'trend_gap',
      stats: ['tgLast', 'tgMax', 'tgMin']
    },

    /* --------------------------------------------------------------- cycle */
    {
      slug: 'cycle-index', title: 'Cycle Index (composite)', cat: 'Cycle', unit: 'score', type: 'line',
      log: false, popular: true, zoom: 'max', bands: [25, 50, 75], min: 0, max: 100, milestone: true,
      desc: 'Noman_trading\'s composite cycle score: the average percentile rank of 20 gold signals (momentum, valuation, risk, macro and cross-asset), each measured against its own five-year history. 0 = maximum pessimism, 100 = maximum optimism.',
      series: [s('sig:cycle', 'Cycle Index', C.primary, { width: 2.4 })],
      stats: ['cycleLast', 'cycleD30', 'cycleD90']
    },
    {
      slug: 'cycle-phase-timeline', title: 'Cycle phase timeline', cat: 'Cycle', unit: 'score', type: 'line',
      log: false, popular: false, zoom: 'max', bands: [25, 50, 75], min: 0, max: 100,
      desc: 'The Cycle Index with its phase bands: Bottom (0-25), Bearish (25-50), Bullish (50-75) and Top (75-100).',
      series: [s('sig:cycle', 'Cycle Index', C.ink)],
      stats: ['cycleLast', 'phaseNow']
    },
    {
      slug: 'bull-bear-regime', title: 'Bull / bear regime since 1968', cat: 'Cycle', unit: 'usd', type: 'line',
      log: true, popular: true, zoom: 'max', lbma: true,
      desc: 'Gold\'s secular cycles drawn on the LBMA price since 1968: the 1971-1980 bull, the 1980-1999 bear, the 2001-2011 bull, the 2011-2015 bear and the current cycle.',
      series: [{ id: 'lbma_close', label: 'LBMA gold', color: C.ink, width: 1.8 }],
      regimes: [
        { from: '1971-08-15', to: '1980-01-21', label: 'Bull 1971-80', color: 'rgba(201,100,66,0.10)' },
        { from: '1980-01-21', to: '1999-08-25', label: 'Bear 1980-99', color: 'rgba(63,111,159,0.10)' },
        { from: '1999-08-25', to: '2011-09-06', label: 'Bull 1999-2011', color: 'rgba(201,100,66,0.10)' },
        { from: '2011-09-06', to: '2015-12-03', label: 'Bear 2011-15', color: 'rgba(63,111,159,0.10)' },
        { from: '2015-12-03', to: '2026-12-31', label: 'Bull 2015-', color: 'rgba(201,100,66,0.10)' }
      ],
      stats: ['lbmaLast', 'lbmaCagr']
    },
    {
      slug: 'cycle-seasonality', title: 'Where we are in the year (seasonality)', cat: 'Cycle', unit: 'pct', type: 'seasonal',
      log: false, popular: false, zoom: 'max',
      desc: 'Gold\'s average monthly return since 2000, with the current month highlighted. September and January have been the strongest months; June the weakest.',
      series: [],
      stats: ['seasonNow', 'seasonBest', 'seasonWorst']
    },
    {
      slug: 'monthly-returns-heatmap', title: 'Monthly returns heatmap (year × month)', cat: 'Cycle', unit: 'pct', type: 'heatmap',
      log: false, popular: true, zoom: 'max',
      desc: 'Every month of gold\'s year-by-year performance since 2000, coloured from deep red (worst) to deep green (best). Reading down a column shows the seasonal effect; reading across a row shows the year.',
      series: [],
      stats: ['bestMonth', 'worstMonth']
    },
    {
      slug: 'yearly-returns', title: 'Yearly returns (%)', cat: 'Cycle', unit: 'pct', type: 'column',
      log: false, popular: false, zoom: 'max', data: 'yearly',
      desc: 'Calendar-year performance of gold, with green for up years and red for down years. Gold has had only seven losing years since 2000.',
      series: [],
      stats: ['bestYear', 'worstYear', 'winYears']
    },
    {
      slug: 'seasonality-winrate', title: 'Seasonality win rate by month', cat: 'Cycle', unit: 'pct', type: 'column',
      log: false, popular: false, zoom: 'max', data: 'seasonWin',
      desc: 'The share of years in which each calendar month closed higher than it opened.',
      series: [],
      stats: ['seasonBestWin', 'seasonWorstWin']
    },

    /* --------------------------------------------------------- cross-asset */
    {
      slug: 'gold-silver-ratio', title: 'Gold / Silver ratio', cat: 'Cross-asset', unit: 'ratio', type: 'line',
      log: false, popular: true, zoom: 'max', milestone: true,
      desc: 'Ounces of silver per ounce of gold. Above 80 silver is historically cheap relative to gold; below 50 gold is cheap relative to silver. Silver is the high-beta expression of the same monetary trade.',
      series: [s('gsr', 'Gold / Silver', C.primary)],
      stats: ['gsrLast', 'gsrMin', 'gsrMax']
    },
    {
      slug: 'gold-vs-silver', title: 'Gold vs Silver (rebased)', cat: 'Cross-asset', unit: 'idx', type: 'line',
      log: true, popular: false, zoom: 'max', y2: true,
      desc: 'Both metals rebased to 100 at the start of the window, so you can see silver\'s leverage in both directions.',
      series: [s('gold_idx', 'Gold (rebased)', C.gold), s('silver_idx', 'Silver (rebased)', C.grey, { yAxis: 1 })],
      computed: 'rebased2',
      stats: ['goldIdx', 'silverIdx']
    },
    {
      slug: 'gold-platinum-ratio', title: 'Gold / Platinum ratio', cat: 'Cross-asset', unit: 'ratio', type: 'line',
      log: false, popular: false, zoom: 'max',
      desc: 'Gold versus platinum, its industrial cousin. The ratio above 1 has persisted since 2015.',
      series: [s('gpr', 'Gold / Platinum', C.blue)],
      stats: ['gprLast']
    },
    {
      slug: 'gold-oil-ratio', title: 'Gold / Oil ratio', cat: 'Cross-asset', unit: 'ratio', type: 'line',
      log: false, popular: false, zoom: 'max',
      desc: 'Barrels of crude oil per ounce of gold — a real-terms purchasing-power measure of the metal.',
      series: [s('gor', 'Gold / Oil', C.teal)],
      stats: ['gorLast', 'gorMax']
    },
    {
      slug: 'gold-copper-ratio', title: 'Gold / Copper ratio', cat: 'Cross-asset', unit: 'ratio', type: 'line',
      log: false, popular: false, zoom: 'max',
      desc: 'Gold (monetary) against copper (industrial). A rising ratio is a growth-scare tell.',
      series: [s('gcr', 'Gold / Copper', C.violet)],
      stats: ['gcrLast']
    },
    {
      slug: 'miner-leverage', title: 'Miners vs gold (GDX / Gold)', cat: 'Cross-asset', unit: 'ratio', type: 'line',
      log: false, popular: false, zoom: 'max', milestone: true,
      desc: 'The gold-miners index divided by the gold price. This ratio is the equity market\'s opinion of the gold price — it leads at cycle turns more often than it follows.',
      series: [s('gdx_gold', 'GDX / Gold', C.primary)],
      stats: ['gdxgLast', 'gdxgMax']
    },
    {
      slug: 'gold-vs-spx', title: 'Gold vs S&P 500 (relative strength)', cat: 'Cross-asset', unit: 'ratio', type: 'line',
      log: true, popular: false, zoom: 'max',
      desc: 'Gold relative to US equities. Peaks in this ratio mark the moments when hard assets take over from risk assets.',
      series: [s('gold_spx', 'Gold / S&P 500', C.primary)],
      stats: ['gspxLast', 'gspxMax']
    },
    {
      slug: 'gold-vs-spx-rebased', title: 'Gold vs S&P 500 (both rebased)', cat: 'Cross-asset', unit: 'idx', type: 'line',
      log: true, popular: false, zoom: 'max', y2: true,
      desc: 'Total return comparison rebased to 100, so the two asset classes compete on one chart.',
      series: [s('gold_idx', 'Gold', C.gold), s('spx_idx', 'S&P 500', C.blue, { yAxis: 1 })],
      computed: 'rebased3',
      stats: ['goldIdx', 'spxIdx']
    },

    /* --------------------------------------------------------------- macro */
    {
      slug: 'gold-vs-dollar', title: 'Gold vs US Dollar Index', cat: 'Macro', unit: 'usd', type: 'line',
      log: true, popular: true, zoom: 'max', y2: true,
      desc: 'Gold against the ICE US Dollar Index (DXY). Dollar strength is the mechanical headwind for any dollar-priced asset, and gold is the purest example.',
      series: [s('gold_close', 'Gold', C.primary), s('dxy', 'DXY (right)', C.blue, { yAxis: 1 })],
      stats: ['last', 'dxyLast']
    },
    {
      slug: 'dollar-index', title: 'US Dollar Index (DXY)', cat: 'Macro', unit: 'idx', type: 'line',
      log: false, popular: false, zoom: 'max',
      desc: 'The trade-weighted dollar against a basket of major currencies.',
      series: [s('dxy', 'DXY', C.blue)],
      stats: ['dxyLast', 'dxyMax', 'dxyMin']
    },
    {
      slug: 'inverse-dollar', title: 'Inverse dollar (100 / DXY)', cat: 'Macro', unit: 'idx', type: 'area',
      log: false, popular: false, zoom: 'max',
      desc: 'The dollar index flipped upside down — the shape gold traders actually want to watch.',
      series: [s('dxy_inv', 'Inverse DXY', C.teal, { area: true })],
      stats: ['dxyInvLast']
    },
    {
      slug: 'dollar-pressure', title: 'Dollar pressure score (inverted DXY rank)', cat: 'Macro', unit: 'score', type: 'line',
      log: false, popular: false, zoom: 'max', min: 0, max: 100, bands: [25, 50, 75],
      desc: 'The DXY percentile rank, inverted so that a high score means a weak dollar — a tailwind for gold. One of the 20 signals in the Cycle Index.',
      series: [s('sig:dxy', 'Dollar pressure', C.blue)],
      stats: ['dxyScore']
    },
    {
      slug: 'real-yield-pressure', title: 'Real yield pressure score', cat: 'Macro', unit: 'score', type: 'line',
      log: false, popular: false, zoom: 'max', min: 0, max: 100, bands: [25, 50, 75],
      desc: 'The 10-year real yield percentile rank, inverted. High score = low real yields = favourable for gold.',
      series: [s('sig:realy', 'Real yield pressure', C.violet)],
      stats: ['ryScore']
    },
    {
      slug: 'gold-vs-crude', title: 'Gold vs Crude oil (rebased)', cat: 'Macro', unit: 'idx', type: 'line',
      log: true, popular: false, zoom: 'max', y2: true,
      desc: 'Gold and WTI crude rebased to 100 — the two ends of the inflation trade.',
      series: [s('gold_idx', 'Gold', C.gold), s('oil_idx', 'WTI crude', C.ink, { yAxis: 1 })],
      computed: 'rebased4',
      stats: ['goldIdx', 'oilIdx']
    },

    /* ----------------------------------------------------------- inflation */
    {
      slug: 'cpi-index', title: 'US CPI index (CPIAUCSL)', cat: 'Inflation', unit: 'idx', type: 'line',
      log: false, popular: false, zoom: 'max',
      desc: 'The US consumer price index, the deflator used for the real gold price. Monthly data, forward-filled onto the trading calendar.',
      series: [s('cpi_idx', 'CPI', C.blue)],
      computed: 'cpi',
      stats: ['cpiLast', 'cpiYoy']
    },
    {
      slug: 'gold-inflation-beta', title: 'Gold\'s rolling 5Y inflation beta', cat: 'Inflation', unit: 'ratio', type: 'line',
      log: false, popular: false, zoom: 'max',
      desc: 'How much gold has moved for each 1% move in the CPI level, measured on a rolling five-year window. A beta near 1 means gold has fully protected purchasing power over that horizon.',
      series: [s('infl_beta', '5Y inflation beta', C.primary)],
      computed: 'infl_beta',
      stats: ['betaLast', 'betaAvg']
    },

    /* ---------------------------------------------------------- seasonality */
    {
      slug: 'seasonality-avg', title: 'Average return by month (%)', cat: 'Seasonality', unit: 'pct', type: 'seasonal',
      log: false, popular: false, zoom: 'max',
      desc: 'Average calendar-month return since 2000 with the median as a cross-check.',
      series: [],
      stats: ['seasonBest', 'seasonWorst']
    },
    {
      slug: 'seasonality-range', title: 'Best and worst month by year', cat: 'Seasonality', unit: 'pct', type: 'heatmap',
      log: false, popular: false, zoom: 'max',
      desc: 'For every year, the strongest and weakest month. Useful for seeing how much of a year\'s move arrives in a single month.',
      series: [],
      stats: ['bestMonth', 'worstMonth']
    },

    /* ---------------------------------------------------------------- risk */
    {
      slug: 'drawdown-duration', title: 'Drawdown depth and duration', cat: 'Risk', unit: 'pct', type: 'area',
      log: false, popular: false, zoom: 'max', negFill: true,
      desc: 'Drawdown depth on the same axis as the running peak, so you can read both the size and the length of each underwater period.',
      series: [s('drawdown', 'Drawdown', C.red, { area: true })],
      stats: ['ddWorst', 'ddDays']
    },
    {
      slug: 'worst-drawdowns', title: 'Gold\'s ten worst drawdowns', cat: 'Risk', unit: 'pct', type: 'table',
      log: false, popular: false, zoom: 'max',
      desc: 'The ten deepest peak-to-trough declines in the futures era, with depth, duration and recovery time for each.',
      series: [],
      computed: 'drawdowns',
      stats: []
    },
    {
      slug: 'risk-reward', title: 'Rolling 1Y return vs risk', cat: 'Risk', unit: 'ratio', type: 'scatter',
      log: false, popular: false, zoom: 'max',
      desc: 'Each point is one week of the last ten years: annualised return against annualised volatility. The upper-left region is where gold pays you best per unit of risk taken.',
      series: [],
      computed: 'riskreward',
      stats: []
    },
    {
      slug: 'correlation-spx', title: 'Rolling 90D correlation with S&P 500', cat: 'Risk', unit: 'ratio', type: 'line',
      log: false, popular: false, zoom: 'max', min: -1, max: 1, bands: [0],
      desc: 'Gold\'s diversification claim, tested: correlation with US equities over a rolling quarter. It goes up in liquidity crises — which is exactly when diversification is supposed to work.',
      series: [s('corr_spx', 'Correlation 90D', C.primary)],
      computed: 'corr_spx',
      stats: ['corrLast', 'corrAvg']
    },
    {
      slug: 'correlation-dxy', title: 'Rolling 90D correlation with DXY', cat: 'Risk', unit: 'ratio', type: 'line',
      log: false, popular: false, zoom: 'max', min: -1, max: 1, bands: [0],
      desc: 'How tightly gold has tracked the inverse of the dollar over a rolling quarter.',
      series: [s('corr_dxy', 'Correlation 90D', C.blue)],
      computed: 'corr_dxy',
      stats: ['corrdxyLast']
    },
    {
      slug: 'value-at-risk', title: '95% one-day value at risk (%)', cat: 'Risk', unit: 'pct', type: 'area',
      log: false, popular: false, zoom: 'max',
      desc: 'The historical 5th-percentile daily move over a rolling 250-day window — the loss a 95% confidence level would not be exceeded on a normal day.',
      series: [s('var95', 'VaR 95%', C.red, { area: true })],
      computed: 'var95',
      stats: ['varLast']
    }
  ];

  // ------------------------------------------------------------ computed data
  // Derived series that the Python builder does not ship are computed here,
  // once, from the raw series so every page agrees on the numbers.
  function computeDerived(D) {
    const S = D.series, N = S.dates.length, add = (k, a) => { S[k] = a; return a; };
    const last = (a, n = 1) => { for (let i = N - n; i >= 0; i--) if (a[i] != null) return a[i]; return null; };
    const pct = (a, b) => (a && b ? (a / b - 1) * 100 : null);
    const num = (v, d = 2) => (v == null || !isFinite(v) ? null : Math.round(v * 10 ** d) / 10 ** d);

    // ma20
    const ma20 = new Array(N).fill(null); let sum = 0;
    for (let i = 0; i < N; i++) { sum += S.gold_close[i]; if (i >= 20) sum -= S.gold_close[i - 20]; if (i >= 19) ma20[i] = sum / 20; }
    add('ma20', ma20.map(v => num(v)));

    // 52w range position
    add('p52', S.gold_close.map((v, i) => {
      if (i < 252) return null;
      const w = S.gold_close.slice(i - 252, i + 1);
      const hi = Math.max(...w), lo = Math.min(...w);
      return hi === lo ? 50 : num(((v - lo) / (hi - lo)) * 100, 1);
    }));

    // weekly returns on the daily grid (last trading day of week)
    const wret = new Array(N).fill(null);
    for (let i = 5; i < N; i++) {
      const d = new Date(S.dates[i]), p = new Date(S.dates[i - 1]);
      if (d.getUTCDay() < p.getUTCDay()) wret[i] = num(pct(S.gold_close[i], S.gold_close[i - 1]), 2);
    }
    add('wret', wret);

    // daily high-low range %
    add('drage', S.gold_ohlc.map(x => x ? num(((x[1] - x[2]) / x[3]) * 100, 2) : null));

    // golden cross spread
    add('gc_spread', S.ma50.map((v, i) => (v && S.ma200[i] ? num(pct(v, S.ma200[i]), 2) : null)));

    // volatility ratio
    add('volratio', S.vol30.map((v, i) => (v && S.vol365[i] ? num(v / S.vol365[i], 3) : null)));

    // RSI persistence counters
    const r70 = new Array(N).fill(null), r30 = new Array(N).fill(null);
    for (let i = 60; i < N; i++) {
      let a = 0, b = 0;
      for (let k = i - 59; k <= i; k++) { if (S.rsi14[k] == null) continue; if (S.rsi14[k] > 70) a++; if (S.rsi14[k] < 30) b++; }
      r70[i] = a; r30[i] = b;
    }
    add('rsi70', r70); add('rsi30', r30);

    // log-linear trend premium (regression on log price since 2000)
    const xs = [], ys = [];
    for (let i = 0; i < N; i++) { if (S.gold_close[i] > 0) { xs.push(i); ys.push(Math.log(S.gold_close[i])); } }
    const mx = xs.reduce((a, b) => a + b, 0) / xs.length, my = ys.reduce((a, b) => a + b, 0) / ys.length;
    let sxy = 0, sxx = 0;
    for (let i = 0; i < xs.length; i++) { sxy += (xs[i] - mx) * (ys[i] - my); sxx += (xs[i] - mx) ** 2; }
    const slope = sxy / sxx, inter = my - slope * mx;
    add('trend_gap', S.gold_close.map((v, i) => (v ? num((v / Math.exp(inter + slope * i) - 1) * 100, 2) : null)));

    // CPI index forward filled from the deflator implied by real_price
    const cpiIdx = S.real_price.map((rp, i) => (rp && S.gold_close[i] ? num((S.gold_close[i] / rp) * 100, 3) : null));
    const firstCpi = cpiIdx.find(v => v != null);
    add('cpi_idx', cpiIdx.map(v => (v == null ? null : num(v / firstCpi * 100, 2))));

    const rebase = (a) => { const f = a.find(v => v != null); return a.map(v => (v == null || !f ? null : num(v / f * 100, 2))); };
    const goldIdx = rebase(S.gold_close);
    add('gold_idx', goldIdx);
    add('silver_idx', rebase(S.silver_close));
    add('spx_idx', rebase(S.spx_close));

    // correlations
    const corr = (a, b, n = 90) => {
      const out = new Array(N).fill(null);
      const ra = new Array(N).fill(null), rb = new Array(N).fill(null);
      for (let i = 1; i < N; i++) {
        if (a[i] && a[i - 1] && a[i - 1] > 0) ra[i] = Math.log(a[i] / a[i - 1]);
        if (b[i] && b[i - 1] && b[i - 1] > 0) rb[i] = Math.log(b[i] / b[i - 1]);
      }
      for (let i = n; i < N; i++) {
        let sa = 0, sb = 0, k = 0;
        const A = [], B = [];
        for (let j = i - n + 1; j <= i; j++) if (ra[j] != null && rb[j] != null) { A.push(ra[j]); B.push(rb[j]); }
        if (A.length < n * 0.8) continue;
        const ma = A.reduce((x, y) => x + y, 0) / A.length, mb = B.reduce((x, y) => x + y, 0) / B.length;
        let sab = 0, saa = 0, sbb = 0;
        for (let j = 0; j < A.length; j++) { sab += (A[j] - ma) * (B[j] - mb); saa += (A[j] - ma) ** 2; sbb += (B[j] - mb) ** 2; }
        if (saa && sbb) out[i] = num(sab / Math.sqrt(saa * sbb), 3);
      }
      return out;
    };
    add('corr_spx', corr(S.gold_close, S.spx_close));
    add('corr_dxy', corr(S.gold_close, S.dxy));

    // 95% VaR
    const var95 = new Array(N).fill(null);
    for (let i = 250; i < N; i++) {
      const r = [];
      for (let j = i - 249; j <= i; j++) if (S.gold_close[j] && S.gold_close[j - 1]) r.push(Math.log(S.gold_close[j] / S.gold_close[j - 1]) * 100);
      r.sort((a, b) => a - b);
      if (r.length > 100) var95[i] = num(r[Math.floor(r.length * 0.05)], 2);
    }
    add('var95', var95);

    // rolling 5y inflation beta: gold monthly return vs CPI yoy  -- approximated with annual windows
    const infl_beta = new Array(N).fill(null);
    for (let i = 1260; i < N; i += 5) {
      const g0 = S.gold_close[i - 1260], g1 = S.gold_close[i];
      const c0 = S.cpi_idx[i - 1260], c1 = S.cpi_idx[i];
      if (!g0 || !g1 || !c0 || !c1 || c1 === c0) continue;
      const gR = g1 / g0 - 1, cR = c1 / c0 - 1;
      if (Math.abs(cR) > 0.001) infl_beta[i] = num(gR / cR, 2);
    }
    for (let i = 1; i < N; i++) if (infl_beta[i] == null) infl_beta[i] = infl_beta[i - 1];
    add('infl_beta', infl_beta);

    // histogram of the last 252 daily returns
    const rets = [];
    for (let i = N - 252; i < N; i++) if (S.gold_close[i - 1]) rets.push(Math.log(S.gold_close[i] / S.gold_close[i - 1]) * 100);
    add('ret1y', rets.map(v => num(v, 2)));
    const bins = [];
    for (let b = -6; b <= 6; b += 0.5) bins.push({ x: b, y: rets.filter(r => r >= b && r < b + 0.5).length });
    add('ret1y_hist', bins);

    // risk/reward scatter: weekly return vs weekly vol, last 10y
    const sc = [];
    for (let i = Math.max(0, N - 2520); i < N; i += 5) {
      if (S.vol30[i] && S.mom365[i] != null) sc.push([num(S.vol30[i], 2), num(S.mom365[i], 1), Date.parse(S.dates[i])]);
    }
    add('riskreward', sc);

    // drawdown table
    const dds = [];
    let peak = -Infinity, peakI = 0, inDd = false, cur = null;
    for (let i = 0; i < N; i++) {
      const v = S.gold_close[i];
      if (v >= peak) {
        if (cur) { cur.recovered = S.dates[i]; cur.recDays = i - cur.troughI; dds.push(cur); cur = null; }
        peak = v; peakI = i;
      } else {
        const dd = (v / peak - 1) * 100;
        if (!cur) cur = { start: S.dates[peakI], startI: peakI, trough: S.dates[i], troughI: i, depth: dd, recovered: null, recDays: null, days: 0 };
        if (dd < cur.depth) { cur.depth = dd; cur.trough = S.dates[i]; cur.troughI = i; }
        cur.days = i - peakI;
      }
    }
    if (cur) { cur.recovered = null; cur.recDays = null; cur.days = N - 1 - peakI; dds.push(cur); }
    add('drawdowns', dds.filter(d => d.depth < -5).sort((a, b) => a.depth - b.depth).slice(0, 10)
      .map(d => ({ start: d.start, trough: d.trough, depth: num(d.depth, 1), days: d.days, recovered: d.recovered, recDays: d.recDays })));

    return S;
  }

  // ------------------------------------------------------------- chart stats
  function statTiles(spec, D, S, N) {
    const last = (a) => { for (let i = N - 1; i >= 0; i--) if (a[i] != null) return a[i]; return null; };
    const at = (a, back) => { const i = N - 1 - back; return i >= 0 ? a[i] : null; };
    const num = (v, d = 2) => (v == null || !isFinite(v) ? '—' : v.toFixed(d));
    const usd = (v) => (v == null ? '—' : '$' + Number(v).toLocaleString('en-US', { maximumFractionDigits: 0 }));
    const pc = (v, d = 2) => (v == null ? '—' : (v > 0 ? '+' : '') + Number(v).toFixed(d) + '%');
    const st = D.stats, tiles = [];
    const push = (k, v, cls) => tiles.push({ k, v, cls });
    const test = (key) => (spec.stats || []).includes(key);

    if (test('last')) push('Gold', usd(st.price));
    if (test('chg1d')) push('1-day change', pc(st.changePct));
    if (test('high52')) push('52w high', usd(st.high52));
    if (test('low52')) push('52w low', usd(st.low52));
    if (test('ath')) push('All-time high', usd(st.ath) + ' · ' + st.athDate);
    if (test('cagr')) push('CAGR since 2000', st.cagr);
    if (test('lbmaLast')) push('LBMA PM', usd(S.lbma_close[S.lbma_close.length - 1]));
    if (test('lbmaCagr')) push('CAGR since 1968', st.cagr68 + '%');
    if (test('lbmaAth')) push('Highest month', usd(Math.max(...S.lbma_close)));
    if (test('realLast')) push('Real price', usd(last(S.real_price)));
    if (test('realAth')) push('Real ATH', usd(st.athReal));
    if (test('realDd')) push('Real drawdown', pc(last(S.real_dd)));
    if (test('ddLast')) push('Current drawdown', pc(last(S.drawdown)));
    if (test('ddWorst')) push('Worst drawdown', pc(Math.min(...S.drawdown.filter(v => v != null))));
    if (test('ddDays')) push('Days underwater', Math.round(S.drawdown.slice().reverse().findIndex(v => v === 0) / 1) + 'd');
    if (test('d200Last')) push('vs 200DMA', pc(last(S.dist200)));
    if (test('d200Max')) push('Max stretch', pc(Math.max(...S.dist200.filter(v => v != null))));
    if (test('d200Min')) push('Min stretch', pc(Math.min(...S.dist200.filter(v => v != null))));
    if (test('d200wLast')) push('vs 200WMA', pc(last(S.dist200w)));
    if (test('d200wMax')) push('Max premium', pc(Math.max(...S.dist200w.filter(v => v != null))));
    if (test('d200wMin')) push('Max discount', pc(Math.min(...S.dist200w.filter(v => v != null))));
    if (test('p52Last')) push('In 52w range', num(last(S.p52), 1) + '%');
    if (test('r12Last')) push('12M return', pc(last(S.mom365), 1));
    if (test('r12Max')) push('Best 12M', pc(Math.max(...S.mom365.filter(v => v != null)), 1));
    if (test('r12Min')) push('Worst 12M', pc(Math.min(...S.mom365.filter(v => v != null)), 1));
    if (test('last') && test('ma50x')) push('vs 50DMA', pc(last(S.ma50) ? (st.price / last(S.ma50) - 1) * 100 : null));
    if (test('ma50x') && test('ma200x')) push('vs 200DMA', pc(last(S.ma200) ? (st.price / last(S.ma200) - 1) * 100 : null));
    if (test('ma50wx')) push('vs 50WMA', pc(last(S.ma50w) ? (st.price / last(S.ma50w) - 1) * 100 : null));
    if (test('ma200wx')) push('vs 200WMA', pc(last(S.ma200w) ? (st.price / last(S.ma200w) - 1) * 100 : null));
    if (test('gcLast')) push('50D-200D', pc(last(S.gc_spread)));
    if (test('bbPos')) {
      const u = last(S.bb_up), d = last(S.bb_dn);
      push('%B', num(u && d ? ((st.price - d) / (u - d)) * 100 : null, 1) + '%');
    }
    if (test('atrLast')) push('ATR 14', '$' + num(last(S.atr14)));
    if (test('atrAvg')) push('ATR average', '$' + num(S.atr14.filter(v => v != null).reduce((a, b) => a + b, 0) / S.atr14.filter(v => v != null).length));
    if (test('rsiLast')) push('RSI 14D', num(last(S.rsi14), 1));
    if (test('rsiD30')) push('RSI 30 sessions ago', num(at(S.rsi14, 30), 1));
    if (test('rsiExt')) push('Days RSI>70 (60d)', Array.isArray(S.rsi70) ? String(last(S.rsi70)) : '—');
    if (test('rsiwLast')) push('RSI 14W', num(last(S.rsiw), 1));
    if (test('macdLast')) push('MACD', num(last(S.macd), 2));
    if (test('macdSig')) push('Signal', num(last(S.macd_sig), 2));
    if (test('m30Last')) push('Momentum 30D', pc(last(S.mom30), 1));
    if (test('m30Max')) push('Best 30D', pc(Math.max(...S.mom30.filter(v => v != null)), 1));
    if (test('m30Min')) push('Worst 30D', pc(Math.min(...S.mom30.filter(v => v != null)), 1));
    if (test('m90Last')) push('Momentum 90D', pc(last(S.mom90), 1));
    if (test('m180Last')) push('Momentum 180D', pc(last(S.mom180), 1));
    if (test('wretLast')) push('Last week', pc(last(S.wret)));
    if (test('wretSd')) push('Weekly σ', num(Math.sqrt(S.wret.filter(v => v != null).reduce((a, b) => a + b * b, 0) / S.wret.filter(v => v != null).length), 2) + '%');
    if (test('overbought')) push('Days RSI>70', Array.isArray(S.rsi70) ? String(last(S.rsi70)) : '—');
    if (test('oversold')) push('Days RSI<30', Array.isArray(S.rsi30) ? String(last(S.rsi30)) : '—');
    if (test('v30Last')) push('Vol 30D', num(last(S.vol30), 1) + '%');
    if (test('v30Avg')) push('Average vol', num(S.vol30.filter(v => v != null).reduce((a, b) => a + b, 0) / S.vol30.filter(v => v != null).length, 1) + '%');
    if (test('v90Last')) push('Vol 90D', num(last(S.vol90), 1) + '%');
    if (test('v365Last')) push('Vol 1Y', num(last(S.vol365), 1) + '%');
    if (test('vrLast')) push('Vol ratio', num(last(S.volratio), 2));
    if (test('bbwLast')) push('Band width', num(last(S.bb_w), 2) + '%');
    if (test('bbwAvg')) push('Average width', num(S.bb_w.filter(v => v != null).reduce((a, b) => a + b, 0) / S.bb_w.filter(v => v != null).length, 2) + '%');
    if (test('drLast')) push('Last session', num(last(S.drage), 2) + '%');
    if (test('drAvg')) push('Average range', num(S.drage.filter(v => v != null).reduce((a, b) => a + b, 0) / S.drage.filter(v => v != null).length, 2) + '%');
    if (test('zLast')) push('Z-score', num(last(S.z200), 2));
    if (test('zMax')) push('Peak z-score', num(Math.max(...S.z200.filter(v => v != null)), 2));
    if (test('zMin')) push('Trough z-score', num(Math.min(...S.z200.filter(v => v != null)), 2));
    if (test('rddLast')) push('Real drawdown', pc(last(S.real_dd)));
    if (test('rddWorst')) push('Worst real DD', pc(Math.min(...S.real_dd.filter(v => v != null))));
    if (test('goldIdx')) push('Gold (rebased 100)', num(last(S.gold_idx), 1));
    if (test('cpiIdx')) push('CPI (rebased 100)', num(last(S.cpi_idx), 1));
    if (test('gapIdx')) push('Gold/CPI ratio', num(last(S.gold_idx) / last(S.cpi_idx), 2));
    if (test('silverIdx')) push('Silver (rebased 100)', num(last(S.silver_idx), 1));
    if (test('spxIdx')) push('S&P 500 (rebased)', num(last(S.spx_idx), 1));
    if (test('oilIdx')) push('WTI (rebased)', num(last(S.oil_idx), 1));
    if (test('ryLast')) push('10Y real yield', num(last(S.realyield), 2) + '%');
    if (test('ryAvg')) push('Average yield', num(S.realyield.filter(v => v != null).reduce((a, b) => a + b, 0) / S.realyield.filter(v => v != null).length, 2) + '%');
    if (test('ryMax')) push('Highest yield', num(Math.max(...S.realyield.filter(v => v != null)), 2) + '%');
    if (test('ryMin')) push('Lowest yield', num(Math.min(...S.realyield.filter(v => v != null)), 2) + '%');
    if (test('dxyLast')) push('DXY', num(last(S.dxy), 2));
    if (test('dxyMax')) push('DXY high', num(Math.max(...S.dxy.filter(v => v != null)), 2));
    if (test('dxyMin')) push('DXY low', num(Math.min(...S.dxy.filter(v => v != null)), 2));
    if (test('dxyInvLast')) push('Inverse DXY', num(last(S.dxy_inv), 2));
    if (test('dxyScore')) push('Pressure score', num(last(D.signalScore('dxy')), 0));
    if (test('ryScore')) push('Pressure score', num(last(D.signalScore('realy')), 0));
    if (test('gsrLast')) push('Gold/silver', num(last(S.gsr), 1));
    if (test('gsrMin')) push('Lowest', num(Math.min(...S.gsr.filter(v => v != null)), 1));
    if (test('gsrMax')) push('Highest', num(Math.max(...S.gsr.filter(v => v != null)), 1));
    if (test('gprLast')) push('Gold/platinum', num(last(S.gpr), 2));
    if (test('gorLast')) push('Gold/oil', num(last(S.gor), 1));
    if (test('gorMax')) push('Highest', num(Math.max(...S.gor.filter(v => v != null)), 1));
    if (test('gcrLast')) push('Gold/copper', num(last(S.gcr), 4));
    if (test('gdxgLast')) push('GDX/gold', num(last(S.gdx_gold), 4));
    if (test('gdxgMax')) push('Highest', num(Math.max(...S.gdx_gold.filter(v => v != null)), 4));
    if (test('gspxLast')) push('Gold/S&P 500', num(last(S.gold_spx), 2));
    if (test('gspxMax')) push('Highest', num(Math.max(...S.gold_spx.filter(v => v != null)), 2));
    if (test('cycleLast')) push('Cycle Index', num(last(D.signalScore('cycle')), 0) + ' / 100');
    if (test('cycleD30')) push('30d ago', num(at(D.signalScore('cycle'), 21), 0));
    if (test('cycleD90')) push('90d ago', num(at(D.signalScore('cycle'), 63), 0));
    if (test('phaseNow')) push('Phase', D.phaseOf(last(D.signalScore('cycle'))) || '—');
    if (test('tgLast')) push('Premium to trend', pc(last(S.trend_gap)));
    if (test('tgMax')) push('Peak premium', pc(Math.max(...S.trend_gap.filter(v => v != null))));
    if (test('tgMin')) push('Deepest discount', pc(Math.min(...S.trend_gap.filter(v => v != null))));
    if (test('corrLast')) push('Correlation', num(last(S.corr_spx), 2));
    if (test('corrAvg')) push('Average', num(S.corr_spx.filter(v => v != null).reduce((a, b) => a + b, 0) / S.corr_spx.filter(v => v != null).length, 2));
    if (test('corrdxyLast')) push('Correlation', num(last(S.corr_dxy), 2));
    if (test('varLast')) push('VaR 95%', num(last(S.var95), 2) + '%');
    if (test('cpiLast')) push('CPI index', num(last(S.cpi_idx), 1));
    if (test('cpiYoy')) {
      const i = N - 1; let k = i - 365; while (k > 0 && S.cpi_idx[k] == null) k--;
      push('CPI YoY', pc(S.cpi_idx[k] ? (S.cpi_idx[i] / S.cpi_idx[k] - 1) * 100 : null, 1));
    }
    if (test('betaLast')) push('Inflation beta', num(last(S.infl_beta), 2));
    if (test('betaAvg')) push('Average beta', num(S.infl_beta.filter(v => v != null).reduce((a, b) => a + b, 0) / S.infl_beta.filter(v => v != null).length, 2));
    if (test('seasonNow')) push('Current month avg', pc(D.season.avg[new Date(st.date).getMonth()], 2));
    if (test('seasonBest')) { const i = D.season.avg.indexOf(Math.max(...D.season.avg)); push('Best month', MONTHS[i] + ' ' + pc(D.season.avg[i])); }
    if (test('seasonWorst')) { const i = D.season.avg.indexOf(Math.min(...D.season.avg)); push('Worst month', MONTHS[i] + ' ' + pc(D.season.avg[i])); }
    if (test('seasonBestWin')) { const i = D.season.win.indexOf(Math.max(...D.season.win)); push('Best win rate', MONTHS[i] + ' ' + D.season.win[i] + '%'); }
    if (test('seasonWorstWin')) { const i = D.season.win.indexOf(Math.min(...D.season.win)); push('Worst win rate', MONTHS[i] + ' ' + D.season.win[i] + '%'); }
    if (test('bestYear')) { const i = D.season.yearly.indexOf(Math.max(...D.season.yearly)); push('Best year', D.season.years[i] + ' ' + pc(D.season.yearly[i], 1)); }
    if (test('worstYear')) { const i = D.season.yearly.indexOf(Math.min(...D.season.yearly)); push('Worst year', D.season.years[i] + ' ' + pc(D.season.yearly[i], 1)); }
    if (test('winYears')) push('Up years', D.season.yearly.filter(v => v > 0).length + ' / ' + D.season.yearly.length);
    if (test('bestMonth')) {
      let best = ['', -Infinity], worst = ['', Infinity];
      for (const y in D.season.matrix) for (const m in D.season.matrix[y]) {
        const v = D.season.matrix[y][m];
        if (v > best[1]) best = [MONTHS[m - 1] + ' ' + y, v];
        if (v < worst[1]) worst = [MONTHS[m - 1] + ' ' + y, v];
      }
      push('Best month', best[0] + ' ' + pc(best[1], 1)); push('Worst month', worst[0] + ' ' + pc(worst[1], 1));
    }
    return tiles.slice(0, 5);
  }

  const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

  window.NT_CATALOGUE = {
    charts,
    milestones: MILESTONES,
    palette: C,
    months: MONTHS,
    computeDerived,
    statTiles,
    popular: () => charts.filter(c => c.popular),
    bySlug: (slug) => charts.find(c => c.slug === slug),
    byCategory: () => charts.reduce((acc, c) => { (acc[c.cat] = acc[c.cat] || []).push(c); return acc; }, {})
  };
})();
