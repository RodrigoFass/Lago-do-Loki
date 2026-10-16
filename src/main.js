// Lago Pontilhado 3D — Three.js r158 (global THREE) + filtro de dithering
// CONFIG é definido pelo build: { screens: [0] | [1] | [0,1], preview: bool, px: 2 }
(function () {
"use strict";
const V3 = THREE.Vector3;
THREE.ColorManagement.enabled = false;

// ====================== utilidades ======================
function mulberry32(a) { return function () { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a);
  t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
const rnd = mulberry32(1337);
const lerp = (a, b, k) => a + (b - a) * k;
const mix3 = (a, b, k) => a.map((v, i) => lerp(v, b[i], k));
const smooth = k => k * k * (3 - 2 * k);
const clamp01 = x => Math.min(1, Math.max(0, x));

// ====================== configurações ======================
// Valores padrão; no Lively eles vêm do painel "Personalizar" (livelyPropertyListener)
const params = new URLSearchParams(location.search);
const PREVIEW = !!window.WALL_PREVIEW;
const S = Object.assign({ tela: 0, painel: false, cantoPainel: 0, mostrarRelogio: true, mostrarClima: true, mostrarMusica: true,
  gistId: "", cachorro: true, bichos: true, datas: true, aniversario: "06/04", gaivotas: false, climaReal: true, musicaAgua: true, pixel: 0, fps: 30 }, window.WALL_DEFAULTS || {});
for (const [k, v] of params) if (k in S) S[k] = typeof S[k] === "boolean" ? (v === "1" || v === "true") : typeof S[k] === "number" ? +v : v;
const PXS = [1, 2, 3];
// só para medir desempenho nos testes (ex.: ?prof=norefl,noshadow)
const PROF = {}; String(params.get("prof") || "").split(",").forEach(k => { if (k) PROF[k] = true; });
// 0 = esquerda (barco), 1 = direita (píer), 2 = cena inteira (ou automático se a janela for bem larga, ex.: modo "esticar" do Lively)
function screens() { return S.tela === 2 || (!PREVIEW && innerWidth / innerHeight > 2.6) ? [0, 1] : [S.tela === 1 ? 1 : 0]; }

function canvasTex(w, h, draw) {
  const c = document.createElement("canvas"); c.width = w; c.height = h;
  const g = c.getContext("2d"); draw(g, w, h);
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = 4;
  return t;
}
function speckle(g, w, h, n, col, aMax, sz) {
  for (let i = 0; i < n; i++) { g.fillStyle = `rgba(${col},${rnd() * aMax})`; g.fillRect(rnd() * w, rnd() * h, sz * (0.5 + rnd()), sz * (0.5 + rnd())); }
}
function grainLines(g, w, h, n, horizontal, col, aMax) {
  for (let i = 0; i < n; i++) {
    g.strokeStyle = `rgba(${col},${rnd() * aMax})`; g.lineWidth = 0.5 + rnd() * 1.5; g.beginPath();
    if (horizontal) { const y = rnd() * h, x = rnd() * w, L = 40 + rnd() * 260; g.moveTo(x, y); g.bezierCurveTo(x + L / 3, y + (rnd() - .5) * 4, x + 2 * L / 3, y + (rnd() - .5) * 4, x + L, y + (rnd() - .5) * 3); }
    else { const x = rnd() * w, y = rnd() * h, L = 40 + rnd() * 200; g.moveTo(x, y); g.bezierCurveTo(x + (rnd() - .5) * 4, y + L / 3, x + (rnd() - .5) * 4, y + 2 * L / 3, x + (rnd() - .5) * 3, y + L); }
    g.stroke();
  }
}

// ====================== texturas ======================
const PLANKS = 7;
const texHullOut = canvasTex(1024, 256, (g, w, h) => {
  g.fillStyle = "rgb(152,50,38)"; g.fillRect(0, 0, w, h);
  grainLines(g, w, h, 500, true, "60,15,10", 0.25);
  speckle(g, w, h, 2500, "255,220,200", 0.08, 2);
  // pintura gasta mostrando madeira
  for (let i = 0; i < 60; i++) { g.fillStyle = `rgba(150,112,72,${0.15 + rnd() * 0.3})`; g.beginPath();
    g.ellipse(rnd() * w, rnd() * h, 6 + rnd() * 40, 1 + rnd() * 4, 0, 0, Math.PI * 2); g.fill(); }
  // faixa creme perto da borda (topo do canvas = borda do casco)
  g.fillStyle = "rgb(226,212,178)"; g.fillRect(0, 0, w, h * 0.13);
  speckle(g, w, h * 0.13, 600, "120,100,70", 0.25, 2);
  g.fillStyle = "rgba(40,20,15,0.6)"; g.fillRect(0, h * 0.13, w, 2);
  // tábuas sobrepostas (lapstrake)
  for (let k = 1; k < PLANKS; k++) { const y = h * k / PLANKS;
    g.fillStyle = "rgba(0,0,0,0.5)"; g.fillRect(0, y - 1, w, 2.5);
    g.fillStyle = "rgba(255,255,255,0.16)"; g.fillRect(0, y + 2, w, 1.5); }
  // casco abaixo da linha d'água mais escuro
  const gr = g.createLinearGradient(0, h * 0.7, 0, h); gr.addColorStop(0, "rgba(30,40,30,0)"); gr.addColorStop(1, "rgba(30,40,30,0.7)");
  g.fillStyle = gr; g.fillRect(0, h * 0.7, w, h * 0.3);
});
const texHullIn = canvasTex(1024, 256, (g, w, h) => {
  g.fillStyle = "rgb(138,96,60)"; g.fillRect(0, 0, w, h);
  grainLines(g, w, h, 900, true, "70,40,20", 0.35);
  speckle(g, w, h, 1500, "255,230,190", 0.07, 2);
  for (let k = 1; k < PLANKS; k++) { const y = h * k / PLANKS; g.fillStyle = "rgba(40,22,10,0.6)"; g.fillRect(0, y - 1, w, 2); }
  // água acumulada/sujeira no fundo
  const gr = g.createLinearGradient(0, h * 0.75, 0, h); gr.addColorStop(0, "rgba(40,30,20,0)"); gr.addColorStop(1, "rgba(40,30,20,0.55)");
  g.fillStyle = gr; g.fillRect(0, h * 0.75, w, h * 0.25);
});
const texDeck = canvasTex(512, 64, (g, w, h) => {
  g.fillStyle = "rgb(150,136,116)"; g.fillRect(0, 0, w, h);
  grainLines(g, w, h, 220, true, "70,60,50", 0.4);
  speckle(g, w, h, 500, "40,35,30", 0.15, 2);
  g.fillStyle = "rgba(40,32,26,0.5)"; g.fillRect(0, 0, w, 2); g.fillRect(0, h - 2, w, 2);
  for (const x of [w * 0.12, w * 0.88]) { g.fillStyle = "rgba(30,30,30,0.8)"; g.beginPath(); g.arc(x, h * 0.3, 2.5, 0, 7); g.arc(x, h * 0.7, 2.5, 0, 7); g.fill(); }
});
const texPost = canvasTex(256, 512, (g, w, h) => {
  g.fillStyle = "rgb(84,70,56)"; g.fillRect(0, 0, w, h);
  grainLines(g, w, h, 400, false, "40,30,22", 0.45);
  // limo abaixo da linha d'água (post vai de y=-1.5 até 0.9 → linha d'água em ~62% de baixo)
  const wl = h * (1 - 0.625);
  const gr = g.createLinearGradient(0, wl - 30, 0, h); gr.addColorStop(0, "rgba(60,80,40,0)"); gr.addColorStop(0.12, "rgba(70,95,45,0.85)"); gr.addColorStop(1, "rgba(25,40,28,0.95)");
  g.fillStyle = gr; g.fillRect(0, wl - 30, w, h - wl + 30);
  speckle(g, w, h, 600, "200,210,170", 0.1, 2);
});
const texCrate = canvasTex(256, 256, (g, w, h) => {
  g.fillStyle = "rgb(156,118,74)"; g.fillRect(0, 0, w, h);
  grainLines(g, w, h, 200, true, "80,55,30", 0.4);
  for (let k = 1; k < 4; k++) { g.fillStyle = "rgba(50,30,15,0.6)"; g.fillRect(0, h * k / 4 - 1, w, 2); }
  g.strokeStyle = "rgba(70,45,22,0.9)"; g.lineWidth = 14; g.strokeRect(7, 7, w - 14, h - 14);
  g.lineWidth = 10; g.beginPath(); g.moveTo(14, 14); g.lineTo(w - 14, h - 14); g.stroke();
});
const texPad = canvasTex(256, 256, (g, w, h) => {
  g.fillStyle = "rgb(70,128,52)"; g.fillRect(0, 0, w, h);
  g.strokeStyle = "rgba(40,80,30,0.7)"; g.lineWidth = 2;
  for (let i = 0; i < 18; i++) { const a = i / 18 * Math.PI * 2; g.beginPath(); g.moveTo(w / 2, h / 2); g.lineTo(w / 2 + Math.cos(a) * w / 2, h / 2 + Math.sin(a) * h / 2); g.stroke(); }
  speckle(g, w, h, 500, "160,200,90", 0.2, 3);
  const gr = g.createRadialGradient(w / 2, h / 2, w * 0.3, w / 2, h / 2, w * 0.5); gr.addColorStop(0, "rgba(0,0,0,0)"); gr.addColorStop(1, "rgba(150,170,60,0.5)");
  g.fillStyle = gr; g.fillRect(0, 0, w, h);
});
const texLeaf = canvasTex(128, 64, (g, w, h) => {
  g.clearRect(0, 0, w, h);
  g.fillStyle = "rgb(214,110,30)"; g.beginPath(); g.moveTo(4, h / 2);
  g.quadraticCurveTo(w * 0.45, -h * 0.15, w - 4, h / 2); g.quadraticCurveTo(w * 0.45, h * 1.15, 4, h / 2); g.fill();
  g.strokeStyle = "rgba(110,50,10,0.8)"; g.lineWidth = 2; g.beginPath(); g.moveTo(4, h / 2); g.lineTo(w - 6, h / 2); g.stroke();
  speckle(g, w, h, 120, "255,200,80", 0.25, 2);
});
texLeaf.wrapS = texLeaf.wrapT = THREE.ClampToEdgeWrapping;
const texGlow = canvasTex(64, 64, (g, w, h) => {
  const gr = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  gr.addColorStop(0, "rgba(255,255,255,1)"); gr.addColorStop(0.25, "rgba(255,255,255,0.6)"); gr.addColorStop(1, "rgba(255,255,255,0)");
  g.fillStyle = gr; g.fillRect(0, 0, w, h);
});

// ruído pré-calculado para os shaders: cada texel guarda os 4 cantos da célula (1 leitura por oitava)
const texNoise = (() => {
  const N = 256, r = mulberry32(4242), h = new Uint8Array(N * N), d = new Uint8Array(N * N * 4);
  for (let i = 0; i < N * N; i++) h[i] = Math.floor(r() * 256);
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
    const i = (y * N + x) * 4, x1 = (x + 1) % N, y1 = (y + 1) % N;
    d[i] = h[y * N + x]; d[i + 1] = h[y * N + x1]; d[i + 2] = h[y1 * N + x]; d[i + 3] = h[y1 * N + x1];
  }
  const t = new THREE.DataTexture(d, N, N, THREE.RGBAFormat);
  t.wrapS = t.wrapT = THREE.RepeatWrapping; t.magFilter = t.minFilter = THREE.NearestFilter; t.generateMipmaps = false; t.needsUpdate = true;
  return t;
})();

// ====================== materiais ======================
const lam = (o) => new THREE.MeshLambertMaterial(o);
const M = {
  hullOut: lam({ map: texHullOut, side: THREE.DoubleSide }),
  hullIn: lam({ map: texHullIn, side: THREE.DoubleSide }),
  cream: lam({ color: 0xe2d4b0 }),
  wood: lam({ color: 0xa6764a }),
  woodDark: lam({ color: 0x6e4c2e }),
  oar: lam({ color: 0xc09a62 }),
  bucket: lam({ color: 0x36668c, side: THREE.DoubleSide }),
  metal: lam({ color: 0x1c1c1e }),
  rope: lam({ color: 0xb2a07a }),
  deck: lam({ map: texDeck }),
  post: lam({ map: texPost }),
  beam: lam({ color: 0x5a4a3a }),
  crate: lam({ map: texCrate }),
  glass: lam({ color: 0x8a9496, emissive: 0x000000 }),
  pad: lam({ map: texPad, side: THREE.DoubleSide }),
  petal: lam({ color: 0xf6aac0 }),
  petalIn: lam({ color: 0xffc8d6 }),
  stamen: lam({ color: 0xffd23a }),
  leaf: lam({ map: texLeaf, transparent: false, alphaTest: 0.5, side: THREE.DoubleSide }),
  gullWhite: lam({ color: 0xf1f1ec }),
  gullGrey: lam({ color: 0x9aa1a8 }),
  gullBlack: lam({ color: 0x1b1b1d }),
  beak: lam({ color: 0xe8b42c }),
  leg: lam({ color: 0xd99b6c }),
};
function mesh(geo, mat, cast = true, recv = true) { const m = new THREE.Mesh(geo, mat); m.castShadow = cast; m.receiveShadow = recv; return m; }

// ====================== modelagem orgânica (formas suaves a partir de distâncias) ======================
// Cada bicho é "esculpido" juntando elipsoides e cápsulas com união suave; a malha sai lisa, sem emendas.
const sdf = {
  smin(a, b, k) { const h = Math.max(k - Math.abs(a - b), 0) / k; return Math.min(a, b) - h * h * k * 0.25; },
  smax(a, b, k) { return -sdf.smin(-a, -b, k); },
  ell(x, y, z, cx, cy, cz, rx, ry, rz) { const px = (x - cx) / rx, py = (y - cy) / ry, pz = (z - cz) / rz;
    const k0 = Math.hypot(px, py, pz), k1 = Math.hypot(px / rx, py / ry, pz / rz); return k1 > 1e-9 ? k0 * (k0 - 1) / k1 : -Math.min(rx, ry, rz); },
  // cápsula com raio variando de r1 (em a) até r2 (em b)
  cap(x, y, z, ax, ay, az, bx, by, bz, r1, r2) { const pax = x - ax, pay = y - ay, paz = z - az, bax = bx - ax, bay = by - ay, baz = bz - az;
    const h = Math.min(1, Math.max(0, (pax * bax + pay * bay + paz * baz) / (bax * bax + bay * bay + baz * baz)));
    return Math.hypot(pax - bax * h, pay - bay * h, paz - baz * h) - (r1 + (r2 - r1) * h); },
};
function hash3(x, y, z) { let h = Math.imul(x | 0, 374761393) ^ Math.imul(y | 0, 668265263) ^ Math.imul(z | 0, 2147483647); h = Math.imul(h ^ (h >>> 13), 1274126177); return ((h ^ (h >>> 16)) >>> 0) / 4294967296; }
function noise3(x, y, z) { const ix = Math.floor(x), iy = Math.floor(y), iz = Math.floor(z); let fx = x - ix, fy = y - iy, fz = z - iz;
  fx = fx * fx * (3 - 2 * fx); fy = fy * fy * (3 - 2 * fy); fz = fz * fz * (3 - 2 * fz);
  const l = (a, b, t) => a + (b - a) * t, c = (i, j, k) => hash3(ix + i, iy + j, iz + k);
  return l(l(l(c(0, 0, 0), c(1, 0, 0), fx), l(c(0, 1, 0), c(1, 1, 0), fx), fy), l(l(c(0, 0, 1), c(1, 0, 1), fx), l(c(0, 1, 1), c(1, 1, 1), fx), fy), fz); }
// malha por "surface nets": f(x,y,z) < 0 dentro; colorFn(p, n) devolve [r,g,b]
function sculpt(f, bmin, bmax, res, colorFn, origin) {
  const st = Math.max(bmax[0] - bmin[0], bmax[1] - bmin[1], bmax[2] - bmin[2]) / res;
  const ox = bmin[0] - st, oy = bmin[1] - st, oz = bmin[2] - st;
  const nx = Math.ceil((bmax[0] - bmin[0]) / st) + 3, ny = Math.ceil((bmax[1] - bmin[1]) / st) + 3, nz = Math.ceil((bmax[2] - bmin[2]) / st) + 3;
  const V = new Float32Array(nx * ny * nz), id = (x, y, z) => x + nx * (y + ny * z);
  for (let z = 0; z < nz; z++) for (let y = 0; y < ny; y++) for (let x = 0; x < nx; x++) V[id(x, y, z)] = f(ox + x * st, oy + y * st, oz + z * st);
  const cid = (x, y, z) => x + (nx - 1) * (y + (ny - 1) * z), cellV = new Int32Array((nx - 1) * (ny - 1) * (nz - 1)).fill(-1);
  const pos = [], E = [[0, 1], [2, 3], [4, 5], [6, 7], [0, 2], [1, 3], [4, 6], [5, 7], [0, 4], [1, 5], [2, 6], [3, 7]];
  const cv = new Float32Array(8), cp = [];
  for (let z = 0; z < nz - 1; z++) for (let y = 0; y < ny - 1; y++) for (let x = 0; x < nx - 1; x++) {
    let neg = 0;
    for (let i = 0; i < 8; i++) { cv[i] = V[id(x + (i & 1), y + ((i >> 1) & 1), z + (i >> 2))]; if (cv[i] < 0) neg++; }
    if (neg === 0 || neg === 8) continue;
    let sx = 0, sy = 0, sz = 0, n = 0;
    for (const [a, b] of E) { const va = cv[a], vb = cv[b]; if ((va < 0) === (vb < 0)) continue;
      const t = va / (va - vb); sx += ((a & 1) + ((b & 1) - (a & 1)) * t); sy += (((a >> 1) & 1) + (((b >> 1) & 1) - ((a >> 1) & 1)) * t); sz += ((a >> 2) + ((b >> 2) - (a >> 2)) * t); n++; }
    cellV[cid(x, y, z)] = pos.length / 3; pos.push(ox + (x + sx / n) * st, oy + (y + sy / n) * st, oz + (z + sz / n) * st);
  }
  const idx = [];
  const quad = (a, b, c, d, flip) => { if (a < 0 || b < 0 || c < 0 || d < 0) return; if (flip) idx.push(a, c, b, a, d, c); else idx.push(a, b, c, a, c, d); };
  for (let z = 1; z < nz - 1; z++) for (let y = 1; y < ny - 1; y++) for (let x = 0; x < nx - 1; x++) { const a = V[id(x, y, z)] < 0; if (a === (V[id(x + 1, y, z)] < 0)) continue;
    quad(cellV[cid(x, y - 1, z - 1)], cellV[cid(x, y, z - 1)], cellV[cid(x, y, z)], cellV[cid(x, y - 1, z)], !a); }
  for (let z = 1; z < nz - 1; z++) for (let y = 0; y < ny - 1; y++) for (let x = 1; x < nx - 1; x++) { const a = V[id(x, y, z)] < 0; if (a === (V[id(x, y + 1, z)] < 0)) continue;
    quad(cellV[cid(x - 1, y, z - 1)], cellV[cid(x - 1, y, z)], cellV[cid(x, y, z)], cellV[cid(x, y, z - 1)], !a); }
  for (let z = 0; z < nz - 1; z++) for (let y = 1; y < ny - 1; y++) for (let x = 1; x < nx - 1; x++) { const a = V[id(x, y, z)] < 0; if (a === (V[id(x, y, z + 1)] < 0)) continue;
    quad(cellV[cid(x - 1, y - 1, z)], cellV[cid(x, y - 1, z)], cellV[cid(x, y, z)], cellV[cid(x - 1, y, z)], !a); }
  // projeta os vértices na superfície e tira a normal do gradiente (fica bem liso)
  const nor = new Float32Array(pos.length), col = new Float32Array(pos.length), e = st * 0.5, P = new V3(), N = new V3();
  for (let i = 0; i < pos.length; i += 3) {
    let x = pos[i], y = pos[i + 1], z = pos[i + 2];
    for (let it = 0; it < 2; it++) {
      const d = f(x, y, z), gx = f(x + e, y, z) - f(x - e, y, z), gy = f(x, y + e, z) - f(x, y - e, z), gz = f(x, y, z + e) - f(x, y, z - e);
      const g2 = (gx * gx + gy * gy + gz * gz) / (4 * e * e); if (g2 < 1e-12) break;
      const k = d / g2 / (2 * e); x -= gx * k; y -= gy * k; z -= gz * k;
      if (it === 1) N.set(gx, gy, gz).normalize();
    }
    pos[i] = x; pos[i + 1] = y; pos[i + 2] = z; nor[i] = N.x; nor[i + 1] = N.y; nor[i + 2] = N.z;
    const c = colorFn(P.set(x, y, z), N); col[i] = c[0]; col[i + 1] = c[1]; col[i + 2] = c[2];
  }
  const o = origin || [0, 0, 0];
  for (let i = 0; i < pos.length; i += 3) { pos[i] -= o[0]; pos[i + 1] -= o[1]; pos[i + 2] -= o[2]; }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute("normal", new THREE.Float32BufferAttribute(nor, 3));
  g.setAttribute("color", new THREE.Float32BufferAttribute(col, 3)); g.setIndex(idx); g.computeBoundingSphere();
  return g;
}
const vcol = (o) => lam(Object.assign({ vertexColors: true }, o || {}));

// ====================== cena ======================
const scene = new THREE.Scene();
const world = new THREE.Group(); scene.add(world);

// ---------- barco ----------
const BL = 1.6, XS = -1.42, TH = 0.045;
const hullTop = x => 0.30 + 0.17 * Math.pow(Math.max(x, 0) / BL, 2) + 0.05 * Math.pow(Math.max(-x, 0) / BL, 2);
const hullBot = x => -0.36 + 0.32 * Math.pow(Math.max(x, 0) / BL, 2) + 0.08 * Math.pow(Math.max(-x, 0) / BL, 2);
const hullWmax = x => { const xb = Math.max(x, 0) / BL, xs = Math.max(-x, 0) / BL; return 0.64 * (1 - 0.97 * xb * xb) * (1 - 0.22 * xs * xs); };
function section(x, s, inset) {
  const yb = hullBot(x) + inset, yt = hullTop(x), W = Math.max(hullWmax(x) - inset, 0.004), a = s * Math.PI / 2;
  return [yb + (yt - yb) * (1 - Math.cos(a)), W * Math.pow(Math.sin(a), 0.85)];
}
function halfWidthAt(x, y, inset) {
  let best = 0, bd = 1e9;
  for (let i = 0; i <= 60; i++) { const [sy, sz] = section(x, i / 60, inset); const d = Math.abs(sy - y); if (d < bd) { bd = d; best = sz; } }
  return best;
}
function hullSurface(inset) {
  const NX = 56, NS = 22, pos = [], uv = [], idx = [];
  for (const sg of [1, -1]) {
    const base = pos.length / 3;
    for (let i = 0; i <= NX; i++) {
      const x = lerp(XS, BL, i / NX);
      for (let j = 0; j <= NS; j++) {
        const [y, z] = section(x, j / NS, inset);
        pos.push(x, y, sg * z); uv.push((x - XS) / (BL - XS) * 2.5, j / NS);
      }
    }
    for (let i = 0; i < NX; i++) for (let j = 0; j < NS; j++) {
      const a = base + i * (NS + 1) + j, b = a + NS + 1, c = b + 1, d = a + 1;
      if (sg > 0) idx.push(a, b, d, b, c, d); else idx.push(a, d, b, b, d, c);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx); g.computeVertexNormals();
  return g;
}
const boat = new THREE.Group(); boat.rotation.order = "YZX"; world.add(boat);
boat.add(mesh(hullSurface(0), M.hullOut));
boat.add(mesh(hullSurface(TH), M.hullIn));
// espelho de popa (transom)
{
  const sh = new THREE.Shape(); const N = 20;
  for (let j = N; j >= 0; j--) { const [y, z] = section(XS, j / N, 0); j === N ? sh.moveTo(-z, y) : sh.lineTo(-z, y); }
  for (let j = 1; j <= N; j++) { const [y, z] = section(XS, j / N, 0); sh.lineTo(z, y); }
  const g = new THREE.ShapeGeometry(sh); g.rotateY(-Math.PI / 2); g.translate(XS + 0.005, 0, 0);
  boat.add(mesh(g, lam({ color: 0x983226, side: THREE.DoubleSide })));
  const g2 = g.clone(); g2.translate(TH * 0.9, 0, 0); boat.add(mesh(g2, lam({ color: 0x8a6040, side: THREE.DoubleSide })));
}
// borda (gunwale), roda de proa
for (const sg of [1, -1]) {
  const pts = []; for (let i = 0; i <= 40; i++) { const x = lerp(XS, BL - 0.02, i / 40); pts.push(new V3(x, hullTop(x) + 0.004, sg * Math.max(hullWmax(x) - 0.012, 0.012))); }
  boat.add(mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 80, 0.03, 6), M.cream));
}
boat.add(mesh(new THREE.TubeGeometry(new THREE.LineCurve3(new V3(XS + 0.01, hullTop(XS) + 0.004, -hullWmax(XS) + 0.02), new V3(XS + 0.01, hullTop(XS) + 0.004, hullWmax(XS) - 0.02)), 4, 0.03, 6), M.cream));
{
  const pts = []; for (let i = 0; i <= 12; i++) { const y = lerp(hullBot(BL) - 0.02, hullTop(BL) + 0.04, i / 12); pts.push(new V3(BL - 0.01 + 0.02 * Math.sin(i / 12 * 1.5), y, 0)); }
  boat.add(mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 16, 0.028, 6), M.cream));
}
// cavernas internas
for (let x = -1.15; x < 1.35; x += 0.29) {
  const pts = [];
  for (let j = 16; j >= 0; j--) { const [y, z] = section(x, j / 16, TH + 0.012); pts.push(new V3(x, y, z)); }
  for (let j = 1; j <= 16; j++) { const [y, z] = section(x, j / 16, TH + 0.012); pts.push(new V3(x, y, -z)); }
  boat.add(mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 40, 0.014, 5), M.woodDark));
}
// bancos
function seat(x, wx, y) {
  const hw = Math.min(halfWidthAt(x - wx / 2, y, TH), halfWidthAt(x + wx / 2, y, TH));
  const m = mesh(new THREE.BoxGeometry(wx, 0.035, hw * 2), M.wood); m.position.set(x, y, 0); boat.add(m);
}
seat(0.25, 0.24, 0.1); seat(-1.1, 0.5, 0.12); seat(1.05, 0.2, 0.16);
// remos
function oar(a, b) {
  const g = new THREE.Group(); const dir = b.clone().sub(a), L = dir.length();
  const shaft = mesh(new THREE.CylinderGeometry(0.02, 0.022, L, 8), M.oar); shaft.position.y = L / 2; g.add(shaft);
  const blade = mesh(new THREE.BoxGeometry(0.12, 0.38, 0.012), M.oar); blade.position.y = L + 0.16; blade.rotation.y = Math.PI / 2; g.add(blade);
  const grip = mesh(new THREE.CylinderGeometry(0.024, 0.024, 0.16, 8), M.woodDark); grip.position.y = 0.08; g.add(grip);
  g.position.copy(a); g.quaternion.setFromUnitVectors(new V3(0, 1, 0), dir.normalize());
  boat.add(g);
}
oar(new V3(-1.2, 0.175, 0.2), new V3(0.48, 0.162, 0.1));
oar(new V3(-1.2, 0.175, -0.19), new V3(0.48, 0.162, -0.09));
// toleteiras
for (const sg of [1, -1]) { const t = mesh(new THREE.TorusGeometry(0.035, 0.008, 6, 12), M.metal); t.position.set(0.6, hullTop(0.6) + 0.045, sg * (hullWmax(0.6) - 0.01)); boat.add(t); }
// balde
{
  const b = new THREE.Group();
  b.add(mesh(new THREE.CylinderGeometry(0.11, 0.085, 0.24, 18, 1, true), M.bucket));
  const bot = mesh(new THREE.CircleGeometry(0.085, 18), M.bucket); bot.rotation.x = -Math.PI / 2; bot.position.y = -0.12; b.add(bot);
  const hdl = mesh(new THREE.TorusGeometry(0.105, 0.006, 4, 16, Math.PI), M.metal); hdl.position.y = 0.12; hdl.rotation.y = 0.6; b.add(hdl);
  b.position.set(-0.72, hullBot(-0.72) + TH + 0.12, -0.18); b.rotation.z = 0.05; boat.add(b);
}
// rolo de corda na proa
{ const c = mesh(new THREE.TorusGeometry(0.1, 0.024, 6, 18), M.rope); c.rotation.x = Math.PI / 2; c.position.set(1.18, hullBot(1.18) + TH + 0.06, 0.02); c.scale.set(1, 1, 0.7); boat.add(c);
  const c2 = c.clone(); c2.position.y += 0.04; c2.scale.set(0.8, 0.8, 0.7); boat.add(c2); }

