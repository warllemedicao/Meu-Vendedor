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
export type StoryCharacter = { name: string; role: string; visual: string; voice: string; referenceImagePath?: string };
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
    name: "YouTube Create", targetChars: 850, absoluteChars: 900,
    duration: "Até 10 segundos, conforme disponibilidade no aplicativo",
    workflow: "Copie o prompt e use os recursos disponíveis no aplicativo oficial; depois importe o MP4.",
    reminder: "Teto de 900 caracteres adotado no projeto; confirme também o limite exibido na conta.",
  },
  "google-flow": {
    name: "Google Flow", targetChars: 2800, absoluteChars: 4000,
    duration: "Dependente do modelo; nem todo modelo entrega 10 segundos",
    workflow: "Prepare o prompt e referências. Esta interface não envia comandos ao robô Flow existente.",
    reminder: "4.000 caracteres é um teto interno para revisão, não um limite oficial confirmado.",
  },
  dreamina: {
    name: "Dreamina", targetChars: 2800, absoluteChars: 4000,
    duration: "Dependente do modelo e do modo disponível",
    workflow: "Copie o prompt, gere o clipe na ferramenta e importe o MP4 aprovado.",
    reminder: "O teto interno não deve ser confundido com limite oficial da plataforma.",
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
export function makeLocalPromptDrafts(
  platform: StoryPlatform, characters: StoryCharacter[], scenes: StoryScene[],
): { scene: number; text: string; platform: StoryPlatform }[] {
  const guide = PLATFORM_GUIDES[platform];
  return scenes.map(scene => {
    const cast = characters.filter(char => scene.characters.includes(char.name)).map(char =>
      char.name + ": " + char.role + ". Visual fixo: " + char.visual + ". Voz fixa: " + char.voice + ".").join("\n");
    const dialogue = scene.dialogue.map(line => line.speaker + ': "' + line.text + '"').join("\n");
    const parts = [
      "CENA " + scene.number + "/12 — vídeo vertical 9:16. Duração: " + guide.duration + ".",
      "Cenário: " + scene.setting + ".", "Ação: " + scene.action + ".",
      cast ? "Personagens, identidade e função fixas:\n" + cast : "",
      dialogue ? "Falas exatamente em português brasileiro:\n" + dialogue : "Sem fala nesta cena.",
      scene.transition ? "Continuidade para próxima cena: " + scene.transition + "." : "",
      "Manter vestuário, traços, função e voz consistentes com as referências aprovadas.",
    ];
    return { scene: scene.number, platform, text: parts.filter(Boolean).join("\n") };
  });
}
