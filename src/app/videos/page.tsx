import type { Metadata } from "next";
import { FeaturePage } from "@/components/ui/FeaturePage";

export const metadata: Metadata = { title: "Vídeos IA" };

export default function Page() {
  return <FeaturePage href="/videos" />;
}
