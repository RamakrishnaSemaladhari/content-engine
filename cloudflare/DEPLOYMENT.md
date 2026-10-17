# Cloudflare deployment notes

This is a staged scaffold, not a live deployment. Do not add secrets or enable the scheduled workflow until the D1 database and Worker are deployed and tested.

## 1. Create D1

From a terminal with Wrangler installed and authenticated:

1. Run: wrangler d1 create fivecheckmate-content-engine
2. Copy the returned database ID into a local copy of wrangler.toml (start from wrangler.toml.example).
3. Apply the schema: wrangler d1 execute fivecheckmate-content-engine --file=schema.sql
4. Keep the real wrangler.toml local; do not commit any account-specific values if you prefer to keep infrastructure details private.

## 2. Configure and deploy Worker

From the cloudflare directory, with Wrangler installed:

1. Copy wrangler.toml.example to wrangler.toml and replace the D1 database name and ID.
2. Set the API secret: wrangler secret put ENGINE_API_TOKEN
3. Deploy: wrangler deploy

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
