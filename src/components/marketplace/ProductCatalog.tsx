"use client";
import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useAuth } from "@/components/auth/AuthProvider";
import { ProductCampaign } from "@/components/videos/ProductCampaign";
import { useMarketplace } from "./MarketplaceProvider";
import { displayDate,marketplaceAction } from "@/lib/marketplace";
import type { MarketplaceProduct } from "@/types/marketplace";
const money=(value:number|null)=>value===null?"Não informado":Number(value).toLocaleString("pt-BR",{style:"currency",currency:"BRL"});
const percentage=(value:number|null)=>value===null?"Não informada":`${(Number(value)*100).toLocaleString("pt-BR",{maximumFractionDigits:2})}%`;
export function ProductCatalog({discovery=false,view="products"}:{discovery?:boolean;view?:"offers"|"products"|"dashboard"|"trends"|"top10"}) {
  const {user,loading}=useAuth();const state=useMarketplace();
  if(loading||state.loading)return <p role="status">Carregando suas conexões…</p>;
  if(!user)return <p><Link href="/entrar" className="text-primary underline">Entre na sua conta</Link> para consultar os produtos das plataformas conectadas.</p>;
  if(state.error)return <p role="alert">{state.error} <button onClick={state.refresh} className="text-primary underline">Tentar novamente</button></p>;
  const connection=state.connections.find(x=>x.platform_id==="shopee");
  if(!connection)return <div className="rounded-xl border border-border bg-surface p-5"><h2 className="font-semibold">Seu catálogo começa com uma conexão real</h2><p className="mt-2 text-sm text-muted">Conecte a Open API de afiliados Shopee para trazer ofertas para o Meu Vendedor. Nenhum produto demonstrativo será misturado ao catálogo.</p><Link href="/entrar#lojas" className="mt-4 inline-block rounded-lg bg-primary px-4 py-2 text-sm text-background">Conectar Shopee</Link><p className="mt-4 text-xs text-muted">TikTok, Mercado Livre, Amazon e Magazine Luiza serão disponibilizados conforme integração e acesso oficiais.</p></div>;
  return <UserProducts key={`${user.id}-${connection.id}`} userId={user.id} connectionId={connection.id} discovery={discovery} view={view}/>;
}
type View = "offers" | "products" | "dashboard" | "trends" | "top10";
// Coalescência evita duas consultas idênticas na montagem em Strict Mode.
const pendingPages = new Map<string, Promise<Awaited<ReturnType<typeof marketplaceAction>>>>();
function browsePage(userId: string, connectionId: string, keyword: string, sort: string, page: number) {
  const key = JSON.stringify([userId, connectionId, keyword, sort, page]);
  const existing = pendingPages.get(key); if (existing) return existing;
  const pending = marketplaceAction("browse_products", { keyword, sort, page });
  pendingPages.set(key, pending);
  void pending.finally(() => { if (pendingPages.get(key) === pending) pendingPages.delete(key); }).catch(() => {});
  return pending;
}
function UserProducts({userId,connectionId,discovery,view}:{userId:string;connectionId:string;discovery:boolean;view:View}) {
  const [keyword,setKeyword]=useState(""); const [query,setQuery]=useState(""); const [sort,setSort]=useState("sales");
  const [onlyDiscounts,setOnlyDiscounts]=useState(false);
  useEffect(() => { const timer = setTimeout(() => setQuery(keyword.trim()), 450); return () => clearTimeout(timer); }, [keyword]);
  return <div className="space-y-5">
    <div className="flex flex-wrap items-end gap-3"><label className="min-w-48 flex-1 text-sm">Buscar produtos na Shopee<input value={keyword} maxLength={120} onChange={e=>setKeyword(e.target.value)} className="mt-1 w-full rounded-lg border border-border bg-surface px-3 py-2" placeholder="Ex.: camisa, vestido, garrafa"/></label><label className="text-sm">Ordenar<select value={sort} onChange={e=>setSort(e.target.value)} className="mt-1 block rounded-lg border border-border bg-surface px-3 py-2"><option value="sales">Mais vendidos</option><option value="price">Menor preço</option><option value="commission">Maior comissão</option></select></label></div>
    <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={onlyDiscounts} onChange={e=>setOnlyDiscounts(e.target.checked)}/>Somente com desconto informado nas páginas carregadas</label>
    <ShopeeResults key={JSON.stringify([query,sort,view])} userId={userId} connectionId={connectionId} keyword={query} sort={sort} discovery={discovery} onlyDiscounts={onlyDiscounts} view={view}/>
  </div>;
}
function ShopeeResults({userId,connectionId,keyword,sort,discovery,onlyDiscounts,view}:{userId:string;connectionId:string;keyword:string;sort:string;discovery:boolean;onlyDiscounts:boolean;view:View}) {
  const [products,setProducts]=useState<MarketplaceProduct[]>([]); const [loading,setLoading]=useState(true);
  const [error,setError]=useState(""); const [page,setPage]=useState(0); const [hasNext,setHasNext]=useState(false); const [updated,setUpdated]=useState<string|null>(null);
  const [searchFallback,setSearchFallback]=useState(false);
  const [selected,setSelected]=useState<MarketplaceProduct|null>(null); const [revision,setRevision]=useState(0);
  const active=useRef(true); const lock=useRef(false); const sentinel=useRef<HTMLDivElement>(null);
  useEffect(() => {
    active.current=true; let alive=true;
    void browsePage(userId,connectionId,keyword,sort,1).then(data=>{
      if(!alive)return;
      if(!Array.isArray(data.products)||typeof data.hasNextPage!=="boolean") throw new Error("A Shopee não retornou uma lista válida.");
      setSearchFallback(Boolean(data.searchFallback));setProducts(data.products);setPage(1);setHasNext(data.hasNextPage);setUpdated(data.fetchedAt??null);setError("");
    }).catch(failure=>{if(alive)setError(failure instanceof Error?failure.message:"Não foi possível consultar a Shopee.");}).finally(()=>{if(alive)setLoading(false);});
    return()=>{alive=false;active.current=false;};
  },[userId,connectionId,keyword,sort,revision]);
  async function more() {
    if(lock.current || loading || !hasNext)return;lock.current=true;setLoading(true);setError("");
    try{const data=await browsePage(userId,connectionId,keyword,sort,page+1);if(!active.current)return;
      if(!Array.isArray(data.products)||typeof data.hasNextPage!=="boolean")throw new Error("A Shopee não retornou uma lista válida.");
      setSearchFallback(old=>old||Boolean(data.searchFallback));setProducts(old=>[...new Map([...old,...data.products!].map(p=>[p.id,p])).values()]);setPage(page+1);setHasNext(data.hasNextPage);setUpdated(data.fetchedAt??null);
    }catch(failure){if(active.current)setError(failure instanceof Error?failure.message:"Não foi possível carregar mais produtos.");}
    finally{lock.current=false;if(active.current)setLoading(false);}
  }
  useEffect(()=>{
    if(!sentinel.current||loading||error||!hasNext||view==="top10"||searchFallback)return;
    const observer=new IntersectionObserver(entries=>{if(entries.some(entry=>entry.isIntersecting))void more();},{rootMargin:"300px"});
    observer.observe(sentinel.current);return()=>observer.disconnect();
    // Recria a observação quando a página/estado de carregamento muda.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  },[page,loading,error,hasNext,view,searchFallback]);
  const filtered=products.filter(p=>!searchFallback || `${p.title} ${p.shop_name??""}`.toLocaleLowerCase("pt-BR").includes(keyword.toLocaleLowerCase("pt-BR"))).filter(p=>!onlyDiscounts||(p.discount_percent!==null&&Number(p.discount_percent)>0));
  const visible=view==="top10"?filtered.slice(0,10):filtered;
  return <div className="space-y-5">
    {view==="dashboard"&&<section aria-label="Resumo do catálogo" className="grid gap-3 sm:grid-cols-3">{[["Produtos carregados",products.length],["Com desconto informado",products.filter(p=>Number(p.discount_percent)>0).length],["Páginas consultadas",page]].map(([label,value])=><div key={label} className="rounded-xl border border-border bg-surface p-4"><p className="text-sm text-muted">{label}</p><p className="mt-2 text-2xl font-semibold">{value}</p></div>)}</section>}
    {(view==="trends"||view==="top10")&&<p className="text-sm text-muted">{view==="top10"?"Até dez produtos dos resultados carregados, conforme a ordenação escolhida.":"Explore o volume de vendas informado. Ainda não há medição de crescimento ao longo do tempo."}</p>}
    <p className="text-xs text-muted">Consulta automática à Shopee: {displayDate(updated)} · {products.length} produtos carregados. Preço, comissão e elegibilidade são confirmados pela plataforma.</p>
    {searchFallback&&<p role="status" className="rounded-lg border border-border bg-accent-soft p-3 text-sm">A pesquisa por palavra está temporariamente falhando na API Shopee. Exibimos os resultados que contêm “{keyword}” nas páginas carregadas. Continue carregando para ampliar a pesquisa.</p>}
    {error&&<div role="alert" className="rounded-lg bg-danger-soft p-3 text-sm text-danger">{error} <button type="button" onClick={()=>{if(page)void more();else{setLoading(true);setRevision(x=>x+1);}}} className="underline">Tentar novamente</button></div>}
    {selected&&<ProductDetails key={selected.id} product={selected} discovery={discovery} onClose={()=>setSelected(null)}/>}
    {visible.length>0&&<><p className="text-xs text-muted">{visible.length} produtos exibidos · Shopee</p><ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">{visible.map(product=><li key={product.id} className="overflow-hidden rounded-xl border border-border bg-surface">
      <div className="flex h-44 items-center justify-center bg-white p-3">{product.image_url?<Image unoptimized src={product.image_url} alt={product.title} width={240} height={160} className="h-full w-full object-contain"/>:<span className="text-sm text-slate-500">Imagem não fornecida</span>}</div>
      <div className="p-4"><h2 className="line-clamp-2 text-sm font-semibold">{product.title}</h2><p className="mt-1 truncate text-xs text-muted">{product.shop_name??"Loja não informada"}</p><p className="mt-3 text-xl font-semibold">{money(product.price_min)}</p>{product.discount_percent!==null&&Number(product.discount_percent)>0&&<p className="mt-1 text-sm font-semibold text-primary">{product.discount_percent}% de desconto informado</p>}<p className="mt-1 text-xs text-muted">Shopee · {displayDate(product.synced_at)}</p><p className="mt-1 text-xs text-muted">Comissão estimada: {percentage(product.commission_rate)}</p><p className="mt-1 text-xs text-muted">Vendas informadas: {product.sales===null?"Não informadas":Number(product.sales).toLocaleString("pt-BR")}</p><button type="button" onClick={()=>{setSelected(product);window.scrollTo({top:0,behavior:"smooth"});}} className="mt-4 w-full rounded-lg border border-border px-3 py-2 text-sm text-primary">{discovery?"Ver produto":"Ver produto e divulgar"}<span className="sr-only">: {product.title}</span></button></div>
    </li>)}</ul></>}
    {loading&&<p role="status">{page?"Carregando mais produtos da Shopee…":"Atualizando produtos da Shopee…"}</p>}
    {!loading&&!error&&!visible.length&&<p className="rounded-xl border border-dashed border-border p-5 text-sm text-muted">{onlyDiscounts?"Nenhum desconto informado nas páginas carregadas. Continue para consultar mais produtos.":searchFallback?"Nenhum produto com esse nome nas páginas carregadas. Continue carregando ou tente outra busca.":"A Shopee não retornou produtos para esta busca. Tente outro nome de produto."}</p>}
    {hasNext&&view!=="top10"&&<div ref={sentinel} className="py-3 text-center"><button type="button" disabled={loading} onClick={()=>void more()} className="rounded-lg border border-border px-4 py-2 text-sm text-primary disabled:opacity-50">{loading?"Carregando…":"Carregar mais produtos"}</button></div>}
    {!hasNext&&page>0&&!loading&&!error&&<p className="text-xs text-muted">Fim dos resultados que a API disponibilizou para esta busca. Pesquise outro produto para explorar outras ofertas.</p>}
  </div>;
}
function ProductDetails({product,onClose,discovery}:{product:MarketplaceProduct;onClose:()=>void;discovery:boolean}) {
  const [busy,setBusy]=useState(false);const [url,setUrl]=useState("");const [error,setError]=useState("");const [notice,setNotice]=useState("");
  async function generate(){if(busy)return;setBusy(true);setError("");setNotice("");try{const result=await marketplaceAction("generate_link",{productId:product.id});if(!result.url)throw new Error("Nenhum link foi retornado.");setUrl(result.url);setNotice("Link gerado e salvo. Continue na criação da divulgação abaixo."); requestAnimationFrame(()=>document.getElementById(`campaign-${product.id}`)?.scrollIntoView({behavior:"smooth",block:"start"}));}catch(err){setError(err instanceof Error?err.message:"Não foi possível gerar o link.");}finally{setBusy(false);}}
  async function copy(){try{await navigator.clipboard.writeText(url);setNotice("Link copiado.");}catch{setNotice("Selecione o link e copie manualmente.");}}
  async function share(){if(!navigator.share){await copy();return;}try{await navigator.share({title:product.title,url});}catch(err){if(!(err instanceof Error&&err.name==="AbortError"))setNotice("Não foi possível abrir o compartilhamento. Você pode copiar o link.");}}
  return <section aria-label={`Ficha de ${product.title}`} className="rounded-xl border border-primary bg-surface p-5">
    <div className="flex items-start justify-between gap-3"><h2 className="text-lg font-semibold">{product.title}</h2><button type="button" onClick={onClose} className="shrink-0 text-sm text-muted underline">Fechar ficha</button></div>
    <div className="mt-4 grid gap-5 md:grid-cols-2">{product.image_url&&<div className="rounded-lg bg-white p-4"><Image unoptimized src={product.image_url} alt={product.title} width={500} height={400} className="h-72 w-full object-contain"/></div>}
      <div><dl className="grid grid-cols-2 gap-3 text-sm">{[
        ["Plataforma","Shopee"],["Loja",product.shop_name??"Não informada"],["Preço mínimo",money(product.price_min)],["Preço máximo",money(product.price_max)],["Comissão estimada",percentage(product.commission_rate)],["Valor estimado da comissão",money(product.commission_estimate)],["Avaliação",product.rating===null?"Não informada":`${product.rating}/5`],["Desconto informado",product.discount_percent===null?"Não informado":`${product.discount_percent}%`],["Vendas informadas",product.sales===null?"Não informadas":Number(product.sales).toLocaleString("pt-BR")],["Atualizado em",displayDate(product.synced_at)]
      ].map(([label,value])=><div key={label}><dt className="text-xs text-muted">{label}</dt><dd className="mt-1 font-medium">{value}</dd></div>)}</dl>
      <p className="mt-4 text-xs text-muted">Comissão é uma estimativa da oferta, não uma venda validada. Descrição detalhada, variações, estoque e frete não são fornecidos por esta consulta. Preço final e condições são confirmados no checkout Shopee.</p>
      {!discovery&&<button type="button" disabled={busy} onClick={generate} className="mt-4 rounded-lg bg-primary px-4 py-2 text-sm text-background disabled:opacity-50">{busy?"Gerando pela API Shopee…":"Gerar e salvar meu link de afiliado"}</button>}
      {url&&<div className="mt-4 space-y-3"><label className="block text-sm">Seu link de afiliado<input readOnly value={url} onFocus={e=>e.target.select()} className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2"/></label><div className="flex flex-wrap gap-3"><button type="button" onClick={copy} className="rounded-lg border border-border px-3 py-2 text-sm">Copiar link</button><button type="button" onClick={share} className="rounded-lg border border-border px-3 py-2 text-sm">Compartilhar link</button><Link href="/afiliados" className="px-2 py-2 text-sm text-primary underline">Meus links</Link></div><p className="text-xs text-muted">Compartilhar usa as opções do seu dispositivo. Não publica automaticamente em vitrines ou redes sociais.</p></div>}
      {error&&<p role="alert" className="mt-3 text-sm text-danger">{error}</p>}{notice&&<p role="status" className="mt-3 text-sm text-primary">{notice}</p>}
      </div></div>
    <div id={`campaign-${product.id}`} className="scroll-mt-20"><ProductCampaign product={{id:product.id,title:product.title,platform:"Shopee",imageUrl:product.image_url,productUrl:product.product_url,price:product.price_min===null?undefined:money(product.price_min),owned:true}} initialAffiliateUrl={url}/></div>
  </section>;
}
