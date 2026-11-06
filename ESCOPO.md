# Escopo do produto e das páginas — Meu Vendedor

> **Conta e estratégia Google — 06/11/2026:** acesso e lojas centralizados em `/entrar`; fluxo OAuth Google implementado, mas provedor remoto ainda desabilitado e dependente de Client ID/Secret. Links externos do Flow removidos do estúdio. Nova direção: geração via navegador no servidor e publicação integrada, ainda não implantadas. Estado vigente e ativação em [CONTA_E_ESTRATEGIA_GOOGLE.md](./CONTA_E_ESTRATEGIA_GOOGLE.md).

Definição confirmada pelo responsável em 04/11/2026 e estado técnico revisado em 06/11/2026. Documento de produto; funcionalidades futuras não devem ser apresentadas como implementadas. Os planos antigos são mantidos como histórico, mas o quadro abaixo representa a situação atual.

Atualização do catálogo: o responsável acrescentou SHEIN e AliExpress à pesquisa e à página inicial de produtos. A rota `/` agora tem catálogo no código, sem redirecionamento ao dashboard. Consultas Amazon, Mercado Livre, TikTok Shop e AliExpress foram implementadas na função `catalog`, condicionadas à publicação/configuração por usuário e validação real; Magalu/SHEIN ainda sem contrato de afiliados confirmado. O CRUD de links continua com as cinco plataformas originais. Situação atual em `CATALOGO_APIS.md`; a tabela e os planos antigos abaixo preservam o escopo anterior.

## Intenção

Requisito corrigido pelo responsável: mostrar os produtos sem exigir conexão de contas das lojas. Conectar o perfil de afiliado é uma ação posterior e deverá usar consentimento na própria plataforma quando houver suporte oficial. App IDs e segredos de aplicação são configuração técnica do serviço, não o fluxo esperado para o usuário comum. A implementação publicada ainda exige autenticação/configuração por usuário e precisa ser reestruturada para atender esse requisito. Não substituir um fluxo de autorização ausente por um botão que apenas abre o portal e aparenta conectar.

Construir um app web central de interação e gerenciamento de programas de afiliados. O usuário deverá organizar contas, produtos, links e resultados de diferentes plataformas no mesmo painel.

Plataformas do escopo básico atual: **Shopee, TikTok, Mercado Livre, Amazon e Magazine Luiza**. A inclusão de outras plataformas fica para evolução posterior. TikTok Shop será tratado dentro do planejamento TikTok quando necessário, preservando as autorizações específicas de cada produto. A cobertura será ampliada por conectores independentes. Suporte automático depende da existência de recursos oficiais adequados e da autorização concedida à conta.

A referência ForneceUp orienta a apresentação e a organização visual. O foco confirmado do Meu Vendedor é gerenciamento de afiliados. O pipeline de vídeo assíncrono e seus adaptadores estão implementados e cobertos por testes locais; geração paga real permanece bloqueada até confirmar configurações, direitos comerciais, créditos e limites. Publicação e automações continuam dependentes de integrações posteriores.

## Escopo das páginas

| Página | Finalidade planejada | Situação real |
| --- | --- | --- |
| Apresentação pública | Explicar o produto, plataformas contempladas e acesso ao app; ajuda e dúvidas frequentes | `/` exibe a vitrine pública de três lojas; fontes comerciais ainda não configuradas |
| Dashboard | Resumo de contas, produtos, links e resultados; filtros por plataforma e período | Reutiliza a vitrine pública; métricas agregadas reais ainda pendentes |
| Contas Conectadas | Mostrar plataformas, requisitos, capacidades, autorizações e erros; conectar e revogar quando houver fluxo real | Cinco plataformas no catálogo; conector Shopee implementado, sem credencial real validada |
| Produtos | Reunir produtos de fontes autorizadas; pesquisa, categoria, plataforma e favoritos | Catálogo Shopee sincronizado quando houver conexão válida; demais fontes privadas dependem de credenciais |
| Afiliados / Meus links | Cadastrar links próprios, associar produto, plataforma e campanha; editar e arquivar | CRUD manual implementado com Supabase e RLS |
| Relatórios | Exibir métricas disponíveis por origem e período, com data de atualização | Página de apresentação; sem métricas reais |
| Configurações | Perfil, preferências e gestão das permissões do usuário | Perfil implementado com Supabase Auth e RLS |
| Ajuda | Instruções originais para configurar e usar o Meu Vendedor | Planejada; sem rota criada |
| Vídeos IA | Preparar e gerar anúncios de produto | Estúdio, fila autenticada, worker, polling e adaptadores Cloudflare Workers AI/Magic Hour/Replicate implementados. Geração real não validada nem autorizada; pendem credenciais/configuração, direitos comerciais, saldo e limites. |
| Tendências, Top 10, Publicações, Automações | Evolução posterior, após a base de gerenciamento | Rotas existentes; funcionalidades reais ainda não implementadas |

Não publicar planos, preços, cursos ou promessas de resultados sem uma definição comercial própria.

## Fluxo principal planejado

Acessar o app → identificar a plataforma → conferir requisitos → autorizar a conta quando disponível → organizar produtos e links → acompanhar os resultados que a fonte efetivamente fornecer.

Antes de haver conector real, o catálogo deverá continuar informando a ausência de conexão. Cadastro manual de links é uma alternativa de organização futura e não constitui integração automática.

## Primeiro ciclo de APIs — plano de execução

O responsável definiu que contas de afiliado previamente aprovadas não são requisito para construir ou usar o catálogo básico. O app deverá oferecer links oficiais para entrar na plataforma ou solicitar afiliação, quando os respectivos endereços forem verificados. Esse redirecionamento não conecta a conta ao Meu Vendedor nem comprova aprovação; o cadastro acontece na própria plataforma. A aprovação e o acesso à API serão exigidos somente quando uma operação integrada realmente depender deles.

1. **Base interna — concluída:** Supabase Auth, PostgreSQL, migrações e isolamento por RLS. FastAPI deixou de ser pré-requisito e permanece opcional para processamento especializado.
2. **Gerenciamento próprio — concluído para links e perfil:** contas do Meu Vendedor, perfil, links e biblioteca de vídeos persistidos com validação por proprietário.
3. **Segurança de integrações — implementada para Shopee:** segredos no servidor, AES-GCM, erros sanitizados, concorrência e revogação local; falta validar credencial comercial real.
4. **Primeira plataforma — implementada no código:** adaptador Shopee conforme contrato oficial; ativação real depende da conta aprovada e de uma chamada autorizada bem-sucedida.
5. **Primeira operação — pendente em produção:** executar leitura com credencial Shopee real, confirmar campos e limites e registrar o resultado sem simulação.
6. **Expansão:** adicionar as próximas plataformas após testes do primeiro fluxo completo. Cada recurso será habilitado separadamente; uma conexão não habilita todas as capacidades.

Os itens marcados como concluídos refletem código e verificações já entregues. As etapas pendentes não autorizam criação de credenciais, faturamento ou chamadas externas por conta própria.

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

O projeto `meu-vendedor` (`jzchlrvxdaffnrgbvabv`) foi autorizado e configurado. Cinco migrações existem no repositório; as últimas migrações e o worker de vídeo constam como publicados/aplicados nos registros remotos anteriores, sem revalidação Supabase nesta revisão. Auth, perfil e CRUD de links foram verificados na API hospedada; conexões, produtos e vídeos têm tabelas com RLS. A geração paga permanece sem autorização/configuração confirmada. O endereço do site não concede acesso administrativo ao banco. A entrega de e-mails de confirmação/recuperação permanece a validar.
