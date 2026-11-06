import type { Metadata } from "next";
import { VideoStudio } from "@/components/videos/VideoStudio";
import { PageHeader } from "@/components/ui/PageHeader";

export const metadata: Metadata = { title: "Gerador de vídeos IA" };

export default function Page() {
  return (
    <>
      <PageHeader
        titulo="Gerador de vídeos IA"
        descricao="Crie seu anúncio em etapas e acompanhe a produção até o vídeo final."
      />
      <VideoStudio />
    </>
  );
}
