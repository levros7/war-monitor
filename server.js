const express = require('express');
const https = require('https');
const http  = require('http');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// Serve static files
app.use(express.static(path.join(__dirname)));

// Helper: fetch raw text (for RSS)
function fetchText(url) {
  return new Promise((resolve, reject) => {
    const lib = url.startsWith('https') ? https : http;
    const req = lib.get(url, {
      headers: { 'User-Agent': 'Mozilla/5.0', 'Accept': 'application/rss+xml,text/xml,*/*' },
      timeout: 8000,
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve(data));
    });
    req.on('error', reject);
    req.on('timeout', () => { req.destroy(); reject(new Error('Timeout')); });
  });
}

// Parse RSS XML items → [{title, link, pubDate}]
function parseRss(xml) {
  const items = [];
  const re = /<item>([\s\S]*?)<\/item>/g;
  let m;
  while ((m = re.exec(xml)) !== null) {
    const block = m[1];
    const get = (tag) => {
      const r = new RegExp(`<${tag}[^>]*>(?:<![\\[CDATA\\[)?(.*?)(?:\\]\\]>)?</${tag}>`, 's');
      return (r.exec(block) || [])[1]?.replace(/<!\[CDATA\[|\]\]>/g, '').trim() || '';
    };
    const title = get('title');
    const link  = get('link') || get('guid');
    const pub   = get('pubDate');
    if (title) items.push({ title, link, pubDate: pub });
  }
  return items;
}

// Helper: fetch URL server-side
function fetchJSON(url) {
  return new Promise((resolve, reject) => {
    const req = https.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
        'Accept': 'application/json',
      },
      timeout: 8000,
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try { resolve(JSON.parse(data)); }
        catch (e) { reject(new Error('Invalid JSON')); }
      });
    });
    req.on('error', reject);
    req.on('timeout', () => { req.destroy(); reject(new Error('Timeout')); });
  });
}

// /api/market?ticker=^GSPC  or  CL=F
app.get('/api/market', async (req, res) => {
  const { ticker } = req.query;
  if (!ticker) return res.status(400).json({ error: 'ticker required' });
  try {
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(ticker)}?interval=1d&range=5d`;
    const data = await fetchJSON(url);
    const result = data.chart.result[0];
    const closes = result.indicators.quote[0].close.filter(Boolean);
    const price = closes[closes.length - 1];
    const prevClose = result.meta.previousClose || closes[closes.length - 2];
    const change = ((price - prevClose) / prevClose) * 100;
    res.json({ price, change, history: closes });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// /api/btc — Bitcoin price via Binance (no rate limits)
app.get('/api/btc', async (req, res) => {
  try {
    const data = await fetchJSON('https://api.binance.com/api/v3/ticker/24hr?symbol=BTCUSDT');
    const price = parseFloat(data.lastPrice);
    const change = parseFloat(data.priceChangePercent);
    res.json({ price, change });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ============================================================
//  WAR STATUS API — ceasefire detection + live strike count
// ============================================================
let warStatus = {
  ceasefire: false,
  ceasefireHeadline: '',
  strikesDetected: 0,
  lastChecked: null,
};

app.get('/api/war-status', (req, res) => res.json(warStatus));

// Scan latest news for ceasefire signals and missile mentions
async function scanNewsForWarStatus() {
  const GNEWS_KEY = process.env.GNEWS_API_KEY || '';
  if (!GNEWS_KEY) return;
  try {
    const q = encodeURIComponent('Iran Israel war ceasefire missile 2026');
    const url = `https://gnews.io/api/v4/search?q=${q}&lang=en&max=10&sortby=publishedAt&apikey=${GNEWS_KEY}`;
    const data = await fetchJSON(url);
    const articles = data.articles || [];
    const CEASEFIRE = ['ceasefire','cease fire','peace deal','truce','armistice','agreement reached'];
    const MISSILES  = ['missile','ballistic','rocket','drone','barrage','salvo','strike','attack'];
    const cfHit = articles.find(a => CEASEFIRE.some(k => a.title.toLowerCase().includes(k)));
    const missileCount = articles.filter(a => MISSILES.some(k => a.title.toLowerCase().includes(k))).length;
    warStatus.ceasefire = !!cfHit;
    warStatus.ceasefireHeadline = cfHit ? cfHit.title : '';
    warStatus.strikesDetected += missileCount;
    warStatus.lastChecked = new Date().toISOString();
  } catch (e) { /* silent */ }
}

