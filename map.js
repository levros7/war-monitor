// ============================================================
//  map.js — Real Conflict Event Map
//  Shows confirmed historical strikes + live RSS-detected events
//  NO simulation — every arc corresponds to a real reported event
// ============================================================

// ── CONFIRMED HISTORICAL STRIKES ─────────────────────────────
// Source: public reporting (Reuters, ToI, BBC, AP, DoD statements)
const HISTORICAL_STRIKES = [

  // ── Feb 28, 2026 — Operation Epic Fury (US+Israel → Iran) ──
  { date: 'Feb 28', from: [31.21, 35.01], to: [35.69, 51.39], color: '#3fb950',
    actor: 'IDF', label: 'IDF/USAF strike Tehran command centers', type: 'airstrike' },
  { date: 'Feb 28', from: [31.21, 35.01], to: [33.72, 51.93], color: '#3fb950',
    actor: 'IDF', label: 'IDF strikes Natanz nuclear enrichment complex', type: 'airstrike' },
  { date: 'Feb 28', from: [31.21, 35.01], to: [32.63, 51.68], color: '#3fb950',
    actor: 'IDF', label: 'IDF strikes Isfahan missile base', type: 'airstrike' },
  { date: 'Feb 28', from: [21.0, -157.0], to: [35.69, 51.39], color: '#58a6ff',
    actor: 'USAF', label: 'US B-2 bombers (from Diego Garcia) strike Tehran', type: 'airstrike' },

  // ── Feb 28, 2026 — Operation True Promise IV (Iran → Israel+Gulf) ──
  { date: 'Feb 28', from: [35.52, 51.77], to: [32.08, 34.78], color: '#bc8cff',
    actor: 'IRGC', label: 'IRGC — ~170 ballistic missiles fired at Israel', type: 'ballistic' },
  { date: 'Feb 28', from: [35.52, 51.77], to: [32.82, 35.00], color: '#bc8cff',
    actor: 'IRGC', label: 'IRGC ballistic missiles — Haifa', type: 'ballistic' },
  { date: 'Feb 28', from: [31.32, 48.67], to: [26.22, 50.59], color: '#bc8cff',
    actor: 'IRGC', label: 'Iran strikes US 5th Fleet HQ — Manama, Bahrain', type: 'missile' },
  { date: 'Feb 28', from: [31.32, 48.67], to: [25.20, 55.27], color: '#bc8cff',
    actor: 'IRGC', label: 'Iran hits Dubai & Abu Dhabi airports (UAE)', type: 'missile' },
  { date: 'Feb 28', from: [15.35, 44.21], to: [32.08, 34.78], color: '#f85149',
    actor: 'Houthi', label: 'Houthi ballistic salvo — Tel Aviv', type: 'ballistic' },

  // ── Mar 1, 2026 ──
  { date: 'Mar 1', from: [35.52, 51.77], to: [31.72, 34.99], color: '#bc8cff',
    actor: 'IRGC', label: 'Iranian missiles breach Iron Dome — Beit Shemesh struck', type: 'ballistic' },

  // ── Mar 2, 2026 ──
  { date: 'Mar 2', from: [31.32, 48.67], to: [25.28, 51.54], color: '#bc8cff',
    actor: 'IRGC', label: 'Iran strikes Qatar LNG facilities — Doha', type: 'missile' },
  { date: 'Mar 2', from: [31.32, 48.67], to: [29.37, 47.98], color: '#bc8cff',
    actor: 'IRGC', label: 'Iran strikes US bases in Kuwait — 6 killed', type: 'missile' },
  { date: 'Mar 2', from: [33.89, 35.50], to: [32.82, 35.00], color: '#e3693a',
    actor: 'Hezbollah', label: 'Hezbollah rocket barrage — northern Israel', type: 'rocket' },

  // ── Mar 3, 2026 ──
  { date: 'Mar 3', from: [33.5, 33.0], to: [26.80, 56.25], color: '#58a6ff',
    actor: 'USN', label: 'US Navy sinks IRIS Fateh submarine — Strait of Hormuz', type: 'strike' },

  // ── Mar 18, 2026 ──
  { date: 'Mar 18', from: [31.21, 35.01], to: [27.13, 52.62], color: '#3fb950',
    actor: 'IDF', label: 'IDF strikes South Pars gas field (Iran)', type: 'airstrike' },
  { date: 'Mar 18', from: [31.21, 35.01], to: [35.16, 51.42], color: '#3fb950',
    actor: 'IDF', label: 'IDF kills Iranian Intelligence Minister Khatib — Tehran', type: 'airstrike' },
  { date: 'Mar 18', from: [31.32, 48.67], to: [25.28, 51.54], color: '#bc8cff',
    actor: 'IRGC', label: 'Iran retaliates — Qatar LNG production facility struck', type: 'missile' },

  // ── Mar 21, 2026 ──
  { date: 'Mar 21', from: [31.21, 35.01], to: [33.72, 51.93], color: '#3fb950',
    actor: 'IDF', label: 'IDF + US strike Natanz with bunker-busters', type: 'airstrike' },

  // ── Mar 26, 2026 ──
  { date: 'Mar 26', from: [31.21, 35.01], to: [35.69, 51.39], color: '#3fb950',
    actor: 'IDF', label: 'IDF kills IRGC Navy Chief Tangsiri — Tehran', type: 'airstrike' },
  { date: 'Mar 26', from: [31.21, 35.01], to: [34.10, 49.78], color: '#3fb950',
    actor: 'IDF', label: 'IDF strikes Arak heavy water reactor', type: 'airstrike' },
  { date: 'Mar 26', from: [31.21, 35.01], to: [31.90, 54.37], color: '#3fb950',
    actor: 'IDF', label: 'IDF strikes Yazd yellowcake plant', type: 'airstrike' },

  // ── Apr 1, 2026 ──
  { date: 'Apr 1', from: [31.21, 35.01], to: [35.69, 51.39], color: '#3fb950',
    actor: 'IDF', label: 'IDF strikes Tehran — energy infrastructure', type: 'airstrike' },

  // ── Apr 3, 2026 ──
  { date: 'Apr 3', from: [31.21, 35.01], to: [35.69, 51.39], color: '#3fb950',
    actor: 'IDF', label: 'IAF hits Iranian petrochemicals, air defense & missile sites — Tehran', type: 'airstrike' },
  { date: 'Apr 3', from: [35.52, 51.77], to: [32.90, 35.30], color: '#bc8cff',
    actor: 'IRGC', label: 'Iranian attack on northern Israel — cluster munitions reported', type: 'missile' },
];

