# Como executar e avaliar o ImobiTech — entrega US01–US07

Professor(a), esta entrega é executada **localmente**. Não é necessário contratar hospedagem, criar conta em serviços de nuvem ou usar o banco dos alunos. O repositório contém frontend, API, banco versionado, testes e instruções de instalação.

Para conferir a aderência aos documentos, leia a [decisão de escopo](docs/ESCOPO_MVP.md), a [Visão alinhada](docs/VISAO_MVP_ALINHADA.md), a [matriz de testes](docs/MATRIZ_MVP.md) e a [matriz de rastreabilidade](docs/MATRIZ_RASTREABILIDADE_MVP.md). O DRS e a Arquitetura 2.1 prevalecem sobre as divergências da Visão original.

## Instalação recomendada: Docker e porta 5173

Este caminho é para a **avaliação local**, sem instalar certificado e sem PostgreSQL separado no computador. Instale Node.js 22.12+ e Docker Desktop, abra o Docker Desktop e deixe a porta **5173** livre. No PowerShell, execute os comandos abaixo. Se baixou um ZIP, extraia-o e abra o terminal na pasta `ImobiTech`; nesse caso, pule apenas `git clone` e `cd`.

```powershell
git clone https://github.com/felipe-rib/ImobiTech.git
cd ImobiTech
node scripts/configure-docker.mjs
docker compose --env-file .env.docker -p imobitech-professor -f compose.yaml -f compose.local.yaml build local-api local-web
docker compose --env-file .env.docker -p imobitech-professor -f compose.yaml -f compose.local.yaml up -d db
docker compose --env-file .env.docker -p imobitech-professor -f compose.yaml -f compose.local.yaml run --rm local-api node backend/dist/database/migrate.js
docker compose --env-file .env.docker -p imobitech-professor -f compose.yaml -f compose.local.yaml run --rm local-api node backend/dist/database/admin.js
docker compose --env-file .env.docker -p imobitech-professor -f compose.yaml -f compose.local.yaml up -d local-api local-web backup
```