// ---------- píer ----------
const PX = 4.75, PZ0 = -0.62;
const pier = new THREE.Group(); world.add(pier);
{
  const N = 28, g = new THREE.BoxGeometry(2.1, 0.05, 0.35);
  const inst = new THREE.InstancedMesh(g, M.deck, N); inst.castShadow = inst.receiveShadow = true;
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), c = new THREE.Color();
  for (let i = 0; i < N; i++) {
    const z = -0.62 - i * 0.375, short = rnd() < 0.12 ? 0.85 : 1;
    e.set((rnd() - 0.5) * 0.02, (rnd() - 0.5) * 0.025, (rnd() - 0.5) * 0.02); q.setFromEuler(e);
    m4.compose(new V3(PX + (rnd() - 0.5) * 0.06 + (short < 1 ? 0.15 : 0), 0.655 + rnd() * 0.01, z), q, new V3(short, 1, 1));
    inst.setMatrixAt(i, m4); const k = 0.82 + rnd() * 0.3; c.setRGB(k, k * (0.97 + rnd() * 0.05), k * 0.95); inst.setColorAt(i, c);
  }
  pier.add(inst);
  for (const sx of [-0.75, 0.75]) { const s = mesh(new THREE.BoxGeometry(0.12, 0.12, 10.4), M.beam); s.position.set(PX + sx, 0.57, -5.7); pier.add(s); }
  const fb = mesh(new THREE.BoxGeometry(2.25, 0.13, 0.1), M.beam); fb.position.set(PX, 0.5, PZ0 + 0.14); pier.add(fb);
  for (let i = 0; i < 5; i++) for (const sx of [-0.98, 0.98]) {
    const p = mesh(new THREE.CylinderGeometry(0.13, 0.145, 2.4, 14), M.post);
    p.position.set(PX + sx, -0.3, PZ0 - 2.3 * i); p.rotation.set((rnd() - 0.5) * 0.04, rnd() * 6, (rnd() - 0.5) * 0.04); pier.add(p);
    const cap = mesh(new THREE.CylinderGeometry(0.135, 0.13, 0.03, 14), M.beam); cap.position.set(PX + sx, 0.91, PZ0 - 2.3 * i); pier.add(cap);
  }
  // amarração no poste
  const tie = mesh(new THREE.TorusGeometry(0.155, 0.026, 6, 20), M.rope); tie.rotation.x = Math.PI / 2; tie.position.set(PX - 0.98, 0.44, PZ0); pier.add(tie);
  const tie2 = tie.clone(); tie2.position.y = 0.39; pier.add(tie2);
  // caixotes
  const c1 = mesh(new THREE.BoxGeometry(0.44, 0.3, 0.44), M.crate); c1.position.set(PX + 0.58, 0.83, -2.55); c1.rotation.y = 0.15; pier.add(c1);
  const c2 = mesh(new THREE.BoxGeometry(0.32, 0.24, 0.32), M.crate); c2.position.set(PX + 0.62, 1.1, -2.53); c2.rotation.y = -0.2; pier.add(c2);
  const c3 = mesh(new THREE.BoxGeometry(0.36, 0.26, 0.5), M.crate); c3.position.set(PX - 0.35, 0.81, -3.9); c3.rotation.y = 0.5; pier.add(c3);
}
// lampião
const LAMP = new V3(PX - 1.33, 1.42, PZ0);
const lampGlass = mesh(new THREE.BoxGeometry(0.12, 0.19, 0.12), M.glass, false, false);
{
  const pole = mesh(new THREE.CylinderGeometry(0.04, 0.045, 1.0, 10), M.metal); pole.position.set(PX - 0.98, 1.28, PZ0); pier.add(pole);
  const arm = mesh(new THREE.BoxGeometry(0.38, 0.03, 0.03), M.metal); arm.position.set(PX - 1.15, 1.74, PZ0); pier.add(arm);
  const hook = mesh(new THREE.BoxGeometry(0.01, 0.1, 0.01), M.metal); hook.position.set(LAMP.x, LAMP.y + 0.22, PZ0); pier.add(hook);
  const cap = mesh(new THREE.ConeGeometry(0.12, 0.09, 4), M.metal); cap.rotation.y = Math.PI / 4; cap.position.set(LAMP.x, LAMP.y + 0.14, PZ0); pier.add(cap);
  const base = mesh(new THREE.BoxGeometry(0.15, 0.025, 0.15), M.metal); base.position.set(LAMP.x, LAMP.y - 0.105, PZ0); pier.add(base);
  for (const [dx, dz] of [[1, 1], [1, -1], [-1, 1], [-1, -1]]) { const b = mesh(new THREE.BoxGeometry(0.014, 0.2, 0.014), M.metal); b.position.set(LAMP.x + dx * 0.062, LAMP.y, PZ0 + dz * 0.062); pier.add(b); }
  lampGlass.position.copy(LAMP); pier.add(lampGlass);
}

// ---------- gaivotas (esculpidas: peito e cabeça brancos, dorso cinza, pontas pretas com pintinhas brancas) ----------
const G_W = [0.95, 0.95, 0.93], G_G = [0.47, 0.52, 0.57], G_K = [0.08, 0.08, 0.09], G_Y = [0.95, 0.75, 0.2];
const mixc = (a, b, k) => [a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k, a[2] + (b[2] - a[2]) * k];
const sstep = (e0, e1, x) => { const t = Math.min(1, Math.max(0, (x - e0) / (e1 - e0))); return t * t * (3 - 2 * t); };
const gullMat = vcol();
// asa fechada (lado +z), separada do corpo para poder abrir e bater; origem no ombro
const G_SH = [0.085, 0.195, 0.05];
const gullWingGeo = (() => {
  const wing = (x, y, z) => { const d = sdf.cap(x, y, z, 0.085, 0.192, 0.062, -0.31, 0.168, -0.004, 0.042, 0.007);
    return sdf.smax(d, Math.abs(y - 0.19 + 0.05 * (0.085 - x)) - 0.03, 0.025); };
  const g = sculpt(wing, [-0.34, 0.12, -0.05], [0.14, 0.25, 0.12], 72, (p) => {
    const c = mixc(G_W, G_G, sstep(0.11, 0.07, p.x));
    const k = mixc(G_K, G_W, sstep(0.016, 0.01, Math.hypot((p.x + 0.255) * 1.2, p.y - 0.172)) + sstep(-0.297, -0.307, p.x));
    return mixc(c, k, sstep(-0.15, -0.185, p.x));
  });
  g.translate(-G_SH[0], -G_SH[1], -G_SH[2]);
  return g;
})();
const gullGeo = (() => {
  const f = (x, y, z) => {
    let d = sdf.ell(x, y, z, -0.02, 0.15, 0, 0.16, 0.074, 0.07);
    d = sdf.smin(d, sdf.ell(x, y, z, 0.075, 0.152, 0, 0.088, 0.08, 0.068), 0.04);                // peito
    d = sdf.smin(d, sdf.cap(x, y, z, 0.105, 0.175, 0, 0.165, 0.24, 0, 0.044, 0.036), 0.035);    // pescoço
    d = sdf.smin(d, sdf.ell(x, y, z, -0.2, 0.16, 0, 0.07, 0.015, 0.042), 0.02);                 // cauda
    return d;
  };
  return sculpt(f, [-0.3, 0.06, -0.1], [0.22, 0.28, 0.1], 72, (p) =>
    mixc(G_W, G_G, sstep(0.17, 0.19, p.y + 0.06 * Math.max(0, -p.x - 0.1)) * sstep(0.08, 0.04, p.x)));   // dorso cinza entre as asas
})();
const gullHeadGeo = sculpt((x, y, z) => {
  let d = sdf.ell(x, y, z, 0.0, 0.012, 0, 0.058, 0.05, 0.046);
  d = sdf.smin(d, sdf.ell(x, y, z, -0.035, -0.02, 0, 0.04, 0.04, 0.038), 0.02);                    // nuca, liga no pescoço
  const beak = sdf.smin(sdf.cap(x, y, z, 0.04, 0.0, 0, 0.11, -0.004, 0, 0.013, 0.006), sdf.ell(x, y, z, 0.104, -0.01, 0, 0.012, 0.012, 0.006), 0.01);
  return sdf.smin(d, beak, 0.012);
}, [-0.09, -0.07, -0.06], [0.13, 0.07, 0.06], 48, (p) => {
  if (p.x > 0.05) return Math.hypot(p.x - 0.1, p.y + 0.012) < 0.009 ? [0.85, 0.2, 0.15] : G_Y;   // bico amarelo com pinta vermelha
  return G_W;
});
const footGeo = sculpt((x, y, z) => Math.min(
  sdf.cap(x, y, z, 0, 0, 0, 0.04, -0.004, 0.018, 0.005, 0.003), sdf.cap(x, y, z, 0, 0, 0, 0.045, -0.004, 0, 0.005, 0.003), sdf.cap(x, y, z, 0, 0, 0, 0.04, -0.004, -0.018, 0.005, 0.003),
  Math.max(sdf.ell(x, y, z, 0.026, -0.002, 0, 0.026, 0.003, 0.02), -x)), [-0.01, -0.012, -0.03], [0.055, 0.008, 0.03], 32, () => G_Y);
function makeGull(flying) {
  const g = new THREE.Group();
  g.add(mesh(gullGeo, gullMat));
  const head = new THREE.Group(); head.position.set(0.17, 0.235, 0); g.add(head);
  head.add(mesh(gullHeadGeo, gullMat));
  for (const sz of [1, -1]) {
    const ring = mesh(new THREE.SphereGeometry(0.0085, 10, 8), lam({ color: 0xe8d36a }), false, false); ring.position.set(0.026, 0.02, sz * 0.04); head.add(ring);
    const eye = mesh(new THREE.SphereGeometry(0.0055, 8, 6), new THREE.MeshPhongMaterial({ color: 0x050505, specular: 0xaaaaaa, shininess: 90 }), false, false); eye.position.set(0.03, 0.02, sz * 0.045); head.add(eye);
  }
  const wings = [], fold = [];
  if (!flying) {
    for (const sz of [1, -1]) {
      const piv = new THREE.Group(); piv.position.set(G_SH[0], G_SH[1], sz * G_SH[2]); g.add(piv);
      const wm = mesh(gullWingGeo, gullMat); if (sz < 0) wm.scale.z = -1; piv.add(wm); fold.push({ piv, sz });
      const leg = mesh(new THREE.CylinderGeometry(0.006, 0.007, 0.115, 6), lam({ color: 0xe6b43a })); leg.position.set(0.005, 0.04, sz * 0.03); leg.rotation.z = -0.08; g.add(leg);
      const foot = mesh(footGeo, gullMat); foot.position.set(0.0, -0.016, sz * 0.03); g.add(foot);
    }
  } else {
    // asas abertas: parte interna larga, mão afinando, ponta preta
    const flat = (pts, sz) => { const sh = new THREE.Shape(); pts.forEach(([x, z], i) => i ? sh.lineTo(x, z) : sh.moveTo(x, z));
      const geo = new THREE.ShapeGeometry(sh); geo.rotateX(Math.PI / 2); if (sz < 0) geo.scale(1, 1, -1); return geo; };
    const wingMat = lam({ color: 0xa3aab1, side: THREE.DoubleSide }), tipMat = lam({ color: 0x1b1b1d, side: THREE.DoubleSide });
    for (const sz of [1, -1]) {
      const shoulder = new THREE.Group(); shoulder.position.set(0.02, 0.17, sz * 0.04); g.add(shoulder);
      shoulder.add(mesh(flat([[0.08, 0], [0.07, 0.2], [0.03, 0.34], [-0.07, 0.33], [-0.1, 0.16], [-0.09, 0]], sz), wingMat));
      const elbow = new THREE.Group(); elbow.position.set(0.0, 0, sz * 0.335); shoulder.add(elbow);
      elbow.add(mesh(flat([[0.03, 0], [0.0, 0.16], [-0.05, 0.2], [-0.08, 0.12], [-0.07, 0]], sz), wingMat));
      elbow.add(mesh(flat([[0.0, 0.16], [-0.04, 0.34], [-0.075, 0.33], [-0.065, 0.19], [-0.05, 0.2]], sz), tipMat));
      wings.push({ shoulder, elbow, sz });
    }
  }
  g.userData = { head, wings, fold };
  return g;
}
const perched = makeGull(false); perched.position.set(PX + 0.98, 0.925, PZ0); perched.rotation.y = 3.4; world.add(perched);
const flock = [0, 1, 2].map(() => { const g = makeGull(true); g.scale.setScalar(0.6); world.add(g); return g; });
const flockOff = [new V3(0, 0, 0), new V3(-0.5, 0.12, -0.38), new V3(-0.8, -0.08, 0.34)];

// ---------- vitórias-régias e folhas ----------
const pads = [];
[[5.7, 0.8, 0.38, 0.6, true], [6.4, 0.1, 0.3, 2.4], [5.05, 1.35, 0.26, 4.0], [6.7, 1.2, 0.33, 1.4],
 [-6.9, -3.4, 0.36, 5.2, true], [-6.15, -4.0, 0.28, 3.1], [-7.6, -2.7, 0.3, 0.2]].forEach(([x, z, r, a, flower]) => {
  const g = new THREE.Group(); g.position.set(x, 0.012, z);
  const pad = mesh(new THREE.CircleGeometry(r, 36, a + 0.3, Math.PI * 2 - 0.6), M.pad, false, true); pad.rotation.x = -Math.PI / 2; g.add(pad);
  let petals = null;
  if (flower) {
    petals = new THREE.Group(); petals.position.set(r * 0.15, 0.02, -r * 0.1); g.add(petals);
    for (let ring = 0; ring < 2; ring++) for (let i = 0; i < 8; i++) {
      const piv = new THREE.Group(); piv.rotation.y = i / 8 * Math.PI * 2 + ring * 0.4; petals.add(piv);
      const p = mesh(new THREE.SphereGeometry(1, 8, 6), ring ? M.petalIn : M.petal, true, false);
      p.scale.set(ring ? 0.06 : 0.08, 0.016, 0.028); p.position.x = ring ? 0.045 : 0.065; piv.add(p);
      piv.userData.ring = ring; piv.userData.p = p;
    }
    const st = mesh(new THREE.SphereGeometry(0.026, 8, 6), M.stamen); st.position.y = 0.025; petals.add(st);
  }
  world.add(g); pads.push({ g, petals, ph: rnd() * 6 });
});
const leaves = [];
for (let i = 0; i < 8; i++) {
  const m = mesh(new THREE.PlaneGeometry(0.26, 0.13), M.leaf, false, true); m.rotation.x = -Math.PI / 2;
  const g = new THREE.Group(); g.add(m); world.add(g);
  leaves.push({ g, x0: rnd() * 22 - 11, z: -4.5 + rnd() * 6.5, sp: 0.03 + rnd() * 0.035, rot: rnd() * 6, tint: rnd() });
  leaves[leaves.length - 1].px = leaves[leaves.length - 1].x0; leaves[leaves.length - 1].pz = leaves[leaves.length - 1].z;
  if (rnd() < 0.5) { m.material = M.leaf.clone(); m.material.color.setRGB(1.0, 0.85, 0.55); }
}

// ---------- corda (a malha é atualizada no lugar, sem recriar a cada quadro) ----------
let ropeMesh = null;
const ROPE_END = new V3(PX - 1.12, 0.44, PZ0), ROPE_SEG = 60, ROPE_RAD = 6, ROPE_R = 0.022;
const ropePts = [new V3(), new V3(), new V3(), new V3(), new V3(), new V3()], ropeCurve = new THREE.CatmullRomCurve3(ropePts);
const _rp = new V3(), _rn = new V3();
function updateRope(t) {
  const A = boat.localToWorld(ropePts[0].set(1.58, 0.45, 0)), D = ROPE_END;
  ropePts[1].copy(A).lerp(D, 0.08); ropePts[1].y = A.y - 0.22;
  ropePts[2].copy(A).lerp(D, 0.32); ropePts[2].y = 0.03 + 0.008 * Math.sin(t * 0.6);
  ropePts[3].copy(A).lerp(D, 0.72); ropePts[3].y = 0.035;
  ropePts[4].copy(D); ropePts[4].x -= 0.25; ropePts[4].y = 0.2;
  ropePts[5].copy(D);
  ropeCurve.needsUpdate = true;
  if (!ropeMesh) { ropeMesh = mesh(new THREE.TubeGeometry(ropeCurve, ROPE_SEG, ROPE_R, ROPE_RAD), M.rope); world.add(ropeMesh); return; }
  const fr = ropeCurve.computeFrenetFrames(ROPE_SEG, false), g = ropeMesh.geometry;
  const pos = g.attributes.position.array, nor = g.attributes.normal.array;
  let k = 0;
  for (let i = 0; i <= ROPE_SEG; i++) {
    ropeCurve.getPointAt(i / ROPE_SEG, _rp); const N = fr.normals[i], B = fr.binormals[i];
    for (let j = 0; j <= ROPE_RAD; j++) {
      const v = j / ROPE_RAD * Math.PI * 2, sn = Math.sin(v), cs = -Math.cos(v);
      _rn.set(cs * N.x + sn * B.x, cs * N.y + sn * B.y, cs * N.z + sn * B.z).normalize();
      nor[k] = _rn.x; nor[k + 1] = _rn.y; nor[k + 2] = _rn.z;
      pos[k] = _rp.x + ROPE_R * _rn.x; pos[k + 1] = _rp.y + ROPE_R * _rn.y; pos[k + 2] = _rp.z + ROPE_R * _rn.z; k += 3;
    }
  }
  g.attributes.position.needsUpdate = true; g.attributes.normal.needsUpdate = true; g.computeBoundingSphere();
}

// ---------- vaga-lumes ----------
const FF = 10;
const ffGeo = new THREE.BufferGeometry();
ffGeo.setAttribute("position", new THREE.Float32BufferAttribute(new Float32Array(FF * 3), 3));
ffGeo.setAttribute("color", new THREE.Float32BufferAttribute(new Float32Array(FF * 3), 3));
const ffMat = new THREE.PointsMaterial({ size: 0.16, map: texGlow, vertexColors: true, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false });
const fireflies = new THREE.Points(ffGeo, ffMat); world.add(fireflies);


// ---------- cadeira de praia e o cachorro no píer ----------
const matAlu = lam({ color: 0xc9cdd2 }), matArmW = lam({ color: 0x9a6a40 });
const texStripes = canvasTex(256, 64, (g, w, h) => { const c = ["#2c6aa8", "#f3efe4", "#e8a838", "#f3efe4"];
  for (let i = 0; i < 8; i++) { g.fillStyle = c[i % 4]; g.fillRect(i * w / 8, 0, w / 8 + 1, h); } speckle(g, w, h, 300, "0,0,0", 0.08, 2); });
const matFabric = lam({ map: texStripes, side: THREE.DoubleSide });
function limb(a, b, r1, r2, mat) { const d = b.clone().sub(a), L = d.length(); const geo = new THREE.CylinderGeometry(r2, r1, L, 10); geo.translate(0, L / 2, 0);
  const m = mesh(geo, mat); m.position.copy(a); m.quaternion.setFromUnitVectors(new V3(0, 1, 0), d.normalize()); return m; }
const CHAIR = new THREE.Group(); world.add(CHAIR);
CHAIR.position.set(PX + 0.3, 0.68, -1.5); CHAIR.rotation.y = -0.62;
for (const sx of [-1, 1]) {
  CHAIR.add(limb(new V3(sx * 0.27, 0, 0.22), new V3(sx * 0.27, 0.24, 0.18), 0.012, 0.012, matAlu));
  CHAIR.add(limb(new V3(sx * 0.27, 0, -0.26), new V3(sx * 0.27, 0.22, -0.2), 0.012, 0.012, matAlu));
  CHAIR.add(limb(new V3(sx * 0.27, 0.22, -0.2), new V3(sx * 0.27, 0.24, 0.2), 0.012, 0.012, matAlu));
  CHAIR.add(limb(new V3(sx * 0.27, 0.22, -0.2), new V3(sx * 0.27, 0.88, -0.52), 0.012, 0.012, matAlu));
  const arm = mesh(new THREE.BoxGeometry(0.06, 0.025, 0.42), matArmW); arm.position.set(sx * 0.3, 0.4, -0.03); arm.rotation.x = 0.05; CHAIR.add(arm);
  CHAIR.add(limb(new V3(sx * 0.28, 0.23, 0.14), new V3(sx * 0.3, 0.39, 0.14), 0.01, 0.01, matAlu));
}
{ const seat = mesh(new THREE.PlaneGeometry(0.54, 0.42), matFabric); seat.rotation.x = -Math.PI / 2 + 0.05; seat.position.set(0, 0.215, 0); CHAIR.add(seat);
  const back = mesh(new THREE.PlaneGeometry(0.54, 0.72), matFabric); back.position.set(0, 0.55, -0.36); back.rotation.x = -0.46; CHAIR.add(back);
}

