/** Local editorial helpers. These functions never call a video provider or generate media. */
export const STORY_STAGES = [
  { key: "temas", title: "Temas", description: "Escolha uma ideia" },
  { key: "roteiro", title: "Roteiro", description: "12 cenas e personagens" },
  { key: "gerador", title: "Ferramenta", description: "Selecione onde criar" },
  { key: "prompts", title: "Prompts", description: "Revise os comandos" },
  { key: "cenas", title: "Cenas", description: "Importe e aprove MP4" },
  { key: "montagem", title: "Montagem", description: "Confira a sequência" },
  { key: "publicacao", title: "Publicação", description: "Prepare os canais" },
] as const;
export type StoryStage = (typeof STORY_STAGES)[number]["key"];
export type StoryCharacterStyle = "nao_definido" | "frutinhas" | "infantil" | "pessoas_cabeca_fruta";
export const STORY_CHARACTER_STYLES: { value: Exclude<StoryCharacterStyle, "nao_definido">; label: string; description: string }[] = [
  { value: "frutinhas", label: "Frutinhas", description: "Frutas falantes com corpo de fruta, braços e pernas, animação 3D." },
  { value: "infantil", label: "Infantil", description: "Personagens originais fofinhos, coloridos e expressivos para histórias infantis." },
  { value: "pessoas_cabeca_fruta", label: "Pessoas com cabeça de fruta", description: "Corpo humano estilizado, roupas e cabeça em forma de fruta." },
];
export const STORY_CHARACTER_STYLE_INSTRUCTIONS: Record<StoryCharacterStyle, string> = {
  nao_definido: "",
  frutinhas: "Estilo visual: personagens são frutas antropomórficas completas, corpo da fruta com braços e pernas, expressões e roupas; sem corpo humano realista.",
  infantil: "Estilo visual: personagens infantis originais, fofinhos, arredondados, coloridos e expressivos; conteúdo adequado a crianças, sem elementos assustadores.",
  pessoas_cabeca_fruta: "Estilo visual: personagens com corpo humano estilizado, roupas e acessórios, mas com cabeça em forma de fruta expressiva; preservar sempre esta anatomia.",
};
export type StoryPlatform = "youtube-create" | "google-flow" | "dreamina";
export type StoryCharacter = { name: string; role: string; visual: string; voice: string; referenceImagePath?: string; referenceImagePrompt?: string };
export type StoryDialogue = { speaker: string; text: string };
/** Parse a free-form multiline dialogue without rewriting the textarea during typing.
 * Incomplete lines are preserved in the editor and must be corrected before saving. */
export function parseStoryDialogueDraft(raw: string): { dialogue: StoryDialogue[]; invalidLines: number[] } {
  const dialogue: StoryDialogue[] = [];
  const invalidLines: number[] = [];
  raw.split("\n").forEach((line, index) => {
    if (!line.trim()) return;
    const colon = line.indexOf(":");
    const speaker = colon >= 0 ? line.slice(0, colon).trim() : "";
    const text = colon >= 0 ? line.slice(colon + 1).trim() : "";
    if (!speaker || !text) { invalidLines.push(index + 1); return; }
    dialogue.push({ speaker, text });
  });
  return { dialogue, invalidLines };
}

