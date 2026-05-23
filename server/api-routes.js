const crypto = require("crypto");
const definitions = require("./definitions");
const utils = require("./utils");
const storeLib = require("./store");

const {
  chapters, heroes, talents, upgradeDefs, evolutionDefs, roomModifiers,
  difficulties, coopAchievements, encyclopedia,
  getDailyChallenge, getWeeklyChallenge
} = definitions;

const rateLimits = new Map();

async function handleApi(req, res, url, ctx) {
  const { store, rooms, onlineUsers, mailTransporter, mailUser } = ctx;
  try {
    if (req.method === "GET" && url.pathname === "/api/meta") {
      return utils.sendJson(res, 200, { chapters, heroes, talents, upgradeDefs, evolutionDefs, roomModifiers, encyclopedia, difficulties, achievements: coopAchievements });
    }

    if (req.method === "GET" && url.pathname === "/api/online") {
      const publicRooms = [];
      for (const room of rooms.values()) {
        if (room.status !== "lobby" || !room.multiplayer || room.public === false) continue;
        publicRooms.push({
          code: room.code,
          chapter: room.chapter.name,
          chapterId: room.chapter.id,
          members: room.members.size,
          difficulty: room.difficulty || "normal",
          modifiers: (room.modifiers || []).map(m => ({ id: m.id, name: m.name, type: m.type }))
        });
      }
      return utils.sendJson(res, 200, { online: onlineUsers.size, rooms: publicRooms });
    }

    if (req.method === "GET" && url.pathname === "/api/weekly") {
      const weekly = getWeeklyChallenge();
      const weeklyBoard = (store.leaderboard || [])
        .filter(e => e.weeklySeed === weekly.seed)
        .sort((a, b) => b.score - a.score)
        .slice(0, 10)
        .map(e => ({ username: e.username, score: e.score, chapter: e.chapter }));
      return utils.sendJson(res, 200, { ...weekly, leaderboard: weeklyBoard });
    }

    if (req.method === "GET" && url.pathname === "/api/achievements") {
      const auth = storeLib.getSessionUser(req);
      return utils.sendJson(res, 200, { achievements: coopAchievements, unlocked: auth ? (auth.user.profile.achievements || []) : [] });
    }

    if (req.method === "GET" && url.pathname === "/api/me") {
      const auth = storeLib.getSessionUser(req);
      return utils.sendJson(res, 200, { user: auth ? storeLib.publicUser(auth.user) : null });
    }

    if (req.method === "POST" && url.pathname === "/api/send-code") {
      if (!utils.checkRateLimit("send-code:" + req.socket.remoteAddress, 4, 60000)) return utils.sendJson(res, 429, { error: "操作过于频繁，请稍后再试" });
      const body = await utils.readBody(req);
      const email = String(body.email || "").trim().toLowerCase();
      if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return utils.sendJson(res, 400, { error: "请输入有效的邮箱地址" });
      const existing = store.verificationCodes?.[email];
      if (existing && existing.lastSent && Date.now() - existing.lastSent < 60000) return utils.sendJson(res, 429, { error: "请等待 60 秒后再次发送" });
      const code = String(crypto.randomInt(100000, 1000000));
      store.verificationCodes[email] = { code, expires: Date.now() + 5 * 60 * 1000, lastSent: Date.now() };
      storeLib.saveStore();
      let emailSent = false;
      if (mailTransporter) {
        try {
          await mailTransporter.sendMail({
            from: mailUser,
            to: email,
            subject: "月蚀幸存者 - 验证码",
            text: `您的验证码是：${code}，请尽快完成验证，验证码5分钟内有效。`,
            html: `<div style="font-family:sans-serif;padding:20px;background:#0a0810;color:#e8e4f0;border-radius:12px"><h2 style="color:#f4c95d">月蚀幸存者</h2><p>您的验证码是：</p><h1 style="color:#f4c95d;letter-spacing:8px;font-size:36px">${code}</h1><p style="color:#888">5 分钟内有效。</p></div>`
          });
          emailSent = true;
        } catch (mailError) {
          console.error("Email send failed:", mailError.message);
        }
      }
      return utils.sendJson(res, 200, { ok: true, code: emailSent ? undefined : code });
    }

    if (req.method === "POST" && url.pathname === "/api/register") {
      if (!utils.checkRateLimit("register:" + req.socket.remoteAddress, 3, 60000)) return utils.sendJson(res, 429, { error: "注册过于频繁，请稍后再试" });
      const body = await utils.readBody(req);
      const username = String(body.username || "").trim();
      const password = String(body.password || "");
      const email = String(body.email || "").trim().toLowerCase();
      const code = String(body.code || "").trim();
      if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return utils.sendJson(res, 400, { error: "请输入有效的邮箱地址" });
      const stored = store.verificationCodes?.[email];
      if (!stored || stored.code !== code || stored.expires < Date.now()) return utils.sendJson(res, 400, { error: "验证码无效或已过期" });
      delete store.verificationCodes[email];
      if (!utils.validateUsername(username)) return utils.sendJson(res, 400, { error: "用户名需为 3-18 位中文、字母、数字或下划线" });
      if (!utils.validatePassword(password)) return utils.sendJson(res, 400, { error: "密码需为 4-64 位" });
      const key = username.toLowerCase();
      if (store.usernameIndex[key]) return utils.sendJson(res, 409, { error: "用户名已存在" });
      const id = crypto.randomUUID();
      const passwordHash = utils.hashPassword(password);
      const user = { id, username, usernameLower: key, email, salt: passwordHash.salt, hash: passwordHash.hash, createdAt: Date.now(), profile: storeLib.makeProfile(username) };
      store.users[id] = user;
      store.usernameIndex[key] = id;
      const sid = crypto.randomBytes(32).toString("hex");
      store.sessions[sid] = { userId: id, expires: Date.now() + 7 * 24 * 60 * 60 * 1000 };
      storeLib.saveStore();
      return utils.sendJson(res, 200, { user: storeLib.publicUser(user) }, { "Set-Cookie": utils.sessionCookie(sid) });
    }

    if (req.method === "POST" && url.pathname === "/api/login") {
      if (!utils.checkRateLimit("login:" + req.socket.remoteAddress, 8, 60000)) return utils.sendJson(res, 429, { error: "登录过于频繁，请稍后再试" });
      const body = await utils.readBody(req);
      const username = String(body.username || "").trim().toLowerCase();
      const password = String(body.password || "");
      const userId = store.usernameIndex[username];
      const user = userId ? store.users[userId] : null;
      if (!user || !utils.verifyPassword(password, user)) return utils.sendJson(res, 401, { error: "用户名或密码不正确" });
      const sid = crypto.randomBytes(32).toString("hex");
      store.sessions[sid] = { userId: user.id, expires: Date.now() + 7 * 24 * 60 * 60 * 1000 };
      storeLib.saveStore();
      return utils.sendJson(res, 200, { user: storeLib.publicUser(user) }, { "Set-Cookie": utils.sessionCookie(sid) });
    }

    if (req.method === "POST" && url.pathname === "/api/logout") {
      const sid = utils.parseCookies(req).mes_session;
      if (sid) delete store.sessions[sid];
      storeLib.saveStore();
      return utils.sendJson(res, 200, { ok: true }, { "Set-Cookie": utils.clearSessionCookie() });
    }

    if (req.method === "GET" && url.pathname === "/api/profile") {
      const auth = storeLib.getSessionUser(req);
      if (!auth) return utils.sendJson(res, 401, { error: "请先登录" });
      return utils.sendJson(res, 200, { profile: auth.user.profile, talents });
    }

    if (req.method === "POST" && url.pathname === "/api/profile") {
      const auth = storeLib.getSessionUser(req);
      if (!auth) return utils.sendJson(res, 401, { error: "请先登录" });
      const body = await utils.readBody(req);
      if (body.nickname) {
        const nickname = String(body.nickname).trim().slice(0, 18);
        if (nickname) auth.user.profile.nickname = nickname;
      }
      if (body.action === "buyTalent") {
        const id = String(body.talent || "");
        const def = talents[id];
        if (!def) return utils.sendJson(res, 400, { error: "未知天赋" });
        storeLib.normalizeProfile(auth.user);
        if ((auth.user.profile.storyProgress.unlockedChapter || 1) < (def.requiresChapter || 1)) {
          return utils.sendJson(res, 400, { error: `通关进度不足，需要解锁第 ${def.requiresChapter} 关` });
        }
        const missingTalent = (def.requiresTalent || []).find(req => (auth.user.profile.talents[req] || 0) <= 0);
        if (missingTalent) return utils.sendJson(res, 400, { error: `需要先点亮前置天赋：${talents[missingTalent]?.name || missingTalent}` });
        const level = auth.user.profile.talents[id] || 0;
        if (level >= def.max) return utils.sendJson(res, 400, { error: "天赋已满级" });
        const cost = utils.talentCost(def, level);
        if (auth.user.profile.moonDust < cost) return utils.sendJson(res, 400, { error: "月尘不足" });
        auth.user.profile.moonDust -= cost;
        auth.user.profile.talents[id] = level + 1;
      }
      storeLib.saveStore();
      return utils.sendJson(res, 200, { profile: auth.user.profile });
    }

    if (req.method === "GET" && url.pathname === "/api/friends") {
      const auth = storeLib.getSessionUser(req);
      if (!auth) return utils.sendJson(res, 401, { error: "请先登录" });
      storeLib.normalizeProfile(auth.user);
      const rows = auth.user.profile.friends
        .map(id => store.users[id])
        .filter(Boolean)
        .map(user => ({ id: user.id, username: utils.escapeHtml(user.username), nickname: utils.escapeHtml(user.profile?.nickname || user.username), unlockedChapter: user.profile?.storyProgress?.unlockedChapter || 1, online: Object.values(store.sessions).some(s => s.userId === user.id && s.expires > Date.now()) }));
      const incoming = (auth.user.profile.friendRequests?.incoming || [])
        .map(id => store.users[id])
        .filter(Boolean)
        .map(user => ({ id: user.id, username: utils.escapeHtml(user.username), nickname: utils.escapeHtml(user.profile?.nickname || user.username) }));
      const outgoing = (auth.user.profile.friendRequests?.outgoing || [])
        .map(id => store.users[id])
        .filter(Boolean)
        .map(user => ({ id: user.id, username: utils.escapeHtml(user.username), nickname: utils.escapeHtml(user.profile?.nickname || user.username) }));
      return utils.sendJson(res, 200, { rows, incoming, outgoing });
    }

    if (req.method === "POST" && url.pathname === "/api/friends") {
      const auth = storeLib.getSessionUser(req);
      if (!auth) return utils.sendJson(res, 401, { error: "请先登录" });
      const body = await utils.readBody(req);
      const action = String(body.action || "request");
      storeLib.normalizeProfile(auth.user);
      if (action === "accept") {
        const requesterId = String(body.userId || "");
        const requester = store.users[requesterId];
        if (!requester || !auth.user.profile.friendRequests.incoming.includes(requesterId)) return utils.sendJson(res, 404, { error: "好友申请不存在" });
        storeLib.normalizeProfile(requester);
        auth.user.profile.friendRequests.incoming = auth.user.profile.friendRequests.incoming.filter(id => id !== requesterId);
        requester.profile.friendRequests.outgoing = requester.profile.friendRequests.outgoing.filter(id => id !== auth.user.id);
        if (!auth.user.profile.friends.includes(requesterId)) auth.user.profile.friends.push(requesterId);
        if (!requester.profile.friends.includes(auth.user.id)) requester.profile.friends.push(auth.user.id);
        storeLib.saveStore();
        return utils.sendJson(res, 200, { ok: true });
      }
      if (action === "decline") {
        const requesterId = String(body.userId || "");
        const requester = store.users[requesterId];
        auth.user.profile.friendRequests.incoming = auth.user.profile.friendRequests.incoming.filter(id => id !== requesterId);
        if (requester) {
          storeLib.normalizeProfile(requester);
          requester.profile.friendRequests.outgoing = requester.profile.friendRequests.outgoing.filter(id => id !== auth.user.id);
        }
        storeLib.saveStore();
        return utils.sendJson(res, 200, { ok: true });
      }
      const username = String(body.username || "").trim().toLowerCase();
      const friendId = store.usernameIndex[username];
      const friend = friendId ? store.users[friendId] : null;
      if (!friend) return utils.sendJson(res, 404, { error: "找不到这个玩家" });
      if (friend.id === auth.user.id) return utils.sendJson(res, 400, { error: "不能添加自己" });
      storeLib.normalizeProfile(friend);
      if (auth.user.profile.friends.includes(friend.id)) return utils.sendJson(res, 400, { error: "已经是好友" });
      if (!auth.user.profile.friendRequests.outgoing.includes(friend.id)) auth.user.profile.friendRequests.outgoing.push(friend.id);
      if (!friend.profile.friendRequests.incoming.includes(auth.user.id)) friend.profile.friendRequests.incoming.push(auth.user.id);
      storeLib.saveStore();
      return utils.sendJson(res, 200, { ok: true });
    }

    if (req.method === "GET" && url.pathname === "/api/leaderboard") {
      const mode = url.searchParams.get("mode") || "story";
      const metric = url.searchParams.get("metric") || "score";
      const scope = url.searchParams.get("scope") || "all";
      const today = utils.dayKey();
      const rows = store.leaderboard
        .filter(row => row.mode === mode)
        .filter(row => scope !== "daily" || (row.day || utils.dayKey(row.at || 0)) === today)
        .sort((a, b) => {
          const av = metric === "kills" ? a.kills : a.score;
          const bv = metric === "kills" ? b.kills : b.score;
          return bv - av || b.score - a.score || b.kills - a.kills;
        })
        .slice(0, 30);
      return utils.sendJson(res, 200, { rows, metric, scope });
    }

    if (req.method === "GET" && url.pathname === "/api/daily-challenge") {
      return utils.sendJson(res, 200, getDailyChallenge());
    }

    return utils.sendJson(res, 404, { error: "Not found" });
  } catch (error) {
    return utils.sendJson(res, error.message === "invalid_json" ? 400 : 500, { error: error.message === "invalid_json" ? "JSON 格式不正确" : "服务器错误" });
  }
}

module.exports = { handleApi, rateLimits };
