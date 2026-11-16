# Navegador Chromium próprio — protótipo inicial

Este serviço contém um Chromium visível em Xvfb e uma API privada com autenticação por bearer token. **Ainda não é um produto pronto para login**: o VNC fica somente em loopback e há um proxy WebSocket com ticket efêmero de uso único e validação de origem, mas a integração de emissão de tickets pelo backend autenticado ainda está pendente. Não exponha as portas 5900/6080 nem configure proxy aberto.

## Configuração
- `MV_BROWSER_CONTROL_SECRET`: segredo aleatório de pelo menos 32 caracteres, exclusivo deste serviço.
- `MV_BROWSER_PROFILE_DIR`: volume privado persistente para o perfil, padrão `/data/browser`.
- `DISPLAY=:99` definido na imagem.

## API privada
- `GET /health`
- `POST /session/start`
- `GET /session/status`
- `POST /session/stop`

Todas as rotas exigem `Authorization: Bearer <secret>`. Não envie esse segredo ao frontend: use um backend autenticado com autorização por usuário.

## Pendências bloqueadoras antes do deploy público
1. Publicar exclusivamente atrás de HTTPS; configurar `MV_BROWSER_PUBLIC_ORIGIN` com a origem HTTPS exata e implementar a emissão de tickets pelo backend Supabase autenticado (nunca enviar o segredo de serviço ao navegador).
2. Isolar sessões por usuário e evitar controle simultâneo do robô e da pessoa.
3. Definir armazenamento persistente criptografado, rotação e exclusão de sessões.
4. Verificar disponibilidade, limites e persistência do provedor de hospedagem.
5. Integrar a API ao Meu Vendedor e migrar conexão CDP do Modal.
6. Testar em ambiente isolado e só então retirar o provedor anterior.

Não há mecanismo de anti-hibernação, bypass de detecção, exportação de cookies nem envio de senhas ao aplicativo.

## Visualização (implementação parcial)
- `POST /session/view-ticket` exige o bearer secreto e só emite ticket com navegador ativo. Ticket expira em 60 segundos e é consumido uma única vez.
- `GET /viewer?ticket=...` carrega a interface noVNC; o ticket é removido da barra de endereço imediatamente.
- `WS /viewer/ws?ticket=...` aceita somente origem igual a `MV_BROWSER_PUBLIC_ORIGIN` e ticket válido, encaminhando dados ao websockify em loopback.
- **Não habilitar acesso público ainda:** falta integrar autenticação Supabase e isolamento de sessões, testar imagem Docker e execução real, além de confirmar armazenamento privado persistente.
