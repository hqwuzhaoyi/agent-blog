# BeUI 复用与重复实现审计

日期：2026-10-03。应用基线：`65ebadb`。状态：三路团队审计完成；后续已实施第一批，见 [实施记录](../react-ui-redesign/issues/18-official-component-reuse.md)。下文保留审计时的基线与分批建议。

## 结论

确实存在少量基础控件和交互组合重复，但没有证据表明当前未采用 BeUI/Motion。Button、Tabs、BottomSheet 已复制上游源码并保留出处与许可证；当前 Button 的 Motion 弹簧已恢复。前台其他部分的主要问题是基础控件接入不一致，后台主要问题是异步状态和移动页签仍分散手工组合。

页面排版、EpisodeCard/ReviewRow、单音频控制器、章节定位、URL 筛选以及绑定修订的审核流程属于领域代码。它们不应仅因官方有同名或相似视觉组件就被删掉重建。

## 方法与证据

- 按 [AI Agents 官方流程](https://beui.dev/docs/ai-agents) 与 [beui skill](https://github.com/starc007/ui-components/blob/main/skills/beui/SKILL.md)，先读取实时 [registry](https://beui.dev/r/registry.json)，当时包含 130 个安装 slug。
- 对候选读取 `https://beui.dev/r/<items.name>.json` 实际源码与 helpers，核对导出、props、交互与依赖，不只比较组件名称或截图。
- 实际执行只读命令 `npx --yes shadcn@latest view @beui/input @beui/select @beui/range-slider-inline` 成功；没有运行 add/install，没有新增产品依赖。
- 团队分工：sol_public 前台基础控件；sol_foundation 播放器与动效；sol_admin 后台与业务边界。主代理交叉核对关键源码与优先级。
- 官方文档说明 BeUI 以源码分发，没有 `beui` 运行时包；仅从 package.json 缺少这个名称不能判断没有使用。

## 最值得处理的项目

这里的优先级表示建议处理顺序，不表示安全漏洞级别。

| 顺序 | 当前实现与位置 | 判断 | 推荐方向 | 必须保持 |
| --- | --- | --- | --- | --- |
| 1 | 两个重试按钮：`src/app/routes/agent-blog.archive.tsx:42`、`src/app/routes/agent-blog.reviews.index.tsx:26` | **明确重复**：已有 BeUI Button，却单独复制 border、圆角、尺寸、padding | 直接使用现有 `Button variant="outline"`，无需新依赖；对应 [`button-base`](https://beui.dev/r/button-base.json) | 原有 router reset、错误文案和焦点 |
| 2 | 后台请求展示：`src/app/features/admin/Lists.tsx:118`、`:138`、`:202`，`Other.tsx:39`、`:44`，`Detail.tsx:85` | **重复状态组合**：各页分别拼 loading/error/empty；源码分支可同时显示错误与空态/加载 | 复用现有 shadcn Skeleton/Card/Button，统一互斥的请求状态展示与 retry 回调 | 页面掌握取数、401/409语义；本项是静态审计发现，尚未注入失败做运行时复现 |
| 3 | 移动审核页签：`src/app/features/admin/Detail.tsx:139`、`:158`、`:206` | **手工重做页签组合**：button+role+CSS hide，缺少完整键盘和 tabpanel 关联 | 按既定后台体系补 shadcn/Radix Tabs；当前后台没有已安装的 ui/tabs 文件 | 未保存编辑、完整预览和桌面双栏；切换不应重挂编辑子树 |
| 4 | 归档搜索：`src/app/routes/agent-blog.archive.tsx:116` | **组件接入缺口**：原生 search input 配自写样式，可由现成控件覆盖，但没有自己重造输入引擎 | 官方 [`input`](https://beui.dev/r/input.json) / `Input`，透传 ref，回调由 event 改为 string | URL replace、type=search、清除后 focus、防滚动；不启用无业务意义的 success/error 动效 |
| 5 | 归档月份 `agent-blog.archive.tsx:131`；后台分页 `features/admin/Lists.tsx:225`、外观 `Other.tsx:166` | **相似选择控件尚未统一**，原生 select 已有浏览器语义，不算手写选择引擎 | 前台评估 [`select`](https://beui.dev/r/select.json)；后台保持 shadcn 或统一轻量 SelectField，不跨体系硬换 | 官方 BeUI Select 缺完整方向键/焦点处理证据；需验收标签、键盘、SSR、空值和手机系统 picker 的替代成本 |
| 6 | 丢弃编辑：`features/admin/Detail.tsx:55`、`:97`、`:127` | **重复确认组合**：native dialog 与 window.confirm 两条路径 | 统一后台 DiscardChangesDialog adapter，连接路由 blocker 与刷新操作 | beforeunload、cancel/proceed、焦点恢复；不可变为发布的额外授权步骤 |
| 7 | 保存/发布请求文案：`features/admin/Detail.tsx:21`、`:60`、`:297` | **展示重复**：共享 pending 导致两个动作都可显示请求中 | 现有 shadcn Button 外包薄异步展示；[`button-stateful`](https://beui.dev/r/button-stateful.json) 仅作参考 | 成功来自服务器；保存不等于发布；dirty/stale/revision 禁用仍属业务逻辑 |

## 已复用，应保留

| 本地实现 | 实际来源 | 审计结论 |
| --- | --- | --- |
| `features/public/beui/button.tsx` | `button-base`，Button / ButtonLink / Motion SPRING_PRESS | 已复用；不要再安装第二份或覆盖键盘、44px、减少动效适配 |
| `features/public/beui/tabs.tsx` | `tabs` compound components，外加受控便利包装 | 已复用；保留本地方向键、roving focus 和局部滚动修复 |
| `features/public/beui/bottom-sheet.tsx` | `bottom-sheet`、dragControls、PresenceGate、body lock | 已复用；焦点恢复、中文关闭、safe-area 和无背景模糊是有目的的适配 |
| `features/admin/ui/*` 与 `layout/*` | shadcn/ui、shadcn-admin，见 UPSTREAM.md | 符合用户指定的后台体系，不应强行换成 BeUI |

## 官方滑杆：优先采用，实际验收

`features/public/player/provider.tsx:250`、`:269` 当前使用 native range，并未自写拖拽引擎。统一组件时，优先采用官方 [`range-slider`](https://beui.dev/r/range-slider.json) 或 [`range-slider-inline`](https://beui.dev/r/range-slider-inline.json)，先保留上游实现，再连接现有 seek/setVolume。

用户纠正：此前“不跟手”发生在手写播放器交互，不能将该问题推定到官方滑杆。审计只读取了官方源码，没有运行官方 Slider 的触摸/性能回归；发现 spring 并不证明组件有可感知滞后。原报告据此优先保留 native range 的建议撤回。验收应实际检查连续拖动、点击、键盘、实时进度回写及 Sheet 内滚动；仅在复现具体问题后决定是否适配内部。

## 不建议因去重而替换
- **单音频播放器**：[`dynamic-island`](https://beui.dev/r/dynamic-island.json) 负责视觉容器，没有 audio、seek 或播放器焦点语义；不能替代 controller、跨路由单实例、媒体事件与直接 seek。
- **播放/暂停图标**：[`action-swap-roll`](https://beui.dev/r/action-swap-roll.json) 是可选展示增强。当前只是条件渲染，没有重复实现换态动画引擎。若引入仍以真实媒体事件驱动，不让组件默认循环假装播放成功。
- **导航与章节高亮**：[`shared-layout-bg`](https://beui.dev/r/shared-layout-bg.json) 是 hover 背景，没有等价的受控路由/音频 active API；不能替代 Link activeProps、aria-current 与章节时间判断。
- **审核发布**：[`approval-card`](https://beui.dev/r/approval-card.json) 没有通用 disabled 或 dirty/stale/error 模型，不能原样表达当前 revision 绑定审批；tool-approval 的 AlwaysAllow 语义也不适用。
- **封面、内容卡片、RSS 链接与页面排版**：属于出版站点内容组合，官方 TiltCard/ChatApp 等不同领域组件不是对应替代品。

## 推荐下一批实施范围

第一批：统一两处重试 Button + 归档 Input，并采用官方 Slider 连接现有音频进度与音量接口、进行实际交互验收；同时将后台异步状态与移动 Tabs 单独列为修复任务。第二批再决定选择器与确认框。保留单音频控制器、跨页播放与章节定位等业务语义。

本次不以“用了多少 BeUI 组件”作为验收标准；复用应降低重复维护，同时保留已经明确的收听、阅读和审核行为。

## 团队明细

- [前台基础控件](public.md)
- [播放器与动效](motion.md)
- [后台与业务组合](admin.md)

## 前一轮部署收尾

按钮 Motion 修正提交 `65ebadb` 已推送到现有 PR #7；Cloudflare 版本 `0c08bba3-97f3-4df6-b396-e2d15840d198`。生产 28 个资源及审核保护检查通过；线上真实鼠标按压观察到 Motion inline scale，运行中切换减少动态效果后 transform 为 none。此部署属于前一轮按钮修正，不包含本轮审计建议。