// ===== o cachorro: Shih Tzu preto e branco =====
// coordenadas do cachorro: frente = +z, cima = +y, chão = 0 (deitado, cabeça erguida)
const DOG = new THREE.Group(); world.add(DOG);
DOG.position.set(PX - 0.22, 0.68, -0.8); DOG.rotation.y = -0.85;
const dRnd = mulberry32(2024);
const jit = (c, a) => c.map(v => Math.min(1, Math.max(0, v + (dRnd() - 0.5) * a)));
const D_W = [0.96, 0.95, 0.92], D_C = [0.93, 0.87, 0.76], D_B = [0.07, 0.065, 0.07];
const DOG_NAME = "Loki";
const HEAD_PIV = new V3(0, 0.2, 0.12);           // pescoço
const EYE_L = new V3(0.037, 0.256, 0.268), EYE_R = new V3(-0.037, 0.256, 0.268), NOSE = new V3(0, 0.229, 0.296);
// mapa de cores (manchas da foto)
function dogColor(p) {
  const x = p.x, y = p.y, z = p.z, ax = Math.abs(x);
  if (z > 0.12 && y > 0.17) {                    // cabeça
    if (ax > 0.07 && y > 0.18 && z < 0.27) return D_B;                               // orelhas / laterais
    const de = Math.min(p.distanceTo(EYE_L), p.distanceTo(EYE_R));
    if (de < 0.04 && !(ax < 0.018)) return D_B;                                       // manchas em volta dos olhos
    if (y > 0.29 && ax > 0.035 && ax < 0.08) return D_B;                              // laterais do topo
    if (y < 0.235 && z > 0.25) return D_C;                                            // focinho / barba
    return D_W;
  }
  const saddle = y + 0.035 * Math.sin(z * 30 + 1.0) + 0.03 * Math.sin(x * 40 + 2.0);
  if (saddle > 0.15 && z < 0.08 && z > -0.2) {
    if (Math.sin(z * 22 + 0.6) * Math.sin(x * 25) > 0.55) return D_W;                // pintas brancas na sela
    return D_B;
  }
  if (z < -0.19 && y > 0.12) return D_B;
  return D_W;
}
function fib(n, i) { const yy = 1 - 2 * (i + 0.5) / n, r = Math.sqrt(1 - yy * yy), ph = i * 2.39996323; return new V3(Math.cos(ph) * r, yy, Math.sin(ph) * r); }
// gera mechas sobre um elipsoide
function furPart(out, o) {
  for (let i = 0; i < o.n; i++) {
    const u = fib(o.n, i);
    const p = new V3(o.c.x + u.x * o.r.x, o.c.y + u.y * o.r.y, o.c.z + u.z * o.r.z);
    if (!o.noFloor && p.y < 0.012) continue;
    if (o.skip && o.skip(p)) continue;
    const nrm = new V3(u.x / o.r.x, u.y / o.r.y, u.z / o.r.z).normalize();
    const want = o.flow(nrm, p).normalize().add(new V3(dRnd() - 0.5, dRnd() - 0.5, dRnd() - 0.5).multiplyScalar(o.jit || 0.25));
    let tg = want.clone().sub(nrm.clone().multiplyScalar(want.dot(nrm)));
    if (tg.lengthSq() < 1e-5) tg = new V3(0, -1, 0).sub(nrm.clone().multiplyScalar(-nrm.y));
    tg.normalize();
    const dir = tg.add(nrm.clone().multiplyScalar(o.lift != null ? o.lift : 0.28)).normalize();
    out.push({ p: p.clone().sub(nrm.clone().multiplyScalar(0.006)), dir, nrm, len: o.len[0] + dRnd() * (o.len[1] - o.len[0]),
      rad: o.rad[0] + dRnd() * (o.rad[1] - o.rad[0]), col: jit(o.color ? o.color(p) : dogColor(p), 0.06) });
  }
}
const furMat = lam({ color: 0xffffff });
furMat.userData.furNormals = true;
furMat.customProgramCacheKey = () => "fur-normals";
function furMesh(hairs, origin) {
  const geo = new THREE.SphereGeometry(0.5, 7, 5); geo.translate(0, 0.5, 0);
  { const pa = geo.attributes.position; for (let i = 0; i < pa.count; i++) { const y = pa.getY(i); const k = 1.15 - 0.55 * y; pa.setX(i, pa.getX(i) * k); pa.setZ(i, pa.getZ(i) * k); } geo.computeVertexNormals(); }
  const inst = new THREE.InstancedMesh(geo, furMat, hairs.length);
  const m4 = new THREE.Matrix4(), c = new THREE.Color(), aN = new Float32Array(hairs.length * 3);
  hairs.forEach((h, i) => {
    const Y = h.dir.clone(), nn = h.nrm || new V3(0, 0, 1);
    let Z = nn.clone().sub(Y.clone().multiplyScalar(nn.dot(Y))); if (Z.lengthSq() < 1e-6) Z = new V3(1, 0, 0); Z.normalize();
    const X = new V3().crossVectors(Y, Z).normalize();
    m4.makeBasis(X.multiplyScalar(h.rad * 1.35), Y.multiplyScalar(h.len), Z.multiplyScalar(h.rad * 0.55));
    m4.setPosition(h.p.clone().sub(origin));
    inst.setMatrixAt(i, m4); c.setRGB(h.col[0], h.col[1], h.col[2]); inst.setColorAt(i, c);
    aN[i * 3] = nn.x; aN[i * 3 + 1] = nn.y; aN[i * 3 + 2] = nn.z; });
  geo.setAttribute("aN", new THREE.InstancedBufferAttribute(aN, 3));
  inst.castShadow = true; inst.receiveShadow = true;
  return inst;
}
// volume liso por baixo do pelo (mesmas cores)
function solid(c, r, origin, colorFn, seg = 18) {
  const g = new THREE.SphereGeometry(1, seg, Math.round(seg * 0.7));
  const pa = g.attributes.position, col = new Float32Array(pa.count * 3);
  for (let i = 0; i < pa.count; i++) {
    const p = new V3(c.x + pa.getX(i) * r.x, c.y + pa.getY(i) * r.y, c.z + pa.getZ(i) * r.z);
    pa.setXYZ(i, p.x - origin.x, p.y - origin.y, p.z - origin.z);
    const k = (colorFn || dogColor)(p); col[i * 3] = k[0] * 0.92; col[i * 3 + 1] = k[1] * 0.92; col[i * 3 + 2] = k[2] * 0.92;
  }
  g.setAttribute("color", new THREE.Float32BufferAttribute(col, 3)); g.computeVertexNormals();
  return mesh(g, lam({ vertexColors: true }));
}
const O = new V3(0, 0, 0);
// corpo (grupo que levanta e inclina) — pivô no centro do corpo
const BODY_PIV = new V3(0, 0.1, -0.03);
const dBodyG = new THREE.Group(); dBodyG.position.copy(BODY_PIV); DOG.add(dBodyG);
var dBreath = [];
{
  const hairs = [];
  const sideFlow = (n) => new V3(Math.sign(n.x || 1e-3) * 0.9, -0.55, -0.25).lerp(n, 0.3);
  furPart(hairs, { c: new V3(0, 0.1, -0.03), r: new V3(0.122, 0.098, 0.198), n: 1000, flow: sideFlow, len: [0.075, 0.125], rad: [0.02, 0.032], lift: 0.2 });
  furPart(hairs, { c: new V3(0, 0.13, 0.11), r: new V3(0.098, 0.098, 0.088), n: 300, flow: (n) => new V3(n.x * 0.5, -1, n.z * 0.4), len: [0.06, 0.1], rad: [0.018, 0.028], lift: 0.2 });
  const s1 = solid(new V3(0, 0.1, -0.03), new V3(0.115, 0.092, 0.19), BODY_PIV), s2 = solid(new V3(0, 0.13, 0.11), new V3(0.09, 0.09, 0.08), BODY_PIV);
  const fm = furMesh(hairs, BODY_PIV);
  dBodyG.add(s1, s2, fm); dBreath = [s1, s2, fm];
}
// patas: giram no ombro/quadril (deitado = esticadas pra frente, em pé = pra baixo)
function dogLeg(piv, len, hind) {
  const g = new THREE.Group(); g.position.copy(piv.clone().sub(BODY_PIV)); dBodyG.add(g);
  const hairs = [];
  furPart(hairs, { c: new V3(0, -len * 0.45, 0), r: new V3(0.034, len * 0.5, 0.037), n: hind ? 110 : 90, noFloor: true,
    flow: (n) => new V3(n.x * 0.3, -1, n.z * 0.3), len: [0.035, 0.065], rad: [0.015, 0.022], lift: 0.15,
    color: (p) => (hind && p.y > -len * 0.35 ? D_B : D_W) });
  g.add(solid(new V3(0, -len * 0.45, 0), new V3(0.03, len * 0.5, 0.033), O, () => D_W, 10));
  g.add(furMesh(hairs, O));
  const paw = mesh(new THREE.SphereGeometry(0.027, 10, 8), lam({ color: 0xece9e2 })); paw.scale.set(1, 0.65, 1.35); paw.position.set(0, -len + 0.014, 0.014); g.add(paw);
  return g;
}
const dLegs = { fl: dogLeg(new V3(0.058, 0.05, 0.12), 0.15, false), fr: dogLeg(new V3(-0.058, 0.05, 0.12), 0.15, false),
  hl: dogLeg(new V3(0.078, 0.05, -0.15), 0.15, true), hr: dogLeg(new V3(-0.078, 0.05, -0.15), 0.15, true) };
// coleira vermelha com plaquinha dourada escrita "Loki"
{
  const collar = mesh(new THREE.TorusGeometry(0.084, 0.011, 6, 28), lam({ color: 0xc8323c }));
  collar.position.copy(new V3(0, 0.19, 0.13).sub(BODY_PIV)); collar.rotation.x = -0.35; dBodyG.add(collar);
  const tagTex = canvasTex(128, 128, (g, w, h) => { g.fillStyle = "#dcb54a"; g.beginPath(); g.arc(64, 64, 62, 0, 7); g.fill();
    g.strokeStyle = "#a8832a"; g.lineWidth = 7; g.stroke(); g.fillStyle = "#5a3e10"; g.font = "bold 38px Georgia, serif";
    g.textAlign = "center"; g.textBaseline = "middle"; g.fillText(DOG_NAME, 64, 67); });
  tagTex.wrapS = tagTex.wrapT = THREE.ClampToEdgeWrapping;
  var dTag = mesh(new THREE.CircleGeometry(0.021, 22), new THREE.MeshPhongMaterial({ map: tagTex, specular: 0x886622, shininess: 70, side: THREE.DoubleSide }), true, false);
  dTag.position.copy(new V3(0, 0.122, 0.215).sub(BODY_PIV)); dTag.rotation.x = -0.35; dBodyG.add(dTag);
  const ring = mesh(new THREE.TorusGeometry(0.007, 0.002, 4, 10), lam({ color: 0xd8c27a })); ring.position.copy(new V3(0, 0.146, 0.212).sub(BODY_PIV)); dBodyG.add(ring);
}
// cabeça (gira no pescoço)
const dHead = new THREE.Group(); dHead.position.copy(HEAD_PIV.clone().sub(BODY_PIV)); dBodyG.add(dHead);
{
  const hairs = [];
  const nearFace = (p) => Math.min(p.distanceTo(EYE_L), p.distanceTo(EYE_R)) < 0.03 || p.distanceTo(NOSE) < 0.026;
  // crânio: pelo da cara "abrindo" a partir do nariz (cara de crisântemo)
  furPart(hairs, { c: new V3(0, 0.25, 0.2), r: new V3(0.086, 0.08, 0.08), n: 560, skip: nearFace, lift: 0.22,
    flow: (n, p) => p.clone().sub(NOSE).normalize().lerp(new V3(0, -0.5, 0), p.z < 0.2 ? 0.55 : 0.12), len: [0.03, 0.06], rad: [0.012, 0.02] });
  // focinho e barba/bigode caindo
  furPart(hairs, { c: new V3(0, 0.212, 0.272), r: new V3(0.045, 0.032, 0.035), n: 150, skip: (p) => p.distanceTo(NOSE) < 0.024, lift: 0.15,
    flow: (n) => new V3(n.x * 0.6, -1, 0.3), len: [0.04, 0.07], rad: [0.012, 0.018], color: () => D_W });
  // topete branco
  furPart(hairs, { c: new V3(0, 0.322, 0.19), r: new V3(0.03, 0.02, 0.035), n: 70, flow: (n) => new V3(n.x * 0.4, 1, -0.5), len: [0.045, 0.07], rad: [0.013, 0.018], lift: 0.6, color: () => D_W });
  dHead.add(solid(new V3(0, 0.25, 0.2), new V3(0.08, 0.075, 0.075), HEAD_PIV));
  dHead.add(solid(new V3(0, 0.215, 0.262), new V3(0.04, 0.03, 0.032), HEAD_PIV, () => D_C, 12));
  dHead.add(furMesh(hairs, HEAD_PIV));
  // orelhas compridas, pretas
  var dEars = [];
  for (const sx of [-1, 1]) {
    const eg = new THREE.Group(); const piv = new V3(sx * 0.075, 0.27, 0.18); eg.position.copy(piv.clone().sub(HEAD_PIV)); dHead.add(eg);
    const eh = [];
    furPart(eh, { c: new V3(sx * 0.09, 0.205, 0.178), r: new V3(0.03, 0.075, 0.046), n: 150, flow: () => new V3(sx * 0.25, -1, -0.1), len: [0.06, 0.1], rad: [0.016, 0.024], lift: 0.12, color: () => D_B });
    eg.add(solid(new V3(sx * 0.088, 0.21, 0.178), new V3(0.026, 0.07, 0.04), piv, () => D_B, 10));
    eg.add(furMesh(eh, piv)); dEars.push(eg);
  }
  // olhos grandes com brilho, nariz preto
  const eyeM = new THREE.MeshPhongMaterial({ color: 0x140b06, specular: 0x666666, shininess: 80 });
  const hiM = new THREE.MeshBasicMaterial({ color: 0xffffff });
  var dEyes = [];
  for (const e of [EYE_L, EYE_R]) {
    const ey = mesh(new THREE.SphereGeometry(0.02, 14, 10), eyeM); ey.position.copy(e.clone().sub(HEAD_PIV)); dHead.add(ey); dEyes.push(ey);
    const hl = mesh(new THREE.SphereGeometry(0.0045, 6, 5), hiM, false, false); hl.position.copy(e.clone().sub(HEAD_PIV).add(new V3(0.006, 0.008, 0.016))); dHead.add(hl); dEyes.push(hl);
  }
  const nose = mesh(new THREE.SphereGeometry(0.02, 12, 9), new THREE.MeshPhongMaterial({ color: 0x0c0c0c, specular: 0x555555, shininess: 60 }));
  nose.scale.set(1.15, 0.85, 0.9); nose.position.copy(NOSE.clone().sub(HEAD_PIV)); dHead.add(nose);
  var dTongue = mesh(new THREE.SphereGeometry(0.018, 10, 8), lam({ color: 0xe8708c }));
  dTongue.scale.set(0.95, 0.32, 1.35); dTongue.position.copy(new V3(0, 0.188, 0.286).sub(HEAD_PIV)); dTongue.rotation.x = 0.35; dHead.add(dTongue);
}
// rabo: penacho enrolado sobre as costas (abana)
const dTail = new THREE.Group(); const TAIL_PIV = new V3(0, 0.11, -0.2); dTail.position.copy(TAIL_PIV.clone().sub(BODY_PIV)); dBodyG.add(dTail);
{
  const curve = new THREE.CatmullRomCurve3([new V3(0, 0.11, -0.205), new V3(0.015, 0.075, -0.27), new V3(0.04, 0.045, -0.33), new V3(0.075, 0.03, -0.38), new V3(0.11, 0.028, -0.41)]);
  const hairs = [];
  for (let i = 0; i < 70; i++) {
    const u = i / 69, p = curve.getPoint(u), tg = curve.getTangent(u);
    for (let k = 0; k < 4; k++) {
      const a = (k / 4) * Math.PI * 2 + dRnd();
      const side = new V3(Math.cos(a), 0.15 + dRnd() * 0.4, Math.sin(a) * 0.4).normalize();
      const dir = side.clone().multiplyScalar(0.7).add(tg.clone().multiplyScalar(0.9)).add(new V3(0, -0.25, 0)).normalize();
      const col = u < 0.3 ? D_B : (Math.sin(u * 14 + k) > 0.65 ? D_B : D_W);
      hairs.push({ p: p.clone().add(side.clone().multiplyScalar(0.01)), dir, nrm: side.clone(), len: 0.07 + dRnd() * 0.07, rad: 0.018 + dRnd() * 0.01, col: jit(col, 0.06) });
    }
  }
  dTail.add(furMesh(hairs, TAIL_PIV));
  dTail.add(mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(curve.points.map(q => q.clone().sub(TAIL_PIV))), 20, 0.02, 6), lam({ color: 0xe8e6e0 })));
}
let dogHeadT = 0, dogNext = 0;

// ====================== extras: bolinha, potinho, lamparina, bichos, datas ======================
// bolinha de tênis perto do Loki
const texTennis = canvasTex(256, 128, (g, w, h) => { g.fillStyle = "#d3e23a"; g.fillRect(0, 0, w, h); speckle(g, w, h, 900, "255,255,200", 0.25, 2); speckle(g, w, h, 600, "120,140,20", 0.2, 2);
  g.strokeStyle = "#f4f4ee"; g.lineWidth = 7; g.beginPath(); for (let x = 0; x <= w; x += 2) { const y = h / 2 + Math.sin(x / w * Math.PI * 4) * h * 0.28; x ? g.lineTo(x, y) : g.moveTo(x, y); } g.stroke(); });
const BALL = mesh(new THREE.SphereGeometry(0.032, 16, 12), lam({ map: texTennis })); BALL.position.set(PX - 0.64, 0.68 + 0.032, -0.5); BALL.rotation.set(0.4, 1.1, 0.2); world.add(BALL);
// potinho de água com o nome
const BOWL = new THREE.Group(); BOWL.position.set(PX + 0.66, 0.68, -1.0); world.add(BOWL);
{
  const pts = [[0.0, 0.0], [0.058, 0.0], [0.075, 0.006], [0.088, 0.042], [0.092, 0.05], [0.084, 0.052], [0.072, 0.02], [0.0, 0.02]].map(([x, y]) => new THREE.Vector2(x, y));
  const steel = new THREE.MeshPhongMaterial({ color: 0xc4c9cf, specular: 0x9aa0a8, shininess: 90, side: THREE.DoubleSide });
  BOWL.add(mesh(new THREE.LatheGeometry(pts, 28), steel));
  const wat = mesh(new THREE.CircleGeometry(0.07, 24), new THREE.MeshPhongMaterial({ color: 0x5f9fbd, specular: 0xffffff, shininess: 140 }), false, true);
  wat.rotation.x = -Math.PI / 2; wat.position.y = 0.036; BOWL.add(wat);
  const nameTex = canvasTex(512, 64, (g, w, h) => { g.clearRect(0, 0, w, h); g.fillStyle = "#24476f"; g.font = "bold 46px 'Segoe UI', Arial, sans-serif";
    g.textAlign = "center"; g.textBaseline = "middle"; g.fillText(DOG_NAME.toUpperCase(), w * 0.25, h / 2 + 2); g.fillStyle = "#c8323c"; g.fillText("♥", w * 0.75, h / 2 + 2); });
  nameTex.wrapS = THREE.RepeatWrapping; nameTex.wrapT = THREE.ClampToEdgeWrapping;
  const band = mesh(new THREE.CylinderGeometry(0.0905, 0.084, 0.034, 32, 1, true), new THREE.MeshBasicMaterial({ map: nameTex, transparent: true, side: THREE.FrontSide }), false, false);
  band.position.y = 0.031; band.rotation.y = 2.1; BOWL.add(band);
}
// lamparina no banco de trás do barco
const BOAT_LAMP = new THREE.Group(); BOAT_LAMP.position.set(-1.12, 0.142, 0.08); boat.add(BOAT_LAMP);
const lampChimney = lam({ color: 0xd8d2c0, emissive: 0x000000 });
{
  const brass = lam({ color: 0xb48a3c });
  BOAT_LAMP.add(mesh(new THREE.CylinderGeometry(0.04, 0.045, 0.02, 14), brass));
  const tank = mesh(new THREE.CylinderGeometry(0.032, 0.038, 0.04, 14), brass); tank.position.y = 0.03; BOAT_LAMP.add(tank);
  const chim = mesh(new THREE.CylinderGeometry(0.018, 0.026, 0.075, 12), lampChimney, false, false); chim.position.y = 0.088; BOAT_LAMP.add(chim);
  const cp = mesh(new THREE.CylinderGeometry(0.02, 0.015, 0.012, 10), brass); cp.position.y = 0.13; BOAT_LAMP.add(cp);
  const hd = mesh(new THREE.TorusGeometry(0.03, 0.003, 4, 16, Math.PI), brass); hd.position.y = 0.135; BOAT_LAMP.add(hd);
}
const boatLight = new THREE.PointLight(0xffb060, 0, 3.0, 2); boatLight.position.y = 0.09; BOAT_LAMP.add(boatLight);

// (o sapo foi retirado)
const FROG = new THREE.Group(); FROG.visible = false; world.add(FROG);
var frogThroat = new THREE.Object3D();
FROG.scale.setScalar(1.3);

// ---------- libélulas e borboletas ----------
function makeDragonfly(col) {
  const g = new THREE.Group();
  const bodyM = new THREE.MeshPhongMaterial({ color: col, specular: 0x99bbff, shininess: 60 });
  const ab = mesh(new THREE.CylinderGeometry(0.004, 0.007, 0.075, 6), bodyM, true, false); ab.rotation.x = Math.PI / 2; ab.position.z = -0.04; g.add(ab);
  const th = mesh(new THREE.SphereGeometry(0.011, 8, 6), bodyM, true, false); th.scale.set(1, 0.9, 1.4); g.add(th);
  const hd = mesh(new THREE.SphereGeometry(0.009, 8, 6), bodyM, true, false); hd.position.z = 0.015; g.add(hd);
  const wingM = new THREE.MeshBasicMaterial({ color: 0xe8f4ff, transparent: true, opacity: 0.5, side: THREE.DoubleSide, depthWrite: false });
  const wings = [];
  for (const [zz, len] of [[0.004, 0.058], [-0.012, 0.052]]) for (const sx of [-1, 1]) {
    const wg = new THREE.Group(); wg.position.set(0, 0.004, zz); g.add(wg);
    const w = mesh(new THREE.PlaneGeometry(len, 0.013), wingM, true, false); w.rotation.x = -Math.PI / 2; w.position.x = sx * len / 2; wg.add(w);
    wings.push({ wg, sx });
  }
  g.userData.wings = wings; g.scale.setScalar(1.5); return g;
}
function makeButterfly(c1, c2) {
  const g = new THREE.Group();
  const tex = canvasTex(128, 128, (gg, w, h) => { gg.clearRect(0, 0, w, h);
    gg.fillStyle = c1; gg.beginPath(); gg.moveTo(4, 64); gg.bezierCurveTo(40, -10, 124, 0, 120, 50); gg.bezierCurveTo(118, 70, 70, 70, 60, 66);
    gg.bezierCurveTo(90, 80, 110, 120, 70, 124); gg.bezierCurveTo(40, 126, 20, 90, 4, 64); gg.fill();
    gg.strokeStyle = "#1a1a1a"; gg.lineWidth = 8; gg.stroke(); gg.fillStyle = "#fff";
    for (let i = 0; i < 6; i++) { gg.beginPath(); gg.arc(104 - i * 9, 26 + (i % 2) * 9, 3.2, 0, 7); gg.fill(); }
    gg.fillStyle = c2; gg.beginPath(); gg.arc(52, 46, 12, 0, 7); gg.fill(); gg.beginPath(); gg.arc(66, 98, 9, 0, 7); gg.fill(); });
  tex.wrapS = tex.wrapT = THREE.ClampToEdgeWrapping;
  const wm = new THREE.MeshLambertMaterial({ map: tex, transparent: true, alphaTest: 0.4, side: THREE.DoubleSide });
  const body = mesh(new THREE.CylinderGeometry(0.004, 0.004, 0.04, 6), lam({ color: 0x1a1612 }), true, false); body.rotation.x = Math.PI / 2; g.add(body);
  const wings = [];
  for (const sx of [-1, 1]) {
    const wg = new THREE.Group(); g.add(wg);
    const w = mesh(new THREE.PlaneGeometry(0.06, 0.06), wm, true, false); w.rotation.x = -Math.PI / 2; w.position.x = sx * 0.03; if (sx < 0) w.scale.x = -1; wg.add(w);
    wings.push({ wg, sx });
  }
  g.userData.wings = wings; g.scale.setScalar(1.6); return g;
}
const INSECTS = [];
[[0x2b6fd8, [PX - 0.4, 0.35, 0.7]], [0x3aa86a, [-3.4, 0.3, 0.4]]].forEach(([col, home]) => {
  const g = makeDragonfly(col); world.add(g);
  INSECTS.push({ kind: "drag", g, home: new V3(...home), pos: new V3(...home), from: new V3(...home), to: new V3(...home), t0: 0, dur: 1, next: 0 });
});
[["#f08a24", "#ffd25a", [PX + 0.2, 0.8, -0.9]], ["#3b7de0", "#9fd0ff", [-4.6, 0.7, -0.2]]].forEach(([c1, c2, home]) => {
  const g = makeButterfly(c1, c2); world.add(g);
  INSECTS.push({ kind: "bfly", g, home: new V3(...home), pos: new V3(...home), vel: new V3(), land: 0, landAt: null, next: 0, ph: rnd() * 6 });
});

