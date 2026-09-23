"""Noman_trading data builder.

Fetches the raw market data and rebuilds js/data/nt-data.js.

    python tools/build_data.py            # fetch fresh data, then rebuild
    python tools/build_data.py --offline   # rebuild from tools/raw/* only

Sources
  gold/silver/platinum/copper/crude/DXY/GDX/S&P 500 daily : Yahoo Finance chart API
  LBMA Gold PM auction (USD/oz) since 1968                : prices.lbma.org.uk
  US CPI (CPIAUCSL), 10Y TIPS real yield (DFII10)         : FRED CSV endpoint
  live spot at runtime (browser)                          : gold-api.com + Binance
"""
import os, sys, json, csv, math, time, urllib.request, datetime as dt

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
RAW = os.path.join(HERE, "raw")
OUT_DIR = os.path.join(ROOT, "js", "data")

YAHOO = {
 "GCF.json": "GC=F", "SIF.json": "SI=F", "PLF.json": "PL=F", "CLF.json": "CL=F",
 "HGF.json": "HG=F", "DXYNYB.json": "DX-Y.NYB", "GDX.json": "GDX", "5EGSPC.json": "%5EGSPC",
}

def _get(url):
    req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)"})
    with urllib.request.urlopen(req, timeout=60) as r:
        return r.read()

def fetch():
    os.makedirs(RAW, exist_ok=True)
    for fname, sym in YAHOO.items():
        url = ("https://query1.finance.yahoo.com/v8/finance/chart/%s"
               "?period1=0&period2=2000000000&interval=1d&events=div%%7Csplit" % sym)
        data = _get(url)
        open(os.path.join(RAW, fname), "wb").write(data)
        print("fetched", sym, len(data), "bytes")
        time.sleep(0.8)
    data = _get("https://prices.lbma.org.uk/json/gold_pm.json")
    open(os.path.join(RAW, "lbma_gold_pm.json"), "wb").write(data)
    print("fetched LBMA", len(data), "bytes")
    for name, series in (("cpi.csv", "CPIAUCSL"), ("realyield.csv", "DFII10")):
        data = _get("https://fred.stlouisfed.org/graph/fredgraph.csv?id=" + series)
        open(os.path.join(RAW, name), "wb").write(data)
        print("fetched", series, len(data), "bytes")

if "--offline" not in sys.argv:
    fetch()
else:
    print("offline mode: using existing files in", RAW)

# ---------------------------------------------------------------- helpers
def rnd(v, n=2):
    if v is None: return None
    try:
        f = float(v)
    except Exception:
        return None
    if math.isnan(f) or math.isinf(f): return None
    return round(f, n)

def load_yahoo(name):
    with open(os.path.join(RAW, name), encoding='utf-8') as f:
        j = json.load(f)
    r = j['chart']['result'][0]
    ts = r['timestamp']
    q = r['indicators']['quote'][0]
    out = []
    for i, t in enumerate(ts):
        o, h, l, c = q['open'][i], q['high'][i], q['low'][i], q['close'][i]
        if c is None: continue
        d = dt.datetime.utcfromtimestamp(t).strftime('%Y-%m-%d')
        out.append({'d': d, 't': t * 1000, 'o': o, 'h': h, 'l': l, 'c': c, 'v': q['volume'][i]})
    # dedupe by date, keep last
    dd = {}
    for row in out: dd[row['d']] = row
    return [dd[k] for k in sorted(dd)]

def load_lbma():
    with open(os.path.join(RAW, 'lbma_gold_pm.json'), encoding='utf-8') as f:
        j = json.load(f)
    out = []
    for row in j:
        v = row.get('v') or []
        pm = None
        # v[0] = USD/oz, v[1] = GBP/oz, v[2] = EUR/oz
        for cand in (v[0] if v else None, v[1] if len(v) > 1 else None):
            if cand: pm = cand; break
        if pm is None: continue
        out.append({'d': row['d'], 'c': float(pm)})
    return out

def load_fred(fn, col=None):
    rows = {}
    with open(os.path.join(RAW, fn), encoding='utf-8') as f:
        rd = csv.reader(f)
        head = next(rd)
        for r in rd:
            if len(r) < 2: continue
            if r[1] in ('.', ''): continue
            rows[r[0]] = float(r[1])
    return rows

