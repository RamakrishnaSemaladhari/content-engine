# Implementation Status

## Frozen decisions
- [x] GitHub Actions triggers research manually only until acceptance.
- [x] AI generation uses the Google Gemini API Free tier from a GitHub-hosted runner.
- [x] No Copilot CLI, paid AI fallback, local Ollama, llama.cpp, GGUF download or local model inference.
- [x] Cloudflare Worker + D1 persist jobs, sources, checkpoints, drafts and audit events.
- [x] Drafts remain private and unpublished by default.
- [x] Automatic publishing and scheduled runs remain disabled until acceptance tests pass.
- [x] Workflow fails closed unless GEMINI_FREE_TIER_CONFIRMED=true.
- [x] AI project must remain on Free tier without a linked billing account; no upgrade when quota is exhausted.
- [x] Actions job timeout is limited to 10 minutes per run; this is not itself a billing guarantee.
- [ ] Verify the Google AI Studio project is Free tier and has no linked billing account before setting the gate.
- [ ] Verify applicable GitHub Actions usage hard stop and billing settings.
- [x] No production Worker or DNS changes in this change.

## Implemented in branch freeze-github-runner-ai-workflow
- [x] Worker research flow checkpoints a task for GitHub Actions online inference.
- [x] RSS/Atom feed repair, bounded retries/timeouts, source scoring, canonical deduplication and feed diagnostics are included.
- [x] Runner claim lease is 30 minutes.
- [x] Generic runner claim/completion routes are present; legacy /api/local/* endpoints remain compatibility aliases.
- [x] GitHub Actions uses Gemini API Free-tier inference; no model runtime or weights are installed.
- [x] Runner validates structured output and submits it through the authenticated completion API.
- [x] Worker stores the resulting draft as unpublished.
- [ ] Configure Actions secrets ENGINE_API_URL, ENGINE_API_TOKEN and GEMINI_API_KEY, plus variable GEMINI_FREE_TIER_CONFIRMED after checking billing status.
- [ ] Confirm the selected Gemini model is available to the Free-tier project.
- [ ] Run the live Actions workflow and verify D1 rows, task checkpoint, private draft and audit event.
- [x] Staging Insights API import endpoint and admin UI control are present in the branch.
- [ ] Verify login, edit, preview, publish, unpublish, delete unpublished draft, role enforcement and audit history end-to-end.
- [ ] Verify public article URL and sitemap update without deploying the website.
- [ ] Verify unauthenticated users cannot read drafts or invoke publish/delete endpoints.
- [ ] Keep the schedule disabled until all acceptance checks pass.

## Content-engine API
- GET /api/health: minimal health response.
- POST /api/run/daily: authenticated discovery and task checkpoint.
- POST /api/runner/claim: authenticated claim of an online-AI task.
- POST /api/runner/complete: authenticated result submission; stores a private draft.
- Legacy POST /api/local/claim and /api/local/complete remain compatibility aliases only; they do not run local AI.
- D1 retains LOCAL_AI_PENDING internally for compatibility; API status and audit details identify the online GitHub runner.
- GET /api/drafts and GET /api/drafts/{id}: authenticated draft inspection.
- The browser must never receive the shared engine token or Gemini API key.

## Known research limitation
Discovery uses Google News RSS metadata/snippets and scoring. It does not independently fetch and corroborate publisher pages. Generated drafts must be marked for source verification and must not auto-publish.
