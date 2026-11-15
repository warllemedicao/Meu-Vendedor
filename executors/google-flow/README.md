## Diagnóstico por tentativa — preparado em 15/11/2026, ainda não publicado

O fluxo atual usa sessão Hyperbrowser e a rota Modal `/hyperbrowser-navigate` para preparar o projeto. A documentação do controlador legado `/control` abaixo permanece como referência histórica; não comprova a versão atual publicada.

`flow_diagnostics.py` produz relatórios v1 com etapas/códigos fixos, contagens e tempos. O ID da tentativa é gerado pela Edge Function e reaparece nos eventos `flow_step` do Modal e `flow_executor_result` do Supabase. O identificador `executorRevision` deriva de SHA-256 dos arquivos `modal_app.py` e `flow_diagnostics.py` presentes na imagem, sem expor credenciais. Ambos precisam estar em `/opt/flow`, como já configurado por `add_local_dir`. Máximo de 80 eventos por relatório; estados de espera repetidos são amostrados em intervalos de 5 s ou quando mudam.

O relatório indica envio pelo seletor nativo ou campo de arquivo, abertura da biblioteca, avisos de direitos, espera por nomes esperados e três leituras estáveis, indicadores de processamento e erros por frame. A detecção por nomes é heurística: não confirma referências anexadas. Controles Incluir no comando são apenas sondados por contagem; nenhuma ação de seleção ou geração foi implementada. `readyToGenerate=false`.

A tela mantém as cinco últimas tentativas em memória, fornece botão para copiar e área selecionável. Dados desaparecem ao recarregar. Erros HTTP devolvem diagnóstico limitado; executor antigo é identificado como sem relatório compatível. Timeout na Edge Function pode ocorrer antes do fim remoto: o relatório declara estado desconhecido e o ID permite consultar os eventos já emitidos no Modal. Não repetir o pedido automaticamente.

Para disponibilizar, revisar/integrar a branch e publicar Modal, `hyperbrowser-profile` incluindo `_shared/flow-diagnostics.ts` e `_shared/flow-executor-diagnostics.ts`, e frontend pelos fluxos existentes. Publicar apenas o frontend não basta. Nenhum Secret, migration ou nova sessão é necessário para esta mudança de código. Não houve deploy nesta tarefa.

Testes simulados, sem login ou consumo de créditos: `tests/flow-attempt-diagnostics.test.mjs` e `tests/test_flow_diagnostics.py`. Build/typechecks/lint e limites detalhados em `historico.md`.

# Executor externo do Google Flow

O controlador Modal inicia um sandbox por usuário somente ao abrir a conexão. Cada navegador tem duração máxima de dez minutos e timeout de inatividade de dois minutos. `disconnect` encerra o sandbox; a expiração também é acompanhada pelo Durable Object. Controlador com `min_containers=0` e janela de redução de 30 segundos. A hospedagem do Meu Vendedor continua na Cloudflare.

O endpoint privado `/control` exige `MV_FLOW_EXECUTOR_SECRET`. Somente o Worker valida o usuário Supabase e fornece a chave derivada do Durable Object. Não há comando de navegador, cookies ou identificadores fornecidos pelo cliente. Na janela interativa, um token de sessão distinto permite somente screenshot e comandos limitados de teclado/mouse; não permite acessar a RPC de cookies. A URL usa fragmento, não query string, para evitar o token nos logs HTTP. A janela não carrega bibliotecas externas.

Cookies são salvos apenas com consentimento e conta verificada, no cofre AES-GCM existente da Cloudflare, isolado por usuário, por até sete dias. O sandbox não tem volume de perfil persistente. Reabrir restaura os cookies autorizados; expiração/revogação Google pode exigir novo login. O navegador limita navegação a domínios Google necessários. Nenhum mecanismo evita verificações do Google.

## Implantação reproduzível

- Script reproduzível: `python scripts/deploy-flow-executor.py`, com credenciais Modal e `MV_FLOW_EXECUTOR_SECRET` em ambiente protegido. O script constrói a imagem e atualiza o Secret antes de publicar.
- SDK local oficial: `modal==1.3.5`; Python 3.12 na imagem.
- Autenticação Modal por `MODAL_TOKEN_ID` e `MODAL_TOKEN_SECRET` em ambiente seguro.
- Construir `modal_app.image.build(app)` antes da implantação e obter o ID da imagem. É necessário usar uma imagem resolvida explicitamente no sandbox; o objeto global do controlador não assegura a mesma imagem.
- Cadastrar Secret Modal `mv-flow-control` com `MV_FLOW_EXECUTOR_SECRET` e `MV_FLOW_BROWSER_IMAGE` (ID da imagem construída).
- Publicar com `modal deploy executors/google-flow/modal_app.py`.
- No Worker, cadastrar o mesmo `MV_FLOW_EXECUTOR_SECRET` por stdin protegido e configurar `MV_FLOW_EXECUTOR_URL` com a URL publicada acrescida de `/control`.
- Regenerar tipos Wrangler, validar e publicar o Worker. Sem essa variável o código conserva a conexão experimental Browser Run anterior.

A conexão externa não implementa geração automática ou importação de MP4. `/control` informa `generationReady: false` no diagnóstico. Flow permanece indisponível no seletor de geração até validação do login e implementação/teste dessas etapas. Inicialização de servidor não reduz o tempo de geração do próprio Google. Modal pode consumir créditos conforme o plano; nenhum plano ou compra é realizado pelo código.
