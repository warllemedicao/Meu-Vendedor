import Link from "next/link";

const features = [
  "Explorar ofertas públicas disponíveis.",
  "Organizar links de afiliados.",
  "Preparar campanhas e materiais promocionais.",
  "Elaborar conteúdo antes de compartilhar.",
  "Acessar as ferramentas do aplicativo.",
];

const steps = [
  {
    title: "Explore produtos",
    description: "Consulte ofertas públicas disponíveis e confira as condições diretamente na loja.",
    href: "/produtos",
    link: "Explorar produtos",
  },
  {
    title: "Organize sua divulgação",
    description: "Mantenha seus links oficiais e campanhas organizados.",
    href: "/entrar",
    link: "Acessar ferramentas",
  },
  {
    title: "Prepare conteúdo promocional",
    description: "Elabore textos e materiais promocionais antes de compartilhar.",
    href: "/entrar",
    link: "Entrar ou criar conta",
  },
];

export function PublicHome() {
  return (
    <main className="min-h-dvh bg-background text-foreground">
      <header className="border-b border-border bg-surface">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4 px-4 py-4 sm:px-6">
          <Link href="/" className="text-lg font-bold tracking-tight">Meu Vendedor</Link>
          <nav aria-label="Navegação pública" className="flex flex-wrap items-center gap-4 text-sm">
            <Link href="/" aria-current="page" className="font-medium text-primary">Início</Link>
            <Link href="/produtos" className="text-muted hover:text-foreground">Produtos</Link>
            <Link href="/politica-de-privacidade" className="text-muted hover:text-foreground">Privacidade</Link>
            <Link href="/entrar" className="rounded-lg bg-primary px-4 py-2 font-medium text-background">Entrar</Link>
          </nav>
        </div>
      </header>

      <section className="mx-auto grid max-w-6xl gap-10 px-4 py-16 sm:px-6 sm:py-24 lg:grid-cols-[1.2fr_0.8fr] lg:items-center">
        <div>
          <p className="text-sm font-semibold uppercase tracking-wide text-primary">Produtos e divulgação de afiliados</p>
          <h1 className="mt-4 max-w-3xl text-4xl font-bold tracking-tight sm:text-5xl">
            Meu Vendedor — Produtos e divulgação de afiliados
          </h1>
          <p className="mt-6 max-w-2xl text-lg leading-relaxed text-muted">
            Organize seus produtos e prepare sua divulgação em um só lugar.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link href="/entrar" className="rounded-lg bg-primary px-5 py-3 font-semibold text-background">
              Entrar ou criar conta
            </Link>
            <Link href="/produtos" className="rounded-lg border border-border bg-surface px-5 py-3 font-semibold">
              Explorar produtos
            </Link>
          </div>
        </div>

        <aside aria-label="Sobre o Meu Vendedor" className="rounded-2xl border border-border bg-surface p-6 sm:p-8">
          <h2 className="text-xl font-semibold">Funcionalidades</h2>
          <ul className="mt-5 list-disc space-y-3 pl-5 text-sm leading-relaxed text-muted">
            {features.map(feature => <li key={feature}>{feature}</li>)}
          </ul>
        </aside>
      </section>

      <section className="border-y border-border bg-surface-muted">
        <div className="mx-auto max-w-6xl px-4 py-14 sm:px-6">
          <h2 className="text-2xl font-bold">Como começar</h2>
          <ol className="mt-6 grid gap-4 md:grid-cols-3">
            {steps.map((step, index) => (
              <li key={step.title} className="rounded-xl border border-border bg-surface p-5">
                <p className="text-sm font-semibold text-primary">0{index + 1}</p>
                <h3 className="mt-2 font-semibold">{step.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-muted">{step.description}</p>
                <Link href={step.href} className="mt-4 inline-block text-sm font-medium text-primary underline">
                  {step.link}
                </Link>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-14 sm:px-6">
        <h2 className="text-2xl font-bold">Informações importantes</h2>
        <ul className="mt-4 max-w-3xl list-disc space-y-3 pl-5 leading-relaxed text-muted">
          <li>Os recursos dependem das autorizações e APIs disponíveis para cada marketplace.</li>
          <li>O aplicativo não garante vendas ou comissões.</li>
          <li>O compartilhamento no Pinterest é manual: não há conexão de conta nem publicação automática de Pins.</li>
        </ul>
      </section>

      <footer className="border-t border-border bg-surface">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4 px-4 py-6 text-sm sm:px-6">
          <p className="text-muted">Meu Vendedor · Ferramentas de organização e divulgação para afiliados.</p>
          <div className="flex flex-wrap gap-4">
            <Link href="/politica-de-privacidade" className="text-primary underline">Política de Privacidade</Link>
            <a href="mailto:warllemedicao@gmail.com" className="text-primary underline">Contato</a>
          </div>
        </div>
      </footer>
    </main>
  );
}
