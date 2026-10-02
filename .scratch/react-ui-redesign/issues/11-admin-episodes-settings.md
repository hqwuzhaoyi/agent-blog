# 11: 后台播客与设置页

**What to build:** 管理实际播客信息，查看站点/订阅设置并退出。

**Blocked by:** 03: 节目详情与持续播放器；07: 后台登录与待确认列表.

**Status:** ready-for-agent

**Execution:** completed

- [x] 节目日期、实测时长、章节、音频/公开链接来自真实存储。
- [x] 不模拟 TTS 进度、收入或服务器监控。
- [x] 展示现有配置与 Theme/语言，保持非动态配置的实际生效说明。
- [x] 提供两种 RSS 入口、外观控制和会话退出，不向客户端暴露密钥。
- [x] 管理接口权限与响应式界面通过 HTTP/浏览器验收。

## Comments

2026-10-02 (Sol admin): Implemented real paginated published episode details and config Theme/language/RSS, local browser appearance control and logout. No demo status/progress or credential response. Dependency03 and final episodes/settings browser acceptance pending.

2026-10-02 (Sol admin): Additional isolated390px browser checks observed actual seeded episode title/date/duration/chapters and page/audio links, settings light/dark/system control and Theme/language/RSS, mobile navigation closes on selection, logout returns login. Dark settings screenshot visually inspected; page width390 matches viewport390. Dependency03 final acceptance remains owned by public team.

## Integration evidence

2026-10-02: Sol team implementation integrated; TypeScript, 36 tests, isolated runtime HTTP contracts and real browser public/admin workflows passed. Root production preflight verified the canonical D1/R2 bindings and excluded local credentials/audio.
