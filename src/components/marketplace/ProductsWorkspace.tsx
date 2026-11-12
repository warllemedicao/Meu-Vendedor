"use client";
import { useEffect, useState } from "react";
import { useAuth } from "@/components/auth/AuthProvider";
import { marketplaceDirectory } from "@/lib/marketplace-directory";
import { useMarketplace } from "./MarketplaceProvider";
import { ProductCatalog } from "./ProductCatalog";
import { PublicProductCatalog } from "./PublicProductCatalog";
import { RemoteCatalog } from "./RemoteCatalog";
import { ManualMarketplaceCampaign } from "./ManualMarketplaceCampaign";
export function ProductsWorkspace() {
  const { user, loading } = useAuth(); const marketplace = useMarketplace();
  const [platform, setPlatform] = useState("all");
  useEffect(() => {
    const read = () => { const value = new URLSearchParams(location.search).get("loja"); setPlatform(marketplaceDirectory.some(p => p.id === value) ? value! : "all"); };
    const frame = requestAnimationFrame(read); addEventListener("popstate", read);
    return () => { cancelAnimationFrame(frame); removeEventListener("popstate", read); };
  }, []);
  function select(value: string) { setPlatform(value); const url = new URL(location.href); url.searchParams.set("loja",value); history.pushState(null,"",url); }
  const connected = Boolean(user && marketplace.connections.some(c => c.platform_id === "shopee"));
  const showShopee = platform === "all" || platform === "shopee";
  return <div className="space-y-5">
    <div aria-label="Filtrar marketplaces" role="group" className="flex flex-wrap gap-2">{[{id:"all",name:"Todas as lojas"},...marketplaceDirectory].map(item => <button key={item.id} type="button" aria-pressed={platform === item.id} onClick={() => select(item.id)} className={`rounded-full border px-4 py-2 text-sm ${platform === item.id ? "border-primary bg-primary-soft text-primary" : "border-border bg-surface"}`}>{item.name}</button>)}</div>
    <section aria-label="Estado das integrações" className="grid gap-3 sm:grid-cols-2">{marketplaceDirectory.filter(item => platform === "all" || platform === item.id).map(item => <article key={item.id} className="min-w-0 rounded-xl border border-border bg-surface p-4"><h2 className="font-semibold">{item.name}</h2><p className="mt-1 text-sm text-primary">{item.id === "shopee" && connected ? "Conta Shopee vinculada · consultas sujeitas à autorização vigente" : item.status}</p><p className="mt-2 text-sm text-muted">{item.description}</p></article>)}</section>
    <div hidden={!showShopee || !connected} aria-label="Produtos da conta Shopee"><h2 className="mb-3 font-semibold">Shopee · produtos da conta</h2>{!loading && !marketplace.loading && connected && <ProductCatalog />}</div>
    <section hidden={!["all","shopee","amazon","tiktok"].includes(platform)} aria-label="Vitrine pública"><h2 className="mb-3 font-semibold">Produtos da vitrine pública</h2><PublicProductCatalog platformFilter={platform} excludeShopee={connected} /></section>
    <section hidden={platform === "shopee"} aria-label="Catálogos autorizados da conta"><h2 className="mb-3 font-semibold">Catálogos autorizados da conta</h2><RemoteCatalog platform={platform} /></section>
    <section aria-label="Campanhas com links oficiais" className="space-y-3"><h2 className="font-semibold">Usar meu link oficial e preparar divulgação</h2><p className="text-sm text-muted">O fluxo manual está disponível mesmo sem API. Escolha sua loja e abra o formulário. Nenhum produto fictício é incluído no catálogo.</p>
      {marketplaceDirectory.map(item => <div key={item.id} hidden={platform !== "all" && platform !== item.id}><details className="rounded-xl border border-border bg-surface p-3"><summary className="cursor-pointer font-medium text-primary">Preparar campanha · {item.name}</summary><ManualMarketplaceCampaign platform={item.id} /></details></div>)}
    </section>
  </div>;
}