// ---------- datas especiais ----------
// Natal: pisca-pisca no píer
const XMAS = new THREE.Group(); world.add(XMAS);
const xmasPts = [], xmasCols = [[1, 0.25, 0.22], [0.25, 1, 0.35], [1, 0.82, 0.25], [0.35, 0.55, 1], [1, 1, 1]];
for (const sx of [-1, 1]) for (let z = -0.55; z > -6.6; z -= 0.22) xmasPts.push(new V3(PX + sx * 1.03, 0.665 + 0.012 * Math.sin(z * 9), z));
for (let x = PX - 0.95; x <= PX + 0.96; x += 0.19) xmasPts.push(new V3(x, 0.66, -0.43));
const xmasInst = new THREE.InstancedMesh(new THREE.SphereGeometry(0.02, 8, 6), new THREE.MeshBasicMaterial({ color: 0xffffff }), xmasPts.length);
xmasPts.forEach((p, i) => { xmasInst.setMatrixAt(i, new THREE.Matrix4().makeTranslation(p.x, p.y, p.z)); xmasInst.setColorAt(i, new THREE.Color(...xmasCols[i % 5])); });
XMAS.add(xmasInst);
// gorro de Papai Noel e chapéu de aniversário no Loki
const SANTA = new THREE.Group(); SANTA.position.copy(new V3(0.0, 0.335, 0.19).sub(HEAD_PIV)); SANTA.rotation.set(-0.45, 0, 0.3); dHead.add(SANTA);
{ const c = mesh(new THREE.ConeGeometry(0.052, 0.11, 16), lam({ color: 0xc8202a })); c.position.y = 0.055; SANTA.add(c);
  const br = mesh(new THREE.TorusGeometry(0.05, 0.014, 6, 18), lam({ color: 0xf4f2ee })); br.rotation.x = Math.PI / 2; SANTA.add(br);
  const pp = mesh(new THREE.SphereGeometry(0.017, 10, 8), lam({ color: 0xf4f2ee })); pp.position.y = 0.115; SANTA.add(pp); }
const PARTY = new THREE.Group(); PARTY.position.copy(new V3(0.02, 0.335, 0.19).sub(HEAD_PIV)); PARTY.rotation.set(-0.35, 0, 0.35); dHead.add(PARTY);
{ const tex = canvasTex(128, 128, (g, w, h) => { const cs = ["#e63946", "#f4d35e", "#2a9d8f", "#457b9d"]; for (let i = 0; i < 8; i++) { g.fillStyle = cs[i % 4]; g.fillRect(i * 16, 0, 16, h); }
    g.fillStyle = "#fff"; for (let i = 0; i < 18; i++) { g.beginPath(); g.arc((i * 37) % 128, (i * 53) % 128, 4, 0, 7); g.fill(); } });
  const c = mesh(new THREE.ConeGeometry(0.045, 0.12, 16), lam({ map: tex })); c.position.y = 0.06; PARTY.add(c);
  const pp = mesh(new THREE.SphereGeometry(0.016, 10, 8), lam({ color: 0xf4d35e })); pp.position.y = 0.125; PARTY.add(pp); }
// balões presos na cadeira (aniversário)
const BALLOONS = new THREE.Group(); world.add(BALLOONS);
const balloonList = [];
[[0xe63946, -0.12, 0.62, 0.05], [0xf4d35e, 0.1, 0.78, -0.04], [0x2a9d8f, 0.02, 0.92, 0.1], [0x457b9d, -0.05, 0.7, -0.12]].forEach(([col, dx, dy, dz]) => {
  const b = mesh(new THREE.SphereGeometry(0.075, 16, 12), new THREE.MeshPhongMaterial({ color: col, specular: 0xffffff, shininess: 90 })); b.scale.set(1, 1.18, 1);
  const knot = mesh(new THREE.ConeGeometry(0.012, 0.02, 8), new THREE.MeshPhongMaterial({ color: col })); knot.position.y = -0.092; knot.rotation.x = Math.PI; b.add(knot);
  BALLOONS.add(b);
  const lg = new THREE.BufferGeometry(); lg.setAttribute("position", new THREE.Float32BufferAttribute(new Float32Array(6), 3));
  const line = new THREE.Line(lg, new THREE.LineBasicMaterial({ color: 0xeeeeee })); BALLOONS.add(line);
  balloonList.push({ b, line, off: new V3(dx, dy, dz), ph: rnd() * 6 });
});
// abóbora de Halloween com vela
const PUMPKIN = new THREE.Group(); PUMPKIN.position.set(PX + 0.72, 0.68, -2.05); PUMPKIN.rotation.y = -0.54; world.add(PUMPKIN);
const pumpFace = new THREE.MeshBasicMaterial({ color: 0x1a0d05, side: THREE.DoubleSide });
const pumpLight = new THREE.PointLight(0xff8a2a, 0, 2.2, 2); pumpLight.position.set(0, 0.1, 0); PUMPKIN.add(pumpLight);
{
  const pg = new THREE.SphereGeometry(0.13, 28, 18); const pa = pg.attributes.position;
  for (let i = 0; i < pa.count; i++) { const x = pa.getX(i), y = pa.getY(i), z = pa.getZ(i); const ph = Math.atan2(z, x); const k = 1 - 0.07 * Math.pow(Math.abs(Math.cos(ph * 4)), 0.6); pa.setXYZ(i, x * k, y * 0.78, z * k); }
  pg.computeVertexNormals();
  const body = mesh(pg, lam({ color: 0xe0761f })); body.position.y = 0.1; PUMPKIN.add(body);
  const stem = mesh(new THREE.CylinderGeometry(0.012, 0.018, 0.05, 8), lam({ color: 0x5a6b2a })); stem.position.y = 0.205; stem.rotation.z = 0.25; PUMPKIN.add(stem);
  const tri = (pts) => { const sh = new THREE.Shape(); pts.forEach(([x, y], i) => i ? sh.lineTo(x, y) : sh.moveTo(x, y)); return new THREE.ShapeGeometry(sh); };
  const face = new THREE.Group(); face.position.set(0, 0.1, 0.127); PUMPKIN.add(face);
  face.add(mesh(tri([[-0.06, 0.02], [-0.02, 0.02], [-0.04, 0.055]]), pumpFace, false, false));
  face.add(mesh(tri([[0.02, 0.02], [0.06, 0.02], [0.04, 0.055]]), pumpFace, false, false));
  face.add(mesh(tri([[-0.065, -0.02], [-0.04, -0.035], [-0.015, -0.025], [0.0, -0.04], [0.02, -0.025], [0.045, -0.035], [0.065, -0.02], [0.03, -0.06], [-0.03, -0.06]]), pumpFace, false, false));
}
// Festa Junina: bandeirinhas
const JUNINA = new THREE.Group(); world.add(JUNINA);
const flagList = [];
{
  const cols = [0xe63946, 0xf4d35e, 0x2a9d8f, 0x3a86ff, 0xff8c42, 0xf28ab2];
  const strings = [[new V3(PX - 0.98, 1.74, -0.62), new V3(PX + 0.98, 1.72, -2.92)], [new V3(PX - 0.98, 1.72, -2.92), new V3(PX - 0.98, 1.74, -0.62)], [new V3(PX - 0.98, 1.72, -2.92), new V3(PX + 0.98, 1.72, -2.92)]];
  const tri = new THREE.Shape(); tri.moveTo(-0.035, 0); tri.lineTo(0.035, 0); tri.lineTo(0, -0.085); const triG = new THREE.ShapeGeometry(tri);
  strings.forEach(([a, b], si) => {
    const pts = []; for (let i = 0; i <= 20; i++) { const u = i / 20, p = a.clone().lerp(b, u); p.y -= Math.sin(u * Math.PI) * 0.22; pts.push(p); }
    const curve = new THREE.CatmullRomCurve3(pts);
    const dir = b.clone().sub(a); const ang = -Math.atan2(dir.z, dir.x);
    const n = Math.floor(a.distanceTo(b) / 0.11);
    for (let i = 1; i < n; i++) {
      const p = curve.getPoint(i / n);
      const f = mesh(triG, new THREE.MeshLambertMaterial({ color: cols[(i + si) % cols.length], side: THREE.DoubleSide }), true, false);
      const fg = new THREE.Group(); fg.position.copy(p); fg.rotation.y = ang; fg.add(f); JUNINA.add(fg);
      flagList.push({ fg, ph: rnd() * 6 });
    }
  });
}

// ====================== aconchego ======================
// varal de luzinhas quentes (fica o ano todo; acende ao entardecer)
const VARAL = new THREE.Group(); world.add(VARAL);
const varalBulbs = [];
const VARAL_STRINGS = [[new V3(PX - 0.98, 1.74, PZ0), new V3(PX + 0.98, 1.72, -2.92)], [new V3(PX - 0.98, 1.72, -2.92), new V3(PX - 0.98, 1.74, PZ0)],
                       [new V3(PX - 0.98, 1.72, -2.92), new V3(PX + 0.98, 1.72, -2.92)]];
{
  const wood = lam({ color: 0x8a6a46 });
  for (const sx of [-1, 1]) { const p = mesh(new THREE.CylinderGeometry(0.018, 0.022, 0.9, 8), wood); p.position.set(PX + sx * 0.98, 1.29, -2.92); VARAL.add(p); }
  VARAL_STRINGS.forEach(([a, b]) => {
    const pts = []; for (let i = 0; i <= 20; i++) { const u = i / 20, p = a.clone().lerp(b, u); p.y -= Math.sin(u * Math.PI) * 0.22; pts.push(p); }
    const curve = new THREE.CatmullRomCurve3(pts);
    VARAL.add(mesh(new THREE.TubeGeometry(curve, 30, 0.003, 4), lam({ color: 0x3a342c }), false, false));
    const n = Math.floor(a.distanceTo(b) / 0.16);
    for (let i = 1; i < n; i++) varalBulbs.push(curve.getPoint(i / n).add(new V3(0, -0.02, 0)));
  });
}
const varalInst = new THREE.InstancedMesh(new THREE.SphereGeometry(0.017, 8, 6), new THREE.MeshBasicMaterial({ color: 0xffffff }), varalBulbs.length);
varalBulbs.forEach((p, i) => { varalInst.setMatrixAt(i, new THREE.Matrix4().makeTranslation(p.x, p.y, p.z)); varalInst.setColorAt(i, new THREE.Color(0.5, 0.42, 0.3)); });
VARAL.add(varalInst);
// (a manta xadrez da cadeira foi retirada; avança o sorteio igual a antes para o resto da cena não mudar de lugar)
for (let i = 0; i < 1500 * 5; i++) rnd();
// longneck de cerveja no braço esquerdo da cadeira
const BEER = new THREE.Group(); BEER.position.set(-0.3, 0.4125, 0.06); CHAIR.add(BEER);
{
  const prof = [[0, 0], [0.0195, 0], [0.021, 0.004], [0.021, 0.085], [0.0195, 0.098], [0.012, 0.118], [0.0085, 0.13], [0.0085, 0.152], [0.0098, 0.156], [0.0098, 0.16], [0, 0.16]]
    .map(([r, y]) => new THREE.Vector2(r, y));
  const glass = new THREE.MeshPhongMaterial({ color: 0x5a2c0c, specular: 0xffe0b0, shininess: 120, emissive: 0x120600 });
  BEER.add(mesh(new THREE.LatheGeometry(prof, 24), glass));
  // rótulo e gargantilha (marca inventada)
  const lab = canvasTex(256, 64, (g, w, h) => { g.fillStyle = "#efe6cf"; g.fillRect(0, 0, w, h); g.fillStyle = "#b8262c"; g.fillRect(0, 0, w, 9); g.fillRect(0, h - 9, w, 9);
    g.fillStyle = "#3a2a14"; g.font = "bold 26px Georgia, serif"; g.textAlign = "center"; g.textBaseline = "middle"; g.fillText("LAGO", w * 0.25, h / 2 + 2); g.fillText("LAGO", w * 0.75, h / 2 + 2); });
  lab.wrapT = THREE.ClampToEdgeWrapping;
  const band = mesh(new THREE.CylinderGeometry(0.0213, 0.0213, 0.042, 24, 1, true), lam({ map: lab }), false, true); band.position.y = 0.045; band.rotation.y = 2.4; BEER.add(band);
  const neckL = mesh(new THREE.CylinderGeometry(0.0089, 0.0089, 0.014, 16, 1, true), lam({ color: 0xb8262c }), false, true); neckL.position.y = 0.14; BEER.add(neckL);
  const capM = new THREE.MeshPhongMaterial({ color: 0xc9a440, specular: 0xffffff, shininess: 90 });
  const capG = mesh(new THREE.CylinderGeometry(0.0102, 0.0105, 0.007, 16), capM); capG.position.y = 0.1625; BEER.add(capG);
}
// cinzeiro no braço direito, com duas bitucas
const ASHTRAY = new THREE.Group(); ASHTRAY.position.set(0.3, 0.4125, -0.08); CHAIR.add(ASHTRAY);
{
  const prof = [[0, 0], [0.03, 0], [0.034, 0.004], [0.036, 0.016], [0.031, 0.017], [0.027, 0.006], [0, 0.006]].map(([r, y]) => new THREE.Vector2(r, y));
  ASHTRAY.add(mesh(new THREE.LatheGeometry(prof, 28), new THREE.MeshPhongMaterial({ color: 0x8c949c, specular: 0xffffff, shininess: 70 })));
  const ash = mesh(new THREE.CircleGeometry(0.026, 20), lam({ color: 0x77736c }), false, true); ash.rotation.x = -Math.PI / 2; ash.position.y = 0.0068; ASHTRAY.add(ash);
  const paper = lam({ color: 0xece8de }), filt = lam({ color: 0xc98a3c });
  const butt = (x, z, ry, tilt) => { const g = new THREE.Group(); g.position.set(x, 0.009, z); g.rotation.set(0, ry, tilt); ASHTRAY.add(g);
    const p = mesh(new THREE.CylinderGeometry(0.0035, 0.0035, 0.016, 8), paper); p.rotation.z = Math.PI / 2; p.position.x = 0.004; g.add(p);
    const fl = mesh(new THREE.CylinderGeometry(0.0036, 0.0036, 0.012, 8), filt); fl.rotation.z = Math.PI / 2; fl.position.x = 0.018; g.add(fl);
    const tip = mesh(new THREE.CircleGeometry(0.0034, 8), lam({ color: 0x3a3632 }), false, false); tip.rotation.y = -Math.PI / 2; tip.position.x = -0.0041; g.add(tip); };
  butt(-0.006, 0.006, 0.7, 0.05); butt(0.004, -0.008, 2.6, -0.12);
}

// taboas balançando na beira do lago
const REEDS = [];
{
  const stemM = lam({ color: 0x5f7f34 }), headM = lam({ color: 0x6b4426 }), leafM = lam({ color: 0x7a9a3c, side: THREE.DoubleSide });
  [[-7.6, -3.4, 12], [-7.9, -1.9, 8], [7.75, 1.75, 11], [7.2, 2.3, 7]].forEach(([cx, cz, n]) => {
    for (let i = 0; i < n; i++) {
      const g = new THREE.Group(); g.position.set(cx + (rnd() - 0.5) * 0.55, -0.05, cz + (rnd() - 0.5) * 0.45); world.add(g);
      const hgt = 0.7 + rnd() * 0.55;
      const st = mesh(new THREE.CylinderGeometry(0.007, 0.011, hgt, 5), stemM); st.position.y = hgt / 2; g.add(st);
      if (rnd() < 0.7) { const hd = mesh(new THREE.CapsuleGeometry(0.02, 0.09, 3, 8), headM); hd.position.y = hgt - 0.08; g.add(hd); }
      const lf = mesh(new THREE.PlaneGeometry(0.03, hgt * 0.8), leafM); lf.position.set(0.012, hgt * 0.4, 0); lf.rotation.set(0, rnd() * 3, 0.12); g.add(lf);
      g.rotation.y = rnd() * 6;
      REEDS.push({ g, ph: rnd() * 6, k: 0.03 + rnd() * 0.04 });
    }
  });
}

// ---------- contorno de luz (rim) nos objetos ----------
const RIM = { uRim: { value: 0 }, uRimCol: { value: new THREE.Color(0.5, 0.6, 0.9) } };
{
  const done = new Set();
  scene.traverse(o => {
    const m = o.material;
    if (!m || !m.isMeshLambertMaterial || done.has(m)) return;
    done.add(m);
    const furN = !!m.userData.furNormals;
    m.onBeforeCompile = sh => {
      if (furN) sh.vertexShader = "attribute vec3 aN;\n" + sh.vertexShader.replace("#include <defaultnormal_vertex>", "vec3 transformedNormal = normalMatrix * normalize(aN);");
      sh.uniforms.uRim = RIM.uRim; sh.uniforms.uRimCol = RIM.uRimCol;
      sh.fragmentShader = "uniform float uRim; uniform vec3 uRimCol;\n" + sh.fragmentShader.replace("#include <opaque_fragment>",
        "float rimF = pow(1.0 - clamp(dot(normalize(normal), normalize(vViewPosition)), 0.0, 1.0), 3.0);\n outgoingLight += uRimCol * rimF * uRim;\n#include <opaque_fragment>");
    };
  });
}

// ---------- fundo do lago ----------
const floorMat = new THREE.MeshBasicMaterial({ color: 0x05080f });
const floor = new THREE.Mesh(new THREE.PlaneGeometry(90, 90), floorMat); floor.rotation.x = -Math.PI / 2; floor.position.y = -1.6; floor.visible = false; scene.add(floor);

// ---------- luzes ----------
const hemi = new THREE.HemisphereLight(0xffffff, 0x223344, 0.5); scene.add(hemi);
const sun = new THREE.DirectionalLight(0xffffff, 1.0);
sun.castShadow = true;
Object.assign(sun.shadow.camera, { left: -11, right: 11, top: 11, bottom: -11, near: 1, far: 70 });
sun.shadow.mapSize.set(1280, 1280);
sun.shadow.bias = -0.0006; sun.shadow.normalBias = 0.02; sun.shadow.radius = 3;
sun.target.position.set(0, 0, -1); scene.add(sun, sun.target);
const lampLight = new THREE.PointLight(0xffa050, 0, 7, 2); lampLight.position.copy(LAMP); scene.add(lampLight);

// ====================== água ======================
// Feita em duas etapas para pesar pouco na placa de vídeo:
//  1) "dados da água" em meia resolução: ondas e normal (ruído com derivada exata), cor de fundo,
//     peixes, anéis, sombra, céu e reflexo, mais a intensidade dos pontinhos
//  2) na resolução cheia: só o que precisa ser nítido — pontinhos (meio-tom), brilhos finos, luzes e estrelas
const WU = {
  uTime: { value: 0 }, uWind: { value: 0.25 }, uRain: { value: 0 }, uDay: { value: 1 }, uCloud: { value: 0 }, uCloudy: { value: 0 },
  uDeep: { value: new V3() }, uLight: { value: new V3() }, uHi: { value: new V3() }, uGlint: { value: 0.3 },
  uBoat: { value: new THREE.Vector4() }, uBeat: { value: 0 }, uGlintDir: { value: new V3(0, 1, -1).normalize() }, uGlintCol: { value: new V3(1, 1, 1) },
  uLamp: { value: new V3() }, uLampOn: { value: 0 }, uPX: { value: PX }, tReflect: { value: null }, uTexMat: { value: new THREE.Matrix4() },
  uPulseAge: { value: new V3(-1, -1, -1) }, uFish: { value: [new THREE.Vector4(), new THREE.Vector4(), new THREE.Vector4()] },
  uSplash: { value: new THREE.Vector4(0, 0, -1, 0) }, uMeteor: { value: new THREE.Vector4() }, uMeteorT: { value: -1 },
  uFw: { value: [new THREE.Vector4(0, 0, -1, 0), new THREE.Vector4(0, 0, -1, 0), new THREE.Vector4(0, 0, -1, 0)] }, uFwOn: { value: 0 },
  uLamp2: { value: new V3() }, uLamp2On: { value: 0 },
  tNoise: { value: texNoise }, uOffA: { value: new THREE.Vector4() }, uOffB: { value: new THREE.Vector4() }, uOffC: { value: new THREE.Vector4() }, uOffD: { value: new THREE.Vector4() },
  uRipPh: { value: new THREE.Vector4() }, uBeatPh: { value: 0 }, uFloor: { value: new V3() }, uDotCol: { value: new V3(1, 1, 1) },
  tShadow: { value: null }, uShadowM: { value: new THREE.Matrix4() }, uShadowBias: { value: -0.0006 }, uShadowNB: { value: 0.02 }, uShadowSize: { value: new THREE.Vector2(2048, 2048) },
  tWD0: { value: null }, tWD1: { value: null }, uRes: { value: new THREE.Vector2(1, 1) },
};
const GLSL_NOISE = `
uniform sampler2D tNoise;
float w_hash(vec2 p){ p = fract(p*vec2(123.34, 456.21)); p += dot(p, p+45.32); return fract(p.x*p.y); }
// ruído de valor suave lido de uma textura que guarda os 4 cantos de cada célula: 1 leitura, valor + derivada exata
vec3 nD(vec2 p){
  vec2 i = floor(p), f = p - i;
  vec4 c = texture2D(tNoise, (i + 0.5)*(1.0/256.0));
  vec2 u = f*f*(3.0 - 2.0*f), du = 6.0*f*(1.0 - f);
  float k1 = c.y - c.x, k2 = c.z - c.x, k3 = c.x - c.y - c.z + c.w;
  return vec3(c.x + k1*u.x + k2*u.y + k3*u.x*u.y, du*vec2(k1 + k3*u.y, k2 + k3*u.x));
}
float n1(vec2 p){ vec2 i = floor(p), f = p - i; vec4 c = texture2D(tNoise, (i + 0.5)*(1.0/256.0)); vec2 u = f*f*(3.0 - 2.0*f);
  return mix(mix(c.x, c.y, u.x), mix(c.z, c.w, u.x), u.y); }
// fbm com poucas oitavas; a constante no fim compensa a média das oitavas que faltam
float fbm2(vec2 p){ return 0.5*n1(p) + 0.25*n1(p*2.0 + vec2(17.1, 9.2)) + 0.09375; }
float fbm3(vec2 p){ float v = 0.5*n1(p); p = p*2.0 + vec2(17.1, 9.2); v += 0.25*n1(p); p = p*2.0 + vec2(17.1, 9.2); return v + 0.125*n1(p) + 0.03125; }
vec3 fbmD2(vec2 p){ vec3 a = 0.5*nD(p); p = p*2.0 + vec2(17.1, 9.2); vec3 n = nD(p); a += 0.25*vec3(n.x, n.yz*2.0); a.x += 0.09375; return a; }
vec3 fbmD3(vec2 p){ vec3 a = 0.5*nD(p); p = p*2.0 + vec2(17.1, 9.2); vec3 n = nD(p); a += 0.25*vec3(n.x, n.yz*2.0);
  p = p*2.0 + vec2(17.1, 9.2); n = nD(p); a += 0.125*vec3(n.x, n.yz*4.0); a.x += 0.03125; return a; }
vec3 fbmD4(vec2 p){ vec3 a = 0.5*nD(p); p = p*2.0 + vec2(17.1, 9.2); vec3 n = nD(p); a += 0.25*vec3(n.x, n.yz*2.0);
  p = p*2.0 + vec2(17.1, 9.2); n = nD(p); a += 0.125*vec3(n.x, n.yz*4.0);
  p = p*2.0 + vec2(17.1, 9.2); n = nD(p); a += 0.0625*vec3(n.x, n.yz*4.8); return a; }   // última oitava mais suave no relevo (como antes)
float sstep(float e0, float e1, float x){ return smoothstep(e0, e1, x); }
float rstep(float hi, float lo, float x){ return 1.0 - smoothstep(lo, hi, x); }   // degrau invertido (de 1 para 0)
float bayer2(vec2 a){ a = floor(a); return fract(a.x/2.0 + a.y*a.y*0.75); }
float bayer4(vec2 a){ return bayer2(0.5*a)*0.25 + bayer2(a); }
`;

