// ============================================================
//  map.js — Missile Trajectory Map
//  Uses Leaflet.js + CartoDB Dark tiles
//  Simulates missile launches based on known 2026 Iran War vectors
// ============================================================

const LAUNCH_SITES = [
  { name: 'Parchin Military Complex',    lat: 35.52, lng: 51.77, label: 'IRGC Ballistic Missile Base' },
  { name: 'Isfahan Missile Base',        lat: 32.63, lng: 51.66, label: 'IRGC Aerospace Force' },
  { name: 'Khuzestan Launch Corridor',   lat: 31.32, lng: 48.67, label: 'Mobile Launcher Zone' },
  { name: 'Kermanshah Launch Zone',      lat: 34.32, lng: 47.07, label: 'IRGC Mobile Ballistic Unit' },
  { name: 'Tabriz IRGC Base',           lat: 38.08, lng: 46.30, label: 'Northern Launch Site' },
];

const TARGETS = [
  { name: 'Tel Aviv / Gush Dan',  lat: 32.08, lng: 34.78 },
  { name: 'Jerusalem',            lat: 31.78, lng: 35.22 },
  { name: 'Nevatim Air Base',     lat: 31.21, lng: 35.01 },
  { name: 'Haifa',                lat: 32.82, lng: 35.00 },
];

const US_ASSETS = [
  { name: 'USS Gerald R. Ford (CVN-78)', lat: 33.5,  lng: 33.0, label: 'Carrier Strike Group 12' },
  { name: 'USS Dwight D. Eisenhower (CVN-69)', lat: 31.8, lng: 29.5, label: 'Carrier Strike Group 2' },
];

// Great circle interpolation
function interpolate(from, to, t) {
  return {
    lat: from.lat + (to.lat - from.lat) * t,
    lng: from.lng + (to.lng - from.lng) * t,
  };
}

// Arc with altitude bow
function arcPath(from, to, steps = 40) {
  const pts = [];
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const p = interpolate(from, to, t);
    // Add altitude bow — raises the midpoint northward slightly
    const bow = Math.sin(Math.PI * t) * 2.5;
    pts.push([p.lat + bow, p.lng]);
  }
  return pts;
}

// SVG icon factory
function svgIcon(color, size = 10) {
  return L.divIcon({
    className: '',
    html: `<svg width="${size * 2}" height="${size * 2}" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg">
      <circle cx="10" cy="10" r="5" fill="${color}" opacity="0.9"/>
      <circle cx="10" cy="10" r="9" fill="${color}" opacity="0.2"/>
    </svg>`,
    iconSize: [size * 2, size * 2],
    iconAnchor: [size, size],
  });
}

function pulsingIcon(color) {
  return L.divIcon({
    className: '',
    html: `<div style="
      width:14px; height:14px; border-radius:50%;
      background:${color};
      box-shadow: 0 0 10px ${color};
      animation: missile-pulse 1.2s ease-in-out infinite;
    "></div>`,
    iconSize: [14, 14],
    iconAnchor: [7, 7],
  });
}

// Animate a missile dot along a path
function animateMissile(map, path, color, duration, onComplete) {
  const steps = path.length;
  let step = 0;
  const marker = L.marker(path[0], { icon: pulsingIcon(color), zIndexOffset: 500 }).addTo(map);

  const interval = setInterval(() => {
    step++;
    if (step >= steps) {
      clearInterval(interval);
      map.removeLayer(marker);
      if (onComplete) onComplete();
      return;
    }
    marker.setLatLng(path[step]);
  }, duration / steps);

  return marker;
}

