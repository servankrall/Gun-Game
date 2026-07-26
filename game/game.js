// Gun Game Arena — FPS: solo vs bots, or online rooms via the realtime
// server (server.js). Three.js, fixed-timestep sim, seeded RNG.
import * as THREE from "./vendor/three.module.min.js";
import { STR } from "./strings.js";

/* ---------------- tunables (all balance lives here) ---------------- */
const CFG = {
  step: 1000 / 60,
  dprCap: 1.5,
  fov: 75, zoomFov: 30,
  matchTime: 360,               // seconds
  killTarget: 30,               // deathmatch: first to this many kills wins
  startCredits: 4000,           // per match; kept across respawns (buys a rifle turn one)
  killReward: 200,              // credits per kill
  maxCredits: 9000,
  bots: 6,
  player: { speed: 5.5, accel: 14, airAccel: 3.2, jumpV: 7.2, gravity: 20, radius: 0.42, eye: 1.62, hp: 100,
            regenDelay: 4, regenRate: 30, respawn: 3 },
  bot: { speed: 4.4, hp: 100, respawn: 3.5, reactMin: 0.28, reactMax: 0.55,
         spreadMul: 2.4, engageRange: 46, repath: 2.8, dmgMul: 0.7 },
  arena: { size: 64, wallH: 4.5 },
};

// Full arsenal, grouped by category, priced like a buy menu. `mesh` picks the
// procedural model shape (a handful reused across the family); `zoom` = ADS
// scope; `melee` = no ammo/reload. Order is the canonical weapon index used
// everywhere (viewmodels, third-person, netcode).
const WEAPONS = [
  // sidearms
  { id: "classic", cat: "sidearm", mesh: "pistol",  price: 0,    dmg: 26, interval: 0.18, spread: 1.2, mag: 12, reload: 1.0, auto: false, pellets: 1, range: 60, sfx: "pistol",  rate: 1.0 },
  { id: "shorty",  cat: "sidearm", mesh: "shotgun", price: 300,  dmg: 12, interval: 0.50, spread: 7.0, mag: 2,  reload: 1.4, auto: false, pellets: 8, range: 18, sfx: "shotgun", rate: 1.1 },
  { id: "frenzy",  cat: "sidearm", mesh: "pistol",  price: 450,  dmg: 20, interval: 0.09, spread: 2.2, mag: 13, reload: 1.2, auto: true,  pellets: 1, range: 45, sfx: "pistol",  rate: 1.2 },
  { id: "ghost",   cat: "sidearm", mesh: "pistol",  price: 500,  dmg: 30, interval: 0.16, spread: 1.0, mag: 15, reload: 1.1, auto: false, pellets: 1, range: 65, sfx: "pistol",  rate: 0.9 },
  { id: "sheriff", cat: "sidearm", mesh: "pistol",  price: 800,  dmg: 55, interval: 0.40, spread: 1.0, mag: 6,  reload: 1.5, auto: false, pellets: 1, range: 75, sfx: "rifle",   rate: 0.85 },
  // smgs
  { id: "stinger", cat: "smg",     mesh: "smg",     price: 950,  dmg: 18, interval: 0.07, spread: 2.6, mag: 20, reload: 1.5, auto: true,  pellets: 1, range: 40, sfx: "rifle",   rate: 1.35 },
  { id: "spectre", cat: "smg",     mesh: "smg",     price: 1600, dmg: 22, interval: 0.09, spread: 2.0, mag: 30, reload: 1.6, auto: true,  pellets: 1, range: 50, sfx: "rifle",   rate: 1.2 },
  // shotguns
  { id: "bucky",   cat: "shotgun", mesh: "shotgun", price: 850,  dmg: 9,  interval: 0.80, spread: 6.0, mag: 5,  reload: 2.0, auto: false, pellets: 9, range: 24, sfx: "shotgun", rate: 1.0 },
  { id: "judge",   cat: "shotgun", mesh: "shotgun", price: 1850, dmg: 8,  interval: 0.26, spread: 6.5, mag: 7,  reload: 2.2, auto: true,  pellets: 8, range: 22, sfx: "shotgun", rate: 1.1 },
  // rifles
  { id: "bulldog", cat: "rifle",   mesh: "rifle",   price: 2050, dmg: 26, interval: 0.12, spread: 1.6, mag: 24, reload: 1.7, auto: true,  pellets: 1, range: 70, sfx: "rifle",   rate: 1.0 },
  { id: "guardian",cat: "rifle",   mesh: "rifle",   price: 2250, dmg: 55, interval: 0.28, spread: 0.8, mag: 12, reload: 1.9, auto: false, pellets: 1, range: 95, sfx: "rifle",   rate: 0.9 },
  { id: "phantom", cat: "rifle",   mesh: "rifle",   price: 2900, dmg: 30, interval: 0.10, spread: 1.4, mag: 30, reload: 2.0, auto: true,  pellets: 1, range: 75, sfx: "rifle",   rate: 1.05 },
  { id: "vandal",  cat: "rifle",   mesh: "rifle",   price: 2900, dmg: 40, interval: 0.105,spread: 1.5, mag: 25, reload: 2.0, auto: true,  pellets: 1, range: 90, sfx: "rifle",   rate: 1.0 },
  // snipers
  { id: "marshal", cat: "sniper",  mesh: "sniper",  price: 950,  dmg: 75, interval: 1.00, spread: 0.30, mag: 5, reload: 2.0, auto: false, pellets: 1, range: 110, sfx: "rifle",  rate: 0.8, zoom: true },
  { id: "outlaw",  cat: "sniper",  mesh: "sniper",  price: 2400, dmg: 95, interval: 0.90, spread: 0.25, mag: 2, reload: 2.3, auto: false, pellets: 1, range: 115, sfx: "rifle",  rate: 0.72, zoom: true },
  { id: "operator",cat: "sniper",  mesh: "sniper",  price: 4700, dmg: 150,interval: 1.40, spread: 0.12, mag: 5, reload: 3.0, auto: false, pellets: 1, range: 130, sfx: "rifle",  rate: 0.6, zoom: true },
  // machine guns
  { id: "ares",    cat: "lmg",     mesh: "rifle",   price: 1550, dmg: 28, interval: 0.10, spread: 2.0, mag: 50, reload: 3.0, auto: true,  pellets: 1, range: 80, sfx: "rifle",   rate: 1.0 },
  { id: "odin",    cat: "lmg",     mesh: "rifle",   price: 3200, dmg: 32, interval: 0.08, spread: 2.2, mag: 100,reload: 4.0, auto: true,  pellets: 1, range: 85, sfx: "rifle",   rate: 1.05 },
  // melee
  { id: "knife",   cat: "melee",   mesh: "knife",   price: 0,    dmg: 65, interval: 0.55, spread: 0.0, mag: 999,reload: 0,   auto: false, pellets: 1, range: 3.2, sfx: "pistol", rate: 1.4, melee: true },
];
const wIndex = id => WEAPONS.findIndex(w => w.id === id);

// Agents: one signature ability each, Q to cast, cooldown-gated. Kinds split
// into self buffs and enemy-affecting utility (see activateAbility).
const AGENTS = [
  { id: "jett",    color: 0x8fe3ff, ability: { kind: "dash",   cd: 8 } },
  { id: "sage",    color: 0x6cf0c2, ability: { kind: "heal",   cd: 14, dur: 2.0 } },
  { id: "reyna",   color: 0xc06cff, ability: { kind: "dismiss",cd: 12, dur: 2.2 } },
  { id: "raze",    color: 0xffb03a, ability: { kind: "boom",   cd: 11, r: 5.5, dmg: 85, fuse: 0.7 } },
  { id: "phoenix", color: 0xff6a3a, ability: { kind: "flash",  cd: 10, range: 22, dur: 1.7 } },
  { id: "omen",    color: 0x7a86ff, ability: { kind: "smoke",  cd: 12, r: 4.2, dur: 9 } },
];
let chosenAgent = 0;
const ABILITY = {}; AGENTS.forEach(a => ABILITY[a.ability.kind] = a.ability);   // lookup by kind
const BOT_POOL = ["sheriff", "spectre", "stinger", "bulldog", "guardian", "phantom", "vandal", "marshal", "ares"]
  .map(wIndex);

// STYLE FORMULA palette roles: environment muted, gunmetal+amber for weapons,
// signal orange for enemies/effects, cyan glow accents.
const COL = {
  gunmetal: 0x2e3238, amber: 0xffb03a, orange: 0xff7a1a, cyan: 0x4ad7e8,
  skinP: 0x3e4a55, skinE: 0x4a4038, bone: 0xe8e4da,
};

const MAPS = {
  dust: {
    sky: 0xc9dce8, fog: 0xd8cdb4, fogNear: 30, fogFar: 110,
    sun: 0xfff2dc, sunI: 1.25, amb: 0x9fb2c4, ambI: 0.85,
    floor: "sand", wall: "concrete", crate: "crate",
    accentGlow: 0xff7a1a,
    crates: [
      [0,0,6,6,2.2],[ -14,-10,4,4,2.2],[14,10,4,4,2.2],[-14,10,4,4,1.4],[14,-10,4,4,1.4],
      [-6,18,8,2.4,2.0],[6,-18,8,2.4,2.0],[-22,0,2.4,10,2.6],[22,0,2.4,10,2.6],
      [0,12,3,3,1.2],[0,-12,3,3,1.2],[-10,-22,5,2.2,1.8],[10,22,5,2.2,1.8],
    ],
  },
  neon: {
    sky: 0x232a42, fog: 0x2b3350, fogNear: 22, fogFar: 90,
    sun: 0xbfd4ff, sunI: 0.7, amb: 0x5b688a, ambI: 0.9,
    floor: "asphalt", wall: "metal", crate: "crate",
    accentGlow: 0x4ad7e8,
    crates: [
      [0,0,8,3,2.4],[-16,-8,3,8,2.4],[16,8,3,8,2.4],[-8,14,6,2.4,1.6],[8,-14,6,2.4,1.6],
      [-20,14,4,4,2.8],[20,-14,4,4,2.8],[0,20,10,2.2,2.0],[0,-20,10,2.2,2.0],
      [-9,-2,2.4,2.4,1.1],[9,2,2.4,2.4,1.1],
    ],
  },
  frost: {
    sky: 0xdfe9f2, fog: 0xe6edf4, fogNear: 26, fogFar: 95,
    sun: 0xfff8ea, sunI: 1.0, amb: 0xbcc9d6, ambI: 1.0,
    floor: "snow", wall: "metal", crate: "crate",
    accentGlow: 0x4ad7e8,
    crates: [
      [0,4,5,5,2.4],[0,-8,5,5,1.4],[-15,0,4,10,2.6],[15,0,4,10,2.6],
      [-8,-18,7,2.4,2.0],[8,18,7,2.4,2.0],[-20,-12,3,3,1.6],[20,12,3,3,1.6],
      [-6,8,2.6,2.6,1.2],[6,-2,2.6,2.6,1.2],[12,-14,4,2.2,2.2],[-12,14,4,2.2,2.2],
    ],
  },
};

const MAP_IDS = Object.keys(MAPS);
const randomMap = () => MAP_IDS[(Math.random() * MAP_IDS.length) | 0];

// squad accent colors — deterministic per player id so every client agrees
const ACCENTS = [0xff7a1a, 0xe84a4a, 0xb44ae8, 0x4ae87a, 0xe8d84a, 0x4a8ae8, 0xff5aa0];
const accentFor = id => ACCENTS[[...String(id)].reduce((a, c) => a + c.charCodeAt(0), 0) % ACCENTS.length];

