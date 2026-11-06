# Conta, conexões e navegador Google remoto

Estado de 06/11/2026. Este documento substitui a proposta de mandar o usuário abrir o Flow para produzir manualmente. A direção do produto é preparar, gerar, revisar e divulgar dentro do Meu Vendedor.

## Mudanças entregues

- `/entrar` passa a ser **Conta e conexões**, com as áreas **Meu acesso**, **Google e redes** e **Lojas**. Há um único item correspondente no menu; `/contas` encaminha para `/entrar#lojas`, preservando endereços antigos.
- Acesso por e-mail/senha, cadastro, recuperação e saída preservados. O botão **Continuar com Google** inicia Supabase Auth OAuth com PKCE, retornando à origem do aplicativo em `/entrar`. Solicita somente `openid email profile`, sem permissões de YouTube, Drive, lojas ou acesso a Flow.
- A interface verifica a configuração pública real de Auth antes de habilitar o botão Google. Em 06/11/2026 o Supabase respondeu HTTP 200, `external.google=false`, `external.email=true`. Portanto o fluxo está implementado, mas o login Google ainda depende de ativação do provedor com credenciais OAuth do aplicativo. Não foi concluído login Google real.
- Lojas ficam em uma lista recolhida na central; abrir uma plataforma mostra controles reais e requisitos. Shopee mantém validação no backend e credenciais cifradas. As demais integrações continuam informando preparação. Não é solicitado login por senha das lojas.
- Google e redes mostram estados próprios, sem declarar conexão por inferência a partir do login do Meu Vendedor. A identidade Google vinculada é apenas uma indicação visual de `user.identities`, nunca uma regra de autorização de dados.
- Links e botões externos de Google Flow removidos do estúdio. O painel de saldos permanece abaixo de Gerar vídeo. As melhorias anteriores de áudio/player/saldos fazem parte do mesmo conjunto a versionar.

## Limite do login único

Entrar com Google identifica o usuário no Meu Vendedor. Isso não cria uma sessão web do Flow, não comprova plano/saldo, não autoriza canais YouTube e não conecta lojas. Cada serviço precisa de autorização própria, exibida na mesma central. Identidade, permissão, saldo e prontidão do adaptador são estados diferentes.

Uma futura autorização de YouTube usará consentimento incremental e persistência cifrada no backend, com escopos específicos. Não reaproveitar tokens de login como sessão de Flow. Não guardar cookies Google, refresh tokens ou senhas em campos públicos, logs, metadados editáveis de usuário ou no Git.

## Nova estratégia: geração remota integrada

Objetivo de jornada:

`Conta e conexões → autorizar serviço → escolher produto/referências → gerar no Meu Vendedor → biblioteca → selecionar destinos → publicar e acompanhar`

O navegador não precisa executar no computador do usuário. A direção escolhida é avaliar um executor Chromium em servidor, controlado por Playwright/CDP. Não é necessário instalar uma extensão no PC do usuário. O executor pode ser iniciado sob demanda; o simples login no Meu Vendedor não deve disparar geração nem manter um navegador ocioso por usuário.

Arquitetura proposta, ainda não implantada:

| Parte | Responsabilidade |
| --- | --- |
| Cloudflare atual | Frontend, API de coordenação e agendamento |
| Supabase atual | Auth, fila, estado dos trabalhos, autorizações e biblioteca privada |
| Serviço de navegador remoto | Sessão Google separada por usuário, execução do Flow, acompanhamento e captura do resultado |
| Adaptador Flow | Traduzir produto/roteiro/referências em ações; correlacionar tarefa e arquivo; registrar falhas sem reenviar geração incerta |
| Publicadores | Autorização e envio independentes para YouTube, Instagram/Facebook, TikTok e destinos efetivamente aprovados |

Cloudflare Browser Run é candidato para controle de navegador. Contêiner ou máquina virtual é alternativa se forem necessários perfil persistente e interação visual não atendidos pelo serviço gerenciado. Supabase Edge Functions e o Worker atual coordenam, mas não são, por si só, uma instalação Chromium persistente. A escolha final depende de prova técnica; não foi contratado recurso ou alterado faturamento.

## Próxima prova técnica necessária

