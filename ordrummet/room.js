/* Ordrummet: 3D-rummet. Allt är enkel geometri som ritas här, inga externa modeller.
 * Telefonen ska orka: statiska möbler slås ihop till få ritanrop, skuggorna är mjuka fläckar i stället för
 * shadow maps, och det renderas bara när något faktiskt rör sig.
 */
import * as THREE from './vendor/three-0.170.0.module.min.js';

const C = window.OrdrumCore;
const COL = {
  woodL: 0xCFA377, woodM: 0xA9774F, woodD: 0x7D5337, white: 0xF3EEE4, cream: 0xE9DFCB, ink: 0x3A3430, grey: 0x8C8A85, metal: 0xB9B4AA,
  teal: 0x3E7C73, tealD: 0x2E5F58, terra: 0xC4633F, mustard: 0xD9A441, plum: 0x6E4E6A, leaf: 0x5E8C5A, leafD: 0x477048, sky: 0x8FBFD6,
  rose: 0xD98C8C, blue: 0x5B7F95, gold: 0xE2B33C, wall1: 0xE9E2D2, wall2: 0xDDD6C2, base: 0xF7F3EA, orange: 0xE08A3C, black: 0x26231F,
};
const WALL_H = 2.85, WALL_T = 0.12, ROOM = 3, CAT_SCALE = 1.3;

/* ---------- geometry helpers ---------- */
const matCache = new Map();
const lit = c => { const k = 'l' + c; if (!matCache.has(k)) matCache.set(k, new THREE.MeshLambertMaterial({ color: c })); return matCache.get(k); };
const glow = c => { const k = 'g' + c; if (!matCache.has(k)) matCache.set(k, new THREE.MeshBasicMaterial({ color: c })); return matCache.get(k); };
const see = (c, o) => { const k = 's' + c + o; if (!matCache.has(k)) matCache.set(k, new THREE.MeshLambertMaterial({ color: c, transparent: true, opacity: o, depthWrite: false })); return matCache.get(k); };
const geoCache = new Map();
const geo = (key, make) => { if (!geoCache.has(key)) geoCache.set(key, make()); return geoCache.get(key); };
const UNIT_BOX = () => geo('box', () => new THREE.BoxGeometry(1, 1, 1));

function add(g, geometry, mat, x, y, z, rot, scale) {
  const m = new THREE.Mesh(geometry, typeof mat === 'number' ? lit(mat) : mat);
  m.position.set(x, y, z);
  if (rot) m.rotation.set(rot[0] || 0, rot[1] || 0, rot[2] || 0);
  if (scale) m.scale.set(scale[0], scale[1], scale[2]);
  g.add(m);
  return m;
}
/** Box standing on y (y is its underside). */
const box = (g, w, h, d, c, x = 0, y = 0, z = 0, rot) => add(g, UNIT_BOX(), c, x, y + h / 2, z, rot, [w, h, d]);
/** Cylinder standing on y. */
const cyl = (g, rt, rb, h, c, x = 0, y = 0, z = 0, seg = 12, rot) => add(g, geo(`c${rt}|${rb}|${h}|${seg}`, () => new THREE.CylinderGeometry(rt, rb, h, seg)), c, x, y + h / 2, z, rot);
const ball = (g, r, c, x = 0, y = 0, z = 0, s = [1, 1, 1], seg = 10, rot) => add(g, geo(`s${seg}`, () => new THREE.SphereGeometry(1, seg, Math.max(6, seg - 2))), c, x, y, z, rot, [r * s[0], r * s[1], r * s[2]]);
const cone = (g, r, h, c, x, y, z, seg = 8, rot) => add(g, geo(`k${r}|${h}|${seg}`, () => new THREE.ConeGeometry(r, h, seg)), c, x, y, z, rot);

