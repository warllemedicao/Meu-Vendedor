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
