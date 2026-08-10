const SUPABASE_URL='https://jjrsbbgnqfiezhokxbqz.supabase.co';
const SUPABASE_KEY='sb_publishable_8LlV4bOH3d_axQBQLlHVkA_arQl6nu-';
const SITE='https://azocc.com.br';

const esc=(v='')=>String(v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const attr=esc;
const slugify=(v='')=>String(v).normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'');
const words=v=>String(v||'').trim().split(/\s+/).filter(Boolean).length;
const readingMinutes=(post,blocks=[])=>Math.max(1,Math.ceil((words(post?.title)+words(post?.excerpt)+blocks.reduce((n,b)=>n+words(JSON.stringify(b.data||{})),0))/210));
const dateFmt=value=>value?new Intl.DateTimeFormat('pt-BR',{day:'2-digit',month:'long',year:'numeric',timeZone:'America/Sao_Paulo'}).format(new Date(value)):'';
const SERVICE_MAP={
  'projeto-arquitetonico':{title:'Projeto arquitetônico',href:'/projeto-arquitetonico.html',text:'Do estudo inicial à documentação técnica, com decisões conectadas ao terreno, rotina e orçamento.'},
  interiores:{title:'Design de interiores',href:'/interiores.html',text:'Layout, materiais, iluminação e mobiliário conectados à arquitetura da residência.'},
  'gestao-de-obras':{title:'Gestão de obras',href:'/gestao-de-obras.html',text:'Coordenação, fornecedores, cronograma e acompanhamento para preservar a intenção do projeto.'}
};

async function rest(table,params={}){
  const url=new URL(`/rest/v1/${table}`,SUPABASE_URL);
  for(const [k,v] of Object.entries(params)) if(v!==undefined&&v!==null) url.searchParams.set(k,v);
  const response=await fetch(url,{headers:{apikey:SUPABASE_KEY,Authorization:`Bearer ${SUPABASE_KEY}`,Accept:'application/json'}});
  if(!response.ok) throw new Error(`${table}: HTTP ${response.status} ${await response.text()}`);
  return response.json();
}

