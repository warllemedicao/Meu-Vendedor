## Inclusão de referências e estado atual — preparada em 15/11/2026

Executor esperado **eace261ac165**. `include_references` procura as imagens do lote em opções/checkboxes acessíveis da Lista de recursos, confirma todas as seleções e clica uma vez em Incluir no comando somente quando o alvo é único/habilitado. Nomes aleatórios por tentativa evitam correspondência com arquivos antigos. Verificação dos anexos é independente do clique e exige evidência no formulário do prompt; ausência de semântica reconhecível é uma limitação declarada, não sucesso presumido. Clique incerto não é repetido. Não clica na seta de geração.

`editor_state` devolve inventário de controles atuais com códigos/contagens, e o relatório mostra a próxima ação pendente separada da cronologia. Nomes/valores livres do DOM não entram no relatório. Prepare-draft tem timeout de 105 s na Edge, com etapas limitadas no executor. Pergunta sobre o significado de enviar comando continua pendente; ação permanece sem gerar. Testes simulados: 16 Python e 8 JS/TS aprovados, junto de typechecks, lint e build. Publicação ainda será confirmada em historico.md.

## Publicação da correção de configurações — 15/11/2026

Código **66bd19b**, CI aprovado. Supabase `hyperbrowser-profile` ACTIVE **v51** e Cloudflare **d964b926-292d-4524-964b-051e3faaba01** publicados, com código/bundle conferidos. **Modal novo pendente** por HTTP403 no disparo do workflow via integração GitHub. Responsável com permissão deve executar workflow Modal na main sem rotação de segredo Cloudflare, respeitando production. Revisão esperada do executor: **ce9a1e15ac9f**. Até essa revisão aparecer no relatório, a correção não está ativa no robô. Não houve teste real autenticado da nova revisão. 11 testes Python e 7 JS/TS, typechecks, lint e build aprovados localmente.

## Correção da inspeção após upload — preparada em 15/11/2026

Relatório real da revisão `ff587ad3a70f` confirmou duas imagens após três leituras estáveis e falhou em seguida nas configurações. A revisão anterior foi publicada no Modal (run 43750633302), superando a pendência histórica abaixo. A nova correção ainda depende de publicação confirmada.

`inspect_settings` em `flow_diagnostics.py` diferencia botão ausente, ambíguo, bloqueado e falha de leitura. Exige exatamente um botão visível/habilitado e usa `click(trial=True)` antes do clique normal; não força ação nem fecha overlays por suposição. Orçamento total de 7 s, 1,2 s por ação. Retorna erro estruturado não fatal: o preparo/upload permanece no resultado e a inspeção de referências já ocorre antes de tentar abrir configurações. Não seleciona referências, não salva parâmetros nem clica em Gerar. Códigos e métricas devem ser publicados também no helper compartilhado da Edge Function e no frontend para aparecerem no relatório.

## Diagnóstico por tentativa — frontend/Supabase publicados; Modal pendente (15/11/2026)

O fluxo atual usa sessão Hyperbrowser e a rota Modal `/hyperbrowser-navigate` para preparar o projeto. A documentação do controlador legado `/control` abaixo permanece como referência histórica; não comprova a versão atual publicada.

`flow_diagnostics.py` produz relatórios v1 com etapas/códigos fixos, contagens e tempos. O ID da tentativa é gerado pela Edge Function e reaparece nos eventos `flow_step` do Modal e `flow_executor_result` do Supabase. O identificador `executorRevision` deriva de SHA-256 dos arquivos `modal_app.py` e `flow_diagnostics.py` presentes na imagem, sem expor credenciais. Ambos precisam estar em `/opt/flow`, como já configurado por `add_local_dir`. Máximo de 80 eventos por relatório; estados de espera repetidos são amostrados em intervalos de 5 s ou quando mudam.

O relatório indica envio pelo seletor nativo ou campo de arquivo, abertura da biblioteca, avisos de direitos, espera por nomes esperados e três leituras estáveis, indicadores de processamento e erros por frame. A detecção por nomes é heurística: não confirma referências anexadas. Controles Incluir no comando são apenas sondados por contagem; nenhuma ação de seleção ou geração foi implementada. `readyToGenerate=false`.

A tela mantém as cinco últimas tentativas em memória, fornece botão para copiar e área selecionável. Dados desaparecem ao recarregar. Erros HTTP devolvem diagnóstico limitado; executor antigo é identificado como sem relatório compatível. Timeout na Edge Function pode ocorrer antes do fim remoto: o relatório declara estado desconhecido e o ID permite consultar os eventos já emitidos no Modal. Não repetir o pedido automaticamente.

Código `96e6fae` enviado à main. `hyperbrowser-profile` ACTIVE v49 publicada com os helpers, JWT preservado; frontend publicado no Worker `meu-vendedor` versão `04688ae7-3e7c-4dd6-bbad-3361e84c4f59`, com HTTP200 e bundle conferidos. **Modal ainda não atualizado:** disparo do workflow negado à integração GitHub com HTTP403; credenciais Modal indisponíveis no Codespace. Responsável com permissão deve executar [workflow Modal](https://github.com/warllemedicao/Meu-Vendedor/actions/workflows/deploy-hyperbrowser-modal.yml) na main, sem rotação do segredo Cloudflare, respeitando aprovação production. Até lá, a UI pode informar `executor_report_unavailable`; os detalhes por etapa e os seletores corrigidos dependem do novo executor. Nenhuma migration ou geração foi realizada.

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
