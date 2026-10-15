# Matriz de verificação — ImobiTech v0.1

Execução em **15/10/2026**. A suíte da API foi executada em Windows/Node.js 22.20.0/PostgreSQL 17 e repetida em instalação Docker limpa. A suíte de interface usou Chromium/Playwright 1.64.1 em container Linux, com PostgreSQL 17, Fastify e Caddy reais. Não foram utilizados mocks de banco. Credenciais e cadastros sintéticos são exclusivos dos testes.

**Resultado final: 21 testes de API/validação e 7 testes de navegador aprovados, sem falhas nem testes ignorados nas execuções finais.** Também passaram as verificações de transporte HTTPS. Foram produzidas **21 capturas reais**, e telas representativas foram inspecionadas visualmente. Os IDs abaixo derivam do prompt; a cobertura não equivale a certificação em todos os navegadores ou dispositivos físicos.

Evidências: [API](evidence/tests.txt), [relatório JSON do navegador](evidence/browser-results.json), [HTTPS](evidence/https.txt), [capturas](evidence/screenshots/) e [instalação limpa](evidence/INSTALACAO_DOCKER.md).

| ID | Requisito | Procedimento | Resultado esperado | Resultado obtido | Situação | Evidência |
| --- | --- | --- | --- | --- | --- | --- |
| T1.01 | US01-CA1 | Login com credenciais válidas; consultar `/auth/me` | 200, cookie e identidade correta | Obtido em PostgreSQL real | Aprovado na API | `tests.txt`, teste 1 |
| T1.02 | US01 / quatro perfis | Autenticar os quatro perfis; consultar recursos e navegar pelas áreas | Identidade, área e permissões corretas | Validado na API e no navegador | Aprovado | API 1, 5 e 10; UI-01 e UI-03 |
| T1.03 | US01-CA2 | Senha incorreta e e-mail inexistente | 401 com mesma mensagem genérica | Obtido | Aprovado | Teste 2 |
| T1.04 | US01 / usuário ativo | Login de inativo e uso de sessão após desativação | 401 | Obtido; sessão revogada | Aprovado | Testes 2 e 14 |
| T1.05 | US02-CA1 | Cadastrar usuário pela API e formulário; consultar SQL | 201 e registro persistido | Corretor, proprietário e inquilino cadastrados pelo navegador | Aprovado | API 3; UI-01 |
| T1.06 | US02-CA2 | Editar nome pela API e formulário; recarregar página | Nome atualizado e persistido | Obtido após recarga no navegador | Aprovado | API 4; UI-01 |
| T1.07 | US02-CA2 / perfil único | Alterar perfil e tentar reutilizar sessão anterior | Perfil atualizado, sessão revogada | Obtido | Aprovado na API | Teste 4 |
| T1.08 | US02-CA3 | GET/POST/PATCH por corretor, proprietário e inquilino | 403 em todas as operações administrativas | Obtido | Aprovado | Teste 5 |
| T1.09 | US02 / unicidade | Repetir e-mail com caixa diferente e identificação; enviar array de perfis | 409 em duplicidades; 400 no perfil inválido | Obtido | Aprovado | Teste 6 |
| T1.10 | US03-CA1 | Cadastrar imóvel com proprietário pela API e formulário | 201 e vínculo persistido | Cadastro funcional e detalhe acessível | Aprovado | API 7; UI-02 |
| T1.11 | US03-CA2 | Alterar imóvel, consultar detalhe e recarregar | Alterações persistidas e apresentadas | Valor e descrição confirmados no navegador; situação pela API | Aprovado | API 8; UI-02 |
| T1.12 | US03 / proprietário | Enviar proprietário ausente, inexistente, inativo ou com outro perfil | Rejeição sem gravar imóvel | 400; trigger SQL também rejeitou vínculo inválido | Aprovado | Testes 9 e 16 |
| T1.13 | US03 / situação inicial | Criar imóvel sem situação; tentar impor Indisponível na criação | Disponível; campo indevido rejeitado | Obtido | Aprovado | Testes 7 e 21 |
| T1.14 | RNF-003 | Acessar Caddy via TLS com CA confiável; testar HTTP, login e logout | TLS válido; 308; cookie protegido; sessão revogada | Obtido sem desativar validação TLS; CA confiada somente no container | Aprovado em homologação local | API 15; `https.txt`; navegador com `ignoreHTTPSErrors: false` |
| T1.15 | RNF-004 | Acessar rotas sem sessão e com perfil indevido | 401 / 403 | Obtido | Aprovado | Teste 5 |
| T1.16 | RNF-005 | Proprietário A tenta consultar imóvel de B, listar usuários e editar imóveis; corretor consulta seleção de proprietários | Isolamento por vínculo; apenas ID/nome na seleção | 404/403 e projeção mínima confirmados | Aprovado na API | Teste 10 |
| T1.17 | RNF-006 | Consultar hash no banco, validar Argon2id e verificar respostas | Hash verificável, sem senha/hash em respostas; token bruto fora do banco | Obtido | Aprovado | Teste 11 |
| T1.18 | RNF-007 | Abrir login, início, listas, formulários e detalhe em 390×844, 768×1024 e 1440×900 | Conteúdo legível, menu móvel e ausência de overflow na página | 21 capturas; dimensões verificadas; menu móvel e busca vazia funcionais | Aprovado nos viewports testados | UI-05 (3 casos); `screenshots/` |
| T1.19 | RNF-012 | Revisar estrutura e dependências entre camadas | Frontend separado; controllers, services, repositories e SQL | Estrutura implementada e revisada | Aprovado por inspeção de código | `backend/src`, `frontend/src`, `database/migrations` |