// Scan every 30 minutes
setInterval(scanNewsForWarStatus, 30 * 60 * 1000);
scanNewsForWarStatus();

// ============================================================
//  TELEGRAM BOT
// ============================================================
const TG_TOKEN   = process.env.TELEGRAM_BOT_TOKEN || '';
const TG_CHAT_ID = process.env.TELEGRAM_CHAT_ID   || '';

function sendTelegram(text) {
  if (!TG_TOKEN || !TG_CHAT_ID) return Promise.resolve();
  return new Promise((resolve) => {
    const body = JSON.stringify({ chat_id: TG_CHAT_ID, text, parse_mode: 'HTML' });
    const req = https.request({
      hostname: 'api.telegram.org',
      path: `/bot${TG_TOKEN}/sendMessage`,
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) },
    }, res => { res.resume(); resolve(); });
    req.on('error', resolve);
    req.write(body);
    req.end();
  });
}

// Fetch all market data for briefing
async function getMarketSnapshot() {
  const [btcRaw, spRaw, oilRaw] = await Promise.allSettled([
    fetchJSON('https://api.binance.com/api/v3/ticker/24hr?symbol=BTCUSDT'),
    fetchJSON(`https://query1.finance.yahoo.com/v8/finance/chart/%5EGSPC?interval=1d&range=2d`),
    fetchJSON(`https://query1.finance.yahoo.com/v8/finance/chart/CL%3DF?interval=1d&range=2d`),
  ]);

  const fmt = (n) => n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const sign = (n) => n >= 0 ? '▲' : '▼';

  let btcLine = '₿ Bitcoin: N/A';
  if (btcRaw.status === 'fulfilled') {
    const p = parseFloat(btcRaw.value.lastPrice);
    const c = parseFloat(btcRaw.value.priceChangePercent);
    btcLine = `₿ <b>Bitcoin:</b> $${fmt(p)}  ${sign(c)} ${Math.abs(c).toFixed(2)}%`;
  }

  let spLine = '📊 S&P 500: N/A';
  if (spRaw.status === 'fulfilled') {
    const closes = spRaw.value.chart.result[0].indicators.quote[0].close.filter(Boolean);
    const p = closes[closes.length - 1];
    const prev = spRaw.value.chart.result[0].meta.previousClose || closes[closes.length - 2];
    const c = ((p - prev) / prev) * 100;
    spLine = `📊 <b>S&P 500:</b> $${fmt(p)}  ${sign(c)} ${Math.abs(c).toFixed(2)}%`;
  }

  let oilLine = '🛢 WTI Oil: N/A';
  if (oilRaw.status === 'fulfilled') {
    const closes = oilRaw.value.chart.result[0].indicators.quote[0].close.filter(Boolean);
    const p = closes[closes.length - 1];
    const prev = oilRaw.value.chart.result[0].meta.previousClose || closes[closes.length - 2];
    const c = ((p - prev) / prev) * 100;
    oilLine = `🛢 <b>WTI Crude Oil:</b> $${fmt(p)}  ${sign(c)} ${Math.abs(c).toFixed(2)}%`;
  }

  return { btcLine, spLine, oilLine };
}

