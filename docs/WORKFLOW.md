# End-to-end workflow (nothing publishes automatically)

```
GitHub Actions (daily, manual until proven)
  -> Content Engine Worker: finds stories, AI writes an UNPUBLISHED draft (+ Ollama fallback)
  -> "Sync Drafts" workflow copies it to Insights as status = draft  (needs INSIGHTS_INGEST_TOKEN)
  -> Human: Editor edits + submits -> Reviewer approves -> Publisher publishes   (Insights admin)
  -> Public: /api/articles, /api/articles/{slug}; the UI Worker renders /insights/{slug}, /sitemap.xml, /feed.xml
```

## One-time setup (secret NAMES only; never paste values into chat, files or commits)
| Where | Name | Notes |
|---|---|---|
| Insights Worker secret | `SESSION_SECRET`, `BOOTSTRAP_TOKEN` | already set; leave unchanged |
| Insights Worker secret | `INGEST_TOKEN` | NEW, only needed for draft sync; `npx wrangler secret put INGEST_TOKEN` in `insights/`. Without it ingestion returns 503 (safe default) |
| GitHub Actions secret | `ENGINE_API_URL`, `ENGINE_API_TOKEN` | existing, unchanged |
| GitHub Actions secret | `INSIGHTS_API_URL` | `https://fivecheckmate-insights.kingramakrishna.workers.dev` |
| GitHub Actions secret | `INSIGHTS_INGEST_TOKEN` | same value as the Worker's `INGEST_TOKEN` |

## Deploy order (staging only)
1. `cd insights && npm test`  then `npx wrangler deploy` (staging Worker `fivecheckmate-insights`; D1 binding is the staging DB; no migration needed).
2. Set `INGEST_TOKEN`, then the two GitHub secrets above.
3. Run "Daily Research Queue" (manual) -> "Sync Drafts" runs after it; check Insights admin > Articles for a new draft.
4. Review, submit, approve, publish by hand. Confirm `/insights/<slug>` renders.
5. Only then consider the daily schedule in `daily-research.yml` (after PR #1 is merged).

Production Workers and the existing content-engine D1 are not touched by any of this.
