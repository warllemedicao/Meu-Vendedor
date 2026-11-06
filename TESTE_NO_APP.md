# Teste pelo aplicativo — 06/11/2026

## Estado atual

A interface, autenticação, upload, preparação e fila estão disponíveis. **A geração real de MP4 por IA continua bloqueada pelas cotas gratuitas não liberadas.** Esta revisão não enviou uma geração ao Magic Hour ou Replicate. Ausência de cobrança sem submissão não comprova gratuidade da API.

O responsável informou que não houve cobrança e solicitou finalizar a publicação para testar pelo app. Isso foi registrado como relato, sem transformá-lo em prova de saldo gratuito, licença ou hard stop do fornecedor. Não foram ativados planos, compras, cobrança ou concessões fictícias.

## Como verificar pelo app

1. Acessar [o estúdio publicado](https://meu-vendedor.httpsgithubcomwarllemedicaosunshine-budget-guidegit.workers.dev/videos) e entrar na conta.
2. Preencher os dados e adicionar uma foto do produto.
3. Selecionar Ana ou Lucas, que possuem referências prontas. A produção atual suporta 6 segundos em formato vertical, sem áudio.
4. Na etapa de produção, consultar **Disponibilidade para gerar agora** e clicar em **Verificar disponibilidade**. Essa consulta não chama inferência nem consome créditos de IA.
5. O diagnóstico mostra imagem e vídeo separadamente. Sem cota elegível, o botão informa **Salvar pedido na fila**. O pedido aguardará liberação e não deverá ser interpretado como uma geração em andamento.
6. Quando houver cotas suficientes e verificadas, a tela informará disponibilidade para iniciar. O worker ainda valida/reserva as cotas ao processar; a consulta não reserva saldo nem garante sucesso do fornecedor.

O diagnóstico de imagem considera uma composição nova com duas referências e até 25 passos: 2.819 neurons estimados. O vídeo considera 144 créditos Magic Hour ou 6 unidades de duração no Replicate. Um quadro já produzido em cache pode permitir pular a composição, conforme as regras do processador; a consulta não examina o cache de um pedido específico.

## O que mudou

- A ação autenticada `capabilities` agora retorna `video.readiness` com disponibilidade por etapa, data e mensagem. Não retorna saldos, evidências privadas nem respostas brutas das contas.
- Falha na consulta de cotas não libera geração. Credenciais ausentes também impedem elegibilidade.
- O estúdio permite atualizar a consulta após entrar e diferencia salvar um pedido de gerar imediatamente.
- A fila continua aceitando pedidos e aguardando cotas conforme a política existente; não foi substituída por uma falha definitiva.

## Pendências que impedem o MP4 real

- Os seis registros de `mv_ai_free_allowances` continuam sem concessão ativa.
- É necessário comprovar saldo gratuito e bloqueio de cobrança no fornecedor antes de liberar imagem e ao menos um provedor de vídeo. O saldo agregado de 500 créditos Magic Hour foi observado anteriormente; ele não foi declarado gratuito pela auditoria.
- Runway, Hugging Face, Modal e Kaggle continuam sem adaptador neste fluxo. Áudio, lip sync e montagem multicena também não foram implementados.
- Para usar o resultado comercialmente, as condições de uso do modelo/provedor precisam ser confirmadas. Teste de API bem-sucedido, isoladamente, não comprova essa condição.

Detalhes das contas e demais dependências em [AUDITORIA_IA.md](./AUDITORIA_IA.md) e [MODO_GRATUITO.md](./MODO_GRATUITO.md).

## Publicação e validação

- Supabase `video-generation` v27 ACTIVE, com JWT e verificação de usuário preservados; worker v11 preservado.
- Onze testes focados aprovados: autenticação, diagnóstico, privacidade, indisponibilidade e handler da fila. Lint e TypeScript Edge aprovados. Nenhuma migração necessária.
- Build estático das 17 rotas aprovado. Cloudflare publicado na versão `9e1d9971-3d08-48bd-99cf-ff421bf2f97b`, com ambos os crons preservados.
- Navegação pública verificada em Chromium em 1440×1000 e 390×844, sem erros JavaScript nem overflow horizontal. O diagnóstico autenticado foi validado nos testes do handler; não foi usada a sessão pessoal do responsável no navegador.
