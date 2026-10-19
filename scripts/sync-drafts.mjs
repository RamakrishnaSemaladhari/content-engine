// Copies UNPUBLISHED Content Engine drafts into the Insights review queue as status "draft".
// Idempotent (slug is unique). Never approves or publishes. Logs counts/slugs only - never bodies or tokens.
const need = ["ENGINE_API_URL", "ENGINE_API_TOKEN", "INSIGHTS_API_URL", "INSIGHTS_INGEST_TOKEN"];
const miss = need.filter(k => !process.env[k]);
if (miss.length) { console.log("::notice::Draft sync skipped; missing secret(s): " + miss.join(", ")); process.exit(0); }
const eng = process.env.ENGINE_API_URL.replace(/\/$/, ""), ins = process.env.INSIGHTS_API_URL.replace(/\/$/, "");
const engH = {authorization: "Bearer " + process.env.ENGINE_API_TOKEN};
const get = async p => { const r = await fetch(eng + p, {headers: engH, signal: AbortSignal.timeout(20000)}); if (!r.ok) throw new Error(`engine ${p.split("/").slice(0,3).join("/")} HTTP ${r.status}`); return r.json(); };

export function toArticle(d) {
  let sources = []; try { sources = JSON.parse(d.source_list_json || "[]"); } catch {}
  sources = sources.filter(s => /^https:\/\//i.test(s.url || "")).slice(0, 30).map(s => ({url: s.url, title: String(s.title || s.publisher || "Source").slice(0, 200)}));
  const note = d.verification_notes ? `> EDITOR NOTE - verify and delete before publishing: ${String(d.verification_notes).replace(/\s+/g, " ").slice(0, 1200)}\n\n` : "";
  return {title: d.title, slug: d.slug, category: "Property", summary: (d.meta_description || d.title).slice(0, 500),
          metaDescription: d.meta_description, bodyMarkdown: note + d.body_markdown, sourceLinks: sources};
}
export async function main() {
  const {drafts = []} = await get("/api/drafts");
  let created = 0, dup = 0, failed = 0;
  for (const row of drafts.filter(d => d.status === "UNPUBLISHED")) {
    try {
      const {draft} = await get("/api/drafts/" + encodeURIComponent(row.id));
      const r = await fetch(ins + "/api/ingest/draft", {method: "POST", headers: {"content-type": "application/json", "x-ingest-token": process.env.INSIGHTS_INGEST_TOKEN}, body: JSON.stringify(toArticle(draft)), signal: AbortSignal.timeout(20000)});
      const j = await r.json().catch(() => ({}));
      if (r.status === 201) { created++; console.log("created review draft:", draft.slug); }
      else if (r.ok && j.duplicate) dup++;
      else { failed++; console.log(`::warning::ingest ${draft.slug} HTTP ${r.status}: ${String(j.error || "").slice(0, 120)}`); }
    } catch (e) { failed++; console.log("::warning::" + String(e.message).slice(0, 160)); }
  }
  console.log(`Draft sync: ${created} created, ${dup} already present, ${failed} failed. Nothing is published automatically.`);
  if (failed) process.exitCode = 1;
}
if (import.meta.url === `file://${process.argv[1]}`) main();
