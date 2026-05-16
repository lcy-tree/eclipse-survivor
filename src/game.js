(() => {
  "use strict";

  const canvas = document.getElementById("game");
  const ctx = canvas.getContext("2d");

  const ui = {
    topbar: document.getElementById("topbar"),
    accountName: document.getElementById("account-name"),
    dustPill: document.getElementById("dust-pill"),
    navAccountName: document.getElementById("nav-account-name"),
    navDustPill: document.getElementById("nav-dust-pill"),
    menu: document.getElementById("menu-screen"),
    auth: document.getElementById("auth-screen"),
    authUsername: document.getElementById("auth-username"),
    authPassword: document.getElementById("auth-password"),
    authPasswordConfirm: document.getElementById("auth-password-confirm"),
    authEmail: document.getElementById("auth-email"),
    authCode: document.getElementById("auth-code"),
    sendCodeButton: document.getElementById("send-code"),
    authClose: document.getElementById("auth-close"),
    authTitle: document.getElementById("auth-title"),
    authSubtitle: document.getElementById("auth-subtitle"),
    authSubmit: document.getElementById("auth-submit"),
    authToggleBtn: document.getElementById("auth-toggle-btn"),
    authToggleText: document.getElementById("auth-toggle-text"),
    chapterList: document.getElementById("chapter-list"),
    dailyChallenge: document.getElementById("daily-challenge"),
    coopChapter: document.getElementById("coop-chapter"),
    modifierList: document.getElementById("modifier-list"),
    refreshModifiers: document.getElementById("refresh-modifiers"),
    skillPreview: document.getElementById("skill-preview"),
    createRoom: document.getElementById("create-room"),
    joinRoom: document.getElementById("join-room"),
    roomCodeInput: document.getElementById("room-code-input"),
    researchSummary: document.getElementById("research-summary"),
    research: document.getElementById("research-screen"),
    researchBack: document.getElementById("research-back"),
    researchDust: document.getElementById("research-dust"),
    researchProgress: document.getElementById("research-progress"),
    researchBranches: document.getElementById("research-branches"),
    researchMapHost: document.getElementById("research-map-host"),
    talentDetail: document.getElementById("talent-detail-screen"),
    talentDetailBack: document.getElementById("talent-detail-back"),
    talentDetailTitle: document.getElementById("talent-detail-title"),
    talentDetailSubtitle: document.getElementById("talent-detail-subtitle"),
    talentDetailBody: document.getElementById("talent-detail-body"),
    codexSummary: document.getElementById("codex-summary"),
    codex: document.getElementById("codex-screen"),
    codexBack: document.getElementById("codex-back"),
    codexTabs: document.getElementById("codex-tabs"),
    codexIndex: document.getElementById("codex-index"),
    codexInfo: document.getElementById("codex-info"),
    friendNameInput: document.getElementById("friend-name-input"),
    addFriend: document.getElementById("add-friend"),
    friendList: document.getElementById("friend-list"),
    leaderboardList: document.getElementById("leaderboard-list"),
    room: document.getElementById("room-screen"),
    roomTitle: document.getElementById("room-title"),
    roomSubtitle: document.getElementById("room-subtitle"),
    copyRoomCode: document.getElementById("copy-room-code"),
    roomModifiers: document.getElementById("room-modifiers"),
    inviteList: document.getElementById("invite-list"),
    memberList: document.getElementById("member-list"),
    heroSelect: document.getElementById("hero-select"),
    readyButton: document.getElementById("ready-button"),
    startRoom: document.getElementById("start-room"),
    leaveRoom: document.getElementById("leave-room"),
    hud: document.getElementById("hud"),
    timer: document.getElementById("timer"),
    chapterName: document.getElementById("chapter-name"),
    teamLevel: document.getElementById("team-level"),
    kills: document.getElementById("kills"),
    hpFill: document.getElementById("hp-fill"),
    xpFill: document.getElementById("xp-fill"),
    teamRow: document.getElementById("team-row"),
    upgrade: document.getElementById("upgrade-screen"),
    upgradeOptions: document.getElementById("upgrade-options"),
    end: document.getElementById("end-screen"),
    endTitle: document.getElementById("end-title"),
    endStats: document.getElementById("end-stats"),
    backMenu: document.getElementById("back-menu"),
    muteButton: document.getElementById("mute-button"),
    pauseButton: document.getElementById("pause-button"),
    toastStack: document.getElementById("toast-stack"),
    touchStick: document.getElementById("touch-stick"),
    onlineCount: document.getElementById("online-count"),
    weeklyChallenge: document.getElementById("weekly-challenge"),
    coopDifficulty: document.getElementById("coop-difficulty"),
    roomList: document.getElementById("room-list"),
    chatMessages: document.getElementById("chat-messages"),
    chatInput: document.getElementById("chat-input"),
    chatSend: document.getElementById("chat-send")
  };

  const TAU = Math.PI * 2;
  const state = {
    width: 0,
    height: 0,
    dpr: 1,
    meta: null,
    me: null,
    leaderboard: [],
    leaderboardScope: "daily",
    leaderboardMetric: "score",
    friends: [],
    friendIncoming: [],
    friendOutgoing: [],
    codexSelection: { group: "战斗词条", index: -1 },
    talentSelection: null,
    researchBranch: "全部",
    researchExpanded: null,
    ws: null,
    wsOpen: false,
    room: null,
    you: null,
    autoStart: false,
    upgradeSig: "",
    teamSig: "",
    camera: { x: 0, y: 0 },
    smooth: new Map(),
    keys: new Set(),
    pointer: { active: false, id: null, startX: 0, startY: 0, dx: 0, dy: 0 },
    input: { x: 0, y: 0 },
    lastInputSent: 0,
    last: performance.now(),
    muted: false,
    sounds: {},
    images: {},
    messages: [],
    authLoading: false
  };
  state.modifierRoll = [];

  const tileMap = {
    astrid: 1,
    mara: 2,
    noct: 3,
    orion: 4,
    sera: 5,
    heart: 219,
    chest: 212,
    projectile: 441
  };

  // ── 粒子系统 ──
  const particles = [];

  function spawnParticles(x, y, color, count, opts = {}) {
    const speed = opts.speed || 120;
    const life = opts.life || 0.5;
    const size = opts.size || 3;
    for (let i = 0; i < count; i++) {
      const a = Math.random() * Math.PI * 2;
      const s = speed * (0.3 + Math.random() * 0.7);
      particles.push({
        x, y,
        vx: Math.cos(a) * s * (opts.dirX != null ? (opts.dirX + (Math.random()-0.5)*0.8) : 1),
        vy: Math.sin(a) * s * (opts.dirY != null ? (opts.dirY + (Math.random()-0.5)*0.8) : 1),
        life: life * (0.5 + Math.random() * 0.5),
        maxLife: life,
        color,
        size: size * (0.5 + Math.random() * 0.5),
        gravity: opts.gravity || 0,
        fade: opts.fade !== false
      });
    }
  }

  function updateParticles(dt) {
    // 粒子池上限，防止卡顿
    if (particles.length > 300) particles.splice(0, particles.length - 300);
    for (let i = particles.length - 1; i >= 0; i--) {
      const p = particles[i];
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vy += p.gravity * dt;
      p.life -= dt;
      if (p.life <= 0) particles.splice(i, 1);
    }
  }

  function drawParticles() {
    for (const p of particles) {
      const pos = world(p.x, p.y);
      const alpha = p.fade ? Math.max(0, p.life / p.maxLife) : 1;
      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.fillStyle = p.color;
      ctx.shadowColor = p.color;
      ctx.shadowBlur = 6;
      ctx.fillRect(pos.x - p.size/2, pos.y - p.size/2, p.size, p.size);
      ctx.restore();
    }
  }

  // ── 屏幕震动 ──
  const shake = { x: 0, y: 0, intensity: 0, decay: 8 };
  let hitStopFrames = 0;

  // ── 屏幕闪白 ──
  const flash = { alpha: 0, color: "#fff" };
  function triggerFlash(color = "#fff", a = 0.3) {
    flash.color = color;
    flash.alpha = a;
  }

  // ── 连杀计数 ──
  const killStreak = { count: 0, timer: 0, display: 0 };
  function addKillStreak() {
    killStreak.count++;
    killStreak.timer = 3;
    killStreak.display = 2;
    if (killStreak.count === 5) { triggerFlash("#ff9658", 0.15); triggerShake(4); }
    else if (killStreak.count === 10) { triggerFlash("#d3424f", 0.25); triggerShake(7); }
    else if (killStreak.count === 20) { triggerFlash("#d3424f", 0.35); triggerShake(10); }
    const el = document.getElementById("screen-flash");
    if (el && (killStreak.count === 5 || killStreak.count === 10 || killStreak.count === 20)) {
      el.style.background = killStreak.count >= 10 ? "radial-gradient(circle, rgba(211,66,79,0.3), transparent)" : "radial-gradient(circle, rgba(255,150,88,0.2), transparent)";
      el.classList.remove("active");
      void el.offsetWidth;
      el.classList.add("active");
    }
  }

  // ── 伤害数字 ──
  const damageNumbers = [];
  function spawnDamageNumber(x, y, value, color = "#f4c95d", big = false) {
    if (damageNumbers.length > 50) return; // 上限
    damageNumbers.push({
      x, y, value: Math.round(value),
      vy: -60 - Math.random() * 30,
      life: 0.8, maxLife: 0.8,
      color, big,
      offsetX: (Math.random() - 0.5) * 20
    });
  }

  function triggerShake(intensity) {
    shake.intensity = Math.max(shake.intensity, intensity);
  }

  function updateShake(dt) {
    if (shake.intensity > 0.5) {
      shake.x = (Math.random() - 0.5) * shake.intensity;
      shake.y = (Math.random() - 0.5) * shake.intensity;
      shake.intensity *= Math.pow(0.001, dt);
    } else {
      shake.x = 0;
      shake.y = 0;
      shake.intensity = 0;
    }
  }

  function updateFlash(dt) {
    if (flash.alpha > 0) {
      flash.alpha *= Math.pow(0.01, dt);
      if (flash.alpha < 0.01) flash.alpha = 0;
    }
  }

  function updateKillStreak(dt) {
    if (killStreak.timer > 0) {
      killStreak.timer -= dt;
      if (killStreak.timer <= 0) {
        killStreak.count = 0;
      }
    }
    if (killStreak.display > 0) {
      killStreak.display -= dt;
    }
  }

  function updateDamageNumbers(dt) {
    for (let i = damageNumbers.length - 1; i >= 0; i--) {
      const d = damageNumbers[i];
      d.y += d.vy * dt;
      d.vy *= 0.95;
      d.life -= dt;
      if (d.life <= 0) damageNumbers.splice(i, 1);
    }
  }

  async function init() {
    resize();
    bindEvents();
    loadAssets();
    await Promise.all([loadMeta(), loadMe(), loadLeaderboard()]);
    await loadFriends().catch(() => {});
    renderAll();
    routeFromHash();
    requestAnimationFrame(loop);
  }

  async function api(path, options = {}) {
    const res = await fetch(path, {
      credentials: "same-origin",
      headers: { "Content-Type": "application/json", ...(options.headers || {}) },
      ...options,
      body: options.body && typeof options.body !== "string" ? JSON.stringify(options.body) : options.body
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || "请求失败");
    return data;
  }

  async function loadMeta() {
    state.meta = await api("/api/meta");
  }

  async function loadMe() {
    const data = await api("/api/me");
    state.me = data.user;
  }

  async function loadLeaderboard() {
    const data = await api(`/api/leaderboard?mode=story&scope=${state.leaderboardScope}&metric=${state.leaderboardMetric}`);
    state.leaderboard = data.rows || [];
  }

  async function loadFriends() {
    if (!state.me) {
      state.friends = [];
      return;
    }
    const data = await api("/api/friends");
    state.friends = data.rows || [];
    state.friendIncoming = data.incoming || [];
    state.friendOutgoing = data.outgoing || [];
  }

  function loadAssets() {
    const sheet = new Image();
    sheet.src = "/assets/vendor/kenney-roguelike-rpg-pack/Spritesheet/roguelikeSheet_transparent.png";
    state.images.sheet = sheet;
    state.images.ninja = loadImage("/assets/vendor/ninja-adventure/NinjaAdventure-main/content/character/ninja_blue/sprite.png");
    state.images.samuraiBlue = loadImage("/assets/vendor/ninja-adventure/NinjaAdventure-main/content/character/samurai_blue/sprite.png");
    state.images.samuraiGreen = loadImage("/assets/vendor/ninja-adventure/NinjaAdventure-main/content/character/samurai_green/samurai_green.png");
    state.images.pig = loadImage("/assets/vendor/ninja-adventure/NinjaAdventure-main/content/character/pig/pig.png");
    state.images.floor = loadImage("/assets/vendor/ninja-adventure/NinjaAdventure-main/content/map/tileset_floor.png");
    state.images.heart = loadImage("/assets/vendor/ninja-adventure/NinjaAdventure-main/content/ui/heart.png");

    state.sounds.click = new Audio("/assets/vendor/kenney-interface-sounds/Audio/click_002.ogg");
    state.sounds.confirm = new Audio("/assets/vendor/kenney-interface-sounds/Audio/confirmation_001.ogg");
    state.sounds.error = new Audio("/assets/vendor/kenney-interface-sounds/Audio/error_003.ogg");
    state.sounds.music = new Audio("/assets/vendor/ninja-adventure/NinjaAdventure-main/audio/music/theme_plain.ogg");
    for (const sound of Object.values(state.sounds)) sound.volume = 0.22;
    state.sounds.music.volume = 0.12;
    state.sounds.music.loop = true;
  }

  function loadImage(src) {
    const image = new Image();
    image.src = src;
    return image;
  }

  function play(name) {
    if (state.muted) return;
    const sound = state.sounds[name];
    if (!sound) return;
    sound.currentTime = 0;
    sound.play().catch(() => {});
  }

  function playMusic() {
    if (state.muted || !state.sounds.music) return;
    state.sounds.music.play().catch(() => {});
  }

  function renderAll() {
    renderAccount();
    loadDailyChallenge();
    renderChapters();
    renderCoopChapterOptions();
    renderDifficultyOptions();
    renderModifiers();
    renderSkillPreview();
    renderTalents();
    renderCodex();
    renderFriends();
    renderLeaderboard();
    renderHeroOptions();
  }

  function renderAccount() {
    const profile = state.me?.profile;
    const name = state.me ? profile.nickname || state.me.username : "游客";
    const dust = `${profile?.moonDust || 0} 月尘`;
    ui.accountName.textContent = name;
    ui.dustPill.textContent = dust;
    if (ui.navAccountName) ui.navAccountName.textContent = name;
    if (ui.navDustPill) ui.navDustPill.textContent = dust;
    document.querySelectorAll(".login-open").forEach(btn => btn.classList.toggle("hidden", Boolean(state.me)));
    document.querySelectorAll(".logout-button").forEach(btn => btn.classList.toggle("hidden", !state.me));
  }

  async function loadDailyChallenge() {
    try {
      const data = await api("/api/daily-challenge");
      state.dailyChallenge = data;
      renderDailyChallenge(data);
    } catch { /* ignore */ }
  }

  function renderDailyChallenge(dc) {
    if (!dc || !ui.dailyChallenge) return;
    const modTags = dc.modifiers.map(m => `<span class="daily-mod">${m.name}</span>`).join("");
    ui.dailyChallenge.innerHTML = `
      <div class="daily-header">
        <div>
          <span class="daily-badge">每日挑战</span>
          <strong>第 ${dc.chapterId} 章 · ${dc.chapterName}</strong>
        </div>
        <button class="primary-button daily-play" type="button">开始挑战</button>
      </div>
      <div class="daily-mods">${modTags}</div>
      <p class="daily-desc">${dc.modifiers.map(m => m.desc).join(" · ")}</p>
    `;
    ui.dailyChallenge.querySelector(".daily-play").addEventListener("click", () => {
      if (!state.me) { showLogin("请先登录"); return; }
      const modIds = dc.modifiers.map(m => m.id);
      state.autoStart = true;
      send("createRoom", { chapterId: dc.chapterId, modifierOptions: modIds, modifiers: modIds });
      toast("正在创建每日挑战房间...");
    });
  }

  function renderChapters() {
    if (!state.meta) return;
    const unlocked = state.me?.profile.storyProgress.unlockedChapter || 1;
    ui.chapterList.innerHTML = "";
    for (const chapter of state.meta.chapters) {
      const locked = chapter.id > unlocked;
      const skillCount = (state.meta.upgradeDefs || []).filter(skill => skill.unlockChapter <= chapter.id).length;
      const card = document.createElement("div");
      card.className = `chapter-card${locked ? " locked" : ""}`;
      const cleared = (state.me?.profile.storyProgress.cleared || []).includes(chapter.id);
      card.innerHTML = `
        <div class="chapter-art" style="--accent:${chapter.palette?.[2] || "#f4c95d"}">
          <span style="position:relative;z-index:1">${chapter.id}</span>
        </div>
        <div class="chapter-title">${chapter.id}. ${chapter.name}</div>
        <p>${chapter.subtitle}</p>
        <div class="chapter-meta">
          <span>⚔ ${chapter.killGoal} 斩</span>
          <span>♛ ${chapter.boss}</span>
          <span>⏱ ${Math.round(chapter.duration / 60)} 分</span>
          <span>✦ ${skillCount} 技能</span>
        </div>
        <div class="chapter-progress"><div style="width:${cleared ? 100 : 0}%"></div></div>
        <button class="${locked ? "ghost-button" : "primary-button"}" type="button">${locked ? "未解锁" : cleared ? "再次挑战" : "开始闯关"}</button>
      `;
      const button = card.querySelector("button");
      button.disabled = locked;
      button.addEventListener("click", () => startStory(chapter.id));
      card.style.opacity = "0";
      card.style.animation = `fadeUp 0.4s ease-out ${chapter.id * 0.04}s forwards`;
      ui.chapterList.appendChild(card);
    }
  }

  function renderCoopChapterOptions() {
    if (!state.meta) return;
    const unlocked = state.me?.profile.storyProgress.unlockedChapter || 1;
    ui.coopChapter.innerHTML = "";
    for (const chapter of state.meta.chapters) {
      const option = document.createElement("option");
      option.value = chapter.id;
      option.disabled = chapter.id > unlocked;
      option.textContent = `${chapter.id}. ${chapter.name}${chapter.id > unlocked ? "（未解锁）" : ""}`;
      ui.coopChapter.appendChild(option);
    }
  }

  function renderModifiers() {
    if (!state.meta || !ui.modifierList) return;
    if (!state.modifierRoll.length) rollModifiers();
    ui.modifierList.innerHTML = "";
    for (const modifier of state.modifierRoll) {
      const label = document.createElement("label");
      label.className = `modifier-card ${modifier.type}`;
      label.innerHTML = `
        <input type="checkbox" value="${modifier.id}">
        <strong>${modifier.name}</strong>
        <span>${modifier.type === "buff" ? "增益" : "挑战"} · ${modifier.desc}</span>
      `;
      ui.modifierList.appendChild(label);
    }
  }

  function rollModifiers() {
    const all = [...(state.meta?.roomModifiers || [])];
    state.modifierRoll = all.sort(() => Math.random() - 0.5).slice(0, 4);
  }

  function renderSkillPreview() {
    if (!state.meta || !ui.skillPreview) return;
    const chapterId = Number(ui.coopChapter.value || 1);
    const skills = (state.meta.upgradeDefs || []).filter(skill => skill.unlockChapter <= chapterId);
    const evolutions = (state.meta.evolutionDefs || []).filter(evo => evo.needs.every(id => skills.some(skill => skill.id === id)));
    ui.skillPreview.innerHTML = `
      <div class="skill-strip">${skills.map(skill => `<span style="--skill:${skill.color}" title="${skill.desc}">${skill.icon || "✦"} ${skill.name}</span>`).join("")}</div>
      <div class="evolution-strip">${evolutions.map(evo => `<span>${evo.name}</span>`).join("") || "<span>后续章节解锁更多进化</span>"}</div>
    `;
  }

  function renderDifficultyOptions() {
    if (!state.meta || !ui.coopDifficulty) return;
    const diffs = state.meta.difficulties || [{ id: "normal", name: "普通" }, { id: "hard", name: "困难" }, { id: "nightmare", name: "噩梦" }];
    ui.coopDifficulty.innerHTML = "";
    for (const d of diffs) {
      const opt = document.createElement("option");
      opt.value = d.id;
      opt.textContent = `${d.name} - ${d.desc}`;
      ui.coopDifficulty.appendChild(opt);
    }
  }

  async function loadOnlineCount() {
    try {
      const data = await api("/api/online");
      if (ui.onlineCount) ui.onlineCount.textContent = `${data.online} 人在线 · ${data.rooms.length} 个公开房间`;
      renderRoomList(data.rooms);
    } catch { /* ignore */ }
  }

  function renderRoomList(rooms) {
    if (!ui.roomList) return;
    ui.roomList.innerHTML = "";
    for (const room of rooms) {
      const row = document.createElement("div");
      row.className = "room-row";
      const diffClass = room.difficulty === "nightmare" ? "nightmare" : room.difficulty === "hard" ? "hard" : "normal";
      const diffName = { normal: "普通", hard: "困难", nightmare: "噩梦" }[room.difficulty] || "普通";
      row.innerHTML = `
        <div class="room-row-info">
          <div class="room-row-code">${room.code}</div>
          <div class="room-row-meta">${room.chapter} · ${room.members}/5人 · <span class="diff-badge ${diffClass}">${diffName}</span></div>
        </div>
      `;
      row.addEventListener("click", () => {
        if (!state.me) return showLogin("加入房间需要登录");
        ui.roomCodeInput.value = room.code;
        joinCoopRoom();
      });
      ui.roomList.appendChild(row);
    }
  }

  async function loadWeeklyChallenge() {
    if (!ui.weeklyChallenge) return;
    try {
      const data = await api("/api/weekly");
      renderWeeklyCard(data);
    } catch { /* ignore */ }
  }

  function renderWeeklyCard(data) {
    if (!ui.weeklyChallenge) return;
    ui.weeklyChallenge.classList.add("show");
    const modBadges = data.modifiers.map(m => {
      const cls = m.type === "buff" ? "buff" : "debuff";
      return `<span class="${cls}" style="font-size:11px;padding:2px 8px;border-radius:100px;border:1px solid rgba(255,255,255,0.08)">${m.name}</span>`;
    }).join("");
    const boardHtml = data.leaderboard.length
      ? `<div class="weekly-board"><strong>本周排行</strong><ol>${data.leaderboard.map(e => `<li>${e.username} - ${e.score}分</li>`).join("")}</ol></div>`
      : "";
    ui.weeklyChallenge.innerHTML = `
      <h3>☽ 每周挑战 #${data.weekNum}</h3>
      <div class="weekly-info">
        <span class="chapter-name">${data.chapterName}</span>
        <div class="weekly-mods">${modBadges}</div>
      </div>
      <div class="weekly-actions">
        <button class="primary-button" type="button" id="weekly-join">参加挑战</button>
      </div>
      ${boardHtml}
    `;
    const btn = ui.weeklyChallenge.querySelector("#weekly-join");
    if (btn) btn.addEventListener("click", () => {
      if (!state.me) return showLogin("参加每周挑战需要登录");
      const modIds = data.modifiers.map(m => m.id);
      state.autoStart = false;
      connectWs().then(() => send("createRoom", { chapterId: data.chapterId, multiplayer: true, modifiers: modIds, difficulty: "hard" }));
    });
  }

  function renderCodex() {
    if (!state.meta || !ui.codexSummary) return;
    const groups = codexGroups();
    const totalEntries = groups.reduce((sum, [, items]) => sum + items.length, 0);
    ui.codexSummary.innerHTML = `
      <div class="codex-entry-card">
        <div>
          <h2>月蚀图鉴</h2>
          <p>共 <strong>${totalEntries}</strong> 条记录 · 敌人、首领、英雄、章节与战斗词条手册</p>
        </div>
        <button id="open-codex" class="primary-button" type="button">打开图鉴</button>
      </div>
      <div class="codex-group-pills">
        ${groups.map(([title, items]) => `<span class="group-pill">${title} ${items.length}</span>`).join("")}
      </div>
    `;
    ui.codexSummary.querySelector("#open-codex").addEventListener("click", openCodexScreen);
  }

  function codexGroups() {
    const encyclopedia = state.meta.encyclopedia || {};
    const heroes = state.meta.heroes || {};
    const heroList = Object.values(heroes).map(h => ({
      ...h,
      desc: h.id === "astrid" ? "均衡型猎人，适合新手，射程和伤害均衡。"
        : h.id === "mara" ? "高伤近战型，生命值最高但速度较慢，适合冲锋。"
        : h.id === "noct" ? "极速施法者，伤害偏低但攻击间隔最短。"
        : h.id === "orion" ? "防御型守望者，减伤能力出色，适合持久战。"
        : "辅助型修补匠，速度适中，冷却最短，擅长持续输出。"
    }));
    const chapters = state.meta.chapters || [];
    const chapterList = chapters.slice(0, 10).map(c => ({
      id: c.id, name: c.name, desc: c.subtitle,
      duration: c.duration, killGoal: c.killGoal, reward: c.reward, boss: c.boss
    }));
    const evoList = (state.meta.evolutionDefs || []).map(e => ({
      id: e.id, name: e.name, desc: e.desc,
      requirement: e.needs ? `需要「${e.needs[0]}」和「${e.needs[1]}」均满级` : ""
    }));
    return [
      ["战斗词条", encyclopedia.terms || []],
      ["怪物", encyclopedia.monsters || []],
      ["Boss", encyclopedia.bosses || []],
      ["局内升级", encyclopedia.upgrades || []],
      ["房间词条", encyclopedia.roomModifiers || []],
      ["英雄", heroList],
      ["章节", chapterList],
      ["进化联动", evoList]
    ];
  }

  function openCodexScreen() {
    history.pushState(null, "", "#codex");
    showOnly(ui.codex);
    ui.topbar.classList.add("hidden");
    renderCodexScreen();
  }

  function renderCodexScreen() {
    if (!state.meta) return;
    const groups = codexGroups();
    if (!groups.some(([title]) => title === state.codexSelection.group)) {
      state.codexSelection = { group: groups[0][0], index: -1 };
    }
    const activeGroup = groups.find(([title]) => title === state.codexSelection.group) || groups[0];
    const selIdx = state.codexSelection.index;
    const activeItem = selIdx >= 0 ? (activeGroup[1][selIdx] || null) : null;
    ui.codexTabs.innerHTML = "";
    for (const [title, items] of groups) {
      const button = document.createElement("button");
      button.className = title === activeGroup[0] ? "active" : "";
      button.type = "button";
      button.innerHTML = `<strong>${title}</strong><span>${items.length}</span>`;
      button.addEventListener("click", () => {
        state.codexSelection = { group: title, index: -1 };
        renderCodexScreen();
      });
      ui.codexTabs.appendChild(button);
    }
    ui.codexIndex.innerHTML = "";
    activeGroup[1].forEach((item, index) => {
      const card = document.createElement("button");
      card.type = "button";
      card.className = index === selIdx ? "codex-card active" : "codex-card";
      const icon = codexIcon(activeGroup[0], item);
      const svgClass = isSvgIcon(icon) ? " svg" : "";
      const typeBadge = activeGroup[0] === "房间词条" && item.type
        ? `<span class="card-type-badge ${item.type}">${item.type === "buff" ? "益" : "战"}</span>` : "";
      card.innerHTML = `<span class="codex-token${svgClass}">${icon}</span><span class="card-name">${item.name}</span>${typeBadge}`;
      card.addEventListener("click", () => {
        if (state.codexSelection.index === index) {
          state.codexSelection.index = -1;
        } else {
          state.codexSelection.index = index;
        }
        renderCodexScreen();
      });
      ui.codexIndex.appendChild(card);
    });
    if (activeItem) {
      ui.codexInfo.innerHTML = codexDetailHtml(activeGroup[0], activeItem);
      ui.codexInfo.classList.remove("hidden");
      const closeBtn = ui.codexInfo.querySelector(".detail-close");
      if (closeBtn) closeBtn.addEventListener("click", () => {
        state.codexSelection.index = -1;
        renderCodexScreen();
      });
    } else {
      ui.codexInfo.innerHTML = "";
      ui.codexInfo.classList.add("hidden");
    }
  }

  function codexIcon(group, item) {
    if (item.iconSvg) return item.iconSvg;
    if (group === "怪物") return "☠";
    if (group === "Boss") return "♛";
    if (group === "局内升级") return item.icon || "✦";
    if (group === "房间词条") return item.type === "buff" ? "✚" : "!";
    if (group === "英雄") return item.icon || "★";
    if (group === "章节") return "◆";
    if (group === "进化联动") return "◈";
    return "i";
  }

  function isSvgIcon(icon) { return typeof icon === "string" && icon.startsWith("<svg"); }

  function codexDetailHtml(group, item) {
    const title = item.name || "未选择";
    const desc = item.desc || "暂无说明";
    const icon = codexIcon(group, item);
    const svgClass = isSvgIcon(icon) ? " svg-icon" : "";
    const typeLabel = group === "房间词条" && item.type
      ? `<span class="detail-type-badge ${item.type}">${item.type === "buff" ? "增益" : "挑战"}</span>`
      : "";
    let extra = "";

    if (group === "怪物" || group === "Boss") {
      const hp = Number(item.hp) || 0;
      const damage = Number(item.damage) || 0;
      const speed = Number(item.speed) || 0;
      if (hp || damage || speed) {
        const max = Math.max(1, hp, damage * 6, speed);
        extra = `<div class="codex-bars">
          ${codexBar("生命", hp, max)}
          ${codexBar("伤害", damage * 6, max)}
          ${codexBar("速度", speed, max)}
        </div>`;
      }
    }

    if (group === "英雄") {
      const hp = Number(item.hp) || 0;
      const damage = Number(item.damage) || 0;
      const speed = Number(item.speed) || 0;
      const cd = Number(item.cooldown) || 0;
      const max = Math.max(1, hp, damage * 4, speed);
      extra = `<div class="codex-bars">
        ${codexBar("生命", hp, max)}
        ${codexBar("伤害", damage * 4, max)}
        ${codexBar("速度", speed, max)}
        ${codexBar("攻速", Math.round((1 / Math.max(0.1, cd)) * 100), Math.round((1 / 0.4) * 100))}
      </div>`;
    }

    if (group === "章节") {
      extra = `<div class="codex-stats-row">
        <span class="stat-chip">⏱ ${Math.floor(item.duration / 60)}:${String(item.duration % 60).padStart(2, "0")}</span>
        <span class="stat-chip">⚔ ${item.killGoal} 斩</span>
        <span class="stat-chip">☾ ${item.reward} 月尘</span>
      </div>
      <div class="codex-note"><strong>首领</strong><p>${item.boss || "未知"}</p></div>`;
    }

    if (group === "进化联动" && item.requirement) {
      extra = `<div class="codex-note"><strong>前置条件</strong><p>${item.requirement}</p></div>`;
    }

    if (group === "局内升级") {
      extra = `<div class="codex-stats-row">
        <span class="stat-chip">最高 ${item.max || "?"} 级</span>
        <span class="stat-chip">${item.stat || ""}</span>
      </div>`;
    }

    return `
      <div class="codex-detail-compact">
        <div class="detail-header">
          <span class="codex-token detail-token${svgClass}">${icon}</span>
          <div>
            <small>${group}</small>
            <h3>${title}${typeLabel}</h3>
          </div>
          <button class="detail-close" type="button">✕</button>
        </div>
        <p class="detail-desc">${desc}</p>
        ${extra}
        <div class="codex-note"><strong>作战提示</strong><p>${codexTip(group, item)}</p></div>
      </div>
    `;
  }

  function codexBar(label, value, max) {
    return `<div class="codex-bar"><span>${label}</span><div><i style="width:${clamp((value / max) * 100, 4, 100)}%"></i></div><strong>${Math.round(value)}</strong></div>`;
  }

  function codexTip(group, item) {
    if (group === "怪物" && item.speed > 100) return "优先用范围伤害和减速处理，高速敌人容易穿过弹幕空窗。";
    if (group === "怪物" && item.hp > 100) return "厚血单位适合用穿透、暴击和 Boss 伤害类升级处理。";
    if (group === "怪物" && item.ranged) return "远程敌人威胁大，优先突进近身打断施法。";
    if (group === "Boss") return "Boss 技能通常会制造地面危险区，多人时注意分摊圈和救援位置。";
    if (group === "局内升级") return "局内升级可和其他满级技能触发进化，开局前可以在房间查看本局技能池。";
    if (group === "房间词条") return "房间词条会改变本局收益和压力，挑战词条适合熟练队伍刷榜。";
    if (group === "英雄") return `${item.name}适合${item.speed > 220 ? "灵活走位风筝" : item.hp > 120 ? "正面硬抗吸收" : item.damage > 25 ? "爆发输出速推" : "均衡稳健推进"}打法。`;
    if (group === "章节") return "高章节敌人更密集、词缀更难，注意根据词缀调整出装路线。";
    if (group === "进化联动") return "进化是局内升级的高级形态，优先规划两个核心技能的升级路线。";
    return "遇到新机制时先观察提示，再决定走输出、生存、资源或协作路线。";
  }

  function renderFriends() {
    if (!ui.friendList) return;
    if (!state.me) {
      ui.friendList.innerHTML = `<div class="leader-row"><span>#</span><div>登录后可添加好友</div><strong>--</strong></div>`;
      return;
    }
    ui.friendList.innerHTML = "";
    for (const request of state.friendIncoming) {
      const row = document.createElement("div");
      row.className = "friend-row request";
      row.innerHTML = `
        <div><strong>${request.nickname}</strong><span>@${request.username} 请求添加你为好友</span></div>
        <div class="button-row"><button class="primary-button" data-accept="${request.id}" type="button">同意</button><button class="ghost-button" data-decline="${request.id}" type="button">拒绝</button></div>
      `;
      row.querySelector("[data-accept]").addEventListener("click", () => respondFriend(request.id, "accept"));
      row.querySelector("[data-decline]").addEventListener("click", () => respondFriend(request.id, "decline"));
      ui.friendList.appendChild(row);
    }
    for (const friend of state.friends) {
      const row = document.createElement("div");
      row.className = "friend-row";
      row.innerHTML = `
        <div><strong><span class="status-dot ${friend.online ? "online" : "offline"}"></span>${friend.nickname}</strong><span>@${friend.username} · 解锁第 ${friend.unlockedChapter} 关</span></div>
        <button class="ghost-button" type="button">邀请</button>
      `;
      row.querySelector("button").addEventListener("click", () => {
        if (!state.room) return toast("先创建房间再邀请好友");
        send("inviteFriend", { userId: friend.id });
      });
      ui.friendList.appendChild(row);
    }
    for (const request of state.friendOutgoing) {
      const row = document.createElement("div");
      row.className = "friend-row pending";
      row.innerHTML = `<div><strong>${request.nickname}</strong><span>@${request.username} 等待对方同意</span></div><strong>待确认</strong>`;
      ui.friendList.appendChild(row);
    }
    if (!ui.friendList.children.length) {
      ui.friendList.innerHTML = `<div class="leader-row"><span>#</span><div>暂无好友或申请</div><strong>0</strong></div>`;
    }
  }

  function renderTalents() {
    if (!state.meta) return;
    const profile = state.me?.profile;
    const nodes = Object.entries(state.meta.talents);
    const litCount = nodes.filter(([id]) => (profile?.talents?.[id] || 0) > 0).length;
    const groups = ["攻击", "生存", "机动", "资源", "协作", "深层"];
    const groupCounts = groups.map(g => {
      const total = nodes.filter(([, t]) => t.group === g).length;
      const lit = nodes.filter(([id, t]) => t.group === g && (profile?.talents?.[id] || 0) > 0).length;
      return { name: g, lit, total };
    });
    ui.researchSummary.innerHTML = `
      <div class="research-entry-card">
        <div>
          <h2>月蚀星盘</h2>
          <p>已研究 <strong>${litCount}</strong> / ${nodes.length} 个节点 · 当前 ${profile?.moonDust || 0} 月尘</p>
        </div>
        <button id="open-research" class="primary-button" type="button">进入研究树</button>
      </div>
      <div class="research-branch-pills">
        ${groupCounts.map(g => `<span class="branch-pill${g.lit === g.total && g.total > 0 ? " done" : ""}">${g.name} ${g.lit}/${g.total}</span>`).join("")}
      </div>
    `;
    ui.researchSummary.querySelector("#open-research").addEventListener("click", openResearchScreen);
  }

  function openResearchScreen() {
    history.pushState(null, "", "#research");
    showOnly(ui.research);
    ui.topbar.classList.add("hidden");
    renderResearchMap();
  }

  function renderResearchMap() {
    if (!state.meta) return;
    const profile = state.me?.profile;
    const items = Object.entries(state.meta.talents).map(([id, t]) => ({ id, talent: t, tier: t.tier || "common" }));
    const litCount = items.filter(item => (profile?.talents?.[item.id] || 0) > 0).length;
    ui.researchDust.textContent = `${profile?.moonDust || 0} 月尘`;
    ui.researchProgress.textContent = `${litCount}/${items.length} 已研究`;
    // 侧边栏分支筛选
    const groups = ["全部", "攻击", "生存", "机动", "资源", "协作", "深层"];
    const branchColors = { "全部": "#888", "攻击": "#e8384a", "生存": "#5ee8b8", "机动": "#4a9eff", "资源": "#f0c040", "协作": "#40d4d4", "深层": "#9070f0" };
    ui.researchBranches.innerHTML = "";
    for (const group of groups) {
      const count = group === "全部" ? items.length : items.filter(item => item.talent.group === group).length;
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = state.researchBranch === group ? "active" : "";
      btn.style.setProperty("--branch-color", branchColors[group] || "#888");
      btn.innerHTML = `<strong>${group}</strong><span>${count}</span>`;
      btn.addEventListener("click", () => { state.researchBranch = group; renderResearchMap(); });
      ui.researchBranches.appendChild(btn);
    }
    // 卡片网格
    const filtered = state.researchBranch === "全部" ? items : items.filter(item => item.talent.group === state.researchBranch);
    ui.researchMapHost.innerHTML = `<div class="research-card-grid"></div>`;
    const grid = ui.researchMapHost.querySelector(".research-card-grid");
    for (const item of filtered) {
      const level = profile?.talents?.[item.id] || 0;
      const full = level >= item.talent.max;
      const unlockedChapter = profile?.storyProgress?.unlockedChapter || 1;
      const chapterLocked = Boolean(item.talent.requiresChapter && unlockedChapter < item.talent.requiresChapter);
      const prereqLocked = (item.talent.requiresTalent || []).some(req => (profile?.talents?.[req] || 0) <= 0);
      const locked = chapterLocked || prereqLocked;
      const card = document.createElement("button");
      card.type = "button";
      card.className = `research-card tier-${item.tier}${level > 0 ? " lit" : ""}${full ? " full" : ""}${locked ? " locked" : ""}${state.researchExpanded === item.id ? " selected" : ""}`;
      card.innerHTML = `
        <span class="rc-icon">${talentIcon(item.talent.group, item.tier)}</span>
        <span class="rc-name">${item.talent.name}</span>
        <span class="rc-level">${full ? "MAX" : `${level}/${item.talent.max}`}</span>
      `;
      card.title = item.talent.desc;
      card.addEventListener("click", () => {
        if (locked) return;
        if (state.researchExpanded === item.id) {
          state.researchExpanded = null;
          renderResearchMap();
        } else {
          state.researchExpanded = item.id;
          renderResearchMap();
        }
      });
      grid.appendChild(card);
    }
    // 浮动弹窗
    if (state.researchExpanded) {
      const item = items.find(it => it.id === state.researchExpanded);
      if (item) {
        const level = profile?.talents?.[item.id] || 0;
        const full = level >= item.talent.max;
        const tier = Math.floor(level / 5);
        const cost = Math.floor(item.talent.baseCost * Math.pow(1.62, level) * (1 + tier * 0.18));
        const dust = profile?.moonDust || 0;
        const canAfford = dust >= cost;
        const effect = talentEffectText(item.id, level, Math.min(item.talent.max, level + 1));
        const unlockedChapter = profile?.storyProgress?.unlockedChapter || 1;
        const chapterLocked = Boolean(item.talent.requiresChapter && unlockedChapter < item.talent.requiresChapter);
        const prereqLocked = (item.talent.requiresTalent || []).some(req => (profile?.talents?.[req] || 0) <= 0);
        const locked = chapterLocked || prereqLocked;
        const lockText = chapterLocked ? `需要通关到第 ${item.talent.requiresChapter} 关` : prereqLocked ? `需要先点亮前置研究` : "";
        // 找到对应卡片位置
        const selectedCard = grid.querySelector(".selected");
        const popup = document.createElement("div");
        popup.className = `rc-popup tier-${item.tier}`;
        popup.innerHTML = `
          <div class="rc-popup-head">
            <span class="rc-popup-icon">${talentIcon(item.talent.group, item.tier)}</span>
            <div>
              <strong class="rc-popup-name">${item.talent.name}</strong>
              <span class="rc-popup-lv">${level}/${item.talent.max}</span>
            </div>
          </div>
          <p class="rc-popup-desc">${item.talent.desc}</p>
          <p class="rc-popup-effect">${effect}</p>
          ${lockText ? `<p class="rc-popup-lock">${lockText}</p>` : `
          <div class="rc-popup-bottom">
            <span class="rc-popup-cost${canAfford ? "" : " no-afford"}">${full ? "已满级" : `${cost} 月尘`}</span>
            ${!full ? `<button class="rc-popup-buy${canAfford && !locked ? "" : " disabled"}" type="button">${canAfford ? "升级" : "不足"}</button>` : ""}
          </div>`}
        `;
        grid.appendChild(popup);
        // 定位：等渲染完成后再算
        if (selectedCard) {
          const cardRect = selectedCard.getBoundingClientRect();
          const gridRect = grid.getBoundingClientRect();
          const top = cardRect.bottom - gridRect.top + 6;
          popup.style.top = top + "px";
          popup.style.left = Math.max(0, cardRect.left - gridRect.left) + "px";
          requestAnimationFrame(() => {
            // 水平不超出容器
            const pw = popup.offsetWidth;
            const maxLeft = gridRect.width - pw - 8;
            const curLeft = parseFloat(popup.style.left);
            if (curLeft > maxLeft) popup.style.left = Math.max(0, maxLeft) + "px";
            // 垂直不超出则放上方
            if (top + popup.offsetHeight > grid.scrollHeight) {
              popup.style.top = (cardRect.top - gridRect.top - popup.offsetHeight - 6) + "px";
            }
          });
        }
        // 升级按钮
        const buyBtn = popup.querySelector(".rc-popup-buy");
        if (buyBtn && !buyBtn.classList.contains("disabled")) {
          buyBtn.addEventListener("click", (e) => { e.stopPropagation(); buyTalent(item.id); });
        }
        // 点击弹窗外关闭
        const closePopup = (e) => {
          if (!popup.contains(e.target)) {
            state.researchExpanded = null;
            renderResearchMap();
            document.removeEventListener("click", closePopup, true);
          }
        };
        requestAnimationFrame(() => document.addEventListener("click", closePopup, true));
      }
    }
  }

  function openTalentAndExpand(id) {
    state.researchExpanded = id;
    openResearchScreen();
  }

  function showTalentMap() {
    openResearchScreen();
  }

  function routeFromHash() {
    if (location.hash === "#research") {
      openResearchScreen();
      return;
    }
    if (location.hash === "#codex") {
      openCodexScreen();
      return;
    }
    const match = location.hash.match(/^#talent\/(.+)$/);
    if (match && state.meta?.talents?.[match[1]]) {
      openTalentAndExpand(match[1]);
      return;
    }
    showOnly(ui.menu);
  }

  function talentIcon(group, tier) {
    const base = { 攻击: "✦", 生存: "◆", 机动: "➤", 资源: "◎", 协作: "✚", 深层: "☾" }[group] || "✧";
    if (tier === "legendary") return "★";
    if (tier === "rare") return "◈";
    return base;
  }

  function talentEffectText(id, level, nextLevel) {
    const delta = Math.max(0, nextLevel - level);
    const table = {
      might: `伤害 +${(level * 3.5).toFixed(1)}% → +${(nextLevel * 3.5).toFixed(1)}%`,
      keenEdge: `减速效果 +${(level * 1.5).toFixed(1)}% → +${(nextLevel * 1.5).toFixed(1)}%`,
      execution: `精英/Boss 伤害 +${(level * 3.5).toFixed(1)}% → +${(nextLevel * 3.5).toFixed(1)}%`,
      fury: `低血量伤害 +${(level * 3.5).toFixed(1)}% → +${(nextLevel * 3.5).toFixed(1)}%`,
      bloodrage: `连杀攻速 +${(level * 2).toFixed(1)}% → +${(nextLevel * 2).toFixed(1)}%`,
      deathmark: `标记增伤 +${(level * 2.5).toFixed(1)}% → +${(nextLevel * 2.5).toFixed(1)}%`,
      multistar: `额外弹幕 +${level} → +${nextLevel}`,
      overwhelm: `群怪增伤 +${(level * 3).toFixed(1)}% → +${(nextLevel * 3).toFixed(1)}%`,
      starfall: `陨星概率 ${(level * 2).toFixed(1)}% → ${(nextLevel * 2).toFixed(1)}%`,
      apocalypse: `全攻击 +${(level * 5).toFixed(1)}% → +${(nextLevel * 5).toFixed(1)}%`,
      vitality: `生命 +${level * 7} → +${nextLevel * 7}`,
      ironSkin: `弹幕减伤 +${(level * 2).toFixed(1)}% → +${(nextLevel * 2).toFixed(1)}%`,
      ward: `接触减伤 +${Math.min(35, level * 2.5).toFixed(1)}% → +${Math.min(35, nextLevel * 2.5).toFixed(1)}%`,
      regen: `回复 ${level * 0.08}/秒 → ${nextLevel * 0.08}/秒`,
      endurance: `低血减伤 +${(level * 2).toFixed(1)}% → +${(nextLevel * 2).toFixed(1)}%`,
      barrier: `护盾值 +${level * 5} → +${nextLevel * 5}`,
      revive: `恢复量 +${(level * 15).toFixed(0)}% → +${(nextLevel * 15).toFixed(0)}%`,
      bulwark: `递减上限 +${(level * 8).toFixed(0)}% → +${(nextLevel * 8).toFixed(0)}%`,
      undying: `无敌时间 +${(level * 0.5).toFixed(1)}s → +${(nextLevel * 0.5).toFixed(1)}s`,
      titanShell: `生命上限 +${(level * 8).toFixed(1)}% → +${(nextLevel * 8).toFixed(1)}%`,
      swiftness: `速度 +${level * 4} → +${nextLevel * 4}`,
      focus: `冷却缩短 +${(level * 2.5).toFixed(1)}% → +${(nextLevel * 2.5).toFixed(1)}%`,
      pathfinder: `拉扯力 +${(level * 3).toFixed(1)}% → +${(nextLevel * 3).toFixed(1)}%`,
      quickstep: `提速 +${(level * 5).toFixed(0)}% → +${(nextLevel * 5).toFixed(0)}%`,
      momentum: `叠加速度 +${(level * 1.5).toFixed(1)}% → +${(nextLevel * 1.5).toFixed(1)}%`,
      warpStride: `冲刺距离 +${(level * 4).toFixed(0)} → +${(nextLevel * 4).toFixed(0)}`,
      blink: `加速窗口 +${(level * 0.3).toFixed(1)}s → +${(nextLevel * 0.3).toFixed(1)}s`,
      phaseShift: `闪避概率 ${(level * 2.5).toFixed(1)}% → ${(nextLevel * 2.5).toFixed(1)}%`,
      phantomRush: `分身持续 +${(level * 0.5).toFixed(1)}s → +${(nextLevel * 0.5).toFixed(1)}s`,
      timeWarp: `减速效果 +${(level * 5).toFixed(0)}% → +${(nextLevel * 5).toFixed(0)}%`,
      fortune: `月尘收益 +${(level * 3.5).toFixed(1)}% → +${(nextLevel * 3.5).toFixed(1)}%`,
      scholar: `团队经验 +${(level * 3.5).toFixed(1)}% → +${(nextLevel * 3.5).toFixed(1)}%`,
      scavenger: `补给频率 +${(level * 4).toFixed(0)}% → +${(nextLevel * 4).toFixed(0)}%`,
      prospector: `月尘概率 +${(level * 2).toFixed(1)}% → +${(nextLevel * 2).toFixed(1)}%`,
      merchant: `免费概率 ${(level * 1.5).toFixed(1)}% → ${(nextLevel * 1.5).toFixed(1)}%`,
      banker: `结算加成 +${(level * 4).toFixed(0)}% → +${(nextLevel * 4).toFixed(0)}%`,
      alchemy: `经验球 +${level} → +${nextLevel}`,
      dragonHoard: `品质提升 +${(level * 5).toFixed(0)}% → +${(nextLevel * 5).toFixed(0)}%`,
      midasTouch: `月尘概率 ${(level * 1.5).toFixed(1)}% → ${(nextLevel * 1.5).toFixed(1)}%`,
      wealthSigil: `资源倍率 x${(1 + level * 0.3).toFixed(1)} → x${(1 + nextLevel * 0.3).toFixed(1)}`,
      rescue: `救援速度 +${(level * 12).toFixed(0)}% → +${(nextLevel * 12).toFixed(0)}%`,
      rallyCry: `伤害加成 +${(level * 2.5).toFixed(1)}% → +${(nextLevel * 2.5).toFixed(1)}%`,
      banner: `全队生命 +${(level * 3).toFixed(1)}% → +${(nextLevel * 3).toFixed(1)}%`,
      tactician: `全队伤害 +${(level * 2.5).toFixed(1)}% → +${(nextLevel * 2.5).toFixed(1)}%`,
      guardianLink: `减伤 +${(level * 3).toFixed(1)}% → +${(nextLevel * 3).toFixed(1)}%`,
      sharedFate: `提速 +${(level * 8).toFixed(0)}% → +${(nextLevel * 8).toFixed(0)}%`,
      medic: `恢复 +${(level * 10).toFixed(0)}% → +${(nextLevel * 10).toFixed(0)}%`,
      commandAura: `冷却缩短 +${(level * 2).toFixed(1)}% → +${(nextLevel * 2).toFixed(1)}%`,
      warlordOath: `共享比例 ${(level * 10).toFixed(0)}% → ${(nextLevel * 10).toFixed(0)}%`,
      phoenixBond: `无敌时间 +${(level * 0.8).toFixed(1)}s → +${(nextLevel * 0.8).toFixed(1)}s`,
      eclipse: `高章收益 +${(level * 4).toFixed(0)}% → +${(nextLevel * 4).toFixed(0)}%`,
      voidTouched: `受控增伤 +${(level * 3).toFixed(1)}% → +${(nextLevel * 3).toFixed(1)}%`,
      crown: `Boss增伤 +${(level * 3.5).toFixed(1)}% → +${(nextLevel * 3.5).toFixed(1)}%`,
      voidcraft: `范围提升 +${(level * 3).toFixed(1)}% → +${(nextLevel * 3).toFixed(1)}%`,
      entropyWell: `临时伤害 +${(level * 1.5).toFixed(1)}% → +${(nextLevel * 1.5).toFixed(1)}%`,
      moonRite: `波间回复 +${level * 3} → +${nextLevel * 3}`,
      abyssalPact: `伤害换取 ${(level * 5).toFixed(0)}% → ${(nextLevel * 5).toFixed(0)}%`,
      stellarForge: `强化间隔 ${(12 - level).toFixed(0)}s → ${(12 - nextLevel).toFixed(0)}s`,
      finalOath: `综合提升 +${(level * 4).toFixed(0)}% → +${(nextLevel * 4).toFixed(0)}%`,
      oblivionCrown: `天赋上限 +${level} → +${nextLevel}`
    };
    return table[id] || `当前 ${level} 级，升级后 +${delta} 级效果`;
  }

  function renderLeaderboard() {
    ui.leaderboardList.innerHTML = "";
    if (!state.leaderboard.length) {
      ui.leaderboardList.innerHTML = `<div class="leader-row"><span>#</span><div>暂无记录</div><strong>0</strong></div>`;
      return;
    }
    state.leaderboard.forEach((row, index) => {
      const el = document.createElement("div");
      el.className = "leader-row";
      const rankIcon = index === 0 ? " " : index === 1 ? " " : index === 2 ? " " : "";
      el.innerHTML = `
        <span>${rankIcon}#${index + 1}</span>
        <div>
          <div>${row.username} · ${row.chapter}</div>
          <span>${formatTime(row.time)} · ${row.kills} 斩 · ${row.victory ? "通关" : "失败"}</span>
        </div>
        <strong>${state.leaderboardMetric === "kills" ? row.kills : row.score}</strong>
      `;
      ui.leaderboardList.appendChild(el);
    });
  }

  async function refreshLeaderboard(scope, metric) {
    if (scope) state.leaderboardScope = scope;
    if (metric) state.leaderboardMetric = metric;
    await loadLeaderboard().catch(error => toast(error.message));
    renderLeaderboard();
  }

  function renderHeroOptions() {
    if (!state.meta) return;
    ui.heroSelect.innerHTML = "";
    const unlocked = state.me?.profile.unlockedHeroes || ["astrid", "mara", "noct"];
    for (const hero of Object.values(state.meta.heroes)) {
      const option = document.createElement("option");
      option.value = hero.id;
      option.disabled = state.me && !unlocked.includes(hero.id);
      option.textContent = `${hero.name}${option.disabled ? "（未解锁）" : ""}`;
      ui.heroSelect.appendChild(option);
    }
  }

  async function login(register = false) {
    if (state.authLoading) return;
    state.authLoading = true;
    try {
      const username = ui.authUsername.value.trim();
      const password = ui.authPassword.value;
      const body = { username, password };
      if (register) {
        body.email = ui.authEmail.value.trim();
        body.code = ui.authCode.value.trim();
      }
      const data = await api(register ? "/api/register" : "/api/login", { method: "POST", body });
      state.me = data.user;
      ui.auth.classList.add("hidden");
      await loadFriends();
      await loadLeaderboard();
      renderAll();
      toast(register ? "注册成功" : "登录成功");
      play("confirm");
    } catch (error) {
      toast(error.message);
      play("error");
    } finally {
      state.authLoading = false;
    }
  }

  async function logout() {
    await api("/api/logout", { method: "POST", body: {} }).catch(() => {});
    state.me = null;
    state.friends = [];
    renderAll();
    toast("已退出");
  }

  async function buyTalent(id) {
    try {
      const data = await api("/api/profile", { method: "POST", body: { action: "buyTalent", talent: id } });
      state.me.profile = data.profile;
      state.researchExpanded = null;
      renderResearchMap();
      renderAccount();
      toast("天赋已提升");
      play("confirm");
    } catch (error) {
      toast(error.message);
      play("error");
    }
  }

  async function addFriend() {
    if (!state.me) return showLogin("添加好友需要登录");
    const username = ui.friendNameInput.value.trim();
    if (!username) return toast("请输入好友用户名");
    try {
      await api("/api/friends", { method: "POST", body: { action: "request", username } });
      ui.friendNameInput.value = "";
      await loadFriends();
      renderFriends();
      toast("好友申请已发送");
      play("confirm");
    } catch (error) {
      toast(error.message);
      play("error");
    }
  }

  async function respondFriend(userId, action) {
    try {
      await api("/api/friends", { method: "POST", body: { action, userId } });
      await loadFriends();
      renderFriends();
      toast(action === "accept" ? "好友已添加" : "已拒绝申请");
    } catch (error) {
      toast(error.message);
      play("error");
    }
  }

  function connectWs() {
    return new Promise((resolve, reject) => {
      if (state.ws && state.ws.readyState === WebSocket.OPEN) return resolve();
      const protocol = location.protocol === "https:" ? "wss:" : "ws:";
      const ws = new WebSocket(`${protocol}//${location.host}/ws`);
      state.ws = ws;
      let settled = false;
      ws.addEventListener("open", () => {
        state.wsOpen = true;
        settled = true;
        resolve();
      });
      ws.addEventListener("close", () => {
        state.wsOpen = false;
        if (!settled) { settled = true; reject(new Error("连接已关闭")); return; }
        if (state.room?.status === "running") toast("连接已断开，请刷新页面重连房间");
      });
      ws.addEventListener("error", () => { if (!settled) { settled = true; reject(new Error("连接失败")); } });
      ws.addEventListener("message", event => handleWs(JSON.parse(event.data)));
    });
  }

  function send(type, payload = {}) {
    if (!state.ws || state.ws.readyState !== WebSocket.OPEN) return;
    state.ws.send(JSON.stringify({ type, ...payload }));
  }

  function handleWs(msg) {
    if (msg.type === "error") {
      toast(msg.message || "操作失败");
      play("error");
    }
    if (msg.type === "roomCreated" && state.autoStart) {
      state.autoStart = false;
      send("startRoom");
    }
    if (msg.type === "roomState") {
      // 检测新效果 → 生成粒子
      const oldEffects = state.room?.effects || [];
      const newEffects = msg.room?.effects || [];
      if (newEffects.length > oldEffects.length && typeof spawnParticles === "function") {
        for (const eff of newEffects) {
          if (!oldEffects.find(o => o.id === eff.id)) {
            if (eff.type === "hit") spawnParticles(eff.x, eff.y, eff.color, 6, { speed: 80, life: 0.35, size: 2 });
            else if (eff.type === "spark") spawnParticles(eff.x, eff.y, eff.color, 3, { speed: 60, life: 0.25, size: 2 });
            else if (eff.type === "revive") { spawnParticles(eff.x, eff.y, eff.color, 12, { speed: 60, life: 0.6, size: 3 }); triggerFlash(eff.color, 0.15); }
            else if (eff.type === "boss") { spawnParticles(eff.x, eff.y, eff.color, 20, { speed: 100, life: 0.8, size: 3 }); triggerShake(8); triggerFlash(eff.color, 0.2); }
          }
        }
      }
      // 检测敌人消失（死亡）→ 血雾粒子 + 连杀 + 伤害数字
      const oldEnemies = state.room?.enemies || [];
      const newEnemies = msg.room?.enemies || [];
      for (const old of oldEnemies) {
        if (!newEnemies.find(e => e.id === old.id)) {
          if (typeof spawnParticles === "function") {
            spawnParticles(old.x, old.y, old.color || "#d3424f", old.boss ? 25 : 8, {
              speed: old.boss ? 150 : 90, life: old.boss ? 0.8 : 0.4, size: old.boss ? 4 : 2, gravity: 80
            });
          }
          if (old.boss) {
            triggerShake(14);
            triggerFlash(old.color || "#f4c95d", 0.25);
            hitStopFrames = 4;
          } else {
            hitStopFrames = Math.max(hitStopFrames, 2);
          }
          addKillStreak();
          if (typeof spawnDamageNumber === "function") {
            const xpVal = old.boss ? 720 : (old.maxHp || 10);
            spawnDamageNumber(old.x, old.y, xpVal, old.boss ? "#f4c95d" : old.color || "#d3424f", old.boss);
          }
        }
      }
      state.room = msg.room;
      state.you = msg.you;
      updateRoomViews();
    }
    if (msg.type === "chat") {
      state.messages.push(msg);
      state.messages = state.messages.slice(-6);
      toast(`${msg.from}：${msg.text}`);
      if (ui.chatMessages) {
        const div = document.createElement("div");
        div.className = "chat-msg";
        div.innerHTML = `<span class="from">${msg.from}</span>${msg.text}`;
        ui.chatMessages.appendChild(div);
        ui.chatMessages.scrollTop = ui.chatMessages.scrollHeight;
      }
    }
    if (msg.type === "achievement") {
      toast(`成就解锁：${msg.icon} ${msg.name}`, "achievement");
      play("confirm");
    }
    if (msg.type === "invite") {
      toast(`${msg.from} 邀请你加入 ${msg.chapter}：${msg.code}`);
      ui.roomCodeInput.value = msg.code;
    }
    if (msg.type === "kicked") {
      state.room = null;
      state.you = null;
      showOnly(ui.menu);
      ui.topbar.classList.add("hidden");
    }
  }

  async function startStory(chapterId) {
    try {
      await connectWs();
      state.autoStart = true;
      send("createRoom", { chapterId, multiplayer: false });
      playMusic();
      play("confirm");
    } catch (error) {
      toast(error.message);
    }
  }

  async function createCoopRoom() {
    if (!state.me) return showLogin("联机需要登录");
    try {
      await connectWs();
      const modifiers = [...ui.modifierList.querySelectorAll("input:checked")].map(input => input.value).slice(0, 3);
      const difficulty = ui.coopDifficulty?.value || "normal";
      send("createRoom", { chapterId: Number(ui.coopChapter.value), multiplayer: true, modifiers, difficulty });
      playMusic();
      play("confirm");
    } catch (error) {
      toast(error.message);
    }
  }

  async function joinCoopRoom() {
    if (!state.me) return showLogin("联机需要登录");
    const code = ui.roomCodeInput.value.trim().toUpperCase();
    if (!code) return toast("请输入房间码");
    try {
      await connectWs();
      send("joinRoom", { code });
      playMusic();
      play("confirm");
    } catch (error) {
      toast(error.message);
    }
  }

  function updateRoomViews() {
    const room = state.room;
    if (!room) return;
    if (room.status === "lobby") {
      showOnly(ui.room);
      ui.topbar.classList.add("hidden");
      ui.hud.classList.add("hidden");
      ui.upgrade.classList.add("hidden");
      ui.end.classList.add("hidden");
      renderRoomLobby();
    } else if (room.status === "running") {
      hideScreens();
      ui.topbar.classList.add("hidden");
      ui.hud.classList.remove("hidden");
      renderHud();
      renderUpgrade();
    } else if (room.status === "ended") {
      ui.hud.classList.add("hidden");
      ui.topbar.classList.add("hidden");
      ui.upgrade.classList.add("hidden");
      showEnd(room.result);
    }
  }

  function renderRoomLobby() {
    const room = state.room;
    const you = currentMember();
    const diffName = { normal: "普通", hard: "困难", nightmare: "噩梦" }[room.difficulty] || "普通";
    const diffClass = room.difficulty === "nightmare" ? "nightmare" : room.difficulty === "hard" ? "hard" : "normal";
    ui.roomTitle.textContent = `房间 ${room.code}`;
    ui.roomSubtitle.innerHTML = `${room.chapter.name} · <span class="diff-badge ${diffClass}">${diffName}</span> · ${room.multiplayer ? "协作闯关" : "单人故事"}`;
    if (ui.chatMessages) ui.chatMessages.innerHTML = "";
    ui.roomModifiers.innerHTML = `
      ${(room.modifiers || []).map(item => `<span class="${item.type}">${item.name}</span>`).join("")}
      <div class="room-skill-preview">${(room.availableUpgrades || []).map(skill => `<span style="--skill:${skill.color}">${skill.icon || "✦"} ${skill.name}</span>`).join("")}</div>
    `;
    ui.inviteList.innerHTML = "";
    if (room.multiplayer && state.friends.length) {
      for (const friend of state.friends.slice(0, 6)) {
        const button = document.createElement("button");
        button.className = "ghost-button";
        button.type = "button";
        button.textContent = `邀请 ${friend.nickname}`;
        button.addEventListener("click", () => send("inviteFriend", { userId: friend.id }));
        ui.inviteList.appendChild(button);
      }
    }
    ui.memberList.innerHTML = "";
    const isHost = room.hostKey === state.you;
    for (const member of room.members) {
      const hero = state.meta.heroes[member.hero];
      const card = document.createElement("div");
      card.className = `member-card${member.ready ? " ready" : ""}${member.connected ? "" : " offline"}`;
      card.innerHTML = `
        <div class="member-name">${member.username}</div>
        <div class="member-meta">${hero.name}</div>
        <div class="member-meta">${member.key === room.hostKey ? "房主" : "队友"} · ${member.connected ? "在线" : "托管"} · ${member.ready ? "已准备" : "未准备"}</div>
        ${isHost && member.key !== room.hostKey ? `<button class="ghost-button kick-button" type="button" data-key="${member.key}">踢出</button>` : ""}
      `;
      const kickButton = card.querySelector(".kick-button");
      if (kickButton) kickButton.addEventListener("click", () => send("kickMember", { key: member.key }));
      ui.memberList.appendChild(card);
    }
    if (you) ui.heroSelect.value = you.hero;
    ui.readyButton.textContent = you?.ready ? "取消准备" : "准备";
    ui.startRoom.disabled = room.multiplayer && room.members.length < 2;
  }

  function renderHud() {
    const room = state.room;
    const you = currentMember();
    if (!room || !you) return;
    ui.timer.textContent = formatTime(room.time);
    if (room.paused) {
      ui.chapterName.textContent = "⏸ 已暂停";
      ui.chapterName.style.color = "var(--gold)";
      ui.pauseButton.textContent = "▶";
    } else {
      ui.chapterName.textContent = room.chapter.name;
      ui.chapterName.style.color = "";
      ui.pauseButton.textContent = "☰";
    }
    ui.teamLevel.textContent = `Lv. ${room.teamLevel}`;
    ui.kills.textContent = `${room.kills}/${room.chapter.killGoal} 斩`;
    ui.hpFill.style.width = `${clamp((you.hp / you.maxHp) * 100, 0, 100)}%`;
    ui.xpFill.style.width = `${clamp((room.xp / room.xpToNext) * 100, 0, 100)}%`;
    const teamSig = room.members.map(member => `${member.key}:${Math.round(member.hp)}:${member.maxHp}:${member.connected}:${member.downed}:${member.eliminated}:${member.hero}`).join("|");
    if (teamSig === state.teamSig) return;
    state.teamSig = teamSig;
    ui.teamRow.innerHTML = "";
    for (const member of room.members) {
      const hero = state.meta.heroes[member.hero];
      const hpPct = clamp((member.hp / member.maxHp) * 100, 0, 100);
      const hpColor = member.downed ? "#f4c95d" : hpPct < 25 ? "#d3424f" : hpPct < 50 ? "#ff9658" : "#7fe0c4";
      const statusText = member.downed ? "倒地" : member.eliminated ? "离场" : member.connected ? "作战" : "托管";
      const statusColor = member.downed ? "var(--gold)" : member.eliminated ? "var(--blood)" : member.connected ? "var(--mint)" : "var(--muted)";
      const card = document.createElement("div");
      card.className = "team-card";
      card.innerHTML = `
        <strong style="color:${hero.color}">${member.username}${member.key === state.you ? " · 我" : ""}</strong>
        <span style="color:${statusColor}">${statusText}</span>
        <div class="mini-hp"><span style="width:${hpPct}%;background:${hpColor}"></span></div>
      `;
      ui.teamRow.appendChild(card);
    }
  }

  function renderUpgrade() {
    const you = currentMember();
    if (!you || !you.pendingChoices.length) {
      ui.upgrade.classList.add("hidden");
      state.upgradeSig = "";
      state.upgradeDeadline = null;
      clearInterval(state.upgradeTimerInterval);
      return;
    }
    ui.upgrade.classList.remove("hidden");
    const title = ui.upgrade.querySelector("h2");
    if (title) title.textContent = state.room?.paused ? "星辉共鸣（已暂停）" : "星辉共鸣";
    const sig = you.pendingChoices.map(choice => choice.id).join("|");
    if (sig === state.upgradeSig) {
      // 已在显示相同选项，检查超时
      if (state.upgradeDeadline && Date.now() > state.upgradeDeadline) {
        const random = you.pendingChoices[Math.floor(Math.random() * you.pendingChoices.length)];
        if (random) {
          send("chooseUpgrade", { choiceId: random.id });
          play("confirm");
          toast("已自动选择：" + random.name);
        }
        state.upgradeDeadline = null;
      }
      return;
    }
    state.upgradeSig = sig;
    state.upgradeDeadline = Date.now() + 20000;
    ui.upgradeOptions.innerHTML = "";
    // 添加倒计时条
    const timerBar = document.createElement("div");
    timerBar.className = "upgrade-timer-bar";
    timerBar.innerHTML = `<span></span>`;
    ui.upgradeOptions.appendChild(timerBar);
    // 倒计时更新
    clearInterval(state.upgradeTimerInterval);
    state.upgradeTimerInterval = setInterval(() => {
      if (!state.upgradeDeadline) { clearInterval(state.upgradeTimerInterval); return; }
      const remaining = Math.max(0, state.upgradeDeadline - Date.now());
      const pct = remaining / 20000;
      const bar = ui.upgradeOptions.querySelector(".upgrade-timer-bar span");
      if (bar) bar.style.width = `${pct * 100}%`;
      const titleEl = ui.upgrade.querySelector("h2");
      if (titleEl && !state.room?.paused) titleEl.textContent = `星辉共鸣（${Math.ceil(remaining / 1000)}s）`;
      if (remaining <= 0) clearInterval(state.upgradeTimerInterval);
    }, 200);
    for (const choice of you.pendingChoices) {
      const current = you.upgrades?.[choice.id] || 0;
      const evolution = (state.room?.evolutions || []).find(evo => evo.needs.includes(choice.id));
      const partnerInfo = evolution ? evolution.needs.filter(id => id !== choice.id).map(id => {
        const skill = state.meta.upgradeDefs.find(s => s.id === id);
        const lvl = you.upgrades?.[id] || 0;
        return { name: skill?.name || id, level: lvl, max: skill?.max || 5, color: skill?.color || "#fff" };
      }) : [];
      const isMaxNext = current + 1 >= choice.max;
      const button = document.createElement("button");
      button.type = "button";
      button.className = "option-card";
      button.style.borderColor = isMaxNext ? `${choice.color}55` : "";
      button.innerHTML = `
        <span class="icon" style="background:${choice.color}">${choice.icon || "✦"}</span>
        <div class="chapter-title">${choice.name} ${isMaxNext ? "<small style='color:var(--gold);font-weight:800'>MAX</small>" : `<small style='color:var(--muted)'>Lv.${current} → <span style='color:${choice.color}'>${current + 1}</span></small>`}</div>
        <p style="margin:6px 0 8px">${choice.desc}</p>
        <div style="display:flex;gap:3px;margin:4px 0 8px">${Array.from({length: choice.max}, (_, i) => `<span style="flex:1;height:4px;border-radius:99px;background:${i < current ? choice.color : i === current ? choice.color + "55" : "rgba(255,255,255,0.06)"};box-shadow:${i < current ? `0 0 6px ${choice.color}44` : "none"}"></span>`).join("")}</div>
        <p style="color:${choice.color};font-size:12px;font-weight:700">${choice.stat || "强化"} +${choice.desc.match(/\d+/)?.[0] || ""}</p>
        ${evolution ? `<div class="evo-preview">
          <div class="evo-nodes">
            <span class="evo-skill" style="--sc:${choice.color};${current >= choice.max ? 'opacity:1' : 'opacity:0.4'}">${choice.icon || "✦"} <small>${current}/${choice.max}</small></span>
            <span class="evo-connector"></span>
            ${partnerInfo.map(p => `<span class="evo-skill" style="--sc:${p.color};${p.level >= p.max ? 'opacity:1' : 'opacity:0.4'}">${"✦"} <small>${p.level}/${p.max}</small></span>`).join("")}
          </div>
          <div class="evo-result"><span class="evo-arrow">▼</span> <span style="color:var(--gold)">✦ ${evolution.name}</span></div>
          <small style="color:var(--ink2);font-size:10px">${evolution.desc}</small>
        </div>` : ""}
      `;
      button.addEventListener("click", () => {
        button.disabled = true;
        send("chooseUpgrade", { choiceId: choice.id });
        play("confirm");
      });
      const idx = ui.upgradeOptions.children.length;
      button.style.opacity = "0";
      button.style.animation = `fadeUp 0.35s ease-out ${idx * 0.08}s forwards`;
      ui.upgradeOptions.appendChild(button);
    }
  }

  function showEnd(result) {
    showOnly(ui.end);
    ui.hud.classList.add("hidden");
    ui.upgrade.classList.add("hidden");
    ui.touchStick.classList.add("hidden");
    clearInterval(state.upgradeTimerInterval);
    state.upgradeTimerInterval = null;
    ui.endTitle.textContent = result?.victory ? "✦ 章节通关 ✦" : "远征失败";
    ui.endTitle.style.color = result?.victory ? "var(--gold)" : "var(--blood)";
    const dust = result?.moonDust || 0;
    const isNewBest = state.me && result?.score > (state.me.profile?.bestScore || 0);
    const kpm = result?.time > 0 ? Math.round((result.kills / (result.time / 60)) * 10) / 10 : 0;
    ui.endStats.innerHTML = `
      <div style="opacity:0;animation:fadeUp 0.4s ease-out 0.1s forwards"><span>章节</span><strong style="font-size:18px">${result?.chapter || "-"}</strong></div>
      <div style="opacity:0;animation:fadeUp 0.4s ease-out 0.2s forwards"><span>生存时间</span><strong>${formatTime(result?.time || 0)}</strong></div>
      <div style="opacity:0;animation:fadeUp 0.4s ease-out 0.3s forwards"><span>斩杀数</span><strong>${result?.kills || 0}</strong></div>
      <div style="opacity:0;animation:fadeUp 0.4s ease-out 0.4s forwards"><span>每分钟击杀</span><strong style="font-size:22px;color:var(--ink2)">${kpm}</strong></div>
      <div style="opacity:0;animation:fadeUp 0.4s ease-out 0.5s forwards"><span>评分</span><strong>${result?.score || 0}${isNewBest ? " <small style='color:var(--ember)'>新纪录!</small>" : ""}</strong></div>
      <div style="opacity:0;animation:fadeUp 0.4s ease-out 0.6s forwards"><span>获得月尘</span><strong style="color:var(--gold)">+${dust}</strong></div>
    `;
    // 击杀曲线图
    drawKillGraph(result);
  }

  function drawKillGraph(result) {
    const old = ui.endStats.querySelector(".kill-graph-wrap");
    if (old) old.remove();
    const buckets = result?.killBuckets;
    if (!buckets || buckets.length < 2) return;
    const wrap = document.createElement("div");
    wrap.className = "kill-graph-wrap";
    wrap.style.opacity = "0";
    wrap.style.animation = "fadeUp 0.5s ease-out 0.7s forwards";
    const label = document.createElement("div");
    label.className = "kill-graph-label";
    label.textContent = "击杀速率";
    wrap.appendChild(label);
    const cvs = document.createElement("canvas");
    const w = 600, h = 120;
    cvs.width = w * 2; cvs.height = h * 2;
    cvs.style.width = w + "px"; cvs.style.height = h + "px";
    const c = cvs.getContext("2d");
    c.scale(2, 2);
    const maxVal = Math.max(1, ...buckets);
    const barW = (w - 20) / buckets.length;
    // 网格线
    c.strokeStyle = "rgba(255,255,255,0.04)";
    c.lineWidth = 0.5;
    for (let i = 0; i <= 4; i++) {
      const gy = 10 + (h - 20) * (1 - i / 4);
      c.beginPath(); c.moveTo(10, gy); c.lineTo(w - 10, gy); c.stroke();
    }
    // 填充区域
    c.beginPath();
    c.moveTo(10, h - 10);
    for (let i = 0; i < buckets.length; i++) {
      const x = 10 + i * barW + barW / 2;
      const y = h - 10 - (buckets[i] / maxVal) * (h - 25);
      if (i === 0) c.lineTo(x, y); else c.lineTo(x, y);
    }
    c.lineTo(10 + (buckets.length - 1) * barW + barW / 2, h - 10);
    c.closePath();
    const grd = c.createLinearGradient(0, 0, 0, h);
    grd.addColorStop(0, "rgba(240,192,64,0.15)");
    grd.addColorStop(1, "rgba(240,192,64,0.01)");
    c.fillStyle = grd;
    c.fill();
    // 折线
    c.beginPath();
    for (let i = 0; i < buckets.length; i++) {
      const x = 10 + i * barW + barW / 2;
      const y = h - 10 - (buckets[i] / maxVal) * (h - 25);
      if (i === 0) c.moveTo(x, y); else c.lineTo(x, y);
    }
    c.strokeStyle = "rgba(240,192,64,0.7)";
    c.lineWidth = 2;
    c.stroke();
    // 数据点
    for (let i = 0; i < buckets.length; i++) {
      const x = 10 + i * barW + barW / 2;
      const y = h - 10 - (buckets[i] / maxVal) * (h - 25);
      if (buckets[i] > 0) {
        c.beginPath(); c.arc(x, y, 2.5, 0, Math.PI * 2);
        c.fillStyle = "rgba(240,192,64,0.9)";
        c.fill();
      }
    }
    // 时间轴标签
    c.fillStyle = "rgba(255,255,255,0.25)";
    c.font = "10px Microsoft YaHei, sans-serif";
    c.textAlign = "center";
    const bucketSec = result?.bucketSec || 10;
    const step = Math.max(1, Math.floor(buckets.length / 6));
    for (let i = 0; i < buckets.length; i += step) {
      const x = 10 + i * barW + barW / 2;
      const sec = Math.floor(i * bucketSec);
      c.fillText(`${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, "0")}`, x, h - 1);
    }
    wrap.appendChild(cvs);
    ui.endStats.appendChild(wrap);
  }

  function currentMember() {
    return state.room?.members?.find(member => member.key === state.you) || null;
  }

  function showLogin(message) {
    if (message) toast(message);
    state.registerMode = false;
    state.authLoading = false;
    document.querySelectorAll(".register-only").forEach(el => el.classList.remove("show"));
    ui.authTitle.textContent = "登录";
    ui.authSubtitle.textContent = "欢迎回来，继续你的月蚀之旅";
    ui.authSubmit.textContent = "登录";
    ui.authToggleText.textContent = "没有账号？";
    ui.authToggleBtn.textContent = "去注册";
    ui.authUsername.value = "";
    ui.authPassword.value = "";
    if (ui.authPasswordConfirm) ui.authPasswordConfirm.value = "";
    if (ui.authEmail) ui.authEmail.value = "";
    if (ui.authCode) ui.authCode.value = "";
    ui.authPassword.autocomplete = "current-password";
    ui.auth.classList.remove("hidden");
  }

  function hideScreens() {
    ui.menu.classList.add("hidden");
    ui.auth.classList.add("hidden");
    ui.research.classList.add("hidden");
    ui.codex.classList.add("hidden");
    ui.talentDetail.classList.add("hidden");
    ui.room.classList.add("hidden");
    ui.end.classList.add("hidden");
  }

  function showOnly(screen) {
    hideScreens();
    screen.classList.remove("hidden");
  }

  async function backToMenu() {
    send("leaveRoom");
    state.room = null;
    state.you = null;
    clearInterval(state.upgradeTimerInterval);
    state.upgradeTimerInterval = null;
    state.smooth.clear();
    ui.touchStick.classList.add("hidden");
    await loadMe().catch(() => {});
    await loadFriends().catch(() => {});
    await loadLeaderboard().catch(() => {});
    renderAll();
    history.pushState(null, "", "#menu");
    ui.topbar.classList.add("hidden");
    ui.hud.classList.add("hidden");
    ui.upgrade.classList.add("hidden");
    showOnly(ui.menu);
  }

  function bindEvents() {
    window.addEventListener("resize", resize);
    document.querySelectorAll(".menu-nav .nav-item").forEach(button => {
      button.addEventListener("click", () => {
        if (button.dataset.panel === "research-panel") {
          openResearchScreen();
          play("click");
          return;
        }
        if (button.dataset.panel === "codex-panel") {
          openCodexScreen();
          play("click");
          return;
        }
        document.querySelectorAll(".menu-nav .nav-item").forEach(item => item.classList.remove("active"));
        document.querySelectorAll(".panel").forEach(item => item.classList.remove("active"));
        button.classList.add("active");
        document.getElementById(button.dataset.panel).classList.add("active");
        if (button.dataset.panel === "coop-panel") { loadOnlineCount(); loadWeeklyChallenge(); }
        play("click");
      });
    });
    document.querySelectorAll(".login-open").forEach(btn => btn.addEventListener("click", () => showLogin()));
    ui.authClose.addEventListener("click", () => {
      state.registerMode = false;
      state.authLoading = false;
      document.querySelectorAll(".register-only").forEach(el => el.classList.remove("show"));
      ui.authPassword.autocomplete = "current-password";
      clearInterval(state.sendCodeTimer);
      state.sendCodeTimer = null;
      ui.sendCodeButton.textContent = "发送验证码";
      ui.sendCodeButton.disabled = false;
      ui.auth.classList.add("hidden");
    });
    ui.authSubmit.addEventListener("click", () => {
      if (state.registerMode) {
        const pw = ui.authPassword.value;
        const pw2 = ui.authPasswordConfirm?.value || "";
        if (pw !== pw2) { toast("两次密码不一致"); return; }
        login(true);
      } else {
        login(false);
      }
    });
    ui.authToggleBtn.addEventListener("click", () => {
      if (state.registerMode) {
        state.registerMode = false;
        document.querySelectorAll(".register-only").forEach(el => el.classList.remove("show"));
        ui.authTitle.textContent = "登录";
        ui.authSubtitle.textContent = "欢迎回来，继续你的月蚀之旅";
        ui.authSubmit.textContent = "登录";
        ui.authToggleText.textContent = "没有账号？";
        ui.authToggleBtn.textContent = "去注册";
        ui.authPassword.autocomplete = "current-password";
      } else {
        state.registerMode = true;
        document.querySelectorAll(".register-only").forEach(el => el.classList.add("show"));
        ui.authTitle.textContent = "注册";
        ui.authSubtitle.textContent = "创建账号，开始你的月蚀冒险";
        ui.authSubmit.textContent = "注册";
        ui.authToggleText.textContent = "已有账号？";
        ui.authToggleBtn.textContent = "去登录";
        ui.authPassword.autocomplete = "new-password";
      }
    });
    document.querySelectorAll(".logout-button").forEach(btn => btn.addEventListener("click", logout));
    ui.sendCodeButton.addEventListener("click", async () => {
      const email = ui.authEmail.value.trim();
      if (!email) { toast("请输入邮箱地址"); return; }
      try {
        const data = await api("/api/send-code", { method: "POST", body: { email } });
        if (data.code) {
          toast(`验证码: ${data.code}（邮件发送失败，已直接显示）`);
          ui.authCode.value = data.code;
        } else {
          toast("验证码已发送至邮箱");
        }
        ui.sendCodeButton.disabled = true;
        let countdown = 60;
        clearInterval(state.sendCodeTimer);
        state.sendCodeTimer = setInterval(() => {
          ui.sendCodeButton.textContent = `${countdown}s`;
          countdown--;
          if (countdown < 0) { clearInterval(state.sendCodeTimer); state.sendCodeTimer = null; ui.sendCodeButton.textContent = "发送验证码"; ui.sendCodeButton.disabled = false; }
        }, 1000);
      } catch (error) { toast(error.message); }
    });
    [ui.authUsername, ui.authPassword, ui.authPasswordConfirm, ui.authEmail, ui.authCode].forEach(input => {
      if (!input) return;
      input.addEventListener("keydown", e => {
        if (e.key === "Enter") { e.preventDefault(); login(state.registerMode); }
      });
    });
    ui.addFriend.addEventListener("click", addFriend);
    ui.researchBack.addEventListener("click", () => {
      history.pushState(null, "", "#menu");
      ui.topbar.classList.add("hidden");
      showOnly(ui.menu);
    });
    ui.codexBack.addEventListener("click", () => {
      history.pushState(null, "", "#menu");
      ui.topbar.classList.add("hidden");
      showOnly(ui.menu);
    });
    ui.talentDetailBack.addEventListener("click", () => {
      history.pushState(null, "", "#research");
      showTalentMap();
    });
    ui.createRoom.addEventListener("click", createCoopRoom);
    ui.joinRoom.addEventListener("click", joinCoopRoom);
    ui.refreshModifiers.addEventListener("click", () => {
      rollModifiers();
      renderModifiers();
      play("click");
    });
    ui.coopChapter.addEventListener("change", renderSkillPreview);
    ui.copyRoomCode.addEventListener("click", async () => {
      if (!state.room) return;
      await navigator.clipboard?.writeText(state.room.code).catch(() => {});
      toast(`房间码 ${state.room.code} 已复制`);
    });
    ui.modifierList.addEventListener("change", event => {
      if (!event.target.matches("input[type='checkbox']")) return;
      const checked = [...ui.modifierList.querySelectorAll("input:checked")];
      if (checked.length > 3) {
        event.target.checked = false;
        toast("房间词条最多选择 3 个");
      }
    });
    document.querySelectorAll("[data-board-scope]").forEach(button => {
      button.addEventListener("click", async () => {
        document.querySelectorAll("[data-board-scope]").forEach(item => item.classList.remove("active"));
        button.classList.add("active");
        await refreshLeaderboard(button.dataset.boardScope, null);
      });
    });
    document.querySelectorAll("[data-board-metric]").forEach(button => {
      button.addEventListener("click", async () => {
        document.querySelectorAll("[data-board-metric]").forEach(item => item.classList.remove("active"));
        button.classList.add("active");
        await refreshLeaderboard(null, button.dataset.boardMetric);
      });
    });
    ui.heroSelect.addEventListener("change", () => send("selectHero", { hero: ui.heroSelect.value }));
    ui.readyButton.addEventListener("click", () => {
      const you = currentMember();
      send("ready", { ready: !you?.ready });
    });
    ui.startRoom.addEventListener("click", () => send("startRoom"));
    ui.leaveRoom.addEventListener("click", backToMenu);
    ui.backMenu.addEventListener("click", backToMenu);
    ui.pauseButton.addEventListener("click", () => {
      if (state.room?.status === "running") {
        send("togglePause");
      } else {
        backToMenu();
      }
    });
    ui.muteButton.addEventListener("click", () => {
      state.muted = !state.muted;
      ui.muteButton.textContent = state.muted ? "×" : "♪";
      ui.muteButton.classList.toggle("muted", state.muted);
      if (state.muted) state.sounds.music?.pause();
      else playMusic();
    });
    document.querySelectorAll("[data-chat]").forEach(button => {
      button.addEventListener("click", () => send("chat", { text: button.dataset.chat }));
    });
    if (ui.chatSend) {
      const sendChat = () => {
        const text = ui.chatInput?.value?.trim();
        if (!text) return;
        send("chat", { text });
        ui.chatInput.value = "";
      };
      ui.chatSend.addEventListener("click", sendChat);
      ui.chatInput?.addEventListener("keydown", e => { if (e.key === "Enter") sendChat(); });
    }
    window.addEventListener("hashchange", routeFromHash);
    window.addEventListener("keydown", event => state.keys.add(event.code));
    window.addEventListener("keyup", event => state.keys.delete(event.code));
    canvas.addEventListener("pointerdown", pointerDown);
    canvas.addEventListener("pointermove", pointerMove);
    canvas.addEventListener("pointerup", pointerEnd);
    canvas.addEventListener("pointercancel", pointerEnd);
  }

  function pointerDown(event) {
    if (state.room?.status !== "running" || state.room.paused) return;
    canvas.setPointerCapture(event.pointerId);
    state.pointer.active = true;
    state.pointer.id = event.pointerId;
    state.pointer.startX = event.clientX;
    state.pointer.startY = event.clientY;
    state.pointer.dx = 0;
    state.pointer.dy = 0;
    ui.touchStick.classList.remove("hidden");
    ui.touchStick.style.left = `${event.clientX}px`;
    ui.touchStick.style.top = `${event.clientY}px`;
    ui.touchStick.firstElementChild.style.transform = "translate(0, 0)";
  }

  function pointerMove(event) {
    if (!state.pointer.active || state.pointer.id !== event.pointerId) return;
    const dx = event.clientX - state.pointer.startX;
    const dy = event.clientY - state.pointer.startY;
    const mag = Math.hypot(dx, dy);
    const max = 42;
    const clamped = Math.min(max, mag);
    const nx = mag ? dx / mag : 0;
    const ny = mag ? dy / mag : 0;
    state.pointer.dx = nx * (clamped / max);
    state.pointer.dy = ny * (clamped / max);
    ui.touchStick.firstElementChild.style.transform = `translate(${nx * clamped}px, ${ny * clamped}px)`;
  }

  function pointerEnd(event) {
    if (state.pointer.id !== event.pointerId) return;
    state.pointer.active = false;
    state.pointer.id = null;
    state.pointer.dx = 0;
    state.pointer.dy = 0;
    ui.touchStick.classList.add("hidden");
  }

  function resize() {
    state.dpr = Math.min(window.devicePixelRatio || 1, 2);
    state.width = Math.max(320, window.innerWidth);
    state.height = Math.max(360, window.innerHeight);
    canvas.width = Math.floor(state.width * state.dpr);
    canvas.height = Math.floor(state.height * state.dpr);
    ctx.setTransform(state.dpr, 0, 0, state.dpr, 0, 0);
  }

  function loop(now) {
    const dt = Math.min(0.05, (now - state.last) / 1000 || 0);
    state.last = now;
    if (hitStopFrames > 0) {
      hitStopFrames--;
      draw();
      requestAnimationFrame(loop);
      return;
    }
    updateInput(now);
    updateSmooth(dt);
    updateCamera(dt);
    updateParticles(dt);
    updateShake(dt);
    updateFlash(dt);
    updateKillStreak(dt);
    updateDamageNumbers(dt);
    draw();
    requestAnimationFrame(loop);
  }

  function updateSmooth(dt) {
    if (!state.room) return;
    const seen = new Set();
    smoothGroup("member", state.room.members || [], dt, true, seen);
    smoothGroup("enemy", state.room.enemies || [], dt, false, seen);
    smoothGroup("projectile", state.room.projectiles || [], dt, false, seen);
    smoothGroup("enemyShot", state.room.enemyShots || [], dt, false, seen);
    smoothGroup("pickup", state.room.pickups || [], dt, false, seen);
    smoothGroup("hazard", state.room.hazards || [], dt, false, seen);
    for (const key of state.smooth.keys()) {
      if (!seen.has(key)) state.smooth.delete(key);
    }
  }

  function smoothGroup(group, list, dt, predictLocal, seen) {
    const t = 1 - Math.pow(0.00001, dt);
    const localT = 1 - Math.pow(0.000001, dt);
    for (const item of list) {
      const key = `${group}:${item.key || item.id}`;
      seen.add(key);
      let sx = item.x;
      let sy = item.y;
      if (predictLocal && item.key === state.you && state.room?.status === "running" && !state.room.paused && !item.downed && !item.eliminated) {
        sx += state.input.x * (item.speed || 220) * dt;
        sy += state.input.y * (item.speed || 220) * dt;
      }
      const old = state.smooth.get(key);
      if (!old) {
        state.smooth.set(key, { x: sx, y: sy });
      } else {
        const blend = predictLocal && item.key === state.you ? localT : t;
        old.x += (sx - old.x) * blend;
        old.y += (sy - old.y) * blend;
      }
    }
  }

  function smoothPos(group, item) {
    return state.smooth.get(`${group}:${item.key || item.id}`) || item;
  }

  function updateInput(now) {
    let x = 0;
    let y = 0;
    if (state.keys.has("KeyA") || state.keys.has("ArrowLeft")) x -= 1;
    if (state.keys.has("KeyD") || state.keys.has("ArrowRight")) x += 1;
    if (state.keys.has("KeyW") || state.keys.has("ArrowUp")) y -= 1;
    if (state.keys.has("KeyS") || state.keys.has("ArrowDown")) y += 1;
    if (state.pointer.active) {
      x += state.pointer.dx;
      y += state.pointer.dy;
    }
    const mag = Math.hypot(x, y);
    const input = mag ? { x: x / mag, y: y / mag } : { x: 0, y: 0 };
    state.input = input;
    if (state.room?.status === "running" && !state.room.paused && now - state.lastInputSent > 55) {
      state.lastInputSent = now;
      send("input", input);
    }
  }

  function updateCamera(dt) {
    const you = currentMember();
    const target = you ? smoothPos("member", you) : teamCenter();
    const t = 1 - Math.pow(0.001, dt);
    state.camera.x += (target.x - state.camera.x) * t;
    state.camera.y += (target.y - state.camera.y) * t;
  }

  function teamCenter() {
    const members = state.room?.members || [];
    if (!members.length) return { x: 0, y: 0 };
    return {
      x: members.reduce((sum, item) => sum + item.x, 0) / members.length,
      y: members.reduce((sum, item) => sum + item.y, 0) / members.length
    };
  }

  function draw() {
    ctx.clearRect(0, 0, state.width, state.height);
    ctx.save();
    if (shake.intensity > 0.5) {
      ctx.translate(shake.x, shake.y);
    }
    const palette = state.room?.chapter?.palette || ["#101114", "#171820", "#7fe0c4"];
    drawBackground(palette);
    if (state.room?.status === "running" || state.room?.status === "ended") {
      drawHazards();
      drawPickups();
      drawProjectiles();
      drawEnemies();
      drawPlayers();
      drawEffects();
      drawDamageNumbers();
      drawParticles();
      drawVignette();
      drawKillStreakHud();
      drawBossBar();
    } else {
      drawMenuScene();
    }
    ctx.restore();
    drawFlash();
  }

  function drawBackground(palette) {
    ctx.fillStyle = palette[0];
    ctx.fillRect(0, 0, state.width, state.height);

    // 章节特定星云氛围
    const chapterIdx = state.room?.chapter?.id || 0;
    const t = performance.now() / 1000;
    drawChapterNebula(chapterIdx, t, palette);

    const tile = 96;
    const startX = Math.floor((state.camera.x - state.width / 2) / tile) - 1;
    const endX = Math.floor((state.camera.x + state.width / 2) / tile) + 1;
    const startY = Math.floor((state.camera.y - state.height / 2) / tile) - 1;
    const endY = Math.floor((state.camera.y + state.height / 2) / tile) + 1;
    for (let gx = startX; gx <= endX; gx++) {
      for (let gy = startY; gy <= endY; gy++) {
        const x = gx * tile - state.camera.x + state.width / 2;
        const y = gy * tile - state.camera.y + state.height / 2;
        const h = hash(gx, gy);
        drawFloorTile(x, y, tile, h, palette);
        if (h > 0.82) {
          ctx.fillStyle = `${palette[2]}33`;
          ctx.beginPath();
          ctx.ellipse(x + tile * 0.35, y + tile * 0.52, 22, 5, h * TAU, 0, TAU);
          ctx.fill();
        }
      }
    }
    // 微弱网格线
    ctx.strokeStyle = "rgba(255,255,255,0.02)";
    ctx.lineWidth = 0.5;
    ctx.beginPath();
    for (let gx = startX; gx <= endX + 1; gx++) {
      const x = gx * tile - state.camera.x + state.width / 2;
      ctx.moveTo(x, 0);
      ctx.lineTo(x, state.height);
    }
    for (let gy = startY; gy <= endY + 1; gy++) {
      const y = gy * tile - state.camera.y + state.height / 2;
      ctx.moveTo(0, y);
      ctx.lineTo(state.width, y);
    }
    ctx.stroke();
    ctx.lineWidth = 1;

    // 环境尘埃粒子
    drawAmbientDust();
  }

  function drawChapterNebula(chapterIdx, t, palette) {
    // 根据章节 ID 选择不同色调的星云
    const themeIdx = Math.floor(chapterIdx / 5) % 6;
    const nebulaConfigs = [
      // 银雾 - 冷蓝绿
      { colors: ["rgba(94,232,184,0.02)", "rgba(90,160,255,0.015)", "rgba(144,112,240,0.01)"] },
      // 赤岩 - 暖红橙
      { colors: ["rgba(232,56,74,0.02)", "rgba(255,128,48,0.015)", "rgba(240,192,64,0.01)"] },
      // 幽暗 - 深紫
      { colors: ["rgba(144,112,240,0.025)", "rgba(94,232,184,0.01)", "rgba(232,56,74,0.01)"] },
      // 冰原 - 青蓝
      { colors: ["rgba(90,160,255,0.02)", "rgba(94,232,184,0.015)", "rgba(255,255,255,0.008)"] },
      // 熔火 - 红金
      { colors: ["rgba(255,128,48,0.02)", "rgba(240,192,64,0.015)", "rgba(232,56,74,0.015)"] },
      // 虚空 - 暗紫绿
      { colors: ["rgba(144,112,240,0.02)", "rgba(42,24,72,0.03)", "rgba(94,232,184,0.01)"] }
    ];
    const config = nebulaConfigs[themeIdx] || nebulaConfigs[0];

    ctx.save();
    for (let i = 0; i < 3; i++) {
      // 跟随相机缓慢漂移
      const driftX = Math.sin(t * 0.12 + i * 2.1) * 80;
      const driftY = Math.cos(t * 0.09 + i * 1.7) * 50;
      const nx = state.width * (0.25 + i * 0.25) + driftX;
      const ny = state.height * (0.3 + i * 0.2) + driftY;
      const nr = 180 + i * 60;
      const grd = ctx.createRadialGradient(nx, ny, 0, nx, ny, nr);
      grd.addColorStop(0, config.colors[i]);
      grd.addColorStop(1, "transparent");
      ctx.fillStyle = grd;
      ctx.fillRect(0, 0, state.width, state.height);
    }
    ctx.restore();
  }

  function drawAmbientDust() {
    const t = performance.now() / 1000;
    ctx.save();
    const dustColors = ["#f4c95d", "#7fe0c4", "#a98cff", "#ff9658", "#5ea0ff"];
    for (let i = 0; i < 25; i++) {
      // 在视口周围散布尘埃
      const baseX = state.camera.x + (((i * 173 + 37) % 700) - 350);
      const baseY = state.camera.y + (((i * 271 + 59) % 500) - 250);
      const drift = Math.sin(t * 0.25 + i * 2.1) * 35;
      const px = baseX + drift - state.camera.x + state.width / 2;
      const py = baseY + Math.cos(t * 0.18 + i * 1.7) * 20 - state.camera.y + state.height / 2;
      const flicker = Math.sin(t * 1.0 + i * 3.7) * 0.5 + 0.5;
      ctx.globalAlpha = 0.03 + flicker * 0.07;
      ctx.fillStyle = dustColors[i % dustColors.length];
      ctx.shadowColor = ctx.fillStyle;
      ctx.shadowBlur = 3 + flicker * 3;
      const sz = 1.2 + (i % 4) * 0.4;
      ctx.fillRect(px, py, sz, sz);
    }
    ctx.shadowBlur = 0;
    ctx.restore();
  }

  function drawMenuScene() {
    const t = performance.now() / 1000;
    ctx.save();

    // 深空星云背景
    const nebulaColors = ["rgba(144,112,240,0.03)", "rgba(94,232,184,0.02)", "rgba(240,192,64,0.02)"];
    for (let i = 0; i < 3; i++) {
      const nx = state.width * (0.3 + i * 0.2) + Math.sin(t * 0.15 + i * 2) * 40;
      const ny = state.height * 0.4 + Math.cos(t * 0.1 + i * 3) * 30;
      const nr = 200 + i * 60;
      const grd = ctx.createRadialGradient(nx, ny, 0, nx, ny, nr);
      grd.addColorStop(0, nebulaColors[i]);
      grd.addColorStop(1, "transparent");
      ctx.fillStyle = grd;
      ctx.fillRect(0, 0, state.width, state.height);
    }

    // 背景星群 — 多层闪烁
    for (let i = 0; i < 80; i++) {
      const a = i * 0.618 + t * 0.08;
      const r = 60 + i * 12;
      const x = state.width / 2 + Math.cos(a) * r;
      const y = state.height / 2 + Math.sin(a * 0.55) * r * 0.3;
      const size = 1.5 + (i % 5) * 0.6;
      const twinkle = Math.sin(t * 1.5 + i * 1.7) * 0.5 + 0.5;
      const alpha = 0.08 + twinkle * 0.2;
      ctx.globalAlpha = alpha;
      const colors = ["#f4c95d", "#7fe0c4", "#a98cff", "#ff9658", "#5ea0ff"];
      ctx.fillStyle = colors[i % colors.length];
      ctx.shadowColor = ctx.fillStyle;
      ctx.shadowBlur = 6 + twinkle * 6;
      ctx.beginPath();
      ctx.arc(x, y, size, 0, TAU);
      ctx.fill();
    }

    // 外围光晕环
    const moonX = state.width / 2;
    const moonY = state.height / 2 - 30;
    const moonR = 55 + Math.sin(t * 0.4) * 4;

    // 月冕辉光
    const coronaR = moonR * 2.2;
    const corona = ctx.createRadialGradient(moonX, moonY, moonR * 0.6, moonX, moonY, coronaR);
    corona.addColorStop(0, "rgba(240,192,64,0.08)");
    corona.addColorStop(0.4, "rgba(240,192,64,0.03)");
    corona.addColorStop(1, "transparent");
    ctx.globalAlpha = 0.6 + Math.sin(t * 0.7) * 0.15;
    ctx.fillStyle = corona;
    ctx.beginPath();
    ctx.arc(moonX, moonY, coronaR, 0, TAU);
    ctx.fill();

    // 月亮主体
    ctx.globalAlpha = 0.22 + Math.sin(t * 0.3) * 0.04;
    ctx.shadowColor = "#f4c95d";
    ctx.shadowBlur = 80;
    ctx.fillStyle = "#f4c95d";
    ctx.beginPath();
    ctx.arc(moonX, moonY, moonR, 0, TAU);
    ctx.fill();

    // 月亮内核亮度
    ctx.globalAlpha = 0.12;
    ctx.shadowBlur = 30;
    ctx.fillStyle = "#fff8e0";
    ctx.beginPath();
    ctx.arc(moonX - moonR * 0.15, moonY - moonR * 0.1, moonR * 0.4, 0, TAU);
    ctx.fill();

    // 月蚀遮罩
    ctx.shadowBlur = 0;
    ctx.globalCompositeOperation = "destination-out";
    ctx.fillStyle = "rgba(0,0,0,1)";
    ctx.beginPath();
    ctx.arc(moonX + moonR * 0.42, moonY - moonR * 0.08, moonR * 0.8, 0, TAU);
    ctx.fill();
    ctx.globalCompositeOperation = "source-over";

    // 蚀边辉光
    ctx.globalAlpha = 0.15 + Math.sin(t * 1.2) * 0.05;
    ctx.strokeStyle = "#f4c95d";
    ctx.shadowColor = "#f4c95d";
    ctx.shadowBlur = 12;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(moonX + moonR * 0.42, moonY - moonR * 0.08, moonR * 0.8, 0, TAU);
    ctx.stroke();
    ctx.shadowBlur = 0;
    ctx.lineWidth = 1;

    // 环绕粒子 — 双层轨道
    for (let ring = 0; ring < 2; ring++) {
      const count = ring === 0 ? 24 : 14;
      const speed = ring === 0 ? 0.3 : -0.18;
      const baseR = moonR + 18 + ring * 16;
      for (let i = 0; i < count; i++) {
        const orbitA = i / count * TAU + t * speed;
        const wobble = Math.sin(t * 1.8 + i * 2.3 + ring * 5) * 6;
        const orbitR = baseR + wobble;
        const px = moonX + Math.cos(orbitA) * orbitR;
        const py = moonY + Math.sin(orbitA) * orbitR * 0.45;
        const twinkle = Math.sin(t * 2.5 + i * 1.3) * 0.5 + 0.5;
        ctx.globalAlpha = 0.15 + twinkle * 0.25;
        ctx.fillStyle = ring === 0 ? "#f4c95d" : "#a98cff";
        ctx.shadowColor = ctx.fillStyle;
        ctx.shadowBlur = 4 + twinkle * 4;
        const sz = ring === 0 ? 1.8 : 2.2;
        ctx.beginPath();
        ctx.arc(px, py, sz, 0, TAU);
        ctx.fill();
      }
    }

    // 极光波动带
    ctx.shadowBlur = 0;
    ctx.globalAlpha = 0.035 + Math.sin(t * 0.3) * 0.015;
    const auroraGrd = ctx.createLinearGradient(0, state.height * 0.65, state.width, state.height * 0.8);
    auroraGrd.addColorStop(0, "rgba(94,232,184,0)");
    auroraGrd.addColorStop(0.3, "rgba(94,232,184,0.5)");
    auroraGrd.addColorStop(0.5, "rgba(144,112,240,0.4)");
    auroraGrd.addColorStop(0.7, "rgba(90,160,255,0.3)");
    auroraGrd.addColorStop(1, "rgba(240,192,64,0)");
    ctx.fillStyle = auroraGrd;
    for (let i = 0; i < 3; i++) {
      const yOff = Math.sin(t * 0.4 + i * 1.5) * 20;
      ctx.fillRect(0, state.height * (0.62 + i * 0.04) + yOff, state.width, 30);
    }

    // 远处小星 — 静态散布
    for (let i = 0; i < 30; i++) {
      const sx = ((i * 137 + 50) % state.width);
      const sy = ((i * 211 + 80) % (state.height * 0.6));
      const flicker = Math.sin(t * 0.8 + i * 3.1) * 0.3 + 0.4;
      ctx.globalAlpha = flicker * 0.25;
      ctx.fillStyle = i % 4 === 0 ? "#f4c95d" : "#c8c0b0";
      ctx.fillRect(sx, sy, 1.5, 1.5);
    }

    ctx.restore();
  }

  function drawPlayers() {
    for (const member of state.room.members) {
      const hero = state.meta.heroes[member.hero];
      const s = smoothPos("member", member);
      const p = world(s.x, s.y);
      ctx.save();
      ctx.globalAlpha = member.eliminated ? 0.25 : member.connected ? 1 : 0.62;
      if (member.downed) ctx.globalAlpha *= 0.65;

      // 移动光尾 — 多层拖影
      if (member.key === state.you && !member.downed && !member.eliminated) {
        const inputMag = Math.hypot(state.input.x, state.input.y);
        if (inputMag > 0.3) {
          for (let trail = 2; trail >= 0; trail--) {
            const offset = (trail + 1) * 10;
            const trailAlpha = 0.06 * inputMag * (3 - trail) / 3;
            ctx.globalAlpha = trailAlpha;
            ctx.fillStyle = hero.color;
            ctx.shadowColor = hero.color;
            ctx.shadowBlur = 16 - trail * 4;
            ctx.beginPath();
            ctx.arc(p.x - state.input.x * offset, p.y - state.input.y * offset, 14 - trail * 3, 0, TAU);
            ctx.fill();
          }
          ctx.globalAlpha = member.eliminated ? 0.25 : member.connected ? 1 : 0.62;
        }
      }

      drawCharacterSprite(member.hero, p.x, p.y, 2.9, hero.color);

      // 名字带阴影
      ctx.fillStyle = member.key === state.you ? "#ffffff" : "#f6f0dc";
      ctx.font = "800 12px Microsoft YaHei, sans-serif";
      ctx.textAlign = "center";
      ctx.shadowColor = "rgba(0,0,0,0.8)";
      ctx.shadowBlur = 4;
      ctx.fillText(member.username, p.x, p.y - 34);
      ctx.shadowBlur = 0;

      // 血条
      const hpPct = member.hp / member.maxHp;
      const hpColor = hpPct < 0.25 ? "#d3424f" : hpPct < 0.5 ? "#ff9658" : member.downed ? "#f4c95d" : "#7fe0c4";
      drawBar(p.x - 22, p.y + 28, 44, 5, hpPct, hpColor);

      // 低血量警告
      if (hpPct < 0.25 && !member.downed && member.key === state.you) {
        ctx.globalAlpha = 0.3 + Math.sin(performance.now() / 200) * 0.15;
        ctx.strokeStyle = "#d3424f";
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(p.x, p.y, 28, 0, TAU);
        ctx.stroke();
      }

      if (member.downed) {
        const pulse = Math.sin(performance.now() / 300) * 0.3 + 0.7;
        ctx.globalAlpha = pulse;
        ctx.fillStyle = "#f4c95d";
        ctx.font = "800 12px Microsoft YaHei, sans-serif";
        ctx.fillText("倒地", p.x, p.y + 44);
      }
      ctx.restore();
    }
  }

  function drawEnemies() {
    const t = performance.now() / 1000;
    const affixes = state.room?.chapter?.affixes || [];
    const glassCannon = affixes.includes("glassCannon");
    const thickSkin = affixes.includes("thickSkin");
    const enemies = [...state.room.enemies].sort((a, b) => a.y - b.y);
    for (const enemy of enemies) {
      const s = smoothPos("enemy", enemy);
      const p = world(s.x, s.y);
      if (p.x < -80 || p.y < -80 || p.x > state.width + 80 || p.y > state.height + 80) continue;
      let size = enemy.boss ? 86 : enemy.radius * 2.5;
      if (glassCannon && !enemy.boss) size *= 0.85;

      // 地面阴影
      ctx.save();
      ctx.globalAlpha = 0.2;
      ctx.fillStyle = "#000";
      ctx.beginPath();
      ctx.ellipse(p.x, p.y + enemy.radius + 4, enemy.radius * 0.7, enemy.radius * 0.2, 0, 0, TAU);
      ctx.fill();
      ctx.restore();

      drawEnemySprite(enemy, p.x, p.y, size);
      ctx.save();
      if (glassCannon && !enemy.boss) ctx.globalAlpha = 0.75;
      ctx.fillStyle = enemy.color;
      ctx.shadowColor = enemy.color;
      ctx.shadowBlur = enemy.boss ? 24 : 12;
      if (enemy.boss) {
        // Boss 光环
        ctx.globalAlpha = 0.08 + Math.sin(t * 2) * 0.03;
        ctx.beginPath();
        ctx.arc(p.x, p.y, enemy.radius + 12 + Math.sin(t * 3) * 4, 0, TAU);
        ctx.fill();
        ctx.globalAlpha = 1;
        ctx.beginPath();
        for (let i = 0; i < 8; i++) {
          const a = i / 8 * TAU + performance.now() / 1200;
          ctx.lineTo(p.x + Math.cos(a) * enemy.radius, p.y + Math.sin(a) * enemy.radius);
        }
        ctx.closePath();
        ctx.fill();
      } else {
        ctx.beginPath();
        ctx.ellipse(p.x, p.y, enemy.radius * 0.82, enemy.radius * 1.05, 0, 0, TAU);
        ctx.fill();
      }
      ctx.shadowBlur = 0;
      // 厚甲暗色轮廓
      if (thickSkin && !enemy.boss) {
        ctx.strokeStyle = "rgba(100,90,130,0.5)";
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.ellipse(p.x, p.y, enemy.radius * 0.9, enemy.radius * 1.12, 0, 0, TAU);
        ctx.stroke();
      }
      drawBar(p.x - enemy.radius, p.y + enemy.radius + 8, enemy.radius * 2, 5, enemy.hp / enemy.maxHp, enemy.boss ? "#f4c95d" : "#d3424f");
      if (enemy.boss) {
        ctx.fillStyle = "#f6f0dc";
        ctx.shadowColor = "rgba(0,0,0,0.8)";
        ctx.shadowBlur = 4;
        ctx.font = "800 14px Microsoft YaHei, sans-serif";
        ctx.textAlign = "center";
        ctx.fillText(enemy.name, p.x, p.y - enemy.radius - 16);
      }
      ctx.restore();
    }
  }

  function drawProjectiles() {
    for (const shot of state.room.projectiles) {
      const s = smoothPos("projectile", shot);
      const p = world(s.x, s.y);
      // 拖尾光效
      ctx.save();
      ctx.globalAlpha = 0.15;
      ctx.fillStyle = shot.color;
      ctx.shadowColor = shot.color;
      ctx.shadowBlur = 16;
      ctx.beginPath();
      ctx.arc(p.x - (shot.vx || 0) * 0.04, p.y - (shot.vy || 0) * 0.04, shot.r * 1.6, 0, TAU);
      ctx.fill();
      ctx.globalAlpha = 1;
      ctx.shadowBlur = 14;
      ctx.beginPath();
      ctx.arc(p.x, p.y, shot.r, 0, TAU);
      ctx.fill();
      // 内核高光
      ctx.globalAlpha = 0.5;
      ctx.fillStyle = "#fff";
      ctx.shadowBlur = 0;
      ctx.beginPath();
      ctx.arc(p.x, p.y, shot.r * 0.35, 0, TAU);
      ctx.fill();
      ctx.restore();
    }
    for (const shot of state.room.enemyShots) {
      const s = smoothPos("enemyShot", shot);
      const p = world(s.x, s.y);
      ctx.save();
      ctx.globalAlpha = 0.12;
      ctx.fillStyle = shot.color;
      ctx.shadowColor = shot.color;
      ctx.shadowBlur = 14;
      ctx.beginPath();
      ctx.arc(p.x, p.y, shot.r * 1.5, 0, TAU);
      ctx.fill();
      ctx.globalAlpha = 1;
      ctx.shadowBlur = 12;
      ctx.beginPath();
      ctx.arc(p.x, p.y, shot.r, 0, TAU);
      ctx.fill();
      ctx.restore();
    }
    ctx.shadowBlur = 0;
  }

  function drawPickups() {
    const t = performance.now() / 1000;
    for (const pickup of state.room.pickups) {
      const s = smoothPos("pickup", pickup);
      const p = world(s.x, s.y);
      // 上下悬浮动画
      const bob = Math.sin(t * 2.5 + s.x * 0.01 + s.y * 0.01) * 4;
      const py = p.y + bob;
      // 外圈光晕
      ctx.save();
      ctx.globalAlpha = 0.08 + Math.sin(t * 3 + s.x) * 0.04;
      ctx.fillStyle = pickup.color;
      ctx.shadowColor = pickup.color;
      ctx.shadowBlur = 30;
      ctx.beginPath();
      ctx.arc(p.x, py, pickup.r * 2.5, 0, TAU);
      ctx.fill();
      ctx.restore();

      if (pickup.type === "heart" && state.images.heart?.complete && state.images.heart.naturalWidth) {
        ctx.drawImage(state.images.heart, p.x - 18, py - 18, 36, 36);
      } else {
        const tile = pickup.type === "heart" ? tileMap.heart : tileMap.chest;
        drawTile(tile, p.x - 18, py - 18, 36);
      }
      ctx.fillStyle = pickup.color;
      ctx.shadowColor = pickup.color;
      ctx.shadowBlur = 16;
      ctx.beginPath();
      if (pickup.type === "heart") ctx.arc(p.x, py, pickup.r, 0, TAU);
      else ctx.rect(p.x - pickup.r, py - pickup.r, pickup.r * 2, pickup.r * 2);
      ctx.fill();
      ctx.shadowBlur = 0;
      ctx.fillStyle = "#15100a";
      ctx.font = "800 13px Microsoft YaHei, sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(pickup.type === "heart" ? "♥" : "▣", p.x, py + 1);
    }
  }

  function drawHazards() {
    for (const hazard of state.room.hazards) {
      const s = smoothPos("hazard", hazard);
      const p = world(s.x, s.y);
      ctx.save();
      ctx.globalAlpha = hazard.arm > 0 ? 0.25 : 0.48;
      ctx.fillStyle = hazard.color;
      ctx.strokeStyle = hazard.color;
      ctx.shadowColor = hazard.color;
      ctx.shadowBlur = 18;
      ctx.beginPath();
      ctx.arc(p.x, p.y, hazard.r, 0, TAU);
      ctx.fill();
      ctx.globalAlpha = 0.9;
      ctx.lineWidth = hazard.type === "share" ? 4 : 2;
      ctx.stroke();
      ctx.restore();
    }
  }

  function drawEffects() {
    for (const effect of state.room.effects) {
      const p = world(effect.x, effect.y);
      const progress = 1 - effect.life / 0.6;
      const radius = progress * 52;
      ctx.save();

      if (effect.type === "spark") {
        // 闪电/火花效果 — 向四周放射
        const alpha = Math.max(0, effect.life / 0.6);
        ctx.globalAlpha = alpha;
        ctx.strokeStyle = effect.color;
        ctx.shadowColor = effect.color;
        ctx.shadowBlur = 16;
        ctx.lineWidth = 2;
        for (let i = 0; i < 6; i++) {
          const a = i / 6 * TAU + progress * 1.5;
          const len = 10 + progress * 30;
          ctx.beginPath();
          ctx.moveTo(p.x, p.y);
          const mx = p.x + Math.cos(a + 0.2) * len * 0.6;
          const my = p.y + Math.sin(a + 0.2) * len * 0.6;
          ctx.lineTo(mx, my);
          ctx.lineTo(p.x + Math.cos(a) * len, p.y + Math.sin(a) * len);
          ctx.stroke();
        }
        // 中心闪点
        ctx.globalAlpha = alpha * 0.6;
        ctx.fillStyle = "#fff";
        ctx.beginPath();
        ctx.arc(p.x, p.y, 3 + (1 - progress) * 4, 0, TAU);
        ctx.fill();
      } else {
        // 默认：扩散圆环
        ctx.globalAlpha = Math.max(0, effect.life / 0.6) * 0.8;
        ctx.strokeStyle = effect.color;
        ctx.shadowColor = effect.color;
        ctx.shadowBlur = 12;
        ctx.lineWidth = 3 + (1 - progress) * 2;
        ctx.beginPath();
        ctx.arc(p.x, p.y, radius, 0, TAU);
        ctx.stroke();
        // 内圈微光
        ctx.globalAlpha = Math.max(0, effect.life / 0.6) * 0.25;
        ctx.fillStyle = effect.color;
        ctx.beginPath();
        ctx.arc(p.x, p.y, radius * 0.5, 0, TAU);
        ctx.fill();
      }
      ctx.restore();
    }
  }

  function drawVignette() {
    // 主暗角
    const grd = ctx.createRadialGradient(
      state.width / 2, state.height / 2, state.width * 0.28,
      state.width / 2, state.height / 2, state.width * 0.72
    );
    grd.addColorStop(0, "transparent");
    grd.addColorStop(0.6, "rgba(0,0,0,0.15)");
    grd.addColorStop(1, "rgba(0,0,0,0.45)");
    ctx.fillStyle = grd;
    ctx.fillRect(0, 0, state.width, state.height);

    // 顶部微紫渐变
    const topGrd = ctx.createLinearGradient(0, 0, 0, state.height * 0.25);
    topGrd.addColorStop(0, "rgba(42,24,72,0.08)");
    topGrd.addColorStop(1, "transparent");
    ctx.fillStyle = topGrd;
    ctx.fillRect(0, 0, state.width, state.height * 0.25);

    // 低血量红色警告边框
    const you = state.room?.members?.find(m => m.key === state.you);
    if (you && !you.downed && !you.eliminated) {
      const hpPct = you.hp / you.maxHp;
      if (hpPct < 0.5) {
        const t = performance.now();
        // 心跳脉冲：低血越严重，频率越快
        const beatSpeed = hpPct < 0.15 ? 250 : hpPct < 0.25 ? 350 : 500;
        const beat = Math.pow(Math.sin(t / beatSpeed * Math.PI), 4);
        const baseAlpha = (1 - hpPct / 0.5) * 0.3;
        const alpha = baseAlpha * (0.5 + beat * 0.5);
        const borderGrd = ctx.createRadialGradient(
          state.width / 2, state.height / 2, state.width * 0.3,
          state.width / 2, state.height / 2, state.width * 0.72
        );
        borderGrd.addColorStop(0, "transparent");
        borderGrd.addColorStop(0.65, "transparent");
        borderGrd.addColorStop(1, `rgba(211,66,79,${alpha})`);
        ctx.fillStyle = borderGrd;
        ctx.fillRect(0, 0, state.width, state.height);
      }
    }
  }

  function drawFlash() {
    if (flash.alpha <= 0) return;
    ctx.save();
    ctx.globalAlpha = flash.alpha;
    ctx.fillStyle = flash.color;
    ctx.fillRect(0, 0, state.width, state.height);
    ctx.restore();
  }

  function drawKillStreakHud() {
    if (killStreak.display <= 0 || killStreak.count < 2) return;
    const alpha = Math.min(1, killStreak.display);
    const scale = 1 + Math.max(0, killStreak.display - 1) * 0.15;
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    const x = state.width / 2;
    const y = state.height * 0.35;

    // 背光
    ctx.shadowColor = killStreak.count >= 10 ? "#d3424f" : killStreak.count >= 5 ? "#ff9658" : "#f4c95d";
    ctx.shadowBlur = 20;
    ctx.fillStyle = ctx.shadowColor;
    ctx.font = `900 ${Math.round(36 * scale)}px Microsoft YaHei, sans-serif`;
    ctx.fillText(`${killStreak.count} 连斩!`, x, y);

    // 副文字
    ctx.shadowBlur = 0;
    ctx.globalAlpha = alpha * 0.7;
    ctx.fillStyle = "#f6f0dc";
    ctx.font = "700 14px Microsoft YaHei, sans-serif";
    const labels = ["", "", "双杀", "三杀", "四杀", "五杀", "", "", "", "", "十连斩!"];
    const label = killStreak.count >= 10 ? "十连斩!" : labels[killStreak.count] || `${killStreak.count} 连斩`;
    ctx.fillText(label, x, y + 28);

    ctx.restore();
  }

  function drawBossBar() {
    if (!state.room) return;
    const boss = state.room.enemies.find(e => e.boss);
    if (!boss) return;
    const t = performance.now() / 1000;
    const barW = Math.min(360, state.width * 0.4);
    const barH = 12;
    const x = (state.width - barW) / 2;
    const y = state.height * 0.88;
    const pct = clamp(boss.hp / boss.maxHp, 0, 1);

    ctx.save();
    // 背景暗层
    ctx.fillStyle = "rgba(0,0,0,0.5)";
    if (ctx.roundRect) {
      ctx.beginPath();
      ctx.roundRect(x - 8, y - 22, barW + 16, barH + 34, 10);
      ctx.fill();
    } else {
      ctx.fillRect(x - 8, y - 22, barW + 16, barH + 34);
    }

    // Boss 名字
    ctx.textAlign = "center";
    ctx.fillStyle = "#f4c95d";
    ctx.shadowColor = "rgba(240,192,64,0.5)";
    ctx.shadowBlur = 8;
    ctx.font = "800 13px Microsoft YaHei, sans-serif";
    ctx.fillText(boss.name || "首领", state.width / 2, y - 8);
    ctx.shadowBlur = 0;

    // 血条背景
    const r = barH / 2;
    ctx.fillStyle = "rgba(0,0,0,0.6)";
    if (ctx.roundRect) {
      ctx.beginPath();
      ctx.roundRect(x, y, barW, barH, r);
      ctx.fill();
    } else {
      ctx.fillRect(x, y, barW, barH);
    }

    // 血条填充
    if (pct > 0) {
      const pw = Math.max(barW * pct, r * 2);
      const pulse = pct < 0.3 ? Math.sin(t * 4) * 0.3 + 0.7 : 1;
      ctx.save();
      ctx.globalAlpha = pulse;
      ctx.fillStyle = pct < 0.3 ? "#d3424f" : pct < 0.6 ? "#ff9658" : "#f4c95d";
      ctx.shadowColor = ctx.fillStyle;
      ctx.shadowBlur = 10;
      if (ctx.roundRect) {
        ctx.beginPath();
        ctx.roundRect(x, y, pw, barH, r);
        ctx.fill();
      } else {
        ctx.fillRect(x, y, pw, barH);
      }
      ctx.restore();
    }

    // 百分比文字
    ctx.fillStyle = "#fff";
    ctx.font = "800 10px Microsoft YaHei, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(`${Math.round(pct * 100)}%`, state.width / 2, y + barH + 8);

    ctx.restore();
  }

  function drawDamageNumbers() {
    for (const d of damageNumbers) {
      const p = world(d.x, d.y);
      const alpha = Math.max(0, d.life / d.maxLife);
      const rise = (1 - d.life / d.maxLife) * 20;
      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.textAlign = "center";
      ctx.fillStyle = d.color;
      ctx.shadowColor = d.color;
      ctx.shadowBlur = d.big ? 12 : 6;
      const size = d.big ? 18 : 13;
      ctx.font = `900 ${size}px Microsoft YaHei, sans-serif`;
      ctx.fillText(d.value, p.x + d.offsetX, p.y - rise);
      ctx.restore();
    }
  }

  function drawFloorTile(x, y, size, h, palette) {
    ctx.fillStyle = h > 0.58 ? palette[1] : palette[0];
    ctx.fillRect(x, y, size + 1, size + 1);
    // 微妙的亮度变化
    if (h > 0.7) {
      ctx.fillStyle = "rgba(255,255,255,0.008)";
      ctx.fillRect(x, y, size + 1, size + 1);
    }
    // 草/碎屑装饰
    ctx.fillStyle = h > 0.5 ? "rgba(244, 201, 93, 0.08)" : `${palette[2]}14`;
    const px = x + 8 + (h * 53 % 70);
    const py = y + 10 + (h * 97 % 68);
    ctx.fillRect(px, py, 18, 5);
    ctx.fillRect(px + 4, py - 4, 5, 14);
    // 额外装饰点
    if (h > 0.62 && h < 0.72) {
      ctx.fillStyle = `${palette[2]}18`;
      const dx = x + (h * 71 % 60) + 10;
      const dy = y + (h * 53 % 60) + 10;
      ctx.fillRect(dx, dy, 3, 3);
    }
    // 大型装饰
    if (h > 0.76) {
      ctx.fillStyle = `${palette[2]}2f`;
      ctx.beginPath();
      ctx.ellipse(x + size * 0.55, y + size * 0.48, 24, 7, h * TAU, 0, TAU);
      ctx.fill();
    }
  }

  function drawCharacterSprite(heroId, x, y, scale, glow) {
    const image = heroId === "mara"
      ? state.images.samuraiBlue
      : heroId === "noct" || heroId === "sera"
        ? state.images.samuraiGreen
        : state.images.ninja;
    if (!image?.complete || !image.naturalWidth) {
      drawFallbackHero(x, y, glow);
      return;
    }
    const frameW = 16;
    const frameH = 16;
    const col = Math.floor(performance.now() / 130) % 4;
    const row = heroId === "noct" ? 4 : heroId === "mara" ? 1 : heroId === "sera" ? 2 : 0;
    const drawW = frameW * scale;
    const drawH = frameH * scale;
    ctx.save();
    ctx.shadowColor = glow;
    ctx.shadowBlur = 12;
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(image, col * frameW, row * frameH, frameW, frameH, x - drawW / 2, y - drawH / 2 - 4, drawW, drawH);
    ctx.restore();
  }

  function drawEnemySprite(enemy, x, y, size) {
    if (!enemy.boss && state.images.pig?.complete && state.images.pig.naturalWidth && (enemy.type === "bat" || enemy.type === "husk")) {
      const frame = Math.floor(performance.now() / 180) % 2;
      ctx.save();
      ctx.imageSmoothingEnabled = false;
      ctx.shadowColor = enemy.color;
      ctx.shadowBlur = 10;
      ctx.drawImage(state.images.pig, frame * 16, 0, 16, 16, x - size / 2, y - size / 2, size, size);
      ctx.restore();
      return;
    }
    if ((enemy.boss || enemy.type === "brute" || enemy.type === "spitter") && state.images.samuraiBlue?.complete && state.images.samuraiBlue.naturalWidth) {
      const frameW = 16;
      const frameH = 16;
      const col = Math.floor(performance.now() / 160) % 4;
      const row = enemy.boss ? 5 : enemy.type === "spitter" ? 3 : 1;
      const drawSize = enemy.boss ? size : size * 1.15;
      ctx.save();
      ctx.imageSmoothingEnabled = false;
      ctx.shadowColor = enemy.color;
      ctx.shadowBlur = enemy.boss ? 20 : 10;
      ctx.drawImage(state.images.samuraiBlue, col * frameW, row * frameH, frameW, frameH, x - drawSize / 2, y - drawSize / 2, drawSize, drawSize);
      ctx.restore();
      return;
    }
    drawTile(enemy.tile, x - size / 2, y - size / 2, size);
  }

  function drawFallbackHero(x, y, color) {
    ctx.fillStyle = color;
    ctx.shadowColor = color;
    ctx.shadowBlur = 14;
    ctx.beginPath();
    ctx.moveTo(x, y - 24);
    ctx.lineTo(x + 18, y + 14);
    ctx.lineTo(x, y + 24);
    ctx.lineTo(x - 18, y + 14);
    ctx.closePath();
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.fillStyle = "#0d0d12";
    ctx.beginPath();
    ctx.arc(x, y - 2, 8, 0, TAU);
    ctx.fill();
  }

  function drawTile(index, x, y, size) {
    const sheet = state.images.sheet;
    if (!sheet?.complete || !sheet.naturalWidth) return;
    const tile = 16;
    const margin = 1;
    const cols = Math.floor((sheet.naturalWidth - margin) / (tile + margin));
    const sx = margin + (index % cols) * (tile + margin);
    const sy = margin + Math.floor(index / cols) * (tile + margin);
    if (sx + tile > sheet.naturalWidth || sy + tile > sheet.naturalHeight) return;
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(sheet, sx, sy, tile, tile, x, y, size, size);
  }

  function drawBar(x, y, w, h, pct, color) {
    const clamped = clamp(pct, 0, 1);
    const r = h / 2;
    ctx.fillStyle = "rgba(0,0,0,0.6)";
    if (ctx.roundRect) {
      ctx.beginPath();
      ctx.roundRect(x, y, w, h, r);
      ctx.fill();
    } else {
      ctx.fillRect(x, y, w, h);
    }
    if (clamped > 0) {
      ctx.save();
      ctx.shadowColor = color;
      ctx.shadowBlur = 6;
      ctx.fillStyle = color;
      const pw = Math.max(w * clamped, r * 2);
      if (ctx.roundRect) {
        ctx.beginPath();
        ctx.roundRect(x, y, pw, h, r);
        ctx.fill();
      } else {
        ctx.fillRect(x, y, pw, h);
      }
      ctx.restore();
    }
  }

  function world(x, y) {
    return {
      x: x - state.camera.x + state.width / 2,
      y: y - state.camera.y + state.height / 2
    };
  }

  function hash(x, y) {
    let n = x * 374761393 + y * 668265263;
    n = (n ^ (n >> 13)) * 1274126177;
    return ((n ^ (n >> 16)) >>> 0) / 4294967295;
  }

  function formatTime(seconds) {
    const total = Math.max(0, Math.floor(seconds || 0));
    return `${String(Math.floor(total / 60)).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`;
  }

  function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
  }

  function toast(text, type = "") {
    const el = document.createElement("div");
    el.className = `toast${type ? " " + type : ""}`;
    el.textContent = text;
    ui.toastStack.appendChild(el);
    setTimeout(() => {
      el.style.transition = "opacity 0.3s, transform 0.3s";
      el.style.opacity = "0";
      el.style.transform = "translateX(20px)";
      setTimeout(() => el.remove(), 300);
    }, 2400);
  }

  init().catch(error => {
    toast(error.message || "启动失败");
    console.error(error);
  });
})();
