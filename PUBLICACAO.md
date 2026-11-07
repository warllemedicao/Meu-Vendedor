# Publicações — Meu Vendedor

> **Estúdio corrigido — 07/11/2026:** frontend/Worker publicado na versão `a1a5dd36-76b7-4954-99f6-d9d5f5b72b90`; `video-generation` v44. Botão Gerar vídeo valida ao clicar e reconsulta disponibilidade, com travas de concorrência, idempotência e limites de espera. ElevenLabs ao lado de Característica da voz; navegador Flow removido da central e opção pendente mantida no seletor. Nova chave Gemini aceita pelo catálogo e modelos consultados, sem inferência. 178 testes aprovados, lint, TypeScript frontend/Edge e build das 17 rotas aprovados. Estado e limites em [AJUSTES_ESTUDIO.md](./AJUSTES_ESTUDIO.md).

## Histórico das entregas anteriores

Registros anteriores à confirmação do canal conectado e à nova chave Gemini são mantidos abaixo como histórico. O estado vigente está em CONTINUAR_AMANHA.md.

> **Conexão oficial YouTube — 06/11/2026:** login Google confirmado pelo responsável; provedor Auth habilitado. Client ID/Secret do projeto `meu-vendedor-1987` encontrados no backend sem exposição de valores. Função `youtube-connection` v2 e controles de conectar/verificar/desconectar adicionados, com tokens cifrados, state/cookie/PKCE e isolamento por usuário. Falta confirmar o segundo URI de retorno no cliente Google e concluir o consentimento real; nenhuma conta/canal ou upload foi apresentado como sincronizado. Publicação de vídeos permanece pendente. Estado vigente e próximo passo em [YOUTUBE_CONEXAO.md](./YOUTUBE_CONEXAO.md).

> **Publicação de áudio e disponibilidade — 06/11/2026:** Cloudflare `0567935e-70cd-4a8c-b10f-251f52f56674`; Supabase `audio-generation` v2 e `video-generation` v39. Worker de vídeo v23 e crons preservados. Migração `20261106224146_elevenlabs_audio.sql` reconciliada com o remoto. 165 testes, lint, TypeScript frontend/Edge e build estático das 17 rotas aprovados. O último build precisou sair do sandbox pelo erro de captura `--showConfig` já registrado. Chromium verificou a URL publicada em desktop/celular com respostas de conta controladas, sem overflow e com ferramentas de vídeo preservadas após atualização 503. Teste separado da API ElevenLabs produziu MP3 real de 59.811 bytes; áudio decodificado e composição local de vídeo com faixa de áudio validados. OAuth Google ainda desabilitado; nenhum login pessoal ou nova geração de vídeo foi realizado. Ver [ELEVENLABS.md](./ELEVENLABS.md) e [GOOGLE_OAUTH_SETUP.md](./GOOGLE_OAUTH_SETUP.md).

> **Estado vigente — Modal e ElevenLabs, 06/11/2026:** navegador Flow sob demanda implantado no Modal e testado com abertura real, autenticação e encerramento. Falta o login Google pessoal e implementar/validar geração e importação de MP4; Flow continua indisponível para gerar. Diagnóstico ElevenLabs publicado no Supabase (funções de vídeo v38/v23); chave `ELEVENLABS_API` autenticada: plano Free, 10.000 créditos disponíveis e licença comercial não incluída. Estado e próximos passos em [GOOGLE_FLOW_E_YOUTUBE.md](./GOOGLE_FLOW_E_YOUTUBE.md) e [ELEVENLABS.md](./ELEVENLABS.md). Registros divergentes abaixo são históricos.

> **Google, Flow e YouTube — 06/11/2026:** cadastro por e-mail confirmado; OAuth Google continua desabilitado e sem Client ID/Secret nos aliases verificados. Conexão experimental Flow por navegador remoto e alternativa Gemini Omni adicionadas; login remoto e geração real Google ainda não validados. Estado vigente em [GOOGLE_FLOW_E_YOUTUBE.md](./GOOGLE_FLOW_E_YOUTUBE.md). Este registro prevalece sobre o histórico abaixo.

