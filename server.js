const express = require('express');
const https = require('https');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// Serve static files
app.use(express.static(path.join(__dirname)));

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

// /api/btc — Bitcoin price via CoinGecko
app.get('/api/btc', async (req, res) => {
  try {
    const data = await fetchJSON(
      'https://api.coingecko.com/api/v3/simple/price?ids=bitcoin&vs_currencies=usd&include_24hr_change=true'
    );
    res.json({ price: data.bitcoin.usd, change: data.bitcoin.usd_24h_change });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

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
    fetchJSON('https://api.coingecko.com/api/v3/simple/price?ids=bitcoin&vs_currencies=usd&include_24hr_change=true'),
    fetchJSON(`https://query1.finance.yahoo.com/v8/finance/chart/%5EGSPC?interval=1d&range=2d`),
    fetchJSON(`https://query1.finance.yahoo.com/v8/finance/chart/CL%3DF?interval=1d&range=2d`),
  ]);

  const fmt = (n) => n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const sign = (n) => n >= 0 ? '▲' : '▼';

  let btcLine = '₿ Bitcoin: N/A';
  if (btcRaw.status === 'fulfilled') {
    const p = btcRaw.value.bitcoin.usd;
    const c = btcRaw.value.bitcoin.usd_24h_change;
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
