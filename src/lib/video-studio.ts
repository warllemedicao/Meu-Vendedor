export const presenterIds = ["ana", "lucas", "carla", "rafael"] as const;
export type PresenterId = (typeof presenterIds)[number];

export const voiceGenders = [
  { id: "feminina", label: "Feminina" },
  { id: "masculina", label: "Masculina" },
] as const;
export type VoiceGender = (typeof voiceGenders)[number]["id"];

export const voiceProfiles = [
  { id: "jovem-adulta", label: "Jovem adulta", instruction: "timbre jovem adulto, claro e natural" },
  { id: "adulta", label: "Adulta", instruction: "timbre adulto, seguro e natural" },
  { id: "grave", label: "Grave", instruction: "timbre mais grave, firme e inteligível" },
  { id: "suave", label: "Suave", instruction: "timbre suave, próximo e confortável" },
  { id: "energetica", label: "Energética", instruction: "ritmo energético, sem gritar" },
  { id: "natural", label: "Natural", instruction: "conversa natural, sem entonação robótica" },
  { id: "profissional", label: "Profissional", instruction: "dicção profissional, segura e objetiva" },
] as const;
export type VoiceProfileId = (typeof voiceProfiles)[number]["id"];

export const emotionalTones = [
  { id: "alegre", label: "Alegre e animado", instruction: "alegre, animado e acolhedor" },
  { id: "engracado", label: "Engraçado e descontraído", instruction: "bem-humorado e descontraído, sem exageros" },
  { id: "serio", label: "Sério e profissional", instruction: "sério, confiante e profissional" },
  { id: "emotivo", label: "Triste e emotivo", instruction: "contido e emotivo, sem dramatização artificial" },
  { id: "enfatico", label: "Bravo e enfático", instruction: "enfático e firme, sem agressividade" },
  { id: "calmo", label: "Calmo e explicativo", instruction: "calmo, didático e pausado" },
  { id: "promocao", label: "Empolgado com a promoção", instruction: "empolgado e ágil, destacando somente a oferta informada" },
  { id: "persuasivo", label: "Persuasivo e comercial", instruction: "persuasivo, comercial e confiável, sem promessas não comprovadas" },
] as const;
export type EmotionalToneId = (typeof emotionalTones)[number]["id"];

export const advertisingStyles = [
  { id: "tradicional", label: "Apresentação tradicional", instruction: "apresenta o produto diretamente para a câmera" },
  { id: "demonstracao", label: "Demonstração", instruction: "mostra cuidadosamente como o produto pode ser usado, sem inventar resultados" },
  { id: "promocao", label: "Promoção", instruction: "destaca preço ou oferta somente quando informados" },
  { id: "humor", label: "Humor", instruction: "usa uma situação leve e divertida mantendo o produto em destaque" },
  { id: "influenciador", label: "Influenciador digital", instruction: "fala de forma espontânea para redes sociais, sem alegar experiência pessoal" },
  { id: "profissional", label: "Apresentação profissional", instruction: "segue linguagem de publicidade comercial objetiva e elegante" },
] as const;
export type AdvertisingStyleId = (typeof advertisingStyles)[number]["id"];

export const videoDurations = [6, 7, 8] as const;
export type VideoDuration = (typeof videoDurations)[number];

export const videoTemplateIds = ["wearing-product", "presenting-product", "demonstrating-product"] as const;
export type VideoTemplateId = (typeof videoTemplateIds)[number];

