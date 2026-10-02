# 10: 修订对比与发布审计

**What to build:** 检查草稿与已发布版本差异，查看实际来源和 Review Approval 记录。

**Blocked by:** 08: 完整预览与人工确认发布.

**Status:** ready-for-agent

**Execution:** completed

- [x] 仅返回对应 Review Identity 的合法修订及实际审批数据。
- [x] metadata 和正文变化可读，不编造原始对话/修订解释。
- [x] 无公开旧版本时提供清晰初次发布状态。
- [x] 管理读取受会话保护，来源链接和差异内容保持安全渲染。
- [x] 手机可切换预览/信息且不遮挡主要内容。

## Comments

2026-10-02 (Sol admin): Implemented all stored metadata/body comparison and actual identity-filtered audit; no prior publication has explicit initial-state text.390px preview/info tabs and safe-area action layout inspected; longrevision overflow corrected (document width375 under viewport390). Audit/revision identity checks pass HTTP.

## Integration evidence

2026-10-02: Sol team implementation integrated; TypeScript, 36 tests, isolated runtime HTTP contracts and real browser public/admin workflows passed. Root production preflight verified the canonical D1/R2 bindings and excluded local credentials/audio.