/* ---------------- seeded RNG (sim only) ---------------- */
function mulberry32(a) {
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
let rng = mulberry32(1337);
const rr = (a, b) => a + (b - a) * rng();
const r2 = v => Math.round(v * 100) / 100;      // trim floats for the wire

/* ---------------- audio ---------------- */
const AudioMan = {
  ctx: null, buffers: {}, musicSrc: null, ok: false,
  async init() {
    if (this.ctx) return;
    this.ctx = new (window.AudioContext || window.webkitAudioContext)();
    const files = {
      pistol: "./assets/audio/shot_pistol.mp3",
      rifle: "./assets/audio/shot_rifle.mp3",
      shotgun: "./assets/audio/shot_shotgun.mp3",
      reload: "./assets/audio/reload.mp3",
      hit: "./assets/audio/hit.mp3",
      music: "./assets/audio/music_combat.m4a",
    };
    await Promise.all(Object.entries(files).map(async ([k, url]) => {
      try {
        const r = await fetch(url); const ab = await r.arrayBuffer();
        this.buffers[k] = await this.ctx.decodeAudioData(ab);
      } catch (e) { /* asset missing: stay silent for this clip */ }
    }));
    this.ok = true;
  },
  play(name, { vol = 0.35, rate = 1.0 } = {}) {
    if (!this.ok || !this.buffers[name] || this.ctx.state !== "running") return;
    const src = this.ctx.createBufferSource();
    src.buffer = this.buffers[name]; src.playbackRate.value = rate;
    const g = this.ctx.createGain(); g.gain.value = vol;
    src.connect(g).connect(this.ctx.destination); src.start();
  },
  at(name, dist, opts = {}) {
    const vol = (opts.vol ?? 0.35) * Math.max(0, 1 - dist / 45);
    if (vol > 0.01) this.play(name, { ...opts, vol });
  },
  music() {
    if (!this.ok || !this.buffers.music || this.musicSrc) return;
    const src = this.ctx.createBufferSource();
    src.buffer = this.buffers.music; src.loop = true;
    const g = this.ctx.createGain(); g.gain.value = 0.13;   // music sits far below SFX
    src.connect(g).connect(this.ctx.destination); src.start();
    this.musicSrc = src;
  },
  resume() { this.ctx && this.ctx.resume(); },
};

/* ---------------- input → commands ---------------- */
const isTouch = matchMedia("(hover: none), (pointer: coarse)").matches;
const BIND = { KeyW: "up", KeyS: "down", KeyA: "left", KeyD: "right", Space: "jump",
               KeyR: "reload", ShiftLeft: "zoom", ShiftRight: "zoom",
               ArrowUp: "up", ArrowDown: "down", ArrowLeft: "left", ArrowRight: "right" };
const held = new Set();
let mouseDown = false, lookDX = 0, lookDY = 0, abilityReq = false, shopOpen = false;
function toggleShop() { if (typeof shop !== "undefined") shop.toggle(); }
// never capture game keys while the player is typing (callsign input: W/A/S/D/R…)
const typing = e => e.target && (e.target.tagName === "INPUT" || e.target.tagName === "TEXTAREA");
addEventListener("keydown", e => {
  if (typing(e)) return;
  if (e.code === "KeyB") { if (!inMenu && match && !match.over) toggleShop(); e.preventDefault(); return; }
  if (e.code === "KeyQ") { abilityReq = true; e.preventDefault(); return; }
  const c = BIND[e.code]; if (c) { held.add(c); e.preventDefault(); }
});
addEventListener("keyup", e => { if (typing(e)) return; const c = BIND[e.code]; if (c) held.delete(c); });
addEventListener("mousedown", e => { if (e.button === 0) mouseDown = true; if (e.button === 2) held.add("zoom"); });
addEventListener("mouseup", e => { if (e.button === 0) mouseDown = false; if (e.button === 2) held.delete("zoom"); });
addEventListener("contextmenu", e => e.preventDefault());
addEventListener("mousemove", e => {
  if (document.pointerLockElement) { lookDX += e.movementX; lookDY += e.movementY; }
});

// touch: left stick element + right-half drag look + buttons
const touchState = { mx: 0, my: 0, fire: false, jump: false, reload: false };
function setupTouch() {
  if (!isTouch) return;
  document.getElementById("touchUI").style.display = "block";
  const stick = document.getElementById("stick"), knob = document.getElementById("knob");
  let stickId = null, lookId = null, lookLast = null;
  const sRect = () => stick.getBoundingClientRect();
  addEventListener("touchstart", e => {
    for (const t of e.changedTouches) {
      const r = sRect();
      if (t.clientX >= r.left - 20 && t.clientX <= r.right + 20 && t.clientY >= r.top - 20 && t.clientY <= r.bottom + 20 && stickId === null) {
        stickId = t.identifier;
      } else if (t.clientX > innerWidth * 0.45 && lookId === null &&
                 !e.target.classList?.contains("tbtn")) {
        lookId = t.identifier; lookLast = { x: t.clientX, y: t.clientY };
      }
    }
    e.preventDefault();
  }, { passive: false });
  addEventListener("touchmove", e => {
    for (const t of e.changedTouches) {
      if (t.identifier === stickId) {
        const r = sRect(), cx = r.left + r.width / 2, cy = r.top + r.height / 2;
        let dx = (t.clientX - cx) / (r.width / 2), dy = (t.clientY - cy) / (r.height / 2);
        const m = Math.hypot(dx, dy); if (m > 1) { dx /= m; dy /= m; }
        touchState.mx = dx; touchState.my = dy;
        knob.style.left = 38 + dx * 34 + "px"; knob.style.top = 38 + dy * 34 + "px";
      } else if (t.identifier === lookId) {
        lookDX += (t.clientX - lookLast.x) * 2.2; lookDY += (t.clientY - lookLast.y) * 2.2;
        lookLast = { x: t.clientX, y: t.clientY };
      }
    }
    e.preventDefault();
  }, { passive: false });
  const endT = e => {
    for (const t of e.changedTouches) {
      if (t.identifier === stickId) { stickId = null; touchState.mx = touchState.my = 0; knob.style.left = "38px"; knob.style.top = "38px"; }
      if (t.identifier === lookId) lookId = null;
    }
  };
  addEventListener("touchend", endT); addEventListener("touchcancel", endT);
  const btn = (id, on, off) => {
    const el = document.getElementById(id);
    el.addEventListener("touchstart", e => { on(); e.preventDefault(); e.stopPropagation(); }, { passive: false });
    el.addEventListener("touchend", e => { off && off(); e.preventDefault(); e.stopPropagation(); }, { passive: false });
  };
  btn("fireBtn", () => touchState.fire = true, () => touchState.fire = false);
  btn("jumpBtn", () => touchState.jump = true, () => touchState.jump = false);
  btn("reloadBtn", () => touchState.reload = true, () => touchState.reload = false);
  btn("abilityBtn", () => abilityReq = true);
  btn("shopBtn", () => { if (!inMenu && match && !match.over) toggleShop(); });
}

function padState() {
  const out = { mx: 0, my: 0, lx: 0, ly: 0, fire: false, jump: false, reload: false, zoom: false };
  for (const gp of navigator.getGamepads?.() ?? []) {
    if (!gp) continue;
    const dz = v => Math.abs(v) > 0.18 ? v : 0;
    out.mx += dz(gp.axes[0] || 0); out.my += dz(gp.axes[1] || 0);
    out.lx += dz(gp.axes[2] || 0); out.ly += dz(gp.axes[3] || 0);
    if (gp.buttons[7]?.pressed) out.fire = true;      // RT
    if (gp.buttons[0]?.pressed) out.jump = true;      // A
    if (gp.buttons[2]?.pressed) out.reload = true;    // X
    if (gp.buttons[6]?.pressed) out.zoom = true;      // LT
    if (gp.buttons[3]?.pressed) out.ability = true;   // Y
  }
  return out;
}

const NEUTRAL_CMDS = { mx: 0, my: 0, fire: false, jump: false, reload: false, zoom: false, ability: false, lookGX: 0, lookGY: 0 };
function commands() {
  if (shopOpen) return NEUTRAL_CMDS;                  // browsing the buy menu = no movement/fire
  const gp = padState();
  const ability = abilityReq || touchState.ability || gp.ability; abilityReq = false;
  let mx = (held.has("right") ? 1 : 0) - (held.has("left") ? 1 : 0) + touchState.mx + gp.mx;
  let my = (held.has("down") ? 1 : 0) - (held.has("up") ? 1 : 0) + touchState.my + gp.my;
  const m = Math.hypot(mx, my); if (m > 1) { mx /= m; my /= m; }
  return {
    mx, my, ability,
    fire: mouseDown || touchState.fire || gp.fire,
    jump: held.has("jump") || touchState.jump || gp.jump,
    reload: held.has("reload") || touchState.reload || gp.reload,
    zoom: held.has("zoom") || gp.zoom,
    lookGX: gp.lx, lookGY: gp.ly,
  };
}

/* ---------------- renderer / scene ---------------- */
const canvas = document.getElementById("c");
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: "high-performance" });
renderer.outputColorSpace = THREE.SRGBColorSpace;
const camera = new THREE.PerspectiveCamera(CFG.fov, 1, 0.05, 300);
let scene = null;

function resize() {
  const dpr = Math.min(devicePixelRatio || 1, CFG.dprCap);
  renderer.setPixelRatio(dpr);
  renderer.setSize(innerWidth, innerHeight);
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
}
addEventListener("resize", resize); addEventListener("orientationchange", resize); resize();

/* ---------------- procedural fx textures (embed the formula's key colors) ---------------- */
function canvasTex(draw, size = 64) {
  const cv = document.createElement("canvas"); cv.width = cv.height = size;
  draw(cv.getContext("2d"), size);
  const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace;
  return t;
}
const flashTex = canvasTex((ctx, s) => {
  const g = ctx.createRadialGradient(s/2, s/2, 2, s/2, s/2, s/2);
  g.addColorStop(0, "rgba(255,240,200,1)"); g.addColorStop(0.35, "rgba(255,176,58,0.9)");
  g.addColorStop(0.7, "rgba(255,122,26,0.45)"); g.addColorStop(1, "rgba(255,122,26,0)");
  ctx.fillStyle = g; ctx.fillRect(0, 0, s, s);
});
const puffTex = canvasTex((ctx, s) => {
  const g = ctx.createRadialGradient(s/2, s/2, 1, s/2, s/2, s/2);
  g.addColorStop(0, "rgba(255,150,80,0.95)"); g.addColorStop(0.5, "rgba(255,122,26,0.5)");
  g.addColorStop(1, "rgba(255,122,26,0)");
  ctx.fillStyle = g; ctx.fillRect(0, 0, s, s);
});
const blobTex = canvasTex((ctx, s) => {
  const g = ctx.createRadialGradient(s/2, s/2, 1, s/2, s/2, s/2);
  g.addColorStop(0, "rgba(0,0,0,0.4)"); g.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = g; ctx.fillRect(0, 0, s, s);
});

/* ---------------- geometry/material caches ---------------- */
const texLoader = new THREE.TextureLoader();
function tile(url, rx, ry) {
  const t = texLoader.load(url);
  t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(rx, ry);
  t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
  return t;
}
const boxGeo = new THREE.BoxGeometry(1, 1, 1);
const mat = (c, opts = {}) => new THREE.MeshLambertMaterial({ color: c, ...opts });

/* ---------------- character + gun models (procedural, per manifest) ---------------- */
function makeGunMesh(shape, world) {
  const g = new THREE.Group();
  const gm = mat(COL.gunmetal), am = mat(COL.amber), wd = mat(0x7a5b3a);
  const add = (m, x, y, z, sx, sy, sz) => {
    const b = new THREE.Mesh(boxGeo, m); b.position.set(x, y, z); b.scale.set(sx, sy, sz); g.add(b); return b;
  };
  switch (shape) {
    case "pistol":
      add(gm, 0, 0, -0.12, 0.05, 0.07, 0.24); add(gm, 0, -0.08, 0.0, 0.045, 0.12, 0.07);
      add(am, 0, 0.045, -0.22, 0.015, 0.015, 0.03); break;
    case "smg":
      add(gm, 0, 0, -0.18, 0.06, 0.09, 0.4); add(gm, 0, -0.12, -0.05, 0.05, 0.16, 0.07);
      add(gm, 0, -0.05, 0.12, 0.05, 0.09, 0.12); add(am, 0, 0.06, -0.3, 0.02, 0.02, 0.05); break;
    case "shotgun":
      add(gm, 0, 0, -0.25, 0.06, 0.08, 0.62); add(wd, 0, -0.07, -0.32, 0.07, 0.06, 0.2);
      add(wd, 0, -0.04, 0.18, 0.06, 0.12, 0.16); add(am, 0, 0.055, -0.5, 0.015, 0.015, 0.03); break;
    case "rifle":
      add(gm, 0, 0, -0.25, 0.055, 0.09, 0.68); add(gm, 0, -0.12, 0.0, 0.05, 0.16, 0.07);
      add(gm, 0, -0.05, 0.2, 0.05, 0.1, 0.16); add(am, 0, 0.07, -0.18, 0.03, 0.035, 0.09); break;
    case "sniper":
      add(gm, 0, 0, -0.35, 0.05, 0.08, 0.95); add(gm, 0, -0.11, 0.05, 0.05, 0.14, 0.07);
      add(gm, 0, -0.04, 0.28, 0.05, 0.1, 0.18);
      add(mat(COL.cyan, { emissive: COL.cyan, emissiveIntensity: 0.7 }), 0, 0.08, -0.1, 0.035, 0.035, 0.14); break;
    case "knife":
      add(wd, 0, -0.05, 0.06, 0.03, 0.07, 0.12);                          // grip
      add(mat(0xcdd3da), 0, 0.02, -0.16, 0.012, 0.055, 0.3);              // blade
      add(am, 0, -0.02, 0.0, 0.02, 0.02, 0.04); break;                    // guard
  }
  if (world) g.scale.setScalar(1.15);
  // muzzle anchor
  const muzzle = new THREE.Object3D();
  muzzle.position.set(0, 0.01, shape === "sniper" ? -0.85 : shape === "shotgun" ? -0.58
    : shape === "pistol" ? -0.26 : shape === "knife" ? -0.3 : -0.6);
  g.add(muzzle); g.userData.muzzle = muzzle;
  return g;
}

