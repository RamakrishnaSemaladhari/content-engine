# Frozen FiveCheckMate Insights Architecture

Status: Updated 2026-10-22 at the user's direction. AI inference is online through GitHub Copilot CLI invoked by GitHub Actions. No local model or Ollama path is part of the workflow.

## Components

- Trigger/orchestrator: GitHub Actions, manual dispatch while acceptance testing is underway.
- AI drafting: online GitHub Copilot via the Copilot CLI on a temporary GitHub-hosted runner. This requires a valid Copilot-enabled token supplied as repository secret `COPILOT_PAT`; it is not a guarantee of unlimited or free inference.
- State/API: existing Cloudflare Worker fivecheckmate-content-engine and its D1 database.
- Editorial control: existing FiveCheckMate Insights authenticated admin portal/backend.
- Public delivery: existing website queries published article data dynamically. Publishing, editing or deleting an article must not require a website deployment.
- Workflow: discovery → deduplicate/score → checkpoint task → online Copilot inference in Actions → private draft → authenticated editor verification/edit → explicit publish → public URL and sitemap refresh.
- Cleanup: authenticated admin can permanently delete an unpublished/unqualified draft; audit the action. Published content must be unpublished before deletion.

## Safety invariants

1. AI output is never published automatically.
2. Drafts, evidence notes and admin endpoints are private.
3. The engine token and Copilot token are only used server-side/GitHub Actions, never shipped to browser JavaScript.
4. A published article must have an approved state and an audit record.
5. Public article listing, article detail and sitemap include only published content.
6. RSS snippets are discovery clues, not proof. Source verification is an explicit editorial requirement.
7. Keep the scheduled workflow disabled until a complete live acceptance test passes.
8. Do not change production Worker routes or DNS during staging.
9. Category label is business compliance; avoid small-business compliance.

## AI and secrets

**Strict free-only guardrail:** Each Copilot CLI invocation is capped at 30 AI credits as a per-session ceiling. This is a soft session limit, not a billing firewall. Before enabling the workflow, the account owner must disable paid Copilot usage/additional AI-credit purchases or set the GitHub billing budget to zero with **Stop usage when budget limit is reached** enabled. If that account-level hard stop cannot be confirmed, do not run the AI step. Never configure a payment method/budget to permit overage. Keep the workflow manual-only and stop when free allowance is exhausted.

- No Ollama, llama.cpp, GGUF files, Hugging Face model downloads, or local inference.
- Add repository Actions secret `COPILOT_PAT` containing a token permitted to use GitHub Copilot CLI. Do not paste it into code, issues, logs or chat.
- Existing engine secrets remain `ENGINE_API_URL` and `ENGINE_API_TOKEN`.
- The workflow fails clearly if the required token is missing. Copilot plan access, policy, and usage limits must be confirmed on the GitHub account. Do not configure paid overflow or automatic billing.
- Let Copilot CLI use the account's default/auto model selection to avoid hard-coding a model that may not be enabled for the account.

## Database compatibility and feed repair

The current D1 `jobs.status` CHECK constraint includes the legacy value `LOCAL_AI_PENDING` but not `RUNNER_AI_PENDING`. To avoid a database migration, that value is kept internally as a compatibility state only; the API reports `RUNNER_AI_PENDING`, and the stage/audit records identify the online GitHub runner. No local inference runs.

The branch also includes the tested RSS/Atom feed parser, URL canonicalisation, recency/relevance filters, bounded timeouts/retries and per-feed diagnostics from the feed-repair work.

## Retry and editorial controls

The workflow uses persisted research checkpoints. If online inference fails, it returns the task to the pending runner state and logs a short safe diagnostic. A later manual run can retry; scheduled execution remains disabled until acceptance.

No article is published automatically. Source metadata is not independent source verification, and every draft must be reviewed before publication.
