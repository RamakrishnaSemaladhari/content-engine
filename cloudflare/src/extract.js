// Best-effort retrieval of the ORIGINAL article text for fact-checking context.
// Untrusted input: https only, no IP literals/internal hosts, manual redirects re-validated, size+time bounded.
import {clean, decodeEntities} from "./feeds.js";

export function isSafeHttpsUrl(raw) {
  try {
    const u = new URL(raw);
    if (u.protocol !== "https:" || (u.port && u.port !== "443") || u.username || u.password) return false;
    const h = u.hostname.toLowerCase();
    if (!h.includes(".") || h === "localhost" || /^\d{1,3}(\.\d{1,3}){3}$/.test(h) || h.includes(":") || h.startsWith("[")) return false;
    return !/\.(local|internal|localhost|lan|home|corp)$/.test(h);
  } catch { return false; }
}
// Older Google News article ids embed the publisher URL in base64; newer ones do not (then returns null).
export function decodeGoogleNewsUrl(link) {
  try {
    const m = new URL(link).pathname.match(/\/articles\/([A-Za-z0-9_-]+)/);
    if (!m) return null;
    const bin = atob(m[1].replace(/-/g, "+").replace(/_/g, "/").padEnd(Math.ceil(m[1].length / 4) * 4, "="));
    const hit = bin.match(/https?:\/\/[\x21-\x7e]{8,}/);
    return hit && isSafeHttpsUrl(hit[0]) ? hit[0] : null;
  } catch { return null; }
}
export function extractArticle(html) {
  let h = String(html || "").slice(0, 700000);
  const meta = n => { const m = h.match(new RegExp("<meta[^>]+(?:property|name)=[\"']" + n + "[\"'][^>]*content=[\"']([^\"']*)[\"']", "i")) || h.match(new RegExp("<meta[^>]+content=[\"']([^\"']*)[\"'][^>]*(?:property|name)=[\"']" + n + "[\"']", "i")); return m ? decodeEntities(m[1]).trim() : ""; };
  const published = meta("article:published_time") || meta("datePublished") || meta("date");
  const title = meta("og:title") || ((h.match(/<title[^>]*>([\s\S]*?)<\/title>/i) || [])[1] || "");
  h = h.replace(/<(script|style|noscript|svg|nav|header|footer|aside|form|iframe)[\s\S]*?<\/\1>/gi, " ");
  const art = (h.match(/<article[\s\S]*?<\/article>/i) || [h])[0];
  const paras = [...art.matchAll(/<p[^>]*>([\s\S]*?)<\/p>/gi)].map(m => clean(m[1])).filter(t => t.length > 40);
  return {title: clean(title).slice(0, 300), published: published.slice(0, 40), text: paras.join("\n").slice(0, 3500)};
}
/** Resolves to {status, finalUrl, title, published, text, chars}. status: OK | UNAVAILABLE (reason). Never throws. */
export async function fetchSourceExtract(link, fetchImpl = fetch, opts = {}) {
  const timeoutMs = opts.timeoutMs || 8000, maxBytes = opts.maxBytes || 700000;
  let url = link, reason = "";
  const g = /(^|\.)news\.google\.com$/.test(safeHost(link)) ? decodeGoogleNewsUrl(link) : null;
  if (g) url = g;
  for (let hop = 0; hop < 5; hop++) {
    if (!isSafeHttpsUrl(url)) return {status: "UNAVAILABLE", reason: hop ? "REDIRECT_BLOCKED" : "URL_NOT_ALLOWED", finalUrl: null, text: "", chars: 0};
    if (/(^|\.)news\.google\.com$/.test(safeHost(url)) && hop > 0) return {status: "UNAVAILABLE", reason: "GOOGLE_NEWS_REDIRECT_ONLY", finalUrl: null, text: "", chars: 0};
    const ac = new AbortController(), t = setTimeout(() => ac.abort(), timeoutMs);
    try {
      const r = await fetchImpl(url, {redirect: "manual", signal: ac.signal, headers: {"user-agent": "FiveCheckMate-ResearchBot/1.1 (+https://fivecheckmate.com)", accept: "text/html"}});
      if (r.status >= 300 && r.status < 400 && r.headers.get("location")) { url = new URL(r.headers.get("location"), url).toString(); continue; }
      if (!r.ok) return {status: "UNAVAILABLE", reason: "HTTP_" + r.status, finalUrl: url, text: "", chars: 0};
      if (!/html/i.test(r.headers.get("content-type") || "text/html")) return {status: "UNAVAILABLE", reason: "NOT_HTML", finalUrl: url, text: "", chars: 0};
      const body = (await r.text()).slice(0, maxBytes);
      if (/(^|\.)news\.google\.com$/.test(safeHost(url))) return {status: "UNAVAILABLE", reason: "GOOGLE_NEWS_REDIRECT_ONLY", finalUrl: url, text: "", chars: 0};
      const a = extractArticle(body);
      if (a.text.length < 400) return {status: "UNAVAILABLE", reason: "TEXT_TOO_SHORT_OR_PAYWALLED", finalUrl: url, text: "", chars: a.text.length};
      return {status: "OK", finalUrl: url, title: a.title, published: a.published, text: a.text, chars: a.text.length};
    } catch (e) { return {status: "UNAVAILABLE", reason: e && e.name === "AbortError" ? "TIMEOUT" : "NETWORK_ERROR", finalUrl: url, text: "", chars: 0}; }
    finally { clearTimeout(t); }
  }
  return {status: "UNAVAILABLE", reason: "TOO_MANY_REDIRECTS", finalUrl: null, text: "", chars: 0};
}
function safeHost(u) { try { return new URL(u).hostname.toLowerCase(); } catch { return ""; } }

/** Deterministic checks. NOT a legal-accuracy check. Returns {hard: [...], warnings: [...]}. */
export function validateDraft(result, {allowedUrls = [], evidence = "HEADLINE_ONLY"} = {}) {
  const hard = [], warnings = [], body = String(result.body_markdown || "");
  const words = body.split(/\s+/).filter(Boolean).length;
  if (words < 250) hard.push("BODY_TOO_SHORT(" + words + " words)");
  if ((body.match(/^##\s+\S/gm) || []).length < 2) hard.push("NEEDS_AT_LEAST_2_HEADINGS");
  if (String(result.title || "").length < 15) hard.push("TITLE_TOO_SHORT");
  if (/\b(?:is|was|are|were|been|be|found|proved?|proven)\s+(?:guilty|convicted)\b|\bfraudsters?\b|\bconvicted\s+of\b/i.test(body)) warnings.push("ASSERTS_GUILT_OR_CONVICTION: allegations must stay allegations");
  const urls = body.match(/https?:\/\/[^\s)\]>"']+/g) || [];
  const stray = urls.filter(u => !allowedUrls.some(a => u.startsWith(a) || a.startsWith(u)));
  if (stray.length) warnings.push("LINKS_NOT_FROM_SOURCE: " + stray.slice(0, 3).join(" "));
  if (/\b(?:section|sec\.)\s*\d+|\bact,?\s+\d{4}|\bcase no\.?\s*\S+/i.test(body) && evidence !== "SOURCE_TEXT") warnings.push("CITES_STATUTE_OR_CASE_NUMBER_WITHOUT_SOURCE_TEXT: verify every citation");
  return {hard, warnings, words};
}
