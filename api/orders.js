// POST /api/orders   public — the website quote form saves a new order here
// GET  /api/orders   admin  — orders with server-side search, filters and pagination
//   ?view=list (default): page, pageSize, status, biz, q, from, to (YYYY-MM-DD), notify=failed
//   ?view=summary: stats for the overview (counts, revenue, 30-day dates, latest orders)
//   ?view=board:   every open and recent order, for the status board

const crypto = require("crypto");
const L = require("./_lib");
const A = require("./_auth");
const N = require("./_notify");

module.exports = L.handler(async (req, res) => {
  if (req.method === "POST") return createOrder(req, res);
  if (req.method === "GET") return listOrders(req, res);
  return L.send(res, 405, { error: "method_not_allowed" }, { Allow: "GET, POST" });
});

async function createOrder(req, res) {
  if (!L.storageReady()) return L.send(res, 503, { error: "storage_not_configured" });
  // The form posts from our own pages. Other sites' browsers can't submit orders on a visitor's behalf.
  if (!L.sameOrigin(req)) return L.send(res, 403, { error: "bad_origin" });
  const b = await L.readBody(req, 12_000);

  // Spam traps. Bots get a normal-looking reply so they don't adapt; nothing is saved.
  // 1) hidden "company" field real visitors never see; 2) forms submitted faster than a person can type.
  const elapsed = Number(b.elapsed);
  if (b.company || (Number.isFinite(elapsed) && elapsed >= 0 && elapsed < 1500)) {
    await suspicious(req, "spam_trap");
    return L.send(res, 201, { ok: true });
  }

  const name = L.clean(b.name, 80);
  const phone = L.clean(b.phone, 32);
  const digits = phone.replace(/\D/g, "");
  if (name.length < 2) return L.send(res, 400, { error: "invalid_name" });
  if (!/^[+\d\s()\-.]+$/.test(phone) || digits.length < 9 || digits.length > 15) return L.send(res, 400, { error: "invalid_phone" });

  const ip = L.ipHash(req);
  const okShort = await L.rateLimit("rl:order:" + ip, 5, 600);
  const okDay = okShort && (await L.rateLimit("rl:orderday:" + ip, 20, 86400));
  if (!okShort || !okDay) { await suspicious(req, "order_rate_limit"); return L.send(res, 429, { error: "too_many_requests" }); }

  const message = L.clean(b.message, 2000) || "—";
  const business = L.clean(b.business, 80) || "—";

  // Exactly-once: the form sends a random requestId and reuses it when the visitor retries.
  // A repeat of the same request (double click, network retry) returns the first order instead of a copy.
  const requestId = typeof b.requestId === "string" && /^[A-Za-z0-9_-]{8,64}$/.test(b.requestId) ? b.requestId : "";
  const fingerprint = crypto.createHash("sha256").update([digits, business, message].join("|")).digest("hex").slice(0, 24);
  const now = Date.now();
  const id = now.toString(36) + crypto.randomBytes(3).toString("hex");
  const reserve = [["SET", "odup:" + fingerprint, id, "NX", "EX", "600"]];
  if (requestId) reserve.unshift(["SET", "oreq:" + requestId, id, "NX", "EX", "86400"]);
  const reserved = await L.pipeline(reserve);
  if (reserved.some((r) => r !== "OK")) {
    // undo whichever key we did take, then answer with the original order
    const [prevReq, prevDup] = await L.pipeline([["GET", requestId ? "oreq:" + requestId : "-"], ["GET", "odup:" + fingerprint]]);
    const cleanup = [];
    if (requestId && reserved[0] === "OK") cleanup.push(["DEL", "oreq:" + requestId]);
    if (reserved[reserved.length - 1] === "OK") cleanup.push(["DEL", "odup:" + fingerprint]);
    if (cleanup.length) await L.pipeline(cleanup);
    const existing = (reserved[0] !== "OK" && requestId ? prevReq : prevDup) || prevReq || prevDup;
    return L.send(res, 200, { ok: true, id: existing, duplicate: true });
  }

  // Sequential, human-friendly order number (WC-0001 …). Starts after the orders that already exist.
  const [, number] = await L.pipeline([["SET", "orders:seq", String(await L.redis("ZCARD", "orders")), "NX"], ["INCR", "orders:seq"]]);

  const order = {
    id,
    number: Number(number),
    createdAt: now,
    updatedAt: now,
    status: "new",
    seen: false,
    name,
    phone,
    business,
    businessKey: L.BUSINESS_KEYS.includes(b.businessKey) ? b.businessKey : "other",
    budget: L.clean(b.budget, 60) || "—",
    budgetKey: L.BUDGET_KEYS.includes(b.budgetKey) ? b.budgetKey : "",
    message,
    language: L.clean(b.language, 30),
    langCode: L.clean(b.langCode, 8),
    page: L.clean(b.page, 200),
    price: null,
    notes: ""
  };

  await L.pipeline([
    ["SET", "order:" + order.id, JSON.stringify(order)],
    ["ZADD", "orders", String(order.createdAt), order.id],
    ["SET", "notify:" + order.id, JSON.stringify({})]
  ]);
  await L.audit(req, null, "order.created", "order:" + order.id, { number: order.number });

  // Saved. Notifications are best-effort from here: a failure is recorded and retried, never lost,
  // and never turns a saved order into an error for the visitor.
  try { await N.notifyOrder(order); } catch (e) { console.error("notify error:", e.message); }

  return L.send(res, 201, { ok: true, id: order.id, number: L.orderLabel(order) });
}