// ---------- etapa 1: dados da água (meia resolução, dois alvos de saída) ----------
const WD_VS = `
uniform mat4 uTexMat, uShadowM; uniform float uShadowNB;
varying vec3 vW; varying vec4 vRefUv; varying vec4 vSC;
void main(){
  vec4 wp = modelMatrix*vec4(position, 1.0); vW = wp.xyz;
  vRefUv = uTexMat*vec4(position, 1.0);
  vSC = uShadowM*vec4(wp.xyz + vec3(0.0, uShadowNB, 0.0), 1.0);
  gl_Position = projectionMatrix*viewMatrix*wp;
}`;
const WD_FS = `
uniform sampler2D tReflect, tShadow;
uniform float uWind, uRain, uDay, uCloud, uCloudy, uBeat, uBeatPh, uPX, uTime, uShadowBias;
uniform vec2 uShadowSize;
uniform vec4 uOffA, uOffB, uOffC, uOffD, uRipPh, uSplash, uBoat;
uniform vec3 uPulseAge, uDeep, uLight, uHi, uGlintDir;
uniform vec4 uFish[3];
varying vec3 vW; varying vec4 vRefUv; varying vec4 vSC;
layout(location = 0) out highp vec4 oCol;
layout(location = 1) out highp vec4 oNrm;
#include <packing>
${GLSL_NOISE}
// ondas saindo do barco em pulsos: (valor, derivada em r)
vec2 pulseD(float rr, float k){
  vec2 acc = vec2(0.0);
  for (int i = 0; i < 3; i++) {
    float age = uPulseAge[i];
    if (age > 0.0 && age < 28.0) {
      float front = 0.7 + age*0.32;
      float env = rstep(front + 0.25, front - 0.5, rr)*sstep(front - 4.2, front - 1.6, rr);
      float a = (rr - front)*k;
      acc += vec2(sin(a), k*cos(a))*env*exp(-age*0.085)*sstep(0.0, 1.2, age);
    }
  }
  return acc;
}
// gotas de chuva: (valor, gradiente)
vec3 rainD(vec2 p){
  vec2 g = p/0.45; vec2 id = floor(g), f = g - id; vec3 acc = vec3(0.0);
  for (int j = -1; j <= 1; j++) for (int i = -1; i <= 1; i++) {
    vec2 o = vec2(float(i), float(j)), cid = id + o; float h = w_hash(cid);
    float lt = uTime*(0.9 + 0.7*h)*0.7 + h*7.0; float ph = fract(lt), cyc = floor(lt);
    float on = step(w_hash(cid*1.3 + cyc*0.71 + 2.0), uRain);
    vec2 dv = f - o - vec2(w_hash(cid + cyc*1.7), w_hash(cid + cyc*3.1 + 5.0));
    float dd = max(length(dv), 1e-4), x = (dd - ph*0.8)*40.0;
    float w = on*step(abs(x), 3.2)*(1.0 - ph);
    acc.x += w*sin(clamp(x, -3.14159, 3.14159));
    acc.yz += w*40.0*cos(x)*step(abs(x), 3.14159)*(dv/dd)/0.45;
  }
  return acc;
}
float shTap(vec2 uv, float z){ return step(z, unpackRGBAToDepth(texture2D(tShadow, uv))); }
float waterShadow(){
  vec3 c = vSC.xyz/vSC.w; c.z += uShadowBias;
  if (c.x < 0.0 || c.x > 1.0 || c.y < 0.0 || c.y > 1.0 || c.z > 1.0) return 1.0;
  vec2 tx = 1.0/uShadowSize, p = c.xy*uShadowSize - 0.5, f = fract(p), b = (floor(p) + 0.5)*tx;
  return mix(mix(shTap(b, c.z), shTap(b + vec2(tx.x, 0.0), c.z), f.x), mix(shTap(b + vec2(0.0, tx.y), c.z), shTap(b + tx, c.z), f.x), f.y);
}
void main(){
  vec2 wxz = vW.xz;
  float amp = 0.75 + 0.9*uWind;
  // ---- normal: ondas de vento + anéis do barco, dos postes, do sapo e da chuva (tudo com derivada exata)
  vec3 bw = fbmD4(vec2(wxz.x*0.7, wxz.y*4.5) + uOffA.xy);
  vec2 g = bw.yz*vec2(0.7, 4.5)*(0.07*amp);
  vec3 sw = nD(vec2(wxz.x*2.2, wxz.y*13.0) + uOffA.zw);
  g += sw.yz*vec2(2.2, 13.0)*(0.022*amp);
  vec2 bd = wxz - uBoat.xy; float bc = cos(uBoat.z), bs = sin(uBoat.z);
  vec2 bq = vec2(bc*bd.x - bs*bd.y, bs*bd.x + bc*bd.y);
  // distância até o barco, ondulada (a mesma para o relevo e para os pontinhos dos anéis)
  vec2 qs = bq*vec2(0.55, 1.0); float ql = max(length(qs), 1e-4);
  vec2 gq = qs/ql*vec2(0.55, 1.0);
  vec3 w1 = fbmD3(wxz*0.42 + uOffD.xy), w2 = fbmD2(wxz*0.16 + 3.0 + uOffD.zw);
  float rr = ql + (w1.x - 0.5)*1.1 + (w2.x - 0.5)*1.8;
  vec2 grr = vec2(bc*gq.x + bs*gq.y, -bs*gq.x + bc*gq.y) + w1.yz*0.462 + w2.yz*0.288;
  { vec2 pw = pulseD(rr, 5.0); g += pw.y*0.055*sstep(0.75, 1.5, rr)*grr; }
  float splashI = 0.0;
  if (uSplash.z > 0.0 && uSplash.z < 3.0) {
    vec2 dv = wxz - uSplash.xy; float dl = max(length(dv), 1e-4), kk = dl - uSplash.z*0.55;
    float e = uSplash.w*exp(-kk*kk*60.0)*(1.0 - uSplash.z/3.0);
    g += e*(30.0*cos(kk*30.0) - 120.0*kk*sin(kk*30.0))*0.03*(dv/dl); splashI = e;
  }
  if (uBeat > 0.002) g += uBeat*0.325*cos(rr*6.5 - uBeatPh)*exp(-0.28*rr)*sstep(0.75, 1.2, rr)*grr;
  vec2 dp1 = wxz - vec2(uPX - 0.98, -0.62), dp2 = wxz - vec2(uPX + 0.98, -0.62);
  float r1 = max(length(dp1), 1e-4), r2 = max(length(dp2), 1e-4);
  g += 0.18*cos(r1*9.0 - uRipPh.x)*exp(-1.2*r1)*sstep(0.14, 0.35, r1)*(dp1/r1);
  g += 0.18*cos(r2*9.0 - uRipPh.y)*exp(-1.2*r2)*sstep(0.14, 0.35, r2)*(dp2/r2);
  vec3 rn = vec3(0.0);
  if (uRain > 0.01) { rn = rainD(wxz); g += rn.yz*0.018; }
  vec3 nW = normalize(vec3(-g.x*1.4, 1.0, -g.y*1.4));
  // ---- cor de fundo chapada, com variação lenta e sombra das nuvens
  vec3 base = mix(uDeep, uLight, 0.2 + 0.14*fbm2(vec2(wxz.x*0.22, wxz.y*1.1) + uOffB.zw));
  float wcs = sstep(0.48, 0.78, fbm3(wxz*0.07 + uOffC.xy));
  base *= 1.0 - 0.28*wcs*(0.3 + 0.7*uCloud)*uDay*(1.0 - uRain);
  // ---- intensidade dos brilhos (vira pontinhos na etapa 2)
  float I = 0.0;
  float st = n1(vec2(wxz.x*0.35 + uOffC.z, wxz.y*28.0 + n1(wxz*0.5 + uOffC.ww)*4.0));
  I += sstep(0.72, 0.97, st)*0.26;                                         // riscos horizontais finos
  I += sstep(0.03, 0.14, dot(nW.xz, vec2(-0.4679, -0.8838)))*0.2;          // brilho leve nas ondinhas
  float fall = exp(-0.13*rr)*sstep(0.6, 1.2, rr);
  float pw = pulseD(rr, 3.6).x;
  float stat = sin(rr*3.6 + 1.3 + uBeat*1.2);
  I += (sstep(0.15, 0.95, pw)*1.1 + sstep(0.55, 0.98, stat)*0.3)*fall*(1.0 + 0.6*uBeat);
  base *= 1.0 - fall*(0.26*rstep(-0.2, -0.9, pw) + 0.07*rstep(-0.5, -0.95, stat));
  I += splashI*1.4;
  // peixes nadando por baixo (sombras; um deles é uma carpa laranja)
  float fishM = 0.0, koiM = 0.0;
  for (int i = 0; i < 3; i++) {
    vec4 f = uFish[i];
    if (f.w > 0.0) {
      vec2 d = wxz - f.xy; float ca = cos(f.z), sa = sin(f.z);
      vec2 q = vec2(ca*d.x + sa*d.y, -sa*d.x + ca*d.y)/f.w;
      if (abs(q.x) < 0.6 && abs(q.y) < 0.32) {
        q.y += sin(uTime*7.0 + q.x*9.0)*0.035*rstep(0.1, -0.3, q.x);
        float body = length(vec2(q.x/0.3, q.y/0.085)) - 1.0;
        float tail = max(abs(q.y) - (-q.x - 0.24)*0.9, max(q.x + 0.24, -q.x - 0.42));
        float fm = rstep(0.06, -0.2, min(body*0.3, tail));
        if (i == 1) koiM = max(koiM, fm); else fishM = max(fishM, fm);
      }
    }
  }
  base = mix(base, base*0.5, fishM*0.8*(0.35 + 0.65*uDay));
  base = mix(base, vec3(0.86, 0.43, 0.16)*mix(0.45, 1.0, uDay)*0.8 + base*0.2, koiM*0.6*(0.3 + 0.7*uDay));
  // faixa clara colada no casco
  {
    float qx = clamp(bq.x, -1.42, 1.6);
    float xb = max(qx, 0.0)/1.6, xs = max(-qx, 0.0)/1.6;
    float yb = -0.36 + 0.32*xb*xb + 0.08*xs*xs, yt = 0.30 + 0.17*xb*xb + 0.05*xs*xs;
    float a = acos(clamp(1.0 - (-uBoat.w - yb)/(yt - yb), -1.0, 1.0));
    float z0 = 0.64*(1.0 - 0.97*xb*xb)*(1.0 - 0.22*xs*xs)*pow(sin(a), 0.85);
    bool inX = bq.x > -1.42 && bq.x < 1.6;
    float dz = abs(bq.y) - z0, dx = max(max(-1.42 - bq.x, bq.x - 1.6), 0.0);
    float dHull = inX ? max(dz, 0.0) : length(vec2(dx, max(dz, 0.0)));
    I += (1.0 - sstep(0.0, 0.16, dHull))*0.85;
  }
  I += pow(max(sin(r1*7.0 - uRipPh.z), 0.0), 2.0)*0.6*exp(-0.9*r1)*sstep(0.14, 0.3, r1);
  I += pow(max(sin(r2*7.0 - uRipPh.w), 0.0), 2.0)*0.6*exp(-0.9*r2)*sstep(0.14, 0.3, r2);
  I += max(rn.x, 0.0)*0.8;
  I *= 1.0 - 0.7*max(fishM, koiM);
  // sombra: escurece o fundo e apaga os brilhos
  float wsh = waterShadow();
  base *= mix(0.62, 1.0, wsh);
  I *= mix(0.15, 1.0, wsh)*(0.55 + 0.45*uDay);
  // céu refletido (leve)
  vec3 wV = normalize(cameraPosition - vW);
  float wfres = 0.04 + 0.5*pow(1.0 - max(dot(nW, wV), 0.0), 4.0);
  vec3 wR = reflect(-wV, nW);
  vec3 wsky = mix(uLight*1.15, uHi, sstep(0.2, 0.9, wR.y));
  wsky = mix(wsky, vec3(0.55, 0.8, 1.0), 0.45*uDay*(1.0 - uCloudy));
  float skyK = wfres*0.45 + 0.05*uDay;
  vec3 wcol = mix(base, wsky, skyK);
  // reflexo dos objetos (escuro)
  vec4 ruv = vRefUv; ruv.xy += nW.xz*0.06*ruv.w;
  vec4 rc = texture2DProj(tReflect, ruv);
  wcol = mix(wcol, mix(base*0.55, rc.rgb*0.8, 0.35), rc.a*0.5);
  wcol += max(rc.rgb - vec3(0.5), 0.0)*rc.a*1.6;
  I *= (1.0 - skyK)*(1.0 - 0.5*rc.a);
  // brilho do sol/lua: coluna (depende só do ângulo de visão) × sombra, e o valor da reflexão antes do corte
  vec3 rG = reflect(-wV, normalize(vec3(nW.x*0.25, 1.0, nW.z*1.3)));
  float colm = sstep(0.955, 0.99, dot(reflect(-wV, vec3(0.0, 1.0, 0.0)), uGlintDir))*wsh;
  oCol = vec4(wcol, clamp(I, 0.0, 1.1));
  oNrm = vec4(nW.x*0.5 + 0.5, nW.z*0.5 + 0.5, max(dot(rG, uGlintDir), 0.0), colm);
}`;

// ---------- etapa 2: a água na cena (resolução cheia) ----------
const water = new THREE.Mesh(new THREE.PlaneGeometry(90, 90), new THREE.ShaderMaterial({
  uniforms: WU,
  vertexShader: `varying vec3 vWPos; void main(){ vec4 wp = modelMatrix*vec4(position, 1.0); vWPos = wp.xyz; gl_Position = projectionMatrix*viewMatrix*wp; }`,
  fragmentShader: `
uniform sampler2D tWD0, tWD1; uniform vec2 uRes; uniform vec4 uBoat;
uniform vec3 uDotCol, uGlintDir, uGlintCol, uLamp, uLamp2, uHi, uFloor;
uniform float uGlint, uLampOn, uLamp2On, uDay, uTime, uMeteorT, uFwOn;
uniform vec4 uMeteor; uniform vec4 uFw[3];
varying vec3 vWPos;
${GLSL_NOISE}
void main(){
  vec2 wxz = vWPos.xz;
  // dentro do barco não tem água
  vec2 bd = wxz - uBoat.xy; float bc = cos(uBoat.z), bs = sin(uBoat.z);
  vec2 bq = vec2(bc*bd.x - bs*bd.y, bs*bd.x + bc*bd.y);
  if (bq.x > -1.42 && bq.x < 1.6 && abs(bq.y) < 0.66) {
    float xb = max(bq.x, 0.0)/1.6, xs = max(-bq.x, 0.0)/1.6;
    float yb = -0.36 + 0.32*xb*xb + 0.08*xs*xs, yt = 0.30 + 0.17*xb*xb + 0.05*xs*xs, yl = -uBoat.w;
    float a = acos(clamp(1.0 - (yl - yb)/(yt - yb), -1.0, 1.0));
    float z0 = 0.64*(1.0 - 0.97*xb*xb)*(1.0 - 0.22*xs*xs)*pow(sin(a), 0.85);
    if (yl > yb && abs(bq.y) < z0 - 0.004) discard;
  }
  vec2 suv = gl_FragCoord.xy/uRes;
  vec4 d0 = texture2D(tWD0, suv), d1 = texture2D(tWD1, suv);
  float th = bayer4(gl_FragCoord.xy);
  vec3 col = mix(d0.rgb, uDotCol, step(th + 0.02, d0.a));                 // pontinhos de meio-tom
  // coluna de brilho do sol/lua: tracinhos horizontais (o corte é feito aqui, na resolução cheia)
  col = mix(col, uGlintCol, clamp(d1.w*sstep(0.972, 0.99, d1.z)*uGlint, 0.0, 1.0));
  vec3 nW = vec3(0.0, 1.0, 0.0), rG = nW;
  if (uLampOn > 0.003 || uMeteorT >= 0.0 || uFwOn > 0.5) {
    vec2 nxz = d1.xy*2.0 - 1.0;
    nW = normalize(vec3(nxz.x, sqrt(max(1.0 - dot(nxz, nxz), 0.0)), nxz.y));
    rG = reflect(-normalize(cameraPosition - vWPos), normalize(vec3(nW.x*0.25, 1.0, nW.z*1.3)));
  }
  // luz das lanternas na água: segue as ondinhas (as faces viradas para a luz acendem), borda ondulada e caminho de brilhos
  if (uLampOn > 0.003) {
    vec3 lv = uLamp - vWPos; float ld = length(lv); vec3 L = lv/ld;
    vec3 lw = vec3(lv.x + nW.x*2.2, lv.y, lv.z + nW.z*2.2); float ldw = length(lw);
    float wv = clamp(0.3 + 8.0*dot(nW.xz, normalize(lv.xz + 1e-4)), 0.0, 1.8);
    col += vec3(1.0, 0.62, 0.3)*uLampOn*(0.14 + 0.42*wv)/(1.0 + ldw*ldw*0.7);
    col = mix(col, vec3(1.0, 0.74, 0.44), step(th + 0.04, uLampOn*exp(-ldw*0.7)*wv*0.95)*0.75);
    float rl = max(dot(rG, L), 0.0);
    col = mix(col, vec3(1.0, 0.86, 0.56), clamp(sstep(0.975, 0.99, rl) + pow(rl, 70.0)*0.7, 0.0, 1.0)*uLampOn);
  }
  // lamparina do barco (perto da água: luz mais curta)
  if (uLamp2On > 0.003) {
    vec3 lv = uLamp2 - vWPos; float ld = length(lv); vec3 L = lv/ld;
    float ldw = length(vec3(lv.x + nW.x*1.2, lv.y, lv.z + nW.z*1.2));
    float wv = clamp(0.3 + 8.0*dot(nW.xz, normalize(lv.xz + 1e-4)), 0.0, 1.8);
    col += vec3(1.0, 0.66, 0.32)*uLamp2On*(0.12 + 0.4*wv)/(1.0 + ldw*ldw*1.6);
    col = mix(col, vec3(1.0, 0.76, 0.46), step(th + 0.04, uLamp2On*exp(-ldw*1.2)*wv*0.95)*0.72);
    float rl = max(dot(rG, L), 0.0);
    col = mix(col, vec3(1.0, 0.88, 0.6), clamp(sstep(0.975, 0.99, rl) + pow(rl, 70.0)*0.6, 0.0, 1.0)*uLamp2On);
  }
  // estrela cadente refletida
  if (uMeteorT >= 0.0) {
    vec2 ma = uMeteor.xy, mb = uMeteor.zw;
    vec2 mh = mix(ma, mb, uMeteorT), mt = mix(ma, mb, max(0.0, uMeteorT - 0.35));
    vec2 pa = wxz + nW.xz*0.05 - mt, ba = mh - mt;
    float hh = clamp(dot(pa, ba)/max(dot(ba, ba), 1e-4), 0.0, 1.0);
    float dd = length(pa - ba*hh);
    col += vec3(0.85, 0.92, 1.0)*rstep(0.04, 0.0, dd)*hh*(1.0 - sstep(0.85, 1.0, uMeteorT))*1.3;
  }
  // fogos de ano novo refletidos
  if (uFwOn > 0.5) {
    for (int i = 0; i < 3; i++) {
      vec4 fw = uFw[i]; float age = fw.z;
      if (age > 0.0 && age < 2.6) {
        vec2 d = wxz + nW.xz*0.08 - fw.xy; float r = length(d), R = age*0.75*(1.0 - 0.25*age/2.6);
        float spk = step(0.5, w_hash(vec2(floor(atan(d.y, d.x)*11.0), fw.w*31.0)));
        float rv = exp(-pow((r - R)/0.07, 2.0))*(0.45 + 0.55*spk), core = exp(-r*r*40.0)*exp(-age*4.0), fade = 1.0 - age/2.6;
        vec3 fc = 0.5 + 0.5*cos(6.2831*(fw.w + vec3(0.0, 0.33, 0.67)));
        col += fc*step(th*0.8 + 0.04, (rv*fade + core)*1.3)*(0.6 + 0.6*fade);
      }
    }
  }
  // estrelinhas refletidas à noite
  if (uDay < 0.995) col += uHi*step(0.9986, w_hash(floor(gl_FragCoord.xy) + floor(uTime*2.5)*vec2(7.0, 13.0)))*0.7*(1.0 - uDay);
  // a água era levemente transparente sobre o fundo escuro: mantém o mesmo tom
  gl_FragColor = vec4(col*0.88 + uFloor*0.12, 1.0);
}`,
}));
water.rotation.x = -Math.PI / 2; water.renderOrder = 1; scene.add(water);
// cena só com o plano da água, para a etapa 1
const wdScene = new THREE.Scene();
const wdMesh = new THREE.Mesh(water.geometry, new THREE.ShaderMaterial({ glslVersion: THREE.GLSL3, uniforms: WU, vertexShader: WD_VS, fragmentShader: WD_FS, depthTest: false, depthWrite: false }));
wdMesh.rotation.x = -Math.PI / 2; wdMesh.frustumCulled = false; wdScene.add(wdMesh);

// ====================== renderer + passes ======================
const wrap = document.getElementById("wrap");
if (PREVIEW) document.body.classList.add("preview");
const host = document.createElement("div"); host.className = "screen"; wrap.appendChild(host);
const canvas = document.createElement("canvas"); host.appendChild(canvas);
// ====================== painel do canto ======================
const DIAS = ["dom", "seg", "ter", "qua", "qui", "sex", "sáb"];
const MESES = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];
const WMO = { 0: "céu limpo", 1: "quase limpo", 2: "parcialmente nublado", 3: "nublado", 45: "neblina", 48: "neblina",
  51: "garoa fraca", 53: "garoa", 55: "garoa forte", 56: "garoa gelada", 57: "garoa gelada", 61: "chuva fraca", 63: "chuva",
  65: "chuva forte", 66: "chuva gelada", 67: "chuva gelada", 71: "neve", 73: "neve", 75: "neve", 77: "neve",
  80: "pancadas fracas", 81: "pancadas de chuva", 82: "pancadas fortes", 95: "trovoadas", 96: "trovoadas com granizo", 99: "trovoadas com granizo" };
const esc = v => String(v == null ? "" : v).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const pad2 = n => String(n).padStart(2, "0");
const hm = d => pad2(d.getHours()) + ":" + pad2(d.getMinutes());
const dayStart = d => new Date(d.getFullYear(), d.getMonth(), d.getDate());
const dayDiff = (a, b) => Math.round((dayStart(a) - dayStart(b)) / 86400000);
const truthy = v => v === true || v === 1 || /^(sim|yes|true|1|verdadeiro)$/i.test(String(v == null ? "" : v).trim());
const parseDate = v => { if (!v) return null; const d = new Date(v); return isNaN(d) ? null : d; };
const PROVA = /\b(prova|p1|p2|p3|avalia[cç][aã]o|exame|apresenta[cç][aã]o|semin[aá]rio|entrega)\b/i;
const LISTAS = { faculdade: "#f2c86a", afazeres: "#7fd6c2", lembretes: "#f2a0b8" };

