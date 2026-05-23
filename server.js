const http = require("http");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const nodemailer = require("nodemailer");
const { WebSocketServer } = require("ws");
const definitions = require("./server/definitions");
const utils = require("./server/utils");
const storeLib = require("./server/store");
const { SpatialGrid } = require("./server/spatial-grid");
const { handleApi } = require("./server/api-routes");

const root = __dirname;
const port = Number(process.env.PORT || 5173);
const dataDir = path.join(root, "data");
const storePath = path.join(dataDir, "store.json");
const tickMs = 33;
const TAU = Math.PI * 2;

// 从 .env 加载环境变量（开发模式免安装 dotenv）
try {
  const envPath = path.join(root, ".env");
  if (fs.existsSync(envPath)) {
    for (const line of fs.readFileSync(envPath, "utf8").split(/\r?\n/)) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const eq = trimmed.indexOf("=");
      if (eq > 0) process.env[trimmed.slice(0, eq).trim()] = trimmed.slice(eq + 1).trim();
    }
  }
} catch (_) { /* 安静降级 */ }

const mailUser = process.env.MAIL_USER;
const mailPass = process.env.MAIL_PASS;
const mailTransporter = mailUser && mailPass
  ? nodemailer.createTransport({
      host: "smtp.qq.com",
      port: 465,
      secure: true,
      auth: { user: mailUser, pass: mailPass }
    })
  : null;

const types = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".svg": "image/svg+xml; charset=utf-8",
  ".ogg": "audio/ogg",
  ".ttf": "font/ttf",
  ".txt": "text/plain; charset=utf-8"
};

const {
  chapterThemes, chapters, heroes, enemyDefs, talents,
  upgradeDefs, evolutionDefs, roomModifiers, difficulties, coopAchievements,
  encyclopedia: encDef, getDailyChallenge, getWeeklyChallenge,
  generateMonsterSvg, generateBossSvg, generateUpgradeSvg, generateTermSvg,
  svgWrap
} = definitions;
storeLib.init({ dataDir, storePath, talents });

// SVG图标注入到图鉴
const encyclopedia = { ...encDef, roomModifiers: encDef.roomModifiers };
for (const item of encyclopedia.monsters) { if (enemyDefs[item.id]) item.iconSvg = generateMonsterSvg(item.id, enemyDefs[item.id]); }
for (const [i, item] of encyclopedia.bosses.entries()) { if (chapterThemes[i]) item.iconSvg = generateBossSvg(i, chapterThemes[i]); }
for (const item of encyclopedia.upgrades) { const def = upgradeDefs.find(u => u.id === item.id); if (def) item.iconSvg = generateUpgradeSvg(item.id, def); }
for (const item of encyclopedia.terms) { item.iconSvg = generateTermSvg(item.name); }
for (const item of encyclopedia.roomModifiers) { item.iconSvg = generateModifierSvg(item); }

function generateModifierSvg(item) {
  const isBuff = item.type === "buff";
  const c = isBuff ? "#98df62" : "#ff5577";
  let body = `<rect width="128" height="128" rx="16" fill="#0a0810"/>`;
  body += `<circle cx="64" cy="64" r="48" fill="${c}" opacity="0.06"/>`;
  if (isBuff) {
    body += `<polygon points="64,20 96,88 32,88" fill="${c}" opacity="0.7"/>`;
    body += `<path d="M64 48 L64 72 M52 60 L76 60" stroke="#0a0810" stroke-width="4" stroke-linecap="round"/>`;
  } else {
    body += `<polygon points="64,108 32,40 96,40" fill="${c}" opacity="0.7"/>`;
    body += `<path d="M52 56 L76 80 M76 56 L52 80" stroke="#0a0810" stroke-width="4" stroke-linecap="round"/>`;
  }
  return svgWrap(body);
}

let store = storeLib.loadStore();
const rooms = new Map();
const sockets = new Set();
const onlineUsers = new Map();
let nextEntityId = 1;

function serveStatic(req, res, url) {
  const requestedPath = decodeURIComponent(url.pathname === "/" ? "/index.html" : url.pathname);
  const filePath = path.normalize(path.join(root, requestedPath));
  if (!filePath.startsWith(root)) {
    res.writeHead(403);
    res.end("Forbidden");
    return;
  }
  fs.readFile(filePath, (err, data) => {
    if (err) {
      res.writeHead(404);
      res.end("Not found");
      return;
    }
    res.writeHead(200, {
      "Content-Type": types[path.extname(filePath)] || "application/octet-stream",
      "Cache-Control": "no-store"
    });
    res.end(data);
  });
}

const server = http.createServer((req, res) => {
  const host = req.headers.host || `localhost:${port}`;
  const url = new URL(req.url, `http://${host}`);
  if (url.pathname.startsWith("/api/")) return handleApi(req, res, url, { store, rooms, onlineUsers, mailTransporter, mailUser });
  return serveStatic(req, res, url);
});

const wss = new WebSocketServer({ server, path: "/ws" });
wss.on("connection", (ws, req) => {
  const auth = storeLib.getSessionUser(req);
  const client = makeClient(ws, auth ? auth.user : null);
  sockets.add(client);
  onlineUsers.set(client.id, { userId: client.user?.id || null, username: client.user?.username || "游客" });
  client.send("hello", { user: client.user ? storeLib.publicUser(client.user) : null, chapters, heroes, talents, roomModifiers, difficulties });
});

function makeClient(ws, user) {
  const client = {
    id: crypto.randomUUID(),
    ws,
    user,
    roomCode: null,
    send(type, payload = {}) {
      if (ws.readyState !== 1) return; // WebSocket.OPEN
      ws.send(JSON.stringify({ type, ...payload }));
    }
  };
  ws.on("message", data => {
    try {
      const msg = JSON.parse(data.toString("utf8"));
      handleWsMessage(client, msg);
    } catch {
      client.send("error", { message: "消息格式不正确" });
    }
  });
  ws.on("close", () => disconnectClient(client));
  ws.on("error", () => disconnectClient(client));
  return client;
}

function handleWsMessage(client, msg) {
  const type = String(msg.type || "");
  if (type === "createRoom") return createRoom(client, msg);
  if (type === "joinRoom") return joinRoom(client, msg.code);
  if (type === "ready") return setReady(client, Boolean(msg.ready));
  if (type === "selectHero") return selectHero(client, msg.hero);
  if (type === "startRoom") return startRoom(client);
  if (type === "input") return setInput(client, msg);
  if (type === "chooseUpgrade") return chooseUpgrade(client, msg.choiceId);
  if (type === "chat") return roomChat(client, msg.text);
  if (type === "kickMember") return kickMember(client, msg.key);
  if (type === "inviteFriend") return inviteFriend(client, msg.userId);
  if (type === "togglePause") return togglePause(client);
  if (type === "leaveRoom") return leaveRoom(client);
}

function createRoom(client, msg) {
  const multiplayer = Boolean(msg.multiplayer);
  if (multiplayer && !client.user) return client.send("error", { message: "联机房间需要先登录" });
  const chapter = getChapter(Number(msg.chapterId) || 1);
  if (!chapter) return client.send("error", { message: "章节不存在" });
  if (client.user && chapter.id > (client.user.profile.storyProgress.unlockedChapter || 1)) {
    return client.send("error", { message: "章节尚未解锁" });
  }
  if (!client.user && chapter.id !== 1) return client.send("error", { message: "游客只能试玩第一章" });
  const diff = difficulties.find(d => d.id === msg.difficulty) || difficulties[0];
  leaveRoom(client);
  const code = makeRoomCode();
  const modifiers = selectedRoomModifiers(msg.modifiers);
  const room = {
    code,
    multiplayer,
    public: msg.public !== false,
    difficulty: diff.id,
    hostKey: memberKey(client),
    chapter,
    modifiers,
    modifierOptions: selectedRoomModifiers(msg.modifierOptions || msg.modifiers),
    status: "lobby",
    members: new Map(),
    time: 0,
    kills: 0,
    killTimeline: [],
    xp: 0,
    xpToNext: Math.floor(24 * modifierEffect(modifiers, "xpNeed", 1)),
    teamLevel: 1,
    spawnTimer: 1,
    eventTimer: 28,
    enemies: [],
    projectiles: [],
    enemyShots: [],
    pickups: [],
    hazards: [],
    effects: [],
    bossSpawned: false,
    paused: false,
    manualPaused: false,
    result: null,
    lastBroadcast: 0
  };
  rooms.set(code, room);
  addMember(room, client);
  client.send("roomCreated", { code });
  broadcastRoom(room);
}

function joinRoom(client, code) {
  if (!client.user) return client.send("error", { message: "加入联机房间需要先登录" });
  const room = rooms.get(String(code || "").trim().toUpperCase());
  if (!room) return client.send("error", { message: "房间不存在" });
  if (room.status !== "lobby" && !room.members.has(memberKey(client))) return client.send("error", { message: "房间已开始" });
  if (room.members.size >= 5 && !room.members.has(memberKey(client))) return client.send("error", { message: "房间已满" });
  leaveRoom(client);
  addMember(room, client);
  broadcastRoom(room);
}

