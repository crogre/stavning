// Generates kartkollen/map-data.js: land, rivers and lakes projected with Equal Earth.
// Run once when the map itself should change; the page never needs this script.
//
//   npm i world-atlas@2.0.2 topojson-client@3 topojson-simplify@3 d3-geo@3
//   node build-map.mjs <land-50m.json> <dir with ne_50m_*.geojson> <out.js> [minLandWeight]
//
// Rivers and lakes: ne_50m_rivers_lake_centerlines, ne_10m_rivers_lake_centerlines and
// ne_50m_lakes from https://github.com/nvkelso/natural-earth-vector (public domain).
import fs from 'node:fs';
import { geoEqualEarth, geoPath, geoArea, geoLength } from 'd3-geo';
import { feature } from 'topojson-client';
import { presimplify, simplify } from 'topojson-simplify';

const [, , landSrc, neDir, out, minW = '0.02'] = process.argv;
const R = 6371.0088;

// Must match SCALE, TX and TY in geo.js.
const SCALE = 180, TX = 500, TY = 251;
const proj = geoEqualEarth().scale(SCALE).translate([TX, TY]).precision(0.1);

const RIVER_MAJOR_RANK = 3;   // shown at every zoom level
const RIVER_MAX_RANK = 5;     // Natural Earth's own importance rank, 1 is the most important
const RIVER_MIN_KM = 500;     // a lower-ranked river still counts if it is this long in total
const LAKE_MIN_KM2 = 1000;    // Mälaren and Vättern just make it, Hjälmaren doesn't
const RIVER_TOL = 0.2, LAKE_TOL = 0.12; // simplification, map units (1 unit is about 40 km)
const MIN_ISLAND = 0.00002;   // steradians
// Rivers Swedish pupils will look for, even though they're small on a world scale.
const ALWAYS = new Set(['Dalälven', 'Göta älv']);
const RIVER_10M_MIN_KM = 1000; // long rivers that are only in the 1:10m file
const FROM_10M = new Set(['Chao Phraya', 'Gambia', 'Cunene', 'Essequibo', 'Zeya', 'Weser', 'Ussuri', 'Sava']);

const read = n => JSON.parse(fs.readFileSync(`${neDir}/${n}.geojson`, 'utf8'));
const r1 = v => Math.round(v * 10) / 10;
const f1 = v => r1(v).toString().replace(/^0\./, '.').replace(/^-0\./, '-.');
const pair = (a, b) => { const s = f1(b); return f1(a) + (s[0] === '-' ? '' : ' ') + s; };

// Compact relative SVG path, 0.1 map unit precision.
function compact(d) {
  const toks = d.match(/[MLZ]|-?\d+(?:\.\d+)?/g);
  let o = '', i = 0, px = 0, py = 0, cmd = 'M';
  while (i < toks.length) {
    const t = toks[i];
    if (t === 'Z') { o += 'z'; i++; continue; }
    if (t === 'M' || t === 'L') { cmd = t; i++; }
    const x = +toks[i++], y = +toks[i++];
    if (cmd === 'M') { o += 'M' + pair(x, y); px = r1(x); py = r1(y); cmd = 'L'; } else {
      const dx = r1(x - px), dy = r1(y - py);
      if (dx === 0 && dy === 0) continue;
      o += 'l' + pair(dx, dy); px = r1(px + dx); py = r1(py + dy);
    }
  }
  return o;
}

// Douglas-Peucker on projected points.
function dp(pts, tol) {
  if (pts.length < 3) return pts;
  const keep = new Uint8Array(pts.length); keep[0] = keep[pts.length - 1] = 1;
  const stack = [[0, pts.length - 1]];
  while (stack.length) {
    const [a, b] = stack.pop();
    const [ax, ay] = pts[a], [bx, by] = pts[b];
    const dx = bx - ax, dy = by - ay, l2 = dx * dx + dy * dy;
    let best = 0, at = -1;
    for (let i = a + 1; i < b; i++) {
      const t = l2 ? Math.max(0, Math.min(1, ((pts[i][0] - ax) * dx + (pts[i][1] - ay) * dy) / l2)) : 0;
      const d = Math.hypot(pts[i][0] - ax - t * dx, pts[i][1] - ay - t * dy);
      if (d > best) { best = d; at = i; }
    }
    if (best > tol) { keep[at] = 1; stack.push([a, at], [at, b]); }
  }
  return pts.filter((_, i) => keep[i]);
}
const openD = pts => 'M' + pts.map(p => p[0].toFixed(2) + ' ' + p[1].toFixed(2)).join('L');
const lines = g => g.type === 'LineString' ? [g.coordinates] : g.coordinates;
const polys = g => g.type === 'Polygon' ? [g.coordinates] : g.coordinates;

