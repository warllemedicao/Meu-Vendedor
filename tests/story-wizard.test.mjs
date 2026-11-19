import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const studio = readFileSync(new URL("../src/components/stories/StoriesStudio.tsx", import.meta.url), "utf8");
const workflow = readFileSync(new URL("../src/lib/stories/workflow.ts", import.meta.url), "utf8");

test("wizard navigation presents all seven stages with controlled selection", () => {
  for (const stage of ["temas", "roteiro", "gerador", "prompts", "cenas", "montagem", "publicacao"]) {
    assert.match(workflow, new RegExp('key: "' + stage + '"'));
  }
  assert.match(studio, /aria-label="Etapas do gerador de histórias"/);
  assert.match(studio, /setStage\(item\.key\)/);
  assert.match(studio, /Etapa anterior/);
  assert.match(studio, /Próxima etapa/);
});

test("manual storyline enables editorial review without impersonating Gemini", () => {
  assert.match(studio, /async function createManualScript/);
  assert.match(studio, /makeEmptyStoryScenes\(\)/);
  assert.match(studio, /Roteiro manual/);
  assert.match(studio, /Crie um roteiro manual real/);
  assert.match(workflow, /Array\.from\(\{ length: 12 \}/);
});

test("generator selection displays per-provider prompt agents", () => {
  assert.match(studio, /aria-pressed=\{platform === option.value\}/);
  assert.match(studio, /PLATFORM_GUIDES\[platform\]/);
  assert.match(workflow, /youtube-create/);
  assert.match(workflow, /google-flow/);
  assert.match(workflow, /dreamina/);
  assert.match(workflow, /absoluteChars: 900/);
  assert.match(studio, /Montar rascunhos locais sem IA/);
});

test("montage planning is explicit, not a fake generated video", () => {
  assert.match(studio, /Montagem — linha do tempo de 2 minutos/);
  assert.match(studio, /Baixar plano de produção/);
  assert.match(studio, /URL\.createObjectURL/);
  assert.match(studio, /Nenhum vídeo gerado|nenhum vídeo gerado/);
  assert.match(studio, /renderizador MP4 final será conectado posteriormente/);
});

test("no imported Google Flow executor or video rendering calls", () => {
  assert.doesNotMatch(studio, /executors\/google-flow|modal_app|flow_diagnostics/);
  assert.doesNotMatch(workflow, /fetch\(|Deno\.serve|FFmpeg|MediaRecorder/);
});