function selectedRoomModifiers(raw) {
  const ids = Array.isArray(raw) ? raw.map(String) : [];
  return ids
    .map(id => roomModifiers.find(item => item.id === id))
    .filter(Boolean)
    .slice(0, 3);
}

function modifierEffect(modifiers, key, fallback) {
  let value = fallback;
  for (const modifier of modifiers || []) {
    if (modifier.effects && modifier.effects[key] !== undefined) {
      if (key === "chest" || key === "swarm") value += modifier.effects[key];
      else value *= modifier.effects[key];
    }
  }
  return value;
}

function addMember(room, client) {
  const key = memberKey(client);
  let member = room.members.get(key);
  if (!member) {
    const hero = client.user?.profile.lastHero || "astrid";
    member = makeMember(client, hero);
    room.members.set(key, member);
  } else {
    member.connected = true;
    member.client = client;
    member.disconnectAt = 0;
  }
  client.roomCode = room.code;
  client.send("roomJoined", { code: room.code });
}

function makeMember(client, heroId) {
  const hero = heroes[heroes[heroId] ? heroId : "astrid"];
  const bonus = talentBonus(client.user?.profile);
  return {
    key: memberKey(client),
    userId: client.user?.id || null,
    username: client.user?.profile.nickname || client.user?.username || "游客",
    connected: true,
    client,
    disconnectAt: 0,
    ready: false,
    hero: hero.id,
    x: Math.random() * 120 - 60,
    y: Math.random() * 120 - 60,
    hp: hero.hp + bonus.hp,
    maxHp: hero.hp + bonus.hp,
    speed: hero.speed + bonus.speed,
    damage: hero.damage * bonus.damage,
    cooldownBase: Math.max(0.18, hero.cooldown * bonus.cooldown),
    attackCd: Math.random() * 0.3,
    radius: 18,
    input: { x: 0, y: 0 },
    downed: false,
    downedTime: 0,
    rescue: 0,
    eliminated: false,
    kills: 0,
    multishot: bonus.startingMultishot,
    aura: bonus.auraBonus,
    auraCd: 1.5,
    regen: bonus.regen,
    contactMitigation: bonus.contactMitigation,
    projectileMitigation: 0,
    magnet: 0,
    pierce: 0,
    crit: 0,
    rangeBonus: 0,
    orbit: 0,
    orbitCd: 1,
    nova: 0,
    novaCd: 3,
    curse: 0,
    guardian: 0,
    guardianCd: 1,
    chainBounces: 0,
    lifesteal: 0,
    thorns: 0,
    thornsHeal: false,
    dashLevel: 0,
    dashShots: false,
    chainDamage: 0.4,
    evolved: [],
    deathWard: false,
    soulHarvest: false,
    starForgeArmor: false,
    crimsonTide: false,
    bossDamage: bonus.bossDamage,
    lowHpDamage: bonus.lowHpDamage,
    xpGain: bonus.xp,
    chestBonus: bonus.chest,
    pendingChoices: [],
    upgrades: {}
  };
}

function talentBonus(profile) {
  const t = profile?.talents || {};
  return {
    damage: 1 + (t.might || 0) * 0.035 + (t.execution || 0) * 0.018 + (t.finalOath || 0) * 0.018 + (t.deathmark || 0) * 0.012 + (t.overwhelm || 0) * 0.015 + (t.apocalypse || 0) * 0.04,
    bossDamage: 1 + (t.execution || 0) * 0.035 + (t.crown || 0) * 0.04 + (t.starfall || 0) * 0.03,
    hp: (t.vitality || 0) * 7 + (t.ward || 0) * 5 + (t.banner || 0) * 4 + (t.ironSkin || 0) * 3 + (t.endurance || 0) * 4 + (t.titanShell || 0) * 20,
    speed: (t.swiftness || 0) * 4 + (t.pathfinder || 0) * 3 + (t.momentum || 0) * 2 + (t.quickstep || 0) * 2,
    cooldown: Math.max(0.55, 1 - (t.focus || 0) * 0.025 - (t.voidcraft || 0) * 0.012 - (t.stellarForge || 0) * 0.015),
    reward: 1 + (t.fortune || 0) * 0.035 + (t.banker || 0) * 0.03 + (t.eclipse || 0) * 0.025 + (t.wealthSigil || 0) * 0.06,
    rescue: 1 + (t.rescue || 0) * 0.12 + (t.medic || 0) * 0.08 + (t.phoenixBond || 0) * 0.1,
    xp: 1 + (t.scholar || 0) * 0.035 + (t.alchemy || 0) * 0.02,
    chest: (t.scavenger || 0) * 0.008 + (t.prospector || 0) * 0.005 + (t.midasTouch || 0) * 0.015,
    contactMitigation: Math.min(0.35, (t.ward || 0) * 0.025 + (t.barrier || 0) * 0.02),
    regen: (t.regen || 0) * 0.08 + (t.moonRite || 0) * 0.05,
    lowHpDamage: (t.fury || 0) * 0.035 + (t.bloodrage || 0) * 0.02,
    startingMultishot: Math.floor((t.multistar || 0) / 3),
    auraBonus: Math.floor((t.voidcraft || 0) / 4),
    critDamage: 1 + (t.keenEdge || 0) * 0.025 + (t.starfall || 0) * 0.04,
    dodge: Math.min(0.25, (t.phaseShift || 0) * 0.03 + (t.timeWarp || 0) * 0.04),
    teamDamage: 1 + (t.tactician || 0) * 0.025 + (t.warlordOath || 0) * 0.04,
    teamHp: (t.banner || 0) * 4 + (t.guardianLink || 0) * 3,
    eliteDamage: 1 + (t.abyssalPact || 0) * 0.05,
    killDamage: (t.entropyWell || 0) * 0.003
  };
}

function memberKey(client) {
  return client.user ? `u:${client.user.id}` : `g:${client.id}`;
}

function getRoom(client) {
  return client.roomCode ? rooms.get(client.roomCode) : null;
}

function setReady(client, ready) {
  const room = getRoom(client);
  if (!room || room.status !== "lobby") return;
  const member = room.members.get(memberKey(client));
  if (!member) return;
  member.ready = ready;
  broadcastRoom(room);
}

function selectHero(client, heroId) {
  const room = getRoom(client);
  if (!room || room.status !== "lobby") return;
  if (!heroes[heroId]) return;
  const member = room.members.get(memberKey(client));
  if (!member) return;
  if (client.user && !client.user.profile.unlockedHeroes.includes(heroId)) return client.send("error", { message: "角色尚未解锁" });
  member.hero = heroId;
  if (client.user) client.user.profile.lastHero = heroId;
  const fresh = makeMember(client, heroId);
  Object.assign(member, fresh, { ready: member.ready });
  storeLib.saveStore();
  broadcastRoom(room);
}

function startRoom(client) {
  const room = getRoom(client);
  if (!room || room.status !== "lobby") return;
  const key = memberKey(client);
  if (room.hostKey !== key) return client.send("error", { message: "只有房主可以开始" });
  const members = [...room.members.values()];
  if (room.multiplayer) {
    if (members.length < 2) return client.send("error", { message: "联机闯关至少需要 2 人" });
    if (members.some(member => !member.ready && member.key !== room.hostKey)) return client.send("error", { message: "还有队友未准备" });
  }
  room.status = "running";
  room.time = 0;
  room.startedAt = Date.now();
  let i = 0;
  for (const member of members) {
    const a = (i++ / Math.max(1, members.length)) * Math.PI * 2;
    member.x = Math.cos(a) * 42;
    member.y = Math.sin(a) * 42;
    const hpScale = modifierEffect(room.modifiers, "hp", 1);
    member.maxHp = Math.max(1, Math.floor(member.maxHp * hpScale));
    member.hp = member.maxHp;
    member.downed = false;
    member.eliminated = false;
    member.pendingChoices = [];
  }
  broadcastRoom(room);
}

function togglePause(client) {
  const room = getRoom(client);
  if (!room || room.status !== "running") return;
  const member = room.members.get(memberKey(client));
  if (!member) return;
  // 只有房主或单人模式才能手动暂停
  if (room.multiplayer && room.hostKey !== memberKey(client)) return;
  room.manualPaused = !room.manualPaused;
  broadcastRoom(room);
}

function setInput(client, msg) {
  const room = getRoom(client);
  if (!room || room.status !== "running") return;
  if (isRoomPaused(room)) return;
  const member = room.members.get(memberKey(client));
  if (!member) return;
  const x = utils.clamp(Number(msg.x) || 0, -1, 1);
  const y = utils.clamp(Number(msg.y) || 0, -1, 1);
  const d = Math.hypot(x, y) || 1;
  member.input = { x: x / d, y: y / d };
}

function chooseUpgrade(client, choiceId) {
  const room = getRoom(client);
  if (!room) return;
  const member = room.members.get(memberKey(client));
  if (!member || !member.pendingChoices.length) return;
  const choice = member.pendingChoices.find(item => item.id === choiceId) || member.pendingChoices[0];
  applyUpgrade(member, choice.id);
  member.pendingChoices = [];
  room.paused = isRoomPaused(room);
  broadcastRoom(room);
}

