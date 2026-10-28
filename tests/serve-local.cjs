// Local copy of the site with fake Redis and e-mail services, for manual testing and tests/browser-test.cjs.
// Run: node tests/serve-local.cjs   then open http://localhost:7310 (admin password below). Test data only.
Object.assign(process.env, {
  KV_REST_API_URL: "http://127.0.0.1:7311", KV_REST_API_TOKEN: "test-token",
  ADMIN_PASSWORD: "correct horse battery staple 42", AUTH_SECRET: "local-browser-test-secret-0123456789abcdef",
  RESEND_API_KEY: "re_test_key", RESEND_API_URL: "http://127.0.0.1:7312", EMAIL_FROM: "WebCreators <orders@notify.example.com>",
  ADMIN_NOTIFICATION_EMAIL: "owner@example.com", CRON_SECRET: "cron-test-secret"
});
const { redisServer, mailServer } = require("./mocks.cjs");
const { start } = require("./devserver.cjs");
const http = require("http");
(async () => {
  const rs = await redisServer(7311), ms = await mailServer(7312);
  await start(require("path").resolve(__dirname, ".."), 7310);
  // a pre-upgrade order: old status key, no number, no notification record
  const legacy = { id: "mgabc12345", createdAt: Date.now() - 5 * 864e5, updatedAt: Date.now() - 4 * 864e5, status: "contacted", seen: true, name: "Dilnoza Rahimova", phone: "+998 97 111 22 33", business: "Hotel", businessKey: "hotel", budget: "$500–800", budgetKey: "b3", message: "Hotel booking site", language: "Русский", langCode: "ru", page: "/", price: 650, notes: "Old note" };
  const R = (cmd) => fetch("http://127.0.0.1:7311", { method: "POST", headers: { Authorization: "Bearer test-token" }, body: JSON.stringify(cmd) });
  await R(["SET", "order:" + legacy.id, JSON.stringify(legacy)]); await R(["ZADD", "orders", String(legacy.createdAt), legacy.id]);
  // control endpoint for the browser test: inspect sent mail, switch failure mode
  http.createServer((req, res) => {
    const u = new URL(req.url, "http://x");
    if (u.pathname === "/mode") ms.state.mode = u.searchParams.get("m");
    res.setHeader("Content-Type", "application/json");
    res.end(JSON.stringify({ sent: ms.state.sent, mode: ms.state.mode }));
  }).listen(7313);
  console.log("ready");
})();
