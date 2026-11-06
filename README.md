# Meu Vendedor — Viral Commerce AI

> **Estado vigente — Modal e ElevenLabs, 06/11/2026:** navegador Flow sob demanda implantado no Modal e testado com abertura real, autenticação e encerramento. Falta o login Google pessoal e implementar/validar geração e importação de MP4; Flow continua indisponível para gerar. Diagnóstico ElevenLabs publicado no Supabase (funções de vídeo v38/v23); chave `ELEVENLABS_API` autenticada: plano Free, 10.000 créditos disponíveis e licença comercial não incluída. Estado e próximos passos em [GOOGLE_FLOW_E_YOUTUBE.md](./GOOGLE_FLOW_E_YOUTUBE.md) e [ELEVENLABS.md](./ELEVENLABS.md). Registros divergentes abaixo são históricos.

> **Google, Flow e YouTube — 06/11/2026:** cadastro por e-mail confirmado; OAuth Google continua desabilitado e sem Client ID/Secret nos aliases verificados. Conexão experimental Flow por navegador remoto e alternativa Gemini Omni adicionadas; login remoto e geração real Google ainda não validados. Estado vigente em [GOOGLE_FLOW_E_YOUTUBE.md](./GOOGLE_FLOW_E_YOUTUBE.md). Este registro prevalece sobre o histórico abaixo.

> **Conta e estratégia Google — 06/11/2026:** acesso e lojas centralizados em `/entrar`; fluxo OAuth Google implementado, mas provedor remoto ainda desabilitado e dependente de Client ID/Secret. Links externos do Flow removidos do estúdio. Nova direção: geração via navegador no servidor e publicação integrada, ainda não implantadas. Estado vigente e ativação em [CONTA_E_ESTRATEGIA_GOOGLE.md](./CONTA_E_ESTRATEGIA_GOOGLE.md).

> **Saldos e Google Flow — 06/11/2026:** painel aberto abaixo de Gerar vídeo com consultas oficiais e unidades distintas. Auditoria: Magic Hour 456, Runway API 0, OpenRouter US$ 0 disponível; demais saldos não verificados. Assinatura Plus do Flow não foi conectada à API. Pesquisa, limites e caminho de integração em [SALDOS_E_GOOGLE_FLOW.md](./SALDOS_E_GOOGLE_FLOW.md).

> **Primeiro vídeo confirmado e ajustes — 06/11/2026:** responsável confirmou geração com Carla/produto; banco registra uma tarefa concluída. Correções de áudio, player e saldo Magic Hour em [MAGIC_HOUR_AJUSTES.md](./MAGIC_HOUR_AJUSTES.md). Este registro substitui afirmações históricas de ausência de geração real. A fala após a correção ainda precisa ser conferida em um novo resultado.

> **Política vigente — créditos da conta, 06/11/2026:** por solicitação explícita do responsável, o runtime não exige comprovação prévia de gratuidade, orçamento local em USD ou ativação de cotas administrativas para tentar as APIs integradas. Usa saldo quando consultável e permite tentativa quando ele é desconhecido, com fallback e espera automática. O fornecedor pode cobrar conforme o plano da conta. Estado e instruções em [CREDITOS_DA_CONTA.md](./CREDITOS_DA_CONTA.md). Este registro substitui as políticas free-only e os bloqueios históricos abaixo.

> **Teste no app — 06/11/2026:** diagnóstico autenticado de cotas de imagem/vídeo adicionado ao estúdio, com atualização sem inferência. Sem cota elegível, o botão informa “Salvar pedido na fila”; não indica geração imediata. Nenhuma geração real foi enviada nesta revisão, nenhum teste de API foi concluído e nenhuma cota foi ativada. Guia e impedimentos atuais em [TESTE_NO_APP.md](./TESTE_NO_APP.md). Este registro prevalece sobre instruções históricas abaixo.

> **Auditoria atual — 06/11/2026:** token Cloudflare Billing Read validado; falha real do cron corrigida e execução autenticada confirmada. Auditoria privada e horária das contas implantada. Magic Hour informou plano free e 500 créditos agregados; as franquias gratuitas de imagem/vídeo e o bloqueio de cobrança ainda precisam de comprovação. Nenhum vídeo real foi gerado. Estado completo e pendências em [AUDITORIA_IA.md](./AUDITORIA_IA.md); este registro prevalece sobre estados e versões históricos abaixo.

