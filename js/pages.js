/* ==========================================================================
   Noman_trading — page renderers
   ========================================================================== */
(function () {
  const D = window.NT, CAT = window.NT_CATALOGUE, F = D.fmt;
  const NAV = window.NT_NAV, ICONS = window.NT_ICONS, U = window.NT_UTIL;
  const { $, $$, esc } = U;
  const PAGES = window.NT_PAGES;
  const hexA = (hex, a) => {
    const m = /^#([0-9a-f]{6})$/i.exec(hex.trim());
    if (!m) return hex;
    const n = parseInt(m[1], 16);
    return 'rgba(' + (n >> 16 & 255) + ',' + (n >> 8 & 255) + ',' + (n & 255) + ',' + a + ')';
  };

  // ------------------------------------------------------------ shared bits
  function rangePills(spec, onPick) {
    const opts = [['1', '1Y'], ['3', '3Y'], ['5', '5Y'], ['10', '10Y'], ['0', 'MAX']];
    const cur = String(NAV.state.range);
    return '<div class="pill-group" data-range>' + opts.map(([v, l]) =>
      '<button data-v="' + v + '" class="' + (v === cur ? 'active' : '') + '">' + l + '</button>').join('') + '</div>';
  }

  function cardMenuItems(spec, chart) {
    return [
      { label: 'Open full chart', icon: ICONS.external, onClick: () => NAV.go('charts/' + spec.slug) },
      { label: 'View underlying data', icon: ICONS.chart, onClick: () => NAV.go('charts/' + spec.slug + '?tab=data') },
      { label: 'Export chart as PNG', icon: ICONS.image, onClick: () => D.exportPNG(chart, spec) },
      { label: 'Download data (CSV)', icon: ICONS.download, onClick: () => D.downloadCSV(spec) },
      { label: 'Copy chart link', icon: ICONS.link, onClick: () => copyLink(spec) },
      { sep: true },
      { label: NAV.state.pinned.includes(spec.slug) ? 'Unpin from sidebar' : 'Pin to sidebar', icon: ICONS.star, onClick: () => NAV.togglePin(spec.slug) }
    ];
  }
  function copyLink(spec) {
    const url = location.href.split('#')[0] + '#/charts/' + spec.slug;
    (navigator.clipboard ? navigator.clipboard.writeText(url) : Promise.reject()).then(
      () => NAV.flash('Chart link copied'),
      () => { NAV.modal('<h3>Chart link</h3><p class="mono" style="word-break:break-all">' + esc(url) + '</p><div class="actions"><button class="btn btn-secondary" data-close>Close</button></div>'); }
    );
  }

  function statFoot(spec, extra) {
    const S = D.series;
    const tiles = CAT.statTiles(spec, D, S, D.n);
    if (NAV.state.tt != null) {
      const idx = NAV.state.tt;
      const first = spec.series[0];
      let v = null;
      if (first) {
        const arr = D.resolve(first.id);
        for (let i = Math.min(idx, (arr || []).length - 1); i >= 0; i--) {
          if (!arr || arr[i] == null) continue;
          v = first.id === 'gold_ohlc' ? arr[i][3] : arr[i];
          break;
        }
      }
      const tiles2 = [{ k: 'As of ' + D.dates[idx], v: first ? F.val(first.id === 'gold_ohlc' ? 'usd' : spec.unit, v) : '—' }];
      const cy = NAV.asOf('sig:cycle', idx);
      if (cy != null) tiles2.push({ k: 'Cycle Index', v: Math.round(cy) + '/100' });
      if (extra) tiles2.push(extra);
      return tiles2.map(t => '<div class="foot-stat"><span class="k">' + esc(t.k) + '</span><span class="v">' + esc(t.v) + '</span></div>').join('');
    }
    return tiles.map(t => '<div class="foot-stat"><span class="k">' + esc(t.k) + '</span><span class="v ' + (t.cls || '') + '">' + esc(t.v) + '</span></div>').join('');
  }

  function chartCard(spec, opts) {
    opts = opts || {};
    const h = opts.height || 210;
    return '<div class="card chart-card" data-slug="' + spec.slug + '">' +
      '<div class="card-head"><span class="card-title">' + esc(spec.title) + '</span>' +
      (opts.badge ? '<span class="badge badge-' + (opts.badge === 'Bullish' ? 'bullish' : opts.badge.toLowerCase()) + '">' + esc(opts.badge) + '</span>' : '') +
      '<span class="right"><a class="icon-btn" href="#/charts/' + spec.slug + '" title="Open full chart">' + ICONS.external + '</a>' +
      '<button class="icon-btn" data-menu title="Chart actions">' + ICONS.dots + '</button></span></div>' +
      '<div class="card-body"><div class="chart-host" data-chart="' + spec.slug + '" style="height:' + h + 'px"></div></div>' +
      '<div class="card-foot" data-foot="' + spec.slug + '">' + statFoot(spec) + '</div></div>';
  }

  function mountCards(root, specs, opts) {
    specs.forEach(spec => {
      const host = $('[data-chart="' + spec.slug + '"]', root);
      if (!host) return;
      let chart = null;
      try { chart = D.renderChart(host, spec, { compact: true, range: opts && opts.useRange ? (NAV.state.range || '5Y') : '5Y', height: (opts && opts.height) || 210 }); } catch (e) { console.error(e); }
      NAV.register(spec, chart, { footEl: $('[data-foot="' + spec.slug + '"]', root) });
      const card = host.closest('.chart-card');
      const menuBtn = $('[data-menu]', card);
      if (menuBtn) menuBtn.addEventListener('click', (e) => { e.preventDefault(); NAV.showMenu(menuBtn, cardMenuItems(spec, chart)); });
      card.addEventListener('dblclick', (e) => { if (!e.target.closest('a')) NAV.go('charts/' + spec.slug); });
    });
  }

  // ------------------------------------------------------- pulse row helpers
  function gauge(score) {
    const left = Math.max(0, Math.min(100, score || 0));
    return '<div class="spec"><span class="track"><i style="left:' + left + '%"></i></span></div>';
  }

  function renderPulse(host) {
    const st = D.stats, live = NAV.live;
    const idx = NAV.ttIndex();
    const cyc = NAV.state.tt != null ? NAV.asOf('sig:cycle', idx) : D.signalScore('cycle')[D.n - 1];
    const phase = D.phaseOf(cyc);
    const keys = D.signals.map(s => s.key).filter(k => k !== 'cycle');
    const b = { Bottom: 0, Bearish: 0, Bullish: 0, Top: 0 };
    keys.forEach(k => { const a = D.signalScore(k); for (let i = Math.min(idx, a.length - 1); i >= 0; i--) if (a[i] != null) { const p = D.phaseOf(a[i]); if (p) b[p]++; break; } });
    const total = keys.length || 1;
    const bull = b.Bullish + b.Top;
    const gsrNow = NAV.state.tt != null ? NAV.asOf('gsr', idx) : D.series.gsr[D.n - 1];
    const gsr30i = Math.max(0, idx - 30);
    const gsr30 = NAV.state.tt != null ? NAV.asOf('gsr', gsr30i) : D.series.gsr[D.n - 31];
    const gsrD = gsrNow != null && gsr30 ? (gsrNow / gsr30 - 1) * 100 : null;
    const spot = live.spot != null ? live.spot : st.price;
    const chg = live.changeAbs || 0, chgp = live.changePct || 0;
    const up = chg >= 0;
    const sparkVals = (live.series && live.series().length > 3) ? live.series() : D.series.gold_close.slice(-120);
    const cycSeries = NAV.state.tt != null ? D.signalScore('cycle').slice(Math.max(0, idx - 260), idx + 1) : D.signalScore('cycle').slice(-260);

    host.innerHTML = [
      '<div class="card pulse clickable" data-jump="charts/gold-price-ohlc" title="Open the gold price chart">',
      '<div class="pulse-top"><span class="live-dot pulse"></span><span class="pulse-label">Gold spot · XAU/USD</span>',
      '<span class="pulse-foot" style="margin-left:auto" data-live-src>' + esc(live.source) + (live.updated ? ' · ' + live.updated.toTimeString().slice(0, 8) : '') + '</span></div>',
      '<div class="pulse-value" data-live-spot>' + F.usd(spot) + '</div>',
      '<div class="pulse-delta ' + (up ? 'up' : 'down') + '" data-live-chg>' + (up ? '▲' : '▼') + ' ' + F.usd(Math.abs(chg)) + ' · ' + F.pct(chgp) + '</div>',
      '<div class="pulse-foot"><span data-live-mode>' + liveModeText(live) + '</span>' +
      '<span style="margin-left:auto" class="mono">24h ' + (live.low ? F.usd(live.low) + '–' + F.usd(live.high) : '—') + '</span></div>',
      '<div class="pulse-spark" data-live-spark>' + D.sparkline(sparkVals, { height: 34, width: 260, color: NAV.cssVar('--color-primary', '#c96442') }) + '</div>',
      '</div>',

      '<div class="card pulse clickable" data-jump="charts/cycle-index" title="Open the Cycle Index chart">',
      '<div class="pulse-top"><span class="pulse-label">Cycle index</span><span class="badge badge-' + (phase || 'bearish').toLowerCase() + '" style="margin-left:auto">' + esc(phase || '—') + '</span></div>',
      '<div class="pulse-value">' + (cyc == null ? '—' : Math.round(cyc)) + '<span class="muted" style="font-size:1.4rem">/100</span></div>',
      gauge(cyc),
      '<div class="pulse-foot">20 signals · avg percentile<span style="margin-left:auto" class="mono">' + (NAV.state.tt != null ? 'as of ' + D.dates[idx] : 'live') + '</span></div>',
      '<div class="pulse-spark" data-cycle-spark>' + D.sparkline(cycSeries, { height: 34, width: 260, color: NAV.cssVar('--phase-top', '#c0392b'), neutral: false }) + '</div>',
      '</div>',

      '<div class="card pulse clickable" data-jump="signals" title="Open the signal explorer">',
      '<div class="pulse-top"><span class="pulse-label">30-day breadth</span></div>',
      '<div class="pulse-value small">' + bull + ' <span class="muted" style="font-size:1.4rem">/ ' + total + ' bullish</span></div>',
      '<div class="bar-track">' +
      '<span style="width:' + (b.Bottom / total * 100) + '%;background:' + NAV.cssVar('--phase-bottom', '#3f6f9f') + '"></span>' +
      '<span style="width:' + (b.Bearish / total * 100) + '%;background:' + NAV.cssVar('--phase-bearish', '#9dc0dd') + '"></span>' +
      '<span style="width:' + (b.Bullish / total * 100) + '%;background:' + NAV.cssVar('--phase-bullish', '#e9b3a3') + '"></span>' +
      '<span style="width:' + (b.Top / total * 100) + '%;background:' + NAV.cssVar('--phase-top', '#c0392b') + '"></span>' +
      '</div>',
      '<div class="pulse-foot"><span class="legend-inline"><i style="background:' + NAV.cssVar('--phase-bottom', '#3f6f9f') + '"></i>Bottom ' + b.Bottom + '</span>' +
      '<span class="legend-inline"><i style="background:' + NAV.cssVar('--phase-bearish', '#9dc0dd') + '"></i>Bearish ' + b.Bearish + '</span>' +
      '<span class="legend-inline"><i style="background:' + NAV.cssVar('--phase-bullish', '#e9b3a3') + '"></i>Bullish ' + b.Bullish + '</span>' +
      '<span class="legend-inline"><i style="background:' + NAV.cssVar('--phase-top', '#c0392b') + '"></i>Top ' + b.Top + '</span></div>',
      '</div>',

      '<div class="card pulse clickable" data-jump="charts/gold-silver-ratio" title="Open the gold / silver ratio chart">',
      '<div class="pulse-top"><span class="pulse-label">Gold / silver ratio</span></div>',
      '<div class="pulse-value small">' + (gsrNow == null ? '—' : gsrNow.toFixed(1)) + '</div>',
      '<div class="pulse-delta ' + (gsrD >= 0 ? 'up' : 'down') + '">' + (gsrD >= 0 ? '▲' : '▼') + ' ' + (gsrD == null ? '—' : F.pct(gsrD)) + ' <span class="muted">30d</span></div>',
      '<div class="pulse-foot">Ounces of silver per ounce of gold</div>',
      '<div class="pulse-spark" data-gsr-spark>' + D.sparkline(D.series.gsr.slice(Math.max(0, idx - 260), idx + 1), { height: 34, width: 260, color: NAV.cssVar('--phase-bottom', '#3f6f9f'), upIsGood: true }) + '</div>',
      '</div>'
    ].join('');
  }

  function liveModeText(live) {
    if (live.connected) {
      const ago = live.secondsAgo();
      return 'live stream · ' + live.tickCount + (live.tickCount === 1 ? ' tick' : ' ticks') + (ago != null ? ' · ' + ago + 's ago' : '');
    }
    return live.mode === 'poll' ? 'polling · REST fallback every 45s' : 'connecting…';
  }

  function liveUpdate(host) {
    const live = NAV.live, st = D.stats;
    const spotEl = $('[data-live-spot]', host);
    if (!spotEl) return;
    const spot = live.spot != null ? live.spot : st.price;
    const txt = F.usd(spot);
    if (spotEl.textContent !== txt) {
      spotEl.textContent = txt;
      spotEl.classList.remove('tick-up', 'tick-down');
      void spotEl.offsetWidth;
      spotEl.classList.add(live.spot != null && live.spot >= (live.prevClose || live.spot) ? 'tick-up' : 'tick-down');
    }
    const up = (live.changeAbs || 0) >= 0;
    const chgEl = $('[data-live-chg]', host);
    if (chgEl) {
      chgEl.className = 'pulse-delta ' + (up ? 'up' : 'down');
      chgEl.textContent = (up ? '▲' : '▼') + ' ' + F.usd(Math.abs(live.changeAbs || 0)) + ' · ' + F.pct(live.changePct || 0);
    }
    const sparkEl = $('[data-live-spark]', host);
    if (sparkEl && live.series24h && live.series24h.length > 3) {
      sparkEl.innerHTML = D.sparkline(live.series(), { height: 34, width: 260, color: NAV.cssVar('--color-primary', '#c96442') });
    }
    const srcEl = $('[data-live-src]', host);
    if (srcEl) srcEl.textContent = live.source + (live.updated ? ' · ' + live.updated.toTimeString().slice(0, 8) : '');
    const modeEl = $('[data-live-mode]', host);
    if (modeEl) modeEl.textContent = liveModeText(live);
    const rangeEl = $('[data-live-range]', host);
    if (rangeEl) rangeEl.textContent = live.low ? F.usd(live.low) + ' – ' + F.usd(live.high) : '—';
  }

  // ------------------------------------------------------------- heatmap
  function heatmapHTML(zt, opts) {
    opts = opts || {};
    const cols = zt.cols;
    const rows = opts.rows ? zt.rows.filter(r => opts.rows.includes(r.key)) : zt.rows;
    const last = cols.length - 1;
    const ttIdx = NAV.state.tt != null ? cols.findIndex(c => c === D.dates[NAV.state.tt]) : -1;
    let head = '<tr><th class="rowlab"></th>';
    for (let i = 0; i < cols.length; i++) {
      const c = cols[i];
      const show = i === 0 || c.slice(5, 7) === '01' || c.slice(0, 4) !== cols[i - 1].slice(0, 4);
      head += '<th style="position:relative;height:1.3rem;padding:0;font-weight:400">' +
        (show ? '<span style="position:absolute;left:0;top:0;font-family:var(--font-mono);font-size:1.05rem;color:var(--color-text-muted)">' + c.slice(0, 4) + '</span>' : '') + '</th>';
    }
    head += '</tr>';
    const body = rows.map(r => {
      const cells = r.v.map((v, i) => {
        if (v == null) return '<td class="cell" style="background:var(--color-hover)"></td>';
        const col = v < 25 ? NAV.cssVar('--phase-bottom', '#3f6f9f') : v < 50 ? NAV.cssVar('--phase-bearish', '#9dc0dd') : v < 75 ? NAV.cssVar('--phase-bullish', '#e9b3a3') : NAV.cssVar('--phase-top', '#c0392b');
        const inten = 0.35 + 0.6 * Math.min(1, Math.abs(v - 50) / 50);
        const isTT = i === ttIdx, isLast = i === last;
        return '<td class="cell" data-col="' + i + '" title="' + esc(r.title) + ' · ' + cols[i] + ' · ' + v + '/100" style="background:' + hexA(col, inten) +
          (isTT ? ';outline:1px solid var(--color-primary);outline-offset:-1px' : isLast ? ';border-right:1px solid var(--color-primary)' : '') + '"></td>';
      }).join('');
      const slug = CHART_FOR_SIGNAL[r.key];
      return '<tr><th class="rowlab' + (slug ? ' linkable' : '') + '"' + (slug ? ' data-open="' + slug + '"' : '') +
        ' title="' + esc(r.title) + (slug ? ' · click to open the chart' : '') + '">' + esc(r.title) + '</th>' + cells + '</tr>';
    }).join('');
    return '<div class="heat-wrap"><table class="heat-table">' + head + body + '</table></div>' +
      '<div class="heat-legend"><span><span class="sw" style="background:' + NAV.cssVar('--phase-bottom', '#3f6f9f') + '"></span>Bottom 0-25</span>' +
      '<span><span class="sw" style="background:' + NAV.cssVar('--phase-bearish', '#9dc0dd') + '"></span>Bearish 25-50</span>' +
      '<span><span class="sw" style="background:' + NAV.cssVar('--phase-bullish', '#e9b3a3') + '"></span>Bullish 50-75</span>' +
      '<span><span class="sw" style="background:' + NAV.cssVar('--phase-top', '#c0392b') + '"></span>Top 75-100</span>' +
      '<span class="muted" style="margin-left:auto">Each cell = the month-end phase score of that signal</span></div>';
  }

  const CHART_FOR_EVENT = {
    ath: 'gold-price-ohlc', dd10: 'gold-price-drawdown', dd20: 'gold-price-drawdown', dd30: 'gold-price-drawdown',
    rsi70: 'rsi-14', rsi30: 'rsi-14', golden_cross: 'golden-cross', death_cross: 'golden-cross',
    cross200d_up: 'distance-from-200dma', cross200d_down: 'distance-from-200dma',
    cross200w_up: 'distance-from-200wma', cross200w_down: 'distance-from-200wma',
    vol_spike: 'realized-vol-30', vol_calm: 'realized-vol-30',
    gsr_high: 'gold-silver-ratio', gsr_low: 'gold-silver-ratio',
    phase_up: 'cycle-index', phase_down: 'cycle-index',
    ry_up: 'real-yield', ry_down: 'real-yield',
    dxy_high: 'dollar-index', dxy_low: 'dollar-index',
    mom365_pos: 'rate-of-change-12m', mom365_neg: 'rate-of-change-12m',
    milestone_up: 'gold-since-1968', milestone_down: 'gold-since-1968'
  };

  const CHART_FOR_SIGNAL = {
    cycle: 'cycle-index', rsi14: 'rsi-14', rsiw: 'rsi-weekly', z200: 'stretch-zscore',
    dist200: 'distance-from-200dma', dist200w: 'distance-from-200wma', mom30: 'momentum-30d',
    mom90: 'momentum-90d', mom365: 'rate-of-change-12m', drawdown: 'gold-price-drawdown',
    vol30: 'realized-vol-30', vol90: 'realized-vol-90', bbw: 'bollinger-width',
    gsr: 'gold-silver-ratio', gor: 'gold-oil-ratio', gdxg: 'miner-leverage',
    gspx: 'gold-vs-spx', dxy: 'dollar-index', realy: 'real-yield', realpx: 'real-gold-price'
  };

  function mountJumpables(root) {
    $$('[data-jump]', root).forEach(el => {
      el.style.cursor = 'pointer';
      el.addEventListener('click', (e) => { if (!e.target.closest('a,button')) NAV.go(el.getAttribute('data-jump')); });
    });
  }

  function mountHeatmap(root) {
    $$('[data-open]', root).forEach(th => th.addEventListener('click', () => NAV.go('charts/' + th.getAttribute('data-open'))));
    $$('[data-col]', root).forEach(td => td.addEventListener('click', () => {
      const i = Number(td.getAttribute('data-col'));
      const zt = D.zonetimeline;
      const key = zt.cols[i];
      let idx = D.dates.indexOf(key);
      if (idx < 0) {
        // month key → the last session of that month
        for (let k = D.n - 1; k >= 0; k--) if (D.dates[k].indexOf(key) === 0 || D.dates[k] <= key) { idx = k; break; }
        if (idx < 0) idx = D.n - 1;
      }
      NAV.setTT(idx);
      NAV.toast('Time travel', 'Dashboard is now showing <b>' + F.niceDate(D.dates[idx]) + '</b>. Click the chip in the header to return to the present.', 'info');
    }));
  }

  function ttChip() {
    if (NAV.state.tt == null) return '';
    return '<button class="chip" data-tt-reset style="border-color:var(--color-primary);color:var(--color-primary)">' +
      ICONS.clock + ' Viewing ' + F.niceDate(D.dates[NAV.state.tt]) + ' · reset</button>';
  }
  function mountTT(root) {
    const b = $('[data-tt-reset]', root);
    if (b) b.addEventListener('click', () => NAV.setTT(null));
  }

  // ============================================================== DASHBOARD
  PAGES.dashboard = function (view, arg, nav) {
    const pop = CAT.popular();
    view.innerHTML = [
      '<div class="page-head">',
      '<div><h1 class="page-title">Gold Market Dashboard</h1>',
      '<div class="page-sub">Live gold pulse, the cycle timeline, and the eight charts that carry the most signal.</div></div>',
      '<div class="right">' + ttChip() + '<a class="chip" href="#/signals">' + ICONS.bell + ' Signal explorer</a></div>',
      '</div>',
      '<div class="pulse-row" id="pulse"></div>',

      '<div class="card" style="margin-bottom:1.6rem">',
      '<div class="card-head"><span class="card-title">Signal Timeline</span>',
      '<span class="card-sub">All history · click a column to time-travel</span>',
      '<span class="right"><span class="card-sub mono">' + D.n + ' sessions · ' + D.dates[0] + ' → ' + D.dates[D.n - 1] + '</span></span></div>',
      '<div class="card-body">' + heatmapHTML(D.zonetimeline) + '</div>',
      '</div>',

      '<div class="grid grid-2" id="cards">' + pop.map(s => chartCard(s)).join('') + '</div>',

      '<div class="card" style="margin-top:1.6rem"><div class="card-head"><span class="card-title">Data &amp; method</span>' +
      '<span class="right"><a class="btn btn-secondary btn-sm" href="#/about">' + ICONS.info + ' About the data</a></span></div>' +
      '<div class="card-body"><div class="srcnote">Every number on this dashboard is computed from real market data — no mock values. ' +
      'Gold prices come from COMEX futures (GC=F) and the LBMA PM benchmark since 1968; macro inputs from FRED (CPI, 10Y TIPS real yield); ' +
      'cross-asset series from silver, platinum, copper, crude oil, the US Dollar Index, gold miners and the S&amp;P 500. ' +
      'Dataset built ' + esc(D.stats.built) + ' · latest session ' + esc(D.stats.date) + '.</div></div></div>'
    ].join('');

    renderPulse($('#pulse'));
    mountJumpables(view);
    mountHeatmap(view);
    mountTT(view);
    mountCards(view, pop, { useRange: true, height: 200 });
    NAV.live.on(() => liveUpdate($('#pulse')));
  };

  // ================================================================ CHARTS
  PAGES.charts = function (view, arg, nav) {
    if (arg) return chartDetail(view, arg, nav);
    const cats = CAT.byCategory();
    const order = ['Price', 'Moving averages', 'Momentum', 'Volatility', 'Valuation', 'Cycle', 'Cross-asset', 'Macro', 'Inflation', 'Seasonality', 'Risk'];
    const keys = order.filter(k => cats[k]).concat(Object.keys(cats).filter(k => !order.includes(k)));
    let filter = '', cat = 'all', sortMode = 'cat', pinnedOnly = false;
    view.innerHTML = [
      '<div class="page-head"><div><h1 class="page-title">Chart library</h1>' +
      '<div class="page-sub">' + CAT.charts.length + ' charts · every series is computed from the underlying market data and downloadable as CSV.</div></div>',
      '<div class="right"><label class="field" style="width:26rem">' + ICONS.search + '<input id="libSearch" placeholder="Search charts"></label>',
      '<select class="inp" id="libSort" style="width:15rem"><option value="cat">Sort: category</option><option value="az">Sort: A-Z</option><option value="pop">Sort: pinned first</option></select>',
      '<button class="btn btn-secondary btn-sm" id="libPin">' + ICONS.star + ' Pinned only</button>',
      '<select class="inp" id="libCat" style="width:18rem"><option value="all">All categories</option>' +
      keys.map(k => '<option value="' + esc(k) + '">' + esc(k) + ' (' + cats[k].length + ')</option>').join('') + '</select></div></div>',
      '<div id="libGrid"></div>'
    ].join('');

    function paint() {
      const q = filter.trim().toLowerCase();
      const html = keys.filter(k => cat === 'all' || k === cat).map(k => {
        let list = cats[k].filter(c => !q || (c.title + ' ' + c.cat + ' ' + c.desc).toLowerCase().includes(q));
        if (pinnedOnly) list = list.filter(c => NAV.state.pinned.includes(c.slug));
        if (sortMode === 'az') list = list.slice().sort((a, b) => a.title.localeCompare(b.title));
        if (sortMode === 'pop') list = list.slice().sort((a, b) => (NAV.state.pinned.includes(b.slug) ? 1 : 0) - (NAV.state.pinned.includes(a.slug) ? 1 : 0));
        if (!list.length) return '';
        return '<div class="card" style="margin-bottom:1.6rem"><div class="card-head"><span class="card-title">' + esc(k) + '</span>' +
          '<span class="card-sub">' + list.length + ' charts</span></div><div class="card-body">' +
          '<div class="grid grid-3">' + list.map(c => {
            const spark = D.sparkline((D.points(c.series.length ? c.series[0].id : 'gold_close', 3) || []).map(p => p[1]), { height: 34, width: 200, color: NAV.cssVar('--color-primary', '#c96442') });
            return '<a class="card" href="#/charts/' + c.slug + '" style="padding:1.2rem;display:block">' +
              '<div style="display:flex;align-items:center;gap:.6rem"><span style="font-size:1.32rem;font-weight:600">' + esc(c.title) + '</span>' +
              (c.popular ? '<span class="badge badge-bullish" style="height:1.7rem">pinned</span>' : '') + '</div>' +
              '<div class="srcnote" style="margin:.4rem 0 .6rem;height:3.2rem;overflow:hidden">' + esc(c.desc.slice(0, 110)) + '…</div>' + spark + '</a>';
          }).join('') + '</div></div></div>';
      }).join('');
      $('#libGrid').innerHTML = html || '<div class="card"><div class="empty">No charts match that filter.</div></div>';
    }
    paint();
    $('#libSearch').addEventListener('input', (e) => { filter = e.target.value; paint(); });
    $('#libCat').addEventListener('change', (e) => { cat = e.target.value; paint(); });
    $('#libSort').addEventListener('change', (e) => { sortMode = e.target.value; paint(); });
    $('#libPin').addEventListener('click', (e) => {
      pinnedOnly = !pinnedOnly;
      e.currentTarget.style.background = pinnedOnly ? 'var(--color-primary-soft)' : '';
      paint();
    });
  };

  function chartDetail(view, slug, nav) {
    const spec = CAT.bySlug(slug);
    if (!spec) { view.innerHTML = '<div class="card"><div class="empty">Chart not found. <a href="#/charts">Back to the library</a></div></div>'; return; }
    const all = CAT.charts, i = all.indexOf(spec);
    const prev = all[(i - 1 + all.length) % all.length], next = all[(i + 1) % all.length];
    const qs = (location.hash.split('?')[1] || '');
    const tab = qs.replace('tab=', '') || 'chart';
    const canLog = (spec.min == null || spec.min > 0) && !['idx', 'score', 'z'].includes(spec.unit);
    const st = {
      range: spec.zoom === 'max' ? 'ALL' : (NAV.state.range || '5Y'),
      log: !!spec.log, ma: false, milestones: !!spec.milestone, gradient: false,
      from: null, to: null, extra: [], visible: spec.series.map(() => true)
    };
    if (!/^(1M|3M|6M|YTD|1Y|3Y|5Y|10Y|ALL)$/.test(st.range)) st.range = '5Y';

    view.innerHTML = [
      '<div class="page-head"><div><div class="page-sub"><a href="#/charts">Chart library</a> / ' + esc(spec.cat) + '</div>' +
      '<h1 class="page-title">' + esc(spec.title) + '</h1></div>',
      '<div class="right">',
      '<a class="btn btn-secondary btn-sm" href="#/charts/' + prev.slug + '">‹ ' + esc(prev.title.slice(0, 20)) + '</a>',
      '<a class="btn btn-secondary btn-sm" href="#/charts/' + next.slug + '">' + esc(next.title.slice(0, 20)) + ' ›</a>',
      '</div></div>',

      '<div class="card">',
      '<div class="card-head"><span class="card-title">' + esc(spec.title) + '</span>' +
      '<span class="card-sub">' + esc(F.unitLabel(spec.unit)) + '</span>',
      '<span class="right toolbar">',
      '<button class="btn btn-secondary btn-sm" data-add>' + ICONS.plus + ' Add series</button>',
      '<button class="btn btn-secondary btn-sm" data-config>' + ICONS.dots + ' Config</button>',
      '<button class="btn btn-secondary btn-sm" data-ma>MA</button>',
      '<button class="btn btn-secondary btn-sm" data-mil>Milestones</button>',
      '<button class="btn btn-secondary btn-sm" data-log>Log</button>',
      '<button class="btn btn-secondary btn-sm" data-embed>' + ICONS.external + ' Embed</button>',
      '</span></div>',
      '<div class="tabs" data-tabs><button data-tab="chart" class="' + (tab === 'chart' ? 'active' : '') + '">Chart</button>' +
      '<button data-tab="data" class="' + (tab === 'data' ? 'active' : '') + '">Sheet</button>' +
      '<button data-tab="about" class="' + (tab === 'about' ? 'active' : '') + '">About</button>' +
      '<span class="right" style="margin-left:auto;display:flex;gap:.6rem;align-items:center;padding:.4rem 0">' +
      '<button class="btn btn-secondary btn-sm" data-csv>' + ICONS.download + ' CSV</button>' +
      '<button class="btn btn-secondary btn-sm" data-png>' + ICONS.image + ' PNG</button>' +
      '<button class="btn btn-secondary btn-sm" data-link>' + ICONS.link + ' Link</button>' +
      '<button class="btn btn-secondary btn-sm" data-pin>' + ICONS.star + ' Pin</button>' +
      '</span></div>',
      '<div class="card-body"><div class="chart-host" data-chart="' + spec.slug + '" style="height:430px"></div>' +
      '<div data-table style="display:none"></div><div data-about style="display:none"></div></div>',
      '<div class="card-foot" data-foot="' + spec.slug + '">' + statFoot(spec) + '</div>',
      '</div>',

      '<div class="card" style="margin-top:1.6rem"><div class="card-head"><span class="card-title">Controls</span>' +
      '<span class="card-sub">range, scale, overlays and comparison series</span></div>',
      '<div class="card-body">',
      '<div class="toolbar" style="margin-bottom:1rem">',
      '<span class="muted tiny">Range</span>',
      '<div class="pill-group" data-range>' + D.RANGE_KEYS.map(k =>
        '<button data-v="' + k + '" class="' + (k === st.range ? 'active' : '') + '">' + k + '</button>').join('') + '</div>',
      '<span class="muted tiny" style="margin-left:1rem">Custom</span>',
      '<input class="inp" type="date" data-from style="width:15rem;height:3.2rem" title="From">',
      '<input class="inp" type="date" data-to style="width:15rem;height:3.2rem" title="To">',
      '<button class="btn btn-secondary btn-sm" data-apply>Apply</button>',
      '<button class="btn btn-secondary btn-sm" data-clear>Clear</button>',
      '</div>',
      '<div class="toolbar" data-series-row><span class="muted tiny">Series</span>' +
      spec.series.map((s, k) => '<button class="btn btn-secondary btn-sm" data-series="' + k + '" style="opacity:1">' +
        '<i style="display:inline-block;width:.9rem;height:.9rem;border-radius:.25rem;background:' + (s.color || '#c96442') + ';margin-right:.4rem"></i>' + esc(s.label || s.id) + '</button>').join('') +
      '<span data-extra-row></span></div>',
      '</div></div>',

      '<div class="card" style="margin-top:1.6rem"><div class="card-head"><span class="card-title">Related charts</span></div><div class="card-body">' +
      '<div class="toolbar">' + CAT.charts.filter(c => c.cat === spec.cat && c !== spec).slice(0, 8).map(c =>
        '<a class="chip" href="#/charts/' + c.slug + '">' + esc(c.title) + '</a>').join('') + '</div></div></div>'
    ].join('');

    const host = $('[data-chart]', view);
    let chart = null;
    function lastValue() {
      const a = D.resolve(spec.series.length ? spec.series[0].id : 'gold_close');
      if (!a) return null;
      for (let i = a.length - 1; i >= 0; i--) if (a[i] != null) return spec.series.length && spec.series[0].id === 'gold_ohlc' ? a[i][3] : a[i];
      return null;
    }
    function opts() {
      return { range: st.range, height: 430, compact: false, milestones: st.milestones, showMA: st.ma, gradient: st.gradient, extraSeries: st.extra, from: st.from, to: st.to };
    }
    function draw() {
      if (chart) { try { chart.destroy(); } catch (e) { } chart = null; }
      if (spec.type === 'table') { host.style.display = 'none'; return; }
      chart = D.renderChart(host, Object.assign({}, spec, { log: st.log }), opts());
      NAV.register(spec, chart, { footEl: $('[data-foot]', view) });
      NAV.applyTT();
      paintExtra();
    }
    function paintExtra() {
      const row = $('[data-extra-row]', view);
      if (!row) return;
      row.innerHTML = st.extra.length ? st.extra.map((ex, k) =>
        '<button class="btn btn-secondary btn-sm" data-ex="' + k + '" title="Remove series"><i style="display:inline-block;width:.9rem;height:.9rem;border-radius:.25rem;background:' + ex.color + ';margin-right:.4rem"></i>' +
        esc(ex.label) + ' <span class="muted">' + (ex.yAxis ? 'right' : 'left') + ' · ✕</span></button>').join('') : '';
      $$('[data-ex]', view).forEach(b => b.addEventListener('click', () => { st.extra.splice(Number(b.getAttribute('data-ex')), 1); draw(); }));
    }
    draw();
    if (st.log) $('[data-log]', view).style.background = 'var(--color-primary-soft)';
    if (!canLog) { const lb = $('[data-log]', view); lb.style.opacity = 0.5; lb.title = 'Logarithmic scale is not available for this chart'; }

    // ---- ranges
    $$('[data-range] button', view).forEach(b => b.addEventListener('click', () => {
      st.range = b.getAttribute('data-v'); st.from = st.to = null;
      $$('[data-range] button', view).forEach(x => x.classList.toggle('active', x === b));
      NAV.state.range = st.range; U.store.set('range', st.range);
      draw();
    }));
    $('[data-apply]', view).addEventListener('click', () => {
      st.from = $('[data-from]', view).value || null;
      st.to = $('[data-to]', view).value || null;
      if (!st.from && !st.to) { NAV.toast('Pick a date', 'Set a from and/or to date, then press Apply.'); return; }
      $$('[data-range] button', view).forEach(x => x.classList.remove('active'));
      draw();
    });
    $('[data-clear]', view).addEventListener('click', () => {
      st.from = st.to = null; $('[data-from]', view).value = ''; $('[data-to]', view).value = '';
      $$('[data-range] button', view).forEach(x => x.classList.toggle('active', x.getAttribute('data-v') === st.range));
      draw();
    });
    // ---- toggles
    $('[data-log]', view).addEventListener('click', (e) => {
      if (!canLog) {
        NAV.toast('Logarithmic scale not available', 'This chart contains values at or below zero (or is an oscillator), so a log axis cannot be drawn. Try a price or level chart instead.');
        return;
      }
      st.log = !st.log;
      e.currentTarget.style.background = st.log ? 'var(--color-primary-soft)' : '';
      draw();
    });
    $('[data-ma]', view).addEventListener('click', (e) => { st.ma = !st.ma; e.currentTarget.style.background = st.ma ? 'var(--color-primary-soft)' : ''; draw(); });
    $('[data-mil]', view).addEventListener('click', (e) => { st.milestones = !st.milestones; e.currentTarget.style.background = st.milestones ? 'var(--color-primary-soft)' : ''; draw(); });
    $('[data-config]', view).addEventListener('click', (e) => {
      NAV.showMenu(e.currentTarget, [
        { label: (st.gradient ? '□' : '☑') + ' Gradient fill', icon: ICONS.image, onClick: () => { st.gradient = !st.gradient; draw(); } },
        { label: (st.ma ? '☑' : '□') + ' 50/200-day MA overlay', icon: ICONS.chart, onClick: () => { st.ma = !st.ma; draw(); } },
        { label: (st.milestones ? '☑' : '□') + ' Gold milestone markers', icon: ICONS.clock, onClick: () => { st.milestones = !st.milestones; draw(); } },
        { label: (st.log ? '☑' : '□') + ' Logarithmic scale' + (canLog ? '' : ' (unavailable)'), icon: ICONS.chart, onClick: () => { if (!canLog) { NAV.toast('Logarithmic scale not available', 'This chart contains values at or below zero, so a log axis cannot be drawn.'); return; } st.log = !st.log; draw(); } },
        { label: 'Alert me at this level (' + F.val(spec.unit, lastValue()) + ')', icon: ICONS.bell, onClick: () => {
            const target = spec.unit === 'usd' ? (NAV.live.spot || lastValue()) : lastValue();
            NAV.alerts.add({ type: spec.unit === 'usd' ? 'price_above' : 'cycle_above', value: Math.round(target * 100) / 100, note: spec.title + ' level' });
            NAV.alerts.evaluate('chart alert');
            NAV.toast('Alert created', 'Fires when ' + esc(spec.title) + ' moves above <b>' + esc(F.val(spec.unit, target)) + '</b>. Manage it on the Alerts page.');
          } },
        { label: 'Reset all options', icon: ICONS.check, onClick: () => { st.gradient = false; st.ma = false; st.milestones = !!spec.milestone; st.log = !!spec.log; st.from = st.to = null; st.extra = []; draw(); } }
      ]);
    });
    // ---- series toggles
    $$('[data-series]', view).forEach(b => b.addEventListener('click', () => {
      const k = Number(b.getAttribute('data-series'));
      st.visible[k] = !st.visible[k];
      b.style.opacity = st.visible[k] ? 1 : 0.4;
      if (chart && chart.series[k]) chart.series[k].setVisible(st.visible[k], true);
    }));
    // ---- add series (compare)
    $('[data-add]', view).addEventListener('click', () => {
      const used = {};
      spec.series.forEach(s => used[s.id] = 1);
      st.extra.forEach(s => used[s.id] = 1);
      const pool = COMPARE_SERIES.filter(x => !used[x.id]);
      const rows = pool.map(x => '<button class="menu-item" data-add-id="' + x.id + '" style="display:flex;gap:.8rem;align-items:center;width:100%;padding:.7rem .9rem;border-radius:.7rem;text-align:left">' +
        '<span style="flex:1"><b style="font-size:1.3rem">' + esc(x.label) + '</b><br><span class="muted tiny">' + esc(x.hint) + '</span></span>' +
        '<span class="chip">' + (x.axis === 1 ? 'right axis' : 'left axis') + '</span></button>').join('');
      const m = NAV.modal('<h3>Add a comparison series</h3><p class="muted" style="font-size:1.25rem">Overlay any other series on this chart. Right-axis series keep their own scale so unrelated units stay readable.</p>' +
        '<div style="max-height:44vh;overflow:auto;display:flex;flex-direction:column;gap:.2rem">' + rows + '</div>' +
        '<div class="actions"><button class="btn btn-secondary" data-close>Close</button></div>',
        { onMount: (back, close) => {
            $$('[data-add-id]', back).forEach(b => b.addEventListener('click', () => {
              const x = pool.find(y => y.id === b.getAttribute('data-add-id'));
              st.extra.push({ id: x.id, label: x.label, color: x.color, yAxis: x.axis, dash: x.dash });
              close(); draw();
            }));
          } });
    });
    // ---- tabs
    $$('[data-tabs] button', view).forEach(b => b.addEventListener('click', () => {
      const t = b.getAttribute('data-tab');
      $$('[data-tabs] button', view).forEach(x => x.classList.toggle('active', x === b));
      $('[data-chart]', view).style.display = t === 'chart' ? '' : 'none';
      $('[data-table]', view).style.display = t === 'data' ? '' : 'none';
      $('[data-about]', view).style.display = t === 'about' ? '' : 'none';
      if (t === 'data' && !$('[data-table]', view).dataset.done) { paintDataTable(); $('[data-table]', view).dataset.done = '1'; }
      if (t === 'about' && !$('[data-about]', view).dataset.done) { $('[data-about]', view).innerHTML = aboutHTML(spec); $('[data-about]', view).dataset.done = '1'; }
    }));
    if (tab === 'data') $('[data-tab="data"]', view).click();
    if (tab === 'about') $('[data-tab="about"]', view).click();

    function paintDataTable() {
      const host2 = $('[data-table]', view);
      const start = st.from || st.to ? D.rangeStart(st.range) : 0;
      const step = 1;
      const extraIds = st.extra.map(x => x.id);
      let rows = '', painted = 0;
      for (let k = D.n - 1; k >= 0; k--) {
        if (st.from && D.dates[k] < st.from) continue;
        if (st.to && D.dates[k] > st.to) continue;
        if (++painted > 2000) break;
        rows += '<tr><td class="mono">' + D.dates[k] + '</td>' + spec.series.map(s => {
          if (s.id === 'gold_ohlc') { const x = D.series.gold_ohlc[k]; return x ? '<td class="mono">' + x.join(' / ') + '</td>' : '<td class="mono">—</td>'; }
          const a = D.resolve(s.id); const v = a ? a[k] : null;
          return '<td class="mono">' + (v == null ? '—' : (spec.unit === 'usd' ? F.usd(v) : spec.unit === 'pct' ? v.toFixed(2) + '%' : Number(v).toFixed(3))) + '</td>';
        }).join('') +
          extraIds.map(id => { const a = D.resolve(id); const v = a ? a[k] : null; return '<td class="mono">' + (v == null ? '—' : Number(v).toFixed(3)) + '</td>'; }).join('') + '</tr>';
      }
      host2.innerHTML = '<div class="srcnote" style="padding:.6rem 0">Showing the most recent ' + Math.min(2000, painted) + ' sessions' + (st.from || st.to ? ' inside the custom range' : '') + ' · the full history (' + D.n + ' sessions) is in the CSV download.</div>' +
        '<div class="data-table-wrap"><table class="table"><thead><tr><th>Date</th>' + spec.series.map(s => '<th>' + esc(s.label || s.id) + '</th>').join('') +
        extraIds.map(id => '<th>' + esc(id) + '</th>').join('') + '</tr></thead><tbody>' + rows + '</tbody></table></div>';
    }
    function aboutHTML(spec) {
      const tiles = CAT.statTiles(spec, D, D.series, D.n);
      return '<div class="grid grid-2"><div><h3 style="font-size:1.5rem;margin:.2rem 0 .6rem">What this shows</h3>' +
        '<div class="srcnote" style="font-size:1.3rem;color:var(--color-text-body)">' + esc(spec.desc) + '</div>' +
        '<h3 style="font-size:1.5rem;margin:1.4rem 0 .6rem">How it is built</h3>' +
        '<div class="srcnote">' + esc(methodFor(spec)) + '</div></div>' +
        '<div><h3 style="font-size:1.5rem;margin:.2rem 0 .6rem">Right now</h3><div class="grid grid-2">' +
        tiles.map(t => '<div class="card" style="padding:1rem"><div class="k muted tiny">' + esc(t.k) + '</div><div class="mono" style="font-size:1.6rem">' + esc(t.v) + '</div></div>').join('') +
        '</div><h3 style="font-size:1.5rem;margin:1.4rem 0 .6rem">Sources</h3><div class="srcnote">' + D.stats.sources.map(s => '· ' + esc(s)).join('<br>') + '</div></div></div>';
    }
    // ---- actions
    $('[data-csv]', view).addEventListener('click', () => { D.downloadCSV(spec, st.range); NAV.flash('CSV downloading'); });
    $('[data-png]', view).addEventListener('click', () => { if (chart) D.exportPNG(chart, spec); else NAV.flash('Nothing to export on this tab'); });
    $('[data-link]', view).addEventListener('click', () => copyLink(spec));
    $('[data-pin]', view).addEventListener('click', () => { NAV.togglePin(spec.slug); NAV.flash(NAV.state.pinned.includes(spec.slug) ? 'Pinned' : 'Unpinned'); });
    $('[data-embed]', view).addEventListener('click', () => {
      const url = location.origin + location.pathname + '#/embed/' + spec.slug;
      (navigator.clipboard ? navigator.clipboard.writeText(url) : Promise.reject()).then(
        () => NAV.flash('Embed link copied — paste it in an iframe'),
        () => NAV.modal('<h3>Embed this chart</h3><p class="mono" style="word-break:break-all">' + esc(url) + '</p><div class="actions"><button class="btn btn-secondary" data-close>Close</button></div>'));
    });
  }

  // series offered by the "Add series" comparison picker
  const COMPARE_SERIES = [
    { id: 'gold_close', label: 'Gold close', hint: 'USD per ounce', color: '#1f1e1c' },
    { id: 'ma50', label: '50-day MA', hint: 'moving average', color: '#c96442', dash: 'ShortDash' },
    { id: 'ma200', label: '200-day MA', hint: 'moving average', color: '#3b8f5a', dash: 'ShortDash' },
    { id: 'ma200w', label: '200-week MA', hint: 'long-term valuation line', color: '#7c6bd1', dash: 'Dash' },
    { id: 'rsi14', label: 'RSI (14D)', hint: 'momentum 0-100', color: '#7c6bd1', axis: 1 },
    { id: 'rsiw', label: 'RSI (14W)', hint: 'weekly momentum', color: '#2f8f8a', axis: 1 },
    { id: 'vol30', label: 'Realized volatility 30D', hint: 'annualised %', color: '#2f6fb2', axis: 1 },
    { id: 'drawdown', label: 'Drawdown from ATH', hint: 'percent', color: '#c0392b', axis: 1 },
    { id: 'dxy', label: 'US Dollar Index', hint: 'DXY level', color: '#2f6fb2', axis: 1 },
    { id: 'realyield', label: '10Y real yield', hint: 'TIPS %', color: '#8d8a83', axis: 1 },
    { id: 'gsr', label: 'Gold / silver ratio', hint: 'ounces of silver per ounce', color: '#c8a24a', axis: 1 },
    { id: 'gor', label: 'Gold / oil ratio', hint: 'barrels per ounce', color: '#2f8f8a', axis: 1 },
    { id: 'gdx_gold', label: 'Miners / gold (GDX)', hint: 'ratio', color: '#7c6bd1', axis: 1 },
    { id: 'real_price', label: 'Real (CPI-adjusted) price', hint: 'today\'s dollars', color: '#c96442' },
    { id: 'z200', label: 'Stretch z-score', hint: 'std devs from 200DMA', color: '#8d8a83', axis: 1 },
    { id: 'mom365', label: '12-month return', hint: 'percent', color: '#3b8f5a', axis: 1 },
    { id: 'macd', label: 'MACD', hint: '12/26/9', color: '#2f6fb2', axis: 1 },
    { id: 'silver_close', label: 'Silver price', hint: 'USD per ounce', color: '#8d8a83', axis: 1 },
    { id: 'spx_close', label: 'S&P 500', hint: 'index level', color: '#2f6fb2', axis: 1 },
    { id: 'dxy_inv', label: 'Inverse dollar', hint: '100 / DXY', color: '#2f8f8a', axis: 1 },
    { id: 'sig:cycle', label: 'Cycle Index score', hint: 'composite 0-100', color: '#c96442', axis: 1 },
    { id: 'sig:rsi14', label: 'RSI signal score', hint: '0-100 score', color: '#7c6bd1', axis: 1 }
  ];

  function methodFor(spec) {
    const id = spec.series.length ? spec.series[0].id : '';
    if (spec.type === 'seasonal' || spec.type === 'heatmap') return 'Monthly returns are computed from month-end closes since 2000 and averaged per calendar month. The heatmap shows every individual monthly return.';
    if (id.indexOf('sig:') === 0) return 'Signal scores are the rolling five-year percentile rank of the underlying metric, expressed 0-100. Phase bands: Bottom 0-25, Bearish 25-50, Bullish 50-75, Top 75-100.';
    if (spec.lbma) return 'Weekly samples of the LBMA Gold PM auction price in USD per troy ounce, from April 1968 to today.';
    if (id === 'real_price') return 'Nominal price deflated by US CPI (CPIAUCSL, FRED), interpolated to the trading calendar and rebased to the latest CPI print.';
    if (['gsr', 'gpr', 'gor', 'gcr', 'gdx_gold', 'gold_spx', 'dxy'].includes(id)) return 'A ratio of two daily closes, computed on the days both series trade. No smoothing, no fill-in.';
    if (['rsi14', 'rsiw'].includes(id)) return "Wilder's RSI with a 14-period lookback, computed on daily closes (weekly version on weekly closes).";
    if (id === 'z200') return 'The deviation of price from its 200-day simple moving average, divided by the 200-day rolling standard deviation of price.';
    if (id === 'macd') return 'EMA(12) minus EMA(26), with a 9-period EMA signal line and the histogram difference.';
    if (id.startsWith('vol')) return 'Annualised standard deviation of daily log returns over the stated window (252 trading days per year).';
    if (id.startsWith('mom')) return 'Simple rate of change over the stated lookback of trading days.';
    if (id === 'gold_ohlc') return 'Front-month COMEX gold futures, continuous daily open-high-low-close.';
    return 'Computed directly from the daily series shown on this chart, without smoothing beyond the indicator definition itself.';
  }

  // =============================================================== SIGNALS
  PAGES.signals = function (view, arg, nav) {
    const rows = D.signals;
    let phaseF = 'all', catF = 'all', sortBy = 'score', topsOnly = false, tlMonths = 120;
    const cats = Array.from(new Set(rows.map(r => r.cat))).sort();
    view.innerHTML = [
      '<div class="page-head"><div><h1 class="page-title">Signal Explorer</h1>' +
      '<div class="page-sub">The composite Cycle Index plus ' + (rows.length - 1) + ' underlying signals — each the five-year percentile rank of a real gold metric, mapped into a cycle phase.</div></div>',
      '<div class="right">',
      '<button class="btn btn-secondary btn-sm" id="topsBtn">' + ICONS.alert + ' Tops &amp; bottoms</button>',
      '<label class="field" style="width:17rem" title="Time machine: show the signals as they were on a past date">' + ICONS.clock +
      '<input type="date" id="tmDate" min="' + D.dates[0] + '" max="' + D.dates[D.n - 1] + '"></label>',
      '<select class="inp" id="fPhase" style="width:13rem"><option value="all">All phases</option><option>Bottom</option><option>Bearish</option><option>Bullish</option><option>Top</option></select>',
      '<select class="inp" id="fCat" style="width:15rem"><option value="all">All categories</option>' + cats.map(c => '<option>' + esc(c) + '</option>').join('') + '</select>',
      '<select class="inp" id="fSort" style="width:15rem"><option value="score">Sort: value</option><option value="d30">Sort: 30d change</option><option value="d7">Sort: 7d change</option><option value="title">Sort: name</option></select>',
      '</div></div>',

      '<div class="card" style="margin-bottom:1.6rem"><div class="card-head"><span class="card-title">Cycle spectrum</span>' +
      '<span class="card-sub">Where the signals sit between the cycle bottom and the cycle top</span>' +
      '<span class="right">' + ttChip() + '</span></div>' +
      '<div class="card-body">' + spectrumHTML() + '</div></div>',

      '<div class="grid grid-4" style="margin-bottom:1.6rem">' + summaryCards() + '</div>',

      '<div class="grid grid-2" style="margin-bottom:1.6rem">' +
      '<div class="card"><div class="card-head"><span class="card-title">Top movers</span>' +
      '<span class="card-sub">biggest 30-day score changes</span></div><div class="card-body" data-movers></div></div>' +
      '<div class="card"><div class="card-head"><span class="card-title">Watch list</span>' +
      '<span class="card-sub">how far the market is from the next notable level</span></div><div class="card-body" data-watch></div></div>' +
      '</div>',

      '<div class="card" style="margin-bottom:1.6rem"><div class="card-head"><span class="card-title">Signal Timeline</span>' +
      '<span class="card-sub">click a column to time-travel</span>' +
      '<span class="right"><div class="pill-group" data-tl><button data-m="60">5Y</button><button data-m="120" class="active">10Y</button><button data-m="400">All</button></div></span></div>' +
      '<div class="card-body" data-heat>' + heatmapHTML(ztSlice()) + '</div></div>',

      '<div class="card"><div class="card-head"><span class="card-title">All signals</span>' +
      '<span class="card-sub" id="sigCount"></span><span class="right"><span class="muted tiny">click a row for the underlying metric</span></span></div>' +
      '<div class="card-body" style="padding:.4rem 0 0"><div class="data-table-wrap"><table class="table" id="sigTable"></table></div></div></div>'
    ].join('');

    function ztSlice() {
      const zt = D.zonetimeline, n = Math.min(tlMonths, zt.cols.length);
      return { cols: zt.cols.slice(-n), rows: zt.rows.map(r => ({ key: r.key, title: r.title, v: r.v.slice(-n) })) };
    }
    function repaintHeat() {
      const host = $('[data-heat]', view);
      host.innerHTML = heatmapHTML(ztSlice());
      mountHeatmap(host);
    }
    mountHeatmap($('[data-heat]', view));
    mountTT(view);

    function spectrumHTML() {
      const cur = NAV.state.tt != null ? NAV.asOf('sig:cycle', NAV.state.tt) : D.signalScore('cycle')[D.n - 1];
      const marks = rows.filter(r => r.key !== 'cycle').map(r => Math.max(0, Math.min(100, r.score)));
      return '<div class="spectrum"><div class="track">' +
        marks.map(v => '<span class="marker" style="left:' + v + '%"></span>').join('') +
        '<span class="pin" style="left:' + Math.max(0, Math.min(100, cur || 0)) + '%">' + Math.round(cur || 0) + ' · ' + D.phaseOf(cur) + '</span>' +
        '</div><div class="scale"><span>Bottom 0</span><span>Bearish 25</span><span>Bullish 50</span><span>Top 75</span><span>100</span></div></div>';
    }

    function breadthNow() {
      const idx = NAV.ttIndex();
      const keys = rows.map(s => s.key).filter(k => k !== 'cycle');
      const b = { Bottom: 0, Bearish: 0, Bullish: 0, Top: 0 };
      keys.forEach(k => { const a = D.signalScore(k); for (let i = Math.min(idx, a.length - 1); i >= 0; i--) if (a[i] != null) { const p = D.phaseOf(a[i]); if (p) b[p]++; break; } });
      b.total = keys.length;
      return b;
    }

    function summaryCards() {
      const cyc = NAV.state.tt != null ? NAV.asOf('sig:cycle', NAV.state.tt) : D.signalScore('cycle')[D.n - 1];
      const phase = D.phaseOf(cyc);
      const b = breadthNow();
      const rising = rows.filter(r => r.key !== 'cycle' && r.d30 > 1).length;
      const flat = rows.filter(r => r.key !== 'cycle' && r.d30 >= -1 && r.d30 <= 1).length;
      const falling = rows.filter(r => r.key !== 'cycle' && r.d30 < -1).length;
      const live = NAV.live;
      const spot = live.spot != null ? live.spot : D.stats.price;
      const cycSpark = D.sparkline(D.signalScore('cycle').slice(-180), { height: 36, width: 200, color: NAV.cssVar('--phase-top', '#c0392b') });
      const pxSpark = D.sparkline(D.series.gold_close.slice(-260), { height: 36, width: 200, color: NAV.cssVar('--color-primary', '#c96442') });
      return [
        '<div class="card pulse"><div class="pulse-top"><span class="pulse-label">Cycle index</span>' +
        '<span class="badge badge-' + (phase || 'bearish').toLowerCase() + '" style="margin-left:auto">' + (phase || '—') + '</span></div>' +
        '<div class="pulse-value">' + (cyc == null ? '—' : Math.round(cyc)) + '<span class="muted" style="font-size:1.4rem">/100</span></div>' +
        gauge(cyc) + '<div class="pulse-foot">30d ' + F.num(rows[0].d30, 1) + ' · 90d ' + F.num(rows[0].d90, 1) + '</div>' + cycSpark + '</div>',

        '<div class="card pulse"><div class="pulse-top"><span class="live-dot pulse"></span><span class="pulse-label">Gold spot</span></div>' +
        '<div class="pulse-value" data-sig-spot>' + F.usd(spot) + '</div>' +
        '<div class="pulse-delta ' + ((live.changePct || 0) >= 0 ? 'up' : 'down') + '" data-sig-chg>' + ((live.changePct || 0) >= 0 ? '▲' : '▼') + ' ' + F.pct(live.changePct || 0) + ' <span class="muted">24h</span></div>' +
        '<div class="pulse-foot">52w range ' + F.usd(D.stats.low52) + ' – ' + F.usd(D.stats.high52) + '</div>' + pxSpark + '</div>',

        '<div class="card pulse"><div class="pulse-top"><span class="pulse-label">Consensus</span></div>' +
        '<div class="pulse-value small">' + (b.Bullish + b.Top) + ' <span class="muted" style="font-size:1.4rem">/ ' + b.total + ' bullish</span></div>' +
        '<div class="bar-track">' +
        '<span style="width:' + (b.Bottom / b.total * 100) + '%;background:' + NAV.cssVar('--phase-bottom', '#3f6f9f') + '"></span>' +
        '<span style="width:' + (b.Bearish / b.total * 100) + '%;background:' + NAV.cssVar('--phase-bearish', '#9dc0dd') + '"></span>' +
        '<span style="width:' + (b.Bullish / b.total * 100) + '%;background:' + NAV.cssVar('--phase-bullish', '#e9b3a3') + '"></span>' +
        '<span style="width:' + (b.Top / b.total * 100) + '%;background:' + NAV.cssVar('--phase-top', '#c0392b') + '"></span>' +
        '</div><div class="pulse-foot">Bottom ' + b.Bottom + ' · Bearish ' + b.Bearish + ' · Bullish ' + b.Bullish + ' · Top ' + b.Top + '</div></div>',

        '<div class="card pulse"><div class="pulse-top"><span class="pulse-label">30d momentum</span></div>' +
        '<div class="pulse-value small">' + rising + ' <span class="muted" style="font-size:1.4rem">/ ' + (b.total) + ' rising</span></div>' +
        '<div class="bar-track">' +
        '<span style="width:' + (rising / b.total * 100) + '%;background:' + NAV.cssVar('--phase-bullish', '#e9b3a3') + '"></span>' +
        '<span style="width:' + (flat / b.total * 100) + '%;background:var(--color-hover-strong)"></span>' +
        '<span style="width:' + (falling / b.total * 100) + '%;background:' + NAV.cssVar('--phase-bottom', '#3f6f9f') + '"></span>' +
        '</div><div class="pulse-foot">Rising ' + rising + ' · Flat ' + flat + ' · Falling ' + falling + '</div></div>'
      ].join('');
    }

    function moversHTML() {
      const list = rows.filter(r => r.key !== 'cycle' && r.d30 != null).slice().sort((a, b) => Math.abs(b.d30) - Math.abs(a.d30)).slice(0, 6);
      return list.map(r => '<div class="alert-row" style="cursor:pointer" data-mk="' + r.key + '">' +
        '<span class="icon-btn" style="pointer-events:none">' + ICONS.chart + '</span>' +
        '<div class="main"><div class="name">' + esc(r.title) + '</div>' +
        '<div class="meta">' + esc(r.cat) + ' · score ' + r.score.toFixed(1) + ' · ' + esc(r.phase) + '</div></div>' +
        '<div class="mono ' + (r.d30 >= 0 ? 'up' : 'down') + '" style="font-size:1.5rem">' + (r.d30 >= 0 ? '▲' : '▼') + ' ' + Math.abs(r.d30).toFixed(1) + '</div>' +
        '<span class="badge badge-' + (r.phase || 'bearish').toLowerCase() + '">' + esc(r.phase) + '</span></div>').join('');
    }
    function watchHTML() {
      const items = window.NT_EVENTS ? window.NT_EVENTS.watchlist() : [];
      return items.map(w => '<div class="alert-row">' +
        '<span class="icon-btn" style="pointer-events:none">' + ICONS.clock + '</span>' +
        '<div class="main"><div class="name">' + esc(w.label) + '</div><div class="meta">' + (w.distance >= 0 ? 'price is ' + w.distance.toFixed(2) + '% above' : 'price is ' + Math.abs(w.distance).toFixed(2) + '% below') + '</div></div>' +
        '<div class="mono" style="font-size:1.35rem;color:' + (w.tone === 'bull' ? NAV.cssVar('--color-up', '#2f7d4f') : w.tone === 'bear' ? NAV.cssVar('--color-down', '#c0392b') : 'var(--color-text-secondary)') + '">' + w.distance.toFixed(2) + '%</div></div>').join('');
    }

    function paintTable() {
      let list = rows.slice();
      if (topsOnly) list = list.filter(r => r.phase === 'Top' || r.phase === 'Bottom');
      if (phaseF !== 'all') list = list.filter(r => r.phase === phaseF);
      if (catF !== 'all') list = list.filter(r => r.cat === catF);
      if (sortBy === 'd30') list.sort((a, b) => (b.d30 || -999) - (a.d30 || -999));
      else if (sortBy === 'd7') list.sort((a, b) => (b.d7 || -999) - (a.d7 || -999));
      else if (sortBy === 'title') list.sort((a, b) => a.title.localeCompare(b.title));
      else list.sort((a, b) => (b.score || -1) - (a.score || -1));
      $('#sigCount').textContent = list.length + ' shown' + (topsOnly ? ' · tops & bottoms only' : '');
      const delta = (v) => v == null ? '<span class="muted">—</span>' : '<span class="' + (v >= 0 ? 'up' : 'down') + '">' + (v >= 0 ? '+' : '') + Number(v).toFixed(1) + '</span>';
      $('#sigTable').innerHTML = '<thead><tr><th class="sortable" data-s="title">Signal</th><th class="sortable" data-s="score">Value</th>' +
        '<th class="sortable" data-s="d7">7d</th><th class="sortable" data-s="d30">30d</th><th class="sortable" data-s="d90">90d</th>' +
        '<th class="sortable" data-s="d365">1y</th><th>Phase</th><th>Position</th><th>1y trend</th></tr></thead><tbody>' +
        list.map(r => '<tr data-key="' + r.key + '" style="cursor:pointer">' +
          '<td><span class="name">' + ICONS.chart + esc(r.title) + '</span>' +
          '<div class="muted tiny">' + esc(r.cat) + ' · now ' + esc(F.val(r.unit, r.raw)) + '</div></td>' +
          '<td class="mono" style="font-size:1.45rem">' + (r.score == null ? '—' : r.score.toFixed(1)) + '</td>' +
          '<td class="mono">' + delta(r.d7) + '</td><td class="mono">' + delta(r.d30) + '</td><td class="mono">' + delta(r.d90) + '</td><td class="mono">' + delta(r.d365) + '</td>' +
          '<td><span class="badge badge-' + (r.phase || 'bearish').toLowerCase() + '">' + esc(r.phase || '—') + '</span></td>' +
          '<td><div class="posbar"><i style="left:' + Math.max(0, Math.min(100, r.score || 0)) + '%"></i></div></td>' +
          '<td class="spark-cell">' + D.sparkline(r.spark1y, { height: 26, width: 110, color: r.phase === 'Top' ? NAV.cssVar('--phase-top', '#c0392b') : r.phase === 'Bottom' ? NAV.cssVar('--phase-bottom', '#3f6f9f') : NAV.cssVar('--phase-bullish', '#e9b3a3'), upIsGood: true }) + '</td>' +
          '</tr>').join('') + '</tbody>';
      $$('#sigTable tbody tr').forEach(tr => tr.addEventListener('click', () => signalModal(tr.getAttribute('data-key'))));
      $$('#sigTable th.sortable').forEach(th => th.addEventListener('click', () => { sortBy = th.getAttribute('data-s'); paintTable(); }));
    }
    paintTable();
    $('[data-movers]', view).innerHTML = moversHTML();
    $('[data-watch]', view).innerHTML = watchHTML();
    $$('[data-mk]', view).forEach(el => el.addEventListener('click', () => signalModal(el.getAttribute('data-mk'))));

    $('#topsBtn').addEventListener('click', (e) => {
      topsOnly = !topsOnly;
      e.currentTarget.style.background = topsOnly ? 'var(--color-primary-soft)' : '';
      paintTable();
    });
    $('#tmDate').addEventListener('change', (e) => {
      const v = e.target.value;
      if (!v) return;
      let idx = D.dates.indexOf(v);
      if (idx < 0) { for (let i = D.n - 1; i >= 0; i--) if (D.dates[i] <= v) { idx = i; break; } }
      if (idx < 0) return;
      NAV.setTT(idx);
      NAV.toast('Time machine', 'Signals are now shown as they were on <b>' + F.niceDate(D.dates[idx]) + '</b>.', 'info');
    });
    $$('[data-tl] button', view).forEach(b => b.addEventListener('click', () => {
      tlMonths = Number(b.getAttribute('data-m'));
      $$('[data-tl] button', view).forEach(x => x.classList.toggle('active', x === b));
      repaintHeat();
    }));
    $('#fPhase').addEventListener('change', (e) => { phaseF = e.target.value; paintTable(); });
    $('#fCat').addEventListener('change', (e) => { catF = e.target.value; paintTable(); });
    $('#fSort').addEventListener('change', (e) => { sortBy = e.target.value; paintTable(); });

    NAV.live.on(() => {
      const el = document.querySelector('[data-sig-spot]');
      if (!el) return;
      const l = NAV.live;
      el.textContent = F.usd(l.spot != null ? l.spot : D.stats.price);
      const c = document.querySelector('[data-sig-chg]');
      if (c) {
        const up = (l.changePct || 0) >= 0;
        c.className = 'pulse-delta ' + (up ? 'up' : 'down');
        c.innerHTML = (up ? '▲' : '▼') + ' ' + F.pct(l.changePct || 0) + ' <span class="muted">24h</span>';
      }
    });
  };

  function signalModal(key) {
    const r = D.signal(key);
    if (!r) return;
    const isCycle = key === 'cycle';
    const spec = {
      slug: 'signal-' + key, title: r.title, unit: 'score', type: 'line', log: false,
      series: [{ id: 'sig:' + key, label: r.title + ' score', color: NAV.cssVar('--color-primary', '#c96442') }],
      bands: [25, 50, 75], min: 0, max: 100, milestone: false
    };
    const rawSpec = {
      slug: 'signal-raw-' + key, title: r.title + ' (underlying metric)', unit: r.unit, type: 'line', log: false,
      series: [{ id: 'raw:' + key, label: r.title, color: NAV.cssVar('--phase-bottom', '#3f6f9f') }],
      milestone: false
    };
    NAV.modal('<h3>' + esc(r.title) + '</h3>' +
      '<p class="muted" style="font-size:1.25rem">' + esc(r.cat) + ' · phase <b>' + esc(r.phase) + '</b> · score <b>' + r.score + '/100</b> · minimum ' + esc(F.val(r.unit, r.min)) + ' · maximum ' + esc(F.val(r.unit, r.max)) + '</p>' +
      '<div class="grid grid-2" style="gap:1.2rem">' +
      '<div><div class="muted tiny" style="margin-bottom:.4rem">Score (0-100, five-year percentile)</div><div data-mc style="height:180px"></div></div>' +
      '<div><div class="muted tiny" style="margin-bottom:.4rem">Underlying metric</div><div data-mr style="height:180px"></div></div>' +
      '</div>' +
      '<div class="grid grid-4" style="margin-top:1.2rem">' +
      [['7d', r.d7], ['30d', r.d30], ['90d', r.d90], ['1y', r.d365]].map(([k, v]) =>
        '<div class="card" style="padding:.9rem"><div class="muted tiny">' + k + ' change</div><div class="mono ' + (v >= 0 ? 'up' : 'down') + '" style="font-size:1.5rem">' + (v == null ? '—' : (v >= 0 ? '+' : '') + v.toFixed(1)) + '</div></div>').join('') +
      '</div>' +
      '<div class="actions"><button class="btn btn-secondary" data-close>Close</button>' +
      '<button class="btn btn-primary" data-alert>' + ICONS.bell + ' Alert me on this signal</button></div>',
      {
        onMount: (back, close) => {
          const c1 = D.renderChart($('[data-mc]', back), spec, { height: 180 });
          let c2 = null;
          try { c2 = D.renderChart($('[data-mr]', back), rawSpec, { height: 180 }); } catch (e) { }
          close._charts = [c1, c2];
          $('[data-alert]', back).addEventListener('click', () => {
            close();
            NAV.go('alerts');
            setTimeout(() => window.NT_ALERTS.openForSignal && window.NT_ALERTS.openForSignal(key), 120);
          });
        }
      });
  }

  // ================================================================ ALERTS
  PAGES.alerts = function (view, arg, nav) {
    const A = NAV.alerts, TYPES = window.NT_ALERTS.ALERT_TYPES;
    const active = A.list.filter(a => a.active);
    const nearest = active.map(a => ({ a, cur: A.currentOf(a.type), dist: distance(a, A.currentOf(a.type)) }))
      .filter(x => x.dist != null && isFinite(x.dist)).sort((x, y) => x.dist - y.dist)[0];

    view.innerHTML = [
      '<div class="page-head"><div><h1 class="page-title">Alerts</h1>' +
      '<div class="page-sub">Live gold-price alerts, cycle-phase alerts and signal-threshold alerts. Everything is evaluated in your browser against the live feed — nothing is sent anywhere.</div></div>',
      '<div class="right"><button class="btn btn-secondary" id="notifyBtn">' + ICONS.bell + ' Desktop notifications</button>' +
      '<button class="btn btn-primary" id="newAlert">' + ICONS.plus + ' New alert</button></div></div>',

      '<div class="grid grid-4" style="margin-bottom:1.6rem">' +
      tile('Active alerts', String(active.length), A.list.length + ' total created') +
      tile('Triggered', String(A.log.length), 'in this browser') +
      tile('Live gold', F.usd(NAV.live.spot != null ? NAV.live.spot : D.stats.price), (NAV.live.changePct || 0).toFixed(2) + '% 24h') +
      tile('Nearest alert', nearest ? nearest.a.note || (TYPES[nearest.a.type] || {}).label : '—', nearest ? nearest.dist.toFixed(2) + '% away' : 'no active price alert') +
      '</div>',

      '<div class="card" style="margin-bottom:1.6rem"><div class="card-head"><span class="card-title">Create an alert</span>' +
      '<span class="card-sub">Alerts are checked every 20 seconds against the live feed, and on every page load for the slow signals.</span></div>' +
      '<div class="card-body" id="alertForm"></div></div>',

      '<div class="card" style="margin-bottom:1.6rem"><div class="card-head"><span class="card-title">Active alerts</span>' +
      '<span class="card-sub" id="alertCount">' + A.list.length + ' configured</span></div>' +
      '<div id="alertList"></div></div>',

      '<div class="card"><div class="card-head"><span class="card-title">Triggered history</span>' +
      '<span class="card-sub">' + A.log.length + ' events</span>' +
      '<span class="right"><button class="btn btn-secondary btn-sm" id="clearLog">' + ICONS.trash + ' Clear log</button></span></div>' +
      '<div id="alertLog"></div></div>'
    ].join('');

    function tile(k, v, sub) {
      return '<div class="card pulse"><div class="pulse-top"><span class="pulse-label">' + esc(k) + '</span></div>' +
        '<div class="pulse-value small">' + esc(v) + '</div><div class="pulse-foot">' + esc(sub) + '</div></div>';
    }
    function distance(a, cur) {
      if (cur == null || a.value == null) return null;
      if (a.type === 'phase_change') return null;
      return Math.abs((a.value - cur) / (cur || 1)) * 100;
    }

    function form(html, preset) {
      const t = preset || 'price_above';
      return '<div class="row">' +
        '<div class="form-row" style="flex:1.3"><label>Alert type</label><select class="inp" id="aType">' +
        Object.keys(TYPES).map(k => '<option value="' + k + '"' + (k === t ? ' selected' : '') + '>' + esc(TYPES[k].label) + '</option>').join('') + '</select></div>' +
        '<div class="form-row" style="flex:.8"><label>Value</label><input class="inp" id="aValue" type="number" step="any" placeholder="' + (t.startsWith('price') ? '4500' : t.startsWith('cycle') || t.startsWith('rsi') ? '70' : '-10') + '"></div>' +
        '<div class="form-row" style="flex:1.2"><label>Note (optional)</label><input class="inp" id="aNote" placeholder="e.g. trim position"></div>' +
        '<button class="btn btn-primary" id="aAdd" style="margin-bottom:1.2rem">' + ICONS.plus + ' Add alert</button></div>' +
        '<div class="srcnote" id="aHint">' + esc(TYPES[t].hint) + '</div>';
    }
    function paintForm() {
      $('#alertForm').innerHTML = form(null, window.__alertPreset || 'price_above');
      $('#aType').addEventListener('change', (e) => { window.__alertPreset = e.target.value; paintForm(); });
      $('#aAdd').addEventListener('click', addFromForm);
    }
    function addFromForm() {
      const type = $('#aType').value, value = Number($('#aValue').value), note = $('#aNote').value.trim();
      if (!isFinite(value) && type !== 'phase_change') { NAV.toast('Value required', 'Enter a numeric threshold for this alert type.'); return; }
      NAV.alerts.add({ type, value: type === 'phase_change' ? null : value, note });
      NAV.alerts.evaluate('new alert check');
      NAV.toast('Alert created', esc((TYPES[type] || {}).label) + (type === 'phase_change' ? '' : ' → <b>' + NAV.alerts.fmtValue(type, value) + '</b>'));
      window.__alertPreset = 'price_above';
      paintAll();
    }
    function paintList() {
      if (!$('#alertList')) return;
      const rows = NAV.alerts.list;
      $('#alertCount').textContent = rows.length + ' configured';
      $('#alertList').innerHTML = rows.length ? rows.map(a => {
        const cur = NAV.alerts.currentOf(a.type), dist = distance(a, cur);
        return '<div class="alert-row' + (a.active ? '' : ' off') + '">' +
          '<span class="icon-btn" style="pointer-events:none">' + (a.type.indexOf('price') === 0 ? ICONS.chart : ICONS.bell) + '</span>' +
          '<div class="main"><div class="name">' + esc((TYPES[a.type] || {}).label) + (a.type === 'phase_change' ? '' : ' <span class="mono">' + esc(NAV.alerts.fmtValue(a.type, a.value)) + '</span>') + '</div>' +
          '<div class="meta">now <span class="mono">' + esc(NAV.alerts.fmtValue(a.type, cur)) + '</span>' +
          (dist != null ? ' · ' + dist.toFixed(2) + '% away' : '') +
          (a.note ? ' · ' + esc(a.note) : '') +
          (a.triggered ? ' · fired ' + a.triggered + '×' : '') + '</div></div>' +
          '<button class="switch' + (a.active ? ' on' : '') + '" data-toggle="' + a.id + '" title="Enable / disable"></button>' +
          '<button class="icon-btn" data-snooze="' + a.id + '" title="Snooze for 30 minutes">' + ICONS.clock + '</button>' +
          '<button class="icon-btn" data-edit="' + a.id + '" title="Edit this alert">' + ICONS.chart + '</button>' +
          '<button class="icon-btn" data-dup="' + a.id + '" title="Duplicate">' + ICONS.plus + '</button>' +
          '<button class="icon-btn" data-del="' + a.id + '" title="Delete">' + ICONS.trash + '</button></div>';
      }).join('') : '<div class="empty">' + ICONS.bell + '<div>No alerts yet. Create one above — for example “alert me when gold trades above $4,500”.</div></div>';
      $$('[data-toggle]', view).forEach(b => b.addEventListener('click', () => { NAV.alerts.toggle(b.getAttribute('data-toggle')); paintAll(); }));
      $$('[data-del]', view).forEach(b => b.addEventListener('click', () => { NAV.alerts.remove(b.getAttribute('data-del')); paintAll(); }));
      $$('[data-dup]', view).forEach(b => b.addEventListener('click', () => {
        const src = NAV.alerts.list.find(x => x.id === b.getAttribute('data-dup'));
        if (!src) return;
        NAV.alerts.add({ type: src.type, value: src.value, note: (src.note || '') + ' (copy)' });
        paintAll();
      }));
      $$('[data-edit]', view).forEach(b => b.addEventListener('click', () => {
        const a = NAV.alerts.list.find(x => x.id === b.getAttribute('data-edit'));
        if (!a) return;
        const types = Object.keys(TYPES).map(k => '<option value="' + k + '"' + (k === a.type ? ' selected' : '') + '>' + esc(TYPES[k].label) + '</option>').join('');
        NAV.modal('<h3>Edit alert</h3><p class="muted" style="font-size:1.25rem">Change the condition, threshold or note.</p>' +
          '<div class="form-row"><label>Alert type</label><select class="inp" id="eType">' + types + '</select></div>' +
          '<div class="form-row"><label>Value</label><input class="inp" id="eValue" type="number" step="any" value="' + (a.value == null ? '' : a.value) + '"></div>' +
          '<div class="form-row"><label>Note</label><input class="inp" id="eNote" value="' + esc(a.note || '') + '"></div>' +
          '<div class="actions"><button class="btn btn-secondary" data-close>Cancel</button><button class="btn btn-primary" id="eSave">Save changes</button></div>',
          { onMount: (back, close) => {
              $('#eType', back).addEventListener('change', (ev) => { $('#eValue', back).placeholder = TYPES[ev.target.value].hint; });
              $('#eSave', back).addEventListener('click', () => {
                const v = $('#eValue', back).value;
                NAV.alerts.update(a.id, { type: $('#eType', back).value, value: v === '' ? null : Number(v), note: $('#eNote', back).value.trim(), lastTriggered: null });
                close(); NAV.alerts.evaluate('edited alert'); paintAll();
                NAV.toast('Alert updated', 'The new condition is active from now on.');
              });
            } });
      }));
      $$('[data-snooze]', view).forEach(b => b.addEventListener('click', () => {
        NAV.alerts.update(b.getAttribute('data-snooze'), { lastTriggered: new Date().toISOString() });
        NAV.toast('Alert snoozed', 'It will not fire again for the next 30 minutes.');
        paintAll();
      }));
    }
    function paintLog() {
      if (!$('#alertLog')) return;
      const log = NAV.alerts.log;
      $('#alertLog').innerHTML = log.length ? log.map(l => '<div class="alert-row">' +
        '<span class="icon-btn" style="pointer-events:none">' + ICONS.bell + '</span>' +
        '<div class="main"><div class="name">' + esc(l.title) + ' · <span class="mono">' + esc(l.value) + '</span></div>' +
        '<div class="meta">' + new Date(l.ts).toLocaleString('en-US') + (l.note ? ' · ' + esc(l.note) : '') + ' · ' + esc(l.reason || '') + '</div></div></div>').join('')
        : '<div class="empty">' + ICONS.clock + '<div>Nothing has triggered yet.</div></div>';
    }
    function paintAll() { paintList(); paintLog(); }
    paintForm(); paintAll();

    $('#notifyBtn').addEventListener('click', () => {
      if (!window.Notification) { NAV.toast('Not supported', 'This browser has no Notification API. In-page toasts and the alarm sound still work.'); return; }
      Notification.requestPermission().then(p => NAV.toast('Notifications: ' + p, p === 'granted' ? 'Desktop notifications will appear when an alert fires.' : 'Alerts will still show as in-page toasts and play the alarm sound.'));
    });
    $('#newAlert').addEventListener('click', () => {
      NAV.modal('<h3>New alert</h3><p class="muted" style="font-size:1.25rem">Alerts run entirely in your browser against the live gold feed.</p>' + form(),
        { onMount: (back, close) => {
          $('#aType', back).addEventListener('change', (e) => { $('[data-body]', back); $('#aHint', back).textContent = TYPES[e.target.value].hint; });
          $('#aAdd', back).addEventListener('click', () => {
            const type = $('#aType', back).value, value = Number($('#aValue', back).value), note = $('#aNote', back).value.trim();
            if (!isFinite(value) && type !== 'phase_change') { NAV.toast('Value required', 'Enter a numeric threshold.'); return; }
            NAV.alerts.add({ type, value: type === 'phase_change' ? null : value, note });
            NAV.alerts.evaluate('new alert check');
            close(); NAV.toast('Alert created', esc(TYPES[type].label) + (type === 'phase_change' ? '' : ' → <b>' + NAV.alerts.fmtValue(type, value) + '</b>'));
            paintAll();
          });
        } });
    });
    $('#clearLog').addEventListener('click', () => { NAV.alerts.log = []; NAV.alerts.save(); paintAll(); });

    window.addEventListener('nt-alert', () => { paintAll(); }, { once: true });
    const iv = setInterval(() => { if (!$('#alertList')) { clearInterval(iv); return; } paintAll(); }, 20000);
    NAV.onLeave = () => clearInterval(iv);
  };
  window.NT_ALERTS.openForSignal = null;

  // =============================================================== MONITOR
  PAGES.monitor = function (view, arg, nav) {
    const EV = window.NT_EVENTS;
    const all = EV.detect();
    let typeFilter = 'all', toneFilter = 'all', shown = 60;

    const TYPES = Array.from(new Set(all.map(e => e.type))).sort();
    const count = (days, tone) => {
      const cutoff = D.ts[D.n - 1] - days * 864e5;
      return all.filter(e => e.t >= cutoff && (!tone || e.tone === tone)).length;
    };
    const labelOf = (t) => ({
      ath: 'New all-time high', dd10: 'Drawdown -10%', dd20: 'Drawdown -20%', dd30: 'Drawdown -30%',
      rsi70: 'RSI above 70', rsi30: 'RSI below 30', golden_cross: 'Golden cross', death_cross: 'Death cross',
      cross200d_up: 'Above 200-day MA', cross200d_down: 'Below 200-day MA',
      cross200w_up: 'Above 200-week MA', cross200w_down: 'Below 200-week MA',
      vol_spike: 'Volatility spike', vol_calm: 'Volatility compressed',
      gsr_high: 'Gold/silver above 80', gsr_low: 'Gold/silver below 50',
      phase_up: 'Cycle phase up', phase_down: 'Cycle phase down',
      ry_up: 'Real yield up', ry_down: 'Real yield down',
      dxy_high: 'Dollar 52w high', dxy_low: 'Dollar 52w low',
      mom365_pos: '12M return positive', mom365_neg: '12M return negative',
      milestone_up: 'Milestone', milestone_down: 'Milestone'
    }[t] || t);

    function tile(k, v, sub) {
      return '<div class="card pulse"><div class="pulse-top"><span class="pulse-label">' + esc(k) + '</span></div>' +
        '<div class="pulse-value small">' + v + '</div><div class="pulse-foot">' + esc(sub) + '</div></div>';
    }
    function stateHTML() {
      const live = NAV.live, S = D.series, L = a => { for (let i = D.n - 1; i >= 0; i--) if (a[i] != null) return a[i]; return null; };
      const spot = live.spot != null ? live.spot : D.stats.price;
      const cyc = D.signalScore('cycle')[D.n - 1];
      const rows = [
        ['Gold spot', F.usd(spot), ''],
        ['24h change', F.pct(live.changePct || 0), (live.changePct || 0) >= 0 ? 'up' : 'down'],
        ['Cycle index', Math.round(cyc) + '/100 · ' + D.phaseOf(cyc), ''],
        ['RSI (14D)', F.num(L(S.rsi14), 1) + (L(S.rsi14) > 70 ? ' · overbought' : L(S.rsi14) < 30 ? ' · oversold' : ''), ''],
        ['Drawdown from ATH', F.pct(L(S.drawdown)), 'down'],
        ['Realized volatility 30D', F.num(L(S.vol30), 1) + '%', ''],
        ['Gold / silver ratio', F.num(L(S.gsr), 1), ''],
        ['10Y real yield', F.num(L(S.realyield), 2) + '%', ''],
        ['vs 200-day average', F.pct((spot / L(S.ma200) - 1) * 100), (spot / L(S.ma200) - 1) >= 0 ? 'up' : 'down'],
        ['vs 200-week average', F.pct((spot / L(S.ma200w) - 1) * 100), (spot / L(S.ma200w) - 1) >= 0 ? 'up' : 'down']
      ];
      return rows.map(r => '<div class="alert-row" style="padding:.55rem 0">' +
        '<div class="main"><div class="meta">' + esc(r[0]) + '</div></div>' +
        '<div class="mono ' + r[2] + '" style="font-size:1.4rem">' + esc(r[1]) + '</div></div>').join('');
    }
    function watchHTML() {
      return (EV.watchlist() || []).map(w => '<div class="alert-row">' +
        '<span class="icon-btn" style="pointer-events:none">' + ICONS.clock + '</span>' +
        '<div class="main"><div class="name">' + esc(w.label) + '</div>' +
        '<div class="meta">' + (w.distance >= 0 ? 'price is ' + w.distance.toFixed(2) + '% above' : 'price is ' + Math.abs(w.distance).toFixed(2) + '% below') + '</div></div>' +
        '<div class="mono tiny" style="color:' + (w.tone === 'bull' ? NAV.cssVar('--color-up', '#2f7d4f') : w.tone === 'bear' ? NAV.cssVar('--color-down', '#c0392b') : 'var(--color-text-secondary)') + '">' + w.distance.toFixed(2) + '%</div></div>').join('');
    }
    function feedHTML() {
      let list = all.filter(e => typeFilter === 'all' || e.type === typeFilter);
      if (toneFilter !== 'all') list = list.filter(e => e.tone === toneFilter);
      $('#mCount').textContent = list.length + ' events · newest first';
      const slice = list.slice(0, shown);
      const months = {};
      slice.forEach(e => { const m = e.d.slice(0, 7); (months[m] = months[m] || []).push(e); });
      const body = Object.keys(months).sort().reverse().map(m => {
        const head = CAT.months[Number(m.slice(5, 7)) - 1] + ' ' + m.slice(0, 4);
        return '<div style="padding:.9rem 1.5rem .2rem;font-size:1.15rem;font-weight:600;letter-spacing:.06em;text-transform:uppercase;color:var(--color-text-muted)">' +
          esc(head) + '</div>' + months[m].map(e => {
            const col = e.tone === 'bull' ? NAV.cssVar('--color-up', '#2f7d4f') : e.tone === 'bear' ? NAV.cssVar('--color-down', '#c0392b') : 'var(--color-text-muted)';
            const days = Math.max(0, Math.round((D.ts[D.n - 1] - e.t) / 864e5));
            const ago = days === 0 ? 'today' : days === 1 ? 'yesterday' : days + 'd ago';
            const slug = CHART_FOR_EVENT[e.type];
            return '<div class="alert-row' + (slug ? ' clickable' : '') + '"' + (slug ? ' data-ev="' + slug + '" title="Open the related chart"' : '') + '>' +
              '<span style="width:.8rem;height:.8rem;border-radius:50%;background:' + col + ';flex:none"></span>' +
              '<div class="main"><div class="name">' + esc(e.title) + '</div><div class="meta">' + esc(e.detail) + '</div></div>' +
              '<div style="text-align:right"><div class="mono" style="font-size:1.35rem">' + esc(F.val(e.unit, e.value)) + '</div>' +
              '<div class="tiny muted">' + F.niceDate(e.d) + ' · ' + ago + '</div></div></div>';
          }).join('');
      }).join('');
      $('#mFeed').innerHTML = (body || '<div class="empty">No events match that filter.</div>') +
        (list.length > shown ? '<div style="padding:1.2rem;text-align:center"><button class="btn btn-secondary btn-sm" id="mMore">Show ' + Math.min(60, list.length - shown) + ' more of ' + list.length + '</button></div>' : '');
      const more = $('#mMore');
      if (more) more.addEventListener('click', () => { shown += 60; feedHTML(); });
      $$('[data-ev]').forEach(el => el.addEventListener('click', () => NAV.go('charts/' + el.getAttribute('data-ev'))));
    }

    view.innerHTML = [
      '<div class="page-head"><div><h1 class="page-title">Monitor</h1>' +
      '<div class="page-sub">What just happened in the gold market — threshold crossings, moving-average crosses and cycle-phase changes, all detected from the price history. Nothing is narrated: if the data did not cross, there is no event.</div></div>',
      '<div class="right">' +
      '<select class="inp" id="mType" style="width:20rem"><option value="all">All event types</option>' +
      TYPES.map(t => '<option value="' + t + '">' + esc(labelOf(t)) + '</option>').join('') + '</select>' +
      '<div class="pill-group" id="mTone"><button data-t="all" class="active">All</button><button data-t="bull">Bullish</button><button data-t="bear">Bearish</button></div>' +
      '</div></div>',
      '<div class="grid grid-4" style="margin-bottom:1.6rem">' +
      tile('Events · 30 days', count(30), 'detected from ' + D.n + ' sessions') +
      tile('Events · 90 days', count(90), 'thresholds and regime changes') +
      tile('Bullish · 1 year', count(365, 'bull'), 'events that favour gold') +
      tile('Bearish · 1 year', count(365, 'bear'), 'events that work against gold') +
      '</div>',
      '<div class="grid grid-2" style="margin-bottom:1.6rem">' +
      '<div class="card"><div class="card-head"><span class="card-title">Right now</span>' +
      '<span class="card-sub">live state of the market</span></div><div class="card-body" data-state></div></div>' +
      '<div class="card"><div class="card-head"><span class="card-title">Watch list</span>' +
      '<span class="card-sub">distance to the next notable level</span></div><div class="card-body" data-watch></div></div>' +
      '</div>',
      '<div class="card"><div class="card-head"><span class="card-title">Event feed</span>' +
      '<span class="card-sub" id="mCount"></span>' +
      '<span class="right"><span class="live-dot pulse"></span><span class="tiny muted">live price watched every 20s</span></span></div>' +
      '<div id="mFeed"></div></div>'
    ].join('');

    $('[data-state]', view).innerHTML = stateHTML();
    $('[data-watch]', view).innerHTML = watchHTML();
    feedHTML();

    $('#mType').addEventListener('change', (e) => { typeFilter = e.target.value; shown = 60; feedHTML(); });
    $$('#mTone button').forEach(b => b.addEventListener('click', () => {
      toneFilter = b.getAttribute('data-t');
      $$('#mTone button').forEach(x => x.classList.toggle('active', x === b));
      shown = 60; feedHTML();
    }));
    NAV.live.on(() => { const host = document.querySelector('[data-state]'); if (host) host.innerHTML = stateHTML(); });
  };

  // ================================================================= EMBED
  PAGES.embed = function (view, arg) {
    const spec = CAT.bySlug(arg) || CAT.charts[0];
    const h = Math.max(320, window.innerHeight - 130);
    view.innerHTML = '<div class="card"><div class="card-head"><span class="card-title">' + esc(spec.title) + '</span>' +
      '<span class="card-sub">' + esc(F.unitLabel(spec.unit)) + '</span>' +
      '<span class="right"><a class="chip" href="#/charts/' + spec.slug + '" target="_blank" rel="noopener">Open full chart ' + ICONS.external + '</a></span></div>' +
      '<div class="card-body"><div data-chart="' + spec.slug + '" style="height:' + h + 'px"></div></div>' +
      '<div class="card-foot"><span class="srcnote">Noman_trading · gold market analytics · data through ' + esc(D.stats.date) + '</span></div></div>';
    const ch = D.renderChart($('[data-chart]', view), spec, { height: h, range: 'ALL' });
    NAV.register(spec, ch);
    window.addEventListener('resize', () => { try { if (ch && ch.reflow) ch.reflow(); } catch (e) { } });
  };

  // ================================================================= ABOUT
  PAGES.about = function (view) {
    view.innerHTML = [
      '<div class="page-head"><div><h1 class="page-title">About the data</h1>' +
      '<div class="page-sub">Where every number on Noman_trading comes from.</div></div></div>',
      '<div class="grid grid-2">',
      '<div class="card"><div class="card-head"><span class="card-title">Sources</span></div><div class="card-body"><div class="srcnote">' +
      D.stats.sources.map(s => '· ' + esc(s)).join('<br>') +
      '</div><div class="srcnote" style="margin-top:1rem">Live spot price: gold-api.com (XAU/USD) with a Binance PAXG/USDT fallback for the 24h change and the intraday shape. Intraday sparklines use 5-minute PAXG/USDT candles as a 24/7 proxy for the gold market.</div></div></div>',
      '<div class="card"><div class="card-head"><span class="card-title">Method</span></div><div class="card-body"><div class="srcnote">' +
      'Daily series are built on the COMEX futures calendar (' + D.n + ' sessions, ' + D.dates[0] + ' → ' + D.dates[D.n - 1] + '). ' +
      'Long-history context uses the LBMA Gold PM benchmark since 1968. Cross-asset ratios are computed only on days where both legs trade, with no fill-in. ' +
      'Signals are rolling five-year percentile ranks mapped to four phases: Bottom (0-25), Bearish (25-50), Bullish (50-75), Top (75-100). ' +
      'The Cycle Index is the equal-weighted average of the 20 signal scores.' +
      '</div></div></div>',
      '<div class="card"><div class="card-head"><span class="card-title">Build</span></div><div class="card-body"><div class="srcnote">' +
      'Dataset built ' + esc(D.stats.built) + ' · latest session ' + esc(D.stats.date) + ' · ' + D.n + ' daily observations · ' +
      CAT.charts.length + ' charts · ' + D.signals.length + ' scored signals.<br>To refresh the data, run the builder script and reload this page.' +
      '</div></div></div>',
      '<div class="card"><div class="card-head"><span class="card-title">Disclaimer</span></div><div class="card-body"><div class="srcnote">' +
      'Noman_trading is an analytics and research tool, not investment advice. Futures prices differ slightly from spot, and proxy series (gold-backed tokens, ETF-era miner data) have shorter histories than the metal itself. ' +
      'Alerts are evaluated in your browser and only while this page is open.' +
      '</div></div></div>',
      '</div>'
    ].join('');
  };
})();