const PANEL = (() => {
  const el = document.createElement("div"); el.className = "painel"; el.hidden = true;
  el.innerHTML = `<div class="p-relogio"><div class="p-hora"></div><div class="p-data"></div></div>
    <div class="p-clima"></div>
    <div class="p-prova"></div>
    <div class="p-sec p-agenda"><div class="p-h">agenda</div><ul></ul></div>
    <div class="p-sec p-lemb"><div class="p-h">lembretes</div><div class="p-grupos"></div></div>
    <div class="p-musica"><canvas class="p-capa" width="24" height="24"></canvas><div class="p-mtxt"><div class="p-mtit"></div><div class="p-mart"></div></div></div>
    <div class="p-rodape"></div>`;
  host.appendChild(el);
  const q = s => el.querySelector(s);
  let data = null, track = null, wx = null, err = false, demo = false;
  try { data = JSON.parse(localStorage.getItem("lago.painel") || "null"); } catch (e) {}

  function place() {
    const dual = screens().length > 1, c = S.cantoPainel | 0, mx = "4.5cqh", my = "5.5cqh";
    el.style.left = el.style.right = el.style.top = el.style.bottom = "";
    if (c === 0 || c === 2) el.style.left = dual ? `calc(50% + ${mx})` : mx; else el.style.right = mx;
    if (c === 0 || c === 1) el.style.top = my; else el.style.bottom = my;
  }
  function whenLabel(d, now, allDay) {
    const dd = dayDiff(d, now), dateOnly = allDay || (d.getHours() === 0 && d.getMinutes() === 0);
    if (dd === 0) return dateOnly ? "hoje" : hm(d);
    if (dd === 1) return "amanhã";
    if (dd > 1 && dd < 7) return DIAS[d.getDay()];
    return `${pad2(d.getDate())}/${pad2(d.getMonth() + 1)}`;
  }
  function render() {
    el.hidden = !S.painel;
    if (!S.painel) return;
    const now = new Date();
    q(".p-relogio").hidden = !S.mostrarRelogio;
    q(".p-hora").textContent = hm(now);
    q(".p-data").textContent = `${DIAS[now.getDay()]}, ${now.getDate()} ${MESES[now.getMonth()]}`;

    const cl = q(".p-clima");
    cl.hidden = !(S.mostrarClima && wx && wx.temp != null);
    if (!cl.hidden) cl.innerHTML = `<b>${Math.round(wx.temp)}°</b> ${esc(wx.desc)}` +
      (wx.max != null ? `<span> · ${Math.round(wx.max)}° / ${Math.round(wx.min)}°</span>` : "");

    const useData = (S.gistId || demo) && data;
    // agenda
    const evs = (useData && Array.isArray(data.eventos) ? data.eventos : []).map(e => ({
      t: e.titulo != null ? e.titulo : e.title, ini: parseDate(e.inicio || e.start), fim: parseDate(e.fim || e.end), dia: truthy(e.diaInteiro != null ? e.diaInteiro : e.allDay) }))
      .filter(e => e.t && e.ini && (e.fim ? e.fim > now : e.ini > now - 3600e3)).sort((a, b) => a.ini - b.ini);
    const ag = q(".p-agenda"); ag.hidden = !evs.length;
    const hh = d => d.getMinutes() ? `${d.getHours()}h${pad2(d.getMinutes())}` : `${d.getHours()}h`;
    ag.querySelector("ul").innerHTML = evs.slice(0, 4).map(e => {
      const dd = dayDiff(e.ini, now);
      let when = whenLabel(e.ini, now, e.dia);
      if (dd <= 0 && !e.dia) when = hh(e.ini); else if (dd >= 1 && !e.dia) when += " " + hh(e.ini);
      return `<li class="${PROVA.test(e.t) ? "prova" : ""}"><span class="p-q">${when}</span><span class="p-t">${esc(e.t)}</span></li>`;
    }).join("");
    // destaque: próxima prova
    const pv = evs.find(e => PROVA.test(e.t) && dayDiff(e.ini, now) <= 30);
    const pe = q(".p-prova");
    if (pv) { const dd = dayDiff(pv.ini, now);
      pe.textContent = dd <= 0 ? `hoje: ${pv.t}` : dd === 1 ? `amanhã: ${pv.t}` : `faltam ${dd} dias: ${pv.t}`; }
    else pe.textContent = "";
    // lembretes por lista
    const lemb = (useData && Array.isArray(data.lembretes) ? data.lembretes : []).map(r => ({
      t: r.titulo != null ? r.titulo : r.title, l: String(r.lista || r.list || "Lembretes"), d: parseDate(r.vence || r.due) })).filter(r => r.t);
    const order = ["faculdade", "afazeres", "lembretes"];
    const groups = {};
    for (const r of lemb) (groups[r.l] = groups[r.l] || []).push(r);
    const names = Object.keys(groups).sort((a, b) => {
      const ia = order.indexOf(a.toLowerCase()), ib = order.indexOf(b.toLowerCase());
      return (ia < 0 ? 9 : ia) - (ib < 0 ? 9 : ib); });
    let shown = 0;
    const html = names.map(n => {
      const items = groups[n].sort((a, b) => (a.d ? a.d.getTime() : 9e15) - (b.d ? b.d.getTime() : 9e15));
      const take = items.slice(0, Math.max(0, Math.min(3, 8 - shown))); shown += take.length;
      if (!take.length) return "";
      const more = items.length - take.length;
      const col = LISTAS[n.toLowerCase()] || "#cfd6e0";
      return `<div class="p-g"><div class="p-gl"><span class="p-dot" style="background:${col}"></span>${esc(n)}</div><ul>` +
        take.map(r => { const late = r.d && r.d < now && !(dayDiff(r.d, now) === 0 && r.d.getHours() === 0 && r.d.getMinutes() === 0);
          return `<li class="${late ? "atrasado" : ""}"><span class="p-t">${esc(r.t)}</span><span class="p-q2">${r.d ? (late ? "atrasado" : whenLabel(r.d, now, false)) : ""}</span></li>`; }).join("") +
        (more > 0 ? `<li class="p-mais"><span class="p-t">+${more}</span></li>` : "") + `</ul></div>`;
    }).join("");
    const lm = q(".p-lemb"); lm.hidden = !html; q(".p-grupos").innerHTML = html;

    const mu = q(".p-musica"), showM = S.mostrarMusica && track && track.title;
    mu.hidden = !showM;
    if (showM) { q(".p-mtit").textContent = track.title; q(".p-mart").textContent = track.artist || ""; }

    const rod = q(".p-rodape");
    if (demo) rod.textContent = "dados de exemplo";
    else if (S.gistId && data && data.atualizado) {
      const u = parseDate(data.atualizado);
      rod.textContent = u ? `atualizado ${dayDiff(now, u) === 0 ? "às " + hm(u) : DIAS[u.getDay()] + " " + hm(u)}${err ? " · sem conexão" : ""}` : "";
    } else rod.textContent = S.gistId && err ? "não consegui ler os lembretes" : "";
  }
  function setThumb(src) {
    const cv = q(".p-capa"), g = cv.getContext("2d");
    if (!src) { cv.hidden = true; return; }
    const img = new Image();
    img.onload = () => {
      g.clearRect(0, 0, 24, 24); g.drawImage(img, 0, 0, 24, 24);
      const id = g.getImageData(0, 0, 24, 24), a = id.data, B = [[0, 8, 2, 10], [12, 4, 14, 6], [3, 11, 1, 9], [15, 7, 13, 5]];
      for (let y = 0; y < 24; y++) for (let x = 0; x < 24; x++) {
        const i = (y * 24 + x) * 4, th = (B[y % 4][x % 4] + 0.5) / 16;
        for (let c = 0; c < 3; c++) a[i + c] = Math.min(255, Math.floor(a[i + c] / 255 * 4 + th) / 4 * 255);
      }
      g.putImageData(id, 0, 0); cv.hidden = false;
    };
    img.onerror = () => { cv.hidden = true; };
    img.src = /^data:/.test(src) ? src : "data:image/png;base64," + src;
  }
  return {
    place, render,
    setData(d, isDemo) { data = d; err = false; demo = !!isDemo; if (!isDemo) { try { localStorage.setItem("lago.painel", JSON.stringify(d)); } catch (e) {} } render(); },
    setErr(v) { err = v; render(); },
    setTrack(t) { track = t; setThumb(t && t.thumb); render(); },
    setWeather(w) { wx = w; render(); },
  };
})();

const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: "high-performance" });
renderer.outputColorSpace = THREE.LinearSRGBColorSpace;
renderer.useLegacyLights = true;
renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap; renderer.shadowMap.autoUpdate = false;
renderer.setPixelRatio(1);
renderer.autoClear = true;

const camera = new THREE.PerspectiveCamera(22.6, 16 / 9, 0.5, 140);
camera.position.set(0, 8.5, 7); camera.lookAt(0, 0, -1);
const reflCam = new THREE.PerspectiveCamera();
const rtOpts = { minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter };
const reflRT = new THREE.WebGLRenderTarget(4, 4, rtOpts);
const sceneRT = new THREE.WebGLRenderTarget(4, 4, { minFilter: THREE.NearestFilter, magFilter: THREE.NearestFilter });
WU.tReflect.value = reflRT.texture;
const clipPlane = new THREE.Plane(new V3(0, 1, 0), 0.0);
// etapa 1 da água: meia resolução, dois alvos; meio-float quando a placa permite (quase todas)
const FLOAT_RT = renderer.capabilities.isWebGL2 && renderer.extensions.has("EXT_color_buffer_float") && params.get("rt8") !== "1";
const wdRT = new THREE.WebGLMultipleRenderTargets(4, 4, 2, { type: FLOAT_RT ? THREE.HalfFloatType : THREE.UnsignedByteType,
  minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter, depthBuffer: false });
WU.tWD0.value = wdRT.texture[0]; WU.tWD1.value = wdRT.texture[1];
const texWhite = new THREE.DataTexture(new Uint8Array([255, 255, 255, 255]), 1, 1); texWhite.needsUpdate = true;
WU.tShadow.value = texWhite;
// camada 1: coisas que não aparecem no reflexo (ficam em cima do píer ou são pequenas demais) — poupa a placa
const L_NOREFL = 1; camera.layers.enable(L_NOREFL);
[DOG, CHAIR, BALL, BOWL, FROG, ...INSECTS.map(i => i.g), ...pads.map(p => p.g), ...leaves.map(l => l.g)]
  .forEach(o => o.traverse(c => c.layers.set(L_NOREFL)));

const postMat = new THREE.ShaderMaterial({
  uniforms: { tScene: { value: sceneRT.texture }, tNoise: { value: texNoise }, uMistOff: { value: 0 }, uLeakOff: { value: 0 }, uRain: { value: 0 }, uCloud: { value: 0 }, uFlash: { value: 0 }, uMist: { value: 0 },
    uDay: { value: 1 }, uTime: { value: 0 }, uHi: { value: new V3(1, 1, 1) }, uX0: { value: 0 }, uXN: { value: 1 },
    uSunX: { value: 1 }, uLeak: { value: 0 }, uLeakCol: { value: new V3(1.0, 0.86, 0.55) },
    uGlowP: { value: [new V3(), new V3(), new V3(), new V3()] }, uGlowC: { value: [new V3(1, 0.7, 0.4), new V3(1, 0.7, 0.4), new V3(1, 0.55, 0.2), new V3(1, 0.8, 0.5)] }, uAspect: { value: 1.78 } },
  vertexShader: "varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }",
  fragmentShader: `
    uniform sampler2D tScene, tNoise; uniform float uRain, uCloud, uFlash, uMist, uDay, uTime, uX0, uXN, uSunX, uLeak, uAspect, uMistOff, uLeakOff; uniform vec3 uHi, uLeakCol; uniform vec3 uGlowP[4]; uniform vec3 uGlowC[4]; varying vec2 vUv;
    float noise(vec2 p){ vec2 i = floor(p), f = p - i; vec4 c = texture2D(tNoise, (i + 0.5)*(1.0/256.0)); vec2 u = f*f*(3.0 - 2.0*f);
      return mix(mix(c.x, c.y, u.x), mix(c.z, c.w, u.x), u.y); }
    float fbm(vec2 p){ float v = 0.5*noise(p); p = p*2.0 + vec2(17.1, 9.2); v += 0.25*noise(p); p = p*2.0 + vec2(17.1, 9.2); return v + 0.125*noise(p) + 0.03125; }
    float bayer2(vec2 a){ a = floor(a); return fract(a.x/2.0 + a.y*a.y*0.75); }
    float bayer4(vec2 a){ return bayer2(0.5*a)*0.25 + bayer2(a); }
    float bayer8(vec2 a){ return bayer4(0.5*a)*0.25 + bayer2(a); }
    void main(){
      vec3 col = texture2D(tScene, vUv).rgb;
      float gx = uX0 + vUv.x*uXN;
      // vazamento de luz do sol entrando pelo topo, com risquinhos finos
      if (uLeak > 0.01) {
        vec2 dp = vec2((gx - uSunX)*0.8, vUv.y - 1.18);
        float leak = exp(-dot(dp, dp)*2.4);
        float scr = smoothstep(0.8, 1.0, noise(vec2((gx*1.1 + vUv.y*0.55)*140.0, uLeakOff)));
        col += uLeakCol*leak*uLeak*(0.55 + 0.6*scr);
      }
      if (uMist > 0.01) { float m = 0.6 + 0.4*fbm(vec2(gx*3.0 + uMistOff, vUv.y*5.0));
        col = mix(col, mix(uHi, vec3(1.0), 0.3)*0.85, uMist*0.3*m); }
      float gray = dot(col, vec3(0.33));
      col = mix(col, vec3(gray)*vec3(0.85, 0.92, 1.0), 0.4*uRain);
      col *= 1.0 - 0.12*uCloud - 0.2*uRain;
      col += vec3(0.75, 0.8, 0.95)*uFlash*0.5;
      // brilho suave em volta das luzes
      for (int i = 0; i < 4; i++) { vec3 gp = uGlowP[i];
        if (gp.z > 0.001) { vec2 d = (vUv - gp.xy)*vec2(uAspect, 1.0); float r2 = dot(d, d);
          col += uGlowC[i]*gp.z*(exp(-r2*1400.0)*0.55 + exp(-r2*120.0)*0.16); } }
      float lum = dot(col, vec3(0.299, 0.587, 0.114));
      col = mix(vec3(lum), col, 1.0 + 0.2*uDay*(1.0 - uRain));
      col *= 1.0 - 0.25*pow(abs(vUv.y - 0.5)*2.0, 2.0);
      // pontilhado feito em escala perceptual: nos tons escuros os degraus ficam bem menores
      // (antes, à noite, sobrava uma grade de pontinhos laranja/azuis visível no monitor)
      float L = 12.0;
      col = sqrt(clamp(col, 0.0, 1.0));
      col = floor(col*L + bayer8(gl_FragCoord.xy))/L;
      col *= col;
      gl_FragColor = vec4(col, 1.0);
    }`,
  depthTest: false, depthWrite: false,
});
if (new URLSearchParams(location.search).get('dbg') === 'refl') postMat.uniforms.tScene.value = reflRT.texture;
const postScene = new THREE.Scene();
postScene.add(new THREE.Mesh(new THREE.PlaneGeometry(2, 2), postMat));
const postCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);

let autoScale = 1;   // aumenta sozinho se a placa de vídeo não der conta
function resize() {
  const scr = screens(); host.classList.toggle("dual", scr.length > 1);
  const r = host.getBoundingClientRect(), dpr = Math.min(window.devicePixelRatio || 1, 2), px = (PXS[S.pixel] || 1) * autoScale;
  const w = Math.max(2, Math.round(r.width * dpr / px)), h = Math.max(2, Math.round(r.height * dpr / px));
  renderer.setSize(w, h, false);
  reflRT.setSize(Math.max(2, w >> 1), Math.max(2, h >> 1)); sceneRT.setSize(w, h);
  wdRT.setSize(Math.max(2, Math.ceil(w / 2)), Math.max(2, Math.ceil(h / 2))); WU.uRes.value.set(w, h);
  const n = scr.length, sw = w / n;
  // câmeras de teste (?cam=perto|gaivota|sapo|cadeira|lado)
  const CAMS = { perto: [PX - 0.22, 0.8, -0.8, 0.75, -0.39, 0.68, 0.68], cara: [PX - 0.22, 0.88, -0.8, 0.55, -0.75, 0.4, 0.66], gaivota: [PX + 0.98, 1.08, PZ0, 0.9, -0.5, 0.45, 1.0],
    sapo: [6.42, 0.07, 0.07, 0.75, -0.59, 0.98, 1.02], cadeira: [PX + 0.3, 1.1, -1.5, 1.1, -0.6, 0.7, 1.0], lado: [PX - 0.22, 0.8, -0.8, 1.0, 1.0, 0.35, 0.3] };
  const cm = CAMS[params.get("cam")];
  if (cm) {
    camera.clearViewOffset(); camera.fov = 30; camera.aspect = w / h;
    const dv = new V3(cm[4], cm[5], cm[6]).normalize().multiplyScalar(cm[3] * 1.6);
    camera.position.set(cm[0] + dv.x, cm[1] + dv.y, cm[2] + dv.z); camera.lookAt(cm[0], cm[1], cm[2]);
  } else camera.setViewOffset(2 * sw, h, scr[0] * sw, 0, w, h);
  camera.updateProjectionMatrix();
  postMat.uniforms.uX0.value = scr[0]; postMat.uniforms.uXN.value = n;
  const ms = n > 1 ? [2048, 1024] : [1280, 1280];
  if (sun.shadow.mapSize.x !== ms[0] || sun.shadow.mapSize.y !== ms[1]) {
    sun.shadow.mapSize.set(ms[0], ms[1]); if (sun.shadow.map) { sun.shadow.map.dispose(); sun.shadow.map = null; }
  }
  shDir.set(0, 0, 0);   // refaz o quadro da sombra no próximo quadro
  PANEL.place();
}
// o mapa de sombras cobre só o chão visível nesta tela (+ folga): menos pixels e sombra mais nítida
const _shc = new THREE.OrthographicCamera(), shDir = new V3(0, 0, 0);
function fitShadow(dir) {
  camera.updateMatrixWorld();
  const g = [], c = new V3(), cp = camera.position;
  for (const [nx, ny] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
    const d = new V3(nx, ny, 0.5).unproject(camera).sub(cp).normalize();
    const q = cp.clone().addScaledVector(d, d.y < -0.02 ? Math.min(-cp.y / d.y, 45) : 45); q.y = 0; g.push(q); c.add(q);
  }
  c.multiplyScalar(0.25);
  sun.target.position.copy(c); sun.target.updateMatrixWorld();
  _shc.position.copy(c).addScaledVector(dir, 30); _shc.lookAt(c); _shc.updateMatrixWorld();
  let x0 = 1e9, x1 = -1e9, y0 = 1e9, y1 = -1e9, z0 = 1e9, z1 = -1e9;
  for (const q of g) for (const hy of [-0.4, 2.4]) {
    const v = new V3(q.x, hy, q.z).applyMatrix4(_shc.matrixWorldInverse);
    x0 = Math.min(x0, v.x); x1 = Math.max(x1, v.x); y0 = Math.min(y0, v.y); y1 = Math.max(y1, v.y); z0 = Math.min(z0, v.z); z1 = Math.max(z1, v.z);
  }
  const sc = sun.shadow.camera, m = 0.9;
  sc.left = x0 - m; sc.right = x1 + m; sc.bottom = y0 - m; sc.top = y1 + m; sc.near = Math.max(0.5, -z1 - 4); sc.far = -z0 + 4;
  sc.updateProjectionMatrix();
  sun.shadow.bias = -0.042 / (sc.far - sc.near); WU.uShadowBias.value = sun.shadow.bias;
  shDir.copy(dir);
}
window.addEventListener("resize", resize); resize();

function renderReflection() {
  scene.updateMatrixWorld(); camera.updateMatrixWorld();
  const normal = new V3(0, 1, 0), mp = new V3(0, 0, 0), camPos = camera.position.clone();
  const view = mp.clone().sub(camPos).reflect(normal).negate().add(mp);
  const rotM = new THREE.Matrix4().extractRotation(camera.matrixWorld);
  const lookAt = new V3(0, 0, -1).applyMatrix4(rotM).add(camPos);
  const target = mp.clone().sub(lookAt).reflect(normal).negate().add(mp);
  reflCam.position.copy(view); reflCam.up.set(0, 1, 0).applyMatrix4(rotM).reflect(normal);
  reflCam.lookAt(target); reflCam.updateMatrixWorld();
  // a imagem do espelho é invertida na horizontal: a metade da direita usa a metade da esquerda da câmera refletida
  reflCam.fov = camera.fov; reflCam.near = camera.near; reflCam.far = camera.far; reflCam.aspect = camera.aspect;
  const v = camera.view;
  if (v && v.enabled) reflCam.setViewOffset(v.fullWidth, v.fullHeight, v.fullWidth - v.offsetX - v.width, v.offsetY, v.width, v.height);
  reflCam.updateProjectionMatrix();
  const tm = WU.uTexMat.value;
  tm.set(0.5, 0, 0, 0.5, 0, 0.5, 0, 0.5, 0, 0, 0.5, 0.5, 0, 0, 0, 1);
  tm.multiply(reflCam.projectionMatrix); tm.multiply(reflCam.matrixWorldInverse); tm.multiply(water.matrixWorld);
  water.visible = false; const ffv = fireflies.visible; fireflies.visible = false;
  const fv = flock.map(g => g.visible); flock.forEach(g => g.visible = false);
  renderer.clippingPlanes = [clipPlane];
  renderer.setRenderTarget(reflRT); renderer.setClearColor(0x000000, 0); renderer.clear();
  renderer.render(scene, reflCam);
  renderer.clippingPlanes = [];
  water.visible = true; fireflies.visible = ffv;
  flock.forEach((g, i) => g.visible = fv[i]);
}

// ====================== tempo, paleta, clima ======================
const KEYS = [
  [0.0,  [0.012,0.025,0.065], [0.045,0.08,0.165], [0.40,0.50,0.72], 0.0],
  [4.6,  [0.02,0.03,0.08], [0.06,0.09,0.19], [0.44,0.48,0.72], 0.0],
  [5.9,  [0.11,0.08,0.17], [0.40,0.25,0.34], [1.00,0.68,0.55], 0.35],
  [7.3,  [0.04,0.24,0.28], [0.22,0.52,0.52], [1.00,0.90,0.72], 0.8],
  [10.0, [0.03,0.27,0.28], [0.13,0.56,0.52], [1.00,0.97,0.84], 1.0],
  [13.0, [0.03,0.28,0.28], [0.12,0.58,0.53], [1.00,0.98,0.86], 1.0],
  [15.8, [0.05,0.26,0.24], [0.18,0.54,0.45], [1.00,0.94,0.76], 0.95],
  [16.6, [0.07,0.22,0.19], [0.30,0.48,0.36], [1.00,0.88,0.60], 0.88],
  [17.0, [0.06,0.16,0.14], [0.30,0.40,0.28], [1.00,0.86,0.56], 0.82],
  [17.8, [0.17,0.11,0.04], [0.52,0.37,0.15], [1.00,0.80,0.46], 0.68],
  [18.9, [0.07,0.05,0.12], [0.26,0.16,0.24], [0.92,0.56,0.46], 0.25],
  [20.2, [0.015,0.03,0.075], [0.05,0.09,0.18], [0.42,0.52,0.74], 0.0],
  [24.0, [0.012,0.025,0.065], [0.045,0.08,0.165], [0.40,0.50,0.72], 0.0],
];
const SUN = { rise: 5.5, set: 17.9 }, SUN_T = { rise: 5.5, set: 17.9 };
function solarHour(h) { const r = SUN.rise, s = SUN.set;
  if (h < r) return h / r * 6; if (h < s) return 6 + (h - r) / (s - r) * 12; return 18 + (h - s) / (24 - s) * 6; }
function moonIllum(d) { const syn = 29.530588853, ref = Date.UTC(2000, 0, 6, 18, 14);
  const ph = ((((d.getTime() - ref) / 86400000) / syn) % 1 + 1) % 1; return (1 - Math.cos(2 * Math.PI * ph)) / 2; }
