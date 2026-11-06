# ElevenLabs — verificação em 06/11/2026

## Resultado no projeto

O inventário do Meu Vendedor reconhece ElevenLabs como serviço de áudio e consulta `GET https://api.elevenlabs.io/v1/user/subscription` usando o cabeçalho `xi-api-key`. Nomes aceitos: `ELEVENLABS_API_KEY` (recomendado), `ELEVENLABS_API`, `ELEVEN_LABS_API_KEY` e `XI_API_KEY`. A consulta usa somente GET, timeout, limite de resposta e resumo permitido; não executa síntese nem consome créditos de geração.

O diagnóstico foi publicado no Supabase: `video-generation` v38 e `video-generation-worker` v23. A chave foi localizada sob o nome **`ELEVENLABS_API`**, agora aceito como alias, sem expor ou copiar seu valor. Não é necessário cadastrá-la novamente.

A consulta real de 06/11 às 16:41 UTC foi autenticada e retornou plano **Free**, limite de **10.000 créditos**, uso **0** e restante **10.000**. A API respondeu subscription_status=free. O timestamp de renovação retornado é anterior à data desta revisão; não foi apresentado como próxima renovação garantida. A auditoria persiste somente os campos permitidos, sem dados pessoais, segredos ou detalhes de cobrança.

O cartão informa o saldo real, mas a integração de geração de áudio permanece pendente. Plano Free não inclui licença comercial. Nenhum áudio foi gerado e nenhum crédito de síntese foi consumido pela verificação.

## Recursos gratuitos e aplicação

A página pública consultada informa plano Free com **10 mil créditos mensais** e recursos de texto para fala, transcrição, efeitos sonoros, criação de voz e música. O acesso a cada operação depende das permissões da chave, modelo e plano real. Não confundir créditos com minutos fixos: consumo varia por recurso/modelo.

Para o Meu Vendedor, narração em português, transcrição para legendas e efeitos sonoros são possibilidades úteis. Contudo, os termos oficiais dizem que o plano Free **não inclui licença comercial**. Conteúdo publicado não comercialmente exige atribuição; serviços Beta também têm restrições. Portanto, a franquia Free não foi habilitada automaticamente na produção de vídeos publicitários. Planos pagos oferecem licença comercial sujeita aos termos específicos, mas não foram contratados nem ativados nesta entrega.

## Próximo passo

A credencial e o plano já foram confirmados. É possível avaliar recursos em testes não comerciais dentro da franquia. Para anúncios, é necessário um plano/licença compatível; nenhum plano foi alterado. Antes de oferecer áudio no botão Gerar vídeo, implementar síntese, armazenamento privado e composição/sincronização com vídeo, validando também os termos específicos do recurso. Consulta de saldo não equivale a adaptador de síntese pronto.

Fontes oficiais consultadas:

- [Planos e franquia Free](https://elevenlabs.io/pricing)
- [API e recursos](https://elevenlabs.io/pricing/api)
- [Autenticação por chave](https://elevenlabs.io/docs/api-reference/authentication)
- [Consulta de assinatura](https://elevenlabs.io/docs/api-reference/user/subscription/get)
- [Licença e publicação comercial](https://elevenlabs.io/docs/help-center/legal/can-i-publish-the-content-i-generate-on-the-platform)
