# Documento de Visão — ImobiTech MVP alinhado

Versão de entrega: 03/11/2026. Este é um **adendo de alinhamento da implementação**, não uma alteração ou aprovação retroativa do PDF original. O responsável definiu DRS Ajustado 2.1 e Arquitetura Ajustada 2.1 como referências prevalentes; veja [decisão e identificação das fontes](ESCOPO_MVP.md).

## Problema e objetivo

O ImobiTech centraliza o processo básico de locação imobiliária: contas e permissões, carteira de imóveis, agenda de visitas, contratos e registros financeiros. O objetivo do MVP é permitir que administrador, corretor, proprietário e inquilino executem e consultem apenas as operações relacionadas a seus papéis e vínculos, com integridade no PostgreSQL e acesso por navegador.

## Atores e alcance

| Ator | Uso no MVP |
|---|---|
| Administrador | Gerencia usuários, imóveis, contratos e pagamentos; consulta agenda e histórico. |
| Corretor | Gerencia imóveis e sua agenda de visitas. |
| Proprietário | Consulta seus imóveis, contratos e lançamentos financeiros vinculados. |
| Inquilino | Consulta seus contratos e lançamentos financeiros vinculados. |

O produto da entrega cobre **US01 autenticar, US02 gerenciar usuários, US03 gerenciar imóveis, US04 agendar visitas, US05 gerenciar contratos, US06 registrar e acompanhar pagamentos e US07 consultar situação financeira**. Cada critério, regra e evidência aparece na [matriz de testes](MATRIZ_MVP.md) e na [matriz de rastreabilidade](MATRIZ_RASTREABILIDADE_MVP.md).

## Limites do MVP

Uma instalação acadêmica local atende a uma única imobiliária. Multiempresa, notificações externas, chat, assinatura digital, boletos e integração bancária ficam fora do escopo aprovado. Lançamentos financeiros são registros manuais, sem transferência de dinheiro. A Visão original cita numeração e módulos divergentes; esta versão descreve a implementação US01–US07 escolhida pelo responsável, preservando os arquivos originais para consulta.

## Qualidade e implantação

Frontend React e backend Fastify/TypeScript acessam PostgreSQL 17. A implantação Docker local usa HTTPS, rotinas de backup e instruções reproduzíveis no [guia do professor](../GUIA_PROFESSOR.md). A arquitetura prevê homologação com 50 usuários concorrentes; o [teste com contas independentes](evidence/mvp/50-users.json) verifica uma amostra dessa carga. A meta de 99% de disponibilidade mensal depende de operação e medição por um mês; não é declarada como cumprida pela homologação pontual. A política acadêmica de dados está em [POLITICA_DADOS.md](POLITICA_DADOS.md).

## Critério de entrega

O avaliador pode instalar localmente, criar suas credenciais, executar migrations, acessar os quatro perfis e conferir US01–US07 pelo roteiro do guia, com as matrizes e relatórios versionados no Git. Não há dependência de hospedagem ou do banco local do autor.