# ---- indicators -----------------------------------------------------------
def sma(vals, n):
    out = [None] * len(vals); s = 0.0
    for i, v in enumerate(vals):
        s += v
        if i >= n: s -= vals[i - n]
        if i >= n - 1: out[i] = s / n
    return out

def ema(vals, n):
    out = [None] * len(vals)
    k = 2.0 / (n + 1); prev = None
    for i, v in enumerate(vals):
        prev = v if prev is None else v * k + prev * (1 - k)
        out[i] = prev
    return out

def rsi(vals, n=14):
    out = [None] * len(vals)
    ag = al = None
    for i in range(1, len(vals)):
        ch = vals[i] - vals[i - 1]
        g, l = max(ch, 0.0), max(-ch, 0.0)
        if i <= n:
            ag = g if ag is None else ag + g
            al = l if al is None else al + l
            if i == n:
                ag /= n; al /= n
                out[i] = 100 - (100 / (1 + (ag / al if al else 1e9)))
        else:
            ag = (ag * (n - 1) + g) / n
            al = (al * (n - 1) + l) / n
            rs = ag / al if al else 1e9
            out[i] = 100 - (100 / (1 + rs))
    return out

def roll_std(vals, n):
    out = [None] * len(vals); s = 0.0; s2 = 0.0
    for i, v in enumerate(vals):
        s += v; s2 += v * v
        if i >= n: s -= vals[i - n]; s2 -= vals[i - n] ** 2
        if i >= n - 1:
            m = s / n
            var = max(s2 / n - m * m, 0.0)
            out[i] = math.sqrt(var)
    return out

def roll_max(vals, n=None):
    out = []; m = None
    for i, v in enumerate(vals):
        m = v if m is None else max(m, v)
        out.append(m)
    return out

def expanding_percentile(vals, window=1260):
    """percentile rank of each value within trailing `window` observations"""
    out = [None] * len(vals)
    for i, v in enumerate(vals):
        lo = max(0, i - window + 1)
        seg = [x for x in vals[lo:i + 1] if x is not None]
        if v is None or len(seg) < 30:
            out[i] = None; continue
        below = sum(1 for x in seg if x <= v)
        out[i] = round(100.0 * below / len(seg), 1)
    return out

def pct_change_series(vals, n):
    out = [None] * len(vals)
    for i in range(len(vals)):
        if i >= n and vals[i - n]:
            out[i] = (vals[i] / vals[i - n] - 1) * 100
    return out

def drawdown_series(vals):
    out = []; peak = None
    for v in vals:
        peak = v if peak is None else max(peak, v)
        out.append((v / peak - 1) * 100)
    return out

def roc_ann(vals, n):
    out = [None] * len(vals)
    for i in range(len(vals)):
        if i - n >= 0 and vals[i - n]:
            yrs = n / 252.0
            out[i] = ((vals[i] / vals[i - n]) ** (1 / yrs) - 1) * 100
    return out

# ---------------------------------------------------------------- load
gold = load_yahoo('GCF.json')
silver = load_yahoo('SIF.json')
plat = load_yahoo('PLF.json')
oil = load_yahoo('CLF.json')
copper = load_yahoo('HGF.json')
dxy = load_yahoo('DXYNYB.json')
gdx = load_yahoo('GDX.json')
spx = load_yahoo('5EGSPC.json')
lbma = load_lbma()
cpi = load_fred('cpi.csv')
ry = load_fred('realyield.csv')

print('gold', len(gold), gold[0]['d'], gold[-1]['d'], gold[-1]['c'])
print('silver', len(silver), silver[0]['d'], silver[-1]['d'])
print('dxy', len(dxy), dxy[0]['d'], dxy[-1]['d'])
print('gdx', len(gdx), gdx[0]['d'], gdx[-1]['d'])
print('spx', len(spx), spx[0]['d'], spx[-1]['d'])
print('lbma', len(lbma), lbma[0]['d'], lbma[-1]['d'], lbma[-1]['c'])
print('ry', len(ry), min(ry), max(ry))
print('cpi last', max(cpi))