export type StoryScene = {
  number: number; durationSeconds: 10; title: string; setting: string;
  action: string; characters: string[]; dialogue: StoryDialogue[]; transition: string;
};
export const PLATFORM_GUIDES: Record<StoryPlatform, {
  name: string; targetChars: number; absoluteChars: number; duration: string;
  workflow: string; reminder: string;
}> = {
  "youtube-create": {
    name: "YouTube Create", targetChars: 850, absoluteChars: 900,
    duration: "Até 10 segundos, conforme disponibilidade no aplicativo",
    workflow: "Gere uma microação por clipe. Configure proporção e iluminação no YouTube Create e anexe referências manualmente.",
    reminder: "900 caracteres confirmados pelo YouTube; contamos unidades UTF-16 sem presumir normalização. Vídeos aceitam vários idiomas; imagens Nano Banana exigem inglês ou hindi.",
  },
  "google-flow": {
    name: "Google Flow", targetChars: 300, absoluteChars: 1600,
    duration: "Omni Flash 1.2: até 10s em modos compatíveis; Veo 3.1 Lite: 4, 6 ou 8s",
    workflow: "Use instruções de identidade no Agente; prompt de cena curto, elementos @ cadastrados e frames configurados no Flow.",
    reminder: "Meta editorial de 30 palavras para cenas simples, não limite oficial. Falas exatas podem exigir mais; 1.600 caracteres é teto interno.",
  },
  dreamina: {
    name: "Dreamina", targetChars: 650, absoluteChars: 1200,
    duration: "Dependente do modelo e do modo disponível",
    workflow: "Revise os sete campos estruturados e associe as referências @Imagem N aos arquivos carregados na Dreamina.",
    reminder: "Teto editorial interno de 1.200 caracteres; prefira 30–100 palavras quando usar Seedance 2.0.",
  },
};
export function makeEmptyStoryScenes(): StoryScene[] {
  return Array.from({ length: 12 }, (_, i) => ({
    number: i + 1, durationSeconds: 10,
    title: "Cena " + String(i + 1).padStart(2, "0"),
    setting: "", action: "", characters: ["Personagem 1"], dialogue: [], transition: "",
  }));
}
export function countStoryWords(scene: StoryScene): number {
  return scene.dialogue.reduce((total, line) =>
    total + line.text.trim().split(/\s+/).filter(Boolean).length, 0);
}
/** Browser-only editorial prompts. No automatic translation, model calls, or invented asset IDs. */
export type LocalStoryPrompt = { scene: number; text: string; platform: StoryPlatform; notice?: string };