1. Validar um navegador de servidor e a autenticação Google por fluxo permitido, com eventual intervenção do usuário quando o Google pedir. Um OAuth comum não transfere automaticamente a sessão Flow ao servidor.
2. Conferir a possibilidade de persistir e revogar a sessão com isolamento entre usuários. Proteger os dados de sessão e permitir desconexão explícita. Não contornar CAPTCHA, verificação ou restrições de conta.
3. Inspecionar as opções reais do Flow da conta; validar modelo, referências, proporção, áudio e créditos. Automação comunitária não é API oficial nem contrato estável do Google.
4. Após autorização da tarefa, gerar um único resultado, retomar o acompanhamento e importar automaticamente o arquivo privado. Verificar identidade do produto/personagem, áudio, duração e marcações aplicáveis. Timeout de submissão não autoriza nova geração automática.
5. Só então habilitar o adaptador na interface. Antes disso, mostrar **Conexão em preparação**.
6. Implementar publicação separadamente, conforme permissões e aprovações de cada rede. Conexão de afiliado não equivale a autorização de publicação social.

Nenhum executor remoto, conector Flow, sessão Google no servidor ou publicador social foi implantado nesta entrega. Isso não deve ser descrito como sincronização universal concluída.

## Ativar o botão Google existente

Falta configuração administrativa que depende de credenciais não disponíveis nesta sessão:

1. No Google Auth Platform, preparar projeto, público, marca e cliente OAuth do tipo **Web application**. Origens do aplicativo: produção `https://meu-vendedor.httpsgithubcomwarllemedicaosunshine-budget-guidegit.workers.dev` e localhost, se necessário.
2. Registrar como URI de retorno OAuth **`https://jzchlrvxdaffnrgbvabv.supabase.co/auth/v1/callback`**. Esse é o retorno ao Supabase; o retorno seguinte ao app é `/entrar`.
3. No Supabase do projeto `jzchlrvxdaffnrgbvabv`, **Authentication → Sign In / Providers → Google**, cadastrar Client ID/Secret e habilitar. O Secret pertence ao provedor Auth, não ao frontend, `NEXT_PUBLIC_*` ou chave Gemini de inferência.
4. Conferir a allowlist de retornos do app, já documentada em `supabase/config.toml`: produção `/entrar` e localhost `/entrar`. Um arquivo local não prova aplicação remota de configuração Auth.
5. Reabrir a central ou usar **Verificar novamente**. Validar login real, cancelamento, retorno PKCE, isolamento e logout. As ferramentas conectadas atuais não gerenciam provedores Auth/Google Cloud e o ambiente só contém configuração pública Supabase e token Cloudflare; não houve criação de credenciais OAuth.

## Fontes oficiais e pesquisa

- [Supabase Google OAuth](https://supabase.com/docs/guides/auth/social-sign-in/auth-google)
- [Supabase retornos](https://supabase.com/docs/guides/auth/redirect-urls)
- [Browser Run](https://developers.cloudflare.com/browser-run/get-started/)
- [Reutilização de sessões](https://developers.cloudflare.com/browser-run/features/reuse-sessions/)
- [Google OAuth policies](https://developers.google.com/identity/protocols/oauth2/policies)
- [Playwright Chromium/extensões](https://playwright.dev/docs/chrome-extensions)

Projetos comunitários pesquisados, não instalados, auditados integralmente ou adotados como dependência: [google-flow-mcp](https://github.com/miyakejima/google-flow-mcp) e [Flow-Automation](https://github.com/Yeamin-Sheikh/Flow-Automation). São evidência de abordagens existentes, não comprovação de autorização ou funcionamento com nossas contas.

## Validação e publicação

139 testes aprovados, incluindo estado real do provedor e escopos mínimos do OAuth. Lint, TypeScript frontend/Edge e exportação estática de 17 rotas aprovados. Chromium em 1440×900 e 390×844 verificou abas, acesso às lojas, redirecionamento de `/contas`, ausência de links Flow, ausência de overflow, bloqueio quando Google está desabilitado e início OAuth/PKCE simulado quando habilitado. Cancelamento OAuth tem mensagem sanitizada, sem refletir descrição bruta. Não houve login Google real ou inferência.

Supabase sincronizado com o código versionado: `video-generation` ACTIVE v31 e `video-generation-worker` ACTIVE v15, autenticação preservada, sem migração ou alteração de Secrets/configuração Auth. O aviso preexistente de proteção contra senhas vazadas permanece; tabelas internas sem políticas de cliente continuam privadas por desenho. A entrega visual é hospedada no Cloudflare; Supabase hospeda Auth, dados e Edge Functions, não o frontend Next.js estático. Frontend publicado no Worker existente na versão `8fb00466-9e35-42a4-902b-cbeffc02e56b`, com os dois crons preservados. Verificações de navegador repetidas na URL pública com respostas OAuth simuladas. O commit desta revisão inclui também os ajustes anteriores de vídeo e saldos ainda não versionados; destino do push: `origin/main`.