> **Política vigente — somente gratuito, 06/11/2026:** modo `free-only` implementado e publicado no Supabase, sem teto diário de pedidos do aplicativo. Fallback automático entre opções compatíveis, reservas atômicas de cotas gratuitas, espera/retomada com etapas preservadas e renovação apenas de franquias periódicas comprovadas. Rotas pagas ou desconhecidas são bloqueadas. As cotas de imagem/vídeo ainda não têm comprovação de gratuidade registrada; pedidos podem aguardar por isso. Instruções e limites reais em [MODO_GRATUITO.md](./MODO_GRATUITO.md). Este bloco substitui as instruções históricas de ativar geração paga abaixo.

> **Atualização do estúdio — 06/11/2026:** interface em três áreas e etapas; fallback de roteiro Gemini/Groq/OpenRouter; correções de retomada, finalização e fallback de vídeo; cache privado de referências/composição e capacidade técnica acima de 15 entregas/dia. Migração `20261106022136_video_production_cache.sql` aplicada ao Supabase. Runtime confirmou credenciais dos serviços, mas flags de geração, allowlist, limites e conversão Magic Hour estão ausentes/desligados. Geração real ainda não foi executada. Pendências exatas e estado atual em [VIDEOS_IA.md](./VIDEOS_IA.md). Este bloco prevalece sobre o histórico abaixo.

> **Revisão autenticada — 06/11/2026:** Supabase conectado e revalidado nesta sessão: 15 tabelas com RLS, cinco funções ativas e seis migrações aplicadas. A nova migração corrige oito índices ausentes; advisor não aponta mais chaves estrangeiras sem índice. O catálogo real ainda retorna `catalog_not_configured`, inclusive Shopee. Cadastro/login e organização de links estão implementados; catálogo, e-mails e vídeos reais ainda têm dependências externas. Estado atual e instruções em [CONTINUAR_AMANHA.md](./CONTINUAR_AMANHA.md). Este bloco prevalece sobre os registros anteriores de falta de acesso ou versões históricas abaixo.

App web de gerenciamento de afiliados com **Shopee, TikTok, Mercado Livre, Amazon e Magazine Luiza**.
O usuário acessa os portais oficiais das lojas para entrar ou conhecer a afiliação, e pode organizar seus links na sua conta do Meu Vendedor.

**Estado verificado em 06/11/2026:** o Worker `meu-vendedor` está na versão `0f4bd14d-0c3d-48cd-88a9-734e5ce19736`; `/videos` responde HTTP 200. Os crons remoto de vídeo (`* * * * *`) e marketplace (`*/30 * * * *`) estão configurados. A consulta de invocações agendadas não retornou registros desde a publicação, portanto a execução periódica ainda não está comprovada. A última validação remota registrada do Supabase aceitou o segredo do worker, mas retornou `processor_disabled`; nesta revisão não foi possível revalidar as configurações Supabase. Nenhuma geração real foi executada e nenhum crédito foi consumido. Consulte [CONTINUAR_AMANHA.md](./CONTINUAR_AMANHA.md) e [VIDEOS_IA.md](./VIDEOS_IA.md) antes de qualquer ativação.

## Documentos

- [CATALOGO_APIS.md](./CATALOGO_APIS.md): pesquisa das sete fontes e pendências do catálogo inicial.
- [ARQUITETURA.md](./ARQUITETURA.md): intenção do produto, arquitetura e histórico.
- [ESCOPO.md](./ESCOPO.md): páginas e sequência de desenvolvimento.
- [SUPABASE.md](./SUPABASE.md): banco, autenticação, políticas e ativação.
- [CONECTORES.md](./CONECTORES.md): conector Shopee, segurança, limites e pendências por plataforma.
- [INTEGRACOES.md](./INTEGRACOES.md): requisitos das plataformas.
- [VIDEOS_IA.md](./VIDEOS_IA.md): pipeline assíncrono, provedores, proteções e pendências da geração real.
- [CLOUDFLARE.md](./CLOUDFLARE.md) e [PUBLICACAO.md](./PUBLICACAO.md): hospedagem e verificações.

## O que está implementado no código

