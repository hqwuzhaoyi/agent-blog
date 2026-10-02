# Cloudflare 发布接口

从用户配置的 Agent Blog checkout 执行：

```bash
npm run episode:publish -- --directory <本期产物目录> --day <YYYY-MM-DD> --dry-run
npm run episode:publish -- --directory <本期产物目录> --day <YYYY-MM-DD>
```

输入为 `episode.json`、`episode.mp3`、`episode.parts/manifest.json`、`publication.json` 和公开 `shownotes.md`。脚本完整解码音频，测量长度、章节和内容哈希，再调用带身份验证的 Worker API：音频上传到私有 R2，正文和章节写入 D1，验证 R2 对象后自动发布。无需 Git、PR、全站构建或 Worker 部署。单个 MP3 上传上限 25 MiB；更大的节目先调整编码或按应用文档扩展上传协议。

发布主机配置 `BLOG_SUBMIT_TOKEN`，或权限为 0600 的 `.agent-blog/publication-client.json`（`url` 与 `token`）；凭据不写进 Git、消息或节目素材。代理使用提交凭据，工作日志另需人工确认。`--dry-run` 只验证本地产物，不读写远端，不公开发布。

读取本期 `publication-result.json`，再验证节目页、RSS 和音频 HEAD/Range。页面及 RSS 从 D1 读取已发布内容，RSS 客户端下次拉取可见更新。仅上传最终混音 MP3，干声、WAV、素材、私有配置和制作记录保留本地。

日期确定节目身份，哈希确定音频地址；同内容重试幂等，修改已有节目时接口校验当前草稿版本，冲突后重新读取并重试。音频上传失败不会公开节目，内容写入失败可能留下未引用的 R2 音频对象；同一期重试即可，不删除旧节目或目录。

自动发布依据当前任务或既有明确授权。网站失败不阻断现有 Telegram 音频投递。应用部署、迁移和恢复见 checkout 的 `docs/CLOUDFLARE_DEPLOYMENT.md`；制作节目只使用发布 API。
