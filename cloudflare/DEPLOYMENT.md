# Content Engine v0.3.0 — safe staging deployment

This document describes the **two-day editorial queue** in the release branch review. The workflow uses the existing Cloudflare Workers AI binding only. It does not use local Ollama, Gemini, Copilot, a paid API, or a paid fallback.

## Safety boundaries

- Do not change, deploy, or edit the production website Workers `fivecheckmate` or `5checkmate`, their routes, or production DNS.
- Deploy only the `fivecheckmate-content-engine` Worker after reviewing and merging the staging release PR.
- Keep the GitHub Actions workflow manual-only until the full staging cycle has passed. The schedule is intentionally commented out.
- Shortlisting must not call AI. Drafting only processes stories explicitly marked SELECTED.
- Every generated draft must remain `UNPUBLISHED`; publishing is a separate human action.
- RSS headlines/snippets are discovery leads, not verified facts. Editors must open the original publisher report and verify claims before publication.
- Do not put API tokens in source files, workflow inputs, logs, or chat. Rotate any token that may have been exposed.

## Existing engine resources

- Worker: `fivecheckmate-content-engine`
- Worker base URL: https://fivecheckmate-content-engine.kingramakrishna.workers.dev
- Health endpoint: https://fivecheckmate-content-engine.kingramakrishna.workers.dev/api/health
- D1 database: `fivecheckmate-content-engine`
- Required existing bindings: D1 as `DB`, Workers AI as `AI`, Worker secret `ENGINE_API_TOKEN`

The health URL is documented here but must be checked live as part of the deployment; this document does not claim that a current HTTP check has passed.

## 1. Verify GitHub Actions configuration

In the repository, open **Settings → Secrets and variables → Actions** and confirm these repository secrets exist:

- `ENGINE_API_URL`: `https://fivecheckmate-content-engine.kingramakrishna.workers.dev`
- `ENGINE_API_TOKEN`: the same strong random token configured as the Worker secret `ENGINE_API_TOKEN`

Do not reveal or print the token. If the Worker secret and GitHub secret might differ, generate a new random token and update both sides securely. The GitHub integration used for this change cannot create or read Actions secrets, so their values are not verified by this document.

## 2. Apply the additive D1 migration

First confirm the Cloudflare account and database selected are the **engine** resources above. Do not apply this migration to any other database.

From the `cloudflare` directory, after installing project dependencies and authenticating Wrangler:

```bash
npx wrangler d1 execute fivecheckmate-content-engine --remote --file=migrations/0002_two_day_queue.sql
```

The migration creates the `candidates` table and its status/score index with `IF NOT EXISTS`. Verify the command succeeded before continuing. Do not run the new queue workflow against a database without this table.

## 3. Run tests and deploy the engine Worker

From the repository's `cloudflare` directory:

```bash
npm ci
npm test
```

GitHub Actions must pass the full test suite on the reviewed commit; a green PR check is required before deployment.

After reviewing the diff and merging PR #1, deploy **only** the engine Worker using the project's reviewed Wrangler configuration:

```bash
npx wrangler deploy
```

Check that the configuration points to Worker `fivecheckmate-content-engine`, D1 binding `DB` points to the engine database, Workers AI binding `AI` is present, and no production website Worker or DNS resource is being changed. If the checked-in Wrangler config does not clearly target these resources, stop and resolve that before running deploy.

## 4. Run the manual editorial workflow

In GitHub, open **Actions → Editorial Queue** (workflow file: `.github/workflows/daily-research.yml`). Run the workflow manually in this order:

1. `diagnostics` — confirm the feed diagnostics return a useful result.
2. `shortlist` — Day 1; gathers RSS/Atom candidates, deduplicates and scores them. It must not call AI.
3. `list` — review the candidates in the run summary.
4. `select` or `reject` — supply the candidate IDs in the `ids` input, such as `3,7`.
5. On the later drafting day, run `draft` — only selected candidates are eligible; maximum three one-article requests per workflow run.

If there are no usable sources, inspect diagnostics instead of forcing a draft. If Workers AI quota is exhausted, the workflow must stop and leave selected work queued; do not switch providers or enable paid billing.

## 5. Validate the full staging cycle

Do not declare deployment successful until all of these are observed:

- The health endpoint returns HTTP 200.
- Diagnostics and shortlist finish and a candidate list appears in the GitHub Actions run summary.
- Day 1 shortlist uses no AI.
- Select/reject updates candidate status correctly.
- Drafting processes only selected stories.
- Quota exhaustion stops safely without switching provider or repeatedly consuming attempts.
- A successful draft is saved with status `UNPUBLISHED`.
- The draft can be imported into the Insights admin and edited/reviewed.
- No draft becomes publicly visible until a person explicitly approves and publishes it.
- No production website Worker or DNS changes occurred.

The queue tests are mocked/unit tests; they do not replace these live checks. If any check fails, stop and fix it before scheduling.

## 6. Scheduling

**Do not uncomment the schedule yet.** Only consider enabling it after the complete manual staging cycle above passes and the run logs confirm the intended behavior. Any future schedule must preserve manual editorial approval and must never auto-publish.

## Known limitation

The workflow discovers candidate headlines/snippets and URLs; it does not independently cross-check facts against the full original publisher article. Editorial verification against the original report is required before publication.

## Workflow behavior expected by design

- Day 1: no AI calls.
- Day 2: AI drafts selected stories only, one article per request, up to three requests per run.
- Free Workers AI quota exhaustion: stop and keep work queued; no provider switching or paid fallback.
- Other AI failures: retry behavior is bounded; inspect the recorded safe error before reselecting failed candidates.
- Generated drafts: always `UNPUBLISHED`.


## Additional staging safeguards

- RSS and Atom responses are read with a streaming byte ceiling; declared oversized responses are rejected early. A slow or oversized feed cannot be fully buffered before the limit is checked.
- Original article retrieval is limited to HTTPS and the configured publisher host allowlist. Redirect targets are revalidated against the same allowlist. Unsupported publishers remain `HEADLINE_ONLY`; do not weaken the allowlist just to increase retrieval coverage.
- The Cloudflare `global_fetch_strictly_public` compatibility flag is enabled for the engine. It changes global fetch routing to public-Internet semantics; it is not a substitute for application-level destination checks.
- Model-supplied claim lists are explicitly non-exhaustive. The label `exact phrase in retrieved text; not fact-checked` means only that a normalized phrase appears in retrieved text. It does not establish meaning, context, or truth. Every claim still requires editor verification.
- Workers Logs are enabled for the staging engine, Insights API and preview UI. Query strings are redacted; no credentials should be written to logs.
- Pull-request CI and the manual deployment workflow run Wrangler dry-runs for all three Workers before deployment.