// Third-person trooper: jointed low-poly figure built from one shared box geo.
// Feet sit at y=0; the whole group is placed at the entity's position. Joint
// groups (legL/legR at the hip, armL/armR at the shoulder) are what render()
// animates — everything else is detail welded to torso/head.
function makeSoldier(accent) {
  const g = new THREE.Group();
  const fatigue = mat(0x5b5446);                                   // olive uniform
  const gear    = mat(0x2b2e34);                                   // vest / webbing
  const bootMat = mat(0x181a1e);                                   // boots / gloves
  const skin    = mat(0xbf9c84);                                   // exposed skin
  const acc     = mat(accent, { emissive: accent, emissiveIntensity: 0.5 });
  const accDim  = mat(accent, { emissive: accent, emissiveIntensity: 0.22 });
  const visor   = new THREE.MeshLambertMaterial({ color: 0x10131a, emissive: accent, emissiveIntensity: 0.14 });
  const part = (m, x, y, z, sx, sy, sz, parent = g) => {
    const b = new THREE.Mesh(boxGeo, m); b.position.set(x, y, z); b.scale.set(sx, sy, sz); parent.add(b); return b;
  };

  // ---- legs: hip-pivoted groups (thigh → knee → shin → boot) ----
  const mkLeg = side => {
    const grp = new THREE.Group(); grp.position.set(side * 0.17, 0.92, 0); g.add(grp);
    part(fatigue, 0, -0.22, 0, 0.23, 0.46, 0.25, grp);            // thigh
    part(gear,    0, -0.45, 0.02, 0.21, 0.10, 0.24, grp);         // knee pad
    part(fatigue, 0, -0.66, 0, 0.18, 0.40, 0.20, grp);            // shin
    part(bootMat, 0, -0.90, 0.04, 0.22, 0.15, 0.32, grp);         // boot
    return grp;
  };
  const legL = mkLeg(-1), legR = mkLeg(1);

  // ---- pelvis / belt ----
  part(gear,   0, 0.98, 0, 0.46, 0.18, 0.30);
  part(accDim, 0, 0.98, 0.17, 0.12, 0.10, 0.04);                  // buckle

  // ---- torso: tapered (narrow waist, broad chest + vest) ----
  part(fatigue, 0, 1.12, 0, 0.40, 0.18, 0.26);                    // waist
  const torso = part(fatigue, 0, 1.30, 0, 0.48, 0.46, 0.28);      // chest
  part(gear,    0, 1.32, 0.03, 0.52, 0.42, 0.30);                 // plate carrier
  part(acc,     0, 1.34, 0.18, 0.10, 0.24, 0.03);                 // team stripe
  part(gear,    0, 1.16, 0.16, 0.30, 0.12, 0.06);                 // ammo pouches
  part(gear,    0, 1.30, -0.21, 0.34, 0.42, 0.15);               // backpack
  part(accDim,  0, 1.46, -0.24, 0.10, 0.07, 0.04);               // pack tab

  // ---- neck + head + helmet ----
  part(skin,  0, 1.55, 0, 0.16, 0.11, 0.16);                      // neck
  const head = part(skin, 0, 1.67, 0.01, 0.26, 0.27, 0.26);      // head
  part(visor, 0, 1.68, -0.09, 0.28, 0.13, 0.16);                 // goggles
  part(gear,  0, 1.80, -0.01, 0.31, 0.18, 0.33);                // helmet
  part(gear,  0, 1.73, 0.13, 0.30, 0.07, 0.10);                 // brim
  part(acc,   0, 1.86, 0, 0.32, 0.05, 0.34);                    // helmet band

  // ---- arms: shoulder-pivoted (pauldron → upper → elbow → forearm → glove) ----
  const mkArm = side => {
    const grp = new THREE.Group(); grp.position.set(side * 0.33, 1.45, 0); g.add(grp);
    part(acc,     side * 0.02, 0.04, 0, 0.20, 0.17, 0.25, grp);   // team pauldron
    part(fatigue, 0, -0.19, 0, 0.15, 0.34, 0.17, grp);           // upper arm
    part(gear,    0, -0.39, 0, 0.14, 0.10, 0.16, grp);           // elbow
    part(fatigue, 0, -0.55, 0, 0.13, 0.28, 0.15, grp);           // forearm
    part(bootMat, 0, -0.71, 0.03, 0.15, 0.15, 0.19, grp);        // glove
    return grp;
  };
  const armL = mkArm(-1), armR = mkArm(1);

  // gun holder at the right hand; the PI/2 tilt points the world gun's barrel
  // forward once the arm is raised to aim (fixes it aiming skyward otherwise).
  const gunHold = new THREE.Group();
  gunHold.position.set(0.05, -0.66, -0.04); gunHold.rotation.x = Math.PI / 2;
  armR.add(gunHold);

  // blob shadow
  const blob = new THREE.Sprite(new THREE.SpriteMaterial({ map: blobTex, depthWrite: false }));
  blob.scale.set(1.5, 1.5, 1); blob.position.y = 0.02; blob.center.set(0.5, 0.5);
  g.add(blob);
  return { group: g, torso, head, armL, armR, legL, legR, gunHold, blob };
}

/* ---------------- world ---------------- */
let world = null; // { solids:[{min,max}], waypoints:[], spawns:[], meshes, mapId }

function buildWorld(mapId) {
  const M = MAPS[mapId];
  scene = new THREE.Scene();
  scene.background = new THREE.Color(M.sky);
  scene.fog = new THREE.Fog(M.fog, M.fogNear, M.fogFar);

  const sun = new THREE.DirectionalLight(M.sun, M.sunI); sun.position.set(30, 50, 20); scene.add(sun);
  scene.add(new THREE.HemisphereLight(M.sky, 0x44403a, M.ambI));
  scene.add(new THREE.AmbientLight(M.amb, 0.25));

  const S = CFG.arena.size, H = CFG.arena.wallH;
  const floorMat = new THREE.MeshLambertMaterial({ map: tile(`./assets/textures/${M.floor}.png`, S / 6, S / 6) });
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(S, S), floorMat);
  floor.rotation.x = -Math.PI / 2; scene.add(floor);

  const wallMat = new THREE.MeshLambertMaterial({ map: tile(`./assets/textures/${M.wall}.png`, S / 4, H / 4) });
  const solids = [];
  const wall = (x, z, sx, sz) => {
    const m = new THREE.Mesh(boxGeo, wallMat);
    m.position.set(x, H / 2, z); m.scale.set(sx, H, sz); scene.add(m);
    solids.push({ min: { x: x - sx / 2, y: 0, z: z - sz / 2 }, max: { x: x + sx / 2, y: H, z: z + sz / 2 } });
  };
  const h = S / 2, t = 1;
  wall(0, -h, S + t, t); wall(0, h, S + t, t); wall(-h, 0, t, S); wall(h, 0, t, S);

  const crateMat = new THREE.MeshLambertMaterial({ map: tile(`./assets/textures/${M.crate}.png`, 1, 1) });
  for (const [x, z, sx, sz, sy] of M.crates) {
    const m = new THREE.Mesh(boxGeo, crateMat);
    m.position.set(x, sy / 2, z); m.scale.set(sx, sy, sz); scene.add(m);
    solids.push({ min: { x: x - sx / 2, y: 0, z: z - sz / 2 }, max: { x: x + sx / 2, y: sy, z: z + sz / 2 } });
  }

  // cyan/orange glow strips on walls (map accent, cheap emissive boxes)
  const glow = new THREE.MeshBasicMaterial({ color: M.accentGlow });
  for (const [x, z, sx, sz] of [[0, -h + 0.6, 10, 0.15], [0, h - 0.6, 10, 0.15], [-h + 0.6, 0, 0.15, 10], [h - 0.6, 0, 0.15, 10]]) {
    const m = new THREE.Mesh(boxGeo, glow);
    m.position.set(x, 2.6, z); m.scale.set(Math.max(sx, 0.15), 0.12, Math.max(sz, 0.15)); scene.add(m);
  }

  // waypoints: clear lattice points
  const waypoints = [];
  for (let x = -h + 4; x <= h - 4; x += 4)
    for (let z = -h + 4; z <= h - 4; z += 4)
      if (!pointInSolid(x, z, 1.0, solids)) waypoints.push({ x, z });

  const spawns = [
    { x: -h + 5, z: -h + 5 }, { x: h - 5, z: h - 5 }, { x: -h + 5, z: h - 5 }, { x: h - 5, z: -h + 5 },
    { x: 0, z: -h + 5 }, { x: 0, z: h - 5 }, { x: -h + 5, z: 0 }, { x: h - 5, z: 0 },
  ].filter(s => !pointInSolid(s.x, s.z, 1.2, solids));

  world = { solids, waypoints, spawns, mapId };
}

function pointInSolid(x, z, r, solids = world.solids) {
  for (const s of solids)
    if (x > s.min.x - r && x < s.max.x + r && z > s.min.z - r && z < s.max.z + r) return true;
  return false;
}

// circle vs AABB resolve on XZ
function collide(pos, r) {
  for (const s of world.solids) {
    if (pos.y > s.max.y) continue;
    const cx = Math.max(s.min.x, Math.min(pos.x, s.max.x));
    const cz = Math.max(s.min.z, Math.min(pos.z, s.max.z));
    const dx = pos.x - cx, dz = pos.z - cz;
    const d2 = dx * dx + dz * dz;
    if (d2 < r * r) {
      if (d2 > 1e-9) {
        const d = Math.sqrt(d2); pos.x = cx + dx / d * r; pos.z = cz + dz / d * r;
      } else {
        // inside: push out along smallest overlap
        const px = Math.min(pos.x - s.min.x + r, s.max.x + r - pos.x);
        const pz = Math.min(pos.z - s.min.z + r, s.max.z + r - pos.z);
        if (px < pz) pos.x = pos.x - s.min.x + r < s.max.x + r - pos.x ? s.min.x - r : s.max.x + r;
        else pos.z = pos.z - s.min.z + r < s.max.z + r - pos.z ? s.min.z - r : s.max.z + r;
      }
    }
  }
  const lim = CFG.arena.size / 2 - 0.8;
  pos.x = Math.max(-lim, Math.min(lim, pos.x));
  pos.z = Math.max(-lim, Math.min(lim, pos.z));
}

// ray vs solids: returns nearest t or Infinity
function raySolids(ox, oy, oz, dx, dy, dz, maxT) {
  let best = maxT;
  for (const s of world.solids) {
    let t0 = 0, t1 = best, ok = true;
    for (const [o, d, mn, mx] of [[ox, dx, s.min.x, s.max.x], [oy, dy, s.min.y, s.max.y], [oz, dz, s.min.z, s.max.z]]) {
      if (Math.abs(d) < 1e-9) { if (o < mn || o > mx) { ok = false; break; } continue; }
      let ta = (mn - o) / d, tb = (mx - o) / d;
      if (ta > tb) [ta, tb] = [tb, ta];
      t0 = Math.max(t0, ta); t1 = Math.min(t1, tb);
      if (t0 > t1) { ok = false; break; }
    }
    if (ok && t0 < best && t0 > 0) best = t0;
  }
  return best;
}

function raySphere(ox, oy, oz, dx, dy, dz, cx, cy, cz, r) {
  const lx = cx - ox, ly = cy - oy, lz = cz - oz;
  const tca = lx * dx + ly * dy + lz * dz;
  if (tca < 0) return Infinity;
  const d2 = lx * lx + ly * ly + lz * lz - tca * tca;
  if (d2 > r * r) return Infinity;
  return tca - Math.sqrt(r * r - d2);
}

function hasLOS(a, b) {
  const ax = a.pos.x, ay = a.pos.y + CFG.player.eye, az = a.pos.z;
  const bx = b.pos.x, by = b.pos.y + 1.2, bz = b.pos.z;
  const dx = bx - ax, dy = by - ay, dz = bz - az;
  const dist = Math.hypot(dx, dy, dz);
  if (smokeBlocks(ax, ay, az, dx / dist, dy / dist, dz / dist, dist)) return false;  // smoke hides you
  return raySolids(ax, ay, az, dx / dist, dy / dist, dz / dist, dist) >= dist - 0.01;
}

/* ---------------- effects pools ---------------- */
const tracers = [], puffs = [], flashes = [];
function initFx() {
  tracers.length = 0; puffs.length = 0; flashes.length = 0;
  const tGeo = new THREE.BufferGeometry();
  for (let i = 0; i < 24; i++) {
    const g = tGeo.clone();
    g.setAttribute("position", new THREE.BufferAttribute(new Float32Array(6), 3));
    const l = new THREE.Line(g, new THREE.LineBasicMaterial({ color: COL.amber, transparent: true, opacity: 0.9 }));
    l.visible = false; l.frustumCulled = false; scene.add(l);
    tracers.push({ l, ttl: 0 });
  }
  for (let i = 0; i < 32; i++) {
    const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: puffTex, transparent: true, depthWrite: false }));
    sp.visible = false; scene.add(sp);
    puffs.push({ sp, ttl: 0 });
  }
}
function spawnTracer(ax, ay, az, bx, by, bz) {
  const t = tracers.find(t => t.ttl <= 0); if (!t) return;
  const p = t.l.geometry.attributes.position.array;
  p[0] = ax; p[1] = ay; p[2] = az; p[3] = bx; p[4] = by; p[5] = bz;
  t.l.geometry.attributes.position.needsUpdate = true;
  t.l.visible = true; t.ttl = 0.06;
}
function spawnPuff(x, y, z, big) {
  const p = puffs.find(p => p.ttl <= 0); if (!p) return;
  p.sp.position.set(x, y, z); p.sp.scale.setScalar(big ? 0.9 : 0.45);
  p.sp.material.opacity = 1; p.sp.visible = true; p.ttl = 0.25;
}
function fxUpdate(dt) {
  for (const t of tracers) if (t.ttl > 0) { t.ttl -= dt; if (t.ttl <= 0) t.l.visible = false; }
  for (const p of puffs) if (p.ttl > 0) {
    p.ttl -= dt; p.sp.material.opacity = Math.max(0, p.ttl / 0.25); p.sp.scale.multiplyScalar(1.04);
    if (p.ttl <= 0) p.sp.visible = false;
  }
  for (const f of flashes) if (f.ttl > 0) { f.ttl -= dt; f.sp.visible = f.ttl > 0; }
}

/* ---------------- entities ---------------- */
let ents = [], player = null, match = null;

function makeEntity(name, isPlayer, accent) {
  const e = {
    name, isPlayer, accent,
    pos: { x: 0, y: 0, z: 0 }, vel: { x: 0, y: 0, z: 0 },
    yaw: 0, pitch: 0, hp: CFG.player.hp, alive: true,
    weapon: 0, totalKills: 0, deaths: 0, credits: 0, agent: 0,
    fireCd: 0, reloadT: 0, ammo: WEAPONS[0].mag,
    respawnT: 0, lastHurtT: -99, walkPhase: 0, moving: false, speed2d: 0,
    // abilities
    abilityCd: 0, healT: 0, speedT: 0, speedFactor: 1, invulnT: 0, flashedT: 0,
    // bot brain
    target: null, wp: null, repathT: 0, reactT: 0, strafeDir: 1, strafeT: 0,
    model: null, guns: null, muzzleSp: null,
  };
  if (!isPlayer) {
    e.model = makeSoldier(accent);
    e.guns = WEAPONS.map(w => {
      const g = makeGunMesh(w.mesh, true); g.visible = false;
      e.model.gunHold.add(g); return g;
    });
    e.guns[0].visible = true;
    const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: flashTex, transparent: true, depthWrite: false }));
    sp.scale.setScalar(0.7); sp.visible = false;
    e.guns.forEach(g => {});
    e.muzzleSp = sp; scene.add(sp);
    flashes.push({ sp, ttl: 0 });
    scene.add(e.model.group);
  }
  return e;
}

function progress(e) { return e.totalKills; }        // deathmatch standing = kills

