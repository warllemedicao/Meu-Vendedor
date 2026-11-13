import type { Metadata } from "next";
import { ProductsWorkspace } from "@/components/marketplace/ProductsWorkspace";
import { PageHeader } from "@/components/ui/PageHeader";
export const metadata: Metadata = { title: "Produtos" };
export default function Page() { return <><PageHeader titulo="Produtos" descricao="Selecione uma loja para consultar produtos e preparar campanhas." /><ProductsWorkspace /></>; }
