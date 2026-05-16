const http = require("http");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const nodemailer = require("nodemailer");

const root = __dirname;
const port = Number(process.env.PORT || 5173);
const dataDir = path.join(root, "data");
const storePath = path.join(dataDir, "store.json");
const tickMs = 33;
const TAU = Math.PI * 2;

const mailTransporter = nodemailer.createTransport({
  host: "smtp.qq.com",
  port: 465,
  secure: true,
  auth: { user: "835329879@qq.com", pass: "dyusvfhcuiizbfdj" }
});

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

const chapterThemes = [
  { zone: "银雾荒原", goal: "找回月辉碎片", boss: "雾沼监军", palette: ["#17201c", "#293b35", "#7fe0c4"], enemies: ["husk", "bat"] },
  { zone: "裂翼墓园", goal: "净化裂翼墓碑", boss: "裂翼伯爵", palette: ["#1c1824", "#342843", "#a98cff"], enemies: ["husk", "bat", "brute"] },
  { zone: "赤烬修道院", goal: "夺回燃烧圣杯", boss: "赤烬院长", palette: ["#241713", "#4d2721", "#ff9658"], enemies: ["husk", "brute", "spitter"] },
  { zone: "虚空矿井", goal: "关闭地下裂隙", boss: "虚空掘墓人", palette: ["#141423", "#25294a", "#7bb8ff"], enemies: ["bat", "spitter", "shard"] },
  { zone: "月蚀王座", goal: "击碎王冠封印", boss: "月蚀王冠", palette: ["#201714", "#3c2b1a", "#f4c95d"], enemies: ["husk", "brute", "spitter", "shard"] },
  { zone: "青灯竹径", goal: "点亮迷路青灯", boss: "竹影鬼将", palette: ["#142018", "#284231", "#98df62"], enemies: ["bat", "shard"] },
  { zone: "沉钟水渠", goal: "敲响三口沉钟", boss: "溺钟祭司", palette: ["#101c24", "#203847", "#7bb8ff"], enemies: ["husk", "spitter"] },
  { zone: "白骨驿站", goal: "护送旧王信标", boss: "骨驿骑士", palette: ["#1e1b18", "#3b3428", "#f6f0dc"], enemies: ["husk", "brute"] },
  { zone: "猩红花庭", goal: "烧毁血蔷薇根", boss: "花庭女侯", palette: ["#25151b", "#4a2430", "#d3424f"], enemies: ["bat", "spitter", "shard"] },
  { zone: "星坠天井", goal: "收集坠星核心", boss: "坠星巨像", palette: ["#171923", "#2c3047", "#f4c95d"], enemies: ["brute", "shard"] }
];

const chapters = Array.from({ length: 50 }, (_, index) => {
  const id = index + 1;
  const theme = chapterThemes[index % chapterThemes.length];
  const cycle = Math.floor(index / chapterThemes.length) + 1;
  const suffixes = ["初醒", "回声", "深层", "残月", "终夜"];
  const affixes = makeChapterAffixes(id);
  const objective = makeChapterObjective(id, theme.goal, cycle);
  const name = `${theme.zone}·${suffixes[cycle - 1] || `第${cycle}轮`}`;
  return {
    id,
    name,
    subtitle: `${theme.goal}（第 ${cycle} 幕） · ${affixes.map(item => item.name).join(" / ")}`,
    duration: 240 + Math.min(150, index * 4),
    killGoal: 70 + index * 12,
    reward: 60 + index * 14,
    boss: `${theme.boss}${cycle > 1 ? `·${cycle}` : ""}`,
    palette: theme.palette,
    enemies: theme.enemies,
    affixes,
    objective
  };
});

function makeChapterAffixes(id) {
  const pool = [
    { id: "swarm", name: "潮汐兽群", desc: "敌群更密集" },
    { id: "elite", name: "精英巡猎", desc: "事件会召来精英" },
    { id: "miasma", name: "月毒雾潮", desc: "地面会出现危险区" },
    { id: "voidRain", name: "虚空落星", desc: "后期会坠落星蚀" },
    { id: "scarcity", name: "枯竭补给", desc: "补给更稀少但宝箱更值钱" },
    { id: "blessing", name: "古灯余辉", desc: "补给更频繁" },
    { id: "ranged", name: "远咒回廊", desc: "远程敌人更活跃" },
    { id: "haste", name: "终夜急袭", desc: "敌人速度提高" },
    { id: "thickSkin", name: "厚甲变种", desc: "敌人生命更高" },
    { id: "glassCannon", name: "玻璃炮台", desc: "敌人伤害更高但更脆弱" },
    { id: "regen", name: "月光复苏", desc: "敌人会缓慢回血" },
    { id: "splitter", name: "分裂原质", desc: "大型敌人死亡后分裂为小怪" },
    { id: "vampiric", name: "噬血猎手", desc: "击杀敌人时附近敌人回血" },
    { id: "shielded", name: "月光护盾", desc: "敌人有几率短暂无敌" },
    { id: "frenzy", name: "狂暴之潮", desc: "敌人攻击速度更快" },
    { id: "teleport", name: "瞬移猎手", desc: "精英敌人会短距传送" }
  ];
  return [pool[id % pool.length], pool[(id * 3 + 1) % pool.length], pool[(id * 5 + 2) % pool.length]]
    .filter((item, index, arr) => arr.findIndex(other => other.id === item.id) === index)
    .slice(0, id > 25 ? 3 : 2);
}

function makeChapterObjective(id, goal, cycle) {
  const types = [
    { id: "hunt", name: "猎杀推进", label: "击破敌群" },
    { id: "ritual", name: "仪式压制", label: "净化节点" },
    { id: "survive", name: "坚守远征", label: "坚持时间" },
    { id: "supply", name: "遗物搜寻", label: "打开宝箱" },
    { id: "boss", name: "斩首行动", label: "逼出首领" }
  ];
  const type = types[(id + cycle) % types.length];
  return { ...type, goal, need: 100 + id * 5 };
}

const heroes = {
  astrid: { id: "astrid", name: "星铸猎人", icon: "A", hp: 105, speed: 220, damage: 25, cooldown: 0.58, color: "#f4c95d" },
  mara: { id: "mara", name: "赤烬修女", icon: "M", hp: 130, speed: 195, damage: 30, cooldown: 0.72, color: "#ff9658" },
  noct: { id: "noct", name: "夜鸦术士", icon: "N", hp: 92, speed: 238, damage: 21, cooldown: 0.46, color: "#a98cff" },
  orion: { id: "orion", name: "霜星守望", icon: "O", hp: 116, speed: 205, damage: 23, cooldown: 0.62, color: "#7fe0c4" },
  sera: { id: "sera", name: "圣灯修补匠", icon: "S", hp: 100, speed: 215, damage: 19, cooldown: 0.52, color: "#f6f0dc" }
};

const enemyDefs = {
  husk: { name: "雾骸", hp: 42, speed: 76, damage: 9, radius: 16, xp: 4, color: "#d4ceb2", tile: 242 },
  bat: { name: "裂翼", hp: 28, speed: 128, damage: 7, radius: 13, xp: 3, color: "#7fe0c4", tile: 246 },
  brute: { name: "铁瘤", hp: 130, speed: 56, damage: 16, radius: 23, xp: 10, color: "#d3424f", tile: 269 },
  spitter: { name: "黯咒者", hp: 78, speed: 70, damage: 12, radius: 18, xp: 8, color: "#a98cff", tile: 275, ranged: true },
  shard: { name: "晶群", hp: 62, speed: 112, damage: 12, radius: 15, xp: 7, color: "#7bb8ff", tile: 286 }
};

