# Referência da entrega

Decisão confirmada pelo responsável em 02/11/2026: prevalecem o DRS Ajustado e o Documento de Arquitetura Ajustado, versão 2.1, abrangendo US01–US07. O Documento de Visão foi consultado como contexto; suas divergências sobre visitas e multiempresa não ampliam o escopo aprovado.

Incluídos: autenticação, usuários, imóveis, visitas, contratos, pagamentos e consulta financeira por vínculo. Excluídos: multiempresa, assinatura digital, boletos, chat, integrações bancárias e notificações externas.

## Decisões operacionais

- Visitas possuem início e fim; intervalos adjacentes são permitidos. Visitas futuras não canceladas não podem sobrepor imóvel nem corretor. A duração máxima é de oito horas. O administrador consulta; o corretor gerencia sua agenda.
- Criar contrato ativo reserva imediatamente o imóvel. Encerramento é explícito e libera o imóvel na mesma transação. Vínculos e contratos encerrados são preservados.
- Cada contrato admite um lançamento por competência mensal. Valores e datas são registrados pelo administrador; não há geração automática de parcelas, juros ou baixa bancária.
- O vencimento mensal admite dias de 1 a 31. Em meses menores, o lançamento deve usar o último dia válido do mês.
- Atraso é calculado pela data corrente de Brasília. Total em aberto inclui os atrasados. Uma data de pagamento informada marca o lançamento como pago.
- Proprietários e inquilinos acessam apenas contratos vinculados à própria conta. O corretor não acessa o financeiro.
- O banco registra autor, horário e conteúdo anterior/posterior de alterações de contratos e pagamentos. O histórico administrativo não constitui um módulo avançado de auditoria.
- A disponibilidade mensal de 99% depende de operação contínua e medição por pelo menos um mês; uma execução de testes local não comprova esse indicador.

Os documentos originais permanecem nos arquivos fornecidos pelo responsável. Não são scripts nem instruções de execução e não foram alterados.

## Identificação das fontes (SHA-256)

| Arquivo fornecido | SHA-256 |
|---|---|
| `DRS_ImobiTech_Ajustado (3).docx` | `C5347A997A36EC3E8FFFC6F81D1DBB3262A106A0527495318483F186EB0FAD47` |
| `Documento_de_Arquitetura_ImobiTech_Ajustado (3).docx` | `502AC29F55D60EC76D2E47F813238D4784DD9E1BD126DAC6E56303CF05B5C5B0` |
| `Documento_de_Visao_Ajustado.pdf (2).pdf` | `3B9452212F6FAB53967CBBE3252A88918E94B207D8574E93845ED8255214FD0A` |