function shell({title,description,canonical,ogImage,body,articleJson='',extraHead=''}){
  const social=ogImage||`${SITE}/assets/images/project-feature.webp`;
  return `<!doctype html><html lang="pt-BR"><head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<meta name="theme-color" content="#0d2f35"><title>${esc(title)}</title>
<meta name="description" content="${attr(description)}"><link rel="canonical" href="${attr(canonical)}"><link rel="alternate" type="application/rss+xml" title="Conteúdos AZO" href="/feed.xml">
<meta property="og:type" content="${articleJson?'article':'website'}"><meta property="og:locale" content="pt_BR"><meta property="og:title" content="${attr(title)}"><meta property="og:description" content="${attr(description)}"><meta property="og:url" content="${attr(canonical)}"><meta property="og:image" content="${attr(social)}">
<meta name="twitter:card" content="summary_large_image"><meta name="twitter:title" content="${attr(title)}"><meta name="twitter:description" content="${attr(description)}"><meta name="twitter:image" content="${attr(social)}">
<link rel="stylesheet" href="/assets/css/site.css"><link rel="stylesheet" href="/assets/css/conteudos.css">${extraHead}
<script type="application/ld+json">${JSON.stringify({'@context':'https://schema.org','@type':'BreadcrumbList','itemListElement':canonical===`${SITE}/conteudos/`?[{'@type':'ListItem','position':1,'name':'Início','item':`${SITE}/`},{'@type':'ListItem','position':2,'name':'Conteúdos','item':canonical}]:[{'@type':'ListItem','position':1,'name':'Início','item':`${SITE}/`},{'@type':'ListItem','position':2,'name':'Conteúdos','item':`${SITE}/conteudos/`},{'@type':'ListItem','position':3,'name':title,'item':canonical}]})}</script>${articleJson?`<script type="application/ld+json">${articleJson}</script>`:''}
</head><body class="content-page">
<header class="site-header"><a class="brand" href="/" aria-label="AZO — início"><img src="/assets/images/logo-azo.png" alt="AZO Criação & Construção" width="760" height="213"></a><nav class="nav" aria-label="Navegação principal"><a href="/servicos.html">Serviços</a><a href="/projetos.html">Projetos</a><a href="/#metodo">Como trabalhamos</a><a href="/conteudos/" class="active">Conteúdos</a><a href="/sobre.html">Sobre</a><a class="nav-cta" href="/contato.html">Solicitar orçamento</a></nav><button class="menu-toggle" aria-label="Abrir menu" aria-expanded="false"><span></span></button></header>
<nav class="mobile-nav" aria-label="Navegação móvel"><a href="/servicos.html">Serviços</a><a href="/projetos.html">Projetos</a><a href="/#metodo">Como trabalhamos</a><a href="/conteudos/">Conteúdos</a><a href="/sobre.html">Sobre</a><a href="/contato.html">Solicitar orçamento</a><small>Arquitetura · interiores · gestão de obras</small></nav>
<main>${body}</main>
<footer class="site-footer"><div class="wrap footer-grid"><div><img class="footer-logo" src="/assets/images/logo-azo.png" alt="AZO Criação & Construção"><p>Arquitetura, interiores e gestão de obras conectados em uma jornada só.</p></div><div><strong>Navegação</strong><a href="/servicos.html">Serviços</a><a href="/projetos.html">Projetos</a><a href="/conteudos/">Conteúdos</a><a href="/sobre.html">Sobre</a><a href="/contato.html">Contato</a></div><div><strong>AZO</strong><a href="mailto:contato@azocc.com.br">contato@azocc.com.br</a><a href="tel:+5515997180355">(15) 99718-0355</a><span>Sorocaba · SP</span></div></div></footer>
<script src="/assets/js/conteudos-public.js" defer></script></body></html>`;
}

function card(post,index=0){
  const category=post.content_categories?.name||'Conteúdo';
  const cover=post.cover_url||'/assets/images/project-feature.webp';
  const date=post.published_at||post.scheduled_at||post.updated_at;
  return `<a class="content-card content-reveal" data-delay="${Math.min(index+1,3)}" href="/conteudos/${encodeURIComponent(post.slug)}/"><div class="content-card__media"><img src="${attr(cover)}" alt="${attr(post.cover_alt||post.title)}" loading="lazy"></div><div class="content-card__body"><div class="content-card__meta"><span>${esc(category)}</span><span>${esc(dateFmt(date))}</span></div><h3>${esc(post.title)}</h3><p>${esc(post.excerpt||'Leia o conteúdo completo da AZO.')}</p><span class="content-read">Ler conteúdo <i>→</i></span></div></a>`;
}

