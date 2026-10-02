# 01: 发布服务去除 Astro 耦合

**What to build:** 现有提交、版本确认和音频发布服务可供新旧应用复用，保留线上行为。

**Blocked by:** None (can start immediately).

**Status:** ready-for-agent

**Execution:** completed

- [x] 服务端内容类型与校验不依赖 Astro，旧应用仍可运行。
- [x] 同一期/同身份重试幂等，草稿与公开指针保持分离。
- [x] 审核凭据、只读预览和提交凭据权限不变。
- [x] 复用现有真实 SQLite 发布及音频协议测试验证外部行为。

## Comments

2026-10-02: 发布校验改用直接 zod 依赖；新增 `cloudflare/content-models.ts` 的框架无关公开条目和数据库接口，保留 `src/lib/content-store.ts` 查询契约与 Date 日期。现有旧 Astro 检查通过（74 files, 0 errors），真实 SQLite 发布与 HTTP 音频测试通过（2 files, 8 tests）。未改动数据库、R2、凭据或部署。

## Integration evidence

2026-10-02: Sol team implementation integrated; TypeScript, 36 tests, isolated runtime HTTP contracts and real browser public/admin workflows passed. Root production preflight verified the canonical D1/R2 bindings and excluded local credentials/audio.
