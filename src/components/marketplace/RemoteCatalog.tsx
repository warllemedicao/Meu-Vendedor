"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { useAuth } from "@/components/auth/AuthProvider";
import { catalogSearch, catalogStatus } from "@/lib/product-catalog";
import { productSources } from "@/lib/product-sources";
import type { CatalogPlatform, CatalogResult, CatalogSourceStatus } from "@/types/product-catalog";

const emptyQuery = { keywords: "", categoryId: "", discountsOnly: false };
const label = (id: string) => productSources.find(p => p.id === id)?.name ?? id;
const errorMessage = (error: unknown) => error instanceof Error ? error.message : "Não foi possível consultar esta plataforma.";

export function RemoteCatalog({ platform }: { platform: string }) {
  const { user, loading } = useAuth();
  if (loading) return <p role="status">Verificando acesso aos catálogos…</p>;
  if (!user) return null;
  return <UserCatalog key={user.id} platform={platform} />;
}

function UserCatalog({ platform }: { platform: string }) {
  const [sources, setSources] = useState<CatalogSourceStatus[]>([]);
  const [results, setResults] = useState<Partial<Record<CatalogPlatform, CatalogResult>>>({});
  const [errors, setErrors] = useState<Partial<Record<CatalogPlatform, string>>>({});
  const [loading, setLoading] = useState(true), [busy, setBusy] = useState(false), [error, setError] = useState("");
  const [keywords, setKeywords] = useState(""), [discountsOnly, setDiscountsOnly] = useState(false);
  const [revision, setRevision] = useState(0);

  useEffect(() => {
    let active = true;
    void (async () => {
      try {
        const statuses = await catalogStatus();
        if (!active) return;
        setSources(statuses); setError("");
        await Promise.all(statuses.filter(source => source.configured).map(async source => {
          try {
            const result = await catalogSearch(source.platform, emptyQuery);
            if (active) setResults(previous => ({ ...previous, [source.platform]: result }));
          } catch (error) { if (active) setErrors(previous => ({ ...previous, [source.platform]: errorMessage(error) })); }
        }));
      } catch (error) { if (active) setError(errorMessage(error)); }
      finally { if (active) setLoading(false); }
    })();
    // Limpar da interface ofertas antigas, inclusive quando a aba permanece aberta.
    // Nenhum resultado ou imagem é gravado em localStorage, banco ou cache do aplicativo.
    const expiry = setInterval(() => {
      if (active) setResults(previous => Object.fromEntries(Object.entries(previous).filter(([, result]) => Date.parse(result.fetchedAt) > Date.now() - 30 * 60_000)));
    }, 60_000);
    return () => { active = false; clearInterval(expiry); };
  }, [revision]);

  async function search() {
    if (busy || loading) return;
    const targets = sources.filter(source => source.configured && (platform === "all" || platform === source.platform));
    if (!targets.length) return;
    setBusy(true);
    await Promise.all(targets.map(async source => {
      // Uma falha nunca deixa resultados da pesquisa anterior parecendo atuais.
      setResults(previous => { const next = { ...previous }; delete next[source.platform]; return next; });
      setErrors(previous => ({ ...previous, [source.platform]: "" }));
      try {
        const result = await catalogSearch(source.platform, { keywords, categoryId: "", discountsOnly });
        setResults(previous => ({ ...previous, [source.platform]: result }));
      } catch (error) { setErrors(previous => ({ ...previous, [source.platform]: errorMessage(error) })); }
    }));
    setBusy(false);
  }

  const visibleSources = sources.filter(source => platform === "all" || platform === source.platform);
  const canSearch = visibleSources.some(source => source.configured);
  return <section aria-label="Catálogos das plataformas" className="space-y-4">
    {loading && <p role="status">Consultando as fontes configuradas para sua conta…</p>}
    {error && <div role="alert" className="rounded-xl border border-border bg-surface p-4 text-sm"><p>{error}</p><button type="button" onClick={() => {setLoading(true); setRevision(value => value + 1);}} className="mt-2 text-primary underline">Verificar novamente</button></div>}
    {canSearch && <form onSubmit={event => { event.preventDefault(); void search(); }} className="flex flex-wrap items-end gap-3 rounded-xl border border-border bg-surface p-4">
      <label className="min-w-48 flex-1 text-sm">Pesquisar nas fontes disponíveis<input value={keywords} maxLength={120} onChange={event => setKeywords(event.target.value)} placeholder="Ex.: cafeteira, tênis, organização" className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2" /></label>
      <label className="flex items-center gap-2 py-2 text-sm"><input type="checkbox" checked={discountsOnly} onChange={event => setDiscountsOnly(event.target.checked)} />Somente descontos confirmados</label>
      <button type="submit" disabled={busy || loading} className="rounded-lg bg-primary px-4 py-2 text-sm text-background disabled:opacity-50">{busy ? "Consultando…" : "Consultar fontes"}</button>
      <p className="w-full text-xs text-muted">Mercado Livre consulta o ranking da categoria configurada; o texto de busca é aplicado a essa seleção. Cada fonte informa sua abrangência abaixo.</p>
    </form>}
    {visibleSources.map(source => {
      const result = results[source.platform];
      const products = result?.products.filter(product => `${product.title} ${product.shop ?? ""}`.toLocaleLowerCase("pt-BR").includes(keywords.toLocaleLowerCase("pt-BR")) && (!discountsOnly || (product.discountPercent !== null && product.discountPercent > 0))) ?? [];
      return <section key={source.platform} aria-label={`Catálogo ${label(source.platform)}`} className="rounded-xl border border-border bg-surface p-4 sm:p-5">
        <h2 className="text-lg font-semibold">{label(source.platform)}</h2>
        <p className="mt-1 text-sm text-muted">{source.message}</p>
        {errors[source.platform] && <p role="alert" className="mt-3 text-sm text-danger">{errors[source.platform]}</p>}
        {result && <>
          <p className="mt-3 text-sm">{result.scope}</p>
          <p className="mt-1 text-xs text-muted">Consultado em {new Date(result.fetchedAt).toLocaleString("pt-BR")}.</p>
          {result.warnings.map(warning => <p key={warning} className="mt-2 text-xs text-muted">{warning}</p>)}
          {products.length ? <ul className="mt-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">{products.map(product => <li key={product.id} className="overflow-hidden rounded-xl border border-border">
            <div className="flex h-44 items-center justify-center bg-white p-3">{product.imageUrl ? <Image unoptimized src={product.imageUrl} alt={product.title} width={240} height={160} className="h-full w-full object-contain" /> : <span className="text-sm text-slate-500">Imagem não fornecida</span>}</div>
            <div className="p-4"><p className="text-xs text-primary">{label(product.platform)}{product.rank !== null ? ` · #${product.rank} na categoria` : ""}</p>
              <h3 className="mt-2 line-clamp-3 text-sm font-semibold">{product.title}</h3>
              <p className="mt-3 text-lg font-semibold">{product.price === null ? "Preço não informado" : product.currency && /^[A-Z]{3}$/.test(product.currency) ? product.price.toLocaleString("pt-BR", { style: "currency", currency: product.currency }) : `${product.price.toLocaleString("pt-BR")} (moeda não informada)`}</p>
              {product.discountPercent !== null && product.discountPercent > 0 && <p className="mt-1 text-sm text-primary">{product.discountPercent}% de desconto informado</p>}
              {product.sales !== null && <p className="mt-2 text-xs text-muted">Vendas/volume informado: {product.sales}</p>}
              {product.shop && <p className="mt-1 truncate text-xs text-muted">{product.shop}</p>}
              {product.productUrl ? <a href={product.productUrl} target="_blank" rel="noopener noreferrer sponsored" className="mt-4 inline-block text-sm text-primary underline">Conferir na loja<span className="sr-only">: {product.title}</span></a> : <p className="mt-4 text-xs text-muted">Link não fornecido pela consulta.</p>}
            </div>
          </li>)}</ul> : <p className="mt-4 text-sm text-muted">Nenhum produto corresponde à consulta e aos filtros atuais.</p>}
        </>}
        {!loading && !busy && source.configured && !result && !errors[source.platform] && <p className="mt-3 text-sm text-muted">Consulte novamente para carregar ofertas atualizadas.</p>}
      </section>;
    })}
  </section>;
}
