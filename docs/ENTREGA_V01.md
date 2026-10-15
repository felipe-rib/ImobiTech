# Entrega ImobiTech v0.1

Validação final em 15/10/2026, referente à entrega prevista no prompt para 10/10/2026. A entrega é organizada em sete commits por etapa; os registros de execução e evidências mantêm suas datas reais. Não foi criada tag de release nem hospedagem pública.

## Funcionalidades implementadas

**US01:** login com e-mail e senha; somente usuários ativos; quatro perfis; início personalizado por perfil; logout; proteção de rotas no frontend e backend; sessões persistidas no PostgreSQL, revogáveis e com prazo absoluto.

**US02:** listagem paginada, pesquisa por nome/e-mail, filtros de perfil/situação, cadastro, consulta e edição de usuários; alteração de perfil e ativação/desativação; identificação única e telefone opcionais; acesso exclusivo de administrador. Não há exclusão de usuário nesta entrega.

**US03:** lista em cards, filtros, cadastro e edição de imóveis, detalhes, endereço completo, descrição, valor de locação opcional, seleção de proprietário previamente cadastrado e situação inicial Disponível. Proprietário consulta apenas registros vinculados à própria conta; corretor e administrador podem cadastrar/editar.

Interface em português, com azul escuro, superfícies claras, estados vazios, mensagens de erro/sucesso e carregamento. A página inicial usa atalhos e dados reais da sessão, sem indicadores inventados. Ilustrações geométricas não representam fotos de imóveis cadastrados.

## Requisitos não funcionais

| Requisito | Implementação e validação |
| --- | --- |
| RNF-003 | HTTPS validado com Caddy, CA local confiável no container, redirecionamento, cookies protegidos e revogação de sessão. |
| RNF-004 | Guards de sessão/perfil, filtragem de proprietário e testes de 401/403/404. |
| RNF-005 | Projeções de dados mínimas, hashes ausentes nas respostas, vínculos respeitados, sem dados pessoais em logs. |
| RNF-006 | Argon2id com verificação segura; teste verifica hash real. |
| RNF-007 | Telas verificadas em Chromium nos viewports 390×844, 768×1024 e 1440×900, com 21 capturas reais. |
| RNF-012 | Separação frontend/backend e camadas controller/service/repository, com validação e SQL separados. |

As regras RN-001 a RN-006 não puderam ser conciliadas por número porque o DRS não foi disponibilizado. Foram implementadas as regras descritas no prompt, incluindo perfil único, unicidade de e-mail/identificação, proprietário obrigatório/existente, disponibilidade inicial e acesso por perfil/vínculo.

## Demonstração

1. Siga o [Guia do professor](../GUIA_PROFESSOR.md) para a instalação local com Docker e HTTPS. A instalação manual com PostgreSQL/Vite também está no README.
2. Entre como `admin@imobitech.local`, com a senha `ADMIN_PASSWORD` do `.env` local. Em outra instalação, use as credenciais escolhidas no bootstrap.
3. Abra **Usuários → Novo usuário**. Cadastre corretor, proprietário e inquilino com senhas de no mínimo 12 caracteres.
4. Abra **Imóveis → Novo imóvel**. Selecione o proprietário e preencha título, tipo e endereço; confirme situação Disponível.
5. Abra o detalhe do imóvel, edite título/valor e recarregue para confirmar a persistência.
6. Saia e entre como corretor: acesso a imóveis, sem gerenciamento de usuários.
7. Entre como proprietário: somente imóveis vinculados, sem botões de edição e sem permissão na API.
8. Entre como inquilino: início com seus dados; módulos administrativos indisponíveis.
9. Como administrador, desative um usuário e confirme bloqueio de login; tente duplicar e-mail/identificação e observe a rejeição.
10. Execute `npm.cmd test` e consulte a matriz de testes. Demonstre dados persistidos por consultas SQL sem exibir hashes ou senhas.

Consultas para demonstração:

```sql
SELECT id, name, email, role, active FROM users ORDER BY created_at;
SELECT p.id, p.title, p.status, p.rent, u.name AS owner
FROM properties p JOIN users u ON u.id = p.owner_id;
SELECT name, applied_at FROM migrations ORDER BY name;
```

## Evidências

- [Matriz e procedimentos](TESTES_V01.md).
- [Resultado automatizado](evidence/tests.txt): 21 testes aprovados em PostgreSQL real.
- [Build de TypeScript e Vite](evidence/build.txt).
- [Smoke HTTP real](evidence/smoke.txt): frontend, proxy, conexão PostgreSQL, login do administrador, listagem autenticada e revogação no logout aprovados.
- [Navegador](evidence/browser-results.json): 7 testes aprovados, incluindo cadastro/edição, quatro perfis, bloqueios e três viewports.
- [Capturas reais](evidence/screenshots/): login, início, usuários, formulário de usuário, imóveis, detalhe e formulário de imóvel.
- [HTTPS real](evidence/https.txt): certificado validado, 308, headers, cookie e logout.
- [Instalação limpa Docker](evidence/INSTALACAO_DOCKER.md): procedimento destinado ao professor executado com sucesso.

## Fora do escopo

US04–US07: visitas, contratos, pagamentos e consulta financeira; assinatura digital, boletos, chat, integrações externas, arquitetura multi-tenant e dashboards avançados. Não há indisponibilidade automática por contrato. Não foram criados botões de módulos futuros.

## Limites da validação e aceite acadêmico

- Conciliar os cadastros e RN-001 a RN-006 com DRS 2.1 e Documento de Visão oficiais.
- HTTPS e interface foram validados localmente; não houve hospedagem pública, conforme a forma de entrega solicitada.
- A validação visual cobriu Chromium e viewports emulados; não representa testes em todos os navegadores ou aparelhos físicos.
- O aceite acadêmico pelo professor/grupo é externo à implementação e não foi presumido.
