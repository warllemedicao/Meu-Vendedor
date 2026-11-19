import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = path => readFileSync(new URL("../" + path, import.meta.url), "utf8");
const edge = read("supabase/functions/story-studio/index.ts");
const studio = read("src/components/stories/StoriesStudio.tsx");
const schema = read("supabase/migrations/20261119061633_stories_studio.sql");
const page = read("src/app/videos/page.tsx");

test("Histórias uses a new isolated component instead of old VideoWorkspace", () => {
  assert.match(page, /StoriesStudio/);
  assert.doesNotMatch(page, /VideoWorkspace|ProductVideoStudio/);
  assert.doesNotMatch(studio, /executors\/google-flow|flow_diagnostics|ProductVideoStudio/);
});
test("Gemini secrets are server only and authenticated requests are mandatory", () => {
  assert.match(edge, /GEMINI_API_KEY/);
  assert.match(edge, /authenticated\(request\)/);
  assert.match(edge, /SUPABASE_URL/);
  assert.doesNotMatch(studio, /GEMINI_API_KEY|GOOGLE_API_KEY|service_role/);
});
test("story script validates exactly twelve ten-second scenes", () => {
  assert.match(edge, /result\.scenes\.length !== 12/);
  assert.match(edge, /durationSeconds: 10/);
  assert.match(studio, /project\.scenes\.length !== 12/);
});
test("isolated prompt agents include 900-character YouTube Create limit", () => {
  const youtube = read("supabase/functions/story-studio/_shared/agents/youtube-create.ts");
  const flow = read("supabase/functions/story-studio/_shared/agents/google-flow.ts");
  const dreamina = read("supabase/functions/story-studio/_shared/agents/dreamina.ts");
  assert.match(youtube, /maximum: 900/);
  assert.match(flow, /maximum:/);
  assert.match(dreamina, /maximum:/);
  assert.match(edge, /prompt_limit_or_sequence_invalid/);
});
test("topics, projects, prompts and clips have owner-scoped RLS", () => {
  for (const table of ["topics", "projects", "prompts", "clips"]) {
    assert.match(schema, new RegExp("mv_story_" + table + " enable row level security"));
    assert.match(schema, new RegExp('mv_story_' + table));
  }
  assert.match(schema, /mv-story-images/);
  assert.match(schema, /mv-story-clips/);
});

test("CORS preflight returns a bodyless HTTP 204 with allowed headers", () => {
  assert.match(edge, /request\.method === "OPTIONS"\) return new Response\(null, \{ status: 204/);
  assert.match(edge, /Access-Control-Allow-Origin/);
  assert.match(edge, /Access-Control-Allow-Headers/);
  assert.match(edge, /Access-Control-Allow-Methods/);
  assert.doesNotMatch(edge, /request\.method === "OPTIONS"\) return json\(\{\}, 204/);
});

test("Gemini provider errors remain safe while reporting the actual HTTP failure class", () => {
  for (const code of ["gemini_quota_exceeded", "gemini_invalid_key", "gemini_permission_denied",
    "gemini_model_unavailable", "gemini_request_rejected", "gemini_service_unavailable", "gemini_billing_required"]) {
    assert.match(edge, new RegExp(code));
  }
  assert.match(edge, /status: response\.status, reason/);
  assert.doesNotMatch(edge, /console\.error\([^\n]*(key|prompt|payload|response\.text\()/);
});

test("Gemini HTTP 402 is diagnosed without implying free quota or changing secrets", () => {
  assert.match(edge, /response\.status === 402 \? "gemini_billing_required"/);
  assert.match(studio, /code === "gemini_billing_required"/);
  assert.match(studio, /HTTP 402: saldo ou configuração de cobrança necessária/);
});

test("Histórias topic generation uses only its dedicated server-side Gemini secret", () => {
  assert.match(edge, /Deno\.env\.get\("HIST_TEMA_GEMINI_API_KEY"\)/);
  assert.match(edge, /purpose === "topics"/);
  assert.match(edge, /}, 6000, "topics"\)/);
  assert.match(edge, /Deno\.env\.get\("HIST_ROTEIRO_GEMINI_API_KEY"\)/);
  assert.doesNotMatch(edge, /Deno\.env\.get\("GEMINI_API_KEY"\)|Deno\.env\.get\("GOOGLE_API_KEY"\)/);
  assert.doesNotMatch(studio, /HIST_TEMA_GEMINI_API_KEY/);
});

test("Scripts and prompts share only dedicated Histórias script secret", () => {
  assert.match(edge, /Deno\.env\.get\("HIST_ROTEIRO_GEMINI_API_KEY"\)/);
  assert.match(edge, /if \(body\.action === "script"\)/);
  assert.match(edge, /if \(body\.action === "prompts"\)/);
  assert.doesNotMatch(studio, /HIST_ROTEIRO_GEMINI_API_KEY/);
});

test("Gemini logs only allowlisted diagnostics, never raw Google error messages", () => {
  assert.match(edge, /function safeGeminiError\(responseBody: unknown\)/);
  assert.match(edge, /googleStatus: status/);
  assert.match(edge, /googleCategory: category/);
  assert.match(edge, /purpose, model: MODEL, \.\.\.diagnostic/);
  assert.doesNotMatch(edge, /console\.error\([^\n]*responseBody/);
  assert.doesNotMatch(edge, /console\.error\([^\n]*message/);
});

test("topic generator defaults to 5 themes, caps at 20 and displays errors next to its controls", () => {
  assert.match(studio, /\[requested, setRequested\] = useState\(5\)/);
  assert.match(studio, /\[5, 10, 15, 20\]/);
  assert.match(studio, /\{error && <p role="alert" className="w-full/);
  assert.match(studio, /\{message && <p role="status" className="w-full/);
  assert.match(studio, /const count = Math\.min\(20, requested - total\)/);
});

test("story topics backend refuses counts above 20", () => {
  assert.match(edge, /count < 1 \|\| count > 20/);
});
