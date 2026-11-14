# Content Engine

Quota-aware research and article-drafting pipeline for FiveCheckMate Insights. This repository contains workflow code and templates only. Credentials and private editorial data must not be committed here.

## Current editorial workflow

1. GitHub Actions runs manually using the **Editorial Queue** workflow.
2. **Day 1 — shortlist:** the Cloudflare Worker reads public RSS/Atom feeds, deduplicates candidates, applies deterministic scoring, and persists the shortlist in Cloudflare D1. This phase does not call AI.
3. An editor reviews the run summary and explicitly selects or rejects candidate IDs.
4. **Day 2 — draft:** the existing Cloudflare Workers AI binding generates drafts only for selected candidates, one article per request and up to three requests per workflow run.
5. Drafts remain `UNPUBLISHED`. An editor imports them into the Insights editorial portal, checks the original publisher report, edits the content, and follows the portal's approval/publishing workflow.

## Free-tier and safety guarantees

- Use the existing Workers AI binding only; no Gemini key, Copilot CLI, local Ollama fallback, paid API, provider switching, or paid overflow.
- If Workers AI quota is exhausted, stop and leave the selected story queued for a later manual run.
- Other AI failures use bounded retries; inspect the recorded error before deciding whether to reselect a failed candidate.
- Never automatically approve or publish content.
- Keep the workflow schedule commented out until a full manual staging cycle passes.
- Feed headlines/snippets are discovery leads, not verified facts. Verify factual claims against the original publisher report before publication.
- Keep API tokens in Cloudflare Worker secrets and GitHub Actions Secrets only. Never print them or commit them.
- Do not change production website Workers `fivecheckmate` or `5checkmate`, production routes, or DNS while validating the engine.

## Current deployment state

- Engine Worker: `fivecheckmate-content-engine`
- Engine D1 database: `fivecheckmate-content-engine`
- Worker base URL: https://fivecheckmate-content-engine.kingramakrishna.workers.dev
- Health endpoint: https://fivecheckmate-content-engine.kingramakrishna.workers.dev/api/health
- GitHub workflow: `.github/workflows/daily-research.yml` (display name: **Editorial Queue**)
- Required additive migration: `cloudflare/migrations/0002_two_day_queue.sql`

PR #1 contains the two-day queue implementation and updated deployment guide. The code has reported unit-test coverage, but the real live end-to-end cycle and the migration/deployment must still be verified. Do not treat the pipeline as accepted until the live staging checks in `cloudflare/DEPLOYMENT.md` pass.

## Staging editorial portal

- Staging visitor blog: https://fivecheckmate-blog-preview.kingramakrishna.workers.dev
- Editorial API/backend: https://fivecheckmate-insights.kingramakrishna.workers.dev
- The portal supports staff editorial actions and imports research drafts from the engine. Publishing remains a staff-controlled action; only published articles should be visible publicly.
