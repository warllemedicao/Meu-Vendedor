## Seleção e upload simplificados — 21/11/2026

Na aba **Personagens da história**, as miniaturas existentes foram reduzidas, com opções por item para **Renomear** e **Excluir**. O cadastro visível usa um único botão **Enviar imagens**, com múltipla seleção de arquivos e um campo de nome para cada personagem antes da gravação. A descrição visual deixou de ser obrigatória para uploads manuais; não há necessidade de chamar qualquer API para registrar personagens.

A exclusão é protegida: imagens usadas em roteiros salvos não são removidas até que sua referência seja desvinculada. Todo registro é isolado por `user_id`, e o caminho privado do Storage é conferido antes da limpeza. O histórico de roteiros não é reescrito quando imagens são renomeadas na biblioteca.

# Histórias — geração, cadastro e reutilização de imagens

Atualização: 21/11/2026.

## Interface simples

Na etapa **Personagens e imagens**, cada personagem mostra sua miniatura, uma caixa **Como você quer este personagem?** e o comando **Gerar e salvar imagem**. Biblioteca, seleção de outras imagens, edição de ficha, envio manual e administração continuam disponíveis em painéis recolhidos, sem poluir a tela principal.

## Persistência e continuidade

O comando de geração usa `story-studio` → `image_character`, converte o retorno de imagem válido em arquivo, envia ao bucket privado `mv-story-images` e registra uma nova linha em `mv_story_characters`. A imagem é vinculada ao personagem do projeto, sem sobrescrever versões anteriores. Nomes de novas imagens geradas recebem um identificador único. O usuário pode baixar a imagem e escolher referências anteriores.

A biblioteca `mv_story_characters` também é utilizada na etapa anterior ao roteiro: **Histórias → Temas → Personagens da história**. O campo `image_prompt` é aproveitado pelo Gemini como característica visual estável; `storage_path` é mantido como referência privada. Ao transformar as cenas em prompts de vídeo, as falas continuam em português brasileiro e os limites editoriais das plataformas permanecem válidos.

## Gratuidade e autorização

A presença de uma chave Gemini não constitui prova de gratuidade. O modelo atualmente configurado é `gemini-3.1-flash-lite-image` (Nano Banana 2 Lite), cuja API não tem faixa gratuita anunciada. O backend exige **ambos** `HIST_IMAGEM_GEMINI_API_KEY` e `HIST_IMAGEM_API_PAGA_AUTORIZADA=true` antes de executar geração de imagem; a autorização não é definida automaticamente.

Sem essa autorização, o botão permanece desabilitado, e o usuário pode criar a imagem no Google AI Studio e importar manualmente. O novo cadastro pré-roteiro também permite upload manual de PNG/JPG/WebP (até 10 MB). Nenhuma chamada paga foi autorizada ou realizada como parte desta implementação.

## Escopo e controles

- O bucket e a tabela permanecem isolados por usuário autenticado (RLS).
- Nenhuma imagem privada é exposta como URL permanente.
- Não alterar os arquivos IMAGEM1/IMAGEM2/IMAGEM3 nem a automação Chrome/Modal do Flow.
- Não alterar chaves de Produtos e Campanhas nem pressupor créditos gratuitos em outros serviços.
- Validar CI, deployment Cloudflare e execução real após publicar.
