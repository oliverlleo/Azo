# AZO — Obras + SEO + QR

## Regra arquitetural

O módulo **Obras** é independente do módulo **Projetos** existente.

- não lê `projects`;
- não lê `project_settings`;
- não importa Casa AS, Casa JT ou qualquer projeto existente;
- não altera galerias ou comportamento do portfólio atual;
- começa sem obras cadastradas;
- cada nova obra nasce exclusivamente no AZO Studio.

Fluxo:

```text
AZO Studio
  → Obras
    → Nova obra
      → /obras/{slug}/
        ├─ página comercial/SEO
        ├─ vídeo ou imagem no hero
        ├─ galeria
        ├─ CTA
        ├─ outras obras
        └─ QR exclusivo
```

## AZO Studio

A tela **Obras** oferece:

- busca e filtros;
- rascunho/publicação;
- arquivamento reversível;
- nome interno separado do título público;
- slug único;
- localização pública, tipo, área, ano, status e escopo;
- resumo comercial;
- introdução, desafio e solução;
- decisões principais e serviços;
- CTA configurável;
- obras relacionadas;
- imagem de hero;
- vídeo MP4/WebM em loop;
- poster/fallback;
- enquadramento X/Y e intensidade de overlay;
- galeria própria com alt, legenda e ordenação;
- título SEO, meta description e Open Graph;
- preview aproximado de resultado de busca;
- checklist SEO objetivo;
- visibilidade em `/obras/`;
- visibilidade opcional no menu desktop/mobile;
- nome específico no menu;
- indexação individual;
- QR individual compacto;
- rastreio de origem QR sem inflar a matriz;
- download PNG e SVG.

## Página pública

Cada obra publicada responde em:

```text
https://www.azocc.com.br/obras/{slug}/
```

A página é renderizada no edge para entregar HTML completo antes do JavaScript.

Inclui:

- `<title>` e meta description próprios;
- canonical limpo;
- `robots` por obra;
- Open Graph;
- JSON-LD `WebPage`;
- `BreadcrumbList`;
- `VideoObject` quando há vídeo com dados suficientes;
- H1 único;
- conteúdo comercial rastreável em HTML;
- links internos para serviços;
- CTA;
- outras obras;
- galeria acessível;
- motion alinhado ao site;
- `prefers-reduced-motion`;
- vídeo `muted`, `loop` e `playsinline`;
- nenhum loader AZO ou transição azul.

## QR compacto

O QR **não codifica mais a URL longa com três parâmetros UTM**. Ele codifica somente uma rota curta da própria obra:

```text
https://www.azocc.com.br/obras/?q={slug}
```

No ambiente em que o site estiver hospedado, a origem e a pasta-base são calculadas pelo próprio AZO Studio. Portanto o QR não depende de um domínio fixo gravado no JavaScript.

Ao receber `?q={slug}`, o endpoint de Obras valida que a obra está publicada e redireciona para a página oficial adicionando o rastreio **depois do scan**:

```text
/obras/{slug}/
  ?utm_source=qr
  &utm_medium=offline
  &utm_campaign={campanha-ou-slug}
```

Com isso:

- o QR contém menos caracteres e fica visualmente menos denso;
- o gerador usa nível de correção `L`, adequado para impressão limpa e com matriz menor;
- o rastreio de acesso físico continua disponível;
- a canonical continua sem parâmetros;
- o botão Copiar link e os downloads PNG/SVG usam o mesmo endereço curto;
- alterar conteúdo, mídia ou SEO não muda o QR enquanto o slug for preservado.

### Proteção de endereço

Mudança de slug é protegida no PostgreSQL:

1. o slug anterior é gravado automaticamente em `obra_redirects` dentro da transação do update;
2. a URL antiga responde com redirect permanente;
3. um slug histórico não pode ser reutilizado por outra obra;
4. isso evita que um QR já impresso passe a apontar para conteúdo diferente.

## Banco

Tabelas novas e independentes:

```text
obras
obra_redirects
```

RLS:

- `anon` lê somente obras `published = true` e `archived = false`;
- administrador autenticado gerencia obras e redirects;
- rascunhos não são públicos.

## Storage

Bucket existente `azo-media`:

```text
obras/{obra-id}/hero/
obras/{obra-id}/video/
obras/{obra-id}/poster/
obras/{obra-id}/gallery/
```

Permitidos:

- JPEG
- PNG
- WebP
- AVIF
- GIF
- MP4
- WebM

Limite por arquivo: 80 MB.

Remoções de imagens da galeria são executadas **somente depois** de o cadastro ser salvo com sucesso, evitando banco apontando para arquivo removido após cancelamento/erro.

## Sitemap

`/sitemap.xml` é gerado dinamicamente.

- obras publicadas e indexáveis entram individualmente;
- rascunhos não entram;
- obras `noindex` não entram individualmente;
- `/obras/` só entra quando existir conteúdo público no hub;
- `lastmod` vem de `updated_at`.

## Estado inicial

A implantação não cria obra exemplo nem reaproveita projetos existentes.

Após a migration:

```text
obras cadastradas = 0
```

O primeiro conteúdo deve ser criado pelo administrador dentro do AZO Studio.

## QA executado no banco

Foram validados em transações com rollback:

- anon visualiza obra publicada;
- anon não visualiza rascunho;
- redirect histórico é legível publicamente;
- mudança de slug gera histórico automaticamente;
- outro cadastro não consegue reutilizar slug histórico;
- nenhuma linha de QA permanece na tabela após os testes.

## Segurança

As Functions públicas usam apenas a chave `sb_publishable_...` no header `apikey` e dependem de RLS.

Nenhuma chave secret/service-role é enviada ao navegador ou versionada nesta implementação.