def map_by_date(series):
    return {r['d']: r for r in series}

m_gold = map_by_date(gold)
def close_map(series):
    return {r['d']: r['c'] for r in series}
mx_silver = close_map(silver); mx_plat = close_map(plat); mx_oil = close_map(oil)
mx_copper = close_map(copper); mx_dxy = close_map(dxy); mx_gdx = close_map(gdx)
mx_spx = close_map(spx)

dates = [r['d'] for r in gold]
N = len(dates)
c = [r['c'] for r in gold]
o = [r['o'] for r in gold]
h = [r['h'] for r in gold]
l = [r['l'] for r in gold]
vol = [r['v'] for r in gold]

print('N', N)

# ---- derived series -------------------------------------------------------
ma50 = sma(c, 50); ma100 = sma(c, 100); ma200 = sma(c, 200)
rsi14 = rsi(c, 14)
sd200 = roll_std(c, 200)
z200 = [(c[i] - ma200[i]) / sd200[i] if ma200[i] and sd200[i] else None for i in range(N)]
bb_mid = sma(c, 20); bb_sd = roll_std(c, 20)
bb_up = [bb_mid[i] + 2 * bb_sd[i] if bb_mid[i] and bb_sd[i] else None for i in range(N)]
bb_dn = [bb_mid[i] - 2 * bb_sd[i] if bb_mid[i] and bb_sd[i] else None for i in range(N)]
bb_w = [(bb_up[i] - bb_dn[i]) / bb_mid[i] * 100 if bb_up[i] and bb_mid[i] else None for i in range(N)]
ema12 = ema(c, 12); ema26 = ema(c, 26)
macd = [ema12[i] - ema26[i] for i in range(N)]
macd_sig = ema(macd, 9)
macd_hist = [macd[i] - macd_sig[i] for i in range(N)]
logret = [math.log(c[i] / c[i - 1]) if i and c[i - 1] else 0.0 for i in range(N)]
def realized_vol(n):
    out = [None] * N
    for i in range(N):
        if i >= n:
            seg = logret[i - n + 1:i + 1]
            m = sum(seg) / n
            var = sum((x - m) ** 2 for x in seg) / (n - 1)
            out[i] = math.sqrt(var) * math.sqrt(252) * 100
    return out
vol30 = realized_vol(30); vol90 = realized_vol(90); vol365 = realized_vol(365)
atr14 = [None] * N
for i in range(1, N):
    tr = max(h[i] - l[i], abs(h[i] - c[i - 1]), abs(l[i] - c[i - 1]))
    if i == 14:
        atr14[i] = sum(max(h[k] - l[k], abs(h[k] - c[k - 1]), abs(l[k] - c[k - 1])) for k in range(1, 15)) / 14
    elif i > 14:
        atr14[i] = (atr14[i - 1] * 13 + tr) / 14
dd = drawdown_series(c)
ath = max(c); ath_i = c.index(ath)
mom30 = pct_change_series(c, 30); mom90 = pct_change_series(c, 90); mom180 = pct_change_series(c, 180)
mom365 = pct_change_series(c, 365)
dist200 = [(c[i] / ma200[i] - 1) * 100 if ma200[i] else None for i in range(N)]

# ---- weekly series --------------------------------------------------------
def to_weekly(dates, vals, extra=None):
    """last observation of each ISO week"""
    out_d, out_v = [], []
    keyed = {}
    order = []
    for i, d in enumerate(dates):
        y, w, _ = dt.date.fromisoformat(d).isocalendar()
        k = (y, w)
        if k not in keyed:
            keyed[k] = []; order.append(k)
        keyed[k].append(i)
    for k in order:
        idxs = keyed[k]
        out_d.append(dates[idxs[-1]])
        out_v.append(vals[idxs[-1]])
    return out_d, out_v

