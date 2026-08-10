const SUPABASE_URL = 'https://jjrsbbgnqfiezhokxbqz.supabase.co';
const SUPABASE_KEY = 'sb_publishable_8LlV4bOH3d_axQBQLlHVkA_arQl6nu-';
const SITE_ORIGIN = 'https://www.azocc.com.br';
const REST_HEADERS = { apikey: SUPABASE_KEY, Accept: 'application/json' };

const escapeHtml = (value = '') => String(value ?? '').replace(/[&<>"']/g, char => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
}[char]));
const safeJson = value => JSON.stringify(value).replace(/</g, '\\u003c');
const absoluteUrl = value => {
  if (!value) return '';
  try { return new URL(value, SITE_ORIGIN).href; } catch { return ''; }
};
const obraUrl = slug => `${SITE_ORIGIN}/obras/${encodeURIComponent(slug)}/`;

async function rest(path) {
  const response = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, { headers: REST_HEADERS });
  if (!response.ok) throw new Error(`Supabase ${response.status}`);
  return response.json();
}

function safeHref(value = '') {
  const raw = String(value || '').trim();
  if (!raw) return '/contato.html';
  if (raw.startsWith('/') && !raw.startsWith('//')) return raw;
  try {
    const url = new URL(raw, SITE_ORIGIN);
    if (['https:', 'mailto:', 'tel:'].includes(url.protocol)) return url.href;
  } catch {}
  return '/contato.html';
}

function serviceUrl(name = '') {
  const normalized = String(name).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  if (normalized.includes('interior')) return '/interiores.html';
  if (normalized.includes('gest') || normalized.includes('obra') || normalized.includes('constr')) return '/gestao-de-obras.html';
  if (normalized.includes('arquitet')) return '/projeto-arquitetonico.html';
  return '/servicos.html';
}

function menuLinks(rows) {
  return (rows || [])
    .filter(row => row.published && row.show_in_menu && !row.archived)
    .sort((a, b) => (a.sort_order || 9999) - (b.sort_order || 9999))
    .map(row => `<a href="/obras/${escapeHtml(row.slug)}/">${escapeHtml(row.menu_label || row.title)}</a>`)
    .join('');
}

function facts(row) {
  const items = [
    ['Localização', row.location_public], ['Tipo', row.work_type], ['Área', row.area_label],
    ['Ano', row.year_label], ['Status', row.status_label], ['Escopo', row.scope_label]
  ].filter(([, value]) => String(value || '').trim());

  if (!items.length) return '';
  return `<div class="obra-facts">${items.map(([label, value]) => `
    <div class="obra-fact"><span>${escapeHtml(label)}</span><strong>${escapeHtml(value)}</strong></div>`).join('')}
  </div>`;
}

function heroMedia(row) {
  const image = absoluteUrl(row.hero_image_url);
  const video = absoluteUrl(row.hero_video_url);
  const poster = absoluteUrl(row.hero_video_poster_url || row.hero_image_url);
  const x = Math.max(0, Math.min(100, Number(row.hero_media_position_x) || 50));
  const y = Math.max(0, Math.min(100, Number(row.hero_media_position_y) || 50));

  if (row.hero_media_type === 'video' && video) {
    return `<video autoplay muted loop playsinline preload="metadata" poster="${escapeHtml(poster)}" style="object-position:${x}% ${y}%"><source src="${escapeHtml(video)}">${image ? `<img src="${escapeHtml(image)}" alt="${escapeHtml(row.hero_image_alt || row.title)}">` : ''}</video>`;
  }

  return image
    ? `<img src="${escapeHtml(image)}" alt="${escapeHtml(row.hero_image_alt || row.title)}" fetchpriority="high" style="object-position:${x}% ${y}%">`
    : '';
}

