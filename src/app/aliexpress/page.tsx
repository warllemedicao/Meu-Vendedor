import type { Metadata } from "next";
import Link from "next/link";
import { PageHeader } from "@/components/ui/PageHeader";
import { RemoteCatalog } from "@/components/marketplace/RemoteCatalog";

export const metadata: Metadata = { title: "AliExpress | Meu Vendedor" };

export default function AliExpressPage() {
  return <>
    <PageHeader titulo="AliExpress · Catálogo de afiliados" descricao="Consulta preparada. Disponível somente após aprovação e configuração da API oficial." />
    <section className="mb-5 rounded-xl border border-border bg-surface p-5">
      <h2 className="font-semibold">Integração aguardando credenciais</h2>
      <p className="mt-2 text-sm text-muted">O cadastro de afiliado está em análise. Após aprovação, um administrador poderá configurar o Secret ALIEXPRESS_API no Supabase, vinculando o UUID da conta autorizada. Nunca informe App Secret nesta página, no GitHub ou em mensagens.</p>
      <p className="mt-2 text-sm text-muted">Esta tela consulta produtos reais somente quando a API estiver autorizada. Links de comissão e publicação automática ainda dependem de implementação e validação próprias; a URL do produto não comprova atribuição de comissão.</p>
      <Link href="/configuracoes" className="mt-3 inline-block text-sm text-primary underline">Voltar às configurações</Link>
    </section>
    <RemoteCatalog platform="aliexpress" />
  </>;
}
