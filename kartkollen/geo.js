// Projection and scoring. No DOM here. Everything scores on the sphere (km), never in pixels,
// so zoom level and screen size can't change whether an answer is right.
window.KK = window.KK || {};
(function (KK) {
  const R = 6371.0088; // mean Earth radius, km
  const D = Math.PI / 180;

  // Natural Earth projection (Šavrič et al.), same coefficients as d3-geo's geoNaturalEarth1,
  // and the same scale/translate that land.js was generated with.
  const SCALE = 178, TX = 500, TY = 262;
  KK.MAP_W = 1000;
  KK.MAP_H = 524;

  function xFactor(phi) {
    const p2 = phi * phi, p4 = p2 * p2;
    return 0.8707 - 0.131979 * p2 + p4 * (-0.013791 + p4 * (0.003971 * p2 - 0.001529 * p4));
  }
  function yRaw(phi) {
    const p2 = phi * phi, p4 = p2 * p2;
    return phi * (1.007226 + p2 * (0.015085 + p4 * (-0.044475 + 0.028874 * p2 - 0.005916 * p4)));
  }
  const Y_MAX = yRaw(Math.PI / 2);

  KK.project = function (lon, lat) {
    const phi = lat * D;
    return [TX + SCALE * lon * D * xFactor(phi), TY - SCALE * yRaw(phi)];
  };

  // Map units to [lon, lat]. Points outside the globe snap to its edge, so a tap just above
  // the map counts as the North Pole and one beyond the side counts as ±180°.
  KK.unproject = function (x, y) {
    const Y = Math.max(-Y_MAX, Math.min(Y_MAX, (TY - y) / SCALE));
    let phi = Y;
    for (let i = 0; i < 25; i++) {
      const p2 = phi * phi, p4 = p2 * p2;
      const d = (yRaw(phi) - Y) /
        (1.007226 + p2 * (0.015085 * 3 + p4 * (-0.044475 * 7 + 0.028874 * 9 * p2 - 0.005916 * 11 * p4)));
      phi -= d;
      if (Math.abs(d) < 1e-9) break;
    }
    phi = Math.max(-Math.PI / 2, Math.min(Math.PI / 2, phi));
    const lam = ((x - TX) / SCALE) / xFactor(phi);
    return [Math.max(-180, Math.min(180, lam / D)), phi / D];
  };

  function vec(lon, lat) {
    const l = lon * D, p = lat * D, c = Math.cos(p);
    return [c * Math.cos(l), c * Math.sin(l), Math.sin(p)];
  }
  const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
  const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
  const unvec = v => [Math.atan2(v[1], v[0]) / D, Math.atan2(v[2], Math.hypot(v[0], v[1])) / D];
  const angle = (a, b) => Math.atan2(Math.hypot(...cross(a, b)), dot(a, b));

  KK.haversine = function (lon1, lat1, lon2, lat2) {
    const dp = (lat2 - lat1) * D, dl = (lon2 - lon1) * D;
    const h = Math.sin(dp / 2) ** 2 + Math.cos(lat1 * D) * Math.cos(lat2 * D) * Math.sin(dl / 2) ** 2;
    return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
  };

  // Closest point on the great-circle arc a-b to p. Works on unit vectors, so the antimeridian
  // and the poles need no special handling.
  function closestOnArc(p, a, b) {
    const n = cross(a, b), nl = Math.hypot(...n);
    if (nl > 1e-12) {
      const s = dot(p, n) / (nl * nl);
      const q = [p[0] - n[0] * s, p[1] - n[1] * s, p[2] - n[2] * s];
      const ql = Math.hypot(...q);
      if (ql > 1e-12) {
        const u = [q[0] / ql, q[1] / ql, q[2] / ql];
        // u lies on the arc when it sits on the inner side of both end points.
        if (dot(cross(a, u), n) >= 0 && dot(cross(u, b), n) >= 0) return u;
      }
    }
    return angle(p, a) <= angle(p, b) ? a : b;
  }

  function nearestOnPath(lon, lat, path, closed) {
    const p = vec(lon, lat);
    let best = null, bestA = Infinity;
    const n = path.length, last = closed ? n : n - 1;
    for (let i = 0; i < last; i++) {
      const a = vec(path[i][0], path[i][1]), b = vec(path[(i + 1) % n][0], path[(i + 1) % n][1]);
      const c = closestOnArc(p, a, b), ang = angle(p, c);
      if (ang < bestA) { bestA = ang; best = c; }
    }
    return { km: bestA * R, at: unvec(best) };
  }

  // Rings are authored in lon/lat and must not cross ±180°. A place that does would be split
  // into two rings. Testing inside/outside on the flat lon/lat plane is accurate enough here.
  function insideRing(lon, lat, ring) {
    let inside = false;
    for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
      const [xi, yi] = ring[i], [xj, yj] = ring[j];
      if ((yi > lat) !== (yj > lat) && lon < ((xj - xi) * (lat - yi)) / (yj - yi) + xi) inside = !inside;
    }
    return inside;
  }

  // Returns {tier:'right'|'near'|'wrong', km, inside, at:[lon,lat]}, where `at` is the closest
  // point of the place to the pin.
  KK.score = function (place, lon, lat) {
    const g = place.geo;
    let km, at, inside = false;
    if (g.shape === 'point') {
      km = KK.haversine(lon, lat, g.at[0], g.at[1]);
      at = g.at;
    } else if (g.shape === 'parallel') {
      // A whole circle of latitude: the Equator (lat 0) or a pole (lat ±90). Longitude doesn't matter.
      km = Math.abs(lat - g.lat) * D * R;
      at = [lon, g.lat];
    } else if (g.shape === 'line') {
      let b = null;
      for (const path of g.lines) {
        const r = nearestOnPath(lon, lat, path, false);
        if (!b || r.km < b.km) b = r;
      }
      km = b.km; at = b.at;
    } else {
      inside = g.rings.some(r => insideRing(lon, lat, r));
      let b = null;
      for (const ring of g.rings) {
        const r = nearestOnPath(lon, lat, ring, true);
        if (!b || r.km < b.km) b = r;
      }
      km = inside ? 0 : b.km;
      at = inside ? [lon, lat] : b.at;
    }
    const tier = km <= place.ok ? 'right' : km <= place.near ? 'near' : 'wrong';
    return { tier, km, inside, at };
  };

  // --- Drawing helpers: straight lon/lat segments curve on this projection, so densify them.
  function densify(path, closed) {
    const out = [], n = path.length, last = closed ? n : n - 1;
    for (let i = 0; i < last; i++) {
      const a = path[i], b = path[(i + 1) % n];
      const steps = Math.max(1, Math.ceil(Math.max(Math.abs(b[0] - a[0]), Math.abs(b[1] - a[1])) / 2));
      for (let s = 0; s < steps; s++) out.push(KK.project(a[0] + ((b[0] - a[0]) * s) / steps, a[1] + ((b[1] - a[1]) * s) / steps));
    }
    if (!closed) out.push(KK.project(path[n - 1][0], path[n - 1][1]));
    return out;
  }
  const toD = pts => 'M' + pts.map(p => p[0].toFixed(1) + ' ' + p[1].toFixed(1)).join('L');

  // Returns {kind:'area'|'line'|'point', d, at, bbox:[x0,y0,x1,y1]} in map units.
  KK.featureShape = function (place) {
    const g = place.geo;
    let pts = [], d = '', kind;
    if (g.shape === 'point') {
      const c = KK.project(g.at[0], g.at[1]);
      return { kind: 'point', at: c, bbox: [c[0], c[1], c[0], c[1]] };
    }
    if (g.shape === 'parallel') {
      kind = 'line';
      pts = densify([[-180, g.lat], [180, g.lat]], false);
      d = toD(pts);
    } else if (g.shape === 'line') {
      kind = 'line';
      for (const path of g.lines) { const q = densify(path, false); pts = pts.concat(q); d += toD(q); }
    } else {
      kind = 'area';
      for (const ring of g.rings) { const q = densify(ring, true); pts = pts.concat(q); d += toD(q) + 'Z'; }
    }
    const xs = pts.map(p => p[0]), ys = pts.map(p => p[1]);
    return { kind, d, bbox: [Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)] };
  };
})(window.KK);
