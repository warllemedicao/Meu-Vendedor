# Narração Google Chirp 3 HD — 07/11/2026

## Entregue

Cloud Text-to-Speech substitui ElevenLabs em novas narrações do estúdio. Os Secrets `GOOGLE_TTS_PROJECT_ID` e `GOOGLE_TTS_SERVICE_ACCOUNT_JSON` foram cadastrados pelo responsável e validados no backend; projeto `meu-vendedor-1987`. O catálogo real retornou 30 vozes Chirp 3 HD em português brasileiro. Não imprimir credenciais, JWTs, chaves privadas ou URLs assinadas em logs/documentação.

| Personagem | Voz fixa inicial |
|---|---|
| Ana | `pt-BR-Chirp3-HD-Aoede` |
| Carla | `pt-BR-Chirp3-HD-Kore` |
| Rafael | `pt-BR-Chirp3-HD-Charon` |
| Lucas | `pt-BR-Chirp3-HD-Puck` |

O seletor mantém a voz fixa como padrão e permite alternativas filtradas pelo tipo selecionado. Trocar personagem reinicia a seleção; mudar o roteiro invalida a reprodução do áudio anterior como se fosse do novo texto. A identidade vocal é a da voz nomeada pelo Google, não uma cópia da biblioteca ElevenLabs. Avaliação subjetiva das quatro vozes pelo responsável permanece necessária. Referências visuais de Carla/Rafael continuam sendo uma pendência independente.

## Teste real

Foram criadas duas contas temporárias confirmadas administrativamente, sem envio de e-mail, removidas após os testes. A função de produção `audio-generation` foi chamada com sessões reais. Foram geradas quatro frases curtas, uma por personagem, e arquivadas privadamente em `operator/google-tts-20261107/`. Resultados técnicos não foram adicionados à biblioteca de um lojista.

| Personagem | MP3 | Duração decodificada | Síntese, entrega e arquivo privado |
|---|---:|---:|---:|
| Ana | 24.384 bytes | 6,096 s | 1,933 s |
| Carla | 25.632 bytes | 6,408 s | 2,658 s |
| Rafael | 22.464 bytes | 5,616 s | 1,975 s |
| Lucas | 21.024 bytes | 5,256 s | 2,012 s |

MP3s decodificados em Chromium; SHA-256 dos arquivos locais corresponde aos hashes registrados na auditoria `google-tts-integration-20261107`. A medição de tempo inclui chamada da função e arquivamento técnico, não carregamento visual da página ou criação de vídeo. Quatro amostras não estabelecem SLA.

Reenvio da primeira solicitação devolveu o mesmo ID com `cached=true`, sem nova síntese. Outra conta recebeu 404 ao consultar o áudio. Os objetos temporários dos usuários foram removidos, os arquivos técnicos privados preservados e nenhuma conta de teste permaneceu. Diagnóstico `google-tts-verification` encerrado com HTTP 410.

## Limite de consumo

Migração `20261107233234_google_tts_budget.sql` aplicada e reconciliada com o histórico remoto. `mv_claim_google_audio` reserva caracteres sob trava global no PostgreSQL, antes da síntese. Duplicatas não reservam novamente. Reserva mensal UTC persiste na tabela interna `mv_google_tts_usage` mesmo após exclusão de conta, falha ou resposta incerta. Não liberar reservas incertas automaticamente.

Teto padrão: **900.000 caracteres/mês para o aplicativo**. O Secret opcional `GOOGLE_TTS_MONTHLY_CHARACTER_LIMIT` pode reduzir esse limite; não permite ultrapassar 900.000 pelo runtime. As quatro amostras reservaram 287 caracteres. A tabela tem RLS forçada, sem acesso de clientes; as RPCs são exclusivas do backend.

Isso não é saldo oficial do Google nem um bloqueio de faturamento de todo o projeto. Uso pelo console, outras aplicações, modelos ou serviços pode gerar cobrança fora do controle local. A franquia publicada de Chirp 3 HD é de 1 milhão de caracteres/mês; conferir contrato e tabela vigente. Não confundir com Gemini TTS, Flow ou créditos de login OAuth.

## Segurança e publicação

- Autenticação da sessão em cada operação, propriedade do resultado e Storage privado preservados.
- OAuth da conta de serviço assinado via Web Crypto; hosts de token e API fixos; redirects recusados; respostas limitadas e erros sanitizados.
- Cache de áudio inclui usuário, texto, voz, modelo e finalidade, separado dos resultados ElevenLabs anteriores.
- ElevenLabs permanece somente no histórico/compatibilidade e não é usado como fallback de voz. Seu Secret não foi apagado.
- Supabase `audio-generation` v13, `video-generation` v53 e `video-generation-worker` v37. Nos dois últimos, apenas inventário/auditoria foram atualizados sobre os arquivos remotos, preservando o restante do runtime.
- Frontend final: Cloudflare `8b342aae-1ead-4fa7-aec0-24720ad68d2e`; crons e Secrets preservados.
- Suíte completa com 214 testes aprovados; cinco testes Google focados passaram após o ajuste final de credencial JSON nula. Lint, TypeScript frontend/Edge e build estático de 17 rotas aprovados. Chromium desktop/celular com sessão/respostas controladas verificou seletor, voz padrão e filtro; os MP3s reais foram decodificados separadamente no mesmo navegador.

## Limite da entrega e continuidade sincronizada

Disponível: voz Google, prévia, download MP3, histórico privado e exportação local opcional de um vídeo concluído com a narração. A exportação local não faz lip sync e pode manter o último quadro se a fala for mais longa.

**Atualização em 08/11:** o piloto automático Google → MuseTalk/Kaggle → FFmpeg → MP4 privado foi implementado e gerou um vídeo real. Não foi liberado como produção comercial: a região da boca precisa de ajuste e bases aprovadas ainda não estão disponíveis aos usuários. A função separada `hybrid-video` cuida desta fila; selecionar uma voz na seção de prévia não altera sozinho um job antigo.

Estado, medições, pendências e versões posteriores em [ARQUITETURA_VIDEO_SINCRONIZADO.md](./ARQUITETURA_VIDEO_SINCRONIZADO.md).

Fontes: [API](https://docs.cloud.google.com/text-to-speech/docs/reference/rest/v1/text/synthesize), [Chirp 3 HD](https://docs.cloud.google.com/text-to-speech/docs/chirp3-hd), [preços](https://cloud.google.com/text-to-speech/pricing), [MuseTalk](https://github.com/TMElyralab/MuseTalk).