export const videoTemplates = [
  {
    id: "wearing-product",
    name: "Personagem vestindo a roupa",
    category: "Moda",
    description: "Planeja uma apresentação de vestuário com a peça enviada como referência, sem alegar try-on fiel sem processamento validado.",
    instruction: "Apresente a roupa no personagem usando a imagem enviada como referência. Não afirme que a peça foi aplicada fielmente; se try-on não estiver disponível, proponha uma composição alternativa com a peça em destaque.",
  },
  {
    id: "presenting-product",
    name: "Personagem apresentando o produto",
    category: "Beleza e produtos",
    description: "Planeja a apresentação do produto pelo personagem, com foco nos detalhes visíveis e confirmados.",
    instruction: "Mostre o personagem apresentando o produto. Preserve a embalagem e os detalhes visíveis; não invente interação física ou rastreamento que a cena não suporte.",
  },
  {
    id: "demonstrating-product",
    name: "Personagem demonstrando o produto",
    category: "Demonstração",
    description: "Planeja uma demonstração de uso com cenário compatível, sem prometer resultados não comprovados.",
    instruction: "Planeje uma demonstração de uso compatível com o produto e o cenário. Não invente resultados, benefícios ou ações que não possam ser mostrados com segurança.",
  },
] as const satisfies readonly {
  id: VideoTemplateId;
  name: string;
  category: string;
  description: string;
  instruction: string;
}[];

export const videoScenePresets = [
  { id: "fashion-studio", name: "Estúdio de moda", templateId: "wearing-product", category: "Moda" },
  { id: "everyday-outfit", name: "Ambiente cotidiano", templateId: "wearing-product", category: "Moda" },
  { id: "beauty-counter", name: "Bancada de beleza", templateId: "presenting-product", category: "Beleza" },
  { id: "neutral-product-table", name: "Mesa de apresentação", templateId: "presenting-product", category: "Utilidades" },
  { id: "electronics-studio", name: "Estúdio de eletrônicos", templateId: "presenting-product", category: "Eletrônicos" },
  { id: "cleaning-kitchen", name: "Cozinha", templateId: "demonstrating-product", category: "Limpeza" },
  { id: "bathroom-counter", name: "Bancada de banheiro", templateId: "demonstrating-product", category: "Limpeza" },
] as const satisfies readonly {
  id: string;
  name: string;
  templateId: VideoTemplateId;
  category: string;
}[];

export const narrationModes = [
  { id: "character-speech", label: "Personagem fala", instruction: "O personagem fala para a câmera; sincronização labial só deve ser usada se suportada pelo provedor." },
  { id: "voiceover", label: "Narração externa", instruction: "Use narração externa, sem afirmar que o personagem está falando ou sincronizar os lábios." },
] as const;
export type NarrationMode = (typeof narrationModes)[number]["id"];

export const motionModes = [
  { id: "poses", label: "Poses com transições", instruction: "Use poses estáticas compatíveis com transições e movimentos de câmera simples." },
  { id: "continuous", label: "Movimento contínuo", instruction: "Prefira movimento contínuo realista; se não houver suporte, informe que a alternativa será composta por poses." },
] as const;
export type MotionMode = (typeof motionModes)[number]["id"];

export const videoFormats = [
  { id: "9:16", label: "Vertical 9:16", use: "TikTok, Reels e Shorts" },
  { id: "1:1", label: "Quadrado 1:1", use: "Feed e catálogo" },
  { id: "16:9", label: "Horizontal 16:9", use: "YouTube e páginas" },
] as const;
export type VideoFormat = (typeof videoFormats)[number]["id"];

export const generationModes = [
  { id: "ai-video", label: "Vídeo com IA", description: "Preparado para o provedor oficial do Google. A chamada real permanece desativada." },
  { id: "economy", label: "Modo econômico", description: "Planeja anúncio com foto, movimento de câmera, narração, legenda e transições." },
] as const;
export type GenerationMode = (typeof generationModes)[number]["id"];

export interface VirtualPresenter {
  id: PresenterId;
  name: string;
  image: string;
  description: string;
  visualIdentity: string;
  defaultVoiceGender: VoiceGender;
  defaultVoiceProfile: VoiceProfileId;
  preferences: string;
}

