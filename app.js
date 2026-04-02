// ============================================================
//  WAR MONITOR — app.js
//  APIs used:
//    BTC:   CoinGecko (free, no key)
//    S&P500 / Oil: Yahoo Finance via allorigins CORS proxy
//    News:  GNews API (free tier — add your key below)
// ============================================================

const GNEWS_API_KEY = 'YOUR_GNEWS_API_KEY'; // → https://gnews.io (free 100 req/day)
const REFRESH_MS = 60_000; // refresh every 60 seconds

// ============================================================
//  TIMELINE DATA (manually curated, key conflict events)
// ============================================================
const TIMELINE_EVENTS = [
  {
    date: 'Apr 1, 2024',
    actor: 'israel',
    event: 'Israel strikes Iranian consulate in Damascus, Syria',
    detail: '7 IRGC officers killed including senior commanders',
  },
  {
    date: 'Apr 13–14, 2024',
    actor: 'iran',
    event: 'Iran launches Operation True Promise — first direct attack on Israel',
    detail: '~300 drones, cruise missiles & ballistic missiles launched. >99% intercepted by Israel, US, UK & Jordan',
  },
  {
    date: 'Apr 19, 2024',
    actor: 'israel',
    event: 'Israel retaliates — strikes Isfahan Air Defense radar',
    detail: 'Limited strike, signalling capability without escalation',
  },
  {
    date: 'Oct 1, 2024',
    actor: 'iran',
    event: 'Iran launches Operation True Promise II',
    detail: '~180 ballistic missiles fired at Israel. US destroyers intercept dozens mid-flight',
  },
  {
    date: 'Oct 26, 2024',
    actor: 'israel',
    event: 'Israel strikes Iranian air-defense sites & military infrastructure',
    detail: 'S-300 batteries destroyed. Targets in Khuzestan, Tehran & Ilam provinces',
  },
  {
    date: 'Nov–Dec 2024',
    actor: 'us',
    event: 'US expands military presence — 2 carrier groups deployed to Eastern Mediterranean',
    detail: 'USS Gerald R. Ford & USS Dwight D. Eisenhower battle groups',
  },
  {
    date: 'Jan 2025',
    actor: 'iran',
    event: 'Houthi & Hezbollah proxy attacks continue on Red Sea shipping',
    detail: 'Over 100 commercial ships targeted since Oct 2023',
  },
  {
    date: 'Mar 2025',
    actor: 'us',
    event: 'US conducts strikes on Houthi positions in Yemen',
    detail: 'Targeting launch sites used for Red Sea attacks',
  },
  {
    date: 'Apr 2025',
    actor: 'iran',
    event: 'Iran nuclear program reaches 84% uranium enrichment',
    detail: 'IAEA reports near-weapons-grade enrichment level',
  },
];

// ============================================================
//  RENDER TIMELINE
// ============================================================
function renderTimeline() {
  const container = document.getElementById('timeline');
  const items = [...TIMELINE_EVENTS].reverse(); // newest first
  container.innerHTML = items.map(e => `
    <div class="tl-item ${e.actor}">
      <div class="tl-date">${e.date}</div>
      <span class="tl-actor ${e.actor}">${e.actor.toUpperCase()}</span>
      <div class="tl-event">${e.event}</div>
      ${e.detail ? `<div class="tl-detail">${e.detail}</div>` : ''}
    </div>
  `).join('');
}

// ============================================================
//  SPARKLINE HELPER
// ============================================================
function sparkline(containerId, values, color) {
  const el = document.getElementById(containerId);
  if (!el || values.length < 2) return;
  const w = 200, h = 40;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  const pts = values.map((v, i) => {
    const x = (i / (values.length - 1)) * w;
    const y = h - ((v - min) / range) * (h - 4) - 2;
    return `${x},${y}`;
  }).join(' ');
  el.innerHTML = `
    <svg viewBox="0 0 ${w} ${h}" preserveAspectRatio="none">
      <polyline points="${pts}" fill="none" stroke="${color}" stroke-width="1.5" stroke-linejoin="round" />
    </svg>`;
}

