import Link from "next/link";
import { PageHeader } from "@/components/ui/PageHeader";
import { marketplaceById, type ManualMarketplaceId } from "@/lib/marketplace-directory";
import { ManualMarketplaceCampaign } from "./ManualMarketplaceCampaign";
import { RemoteCatalog } from "./RemoteCatalog";
import { CommerceHub } from "./CommerceHub";

export function MarketplacePage({ platform }: { platform: ManualMarketplaceId }) {
  const item = marketplaceById(platform);
  return <>
    <PageHeader titulo={`${item.name} · Divulgação de afiliados`} descricao={item.description} />
    <p className="mb-4 text-sm text-primary">{item.status}</p>
    <ManualMarketplaceCampaign platform={platform} />
    <section className="mt-6 space-y-3 rounded-xl border border-border bg-surface p-5">
      <h2 className="font-semibold">Catálogo e consulta automática</h2>
      <p className="text-sm text-muted">{platform === "shopee" ? "O catálogo existente e a conexão Shopee continuam na área de ofertas. Entre na conta para acessar seus produtos e gerar links autorizados." : platform === "magalu" || platform === "shein" ? "Catálogo automático de afiliados ainda não implementado para esta loja. O formulário manual acima funciona independentemente da API." : "A consulta depende de credenciais oficiais vinculadas à sua conta e das permissões da plataforma. Credenciais configuradas não significam acesso aprovado. Entre para consultar a disponibilidade; o fluxo manual acima não depende desta consulta."}</p>
      {platform === "aliexpress" && <p className="text-sm text-muted">Affiliate API: Under Review. A consulta e a geração oficial de links só ficam disponíveis após aprovação, configuração e validação. Nunca envie App Secret pelo formulário de divulgação.</p>}
      {item.catalog && item.catalog !== "magalu" && item.catalog !== "shein" && <RemoteCatalog platform={item.catalog} />}
      {platform === "shopee" && <CommerceHub />}
      <Link href="/entrar" className="inline-block text-sm text-primary underline">Conta e conexões</Link>
    </section>
    <Link href="/lojas" className="mt-5 inline-block text-sm text-primary underline">Ver todos os marketplaces</Link>
  </>;
}
