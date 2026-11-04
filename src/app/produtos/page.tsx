import type { Metadata } from "next";
import { FeaturePage } from "@/components/ui/FeaturePage";

export const metadata: Metadata = { title: "Produtos" };

export default function Page() {
  return <FeaturePage href="/produtos" />;
}
