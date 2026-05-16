# store.json 数据结构说明

文件路径：`data/store.json`
加载时机：服务端启动时 `loadStore()` 读取，运行中关键操作后 `saveStore()` 写入
存储方式：原子写入（先写 `.tmp` 再 `rename`），防止损坏

---

## 顶层结构

```json
{
  "users": {},
  "usernameIndex": {},
  "sessions": {},
  "leaderboard": [],
  "verificationCodes": {}
}
```

| 字段 | 类型 | 说明 |
|------|------|------|
| `users` | `Object<UUID, User>` | 所有注册用户，key 为 UUID |
| `usernameIndex` | `Object<lowercase, UUID>` | 用户名→UUID 的反向索引，用于登录查找 |
| `sessions` | `Object<sid, Session>` | 活跃会话，key 为 64 位 hex token |
| `leaderboard` | `LeaderboardEntry[]` | 排行榜，按 score 降序，最多保留 200 条 |
| `verificationCodes` | `Object<email, VerificationCode>` | 待验证的邮箱验证码，5 分钟过期 |

---

## User 对象

```json
{
  "id": "uuid-v4",
  "username": "原始用户名",
  "usernameLower": "用户名小写（用于唯一性检查）",
  "salt": "32位hex（scrypt盐值）",
  "hash": "128位hex（scrypt哈希）",
  "createdAt": 1777542691356,
  "profile": { ... }
}
```

| 字段 | 类型 | 说明 |
|------|------|------|
| `id` | `string` | UUID v4，全局唯一标识 |
| `username` | `string` | 3-18 位中文/字母/数字/下划线 |
| `usernameLower` | `string` | `username.toLowerCase()`，唯一索引 |
| `salt` | `string` | 随机 16 字节 → 32 位 hex |
| `hash` | `string` | `scrypt(password, salt, 64)` → 128 位 hex |
| `createdAt` | `number` | 注册时间戳 (ms) |
| `profile` | `Profile` | 玩家档案（见下） |

---

## Profile 对象

```json
{
  "nickname": "显示昵称",
  "moonDust": 0,
  "talents": { "might": 0, "vitality": 2, ... },
  "unlockedHeroes": ["astrid", "mara", "noct"],
  "unlockedRelics": [],
  "storyProgress": { "unlockedChapter": 1, "cleared": [] },
  "bestScore": 0,
  "lastHero": "astrid",
  "friends": ["uuid1", "uuid2"],
  "friendRequests": { "incoming": ["uuid3"], "outgoing": ["uuid4"] },
  "seen": { "monsters": [], "bosses": [], "chapters": [] },
  "stats": { "runs": 0, "victories": 0, "kills": 0 },
  "achievements": [],
  "coopStats": { "bossKills": 0, "rescues": 0 }
}
```

| 字段 | 类型 | 说明 |
|------|------|------|
| `nickname` | `string` | 游戏内显示名，默认等于 username |
| `moonDust` | `number` | 月尘货币，用于天赋升级 |
| `talents` | `Object<string, number>` | 天赋等级，key 为天赋 ID，value 为当前等级 |
| `unlockedHeroes` | `string[]` | 已解锁英雄 ID，默认 `["astrid", "mara", "noct"]` |
| `unlockedRelics` | `string[]` | 已解锁圣物 ID |
| `storyProgress` | `object` | 故事模式进度 |
| `storyProgress.unlockedChapter` | `number` | 当前解锁到的章节号（从 1 开始） |
| `storyProgress.cleared` | `number[]` | 已通关的章节号列表 |
| `bestScore` | `number` | 历史最高分 |
| `lastHero` | `string` | 上次使用的英雄 ID |
| `friends` | `string[]` | 好友的 user ID 列表 |
| `friendRequests` | `object` | 好友申请 |
| `friendRequests.incoming` | `string[]` | 收到的申请（对方 user ID） |
| `friendRequests.outgoing` | `string[]` | 发出的申请（对方 user ID） |
| `seen` | `object` | 图鉴已解锁条目 |
| `seen.monsters` | `string[]` | 已遇到的怪物 ID |
| `seen.bosses` | `string[]` | 已遇到的 Boss ID |
| `seen.chapters` | `string[]` | 已进入的章节 ID |
| `stats` | `object` | 累计统计 |
| `stats.runs` | `number` | 总游戏次数 |
| `stats.victories` | `number` | 总胜利次数 |
| `stats.kills` | `number` | 总击杀数 |
| `achievements` | `string[]` | 已达成的成就 ID |
| `coopStats` | `object` | 联机专属统计 |
| `coopStats.bossKills` | `number` | 联机 Boss 击杀数 |
| `coopStats.rescues` | `number` | 联机救援队友次数 |

