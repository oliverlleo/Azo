(()=>{
'use strict';
const $=(s,c=document)=>c.querySelector(s), $$=(s,c=document)=>[...c.querySelectorAll(s)];
const reduced=false;

// Keep the site's original motion available even when the OS requests reduced motion.
for(const sheet of [...document.styleSheets]){
 try{
  for(let i=sheet.cssRules.length-1;i>=0;i--){
   const rule=sheet.cssRules[i];
   if(rule instanceof CSSMediaRule && rule.conditionText.includes('prefers-reduced-motion')) sheet.deleteRule(i);
  }
 }catch(_){ }
}
const heroMotionStyle=document.createElement('style');
heroMotionStyle.textContent=`
.hero__slides{z-index:0!important;isolation:isolate}
.hero__veil{z-index:1!important}
.hero__blueprint,.hero__orb{z-index:2!important}
.hero__blueprint{opacity:.18!important}
.hero__blueprint path,.hero__blueprint line,.hero__blueprint rect{animation:blueprintShift 18s linear infinite!important}
.hero__orb{animation:orbFloat 6s ease-in-out infinite!important}
.hero__orb::after{animation:orbPulse 2.8s ease-in-out infinite!important}
.hero-slide{opacity:0!important;clip-path:none!important;transform:none!important;transition:opacity 1.45s ease-in-out!important;will-change:opacity;z-index:0;backface-visibility:hidden}
.hero-slide.active{opacity:1!important;clip-path:none!important;transform:none!important;z-index:1}
.hero-slide.entering{opacity:1!important;z-index:2!important}
.hero-slide.leaving{opacity:0!important;clip-path:none!important}
.hero-slide img{transform:scale(1.025);transition:none!important;backface-visibility:hidden}
.hero-slide.active img{transform:scale(1);transition:transform 8s ease-out!important;will-change:transform}
.hero h1 .line{overflow:visible!important;min-height:.86em}
.hero h1 .word{transform:none!important;opacity:1!important;animation:none!important}
.hero h1 .typing-target::after{content:'|';display:inline-block;margin-left:.035em;font-family:Arial,Helvetica,sans-serif;font-weight:200;font-size:.78em;line-height:1;animation:typeCursor .72s steps(1,end) infinite!important;vertical-align:.06em}
@keyframes typeCursor{50%{opacity:0}}
`;
document.head.appendChild(heroMotionStyle);

// Type the hero title letter by letter, line by line.
let heroTypingStarted=false;
let heroTypingWaiting=false;
function startHeroTyping(){
 if(heroTypingStarted)return;
 const cmsState=document.documentElement.dataset.cmsReady;
 if(!cmsState){
  if(!heroTypingWaiting){
   heroTypingWaiting=true;
   addEventListener('azo:cms-ready',()=>{heroTypingWaiting=false;startHeroTyping()},{once:true});
   setTimeout(()=>{
    if(!heroTypingStarted && !document.documentElement.dataset.cmsReady){
     document.documentElement.dataset.cmsReady='timeout';
     heroTypingWaiting=false;
     startHeroTyping();
    }
   },2600);
  }
  return;
 }
 heroTypingStarted=true;
 const words=$$('.hero h1 .word'); if(!words.length)return;
 const targets=words.map(w=>w.querySelector('em')||w);
 const originals=targets.map(t=>t.textContent);
 targets.forEach(t=>t.textContent='');
 let line=0;
 const typeLine=()=>{
  if(line>=targets.length)return;
  const target=targets[line], text=originals[line]; let i=0;
  target.classList.add('typing-target');
  const tick=()=>{
   target.textContent=text.slice(0,i++);
   if(i<=text.length){setTimeout(tick,46+Math.random()*28)}
   else{target.classList.remove('typing-target');line++;if(line<targets.length)setTimeout(typeLine,230)}
  };
  tick();
 };
 typeLine();
}

// Loader 0-100 appears only on a direct homepage entry. Anchor navigation such as
// index.html#metodo is navigation inside the site and must open immediately.
const loader=$('.loader');
const isHomePage=/\/(?:index\.html)?$/i.test(location.pathname);
const enteredHomeViaAnchor=isHomePage && Boolean(location.hash);
if(loader && isHomePage && !enteredHomeViaAnchor){
 document.body.classList.add('is-loading');
 let n=0;
 const c=$('.loader__count');
 const timer=setInterval(()=>{
  n=Math.min(100,n+Math.floor(Math.random()*13)+5);
  if(c)c.textContent=String(n).padStart(3,'0')+'%';
  if(n>=100)clearInterval(timer);
 },90);
 setTimeout(()=>{
  loader.classList.add('done');
  document.body.classList.remove('is-loading');
  $('.hero')?.classList.add('scene-ready');
  startHeroTyping();
 },1450);
}else{
 if(loader)loader.style.display='none';
 document.body.classList.remove('is-loading');
 $('.hero')?.classList.add('scene-ready');
 startHeroTyping();
}

// Header
addEventListener('scroll',()=>$('.site-header')?.classList.toggle('scrolled',scrollY>24),{passive:true});

// mobile menu
const mt=$('.menu-toggle'), mn=$('.mobile-nav');
mt?.addEventListener('click',()=>{const open=mn.classList.toggle('open');mt.classList.toggle('open',open);mt.setAttribute('aria-expanded',String(open));document.body.classList.toggle('no-scroll',open)});
$$('.mobile-nav a').forEach(a=>a.addEventListener('click',()=>{mn?.classList.remove('open');mt?.classList.remove('open');document.body.classList.remove('no-scroll')}));

// animated architectural background canvas
const canvas=$('#ambient-canvas');
if(canvas && !reduced){
 const ctx=canvas.getContext('2d',{alpha:true}); let w=0,h=0,dpr=1,t=0,raf; const pts=[];
 function resize(){dpr=Math.min(devicePixelRatio||1,1.5);w=innerWidth;h=innerHeight;canvas.width=w*dpr;canvas.height=h*dpr;canvas.style.width=w+'px';canvas.style.height=h+'px';ctx.setTransform(dpr,0,0,dpr,0,0);pts.length=0;const count=w<700?12:24;for(let i=0;i<count;i++)pts.push({x:Math.random()*w,y:Math.random()*h,vx:(Math.random()-.5)*.12,vy:(Math.random()-.5)*.12,r:Math.random()*1.3+.5})}
 function draw(){t+=.004;ctx.clearRect(0,0,w,h);ctx.strokeStyle='rgba(13,47,53,.09)';ctx.lineWidth=.7;
  const step=w<700?110:150, ox=(t*36)%step, oy=(t*18)%step; for(let x=-step+ox;x<w+step;x+=step){ctx.beginPath();ctx.moveTo(x,0);ctx.lineTo(x+Math.sin(t+x*.002)*28,h);ctx.stroke()} for(let y=-step+oy;y<h+step;y+=step){ctx.beginPath();ctx.moveTo(0,y);ctx.lineTo(w,y+Math.cos(t+y*.003)*16);ctx.stroke()}
  for(const p of pts){p.x+=p.vx;p.y+=p.vy;if(p.x<0||p.x>w)p.vx*=-1;if(p.y<0||p.y>h)p.vy*=-1;ctx.fillStyle='rgba(166,92,58,.16)';ctx.beginPath();ctx.arc(p.x,p.y,p.r,0,Math.PI*2);ctx.fill()}
  raf=requestAnimationFrame(draw)}
 resize();draw();addEventListener('resize',resize);document.addEventListener('visibilitychange',()=>{if(document.hidden)cancelAnimationFrame(raf);else draw()});
}

// Hero autonomous scene animation. Fade belongs to the figure and the slow zoom
// belongs to the image. The incoming image is decoded before it is revealed and
// fades over the current fully-visible slide, preventing a compositing gap.
const heroSlides=$$('.hero-slide'), heroDots=$$('.hero-dot'); let heroIdx=0, heroTimer, heroTransitioning=false, heroPending=null;
function prepareHeroImage(slide){
 const img=slide?.querySelector('img');
 if(!img)return Promise.resolve(true);
 const decode=()=>typeof img.decode==='function'?img.decode().then(()=>true).catch(()=>true):Promise.resolve(true);
 if(img.complete&&img.naturalWidth)return decode();
 return new Promise(resolve=>{
  const done=()=>decode().then(resolve);
  img.addEventListener('load',done,{once:true});
  img.addEventListener('error',()=>resolve(false),{once:true});
 });
}
function warmHeroImages(){
 const work=()=>heroSlides.forEach((slide,i)=>{if(i!==heroIdx)prepareHeroImage(slide)});
 if('requestIdleCallback'in window)requestIdleCallback(work,{timeout:1800});else setTimeout(work,250);
}
async function setHero(i,user=false){
 if(!heroSlides.length)return;
 const nextIdx=(i+heroSlides.length)%heroSlides.length;
 if(user)restartHero();
 if(nextIdx===heroIdx){heroDots.forEach((d,k)=>d.classList.toggle('active',k===heroIdx));return}
 if(heroTransitioning){heroPending={i:nextIdx,user:false};return}
 heroTransitioning=true;
 const current=heroSlides[heroIdx], next=heroSlides[nextIdx];
 const ready=await prepareHeroImage(next);
 if(!ready){heroTransitioning=false;return}
 next.classList.remove('leaving');
 next.classList.add('entering','active');
 heroIdx=nextIdx;
 heroDots.forEach((d,k)=>d.classList.toggle('active',k===heroIdx));
 setTimeout(()=>{
  current?.classList.remove('active','entering','leaving');
  next.classList.remove('entering');
  heroTransitioning=false;
  if(heroPending){const pending=heroPending;heroPending=null;setHero(pending.i,pending.user)}
 },1500);
}
function restartHero(){clearInterval(heroTimer);if(!reduced)heroTimer=setInterval(()=>setHero(heroIdx+1),5600)}
heroDots.forEach((d,i)=>d.addEventListener('click',()=>setHero(i,true)));
heroSlides.forEach((slide,k)=>{slide.classList.toggle('active',k===heroIdx);slide.classList.remove('entering','leaving')});
heroDots.forEach((d,k)=>d.classList.toggle('active',k===heroIdx));
warmHeroImages();
addEventListener('azo:cms-ready',warmHeroImages,{once:true});
restartHero();

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

// Direct navigation: no blue page transition. Same-home anchors scroll without reload.
const normalizeNavPath=path=>path.replace(/\/index\.html$/i,'/')||'/';
$$('a[href]').forEach(a=>{
 const href=a.getAttribute('href');
 if(!href||href.startsWith('http')||href.startsWith('mailto:')||href.startsWith('tel:')||a.target==='_blank')return;
 a.addEventListener('click',e=>{
  if(e.metaKey||e.ctrlKey||e.shiftKey||e.altKey)return;
  let target;
  try{target=new URL(href,location.href)}catch(_){return}
  const samePage=target.origin===location.origin&&normalizeNavPath(target.pathname)===normalizeNavPath(location.pathname);
  if(samePage&&target.hash){
   const section=document.querySelector(target.hash);
   if(section){
    e.preventDefault();
    history.pushState(null,'',target.hash);
    section.scrollIntoView({behavior:'smooth',block:'start'});
   }
  }
 });
});

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

// CMS is loaded only as a data layer. There is intentionally no public link to /admin/.
import('./cms.js').catch(error=>{
 console.warn('[AZO CMS] runtime indisponível; site estático mantido.',error);
 document.documentElement.dataset.cmsReady='failed';
 dispatchEvent(new CustomEvent('azo:cms-ready',{detail:{ok:false}}));
});
})();