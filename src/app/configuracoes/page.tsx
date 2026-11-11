import type { Metadata } from "next";
import Link from "next/link";
import { ProfileForm } from "@/components/auth/ProfileForm";
import { PageHeader } from "@/components/ui/PageHeader";

export const metadata: Metadata = { title: "Configurações" };

export default function Page() {
  return (
    <>
      <PageHeader titulo="Configurações" descricao="Gerencie seu perfil e consulte informações sobre privacidade no Meu Vendedor." />
      <ProfileForm />
      <section className="mt-6 max-w-lg rounded-xl border border-border bg-surface p-5">
        <h2 className="font-semibold">Privacidade e dados pessoais</h2>
        <p className="mt-2 text-sm text-muted">Saiba como os dados e as integrações externas são tratados e como solicitar a exclusão de informações.</p>
        <Link href="/politica-de-privacidade" className="mt-3 inline-block text-sm text-primary underline">
          Ler Política de Privacidade
        </Link>
      </section>
    </>
  );
}
