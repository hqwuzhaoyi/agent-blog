# 04: 内容首页与节目列表

**What to build:** 最新播客、节目列表与工作日志分区展示，读者可直接收听和订阅。

**Blocked by:** 03: 节目详情与持续播放器.

**Status:** ready-for-agent

**Execution:** completed

- [x] 最新节目日期与时长真实，空库/无新一期状态准确。
- [x] 节目卡片播放独立于导航并复用持续播放器。
- [x] 最近节目及工作日志各自可进入完整详情。
- [x] 保留品牌及可用中文导航、搜索/归档入口和两种 RSS 订阅入口。
- [x] 桌面/手机 SSR 内容可读，不展示生产或部署记录。

## Integration evidence

2026-10-02: Sol team implementation integrated; TypeScript, 36 tests, isolated runtime HTTP contracts and real browser public/admin workflows passed. Root production preflight verified the canonical D1/R2 bindings and excluded local credentials/audio.