/** Counts the submitted UTF-16 input conservatively; no invisible whitespace normalization. */
export function countStoryPromptCharacters(text: string): number {
  return text.length;
}
function cleanStoryText(value: string): string {
  return value.trim().replace(/\s+/g, " ");
}
function storyWords(value: string): number {
  return cleanStoryText(value).split(/\s+/).filter(Boolean).length;
}
function storyAssetName(value: string): string {
  return value.normalize("NFKD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-zA-Z0-9_]+/g, "_").replace(/^_+|_+$/g, "").slice(0, 48) || "Personagem";
}
function pickStoryCandidate(platform: StoryPlatform, scene: StoryScene, texts: string[]): string {
  const cap = PLATFORM_GUIDES[platform].absoluteChars;
  const result = texts.find(text => countStoryPromptCharacters(text) <= cap);
  if (!result) throw new Error("O conteúdo essencial da cena " + scene.number +
    " excede " + cap + " caracteres em " + PLATFORM_GUIDES[platform].name +
    ". Divida a ação ou reduza as falas no roteiro; o gerador não apaga texto silenciosamente.");
  return result;
}

/** Global visual identity belongs in the Flow Agent/project configuration, not repeated scene by scene. */
export function makeStoryFlowAgentInstructions(
  characters: StoryCharacter[], style: StoryCharacterStyle = "nao_definido",
): string {
  return [
    STORY_CHARACTER_STYLE_INSTRUCTIONS[style],
    ...characters.map(char => char.name + ": " + char.visual + (char.voice ? ". Voz: " + char.voice : "")),
    "Manter roupas, vozes, identidade e continuidade entre cenas; não criar cortes nem sujeitos extras.",
  ].filter(Boolean).join("\n");
}

/** One scene => one prompt. Essential dialogue remains verbatim. */
export function makeLocalPromptDrafts(
  platform: StoryPlatform, characters: StoryCharacter[], scenes: StoryScene[],
  characterStyle: StoryCharacterStyle = "nao_definido",
): LocalStoryPrompt[] {
  return scenes.map(scene => {
    const cast = characters.filter(ch => scene.characters.includes(ch.name));
    const setting = cleanStoryText(scene.setting);
    const action = cleanStoryText(scene.action);
    const speech = scene.dialogue.map(line => line.speaker + ': "' + line.text + '"').join("\n");
    const style = STORY_CHARACTER_STYLE_INSTRUCTIONS[characterStyle];
    if (!setting || !action) throw new Error("A cena " + scene.number + " precisa de ambiente e ação.");

    let text = "";
    let notice: string | undefined;
    if (platform === "youtube-create") {
      // A single short action per generated clip, never silently mix successive scripted actions.
      const segments = action.split(/(?<=[.!?;])\s+|,\s*(?:enquanto|quando)\s+|\s+(?:depois|em seguida|na sequência|logo após)\s+/i).filter(Boolean);
      const oneAction = segments[0]?.trim() || action;
      if (segments.length > 1) notice = "YouTube Create: usada só a primeira microação. As demais ações do roteiro não foram alteradas; gere-as em outros clipes.";
      const subject = cast.map(ch => ch.name).join(", ") || "Scene subject";
      const dialogue = speech ? "Speech in Brazilian Portuguese, exact lines:\n" + speech : "";
      const variants = [
        cast.map(ch => ch.name + ": " + cleanStoryText(ch.visual)).join("; "),
        cast.map(ch => ch.name + ": " + cleanStoryText(ch.role)).join("; "),
        subject,
      ];
      const candidates = variants.map(identity => [
        "Subject: " + identity,
        "Single action: " + oneAction,
        "Environment: " + setting,
        "Camera: steady medium shot, one continuous take.",
        dialogue,
      ].filter(Boolean).join("\n"));
      text = pickStoryCandidate(platform, scene, candidates);
      if (countStoryPromptCharacters(text) > 850) {
        notice = [notice, "O texto está próximo do limite de 900 caracteres; revise antes de colar no aplicativo."].filter(Boolean).join(" ");
      }
    } else if (platform === "google-flow") {
      const mentions = cast.map(ch => "@" + storyAssetName(ch.name)).join(" ");
      const subject = mentions || cast.map(ch => ch.name).join(", ");
      const dialogue = speech ? "Speech (pt-BR):\n" + speech : "";
      const variants = [
        [subject, action, "Environment: " + setting, "Camera: steady medium shot.", dialogue].filter(Boolean).join("\n"),
        [subject, action, "Camera: steady medium shot.", dialogue].filter(Boolean).join("\n"),
      ];
      text = pickStoryCandidate(platform, scene, variants);
      notice = "No Flow, crie os personagens como Elementos/Ingredientes com os mesmos nomes das menções @. As menções não vinculam imagens automaticamente.";
      if (storyWords(text) > 30) notice += " O prompt excede a meta editorial de 30 palavras porque mantém a ação e as falas; revise se desejar encurtar.";
    } else {
      const bindings = cast.map((ch,i) => {
        const label = "Sujeito " + (i + 1);
        const visual = cleanStoryText(ch.visual);
        return label + ": " + ch.name + (ch.referenceImagePath ? " (@Imagem " + (i + 1) + ")" : "") +
          (visual ? ", " + visual : "");
      });
      const subjectLabels = cast.map((_,i) => "Sujeito " + (i + 1)).join(" e ") || "Sujeito principal";
      const labeledAction = cast.reduce((value, ch, i) => value.replaceAll(ch.name, "Sujeito " + (i + 1)), action);
      const speechPart = speech ? "Falas exatas em pt-BR:\n" + speech : "";
      const variants = [
        bindings.join("\n"),
        cast.map((ch,i) => "Sujeito " + (i + 1) + ": " + ch.name +
          (ch.referenceImagePath ? " (@Imagem " + (i + 1) + ")" : "")).join("\n"),
      ];
      text = pickStoryCandidate(platform, scene, variants.map(binding => [
        "Sujeito preciso: " + (binding || subjectLabels),
        "Ação: " + labeledAction,
        "Ambiente: " + setting,
        "Iluminação e cor: manter a referência visual.",
        "Câmera: plano médio estável.",
        "Estilo visual: " + (style || "manter a identidade da imagem."),
        "Qualidade/restrições: sem sujeitos ou cortes extras.",
        speechPart,
      ].filter(Boolean).join("\n")));
      notice = "Dreamina: confira se @Imagem 1, @Imagem 2 etc. correspondem às imagens realmente anexadas. Os rótulos não carregam arquivos automaticamente.";
    }
    return { scene: scene.number, platform, text, ...(notice ? { notice } : {}) };
  });
}
