(()=>{
'use strict';
const $=(s,c=document)=>c.querySelector(s), $$=(s,c=document)=>[...c.querySelectorAll(s)];
const reduced=false;

// Force the intended AZO motion even when the operating system asks the browser
// to reduce animations. The site remains fully usable without relying on scroll.
const motionStyle=document.createElement('style');
motionStyle.id='azo-motion-force';
motionStyle.textContent=`@media (prefers-reduced-motion: reduce){
.ambient{display:block!important}
.loader{transition-duration:.65s!important}.loader__bar{animation-duration:1.25s!important;animation-iteration-count:1!important}
.hero-slide{transition-duration:.15s!important}.hero-slide.active{transition-duration:1.15s,7s,.25s!important}.hero-slide.leaving{transition-duration:1.05s!important}
.hero__blueprint path,.hero__blueprint line,.hero__blueprint rect{animation-duration:18s!important;animation-iteration-count:infinite!important}
.hero.scene-ready h1 .word{animation-duration:.9s!important;animation-iteration-count:1!important}
.hero-dot.active span{animation-duration:5.6s!important;animation-iteration-count:1!important}
.hero__orb{animation-duration:6s!important;animation-iteration-count:infinite!important}.hero__orb::after{animation-duration:2.8s!important;animation-iteration-count:infinite!important}
.ticker-track{animation-duration:22s!important;animation-iteration-count:infinite!important}
.service-tab,.service-tab::before{transition-duration:.6s!important}.service-scene{transition-duration:.1s,1s!important}.service-scene.active{transition-duration:.1s,1.1s!important}.service-scene img{transition-duration:6s!important}.service-progress.run{animation-duration:6.2s!important;animation-iteration-count:1!important}
.project-shot{transition-duration:.1s,.9s!important}.project-shot.active{transition-duration:.1s,.9s!important}.project-shot img{transition-duration:7s!important}
.integration-visual .plan-line{animation-duration:5.5s!important;animation-iteration-count:infinite!important}.scan-line{animation-duration:4.8s!important;animation-iteration-count:infinite!important}.integration-node{animation-duration:4.5s!important;animation-iteration-count:infinite!important}
.method-card__glyph{animation-duration:10s!important;animation-iteration-count:infinite!important}.cta::before{animation-duration:16s!important;animation-iteration-count:infinite!important}
.inner-hero__media img{animation-duration:12s!important;animation-iteration-count:infinite!important}.contact-panel::before{animation-duration:15s!important;animation-iteration-count:infinite!important}
.page-transition{transition-duration:.65s!important}.mobile-nav{transition-duration:.65s!important}
}`;
document.head.appendChild(motionStyle);
document.documentElement.dataset.azoMotion='on';
console.info('[AZO] motion engine loaded');

// Loader (real sequence, bounded duration)
const loader=$('.loader');
if(loader){document.body.classList.add('is-loading');let n=0;const c=$('.loader__count');const timer=setInterval(()=>{n=Math.min(100,n+Math.floor(Math.random()*13)+5);if(c)c.textContent=String(n).padStart(3,'0')+'%';if(n>=100)clearInterval(timer)},90);setTimeout(()=>{loader.classList.add('done');document.body.classList.remove('is-loading');$('.hero')?.classList.add('scene-ready')},reduced?100:1450)}else{$('.hero')?.classList.add('scene-ready')}

// Header
addEventListener('scroll',()=>$('.site-header')?.classList.toggle('scrolled',scrollY>24),{passive:true});

// mobile menu
const mt=$('.menu-toggle'), mn=$('.mobile-nav');
mt?.addEventListener('click',()=>{const open=mn.classList.toggle('open');mt.classList.toggle('open',open);mt.setAttribute('aria-expanded',String(open));document.body.classList.toggle('no-scroll',open)});
$$('.mobile-nav a').forEach(a=>a.addEventListener('click',()=>{mn?.classList.remove('open');mt?.classList.remove('open');document.body.classList.remove('no-scroll')}));

// animated architectural background canvas
const canvas=$('#ambient-canvas');
if(canvas && !reduced){
 try{
 const ctx=canvas.getContext('2d',{alpha:true}); if(!ctx) throw new Error('Canvas 2D unavailable'); let w=0,h=0,dpr=1,t=0,raf; const pts=[];
 function resize(){dpr=Math.min(devicePixelRatio||1,1.5);w=innerWidth;h=innerHeight;canvas.width=w*dpr;canvas.height=h*dpr;canvas.style.width=w+'px';canvas.style.height=h+'px';ctx.setTransform(dpr,0,0,dpr,0,0);pts.length=0;const count=w<700?12:24;for(let i=0;i<count;i++)pts.push({x:Math.random()*w,y:Math.random()*h,vx:(Math.random()-.5)*.12,vy:(Math.random()-.5)*.12,r:Math.random()*1.3+.5})}
 function draw(){t+=.004;ctx.clearRect(0,0,w,h);ctx.strokeStyle='rgba(13,47,53,.09)';ctx.lineWidth=.7;
  const step=w<700?110:150, ox=(t*36)%step, oy=(t*18)%step; for(let x=-step+ox;x<w+step;x+=step){ctx.beginPath();ctx.moveTo(x,0);ctx.lineTo(x+Math.sin(t+x*.002)*28,h);ctx.stroke()} for(let y=-step+oy;y<h+step;y+=step){ctx.beginPath();ctx.moveTo(0,y);ctx.lineTo(w,y+Math.cos(t+y*.003)*16);ctx.stroke()}
  for(const p of pts){p.x+=p.vx;p.y+=p.vy;if(p.x<0||p.x>w)p.vx*=-1;if(p.y<0||p.y>h)p.vy*=-1;ctx.fillStyle='rgba(166,92,58,.16)';ctx.beginPath();ctx.arc(p.x,p.y,p.r,0,Math.PI*2);ctx.fill()}
  raf=requestAnimationFrame(draw)}
 resize();draw();addEventListener('resize',resize);document.addEventListener('visibilitychange',()=>{if(document.hidden)cancelAnimationFrame(raf);else draw()});
 }catch(err){console.warn('[AZO] ambient canvas unavailable, continuing other motion',err)}
}

// Hero autonomous scene animation
const heroSlides=$$('.hero-slide'), heroDots=$$('.hero-dot'); let heroIdx=0, heroTimer;
function setHero(i,user=false){if(!heroSlides.length)return;const old=heroIdx;heroIdx=(i+heroSlides.length)%heroSlides.length;if(old!==heroIdx){heroSlides[old]?.classList.remove('active');heroSlides[old]?.classList.add('leaving');setTimeout(()=>heroSlides[old]?.classList.remove('leaving'),1150)}heroSlides[heroIdx]?.classList.add('active');heroDots.forEach((d,k)=>d.classList.toggle('active',k===heroIdx));if(user)restartHero()}
function restartHero(){clearInterval(heroTimer);if(!reduced)heroTimer=setInterval(()=>setHero(heroIdx+1),5600)}
heroDots.forEach((d,i)=>d.addEventListener('click',()=>setHero(i,true)));setHero(0);restartHero();

// Service stage autonomous + interactive
const tabs=$$('.service-tab'), scenes=$$('.service-scene'); let sIdx=0,sTimer; const sProg=$('.service-progress');
function setService(i,user=false){if(!tabs.length)return;sIdx=(i+tabs.length)%tabs.length;tabs.forEach((t,k)=>t.classList.toggle('active',k===sIdx));scenes.forEach((s,k)=>s.classList.toggle('active',k===sIdx));if(sProg){sProg.classList.remove('run');void sProg.offsetWidth;sProg.classList.add('run')}if(user)restartService()}
function restartService(){clearInterval(sTimer);if(!reduced)sTimer=setInterval(()=>setService(sIdx+1),6200)}tabs.forEach((t,i)=>{t.addEventListener('click',()=>setService(i,true));t.addEventListener('mouseenter',()=>{if(innerWidth>900)setService(i,true)})});setService(0);restartService();

// Project showcase autonomous + manual
const shots=$$('.project-shot'), thumbs=$$('.project-thumb'); let pIdx=0,pTimer; const pName=$('.project-info__name'),pMeta=$('.project-info__meta'),pCount=$('.project-counter');
const projectData=[['Casa AS','Arquitetura residencial'],['Casa HL','Arquitetura residencial'],['Casa JT','Projeto residencial'],['Casa MN','Arquitetura + construção'],['Casa SE','Projeto residencial'],['Casa EF','Interiores + área de lazer']];
function setProject(i,user=false){if(!shots.length)return;pIdx=(i+shots.length)%shots.length;shots.forEach((s,k)=>s.classList.toggle('active',k===pIdx));thumbs.forEach((s,k)=>s.classList.toggle('active',k===pIdx));if(pName){pName.animate([{opacity:0,transform:'translateY(22px)'},{opacity:1,transform:'none'}],{duration:520,easing:'cubic-bezier(.22,1,.36,1)'});pName.textContent=projectData[pIdx]?.[0]||''}if(pMeta)pMeta.textContent=projectData[pIdx]?.[1]||'';if(pCount)pCount.textContent=String(pIdx+1).padStart(2,'0')+' / '+String(shots.length).padStart(2,'0');const openBtn=$('.project-open');if(openBtn)openBtn.dataset.gallery=['AS','HL','JT','MN','SE','EF'][pIdx]||'AS';if(user)restartProject()}
function restartProject(){clearInterval(pTimer);if(!reduced)pTimer=setInterval(()=>setProject(pIdx+1),6800)}
$('.project-prev')?.addEventListener('click',()=>setProject(pIdx-1,true));$('.project-next')?.addEventListener('click',()=>setProject(pIdx+1,true));thumbs.forEach((t,i)=>t.addEventListener('click',()=>setProject(i,true)));setProject(0);restartProject();

// Magnetic buttons desktop
if(!reduced && matchMedia('(pointer:fine)').matches){$$('[data-magnetic]').forEach(el=>{el.addEventListener('mousemove',e=>{const r=el.getBoundingClientRect();const x=(e.clientX-r.left-r.width/2)*.16,y=(e.clientY-r.top-r.height/2)*.16;el.style.transform=`translate(${x}px,${y}px)`});el.addEventListener('mouseleave',()=>el.style.transform='')})}

// Local page transition
$$('a[href]').forEach(a=>{const href=a.getAttribute('href');if(!href||href.startsWith('#')||href.startsWith('http')||href.startsWith('mailto:')||href.startsWith('tel:')||a.target==='_blank')return;a.addEventListener('click',e=>{if(e.metaKey||e.ctrlKey||e.shiftKey||e.altKey)return;e.preventDefault();const pt=$('.page-transition');if(pt){pt.classList.add('in');setTimeout(()=>location.href=href,reduced?20:520)}else location.href=href})});

// Lightbox project galleries
const galleries={
 'AS':['as-1.webp','as-2.webp','as-3.webp','as-4.webp','as-5.webp','as-6.webp'],
 'HL':['hl-1.webp','hl-2.webp','hl-3.webp','hl-4.webp','hl-5.webp','hl-6.webp'],
 'JT':['jt-1.webp','jt-2.webp','jt-3.webp','jt-4.webp','jt-5.webp','jt-6.webp'],
 'MN':['mn-1.webp','mn-2.webp','mn-3.webp','mn-4.webp','mn-5.webp','mn-6.webp'],
 'SE':['se-1.webp','se-2.webp','se-3.webp','se-4.webp','se-5.webp','se-6.webp'],
 'EF':['ef-1.webp','ef-2.webp','ef-3.webp','ef-4.webp','ef-5.webp','ef-6.webp']
};
const lb=$('.lightbox');let lbKey='AS',lbIdx=0;function renderLb(){if(!lb)return;const arr=galleries[lbKey]||[];const img=$('.lightbox__stage img',lb);if(img){img.src=`assets/images/projects/${arr[lbIdx]}`;img.alt=`Projeto Casa ${lbKey} — imagem ${lbIdx+1}`}const ttl=$('.lightbox__title',lb);if(ttl)ttl.textContent=`Casa ${lbKey} · ${lbIdx+1}/${arr.length}`}
function openLb(k){lbKey=k;lbIdx=0;renderLb();lb?.classList.add('open');document.body.classList.add('no-scroll')}
function closeLb(){lb?.classList.remove('open');document.body.classList.remove('no-scroll')}
$$('[data-gallery]').forEach(el=>el.addEventListener('click',()=>openLb(el.dataset.gallery)));$('.lightbox__close')?.addEventListener('click',closeLb);$('.lb-prev')?.addEventListener('click',()=>{const a=galleries[lbKey];lbIdx=(lbIdx-1+a.length)%a.length;renderLb()});$('.lb-next')?.addEventListener('click',()=>{const a=galleries[lbKey];lbIdx=(lbIdx+1)%a.length;renderLb()});addEventListener('keydown',e=>{if(!lb?.classList.contains('open'))return;if(e.key==='Escape')closeLb();if(e.key==='ArrowRight')$('.lb-next')?.click();if(e.key==='ArrowLeft')$('.lb-prev')?.click()});

// Two-step contact -> WhatsApp
const form=$('#lead-form');let formStep=0;function showStep(n){formStep=n;$$('.form-step',form).forEach((s,i)=>s.classList.toggle('active',i===n));$$('.form-progress span',form).forEach((s,i)=>s.classList.toggle('active',i<=n))}
if(form){showStep(0);$('.form-next',form)?.addEventListener('click',()=>{const req=$$('.form-step.active [required]',form);if(req.some(x=>!x.value.trim())){req.find(x=>!x.value.trim())?.focus();return}showStep(1)});$('.form-back',form)?.addEventListener('click',()=>showStep(0));form.addEventListener('submit',e=>{e.preventDefault();const fd=new FormData(form), lines=['Olá, equipe AZO! Gostaria de conversar sobre um projeto.',''];for(const [k,v] of fd.entries())if(v)lines.push(`${k}: ${v}`);const url='https://wa.me/5515997180355?text='+encodeURIComponent(lines.join('\n'));window.open(url,'_blank','noopener')})}
})();