- Vitrine inicial pública de Shopee, Amazon e TikTok Shop, sem exigir login ou conexão de lojas. A função `catalog-public` está publicada, mas as três fontes centrais ainda estão sem configuração e não retornam produtos reais. Consultas privadas de outras plataformas continuam separadas. Detalhes em `CATALOGO_APIS.md`.
- Navegação responsiva e tema claro/escuro.
- Catálogo das cinco plataformas; conexão Shopee por credenciais oficiais, sem sucesso simulado.
- Produtos sincronizados com ficha, comissão estimada e geração/compartilhamento de link pela API Shopee, quando a conta possui acesso válido.
- Cadastro, login e recuperação da senha do próprio Meu Vendedor via Supabase Auth.
- Perfil com nome de exibição.
- Gerenciamento de links manuais: criar, listar, editar, excluir e filtrar por plataforma, com campanha e observações.
- Estúdio de vídeos com fila privada, presets, roteiros, acompanhamento, reprodução e download. O pipeline assíncrono Cloudflare Workers AI + Magic Hour/Replicate e seu fallback estão implementados e cobertos por testes simulados; não há validação comercial real nem autorização de geração. Demonstrações continuam claramente identificadas como sem IA.
- Migração PostgreSQL e RLS para isolamento dos dados por usuário.
- Estado informativo quando Supabase não estiver configurado, sem apresentar operações falsas.

Cinco migrações versionadas existem no repositório; as últimas migrações do fluxo de vídeos constam como aplicadas nos registros remotos anteriores, mas não foram revalidadas nesta sessão. Em outros ambientes, as telas de autenticação e persistência só ficam disponíveis após fornecer a configuração Supabase e aplicar as migrações na ordem registrada.

## Tecnologias

Next.js 16, React 19, TypeScript, Tailwind CSS 4, Supabase JS, PostgreSQL/RLS, ESLint e testes Node.js com PGlite. O frontend atual pode ser exportado como estático; Auth e Data API são fornecidos pelo Supabase. FastAPI permanece opcional para futuras operações especializadas.

## Executar

Requisitos: Node.js 24 (declarado em `.node-version`) e npm.

```bash
npm ci
npm run dev
```

Para ativar Auth e banco, aplicar a migração e configurar o projeto correto conforme `SUPABASE.md`. Depois, copiar `.env.example` para `.env.local` e preencher somente `NEXT_PUBLIC_SUPABASE_URL` e `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`.

Sem essas variáveis, é possível explorar o catálogo e o dashboard; a interface informa que o acesso de usuários está em preparação. O build rejeita configuração parcial, URL inválida e chaves administrativas em variáveis públicas.

## Verificações e publicação

```bash
npm test                 # catálogo, validação e PostgreSQL/RLS local
npm run lint
npm run typecheck
npm run typecheck:edge    # backend Supabase e agendador Cloudflare
npm run build:pages      # exportação estática com Webpack; saída out/
npm run build            # build Next.js normal
npm run start            # serve o build normal (não a exportação estática)
npm run deploy:cloudflare # gera a exportação e publica com Wrangler autorizado
```

O build padrão com Turbopack encontrou restrições deste ambiente em verificações anteriores. O comando estático usa Webpack. Na verificação de 06/11/2026, 89 testes, lint, TypeScript do frontend e das Edge Functions e o build estático de 17 rotas foram aprovados. Esses testes não comprovam execução comercial dos provedores nem do cron em produção.

## Segurança

Nunca commitar senha, `service_role`, `sb_secret_*`, token de gerenciamento ou credenciais das lojas. RLS e permissões do banco são a barreira de acesso aos dados. O navegador recebe somente configuração pública e sua sessão de usuário do Meu Vendedor, gerida pelo SDK. Credenciais administrativas não são usadas no frontend.

## Próximas etapas

Validar a entrega de e-mails de confirmação e recuperação e configurar SMTP próprio quando necessário. Para ativar a geração real de vídeos, confirmar a licença comercial aplicável, os créditos/saldo de cada provedor e os limites máximos por tarefa e por dia; não basta possuir uma API key. Evoluir cada integração de loja somente conforme disponibilidade oficial e autorização específica, sem presumir suporte universal.

## Conectar a Shopee

Entre no app, abra Contas Conectadas e use Conectar Shopee. Informe App ID e Secret da Open API oficial, não a senha da loja. O backend valida antes de registrar a conexão. Produtos fica vazio até haver uma sincronização autorizada. Não envie credenciais pelo chat. Consulte `CONECTORES.md` antes de operar ou rotacionar segredos.
