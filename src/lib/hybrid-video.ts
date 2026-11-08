export type HybridJob = {
  id: string; status: string; url?: string; error?: string; presenterId?: string; createdAt?: string;
  report?: { phase?: string; total_seconds?: number; duration_seconds?: number };
};
export const hybridActive = (job: HybridJob | null) => Boolean(job && ["submitting", "running", "uncertain", "cancelling"].includes(job.status));
export const hybridStatus: Record<string, string> = {
  cancelling: "Cancelamento solicitado", cancelled: "Cancelado", submitting: "Enviando", running: "Gerando vídeo", uncertain: "Envio em verificação", expired: "Prazo encerrado",
  failed: "Falhou", completed: "Concluído",
};
export const hybridMessages: Record<string, string> = {
  hybrid_result_unavailable: "O arquivo de vídeo está temporariamente indisponível. Atualize o acesso para tentar novamente.",
  hybrid_result_missing: "O executor terminou sem entregar um MP4. Solicite a verificação desta tarefa.",
  hybrid_busy: "Há um vídeo sendo gerado. Aguarde a tarefa atual.",
  hybrid_daily_limit: "O limite diário de geração foi atingido. Tente novamente amanhã.",
  hybrid_input_unavailable: "Esta base ou narração ainda não está disponível para geração.",
  hybrid_submission_uncertain: "O envio ainda não foi confirmado. Consulte o histórico; não reenvie a tarefa.",
  hybrid_preparation_failed: "Não foi possível preparar a tarefa. Confira a disponibilidade e a cota.",
  kaggle_not_configured: "O serviço de vídeo está temporariamente indisponível.",
};

/** Short suggested speech, shown for review; user-edited speech is never truncated. */
export function buildHybridNarration(product: { name: string; price: string; features: string; description: string }): string {
  const name = product.name.trim();
  const parts = [name && name.length <= 100 ? `Conheça ${name}.` : "Conheça este produto."];
  const detail = (product.features.trim().split(/\n/)[0] || product.description.trim()).replace(/[.!?]+$/, "");
  const price = product.price.trim();
  const cta = "Confira os detalhes no link.";
  for (const fact of [detail ? `${detail}.` : "", price ? `Valor informado: ${price}.` : ""]) {
    if (fact && [...parts, fact, cta].join(" ").length <= 180) parts.push(fact);
  }
  return [...parts, cta].join(" ");
}

/** The audio endpoint returns id/url on completed fresh and cached requests; no status field. */
export function completedNarrationId(payload: unknown): string {
  const audio = payload as { id?: unknown; url?: unknown } | null;
  if (typeof audio?.id !== "string" || !audio.id || typeof audio.url !== "string" || !audio.url) {
    throw new Error("A entrega da narração ainda não foi confirmada.");
  }
  return audio.id;
}