wdates, wclose = to_weekly(dates, c)
_, whigh = to_weekly(dates, h)
_, wlow = to_weekly(dates, l)
wma50 = sma(wclose, 50); wma200 = sma(wclose, 200)
wrsi = rsi(wclose, 14)
wvol = [None] * len(wclose)
for i in range(len(wclose)):
    if i >= 52:
        seg = [math.log(wclose[k] / wclose[k - 1]) for k in range(i - 51, i + 1)]
        m = sum(seg) / len(seg)
        var = sum((x - m) ** 2 for x in seg) / (len(seg) - 1)
        wvol[i] = math.sqrt(var) * math.sqrt(52) * 100

# ---- cross asset ----------------------------------------------------------
def ratio(a_map, b_map, n=None):
    return [a_map[d] / b_map[d] if (d in a_map and d in b_map and b_map[d]) else None for d in dates]
gsr = ratio(mx_gold := close_map(gold), mx_silver)
gpr = ratio(mx_gold, mx_plat)
gor = ratio(mx_gold, mx_oil)
gcr = ratio(mx_gold, mx_copper)
gld_gdx = [mx_gold[d] / mx_gdx[d] if d in mx_gdx and mx_gdx[d] else None for d in dates]
gold_spx = [mx_gold[d] / mx_spx[d] * 1000 if d in mx_spx and mx_spx[d] else None for d in dates]
dxy_s = [mx_dxy.get(d) for d in dates]
dxy_inv = [100 / v if v else None for v in dxy_s]
# real yield: forward-fill last known value
ry_ff, last = [], None
for d in dates:
    if d in ry: last = ry[d]
    ry_ff.append(last)
# cpi: forward fill monthly
cpi_dates = sorted(cpi)
cpi_ff = []
j = 0; cur = None
for d in dates:
    while j < len(cpi_dates) and cpi_dates[j] <= d:
        cur = cpi[cpi_dates[j]]; j += 1
    cpi_ff.append(cur)
cpi_last = cpi_ff[-1]
real_price = [c[i] * (cpi_last / cpi_ff[i]) if cpi_ff[i] else None for i in range(N)]
real_dd = drawdown_series([v if v else 0 for v in real_price])
real_ath = max(v for v in real_price if v)

# ---- seasonality ----------------------------------------------------------
month_ret = {}
prev_month_last = {}
mon_by_key = {}
for i, d in enumerate(dates):
    key = d[:7]
    mon_by_key.setdefault(key, []).append(i)
monthly = []  # (key, last_index)
for key in sorted(mon_by_key):
    idxs = mon_by_key[key]
    monthly.append((key, idxs[-1], idxs[0]))
mret = []  # month over month return %
for k in range(len(monthly)):
    if k == 0: mret.append(None); continue
    prev = monthly[k - 1][1]; cur = monthly[k][1]
    mret.append((c[cur] / c[prev] - 1) * 100)
mon_season = {m: [] for m in range(1, 13)}
for k, (key, last_i, first_i) in enumerate(monthly):
    if mret[k] is None: continue
    mon_season[int(key[5:7])].append(mret[k])