export const virtualPresenters: readonly VirtualPresenter[] = [
  {
    id: "ana",
    name: "Ana",
    image: "/presenters/ana.webp",
    description: "Apresentadora simpática e comunicativa para roupas, acessórios e produtos variados.",
    visualIdentity: "mulher adulta brasileira, pele morena clara, cabelo escuro ondulado na altura dos ombros, blusa coral e blazer claro",
    defaultVoiceGender: "feminina",
    defaultVoiceProfile: "natural",
    preferences: "apresentação próxima, gestos leves e contato visual com a câmera",
  },
  {
    id: "lucas",
    name: "Lucas",
    image: "/presenters/lucas.webp",
    description: "Apresentador moderno e descontraído para eletrônicos, acessórios e produtos masculinos.",
    visualIdentity: "homem adulto brasileiro, pele morena, cabelo preto curto, barba bem aparada, camisa verde-petróleo sobre camiseta clara",
    defaultVoiceGender: "masculina",
    defaultVoiceProfile: "jovem-adulta",
    preferences: "ritmo direto, linguagem atual e demonstrações objetivas",
  },
  {
    id: "carla",
    name: "Carla",
    image: "/presenters/carla.webp",
    description: "Apresentadora elegante e profissional para moda, beleza e produtos sofisticados.",
    visualIdentity: "mulher adulta brasileira, pele negra, cabelo cacheado preso de forma elegante, blusa verde-esmeralda e acessórios discretos",
    defaultVoiceGender: "feminina",
    defaultVoiceProfile: "profissional",
    preferences: "movimentos elegantes, dicção clara e composição visual refinada",
  },
  {
    id: "rafael",
    name: "Rafael",
    image: "/presenters/rafael.webp",
    description: "Apresentador carismático para demonstrações, promoções e produtos variados.",
    visualIdentity: "homem adulto brasileiro, pele morena clara, cabelo curto escuro com fios grisalhos, polo terracota",
    defaultVoiceGender: "masculina",
    defaultVoiceProfile: "energetica",
    preferences: "gestos comunicativos, sorriso natural e chamadas para ação claras",
  },
] as const;

export interface VideoProductInput {
  sourceProductId?: string | null;
  name: string;
  description: string;
  price: string;
  features: string;
  affiliateLink: string;
  imageUrl?: string;
  imageName?: string;
  imageStoragePath?: string;
}

export interface VideoConfiguration {
  product: VideoProductInput;
  templateId: VideoTemplateId;
  scenePresetId: string;
  presenterId: PresenterId;
  voiceGender: VoiceGender;
  voiceProfileId: VoiceProfileId;
  emotionalToneId: EmotionalToneId;
  advertisingStyleId: AdvertisingStyleId;
  narrationMode: NarrationMode;
  motionMode: MotionMode;
  durationSeconds: VideoDuration;
  format: "9:16";
  mode: GenerationMode;
  targetAudience: string;
}

export type VideoGenerationStatus =
  | "awaiting_configuration"
  | "ready"
  | "awaiting_provider"
  | "generating"
  | "processing"
  | "completed"
  | "simulation_completed"
  | "cancelled"
  | "failed";

export interface VideoLibraryRecord extends Omit<VideoConfiguration, "durationSeconds" | "format"> {
  durationSeconds: VideoDuration | 10 | 15 | 20 | 30 | 45 | 60;
  format: VideoFormat;
  id: string;
  parentId: string | null;
  script: string;
  prompt: string;
  provider: "mock" | "google-gemini" | "huggingface" | "modal";
  providerJobId: string | null;
  status: VideoGenerationStatus;
  resultUrl: string | null;
  resultStoragePath: string | null;
  createdAt: string;
  updatedAt: string;
}

