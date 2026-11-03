# Matriz de testes — ImobiTech US01–US07

Referência: DRS 2.1 e Arquitetura 2.1, conforme [decisão de escopo](ESCOPO_MVP.md). Os identificadores CA foram atribuídos nesta matriz, na ordem dos critérios do DRS. **Aprovado** significa assertiva executada em PostgreSQL real. Consulte também a [matriz de rastreabilidade](MATRIZ_RASTREABILIDADE_MVP.md).

## Critérios de aceite do DRS

| Caso | História | Cenário e resultado esperado | Evidência automatizada | Resultado |
|---|---|---|---|---|
| CA01.1 | US01 | Conta ativa com credenciais válidas autentica nos quatro perfis | `backend/test/integration.test.ts`: T1.01/T1.02 | Aprovado |
| CA01.2 | US01 | Credenciais inválidas são negadas sem revelar dados sensíveis | `integration.test.ts`: T1.03/T1.04 | Aprovado |
| CA02.1 | US02 | Administrador cadastra usuário válido e persiste | `integration.test.ts`: T1.05 | Aprovado |
| CA02.2 | US02 | Alteração de dados/perfil é persistida | `integration.test.ts`: T1.06/T1.07 | Aprovado |
| CA02.3 | US02 | Perfil não administrativo é bloqueado no gerenciamento | `integration.test.ts`: T1.08/T1.15 | Aprovado |
| CA03.1 | US03 | Administrador/corretor cadastra imóvel válido | `integration.test.ts`: T1.10/T1.13 | Aprovado |
| CA03.2 | US03 | Edição de imóvel aparece na consulta posterior | `integration.test.ts`: T1.11 | Aprovado |
| CA03.3 | US03 | Imóvel com contrato ativo aparece indisponível | `backend/test/rental.test.ts`: fluxo completo | Aprovado |
| CA04.1 | US04 | Corretor agenda visita em imóvel disponível e horário livre | `rental.test.ts`: fluxo completo | Aprovado |
| CA04.2 | US04 | Conflito por imóvel ou corretor impede segundo agendamento | `rental.test.ts`: fluxo e conflitos independentes | Aprovado |
| CA04.3 | US04 | Cancelamento de visita futura persiste estado Cancelada | `rental.test.ts`: fluxo completo | Aprovado |
| CA05.1 | US05 | Contrato válido ativa locação e altera disponibilidade | `rental.test.ts`: fluxo completo | Aprovado |
| CA05.2 | US05 | Segundo contrato ativo para o mesmo imóvel é rejeitado | `rental.test.ts`: concorrência e rollback | Aprovado |
| CA05.3 | US05 | Encerramento persiste e libera imóvel novamente | `rental.test.ts`: fluxo completo | Aprovado |
| CA06.1 | US06 | Lançamento válido persiste e situação é recalculada | `rental.test.ts`: fluxo completo | Aprovado |
| CA06.2 | US06 | Lançamento vencido e não pago aparece atrasado | `rental.test.ts`: fluxo completo | Aprovado |
| CA06.3 | US06 | Dados financeiros inválidos são rejeitados sem gravação | `rental.test.ts`: conflitos e entradas inválidas | Aprovado |
| CA07.1 | US07 | Inquilino consulta apenas financeiro de contrato próprio | `rental.test.ts`: fluxo e isolamento bilateral | Aprovado |
| CA07.2 | US07 | Proprietário consulta apenas contratos de seus imóveis | `rental.test.ts`: fluxo e isolamento bilateral | Aprovado |
| CA07.3 | US07 | Usuário sem vínculo/permissão não lê financeiro alheio | `rental.test.ts`: fluxo e isolamento bilateral | Aprovado |

## Regras de negócio

| Regra | Verificação executada | Evidência | Resultado |
|---|---|---|---|
| RN-001 | Conta inativa e senha incorreta não abrem sessão | `integration.test.ts`: T1.03/T1.04 | Aprovado |
| RN-002 | 401 sem sessão, 403 sem perfil, 404 para vínculo alheio | `integration.test.ts`: T1.08/T1.15; `rental.test.ts`: isolamento | Aprovado |
| RN-003 | E-mail e identificador duplicados rejeitados | `integration.test.ts`: T1.09 | Aprovado |
| RN-004 | Perfil principal único e válido | `integration.test.ts`: T1.09; `validation.test.ts` | Aprovado |
| RN-005 | Imóvel exige proprietário cadastrado, ativo e correto | `integration.test.ts`: T1.12; `rental.test.ts`: vínculos | Aprovado |
| RN-006 | Situação inicial/contratual válida e indisponibilidade protegida | `integration.test.ts`: T1.10/T1.13; `rental.test.ts` | Aprovado |
| RN-007 | Visita exige imóvel, horário, corretor e participante | `rental.test.ts`: fluxo e entradas inválidas | Aprovado |
| RN-008 | Sobreposição por imóvel/corretor bloqueada sob concorrência | `rental.test.ts`: fluxo e conflitos | Aprovado |
| RN-009 | Contrato exige imóvel, proprietário correspondente e inquilino | `rental.test.ts`: vínculos inválidos e rollback | Aprovado |
| RN-010 | Um contrato ativo por imóvel | `rental.test.ts`: concorrência | Aprovado |
| RN-011 | Ativação/encerramento sincronizam disponibilidade | `rental.test.ts`: fluxo completo | Aprovado |
| RN-012 | Lançamento exige contrato existente | `rental.test.ts`: fluxo e vínculo inválido | Aprovado |
| RN-013 | Vencido sem baixa aparece atrasado; pago deixa de estar aberto | `rental.test.ts`: fluxo completo | Aprovado |
| RN-014 | Proprietário/inquilino só veem vínculos próprios | `rental.test.ts`: fluxo e isolamento bilateral | Aprovado |

