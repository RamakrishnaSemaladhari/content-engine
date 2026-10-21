import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {DatabaseSync} from "node:sqlite";
import worker from "../src/worker.js";

function d1(migrations, seed) {
  const db = new DatabaseSync(":memory:"); if (seed) db.exec(seed);
  for (const m of migrations) db.exec(readFileSync(new URL("../migrations/" + m, import.meta.url), "utf8"));
  return {prepare(sql) { let args = []; const st = {
    bind(...a) { args = a; return st; },
    async first() { return db.prepare(sql).get(...args) ?? null; },
    async all() { return {results: db.prepare(sql).all(...args)}; },
    async run() { const r = db.prepare(sql).run(...args); return {meta: {changes: Number(r.changes)}}; }
  }; return st; }};
}
const SEED = `CREATE TABLE drafts(id TEXT PRIMARY KEY,job_id TEXT,title TEXT,slug TEXT,meta_description TEXT,body_markdown TEXT,source_list_json TEXT,verification_notes TEXT,status TEXT,created_at TEXT DEFAULT CURRENT_TIMESTAMP);
INSERT INTO drafts(id,job_id,title,slug,meta_description,body_markdown,source_list_json,verification_notes,status) VALUES('fc-20261022-draft','fc-20261022','Plot title checks','plot-title','Checks before paying','${"Verify the encumbrance certificate and sale deed chain. ".repeat(3)}','[{"url":"https://example.com/a","title":"A"}]','single source','UNPUBLISHED'),('d-appr','j2','Approved one','appr','m','${"x".repeat(100)}','[]','','APPROVED');`;
const env = {DB: d1(["0001_init.sql", "0002_engine_draft_id.sql"]), CONTENT_DB: d1([], SEED), SESSION_SECRET: "s".repeat(40), BOOTSTRAP_TOKEN: "boot-test", ASSETS: {fetch: async () => new Response("x")}};
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
test("engine import: auth required, lists only UNPUBLISHED, imports as DRAFT, idempotent, not public", async () => {
  assert.equal((await call("/api/admin/engine-drafts")).status, 401);
  const list = await (await call("/api/admin/engine-drafts", {cookie})).json();
  assert.deepEqual(list.drafts.map(d => d.id), ["fc-20261022-draft"]);
  assert.equal((await call("/api/admin/engine-drafts/d-appr/import", {method: "POST", cookie})).status, 404);
  const r = await call("/api/admin/engine-drafts/fc-20261022-draft/import", {method: "POST", cookie});
  assert.equal(r.status, 201); const j = await r.json(); assert.equal(j.status, "draft"); assert.equal(j.published, false); articleId = j.id;
  assert.equal((await (await call("/api/admin/engine-drafts/fc-20261022-draft/import", {method: "POST", cookie})).json()).alreadyImported, true);
  assert.equal((await (await call("/api/articles")).json()).articles.length, 0);
});
test("imported draft needs submit -> approve -> publish; then public page works", async () => {
  assert.equal((await call(`/api/admin/articles/${articleId}/publish`, {method: "POST", cookie})).status, 409);
  for (const a of ["submit", "approve"]) assert.equal((await call(`/api/admin/articles/${articleId}/${a}`, {method: "POST", cookie})).status, 200);
  const slug = (await (await call("/api/admin/articles", {cookie})).json()).articles[0].slug;
  assert.equal((await call("/api/articles/" + slug)).status, 404);
  assert.equal((await call(`/api/admin/articles/${articleId}/publish`, {method: "POST", cookie})).status, 200);
  const pub = await (await call("/api/articles/" + slug)).json();
  assert.ok(pub.article.bodyMarkdown.includes("encumbrance"));
});
test("cross-origin state change is refused; same-origin allowed", async () => {
  assert.equal((await call(`/api/admin/articles/${articleId}/unpublish`, {method: "POST", cookie, headers: {origin: "https://evil.test"}})).status, 403);
  assert.equal((await call(`/api/admin/articles/${articleId}/unpublish`, {method: "POST", cookie, headers: {origin: "https://w.test"}})).status, 200);
});
test("import returns 503 when CONTENT_DB binding is absent", async () => {
  const saved = env.CONTENT_DB; delete env.CONTENT_DB;
  assert.equal((await call("/api/admin/engine-drafts", {cookie})).status, 503);
  env.CONTENT_DB = saved;
});
