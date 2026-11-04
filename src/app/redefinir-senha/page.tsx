import { ResetPasswordForm } from "@/components/auth/ResetPasswordForm";
import { PageHeader } from "@/components/ui/PageHeader";
export const metadata = { title: "Redefinir senha" };
export default function Page() {return <><PageHeader titulo="Redefinir senha" descricao="Escolha uma nova senha para o Meu Vendedor."/><ResetPasswordForm/></>;}