season_avg = {m: (sum(v) / len(v) if v else None) for m, v in mon_season.items()}
season_win = {m: (100.0 * sum(1 for x in v if x > 0) / len(v) if v else None) for m, v in mon_season.items()}
season_med = {m: (sorted(v)[len(v)//2] if v else None) for m, v in mon_season.items()}
year_ret = {}
for key in sorted(mon_by_key):
    y = key[:4]
    idxs = mon_by_key[key]
    year_ret.setdefault(y, []).append((key, idxs[-1], idxs[0]))
yearly = []
for y in sorted(year_ret):
    months = year_ret[y]
    yearly.append((y, (c[months[-1][1]] / c[months[0][2]] - 1) * 100 if len(months) > 1 else None))

# monthly returns matrix for heatmap  (year -> [12 returns])
mm = {}
for k, (key, last_i, first_i) in enumerate(monthly):
    if mret[k] is None: continue
    y, m = key[:4], int(key[5:7])
    mm.setdefault(y, {})[m] = round(mret[k], 2)

# ---- signal scores --------------------------------------------------------
def series_scores(vals, invert=False, window=1260):
    p = expanding_percentile(vals, window)
    return [None if x is None else round(100 - x if invert else x, 1) for x in p]

sig_defs = [
    ('rsi14', 'RSI (14D)', 'Momentum', rsi14, False, 'idx'),
    ('rsiw', 'RSI (14W weekly)', 'Momentum', None, False, 'idx'),
    ('z200', 'Stretch Z-Score (vs 200DMA)', 'Valuation', z200, False, 'z'),
    ('dist200', 'Distance from 200DMA (%)', 'Valuation', dist200, False, 'pct'),
    ('dist200w', 'Distance from 200WMA (%)', 'Valuation', None, False, 'pct'),
    ('mom30', 'Momentum 30D (%)', 'Momentum', mom30, False, 'pct'),
    ('mom90', 'Momentum 90D (%)', 'Momentum', mom90, False, 'pct'),
    ('mom365', 'Momentum 1Y (%)', 'Momentum', mom365, False, 'pct'),
    ('drawdown', 'Drawdown from all-time high (%)', 'Risk', dd, True, 'pct'),
    ('vol30', 'Realized volatility 30D (ann. %)', 'Volatility', vol30, False, 'pct'),
    ('vol90', 'Realized volatility 90D (ann. %)', 'Volatility', vol90, False, 'pct'),
    ('bbw', 'Bollinger band width (%)', 'Volatility', bb_w, False, 'pct'),
    ('gsr', 'Gold / Silver ratio', 'Cross-asset', gsr, False, 'ratio'),
    ('gor', 'Gold / Oil ratio', 'Cross-asset', gor, False, 'ratio'),
    ('gdxg', 'Miner leverage (GDX / Gold)', 'Cross-asset', gld_gdx, False, 'ratio'),
    ('gspx', 'Relative strength vs S&P 500', 'Cross-asset', gold_spx, False, 'ratio'),
    ('dxy', 'US Dollar pressure (DXY)', 'Macro', dxy_s, True, 'idx'),
    ('realy', 'Real yield pressure (10Y TIPS)', 'Macro', ry_ff, True, 'pct'),
    ('realpx', 'Real (CPI-adjusted) price', 'Valuation', real_price, False, 'usd'),
]
# weekly-derived signals mapped to daily grid
def map_weekly_to_daily(wd, wv):
    out = [None] * N
    j = 0
    for i, d in enumerate(dates):
        while j + 1 < len(wd) and wd[j + 1] <= d:
            j += 1
        out[i] = wv[j] if wd and wd[j] <= d else None
    return out
wma50_d = map_weekly_to_daily(wdates, wma50)
wma200_d = map_weekly_to_daily(wdates, wma200)
wrsi_d = map_weekly_to_daily(wdates, wrsi)
dist200w = [(c[i] / wma200_d[i] - 1) * 100 if wma200_d[i] else None for i in range(N)]
sig_defs[1] = ('rsiw', 'RSI (14W weekly)', 'Momentum', wrsi_d, False, 'idx')
sig_defs[4] = ('dist200w', 'Distance from 200WMA (%)', 'Valuation', dist200w, False, 'pct')

signals = []
score_matrix = []
for key, title, cat, vals, inv, unit in sig_defs:
    sc = series_scores(vals, inv)
    signals.append({'key': key, 'title': title, 'cat': cat, 'unit': unit,
                    'raw': [rnd(vals[i], 4) for i in range(N)], 'score': sc, 'inv': inv})
    score_matrix.append(sc)
print('signals', [(s['key'], s['score'][-1], s['raw'][-1]) for s in signals])

composite = []
for i in range(N):
    vs = [m[i] for m in score_matrix if m[i] is not None]
    composite.append(round(sum(vs) / len(vs), 1) if len(vs) >= 8 else None)
print('cycle index', composite[-1])

# phases
def phase_of(s):
    if s is None: return None
    if s < 25: return 'Bottom'
    if s < 50: return 'Bearish'
    if s < 75: return 'Bullish'
    return 'Top'

def delta(series, n):
    a = series[-1]; b = series[-1 - n] if len(series) > n else None
    if a is None or b is None: return None
    return round(a - b, 1)

signal_rows = []
all_sigs = [{'key': 'cycle', 'title': 'Cycle Index', 'cat': 'Cycle', 'unit': 'idx',
             'raw': [rnd((c[i] / c[0] - 1) * 100, 2) for i in range(N)], 'score': composite, 'inv': False}] + signals
for s in all_sigs:
    sc = s['score']
    hist = s['raw']
    last_score = sc[-1]
    spark = [x for x in sc[-260:] if x is not None]
    raw_series = [x for x in hist if x is not None]
    signal_rows.append({
        'key': s['key'], 'title': s['title'], 'cat': s['cat'], 'unit': s['unit'],
        'score': last_score, 'phase': phase_of(last_score),
        'raw': rnd(hist[-1], 4),
        'd7': delta(sc, 7), 'd30': delta(sc, 30), 'd90': delta(sc, 90), 'd365': delta(sc, 365),
        'min': rnd(min(raw_series), 3), 'max': rnd(max(raw_series), 3),
        'spark': [round(x, 1) for x in spark[-90:]],
        'spark1y': [round(x, 1) for x in (sc[-260:] if len(sc) >= 260 else sc) if x is not None],
    })
print('rows', len(signal_rows))
print([(r['title'], r['score'], r['phase'], r['d30']) for r in signal_rows[:6]])

# zone timeline: monthly last value of each score, last 12 years
mlast = [ (k, monthly[k][0], monthly[k][1]) for k in range(len(monthly)) ]
cols = [key for _, key, _ in mlast]
zrows = []
for s in all_sigs:
    sc = s['score']
    row = [None if sc[i] is None else int(round(sc[i])) for _, _, i in mlast]
    zrows.append({'key': s['key'], 'title': s['title'], 'v': row})
# keep every month since the start of the futures era
keep = 400
zt = {'cols': cols[-keep:], 'rows': [{'key': r['key'], 'title': r['title'], 'v': r['v'][-keep:]} for r in zrows]}

# breadth: signals bullish/top count
def breadth(category=None):
    cnt = {'Bottom': 0, 'Bearish': 0, 'Bullish': 0, 'Top': 0}
    for r in signal_rows:
        if r['phase']: cnt[r['phase']] += 1
    return cnt
br = breadth()

# ---- assemble the payload -------------------------------------------------
def col(vals, n=2):
    return [rnd(v, n) for v in vals]

series = {
    'dates': dates,
    'gold_ohlc': [[rnd(r['o'], 2), rnd(r['h'], 2), rnd(r['l'], 2), rnd(r['c'], 2)] for r in gold],
    'gold_close': col(c),
    'gold_open': col(o), 'gold_high': col(h), 'gold_low': col(l),
    'ma50': col(ma50), 'ma100': col(ma100), 'ma200': col(ma200),
    'ma50w': col(wma50_d), 'ma200w': col(wma200_d),
    'rsi14': col(rsi14, 1), 'rsiw': col(wrsi_d, 1),
    'bb_up': col(bb_up), 'bb_mid': col(bb_mid), 'bb_dn': col(bb_dn), 'bb_w': col(bb_w, 2),
    'macd': col(macd, 2), 'macd_sig': col(macd_sig, 2), 'macd_hist': col(macd_hist, 2),
    'vol30': col(vol30, 1), 'vol90': col(vol90, 1), 'vol365': col(vol365, 1),
    'atr14': col(atr14, 2),
    'z200': col(z200, 3),
    'drawdown': col(dd, 2),
    'mom30': col(mom30, 2), 'mom90': col(mom90, 2), 'mom180': col(mom180, 2), 'mom365': col(mom365, 2),
    'dist200': col(dist200, 2), 'dist200w': col(dist200w, 2),
    'gsr': col(gsr, 2), 'gpr': col(gpr, 2), 'gor': col(gor, 1), 'gcr': col(gcr, 4),
    'gdx_gold': col(gld_gdx, 4), 'gold_spx': col(gold_spx, 3),
    'dxy': col(dxy_s, 2), 'dxy_inv': col(dxy_inv, 3),
    'realyield': col(ry_ff, 2),
    'real_price': col(real_price, 2), 'real_dd': col(real_dd, 2),
    'silver_close': col([mx_silver.get(d) for d in dates], 3),
    'plat_close': col([mx_plat.get(d) for d in dates], 2),
    'oil_close': col([mx_oil.get(d) for d in dates], 2),
    'copper_close': col([mx_copper.get(d) for d in dates], 4),
    'gdx_close': col([mx_gdx.get(d) for d in dates], 3),
    'dxy_close': col([mx_dxy.get(d) for d in dates], 2),
    'xcag_dates': [r['d'] for r in silver],
    'spx_close': col([mx_spx.get(d) for d in dates], 2),
    'cagr_since1968': None,
}
# LBMA long history (weekly sampled to keep file small)
lb_dates = []; lb_vals = []
for i, r in enumerate(lbma):
    y, w, _ = dt.date.fromisoformat(r['d']).isocalendar()
    if i == 0 or (y, w) != tuple(dt.date.fromisoformat(lbma[i-1]['d']).isocalendar()[:2]):
        lb_dates.append(r['d']); lb_vals.append(rnd(r['c'], 2))
    else:
        lb_dates[-1] = r['d']; lb_vals[-1] = rnd(r['c'], 2)
series['lbma_dates'] = lb_dates
series['lbma_close'] = lb_vals

season = {
    'avg': [rnd(season_avg[m], 2) for m in range(1, 13)],
    'win': [rnd(season_win[m], 1) for m in range(1, 13)],
    'med': [rnd(season_med[m], 2) for m in range(1, 13)],
    'years': [y for y, _ in yearly],
    'yearly': [rnd(v, 1) for _, v in yearly],
    'matrix': mm,
}
print('season avg', season['avg'])
print('yearly', season['yearly'][-5:])

last = N - 1
prev_close = c[last - 1]
stats = {
    'built': dt.datetime.now().strftime('%Y-%m-%d %H:%M UTC+6'),
    'price': rnd(c[last], 2), 'date': dates[last],
    'prevClose': rnd(prev_close, 2),
    'change': rnd(c[last] - prev_close, 2),
    'changePct': rnd((c[last] / prev_close - 1) * 100, 2),
    'high52': rnd(max(c[-252:]), 2), 'low52': rnd(min(c[-252:]), 2),
    'ath': rnd(ath, 2), 'athDate': dates[ath_i],
    'athReal': rnd(real_ath, 2),
    'ytd': rnd((c[last] / c[dates.index([d for d in dates if d.startswith(dates[last][:4])][0])] - 1) * 100, 2),
    'cycle': composite[-1], 'phase': phase_of(composite[-1]),
    'breadth': br,
    'nSignals': len(signal_rows),
    'rsi': rnd(rsi14[-1], 1), 'vol30': rnd(vol30[-1], 1),
    'gsr': rnd(gsr[-1], 1), 'realyield': rnd(ry_ff[-1], 2),
    'cagr68': rnd(((c[-1] / lbma[0]['c']) ** (1 / ((dt.date.fromisoformat(dates[-1]) - dt.date.fromisoformat(lbma[0]['d'])).days / 365.25)) - 1) * 100, 2),
    'sources': ['COMEX gold futures (GC=F) daily OHLC via Yahoo Finance',
                'LBMA Gold PM auction (USD/oz) since 1968',
                'COMEX silver, platinum, copper; NYMEX crude; ICE US Dollar Index; NYSE Arca Gold Miners (GDX); S&P 500',
                'US CPI (CPIAUCSL) and 10Y TIPS real yield (DFII10) via FRED',
                'Live spot: gold-api.com XAU, Binance PAXG/XAUT'],
}

payload = {'stats': stats, 'series': series, 'signals': signal_rows, 'zonetimeline': zt, 'season': season,
           'signal_series': {s['key']: [None if s['score'][i] is None else int(round(s['score'][i])) for i in range(N)] for s in all_sigs},
           'signal_raw': {s['key']: col(s['raw'], 4) for s in all_sigs}}
os.makedirs(OUT_DIR, exist_ok=True)
js = 'window.NT_DATA = ' + json.dumps(payload, separators=(',', ':')) + ';\n'
with open(os.path.join(OUT_DIR, 'nt-data.js'), 'w', encoding='utf-8') as f:
    f.write(js)
print('wrote', len(js) / 1e6, 'MB')
print('stats', json.dumps(stats, indent=1)[:900])
