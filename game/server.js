// Gun Game Arena — realtime room server, Search & Destroy mode.
// One instance per room shard (<base>/ws/<roomId>). Clients simulate their own
// movement, hp, credits and weapon; this server owns teams, the round state
// machine, the spike (carry / drop / plant / defuse / detonate), round and
// match win conditions, and relays fire/hit/ability events between clients.
// (Solo deathmatch runs entirely client-side and never touches this server.)
import { DurableObject } from "cloudflare:workers";

const MAPS = ["haven"];                 // the S&D arena (client owns geometry/sites)
const MAX_PLAYERS = 10;                 // 5v5
const ROUNDS_TO_WIN = 13;              // first to 13 wins the match
const HALF = 12;                        // swap attack/defence after 12 rounds
const MAX_ROUNDS = 30;                  // hard cap (then most rounds wins)
const BUY_TIME = 10;                    // seconds
const ROUND_TIME = 100;                 // seconds to plant
const SPIKE_TIME = 40;                  // post-plant detonation timer
const END_TIME = 5;                     // between rounds
const GRACE_MS = 60000;
const MAX_SHOT_DMG = 160;
const NWEAPONS = 19;
const AB_KINDS = new Set(["dash", "heal", "dismiss", "boom", "flash", "smoke"]);
const SITES = new Set(["A", "B", "C"]);

export class GameServer extends DurableObject {
  constructor(ctx, env) {
    super(ctx, env);
    this.players = new Map();   // id -> {id,name,ws,team,alive,weapon,goneAt}
    this.match = null;          // round/phase state
    this.spike = null;          // {state,carrier,x,z,site,left}
    this.timer = null;
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
      try { this.onMessage(ws, conn, m); } catch (e) {}
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
    switch (m.t) {
      case "s": return this.onSnap(p, m);
      case "f": return this.relay(p, { t: "f", id: p.id, w: p.weapon });
      case "hit": return this.onHit(p, m);
      case "died": return this.onDied(p, m);
      case "ab": return this.onAbility(p, m);
      case "grab": return this.onGrab(p);
      case "plant": return this.onPlant(p, m);
      case "defuse": return this.onDefuse(p);
    }
  }

  // ---- roster / teams ----
  role(p) { return p.team === this.match.atkTeam ? "atk" : "def"; }
  connected() { return [...this.players.values()].filter(p => p.ws); }
  teamCount(t) { return this.connected().filter(p => p.team === t).length; }
  aliveTeam(t) { return this.connected().filter(p => p.team === t && p.alive).length; }
  roster() {
    return this.connected().map(p => ({ id: p.id, name: p.name, team: p.team, weapon: p.weapon, alive: p.alive }));
  }
  state() {
    return {
      phase: this.match.phase, roundN: this.match.roundN, left: Math.ceil(this.match.left),
      score: this.match.score.slice(), atkTeam: this.match.atkTeam,
    };
  }

  onJoin(ws, conn, m) {
    const id = String(m.id || "").slice(0, 24);
    if (!id) return;
    const name = String(m.name || "").replace(/[^\w .\-]/g, "").trim().slice(0, 14) || "Recruit";
    let p = this.players.get(id);
    if (p) {
      if (p.ws && p.ws !== ws) { try { p.ws.close(); } catch (e) {} }
      p.ws = ws; p.goneAt = 0; p.name = name;
    } else {
      if (this.connected().length >= MAX_PLAYERS) { this.send(ws, { t: "error", code: "full" }); try { ws.close(); } catch (e) {} return; }
      const team = this.teamCount(0) <= this.teamCount(1) ? 0 : 1;   // balance
      p = { id, name, ws, team, alive: false, weapon: 0, goneAt: 0 };
      this.players.set(id, p);
    }
    conn.id = id;
    if (!this.match) this.newMatch();
    else if (this.match.phase === "buy") p.alive = true;   // joined during buy → plays this round
    this.startTimer();
    this.send(ws, {
      t: "welcome", you: id, mode: "sd", map: this.match.map, team: p.team,
      state: this.state(), spike: this.spikeMsg(), players: this.roster(),
    });
    this.relay(p, { t: "join", id, name, team: p.team, weapon: p.weapon, alive: p.alive });
  }

  onSnap(p, m) {
    if (!Array.isArray(m.p) || m.p.length !== 3) return;
    const [x, y, z] = m.p.map(Number);
    if (![x, y, z].every(Number.isFinite) || Math.abs(x) > 60 || Math.abs(z) > 60 || y < -1 || y > 20) return;
    p.weapon = Math.max(0, Math.min(NWEAPONS, m.w | 0));
    this.relay(p, { t: "s", id: p.id, p: [x, y, z], y: +m.y || 0, pi: +m.pi || 0, w: p.weapon, a: m.a ? 1 : 0 });
  }

