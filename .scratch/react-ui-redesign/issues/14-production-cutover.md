# 14: 生产切换与回滚验证

**What to build:** 在原域名切换已验收的 React 应用，保留内容并验证恢复路径。

**Blocked by:** 13: 移除 Astro 并完成整站验收.

**Status:** ready-for-agent

**Execution:** completed

- [x] 先验证隔离预览，记录生产数据/端点基线与可回退的 Worker 版本。
- [x] 只切换应用版本，不重建/删除 D1 内容、R2 文件或订阅身份。
- [x] 生产公开文章、两类 RSS、音频 HEAD/Range 和审核登录可用。
- [x] 生产不发布测试工作日志、不重复发送音频，现有自动任务继续工作。
- [x] 记录部署版本、验证结果与保留 D1/R2 的应用回滚步骤。

## Integration evidence

2026-10-02: Deployed Worker version 0a2e7093-fbe2-46db-bf48-f4ad6f7f66de on the original domain. Public SSR and reviewer login/protection pass. RSS remains 5/2 items with identical GUIDs, dates and enclosures; both audio HEAD/Range checks pass. D1/R2 were retained. Compatible rollback target 39aaeb49-3178-4c13-a6c3-9532863d3332 was verified before cutover. No production test reviews or extra Telegram deliveries were made.
