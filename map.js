// ============================================================
//  map.js — OSINT Conflict Map
//  Visual style inspired by professional threat-tracking dashboards:
//  - Comet trail animation (bright head + fading trail)
//  - Impact cluster dots that accumulate at target locations
//  - No static arc lines — only live missile animations
// ============================================================

const HISTORICAL_STRIKES = [
  // Iran → Israel
  { date: 'Feb 28', from: [35.52, 51.77], to: [32.08, 34.78], actor: 'IRGC', label: 'IRGC — ~170 ballistic missiles fired at Israel', type: 'ballistic' },
  { date: 'Feb 28', from: [35.52, 51.77], to: [32.82, 35.00], actor: 'IRGC', label: 'IRGC ballistic missiles — Haifa', type: 'ballistic' },
  { date: 'Feb 28', from: [34.32, 47.07], to: [32.08, 34.78], actor: 'IRGC', label: 'IRGC mobile launchers — Tel Aviv barrage', type: 'ballistic' },
  { date: 'Mar 1',  from: [35.52, 51.77], to: [31.72, 34.99], actor: 'IRGC', label: 'Iranian missiles breach Iron Dome — Beit Shemesh struck', type: 'ballistic' },
  { date: 'Apr 3',  from: [35.52, 51.77], to: [32.90, 35.30], actor: 'IRGC', label: 'Iranian attack — cluster munitions, northern Israel', type: 'missile' },
  { date: 'Feb 28', from: [38.08, 46.30], to: [32.08, 34.78], actor: 'IRGC', label: 'Tabriz IRGC base — northern salvo at Israel', type: 'ballistic' },

  // Iran → Gulf states
  { date: 'Feb 28', from: [31.32, 48.67], to: [26.22, 50.59], actor: 'IRGC', label: 'Iran strikes US 5th Fleet HQ — Manama, Bahrain', type: 'missile' },
  { date: 'Feb 28', from: [31.32, 48.67], to: [25.20, 55.27], actor: 'IRGC', label: 'Iran hits Dubai & Abu Dhabi airports (UAE)', type: 'missile' },
  { date: 'Mar 2',  from: [31.32, 48.67], to: [25.28, 51.54], actor: 'IRGC', label: 'Iran strikes Qatar LNG facilities — Doha', type: 'missile' },
  { date: 'Mar 2',  from: [31.32, 48.67], to: [29.37, 47.98], actor: 'IRGC', label: 'Iran strikes US bases in Kuwait — 6 killed', type: 'missile' },
  { date: 'Mar 18', from: [31.32, 48.67], to: [25.28, 51.54], actor: 'IRGC', label: 'Iran retaliates — Qatar LNG production facility struck', type: 'missile' },

  // Houthi → Israel
  { date: 'Feb 28', from: [15.35, 44.21], to: [32.08, 34.78], actor: 'Houthi', label: 'Houthi ballistic salvo — Tel Aviv', type: 'ballistic' },
  { date: 'Mar 5',  from: [14.80, 42.95], to: [32.08, 34.78], actor: 'Houthi', label: 'Houthi coastal battery — Tel Aviv barrage', type: 'ballistic' },
  { date: 'Mar 12', from: [15.35, 44.21], to: [29.54, 34.95], actor: 'Houthi', label: 'Houthi missiles — Eilat / Red Sea', type: 'ballistic' },

  // Hezbollah → Israel
  { date: 'Mar 2',  from: [33.89, 35.50], to: [32.82, 35.00], actor: 'Hezbollah', label: 'Hezbollah rocket barrage — northern Israel (Haifa)', type: 'rocket' },
  { date: 'Mar 2',  from: [33.27, 35.57], to: [32.96, 35.50], actor: 'Hezbollah', label: 'Hezbollah rockets — Kiryat Shmona & Safed', type: 'rocket' },
  { date: 'Apr 2',  from: [33.89, 35.50], to: [32.08, 34.78], actor: 'Hezbollah', label: 'Hezbollah long-range rocket salvo — Tel Aviv area', type: 'rocket' },

  // IDF → Iran
  { date: 'Feb 28', from: [31.21, 35.01], to: [35.69, 51.39], actor: 'IDF', label: 'IDF/USAF strike Tehran command centers', type: 'airstrike' },
  { date: 'Feb 28', from: [31.21, 35.01], to: [33.72, 51.93], actor: 'IDF', label: 'IDF strikes Natanz nuclear enrichment complex', type: 'airstrike' },
  { date: 'Feb 28', from: [31.21, 35.01], to: [32.63, 51.68], actor: 'IDF', label: 'IDF strikes Isfahan missile base', type: 'airstrike' },
  { date: 'Mar 18', from: [31.21, 35.01], to: [27.13, 52.62], actor: 'IDF', label: 'IDF strikes South Pars gas field', type: 'airstrike' },
  { date: 'Mar 21', from: [31.21, 35.01], to: [33.72, 51.93], actor: 'IDF', label: 'IDF + US strike Natanz with bunker-busters', type: 'airstrike' },
  { date: 'Mar 26', from: [31.21, 35.01], to: [35.69, 51.39], actor: 'IDF', label: 'IDF kills IRGC Navy Chief Tangsiri — Tehran', type: 'airstrike' },
  { date: 'Mar 26', from: [31.21, 35.01], to: [34.10, 49.78], actor: 'IDF', label: 'IDF strikes Arak heavy water reactor', type: 'airstrike' },
  { date: 'Apr 1',  from: [31.21, 35.01], to: [35.69, 51.39], actor: 'IDF', label: 'IDF strikes Tehran — energy infrastructure', type: 'airstrike' },
  { date: 'Apr 3',  from: [31.21, 35.01], to: [35.69, 51.39], actor: 'IDF', label: 'IAF hits petrochemicals, air defense & missile sites — Tehran', type: 'airstrike' },
  { date: 'Mar 26', from: [31.84, 34.82], to: [31.90, 54.37], actor: 'IDF', label: 'IDF strikes Yazd yellowcake plant', type: 'airstrike' },

  // US → Iran
  { date: 'Feb 28', from: [21.48, 39.19], to: [35.69, 51.39], actor: 'USN', label: 'US Tomahawk cruise missiles (Red Sea) strike Tehran', type: 'missile' },
  { date: 'Mar 21', from: [25.50, 57.80], to: [33.72, 51.93], actor: 'USN', label: 'US Navy — Natanz bunker-buster strike', type: 'airstrike' },
  { date: 'Mar 3',  from: [25.50, 57.80], to: [26.50, 56.30], actor: 'USN', label: 'US Navy sinks IRIS Fateh submarine — Strait of Hormuz', type: 'strike' },
];

