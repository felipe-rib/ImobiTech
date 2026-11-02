# Matriz de testes — ImobiTech US01–US07

Referência: DRS 2.1 + Arquitetura 2.1, conforme [decisão aprovada](ESCOPO_MVP.md). Execução em 02/11/2026. Dados fictícios, PostgreSQL real; testes de backend usam schemas temporários em banco separado. Nenhum resultado abaixo pressupõe hospedagem pública.

## Histórias e regras de negócio

| Caso | Referência | Cenário e resultado esperado | Evidência | Resultado |
|---|---|---|---|---|
| MVP-01 | US01, RN001/002 | Quatro perfis autenticam; credencial inválida/inativo negados; logout e expiração revogam sessão | `backend/test/integration.test.ts` | Passou |
| MVP-02 | US02, RN003/004 | Administrador cadastra/edita/desativa; identificadores únicos; perfil único; último admin preservado | Mesmo arquivo | Passou |
| MVP-03 | US03, RN005/006 | Imóvel exige proprietário ativo; situação válida; consulta e edição persistem; proprietário vê somente seus imóveis | Mesmo arquivo | Passou |
| MVP-04 | US04, RN007 | Agendar visita futura com imóvel, corretor e participante; confirmar/cancelar; passado inválido | `backend/test/rental.test.ts` | Passou |
| MVP-05 | US04, RN008 | Dois agendamentos concorrentes: somente um vence; conflito por imóvel ou corretor; adjacência permitida; cancelamento libera horário | Mesmo arquivo | Passou |
| MVP-06 | US05, RN009 | Partes válidas e correspondentes ao imóvel; vínculo incorreto rejeitado sem alteração de disponibilidade | Mesmo arquivo | Passou |
| MVP-07 | US05, RN010/011 | Dois contratos concorrentes: somente um ativo; imóvel indisponível; encerramento libera e preserva histórico | Mesmo arquivo | Passou |
| MVP-08 | US06, RN012/013 | Lançamento válido persiste; negativo, duplicidade e pagamento futuro rejeitados; pendente/atrasado/pago calculados corretamente | Mesmo arquivo | Passou |
| MVP-09 | US07, RN014 | Proprietário/inquilino consultam seus vínculos; terceiro recebe 404; corretor recebe 403; sem sessão recebe 401 | Mesmo arquivo | Passou |
| MVP-10 | US05/06, integridade | Impedir disponibilização manual de imóvel alugado, mudança de perfil vinculado e redução da vigência excluindo parcelas | Mesmo arquivo | Passou |
| MVP-11 | US05/06, histórico | Cadastro/edição/encerramento geram ator e horário; falhas não geram eventos; exclusão de histórico rejeitada | Mesmo arquivo | Passou |

Backend: **23 testes aprovados**, sem mocks de persistência. Os dois testes novos agrupam vários cenários/assertivas; não são apresentados como dezenas de testes independentes.

Execuções confirmadas em Windows/Node 22 e Docker/Linux/Node 22: [backend local](evidence/mvp/backend-tests.txt) e [backend Docker](evidence/mvp/backend-docker.txt).

## Requisitos não funcionais

| Referência | Verificação | Resultado / limite |
|---|---|---|
| RNF001 — desempenho | 50 consultas concorrentes via HTTPS, cinco rotas, mais sete gravações sequenciais de usuários/imóvel/contrato/pagamento | p95 das consultas 302 ms; máximo 306 ms. Todas as gravações abaixo de 3 segundos. Uma sessão e pequena base de homologação; não equivale a ensaio prolongado de capacidade. Ver `evidence/mvp/performance.json`. |
| RNF002 — disponibilidade | Reinício automático dos serviços, `/api/health` consulta o banco; coletor `scripts/monitor-availability.mjs` | Instrumentação disponível. **99% mensal não comprovado**: exige operação contínua e medição de um mês. |
| RNF003 — HTTPS | Redirecionamento 308, cadeia TLS confiável, cookie Secure/HttpOnly/SameSite, HSTS e CSP | Passou; `evidence/mvp/https.txt`. Validação TLS permaneceu habilitada. |
| RNF004 — autorização | Testes 401/403/404 por perfil e vínculo em backend | Passou. |
| RNF005 — privacidade | Campos mínimos; isolamento de imóveis/contratos/pagamentos; ausência de senha/hash nas respostas | Passou nos cenários automatizados e revisão do código. |
| RNF006 — senhas | Inspeção do hash Argon2id, sessão opaca armazenada como SHA-256 | Passou na suíte de integração. |
| RNF007 — responsividade | Fluxos e capturas em 390, 768 e 1440 pixels; verificação de overflow horizontal | Suíte geral: 8/8 aprovados; capturas representativas inspecionadas visualmente. Resultados em `evidence/mvp/browser-results.json` e `screenshots/`. |
| RNF008 — navegadores | Fluxo de agenda, contrato, pagamento e consulta em Chrome, Edge e Firefox | 3/3 aprovados: Chrome 156.0.8078.79, Edge 156.0.4314.58 e Firefox 157.0 em Linux. Execução em `evidence/mvp/compatibility.json`. |
| RNF009 — integridade | FKs, transações, exclusão de intervalos, unicidade parcial e rollback | Passou em PostgreSQL real. |
| RNF010 — backup | Dump automático ao iniciar e a cada 24 horas; restauração em banco temporário | Primeiro dump restaurado com sucesso; rotina depende do computador/Docker ligados. |
| RNF011 — rastreabilidade | Eventos de contrato/pagamento com autor, horário, antes/depois; proteção contra edição/exclusão | Passou. |
| RNF012 — manutenção | Frontend separado; módulos backend com controller/service/repository; SQL versionado; TypeScript | Build passou; estrutura revisada. |

## Reprodução

1. Siga o [guia do professor](../GUIA_PROFESSOR.md) para iniciar a aplicação.
2. Para backend, configure `TEST_DATABASE_URL` para banco separado terminado em `_test` e execute `npm.cmd test`.
3. Para homologação Docker, gere `.env.qa` com `node scripts/configure-docker.mjs .env.qa` e use o projeto `imobitech-qa`; aplique migrations e crie o administrador conforme o guia, substituindo `.env.docker`/nome do projeto.
4. Execute `docker compose --env-file .env.qa -p imobitech-qa -f compose.yaml -f compose.qa.yaml run --rm browser-tests`.
5. Compatibilidade: o mesmo comando com `--entrypoint bash browser-tests scripts/compatibility-tests.sh`. Instala navegadores somente no container descartável.
6. Testes de interface aguardam a janela do limitador de login entre navegadores. Não execute as suítes de carga e interface simultaneamente.

Os arquivos `TESTES_V01.md`, `ENTREGA_V01.md` e evidências fora de `evidence/mvp/` documentam a entrega anterior. A matriz atual não converte verificações históricas em resultados da versão nova.

A confiança da CA no Firefox automatizado é configurada no banco NSS de um perfil temporário exclusivo, com `certutil`, pela fixture `e2e/fixtures.ts`. O perfil é removido ao terminar; o Firefox do usuário não é modificado. A política `Certificates.Install` da [Mozilla](https://firefox-admin-docs.mozilla.org/reference/policies/certificates/) foi consultada, mas não resolveu a herança de confiança no perfil automatizado e não é usada como comprovação do teste.