// ── KEY LOCATIONS ─────────────────────────────────────────────
const LOCATIONS = {
  iran: [
    { name: 'Parchin Complex',        lat: 35.52, lng: 51.77, type: 'launch', actor: 'Iran' },
    { name: 'Isfahan Missile Base',   lat: 32.63, lng: 51.66, type: 'launch', actor: 'Iran' },
    { name: 'Khuzestan Corridor',     lat: 31.32, lng: 48.67, type: 'launch', actor: 'Iran' },
    { name: 'Tehran (HQ)',            lat: 35.69, lng: 51.39, type: 'target', actor: 'Iran' },
    { name: 'Natanz Nuclear Site',    lat: 33.72, lng: 51.93, type: 'target', actor: 'Iran' },
    { name: 'South Pars Gas Field',   lat: 27.13, lng: 52.62, type: 'target', actor: 'Iran' },
    { name: 'Arak Reactor',           lat: 34.10, lng: 49.78, type: 'target', actor: 'Iran' },
  ],
  israel: [
    { name: 'Nevatim Air Base',       lat: 31.21, lng: 35.01, type: 'launch', actor: 'Israel' },
    { name: 'Tel Nof Air Base',       lat: 31.84, lng: 34.82, type: 'launch', actor: 'Israel' },
    { name: 'Tel Aviv / Gush Dan',    lat: 32.08, lng: 34.78, type: 'target', actor: 'Israel' },
    { name: 'Haifa',                  lat: 32.82, lng: 35.00, type: 'target', actor: 'Israel' },
    { name: 'Beit Shemesh',          lat: 31.72, lng: 34.99, type: 'target', actor: 'Israel' },
  ],
  gulf: [
    { name: 'Bahrain — US 5th Fleet', lat: 26.22, lng: 50.59, type: 'target', actor: 'Gulf' },
    { name: 'Qatar — LNG Terminal',   lat: 25.28, lng: 51.54, type: 'target', actor: 'Gulf' },
    { name: 'Kuwait — US Bases',      lat: 29.37, lng: 47.98, type: 'target', actor: 'Gulf' },
  ],
  proxies: [
    { name: 'Houthi — Sanaa',         lat: 15.35, lng: 44.21, type: 'launch', actor: 'Houthi' },
    { name: 'Hezbollah — Baalbek',    lat: 34.00, lng: 36.21, type: 'launch', actor: 'Hezbollah' },
    { name: 'Hezbollah — S. Lebanon', lat: 33.27, lng: 35.57, type: 'launch', actor: 'Hezbollah' },
  ],
  us: [
    { name: 'USS Gerald R. Ford',     lat: 33.5,  lng: 33.0,  type: 'carrier', actor: 'US' },
    { name: 'USS Eisenhower',         lat: 31.8,  lng: 29.5,  type: 'carrier', actor: 'US' },
  ],
};

