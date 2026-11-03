# Fotos dos imóveis — armazenamento local

Além dos requisitos originais US01–US07, o ImobiTech permite anexar fotos ao cadastro do imóvel. Administrador e corretor podem adicionar ou remover; proprietário visualiza apenas fotos de imóveis vinculados à sua conta. O inquilino não acessa o módulo de imóveis nesta versão. Fotos não são públicas: a API exige sessão e confere o vínculo antes de entregar o arquivo.

## Como usar

Em **Imóveis → Novo imóvel**, clique na área **Selecionar fotos**, escolha os arquivos e salve o imóvel. O primeiro salvamento cria o cadastro e envia as fotos selecionadas. Depois disso, basta abrir o imóvel e **clicar na foto ou no espaço reservado**: ao escolher arquivos, o envio começa imediatamente. Em **Editar imóvel**, a área de fotos também envia imediatamente, sem precisar clicar em **Salvar imóvel** para as fotos. O botão **Remover** exclui uma foto já salva na hora; alterações nos demais campos continuam dependendo de **Salvar imóvel**.

A primeira foto aparece na listagem e todas aparecem na página de detalhes. São aceitas imagens JPEG, PNG ou WebP, com limite de **10 fotos por imóvel** e **5 MB por foto**. Um imóvel pode ser cadastrado sem fotos e receber imagens depois.

## Onde ficam os dados

- O PostgreSQL guarda ID, vínculo ao imóvel, formato, tamanho e chave interna na migration `003_property_photos.sql`. Não guarda os bytes da imagem.
- `LocalPhotoStorage` em `backend/src/properties/photo-storage.ts` grava os bytes em `PHOTO_STORAGE_DIR`. No Docker, o diretório `/app/property-photos` fica no volume persistente `photo_data`, compartilhado entre as duas APIs locais. Em desenvolvimento sem Docker, o padrão é `.local/property-photos` no diretório de execução da API.
- `scripts/backup.sh` gera um dump do banco e, com o mesmo horário no nome, um arquivo `-photos.tar.gz`. Guarde os dois juntos. `scripts/verify-backup.sh` restaura o banco em um banco temporário e verifica a integridade do arquivo de fotos, sem alterar o volume ativo. Para recuperar uma instalação, restaure o dump e extraia o arquivo de fotos no volume `photo_data` correspondente antes de iniciar a API.

A aplicação usa a interface `PhotoStorage` para leitura, gravação e remoção. Uma futura integração com Google Cloud Storage poderá implementar essa interface, migrar os arquivos existentes e apontar `storage_key` para o bucket, preservando as URLs da API e a verificação de permissões. Nenhuma integração com bucket está ativa nesta entrega.