function spawnEntity(e) {
  // farthest spawn from living enemies
  let best = null, bestD = -1;
  for (const s of world.spawns) {
    let d = Infinity;
    for (const o of ents) if (o !== e && o.alive) d = Math.min(d, Math.hypot(s.x - o.pos.x, s.z - o.pos.z));
    if (d === Infinity) d = 100 + rng() * 10;
    if (d > bestD) { bestD = d; best = s; }
  }
  e.pos.x = best.x + rr(-1.5, 1.5); e.pos.z = best.z + rr(-1.5, 1.5); e.pos.y = 0;
  e.vel = { x: 0, y: 0, z: 0 };
  e.hp = CFG.player.hp; e.alive = true;
  e.ammo = WEAPONS[e.weapon].mag; e.reloadT = 0; e.fireCd = 0.3;
  e.yaw = Math.atan2(-e.pos.x, -e.pos.z);
  e.target = null; e.wp = null; e.reactT = 0;
  e.healT = e.speedT = e.invulnT = e.flashedT = 0; e.speedFactor = 1;   // clear buffs/debuffs on respawn
  if (e.model) e.model.group.visible = true;
}

/* ---------------- shooting ---------------- */
function fireWeapon(sh) {
  const w = WEAPONS[sh.weapon];
  sh.fireCd = w.interval; if (!w.melee) sh.ammo--;
  const eye = sh.pos.y + (sh.isPlayer ? CFG.player.eye : 1.55);
  const spreadBase = w.spread * (sh.isPlayer ? 1 : CFG.bot.spreadMul);
  const dist0 = sh.isPlayer ? 0.2 : 0.6;

  // velocity-scaled accuracy: inaccuracy grows with speed, worst airborne
  const moveErr = sh.isPlayer
    ? 1.7 * Math.min(1, (sh.speed2d ?? 0) / CFG.player.speed) + (sh.pos.y > 0.05 ? 1.5 : 0)
    : 0;

  const hitAcc = sh.isPlayer && match.online ? new Map() : null;  // remote target -> dmg this trigger pull
  for (let p = 0; p < w.pellets; p++) {
    const sp = (spreadBase + moveErr) * Math.PI / 180;
    const ry = sh.yaw + rr(-sp, sp), rp = sh.pitch + rr(-sp, sp);
    const dx = -Math.sin(ry) * Math.cos(rp), dy = Math.sin(rp), dz = -Math.cos(ry) * Math.cos(rp);
    const ox = sh.pos.x + dx * dist0, oy = eye + dy * dist0, oz = sh.pos.z + dz * dist0;

    let tWall = raySolids(ox, oy, oz, dx, dy, dz, w.range);
    let hitEnt = null, tHit = tWall;
    for (const e of ents) {
      if (e === sh || !e.alive) continue;
      const tb = raySphere(ox, oy, oz, dx, dy, dz, e.pos.x, e.pos.y + 1.0, e.pos.z, 0.55);
      const th = raySphere(ox, oy, oz, dx, dy, dz, e.pos.x, e.pos.y + 1.68, e.pos.z, 0.28);
      const t = Math.min(tb, th);
      if (t < tHit) { tHit = t; hitEnt = e; }
    }
    const hx = ox + dx * tHit, hy = oy + dy * tHit, hz = oz + dz * tHit;
    if (p === 0 || p % 3 === 0) spawnTracer(ox, oy - 0.12, oz, hx, hy, hz);
    if (hitEnt) {
      let dmg = w.dmg * (sh.isPlayer ? 1 : CFG.bot.dmgMul);
      if (w.pellets > 1) {
        const falloff = Math.max(0.35, 1 - tHit / w.range);
        dmg *= falloff;
      }
      if (hitAcc && hitEnt.remote) hitAcc.set(hitEnt, (hitAcc.get(hitEnt) || 0) + dmg);
      else damage(hitEnt, dmg, sh);
      spawnPuff(hx, hy, hz, false);
    } else if (tHit < w.range) {
      spawnPuff(hx, hy, hz, false);
    }
  }
  if (hitAcc && hitAcc.size) {
    for (const [tgt, dmg] of hitAcc) NET.send({ t: "hit", target: tgt.nid, d: Math.round(dmg) });
    hud.hitmark(); AudioMan.play("hit", { vol: 0.3 });
  }
  if (sh.isPlayer && match.online) NET.send({ t: "f" });

  // muzzle flash + sound
  if (sh.isPlayer) {
    vm.flashT = 0.05; vm.recoil = Math.min(1, vm.recoil + (w.pellets > 1 ? 0.9 : 0.45));
    AudioMan.play(w.sfx, { vol: 0.4, rate: w.rate });
  } else {
    const f = flashes.find(f => f.sp === sh.muzzleSp);
    if (f) {
      const g = sh.guns[sh.weapon];
      const m = g.userData.muzzle.getWorldPosition(new THREE.Vector3());
      sh.muzzleSp.position.copy(m); f.ttl = 0.05; sh.muzzleSp.visible = true;
    }
    const d = Math.hypot(sh.pos.x - player.pos.x, sh.pos.z - player.pos.z);
    AudioMan.at(w.sfx, d, { vol: 0.32, rate: w.rate });
  }
  if (!w.melee && sh.ammo <= 0) startReload(sh);
}

function startReload(e) {
  const w = WEAPONS[e.weapon];
  if (w.melee || e.reloadT > 0 || e.ammo === w.mag) return;
  e.reloadT = w.reload;
  if (e.isPlayer) AudioMan.play("reload", { vol: 0.35 });
  else AudioMan.at("reload", Math.hypot(e.pos.x - player.pos.x, e.pos.z - player.pos.z), { vol: 0.3 });
}

function damage(victim, dmg, attacker) {
  if (!victim.alive || match.over) return;
  if (victim.invulnT > 0) { if (attacker.isPlayer) hud.hitmark(); return; }   // Reyna dismiss
  victim.hp -= dmg; victim.lastHurtT = match.t;
  if (attacker.isPlayer) { hud.hitmark(); AudioMan.play("hit", { vol: 0.3 }); }
  if (victim.isPlayer) hud.hurt();
  if (victim.hp <= 0) kill(victim, attacker);
}

// solo/offline kill resolution (online kills are resolved by the server → applyKillMsg)
function kill(victim, attacker) {
  victim.alive = false; victim.deaths++;
  victim.respawnT = victim.isPlayer ? CFG.player.respawn : CFG.bot.respawn;
  if (victim.model) victim.model.group.visible = false;
  spawnPuff(victim.pos.x, victim.pos.y + 1.1, victim.pos.z, true);
  if (attacker && attacker !== victim) {
    attacker.totalKills++;
    attacker.credits = Math.min(CFG.maxCredits, attacker.credits + CFG.killReward);
  }
  hud.feed(STR.feed.killed.replace("{a}", attacker ? attacker.name : "—").replace("{b}", victim.name),
           attacker?.isPlayer || victim.isPlayer);
  if (attacker?.isPlayer) hud.killBanner(victim.name);
  if (victim.isPlayer) hud.center(STR.hud.killedBy.replace("{name}", attacker ? attacker.name : "—"), 2);
  if (attacker && attacker.totalKills >= CFG.killTarget) endMatch(attacker);
}

/* ---------------- weapon equip / buy ---------------- */
function equipWeapon(e, idx) {
  idx = Math.max(0, Math.min(WEAPONS.length - 1, idx | 0));
  e.weapon = idx; e.ammo = WEAPONS[idx].mag; e.reloadT = 0; e.fireCd = 0.05;
  if (e.isPlayer) vm.switchTo(idx);
  else if (e.guns) e.guns.forEach((g, i) => g.visible = i === idx);
}
function buyWeapon(idx) {
  const w = WEAPONS[idx];
  if (!player || match?.over) return false;
  if (idx === player.weapon) return false;
  if (player.credits < w.price) { AudioMan.play("hit", { vol: 0.12, rate: 0.7 }); return false; }
  player.credits -= w.price;
  equipWeapon(player, idx);
  AudioMan.play("reload", { vol: 0.3 });
  shop.refresh();
  return true;
}

/* ---------------- abilities (self buffs + enemy utility) ---------------- */
const smokes = [];   // { mesh, ttl, x, y, z, r }
const booms = [];    // { x, y, z, fuse, r, dmg, ownerEnt, ownerNid, online }

// forward point where an aimed ability lands (stops at the first wall)
function aimPoint(e, maxDist) {
  const dx = -Math.sin(e.yaw) * Math.cos(e.pitch), dy = Math.sin(e.pitch), dz = -Math.cos(e.yaw) * Math.cos(e.pitch);
  const eye = e.pos.y + CFG.player.eye;
  const t = Math.min(raySolids(e.pos.x, eye, e.pos.z, dx, dy, dz, maxDist) - 0.3, maxDist);
  return { x: e.pos.x + dx * t, y: Math.max(0.4, eye + dy * t), z: e.pos.z + dz * t };
}

function activateAbility(e) {
  if (!e.alive || e.abilityCd > 0) return;
  const ab = AGENTS[e.agent].ability;
  e.abilityCd = ab.cd;
  switch (ab.kind) {
    case "dash": {
      const dx = -Math.sin(e.yaw), dz = -Math.cos(e.yaw);
      e.pos.x += dx * 6.5; e.pos.z += dz * 6.5; collide(e.pos, CFG.player.radius);
      e.vel.x += dx * 4; e.vel.z += dz * 4;
      spawnPuff(e.pos.x, e.pos.y + 1, e.pos.z, false);
      break;
    }
    case "heal":    e.healT = ab.dur; break;
    case "dismiss": e.invulnT = ab.dur; e.speedT = ab.dur; e.speedFactor = 1.35; break;
    case "boom":    castBoom(e, ab); break;
    case "flash":   castFlash(e, ab); break;
    case "smoke":   castSmoke(e, ab); break;
  }
  if (e.isPlayer) { AudioMan.play("reload", { vol: 0.25, rate: 1.3 }); hud.abilityFx(); }
}

function castBoom(e, ab) {
  const p = aimPoint(e, 24);
  spawnBoom(p.x, p.y, p.z, ab, match.online ? e.nid : null, match.online ? null : e);
  if (match.online) NET.send({ t: "ab", kind: "boom", x: r2(p.x), y: r2(p.y), z: r2(p.z) });
}
function spawnBoom(x, y, z, ab, ownerNid, ownerEnt) {
  booms.push({ x, y, z, fuse: ab.fuse, r: ab.r, dmg: ab.dmg, ownerNid, ownerEnt, online: match.online });
}
function detonateBoom(b) {
  spawnPuff(b.x, b.y, b.z, true); spawnPuff(b.x, b.y + 0.6, b.z, true);
  if (b.online) {
    if (player.alive && dist3(player.pos.x, player.pos.y + 1, player.pos.z, b.x, b.y, b.z) < b.r) {
      const d = b.dmg * falloff(player, b);
      if (player.invulnT <= 0) {
        player.hp -= d; player.lastHurtT = match.t; hud.hurt();
        if (player.hp <= 0) playerDie(b.ownerNid);
      }
    }
  } else {
    for (const e of ents) {
      if (!e.alive) continue;
      if (dist3(e.pos.x, e.pos.y + 1, e.pos.z, b.x, b.y, b.z) < b.r) damage(e, b.dmg * falloff(e, b), b.ownerEnt);
    }
  }
}
const dist3 = (ax, ay, az, bx, by, bz) => Math.hypot(ax - bx, ay - by, az - bz);
const falloff = (e, b) => Math.max(0.35, 1 - dist3(e.pos.x, e.pos.y + 1, e.pos.z, b.x, b.y, b.z) / b.r);

function castFlash(e, ab) {
  const p = aimPoint(e, ab.range);
  if (match.online) {
    NET.send({ t: "ab", kind: "flash", x: r2(p.x), y: r2(p.y), z: r2(p.z) });
  } else {
    for (const o of ents) if (o !== e && o.alive) tryFlash(o, p, ab);
  }
}
// blind o if it is looking toward the flash point, within range and has LOS
function tryFlash(o, p, ab) {
  const d = Math.hypot(o.pos.x - p.x, o.pos.z - p.z);
  if (d > ab.range) return;
  const vx = -Math.sin(o.yaw), vz = -Math.cos(o.yaw);
  const tx = (p.x - o.pos.x) / (d || 1), tz = (p.z - o.pos.z) / (d || 1);
  if (vx * tx + vz * tz < 0.15) return;                        // not facing it
  const eye = o.pos.y + (o.isPlayer ? CFG.player.eye : 1.55);
  const ddx = p.x - o.pos.x, ddy = p.y - eye, ddz = p.z - o.pos.z, dd = Math.hypot(ddx, ddy, ddz);
  if (raySolids(o.pos.x, eye, o.pos.z, ddx / dd, ddy / dd, ddz / dd, dd) < dd - 0.2) return;   // wall blocks
  o.flashedT = Math.max(o.flashedT, ab.dur);
}

function castSmoke(e, ab) {
  const p = aimPoint(e, 26);
  addSmoke(p.x, Math.max(1.4, p.y), p.z, ab);
  if (match.online) NET.send({ t: "ab", kind: "smoke", x: r2(p.x), y: r2(Math.max(1.4, p.y)), z: r2(p.z) });
}
function addSmoke(x, y, z, ab) {
  const geo = new THREE.SphereGeometry(ab.r, 12, 10);
  const m = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color: 0x20242c, transparent: true, opacity: 0.0, depthWrite: false }));
  m.position.set(x, y, z); scene.add(m);
  smokes.push({ mesh: m, ttl: ab.dur, life: ab.dur, x, y, z, r: ab.r });
}
// does a smoke sphere block the segment a→b? (used for bot vision only)
function smokeBlocks(ax, ay, az, dx, dy, dz, maxT) {
  for (const s of smokes) {
    if (s.ttl < 0.4) continue;
    const t = raySphere(ax, ay, az, dx, dy, dz, s.x, s.y, s.z, s.r);
    if (t > 0 && t < maxT) return true;
  }
  return false;
}

