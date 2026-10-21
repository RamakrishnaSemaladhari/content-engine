# Content Engine v0.3.0 repair and validation report

Statuses distinguish automated test evidence from live deployment evidence. A mocked test passing does not establish that the connected Cloudflare account, GitHub secrets, free quota, or editorial portal works end-to-end.

| Item | Status | Evidence / next action |
|---|---|---|
| RSS + Atom parsing, entities/CDATA, malformed input | PASS — unit tests reported | Re-run `npm test` on the reviewed PR head before deployment. |
| Per-feed isolation, bounded timeout/retry, size cap | PASS — mocked tests reported | Confirm actual feed diagnostics after deployment. |
| Date and minimum-score filters | PASS — unit tests reported | Confirm shortlist contents in live manual run. |
| Controlled outcomes `NO_USABLE_SOURCES` and `SOURCE_FETCH_FAILED` | PASS — unit tests reported | Verify response behavior against live feeds. |
| RSS diagnostics endpoint | PASS — mocked / NOT TESTED live | Run `diagnostics` from GitHub Actions. |
| Workflow authentication and safe error handling | PASS — mocked / NOT TESTED live | Confirm GitHub `ENGINE_API_TOKEN` matches Worker secret without printing either value. |
| Earlier source-discovery issue | Reported fixed in code | Historical D1 inspection found a previous job with collected sources; recheck current feed diagnostics. |
| Current live health endpoint | NOT VERIFIED for this PR head | Confirm HTTP 200 after deployment. |
| Two-day queue: Day 1 shortlist with no AI | PASS — mocked tests reported / NOT TESTED live | Verify actual Workers AI is not invoked in shortlist phase. |
| Candidate select/reject and D1 persistence | PASS — mocked tests reported / NOT TESTED live | Exercise workflow inputs with real candidate IDs. |
| Day 2 drafts only for selected candidates | PASS — mocked tests reported / NOT TESTED live | Confirm selected-only behavior and bounded per-run count. |
| Workers AI quota exhaustion | PASS — mocked tests reported / NOT TESTED live | Confirm run stops, selected work remains queued, and no provider switch or paid fallback occurs. |
| Draft status | PASS by design/tests reported / NOT TESTED live | Confirm saved draft is `UNPUBLISHED` and not publicly accessible. |
| D1 migration `0002_two_day_queue.sql` | AVAILABLE / NOT APPLIED by this change | Apply to the engine D1 only after confirming account and database. |
| Editorial portal import and manual review/publishing | Staging portal reported to support import; full E2E NOT TESTED | Import a test draft, edit it, follow the review flow, and verify public visibility only after explicit publication. |
| Original-page fact corroboration | NOT IMPLEMENTED | Editors must open the original report and verify factual claims. |
| Scheduled automation | DISABLED | Keep schedule commented out until all live manual acceptance checks pass. |
| Production website Workers/DNS | MUST REMAIN UNCHANGED | Do not deploy to `fivecheckmate` or `5checkmate`, or change production DNS as part of this engine validation. |

## Current workflow

The GitHub Actions workflow is `.github/workflows/daily-research.yml`, displayed as **Editorial Queue**.

1. Run `diagnostics`.
2. Run `shortlist` on Day 1. This phase uses no AI.
3. Review the run summary and use `select` / `reject` with candidate IDs.
4. Run `draft` on Day 2 for selected stories only (one article per request; up to three requests per run).
5. Import generated drafts into the Insights editorial portal. Verify the original report, edit, and approve/publish manually.

## Free-tier behavior

The intended provider is the existing Cloudflare Workers AI binding. There is no Gemini key, Copilot CLI, local Ollama fallback, provider switching, or paid fallback in this design. On quota exhaustion the run should stop and leave selected stories queued for a later run. This behavior must be confirmed live before acceptance.

## Deployment documentation

`cloudflare/DEPLOYMENT.md` is the authoritative manual deployment and staging acceptance checklist. It was updated in this branch to remove the obsolete local-Ollama handoff instructions and clarify that live checks remain outstanding.