> **Conta e estratégia Google — 06/11/2026:** acesso e lojas centralizados em `/entrar`; fluxo OAuth Google implementado, mas provedor remoto ainda desabilitado e dependente de Client ID/Secret. Links externos do Flow removidos do estúdio. Nova direção: geração via navegador no servidor e publicação integrada, ainda não implantadas. Estado vigente e ativação em [CONTA_E_ESTRATEGIA_GOOGLE.md](./CONTA_E_ESTRATEGIA_GOOGLE.md).

> **Política vigente — créditos da conta, 06/11/2026:** por solicitação explícita do responsável, o runtime não exige comprovação prévia de gratuidade, orçamento local em USD ou ativação de cotas administrativas para tentar as APIs integradas. Usa saldo quando consultável e permite tentativa quando ele é desconhecido, com fallback e espera automática. O fornecedor pode cobrar conforme o plano da conta. Estado e instruções em [CREDITOS_DA_CONTA.md](./CREDITOS_DA_CONTA.md). Este registro substitui as políticas free-only e os bloqueios históricos abaixo.

> **Teste no app — 06/11/2026:** diagnóstico autenticado de cotas de imagem/vídeo adicionado ao estúdio, com atualização sem inferência. Sem cota elegível, o botão informa “Salvar pedido na fila”; não indica geração imediata. Nenhuma geração real foi enviada nesta revisão, nenhum teste de API foi concluído e nenhuma cota foi ativada. Guia e impedimentos atuais em [TESTE_NO_APP.md](./TESTE_NO_APP.md). Este registro prevalece sobre instruções históricas abaixo.

> **Auditoria atual — 06/11/2026:** token Cloudflare Billing Read validado; falha real do cron corrigida e execução autenticada confirmada. Auditoria privada e horária das contas implantada. Magic Hour informou plano free e 500 créditos agregados; as franquias gratuitas de imagem/vídeo e o bloqueio de cobrança ainda precisam de comprovação. Nenhum vídeo real foi gerado. Estado completo e pendências em [AUDITORIA_IA.md](./AUDITORIA_IA.md); este registro prevalece sobre estados e versões históricos abaixo.

Publicado em 06/11/2026: Worker `1fb26204-b970-45c3-b285-63365d30be0b`, funções Supabase `video-generation` v24 / `video-generation-worker` v7 e migração `20261106024913`. Diagnóstico remoto: processador disponível, modo gratuito e pagamentos bloqueados. Cotas ainda não verificadas permanecem em espera. Validação: 116 testes, lint, TypeScript e build de 17 rotas aprovados.

> **Política vigente — somente gratuito, 06/11/2026:** modo `free-only` implementado e publicado no Supabase, sem teto diário de pedidos do aplicativo. Fallback automático entre opções compatíveis, reservas atômicas de cotas gratuitas, espera/retomada com etapas preservadas e renovação apenas de franquias periódicas comprovadas. Rotas pagas ou desconhecidas são bloqueadas. As cotas de imagem/vídeo ainda não têm comprovação de gratuidade registrada; pedidos podem aguardar por isso. Instruções e limites reais em [MODO_GRATUITO.md](./MODO_GRATUITO.md). Este bloco substitui as instruções históricas de ativar geração paga abaixo.

## Estúdio reorganizado e pipeline revisado — 06/11/2026

