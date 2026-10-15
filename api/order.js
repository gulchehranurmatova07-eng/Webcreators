// PATCH  /api/order?id=…   admin — change status, agreed price, notes, seen
// DELETE /api/order?id=…   admin — delete an order

const L = require("./_lib");

module.exports = async function handler(req, res) {
  if (!L.storageReady()) return L.send(res, 503, { error: "storage_not_configured" });
  if (!L.isAdmin(req)) return L.send(res, 401, { error: "unauthorized" });

  const id = String(L.query(req).id || "");
  if (!/^[a-z0-9]{6,32}$/.test(id)) return L.send(res, 400, { error: "invalid_id" });

  try {
    const order = await L.getOrder(id);
    if (!order) return L.send(res, 404, { error: "not_found" });

    if (req.method === "PATCH") {
      const b = await L.readBody(req);
      if (b.status !== undefined) {
        if (!L.STATUSES.includes(b.status)) return L.send(res, 400, { error: "invalid_status" });
        if (b.status !== order.status) {
          order.history = (order.history || []).concat({ from: order.status, to: b.status, at: Date.now() }).slice(-30);
          order.status = b.status;
        }
      }
      if (b.price !== undefined) {
        if (b.price === null || b.price === "") order.price = null;
        else {
          const n = Number(b.price);
          if (!Number.isFinite(n) || n < 0 || n > 1e7) return L.send(res, 400, { error: "invalid_price" });
          order.price = Math.round(n * 100) / 100;
        }
      }
      if (b.notes !== undefined) order.notes = L.clean(b.notes, 4000);
      if (b.seen !== undefined) order.seen = Boolean(b.seen);
      order.updatedAt = Date.now();
      await L.saveOrder(order);
      return L.send(res, 200, { order });
    }

    if (req.method === "DELETE") {
      await L.pipeline([["DEL", "order:" + id], ["ZREM", "orders", id]]);
      return L.send(res, 200, { ok: true });
    }

    return L.send(res, 405, { error: "method_not_allowed" }, { Allow: "PATCH, DELETE" });
  } catch (e) {
    console.error(e);
    return L.send(res, 500, { error: "server_error" });
  }
};