// Daily briefing — POST /api/telegram/briefing or scheduled
async function sendDailyBriefing() {
  const warStart = new Date('2026-02-28T00:00:00Z');
  const dayNum = Math.floor((Date.now() - warStart) / 86400000) + 1;
  const { btcLine, spLine, oilLine } = await getMarketSnapshot();
  const msg = [
    `🚨 <b>WAR MONITOR — DAY ${dayNum}</b>`,
    `📅 ${new Date().toUTCString()}`,
    '',
    `⚔️ <b>2026 Iran War Status</b>`,
    `🔴 War: ACTIVE  |  Strait of Hormuz: CLOSED`,
    `🔴 Ceasefire: NONE  |  Nuclear Sites: STRUCK`,
    '',
    `📈 <b>MARKET IMPACT</b>`,
    btcLine,
    spLine,
    oilLine,
    '',
    `🎯 <b>STRIKE TRACKER (2026)</b>`,
    `Missiles/Drones Launched: ~500+`,
    `Intercepted: ~450 (~90%)`,
    '',
    `🌐 <a href="https://vigilant-forgiveness-production-6c0f.up.railway.app">Open Live Dashboard</a>`,
  ].join('\n');
  await sendTelegram(msg);
}

// Scheduled briefing every day at 09:00 UTC
function scheduleDailyBriefing() {
  function msUntilNext9am() {
    const now = new Date();
    const next = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 9, 0, 0));
    if (next <= now) next.setUTCDate(next.getUTCDate() + 1);
    return next - now;
  }
  setTimeout(() => {
    sendDailyBriefing();
    setInterval(sendDailyBriefing, 24 * 60 * 60 * 1000);
  }, msUntilNext9am());
}

// Endpoint to trigger briefing manually
app.post('/api/telegram/briefing', async (req, res) => {
  await sendDailyBriefing();
  res.json({ ok: true });
});

// Telegram webhook — handle /status and /briefing commands
app.use(express.json());
app.post('/api/telegram/webhook', async (req, res) => {
  res.json({ ok: true }); // ack immediately
  const msg = req.body?.message;
  if (!msg) return;
  const text = (msg.text || '').trim().toLowerCase();
  const chatId = msg.chat.id.toString();

  // Helper to send to any chat
  async function reply(txt) {
    const body = JSON.stringify({ chat_id: chatId, text: txt, parse_mode: 'HTML' });
    return new Promise(resolve => {
      const req2 = https.request({
        hostname: 'api.telegram.org',
        path: `/bot${TG_TOKEN}/sendMessage`,
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) },
      }, r => { r.resume(); resolve(); });
      req2.on('error', resolve);
      req2.write(body);
      req2.end();
    });
  }

  const warStart = new Date('2026-02-28T00:00:00Z');
  const dayNum = Math.floor((Date.now() - warStart) / 86400000) + 1;

  if (text === '/start') {
    await reply(
      `🚨 <b>Welcome to War Monitor Bot</b>\n\n` +
      `Tracking the 2026 US-Israel vs Iran War in real time.\n\n` +
      `<b>Commands:</b>\n` +
      `/briefing — Full market + war status\n` +
      `/status — Same as /briefing\n` +
      `/help — Show commands\n\n` +
      `📅 Currently: War Day ${dayNum}\n` +
      `🔴 Status: ACTIVE  |  Hormuz: CLOSED\n\n` +
      `🌐 <a href="https://vigilant-forgiveness-production-6c0f.up.railway.app">Open Live Dashboard</a>`
    );
  } else if (text === '/briefing' || text === '/status') {
    const { btcLine, spLine, oilLine } = await getMarketSnapshot();
    await reply([
      `🚨 <b>WAR MONITOR — DAY ${dayNum}</b>`,
      `📅 ${new Date().toUTCString()}`,
      '',
      `⚔️ <b>2026 Iran War Status</b>`,
      `🔴 War: ACTIVE  |  Strait of Hormuz: CLOSED`,
      `🔴 Ceasefire: NONE  |  Nuclear Sites: STRUCK`,
      '',
      `📈 <b>MARKET IMPACT</b>`,
      btcLine, spLine, oilLine,
      '',
      `🎯 Missiles launched (2026): ~500+`,
      `✅ Intercepted: ~450 (~90%)`,
      '',
      `🌐 <a href="https://vigilant-forgiveness-production-6c0f.up.railway.app">Open Live Dashboard</a>`,
    ].join('\n'));
  } else if (text === '/help') {
    await reply(
      '🚨 <b>War Monitor Bot</b>\n\n' +
      '/briefing — Full market + war status\n' +
      '/status — Same as /briefing\n' +
      '/help — Show this message\n\n' +
      `📅 War Day ${dayNum} | 🔴 Conflict: ACTIVE\n\n` +
      `🌐 <a href="https://vigilant-forgiveness-production-6c0f.up.railway.app">Live Dashboard</a>`
    );
  }
});

