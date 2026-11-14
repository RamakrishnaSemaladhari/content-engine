import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {DatabaseSync} from "node:sqlite";
import worker from "../src/index.js";

const sql = readFileSync(new URL("../schema.sql", import.meta.url), "utf8");
function d1() { const db = new DatabaseSync(":memory:"); db.exec(sql); return {raw: db, prepare(q) { let a = []; const st = {
  bind(...x) { a = x; return st; }, async first() { return db.prepare(q).get(...a) ?? null; },
  async all() { return {results: db.prepare(q).all(...a)}; }, async run() { const r = db.prepare(q).run(...a); return {meta: {changes: Number(r.changes)}}; } }; return st; }}; }
const rss = readFileSync(new URL("./fixtures/rss.xml", import.meta.url), "utf8").replaceAll("__NOW__", new Date().toUTCString());
const goodJson = JSON.stringify({status: "DRAFT_READY", title: "Check the title chain before paying", slug: "title-chain", meta_description: "m", body_markdown: "Verify the encumbrance certificate. ".repeat(20), verification_notes: "single source"});
const env = {DB: d1(), ENGINE_API_TOKEN: "t"};
const run = async () => { const r = await worker.fetch(new Request("https://w/api/run/daily", {method: "POST", headers: {authorization: "Bearer t"}, body: "{}"}), env); return {status: r.status, body: await r.json()}; };
const job = () => env.DB.raw.prepare("SELECT status,last_error_code,last_error_safe FROM jobs").get();
const realFetch = globalThis.fetch; globalThis.fetch = async () => new Response(rss);

test("AI failure is recorded with real reason; next run retries cloud AI and saves UNPUBLISHED draft", async () => {
  env.AI = {run: async () => { throw new Error("5016: Model requires you to agree to license terms"); }};
  let r = await run();
  assert.equal(r.body.status, "LOCAL_AI_PENDING");
  assert.equal(job().last_error_code, "AI_MODEL_TERMS_NOT_ACCEPTED");
  assert.match(job().last_error_safe, /license terms/);
  env.AI = {run: async () => ({response: goodJson})};
  r = await run();
  assert.equal(r.body.status, "DRAFT_READY");
  const d = env.DB.raw.prepare("SELECT status FROM drafts").get();
  assert.equal(d.status, "UNPUBLISHED");
  assert.equal((await run()).body.resumed, true); // idempotent: no second draft
  assert.equal(env.DB.raw.prepare("SELECT COUNT(*) n FROM drafts").get().n, 1);
});
test("bad model JSON classified AI_BAD_OUTPUT; retries are bounded to 3", async () => {
  env.DB = d1(); env.AI = {run: async () => ({response: "not json"})};
  await run(); assert.equal(job().last_error_code, "AI_BAD_OUTPUT");
  await run(); await run(); await run();
  const n = env.DB.raw.prepare("SELECT COUNT(*) n FROM audit_events WHERE event_type='CLOUD_AI_RETRY'").get().n;
  assert.equal(n, 3);
  const r = await run(); assert.equal(r.body.status, "LOCAL_AI_PENDING"); assert.equal(r.body.lastError, "AI_BAD_OUTPUT");
  assert.equal(env.DB.raw.prepare("SELECT COUNT(*) n FROM drafts").get().n, 0);
});
test.after(() => { globalThis.fetch = realFetch; });