// --- Land
let topo = JSON.parse(fs.readFileSync(landSrc, 'utf8'));
topo = simplify(presimplify(topo), +minW);
const landF = feature(topo, topo.objects.land);
const landG = landF.features ? landF.features[0].geometry : landF.geometry;
const landP = landG.coordinates.filter(c => geoArea({ type: 'Polygon', coordinates: c }) > MIN_ISLAND);
const path = geoPath(proj).digits(1);
const LAND_D = compact(path({ type: 'MultiPolygon', coordinates: landP }));
const SPHERE_D = compact(path({ type: 'Sphere' }));

// --- Rivers. Canals stay out: the Panama Canal is an answer in the game.
const rivers = read('ne_50m_rivers_lake_centerlines').features.filter(f => !/canal/i.test(f.properties.name || ''));
const lengthByName = {};
for (const f of rivers) {
  const n = f.properties.name; if (!n) continue;
  lengthByName[n] = (lengthByName[n] || 0) + geoLength(f.geometry) * R;
}
const keptRivers = rivers.filter(f => f.properties.scalerank <= RIVER_MAX_RANK ||
  ALWAYS.has(f.properties.name) || (lengthByName[f.properties.name] || 0) >= RIVER_MIN_KM);
// The 1:50m file leaves out some long rivers that the 1:10m file has, so take those from there.
const norm = s => (s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/\s+/g, ' ').trim();
const have50 = new Set(rivers.map(f => norm(f.properties.name)));
const rivers10 = read('ne_10m_rivers_lake_centerlines').features.filter(f => {
  const n = f.properties.name; return n && !/canal/i.test(n) && !have50.has(norm(n));
});
const length10 = {};
for (const f of rivers10) length10[f.properties.name] = (length10[f.properties.name] || 0) + geoLength(f.geometry) * R;
const added10 = rivers10.filter(f => length10[f.properties.name] >= RIVER_10M_MIN_KM || FROM_10M.has(f.properties.name));
console.log('added from 1:10m:', [...new Set(added10.map(f => f.properties.name))].join(', '));
keptRivers.push(...added10);

// Natural Earth stops the Amazon at the Xingu, about 300 km short of the Atlantic. Hand-drawn past
// Gurupá and Macapá along the northern channel. Keep in step with amazonfloden in places.js.
keptRivers.push({ properties: { name: 'Amazon mouth' }, geometry: { type: 'LineString', coordinates: [
  [-52.66, -1.55], [-51.65, -1.35], [-51.1, -0.4], [-50.7, 0.1], [-49.9, 0.5]
] } });

// Two layers: the biggest rivers always show, the rest only when zoomed in, or the whole-world
// view on a phone turns into a tangle.
let RIVERS_D = '', RIVERS_MINOR_D = '';
for (const f of keptRivers) for (const l of lines(f.geometry)) {
  const pts = dp(l.map(c => proj(c)), RIVER_TOL);
  if (pts.length < 2) continue;
  const d = compact(openD(pts));
  if (f.properties.scalerank === undefined || f.properties.scalerank <= RIVER_MAJOR_RANK) {
    if (!added10.includes(f)) { RIVERS_D += d; continue; }
  }
  RIVERS_MINOR_D += d;
}

// --- Lakes. Rings are projected point by point, so ring direction doesn't matter here;
// for the area, a ring wound the wrong way would measure as nearly the whole sphere.
const lakeKm2 = f => polys(f.geometry).reduce((s, c) => {
  const a = geoArea({ type: 'Polygon', coordinates: c });
  return s + Math.min(a, 4 * Math.PI - a) * R * R;
}, 0);
const allLakes = read('ne_50m_lakes').features;
const keptLakes = allLakes.filter(f => lakeKm2(f) >= LAKE_MIN_KM2);
let LAKES_D = '';
for (const f of keptLakes) for (const poly of polys(f.geometry)) for (const ring of poly) {
  const pts = ring.map(c => proj(c)); pts.pop();
  let far = 0, bd = 0;
  pts.forEach((p, i) => { const d = Math.hypot(p[0] - pts[0][0], p[1] - pts[0][1]); if (d > bd) { bd = d; far = i; } });
  const a = dp(pts.slice(0, far + 1), LAKE_TOL), b = dp(pts.slice(far).concat([pts[0]]), LAKE_TOL);
  const q = a.concat(b.slice(1, -1));
  if (q.length > 2) LAKES_D += compact(openD(q)) + 'z';
}

