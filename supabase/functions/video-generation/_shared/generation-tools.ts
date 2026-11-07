/** Explicit selection is preserved across retries; only auto permits fallback. */
export const videoTools = [
  { id: "auto", label: "Automático", provider: null, reason: "Usa os serviços de vídeo disponíveis, com troca automática." },
  { id: "google-flow", label: "Google Flow", provider: null, reason: "Integração de geração pendente. O login Google não transfere a sessão nem os créditos do Flow ao aplicativo." },
  { id: "youtube-create", label: "YouTube Create", provider: null, reason: "Disponível no aplicativo móvel; não há integração automática validada com este editor." },
  { id: "google-gemini", label: "Google Omni · API", provider: "google-gemini", reason: "Usa a API e o faturamento do projeto Google; assinatura do Flow não é transferida." },
  { id: "onemin", label: "1min.ai · Seedance", provider: "onemin", reason: "Gera vídeo com referência de imagem e áudio nativo usando os créditos da conta 1min.ai." },
  { id: "magic-hour", label: "Magic Hour", provider: "magic-hour", reason: "Usa os créditos da conta Magic Hour configurada no app." },
  { id: "replicate", label: "Replicate", provider: "replicate", reason: "Usa o faturamento da conta Replicate configurada no app." },
] as const;
export function generationTools(providers: readonly { id: string; configured: boolean }[]) {
  return videoTools.map((tool) => ({ ...tool, available: tool.id === "auto"
    ? providers.some((provider) => provider.configured)
    : tool.provider !== null && providers.some((provider) => provider.id === tool.provider && provider.configured) }));
}
export function allowsVideoProvider(selection: unknown, provider: string): boolean {
  return selection === undefined || selection === "auto" ||
    videoTools.some((tool) => tool.id === selection && tool.provider === provider);
}
