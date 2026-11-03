# Contas de teste da instalação local

Estas contas foram criadas no banco **local** do projeto Docker `imobitech-qa`, após a limpeza dos dados em 03/11/2026. Acesse [http://localhost:5173](http://localhost:5173). O banco contém apenas estes quatro usuários; imóveis, visitas, contratos, pagamentos e histórico começam vazios para que os fluxos possam ser testados do início.

| Perfil | E-mail | Senha |
|---|---|---|
| Administrador | `admin@imobitech.test` | `Admin@Imobi2026!` |
| Corretor | `corretor@imobitech.test` | `Corretor@Imobi2026!` |
| Proprietário | `proprietario@imobitech.test` | `Proprietario@Imobi2026!` |
| Inquilino | `inquilino@imobitech.test` | `Inquilino@Imobi2026!` |

As senhas acima são públicas e destinam-se **somente à demonstração local**, com a porta 5173 vinculada a `127.0.0.1`. Elas não são criadas automaticamente ao clonar o repositório. Para uma instalação nova, siga o [guia do professor](../GUIA_PROFESSOR.md), que gera credenciais próprias; não use estas senhas em ambiente público.

**Modelo de uso:** o MVP atende uma única imobiliária. Há quatro perfis de usuário, incluindo o perfil *inquilino*; isso não significa que o software seja multitenant ou multiempresa. Consulte a [decisão de escopo](ESCOPO_MVP.md).
