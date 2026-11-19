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
export type StoryPlatform = "youtube-create" | "google-flow" | "dreamina";
export type StoryCharacter = { name: string; role: string; visual: string; voice: string; referenceImagePath?: string; referenceImagePrompt?: string };
export type StoryDialogue = { speaker: string; text: string };
export type StoryScene = {
  number: number; durationSeconds: 10; title: string; setting: string;
  action: string; characters: string[]; dialogue: StoryDialogue[]; transition: string;
};
export const PLATFORM_GUIDES: Record<StoryPlatform, {
  name: string; targetChars: number; absoluteChars: number; duration: string;
  workflow: string; reminder: string;
}> = {
  "youtube-create": {
    name: "YouTube Create", targetChars: 780, absoluteChars: 900,
    duration: "Até 10 segundos, conforme disponibilidade no aplicativo",
    workflow: "Copie o prompt e use os recursos disponíveis no aplicativo oficial; depois importe o MP4.",
    reminder: "Teto de 900 caracteres adotado no projeto; confirme também o limite exibido na conta.",
  },
  "google-flow": {
    name: "Google Flow", targetChars: 900, absoluteChars: 1600,
    duration: "Omni Flash 1.2: até 10s em modos compatíveis; Veo 3.1 Lite: 4, 6 ou 8s",
    workflow: "Prepare o prompt e referências. Esta interface não envia comandos ao robô Flow existente.",
    reminder: "Teto editorial interno de 1.600 caracteres; o modo e a duração reais dependem do modelo ativo.",
  },
  dreamina: {
    name: "Dreamina", targetChars: 650, absoluteChars: 1200,
    duration: "Dependente do modelo e do modo disponível",
    workflow: "Copie o prompt, gere o clipe na ferramenta e importe o MP4 aprovado.",
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
/** A fallback for editorial preview only: prompts are manually reviewable, not Gemini output. */
/** Compact platform prompts without silently truncating dialogue, action or character identity. */
export function makeLocalPromptDrafts(
  platform: StoryPlatform, characters: StoryCharacter[], scenes: StoryScene[],
): { scene: number; text: string; platform: StoryPlatform }[] {
  const guide = PLATFORM_GUIDES[platform];
  return scenes.map(scene => {
    const cast = characters.filter(char => scene.characters.includes(char.name));
    const dialogue = scene.dialogue.map(line => line.speaker + ': "' + line.text + '"').join("\n");
    const attached = cast.some(char => char.referenceImagePath);
    const base = [
      "CENA " + scene.number + "/12 • vídeo 9:16 • 10s.",
      "Cenário: " + scene.setting.trim(),
      "Ação: " + scene.action.trim(),
    ];
    const ending = [
      dialogue ? "Falas em português brasileiro, exatas:\n" + dialogue : "Sem fala.",
      attached ? "Usar imagens anexadas como referência fiel dos personagens." : "",
    ].filter(Boolean);
    const castVariants = [
      cast.map(ch => ch.name + " (" + ch.role + "): " + ch.visual + ". Voz: " + ch.voice).join("\n"),
      cast.map(ch => ch.name + ": " + ch.visual + ". Voz: " + ch.voice).join("\n"),
      cast.map(ch => ch.name + ": " + ch.visual).join("\n"),
    ];
    // Prefer the most complete reference that fits, without clipping essential scene or spoken text.
    const candidates = castVariants.map(castText =>
      [...base, castText ? "Personagens fixos:\n" + castText : "", ...ending]
        .filter(Boolean).join("\n"));
    const result = candidates.find(text => Array.from(text).length <= guide.absoluteChars);
    if (!result) throw new Error(
      "O conteúdo essencial da cena " + scene.number + " excede " + guide.absoluteChars +
      " caracteres em " + guide.name + ". Revise a descrição dos personagens ou gere um prompt curto com Gemini. As falas não foram cortadas.");
    return { scene: scene.number, platform, text: result };
  });
}
