// ============================================================
//  map.js — Missile Trajectory Map
//  Uses Leaflet.js + CartoDB Dark tiles
// ============================================================

// ── KNOWN LOCATIONS ──────────────────────────────────────────
const IRAN_SITES = [
  { name: 'Parchin Complex',       lat: 35.52, lng: 51.77, label: 'IRGC Ballistic Missile Base' },
  { name: 'Isfahan Missile Base',  lat: 32.63, lng: 51.66, label: 'IRGC Aerospace Force' },
  { name: 'Khuzestan Corridor',    lat: 31.32, lng: 48.67, label: 'Mobile Launcher Zone' },
  { name: 'Kermanshah Zone',       lat: 34.32, lng: 47.07, label: 'IRGC Mobile Ballistic Unit' },
  { name: 'Tabriz IRGC Base',      lat: 38.08, lng: 46.30, label: 'Northern Launch Site' },
];

const HOUTHI_SITES = [
  { name: 'Sanaa Launch Zone',     lat: 15.35, lng: 44.21, label: 'Houthi Ballistic Unit' },
  { name: 'Hodeidah Coast',        lat: 14.80, lng: 42.95, label: 'Houthi Coastal Battery' },
];

const HEZBOLLAH_SITES = [
  { name: 'Baalbek (Hezbollah)',   lat: 34.00, lng: 36.21, label: 'Hezbollah Rocket Depot' },
  { name: 'South Lebanon',         lat: 33.27, lng: 35.57, label: 'Hezbollah Launch Zone' },
];

const ISRAEL_TARGETS = [
  { name: 'Tel Aviv / Gush Dan',   lat: 32.08, lng: 34.78 },
  { name: 'Jerusalem',             lat: 31.78, lng: 35.22 },
  { name: 'Nevatim Air Base',      lat: 31.21, lng: 35.01 },
  { name: 'Haifa',                 lat: 32.82, lng: 35.00 },
];

const IRAN_TARGETS = [
  { name: 'Tehran',                lat: 35.69, lng: 51.39 },
  { name: 'Natanz Nuclear Site',   lat: 33.72, lng: 51.93 },
  { name: 'Isfahan',               lat: 32.63, lng: 51.68 },
  { name: 'Parchin',               lat: 35.52, lng: 51.77 },
];

const IDF_BASES = [
  { name: 'Nevatim Air Base',      lat: 31.21, lng: 35.01, label: 'IDF F-35 Squadron' },
  { name: 'Tel Nof Air Base',      lat: 31.84, lng: 34.82, label: 'IDF Strike Wing' },
];

const US_ASSETS = [
  { name: 'USS Gerald R. Ford (CVN-78)',       lat: 33.5, lng: 33.0, label: 'Carrier Strike Group 12' },
  { name: 'USS Dwight D. Eisenhower (CVN-69)', lat: 31.8, lng: 29.5, label: 'Carrier Strike Group 2' },
];

// All wave trajectories with actor color
const WAVE_TRAJECTORIES = [
  // Iran → Israel (5 routes)
  { from: IRAN_SITES[0], to: ISRAEL_TARGETS[0], color: '#bc8cff' },
  { from: IRAN_SITES[1], to: ISRAEL_TARGETS[2], color: '#bc8cff' },
  { from: IRAN_SITES[2], to: ISRAEL_TARGETS[1], color: '#bc8cff' },
  { from: IRAN_SITES[3], to: ISRAEL_TARGETS[3], color: '#bc8cff' },
  { from: IRAN_SITES[4], to: ISRAEL_TARGETS[0], color: '#bc8cff' },
  // Yemen (Houthi) → Israel (2 routes)
  { from: HOUTHI_SITES[0], to: ISRAEL_TARGETS[0], color: '#f85149' },
  { from: HOUTHI_SITES[1], to: ISRAEL_TARGETS[3], color: '#f85149' },
  // Hezbollah → Israel (2 routes)
  { from: HEZBOLLAH_SITES[0], to: ISRAEL_TARGETS[3], color: '#e3693a' },
  { from: HEZBOLLAH_SITES[1], to: ISRAEL_TARGETS[0], color: '#e3693a' },
  // IDF → Iran counterstrikes (3 routes)
  { from: IDF_BASES[0], to: IRAN_TARGETS[0], color: '#3fb950' },
  { from: IDF_BASES[0], to: IRAN_TARGETS[1], color: '#3fb950' },
  { from: IDF_BASES[1], to: IRAN_TARGETS[2], color: '#3fb950' },
  // US carrier → Iran (2 routes)
  { from: US_ASSETS[0], to: IRAN_TARGETS[0], color: '#58a6ff' },
  { from: US_ASSETS[1], to: IRAN_TARGETS[3], color: '#58a6ff' },
];

// ── HELPERS ───────────────────────────────────────────────────
function interpolate(from, to, t) {
  return {
    lat: from.lat + (to.lat - from.lat) * t,
    lng: from.lng + (to.lng - from.lng) * t,
  };
}