// Counts blocked requests; alerts once if a burst looks like abuse.
async function suspicious(req, kind) {
  try {
    const [n] = await L.pipeline([["INCR", "susp:" + kind], ["EXPIRE", "susp:" + kind, "3600", "NX"]]);
    if (n === 25) {
      await N.adminAlert({ type: "suspicious", key: kind, throttleSec: 6 * 3600, subject: "Unusual traffic on the order form", lines: [`${n} blocked submissions (${kind.replace(/_/g, " ")}) in the last hour.`, "The form keeps working for real visitors; no action is needed unless this continues."] });
    }
  } catch {}
}

// ---------- admin listing ----------
async function loadAll() {
  const ids = (await L.redis("ZRANGE", "orders", "0", "4999", "REV")) || [];
  if (!ids.length) return [];
  const [orders, notes] = await Promise.all([L.mgetJSON(ids.map((i) => "order:" + i)), L.mgetJSON(ids.map((i) => "notify:" + i))]);
  return orders.map((o, i) => o && { ...o, notify: summarizeNotify(notes[i]) }).filter(Boolean);
}

// Compact delivery status for lists: "sent" | "failed" | "pending" | "not_configured" | "" (older orders)
function summarizeNotify(n) {
  if (!n) return "";
  const st = [n.email?.status, n.telegram?.status].filter(Boolean);
  if (!st.length) return "pending";
  if (st.includes("failed")) return "failed";
  if (st.includes("sent")) return "sent";
  if (st.includes("pending") || st.includes("sending")) return "pending";
  return "not_configured";
}

function parseDay(s, end) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(s || ""))) return null;
  // calendar days are interpreted in Tashkent time (UTC+5), the business's time zone
  const t = Date.parse(s + "T00:00:00+05:00");
  return Number.isFinite(t) ? t + (end ? 864e5 : 0) : null;
}

async function listOrders(req, res) {
  const s = await A.requireAdmin(req, res);
  if (!s) return;
  const q = L.query(req);
  const view = String(q.view || "list");

  if (view === "summary") {
    // retry a few due notifications while the owner is looking (bounded; the cron job does the rest)
    await N.retryDue(2).catch((e) => console.error("retryDue:", e.message));
  }
  const all = await loadAll();

  if (view === "summary") {
    const by = (st) => all.filter((o) => o.status === st).length;
    const monthAgo = Date.now() - 31 * 864e5;
    const counts = Object.fromEntries(L.STATUSES.map((st) => [st, by(st)]));
    const byBiz = {};
    all.forEach((o) => { const k = o.businessKey || "other"; byBiz[k] = (byBiz[k] || 0) + 1; });
    return L.send(res, 200, {
      total: all.length,
      counts,
      week: all.filter((o) => o.createdAt >= Date.now() - 7 * 864e5).length,
      revenue: all.filter((o) => o.status === "done").reduce((sum, o) => sum + (Number(o.price) || 0), 0),
      notifyFailed: all.filter((o) => o.notify === "failed").length,
      byBiz,
      days: all.filter((o) => o.createdAt >= monthAgo).map((o) => o.createdAt),
      recent: all.slice(0, 6).map(slim),
      newest: all.slice(0, 20).map((o) => ({ id: o.id, name: o.name }))
    });
  }

  if (view === "board") {
    const cutoff = Date.now() - 90 * 864e5;
    const list = all.filter((o) => !["done", "cancelled"].includes(o.status) || o.updatedAt >= cutoff).slice(0, 500);
    return L.send(res, 200, { orders: list.map(slim) });
  }

  // list
  const status = L.STATUSES.includes(q.status) ? q.status : "";
  const biz = L.BUSINESS_KEYS.includes(q.biz) ? q.biz : "";
  const from = parseDay(q.from, false), to = parseDay(q.to, true);
  const text = L.clean(q.q, 100).toLowerCase();
  const failedOnly = q.notify === "failed";
  const pageSize = Math.min(100, Math.max(5, parseInt(q.pageSize, 10) || 25));
  const filtered = all.filter((o) =>
    (!status || o.status === status) &&
    (!biz || (o.businessKey || "other") === biz) &&
    (from == null || o.createdAt >= from) &&
    (to == null || o.createdAt < to) &&
    (!failedOnly || o.notify === "failed") &&
    (!text || [o.id, L.orderLabel(o), o.number, o.name, o.phone, o.message, o.business, o.notes, o.budget].join(" ").toLowerCase().includes(text))
  );
  const pages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const page = Math.min(pages, Math.max(1, parseInt(q.page, 10) || 1));
  const statusCounts = { all: all.length, ...Object.fromEntries(L.STATUSES.map((st) => [st, all.filter((o) => o.status === st).length])) };
  return L.send(res, 200, {
    // full=1 (CSV export) includes the whole message and the internal notes
    orders: filtered.slice((page - 1) * pageSize, page * pageSize).map((o) => q.full === "1" ? { ...slim(o), message: o.message, notes: o.notes || "", language: o.language || "" } : slim(o)),
    total: filtered.length, page, pages, pageSize, statusCounts
  });
}

// List rows don't need internal notes or the full message.
function slim(o) {
  return {
    id: o.id, number: o.number || null, label: L.orderLabel(o), createdAt: o.createdAt, updatedAt: o.updatedAt,
    status: o.status, seen: o.seen, name: o.name, phone: o.phone, business: o.business, businessKey: o.businessKey,
    budget: o.budget, price: o.price, message: String(o.message || "").slice(0, 160), notify: o.notify
  };
}
