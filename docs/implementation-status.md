# Implementation Status

## Frozen decisions
- [x] GitHub Actions triggers research (manual only until acceptance).
- [x] AI generation uses online GitHub Copilot CLI from the GitHub-hosted runner.
- [x] No local Ollama, llama.cpp, GGUF model download or local model inference.
- [x] Cloudflare Worker + D1 persist jobs, sources, checkpoints, drafts and audit events.
- [x] Drafts remain private and unpublished by default.
- [x] Automatic publishing and scheduled runs remain disabled until acceptance tests pass.
- [x] No production Worker or DNS changes in this change.

## Implemented in branch freeze-github-runner-ai-workflow
- [x] Worker research flow checkpoints a task for GitHub Actions online inference.
- [x] Runner claim lease is 30 minutes.
- [x] Added generic runner claim/completion routes; legacy /api/local/* endpoints remain aliases for compatibility with existing staged callers.
- [x] GitHub Actions installs GitHub Copilot CLI and invokes online model inference; no inference runtime or model weights are installed.
- [x] Runner validates structured output and submits it through the authenticated completion API.
- [x] Worker stores the resulting draft as unpublished.
- [ ] Configure and verify Actions secrets ENGINE_API_URL, ENGINE_API_TOKEN and COPILOT_PAT.
- [ ] Confirm Copilot entitlement/token and test model availability on GitHub-hosted runner.
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
- GET /api/drafts and GET /api/drafts/{id}: authenticated draft inspection.
- The browser must never receive the shared engine or Copilot token.

## Known research limitation
Discovery uses Google News RSS metadata/snippets and scoring. It does not independently fetch and corroborate two or more full publisher pages. Generated drafts must be marked for source verification and must not auto-publish.
