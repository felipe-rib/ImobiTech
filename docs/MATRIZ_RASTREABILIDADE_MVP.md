# Matriz de rastreabilidade — ImobiTech MVP

Fonte normativa desta entrega: DRS Ajustado 2.1 e Documento de Arquitetura Ajustado 2.1. A escolha do responsável e as divergências com o Documento de Visão original estão em [ESCOPO_MVP.md](ESCOPO_MVP.md). Os códigos CA foram atribuídos pela [matriz de testes](MATRIZ_MVP.md) seguindo a ordem dos 20 critérios do DRS. Implementação: [frontend](../frontend/src), [backend](../backend/src), [migrations](../database/migrations). Evidência de execução: [registro de homologação](evidence/mvp/EXECUCOES.md).

| História do DRS | Critérios | Regras de negócio | RNFs vinculados no DRS | Componente implementado | Persistência | Testes |
|---|---|---|---|---|---|---|
| US01 Autenticar | CA01.1, CA01.2 | RN-001, RN-002 | RNF-003, RNF-004, RNF-006 | `frontend/src/pages/Login.tsx`; `backend/src/auth` | `001_initial.sql`: users, sessions | `integration.test.ts`: T1.01–T1.04, sessão/logout |
| US02 Usuários | CA02.1, CA02.2, CA02.3 | RN-002, RN-003, RN-004 | RNF-004, RNF-005, RNF-009 | `frontend/src/pages` (usuários); `backend/src/users` | `001_initial.sql`: users | `integration.test.ts`: T1.05–T1.09; `validation.test.ts` |
| US03 Imóveis | CA03.1, CA03.2, CA03.3 | RN-002, RN-005, RN-006 | RNF-001, RNF-004, RNF-005, RNF-009 | `frontend/src/pages` (imóveis); `backend/src/properties` | `001_initial.sql`: properties; `002_complete_mvp.sql`: vínculo contratual | `integration.test.ts`: T1.10–T1.13/T1.16; `rental.test.ts` |
| US04 Visitas | CA04.1, CA04.2, CA04.3 | RN-002, RN-007, RN-008 | RNF-001, RNF-004, RNF-007, RNF-009 | `frontend/src/pages` (visitas); `backend/src/visits` | `002_complete_mvp.sql`: visits, exclusão de intervalos | `rental.test.ts`: fluxo/conflitos; Playwright |
| US05 Contratos | CA05.1, CA05.2, CA05.3 | RN-002, RN-005, RN-009, RN-010, RN-011 | RNF-001, RNF-004, RNF-005, RNF-009, RNF-011 | `frontend/src/pages` (contratos); `backend/src/contracts` | `002_complete_mvp.sql`: contracts, constraints, audit | `rental.test.ts`: fluxo/concorrência/rollback/histórico; Playwright |
| US06 Pagamentos | CA06.1, CA06.2, CA06.3 | RN-002, RN-012, RN-013 | RNF-001, RNF-004, RNF-005, RNF-009, RNF-011 | `frontend/src/pages` (financeiro); `backend/src/payments` | `002_complete_mvp.sql`: payments, audit | `rental.test.ts`: fluxo/validação/histórico; Playwright |
| US07 Consulta financeira | CA07.1, CA07.2, CA07.3 | RN-002, RN-013, RN-014 | RNF-001, RNF-004, RNF-005, RNF-007 | `frontend/src/pages` (financeiro); `backend/src/contracts`, `backend/src/payments` | `002_complete_mvp.sql`: vínculos contrato/pagamento | `rental.test.ts`: isolamento bilateral; Playwright |

## Cobertura individual das regras de negócio

| Regra | História(s) | Ponto de implementação | Verificação |
|---|---|---|---|
| RN-001 | US01 | `auth/service.ts`, `auth/repository.ts` | T1.01–T1.04 |
| RN-002 | US01–US07 | guards de `auth`; controllers dos módulos | T1.08/T1.15; `rental.test.ts` isolamento |
| RN-003 | US02 | `users/service.ts`, `001_initial.sql` | T1.09 |
| RN-004 | US02 | `users/service.ts`, `001_initial.sql` | T1.09; `validation.test.ts` |
| RN-005 | US03, US05 | `properties/service.ts`, `contracts/service.ts` | T1.12; `rental.test.ts` vínculos |
| RN-006 | US03, US05 | `properties/service.ts`, `contracts/service.ts` | T1.10/T1.13; `rental.test.ts` |
| RN-007 | US04 | `visits/service.ts`, `visits/service.ts` | `rental.test.ts` fluxo/entradas inválidas |
| RN-008 | US04 | `visits/service.ts`, `002_complete_mvp.sql` | `rental.test.ts` concorrência/conflitos |
| RN-009 | US05 | `contracts/service.ts`, `002_complete_mvp.sql` | `rental.test.ts` vínculos |
| RN-010 | US05 | `contracts/service.ts`, índice único parcial SQL | `rental.test.ts` concorrência |
| RN-011 | US05 | `contracts/service.ts`, transação SQL | `rental.test.ts` ativação/encerramento |
| RN-012 | US06 | `payments/service.ts`, FK SQL | `rental.test.ts` fluxo/vínculo inválido |
| RN-013 | US06, US07 | `payments/service.ts` | `rental.test.ts` atraso/pagamento |
| RN-014 | US07 | `contracts/service.ts`, `payments/service.ts` | `rental.test.ts` isolamento bilateral |

## Cobertura individual dos requisitos não funcionais

| Requisito | Componente / evidência | Situação |
|---|---|---|
| RNF-001 | `backend/test/concurrency.test.ts`; `scripts/performance.mjs`; [resultados](evidence/mvp/50-users.json) | Meta de 3 s aprovada na amostra de homologação |
| RNF-002 | `scripts/monitor-availability.mjs`, `/api/health` | Instrumentado; 99% mensal depende de medição por um mês |
| RNF-003 | `deploy/Caddyfile`, `auth/controller.ts`; [TLS](evidence/mvp/https.txt) | Aprovado em HTTPS local |
| RNF-004 | `auth` guards, controllers; `integration.test.ts`, `rental.test.ts` | Aprovado |
| RNF-005 | schemas, respostas e guardas por vínculo; [política](POLITICA_DADOS.md) | Verificação técnica aprovada |
| RNF-006 | `auth/service.ts`; `integration.test.ts`: Argon2id | Aprovado |
| RNF-007 | `frontend/src`; [interface](evidence/mvp/browser-results.json) | Aprovado em três larguras |
| RNF-008 | [compatibilidade](evidence/mvp/compatibility.json) | Aprovado Chrome/Edge/Firefox |
| RNF-009 | `database/migrations`; `rental.test.ts` | Aprovado em PostgreSQL real |
| RNF-010 | `scripts/backup.sh`; [restauração](evidence/mvp/restore.txt) | Aprovado em ambiente local |
| RNF-011 | `002_complete_mvp.sql`, `contracts`, `payments`; `rental.test.ts` | Aprovado |
| RNF-012 | Estrutura frontend/backend/SQL; [build](evidence/build.txt) | Revisão estrutural aprovada |

As evidências identificam verificações pontuais. A meta mensal de RNF-002 permanece **não comprovada**, sem alterar a implementação da funcionalidade. A [Visão alinhada](VISAO_MVP_ALINHADA.md) apresenta ao avaliador o escopo aprovado sem alterar os documentos originais.
