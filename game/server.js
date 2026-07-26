// Gun Game Arena — realtime room server. One instance runs per room shard
// (<base>/ws/<roomId>). Clients simulate their own movement, hp, credits and
// weapon; this server owns the roster, the kill scoreboard, win detection
// (first to KILL_TARGET), the match clock, map rotation and match resets, and
// relays fire/hit/ability events between clients.
import { DurableObject } from "cloudflare:workers";

const MAPS = ["dust", "neon", "frost"];
const KILL_TARGET = 30;                       // deathmatch: first to this wins
const NWEAPONS = 19;                          // arsenal size (weapon index bound)
const MATCH_TIME = 360;                       // seconds
const MAX_PLAYERS = 8;
const RESET_DELAY = 8;                        // seconds from "over" to next match
const GRACE_MS = 60000;                       // keep scores while a player reconnects
const MAX_SHOT_DMG = 160;                     // per-trigger damage cap (Operator = 150)
const AB_KINDS = new Set(["dash", "heal", "dismiss", "boom", "flash", "smoke"]);

export class GameServer extends DurableObject {
  constructor(ctx, env) {
    super(ctx, env);
    this.players = new Map();  // id -> {id,name,ws,alive,weapon,kills,deaths,goneAt}
    this.match = null;         // {map, left, over, started}
    this.timer = null;
    this.tickN = 0;
    this.resetLeft = -1;
  }

  fetch(request) {
    if ((request.headers.get("Upgrade") || "").toLowerCase() !== "websocket")
      return new Response("gun-game-arena", { status: 200 });
    const pair = new WebSocketPair();
    const [client, ws] = Object.values(pair);
    ws.accept();
    const conn = { id: null };
    ws.addEventListener("message", ev => {
      let m; try { m = JSON.parse(ev.data); } catch { return; }
      try { this.onMessage(ws, conn, m); } catch (e) { /* one bad message never kills the room */ }
    });
    const bye = () => { try { this.onGone(ws, conn); } catch (e) {} };
    ws.addEventListener("close", bye);
    ws.addEventListener("error", bye);
    return new Response(null, { status: 101, webSocket: client });
  }

  onMessage(ws, conn, m) {
    if (m.t === "join") return this.onJoin(ws, conn, m);
    const p = conn.id && this.players.get(conn.id);
    if (!p || p.ws !== ws) return;
    if (m.t === "s") this.onSnap(p, m);
    else if (m.t === "f") this.relay(p, { t: "f", id: p.id, w: p.weapon });
    else if (m.t === "hit") this.onHit(p, m);
    else if (m.t === "died") this.onDied(p, m);
    else if (m.t === "ab") this.onAbility(p, m);
  }

  onAbility(p, m) {
    if (!this.match || this.match.over || !p.alive || !AB_KINDS.has(m.kind)) return;
    const x = +m.x, y = +m.y, z = +m.z;
    if (![x, y, z].every(Number.isFinite)) return;
    this.relay(p, { t: "ab", id: p.id, kind: m.kind, x, y, z });
  }

  onJoin(ws, conn, m) {
    const id = String(m.id || "").slice(0, 24);
    if (!id) return;
    const name = String(m.name || "").replace(/[^\w .\-]/g, "").trim().slice(0, 14) || "Recruit";
    let p = this.players.get(id);
    if (p) {
      if (p.ws && p.ws !== ws) { try { p.ws.close(); } catch (e) {} }
      p.ws = ws; p.goneAt = 0; p.name = name; p.alive = true;
    } else {
      if (this.connected().length >= MAX_PLAYERS) {
        this.send(ws, { t: "error", code: "full" });
        try { ws.close(); } catch (e) {}
        return;
      }
      p = { id, name, ws, alive: true, weapon: 0, kills: 0, deaths: 0, goneAt: 0 };
      this.players.set(id, p);
    }
    conn.id = id;
    if (!this.match) this.newMatch(false);
    this.startTimer();
    this.send(ws, {
      t: "welcome", you: id, map: this.match.map, left: Math.ceil(this.match.left),
      over: this.match.over, players: this.roster(),
    });
    this.relay(p, { t: "join", id, name, weapon: p.weapon, kills: p.kills, deaths: p.deaths });
  }

