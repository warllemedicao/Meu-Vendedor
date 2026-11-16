# Tarefa para ChatGPT Work — concluir migração para Chromium próprio

Repositório: warllemedicao/Meu-Vendedor
Branch de trabalho: feat/navegador-proprio-chromium
Documentação: docs/MIGRACAO_NAVEGADOR_PROPRIO.md
Base inicial: browser-service/

## Missão
Concluir, testar e integrar um navegador Chromium próprio ao Meu Vendedor, acessível por Chrome móvel, substituindo integralmente o Hyperbrowser. Reutilizar executor Python Playwright/Modal e telemetria Supabase. Não reutilizar cookies, perfis ou credenciais do fornecedor antigo. Não solicitar senhas nem salvar segredos no Git.

## Ordem de execução
1. Atualizar branch com main, inspecionar todos os arquivos e referências ao fornecedor anterior (frontend, Edge Functions, Modal, GitHub Actions, migrations, tests, docs, secrets).
2. Validar e corrigir Dockerfile, supervisord e API em browser-service; executar testes de inicialização, encerramento e concorrência. Não expor VNC sem autenticação.
3. Implementar proxy noVNC HTTPS/WebSocket autenticado, controles touch, teclado, desconexão e isolamento por usuário; usar autorização Supabase server-side com sessão de curta duração. Exigir HTTPS e restringir origem.
4. Persistir perfil do Chromium em armazenamento privado criptografado, com testes de reinício e política de exclusão; nunca gravar senha nem copiar perfil legado.
5. Implementar backend seguro de criação, visualização, status e encerramento de sessões e componente responsivo no Meu Vendedor. Não expor segredo de serviço ao browser.
6. Adaptar Modal para conectar ao navegador próprio por canal privado autenticado. Manter diagnóstico de imagens, prompt, 9:16, geração e aprovação sob autorização explícita; não clicar repetidamente nem consumir créditos em testes não autorizados.
7. Verificar limites e custo real do Hugging Face Spaces; se não suportar CDP privado e persistência, propor alternativa tecnicamente viável sem alegar gratuidade permanente.
8. Criar migração aditiva de banco para novas sessões; manter migrations históricas imutáveis; testar RLS.
9. Executar lint, typecheck, testes Python e JS, build e testes end-to-end reais sem créditos. Documentar comandos, saídas, commit e limites.
10. Após validação, substituir Edge Functions e workflows, remover dependências executáveis do Hyperbrowser, revogar segredos antigos e desativar recursos remotos. Não excluir registros históricos/auditoria sem necessidade.
11. Atualizar historico.md, criar commits, push, abrir PR e publicar somente quando a configuração e permissões permitirem. Nunca declarar deploy concluído sem verificar endpoint e versão em produção.

## Critérios de conclusão
- Interface funcional no celular, com login direto na página oficial do Google Flow.
- Controle manual e robô não concorrem pela mesma sessão.
- Navegador retoma após reinício sem vazamento de credenciais.
- Modal conectado, logs chegando ao Supabase.
- Nenhuma dependência executável do Hyperbrowser na versão final.
- Testes, deploy e evidências documentados.

## Estado inicial
Branch criada, plano documentado e base de serviço Chromium adicionada. O serviço inicial NÃO possui proxy visual autenticado, persistência validada ou integração Modal e NÃO deve ser publicado como produção.
