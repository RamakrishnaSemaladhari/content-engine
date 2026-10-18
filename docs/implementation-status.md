# Implementation Status and Deployment Checklist

## Confirmed completed
- [x] Public GitHub repository scaffold committed
- [x] Cloudflare account connection verified
- [x] D1 database `fivecheckmate-content-engine` created in APAC (ID recorded in cloudflare/wrangler.toml.example)
- [x] D1 tables and indexes created and verified through sqlite_master
- [x] Worker `fivecheckmate-content-engine` deployed with D1 binding `DB`, Workers AI binding `AI`, and secret binding `ENGINE_API_TOKEN`
- [x] Worker workers.dev subdomain enabled
- [x] Authenticated draft list/detail endpoints added
- [x] Resume behavior added for existing LOCAL_AI_PENDING jobs
- [x] GitHub Actions schedule disabled; manual trigger only
- [x] No paid AI provider configured; drafts remain unpublished by default

## Pending verification / setup
- [ ] Verify public health endpoint from a normal browser
- [ ] Add GitHub Actions secrets ENGINE_API_URL and ENGINE_API_TOKEN manually
- [ ] Install Ollama and qwen2.5:3b on the user's Windows/WSL2 machine; configure local-ollama/.env
- [ ] Run a full manual workflow and validate D1 state
- [ ] Test quota exhaustion, local claim/complete, lease expiry, retry and idempotency
- [ ] Independently corroborate selected stories across publisher pages; current discovery uses Google News RSS metadata/snippets and is not proof of facts
- [ ] Build an authenticated admin/review UI and connect to FiveCheckMate blog only after approval
- [ ] Publish only after explicit human approval; update sitemap only after publication
- [ ] Enable daily scheduling only after the above tests pass

## Worker API contract
- GET /api/health: public health status only
- POST /api/run/daily: authenticated; creates/resumes a daily job and persists checkpoints
- POST /api/local/claim: authenticated; leases a LOCAL_AI_PENDING job and returns the task, or HTTP 204 when none is available
- POST /api/local/complete: authenticated; validates current lease and saves an unpublished draft or returns to a safe retry state
- GET /api/drafts: authenticated; lists metadata for up to 50 drafts
- GET /api/drafts/{id}: authenticated; returns one draft and its source references

## Free-tier and checkpoint rules
1. Never configure a paid model/provider as fallback.
2. Persist a checkpoint before expensive inference and after each durable stage.
3. If cloud AI is unavailable or quota-limited, retain the task and hand off to local Ollama.
4. Resume an existing LOCAL_AI_PENDING job; do not repeatedly rediscover sources on every scheduled run.
5. Keep GitHub Actions manual-only until end-to-end tests pass.
6. Do not log credentials, full prompts or article bodies in workflow logs.
7. RSS results and webpage text are untrusted input. Treat allegations as allegations and verify with independent sources.
8. No automatic publishing. Human approval is mandatory.
