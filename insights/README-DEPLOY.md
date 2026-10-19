# FiveCheckMate Insights — staging release package

This ZIP is a Cloudflare Worker project with static assets and D1. It is not a static-HTML-only upload; authentication, roles, draft storage and publishing require the Worker and database migration together.

## Stage first; do not touch production
1. A separate staging D1 database has been created in the connected Cloudflare account: `fivecheckmate-insights-staging` (`a10a355f-aef6-4dee-81a6-b7156925ad0c`). The schema was applied successfully. The existing content-engine database was not modified.
2. The `wrangler.toml` points to that staging D1. If you deploy under a different Cloudflare account, replace the ID with your own staging database ID and apply the migration: `npx wrangler d1 migrations apply fivecheckmate-insights --remote`.
4. Set secrets: `npx wrangler secret put SESSION_SECRET` and `npx wrangler secret put BOOTSTRAP_TOKEN`. Use long random values; never commit them.
5. Deploy with `npx wrangler deploy`.
6. Verify `/api/health`. Use Admin sign in → Initial administrator setup and your one-time bootstrap token to create your own admin username and unique password (14+ characters). Setup closes after the first account exists.

## Roles
- Admin: all permissions, manage users/roles, review/publish and audit.
- Editor: create/edit/submit drafts and delete non-published drafts.
- Reviewer: approve/reject submitted drafts.
- Publisher: publish approved articles and unpublish articles.

Drafts are private. Approval is required before publishing. Published articles must be unpublished before editing/deletion. Deleting a draft removes the article row; audit history remains.

## Current acceptance status
This is a staging foundation, not yet a signed-off production release. Dynamic article pages, SEO metadata and sitemap generation/update still need implementation and testing. Complete role tests, security/CSRF review, backup/recovery and mobile checks on staging. Keep the existing website Worker and DNS unchanged until those tests pass. A ZIP uploaded as static files alone will not provide the backend functionality.
