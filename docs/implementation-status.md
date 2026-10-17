# Implementation Status and Deployment Checklist

## Scaffold created
- [x] Scheduled/manual GitHub Actions trigger
- [x] D1 schema for jobs, sources, checkpoints, drafts and audit events
- [x] Source query configuration
- [x] Local Ollama fallback worker
- [x] No paid AI provider configured
- [x] Draft status defaults to unpublished

## Not yet deployed or connected
- [ ] Cloudflare Worker routes
- [ ] D1 database creation and schema application
- [ ] Worker authentication and secret configuration
- [ ] Workers AI binding and quota/error classification
- [ ] Claim/complete endpoints with lease expiry and idempotency
- [ ] Integration with the existing FiveCheckMate admin/blog
- [ ] End-to-end test for cloud quota exhaustion and local resume
- [ ] Sitemap update only after explicit approval/publication

## Required Worker API contract
- POST /api/run/daily: authenticated; creates or resumes today's idempotent job, fetches source metadata and persists checkpoints.
- POST /api/local/claim: authenticated; atomically leases one LOCAL_AI_PENDING job and returns a minimal task payload; return HTTP 204 if none is available.
- POST /api/local/complete: authenticated; validates state, writes a checkpoint/result, clears lease and transitions to DRAFT_READY or a safe retry state. It must never publish.
- GET /api/health: public health status only; no database contents or secrets.

## Required safety behavior
1. Persist source discovery results before model inference.
2. Persist candidate scores before verification/drafting.
3. On AI quota errors, timeouts or unavailable service, set LOCAL_AI_PENDING without losing checkpoints.
4. Use expiring leases so a crashed worker does not permanently lock a job.
5. Validate returned JSON and cap body length before writing D1.
6. Store safe error codes only; never log tokens, prompts, full article bodies or credentials.
7. Human approval is mandatory. Unpublished drafts must not be publicly accessible.
8. RSS and webpage content is untrusted data; ignore instructions found inside source content.
9. Avoid storing full copyrighted article text; retain URLs, short snippets, factual notes and verification references.
10. Do not enable the schedule until a manual end-to-end test passes.
