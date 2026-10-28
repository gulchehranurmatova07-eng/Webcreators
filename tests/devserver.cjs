// Minimal Vercel emulation: static files + /api/*.js handlers + vercel.json headers.
const http = require("http"), fs = require("fs"), path = require("path");
function start(root, port) {
  const conf = JSON.parse(fs.readFileSync(path.join(root, "vercel.json"), "utf8"));
  const types = { ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".css": "text/css", ".png": "image/png", ".jpg": "image/jpeg", ".webp": "image/webp", ".svg": "image/svg+xml", ".json": "application/json", ".woff2": "font/woff2", ".ico": "image/x-icon" };
  const srv = http.createServer(async (req, res) => {
    const url = new URL(req.url, "http://x");
    const headers = {};
    for (const rule of conf.headers) {
      const re = new RegExp("^" + rule.source.replace(/\(\.\*\)/g, "(.*)") + "$");
      if (re.test(url.pathname)) for (const h of rule.headers) headers[h.key] = h.value; // later rules win
    }
    for (const [k, v] of Object.entries(headers)) res.setHeader(k, v);
    req.headers["x-real-ip"] = req.headers["x-test-ip"] || "127.0.0.1";
    if (url.pathname.startsWith("/api/")) {
      const name = url.pathname.slice(5).replace(/\/$/, "");
      const file = path.join(root, "api", name + ".js");
      if (name.startsWith("_") || !fs.existsSync(file)) { res.statusCode = 404; return res.end("not found"); }
      req.query = Object.fromEntries(url.searchParams);
      try { await require(file)(req, res); } catch (e) { console.error(e); res.statusCode = 500; res.end("crash"); }
      return;
    }
    let p = path.join(root, decodeURIComponent(url.pathname));
    if (!p.startsWith(root)) { res.statusCode = 403; return res.end(); }
    if (fs.existsSync(p) && fs.statSync(p).isDirectory()) p = path.join(p, "index.html");
    if (!fs.existsSync(p)) { res.statusCode = 404; return res.end("not found"); }
    res.setHeader("Content-Type", types[path.extname(p)] || "application/octet-stream");
    fs.createReadStream(p).pipe(res);
  });
  return new Promise((r) => srv.listen(port, "127.0.0.1", () => r(srv)));
}
module.exports = { start };
