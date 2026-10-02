# 后台与页面组合边界审计（只读）

日期：2026-10-03。范围：`src/app/features/admin/**`、`src/app/routes/agent-blog_.admin*`，以及与后台共享的 Article/BeUI Tabs 边界。

已读 `/tmp/beui-agent-skill.md` 与 `/tmp/beui-live-registry.json`。按 live `items[].name` 核对 install slug，再读取九个官方 `/r/<name>.json` 的完整返回源码，未安装组件、未修改应用、未读取凭据、未调用线上内容接口。

## 核心结论

当前后台并不是“把库组件又原生重写一遍”：Sidebar/Provider/Rail、移动 Sheet、Header/Main/NavGroup/NavUser、Button/Input/Textarea/Card/Badge/Table/DropdownMenu/Separator 已实质复用了 shadcn-admin/shadcn 源码，见 `src/app/features/admin/UPSTREAM.md:7`。前台 BeUI、后台 shadcn-admin 的边界应保留。

仍有可收敛的地方：加载/错误/空态分散；移动审核页签自己拼了 tab 语义；两处原生选择器；两种丢弃编辑确认；保存/发布按钮的请求文案重复。它们的优先级和替代成本不同，不能把所有业务页面都算成组件库重复，也不能因为 BeUI 中出现 approval/chat 名称便直接替换安全流程。

## 优先级与具体文件

