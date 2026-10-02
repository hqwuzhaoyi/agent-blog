# 07: 后台登录与待确认列表

**What to build:** shadcn-admin 中文布局接入真实审核会话与待确认/已发布列表。

**Blocked by:** 02: React 工作日志阅读页与预览部署.

**Status:** ready-for-agent

**Execution:** completed

- [x] 登录后默认进入待确认，侧栏仅保留业务页面。
- [x] 会话、来源/关键词/状态筛选及有界分页读取真实 D1 数据。
- [x] 审核 Cookie、过期/未登录保护、同源校验与退出流程有效。
- [x] 提交与预览凭据不能读取管理资料或授权审批。
- [x] 390px 下管理导航可用，无 demo 指标/Clerk 账号依赖。

## Comments

2026-10-02 (Sol admin): Implemented real reviewer API/session/list and adapted upstream shadcn-admin MIT table/input/layout structure. SQLite HTTP login/cookie/Origin/filter/page checks pass. Isolated localhost browser login and390px mobile navigation observed. Dependency02 acceptance not yet reported, status retained.

## Integration evidence

2026-10-02: Sol team implementation integrated; TypeScript, 36 tests, isolated runtime HTTP contracts and real browser public/admin workflows passed. Root production preflight verified the canonical D1/R2 bindings and excluded local credentials/audio.
