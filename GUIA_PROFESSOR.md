# Como executar e avaliar o ImobiTech v0.1

Professor(a), esta entrega é executada **localmente**. Não é necessário contratar hospedagem, criar conta em serviços de nuvem ou usar o banco dos alunos. O repositório contém frontend, API, banco versionado, testes e instruções de instalação.

## 1. Pré-requisitos

- Git, para clonar o repositório; alternativamente, baixe e extraia o ZIP pelo GitHub.
- Node.js **22.12 ou superior**, na linha 22, com npm.
- Docker Desktop com suporte a containers Linux, aberto e em execução.
- Acesso à internet na primeira instalação, para baixar dependências e imagens.
- Portas locais **80 e 443** livres. O banco e a API ficam internos à rede Docker.

Verifique no terminal:

```powershell
node --version
docker version
docker compose version
```

Os comandos abaixo usam PowerShell no Windows. Em Linux/macOS, use `npm` em lugar de `npm.cmd`. Execute-os sempre na raiz do projeto, onde está `compose.yaml`.

## 2. Obter o código e gerar suas credenciais

```powershell
git clone https://github.com/felipe-rib/ImobiTech.git
cd ImobiTech
node scripts/configure-docker.mjs
```

O último comando cria **`.env.docker`** com senhas aleatórias próprias dessa instalação. Ele não sobrescreve um arquivo existente. Abra esse arquivo no seu editor e anote `ADMIN_EMAIL` e `ADMIN_PASSWORD`; serão usados no login. Não envie esse arquivo ao GitHub.

Não é necessário copiar o `.env` de nenhum aluno. O script usa somente recursos internos do Node e pode ser executado antes de `npm install`.

## 3. Construir e iniciar o sistema

Execute na sequência e aguarde cada comando terminar:

```powershell
docker compose --env-file .env.docker -p imobitech-professor build
docker compose --env-file .env.docker -p imobitech-professor up -d db
docker compose --env-file .env.docker -p imobitech-professor run --rm api node backend/dist/database/migrate.js
docker compose --env-file .env.docker -p imobitech-professor run --rm api node backend/dist/database/admin.js
docker compose --env-file .env.docker -p imobitech-professor up -d api web
```

Resultados esperados: `Migrations aplicadas.`, `Administrador inicial cadastrado.` e containers iniciados. Verifique:

```powershell
docker compose --env-file .env.docker -p imobitech-professor ps
```

Os containers `db`, `api` e `web` devem estar ativos. Na primeira execução, o download e o build podem levar alguns minutos.

## 4. Confiar no certificado local e abrir a aplicação

O sistema usa HTTPS mesmo sem hospedagem. O Caddy gera uma autoridade certificadora exclusiva da instalação. Como ela é local, o navegador só confiará no certificado após a importação explícita dessa CA.

No Windows, exporte apenas o certificado **público** e importe-o para o usuário atual:

```powershell
docker compose --env-file .env.docker -p imobitech-professor cp web:/data/caddy/pki/authorities/local/root.crt imobitech-local-ca.crt
Import-Certificate -FilePath .\imobitech-local-ca.crt -CertStoreLocation Cert:\CurrentUser\Root
```

Esse comando adiciona a CA local ao armazenamento de confiança do seu usuário. Faça isso apenas para o ambiente local que acabou de criar. Feche e abra o navegador após a importação. Não é preciso desabilitar a validação TLS nem prosseguir por um alerta de certificado.

Abra **https://localhost** e faça login com as credenciais do `.env.docker`. O acesso por `http://localhost` redireciona para HTTPS. Use `localhost`, e não o IP da máquina, pois a origem e o certificado foram configurados para esse nome.

Em macOS/Linux, importe `imobitech-local-ca.crt` no armazenamento de confiança usado pelo seu navegador. Se não desejar instalar uma CA local, a alternativa de desenvolvimento HTTP está na seção 9.

## 5. Roteiro de avaliação funcional

1. Entre como administrador. A página inicial apresenta atalhos para usuários e imóveis.
2. Em **Usuários → Novo usuário**, cadastre um corretor, um proprietário e um inquilino. Cada um possui um único perfil; a senha precisa ter pelo menos 12 caracteres. Use dados fictícios para avaliação.
3. Edite o nome de um usuário. Recarregue a página para confirmar que a alteração foi salva.
4. Tente cadastrar um e-mail já utilizado. O sistema deve impedir duplicidade.
5. Em **Imóveis → Novo imóvel**, informe título, tipo, endereço e selecione o proprietário cadastrado. O CEP deve conter oito dígitos, sem hífen. O imóvel começa como **Disponível**.
6. Abra o imóvel e edite descrição ou valor; recarregue o detalhe para confirmar persistência.
7. Saia e entre como corretor: pode gerenciar imóveis, mas não usuários.
8. Entre como proprietário: consulta somente os imóveis vinculados a ele e não pode editar.
9. Entre como inquilino: possui área autenticada, sem acesso aos módulos administrativos.
10. Como administrador, desative um usuário e tente entrar com ele: o acesso deve ser negado.
11. Reduza a janela ou use o modo responsivo do navegador. O menu se adapta ao celular; a tabela de usuários tem rolagem interna quando necessário.

