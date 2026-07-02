// ============================================================
//  map.js — OSINT Conflict Map
//  Live RSS-detected strike events only (no simulated replay)
//  - Comet trail animation (bright head + fading trail)
//  - Per-actor layer toggles (show/hide each group)
//  - Live RSS event overlay, polled every 30s
// ============================================================

// Layer groups: name, color, which actors belong
const LAYER_GROUPS = [
  { id: 'iran',      label: 'Iran / IRGC',      color: '#f85149', actors: ['IRGC', 'Iran'] },
  { id: 'israel',    label: 'Israel / IDF',      color: '#3fb950', actors: ['IDF', 'Israel'] },
  { id: 'us',        label: 'US Forces',         color: '#58a6ff', actors: ['USN', 'US', 'USAF'] },
  { id: 'houthi',    label: 'Houthi / Yemen',    color: '#ff6b35', actors: ['Houthi'] },
  { id: 'hezbollah', label: 'Hezbollah',         color: '#e3693a', actors: ['Hezbollah'] },
];

// Set of active layer IDs — all on by default
const activeLayers = new Set(LAYER_GROUPS.map(g => g.id));

// ── PATH HELPERS ──────────────────────────────────────────────
function arcPath(from, to, steps = 80) {
  const pts  = [];
  const dlat = to[0] - from[0];
  const dlng = to[1] - from[1];
  const dist = Math.sqrt(dlat * dlat + dlng * dlng);
  if (dist < 0.01) return [from, to];
  // Bow perpendicular to the flight path (toward the north side) —
  // a fixed northward bow made short southward shots (Lebanon→Israel)
  // loop backward over their own launch point
  const bow = Math.min(Math.max(dist * 0.22, 0.4), 5.5);
  let px = -dlng / dist, py = dlat / dist;
  if (px < 0) { px = -px; py = -py; }
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const s = Math.sin(Math.PI * t) * bow;
    pts.push([from[0] + dlat * t + px * s, from[1] + dlng * t + py * s]);
  }
  return pts;
}

function arcDist(from, to) {
  return Math.sqrt(Math.pow(to[0] - from[0], 2) + Math.pow(to[1] - from[1], 2));
}

// ── COMET TRAIL ANIMATION ─────────────────────────────────────
function animateComet(map, path, color, duration, onComplete) {
  if (path.length < 2) return;

  const TRAIL = 10;
  const trail = [];
  let step = 0;

  const iv = setInterval(() => {
    if (step >= path.length) {
      clearInterval(iv);
      trail.forEach(m => { try { map.removeLayer(m); } catch (_) {} });
      if (onComplete) onComplete();
      return;
    }

    const m = L.circleMarker(path[step], {
      radius: 5, color: 'white', fillColor: color,
      fillOpacity: 1.0, opacity: 0.9, weight: 1,
      className: 'comet-head',
    }).addTo(map);
    trail.push(m);

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

    while (trail.length > TRAIL + 2) trail.shift();
    step++;
  }, duration / path.length);
}

// ── IMPACT FLASH ──────────────────────────────────────────────
function impactFlash(map, latlng, color) {
  const ring = L.circleMarker(latlng, {
    radius: 8, color, fillColor: color, fillOpacity: 0.6, weight: 2,
  }).addTo(map);

  let r = 8, fade = 0.6;
  const iv = setInterval(() => {
    r += 3; fade -= 0.12;
    if (fade <= 0) { clearInterval(iv); try { map.removeLayer(ring); } catch (_) {} return; }
    ring.setStyle({ radius: r, fillOpacity: fade, opacity: fade * 0.8 });
  }, 60);

  const dot = L.circleMarker(latlng, {
    radius: 3, color, fillColor: color, fillOpacity: 0.7, weight: 0,
  }).addTo(map);
  setTimeout(() => { try { map.removeLayer(dot); } catch (_) {} }, 25000);
}

