# ImobiTech · v0.1

Sistema de gestão de locações imobiliárias do Grupo 06 da Universidade Católica de Brasília. A primeira entrega implementa **US01 (autenticação), US02 (usuários) e US03 (imóveis)** com PostgreSQL real. O README original identificava a disciplina como Soluções Computacionais; o prompt desta entrega a identifica como Engenharia de Software.

**Para avaliar a entrega sem hospedagem, comece pelo [Guia do professor](GUIA_PROFESSOR.md).** Ele explica a instalação local completa com Docker, credenciais próprias, HTTPS e roteiro de demonstração.

## Escopo

- Administrador: gerencia usuários e imóveis.
- Corretor: gerencia imóveis; busca proprietários ativos por nome, recebendo somente ID e nome.
- Proprietário: consulta exclusivamente os próprios imóveis, sem edição.
- Inquilino: área autenticada com seus dados de acesso, sem módulos administrativos.
- Login, logout, usuários ativos/inativos, pesquisa, filtros, paginação, cadastro, edição e consulta de detalhes.
- Sem visitas, contratos, pagamentos, chat, assinatura, métricas artificiais ou multi-tenancy.

## Tecnologias e estrutura

Node.js 22.12+, TypeScript, Fastify 5, Zod, `pg`, Argon2id; React 19, Vite 7, React Router, Tailwind CSS 4 e Lucide. Node 22.20.0 foi usado na validação. PostgreSQL 17 recomendado.

```text
frontend/src/
  components/   componentes acessíveis e estados de interface
  hooks/        sessão e consultas
  layouts/      navegação responsiva
  pages/        login, início, usuários e imóveis
  services/     cliente HTTP
backend/src/
  auth/         controller, service, repository e guards
  users/        controller, service e repository
  properties/   controller, service e repository
  shared/       configuração, validações e tipos
  database/     conexão, migrations e primeiro administrador
backend/test/   testes de integração em PostgreSQL e validação
database/migrations/  SQL versionado
deploy/        Dockerfiles e Caddy (HTTPS)
docs/          matriz, evidências e entrega
```

Controllers validam o acesso e coordenam HTTP, services aplicam as regras de negócio e repositories executam SQL parametrizado. Colunas dinâmicas em INSERT/PATCH provêm exclusivamente de objetos validados com Zod `strict()`.

## Instalação local

Pré-requisitos: Node.js 22.12+, npm e PostgreSQL em execução. No PowerShell com restrição de scripts use **`npm.cmd`** em lugar de `npm`.

```powershell
npm.cmd ci
Copy-Item .env.example .env
```

Edite `.env`. Nunca versione esse arquivo. Defina:

| Variável | Uso |
| --- | --- |
| `DATABASE_URL` | URL PostgreSQL com usuário, senha e banco da aplicação |
| `TEST_DATABASE_URL` | Banco separado, com nome terminado em `_test` |
| `HOST`, `PORT` | API local: `127.0.0.1`, `3000` |
| `APP_ORIGIN` | Origem exata do navegador: `http://localhost:5173` no desenvolvimento |
| `NODE_ENV` | `development`, `test` ou `production`; produção exige origem HTTPS |
| `SESSION_HOURS` | Duração absoluta da sessão, entre 1 e 24 horas; padrão 8 |
| `ADMIN_NAME`, `ADMIN_EMAIL`, `ADMIN_PASSWORD` | Primeiro administrador; senha de 12–128 caracteres |
| `APP_DOMAIN` | Domínio de homologação ou `localhost` no Caddy |
| `POSTGRES_DB`, `POSTGRES_USER`, `POSTGRES_PASSWORD` | Inicialização do banco no Docker |

Crie um usuário PostgreSQL dedicado e os bancos com sua ferramenta de administração. Não utilize o superusuário na aplicação. Exemplo no `psql`, autenticado como administrador do PostgreSQL:

```sql
CREATE ROLE imobitech LOGIN;
\password imobitech
CREATE DATABASE imobitech OWNER imobitech;
CREATE DATABASE imobitech_test OWNER imobitech;
```

Informe a senha escolhida em `DATABASE_URL` e `TEST_DATABASE_URL` (codifique caracteres reservados da URL). Execute na raiz:

```powershell
npm.cmd run db:migrate
npm.cmd run db:admin
```

O bootstrap não sobrescreve usuários nem senhas: recusa execução quando já existe administrador ativo. As migrations são transacionais, ordenadas e registradas na tabela `migrations`; podem ser executadas novamente. Não são executadas automaticamente ao iniciar o servidor.

Em dois terminais:

```powershell
npm.cmd run dev:api
```

```powershell
npm.cmd run dev:web
```

Abra **http://localhost:5173** e use `ADMIN_EMAIL` e `ADMIN_PASSWORD` do seu `.env`. O Vite encaminha `/api` para `127.0.0.1:3000`. Use o hostname definido em `APP_ORIGIN`: trocar `localhost` por `127.0.0.1` sem alterar essa variável fará as mutações receberem 403.

### Ambiente preparado nesta máquina

A implementação criou uma instância **separada** em `.local/pgdata`, na porta **55432**, sem modificar o serviço PostgreSQL existente. Ela usa autenticação SCRAM por senha, escuta somente em loopback e contém os bancos `imobitech` e `imobitech_test`. As credenciais aleatórias estão no `.env` local ignorado pelo Git. O administrador inicial é `admin@imobitech.local`; sua senha está em `ADMIN_PASSWORD`.

Para iniciar esse banco novamente no PowerShell do usuário que o criou:

```powershell
& 'C:\Program Files\PostgreSQL\17\bin\pg_ctl.exe' -D "$PWD\.local\pgdata" -l "$PWD\.local\postgres.log" -o '-p 55432 -h 127.0.0.1' -w start
```

