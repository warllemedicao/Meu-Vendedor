import type { Metadata } from "next";
import { VideoStudio } from "@/components/videos/VideoStudio";
import { PageHeader } from "@/components/ui/PageHeader";

export const metadata: Metadata = { title: "Gerador de vídeos IA" };

export default function Page() {
  return (
    <>
      <PageHeader
        titulo="Gerador de vídeos IA"
        descricao="Prepare anúncios com produto, apresentador virtual, voz, roteiro e formato — sem consumir créditos no modo demonstração."
      />
      <VideoStudio />
    </>
  );
}
