import type { Metadata } from "next";
import { AffiliateLinks } from "@/components/affiliates/AffiliateLinks";
import { PageHeader } from "@/components/ui/PageHeader";
export const metadata: Metadata = { title: "Meus links" };
export default function Page() {
  return <><PageHeader titulo="Meus links de afiliado" descricao="Organize seus links por plataforma e campanha na sua conta."/><AffiliateLinks/></>;
}
