import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {DatabaseSync} from "node:sqlite";
import worker from "../src/worker.js";

function d1() {
  const db = new DatabaseSync(":memory:");
  db.exec(readFileSync(new URL("../migrations/0001_init.sql", import.meta.url), "utf8"));
  return {prepare(sql) { let args = []; const st = {
    bind(...a) { args = a; return st; },
    async first() { return db.prepare(sql).get(...args) ?? null; },
    async all() { return {results: db.prepare(sql).all(...args)}; },
    async run() { const r = db.prepare(sql).run(...args); return {meta: {changes: Number(r.changes)}}; }
  }; return st; }};
}
const env = {DB: d1(), SESSION_SECRET: "s".repeat(40), BOOTSTRAP_TOKEN: "boot-test", INGEST_TOKEN: "ingest-test", ASSETS: {fetch: async () => new Response("x")}};
const call = (path, {method = "GET", headers = {}, body, cookie} = {}) => worker.fetch(new Request("https://w.test" + path, {method, headers: {"content-type": "application/json", ...(cookie ? {cookie} : {}), ...headers}, body: body ? JSON.stringify(body) : undefined}), env);
const draft = {title: "Checking a plot's title documents", summary: "What to verify before paying a token amount.", bodyMarkdown: "## Steps\n" + "Verify the encumbrance certificate and the sale deed chain. ".repeat(3), sourceLinks: [{url: "https://example.com/a", title: "A"}]};
let cookie, articleId;

test("setup state, first admin, login", async () => {
  assert.deepEqual(await (await call("/api/setup/status")).json(), {needsSetup: true});
  assert.equal((await call("/api/setup", {method: "POST", headers: {"x-setup-token": "wrong"}, body: {username: "admin1", password: "long-enough-password"}})).status, 401);
  const r = await call("/api/setup", {method: "POST", headers: {"x-setup-token": "boot-test"}, body: {username: "admin1", password: "long-enough-password"}});
  assert.equal(r.status, 201);
  assert.deepEqual(await (await call("/api/setup/status")).json(), {needsSetup: false});
  const l = await call("/api/login", {method: "POST", body: {username: "admin1", password: "long-enough-password"}});
  cookie = l.headers.get("set-cookie").split(";")[0]; assert.ok(cookie.startsWith("fc_session="));
});
test("ingest: needs token, creates DRAFT only, idempotent, https sources", async () => {
  assert.equal((await call("/api/ingest/draft", {method: "POST", body: {...draft, slug: "plot-title"}})).status, 401);
  assert.equal((await call("/api/ingest/draft", {method: "POST", headers: {"x-ingest-token": "nope"}, body: draft})).status, 401);
  const r = await call("/api/ingest/draft", {method: "POST", headers: {"x-ingest-token": "ingest-test"}, body: {...draft, slug: "plot-title"}});
  assert.equal(r.status, 201); const j = await r.json(); assert.equal(j.status, "draft"); articleId = j.id;
  const dup = await call("/api/ingest/draft", {method: "POST", headers: {"x-ingest-token": "ingest-test"}, body: {...draft, slug: "plot-title"}});
  assert.equal((await dup.json()).duplicate, true);
  const bad = await call("/api/ingest/draft", {method: "POST", headers: {"x-ingest-token": "ingest-test"}, body: {...draft, slug: "x2", sourceLinks: [{url: "http://insecure"}]}});
  assert.equal(bad.status, 400);
  assert.equal((await (await call("/api/articles")).json()).articles.length, 0); // not public
  assert.equal((await call("/api/articles/plot-title")).status, 404);
});
test("ingested draft cannot be published without review+approval; system user cannot log in", async () => {
  assert.equal((await call(`/api/admin/articles/${articleId}/publish`, {method: "POST", cookie})).status, 409);
  assert.equal((await call("/api/login", {method: "POST", body: {username: "content-engine", password: "no-login"}})).status, 401);
  for (const a of ["submit", "approve"]) assert.equal((await call(`/api/admin/articles/${articleId}/${a}`, {method: "POST", cookie})).status, 200);
  assert.equal((await call("/api/articles/plot-title")).status, 404); // approved != public
  assert.equal((await call(`/api/admin/articles/${articleId}/publish`, {method: "POST", cookie})).status, 200);
  const pub = await (await call("/api/articles/plot-title")).json();
  assert.equal(pub.article.slug, "plot-title"); assert.ok(pub.article.bodyMarkdown.includes("encumbrance"));
});
test("cross-origin state change is refused; same-origin allowed", async () => {
  assert.equal((await call(`/api/admin/articles/${articleId}/unpublish`, {method: "POST", cookie, headers: {origin: "https://evil.test"}})).status, 403);
  assert.equal((await call(`/api/admin/articles/${articleId}/unpublish`, {method: "POST", cookie, headers: {origin: "https://w.test"}})).status, 200);
});
test("ingest disabled when INGEST_TOKEN unset", async () => {
  const saved = env.INGEST_TOKEN; delete env.INGEST_TOKEN;
  assert.equal((await call("/api/ingest/draft", {method: "POST", headers: {"x-ingest-token": "x"}, body: draft})).status, 503);
  env.INGEST_TOKEN = saved;
});
