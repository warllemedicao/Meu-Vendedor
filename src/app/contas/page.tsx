import type { Metadata } from "next";
import { FeaturePage } from "@/components/ui/FeaturePage";

export const metadata: Metadata = { title: "Contas Conectadas" };

export default function Page() {
  return <FeaturePage href="/contas" />;
}
