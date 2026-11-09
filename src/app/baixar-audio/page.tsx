import type { Metadata } from "next";
import { PageHeader } from "@/components/ui/PageHeader";
import { AudioDownload } from "@/components/audio/AudioDownload";

export const metadata: Metadata = { title: "Baixar áudio MP3" };

export default function Page() {
  return (
    <>
      <PageHeader
        titulo="Baixar áudio MP3"
        descricao="Baixe um arquivo MP3 de um link direto, público e autorizado."
      />
      <AudioDownload />
    </>
  );
}