function abilitiesUpdate(dt) {
  for (const e of ents) {
    if (e.abilityCd > 0) e.abilityCd = Math.max(0, e.abilityCd - dt);
    if (e.flashedT > 0) e.flashedT = Math.max(0, e.flashedT - dt);
    if (e.invulnT > 0) e.invulnT = Math.max(0, e.invulnT - dt);
    if (e.speedT > 0) e.speedT = Math.max(0, e.speedT - dt);
    if (e.healT > 0) { e.healT = Math.max(0, e.healT - dt); e.hp = Math.min(CFG.player.hp, e.hp + 45 * dt); }
  }
  for (let i = smokes.length - 1; i >= 0; i--) {
    const s = smokes[i]; s.ttl -= dt;
    const fade = Math.min(s.life - s.ttl, s.ttl, 1);       // ease in/out
    s.mesh.material.opacity = 0.82 * Math.max(0, fade);
    if (s.ttl <= 0) { scene.remove(s.mesh); s.mesh.geometry.dispose(); smokes.splice(i, 1); }
  }
  for (let i = booms.length - 1; i >= 0; i--) {
    const b = booms[i]; b.fuse -= dt;
    if (b.fuse <= 0) { detonateBoom(b); booms.splice(i, 1); }
  }
}

/* ---------------- bot AI ---------------- */
function botThink(e, dt) {
  const w = WEAPONS[e.weapon];
  // acquire target: nearest visible enemy
  e.repathT -= dt;
  let best = null, bestD = CFG.bot.engageRange;
  for (const o of ents) {
    if (o === e || !o.alive) continue;
    const d = Math.hypot(o.pos.x - e.pos.x, o.pos.z - e.pos.z);
    if (d < bestD && hasLOS(e, o)) { best = o; bestD = d; }
  }
  if (best && e.target !== best) { e.target = best; e.reactT = rr(CFG.bot.reactMin, CFG.bot.reactMax); }
  if (!best) e.target = null;
  if (e.flashedT > 0) e.target = null;              // blinded: can't fight, just drifts

  if (e.target) {
    // face target
    const dx = e.target.pos.x - e.pos.x, dz = e.target.pos.z - e.pos.z;
    const d = Math.hypot(dx, dz);
    const wantYaw = Math.atan2(-dx, -dz);
    let dy = wantYaw - e.yaw;
    while (dy > Math.PI) dy -= 2 * Math.PI; while (dy < -Math.PI) dy += 2 * Math.PI;
    e.yaw += Math.max(-4 * dt, Math.min(4 * dt, dy));
    const eyeH = 1.55, tH = e.target.pos.y + 1.1;
    e.pitch = Math.atan2(tH - (e.pos.y + eyeH), d) * 0.9;
    e.reactT -= dt;
    // strafe + keep range
    e.strafeT -= dt;
    if (e.strafeT <= 0) { e.strafeDir = rng() < 0.5 ? -1 : 1; e.strafeT = rr(0.6, 1.6); }
    const fwd = w.range * 0.55;
    let mvx = 0, mvz = 0;
    const nx = dx / d, nz = dz / d;
    if (d > fwd) { mvx += nx; mvz += nz; } else if (d < fwd * 0.5) { mvx -= nx; mvz -= nz; }
    mvx += -nz * e.strafeDir * 0.7; mvz += nx * e.strafeDir * 0.7;
    botMove(e, mvx, mvz, dt);
    // fire
    if (e.reactT <= 0 && Math.abs(dy) < 0.25 && e.reloadT <= 0 && e.fireCd <= 0 && d < w.range) {
      if (e.ammo > 0) fireWeapon(e); else startReload(e);
    }
  } else {
    // roam waypoints
    if (!e.wp || e.repathT <= 0 ||
        Math.hypot(e.wp.x - e.pos.x, e.wp.z - e.pos.z) < 1.5) {
      e.wp = world.waypoints[(rng() * world.waypoints.length) | 0];
      e.repathT = CFG.bot.repath;
    }
    const dx = e.wp.x - e.pos.x, dz = e.wp.z - e.pos.z;
    const d = Math.hypot(dx, dz);
    if (d > 0.5) {
      const wantYaw = Math.atan2(-dx, -dz);
      let dy = wantYaw - e.yaw;
      while (dy > Math.PI) dy -= 2 * Math.PI; while (dy < -Math.PI) dy += 2 * Math.PI;
      e.yaw += Math.max(-3 * dt, Math.min(3 * dt, dy));
      e.pitch *= 0.9;
      botMove(e, dx / d, dz / d, dt);
    }
    if (e.reloadT <= 0 && e.ammo < WEAPONS[e.weapon].mag) startReload(e);
  }
}

function botMove(e, mvx, mvz, dt) {
  const m = Math.hypot(mvx, mvz);
  let tx = 0, tz = 0;
  if (m > 1e-6) { tx = mvx / m * CFG.bot.speed; tz = mvz / m * CFG.bot.speed; }
  const k = 1 - Math.exp(-10 * dt);
  e.vel.x += (tx - e.vel.x) * k; e.vel.z += (tz - e.vel.z) * k;
  const oldX = e.pos.x, oldZ = e.pos.z;
  e.pos.x += e.vel.x * dt;
  e.pos.z += e.vel.z * dt;
  collide(e.pos, CFG.player.radius);
  e.moving = Math.hypot(e.pos.x - oldX, e.pos.z - oldZ) > 0.001;
  if (e.moving) e.walkPhase += dt * 9;
  // stuck → new waypoint
  if (m > 1e-6 && !e.moving && !e.target) e.repathT = 0;
}

/* ---------------- player sim ---------------- */
function playerUpdate(dt, cmds) {
  const e = player;
  if (!e.alive) return;
  // look
  const sens = 0.0023;
  e.yaw -= lookDX * sens; e.pitch -= lookDY * sens;
  lookDX = 0; lookDY = 0;
  e.yaw -= cmds.lookGX * 2.6 * dt; e.pitch -= cmds.lookGY * 2.0 * dt;
  e.pitch = Math.max(-1.45, Math.min(1.45, e.pitch));

  // wish direction relative to yaw (W = camera forward, S = straight back)
  const cos = Math.cos(e.yaw), sin = Math.sin(e.yaw);
  const fwd = -cmds.my;
  const wishX = cmds.mx * cos - fwd * sin;
  const wishZ = -cmds.mx * sin - fwd * cos;

  // velocity model: quick ramp, quick stop — tapping the opposite key
  // (counter-strafe) doubles the decel and snaps you accurate sooner
  const pspeed = CFG.player.speed * (e.speedT > 0 ? e.speedFactor : 1);   // ability speed buff
  const grounded = e.pos.y <= 0.001;
  const k = 1 - Math.exp(-(grounded ? CFG.player.accel : CFG.player.airAccel) * dt);
  e.vel.x += (wishX * pspeed - e.vel.x) * k;
  e.vel.z += (wishZ * pspeed - e.vel.z) * k;
  const oldX = e.pos.x, oldZ = e.pos.z;
  e.pos.x += e.vel.x * dt;
  e.pos.z += e.vel.z * dt;
  collide(e.pos, CFG.player.radius);
  e.vel.x = (e.pos.x - oldX) / dt; e.vel.z = (e.pos.z - oldZ) / dt;   // walls kill velocity
  e.speed2d = Math.hypot(e.vel.x, e.vel.z);
  e.moving = e.speed2d > 0.3;
  if (e.moving) e.walkPhase += dt * (6 + 5 * e.speed2d / CFG.player.speed);

  // jump/gravity + landing dip
  if (cmds.jump && grounded) e.vel.y = CFG.player.jumpV;
  e.vel.y -= CFG.player.gravity * dt;
  const fallV = e.vel.y;
  e.pos.y = Math.max(0, e.pos.y + e.vel.y * dt);
  if (e.pos.y === 0) {
    if (!grounded && fallV < -4.5) vm.land = Math.min(1, -fallV / 11);
    e.vel.y = Math.max(0, e.vel.y);
  }

  // regen
  if (match.t - e.lastHurtT > CFG.player.regenDelay && e.hp < CFG.player.hp)
    e.hp = Math.min(CFG.player.hp, e.hp + CFG.player.regenRate * dt);

  // weapons
  const w = WEAPONS[e.weapon];
  if (cmds.reload) startReload(e);
  if (e.reloadT > 0) {
    e.reloadT -= dt;
    if (e.reloadT <= 0) { e.ammo = w.mag; e.reloadT = 0; }
  } else if (cmds.fire && e.fireCd <= 0 && e.ammo > 0) {
    if (w.auto || !e.prevFire) fireWeapon(e);
  }
  e.prevFire = cmds.fire;

  // ability (Q / gamepad / touch)
  if (cmds.ability) activateAbility(e);

  // scoped-weapon zoom
  const zooming = cmds.zoom && w.zoom;
  const want = zooming ? CFG.zoomFov : CFG.fov;
  if (Math.abs(camera.fov - want) > 0.5) { camera.fov += (want - camera.fov) * 0.25; camera.updateProjectionMatrix(); }
}

/* ---------------- viewmodel ---------------- */
const vm = {
  group: null, guns: null, flashSp: null, flashT: 0, recoil: 0, bob: 0,
  swayX: 0, swayY: 0, land: 0, idle: 0, dip: 0,
  init() {
    if (this.group) camera.remove(this.group);   // matches restart in place online
    this.group = new THREE.Group();
    this.guns = WEAPONS.map(w => { const g = makeGunMesh(w.mesh, false); g.visible = false; return g; });
    this.guns.forEach(g => this.group.add(g));
    this.flashSp = new THREE.Sprite(new THREE.SpriteMaterial({ map: flashTex, transparent: true, depthWrite: false }));
    this.flashSp.scale.setScalar(0.35); this.flashSp.visible = false;
    this.group.add(this.flashSp);
    camera.add(this.group);
    this.switchTo(0);
  },
  switchTo(i) {
    this.guns.forEach((g, j) => g.visible = j === i);
    this.cur = i; this.dip = 1;
  },
  update(dt) {
    const w = WEAPONS[player.weapon];
    this.recoil = Math.max(0, this.recoil - dt * (4 + this.recoil * 5));
    this.dip = Math.max(0, this.dip - dt * 3.2);
    this.land = Math.max(0, this.land - dt * 2.8);
    this.idle += dt;

    // look sway — the gun lags a touch behind camera turns
    const dyaw = player.yaw - (this._pyaw ?? player.yaw);
    const dpitch = player.pitch - (this._ppitch ?? player.pitch);
    this._pyaw = player.yaw; this._ppitch = player.pitch;
    const kS = Math.min(1, dt * 9);
    this.swayX += (Math.max(-0.05, Math.min(0.05, dyaw * 1.6)) - this.swayX) * kS;
    this.swayY += (Math.max(-0.04, Math.min(0.04, dpitch * 1.6)) - this.swayY) * kS;

    // movement in gun-local space: strafe rolls the gun, running pulls it back
    const cos = Math.cos(player.yaw), sin = Math.sin(player.yaw);
    const lat = (player.vel.x * cos - player.vel.z * sin) / CFG.player.speed;
    const fwd = (-player.vel.x * sin - player.vel.z * cos) / CFG.player.speed;
    const spd = Math.min(1, (player.speed2d ?? 0) / CFG.player.speed);
    const grounded = player.pos.y <= 0.001;

    // figure-8 bob scaled by real speed, damped in the air; idle breathing when still
    if (player.moving && player.alive && grounded) this.bob += dt * (7 + 4 * spd);
    const amp = spd * (grounded ? 1 : 0.25);
    const bobX = Math.cos(this.bob) * 0.014 * amp;
    const bobY = Math.sin(this.bob * 2) * 0.011 * amp;
    const idleY = Math.sin(this.idle * 1.7) * 0.004 * (1 - spd * 0.8);

    // reload — barrel swings down and rolls, then comes back up
    let relX = 0, relZ = 0, relY = 0;
    if (player.reloadT > 0) {
      const p = 1 - player.reloadT / w.reload;
      const c = Math.sin(Math.PI * Math.min(1, p * 1.12));
      relX = c * 0.8; relZ = c * 0.3; relY = -c * 0.08;
    }

    // target pose, then exponential smoothing toward it
    const tx = 0.28 + bobX - this.swayX * 0.5 - lat * 0.022;
    const ty = -0.26 + bobY + idleY + this.swayY * 0.6 - this.dip * 0.22 - this.land * 0.07 + relY + this.recoil * 0.025;
    const tz = -0.5 + this.recoil * 0.09 - fwd * 0.014;
    const rX = this.recoil * 0.15 + relX - this.dip * 0.85 - this.land * 0.16 + this.swayY * 1.3;
    const rY = this.swayX * 1.6;
    const rZ = -lat * 0.07 + relZ + this.swayX * 0.7;
    const s = 1 - Math.exp(-dt * 16);
    const g = this.group;
    g.position.x += (tx - g.position.x) * s;
    g.position.y += (ty - g.position.y) * s;
    g.position.z += (tz - g.position.z) * s;
    g.rotation.x += (rX - g.rotation.x) * s;
    g.rotation.y += (rY - g.rotation.y) * s;
    g.rotation.z += (rZ - g.rotation.z) * s;

    if (this.flashT > 0) {
      this.flashT -= dt;
      const mz = this.guns[this.cur].userData.muzzle;
      this.flashSp.position.copy(mz.position).add(this.guns[this.cur].position);
      this.flashSp.visible = this.flashT > 0;
      this.flashSp.material.rotation = Math.random() * Math.PI;
    } else this.flashSp.visible = false;
  },
};

