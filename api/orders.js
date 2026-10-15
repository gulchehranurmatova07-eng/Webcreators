// POST /api/orders   public — the website quote form saves a new order here
// GET  /api/orders   admin  — list all orders (newest first)

const crypto = require("crypto");
const L = require("./_lib");

const BUSINESS_KEYS = ["restaurant", "hotel", "barber", "market", "clothing", "other"];
const BUDGET_KEYS = ["b1", "b2", "b3", "b4", "b5", "b6"];

module.exports = async function handler(req, res) {
  if (!L.storageReady()) return L.send(res, 503, { error: "storage_not_configured" });

  try {
    if (req.method === "POST") return await createOrder(req, res);
    if (req.method === "GET") return await listOrders(req, res);
    return L.send(res, 405, { error: "method_not_allowed" }, { Allow: "GET, POST" });
  } catch (e) {
    console.error(e);
    return L.send(res, 500, { error: "server_error" });
  }
};

async function createOrder(req, res) {
  const b = await L.readBody(req);

  // Honeypot: real visitors never fill the hidden "company" field.
  if (b.company) return L.send(res, 200, { ok: true });

  const name = L.clean(b.name, 80);
  const phone = L.clean(b.phone, 32);
  const digits = phone.replace(/\D/g, "");
  if (name.length < 2) return L.send(res, 400, { error: "invalid_name" });
  if (digits.length < 9 || digits.length > 15) return L.send(res, 400, { error: "invalid_phone" });

  const ip = L.clientIp(req);
  const ipHash = crypto.createHash("sha256").update(ip).digest("hex").slice(0, 16);
  if (!(await L.rateLimit("rl:order:" + ipHash, 8, 3600))) return L.send(res, 429, { error: "too_many_requests" });

  const now = Date.now();
  const order = {
    id: now.toString(36) + crypto.randomBytes(3).toString("hex"),
    createdAt: now,
    updatedAt: now,
    status: "new",
    seen: false,
    name,
    phone,
    business: L.clean(b.business, 80) || "—",
    businessKey: BUSINESS_KEYS.includes(b.businessKey) ? b.businessKey : "other",
    budget: L.clean(b.budget, 60) || "—",
    budgetKey: BUDGET_KEYS.includes(b.budgetKey) ? b.budgetKey : "",
    message: L.clean(b.message, 2000) || "—",
    language: L.clean(b.language, 30),
    langCode: L.clean(b.langCode, 8),
    page: L.clean(b.page, 200),
    price: null,
    notes: ""
  };

  await L.pipeline([
    ["SET", "order:" + order.id, JSON.stringify(order)],
    ["ZADD", "orders", String(order.createdAt), order.id]
  ]);
  await L.notifyTelegram(order);

  return L.send(res, 201, { ok: true, id: order.id });
}

async function listOrders(req, res) {
  if (!L.isAdmin(req)) return L.send(res, 401, { error: "unauthorized" });
  const ids = await L.redis("ZRANGE", "orders", "0", "999", "REV");
  if (!ids || !ids.length) return L.send(res, 200, { orders: [] });
  const raws = await L.redis("MGET", ...ids.map((id) => "order:" + id));
  const orders = raws.filter(Boolean).map((r) => JSON.parse(r));
  return L.send(res, 200, { orders });
}
