import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {DatabaseSync} from "node:sqlite";
import worker, {titleKey, similar, topicOf} from "../src/index.js";

const sql = readFileSync(new URL("../schema.sql", import.meta.url), "utf8");
const mk = () => { const db = new DatabaseSync(":memory:"); db.exec(sql); return {raw: db, prepare(q) { let a = []; const st = {
  bind(...x) { a = x; return st; }, async first() { return db.prepare(q).get(...a) ?? null; },
  async all() { return {results: db.prepare(q).all(...a)}; }, async run() { const r = db.prepare(q).run(...a); return {meta: {changes: Number(r.changes)}}; } }; return st; }}; };
const item = (t, link, pub, src) => `<item><title>${t} - ${pub}</title><link>${link}</link><pubDate>${new Date().toUTCString()}</pubDate><description>Police arrest accused in Hyderabad property fraud; fake documents sold to buyers, court told, FIR filed in Telangana</description><source url="${src}">${pub}</source></item>`;
const rss = `<rss><channel>${item("Hyderabad plot fraud: police arrest three over fake documents", "https://news.example/a1", "The Hindu", "https://www.thehindu.com")}${item("Hyderabad plot fraud police arrest three over fake documents", "https://news.example/a2", "Deccan Chronicle", "https://www.deccanchronicle.com")}${item("Telangana villa buyers cheated; registration forged, court orders probe", "https://news.example/b1", "Telangana Today", "https://telanganatoday.com")}</channel></rss>`;
const good = JSON.stringify({status: "DRAFT_READY", title: "How to verify a plot before paying", seo_title: "Verify a Hyderabad plot", slug: "verify-plot", meta_description: "m", suggested_headings: ["Check title", "Check EC"], body_markdown: "## Check\n" + "Verify the encumbrance certificate and sale deed chain. ".repeat(12), verification_notes: "single report"});
const env = {DB: mk(), ENGINE_API_TOKEN: "t"};
const call = async (path, method = "POST") => { const r = await worker.fetch(new Request("https://w" + path, {method, headers: {authorization: "Bearer t"}, body: method === "POST" ? "{}" : undefined}), env); return {status: r.status, body: await r.json()}; };
const q = s => env.DB.raw.prepare(s);
const realFetch = globalThis.fetch; globalThis.fetch = async () => new Response(rss);
test.after(() => { globalThis.fetch = realFetch; });

test("helpers: title key strips publisher, near-duplicates detected, topic", () => {
  assert.equal(titleKey("Plot fraud: arrests - The Hindu"), "plot fraud arrests");
  assert.ok(similar(titleKey("Hyderabad plot fraud: police arrest three - A"), titleKey("Hyderabad plot fraud police arrest three - B")));
  assert.equal(topicOf("forged registration and sub-registrar deed"), "Registration & records");
});
test("Day 1: shortlist uses NO AI, dedupes (URL + near-duplicate title), is idempotent", async () => {
  env.AI = {run: async () => { throw new Error("AI must not be called on Day 1"); }};
  const r = await call("/api/run/shortlist");
  assert.equal(r.body.aiUsed, false); assert.equal(r.body.added, 2); assert.equal(r.body.duplicatesByTitle >= 1, true);
  const r2 = await call("/api/run/shortlist"); assert.equal(r2.body.added, 0);
  const list = (await call("/api/shortlist", "GET")).body.candidates;
  assert.equal(list.length, 2); assert.ok(list.every(c => c.status === "SHORTLISTED" && c.reason.includes("score")));
  assert.equal(q("SELECT COUNT(*) n FROM drafts").get().n, 0);
});
test("Day 2 does nothing until a human selects; selection transitions are guarded", async () => {
  env.AI = {run: async () => ({response: good})};
  assert.equal((await call("/api/run/draft")).body.status, "NOTHING_SELECTED");
  const id = q("SELECT id FROM candidates ORDER BY total_score DESC").get().id;
  assert.equal((await call(`/api/shortlist/${id}/select`)).status, 200);
  assert.equal((await call(`/api/shortlist/${id}/select`)).status, 409); // already selected
  assert.equal((await call(`/api/shortlist/99999/reject`)).status, 409);
});
test("Day 2: one article per request, UNPUBLISHED draft with source + verification notes, not re-drafted", async () => {
  const r = await call("/api/run/draft");
  assert.equal(r.body.status, "DRAFT_READY"); assert.equal(r.body.published, false); assert.equal(r.body.remaining, 0);
  const d = q("SELECT status,verification_notes,source_list_json FROM drafts").get();
  assert.equal(d.status, "UNPUBLISHED"); assert.match(d.verification_notes, /Suggested headings: Check title/); assert.match(d.source_list_json, /news\.example/);
  assert.equal(q("SELECT status FROM candidates WHERE job_id IS NOT NULL").get().status, "DRAFTED");
  assert.equal((await call("/api/run/draft")).body.status, "NOTHING_SELECTED");
});
test("quota exhaustion: story stays queued, attempts not burned, caller told to stop; no provider switch", async () => {
  const id = q("SELECT id FROM candidates WHERE status='SHORTLISTED'").get().id; await call(`/api/shortlist/${id}/select`);
  env.AI = {run: async () => { throw new Error("429 daily neuron quota exceeded"); }};
  const r = await call("/api/run/draft");
  assert.equal(r.status, 429); assert.equal(r.body.stop, true); assert.equal(r.body.aiErrorCode, "AI_QUOTA_OR_LIMIT");
  const c = q("SELECT status,attempts,last_error_code FROM candidates WHERE id=?").get(id);
  assert.deepEqual({...c}, {status: "SELECTED", attempts: 0, last_error_code: "AI_QUOTA_OR_LIMIT"});
});
test("other AI failures: bounded to 3 attempts then FAILED; reselect resets", async () => {
  const id = q("SELECT id FROM candidates WHERE status='SELECTED'").get().id;
  env.AI = {run: async () => ({response: "not json"})};
  for (let i = 0; i < 3; i++) await call("/api/run/draft");
  assert.equal(q("SELECT status,attempts FROM candidates WHERE id=?").get(id).status, "FAILED");
  assert.equal((await call("/api/run/draft")).body.status, "NOTHING_SELECTED");
  assert.equal((await call(`/api/shortlist/${id}/select`)).status, 200);
  assert.equal(q("SELECT attempts FROM candidates WHERE id=?").get(id).attempts, 0);
});
test("auth required on all queue routes", async () => {
  for (const [m, p] of [["POST", "/api/run/shortlist"], ["POST", "/api/run/draft"], ["GET", "/api/shortlist"], ["POST", "/api/shortlist/1/select"]]) {
    const r = await worker.fetch(new Request("https://w" + p, {method: m}), env); assert.equal(r.status, 401);
  }
});
