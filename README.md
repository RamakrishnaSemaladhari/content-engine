# FiveCheckMate Content Engine

Research and unpublished article drafting for FiveCheckMate Insights. GitHub Actions orchestrates the workflow; online inference uses the Google Gemini API Free tier only.

## Workflow

1. Manually run **FiveCheckMate Research and Draft** from GitHub Actions. Scheduled execution is disabled.
2. The content engine searches Google News RSS, deduplicates candidates, scores metadata and persists source/task checkpoints in Cloudflare D1.
3. GitHub Actions claims the checkpoint and sends evidence and instructions to Gemini 3.1 Flash-Lite.
4. The content engine stores the result as an unpublished draft.
5. An editor imports the draft in the authenticated Insights portal, verifies sources, edits and uses explicit editorial review/publish controls. Nothing is auto-published.

## Free-only AI guardrail

The workflow requires the repository variable GEMINI_FREE_TIER_CONFIRMED to equal true. Set it only after verifying in Google AI Studio that the project/key is on the Free tier and has no linked billing account. Gemini API keys inherit their project's billing tier; a key linked to a billed project is not a free-only guarantee. With a project remaining on Free tier, quota exhaustion should stop requests; the workflow has no paid-provider fallback and does not retry using another provider. If quota is exhausted, wait for reset.

Gemini free-tier model availability and quotas can change. This workflow uses gemini-3.1-flash-lite; confirm it is available to the Free-tier project before enabling the gate. Do not add billing or upgrade the project to restore service.

GitHub Actions itself may have usage limits or charges depending on repository visibility and account billing. Keep its applicable usage hard-stop configured. Workflow runtime is capped at 10 minutes, which is not itself a billing guarantee.

## GitHub Actions secrets and variable

- ENGINE_API_URL: https://fivecheckmate-content-engine.kingramakrishna.workers.dev
- ENGINE_API_TOKEN: the existing content-engine bearer token.
- GEMINI_API_KEY: API key from the Google AI Studio project that remains on Free tier without linked billing.
- Repository variable GEMINI_FREE_TIER_CONFIRMED: set to true only after independently verifying the project's Free-tier/no-billing status.

Never commit or print tokens. Do not place a token in browser code.

## AI implementation boundary

- Online Gemini API inference from a GitHub-hosted runner; no local model.
- No Copilot CLI, no paid AI provider fallback, no automatic model/provider fallback.
- No local Ollama, llama.cpp, GGUF download, Hugging Face model download, or CPU-local inference.
- Inference failures and quota exhaustion stop the run; the checkpoint is retained for a later manual retry.
- Keep the scheduled trigger disabled until end-to-end acceptance passes.

## Editorial and deployment safeguards

- Drafts remain private and unpublished. The model must not invent facts or source verification.
- RSS snippets are discovery clues, not verification. Direct source checking and editorial approval are required.
- The published site must render published articles dynamically; adding an article must not require site deployment.
- Do not change production Worker routes or DNS during staging.
- Public category wording is “business compliance”.