const talents = {
  /* ── 攻击 ── */
  might: { group: "攻击", tier: "common", name: "猎月术", max: 12, baseCost: 90, desc: "永久伤害小幅提高" },
  keenEdge: { group: "攻击", tier: "common", name: "锐意锋芒", max: 8, baseCost: 75, desc: "基础攻击附带微弱减速效果" },
  execution: { group: "攻击", tier: "rare", name: "处刑星痕", max: 10, baseCost: 140, requiresChapter: 4, desc: "对精英和 Boss 的伤害提高" },
  fury: { group: "攻击", tier: "rare", name: "残血怒焰", max: 8, baseCost: 180, requiresChapter: 8, desc: "低血量时伤害提高" },
  bloodrage: { group: "攻击", tier: "common", name: "血怒狂袭", max: 10, baseCost: 120, requiresChapter: 6, desc: "连杀提高攻击速度" },
  deathmark: { group: "攻击", tier: "common", name: "死亡标记", max: 8, baseCost: 160, requiresChapter: 8, desc: "标记敌人使其受到更多伤害" },
  multistar: { group: "攻击", tier: "rare", name: "群星弦线", max: 6, baseCost: 260, requiresChapter: 12, desc: "开局获得额外弹幕潜力" },
  overwhelm: { group: "攻击", tier: "rare", name: "压境之势", max: 6, baseCost: 200, requiresChapter: 10, desc: "对群怪伤害提高" },
  starfall: { group: "攻击", tier: "legendary", name: "陨星天降", max: 3, baseCost: 750, requiresChapter: 22, desc: "击杀有概率触发陨星坠落" },
  apocalypse: { group: "攻击", tier: "legendary", name: "末日审判", max: 3, baseCost: 800, requiresChapter: 25, desc: "全攻击属性终极提升" },

  /* ── 生存 ── */
  vitality: { group: "生存", tier: "common", name: "温血誓约", max: 12, baseCost: 85, desc: "永久生命提高" },
  ironSkin: { group: "生存", tier: "common", name: "铁肤铭刻", max: 10, baseCost: 80, desc: "受到弹幕伤害降低" },
  ward: { group: "生存", tier: "rare", name: "旧王护符", max: 10, baseCost: 135, requiresChapter: 3, desc: "受到持续接触伤害降低" },
  regen: { group: "生存", tier: "rare", name: "圣杯余温", max: 8, baseCost: 170, requiresChapter: 6, desc: "战斗中缓慢回复生命" },
  endurance: { group: "生存", tier: "common", name: "持久战意", max: 8, baseCost: 100, requiresChapter: 4, desc: "生命越低减伤越高" },
  barrier: { group: "生存", tier: "common", name: "月光屏障", max: 6, baseCost: 140, requiresChapter: 7, desc: "受击后短暂获得减伤护盾" },
  revive: { group: "生存", tier: "rare", name: "月魂续命", max: 3, baseCost: 420, requiresChapter: 15, desc: "每局获得一次更强倒地恢复" },
  bulwark: { group: "生存", tier: "rare", name: "不破壁垒", max: 5, baseCost: 280, requiresChapter: 10, desc: "短时间内连续受击时伤害递减" },
  undying: { group: "生存", tier: "legendary", name: "不死鸟之心", max: 3, baseCost: 680, requiresChapter: 20, desc: "复活后短暂无敌并回复大量生命" },
  titanShell: { group: "生存", tier: "legendary", name: "泰坦之壳", max: 3, baseCost: 780, requiresChapter: 24, desc: "极大提高生命上限和减伤" },

  /* ── 机动 ── */
  swiftness: { group: "机动", tier: "common", name: "疾行铭文", max: 10, baseCost: 80, desc: "永久速度提高" },
  focus: { group: "机动", tier: "common", name: "沙漏记忆", max: 12, baseCost: 110, desc: "永久冷却缩短" },
  pathfinder: { group: "机动", tier: "rare", name: "荒原行者", max: 8, baseCost: 150, requiresChapter: 5, desc: "移动和拉扯能力提高" },
  quickstep: { group: "机动", tier: "common", name: "闪步灵巧", max: 8, baseCost: 90, requiresChapter: 3, desc: "受到攻击后短暂提速" },
  momentum: { group: "机动", tier: "common", name: "冲量叠加", max: 10, baseCost: 100, desc: "持续移动时逐渐提速" },
  warpStride: { group: "机动", tier: "rare", name: "折跃步伐", max: 6, baseCost: 200, requiresChapter: 8, desc: "短距离冲刺穿越敌人" },
  blink: { group: "机动", tier: "rare", name: "影步余烬", max: 5, baseCost: 280, requiresChapter: 18, desc: "危险时获得短暂加速窗口" },
  phaseShift: { group: "机动", tier: "rare", name: "相位漂移", max: 5, baseCost: 240, requiresChapter: 12, desc: "移动时有概率闪避弹幕" },
  phantomRush: { group: "机动", tier: "legendary", name: "幻影疾行", max: 3, baseCost: 700, requiresChapter: 22, desc: "冲刺后留下分身吸引敌人" },
  timeWarp: { group: "机动", tier: "legendary", name: "时间扭曲", max: 3, baseCost: 820, requiresChapter: 26, desc: "短暂减缓周围时间流速" },

  /* ── 资源 ── */
  fortune: { group: "资源", tier: "common", name: "赤金命运", max: 12, baseCost: 120, desc: "月尘与宝箱收益提高" },
  scholar: { group: "资源", tier: "common", name: "星核学识", max: 10, baseCost: 130, requiresChapter: 2, desc: "团队经验获取提高" },
  scavenger: { group: "资源", tier: "rare", name: "拾荒直觉", max: 8, baseCost: 160, requiresChapter: 7, desc: "宝箱和补给出现更频繁" },
  prospector: { group: "资源", tier: "common", name: "探矿嗅觉", max: 8, baseCost: 110, requiresChapter: 3, desc: "月尘掉落概率提高" },
  merchant: { group: "资源", tier: "common", name: "旅商之道", max: 6, baseCost: 140, requiresChapter: 5, desc: "升级时有概率不消耗经验" },
  banker: { group: "资源", tier: "rare", name: "月尘账簿", max: 10, baseCost: 190, requiresChapter: 10, desc: "章节结算月尘提高" },
  alchemy: { group: "资源", tier: "rare", name: "炼金术印", max: 6, baseCost: 220, requiresChapter: 12, desc: "击杀精英额外掉落经验球" },
  dragonHoard: { group: "资源", tier: "rare", name: "龙穴宝藏", max: 5, baseCost: 260, requiresChapter: 14, desc: "宝箱内奖励品质提高" },
  midasTouch: { group: "资源", tier: "legendary", name: "点金之手", max: 3, baseCost: 720, requiresChapter: 22, desc: "击杀有概率直接获得月尘" },
  wealthSigil: { group: "资源", tier: "legendary", name: "财富符印", max: 3, baseCost: 800, requiresChapter: 26, desc: "通关结算资源翻倍" },

  /* ── 协作 ── */
  rescue: { group: "协作", tier: "common", name: "同袍回响", max: 8, baseCost: 115, desc: "救援速度提高" },
  rallyCry: { group: "协作", tier: "common", name: "集结号令", max: 8, baseCost: 100, desc: "队友附近时自身伤害提高" },
  banner: { group: "协作", tier: "rare", name: "战旗共鸣", max: 8, baseCost: 170, requiresChapter: 9, desc: "多人房间中全队生命提高" },
  tactician: { group: "协作", tier: "rare", name: "猎团战术", max: 8, baseCost: 210, requiresChapter: 14, desc: "多人房间中全队伤害提高" },
  guardianLink: { group: "协作", tier: "common", name: "守护链接", max: 6, baseCost: 130, requiresChapter: 6, desc: "队友受伤时自身获得减伤" },
  sharedFate: { group: "协作", tier: "common", name: "共命运锁", max: 6, baseCost: 160, requiresChapter: 8, desc: "队友倒地时全队短暂提速" },
  medic: { group: "协作", tier: "rare", name: "巡夜医术", max: 6, baseCost: 240, requiresChapter: 16, desc: "救援后恢复更多生命" },
  commandAura: { group: "协作", tier: "rare", name: "指挥光环", max: 5, baseCost: 280, requiresChapter: 18, desc: "自身周围队友冷却缩短" },
  warlordOath: { group: "协作", tier: "legendary", name: "军神誓约", max: 3, baseCost: 760, requiresChapter: 24, desc: "全队共享部分天赋加成" },
  phoenixBond: { group: "协作", tier: "legendary", name: "凤凰羁绊", max: 3, baseCost: 840, requiresChapter: 28, desc: "救援成功时双方获得短暂无敌" },

  /* ── 深层 ── */
  eclipse: { group: "深层", tier: "rare", name: "月蚀刻印", max: 10, baseCost: 320, requiresChapter: 20, desc: "高章节通关收益提高" },
  voidTouched: { group: "深层", tier: "common", name: "虚空之触", max: 8, baseCost: 280, requiresChapter: 18, desc: "对受控敌人伤害提高" },
  crown: { group: "深层", tier: "rare", name: "王冠碎片", max: 8, baseCost: 460, requiresChapter: 30, desc: "后期 Boss 战能力提高" },
  voidcraft: { group: "深层", tier: "rare", name: "虚空工艺", max: 8, baseCost: 520, requiresChapter: 35, desc: "范围技能潜力提高" },
  entropyWell: { group: "深层", tier: "common", name: "熵能井", max: 8, baseCost: 300, requiresChapter: 20, desc: "每击杀一定敌人获得临时伤害" },
  moonRite: { group: "深层", tier: "common", name: "月蚀仪式", max: 6, baseCost: 340, requiresChapter: 22, desc: "每波敌人之间回复生命" },
  abyssalPact: { group: "深层", tier: "rare", name: "深渊契约", max: 5, baseCost: 580, requiresChapter: 32, desc: "降低自身生命换取极高伤害" },
  stellarForge: { group: "深层", tier: "rare", name: "星锻核心", max: 5, baseCost: 620, requiresChapter: 36, desc: "每隔一段时间强化一次攻击" },
  finalOath: { group: "深层", tier: "legendary", name: "终夜誓约", max: 3, baseCost: 900, requiresChapter: 45, desc: "终盘章节综合能力提高" },
  oblivionCrown: { group: "深层", tier: "legendary", name: "湮灭之冠", max: 3, baseCost: 950, requiresChapter: 42, desc: "所有天赋上限 +1" }
};

const talentLinks = {
  keenEdge: ["might"], execution: ["might"],
  fury: ["keenEdge"], bloodrage: ["keenEdge"],
  deathmark: ["execution"], multistar: ["execution", "fury"],
  overwhelm: ["bloodrage", "fury"],
  starfall: ["deathmark", "multistar"], apocalypse: ["multistar", "overwhelm"],

  ironSkin: ["vitality"], ward: ["vitality"],
  endurance: ["ironSkin"], barrier: ["ironSkin"],
  regen: ["vitality"],
  revive: ["ward", "regen"], bulwark: ["endurance", "ward"],
  undying: ["revive", "bulwark"], titanShell: ["barrier", "revive"],

  quickstep: ["swiftness"], momentum: ["swiftness"],
  pathfinder: ["swiftness"], focus: [],
  warpStride: ["pathfinder", "quickstep"],
  blink: ["pathfinder", "focus"], phaseShift: ["momentum", "focus"],
  phantomRush: ["warpStride", "blink"], timeWarp: ["phaseShift", "blink"],

  prospector: ["fortune"], scholar: ["fortune"],
  merchant: ["scholar"],
  scavenger: ["fortune"],
  banker: ["scholar", "scavenger"], alchemy: ["prospector", "scavenger"],
  dragonHoard: ["merchant", "banker"],
  midasTouch: ["banker", "alchemy"], wealthSigil: ["dragonHoard", "alchemy"],

  rallyCry: ["rescue"], guardianLink: ["rescue"],
  banner: ["rescue"], tactician: ["rallyCry"],
  sharedFate: ["guardianLink", "banner"],
  medic: ["banner", "tactician"], commandAura: ["sharedFate", "tactician"],
  warlordOath: ["medic", "commandAura"], phoenixBond: ["sharedFate", "medic"],

  voidTouched: ["eclipse"], entropyWell: ["eclipse"],
  moonRite: ["voidTouched"],
  crown: ["eclipse"], voidcraft: ["eclipse"],
  abyssalPact: ["crown", "entropyWell"], stellarForge: ["voidcraft", "moonRite"],
  finalOath: ["crown", "voidcraft"], oblivionCrown: ["abyssalPact", "stellarForge"]
};

