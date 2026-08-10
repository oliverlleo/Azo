(()=>{
'use strict';
const $=(s,c=document)=>c.querySelector(s),$$=(s,c=document)=>[...c.querySelectorAll(s)];

// Header / mobile navigation for the server-rendered editorial pages.
addEventListener('scroll',()=>$('.site-header')?.classList.toggle('scrolled',scrollY>24),{passive:true});
const toggle=$('.menu-toggle'),mobile=$('.mobile-nav');
toggle?.addEventListener('click',()=>{
  const open=mobile?.classList.toggle('open');
  toggle.classList.toggle('open',Boolean(open));
  toggle.setAttribute('aria-expanded',String(Boolean(open)));
  document.body.classList.toggle('no-scroll',Boolean(open));
});
$$('.mobile-nav a').forEach(a=>a.addEventListener('click',()=>{
  mobile?.classList.remove('open');toggle?.classList.remove('open');document.body.classList.remove('no-scroll');
}));

// High-quality editorial reveal: staggered, intersection-driven and one-shot.
const revealNodes=$$('.content-reveal');
if('IntersectionObserver' in window){
  const io=new IntersectionObserver(entries=>entries.forEach(entry=>{
    if(entry.isIntersecting){entry.target.classList.add('in');io.unobserve(entry.target);}
  }),{threshold:.12,rootMargin:'0px 0px -8%'});
  revealNodes.forEach(node=>io.observe(node));
}else revealNodes.forEach(node=>node.classList.add('in'));

// Refined pointer depth. Kept intentionally subtle: no card jumping or exaggerated 3D.
if(matchMedia('(pointer:fine)').matches){
  $$('.content-card').forEach(card=>{
    let raf=0;
    card.addEventListener('mousemove',event=>{
      cancelAnimationFrame(raf);
      raf=requestAnimationFrame(()=>{
        const r=card.getBoundingClientRect();
        const rx=((event.clientY-r.top)/r.height-.5)*-1.8;
        const ry=((event.clientX-r.left)/r.width-.5)*2.2;
        card.style.transform=`translateY(-8px) perspective(1100px) rotateX(${rx}deg) rotateY(${ry}deg)`;
      });
    });
    card.addEventListener('mouseleave',()=>{cancelAnimationFrame(raf);card.style.transform='';});
  });
}

// Category filter on the listing page. URLs remain crawlable; JS only enhances the experience.
$$('[data-content-filter]').forEach(button=>button.addEventListener('click',()=>{
  const slug=button.dataset.contentFilter;
  if(slug==='all') location.href='/conteudos/';
  else location.href=`/conteudos/categoria/${encodeURIComponent(slug)}/`;
}));

// Article TOC: generated server-side from H2s, enhanced with active section tracking.
const tocLinks=$$('.article-toc a[href^="#"]');
if(tocLinks.length && 'IntersectionObserver' in window){
  const sections=tocLinks.map(link=>document.querySelector(link.getAttribute('href'))).filter(Boolean);
  const map=new Map(tocLinks.map(link=>[link.getAttribute('href').slice(1),link]));
  const observer=new IntersectionObserver(entries=>{
    const visible=entries.filter(e=>e.isIntersecting).sort((a,b)=>a.boundingClientRect.top-b.boundingClientRect.top)[0];
    if(!visible)return;
    tocLinks.forEach(link=>link.classList.toggle('active',link===map.get(visible.target.id)));
  },{rootMargin:'-22% 0px -64%',threshold:[0,.2,1]});
  sections.forEach(section=>observer.observe(section));
}

tocLinks.forEach(link=>link.addEventListener('click',event=>{
  const target=document.querySelector(link.getAttribute('href'));
  if(!target)return;
  event.preventDefault();
  history.pushState(null,'',link.getAttribute('href'));
  target.scrollIntoView({behavior:'smooth',block:'start'});
}));

// Copy/share helper when the renderer includes a share button.
$('[data-copy-article]')?.addEventListener('click',async event=>{
  try{
    await navigator.clipboard.writeText(location.href);
    const original=event.currentTarget.textContent;
    event.currentTarget.textContent='Link copiado ✓';
    setTimeout(()=>event.currentTarget.textContent=original,1800);
  }catch(_){ }
});
})();
