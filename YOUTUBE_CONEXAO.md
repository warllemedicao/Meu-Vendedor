# Conexão oficial YouTube — 06/11/2026

## Estado vigente

O responsável confirmou o login Google funcionando no Meu Vendedor. A consulta pública Auth confirmou o provedor habilitado. No projeto Google `meu-vendedor-1987` (número `531516167196`), o responsável ativou YouTube Data API v3, declarou `youtube.readonly` e `youtube.upload` e adicionou dois e-mails de teste. O projeto permanece Externo/Testando.

O runtime confirmou a presença de `GOOGLE_CLIENT_ID` e `GOOGLE_CLIENT_SECRET`, o formato do Client ID, seu vínculo ao número do projeto e a chave de cifragem existente. Nenhum valor foi divulgado. A conferência de presença não equivale a validar uma troca OAuth real com o par de credenciais.

A função Supabase `youtube-connection` v2 oferece início da autorização, retorno OAuth, estado, verificação/renovação, escolha entre canais retornados e desconexão. A central **Conta e conexões → Google e redes → YouTube** tem os controles correspondentes. Não depende do navegador remoto do Flow e não altera os provedores de geração de vídeo.

## Configuração concluída e próximos passos

No Google Auth Platform → Clientes → Meu Vendedor Web, adicionar este segundo URI de redirecionamento autorizado, mantendo o callback do login já existente:

`https://jzchlrvxdaffnrgbvabv.supabase.co/functions/v1/youtube-connection`

Depois, no aplicativo, abrir **Conta e conexões → Google e redes → YouTube → Conectar YouTube**, escolher a mesma conta Google do acesso ao Meu Vendedor e conceder as permissões. Conferir o nome do canal ao retornar e usar **Verificar canal**. Se a consulta retornar vários canais, a interface permite escolher entre eles. Após a publicação, o responsável concluiu a autorização e confirmou **canal conectado**. O registro anterior de zero conexões correspondia à consulta feita antes desse consentimento. A renovação após expiração ainda precisa de teste real; publicação de vídeos não está implementada.

## Segurança e ciclo de vida

- O POST verifica JWT com `auth.getUser`; não aceita user ID fornecido pelo navegador. O GET público de navegação/retorno exige o ticket/state esperado.
- State aleatório, desafio PKCE S256 e cookie Secure/HttpOnly/SameSite=Lax vinculado ao mesmo navegador, com duração de dez minutos. O ticket de abertura e a conclusão são consumidos uma única vez.
- Verificação de e-mail confirmado e identidade Google retornada pelo endpoint oficial userinfo. Uma conta diferente do acesso ao aplicativo não substitui a conexão.
- Tokens e verificadores cifrados com AES-GCM, AAD por usuário e domínio YouTube, usando a chave de cifragem existente no backend. Rotação da chave pode exigir reconexão.
- Tabelas `mv_youtube_connections` e `mv_youtube_oauth_states` com RLS forçada e sem acesso direto de clientes. Respostas de estado contêm somente metadados permitidos do canal/conta; tokens nunca seguem à interface.
- Renovação de access token no servidor quando uma verificação precisa dele. `invalid_grant` pede nova autorização; falhas transitórias não simulam desconexão. Atualização compara a versão cifrada original para não reconstituir uma conexão removida ou sobrescrever outra autorização.
- Conclusão e desconexão serializadas no banco. Desconectar invalida solicitações pendentes e remove os tokens locais; não revoga automaticamente todo o consentimento Google compartilhado com o login. Revogação na conta Google é uma operação separada.
- Limite de cinco pedidos de autorização pendentes por usuário em dez minutos, com limpeza dos estados expirados ao iniciar novo pedido. Não há polling automático de canais ou uploads nesta etapa.
- Em modo Testando, autorizações com permissões YouTube podem expirar após sete dias. Adicionar escopos no painel não concede acesso sem consentimento do usuário.

## Implementado e pendente

A conexão do canal foi implementada. Publicação de vídeos, fila/agendamento de uploads, métricas e demais publicadores continuam pendentes. Ter `youtube.upload` autorizado não significa que um upload foi realizado. Nenhum vídeo foi enviado, criado ou excluído no YouTube nesta entrega. Login Google não transfere sessão ou benefícios de Flow/Create/Gemini para o aplicativo.

## Implantação e validação

Frontend/Worker publicado na Cloudflare na versão `e768471a-d667-4b44-b8a4-3d76f7a30405`, preservando crons, Secrets e navegador Flow. Migração `20261106233237_youtube_connection.sql` aplicada e reconciliada com o histórico remoto. Função `youtube-connection` ACTIVE v2, com autenticação manual em POSTs. A função temporária de conferência de configuração foi desativada e retorna 410.

Suíte completa com 173 testes aprovada; após o ajuste final de concorrência, dez testes específicos YouTube, TypeScript Edge e lint aprovados. Build estático das 17 rotas aprovado, fora do sandbox após a falha ambiental conhecida de captura `--showConfig`.

Testes Chromium com sessão e respostas controladas em 1440×900 e 390×844 validaram conectar, retorno à central, consulta, desconexão preservando o login, credenciais indisponíveis e ausência de overflow. Não representam consentimento pessoal real. A função remota recusou POST anônimo com 401, retorno sem cookie com redirecionamento de erro sanitizado e ticket inexistente com 409. RLS/permissões foram conferidas remotamente; os clientes não leem tabelas de tokens nem executam funções internas. O aviso preexistente de proteção contra senhas vazadas continua nas configurações Auth.

Fontes: [OAuth Google](https://developers.google.com/identity/protocols/oauth2/web-server), [consulta de canais](https://developers.google.com/youtube/data/reference/rest/v3/channels/list), [público e expiração em testes](https://support.google.com/cloud/answer/15549945).
