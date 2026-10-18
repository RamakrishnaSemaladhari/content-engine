# Cloudflare deployment notes

This Worker and D1 database have now been created in the connected Cloudflare account. The Worker is enabled on workers.dev and D1 schema creation has been confirmed. The live health endpoint still needs an external HTTP check. GitHub Actions secrets must be configured manually, and the local Ollama worker must be installed before end-to-end validation.

## 1. Create D1

From a terminal with Wrangler installed and authenticated:

Already completed through the connected Cloudflare API: database `fivecheckmate-content-engine` created with ID `050c8bbf-172e-4369-8058-40d84052d2b2`; schema tables and indexes confirmed through `sqlite_master`. The `wrangler.toml.example` contains this D1 binding.

## 2. Configure and deploy Worker

From the cloudflare directory, with Wrangler installed:

Already completed through the Cloudflare API: Worker `fivecheckmate-content-engine` deployed with D1 binding `DB`, Workers AI binding `AI`, and secret binding `ENGINE_API_TOKEN`. The workers.dev subdomain is enabled.

The API token should be a long random value. Use the same value in GitHub Actions Secrets and the local worker .env file. Never place it in a committed file.

## 3. Test before automation

- GET /api/health should return only a minimal health response.
- POST /api/run/daily with the bearer token should create/resume a D1 job.
- When Workers AI is unavailable or quota-limited, the job should move to LOCAL_AI_PENDING.
- The local worker should claim the checkpointed task and submit its result.
- Confirm the draft status is UNPUBLISHED and no public article URL is exposed.

## Current limitations to resolve before production

- This initial version discovers candidates through Google News RSS query feeds; it does not yet fetch and compare the full reporting from two independent publisher pages. Do not describe candidates as independently verified until that step is implemented.
- The admin UI, draft review screen, approval/publishing endpoint and sitemap integration are not included yet.
- The API routes are authenticated by a shared bearer secret. For production, add rate limits, request-size limits, stronger job-claim protections, and integrate the existing website's established admin authentication rather than exposing the shared token to browser code.
- Confirm the selected Workers AI model is enabled for the account and measure actual Neuron usage before relying on the free allocation.
- Run an end-to-end test with deliberately unavailable Workers AI before enabling daily scheduled automation.


## Current endpoint and remaining manual setup

- Worker health URL: https://fivecheckmate-content-engine.kingramakrishna.workers.dev/api/health
- Worker base URL for GitHub Actions/local worker: https://fivecheckmate-content-engine.kingramakrishna.workers.dev
- GitHub Actions secrets still need to be added manually because the available GitHub integration does not expose Actions-secret creation:
  - ENGINE_API_URL = the Worker base URL above
  - ENGINE_API_TOKEN = the generated token supplied privately in the current chat
- Local Ollama worker requires the same values in local-ollama/.env (copy .env.example first).
- The workflow is manual-only until a complete end-to-end test passes. The schedule has intentionally been removed to avoid unattended failed runs.
- Do not enable the schedule until the health endpoint, daily job creation, local claim/complete, and unpublished draft state have been tested.