// ============================================================
//  MARKET CARD UPDATER
// ============================================================
let prevBTC = null, prevSP = null, prevOil = null;

function updateCard(id, priceEl, changeEl, price, change, symbol, prev, sparkId, upColor = '#3fb950') {
  const card = document.getElementById(id);
  const pEl = document.getElementById(priceEl);
  const cEl = document.getElementById(changeEl);

  if (!pEl || !cEl) return;

  const formattedPrice = symbol === '$'
    ? `$${price.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
    : `$${price.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  const sign = change >= 0 ? '+' : '';
  const changeClass = change > 0 ? 'up' : change < 0 ? 'down' : 'flat';

  // Flash animation on price change
  if (prev !== null && price !== prev) {
    pEl.classList.remove('flash-up', 'flash-down');
    void pEl.offsetWidth;
    pEl.classList.add(price > prev ? 'flash-up' : 'flash-down');
  }

  pEl.textContent = formattedPrice;
  cEl.textContent = `${sign}${change.toFixed(2)}%`;
  cEl.className = `card-change ${changeClass}`;

  if (card) {
    card.className = 'card market-card ' + changeClass;
  }
}

// ============================================================
//  FETCH BITCOIN (CoinGecko — no API key needed)
// ============================================================
async function fetchBTC() {
  try {
    const res = await fetch(
      'https://api.coingecko.com/api/v3/simple/price?ids=bitcoin&vs_currencies=usd&include_24hr_change=true&include_sparkline_7d=false',
      { signal: AbortSignal.timeout(8000) }
    );
    const data = await res.json();
    const price = data.bitcoin.usd;
    const change = data.bitcoin.usd_24h_change;
    updateCard('btc-card', 'btc-price', 'btc-change', price, change, '$', prevBTC, 'btc-spark');
    prevBTC = price;
  } catch (e) {
    document.getElementById('btc-price').textContent = 'Error';
    console.warn('BTC fetch failed:', e.message);
  }
}

// ============================================================
//  FETCH S&P500 & OIL via Yahoo Finance + allorigins proxy
// ============================================================
async function fetchYahoo(ticker) {
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(ticker)}?interval=1d&range=5d`;
  const proxy = `https://api.allorigins.win/get?url=${encodeURIComponent(url)}`;
  const res = await fetch(proxy, { signal: AbortSignal.timeout(10000) });
  const wrapper = await res.json();
  return JSON.parse(wrapper.contents);
}

async function fetchSP500() {
  try {
    const data = await fetchYahoo('^GSPC');
    const result = data.chart.result[0];
    const quotes = result.indicators.quote[0].close.filter(Boolean);
    const price = quotes[quotes.length - 1];
    const prevClose = result.meta.previousClose || quotes[quotes.length - 2];
    const change = ((price - prevClose) / prevClose) * 100;
    updateCard('sp500-card', 'sp500-price', 'sp500-change', price, change, '$', prevSP, 'sp500-spark');
    sparkline('sp500-spark', quotes, change >= 0 ? '#3fb950' : '#f85149');
    prevSP = price;
  } catch (e) {
    document.getElementById('sp500-price').textContent = 'Error';
    console.warn('S&P500 fetch failed:', e.message);
  }
}

async function fetchOil() {
  try {
    const data = await fetchYahoo('CL=F');
    const result = data.chart.result[0];
    const quotes = result.indicators.quote[0].close.filter(Boolean);
    const price = quotes[quotes.length - 1];
    const prevClose = result.meta.previousClose || quotes[quotes.length - 2];
    const change = ((price - prevClose) / prevClose) * 100;
    updateCard('oil-card', 'oil-price', 'oil-change', price, change, '$', prevOil, 'oil-spark');
    sparkline('oil-spark', quotes, '#e3693a');
    prevOil = price;
  } catch (e) {
    document.getElementById('oil-price').textContent = 'Error';
    console.warn('Oil fetch failed:', e.message);
  }
}

