import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = path => readFileSync(new URL("../" + path, import.meta.url), "utf8");
const edge = read("supabase/functions/story-studio/index.ts");
const studio = read("src/components/stories/StoriesStudio.tsx");
const workflow = read("src/lib/stories/workflow.ts");
const schema = read("supabase/migrations/20261119061633_stories_studio.sql");

test("Histórias uses Gemini exclusively for themes, scripts and optional prompts", () => {
  assert.match(edge, /const TOPICS_MODEL = "gemini-3[.]5-flash-lite"/);
  assert.match(edge, /const SCRIPT_MODEL = "gemini-3[.]5-flash-lite"/);
  assert.match(edge, /HIST_TEMA_GEMINI_API_KEY/);
  assert.match(edge, /HIST_ROTEIRO_GEMINI_API_KEY/);
  assert.match(edge, /purpose === "script" \? "HIST_ROTEIRO_GEMINI_API_KEY" : "HIST_TEMA_GEMINI_API_KEY"/);
  assert.doesNotMatch(edge, /openrouter/i);
  assert.doesNotMatch(studio, /openrouter/i);
  assert.doesNotMatch(edge, /Deno[.]env[.]get\("GEMINI_API_KEY"\)|Deno[.]env[.]get\("GOOGLE_API_KEY"\)/);
});

test("authenticated story requests never expose script keys to browser", () => {
  assert.match(edge, /authenticated\(request\)/);
  assert.match(edge, /SUPABASE_URL/);
  assert.match(studio, /fetch\(url \+ "\/functions\/v1\/story-studio"/);
  assert.doesNotMatch(studio, /generativelanguage[.]googleapis[.]com|Deno[.]env[.]get\(/);
});

test("story block requires exactly four scenes in slots one, five or nine", () => {
  assert.match(edge, /body[.]action === "script_block"/);
  assert.match(edge, /\[1,5,9\][.]includes\(startScene\)/);
  assert.match(edge, /result[.]scenes[.]length !== 4/);
  assert.match(edge, /minItems: 4, maxItems: 4/);
  assert.match(edge, /durationSeconds: 10/);
  assert.match(studio, /invokeStory\("script_block"/);
  assert.match(studio, /nextIndex % 4 !== 0/);
  assert.doesNotMatch(studio, /invokeStory\("script",/);
});

test("Gemini structured schema retains speaker, cast, setting and action", () => {
  for (const token of ["characterSchema", "dialogueSchema", "sceneSchema",
    "title", "setting", "action", "characters", "dialogue", "transition"]) assert.ok(edge.includes(token));
  assert.match(edge, /responseMimeType: "application\/json"/);
  assert.match(edge, /thinkingLevel: "LOW"/);
  assert.match(edge, /maxOutputTokens: maxTokens/);
  assert.match(edge, /const SCRIPT_MAX_TOKENS = 4000/);
  assert.doesNotMatch(edge, /additionalProperties/);
});

test("each successful block is saved by owner before generating another", () => {
  assert.match(studio, /async function generateOneBlock/);
  assert.match(studio, /\.update\(\{ characters, scenes, updated_at:/);
  assert.match(studio, /\.eq\("id", working[.]id\)[.]eq\("user_id", user[.]id\)/);
  assert.match(studio, /await generateOneBlock\(current/);
  assert.match(studio, /new Promise\(resolve => setTimeout\(resolve, 16_000\)\)/);
  assert.match(studio, /async function generateRemainingBlocks/);
  assert.match(studio, /stopSceneQueue[.]current/);
});

test("existing project lookup is checked before any new generation", () => {
  assert.match(studio, /\.eq\("user_id", user[.]id\)[.]eq\("topic_id", topic[.]id\)/);
  assert.match(studio, /if \(existing\) \{/);
  assert.match(studio, /await openProject\(existing as Project\)/);
  assert.match(studio, /startingScriptRef[.]current/);
});

test("scripts validate cast and voices against scene references", () => {
  assert.match(edge, /scene[.]characters[.]some\(name => !names[.]has/);
  assert.match(edge, /scene[.]dialogue[.]some\(line =>/);
  assert.match(edge, /const roster = startScene > 1 \? characters : result[.]characters[.]map/);
  assert.match(edge, /scene_dialogue_too_long/);
});

test("topics stay on separate key and are capped at twenty", () => {
  assert.match(edge, /TOPICS_MAX_TOKENS\(count\), "topics"/);
  assert.match(edge, /count < 1 \|\| count > 20/);
  assert.match(studio, /\[5, 10, 15, 20\]/);
});

test("prompts preserve YouTube Create limit and the local no-API option", () => {
  assert.match(workflow, /absoluteChars: 900/);
  assert.match(workflow, /export function makeLocalPromptDrafts/);
  assert.match(studio, /prepareScenePrompt\(s[.]number,false\)/);
  assert.match(studio, /countStoryPromptCharacters\(draft\) > limit/);
  assert.match(studio, /saveScenePrompt/);
});

test("error logging keeps secrets, user prompts and raw provider failures private", () => {
  assert.match(edge, /story_studio_gemini_usage/);
  assert.match(edge, /usage[.]thoughtsTokenCount/);
  assert.match(edge, /function safeGeminiError/);
  assert.match(edge, /gemini_output_truncated/);
  assert.match(edge, /gemini_quota_exceeded/);
  assert.doesNotMatch(edge, /generateContent\?key=/);
  assert.doesNotMatch(edge, /console[.]error\([^\n]*responseBody/);
});

test("CORS and story storage remain restricted", () => {
  assert.match(edge, /Access-Control-Allow-Origin/);
  assert.match(edge, /request[.]method === "OPTIONS"\) return new Response\(null, \{ status: 204/);
  assert.match(schema, /mv_story_projects enable row level security/);
  assert.match(schema, /mv-story-images/);
  assert.match(schema, /mv-story-clips/);
});

test("image generation uses its dedicated key only", () => {
  const imageBlock = edge.split("async function generateCharacterImage(prompt: string)")[1]
    ?.split("function normalizeScene(")[0] || "";
  assert.match(imageBlock, /HIST_IMAGEM_GEMINI_API_KEY/);
  assert.doesNotMatch(imageBlock, /HIST_TEMA_GEMINI_API_KEY|HIST_ROTEIRO_GEMINI_API_KEY/);
});
