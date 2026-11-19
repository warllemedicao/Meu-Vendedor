import type { Metadata } from "next";
import { StoriesStudio } from "@/components/stories/StoriesStudio";
import { PageHeader } from "@/components/ui/PageHeader";

export const metadata: Metadata = { title: "Histórias · Meu Vendedor" };

export default function Page() {
  return (
    <>
      <PageHeader titulo="Histórias" descricao="Crie temas e roteiros com Gemini, mantenha personagens consistentes e prepare 12 cenas para seu filme de 2 minutos." />
      <StoriesStudio />
    </>
  );
}
