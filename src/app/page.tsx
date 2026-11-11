import type { Metadata } from "next";
import { PageHeader } from "@/components/ui/PageHeader";
import { CommerceHub } from "@/components/marketplace/CommerceHub";
import { MarketplaceDirectory } from "@/components/marketplace/MarketplaceDirectory";

export const metadata: Metadata = { title: "Ofertas e produtos" };

export default function Home() {
  return <><PageHeader titulo="Encontre seu próximo produto" descricao="Explore ofertas, acompanhe seu catálogo e prepare sua divulgação em um só lugar." /><MarketplaceDirectory /><CommerceHub /></>;
}
