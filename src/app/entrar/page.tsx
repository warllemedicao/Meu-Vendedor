import { AccountHub } from "@/components/auth/AccountHub";
import { PageHeader } from "@/components/ui/PageHeader";
export const metadata = { title: "Conta e conexões" };
export default function Page() {
  return <><PageHeader titulo="Conta e conexões" descricao="Seu acesso, serviços Google, redes sociais e lojas em um só lugar."/><AccountHub/></>;
}