// ============================================================
//  INIT MAP
// ============================================================
function initMap() {
  const map = L.map('conflict-map', {
    center: [32.5, 42.0],
    zoom: 5,
    zoomControl: true,
    attributionControl: false,
  });

  // Dark tile layer (CartoDB)
  L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
    maxZoom: 19,
    subdomains: 'abcd',
  }).addTo(map);

  // ── IRAN LAUNCH SITES ─────────────────────────────────────
  LAUNCH_SITES.forEach(site => {
    L.marker([site.lat, site.lng], { icon: svgIcon('#bc8cff', 8) })
      .addTo(map)
      .bindPopup(`<b style="color:#bc8cff">⚡ ${site.name}</b><br>${site.label}`);

    // Outer pulsing ring
    L.circle([site.lat, site.lng], {
      radius: 40000,
      color: '#bc8cff',
      fillColor: '#bc8cff',
      fillOpacity: 0.04,
      weight: 1,
      dashArray: '4 4',
    }).addTo(map);
  });

  // ── ISRAEL TARGETS ────────────────────────────────────────
  TARGETS.forEach(t => {
    L.marker([t.lat, t.lng], { icon: svgIcon('#f85149', 7) })
      .addTo(map)
      .bindPopup(`<b style="color:#f85149">🎯 ${t.name}</b>`);
  });

  // ── US CARRIER GROUPS ─────────────────────────────────────
  US_ASSETS.forEach(a => {
    L.marker([a.lat, a.lng], { icon: svgIcon('#58a6ff', 9) })
      .addTo(map)
      .bindPopup(`<b style="color:#58a6ff">⚓ ${a.name}</b><br>${a.label}`);

    L.circle([a.lat, a.lng], {
      radius: 300000,
      color: '#58a6ff',
      fillColor: '#58a6ff',
      fillOpacity: 0.04,
      weight: 1,
      dashArray: '6 4',
    }).addTo(map);
  });

  // ── STATIC TRAJECTORY LINES ───────────────────────────────
  const trajectories = [
    { from: LAUNCH_SITES[0], to: TARGETS[0] },
    { from: LAUNCH_SITES[1], to: TARGETS[2] },
    { from: LAUNCH_SITES[2], to: TARGETS[1] },
    { from: LAUNCH_SITES[3], to: TARGETS[3] },
    { from: LAUNCH_SITES[4], to: TARGETS[0] },
  ];

  trajectories.forEach(({ from, to }) => {
    const path = arcPath(from, to);
    L.polyline(path, {
      color: '#f85149',
      weight: 1,
      opacity: 0.25,
      dashArray: '5 6',
    }).addTo(map);
  });

  // ── US INTERCEPT LINES (carrier to midpoint) ──────────────
  trajectories.forEach(({ from, to }) => {
    const mid = arcPath(from, to, 40)[20];
    US_ASSETS.forEach(carrier => {
      L.polyline([[carrier.lat, carrier.lng], [mid.lat, mid.lng]], {
        color: '#58a6ff',
        weight: 1,
        opacity: 0.15,
        dashArray: '3 8',
      }).addTo(map);
    });
  });

  // ── ANIMATED MISSILES ────────────────────────────────────
  function launchWave() {
    trajectories.forEach((traj, i) => {
      const path = arcPath(traj.from, traj.to);
      const intercepted = Math.random() < 0.9; // ~90% interception rate
      const duration = 4000 + Math.random() * 3000;
      const delay = i * 600 + Math.random() * 800;

      setTimeout(() => {
        if (intercepted) {
          // Travel 60–80% then stop (intercepted)
          const cutoff = Math.floor(path.length * (0.6 + Math.random() * 0.2));
          const partialPath = path.slice(0, cutoff);
          animateMissile(map, partialPath, '#f85149', duration * 0.75, () => {
            // Flash green intercept marker
            const m = L.marker(partialPath[partialPath.length - 1], { icon: svgIcon('#3fb950', 6) }).addTo(map);
            setTimeout(() => map.removeLayer(m), 1800);
          });
        } else {
          // Reaches target
          animateMissile(map, path, '#f85149', duration, () => {
            const m = L.circleMarker([traj.to.lat, traj.to.lng], {
              radius: 10, color: '#f85149', fillColor: '#f85149', fillOpacity: 0.5, weight: 2,
            }).addTo(map);
            setTimeout(() => map.removeLayer(m), 2500);
          });
        }
      }, delay);
    });
  }

  // Launch first wave immediately then every 12 seconds
  launchWave();
  setInterval(launchWave, 12000);

  // ── LIVE MISSILE ALERTS ──────────────────────────────────
  let lastAlertTs = 0; // show all stored events on first load

  function flashLaunchAlert(title, originName, targetName) {
    const banner = document.getElementById('live-launch-banner');
    if (!banner) return;
    const type = title.toLowerCase().includes('drone') ? '🛸' :
                 title.toLowerCase().includes('ballistic') ? '🚀' :
                 title.toLowerCase().includes('rocket') ? '💥' : '🚀';
    banner.innerHTML = `${type} <b>LIVE LAUNCH DETECTED</b> &mdash; ${title}` +
      (originName ? ` &bull; Origin: ${originName}` : '') +
      (targetName ? ` &bull; Target: ${targetName}` : '');
    banner.style.display = 'block';
    setTimeout(() => { banner.style.display = 'none'; }, 15000);
  }

  function animateLiveEvent(event) {
    if (!event.origin || !event.target) return;

    const from = { lat: event.origin.coords[0], lng: event.origin.coords[1] };
    const to   = { lat: event.target.coords[0], lng: event.target.coords[1] };
    const color = event.origin.color || '#f85149';
    const path  = arcPath(from, to);

    // Draw trajectory line
    const line = L.polyline(path, {
      color, weight: 1.5, opacity: 0.5, dashArray: '4 5',
    }).addTo(map);
    setTimeout(() => map.removeLayer(line), 30000);

    // Origin pulse
    const originMarker = L.marker([from.lat, from.lng], { icon: pulsingIcon(color) }).addTo(map);
    originMarker.bindPopup(`<b style="color:${color}">🚀 LAUNCH DETECTED</b><br>${event.title}<br><i>${event.source}</i>`);
    setTimeout(() => map.removeLayer(originMarker), 20000);

    // Animate missile
    animateMissile(map, path, color, 5000, () => {
      const m = L.circleMarker([to.lat, to.lng], {
        radius: 12, color, fillColor: color, fillOpacity: 0.4, weight: 2,
      }).addTo(map);
      setTimeout(() => map.removeLayer(m), 3000);
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

  // Poll for live missile events every 30 seconds
  fetchLiveMissileAlerts();
  setInterval(fetchLiveMissileAlerts, 30000);

  return map;
}

document.addEventListener('DOMContentLoaded', initMap);