  onHit(p, m) {
    if (!this.match || this.match.phase !== "live" || !p.alive) return;
    const tgt = this.players.get(String(m.target || ""));
    if (!tgt || !tgt.ws || !tgt.alive || tgt === p || tgt.team === p.team) return;   // no friendly fire
    const d = Math.min(Math.max(0, +m.d || 0), MAX_SHOT_DMG);
    if (d > 0) this.send(tgt.ws, { t: "hit", from: p.id, d });
  }

  onAbility(p, m) {
    if (!this.match || this.match.phase === "end" || this.match.phase === "matchover" || !p.alive || !AB_KINDS.has(m.kind)) return;
    const x = +m.x, y = +m.y, z = +m.z;
    if (![x, y, z].every(Number.isFinite)) return;
    this.relay(p, { t: "ab", id: p.id, kind: m.kind, x, y, z });
  }

  onDied(p, m) {
    if (!this.match || !p.alive) return;
    p.alive = false;
    const k = m.killer && m.killer !== p.id ? this.players.get(String(m.killer)) : null;
    // drop the spike where the carrier fell
    if (this.spike && this.spike.state === "carried" && this.spike.carrier === p.id) {
      const x = Number.isFinite(+m.x) ? +m.x : 0, z = Number.isFinite(+m.z) ? +m.z : 0;
      this.spike = { state: "dropped", carrier: null, x, z, site: null };
      this.broadcast({ t: "spike", ...this.spikeMsg() });
    }
    this.broadcast({ t: "kill", v: p.id, k: k && k.ws ? k.id : null, aliveA: this.aliveTeam(0), aliveB: this.aliveTeam(1) });
    this.checkElim();
  }

  onGone(ws, conn) {
    const p = conn.id && this.players.get(conn.id);
    if (!p || p.ws !== ws) return;
    const wasAlive = p.alive;
    p.ws = null; p.goneAt = Date.now(); p.alive = false;
    if (this.spike && this.spike.state === "carried" && this.spike.carrier === p.id) {
      this.spike = { state: "dropped", carrier: null, x: 0, z: 0, site: null };
      this.broadcast({ t: "spike", ...this.spikeMsg() });
    }
    this.broadcast({ t: "leave", id: p.id });
    if (wasAlive && this.match && this.match.phase === "live") this.checkElim();
  }

  // ---- spike ----
  spikeMsg() {
    if (!this.spike) return { state: "none" };
    const s = this.spike;
    return { state: s.state, carrier: s.carrier, x: s.x, z: s.z, site: s.site, left: s.left };
  }
  onGrab(p) {
    if (!this.match || this.match.phase !== "live" || !p.alive) return;
    if (this.role(p) !== "atk" || !this.spike || this.spike.state !== "dropped") return;
    this.spike = { state: "carried", carrier: p.id, x: 0, z: 0, site: null };
    this.broadcast({ t: "spike", ...this.spikeMsg() });
  }
  onPlant(p, m) {
    if (!this.match || this.match.phase !== "live" || !p.alive) return;
    if (this.role(p) !== "atk" || !this.spike || this.spike.state !== "carried" || this.spike.carrier !== p.id) return;
    if (!SITES.has(m.site)) return;
    const x = Number.isFinite(+m.x) ? +m.x : 0, z = Number.isFinite(+m.z) ? +m.z : 0;
    this.spike = { state: "planted", carrier: null, x, z, site: m.site, left: SPIKE_TIME };
    this.match.left = SPIKE_TIME;
    this.broadcast({ t: "planted", site: m.site, x, z, spikeTime: SPIKE_TIME });
    this.broadcast({ t: "spike", ...this.spikeMsg() });
  }
  onDefuse(p) {
    if (!this.match || this.match.phase !== "live" || !p.alive) return;
    if (this.role(p) !== "def" || !this.spike || this.spike.state !== "planted") return;
    this.spike.state = "defused";
    this.broadcast({ t: "defused", by: p.id });
    this.endRound("def", "defuse");
  }