function applyUpgrade(member, id) {
  const def = upgradeDefs.find(item => item.id === id);
  if (def && (member.upgrades[id] || 0) >= def.max) return;
  member.upgrades[id] = (member.upgrades[id] || 0) + 1;
  if (id === "might") member.damage *= 1.12;
  if (id === "speed") member.speed += 18;
  if (id === "cooldown") member.cooldownBase = Math.max(0.16, member.cooldownBase * 0.9);
  if (id === "vitality") {
    member.maxHp += 24;
    member.hp = Math.min(member.maxHp, member.hp + 42);
  }
  if (id === "multishot") member.multishot += 1;
  if (id === "aura") member.aura += 1;
  if (id === "pierce") member.pierce += 1;
  if (id === "crit") member.crit += 0.08;
  if (id === "chain") member.chainBounces = (member.chainBounces || 0) + 1;
  if (id === "magnet") member.magnet += 36;
  if (id === "lifesteal") member.lifesteal = (member.lifesteal || 0) + 3;
  if (id === "range") member.rangeBonus += 0.18;
  if (id === "shield") {
    member.contactMitigation = Math.min(0.6, (member.contactMitigation || 0) + 0.08);
    member.projectileMitigation = Math.min(0.5, (member.projectileMitigation || 0) + 0.08);
  }
  if (id === "recovery") member.regen += 0.22;
  if (id === "thorns") member.thorns = (member.thorns || 0) + 6;
  if (id === "orbit") member.orbit += 1;
  if (id === "dash") { member.speed += 10; member.dashLevel = (member.dashLevel || 0) + 1; }
  if (id === "nova") member.nova += 1;
  if (id === "curse") member.curse += 0.06;
  if (id === "guardian") member.guardian += 1;
  applyEvolutions(member);
}

function applyEvolutions(member) {
  for (const evolution of evolutionDefs) {
    if (member.evolved.includes(evolution.id)) continue;
    const ready = evolution.needs.every(id => {
      const def = upgradeDefs.find(item => item.id === id);
      return def && (member.upgrades[id] || 0) >= def.max;
    });
    if (!ready) continue;
    member.evolved.push(evolution.id);
    if (evolution.id === "solarLance") {
      member.damage *= 1.18;
      member.pierce += 2;
      member.bossDamage = (member.bossDamage || 1) + 0.25;
    }
    if (evolution.id === "stormHalo") {
      member.aura += 2;
      member.auraCd = Math.min(member.auraCd, 0.8);
    }
    if (evolution.id === "bloodComet") {
      member.crit += 0.12;
      member.splashCrit = true;
    }
    if (evolution.id === "pilgrimEngine") {
      member.magnet += 90;
      member.pickupHaste = 0;
    }
    if (evolution.id === "immortalLantern") {
      member.deathWard = true;
      member.projectileMitigation = Math.min(0.58, (member.projectileMitigation || 0) + 0.12);
      member.contactMitigation = Math.min(0.68, (member.contactMitigation || 0) + 0.12);
    }
    if (evolution.id === "eclipseGarden") {
      member.nova += 2;
      member.orbit += 2;
    }
    if (evolution.id === "thunderChain") {
      member.chainBounces = (member.chainBounces || 0) + 2;
      member.chainDamage = 0.7;
    }
    if (evolution.id === "bloodPact") {
      member.thornsHeal = true;
      member.lifesteal = (member.lifesteal || 0) + 2;
    }
    if (evolution.id === "phantomRush") {
      member.dashShots = true;
    }
    if (evolution.id === "soulHarvest") {
      member.soulHarvest = true;
      member.damage = (member.damage || 1) * 1.05;
    }
    if (evolution.id === "starForge") {
      member.starForgeArmor = true;
    }
    if (evolution.id === "crimsonTide") {
      member.crimsonTide = true;
    }
  }
}

function roomChat(client, text) {
  const room = getRoom(client);
  if (!room) return;
  const member = room.members.get(memberKey(client));
  const clean = String(text || "").trim().slice(0, 36);
  if (!clean || !member) return;
  const safe = utils.escapeHtml(clean);
  for (const target of room.members.values()) {
    if (target.connected) target.client.send("chat", { from: member.username, text: safe, at: Date.now() });
  }
}

function kickMember(client, targetKey) {
  const room = getRoom(client);
  if (!room || room.status !== "lobby") return;
  if (room.hostKey !== memberKey(client)) return client.send("error", { message: "只有房主可以踢人" });
  const key = String(targetKey || "");
  if (!key || key === room.hostKey) return;
  const member = room.members.get(key);
  if (!member) return;
  if (member.connected && member.client) {
    member.client.send("error", { message: "你已被房主移出房间" });
    member.client.send("kicked", {});
    member.client.roomCode = null;
  }
  room.members.delete(key);
  broadcastRoom(room);
}

function inviteFriend(client, userId) {
  const room = getRoom(client);
  if (!room || !client.user) return;
  storeLib.normalizeProfile(client.user);
  const friendId = String(userId || "");
  if (!client.user.profile.friends.includes(friendId)) return client.send("error", { message: "只能邀请好友" });
  for (const socketClient of sockets) {
    if (socketClient.user?.id === friendId) {
      socketClient.send("invite", { from: client.user.profile.nickname || client.user.username, code: room.code, chapter: room.chapter.name });
    }
  }
  client.send("chat", { from: "系统", text: "邀请已发送", at: Date.now() });
}

function leaveRoom(client) {
  const room = getRoom(client);
  if (!room) return;
  const key = memberKey(client);
  const member = room.members.get(key);
  if (member) {
    if (room.status === "running") {
      member.connected = false;
      member.client = null;
      member.disconnectAt = Date.now();
    } else {
      room.members.delete(key);
    }
  }
  client.roomCode = null;
  if (room.members.size === 0 || (room.status !== "running" && ![...room.members.values()].some(item => item.connected))) {
    rooms.delete(room.code);
  } else {
    if (!room.members.has(room.hostKey)) room.hostKey = [...room.members.keys()][0];
    broadcastRoom(room);
  }
}

function disconnectClient(client) {
  if (!sockets.has(client)) return;
  sockets.delete(client);
  onlineUsers.delete(client.id);
  leaveRoom(client);
}

function simulateRooms() {
  const dt = tickMs / 1000;
  const now = Date.now();
  for (const room of rooms.values()) {
    if (room.status === "running") simulateRoom(room, dt, now);
    if (room.status === "ended" && now - (room.endedAt || 0) > 120000) {
      rooms.delete(room.code);
      continue;
    }
    if (now - room.lastBroadcast > 40) broadcastRoom(room);
  }
}

function simulateRoom(room, dt, now) {
  room.paused = isRoomPaused(room);
  if (room.paused) return;
  room.time += dt;
  for (const member of room.members.values()) {
    if (!member.connected && member.disconnectAt && now - member.disconnectAt > 60000) {
      member.eliminated = true;
    }
  }
  // 构建空间哈希网格替代 O(n²) 遍历
  const memGrid = new SpatialGrid();
  memGrid.insertAll(aliveMembers(room));
  const eneGrid = new SpatialGrid();
  eneGrid.insertAll(room.enemies.filter(e => e.hp > 0));
  room._sg = { members: memGrid, enemies: eneGrid };

  updatePlayers(room, dt);
  updateSpawns(room, dt);
  updateEnemies(room, dt);
  updateProjectiles(room, dt);
  updateEnemyShots(room, dt);
  updatePickups(room, dt);
  updateHazards(room, dt);

  delete room._sg;
  checkRoomOutcome(room);
}

function activeMembers(room) {
  return [...room.members.values()].filter(member => !member.eliminated);
}

function aliveMembers(room) {
  return activeMembers(room).filter(member => !member.downed && member.hp > 0);
}

function pressureFor(room) {
  const count = Math.max(1, activeMembers(room).length);
  return [0, 1, 1.6, 2.2, 2.8, 3.4][count] || 3.4;
}

