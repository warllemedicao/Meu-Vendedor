import type { Metadata } from "next";
import { ProductCatalog } from "@/components/marketplace/ProductCatalog";
import { PageHeader } from "@/components/ui/PageHeader";
export const metadata: Metadata = { title: "Produtos" };
export default function Page(){return <><PageHeader titulo="Produtos" descricao="Consulte ofertas das contas conectadas, analise o produto e gere seu link de afiliado."/><ProductCatalog/></>;}