for (const [id, links] of Object.entries(talentLinks)) {
  if (talents[id]) talents[id].requiresTalent = links;
}

const upgradeDefs = [
  { id: "might", name: "星焰增幅", desc: "伤害 +12%", stat: "伤害倍率", max: 5, unlockChapter: 1, color: "#ff9658", icon: "✦" },
  { id: "speed", name: "疾行风帽", desc: "速度 +18", stat: "移动速度", max: 5, unlockChapter: 1, color: "#7fe0c4", icon: "➤" },
  { id: "cooldown", name: "沙漏碎片", desc: "攻击间隔 -10%", stat: "冷却缩短", max: 5, unlockChapter: 1, color: "#7bb8ff", icon: "⌁" },
  { id: "vitality", name: "温血圣杯", desc: "生命上限 +24 并回复", stat: "生命上限", max: 5, unlockChapter: 1, color: "#d3424f", icon: "◆" },
  { id: "multishot", name: "双生星盘", desc: "额外发射一枚星矢", stat: "弹幕数量", max: 4, unlockChapter: 2, color: "#f4c95d", icon: "✷" },
  { id: "aura", name: "霜星阵", desc: "周期性范围伤害", stat: "范围伤害", max: 4, unlockChapter: 3, color: "#a98cff", icon: "❄" },
  { id: "pierce", name: "贯月矢", desc: "弹幕穿透 +1", stat: "穿透", max: 4, unlockChapter: 5, color: "#f6f0dc", icon: "➶" },
  { id: "crit", name: "猩红命定", desc: "暴击率 +8%", stat: "暴击率", max: 5, unlockChapter: 7, color: "#d3424f", icon: "✹" },
  { id: "chain", name: "雷链共鸣", desc: "弹幕命中后弹射 1 个附近敌人", stat: "弹射", max: 4, unlockChapter: 8, color: "#ffe08a", icon: "⚡" },
  { id: "magnet", name: "引星罗盘", desc: "拾取范围 +36", stat: "磁吸范围", max: 4, unlockChapter: 9, color: "#7fe0c4", icon: "◎" },
  { id: "lifesteal", name: "血月吸取", desc: "击杀回复 3 生命", stat: "吸血", max: 4, unlockChapter: 10, color: "#ff5577", icon: "♥" },
  { id: "range", name: "望月长弓", desc: "射程 +18%", stat: "射程", max: 4, unlockChapter: 11, color: "#7bb8ff", icon: "↗" },
  { id: "shield", name: "旧王壁垒", desc: "伤害减免 +8%", stat: "减伤", max: 4, unlockChapter: 13, color: "#f4c95d", icon: "⬟" },
  { id: "recovery", name: "圣灯余温", desc: "持续回复 +0.22/s", stat: "生命回复", max: 4, unlockChapter: 15, color: "#98df62", icon: "✚" },
  { id: "thorns", name: "荆棘反噬", desc: "受击反弹 6 伤害", stat: "反伤", max: 4, unlockChapter: 16, color: "#b8ffce", icon: "✦" },
  { id: "orbit", name: "月环刃", desc: "生成旋转月刃", stat: "环绕伤害", max: 4, unlockChapter: 18, color: "#c7f9ff", icon: "◌" },
  { id: "dash", name: "影步突进", desc: "移动速度额外 +10 并冲刺时短暂无敌", stat: "冲刺", max: 3, unlockChapter: 20, color: "#a98cff", icon: "↝" },
  { id: "nova", name: "坠星新星", desc: "定期爆发星落", stat: "爆发清场", max: 4, unlockChapter: 22, color: "#ffe08a", icon: "✺" },
  { id: "curse", name: "血月诅咒", desc: "敌人受伤后更脆弱", stat: "易伤", max: 4, unlockChapter: 28, color: "#ff7a90", icon: "☾" },
  { id: "guardian", name: "守夜傀儡", desc: "召唤协战光灵", stat: "召唤物", max: 3, unlockChapter: 35, color: "#b8ffce", icon: "♙" }
];

const evolutionDefs = [
  { id: "solarLance", name: "日冕长枪", needs: ["might", "pierce"], desc: "伤害与穿透满级后，弹幕体积和 Boss 伤害提高" },
  { id: "stormHalo", name: "暴风星环", needs: ["aura", "cooldown"], desc: "范围阵和冷却满级后，范围阵触发更快并扩大" },
  { id: "bloodComet", name: "血月彗星", needs: ["crit", "range"], desc: "暴击和射程满级后，暴击弹幕造成溅射" },
  { id: "pilgrimEngine", name: "巡礼引擎", needs: ["magnet", "speed"], desc: "磁吸和速度满级后，拾取经验会短暂提速" },
  { id: "immortalLantern", name: "不灭圣灯", needs: ["shield", "recovery"], desc: "护盾和恢复满级后，濒死时获得一次强回复" },
  { id: "eclipseGarden", name: "月蚀花庭", needs: ["orbit", "nova"], desc: "月环刃和新星满级后，周期爆发会留下伤害区域" },
  { id: "thunderChain", name: "雷云风暴", needs: ["chain", "multishot"], desc: "雷链和多重射击满级后，弹射次数 +2 并附带麻痹" },
  { id: "bloodPact", name: "血契收割", needs: ["lifesteal", "thorns"], desc: "吸血和反伤满级后，反伤也会回血" },
  { id: "phantomRush", name: "幻影突袭", needs: ["dash", "crit"], desc: "冲刺和暴击满级后，冲刺结束时释放弹幕" },
  { id: "voidNova", name: "虚空坍缩", needs: ["nova", "magnet"], desc: "新星和磁吸满级后，新星范围扩大并自动吸取附近经验" },
  { id: "ironBloom", name: "铁花绽放", needs: ["vitality", "aura"], desc: "生命和范围阵满级后，受伤时触发一次额外范围伤害" },
  { id: "soulHarvest", name: "灵魂收割", needs: ["curse", "lifesteal"], desc: "诅咒和吸血满级后，击杀精英额外回复生命并永久提高伤害" },
  { id: "starForge", name: "星辰锻造", needs: ["orbit", "shield"], desc: "月环刃和护盾满级后，月刃旋转期间获得额外减伤" },
  { id: "crimsonTide", name: "赤潮漩涡", needs: ["thorns", "vitality"], desc: "反伤和生命满级后，每损失 10% 生命提升反伤效果" }
];

const roomModifiers = [
  { id: "blessedLantern", type: "buff", name: "古灯护佑", desc: "全队生命 +12%，补给事件更频繁", effects: { hp: 1.12, eventRate: 0.82 } },
  { id: "starForge", type: "buff", name: "星炉共鸣", desc: "经验 +18%，但敌人生命 +10%", effects: { xp: 1.18, enemyHp: 1.1 } },
  { id: "treasureOath", type: "buff", name: "财宝誓约", desc: "宝箱概率 +8%，敌群密度 +1", effects: { chest: 0.08, swarm: 1 } },
  { id: "moonGrace", type: "buff", name: "月神恩典", desc: "全队冷却 -8%，但首领伤害 +12%", effects: { cooldown: 0.92, bossDmg: 1.12 } },
  { id: "vitalEcho", type: "buff", name: "生命回响", desc: "救援速度 +40%，倒地惩罚 -50%", effects: { rescueSpeed: 0.714, downPenalty: 0.5 } },
  { id: "thinBlood", type: "debuff", name: "薄血远征", desc: "全队生命 -15%，通关月尘 +18%", effects: { hp: 0.85, reward: 1.18 } },
  { id: "nightHunt", type: "debuff", name: "夜猎追缉", desc: "敌人速度 +14%，得分 +15%", effects: { enemySpeed: 1.14, score: 1.15 } },
  { id: "sealedRelics", type: "debuff", name: "封印遗物", desc: "升级间隔变长，通关奖励 +22%", effects: { xpNeed: 1.18, reward: 1.22 } },
  { id: "frenzyTide", type: "debuff", name: "狂潮涌动", desc: "每批刷怪 +3，得分 +25%", effects: { swarm: 3, score: 1.25 } },
  { id: "voidExposure", type: "debuff", name: "虚空侵蚀", desc: "精英出现率 +20%，击杀精英经验 +35%", effects: { eliteRate: 1.2, eliteXp: 1.35 } }
];

const difficulties = [
  { id: "normal", name: "普通", desc: "标准挑战", hpMul: 1, scoreMul: 1, rewardMul: 1 },
  { id: "hard", name: "困难", desc: "怪物血量+50%", hpMul: 1.5, scoreMul: 1.4, rewardMul: 1.3 },
  { id: "nightmare", name: "噩梦", desc: "怪物血量+120%", hpMul: 2.2, scoreMul: 2, rewardMul: 1.8 }
];

const coopAchievements = [
  { id: "first_clear", name: "初出茅庐", desc: "首次完成联机关卡", icon: "⚔" },
  { id: "no_death", name: "无伤通关", desc: "联机模式中全程未倒下", icon: "🛡" },
  { id: "speed_clear", name: "闪电通关", desc: "在120秒内通关联机关卡", icon: "⚡" },
  { id: "boss_slayer", name: "弑君者", desc: "在联机中累计击杀10个Boss", icon: "♛" },
  { id: "rescue_5", name: "救世主", desc: "在联机中累计救援队友5次", icon: "✚" },
  { id: "full_team", name: "五人齐心", desc: "5人满员通关", icon: "👥" },
  { id: "hard_clear", name: "困难克星", desc: "困难难度通关", icon: "★" },
  { id: "nightmare_clear", name: "噩梦行者", desc: "噩梦难度通关", icon: "★★" },
  { id: "modifier_3", name: "词条大师", desc: "携带3个词条通关", icon: "◈" },
  { id: "weekly_clear", name: "周冠军", desc: "完成一次每周挑战", icon: "☽" }
];