function updatePlayers(room, dt) {
  const alive = aliveMembers(room);
  for (const member of activeMembers(room)) {
    if (member.downed) {
      member.downedTime += dt;
      const rescuer = alive.find(other => other.key !== member.key && utils.distance(other, member) < 58);
      if (rescuer) {
        const bonus = talentBonus(store.users[rescuer.userId]?.profile).rescue || 1;
        const rescueMod = modifierEffect(room.modifiers, "rescueSpeed", 1);
        member.rescue += dt * bonus * (1 / rescueMod);
        if (member.rescue >= 2.4) {
          member.downed = false;
          member.downedTime = 0;
          member.rescue = 0;
          if (rescuer.userId) {
            const user = store.users[rescuer.userId];
            if (user) user.profile.coopStats.rescues = (user.profile.coopStats.rescues || 0) + 1;
          }
          const hpMod = modifierEffect(room.modifiers, "downPenalty", 1);
          member.hp = Math.max(36, member.maxHp * (0.38 + (1 - hpMod) * 0.2));
          room.effects.push(effect("revive", member.x, member.y, "#7fe0c4"));
        }
      } else {
        member.rescue = Math.max(0, member.rescue - dt * 0.25);
      }
      if (member.downedTime >= 30) member.eliminated = true;
      continue;
    }

    if (member.hp <= 0) {
      if (member.deathWard) {
        member.deathWard = false;
        member.hp = Math.max(48, member.maxHp * 0.42);
        room.effects.push(effect("revive", member.x, member.y, "#98df62"));
        continue;
      }
      member.downed = true;
      member.downedTime = 0;
      member.rescue = 0;
      continue;
    }

    if (member.regen > 0) {
      member.hp = Math.min(member.maxHp, member.hp + member.regen * dt);
    }
    const input = member.connected ? member.input : botInput(room, member);
    const panicSpeed = member.hp < member.maxHp * 0.32 && (member.upgrades.speed || 0) > 1 ? 1.08 : 1;
    const hasteSpeed = member.pickupHaste > 0 ? 1.16 : 1;
    member.x += input.x * member.speed * panicSpeed * hasteSpeed * dt;
    member.y += input.y * member.speed * panicSpeed * hasteSpeed * dt;
    member.attackCd -= dt;
    member.auraCd -= dt;
    member.orbitCd -= dt;
    member.novaCd -= dt;
    member.guardianCd -= dt;
    if (member.pickupHaste > 0) member.pickupHaste -= dt;
    if (member.attackCd <= 0) {
      firePlayerShot(room, member);
      member.attackCd = member.cooldownBase;
    }
    if (member.aura > 0 && member.auraCd <= 0) {
      room.hazards.push({ id: nextId(), type: "aura", owner: member.key, x: member.x, y: member.y, r: 96 + member.aura * 14, damage: 10 + member.aura * 5, life: 0.65, color: "#7fe0c4" });
      member.auraCd = Math.max(1.2, 4 - member.aura * 0.35);
    }
    if (member.orbit > 0 && member.orbitCd <= 0) {
      room.hazards.push({ id: nextId(), type: "aura", owner: member.key, x: member.x, y: member.y, r: 116 + member.orbit * 16, damage: 14 + member.orbit * 7, life: 0.45, color: "#c7f9ff" });
      member.orbitCd = Math.max(0.75, 2.4 - member.orbit * 0.18);
    }
    if (member.nova > 0 && member.novaCd <= 0) {
      const voidNovaR = member.evolved.includes("voidNova") ? 40 : 0;
      room.hazards.push({ id: nextId(), type: "aura", owner: member.key, x: member.x, y: member.y, r: 150 + member.nova * 22 + voidNovaR, damage: 22 + member.nova * 12, life: member.evolved.includes("eclipseGarden") ? 1.2 : 0.55, color: "#ffe08a" });
      member.novaCd = Math.max(2.2, 8 - member.nova * 0.55);
    }
    if (member.guardian > 0 && member.guardianCd <= 0) {
      const target = nearestEnemy(room, member, 620);
      if (target) {
        const a = Math.atan2(target.y - member.y, target.x - member.x);
        room.projectiles.push({ id: nextId(), owner: member.key, x: member.x, y: member.y, vx: Math.cos(a) * 460, vy: Math.sin(a) * 460, r: 9, damage: member.damage * (0.55 + member.guardian * 0.18), pierce: 1, life: 1.8, color: "#b8ffce" });
      }
      member.guardianCd = Math.max(0.7, 1.7 - member.guardian * 0.18);
    }
  }
}

function botInput(room, member) {
  // 优先救援倒地队友
  const downed = [...room.members.values()].find(m => m.downed && m.key !== member.key && utils.distance(m, member) < 400);
  if (downed) {
    const dx = downed.x - member.x;
    const dy = downed.y - member.y;
    const d = Math.hypot(dx, dy) || 1;
    if (d > 50) return { x: dx / d, y: dy / d };
  }

  // 血量低时寻找治疗
  if (member.hp < member.maxHp * 0.4) {
    const heart = room.pickups.find(p => p.type === "heart" && utils.distance(p, member) < 500);
    if (heart) {
      const dx = heart.x - member.x;
      const dy = heart.y - member.y;
      const d = Math.hypot(dx, dy) || 1;
      return { x: dx / d, y: dy / d };
    }
  }

  // 回避危险区
  for (const hazard of room.hazards) {
    if (hazard.type === "danger" && utils.distance(hazard, member) < hazard.r + 60) {
      const dx = member.x - hazard.x;
      const dy = member.y - hazard.y;
      const d = Math.hypot(dx, dy) || 1;
      return { x: dx / d, y: dy / d };
    }
  }

  // 闪避敌方弹幕
  for (const shot of room.enemyShots) {
    const sd = utils.distance(shot, member);
    if (sd < 80) {
      const dx = member.x - shot.x;
      const dy = member.y - shot.y;
      const d = Math.hypot(dx, dy) || 1;
      return { x: dx / d, y: dy / d };
    }
  }

  // 优先拾取附近的宝箱
  const chest = room.pickups.find(p => p.type === "chest" && utils.distance(p, member) < 200);
  if (chest) {
    const dx = chest.x - member.x;
    const dy = chest.y - member.y;
    const d = Math.hypot(dx, dy) || 1;
    return { x: dx / d, y: dy / d };
  }

  // 远离最近敌人
  const target = nearestEnemy(room, member, 260);
  if (!target) {
    // 没有敌人时向队友靠拢
    const ally = [...room.members.values()].find(m => m.key !== member.key && !m.downed && !m.eliminated && utils.distance(m, member) > 200);
    if (ally) {
      const dx = ally.x - member.x;
      const dy = ally.y - member.y;
      const d = Math.hypot(dx, dy) || 1;
      return { x: dx / d, y: dy / d };
    }
    return { x: 0, y: 0 };
  }
  const dx = member.x - target.x;
  const dy = member.y - target.y;
  const d = Math.hypot(dx, dy) || 1;
  // 保持中距离输出，太远就靠近
  if (d > 350) return { x: (target.x - member.x) / d, y: (target.y - member.y) / d };
  return { x: dx / d, y: dy / d };
}

function updateSpawns(room, dt) {
  const pressure = pressureFor(room);
  const enemyCap = 70 + activeMembers(room).length * 18 + Math.min(60, room.chapter.id * 2);
  if (room.enemies.length > enemyCap) {
    room.spawnTimer = Math.max(room.spawnTimer, 0.4);
  }
  room.spawnTimer -= dt * pressure;
  while (room.spawnTimer <= 0 && room.enemies.length < enemyCap) {
    const batch = Math.ceil(pressure + room.time / 90 + (hasAffix(room, "swarm") ? 2 : 0) + modifierEffect(room.modifiers, "swarm", 0));
    for (let i = 0; i < batch; i++) spawnEnemy(room);
    if (room.time > 80 || hasAffix(room, "elite")) spawnEnemy(room, "brute");
    if (hasAffix(room, "ranged") && Math.random() < 0.55) spawnEnemy(room, "spitter");
    // 虚空侵蚀词条：额外精英
    if (modifierEffect(room.modifiers, "eliteRate", 1) > 1 && Math.random() < 0.3 * (modifierEffect(room.modifiers, "eliteRate", 1) - 1)) {
      spawnEnemy(room, "brute");
    }
    room.spawnTimer += Math.max(0.22, 1.25 - room.time / 520 - (hasAffix(room, "swarm") ? 0.18 : 0));
  }
  room.eventTimer -= dt;
  if (room.eventTimer <= 0) {
    triggerChapterEvent(room);
    room.eventTimer = ((hasAffix(room, "blessing") ? 26 : 38) + Math.random() * 24) * modifierEffect(room.modifiers, "eventRate", 1);
  }
  if (!room.bossSpawned && (room.kills >= room.chapter.killGoal || room.time > room.chapter.duration * 0.55)) {
    spawnBoss(room);
  }
}

function spawnEnemy(room, forcedType) {
  const team = teamCenter(room);
  const a = Math.random() * Math.PI * 2;
  const dist = 520 + Math.random() * 260;
  const type = forcedType || utils.pick(room.chapter.enemies);
  const def = enemyDefs[type] || enemyDefs.husk;
  const scale = 1 + room.time / 420 + (room.chapter.id - 1) * 0.12 + (hasAffix(room, "elite") && forcedType === "brute" ? 0.25 : 0);
  const pressure = pressureFor(room);
  const diffDef = difficulties.find(d => d.id === room.difficulty) || difficulties[0];
  let hpMul = (0.9 + pressure * 0.12) * modifierEffect(room.modifiers, "enemyHp", 1) * diffDef.hpMul;
  let dmgMul = 1;
  // 厚甲词缀
  if (hasAffix(room, "thickSkin")) hpMul *= 1.25;
  // 玻璃炮台词缀
  if (hasAffix(room, "glassCannon")) { dmgMul *= 1.35; hpMul *= 0.75; }
  room.enemies.push({
    id: nextId(),
    type,
    name: def.name,
    x: team.x + Math.cos(a) * dist,
    y: team.y + Math.sin(a) * dist,
    hp: def.hp * scale * hpMul,
    maxHp: def.hp * scale * hpMul,
    speed: def.speed * (0.95 + room.chapter.id * 0.04) * (hasAffix(room, "haste") ? 1.12 : 1) * modifierEffect(room.modifiers, "enemySpeed", 1),
    damage: def.damage * (1 + room.chapter.id * 0.08) * dmgMul,
    radius: def.radius,
    xp: def.xp,
    color: def.color,
    tile: def.tile,
    ranged: Boolean(def.ranged),
    cd: 1 + Math.random() * 1.5,
    boss: false
  });
}

