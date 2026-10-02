# 18: 使用官方组件统一前台控件与后台状态

Status: ready-for-agent
Execution: completed

用户在三路复用审计后授权团队实施第一批建议，并明确优先采用官方 BeUI Slider，不能用此前手写播放器的问题推断官方滑杆有问题。

## Scope

- 前台：两处重试按钮复用已有 BeUI Button；归档采用官方 Input，保留 URL replace 与 reset focus。
- 播放器：官方 RangeSlider 及完整 helper，用于进度和音量；保留上游 Motion 行为，接入既有单 audio controller。
- 后台：现有 shadcn 组件统一 loading/error/empty/retry；实际 shadcn/Radix Tabs 完善移动审核键盘与面板语义，保留桌面双栏和草稿状态。
- 本批不包含审计第二批的 Select 与丢弃编辑确认替换。

## Ownership

- sol_public：前台 Input 与重试按钮。
- sol_foundation：官方 Slider、音频接线与专用浏览器回归。
- sol_admin：后台异步状态、Tabs 与专用浏览器回归。
- root：依赖、CSS 集成、出处、全站验收、提交与部署。

## Acceptance

- 单音频跨路由连续；pointer/click/keyboard seek 和音量正确；章节点击无 hash/scroll 跳动。
- 归档关键词不增加逐字历史，筛选返回和重置焦点正确。
- 后台失败展示与加载/空态互斥，retry 可恢复；移动Tabs键盘可用，切换不丢草稿；既有批准保护保持。
- 1440px/390px、减少动效、TypeScript、相关回归与生产资源验证通过。


## Verification

- `npm run check`：TypeScript 通过。
- `npm test`：11 文件 / 36 项通过。
- `npm run test:browser`：单 audio、章节无跳页、URL 筛选/返回、重置焦点、列表暂停/续播、手机 Sheet 拖动及焦点通过。
- `npm run test:browser:sliders`：官方默认 slider pointer/click/Arrow/Home/End、音量、外部 timeupdate、跨页实例、Sheet 内容滚动与减少动效通过。上游 spring/拖动引擎未改。
- `npm run test:browser:admin`：本地会话 mock GET 失败与重试，列表/节目/详情/audit 错误不再与加载或空态混杂；桌面两栏、手机键盘 Tabs、面板/editor 同节点、dirty 内容保留与批准禁用通过。未保存或发布测试内容。
- 新增依赖仅 `@radix-ui/react-tabs@1.1.21`；BeUI 依赖均已存在。官方 Input/RangeSlider 与 helper 来源见 NOTICE，后台 Tabs 来源见 UPSTREAM。
- 自动化需要等待弹层位置稳定再取坐标；当前 CLI 的裸 mouse wheel 事件坐标为 (0,0)，滚动测试使用明确容器的 scroll 操作。没有据此修改产品实现。

本批没有实施第二批 Select/DiscardDialog 替换。审计已存 `.scratch/beui-reuse-audit/`，其中关于官方 Slider 的早期推测已按用户纠正撤回。
