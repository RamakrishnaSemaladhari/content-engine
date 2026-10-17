# Content Engine

Quota-aware research and article-drafting pipeline for FiveCheckMate. This repository contains workflow code and templates only. Drafts, evidence notes, credentials and article content must not be committed here.

## Architecture

1. GitHub Actions starts a scheduled run.
2. A Cloudflare Worker fetches public RSS/search feeds, deduplicates and scores candidates, and persists each stage in Cloudflare D1.
3. Cloudflare Workers AI is attempted only while configured and available. If unavailable, quota-limited, or errored, the job is saved as LOCAL_AI_PENDING.
4. The local Windows/Ubuntu worker polls the authenticated Worker API, processes pending tasks with Ollama, and submits results.
5. Completed articles remain unpublished until a human approves them.

GitHub Actions is an orchestrator, not an AI model. No paid AI API is configured.

## Current status

This is an initial scaffold. It has not been deployed to Cloudflare and is not connected to the live FiveCheckMate website. Deploy and test the Worker routes and D1 schema before adding secrets or enabling the schedule.

## Free-tier safeguards

- Never configure a paid model/provider as fallback.
- Treat quota errors, timeouts and provider errors as a handoff to local Ollama.
- Persist checkpoints before and after expensive stages.
- Use idempotency keys and unique source URLs to avoid duplicate jobs.
- Keep draft data and evidence notes in D1, not GitHub files or Actions logs.
- Human approval is mandatory; this pipeline must not publish automatically.
- Runner minutes, Cloudflare quotas, feed terms and local hardware availability still apply.

## Setup outline

1. Create a Cloudflare D1 database and apply cloudflare/schema.sql.
2. Deploy a Worker using cloudflare/src/index.js, configure D1 and Workers AI bindings, and set an ENGINE_API_TOKEN secret.
3. Configure GitHub Actions secrets ENGINE_API_URL and ENGINE_API_TOKEN.
4. Test the Worker manually before enabling the schedule.
5. On the local machine, install Python dependencies and Ollama. Copy local-ollama/.env.example to .env, set the Worker URL/token and model name, then run the worker.
6. Test checkpointing, quota fallback and unpublished draft status before enabling daily automation.

## Security

Never put secrets in source files, commits, issue comments, workflow output, or screenshots. Use GitHub Actions Secrets and Cloudflare Worker secrets. Only non-sensitive source code and templates belong in this public repository.