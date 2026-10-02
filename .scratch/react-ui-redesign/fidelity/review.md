# 组件库与设计模板还原审核

审核日期：2026-10-02。触发：用户反馈前后台与组件库/设计模板差距过大。审核基线为前一版线上 React 迁移与实际 beUI、shadcn-admin 上游源码/界面，而非只比较构建和功能结果。

## 结论

用户观察成立。上一版完成了业务迁移，但对第三方 UI 的适配过度简化，缺少视觉还原验收。主要差距来自自写布局、全局样式覆盖与删除原组件的形态/动效，而不是所选组件库能力不足。

| 问题 | 原实现证据 | 影响 | 本轮纠正 |
| --- | --- | --- | --- |
| 后台外壳未实际采用模板组件 | 原 UPSTREAM 只列复制 Table/Input；Layout 使用原生 aside/nav/button 加自写 admin CSS | 没有模板 SidebarProvider/Rail、NavGroup、Header/Main、Avatar/Menu 等结构与细节 | 按上游源码采用这些组件，替换业务菜单和账户资料，保留 MIT |
| 全局字号/主题覆盖后台 | 线上 computed style：17px、29.75px 行高、230px Sidebar，分页按钮统一深绿 | 大字号、宽松行高与统一实心按钮使模板密度、层级和按钮 variants 消失 | 后台独立白色/zinc token 与14px/21px排版，源组件 variants 生效 |
| CSS层优先级错误 | 公共 reset 和 a/button/input 样式处于未分层 CSS，而 Tailwind utilities 在 layer 内；旧 admin-main 宽泛选择器再次覆盖按钮/输入/表格 | 即使组件带有原始 class，运行时依然失真 | reset 放入 base layer，移除后台宽泛控件覆盖，补齐 Sidebar/Popover token aliases并覆盖 portal scope |
| beUI核心控件被重写成简版 | 原 Button 约36行，Tabs 约90行；上游 Button189行、Tabs373行；原 snap/geometry/hover/press API 被删改 | 失去胶囊尺寸体系、原 press spring、hover gating、Tabs mask/layout scope与Sheet档位手感 | 恢复完整上游源码与helpers，只适配路径、中文/accessibility/触摸尺寸，具体说明见 NOTICE |
| 完成判断缺少视觉依据 | 既有验收侧重API、存储、播放与审核行为 | 功能通过不能证明模板还原 | 增加同尺寸桌面1440×1000、手机390×844 before/after与源码来源核验 |

## 参考与采用边界

- [shadcn-admin](https://github.com/satnaing/shadcn-admin) 的后台布局和组件为还原基线；[实际 Tasks 页面](https://shadcn-admin.netlify.app/tasks)用于密度、边界、导航和控件对比。本站保留真实审核数据，不搬收入、客户、Clerk、虚构邮箱或批量审批演示。
- [beUI](https://beui.dev/) 是 React 动画组件集合。原控件形态和交互是前台还原基线；博客的编辑版式仍是本站设计，不把其组件展示首页当成博客整站模板。
- beUI 来源版本9f19813与shadcn-admin来源版本e16c87f已记录，各自许可保留。适配说明明确哪些是上游源码、哪些是业务页面，不再把简化重实现当作完整模板接入。

## 回归范围

保留D1/R2和发布API。工作日志仍需要操作者确认保存版本；播客仍自动发布。检查侧栏单项激活/折叠、移动Sheet不透明背景与焦点恢复、完整预览/编辑/冲突、真实分页与状态、跨页音频、章节不滚动、reduced-motion、CSS/JS资源和RSS。

截图属于隔离预览，用于设计对照；出现的测试记录不是线上工作日志。生产审核只读，没有发布、删除或修改实际内容。

## 完成记录

修正已部署，Worker版本 `91e107bf-b8f4-42d7-b31c-490bf5a2bb53`。36项测试及隔离完整流程通过；生产资源25项、审核会话保护、RSS5/2项与两集音频HEAD/Range通过。后台字号14px/行高21px已在真实样式中核对。接口与存储规则没有改动。
