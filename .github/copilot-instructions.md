# Instrucoes permanentes do Copilot — Meu Vendedor

Assim que receber a primeira solicitacao de cada nova conversa e antes de executar qualquer tarefa, siga `AGENTS.md`. A leitura e obrigatoria e deve ocorrer no contexto do agente; abrir/reabrir a pagina ou executar um script nao a substitui.

1. Identifique e liste todos os Markdown versionados pelo Git, incluindo subpastas. Leia integralmente cada arquivo, em lotes se necessario, sem pular nomes considerados irrelevantes.
2. Comece por `CONTINUAR_AMANHA.md`, `historico.md`, `HISTORICO.md`, `README.md`, `ARQUITETURA.md`, `SUPABASE.md`, `CLOUDFLARE.md`, `PUBLICACAO.md` e `INTEGRACOES.md`, quando existirem; depois leia todos os demais arquivos.
3. Nenhum resumo, listagem, contagem, script com saida descartada ou leitura fora do contexto do agente substitui a leitura efetiva integral dos documentos originais.
4. Mantenha um registro por caminho com estado integral/parcial/nao lido e informe-o antes de alterar qualquer arquivo. Se houver falha de acesso ou limite de contexto, declare quais arquivos foram afetados; nao alegue leitura completa.
5. Nao altere codigo antes de concluir a leitura integral inicial. Se limites impedirem reter todo o conteudo, informe a limitacao, mantenha o registro e releia integralmente os documentos relacionados antes de cada modificacao.
6. Recupere decisoes arquiteturais, integracoes, funcionalidades concluidas, limitacoes e pendencias, usando especialmente os registros mais recentes; confirme no codigo e no Git antes de assumir implementacao ou publicacao.
7. Antes de cada modificacao, apresente estado do projeto, pendencias, documentos lidos e contradicoes encontradas. Se documentos se contradisserem ou divergirem do codigo, informe o problema antes de prosseguir; nao escolha uma versao por suposicao.
8. Releia os documentos relacionados e verifique o codigo existente antes de cada modificacao, mesmo apos a leitura inicial.
9. Nao faca deploy, altere codigo ou modifique documentos apenas porque uma sessao comecou; preserve alteracoes locais e worktrees existentes.
10. Nao modifique o projeto `gilfinanceiro` nem registre credenciais ou Secrets em arquivos Markdown.
11. Ao concluir cada tarefa de desenvolvimento autorizada, atualize `historico.md` e `CONTINUAR_AMANHA.md` com resultados, limitacoes e pendencias.

`scripts/read-project-docs.sh` e somente um auxiliar de inicializacao: sua execucao nao incorpora os conteudos ao contexto e nao conta como leitura feita pelo agente. A simples abertura da pagina/chat tambem nao garante leitura automatica. Comece a leitura integral assim que receber a primeira solicitacao da conversa.
