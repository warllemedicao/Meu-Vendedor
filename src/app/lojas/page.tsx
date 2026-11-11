import type { Metadata } from "next";
import { MarketplaceDirectory } from "@/components/marketplace/MarketplaceDirectory";
import { PageHeader } from "@/components/ui/PageHeader";
export const metadata: Metadata = { title: "Marketplaces / Lojas" };
export default function Page() { return <><PageHeader titulo="Marketplaces / Lojas" descricao="Catálogos, links oficiais, vídeos e divulgação em um só lugar." /><MarketplaceDirectory /></>; }
