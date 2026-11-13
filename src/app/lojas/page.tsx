import type { Metadata } from "next";
import { ProductsWorkspace } from "@/components/marketplace/ProductsWorkspace";
import { PageHeader } from "@/components/ui/PageHeader";
export const metadata: Metadata = { title: "Marketplaces / Lojas" };
export default function Page() { return <><PageHeader titulo="Marketplaces / Lojas" descricao="Escolha uma loja para consultar seus recursos e preparar campanhas." /><ProductsWorkspace /></>; }
