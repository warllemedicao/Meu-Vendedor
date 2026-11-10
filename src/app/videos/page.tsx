import type { Metadata } from "next";
import { VideoWorkspace } from "@/components/videos/VideoWorkspace";
import { PageHeader } from "@/components/ui/PageHeader";

export const metadata: Metadata = { title: "Vídeos de produto" };

export default function Page() {
  return (
    <>
      <PageHeader
        titulo="Vídeos de produto"
        descricao="Transforme fotos e clipes do seu produto em um vídeo pronto para compartilhar."
      />
      <VideoWorkspace />
    </>
  );
}