function story(row) {
  const intro = row.intro_body?.trim() || '';
  const challenge = row.challenge_body?.trim() || '';
  const solution = row.solution_body?.trim() || '';
  const highlights = Array.isArray(row.highlights) ? row.highlights.filter(Boolean) : [];
  const sections = [];

  if (intro) sections.push({ id:'obra', title:row.intro_title?.trim() || 'A obra', body:intro, kicker:'Contexto' });
  if (challenge) sections.push({ id:'desafio', title:row.challenge_title?.trim() || 'O desafio', body:challenge, kicker:'Desafio' });
  if (solution) sections.push({ id:'solucao', title:row.solution_title?.trim() || 'A solução', body:solution, kicker:'Solução' });
  if (highlights.length) sections.push({ id:'destaques', title:'Decisões que fazem diferença.', highlights, kicker:'Decisões' });
  if (!sections.length) return '';

  const tabs = sections.map((section, index) => `<button type="button" role="tab" data-story-target="${section.id}" aria-selected="${index === 0 ? 'true' : 'false'}" tabindex="${index === 0 ? '0' : '-1'}"><span>${String(index + 1).padStart(2, '0')}</span><strong>${escapeHtml(section.title)}</strong><i aria-hidden="true"></i></button>`).join('');
  const panels = sections.map((section, index) => `<article class="obra-story-block obra-reveal" data-story-panel="${section.id}" ${index === 0 ? '' : 'hidden'}><div class="obra-story-block__kicker">${String(index + 1).padStart(2, '0')} · ${escapeHtml(section.kicker)}</div><h2>${escapeHtml(section.title)}</h2>${section.body ? `<p>${escapeHtml(section.body)}</p>` : ''}${section.highlights ? `<div class="obra-highlights">${section.highlights.map((item, itemIndex) => `<article class="obra-highlight"><span>${String(itemIndex + 1).padStart(2, '0')}</span><strong>${escapeHtml(item)}</strong></article>`).join('')}</div>` : ''}</article>`).join('');

  return `<section class="obra-story" id="conteudo"><div class="wrap obra-story__grid">
    <aside class="obra-story__aside obra-reveal">
      <div class="eyebrow">Por dentro da obra</div>
      <div class="obra-story__index" role="tablist" aria-label="Conteúdo da obra">${tabs}</div>
    </aside>
    <div class="obra-story__body">${panels}</div>
  </div></section>`;
}

function gallerySection(row) {
  const items = Array.isArray(row.gallery) ? row.gallery.filter(item => item?.url) : [];
  if (!items.length) return '';
  return `<section class="obra-gallery" id="galeria"><div class="wrap">
    <div class="obra-gallery__head obra-reveal"><div><div class="eyebrow">Galeria</div><h2>A obra<br>em detalhes.</h2></div><span>${String(items.length).padStart(2, '0')} imagens</span></div>
    <div class="obra-gallery__grid">${items.map((item, index) => `
      <figure class="obra-gallery__item obra-reveal"><img src="${escapeHtml(absoluteUrl(item.url))}" alt="${escapeHtml(item.alt || `${row.title} — imagem ${index + 1}`)}" loading="${index < 2 ? 'eager' : 'lazy'}" decoding="async">${item.caption ? `<figcaption>${escapeHtml(item.caption)}</figcaption>` : ''}</figure>`).join('')}
    </div>
  </div></section>`;
}

function servicesSection(row) {
  const items = Array.isArray(row.services) ? row.services.filter(Boolean) : [];
  if (!items.length) return '';
  return `<section class="obra-services"><div class="wrap obra-services__grid">
    <div class="obra-reveal"><div class="eyebrow">Atuação AZO</div><h2>Uma obra,<br>muitas decisões.</h2></div>
    <div class="obra-service-list obra-reveal">${items.map(item => `<div class="obra-service"><strong>${escapeHtml(item)}</strong><a href="${escapeHtml(serviceUrl(item))}">Conhecer serviço →</a></div>`).join('')}</div>
  </div></section>`;
}

function relatedSection(row, allRows) {
  if (!row.show_related) return '';
  const ids = Array.isArray(row.related_obra_ids) ? row.related_obra_ids.map(String) : [];
  let items = ids.length
    ? ids.map(id => allRows.find(item => String(item.id) === id)).filter(Boolean)
    : allRows.filter(item => item.id !== row.id && item.show_related && item.show_in_obras_index);

  items = items.filter(item => item.published && !item.archived).slice(0, 3);
  if (!items.length) return '';

  return `<section class="obra-related"><div class="wrap">
    <div class="obra-related__head obra-reveal"><div><div class="eyebrow">Continue explorando</div><h2>Outras obras.</h2></div><a class="button" href="/obras/">Ver todas <span class="arrow">→</span></a></div>
    <div class="obra-related__grid">${items.map(item => `<a class="obra-related-card obra-reveal" href="/obras/${escapeHtml(item.slug)}/"><div class="obra-related-card__media">${item.hero_image_url ? `<img src="${escapeHtml(absoluteUrl(item.hero_image_url))}" alt="${escapeHtml(item.hero_image_alt || item.title)}" loading="lazy">` : ''}</div><div class="obra-related-card__copy"><div><h3>${escapeHtml(item.title)}</h3><span>${escapeHtml(item.location_public || item.work_type || 'Obra AZO')}</span></div><b>↗</b></div></a>`).join('')}</div>
  </div></section>`;
}

