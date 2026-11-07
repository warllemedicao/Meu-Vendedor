# Continuidade — estado vigente em 07/11/2026

## 1min.ai e piloto Kaggle — entrega mais recente

- `ONEMIN_API_KEY` e `KAGGLE_API_TOKEN` presentes e verificadas sem expor valores. 1min.ai integrado ao seletor, inventário, readiness, worker, polling, validação e Storage privado; escolha explícita preservada.
- Modelo inicial: `bytedance/seedance-2.0-fast`, referência enviada pela Asset API, `TEXT_TO_VIDEO` com `imageUrls`, 6s, 9:16, 720p, áudio nativo. Automático tenta 1min.ai antes dos adaptadores anteriores.
- Teste real `30c582b5-e739-4711-9f23-b4d94e23faf8`: imagem em cache preservada e submissão aceita, depois falha `INSUFFICIENT_CREDITS`: 1.632.960 exigidos / 280.000 disponíveis. Nenhum MP4 1min.ai e nenhuma compra/recarga efetuados. Não repetir o mesmo teste sem mudança de saldo/modelo; não confundir chave válida com renderização financiada.
- Kaggle: cota real 30h; notebook privado GPU terminou `COMPLETE` e produziu `gpu-report.json`. `kaggle-pilot` é exclusivo do operador e protege o lançamento por claim persistente. Wan/lip sync não foram executados e não estão habilitados para usuários.
- Próxima evolução: comparar custo de modelos 1min.ai compatíveis com referência e fala; validar um MP4 com recursos disponíveis. Depois executar piloto de modelo de avatar/lip sync no Kaggle, medindo tempo, VRAM, licença e recuperação do MP4 antes de integrá-lo à fila.
- Documentos desta entrega: [ONEMIN_E_KAGGLE.md](./ONEMIN_E_KAGGLE.md), [ATUALIZACOES.md](./ATUALIZACOES.md). A função temporária `integration-verification` foi desativada com HTTP 410.

## Atualização — Omni e cenários

- Log fornecido pelo responsável confirma cota Free Tier zero para `gemini-omni-1.2-flash` (requisições/dia, minuto e tokens). Ativar armazenamento de logs não libera cota. Verificar faturamento e limites do projeto correto antes de novo pedido; não houve reenvio automático nem ativação de cobranças.
- Pedido Omni de 07/11 00:16 UTC estava com interação remota encerrada em RESOURCE_EXHAUSTED, mas tela aguardava recursos indefinidamente. Corrigido para falha com imagem preservada. Frontend `eb8246dc-b5e0-4c19-9020-341d3e547738`; Worker v28 preserva motivo seguro de `errors[]`, encerra falha de provedor explicitamente escolhido e impede espera infinita quando todos os provedores submetidos foram esgotados. Automático mantém fallback.
- Prompts de imagem/vídeo agora descrevem o ambiente de cada cenário e substituem o fundo de catálogo. Melhoria de qualidade ainda depende de avaliar próxima geração real, não realizada nesta revisão.
- 190 testes, lint e TypeScript frontend/Edge aprovados. Importação de imagem publicada em `video-generation` v45.

## Piloto Wan no Kaggle — continuidade

- O responsável confirmou que `KAGGLE_API_TOKEN` está nos Secrets do Supabase. A credencial foi validada sem revelar o valor: chamada à API Kaggle retornou HTTP 200.
- Nenhum notebook foi enviado e nenhuma GPU/modelo Wan foi executado. Portanto, ainda não há resultado de geração, duração ou qualidade.
- A checagem usou uma Edge Function temporária autenticada por segredo descartável; ela foi substituída por resposta HTTP 410 logo após o teste. A pasta local temporária também foi removida.
- Próximo passo: implementar um disparador de teste do lado servidor que use `KAGGLE_API_TOKEN` sem expor o segredo, envie um notebook privado com GPU via API oficial de kernels, acompanhe estado/logs e recupere o MP4. Primeiro verificar/obter o username da conta e a disponibilidade de GPU/cota. Não integrar ao fluxo de usuários até terminar o piloto.
- Começar com notebook mínimo que confirma GPU e versões/runtime; em seguida rodar uma geração curta Wan image-to-video com imagem de teste autorizada. Wan 2.2 I2V de alta qualidade documenta necessidade de GPU grande; escolher variante/configuração compatível com a GPU Kaggle efetivamente concedida. Se faltar VRAM ou disponibilidade, registrar como limite do Kaggle, sem trocar para API paga.
- Kaggle notebooks são temporários e sujeitos a cotas; mesmo que o piloto passe, isso ainda não garante um backend de produção sob demanda.

## Entregue e confirmado

- Foto automática de produto sincronizado corrigida: o backend importa a imagem Shopee do produto pertencente à conta para o Storage privado antes de preparar as referências. A prévia externa deixa de exigir download/upload manual. Testes e limites em [IMAGENS_SINCRONIZADAS.md](./IMAGENS_SINCRONIZADAS.md).

