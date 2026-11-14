export type CampaignGenerator = "youtube-create" | "google-flow" | "dreamina";
export type CampaignPresentation = "presenter" | "voiceover";
export interface GeneratorBrief {
  title: string;
  details: string;
  scene: string;
  speech: string;
  durationSeconds: number;
  presentation: CampaignPresentation;
  presenterName?: string;
  presenterIdentity?: string;
  presenterVoice?: string;
  masterPrompt: string;
  continuityBible?: string;
  sceneActions?: string[];
}
export const GENERATOR_LINKS: Record<CampaignGenerator, string> = {
  "youtube-create": "https://support.google.com/youtube/answer/13521789?hl=pt-BR",
  "google-flow": "https://labs.google/fx/tools/flow",
  dreamina: "https://dreamina.capcut.com/pt-br/",
};
export const YOUTUBE_PROMPT_LIMIT = 900;
export const DREAMINA_PROMPT_LIMIT = 4000;
const normalize = (value: string) => value.replace(/\s+/g, " ").trim();
const sentence = (value: string, limit: number) => {
  const clean = normalize(value);
  if (clean.length <= limit) return clean;
  const end = clean.slice(0, limit + 1).lastIndexOf(" ");
  return clean.slice(0, end > limit / 2 ? end : limit).trim();
};
export function splitCampaignSpeech(speech: string, durationSeconds: number, clipSeconds = 8): string[] {
  const words = normalize(speech).split(" ").filter(Boolean);
  const clips = Math.max(1, Math.ceil(durationSeconds / clipSeconds), Math.ceil(words.length / 16));
  if (!words.length) return [""];
  const segments: string[] = [];
  for (let i = 0; i < clips; i++) {
    const start = Math.floor(i * words.length / clips);
    const end = Math.floor((i + 1) * words.length / clips);
    segments.push(words.slice(start, end).join(" "));
  }
  return segments;
}
export function buildGeneratorPrompts(generator: CampaignGenerator, brief: GeneratorBrief): string[] {
  if (!Number.isInteger(brief.durationSeconds) || brief.durationSeconds < 1 || brief.durationSeconds > 10) throw new Error("Anúncios devem ter duração de 1 a 10 segundos.");
  if (normalize(brief.speech).split(" ").filter(Boolean).length > Math.max(1, Math.floor(brief.durationSeconds * 2.5))) throw new Error("A fala está longa para um único vídeo curto. Resuma o roteiro antes de gerar o anúncio.");
  const parts = [normalize(brief.speech)];
  return parts.map((speech, index) => {
    const seconds = brief.durationSeconds;
    const role = brief.presentation === "presenter"
      ? `Imagem 1: personagem ${brief.presenterName || "fixo"}; imagem 2: produto. Preserve rosto, roupas e identidade do personagem, cores e formato do produto. Personagem mostra o produto e fala em português brasileiro.`
      : "Imagem 1: produto. Exiba o produto com narração externa em português brasileiro, sem personagem falando.";
    if (generator === "youtube-create") {
      // Reserve space for the exact spoken line before fitting optional directions.
      const identity = brief.presentation === "presenter" ? ` Identidade fixa: ${sentence(brief.presenterIdentity || "", 180)}. Voz: ${sentence(brief.presenterVoice || "", 55)}.` : "";
      const lead = `Vídeo vertical 9:16, ${seconds}s, cena ${index + 1}/${parts.length}. ${role}${identity} Produto: ${sentence(brief.title, 90)}. `;
      const spoken = `Fala exata: "${speech}".`;
      if ((lead + spoken).length > YOUTUBE_PROMPT_LIMIT) {
        throw new Error("A fala desta cena ultrapassa 900 caracteres. Reduza a fala para manter o anúncio em um único vídeo.");
      }
      const room = YOUTUBE_PROMPT_LIMIT - lead.length - spoken.length;
      const extras = ` Cenário: ${normalize(brief.scene)}. Detalhes confirmados: ${normalize(brief.details) || "somente os visíveis"}. Luz natural, câmera suave, áudio limpo, sem inventar benefícios ou alterar o produto.`;
      const optional = room > 0 ? sentence(extras, room) : "";
      return lead + optional + spoken;
    }
    const character = brief.presentation === "presenter"
      ? `Use a referência visual do personagem ${brief.presenterName || "selecionado"} e a foto do produto separadamente. Preserve identidade: ${brief.presenterIdentity || "imagem de referência"}. Voz: ${brief.presenterVoice || "natural"}.`
      : "Use a foto do produto como referência. Exiba somente o produto, com narração externa e sem sincronização labial.";
    const direction = generator === "google-flow"
      ? "Direção cinematográfica: câmera fluida, gestos naturais, iluminação coerente, continuidade entre cenas."
      : "Movimento natural e consistente, foco no produto, enquadramento comercial, sem deformar objetos.";
    const fullPrompt = `Vídeo vertical 9:16, ${seconds} segundos. Cena ${index + 1} de ${parts.length}. ${character}\nProduto: ${brief.title}. Detalhes confirmados: ${brief.details || "apenas detalhes visíveis na imagem"}.\nAmbiente: ${brief.scene}. ${direction}\nFala EXATA em português brasileiro: "${speech}".\nNão inventar características, preços, descontos ou resultados. Manter produto e personagem consistentes. Não alterar a fala nem inserir outras falas.\nBÍBLIA DE CONTINUIDADE E ROTEIRO MESTRE (REPETIR EM TODAS AS CENAS):\n${brief.continuityBible?.trim() || brief.masterPrompt}\nAÇÃO EXCLUSIVA DESTA CENA: ${brief.sceneActions?.[index]?.trim() || "Apresentar o produto de forma natural, preservando as referências visuais."}\nREGRA DE PRIORIDADE: a bíblia acima define identidade, voz, roupa, cenário, estilo e continuidade; NÃO execute falas, gestos ou eventos de outras cenas que estejam descritos nela. A única fala autorizada nesta geração é: "${speech}". Não alterar o produto nem a aparência do personagem.`;
    if (generator !== "dreamina" || fullPrompt.length <= DREAMINA_PROMPT_LIMIT) return fullPrompt;
    // Preserve the exact spoken line, product instructions and fixed character identity.
    // Reduce only the redundant master/continuity section to fit Dreamina.
    const marker = "BÍBLIA DE CONTINUIDADE E ROTEIRO MESTRE (REPETIR EM TODAS AS CENAS):\\n";
    const actionMarker = "\\nAÇÃO EXCLUSIVA DESTA CENA:";
    const start = fullPrompt.indexOf(marker);
    const end = fullPrompt.indexOf(actionMarker, start + marker.length);
    if (start < 0 || end < 0) throw new Error("Não foi possível adaptar o roteiro para o Dreamina.");
    const prefix = fullPrompt.slice(0, start + marker.length);
    const suffix = fullPrompt.slice(end);
    const budget = DREAMINA_PROMPT_LIMIT - prefix.length - suffix.length;
    if (budget < 0) throw new Error("Os dados essenciais ultrapassam 4000 caracteres. Resuma os detalhes do produto ou do personagem.");
    const bible = fullPrompt.slice(start + marker.length, end);
    return prefix + sentence(bible, budget) + suffix;
  });
}