function structuredData(row, canonical, title, description, ogImage) {
  const graph = [
    {
      '@type': 'WebPage', '@id': canonical, url: canonical, name: title, description,
      datePublished: row.published_at || row.created_at,
      dateModified: row.updated_at,
      primaryImageOfPage: ogImage ? { '@type': 'ImageObject', url: ogImage } : undefined,
      about: { '@type': 'Organization', name: 'AZO Criação & Construção', url: SITE_ORIGIN }
    },
    {
      '@type': 'BreadcrumbList',
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: 'Início', item: `${SITE_ORIGIN}/` },
        { '@type': 'ListItem', position: 2, name: 'Obras', item: `${SITE_ORIGIN}/obras/` },
        { '@type': 'ListItem', position: 3, name: row.title, item: canonical }
      ]
    }
  ];

  if (row.hero_media_type === 'video' && row.hero_video_url) {
    graph.push({
      '@type': 'VideoObject',
      name: row.title,
      description,
      thumbnailUrl: absoluteUrl(row.hero_video_poster_url || row.hero_image_url) || undefined,
      contentUrl: absoluteUrl(row.hero_video_url),
      uploadDate: row.published_at || row.created_at
    });
  }
  return { '@context': 'https://schema.org', '@graph': graph };
}

function render(row, allRows) {
  const canonical = obraUrl(row.slug);
  const title = row.seo_title || `${row.title} | AZO Criação & Construção`;
  const description = row.meta_description || row.excerpt || `Conheça ${row.title}, obra apresentada pela AZO.`;
  const ogImage = absoluteUrl(row.og_image_url || row.hero_video_poster_url || row.hero_image_url);
  const robots = row.allow_index ? 'index,follow,max-image-preview:large' : 'noindex,follow';
  const extraMenu = menuLinks(allRows);
  const overlay = Math.max(0, Math.min(80, Number(row.hero_overlay) || 34));
  const schema = structuredData(row, canonical, title, description, ogImage);

  return `<!doctype html><html lang="pt-BR"><head>
    <meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"><meta name="theme-color" content="#0d2f35">
    <title>${escapeHtml(title)}</title><meta name="description" content="${escapeHtml(description)}"><meta name="robots" content="${robots}"><link rel="canonical" href="${escapeHtml(canonical)}">
    <meta property="og:type" content="website"><meta property="og:locale" content="pt_BR"><meta property="og:site_name" content="AZO Criação & Construção"><meta property="og:title" content="${escapeHtml(title)}"><meta property="og:description" content="${escapeHtml(description)}"><meta property="og:url" content="${escapeHtml(canonical)}">${ogImage ? `<meta property="og:image" content="${escapeHtml(ogImage)}">` : ''}<meta name="twitter:card" content="summary_large_image">
    <link rel="stylesheet" href="/assets/css/site.css"><link rel="stylesheet" href="/assets/css/obra-page.css?v=20260810-1645"><script type="application/ld+json">${safeJson(schema)}</script>
  </head><body class="obra-page">
    <header class="site-header"><a class="brand" href="/" aria-label="AZO — início"><img src="/assets/images/logo-azo.png" alt="AZO Criação & Construção" width="760" height="213"></a><nav class="nav" aria-label="Navegação principal"><a href="/servicos.html">Serviços</a><a href="/projetos.html">Projetos</a>${extraMenu}<a href="/index.html#metodo">Como trabalhamos</a><a href="/sobre.html">Sobre</a><a class="nav-cta" href="/contato.html">Solicitar orçamento</a></nav><button class="menu-toggle" aria-label="Abrir menu" aria-expanded="false"><span></span></button></header>
    <nav class="mobile-nav" aria-label="Navegação móvel"><a href="/servicos.html">Serviços</a><a href="/projetos.html">Projetos</a>${extraMenu}<a href="/index.html#metodo">Como trabalhamos</a><a href="/sobre.html">Sobre</a><a href="/contato.html">Solicitar orçamento</a><small>Arquitetura · interiores · gestão de obras</small></nav>
    <main>
      <section class="obra-hero"><div class="obra-hero__media">${heroMedia(row)}</div><div class="obra-hero__veil" style="opacity:${Math.max(.5, overlay / 60)}"></div><div class="obra-hero__blueprint"><svg viewBox="0 0 1600 900" preserveAspectRatio="none" aria-hidden="true"><path d="M70 170H510V65H980V245H1530"/><path d="M170 805V515H615V335H1210V745H1515"/><rect x="280" y="190" width="620" height="420"/><path d="M900 190v420M280 400h620M540 190v210M690 400v210"/></svg></div><div class="obra-hero__orb"></div><div class="wrap obra-hero__content"><div class="obra-hero__eyebrow">${escapeHtml(row.eyebrow || 'Obra AZO')}</div><h1>${escapeHtml(row.title)}</h1><div class="obra-hero__bottom">${row.excerpt ? `<p class="obra-hero__intro">${escapeHtml(row.excerpt)}</p>` : '<div></div>'}${facts(row)}</div></div><a class="obra-scroll" href="#conteudo" aria-label="Conhecer a obra">↓</a></section>
      <div class="wrap obra-breadcrumb"><a href="/">Início</a> / <a href="/obras/">Obras</a> / ${escapeHtml(row.title)}</div>
      ${story(row)}${gallerySection(row)}${servicesSection(row)}
      <section class="obra-cta"><div class="wrap"><div class="obra-cta__card obra-reveal"><h2>${escapeHtml(row.cta_title || 'Planejando uma obra?')}</h2><div><p>${escapeHtml(row.cta_text || 'Converse com a AZO sobre o seu terreno, imóvel ou obra.')}</p><a class="button" href="${escapeHtml(safeHref(row.cta_url))}">${escapeHtml(row.cta_label || 'Solicitar uma conversa')} <span class="arrow">↗</span></a></div></div></div></section>
      ${relatedSection(row, allRows)}
    </main>
    <footer class="footer"><div class="wrap"><div class="footer-grid"><div><img class="footer-logo" src="/assets/images/logo-azo.png" alt="AZO Criação & Construção"><p style="max-width:430px;margin-top:24px">Arquitetura, interiores e gestão de obras residenciais em Sorocaba — do conceito à entrega.</p></div><div><h4>Navegação</h4><a href="/servicos.html">Serviços</a><a href="/projetos.html">Projetos</a><a href="/obras/">Obras</a><a href="/sobre.html">Sobre a AZO</a><a href="/contato.html">Contato</a></div><div><h4>Contato</h4><a href="tel:+5515997180355">(15) 99718-0355</a><a href="mailto:contato@azocc.com.br">contato@azocc.com.br</a><p>Rua Horácio Cenci, 75 · Sorocaba/SP</p></div></div><div class="footer-bottom"><span>© 2026 AZO Criação & Construção</span><span>Projeto · compatibilização · obra</span></div></div></footer>
    <div class="obra-lightbox" role="dialog" aria-modal="true" aria-label="Galeria da obra"><div class="obra-lightbox__top"><div><div class="obra-lightbox__title"></div><div class="obra-lightbox__count"></div></div><button class="obra-lightbox__close" aria-label="Fechar">×</button></div><div class="obra-lightbox__stage"><img alt=""></div><div class="obra-lightbox__controls"><button class="obra-lightbox__prev">← Anterior</button><button class="obra-lightbox__next">Próxima →</button></div></div>
    <script src="/assets/js/obra-page.js?v=20260810-1740" defer></script>
  </body></html>`;
}

