# 前台基础控件重复实现审计

> 审计修正（用户反馈，2026-10-03）：下文依据 spring 推测官方 Slider 不跟手、优先保留 native range 的建议已撤回。此前问题发生在手写播放器交互，官方 Slider 尚未实测。现建议优先采用官方组件并实测验收，不预先修改内部；以 report.md 的修正结论为准。
2026-10-03；仓库 HEAD `65ebadb`。只读应用源码；没有安装、修改应用代码、提交或部署。

先读 `/tmp/beui-agent-skill.md` 和实时 `/tmp/beui-live-registry.json`（130 个 install slugs），再读取官方 `/r/<slug>.json` 的实际文件内容与导出。注册表快照/候选源码在 `/tmp/beui-public-audit/`。这里的“重复”区分控件外观重复与业务行为；原生语义元素本身不等于重造一个复杂组件。

## 结论

最明确的重复是两处错误状态重试按钮：项目已安装 beUI Button，但这两处另写原生按钮及边框/尺寸。归档的搜索 Input 和月份 Select 尚未采用 beUI 对应基础控件，是下一批最直接的统一候选。Button、Tabs、BottomSheet 已经采用真实、pinned 上游源码；不能再报成未使用组件库。

音频控制器、章节 seek、URL 筛选、路由导航、RSS 链接与封面是业务组合。Slider 虽有官方候选，但实际源码包含视觉 spring 或 snap，不能仅凭名称直接换上。导航 active pill 也不是官方 hover pill 的重复实现。

## 已复用：不要重复安装或误报

