# Content Engine

Quota-aware research and article-drafting pipeline for FiveCheckMate. This repository contains workflow code and templates only. Drafts, evidence notes, credentials and article content must not be committed here.

## Architecture

1. GitHub Actions starts a manually triggered run (daily scheduling remains disabled until end-to-end validation).
2. A Cloudflare Worker fetches public RSS/search feeds, deduplicates and scores candidates, and persists each stage in Cloudflare D1.
3. Cloudflare Workers AI is attempted only while configured and available. If unavailable, quota-limited, or errored, the job is saved as LOCAL_AI_PENDING.
4. The local Windows/Ubuntu worker polls the authenticated Worker API, processes pending tasks with Ollama, and submits results.
5. Completed articles remain unpublished until a human approves them.

GitHub Actions is an orchestrator, not an AI model. No paid AI API is configured.

## Current status

This repository is deployed as a separate Cloudflare Worker (`fivecheckmate-content-engine`) with a D1 database (`fivecheckmate-content-engine`). The Worker is not connected to or replacing the live FiveCheckMate website. Health and end-to-end HTTP behavior still require live validation; the daily schedule remains disabled.

## Free-tier safeguards

- Never configure a paid model/provider as fallback.
- Treat quota errors, timeouts and provider errors as a handoff to local Ollama.
- Persist checkpoints before and after expensive stages; resume an existing LOCAL_AI_PENDING job instead of rediscovering sources.
- Use idempotency keys and unique source URLs to avoid duplicate jobs.
- Keep draft data and evidence notes in D1, not GitHub files or Actions logs.
- Human approval is mandatory; this pipeline must not publish automatically.
- Keep all work within free tiers; stop safely and checkpoint before exhausting quotas; use local Ollama rather than any paid API.
- Runner minutes, Cloudflare quotas, feed terms and local hardware availability still apply.

## Setup outline

1. Cloudflare Worker and D1 have been created and the schema has been applied.
2. Add GitHub Actions secrets ENGINE_API_URL and ENGINE_API_TOKEN.
3. Configure local Ollama and test the Worker manually before enabling the schedule.
5. On the local machine, install Python dependencies and Ollama. Copy local-ollama/.env.example to .env, set the Worker URL/token and model name, then run the worker.
6. Test checkpointing, quota fallback and unpublished draft status before enabling daily automation.

## Security

Never put secrets in source files, commits, issue comments, workflow output, or screenshots. Use GitHub Actions Secrets and Cloudflare Worker secrets. Only non-sensitive source code and templates belong in this public repository.

## FiveCheckMate Insights editorial website

- Staging visitor blog and role-based editorial portal: https://fivecheckmate-blog-preview.kingramakrishna.workers.dev
- Editorial API and D1 backend: https://fivecheckmate-insights.kingramakrishna.workers.dev
- The staging portal proxies same-origin `/api/*` calls to the backend so session cookies remain host-scoped to the staging UI.
- Initial setup uses the existing Cloudflare `BOOTSTRAP_TOKEN` and `SESSION_SECRET` secrets. Create the first administrator once, then add staff accounts with the least-privilege roles: `editor`, `reviewer`, or `publisher`.
- Publishing remains a human-controlled action. Public visitor pages show only published articles; editorial users can create drafts, submit for review, approve/reject, publish/unpublish, manage staff (admin only), and review audit events.
- Reproducible staging UI source is in `preview/worker.js`. The preview Worker is separate from the production website worker and custom domain.
