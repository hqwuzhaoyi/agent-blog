# 12: RSS 与自动发布链路兼容

**What to build:** 新 Worker 保留自动发布、订阅与音频协议，内容更新不需应用部署。

**Blocked by:** 02: React 工作日志阅读页与预览部署.

**Status:** ready-for-agent

**Execution:** completed

- [x] 两种 RSS 的 GUID、日期、公开链接、duration 和 enclosure metadata 与基线一致。
- [x] 现有 Hermes/OpenClaw 提交及音频上传命令/身份不变，重试幂等。
- [x] 仅合法已上传音频可发布；公开页面/RSS 随 D1 写入更新。
- [x] GET/HEAD、ETag、正常/后缀/无效 Range 行为保持，RSS 客户端兼容规则保留。
- [x] 使用隔离数据验证，不修改 cron 时间或 Telegram 投递，生产仅做只读检查。

## Comments

2026-10-02: 新增框架无关 `cloudflare/feeds.ts`，每次请求从 D1 已发布指针生成两个 RSS，保留 absolute GUID/permaLink、UTC 日期、原链接、duration 取整和实际 enclosure 长度/MIME。新增真实 SQLite 的 HTTP 发布/订阅测试，验证只读预览之外的显式审批、更新草稿保持旧公开内容、缺失音频拒绝、上传后自动发布与重试幂等、RSS 无需部署更新；与既有发布/音频协议共 3 files / 10 tests 通过。等待新 React Worker dispatch 集成及运行边界验证后完成验收。未修改 cron、Telegram 或生产数据。

2026-10-02: 新 React Worker 的 localhost:3100 运行 HTTP 边界验证通过，`node scripts/verify-react-runtime.mjs --origin http://localhost:3100` 检查初始 SSR/canonical、独立新私有标记、两种实时 RSS、urllib UA 兼容、音频 HEAD/ETag/普通与后缀 Range/416/405/缓存策略，以及现有 producer 上传/提交/重试身份、缺失或长度不符音频拒绝、明确修订审批/审计、新草稿保留旧公开内容与过期 409。额外验证 HttpOnly/Secure/SameSite/Path cookie、非法 Origin 403、无效 session 401 和只读 token/提交密钥无法审批。脚本强制 localhost，使用隔离凭据和1997–1999日期样本，不改变共享首页基线；既有 SQLite/HTTP 回归仍为10项通过。无生产写入、cron/Telegram 改动或部署。

## Integration evidence

2026-10-02: Sol team implementation integrated; TypeScript, 36 tests, isolated runtime HTTP contracts and real browser public/admin workflows passed. Root production preflight verified the canonical D1/R2 bindings and excluded local credentials/audio.