| 优先级 | 位置 | 现状与分类 | 优先复用现有体系 | 核验过的可选 BeUI slug | 必须保留的约束 |
| --- | --- | --- | --- | --- | --- |
| P1 | `Layout.tsx:47`、`Lists.tsx:118`/`:138`/`:202`、`Other.tsx:39`/`:44`/`:101`、`Detail.tsx:85` | 真正重复的请求展示：各自拼 spinner/文字/error/empty。列表失败时 data=null 仍进入“没有符合条件”分支；节目失败时仍显示读取中；详情初次失败同时显示读取中，均无统一重试呈现。这是源码可见的分支问题，本轮未执行运行时复现。 | 组合后台已有 `ui/skeleton.tsx:3`、Card、Button，抽 `AdminRequestState`/`AdminEmptyState`；error/loading/empty 应互斥，retry 回调由页面提供。组件只展示状态，不接管认证或取数。 | `loader` 只有视觉 API `variant/size/speed/label/className`；没有请求/error/retry/empty 状态机，不能单靠换 Loader 解决此项。 | 401 会话、503/网络失败不能装成空库；任何异步展示不能泄露草稿到公共组件的数据源。 |
| P1 | `Detail.tsx:139`、`:158`、`:206`，`admin.css:222`/`:227` | 移动预览/信息用两个 shadcn Button 手工 `role=tab`、`aria-selected` 加 CSS hide；没有 roving tabindex、方向键/Home/End、tab↔tabpanel IDs。这是原生交互组合仍待标准化，不是 Button 本身重复。 | 后台优先采用 shadcn/Radix Tabs。**当前 admin/ui 无 Tabs 文件**，不能宣称已安装后忘了用。可从既定 shadcn 体系补齐。 | `tabs` 导出受控 `Tabs(value,onValueChange)`、`TabsList`、`TabsTrigger`、`TabsContent`。官方本次源码 Trigger 仅 click/aria-selected，Content 无 tabpanel role/关联 ID，不能声称直接换完就具备完整键盘语义。仓库已有 public/beui/tabs.tsx:346 的方向键与 Trigger roving tabindex 改进；若选共享，需先迁到中立基础目录，不能由后台依赖 public feature。 | 预览和编辑必须保留 mounted/draft 状态。官方 TabsContent 在 inactive 时返回普通 div、active 时返回 motion.div，虽然说明“保持 mounted”，React 元素类型切换可能重挂子树；需实测编辑状态/滚动保存，不只相信注释。桌面两栏不能因页签包装而只剩一个面板。 |
| P2 | `Lists.tsx:225`、`Other.tsx:166` | 两处直接 `<select>` + 手写 h9 边框样式，属于相似原生控件组合；原生 select 本身已经有浏览器键盘语义，不能仅因原生就判定缺陷。 | 当前 `ui/dropdown-menu.tsx:109`/`:120` 已有 RadioGroup/RadioItem 可用于离散菜单；需要 select 语义时优先补 shadcn Select。**当前没有 ui/select.tsx**，此项不是“现成 Select 已安装却不用”。也可只统一轻量 native SelectField，不增加动画运行路径。 | `select` 是复合组件：受控 value/onValueChange/open/onOpenChange、Trigger/Value/Content/Item；不是 JSX 原生 option 的直接替换。官方源码有 Escape，但未见完整方向键选择/roving focus；替换要重新验收键盘。 | limit 从字符串转有限整数，并重置 page=1；外观保留 system/light/dark 三态与当前 data-mode 机制，不能变成仅 light/dark。 |
| P2 | `Detail.tsx:55`/`:97`/`:127`，`admin.css:166` | 自定义 native dialog + native window.confirm 同时处理丢弃编辑，具有可共享的 DiscardChangesDialog 组合边界。浏览器原生 modal 并非完整重写 focus trap，因此不是必须淘汰的安全问题。 | 用同一个后台确认适配器连接 TanStack useBlocker 和刷新丢弃。既有 `ui/sheet.tsx:2` 使用已安装 Radix Dialog 包；适合补标准 shadcn Dialog/AlertDialog wrapper，**不能把侧栏 Sheet 直接当 AlertDialog 替代**。 | `approval-card`/`tool-approval` 并不合适：前者是 HITL 提交界面，后者是工具执行权限；两者都不是路由丢弃编辑的 dialog resolver。 | 保留 beforeunload、Back/programmatic navigation、cancel/proceed resolver 和焦点恢复；这不应变成发布前的额外确认弹窗。 |
| P2 | `Detail.tsx:21`/`:60`/`:297`，`Layout.tsx:117`，`layout/nav-user.tsx:80` | 保存/发布/登录/退出各拼 pending 字样，保存与发布共用一个 pending boolean，两个按钮都会显示“请求中”。可共享 async action 的**展示**，但并非应删除业务状态。 | 基于已有 shadcn Button 做薄 `AsyncActionButton`/action-specific state adapter，不把 mutate/load/409 合并进视觉组件。 | `button-stateful` 实际 export 是 `StatefulButton`，state=idle/loading/success/error；loading 自动禁用且 aria-busy，支持 loadingText/successText/errorText，继承 Button disabled/onClick。是潜在精确匹配，但后台保持 shadcn 更一致，不强制跨体系替换。 | success 只来自实际服务器确认；dirty/stale/incomplete/current revision/published revision 的 disabled 判断必须继续传入；保存成功不能映射为“已发布”。 |
| P2（功能增强，非现成重复） | `Detail.tsx:253`/`:274` | 目前显示两份正文与逐字段前后值，尚未实现行级差异算法；native details 交给浏览器折叠，并非自己造了复杂 accordion。 | 保留文字安全渲染，可补 `ReviewRevisionDiff` adapter；metadata 比较继续来自对应 Review Identity。 | `file-diff` 接收**调用方计算好的** `lines: {id,type,oldLine,newLine,content}[]`，不接 oldText/newText 自动算 diff。支持 language=text，status=complete，默认 streaming/collapseOnComplete=true 应显式覆盖；新增 shiki。 | 不能伪造变更解释/原始对话；不能把 Markdown 当 HTML 执行；长正文性能与折叠不能取代完整批准预览。审计真实时间/actor/revision 仍独立。 |
| P3 | `Other.tsx:130`/`:166` | 当前外观控制是一段 data-mode 三态业务适配，不是 View Transition 动画重复。 | 保留当前控制与主题配置说明；若统一外观状态，在 app 层提供轻量 provider，不放进内容或审核 API。 | `theme-toggle` 依赖 next-themes，useThemeToggle 使用 useTheme 的 resolvedTheme/setTheme，只切 light↔dark；其 root ViewTransition 与本项目 data-mode / system 语义不直接兼容。 | 不应为了 wipe 动画新增第二个主题权威，改变“当前浏览器显示”和“构建配置更新后生效”的边界。 |

## 已复用，应该保留