  onSnap(p, m) {
    if (!Array.isArray(m.p) || m.p.length !== 3) return;
    const [x, y, z] = m.p.map(Number);
    if (![x, y, z].every(Number.isFinite) || Math.abs(x) > 40 || Math.abs(z) > 40 || y < -1 || y > 20) return;
    p.alive = !!m.a;
    p.weapon = Math.max(0, Math.min(NWEAPONS, (m.w | 0)));   // client owns weapon choice (bought)
    this.relay(p, { t: "s", id: p.id, p: [x, y, z], y: +m.y || 0, pi: +m.pi || 0, w: p.weapon, a: m.a ? 1 : 0 });
  }

  onHit(p, m) {
    if (!this.match || this.match.over || !p.alive) return;
    const tgt = this.players.get(String(m.target || ""));
    if (!tgt || !tgt.ws || !tgt.alive || tgt === p) return;
    const d = Math.min(Math.max(0, +m.d || 0), MAX_SHOT_DMG);
    if (d <= 0) return;
    this.send(tgt.ws, { t: "hit", from: p.id, d });
  }

  onDied(p, m) {
    if (!this.match || this.match.over || !p.alive) return;
    p.alive = false; p.deaths++;
    const k = m.killer && m.killer !== p.id ? this.players.get(String(m.killer)) : null;
    if (k && k.ws) k.kills++;
    this.broadcast({ t: "kill", v: p.id, k: k && k.ws ? k.id : null, kk: k?.kills, vd: p.deaths });
    if (k && k.ws && k.kills >= KILL_TARGET) this.endMatch(k);
  }

  endMatch(winner) {
    this.match.over = true;
    this.resetLeft = RESET_DELAY;
    this.broadcast({ t: "over", winner: winner ? winner.id : null, name: winner ? winner.name : "" });
  }

  newMatch(announce) {
    const prev = this.match ? this.match.map : null;
    const pool = MAPS.filter(m => m !== prev);
    const map = pool[(Math.random() * pool.length) | 0] || MAPS[0];
    for (const p of this.players.values()) {
      p.weapon = 0; p.kills = 0; p.deaths = 0; p.alive = !!p.ws;
    }
    this.match = { map, left: MATCH_TIME, over: false, started: this.connected().length >= 2 };
    this.resetLeft = -1;
    if (announce) this.broadcast({ t: "start", map, left: MATCH_TIME, players: this.roster() });
  }

  tick() {
    this.tickN++;
    const now = Date.now();
    for (const [id, p] of this.players)
      if (!p.ws && now - p.goneAt > GRACE_MS) this.players.delete(id);
    const n = this.connected().length;
    if (this.match && !this.match.over) {
      if (n >= 2) this.match.started = true;
      if (this.match.started && n >= 1) {
        this.match.left -= 1;
        if (this.match.left <= 0) { this.match.left = 0; this.endMatch(this.leader()); }
        else if (this.tickN % 5 === 0) this.broadcast({ t: "tick", left: this.match.left });
      }
    } else if (this.match && this.match.over && this.resetLeft >= 0) {
      if (--this.resetLeft <= 0) this.newMatch(true);
    }
    if (n === 0 && this.players.size === 0) { this.stopTimer(); this.match = null; }
  }

  leader() {
    let best = null, bp = -1;
    for (const p of this.players.values()) {
      if (!p.ws) continue;
      if (p.kills > bp) { best = p; bp = p.kills; }
    }
    return best;
  }

  onGone(ws, conn) {
    const p = conn.id && this.players.get(conn.id);
    if (!p || p.ws !== ws) return;
    p.ws = null; p.goneAt = Date.now(); p.alive = false;
    this.broadcast({ t: "leave", id: p.id });
  }

  connected() { return [...this.players.values()].filter(p => p.ws); }
  roster() {
    return this.connected().map(p => ({
      id: p.id, name: p.name, weapon: p.weapon, kills: p.kills, deaths: p.deaths,
    }));
  }
  send(ws, obj) { try { ws.send(JSON.stringify(obj)); } catch (e) {} }
  broadcast(obj) { const s = JSON.stringify(obj); for (const p of this.connected()) { try { p.ws.send(s); } catch (e) {} } }
  relay(from, obj) { const s = JSON.stringify(obj); for (const p of this.connected()) { if (p !== from) try { p.ws.send(s); } catch (e) {} } }
  startTimer() { if (!this.timer) this.timer = setInterval(() => { try { this.tick(); } catch (e) {} }, 1000); }
  stopTimer() { if (this.timer) { clearInterval(this.timer); this.timer = null; } }
}