  // ---- round / match state machine ----
  newMatch() {
    this.match = {
      map: MAPS[0], phase: "buy", roundN: 1, left: BUY_TIME,
      score: [0, 0], atkTeam: 0,          // team 0 attacks the first half
    };
    this.startRound(true);
  }
  startRound(first) {
    const m = this.match;
    m.phase = "buy"; m.left = BUY_TIME;
    for (const p of this.players.values()) { p.alive = !!p.ws; p.weapon = 0; }
    // give the spike to a random connected attacker
    const atk = this.connected().filter(p => p.team === m.atkTeam);
    const carrier = atk.length ? atk[(Math.random() * atk.length) | 0].id : null;
    this.spike = { state: "carried", carrier, x: 0, z: 0, site: null };
    this.broadcast({
      t: "round", roundN: m.roundN, atkTeam: m.atkTeam, score: m.score.slice(),
      buyTime: BUY_TIME, spike: this.spikeMsg(), players: this.roster(),
    });
  }
  endRound(winnerRole, reason) {
    const m = this.match;
    if (m.phase === "end" || m.phase === "matchover") return;
    m.phase = "end"; m.left = END_TIME;
    const winTeam = winnerRole === "atk" ? m.atkTeam : 1 - m.atkTeam;
    m.score[winTeam]++;
    this.broadcast({ t: "roundend", winner: winnerRole, winTeam, reason, score: m.score.slice(), next: END_TIME });
    const done = m.score[winTeam] >= ROUNDS_TO_WIN || m.roundN >= MAX_ROUNDS;
    if (done) { m.pendingOver = winTeam; }
  }
  nextRound() {
    const m = this.match;
    if (m.pendingOver != null || m.score[0] >= ROUNDS_TO_WIN || m.score[1] >= ROUNDS_TO_WIN || m.roundN >= MAX_ROUNDS) {
      m.phase = "matchover";
      const winTeam = m.score[0] === m.score[1] ? -1 : (m.score[0] > m.score[1] ? 0 : 1);
      this.broadcast({ t: "matchover", winTeam, score: m.score.slice() });
      return;
    }
    m.roundN++;
    if (m.roundN === HALF + 1) m.atkTeam = 1 - m.atkTeam;   // swap sides at half
    this.startRound(false);
  }

  checkElim() {
    const m = this.match;
    if (!m || m.phase !== "live") return;
    const aliveAtk = this.connected().filter(p => this.role(p) === "atk" && p.alive).length;
    const aliveDef = this.connected().filter(p => this.role(p) === "def" && p.alive).length;
    const planted = this.spike && this.spike.state === "planted";
    if (aliveDef === 0) return this.endRound("atk", "elim");                 // defenders wiped → attackers win
    if (aliveAtk === 0 && !planted) return this.endRound("def", "elim");    // attackers wiped, no spike → defenders win
    // attackers wiped but spike planted → round continues (defenders must defuse before it blows)
  }

  tick() {
    const now = Date.now();
    for (const [id, p] of this.players) if (!p.ws && now - p.goneAt > GRACE_MS) this.players.delete(id);
    const m = this.match;
    if (!m) return;
    if (this.connected().length === 0) {
      if (this.players.size === 0) { this.stopTimer(); this.match = null; this.spike = null; }
      return;
    }
    if (m.phase === "matchover") return;
    m.left -= 1;
    if (m.phase === "buy") {
      if (m.left <= 0) { m.phase = "live"; m.left = ROUND_TIME; this.broadcast({ t: "phase", phase: "live", left: ROUND_TIME }); }
      else this.broadcast({ t: "tick", phase: "buy", left: m.left });
    } else if (m.phase === "live") {
      const planted = this.spike && this.spike.state === "planted";
      if (planted) this.spike.left = m.left;
      if (m.left <= 0) {
        if (planted) { this.spike.state = "detonated"; this.broadcast({ t: "detonated" }); this.endRound("atk", "detonate"); }
        else this.endRound("def", "time");
      } else this.broadcast({ t: "tick", phase: "live", left: m.left, planted: planted ? 1 : 0 });
    } else if (m.phase === "end") {
      if (m.left <= 0) this.nextRound();
    }
  }

  send(ws, o) { try { ws.send(JSON.stringify(o)); } catch (e) {} }
  broadcast(o) { const s = JSON.stringify(o); for (const p of this.connected()) { try { p.ws.send(s); } catch (e) {} } }
  relay(from, o) { const s = JSON.stringify(o); for (const p of this.connected()) { if (p !== from) try { p.ws.send(s); } catch (e) {} } }
  startTimer() { if (!this.timer) this.timer = setInterval(() => { try { this.tick(); } catch (e) {} }, 1000); }
  stopTimer() { if (this.timer) { clearInterval(this.timer); this.timer = null; } }
}
