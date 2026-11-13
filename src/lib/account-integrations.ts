export interface AccountIntegrationNote {
  name: string;
  status: string;
  completed: string;
  pending: string;
  next: string;
  href?: string;
  actionLabel?: string;
  external?: boolean;
}

export const accountIntegrationNotes: readonly AccountIntegrationNote[] = [
  {
    name: "Gemini · API do aplicativo",
    status: "Serviço do estúdio",
    completed: "O projeto integra Gemini para roteiro e opções de vídeo.",
    pending: "Credenciais, saldo e disponibilidade atuais não são consultados nesta central.",
    next: "Verificar o estado do serviço no estúdio; o login Google não transfere créditos da API.",
    href: "/videos",
    actionLabel: "Abrir estúdio",
  },
  {
    name: "Pinterest",
    status: "Publicação manual · aprovação não confirmada",
    completed: "Preparação de Pins e compartilhamento manual estão disponíveis.",
    pending: "Não há OAuth, autorização de usuário ou publicação pela API nesta versão. O histórico registra rejeição anterior do pedido do app; aprovação atual não foi verificada.",
    next: "Confirmar/solicitar nova análise do aplicativo. Enquanto isso, concluir a publicação no Pinterest.",
    href: "https://www.pinterest.com/pin-builder/",
    actionLabel: "Abrir criador de Pins",
    external: true,
  },
  {
    name: "Shopee Video",
    status: "Ação manual no aplicativo Shopee",
    completed: "O app prepara mídia e compartilhamento assistido para o fluxo de vídeo.",
    pending: "A API Shopee Affiliate e Shopee Video Management são produtos distintos. Não há publicação automática confirmada para esta conta.",
    next: "Concluir a seleção do produto e a postagem no app Shopee.",
    href: "/videos",
    actionLabel: "Preparar mídia",
  },
  {
    name: "TikTok",
    status: "Compartilhamento manual",
    completed: "O destino de compartilhamento assistido está disponível.",
    pending: "Login Kit/publicação via API, permissões e aprovação do app não estão conectados aqui.",
    next: "Usar o compartilhamento assistido; solicitar aprovação antes de habilitar publicação pela API.",
    href: "/videos",
    actionLabel: "Preparar publicação",
  },
  {
    name: "Instagram",
    status: "Compartilhamento manual",
    completed: "A preparação de mídia pode ser concluída no fluxo assistido.",
    pending: "Autorização de conta e publicação via API não estão implementadas.",
    next: "Concluir manualmente no aplicativo Instagram.",
    href: "/videos",
    actionLabel: "Preparar mídia",
  },
  {
    name: "Facebook",
    status: "Conexão OAuth disponível em Conta e conexões",
    completed: "Autorização da Página Facebook disponível em Conta e conexões → Google e redes.",
    pending: "Publicação de Reels depende das permissões Meta e validação da conexão.",
    next: "Abra Conta e conexões para conectar ou revisar a Página.",
    href: "/entrar#google",
    actionLabel: "Conectar Facebook",
  },
  {
    name: "Kwai",
    status: "Compartilhamento manual",
    completed: "Kwai aparece entre os destinos de compartilhamento e agendamento assistidos.",
    pending: "Integração oficial e autorização para publicação não estão confirmadas.",
    next: "Concluir manualmente no aplicativo Kwai.",
    href: "/videos",
    actionLabel: "Preparar mídia",
  },
  {
    name: "ElevenLabs",
    status: "Integração anterior · não usada em novas narrações",
    completed: "O inventário registra o provedor anterior; a narração atual usa Google TTS.",
    pending: "Estado da credencial e do plano não é consultado nesta central.",
    next: "Usar o provedor atual no estúdio; não cadastrar credenciais novamente sem diagnóstico.",
    href: "/videos",
    actionLabel: "Ver opções de narração",
  },
  {
    name: "Outros provedores de vídeo e voz",
    status: "Serviços do aplicativo · estado remoto não consultado",
    completed: "O inventário inclui Google TTS/Gemini, Cloudflare Workers AI, Magic Hour, 1min.ai, Replicate, Groq, OpenRouter e Kaggle.",
    pending: "Credenciais são de servidor e disponibilidade depende da configuração/cotas; esta central não verifica Secrets.",
    next: "Consultar a disponibilidade no estúdio antes de usar cada serviço.",
    href: "/videos",
    actionLabel: "Abrir estúdio",
  },
];

export const marketplaceIntegrationNotes: readonly AccountIntegrationNote[] = [
  {
    name: "TikTok Shop",
    status: "Aguardando autorização própria",
    completed: "Existe adaptador de consulta de produtos para colaboração de criadores.",
    pending: "Token de criador, mercado, escopos e aprovação do app não foram verificados; login TikTok não autoriza a loja.",
    next: "Validar elegibilidade e autorização do TikTok Shop. Links oficiais ainda podem ser usados manualmente.",
    href: "/tiktok-shop",
    actionLabel: "Ver requisitos",
  },
  {
    name: "AliExpress",
    status: "API em análise · estado de aprovação não verificado",
    completed: "Consulta de catálogo e preparação de links estão implementadas.",
    pending: "A documentação registra solicitação da Affiliate API em análise; credenciais e aprovação atuais não foram consultadas.",
    next: "Confirmar aprovação e configuração do backend; até lá, usar links oficiais manualmente.",
    href: "/aliexpress",
    actionLabel: "Ver integração",
  },
  {
    name: "SHEIN",
    status: "Links manuais · catálogo não implementado",
    completed: "A central permite preparar campanhas com links oficiais cadastrados manualmente.",
    pending: "Não foi confirmado um catálogo/API de afiliados; API de vendedor não substitui essa integração.",
    next: "Usar links oficiais ou aguardar confirmação de API de afiliados.",
    href: "/shein",
    actionLabel: "Ver opções",
  },
];