const hooks: Record<EmotionalToneId, string> = {
  alegre: "Olha só esta novidade!",
  engracado: "Espera aí, você já viu isso?",
  serio: "Vamos direto ao que importa.",
  emotivo: "Alguns detalhes fazem diferença no dia a dia.",
  enfatico: "Presta atenção neste produto.",
  calmo: "Vou mostrar este produto com calma.",
  promocao: "Tem uma oportunidade que merece atenção!",
  persuasivo: "Se você procura uma opção interessante, veja esta.",
};

function firstUsefulDetail(product: VideoProductInput): string {
  const feature = product.features.split(/[\n,;]+/).map((item) => item.trim()).find(Boolean);
  if (feature) return feature;
  if (product.description.trim()) return product.description.trim();
  return "Confira os detalhes informados na página do produto";
}

function shorten(value: string, maxLength: number): string {
  const normalized = value.replace(/\s+/g, " ").trim();
  if (normalized.length <= maxLength) return normalized;
  return `${normalized.slice(0, Math.max(0, maxLength - 1)).trimEnd()}…`;
}

export function validateVideoProduct(product: VideoProductInput): string | null {
  const name = product.name.trim();
  if (name.length < 2 || name.length > 160) return "Informe o nome do produto com 2 a 160 caracteres.";
  if (product.description.length > 1200) return "A descrição deve ter até 1.200 caracteres.";
  if (product.price.length > 80) return "O preço ou oferta deve ter até 80 caracteres.";
  if (product.features.length > 1000) return "As características devem ter até 1.000 caracteres.";
  if (product.affiliateLink) {
    if (product.affiliateLink.length > 2048 || /\s/.test(product.affiliateLink)) return "Informe um link de afiliado HTTPS válido.";
    try {
      const url = new URL(product.affiliateLink);
      if (url.protocol !== "https:" || !url.hostname || url.username || url.password) return "Informe um link de afiliado HTTPS sem credenciais.";
    } catch {
      return "Informe um link de afiliado HTTPS válido.";
    }
  }
  return null;
}

export function buildAdvertisingScript(configuration: VideoConfiguration): string {
  const { product, durationSeconds } = configuration;
  const presenter = virtualPresenters.find((item) => item.id === configuration.presenterId) ?? virtualPresenters[0];
  const template = videoTemplates.find((item) => item.id === configuration.templateId) ?? videoTemplates[1];
  const detail = shorten(firstUsefulDetail(product), durationSeconds <= 15 ? 90 : 180);
  const priceLine = product.price.trim() ? ` O valor informado é ${shorten(product.price, 80)}.` : "";
  const audience = configuration.targetAudience.trim() ? ` para ${shorten(configuration.targetAudience, 100)}` : "";

  return [
    `ABERTURA — ${presenter.name}: “${hooks[configuration.emotionalToneId]}”`,
    `DIREÇÃO — ${template.name}.`,
    `APRESENTAÇÃO — “Este é o ${shorten(product.name, 160)}${audience}. ${detail}.${priceLine}”`,
    "ENCERRAMENTO — “Confira as informações completas e, se fizer sentido para você, acesse o produto.”",
  ].join("\n\n");
}

