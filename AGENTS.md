## Regra permanente — historico.md antes de commit manual no Codespace

Sempre que o assistente for fornecer ao responsável comandos para executar `git add`, `git commit` ou `git push` manualmente no Codespace, deverá **antes** atualizar `historico.md` com o conteúdo técnico relevante da conversa atual: decisões, escopo, alterações, commits, testes, falhas, resultados confirmados, limitações e próximos passos. Distinguir planejamento de implementação, teste de deploy e resultado real; nunca registrar segredo. Se não puder editar o repositório, informar claramente essa limitação, fornecer o trecho Markdown a ser registrado e **não apresentar o histórico como atualizado**. Preservar as demais exigências de leitura documental e de atualização de `CONTINUAR_AMANHA.md`.

# Instrucoes permanentes do Meu Vendedor

## Leitura documental obrigatoria antes de cada conversa/tarefa

1. Assim que receber a primeira solicitacao de cada nova conversa e antes de iniciar qualquer tarefa, identifique e liste todos os arquivos Markdown versionados pelo Git (`.md`, sem diferenciar maiusculas de minusculas), incluindo subpastas.
2. Leia efetivamente e integralmente o conteudo de cada arquivo listado. Leia em lotes quando necessario; nao pule arquivos por nome, localizacao ou aparente irrelevancia. Priorize primeiro, quando existirem, `CONTINUAR_AMANHA.md`, `historico.md`, `HISTORICO.md`, `README.md`, `ARQUITETURA.md`, `SUPABASE.md`, `CLOUDFLARE.md`, `PUBLICACAO.md` e `INTEGRACOES.md`; depois leia todos os demais Markdown.
3. A leitura precisa ocorrer no contexto do agente. Executar um script, listar nomes, contar arquivos, redirecionar conteudo para `/dev/null` ou produzir um resumo nao substitui a leitura integral. Nenhum resumo pode substituir os documentos originais.
4. Mantenha um registro da leitura com o caminho de cada arquivo e seu estado: integral, parcial ou nao lido. Informe esse registro antes de qualquer alteracao. Se um arquivo estiver inacessivel ou nao puder ser lido integralmente, registre-o sem declarar a etapa concluida.
5. Se o limite de contexto impedir a leitura ou retencao de todo o conjunto, informe a limitacao e os arquivos afetados. Nao altere codigo antes de concluir a leitura integral inicial. Mantenha o registro de leitura e, antes de cada modificacao, releia integralmente os documentos relacionados, verifique o codigo atual e o Git e atualize o estado informado.
6. Considere os registros mais recentes para recuperar decisoes arquiteturais, integracoes, funcionalidades concluidas, limitacoes e pendencias; confira o codigo e o Git antes de assumir que algo foi implementado ou publicado.
7. Antes de qualquer modificacao, apresente um resumo do estado do projeto, das pendencias, do registro de leitura e de contradicoes identificadas. Se houver contradicao entre documentos ou divergencia entre documentacao e implementacao, informe-a antes de prosseguir e nao a resolva por suposicao.
8. Releia os documentos relacionados e confira o codigo existente antes de cada modificacao, mesmo depois da leitura inicial completa.

## Seguranca e escopo

6. Iniciar uma sessao nao autoriza executar deploy, alterar codigo ou modificar documentos. Nenhum desses atos deve ocorrer apenas por iniciar uma sessao.
7. Preserve alteracoes locais e worktrees existentes. Nunca descarte trabalho local alheio a tarefa.
8. Nao modifique o projeto `gilfinanceiro`.
9. Nunca registre credenciais, tokens, cookies, chaves ou Secrets em arquivos Markdown.
10. Depois de cada tarefa de desenvolvimento autorizada, atualize `historico.md` e `CONTINUAR_AMANHA.md` com resultados, limitacoes e pendencias.

## Inicializacao do Codespace

O script `scripts/read-project-docs.sh` e apenas auxiliar: lista e le arquivos sem exibir seus conteudos. Sua execucao nao carrega os documentos para o contexto do Copilot e nunca conta como leitura efetiva. Abrir ou reabrir a pagina/chat, por si so, nao garante execucao automatica; inicie o procedimento documental assim que receber a primeira solicitacao da conversa.

## Diretriz declarada pelo responsável — titularidade e Google Flow (14/11/2026)

O responsável pelo repositório declarou ser maior de idade e informou que pretende autenticar-se pessoalmente no Google Flow com uma conta Google de titular maior de idade e elegível ao serviço. Trata-se de uma declaração do responsável, não de uma verificação independente de idade ou de elegibilidade pelo Google.

A integração deve disponibilizar um fluxo de acesso autorizado, respeitando as verificações do provedor, sem contornar restrições de idade ou autenticação. Não solicitar nem registrar senhas, cookies, tokens ou segredos no repositório. Diferenciar conexão de conta, automação implementada e geração real de MP4 comprovada. Esta diretriz não altera as exigências de leitura documental, testes e publicação.