function arcPath(from, to, steps = 50) {
  const pts = [];
  const dist = Math.sqrt(Math.pow(to.lat - from.lat, 2) + Math.pow(to.lng - from.lng, 2));
  const bow = Math.min(dist * 0.18, 4.0); // scale bow to distance
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const p = interpolate(from, to, t);
    pts.push([p.lat + Math.sin(Math.PI * t) * bow, p.lng]);
  }
  return pts;
}

function svgIcon(color, size = 10) {
  return L.divIcon({
    className: '',
    html: `<svg width="${size * 2}" height="${size * 2}" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg">
      <circle cx="10" cy="10" r="5" fill="${color}" opacity="0.9"/>
      <circle cx="10" cy="10" r="9" fill="${color}" opacity="0.25"/>
    </svg>`,
    iconSize:   [size * 2, size * 2],
    iconAnchor: [size, size],
  });
}

function missileIcon(color) {
  return L.divIcon({
    className: '',
    html: `<div style="
      width:18px; height:18px; border-radius:50%;
      background:${color};
      box-shadow: 0 0 14px ${color}, 0 0 6px #fff;
      animation: missile-pulse 0.9s ease-in-out infinite;
    "></div>`,
    iconSize:   [18, 18],
    iconAnchor: [9, 9],
  });
}

function animateMissile(map, path, color, duration, onComplete) {
  if (path.length < 2) return;
  let step = 0;
  const marker = L.marker(path[0], { icon: missileIcon(color), zIndexOffset: 500 }).addTo(map);
  const interval = setInterval(() => {
    step++;
    if (step >= path.length) {
      clearInterval(interval);
      map.removeLayer(marker);
      if (onComplete) onComplete();
      return;
    }
    marker.setLatLng(path[step]);
  }, duration / path.length);
  return marker;
}