async function listing(categorySlug=''){
  const categories=await rest('content_categories',{select:'id,name,slug,description,sort_order',order:'sort_order.asc,name.asc'});
  let category=null;
  if(categorySlug){category=categories.find(c=>c.slug===categorySlug)||null;if(!category)return null;}
  const params={select:'id,title,slug,excerpt,cover_url,cover_alt,published_at,scheduled_at,updated_at,content_categories(name,slug)',order:'published_at.desc.nullslast,updated_at.desc',limit:'60'};
  if(category) params.category_id=`eq.${category.id}`;
  const posts=await rest('content_posts',params);
  const feature=posts[0],remaining=posts.slice(1);
  const title=category?`${category.name} | Conteúdos AZO`:'Conteúdos | AZO Criação & Construção';
  const description=category?.description||'Arquitetura, interiores, planejamento e obra explicados pela AZO para ajudar em decisões melhores antes e durante a construção.';
  const canonical=category?`${SITE}/conteudos/categoria/${category.slug}/`:`${SITE}/conteudos/`;
  const hero=`<section class="content-hero"><div class="content-hero__media"><img src="/assets/images/service-architecture.webp" alt="Arquitetura residencial AZO" fetchpriority="high"></div><div class="content-hero__veil"></div><div class="content-hero__geometry"><svg viewBox="0 0 1600 900" preserveAspectRatio="none" aria-hidden="true"><path d="M70 180H520V80H940V240H1540"/><path d="M120 790V490H650V320H1260V720H1510"/><circle cx="1250" cy="360" r="150"/><line x1="1100" y1="360" x2="1400" y2="360"/><line x1="1250" y1="210" x2="1250" y2="510"/></svg></div><div class="content-hero__halo"></div><div class="wrap content-hero__inner"><div class="content-hero__eyebrow">${category?esc(category.name):'Conteúdos'}</div><h1>${category?`Ideias sobre <em>${esc(category.name.toLowerCase())}</em>.`:'Decisões melhores<br><em>começam com clareza.</em>'}</h1><div class="content-hero__bottom"><p class="content-hero__lead">${esc(description)}</p><div class="content-hero__signal"><span><b>Arquitetura</b><i>01</i></span><span><b>Interiores</b><i>02</i></span><span><b>Obra</b><i>03</i></span></div></div></div></section>`;
  const filters=`<div class="content-filter-wrap"><div class="content-filters"><a class="content-filter ${!category?'active':''}" href="/conteudos/">Todos</a>${categories.map(c=>`<a class="content-filter ${category?.slug===c.slug?'active':''}" href="/conteudos/categoria/${encodeURIComponent(c.slug)}/">${esc(c.name)}</a>`).join('')}</div><div class="content-count">${posts.length} ${posts.length===1?'conteúdo':'conteúdos'}</div></div>`;
  const featureHtml=feature?`<a class="content-feature content-reveal" href="/conteudos/${encodeURIComponent(feature.slug)}/"><div class="content-feature__media"><img src="${attr(feature.cover_url||'/assets/images/project-feature.webp')}" alt="${attr(feature.cover_alt||feature.title)}"></div><div class="content-feature__copy"><div class="content-feature__meta"><span>${esc(feature.content_categories?.name||'Conteúdo')}</span><span>${esc(dateFmt(feature.published_at||feature.updated_at))}</span></div><h3>${esc(feature.title)}</h3><p>${esc(feature.excerpt||'Leia o conteúdo completo da AZO.')}</p><span class="content-read">Ler conteúdo <i>→</i></span></div></a>`:'<div class="content-empty"><strong>Novos conteúdos em preparação.</strong>Em breve, a AZO publica aqui materiais sobre arquitetura, interiores e obra.</div>';
  const body=`${hero}<section class="content-shell"><div class="wrap content-section"><div class="content-head content-reveal"><div><div class="content-eyebrow">Biblioteca editorial</div><h2>${category?'Explore a categoria.':'Para pensar antes de decidir.'}</h2></div><p>Conteúdo técnico traduzido em escolhas mais claras — do primeiro estudo à execução.</p></div>${featureHtml}${filters}<div class="content-grid">${remaining.length?remaining.map(card).join(''):(!feature?featureHtml:'')}</div></div></section>`;
  return shell({title,description,canonical,ogImage:feature?.cover_url,body});
}