const ACTOR_COLOR = {
  Iran: '#f85149', IRGC: '#f85149',
  Israel: '#3fb950', IDF: '#3fb950',
  US: '#58a6ff', USN: '#58a6ff',
  Houthi: '#ff6b35',
  Hezbollah: '#e3693a',
};

// ── PATH HELPERS ──────────────────────────────────────────────
function arcPath(from, to, steps = 80) {
  const pts  = [];
  const dlat = to[0] - from[0];
  const dlng = to[1] - from[1];
  const dist = Math.sqrt(dlat * dlat + dlng * dlng);
  const bow  = Math.min(Math.max(dist * 0.18, 1.8), 5.5);
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    pts.push([from[0] + dlat * t + Math.sin(Math.PI * t) * bow, from[1] + dlng * t]);
  }
  return pts;
}

function arcDist(from, to) {
  return Math.sqrt(Math.pow(to[0] - from[0], 2) + Math.pow(to[1] - from[1], 2));
}

// ── COMET TRAIL ANIMATION ─────────────────────────────────────
// Bright glowing head + fading trail dots — matches professional tracker style
function animateComet(map, path, color, duration, onComplete) {
  if (path.length < 2) return;

  const TRAIL = 10;   // trail length in steps
  const trail = [];   // active trail markers
  let step = 0;

  const iv = setInterval(() => {
    if (step >= path.length) {
      clearInterval(iv);
      trail.forEach(m => { try { map.removeLayer(m); } catch (_) {} });
      if (onComplete) onComplete();
      return;
    }

    // Add new head marker
    const isHead = true;
    const m = L.circleMarker(path[step], {
      radius: 5, color: 'white', fillColor: color,
      fillOpacity: 1.0, opacity: 0.9, weight: 1,
      className: 'comet-head',
    }).addTo(map);
    trail.push(m);

    // Fade and shrink older trail markers
    for (let i = 0; i < trail.length; i++) {
      const age = trail.length - 1 - i;
      if (age > TRAIL) {
        try { map.removeLayer(trail[i]); } catch (_) {}
      } else if (age > 0) {
        const fade = 1 - age / TRAIL;
        trail[i].setStyle({
          radius: Math.max(1.5, 5 * fade),
          fillOpacity: fade * 0.85,
          opacity: fade * 0.5,
          fillColor: color,
          color: color,
          weight: 0,
        });
      }
    }

    // Remove markers beyond trail length from array
    while (trail.length > TRAIL + 2) {
      trail.shift();
    }

    step++;
  }, duration / path.length);
}

