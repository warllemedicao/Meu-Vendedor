import type { Metadata } from "next";
import Link from "next/link";
import { PageHeader } from "@/components/ui/PageHeader";
import { MercadoLivreCampaign } from "@/components/marketplace/MercadoLivreCampaign";
import { RemoteCatalog } from "@/components/marketplace/RemoteCatalog";
export const metadata: Metadata = { title: "Mercado Livre | Meu Vendedor" };
export default function Page() {
  return <>
    <PageHeader titulo="Mercado Livre · Divulgação de afiliados" descricao="Prepare vídeos e Pins usando o link oficial que você já consegue copiar no portal." />
    <MercadoLivreCampaign />
    <section className="mt-6 rounded-xl border border-border bg-surface p-5">
      <h2 className="font-semibold">Consulta automática · aguardando API</h2>
      <p className="mt-2 text-sm text-muted">Quando a autorização chegar, configure MERCADO_LIVRE_API no Supabase. Esta consulta usa a API de catálogo, não gera links de comissão e não substitui o link copiado no portal.</p>
      <RemoteCatalog platform="mercadolivre" />
    </section>
    <p className="mt-4 text-sm"><Link href="/configuracoes" className="text-primary underline">Voltar às configurações</Link></p>
  </>;
}
