import type { Metadata } from "next";
import { PageHeader } from "@/components/ui/PageHeader";
import { OpportunityCatalog } from "@/components/marketplace/OpportunityCatalog";

export const metadata: Metadata = { title: "Ofertas e produtos" };

export default function Home() {
  return <><PageHeader titulo="Encontre seu próximo produto" descricao="Descubra produtos da Shopee, Amazon e TikTok Shop, sem conectar contas de lojas." /><OpportunityCatalog /></>;
}
