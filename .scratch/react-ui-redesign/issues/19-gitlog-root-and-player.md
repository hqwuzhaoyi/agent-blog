# 19: gitlog.si 根路径、内容模块与播放器辨识

Status: ready-for-agent
Execution: in-progress

用户要求区分音量与播放进度、评估 THE STORY & SOURCES / CHAPTERS 的组件替换，随后将站点域名改为 https://gitlog.si/ 根路径，并指定后续浏览器使用 ego。

## Changes

- 章节卡片组合官方 BeUI BouncyAccordion，默认展开，保留章节直接播放与无锚点滚动。正文来源保持阅读排版，移除两个装饰英文标题。
- 进度使用主色全宽 RangeSlider + 当前/总时间；音量独立分隔、扬声器、短轨道、百分比。两者复用官方引擎，音频逻辑未替换。
- React public route 为 pathless `_public`，首页 `/`、后台 `/admin`；导航/canonical/API/RSS/audio/client scripts 移至根路径。
- Worker 新增 gitlog.si custom domain，保留旧域名的 reader 308 与 producer API 内部兼容；静态资源明确交给 Assets。
- 历史音频 URL 仅在展示时转换，D1/R2 与不可变修订不改；RSS GUID 保持原身份，链接/enclosure 使用新域名。
- 浏览器回归改为 ego-browser CLI heredoc，复用任务空间，最后单独清理；停止用 agent-browser 做新验收。

## Validation

- TypeScript 与 12 文件 / 40 项测试通过；新增根路径/旧链接/API body与鉴权兼容/音频转换/RSS身份测试。
- 本地真实 SQLite/HTTP 发布与审批、草稿隔离、409、音频HEAD/Range、动态RSS回归通过。
- 三套ego heredoc回归均exit0：public播放/Accordion/筛选/Sheet，slider pointer/keyboard/音量百分比/原生内容滚动，admin GET失败与重试/双栏/移动Tabs/dirty保留。
- 生产部署与新域名HTTPS待最终确认。

## Ownership

root：组件/播放器视觉、脚本/文档/测试集成、ego验收、部署。
sol_foundation：React根路径与公开音频展示归一化。
sol_services：Worker路由兼容、域名配置、音频与RSS转换、迁移测试。
sol_public：三个浏览器回归迁移到ego heredoc。


## Acceptance domain correction

New domain binding deployment succeeded (`8bfbe5b4-7ba8-4821-bfd4-c37bf1d9acdf`), but Cloudflare reports gitlog.si zone pending and public NS still points to Porkbun. The operator explicitly chose to validate on the established domain first. Active origin is therefore `https://blog.wuzhaoyi.xyz` with root paths, while gitlog.si stays configured for a later DNS cutover. This is the final acceptance scope; new-domain DNS is postponed by the operator.