function spawnBoss(room) {
  room.bossSpawned = true;
  const team = teamCenter(room);
  const hp = (950 + room.chapter.id * 430) * pressureFor(room);
  room.enemies.push({
    id: nextId(),
    type: "boss",
    name: room.chapter.boss,
    x: team.x + 520,
    y: team.y,
    hp,
    maxHp: hp,
    speed: 46 + room.chapter.id * 3,
    damage: 20 + room.chapter.id * 4,
    radius: 46,
    xp: 90,
    color: room.chapter.palette[2],
    tile: 334,
    ranged: true,
    cd: 1.2,
    boss: true,
    skillCd: 5
  });
  room.effects.push(effect("boss", team.x, team.y, room.chapter.palette[2]));
}

function spawnSupply(room) {
  const c = teamCenter(room);
  room.pickups.push({ id: nextId(), type: Math.random() < 0.45 ? "heart" : "chest", x: c.x + utils.rand(-260, 260), y: c.y + utils.rand(-220, 220), r: 18, value: 28, color: Math.random() < 0.5 ? "#d3424f" : "#f4c95d" });
}

function triggerChapterEvent(room) {
  if (!hasAffix(room, "scarcity") || Math.random() < 0.55) spawnSupply(room);
  if (hasAffix(room, "elite")) spawnEnemy(room, "brute");
  if (hasAffix(room, "miasma")) {
    const c = teamCenter(room);
    room.hazards.push({ id: nextId(), type: "danger", x: c.x + utils.rand(-280, 280), y: c.y + utils.rand(-240, 240), r: 78, damage: 18 + room.chapter.id * 1.4, arm: 1.1, life: 4.4, color: "#a98cff" });
  }
  if (hasAffix(room, "voidRain") && room.time > 90) {
    for (const member of aliveMembers(room)) {
      room.hazards.push({ id: nextId(), type: "danger", x: member.x + utils.rand(-90, 90), y: member.y + utils.rand(-90, 90), r: 54, damage: 24 + room.chapter.id * 1.8, arm: 0.9, life: 2.8, color: "#7bb8ff" });
    }
  }

  // 精英波次（第5关起，每60秒概率触发）
  if (room.chapter.id >= 5 && room.time > 60 && Math.random() < 0.3) {
    const c = teamCenter(room);
    for (let i = 0; i < 2 + Math.floor(room.chapter.id / 10); i++) {
      const type = utils.pick(["brute", "spitter"]);
      spawnEnemy(room, type);
    }
    room.effects.push(effect("boss", c.x, c.y, "#ff9658"));
  }

  // 金币雨事件（随机奖励大量经验）
  if (Math.random() < 0.12) {
    const c = teamCenter(room);
    for (let i = 0; i < 5; i++) {
      room.pickups.push({
        id: nextId(), type: "chest",
        x: c.x + utils.rand(-200, 200), y: c.y + utils.rand(-180, 180),
        r: 14, value: 0, color: "#f4c95d"
      });
    }
  }

  // 加速之风事件（全体玩家短暂加速）
  if (room.chapter.id >= 8 && Math.random() < 0.15) {
    for (const member of activeMembers(room)) {
      member.pickupHaste = 4;
    }
    const c = teamCenter(room);
    room.effects.push(effect("revive", c.x, c.y, "#7fe0c4"));
  }

  // 星辉喷泉事件（第12关起：在中心附近生成大量经验星）
  if (room.chapter.id >= 12 && Math.random() < 0.1) {
    const c = teamCenter(room);
    for (let i = 0; i < 8; i++) {
      const a = i / 8 * Math.PI * 2;
      const r = 60 + Math.random() * 100;
      room.pickups.push({
        id: nextId(), type: "xp",
        x: c.x + Math.cos(a) * r, y: c.y + Math.sin(a) * r,
        r: 10, value: 12 + room.chapter.id, color: "#7fe0c4"
      });
    }
    room.effects.push(effect("boss", c.x, c.y, "#7fe0c4"));
  }

  // 护佑之环事件（第18关起：生成短暂的减伤区域）
  if (room.chapter.id >= 18 && Math.random() < 0.08) {
    const c = teamCenter(room);
    room.hazards.push({
      id: nextId(), type: "share", owner: null,
      x: c.x + utils.rand(-120, 120), y: c.y + utils.rand(-100, 100),
      r: 100, damage: 0, arm: 0, life: 6, color: "#98df62"
    });
    room.effects.push(effect("revive", c.x, c.y, "#98df62"));
  }

  // 月亮碎片事件（第6关起：掉落多个治疗）
  if (room.chapter.id >= 6 && Math.random() < 0.1) {
    const c = teamCenter(room);
    for (let i = 0; i < 4; i++) {
      room.pickups.push({
        id: nextId(), type: "heart",
        x: c.x + utils.rand(-180, 180), y: c.y + utils.rand(-150, 150),
        r: 13, value: 18, color: "#d3424f"
      });
    }
    room.effects.push(effect("hit", c.x, c.y, "#d3424f"));
  }

  // 时空裂隙事件（第15关起：高风险高回报区域）
  if (room.chapter.id >= 15 && Math.random() < 0.06) {
    const c = teamCenter(room);
    const riftX = c.x + utils.rand(-200, 200);
    const riftY = c.y + utils.rand(-180, 180);
    // 危险区域
    room.hazards.push({
      id: nextId(), type: "danger",
      x: riftX, y: riftY,
      r: 90, damage: 15 + room.chapter.id * 1.2, arm: 1.5, life: 5, color: "#a98cff"
    });
    // 但周围散布高价值经验
    for (let i = 0; i < 6; i++) {
      const a = i / 6 * Math.PI * 2;
      room.pickups.push({
        id: nextId(), type: "xp",
        x: riftX + Math.cos(a) * 140, y: riftY + Math.sin(a) * 140,
        r: 10, value: 20 + room.chapter.id * 2, color: "#ffe08a"
      });
    }
    room.effects.push(effect("boss", riftX, riftY, "#a98cff"));
  }
}

