import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Início",
  description: "Conheça o Meu Vendedor: plataforma web para pesquisar ofertas, organizar links de afiliados, preparar vídeos promocionais e gerenciar publicações.",
};

const recursos = [
  { title: "Pesquisa de produtos", description: "Consulte catálogos e ofertas conforme a disponibilidade e a autorização de cada marketplace.", href: "/produtos", link: "Explorar produtos" },
  { title: "Estúdio de vídeos", description: "Prepare roteiros, imagens e vídeos promocionais com as ferramentas disponíveis em sua conta. A geração depende do provedor e dos créditos.", href: "/videos", link: "Conhecer o estúdio" },
  { title: "Publicações", description: "Organize legendas, links e agendamentos. A publicação automática depende das integrações e permissões efetivamente habilitadas.", href: "/publicacoes", link: "Ver publicações" },
  { title: "Contas e conexões", description: "Gerencie seu acesso e as conexões autorizadas com plataformas externas, conforme os recursos implementados.", href: "/entrar#google", link: "Gerenciar conexões" },
];

export default function Home() {
  return (
    <div className="space-y-10">
      <section className="rounded-2xl border border-border bg-surface px-6 py-10 sm:px-10">
        <p className="mb-3 text-sm font-semibold text-primary">MEU VENDEDOR · PLATAFORMA WEB</p>
        <h1 className="max-w-3xl text-3xl font-bold tracking-tight sm:text-5xl">Produtos, conteúdo e divulgação em um só lugar.</h1>
        <p className="mt-5 max-w-3xl text-base leading-relaxed text-muted">O Meu Vendedor é uma aplicação web para pesquisar ofertas, organizar links de afiliados, preparar vídeos promocionais e planejar publicações em redes sociais. Reúne ferramentas para facilitar o trabalho de divulgação de produtos, respeitando as permissões e os limites de cada serviço conectado.</p>
        <div className="mt-7 flex flex-wrap gap-3">
          <Link href="/produtos" className="rounded-lg bg-primary px-5 py-3 text-sm font-semibold text-white">Explorar produtos</Link>
          <Link href="/entrar#google" className="rounded-lg border border-border px-5 py-3 text-sm font-semibold">Entrar ou conectar conta</Link>
        </div>
      </section>

      <section aria-labelledby="recursos-heading">
        <h2 id="recursos-heading" className="text-2xl font-bold">O que você pode fazer</h2>
        <div className="mt-5 grid gap-4 sm:grid-cols-2">
          {recursos.map((recurso) => (
            <article key={recurso.title} className="rounded-xl border border-border bg-surface p-5">
              <h3 className="text-lg font-semibold">{recurso.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-muted">{recurso.description}</p>
              <Link href={recurso.href} className="mt-4 inline-block text-sm font-semibold text-primary underline">{recurso.link}</Link>
            </article>
          ))}
        </div>
      </section>

      <section className="rounded-xl border border-border bg-surface p-6" aria-labelledby="sobre-heading">
        <h2 id="sobre-heading" className="text-2xl font-bold">Sobre o aplicativo</h2>
        <p className="mt-3 text-sm leading-relaxed text-muted">O Meu Vendedor é uma ferramenta de apoio à criação e organização de conteúdo de marketing de afiliados. Não é uma loja própria nem representa oficialmente TikTok, Pinterest, YouTube, Facebook ou os marketplaces exibidos. Algumas funções dependem de credenciais, aprovação das plataformas e disponibilidade dos provedores. O usuário revisa o conteúdo e decide quando compartilhá-lo.</p>
        <h3 className="mt-6 text-lg font-semibold">Privacidade e condições de uso</h3>
        <p className="mt-2 text-sm leading-relaxed text-muted">A conexão com serviços externos depende da autorização do titular da conta. Consulte os documentos públicos para saber como os dados são tratados e quais condições se aplicam ao uso do aplicativo.</p>
        <div className="mt-4 flex flex-wrap gap-5 text-sm">
          <Link href="/politica-de-privacidade" className="font-semibold text-primary underline">Política de Privacidade</Link>
          <Link href="/termos-de-servico" className="font-semibold text-primary underline">Termos de Serviço</Link>
          <a href="mailto:warllemedicao@gmail.com" className="font-semibold text-primary underline">Contato</a>
        </div>
      </section>
    </div>
  );
}
