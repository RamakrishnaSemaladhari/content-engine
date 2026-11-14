// Best-effort retrieval of the ORIGINAL article text for editorial evidence.
// User-controlled URLs are restricted to HTTPS and an explicit publisher host allowlist is applied.
// Cloudflare global fetch uses strict-public routing; these checks are defense in depth, not a
// complete independent DNS/IP firewall. Bodies are byte-capped while streaming.
import {clean, decodeEntities} from "./feeds.js";

export function isSafeHttpsUrl(raw) {
  try {
    const u = new URL(raw);
    if (u.protocol !== "https:" || (u.port && u.port !== "443") || u.username || u.password) return false;
    const h = u.hostname.toLowerCase().replace(/\.$/, "");
    if (!h.includes(".") || h === "localhost" || /^\d{1,3}(\.\d{1,3}){3}$/.test(h) || h.includes(":") || h.startsWith("[")) return false;
    if (/\.(local|internal|localhost|lan|home|corp|test|invalid)$/.test(h)) return false;
    return true;
  } catch { return false; }
}
// Older Google News article ids embed the publisher URL in base64; newer opaque ids return null.
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
  const meta = n => { const m = h.match(new RegExp("<meta[^>]+(?:property|name)=[\\\"']" + n + "[\\\"'][^>]*content=[\\\"']([^\\\"']*)[\\\"']", "i")) || h.match(new RegExp("<meta[^>]+content=[\\\"']([^\\\"']*)[\\\"'][^>]*(?:property|name)=[\\\"']" + n + "[\\\"']", "i")); return m ? decodeEntities(m[1]).trim() : ""; };
  const published = meta("article:published_time") || meta("datePublished") || meta("date");
  const title = meta("og:title") || ((h.match(/<title[^>]*>([\s\S]*?)<\/title>/i) || [])[1] || "");
  h = h.replace(/<(script|style|noscript|svg|nav|header|footer|aside|form|iframe)[\s\S]*?<\/\1>/gi, " ");
  const art = (h.match(/<article[\s\S]*?<\/article>/i) || [h])[0];
  const paras = [...art.matchAll(/<p[^>]*>([\s\S]*?)<\/p>/gi)].map(m => clean(m[1])).filter(t => t.length > 40);
  return {title: clean(title).slice(0, 300), published: published.slice(0, 40), text: paras.join("\n").slice(0, 3500)};
}

async function readBodyLimited(response, maxBytes) {
  if (!response.body) return {text: "", tooLarge: false};
  const declared = Number(response.headers.get("content-length"));
  if (Number.isFinite(declared) && declared > maxBytes) {
    await response.body.cancel().catch(() => {});
    return {text: "", tooLarge: true};
  }
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let bytes = 0, text = "";
  try {
    while (true) {
      const {done, value} = await reader.read();
      if (done) break;
      bytes += value.byteLength;
      if (bytes > maxBytes) {
        await reader.cancel("BODY_TOO_LARGE").catch(() => {});
        return {text: "", tooLarge: true};
      }
      text += decoder.decode(value, {stream: true});
    }
    text += decoder.decode();
    return {text, tooLarge: false};
  } finally {
    try { reader.releaseLock(); } catch {}
  }
}

