import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {parseFeed, fetchFeed, canonicalize} from "../src/feeds.js";
import {getCandidates} from "../src/index.js";
import worker from "../src/index.js";
import {CONFIG} from "../src/config.js";

const fx = n => readFileSync(new URL("./fixtures/" + n, import.meta.url), "utf8").replaceAll("__NOW__", new Date().toUTCString());
const resp = (body, status = 200) => async () => new Response(body, {status});
const cfg = {...CONFIG, retries: 1, fetchTimeoutMs: 200};

test("parses RSS items incl. CDATA, entities, source url", () => {
  const it = parseFeed(fx("rss.xml"));
  assert.equal(it.length, 4);
  assert.equal(it[0].publisher, "The Hindu");
  assert.equal(it[0].publisherUrl, "https://www.thehindu.com");
  assert.ok(!it[0].snippet.includes("<a"));
  assert.ok(it[0].snippet.includes("& FIR"));
  assert.equal(it[1].title, "Old story about land fraud");
});
test("parses Atom entries (href link, summary, author)", () => {
  const it = parseFeed(fx("atom.xml"));
  assert.equal(it[0].link, "https://www.livelaw.in/a1");
  assert.equal(it[0].publisher, "LiveLaw");
  assert.ok(it[0].publishedAt);
});
test("malformed input never throws", () => { assert.deepEqual(parseFeed("<<<garbage"), []); assert.deepEqual(parseFeed(null), []); });
test("canonicalize strips tracking params and fragments", () => assert.equal(canonicalize("https://a.com/x?utm_source=1&id=2#f"), "https://a.com/x?id=2"));

test("fetchFeed diagnoses HTML consent page, 429 retry, timeout", async () => {
  assert.equal((await fetchFeed("https://x", cfg, resp("<html><body>consent</body></html>"))).diag.error, "HTML_NOT_FEED");
  let n = 0;
  const r = await fetchFeed("https://x", cfg, async () => (++n === 1 ? new Response("", {status: 429}) : new Response(fx("rss.xml"))));
  assert.equal(r.diag.ok, true); assert.equal(r.diag.attempts, 2);
  const t = await fetchFeed("https://x", cfg, (u, o) => new Promise((_, rej) => o.signal.addEventListener("abort", () => rej(Object.assign(new Error("a"), {name: "AbortError"})))));
  assert.equal(t.diag.error, "TIMEOUT");
  assert.equal((await fetchFeed("https://x", cfg, resp("", 403))).diag.error, "HTTP_403");
});
test("getCandidates filters old/irrelevant, dedups, isolates failing feeds", async () => {
  let i = 0;
  const f = async () => (++i % 2 ? new Response(fx("rss.xml")) : new Response("", {status: 500}));
  const r = await getCandidates(40, {...cfg, retries: 0}, f);
  assert.ok(r.summary.feedsOk >= 1 && r.summary.feedsOk < r.summary.feedsTotal);
  assert.equal(r.candidates.length, 1);                 // old + irrelevant + linkless dropped, duplicates merged
  assert.ok(r.candidates[0].title.startsWith("Hyderabad open plot"));
  assert.ok(r.summary.tooOld >= 1);
});
test("all feeds down -> zero candidates, feedsOk 0", async () => {
  const r = await getCandidates(40, {...cfg, retries: 0}, resp("", 503));
  assert.equal(r.summary.feedsOk, 0); assert.equal(r.candidates.length, 0);
});

test("API: health public, others need bearer, wrong token 401", async () => {
  const env = {ENGINE_API_TOKEN: "unit-test-token-not-real"};
  const call = (p, h = {}, m = "GET") => worker.fetch(new Request("https://w" + p, {method: m, headers: h}), env);
  assert.equal((await call("/api/health")).status, 200);
  assert.equal((await call("/api/drafts")).status, 401);
  assert.equal((await call("/api/diagnostics/rss", {authorization: "Bearer wrong"})).status, 401);
  const realFetch = globalThis.fetch; globalThis.fetch = resp(fx("rss.xml"));
  try {
    const d = await call("/api/diagnostics/rss", {authorization: "Bearer unit-test-token-not-real"});
    const j = await d.json();
    assert.equal(d.status, 200); assert.equal(j.summary.feedsTotal, 5);
    assert.ok(!JSON.stringify(j).includes("unit-test-token"));
  } finally { globalThis.fetch = realFetch; }
});
