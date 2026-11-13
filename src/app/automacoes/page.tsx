import type { Metadata } from "next";
import { AutomationWorkspace } from "@/components/automations/AutomationWorkspace";
import { PageHeader } from "@/components/ui/PageHeader";

export const metadata: Metadata = { title: "Automações" };

export default function Page() {
  return <>
    <PageHeader titulo="Automações" descricao="Acompanhe as rotinas disponíveis e execute sincronizações autorizadas." />
    <AutomationWorkspace />
  </>;
}
