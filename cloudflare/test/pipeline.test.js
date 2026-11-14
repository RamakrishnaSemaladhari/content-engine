import test from "node:test";
import assert from "node:assert/strict";
import worker from "../src/index.js";

const env = {ENGINE_API_TOKEN: "test-token"};
const routes = ["/api/run/daily", "/api/local/claim", "/api/local/complete"];

test("legacy daily and local-AI pipeline is disabled", async () => {
  for (const path of routes) {
    const response = await worker.fetch(new Request("https://worker.example" + path, {
      method: "POST",
      headers: {authorization: "Bearer test-token", "content-type": "application/json"},
      body: "{}"
    }), env);
    const body = await response.json();
    assert.equal(response.status, 410, path);
    assert.equal(body.error, "LEGACY_ROUTE_DISABLED", path);
  }
});

test("legacy local-AI routes still require authentication", async () => {
  for (const path of routes) {
    const response = await worker.fetch(new Request("https://worker.example" + path, {
      method: "POST",
      headers: {"content-type": "application/json"},
      body: "{}"
    }), env);
    assert.equal(response.status, 401, path);
  }
});