function renderList(data){const items=Array.isArray(data?.items)?data.items:Array.isArray(data)?data:[];return `<ul>${items.map(i=>`<li>${esc(typeof i==='string'?i:(i?.text||''))}</li>`).join('')}</ul>`;}
function renderTable(data){const headers=Array.isArray(data?.headers)?data.headers:[],rows=Array.isArray(data?.rows)?data.rows:[];return `<table class="article-table">${headers.length?`<thead><tr>${headers.map(h=>`<th>${esc(h)}</th>`).join('')}</tr></thead>`:''}<tbody>${rows.map(r=>`<tr>${(Array.isArray(r)?r:[]).map(c=>`<td>${esc(c)}</td>`).join('')}</tr>`).join('')}</tbody></table>`;}
function renderGallery(data){const images=Array.isArray(data?.images)?data.images:[];if(!images.length)return'';return `<div class="content-reveal" style="display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:14px;margin:54px 0">${images.map((img,i)=>`<figure style="margin:0;overflow:hidden;border-radius:22px;${i===0&&images.length%2===1?'grid-column:1/-1':''}"><img src="${attr(img.url||'')}" alt="${attr(img.alt||'')}" loading="lazy" style="width:100%;height:100%;min-height:260px;object-fit:cover"></figure>`).join('')}</div>`;}
function renderService(key){const service=SERVICE_MAP[key];if(!service)return'';return `<aside class="article-cta content-reveal"><h3>${esc(service.title)}</h3><p>${esc(service.text)}</p><a href="${attr(service.href)}">Entender como funciona →</a></aside>`;}
function renderProjects(keys=[],projectMap=new Map()){const projects=(Array.isArray(keys)?keys:[]).map(key=>({key,title:projectMap.get(key)||(/^([A-Z]{2})$/.test(key)?`Casa ${key}`:'Projeto AZO')}));if(!projects.length)return'';return `<section style="margin:70px 0"><div class="content-eyebrow">Projetos relacionados</div><div class="content-grid" style="grid-template-columns:repeat(${Math.min(projects.length,3)},minmax(0,1fr));margin-top:24px">${projects.map((p,i)=>`<a class="content-card content-reveal" data-delay="${i+1}" href="/projetos.html"><div class="content-card__body"><div class="content-card__meta"><span>Projeto AZO</span></div><h3>${esc(p.title)}</h3><span class="content-read">Conhecer projetos <i>→</i></span></div></a>`).join('')}</div></section>`;}
function renderBlock(block,ctx={}){const d=block.data||{};switch(block.block_type){
  case'paragraph':return `<p>${esc(d.text||'')}</p>`;
  case'h2':{const id=slugify(d.text||'secao');return `<h2 id="${attr(id)}">${esc(d.text||'')}</h2>`;}
  case'h3':{const id=slugify(d.text||'subsecao');return `<h3 id="${attr(id)}">${esc(d.text||'')}</h3>`;}
  case'image':return d.url?`<figure class="article-image content-reveal"><img src="${attr(d.url)}" alt="${attr(d.alt||'')}" loading="lazy">${d.caption?`<figcaption>${esc(d.caption)}</figcaption>`:''}</figure>`:'';
  case'gallery':return renderGallery(d);
  case'list':return renderList(d);
  case'quote':return `<blockquote class="article-quote content-reveal">${esc(d.text||'')}</blockquote>`;
  case'highlight':return `<aside class="article-highlight content-reveal"><p>${esc(d.text||'')}</p></aside>`;
  case'faq':{const items=Array.isArray(d.items)?d.items:[];return `<div class="article-faq">${items.map(i=>`<details><summary>${esc(i.question||'')}</summary><p>${esc(i.answer||'')}</p></details>`).join('')}</div>`;}
  case'cta':return `<aside class="article-cta content-reveal"><h3>${esc(d.title||'Vamos conversar sobre seu projeto?')}</h3><p>${esc(d.text||'Conte para a AZO em que etapa você está e entenda o próximo passo.')}</p><a href="${attr(d.href||'/contato.html')}">${esc(d.label||'Solicitar uma conversa')} →</a></aside>`;
  case'table':return renderTable(d);
  case'related_projects':return renderProjects(d.keys||[],ctx.projectMap);
  case'related_service':return renderService(d.key);
  case'separator':return '<hr style="border:0;border-top:1px solid rgba(13,47,53,.14);margin:56px 0">';
  default:return'';
}}

