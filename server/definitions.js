// 游戏数据定义 — 章节、英雄、敌人、天赋、技能、进化、词条、图鉴等

/* ── 章节主题（10个区域 × 5个轮回 = 50 章） ── */
const chapterThemes = [
  { zone: "银雾荒原", goal: "找回月辉碎片", boss: "雾沼监军", palette: ["#17201c", "#293b35", "#7fe0c4"], enemies: ["husk", "bat"] },
  { zone: "裂翼墓园", goal: "净化裂翼墓碑", boss: "裂翼伯爵", palette: ["#1c1824", "#342843", "#a98cff"], enemies: ["husk", "bat", "brute"] },
  { zone: "赤烬修道院", goal: "夺回燃烧圣杯", boss: "赤烬院长", palette: ["#241713", "#4d2721", "#ff9658"], enemies: ["husk", "brute", "spitter"] },
  { zone: "虚空矿井", goal: "关闭地下裂隙", boss: "虚空掘墓人", palette: ["#141423", "#25294a", "#7bb8ff"], enemies: ["bat", "spitter", "shard"] },
  { zone: "月蚀王座", goal: "击碎王冠封印", boss: "月蚀王冠", palette: ["#201714", "#3c2b1a", "#f4c95d"], enemies: ["husk", "brute", "spitter", "shard"] },
  { zone: "青灯竹径", goal: "点亮迷路青灯", boss: "竹影鬼将", palette: ["#142018", "#284231", "#98df62"], enemies: ["bat", "shard", "suicide"] },
  { zone: "沉钟水渠", goal: "敲响三口沉钟", boss: "溺钟祭司", palette: ["#101c24", "#203847", "#7bb8ff"], enemies: ["husk", "spitter", "mage"] },
  { zone: "白骨驿站", goal: "护送旧王信标", boss: "骨驿骑士", palette: ["#1e1b18", "#3b3428", "#f6f0dc"], enemies: ["husk", "brute", "suicide"] },
  { zone: "猩红花庭", goal: "烧毁血蔷薇根", boss: "花庭女侯", palette: ["#25151b", "#4a2430", "#d3424f"], enemies: ["bat", "spitter", "shard", "mage"] },
  { zone: "星坠天井", goal: "收集坠星核心", boss: "坠星巨像", palette: ["#171923", "#2c3047", "#f4c95d"], enemies: ["brute", "shard", "summoner"] }
];

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

const chapters = Array.from({ length: 50 }, (_, index) => {
  const id = index + 1;
  const theme = chapterThemes[index % chapterThemes.length];
  const cycle = Math.floor(index / chapterThemes.length) + 1;
  const suffixes = ["初醒", "回声", "深层", "残月", "终夜"];
  const affixes = makeChapterAffixes(id);
  const objective = makeChapterObjective(id, theme.goal, cycle);
  const name = `${theme.zone}·${suffixes[cycle - 1] || `第${cycle}轮`}`;
  return {
    id, name,
    subtitle: `${theme.goal}（第 ${cycle} 幕） · ${affixes.map(item => item.name).join(" / ")}`,
    duration: 240 + Math.min(150, index * 4),
    killGoal: 70 + index * 12,
    reward: 60 + index * 14,
    boss: `${theme.boss}${cycle > 1 ? `·${cycle}` : ""}`,
    palette: theme.palette, enemies: theme.enemies, affixes, objective
  };
});

/* ── 英雄 ── */
const heroes = {
  astrid: { id: "astrid", name: "星铸猎人", icon: "A", hp: 105, speed: 220, damage: 25, cooldown: 0.58, color: "#f4c95d" },
  mara: { id: "mara", name: "赤烬修女", icon: "M", hp: 130, speed: 195, damage: 30, cooldown: 0.72, color: "#ff9658" },
  noct: { id: "noct", name: "夜鸦术士", icon: "N", hp: 92, speed: 238, damage: 21, cooldown: 0.46, color: "#a98cff" },
  orion: { id: "orion", name: "霜星守望", icon: "O", hp: 116, speed: 205, damage: 23, cooldown: 0.62, color: "#7fe0c4" },
  sera: { id: "sera", name: "圣灯修补匠", icon: "S", hp: 100, speed: 215, damage: 19, cooldown: 0.52, color: "#f6f0dc" }
};

