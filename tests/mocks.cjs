// Local stand-ins: an Upstash-compatible Redis REST server and a Resend-compatible email API.
const http = require("http");

function redisServer(port) {
  const db = new Map(); // key -> {type, v, exp}
  const now = () => Date.now();
  const get = (k) => { const e = db.get(k); if (e && e.exp && e.exp <= now()) { db.delete(k); return undefined; } return e; };
  const zsorted = (z) => [...z.entries()].sort((a, b) => a[1] - b[1] || (a[0] < b[0] ? -1 : 1));
  const num = (s, inf) => s === "-inf" ? -Infinity : s === "+inf" ? Infinity : Number(s);
  function exec(cmd) {
    const [c, ...a] = cmd.map(String); const C = c.toUpperCase();
    switch (C) {
      case "GET": { const e = get(a[0]); return e ? e.v : null; }
      case "SET": {
        const [k, v, ...o] = a; const O = o.map((x) => x.toUpperCase());
        const e = get(k);
        if (O.includes("NX") && e) return null;
        if (O.includes("XX") && !e) return null;
        let exp = 0;
        const i = O.indexOf("EX"), j = O.indexOf("PX");
        if (i >= 0) exp = now() + Number(o[i + 1]) * 1000;
        if (j >= 0) exp = now() + Number(o[j + 1]);
        if (O.includes("KEEPTTL") && e) exp = e.exp;
        db.set(k, { type: "s", v, exp }); return "OK";
      }
      case "GETSET": { const e = get(a[0]); db.set(a[0], { type: "s", v: a[1], exp: 0 }); return e ? e.v : null; }
      case "DEL": { let n = 0; for (const k of a) if (get(k)) { db.delete(k); n++; } return n; }
      case "EXISTS": return a.filter((k) => get(k)).length;
      case "INCR": { const e = get(a[0]); const v = (e ? Number(e.v) : 0) + 1; db.set(a[0], { type: "s", v: String(v), exp: e ? e.exp : 0 }); return v; }
      case "EXPIRE": { const e = get(a[0]); if (!e) return 0; if ((a[2] || "").toUpperCase() === "NX" && e.exp) return 0; e.exp = now() + Number(a[1]) * 1000; return 1; }
      case "PTTL": { const e = get(a[0]); if (!e) return -2; if (!e.exp) return -1; return e.exp - now(); }
      case "MGET": return a.map((k) => { const e = get(k); return e ? e.v : null; });
      case "ZADD": { let e = get(a[0]); if (!e) { e = { type: "z", v: new Map(), exp: 0 }; db.set(a[0], e); } let n = 0; for (let i = 1; i < a.length; i += 2) { if (!e.v.has(a[i + 1])) n++; e.v.set(a[i + 1], Number(a[i])); } return n; }
      case "ZREM": { const e = get(a[0]); if (!e) return 0; let n = 0; for (const m of a.slice(1)) if (e.v.delete(m)) n++; return n; }
      case "ZCARD": { const e = get(a[0]); return e ? e.v.size : 0; }
      case "ZREMRANGEBYSCORE": { const e = get(a[0]); if (!e) return 0; let n = 0; for (const [m, s] of [...e.v]) if (s >= num(a[1]) && s <= num(a[2])) { e.v.delete(m); n++; } return n; }
      case "ZRANGE": {
        const e = get(a[0]); if (!e) return [];
        const O = a.slice(3).map((x) => x.toUpperCase());
        let items = zsorted(e.v);
        if (O.includes("BYSCORE")) {
          items = items.filter(([, s]) => s >= num(a[1]) && s <= num(a[2]));
          const li = O.indexOf("LIMIT"); if (li >= 0) items = items.slice(Number(a[3 + li + 1]), Number(a[3 + li + 1]) + Number(a[3 + li + 2]));
          return items.map(([m]) => m);
        }
        if (O.includes("REV")) items.reverse();
        let s = Number(a[1]), t = Number(a[2]); const n = items.length;
        if (s < 0) s += n; if (t < 0) t += n;
        return items.slice(s, t + 1).map(([m]) => m);
      }
      case "LPUSH": { let e = get(a[0]); if (!e) { e = { type: "l", v: [], exp: 0 }; db.set(a[0], e); } for (const x of a.slice(1)) e.v.unshift(x); return e.v.length; }
      case "LTRIM": { const e = get(a[0]); if (!e) return "OK"; let s = Number(a[1]), t = Number(a[2]); const n = e.v.length; if (s < 0) s += n; if (t < 0) t += n; e.v = e.v.slice(s, t + 1); return "OK"; }
      case "LRANGE": { const e = get(a[0]); if (!e) return []; let s = Number(a[1]), t = Number(a[2]); const n = e.v.length; if (s < 0) s += n; if (t < 0) t += n; return e.v.slice(s, t + 1); }
      case "LLEN": { const e = get(a[0]); return e ? e.v.length : 0; }
      case "FLUSHALL": db.clear(); return "OK";
      default: throw new Error("ERR unknown command " + C);
    }
  }
  const srv = http.createServer((req, res) => {
    let body = ""; req.on("data", (d) => (body += d)); req.on("end", () => {
      res.setHeader("Content-Type", "application/json");
      if (req.headers.authorization !== "Bearer test-token") { res.statusCode = 401; return res.end(JSON.stringify({ error: "Unauthorized" })); }
      const cmds = JSON.parse(body);
      if (req.url.startsWith("/pipeline")) return res.end(JSON.stringify(cmds.map((c) => { try { return { result: exec(c) }; } catch (e) { return { error: e.message }; } })));
      try { res.end(JSON.stringify({ result: exec(cmds) })); } catch (e) { res.statusCode = 400; res.end(JSON.stringify({ error: e.message })); }
    });
  });
  srv.db = db;
  return new Promise((r) => srv.listen(port, "127.0.0.1", () => r(srv)));
}

// Resend-like API. mode: "ok" | "fail500" | "fail422". Records every accepted email.
function mailServer(port) {
  const state = { mode: "ok", sent: [], calls: 0, idem: new Map() };
  const srv = http.createServer((req, res) => {
    let body = ""; req.on("data", (d) => (body += d)); req.on("end", () => {
      state.calls++;
      res.setHeader("Content-Type", "application/json");
      if (req.headers.authorization !== "Bearer re_test_key") { res.statusCode = 401; return res.end(JSON.stringify({ name: "missing_api_key", message: "API key is invalid" })); }
      if (state.mode === "fail500") { res.statusCode = 500; return res.end(JSON.stringify({ name: "internal_server_error", message: "Something went wrong" })); }
      if (state.mode === "fail422") { res.statusCode = 422; return res.end(JSON.stringify({ name: "validation_error", message: "The domain is not verified" })); }
      const key = req.headers["idempotency-key"];
      if (key && state.idem.has(key)) return res.end(JSON.stringify({ id: state.idem.get(key) }));
      const id = "msg_" + (state.sent.length + 1);
      if (key) state.idem.set(key, id);
      state.sent.push({ id, key, ...JSON.parse(body) });
      res.end(JSON.stringify({ id }));
    });
  });
  srv.state = state;
  return new Promise((r) => srv.listen(port, "127.0.0.1", () => r(srv)));
}
module.exports = { redisServer, mailServer };
