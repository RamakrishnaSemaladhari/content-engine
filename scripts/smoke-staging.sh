#!/usr/bin/env bash
# Post-deploy smoke test. Reads URLs/token from the environment; never prints the token.
#   ENGINE_URL, INSIGHTS_URL, UI_URL   (https base URLs)   ENGINE_API_TOKEN (optional: enables authenticated checks)
set -uo pipefail
fail=0
ok()  { echo "PASS  $1"; }
bad() { echo "FAIL  $1"; fail=1; }
OUT=$(mktemp); trap 'rm -f "$OUT"' EXIT
get() { local c; c=$(curl -sS -m 25 -o "$OUT" -w '%{http_code}' "$@" 2>/dev/null) || c=000; echo "${c:-000}" | tail -c 4; }

c=$(get "$ENGINE_URL/api/health");  [ "$c" = 200 ] && grep -Eq '"version" *: *"0\.3' $OUT && ok "engine /api/health is v0.3.x" || bad "engine health HTTP $c (not v0.3.x? old code still deployed)"
c=$(get "$ENGINE_URL/api/shortlist"); [ "$c" = 401 ] && ok "engine queue routes exist and require auth" || bad "engine /api/shortlist HTTP $c (expected 401)"
c=$(get "$INSIGHTS_URL/api/health"); [ "$c" = 200 ] && grep -Eq '"ok" *: *true' $OUT && ok "insights API health" || bad "insights health HTTP $c"
c=$(get "$INSIGHTS_URL/api/setup/status"); [ "$c" = 200 ] && grep -q needsSetup $OUT && ok "insights setup status: $(cat $OUT)" || bad "insights setup status HTTP $c"
c=$(get "$INSIGHTS_URL/api/admin/articles"); [ "$c" = 401 ] && ok "admin articles private without login" || bad "admin articles HTTP $c (expected 401)"
c=$(get "$INSIGHTS_URL/api/admin/engine-drafts"); [ "$c" = 401 ] && ok "engine-drafts import private without login" || bad "engine-drafts HTTP $c (expected 401)"
c=$(get "$UI_URL/health"); [ "$c" = 200 ] && ok "UI /health: backend reachable" || { bad "UI /health HTTP $c"; head -c 300 $OUT; echo; }
c=$(get "$UI_URL/"); [ "$c" = 200 ] && grep -qi "FiveCheck" $OUT && ok "UI root serves the portal" || bad "UI root HTTP $c"
c=$(get "$UI_URL/api/articles"); [ "$c" = 200 ] && ok "public article list via UI proxy" || bad "UI proxy /api/articles HTTP $c"
c=$(get "$UI_URL/robots.txt"); grep -q "Disallow: /" $OUT && ok "staging is noindex (robots Disallow: /)" || bad "staging robots.txt not blocking crawlers"
if [ -n "${ENGINE_API_TOKEN:-}" ]; then
  c=$(get -H @<(printf 'Authorization: Bearer %s\n' "$ENGINE_API_TOKEN") "$ENGINE_URL/api/diagnostics/rss")
  if [ "$c" = 200 ]; then ok "engine token accepted; feeds: $(grep -o '"feedsOk":[0-9]*,"feedsTotal":[0-9]*' $OUT)"
  elif [ "$c" = 401 ]; then bad "engine token REJECTED (GitHub secret != Worker secret)"; else bad "engine diagnostics HTTP $c"; fi
fi
[ $fail = 0 ] && echo "ALL SMOKE CHECKS PASSED" || echo "SOME CHECKS FAILED"
exit $fail
