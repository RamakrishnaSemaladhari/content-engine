# Implementation Status

## Frozen decisions
- [x] GitHub Actions triggers the research workflow.
- [x] AI drafting runs locally on the GitHub-hosted runner using a CPU quantized open-weight model.
- [x] No local Ollama, Workers AI inference, or paid AI API.
- [x] Cloudflare Worker + D1 persist jobs, sources, checkpoints, drafts and audit events.
- [x] Drafts remain private and unpublished by default.
- [x] Existing public site must render published articles dynamically without a deployment for each article.
- [x] Unpublished unqualified drafts must be deletable from authenticated admin UI.
- [x] Automatic publishing and scheduled runs remain disabled until acceptance tests pass.

## Implemented in branch freeze-github-runner-ai-workflow
- [x] Worker research flow always checkpoints a task for GitHub runner inference; Workers AI path removed.
- [x] Runner claim lease extended to 30 minutes to cover CPU inference.
- [x] GitHub Actions installs CPU-only llama.cpp Python runtime and downloads Qwen2.5-3B-Instruct GGUF to the temporary runner.
- [x] Runner submits generated structured article through authenticated completion API.
- [x] Worker returns draft as unpublished; model is instructed to flag insufficient evidence.
- [ ] Validate package wheel installation and actual model filename/download on GitHub-hosted runner.
- [ ] Confirm repository secrets are configured and run a real Actions job.
- [ ] Confirm resulting D1 rows, checkpoint, draft status and audit event.
- [ ] Integrate content-engine drafts with the existing authenticated Insights admin/publishing backend.
- [ ] Verify login, edit, preview, publish, unpublish, delete unpublished draft, role enforcement and audit history end-to-end.
- [ ] Verify public article URL and sitemap update without deploying the website.
- [ ] Verify unauthenticated users cannot read drafts or invoke publish/delete endpoints.
- [ ] Keep schedule disabled until all above checks pass.

## Existing content-engine API
- GET /api/health: minimal health response.
- POST /api/run/daily: authenticated research discovery and task checkpoint.
- POST /api/local/claim: authenticated claim of a checkpointed task (legacy route name retained).
- POST /api/local/complete: authenticated result submission; stores a private draft.
- GET /api/drafts and GET /api/drafts/{id}: authenticated draft inspection.
- The browser must never receive the shared ENGINE_API_TOKEN.

## Known research limitation
Current discovery uses Google News RSS metadata/snippets and scoring. It does not independently fetch and corroborate two or more full publisher pages. Therefore generated drafts must be marked for source verification and must not auto-publish.