- Publicação anterior de conta: `a1a5dd36-76b7-4954-99f6-d9d5f5b72b90`; `video-generation` v44. Crons de vídeo e marketplace preservados.
- Login Google habilitado no Supabase e confirmado pelo responsável. Projeto Google `meu-vendedor-1987`, número `531516167196`.
- YouTube Data API v3 ativada, escopos readonly/upload declarados e dois e-mails de teste informados pelo responsável. Segundo callback cadastrado e canal conectado, ambos confirmados pelo responsável. Consulta, renovação e desconexão implementadas com tokens cifrados. Não repetir a etapa de criação das credenciais.
- Migrações `20261106224146_elevenlabs_audio.sql` e `20261106233237_youtube_connection.sql` aplicadas e reconciliadas. Tabelas privadas de áudio/OAuth com RLS; clientes não acessam tokens.
- Chave Gemini anterior foi recusada (`API_KEY_INVALID`). O responsável a substituiu; catálogo e modelos de roteiro/vídeo responderam HTTP 200. Não solicitar a chave novamente nem confundir com Client ID/Secret OAuth.
- Botão Gerar vídeo corrigido: valida ao clicar, mostra pendência, abre a etapa correspondente, reconsulta capacidades e preserva idempotência. Só acesso inicial/envio em andamento desabilitam a ação. Falhas de saldo, voz ou integrações pendentes não são bloqueios globais de UI.
- Um vídeo real Magic Hour anterior está concluído. As correções mais recentes não criaram outro vídeo real; o áudio nativo corrigido ainda precisa ser conferido em um novo resultado.
- ElevenLabs usa a chave existente, sem exigir novo cadastro. Síntese real de teste validada. Outra voz está ao lado de Característica da voz, filtrada por tipo, usando o roteiro existente para prévia/exportação. O worker continua usando áudio nativo.
- Navegador Flow retirado da central por solicitação do responsável. Flow/Create permanecem apenas como opções pendentes no seletor. Não reintroduzir o navegador como fluxo principal nem declarar que OAuth transfere a sessão pessoal do Flow.

## Pendências, em ordem de continuidade

1. Conferir a geração real pelo botão publicado com produto/referência válidos, até MP4, incluindo fala/qualidade. A validação Chromium confirmou envio à fila simulada, não um novo MP4 real.
2. Validar vídeo pela API Gemini com os acessos/custos da conta. Catálogo HTTP 200 não comprova inferência nem aproveita assinatura pessoal Flow/Create.
3. Para ElevenLabs em anúncios, usar licença/plano apropriado; Free permanece prévia não comercial. Composição automática de voz no worker é uma melhoria separada; a exportação local opcional já existe.
4. Implementar publicação/agendamento no YouTube e testar com autorização do usuário. Canal conectado e escopo upload não significam publicação entregue. O Google pode exigir renovação após sete dias no modo Testando.
5. Flow: geração automática/importação de MP4 não implementadas; avaliar caminho permitido e testável antes de habilitar a opção. Não inventar escopos, API pública ou sessão por inferência a partir do login.
6. YouTube Create: integração automática do editor móvel continua pendente; Data API de canais/uploads não concede esse recurso.
7. Catálogo e lojas: cadastrar/validar credenciais Shopee e fontes públicas autorizadas de Shopee/Amazon/TikTok. Última consulta comercial registrada: `catalog_not_configured`. Outros adaptadores/contratos continuam conforme CATALOGO_APIS.md.
8. Validar SMTP/e-mails, proteção contra senhas vazadas, limpeza de Storage, deduplicação de imagens em andamento e carga real. Tendências, ranking e relatórios comerciais completos continuam futuros.

## Preferências e cuidados para a próxima sessão

- Preservar a geração existente enquanto novas ferramentas são inseridas; não fazer a disponibilidade global depender de um novo conector.
- Manter voz alternativa junto das preferências e evitar um segundo formulário de roteiro.
- Somente Automático permite fallback de vídeo; escolha explícita permanece vinculada à ferramenta.
- Política ativa: créditos das contas. A antiga free-only e seus bloqueios administrativos são históricos; não os reativar por ler documentação antiga.
- Nunca expor valores de Secrets, tokens ou cookies. A presença de uma chave não comprova saldo, licença ou geração real.
- Usuário pediu atualização dos Markdown, commit e push destas alterações. Deploy já ocorreu; Git e publicação são operações distintas.

## Verificações realizadas

178 testes Node aprovados; lint e TypeScript frontend/Edge aprovados; build das 17 rotas concluído. Chromium na URL publicada, em 1440×900 e 390×844, confirmou validações de nome/foto, preparação das referências, envio único mesmo com clique duplo, recuperação após 503 inicial, filtro de vozes, ausência do cartão ElevenLabs e do navegador Flow na central, sem overflow. Sessão/fila do teste eram simuladas; nenhum vídeo pago novo foi solicitado. Diagnósticos temporários foram desativados.

## Referências atuais

[AJUSTES_ESTUDIO.md](./AJUSTES_ESTUDIO.md), [YOUTUBE_CONEXAO.md](./YOUTUBE_CONEXAO.md), [GOOGLE_OAUTH_SETUP.md](./GOOGLE_OAUTH_SETUP.md), [ELEVENLABS.md](./ELEVENLABS.md), [PUBLICACAO.md](./PUBLICACAO.md). Os registros históricos nos demais documentos devem ser lidos com essa precedência.
