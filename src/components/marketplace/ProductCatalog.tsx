"use client";
import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useAuth } from "@/components/auth/AuthProvider";
import { getSupabase } from "@/lib/supabase/client";
import { useMarketplace } from "./MarketplaceProvider";
import { displayDate,marketplaceAction } from "@/lib/marketplace";
import type { MarketplaceProduct } from "@/types/marketplace";
const money=(value:number|null)=>value===null?"Não informado":Number(value).toLocaleString("pt-BR",{style:"currency",currency:"BRL"});
const percentage=(value:number|null)=>value===null?"Não informada":`${(Number(value)*100).toLocaleString("pt-BR",{maximumFractionDigits:2})}%`;
export function ProductCatalog({discovery=false}:{discovery?:boolean}) {
  const {user,loading}=useAuth();const state=useMarketplace();
  if(loading||state.loading)return <p role="status">Carregando suas conexões…</p>;
  if(!user)return <p><Link href="/entrar" className="text-primary underline">Entre na sua conta</Link> para consultar os produtos das plataformas conectadas.</p>;
  if(state.error)return <p role="alert">{state.error} <button onClick={state.refresh} className="text-primary underline">Tentar novamente</button></p>;
  const connection=state.connections.find(x=>x.platform_id==="shopee");
  if(!connection)return <div className="rounded-xl border border-border bg-surface p-5"><h2 className="font-semibold">Seu catálogo começa com uma conexão real</h2><p className="mt-2 text-sm text-muted">Conecte a Open API de afiliados Shopee para trazer ofertas para o Meu Vendedor. Nenhum produto demonstrativo será misturado ao catálogo.</p><Link href="/contas" className="mt-4 inline-block rounded-lg bg-primary px-4 py-2 text-sm text-background">Conectar Shopee</Link><p className="mt-4 text-xs text-muted">TikTok, Mercado Livre, Amazon e Magazine Luiza serão disponibilizados conforme integração e acesso oficiais.</p></div>;
  return <UserProducts key={`${user.id}-${connection.id}`} userId={user.id} connectionId={connection.id} lastSync={connection.last_sync_at} connectionError={Boolean(connection.last_error_code)} discovery={discovery}/>;
}
function UserProducts({userId,connectionId,lastSync,connectionError,discovery}:{userId:string;connectionId:string;lastSync:string|null;connectionError:boolean;discovery:boolean}) {
  const {refresh}=useMarketplace();const [products,setProducts]=useState<MarketplaceProduct[]>([]);
  const [loading,setLoading]=useState(true);const [busy,setBusy]=useState(false);const [error,setError]=useState("");const [notice,setNotice]=useState("");
  const [onlyDiscounts,setOnlyDiscounts]=useState(false);
  const [keyword,setKeyword]=useState("");const [sort,setSort]=useState("sales");const [selected,setSelected]=useState<MarketplaceProduct|null>(null);const [revision,setRevision]=useState(0);
  useEffect(()=>{
    let active=true;const client=getSupabase();if(!client)return;
    void client.from("mv_products").select("*").eq("user_id",userId).eq("connection_id",connectionId).eq("in_latest_sync",true).order("sales",{ascending:false,nullsFirst:false}).limit(60).then(({data,error})=>{
      if(!active)return;if(error)setError("Não foi possível carregar os produtos sincronizados.");else{setProducts(data??[]);setSelected(current=>current?(data??[]).find(p=>p.id===current.id)??null:null);setError("");}setLoading(false);
    });return()=>{active=false;};
  },[userId,connectionId,lastSync,revision]);
  async function sync() {
    if(busy)return;setBusy(true);setError("");setNotice("");
    try{const data=await marketplaceAction("sync");setNotice(`${data.productsCount??0} ofertas atualizadas.`);setSelected(null);setLoading(true);setRevision(x=>x+1);refresh();}
    catch(err){setError(err instanceof Error?err.message:"Não foi possível atualizar.");}finally{setBusy(false);}
  }
  const visible=products.filter(p=>!onlyDiscounts||(p.discount_percent!==null&&Number(p.discount_percent)>0)).filter(p=>`${p.title} ${p.shop_name??''}`.toLocaleLowerCase("pt-BR").includes(keyword.toLocaleLowerCase("pt-BR"))).sort((a,b)=>{
    const field=sort==="price"?"price_min":sort==="commission"?"commission_rate":sort==="discount"?"discount_percent":"sales";
    const av=a[field];const bv=b[field];if(av===null&&bv===null)return 0;if(av===null)return 1;if(bv===null)return -1;return sort==="price"?Number(av)-Number(bv):Number(bv)-Number(av);
  });
  return <div className="space-y-5">
    <div className="rounded-xl border border-border bg-accent-soft p-4 text-sm"><p className="font-semibold">Ofertas da sua integração Shopee</p><p className="mt-1">Até 60 ofertas disponíveis pela API, ordenadas originalmente pelas vendas informadas. Esta seleção não representa todos os produtos nem um ranking global da Shopee.</p><p className="mt-2 text-xs text-muted">Última sincronização: {displayDate(lastSync)}. Atualização automática consultada a cada 30 minutos, conforme capacidade da fila e limites da API.</p>{connectionError&&<p className="mt-2 text-danger">A última atualização falhou. Os dados exibidos podem estar desatualizados.</p>}</div>
    <div className="flex flex-wrap items-end gap-3"><label className="min-w-48 flex-1 text-sm">Pesquisar nesta seleção<input value={keyword} onChange={e=>setKeyword(e.target.value)} className="mt-1 w-full rounded-lg border border-border bg-surface px-3 py-2" placeholder="Produto ou loja"/></label><label className="text-sm">Ordenar<select value={sort} onChange={e=>setSort(e.target.value)} className="mt-1 block rounded-lg border border-border bg-surface px-3 py-2"><option value="sales">Mais vendidos nesta seleção</option><option value="discount">Maior desconto informado</option><option value="price">Menor preço</option><option value="commission">Maior comissão estimada</option></select></label><button type="button" disabled={busy} onClick={sync} className="rounded-lg bg-primary px-4 py-2 text-sm text-background disabled:opacity-50">{busy?"Consultando Shopee…":"Atualizar agora"}</button></div>
    <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={onlyDiscounts} onChange={e=>setOnlyDiscounts(e.target.checked)}/>Somente produtos com desconto informado</label>
    {error&&<p role="alert" className="rounded-lg bg-danger-soft p-3 text-sm text-danger">{error}</p>}{notice&&<p role="status" className="text-sm text-primary">{notice}</p>}
    {selected&&<ProductDetails key={selected.id} product={selected} discovery={discovery} onClose={()=>setSelected(null)}/>}
    {loading?<p role="status">Carregando ofertas…</p>:visible.length?<><p className="text-xs text-muted">{visible.length} ofertas nesta seleção · Shopee</p><ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">{visible.map(product=><li key={product.id} className="overflow-hidden rounded-xl border border-border bg-surface">
      <div className="flex h-44 items-center justify-center bg-white p-3">{product.image_url?<Image unoptimized src={product.image_url} alt={product.title} width={240} height={160} className="h-full w-full object-contain"/>:<span className="text-sm text-slate-500">Imagem não fornecida</span>}</div>
      <div className="p-4"><h2 className="line-clamp-2 text-sm font-semibold">{product.title}</h2><p className="mt-1 truncate text-xs text-muted">{product.shop_name??"Loja não informada"}</p><p className="mt-3 text-xl font-semibold">{money(product.price_min)}</p>{product.discount_percent!==null&&Number(product.discount_percent)>0&&<p className="mt-1 text-sm font-semibold text-primary">{product.discount_percent}% de desconto informado</p>}<p className="mt-1 text-xs text-muted">Shopee · {displayDate(product.synced_at)}</p><p className="mt-1 text-xs text-muted">Comissão estimada: {percentage(product.commission_rate)}</p><p className="mt-1 text-xs text-muted">Vendas informadas: {product.sales===null?"Não informadas":Number(product.sales).toLocaleString("pt-BR")}</p><button type="button" onClick={()=>{setSelected(product);window.scrollTo({top:0,behavior:"smooth"});}} className="mt-4 w-full rounded-lg border border-border px-3 py-2 text-sm text-primary">{discovery?"Ver produto":"Ver produto e divulgar"}<span className="sr-only">: {product.title}</span></button></div>
    </li>)}</ul></>:<p className="rounded-xl border border-dashed border-border p-5 text-sm text-muted">{keyword||onlyDiscounts?"Nenhuma oferta corresponde aos filtros nesta seleção.":"A API não retornou ofertas nesta sincronização. Nenhum produto foi inventado."}</p>}
  </div>;
}
function ProductDetails({product,onClose,discovery}:{product:MarketplaceProduct;onClose:()=>void;discovery:boolean}) {
  const [busy,setBusy]=useState(false);const [url,setUrl]=useState("");const [error,setError]=useState("");const [notice,setNotice]=useState("");
  async function generate(){if(busy)return;setBusy(true);setError("");setNotice("");try{const result=await marketplaceAction("generate_link",{productId:product.id});if(!result.url)throw new Error("Nenhum link foi retornado.");setUrl(result.url);setNotice("Link gerado pela Shopee e salvo em Meus links.");}catch(err){setError(err instanceof Error?err.message:"Não foi possível gerar o link.");}finally{setBusy(false);}}
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
  </section>;
}
