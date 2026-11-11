"use client";
import { useEffect, useState } from "react";
import { useAuth } from "@/components/auth/AuthProvider";
import { affiliateUrlValid, campaignCaption, storePublicationDraft, productHashtags, type CampaignProduct } from "@/lib/product-campaign";
import { sharePublication, shopeeProductDestination } from "@/lib/publication-share";
const field = "mt-1 w-full rounded-lg border border-border bg-background p-3 text-sm";
export function PublicationComposer({ product, affiliateUrl, media, filename, initialCaption, initialHashtags }: { product: CampaignProduct; affiliateUrl: string; media: Blob; filename: string; initialCaption?: string; initialHashtags?: string }) {
  const { user } = useAuth();
  const [caption, setCaption] = useState(initialCaption ?? product.title), [hashtags, setHashtags] = useState(initialHashtags ?? productHashtags(product.title, product.platform));
  const [notice, setNotice] = useState(""); const [busy, setBusy] = useState(false); const [url, setUrl] = useState("");
  useEffect(() => { const value = URL.createObjectURL(media); const frame = requestAnimationFrame(() => setUrl(value)); return () => { cancelAnimationFrame(frame); URL.revokeObjectURL(value); }; }, [media]);
  const text = campaignCaption(caption, affiliateUrl, hashtags);
  const valid = affiliateUrlValid(affiliateUrl);
  const shopee = product.platform === "Shopee";
  const productDestination = shopeeProductDestination(product.productUrl);
  async function save() { if (!user || !valid) return; setBusy(true); try { await storePublicationDraft(user.id, { product, affiliateUrl, media, filename, caption, hashtags }); setNotice("Rascunho com mídia e link salvo neste navegador. Abra Publicações para continuar."); } catch { setNotice("Não foi possível salvar o rascunho. Baixe a mídia e copie a legenda."); } finally { setBusy(false); } }
  async function share() {
    if (!valid) return;
    const file = new File([media], filename, { type: media.type });
    const result = await sharePublication(navigator, { files: [file], title: product.title, text });
    if (result === "shared") setNotice(shopee ? "Compartilhamento entregue ao dispositivo. Na Shopee, confira o vídeo e a legenda, vincule o produto e toque em Postar. A postagem ainda não foi confirmada pelo Meu Vendedor." : "Compartilhamento entregue ao dispositivo. Conclua a postagem no aplicativo escolhido.");
    if (result === "unsupported" || result === "failed") setNotice(shopee ? "Baixe o vídeo e copie a publicação. Abra a Shopee → Live e Vídeos → Vídeos → +, selecione o arquivo, cole a legenda e vincule o produto antes de postar." : "Não foi possível compartilhar neste navegador. Baixe a mídia e copie a publicação.");
  }
  return <section className="space-y-3 rounded-xl border border-primary p-4" aria-label="Preparar publicação">
    <h3 className="text-lg font-semibold">{shopee ? "Compartilhar na Shopee · Live e Vídeos" : "Tudo pronto para compartilhar"}</h3>
    {shopee && <div className="space-y-2 rounded-xl bg-background p-3 text-sm">
      <p className="font-semibold">Destino: Shopee → Live e Vídeos → Vídeos</p>
      <p>O botão abre as opções de compartilhamento do seu dispositivo. Se a Shopee aparecer, selecione-a. Confira a legenda e adicione este produto ao vídeo antes de tocar em Postar.</p>
      <p>Se a Shopee não aparecer, baixe o vídeo e copie a publicação. No app Shopee, abra Live e Vídeos → Vídeos → + e selecione o arquivo da galeria.</p>
      <p className="text-xs text-muted">O aplicativo receptor pode não preencher o texto automaticamente. Use Copiar publicação para colar a legenda. O produto deve ser vinculado ao vídeo; o link na legenda não substitui essa etapa.</p>
    </div>}
    {url && (media.type.startsWith("video/") ? <video src={url} controls playsInline className="max-h-80 w-full rounded-lg" /> : <a href={url} target="_blank" rel="noopener noreferrer" className="text-primary underline">Conferir imagem</a>)}
    <label className="block text-sm">Legenda<textarea value={caption} onChange={e => setCaption(e.target.value)} className={field} /></label>
    <label className="block text-sm">Hashtags<input value={hashtags} onChange={e => setHashtags(e.target.value)} className={field} /></label>
    {shopee && <div className="space-y-2 text-sm"><label className="block">Produto para vincular na Shopee<input readOnly value={product.title} onFocus={event => event.target.select()} className={field}/></label><button type="button" onClick={async () => { try { await navigator.clipboard.writeText(product.title); setNotice("Nome do produto copiado. Use-o para localizar e vincular o produto no vídeo da Shopee."); } catch { setNotice("Selecione e copie o nome do produto acima."); } }} className="text-primary underline">Copiar nome do produto</button>{productDestination && <a href={productDestination} target="_blank" rel="noopener noreferrer" className="ml-3 inline-block text-primary underline">Abrir produto na Shopee</a>}</div>}
    <p className="break-all text-sm">Link de afiliado: {affiliateUrl || "Gere ou informe seu link antes de compartilhar."}</p>
    {!valid && <p className="text-sm text-muted">Adicione um link HTTPS válido na criação da divulgação.</p>}
    <textarea aria-label="Texto completo da publicação" readOnly value={text} className={field} rows={5} />
    <div className="flex flex-wrap gap-3 text-sm">
      <a href={url || undefined} download={filename} className="text-primary underline">Baixar mídia</a>
      <button type="button" disabled={!valid} onClick={async () => { try { await navigator.clipboard.writeText(text); setNotice("Legenda, hashtags e link copiados."); } catch { setNotice("Selecione e copie o texto completo acima."); } }} className="text-primary underline disabled:opacity-50">Copiar publicação</button>
      <button type="button" disabled={!valid} onClick={() => void share()} className="w-full rounded-xl bg-primary px-4 py-3 font-semibold text-white disabled:opacity-50">{shopee ? "Compartilhar para Shopee Vídeo" : "Compartilhar vídeo, legenda e link"}</button>
      {user && <button type="button" disabled={!valid || busy} onClick={() => void save()} className="text-primary underline disabled:opacity-50">{busy ? "Salvando…" : "Salvar rascunho"}</button>}
    </div>
    {shopee && <details className="text-xs text-muted"><summary className="cursor-pointer text-primary">Sobre a publicação direta</summary><p className="mt-2">O acesso Shopee conectado permite consultar produtos e gerar links. Envio automático ao Shopee Vídeo precisa de uma autorização específica de vídeo, ainda não conectada ao Meu Vendedor. Compartilhar não confirma a postagem. Esta etapa prepara um vídeo gravado para a aba Vídeos de Live e Vídeos.</p></details>}
    {notice && <p role="status" className="text-sm text-primary">{notice}</p>}
  </section>;
}