/* ── 敌人 ── */
const enemyDefs = {
  husk: { name: "雾骸", hp: 42, speed: 76, damage: 9, radius: 16, xp: 4, color: "#d4ceb2", tile: 242 },
  bat: { name: "裂翼", hp: 28, speed: 128, damage: 7, radius: 13, xp: 3, color: "#7fe0c4", tile: 246 },
  brute: { name: "铁瘤", hp: 130, speed: 56, damage: 16, radius: 23, xp: 10, color: "#d3424f", tile: 269 },
  spitter: { name: "黯咒者", hp: 78, speed: 70, damage: 12, radius: 18, xp: 8, color: "#a98cff", tile: 275, ranged: true },
  shard: { name: "晶群", hp: 62, speed: 112, damage: 12, radius: 15, xp: 7, color: "#7bb8ff", tile: 286 },
  mage: { name: "黯术师", hp: 55, speed: 55, damage: 14, radius: 18, xp: 10, color: "#ff6b6b", tile: 292, ranged: true },
  suicide: { name: "自爆者", hp: 35, speed: 160, damage: 25, radius: 14, xp: 5, color: "#ff4444", tile: 258 },
  summoner: { name: "唤魔者", hp: 100, speed: 48, damage: 6, radius: 22, xp: 15, color: "#50c878", tile: 295 }
};

/* ── 天赋（6分支 × 10节点 = 60） ── */
const talents = {
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

/* ── 局内技能（20个） ── */
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
  { id: "crimsonTide", name: "赤潮漩涡", needs: ["thorns", "vitality"], desc: "反伤和生命满级后，每损失 10% 生命提升反伤效果" },
  { id: "shadowServant", name: "暗影侍从", needs: ["guardian", "curse"], desc: "召唤和诅咒满级后，光灵攻击附带易伤效果" },
  { id: "windTrail", name: "风影无踪", needs: ["dash", "speed"], desc: "冲刺和速度满级后，移动时留下持续伤害轨迹" },
  { id: "ironVow", name: "铁卫誓约", needs: ["guardian", "might"], desc: "召唤和伤害满级后，光灵召唤数量+1并造成范围伤害" },
  { id: "chainSky", name: "雷链天网", needs: ["chain", "range"], desc: "弹射和射程满级后，弹射距离无限且每次弹射增伤" },
  { id: "verdantWard", name: "翠绿壁垒", needs: ["guardian", "recovery"], desc: "召唤和回复满级后，光灵可治疗附近队友" }
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
  { id: "voidExposure", type: "debuff", name: "虚空侵蚀", desc: "精英出现率 +20%，击杀精英经验 +35%", effects: { eliteRate: 1.2, eliteXp: 1.35 } },
  { id: "crystalArmor", type: "buff", name: "水晶壁垒", desc: "全队减伤 +15%，但移速 -8%", effects: { armor: 1.15, speed: 0.92 } },
  { id: "shadowWeaver", type: "debuff", name: "暗影编织", desc: "敌人速度 +20% 且攻击附带灼烧，通关月尘 +30%", effects: { enemySpeed: 1.2, reward: 1.3 } }
];

const difficulties = [
  { id: "normal", name: "普通", desc: "标准挑战", hpMul: 1, scoreMul: 1, rewardMul: 1 },
  { id: "hard", name: "困难", desc: "怪物血量+50%", hpMul: 1.5, scoreMul: 1.4, rewardMul: 1.3 },
  { id: "nightmare", name: "噩梦", desc: "怪物血量+120%", hpMul: 2.2, scoreMul: 2, rewardMul: 1.8 },
  { id: "hell", name: "地狱", desc: "怪物血量+200%，速度+20%", hpMul: 3, scoreMul: 3, rewardMul: 2.5 }
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

/* ── 图鉴 ── */
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
    { name: "暗影侍从", desc: "进化联动：召唤和诅咒满级后，光灵攻击附带易伤效果。" },
    { name: "风影无踪", desc: "进化联动：冲刺和速度满级后，移动时留下持续伤害轨迹。" },
    { name: "铁卫誓约", desc: "进化联动：召唤和伤害满级后，光灵召唤数量+1并造成范围伤害。" },
    { name: "雷链天网", desc: "进化联动：弹射和射程满级后，弹射距离无限且每次弹射增伤。" },
    { name: "翠绿壁垒", desc: "进化联动：召唤和回复满级后，光灵可治疗附近队友。" },
    { name: "生命回响", desc: "房间词条：救援倒地队友更快，倒地惩罚更低，适合新手。" },
    { name: "虚空侵蚀", desc: "房间词条：精英敌人更多但击杀精英给更多经验，适合精英猎手。" },
    { name: "月亮碎片", desc: "中章节随机事件：在附近生成多个治疗道具，危机时刻的补给。" },
    { name: "时空裂隙", desc: "高章节随机事件：出现高伤害区域，但周围散布大量经验星，高风险高回报。" },
    { name: "狂暴之潮", desc: "敌人攻击间隔缩短，需要更频繁走位躲避。" },
    { name: "瞬移猎手", desc: "精英敌人会周期性短距传送，难以风筝。" },
    { name: "水晶壁垒", desc: "房间词条：全队获得减伤但移速降低，适合稳扎稳打。" },
    { name: "暗影编织", desc: "房间词条：敌人更快且附带灼烧，但通关回报更高。" },
    { name: "黯术师", desc: "高阶远程敌人，发射暗影弹幕。高章节地图才会出现，需要灵活走位躲避。" },
    { name: "自爆者", desc: "失智的疯狂敌人，高速冲向玩家并爆炸造成范围伤害。听到滋滋声就要拉开距离。" },
    { name: "唤魔者", desc: "能召唤小怪的指挥官型敌人，会持续生成雾骸助战。必须优先击杀以免被淹没。" }
  ],
  monsters: Object.entries(enemyDefs).map(([id, def]) => ({
    id, name: def.name,
    desc: id === "mage" ? "远程施法敌人，会在中距离发射追踪弹幕，优先躲避攻击。" :
      id === "suicide" ? "高速自爆敌人，接触后造成大范围爆炸伤害，务必优先击杀。" :
      id === "summoner" ? "召唤型敌人，会不断召唤小怪，不优先处理会导致敌群失控。" :
      def.ranged ? "远程施法敌人，会在中距离发射弹幕。" :
      def.speed > 100 ? "高速追击敌人，适合用范围技能清理。" :
      def.hp > 100 ? "厚血近战敌人，常作为精英波次核心。" :
      "基础敌人，会持续向玩家靠近。",
    hp: def.hp, damage: def.damage, speed: def.speed
  })),
  bosses: chapterThemes.map((theme, index) => ({
    id: `boss-${index + 1}`, name: theme.boss,
    desc: index >= 2 ? `来自${theme.zone}的章节首领，会使用追踪弹、分摊圈和弹幕风暴。高章节首领还会传送突袭和召唤小怪。` : `来自${theme.zone}的章节首领，会使用追踪弹、分摊圈和地图危险区。`
  })),
  upgrades: upgradeDefs.map(item => ({ id: item.id, name: item.name, desc: item.desc })),
  roomModifiers
};

