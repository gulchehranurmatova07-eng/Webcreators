// GET    /api/order?id=…   admin — full order, notification delivery state and its change history
// PATCH  /api/order?id=…   admin — change status, agreed price, notes, seen
// POST   /api/order?id=…   admin — {action:"notify", force?} retry (or, with force, re-send) notifications
// DELETE /api/order?id=…   admin — delete an order

const L = require("./_lib");
const A = require("./_auth");
const N = require("./_notify");

module.exports = L.handler(async (req, res) => {
  const s = await A.requireAdmin(req, res);
  if (!s) return;

  const id = String(L.query(req).id || "");
  if (!L.isOrderId(id)) return L.send(res, 400, { error: "invalid_id" });
  const order = await L.getOrder(id);
  if (!order) return L.send(res, 404, { error: "not_found" });
  const target = "order:" + id;

  if (req.method === "GET") {
    const [notify, raw] = await Promise.all([N.getNotifyState(id), L.redis("LRANGE", "audit:" + target, "0", "49")]);
    const history = (raw || []).map((r) => { try { return JSON.parse(r); } catch { return null; } }).filter(Boolean)
      .map(({ at, action, details }) => ({ at, action, details }));
    return L.send(res, 200, { order: { ...order, label: L.orderLabel(order) }, notify: publicNotify(notify), history });
  }

  if (req.method === "PATCH") {
    const b = await L.readBody(req, 12_000);
    const changes = {};
    if (b.status !== undefined) {
      if (!L.STATUSES.includes(b.status)) return L.send(res, 400, { error: "invalid_status" });
      if (b.status !== order.status) {
        changes.status = { from: order.status, to: b.status };
        order.history = (order.history || []).concat({ from: order.status, to: b.status, at: Date.now() }).slice(-30);
        order.status = b.status;
      }
    }
    if (b.price !== undefined) {
      let price;
      if (b.price === null || b.price === "") price = null;
      else {
        const n = Number(b.price);
        if (!Number.isFinite(n) || n < 0 || n > 1e7) return L.send(res, 400, { error: "invalid_price" });
        price = Math.round(n * 100) / 100;
      }
      if (price !== order.price) { changes.price = { from: order.price, to: price }; order.price = price; }
    }
    if (b.notes !== undefined) {
      if (typeof b.notes !== "string") return L.send(res, 400, { error: "invalid_notes" });
      const notes = L.clean(b.notes, 4000);
      if (notes !== (order.notes || "")) { changes.notes = { length: notes.length }; order.notes = notes; }
    }
    if (b.seen !== undefined) order.seen = Boolean(b.seen);
    // id, number, createdAt, client fields etc. are never taken from the request
    order.updatedAt = Date.now();
    await L.saveOrder(order);
    if (Object.keys(changes).length) await L.audit(req, s, "order.updated", target, changes);
    return L.send(res, 200, { order: { ...order, label: L.orderLabel(order) } });
  }

  if (req.method === "POST") {
    const b = await L.readBody(req, 2000);
    if (b.action !== "notify") return L.send(res, 400, { error: "unknown_action" });
    // at most one manual send per order every 20 seconds
    if (!(await L.rateLimit("rl:resend:" + id, 1, 20))) return L.send(res, 429, { error: "too_many_requests" });
    const force = b.force === true;
    const before = await N.getNotifyState(id);
    const result = await N.notifyOrder(order, { force });
    if (result.busy) return L.send(res, 409, { error: "already_sending" });
    const after = result.state || (await N.getNotifyState(id));
    await L.audit(req, s, force ? "order.notify_resent" : "order.notify_retried", target, {
      email: `${before.email.status} → ${after.email.status}`, telegram: `${before.telegram.status} → ${after.telegram.status}`
    });
    return L.send(res, 200, { notify: publicNotify(after) });
  }

  if (req.method === "DELETE") {
    await L.pipeline([["DEL", "order:" + id], ["ZREM", "orders", id], ["DEL", "notify:" + id], ["ZREM", "notify:due", id]]);
    await L.audit(req, s, "order.deleted", target, { number: L.orderLabel(order), status: order.status });
    return L.send(res, 200, { ok: true });
  }

  return L.send(res, 405, { error: "method_not_allowed" }, { Allow: "GET, PATCH, POST, DELETE" });
});

function publicNotify(n) {
  const pick = (c) => ({ status: c.status, attempts: c.attempts, lastAttemptAt: c.lastAttemptAt, lastError: c.lastError, sentAt: c.sentAt, nextRetryAt: c.nextRetryAt });
  return { recorded: n.recorded, email: pick(n.email), telegram: pick(n.telegram), emailConfigured: N.emailConfigured(), telegramConfigured: N.telegramConfigured() };
}