function palette(realH) {
  const h = solarHour(realH);
  let i = 0; while (i < KEYS.length - 2 && h >= KEYS[i + 1][0]) i++;
  const A = KEYS[i], B = KEYS[i + 1], k = smooth(clamp01((h - A[0]) / (B[0] - A[0])));
  const sunUp = Math.max(0, Math.sin(Math.PI * (h - 6) / 12));
  const golden = Math.exp(-Math.pow((h - 6.6) / 1.0, 2)) + Math.exp(-Math.pow((h - 17.8) / 1.0, 2));
  const moonUp = h >= 18 || h < 6 ? Math.max(0, Math.sin(Math.PI * ((h - 18 + 24) % 24) / 12)) : 0;
  return { deep: mix3(A[1], B[1], k), light: mix3(A[2], B[2], k), hi: mix3(A[3], B[3], k), day: lerp(A[4], B[4], k),
    sunX: (h - 6) / 12 * 2, sunI: sunUp > 0 ? Math.min(1, 0.3 + 0.7 * golden) * Math.min(1, sunUp * 4) : 0,
    moonX: ((h + 6) % 24) / 12 * 2, moonI: moonUp > 0 ? 0.7 * (0.2 + 0.8 * moonIllum(new Date())) * Math.min(1, moonUp * 4) : 0,
    mist: Math.exp(-Math.pow((h - 6.3) / 0.75, 2)) };
}
let live = !params.has("h"), lapse = false, manualH = parseFloat(params.get("h") || "12");
const $ = id => document.getElementById(id);
const fmt = h => { const hh = Math.floor(h) % 24, mm = Math.floor((h % 1) * 60); return String(hh).padStart(2, "0") + ":" + String(mm).padStart(2, "0"); };
const nowH = () => { const d = new Date(); return d.getHours() + d.getMinutes() / 60 + d.getSeconds() / 3600; };
const weather = { rain: 0, cloud: 0.2, storm: false, wind: 0.25 };
const W = { rain: 0, cloud: 0.2, flash: 0, wind: 0.25, fog: 0 };
let forceRain = params.get("chuva") === "1", forceStorm = false;
if (PREVIEW) {
  const setBtns = () => { $("live").classList.toggle("on", live); $("lapse").classList.toggle("on", lapse); };
  $("scrub").addEventListener("input", () => { live = false; lapse = false; manualH = parseFloat($("scrub").value); setBtns(); });
  $("live").addEventListener("click", () => { live = true; lapse = false; setBtns(); });
  $("lapse").addEventListener("click", () => { lapse = !lapse; if (lapse) live = false; setBtns(); });
  $("rainBtn").addEventListener("click", () => { forceRain = !forceRain; if (!forceRain) forceStorm = false; $("rainBtn").classList.toggle("on", forceRain); $("stormBtn").classList.toggle("on", forceStorm); });
  $("stormBtn").addEventListener("click", () => { forceStorm = !forceStorm; if (forceStorm) forceRain = true; $("stormBtn").classList.toggle("on", forceStorm); $("rainBtn").classList.toggle("on", forceRain); });
  setBtns();
}
const toH = iso => { const m = /T(\d\d):(\d\d)/.exec(iso || ""); return m ? +m[1] + +m[2] / 60 : null; };
async function updateWeather() {
  try {
    const url = `https://api.open-meteo.com/v1/forecast?latitude=-20.33&longitude=-40.29` +
      `&current=temperature_2m,precipitation,weather_code,cloud_cover,wind_speed_10m&daily=sunrise,sunset,temperature_2m_max,temperature_2m_min&forecast_days=1&timezone=auto`;
    const j = await (await fetch(url)).json();
    const c = j.current, code = c.weather_code, mm = c.precipitation || 0;
    const rainy = (code >= 51 && code <= 67) || (code >= 80 && code <= 82) || code >= 95;
    weather.rain = rainy || mm > 0 ? Math.min(1, Math.max(code >= 61 ? 0.55 : 0.3, mm / 4)) : 0;
    if ((code >= 63 && code <= 67) || code === 81) weather.rain = Math.max(weather.rain, 0.75);
    if (code === 82 || code >= 95) weather.rain = 1;
    weather.storm = code >= 95; weather.fog = code === 45 || code === 48; weather.cloud = (c.cloud_cover || 0) / 100; weather.wind = Math.min(1, (c.wind_speed_10m || 0) / 30);
    const r = toH(j.daily && j.daily.sunrise[0]), s = toH(j.daily && j.daily.sunset[0]);
    if (r && s) { SUN_T.rise = r; SUN_T.set = s; }
    PANEL.setWeather({ temp: c.temperature_2m, desc: WMO[code] || "", max: j.daily && j.daily.temperature_2m_max ? j.daily.temperature_2m_max[0] : null,
      min: j.daily && j.daily.temperature_2m_min ? j.daily.temperature_2m_min[0] : null });
    if ($("wx")) $("wx").textContent = `clima real: ${weather.rain ? "chuva" : "sem chuva"}, nuvens ${Math.round(weather.cloud * 100)}%, vento ${Math.round(c.wind_speed_10m)} km/h, sol ${fmt(SUN_T.rise)}–${fmt(SUN_T.set)}`;
  } catch (e) { /* sem internet: mantém o último estado */ }
}
updateWeather(); setInterval(updateWeather, 10 * 60 * 1000);

// ---------- estado das animações extras ----------
const clamp = (x, a, b) => Math.min(b, Math.max(a, x));
// ida e volta suave: 0 = presente, 1 = foi embora (cada saída/chegada dura "dur" segundos)
function trip(o, want, t, dur) {
  if (o._s == null) o._s = want ? 0 : 2;
  if (o._s === 0 && !want) { o._s = 1; o._t = t; }
  if (o._s === 2 && want) { o._s = 3; o._t = t; }
  if (o._s === 1) { const u = (t - o._t) / dur; if (u >= 1) { o._s = want ? 3 : 2; o._t = t; } return Math.min(1, u); }
  if (o._s === 3) { const u = (t - o._t) / dur; if (u >= 1) { o._s = want ? 0 : 1; o._t = t; } return Math.max(0, 1 - u); }
  return o._s === 2 ? 1 : 0;
}
const gullTrip = {};
let flockOn = false, tongueK = 0;
let gullFlapT0 = -100, gullFlapNext = (params.get("bater") === "1") ? 2 : 40 + rnd() * 50;
let pulses = [-100, -100, -100], pulseNext = 5 + (+(params.get("t0") || 0));
const frog = { pad: 1, off: new V3(0.02, 0, -0.03), next: 18, jump: null };
const fishPos = [new V3(), new V3(), new V3()];
let meteorT = -1, meteorNext = (params.get("meteoro") === "1") ? 3 : 90 + rnd() * 120, fwNext = 0, fwIdx = 0, fwFlash = 0;
const POSE_LIE = { raise: 0, pitch: 0, fl: -1.45, hl: -1.35, hs: 0.25, head: 0 };
const POSE_STAND = { raise: 0.1, pitch: 0, fl: 0, hl: 0, hs: 0.05, head: -0.1 };
const POSE_BOW = { raise: 0.05, pitch: 0.38, fl: -1.85, hl: -0.38, hs: 0.05, head: -0.35 };
const STRETCH_KEYS = [[0, POSE_LIE], [1.0, POSE_STAND], [1.7, POSE_STAND], [2.5, POSE_BOW], [4.3, POSE_BOW], [5.1, POSE_STAND], [5.8, POSE_STAND], [7.0, POSE_LIE]];
const STRETCH_LEN = 7.0;
function poseAt(u) {
  for (let i = 0; i < STRETCH_KEYS.length - 1; i++) {
    const [ta, A] = STRETCH_KEYS[i], [tb, B] = STRETCH_KEYS[i + 1];
    if (u <= tb) { const k = smooth(clamp01((u - ta) / (tb - ta))); const o = {}; for (const key in A) o[key] = lerp(A[key], B[key], k); return o; }
  }
  return POSE_LIE;
}
function applyPose(p) {
  dBodyG.position.set(BODY_PIV.x, BODY_PIV.y + p.raise, BODY_PIV.z); dBodyG.rotation.x = p.pitch;
  dLegs.fl.rotation.x = p.fl; dLegs.fr.rotation.x = p.fl;
  dLegs.hl.rotation.x = p.hl; dLegs.hr.rotation.x = p.hl; dLegs.hl.rotation.z = p.hs; dLegs.hr.rotation.z = -p.hs;
}
let dogAct = 0, dogStretchNext = (params.get("espreguica") === "1") ? 2 : 45 + rnd() * 40;
function landSpots(i) {
  CHAIR.updateMatrixWorld(); boat.updateMatrixWorld();
  const fl = (k) => pads[k].g.position.clone().add(new V3(pads[k].petals ? pads[k].petals.position.x : 0, 0.07, pads[k].petals ? pads[k].petals.position.z : 0));
  return i % 2 === 0 ? [CHAIR.localToWorld(new V3(0, 0.9, -0.53)), CHAIR.localToWorld(new V3(0.3, 0.44, 0.05)), fl(0)]
                     : [boat.localToWorld(new V3(1.35, hullTop(1.35) + 0.035, 0)), fl(4), boat.localToWorld(new V3(-1.3, hullTop(-1.3) + 0.035, 0.3))];
}
function curDate(h) {
  const ov = params.get("data");
  if (ov) { const [y, m, d] = ov.split("-").map(Number); return new Date(y, m - 1, d, Math.floor(h), Math.floor((h % 1) * 60)); }
  const n = new Date(); if (!live) n.setHours(Math.floor(h), Math.floor((h % 1) * 60)); return n;
}