| 本地文件与行号 | 当前实现 | 精确官方 install slug / export | 判定、收益与约束 |
| --- | --- | --- | --- |
| `src/app/features/public/beui/button.tsx:64`、`:165`；`content.tsx:20`、`:25`；`player/provider.tsx:230`、`:237`、`:240`、`:264`、`:332`、`:366`、`:369`；`routes/agent-blog.tsx:16`；`agent-blog.archive.tsx:148` | 本地 Button / ButtonLink 源码、播放/暂停/跳过/静音、订阅、菜单、重置筛选等复用 Button。HEAD 的 `motion.button` 在 `button.tsx:110`，`SPRING_PRESS` 在 `:118`，不是早前的无动效按钮。 | [`button-base`](https://beui.dev/r/button-base.json)：`Button`, `ButtonLink`；API `variant`, `size`, `pressScale`, `ripple`，基于 HTMLMotionProps。 | **已复用，上游适配**。NOTICE 固定上游 `9f19813...`，保留 MIT。当地 0.97 按压、1.015 hover、键盘即时和短 ripple 是项目适配，不是独立重造。避免 registry add 覆盖现有适配/helper。 |
| `src/app/features/public/beui/tabs.tsx:55`、`:107`、`:407`、`:503`、`:539`；`routes/agent-blog.archive.tsx:97` | 上游 compound Tabs 保留上下文、指示器遮罩、frame geometry、滚动 reveal；对外提供受控 `items` 便利包装。 | [`tabs`](https://beui.dev/r/tabs.json)：`Tabs`, `TabsList`, `TabsTrigger`, `TabsContent`；root 支持 value/onValueChange、pill/underline/segment。 | **已复用，上游适配**。本地 root 改名 `CompoundTabs`，`Tabs` 是业务便利包装；roving focus、中文 aria 和 hit target 是补充，不应误称 custom indicator。 |
| `src/app/features/public/beui/bottom-sheet.tsx:38`；`player/provider.tsx:380`；`routes/agent-blog.tsx:16` | 同一上游 Sheet 用于播放器、移动菜单与订阅。保留 snapPoints、velocity/offset 决策、handle-only drag、PresenceGate 与 iOS body lock。 | [`bottom-sheet`](https://beui.dev/r/bottom-sheet.json)：`BottomSheet`；API open/onOpenChange/snapPoints/defaultSnap/title/description/dismissThreshold/className。 | **已复用，上游适配**。本地 focus trap/restore、dvh/safe-area、中文关闭按钮与无 blur scrim 是有记录的验收改动。内部 `bottom-sheet.tsx:276` 的原生关闭按钮属于这个被适配的组件内部，不应把它另算前台业务层“漏用 Button”。 |

## 直接可整理的重复/基础控件候选

| 本地文件与行号 | 当前实现 | 已核实的官方 slug / export / API | 重复性质、替换收益与约束 |
| --- | --- | --- | --- |
| `src/app/routes/agent-blog.archive.tsx:42`；`src/app/routes/agent-blog.reviews.index.tsx:26` | 两处错误状态分别写 `<button type="button" onClick={reset}>`，复制 border、rounded、min-height、padding；同页其他动作已用 beUI Button。 | [`button-base`](https://beui.dev/r/button-base.json)：现有本地 `Button`，`variant="outline"`，onClick 继续接 reset。 | **明确重复实现，优先级最高**。直接复用已安装 Button，无新增包或 registry 文件；消除两个独立按钮风格/焦点实现。保留本地错误文案、router reset 语义，不需要 StatefulButton，也不要伪造 success 状态。 |
| `src/app/routes/agent-blog.archive.tsx:114`、`:116`；`features/public/public.css:100` 的 archive-filter-form 规则 | label + 原生 `input type="search"` + 自写 field 样式。value=URL 的 q；每次输入 `update({q}, true)`；ref 用于 reset 后 preventScroll focus。 | [`input`](https://beui.dev/r/input.json)：`Input`（forwardRef）；`label`, `value`, `onChange:(value:string)=>void`, `type`, `leftIcon`, `rightIcon`, `error`, `success`, `classNames`。 | **基础输入控件自定义，直接候选**。能统一 field/label/focus/图标，不必另写焦点边界。回调必须由 event.target.value 改成 string；ref 必须继续透传，保留 type=search、URL replace 和焦点行为。用 Input.label 后不要再嵌一个外部 label。搜索并无 validation 成功/错误，不应启用震动/error/success 动效。 |
| `src/app/routes/agent-blog.archive.tsx:129`、`:131` | label + 原生 `<select>`/`<option>`，同一套自写 border/padding。value=URL month；选项从真实公开内容月份派生，空字符串表示全部。 | [`select`](https://beui.dev/r/select.json)：`Select`, `SelectTrigger`, `SelectValue`, `SelectContent`, `SelectItem`；root value/onValueChange/open/onOpenChange；SelectItem.value。 | **基础选择控件自定义，可替换但需验收**。可与 Input、Tabs 形成同源控件，统一 trigger/listbox/选中图标与弹出。实际源是 button+listbox，不是原生 select，也不是 combobox。Trigger API 只有 className/children，不能原样传 aria-label/id；需要确保“月份”命名（如 trigger 内 sr-only 标签）、空值显示、SSR 初始标签和键盘/焦点仍正确。默认 item blur/stagger、展开0.6s 等明显多于现有即时交互；当前场景应先判断接受程度。源码虽有 Escape/outside 关闭，但没有 onKeyDown / ArrowUp/ArrowDown / Home/End 或 roving focus 实现；必须补齐/验收键盘选择及关闭后焦点。SelectContent 还动画 height 与 margin，默认关闭约 0.42s。移动系统 picker 会变成网页 listbox，不是无成本替换。 |

## 选择性复用，不应机械地“全站替换”

| 本地文件与行号 | 当前实现 | 精确候选和实际差异 | 判定、收益与约束 |
| --- | --- | --- | --- |
| `player/provider.tsx:250`、`:269` | 两个原生 range：播放 seek（0.1 秒步长）和 volume（0.05），直接改音频值，无额外视觉 tween。 | [`range-slider`](https://beui.dev/r/range-slider.json)：`RangeSlider`；[`range-slider-inline`](https://beui.dev/r/range-slider-inline.json)：`InlineSlider`。均用 SliderOptions(value/onValueChange/min/max/step/aria-label/formatValueText)。RangeSlider 用 `useSpring(target, SPRING_GLIDE)` 驱动 thumb/fill；InlineSlider 有十档 stops、非拖拽 animate(handleX, spring)、拖动时精度及结束 snap 逻辑。 | **原生输入 + 明确业务约束，不是重造官方 Slider**。同源视觉/格式化有潜在收益，但必须保证 seek 滑块视觉直接跟随、0.1 秒精度、音量0.05、实时进度、键盘和 Sheet 内触摸正常；不能直接采用 spring/snap 表现。若改内部才能满足，则要记录为上游适配；在当前“直接 seek、不加 tween”要求下保留 native range 合理。 |
| `player/provider.tsx:292` | 章节 list 内原生 row button，aria-current 标注实际当前章节；onClick=play(episode,start)，不改 hash/路由。 | 已安装 [`button-base`](https://beui.dev/r/button-base.json) `Button` 可用 ghost/className 做 row 外壳。 | **业务定制 row，仅弱视觉重复**。可以统一 focus/disabled 底座，但复制 press/hover scale 到整行不是必需收益；必须保留整行命中、时间/标题列、当前章节与 no-scroll seek。不应换 Tabs、Accordion 或 ScrollTo（它们会改变语义/行为）。 |
| `player/provider.tsx:352`、`public.css:148` | 持续播放器标题是原生按钮，含节目标题和实际时间；点击只展开已有 BottomSheet。 | 已安装 `button-base` 的 `Button`（ghost）是可选外壳；[`dynamic-island`](https://beui.dev/r/dynamic-island.json) 导出 `DynamicIsland`, `DynamicIslandView`，实际源测量内容并 spring 真实 width/height，shell 0.8s。 | **业务组合，不是 Dynamic Island 的重复实现**。简单 Button 外壳可减少独立 focus 样式，但不能让标题区 scale/挤压布局。当前持久 audio/IntersectionObserver 交接/Sheet 都是播放器需求，DynamicIsland 无音频持久性，而且其尺寸 spring 与本项目原生滚动策略不符。不建议为“像库”改掉这个架构。 |
| `routes/agent-blog.archive.tsx:29`；`routes/agent-blog.reviews.index.tsx:22` | 本地文字 role=status 加载提示；没有手写 spinner/动画/计时器。 | [`loader`](https://beui.dev/r/loader.json)：`Loader({variant,size,speed,label,className})`，可选 spinner/dots/bars 等；内部已有 role=status + sr-only label。 | **业务状态文案，非动画重复**。可选小 Loader 辅助，而非删除文案。若使用要提供中文 label、防重复 live announcement；避免看起来像有真实生产进度的 percent。其 reduced motion 仍 opacity pulse，并非完全静态。 |
| `routes/agent-blog.tsx:15`；`public.css:13`、`:15` | TanStack Link 路由 activeProps 显示静态 active pill，四个页面 URL 与 SSR 导航语义保留。 | [`shared-layout-bg`](https://beui.dev/r/shared-layout-bg.json)：`SharedLayoutBg({as,pillClassName,inset,...})` 实际只在 clone children.onMouseEnter 时设置 activeId，并 onMouseLeave 清空；没有 controlled active/value API。 | **业务路由导航，不是同功能重复**。官方实现是 hover gliding background，不是 route selected state；当前也没有另写 Motion layoutId/spring。增加 hover 外观可以作为设计选择，但不能直接替换 route active、aria-current 和 Link。更不能用 Tabs 把路由变成面板。 |
| `routes/agent-blog.tsx:16`（搜索图标 Link） | 直接到归档的链接；真正的关键词/月/type 搜索在归档完成并存于 URL。 | [`command-palette`](https://beui.dev/r/command-palette.json)：`CommandPalette`，API items/shortcut/placeholder/emptyMessage/open/onOpenChange，自带本地 query 与 searchCommands。 | **并无自制 palette，不构成重复**。Cmd+K 是独立新增功能；该组件不是公开内容查询边界/URL 筛选控制器。需要业务数据适配及可访问性验证，不能借审计之名扩大到搜索架构改造。 |
| `routes/agent-blog.tsx:16`（订阅与移动菜单） | 已使用同一 BottomSheet，内容为业务链接。 | [`popover`](https://beui.dev/r/popover.json)：`Popover`, `PopoverTrigger`, `PopoverContent`；controlled open/onOpenChange、trigger、side/align，默认 goo blur + spring。 | **已经采用 beUI Sheet，不是手写 Popover**。桌面换成锚定 Popover 是 UX 选择，非去重必要条件；移动仍需 Sheet，且 goo/filter 与项目克制动效可能不符。 |
| `content.tsx:28`；`routes/agent-blog.episodes.$id.tsx:40` | 阅读/返回/下载/RSS 等语义 Link 或 anchor，图标+文字，未自制扩展箭头动画。 | [`expanding-arrow-button`](https://beui.dev/r/expanding-arrow-button.json)：只导出 `ExpandingArrowButton`，API 基于 HTMLMotionProps<'button'>，没有 href/asChild。已安装 `button-base` 另有 `ButtonLink` 基于 HTMLMotionProps<'a'>。 | **普通业务链接，不是动效组件重复**。不能把 Link/下载 anchor 换成 button 再用 JS 跳转；要浏览器打开新标签/复制链接/TanStack client navigation。ButtonLink 仅适合本来想做按钮外观的 anchor，不是全部正文链接。 |
| `routes/agent-blog.tsx:16`、`player/provider.tsx:369` | 搜索、菜单、关闭等 icon buttons 已有 aria-label；未写 tooltip surface/定位/hover timer。 | [`tooltip`](https://beui.dev/r/tooltip.json)：`Tooltip({content,children,side,delay,...})`，依赖 @floating-ui/dom，内部 focus/hover/tap positioning。 | **没有重复 Tooltip**。可作为图标解释的可选增强；不能把 aria-label 当 tooltip 等价物，也不能因为未有可视 Tooltip 就认定重造。需评估额外定位依赖及手机 tap 行为，保留原 aria-label。 |

## 推荐整理顺序（不在本次实施）

1. 先统一两处重试按钮到现有 `Button`；范围最小，不增加依赖。
2. 归档 `Input` 是最自然的下一项；随后决定 `Select` 的网页 listbox 是否符合移动/SSR/即时筛选要求。
3. 原生 slider 明确保留或专门做来源适配评审；不要直接替换成 spring/snap 控件。
4. 其余仅当读者体验需要时采用，不能把业务 Link、状态文案、章节 seek、持续音频或整体页面设计都计为“重复造组件”。

本次没有扩大到后台、全站替换、NotFound、数据库或出版流程。实时源码与已 pin 的版本可能有后续差异；“有新 registry 实现”不等于本地旧版本必须覆盖更新。

交叉核对父代理官方 shadcn view 输出 `/tmp/beui-shadcn-view.json`：Input/Select/InlineSlider 实际 API 与上述官方 JSON 一致。SelectTriggerProps 仅 className/children；检索 Select 全文件没有 ArrowDown/ArrowUp/Home/End/onKeyDown，不能假设注册表来源即完整键盘验收通过。
