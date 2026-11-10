"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { ProductCampaign } from "@/components/videos/ProductCampaign";
import type { CampaignProduct } from "@/lib/product-campaign";
import type { PublicCatalogResult, PublicPlatform } from "@/types/product-catalog";

export const homePlatforms = [{ id: "shopee", name: "Shopee" }, { id: "amazon", name: "Amazon" }, { id: "tiktok", name: "TikTok Shop" }] as const;
const label = (id: string) => homePlatforms.find(source => source.id === id)?.name ?? id;

export function PublicProductCatalog({ view = "offers" }: { view?: "offers" | "dashboard" | "trends" | "top10" }) {
  const [selected, setSelected] = useState<CampaignProduct | null>(null);
  const [platform, setPlatform] = useState("all"), [keyword, setKeyword] = useState("");
  const [sort, setSort] = useState(view === "top10" || view === "trends" ? "sales" : "default"), [discounts, setDiscounts] = useState(false);
  const [results, setResults] = useState<Partial<Record<PublicPlatform, PublicCatalogResult>>>({});
  const [errors, setErrors] = useState<Partial<Record<PublicPlatform, string>>>({});
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    let active = true;
    const controller = new AbortController();
    const load = async () => {
      await Promise.all(homePlatforms.map(async source => {
        try {
          const base = process.env.NEXT_PUBLIC_SUPABASE_URL;
          if (!base) throw new Error("A vitrine ainda não está configurada.");
          const response = await fetch(`${base}/functions/v1/catalog-public?platform=${source.id}`, { credentials: "omit", cache: "no-store", signal: controller.signal });
          const data = await response.json();
          if (!response.ok) throw new Error(typeof data?.error?.message === "string" ? data.error.message : "Não foi possível atualizar esta loja.");
          if (data.platform !== source.id || !Array.isArray(data.products)) throw new Error("Não foi possível carregar os produtos desta loja.");
          if (active) { setResults(previous => ({ ...previous, [source.id]: data })); setErrors(previous => ({ ...previous, [source.id]: undefined })); }
        } catch (error) {
          if (active) setErrors(previous => ({ ...previous, [source.id]: error instanceof Error ? error.message : "Não foi possível atualizar esta loja." }));
        }
      }));
      if (active) setLoading(false);
    };
    void load();
    // Refazer a leitura ao manter a página aberta, sem apresentar ofertas vencidas como atuais.
    const refresh = () => { if (active && document.visibilityState === "visible") void load(); };
    const timer = setInterval(refresh, 60_000);
    window.addEventListener("online", refresh);
    window.addEventListener("focus", refresh);
    return () => { active = false; controller.abort(); clearInterval(timer); window.removeEventListener("online", refresh); window.removeEventListener("focus", refresh); };
  }, []);

  const visibleSources = homePlatforms.filter(source => platform === "all" || source.id === platform);
  const products = visibleSources.flatMap(source => results[source.id]?.products ?? []).filter(product =>
    product.title.toLocaleLowerCase("pt-BR").includes(keyword.toLocaleLowerCase("pt-BR")) && (!discounts || (product.discountPercent !== null && product.discountPercent > 0)),
  ).sort((a, b) => {
    const av = sort === "discount" ? a.discountPercent : sort === "sales" ? a.sales === null ? null : Number(a.sales) : null;
    const bv = sort === "discount" ? b.discountPercent : sort === "sales" ? b.sales === null ? null : Number(b.sales) : null;
    return av === null && bv === null ? 0 : av === null ? 1 : bv === null ? -1 : bv - av;
  });
  const displayed = view === "top10" ? products.slice(0, 10) : products;
  return <div className="space-y-5">
    {view === "dashboard" && <section aria-label="Resumo do catálogo" className="grid gap-3 sm:grid-cols-3">{[["Produtos nos filtros atuais", products.length], ["Com desconto informado", products.filter(p => (p.discountPercent ?? 0) > 0).length], ["Lojas carregadas", Object.keys(results).length]].map(([label, value]) => <div key={label} className="rounded-xl border border-border bg-surface p-4"><p className="text-sm text-muted">{label}</p><p className="mt-2 text-2xl font-semibold">{loading ? "…" : value}</p></div>)}</section>}
    {(view === "trends" || view === "top10") && <p className="rounded-xl border border-border bg-surface p-4 text-sm text-muted">{view === "top10" ? "Até dez produtos dos filtros atuais, ordenados pelo critério escolhido." : "Explore sinais de interesse pelo volume de vendas informado pelas lojas."} A seleção usa os dados disponíveis do catálogo; não mede crescimento no tempo ou tendências de redes sociais. Os volumes de cada loja podem ter critérios diferentes.</p>}
    {selected && <section className="rounded-xl border border-primary p-4"><div className="flex justify-between gap-3"><h2 className="font-semibold">{selected.title}</h2><button type="button" onClick={() => setSelected(null)} className="text-sm text-primary underline">Fechar ficha</button></div><p className="mt-2 text-sm">{selected.platform} · {selected.price || "Preço não informado"}</p>{selected.productUrl && <a href={selected.productUrl} target="_blank" rel="noopener noreferrer" className="mt-2 inline-block text-sm text-primary underline">Conferir detalhes na loja</a>}<p className="mt-2 text-xs text-muted">Para gerar links pela API Shopee, use o filtro Meus produtos. Nesta vitrine, informe seu próprio link de afiliado.</p><ProductCampaign key={selected.id} product={selected} /></section>}

    <div className="flex flex-wrap gap-2" aria-label="Filtrar por loja">{[{id:"all",name:"Todas"},...homePlatforms].map(source => <button key={source.id} type="button" aria-pressed={platform === source.id} onClick={() => setPlatform(source.id)} className={`rounded-full border px-4 py-2 text-sm ${platform === source.id ? "border-primary bg-primary-soft text-primary" : "border-border bg-surface"}`}>{source.name}</button>)}</div>
    <div className="flex flex-wrap items-end gap-3 rounded-xl border border-border bg-surface p-4">
      <label className="min-w-48 flex-1 text-sm">Pesquisar produto<input value={keyword} maxLength={120} onChange={event => setKeyword(event.target.value)} placeholder="Nome do produto" className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2" /></label>
      <label className="text-sm">Ordenar<select value={sort} onChange={event => setSort(event.target.value)} className="mt-1 block rounded-lg border border-border bg-background px-3 py-2"><option value="default">Seleção de cada loja</option><option value="sales">Vendas informadas nesta seleção</option><option value="discount">Maior desconto informado</option></select></label>
      <label className="flex items-center gap-2 py-2 text-sm"><input type="checkbox" checked={discounts} onChange={event => setDiscounts(event.target.checked)} />Com desconto</label>
    </div>
    {loading && <p role="status" className="text-sm text-muted">Carregando produtos das três lojas…</p>}
    {products.length > 0 && <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">{displayed.map(product => <li key={`${product.platform}:${product.id}`} className="overflow-hidden rounded-xl border border-border bg-surface">
      <div className="flex h-52 items-center justify-center bg-white p-4">{product.imageUrl ? <Image unoptimized src={product.imageUrl} alt={product.title} width={300} height={210} className="h-full w-full object-contain" /> : <span className="text-sm text-slate-500">Imagem não fornecida</span>}</div>
      <div className="p-4"><p className="text-xs font-semibold text-primary">{label(product.platform)}</p><h2 className="mt-2 line-clamp-3 text-sm font-semibold">{product.title}</h2>
        <p className="mt-3 text-xl font-semibold">{product.price === null ? "Confira o preço na loja" : product.currency && /^[A-Z]{3}$/.test(product.currency) ? product.price.toLocaleString("pt-BR",{style:"currency",currency:product.currency}) : `${product.price.toLocaleString("pt-BR")} (moeda não informada)`}</p>
        {product.discountPercent !== null && product.discountPercent > 0 && <p className="mt-1 text-sm text-primary">{product.discountPercent}% de desconto informado</p>}
        {product.sales !== null && <p className="mt-2 text-xs text-muted">Vendas/volume informado: {product.sales}</p>}
        <p className="mt-2 text-xs text-muted">Atualizado em {new Date(product.updatedAt).toLocaleString("pt-BR")}</p>
        {product.productUrl && <a href={product.productUrl} target="_blank" rel="noopener noreferrer" className="mt-4 inline-block rounded-lg border border-border px-4 py-2 text-sm text-primary">Ver produto na loja<span className="sr-only">: {product.title}</span></a>}
        <button type="button" onClick={() => { setSelected({ id: product.platform + ":" + product.id, title: product.title, platform: label(product.platform), imageUrl: product.imageUrl, productUrl: product.productUrl ?? undefined, price: product.price === null ? undefined : String(product.price) }); window.scrollTo({top:0,behavior:"smooth"}); }} className="mt-3 block w-full rounded-lg bg-primary px-4 py-2 text-sm text-white">Ver e divulgar</button>
      </div>
    </li>)}</ul>}
    {!loading && products.length === 0 && Object.keys(results).length > 0 && <p className="rounded-xl border border-dashed border-border p-5 text-sm text-muted">Nenhum produto disponível corresponde aos filtros atuais.</p>}
    {!loading && visibleSources.some(source => errors[source.id]) && <div className="rounded-xl border border-border bg-surface p-4 text-sm"><h2 className="font-semibold">Lojas ainda sem produtos disponíveis</h2>{visibleSources.filter(source => errors[source.id]).map(source => <p key={source.id} className="mt-2 text-muted"><strong>{source.name}:</strong> {errors[source.id]}</p>)}<p className="mt-3 text-xs text-muted">A consulta é repetida automaticamente ao entrar nesta visualização, ao voltar à janela e a cada minuto.</p></div>}
    {visibleSources.map(source => results[source.id] && <p key={source.id} className="text-xs text-muted"><strong>{source.name}:</strong> {results[source.id]?.scope} {results[source.id]?.warnings.join(" ")}</p>)}
    <p className="text-xs text-muted">Preços e disponibilidade podem mudar. A seleção não representa o ranking global das lojas. Nenhuma conta de loja precisa ser conectada para navegar.</p>
  </div>;
}