Abra **[http://localhost:5173](http://localhost:5173)**. O sistema abre com um administrador e sem imóveis ou contratos. O arquivo `.env.docker`, criado somente no seu computador, contém `ADMIN_EMAIL` e `ADMIN_PASSWORD` para o primeiro login. O script não substitui um arquivo existente. Não publique esse arquivo. As [contas de teste da máquina do autor](docs/CONTAS_TESTE_LOCAL.md) **não** são criadas no seu clone; cadastre corretor, proprietário e inquilino na tela **Usuários**.

Para confirmar que iniciou, abra `http://localhost:5173/api/health` no navegador: o resultado esperado é `{"status":"ok"}`. Se o Docker foi desligado, religue-o e execute apenas o último comando `up -d`; os dados permanecem no volume. Para parar sem apagar dados, execute `docker compose --env-file .env.docker -p imobitech-professor -f compose.yaml -f compose.local.yaml down`.

O roteiro para testar as sete histórias está na seção **5**. As seções **2–4** abaixo documentam a opção HTTPS da implantação, que exige confiar numa CA local e usar as portas 80/443. A porta 5173 usa HTTP somente em `127.0.0.1` para avaliação; a verificação de HTTPS (RNF-003) está nas [evidências](docs/evidence/mvp/https.txt).

## 1. Pré-requisitos

- Git, para clonar o repositório; alternativamente, baixe e extraia o ZIP pelo GitHub.
- Node.js **22.12 ou superior**, na linha 22, com npm.
- Docker Desktop com suporte a containers Linux, aberto e em execução.
- Acesso à internet na primeira instalação, para baixar dependências e imagens.
- Para a instalação recomendada, apenas a porta local **5173** livre. A opção HTTPS das seções 2–4 usa 80 e 443. O banco e a API ficam internos à rede Docker.

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
docker compose --env-file .env.docker -p imobitech-professor up -d api web backup
```

Resultados esperados: `Migrations aplicadas.`, `Administrador inicial cadastrado.` e containers iniciados. Verifique:

```powershell
docker compose --env-file .env.docker -p imobitech-professor ps
```

Os containers `db`, `api`, `web` e `backup` devem estar ativos. Na primeira execução, o download e o build podem levar alguns minutos.

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
   Se desejar, selecione fotos no cadastro ou na edição; a primeira aparecerá na listagem e todas na página do imóvel. Veja [limites e armazenamento](docs/FOTOS_IMOVEIS.md).
7. Saia e entre como corretor: pode gerenciar imóveis, mas não usuários.
8. Entre como proprietário: consulta somente os imóveis vinculados a ele e não pode editar.
9. Entre como inquilino: possui área autenticada, sem acesso aos módulos administrativos.
10. Como administrador, desative um usuário e tente entrar com ele: o acesso deve ser negado.
11. Reduza a janela ou use o modo responsivo do navegador. O menu se adapta ao celular; a tabela de usuários tem rolagem interna quando necessário.

12. Como corretor, acesse **Visitas → Agendar visita**, escolha o imóvel disponível, informe participante e um intervalo futuro. Confirme e cancele a visita pela agenda. Tente cadastrar horários sobrepostos: o sistema deve impedir conflito para o mesmo imóvel ou corretor.
13. Como administrador, acesse **Contratos → Novo contrato**, selecione imóvel e inquilino, informe vigência, valor mensal e dia do vencimento. O proprietário vem do imóvel. Ao salvar, o imóvel fica indisponível para outro contrato ativo.
14. No contrato, abra **Consultar financeiro → Novo lançamento**. Registre competência dentro da vigência, valor e vencimento. Deixe a data de pagamento vazia para observar Pendente ou Atrasado; depois atualize o lançamento com uma data de pagamento válida para observar Pago.
15. Entre como proprietário e inquilino: ambos consultam apenas seus próprios contratos e lançamentos, sem botões de alteração. O corretor não acessa o financeiro.
16. Como administrador, abra o **Histórico de alterações** do contrato e confira autor e horário. Encerre o contrato e confirme que o imóvel volta a ficar disponível; os pagamentos permanecem consultáveis.

A entrega segue o DRS e a Arquitetura, conforme [decisão de escopo](docs/ESCOPO_MVP.md). Não há dados pessoais ou imóveis pré-carregados. Use cadastros fictícios. Os pagamentos são registros manuais, sem integração bancária.

## Backup diário e restauração de verificação

O serviço `backup` gera um dump do banco e um arquivo de fotos ao iniciar e a cada 24 horas enquanto o Docker estiver funcionando. Os arquivos ficam no volume `backups`, separados dos volumes do banco e das fotos. Computador desligado não executa tarefas; ao reiniciar, um novo backup é gerado. Verifique:

```powershell
docker compose --env-file .env.docker -p imobitech-professor logs backup
docker compose --env-file .env.docker -p imobitech-professor exec backup ls -l /backups
```

Substitua o nome abaixo pelo arquivo listado para verificar a recuperação em um banco temporário, removido ao final. O banco principal não é sobrescrito:

```powershell
docker compose --env-file .env.docker -p imobitech-professor exec backup sh /scripts/verify-backup.sh /backups/imobitech-DATA.dump
```

Exporte cópias para outro armazenamento antes de remover volumes ou reinstalar Docker. O volume local protege contra erros da aplicação, mas não contra perda do computador. Os dumps contêm dados e devem ter acesso restrito. Não envie backups ou arquivos `.env` ao Git.

Para acompanhar disponibilidade, com o certificado público exportado, execute em outro terminal:

```powershell
$env:NODE_EXTRA_CA_CERTS = "$PWD\imobitech-local-ca.crt"
node scripts/monitor-availability.mjs
```

Mantenha esse processo ativo; ele consulta `/api/health` a cada minuto e grava somente horário, status e duração em `.local/monitoring/`. Para gerar o resumo, execute `node scripts/monitor-availability.mjs --report`. A medição local curta não comprova 99% mensal. Registre separadamente os períodos de manutenção.

Se um ambiente ficar desligado por semanas e apresentar certificado expirado ao reiniciar, consulte `docker compose --env-file .env.docker -p imobitech-professor logs web`. Aguarde a renovação automática e reinicie apenas `web` se ele continuar servindo o certificado antigo. Não desative a validação HTTPS nem apague volumes para resolver isso.

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

Resultados e procedimentos atuais estão na [matriz US01–US07](docs/MATRIZ_MVP.md). As evidências incluem a saída da suíte de API, verificações HTTPS e capturas reais dos testes de navegador. O código dos testes está em `backend/test/` e `e2e/`. A matriz da v0.1 é um registro histórico.

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