/* ---------------- HUD ---------------- */
const $ = id => document.getElementById(id);
const hud = {
  feedTimer: [],
  init() {
    $("youName").textContent = (match?.online ? NET.name : STR.you).toUpperCase();
    const ab = AGENTS[player.agent];
    $("abName").textContent = STR.agents[ab.id].name.toUpperCase();
    $("abSkill").textContent = STR.agents[ab.id].skill;
    $("abKey").textContent = isTouch ? "" : "Q";
    $("abHud").style.setProperty("--acc", "#" + ab.color.toString(16).padStart(6, "0"));
    $("ktarget").textContent = STR.hud.firstTo.replace("{n}", CFG.killTarget);
  },
  update() {
    const w = WEAPONS[player.weapon];
    $("hpFill").style.width = Math.max(0, player.hp) + "%";
    $("wname").textContent = STR.weapons[w.id];
    $("ammoN").textContent = w.melee ? "∞" : (player.ammo + " / " + w.mag);
    $("ammoR").textContent = player.reloadT > 0 ? STR.hud.reloading : (!w.melee && player.ammo === 0 ? STR.hud.reload : "");
    $("credits").textContent = "⛃ " + player.credits;
    $("kills").textContent = player.totalKills + " / " + CFG.killTarget;
    // ability meter
    const abReady = player.abilityCd <= 0;
    $("abHud").classList.toggle("ready", abReady);
    $("abCd").textContent = abReady ? STR.hud.abReady : Math.ceil(player.abilityCd) + "s";
    const t = Math.max(0, match.timeLeft), m = (t / 60) | 0, s = (t % 60) | 0;
    $("timer").textContent = m + ":" + String(s).padStart(2, "0");
    let lead = player, lp = progress(player);
    for (const e of ents) if (progress(e) > lp) { lead = e; lp = progress(e); }
    $("lead").textContent = lead.isPlayer ? STR.hud.youLead : STR.hud.leader.replace("{name}", lead.name);
    if (match.online) $("roomBar").classList.toggle("hidden", remotes.size > 0);
    if (!player.alive) {
      $("centerMsg").innerHTML = STR.hud.respawnIn.replace("{s}", Math.ceil(player.respawnT)) +
        (this._centerSub ? `<div class="small">${this._centerSub}</div>` : "");
    } else if (this.centerT > 0) {
      $("centerMsg").textContent = this.centerText;
    } else $("centerMsg").textContent = "";
    // flash blind overlay
    $("flash").style.opacity = Math.min(1, player.flashedT / 1.0).toFixed(2);
    // dynamic crosshair: blooms with speed, recoil and airtime
    const spd = Math.min(1, (player.speed2d ?? 0) / CFG.player.speed);
    const gap = 3 + spd * 8 + vm.recoil * 10 + (player.pos.y > 0.05 ? 6 : 0);
    this._g = (this._g ?? 3) + (gap - (this._g ?? 3)) * 0.25;
    $("xhair").style.setProperty("--g", this._g.toFixed(1) + "px");
  },
  abilityFx() {
    const el = $("abHud"); el.classList.add("cast");
    clearTimeout(this._af); this._af = setTimeout(() => el.classList.remove("cast"), 260);
  },
  mapBanner(mapId) {
    const el = $("mapBanner");
    el.innerHTML = `<span>${STR.hud.mapLabel}</span><b>${STR.maps[mapId].name}</b>`;
    el.classList.remove("hidden"); el.classList.add("show");
    clearTimeout(this._mb); this._mb = setTimeout(() => el.classList.remove("show"), 3200);
  },
  center(text, dur) { this.centerText = text; this.centerT = dur; },
  tick(dt) { if (this.centerT > 0) this.centerT -= dt; },
  centerT: 0, centerText: "", _centerSub: "",
  hitmark() {
    const el = $("hitmark"); el.style.opacity = 1;
    clearTimeout(this._hm); this._hm = setTimeout(() => el.style.opacity = 0, 90);
  },
  killBanner(name) {
    const el = $("killBanner");
    el.textContent = STR.hud.youKilled.replace("{name}", name.toUpperCase());
    el.style.opacity = 1;
    $("xhair").classList.add("kill");
    clearTimeout(this._kb); this._kb = setTimeout(() => el.style.opacity = 0, 1300);
    clearTimeout(this._kx); this._kx = setTimeout(() => $("xhair").classList.remove("kill"), 170);
  },
  hurt() {
    const el = $("vign"); el.style.boxShadow = "inset 0 0 120px rgba(255,40,20,.55)";
    clearTimeout(this._vg); this._vg = setTimeout(() => el.style.boxShadow = "inset 0 0 120px rgba(255,40,20,0)", 220);
  },
  feed(text, mine) {
    const f = $("feed"), d = document.createElement("div");
    d.textContent = text; if (mine) d.className = "me";
    f.prepend(d);
    while (f.children.length > 5) f.removeChild(f.lastChild);
    setTimeout(() => d.remove(), 5000);
  },
};

/* ---------------- buy menu (B) ---------------- */
const SHOP_CATS = ["sidearm", "smg", "shotgun", "rifle", "sniper", "lmg", "melee"];
const shop = {
  built: false, open: false,
  build() {
    const grid = $("shopGrid"); grid.innerHTML = "";
    const byCat = {};
    WEAPONS.forEach((w, i) => (byCat[w.cat] ??= []).push(i));
    for (const cat of SHOP_CATS) {
      const col = document.createElement("div"); col.className = "shopCat";
      const h = document.createElement("div"); h.className = "shopCatH"; h.textContent = STR.shopCats[cat];
      col.appendChild(h);
      for (const i of byCat[cat] || []) {
        const w = WEAPONS[i];
        const it = document.createElement("button"); it.className = "shopItem"; it.dataset.idx = i;
        it.innerHTML = `<span class="wn">${STR.weapons[w.id]}</span><span class="wp">${w.price ? w.price : STR.shop.free}</span>`;
        it.onclick = () => buyWeapon(i);
        col.appendChild(it);
      }
      grid.appendChild(col);
    }
    $("shopTitle").textContent = STR.shop.title;
    $("shopClose").textContent = STR.shop.close;
    $("shopHint").textContent = STR.shop.hint;
    $("shopClose").onclick = () => this.close();
    this.built = true;
  },
  refresh() {
    if (!this.built) return;
    $("shopCredits").textContent = "⛃ " + (player ? player.credits : 0);
    for (const it of $("shopGrid").querySelectorAll(".shopItem")) {
      const i = +it.dataset.idx, w = WEAPONS[i];
      it.classList.toggle("owned", !!player && i === player.weapon);
      it.classList.toggle("cant", !!player && i !== player.weapon && player.credits < w.price);
    }
  },
  toggle() { this.open ? this.close() : this.openShop(); },
  openShop() {
    if (!match || match.over) return;
    if (!this.built) this.build();
    this.open = true; shopOpen = true;
    $("shop").classList.remove("hidden");
    this.refresh();
    document.exitPointerLock?.();
  },
  close(relock = true) {
    this.open = false; shopOpen = false;
    const el = $("shop"); if (el) el.classList.add("hidden");
    if (relock && !isTouch && !inMenu && match && !match.over && running) canvas.requestPointerLock?.();
  },
};

/* ---------------- pre-match screens: map reveal, then agent select ---------------- */
const MAP_SW = { dust: "#c9a87a,#8d8d85", neon: "#3a4560,#4ad7e8", frost: "#e8eef4,#9aa8b5" };
function showMapReveal(mapId, next) {
  inMenu = true;
  $("menu").classList.add("hidden"); $("end").classList.add("hidden");
  const el = $("mapReveal");
  el.innerHTML = `<div class="mrLabel">${STR.hud.mapLabel}</div>
    <div class="mrSwatch" style="background:linear-gradient(135deg,${MAP_SW[mapId]})"></div>
    <h1 class="mrName">${STR.maps[mapId].name}</h1>
    <div class="mrDesc">${STR.maps[mapId].desc}</div>
    <div class="mrGo">${STR.hud.tapContinue}</div>`;
  el.classList.remove("hidden");
  let done = false;
  const go = () => { if (done) return; done = true; el.classList.add("hidden"); el.onclick = null; clearTimeout(tm); next(); };
  const tm = setTimeout(go, 2600);
  el.onclick = go;
}
let agentBuilt = false;
function buildAgentSelect() {
  const grid = $("agentGrid"); grid.innerHTML = "";
  AGENTS.forEach((a, idx) => {
    const s = STR.agents[a.id], hex = "#" + a.color.toString(16).padStart(6, "0");
    const c = document.createElement("button");
    c.className = "agentCard" + (idx === chosenAgent ? " sel" : "");
    c.style.setProperty("--acc", hex);
    c.innerHTML = `<div class="agPortrait" style="background:radial-gradient(circle at 50% 35%, ${hex}, #12151c 70%)">
        <span class="agInit">${s.name[0]}</span></div>
      <div class="agName">${s.name}</div>
      <div class="agRole">${s.role}</div>
      <div class="agSkill"><b>${s.skill}</b><span>${s.desc}</span></div>`;
    c.onclick = () => {
      chosenAgent = idx;
      [...grid.children].forEach(x => x.classList.remove("sel"));
      c.classList.add("sel");
    };
    grid.appendChild(c);
  });
  $("agentTitle").textContent = STR.agentSelect.title;
  $("lockBtn").textContent = STR.agentSelect.lock;
  agentBuilt = true;
}
function showAgentSelect(next) {
  inMenu = true;
  $("menu").classList.add("hidden");
  if (!agentBuilt) buildAgentSelect();
  else [...$("agentGrid").children].forEach((x, i) => x.classList.toggle("sel", i === chosenAgent));
  const el = $("agentSelect"); el.classList.remove("hidden");
  $("lockBtn").onclick = () => { el.classList.add("hidden"); next(); };
}

/* ---------------- online play (rooms on the realtime server) ---------------- */
// Trust model: each client simulates its own movement and hp; the server owns
// roster, scores, ladder progression, the clock and map rotation (server.js).
const remotes = new Map();          // network id -> remote entity

const NET = {
  ws: null, active: false, joined: false, wantOnline: false, entered: false,
  room: null, id: null, name: "", tries: 0, sendAcc: 0,
  ensureRoom() {
    const params = new URLSearchParams(location.search);
    let room = params.get("room");
    if (!room) {
      room = Math.random().toString(36).slice(2, 8);
      params.set("room", room);
      history.replaceState(null, "", location.pathname + "?" + params);
    }
    this.room = room;
  },
  identity() {
    let id = sessionStorage.getItem("gga-id");   // sessionStorage: two tabs = two players
    if (!id) { id = "p-" + Math.random().toString(36).slice(2, 10); sessionStorage.setItem("gga-id", id); }
    this.id = id;
  },
  connect() {
    this.wantOnline = true;
    this.ensureRoom(); this.identity();
    const base = location.pathname.replace(/\/+$/, "");
    const url = (location.protocol === "https:" ? "wss://" : "ws://") + location.host + base + "/ws/" + this.room;
    try { this.ws = new WebSocket(url); } catch (e) { netOnDisconnect(); return; }
    this.ws.onopen = () => { this.tries = 0; this.send({ t: "join", id: this.id, name: this.name }); };
    this.ws.onmessage = e => { let m; try { m = JSON.parse(e.data); } catch { return; } netOnMessage(m); };
    this.ws.onclose = () => {
      this.joined = false;
      if (!this.wantOnline) return;
      netOnDisconnect();
      const delay = Math.min(5000, 800 * ++this.tries);
      setTimeout(() => { if (this.wantOnline) this.connect(); }, delay);
    };
  },
  send(o) { if (this.ws && this.ws.readyState === 1) this.ws.send(JSON.stringify(o)); },
  stop() {
    this.wantOnline = false; this.active = false; this.joined = false; this.entered = false;
    const ws = this.ws; this.ws = null;
    if (ws) { ws.onclose = null; try { ws.close(); } catch (e) {} }
  },
};

function entityByNid(nid) {
  return nid === NET.id ? player : remotes.get(nid) || null;
}

function addRemote(rp) {
  if (rp.id === NET.id || remotes.has(rp.id)) return null;
  const e = makeEntity(rp.name, false, accentFor(rp.id));
  e.remote = true; e.nid = rp.id;
  e.weapon = Math.max(0, Math.min(WEAPONS.length - 1, rp.weapon | 0));
  e.totalKills = rp.kills || 0; e.deaths = rp.deaths || 0;
  e.guns.forEach((g, i) => g.visible = i === e.weapon);
  e.snap = null;
  e.model.group.visible = false;      // hidden until the first snapshot places them
  ents.push(e); remotes.set(rp.id, e);
  return e;
}

function removeRemote(nid) {
  const e = remotes.get(nid);
  if (!e) return;
  scene.remove(e.model.group); scene.remove(e.muzzleSp);
  ents = ents.filter(x => x !== e);
  remotes.delete(nid);
}

function remoteFireFx(e) {
  const w = WEAPONS[e.weapon];
  const eye = e.pos.y + 1.55;
  const dx = -Math.sin(e.yaw) * Math.cos(e.pitch), dy = Math.sin(e.pitch), dz = -Math.cos(e.yaw) * Math.cos(e.pitch);
  const t = Math.min(raySolids(e.pos.x, eye, e.pos.z, dx, dy, dz, w.range), w.range);
  spawnTracer(e.pos.x, eye - 0.12, e.pos.z, e.pos.x + dx * t, eye + dy * t, e.pos.z + dz * t);
  const f = flashes.find(f => f.sp === e.muzzleSp);
  if (f) {
    const m = e.guns[e.weapon].userData.muzzle.getWorldPosition(new THREE.Vector3());
    e.muzzleSp.position.copy(m); f.ttl = 0.05; e.muzzleSp.visible = true;
  }
  AudioMan.at(w.sfx, Math.hypot(e.pos.x - player.pos.x, e.pos.z - player.pos.z), { vol: 0.32, rate: w.rate });
}

function playerDie(killerNid) {
  if (!player.alive) return;
  NET.send({ t: "died", killer: killerNid });
  player.alive = false;
  player.respawnT = CFG.player.respawn;
  spawnPuff(player.pos.x, player.pos.y + 1.1, player.pos.z, true);
}

function applyKillMsg(m) {
  const victim = entityByNid(m.v), killer = m.k ? entityByNid(m.k) : null;
  const vName = victim ? victim.name : "?", kName = killer ? killer.name : "?";
  hud.feed(STR.feed.killed.replace("{a}", kName).replace("{b}", vName),
           !!(killer?.isPlayer || victim?.isPlayer));
  if (victim) {
    victim.deaths = m.vd ?? victim.deaths;
    if (victim.remote) {
      victim.alive = false;
      if (victim.model.group.visible) spawnPuff(victim.pos.x, victim.pos.y + 1.1, victim.pos.z, true);
      victim.model.group.visible = false;
    }
  }
  if (killer) {
    killer.totalKills = m.kk ?? killer.totalKills;
    if (killer.isPlayer) {
      hud.killBanner(vName);
      player.credits = Math.min(CFG.maxCredits, player.credits + CFG.killReward);
    }
  }
  if (victim?.isPlayer) hud.center(STR.hud.killedBy.replace("{name}", kName), 2);
}

