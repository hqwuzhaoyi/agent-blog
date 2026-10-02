# Cloudflare 发布接口

本技能配合实现了 `scripts/publish-episode.mjs` 的 Agent Blog checkout 使用，部署宿主和目标由用户配置。确认该脚本和 `wrangler.jsonc` 存在，并检查配置中的站点、账户、Worker 与 R2 bucket 是否属于这次任务。缺少部署实现时先补齐应用集成，不能凭技能说明声称已经上线。

从博客目录执行：

```bash
npm run episode:publish -- --directory <本期产物目录> --day <YYYY-MM-DD> --dry-run
npm run episode:publish -- --directory <本期产物目录> --day <YYYY-MM-DD>
```

该接口需要 `episode.json`、`episode.mp3`、`episode.parts/manifest.json`、`publication.json` 和 `shownotes.md`。它检查音频、计算章节和内容哈希，从私有R2恢复以往已发布文稿，构建页面，上传成品及文稿，更新节目目录并部署Workers。按实际返回状态判断结果，读取本期 `publication-result.json`。dry-run 可能读取远端数据并写本地构建，但不得上传或公开发布。

首次部署需配置Workers、私有R2 bucket、公开站点地址与Wrangler认证，并初始化节目目录。这些是应用部署任务，依照当前用户授权执行；默认不随制作节目顺手修改DNS或创建服务。详细部署和恢复步骤以该checkout的 `docs/CLOUDFLARE_DEPLOYMENT.md` 为准。

公开验证包括节目页、完整或Range音频请求、RSS中音频URL/MIME/真实字节长度。Range应支持播放器拖动。只上传最终混音MP3，干声、WAV、私有配置和制作记录保留本地。上传路径使用日期与内容哈希，重试同一期不会新增不同身份。

构建失败时不写远端。上传或部署中断可能留下R2对象而网站仍是旧版；针对同一期重试发布即可，不清空节目目录。使用同一发布宿主串行部署，避免不同进程用旧节目目录覆盖新内容。

自动发布必须来自当前指令或既有任务的明确授权，不把技能安装等同于自动发布授权。保留其他内容的既有审核规则。Cloudflare认证放私有环境或Wrangler登录状态，Git中只提交代码与已授权公开内容。
