# Dados e backups na avaliação acadêmica

O ambiente demonstrado usa dados **fictícios**. A aplicação coleta apenas os campos de usuário, imóvel, visita, contrato e lançamento necessários ao fluxo do DRS. Senhas são armazenadas como hash Argon2id; sessões opacas são revogáveis. O backend restringe consultas por perfil e vínculo. Eventos de alterações críticas preservam ator, data/hora e conteúdo anterior/posterior para auditoria.

## Rotina operacional

- `scripts/backup.sh` gera dump do banco e arquivo de fotos na inicialização do serviço de backup e a cada 24 horas enquanto Docker estiver ligado. Guarde os dois arquivos juntos, fora do repositório, e limite o acesso ao operador da instalação.
- `scripts/verify-backup.sh` restaura um dump em banco temporário e verifica o arquivo de fotos correspondente, sem substituir os volumes ativos. As evidências de [homologação anterior](evidence/mvp/restore.txt) e da [extensão de fotos](evidence/mvp/property-photos-backup.txt) registram verificações aprovadas.
- Antes de atualizar migrations ou migrar dados, faça um backup e confira a restauração. A meta de disponibilidade mensal precisa de monitoramento contínuo; consulte a matriz de RNF-002.

## Encerramento da instalação de avaliação

Ao terminar a avaliação, o responsável pelo ambiente decide o prazo de retenção dos dados e backups conforme as regras da instituição. Para uma instalação criada apenas com dados fictícios, remova os volumes Docker **somente depois** de confirmar que a avaliação e eventual revisão terminaram e que não há dados a preservar. Apague também os dumps e cópias externas sob seu controle. Se dados reais forem inseridos, estabeleça antes um procedimento institucional de retenção, acesso, exportação e anonimização/exclusão; a exclusão isolada de linhas pode contrariar as referências e o histórico de auditoria, por isso deve ser planejada e validada pelo responsável pelos dados.

Não versione `.env`, dumps ou credenciais. O [guia do professor](../GUIA_PROFESSOR.md) gera senhas próprias para cada instalação.