async function projectTitles(keys=[]){
  const wanted=new Set((keys||[]).filter(Boolean));if(!wanted.size)return new Map();
  const map=new Map();
  try{const builtins=await rest('project_settings',{select:'id,builtin_key,title,published'});for(const p of builtins){const key=p.builtin_key||p.id;if(wanted.has(key)&&p.published!==false)map.set(key,p.title||`Casa ${key}`);}}catch(_){ }
  try{const projects=await rest('projects',{select:'id,title,published'});for(const p of projects)if(wanted.has(p.id)&&p.published!==false)map.set(p.id,p.title||'Projeto AZO');}catch(_){ }
  return map;
}

async function article(slug){
  const posts=await rest('content_posts',{select:'id,title,slug,excerpt,cover_url,cover_alt,cover_focal_x,cover_focal_y,seo_title,seo_description,canonical_url,social_image_url,author_name,published_at,scheduled_at,updated_at,related_project_keys,related_service_keys,content_categories(name,slug)',slug:`eq.${slug}`,limit:'1'});
  const post=posts[0];if(!post)return null;
  const blocks=await rest('content_blocks',{select:'id,block_type,sort_order,data',post_id:`eq.${post.id}`,order:'sort_order.asc,created_at.asc'});
  const blockProjectKeys=blocks.filter(b=>b.block_type==='related_projects').flatMap(b=>Array.isArray(b.data?.keys)?b.data.keys:[]);
  const projectMap=await projectTitles([...(post.related_project_keys||[]),...blockProjectKeys]);
  const toc=blocks.filter(b=>b.block_type==='h2'&&b.data?.text).map(b=>({id:slugify(b.data.text),text:b.data.text}));
  const mins=readingMinutes(post,blocks),canonical=post.canonical_url||`${SITE}/conteudos/${post.slug}/`,title=post.seo_title||post.title,description=post.seo_description||post.excerpt||`Conteúdo da AZO sobre ${post.title}.`;
  const faqItems=blocks.filter(b=>b.block_type==='faq').flatMap(b=>Array.isArray(b.data?.items)?b.data.items:[]).filter(i=>i.question&&i.answer);
  const articleSchema={'@context':'https://schema.org','@type':'BlogPosting','headline':post.title,'description':description,'image':post.social_image_url||post.cover_url||undefined,'datePublished':post.published_at||post.scheduled_at||post.updated_at,'dateModified':post.updated_at,'author':{'@type':'Organization','name':post.author_name||'AZO Criação & Construção'},'publisher':{'@type':'Organization','name':'AZO Criação & Construção','logo':{'@type':'ImageObject','url':`${SITE}/assets/images/logo-azo.png`}},'mainEntityOfPage':canonical};
  const schema=[articleSchema];if(faqItems.length)schema.push({'@context':'https://schema.org','@type':'FAQPage','mainEntity':faqItems.map(i=>({'@type':'Question','name':i.question,'acceptedAnswer':{'@type':'Answer','text':i.answer}}))});
  const articleJson=JSON.stringify(schema.length===1?schema[0]:schema),category=post.content_categories?.name||'Conteúdo',date=post.published_at||post.scheduled_at||post.updated_at,cover=post.cover_url||'/assets/images/project-feature.webp';
  const bodyBlocks=blocks.map(b=>renderBlock(b,{projectMap})).join('');
  const hasProjectBlock=blocks.some(b=>b.block_type==='related_projects'),hasServiceBlock=blocks.some(b=>b.block_type==='related_service');
  const relationships=`${!hasProjectBlock?renderProjects(post.related_project_keys||[],projectMap):''}${!hasServiceBlock?(post.related_service_keys||[]).map(renderService).join(''):''}`;
  let related=[];try{related=await rest('content_posts',{select:'id,title,slug,excerpt,cover_url,cover_alt,published_at,updated_at,content_categories(name,slug)',order:'published_at.desc.nullslast,updated_at.desc',limit:'4'});}catch(_){ }
  related=related.filter(p=>p.id!==post.id).slice(0,3);
  const focalX=Number(post.cover_focal_x??50),focalY=Number(post.cover_focal_y??50);
  const body=`<article><header class="article-hero"><div class="wrap"><nav class="article-breadcrumbs"><a href="/">Início</a><span>·</span><a href="/conteudos/">Conteúdos</a><span>·</span><span>${esc(category)}</span></nav><div class="article-kicker"><span>${esc(category)}</span><button class="content-filter" type="button" data-copy-article>Copiar link</button></div><h1>${esc(post.title)}</h1><p class="article-deck">${esc(post.excerpt||description)}</p><div class="article-meta"><span>${esc(dateFmt(date))}</span><span>·</span><span>${mins} min de leitura</span><span>·</span><span>${esc(post.author_name||'AZO Criação & Construção')}</span></div></div></header><figure class="article-cover"><img src="${attr(cover)}" alt="${attr(post.cover_alt||post.title)}" fetchpriority="high" style="object-position:${focalX}% ${focalY}%"></figure><div class="article-layout">${toc.length?`<aside class="article-toc"><div class="article-toc__title">Neste conteúdo</div>${toc.map((i,n)=>`<a href="#${attr(i.id)}"><span>${String(n+1).padStart(2,'0')} · </span>${esc(i.text)}</a>`).join('')}</aside>`:'<div></div>'}<div class="article-body">${bodyBlocks}${relationships}</div></div></article>${related.length?`<section class="related-content"><div class="wrap"><div class="content-head content-reveal"><div><div class="content-eyebrow">Continue explorando</div><h2>Mais ideias<br>para decidir melhor.</h2></div><p>Outros conteúdos da AZO que podem ajudar na próxima decisão.</p></div><div class="content-grid">${related.map(card).join('')}</div></div></section>`:''}`;
  return shell({title,description,canonical,ogImage:post.social_image_url||post.cover_url,body,articleJson,extraHead:`<meta property="article:published_time" content="${attr(post.published_at||post.scheduled_at||post.updated_at)}"><meta property="article:modified_time" content="${attr(post.updated_at)}">`});
}

