import type { Metadata } from "next";
import { MarketplacePage } from "@/components/marketplace/MarketplacePage";

export const metadata: Metadata = { title: "Mercado Livre" };
export default function Page() { return <MarketplacePage platform="mercadolivre" />; }