function netEnter(m) {
  const go = () => {
    startMatch(m.map, { online: true, timeLeft: m.left, players: m.players });
    if (m.over) endOnline(null, "");
    else if (!isTouch) canvas.requestPointerLock?.();
  };
  // first entry: reveal the map, then pick an agent; later matches keep the agent
  if (!NET.entered) { NET.entered = true; showMapReveal(m.map, () => showAgentSelect(go)); }
  else go();
}

function applyRemoteAbility(m) {
  if (m.kind === "flash") tryFlash(player, { x: m.x, y: m.y, z: m.z }, ABILITY.flash);
  else if (m.kind === "smoke") addSmoke(m.x, m.y, m.z, ABILITY.smoke);
  else if (m.kind === "boom") spawnBoom(m.x, m.y, m.z, ABILITY.boom, m.id, null);
}

function netOnMessage(m) {
  switch (m.t) {
    case "welcome":
      NET.joined = true; NET.active = true;
      netEnter(m);
      break;
    case "start":
      NET.joined = true; NET.active = true;
      netEnter(m);
      break;
    case "join": {
      if (!NET.active || !match?.online) break;
      const e = addRemote(m);
      if (e) hud.feed(STR.online.joined.replace("{name}", e.name), false);
      break;
    }
    case "leave": {
      const e = remotes.get(m.id);
      if (e) { hud.feed(STR.online.left.replace("{name}", e.name), false); removeRemote(m.id); }
      break;
    }
    case "s": {
      const e = remotes.get(m.id);
      if (!e) break;
      e.snap = { x: m.p[0], y: m.p[1], z: m.p[2], yaw: m.y, pitch: m.pi };
      if (!e.model.group.visible && m.a) {   // first sight / respawn: snap into place
        e.pos.x = m.p[0]; e.pos.y = m.p[1]; e.pos.z = m.p[2]; e.yaw = m.y;
      }
      e.alive = !!m.a;
      e.model.group.visible = e.alive;
      const nw = Math.max(0, Math.min(WEAPONS.length - 1, m.w | 0));
      if (nw !== e.weapon) { e.weapon = nw; e.guns.forEach((g, i) => g.visible = i === nw); }
      break;
    }
    case "f": {
      const e = remotes.get(m.id);
      if (e && e.alive) remoteFireFx(e);
      break;
    }
    case "hit":
      if (!match?.online || match.over || !player.alive) break;
      player.hp -= m.d; player.lastHurtT = match.t;
      hud.hurt();
      if (player.hp <= 0) playerDie(m.from);
      break;
    case "kill": if (match?.online) applyKillMsg(m); break;
    case "ab": if (match?.online) applyRemoteAbility(m); break;
    case "tick": if (match?.online) match.timeLeft = m.left; break;
    case "over": if (match?.online) endOnline(m.winner, m.name); break;
    case "error":
      if (m.code === "full") { NET.stop(); backToMenu(STR.online.full); }
      break;
  }
}

function netOnDisconnect() {
  if (match?.online && !inMenu) hud.center(STR.online.reconnecting, 3);
  if (inMenu) $("mStatus").textContent = STR.online.reconnecting;
}

function backToMenu(statusText) {
  running = false; inMenu = true;
  $("hud").classList.add("hidden");
  $("end").classList.add("hidden");
  $("pause").classList.add("hidden");
  $("menu").classList.remove("hidden");
  $("mStatus").textContent = statusText || "";
  document.exitPointerLock?.();
}

function endOnline(winnerNid, winnerName) {
  match.over = true; running = false;
  document.exitPointerLock?.();
  const timed = match.timeLeft <= 1;
  const win = winnerNid === NET.id;
  $("eTitle").textContent = winnerNid == null ? STR.online.next : (win ? STR.end.win : STR.end.lose);
  $("eTitle").style.color = win ? "#ffb03a" : "#ff4a3a";
  $("eDesc").textContent = winnerNid == null ? "" :
    (win ? (timed ? STR.end.timeWin : STR.end.winDesc)
         : (timed ? STR.end.timeLose : STR.end.loseDesc).replace("{name}", winnerName || "?"))
    + " " + STR.online.next;
  $("hud").classList.add("hidden");
  $("end").classList.remove("hidden");
}

function netUpdate(dt) {
  // smooth remotes toward their latest snapshot
  for (const e of remotes.values()) {
    if (!e.snap) continue;
    const k = 1 - Math.exp(-12 * dt);
    const ox = e.pos.x, oz = e.pos.z;
    e.pos.x += (e.snap.x - e.pos.x) * k;
    e.pos.y += (e.snap.y - e.pos.y) * k;
    e.pos.z += (e.snap.z - e.pos.z) * k;
    let dy = e.snap.yaw - e.yaw;
    while (dy > Math.PI) dy -= 2 * Math.PI; while (dy < -Math.PI) dy += 2 * Math.PI;
    e.yaw += dy * k;
    e.pitch += (e.snap.pitch - e.pitch) * k;
    e.vel.x = (e.pos.x - ox) / dt; e.vel.z = (e.pos.z - oz) / dt;
    e.moving = Math.hypot(e.vel.x, e.vel.z) > 0.3;
    if (e.moving) e.walkPhase += dt * 9;
  }
  // send our snapshot ~15 Hz
  NET.sendAcc += dt;
  if (NET.joined && NET.sendAcc >= 1 / 15) {
    NET.sendAcc = 0;
    NET.send({ t: "s", p: [r2(player.pos.x), r2(player.pos.y), r2(player.pos.z)],
               y: r2(player.yaw), pi: r2(player.pitch), a: player.alive ? 1 : 0, w: player.weapon });
  }
}

/* ---------------- match lifecycle ---------------- */
let running = false, inMenu = true;

function startMatch(mapId, opts = {}) {
  const online = !!opts.online;
  rng = mulberry32(0xC0FFEE ^ mapId.length * 7919 ^ [...mapId].reduce((a, c) => a + c.charCodeAt(0), 0));
  buildWorld(mapId);
  initFx();
  camera.fov = CFG.fov; camera.updateProjectionMatrix();
  scene.add(camera);
  ents = []; remotes.clear();
  smokes.length = 0; booms.length = 0;
  player = makeEntity(online ? NET.name : STR.you, true, AGENTS[chosenAgent].color);
  player.nid = online ? NET.id : null;
  player.agent = chosenAgent; player.credits = CFG.startCredits; player.weapon = 0; player.abilityCd = 0;
  ents.push(player);
  if (online) for (const rp of opts.players || []) addRemote(rp);
  else for (let i = 0; i < CFG.bots; i++) {
    const b = makeEntity(STR.bots[i % STR.bots.length], false, AGENTS[(i + 1) % AGENTS.length].color);
    b.agent = (i + 1) % AGENTS.length;
    equipWeapon(b, BOT_POOL[i % BOT_POOL.length]);
    ents.push(b);
  }
  match = { t: 0, timeLeft: online ? (opts.timeLeft ?? CFG.matchTime) : CFG.matchTime,
            over: false, winner: null, online };
  for (const e of ents) if (!e.remote) spawnEntity(e);
  vm.init();
  hud.init();
  $("hud").classList.remove("hidden");
  $("menu").classList.add("hidden");
  $("end").classList.add("hidden");
  $("pause").classList.add("hidden");
  $("againBtn").classList.toggle("hidden", online);
  $("roomBar").classList.toggle("hidden", !online);
  if (online) $("rbLink").value = location.href;
  running = true; inMenu = false;
  shopOpen = false; shop.close();
  AudioMan.music();
  hud.mapBanner(mapId);                                 // "MAP — DUST YARD" at the start
  // inspection + drive hooks for automated checks; only under ?dev
  if (new URLSearchParams(location.search).has("dev"))
    window.__gg = {
      get ents() { return ents; }, get player() { return player; }, get match() { return match; },
      get smokes() { return smokes; }, get booms() { return booms; }, camera, hud,
      kill, damage, buyWeapon, equipWeapon, activateAbility, abilitiesUpdate, tryFlash, aimPoint,
      AGENTS, WEAPONS, CFG, ABILITY,
      setAgent: i => { chosenAgent = i; player.agent = i; },
    };
}

function endMatch(winner) {
  match.over = true; match.winner = winner;
  running = false;
  document.exitPointerLock?.();
  const win = winner.isPlayer;
  $("eTitle").textContent = win ? STR.end.win : STR.end.lose;
  $("eTitle").style.color = win ? "#ffb03a" : "#ff4a3a";
  $("eDesc").textContent = win ? STR.end.winDesc : STR.end.loseDesc.replace("{name}", winner.name);
  $("hud").classList.add("hidden");
  $("end").classList.remove("hidden");
}

function endByTime() {
  let lead = player, lp = progress(player);
  for (const e of ents) if (progress(e) > lp) { lead = e; lp = progress(e); }
  match.over = true; match.winner = lead; running = false;
  document.exitPointerLock?.();
  const win = lead.isPlayer;
  $("eTitle").textContent = win ? STR.end.win : STR.end.lose;
  $("eTitle").style.color = win ? "#ffb03a" : "#ff4a3a";
  $("eDesc").textContent = win ? STR.end.timeWin : STR.end.timeLose.replace("{name}", lead.name);
  $("hud").classList.add("hidden");
  $("end").classList.remove("hidden");
}

/* ---------------- simulation ---------------- */
function update(dtMs) {
  const dt = dtMs / 1000;
  if (!running || match.over) return;
  match.t += dt; match.timeLeft -= dt;
  hud.tick(dt);
  if (match.timeLeft <= 0) {
    if (match.online) match.timeLeft = 0;   // the server calls time via "over"
    else { endByTime(); return; }
  }

  abilitiesUpdate(dt);
  const cmds = commands();
  for (const e of ents) {
    if (e.remote) continue;                 // remotes are driven by snapshots
    if (!e.alive) {
      e.respawnT -= dt;
      if (e.respawnT <= 0) spawnEntity(e);
      continue;
    }
    e.fireCd -= dt;
    if (!e.isPlayer) {
      if (e.reloadT > 0) { e.reloadT -= dt; if (e.reloadT <= 0) { e.ammo = WEAPONS[e.weapon].mag; } }
      botThink(e, dt);
    }
  }
  playerUpdate(dt, cmds);
  if (match.online) netUpdate(dt);
  fxUpdate(dt);
  hud.update();
}

/* ---------------- render ---------------- */
let camRoll = 0;
function render() {
  if (!scene) return;
  // camera from player: landing dip, recoil kick, subtle strafe roll
  const pcos = Math.cos(player.yaw), psin = Math.sin(player.yaw);
  const latR = (player.vel.x * pcos - player.vel.z * psin) / CFG.player.speed;
  camRoll += (-latR * 0.014 - camRoll) * 0.15;
  camera.position.set(player.pos.x, player.pos.y + CFG.player.eye - vm.land * 0.09, player.pos.z);
  camera.rotation.set(0, 0, 0);
  camera.rotateY(player.yaw); camera.rotateX(player.pitch + vm.recoil * 0.012); camera.rotateZ(camRoll);
  vm.update(1 / 60);
  vm.group.visible = player.alive;

  // bots visuals: leg swing fades with real speed, body leans into strafes
  for (const e of ents) {
    if (e.isPlayer || !e.model) continue;
    const g = e.model.group;
    g.position.set(e.pos.x, e.pos.y, e.pos.z);
    g.rotation.y = e.yaw;
    const spdR = Math.min(1, Math.hypot(e.vel.x, e.vel.z) / CFG.bot.speed);
    const sw = Math.sin(e.walkPhase) * 0.55 * spdR;
    e.model.legL.rotation.x = sw; e.model.legR.rotation.x = -sw;
    e.model.armL.rotation.x = -sw * 0.5;
    // right arm aims with pitch (remotes always hold their aim)
    const aiming = e.remote || !!e.target;
    e.model.armR.rotation.x = -Math.PI / 2 + (aiming ? -e.pitch : 0.3) + (!aiming ? sw * 0.3 : 0);
    const blat = (e.vel.x * Math.cos(e.yaw) - e.vel.z * Math.sin(e.yaw)) / CFG.bot.speed;
    g.rotation.z = -blat * 0.1;
    e.model.blob.position.set(0, 0.02, 0);
  }
  renderer.render(scene, camera);
}

/* ---------------- menus ---------------- */
// The platform edge-caches index.html far longer than the JS modules, so a
// deploy can pair fresh JS with a stale shell. Create any missing online-UI
// elements here; no-ops once the new HTML is being served.
function ensureOnlineDom() {
  if ($("nameInp")) return;
  const css = document.createElement("style");
  css.textContent = `
    #nameInp{background:#1a1f29;border:2px solid #3a4150;color:#e8e4da;border-radius:8px;padding:10px 14px;
      font-size:15px;text-align:center;letter-spacing:.08em;margin-bottom:16px;width:200px;outline:none}
    #nameInp:focus{border-color:#ffb03a}
    .menuRow{display:flex;gap:12px;align-items:center;flex-wrap:wrap;justify-content:center}
    .menuRow .btn.ghost{margin-top:0}
    #mRandom{font-size:11px;opacity:.5;margin-top:10px}
    #mStatus{min-height:18px;color:#4ad7e8;font-size:13px;margin-top:8px}
    #roomBar{position:absolute;top:64px;left:50%;transform:translateX(-50%);display:flex;gap:8px;align-items:center;
      background:#000000aa;border:1px solid #3a4150;border-radius:8px;padding:8px 12px;pointer-events:auto;font-size:12px}
    #roomBar.hidden{display:none}
    #roomBar input{width:min(210px,42vw);background:#1a1f29;border:1px solid #3a4150;color:#9aa4b2;border-radius:5px;
      padding:4px 8px;font-size:11px}
    #roomBar button{background:#ff7a1a;border:0;border-radius:5px;padding:5px 10px;font-weight:700;cursor:pointer;color:#14100a}`;
  document.head.appendChild(css);
  const menu = $("menu"), startBtn = $("startBtn");
  const nameInp = document.createElement("input");
  nameInp.id = "nameInp"; nameInp.maxLength = 14; nameInp.spellcheck = false;
  const row = document.createElement("div"); row.className = "menuRow";
  const onlineBtn = document.createElement("button");
  onlineBtn.id = "onlineBtn"; onlineBtn.className = "btn";
  menu.insertBefore(nameInp, startBtn);
  menu.insertBefore(row, startBtn);
  row.appendChild(onlineBtn); row.appendChild(startBtn);   // startBtn moves into the row
  startBtn.classList.add("ghost");
  const mRandom = document.createElement("div"); mRandom.id = "mRandom";
  const mStatus = document.createElement("div"); mStatus.id = "mStatus";
  row.after(mStatus); row.after(mRandom);
  const bar = document.createElement("div");
  bar.id = "roomBar"; bar.className = "hidden";
  bar.innerHTML = '<span id="rbTxt"></span><input id="rbLink" readonly><button id="rbCopy"></button>';
  $("hud").appendChild(bar);
}

