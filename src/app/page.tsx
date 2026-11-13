import type { Metadata } from "next";
import { PublicHome } from "@/components/marketing/PublicHome";

export const metadata: Metadata = {
  title: "Meu Vendedor — Produtos e divulgação de afiliados",
  description: "Organize produtos, links de afiliado e materiais de divulgação no Meu Vendedor.",
};

export default function Page() {
  return <PublicHome />;
}
