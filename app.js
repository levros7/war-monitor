// ============================================================
//  WAR MONITOR — app.js
//  APIs used:
//    BTC:   CoinGecko (free, no key)
//    S&P500 / Oil: Yahoo Finance via allorigins CORS proxy
//    News:  GNews API (free tier — add your key below)
// ============================================================

const GNEWS_API_KEY = '1a32d5631729d69af83a627f5d660a79';
const REFRESH_MS = 60_000; // refresh every 60 seconds

// ============================================================
//  TIMELINE DATA (manually curated, key conflict events)
// ============================================================
const TIMELINE_EVENTS = [
  {
    date: 'Feb 28, 2026',
    actor: 'us',
    event: 'Operation Epic Fury begins — US & Israel launch joint strikes on Iran',
    detail: 'B-2 bombers, Tomahawks & ~200 fighter jets strike Tehran, Natanz & military HQs. Supreme Leader Khamenei killed in targeted strike.',
  },
  {
    date: 'Feb 28, 2026',
    actor: 'iran',
    event: 'Iran launches Operation True Promise IV — retaliatory barrage',
    detail: '~170 ballistic missiles & drones fired at Israel and Gulf states. US 5th Fleet HQ in Bahrain struck. Dubai & Abu Dhabi airports hit.',
  },
  {
    date: 'Mar 1, 2026',
    actor: 'iran',
    event: 'Iranian missiles breach Israeli defenses — 9 killed in Beit Shemesh synagogue',
    detail: 'Iranian state media confirms Khamenei\'s death. Mojtaba Khamenei begins consolidating power.',
  },
  {
    date: 'Mar 2, 2026',
    actor: 'iran',
    event: 'Strait of Hormuz officially closed by IRGC',
    detail: 'Natanz nuclear facility damaged. Iran strikes Qatar\'s LNG facilities. 6 US service members killed in Kuwait.',
  },
  {
    date: 'Mar 3, 2026',
    actor: 'us',
    event: 'Conflict expands to 9 countries — Iranian submarine & corvette sunk',
    detail: 'IRIS Fateh submarine destroyed — first submarine sunk in combat since Falklands War (1982). Mojtaba Khamenei elected new Supreme Leader.',
  },
  {
    date: 'Mar 18, 2026',
    actor: 'israel',
    event: 'Israel strikes South Pars gas field & kills Iranian Intelligence Minister Khatib',
    detail: 'Iran retaliates by attacking Qatar\'s LNG production facility — world\'s largest.',
  },
  {
    date: 'Mar 21, 2026',
    actor: 'us',
    event: 'US & Israel strike Natanz nuclear enrichment complex with bunker-busters',
    detail: 'IAEA confirms attack and warns against striking nuclear facilities due to radiation risks.',
  },
  {
    date: 'Mar 22, 2026',
    actor: 'us',
    event: 'Trump issues 48-hour ultimatum: reopen Strait of Hormuz or face energy strikes',
    detail: 'Deadline later extended to April 6 as indirect talks begin via Pakistan.',
  },
  {
    date: 'Mar 26, 2026',
    actor: 'israel',
    event: 'Israel kills IRGC Navy Chief Tangsiri & strikes Arak nuclear reactor',
    detail: 'Tangsiri commanded Strait of Hormuz blockade. Arak heavy water reactor and Yazd yellowcake plant also struck.',
  },
  {
    date: 'Apr 1, 2026',
    actor: 'us',
    event: 'Trump addresses nation — warns Iran will be bombed "back to the Stone Ages"',
    detail: 'Trump claims Iran asked for ceasefire; Iran immediately denies. Intelligence assessment: only 1 of 3 nuclear sites fully destroyed.',
  },
  {
    date: 'Apr 2, 2026',
    actor: 'us',
    event: 'Trump pauses energy strikes through Apr 6 — Britain convenes 35 nations on Hormuz',
    detail: 'Iran\'s president releases open letter to American people. War ongoing. No ceasefire in effect.',
  },
];

// ============================================================
//  RENDER TIMELINE
// ============================================================
function renderTimeline(events) {
  const container = document.getElementById('timeline');
  const items = [...events].reverse(); // newest first
  container.innerHTML = items.map(e => `
    <div class="tl-item ${e.actor}">
      <div class="tl-date">${e.date}</div>
      <span class="tl-actor ${e.actor}">${e.actor.toUpperCase()}</span>
      <div class="tl-event">${e.url ? `<a href="${e.url}" target="_blank" rel="noopener" style="color:inherit;text-decoration:underline dotted">${e.event}</a>` : e.event}</div>
      ${e.detail ? `<div class="tl-detail">${e.detail}</div>` : ''}
    </div>
  `).join('');
}

async function fetchAndRenderTimeline() {
  try {
    const res = await fetch('/api/events', { signal: AbortSignal.timeout(8000) });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const events = await res.json();
    if (events.length) {
      renderTimeline(events);
      return;
    }
  } catch (e) {
    console.warn('Live events fetch failed, using static data:', e.message);
  }
  renderTimeline(TIMELINE_EVENTS);
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
    const res = await fetch('/api/btc', { signal: AbortSignal.timeout(8000) });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    updateCard('btc-card', 'btc-price', 'btc-change', data.price, data.change, '$', prevBTC, 'btc-spark');
    prevBTC = data.price;
  } catch (e) {
    document.getElementById('btc-price').textContent = 'Error';
    console.warn('BTC fetch failed:', e.message);
  }
}

// ============================================================
//  FETCH S&P500 & OIL via local server API (server.js)
// ============================================================
async function fetchMarket(ticker) {
  const res = await fetch(`/api/market?ticker=${encodeURIComponent(ticker)}`, {
    signal: AbortSignal.timeout(10000),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

async function fetchSP500() {
  try {
    const data = await fetchMarket('^GSPC');
    updateCard('sp500-card', 'sp500-price', 'sp500-change', data.price, data.change, '$', prevSP, 'sp500-spark');
    sparkline('sp500-spark', data.history, data.change >= 0 ? '#3fb950' : '#f85149');
    prevSP = data.price;
  } catch (e) {
    document.getElementById('sp500-price').textContent = 'Error';
    console.warn('S&P500 fetch failed:', e.message);
  }
}

async function fetchOil() {
  try {
    const data = await fetchMarket('CL=F');
    updateCard('oil-card', 'oil-price', 'oil-change', data.price, data.change, '$', prevOil, 'oil-spark');
    sparkline('oil-spark', data.history, '#e3693a');
    prevOil = data.price;
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
  await Promise.allSettled([fetchBTC(), fetchSP500(), fetchOil(), fetchNews(), fetchAndRenderTimeline()]);
}

// ============================================================
//  INIT
// ============================================================
// ============================================================
//  WAR DAY COUNTER
// ============================================================
function updateWarDay() {
  const start = new Date('2026-02-28T00:00:00Z');
  const now = new Date();
  const day = Math.floor((now - start) / (1000 * 60 * 60 * 24)) + 1;
  const el = document.getElementById('war-day');
  if (el) { el.textContent = `DAY ${day}`; el.className = 'status-value red'; }
}

document.addEventListener('DOMContentLoaded', () => {
  fetchAndRenderTimeline();
  updateWarDay();

  // Animate strike counters on load
  animateCounter('total-launched', 500);
  animateCounter('total-intercepted', 450, 1400);
  animateCounter('total-incidents', 1, 900);
  animateCounter('us-assets', 2, 600);

  // First data fetch
  refresh();

  // Auto-refresh
  setInterval(refresh, REFRESH_MS);
});