// ── LAYER CONTROL ─────────────────────────────────────────────
function createLayerControl() {
  const LayerControl = L.Control.extend({
    options: { position: 'topright' },

    onAdd() {
      const wrap = L.DomUtil.create('div', 'map-layer-control');
      L.DomEvent.disableClickPropagation(wrap);
      L.DomEvent.disableScrollPropagation(wrap);

      wrap.innerHTML = `
        <div class="mlc-title">LAYERS</div>
        ${LAYER_GROUPS.map(g => `
          <label class="mlc-row" data-layer="${g.id}">
            <span class="mlc-toggle active" data-layer="${g.id}">
              <span class="mlc-dot" style="background:${g.color}"></span>
            </span>
            <span class="mlc-label">${g.label}</span>
          </label>
        `).join('')}
        <div class="mlc-divider"></div>
        <div id="mlc-live-status" class="mlc-live">● Scanning RSS...</div>
      `;

      // Toggle click handler
      wrap.querySelectorAll('.mlc-row').forEach(row => {
        row.addEventListener('click', () => {
          const id = row.dataset.layer;
          const toggle = row.querySelector('.mlc-toggle');
          if (activeLayers.has(id)) {
            activeLayers.delete(id);
            toggle.classList.remove('active');
          } else {
            activeLayers.add(id);
            toggle.classList.add('active');
          }
        });
      });

      return wrap;
    },
  });

  return new LayerControl();
}

// ── INIT MAP ──────────────────────────────────────────────────
function initMap() {
  const map = L.map('conflict-map', {
    center: [31.5, 42.0],
    zoom: 4,
    zoomControl: false,
    attributionControl: false,
  });

  L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_nolabels/{z}/{x}/{y}{r}.png', {
    maxZoom: 19, subdomains: 'abcd',
  }).addTo(map);

  L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_only_labels/{z}/{x}/{y}{r}.png', {
    maxZoom: 19, subdomains: 'abcd', opacity: 0.4,
  }).addTo(map);

  L.control.zoom({ position: 'bottomleft' }).addTo(map);
  createLayerControl().addTo(map);

  // ── LIVE RSS-DETECTED EVENTS ──────────────────────────────────
  // Historical-strike replay removed — the map animates only real
  // RSS-detected events, so it stays quiet between detections.
  let lastAlertTs = 0;

  function flashLaunchBanner(title, originName, targetName) {
    const banner = document.getElementById('live-launch-banner');
    if (!banner) return;
    const icon = title.toLowerCase().includes('drone')    ? '🛸' :
                 title.toLowerCase().includes('ballistic') ? '🚀' :
                 title.toLowerCase().includes('rocket')    ? '💥' : '✈️';
    // escapeHtml is defined in app.js, which loads before map.js
    banner.innerHTML = `${icon} <b>LIVE STRIKE DETECTED</b> — ${escapeHtml(title)}` +
      (originName ? ` · <b>${escapeHtml(originName)}</b>` : '') +
      (targetName ? ` ➜ <b>${escapeHtml(targetName)}</b>` : '');
    banner.style.display = 'block';
    setTimeout(() => { banner.style.display = 'none'; }, 20000);
  }

  function animateLiveEvent(event) {
    let from, to, color, layerId;
    if (event.origin && event.target) {
      const oc = event.origin.coords, tc = event.target.coords;
      if (oc[0] === tc[0] && oc[1] === tc[1]) return;
      from    = oc; to = tc;
      color   = event.origin.color || '#f85149';
      layerId = colorToLayer(color);
    } else if (event.origin) {
      from    = event.origin.coords;
      to      = [32.08, 34.78];
      color   = event.origin.color || '#f85149';
      layerId = colorToLayer(color);
    } else return;

    if (layerId && !activeLayers.has(layerId)) return;

    // Origin ≈ target (e.g. headline matched only "Israel" for both):
    // no meaningful trajectory — show impact only
    if (arcDist(from, to) < 0.05) {
      impactFlash(map, to, color);
      flashLaunchBanner(event.title, event.origin?.name, event.target?.name);
      return;
    }

    const path = arcPath(from, to);
    animateComet(map, path, color, 7000, () => impactFlash(map, to, color));
    flashLaunchBanner(event.title, event.origin?.name, event.target?.name);
  }

  // Map hex color → layer ID for live events
  function colorToLayer(color) {
    const c = color.toLowerCase();
    if (c === '#f85149') return 'iran';
    if (c === '#3fb950') return 'israel';
    if (c === '#58a6ff') return 'us';
    if (c === '#ff6b35') return 'houthi';
    if (c === '#e3693a') return 'hezbollah';
    return null;
  }

  async function fetchLiveMissileAlerts() {
    try {
      const res = await fetch(`/api/missile-alerts?since=${lastAlertTs}`, {
        signal: AbortSignal.timeout(6000),
      });
      if (!res.ok) return;
      const events = await res.json();
      const statusEl = document.getElementById('mlc-live-status');
      if (events.length) {
        lastAlertTs = Math.max(...events.map(e => e.timestamp));
        events.forEach(e => animateLiveEvent(e));
        if (statusEl) statusEl.textContent = `● ${events.length} live event(s)`;
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