## Verificações adicionais automatizadas

- Filtros e paginação; tentativa de SQL injection tratada como texto; UUID inválido e PATCH vazio rejeitados.
- Proteção contra CSRF por validação estrita de Origin e exigência de JSON.
- Preservação do último administrador ativo.
- Edição de nome não reativa usuário inativo nem altera campos omitidos.
- Expiração de sessão, logout no servidor e limitação de tentativas de login.
- Valor negativo e CEP inválido rejeitados.
- Migrations executadas duas vezes sem recriar as tabelas.
- Impedimento de alterar o perfil de proprietário que possui imóveis.

## Reprodução

1. Configure `.env` e banco dedicado conforme o README; `TEST_DATABASE_URL` precisa terminar em `_test` e diferir de `DATABASE_URL`.
2. Execute `npm.cmd ci`, `npm.cmd run build` e `npm.cmd test`.
3. O runner cria e remove somente seu schema de testes. Nenhuma tabela da aplicação é truncada.
4. Para registrar nova execução: `npm.cmd test | Tee-Object -FilePath docs/evidence/tests.txt`. Verifique o código de saída e não marque aprovação se houver falha.

## Reprodução dos testes de navegador e HTTPS

O Docker Desktop deve estar em execução e as portas 80/443 livres. Use um projeto de testes próprio; a suíte de navegador cria usuários e imóveis sintéticos. Após uma execução, os cadastros ficam no volume isolado para consulta das evidências; não são instalados no ambiente do professor.

```powershell
npm.cmd ci
node scripts/configure-docker.mjs .env.qa
docker compose --env-file .env.qa -p imobitech-qa build
docker compose --env-file .env.qa -p imobitech-qa up -d db
docker compose --env-file .env.qa -p imobitech-qa run --rm api node backend/dist/database/migrate.js
docker compose --env-file .env.qa -p imobitech-qa run --rm api node backend/dist/database/admin.js
docker compose --env-file .env.qa -p imobitech-qa up -d api web
docker compose --env-file .env.qa -p imobitech-qa -f compose.yaml -f compose.qa.yaml run --rm browser-tests
```

