# FiveCheckMate Content Engine

Research and unpublished article drafting for FiveCheckMate Insights. GitHub Actions is the workflow orchestrator; online AI inference is through GitHub Copilot CLI.

## Workflow

1. Manually run **FiveCheckMate Research and Draft** from GitHub Actions. Scheduled execution is disabled.
2. The engine searches Google News RSS, deduplicates candidates, scores metadata and persists source/task checkpoints in Cloudflare D1.
3. GitHub Actions claims the checkpoint and asks online GitHub Copilot to prepare structured draft JSON. No local model is downloaded or run.
4. The content engine stores the result as an unpublished draft.
5. An editor imports the draft in the authenticated Insights portal, verifies sources, edits and uses the explicit editorial review/publish controls. Nothing is auto-published.

## GitHub Actions secrets

- `ENGINE_API_URL`: `https://fivecheckmate-content-engine.kingramakrishna.workers.dev`
- `ENGINE_API_TOKEN`: the existing content-engine bearer token.
- `COPILOT_PAT`: a securely stored token permitted to use GitHub Copilot CLI on behalf of your account.

Never commit or print tokens. Do not place a token in browser code.

## AI implementation boundary

- Online GitHub Copilot CLI called from a GitHub-hosted runner.
- No local Ollama, llama.cpp, GGUF download, Hugging Face model download, or CPU-local inference.
- GitHub Copilot access may depend on account entitlement and service limits. This is not a promise of unlimited or free hosted inference; do not enable any paid overflow/automatic billing without explicit approval.
- GitHub Models inference API is not used; it was retired in July 2026.
- Copilot CLI uses the account's default model selection. Inference failures retain the checkpoint for a later manual retry. Keep the scheduled trigger disabled until end-to-end acceptance passes.

## Editorial and deployment safeguards

- Drafts remain private and unpublished. The model must not invent facts or source verification.
- RSS snippets are discovery clues, not verification. Direct source checking and editorial approval are required.
- The published site must render published articles dynamically; adding a new article must not require site deployment.
- Do not change production Worker routes or DNS during staging.
- Public category wording is “business compliance”.
