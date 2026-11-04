# Escopo do produto e das páginas — Meu Vendedor

Definição confirmada pelo responsável em 04/11/2026. Documento de produto; funcionalidades futuras não devem ser apresentadas como implementadas.

## Intenção

Construir um app web central de interação e gerenciamento de programas de afiliados. O usuário deverá organizar contas, produtos, links e resultados de diferentes plataformas no mesmo painel.

Plataformas do escopo básico atual: **Shopee, TikTok, Mercado Livre, Amazon e Magazine Luiza**. A inclusão de outras plataformas fica para evolução posterior. TikTok Shop será tratado dentro do planejamento TikTok quando necessário, preservando as autorizações específicas de cada produto. A cobertura será ampliada por conectores independentes. Suporte automático depende da existência de recursos oficiais adequados e da autorização concedida à conta.

A referência ForneceUp orienta a apresentação e a organização visual. O foco confirmado do Meu Vendedor é gerenciamento de afiliados. IA, vídeos e automações continuam como possibilidades posteriores; a prioridade é consolidar o gerenciamento e as integrações.

## Escopo das páginas

| Página | Finalidade planejada | Situação real |
| --- | --- | --- |
| Apresentação pública | Explicar o produto, plataformas contempladas e acesso ao app; ajuda e dúvidas frequentes | Planejada; `/` atualmente redireciona para o dashboard |
| Dashboard | Resumo de contas, produtos, links e resultados; filtros por plataforma e período | Existe com dados demonstrativos |
| Contas Conectadas | Mostrar plataformas, requisitos, capacidades, autorizações e erros; conectar e revogar quando houver fluxo real | Catálogo informativo de quatro plataformas; sem autorização real |
| Produtos | Reunir produtos de fontes autorizadas; pesquisa, categoria, plataforma e favoritos | Página de apresentação; operações futuras |
| Afiliados / Meus links | Cadastrar links próprios, associar produto, plataforma e campanha; editar e arquivar | CRUD manual implementado com Supabase e RLS |
| Relatórios | Exibir métricas disponíveis por origem e período, com data de atualização | Página de apresentação; sem métricas reais |
| Configurações | Perfil, preferências e gestão das permissões do usuário | Perfil implementado com Supabase Auth e RLS |
| Ajuda | Instruções originais para configurar e usar o Meu Vendedor | Planejada; sem rota criada |
| Tendências, Top 10, Vídeos, Publicações, Automações | Evolução posterior, após a base de gerenciamento | Rotas existentes; funcionalidades não implementadas |

Não publicar planos, preços, cursos ou promessas de resultados sem uma definição comercial própria.

## Fluxo principal planejado

Acessar o app → identificar a plataforma → conferir requisitos → autorizar a conta quando disponível → organizar produtos e links → acompanhar os resultados que a fonte efetivamente fornecer.

Antes de haver conector real, o catálogo deverá continuar informando a ausência de conexão. Cadastro manual de links é uma alternativa de organização futura e não constitui integração automática.

## Primeiro ciclo de APIs — plano de execução

O responsável definiu que contas de afiliado previamente aprovadas não são requisito para construir ou usar o catálogo básico. O app deverá oferecer links oficiais para entrar na plataforma ou solicitar afiliação, quando os respectivos endereços forem verificados. Esse redirecionamento não conecta a conta ao Meu Vendedor nem comprova aprovação; o cadastro acontece na própria plataforma. A aprovação e o acesso à API serão exigidos somente quando uma operação integrada realmente depender deles.

1. **Base interna:** API backend FastAPI, PostgreSQL e migrações, autenticação do Meu Vendedor e isolamento dos dados por usuário. Nenhuma destas peças existe hoje.
2. **Gerenciamento próprio:** contas, links e campanhas persistidos; validação de entrada e autorização por proprietário. Ainda sem depender de APIs de terceiros.
3. **Segurança de integrações:** segredos somente no servidor, tokens cifrados, auditoria sanitizada, callback seguro e renovação/revogação conforme o provedor.
4. **Primeira plataforma:** escolher conforme conta aprovada e acesso oficial disponível; confirmar documentação, papel da conta, região, escopos e limites antes de implementar o adaptador.
5. **Primeira operação:** executar uma leitura autorizada de escopo reduzido, tratar erros reais e exibir origem e horário de atualização; sem simular dados ou autorização.
6. **Expansão:** adicionar as próximas plataformas após testes do primeiro fluxo completo. Cada recurso será habilitado separadamente; uma conexão não habilita todas as capacidades.

Os passos acima são planejamento. Este documento não cria backend, credenciais, OAuth ou chamadas externas e não inicia automaticamente novas etapas.

## Critérios para considerar uma integração entregue

- Documentação e permissões do recurso verificadas para o programa de afiliados e a conta alvo.
- Autorização legítima; credenciais ausentes do navegador, Git e logs.
- Dados isolados por usuário e operações verificadas no backend.
- Estados reais de autorização, erro e sincronização, incluindo expiração e revogação.
- Testes de contrato e falhas relevantes; TypeScript, linter e build aprovados.
- Interface diferencia ausência de dados, dados manuais, demonstração e informações sincronizadas.

## Limites do escopo confirmado

O objetivo de reunir todas as plataformas é uma direção de expansão, não uma declaração de cobertura atual. A inclusão de Magazine Luiza está confirmada no planejamento, mas o conector e sua pesquisa técnica ainda não foram implementados. Uma API de vendedor, um login social e uma API de afiliados devem ser avaliados separadamente. Não presumir recursos de comissão ou links por haver uma API de marketplace.

## Preparação do Supabase

O projeto `meu-vendedor` (`jzchlrvxdaffnrgbvabv`) foi autorizado e configurado com migração e RLS aplicadas. Auth, perfil e CRUD de links foram verificados na API hospedada. A hospedagem pública do frontend está no Cloudflare Workers. O endereço do site não concede acesso administrativo ao banco. A entrega de e-mails de confirmação/recuperação permanece a validar.