Em execuções posteriores, não repita o bootstrap se já houver administrador. A suíte tem proteção real contra excesso de tentativas: aguarde a janela de um minuto entre rodadas ou reinicie **somente a API do projeto de testes**. Não desative as proteções da aplicação. Para parar: `docker compose --env-file .env.qa -p imobitech-qa down`, sem `-v`.

O script importa a CA pública do Caddy no armazenamento NSS **do container descartável**, não no Windows. Chromium e o cliente Node validam a cadeia TLS; não há `ignoreHTTPSErrors: true` nem `NODE_TLS_REJECT_UNAUTHORIZED=0`.

## Roteiro para revisão manual adicional

### Fluxo de interface e responsividade

1. Inicie banco, API e Vite; abra `http://localhost:5173`.
2. Em cada viewport indicada em T1.18, entre como administrador; cadastre um corretor, dois proprietários e um inquilino; use nomes e endereços fictícios de teste.
3. Consulte um usuário; edite nome, perfil e situação; confira a atualização. Tente e-mail/identificador duplicados e campos obrigatórios vazios.
4. Cadastre imóvel para um proprietário, abra o detalhe, altere dados e recarregue a página para confirmar persistência.
5. Faça logout/login entre perfis; confirme que proprietário vê somente seus imóveis e inquilino não acessa `/users` ou `/properties`, inclusive digitando as URLs diretamente.
6. Teste filtros sem resultados, menu móvel, foco por teclado, tabulação e mensagens de erro. Em celular, a tabela de usuários tem rolagem horizontal **somente no contêiner**, para preservar legibilidade.
7. Registre navegador e viewport se repetir a avaliação. As capturas desta entrega estão em `evidence/screenshots/`; foram geradas pelo navegador automatizado e não por ferramentas de criação de imagens.

### HTTPS

1. Suba o Compose seguindo o README em ambiente com Docker disponível.
2. Instale a CA local do Caddy no ambiente de teste ou utilize um domínio com certificado público válido.
3. Abra a origem HTTPS sem ignorar avisos de certificado; confirme redirecionamento de HTTP para HTTPS.
4. Faça login. Confirme no navegador `Secure`, `HttpOnly`, `SameSite=Strict`, ausência de conteúdo misto e respostas `Cache-Control: no-store`.
5. Faça logout e tente reutilizar o cookie anterior: deve retornar 401.
6. Registre domínio, emissor do certificado, data/hora e capturas sem senhas ou cookies.

## Limitações e ocorrências

- DRS 2.1, Documento de Visão e matriz original não estavam no repositório. Os IDs e procedimentos acima derivam do prompt, devendo ser conciliados com os documentos oficiais.
- Docker estava inacessível no sandbox inicial; após autorização, a instalação limpa, a suíte da API e os testes de HTTPS/navegador foram executados com sucesso. Nenhum serviço foi hospedado publicamente.
- O sandbox bloqueou inicialmente npm e a criação do cluster PostgreSQL. As operações foram repetidas com autorização; testes usaram PostgreSQL 17 real isolado.
- Houve erro de tipagem na configuração de confiança do proxy durante revisão; corrigido usando a função de confiança de um salto aceita pelo Fastify. `build.txt` registra o build local aprovado; o build final Linux e a instalação constam em `INSTALACAO_DOCKER.md`.
- A primeira execução de navegador encontrou um seletor de teste inadequado para um `select`; foi corrigido para localizar pelo papel acessível. Também foi corrigida a sincronização após navegação. Essas falhas não foram marcadas como aprovações.
- O teste de 390 pixels identificou overflow causado pelo cabeçalho acessível da tabela; o contêiner recebeu posicionamento relativo e largura máxima. A suíte completa passou após a correção, mantendo a rolagem interna necessária da tabela.
- O relatório final e as capturas refletem a execução aprovada. Não foram testados navegadores diferentes de Chromium nem dispositivos móveis físicos.
- O escopo de US03-CA3 (indisponibilidade por contrato ativo) permanece para v0.2.
