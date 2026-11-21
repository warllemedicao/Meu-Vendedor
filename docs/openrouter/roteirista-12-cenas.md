# MEU VENDEDOR — Roteirista eficiente (versão 3, 2026-11-21)

**Objetivo:** roteiro completo de 12 cenas em uma chamada gratuita, evitando consumo excessivo de tokens de saída.
**Modelo em teste no OpenRouter:** ERNIE 5.5 Flash Preview (free). Confirme o identificador exato no painel antes de configurar o Secret.
**Temperatura de referência:** 0.65
**Teto experimental de conclusão no backend:** 6000 tokens (não é cota diária nem garantia de consumo total).
**Preset:** `meu-vendedor-roteirista`
**Secret da chave:** `HIST_ROTEIRO__OPENROUTER`
**Secret opcional do preset:** `HIST_OPENROUTER_PRESET=meu-vendedor-roteirista`

## System Prompt compacto — colar nas instruções do preset

Você cria roteiros originais para o Meu Vendedor. Escreva EXATAMENTE 12 cenas de 10 segundos, com começo, conflito, duas reviravoltas preparadas por pistas e resolução na cena 12. Uma ação filmável por cena; cenas 1–11 terminam com consequência ou descoberta que leva à próxima. Preserve posições, objetos, roupas e cronologia, sem mudanças inexplicadas. Não misture unidades numéricas; evite cálculos desnecessários. Máximo 4 personagens com aparência e voz fixas. Cada cena: até 2 falas, 22 palavras somadas, em português brasileiro, um personagem por vez. Não apresente intervenções industriais inseguras como soluções. Gere APENAS JSON válido, compacto, sem Markdown, planejamento, notas ou campos extras: {"characters":[{"name":"Nome","role":"Papel","visual":"Aparência","voice":"Voz"}],"scenes":[{"title":"Título","setting":"Cenário","action":"Uma ação e consequência","characters":["Nome"],"dialogue":[{"speaker":"Nome","text":"Fala exata"}],"transition":"Gancho"}]}. Exatamente 12 objetos scenes. Todos os campos são obrigatórios, com dialogue=[] quando não houver falas. Limites em caracteres: title 65, setting 180, action 320, transition 75, visual 300, voice 120. Esta etapa é roteiro, NÃO prompts de vídeo; a geração dos 12 prompts acontece depois, sem IA.

## Pedido de teste (nova conversa, preset ativo)

Crie a história "Tomate Chefe e a Meta Impossível", comédia industrial em animação 3D de frutinhas antropomórficas. Personagens: Tomate (gerente exigente), Banana (mecânica criativa), Limão (eletricista observador). A linha de produção para inesperadamente enquanto o chefe exige uma meta aparentemente impossível. Siga o System Prompt e entregue somente o JSON com 12 cenas.

## Avaliação e limites

1. Verifique modelo efetivamente usado, tokens de entrada, saída e raciocínio, quando o painel disponibilizar.
2. Valide JSON, 12 cenas, 1–4 personagens, duas falas/22 palavras por cena e os limites de caracteres.
3. Inspecione continuidade, coerência de números, filmabilidade e final da cena 12; o validador estrutural não prova qualidade narrativa.
4. Se a conclusão for truncada, não repita automaticamente; revise o limite apenas depois de consultar usage.
5. Testes no chat OpenRouter não modificam o preset salvo nem demonstram funcionamento de uma Edge Function publicada.
6. A função atual utiliza `HIST_OPENROUTER_MODEL` se definido, senão usa Gemma free; o preset fornece instruções, mas não substitui o modelo definido na requisição.
7. Não configure fallback pago nem exponha chave em navegador, logs ou chat.

## Alteração no repositório

Em 21/11/2026 a instrução inline da ação `script` foi compactada e `SCRIPT_MAX_TOKENS` passou de 8000 para 6000. A mudança no GitHub requer publicação da Edge Function para atingir a produção. O prompt do preset no painel OpenRouter deve ser ajustado separadamente.
