// Pure feed helpers (no Worker globals except fetch/AbortController) so they can be unit tested in Node.
export function decodeEntities(s) {
  return String(s || "")
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'").replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/&amp;/g, "&");
}
export function clean(s) {
  // decode, strip markup (feeds often entity-encode HTML), decode again, collapse whitespace
  return decodeEntities(decodeEntities(s).replace(/<[^>]+>/g, " ")).replace(/\s+/g, " ").trim();
}
export function getTag(block, name) {
  const re = new RegExp("<" + name + "(?:\\s[^>]*)?>([\\s\\S]*?)</" + name + ">", "i");
  const m = block.match(re);
  return m ? clean(m[1]) : "";
}
function attr(block, tag, a) {
  const t = block.match(new RegExp("<" + tag + "\\b([^>]*)>", "i"));
  if (!t) return "";
  const m = t[1].match(new RegExp("\\b" + a + "\\s*=\\s*[\"']([^\"']*)[\"']", "i"));
  return m ? decodeEntities(m[1]) : "";
}
export function host(raw) {
  try { return new URL(raw).hostname.replace(/^www\./, "").toLowerCase(); } catch { return ""; }
}
export function canonicalize(raw) {
  try {
    const u = new URL(raw); u.hash = "";
    for (const k of [...u.searchParams.keys()]) if (/^(utm_|fbclid|gclid|oc$)/i.test(k)) u.searchParams.delete(k);
    return u.toString();
  } catch { return ""; }
}
export function parseDate(s) {
  const t = Date.parse(s || "");
  return Number.isNaN(t) ? null : new Date(t).toISOString();
}
/** Parses RSS 2.0 (<item>) and Atom (<entry>). Never throws. */
export function parseFeed(body) {
  const text = String(body || "");
  const out = [];
  const blocks = [...text.matchAll(/<(item|entry)(?:\s[^>]*)?>([\s\S]*?)<\/\1>/gi)];
  for (const m of blocks) {
    const b = m[2], atom = m[1].toLowerCase() === "entry";
    const title = getTag(b, "title");
    let link = atom ? (attr(b, "link", "href") || getTag(b, "link")) : getTag(b, "link");
    if (!link) link = getTag(b, "guid");
    const srcTag = (b.match(/<source(?:\s[^>]*)?>[\s\S]*?<\/source>/i) || [""])[0];
    out.push({
      title, link,
      snippet: clean(getTag(b, atom ? "summary" : "description") || getTag(b, "content")).slice(0, 500),
      publisher: getTag(b, "source") || (atom ? getTag(b, "name") : "") || "",
      publisherUrl: attr(srcTag, "source", "url"),
      publishedAt: parseDate(getTag(b, atom ? "updated" : "pubDate") || getTag(b, "published") || getTag(b, "dc:date"))
    });
  }
  return out;
}
export function buildFeedUrl(cfg, q) {
  return cfg.googleNewsRssBase + "?q=" + encodeURIComponent(q + " when:" + cfg.maxAgeDays + "d") +
    "&hl=" + cfg.language + "&gl=" + cfg.region + "&ceid=" + cfg.ceid;
}
/** Fetch one feed with timeout, size cap and bounded retry. Always resolves with a diagnostics record. */
export async function fetchFeed(url, cfg, fetchImpl = fetch) {
  const diag = { ok: false, status: null, bytes: 0, items: 0, attempts: 0, error: null, ms: 0 };
  const t0 = Date.now();
  for (let attempt = 0; attempt <= cfg.retries; attempt++) {
    diag.attempts = attempt + 1;
    const ac = new AbortController(), timer = setTimeout(() => ac.abort(), cfg.fetchTimeoutMs);
    try {
      const res = await fetchImpl(url, { signal: ac.signal, headers: { "user-agent": "FiveCheckMate-ResearchBot/1.1 (+https://fivecheckmate.com)", accept: "application/rss+xml, application/atom+xml, application/xml, text/xml" } });
      diag.status = res.status;
      if (res.status === 429 || res.status >= 500) { diag.error = "HTTP_" + res.status; continue; }
      if (!res.ok) { diag.error = "HTTP_" + res.status; break; }
      const body = await res.text();
      diag.bytes = body.length;
      if (body.length > cfg.maxFeedBytes) { diag.error = "FEED_TOO_LARGE"; break; }
      const items = parseFeed(body);
      diag.items = items.length;
      if (!items.length) { diag.error = /<html/i.test(body.slice(0, 500)) ? "HTML_NOT_FEED" : "NO_ITEMS"; break; }
      diag.ok = true; diag.error = null; diag.ms = Date.now() - t0;
      return { items, diag };
    } catch (e) {
      diag.error = e && e.name === "AbortError" ? "TIMEOUT" : "NETWORK_ERROR";
    } finally { clearTimeout(timer); }
  }
  diag.ms = Date.now() - t0;
  return { items: [], diag };
}