---

## Session 对象

```json
{
  "userId": "uuid-v4",
  "expires": 1778147491356
}
```

| 字段 | 类型 | 说明 |
|------|------|------|
| `userId` | `string` | 关联的用户 ID |
| `expires` | `number` | 过期时间戳，默认 7 天后 |

Session 通过 HTTP Cookie `mes_session` 传递，格式：`HttpOnly; SameSite=Lax; Path=/; Max-Age=604800`

---

## LeaderboardEntry 对象

```json
{
  "mode": "story",
  "username": "玩家昵称",
  "hero": "英雄名",
  "chapter": "章节名",
  "chapterId": 3,
  "score": 3184,
  "kills": 144,
  "time": 127,
  "victory": true,
  "modifiers": ["词条名1", "词条名2"],
  "day": "2026-04-30",
  "at": 1777542691356,
  "weeklySeed": 20260142
}
```

| 字段 | 类型 | 说明 |
|------|------|------|
| `mode` | `string` | `"story"` 或其他模式 |
| `username` | `string` | 玩家昵称 |
| `hero` | `string` | 使用的英雄名 |
| `chapter` | `string` | 章节名 |
| `chapterId` | `number` | 章节编号 |
| `score` | `number` | 得分 |
| `kills` | `number` | 击杀数 |
| `time` | `number` | 用时（秒） |
| `victory` | `boolean` | 是否通关 |
| `modifiers` | `string[]` | 当局激活的词条名列表 |
| `day` | `string` | `"YYYY-MM-DD"` 格式日期 |
| `at` | `number` | 结束时间戳 |
| `weeklySeed` | `number` | 可选，每周挑战的种子值 |

排行榜最多保留 200 条，按 score 降序排列。

---

## VerificationCode 对象

```json
{
  "code": "430848",
  "expires": 1777542991356,
  "lastSent": 1777542691356
}
```

| 字段 | 类型 | 说明 |
|------|------|------|
| `code` | `string` | 6 位数字验证码 |
| `expires` | `number` | 过期时间戳（发送后 5 分钟） |
| `lastSent` | `number` | 上次发送时间（限制 60 秒间隔） |

以 email 为 key，每 60 秒自动清理过期条目（`setInterval` 定时器）。

---

## 数据流

```
注册：username/password/email/code → store.users[id] + store.usernameIndex[key] + store.sessions[sid]
登录：username/password → store.usernameIndex 查找 → store.sessions[sid]
好友：store.users[id].profile.friends / friendRequests
排行：store.leaderboard push → sort → slice(0, 200) → save
天赋：store.users[id].profile.talents[id] += 1（扣除 moonDust）
通关：profile.moonDust += reward / profile.storyProgress / profile.stats 更新
```

## 注意事项

- `store.json` 损坏时会自动备份为 `store.json.broken-<timestamp>`，并重置为空库
- `normalizeProfile()` 在每次读取用户时运行，自动补全缺失字段、修正类型
- 密码哈希使用 `scrypt`（Node.js 内置），不可逆，忘记密码无法恢复
- 验证码邮件通过 QQ 邮箱 SMTP 发送，失败时降级为直接返回验证码
