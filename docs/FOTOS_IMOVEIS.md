# Fotos dos imóveis — armazenamento local

Além dos requisitos originais US01–US07, o ImobiTech permite anexar fotos ao cadastro do imóvel. Administrador e corretor podem adicionar ou remover; proprietário visualiza apenas fotos de imóveis vinculados à sua conta. O inquilino não acessa o módulo de imóveis nesta versão. Fotos não são públicas: a API exige sessão e confere o vínculo antes de entregar o arquivo.

## Como usar

Em **Imóveis → Novo imóvel** ou **Editar imóvel**, selecione uma ou mais fotos JPEG, PNG ou WebP e salve. A primeira aparece na listagem; a página de detalhes mostra todas. Há limite de **10 fotos por imóvel** e **5 MB por foto**. No formulário de edição, **Remover** exclui uma foto já salva imediatamente. Um imóvel pode ser cadastrado sem fotos e receber imagens depois.

## Onde ficam os dados

- O PostgreSQL guarda ID, vínculo ao imóvel, formato, tamanho e chave interna na migration `003_property_photos.sql`. Não guarda os bytes da imagem.
- `LocalPhotoStorage` em `backend/src/properties/photo-storage.ts` grava os bytes em `PHOTO_STORAGE_DIR`. No Docker, o diretório `/app/property-photos` fica no volume persistente `photo_data`, compartilhado entre as duas APIs locais. Em desenvolvimento sem Docker, o padrão é `.local/property-photos` no diretório de execução da API.
- `scripts/backup.sh` gera um dump do banco e, com o mesmo horário no nome, um arquivo `-photos.tar.gz`. Guarde os dois juntos. `scripts/verify-backup.sh` restaura o banco em um banco temporário e verifica a integridade do arquivo de fotos, sem alterar o volume ativo. Para recuperar uma instalação, restaure o dump e extraia o arquivo de fotos no volume `photo_data` correspondente antes de iniciar a API.

A aplicação usa a interface `PhotoStorage` para leitura, gravação e remoção. Uma futura integração com Google Cloud Storage poderá implementar essa interface, migrar os arquivos existentes e apontar `storage_key` para o bucket, preservando as URLs da API e a verificação de permissões. Nenhuma integração com bucket está ativa nesta entrega.
