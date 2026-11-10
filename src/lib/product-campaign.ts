export type CampaignProduct = { id: string; title: string; platform: string; imageUrl?: string | null; productUrl?: string; price?: string; owned?: boolean };
export type PublicationDraft = { product: CampaignProduct; affiliateUrl: string; caption: string; hashtags: string; media: Blob; filename: string };
export function affiliateUrlValid(value: string): boolean {
  try { const url = new URL(value); return url.protocol === "https:" && !url.username && !url.password; } catch { return false; }
}
export function campaignCaption(title: string, affiliateUrl: string, hashtags: string): string {
  return [title.trim(), affiliateUrl.trim(), hashtags.trim()].filter(Boolean).join("\n\n");
}
export function campaignPrompt(product: CampaignProduct, details: string, scene: string, speech: string, person: string): string {
  return `Você é especialista em prompts para vídeo e imagem de produtos. Analise a foto anexada do anúncio “${product.title}”. Não use outra peça como referência.
1. Identifique se é vestuário masculino, feminino ou unissex, quando isso for verificável; se houver dúvida, indique-a. Liste somente detalhes visíveis: cor, modelo, tecido aparente, gola, estampas e corte. Não invente características.
2. Escolha um personagem adulto adequado (${person}). Preserve exatamente o produto da foto. Para vestuário mostre o caimento; para utensílios mostre uso coerente com mãos e objeto.
3. Considere estes detalhes confirmados pelo usuário: ${details || "nenhum detalhe adicional; conferir pela imagem"}.
4. Ambiente: ${scene}. Ação: apresentar e demonstrar o produto de forma natural.
5. Fala EXATA em português brasileiro: ${JSON.stringify(speech)}. Não acrescente preço, desconto, escassez ou benefício não comprovado.
6. Entregue um PROMPT FINAL EM PORTUGUÊS e um FINAL PROMPT IN ENGLISH prontos para uma IA de vídeo. A versão inglesa deve manter a fala em português. Inclua descrição detalhada do personagem, peça exata, gestos e cenário. Medium shot, realistic lighting, cinematic commercial, vertical 9:16, 4K como especificação solicitada (a ferramenta define a resolução real).
7. Entregue também um prompt de IMAGEM em português e inglês com o personagem usando o mesmo produto. Sem texto sobreposto, sem alterar logotipos ou estampas. Se a imagem tiver mais de uma variante, pergunte qual usar antes de gerar.
O link de afiliado será adicionado à publicação pelo aplicativo; não o desenhe na imagem.`;
}
export async function storePublicationDraft(userId: string, draft: PublicationDraft): Promise<void> {
  const db = await openDrafts();
  try { await new Promise<void>((resolve, reject) => { const tx = db.transaction("drafts", "readwrite"); tx.objectStore("drafts").put(draft, userId); tx.oncomplete = () => resolve(); tx.onerror = () => reject(tx.error); tx.onabort = () => reject(tx.error); }); } finally { db.close(); }
}
export async function loadPublicationDraft(userId: string): Promise<PublicationDraft | null> {
  const db = await openDrafts();
  try { return await new Promise((resolve, reject) => { const request = db.transaction("drafts").objectStore("drafts").get(userId); request.onsuccess = () => resolve(request.result ?? null); request.onerror = () => reject(request.error); }); } finally { db.close(); }
}
function openDrafts(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => { const request = indexedDB.open("mv-publication-drafts", 1); request.onupgradeneeded = () => request.result.createObjectStore("drafts"); request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error); });
}
