/* ==========================================================================
   Noman_trading — live gold feed

   Primary: Binance WebSocket trade stream for PAXG/USDT (a 1:1 gold-backed
   token, the only 24/7 gold market with a real tick stream). Secondary: REST
   polls of gold-api.com (XAU/USD spot benchmark) and the Binance 24h ticker,
   which also supplies the intraday shape. Whichever answers first sets the
   price; the tick stream then keeps it moving.
   ========================================================================== */
(function () {
  const D = window.NT;

  const live = {
    spot: null, prevClose: null, open: null, high: null, low: null,
    source: 'connecting…', updated: null, mode: 'idle', connected: false,
    ticks: [], intraday: [], tickCount: 0, changeAbs: 0, changePct: 0, ok: false,
    ws: null, retry: 0, listeners: [],

    // aliases kept so older call sites (live.src / live.series24h) keep working
    get src() { return this.source; },
    get series24h() { return this.intraday; },

    on(fn) { this.listeners.push(fn); },
    emit() { this.listeners.forEach(f => { try { f(this); } catch (e) { } }); },

    start() {
      this.rest();
      this.wsConnect();
      setInterval(() => this.rest(), 45000);
      setInterval(() => { if (!this.connected && this.mode !== 'stream') this.emit(); }, 5000);
    },

    // ---------------------------------------------------------- tick stream
    wsConnect() {
      if (typeof WebSocket === 'undefined') { this.mode = 'poll'; return; }
      let ws;
      try { ws = new WebSocket('wss://stream.binance.com:9443/ws/paxgusdt@trade'); }
      catch (e) { this.mode = 'poll'; return; }
      this.ws = ws;
      ws.addEventListener('open', () => { this.connected = true; this.mode = 'stream'; this.retry = 0; this.emit(); });
      ws.addEventListener('message', ev => {
        let m;
        try { m = JSON.parse(ev.data); } catch (e) { return; }
        const p = parseFloat(m && m.p);
        if (!p || !isFinite(p)) return;
        this.spot = p;
        this.source = 'Binance PAXG/USDT tick stream';
        this.updated = new Date();
        this.tickCount++;
        this.ticks.push({ t: m.T || Date.now(), p: p });
        if (this.ticks.length > 2400) this.ticks.splice(0, this.ticks.length - 2400);
        if (!this.open) this.open = p;
        this.recalc();
        this.emit();
      });
      const drop = () => {
        this.connected = false;
        if (this.mode === 'stream') { this.mode = 'poll'; this.source = this.spot ? 'Binance PAXG/USDT · polling' : 'connecting…'; }
        this.emit();
        this.retry = Math.min(this.retry + 1, 6);
        setTimeout(() => this.wsConnect(), 1500 * this.retry);
      };
      ws.addEventListener('close', drop);
      ws.addEventListener('error', () => { try { ws.close(); } catch (e) { } });
      // keep the socket warm: browsers drop idle sockets
      this.heartbeat = setInterval(() => {
        if (this.ws && this.ws.readyState === 1 && Date.now() - (this.updated ? this.updated.getTime() : 0) > 60000) {
          try { this.ws.send(JSON.stringify({ method: 'ping' })); } catch (e) { }
        }
      }, 30000);
    },

    // ------------------------------------------------------------- rest feed
    async rest() {
      let got = false;
      // 24h statistics first: they carry the previous close used for the change
      try {
        const r = await fetch('https://api.binance.com/api/v3/ticker/24hr?symbol=PAXGUSDT', { cache: 'no-store' });
        if (r.ok) {
          const j = await r.json();
          this.prevClose = Number(j.prevClosePrice) || this.prevClose;
          this.open = Number(j.openPrice) || this.open;
          this.high = Number(j.highPrice); this.low = Number(j.lowPrice);
          if (!this.spot) { this.spot = Number(j.lastPrice); this.source = 'Binance PAXG/USDT'; this.updated = new Date(); }
          this.ok = true;
          got = true;
        }
      } catch (e) { }
      // official XAU/USD spot benchmark
      try {
        const r = await fetch('https://api.gold-api.com/price/XAU', { cache: 'no-store' });
        if (r.ok) {
          const j = await r.json();
          if (j && j.price) {
            this.benchmark = Number(j.price);
            this.benchmarkAt = new Date();
            if (!this.spot) { this.spot = this.benchmark; this.source = 'gold-api.com · XAU/USD spot'; this.updated = new Date(); }
            got = true;
          }
        }
      } catch (e) { }
      if (!got && !this.spot) {
        this.spot = D ? D.stats.price : null;
        this.source = 'last close (offline)';
        this.changeAbs = D ? D.stats.change : 0;
        this.changePct = D ? D.stats.changePct : 0;
      }
      if (!this.intraday.length) this.pullIntraday();
      this.recalc();
      this.emit();
    },

    async pullIntraday() {
      try {
        const r = await fetch('https://api.binance.com/api/v3/klines?symbol=PAXGUSDT&interval=5m&limit=288', { cache: 'no-store' });
        if (!r.ok) return;
        const j = await r.json();
        this.intraday = j.map(k => [Number(k[0]), Number(k[4])]);
        this.emit();
      } catch (e) { }
    },

    recalc() {
      if (this.spot != null && this.prevClose) {
        this.changeAbs = this.spot - this.prevClose;
        this.changePct = (this.spot / this.prevClose - 1) * 100;
      }
    },

    // sparkline source: 24h of 5-minute closes plus today's ticks
    series() {
      const base = this.intraday.map(p => p[1]);
      const tickPart = this.ticks.length > 2 ? this.ticks.map(t => t.p) : [];
      return base.concat(tickPart);
    },
    secondsAgo() {
      return this.updated ? Math.max(0, Math.round((Date.now() - this.updated.getTime()) / 1000)) : null;
    }
  };

  window.NT_LIVE = live;
  if (D) D.live = live;
  live.start();
  window.addEventListener('online', () => { live.rest(); if (!live.connected) live.wsConnect(); });
})();
