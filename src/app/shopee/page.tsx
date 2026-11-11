import type { Metadata } from "next";
import { MarketplacePage } from "@/components/marketplace/MarketplacePage";

export const metadata: Metadata = { title: "Shopee" };
export default function Page() { return <MarketplacePage platform="shopee" />; }