if (TG_TOKEN && TG_CHAT_ID) scheduleDailyBriefing();

// ============================================================
//  LIVE MISSILE TRACKER
//  Scans RSS feeds every 2 min for launch/strike events
// ============================================================
const RSS_FEEDS = [
  'https://feeds.reuters.com/reuters/topNews',
  'https://www.timesofisrael.com/feed/',
  'https://rss.cnn.com/rss/edition_world.rss',
  'https://www.aljazeera.com/xml/rss/all.xml',
];

const MISSILE_KEYWORDS = [
  'missile', 'ballistic', 'rocket launched', 'rockets fired', 'drone attack',
  'drone strike', 'barrage', 'salvo', 'airstrike', 'air strike', 'bombardment',
  'fired at', 'launched at', 'attack on', 'struck', 'bombed', 'explosion',
];

const ORIGIN_MAP = [
  { keywords: ['iran','irgc','revolutionary guard','tehran'],          coords:[35.69,51.39], name:'Iran',          color:'#bc8cff' },
  { keywords: ['hezbollah','lebanon','beirut'],                        coords:[33.89,35.50], name:'Hezbollah/Lebanon', color:'#bc8cff' },
  { keywords: ['houthi','yemen','sanaa','hodeidah'],                   coords:[15.35,44.21], name:'Yemen (Houthi)', color:'#bc8cff' },
  { keywords: ['hamas','gaza','islamic jihad'],                        coords:[31.50,34.47], name:'Gaza',          color:'#bc8cff' },
  { keywords: ['israel','idf','israeli air force','israeli military'], coords:[32.08,34.78], name:'Israel',        color:'#3fb950' },
  { keywords: ['united states','u.s. military','pentagon','navy','american forces'], coords:[31.8,29.5], name:'US Forces', color:'#58a6ff' },
];

const TARGET_MAP = [
  { keywords: ['israel','tel aviv','haifa','jerusalem','ben gurion','ashkelon','ashdod'], coords:[32.08,34.78], name:'Israel' },
  { keywords: ['iran','tehran','natanz','isfahan','parchin','fordow'],                   coords:[35.69,51.39], name:'Iran' },
  { keywords: ['bahrain','manama'],                                                       coords:[26.22,50.59], name:'Bahrain' },
  { keywords: ['qatar','doha','al udeid'],                                                coords:[25.28,51.54], name:'Qatar' },
  { keywords: ['uae','dubai','abu dhabi','emirates'],                                     coords:[25.20,55.27], name:'UAE' },
  { keywords: ['kuwait'],                                                                  coords:[29.37,47.98], name:'Kuwait' },
  { keywords: ['saudi','riyadh'],                                                          coords:[24.69,46.72], name:'Saudi Arabia' },
  { keywords: ['iraq','baghdad'],                                                          coords:[33.33,44.44], name:'Iraq' },
  { keywords: ['syria','damascus'],                                                        coords:[33.51,36.29], name:'Syria' },
  { keywords: ['lebanon','beirut'],                                                        coords:[33.89,35.50], name:'Lebanon' },
];

const missileEvents = [];  // ring buffer — last 30 events
const _seenMissileTitles = new Set();

function extractLocation(title, map) {
  const t = title.toLowerCase();
  return map.find(entry => entry.keywords.some(k => t.includes(k))) || null;
}

function missileType(title) {
  const t = title.toLowerCase();
  if (t.includes('ballistic'))      return 'ballistic';
  if (t.includes('cruise'))         return 'cruise';
  if (t.includes('drone'))          return 'drone';
  if (t.includes('rocket'))         return 'rocket';
  if (t.includes('airstrike') || t.includes('air strike')) return 'airstrike';
  return 'missile';
}

