import type { Metadata } from "next";
import { ProfileForm } from "@/components/auth/ProfileForm";
import { PageHeader } from "@/components/ui/PageHeader";
export const metadata: Metadata = { title: "Configurações" };
export default function Page() { return <><PageHeader titulo="Configurações" descricao="Gerencie seu perfil no Meu Vendedor."/><ProfileForm/></>; }