export function buildVideoPrompt(configuration: VideoConfiguration, script: string): string {
  const presenter = virtualPresenters.find((item) => item.id === configuration.presenterId) ?? virtualPresenters[0];
  const voice = voiceProfiles.find((item) => item.id === configuration.voiceProfileId) ?? voiceProfiles[0];
  const emotion = emotionalTones.find((item) => item.id === configuration.emotionalToneId) ?? emotionalTones[0];
  const style = advertisingStyles.find((item) => item.id === configuration.advertisingStyleId) ?? advertisingStyles[0];
  const template = videoTemplates.find((item) => item.id === configuration.templateId) ?? videoTemplates[1];
  const scene = videoScenePresets.find((item) => item.id === configuration.scenePresetId);
  const narration = narrationModes.find((item) => item.id === configuration.narrationMode) ?? narrationModes[1];
  const motion = motionModes.find((item) => item.id === configuration.motionMode) ?? motionModes[0];
  const sceneCount = Math.max(1, Math.ceil(configuration.durationSeconds / 8));
  const modeInstruction = configuration.mode === "economy"
    ? "Monte com a imagem real do produto, movimentos sutis de câmera, narração, legendas e transições simples; evite gerar cenas complexas."
    : `Planeje ${sceneCount} cena(s) curta(s) com continuidade visual e narrativa, combináveis no vídeo final.`;

  return [
    `Vídeo publicitário de ${configuration.durationSeconds} segundos, formato ${configuration.format}, em português do Brasil.`,
    `Template: ${template.name}. ${template.instruction}`,
    `Cenário desejado: ${scene?.name ?? "não selecionado"}${scene ? ` (${scene.category})` : ""}. O cenário é uma preferência de briefing; não implica disponibilidade de cena pré-armazenada.`,
    `Apresentador virtual: ${presenter.name}, ${presenter.visualIdentity}. Preserve rosto, cabelo, roupa, idade aparente e identidade entre todas as cenas; use a imagem de referência cadastrada quando o provedor permitir.`,
    `Produto: ${configuration.product.name}. Use a imagem fornecida como referência principal. Preserve cor, estampa, formato, embalagem, logotipo e detalhes visíveis. Não altere o produto nem invente características.`,
    `Estilo: ${style.label}; ${style.instruction}. Interpretação ${emotion.instruction}. Voz ${configuration.voiceGender}, ${voice.instruction}. ${narration.instruction}`,
    `${motion.instruction}`,
    modeInstruction,
    `Roteiro aprovado pelo usuário:\n${script.trim()}`,
    "Não invente desconto, preço, benefício, certificação, experiência pessoal ou resultado. Não adicione textos promocionais que não estejam no roteiro. Mantenha área segura para legendas.",
  ].join("\n\n");
}

export function validateVideoConfiguration(configuration: VideoConfiguration, script: string): string | null {
  const productError = validateVideoProduct(configuration.product);
  if (productError) return productError;
  if (!presenterIds.includes(configuration.presenterId)) return "Selecione um personagem válido.";
  if (!videoTemplateIds.includes(configuration.templateId)) return "Selecione um template válido.";
  if (!videoScenePresets.some((scene) => scene.id === configuration.scenePresetId && scene.templateId === configuration.templateId)) return "Selecione um cenário compatível com o template.";
  if (!narrationModes.some((option) => option.id === configuration.narrationMode)) return "Selecione um modo de narração válido.";
  if (!motionModes.some((option) => option.id === configuration.motionMode)) return "Selecione um modo de movimento válido.";
  if (!videoDurations.includes(configuration.durationSeconds)) return "Selecione uma duração válida.";
  if (configuration.format !== "9:16") return "O formato de novos vídeos deve ser vertical 9:16.";
  if (script.trim().length < 20 || script.length > 4000) return "Revise o roteiro; ele deve ter entre 20 e 4.000 caracteres.";
  return null;
}

export function createVideoLibraryRecord(
  configuration: VideoConfiguration,
  script: string,
  prompt: string,
  options: { id: string; now: string; parentId?: string | null; providerJobId?: string | null },
): VideoLibraryRecord {
  return {
    ...configuration,
    product: { ...configuration.product },
    id: options.id,
    parentId: options.parentId ?? null,
    script,
    prompt,
    provider: "mock",
    providerJobId: options.providerJobId ?? null,
    status: "simulation_completed",
    resultUrl: null,
    resultStoragePath: null,
    createdAt: options.now,
    updatedAt: options.now,
  };
}

export function estimateSceneCount(durationSeconds: VideoDuration, maxClipSeconds = 8): number {
  if (!Number.isFinite(maxClipSeconds) || maxClipSeconds <= 0) throw new RangeError("A duração máxima da cena deve ser positiva.");
  return Math.ceil(durationSeconds / maxClipSeconds);
}
