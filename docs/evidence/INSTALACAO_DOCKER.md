# Evidência da instalação limpa

Verificação realizada em **15/10/2026**, em projeto Docker separado chamado `imobitech-qa`, com volumes novos e credenciais geradas em `.env.qa` (não versionado).

| Etapa executada | Resultado observado |
| --- | --- |
| Build da API e frontend com `npm ci` nas imagens | TypeScript e Vite concluídos com código 0 |
| Inicialização de PostgreSQL 17 | Healthcheck saudável |
| `node backend/dist/database/migrate.js` | `Migrations aplicadas.` |
| `node backend/dist/database/admin.js` | `Administrador inicial cadastrado.` |
| Inicialização de API e Caddy | Serviços ativos, frontend servido por HTTPS |
| Criação do banco separado `imobitech_test` | `CREATE DATABASE` |
| `node scripts/test-in-container.mjs` | 21 testes, 21 aprovados, 0 falhas, 0 ignorados |
| `node scripts/https-test.mjs` no container de QA | TLS, redirecionamento, headers/cookie e logout aprovados |
| Playwright 1.64.1 / Chromium | 7 testes aprovados; 21 capturas reais |

Esse procedimento confirma o caminho de instalação descrito em [GUIA_PROFESSOR.md](../../GUIA_PROFESSOR.md). A confiança da CA foi configurada no container de QA; o armazenamento de certificados do Windows não foi alterado por esta validação.

Os testes usaram dados sintéticos persistidos em PostgreSQL real. O ambiente do professor inicia somente com seu administrador e não recebe esses cadastros. Containers de outros projetos não foram alterados.
