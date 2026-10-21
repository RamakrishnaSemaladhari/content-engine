# Frozen FiveCheckMate Insights Architecture

Status: Updated 2026-10-22. Online AI drafting uses Google Gemini API on a Free-tier project only. The workflow fails closed unless the repository variable GEMINI_FREE_TIER_CONFIRMED is true.

## Components

- Trigger/orchestrator: GitHub Actions, manual dispatch while acceptance testing is underway.
- AI drafting: Gemini 3.1 Flash-Lite API from a temporary GitHub-hosted runner, using a key from a Google AI Studio project with no linked billing account.
- State/API: existing Cloudflare Worker fivecheckmate-content-engine and its D1 database.
- Editorial control: existing FiveCheckMate Insights authenticated admin portal/backend.
- Public delivery: existing website queries published article data dynamically. Publishing, editing or deleting an article must not require a website deployment.
- Workflow: discovery → deduplicate/score → checkpoint task → Gemini Free-tier inference in Actions → private draft → authenticated editor verification/edit → explicit publish → public URL and sitemap refresh.
- Cleanup: authenticated admin can permanently delete an unpublished/unqualified draft; audit the action. Published content must be unpublished before deletion.

## Safety invariants

1. AI output is never published automatically.
2. Drafts, evidence notes and admin endpoints are private.
3. The engine token and Gemini API key are only used server-side/GitHub Actions, never shipped to browser JavaScript.
4. A published article must have an approved state and an audit record.
5. Public article listing, article detail and sitemap include only published content.
6. RSS snippets are discovery clues, not proof. Source verification is an explicit editorial requirement.
7. Keep the scheduled workflow disabled until a complete live acceptance test passes.
8. Do not change production Worker routes or DNS during staging.
9. Category label is business compliance; avoid small-business compliance.

## AI and secrets

**Strict free-only guardrail:** The repository variable GEMINI_FREE_TIER_CONFIRMED must equal true before inference is allowed. The account owner must verify that the Google AI Studio project is on the Free tier and has no linked billing account. API keys inherit project billing status; do not use a key from a billed project. Do not attach billing or upgrade to restore quota. If free quota is exhausted, the run stops without paid-provider fallback.

- No Copilot CLI, no paid AI provider fallback, no automatic provider/model fallback.
- No Ollama, llama.cpp, GGUF files, Hugging Face model downloads, or local inference.
- Repository Actions secrets: GEMINI_API_KEY, ENGINE_API_URL and ENGINE_API_TOKEN.
- Repository variable: GEMINI_FREE_TIER_CONFIRMED=true only after independently confirming Free-tier/no-billing status.
- GitHub Actions itself may be chargeable depending on repository visibility and account billing. Keep the applicable Actions usage hard stop configured; a runtime timeout is not a billing guarantee.

## Database compatibility and feed repair

The current D1 jobs.status CHECK constraint includes the legacy value LOCAL_AI_PENDING but not RUNNER_AI_PENDING. To avoid a database migration, that value is kept internally as a compatibility state only; the API reports RUNNER_AI_PENDING, and stage/audit records identify the online GitHub runner. No local inference runs.

The branch also includes RSS/Atom feed parsing, URL canonicalisation, recency/relevance filters, bounded timeouts/retries and per-feed diagnostics from the feed-repair work.

## Retry and editorial controls

The workflow uses persisted research checkpoints. If online inference fails or the Free-tier quota is exhausted, the run stops and logs a safe diagnostic. A later manual run can retry after the issue is resolved; scheduled execution remains disabled until acceptance.

No article is published automatically. Source metadata is not independent source verification, and every draft must be reviewed before publication.
