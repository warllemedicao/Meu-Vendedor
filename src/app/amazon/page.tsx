import type { Metadata } from "next";
import { MarketplacePage } from "@/components/marketplace/MarketplacePage";

export const metadata: Metadata = { title: "Amazon" };
export default function Page() { return <MarketplacePage platform="amazon" />; }
