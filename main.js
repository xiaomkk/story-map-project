// Blueprint Story Map - v2

// --- Map setup ---
const map = L.map('map', {
  zoomControl: false,       // we'll add our own in bottom-right
  preferCanvas: true,
  scrollWheelZoom: false,   // keep scroll for slide navigation
  inertia: true
}).setView([39.9526, -75.1652], 11.5);

// CARTO light tiles => crisp linework; colorized via CSS overlay (see style.css)
const tiles = L.tileLayer(
  'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png',
  {
    maxZoom: 19,
    attribution: '&copy; OpenStreetMap contributors &copy; CARTO'
  }
).addTo(map);

// Custom-positioned zoom control (bottom-right)
L.control.zoom({ position: 'bottomright' }).addTo(map);

// Scale
L.control.scale({ metric: false, position: 'bottomright' }).addTo(map);

// --- Performance-friendly renderers ---
const canvasRenderer = L.canvas({ padding: 0.5 });

// --- Utilities ---
function firstProp(obj, keys) {
  for (const k of keys) {
    if (obj[k] !== undefined && obj[k] !== null && obj[k] !== '') return obj[k];
  }
  return undefined;
}
function numberOr(obj, keys, fallback = 0) {
  const v = firstProp(obj, keys);
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

// --- Layers ---
const layers = {
  hvi: L.geoJSON(null, {
    renderer: canvasRenderer,
    smoothFactor: 0.5,
    interactive: false,
    style: f => {
      const s = numberOr(f.properties, ['hvi_score','HVI_SCORE','HVI','hvi','score','SCORE'], 0);
      // blueprint-friendly fill grades
      let stroke = '#bfe8ff', fill = '#113a79';
      if (s >= 4) fill = '#0e2c5b';
      else if (s >= 3) fill = '#103468';
      else if (s >= 2) fill = '#123e7b';
      else fill = '#14508f';
      return { color: stroke, weight: 0.45, fillColor: fill, fillOpacity: 0.55 };
    }
  }),

  hoods: L.geoJSON(null, {
    renderer: canvasRenderer,
    interactive: false,
    style: () => ({ color: '#ffffff', weight: 0.6, opacity: .7, fillOpacity: 0 })
  }),

  pools: L.geoJSON(null, {
    renderer: canvasRenderer,
    pointToLayer: (f, latlng) =>
      L.circleMarker(latlng, {
        radius: 6, color: '#fff', weight: 1,
        fillColor: '#7cc6ff', fillOpacity: 0.95
      }).bindPopup(`<strong>${firstProp(f.properties, ['NAME','POOL_NAME','SITE_NAME','name']) ?? 'Pool'}</strong><br>${firstProp(f.properties, ['ADDRESS','ADDRESS1','address']) ?? ''}`)
  }),

  sites: L.geoJSON(null, {
    renderer: canvasRenderer,
    pointToLayer: (f, latlng) =>
      L.circleMarker(latlng, {
        radius: 6, color: '#fff', weight: 1,
        fillColor: '#2dd4bf', fillOpacity: 0.95
      }).bindPopup(`<strong>${firstProp(f.properties, ['SITE_NAME','NAME','name']) ?? 'PPR Site'}</strong><br>${firstProp(f.properties, ['ADDRESS','ADDRESS1','address']) ?? ''}`)
  })
};

// --- Data load ---
Promise.all([
  fetch('data/heat_vulnerability_ct.geojson').then(r => r.json()),
  fetch('data/philadelphia_neighborhoods.geojson').then(r => r.json()),
  fetch('data/ppr_swimming_pools.geojson').then(r => r.json()),
  fetch('data/ppr_program_sites.geojson').then(r => r.json())
]).then(([hvi, hoods, pools, sites]) => {
  layers.hvi.addData(hvi);
  layers.hoods.addData(hoods);
  layers.pools.addData(pools);
  layers.sites.addData(sites);
}).catch(err => console.error('Data load error:', err));

// --- Slide logic ---
const slides = [...document.querySelectorAll('.slide')];
const dots = document.getElementById('dots');
let idx = 0;

// Dot nav
slides.forEach((_, i) => {
  const b = document.createElement('button');
  b.setAttribute('aria-label', `Go to slide ${i+1}`);
  b.addEventListener('click', () => goTo(i));
  dots.appendChild(b);
});
function updateDots() {
  [...dots.children].forEach((d,i) => d.classList.toggle('active', i === idx));
}
updateDots();

function activateLayers(stepEl){
  const layerKey = stepEl.dataset.layer;
  const fit = (stepEl.dataset.fit || '').split(',').filter(Boolean);
  const center = (stepEl.dataset.center || '').split(',').map(Number);
  const zoom = Number(stepEl.dataset.zoom || map.getZoom());

  Object.values(layers).forEach(l => map.removeLayer(l));
  if (layerKey && layers[layerKey]) layers[layerKey].addTo(map);
  if (fit.length) {
    const group = L.featureGroup(fit.map(k => layers[k]).filter(Boolean));
    if (group.getLayers().length) map.fitBounds(group.getBounds().pad(0.15), { animate: true, duration: 1.0 });
  } else if (center.length === 2 && !Number.isNaN(center[0])) {
    map.flyTo(center, zoom, { animate: true, duration: 1.0 });
  }
}

function goTo(i){
  idx = Math.max(0, Math.min(slides.length - 1, i));
  slides.forEach((s, j) => s.classList.toggle('active', j === idx));
  slides[idx].scrollIntoView({ behavior: 'smooth', block: 'start' });
  activateLayers(slides[idx]);
  updateDots();
}

// IntersectionObserver for visible slide
const io = new IntersectionObserver((entries) => {
  entries.forEach(e => {
    if (e.isIntersecting) {
      const newIdx = slides.indexOf(e.target);
      if (newIdx !== idx) {
        idx = newIdx;
        slides.forEach((s, j) => s.classList.toggle('active', j === idx));
        activateLayers(slides[idx]);
        updateDots();
      }
    }
  });
}, {threshold: 0.6});
slides.forEach(s => io.observe(s));

// Prev/Next + keyboard
document.getElementById('prevBtn').addEventListener('click', () => goTo(idx-1));
document.getElementById('nextBtn').addEventListener('click', () => goTo(idx+1));
window.addEventListener('keydown', (e) => {
  if (e.key === 'ArrowDown' || e.key === 'PageDown' || e.key === ' ') goTo(idx+1);
  if (e.key === 'ArrowUp' || e.key === 'PageUp') goTo(idx-1);
});

// Sources modal
const modal = document.getElementById('sources');
const sourcesBtn = document.getElementById('sourcesBtn');
if (sourcesBtn) {
  sourcesBtn.addEventListener('click', () => modal.showModal());
}

// Initial activation
activateLayers(slides[0]);
