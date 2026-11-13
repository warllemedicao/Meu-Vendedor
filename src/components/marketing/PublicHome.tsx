import Link from "next/link";

const resources = [
  {
    title: "Explore produtos",
    description: "Consulte ofertas públicas disponíveis e confira as condições diretamente na loja.",
    href: "/produtos",
    link: "Explorar produtos",
  },
  {
    title: "Organize sua divulgação",
    description: "Prepare campanhas com seus próprios links oficiais e mantenha os materiais de divulgação organizados.",
    href: "/entrar",
    link: "Acessar ferramentas",
  },
  {
    title: "Prepare conteúdo",
    description: "Use as ferramentas disponíveis para elaborar textos e materiais promocionais antes de compartilhar.",
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
            Organize seus produtos e prepare sua divulgação em um só lugar.
          </h1>
          <p className="mt-6 max-w-2xl text-lg leading-relaxed text-muted">
            Explore ofertas públicas, organize seus próprios links de afiliado e prepare campanhas e materiais promocionais.
            Os recursos de cada loja dependem da disponibilidade da fonte e das autorizações aplicáveis.
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
          <h2 className="text-xl font-semibold">Ferramentas de apoio ao afiliado</h2>
          <ul className="mt-5 space-y-4 text-sm leading-relaxed text-muted">
            <li><strong className="text-foreground">Pesquisa:</strong> navegue pelas ofertas públicas que estiverem disponíveis.</li>
            <li><strong className="text-foreground">Organização:</strong> mantenha seus links, campanhas e materiais em um espaço próprio.</li>
            <li><strong className="text-foreground">Preparação:</strong> elabore conteúdo promocional e revise antes de compartilhar.</li>
          </ul>
        </aside>
      </section>

      <section className="border-y border-border bg-surface-muted">
        <div className="mx-auto max-w-6xl px-4 py-14 sm:px-6">
          <h2 className="text-2xl font-bold">Como começar</h2>
          <div className="mt-6 grid gap-4 md:grid-cols-3">
            {resources.map((resource, index) => (
              <article key={resource.title} className="rounded-xl border border-border bg-surface p-5">
                <p className="text-sm font-semibold text-primary">0{index + 1}</p>
                <h3 className="mt-2 font-semibold">{resource.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-muted">{resource.description}</p>
                <Link href={resource.href} className="mt-4 inline-block text-sm font-medium text-primary underline">
                  {resource.link}
                </Link>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-14 sm:px-6">
        <h2 className="text-2xl font-bold">Compartilhamento com controle do usuário</h2>
        <p className="mt-4 max-w-3xl leading-relaxed text-muted">
          O Meu Vendedor ajuda a preparar conteúdo e links. O compartilhamento e a publicação são concluídos manualmente
          na plataforma escolhida. Para o Pinterest, é possível preparar os dados e abrir o criador de Pins; não oferecemos
          conexão de conta nem publicação automática de Pins.
        </p>
        <p className="mt-3 max-w-3xl text-sm leading-relaxed text-muted">
          Preços, disponibilidade e recursos de terceiros podem mudar. Confira as informações e as regras aplicáveis
          diretamente com cada plataforma. O uso do Meu Vendedor não garante vendas, comissões ou resultados.
        </p>
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
