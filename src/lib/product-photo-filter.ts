export type PhotoDecision = "photo" | "specification" | "description" | "review";
export interface PhotoAssessment { decision: PhotoDecision; reason: string; text: string; confidence: number }
export function assessProductPhoto(text: string, confidence: number): PhotoAssessment {
  const clean = text.trim().slice(0, 6000);
  const normalized = clean.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
  const words = normalized.match(/[a-z0-9]+/g) ?? [];
  const lines = normalized.split(/\n/).filter(line => line.trim().length > 2);
  const terms = normalized.match(/\b(?:dimensoes|especificacoes|comprimento|largura|altura|voltagem|potencia|capacidade|composicao|peso|diametro|medidas|busto|cintura|quadril)\b/g) ?? [];
  const units = normalized.match(/\b\d+(?:[.,]\d+)?\s*(?:cm|mm|kg|ml|litros|volts|watts|mah)\b/g) ?? [];
  const result = (decision: PhotoDecision, reason: string) => ({ decision, reason, text: clean, confidence });
  if (!clean) return result("photo", "Nenhum texto relevante foi identificado. Confira a foto.");
  if (!Number.isFinite(confidence) || confidence < 40) return result("review", "Leitura incerta. Revise a imagem antes de incluir.");
  if ((/tabela\s+(?:de\s+)?(?:medidas|tamanhos)|especificacoes\s+tecnicas/.test(normalized) && words.length >= 4)
    || (new Set(terms).size >= 2 && (lines.length >= 3 || units.length >= 2)) || units.length >= 3) {
    return result("specification", "Possível tabela de medidas ou especificações. Retirada da seleção.");
  }
  if (words.length >= 18 || clean.length >= 140 && words.length >= 10) return result("description", "Muito texto identificado. Retirada da seleção.");
  if (words.length >= 6 || terms.length >= 1 || units.length >= 1) return result("review", "Texto ou medida identificados. Revise antes de incluir.");
  return result("photo", "Pouco texto identificado; pode ser marca ou rótulo. Confira a foto.");
}
