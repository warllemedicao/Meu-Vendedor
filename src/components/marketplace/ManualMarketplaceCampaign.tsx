"use client";
import { useState } from "react";
import { ProductCampaign } from "@/components/videos/ProductCampaign";
import { campaignCaption, productHashtags } from "@/lib/product-campaign";
import { manualCampaignSpeech, marketplaceById, officialAffiliateUrl, type ManualMarketplaceId } from "@/lib/marketplace-directory";

const field = "mt-1 w-full rounded-lg border border-border bg-background p-3 text-sm";
const button = "rounded-lg border border-primary px-4 py-2 text-sm font-semibold text-primary disabled:opacity-50";
type Prepared = { title: string; url: string; image?: string; speech: string; caption: string; hashtags: string };

export function ManualMarketplaceCampaign({ platform }: { platform: ManualMarketplaceId }) {
  const marketplace = marketplaceById(platform);
  const [title, setTitle] = useState(""), [url, setUrl] = useState(""), [image, setImage] = useState("");
  const [ready, setReady] = useState<Prepared | null>(null), [notice, setNotice] = useState("");
  const valid = officialAffiliateUrl(platform, url);
  const imageValid = !image || (() => { try { const u = new URL(image); return u.protocol === "https:" && !u.username && !u.password && !/\s/.test(image); } catch { return false; } })();
  async function copy(text: string) { try { await navigator.clipboard.writeText(text); setNotice("Conteúdo copiado sem modificar o link de afiliado."); } catch { setNotice("Selecione o conteúdo no campo e copie manualmente."); } }
  return <section className="space-y-4 rounded-xl border border-border bg-surface p-5">
    <h2 className="text-lg font-semibold">Preparar divulgação com link oficial</h2>
    <p className="text-sm text-muted">Copie seu link no programa de afiliados {marketplace.name} e cole abaixo. O endereço é preservado exatamente como informado; o aplicativo não cria comissão nem comprova a atribuição do link. Use imagens próprias ou autorizadas.</p>
    <form className="space-y-3" onSubmit={event => { event.preventDefault(); if (!valid || !title.trim() || !imageValid) return; setReady({ title: title.trim(), url, image: image || undefined, speech: manualCampaignSpeech(title), caption: `${title.trim()} · Confira detalhes e condições no link. Posso receber uma comissão pela compra.`, hashtags: productHashtags(title, marketplace.name) }); setNotice(""); }}>
      <label className="block text-sm">Nome do produto<input required maxLength={200} value={title} onChange={e => setTitle(e.target.value)} className={field} placeholder="Ex.: cafeteira elétrica" /></label>
      <label className="block text-sm">Link oficial de afiliado<input required type="url" maxLength={2048} value={url} onChange={e => setUrl(e.target.value)} className={field} placeholder="https://..." /></label>
      {url && !valid && <p role="alert" className="text-sm text-danger">Use um link HTTPS oficial de {marketplace.name}, sem espaços ou credenciais. Não use encurtadores de terceiros.</p>}
      <label className="block text-sm">URL da imagem autorizada (opcional)<input type="url" maxLength={2048} value={image} onChange={e => setImage(e.target.value)} className={field} placeholder="https://.../produto.jpg" /></label>
      <p className="text-xs text-muted">Você também pode selecionar fotos e clipes do dispositivo no editor de vídeo.</p>
      {!imageValid && <p role="alert" className="text-sm text-danger">Use uma URL HTTPS de imagem sem credenciais.</p>}
      <button type="submit" disabled={!valid || !title.trim() || !imageValid} className={button}>Preparar roteiro, vídeo e Pin</button>
    </form>
    {ready && <div className="space-y-4 border-t border-border pt-4">
      <h3 className="font-semibold">Divulgação preparada: {ready.title}</h3>
      <label className="block text-sm">Link de afiliado preservado<input readOnly value={ready.url} className={field} onFocus={e => e.target.select()} /></label>
      <button type="button" onClick={() => void copy(ready.url)} className={button}>Copiar link oficial</button>
      <label className="block text-sm">Roteiro promocional editável<textarea maxLength={1500} rows={4} value={ready.speech} onChange={e => setReady({ ...ready, speech: e.target.value })} className={field} /></label>
      <label className="block text-sm">Descrição para Pinterest<textarea rows={3} maxLength={500} value={ready.caption} onChange={e => setReady({ ...ready, caption: e.target.value })} className={field} /></label>
      <label className="block text-sm">Hashtags<input maxLength={500} value={ready.hashtags} onChange={e => setReady({ ...ready, hashtags: e.target.value })} className={field} /></label>
      <label className="block text-sm">Material de divulgação<textarea readOnly rows={5} value={campaignCaption(ready.caption, ready.url, ready.hashtags)} className={field} /></label>
      <div className="flex flex-wrap gap-3"><button type="button" onClick={() => void copy(campaignCaption(ready.caption, ready.url, ready.hashtags))} className={button}>Copiar material para Pinterest</button><a href="https://www.pinterest.com/pin-builder/" target="_blank" rel="noopener noreferrer" className={button}>Abrir criador de Pin</a></div>
      <p className="text-xs text-muted">A publicação é manual: envie sua mídia e cole a descrição e o link no Pinterest. Não há confirmação de postagem automática. O roteiro acima é um modelo editável; análise por IA e voz exigem login e disponibilidade do serviço.</p>
      <ProductCampaign key={ready.title + ready.url + ready.image} product={{ id: ready.url, title: ready.title, platform: marketplace.name, imageUrl: ready.image, productUrl: ready.url, owned: false }} initialAffiliateUrl={ready.url} initialSpeech={ready.speech} />
    </div>}
    {notice && <p role="status" className="text-sm text-primary">{notice}</p>}
  </section>;
}
