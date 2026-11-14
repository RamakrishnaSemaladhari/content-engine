# Go-live checklist: staging (release v0.3.0)

Everything below is staging only. Production Workers `fivecheckmate` / `5checkmate`, routes and DNS are never touched (the deploy workflow refuses configs that target them).

## Verified before this release (evidence)
| Check | Result |
|---|---|
| Engine tests (25), Insights tests (5), UI syntax | PASS on the merged release branch |
| Workflow retry handling (network failure -> 3 bounded attempts, clear error) | PASS against an unreachable server |
| `wrangler deploy --dry-run` for engine, insights, UI | PASS: bundles, bindings correct (DB+AI / DB+CONTENT_DB / none) |
| Insights Worker in the real local Workers runtime: first-admin setup, login, create, submit, approve, publish, public page, unpublish; drafts private (401); early publish refused (409); cross-origin refused (403) | PASS |
| Engine Worker in the real local runtime: health v0.3.0, auth, queue routes, controlled `SOURCE_FETCH_FAILED` with per-feed reasons when offline | PASS |
| Live staging smoke test (`scripts/smoke-staging.sh`) | NOT RUN: needs a deployed target; the workflow runs it automatically after deploy |
| Live Workers AI drafting, live Google News feeds | NOT TESTED: cannot be exercised outside Cloudflare |

Live state when this was prepared: engine Worker still the old build, engine D1 has no `candidates` table (migration pending), staging Insights has 0 users / 0 articles.

## What the engine checks, and what it does NOT (read before publishing anything)
Automated: undated and stale stories are excluded; duplicates removed; the original article page is fetched when reachable (https only, internal addresses blocked, size/time limited); every draft records `EVIDENCE: original article text retrieved` or `HEADLINE_ONLY (reason)`; claims are tagged `[in source text]` or `[UNVERIFIED]`; drafts that are too short, lack headings, assert guilt/conviction, contain links not from the source, or cite statutes/case numbers without source text are failed or flagged `NEEDS_REVIEW`.
NOT automated: legal accuracy; official records or court orders; independent corroboration by a second publisher; verification of the publisher itself (the trusted-publisher list is a scoring heuristic). Google News links often cannot be resolved to the publisher page, so many drafts will be `HEADLINE_ONLY`: the editor must read the original report before publishing. Local Ollama is intentionally not part of this design (repo README: "no local Ollama fallback").

## One-time setup (you; secret values never go in chat, code or logs)
1. Create a NEW scoped Cloudflare API token: Workers Scripts:Edit and D1:Edit, restricted to your account. Do not reuse a token that was ever pasted in chat. Revoke those.
2. GitHub repo > Settings > Secrets and variables > Actions, add: `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID` (use the value shown in your Cloudflare account settings; never commit it). Existing `ENGINE_API_URL` / `ENGINE_API_TOKEN` stay as they are (same token as the engine Worker secret; if unsure they match, the smoke test reports "token REJECTED").
3. Optional: Settings > Environments > `staging` > add yourself as required reviewer for a deploy approval step.
4. Merge the release PR into `main`.

## Deploy
Actions > **Deploy Staging** > Run workflow: confirm = `DEPLOY-STAGING`, target = `all`, migration = on.
Order is fixed: tests -> production guard -> engine migration (additive) -> engine -> Insights API -> UI -> smoke test. Secrets already stored in Cloudflare (`SESSION_SECRET`, `BOOTSTRAP_TOKEN`, `ENGINE_API_TOKEN`) are preserved by deploys; nothing is rotated.

## Acceptance (manual, in this order)
1. Smoke test job is green.
2. Staging UI > Staff login > create the first administrator (uses the existing bootstrap token). Then create editor / reviewer / publisher accounts and check each role only sees its actions.
3. Actions > **Editorial Queue**: `diagnostics` (expect feeds ok N/5) -> `shortlist` (read the run summary) -> `select` with ids -> `draft`.
   If the draft step reports an AI error, the run summary shows the real error code; send it to me.
4. Staging UI > Import research drafts > edit > submit > approve > publish. Open `/insights/<slug>`, `/sitemap.xml`, `/feed.xml`.
5. Unpublish and delete a test draft; confirm the audit history shows every action.
6. Only now uncomment the two `schedule:` lines in the Editorial Queue workflow.

## Rollback
- Worker code: Cloudflare dashboard > Workers > the Worker > Deployments > roll back to the previous version, or `npx wrangler rollback` in that Worker's folder.
- Migration 0002 only adds a table; leaving it in place is harmless.
- Disable automation instantly: remove/comment the `schedule:` lines or disable the workflow in the Actions tab.

## Still open (not blockers for staging)
Facts are not cross-checked against the original publisher page (editor must verify); no second-factor login; the public site `fivecheckmate.com` does not yet link to the blog; production cutover is a separate, later decision.