function getWeeklyChallenge() {
  const now = new Date();
  const weekNum = Math.floor((now - new Date(2026, 0, 1)) / (7 * 86400000));
  const seed = 20260101 + weekNum;
  const rng = seededRandom(seed);
  const chapterId = Math.min(chapters.length, Math.max(1, Math.floor(rng() * 25) + 1));
  const chapter = chapters[chapterId - 1] || chapters[0];
  const shuffled = [...roomModifiers].sort(() => rng() - 0.5);
  const modifiers = shuffled.slice(0, 3).map(m => ({ id: m.id, name: m.name, desc: m.desc, type: m.type }));
  return { weekNum, chapterId, chapterName: chapter.name, modifiers, seed };
}

function dailySeed() {
  const d = new Date();
  return d.getFullYear() * 10000 + (d.getMonth() + 1) * 100 + d.getDate();
}
function seededRandom(seed) {
  let s = seed;
  return () => { s = (s * 1103515245 + 12345) & 0x7fffffff; return s / 0x7fffffff; };
}
function getDailyChallenge() {
  const seed = dailySeed();
  const rng = seededRandom(seed);
  const debuffs = roomModifiers.filter(m => m.type === "debuff");
  const picks = [];
  const pool = [...debuffs];
  for (let i = 0; i < 3 && pool.length; i++) {
    const idx = Math.floor(rng() * pool.length);
    picks.push(pool.splice(idx, 1)[0]);
  }
  const chapterId = Math.min(50, Math.max(1, Math.floor(rng() * 15) + 5));
  const chapter = chapters[chapterId - 1] || chapters[0];
  return { seed, chapterId, chapterName: chapter.name, modifiers: picks.map(m => ({ id: m.id, name: m.name, desc: m.desc })) };
}

const encyclopedia = {
  terms: [
    { name: "章节词缀", desc: "每关自带的规则变化，会改变敌群、事件、补给和危险区。" },
    { name: "房间词条", desc: "创建联机房间时可选的挑战规则，包含增益和减益，影响全队结算。" },
    { name: "倒地救援", desc: "生命归零后进入倒地，队友靠近可救援；全员倒地则失败。" },
    { name: "月尘", desc: "长期养成货币，用于点亮星盘，通关和失败都会获得。" },
    { name: "宝箱", desc: "打开后全队暂停并选择一次局内升级。" },
    { name: "危险区", desc: "地面预警后爆发的区域伤害，多人 Boss 会更频繁制造危险区。" },
    { name: "进化联动", desc: "两个指定技能都满级后触发进化，获得额外效果。" },
    { name: "雷链弹射", desc: "弹幕命中后弹射到附近敌人，适合密集怪群。" },
    { name: "荆棘反伤", desc: "受到接触伤害时反弹一部分给敌人。" },
    { name: "连斩", desc: "短时间内击杀多个敌人触发连斩计数，纯粹视觉效果。" },
    { name: "厚甲变种", desc: "敌人生命值提高，需要更多输出才能击杀。" },
    { name: "玻璃炮台", desc: "敌人伤害提高但生命降低，适合走位躲避。" },
    { name: "月光复苏", desc: "敌人会缓慢回血，需要持续输出。" },
    { name: "分裂原质", desc: "大型敌人死亡后分裂为两个小怪。" },
    { name: "月神恩典", desc: "房间词条：全队冷却缩短，但首领伤害更高。" },
    { name: "狂潮涌动", desc: "房间词条：敌群更密集但得分更高，适合追求高分。" },
    { name: "星辉喷泉", desc: "高章节随机事件：在中心生成大量经验星，快速收集。" },
    { name: "护佑之环", desc: "高章节随机事件：生成绿色减伤区域，善用站位。" },
    { name: "噬血猎手", desc: "敌人死亡时附近敌人回复少量生命，需要分散击杀。" },
    { name: "月光护盾", desc: "敌人有几率大幅减伤，触发时会闪紫色光效。" },
    { name: "灵魂收割", desc: "进化联动：诅咒和吸血满级后，击杀精英额外回血并永久提高伤害。" },
    { name: "星辰锻造", desc: "进化联动：月环刃和护盾满级后，月刃旋转期间获得额外减伤。" },
    { name: "赤潮漩涡", desc: "进化联动：反伤和生命满级后，每损失 10% 生命提升反伤效果。" },
    { name: "生命回响", desc: "房间词条：救援倒地队友更快，倒地惩罚更低，适合新手。" },
    { name: "虚空侵蚀", desc: "房间词条：精英敌人更多但击杀精英给更多经验，适合精英猎手。" },
    { name: "月亮碎片", desc: "中章节随机事件：在附近生成多个治疗道具，危机时刻的补给。" },
    { name: "时空裂隙", desc: "高章节随机事件：出现高伤害区域，但周围散布大量经验星，高风险高回报。" },
    { name: "狂暴之潮", desc: "敌人攻击间隔缩短，需要更频繁走位躲避。" },
    { name: "瞬移猎手", desc: "精英敌人会周期性短距传送，难以风筝。" }
  ],
  monsters: Object.entries(enemyDefs).map(([id, def]) => ({
    id,
    name: def.name,
    desc: def.ranged ? "远程施法敌人，会在中距离发射弹幕。" : def.speed > 100 ? "高速追击敌人，适合用范围技能清理。" : def.hp > 100 ? "厚血近战敌人，常作为精英波次核心。" : "基础敌人，会持续向玩家靠近。",
    hp: def.hp,
    damage: def.damage,
    speed: def.speed
  })),
  bosses: chapterThemes.map((theme, index) => ({
    id: `boss-${index + 1}`,
    name: theme.boss,
    desc: index >= 2
      ? `来自${theme.zone}的章节首领，会使用追踪弹、分摊圈和弹幕风暴。高章节首领还会传送突袭和召唤小怪。`
      : `来自${theme.zone}的章节首领，会使用追踪弹、分摊圈和地图危险区。`
  })),
  upgrades: upgradeDefs.map(item => ({ id: item.id, name: item.name, desc: item.desc })),
  roomModifiers
};