- Worker `meu-vendedor` publicado na versão `37c2d501-7ee6-4629-a1a4-8b2c844cd854`, preservando ambos os crons e os Secrets. URL: https://meu-vendedor.httpsgithubcomwarllemedicaosunshine-budget-guidegit.workers.dev/videos
- Supabase: `video-generation` ACTIVE v23 com JWT; `video-generation-worker` ACTIVE v6 com autenticação própria preservada. Migração `20261106022136_video_production_cache.sql` aplicada e confirmada: cache privado e tentativas de finalização, além de ajustes de capacidade da fila.
- 103 testes aprovados, lint sem alertas de código, TypeScript frontend/Edge e exportação estática das 17 rotas aprovados. Testes focados de finalização foram repetidos após ajuste do tratamento de erro transitório.
- Navegador Chromium em 1440×1000 e 390×844: etapas, abas e biblioteca navegáveis, sem erros JavaScript ou overflow horizontal. Verificação repetida na URL pública após publicação.
- SQL confirmou cache com RLS habilitada/forçada, sem leitura para `anon`/`authenticated`; nenhum alerta de FK sem índice. Advisor informa seis tabelas internas sem políticas de cliente intencionalmente, incluindo cache. Proteção Auth contra senhas vazadas continua desativada; [orientação](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection).
- Credenciais presentes não significam geração operacional. O diagnóstico do runtime confirmou flags de fila/processador/geração paga/licença desligadas, allowlist vazia, orçamentos e conversão Magic Hour sem configuração. Nenhum Secret foi alterado; não foram criados jobs nem consumidos créditos de IA. A revisão não comprova um vídeo real nem 15 vídeos/dia.
- Interfaces/contratos sem adaptadores, pipeline de áudio, biblioteca de fundos pronta e demais pendências estão enumerados em `VIDEOS_IA.md`. Este registro prevalece sobre estados históricos abaixo.


> **Revisão autenticada — 06/11/2026:** Migração `20261106020118_foreign_key_indexes.sql` aplicada ao Supabase `jzchlrvxdaffnrgbvabv`, com oito índices confirmados por SQL e ausência do alerta `unindexed_foreign_keys` após aplicação. Nenhuma Edge Function ou frontend foi alterado nesta revisão; funções existentes continuam ativas. Credenciais comerciais não foram cadastradas. O catálogo público segue sem configuração; não declarar o produto integralmente operacional. Histórico abaixo preservado. Este bloco prevalece sobre os registros anteriores de falta de acesso ou versões históricas abaixo.

## Estado mais recente confirmado — 06/11/2026

O Worker existente `meu-vendedor` está na versão `0f4bd14d-0c3d-48cd-88a9-734e5ce19736`, com 100% do tráfego conforme a listagem de deployments. A API confirmou os crons `* * * * *` (vídeos) e `*/30 * * * *` (marketplace); `/videos` responde HTTP 200. A consulta de invocações agendadas desde a publicação retornou zero registros, portanto a execução do cron ainda não está comprovada.

O último registro Supabase disponível informa `video-generation-worker` ACTIVE na versão 3 e validação de autenticação própria, com `processor_disabled` para segredo válido. O estado atual do Supabase não foi reconsultado nesta sessão por falta de CLI/sessão de gerenciamento. Não houve geração real, criação de tarefa ou consumo de créditos. As versões anteriores abaixo são histórico; para o estado vigente, use este bloco e `CONTINUAR_AMANHA.md`.

## Correção das imagens e perfis do Estúdio — publicada

Em 05/11/2026 às 19:52 UTC, o Worker `meu-vendedor` foi atualizado para a versão `56fa55d6-831b-475d-aa63-088ad2926b64`, com 100% do tráfego. A causa dos espaços vazios era o `next/image` gerar URLs `/_next/image` na exportação estática; o endpoint não existe no Worker e respondia 404. O build estático agora desativa a otimização automática e referencia os assets públicos diretamente.

Verificações após publicação: `/videos` retornou HTTP 200; Ana, Lucas, Carla e Rafael retornaram HTTP 200 com `image/webp`; o HTML público referencia diretamente os retratos disponíveis e não contém URLs `/_next/image`. Os arquivos de Carla e Rafael permanecem guardados, mas seus cartões mostram a referência como pendente porque as imagens anteriores não representam claramente os perfis plus size. Não foram geradas imagens novas, alterados dados do Supabase ou executadas migrações.

O commit `44dbac3` foi implantado a partir do checkout local. O push para GitHub não foi concluído porque não há sessão GitHub autenticada neste Codespace.

## Gerador de vídeos IA — publicação confirmada

