export type VideoModelId = "omni360" | "omni720" | "veoLite" | "veoFast";
export type StoryKind = "discovery" | "challenge" | "surprise" | "tutorial";

export const flowModels: {
  id: VideoModelId;
  name: string;
  resolution: string;
  creditCosts: Record<number, number>;
}[] = [
  { id: "omni360", name: "Gemini Omni Flash", resolution: "Rascunho 360p", creditCosts: { 4: 4, 6: 5, 8: 6, 10: 7 } },
  { id: "omni720", name: "Gemini Omni Flash", resolution: "Padrão 720p", creditCosts: { 4: 7, 6: 10, 8: 12, 10: 15 } },
  { id: "veoLite", name: "Veo 3.1 Lite", resolution: "Referência de produto · 8s", creditCosts: { 8: 10 } },
  { id: "veoFast", name: "Veo 3.1 Fast", resolution: "Referência de produto · 8s", creditCosts: { 8: 20 } },
];

export function flowCreditCost(model: VideoModelId, durationSeconds: number): number {
  const selectedModel = flowModels.find((option) => option.id === model);
  const cost = selectedModel?.creditCosts[durationSeconds];
  if (cost === undefined) throw new RangeError("Duração não compatível com o modelo selecionado.");
  return cost;
}

export function estimateVideoCount(credits: number, costPerVideo: number): number {
  if (!Number.isSafeInteger(credits) || credits < 0 || !Number.isSafeInteger(costPerVideo) || costPerVideo < 1) {
    throw new RangeError("Saldo e custo precisam ser números inteiros válidos.");
  }
  return Math.floor(credits / costPerVideo);
}

export interface StoryPromptInput {
  characterName: string;
  characterDescription: string;
  productName: string;
  productBenefit: string;
  storyKind: StoryKind;
  action: string;
  mood: string;
  voice: string;
  durationSeconds: number;
}

const storyOpenings: Record<StoryKind, string> = {
  discovery: "O personagem encontra o produto e demonstra curiosidade.",
  challenge: "O personagem encara um pequeno desafio que o produto ajuda a resolver.",
  surprise: "O personagem prepara uma surpresa divertida envolvendo o produto.",
  tutorial: "O personagem apresenta uma demonstração simples e clara do produto.",
};

export function buildStoryScript(input: StoryPromptInput): string {
  const product = input.productName.trim();
  const benefit = input.productBenefit.trim();
  const benefitLine = benefit ? ` Fale somente deste benefício informado: “${benefit}”.` : "";

  return [
    `${storyOpenings[input.storyKind]} ${input.characterName} é ${input.characterDescription}.`,
    `Ação: ${input.action}. Clima: ${input.mood}.`,
    `Fala sugerida em português do Brasil, com voz ${input.voice}: “Olha só o ${product}! ${benefit ? benefit : "Vem conhecer comigo"}.”`,
    `Finalize com uma reação simpática e um convite para conferir o produto, sem afirmar preço, resultado ou característica não fornecida.${benefitLine}`,
  ].join("\n");
}

export function buildFlowPrompt(input: StoryPromptInput): string {
  const benefit = input.productBenefit.trim();
  return [
    `Crie um vídeo vertical 9:16 de ${input.durationSeconds} segundos para redes sociais.`,
    `Use a imagem do produto que vou anexar no Google Flow como referência visual principal. Preserve formato, cores, embalagem, rótulo, logotipo e texto do produto; não invente detalhes nem características.`,
    `Personagem original: ${input.characterName}, ${input.characterDescription}. A personagem é fictícia, simpática e claramente antropomórfica.`,
    `História: ${storyOpenings[input.storyKind]} A personagem ${input.action}, com humor ${input.mood}.`,
    `Fala em português do Brasil, com voz ${input.voice}: ${benefit ? `mencione apenas este benefício confirmado: “${benefit}”.` : "não invente benefícios, preço ou resultados do produto."}`,
    "Use uma cena simples, movimento suave e enquadramento que mantenha o produto visível. Não inclua texto promocional inventado na tela.",
  ].join(" ");
}