// ====================== animação ======================
// Relógio da cena: anda junto com o tempo real, mas nunca dá saltos (pausa do Lively, engasgo do PC)
let hSm = null, clockT = +(params.get("t0") || 0), flowPh = clockT, frameNo = 0, splashT0 = -100, steamK = 0;   // ?t0= só para testar muitas horas ligado
const fwT0 = [-100, -100, -100];
let last = 0, headTarget = 0, headNext = 0, paused = false, beatS = 0;
// ritmo casado com a taxa do monitor: desenha a cada N atualizações da tela, sempre com o mesmo espaçamento
let rafPrev = 0, refreshMs = 1000 / 60, rafN = 0, perfEma = 0, perfSlow = 0, perfFast = 0;
const rafD = [];
const TAU = Math.PI * 2, fmod = (x, m) => ((x % m) + m) % m;
function frame(now) {
  requestAnimationFrame(frame);
  if (rafPrev) { const d = now - rafPrev; if (d > 3 && d < 70) { rafD.push(d); if (rafD.length > 90) rafD.shift();
    if (++rafN % 30 === 0) { const sd = rafD.slice().sort((x, y) => x - y); refreshMs = sd[sd.length >> 1]; } } }
  rafPrev = now;
  if (paused) { last = 0; return; }
  const target = 1000 / Math.max(15, Math.min(60, S.fps || 30));
  const every = Math.max(1, Math.round(target / refreshMs - 0.05)), interval = every * refreshMs;
  if (last && now - last < interval - refreshMs * 0.5) return;
  const elapsed = last ? now - last : interval; last = now;
  const dt = Math.min(0.1, elapsed / 1000);
  clockT += dt; frameNo++;
  // se a placa não aguentar o ritmo, usa pixels 2x (e volta sozinho depois de uns minutos folgado)
  perfEma = perfEma ? perfEma * 0.95 + elapsed * 0.05 : elapsed;
  if (perfEma > interval * 1.4) { if (++perfSlow > 150 && autoScale < 2) { perfSlow = 0; perfFast = 0; perfEma = interval; autoScale = 2; resize(); } } else perfSlow = 0;
  if (autoScale > 1 && perfEma < interval * 1.08) { if (++perfFast > 30 * 180) { perfFast = 0; autoScale = 1; resize(); } } else perfFast = 0;
  if (PREVIEW && $("fpsLabel")) $("fpsLabel").textContent = `${Math.round(1000 / perfEma)} fps`;
  if (lapse) manualH = (manualH + dt * 0.8) % 24;
  // a hora do dia vem do relógio real; depois de uma pausa longa a luz muda em alguns segundos, sem estalo
  const hReal = live ? nowH() : manualH;
  if (hSm === null || !live) hSm = hReal;
  else { let dh = hReal - hSm; if (dh > 12) dh -= 24; if (dh < -12) dh += 24; hSm = (hSm + dh * Math.min(1, dt * 0.6) + 24) % 24; }
  const h = hSm;
  if (PREVIEW) { $("scrub").value = h; $("hourLabel").textContent = fmt(h); }
  SUN.rise += (SUN_T.rise - SUN.rise) * Math.min(1, dt * 0.4); SUN.set += (SUN_T.set - SUN.set) * Math.min(1, dt * 0.4);
  const P = palette(h), t = clockT;
  const k = Math.min(1, dt * 0.15);
  const real = S.climaReal;
  W.rain += ((forceRain ? 0.85 : real ? weather.rain : 0) - W.rain) * k;
  W.cloud += ((forceRain ? 0.9 : real ? weather.cloud : 0.25) - W.cloud) * k;
  W.wind += ((forceRain ? 0.6 : real ? weather.wind : 0.25) - W.wind) * k;
  W.flash *= Math.pow(0.02, dt);
  W.fog += (((S.climaReal && weather.fog) || params.get("neblina") === "1" ? 1 : 0) - W.fog) * k;
  if (((real && weather.storm) || forceStorm) && Math.random() < dt * 0.05) W.flash = 1;
  if (W.flash > 0.3 && Math.random() < 0.15) W.flash = 0.6 + Math.random() * 0.4;
  const night = 1 - P.day, cloudy = Math.max(W.cloud * 0.7, W.rain);
  const lampOn = clamp01(smooth(clamp01((0.65 - P.day) / 0.45)) + 0.5 * W.rain) * (0.92 + 0.08 * Math.sin(t * 9) * Math.sin(t * 5.3));
  const birdsOn = S.gaivotas && P.day > 0.55 && W.rain < 0.25;
  beatS += ((S.musicaAgua ? Math.pow(audioLevel, 1.5) : 0) - beatS) * Math.min(1, dt * 8);
  WU.uBeat.value = beatS;

  // luzes
  const amb = mix3(mix3(P.light, P.hi, 0.5), [0.75, 0.8, 0.85], 0.55 * P.day);
  hemi.color.setRGB(...amb); hemi.groundColor.setRGB(...P.deep.map(v => v * 1.5)); hemi.intensity = 0.45 + 0.2 * P.day;
  const key = mix3(P.hi, [1.0, 0.96, 0.88], 0.55);
  sun.color.setRGB(...key); sun.intensity = (P.day * 1.0 + night * 0.25) * (1 - 0.6 * cloudy);
  const dir = P.day > 0.4 ? new V3((P.sunX - 1) * 1.5, 1.1 + 0.2 * Math.sin(Math.PI * P.sunX * 0.5), -1.0) : new V3((P.moonX - 1) * 1.5, 1.15, -1.0);
  dir.normalize(); if (dir.dot(shDir) < 0.99995) fitShadow(dir);
  sun.position.copy(sun.target.position).addScaledVector(dir, 30);
  lampLight.intensity = lampOn * 2.4;
  M.glass.emissive.setRGB(1.0 * lampOn, 0.78 * lampOn, 0.45 * lampOn);
  floorMat.color.setRGB(...P.deep.map(v => v * 0.4)); WU.uFloor.value.set(...P.deep.map(v => v * 0.4));

  // água
  // a correnteza é integrada: quando o vento muda, só a velocidade muda (antes a água inteira "pulava")
  flowPh += dt * (0.8 + 0.8 * W.wind);
  WU.uTime.value = fmod(t, 1000); WU.uWind.value = W.wind; WU.uRain.value = W.rain; WU.uDay.value = P.day;
  WU.uCloud.value = W.cloud; WU.uCloudy.value = cloudy;
  WU.uDeep.value.set(...P.deep); WU.uLight.value.set(...P.light); WU.uHi.value.set(...P.hi);
  WU.uOffA.value.set(fmod(0.04 * flowPh, 256), fmod(-0.12 * flowPh, 256), fmod(-0.15 * flowPh, 256), fmod(-0.3 * flowPh, 256));
  WU.uOffB.value.set(fmod(0.03 * t, 256), fmod(0.03 * t, 256), fmod(0.012 * t, 256), 0);
  WU.uOffC.value.set(fmod(0.012 * t, 256), fmod(0.004 * t, 256), fmod(0.02 * t, 256), fmod(0.015 * t, 256));
  WU.uOffD.value.set(fmod(0.02 * t, 256), fmod(0.02 * t, 256), fmod(0.01 * t, 256), fmod(0.01 * t, 256));
  WU.uRipPh.value.set(fmod(t * 1.6, TAU), fmod(t * 1.5, TAU), fmod(t * 1.2, TAU), fmod(t * 1.1, TAU));
  WU.uBeatPh.value = fmod(t * 4.5, TAU);
  WU.uDotCol.value.set(...mix3(P.light.map(v => v * 1.25), P.hi, 0.7));
  const gdir = P.day > 0.4 ? new V3((P.sunX - 1) * 1.5, 1.1 + 0.2 * Math.sin(Math.PI * P.sunX * 0.5), -1.0) : new V3((P.moonX - 1) * 1.5, 1.15, -1.0);
  WU.uGlintDir.value.copy(gdir.normalize());
  const golden = P.day > 0.4 ? clamp01((P.sunI - 0.35) / 0.5) : 0;
  WU.uGlint.value = (P.day > 0.4 ? 0.1 + 0.8 * golden : Math.min(1, P.moonI * 2.2)) * (1 - 0.85 * cloudy);
  if (P.day > 0.4) WU.uGlintCol.value.set(1.0, 0.86 - 0.12 * golden, 0.6 - 0.25 * golden); else WU.uGlintCol.value.set(0.9, 0.94, 1.0);
  WU.uLamp.value.copy(LAMP); WU.uLampOn.value = lampOn;

  // barco
  if (t > pulseNext) { pulses.shift(); pulses.push(t); pulseNext = t + 20 + rnd() * 20; }
  WU.uPulseAge.value.set(t - pulses[0], t - pulses[1], t - pulses[2]);
  const kAge = t - pulses[2], kick = kAge > 0 && kAge < 4 ? Math.exp(-kAge * 1.2) * Math.sin(kAge * 5.5) : 0;
  const sway = 1 + 1.2 * W.wind + 0.8 * W.rain;
  const yaw = 0.42 + 0.07 * Math.sin(t * 0.045) + 0.02 * Math.sin(t * 0.19);
  boat.position.set(-4.0, 0.02 * Math.sin(t * 0.9) * sway + 0.012 * beatS + 0.02 * kick, -1.0);
  boat.rotation.set(0.025 * Math.sin(t * 0.8) * sway + 0.03 * kick, yaw, 0.012 * Math.sin(t * 0.6 + 1) * sway, "YZX");
  boat.updateMatrixWorld(true);
  WU.uBoat.value.set(boat.position.x, boat.position.z, yaw, boat.position.y);
  updateRope(t);

  // gaivota pousada: vira a cabeça de vez em quando
  if (t > headNext) { headTarget = (rnd() - 0.5) * 1.6; headNext = t + 2 + rnd() * 5; }
  const hd = perched.userData.head; hd.rotation.y += (headTarget - hd.rotation.y) * Math.min(1, dt * 6);
  hd.rotation.z = 0.08 * Math.sin(t * 0.7);
  const gA = trip(gullTrip, W.rain < 0.6, t, 4.5), gk = gA * gA;
  perched.visible = gA < 0.999;
  perched.position.set(PX + 0.98 - 3.0 * gk, 0.925 + 3.6 * gk + 0.2 * Math.sin(gA * Math.PI), PZ0 + 1.8 * gk);
  if (t > gullFlapNext) { gullFlapT0 = t; gullFlapNext = t + ((params.get("bater") === "1") ? 5 : 30 + rnd() * 60); }
  { const fu = t - gullFlapT0; let open = 0, lift = 0;
    if (fu >= 0 && fu < 2.4) { const env = Math.min(1, fu / 0.35) * (1 - sstep(1.8, 2.4, fu)); open = env * (0.95 + 0.45 * Math.sin(fu * 13)); lift = env; }
    if (gA > 0.001) { const e = Math.min(1, gA * 12); open = e * (1.05 + 0.6 * Math.sin(t * 15)); }
    perched.userData.fold.forEach(w => { w.piv.rotation.x = -w.sz * open * 1.25; w.piv.rotation.y = w.sz * open * 0.35; w.piv.rotation.z = open * 0.2; });
    perched.userData.head.position.y = 0.235 + 0.01 * lift; }

  // bando voando
  const bx = ((t * 1.3) % 130) - 14, bz = 1.2 - 0.5 * Math.sin(t * 0.031);
  if (bx < -12.5) flockOn = birdsOn;
  flock.forEach((g, i) => {
    g.visible = flockOn;
    const o = flockOff[i];
    g.position.set(bx + o.x, 2.5 + o.y + 0.08 * Math.sin(t * 0.8 + i), bz + o.z);
    g.rotation.set(0, -0.12, 0.05 * Math.sin(t * 0.9 + i));
    const cyc = (t * 0.33 + i * 0.3) % 1, flapping = cyc < 0.6;
    const ph = t * 6.5 + i * 1.9;
    for (const w of g.userData.wings) {
      const a = flapping ? Math.sin(ph) * 0.32 : 0.06, b = flapping ? Math.sin(ph - 0.7) * 0.22 : -0.03;
      w.shoulder.rotation.x = w.sz * a; w.elbow.rotation.x = w.sz * b;
    }
  });


  // ===== bichos, Loki e datas especiais =====
  const sleep = smooth(clamp01((0.35 - P.day) / 0.25));
  const dayLife = S.bichos && P.day > 0.5 && W.rain < 0.2;
  const Dd = curDate(h), mo = Dd.getMonth() + 1, dd = Dd.getDate(), hr = Dd.getHours();
  const [bdD, bdM] = String(S.aniversario || "").split(/[\/\-. ]/).map(Number);
  const niver = S.datas && bdD === dd && bdM === mo;
  const natal = S.datas && (mo === 12 || (mo === 1 && dd <= 6));
  const gorro = S.datas && mo === 12 && (dd === 24 || dd === 25);
  const anoNovo = S.datas && ((mo === 12 && dd === 31 && hr >= 20) || (mo === 1 && dd === 1 && hr < 3));
  const halloween = S.datas && mo === 10 && dd >= 24;
  const junina = S.datas && mo === 6;
  XMAS.visible = natal; SANTA.visible = gorro && !niver; PARTY.visible = niver; BALLOONS.visible = niver && !!S.cachorro;
  PUMPKIN.visible = halloween; JUNINA.visible = junina; pumpLight.visible = halloween;
  if (natal) {
    const c = new THREE.Color(), nk = 0.45 + 0.55 * (1 - P.day);
    for (let i = 0; i < xmasPts.length; i++) { const b = xmasCols[i % 5], k = nk * (0.6 + 0.4 * Math.sin(t * 2.2 + i * 1.7) * Math.sin(t * 0.7 + i)); c.setRGB(b[0] * k, b[1] * k, b[2] * k); xmasInst.setColorAt(i, c); }
    xmasInst.instanceColor.needsUpdate = true;
  }
  if (BALLOONS.visible) {
    CHAIR.updateMatrixWorld(); const tie = CHAIR.localToWorld(new V3(0.3, 0.42, 0.16));
    balloonList.forEach(bl => {
      const sw = 0.05 * (1 + W.wind) * Math.sin(t * 0.8 + bl.ph), sw2 = 0.04 * (1 + W.wind) * Math.cos(t * 0.6 + bl.ph * 1.3);
      bl.b.position.set(tie.x + bl.off.x + sw, tie.y + bl.off.y + 0.02 * Math.sin(t * 1.1 + bl.ph), tie.z + bl.off.z + sw2); bl.b.rotation.z = sw * 2;
      const pa = bl.line.geometry.attributes.position; pa.setXYZ(0, tie.x, tie.y, tie.z); pa.setXYZ(1, bl.b.position.x, bl.b.position.y - 0.1, bl.b.position.z); pa.needsUpdate = true;
    });
  }
  if (halloween) { const on = clamp01((0.6 - P.day) / 0.4), fl = 0.85 + 0.15 * Math.sin(t * 13) * Math.sin(t * 7.3);
    pumpLight.intensity = on * 1.5 * fl; pumpFace.color.setRGB(lerp(0.1, 1.0, on * fl), lerp(0.05, 0.72, on * fl), lerp(0.02, 0.2, on * fl)); }
  else pumpLight.intensity = 0;
  if (junina) flagList.forEach(f => f.fg.rotation.x = 0.25 * Math.sin(t * 2 + f.ph) * (0.5 + W.wind));
  // fogos de ano novo (reflexo na água + clarão)
  if (anoNovo && t > fwNext) { const i = fwIdx++ % 3; WU.uFw.value[i].set(-6 + rnd() * 12, -4.6 + rnd() * 2.6, 0, rnd()); fwT0[i] = t; fwNext = t + 0.8 + rnd() * 2.2; fwFlash = 1; }
  { let on = 0; for (let i = 0; i < 3; i++) { const a = t - fwT0[i]; WU.uFw.value[i].z = a; if (a > 0 && a < 2.6) on = 1; } WU.uFwOn.value = on; }
  fwFlash *= Math.pow(0.03, dt); W.flash = Math.max(W.flash, fwFlash * 0.22);
  // estrela cadente (rara, noite limpa)
  if (meteorT < 0 && t > meteorNext && P.day < 0.15 && cloudy < 0.5) {
    meteorT = 0; const x0 = -7 + rnd() * 14, z0 = -5 + rnd() * 2.2, sg = rnd() < 0.5 ? 1 : -1, len = 2.6 + rnd() * 2.4;
    WU.uMeteor.value.set(x0, z0, x0 + sg * len, z0 + 0.6 + rnd() * 0.9);
  }
  if (meteorT >= 0) { meteorT += dt / 0.9; if (meteorT > 1) { meteorT = -1; meteorNext = t + ((params.get("meteoro") === "1") ? 6 : 120 + rnd() * 240); } }
  WU.uMeteorT.value = meteorT;
  // lamparina do barco
  lampChimney.emissive.setRGB(1.0 * lampOn, 0.75 * lampOn, 0.42 * lampOn);
  boatLight.intensity = lampOn * 1.2;
  boat.updateMatrixWorld(true); WU.uLamp2.value.copy(BOAT_LAMP.localToWorld(new V3(0, 0.09, 0))); WU.uLamp2On.value = lampOn * 0.9;
  // peixes por baixo da água
  [[-3.4, 1.5, 2.6, 1.0, 0.07, 0, 0.75], [3.9, 0.45, 1.3, 0.55, 0.1, 2, 0.6], [0.4, -2.6, 3.6, 1.1, 0.055, 4, 0.85]].forEach(([cx, cz, rx, rz, sp, ph, sz], i) => {
    const w = t * sp + ph + 0.6 * Math.sin(t * 0.05 + ph), x = cx + rx * Math.cos(w), z = cz + rz * Math.sin(w);
    WU.uFish.value[i].set(x, z, Math.atan2(rz * Math.cos(w), -rx * Math.sin(w)), S.bichos ? sz : 0); fishPos[i].set(x, 0, z);
  });
  // sapo: pula de folha em folha
  FROG.visible = false;
  if (frog.jump) {
    const u = clamp01((t - frog.jump.t0) / 0.75), a = frog.jump.from, b = frog.jump.to;
    FROG.position.set(lerp(a.x, b.x, u), lerp(a.y, b.y, u) + Math.sin(u * Math.PI) * 0.28, lerp(a.z, b.z, u));
    if (u >= 1) { WU.uSplash.value.set(b.x, b.z, 0, 0.9); splashT0 = t; pads[frog.pad].bob = t; frog.jump = null; frog.next = t + 25 + rnd() * 40; }
  } else {
    const p = pads[frog.pad].g.position; FROG.position.set(p.x + frog.off.x, p.y + 0.012, p.z + frog.off.z);
    if (false && t > frog.next) {
      const ch = [0, 1, 2, 3].filter(k => k !== frog.pad), np = ch[Math.floor(rnd() * ch.length)];
      const from = FROG.position.clone(), to = pads[np].g.position.clone().add(new V3(frog.off.x, 0.012, frog.off.z));
      FROG.rotation.y = Math.atan2(to.x - from.x, to.z - from.z); frog.jump = { t0: t, from, to }; frog.pad = np;
    }
  }
  { const night = 1 - P.day; const croak = night > 0.5 ? Math.max(0, Math.sin(t * 2.2)) * (Math.sin(t * 0.3) > 0.2 ? 1 : 0) : Math.max(0, Math.sin(t * 1.4)) * 0.25;
    frogThroat.scale.set(1 + croak * 0.8, 0.6 + croak * 0.5, 0.8 + croak * 0.5); }
  WU.uSplash.value.z = t - splashT0;
  // libélulas e borboletas (de dia)
  INSECTS.forEach((ins, i) => {
    const away = trip(ins, dayLife, t, 6);
    ins.g.visible = away < 0.999;
    if (!ins.g.visible) return;
    if (!dayLife) { ins.goto = null; ins.land = 0; }
    if (!ins.exit) ins.exit = new V3(ins.home.x + (ins.home.x > 0 ? 4.5 : -4.5), 3.8, ins.home.z - 3.5);
    (() => {
    if (ins.kind === "drag") {
      if (t > ins.next) { ins.from.copy(ins.pos); ins.to.set(ins.home.x + (rnd() - 0.5) * 2.4, 0.18 + rnd() * 0.35, ins.home.z + (rnd() - 0.5) * 1.6); ins.t0 = t; ins.dur = 0.5 + rnd() * 0.6; ins.next = t + ins.dur + 1.2 + rnd() * 3.0; }
      const u = smooth(clamp01((t - ins.t0) / ins.dur)), p = ins.from.clone().lerp(ins.to, u);
      p.x += Math.sin(t * 13 + i) * 0.006; p.y += Math.sin(t * 9 + i) * 0.006;
      const dv = ins.to.clone().sub(ins.from); if (u < 1 && dv.lengthSq() > 1e-4) ins.g.rotation.y = Math.atan2(dv.x, dv.z);
      ins.pos.copy(p); ins.g.position.copy(p);
      ins.g.userData.wings.forEach((w, k) => w.wg.rotation.z = w.sx * 0.35 * Math.sin(t * 90 + k * 1.3));
    } else {
      if (ins.land > t && ins.landAt) {
        const flap = 0.35 + 0.5 * (0.5 + 0.5 * Math.sin(t * 1.5 + ins.ph)); ins.g.userData.wings.forEach(w => w.wg.rotation.z = w.sx * flap);
        ins.pos.copy(ins.landAt); ins.g.position.copy(ins.landAt); ins.vel.set(0, 0.3, 0); return;
      }
      let acc;
      if (ins.goto) {
        acc = ins.goto.clone().sub(ins.pos).multiplyScalar(5).sub(ins.vel.clone().multiplyScalar(2.2));
        if (ins.pos.distanceTo(ins.goto) < 0.03) { ins.landAt = ins.goto.clone(); ins.land = t + 4 + rnd() * 5; ins.goto = null; }
      } else {
        const tgt = ins.home.clone().add(new V3(Math.sin(t * 0.23 + ins.ph) * 1.1, 0.2 * Math.sin(t * 0.5 + ins.ph), Math.cos(t * 0.17 + ins.ph * 1.7) * 0.8));
        acc = tgt.sub(ins.pos).multiplyScalar(0.9).add(new V3(Math.sin(t * 3.1 + ins.ph) * 0.6, Math.sin(t * 4.3 + ins.ph) * 0.5, Math.cos(t * 2.7 + ins.ph) * 0.6));
        if (t > ins.next) { ins.next = t + 18 + rnd() * 25; if (rnd() < 0.65) { const sp = landSpots(i); ins.goto = sp[Math.floor(rnd() * sp.length)]; } }
      }
      ins.vel.add(acc.multiplyScalar(dt)).multiplyScalar(Math.pow(0.4, dt));
      ins.pos.add(ins.vel.clone().multiplyScalar(dt)); ins.pos.y = Math.max(0.2, ins.pos.y);
      ins.g.position.copy(ins.pos); if (ins.vel.lengthSq() > 1e-4) ins.g.rotation.y = Math.atan2(ins.vel.x, ins.vel.z);
      const flap = 0.15 + 1.1 * (0.5 + 0.5 * Math.sin(t * 16 + ins.ph)); ins.g.userData.wings.forEach(w => w.wg.rotation.z = w.sx * flap);
    }
    })();
    if (away > 0) {
      const k = away * away, leaving = ins._s === 1;
      ins.g.position.lerp(ins.exit, k);
      const tg = leaving ? ins.exit : ins.home, dx = tg.x - ins.g.position.x, dz = tg.z - ins.g.position.z;
      if (dx * dx + dz * dz > 0.01) ins.g.rotation.y = Math.atan2(dx, dz);
      if (ins.kind !== "drag") { const flap = 0.15 + 1.1 * (0.5 + 0.5 * Math.sin(t * 16 + ins.ph)); ins.g.userData.wings.forEach(w => w.wg.rotation.z = w.sx * flap); }
    }
  });
  // ===== Loki =====
  DOG.visible = CHAIR.visible = BALL.visible = BOWL.visible = !!S.cachorro;
  if (DOG.visible) {
    const hw = dHead.getWorldPosition(new V3());
    let best = null, bestScore = 0;
    const consider = (p, w) => { const d = p.distanceTo(hw), sc = w / (0.4 + d); if (d < 2.6 && sc > bestScore) { bestScore = sc; best = p; } };
    if (dayLife) INSECTS.forEach(ins => consider(ins.pos, ins.kind === "bfly" ? 1.4 : 1.0));
    if (S.bichos && frog.jump) consider(FROG.position, 2.0);
    if (S.bichos) consider(fishPos[1], 0.7);
    if (perched.visible) consider(perched.position.clone().add(new V3(0, 0.15, 0)), 0.25);
    if (sleep < 0.1 && !dogAct && t > dogStretchNext) dogAct = t;
    let pose = POSE_LIE;
    if (dogAct) { const u = t - dogAct; pose = poseAt(u); if (u > STRETCH_LEN) { dogAct = 0; dogStretchNext = t + ((params.get("espreguica") === "1") ? 4 : 60 + rnd() * 90); } }
    applyPose(pose);
    let yawT = dogHeadT, pitchT = 0;
    if (best && sleep < 0.5) {
      const lp = DOG.worldToLocal(best.clone()), hl = DOG.worldToLocal(hw.clone()), dv = lp.sub(hl);
      yawT = clamp(Math.atan2(dv.x, dv.z), -1.1, 1.1); pitchT = clamp(-Math.atan2(dv.y, Math.hypot(dv.x, dv.z)), -0.5, 0.6);
    } else if (t > dogNext) { dogHeadT = [-0.55, 0.0, 0.35, -0.2, 0.15][Math.floor(rnd() * 5)]; dogNext = t + 3 + rnd() * 6; }
    dHead.rotation.y += (yawT * (1 - sleep) - dHead.rotation.y) * Math.min(1, dt * 3.0);
    const hpT = 0.22 * sleep + (pitchT + 0.06 * Math.sin(t * 0.5)) * (1 - sleep) + pose.head;
    dHead.rotation.x += (hpT - dHead.rotation.x) * Math.min(1, dt * 3.0);
    dHead.rotation.z = (0.07 * Math.sin(t * 0.7) + (best ? 0.12 * Math.sin(t * 0.9) : 0)) * (1 - sleep);
    dHead.position.set(HEAD_PIV.x - BODY_PIV.x, HEAD_PIV.y - BODY_PIV.y - 0.115 * sleep, HEAD_PIV.z - BODY_PIV.z + 0.05 * sleep);
    dBreath.forEach(m => m.scale.y = 1 + 0.022 * Math.sin(t * (2.6 - 1.2 * sleep)));
    const excited = best ? 1 : 0, standing = dogAct ? 1 : 0;
    const wag = Math.max(smooth(clamp01((Math.sin(t * 0.21 + 1.0) - 0.05) / 0.5)), excited * 0.7, standing) * (1 - sleep);
    dTail.rotation.y = Math.sin(t * 9) * 0.45 * wag; dTail.rotation.z = 0;
    const pant = (P.day > 0.5 ? 1 : 0.25) * (1 - sleep);
    tongueK += ((pant > 0.5 || Math.sin(t * 0.17) > 0.7 * (1 + sleep) ? 1 : 0) - tongueK) * Math.min(1, dt * 3); dTongue.visible = tongueK > 0.04;
    { const k = smooth(clamp01(tongueK)); dTongue.scale.set(0.95 * (0.4 + 0.6 * k), 0.32, (1.25 + 0.22 * Math.sin(t * 7) * pant) * k); }
    dEars.forEach((e, i) => e.rotation.z = (i ? -1 : 1) * (0.06 * Math.sin(t * 1.3 + i) + 0.08 * sleep - 0.1 * excited));
    const blink = (Math.sin(t * 0.9) > 0.985) ? 0.15 : 1;
    dEyes.forEach((e, i) => { e.scale.y = Math.max(0.12, (1 - sleep * 0.9) * blink); if (i % 2) e.visible = sleep < 0.5 && blink > 0.5; });
  }

  // vitórias-régias / folhas (as folhas contornam o barco e os postes)
  pads.forEach((p, i) => {
    const bob = p.bob ? Math.exp(-(t - p.bob) * 2.0) * Math.sin((t - p.bob) * 12) * 0.012 : 0;
    p.g.position.y = 0.012 + 0.004 * Math.sin(t * 0.9 + p.ph) + bob; p.g.rotation.y = 0.05 * Math.sin(t * 0.1 + p.ph);
    if (p.petals) { const open = 0.25 + 0.65 * P.day;
      p.petals.children.forEach(piv => { if (piv.userData.p) piv.rotation.z = (piv.userData.ring ? 0.9 : 0.5) * (1.6 - open); }); }
  });
  { const bc = Math.cos(yaw), bs = Math.sin(yaw);
    leaves.forEach((l, i) => {
      l.px += dt * l.sp * (1 + W.wind);
      l.pz += dt * (0.02 * Math.cos(t * 0.1 + i) + (l.z - l.pz) * 0.03);
      if (l.px > 11) { l.px -= 22; l.pz = l.z; }
      // contorna o casco: a "zona" do barco cresce suavemente nas pontas, então a folha desliza em vez de pular
      const dx = l.px - boat.position.x, dz = l.pz - boat.position.z;
      const lx = bc * dx - bs * dz, lz = bs * dx + bc * dz;
      const hwv = (hullWmax(Math.min(1.6, Math.max(-1.42, lx))) + 0.2) * smooth(clamp01((lx + 1.97) / 0.55)) * smooth(clamp01((2.05 - lx) / 0.45));
      if (Math.abs(lz) < hwv) { const nz = (lz < 0 ? -1 : 1) * hwv; l.px = boat.position.x + bc * lx + bs * nz; l.pz = boat.position.z - bs * lx + bc * nz; }
      for (const px0 of [PX - 0.98, PX + 0.98]) for (let k = 0; k < 5; k++) {
        const pz0 = PZ0 - 2.3 * k, ddx = l.px - px0, ddz = l.pz - pz0, dl = Math.hypot(ddx, ddz);
        if (dl < 0.24) { l.px = px0 + ddx / (dl || 1) * 0.24; l.pz = pz0 + ddz / (dl || 1) * 0.24; }
      }
      l.g.position.set(l.px, 0.008 + 0.003 * Math.sin(t + i), l.pz);
      l.g.rotation.y = l.rot + 0.3 * Math.sin(t * 0.07 + i);
    });
  }

  // aconchego: varal de luzinhas, vapor da caneca, taboas
  { const c = new THREE.Color(), on = 0.3 + 0.7 * lampOn;
    for (let i = 0; i < varalBulbs.length; i++) { const k = on * (0.88 + 0.12 * Math.sin(t * 1.7 + i * 2.3)); c.setRGB(1.0 * k, 0.8 * k, 0.5 * k); varalInst.setColorAt(i, c); }
    varalInst.instanceColor.needsUpdate = true; }

  REEDS.forEach(r => { r.g.rotation.x = r.k * Math.sin(t * 0.9 + r.ph) * (1 + 1.5 * W.wind); r.g.rotation.z = r.k * 0.6 * Math.cos(t * 0.7 + r.ph * 1.3) * (1 + W.wind); });

  // vaga-lumes
  const ffOn = night * (1 - smooth(clamp01((W.rain - 0.05) / 0.25)));
  const pa = ffGeo.attributes.position.array, ca = ffGeo.attributes.color.array;
  for (let i = 0; i < FF; i++) {
    const c = i % 2 ? [-3.6, 0, -1.6] : [PX - 1.0, 0, -1.3];
    pa[i * 3] = c[0] + 1.7 * Math.sin(t * 0.13 * (1 + i * 0.17) + i * 2.1);
    pa[i * 3 + 1] = 0.55 + 0.35 * Math.sin(t * 0.4 + i);
    pa[i * 3 + 2] = c[2] + 1.3 * Math.cos(t * 0.11 * (1 + i * 0.1) + i);
    const blink = smooth(clamp01((Math.sin(t * (0.9 + 0.03 * i) + i * 3) - 0.2) / 0.8)) * ffOn;
    ca[i * 3] = blink; ca[i * 3 + 1] = blink * 0.92; ca[i * 3 + 2] = blink * 0.45;
  }
  ffGeo.attributes.position.needsUpdate = true; ffGeo.attributes.color.needsUpdate = true;
  fireflies.visible = ffOn > 0.01;

  // render: reflexo e sombras se revezam (cada um a cada 2 quadros); água em meia resolução; cena; pontilhado
  if ((frameNo % 2 === 0 || frameNo < 3) && !PROF.norefl) renderReflection();
  if (sun.shadow.map) { WU.tShadow.value = sun.shadow.map.texture; WU.uShadowM.value.copy(sun.shadow.matrix); WU.uShadowSize.value.copy(sun.shadow.mapSize); }
  if (!PROF.nowd) { renderer.setRenderTarget(wdRT); renderer.render(wdScene, camera); }
  renderer.shadowMap.needsUpdate = (frameNo % 2 === 1 || frameNo < 3) && !PROF.noshadow;
  if (PROF.noobj) world.visible = false;
  if (PROF.nowater) water.visible = false;
  renderer.setRenderTarget(sceneRT); renderer.setClearColor(0x05080f, 1);
  renderer.render(scene, camera);
  const pu = postMat.uniforms;
  pu.uRain.value = W.rain; pu.uCloud.value = W.cloud; pu.uFlash.value = W.flash; pu.uMist.value = Math.min(1, P.mist + 0.25 * W.rain + 0.85 * W.fog);
  pu.uDay.value = P.day; pu.uTime.value = fmod(t, 1000); pu.uHi.value.set(...P.hi);
  pu.uMistOff.value = fmod(t * 0.015, 256); pu.uLeakOff.value = fmod(Math.floor(t * 0.5) * 3.1, 256);
  {
    const glowAt = (i, p, k) => { const v = p.clone().project(camera); const ok = v.z < 1 && Math.abs(v.x) < 1.3 && Math.abs(v.y) < 1.3;
      pu.uGlowP.value[i].set(v.x * 0.5 + 0.5, v.y * 0.5 + 0.5, ok ? k : 0); };
    glowAt(0, LAMP, lampOn * 0.9);
    glowAt(1, WU.uLamp2.value, lampOn * 0.6);
    glowAt(2, PUMPKIN.position.clone().add(new V3(0, 0.1, 0)), PUMPKIN.visible ? pumpLight.intensity * 0.35 : 0);
    glowAt(3, new V3(PX, 1.45, -1.9), lampOn * 0.22);
    pu.uAspect.value = canvas.width / canvas.height;
  }
  pu.uSunX.value = P.sunX; pu.uLeak.value = P.day > 0.4 ? P.sunI * (1 - cloudy) * 0.75 : 0;
  pu.uLeakCol.value.set(1.0, 0.86 - 0.14 * golden, 0.55 - 0.2 * golden);
  if (P.day > 0.4) { RIM.uRimCol.value.setRGB(1.0, 0.72, 0.42); RIM.uRim.value = 0.05 + 0.3 * golden; }
  else { RIM.uRimCol.value.setRGB(0.45, 0.58, 0.92); RIM.uRim.value = 0.18 + 0.4 * (P.moonI / 0.7); }
  renderer.setRenderTarget(null);
  if (!PROF.nopost) renderer.render(postScene, postCam);
}
requestAnimationFrame(frame);
if (params.get("teste") === "1") window.__lago = { get t() { return clockT; }, S, W, weather, leaves, WU, INSECTS, perched, setRain: (v) => { forceRain = v; } };

// ====================== Lively / Wallpaper Engine ======================
let applyTimer = null, needGist = false;
window.livelyPropertyListener = (name, val) => {
  if (!(name in S)) return;
  S[name] = typeof S[name] === "number" ? Number(val) : val;
  if (name === "gistId" || name === "painel") needGist = true;
  clearTimeout(applyTimer);
  applyTimer = setTimeout(() => { resize(); PANEL.render(); if (needGist) { needGist = false; fetchGist(); } }, name === "gistId" ? 900 : 80);
};
window.livelyWallpaperPlaybackChanged = (data) => { try { paused = !!JSON.parse(data).IsPaused; } catch (e) {} };
window.livelyCurrentTrack = (data) => {
  let o = null; try { o = typeof data === "string" ? JSON.parse(data) : data; } catch (e) {}
  PANEL.setTrack(o && o.Title ? { title: o.Title, artist: o.Artist || o.AlbumArtist || "", thumb: o.Thumbnail || null } : null);
};
let audioLevel = 0, audioMax = 0.05;
function onAudio(arr) {
  if (!arr || !arr.length) return;
  let b = 0; const n = Math.min(8, arr.length); for (let i = 0; i < n; i++) b += +arr[i] || 0; b /= n;
  audioMax = Math.max(audioMax * 0.997, b, 0.05);
  audioLevel = clamp01(b / audioMax);
}
window.livelyAudioListener = onAudio;
if (window.wallpaperRegisterAudioListener) window.wallpaperRegisterAudioListener(onAudio);
if (window.wallpaperRegisterMediaPropertiesListener) {
  const tr = { title: "", artist: "", thumb: null };
  window.wallpaperRegisterMediaPropertiesListener(e => { tr.title = e.title || ""; tr.artist = e.artist || ""; PANEL.setTrack(tr.title ? { ...tr } : null); });
  if (window.wallpaperRegisterMediaThumbnailListener) window.wallpaperRegisterMediaThumbnailListener(e => { tr.thumb = e.thumbnail || null; if (tr.title) PANEL.setTrack({ ...tr }); });
  if (window.wallpaperRegisterMediaPlaybackListener) window.wallpaperRegisterMediaPlaybackListener(e => { if (e.state === 0) PANEL.setTrack(null); });
}

// ====================== lembretes e agenda (Gist alimentado pelo Atalho do iPhone) ======================
async function fetchGist() {
  const m = String(S.gistId || "").match(/([0-9a-f]{20,})/i);
  if (!m || !S.painel) return;
  try {
    const r = await fetch(`https://api.github.com/gists/${m[1]}`, { headers: { Accept: "application/vnd.github+json" }, cache: "no-store" });
    if (!r.ok) throw new Error("HTTP " + r.status);
    const j = await r.json(), files = Object.values(j.files || {});
    const f = files.find(x => /painel/i.test(x.filename)) || files[0];
    if (!f) throw new Error("gist vazio");
    const txt = f.truncated ? await (await fetch(f.raw_url, { cache: "no-store" })).text() : f.content;
    PANEL.setData(JSON.parse(txt));
  } catch (e) { PANEL.setErr(true); }
}
fetchGist(); setInterval(fetchGist, 5 * 60 * 1000);
setInterval(() => PANEL.render(), 15000);
function loadDemo() {
  const d = new Date(), at = (dd, hh, mm) => { const x = new Date(d.getFullYear(), d.getMonth(), d.getDate() + dd, hh, mm); return x.toISOString(); };
  PANEL.setData({ exemplo: true, atualizado: new Date().toISOString(),
    eventos: [{ titulo: "Aula de Sistemas Distribuídos", inicio: at(0, 19, 0), fim: at(0, 22, 30) }, { titulo: "Prova de Banco de Dados", inicio: at(2, 19, 0), fim: at(2, 21, 0) },
      { titulo: "Reunião do grupo do TCC", inicio: at(3, 14, 0), fim: at(3, 15, 0) }],
    lembretes: [{ titulo: "Entregar relatório do YOLOv7", lista: "Faculdade", vence: at(1, 23, 59) }, { titulo: "Revisar slides de IA", lista: "Faculdade", vence: at(-1, 9, 0) },
      { titulo: "Academia", lista: "Afazeres", vence: at(0, 0, 0) }, { titulo: "Duolingo 30 min", lista: "Afazeres", vence: "" },
      { titulo: "Pagar internet", lista: "Lembretes", vence: at(4, 0, 0) }] }, true);
  PANEL.setTrack({ title: "Música de exemplo", artist: "Artista", thumb: null });
}
if ($("demoBtn")) $("demoBtn").addEventListener("click", loadDemo);
if (params.get("demo") === "1") setTimeout(loadDemo, 300);
})();
