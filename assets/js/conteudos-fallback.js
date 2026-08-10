const SUPABASE_URL='https://jjrsbbgnqfiezhokxbqz.supabase.co';
const SUPABASE_KEY='sb_publishable_8LlV4bOH3d_axQBQLlHVkA_arQl6nu-';
const MODULE_URL=new URL(import.meta.url);
const SITE_ROOT=new URL('../../',MODULE_URL);
const CONTENT_ROOT=new URL('conteudos/',SITE_ROOT);
const CONTENT_INDEX=new URL('index.html',CONTENT_ROOT);
const FALLBACK_IMAGE=new URL('assets/images/project-feature.webp',SITE_ROOT).href;
const esc=(v='')=>String(v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const slugify=(v='')=>String(v).normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'');
const siteHref=(href='')=>{
  const value=String(href||'');
  if(/^(?:https?:|mailto:|tel:|#)/i.test(value)) return value;
  return new URL(value.replace(/^\/+/,''),SITE_ROOT).href;
};
const postHref=slug=>`${CONTENT_ROOT.href}?artigo=${encodeURIComponent(slug)}`;

async function rest(table,params={}){
  const url=new URL(`/rest/v1/${table}`,SUPABASE_URL);
  Object.entries(params).forEach(([k,v])=>url.searchParams.set(k,v));
  const response=await fetch(url,{headers:{apikey:SUPABASE_KEY,Authorization:`Bearer ${SUPABASE_KEY}`}});
  if(!response.ok) throw new Error(`HTTP ${response.status}`);
  return response.json();
}
function card(post){
  return `<a class="content-card content-reveal in" href="${postHref(post.slug)}"><div class="content-card__media"><img src="${esc(post.cover_url||FALLBACK_IMAGE)}" alt="${esc(post.cover_alt||post.title)}" loading="lazy"></div><div class="content-card__body"><div class="content-card__meta"><span>${esc(post.content_categories?.name||'Conteúdo')}</span></div><h3>${esc(post.title)}</h3><p>${esc(post.excerpt||'Leia o conteúdo completo da AZO.')}</p><span class="content-read">Ler conteúdo <i>→</i></span></div></a>`;
}
function block(b){const d=b.data||{};switch(b.block_type){
  case'paragraph':return `<p>${esc(d.text||'')}</p>`;
  case'h2':return `<h2 id="${esc(slugify(d.text||'secao'))}">${esc(d.text||'')}</h2>`;
  case'h3':return `<h3 id="${esc(slugify(d.text||'subsecao'))}">${esc(d.text||'')}</h3>`;
  case'image':return d.url?`<figure class="article-image"><img src="${esc(d.url)}" alt="${esc(d.alt||'')}" loading="lazy">${d.caption?`<figcaption>${esc(d.caption)}</figcaption>`:''}</figure>`:'';
  case'list':return `<ul>${(d.items||[]).map(i=>`<li>${esc(typeof i==='string'?i:i?.text||'')}</li>`).join('')}</ul>`;
  case'quote':return `<blockquote class="article-quote">${esc(d.text||'')}</blockquote>`;
  case'highlight':return `<aside class="article-highlight"><p>${esc(d.text||'')}</p></aside>`;
  case'faq':return `<div class="article-faq">${(d.items||[]).map(i=>`<details><summary>${esc(i.question||'')}</summary><p>${esc(i.answer||'')}</p></details>`).join('')}</div>`;
  case'cta':return `<aside class="article-cta"><h3>${esc(d.title||'Vamos conversar sobre seu projeto?')}</h3><p>${esc(d.text||'')}</p><a href="${esc(siteHref(d.href||'contato.html'))}">${esc(d.label||'Solicitar uma conversa')} →</a></aside>`;
  default:return'';
}}

async function showListing(){
  const posts=await rest('content_posts',{select:'id,title,slug,excerpt,cover_url,cover_alt,updated_at,content_categories(name,slug)',order:'updated_at.desc',limit:'60'});
  const grid=document.querySelector('#fallback-grid');
  if(grid) grid.innerHTML=posts.length?posts.map(card).join(''):'<div class="content-empty"><strong>Novos conteúdos em preparação.</strong>Em breve.</div>';
}
async function showCategory(categorySlug){
  const category=(await rest('content_categories',{select:'id,name,slug',slug:`eq.${categorySlug}`,limit:'1'}))[0];
  const posts=category?await rest('content_posts',{select:'id,title,slug,excerpt,cover_url,cover_alt,updated_at,content_categories(name,slug)',category_id:`eq.${category.id}`,order:'updated_at.desc',limit:'60'}):[];
  document.querySelector('#content-fallback-root').innerHTML=`<section class="content-shell"><div class="wrap content-section"><div class="content-head"><div><div class="content-eyebrow">${esc(category?.name||'Conteúdos')}</div><h2>Explore a categoria.</h2></div></div><div class="content-grid">${posts.map(card).join('')}</div></div></section>`;
}
async function showArticle(slug){
  const post=(await rest('content_posts',{select:'id,title,slug,excerpt,cover_url,cover_alt,author_name,updated_at,content_categories(name,slug)',slug:`eq.${slug}`,limit:'1'}))[0];
  if(!post) throw new Error('Conteúdo não encontrado.');
  const blocks=await rest('content_blocks',{select:'id,block_type,sort_order,data',post_id:`eq.${post.id}`,order:'sort_order.asc'});
  document.title=`${post.title} | AZO`;
  document.querySelector('#content-fallback-root').innerHTML=`<article><header class="article-hero"><div class="wrap"><nav class="article-breadcrumbs"><a href="${SITE_ROOT.href}">Início</a><span>·</span><a href="${CONTENT_ROOT.href}">Conteúdos</a></nav><div class="article-kicker"><span>${esc(post.content_categories?.name||'Conteúdo')}</span></div><h1>${esc(post.title)}</h1><p class="article-deck">${esc(post.excerpt||'')}</p></div></header><figure class="article-cover"><img src="${esc(post.cover_url||FALLBACK_IMAGE)}" alt="${esc(post.cover_alt||post.title)}"></figure><div class="article-layout"><div></div><div class="article-body">${blocks.map(block).join('')}</div></div></article>`;
}

async function run(){
  const params=new URLSearchParams(location.search);
  const articleSlug=params.get('artigo');
  const categorySlug=params.get('categoria');
  if(articleSlug) return showArticle(articleSlug);
  if(categorySlug) return showCategory(categorySlug);

  const contentPath=CONTENT_ROOT.pathname.replace(/\/$/,'');
  const relative=location.pathname.startsWith(contentPath)
    ? location.pathname.slice(contentPath.length).replace(/^\/+|\/+$/g,'')
    : '';
  if(!relative||relative==='index.html') return showListing();
  const bits=relative.split('/').filter(Boolean);
  if(bits[0]==='categoria'&&bits[1]) return showCategory(bits[1]);
  return showArticle(bits[0]);
}
run().catch(error=>{const grid=document.querySelector('#fallback-grid')||document.querySelector('#content-fallback-root');if(grid)grid.innerHTML=`<div class="content-empty"><strong>Conteúdos temporariamente indisponíveis.</strong>${esc(error.message)}</div>`;});
