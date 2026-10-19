import test from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import {execFileSync, spawnSync} from "node:child_process";
import {toArticle} from "../scripts/sync-drafts.mjs";

test("toArticle maps fields, keeps only https sources, adds editor note", () => {
  const a = toArticle({title: "T", slug: "s", meta_description: "M", body_markdown: "B".repeat(100), verification_notes: "single source", source_list_json: JSON.stringify([{url: "https://x.com/1", publisher: "P"}, {url: "http://bad"}])});
  assert.equal(a.sourceLinks.length, 1); assert.match(a.bodyMarkdown, /^> EDITOR NOTE/); assert.equal(a.summary, "M");
});
test("sync end-to-end against mock engine+insights; idempotent; no token in output", async () => {
  const seen = []; let n = 0;
  const srv = http.createServer((q, s) => {
    let b = ""; q.on("data", c => b += c); q.on("end", () => {
      seen.push(q.method + " " + q.url); s.setHeader("content-type", "application/json");
      if (q.url === "/api/drafts") return s.end(JSON.stringify({drafts: [{id: "d1", status: "UNPUBLISHED"}, {id: "d2", status: "APPROVED"}]}));
      if (q.url.startsWith("/api/drafts/")) return s.end(JSON.stringify({draft: {title: "T", slug: "slug-1", meta_description: "M", body_markdown: "B".repeat(100), verification_notes: "", source_list_json: "[]"}}));
      if (q.url === "/api/ingest/draft") { if (q.headers["x-ingest-token"] !== "ing") { s.statusCode = 401; return s.end("{}"); } n++; s.statusCode = n === 1 ? 201 : 200; return s.end(JSON.stringify(n === 1 ? {ok: true} : {ok: true, duplicate: true})); }
      s.statusCode = 404; s.end("{}");
    });
  });
  await new Promise(r => srv.listen(0, r)); const url = "http://127.0.0.1:" + srv.address().port;
  const env = {...process.env, ENGINE_API_URL: url, ENGINE_API_TOKEN: "eng-secret-xyz", INSIGHTS_API_URL: url, INSIGHTS_INGEST_TOKEN: "ing"};
  const run = () => new Promise(res => { const c = spawnSync(process.execPath, ["scripts/sync-drafts.mjs"], {env, encoding: "utf8"}); res(c); });
  const r1 = await run(); const r2 = await run(); srv.close();
  assert.match(r1.stdout, /1 created/); assert.match(r2.stdout, /1 already present/);
  assert.ok(!(r1.stdout + r1.stderr).includes("eng-secret-xyz"));
  assert.equal(seen.filter(x => x === "GET /api/drafts/d2").length, 0); // non-UNPUBLISHED skipped
  const skip = spawnSync(process.execPath, ["scripts/sync-drafts.mjs"], {env: {PATH: process.env.PATH}, encoding: "utf8"});
  assert.match(skip.stdout, /skipped/); assert.equal(skip.status, 0);
});
