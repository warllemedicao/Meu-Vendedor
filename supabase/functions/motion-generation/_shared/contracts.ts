export const engines = [
  { id: "wan-animate", label: "Wan Animate · atuação de vídeo", kind: "video", supported: true, reason: "Transfere movimentos; fidelidade ao produto precisa ser revisada." },
  { id: "scail", label: "SCAIL-2 · atuação e substituição", kind: "video", supported: true, reason: "Usa máscaras para acompanhar o personagem." },
  { id: "vace", label: "VACE · edição por máscara", kind: "video", supported: true, reason: "A máscara branca indica onde editar; o restante do vídeo é recomposto da origem." },
  { id: "fashn", label: "FASHN · vestir a peça da foto", kind: "image", supported: true, reason: "Foto de peça isolada, sem parser SegFormer. Produz uma imagem para revisão antes de animar." },
  { id: "anchorcrafter", label: "AnchorCrafter", kind: "video", supported: false, reason: "Pesos e licença do conjunto ainda precisam de validação; checkpoint publicado ajustado em cinco objetos." },
  { id: "omnishow", label: "OmniShow", kind: "video", supported: false, reason: "Autores não disponibilizam os checkpoints treinados." },
  { id: "hoi-swap", label: "HOI-Swap", kind: "video", supported: false, reason: "Pesos não disponibilizados pelos autores." },
  { id: "re-hold", label: "Re-HOLD", kind: "video", supported: false, reason: "Sem distribuição de pesos confirmada." },
  { id: "musepose", label: "MusePose", kind: "video", supported: false, reason: "Modelo restrito a pesquisa não comercial." },
  { id: "catv2ton", label: "CatV2TON", kind: "video", supported: false, reason: "Licença não comercial do modelo." },
  { id: "unianimate", label: "UniAnimate", kind: "video", supported: false, reason: "Modelo restrito a pesquisa não comercial." },
  { id: "joyai", label: "JoyAI Video Edit", kind: "video", supported: false, reason: "Configuração T4 ainda não validada; distribuição de referência exige mais memória." },
  { id: "omnitryon", label: "OmniTryOn", kind: "video", supported: false, reason: "Licença e execução T4 ainda não validadas." },
] as const;
export type Engine = "wan-animate" | "scail" | "vace" | "fashn";
export type MotionInput = {
  engine: Engine; assetId: string; referencePath?: string; productPath?: string;
  driverPath?: string; maskPath?: string; mode: "animate" | "replace";
  category: "tops" | "bottoms" | "one-pieces"; prompt: string;
  seconds: number; seed: number;
  sourceProductId?: string; preparedJobId?: string;
  reviewedProductSha256?: string; reviewedReferenceSha256?: string;
};
export function ownedPath(user: string, value: unknown, kind: "image" | "video"): value is string {
  return typeof value === "string" && new RegExp(`^${user}/inputs/[A-Za-z0-9_-]+\\.${kind === "image" ? "(jpg|png|webp)" : "(mp4|webm)"}$`).test(value);
}
export function ownedReference(user: string, value: unknown): value is string {
  return ownedPath(user, value, "image") || (typeof value === "string" && new RegExp(`^${user}/motion/[a-f0-9-]{36}\\.png$`).test(value));
}
export function validateInput(user: string, body: Record<string, unknown>): MotionInput {
  if (!engines.some(e => e.id === body.engine && e.supported)) throw new Error("engine_unavailable");
  if (typeof body.assetId !== "string" || !/^[0-9a-f-]{36}$/i.test(body.assetId)) throw new Error("input_invalid");
  const engine = body.engine as Engine;
  const paths = ["referencePath", "productPath", "driverPath", "maskPath"] as const;
  for (const key of paths) if (body[key] !== undefined && !(key === "referencePath" ? ownedReference(user, body[key]) : ownedPath(user, body[key], key === "driverPath" || key === "maskPath" ? "video" : "image"))) throw new Error("input_invalid");
  if (!body.productPath || (engine !== "fashn" && !body.driverPath)) throw new Error("input_required");
  if (engine === "wan-animate" && body.mode === "replace") throw new Error("input_invalid");
  for (const key of ["sourceProductId", "preparedJobId"]) if (body[key] !== undefined && (typeof body[key] !== "string" || !/^[a-f0-9-]{36}$/.test(String(body[key])))) throw new Error("input_invalid");
  for (const key of ["reviewedProductSha256", "reviewedReferenceSha256"]) if (body[key] !== undefined && (typeof body[key] !== "string" || !/^[a-f0-9]{64}$/.test(String(body[key])))) throw new Error("input_invalid");
  if (engine === "vace" && !body.maskPath) throw new Error("mask_required");
  if (body.mode !== "animate" && body.mode !== "replace") throw new Error("input_invalid");
  if (!["tops", "bottoms", "one-pieces"].includes(String(body.category))) throw new Error("input_invalid");
  if (typeof body.prompt !== "string" || body.prompt.trim().length < 5 || body.prompt.length > 1200) throw new Error("input_invalid");
  if (!Number.isInteger(body.seconds) || Number(body.seconds) < 2 || Number(body.seconds) > 4 || !Number.isInteger(body.seed) || Number(body.seed) < 0 || Number(body.seed) > 2147483647) throw new Error("input_invalid");
  const provenance = ["sourceProductId", "preparedJobId", "reviewedProductSha256", "reviewedReferenceSha256"];
  return { engine, assetId: body.assetId, ...Object.fromEntries([...paths, ...provenance].filter(k => body[k] !== undefined).map(k => [k, body[k]])), mode: body.mode, category: body.category as MotionInput["category"], prompt: body.prompt.trim(), seconds: Number(body.seconds), seed: Number(body.seed) };
}
export function assertReviewedInput(input: MotionInput, productHash: string, referenceHash: string, prepared?: { asset_id: string; status: string; engine: string; result_path: string; input: MotionInput } | null) {
  if (input.reviewedProductSha256 !== productHash || input.reviewedReferenceSha256 !== referenceHash) throw new Error("input_review_required");
  if (input.referencePath?.includes("/motion/")) {
    if (!input.preparedJobId || !prepared || prepared.status !== "completed" || prepared.engine !== "fashn" || prepared.asset_id !== input.assetId || prepared.result_path !== input.referencePath || prepared.input.reviewedProductSha256 !== productHash) throw new Error("prepared_reference_mismatch");
  } else if (input.preparedJobId) throw new Error("prepared_reference_mismatch");
}
export function videoSignature(bytes: Uint8Array) {
  return bytes.length >= 12 && (String.fromCharCode(...bytes.slice(4, 8)) === "ftyp" || [0x1a, 0x45, 0xdf, 0xa3].every((v, i) => bytes[i] === v));
}
export function importableVideoUrl(value: unknown): URL {
  if (typeof value !== "string" || value.length > 3000) throw new Error("video_url_invalid");
  let u: URL; try { u = new URL(value); } catch { throw new Error("video_url_invalid"); }
  // Explicit public video CDNs only. No arbitrary URL fetch, cookies, redirect or internal hosts.
  if (u.protocol !== "https:" || u.username || u.password || (u.port && u.port !== "443") || !["videos.pexels.com", "videos.pixabay.com", "cdn.pixabay.com", "down-cvs-br.img.susercontent.com"].includes(u.hostname) || !/\.(mp4|webm)$/i.test(u.pathname)) throw new Error("video_url_unsupported");
  return u;
}
export async function limitedBytes(response: Response, limit: number): Promise<Uint8Array> {
  if (!response.ok || !response.body || Number(response.headers.get("content-length") ?? 0) > limit) { await response.body?.cancel(); throw new Error("media_unavailable"); }
  const chunks: Uint8Array[] = []; let size = 0;
  const reader = response.body.getReader();
  try { for (;;) { const { value, done } = await reader.read(); if (done) break; size += value.length; if (size > limit) throw new Error("media_too_large"); chunks.push(value); } }
  finally { await reader.cancel(); }
  const bytes = new Uint8Array(size); let offset = 0; for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.length; } return bytes;
}