Não existem módulos de visitas, contratos ou pagamentos nesta versão, conforme o escopo. O sistema não contém imóveis pré-carregados: os cadastros feitos na avaliação são salvos no PostgreSQL.

## 6. Verificar persistência diretamente no PostgreSQL

Abra o cliente SQL do container:

```powershell
docker compose --env-file .env.docker -p imobitech-professor exec db psql -U imobitech -d imobitech
```

Execute:

```sql
SELECT name, email, role, active FROM users ORDER BY created_at;
SELECT p.title, p.status, p.rent, u.name AS proprietario
FROM properties p JOIN users u ON u.id = p.owner_id;
SELECT name, applied_at FROM migrations;
\q
```

Não é preciso consultar ou divulgar hashes de senha para verificar a persistência.

## 7. Testes automatizados e evidências

Resultados e procedimentos estão em [docs/TESTES_V01.md](docs/TESTES_V01.md). As evidências incluem a saída da suíte de API, verificações HTTPS e capturas reais dos testes de navegador. O código dos testes está em `backend/test/` e `e2e/`.

Para executar a suíte da API dentro do Docker, crie um banco separado de teste, uma única vez:

```powershell
docker compose --env-file .env.docker -p imobitech-professor exec db psql -U imobitech -d postgres -c "CREATE DATABASE imobitech_test OWNER imobitech;"
docker compose --env-file .env.docker -p imobitech-professor run --rm api node scripts/test-in-container.mjs
```

Os testes criam e removem seu próprio schema no banco de teste, sem apagar os cadastros da avaliação. Se o banco de teste já existir, não repita o primeiro comando.

Para reproduzir os testes de navegador, utilize **outro projeto Docker**, pois eles criam cadastros sintéticos. O procedimento está na matriz. Não execute a suíte de navegador sobre um ambiente com dados de produção.

## 8. Encerrar e iniciar novamente

Para parar, mantendo os dados:

```powershell
docker compose --env-file .env.docker -p imobitech-professor down
```

Para voltar a executar:

```powershell
docker compose --env-file .env.docker -p imobitech-professor up -d
```

Os dados ficam em volume Docker. **Não use `down -v`**, pois essa opção remove os volumes. Não é necessário repetir o cadastro do administrador; o bootstrap recusa sobrescrever um administrador existente.

## 9. Alternativa sem Docker ou sem CA local

Com Node.js 22 e PostgreSQL 17 instalados, siga a seção **Instalação local** do [README](README.md): crie os bancos, copie `.env.example` para `.env`, configure suas credenciais, execute `npm.cmd ci`, `npm.cmd run db:migrate` e `npm.cmd run db:admin`.

Depois, em dois terminais:

```powershell
npm.cmd run dev:api
```

```powershell
npm.cmd run dev:web
```

Abra **http://localhost:5173**. Esse modo HTTP destina-se ao desenvolvimento e à avaliação funcional; a verificação de RNF-003 deve usar a instalação HTTPS.

## 10. Problemas comuns

| Sintoma | Como resolver |
| --- | --- |
| Docker não conecta | Abra o Docker Desktop e aguarde o mecanismo Linux iniciar. |
| Porta 80/443 ocupada | Encerre o serviço que usa a porta, se for seu, ou use a alternativa local da seção 9. |
| Alerta de certificado | Confira a importação da CA, reinicie o navegador e use `https://localhost`. |
| Login inválido | Confira `ADMIN_EMAIL` e `ADMIN_PASSWORD` em `.env.docker`; a senha não está no GitHub. |
| Já existe administrador | É uma proteção do bootstrap; use o administrador já criado. |
| 403 ao salvar | Use a origem configurada (`https://localhost`); não substitua por IP ou outro hostname. |
| Não aparece proprietário no formulário | Cadastre um usuário com perfil Proprietário e situação Ativo. |
| `npm.ps1` bloqueado no Windows | Use `npm.cmd`, como nos exemplos. |
| Tabelas não existem | Execute a migration da seção 3 antes de iniciar a avaliação. |

Para diagnóstico, use `docker compose --env-file .env.docker -p imobitech-professor logs --tail=50 api web`. Não publique `.env.docker`, cookies ou senhas junto dos logs.
