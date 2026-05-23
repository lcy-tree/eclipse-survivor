// 纯工具函数，不依赖 server.js 模块状态

function dayKey(time = Date.now()) {
  const date = new Date(time);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function sendJson(res, status, body, headers = {}) {
  res.writeHead(status, { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store", ...headers });
  res.end(JSON.stringify(body));
}

function parseCookies(req) {
  const raw = req.headers.cookie || "";
  const out = {};
  for (const part of raw.split(";")) {
    const [key, ...rest] = part.trim().split("=");
    if (key) out[key] = decodeURIComponent(rest.join("=") || "");
  }
  return out;
}

function sessionCookie(sid) {
  return `mes_session=${encodeURIComponent(sid)}; HttpOnly; SameSite=Lax; Path=/; Max-Age=604800`;
}

function clearSessionCookie() {
  return "mes_session=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0";
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let body = "";
    req.on("data", chunk => {
      body += chunk;
      if (body.length > 100000) {
        reject(new Error("body_too_large"));
        req.destroy();
      }
    });
    req.on("end", () => {
      if (!body) return resolve({});
      try {
        resolve(JSON.parse(body));
      } catch {
        reject(new Error("invalid_json"));
      }
    });
  });
}

function hashPassword(password, salt = require("crypto").randomBytes(16).toString("hex")) {
  const crypto = require("crypto");
  const hash = crypto.scryptSync(password, salt, 64).toString("hex");
  return { salt, hash };
}

function verifyPassword(password, user) {
  const crypto = require("crypto");
  const actual = crypto.scryptSync(password, user.salt, 64);
  const expected = Buffer.from(user.hash, "hex");
  return expected.length === actual.length && crypto.timingSafeEqual(expected, actual);
}

function escapeHtml(str) {
  return String(str).replace(/[&<>"']/g, c => ({ "&":"&amp;","<":"&lt;",">":"&gt;","\"":"&#34;","'":"&#39;" })[c]);
}

function validateUsername(username) {
  return typeof username === "string" && /^[\w一-龥]{3,18}$/u.test(username.trim());
}

function validatePassword(password) {
  return typeof password === "string" && password.length >= 6 && password.length <= 64;
}

// 简易内存速率限制
const rateLimits = new Map();
function checkRateLimit(key, maxAttempts = 6, windowMs = 60000) {
  const now = Date.now();
  const entry = rateLimits.get(key);
  if (!entry || now - entry.reset > windowMs) {
    rateLimits.set(key, { count: 1, reset: now });
    return true;
  }
  if (entry.count >= maxAttempts) return false;
  entry.count++;
  return true;
}

function talentCost(def, level) {
  const tier = Math.floor(level / 5);
  return Math.floor(def.baseCost * Math.pow(1.62, level) * (1 + tier * 0.18));
}

function getChapter(id, chapters) {
  return chapters.find(chapter => chapter.id === id);
}

function pick(list) {
  return list[Math.floor(Math.random() * list.length)];
}

function rand(min, max) {
  return min + Math.random() * (max - min);
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function distance(a, b) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

module.exports = {
  dayKey, sendJson, parseCookies, sessionCookie, clearSessionCookie,
  readBody, hashPassword, verifyPassword, escapeHtml,
  validateUsername, validatePassword, checkRateLimit, talentCost,
  getChapter, pick, rand, clamp, distance
};
