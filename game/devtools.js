/* ============================================================================
 * devtools.js — Gun Game Arena / VANTAGE in-game developer framework.
 *
 * Loaded ONLY under ?dev (see game.js) so production ships without it and pays
 * zero cost. Self-contained, dependency-free. Provides:
 *   • developer console  (~ / Backquote)  — commands, cvars, history, autocomplete
 *   • debug overlay      (F1)             — fps/frame/mem/draw-calls/tris/net/ent
 *   • logging system                       — levels + categories + ring buffer
 *   • telemetry buffer                     — session/match/perf metrics
 *   • crash capture + diagnostic export    — window.onerror → downloadable report
 *
 * init(ctx) receives a handle to the running game:
 *   { renderer, camera, THREE, CFG, STR, NET, AudioMan,
 *     get scene(), get ents(), get player(), get match() }
 * ==========================================================================*/

const LEVELS = ["debug", "info", "warn", "error", "critical"];
const CATS = ["gameplay", "network", "animation", "audio", "physics",
              "rendering", "ai", "input", "ui", "save", "developer"];

export function init(ctx) {
  const dev = new Dev(ctx);
  window.__dev = dev;               // console handle for manual poking
  dev.log("info", "developer", "devtools online — press ~ for console, F1 for overlay");
  return dev;
}

class Dev {
  constructor(ctx) {
    this.ctx = ctx;
    this.sessionId = "s-" + Math.random().toString(36).slice(2, 10) + "-" + Date.now().toString(36);
    this.logs = [];              // ring buffer
    this.logCap = 500;
    this.cmdHistory = [];
    this.histIx = -1;
    this.cvars = {};
    this.commands = {};
    this.telemetry = this.freshTelemetry();
    this.frame = { fps: 0, ms: 0, ema: 16.6 };
    this._lastT = performance.now();
    this._frames = 0; this._at = this._lastT;
    this.overlayOn = false;
    this.dbg = { hitbox: false, spawns: false };
    this._helpers = null;

    this.buildUI();
    this.registerBuiltins();
    this.hookErrors();
    this.hookConsole();
    this.loop();
    this.telemetryTimer();
  }

  /* ---------------- logging ---------------- */
  log(level, cat, ...args) {
    const e = { t: Date.now(), level, cat, msg: args.map(fmt).join(" ") };
    this.logs.push(e);
    if (this.logs.length > this.logCap) this.logs.shift();
    if (this.consoleOpen && (LEVELS.indexOf(level) >= LEVELS.indexOf(this.minLevel))) this.print(e);
    if (level === "critical" || level === "error") this.telemetry.errors++;
    return e;
  }
  hookConsole() {
    const self = this;
    ["warn", "error"].forEach(k => {
      const orig = console[k].bind(console);
      console[k] = (...a) => { self.log(k === "warn" ? "warn" : "error", "developer", ...a); orig(...a); };
    });
  }
  hookErrors() {
    const self = this;
    addEventListener("error", ev => {
      self.log("critical", "developer", "Uncaught:", ev.message, "@", (ev.filename || "").split("/").pop() + ":" + ev.lineno);
      self.captureCrash(ev.error || new Error(ev.message));
    });
    addEventListener("unhandledrejection", ev => {
      self.log("critical", "developer", "Unhandled promise:", fmt(ev.reason));
      self.captureCrash(ev.reason instanceof Error ? ev.reason : new Error(fmt(ev.reason)));
    });
  }
  captureCrash(err) {
    const report = this.buildReport(err);
    try { localStorage.setItem("gga-lastcrash", JSON.stringify(report).slice(0, 200000)); } catch {}
    this.log("critical", "developer", "crash captured →  `export crash`  to download");
  }

