// GET /api/cron — scheduled by vercel.json. Retries order notifications whose backoff has expired
// and tidies the session index. Vercel sends "Authorization: Bearer <CRON_SECRET>"; anything else is refused.

const crypto = require("crypto");
const L = require("./_lib");
const N = require("./_notify");

module.exports = L.handler(async (req, res) => {
  const secret = L.CFG.cronSecret;
  const given = String(req.headers.authorization || "");
  const expected = "Bearer " + secret;
  const ok = secret && given.length === expected.length && crypto.timingSafeEqual(Buffer.from(given), Buffer.from(expected));
  if (!ok) return L.send(res, 401, { error: "unauthorized" });
  if (!L.storageReady()) return L.send(res, 503, { error: "storage_not_configured" });

  const retried = await N.retryDue(10);
  await L.redis("ZREMRANGEBYSCORE", "sessions", "-inf", String(Date.now()));
  return L.send(res, 200, { ok: true, retried });
});