// ── IMPACT FLASH ──────────────────────────────────────────────
function impactFlash(map, latlng, color) {
  // Expanding ring effect
  const ring = L.circleMarker(latlng, {
    radius: 8, color, fillColor: color, fillOpacity: 0.6, weight: 2,
  }).addTo(map);

  let r = 8, fade = 0.6;
  const iv = setInterval(() => {
    r += 3; fade -= 0.12;
    if (fade <= 0) { clearInterval(iv); try { map.removeLayer(ring); } catch (_) {} return; }
    ring.setStyle({ radius: r, fillOpacity: fade, opacity: fade * 0.8 });
  }, 60);

  // Leave a small persistent dot at impact site
  const dot = L.circleMarker(latlng, {
    radius: 3, color, fillColor: color, fillOpacity: 0.7, weight: 0,
  }).addTo(map);
  setTimeout(() => { try { map.removeLayer(dot); } catch (_) {} }, 25000);
}

// ── INIT MAP ──────────────────────────────────────────────────
function initMap() {
  const map = L.map('conflict-map', {
    center: [31.5, 42.0],
    zoom: 4,
    zoomControl: false,
    attributionControl: false,
  });

  // Dark minimal tile — very close to reference site style
  L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_nolabels/{z}/{x}/{y}{r}.png', {
    maxZoom: 19, subdomains: 'abcd',
  }).addTo(map);

  // Subtle country label layer on top
  L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_only_labels/{z}/{x}/{y}{r}.png', {
    maxZoom: 19, subdomains: 'abcd', opacity: 0.4,
  }).addTo(map);

  L.control.zoom({ position: 'topright' }).addTo(map);

  // ── LEGEND ───────────────────────────────────────────────────
  const legend = L.control({ position: 'bottomleft' });
  legend.onAdd = () => {
    const div = L.DomUtil.create('div');
    div.style.cssText = `background:rgba(13,17,23,0.85);border:1px solid #21262d;
      border-radius:6px;padding:8px 12px;font-family:'SF Mono',monospace;
      font-size:11px;color:#e6edf3;line-height:1.8;`;
    div.innerHTML = `
      <div style="color:#8b949e;font-size:10px;margin-bottom:4px;letter-spacing:.05em">ACTORS</div>
      <div><span style="color:#f85149">●</span> Iran / IRGC</div>
      <div><span style="color:#3fb950">●</span> Israel / IDF</div>
      <div><span style="color:#58a6ff">●</span> US Forces</div>
      <div><span style="color:#ff6b35">●</span> Houthi / Yemen</div>
      <div><span style="color:#e3693a">●</span> Hezbollah</div>
      <hr style="border-color:#21262d;margin:5px 0">
      <div id="map-live-status" style="color:#3fb950;font-size:10px">● Scanning RSS...</div>
    `;
    return div;
  };
  legend.addTo(map);

  // ── REPLAY CONFIRMED HISTORICAL STRIKES ──────────────────────
  let replayIdx = 0;

  function replayNextStrike() {
    const strike   = HISTORICAL_STRIKES[replayIdx % HISTORICAL_STRIKES.length];
    replayIdx++;

    const path     = arcPath(strike.from, strike.to);
    const color    = ACTOR_COLOR[strike.actor] || '#f85149';
    const dist     = arcDist(strike.from, strike.to);
    const intercepted = strike.type !== 'airstrike' && strike.type !== 'strike' && Math.random() < 0.85;

    // Speed: short range slower, long range faster
    const duration = dist < 3  ? 2800 + Math.random() * 1000
                   : dist < 10 ? 4000 + Math.random() * 2000
                   :             5500 + Math.random() * 3000;

    if (intercepted) {
      const cutoff  = Math.floor(path.length * (0.5 + Math.random() * 0.3));
      const partial = path.slice(0, cutoff);
      animateComet(map, partial, color, duration * 0.7, () => {
        // Green intercept flash
        const m = L.circleMarker(partial[partial.length - 1], {
          radius: 6, color: '#3fb950', fillColor: '#3fb950', fillOpacity: 0.8, weight: 0,
        }).addTo(map);
        setTimeout(() => { try { map.removeLayer(m); } catch (_) {} }, 800);
      });
    } else {
      animateComet(map, path, color, duration, () => {
        impactFlash(map, strike.to, color);
      });
    }

    // Next missile: stagger 3 streams for constant activity
    setTimeout(replayNextStrike, 1800 + Math.random() * 2000);
  }

  // 3 staggered streams — always 2-3 missiles visible simultaneously
  replayNextStrike();
  setTimeout(replayNextStrike, 700);
  setTimeout(replayNextStrike, 1400);

  // ── LIVE RSS-DETECTED EVENTS ──────────────────────────────────
  let lastAlertTs = 0;

  function flashLaunchBanner(title, originName, targetName) {
    const banner = document.getElementById('live-launch-banner');
    if (!banner) return;
    const icon = title.toLowerCase().includes('drone')    ? '🛸' :
                 title.toLowerCase().includes('ballistic') ? '🚀' :
                 title.toLowerCase().includes('rocket')    ? '💥' : '✈️';
    banner.innerHTML = `${icon} <b>LIVE STRIKE DETECTED</b> — ${title}` +
      (originName ? ` · <b>${originName}</b>` : '') +
      (targetName ? ` ➜ <b>${targetName}</b>` : '');
    banner.style.display = 'block';
    setTimeout(() => { banner.style.display = 'none'; }, 20000);
  }

  function animateLiveEvent(event) {
    let from, to, color;
    if (event.origin && event.target) {
      const oc = event.origin.coords, tc = event.target.coords;
      if (oc[0] === tc[0] && oc[1] === tc[1]) return;
      from = oc; to = tc;
      color = event.origin.color || '#f85149';
    } else if (event.origin) {
      from = event.origin.coords;
      to   = [32.08, 34.78];
      color = event.origin.color || '#f85149';
    } else return;

    const path = arcPath(from, to);
    animateComet(map, path, color, 7000, () => impactFlash(map, to, color));
    flashLaunchBanner(event.title, event.origin?.name, event.target?.name);
  }

  async function fetchLiveMissileAlerts() {
    try {
      const res = await fetch(`/api/missile-alerts?since=${lastAlertTs}`, {
        signal: AbortSignal.timeout(6000),
      });
      if (!res.ok) return;
      const events = await res.json();
      const statusEl = document.getElementById('map-live-status');
      if (events.length) {
        lastAlertTs = Math.max(...events.map(e => e.timestamp));
        events.forEach(e => animateLiveEvent(e));
        if (statusEl) statusEl.textContent = `● ${events.length} live event(s) detected`;
      } else {
        const t = new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
        if (statusEl) statusEl.textContent = `● RSS checked ${t}`;
      }
    } catch (_) {}
  }

  fetchLiveMissileAlerts();
  setInterval(fetchLiveMissileAlerts, 30000);

  return map;
}

document.addEventListener('DOMContentLoaded', initMap);
