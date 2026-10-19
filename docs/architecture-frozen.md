# Frozen FiveCheckMate Insights Architecture

Status: Frozen on 2026-10-19. Do not change components without explicit user instruction.

## Components

- Trigger/orchestrator: GitHub Actions, manual dispatch while acceptance testing is underway.
- AI drafting: local CPU inference on the GitHub-hosted runner, 4-vCPU / 16-GB class, using a quantized Qwen2.5-3B-Instruct GGUF model with llama.cpp. No local Ollama on the user's machine, no Workers AI inference, no paid AI APIs.
- State/API: existing Cloudflare Worker fivecheckmate-content-engine and its D1 database.
- Editorial control: existing FiveCheckMate Insights authenticated admin portal/backend.
- Public delivery: existing website queries published article data dynamically. Publishing, editing or deleting an article must not require a website deployment.
- Workflow: discovery → deduplicate/score → checkpoint task → runner-local generation → private draft → authenticated editor verification/edit → explicit publish → public URL and sitemap refresh.
- Cleanup: authenticated admin can permanently delete an unpublished/unqualified draft; audit the action. Published content must be unpublished before deletion.

## Safety invariants

1. AI output is never published automatically.
2. Drafts, evidence notes and admin endpoints are private.
3. The shared engine token is only used server-side/GitHub Actions, never shipped to browser JavaScript.
4. A published article must have an approved state and an audit record.
5. Public article listing, article detail and sitemap include only published content.
6. RSS snippets are discovery clues, not proof. Source verification is an explicit editorial requirement.
7. Keep the scheduled workflow disabled until a complete live acceptance test passes.
8. Do not change production Worker routes or DNS during staging.
9. Category label is business compliance; avoid small-business compliance.

## Resource/free constraints

The runner downloads model files at run time and has no durable local state. D1 checkpoints are the source of truth. The model file and inference cache must not be committed to Git. If install/download/inference fails, fail the workflow safely and retain the checkpoint for retry. Do not fall back to any paid service.