  /* ---------------- diagnostic report ---------------- */
  buildReport(err) {
    const g = this.state();
    return {
      signature: err ? sig(err) : "manual-export",
      sessionId: this.sessionId,
      when: new Date().toISOString(),
      error: err ? { message: String(err.message || err), stack: String(err.stack || "").split("\n").slice(0, 20) } : null,
      game: g,
      settings: { fov: this.ctx.CFG.fov, dprCap: this.ctx.CFG.dprCap, step: this.ctx.CFG.step },
      hardware: hardware(this.ctx.renderer),
      os: { ua: navigator.userAgent, platform: navigator.platform, lang: navigator.language,
            cores: navigator.hardwareConcurrency, mem: navigator.deviceMemory, dpr: devicePixelRatio,
            screen: innerWidth + "x" + innerHeight, touch: matchMedia("(pointer:coarse)").matches },
      perf: { fps: this.frame.fps, frameMs: +this.frame.ema.toFixed(2),
              heapMB: perfHeap(), draws: this.ctx.renderer?.info.render.calls,
              tris: this.ctx.renderer?.info.render.triangles },
      telemetry: this.telemetrySnapshot(),
      recentCommands: this.cmdHistory.slice(-15),
      recentLogs: this.logs.slice(-60),
    };
  }
  state() {
    const p = this.ctx.player, m = this.ctx.match, ents = this.ctx.ents || [];
    return {
      map: m?.mapId || null, mode: m?.mode || null, online: !!m?.online, over: !!m?.over,
      timeLeft: m?.timeLeft, entities: ents.length, alive: ents.filter(e => e && e.alive).length,
      player: p ? { hp: r2(p.hp), pos: p.pos ? [r2(p.pos.x), r2(p.pos.y), r2(p.pos.z)] : null,
        weapon: p.weapon, agent: p.agent, credits: p.credits, team: p.team, nid: p.nid } : null,
      net: this.ctx.NET ? { id: this.ctx.NET.id, public: this.ctx.NET.public, connected: !!this.ctx.NET.ws } : null,
    };
  }

  /* ---------------- telemetry ---------------- */
  freshTelemetry() {
    return { sessionStart: Date.now(), errors: 0, fpsSamples: [], jumps: 0, shots: 0, hits: 0,
             interactions: 0, deaths: 0, matches: 0, deathLocations: [] };
  }
  telemetryTimer() {
    setInterval(() => {
      if (this.frame.fps) this.telemetry.fpsSamples.push(this.frame.fps);
      if (this.telemetry.fpsSamples.length > 600) this.telemetry.fpsSamples.shift();
    }, 1000);
  }
  telemetrySnapshot() {
    const t = this.telemetry, s = t.fpsSamples;
    return {
      sessionSec: Math.round((Date.now() - t.sessionStart) / 1000),
      avgFps: s.length ? Math.round(s.reduce((a, b) => a + b, 0) / s.length) : 0,
      minFps: s.length ? Math.min(...s) : 0,
      matches: t.matches, deaths: t.deaths, jumps: t.jumps,
      shots: t.shots, hits: t.hits, accuracy: t.shots ? +(t.hits / t.shots).toFixed(3) : 0,
      interactions: t.interactions, errors: t.errors,
      deathLocations: t.deathLocations.slice(-50),
    };
  }

  /* ---------------- perf sampler + overlay ---------------- */
  loop() {
    const step = now => {
      requestAnimationFrame(step);
      const dt = now - this._lastT; this._lastT = now;
      this.frame.ms = dt; this.frame.ema += (dt - this.frame.ema) * 0.1;
      this._frames++;
      if (now - this._at >= 500) { this.frame.fps = Math.round(this._frames * 1000 / (now - this._at)); this._frames = 0; this._at = now; }
      if (this.overlayOn) this.drawOverlay();
      if (this.dbg.hitbox || this.dbg.spawns || this.dbg.ai) this.updateHelpers();
    };
    requestAnimationFrame(step);
  }
  drawOverlay() {
    const r = this.ctx.renderer, info = r ? r.info : null, p = this.ctx.player, N = this.ctx.NET;
    const rows = [
      ["FPS", this.frame.fps, this.frame.fps >= 60 ? "ok" : this.frame.fps >= 30 ? "warn" : "bad"],
      ["Frame", this.frame.ema.toFixed(1) + " ms", this.frame.ema <= 16.7 ? "ok" : "warn"],
      ["Heap", perfHeap() + " MB", ""],
      ["Draws", info?.render.calls ?? "—", ""],
      ["Tris", info?.render.triangles ?? "—", ""],
      ["Verts", info ? approx(info.render.triangles * 3) : "—", ""],
      ["Programs", info?.programs?.length ?? "—", ""],
      ["Geoms", info?.memory.geometries ?? "—", ""],
      ["Textures", info?.memory.textures ?? "—", ""],
      ["Entities", (this.ctx.ents || []).length, ""],
      ["Player", p?.pos ? `${r2(p.pos.x)}, ${r2(p.pos.z)}` : "—", ""],
      ["HP", p ? r2(p.hp) : "—", ""],
      ["Net", N ? (N.ws ? (N.public ? "public" : "room") : "offline") : "—", N?.ws ? "ok" : ""],
      ["Server tick", this.ctx.match?.online ? "1 Hz" : "local", ""],
    ];
    this.ovl.innerHTML = `<b>DEBUG</b> <span class="dim">${this.sessionId}</span>` +
      rows.map(([k, v, c]) => `<div class="row"><span>${k}</span><i class="${c}">${v}</i></div>`).join("");
  }

