import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {DatabaseSync} from "node:sqlite";
import worker from "../src/index.js";

const sql = readFileSync(new URL("../schema.sql", import.meta.url), "utf8");
function d1() {
  const db = new DatabaseSync(":memory:");
  db.exec(sql);
  return {raw: db, prepare(q) {
    let args = [];
    const st = {
      bind(...x) { args = x; return st; },
      async first() { return db.prepare(q).get(...args) ?? null; },
      async all() { return {results: db.prepare(q).all(...args)}; },
      async run() { const r = db.prepare(q).run(...args); return {meta: {changes: Number(r.changes)}}; }
    };
    return st;
  }};
}
const rss = readFileSync(new URL("./fixtures/rss.xml", import.meta.url), "utf8")
  .replaceAll("__NOW__", new Date().toUTCString());
const goodResult = {
  status: "DRAFT_READY",
  title: "Check the title chain before paying",
  slug: "title-chain",
  meta_description: "A practical property-document checklist",
  body_markdown: "Verify the encumbrance certificate and compare the registered title chain. ".repeat(12),
  verification_notes: "RSS metadata is not independent verification; check source pages before publication.",
  selected_sources: [],
  source_claims: []
};
function setup() {
  const env = {DB: d1(), ENGINE_API_TOKEN: "unit-test-token-not-real"};
  const call = (path, method="GET", payload=null) => worker.fetch(new Request("https://worker.test"+path, {
    method,
    headers: {"authorization":"Bearer unit-test-token-not-real","content-type":"application/json"},
    ...(payload === null ? {} : {body:JSON.stringify(payload)})
  }), env);
  return {env, call};
}
const realFetch = globalThis.fetch;
test("research checkpoints source candidates for online GitHub Copilot; never invokes Workers AI", async () => {
  const {env, call} = setup();
  let aiCalls = 0;
  env.AI = {run: async () => { aiCalls++; throw new Error("AI must not run inside the Worker"); }};
  globalThis.fetch = async () => new Response(rss);
  const response = await call("/api/run/daily", "POST", {maxCandidates:40});
  const body = await response.json();
  assert.equal(response.status, 200);
  assert.equal(body.status, "RUNNER_AI_PENDING");
  assert.ok(body.candidateCount > 0);
  assert.equal(aiCalls, 0);
  const job = env.DB.raw.prepare("SELECT status,stage FROM jobs").get();
  assert.equal(job.status, "LOCAL_AI_PENDING"); // existing D1 CHECK enum retained for compatibility
  assert.equal(job.stage, "github_runner_ai");
  const checkpoint = env.DB.raw.prepare("SELECT payload_json FROM checkpoints WHERE stage='ai_task'").get();
  assert.ok(JSON.parse(checkpoint.payload_json).candidates.length > 0);

  const claimResponse = await call("/api/runner/claim", "POST", {});
  const claim = await claimResponse.json();
  assert.ok(claim.jobId);
  assert.ok(claim.task.candidates.length > 0);
  assert.equal(env.DB.raw.prepare("SELECT lease_owner FROM jobs").get().lease_owner, "github-runner-ai");

  goodResult.selected_sources = claim.task.candidates.slice(0,2).map(x => ({url:x.url,publisher:x.publisher,title:x.title}));
  const completion = await call("/api/runner/complete", "POST", {jobId:claim.jobId,result:goodResult});
  const saved = await completion.json();
  assert.equal(completion.status, 200);
  assert.equal(saved.status, "DRAFT_READY");
  assert.equal(saved.published, false);
  assert.equal(env.DB.raw.prepare("SELECT status FROM drafts").get().status, "UNPUBLISHED");
  assert.equal(env.DB.raw.prepare("SELECT COUNT(*) n FROM audit_events WHERE event_type='DRAFT_SAVED'").get().n, 1);

  const resumed = await (await call("/api/run/daily", "POST", {})).json();
  assert.equal(resumed.status, "DRAFT_READY");
  assert.equal(resumed.resumed, true);
  assert.equal(env.DB.raw.prepare("SELECT COUNT(*) n FROM drafts").get().n, 1);
});

test("online Copilot failure requeues the checkpoint for a later manual run", async () => {
  const {env, call} = setup();
  globalThis.fetch = async () => new Response(rss);
  const run = await (await call("/api/run/daily", "POST", {})).json();
  assert.equal(run.status, "RUNNER_AI_PENDING");
  const claim = await (await call("/api/runner/claim", "POST", {})).json();
  const failed = await (await call("/api/runner/complete", "POST", {
    jobId: claim.jobId, errorCode: "COPILOT_FAILED", errorSafe: "Copilot CLI not authorized"
  })).json();
  assert.equal(failed.status, "RUNNER_AI_PENDING");
  assert.equal(env.DB.raw.prepare("SELECT status,last_error_code FROM jobs").get().status, "LOCAL_AI_PENDING");
  assert.equal(env.DB.raw.prepare("SELECT last_error_code FROM jobs").get().last_error_code, "RUNNER_AI_FAILED");
  assert.equal(env.DB.raw.prepare("SELECT COUNT(*) n FROM drafts").get().n, 0);
  const retried = await (await call("/api/runner/claim", "POST", {})).json();
  assert.equal(retried.jobId, claim.jobId);
  assert.ok(retried.task.candidates.length > 0);
});

test.after(() => { globalThis.fetch = realFetch; });
