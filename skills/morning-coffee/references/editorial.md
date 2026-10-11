# 编稿与产物结构

用日常问题开场，接具体例子与主话题，再给通常3–5条短讯、编辑解读和思考式收尾。约800–1100中文字符、3–4分钟是常用目标，实际长度随素材与用户偏好调整。口播使用短句、自然过渡并解释必要术语，来源链接只放笔记。

个人体验标明是谁的体验；性能、容量与承诺保留条件。用“本期解读”标识节目自己的判断。解释用的类比明确是类比。使用独立节目名称。公开 AI 声明统一为「本期音频由 AI 合成语音生成。」；episode.disclosure、shownotes 和投递文案都使用这句话。音色、引擎和制作说明放在私有制作记录，来源观点的归属写在对应内容里。

`episode.json`：

```json
{
  "title": "这一期的标题",
  "disclosure": "本期音频由 AI 合成语音生成。",
  "segments": ["完整句构成的开场段落。", "主话题段落。", "接下来是今天的短讯。某团队发布了新的开发工具。", "本期解读和尾声。"],
  "sources": [
    { "topic": "原作者及主话题", "url": "https://example.com/original" },
    { "topic": "某团队发布了新的开发工具。", "url": "https://example.com/news" }
  ],
  "briefs": { "section": 2, "urls": ["https://example.com/news"] }
}
```

每段使用完整句，通常60–110字；单句不超过120字。渲染时可能进一步按句子拆分，manifest 的 `section` 仍指向原始 segments 的下标。

`publication.json`：

```json
{
  "summary": "一两句节目简介",
  "chapters": [
    { "title": "开场", "section": 0 },
    { "title": "主话题", "section": 1 },
    { "title": "短讯", "section": 2 },
    { "title": "本期解读与尾声", "section": 3 }
  ],
  "materials": [
    {
      "url": "https://example.com/original",
      "summary": "用自己的中文概括这条来源的关键信息，并保留作者观点的归属与条件。",
      "chapterSection": 1
    },
    {
      "url": "https://example.com/news",
      "summary": "某团队发布了新的开发工具。",
      "chapterSection": 2
    }
  ],
  "timeline": [{ "url": "https://example.com/news", "summary": "某团队发布了新的开发工具。" }]
}
```

选择4–6章，按实际段落顺序引用 manifest 中存在的 section。第一章包含开场；数字不是时间戳。章节校验脚本和博客发布器从实测时长计算时间，不接受估算。

公开 `shownotes.md` 包含开场钩子、本期内容、标注的编辑解读、编号来源与AI声明。私有 `notes.md` 另外保存音色、渲染过程、配乐署名和错误记录。成品 `episode.mp3`、干声 `episode.voice.mp3`、分段 WAV 和 manifest 保存在本期目录；公开发布只使用成品MP3和公开文稿。


## 咖啡豆

完成选材后，为 `episode.json.sources` 中每个来源在 `publication.json.materials` 写一条中文整理，按节目叙事顺序排列。每条只含同一原文 `url`、1–3句 `summary`，以及能准确对应时的 `chapterSection`（引用上面已选章节的 section）。缺少明确章节对应时省略该字段。摘要说明素材的内容，不复制完整原文、转写或制作笔记。署名缺失时可用 `author` 补充快照中能确认的公开作者/机构名。

保留本期 `feed.json`。发布器仅从入选 URL 对应条目补齐作者、平台、原始发表时间和原题；缺失时间保持为空，不用采集日期冒充。频道或播放列表链接保留其真实类型，不写成精确单期链接。网页把入选素材与当天动态按 URL 合并；入选来源置前，每条只展示一次，保留章节按钮。timeline 中文摘要优先展示，缺失时使用 material 摘要；推文原文可展开查看。原始转写、社交计数、feed 配置与制作记录继续留在本地。

## 动态摘要与短讯口播

为 `feed.json` 全部有效条目（推文、播客/频道、文章）逐条写一句中文摘要到 `publication.json.timeline`，每条为 `{url, summary}`。URL 逐字取自快照；摘要保留作者归属与不确定性，仅依据快照。中文摘要是网页主文案，原文默认折叠。网页「咖啡豆」是 materials 与 timeline 的去重并集，条数按去重后的 URL 计算。

### 短讯口播

每期新制作必须有独立的「短讯」音频章节，通常精选3–5条有信息量、与主话题不重复的动态。足量素材不足时读实际可用条数；确无可用短讯则报告无更新，不虚构内容。全量动态仍保留在网页，不为凑时长逐条念社交闲聊。

1. 把选中的 URL 写入 `episode.briefs.urls`，并纳入 `episode.sources`。`briefs.section` 指向承载该章的 `segments` 下标，不能指向开场。
2. 将这些 URL 对应的 `publication.timeline[].summary` 完整纳入该段口播，前面加自然过渡，条目间用完整句连接。该段可包含多句，渲染器会拆为不超过120字的 TTS 请求，所有分片保留同一 section。链接只写在网页。
3. `publication.chapters` 必须有且只有一章名为「短讯」，其 section 等于 `briefs.section`。每条播报短讯在 `publication.materials` 中的 `chapterSection` 也指向这里，网页据此提供播放入口。
4. 合成前运行 `node <skill>/scripts/validate-briefs.mjs --directory <本期目录>`。检查选定来源、网页摘要、口播文字及章节关联齐全后才合成。
5. 合成后加 `--measured` 再运行同一命令；它要求该章的 manifest 分片连续、有正的实测时长，且拼接文字与口播段落完全一致。随后用 measure-chapters 计算真实时间轴，并在交付短帖中列出「短讯」。

旧节目可保留没有 `briefs` 的历史格式，不给未录制内容补假时间戳；新一期制作始终先通过上述校验。发布器对带 `briefs` 的输入也执行实测校验，避免旧音频与新口播混用。
