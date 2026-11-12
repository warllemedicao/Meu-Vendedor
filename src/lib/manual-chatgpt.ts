export const CHATGPT_URL = "https://chatgpt.com/";
export const MAX_MANUAL_PROMPT = 30000;
export interface ProductBrief {
  name?: string; description?: string; features?: string; benefits?: string;
  store?: string; videoType?: string; duration?: string; format?: string;
  character?: string; presentationStyle?: string; instructions?: string;
}
/** Somente texto de produto; nunca serializar sessão, URLs privadas ou objetos de API. */
export function publicProductText(value = ""): string {
  return value
    .replace(/(?:https?:\/\/|data:|blob:)[^\s<>]+/gi, "[endereço omitido]")
    .replace(/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi, "[e-mail omitido]")
    .replace(/\b(?:sb_secret_|sb_publishable_|sk-|hf_)[A-Za-z0-9_-]+/g, "[credencial omitida]")
    .replace(/\beyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\b/g, "[token omitido]")
    .replace(/\b(?:authorization|api[_ -]?key|access[_ -]?token|refresh[_ -]?token|app[_ -]?secret|password|senha|token)\s*[:=]\s*[^\s,;]+/gi, "[credencial omitida]")
    .replace(/\b\d{3}\.\d{3}\.\d{3}-\d{2}\b/g, "[documento omitido]")
    .slice(0, 5000);
}
export function buildChatGPTBrief(input: ProductBrief): string {
  const labels: [keyof ProductBrief, string][] = [["name","Nome do produto"],["description","Descrição"],["features","Características confirmadas"],["benefits","Benefícios verificáveis"],["store","Loja de origem"],["videoType","Tipo de vídeo"],["duration","Duração selecionada"],["format","Formato selecionado"],["character","Personagem escolhido"],["presentationStyle","Estilo de apresentação"],["instructions","Instruções adicionais"]];
  return ["Crie um roteiro e um prompt de vídeo com base APENAS nos dados abaixo.", ...labels.filter(([key])=>input[key]?.trim()).map(([key,label])=>`${label}: ${publicProductText(input[key])}`),
    "Formato preferencial: vertical 9:16. Respeite outro formato somente se indicado acima.",
    "Não invente benefícios, preços, descontos ou resultados. Preserve o produto da imagem autorizada que eu anexar manualmente. Se faltar informação, indique a dúvida.",
    "Separe DIREÇÃO VISUAL de FALA/NARRAÇÃO. Entregue o prompt completo em português e inglês, mantendo a fala em português brasileiro. Respeite a duração e reserve tempo suficiente para a fala.",
    "Não inclua dados pessoais, credenciais ou links de afiliado. Identifique a publicidade quando aplicável."].join("\n\n");
}
export function promptDraftKey(userId: string | undefined, context: string): string {
  let hash = 2166136261;
  for (const char of context) hash = Math.imul(hash ^ char.charCodeAt(0), 16777619);
  return `mv-manual-prompt-v1:${userId ?? "guest"}:${(hash >>> 0).toString(16)}`;
}
