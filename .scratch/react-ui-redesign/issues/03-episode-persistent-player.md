# 03: 节目详情与持续播放器

**What to build:** 节目页与跨公开路由的单一音频控制器工作，章节可定位并播放。

**Blocked by:** 02: React 工作日志阅读页与预览部署.

**Status:** ready-for-agent

**Execution:** completed

- [x] 真实节目显示实测时长、章节、正文、来源与 AI 声明。
- [x] 播放/暂停、跳过十秒、音量与直接 seek 工作。
- [x] 公开路由及前进后退保留同一音频实例、位置和状态。
- [x] 章节点击不改变滚动位置或 hash，初次加载不自动播放。
- [x] 使用可播放隔离音频和浏览器验收，无整页每帧重渲染。

## Integration evidence

2026-10-02: Sol team implementation integrated; TypeScript, 36 tests, isolated runtime HTTP contracts and real browser public/admin workflows passed. Root production preflight verified the canonical D1/R2 bindings and excluded local credentials/audio.