function notFound() {
  return new Response(`<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex"><title>Obra não encontrada | AZO</title><link rel="stylesheet" href="/assets/css/site.css"></head><body><main class="section"><div class="wrap"><div class="eyebrow">AZO</div><h1 class="section-title">Obra não encontrada.</h1><p class="section-copy">Este endereço não está disponível.</p><a class="button dark" href="/obras/">Conhecer obras →</a></div></main></body></html>`, {
    status: 404,
    headers: { 'content-type': 'text/html; charset=UTF-8', 'cache-control': 'public, max-age=60', 'x-content-type-options': 'nosniff' }
  });
}

export async function onRequest(context) {
  const slug = String(context.params.slug || '').replace(/^\/+|\/+$/g, '').toLowerCase();
  if (!slug || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) return notFound();

  try {
    const rows = await rest(`obras?slug=eq.${encodeURIComponent(slug)}&published=eq.true&archived=eq.false&select=*&limit=1`);
    const row = rows?.[0];

    if (!row) {
      const redirects = await rest(`obra_redirects?from_slug=eq.${encodeURIComponent(slug)}&active=eq.true&select=obra_id&limit=1`);
      if (redirects?.[0]?.obra_id) {
        const target = await rest(`obras?id=eq.${encodeURIComponent(redirects[0].obra_id)}&published=eq.true&archived=eq.false&select=slug&limit=1`);
        if (target?.[0]?.slug) return Response.redirect(obraUrl(target[0].slug), 301);
      }
      return notFound();
    }

    const allRows = await rest('obras?published=eq.true&archived=eq.false&select=id,slug,title,location_public,work_type,hero_image_url,hero_image_alt,show_in_menu,menu_label,show_in_obras_index,show_related,sort_order,published,archived&order=sort_order.asc');
    return new Response(render(row, allRows || []), {
      status: 200,
      headers: {
        'content-type': 'text/html; charset=UTF-8',
        'cache-control': 'public, max-age=120, s-maxage=300, stale-while-revalidate=900',
        'x-content-type-options': 'nosniff',
        'referrer-policy': 'strict-origin-when-cross-origin'
      }
    });
  } catch (error) {
    console.error('[AZO Obras] Falha ao renderizar obra.', error);
    return new Response('Temporariamente indisponível.', {
      status: 503,
      headers: { 'content-type': 'text/plain; charset=UTF-8', 'cache-control': 'no-store', 'x-content-type-options':'nosniff' }
    });
  }
}
