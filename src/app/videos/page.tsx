import type { Metadata } from "next";
import { VideoStudio } from "@/components/videos/VideoStudio";
import { PageHeader } from "@/components/ui/PageHeader";

export const metadata: Metadata = { title: "Estúdio de histórias" };

export default function Page() {
  return (
    <>
      <PageHeader
        titulo="Estúdio de histórias"
        descricao="Crie uma historinha com um personagem de fruta e leve o prompt ao Google Flow para gerar o vídeo."
      />
      <VideoStudio />
    </>
  );
}