  /* ---------------- visual debug helpers ---------------- */
  ensureHelpers() {
    const THREE = this.ctx.THREE, scene = this.ctx.scene;
    if (!THREE || !scene) return false;
    if (!this._helpers) { this._helpers = new THREE.Group(); this._helpers.name = "__devhelpers"; scene.add(this._helpers); }
    else if (!this._helpers.parent) scene.add(this._helpers);
    return true;
  }
  updateHelpers() {
    const THREE = this.ctx.THREE; if (!this.ensureHelpers()) return;
    const g = this._helpers; g.clear();
    if (this.dbg.hitbox) for (const e of (this.ctx.ents || [])) {
      if (!e || !e.alive || !e.pos) continue;
      const box = new THREE.Mesh(new THREE.BoxGeometry(0.8, 1.8, 0.8),
        new THREE.MeshBasicMaterial({ color: e === this.ctx.player ? 0x49e07a : 0xff4b4b, wireframe: true }));
      box.position.set(e.pos.x, e.pos.y + 0.9, e.pos.z); g.add(box);
    }
    if (this.dbg.spawns && this.ctx.scene?.userData?.spawns) for (const s of this.ctx.scene.userData.spawns) {
      const m = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.5, 0.1, 12),
        new THREE.MeshBasicMaterial({ color: 0x4ad7e8, wireframe: true }));
      m.position.set(s.x, 0.05, s.z); g.add(m);
    }
    if (this.dbg.ai) {
      const COL = { engage: 0xff4b4b, retreat: 0xff9a3a, search: 0xffd23b, roam: 0x2ec5c0 };
      for (const e of (this.ctx.ents || [])) {
        if (!e || e.isPlayer || e.remote || !e.alive || !e.pos) continue;
        const c = COL[e.aiState] ?? 0x8fe3ff;
        // state marker above the head
        const mk = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.35, 0.35), new THREE.MeshBasicMaterial({ color: c }));
        mk.position.set(e.pos.x, e.pos.y + 2.3, e.pos.z); g.add(mk);
        // facing ray (vision direction)
        const fx = -Math.sin(e.yaw), fz = -Math.cos(e.yaw);
        const fl = new THREE.Line(new THREE.BufferGeometry().setFromPoints([
          new THREE.Vector3(e.pos.x, e.pos.y + 1.5, e.pos.z),
          new THREE.Vector3(e.pos.x + fx * 4, e.pos.y + 1.5, e.pos.z + fz * 4)]),
          new THREE.LineBasicMaterial({ color: c })); g.add(fl);
        // line to current target
        if (e.target?.pos) {
          const tl = new THREE.Line(new THREE.BufferGeometry().setFromPoints([
            new THREE.Vector3(e.pos.x, e.pos.y + 1.5, e.pos.z),
            new THREE.Vector3(e.target.pos.x, e.target.pos.y + 1.5, e.target.pos.z)]),
            new THREE.LineBasicMaterial({ color: 0xff4b4b })); g.add(tl);
        }
        // last-seen memory marker
        if (!e.target && e.lastSeen) {
          const ls = new THREE.Mesh(new THREE.SphereGeometry(0.3, 8, 6), new THREE.MeshBasicMaterial({ color: 0xffd23b, wireframe: true }));
          ls.position.set(e.lastSeen.x, 1, e.lastSeen.z); g.add(ls);
        }
      }
    }
  }

  /* ---------------- console UI ---------------- */
  buildUI() {
    const st = document.createElement("style");
    st.textContent = `
    #devConsole{position:fixed;left:0;right:0;top:0;z-index:9999;display:none;flex-direction:column;
      font:12px ui-monospace,Menlo,Consolas,monospace;background:#0c0e12ee;border-bottom:2px solid #ff7a1a;
      max-height:46vh;box-shadow:0 8px 30px #000a}
    #devConsole.open{display:flex}
    #devOut{overflow:auto;padding:8px 10px;flex:1;color:#cfd3da;line-height:1.5}
    #devOut .l-warn{color:#ffd23b}#devOut .l-error{color:#ff6a6a}#devOut .l-critical{color:#ff3b3b;font-weight:700}
    #devOut .l-info{color:#8fe3ff}#devOut .cat{color:#6c727c}
    #devOut .cmd{color:#ff7a1a}
    #devIn{display:flex;gap:6px;padding:6px 10px;border-top:1px solid #23262b;background:#101318}
    #devIn span{color:#ff7a1a}#devIn input{flex:1;background:transparent;border:0;color:#e7e9ee;font:inherit;outline:none}
    #devAuto{color:#6c727c;padding:0 10px 6px;min-height:14px}
    #devOverlay{position:fixed;right:8px;top:8px;z-index:9998;display:none;font:11px ui-monospace,monospace;
      background:#0c0e12cc;border:1px solid #23262b;border-radius:6px;padding:8px 10px;color:#cfd3da;min-width:170px}
    #devOverlay.on{display:block}
    #devOverlay b{color:#ff7a1a;letter-spacing:.1em}#devOverlay .dim{color:#6c727c;font-size:9px}
    #devOverlay .row{display:flex;justify-content:space-between;gap:12px}
    #devOverlay i{font-style:normal}#devOverlay i.ok{color:#49e07a}#devOverlay i.warn{color:#ffd23b}#devOverlay i.bad{color:#ff6a6a}`;
    document.head.appendChild(st);

    this.el = document.createElement("div"); this.el.id = "devConsole";
    this.el.innerHTML = `<div id="devOut"></div><div id="devAuto"></div>
      <div id="devIn"><span>&gt;</span><input id="devInput" autocomplete="off" spellcheck="false" placeholder="type 'help'…"></div>`;
    document.body.appendChild(this.el);
    this.ovl = document.createElement("div"); this.ovl.id = "devOverlay"; document.body.appendChild(this.ovl);
    this.out = this.el.querySelector("#devOut");
    this.input = this.el.querySelector("#devInput");
    this.auto = this.el.querySelector("#devAuto");
    this.minLevel = "debug";

    addEventListener("keydown", e => {
      if (e.code === "Backquote") { e.preventDefault(); this.toggle(); }
      else if (e.code === "F1") { e.preventDefault(); this.overlayOn = !this.overlayOn; this.ovl.classList.toggle("on", this.overlayOn); }
    });
    this.input.addEventListener("keydown", e => this.onKey(e));
    this.input.addEventListener("input", () => this.showAuto());
  }
  toggle() {
    this.consoleOpen = !this.consoleOpen;
    this.el.classList.toggle("open", this.consoleOpen);
    if (this.consoleOpen) { this.out.innerHTML = ""; this.logs.slice(-40).forEach(e => this.print(e)); this.input.focus(); }
  }
  print(e) {
    const d = document.createElement("div");
    d.innerHTML = `<span class="cat">${new Date(e.t).toLocaleTimeString()} [${e.cat}]</span> <span class="l-${e.level}">${esc(e.msg)}</span>`;
    this.out.appendChild(d); this.out.scrollTop = this.out.scrollHeight;
  }
  echo(msg, cls = "") { const d = document.createElement("div"); if (cls) d.className = cls; d.innerHTML = esc(String(msg)); this.out.appendChild(d); this.out.scrollTop = this.out.scrollHeight; }

  onKey(e) {
    if (e.code === "Backquote") { e.preventDefault(); this.toggle(); return; }
    if (e.key === "Enter") { this.run(this.input.value); this.input.value = ""; this.auto.textContent = ""; }
    else if (e.key === "ArrowUp") { e.preventDefault(); this.nav(-1); }
    else if (e.key === "ArrowDown") { e.preventDefault(); this.nav(1); }
    else if (e.key === "Tab") { e.preventDefault(); this.complete(); }
  }
  nav(d) {
    if (!this.cmdHistory.length) return;
    this.histIx = this.histIx < 0 ? this.cmdHistory.length - 1 : Math.min(this.cmdHistory.length - 1, Math.max(0, this.histIx + d));
    this.input.value = this.cmdHistory[this.histIx] || "";
  }
  matches(prefix) { return Object.keys(this.commands).concat(Object.keys(this.cvars).map(c => c)).filter(n => n.startsWith(prefix)).sort(); }
  showAuto() { const p = this.input.value.split(/\s+/)[0]; this.auto.textContent = p ? this.matches(p).slice(0, 12).join("   ") : ""; }
  complete() { const p = this.input.value.split(/\s+/)[0]; const m = this.matches(p); if (m.length === 1) this.input.value = m[0] + " "; else if (m.length) this.echo(m.join("   "), "cat"); this.showAuto(); }

  run(line) {
    line = line.trim(); if (!line) return;
    this.cmdHistory.push(line); this.histIx = -1;
    this.echo("&gt; " + line, "cmd");
    const [name, ...args] = line.split(/\s+/);
    if (this.commands[name]) { try { this.commands[name].fn(args); } catch (err) { this.echo("error: " + err.message, "l-error"); } }
    else if (this.cvars[name]) this.cvar(name, args);
    else this.echo(`unknown: ${name} — try 'help' or 'find ${name}'`, "l-warn");
  }

  /* ---------------- cvars + commands ---------------- */
  addCvar(name, get, set, desc, cat = "developer") { this.cvars[name] = { get, set, desc, cat }; }
  cvar(name, args) {
    const c = this.cvars[name];
    if (!args.length) { this.echo(`${name} = ${fmt(c.get())}  ${c.set ? "" : "(read-only)"}  — ${c.desc}`); return; }
    if (!c.set) { this.echo(`${name} is read-only`, "l-warn"); return; }
    c.set(coerce(args.join(" "))); this.log("info", "developer", `cvar ${name} = ${fmt(c.get())}`);
  }
  cmd(name, cat, desc, fn) { this.commands[name] = { cat, desc, fn }; }

  registerBuiltins() {
    const C = this.ctx;
    // --- console meta ---
    this.cmd("help", "console", "list commands (help <category>)", a => {
      const cat = a[0];
      const cmds = Object.entries(this.commands).filter(([, c]) => !cat || c.cat === cat);
      const cats = [...new Set(Object.values(this.commands).map(c => c.cat))];
      if (!cat) this.echo("categories: " + cats.join(", "), "cat");
      cmds.sort().forEach(([n, c]) => this.echo(`  ${n.padEnd(14)} <span class="cat">${c.desc}</span>`));
      this.echo(`  cvars: ${Object.keys(this.cvars).join(", ")}`, "cat");
    });
    this.cmd("find", "console", "search commands/cvars", a => {
      const q = (a[0] || "").toLowerCase();
      const hits = [...Object.keys(this.commands), ...Object.keys(this.cvars)].filter(n => n.toLowerCase().includes(q));
      this.echo(hits.length ? hits.join("   ") : "no matches", "cat");
    });
    this.cmd("clear", "console", "clear output", () => this.out.innerHTML = "");
    this.cmd("loglevel", "console", "min level: debug|info|warn|error|critical", a => {
      if (LEVELS.includes(a[0])) { this.minLevel = a[0]; this.echo("loglevel = " + a[0]); } else this.echo("levels: " + LEVELS.join(", "), "l-warn");
    });
    this.cmd("log", "console", "dump last N logs (log 30 [cat])", a => {
      const n = +a[0] || 20, cat = a[1];
      this.logs.filter(e => !cat || e.cat === cat).slice(-n).forEach(e => this.print(e));
    });

    // --- overlay / visual debug ---
    this.cmd("overlay", "debug", "toggle the perf overlay", () => { this.overlayOn = !this.overlayOn; this.ovl.classList.toggle("on", this.overlayOn); });
    this.cmd("hitbox", "debug", "toggle entity hitbox wireframes", a => { this.dbg.hitbox = onoff(a[0], !this.dbg.hitbox); if (!this.dbg.hitbox && this._helpers) this._helpers.clear(); this.echo("hitbox " + (this.dbg.hitbox ? "on" : "off")); });
    this.cmd("spawns", "debug", "toggle spawn markers", a => { this.dbg.spawns = onoff(a[0], !this.dbg.spawns); if (!this.dbg.spawns && this._helpers) this._helpers.clear(); this.echo("spawns " + (this.dbg.spawns ? "on" : "off")); });

    // --- AI ---
    this.cmd("ai", "ai", "list bots: state / persona / hp / target", () => {
      const bots = (C.ents || []).filter(e => e && !e.isPlayer && !e.remote);
      if (!bots.length) return this.echo("no bots active (start a solo match)", "l-warn");
      bots.forEach(b => this.echo(`  ${(b.name || "bot").padEnd(8)} <span class="cat">${(b.aiState || "?").padEnd(8)} ${(b.persona || "?").padEnd(11)} hp:${r2(b.hp)} tgt:${b.target ? (b.target.name || "player") : "—"}</span>`));
      this.echo(`  difficulty = ${C.CFG.bot.difficulty}`, "cat");
    });
    this.cmd("aidiff", "ai", "set AI difficulty: beginner|easy|normal|hard|expert", a => {
      if (C.CFG.bot.levels[a[0]]) { C.CFG.bot.difficulty = a[0]; this.log("info", "ai", "difficulty =", a[0]); }
      else this.echo("levels: " + Object.keys(C.CFG.bot.levels).join(", "), "l-warn");
    });
    this.cmd("aidebug", "ai", "toggle AI state/vision/target overlay", a => { this.dbg.ai = onoff(a[0], !this.dbg.ai); if (!this.dbg.ai && this._helpers) this._helpers.clear(); this.echo("aidebug " + (this.dbg.ai ? "on" : "off")); });

    // --- game state ---
    this.cmd("state", "game", "dump game state", () => this.echo(JSON.stringify(this.state(), null, 1)));
    this.cmd("net", "game", "dump network info", () => this.echo(JSON.stringify(this.state().net, null, 1)));
    this.cmd("tp", "game", "teleport player: tp <x> <z>", a => {
      const p = C.player; if (!p?.pos) return this.echo("no player", "l-warn");
      p.pos.x = +a[0] || p.pos.x; p.pos.z = +a[1] || p.pos.z; this.log("info", "gameplay", "tp", p.pos.x, p.pos.z);
    });
    this.cmd("heal", "game", "set player HP (default 100)", a => { const p = C.player; if (p) { p.hp = a[0] ? +a[0] : 100; this.echo("hp = " + p.hp); } });
    this.cmd("timeleft", "game", "set match time remaining (s)", a => { if (C.match) { C.match.timeLeft = +a[0] || 0; this.echo("timeLeft = " + C.match.timeLeft); } });

    // --- telemetry + diagnostics ---
    this.cmd("telemetry", "data", "print telemetry snapshot", () => this.echo(JSON.stringify(this.telemetrySnapshot(), null, 1)));
    this.cmd("report", "data", "print a diagnostic report", () => this.echo(JSON.stringify(this.buildReport(null), null, 1)));
    this.cmd("export", "data", "download report|logs|telemetry|crash as JSON", a => this.export(a[0] || "report"));
    this.cmd("crashtest", "data", "throw an async error (verifies global capture)", () => {
      setTimeout(() => { throw new Error("crashtest — intentional"); }, 0);
      this.echo("async error thrown → captured by window.onerror → `export crash`");
    });

    // --- cvars (live-editable) ---
    this.addCvar("fov", () => C.CFG.fov, v => { C.CFG.fov = clamp(+v, 50, 120); if (C.camera) { C.camera.fov = C.CFG.fov; C.camera.updateProjectionMatrix(); } }, "field of view", "render");
    this.addCvar("dprCap", () => C.CFG.dprCap, v => C.CFG.dprCap = clamp(+v, 0.5, 3), "device-pixel-ratio cap (applies next resize)", "render");
    this.addCvar("timescale", () => this._ts ?? 1, v => this._ts = clamp(+v, 0.05, 4), "sim speed hint (read by build if wired)", "game");
    this.addCvar("fps", () => this.frame.fps, null, "current fps (read-only)", "data");
    this.addCvar("draws", () => C.renderer?.info.render.calls ?? 0, null, "draw calls (read-only)", "data");
    this.addCvar("heap", () => perfHeap(), null, "JS heap MB (read-only)", "data");
    this.addCvar("session", () => this.sessionId, null, "session id (read-only)", "data");
  }

  export(kind) {
    let data, name;
    if (kind === "crash") { const s = localStorage.getItem("gga-lastcrash"); if (!s) return this.echo("no captured crash", "l-warn"); data = s; name = "crash"; }
    else if (kind === "logs") { data = JSON.stringify(this.logs, null, 1); name = "logs"; }
    else if (kind === "telemetry") { data = JSON.stringify(this.telemetrySnapshot(), null, 1); name = "telemetry"; }
    else { data = JSON.stringify(this.buildReport(null), null, 1); name = "report"; }
    const blob = new Blob([data], { type: "application/json" });
    const a = document.createElement("a"); a.href = URL.createObjectURL(blob);
    a.download = `gga-${name}-${this.sessionId}.json`; a.click(); URL.revokeObjectURL(a.href);
    this.echo(`downloaded gga-${name}-*.json (${(data.length / 1024).toFixed(1)} KB)`);
  }

  /* public hooks the game may call to feed telemetry (optional) */
  onShot() { this.telemetry.shots++; }
  onHit() { this.telemetry.hits++; }
  onJump() { this.telemetry.jumps++; }
  onInteract() { this.telemetry.interactions++; }
  onDeath(x, z) { this.telemetry.deaths++; if (x != null) this.telemetry.deathLocations.push([r2(x), r2(z)]); }
  onMatch() { this.telemetry.matches++; }
}

