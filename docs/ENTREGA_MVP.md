# Entrega ImobiTech — US01–US07

Entrega local, sem hospedagem pública. Referência documental: DRS e Arquitetura ajustados, escolhidos pelo responsável em 02/11/2026. A divergência do Documento de Visão está registrada em [ESCOPO_MVP.md](ESCOPO_MVP.md).

## O que entregar

- Código completo deste repositório, incluindo `database/migrations/001_initial.sql` e `002_complete_mvp.sql`.
- [Guia do professor](../GUIA_PROFESSOR.md), com instalação Docker/HTTPS, credenciais próprias e roteiro de demonstração de todos os perfis.
- [Matriz de testes](MATRIZ_MVP.md), [matriz de rastreabilidade](MATRIZ_RASTREABILIDADE_MVP.md), [Visão alinhada](VISAO_MVP_ALINHADA.md), [política de dados](POLITICA_DADOS.md) e evidências em `evidence/mvp/`.
- Os três documentos acadêmicos originais fornecidos, quando exigidos pela disciplina. Esta implementação não altera os originais nem cria uma assinatura de aprovação do professor.

Não incluir `.env`, `.env.qa`, `.env.docker`, `.local`, dumps de banco, `node_modules` ou senhas na entrega. O professor gera suas credenciais com `node scripts/configure-docker.mjs`.

## Funcionalidades

US01: login/logout, usuários ativos, quatro perfis, sessão revogável e expiração.

US02: administração de usuários, identificação única, perfil válido e proteção do último administrador.

US03: imóveis com proprietário, situação, busca, filtros, paginação e consulta por vínculo.

US04: agenda do corretor, participantes, horários futuros, confirmação/cancelamento e bloqueio de sobreposição no PostgreSQL.

US05: cadastro/consulta/edição permitida/encerramento de contratos; um contrato ativo por imóvel; disponibilidade atualizada na mesma transação.

US06: lançamentos por competência, valor, vencimento e data de pagamento; situação pendente, atrasada ou paga.

US07: consulta financeira de administrador, proprietário e inquilino, restrita aos respectivos vínculos.

Operação: backup automático, restauração isolada de verificação, endpoint de saúde, coletor de disponibilidade e histórico de alterações críticas.

## Limites da comprovação

Validação final: 25 testes de backend aprovados no Docker (23 da suíte anterior também aprovados em Windows), 8 testes de interface aprovados e 3 fluxos de compatibilidade aprovados em Chrome/Edge/Firefox. Também passaram HTTPS, teste de fumaça, desempenho e restauração de backup. Resultados detalhados na matriz e nos relatórios, sem testes ignorados nas execuções finais.

As evidências são de homologação local com dados fictícios. A meta de 99% de disponibilidade mensal exige medição em um ambiente ligado continuamente; não pode ser certificada por testes executados em um dia. Pagamentos são registros manuais e não movimentam dinheiro. Chrome/Edge/Firefox são executados em Linux dentro de containers; isso não equivale a testar todos os sistemas operacionais ou dispositivos físicos.

As instruções de instalação não dependem do banco nem das contas de teste do autor. A migração 002 acrescenta as tabelas ao modelo anterior sem remover usuários e imóveis existentes. Antes de atualizar uma instalação com dados próprios, faça backup e aplique as migrations antes de iniciar a nova API.
