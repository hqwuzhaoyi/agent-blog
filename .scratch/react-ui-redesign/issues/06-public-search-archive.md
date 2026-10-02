# 06: 公开搜索与归档筛选

**What to build:** 按关键词、月份和类型查找 Published Reviews 与 Morning Coffee Episodes。

**Blocked by:** 03: 节目详情与持续播放器.

**Status:** ready-for-agent

**Execution:** completed

- [x] 列表数据只来自公开指针，草稿标记/摘要不会进入任何结果。
- [x] 关键词、月份和全部/播客/工作日志筛选可组合。
- [x] 查询状态随 URL 和历史导航保留，结果可进入现有详情地址。
- [x] 加载、无结果、错误状态清楚，中文标签和键盘操作可用。
- [x] SSR 与浏览器流程复用应用 HTTP 边界测试。

## Integration evidence

2026-10-02: Sol team implementation integrated; TypeScript, 36 tests, isolated runtime HTTP contracts and real browser public/admin workflows passed. Root production preflight verified the canonical D1/R2 bindings and excluded local credentials/audio.
