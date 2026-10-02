# 前台与审核后台 UI 参考

调研日期：2026-10-02。范围：官方网页、项目 README、源码依赖和 LICENSE。以下“建议”是本项目的设计判断，不是上游功能承诺。

## 采用方式

按用户决定移除 Astro，前台采用 React + beUI，审核后台采用 shadcn-admin 的布局和组件。统一 React、TypeScript、Tailwind CSS 4 和基础设计变量；Cloudflare Workers、D1、R2 继续承载发布服务和数据。

这些站点不需要成为五套并列依赖。beUI、Rare UI 和 shadcn/ui 主要通过 registry/CLI 将所需组件源码加入项目；Transitions 提供可复制的动效片段；Beautiful UI 主要作为审核界面的视觉与交互参考。

## 已核实的参考

| 来源 | 实际定位与技术 | 本项目的用途 |
| --- | --- | --- |
| [beUI](https://beui.dev/) | 面向 React 的可复制动画组件，通过 shadcn registry 分发；官网明确要求 React 19、Tailwind 4、Motion。免费部分为 [MIT](https://github.com/starc007/ui-components/blob/main/LICENSE)，Pro 单独授权。 | 前台的主要组件来源：按钮、Tabs、Bottom Sheet、Tooltip、搜索 Command Palette 和状态反馈。 |
| [shadcn-admin](https://github.com/satnaing/shadcn-admin) | 管理界面示例项目，Vite、React、TypeScript、Tailwind、Radix、TanStack Router/Query/Table；[package.json](https://github.com/satnaing/shadcn-admin/blob/main/package.json) 可核实依赖。README 明确不是 starter，认证只有部分实现；[MIT](https://github.com/satnaing/shadcn-admin/blob/main/LICENSE)。 | 采用侧栏、页头、搜索、响应式导航、表格与筛选布局，接本项目已有审核 API；不要把演示数据、Clerk 示例或通用业务页面一起搬入。 |
| [Beautiful UI](https://beautifului.dev/) | AI 原生界面展示：Approval Card、Task Rows、Context Cards、Diff Table、Selection Actions 等；[官方许可页](https://beautifului.dev/license) 为 MIT。 | 审核详情中的“这次将公开什么”、素材出处、生成任务状态及修改对比。参考交互结构，按现有组件体系重做。 |
| [Rare UI](https://rareui.com/) | React 动画组件 registry；[README](https://github.com/swamimalode07/rare-ui) 说明 Motion 和 reduced-motion 支持。官网的 Next.js 是其网站技术，不代表使用组件必须迁移 Next.js。 | 仅考虑节目归档的 Folder 视觉或少量品牌细节；Fluid Orb、Gravity Letters 不适合正文和日常播放器的主流程。 |
| [Transitions](https://transitions.dev/detail.html?doc=introduction) | 动效片段库，同时提供 skill 和扫描/修改 agent；提供 CSS 与 React 版本，不是网站框架，也不要求安装新的运行时动画库。 | 参考 menu、modal、panel reveal、tabs、spinner-to-check 的状态转换；统一成项目自己的动效变量。 |
| [shadcn/ui](https://ui.shadcn.com/docs) | 可定制组件源码与分发体系；官方强调组件代码归项目控制；[MIT](https://github.com/shadcn-ui/ui/blob/main/LICENSE.md)。 | 基础交互语义、表单、Dialog、Alert Dialog、Sheet、Data Table 和可访问性底座，与 beUI 的动画层协同。 |

### 两处许可需要准确区分

- Rare UI 实际为 **MIT + Commons Clause + Attribution**。使用其组件需保留源码版权/许可，并提供可见的 Rare UI 链接；不能将组件本身出售、再授权或重新分发成组件集。不能将它描述为纯 MIT。[原始 LICENSE](https://github.com/swamimalode07/rare-ui/blob/main/LICENSE)
- Transitions 的 **工具目录采用 MIT**，动效与 skill 使用单独许可：可用于个人和商业网站，但不得重新包装成竞争的动效库、模板包或组件集；付费片段另有计划条件。其品牌和网站设计不在上述许可范围内。[原始 LICENSE](https://github.com/Jakubantalik/transitions.dev/blob/main/LICENSE)

### 可访问性与可用性核查边界

Beautiful UI 网页可读取，许可页也可访问。读取到的页面源码包含语义按钮、`aria-label`、导航标签及部分 `prefers-reduced-motion` 处理；这不能等同于完成整站键盘、屏幕阅读器和对比度审计。移植审批流程时仍需检查焦点顺序、确认按钮文案和错误提示。beUI 同样应逐个组件验收，而非因为使用了组件库就默认通过。

Rare UI 直接域名的 Jina 请求曾遇到 Vercel 429；官方网页与官方 GitHub README/许可均已核实。这是一次读取限制，不是产品不可用的结论。

## 前台：以收听与阅读为中心

首页先展示最新一期早咖啡：日期、标题、一句摘要、时长和清晰的播放按钮；下方分别列节目归档与工作日志。导航只保留“首页、早咖啡、工作日志、订阅”，运营状态留在后台。

节目详情包含主播放器、可点选的章节、节目摘要和素材来源；章节点击只 seek，不改变滚动位置。桌面收起为底部播放条，移动端用底部播放条加可展开 Sheet。音频实例在公共页面切换间保持，播放器所在布局不追逐滚动位置。

工作日志采用阅读页：标题、日期、摘要、项目内容、必要链接；控制正文宽度，保证中文排版和标题层级。列表可搜索、按内容类型筛选；不要把每条内容设计成展示动效的卡片。

beUI 的 [Tabs](https://beui.dev/components/motion/tabs) 用于归档筛选指示器；[Button](https://beui.dev/components/motion/button) 用于播放与订阅反馈；[Bottom Sheet](https://beui.dev/components/motion/bottom-sheet) 是移动播放器容器的候选，音频进度仍优先用语义明确、键盘可操作的 Slider。主流程不采用持续倾斜、磁吸或大范围模糊。

## 后台：围绕草稿确认发布

采用 shadcn-admin 外壳，侧栏只保留“待确认、已发布、播客、设置”。首页默认进入待确认列表，展示标题、类型、生成时间、版本和状态。单击草稿进入审核详情：完整前台预览为主，来源与生成摘要为辅，底部保持“退回修改”和“确认并发布”可见。

借鉴 Beautiful UI 的 Approval Card，将发布对象、版本、目标地址和确认动作放在一起；Task Rows 用于播客制作状态，Context Cards 用于来源。已发布详情可查看发布时间和确认记录，修改后生成新版本并重新确认。

确认成功显示实际发布时间及公开链接；失败保留草稿和错误提示。按钮 pending/success 状态用短暂转换，不能以动画替代请求结果。后台只接已有认证与版本确认协议，不能将示例 UI 当作完成授权和发布逻辑。

## 动效落实原则

只在状态变化使用 Motion：播放/暂停、展开/收起、筛选指示器、弹窗、发布反馈。普通上下滚动保持原生响应；正文进场只做短淡入，避免逐段等待。所有状态都有文字/语义表达，`prefers-reduced-motion` 下保留功能并移除位移。Transitions 官方也明确强调 reduced motion、键盘焦点及状态不依赖动画。[官方可访问性说明](https://transitions.dev/detail.html?doc=introduction#accessibility)

验收重点：跨页音频不断、章节不滚动、移动端 Sheet 手势与页面滚动不争抢、确认的是当前草稿版本、发布成功后页面及 RSS 读取新内容。
