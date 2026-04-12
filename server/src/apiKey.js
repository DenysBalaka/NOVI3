const crypto = require("crypto");

function generateApiKey() {
  return crypto.randomBytes(32).toString("hex");
}

function hashApiKey(key) {
  return crypto.createHash("sha256").update(key, "utf8").digest("hex");
}

module.exports = { generateApiKey, hashApiKey };
