// GET    /api/auth   — is the admin logged in, and is everything set up?
// POST   /api/auth   — log in with { password }
// DELETE /api/auth   — log out

const crypto = require("crypto");
const L = require("./_lib");

module.exports = async function handler(req, res) {
  const setup = { storage: L.storageReady(), password: L.passwordSet };

  if (req.method === "GET") {
    return L.send(res, 200, { loggedIn: L.isAdmin(req), setup });
  }

  if (req.method === "DELETE") {
    return L.send(res, 200, { ok: true }, { "Set-Cookie": L.sessionCookie("") });
  }

  if (req.method === "POST") {
    if (!setup.password) return L.send(res, 503, { error: "password_not_configured", setup });
    try {
      if (setup.storage) {
        const ipHash = crypto.createHash("sha256").update(L.clientIp(req)).digest("hex").slice(0, 16);
        if (!(await L.rateLimit("rl:login:" + ipHash, 10, 900))) return L.send(res, 429, { error: "too_many_attempts" });
      }
      const { password } = await L.readBody(req);
      if (!L.passwordMatches(password)) return L.send(res, 401, { error: "wrong_password" });
      return L.send(res, 200, { ok: true, setup }, { "Set-Cookie": L.sessionCookie(L.makeToken()) });
    } catch (e) {
      console.error(e);
      return L.send(res, 500, { error: "server_error" });
    }
  }

  return L.send(res, 405, { error: "method_not_allowed" }, { Allow: "GET, POST, DELETE" });
};
