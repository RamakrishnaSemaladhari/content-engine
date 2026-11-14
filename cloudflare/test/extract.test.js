import test from "node:test";
import assert from "node:assert/strict";
import {isSafeHttpsUrl, decodeGoogleNewsUrl, extractArticle, fetchSourceExtract, validateDraft} from "../src/extract.js";
import {getCandidates} from "../src/index.js";
import {CONFIG} from "../src/config.js";
import {fetchFeed} from "../src/feeds.js";

const page = "<html><head><meta property='og:title' content='Big story'><meta property='article:published_time' content='2026-11-10'></head><body><script>var x=1</script><article>" + "<p>Officials said the accused sold the same plot to several buyers using forged documents in Hyderabad.</p>".repeat(6) + "</article></body></html>";
const html = (b, h = {}) => new Response(b, {headers: {"content-type": "text/html", ...h}});

test("SSRF guard: only public https hosts", () => {
  for (const bad of ["http://a.com/x", "https://127.0.0.1/x", "https://169.254.169.254/", "https://localhost/x", "https://a.internal/x", "https://a.com:8443/x", "https://user:pw@a.com/", "https://[::1]/", "https://intranet/x"]) assert.equal(isSafeHttpsUrl(bad), false, bad);
  assert.equal(isSafeHttpsUrl("https://www.thehindu.com/a"), true);
  assert.equal(isSafeHttpsUrl("https://host.internal./a"), false);
});
test("decodes legacy Google News ids that embed the publisher URL; otherwise null", () => {
  const id = btoa("\x08\x13\x22\x40https://www.thehindu.com/news/story-1.ece\xd2\x01\x00").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  assert.equal(decodeGoogleNewsUrl("https://news.google.com/rss/articles/" + id), "https://www.thehindu.com/news/story-1.ece");
  assert.equal(decodeGoogleNewsUrl("https://news.google.com/rss/articles/CBMiopaqueidwithnourl"), null);
});
test("extractArticle strips scripts, reads title/date, joins paragraphs", () => {
  const a = extractArticle(page); assert.equal(a.title, "Big story"); assert.equal(a.published, "2026-11-10"); assert.ok(a.text.includes("forged documents")); assert.ok(!a.text.includes("var x"));
});
test("fetchSourceExtract OK, redirect followed + revalidated, internal redirect blocked, paywall/short, timeout", async () => {
  assert.equal((await fetchSourceExtract("https://pub.example/a", async () => html(page))).status, "OK");
  const oversized = await fetchSourceExtract("https://pub.example/a", async () => html("x".repeat(2048)), {maxBytes: 1024});
  assert.equal(oversized.reason, "BODY_TOO_LARGE");
  let n = 0; const redir = async (u) => ++n === 1 ? new Response(null, {status: 302, headers: {location: "https://pub2.example/real"}}) : html(page);
  const r = await fetchSourceExtract("https://pub.example/a", redir); assert.equal(r.status, "OK"); assert.equal(r.finalUrl, "https://pub2.example/real");
  const evil = await fetchSourceExtract("https://pub.example/a", async () => new Response(null, {status: 302, headers: {location: "https://169.254.169.254/latest/meta-data"}}));
  assert.deepEqual([evil.status, evil.reason], ["UNAVAILABLE", "REDIRECT_BLOCKED"]);
  assert.equal((await fetchSourceExtract("https://pub.example/a", async () => html("<html><article><p>short</p></article></html>"))).reason, "TEXT_TOO_SHORT_OR_PAYWALLED");
  assert.equal((await fetchSourceExtract("https://news.google.com/rss/articles/CBMiopaque", async () => html(page))).reason, "GOOGLE_NEWS_REDIRECT_ONLY");
  const slow = await fetchSourceExtract("https://pub.example/a", (u, o) => new Promise((_, rej) => o.signal.addEventListener("abort", () => rej(Object.assign(new Error("a"), {name: "AbortError"})))), {timeoutMs: 50});
  assert.equal(slow.reason, "TIMEOUT");
});
test("validateDraft: hard failures, guilt assertions, stray links, uncited statutes", () => {
  const body = "## A\n" + "word ".repeat(300) + "\n## B\nok";
  assert.deepEqual(validateDraft({title: "A decent long title", body_markdown: body}).hard, []);
  assert.ok(validateDraft({title: "A decent long title", body_markdown: "## A\nshort"}).hard.length >= 2);
  const w = validateDraft({title: "A decent long title", body_markdown: body + " The accused is guilty. See https://evil.example/x and Section 420 of the Act, 1860."}, {allowedUrls: ["https://pub.example/a"], evidence: "HEADLINE_ONLY"}).warnings.join("|");
  assert.match(w, /ASSERTS_GUILT/); assert.match(w, /LINKS_NOT_FROM_SOURCE/); assert.match(w, /CITES_STATUTE/);
  const prefixAttack = body + " See https://pub.example.evil.test/a";
  assert.match(validateDraft({title: "A decent long title", body_markdown: prefixAttack}, {allowedUrls: ["https://pub.example/a"]}).warnings.join("|"), /LINKS_NOT_FROM_SOURCE/);
});
test("undated stories are rejected from the shortlist (freshness cannot be proven)", async () => {
  const xml = `<rss><channel><item><title>Hyderabad plot fraud: police arrest three over fake documents - The Hindu</title><link>https://n.example/1</link><description>Police arrest accused in Hyderabad property fraud; fake documents, court, FIR Telangana</description><source url="https://www.thehindu.com">The Hindu</source></item></channel></rss>`;
  const f = async () => new Response(xml);
  const r = await getCandidates(40, {...CONFIG, retries: 0}, f);
  assert.equal(r.candidates.length, 0); assert.ok(r.summary.undated >= 1);
  const r2 = await getCandidates(40, {...CONFIG, retries: 0, allowUndated: true}, f); assert.equal(r2.candidates.length, 1);
});