function canvasTex(w, h, paint) {
  const cv = document.createElement('canvas'); cv.width = w; cv.height = h;
  paint(cv.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 2;
  return t;
}
const texMat = (tex, unlit) => unlit ? new THREE.MeshBasicMaterial({ map: tex }) : new THREE.MeshLambertMaterial({ map: tex });
const plane = (g, w, h, mat, x, y, z, rot) => add(g, new THREE.PlaneGeometry(w, h), mat, x, y, z, rot);

/** Merges a group's untextured meshes by material so a whole bookshelf is a handful of draw calls. */
function mergeGroup(g) {
  const buckets = new Map();
  for (const m of [...g.children]) {
    if (!m.isMesh || m.material.map || m.userData.keep) continue;
    m.updateMatrix();
    if (!buckets.has(m.material)) buckets.set(m.material, []);
    buckets.get(m.material).push(m);
    g.remove(m);
  }
  for (const [mat, list] of buckets) {
    const pos = [], nor = [], idx = []; let offset = 0;
    for (const m of list) {
      const geom = m.geometry.clone().applyMatrix4(m.matrix);
      pos.push(...geom.attributes.position.array); nor.push(...geom.attributes.normal.array);
      for (const i of geom.index.array) idx.push(i + offset);
      offset += geom.attributes.position.count; geom.dispose();
    }
    const out = new THREE.BufferGeometry();
    out.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    out.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
    out.setIndex(idx);
    g.add(new THREE.Mesh(out, mat));
  }
}

let softTex = null;
function softTexture() {
  if (softTex) return softTex;
  softTex = canvasTex(64, 64, (c, w) => { const r = c.createRadialGradient(w / 2, w / 2, 2, w / 2, w / 2, w / 2); r.addColorStop(0, 'rgba(255,255,255,1)'); r.addColorStop(.55, 'rgba(255,255,255,.55)'); r.addColorStop(1, 'rgba(255,255,255,0)'); c.fillStyle = r; c.fillRect(0, 0, w, w); });
  return softTex;
}
function blob(g, w, d, opacity = 0.26) {
  const m = plane(g, w, d, new THREE.MeshBasicMaterial({ map: softTexture(), color: 0x3b2c1e, transparent: true, opacity, depthWrite: false }), 0, 0.012, 0, [-Math.PI / 2]);
  m.renderOrder = 1; m.userData.keep = true; return m;
}
function halo(g, size, x, y, z, color = 0xFFD9A0, opacity = .55, rot) {
  const m = plane(g, size, size, new THREE.MeshBasicMaterial({ map: softTexture(), color, transparent: true, opacity, depthWrite: false, blending: THREE.AdditiveBlending }), x, y, z, rot);
  m.renderOrder = 2; m.userData.keep = true; return m;
}

/* ---------- the furniture ----------
 * Each builder draws in local coordinates: the pivot is the middle of the footprint at floor level,
 * or the middle of the reserved rectangle on the wall (local +z points out of the wall).
 */
const BUILD = {
  bed(g) {
    for (const [x, z] of [[-.52, -.97], [.52, -.97], [-.52, .97], [.52, .97]]) box(g, .08, .12, .08, COL.woodD, x, 0, z);
    box(g, 1.2, .2, 2.1, COL.woodM, 0, .12, 0);
    box(g, 1.1, .17, 2.0, COL.white, 0, .32, 0);
    box(g, 1.16, .27, 1.34, COL.teal, 0, .25, .36);
    box(g, 1.17, .03, .28, COL.cream, 0, .52, -.18);
    box(g, .82, .13, .42, COL.cream, 0, .49, -.72);
    box(g, 1.2, .95, .08, COL.woodM, 0, 0, -1.01);
    box(g, 1.2, .05, .1, COL.woodD, 0, .95, -1.01);
  },
  desk(g) {
    box(g, 1.6, .05, .75, COL.woodL, 0, .71, 0);
    for (const [x, z] of [[-.74, -.31], [-.74, .31]]) box(g, .06, .71, .06, COL.woodD, x, 0, z);
    box(g, .42, .71, .7, COL.white, .57, 0, 0);
    for (const y of [.08, .31, .54]) { box(g, .36, .17, .02, COL.cream, .57, y, .355); box(g, .1, .018, .02, COL.metal, .57, y + .08, .37); }
    box(g, .3, .01, .22, COL.cream, -.38, .76, .1, [0, .2, 0]);
    cyl(g, .035, .03, .1, COL.terra, -.62, .76, -.22);
  },
  drawers(g) {
    box(g, .55, .8, 1.1, COL.white, 0, .06, 0);
    box(g, .58, .04, 1.14, COL.woodL, 0, .86, 0);
    for (const [x, z] of [[-.22, -.48], [.22, -.48], [-.22, .48], [.22, .48]]) box(g, .05, .06, .05, COL.woodD, x, 0, z);
    for (const y of [.1, .35, .6]) { box(g, .015, .22, 1.02, COL.cream, .28, y, 0); ball(g, .025, COL.woodD, .3, y + .11, -.25); ball(g, .025, COL.woodD, .3, y + .11, .25); }
  },
  lamp(g) {
    cyl(g, .14, .15, .03, COL.ink);
    cyl(g, .016, .016, 1.42, COL.ink, 0, .03, 0, 8);
    add(g, geo('shade', () => new THREE.CylinderGeometry(.13, .2, .26, 12, 1, true)), new THREE.MeshBasicMaterial({ color: 0xFFE7B8, side: THREE.DoubleSide }), 0, 1.5, 0);
    ball(g, .05, glow(0xFFF6DF), 0, 1.47, 0);
    halo(g, 1.5, 0, 1.55, -.16, 0xFFD9A0, .32);
  },
  plant(g) {
    cyl(g, .19, .14, .3, COL.terra);
    cyl(g, .2, .2, .04, 0xB5573A, 0, .28, 0);
    cyl(g, .17, .17, .01, COL.woodD, 0, .32, 0);
    const leaf = (a, tilt, len, c) => { const x = Math.sin(a) * len * .48, z = Math.cos(a) * len * .48; ball(g, len * .55, c, x * Math.sin(tilt) * 1.6, .34 + Math.cos(tilt) * len * .55, z * Math.sin(tilt) * 1.6, [.34, 1, .1], 8, [tilt * Math.cos(a), a, -tilt * Math.sin(a)]); };
    [[0, .35, .78, COL.leaf], [1.25, .7, .68, COL.leafD], [2.5, .55, .72, COL.leaf], [3.75, .75, .64, COL.leafD], [5, .5, .74, COL.leaf], [.6, .15, .84, COL.leafD]].forEach(a => leaf(...a));
  },
  rug(g) {
    box(g, 2.5, .018, 2.2, COL.cream);
    box(g, 2.32, .02, 2.02, COL.terra);
    box(g, 2.14, .022, 1.84, COL.cream);
    for (let i = 0; i < 5; i++) box(g, 2.14, .024, .16, [COL.teal, COL.mustard, COL.teal, COL.mustard, COL.teal][i], 0, 0, -.7 + i * .35);
  },
  bookshelf(g) {
    box(g, .85, 2.1, .03, COL.woodD, 0, 0, -.16);
    for (const x of [-.41, .41]) box(g, .03, 2.1, .35, COL.woodM, x, 0, 0);
    const shelves = [.04, .44, .84, 1.24, 1.64, 2.07];
    for (const y of shelves) box(g, .85, .03, .35, COL.woodM, 0, y, 0);
    const colors = [COL.teal, COL.terra, COL.mustard, COL.plum, COL.blue, COL.cream, COL.rose];
    let n = 0;
    shelves.slice(0, 5).forEach((y, s) => {
      let x = -.36; const end = s === 2 ? .05 : .32;
      while (x < end) {
        const w = .04 + ((n * 7) % 5) * .008, h = .26 + ((n * 3) % 4) * .025;
        box(g, w, h, .2, colors[n % colors.length], x + w / 2, y + .03, .02);
        x += w + .006; n++;
      }
    });
    box(g, .13, .13, .13, COL.white, .24, .87, 0); ball(g, .06, COL.leaf, .24, 1.04, 0);
  },
  chair(g) {
    box(g, .46, .05, .46, COL.woodL, 0, .42, 0);
    for (const [x, z] of [[-.2, -.2], [.2, -.2], [-.2, .2], [.2, .2]]) box(g, .04, .42, .04, COL.woodD, x, 0, z);
    for (const x of [-.2, .2]) box(g, .04, .48, .04, COL.woodD, x, .47, .2);
    box(g, .44, .16, .03, COL.woodL, 0, .78, .2);
    box(g, .4, .03, .4, COL.teal, 0, .47, 0);
  },
  poster(g) {
    box(g, .9, 1.1, .02, COL.ink, 0, -.55, .01);
    const tex = canvasTex(180, 220, (c, w, h) => {
      const sky = c.createLinearGradient(0, 0, 0, h); sky.addColorStop(0, '#F3C78F'); sky.addColorStop(1, '#E98C62'); c.fillStyle = sky; c.fillRect(0, 0, w, h);
      c.fillStyle = '#FBEFC9'; c.beginPath(); c.arc(w * .65, h * .32, 30, 0, 7); c.fill();
      for (const [col, y, a] of [['#7D5A70', .58, 26], ['#55465F', .7, 20], ['#2F3B4C', .84, 14]]) { c.fillStyle = col; c.beginPath(); c.moveTo(0, h); for (let x = 0; x <= w; x += 6) c.lineTo(x, h * y + Math.sin(x * .035 + y * 13) * a); c.lineTo(w, h); c.fill(); }
    });
    plane(g, .84, 1.04, texMat(tex), 0, 0, .025);
  },
  curtains(g) {
    cyl(g, .018, .018, 2.1, COL.woodD, 0, 0, 0, 8, [0, 0, Math.PI / 2]).position.set(.0, .67, .1);
    for (const x of [-1.03, 1.03]) ball(g, .04, COL.woodD, x, .67, .1);
    for (const side of [-1, 1]) for (let i = 0; i < 4; i++) {
      const x = side * (.74 + i * .075);
      cyl(g, .05, .055, 1.4, i % 2 ? COL.rose : 0xE3A3A0, x, -.73, .1, 7);
    }
  },
  clock(g) {
    const r = [Math.PI / 2, 0, 0];
    cyl(g, .25, .25, .04, COL.woodD, 0, -.02, .02, 20, r).position.z = .025;
    cyl(g, .215, .215, .012, COL.white, 0, -.006, .05, 20, r);
    box(g, .018, .12, .008, COL.ink, 0, 0, .06, [0, 0, -2.2]).position.set(.05, .035, .06);
    box(g, .014, .17, .008, COL.ink, 0, 0, .06, [0, 0, .5]).position.set(-.04, .075, .062);
    for (let i = 0; i < 12; i++) { const a = i / 12 * Math.PI * 2; box(g, .012, .012, .006, COL.ink, Math.sin(a) * .18, Math.cos(a) * .18 - .006, .058); }
  },
  beanbag(g) {
    ball(g, .42, COL.mustard, 0, .26, 0, [1, .66, 1.02], 12);
    ball(g, .3, 0xC99238, -.04, .5, -.1, [1, .75, .95], 10);
  },
  guitar(g) {
    const tilt = [-.13, 0, 0], y = .3;
    ball(g, .17, COL.woodL, 0, y, 0, [1, 1.05, .28], 12, tilt);
    ball(g, .13, COL.woodL, 0, y + .24, -.03, [1, 1.05, .28], 12, tilt);
    cyl(g, .05, .05, .012, COL.ink, 0, y + .04, .042, 12, [Math.PI / 2 - .13, 0, 0]);
    box(g, .05, .6, .025, COL.woodD, 0, y + .3, -.05, tilt);
    box(g, .08, .14, .025, COL.woodD, 0, y + .88, -.13, tilt);
    box(g, .02, .03, .13, COL.ink, 0, .01, .08);
    box(g, .3, .025, .025, COL.ink, 0, .03, .1);
  },
  teddy(g) {
    const c = 0xB0814F, d = 0xD6B48A;
    ball(g, .13, c, 0, .13, 0, [1, 1.12, .9]);
    ball(g, .1, c, 0, .32, .01);
    for (const x of [-.08, .08]) { ball(g, .036, c, x, .41, 0); ball(g, .05, c, x * 1.35, .18, .05); ball(g, .055, c, x, .05, .1); }
    ball(g, .042, d, 0, .3, .085);
    ball(g, .012, COL.ink, 0, .315, .122);
    for (const x of [-.034, .034]) ball(g, .011, COL.ink, x, .345, .092, [1, 1, 1], 6);
  },
  laptop(g) {
    box(g, .4, .018, .28, COL.grey);
    box(g, .36, .002, .16, COL.ink, 0, .018, -.03);
    box(g, .4, .26, .012, COL.grey, 0, .01, -.15, [-.2, 0, 0]);
    box(g, .36, .22, .004, glow(0x9CCBE0), 0, .028, -.138, [-.2, 0, 0]);
  },
  aquarium(g) {
    box(g, .3, .025, .6, COL.ink);
    box(g, .28, .03, .58, COL.mustard, 0, .025, 0);
    ball(g, .03, COL.grey, -.03, .07, -.12); ball(g, .025, COL.white, .05, .06, .14);
    for (const [z, h] of [[-.16, .15], [-.1, .2], [.18, .13]]) box(g, .012, h, .03, COL.leaf, -.05, .05, z, [.1, 0, 0]);
    const fish = (x, y, z, c) => { ball(g, .033, c, x, y, z, [.55, .75, 1.1], 7); cone(g, .022, .04, c, x, y, z - .05, 5, [-Math.PI / 2, 0, 0]); };
    fish(.02, .17, -.02, COL.orange); fish(-.05, .22, .12, COL.orange); fish(.04, .26, -.17, 0xE7D35A);
    box(g, .3, .29, .6, see(0x9FD4E4, .34), 0, .025, 0);
    box(g, .3, .018, .6, COL.ink, 0, .315, 0);
  },
  shelf(g) {
    box(g, .24, .03, 1.1, COL.woodL, .0, -.2, 0);
    for (const z of [-.42, .42]) box(g, .03, .14, .03, COL.ink, -.08, -.32, z);
    const cs = [COL.terra, COL.teal, COL.mustard, COL.plum, COL.cream];
    cs.forEach((c, i) => box(g, .15, .26 - (i % 2) * .04, .05, c, 0, -.17, -.42 + i * .058));
    box(g, .15, .05, .2, COL.blue, 0, -.17, .02); box(g, .13, .05, .18, COL.rose, 0, -.12, .02);
    cyl(g, .05, .04, .08, COL.white, 0, -.17, .32); ball(g, .07, COL.leaf, 0, -.03, .32, [1, .8, 1], 7);
  },
  globe(g) {
    cyl(g, .07, .08, .02, COL.woodD);
    cyl(g, .012, .012, .06, COL.woodD, 0, .02, 0, 6);
    const tex = canvasTex(128, 64, (c, w, h) => {
      c.fillStyle = '#6FA6C2'; c.fillRect(0, 0, w, h); c.fillStyle = '#86A86A';
      for (const [x, y, rx, ry] of [[24, 22, 14, 10], [36, 44, 7, 12], [66, 20, 11, 8], [70, 42, 9, 12], [94, 22, 20, 10], [108, 46, 7, 5]]) { c.beginPath(); c.ellipse(x, y, rx, ry, 0, 0, 7); c.fill(); }
    });
    add(g, new THREE.SphereGeometry(.12, 16, 12), texMat(tex), 0, .2, 0, [.2, .6, .35]);
    add(g, new THREE.TorusGeometry(.135, .007, 6, 20, Math.PI * 1.1), lit(COL.metal), 0, .2, 0, [0, 0, 1.2]);
  },
  basket(g) {
    cyl(g, .17, .13, .36, COL.grey, 0, 0, 0, 12);
    cyl(g, .15, .15, .005, COL.ink, 0, .36, 0, 12);
    ball(g, .06, COL.white, -.04, .37, .02, [1, .8, 1], 6); ball(g, .05, COL.cream, .06, .36, -.04, [1, .8, 1], 6);
  },
  cattree(g) {
    box(g, .55, .05, .55, COL.cream);
    cyl(g, .055, .055, .9, COL.woodL, -.1, .05, .1, 8);
    cyl(g, .055, .055, 1.25, COL.woodL, .12, .05, -.12, 8);
    box(g, .36, .04, .36, COL.cream, -.08, .6, .08);
    box(g, .4, .05, .4, COL.cream, .08, 1.3, -.08);
    cyl(g, .13, .13, .04, COL.terra, .08, 1.35, -.08);
    ball(g, .04, COL.mustard, -.2, .52, .28);
    cyl(g, .003, .003, .08, COL.ink, -.2, .55, .28, 4);
  },
  football(g) {
    const tex = canvasTex(96, 48, (c, w, h) => { c.fillStyle = '#F4F0E8'; c.fillRect(0, 0, w, h); c.fillStyle = '#2A2724'; for (const [x, y] of [[12, 12], [36, 8], [60, 14], [84, 8], [24, 30], [48, 26], [72, 32], [10, 44], [40, 44], [86, 42]]) { c.beginPath(); c.arc(x, y, 5.2, 0, 7); c.fill(); } });
    add(g, new THREE.SphereGeometry(.13, 14, 10), texMat(tex), 0, .13, 0, [.3, .9, .2]);
  },
  lights(g) {
    const n = 22, L = 5.8, bulbs = [COL.gold, 0xF4D9A0, 0xF0A36B, 0xF4D9A0];
    for (let i = 0; i < n; i++) {
      const t = i / (n - 1), z = -L / 2 + t * L, y = -.02 - Math.abs(Math.sin(t * Math.PI * 4)) * -.06 - .03;
      const col = glow(bulbs[i % bulbs.length]);
      ball(g, .026, col, z * -1, y, .02, [1, 1, 1], 6);
      if (i < n - 1) { const t2 = (i + 1) / (n - 1), z2 = -L / 2 + t2 * L, y2 = -.02 - Math.abs(Math.sin(t2 * Math.PI * 4)) * -.06 - .03; const len = Math.hypot(z2 - z, y2 - y), a = Math.atan2(y2 - y, -(z2 - z)); box(g, len, .004, .004, COL.ink, -(z + z2) / 2, (y + y2) / 2 - .002, .01, [0, 0, a]); }
    }
  },
  pennants(g) {
    const cs = [COL.terra, COL.mustard, COL.teal, COL.rose, COL.blue, COL.plum], n = 8, L = 1.9;
    box(g, L, .006, .006, COL.ink, 0, .09, .01);
    for (let i = 0; i < n; i++) { const x = -L / 2 + (i + .5) * L / n; add(g, geo('pen', () => new THREE.ConeGeometry(.085, .22, 3)), lit(cs[i % cs.length]), x, -.02, .012, [Math.PI, 0, 0], [1, 1, .1]); }
  },
  corkboard(g) {
    box(g, .65, .85, .02, COL.woodD, 0, -.425, .01);
    box(g, .58, .78, .012, 0xC9A06F, 0, -.39, .025);
    [[-.14, .2, COL.white, .05], [.13, .22, COL.mustard, -.08], [-.13, -.16, COL.sky, -.06], [.12, -.12, COL.rose, .1]].forEach(([x, y, c, r]) => { box(g, .2, .22, .004, c, x, y - .11, .034, [0, 0, r]); ball(g, .012, COL.terra, x, y + .08, .04, [1, 1, 1], 6); });
  },
  map(g) {
    box(g, 1.6, 1.0, .02, COL.woodD, 0, -.5, .01);
    const tex = canvasTex(320, 190, (c, w, h) => {
      c.fillStyle = '#BFDDE6'; c.fillRect(0, 0, w, h); c.fillStyle = '#9DB97C';
      const blobs = [[60, 60, 40, 28], [78, 134, 18, 34], [150, 52, 18, 12], [160, 112, 24, 36], [222, 62, 56, 28], [264, 142, 22, 13], [235, 104, 13, 12], [108, 24, 15, 10]];
      for (const [x, y, rx, ry] of blobs) { c.beginPath(); c.ellipse(x, y, rx, ry, .15, 0, 7); c.fill(); }
      c.strokeStyle = 'rgba(70,90,100,.25)'; c.lineWidth = 1; for (let x = 40; x < w; x += 40) { c.beginPath(); c.moveTo(x, 0); c.lineTo(x, h); c.stroke(); } for (let y = 32; y < h; y += 32) { c.beginPath(); c.moveTo(0, y); c.lineTo(w, y); c.stroke(); }
    });
    plane(g, 1.54, .94, texMat(tex), 0, 0, .025);
  },
  cushions(g) {
    ball(g, .24, COL.plum, -.2, .1, -.08, [1.05, .42, 1.05], 10);
    ball(g, .24, COL.teal, .22, .1, .02, [1.05, .42, 1.05], 10);
    ball(g, .2, COL.mustard, -.02, .26, -.02, [1.05, .42, 1.05], 10);
  },
  telescope(g) {
    const h = .95, spread = .2;
    for (const a of [0, 2.09, 4.19]) { const x = Math.sin(a) * spread, z = Math.cos(a) * spread; const rx = Math.atan2(z, h), rz = -Math.atan2(x, h); add(g, geo('tleg', () => new THREE.CylinderGeometry(.012, .016, 1, 6)), COL.woodD, x / 2, h / 2, z / 2, [-rx, 0, -rz]); }
    ball(g, .035, COL.ink, 0, h + .01, 0, [1, 1, 1], 8);
    const up = .6, turn = .7, rot = [0, turn, -(Math.PI / 2 - up)];
    const ax = Math.cos(up) * Math.cos(turn), ay = Math.sin(up), az = -Math.cos(up) * Math.sin(turn);
    add(g, geo('tube', () => new THREE.CylinderGeometry(.052, .052, .72, 12)), COL.blue, 0, h + .05, 0, rot);
    add(g, geo('tubeE', () => new THREE.CylinderGeometry(.064, .064, .1, 12)), COL.ink, ax * .36, h + .05 + ay * .36, az * .36, rot);
    add(g, geo('tubeB', () => new THREE.CylinderGeometry(.028, .028, .08, 8)), COL.ink, -ax * .38, h + .05 - ay * .38, -az * .38, rot);
  },
  record(g) {
    box(g, .6, .04, .6, COL.woodL, 0, .5, 0);
    for (const [x, z] of [[-.25, -.25], [.25, -.25], [-.25, .25], [.25, .25]]) box(g, .035, .5, .035, COL.woodD, x, 0, z);
    box(g, .54, .025, .54, COL.woodL, 0, .18, 0);
    box(g, .5, .09, .44, COL.woodD, 0, .54, 0);
    cyl(g, .17, .17, .012, COL.black, -.05, .63, 0, 20);
    cyl(g, .05, .05, .014, COL.terra, -.05, .63, 0, 12);
    box(g, .015, .015, .24, COL.metal, .15, .65, .02, [0, -.35, 0]);
    box(g, .045, .22, .3, COL.plum, .05, .205, 0, [0, 0, 0]); box(g, .045, .22, .3, COL.teal, -.02, .205, 0);
  },
  trophy(g) {
    const c = lit(COL.gold);
    box(g, .15, .05, .15, COL.ink);
    cyl(g, .025, .035, .1, c, 0, .05, 0, 8);
    cyl(g, .085, .035, .14, c, 0, .15, 0, 12);
    cyl(g, .085, .085, .012, c, 0, .29, 0, 12);
    for (const s of [-1, 1]) add(g, geo('thandle', () => new THREE.TorusGeometry(.038, .008, 6, 10)), c, s * .095, .22, 0);
  },
};

/** Where things that stand on other furniture go (world coordinates). */
const ON = { teddy: [-2.35, .5, -2.12], laptop: [.28, .76, -2.62], aquarium: [-2.67, .9, -.05], globe: [-.05, .76, -2.72], trophy: [1.92, 2.1, -2.77] };

/* ---------- the fixed room ---------- */
function buildShell(scene) {
  const g = new THREE.Group();
  const floorTex = canvasTex(512, 512, (c, w, h) => {
    const n = 7, ph = h / n;
    for (let i = 0; i < n; i++) {
      const offs = (i * 137) % 256;
      for (let k = -1; k < 3; k++) {
        const v = (i * 31 + (k + 1) * 57) % 5, shade = 205 + v * 4;
        c.fillStyle = `rgb(${shade},${Math.round(shade * .81)},${Math.round(shade * .63)})`;
        c.fillRect(offs + k * 256, i * ph, 255, ph - 1.5);
      }
      c.fillStyle = 'rgba(90,60,35,.3)'; c.fillRect(0, i * ph + ph - 1.5, w, 1.5);
    }
  });
  floorTex.wrapS = floorTex.wrapT = THREE.RepeatWrapping; floorTex.repeat.set(2.5, 2.5);
  const floor = plane(g, ROOM * 2, ROOM * 2, new THREE.MeshLambertMaterial({ map: floorTex }), 0, 0, 0, [-Math.PI / 2]);
  floor.userData.keep = true;
  box(g, ROOM * 2 + WALL_T, .18, ROOM * 2 + WALL_T, COL.woodD, -WALL_T / 2, -.181, -WALL_T / 2);
  box(g, ROOM * 2 + WALL_T, WALL_H, WALL_T, COL.wall1, -WALL_T / 2, 0, -ROOM - WALL_T / 2);
  box(g, WALL_T, WALL_H, ROOM * 2, COL.wall2, -ROOM - WALL_T / 2, 0, 0);
  box(g, ROOM * 2, .11, .03, COL.base, 0, 0, -ROOM + .015);
  box(g, .03, .11, ROOM * 2, COL.base, -ROOM + .015, 0, 0);
  box(g, ROOM * 2 + WALL_T, .025, WALL_T + .02, COL.base, -WALL_T / 2, WALL_H, -ROOM - WALL_T / 2);
  box(g, WALL_T + .02, .025, ROOM * 2 + WALL_T, COL.base, -ROOM - WALL_T / 2, WALL_H, -WALL_T / 2);

  // window on the back wall
  const [wx0, wx1, wy0, wy1] = C.FIXED.window.rect, wc = (wx0 + wx1) / 2, ww = wx1 - wx0, wh = wy1 - wy0;
  const skyTex = canvasTex(64, 128, (c, w, h) => { const s = c.createLinearGradient(0, 0, 0, h); s.addColorStop(0, '#9CCDE6'); s.addColorStop(.75, '#D6ECF2'); s.addColorStop(.76, '#9DBB8A'); s.addColorStop(1, '#7FA174'); c.fillStyle = s; c.fillRect(0, 0, w, h); c.fillStyle = 'rgba(255,255,255,.85)'; for (const [x, y, r] of [[18, 26, 8], [28, 24, 11], [38, 28, 7]]) { c.beginPath(); c.arc(x, y, r, 0, 7); c.fill(); } });
  const sky = plane(g, ww, wh, texMat(skyTex, true), wc, (wy0 + wy1) / 2, -ROOM + .006); sky.userData.keep = true;
  const fr = COL.white, t = .055;
  box(g, ww + t, t, .05, fr, wc, wy0 - t / 2, -ROOM + .025); box(g, ww + t, t, .05, fr, wc, wy1 - t / 2, -ROOM + .025);
  box(g, t, wh, .05, fr, wx0, wy0, -ROOM + .025); box(g, t, wh, .05, fr, wx1, wy0, -ROOM + .025);
  box(g, .025, wh, .03, fr, wc, wy0, -ROOM + .02); box(g, ww, .025, .03, fr, wc, wy0 + wh * .55, -ROOM + .02);
  box(g, ww + .16, .03, .1, fr, wc, wy0 - .06, -ROOM + .05);

  // door on the left wall
  const [dz0, dz1, , dh] = C.FIXED.door.rect, dc = (dz0 + dz1) / 2, dw = dz1 - dz0;
  box(g, .03, dh, dw, COL.white, -ROOM + .015, 0, dc);
  box(g, .04, dh - .08, dw - .16, 0xD8CFB9, -ROOM + .02, .0, dc);
  for (const [y, h] of [[.18, .72], [1.05, .95]]) box(g, .048, h, dw - .34, COL.white, -ROOM + .022, y, dc);
  ball(g, .035, COL.metal, -ROOM + .075, 1.0, dz0 + .14, [1, 1, 1], 8);

  mergeGroup(g);
  // daylight from the window on the floor
  const patch = plane(g, ww * 2.1, 3.1, new THREE.MeshBasicMaterial({ map: softTexture(), color: 0xFFF2CF, transparent: true, opacity: .13, depthWrite: false, blending: THREE.AdditiveBlending }), wc + .08, .014, -1.25, [-Math.PI / 2, 0, 0]);
  patch.renderOrder = 1;
  scene.add(g);
}

/* ---------- the cat ---------- */
function makeCat() {
  const g = new THREE.Group(), ginger = lit(COL.orange), white = lit(0xFBF1DF), dark = lit(0xB96C2B);
  const body = new THREE.Group(); g.add(body);
  ball(body, .1, ginger, 0, 0, 0, [1, 1, 2.1], 10);
  ball(body, .085, white, 0, -.03, .02, [.9, .75, 1.7], 8);
  for (let i = 0; i < 3; i++) box(body, .13, .012, .03, dark, 0, .092, -.08 + i * .08);
  const head = new THREE.Group(); head.position.set(0, .06, .22); body.add(head);
  ball(head, .085, ginger, 0, 0, 0, [1.05, .95, .95], 10);
  ball(head, .04, white, 0, -.025, .06, [1, .75, .8], 8);
  for (const s of [-1, 1]) {
    cone(head, .036, .07, ginger, s * .052, .085, -.005, 4, [0, .78, s * -.2]);
    ball(head, .014, lit(COL.ink), s * .036, .016, .075, [1, 1, .6], 6);
  }
  ball(head, .009, lit(COL.rose), 0, -.008, .092, [1, .8, .8], 6);
  const tail = new THREE.Group(); tail.position.set(0, .05, -.2); body.add(tail);
  cyl(tail, .018, .024, .2, ginger, 0, 0, 0, 6);
  const tailTip = new THREE.Group(); tailTip.position.set(0, .2, 0); tail.add(tailTip);
  cyl(tailTip, .012, .018, .14, dark, 0, 0, 0, 6); tail.rotation.x = -.9;
  const legs = [];
  for (const [x, z] of [[-.055, .13], [.055, .13], [-.055, -.13], [.055, -.13]]) {
    const p = new THREE.Group(); p.position.set(x, -.05, z); body.add(p);
    cyl(p, .022, .02, .12, ginger, 0, -.12, 0, 6);
    ball(p, .024, white, 0, -.125, .006, [1, .6, 1.3], 6);
    legs.push(p);
  }
  body.position.y = .175;
  blob(g, .42, .62, .28);
  g.scale.setScalar(CAT_SCALE);
  return { g, body, head, tail, tailTip, legs };
}

/* ---------- star spots after the 30th level ---------- */
function starGeometry() {
  const s = new THREE.Shape(); for (let i = 0; i < 10; i++) { const r = i % 2 ? .03 : .075, a = i / 10 * Math.PI * 2; const x = Math.sin(a) * r, y = Math.cos(a) * r; i ? s.lineTo(x, y) : s.moveTo(x, y); } s.closePath();
  return new THREE.ShapeGeometry(s);
}

/* ---------- public API ---------- */
export function createRoom(host) {
  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, powerPreference: 'low-power' });
    if (!renderer.getContext()) throw new Error('no webgl');
  } catch (e) { return null; }

  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const dprCap = () => Math.min(window.devicePixelRatio || 1, 2);
  let pixelRatio = dprCap();
  renderer.setPixelRatio(pixelRatio);
  renderer.setClearColor(0xF3EDE1);
  const canvas = renderer.domElement;
  canvas.setAttribute('aria-label', 'Ditt rum i 3D. Dra för att titta runt.');
  canvas.setAttribute('role', 'img');
  host.appendChild(canvas);

  const scene = new THREE.Scene();
  scene.add(new THREE.HemisphereLight(0xFFF6E8, 0xB7A68C, 2.15));
  const sun = new THREE.DirectionalLight(0xFFEFD8, 1.55); sun.position.set(3.5, 7, 4.5); scene.add(sun);
  buildShell(scene);

  const camera = new THREE.PerspectiveCamera(26, 1, 2, 60);
  const HOME = { az: Math.PI / 4 + .06, pol: 1.02 };
  const LIM = { az: [.2, 1.42], pol: [.72, 1.27] };
  const view = { az: HOME.az, pol: HOME.pol, vaz: 0, vpol: 0 };
  const TARGET = new THREE.Vector3(-.15, .78, -.15);
  const focus = { target: TARGET.clone(), k: 0, zoom: 1 };
  let baseDist = 20, w = 1, h = 1;

  function placeCamera() {
    const d = baseDist * focus.zoom, t = focus.target, sp = Math.sin(view.pol);
    camera.position.set(t.x + d * sp * Math.sin(view.az), t.y + d * Math.cos(view.pol), t.z + d * sp * Math.cos(view.az));
    camera.lookAt(t);
  }
  function fit() {
    const r = host.getBoundingClientRect();
    w = Math.max(1, Math.round(r.width)); h = Math.max(1, Math.round(r.height));
    renderer.setSize(w, h, false);
    canvas.style.width = '100%'; canvas.style.height = '100%';
    camera.aspect = w / h; camera.updateProjectionMatrix();
    const v = THREE.MathUtils.degToRad(camera.fov) / 2, hf = Math.atan(Math.tan(v) * camera.aspect);
    baseDist = 4.55 / Math.sin(Math.min(v, hf)) * 1.0;
    placeCamera(); invalidate();
  }

  /* ---------- items ---------- */
  const items = new Map(); const itemsRoot = new THREE.Group(); scene.add(itemsRoot);
  let cat = null, level = 0, nav = C.navGrid(0);
  const starsGroup = new THREE.Group(); scene.add(starsGroup);

  function makeItem(meta) {
    const g = new THREE.Group();
    BUILD[meta.id](g);
    mergeGroup(g);
    if (meta.fp) {
      g.position.set((meta.fp[0] + meta.fp[1]) / 2, 0, (meta.fp[2] + meta.fp[3]) / 2);
      if (!meta.flat) blob(g, (meta.fp[1] - meta.fp[0]) * 1.45, (meta.fp[3] - meta.fp[2]) * 1.35);
    } else if (meta.wall === 'z') {
      g.position.set((meta.rect[0] + meta.rect[1]) / 2, (meta.rect[2] + meta.rect[3]) / 2, -ROOM + .005);
    } else if (meta.wall === 'x') {
      g.position.set(-ROOM + .005, (meta.rect[2] + meta.rect[3]) / 2, (meta.rect[0] + meta.rect[1]) / 2);
      g.rotation.y = Math.PI / 2;
    } else if (meta.on) {
      g.position.set(...ON[meta.id]);
    }
    return g;
  }
  function addMeta(meta) {
    if (meta.id === 'cat') {
      const c = makeCat(); itemsRoot.add(c.g); items.set('cat', c.g);
      cat = Object.assign(c, { x: 0, z: 0, hd: .8, path: [], i: 0, mode: 'rest', until: 0, speed: .8, phase: 0, pose: 1 });
      const p = C.nearestFree(nav, [.8, 1.2]); cat.x = p[0]; cat.z = p[1]; placeCat();
      cat.until = performance.now() + 900;
      return c.g;
    }
    const g = makeItem(meta); itemsRoot.add(g); items.set(meta.id, g); return g;
  }
  function refreshNav() {
    nav = C.navGrid(level);
    if (cat) { const p = C.nearestFree(nav, [cat.x, cat.z]); if (C.cellOf(p[0]) !== C.cellOf(cat.x) || C.cellOf(p[1]) !== C.cellOf(cat.z)) { cat.x = p[0]; cat.z = p[1]; } cat.path = []; cat.mode = 'rest'; cat.until = performance.now() + 1200; placeCat(); }
  }
  function drawStars() {
    starsGroup.clear();
    const n = C.starCount(level);
    if (!n) return;
    const geom = geo('star', starGeometry), mat = glow(COL.gold);
    C.STAR_SPOTS.slice(0, n).forEach(([wall, u, y]) => {
      const m = new THREE.Mesh(geom, mat);
      if (wall === 'z') m.position.set(u, y, -ROOM + .01); else { m.position.set(-ROOM + .01, y, u); m.rotation.y = Math.PI / 2; }
      starsGroup.add(m);
    });
  }
  function setLevel(l) {
    if (reveal) { scene.remove(reveal.pts); const done = reveal.resolve; reveal = null; done(); }
    level = Math.max(0, l);
    const want = C.furnitureFor(level), ids = new Set(want.map(f => f.id));
    for (const [id, g] of items) if (!ids.has(id)) { itemsRoot.remove(g); g.traverse(o => { if (o.geometry) o.geometry.dispose(); }); items.delete(id); if (id === 'cat') cat = null; }
    nav = C.navGrid(level);
    for (const m of want) if (!items.has(m.id)) addMeta(m);
    for (const g of items.values()) g.scale.setScalar(1);
    refreshNav(); drawStars(); invalidate(); wake();
  }

  /* ---------- reveal: a small moment for the new piece ---------- */
  let reveal = null;
  const easeBack = t => { const c = 1.5; const u = t - 1; return 1 + (c + 1) * u * u * u + c * u * u; };
  const sparkleGeo = new THREE.BufferGeometry();
  function revealLevel(l) {
    level = l;
    const meta = C.FURNITURE[l - 1];
    return new Promise(resolve => {
      nav = C.navGrid(level);
      if (!meta) { // past the last piece: one more star on the wall
        drawStars(); invalidate(); wake(); resolve(); return;
      }
      const g = items.get(meta.id) || addMeta(meta);
      refreshNav();
      if (reduced) { g.scale.setScalar(1); invalidate(); resolve(); return; }
      g.scale.setScalar(.001);
      const pos = new THREE.Vector3();
      if (meta.id === 'cat') pos.set(cat.x, .25, cat.z);
      else { pos.copy(g.position); if (meta.fp) pos.y = .5; }
      // a few gold specks rising around the piece
      const n = 18, arr = new Float32Array(n * 3), seeds = [];
      for (let i = 0; i < n; i++) seeds.push([Math.random() * 6.28, .2 + Math.random() * .5, .5 + Math.random() * .8]);
      sparkleGeo.setAttribute('position', new THREE.BufferAttribute(arr, 3));
      const pts = new THREE.Points(sparkleGeo, new THREE.PointsMaterial({ color: 0xE9B949, size: 4.5 * pixelRatio, sizeAttenuation: false, transparent: true, opacity: 1, depthWrite: false }));
      pts.frustumCulled = false; scene.add(pts);
      reveal = { g, t: 0, dur: 1.5, pos, pts, seeds, arr, resolve };
      wake();
    });
  }
  function updateReveal(dt) {
    if (!reveal) {
      if (focus.k > 0.001) { focus.k = Math.max(0, focus.k - dt * 1.1); applyFocus(null); return true; }
      return false;
    }
    const r = reveal; r.t += dt;
    const p = Math.min(1, r.t / r.dur), grow = Math.min(1, r.t / .75);
    r.g.scale.setScalar(Math.max(.001, easeBack(grow)));
    focus.k = Math.min(1, focus.k + dt * 1.6); applyFocus(r.pos);
    for (let i = 0; i < r.seeds.length; i++) { const [a, sp, up] = r.seeds[i], e = p; r.arr[i * 3] = r.pos.x + Math.cos(a) * sp * (.4 + e); r.arr[i * 3 + 1] = r.pos.y + up * e * 1.6; r.arr[i * 3 + 2] = r.pos.z + Math.sin(a) * sp * (.4 + e); }
    sparkleGeo.attributes.position.needsUpdate = true;
    r.pts.material.opacity = 1 - p * p;
    if (p >= 1) { scene.remove(r.pts); r.pts.material.dispose(); r.g.scale.setScalar(1); const done = r.resolve; lastFocus.copy(r.pos); reveal = null; done(); }
    return true;
  }
  const lastFocus = new THREE.Vector3();
  function applyFocus(pos) {
    if (pos) lastFocus.copy(pos);
    const k = focus.k * focus.k * (3 - 2 * focus.k);
    focus.target.copy(TARGET).lerp(lastFocus, k * .4);
    focus.zoom = 1 - k * .14;
    placeCamera();
  }

  /* ---------- cat behaviour ---------- */
  function placeCat() {
    const c = cat; c.g.position.set(c.x, 0, c.z); c.g.rotation.y = c.hd;
    const walk = 1 - c.pose, swing = Math.sin(c.phase);
    c.legs[0].rotation.x = swing * .75 * walk; c.legs[3].rotation.x = swing * .75 * walk;
    c.legs[1].rotation.x = -swing * .75 * walk; c.legs[2].rotation.x = -swing * .75 * walk;
    const sit = Math.min(1, c.pose * 1), rearDrop = .08 * sit;
    c.body.position.y = .175 + Math.abs(Math.cos(c.phase)) * .012 * walk - rearDrop * .5;
    c.body.rotation.x = -.36 * sit;
    c.legs[2].scale.y = c.legs[3].scale.y = 1 - .55 * sit;
    c.legs[0].scale.y = c.legs[1].scale.y = 1 + .12 * sit;
    c.head.rotation.x = .3 * sit;
    c.tail.rotation.y = Math.sin(c.phase * .5) * .35 * walk;
    c.tail.rotation.x = -.9 - .9 * sit;
    c.tailTip.rotation.x = -.5 * sit;
  }
  function chooseWalk(now) {
    const free = C.freeCells(nav);
    for (let tries = 0; tries < 12; tries++) {
      const t = free[Math.floor(Math.random() * free.length)];
      if (Math.hypot(t[0] - cat.x, t[1] - cat.z) < 1.4) continue;
      const path = C.findPath(nav, [cat.x, cat.z], t);
      if (path && path.length > 2) { cat.path = path; cat.i = 1; cat.mode = 'walk'; cat.speed = Math.random() < .3 ? 2.2 : .85 + Math.random() * .4; return; }
    }
    cat.until = now + 2000;
  }
  function updateCat(dt, now) {
    if (!cat) return false;
    const c = cat;
    if (c.mode === 'rest') {
      if (now >= c.until) { chooseWalk(now); }
      if (c.mode === 'rest') {
        if (Math.abs(c.pose - 1) > .01) { c.pose = Math.min(1, c.pose + dt * 3); placeCat(); return true; }
        return false;
      }
    }
    c.pose = Math.max(0, c.pose - dt * 5);
    let left = c.speed * dt;
    while (left > 0 && c.i < c.path.length) {
      const [tx, tz] = c.path[c.i], dx = tx - c.x, dz = tz - c.z, d = Math.hypot(dx, dz);
      if (d <= left) { c.x = tx; c.z = tz; left -= d; c.i++; }
      else { c.x += dx / d * left; c.z += dz / d * left; left = 0; }
    }
    if (c.i < c.path.length) {
      const [tx, tz] = c.path[c.i], want = Math.atan2(tx - c.x, tz - c.z);
      let da = want - c.hd; while (da > Math.PI) da -= Math.PI * 2; while (da < -Math.PI) da += Math.PI * 2;
      c.hd += da * Math.min(1, dt * 9);
    }
    c.phase += dt * (5 + c.speed * 7);
    if (c.i >= c.path.length) { c.mode = 'rest'; c.until = now + 2500 + Math.random() * 6000; }
    placeCat();
    return true;
  }

  /* ---------- orbit by dragging ---------- */
  let drag = null;
  canvas.style.touchAction = 'none';
  canvas.addEventListener('pointerdown', e => { drag = { id: e.pointerId, x: e.clientX, y: e.clientY }; view.vaz = view.vpol = 0; try { canvas.setPointerCapture(e.pointerId); } catch (_) {} wake(); });
  canvas.addEventListener('pointermove', e => {
    if (!drag || e.pointerId !== drag.id) return;
    const dx = e.clientX - drag.x, dy = e.clientY - drag.y; drag.x = e.clientX; drag.y = e.clientY;
    const az = -dx * .0075, pol = -dy * .0055;
    view.az = THREE.MathUtils.clamp(view.az + az, LIM.az[0], LIM.az[1]);
    view.pol = THREE.MathUtils.clamp(view.pol + pol, LIM.pol[0], LIM.pol[1]);
    view.vaz = az; view.vpol = pol;
    placeCamera(); invalidate(); wake();
  });
  const endDrag = e => { if (drag && e.pointerId === drag.id) { drag = null; if (reduced) view.vaz = view.vpol = 0; wake(); } };
  canvas.addEventListener('pointerup', endDrag); canvas.addEventListener('pointercancel', endDrag);
  function updateOrbit(dt) {
    if (drag || (Math.abs(view.vaz) < .0002 && Math.abs(view.vpol) < .0002)) return !!drag;
    const k = Math.pow(.004, dt);
    view.vaz *= k; view.vpol *= k;
    view.az = THREE.MathUtils.clamp(view.az + view.vaz, LIM.az[0], LIM.az[1]);
    view.pol = THREE.MathUtils.clamp(view.pol + view.vpol, LIM.pol[0], LIM.pol[1]);
    placeCamera();
    return true;
  }

  /* ---------- frame loop: runs only while something is moving ---------- */
  let wanted = true, raf = 0, sleepT = 0, last = 0, dirty = true, frames = 0, slowSum = 0, slowN = 0;
  const running = () => wanted && !document.hidden;
  function invalidate() { dirty = true; wake(); }
  function wake() {
    clearTimeout(sleepT); sleepT = 0;
    if (!raf && running()) { last = 0; raf = requestAnimationFrame(tick); }
  }
  function tick(now) {
    raf = 0;
    if (!running()) return;
    const dt = last ? Math.min(.05, (now - last) / 1000) : .016;
    const onlyCat = !drag && !reveal && focus.k <= .001 && Math.abs(view.vaz) < .0002;
    if (onlyCat && last && now - last < 30) { raf = requestAnimationFrame(tick); return; } // the cat is fine at 30 fps
    last = now;
    let busy = false;
    busy = updateReveal(dt) || busy;
    busy = updateOrbit(dt) || busy;
    busy = updateCat(dt, now) || busy;
    if (busy || dirty) { renderer.render(scene, camera); frames++; dirty = false; watchSpeed(dt, onlyCat); }
    if (busy) raf = requestAnimationFrame(tick);
    else if (cat && cat.mode === 'rest') { sleepT = setTimeout(wake, Math.max(50, cat.until - now)); }
  }
  function watchSpeed(dt, onlyCat) {
    if (onlyCat) return;
    slowSum += dt; slowN++;
    if (slowN < 40) return;
    const avg = slowSum / slowN; slowSum = 0; slowN = 0;
    if (avg > .036 && pixelRatio > 1) { pixelRatio = Math.max(1, pixelRatio - .5); renderer.setPixelRatio(pixelRatio); fit(); }
  }

  const ro = new ResizeObserver(fit); ro.observe(host);
  document.addEventListener('visibilitychange', () => { if (running()) { dirty = true; wake(); } });
  canvas.addEventListener('webglcontextlost', e => { e.preventDefault(); if (raf) cancelAnimationFrame(raf); raf = 0; clearTimeout(sleepT); });
  canvas.addEventListener('webglcontextrestored', () => { dirty = true; wake(); });
  fit();

  return {
    setLevel,
    reveal: revealLevel,
    /** Pause all drawing while the room is out of sight (during exercises). */
    setActive(on) { wanted = !!on; if (wanted) { fit(); dirty = true; wake(); } else { if (raf) cancelAnimationFrame(raf); raf = 0; clearTimeout(sleepT); } },
    debug: {
      frames: () => frames,
      running: () => !!raf,
      level: () => level,
      cat: () => cat && { x: cat.x, z: cat.z, mode: cat.mode, i: cat.i, n: cat.path.length },
      forceCatWalk: () => { if (cat) { cat.mode = 'rest'; cat.until = 0; wake(); } },
      drawCalls: () => renderer.info.render.calls,
      triangles: () => renderer.info.render.triangles,
      pixelRatio: () => pixelRatio,
      view: () => ({ az: view.az, pol: view.pol, zoom: focus.zoom }),
      setView: (az, pol) => { view.az = az; view.pol = pol; placeCamera(); invalidate(); },
      itemIds: () => [...items.keys()],
      box: id => { const g = items.get(id); if (!g) return null; const b = new THREE.Box3().setFromObject(g); return { x0: b.min.x, x1: b.max.x, y1: b.max.y, z0: b.min.z, z1: b.max.z }; },
      starCount: () => starsGroup.children.length,
      render: () => renderer.render(scene, camera),
    },
  };
}
