const SUPABASE_URL='https://jjrsbbgnqfiezhokxbqz.supabase.co';
const SUPABASE_KEY='sb_publishable_8LlV4bOH3d_axQBQLlHVkA_arQl6nu-';

const esc=(v='')=>String(v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const contentHref=()=>'/conteudos/';

function installNav(){
  if(location.pathname.includes('/admin/')) return;
  const desktop=document.querySelector('.nav');
  if(desktop && !desktop.querySelector('[data-azo-content-link]')){
    const link=document.createElement('a');
    link.href=contentHref();
    link.textContent='Conteúdos';
    link.dataset.azoContentLink='1';
    if(location.pathname.startsWith('/conteudos')) link.classList.add('active');
    const about=[...desktop.querySelectorAll('a')].find(a=>/sobre/i.test(a.textContent||''));
    desktop.insertBefore(link,about||desktop.querySelector('.nav-cta')||null);
  }

  const mobile=document.querySelector('.mobile-nav');
  if(mobile && !mobile.querySelector('[data-azo-content-link]')){
    const link=document.createElement('a');
    link.href=contentHref();
    link.textContent='Conteúdos';
    link.dataset.azoContentLink='1';
    const about=[...mobile.querySelectorAll('a')].find(a=>/sobre/i.test(a.textContent||''));
    mobile.insertBefore(link,about||mobile.querySelector('a[href*="contato"]')||mobile.querySelector('small')||null);
  }

  const footer=document.querySelector('footer');
  if(footer && !footer.querySelector('[data-azo-content-link]')){
    const link=document.createElement('a');
    link.href=contentHref();
    link.textContent='Conteúdos';
    link.dataset.azoContentLink='1';
    const linkGroup=footer.querySelector('nav,.footer-links,.footer__links') || [...footer.querySelectorAll('div')].find(el=>el.querySelectorAll(':scope > a').length>=2);
    if(linkGroup) linkGroup.appendChild(link);
  }
}

async function latestPosts(){
  const url=new URL('/rest/v1/content_posts',SUPABASE_URL);
  url.searchParams.set('select','id,title,slug,excerpt,cover_url,cover_alt,published_at,scheduled_at,content_categories(name,slug)');
  url.searchParams.set('order','published_at.desc.nullslast,updated_at.desc');
  url.searchParams.set('limit','3');
  const response=await fetch(url,{headers:{apikey:SUPABASE_KEY,Authorization:`Bearer ${SUPABASE_KEY}`}});
  if(!response.ok) throw new Error(`Conteúdos HTTP ${response.status}`);
  return response.json();
}

function card(post,index=0){
  const cat=post.content_categories?.name||'Conteúdo';
  const image=post.cover_url||'assets/images/project-feature.webp';
  return `<a class="content-card content-reveal" data-delay="${Math.min(index+1,3)}" href="/conteudos/${encodeURIComponent(post.slug)}/">
    <div class="content-card__media"><img src="${esc(image)}" alt="${esc(post.cover_alt||post.title)}" loading="lazy"></div>
    <div class="content-card__body">
      <div class="content-card__meta"><span>${esc(cat)}</span></div>
      <h3>${esc(post.title)}</h3>
      <p>${esc(post.excerpt||'Leia o conteúdo completo da AZO.')}</p>
      <span class="content-read">Ler conteúdo <i>→</i></span>
    </div>
  </a>`;
}

function reveal(root=document){
  const nodes=[...root.querySelectorAll('.content-reveal')];
  if(!nodes.length) return;
  const io=new IntersectionObserver(entries=>entries.forEach(entry=>{
    if(entry.isIntersecting){entry.target.classList.add('in');io.unobserve(entry.target);}
  }),{threshold:.12,rootMargin:'0px 0px -6%'});
  nodes.forEach(node=>io.observe(node));
}

async function installHomeTeaser(){
  const isHome=/\/(?:index\.html)?$/i.test(location.pathname);
  if(!isHome || document.querySelector('.content-home-teaser')) return;
  let posts=[];
  try{posts=await latestPosts();}catch(error){console.warn('[AZO Conteúdos] teaser indisponível.',error);return;}
  if(!posts.length) return;

  const section=document.createElement('section');
  section.className='content-home-teaser';
  section.innerHTML=`<div class="wrap">
    <div class="content-head content-reveal">
      <div><div class="content-eyebrow">Conteúdos</div><h2>Ideias para<br>decidir melhor.</h2></div>
      <p>Arquitetura, interiores, planejamento e obra explicados com a mesma clareza que orienta os projetos da AZO.</p>
    </div>
    <div class="content-grid">${posts.map(card).join('')}</div>
    <div style="margin-top:34px"><a class="button" href="/conteudos/">Ver todos os conteúdos <span class="arrow">→</span></a></div>
  </div>`;
  const target=document.querySelector('section.about-teaser')||document.querySelector('section.method')||document.querySelector('footer');
  target?.parentNode?.insertBefore(section,target);

  if(!document.querySelector('link[href*="conteudos.css"]')){
    const css=document.createElement('link');css.rel='stylesheet';css.href='assets/css/conteudos.css';document.head.appendChild(css);
  }
  reveal(section);
}

function install(){installNav();installHomeTeaser();}
if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',install,{once:true}); else install();

export {installNav,installHomeTeaser};
