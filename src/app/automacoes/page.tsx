import type { Metadata } from "next";
import { FeaturePage } from "@/components/ui/FeaturePage";

export const metadata: Metadata = { title: "Automações" };

export default function Page() {
  return <FeaturePage href="/automacoes" />;
}