Para pará-lo: substitua os argumentos após `-D "$PWD\.local\pgdata"` por `-m fast -w stop`. Não copie o exemplo de `.env` sobre o arquivo local já preparado. Em outro computador siga a instalação padrão acima.

## Build e testes

```powershell
npm.cmd run build
npm.cmd test
```

`build` verifica TypeScript nas duas aplicações e gera `backend/dist` e `frontend/dist`. A API compilada inicia com `npm.cmd start -w backend`.

Com API e frontend em execução, `node scripts/smoke.mjs` verifica a integração HTTP usando o administrador definido no `.env`, faz logout ao terminar e registra somente resultados sem credenciais em `docs/evidence/smoke.txt`.

Os testes exigem PostgreSQL real. Não substituem persistência por mocks e **falham explicitamente** se `TEST_DATABASE_URL` estiver ausente ou apontar para o banco da aplicação. Cada execução cria um schema aleatório no banco de teste, aplica as migrations, executa os cenários e remove apenas esse schema. O usuário do banco precisa poder criar schemas; não precisa de superusuário. Dados sintéticos são restritos aos testes, e a aplicação inicia somente com o administrador solicitado.

Resultados executados, limitações e procedimentos manuais: [docs/TESTES_V01.md](docs/TESTES_V01.md). Roteiro de demonstração: [docs/ENTREGA_V01.md](docs/ENTREGA_V01.md).

## HTTPS em homologação

O `compose.yaml` monta PostgreSQL, API e Caddy. Apenas o Caddy publica portas. Para Docker, configure `DATABASE_URL` com hostname **`db`**, porta 5432 e credenciais iguais às `POSTGRES_*`; não reutilize a URL local da porta 55432. Configure `APP_DOMAIN`, `ADMIN_*` e uma senha exclusiva para o banco. Faça backup antes de qualquer migração em ambientes com dados.

```powershell
docker compose build
docker compose up -d db
docker compose run --rm api node backend/dist/database/migrate.js
docker compose run --rm api node backend/dist/database/admin.js
docker compose up -d api web
```

- O Compose desta entrega publica 80/443 somente em `127.0.0.1`, para avaliação local sem hospedagem pública.
- Teste local: `APP_DOMAIN=localhost` permite acessar `https://localhost`. O Caddy emite certificado pela sua CA local. Exporte o certificado raiz do volume do Caddy e instale-o no armazenamento de confiança do computador de teste. Não desative a validação TLS para aceitar o teste.
- API e banco não têm portas públicas no Compose. A API confia em **um único salto de proxy**; mantenha essa topologia e não exponha a porta 3000 diretamente em produção.
- Produção usa cookie `Secure`, `HttpOnly`, `SameSite=Strict`, expiração absoluta e proteção de origem nas mutações. O Caddy aplica CSP e HSTS.
- HTTP local é apenas para desenvolvimento. O transporte HTTPS foi testado com a CA do Caddy confiada exclusivamente no container de testes; a validação TLS permaneceu habilitada. Cada nova instalação deve confiar em sua própria CA, conforme o guia do professor.

## API

Na API direta: `/auth/login`, `/auth/logout`, `/auth/me`, `/users`, `/users/:id`, `/properties`, `/properties/:id`. No navegador e no Caddy, prefixe com `/api`.

- `POST /auth/login`: `{ "email": "...", "password": "..." }`; recebe cookie de sessão.
- `POST /auth/logout`: `{}`; revoga a sessão no PostgreSQL.
- `GET /auth/me`: dados mínimos do usuário autenticado.
- `/users`: GET lista, POST cadastra; `/:id`: GET consulta, PATCH atualiza.
- `/properties`: GET lista, POST cadastra; `/:id`: GET consulta, PATCH atualiza.
- `GET /properties/owners?search=...`: seleção de proprietários ativos, somente admin/corretor, até 50 resultados com ID e nome.
- Listas retornam `{items,total,page}`, com 20 registros por página. Filtros: `search`, `page`; usuários também `role`, `active`; imóveis também `type`, `status`.
- Perfis: `admin`, `broker`, `owner`, `tenant`. Tipos: `apartment`, `house`, `commercial`, `land`. Situações: `available`, `unavailable`.
- Todo POST/PATCH exige `Content-Type: application/json` e `Origin` igual a `APP_ORIGIN`, inclusive clientes de teste. Sem autenticação: 401; perfil não autorizado: 403; imóvel de outro proprietário: 404 para não revelar sua existência.

## Decisões e limites

Não foram fornecidos DRS 2.1, Documento de Visão ou matriz original. O prompt é a referência implementada; a conformidade literal de RN-001 a RN-006 precisa ser conferida contra esses documentos. Identificação e telefone são opcionais para minimizar coleta. Não foram acrescentados CPF, CRECI ou campos específicos sem especificação.

Imóveis iniciam Disponíveis; a edição pode marcá-los Indisponíveis manualmente. Não há regra baseada em contrato nesta versão. Proprietário vinculado a imóvel não pode mudar de perfil; não é possível desativar ou rebaixar o último administrador ativo. Proprietários inativos mantêm seus vínculos existentes, mas não recebem novos vínculos nem autenticam. Alterar senha, perfil ou situação revoga sessões daquele usuário.

Sessões armazenam somente SHA-256 de tokens aleatórios de 256 bits; senhas usam Argon2id. Senhas/hashes não são retornados e dados pessoais não entram nos logs. Limitação de tentativas é local ao processo, adequada à implantação única desta entrega. Sessões expiradas são limpas a cada novo login.

Referências técnicas consultadas: [Fastify — validação e erros](https://fastify.dev/docs/latest/Reference/Validation-and-Serialization/) e [@fastify/cookie](https://www.npmjs.com/package/@fastify/cookie).
