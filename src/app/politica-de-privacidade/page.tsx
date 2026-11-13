import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Política de Privacidade",
  description: "Como o Meu Vendedor trata dados pessoais e integrações de afiliados e redes sociais.",
};

export default function PoliticaDePrivacidade() {
  return (
    <article className="mx-auto min-h-dvh max-w-3xl space-y-5 bg-background px-4 py-8 text-sm leading-relaxed text-foreground sm:px-6">
      <h1 className="text-2xl font-bold">Política de Privacidade — Meu Vendedor</h1>
      <p><strong>Última atualização:</strong> 13 de novembro de 2026.</p>
      <p>O Meu Vendedor é uma aplicação web para pesquisa de ofertas, organização de links de afiliados e preparação de conteúdos promocionais. Esta política explica quais dados podem ser tratados e para quais finalidades. O compartilhamento no Pinterest é manual: não há conexão de conta nem publicação automática de Pins pelo Meu Vendedor.</p>
      <h2 className="text-lg font-semibold">1. Dados tratados</h2>
      <p>Conforme as funções utilizadas, podemos tratar e-mail e identificador da conta, nome de perfil, preferências, informações de produtos e links de afiliados selecionados, textos, imagens, vídeos e áudios enviados ou produzidos, histórico de tarefas e registros técnicos necessários ao funcionamento e à segurança. Quando você autorizar uma integração externa, poderemos tratar identificadores de conta, permissões concedidas e credenciais de acesso emitidas pelo serviço, exclusivamente para executar as funções autorizadas.</p>
      <h2 className="text-lg font-semibold">2. Finalidades e bases legais</h2>
      <p>Os dados são utilizados para autenticar usuários, fornecer recursos solicitados, armazenar projetos e arquivos, criar conteúdo, conectar serviços autorizados, proteger a aplicação e atender solicitações de suporte. Conforme o contexto, o tratamento se fundamenta na execução do serviço solicitado, no cumprimento de obrigações legais, no legítimo interesse de segurança ou no consentimento quando exigido.</p>
      <h2 className="text-lg font-semibold">3. Pinterest e outras plataformas</h2>
      <p>Para preparar um Pin, você pode abrir o criador oficial do Pinterest com o link e a descrição escolhidos. Essa ação abre o site do Pinterest e não publica o Pin pelo Meu Vendedor. O aplicativo não recebe credenciais de acesso do Pinterest nem consulta pastas ou confirma publicações nessa plataforma. Outras integrações só tratam os dados necessários às funções efetivamente habilitadas e autorizadas. Amazon, Shopee, Mercado Livre, Google e outros serviços externos possuem políticas próprias e poderão tratar os dados recebidos conforme seus termos.</p>
      <h2 className="text-lg font-semibold">4. Compartilhamento e prestadores</h2>
      <p>Utilizamos serviços de infraestrutura, autenticação, armazenamento e processamento, incluindo Supabase e Cloudflare, além de provedores de geração ou análise de conteúdo quando a função correspondente for acionada. Os dados necessários podem ser processados por esses prestadores ou pelas plataformas que você decidir conectar. Não vendemos dados pessoais a anunciantes.</p>
      <h2 className="text-lg font-semibold">5. Armazenamento, segurança e transferências</h2>
      <p>Adotamos controles de autenticação e acesso, incluindo armazenamento privado para arquivos que exijam proteção. Nenhuma transmissão ou armazenamento é isento de riscos. Prestadores externos podem processar dados em outros países, conforme sua infraestrutura e salvaguardas aplicáveis.</p>
      <h2 className="text-lg font-semibold">6. Retenção e exclusão</h2>
      <p>Conservamos dados enquanto forem necessários ao serviço, à segurança, à resolução de solicitações ou ao cumprimento de obrigações legais. Para solicitar acesso, correção, revogação de consentimento ou exclusão de dados, envie mensagem ao contato abaixo. A exclusão pode estar sujeita a prazos técnicos e obrigações legais aplicáveis.</p>
      <h2 className="text-lg font-semibold">7. Cookies e armazenamento local</h2>
      <p>Podemos utilizar mecanismos de sessão e armazenamento local do navegador para autenticação, preferências e rascunhos. Serviços externos conectados podem empregar seus próprios cookies conforme suas políticas.</p>
      <h2 className="text-lg font-semibold">8. Conteúdo público e responsabilidade</h2>
      <p>Vídeos, imagens, descrições e links publicados por sua escolha em plataformas externas poderão ficar visíveis ao público segundo as configurações dessas plataformas. Revise as informações antes de publicar, incluindo a identificação de publicidade e de conteúdo gerado por inteligência artificial quando exigida.</p>
      <h2 className="text-lg font-semibold">9. Atualizações</h2>
      <p>Esta política poderá ser atualizada para refletir alterações nas funcionalidades e nas exigências legais. A data de atualização será exibida nesta página.</p>
      <h2 className="text-lg font-semibold">10. Contato</h2>
      <p>Para questões de privacidade e solicitações relacionadas aos seus dados, escreva para <a className="text-primary underline" href="mailto:warllemedicao@gmail.com">warllemedicao@gmail.com</a>.</p>
      <p><Link className="text-primary underline" href="/">Voltar à página inicial</Link></p>
    </article>
  );
}
