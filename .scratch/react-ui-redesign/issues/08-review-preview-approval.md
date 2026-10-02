# 08: 完整预览与人工确认发布

**What to build:** 完整 Review Draft 预览后确认当前保存版本，公开文章随真实服务结果更新。

**Blocked by:** 07: 后台登录与待确认列表.

**Status:** ready-for-agent

**Execution:** completed

- [x] 详情复用公开文章渲染与 HTML 清洗，显示标题、日期、版本与公开地址。
- [x] 只读 capability 预览保持无登录可读且不能审批。
- [x] 批准请求绑定所见保存版本，成功返回真实时间、revision 与公开链接。
- [x] 版本改变返回 409 并要求重新查看，错误不显示假成功。
- [x] 公开指针及审计原子更新；无 PR、批量批准或额外确认框。

## Comments

2026-10-02 (Sol admin): Implemented shared Article preview, sanitized full saved-body rendering, revision-bound approval and read-only capability React SSR. HTTP tests verify cookie protection, token denial and409. Isolated browser saved private draft URL returned404; explicit approval changed URL to200 and displayed actual publication timestamp/audit. No production writes.

2026-10-02 (Sol admin): Actual browser409 recovery completed using a separate HTTP client (no network mocks): old saved preview rejected after concurrent save, refresh showed updated full body/title, and explicit new-version approval returned actual publication time and audit revision. Synthetic content exists only in isolated local preview storage.

## Integration evidence

2026-10-02: Sol team implementation integrated; TypeScript, 36 tests, isolated runtime HTTP contracts and real browser public/admin workflows passed. Root production preflight verified the canonical D1/R2 bindings and excluded local credentials/audio.
