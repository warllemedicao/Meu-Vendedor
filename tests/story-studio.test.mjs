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
  // The UI may mention the optional secret NAME in setup instructions, but must never read it.
  assert.ok(!studio.includes("Deno.env.get("), "Frontend must not load server-side secrets");
  assert.ok(!/process[.]env[.](?:HIST_|GEMINI_|GOOGLE_|SUPABASE_SERVICE_ROLE)/.test(studio), "Frontend must not read private environment variables");
  assert.ok(!studio.includes("generativelanguage.googleapis.com"), "Frontend must not contact Gemini directly");
  assert.ok(studio.includes('fetch(url + "/functions/v1/story-studio"'), "Frontend must use authenticated Supabase function");
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
  assert.match(edge, /TOPICS_MAX_TOKENS\(count\), "topics"\)/);
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
  assert.ok(edge.includes('console.error("story_studio_gemini_http_error", { status: response.status, reason, purpose, model, elapsedMs: Date.now() - started, ...diagnostic }'), "Gemini provider errors must use allowlisted diagnostic fields");
  assert.match(edge, /function safeGeminiError/);
  assert.doesNotMatch(edge, /console\.error\([^\n]*responseBody/);
  assert.doesNotMatch(edge, /console\.error\([^\n]*message/);
});

test("topic generator defaults to 5 themes, caps at 20 and displays errors next to its controls", () => {
  assert.match(studio, /\[requested, setRequested\] = useState\(5\)/);
  assert.match(studio, /\[5, 10, 15, 20\]/);
  assert.match(studio, /\{error && <p role="alert" className="w-full/);
  assert.match(studio, /\{message && <p role="status" className="w-full/);
  assert.match(studio, /count: requested/);
  assert.doesNotMatch(studio, /while \(total < requested/);
});

test("story topics backend refuses counts above 20", () => {
  assert.match(edge, /count < 1 \|\| count > 20/);
});

test("Gemini transport errors are classified without logging sensitive details", () => {
  assert.match(edge, /controller\.signal\.aborted/);
  assert.match(edge, /reason: "gemini_timeout"/);
  assert.match(edge, /reason: "gemini_network_error"/);
  assert.match(edge, /"gemini_timeout","gemini_network_error"/);
  assert.match(studio, /code === "gemini_timeout"/);
  assert.match(studio, /code === "gemini_network_error"/);
  assert.doesNotMatch(edge, /console\.error\([^\n]*\berror\b/);
});

test("Gemini metadata diagnostic never generates content or exposes credentials", () => {
  const check = edge.split('async function diagnoseModelConnection(purpose: "topics" | "script") {')[1]?.split("async function gemini(")[0] || "";
  assert.match(check, /HIST_TEMA_GEMINI_API_KEY/);
  assert.match(check, /method: "GET"/);
  assert.match(check, /"x-goog-api-key": key/);
  assert.doesNotMatch(check, /:generateContent|\?key=/);
  assert.match(edge, /body\.action === "diagnose_topics"/);
  assert.match(studio, /Verificar Gemini sem gerar temas/);
  assert.match(studio, /purpose === "topics" \? "diagnose_topics" : "diagnose_script"/);
  assert.match(edge, /body\.action === "diagnose_script"/);
  assert.match(check, /HIST_ROTEIRO_GEMINI_API_KEY/);
  assert.match(studio, /Verificar API de roteiros sem gerar/);
});


test("Histórias uses Gemini 3.5 Flash-Lite for topics and 3.5 Flash for scripts/prompts", () => {
  assert.match(edge, /const TOPICS_MODEL = "gemini-3[.]5-flash-lite"/);
  assert.match(edge, /const SCRIPT_MODEL = "gemini-3[.]5-flash"/);
  assert.match(edge, /purpose === "topics" [?] TOPICS_MODEL : SCRIPT_MODEL/);
  // Model names are selected by purpose before construction of the shared endpoint.
  assert.ok(edge.includes('const model = purpose === "topics" ? TOPICS_MODEL : SCRIPT_MODEL'), "Model routing must use the requested purpose");
  assert.match(edge, /encodeURIComponent[(]model[)]/);
  assert.doesNotMatch(edge, /gemini-3[.]8-flash|MV_STORIES_GEMINI_MODEL/);
});

test("bounded model budgets maintain 12 scenes and log only token counts", () => {
  assert.match(edge, /const SCRIPT_MAX_TOKENS = 7200/);
  assert.match(edge, /const PROMPTS_MAX_TOKENS = 8500/);
  assert.match(edge, /TOPICS_MAX_TOKENS\(count\)/);
  assert.match(edge, /maxOutputTokens: maxTokens/);
  assert.match(edge, /story_studio_gemini_usage/);
  assert.match(edge, /usage\.thoughtsTokenCount/);
  assert.doesNotMatch(edge, /generateContent\?key=/);
  assert.match(studio, /One click = one Gemini request/);
  assert.match(studio, /gemini_service_unavailable/);
});


test("prompt character ceilings are consistent across frontend and agents", () => {
  const workflow = read("src/lib/stories/workflow.ts");
  const flow = read("supabase/functions/story-studio/_shared/agents/google-flow.ts");
  const dreamina = read("supabase/functions/story-studio/_shared/agents/dreamina.ts");
  assert.match(studio, /label: "Google Flow", maximum: 1600/);
  assert.match(studio, /label: "Dreamina", maximum: 1200/);
  assert.match(workflow, /"Google Flow", targetChars: 900, absoluteChars: 1600/);
  assert.match(workflow, /"Dreamina", targetChars: 650, absoluteChars: 1200/);
  assert.match(flow, /target: 900/);
  assert.match(flow, /maximum: 1600/);
  assert.match(dreamina, /target: 650/);
  assert.match(dreamina, /maximum: 1200/);
});


test("timeouts and truncated responses retain distinct diagnostic errors", () => {
  assert.match(edge, /first[.]finishReason === "MAX_TOKENS"/);
  assert.match(edge, /"gemini_output_truncated"/);
  assert.match(studio, /code === "gemini_output_truncated"/);
  assert.match(edge, /code === "gemini_service_unavailable" [|][|] code === "gemini_timeout" [ ?] 503/);
});


test("transient provider errors pause only the affected generation model", () => {
  assert.match(studio, /const geminiCooldowns = new Map/);
  assert.match(studio, /action === "topics"/);
  assert.match(studio, /action === "script" [|][|] action === "prompts"/);
  assert.match(studio, /code === "gemini_service_unavailable" [|][|] code === "gemini_timeout"/);
  assert.match(studio, /geminiCooldowns[.]set[(]scope/);
  assert.match(studio, /geminiCooldowns[.]delete[(]scope[)]/);
  assert.match(studio, /a tentativa não foi enviada/);
});


test("one scene per script inference with owner-scoped persistence and manual resume", () => {
  assert.match(edge, /body\.action === "script_scene"/);
  assert.match(edge, /previous\.length !== sceneNumber - 1/);
  assert.match(edge, /first \? 2600 : 1800/);
  assert.match(edge, /return json\(\{ characters: cast, scene \}, 200, origin\)/);
  assert.match(studio, /invokeStory\("script_scene"/);
  assert.match(studio, /async function generateOneScene/);
  assert.match(studio, /await generateOneScene\(working\)/);
  assert.match(studio, /\.update\(\{ characters, scenes, updated_at:/);
  assert.match(studio, /\.eq\("id", working\.id\)\.eq\("user_id", user\.id\)/);
  assert.match(studio, /Gerar todas as pendentes em sequência/);
  assert.match(studio, /16_000/);
  assert.match(studio, /stopSceneQueue\.current/);
  assert.doesNotMatch(studio, /invokeStory\("script", \{ title: topic\.title/);
});

test("one platform prompt per inference, without overwriting approved prompts", () => {
  assert.match(edge, /body\.action === "prompt_scene"/);
  assert.match(edge, /Gere somente o prompt desta cena/);
  assert.match(studio, /invokeStory\("prompt_scene"/);
  assert.match(studio, /\.select\("scene_number"\)\.eq\("project_id", project\.id\)/);
  assert.match(studio, /\.upsert\(\{\s*user_id: user\.id, project_id: project\.id, scene_number: scene\.number/);
  assert.match(studio, /Gerar próximo prompt com Gemini/);
  assert.doesNotMatch(studio, /invokeStory\("prompts", \{ platform, script:/);
});

test("dedicated optional Nano Banana model cannot borrow topic or script secrets", () => {
  const imageBlock = edge.split("async function generateCharacterImage(prompt: string)")[1]
    ?.split("function normalizeScene(")[0] || "";
  assert.match(edge, /const IMAGE_MODEL = "gemini-3\.1-flash-lite-image"/);
  assert.match(imageBlock, /Deno\.env\.get\("HIST_IMAGEM_GEMINI_API_KEY"\)/);
  assert.doesNotMatch(imageBlock, /HIST_TEMA_GEMINI_API_KEY|HIST_ROTEIRO_GEMINI_API_KEY/);
  assert.match(imageBlock, /responseModalities: \["TEXT", "IMAGE"\]/);
  assert.match(edge, /body\.action === "image_config"/);
  assert.match(edge, /body\.action === "image_character"/);
  assert.match(edge, /image_api_not_configured/);
  assert.match(edge, /authenticated\(request\)/);
});

test("prompt scene receives reference-presence metadata, not private image paths", () => {
  assert.match(edge, /referenceImageAttached: Boolean\(item\.referenceImagePath\)/);
  assert.match(edge, /imageReferencePrompt: clean\(item\.referenceImagePrompt, 1200\)/);
  assert.match(edge, /Nunca exponha endereços privados do Supabase/);
  const schema = read("supabase/migrations/20261119183537_story_character_library.sql");
  assert.match(schema, /mv_story_characters enable row level security/);
  assert.match(schema, /user_id = \(select auth\.uid\(\)\)/);
  assert.match(schema, /split_part\(storage_path, '\/', 1\)/);
});

test("optional Flash-Lite scene route uses the script key and does not borrow topic secret", () => {
  const geminiClient = edge.split("async function gemini(")[1]?.split("async function generateCharacterImage(")[0] || "";
  assert.match(geminiClient, /scriptModel: "primary" \| "flash-lite" = "primary"/);
  assert.match(geminiClient, /purpose === "script" && scriptModel === "flash-lite"/);
  assert.match(geminiClient, /Deno\.env\.get\("HIST_ROTEIRO_GEMINI_API_KEY"\)/);
  assert.match(edge, /body\.scriptModel === "flash-lite" \? "flash-lite" : "primary"/);
  assert.match(studio, /generateOneScene\(project, undefined, "flash-lite"\)/);
  assert.match(studio, /Tentar cena pendente com Flash-Lite/);
  assert.doesNotMatch(studio, /HIST_TEMA_GEMINI_API_KEY/);
});