/* ---------------- helpers ---------------- */
function fmt(v) { return typeof v === "object" ? (() => { try { return JSON.stringify(v); } catch { return String(v); } })() : String(v); }
function esc(s) { return String(s).replace(/[&<>]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" }[c])); }
function r2(n) { return Math.round(n * 100) / 100; }
function clamp(n, a, b) { return Math.max(a, Math.min(b, n)); }
function coerce(s) { if (s === "true") return true; if (s === "false") return false; const n = +s; return isNaN(n) ? s : n; }
function onoff(s, dflt) { if (s === "on" || s === "1" || s === "true") return true; if (s === "off" || s === "0" || s === "false") return false; return dflt; }
function approx(n) { return n >= 1e6 ? (n / 1e6).toFixed(1) + "M" : n >= 1e3 ? (n / 1e3).toFixed(1) + "k" : n; }
function perfHeap() { return performance.memory ? Math.round(performance.memory.usedJSHeapSize / 1048576) : "n/a"; }
function sig(err) { const s = String(err.stack || err.message || err).split("\n")[0]; return s.replace(/https?:\/\/[^ )]+/g, "").slice(0, 80); }
function hardware(renderer) {
  try {
    const gl = renderer?.getContext?.(); if (!gl) return { gpu: "n/a" };
    const ext = gl.getExtension("WEBGL_debug_renderer_info");
    return { gpu: ext ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) : "hidden",
             vendor: ext ? gl.getParameter(ext.UNMASKED_VENDOR_WEBGL) : "hidden",
             maxTex: gl.getParameter(gl.MAX_TEXTURE_SIZE) };
  } catch { return { gpu: "err" }; }
}
