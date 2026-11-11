"use client";
import { useState } from "react";
import { ProductCampaign } from "@/components/videos/ProductCampaign";
import { affiliateUrlValid } from "@/lib/product-campaign";

function validMercadoLivreLink(value: string): boolean {
  if (!affiliateUrlValid(value)) return false;
  try {
    const host = new URL(value).hostname.toLowerCase();
    return host === "mercadolivre.com.br" || host.endsWith(".mercadolivre.com.br") ||
      host === "mercadolibre.com.br" || host.endsWith(".mercadolibre.com.br") ||
      host === "mercadolivre.com" || host.endsWith(".mercadolivre.com") ||
      host === "meli.la" || host.endsWith(".meli.la");
  } catch { return false; }
}
export function MercadoLivreCampaign() {
  const [title, setTitle] = useState("");
  const [affiliateUrl, setAffiliateUrl] = useState("");
  const [productId, setProductId] = useState("");
  const [ready, setReady] = useState<{ title: string; url: string; id: string } | null>(null);
  const valid = validMercadoLivreLink(affiliateUrl);
  return <section className="space-y-4 rounded-xl border border-border bg-surface p-5">
    <h2 className="text-lg font-semibold">Preparar divulgação de produto</h2>
    <p className="text-sm text-muted">No portal de afiliados do Mercado Livre, use “Copiar link” no produto selecionado. Cole aqui o link oficial; o Meu Vendedor não cria links de comissão sem autorização.</p>
    <form className="space-y-3" onSubmit={event => {
      event.preventDefault();
      if (!valid || !title.trim()) return;
      setReady({ title: title.trim(), url: affiliateUrl.trim(), id: productId.trim() || affiliateUrl.trim() });
    }}>
      <label className="block text-sm">Nome do produto<input required maxLength={200} value={title} onChange={event => setTitle(event.target.value)} placeholder="Ex.: cafeteira elétrica" className="mt-1 w-full rounded-lg border border-border bg-background p-3" /></label>
      <label className="block text-sm">Link oficial copiado no portal<input required type="url" value={affiliateUrl} onChange={event => setAffiliateUrl(event.target.value)} placeholder="https://..." className="mt-1 w-full rounded-lg border border-border bg-background p-3" /></label>
      <label className="block text-sm">ID do produto (opcional)<input maxLength={50} value={productId} onChange={event => setProductId(event.target.value)} placeholder="MLB..." className="mt-1 w-full rounded-lg border border-border bg-background p-3" /></label>
      {affiliateUrl && !valid && <p role="alert" className="text-sm text-danger">Use o link HTTPS oficial do Mercado Livre. Links encurtados por outros serviços não são aceitos nesta tela.</p>}
      <button type="submit" disabled={!valid || !title.trim()} className="rounded-lg bg-primary px-4 py-3 font-semibold text-white disabled:opacity-50">Preparar vídeo e divulgação</button>
    </form>
    {ready && <div className="space-y-2">
      <p className="text-sm text-muted">Produto preparado: {ready.title}. Confira os dados e use uma foto sua ou uma imagem cuja utilização esteja autorizada.</p>
      <ProductCampaign key={ready.id + ready.url} product={{ id: ready.id, title: ready.title, platform: "Mercado Livre", productUrl: ready.url, owned: false }} initialAffiliateUrl={ready.url} />
    </div>}
  </section>;
}