- `Layout.tsx:135` + `layout/app-sidebar.tsx:40`：真正 SidebarProvider + Sidebar/Inset/Rail，nav/menu 与 Radix Sheet 已在复用；不是 animated-sidebar/ai-sidebar 替换目标。
- `Lists.tsx:124`：使用 `ui/table.tsx:4` 的 shadcn Table；有界服务器分页、过滤与状态来自 D1 JSON。BeUI `table-async` 的 `onEndReached/loading/skeletonRows/rowHeight/height` 属于虚拟化无限加载模型，不是当前分页控件的直接去重；其选择/编辑/插删 API 也不能带入审核列表或变成批量批准。
- `Detail.tsx:163` 与 `preview-server.tsx:36`：复用同一个 Article。只读 capability 预览的 SSR、token 身份校验、no-store/noindex/no-referrer/CSP 是必须保留的服务边界，不宜用 agent chat/streaming surface 代替。
- `Detail.tsx:209`：现有 Approval 面板只是 shadcn Card + 业务对象/版本/URL/状态组合，没有另一套 Card 基础实现。`mutate`、exact revision、409、Published pointer/audit 是领域逻辑，不是 BeUI 应接管的重复。
- `Other.tsx:51`：真实节目 Card/章节/页面/音频链接，是领域页面组合；没有任务/TTS/服务器事件源，不能接 agent-activity/todo-list 造制作进度。
- 六个 admin routes 是薄页面/布局路由适配；`agent-blog_.admin.tsx:3` 的 nonnested 分离保留公开播放器与管理布局边界，`:7` 保留 noindex。没有必要用 chat-app 生成另一个“代理工作台”。

## approval-card 为什么不能直接替换发布确认

官方 types：status 仅 pending/submitting/approved/rejected/changes-requested/answered；无 error/stale/dirty、无通用 disabled prop。index 审批按钮 `disabled={busy}`（busy 仅 submitting）；onApprove 可选但按钮仍渲染。approved 等终态把 interactive disclosure 关闭，会把 children 中的对象详情折起。

因此它虽有 onApprove 和自定义 approveLabel，却不能在不改内部的情况下准确表达本项目“未保存/版本变化/预览不完整时按钮禁用，以及失败可重试”。用 submitting 假装 dirty 会谎报请求中；去掉 onApprove 让按钮空转也不能满足可读的禁用原因。推荐保留现有 shadcn Card + revision-bound 按钮，至多借鉴外观，不列为强制去重。

已核验的 tool-approval 有 onAlwaysAllow 与 pending/approving/approved/denied/running/complete/error，它表示工具权限与执行；不能映射成持续授权工作日志发布，不能把一次确认升级成“总是允许”。其余 chat-app/message/prompt/agent-activity 的目录描述属于会话/推理/执行流，当前后台不提供这些模型，因此不列为迁移候选；未逐个读取其源码，也不声称审计了全部 agent 组件。

## 官方 API 核验材料

九个 slug 均在 live items[].name 存在，均读取相应官方 JSON；原始响应在 `/tmp/beui-admin-<slug>.json`。

- https://beui.dev/r/approval-card.json — types/index 源码，受控 status、onApprove、questions；无 disabled/error。
- https://beui.dev/r/tool-approval.json — ToolApprovalProps/status/onAlwaysAllow。
- https://beui.dev/r/button-stateful.json — StatefulButtonProps 与 loading disabled/aria-busy。
- https://beui.dev/r/tabs.json — 复合 Tabs props、Trigger/Content 与 mounted 分支。
- https://beui.dev/r/select.json — SelectProps 与 Trigger/Value/Content/Item。
- https://beui.dev/r/file-diff.json — FileDiffProps/FileDiffLine 与 AgentCodeLanguage(text)；shiki dependency。
- https://beui.dev/r/table-async.json — TableProps/onEndReached、loading、fixed rowHeight、emptyState；不是取数服务。
- https://beui.dev/r/theme-toggle.json — next-themes、useThemeToggle、ViewTransition、二态切换。
- https://beui.dev/r/loader.json — LoaderProps/role=status/label；纯展示组件。

注册项可能带完整 helpers 与多个源文件；未来采用时按官方返回完整复制，并保留本地 keyboard/accessibility/alias 调整。不要仅按 slug 猜组件名或只复制一个入口。此次审计没有执行 install 或改变任何应用文件。

## 后台建议前三项

1. 先收敛 loading/error/empty/retry，复用已有 shadcn Skeleton/Card/Button；这是当前可见状态混杂问题，收益高于动效替换。
2. 标准化移动审核 Tabs 的键盘/tabpanel 语义，优先后台 shadcn 体系，保留 draft 与全文预览；BeUI 可选，但官方 API 不应被假定已解决全部可访问性。
3. 统一丢弃编辑确认的 adapter（blocker + refresh），再按需要统一两处 SelectField；不是引入 approval-card/chat-app 改造审核领域模型。
