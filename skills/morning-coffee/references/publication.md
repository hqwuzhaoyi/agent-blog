# Cloudflare 发布接口

从用户配置的 Agent Blog checkout 执行：

```bash
npm run episode:publish -- --directory <本期产物目录> --day <YYYY-MM-DD> --dry-run
npm run episode:publish -- --directory <本期产物目录> --day <YYYY-MM-DD>
```

输入为 `episode.json`、`episode.mp3`、`episode.parts/manifest.json`、`publication.json` 和公开 `shownotes.md`；有本期 `feed.json` 时一并读取，用于来源元数据与当日时间线。脚本完整解码音频，测量长度、章节和内容哈希，再调用带身份验证的 Worker API：音频上传到私有 R2，正文、章节、入选素材卡片和当日时间线写入 D1，验证 R2 对象后自动发布。无需 Git、PR、全站构建或 Worker 部署。单个 MP3 上传上限 25 MiB；更大的节目先调整编码或按应用文档扩展上传协议。

发布主机配置 `BLOG_SUBMIT_TOKEN`，或权限为 0600 的 `.agent-blog/publication-client.json`（`url` 与 `token`）；凭据不写进 Git、消息或节目素材。代理使用提交凭据，工作日志另需人工确认。`--dry-run` 只验证本地产物，不读写远端，不公开发布。

读取本期 `publication-result.json`，再验证节目页、RSS 和音频 HEAD/Range。页面及 RSS 从 D1 读取已发布内容，RSS 客户端下次拉取可见更新。仅上传最终混音 MP3 和白名单公开字段。网页「咖啡豆」合并 `episode.json.sources` / `publication.json.materials` 中的入选来源，以及从 `feed.json` 生成的当日动态；按 URL 去重，入选条目置前，保留作者、原始日期、来源链接和实测章节入口。`publication.timeline` 为全部动态提供中文摘要，原文折叠展示。短讯口播与独立章节的完整要求见 [编稿规范](editorial.md#短讯口播)，发布带 `episode.briefs` 的节目时会核对该章的合成 manifest。原始转写、干声、WAV、feed 配置和制作记录保留本地。

日期确定节目身份，哈希确定音频地址；同内容重试幂等，修改已有节目时接口校验当前草稿版本，冲突后重新读取并重试。音频上传失败不会公开节目，内容写入失败可能留下未引用的 R2 音频对象；同一期重试即可，不删除旧节目或目录。

自动发布依据当前任务或既有明确授权。网站失败不阻断现有 Telegram 音频投递。应用部署、迁移和恢复见 checkout 的 `docs/CLOUDFLARE_DEPLOYMENT.md`；制作节目只使用发布 API。

## 节目页结构与视觉规范

- 网页板块标题为「咖啡豆」，副标题为「每天几颗 AI 新鲜事，随咖啡一起读。」；音频里的独立播报章节仍命名「短讯」。
- 页面顺序：正文 shownotes → 咖啡豆（入选来源与当日动态合并、按 URL 去重）。入选来源置前，标识「入选本期」，有实测章节时提供播放按钮；其余动态保留原始顺序。
- 右侧小字号页内目录和本期章节共用侧栏；手机端随正文滚动。旧的素材、短讯锚点均指向统一来源区域。
- 中文摘要为主文案，原文默认折叠；层级用字号、字重和留白表达，入选条目使用细竖线。重复查看的列表不加入场 stagger。
- Hover 效果仅用于支持 hover 的精细指针，过渡限定具体属性；遵循 reduced-motion。
- X 头像按 handle 经 unavatar.io 拉取，编稿无需提供图片。

## 补发上线新 UI 能力

页面渲染由 Worker 代码决定，节目数据由 D1 revision 决定，两者独立演进。现有 materials / timeline 的合并展示只需部署 Worker，不改节目 revision 或音频。确实缺少数据字段时，才从该期真实产物重新发布 metadata；新增口播内容则必须重新合成并测量成品，不得给旧录音增加虚构的短讯章节。历史音频重制与重新投递需有对应用户指令。
