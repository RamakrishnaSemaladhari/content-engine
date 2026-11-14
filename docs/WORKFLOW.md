# End-to-end workflow (nothing publishes automatically)

```
GitHub Actions "Daily Research Queue" (manual now; schedule block ready, commented out)
  -> Content Engine Worker: finds stories -> AI writes an UNPUBLISHED draft (Workers AI, Ollama fallback)
  -> Staff clicks "Import research drafts" in the Insights admin (reads engine D1 via CONTENT_DB, SELECT only) -> article status = draft
  -> Editor edits + submits -> Reviewer approves -> Publisher publishes  (separate roles/actions, all audited)
  -> Public: UI Worker serves /, /insights/{slug}, /sitemap.xml, /feed.xml from published articles only
```
Browser -> `fivecheckmate-blog-preview` (UI) -> `fivecheckmate-insights-staging-v2` (API) -> D1 `fivecheckmate-insights-staging`.
Engine: `fivecheckmate-content-engine` + D1 `fivecheckmate-content-engine` (read by the API only through `CONTENT_DB`).

## Secrets (names only)
Insights API: `SESSION_SECRET`, `BOOTSTRAP_TOKEN` (existing, unchanged). Engine Worker + GitHub: `ENGINE_API_TOKEN`, `ENGINE_API_URL` (existing, unchanged). No new secrets are required by this workflow.

## Deploy (staging only)
1. `cd insights && npm test`; `npx wrangler deploy` (keeps existing secrets). The staging D1 already has `engine_draft_id`; do NOT re-run migration 0002 there.
2. Create the first administrator in the staging UI (Staff login -> setup, using the existing bootstrap token).
3. Run the engine (see docs/REPAIR_REPORT.md), import the draft, review it, publish it by hand.