/** Resolves to {status, finalUrl, title, published, text, chars}. Never throws. */
export async function fetchSourceExtract(link, fetchImpl = fetch, opts = {}) {
  const timeoutMs = Math.max(100, Math.min(30000, Number(opts.timeoutMs) || 8000));
  const maxBytes = Math.max(1024, Math.min(700000, Number(opts.maxBytes) || 700000));
  const allowedHosts = Array.isArray(opts.allowedHosts) ? opts.allowedHosts.map(x => String(x).toLowerCase().replace(/^www\\./, "")) : null;
  const hostAllowed = value => {
    if (!allowedHosts) return true;
    const h = safeHost(value).replace(/^www\\./, "");
    return allowedHosts.some(d => h === d || h.endsWith("." + d)) || h.endsWith(".gov.in") || h.endsWith(".nic.in");
  };
  let url = link;
  const g = /(^|\.)news\.google\.com$/.test(safeHost(link)) ? decodeGoogleNewsUrl(link) : null;
  if (g) url = g;
  for (let hop = 0; hop < 5; hop++) {
    if (!isSafeHttpsUrl(url)) return {status: "UNAVAILABLE", reason: hop ? "REDIRECT_BLOCKED" : "URL_NOT_ALLOWED", finalUrl: null, text: "", chars: 0};
    if (!hostAllowed(url)) return {status: "UNAVAILABLE", reason: "HOST_NOT_ALLOWLISTED", finalUrl: null, text: "", chars: 0};
    if (/(^|\.)news\.google\.com$/.test(safeHost(url)) && hop > 0) return {status: "UNAVAILABLE", reason: "GOOGLE_NEWS_REDIRECT_ONLY", finalUrl: null, text: "", chars: 0};
    const ac = new AbortController(), t = setTimeout(() => ac.abort(), timeoutMs);
    try {
      const r = await fetchImpl(url, {redirect: "manual", signal: ac.signal, headers: {"user-agent": "FiveCheckMate-ResearchBot/1.2 (+https://fivecheckmate.com)", accept: "text/html"}});
      if (r.status >= 300 && r.status < 400 && r.headers.get("location")) {
        await r.body?.cancel().catch(() => {});
        url = new URL(r.headers.get("location"), url).toString();
        continue;
      }
      if (!r.ok) {
        await r.body?.cancel().catch(() => {});
        return {status: "UNAVAILABLE", reason: "HTTP_" + r.status, finalUrl: url, text: "", chars: 0};
      }
      if (!/html/i.test(r.headers.get("content-type") || "text/html")) {
        await r.body?.cancel().catch(() => {});
        return {status: "UNAVAILABLE", reason: "NOT_HTML", finalUrl: url, text: "", chars: 0};
      }
      const read = await readBodyLimited(r, maxBytes);
      if (read.tooLarge) return {status: "UNAVAILABLE", reason: "BODY_TOO_LARGE", finalUrl: url, text: "", chars: 0};
      if (/(^|\.)news\.google\.com$/.test(safeHost(url))) return {status: "UNAVAILABLE", reason: "GOOGLE_NEWS_REDIRECT_ONLY", finalUrl: url, text: "", chars: 0};
      const a = extractArticle(read.text);
      if (a.text.length < 400) return {status: "UNAVAILABLE", reason: "TEXT_TOO_SHORT_OR_PAYWALLED", finalUrl: url, text: "", chars: a.text.length};
      return {status: "OK", finalUrl: url, title: a.title, published: a.published, text: a.text, chars: a.text.length};
    } catch (e) {
      return {status: "UNAVAILABLE", reason: e && e.name === "AbortError" ? "TIMEOUT" : "NETWORK_ERROR", finalUrl: url, text: "", chars: 0};
    } finally { clearTimeout(t); }
  }
  return {status: "UNAVAILABLE", reason: "TOO_MANY_REDIRECTS", finalUrl: null, text: "", chars: 0};
}
function safeHost(u) { try { return new URL(u).hostname.toLowerCase().replace(/\.$/, ""); } catch { return ""; } }

function sameUrl(a, b) {
  try {
    const x = new URL(a), y = new URL(b);
    x.hash = ""; y.hash = "";
    return x.href === y.href;
  } catch { return false; }
}

/** Deterministic structure/risk checks, not legal or factual verification. */
export function validateDraft(result, {allowedUrls = [], evidence = "HEADLINE_ONLY"} = {}) {
  const hard = [], warnings = [], body = String(result.body_markdown || "");
  const words = body.split(/\s+/).filter(Boolean).length;
  if (words < 250) hard.push("BODY_TOO_SHORT(" + words + " words)");
  if ((body.match(/^##\s+\S/gm) || []).length < 2) hard.push("NEEDS_AT_LEAST_2_HEADINGS");
  if (String(result.title || "").length < 15) hard.push("TITLE_TOO_SHORT");
  if (/\b(?:is|was|are|were|been|be|found|proved?|proven)\s+(?:guilty|convicted)\b|\bfraudsters?\b|\bconvicted\s+of\b/i.test(body)) warnings.push("ASSERTS_GUILT_OR_CONVICTION: allegations must stay allegations");
  const urls = body.match(/https?:\/\/[^\s)\]>"']+/g) || [];
  const stray = urls.filter(u => !allowedUrls.some(a => sameUrl(u, a)));
  if (stray.length) warnings.push("LINKS_NOT_FROM_SOURCE: " + stray.slice(0, 3).join(" "));
  if (/\b(?:section|sec\.)\s*\d+|\bact,?\s+\d{4}|\bcase no\.?\s*\S+/i.test(body) && evidence !== "SOURCE_TEXT") warnings.push("CITES_STATUTE_OR_CASE_NUMBER_WITHOUT_SOURCE_TEXT: verify every citation");
  return {hard, warnings, words};
}
