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
