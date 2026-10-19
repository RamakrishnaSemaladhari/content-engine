# FiveCheckMate Content Engine

Free-only research and article drafting for FiveCheckMate Insights. The architecture is frozen in docs/architecture-frozen.md.

## Frozen architecture

1. GitHub Actions is the sole workflow trigger/orchestrator.
2. The GitHub-hosted Ubuntu runner (4 vCPU / 16 GB class) runs a quantized Qwen 2.5 3B GGUF model locally on CPU through llama.cpp. No local Ollama, no paid AI API, and no Cloudflare Workers AI inference.
3. The Cloudflare content-engine Worker + D1 persist research jobs, source metadata, task checkpoints, drafts, status and audit events.
4. The existing Insights admin portal handles login, editing, preview, explicit publish/unpublish, and deletion of unpublished drafts. Published articles are served dynamically by the existing website; adding an article must not require redeploying the site.
5. No article is published automatically. Source discovery metadata is not independent source verification; editor verification is required.

## Workflow

- Run manually from GitHub Actions (workflow_dispatch); scheduled execution stays disabled until live end-to-end acceptance passes.
- Worker searches Google News RSS, deduplicates candidates, scores metadata and persists source/task checkpoints.
- Runner downloads a quantized open-weight model to the temporary runner, claims the checkpointed task, generates structured JSON and submits the result to the Worker.
- Worker stores the result as an unpublished draft and confirms published: false.
- The editor opens the authenticated admin portal, reviews evidence, edits and explicitly publishes. The public website reads only published articles.
- Unpublished, unqualified drafts can be permanently deleted from the authenticated admin portal. Deletion is audited. Published articles must be unpublished before deletion.

## Free-tier and security rules

- No paid AI APIs or local Ollama.
- The model is downloaded to the ephemeral GitHub runner; it is not stored on the user's computer or committed to Git.
- Keep Actions logs free of tokens, full prompts, source text and article bodies.
- Use repository Actions secrets ENGINE_API_URL and ENGINE_API_TOKEN.
- Do not enable a schedule until the real workflow and publishing journey pass end-to-end tests.
- Do not change the production website Worker or DNS during staging.
- Never represent RSS headlines/snippets as verified facts. Legal allegations must be attributed, corroborated and reviewed before publication.
- The public category wording is business compliance, not small-business compliance.

## Current implementation boundary

The content-engine Worker now runs discovery/checkpointing and runner task claiming/completion without Workers AI inference. A separate staging editorial API Worker (fivecheckmate-insights-staging-v2) is deployed with a CONTENT_DB binding, and the staging preview portal has an Import research drafts action. Imported articles remain editorial drafts and use the existing role-gated submit/approve/publish workflow. Live browser/API end-to-end acceptance is still pending; production website Worker and DNS were not changed.

## Manual setup

Configure repository Actions secrets:
- ENGINE_API_URL=https://fivecheckmate-content-engine.kingramakrishna.workers.dev
- ENGINE_API_TOKEN: the current Worker token stored as a GitHub Actions secret.

Do not put the token in this repository, a commit, or Actions output.
