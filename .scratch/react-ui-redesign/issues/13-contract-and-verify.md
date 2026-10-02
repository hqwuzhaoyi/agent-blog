# 13: 移除 Astro 并完成整站验收

**What to build:** 完整 React 应用独立构建运行，旧框架退役且全部迁移行为通过验收。

**Blocked by:** 04: 内容首页与节目列表；05: 移动播放器与展开动效；06: 公开搜索与归档筛选；09: 草稿编辑、保存与冲突处理；10: 修订对比与发布审计；11: 后台播客与设置页；12: RSS 与自动发布链路兼容.

**Status:** ready-for-agent

**Execution:** completed

- [x] 删除 Astro 运行时及框架 build/check 依赖，保留历史资料和有效配置。
- [x] 各支持 Theme、浅深色、SSR、草稿隔离、版本确认与音频流程整合验收通过。
- [x] 公开初始加载不含后台 bundle/凭据，性能不回归滚动/seek 问题。
- [x] 更新部署、CI、贡献文档与 agent skills，构建产物无私有音频和密钥。
- [x] 提供确定性本地/隔离预览运行及检查命令，迁移阶段保持 CI 可解释。

## Integration evidence

2026-10-02: Sol team implementation integrated; TypeScript, 36 tests, isolated runtime HTTP contracts and real browser public/admin workflows passed. Root production preflight verified the canonical D1/R2 bindings and excluded local credentials/audio.