function updateEnemies(room, dt) {
  const alive = aliveMembers(room);
  for (const enemy of room.enemies) {
    const target = nearestPlayer(room, enemy);
    if (!target) continue;
    const dx = target.x - enemy.x;
    const dy = target.y - enemy.y;
    const d = Math.hypot(dx, dy) || 1;
    enemy.x += (dx / d) * enemy.speed * dt;
    enemy.y += (dy / d) * enemy.speed * dt;
    enemy.cd -= dt;

    // 瞬移猎手词缀：精英短距传送
    if (hasAffix(room, "teleport") && enemy.type === "brute" && d > 250 && Math.random() < dt * 0.15) {
      const tpDist = Math.min(d * 0.5, 150);
      enemy.x += (dx / d) * tpDist;
      enemy.y += (dy / d) * tpDist;
      room.effects.push(effect("spark", enemy.x, enemy.y, "#a98cff"));
    }

    // 月光复苏词缀：敌人缓慢回血
    if (hasAffix(room, "regen") && !enemy.boss) {
      enemy.hp = Math.min(enemy.maxHp, enemy.hp + enemy.maxHp * 0.005 * dt);
    }

    if ((enemy.ranged || enemy.boss) && enemy.cd <= 0 && d < 760) {
      fireEnemyShot(room, enemy, target);
      const frenzyMult = hasAffix(room, "frenzy") ? 0.7 : 1;
      enemy.cd = (enemy.boss ? 0.9 : 2.2) * frenzyMult;
    }
    if (enemy.boss) {
      enemy.skillCd -= dt;
      if (enemy.skillCd <= 0) {
        bossSkill(room, enemy);
        const frenzyMult = hasAffix(room, "frenzy") ? 0.7 : 1;
        enemy.skillCd = (4.5 + Math.random() * 2) * frenzyMult;
      }
    }
    const collMembers = room._sg ? room._sg.members.query(enemy.x, enemy.y, enemy.radius + 30) : alive;
    for (const member of collMembers) {
      const touch = enemy.radius + member.radius;
      const md = utils.distance(enemy, member);
      if (md < touch) {
        // 星辰锻造进化：月刃期间额外减伤
        let extraMitigation = 0;
        if (member.starForgeArmor && member.orbit > 0) {
          extraMitigation = 0.15;
        }
        const dmg = enemy.damage * dt * 0.52 * (1 - (member.contactMitigation || 0) - extraMitigation);
        member.hp -= dmg;
        // 荆棘反伤
        if (member.thorns > 0) {
          let thornsDmg = member.thorns * dt * 2;
          // 赤潮漩涡进化：每损失 10% 生命提升反伤
          if (member.crimsonTide) {
            const missingPct = 1 - member.hp / member.maxHp;
            thornsDmg *= 1 + Math.floor(missingPct * 10) * 0.2;
          }
          enemy.hp -= thornsDmg;
          // 血契进化：反伤回血
          if (member.thornsHeal) member.hp = Math.min(member.maxHp, member.hp + member.thorns * dt * 0.5);
        }
        // 铁花绽放进化：受伤时触发额外范围伤害
        if (member.evolved.includes("ironBloom") && Math.random() < dt * 2) {
          room.hazards.push({ id: nextId(), type: "aura", owner: member.key, x: member.x, y: member.y, r: 80, damage: member.damage * 0.6, life: 0.35, color: "#ff9658" });
        }
        const nx = (member.x - enemy.x) / (md || 1);
        const ny = (member.y - enemy.y) / (md || 1);
        member.x += nx * 28 * dt;
        member.y += ny * 28 * dt;
      }
    }
  }
  room.enemies = room.enemies.filter(enemy => {
    if (enemy.hp > 0) return true;
    room.kills += enemy.boss ? 12 : 1;
    room.killTimeline.push(room.time);
    const killer = activeMembers(room).find(member => utils.distance(member, enemy) < 720);
    if (killer) {
      killer.kills += enemy.boss ? 8 : 1;
      if (enemy.boss && killer.userId) {
        const user = store.users[killer.userId];
        if (user) user.profile.coopStats.bossKills = (user.profile.coopStats.bossKills || 0) + 1;
      }
      // 吸血
      if (killer.lifesteal > 0 && !killer.downed) {
        killer.hp = Math.min(killer.maxHp, killer.hp + killer.lifesteal);
      }
      // 灵魂收割进化：击杀精英/首领额外回血并永久提伤
      if (killer.soulHarvest && !killer.downed && (enemy.boss || enemy.type === "brute")) {
        killer.hp = Math.min(killer.maxHp, killer.hp + 15);
        killer.damage = (killer.damage || 1) * 1.02;
      }
    }
    const eliteXpMult = (!enemy.boss && enemy.type === "brute") ? modifierEffect(room.modifiers, "eliteXp", 1) : 1;
    addTeamXp(room, enemy.xp * (enemy.boss ? 8 : 1) * teamXpBonus(room) * eliteXpMult);
    if (Math.random() < (enemy.boss ? 1 : 0.07 + teamChestBonus(room) + modifierEffect(room.modifiers, "chest", 0))) room.pickups.push({ id: nextId(), type: "chest", x: enemy.x, y: enemy.y, r: 18, value: 0, color: "#f4c95d" });
    if (Math.random() < 0.045) room.pickups.push({ id: nextId(), type: "heart", x: enemy.x, y: enemy.y, r: 13, value: 22, color: "#d3424f" });
    room.effects.push(effect("hit", enemy.x, enemy.y, enemy.color));

    // 分裂词缀：大型敌人死亡后生成小怪
    if (hasAffix(room, "splitter") && !enemy.boss && enemy.radius >= 18) {
      for (let i = 0; i < 2; i++) {
        const def = enemyDefs.husk;
        const ang = Math.random() * TAU;
        room.enemies.push({
          id: nextId(), type: "husk", name: def.name + "碎片",
          x: enemy.x + Math.cos(ang) * 20, y: enemy.y + Math.sin(ang) * 20,
          hp: enemy.maxHp * 0.3, maxHp: enemy.maxHp * 0.3,
          speed: def.speed * 1.2, damage: enemy.damage * 0.5,
          radius: 10, xp: 1, color: enemy.color, tile: def.tile,
          ranged: false, cd: 1, boss: false
        });
      }
    }

    // 噬血猎手词缀：敌人死亡时附近敌人回血
    if (hasAffix(room, "vampiric") && !enemy.boss) {
      for (const other of room.enemies) {
        if (other === enemy || other.hp <= 0) continue;
        if (utils.distance(other, enemy) < 200) {
          other.hp = Math.min(other.maxHp, other.hp + other.maxHp * 0.08);
        }
      }
    }

    return false;
  });
}

function firePlayerShot(room, member) {
  const target = nearestEnemy(room, member, 720 * (1 + (member.rangeBonus || 0)));
  if (!target) return;
  const base = Math.atan2(target.y - member.y, target.x - member.x);
  const count = 1 + member.multishot;
  for (let i = 0; i < count; i++) {
    const spread = (i - (count - 1) / 2) * 0.16;
    const a = base + spread;
    const lowHpBonus = member.hp < member.maxHp * 0.35 ? 1 + (member.lowHpDamage || 0) : 1;
    const critBonus = Math.random() < (member.crit || 0) ? 1.85 : 1;
    room.projectiles.push({ id: nextId(), owner: member.key, x: member.x, y: member.y, vx: Math.cos(a) * 610, vy: Math.sin(a) * 610, r: 7, damage: member.damage * lowHpBonus * critBonus, pierce: member.pierce || 0, life: 1.25 * (1 + (member.rangeBonus || 0)), color: heroes[member.hero].color });
  }
}

function updateProjectiles(room, dt) {
  for (const shot of room.projectiles) {
    shot.life -= dt;
    shot.x += shot.vx * dt;
    shot.y += shot.vy * dt;
    const projEnemies = room._sg ? room._sg.enemies.query(shot.x, shot.y, shot.r + 60) : room.enemies;
    for (const enemy of projEnemies) {
      if (shot.life <= 0) break;
      const rr = shot.r + enemy.radius;
      if ((shot.x - enemy.x) ** 2 + (shot.y - enemy.y) ** 2 < rr ** 2) {
        const owner = [...room.members.values()].find(member => member.key === shot.owner);
        const bossMul = enemy.boss && owner ? owner.bossDamage || 1 : 1;
        let dmg = shot.damage * bossMul * (1 + (owner?.curse || 0));
        // 月光护盾词缀：敌人有几率大幅减伤
        if (hasAffix(room, "shielded") && !enemy.boss && Math.random() < 0.15) {
          dmg *= 0.15;
          room.effects.push(effect("hit", enemy.x, enemy.y, "#a98cff"));
        }
        enemy.hp -= dmg;
        if (owner?.splashCrit && shot.damage > owner.damage * 1.5) {
          room.hazards.push({ id: nextId(), type: "aura", owner: owner.key, x: shot.x, y: shot.y, r: 58, damage: shot.damage * 0.55, life: 0.18, color: shot.color });
        }

        // 雷链弹射
        if (owner && (owner.chainBounces || 0) > 0 && !shot._chained) {
          shot._chained = true;
          const chainDmg = shot.damage * (owner.chainDamage || 0.4);
          let lastTarget = enemy;
          for (let b = 0; b < owner.chainBounces; b++) {
            const next = room.enemies.find(e => e !== lastTarget && e.hp > 0 && utils.distance(e, lastTarget) < 200);
            if (!next) break;
            next.hp -= chainDmg * (1 + (owner.curse || 0));
            room.effects.push(effect("spark", next.x, next.y, "#ffe08a"));
            lastTarget = next;
          }
        }

        shot.pierce = (shot.pierce || 0) - 1;
        if (shot.pierce < 0) shot.life = 0;
        room.effects.push(effect("spark", shot.x, shot.y, shot.color));
      }
    }
  }
  room.projectiles = room.projectiles.filter(shot => shot.life > 0);
}

function fireEnemyShot(room, enemy, target) {
  const a = Math.atan2(target.y - enemy.y, target.x - enemy.x);
  room.enemyShots.push({ id: nextId(), x: enemy.x, y: enemy.y, vx: Math.cos(a) * 250, vy: Math.sin(a) * 250, r: enemy.boss ? 11 : 8, damage: enemy.damage * 0.8, life: 4, color: enemy.color });
}

function updateEnemyShots(room, dt) {
  const alive = aliveMembers(room);
  for (const shot of room.enemyShots) {
    shot.life -= dt;
    shot.x += shot.vx * dt;
    shot.y += shot.vy * dt;
    const eShotTargets = room._sg ? room._sg.members.query(shot.x, shot.y, shot.r + 30) : alive;
    for (const member of eShotTargets) {
      const rr = shot.r + member.radius;
      if ((shot.x - member.x) ** 2 + (shot.y - member.y) ** 2 < rr ** 2) {
        member.hp -= shot.damage * (1 - (member.projectileMitigation || 0));
        shot.life = 0;
        break;
      }
    }
  }
  room.enemyShots = room.enemyShots.filter(shot => shot.life > 0);
}

