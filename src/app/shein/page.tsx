import type { Metadata } from "next";
import { MarketplacePage } from "@/components/marketplace/MarketplacePage";

export const metadata: Metadata = { title: "SHEIN" };
export default function Page() { return <MarketplacePage platform="shein" />; }
