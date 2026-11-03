# Registro de homologação — 02–03/11/2026

Ambiente: Windows com Node 22.20.0 e PostgreSQL 17; Docker Linux com API Node 22, PostgreSQL 17, Caddy e Playwright 1.64.1. Dados de teste sintéticos. Projeto Docker isolado: `imobitech-qa`.

| Comando/verificação | Resultado |
|---|---|
| `npm.cmd run build` | Saída 0; TypeScript backend/frontend e bundle Vite concluídos |
| `npm.cmd test` | Saída 0; 23 testes, 23 aprovados, nenhum ignorado |
| API Docker: `node scripts/test-in-container.mjs` | Saída 0; os mesmos 23 testes aprovados |
| API Docker após ampliação da matriz, 03/11 | Saída 0; 25 testes, 25 aprovados, nenhum ignorado; 50 contas/sessões independentes simultâneas com p95 de 113 ms no container |
| Extensão de fotos, 03/11: [suíte Docker](property-photos-docker.txt) | Saída 0; 26 testes, 26 aprovados, nenhum ignorado; upload, leitura, isolamento, limites, remoção e reinício da API |
| Busca em contrato e visita, 03/11: [suíte Docker](lookup-docker.txt) | Saída 0; 27 testes, 27 aprovados; opções elegíveis sem termo, busca por e-mail e endereço, exclusão de imóvel indisponível e controle de acesso |
| Busca em contrato e visita: [Chrome local](lookup-ui.txt) | Cadastros visíveis e selecionáveis; busca por e-mail e imóvel disponível em visita confirmados na interface |
| Extensão de fotos: [backup](property-photos-backup.txt) | Dump restaurado em banco temporário e arquivo de fotos verificado, sem alterar dados ativos |
| Formulário de fotos em Chrome local | Login, abertura de **Novo imóvel** e seleção de PNG pela interface passaram; sem criar imóvel de teste no banco ativo |
| Clique para upload imediato em Chrome local | Clique na área da foto do detalhe e na área de edição abriu o seletor; PNG escolhido disparou envio e atualização visual sem salvar formulário. Imóvel/API simulados para preservar o banco ativo; cadastro novo exibiu aviso de envio após primeiro salvamento. |
| Migração 002 no banco QA existente | Saída 0; usuários e imóveis anteriores preservados |
| Backup e `verify-backup.sh` | Saída 0; recuperação em banco temporário separado, removido ao final |
| Monitor `--once` e `--report` | Uma amostra HTTP 200; não é evidência mensal |
| Suíte geral Playwright + HTTPS | Saída 0; 8 testes aprovados, nenhum ignorado; HTTPS com validação de certificado |
| Compatibilidade Chrome/Edge/Firefox | Saída 0; 3 fluxos completos aprovados, nenhum ignorado; Firefox com perfil NSS temporário confiável |
| `scripts/smoke.mjs` com `SMOKE_BASE_URL=https://localhost` | Saída 0; frontend, proxy, banco, proteção sem sessão, login, consulta e logout |
| `scripts/performance.mjs` | Saída 0; 50 consultas concorrentes, p95 302 ms, máximo 306 ms; sete gravações abaixo de 3 segundos |
| Verificação de credenciais locais em arquivos publicáveis | Nenhuma senha local gerada encontrada |

O log `backend-docker.txt` inclui o formato `NativeCommandError` usado pelo PowerShell para mensagens informativas que o Docker envia a stderr; o processo terminou com código 0 e o resumo TAP confirma ausência de testes reprovados.

O log `backend-tests.txt` registra a suíte anterior de 23 testes em Windows. Nesta sessão o PostgreSQL de teste exposto em `localhost:55432` não estava ativo, portanto a suíte ampliada foi executada integralmente no Docker, com banco de teste isolado. O arquivo `50-users.json` registra uma execução local anterior de 50 contas (p95 381 ms), enquanto o log Docker registra a repetição final (p95 113 ms). Os tempos pertencem a ambientes distintos.

## Correções durante a homologação

- O ambiente antigo estava desligado desde outubro. Caddy renovou a CA intermediária; reiniciar somente o serviço web permitiu servir um certificado válido. O teste TLS passou sem `ignoreHTTPSErrors`.
- O teste de integração adicional esperava 409 para proprietário divergente; a validação de entrada retorna corretamente 400. A assertiva foi corrigida mantendo a verificação de rollback.
- A execução conjunta excedia o limite de dez logins por minuto. Os testes aguardam a janela entre suítes/navegadores; a proteção da aplicação continua habilitada.
- O seletor de status financeiro encontrava tanto a opção de filtro quanto o status do lançamento. A assertiva foi limitada ao artigo do lançamento.
- Firefox no container não herdou a CA do sistema nem a política de instalação na execução automatizada. A correção importa a CA com `certutil` no banco NSS de um perfil temporário exclusivo; esse perfil é removido ao terminar. O teste de navegação HTTPS respondeu 200 sem ignorar certificados.

Os relatórios JSON mantêm os resultados das execuções finais correspondentes. Capturas mostram somente cadastros fictícios; não incluem credenciais.