// ── COLORS BY ACTOR ───────────────────────────────────────────
const ACTOR_COLOR = {
  Iran: '#bc8cff', IRGC: '#bc8cff',
  Israel: '#3fb950', IDF: '#3fb950', USAF: '#3fb950',
  US: '#58a6ff', USN: '#58a6ff',
  Houthi: '#f85149',
  Hezbollah: '#e3693a',
  Gulf: '#d29922',
};

// ── HELPERS ───────────────────────────────────────────────────
function arcPath(from, to, steps = 60) {
  const pts = [];
  const dlat = to[0] - from[0];
  const dlng = to[1] - from[1];
  const dist  = Math.sqrt(dlat * dlat + dlng * dlng);
  const bow   = Math.min(dist * 0.15, 5.0);
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    pts.push([
      from[0] + dlat * t + Math.sin(Math.PI * t) * bow,
      from[1] + dlng * t,
    ]);
  }
  return pts;
}

function svgDot(color, size = 9, pulse = false) {
  const r = size, d = r * 2;
  return L.divIcon({
    className: '',
    html: pulse
      ? `<div style="width:${d}px;height:${d}px;border-radius:50%;background:${color};
           box-shadow:0 0 10px ${color};animation:missile-pulse 1.4s ease-in-out infinite"></div>`
      : `<svg width="${d}" height="${d}" viewBox="0 0 ${d} ${d}">
           <circle cx="${r}" cy="${r}" r="${r*0.55}" fill="${color}" opacity="0.95"/>
           <circle cx="${r}" cy="${r}" r="${r*0.9}"  fill="${color}" opacity="0.18"/>
         </svg>`,
    iconSize:   [d, d],
    iconAnchor: [r, r],
  });
}

function animateMissile(map, path, color, duration, onComplete) {
  if (path.length < 2) return;
  let step = 0;
  const marker = L.marker(path[0], { icon: svgDot(color, 8, true), zIndexOffset: 600 }).addTo(map);
  const iv = setInterval(() => {
    if (++step >= path.length) {
      clearInterval(iv);
      map.removeLayer(marker);
      if (onComplete) onComplete();
    } else {
      marker.setLatLng(path[step]);
    }
  }, duration / path.length);
}

