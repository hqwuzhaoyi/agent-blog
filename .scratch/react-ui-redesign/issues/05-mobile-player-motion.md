# 05: 移动播放器与展开动效

**What to build:** 底部播放条及移动章节 Sheet 支持原生滚动和主动展开反馈。

**Blocked by:** 03: 节目详情与持续播放器.

**Status:** ready-for-agent

**Execution:** completed

- [x] 详情大播放器自然随文档滚动，视野外紧凑控件交接不追逐滚动。
- [x] 主动展开/收起使用短暂动效，音频节点不重建。
- [x] 移动 Sheet 只从把手拖动，章节列表与滑块可以正常操作。
- [x] 390px、安全区、键盘焦点与 reduced-motion 验收通过。
- [x] 直接 seek 不增加 tween，动画只影响播放器局部。

## Integration evidence

2026-10-02: Sol team implementation integrated; TypeScript, 36 tests, isolated runtime HTTP contracts and real browser public/admin workflows passed. Root production preflight verified the canonical D1/R2 bindings and excluded local credentials/audio.