async function scanRssForMissiles() {
  for (const feed of RSS_FEEDS) {
    try {
      const xml   = await fetchText(feed);
      const items = parseRss(xml);

      for (const item of items) {
        const t = item.title.toLowerCase();
        const isMissile = MISSILE_KEYWORDS.some(k => t.includes(k));
        if (!isMissile) continue;
        if (_seenMissileTitles.has(item.title)) continue;

        _seenMissileTitles.add(item.title);

        const origin = extractLocation(item.title, ORIGIN_MAP);
        const target = extractLocation(item.title, TARGET_MAP);

        const event = {
          id:         Date.now() + Math.random(),
          timestamp:  Date.now(),
          title:      item.title,
          url:        item.link,
          source:     feed.includes('reuters') ? 'Reuters' :
                      feed.includes('timesofisrael') ? 'Times of Israel' :
                      feed.includes('cnn') ? 'CNN' : 'Al Jazeera',
          type:       missileType(item.title),
          origin:     origin ? { name: origin.name, coords: origin.coords, color: origin.color } : null,
          target:     target ? { name: target.name, coords: target.coords } : null,
        };

        missileEvents.unshift(event);
        if (missileEvents.length > 30) missileEvents.pop();

        console.log(`[MissileTracker] NEW EVENT: ${item.title}`);

        // Immediate Telegram alert
        const tgText = `🚀 <b>MISSILE ALERT</b>\n\n` +
          `${item.title}\n\n` +
          (origin ? `📍 Origin: ${origin.name}\n` : '') +
          (target ? `🎯 Target: ${target.name}\n` : '') +
          `⚔️ Type: ${event.type.toUpperCase()}\n` +
          `<i>${event.source}</i>\n` +
          (item.link ? `<a href="${item.link}">Full Story</a>` : '');
        sendTelegram(tgText);
      }
    } catch (e) { /* silent per feed */ }
  }
}

// Scan every 2 minutes
setInterval(scanRssForMissiles, 2 * 60 * 1000);
scanRssForMissiles(); // immediate on boot

app.get('/api/missile-alerts', (req, res) => {
  const since = parseInt(req.query.since || '0');
  const events = since ? missileEvents.filter(e => e.timestamp > since) : missileEvents.slice(0, 10);
  res.json(events);
});

// /api/fear-greed — Crypto Fear & Greed Index (alternative.me, no key needed)
app.get('/api/fear-greed', async (req, res) => {
  try {
    const data = await fetchJSON('https://api.alternative.me/fng/?limit=7');
    const items = data.data || [];
    const current = items[0];
    res.json({
      value: parseInt(current.value),
      classification: current.value_classification,
      history: items.map(i => parseInt(i.value)).reverse(),
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// /api/events — live key events from GNews
const GNEWS_KEY = process.env.GNEWS_API_KEY || '';
app.get('/api/events', async (req, res) => {
  if (!GNEWS_KEY) return res.status(500).json({ error: 'No GNEWS_API_KEY set' });
  try {
    const q = encodeURIComponent('Iran Israel war 2026');
    const url = `https://gnews.io/api/v4/search?q=${q}&lang=en&max=10&sortby=publishedAt&apikey=${GNEWS_KEY}`;
    const data = await fetchJSON(url);
    const events = (data.articles || []).map(a => {
      const d = new Date(a.publishedAt);
      const date = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
      const title = a.title.toLowerCase();
      let actor = 'us';
      if (title.includes('iran') && !title.includes('israel') && !title.includes('us ') && !title.includes('united states')) actor = 'iran';
      else if (title.includes('israel') && !title.includes('iran') && !title.includes('us ') && !title.includes('united states')) actor = 'israel';
      return { date, actor, event: a.title, detail: a.source?.name || '', url: a.url };
    });
    res.json(events);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.listen(PORT, () => console.log(`War Monitor running on port ${PORT}`));
