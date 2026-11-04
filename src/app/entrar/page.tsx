import { AuthForm } from "@/components/auth/AuthForm";
import { PageHeader } from "@/components/ui/PageHeader";
export const metadata = { title: "Minha conta" };
export default function Page() {
  return <><PageHeader titulo="Minha conta" descricao="Entre para guardar e organizar seus links de afiliado."/><AuthForm/></>;
}
