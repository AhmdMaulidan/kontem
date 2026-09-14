# Analyzer Pivot — Checklist

## Goal
Pivot the `/admin/analyzer` workflow: input URL video + brief → send to API agent AI → API returns one of:
1. **Diterima** (`APPROVED`)
2. **Ditolak** (`REJECTED`)
3. **Butuh Verifikasi Admin** (`NEEDS_VERIFICATION`)

Each with a `reason`. API not built yet — web defines the contract.

---

## ✅ Done

| # | File | Change | Status |
|---|------|--------|--------|
| 1 | `prisma/schema.prisma` | `enum AnalysisDecision` + `brief`/`decision`/`reason` fields + `@@index([decision])` | ✅ |
| 2 | `prisma/migrations/20260914120000_video_analysis_decision/migration.sql` | Migration SQL | ✅ |
| 3 | `src/domain/analyze.ts` | `brief` in request schema; `decision`/`reason` required (no defaults) | ✅ |
| 4 | `src/app/admin/analyzer/actions.ts` | Accepts `brief`, derives from campaign, stores to columns, platform mapping, structured `result` return | ✅ |
| 5 | `src/lib/analyze-client.ts` | Constants renamed (`API_URL`/`API_KEY`), `Authorization: Bearer` header, mock fallback kept (Option A) | ✅ |
| 6 | `src/lib/labels.ts` | `analysisDecisionLabel` + `analysisDecisionTone` added | ✅ |
| 7 | `src/app/admin/analyzer/analyze-url-form.tsx` | Brief textarea + verdict result card with badge + link | ✅ |
| 8 | `src/app/admin/analyzer/recent-analyses.tsx` | Uses `decision` column from DB | ✅ |
| 9 | `src/app/admin/analyzer/report/[analysisId]/page.tsx` | Shows brief card + decision/reason columns | ✅ |
| 10 | `src/app/admin/analyzer/page.tsx` | Updated PageHeader copy | ✅ |
| 11 | `ANALYZE-API.md` | API contract doc (request/response schema, 3 decisions, env config) | ✅ |

---

## What you need to run

```bash
pnpm prisma generate        # regenerate client with new AnalysisDecision enum
pnpm prisma migrate dev     # apply migration (adds columns)
pnpm typecheck              # verify no TS errors
pnpm dev                    # test the flow
```

## API Contract Summary

See `ANALYZE-API.md` for full details. Quick reference:

**Request:** `POST /api/analyze` with `{ url, brief, rules?, platform? }`
**Response:** `{ decision: "APPROVED"|"REJECTED"|"NEEDS_VERIFICATION", reason: string, score?, ... }`

**Env config:**
- `ANALYZE_API_URL` — your API base URL (default `http://localhost:8000`)
- `ANALYZE_API_KEY` — Bearer token (optional)
- `ANALYZE_API_TIMEOUT` — timeout in ms (default 30000)

**Mock fallback:** If API is unreachable, keyword-based mock fires (URL contains "reject" → REJECTED, "verify" → NEEDS_VERIFICATION, else APPROVED).
