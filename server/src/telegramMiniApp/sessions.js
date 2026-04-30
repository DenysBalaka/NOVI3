const crypto = require("crypto");

const store = new Map();
const TTL_MS = 2 * 60 * 60 * 1000;

function createId() {
  return crypto.randomBytes(24).toString("hex");
}

function put(session) {
  const id = createId();
  store.set(id, { ...session, _id: id, _createdAt: Date.now() });
  return id;
}

function get(id) {
  const s = store.get(id);
  if (!s) return null;
  if (Date.now() - s._createdAt > TTL_MS) {
    store.delete(id);
    return null;
  }
  return s;
}

function remove(id) {
  store.delete(id);
}

setInterval(() => {
  const now = Date.now();
  for (const [id, s] of store.entries()) {
    if (now - s._createdAt > TTL_MS) store.delete(id);
  }
}, 10 * 60 * 1000).unref?.();

module.exports = { put, get, remove };
