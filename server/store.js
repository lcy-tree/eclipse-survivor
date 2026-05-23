const fs = require("fs");
const path = require("path");
const utils = require("./utils");

// Store 管理：数据持久化层
// 依赖注入：init({ dataDir, storePath, talents }) 必须在首次使用前调用
let store = null;
let storePath = null;
let dataDir = null;
let talents = null;

function init(opts) {
  dataDir = opts.dataDir;
  storePath = opts.storePath;
  talents = opts.talents;
}

function getStore() {
  return store;
}

function makeProfile(username) {
  return {
    nickname: username,
    moonDust: 0,
    talents: Object.fromEntries(Object.keys(talents).map(id => [id, 0])),
    unlockedHeroes: ["astrid", "mara", "noct"],
    unlockedRelics: [],
    storyProgress: { unlockedChapter: 1, cleared: [] },
    bestScore: 0,
    lastHero: "astrid",
    friends: [],
    friendRequests: { incoming: [], outgoing: [] },
    seen: { monsters: [], bosses: [], chapters: [] },
    stats: { runs: 0, victories: 0, kills: 0 }
  };
}

function normalizeProfile(user) {
  user.profile ||= makeProfile(user.username || "旅人");
  const profile = user.profile;
  profile.nickname ||= user.username || "旅人";
  profile.moonDust = Number(profile.moonDust) || 0;
  profile.talents ||= {};
  for (const id of Object.keys(talents)) {
    profile.talents[id] = Math.max(0, Math.min(talents[id].max, Number(profile.talents[id]) || 0));
  }
  profile.unlockedHeroes ||= ["astrid", "mara", "noct"];
  profile.unlockedRelics ||= [];
  profile.storyProgress ||= { unlockedChapter: 1, cleared: [] };
  profile.storyProgress.unlockedChapter = Math.max(1, Number(profile.storyProgress.unlockedChapter) || 1);
  profile.storyProgress.cleared ||= [];
  profile.bestScore = Number(profile.bestScore) || 0;
  profile.lastHero ||= "astrid";
  profile.friends ||= [];
  profile.friends = [...new Set(profile.friends)].map(String);
  profile.friendRequests ||= { incoming: [], outgoing: [] };
  profile.friendRequests.incoming ||= [];
  profile.friendRequests.outgoing ||= [];
  profile.seen ||= { monsters: [], bosses: [], chapters: [] };
  profile.seen.monsters ||= [];
  profile.seen.bosses ||= [];
  profile.seen.chapters ||= [];
  profile.stats ||= { runs: 0, victories: 0, kills: 0 };
  profile.stats.runs = Number(profile.stats.runs) || 0;
  profile.stats.victories = Number(profile.stats.victories) || 0;
  profile.stats.kills = Number(profile.stats.kills) || 0;
  profile.achievements ||= [];
  profile.achievements = [...new Set(profile.achievements)].map(String);
  profile.coopStats ||= { bossKills: 0, rescues: 0 };
  profile.coopStats.bossKills = Number(profile.coopStats.bossKills) || 0;
  profile.coopStats.rescues = Number(profile.coopStats.rescues) || 0;
  return profile;
}

function publicUser(user) {
  normalizeProfile(user);
  return {
    id: user.id,
    username: user.username,
    profile: user.profile
  };
}

function loadStore() {
  fs.mkdirSync(dataDir, { recursive: true });
  if (!fs.existsSync(storePath)) {
    store = { users: {}, usernameIndex: {}, sessions: {}, leaderboard: [], verificationCodes: {} };
    fs.writeFileSync(storePath, JSON.stringify(store, null, 2));
    return store;
  }
  try {
    const parsed = JSON.parse(fs.readFileSync(storePath, "utf8"));
    parsed.users ||= {};
    parsed.usernameIndex ||= {};
    parsed.sessions ||= {};
    parsed.leaderboard ||= [];
    parsed.verificationCodes ||= {};
    for (const user of Object.values(parsed.users)) {
      normalizeProfile(user);
    }
    store = parsed;
    return store;
  } catch {
    const backup = `${storePath}.broken-${Date.now()}`;
    try { fs.copyFileSync(storePath, backup); } catch {}
    store = { users: {}, usernameIndex: {}, sessions: {}, leaderboard: [], verificationCodes: {} };
    return store;
  }
}

function saveStore() {
  fs.mkdirSync(dataDir, { recursive: true });
  const tmp = `${storePath}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(store, null, 2));
  fs.renameSync(tmp, storePath);
}

function getSessionUser(req) {
  const sid = utils.parseCookies(req).mes_session;
  if (!sid) return null;
  const session = store.sessions[sid];
  if (!session || session.expires < Date.now()) {
    if (session) {
      delete store.sessions[sid];
      saveStore();
    }
    return null;
  }
  const user = store.users[session.userId];
  return user ? { user, sid } : null;
}

module.exports = {
  init, getStore, loadStore, saveStore,
  makeProfile, normalizeProfile, publicUser, getSessionUser
};