// ============================================================
//  FETCH NEWS (GNews API)
// ============================================================
const FALLBACK_NEWS = [
  { title: 'Iran vows retaliation after Israeli strikes on military sites', source: 'Reuters', date: 'Apr 2, 2026', url: '#' },
  { title: 'US deploys additional Patriot batteries to Israel amid escalation', source: 'AP News', date: 'Apr 1, 2026', url: '#' },
  { title: 'Oil prices surge 4% on fears of Iran-Israel escalation closing Strait of Hormuz', source: 'Bloomberg', date: 'Mar 31, 2026', url: '#' },
  { title: 'IAEA: Iran enriching uranium at record pace, approaching weapons-grade', source: 'FT', date: 'Mar 30, 2026', url: '#' },
  { title: 'Bitcoin drops 6% as Middle East tensions spike risk-off sentiment', source: 'CoinDesk', date: 'Mar 29, 2026', url: '#' },
  { title: 'Israel Air Force on highest readiness since Oct 7', source: 'Haaretz', date: 'Mar 28, 2026', url: '#' },
];

async function fetchNews() {
  const grid = document.getElementById('news-grid');

  if (GNEWS_API_KEY === 'YOUR_GNEWS_API_KEY') {
    renderNewsCards(FALLBACK_NEWS, grid, true);
    return;
  }

  try {
    const q = encodeURIComponent('Iran Israel war missile attack');
    const url = `https://gnews.io/api/v4/search?q=${q}&lang=en&max=6&apikey=${GNEWS_API_KEY}`;
    const res = await fetch(url, { signal: AbortSignal.timeout(8000) });
    const data = await res.json();
    const articles = (data.articles || []).map(a => ({
      title: a.title,
      source: a.source?.name || 'News',
      date: new Date(a.publishedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
      url: a.url,
    }));
    renderNewsCards(articles.length ? articles : FALLBACK_NEWS, grid, !articles.length);
  } catch (e) {
    renderNewsCards(FALLBACK_NEWS, grid, true);
    console.warn('News fetch failed:', e.message);
  }
}

function renderNewsCards(articles, grid, isFallback) {
  grid.innerHTML = articles.map(a => `
    <a class="news-card" href="${a.url}" target="_blank" rel="noopener noreferrer">
      <div class="news-source">${a.source}${isFallback ? ' · SAMPLE DATA' : ''}</div>
      <div class="news-title">${a.title}</div>
      <div class="news-date">${a.date}</div>
    </a>
  `).join('');
}

// ============================================================
//  UPDATE TIMESTAMP
// ============================================================
function updateTimestamp() {
  const el = document.getElementById('last-update');
  if (el) el.textContent = new Date().toLocaleTimeString();
}

// ============================================================
//  ANIMATE COUNTERS
// ============================================================
function animateCounter(id, target, duration = 1200) {
  const el = document.getElementById(id);
  if (!el) return;
  const start = 0;
  const startTime = performance.now();
  function step(now) {
    const elapsed = now - startTime;
    const progress = Math.min(elapsed / duration, 1);
    const eased = 1 - Math.pow(1 - progress, 3);
    el.textContent = Math.round(start + (target - start) * eased);
    if (progress < 1) requestAnimationFrame(step);
  }
  requestAnimationFrame(step);
}

// ============================================================
//  MAIN REFRESH LOOP
// ============================================================
async function refresh() {
  updateTimestamp();
  await Promise.allSettled([fetchBTC(), fetchSP500(), fetchOil(), fetchNews()]);
}

// ============================================================
//  INIT
// ============================================================
document.addEventListener('DOMContentLoaded', () => {
  renderTimeline();

  // Animate strike counters on load
  animateCounter('total-launched', 247);
  animateCounter('total-intercepted', 198, 1400);
  animateCounter('total-incidents', 14, 900);
  animateCounter('us-assets', 2, 600);

  // First data fetch
  refresh();

  // Auto-refresh
  setInterval(refresh, REFRESH_MS);
});