async function redirectFor(path){try{const rows=await rest('content_redirects',{select:'source_path,destination_path,status_code',source_path:`eq.${path}`,limit:'1'});return rows[0]||null;}catch(_){return null;}}
function notFound(path,title='Conteúdo não encontrado | AZO'){return new Response(shell({title,description:'O conteúdo solicitado não está disponível.',canonical:`${SITE}${path}`,body:'<section class="content-shell"><div class="wrap content-section"><div class="content-empty"><strong>Conteúdo não encontrado.</strong><a href="/conteudos/">Voltar para Conteúdos →</a></div></div></section>'}),{status:404,headers:{'content-type':'text/html; charset=utf-8'}});}

export async function onRequestGet(context){
  try{
    const raw=context.params?.path,parts=(Array.isArray(raw)?raw:String(raw||'').split('/')).filter(Boolean).map(decodeURIComponent);
    if(!parts.length)return new Response(await listing(),{headers:{'content-type':'text/html; charset=utf-8','cache-control':'public,max-age=60,s-maxage=300'}});
    if(parts[0]==='categoria'&&parts[1]){const html=await listing(parts[1]);return html?new Response(html,{headers:{'content-type':'text/html; charset=utf-8','cache-control':'public,max-age=60,s-maxage=300'}}):notFound(`/conteudos/categoria/${parts[1]}/`,'Categoria não encontrada | AZO');}
    const slug=parts[0],html=await article(slug);if(html)return new Response(html,{headers:{'content-type':'text/html; charset=utf-8','cache-control':'public,max-age=60,s-maxage=300'}});
    const path=`/conteudos/${parts.join('/')}/`,redirect=await redirectFor(path);if(redirect)return Response.redirect(new URL(redirect.destination_path,SITE),redirect.status_code||301);
    return notFound(path);
  }catch(error){return new Response(`<!doctype html><meta charset="utf-8"><title>Conteúdos AZO</title><h1>Conteúdos temporariamente indisponíveis</h1><p>${esc(error.message)}</p>`,{status:503,headers:{'content-type':'text/html; charset=utf-8','cache-control':'no-store'}});}
}
