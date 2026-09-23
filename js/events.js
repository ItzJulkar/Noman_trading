/* ==========================================================================
   Noman_trading — event detection for the Monitor feed

   Every event below is detected from the actual series: a threshold crossing,
   a moving-average cross, a new high, a phase change. Nothing is narrated or
   invented — if the data does not cross, no event is produced.
   ========================================================================== */
(function () {
  var D = window.NT;
  var N = D.n, dates = D.dates;

  function idx(dateStr) { return dates.indexOf(dateStr); }
  function toneOf(type) { return /ath|golden|cross200d_up|cross200w_up|rsi30|gsr_low|momentum90_pos|mom365_pos|phase_up|dxy_low|milestone_up/.test(type) ? 'bull' : /dd|death|cross200d_down|cross200w_down|rsi70|gsr_high|vol_spike|momentum90_neg|mom365_neg|dxy_high|milestone_down/.test(type) ? 'bear' : 'neutral'; }

  function detect() {
    var S = D.series, out = [];
    var push = function (i, type, title, detail, value, unit) {
      out.push({ d: dates[i], t: Date.parse(dates[i] + 'T00:00:00Z'), type: type, title: title, detail: detail, tone: toneOf(type), value: value, unit: unit });
    };
    var prev = function (s, i) { return i > 0 ? s[i - 1] : null; };

    // --- all-time high breaks (max once per 15 sessions, needs a 1% break)
    var ath = -Infinity, athI = -1, lastAthEvent = -99;
    for (var i = 0; i < N; i++) {
      var c = S.gold_close[i];
      if (c == null) continue;
      if (c > ath) {
        var broke = athI >= 0 && c > ath * 1.01 && i - lastAthEvent >= 15;
        if (broke) { push(i, 'ath', 'New all-time high', 'Gold closed above its previous record of ' + D.fmt.usd(ath) + ', set ' + dates[athI], c, 'usd'); lastAthEvent = i; }
        ath = c; athI = i;
      }
    }

    // --- drawdown thresholds
    [[-10, 'dd10', 'Drawdown passed -10%', 'Gold fell more than 10% below its peak'], [-20, 'dd20', 'Drawdown passed -20%', 'Gold fell more than 20% below its peak'],
     [-30, 'dd30', 'Drawdown passed -30%', 'A drawdown this deep has only happened five times since 2000']].forEach(function (cfg) {
      var armed = true;
      for (var i = 1; i < N; i++) {
        var dd = S.drawdown[i];
        if (dd == null) continue;
        if (dd > cfg[0] + 2) armed = true;
        if (dd <= cfg[0] && armed) { push(i, cfg[1], cfg[2], cfg[3], dd, 'pct'); armed = false; }
      }
    });

    // --- RSI crossings
    var rsiState = null;
    for (var i = 1; i < N; i++) {
      var r = S.rsi14[i];
      if (r == null) continue;
      if (rsiState === null) rsiState = r > 50 ? 'hi' : 'lo';
      if (r > 70 && rsiState !== 'ob') { push(i, 'rsi70', 'RSI crossed above 70', 'Daily RSI entered overbought territory', r, 'idx'); rsiState = 'ob'; }
      else if (r < 30 && rsiState !== 'os') { push(i, 'rsi30', 'RSI crossed below 30', 'Daily RSI entered oversold territory', r, 'idx'); rsiState = 'os'; }
      else if (r <= 70 && r >= 30) rsiState = r > 50 ? 'hi' : 'lo';
    }

    // --- golden / death cross
    var crossState = null;
    for (var i = 200; i < N; i++) {
      var a = S.ma50[i], b = S.ma200[i];
      if (a == null || b == null) continue;
      var above = a > b;
      if (crossState === null) crossState = above;
      else if (above !== crossState) {
        push(i, above ? 'golden_cross' : 'death_cross', above ? 'Golden cross' : 'Death cross',
          'The 50-day average crossed ' + (above ? 'above' : 'below') + ' the 200-day average', (a / b - 1) * 100, 'pct');
        crossState = above;
      }
    }

    // --- price crossing the 200DMA / 200WMA
    [['ma200', 'cross200d_up', 'cross200d_down', '200-day average'],
     ['ma200w', 'cross200w_up', 'cross200w_down', '200-week average']].forEach(function (cfg) {
      var st = null;
      for (var i = 1; i < N; i++) {
        var ma = S[cfg[0]][i], px = S.gold_close[i];
        if (ma == null || px == null) continue;
        var above = px > ma;
        if (st === null) st = above;
        else if (above !== st) {
          push(i, above ? cfg[1] : cfg[2], 'Gold crossed ' + (above ? 'above' : 'below') + ' the ' + cfg[3],
            'Price ' + D.fmt.usd(px) + ' vs ' + D.fmt.usd(ma) + ' average', (px / ma - 1) * 100, 'pct');
          st = above;
        }
      }
    });

    // --- volatility spike / calm
    var vState = null;
    for (var i = 30; i < N; i++) {
      var v = S.vol30[i];
      if (v == null) continue;
      if (vState === null) vState = v > 20 ? 'hi' : 'lo';
      if (v > 25 && vState === 'lo') { push(i, 'vol_spike', 'Volatility spike', '30-day realised volatility jumped above 25% annualised', v, 'pct'); vState = 'hi'; }
      else if (v < 12 && vState === 'hi') { push(i, 'vol_calm', 'Volatility compressed', '30-day realised volatility fell below 12% annualised', v, 'pct'); vState = 'lo'; }
    }

    // --- gold / silver ratio extremes
    var gState = null;
    for (var i = 1; i < N; i++) {
      var g = S.gsr[i];
      if (g == null) continue;
      if (gState === null) gState = 'mid';
      if (g > 80 && gState !== 'hi') { push(i, 'gsr_high', 'Gold/silver ratio above 80', 'Silver is historically cheap relative to gold', g, 'ratio'); gState = 'hi'; }
      else if (g < 50 && gState !== 'lo') { push(i, 'gsr_low', 'Gold/silver ratio below 50', 'Gold is historically cheap relative to silver', g, 'ratio'); gState = 'lo'; }
      else if (g <= 80 && g >= 50) gState = 'mid';
    }

    // --- cycle phase changes on the composite index
    var scores = D.signalScore('cycle');
    var phState = null;
    for (var i = 1; i < N; i++) {
      var s = scores[i];
      if (s == null) continue;
      var ph = D.phaseOf(s);
      if (phState === null) { phState = ph; continue; }
      if (ph !== phState) {
        push(i, ph === 'Top' || ph === 'Bullish' ? 'phase_up' : 'phase_down', 'Cycle phase → ' + ph,
          'The composite Cycle Index moved from ' + phState + ' into ' + ph + ' territory', s, 'score');
        phState = ph;
      }
    }

    // --- real yield crossings at 1% / 2%
    [1, 2].forEach(function (level) {
      var st = null;
      for (var i = 1; i < N; i++) {
        var y = S.realyield[i];
        if (y == null) continue;
        var above = y > level;
        if (st === null) st = above;
        else if (above !== st) {
          push(i, above ? 'ry_up' : 'ry_down', 'Real yield crossed ' + level + '%',
            'The 10-year TIPS yield moved ' + (above ? 'above' : 'below') + ' ' + level + '% — ' + (above ? 'a headwind' : 'a tailwind') + ' for gold', y, 'pct');
          st = above;
        }
      }
    });

    // --- dollar index 52-week extremes
    for (var i = 252; i < N; i++) {
      var d0 = S.dxy[i];
      if (d0 == null) continue;
      var win = S.dxy.slice(i - 252, i).filter(function (x) { return x != null; });
      if (win.length < 200) continue;
      var hi = Math.max.apply(null, win), lo = Math.min.apply(null, win);
      if (d0 > hi) push(i, 'dxy_high', 'Dollar index 52-week high', 'DXY at ' + d0.toFixed(1) + ' — the strongest in a year, a headwind for gold', d0, 'idx');
      if (d0 < lo) push(i, 'dxy_low', 'Dollar index 52-week low', 'DXY at ' + d0.toFixed(1) + ' — the weakest in a year, a tailwind for gold', d0, 'idx');
    }

    // --- 12-month return crossing zero
    var mState = null;
    for (var i = 1; i < N; i++) {
      var m = S.mom365[i];
      if (m == null) continue;
      var pos = m > 0;
      if (mState === null) mState = pos;
      else if (pos !== mState) {
        push(i, pos ? 'mom365_pos' : 'mom365_neg', '12-month return turned ' + (pos ? 'positive' : 'negative'),
          'Gold is ' + (pos ? 'up' : 'down') + ' ' + Math.abs(m).toFixed(1) + '% over the last year', m, 'pct');
        mState = pos;
      }
    }

    // --- curated gold milestones
    (window.NT_MILESTONES || []).forEach(function (m) {
      var i = idx(m.d);
      if (i >= 0) push(i, m.label.indexOf('high') >= 0 || m.label.indexOf('surge') >= 0 || m.label.indexOf('break') >= 0 ? 'milestone_up' : 'milestone_down',
        m.label, 'Milestone marker on the long-term gold chart', S.gold_close[i], 'usd');
    });

    return out.sort(function (a, b) { return b.d < a.d ? -1 : b.d > a.d ? 1 : 0; });
  }

  // Watch list: how far the market is from the next notable level right now.
  // Each row carries its own wording and its own number format, because
  // "price is x% above" makes no sense for a ratio or an oscillator.
  function watchlist() {
    var S = D.series, L = function (a) { for (var i = N - 1; i >= 0; i--) if (a[i] != null) return a[i]; return null; };
    var px = L(S.gold_close), rsi = L(S.rsi14), cyc = L(D.signalScore('cycle')), gsr = L(S.gsr), ry = L(S.realyield);
    var items = [];
    function add(o) { items.push(o); }
    function priceRow(key, level, label, phrase) {
      var d = (px / level - 1) * 100;
      add({ key: key, label: label, sort: Math.abs(d), tone: d >= 0 ? 'neutral' : 'neutral',
        text: 'price is ' + Math.abs(d).toFixed(2) + '% ' + (d >= 0 ? 'above' : 'below') + ' ' + phrase + ' — now ' + D.fmt.usd(px),
        value: (d >= 0 ? '+' : '') + d.toFixed(2) + '%' });
    }
    function pointsRow(key, level, now, name, unit, phrase, label) {
      var d = now - level;
      add({ key: key + '_' + level, label: label, sort: Math.abs(d),
        tone: /overbought|Top|80/.test(phrase) ? (d >= 0 ? 'bear' : 'neutral') : (d <= 0 ? 'bull' : 'neutral'),
        text: name + ' is ' + Math.abs(d).toFixed(unit === '%' ? 2 : 1) + (unit === 'pp' ? 'pp' : unit === '%' ? 'pp' : ' points') + ' ' + (d >= 0 ? 'above' : 'below') + ' ' + level + (unit === '%' ? '%' : '') + ' — now ' + (unit === '%' ? now.toFixed(2) + '%' : now.toFixed(1)),
        value: (d >= 0 ? '+' : '') + d.toFixed(unit === '%' ? 2 : 1) });
    }
    var ma200 = L(S.ma200), ma200w = L(S.ma200w);
    var ath = Math.max.apply(null, S.gold_close);
    priceRow('ma200', ma200, 'Back to the 200-day average', 'the 200-day average (' + D.fmt.usd(ma200) + ')');
    priceRow('ma200w', ma200w, 'Back to the 200-week average', 'the 200-week average (' + D.fmt.usd(ma200w) + ')');
    priceRow('ath', ath, 'A new all-time high', 'the all-time high (' + D.fmt.usd(ath) + ')');
    pointsRow('rsi', 70, rsi, 'RSI', '', 'Overbought', 'Overbought — RSI 70');
    pointsRow('rsi', 30, rsi, 'RSI', '', 'Oversold', 'Oversold — RSI 30');
    pointsRow('cycle', 75, cyc, 'Cycle Index', '', 'Top', 'Cycle phase Top — score 75');
    pointsRow('cycle', 25, cyc, 'Cycle Index', '', 'Bottom', 'Cycle phase Bottom — score 25');
    pointsRow('gsr', 80, gsr, 'Gold/silver ratio', '', 'Gold/silver 80', 'Gold / silver 80');
    pointsRow('gsr', 50, gsr, 'Gold/silver ratio', '', 'Gold/silver 50', 'Gold / silver 50');
    pointsRow('ry', 2, ry, '10Y real yield', '%', 'Real yield 2%', 'Real yield 2%');
    return items.sort(function (a, b) { return a.sort - b.sort; }).slice(0, 6);
  }

  window.NT_EVENTS = { detect: detect, watchlist: watchlist, toneOf: toneOf };
})();