## Requisitos não funcionais

| Requisito | Verificação e resultado | Limite da evidência |
|---|---|---|
| RNF-001 | [50 usuários/sessões independentes](evidence/mvp/50-users.json): p95 381 ms em execução local; [repetição Docker](evidence/mvp/backend-docker.txt): p95 113 ms. [Teste HTTPS](evidence/mvp/performance.json): 50 consultas, p95 302 ms; sete gravações abaixo de 3 s. | Amostras de homologação; 50 usuários via Fastify inject, sem rede/TLS. |
| RNF-002 | Reinício automático, `/api/health` e [amostra do monitor](evidence/mvp/availability-sample.json). | **Meta de 99% mensal ainda não comprovada**; requer um mês de operação medida. |
| RNF-003 | [HTTPS](evidence/mvp/https.txt): TLS confiável, redirecionamento 308, cookie Secure/HttpOnly/SameSite, HSTS/CSP. | CA local confiada na homologação. |
| RNF-004 | 401/403/404 e negação por vínculo nos testes. | Cobertura das rotas protegidas do MVP. |
| RNF-005 | Campos mínimos, hash ausente das respostas, acesso por vínculo nos testes. | Avaliação técnica; operação em [POLITICA_DADOS.md](POLITICA_DADOS.md). |
| RNF-006 | Hash Argon2id no banco; login e sessão opaca testados. | Teste de integração. |
| RNF-007 | [8 testes de interface](evidence/mvp/browser-results.json) e capturas em 390, 768 e 1440 px; sem overflow horizontal. | Viewports, não aparelhos físicos. |
| RNF-008 | [3 fluxos](evidence/mvp/compatibility.json) aprovados em Chrome, Edge e Firefox. | Navegadores em Linux/container. |
| RNF-009 | FKs, transações, exclusão de intervalos, unicidade parcial e rollback em PostgreSQL real. | Testes de integração. |
| RNF-010 | Backup automático e [restauração isolada](evidence/mvp/restore.txt) aprovados. | Requer computador/Docker ligados. |
| RNF-011 | Ator, horário, antes/depois em contrato/pagamento; edição/exclusão de eventos negadas. | `backend/test/rental.test.ts`: histórico. |
| RNF-012 | [Build](evidence/build.txt) aprovado; frontend/backend, controller/service/repository e SQL versionado revisados. | Inspeção estrutural. |

## Extensão posterior ao DRS: fotos dos imóveis

| Caso | Cenário | Evidência | Resultado |
|---|---|---|---|
| FOTO-01 | Administrador/corretor enviam PNG válido; a foto aparece na listagem e no detalhe e permanece após reinício da API | `backend/test/property-photos.test.ts`; [log Docker](evidence/mvp/property-photos-docker.txt) | Aprovado |
| FOTO-02 | Proprietário vinculado visualiza; proprietário alheio recebe 404; inquilino não acessa; proprietário não envia | Mesmo teste | Aprovado |
| FOTO-03 | Conteúdo inválido, MIME divergente e arquivo acima de 5 MB são rejeitados; limite de 10 fotos aplicado | Mesmo teste | Aprovado |
| FOTO-04 | Administrador remove foto; arquivo local e metadado deixam de ser acessíveis | Mesmo teste | Aprovado |
| FOTO-05 | Clique na foto do detalhe ou na área de edição abre o seletor e inicia o envio ao escolher arquivos; no cadastro novo, a seleção aguarda o primeiro salvamento | Verificação em Chrome local com imóvel/API simulados; backend real coberto em FOTO-01–04 | Aprovado |

Esta extensão foi solicitada depois do DRS/Arquitetura 2.1 e não é apresentada como critério de aceite original. A suíte atual passou **27/27 testes no Docker**. Os 8 testes de interface e os 3 fluxos entre navegadores citados acima foram executados antes da extensão de fotos.

## Busca nos formulários de contrato e visita

| Caso | Cenário | Evidência | Resultado |
|---|---|---|---|
| BUSCA-01 | Imóveis disponíveis e inquilinos cadastrados aparecem imediatamente como opções selecionáveis no novo contrato | `backend/test/rental.test.ts`; [suíte Docker](evidence/mvp/lookup-docker.txt); [verificação no Chrome](evidence/mvp/lookup-ui.txt) | Aprovado |
| BUSCA-02 | Busca de inquilino por e-mail e de imóvel por endereço retorna cadastros elegíveis; imóvel indisponível não aparece | Mesma suíte e verificação de interface | Aprovado |
| BUSCA-03 | Imóvel disponível cadastrado aparece como opção em Agendar visita | [Verificação no Chrome](evidence/mvp/lookup-ui.txt) | Aprovado |

Esta melhoria de usabilidade foi solicitada após a matriz original.

## Reprodução

Os testes de backend usam schemas temporários em banco de teste separado e dados fictícios. A suíte atual teve **27/27 aprovações no Docker**; o [log Docker anterior](evidence/mvp/backend-docker.txt) registra 25/25 antes das fotos e o [log local](evidence/mvp/backend-tests.txt) corresponde à suíte anterior de 23 testes. Consulte [registro de execuções](evidence/mvp/EXECUCOES.md), [log atual](evidence/mvp/lookup-docker.txt) e [guia do professor](../GUIA_PROFESSOR.md). Execute `npm.cmd test` com `TEST_DATABASE_URL` terminando em `_test`. O guia traz os comandos Docker para build, migrations e interface. Evidências em `docs/evidence/` fora de `mvp/` pertencem à v0.1.