function bossSkill(room, boss) {
  const players = aliveMembers(room);
  if (!players.length) return;
  const c = teamCenter(room);

  // 基础技能：危险区追踪
  for (const member of players) {
    room.hazards.push({ id: nextId(), type: "danger", x: member.x, y: member.y, r: 66, damage: boss.damage * 1.4, arm: 1.2, life: 2.2, color: boss.color });
  }

  // 多人分摊圈
  if (players.length >= 2) {
    room.hazards.push({ id: nextId(), type: "share", x: c.x, y: c.y, r: 92, damage: boss.damage * 3.2, arm: 1.5, life: 2.6, color: "#f4c95d" });
  }

  // 额外技能：随章节解锁
  const chapterId = room.chapter.id;

  // 第3关起：弹幕风暴
  if (chapterId >= 3 && Math.random() < 0.5) {
    for (let i = 0; i < 8; i++) {
      const a = i / 8 * TAU + Math.random() * 0.3;
      room.enemyShots.push({ id: nextId(), x: boss.x, y: boss.y, vx: Math.cos(a) * 200, vy: Math.sin(a) * 200, r: 9, damage: boss.damage * 0.6, life: 3.5, color: boss.color });
    }
  }

  // 第8关起：传送突袭
  if (chapterId >= 8 && Math.random() < 0.35) {
    const target = players[Math.floor(Math.random() * players.length)];
    boss.x = target.x + utils.rand(-60, 60);
    boss.y = target.y + utils.rand(-60, 60);
    room.effects.push(effect("boss", boss.x, boss.y, boss.color));
    room.hazards.push({ id: nextId(), type: "aura", owner: "boss", x: boss.x, y: boss.y, r: 120, damage: boss.damage * 2, life: 0.8, color: boss.color });
  }

  // 第15关起：召唤小怪
  if (chapterId >= 15 && Math.random() < 0.3) {
    for (let i = 0; i < 3; i++) {
      const type = utils.pick(room.chapter.enemies);
      const def = enemyDefs[type] || enemyDefs.husk;
      const a = Math.random() * TAU;
      room.enemies.push({
        id: nextId(), type, name: def.name,
        x: boss.x + Math.cos(a) * 80, y: boss.y + Math.sin(a) * 80,
        hp: def.hp * 0.5, maxHp: def.hp * 0.5,
        speed: def.speed * 1.1, damage: def.damage * 0.8,
        radius: def.radius, xp: def.xp, color: def.color, tile: def.tile,
        ranged: false, cd: 1, boss: false
      });
    }
  }

  // 第25关起：激光扫射
  if (chapterId >= 25 && Math.random() < 0.25) {
    const target = players[Math.floor(Math.random() * players.length)];
    const angle = Math.atan2(target.y - boss.y, target.x - boss.x);
    for (let i = 0; i < 5; i++) {
      const dist = 80 + i * 80;
      room.hazards.push({
        id: nextId(), type: "danger",
        x: boss.x + Math.cos(angle) * dist, y: boss.y + Math.sin(angle) * dist,
        r: 45, damage: boss.damage * 1.8, arm: 0.5 + i * 0.2, life: 1.5, color: "#ff7a90"
      });
    }
  }
}

function updateHazards(room, dt) {
  for (const hazard of room.hazards) {
    hazard.life -= dt;
    if (hazard.type === "aura") {
      const auraTargets = room._sg ? room._sg.enemies.query(hazard.x, hazard.y, hazard.r + 60) : room.enemies;
      for (const enemy of auraTargets) {
        if (utils.distance(hazard, enemy) < hazard.r + enemy.radius) enemy.hp -= hazard.damage * dt * 2.2;
      }
    } else if (hazard.arm > 0) {
      hazard.arm -= dt;
    } else {
      const targets = room._sg
        ? room._sg.members.query(hazard.x, hazard.y, hazard.r + 30)
        : aliveMembers(room).filter(member => utils.distance(hazard, member) < hazard.r + member.radius);
      if (targets.length) {
        const split = hazard.type === "share" ? Math.max(1, targets.length) : 1;
        for (const member of targets) member.hp -= (hazard.damage / split) * dt;
      }
    }
  }
  room.hazards = room.hazards.filter(hazard => hazard.life > 0);
  for (const effectItem of room.effects) effectItem.life -= dt;
  room.effects = room.effects.filter(effectItem => effectItem.life > 0);
}

function updatePickups(room, dt) {
  for (const pickup of room.pickups) {
    pickup.life = (pickup.life || 40) - dt;
    const member = room._sg ? room._sg.members.findNearest(pickup.x, pickup.y, 500) : nearestAlive(room, pickup);
    if (!member) continue;
    const dist = utils.distance(member, pickup);
    // 虚空坍缩进化：自动吸取附近经验
    if (member.evolved?.includes("voidNova") && dist < 300 && pickup.type !== "chest") {
      const dx = member.x - pickup.x;
      const dy = member.y - pickup.y;
      const d = dist || 1;
      pickup.x += (dx / d) * 200 * dt;
      pickup.y += (dy / d) * 200 * dt;
    }
    if (dist < member.radius + pickup.r + 8 + (member.magnet || 0)) {
      if (pickup.type === "heart") {
        for (const player of aliveMembers(room)) player.hp = Math.min(player.maxHp, player.hp + pickup.value);
      } else if (pickup.type === "chest") {
        for (const player of activeMembers(room)) {
          if (!player.pendingChoices.length) player.pendingChoices = makeChoices(room, player);
        }
        room.paused = true;
      }
      if (member.pickupHaste !== undefined) member.pickupHaste = 2.5;
      pickup.life = 0;
    }
  }
  room.pickups = room.pickups.filter(pickup => pickup.life > 0);
}

function addTeamXp(room, amount) {
  room.xp += amount;
  while (room.xp >= room.xpToNext) {
    room.xp -= room.xpToNext;
    room.teamLevel += 1;
    room.xpToNext = Math.floor((room.xpToNext * 1.18 + 12) * modifierEffect(room.modifiers, "xpNeed", 1));
    for (const member of activeMembers(room)) {
      if (!member.pendingChoices.length) member.pendingChoices = makeChoices(room, member);
    }
    room.paused = true;
  }
}

function hasAffix(room, id) {
  return room.chapter.affixes?.some(item => item.id === id);
}

function makeChoices(room, member) {
  const pool = availableUpgrades(room, member).sort(() => Math.random() - 0.5);
  return pool.slice(0, 3);
}

function availableUpgrades(room, member = null) {
  return upgradeDefs.filter(item => {
    if (item.unlockChapter > room.chapter.id) return false;
    if (!member) return true;
    return (member.upgrades[item.id] || 0) < item.max;
  });
}

function isRoomPaused(room) {
  if (room.manualPaused) return true;
  return room.status === "running" && activeMembers(room).some(member => member.pendingChoices.length > 0);
}

function checkRoomOutcome(room) {
  const active = activeMembers(room);
  const alive = aliveMembers(room);
  if (!active.length || !alive.length && active.every(member => member.downed || member.eliminated)) return finishRoom(room, false);
  if (room.bossSpawned && !room.enemies.some(enemy => enemy.boss) && room.kills >= room.chapter.killGoal) return finishRoom(room, true);
  if (room.time > room.chapter.duration + 150) return finishRoom(room, false);
}

function finishRoom(room, victory) {
  if (room.status === "ended") return;
  room.status = "ended";
  room.endedAt = Date.now();
  const diffDef = difficulties.find(d => d.id === room.difficulty) || difficulties[0];
  const kpm = room.time > 0 ? room.kills / (room.time / 60) : 0;
  const aggressionBonus = Math.floor(kpm * 12);
  const score = Math.floor((room.kills * 8 + room.teamLevel * 40 + room.time * 1.2 + aggressionBonus + (victory ? 900 + room.chapter.id * 180 : 0)) * modifierEffect(room.modifiers, "score", 1) * diffDef.scoreMul);
  const baseDust = Math.floor(((victory ? room.chapter.reward : room.chapter.reward * 0.28) + room.kills * 0.15) * modifierEffect(room.modifiers, "reward", 1) * diffDef.rewardMul);
  // 压缩击杀时间线为10秒桶
  const bucketSec = 10;
  const totalBuckets = Math.max(1, Math.ceil(room.time / bucketSec));
  const killBuckets = new Array(totalBuckets).fill(0);
  for (const t of room.killTimeline) {
    const idx = Math.min(Math.floor(t / bucketSec), totalBuckets - 1);
    killBuckets[idx]++;
  }
  const result = { victory, score, moonDust: baseDust, time: Math.floor(room.time), kills: room.kills, chapterId: room.chapter.id, chapter: room.chapter.name, killBuckets, bucketSec };
  room.result = result;
  const weekly = getWeeklyChallenge();
  const isWeekly = room.chapter.id === weekly.chapterId && (room.modifiers || []).length >= 3;
  const uniqueUsers = new Set();
  for (const member of room.members.values()) {
    if (!member.userId || uniqueUsers.has(member.userId)) continue;
    uniqueUsers.add(member.userId);
    const user = store.users[member.userId];
    if (!user) continue;
    const bonus = talentBonus(user.profile).reward;
    const dust = Math.floor(baseDust * bonus);
    user.profile.moonDust += dust;
    user.profile.bestScore = Math.max(user.profile.bestScore || 0, score);
    user.profile.stats.runs += 1;
    user.profile.stats.kills += member.kills;
    user.profile.seen.chapters = [...new Set([...(user.profile.seen.chapters || []), room.chapter.id])];
    user.profile.seen.monsters = [...new Set([...(user.profile.seen.monsters || []), ...room.chapter.enemies])];
    if (room.bossSpawned) user.profile.seen.bosses = [...new Set([...(user.profile.seen.bosses || []), room.chapter.boss])];
    if (victory) {
      user.profile.stats.victories += 1;
      if (!user.profile.storyProgress.cleared.includes(room.chapter.id)) {
        user.profile.storyProgress.cleared.push(room.chapter.id);
        user.profile.moonDust += Math.floor(room.chapter.reward * 0.5);
        unlockChapterReward(user.profile, room.chapter.id);
      }
      user.profile.storyProgress.unlockedChapter = Math.max(user.profile.storyProgress.unlockedChapter || 1, Math.min(chapters.length, room.chapter.id + 1));
      // 成就检测
      const earned = checkAchievements(user.profile, room, member, victory, isWeekly);
      if (earned.length) {
        const memberObj = room.members.get(member.key);
        if (memberObj?.client) {
          for (const ach of earned) memberObj.client.send("achievement", { id: ach.id, name: ach.name, icon: ach.icon });
        }
      }
    }
    const finishedAt = Date.now();
    store.leaderboard.push({ mode: "story", username: user.profile.nickname || user.username, hero: heroes[member.hero].name, chapter: room.chapter.name, chapterId: room.chapter.id, score, kills: room.kills, time: result.time, victory, modifiers: room.modifiers.map(item => item.name), day: utils.dayKey(finishedAt), at: finishedAt, weeklySeed: isWeekly ? weekly.seed : undefined });
  }
  store.leaderboard = store.leaderboard.sort((a, b) => b.score - a.score).slice(0, 200);
  storeLib.saveStore();
  broadcastRoom(room);
}

