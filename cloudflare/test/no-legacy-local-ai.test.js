import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";

test("production engine contains no dormant local-Ollama fallback implementation", () => {
  const source = readFileSync(new URL("../src/index.js", import.meta.url), "utf8");
  assert.doesNotMatch(source, /ollama|LOCAL_AI_PENDING|runDaily|runCloudAi|claimLocal|completeLocal/i);
});