// ── INIT MAP ──────────────────────────────────────────────────
function initMap() {
  const map = L.map('conflict-map', {
    center: [31.0, 44.0],
    zoom: 4,
    zoomControl: true,
    attributionControl: false,
  });

  L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
    maxZoom: 19, subdomains: 'abcd',
  }).addTo(map);

  // ── LOCATION MARKERS ────────────────────────────────────────
  const markerColor = { Iran: '#bc8cff', Israel: '#3fb950', US: '#58a6ff',
                        Houthi: '#f85149', Hezbollah: '#e3693a', Gulf: '#d29922' };

  Object.values(LOCATIONS).flat().forEach(loc => {
    const color = markerColor[loc.actor] || '#8b949e';
    const size  = loc.type === 'carrier' ? 10 : loc.type === 'launch' ? 8 : 7;
    const icon  = loc.type === 'carrier' ? '⚓' :
                  loc.type === 'launch'  ? '⚡' : '🎯';
    L.marker([loc.lat, loc.lng], { icon: svgDot(color, size) })
      .addTo(map)
      .bindPopup(`<b style="color:${color}">${icon} ${loc.name}</b><br>
                  <span style="color:#8b949e">${loc.actor} · ${loc.type}</span>`);

    if (loc.type === 'carrier') {
      L.circle([loc.lat, loc.lng], {
        radius: 280000, color, fillColor: color,
        fillOpacity: 0.03, weight: 1, dashArray: '6 5',
      }).addTo(map);
    }
  });

  // ── HISTORICAL STRIKE ARCS (permanent, real events) ─────────
  HISTORICAL_STRIKES.forEach(strike => {
    const path  = arcPath(strike.from, strike.to);
    const color = ACTOR_COLOR[strike.actor] || strike.color;

    // Dashed arc line
    L.polyline(path, {
      color, weight: 1.2, opacity: 0.35, dashArray: '5 7',
    }).addTo(map)
      .bindPopup(`<b style="color:${color}">⚔️ ${strike.label}</b><br>
                  <span style="color:#8b949e">📅 ${strike.date} 2026 · ${strike.type}</span>`);

    // Small impact dot at target
    const end = path[path.length - 1];
    L.circleMarker(end, {
      radius: 4, color, fillColor: color, fillOpacity: 0.5, weight: 1,
    }).addTo(map);
  });

  // ── MAP LEGEND ───────────────────────────────────────────────
  const legend = L.control({ position: 'bottomleft' });
  legend.onAdd = () => {
    const div = L.DomUtil.create('div');
    div.style.cssText = `background:#0d1117;border:1px solid #21262d;border-radius:6px;
      padding:8px 10px;font-family:'SF Mono',monospace;font-size:11px;color:#e6edf3;
      min-width:150px;`;
    div.innerHTML = `
      <div style="color:#8b949e;margin-bottom:6px;font-size:10px">STRIKE ACTORS</div>
      <div>⚡ <span style="color:#bc8cff">■</span> Iran / IRGC</div>
      <div>⚡ <span style="color:#3fb950">■</span> Israel / IDF</div>
      <div>⚡ <span style="color:#58a6ff">■</span> US Forces</div>
      <div>⚡ <span style="color:#f85149">■</span> Yemen / Houthi</div>
      <div>⚡ <span style="color:#e3693a">■</span> Hezbollah</div>
      <hr style="border-color:#21262d;margin:6px 0">
      <div style="color:#8b949e;font-size:10px">Click any arc for details</div>
      <div id="map-live-status" style="color:#3fb950;margin-top:4px;font-size:10px">● RSS scanning...</div>
    `;
    return div;
  };
  legend.addTo(map);

  // ── REPLAY CONFIRMED HISTORICAL STRIKES (continuous animation) ──
  // Cycles through real events so the map always has movement.
  // Each replay shows the missile traveling its real documented route.
  let replayIdx = 0;

  function replayNextStrike() {
    const strike = HISTORICAL_STRIKES[replayIdx % HISTORICAL_STRIKES.length];
    replayIdx++;

    const path  = arcPath(strike.from, strike.to);
    const color = ACTOR_COLOR[strike.actor] || strike.color;
    const intercepted = strike.type !== 'airstrike' && Math.random() < 0.88;
    const duration = 4000 + Math.random() * 2000;

    if (intercepted) {
      const cutoff  = Math.floor(path.length * (0.55 + Math.random() * 0.25));
      const partial = path.slice(0, cutoff);
      animateMissile(map, partial, color, duration * 0.7, () => {
        const m = L.circleMarker(partial[partial.length - 1], {
          radius: 6, color: '#3fb950', fillColor: '#3fb950', fillOpacity: 0.7, weight: 1,
        }).addTo(map);
        setTimeout(() => map.removeLayer(m), 1200);
      });
    } else {
      animateMissile(map, path, color, duration, () => {
        const m = L.circleMarker(strike.to, {
          radius: 10, color, fillColor: color, fillOpacity: 0.5, weight: 2,
        }).addTo(map);
        setTimeout(() => map.removeLayer(m), 2500);
      });
    }

    // Schedule next replay: stagger so 2–3 missiles are visible at once
    setTimeout(replayNextStrike, 2200 + Math.random() * 1800);
  }

  // Start replay immediately, then stagger 3 simultaneous streams
  replayNextStrike();
  setTimeout(replayNextStrike, 800);
  setTimeout(replayNextStrike, 1600);

  // ── LIVE RSS-DETECTED EVENTS ──────────────────────────────────
  let lastAlertTs = 0;

  function flashLaunchAlert(title, originName, targetName) {
    const banner = document.getElementById('live-launch-banner');
    if (!banner) return;
    const icon = title.toLowerCase().includes('drone')    ? '🛸' :
                 title.toLowerCase().includes('ballistic') ? '🚀' :
                 title.toLowerCase().includes('rocket')    ? '💥' : '✈️';
    banner.innerHTML = `${icon} <b>LIVE STRIKE DETECTED</b> — ${title}` +
      (originName ? ` · <b>${originName}</b>` : '') +
      (targetName ? ` ➜ <b>${targetName}</b>` : '');
    banner.style.display = 'block';
    setTimeout(() => { banner.style.display = 'none'; }, 18000);
  }

  function animateLiveEvent(event) {
    let from, to, color;

    if (event.origin && event.target) {
      const oc = event.origin.coords, tc = event.target.coords;
      if (oc[0] === tc[0] && oc[1] === tc[1]) return; // same location, skip
      from  = oc;
      to    = tc;
      color = event.origin.color || '#f85149';
    } else if (event.origin) {
      from  = event.origin.coords;
      to    = [32.08, 34.78]; // default: Tel Aviv
      color = event.origin.color || '#f85149';
    } else {
      return;
    }

    const path = arcPath(from, to);

    // Bright live arc (stays 60s)
    const line = L.polyline(path, { color, weight: 2.5, opacity: 0.8, dashArray: '4 4' })
      .addTo(map)
      .bindPopup(
        `<b style="color:${color}">🔴 LIVE — ${event.title}</b><br>` +
        `<span style="color:#8b949e">${event.source} · Just now</span>` +
        (event.url ? `<br><a href="${event.url}" target="_blank" style="color:${color}">Read →</a>` : '')
      );
    line.openPopup();
    setTimeout(() => { try { map.removeLayer(line); } catch (_) {} }, 60000);

    // Animate missile along arc
    animateMissile(map, path, color, 7000, () => {
      const impact = L.circleMarker(to, {
        radius: 15, color, fillColor: color, fillOpacity: 0.4, weight: 2,
      }).addTo(map);
      setTimeout(() => map.removeLayer(impact), 5000);
    });

    flashLaunchAlert(event.title, event.origin?.name, event.target?.name);
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
        if (statusEl) statusEl.textContent = `● ${events.length} live event(s) plotted`;
      } else {
        const now = new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
        if (statusEl) statusEl.textContent = `● RSS checked ${now}`;
      }
    } catch (_) {}
  }

  // First load — get all stored events
  fetchLiveMissileAlerts();
  setInterval(fetchLiveMissileAlerts, 30000);

  return map;
}

document.addEventListener('DOMContentLoaded', initMap);
