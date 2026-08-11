# Project Context

Team-shared knowledge about this codebase. Read by agents during
scoping and domain analysis. Entries expire after 90 days by default.

Managed by: `/project-context` — do not edit manually.

---

## Active

### 2026-08-11 — Image format pipeline was semi-implemented; explicit imageFormat field added
**Expires:** 2026-11-09
**Scope:** global
Before 2026-08-11 the format was implicit: `imageQuality < 100` meant JPEG.
Now `Settings.imageFormat: 'png' | 'jpeg'` is the single source of truth;
`imageQuality` only controls JPEG quality (slider 50-100). Old stored
settings without `imageFormat` are derived from `imageQuality` at load.

---

### 2026-08-11 — Region capture used to ignore the format setting
**Expires:** 2026-11-09
**Scope:** content
`src/content/content.ts` region cropping hardcoded `toDataURL('image/png')`
and ignored the format/quality options passed by background. Fixed in the
format-selection feature — keep region crop in sync when touching capture paths.

---

### 2026-08-11 — Repo had zero unit tests until the format feature
**Expires:** 2026-11-09
**Scope:** global
Vitest was configured but no test files existed. First tests live next to
`src/utils/image-format.ts` (pure functions). `npm run test` = vitest run.

---

### 2026-08-11 — Vite build does NOT type-check (esbuild)
**Expires:** 2026-11-09
**Scope:** global
`npm run build` skips TypeScript type checking. Run `npm run typecheck`
(`tsc --noEmit`) before committing; CI enforces it.

---

### 2026-08-11 — CI (GitHub Actions) created during format feature
**Expires:** 2026-11-09
**Scope:** global
Repo had no `.github/workflows` before 2026-08-11. Now: lint → typecheck →
test → build on push/PR. DesignSpec.md §七 had planned this.

---