function checkAchievements(profile, room, member, victory, isWeekly) {
  if (!victory) return [];
  const earned = [];
  profile.achievements ||= [];
  profile.coopStats ||= { bossKills: 0, rescues: 0 };
  const grant = (id) => {
    if (profile.achievements.includes(id)) return;
    profile.achievements.push(id);
    const ach = coopAchievements.find(a => a.id === id);
    if (ach) earned.push(ach);
  };
  if (!profile.achievements.includes("first_clear")) grant("first_clear");
  if (!member.downed && !member.eliminated) grant("no_death");
  if (room.time <= 120) grant("speed_clear");
  if (profile.coopStats.bossKills >= 10) grant("boss_slayer");
  if (profile.coopStats.rescues >= 5) grant("rescue_5");
  if (room.members.size >= 5) grant("full_team");
  if (room.difficulty === "hard") grant("hard_clear");
  if (room.difficulty === "nightmare") grant("nightmare_clear");
  if ((room.modifiers || []).length >= 3) grant("modifier_3");
  if (isWeekly) grant("weekly_clear");
  return earned;
}

function unlockChapterReward(profile, chapterId) {
  if (chapterId === 1 && !profile.unlockedRelics.includes("moonShard")) profile.unlockedRelics.push("moonShard");
  if (chapterId === 2 && !profile.unlockedHeroes.includes("orion")) profile.unlockedHeroes.push("orion");
  if (chapterId === 3 && !profile.unlockedRelics.includes("emberChalice")) profile.unlockedRelics.push("emberChalice");
  if (chapterId === 4 && !profile.unlockedHeroes.includes("sera")) profile.unlockedHeroes.push("sera");
  if (chapterId === 5 && !profile.unlockedRelics.includes("eclipseCrown")) profile.unlockedRelics.push("eclipseCrown");
  if (chapterId % 10 === 0) {
    const relic = `chapter${chapterId}Sigil`;
    if (!profile.unlockedRelics.includes(relic)) profile.unlockedRelics.push(relic);
  }
}

function broadcastRoom(room) {
  room.lastBroadcast = Date.now();
  const payload = serializeRoom(room);
  for (const member of room.members.values()) {
    if (member.connected && member.client) member.client.send("roomState", { room: payload, you: member.key });
  }
}

function serializeRoom(room) {
  return {
    code: room.code,
    multiplayer: room.multiplayer,
    difficulty: room.difficulty || "normal",
    status: room.status,
    paused: isRoomPaused(room),
    hostKey: room.hostKey,
    chapter: room.chapter,
    modifiers: room.modifiers || [],
    modifierOptions: room.modifierOptions || [],
    availableUpgrades: availableUpgrades(room).map(item => ({ id: item.id, name: item.name, desc: item.desc, stat: item.stat, max: item.max, unlockChapter: item.unlockChapter, color: item.color, icon: item.icon })),
    evolutions: evolutionDefs,
    time: room.time,
    kills: room.kills,
    xp: room.xp,
    xpToNext: room.xpToNext,
    teamLevel: room.teamLevel,
    bossSpawned: room.bossSpawned,
    result: room.result,
    members: [...room.members.values()].map(member => ({
      key: member.key,
      username: member.username,
      connected: member.connected,
      ready: member.ready,
      hero: member.hero,
      x: member.x,
      y: member.y,
      speed: member.speed,
      hp: Math.max(0, member.hp),
      maxHp: member.maxHp,
      downed: member.downed,
      downedTime: member.downedTime,
      rescue: member.rescue,
      eliminated: member.eliminated,
      kills: member.kills,
      upgrades: member.upgrades,
      evolved: member.evolved,
      pendingChoices: member.pendingChoices
    })),
    enemies: room.enemies.map(enemy => ({ id: enemy.id, type: enemy.type, name: enemy.name, x: enemy.x, y: enemy.y, hp: Math.max(0, enemy.hp), maxHp: enemy.maxHp, radius: enemy.radius, color: enemy.color, tile: enemy.tile, boss: enemy.boss })),
    projectiles: room.projectiles.map(p => ({ id: p.id, x: p.x, y: p.y, r: p.r, color: p.color })),
    enemyShots: room.enemyShots.map(p => ({ id: p.id, x: p.x, y: p.y, r: p.r, color: p.color })),
    pickups: room.pickups.map(p => ({ id: p.id, type: p.type, x: p.x, y: p.y, r: p.r, color: p.color })),
    hazards: room.hazards.map(h => ({ id: h.id, type: h.type, x: h.x, y: h.y, r: h.r, life: h.life, arm: h.arm, color: h.color })),
    effects: room.effects
  };
}

function makeRoomCode() {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "";
  do {
    code = "";
    for (let i = 0; i < 5; i++) code += alphabet[Math.floor(Math.random() * alphabet.length)];
  } while (rooms.has(code));
  return code;
}

function nextId() {
  return nextEntityId++;
}

function nearestPlayer(room, enemy) {
  if (room._sg) return room._sg.members.findNearest(enemy.x, enemy.y, Infinity);
  let best = null;
  let bestD = Infinity;
  for (const member of aliveMembers(room)) {
    const d = utils.distance(enemy, member);
    if (d < bestD) {
      bestD = d;
      best = member;
    }
  }
  return best;
}

function nearestAlive(room, point) {
  if (room._sg) return room._sg.members.findNearest(point.x, point.y, Infinity);
  let best = null;
  let bestD = Infinity;
  for (const member of aliveMembers(room)) {
    const d = utils.distance(point, member);
    if (d < bestD) {
      bestD = d;
      best = member;
    }
  }
  return best;
}

function nearestEnemy(room, member, range = Infinity) {
  if (room._sg) return room._sg.enemies.findNearest(member.x, member.y, range);
  let best = null;
  let bestD = range;
  for (const enemy of room.enemies) {
    const d = utils.distance(member, enemy);
    if (d < bestD) {
      bestD = d;
      best = enemy;
    }
  }
  return best;
}

function teamCenter(room) {
  const players = activeMembers(room);
  if (!players.length) return { x: 0, y: 0 };
  return {
    x: players.reduce((sum, member) => sum + member.x, 0) / players.length,
    y: players.reduce((sum, member) => sum + member.y, 0) / players.length
  };
}

function teamXpBonus(room) {
  const players = activeMembers(room);
  if (!players.length) return 1;
  return players.reduce((sum, member) => sum + (member.xpGain || 1), 0) / players.length;
}

function teamChestBonus(room) {
  const players = activeMembers(room);
  if (!players.length) return 0;
  return players.reduce((sum, member) => sum + (member.chestBonus || 0), 0) / players.length;
}

function effect(type, x, y, color) {
  return { id: nextId(), type, x, y, color, life: 0.6 };
}

setInterval(simulateRooms, tickMs);

setInterval(() => {
  const now = Date.now();
  let changed = false;
  for (const [email, entry] of Object.entries(store.verificationCodes || {})) {
    if (entry.expires < now) { delete store.verificationCodes[email]; changed = true; }
  }
  if (changed) storeLib.saveStore();
}, 60000);

server.listen(port, () => {
  console.log(`Moon Eclipse Survivors running at http://localhost:${port}`);
});