// ── INIT MAP ──────────────────────────────────────────────────
function initMap() {
  const map = L.map('conflict-map', {
    center: [30.0, 43.0],
    zoom: 4,
    zoomControl: true,
    attributionControl: false,
  });

  L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
    maxZoom: 19,
    subdomains: 'abcd',
  }).addTo(map);

  // ── IRAN LAUNCH SITES ───────────────────────────────────────
  IRAN_SITES.forEach(site => {
    L.marker([site.lat, site.lng], { icon: svgIcon('#bc8cff', 8) })
      .addTo(map)
      .bindPopup(`<b style="color:#bc8cff">⚡ ${site.name}</b><br>${site.label}`);
    L.circle([site.lat, site.lng], {
      radius: 40000, color: '#bc8cff', fillColor: '#bc8cff',
      fillOpacity: 0.04, weight: 1, dashArray: '4 4',
    }).addTo(map);
  });

  // ── HOUTHI / HEZBOLLAH SITES ─────────────────────────────────
  [...HOUTHI_SITES, ...HEZBOLLAH_SITES].forEach(site => {
    L.marker([site.lat, site.lng], { icon: svgIcon('#f85149', 7) })
      .addTo(map)
      .bindPopup(`<b style="color:#f85149">🚀 ${site.name}</b><br>${site.label}`);
  });

  // ── ISRAEL TARGETS ──────────────────────────────────────────
  ISRAEL_TARGETS.forEach(t => {
    L.marker([t.lat, t.lng], { icon: svgIcon('#f85149', 7) })
      .addTo(map)
      .bindPopup(`<b style="color:#f85149">🎯 ${t.name}</b>`);
    L.circle([t.lat, t.lng], {
      radius: 25000, color: '#f85149', fillColor: '#f85149',
      fillOpacity: 0.06, weight: 1, dashArray: '3 5',
    }).addTo(map);
  });

  // ── IDF BASES ───────────────────────────────────────────────
  IDF_BASES.forEach(b => {
    L.marker([b.lat, b.lng], { icon: svgIcon('#3fb950', 8) })
      .addTo(map)
      .bindPopup(`<b style="color:#3fb950">✈️ ${b.name}</b><br>${b.label}`);
  });

  // ── US CARRIERS ─────────────────────────────────────────────
  US_ASSETS.forEach(a => {
    L.marker([a.lat, a.lng], { icon: svgIcon('#58a6ff', 9) })
      .addTo(map)
      .bindPopup(`<b style="color:#58a6ff">⚓ ${a.name}</b><br>${a.label}`);
    L.circle([a.lat, a.lng], {
      radius: 300000, color: '#58a6ff', fillColor: '#58a6ff',
      fillOpacity: 0.03, weight: 1, dashArray: '6 4',
    }).addTo(map);
  });

  // ── STATIC TRAJECTORY LINES (all routes) ────────────────────
  WAVE_TRAJECTORIES.forEach(({ from, to, color }) => {
    L.polyline(arcPath(from, to), {
      color, weight: 1, opacity: 0.2, dashArray: '5 7',
    }).addTo(map);
  });

  // ── ANIMATED WAVE ────────────────────────────────────────────
  // Pick a random subset of trajectories for each wave so not all fire at once
  function launchWave() {
    const picks = WAVE_TRAJECTORIES
      .sort(() => Math.random() - 0.5)
      .slice(0, 4 + Math.floor(Math.random() * 4)); // 4–7 missiles per wave

    picks.forEach((traj, i) => {
      const path = arcPath(traj.from, traj.to);
      const intercepted = Math.random() < 0.88;
      const duration = 3500 + Math.random() * 2500;
      const delay = i * 500 + Math.random() * 600;

      setTimeout(() => {
        if (intercepted) {
          const cutoff = Math.floor(path.length * (0.55 + Math.random() * 0.25));
          const partial = path.slice(0, cutoff);
          animateMissile(map, partial, traj.color, duration * 0.7, () => {
            const m = L.marker(partial[partial.length - 1], { icon: svgIcon('#3fb950', 5) }).addTo(map);
            setTimeout(() => map.removeLayer(m), 1500);
          });
        } else {
          animateMissile(map, path, traj.color, duration, () => {
            const m = L.circleMarker([traj.to.lat, traj.to.lng], {
              radius: 12, color: traj.color, fillColor: traj.color, fillOpacity: 0.5, weight: 2,
            }).addTo(map);
            setTimeout(() => map.removeLayer(m), 2000);
          });
        }
      }, delay);
    });
  }

  launchWave();
  setInterval(launchWave, 8000); // wave every 8 seconds

  // ── LIVE RSS-DETECTED EVENTS ──────────────────────────────────
  let lastAlertTs = 0; // show all stored events on first load

  function flashLaunchAlert(title, originName, targetName) {
    const banner = document.getElementById('live-launch-banner');
    if (!banner) return;
    const icon = title.toLowerCase().includes('drone') ? '🛸' :
                 title.toLowerCase().includes('ballistic') ? '🚀' :
                 title.toLowerCase().includes('rocket') ? '💥' : '🚀';
    banner.innerHTML = `${icon} <b>LIVE LAUNCH DETECTED</b> &mdash; ${title}` +
      (originName ? ` &bull; ${originName}` : '') +
      (targetName ? ` ➜ ${targetName}` : '');
    banner.style.display = 'block';
    setTimeout(() => { banner.style.display = 'none'; }, 15000);
  }

  function animateLiveEvent(event) {
    let from, to, color;

    if (event.origin && event.target) {
      const oc = event.origin.coords;
      const tc = event.target.coords;
      // Skip if origin == target (no trajectory to draw)
      if (oc[0] === tc[0] && oc[1] === tc[1]) return;
      from  = { lat: oc[0], lng: oc[1] };
      to    = { lat: tc[0], lng: tc[1] };
      color = event.origin.color || '#f85149';
    } else if (event.origin) {
      // Has origin but no target — default target to Tel Aviv
      from  = { lat: event.origin.coords[0], lng: event.origin.coords[1] };
      to    = { lat: 32.08, lng: 34.78 };
      color = event.origin.color || '#f85149';
    } else {
      return; // no location data
    }

    const path = arcPath(from, to);

    // Bright trajectory line (30s visible)
    const line = L.polyline(path, { color, weight: 2, opacity: 0.7, dashArray: '4 5' }).addTo(map);
    setTimeout(() => map.removeLayer(line), 30000);

    // Pulsing origin marker with popup
    const originM = L.marker([from.lat, from.lng], { icon: svgIcon(color, 10) }).addTo(map);
    originM.bindPopup(
      `<b style="color:${color}">🚀 LAUNCH DETECTED</b><br>` +
      `${event.title}<br><i style="color:#8b949e">${event.source}</i>`
    ).openPopup();
    setTimeout(() => { try { map.removeLayer(originM); } catch (_) {} }, 25000);

    // Animated missile dot
    animateMissile(map, path, color, 6000, () => {
      const impact = L.circleMarker([to.lat, to.lng], {
        radius: 14, color, fillColor: color, fillOpacity: 0.5, weight: 2,
      }).addTo(map);
      setTimeout(() => map.removeLayer(impact), 4000);
    });

    flashLaunchAlert(event.title, event.origin?.name, event.target?.name);
  }

  async function fetchLiveMissileAlerts() {
    try {
      const res = await fetch(`/api/missile-alerts?since=${lastAlertTs}`, {
        signal: AbortSignal.timeout(5000),
      });
      if (!res.ok) return;
      const events = await res.json();
      if (events.length) {
        lastAlertTs = Math.max(...events.map(e => e.timestamp));
        events.forEach(e => animateLiveEvent(e));
      }
    } catch (_) {}
  }

  fetchLiveMissileAlerts();
  setInterval(fetchLiveMissileAlerts, 30000);

  return map;
}

document.addEventListener('DOMContentLoaded', initMap);