Em 05/11/2026 foi publicado no Worker existente o gerador completo em modo demonstração. Versão Cloudflare `7f135c6e-69b7-4fbc-a459-82bdcf34f30e`, URL pública [Meu Vendedor — Vídeos IA](https://meu-vendedor.httpsgithubcomwarllemedicaosunshine-budget-guidegit.workers.dev/videos). O cron de 30 minutos foi preservado.

A rota `/videos` e o retrato público de Ana responderam HTTP 200; o HTML publicado contém “Gerador de vídeos IA”, “Ana” e “Simular geração sem créditos”. Foram publicados os quatro retratos originais. O build final gerou 17 rotas.

No Supabase, a migração `20261105151156` está no histórico, `mv_video_projects` tem RLS forçada e quatro políticas, e a função `video-generation` está `ACTIVE` na versão 1 com JWT obrigatório. A requisição sem sessão retornou 401. Nenhuma credencial Google foi configurada e nenhuma chamada de vídeo paga foi executada.

O código correspondente foi enviado para `origin/main` no commit `f42c516`. Em 05/11/2026, a documentação foi revalidada contra três migrações, dez tabelas `mv_*`, quatro Edge Functions ativas e os advisors do Supabase. O histórico abaixo descreve entregas anteriores e não substitui este estado mais recente.

## Vitrine pública de Shopee, Amazon e TikTok — fonte ainda pendente

Em 04/11/2026 foi publicada a versão Cloudflare `9d080273-301c-4e59-b025-be17d3e1b5ea`, com somente Shopee, Amazon e TikTok Shop na vitrine de `/` e `/dashboard`. A vitrine não exige login nem conexão pessoal. Os formulários de conta e os acessos privados continuam nas páginas próprias. O cron existente foi preservado.

A nova função `catalog-public` está ACTIVE na versão 1, com `verify_jwt=false` por servir apenas o catálogo público. Usa um segredo central do aplicativo, sem ler sessões, credenciais ou produtos privados de usuários. As funções privadas existentes não tiveram a autenticação removida.

**O pedido de exibir produtos reais ainda não está concluído:** os testes remotos GET para Shopee, Amazon e TikTok retornaram 503/`catalog_not_configured`. É necessário configurar acessos de catálogo do próprio Meu Vendedor em `MV_PUBLIC_CATALOG_CONFIG`; não são chaves a serem pedidas aos visitantes. Não foram exibidos produtos fictícios como alternativa. A pergunta sobre quais acessos o responsável já possui permanece pendente.

Verificações locais: 31 testes aprovados, TypeScript frontend/backend, lint, build estático e dry-run. HTML gerado com apenas as três lojas, sem exigência de conexão pessoal. Bundle verificado sem a configuração privada do catálogo. Configuração e limites em `CATALOGO_APIS.md`.

## Catálogo publicado no Cloudflare — confirmado

Após autorização do responsável, em 04/11/2026 às 18:59 UTC foi publicado o build do commit `5d56fb8` no Worker existente `meu-vendedor`, conta `2cd6c753710fbaba6b94e33ef662c9b3`. Versão ativa: `29c743ed-e672-4e98-b059-0213bd9a0ec8`, com 100% do tráfego. Foram enviados 73 assets novos/modificados; preservados o segredo de agendamento e o cron de 30 minutos.

Verificação pública: `/dashboard` respondeu HTTP 200 com o título “Encontre seu próximo produto” e as sete plataformas; o painel demonstrativo anterior não está no HTML. `/` e `/dashboard` usam o mesmo catálogo. Autenticação Wrangler e dry-run de publicação foram verificados. Não houve teste visual em navegador nem consulta comercial autenticada nesta publicação.

A função Supabase `catalog` já está ACTIVE na versão 1, conforme registro abaixo. A publicação da interface não concede acesso às APIs comerciais: ainda é necessário configurar credenciais por usuário e validar as consultas reais. Magalu/SHEIN permanecem sem contrato de catálogo de afiliados confirmado. Os registros de publicação pendente abaixo são históricos e foram superados por esta publicação.

## Correção de rota e publicação do backend de catálogo

Em 04/11/2026, a inspeção por HTTP confirmou que `/dashboard` ainda servia o painel demonstrativo anterior. A rota foi corrigida no código para apresentar o mesmo catálogo de `/`; é necessário publicar os assets para a correção aparecer no Worker.

A função Supabase `catalog` foi publicada no projeto `jzchlrvxdaffnrgbvabv`: versão 1, status ACTIVE, `verify_jwt=true`. Verificação remota: preflight OPTIONS retornou 204 com a origem correta e POST sem sessão retornou 401. Não foram criadas contas de teste nem configuradas credenciais comerciais por esta publicação. A verificação não comprova sucesso nas APIs de lojas.

Na primeira verificação, a publicação do frontend estava pendente de autenticação do Wrangler. A autorização foi posteriormente concedida e a publicação concluída, conforme registro no início deste documento. O commit/push anterior, isoladamente, não havia atualizado o site.

## Catálogo inicial de sete plataformas — alteração local

Em 04/11/2026, a rota `/` foi alterada no checkout para apresentar oportunidades e disponibilidade de Amazon, Mercado Livre, TikTok Shop, Magalu, Shopee, SHEIN e AliExpress. Além da Shopee por conta autorizada, o código inclui a função `catalog` com consultas Amazon, Mercado Livre, TikTok Shop e AliExpress. A nova função e seus segredos por usuário ainda precisam ser publicados/configurados e testados com acesso comercial real. Magalu e SHEIN não têm adaptador de afiliados. Detalhes em `CATALOGO_APIS.md`.

Esta alteração **não foi publicada**: a consulta `wrangler whoami` informou ausência de autenticação no ambiente atual; a instalação temporária de autenticação usada anteriormente também não está disponível. Os registros abaixo são históricos e não comprovam que a página nova esteja na produção. Não foi criada hospedagem alternativa.

## Cloudflare Workers — endereço público confirmado

Em 04/11/2026, autorização OAuth do Wrangler confirmada e Worker existente `meu-vendedor` localizado na conta autorizada.

- URL pública: https://meu-vendedor.httpsgithubcomwarllemedicaosunshine-budget-guidegit.workers.dev
- Deployment existente consultado: `7743d9c0-8349-4818-a4ba-6a6c3903f064`.
- Versão ativa consultada: `ea8236cc-67d9-488e-a653-676900ebb5a6`.
- Testes HTTP: `/` redireciona ao dashboard; `/dashboard`, `/contas` e `/produtos` respondem 200 sem autenticação ChatGPT.
- O código remoto contém o frontend Meu Vendedor. Não foi necessário sobrescrever o Worker para confirmar a publicação existente.
- A consulta a Workers Builds retornou 403 com a autorização atual. Não foi possível confirmar/configurar o vínculo automático GitHub por essa API. Não confundir esse limite com o acesso público, que foi testado separadamente.
- Requisições com o User-Agent padrão do Python receberam erro Cloudflare 1010; o teste com identificador de navegador funcionou. Não foram alteradas proteções da conta.
- Credenciais OAuth permanecem fora do repositório. Nenhum segredo foi inserido neste documento.

## Sites — publicação anterior de análise

Versão 1 publicada com sucesso em 04/11/2026 pelo Sites.

- URL: https://meu-vendedor-painel.greybadge24.chatgpt.site
- Acesso: privado, para o proprietário na conta ChatGPT usada na publicação.
- Projeto Sites: `appgprj_6aeb24b5b5d88191b82a1114a430488c`.
- Deployment: `appgdep_6aeb2589c8608191bf05844639801e2c`.
- Commit da fonte de publicação: `43852f55da7feeee1d0e53f0e68d63686fb0902a` (repositório de fontes do Sites; separado do GitHub do projeto).
- Checkout usado: `/tmp/meu-vendedor-online-20261104`. A fonte está salva no repositório do Sites; o diretório temporário não é sua única cópia.

## O que está disponível

Dashboard com dados demonstrativos, menu, tema claro/escuro e página Contas Conectadas com quatro plataformas e seus requisitos. As outras rotas são apresentações dos módulos futuros. Ainda não há cadastro de todas as lojas, ações para entrar/se afiliar em cada loja, APIs externas, autenticação própria ou persistência.

## Como foi publicado

Foi preparada uma cópia do frontend existente com `output: "export"` em `next.config.ts` para servir páginas estáticas. O build `npm run build -- --webpack` passou, incluindo a checagem TypeScript. O diretório `out` foi empacotado e publicado; o frontend não foi recriado e o compilador/configuração do checkout GitHub foi preservado. A publicação foi confirmada pela hospedagem; não houve inspeção visual em navegador nesta execução.

Para futuras alterações, reutilizar o mesmo ID de projeto Sites e abrir sua fonte salva, preservando o acesso privado. Não criar outro Site para atualizar este painel.

## Supabase

Não conectado a esta conversa nesta publicação. Não há configuração Supabase no código nem variáveis Supabase disponíveis no ambiente. A versão estática atual não depende do banco. A integração Supabase foi sugerida para habilitação pelo responsável; sua existência no catálogo não comprova acesso ao projeto dele. Após a conexão, identificar o projeto correto antes de consultar ou alterar estruturas.

## Base Supabase — ativação concluída

Projeto `meu-vendedor` (`jzchlrvxdaffnrgbvabv`) autorizado e saudável. Migração `20261104000100` aplicada e registrada no histórico remoto. Tabelas `mv_platforms`, `mv_profiles` e `mv_affiliate_links` com RLS habilitada e forçada; políticas e privilégios conferidos.

Site URL, retornos de cadastro/recuperação e senha mínima de 8 caracteres configurados. Confirmação de e-mail mantida habilitada. Configurações remotas não declaradas foram preservadas. A configuração publicável foi incluída no build via `.env.local`, ignorado pelo Git.

Frontend conectado publicado no mesmo Worker. Versão Cloudflare ativa: `31d1b45c-bb40-4d95-bae8-ec172dac1cb4`. `/entrar`, `/afiliados`, `/configuracoes` e `/contas` responderam HTTP 200; bundle público conferido com a URL e a chave publicável do projeto correto. O aviso de configuração pendente não aparece nesta publicação. A publicação anterior sem configuração tinha versão `70877960-c543-4b34-ac35-50ccbeda8e55`.

Validações locais: 6 testes, TypeScript, linter e build estático aprovados. Validações remotas de API: catálogo de cinco plataformas; bloqueio anônimo; login por senha de duas contas; perfil; CRUD do proprietário; bloqueio entre usuários; bloqueio de falsificação do proprietário e URLs inseguras; logout. As duas contas temporárias foram criadas já confirmadas sem enviar mensagens e removidas ao final. Nenhuma chave administrativa foi colocada no frontend ou Git.

Limites: não houve teste visual em navegador nesta execução. A entrega de e-mails de confirmação e recuperação ainda precisa ser validada; SMTP próprio não foi configurado. A ligação de builds automáticos GitHub/Cloudflare permanece não confirmada pela API Workers Builds com a autorização atual. APIs das lojas não foram ativadas.

## Validação desta revisão — 06/11/2026

89 testes aprovados, lint e typecheck Edge aprovados. Typecheck frontend aprovado e repetido pelo build estático; exportação das 17 rotas concluída. O sandbox retornou saída vazia na captura do subprocesso TypeScript (`--showConfig`); o mesmo build fora do sandbox passou, sem alteração no código Next.js. A migração local usa a versão `20261106020118`, igual ao histórico criado pelo Supabase MCP.

## Conta e conexões — publicação de 06/11/2026

Frontend Cloudflare `8fb00466-9e35-42a4-902b-cbeffc02e56b`; backend Supabase `video-generation` v31 e `video-generation-worker` v15. 139 testes, lint, TypeScript frontend/Edge e build de 17 rotas aprovados. Central em `/entrar`, lojas recolhidas e rota antiga preservada por encaminhamento. OAuth Google preparado/testado de forma simulada; provedor remoto confirmado desabilitado. Ativação exige Client ID/Secret Google no painel Auth. Flow remoto e publicação social são estratégia documentada, não funcionalidades implantadas. Detalhes em [CONTA_E_ESTRATEGIA_GOOGLE.md](./CONTA_E_ESTRATEGIA_GOOGLE.md).
