/* ==========================================================================
   Noman_trading — data facade, Highcharts theme, chart factory, sparklines
   ========================================================================== */
(function () {
  const CAT = window.NT_CATALOGUE;
  const RAW = window.NT_DATA;
  const N = RAW.series.dates.length;
  const TS = RAW.series.dates.map(d => Date.parse(d + 'T00:00:00Z'));

  // ------------------------------------------------------------- ranges
  const RANGE_YEARS = { '1M': 1 / 12, '3M': 0.25, '6M': 0.5, '1Y': 1, '2Y': 2, '3Y': 3, '5Y': 5, '10Y': 10, '15Y': 15 };
  const RANGE_KEYS = ['1M', '3M', '6M', 'YTD', '1Y', '3Y', '5Y', '10Y', 'ALL'];
  function rangeStart(range) {
    if (range == null || range === 0 || range === '0') return 0;
    const key = String(range).toUpperCase();
    if (key === 'ALL') return 0;
    if (key === 'YTD') {
      const year = RAW.series.dates[N - 1].slice(0, 4);
      const i = RAW.series.dates.findIndex(d => d >= year + '-01-01');
      return i < 0 ? 0 : i;
    }
    const years = RANGE_YEARS[key] != null ? RANGE_YEARS[key] : Number(range);
    if (!years || !isFinite(years)) return 0;
    const cutoff = TS[N - 1] - years * 365.25 * 864e5;
    const i = TS.findIndex(t => t >= cutoff);
    return i < 0 ? 0 : i;
  }

  // ------------------------------------------------------------ data facade
  const S = CAT.computeDerived(RAW);
  // oil rebasing (needs the raw close added here so stat tiles stay cheap)
  (function () {
    const rebase = (a) => { const f = a.find(v => v != null); return a.map(v => (v == null || !f ? null : Math.round(v / f * 100 * 100) / 100)); };
    S.oil_idx = rebase(S.oil_close);
    S.plat_idx = rebase(S.plat_close);
    S.copper_idx = rebase(S.copper_close);
    S.gdx_idx = rebase(S.gdx_close);
  })();

  const byKey = {};
  RAW.signals.forEach(s => { byKey[s.key] = s; });
  // full daily score / raw series for every signal, injected as ordinary series ids
  Object.keys(RAW.signal_series || {}).forEach(k => { S['sig:' + k] = RAW.signal_series[k]; });
  Object.keys(RAW.signal_raw || {}).forEach(k => { S['raw:' + k] = RAW.signal_raw[k]; });

  const D = window.NT = {
    raw: RAW,
    series: S,
    dates: RAW.series.dates,
    ts: TS,
    n: N,
    stats: RAW.stats,
    signals: RAW.signals,
    season: RAW.season,
    zonetimeline: RAW.zonetimeline,
    phaseOf(score) {
      if (score == null) return null;
      if (score < 25) return 'Bottom';
      if (score < 50) return 'Bearish';
      if (score < 75) return 'Bullish';
      return 'Top';
    },
    signal(key) { return byKey[key]; },
    signalScore(key) { return S['sig:' + key] || null; },
    signalRaw(key) { return S['raw:' + key] || null; },
    signalNow(key) { const r = byKey[key]; return r ? r.score : null; },
    resolve(id) { return S[id]; },
    // array of [ts, value]; `range` is '1M' | '3M' | '6M' | 'YTD' | '1Y' | '3Y' |
    // '5Y' | '10Y' | 'ALL' | a number of years (legacy) | 0 for everything
    points(id, range) {
      const arr = this.resolve(id);
      if (!arr) return [];
      // series that do not sit on the daily grid: LBMA has its own axis, other
      // short series (return distributions) are anchored to the last N sessions
      let axis = TS, short = false;
      if (id === 'lbma_close') { axis = S.lbma_dates.map(d => Date.parse(d + 'T00:00:00Z')); short = true; }
      else if (arr.length !== N) { axis = TS.slice(-arr.length); short = true; }
      let start = 0;
      if (!short) start = rangeStart(range);
      const out = [];
      const isOHLC = Array.isArray(arr[0]) && arr[0].length === 4;
      const isScatter = id === 'riskreward';
      for (let i = start; i < arr.length; i++) {
        if (arr[i] == null || axis[i] == null) continue;
        if (isScatter) { out.push([arr[i][0], arr[i][1]]); continue; }
        out.push(isOHLC ? [axis[i], arr[i][1], arr[i][2], arr[i][3]] : [axis[i], arr[i]]);
      }
      return out;
    },
    last(id) { const a = this.resolve(id); for (let i = N - 1; i >= 0; i--) if (a[i] != null) return a[i]; return null; },
    from(x) { for (let i = Math.max(0, x); i < N; i++) if (S.gold_close[i] != null) { S.gold_close[i] = S.gold_close[i]; } },
    forEachSeries(fn) { Object.keys(S).forEach(k => { if (Array.isArray(S[k]) && S[k].length === N) fn(k, S[k]); }); },
    dateAt(i) { return RAW.series.dates[i]; },
    season_matrix: RAW.season.matrix
  };

  const esc = (v) => String(v == null ? '' : v).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  // ------------------------------------------------------------ formatting
  const fmt = {
    usd(v, dec) {
      if (v == null || !isFinite(v)) return '—';
      const d = dec != null ? dec : Math.abs(v) >= 1000 ? 0 : 2;
      return '$' + Number(v).toLocaleString('en-US', { minimumFractionDigits: d, maximumFractionDigits: d });
    },
    usdAxis(v) {
      const a = Math.abs(v);
      if (a >= 1e6) return '$' + (v / 1e6).toFixed(a >= 1e7 ? 0 : 1) + 'M';
      if (a >= 1e3) return '$' + (v / 1e3).toFixed(a >= 1e4 ? 0 : 1) + 'K';
      if (a >= 1) return '$' + v.toFixed(0);
      return '$' + v.toFixed(2);
    },
    pct(v, dec) { return v == null || !isFinite(v) ? '—' : (v > 0 ? '+' : '') + Number(v).toFixed(dec != null ? dec : 2) + '%'; },
    pctAxis(v) { return Number(v).toFixed(0) + '%'; },
    num(v, dec) { return v == null || !isFinite(v) ? '—' : Number(v).toLocaleString('en-US', { minimumFractionDigits: dec || 0, maximumFractionDigits: dec || 0 }); },
    compact(v) {
      if (v == null) return '—';
      const a = Math.abs(v);
      if (a >= 1e9) return (v / 1e9).toFixed(1) + 'B';
      if (a >= 1e6) return (v / 1e6).toFixed(1) + 'M';
      if (a >= 1e3) return (v / 1e3).toFixed(1) + 'K';
      return v.toFixed(0);
    },
    date(d) { return d; },
    niceDate(d) { const dt = new Date(d + 'T00:00:00Z'); return dt.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' }); },
    val(unit, v) {
      if (v == null || !isFinite(v)) return '—';
      if (unit === 'usd') return this.usd(v);
      if (unit === 'pct') return this.pct(v);
      if (unit === 'idx' || unit === 'score') return Number(v).toFixed(Math.abs(v) < 100 ? 1 : 0);
      if (unit === 'ratio') return Number(v).toFixed(2);
      if (unit === 'z') return Number(v).toFixed(2);
      return String(v);
    },
    unitLabel(unit) {
      return unit === 'usd' ? 'USD / oz' : unit === 'pct' ? 'percent' : unit === 'score' ? 'score 0-100'
        : unit === 'z' ? 'standard deviations' : unit === 'idx' ? 'index' : '';
    }
  };
  D.fmt = fmt;
  D.rangeStart = rangeStart;
  D.RANGE_KEYS = RANGE_KEYS;

  // -------------------------------------------------------- chart palette
  const css = (k, fallback) => {
    const v = getComputedStyle(document.documentElement).getPropertyValue(k).trim();
    return v || fallback;
  };
  let T = {};
  function readTokens() {
    T = {
      text: css('--color-text-primary', '#1f1e1c'),
      body: css('--color-text-body', '#3a3935'),
      sec: css('--color-text-secondary', '#6c6a64'),
      faint: css('--color-text-muted', 'rgba(31,30,28,.45)'),
      grid: css('--color-grid', 'rgba(31,30,28,.08)'),
      border: css('--color-module-border', 'rgba(0,0,0,.08)'),
      card: css('--color-module-bg', '#ffffff'),
      primary: css('--color-primary', '#c96442'),
      up: css('--color-up', '#2f7d4f'),
      down: css('--color-down', '#c0392b'),
      bottom: css('--phase-bottom', '#3f6f9f'),
      bearish: css('--phase-bearish', '#9dc0dd'),
      bullish: css('--phase-bullish', '#e9b3a3'),
      top: css('--phase-top', '#c0392b')
    };
  }
  readTokens();
  D.refreshTokens = readTokens;

  D.phaseColor = (p) => ({ Bottom: T.bottom, Bearish: T.bearish, Bullish: T.bullish, Top: T.top }[p] || '#999');
  D.scoreColor = (v) => (v == null ? '#ccc' : v < 25 ? T.bottom : v < 50 ? T.bearish : v < 75 ? T.bullish : T.top);

  // -------------------------------------------------------- Highcharts set-up
  function baseOptions() {
    return {
      chart: {
        backgroundColor: 'transparent',
        style: { fontFamily: "'Geist', sans-serif", fontSize: '11px' },
        animation: false, spacing: [8, 6, 4, 4], zooming: { mouseWheel: false }
      },
      title: { text: null }, subtitle: { text: null }, credits: { enabled: false },
      accessibility: { enabled: false },
      navigator: { enabled: false }, rangeSelector: { enabled: false }, scrollbar: { enabled: false },
      legend: {
        align: 'left', verticalAlign: 'top', y: 2, symbolRadius: 2, symbolHeight: 8, symbolWidth: 10,
        useHTML: true,
        labelFormatter: function () {
          const d = this.data || [];
          let v = null;
          for (let i = d.length - 1; i >= 0; i--) {
            const p = d[i];
            if (!p) continue;
            const val = p.y != null ? p.y : p.close;
            if (val != null && p.visible !== false) { v = val; break; }
          }
          const unit = this.userOptions && this.userOptions.unit;
          const shown = v == null ? '' : (unit ? fmt.val(unit, v) : Number(v).toFixed(2));
          return esc(this.name) + (shown ? ' <span style="font-family:\'IBM Plex Mono\',monospace;color:' + T.text + '">' + shown + '</span>' : '');
        },
        itemStyle: { fontSize: '11px', fontWeight: '500', color: T.sec },
        itemHoverStyle: { color: T.text }, itemHiddenStyle: { color: T.faint },
        margin: 16, itemDistance: 14
      },
      xAxis: {
        type: 'datetime', lineColor: T.border, tickColor: T.border, tickLength: 4,
        labels: { style: { color: T.faint, fontSize: '10.5px', fontFamily: "'IBM Plex Mono', monospace" } },
        crosshair: { width: 1, color: T.grid, dashStyle: 'Solid', zIndex: 3 },
        gridLineWidth: 0, minorTickLength: 0
      },
      yAxis: {
        gridLineColor: T.grid, gridLineWidth: 1, lineWidth: 0,
        title: { text: null },
        labels: { style: { color: T.faint, fontSize: '10.5px', fontFamily: "'IBM Plex Mono', monospace" }, x: -2 },
        showLastLabel: true, opposite: false
      },
      tooltip: {
        useHTML: true, shared: true, backgroundColor: 'transparent', borderWidth: 0,
        shadow: false, padding: 0, outside: true,
        style: { fontFamily: "'Geist', sans-serif" },
        formatter: function () {
          const unit = this.points && this.points[0] ? this.points[0].series.userOptions.unit : null;
          const head = '<div style="font-family:\'IBM Plex Mono\',monospace;font-size:11px;color:' + T.sec + ';margin-bottom:4px">' +
            new Date(this.x).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' }) + '</div>';
          const rows = (this.points || []).map(p => {
            const v = p.series.userOptions.unit ? fmt.val(p.series.userOptions.unit, p.y) : (p.y == null ? '—' : p.y);
            return '<div style="display:flex;align-items:center;gap:6px;margin-top:2px">' +
              '<span style="width:8px;height:8px;border-radius:2px;background:' + p.color + '"></span>' +
              '<span style="font-size:11.5px;color:' + T.sec + '">' + p.series.name + '</span>' +
              '<span style="margin-left:auto;font-family:\'IBM Plex Mono\',monospace;font-size:11.5px;color:' + T.text + '">' + v + '</span></div>';
          }).join('');
          return '<div class="nt-tip" style="background:' + T.card + ';border:1px solid ' + T.border +
            ';border-radius:9px;padding:8px 10px;box-shadow:0 6px 22px rgba(40,38,34,.14);min-width:170px">' + head + rows + '</div>';
        }
      },
      plotOptions: {
        series: {
          animation: false, lineWidth: 1.8, marker: { enabled: false, radius: 2.5, states: { hover: { enabled: true } } },
          states: { hover: { lineWidthPlus: 0.6, halo: { size: 0 } }, inactive: { opacity: 0.35 } },
          turboThreshold: 0, enableMouseTracking: true
        },
        column: { borderWidth: 0, groupPadding: 0.05, pointPadding: 0.05, borderRadius: 1.5 },
        area: { fillOpacity: 0.12, lineWidth: 1.8, threshold: null }
      },
      exporting: { enabled: false }
    };
  }

  function seriesDef(def, spec) {
    const color = def.color || T.primary;
    const isColumn = def.type === 'column';
    const data = spec.type === 'histogram' && def.id === 'ret1y' ? S.ret1y_hist
      : def.id === 'riskreward' ? S.riskreward.map(r => [r[0], r[1]])
        : D.points(def.id, spec.__range);
    const o = {
      name: def.label || def.id, color, data, type: isColumn ? 'column' : (def.type || 'line'),
      unit: spec.unit, yAxis: def.yAxis || 0, dashStyle: def.dash || 'Solid',
      lineWidth: def.width || 1.8, zIndex: def.zIndex || 2,
      visible: def.hidden ? false : true
    };
    if (spec.type === 'ohlc' && def.id === 'gold_ohlc') {
      return Object.assign(o, { type: 'candlestick', data: S.gold_ohlc.map((x, i) => x ? [TS[i], x[0], x[1], x[2], x[3]] : null).filter(Boolean),
        color: T.down, upColor: T.up, lineColor: T.down, upLineColor: T.up, lineWidth: 1,
        pointPadding: 0, groupPadding: 0.02, borderWidth: 0, tooltip: { valueDecimals: 2 } });
    }
    if (def.area && spec.type !== 'histogram') o.fillOpacity = 0.12;
    if (isColumn && (def.id === 'macd_hist' || def.id === 'wret' || def.id === 'gc_spread')) {
      o.color = undefined;
      o.data = data.map(p => ({ x: p[0], y: p[1], color: p[1] >= 0 ? T.up : T.down }));
    }
    if (spec.negFill && def.area) {
      o.color = T.down; o.fillColor = { linearGradient: { x1: 0, y1: 0, x2: 0, y2: 1 }, stops: [[0, 'rgba(192,57,43,0.02)'], [1, 'rgba(192,57,43,0.22)']] };
    }
    return o;
  }

  function axisOptions(spec) {
    const y = { gridLineColor: T.grid, title: { text: null } };
    if (spec.log) y.type = 'logarithmic';
    if (spec.min != null) y.min = spec.min;
    if (spec.max != null) y.max = spec.max;
    y.labels = Object.assign({}, baseOptions().yAxis.labels, {
      formatter: function () {
        if (spec.log && (this.value === 1 || this.value === 0)) return '';
        if (spec.unit === 'usd') return fmt.usdAxis(this.value);
        if (spec.unit === 'pct') return fmt.pctAxis(this.value);
        return fmt.compact(this.value);
      }
    });
    // phase bands / thresholds
    if (spec.bands) {
      y.plotLines = spec.bands.map(v => ({ value: v, color: T.faint, width: 1, dashStyle: 'ShortDash', zIndex: 1,
        label: { text: String(v), style: { color: T.faint, fontSize: '10px' }, align: 'left', x: 4, y: -3 } }));
      if (spec.unit === 'score') {
        y.plotBands = [
          { from: 0, to: 25, color: 'rgba(63,111,159,0.06)' },
          { from: 25, to: 50, color: 'rgba(157,192,221,0.07)' },
          { from: 50, to: 75, color: 'rgba(233,179,163,0.08)' },
          { from: 75, to: 100, color: 'rgba(192,57,43,0.07)' }
        ];
      } else if (spec.unit === 'idx') {
        // oscillator zones: overbought above 70, oversold below 30
        y.plotBands = [
          { from: 0, to: 30, color: 'rgba(63,111,159,0.07)' },
          { from: 70, to: 100, color: 'rgba(192,57,43,0.07)' }
        ];
      }
    }
    if (spec.negBands) y.plotLines = (y.plotLines || []).concat(spec.negBands.map(v => ({ value: v, color: T.faint, width: 1, dashStyle: 'ShortDash', zIndex: 1 })));
    return y;
  }

  function milestonePlotlines(spec) {
    if (!spec.milestone) return [];
    return CAT.milestones.map(m => {
      const x = Date.parse(m.d + 'T00:00:00Z');
      return {
        value: x, color: T.faint, width: 1, dashStyle: 'Dash', zIndex: 2,
        label: { text: m.label, rotation: 270, align: 'right', y: 52, x: -4,
          style: { color: T.sec, fontSize: '10.5px', fontFamily: "'Geist', sans-serif", textOutline: 'none' } }
      };
    });
  }

  function regimeBands(spec) {
    if (!spec.regimes) return [];
    return spec.regimes.map(r => ({
      from: Date.parse(r.from + 'T00:00:00Z') || Date.parse(r.from), to: Date.parse(r.to + 'T00:00:00Z'),
      color: r.color, zIndex: 0,
      label: { text: r.label, align: 'center', verticalAlign: 'top', y: 14, style: { color: T.sec, fontSize: '10px' } }
    }));
  }

  function buildOptions(spec, host, opts) {
    opts = opts || {};
    const o = baseOptions();
    const range = opts.range != null ? opts.range : spec.__range;
    spec.__range = range;
    const showMilestones = opts.milestones != null ? opts.milestones : !!spec.milestone;
    o.chart.height = opts.height || (opts.compact ? 190 : 340);
    o.xAxis = Object.assign(o.xAxis, {
      plotLines: showMilestones ? milestonePlotlines(Object.assign({}, spec, { milestone: true }), opts.extraSeries) : [],
      plotBands: regimeBands(spec)
    });
    const nonDateAxis = ['seasonal', 'heatmap', 'table', 'scatter'].includes(spec.type);
    if (!nonDateAxis && (opts.from || opts.to)) {
      if (opts.from) o.xAxis.min = Date.parse(opts.from + 'T00:00:00Z');
      if (opts.to) o.xAxis.max = Date.parse(opts.to + 'T00:00:00Z');
    } else if (!nonDateAxis && range && String(range).toUpperCase() !== 'ALL' && rangeStart(range) > 0) {
      o.xAxis.min = TS[rangeStart(range)];
    }
    o.yAxis = [axisOptions(spec)];
    if (spec.y2 || spec.series.some(s => s.yAxis === 1) || (opts.extraSeries || []).some(s => s.yAxis === 1)) {
      const s2 = Object.assign({}, axisOptions(Object.assign({}, spec, { bands: null, min: null, max: null })));
      s2.opposite = true; s2.gridLineWidth = 0;
      s2.labels = Object.assign({}, s2.labels, {
        formatter: function () {
          if (spec.unit === 'usd') return fmt.usdAxis(this.value);
          if (spec.unit === 'pct') return fmt.pctAxis(this.value);
          return fmt.num(this.value, 1);
        }
      });
      if (spec.invert2) s2.reversed = true;
      o.yAxis.push(s2);
    }
    if (spec.type === 'seasonal' || spec.type === 'heatmap' || spec.type === 'table' || spec.type === 'scatter') return o;

    o.series = spec.series.map(d => seriesDef(d, spec));
    // user-added comparison series
    (opts.extraSeries || []).forEach(ex => {
      o.series.push(Object.assign(seriesDef({ id: ex.id, label: ex.label, color: ex.color, yAxis: ex.yAxis, dash: ex.dash }, spec), {}));
    });
    // optional moving-average overlay
    if (opts.showMA) {
      o.series.push(seriesDef({ id: 'ma50', label: '50D MA', color: T.blue, width: 1.2, dash: 'ShortDash', zIndex: 1 }, spec));
      o.series.push(seriesDef({ id: 'ma200', label: '200D MA', color: T.violet || T.blue, width: 1.2, dash: 'ShortDash', zIndex: 1 }, spec));
    }
    // optional gradient fill
    if (opts.gradient) {
      o.series.forEach(s => {
        if (s.type === 'line' && s.fillOpacity != null || s.type === 'line') {
          s.fillColor = { linearGradient: { x1: 0, y1: 0, x2: 0, y2: 1 }, stops: [[0, 'rgba(201,100,66,0.28)'], [1, 'rgba(201,100,66,0.02)']] };
          s.fillOpacity = 1;
        }
      });
    }
    if (spec.type === 'macd') o.series.forEach(s => { if (s.type === 'column') { s.zIndex = 1; s.pointPadding = 0; } });
    if (opts.seriesFilter) o.series = o.series.filter(opts.seriesFilter);
    return o;
  }

  // ---------------------------------------------------------------- sparkline
  D.sparkline = function (values, opts) {
    opts = opts || {};
    const w = opts.width || 120, h = opts.height || 28, pad = 2;
    const vals = values.filter(v => v != null && isFinite(v));
    if (vals.length < 2) return '<span class="muted tiny">—</span>';
    const min = Math.min(...vals), max = Math.max(...vals), rng = max - min || 1;
    const x = i => pad + (i / (vals.length - 1)) * (w - pad * 2);
    const y = v => h - pad - ((v - min) / rng) * (h - pad * 2);
    const pts = vals.map((v, i) => (i ? 'L' : 'M') + x(i).toFixed(1) + ' ' + y(v).toFixed(1)).join(' ');
    const last = vals[vals.length - 1];
    const up = opts.upIsGood === false ? last <= vals[0] : last >= vals[0];
    const col = opts.color || (opts.neutral ? T.sec : (up ? T.up : T.down));
    const fill = opts.fill === false ? '' : '<path d="' + pts + ' L' + x(vals.length - 1).toFixed(1) + ' ' + h + ' L' + pad + ' ' + h + ' Z" fill="' + col + '" opacity="0.10"/>';
    const area = opts.area;
    return '<svg class="spark" viewBox="0 0 ' + w + ' ' + h + '" preserveAspectRatio="none" style="height:' + h + 'px">' +
      fill + (area ? '' : '') + '<path d="' + pts + '" fill="none" stroke="' + col + '" stroke-width="1.4" stroke-linejoin="round" stroke-linecap="round"/>' +
      (opts.dot === false ? '' : '<circle cx="' + x(vals.length - 1).toFixed(1) + '" cy="' + y(last).toFixed(1) + '" r="2" fill="' + col + '"/>') + '</svg>';
  };

  // ------------------------------------------------------------------ export
  D.downloadCSV = function (spec, range) {
    const rows = [['date'].concat(spec.series.map(s => s.label || s.id))];
    for (let i = 0; i < N; i++) {
      const r = [RAW.series.dates[i]];
      spec.series.forEach(sd => {
        if (sd.id === 'gold_ohlc') { const x = S.gold_ohlc[i]; r.push(x ? x.join(',') : ''); }
        else { const a = D.resolve(sd.id); r.push(a && a[i] != null ? a[i] : ''); }
      });
      rows.push(r);
    }
    const csv = rows.map(r => r.join(',')).join('\n');
    download('noman_trading_' + spec.slug + '.csv', csv, 'text/csv');
  };
  D.exportPNG = function (chart, spec) {
    if (chart && chart.exportChartLocal) {
      chart.exportChartLocal({ type: 'image/png', filename: 'noman_trading_' + spec.slug }, { title: { text: spec.title }, subtitle: { text: 'Noman_trading · ' + RAW.stats.built } });
    }
  };
  function download(name, content, mime) {
    const blob = new Blob([content], { type: mime });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = name; document.body.appendChild(a); a.click();
    setTimeout(() => { URL.revokeObjectURL(url); a.remove(); }, 400);
  }
  D.download = download;

  // ------------------------------------------------------------ chart factory
  D.renderChart = function (host, spec, opts) {
    opts = opts || {};
    if (spec.type === 'seasonal') return D.renderSeasonal(host, spec, opts);
    if (spec.type === 'heatmap') return D.renderHeatmap(host, spec, opts);
    if (spec.type === 'table') return D.renderDrawdownTable(host, spec, opts);
    if (spec.type === 'histogram') return D.renderHistogram(host, spec, opts);
    if (spec.type === 'scatter') return D.renderScatter(host, spec, opts);
    if (spec.data === 'yearly' || spec.data === 'seasonWin') return D.renderSeasonBar(host, spec, opts);
    const o = buildOptions(spec, host, opts);
    if (o.series.length === 0) { host.innerHTML = '<div class="empty">No data</div>'; return null; }
    return Highcharts.chart(host, o);
  };

  // simple categorical bar charts built from the seasonality tables
  D.renderSeasonBar = function (host, spec, opts) {
    const o = baseOptions();
    const isYearly = spec.data === 'yearly';
    const cats = isYearly ? D.season.years.slice(-30) : CAT.months;
    const vals = isYearly ? D.season.yearly.slice(-30) : D.season.win;
    o.chart.height = opts.height || 300;
    o.legend = { enabled: false };
    o.xAxis = { categories: cats, lineColor: T.border, tickWidth: 0,
      labels: { style: { fontSize: '10.5px', color: T.faint, fontFamily: "'IBM Plex Mono', monospace" }, step: isYearly ? 2 : 1 } };
    o.yAxis = [{ gridLineColor: T.grid, title: { text: null },
      labels: { style: { fontSize: '10.5px', color: T.faint }, formatter: function () { return this.value + '%'; } },
      plotLines: [{ value: isYearly ? 0 : 50, color: T.faint, width: 1, dashStyle: isYearly ? 'Solid' : 'ShortDash',
        label: isYearly ? undefined : { text: '50% win rate', style: { color: T.faint, fontSize: '9.5px' }, align: 'right', x: -4, y: -4 } }] }];
    o.tooltip = Object.assign({}, o.tooltip, {
      shared: false, formatter: function () {
        return '<div style="background:' + T.card + ';border:1px solid ' + T.border + ';border-radius:9px;padding:8px 10px;box-shadow:0 6px 22px rgba(40,38,34,.14)">' +
          '<div style="font-size:11.5px;font-weight:600">' + this.key + '</div><div class="mono" style="font-size:11.5px">' + fmt.pct(this.y) + '</div></div>';
      }
    });
    const data = vals.map((v, i) => ({ y: v, color: v == null ? T.faint : (isYearly ? (v >= 0 ? T.up : T.down) : (v >= 50 ? 'rgba(59,143,90,0.8)' : 'rgba(192,57,43,0.75)')) }));
    o.series = [{ name: isYearly ? 'Yearly return' : 'Win rate', type: 'column', data, unit: 'pct' }];
    return Highcharts.chart(host, o);
  };

  D.renderHistogram = function (host, spec, opts) {
    const o = baseOptions();
    o.chart.height = opts.height || 300; o.chart.type = 'column';
    o.xAxis = { title: { text: null }, categories: S.ret1y_hist.map(b => (b.x >= 0 ? '+' : '') + b.x.toFixed(1) + '%'),
      labels: { style: { fontSize: '10px', color: T.faint, fontFamily: "'IBM Plex Mono', monospace" }, step: 2 }, lineColor: T.border };
    o.yAxis = [{ gridLineColor: T.grid, title: { text: null }, labels: { style: { fontSize: '10.5px', color: T.faint } } }];
    o.legend = { enabled: false };
    o.tooltip = Object.assign({}, o.tooltip, { shared: false, formatter: function () { const r = S.ret1y; const mean = r.reduce((a, b) => a + b, 0) / r.length; const sd = Math.sqrt(r.reduce((a, b) => a + (b - mean) ** 2, 0) / r.length); const z = (this.x + 0.25 - mean) / sd; return '<div style="background:' + T.card + ';border:1px solid ' + T.border + ';border-radius:9px;padding:8px 10px;box-shadow:0 6px 22px rgba(40,38,34,.14)"><b>' + this.key + '</b><div class="mono" style="font-size:11.5px">' + this.y + ' sessions · z ' + z.toFixed(2) + '</div></div>'; } });
    o.series = [{ name: 'Sessions', data: S.ret1y_hist.map(b => ({ y: b.y, color: b.x < -1 ? T.down : b.x > 1 ? T.up : T.sec })), unit: 'pct' }];
    return Highcharts.chart(host, o);
  };

  D.renderScatter = function (host, spec, opts) {
    const o = baseOptions();
    const pts = S.riskreward;
    o.chart.height = opts.height || 380; o.chart.type = 'scatter'; o.chart.zooming = { type: 'xy' };
    o.xAxis = { title: { text: 'realized volatility 30D (ann. %)', style: { color: T.sec, fontSize: '10.5px' } },
      gridLineColor: T.grid, labels: { style: { color: T.faint, fontSize: '10.5px' } }, plotLines: [{ value: 20, color: T.faint, dashStyle: 'ShortDash', width: 1 }] };
    o.yAxis = [{ title: { text: 'rolling 12M return %', style: { color: T.sec, fontSize: '10.5px' } }, gridLineColor: T.grid,
      labels: { style: { color: T.faint, fontSize: '10.5px' } }, plotLines: [{ value: 0, color: T.faint, width: 1 }] }];
    o.legend = { enabled: false };
    o.tooltip = Object.assign({}, o.tooltip, {
      shared: false, formatter: function () {
        return '<div style="background:' + T.card + ';border:1px solid ' + T.border + ';border-radius:9px;padding:8px 10px;box-shadow:0 6px 22px rgba(40,38,34,.14)">' +
          '<div style="font-family:\'IBM Plex Mono\',monospace;font-size:11px;color:' + T.sec + '">' + new Date(this.point.options[2]).toLocaleDateString('en-US', { month: 'short', year: 'numeric', timeZone: 'UTC' }) + '</div>' +
          '<div style="font-size:11.5px">vol ' + this.x.toFixed(1) + '% · return ' + this.y.toFixed(1) + '%</div></div>';
      }
    });
    o.series = [{
      name: 'Weeks', data: pts, color: 'rgba(201,100,66,0.65)', marker: { radius: 2.4, symbol: 'circle' },
      colorByPoint: false, unit: 'pct'
    }];
    return Highcharts.chart(host, o);
  };

  D.renderSeasonal = function (host, spec, opts) {
    const o = baseOptions();
    const avg = D.season.avg, med = D.season.med, nowM = new Date().getMonth();
    o.chart.height = opts.height || 300;
    o.xAxis = { categories: CAT.months, lineColor: T.border, labels: { style: { color: T.faint, fontSize: '10.5px', fontFamily: "'IBM Plex Mono', monospace" } } };
    o.yAxis = [{ gridLineColor: T.grid, title: { text: null }, labels: { style: { color: T.faint, fontSize: '10.5px' }, formatter: function () { return this.value + '%'; } }, plotLines: [{ value: 0, color: T.faint, width: 1 }] }];
    o.legend = { enabled: true };
    o.tooltip = Object.assign({}, o.tooltip, {
      shared: true, formatter: function () {
        const i = this.points[0].point.index;
        return '<div style="background:' + T.card + ';border:1px solid ' + T.border + ';border-radius:9px;padding:8px 10px;box-shadow:0 6px 22px rgba(40,38,34,.14)">' +
          '<div style="font-size:11.5px;font-weight:600">' + CAT.months[i] + '</div>' +
          '<div class="mono" style="font-size:11.5px">avg ' + fmt.pct(avg[i]) + ' · median ' + fmt.pct(med[i]) + '</div>' +
          '<div style="font-size:11px;color:' + T.sec + '">win rate ' + (D.season.win[i] != null ? D.season.win[i] + '%' : '—') + '</div></div>';
      }
    });
    o.series = [
      { name: 'Average return', type: 'column', data: avg.map((v, i) => ({ y: v, color: i === nowM ? T.primary : (v >= 0 ? 'rgba(59,143,90,0.75)' : 'rgba(192,57,43,0.75)') })), unit: 'pct' },
      { name: 'Median return', type: 'spline', data: med, color: T.ink || '#1f1e1c', lineWidth: 1.4, marker: { enabled: false }, unit: 'pct', dashStyle: 'ShortDash' }
    ];
    const ch = Highcharts.chart(host, o);
    return ch;
  };

  D.renderHeatmap = function (host, spec, opts) {
    const m = D.season_matrix;
    const years = Object.keys(m).sort();
    const data = [];
    let lo = 0, hi = 0;
    years.forEach((y, yi) => { for (let mm = 1; mm <= 12; mm++) { const v = m[y][mm]; if (v == null) continue; lo = Math.min(lo, v); hi = Math.max(hi, v); } });
    const span = Math.max(Math.abs(lo), Math.abs(hi)) || 1;
    years.forEach((y, yi) => {
      for (let mm = 1; mm <= 12; mm++) {
        const v = m[y][mm];
        if (v == null) continue;
        data.push({ x: mm - 1, y: yi, value: v, color: v >= 0 ? `rgba(59,143,90,${(0.08 + 0.82 * Math.min(v / span, 1)).toFixed(2)})` : `rgba(192,57,43,${(0.08 + 0.82 * Math.min(-v / span, 1)).toFixed(2)})` });
      }
    });
    const o = baseOptions();
    o.chart.height = opts.height || 420; o.chart.marginLeft = 46;
    o.xAxis = { categories: CAT.months, opposite: false, lineColor: T.border, tickWidth: 0, labels: { style: { color: T.sec, fontSize: '10.5px', fontFamily: "'IBM Plex Mono', monospace" } } };
    o.yAxis = [{ categories: years, reversed: true, title: { text: null }, gridLineWidth: 0, lineWidth: 0, labels: { style: { color: T.sec, fontSize: '10.5px', fontFamily: "'IBM Plex Mono', monospace" } } }];
    o.legend = { enabled: false };
    o.tooltip = Object.assign({}, o.tooltip, {
      shared: false, formatter: function () {
        return '<div style="background:' + T.card + ';border:1px solid ' + T.border + ';border-radius:9px;padding:8px 10px;box-shadow:0 6px 22px rgba(40,38,34,.14)">' +
          '<div style="font-size:11.5px;font-weight:600">' + CAT.months[this.point.x] + ' ' + years[this.point.y] + '</div>' +
          '<div class="mono" style="font-size:11.5px">' + fmt.pct(this.point.value) + '</div></div>';
      }
    });
    o.colorAxis = { min: -span, max: span, stops: [
      [0, '#c0392b'], [0.35, 'rgba(192,57,43,0.35)'], [0.5, 'rgba(200,197,190,0.25)'],
      [0.65, 'rgba(59,143,90,0.35)'], [1, '#2f7d4f']], visible: false };
    o.series = [{ name: 'Monthly return', type: 'heatmap', data, borderWidth: 2, borderColor: T.card, unit: 'pct', dataLabels: { enabled: false } }];
    return Highcharts.chart(host, o);
  };

  D.renderDrawdownTable = function (host, spec) {
    const rows = S.drawdowns;
    host.innerHTML = '<div class="data-table-wrap"><table class="table"><thead><tr>' +
      '<th>#</th><th>Peak date</th><th>Trough date</th><th>Depth</th><th>Duration</th><th>Recovery</th>' +
      '</tr></thead><tbody>' + rows.map((d, i) => '<tr>' +
        '<td class="mono muted">' + (i + 1) + '</td><td>' + fmt.niceDate(d.start) + '</td><td>' + fmt.niceDate(d.trough) + '</td>' +
        '<td class="mono down">' + d.depth.toFixed(1) + '%</td><td class="mono">' + d.days + ' days</td>' +
        '<td class="mono">' + (d.recovered ? fmt.niceDate(d.recovered) + ' <span class="muted">(' + d.recDays + 'd)</span>' : '<span class="muted">ongoing</span>') + '</td></tr>').join('') +
      '</tbody></table></div>';
    return null;
  };

  // ------------------------------------------------------- mini chart helper
  D.mini = function (host, id, opts) {
    opts = opts || {};
    const spec = {
      slug: 'mini-' + id, title: '', unit: opts.unit || 'usd', type: opts.type || 'area',
      log: false, series: [{ id: id, label: '', color: opts.color || T.primary, area: opts.type !== 'line' }],
      __range: opts.range || 1
    };
    const o = baseOptions();
    o.chart.height = opts.height || 120; o.chart.spacing = [2, 2, 2, 2]; o.chart.margin = [4, 2, 14, 2];
    o.legend = { enabled: false };
    o.xAxis = Object.assign(o.xAxis, { labels: { enabled: false }, tickLength: 0, crosshair: { width: 0 } });
    o.yAxis = [Object.assign(axisOptions(spec), { labels: { enabled: false }, gridLineWidth: 0, minPadding: 0.08, maxPadding: 0.08 })];
    o.tooltip = { enabled: false };
    o.series = [seriesDef(spec.series[0], spec)];
    return Highcharts.chart(host, o);
  };

  D.baseOptions = baseOptions;
  D.readTokens = readTokens;
  window.NT_CHARTS_READY = true;
})();
