import type { Metadata } from "next";
import { FeaturePage } from "@/components/ui/FeaturePage";

export const metadata: Metadata = { title: "Top 10" };

export default function Page() {
  return <FeaturePage href="/top-10" />;
}