/* ── SVG 图标生成 ── */
function hashString(str) { let h = 5381; for (let i = 0; i < str.length; i++) h = ((h << 5) + h + str.charCodeAt(i)) >>> 0; return h; }
function seededRandom(seed) { let s = seed; return () => { s = (s * 16807 + 7) % 2147483647; return (s - 1) / 2147483646; }; }
function hexToRgb(hex) { const n = parseInt(hex.slice(1), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; }
function rgbToHex(r, g, b) { return "#" + [r, g, b].map(v => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, "0")).join(""); }
function darken(hex, a) { const [r, g, b] = hexToRgb(hex); return rgbToHex(r * (1 - a), g * (1 - a), b * (1 - a)); }
function lighten(hex, a) { const [r, g, b] = hexToRgb(hex); return rgbToHex(r + (255 - r) * a, g + (255 - g) * a, b + (255 - b) * a); }
function svgWrap(body) { return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128">${body}</svg>`; }

function generateMonsterSvg(id, def) {
  const rng = seededRandom(hashString(id));
  const c = def.color;
  const dark = darken(c, 0.35);
  const light = lighten(c, 0.25);
  const ox = () => Math.round(rng() * 8 - 4);
  const oy = () => Math.round(rng() * 6 - 3);
  let body = `<rect width="128" height="128" rx="16" fill="#0a0810"/>`;
  body += `<rect width="128" height="128" rx="16" fill="${c}" opacity="0.06"/>`;
  if (id === "husk") {
    body += `<path d="M${40 + ox()} ${30 + oy()} L${88 + ox()} ${30 + oy()} Q96 40 92 90 L36 90 Q32 40 ${40 + ox()} ${30 + oy()}Z" fill="${c}" stroke="${dark}" stroke-width="2"/>`;
    body += `<ellipse cx="50" cy="55" rx="7" ry="9" fill="#0a0810"/><ellipse cx="78" cy="55" rx="7" ry="9" fill="#0a0810"/>`;
    body += `<ellipse cx="${51 + ox()}" cy="${56 + oy()}" rx="3" ry="4" fill="${light}"/>`;
    body += `<ellipse cx="${79 + ox()}" cy="${56 + oy()}" rx="3" ry="4" fill="${light}"/>`;
    body += `<path d="M48 75 L54 72 L60 76 L66 71 L72 75 L78 72" stroke="${dark}" stroke-width="2" fill="none" stroke-linecap="round"/>`;
    for (let i = 0; i < 4; i++) body += `<line x1="${20}" y1="${35 + i * 16}" x2="${108}" y2="${35 + i * 16}" stroke="${c}" stroke-width="0.5" opacity="0.12"/>`;
  } else if (id === "bat") {
    body += `<path d="M64 ${38 + oy()} L${42 + ox()} 70 Q30 82 22 68 L38 56 L64 72" fill="${c}" opacity="0.7"/>`;
    body += `<path d="M64 ${38 + oy()} L${86 + ox()} 70 Q98 82 106 68 L90 56 L64 72" fill="${c}" opacity="0.7"/>`;
    body += `<ellipse cx="64" cy="62" rx="14" ry="18" fill="${c}" stroke="${dark}" stroke-width="1.5"/>`;
    body += `<circle cx="${58 + ox()}" cy="${56 + oy()}" r="3.5" fill="#0a0810"/><circle cx="${70 + ox()}" cy="${56 + oy()}" r="3.5" fill="#0a0810"/>`;
    body += `<circle cx="${58}" cy="${55}" r="1.5" fill="${light}"/><circle cx="${70}" cy="${55}" r="1.5" fill="${light}"/>`;
    for (let i = 0; i < 6; i++) body += `<circle cx="${20 + rng() * 88}" cy="${20 + rng() * 88}" r="${1 + rng() * 2}" fill="${c}" opacity="${0.1 + rng() * 0.15}"/>`;
  } else if (id === "brute") {
    body += `<circle cx="64" cy="68" r="30" fill="${c}" stroke="${dark}" stroke-width="2.5"/>`;
    for (let i = -2; i <= 2; i++) body += `<circle cx="${64 + i * 12}" cy="${36 + Math.abs(i) * 3}" r="${5 + rng() * 3}" fill="${dark}"/>`;
    body += `<line x1="46" y1="${60 + oy()}" x2="58" y2="${62 + oy()}" stroke="#0a0810" stroke-width="3" stroke-linecap="round"/>`;
    body += `<line x1="70" y1="${60 + oy()}" x2="82" y2="${62 + oy()}" stroke="#0a0810" stroke-width="3" stroke-linecap="round"/>`;
    body += `<rect x="50" y="78" width="28" height="6" rx="3" fill="#0a0810"/>`;
    for (let i = 0; i < 5; i++) { body += `<line x1="${10}" y1="${10 + i * 24}" x2="${118}" y2="${10 + i * 24}" stroke="${dark}" stroke-width="0.5" opacity="0.08"/>`; body += `<line x1="${10 + i * 24}" y1="10" x2="${10 + i * 24}" y2="118" stroke="${dark}" stroke-width="0.5" opacity="0.08"/>`; }
  } else if (id === "spitter") {
    body += `<ellipse cx="64" cy="64" rx="22" ry="28" fill="${c}" stroke="${dark}" stroke-width="2"/>`;
    body += `<circle cx="64" cy="${40 + oy()}" r="5" fill="${light}" opacity="0.9"/>`;
    body += `<circle cx="${56 + ox()}" cy="${54 + oy()}" r="4" fill="#0a0810"/><circle cx="${72 + ox()}" cy="${54 + oy()}" r="4" fill="#0a0810"/>`;
    body += `<circle cx="64" cy="72" r="6" fill="#0a0810"/><circle cx="64" cy="72" r="3" fill="${light}" opacity="0.5"/>`;
    body += `<circle cx="${90 + ox()}" cy="${64 + oy()}" r="4" fill="${light}" opacity="0.6"/>`;
    for (let i = 1; i <= 3; i++) body += `<path d="M${86 + i * 6} 64 A${10 + i * 8} ${10 + i * 8} 0 0 1 64 ${64 - 10 - i * 8}" fill="none" stroke="${c}" stroke-width="0.8" opacity="${0.2 - i * 0.04}"/>`;
  } else {
    const pts = [[64, 32], [82, 52], [76, 80], [52, 80], [46, 52]];
    for (const [px, py] of pts) body += `<polygon points="${64},${32 + rng() * 6} ${82 + rng() * 6},${52} ${76},${80 + rng() * 6} ${52 - rng() * 6},${80} ${46 - rng() * 6},${52}" fill="${c}" opacity="${0.5 + rng() * 0.3}" stroke="${light}" stroke-width="1"/>`;
    body += `<circle cx="64" cy="62" r="6" fill="${light}" opacity="0.8"/>`;
    body += `<circle cx="64" cy="62" r="2.5" fill="#fff"/>`;
    for (let i = 0; i < 8; i++) body += `<line x1="64" y1="62" x2="${64 + Math.cos(i * Math.PI / 4) * 22}" y2="${62 + Math.sin(i * Math.PI / 4) * 22}" stroke="${light}" stroke-width="0.8" opacity="0.3"/>`;
    for (let i = 0; i < 12; i++) body += `<circle cx="${16 + (i % 4) * 32}" cy="${16 + Math.floor(i / 4) * 36}" r="1.5" fill="${c}" opacity="0.15"/>`;
  }
  return svgWrap(body);
}

function generateBossSvg(index, theme) {
  const c = theme.palette[2];
  const dark = darken(c, 0.3);
  const shapes = [
    `M44 30 L84 30 L88 42 L80 42 L80 90 L48 90 L48 42 L40 42Z`,
    `M64 28 L30 72 Q48 62 64 78 Q80 62 98 72Z`,
    `M56 25 L72 25 L72 52 L96 52 L96 68 L72 68 L72 95 L56 95Z`,
    `M38 38 L90 38 L64 92Z M60 92 L60 108 L68 108 L68 92`,
    `M64 22 L74 42 L96 44 L80 60 L86 82 L64 70 L42 82 L48 60 L32 44 L54 42Z`,
    `M48 22 L80 22 L82 92 L46 92Z M48 36 L80 36 M48 52 L80 52 M48 68 L80 68`,
    `M52 24 L76 24 Q82 24 82 32 L82 52 Q82 68 64 72 Q46 68 46 52 L46 32 Q46 24 52 24Z M42 76 L86 76 M46 84 L82 84 M50 92 L78 92`,
    `M64 26 L92 46 L86 88 L42 88 L36 46Z M64 46 L78 56 L74 76 L54 76 L50 56Z`,
    `M64 36 Q52 36 48 48 Q44 60 52 66 Q56 70 60 66 Q56 58 60 52 Q64 46 64 36Z M64 36 Q76 36 80 48 Q84 60 76 66 Q72 70 68 66 Q72 58 68 52 Q64 46 64 36Z M64 42 Q56 44 54 52 M64 42 Q72 44 74 52 M64 68 L64 90`,
    `M64 20 L88 36 L88 80 L64 96 L40 80 L40 36Z M64 36 L76 44 L76 68 L64 76 L52 68 L52 44Z`
  ];
  let body = `<rect width="128" height="128" rx="16" fill="#0a0810"/>`;
  body += `<circle cx="64" cy="64" r="56" fill="none" stroke="${c}" stroke-width="1.5" stroke-dasharray="6 4" opacity="0.25"/>`;
  body += `<circle cx="64" cy="64" r="48" fill="${c}" opacity="0.06"/>`;
  body += `<path d="${shapes[index % shapes.length]}" fill="${c}" opacity="0.85" stroke="${dark}" stroke-width="1.5"/>`;
  body += `<circle cx="55" cy="50" r="3" fill="#0a0810"/><circle cx="73" cy="50" r="3" fill="#0a0810"/>`;
  body += `<circle cx="55" cy="49" r="1.2" fill="${lighten(c, 0.4)}"/><circle cx="73" cy="49" r="1.2" fill="${lighten(c, 0.4)}"/>`;
  for (let i = 0; i < 4; i++) body += `<circle cx="${20 + seededRandom(hashString(theme.boss) + i)() * 88}" cy="${20 + seededRandom(hashString(theme.boss) + i + 100)() * 88}" r="${1.5 + seededRandom(hashString(theme.boss) + i + 200)() * 2}" fill="${c}" opacity="0.2"/>`;
  return svgWrap(body);
}

function generateUpgradeSvg(id, def) {
  const c = def.color;
  const symbols = {
    might: `<path d="M64 20 L74 52 L108 52 L80 72 L90 104 L64 84 L38 104 L48 72 L20 52 L54 52Z" fill="${c}" opacity="0.85"/>`,
    speed: `<path d="M36 40 L64 20 L64 52 L92 52 L64 92 L64 64Z" fill="${c}" opacity="0.85"/>`,
    cooldown: `<path d="M42 30 L86 30 L76 58 L52 58Z M52 70 L76 70 L86 98 L42 98Z" fill="${c}" opacity="0.85"/>`,
    vitality: `<path d="M64 96 L30 60 Q22 44 34 34 Q46 24 58 34 L64 40 L70 34 Q82 24 94 34 Q106 44 98 60Z" fill="${c}" opacity="0.85"/>`,
    multishot: `<path d="M30 64 L54 42 L54 56 L98 56 L98 72 L54 72 L54 86Z" fill="${c}" opacity="0.7"/><path d="M30 38 L48 24 L48 32 L78 32 L78 44 L48 44 L48 52Z" fill="${c}" opacity="0.5"/><path d="M30 90 L48 76 L48 84 L78 84 L78 96 L48 96 L48 104Z" fill="${c}" opacity="0.5"/>`,
    aura: `<path d="M64 24 L70 46 L92 40 L78 56 L98 68 L76 70 L82 92 L64 78 L46 92 L52 70 L30 68 L50 56 L36 40 L58 46Z" fill="${c}" opacity="0.6"/>`,
    pierce: `<path d="M64 16 L72 44 L98 44 L98 56 L72 56 L72 80 L100 80 L100 92 L56 92 L56 80 L72 80" fill="${c}" opacity="0.85"/><line x1="56" y1="92" x2="28" y2="112" stroke="${c}" stroke-width="3" opacity="0.4"/>`,
    crit: `<path d="M64 20 L72 50 L100 44 L78 66 L90 96 L64 78 L38 96 L50 66 L28 44 L56 50Z" fill="${c}" opacity="0.85"/><circle cx="64" cy="64" r="10" fill="${lighten(c, 0.3)}" opacity="0.6"/>`,
    chain: `<path d="M30 40 L48 40 L56 24 L64 40 L82 40 L72 56 L88 72 L68 72 L64 92 L56 72 L36 72 L48 56Z" fill="${c}" opacity="0.8"/>`,
    magnet: `<circle cx="64" cy="64" r="36" fill="none" stroke="${c}" stroke-width="2" opacity="0.3"/><circle cx="64" cy="64" r="24" fill="none" stroke="${c}" stroke-width="2" opacity="0.5"/><circle cx="64" cy="64" r="12" fill="none" stroke="${c}" stroke-width="2" opacity="0.7"/><circle cx="64" cy="64" r="4" fill="${c}"/>`,
    lifesteal: `<path d="M64 96 L28 58 Q18 40 32 28 Q48 16 60 30 L64 36 L68 30 Q80 16 96 28 Q110 40 100 58Z" fill="${c}" opacity="0.85"/><path d="M54 52 L54 72 M44 62 L64 62" stroke="#0a0810" stroke-width="3" stroke-linecap="round"/>`,
    range: `<path d="M36 92 L64 20 L72 28 L52 92Z" fill="${c}" opacity="0.8"/><path d="M76 32 A48 48 0 0 1 96 80" fill="none" stroke="${c}" stroke-width="2" stroke-dasharray="4 3" opacity="0.4"/>`,
    shield: `<path d="M64 18 L96 34 L96 68 Q96 96 64 110 Q32 96 32 68 L32 34Z" fill="${c}" opacity="0.75" stroke="${darken(c, 0.2)}" stroke-width="1.5"/>`,
    recovery: `<rect x="56" y="32" width="16" height="64" rx="4" fill="${c}" opacity="0.85"/><rect x="32" y="56" width="64" height="16" rx="4" fill="${c}" opacity="0.85"/>`,
    thorns: `<path d="M64 24 L72 50 L100 44 L78 66 L90 96 L64 78 L38 96 L50 66 L28 44 L56 50Z" fill="${c}" opacity="0.7"/><line x1="64" y1="24" x2="64" y2="14" stroke="${c}" stroke-width="2"/><line x1="100" y1="44" x2="110" y2="38" stroke="${c}" stroke-width="2"/><line x1="90" y1="96" x2="98" y2="104" stroke="${c}" stroke-width="2"/>`,
    orbit: `<circle cx="64" cy="64" r="20" fill="none" stroke="${c}" stroke-width="2" opacity="0.5"/><ellipse cx="64" cy="64" rx="42" ry="16" fill="none" stroke="${c}" stroke-width="1.5" opacity="0.3" transform="rotate(-30 64 64)"/><circle cx="${64 + 42 * Math.cos(-0.5)}" cy="${64 + 16 * Math.sin(-0.5)}" r="5" fill="${c}" opacity="0.9"/>`,
    dash: `<path d="M28 64 Q40 48 56 56 Q68 62 72 48 L98 64 L72 80 Q68 66 56 72 Q40 80 28 64Z" fill="${c}" opacity="0.85"/>`,
    nova: `<circle cx="64" cy="64" r="12" fill="${c}" opacity="0.8"/>${[0, 1, 2, 3, 4, 5].map(i => `<line x1="${64 + 16 * Math.cos(i * Math.PI / 3)}" y1="${64 + 16 * Math.sin(i * Math.PI / 3)}" x2="${64 + 40 * Math.cos(i * Math.PI / 3)}" y2="${64 + 40 * Math.sin(i * Math.PI / 3)}" stroke="${c}" stroke-width="3" opacity="0.5" stroke-linecap="round"/>`).join("")}`,
    curse: `<path d="M72 24 Q52 32 48 52 Q44 72 56 88 Q64 98 72 88 Q60 72 64 52 Q68 32 72 24Z" fill="${c}" opacity="0.85"/>`,
    guardian: `<ellipse cx="64" cy="42" rx="16" ry="14" fill="${c}" opacity="0.8"/><path d="M48 56 L44 100 L84 100 L80 56Z" fill="${c}" opacity="0.7"/><rect x="54" y="26" width="20" height="8" rx="4" fill="${darken(c, 0.2)}"/>`
  };
  let body = `<rect width="128" height="128" rx="16" fill="#0a0810"/>`;
  body += `<circle cx="64" cy="64" r="52" fill="${c}" opacity="0.08"/>`;
  body += symbols[id] || `<text x="64" y="72" text-anchor="middle" font-size="40" fill="${c}">${def.icon}</text>`;
  return svgWrap(body);
}

function generateTermSvg(name) {
  const seed = hashString(name);
  const rng = seededRandom(seed);
  let body = `<rect width="128" height="128" rx="16" fill="#0a0810"/>`;
  for (let i = 0; i < 6; i++) {
    const x = 10 + rng() * 108, y = 10 + rng() * 108;
    body += `<circle cx="${x}" cy="${y}" r="${1 + rng() * 2}" fill="#f4c95d" opacity="${0.08 + rng() * 0.12}"/>`;
  }
  body += `<rect x="42" y="30" width="44" height="58" rx="4" fill="none" stroke="#f4c95d" stroke-width="2" opacity="0.4"/>`;
  body += `<line x1="50" y1="44" x2="78" y2="44" stroke="#f4c95d" stroke-width="1.5" opacity="0.3"/>`;
  body += `<line x1="50" y1="52" x2="74" y2="52" stroke="#f4c95d" stroke-width="1.5" opacity="0.25"/>`;
  body += `<line x1="50" y1="60" x2="70" y2="60" stroke="#f4c95d" stroke-width="1.5" opacity="0.2"/>`;
  body += `<path d="M42 30 L64 18 L86 30" fill="none" stroke="#f4c95d" stroke-width="2" opacity="0.4"/>`;
  return svgWrap(body);
}

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

function addSvgToEncyclopedia(enc) {
  for (const item of enc.monsters) { if (enemyDefs[item.id]) item.iconSvg = generateMonsterSvg(item.id, enemyDefs[item.id]); }
  for (const [i, item] of enc.bosses.entries()) { if (chapterThemes[i]) item.iconSvg = generateBossSvg(i, chapterThemes[i]); }
  for (const item of enc.upgrades) { const def = upgradeDefs.find(u => u.id === item.id); if (def) item.iconSvg = generateUpgradeSvg(item.id, def); }
  for (const item of enc.terms) { item.iconSvg = generateTermSvg(item.name); }
  for (const item of enc.roomModifiers) { item.iconSvg = generateModifierSvg(item); }
}
addSvgToEncyclopedia(encyclopedia);

function dayKey(time = Date.now()) {
  const date = new Date(time);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

let store = loadStore();
const rooms = new Map();
const sockets = new Set();
const onlineUsers = new Map();
let nextEntityId = 1;

function loadStore() {
  fs.mkdirSync(dataDir, { recursive: true });
  if (!fs.existsSync(storePath)) {
    const fresh = { users: {}, usernameIndex: {}, sessions: {}, leaderboard: [], verificationCodes: {} };
    fs.writeFileSync(storePath, JSON.stringify(fresh, null, 2));
    return fresh;
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
    return parsed;
  } catch {
    const backup = `${storePath}.broken-${Date.now()}`;
    fs.copyFileSync(storePath, backup);
    return { users: {}, usernameIndex: {}, sessions: {}, leaderboard: [], verificationCodes: {} };
  }
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

function saveStore() {
  fs.mkdirSync(dataDir, { recursive: true });
  const tmp = `${storePath}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(store, null, 2));
  fs.renameSync(tmp, storePath);
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

function getSessionUser(req) {
  const sid = parseCookies(req).mes_session;
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

function publicUser(user) {
  normalizeProfile(user);
  return {
    id: user.id,
    username: user.username,
    profile: user.profile
  };
}

function hashPassword(password, salt = crypto.randomBytes(16).toString("hex")) {
  const hash = crypto.scryptSync(password, salt, 64).toString("hex");
  return { salt, hash };
}

function verifyPassword(password, user) {
  const actual = crypto.scryptSync(password, user.salt, 64);
  const expected = Buffer.from(user.hash, "hex");
  return expected.length === actual.length && crypto.timingSafeEqual(expected, actual);
}

function validateUsername(username) {
  return typeof username === "string" && /^[\w\u4e00-\u9fa5]{3,18}$/u.test(username.trim());
}

function validatePassword(password) {
  return typeof password === "string" && password.length >= 6 && password.length <= 64;
}

async function handleApi(req, res, url) {
  try {
    if (req.method === "GET" && url.pathname === "/api/meta") {
      return sendJson(res, 200, { chapters, heroes, talents, upgradeDefs, evolutionDefs, roomModifiers, encyclopedia, difficulties, achievements: coopAchievements });
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
      return sendJson(res, 200, { online: onlineUsers.size, rooms: publicRooms });
    }

    if (req.method === "GET" && url.pathname === "/api/weekly") {
      const weekly = getWeeklyChallenge();
      const weeklyBoard = (store.leaderboard || [])
        .filter(e => e.weeklySeed === weekly.seed)
        .sort((a, b) => b.score - a.score)
        .slice(0, 10)
        .map(e => ({ username: e.username, score: e.score, chapter: e.chapter }));
      return sendJson(res, 200, { ...weekly, leaderboard: weeklyBoard });
    }

    if (req.method === "GET" && url.pathname === "/api/achievements") {
      const auth = getSessionUser(req);
      return sendJson(res, 200, { achievements: coopAchievements, unlocked: auth ? (auth.user.profile.achievements || []) : [] });
    }

    if (req.method === "GET" && url.pathname === "/api/me") {
      const auth = getSessionUser(req);
      return sendJson(res, 200, { user: auth ? publicUser(auth.user) : null });
    }

    if (req.method === "POST" && url.pathname === "/api/send-code") {
      const body = await readBody(req);
      const email = String(body.email || "").trim().toLowerCase();
      if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return sendJson(res, 400, { error: "请输入有效的邮箱地址" });
      const existing = store.verificationCodes?.[email];
      if (existing && existing.lastSent && Date.now() - existing.lastSent < 60000) return sendJson(res, 429, { error: "请等待 60 秒后再次发送" });
      const code = String(crypto.randomInt(100000, 1000000));
      store.verificationCodes[email] = { code, expires: Date.now() + 5 * 60 * 1000, lastSent: Date.now() };
      saveStore();
      let emailSent = false;
      try {
        await mailTransporter.sendMail({
          from: "835329879@qq.com",
          to: email,
          subject: "月蚀幸存者 - 验证码",
          text: `您的验证码是：${code}，请尽快完成验证，验证码5分钟内有效。`,
          html: `<div style="font-family:sans-serif;padding:20px;background:#0a0810;color:#e8e4f0;border-radius:12px"><h2 style="color:#f4c95d">月蚀幸存者</h2><p>您的验证码是：</p><h1 style="color:#f4c95d;letter-spacing:8px;font-size:36px">${code}</h1><p style="color:#888">5 分钟内有效。</p></div>`
        });
        emailSent = true;
      } catch (mailError) {
        console.error("Email send failed:", mailError.message);
      }
      return sendJson(res, 200, { ok: true, code: emailSent ? undefined : code });
    }

    if (req.method === "POST" && url.pathname === "/api/register") {
      const body = await readBody(req);
      const username = String(body.username || "").trim();
      const password = String(body.password || "");
      const email = String(body.email || "").trim().toLowerCase();
      const code = String(body.code || "").trim();
      if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return sendJson(res, 400, { error: "请输入有效的邮箱地址" });
      const stored = store.verificationCodes?.[email];
      if (!stored || stored.code !== code || stored.expires < Date.now()) return sendJson(res, 400, { error: "验证码无效或已过期" });
      delete store.verificationCodes[email];
      if (!validateUsername(username)) return sendJson(res, 400, { error: "用户名需为 3-18 位中文、字母、数字或下划线" });
      if (!validatePassword(password)) return sendJson(res, 400, { error: "密码需为 4-64 位" });
      const key = username.toLowerCase();
      if (store.usernameIndex[key]) return sendJson(res, 409, { error: "用户名已存在" });
      const id = crypto.randomUUID();
      const passwordHash = hashPassword(password);
      const user = { id, username, usernameLower: key, email, salt: passwordHash.salt, hash: passwordHash.hash, createdAt: Date.now(), profile: makeProfile(username) };
      store.users[id] = user;
      store.usernameIndex[key] = id;
      const sid = crypto.randomBytes(32).toString("hex");
      store.sessions[sid] = { userId: id, expires: Date.now() + 7 * 24 * 60 * 60 * 1000 };
      saveStore();
      return sendJson(res, 200, { user: publicUser(user) }, { "Set-Cookie": sessionCookie(sid) });
    }

    if (req.method === "POST" && url.pathname === "/api/login") {
      const body = await readBody(req);
      const username = String(body.username || "").trim().toLowerCase();
      const password = String(body.password || "");
      const userId = store.usernameIndex[username];
      const user = userId ? store.users[userId] : null;
      if (!user || !verifyPassword(password, user)) return sendJson(res, 401, { error: "用户名或密码不正确" });
      const sid = crypto.randomBytes(32).toString("hex");
      store.sessions[sid] = { userId: user.id, expires: Date.now() + 7 * 24 * 60 * 60 * 1000 };
      saveStore();
      return sendJson(res, 200, { user: publicUser(user) }, { "Set-Cookie": sessionCookie(sid) });
    }

    if (req.method === "POST" && url.pathname === "/api/logout") {
      const sid = parseCookies(req).mes_session;
      if (sid) delete store.sessions[sid];
      saveStore();
      return sendJson(res, 200, { ok: true }, { "Set-Cookie": clearSessionCookie() });
    }

    if (req.method === "GET" && url.pathname === "/api/profile") {
      const auth = getSessionUser(req);
      if (!auth) return sendJson(res, 401, { error: "请先登录" });
      return sendJson(res, 200, { profile: auth.user.profile, talents });
    }

    if (req.method === "POST" && url.pathname === "/api/profile") {
      const auth = getSessionUser(req);
      if (!auth) return sendJson(res, 401, { error: "请先登录" });
      const body = await readBody(req);
      if (body.nickname) {
        const nickname = String(body.nickname).trim().slice(0, 18);
        if (nickname) auth.user.profile.nickname = nickname;
      }
      if (body.action === "buyTalent") {
        const id = String(body.talent || "");
        const def = talents[id];
        if (!def) return sendJson(res, 400, { error: "未知天赋" });
        normalizeProfile(auth.user);
        if ((auth.user.profile.storyProgress.unlockedChapter || 1) < (def.requiresChapter || 1)) {
          return sendJson(res, 400, { error: `通关进度不足，需要解锁第 ${def.requiresChapter} 关` });
        }
        const missingTalent = (def.requiresTalent || []).find(req => (auth.user.profile.talents[req] || 0) <= 0);
        if (missingTalent) return sendJson(res, 400, { error: `需要先点亮前置天赋：${talents[missingTalent]?.name || missingTalent}` });
        const level = auth.user.profile.talents[id] || 0;
        if (level >= def.max) return sendJson(res, 400, { error: "天赋已满级" });
        const cost = talentCost(def, level);
        if (auth.user.profile.moonDust < cost) return sendJson(res, 400, { error: "月尘不足" });
        auth.user.profile.moonDust -= cost;
        auth.user.profile.talents[id] = level + 1;
      }
      saveStore();
      return sendJson(res, 200, { profile: auth.user.profile });
    }

    if (req.method === "GET" && url.pathname === "/api/friends") {
      const auth = getSessionUser(req);
      if (!auth) return sendJson(res, 401, { error: "请先登录" });
      normalizeProfile(auth.user);
      const rows = auth.user.profile.friends
        .map(id => store.users[id])
        .filter(Boolean)
        .map(user => ({ id: user.id, username: user.username, nickname: user.profile?.nickname || user.username, unlockedChapter: user.profile?.storyProgress?.unlockedChapter || 1, online: Object.values(store.sessions).some(s => s.userId === user.id && s.expires > Date.now()) }));
      const incoming = (auth.user.profile.friendRequests?.incoming || [])
        .map(id => store.users[id])
        .filter(Boolean)
        .map(user => ({ id: user.id, username: user.username, nickname: user.profile?.nickname || user.username }));
      const outgoing = (auth.user.profile.friendRequests?.outgoing || [])
        .map(id => store.users[id])
        .filter(Boolean)
        .map(user => ({ id: user.id, username: user.username, nickname: user.profile?.nickname || user.username }));
      return sendJson(res, 200, { rows, incoming, outgoing });
    }

    if (req.method === "POST" && url.pathname === "/api/friends") {
      const auth = getSessionUser(req);
      if (!auth) return sendJson(res, 401, { error: "请先登录" });
      const body = await readBody(req);
      const action = String(body.action || "request");
      normalizeProfile(auth.user);
      if (action === "accept") {
        const requesterId = String(body.userId || "");
        const requester = store.users[requesterId];
        if (!requester || !auth.user.profile.friendRequests.incoming.includes(requesterId)) return sendJson(res, 404, { error: "好友申请不存在" });
        normalizeProfile(requester);
        auth.user.profile.friendRequests.incoming = auth.user.profile.friendRequests.incoming.filter(id => id !== requesterId);
        requester.profile.friendRequests.outgoing = requester.profile.friendRequests.outgoing.filter(id => id !== auth.user.id);
        if (!auth.user.profile.friends.includes(requesterId)) auth.user.profile.friends.push(requesterId);
        if (!requester.profile.friends.includes(auth.user.id)) requester.profile.friends.push(auth.user.id);
        saveStore();
        return sendJson(res, 200, { ok: true });
      }
      if (action === "decline") {
        const requesterId = String(body.userId || "");
        const requester = store.users[requesterId];
        auth.user.profile.friendRequests.incoming = auth.user.profile.friendRequests.incoming.filter(id => id !== requesterId);
        if (requester) {
          normalizeProfile(requester);
          requester.profile.friendRequests.outgoing = requester.profile.friendRequests.outgoing.filter(id => id !== auth.user.id);
        }
        saveStore();
        return sendJson(res, 200, { ok: true });
      }
      const username = String(body.username || "").trim().toLowerCase();
      const friendId = store.usernameIndex[username];
      const friend = friendId ? store.users[friendId] : null;
      if (!friend) return sendJson(res, 404, { error: "找不到这个玩家" });
      if (friend.id === auth.user.id) return sendJson(res, 400, { error: "不能添加自己" });
      normalizeProfile(friend);
      if (auth.user.profile.friends.includes(friend.id)) return sendJson(res, 400, { error: "已经是好友" });
      if (!auth.user.profile.friendRequests.outgoing.includes(friend.id)) auth.user.profile.friendRequests.outgoing.push(friend.id);
      if (!friend.profile.friendRequests.incoming.includes(auth.user.id)) friend.profile.friendRequests.incoming.push(auth.user.id);
      saveStore();
      return sendJson(res, 200, { ok: true });
    }

    if (req.method === "GET" && url.pathname === "/api/leaderboard") {
      const mode = url.searchParams.get("mode") || "story";
      const metric = url.searchParams.get("metric") || "score";
      const scope = url.searchParams.get("scope") || "all";
      const today = dayKey();
      const rows = store.leaderboard
        .filter(row => row.mode === mode)
        .filter(row => scope !== "daily" || (row.day || dayKey(row.at || 0)) === today)
        .sort((a, b) => {
          const av = metric === "kills" ? a.kills : a.score;
          const bv = metric === "kills" ? b.kills : b.score;
          return bv - av || b.score - a.score || b.kills - a.kills;
        })
        .slice(0, 30);
      return sendJson(res, 200, { rows, metric, scope });
    }

    if (req.method === "GET" && url.pathname === "/api/daily-challenge") {
      return sendJson(res, 200, getDailyChallenge());
    }

    return sendJson(res, 404, { error: "Not found" });
  } catch (error) {
    return sendJson(res, error.message === "invalid_json" ? 400 : 500, { error: error.message === "invalid_json" ? "JSON 格式不正确" : "服务器错误" });
  }
}

function talentCost(def, level) {
  const tier = Math.floor(level / 5);
  return Math.floor(def.baseCost * Math.pow(1.62, level) * (1 + tier * 0.18));
}

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
  if (url.pathname.startsWith("/api/")) return handleApi(req, res, url);
  return serveStatic(req, res, url);
});

server.on("upgrade", (req, socket) => {
  const url = new URL(req.url, `http://${req.headers.host || "localhost"}`);
  if (url.pathname !== "/ws") {
    socket.destroy();
    return;
  }
  const key = req.headers["sec-websocket-key"];
  if (!key) {
    socket.destroy();
    return;
  }
  const accept = crypto.createHash("sha1").update(`${key}258EAFA5-E914-47DA-95CA-C5AB0DC85B11`).digest("base64");
  socket.write([
    "HTTP/1.1 101 Switching Protocols",
    "Upgrade: websocket",
    "Connection: Upgrade",
    `Sec-WebSocket-Accept: ${accept}`,
    "",
    ""
  ].join("\r\n"));

  const auth = getSessionUser(req);
  const client = makeClient(socket, auth ? auth.user : null);
  sockets.add(client);
  onlineUsers.set(client.id, { userId: client.user?.id || null, username: client.user?.username || "游客" });
  client.send("hello", { user: client.user ? publicUser(client.user) : null, chapters, heroes, talents, roomModifiers, difficulties });
});

function makeClient(socket, user) {
  const client = {
    id: crypto.randomUUID(),
    socket,
    user,
    roomCode: null,
    buffer: Buffer.alloc(0),
    send(type, payload = {}) {
      if (socket.destroyed) return;
      const body = Buffer.from(JSON.stringify({ type, ...payload }), "utf8");
      socket.write(encodeFrame(body));
    }
  };
  socket.on("data", chunk => {
    client.buffer = Buffer.concat([client.buffer, chunk]);
    let frame;
    while ((frame = decodeFrame(client)) !== null) {
      if (frame.opcode === 8) return socket.end();
      if (frame.opcode === 9) return socket.write(encodeFrame(frame.payload, 10));
      if (frame.opcode !== 1) continue;
      try {
        const msg = JSON.parse(frame.payload.toString("utf8"));
        handleWsMessage(client, msg);
      } catch {
        client.send("error", { message: "消息格式不正确" });
      }
    }
  });
  socket.on("close", () => { clearInterval(client.pingTimer); disconnectClient(client); });
  socket.on("error", () => { clearInterval(client.pingTimer); disconnectClient(client); });
  client.pingTimer = setInterval(() => {
    if (socket.destroyed) { clearInterval(client.pingTimer); disconnectClient(client); return; }
    socket.write(encodeFrame(Buffer.alloc(0), 9));
  }, 30000);
  return client;
}

function encodeFrame(payload, opcode = 1) {
  const len = payload.length;
  let header;
  if (len < 126) {
    header = Buffer.from([0x80 | opcode, len]);
  } else if (len < 65536) {
    header = Buffer.alloc(4);
    header[0] = 0x80 | opcode;
    header[1] = 126;
    header.writeUInt16BE(len, 2);
  } else {
    header = Buffer.alloc(10);
    header[0] = 0x80 | opcode;
    header[1] = 127;
    header.writeBigUInt64BE(BigInt(len), 2);
  }
  return Buffer.concat([header, payload]);
}

function decodeFrame(client) {
  const buf = client.buffer;
  if (buf.length < 2) return null;
  const first = buf[0];
  const second = buf[1];
  const opcode = first & 0x0f;
  const masked = (second & 0x80) !== 0;
  let len = second & 0x7f;
  let offset = 2;
  if (len === 126) {
    if (buf.length < 4) return null;
    len = buf.readUInt16BE(2);
    offset = 4;
  } else if (len === 127) {
    if (buf.length < 10) return null;
    len = Number(buf.readBigUInt64BE(2));
    offset = 10;
  }
  const maskOffset = offset;
  if (masked) offset += 4;
  if (buf.length < offset + len) return null;
  let payload = buf.subarray(offset, offset + len);
  if (masked) {
    const mask = buf.subarray(maskOffset, maskOffset + 4);
    const unmasked = Buffer.alloc(len);
    for (let i = 0; i < len; i++) unmasked[i] = payload[i] ^ mask[i % 4];
    payload = unmasked;
  }
  client.buffer = buf.subarray(offset + len);
  return { opcode, payload };
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
  saveStore();
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
  const x = clamp(Number(msg.x) || 0, -1, 1);
  const y = clamp(Number(msg.y) || 0, -1, 1);
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
  for (const target of room.members.values()) {
    if (target.connected) target.client.send("chat", { from: member.username, text: clean, at: Date.now() });
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
  normalizeProfile(client.user);
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
  updatePlayers(room, dt);
  updateSpawns(room, dt);
  updateEnemies(room, dt);
  updateProjectiles(room, dt);
  updateEnemyShots(room, dt);
  updatePickups(room, dt);
  updateHazards(room, dt);
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
      const rescuer = alive.find(other => other.key !== member.key && distance(other, member) < 58);
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
  const downed = [...room.members.values()].find(m => m.downed && m.key !== member.key && distance(m, member) < 400);
  if (downed) {
    const dx = downed.x - member.x;
    const dy = downed.y - member.y;
    const d = Math.hypot(dx, dy) || 1;
    if (d > 50) return { x: dx / d, y: dy / d };
  }

  // 血量低时寻找治疗
  if (member.hp < member.maxHp * 0.4) {
    const heart = room.pickups.find(p => p.type === "heart" && distance(p, member) < 500);
    if (heart) {
      const dx = heart.x - member.x;
      const dy = heart.y - member.y;
      const d = Math.hypot(dx, dy) || 1;
      return { x: dx / d, y: dy / d };
    }
  }

  // 回避危险区
  for (const hazard of room.hazards) {
    if (hazard.type === "danger" && distance(hazard, member) < hazard.r + 60) {
      const dx = member.x - hazard.x;
      const dy = member.y - hazard.y;
      const d = Math.hypot(dx, dy) || 1;
      return { x: dx / d, y: dy / d };
    }
  }

  // 闪避敌方弹幕
  for (const shot of room.enemyShots) {
    const sd = distance(shot, member);
    if (sd < 80) {
      const dx = member.x - shot.x;
      const dy = member.y - shot.y;
      const d = Math.hypot(dx, dy) || 1;
      return { x: dx / d, y: dy / d };
    }
  }

  // 优先拾取附近的宝箱
  const chest = room.pickups.find(p => p.type === "chest" && distance(p, member) < 200);
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
    const ally = [...room.members.values()].find(m => m.key !== member.key && !m.downed && !m.eliminated && distance(m, member) > 200);
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
  const type = forcedType || pick(room.chapter.enemies);
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
  room.pickups.push({ id: nextId(), type: Math.random() < 0.45 ? "heart" : "chest", x: c.x + rand(-260, 260), y: c.y + rand(-220, 220), r: 18, value: 28, color: Math.random() < 0.5 ? "#d3424f" : "#f4c95d" });
}

function triggerChapterEvent(room) {
  if (!hasAffix(room, "scarcity") || Math.random() < 0.55) spawnSupply(room);
  if (hasAffix(room, "elite")) spawnEnemy(room, "brute");
  if (hasAffix(room, "miasma")) {
    const c = teamCenter(room);
    room.hazards.push({ id: nextId(), type: "danger", x: c.x + rand(-280, 280), y: c.y + rand(-240, 240), r: 78, damage: 18 + room.chapter.id * 1.4, arm: 1.1, life: 4.4, color: "#a98cff" });
  }
  if (hasAffix(room, "voidRain") && room.time > 90) {
    for (const member of aliveMembers(room)) {
      room.hazards.push({ id: nextId(), type: "danger", x: member.x + rand(-90, 90), y: member.y + rand(-90, 90), r: 54, damage: 24 + room.chapter.id * 1.8, arm: 0.9, life: 2.8, color: "#7bb8ff" });
    }
  }

  // 精英波次（第5关起，每60秒概率触发）
  if (room.chapter.id >= 5 && room.time > 60 && Math.random() < 0.3) {
    const c = teamCenter(room);
    for (let i = 0; i < 2 + Math.floor(room.chapter.id / 10); i++) {
      const type = pick(["brute", "spitter"]);
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
        x: c.x + rand(-200, 200), y: c.y + rand(-180, 180),
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
      x: c.x + rand(-120, 120), y: c.y + rand(-100, 100),
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
        x: c.x + rand(-180, 180), y: c.y + rand(-150, 150),
        r: 13, value: 18, color: "#d3424f"
      });
    }
    room.effects.push(effect("hit", c.x, c.y, "#d3424f"));
  }

  // 时空裂隙事件（第15关起：高风险高回报区域）
  if (room.chapter.id >= 15 && Math.random() < 0.06) {
    const c = teamCenter(room);
    const riftX = c.x + rand(-200, 200);
    const riftY = c.y + rand(-180, 180);
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
    for (const member of alive) {
      const touch = enemy.radius + member.radius;
      const md = distance(enemy, member);
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
    const killer = activeMembers(room).find(member => distance(member, enemy) < 720);
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
        if (distance(other, enemy) < 200) {
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
    for (const enemy of room.enemies) {
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
            const next = room.enemies.find(e => e !== lastTarget && e.hp > 0 && distance(e, lastTarget) < 200);
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
    for (const member of alive) {
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
    boss.x = target.x + rand(-60, 60);
    boss.y = target.y + rand(-60, 60);
    room.effects.push(effect("boss", boss.x, boss.y, boss.color));
    room.hazards.push({ id: nextId(), type: "aura", owner: "boss", x: boss.x, y: boss.y, r: 120, damage: boss.damage * 2, life: 0.8, color: boss.color });
  }

  // 第15关起：召唤小怪
  if (chapterId >= 15 && Math.random() < 0.3) {
    for (let i = 0; i < 3; i++) {
      const type = pick(room.chapter.enemies);
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
      for (const enemy of room.enemies) {
        if (distance(hazard, enemy) < hazard.r + enemy.radius) enemy.hp -= hazard.damage * dt * 2.2;
      }
    } else if (hazard.arm > 0) {
      hazard.arm -= dt;
    } else {
      const targets = aliveMembers(room).filter(member => distance(hazard, member) < hazard.r + member.radius);
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
    const member = nearestAlive(room, pickup);
    if (!member) continue;
    const dist = distance(member, pickup);
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
    store.leaderboard.push({ mode: "story", username: user.profile.nickname || user.username, hero: heroes[member.hero].name, chapter: room.chapter.name, chapterId: room.chapter.id, score, kills: room.kills, time: result.time, victory, modifiers: room.modifiers.map(item => item.name), day: dayKey(finishedAt), at: finishedAt, weeklySeed: isWeekly ? weekly.seed : undefined });
  }
  store.leaderboard = store.leaderboard.sort((a, b) => b.score - a.score).slice(0, 200);
  saveStore();
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

function getChapter(id) {
  return chapters.find(chapter => chapter.id === id);
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

function nearestPlayer(room, enemy) {
  let best = null;
  let bestD = Infinity;
  for (const member of aliveMembers(room)) {
    const d = distance(enemy, member);
    if (d < bestD) {
      bestD = d;
      best = member;
    }
  }
  return best;
}

function nearestAlive(room, point) {
  let best = null;
  let bestD = Infinity;
  for (const member of aliveMembers(room)) {
    const d = distance(point, member);
    if (d < bestD) {
      bestD = d;
      best = member;
    }
  }
  return best;
}

function nearestEnemy(room, member, range = Infinity) {
  let best = null;
  let bestD = range;
  for (const enemy of room.enemies) {
    const d = distance(member, enemy);
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
  if (changed) saveStore();
}, 60000);

server.listen(port, () => {
  console.log(`Moon Eclipse Survivors running at http://localhost:${port}`);
});