/* ── 工具函数 ── */
function seededRandom(seed) {
  let s = seed;
  return () => { s = (s * 1103515245 + 12345) & 0x7fffffff; return s / 0x7fffffff; };
}

function dailySeed() {
  const d = new Date();
  return d.getFullYear() * 10000 + (d.getMonth() + 1) * 100 + d.getDate();
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

/* ── SVG 图标生成 ── */
function hashString(str) { let h = 5381; for (let i = 0; i < str.length; i++) h = ((h << 5) + h + str.charCodeAt(i)) >>> 0; return h; }
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
  const oy = () => Math.round(rng() * 6 - 3); // eslint-disable-line no-unused-vars
  let body = `<rect width="128" height="128" rx="16" fill="#0a0810"/>`;
  body += `<rect width="128" height="128" rx="16" fill="${c}" opacity="0.06"/>`;
  if (id === "husk") {
    body += `<path d="M${40 + ox()} ${30 + oy()} L${88 + ox()} ${30 + oy()} Q96 40 92 90 L36 90 Q32 40 ${40 + ox()} ${30 + oy()}Z" fill="${c}" stroke="${dark}" stroke-width="2"/>`;
    body += `<ellipse cx="50" cy="55" rx="7" ry="9" fill="#0a0810"/><ellipse cx="78" cy="55" rx="7" ry="9" fill="#0a0810"/>`;
    body += `<ellipse cx="${51 + ox()}" cy="${56 + oy()}" rx="3" ry="4" fill="${light}"/>`;
    body += `<ellipse cx="${79 + ox()}" cy="${56 + oy()}" rx="3" ry="4" fill="${light}"/>`;
    body += `<path d="M48 75 L54 72 L60 76 L66 71 L72 75 L78 72" stroke="${dark}" stroke-width="2" fill="none" stroke-linecap="round"/>`;
    for (let i = 0; i < 4; i++) body += `<line x1="20" y1="${35 + i * 16}" x2="108" y2="${35 + i * 16}" stroke="${c}" stroke-width="0.5" opacity="0.12"/>`;
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
    for (let i = 0; i < 5; i++) { body += `<line x1="10" y1="${10 + i * 24}" x2="118" y2="${10 + i * 24}" stroke="${dark}" stroke-width="0.5" opacity="0.08"/>`; body += `<line x1="${10 + i * 24}" y1="10" x2="${10 + i * 24}" y2="118" stroke="${dark}" stroke-width="0.5" opacity="0.08"/>`; }
  } else if (id === "mage") {
    body += `<circle cx="64" cy="60" r="24" fill="${c}" stroke="${dark}" stroke-width="2"/>`;
    body += `<path d="M38 70 L28 54 L42 48L40 60Z" fill="${c}" opacity="0.9"/>`;
    body += `<circle cx="${56 + ox()}" cy="${54 + oy()}" r="3.5" fill="#0a0810"/><circle cx="${72 + ox()}" cy="${54 + oy()}" r="3.5" fill="#0a0810"/>`;
    body += `<circle cx="64" cy="44" r="5" fill="${light}" opacity="0.8"/>`;
    for (let i = 0; i < 3; i++) body += `<circle cx="${64 + Math.cos(i * 2.1) * 34}" cy="${60 + Math.sin(i * 2.1) * 28}" r="${5 + i * 2}" fill="${c}" opacity="0.15"/>`;
    body += `<path d="M46 74 L50 68 L54 74 L58 68 L62 74 L66 68 L70 74 L74 68 L78 74" stroke="${light}" stroke-width="1.5" fill="none" stroke-linecap="round" opacity="0.6"/>`;
    for (let i = 0; i < 8; i++) body += `<circle cx="${16 + (i % 4) * 32}" cy="${14 + Math.floor(i / 4) * 48}" r="1.5" fill="${c}" opacity="0.12"/>`;
  } else if (id === "suicide") {
    body += `<circle cx="64" cy="60" r="18" fill="${c}" stroke="${dark}" stroke-width="2.5"/>`;
    body += `<circle cx="64" cy="60" r="28" fill="none" stroke="${c}" stroke-width="1.5" stroke-dasharray="4 4" opacity="0.3"/>`;
    body += `<circle cx="${56 + ox()}" cy="${54 + oy()}" r="3" fill="#0a0810"/><circle cx="${72 + ox()}" cy="${54 + oy()}" r="3" fill="#0a0810"/>`;
    body += `<rect x="58" y="72" width="12" height="4" rx="2" fill="#0a0810"/>`;
    body += `<circle cx="64" cy="42" r="3" fill="${light}" opacity="0.7"/>`;
    body += `<line x1="38" y1="50" x2="28" y2="40" stroke="${c}" stroke-width="2" stroke-linecap="round" opacity="0.5"/>`;
    body += `<line x1="90" y1="50" x2="100" y2="40" stroke="${c}" stroke-width="2" stroke-linecap="round" opacity="0.5"/>`;
    body += `<path d="M30 80 L50 70 L50 90Z M98 80 L78 70 L78 90Z" fill="${c}" opacity="0.4"/>`;
    for (let i = 0; i < 10; i++) body += `<line x1="${64 + (rng() - 0.5) * 56}" y1="${60 + (rng() - 0.5) * 56}" x2="64" y2="60" stroke="${c}" stroke-width="0.8" opacity="0.15"/>`;
  } else if (id === "summoner") {
    body += `<ellipse cx="64" cy="62" rx="26" ry="30" fill="${c}" stroke="${dark}" stroke-width="2"/>`;
    body += `<circle cx="64" cy="${38 + oy()}" r="6" fill="${light}" opacity="0.8"/>`;
    body += `<circle cx="${54 + ox()}" cy="${56 + oy()}" r="3.5" fill="#0a0810"/><circle cx="${74 + ox()}" cy="${56 + oy()}" r="3.5" fill="#0a0810"/>`;
    body += `<rect x="55" y="76" width="18" height="8" rx="3" fill="#0a0810"/>`;
    body += `<path d="M64 82 L56 96 L72 96Z" fill="${c}" opacity="0.6"/>`;
    for (let i = 0; i < 3; i++) body += `<circle cx="${50 + i * 14}" cy="${44}" r="4" fill="${light}" opacity="${0.2 + i * 0.15}"/>`;
    body += `<ellipse cx="64" cy="62" rx="38" ry="40" fill="none" stroke="${c}" stroke-width="0.8" stroke-dasharray="3 5" opacity="0.2"/>`;
    for (let i = 0; i < 6; i++) body += `<circle cx="${20 + rng() * 88}" cy="${16 + rng() * 96}" r="${1 + rng() * 2}" fill="${c}" opacity="0.1"/>`;
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
  body += `<text x="64" y="72" text-anchor="middle" fill="#f4c95d" font-size="${36 + rng() * 8}" font-weight="bold" font-family="sans-serif" opacity="0.15">${name.slice(0, 2)}</text>`;
  return svgWrap(body);
}

module.exports = {
  chapterThemes, chapters, heroes, enemyDefs, talents, talentLinks,
  upgradeDefs, evolutionDefs, roomModifiers, difficulties, coopAchievements,
  encyclopedia, getDailyChallenge, getWeeklyChallenge,
  generateMonsterSvg, generateBossSvg, generateUpgradeSvg, generateTermSvg,
  // helper functions
  hashString, seededRandom, hexToRgb, rgbToHex, darken, lighten, svgWrap
};