const js = `// GENERATED by tools/build-map.mjs. Do not edit by hand.
// Natural Earth 1:50m land, rivers and lakes (public domain, naturalearthdata.com). Land comes via
// the world-atlas npm package 2.0.2 (ISC, Copyright 2013-2019 Michael Bostock).
// Equal Earth projection, scale ${SCALE}, translate [${TX},${TY}]. Map units: see KK.project in geo.js.
window.KK = window.KK || {};
KK.LAND_D = ${JSON.stringify(LAND_D)};
KK.SPHERE_D = ${JSON.stringify(SPHERE_D)};
KK.RIVERS_D = ${JSON.stringify(RIVERS_D)};
KK.RIVERS_MINOR_D = ${JSON.stringify(RIVERS_MINOR_D)};
KK.LAKES_D = ${JSON.stringify(LAKES_D)};
`;
fs.writeFileSync(out, js);

const b = geoPath(proj).bounds({ type: 'Sphere' });
console.log('sphere bounds', JSON.stringify(b));
console.log(`bytes total ${js.length}, land ${LAND_D.length}, rivers ${RIVERS_D.length} + ${RIVERS_MINOR_D.length} (${keptRivers.length} features), lakes ${LAKES_D.length} (${keptLakes.length} of ${allLakes.length})`);

// --- What made it in, against lists a geography teacher would expect.
const riverNames = new Set(keptRivers.map(f => f.properties.name));
const lakeNames = new Set(keptLakes.map(f => f.properties.name));
const wantR = ['Nile', 'Amazonas', 'Mississippi', 'Missouri', 'Murray', 'Darling', 'Congo', 'Niger', 'Zambezi', 'Orange', 'Limpopo', 'Okavango', 'Volta', 'Senegal', 'Sénégal',
  'Volga', 'Danube', 'Donau', 'Rhine', 'Rhein', 'Elbe', 'Oder', 'Vistula', 'Dnipro', 'Don', 'Loire', 'Seine', 'Rhône', 'Po', 'Tajo', 'Dalälven', 'Göta älv', 'Ural', 'Pechora',
  'Ob', 'Irtysh', 'Yenisey', 'Lena', 'Amur', 'Kolyma', 'Angara', 'Chang Jiang', 'Huang', 'Mekong', 'Salween', 'Irrawaddy', 'Ayeyarwady', 'Ganges', 'Brahmaputra', 'Indus', 'Euphrates', 'Tigris', 'Amu  Darya', 'Syr Darya', 'Tarim',
  'Mackenzie', 'Yukon', 'St. Lawrence', 'Colorado', 'Columbia', 'Rio Grande', 'Ohio', 'Arkansas', 'Nelson', 'Fraser', 'Paraná', 'Uruguay', 'Paraguay', 'Orinoco', 'Madeira', 'Tocantins', 'São  Francisco', 'Negro', 'Purús', 'Xingu', 'Magdalena'];
const wantL = ['Lake Superior', 'Lake Michigan', 'Lake Huron', 'Lake Erie', 'Lake Ontario', 'Great Bear Lake', 'Great Slave Lake', 'Lake Winnipeg', 'Great Salt Lake', 'Lago de Nicaragua', 'Lago Titicaca',
  'Lake Victoria', 'Lake Tanganyika', 'Lake Malawi', 'Lake Chad', 'Lake Turkana', 'Lake Albert', 'Lake Tana', 'Lake Kariba', 'Lake Nasser', 'Lake Volta',
  'Lake Baikal', 'Lake Balkhash', 'North Aral Sea', 'South Aral Sea', 'Issyk-Kul', 'Qinghai Hu', 'Lake Van', 'Lake Urmia', 'Lake Ladoga', 'Lake Onega', 'Lake Peipus', 'Vänern', 'Vättern', 'Mälaren', 'Lake Saimaa', 'Inarijärvi'];
console.log('missing rivers:', wantR.filter(n => !riverNames.has(n)).join(', ') || 'none');
console.log('missing lakes:', wantL.filter(n => !lakeNames.has(n)).join(', ') || 'none');
console.log('lake km2:', ['Vänern', 'Vättern', 'Mälaren', 'Hjälmaren', 'Lake Victoria', 'Lake Superior'].map(n => `${n}=${Math.round(allLakes.filter(f => f.properties.name === n).reduce((s, f) => s + lakeKm2(f), 0))}`).join(' '));
for (const re of [/yukon/i, /yenis/i, /loire/i, /paraguay/i, /xingu/i, /nile|bahr el|abay/i, /amazon|ucayali|mara|solim/i]) {
  console.log(String(re), [...new Set(rivers.filter(f => re.test(f.properties.name || '')).map(f => `${f.properties.name}(${f.properties.scalerank}/${f.properties.featurecla === 'River' ? 'r' : 'l'}/${Math.round(geoLength(f.geometry) * R)}km)`))].join(' '));
}