// Build the buy-menu / agent-select / map-reveal / battle-HUD DOM + CSS in JS
// so it exists on both fresh and edge-cached HTML shells. Idempotent.
function ensureBattleDom() {
  if (!document.getElementById("battleCss")) {
    const st = document.createElement("style"); st.id = "battleCss";
    st.textContent = `
      #credits{position:absolute;left:18px;bottom:64px;font-size:20px;font-weight:800;color:#ffd479;text-shadow:0 1px 3px #000}
      #scorebar{position:absolute;top:44px;left:50%;transform:translateX(-50%);text-align:center;text-shadow:0 1px 3px #000}
      #scorebar #kills{color:#ffb03a;font-size:15px;font-weight:800}
      #ktarget{opacity:.6;font-size:10px;letter-spacing:.14em}
      #abHud{--acc:#8fe3ff;position:absolute;left:18px;bottom:98px;min-width:150px;padding:7px 12px;border-left:3px solid var(--acc);background:linear-gradient(90deg,#000000aa,#00000022);border-radius:4px;text-shadow:0 1px 2px #000;transition:transform .12s,box-shadow .2s}
      #abHud .abName{font-size:10px;letter-spacing:.16em;color:var(--acc);font-weight:800}
      #abHud .abSkill{font-size:14px;font-weight:700}
      #abHud .abFoot{font-size:11px;color:#9aa4b2;display:flex;gap:6px;align-items:center;margin-top:1px}
      #abHud .abKey:empty{display:none}
      #abHud .abKey{border:1px solid #6b7688;border-radius:3px;padding:0 5px;font-weight:700;color:#e8e4da}
      #abHud.ready{box-shadow:0 0 14px -3px var(--acc)} #abHud.ready .abCd{color:var(--acc);font-weight:700}
      #abHud.cast{transform:scale(1.06)}
      #flash{position:absolute;inset:0;background:#fff;opacity:0;pointer-events:none;transition:opacity .1s}
      #mapBanner{position:absolute;top:68px;left:50%;transform:translateX(-50%) translateY(-8px);opacity:0;transition:.4s;text-align:center;pointer-events:none}
      #mapBanner.show{opacity:1;transform:translateX(-50%) translateY(0)}
      #mapBanner span{display:block;font-size:11px;letter-spacing:.3em;color:#4ad7e8}
      #mapBanner b{font-size:26px;letter-spacing:.14em}
      #mapReveal{position:fixed;inset:0;z-index:34;display:flex;flex-direction:column;align-items:center;justify-content:center;background:#0d1016;cursor:pointer;text-align:center;padding:16px}
      .mrLabel{font-size:13px;letter-spacing:.4em;color:#4ad7e8;margin-bottom:14px}
      .mrSwatch{width:min(360px,72vw);height:120px;border-radius:12px;margin-bottom:18px;box-shadow:0 10px 40px #0009}
      .mrName{font-size:clamp(30px,7vw,58px);letter-spacing:.12em;margin:0}
      .mrDesc{opacity:.7;margin-top:6px} .mrGo{margin-top:28px;font-size:12px;letter-spacing:.2em;opacity:.5}
      #agentSelect{position:fixed;inset:0;z-index:34;display:flex;flex-direction:column;align-items:center;justify-content:center;background:rgba(10,12,18,.96);padding:16px;text-align:center;overflow:auto}
      #agentTitle{font-size:14px;letter-spacing:.3em;color:#9aa4b2;margin-bottom:16px}
      #agentGrid{display:grid;grid-template-columns:repeat(3,minmax(110px,180px));gap:12px}
      .agentCard{--acc:#8fe3ff;background:#161a22;border:2px solid #2a2f3a;border-radius:12px;padding:10px;cursor:pointer;color:#e8e4da;transition:.15s;font-family:inherit}
      .agentCard:hover{transform:translateY(-2px)} .agentCard.sel{border-color:var(--acc);box-shadow:0 0 20px -4px var(--acc)}
      .agPortrait{height:70px;border-radius:8px;position:relative;margin-bottom:8px;overflow:hidden}
      .agInit{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;font-size:32px;font-weight:800;color:#ffffffcc}
      .agName{font-weight:800;letter-spacing:.06em} .agRole{font-size:10px;letter-spacing:.16em;color:var(--acc);margin-bottom:6px}
      .agSkill b{display:block;font-size:12px} .agSkill span{font-size:10px;opacity:.6;line-height:1.2;display:block;margin-top:2px}
      #lockBtn{margin-top:20px}
      #shop{position:fixed;inset:0;z-index:33;display:flex;flex-direction:column;align-items:center;padding:20px 12px;background:rgba(10,12,18,.92);overflow:auto}
      #shopHead{display:flex;align-items:center;gap:20px;margin-bottom:14px;flex-wrap:wrap;justify-content:center}
      #shopTitle{font-size:20px;letter-spacing:.2em;font-weight:800} #shopCredits{font-size:20px;font-weight:800;color:#ffd479}
      #shopClose{background:#2a2f3a;color:#e8e4da;border:0;border-radius:6px;padding:8px 18px;cursor:pointer;font-weight:700;font-family:inherit}
      #shopGrid{display:grid;grid-template-columns:repeat(auto-fit,minmax(120px,1fr));gap:10px;max-width:920px;width:100%}
      .shopCat{background:#12151c;border-radius:8px;padding:8px}
      .shopCatH{font-size:10px;letter-spacing:.16em;color:#8aa0b8;margin-bottom:6px}
      .shopItem{display:flex;justify-content:space-between;width:100%;background:#1b2029;border:1px solid #2a3038;color:#e8e4da;border-radius:6px;padding:8px 10px;margin-bottom:6px;cursor:pointer;font-size:13px;font-family:inherit;letter-spacing:.03em}
      .shopItem:hover{border-color:#ff7a1a} .shopItem .wp{color:#ffd479;font-weight:700}
      .shopItem.owned{border-color:#4ad7e8;box-shadow:inset 0 0 0 1px #4ad7e8} .shopItem.owned .wp{color:#4ad7e8}
      .shopItem.cant{opacity:.45} .shopItem.cant .wp{color:#e06c75}
      #shopHint{margin-top:14px;font-size:11px;opacity:.5;text-align:center}
      #abilityBtn{right:150px;bottom:150px;width:56px;height:56px;font-size:12px;border-color:#8fe3ff88;color:#8fe3ff}
      #shopBtn{right:34px;bottom:250px;width:50px;height:50px;font-size:18px}`;
    document.head.appendChild(st);
  }
  const hud = $("hud");
  const addTo = (parent, id, cls, html) => {
    if ($(id) || !parent) return;
    const d = document.createElement("div"); d.id = id; if (cls) d.className = cls; if (html != null) d.innerHTML = html;
    parent.appendChild(d);
  };
  addTo(hud, "flash", "", "");
  addTo(hud, "credits", "", "");
  addTo(hud, "scorebar", "", `<span id="kills">0</span><div id="ktarget"></div>`);
  addTo(hud, "abHud", "", `<div class="abName" id="abName"></div><div class="abSkill" id="abSkill"></div>` +
    `<div class="abFoot"><span class="abKey" id="abKey"></span><span class="abCd" id="abCd"></span></div>`);
  addTo(hud, "mapBanner", "hidden", "");
  addTo(document.body, "mapReveal", "hidden", "");
  addTo(document.body, "agentSelect", "hidden",
    `<div id="agentTitle"></div><div id="agentGrid"></div><button class="btn" id="lockBtn"></button>`);
  addTo(document.body, "shop", "hidden",
    `<div id="shopHead"><div id="shopTitle"></div><div id="shopCredits"></div><button id="shopClose"></button></div>` +
    `<div id="shopGrid"></div><div id="shopHint"></div>`);
  const tui = $("touchUI");
  if (tui && !$("abilityBtn")) { const b = document.createElement("div"); b.className = "tbtn"; b.id = "abilityBtn"; tui.appendChild(b); }
  if (tui && !$("shopBtn")) { const b = document.createElement("div"); b.className = "tbtn"; b.id = "shopBtn"; b.textContent = "🛒"; tui.appendChild(b); }
}

function setupMenus() {
  ensureOnlineDom();
  ensureBattleDom();
  $("mTitle").innerHTML = STR.title.replace("ARENA", '<span class="accent">ARENA</span>');
  $("mSub").textContent = STR.subtitle;
  $("startBtn").textContent = STR.start;
  $("mHelp").textContent = isTouch ? STR.help.touch : STR.help.desktop;
  $("pTitle").textContent = STR.paused;
  $("resumeBtn").textContent = STR.resume;
  $("pMenuBtn").textContent = STR.end.menu;
  $("againBtn").textContent = STR.end.again;
  $("eMenuBtn").textContent = STR.end.menu;

  // arena is always random — no picker (drop the old selection UI from either shell)
  $("mChoose")?.remove();
  $("mapCards")?.remove();
  if ($("abilityBtn")) $("abilityBtn").textContent = STR.touch.ability;

  // callsign
  const nameInp = $("nameInp");
  const defName = localStorage.getItem("gga-name") ||
    STR.bots[(Math.random() * STR.bots.length) | 0] + ((Math.random() * 90 + 10) | 0);
  nameInp.value = defName;
  nameInp.placeholder = STR.online.name;
  const saveName = () => {
    const v = nameInp.value.replace(/[^\w .\-]/g, "").trim().slice(0, 14);
    if (v) localStorage.setItem("gga-name", v);
    return v || defName;
  };

  $("onlineBtn").textContent =
    new URLSearchParams(location.search).get("room") ? STR.online.join : STR.online.play;
  $("mRandom").textContent = STR.online.randomMap;
  $("rbTxt").textContent = STR.online.waitShare;
  $("rbCopy").textContent = STR.online.copy;
  $("rbCopy").onclick = async () => {
    try { await navigator.clipboard.writeText($("rbLink").value); $("rbCopy").textContent = STR.online.copied; }
    catch { $("rbLink").select(); document.execCommand?.("copy"); }
    setTimeout(() => $("rbCopy").textContent = STR.online.copy, 1200);
  };

  $("onlineBtn").onclick = async () => {
    await AudioMan.init(); AudioMan.resume();
    NET.stop();
    NET.name = saveName();
    $("mStatus").textContent = STR.online.connecting;
    NET.tries = 0;
    NET.connect();
  };

  const begin = async () => {
    await AudioMan.init(); AudioMan.resume();
    NET.stop();
    $("mStatus").textContent = "";
    const map = randomMap();          // solo: reveal a random arena, pick an agent, then play
    showMapReveal(map, () => showAgentSelect(() => {
      startMatch(map, {});
      if (!isTouch) canvas.requestPointerLock?.();
    }));
  };
  $("startBtn").onclick = begin;
  $("againBtn").onclick = begin;
  $("eMenuBtn").onclick = () => { NET.stop(); backToMenu(""); };
  $("pMenuBtn").onclick = () => { NET.stop(); backToMenu(""); };
  $("resumeBtn").onclick = () => {
    $("pause").classList.add("hidden"); running = true;
    if (!isTouch) canvas.requestPointerLock?.();
  };

  // desktop: losing pointer lock mid-match = pause (solo) / hint (online — the world keeps moving)
  document.addEventListener("pointerlockchange", () => {
    if (!document.pointerLockElement && !inMenu && !match?.over && !isTouch && running && !shopOpen) {
      if (match.online) hud.center(STR.online.clickAim, 2);
      else { running = false; $("pause").classList.remove("hidden"); }
    }
  });
  canvas.addEventListener("click", () => {
    if (!inMenu && !match?.over && !document.pointerLockElement && !isTouch) canvas.requestPointerLock?.();
  });
}

/* ---------------- main loop ---------------- */
const devEl = $("dev");
const dev = new URLSearchParams(location.search).has("dev");
if (dev) devEl.style.display = "block";
let acc = 0, last = performance.now(), paused = false, frames = 0, fpsAt = last, fps = 0;
addEventListener("blur", () => paused = true);
addEventListener("focus", () => { paused = false; last = performance.now(); });

function frame(now) {
  requestAnimationFrame(frame);
  if (paused) { last = now; return; }
  acc += now - last; last = now;
  if (acc > 250) acc = 250;
  while (acc >= CFG.step) { update(CFG.step); acc -= CFG.step; }
  if (!inMenu && scene) render();
  if (dev && (frames++, now - fpsAt >= 500)) {
    fps = Math.round(frames * 1000 / (now - fpsAt)); frames = 0; fpsAt = now;
    devEl.textContent = fps + " fps\ncalls " + renderer.info.render.calls + "\ntris " + renderer.info.render.triangles;
  }
}

setupMenus();     // builds battle DOM (incl. touch buttons) first
setupTouch();     // then wires touch controls onto them
requestAnimationFrame(frame);