test("RSS feed byte ceiling is enforced while streaming, including chunked bodies", async () => {
  let cancelled = false;
  const body = new ReadableStream({
    start(controller) {
      controller.enqueue(new TextEncoder().encode("<rss>" + "x".repeat(40)));
      controller.enqueue(new TextEncoder().encode("y".repeat(40) + "</rss>"));
    },
    cancel() { cancelled = true; }
  });
  const result = await fetchFeed("https://feeds.example/rss", {...CONFIG, retries: 0, maxFeedBytes: 32}, async () =>
    new Response(body, {headers: {"content-type": "application/rss+xml"}}));
  assert.equal(result.items.length, 0);
  assert.equal(result.diag.error, "FEED_TOO_LARGE");
  assert.ok(result.diag.bytes > 32);
  assert.equal(cancelled, true);
});

test("RSS feed declared oversized Content-Length is rejected before reading", async () => {
  const result = await fetchFeed("https://feeds.example/rss", {...CONFIG, retries: 0, maxFeedBytes: 32}, async () =>
    new Response("x".repeat(64), {headers: {"content-type": "application/rss+xml", "content-length": "64"}}));
  assert.equal(result.diag.error, "FEED_TOO_LARGE");
  assert.equal(result.diag.bytes, 64);
});

test("source retrieval allowlist blocks unknown hosts and revalidates redirect targets", async () => {
  let calls = 0;
  const blocked = await fetchSourceExtract("https://evil.example/story", async () => {
    calls++;
    return html(page);
  }, {allowedHosts: ["thehindu.com"]});
  assert.equal(blocked.reason, "HOST_NOT_ALLOWLISTED");
  assert.equal(calls, 0);

  const redirected = await fetchSourceExtract("https://www.thehindu.com/story", async () => {
    calls++;
    return new Response(null, {status: 302, headers: {location: "https://evil.example/redirect"}});
  }, {allowedHosts: ["thehindu.com"]});
  assert.equal(redirected.reason, "HOST_NOT_ALLOWLISTED");
  assert.equal(calls, 1);
});
