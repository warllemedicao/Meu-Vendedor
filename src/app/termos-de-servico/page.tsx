import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Termos de Serviço",
  description: "Condições de utilização do aplicativo web Meu Vendedor.",
};

export default function TermosDeServico() {
  return (
    <article className="mx-auto max-w-3xl space-y-5 text-sm leading-relaxed">
      <h1 className="text-2xl font-bold">Termos de Serviço — Meu Vendedor</h1>
      <p><strong>Última atualização:</strong> 13 de novembro de 2026.</p>
      <p>Estes termos descrevem as condições de uso do Meu Vendedor, aplicação web destinada a apoiar pesquisa de ofertas, organização de links de afiliados, preparação de conteúdos promocionais e planejamento de publicações.</p>
      <h2 className="text-lg font-semibold">1. Finalidade e disponibilidade</h2>
      <p>O aplicativo disponibiliza recursos conforme a configuração técnica, a disponibilidade dos provedores e as permissões concedidas. Funcionalidades em desenvolvimento, como determinadas conexões ou publicações automáticas, não são garantidas nem devem ser consideradas disponíveis até sua efetiva habilitação.</p>
      <h2 className="text-lg font-semibold">2. Contas e autorizações</h2>
      <p>O usuário é responsável por manter sua conta protegida e por conectar apenas perfis sobre os quais possua autorização. Integrações com serviços externos podem exigir consentimento, credenciais, análise do aplicativo e permissões específicas. O usuário poderá revogar permissões nos serviços correspondentes.</p>
      <h2 className="text-lg font-semibold">3. Conteúdo e responsabilidade</h2>
      <p>O usuário deve revisar vídeos, imagens, legendas, ofertas e links antes de divulgar. Não deve publicar conteúdo ilegal, enganoso, que viole direitos de terceiros ou as regras das plataformas. Informações sobre preços, estoque, descontos, comissões e disponibilidade podem mudar e devem ser verificadas na origem.</p>
      <h2 className="text-lg font-semibold">4. Plataformas e provedores externos</h2>
      <p>O Meu Vendedor não é afiliado oficialmente às redes sociais e marketplaces citados, salvo quando houver indicação expressa. O uso de serviços de terceiros está sujeito aos termos, políticas, permissões, limites técnicos e eventuais custos desses serviços. A autorização de login não implica autorização de publicação automática.</p>
      <h2 className="text-lg font-semibold">5. Dados e privacidade</h2>
      <p>O tratamento de informações pessoais e de dados de integrações é descrito na <Link href="/politica-de-privacidade" className="text-primary underline">Política de Privacidade</Link>. O usuário deve evitar enviar informações confidenciais desnecessárias e proteger suas credenciais.</p>
      <h2 className="text-lg font-semibold">6. Alterações e interrupções</h2>
      <p>Recursos podem ser alterados, suspensos ou removidos por motivos técnicos, de segurança, de conformidade ou por mudanças nos serviços integrados. Não há garantia de disponibilidade contínua nem de resultados comerciais ou de desempenho dos conteúdos.</p>
      <h2 className="text-lg font-semibold">7. Contato</h2>
      <p>Para dúvidas sobre estes termos, escreva para <a href="mailto:warllemedicao@gmail.com" className="text-primary underline">warllemedicao@gmail.com</a>.</p>
      <p><Link href="/" className="text-primary underline">Voltar à página inicial</Link></p>
    </article>
  );
}
