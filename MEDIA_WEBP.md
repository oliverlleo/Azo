# Otimização de imagens com recuperação — AZO

## Novos uploads

Todos os uploads do admin usam `assets/js/image-upload.js`: projetos, imagens do site,
editores visuais, hero/poster/galeria de Obras, planta e imagens dos hotspots.

JPG e PNG estáticos são codificados com libwebp WASM local em modo **lossless**.
Não existe ajuste de resolução, compressão com perda ou envio a um serviço externo.
A comparação usa os pixels sRGB decodificados pelo navegador antes e depois da
conversão, incluindo alpha. O arquivo WebP só é enviado quando essa comparação
passa e ele fica menor que o original. A conversão acontece num Worker.

WebP, AVIF, GIF, SVG, vídeos e PNG animado são enviados no formato original.
PNG de 16 bits ou com perfil/gamma próprio e JPEG com ICC/CMYK são preservados.
Imagens acima de 24 megapixels, dimensões incompatíveis, erros ou navegadores
sem os recursos necessários também preservam o original. WebP lossless pode
não reduzir uma fotografia JPG que já tenha boa compressão; nesse caso o JPG
continua sendo usado. Os nomes, MIME e tamanhos registrados descrevem o arquivo
realmente enviado ao Storage.

## Arquivos já no Supabase

Projeto fixo: `jjrsbbgnqfiezhokxbqz`. Bucket: `azo-media`.
A rotina usa a API diretamente. Não usa o plugin/MCP e não contém tokens.

Preparar ambiente Python e instalar a dependência fixada:

```sh
python3 -m venv .venv-media
.venv-media/bin/python -m pip install -r scripts/requirements-media.txt
```

O token pessoal é solicitado num prompt oculto; opcionalmente a rotina lê
`SUPABASE_ACCESS_TOKEN`. Não passá-lo como argumento, escrever num arquivo do
repositório ou salvá-lo nos logs. A chave de Storage privilegiada existente é
obtida pela Management API e permanece apenas em memória. Nenhuma chave nova
é criada, e nenhuma credencial é enviada ao navegador.

### 1. Backup obrigatório

```sh
.venv-media/bin/python scripts/media_webp.py backup --backup-dir /caminho-seguro/media-backup-azo
```

Baixa todos os objetos do bucket (inclusive arquivos sem referência), grava hash
SHA-256, metadados e um snapshot de todas as tabelas públicas. Não modifica o
servidor. O backup só recebe `complete=true` quando o inventário e as tabelas
continuam iguais ao início da cópia. Se o conteúdo for editado durante o backup,
a rotina aborta; executar de novo num diretório novo durante uma janela sem edição.

Guardar uma cópia persistente e privada desse diretório completo antes do apply.
Não publicar o backup no bucket público nem no GitHub: contém os dados do site.
O diretório de backup deve estar fora do repositório ou numa pasta ignorada.

### 2. Preparar a conversão, sem modificar o servidor

```sh
.venv-media/bin/python scripts/media_webp.py plan --backup-dir /caminho-seguro/media-backup-azo
```

Verifica a integridade do backup, converte imagens JPEG/PNG compatíveis, valida
pixels RGBA, dimensões, perfil ICC, payload EXIF e XMP, e mantém somente versões
menores. Preserva animações, CMYK, PNG 16-bit e informações de cor incompatíveis.
O `plan.json` registra cada arquivo e o antes/depois de cada coluna alterada,
inclusive referências dentro de galerias e planta interativa em JSON e URLs em
HTML. Não converte fotos estáticas que fazem parte do repositório Git.

### 3. Aplicar

```sh
.venv-media/bin/python scripts/media_webp.py apply --backup-dir /caminho-seguro/media-backup-azo
```

Confere novamente o backup e o plano, verifica se os originais continuam iguais,
envia os WebP em caminhos novos exclusivos (sem sobrescrever), baixa cada novo
arquivo pela URL pública e compara seu SHA-256. Só então troca referências numa
transação única, com verificação de valores esperados. Um conflito com edição
posterior aborta a transação inteira. Depois confere os valores gravados.

O estado de aplicação fica salvo antes da primeira mutação, permitindo retomar
ou reverter após interrupção ou resposta perdida. Todos os originais permanecem
no Storage. A rotina **não possui nenhuma operação de exclusão**.

### 4. Restaurar

```sh
.venv-media/bin/python scripts/media_webp.py rollback --backup-dir /caminho-seguro/media-backup-azo
```

Verifica os originais pela URL pública; se faltarem, recupera seus bytes do backup.
Restaura somente as colunas afetadas pela migração numa transação única. Edições
posteriores nas mesmas colunas geram conflito, em vez de serem sobrescritas.
Confere o resultado e conserva todos os arquivos WebP e originais.

O rollback pode ser repetido e também é utilizável quando a execução do apply
foi interrompida antes de registrar sucesso. Não equivale a restaurar o banco
inteiro e não modifica RLS, autenticação ou esquema.

## Verificação

```sh
python3 -m unittest discover -s tests -p 'test_*.py' -v
node tests/test_webp_encoder.mjs
```

Os testes cobrem pixels/transparência, JPEG, orientação/ICC, animação/16-bit,
referências aninhadas, integridade do backup e geração da transação reversível.
A operação real exige acesso à Management API e ao Storage do projeto.
