/* ==========================================================================
   Noman_trading — shell, router, live gold feed, alert engine
   ========================================================================== */
(function () {
  const D = window.NT, CAT = window.NT_CATALOGUE, F = D.fmt;

  // ------------------------------------------------------------------ utils
  const $ = (sel, root) => (root || document).querySelector(sel);
  const $$ = (sel, root) => Array.from((root || document).querySelectorAll(sel));
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const store = {
    get(k, dflt) { try { const v = localStorage.getItem('nt.' + k); return v == null ? dflt : JSON.parse(v); } catch (e) { return dflt; } },
    set(k, v) { try { localStorage.setItem('nt.' + k, JSON.stringify(v)); } catch (e) { } }
  };
  const ICONS = {
    chart: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M3 3v18h18"/><path d="M7 15l4-5 3 3 5-7"/></svg>',
    search: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><circle cx="11" cy="11" r="7"/><path d="M20 20l-3.5-3.5"/></svg>',
    star: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"><path d="M12 3l2.6 5.6 6 .8-4.4 4.2 1.1 6L12 16.8 6.7 19.6l1.1-6L3.4 9.4l6-.8z"/></svg>',
    dots: '<svg viewBox="0 0 24 24" fill="currentColor"><circle cx="5" cy="12" r="1.6"/><circle cx="12" cy="12" r="1.6"/><circle cx="19" cy="12" r="1.6"/></svg>',
    bell: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"><path d="M6 9a6 6 0 1112 0c0 4 1.5 5.5 2 6H4c.5-.5 2-2 2-6z"/><path d="M10 19a2 2 0 004 0"/></svg>',
    download: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"><path d="M12 4v11"/><path d="M7.5 11.5L12 16l4.5-4.5"/><path d="M5 19h14"/></svg>',
    image: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round"><rect x="3" y="4" width="18" height="16" rx="2.5"/><circle cx="9" cy="10" r="1.6"/><path d="M4 18l5-5 4 3.5 3-2.5 5 4"/></svg>',
    link: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"><path d="M10 13a4 4 0 005.7 0l2.6-2.6a4 4 0 10-5.7-5.7L11.4 6"/><path d="M14 11a4 4 0 00-5.7 0l-2.6 2.6a4 4 0 105.7 5.7L12.6 18"/></svg>',
    external: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"><path d="M14 5h5v5"/><path d="M19 5l-7 7"/><path d="M18 14v4a2 2 0 01-2 2H6a2 2 0 01-2-2V8a2 2 0 012-2h4"/></svg>',
    trash: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"><path d="M4 7h16"/><path d="M9 7V5h6v2"/><path d="M6 7l1 13h10l1-13"/></svg>',
    plus: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="M12 5v14"/><path d="M5 12h14"/></svg>',
    sun: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"><circle cx="12" cy="12" r="4.2"/><path d="M12 2v2.4M12 19.6V22M2 12h2.4M19.6 12H22M5 5l1.7 1.7M17.3 17.3L19 19M19 5l-1.7 1.7M6.7 17.3L5 19"/></svg>',
    moon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round"><path d="M20 14.5A8.5 8.5 0 019.5 4a8.5 8.5 0 1010.5 10.5z"/></svg>',
    info: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"><circle cx="12" cy="12" r="9"/><path d="M12 11v5"/><circle cx="12" cy="7.8" r=".9" fill="currentColor"/></svg>',
    alert: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"><path d="M12 4l9 16H3z"/><path d="M12 10v4"/><circle cx="12" cy="17" r=".9" fill="currentColor"/></svg>',
    check: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M5 13l4.5 4.5L19 7"/></svg>',
    clock: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"><circle cx="12" cy="12" r="9"/><path d="M12 7.5V12l3 2"/></svg>',
    chevron: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="M9 6l6 6-6 6"/></svg>'
  };
  window.NT_ICONS = ICONS;
  window.NT_UTIL = { $, $$, esc, store, ICONS };

  // ------------------------------------------------------------------ toast
  function toast(title, body, kind) {
    const host = $('#toasts');
    const el = document.createElement('div');
    el.className = 'toast' + (kind === 'hit' ? ' hit' : '');
    el.innerHTML = '<span class="t-ico">' + (kind === 'hit' ? ICONS.bell : ICONS.info) + '</span><div><div class="t-title">' + esc(title) + '</div>' +
      (body ? '<div class="t-body">' + body + '</div>' : '') + '</div>';
    host.appendChild(el);
    setTimeout(() => { el.style.transition = 'opacity .25s, transform .25s'; el.style.opacity = '0'; el.style.transform = 'translateY(6px)'; setTimeout(() => el.remove(), 260); }, kind === 'hit' ? 9000 : 4200);
  }
  function flash(msg) {
    const el = document.createElement('div');
    el.className = 'copy-flash'; el.textContent = msg;
    document.body.appendChild(el);
    setTimeout(() => el.remove(), 1500);
  }
  function beep() {
    try {
      const Ctx = window.AudioContext || window.webkitAudioContext;
      if (!Ctx) return;
      const ctx = new Ctx();
      const o = ctx.createOscillator(), g = ctx.createGain();
      o.type = 'sine'; o.frequency.value = 880;
      g.gain.setValueAtTime(0.0001, ctx.currentTime);
      g.gain.exponentialRampToValueAtTime(0.16, ctx.currentTime + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.5);
      o.connect(g); g.connect(ctx.destination);
      o.start(); o.stop(ctx.currentTime + 0.52);
      setTimeout(() => ctx.close(), 900);
    } catch (e) { }
  }
  window.NT_TOAST = toast;

  // ------------------------------------------------------------------- menu
  let openMenu = null;
  function closeMenu() { if (openMenu) { openMenu.remove(); openMenu = null; document.removeEventListener('mousedown', onDocDown, true); } }
  function onDocDown(e) { if (openMenu && !openMenu.contains(e.target)) closeMenu(); }
  function showMenu(anchor, items) {
    closeMenu();
    const r = anchor.getBoundingClientRect();
    const m = document.createElement('div');
    m.className = 'menu';
    items.forEach(it => {
      if (it.sep) { m.appendChild(document.createElement('hr')); return; }
      const b = document.createElement('button');
      b.innerHTML = (it.icon ? it.icon : '') + '<span>' + esc(it.label) + '</span>';
      if (it.danger) b.className = 'danger';
      b.addEventListener('click', (ev) => { ev.stopPropagation(); closeMenu(); it.onClick(); });
      m.appendChild(b);
    });
    document.body.appendChild(m);
    const w = m.offsetWidth, h = m.offsetHeight;
    m.style.left = Math.min(r.right - w, window.innerWidth - w - 10) + 'px';
    m.style.top = (r.bottom + scrollY + 6 + h > window.innerHeight ? r.top + scrollY - h - 6 : r.bottom + scrollY + 6) + 'px';
    m.style.position = 'absolute';
    openMenu = m;
    setTimeout(() => document.addEventListener('mousedown', onDocDown, true), 0);
  }
  window.NT_MENU = { showMenu, closeMenu };

  function modal(html, opts) {
    opts = opts || {};
    const back = document.createElement('div');
    back.className = 'backdrop';
    back.innerHTML = '<div class="modal">' + html + '</div>';
    document.body.appendChild(back);
    const close = () => { back.remove(); document.removeEventListener('keydown', onKey); };
    function onKey(e) { if (e.key === 'Escape') close(); }
    back.addEventListener('mousedown', (e) => { if (e.target === back) close(); });
    document.addEventListener('keydown', onKey);
    $$('[data-close]', back).forEach(b => b.addEventListener('click', close));
    if (opts.onMount) opts.onMount(back, close);
    return { el: back, close };
  }
  window.NT_MODAL = modal;

  let registry = [];         // charts rendered on the current page

  // -------------------------------------------------------------- live feed
  // the feed itself lives in js/live.js (Binance tick stream + REST benchmarks)
  const live = window.NT_LIVE;

  // keep a "live" price line on every price chart in the current page
  let lastLinePaint = 0;
  function paintLiveLines(force) {
    const now = Date.now();
    if (!force && now - lastLinePaint < 1200) return;
    lastLinePaint = now;
    const p = live.spot;
    if (!p) return;
    registry.forEach(r => {
      const spec = r.spec, ch = r.chart;
      if (!ch || !ch.yAxis || !ch.yAxis[0] || spec.unit !== 'usd') return;
      try {
        const ax = ch.yAxis[0];
        if (ax.removePlotLine) ax.removePlotLine('live');
        ax.addPlotLine({
          id: 'live', value: p, color: cssVar('--color-primary', '#c96442'), width: 1, dashStyle: 'ShortDash', zIndex: 5,
          label: { text: 'live ' + F.usd(p), align: 'right', x: -6, y: -3,
            style: { color: cssVar('--color-primary', '#c96442'), fontSize: '9.5px', fontFamily: "'IBM Plex Mono', monospace", textOutline: 'none' } }
        });
      } catch (e) { }
    });
  }
  live.on(() => paintLiveLines());
  setInterval(() => paintLiveLines(true), 15000);

  // header quote pill
  live.on((l) => {
    const el = document.getElementById('liveChipText');
    if (!el || !l.spot) return;
    const up = (l.changePct || 0) >= 0;
    el.innerHTML = F.usd(l.spot) + ' <span class="' + (up ? 'up' : 'down') + '">' + (up ? '▲' : '▼') + ' ' + Math.abs(l.changePct || 0).toFixed(2) + '%</span>';
    const dot = document.getElementById('liveDot');
    if (dot) dot.className = 'live-dot' + (l.connected ? ' pulse' : '');
    const chip = document.getElementById('liveChip');
    if (chip) chip.title = (l.source || '') + (l.updated ? ' · ' + l.updated.toLocaleTimeString() : '') + (l.connected ? ' · streaming' : ' · polling every 45s');
  });

  // ------------------------------------------------------------ alert engine
  const ALERT_TYPES = {
    price_above: { label: 'Gold price above', unit: 'usd', hint: 'Fires when the live gold price rises above the value.' },
    price_below: { label: 'Gold price below', unit: 'usd', hint: 'Fires when the live gold price falls below the value.' },
    chg_above: { label: '24h change above (%)', unit: 'pct', hint: 'Fires when the rolling 24h change is above the value.' },
    chg_below: { label: '24h change below (%)', unit: 'pct', hint: 'Fires when the rolling 24h change is below the value.' },
    rsi_above: { label: 'Daily RSI above', unit: 'idx', hint: 'Fires when the daily RSI closes above the level.' },
    rsi_below: { label: 'Daily RSI below', unit: 'idx', hint: 'Fires when the daily RSI closes below the level.' },
    cycle_above: { label: 'Cycle Index above', unit: 'idx', hint: 'Fires when the composite Cycle Index rises above the score.' },
    cycle_below: { label: 'Cycle Index below', unit: 'idx', hint: 'Fires when the composite Cycle Index falls below the score.' },
    dd_below: { label: 'Drawdown worse than (%)', unit: 'pct', hint: 'Fires when the drawdown from the all-time high is deeper than the value (use a negative number).' },
    phase_change: { label: 'Cycle phase change', unit: 'phase', hint: 'Fires when the Cycle Index moves into a new phase (Bottom / Bearish / Bullish / Top).' }
  };
  const alerts = {
    list: store.get('alerts', []),
    log: store.get('log', []),
    save() { store.set('alerts', this.list); store.set('log', this.log.slice(0, 60)); },
    add(a) { a.id = 'a' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6); a.created = new Date().toISOString(); a.active = true; a.triggered = 0; this.list.push(a); this.save(); return a; },
    remove(id) { this.list = this.list.filter(a => a.id !== id); this.save(); },
    toggle(id) { const a = this.list.find(x => x.id === id); if (a) { a.active = !a.active; this.save(); } },
    update(id, patch) { const a = this.list.find(x => x.id === id); if (a) { Object.assign(a, patch); this.save(); } },
    currentOf(type) {
      switch (type) {
        case 'price_above': case 'price_below': return live.spot;
        case 'chg_above': case 'chg_below': return live.changePct;
        case 'rsi_above': case 'rsi_below': return D.series.rsi14[D.series.rsi14.length - 1];
        case 'cycle_above': case 'cycle_below': return D.signalNow('cycle');
        case 'dd_below': return D.series.drawdown[D.series.drawdown.length - 1];
        case 'phase_change': return D.phaseOf(D.signalNow('cycle'));
        default: return null;
      }
    },
    fired(a, cur) {
      switch (a.type) {
        case 'price_above': return cur != null && cur > a.value;
        case 'price_below': return cur != null && cur < a.value;
        case 'chg_above': return cur != null && cur > a.value;
        case 'chg_below': return cur != null && cur < a.value;
        case 'rsi_above': return cur != null && cur > a.value;
        case 'rsi_below': return cur != null && cur < a.value;
        case 'cycle_above': return cur != null && cur > a.value;
        case 'cycle_below': return cur != null && cur < a.value;
        case 'dd_below': return cur != null && cur < a.value;
        case 'phase_change': return cur != null && a.lastPhase && cur !== a.lastPhase;
        default: return false;
      }
    },
    evaluate(reason) {
      const now = Date.now();
      this.list.filter(a => a.active).forEach(a => {
        const cur = this.currentOf(a.type);
        if (a.type === 'phase_change' && !a.lastPhase) { a.lastPhase = cur; this.save(); return; }
        const hit = this.fired(a, cur);
        const cooldown = 30 * 60 * 1000;
        if (hit && (!a.lastTriggered || now - Date.parse(a.lastTriggered) > cooldown)) {
          a.lastTriggered = new Date().toISOString();
          a.triggered = (a.triggered || 0) + 1;
          if (a.type === 'phase_change') a.lastPhase = cur;
          this.fire(a, cur, reason);
        } else if (hit && a.type === 'phase_change') {
          a.lastPhase = cur;
        }
        if (!hit && a.type !== 'phase_change') { /* stay armed */ }
      });
      this.save();
    },
    fmtValue(type, v) {
      if (v == null) return '—';
      if (type === 'price_above' || type === 'price_below') return F.usd(v);
      if (type === 'phase_change') return String(v);
      if (type === 'rsi_above' || type === 'rsi_below' || type === 'cycle_above' || type === 'cycle_below') return Number(v).toFixed(1);
      return F.pct(v);
    },
    fire(a, cur, reason) {
      const title = (ALERT_TYPES[a.type] || {}).label || 'Alert';
      const msg = title + (a.type === 'phase_change' ? ' → <b>' + esc(cur) + '</b>' : ' — now <b>' + this.fmtValue(a.type, cur) + '</b>') + (a.note ? ' · ' + esc(a.note) : '');
      toast('Alert triggered', msg, 'hit');
      beep();
      if (window.Notification && Notification.permission === 'granted') {
        try { new Notification('Noman_trading · ' + title, { body: (a.type === 'phase_change' ? 'now ' + cur : this.fmtValue(a.type, cur)) + (a.note ? ' · ' + a.note : '') , tag: a.id }); } catch (e) { }
      }
      this.log.unshift({ ts: new Date().toISOString(), title, msg: a.type === 'phase_change' ? String(cur) : this.fmtValue(a.type, cur), note: a.note || '', reason: reason || 'live tick' });
      this.save();
      window.dispatchEvent(new CustomEvent('nt-alert', { detail: a }));
    }
  };
  window.NT_ALERTS = { alerts, ALERT_TYPES };
  live.on(() => alerts.evaluate('live tick'));
  live.on(() => paintLiveLines());

  // ------------------------------------------------------- live feed popover
  function livePopover(anchorEl) {
    const l = live;
    const ago = l.secondsAgo();
    const rows = [
      ['Stream', l.connected ? 'connected · Binance PAXG/USDT trade stream' : 'not connected — polling REST every 45s'],
      ['Last print', l.updated ? l.updated.toLocaleTimeString() + (ago != null ? ' (' + ago + 's ago)' : '') : '—'],
      ['Ticks this session', String(l.tickCount)],
      ['Primary price', F.usd(l.spot)],
      ['XAU/USD benchmark', l.benchmark ? F.usd(l.benchmark) + (l.benchmarkAt ? ' · ' + l.benchmarkAt.toLocaleTimeString() : '') : 'not reachable'],
      ['24h range', (l.low ? F.usd(l.low) + ' – ' + F.usd(l.high) : '—')],
      ['Previous close', l.prevClose ? F.usd(l.prevClose) : '—'],
      ['Change', F.usd(l.changeAbs) + ' · ' + F.pct(l.changePct)]
    ];
    const html = '<h3>Live gold feed</h3><p class="muted" style="font-size:1.25rem">The price is the PAXG/USDT trade stream on Binance — a 1:1 gold-backed token, the only 24/7 gold market with a real tick feed. gold-api.com supplies the XAU/USD spot benchmark for comparison; the 24h range and change come from the Binance daily ticker.</p>' +
      rows.map(r => '<div class="alert-row" style="padding:.6rem 0"><div class="main"><div class="meta">' + esc(r[0]) + '</div></div><div class="mono" style="font-size:1.3rem;text-align:right">' + esc(r[1]) + '</div></div>').join('') +
      '<div class="actions"><button class="btn btn-secondary" data-close>Close</button>' +
      '<button class="btn btn-primary" data-reconnect>Reconnect stream</button></div>';
    modal(html, { onMount: (back, close) => {
      const b = $('[data-reconnect]', back);
      b.addEventListener('click', () => {
        try { live.ws && live.ws.close(); } catch (e) { }
        live.rest(); live.wsConnect();
        b.textContent = 'Reconnecting…';
        setTimeout(() => { if (document.body.contains(back)) b.textContent = 'Reconnect stream'; }, 2000);
      });
    } });
  }

  // ------------------------------------------------------- command palette
  let palette = null;
  function closePalette() { if (palette) { palette.remove(); palette = null; document.removeEventListener('keydown', paletteKeys, true); } }
  function paletteKeys(e) {
    if (!palette) return;
    const list = $$('.palette-item', palette);
    const cur = list.findIndex(el => el.classList.contains('active'));
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      const next = Math.max(0, Math.min(list.length - 1, cur + (e.key === 'ArrowDown' ? 1 : -1)));
      list.forEach((el, i) => el.classList.toggle('active', i === next));
      if (list[next]) list[next].scrollIntoView({ block: 'nearest' });
    } else if (e.key === 'Enter') {
      e.preventDefault();
      const el = list.find(x => x.classList.contains('active')) || list[0];
      if (el) { el.click(); }
    } else if (e.key === 'Escape') {
      e.preventDefault(); closePalette();
    }
  }
  function openPalette(preset) {
    if (palette) { closePalette(); return; }
    const items = [];
    [['dashboard', 'Dashboard'], ['charts', 'Charts'], ['signals', 'Signals'], ['monitor', 'Monitor'], ['alerts', 'Alerts'], ['about', 'About']]
      .forEach(p => items.push({ label: p[1] + ' page', sub: 'navigate', go: p[0], icon: ICONS.external }));
    CAT.charts.forEach(c => items.push({ label: c.title, sub: c.cat + ' · chart', go: 'charts/' + c.slug, icon: ICONS.chart }));
    D.signals.forEach(sg => items.push({ label: sg.title, sub: sg.cat + ' · signal ' + sg.score.toFixed(0) + '/100 ' + sg.phase, go: 'signals', icon: ICONS.bell }));
    palette = document.createElement('div');
    palette.className = 'palette-backdrop';
    palette.innerHTML = '<div class="palette" role="dialog" aria-label="Jump to">' +
      '<div class="palette-input"><label class="field" style="height:4rem">' + ICONS.search +
      '<input id="paletteInput" placeholder="Jump to a chart, signal or page…" autocomplete="off" aria-label="Jump to"></label></div>' +
      '<div class="palette-list" id="paletteList"></div></div>';
    document.body.appendChild(palette);
    palette.addEventListener('mousedown', e => { if (e.target === palette) closePalette(); });
    const input = $('#paletteInput', palette), list = $('#paletteList', palette);
    function paint(q) {
      const query = (q || '').trim().toLowerCase();
      const hits = (query ? items.filter(i => (i.label + ' ' + i.sub).toLowerCase().includes(query)) : items).slice(0, 40);
      list.innerHTML = hits.length ? hits.map((i, k) => '<button class="palette-item' + (k === 0 ? ' active' : '') + '" data-go="' + i.go + '">' +
        '<span class="ico">' + i.icon + '</span><span><b>' + esc(i.label) + '</b><br><span class="muted tiny">' + esc(i.sub) + '</span></span></button>').join('')
        : '<div class="empty">Nothing matches that.</div>';
      $$('.palette-item', list).forEach(el => {
        el.addEventListener('mousemove', () => { $$('.palette-item', list).forEach(x => x.classList.remove('active')); el.classList.add('active'); });
        el.addEventListener('click', () => { closePalette(); nav.go(el.getAttribute('data-go')); });
      });
    }
    paint(preset || '');
    input.value = preset || '';
    input.addEventListener('input', () => paint(input.value));
    input.focus();
    document.addEventListener('keydown', paletteKeys, true);
  }

  // ------------------------------------------------------------------ router
  const PAGES = window.NT_PAGES = {};
  const state = {
    tt: null,               // time-travel date index
    range: store.get('range', '5'),
    pinned: store.get('pinned', ['gold-price-ohlc', 'moving-averages', 'rsi-14', 'gold-price-drawdown', 'stretch-zscore', 'cycle-index', 'seasonality-avg', 'gold-silver-ratio'])
  };
  function savePinned() { store.set('pinned', state.pinned); }
  function togglePin(slug) {
    const i = state.pinned.indexOf(slug);
    if (i >= 0) state.pinned.splice(i, 1); else state.pinned.unshift(slug);
    savePinned(); renderSidebar();
  }
  const nav = { state, registry, toast, flash, beep, ICONS, $, $$, esc, store,
    savePinned, togglePin, live, alerts, modal, showMenu, closeMenu,
    register(spec, chart, extra) { this.unregister(spec.slug); registry.push(Object.assign({ spec, chart }, extra || {})); },
    unregister(slug) { for (let i = registry.length - 1; i >= 0; i--) if (registry[i].spec && registry[i].spec.slug === slug) registry.splice(i, 1); },
    destroyCharts() { registry.forEach(r => { try { if (r.chart && r.chart.destroy) r.chart.destroy(); } catch (e) { } }); registry.length = 0; },
    asOf(id, idx) { const a = D.resolve(id); for (let i = Math.min(idx, a.length - 1); i >= 0; i--) if (a[i] != null) return a[i]; return null; },
    ttIndex() { return state.tt != null ? state.tt : D.n - 1; },
    route() { return (location.hash || '#/dashboard').replace(/^#\/?/, ''); },
    go(path) { location.hash = '#/' + path; }
  };
  window.NT_NAV = nav;
  nav.openPalette = openPalette;
  nav.livePopover = livePopover;

  function renderSidebar() {
    const host = $('#sidebar');
    if (!host) return;
    const route = location.hash || '#/dashboard';
    const q = ($('#search') && $('#search').value || '').trim().toLowerCase();
    const matches = q ? CAT.charts.filter(c => (c.title + ' ' + c.cat + ' ' + c.slug).toLowerCase().includes(q)) : null;
    const item = (c) => {
      const active = route === '#/charts/' + c.slug;
      return '<a class="side-item' + (active ? ' active' : '') + '" href="#/charts/' + c.slug + '" data-slug="' + c.slug + '" title="' + esc(c.title) + '">' +
        '<span class="ico">' + ICONS.chart + '</span><span class="label">' + esc(c.title) + '</span>' +
        '<span class="star' + (state.pinned.includes(c.slug) ? ' on' : '') + '" data-pin="' + c.slug + '" title="Pin chart">' + ICONS.star + '</span></a>';
    };
    let html = '';
    if (matches) {
      html += '<div class="side-section">Search results<span class="count">' + matches.length + '</span></div>';
      html += matches.length ? matches.map(item).join('') : '<div class="side-empty">No chart matches “' + esc(q) + '”.</div>';
    } else {
      const pinned = state.pinned.map(s => CAT.bySlug(s)).filter(Boolean);
      html += '<div class="side-section">Pinned charts<span class="count">' + pinned.length + '</span></div>';
      html += pinned.map(item).join('');
      html += '<div class="side-section">All charts<span class="count">' + CAT.charts.length + '</span></div>';
      const sorted = CAT.charts.slice().sort((a, b) => a.title.localeCompare(b.title));
      let letter = '';
      sorted.forEach(c => {
        const m = /^[A-Za-z]/.test(c.title);
        const L = m ? c.title[0].toUpperCase() : '#';
        if (L !== letter) { letter = L; html += '<div class="side-group-letter">' + L + '</div>'; }
        html += item(c);
      });
    }
    host.innerHTML = html;
    $$('[data-pin]', host).forEach(el => el.addEventListener('click', (e) => { e.preventDefault(); e.stopPropagation(); togglePin(el.getAttribute('data-pin')); }));
  }

  function renderNav() {
    const route = nav.route();
    const page = route.split('/')[0] || 'dashboard';
    const items = [['dashboard', 'Dashboard'], ['charts', 'Charts'], ['signals', 'Signals'], ['monitor', 'Monitor'], ['alerts', 'Alerts']];
    $('#topnav').innerHTML = items.map(([k, label]) =>
      '<a href="#/' + k + '" class="' + (page === k ? 'active' : '') + '">' + label + '</a>').join('');
  }

  function updateAlertBadge() {
    const badge = $('#alertBadge');
    if (!badge) return;
    const n = (window.NT_ALERTS && window.NT_ALERTS.alerts.list.filter(a => a.active).length) || 0;
    badge.textContent = n ? String(n) : '';
    badge.style.display = n ? '' : 'none';
  }

  function applyTheme(theme) {
    document.documentElement.setAttribute('data-theme', theme);
    document.documentElement.style.colorScheme = theme;
    store.set('theme', theme);
    const btn = $('#themeBtn');
    if (btn) btn.innerHTML = theme === 'dark' ? ICONS.sun : ICONS.moon;
    D.refreshTokens();
  }

  async function render() {
    const route = nav.route();
    const [page, arg] = route.split('/');
    closeMenu();
    if (nav.onLeave) { try { nav.onLeave(); } catch (e) { } nav.onLeave = null; }
    nav.destroyCharts();
    const isEmbed = (route || '').split('/')[0] === 'embed';
    document.body.classList.toggle('embed-mode', isEmbed);
    document.body.classList.remove('drawer-open');
    renderNav();
    renderSidebar();
    const view = $('#view');
    view.scrollTop = 0;
    const fn = PAGES[page] || PAGES.dashboard;
    try {
      await fn(view, arg, nav);
    } catch (err) {
      view.innerHTML = '<div class="card"><div class="empty">' + ICONS.alert + '<div>Something went wrong rendering this page.</div><div class="srcnote" style="margin-top:8px">' + esc(err && err.message) + '</div></div></div>';
      console.error(err);
    }
    // time-travel plot lines
    applyTT();
  }
  function applyTT() {
    registry.forEach(r => {
      if (!r.chart || !r.chart.xAxis) return;
      const ax = r.chart.xAxis[0];
      const lines = (r.spec.milestone ? [] : []);
      if (state.tt != null) {
        ax.addPlotLine({
          value: D.ts[state.tt], color: cssVar('--color-primary', '#c96442'), width: 1, dashStyle: 'Dash', zIndex: 6,
          label: { text: D.dates[state.tt], rotation: 0, align: 'left', y: -4, x: 4,
            style: { color: cssVar('--color-primary', '#c96442'), fontSize: '10px', fontFamily: "'IBM Plex Mono', monospace", textOutline: 'none' } }
        });
      }
    });
  }
  function cssVar(k, f) { const v = getComputedStyle(document.documentElement).getPropertyValue(k).trim(); return v || f; }

  function setTT(idx) {
    state.tt = idx;
    render();
  }
  nav.setTT = setTT;
  nav.applyTT = applyTT;
  nav.cssVar = cssVar;

  // ------------------------------------------------------------------- boot
  window.addEventListener('hashchange', render);
  window.addEventListener('resize', () => { registry.forEach(r => { try { if (r.chart && r.chart.reflow) r.chart.reflow(); } catch (e) { } }); });

  document.addEventListener('DOMContentLoaded', () => {
    applyTheme(store.get('theme', 'light'));
    $('#themeBtn').innerHTML = document.documentElement.getAttribute('data-theme') === 'dark' ? ICONS.sun : ICONS.moon;
    const chipEl = $('#liveChip');
    if (chipEl) {
      chipEl.style.cursor = 'pointer';
      chipEl.addEventListener('click', () => livePopover(chipEl));
    }
    document.addEventListener('keydown', (e) => {
      const typing = /input|textarea|select/i.test((document.activeElement || {}).tagName || '');
      if ((e.key === 'k' || e.key === 'K') && (e.metaKey || e.ctrlKey)) { e.preventDefault(); openPalette(); }
      else if (e.key === 'Escape') closeMenu();
      else if (e.key === 'p' && !typing) { e.preventDefault(); openPalette(); }
    });
    $('#themeBtn').addEventListener('click', () => {
      const next = document.documentElement.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
      applyTheme(next);
      render();
    });
    const bell = $('#alertsBtn');
    if (bell) bell.addEventListener('click', () => nav.go('alerts'));
    const drawerBtn = $('#drawerBtn');
    if (drawerBtn) drawerBtn.addEventListener('click', () => document.body.classList.toggle('drawer-open'));
    document.addEventListener('click', (e) => {
      if (document.body.classList.contains('drawer-open') && !e.target.closest('.sidebar') && !e.target.closest('#drawerBtn')) {
        document.body.classList.remove('drawer-open');
      }
    });
    updateAlertBadge();
    window.addEventListener('nt-alert', updateAlertBadge);
    setInterval(updateAlertBadge, 30000);
    const s = $('#search');
    s.addEventListener('input', renderSidebar);
    s.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') { s.value = ''; s.blur(); renderSidebar(); }
      if (e.key === 'Enter') { const first = $('.side-item', $('#sidebar')); if (first) first.click(); }
    });
    document.addEventListener('keydown', (e) => {
      if (e.key === '/' && document.activeElement !== s && !/input|textarea|select/i.test(document.activeElement.tagName)) {
        e.preventDefault(); s.focus();
      }
    });
    $('#searchBtn') && $('#searchBtn').addEventListener('click', () => s.focus());
    renderSidebar();
    render();
  });
  window.NT_RENDER = render;
})();
