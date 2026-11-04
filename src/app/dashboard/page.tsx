import { FlaskConical } from "lucide-react";
import type { Metadata } from "next";
import { FeaturedProducts } from "@/components/dashboard/FeaturedProducts";
import { IntegrationStatus } from "@/components/dashboard/IntegrationStatus";
import { RecentActivity } from "@/components/dashboard/RecentActivity";
import { StatCard } from "@/components/dashboard/StatCard";
import { Top10List } from "@/components/dashboard/Top10List";
import { PageHeader } from "@/components/ui/PageHeader";
import { demoActivities, demoFeatured, demoStats, demoTop10, integrations } from "@/lib/demo-data";

export const metadata: Metadata = { title: "Dashboard" };

export default function DashboardPage() {
  return (
    <>
      <PageHeader titulo="Dashboard" descricao="Visão geral da operação de afiliados." />

      <div className="mb-6 flex items-start gap-3 rounded-xl border border-border bg-accent-soft p-4">
        <FlaskConical className="mt-0.5 size-5 shrink-0 text-accent" aria-hidden />
        <p className="text-sm">
          <strong className="font-semibold">Dados demonstrativos.</strong> Todos os números e produtos desta página são
          fictícios e servem só para mostrar o layout. Nenhuma plataforma está conectada.
        </p>
      </div>

      <section aria-label="Indicadores de exemplo" className="grid grid-cols-2 gap-3 lg:grid-cols-3 xl:grid-cols-6">
        {demoStats.map((s) => (
          <StatCard key={s.rotulo} stat={s} />
        ))}
      </section>

      <div className="mt-6 grid gap-4 lg:grid-cols-5">
        <div className="lg:col-span-3">
          <Top10List produtos={demoTop10} />
        </div>
        <div className="space-y-4 lg:col-span-2">
          <IntegrationStatus integracoes={integrations} />
          <RecentActivity atividades={demoActivities} />
        </div>
      </div>

      <div className="mt-4">
        <FeaturedProducts produtos={demoFeatured} />
      </div>
    </>
  );
}
