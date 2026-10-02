# 09: 草稿编辑、保存与冲突处理

**What to build:** 操作者可私密编辑 Review Draft，保存新版本并在重新预览后确认。

**Blocked by:** 08: 完整预览与人工确认发布.

**Status:** ready-for-agent

**Execution:** completed

- [x] 标题、摘要、允许的 metadata 与正文保存产生真实新修订。
- [x] 旧 Published Review 保持公开，保存不会批准。
- [x] 未保存、预览不完整及请求中禁止确认，离开不会静默丢失编辑。
- [x] expectedRevision 控制并发，409 有刷新和重新审核路径。
- [x] 浏览器验证保存、失败、重试和新版本批准的完整流程。

## Comments

2026-10-02 (Sol admin): Implemented title/summary/source/date/body editor, private save, unsaved-navigation guard, disable approval while dirty/requesting/stale and409 refresh. HTTP verifies saved draft retains old published pointer. Browser edit disabled approval; save loaded new full saved preview. Parallel conflict verified HTTP; browser conflict acceptance remains pending.

2026-10-02 (Sol admin): Replaced document-anchor interception with TanStack useBlocker plus native modal resolver and dirty-only beforeunload. Actual SPA list→detail→dirty edit→browser Back displayed the discard choice. Continue editing preserved the unsaved title; a second Back and explicit discard returned to the previous list. Decimal pagination normalization now has HTTP regression assertions.

2026-10-02 (Sol admin): Actual browser failure/retry observed against isolated HTTP backend: source over200 characters returned422 and readable content-format error, preserving editable local source and disabling approval. Correcting source and saving succeeded, loaded the new complete saved preview and enabled explicit approval. Concurrent approval409 recovery also verified: another real HTTP client saved a new revision after browser preview; old-preview approval displayed stale error and disabled confirmation; refresh loaded updated title/body and a new explicit approval succeeded.

## Integration evidence

2026-10-02: Sol team implementation integrated; TypeScript, 36 tests, isolated runtime HTTP contracts and real browser public/admin workflows passed. Root production preflight verified the canonical D1/R2 bindings and excluded local credentials/audio.
