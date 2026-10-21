# Repair report v0.2.0  (PASS / FAIL / NOT TESTED / BLOCKED)

| Item | Status | Notes |
|---|---|---|
| Worker live, /api/health | PASS | returned ok (v0.1.1) from the public internet before this patch |
| RSS + Atom parsing, entities/CDATA, malformed input | PASS | unit tests (cloudflare/test) |
| Per-feed isolation, 8s timeout, 1.5MB cap, bounded retry | PASS | unit tests with mocked fetch |
| Date (maxAgeDays) and minimumDraftScore now enforced | PASS | unit tests |
| Controlled outcomes: NO_USABLE_SOURCES (HTTP 200) vs SOURCE_FETCH_FAILED (502) | PASS | replaces blanket 503 |
| GET/POST /api/diagnostics/rss (auth required, returns counts only) | PASS (mock) / NOT TESTED live | |
| Workflow: 401/403/404 stop with clear message; 429/5xx retried 3x; token never logged | PASS vs mock server | |
| Root cause of the earlier 503 | VERIFIED via D1 (read-only) | Source discovery now works: job fc-20261018 collected 37 sources. The 503/NO_SOURCES was the old regex bug (already fixed on main). |
| Why no draft exists | VERIFIED (symptom) / cause NOT YET KNOWN | Job is LOCAL_AI_PENDING with AI_UNAVAILABLE: the Workers AI call threw, old code stored only a generic code, and no local Ollama worker is running. This PR now stores the real error text and retries cloud AI up to 3 times. |
| (superseded) Root cause of the earlier 503 | Old code returned 503 only when 0 candidates came back. Likely feeds blocked/empty from Cloudflare IPs, or Google returned HTML. Run diagnostics after deploy to see the exact per-feed reason. (The old getTag regex looked wrong but worked by accident.) |
| Earlier 401 | NOT VERIFIED | Means GitHub secret != Worker secret. Re-set both to the same new value. |
| Live end-to-end (AI draft, D1 rows, local Ollama) | NOT TESTED | needs your Cloudflare/GitHub access |
| Admin UI, approve/publish, sitemap, CMS adapter | BLOCKED | fivecheckmate.com is static HTML with no blog or sitemap.xml; blog platform must be decided first |
| Admin session auth / rate limiting / roles | NOT DONE | still shared bearer token |
| Independent two-publisher corroboration | NOT DONE | candidates are headlines, not verified facts |

No schema migration is needed: diagnostics are stored in the existing `checkpoints` table.

| Engine AI error capture + bounded cloud retry | PASS | pipeline tests (mock AI) |
| Two-day queue: Day 1 no-AI shortlist, human select/reject, Day 2 one-article drafts, quota stop, bounded retries | PASS (mock AI, in-memory D1) / NOT TESTED live | 17 tests; migration 0002 must be applied by the owner |
| Original-page cross-check of facts | NOT DONE | editor must verify against the original report |
