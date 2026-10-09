# Cloudflare 发布接口

从用户配置的 Agent Blog checkout 执行：

```bash
npm run episode:publish -- --directory <本期产物目录> --day <YYYY-MM-DD> --dry-run
npm run episode:publish -- --directory <本期产物目录> --day <YYYY-MM-DD>
```

输入为 `episode.json`、`episode.mp3`、`episode.parts/manifest.json`、`publication.json` 和公开 `shownotes.md`；有本期 `feed.json` 时一并读取，用于来源元数据与当日时间线。脚本完整解码音频，测量长度、章节和内容哈希，再调用带身份验证的 Worker API：音频上传到私有 R2，正文、章节、入选素材卡片和当日时间线写入 D1，验证 R2 对象后自动发布。无需 Git、PR、全站构建或 Worker 部署。单个 MP3 上传上限 25 MiB；更大的节目先调整编码或按应用文档扩展上传协议。

发布主机配置 `BLOG_SUBMIT_TOKEN`，或权限为 0600 的 `.agent-blog/publication-client.json`（`url` 与 `token`）；凭据不写进 Git、消息或节目素材。代理使用提交凭据，工作日志另需人工确认。`--dry-run` 只验证本地产物，不读写远端，不公开发布。

读取本期 `publication-result.json`，再验证节目页、RSS 和音频 HEAD/Range。页面及 RSS 从 D1 读取已发布内容，RSS 客户端下次拉取可见更新。仅上传最终混音 MP3 和白名单公开字段。网页素材卡片来自 `episode.json.sources` 与 `publication.json.materials`；节目页底部「短讯」小节由发布器从 `feed.json` 自动生成（全部推文加播客/频道条目，按原始发表时间排序），其中每条的中文一句摘要来自 `publication.json.timeline`（`[{url, summary}]`，url 与 feed.json 逐字一致）——编稿必须为全部条目写摘要，缺摘要的条目只剩英文原文。X 头像由页面对 x 条目按 handle 经 unavatar.io 自动拉取，无需数据提供。`feed.json` 只用于本地匹配，原始转写、未入选素材、干声、WAV、私有配置和制作记录保留本地。

日期确定节目身份，哈希确定音频地址；同内容重试幂等，修改已有节目时接口校验当前草稿版本，冲突后重新读取并重试。音频上传失败不会公开节目，内容写入失败可能留下未引用的 R2 音频对象；同一期重试即可，不删除旧节目或目录。

自动发布依据当前任务或既有明确授权。网站失败不阻断现有 Telegram 音频投递。应用部署、迁移和恢复见 checkout 的 `docs/CLOUDFLARE_DEPLOYMENT.md`；制作节目只使用发布 API。

## 节目页结构与视觉规范（用户批准，勿随意改动）

- 板块顺序固定为：正文 shownotes → 本期素材（入选来源卡片）→ 短讯（当日全部推送）。用户明确要求素材卡片紧随 shownotes 之后、短讯固定在最底部；调整顺序前先问。
- 小节名称用「短讯」，不用「时间线/当日推送」。
- 页面 UI 动效与布局按 Emil Kowalski 的 design-engineering 推荐（github.com/emilkowalski/skills）：自定义强 ease-out 曲线 `cubic-bezier(0.23,1,0.32,1)`、只过渡具体属性（禁 `transition: all`）、hover 效果包在 `@media (hover:hover) and (pointer:fine)`、`:active` 按压反馈、列表入场 stagger（30–80ms 间隔，`prefers-reduced-motion` 守卫）、层级用颜色深浅与字重表达而非高亮色块（入选条目用左侧主色竖线，不用整块底色）。中文摘要是主文案（前景色），英文原文降为次要灰。
- X 条目头像由页面按 handle 经 unavatar.io 拉取；新增来源类型时沿用「能自动拉取就不让编稿手工提供」的原则。

## 补发上线新 UI 能力

页面渲染由 Worker 代码决定，节目数据由 D1 revision 决定，两者独立演进。要让已发布节目用上新页面功能（如素材卡片、当日时间线），需要两步：先 `npm run deploy` 部署新 Worker（需 Wrangler 部署权限，与 episode:publish 的纯 API 发布不同），再对该期产物重跑 `episode:publish` 生成含新字段的 revision。音频按内容哈希寻址，重跑不会重复上传音频。
