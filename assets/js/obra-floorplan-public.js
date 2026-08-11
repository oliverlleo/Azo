(() => {
  const SUPABASE_URL='https://jjrsbbgnqfiezhokxbqz.supabase.co';
  const SUPABASE_KEY='sb_publishable_8LlV4bOH3d_axQBQLlHVkA_arQl6nu-';
  const SCRIPT_URL=document.currentScript?.src || new URL('/assets/js/obra-floorplan-public.js',location.origin).href;
  const reduceMotion=matchMedia('(prefers-reduced-motion: reduce)').matches;
  const esc=(value='')=>String(value??'').replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));

  function currentSlug(){
    const params=new URLSearchParams(location.search);
    const query=(params.get('obra')||params.get('q')||'').trim().toLowerCase();
    if(query)return query;
    const match=location.pathname.match(/\/obras\/([^/]+)\/?$/i);
    return match?.[1] ? decodeURIComponent(match[1]).toLowerCase() : '';
  }

  function ensureStyle(){
    if(document.querySelector('link[data-obra-floorplan-public]'))return;
    const link=document.createElement('link');
    link.rel='stylesheet';
    link.href=new URL('../css/obra-floorplan.css?v=20260810-2112',SCRIPT_URL).href;
    link.dataset.obraFloorplanPublic='1';
    document.head.appendChild(link);
  }

  function normalize(raw){
    if(!raw||raw.enabled!==true||!raw.imageUrl)return null;
    const hotspots=Array.isArray(raw.hotspots)?raw.hotspots.filter(item=>item&&Array.isArray(item.images)&&item.images.some(image=>image?.url)).map(item=>({
      id:String(item.id||''),
      label:String(item.label||'Ambiente'),
      x:Math.max(0,Math.min(100,Number(item.x)||0)),
      y:Math.max(0,Math.min(100,Number(item.y)||0)),
      w:Math.max(2,Math.min(100,Number(item.w)||10)),
      h:Math.max(2,Math.min(100,Number(item.h)||10)),
      images:item.images.filter(image=>image?.url).map(image=>({url:String(image.url),alt:String(image.alt||item.label||'Imagem da obra'),caption:String(image.caption||'')}))
    })):[];
    if(!hotspots.length)return null;
    return {imageUrl:String(raw.imageUrl),alt:String(raw.alt||'Planta da obra'),hotspots};
  }

  async function load(slug){
    const controller=new AbortController();
    const timer=setTimeout(()=>controller.abort(),8000);
    try{
      const response=await fetch(`${SUPABASE_URL}/rest/v1/obras?slug=eq.${encodeURIComponent(slug)}&published=eq.true&archived=eq.false&select=title,interactive_plan&limit=1`,{headers:{apikey:SUPABASE_KEY,Accept:'application/json'},signal:controller.signal});
      if(!response.ok)throw new Error(`Supabase ${response.status}`);
      const rows=await response.json();
      return rows?.[0]||null;
    }finally{clearTimeout(timer);}
  }

  function createSection(plan){
    const section=document.createElement('section');
    section.className='obra-floorplan obra-reveal';
    section.id='planta-interativa';
    section.innerHTML=`<div class="wrap">
      <div class="obra-floorplan__head"><div><div class="eyebrow">Explore a obra</div><h2>A planta,<br>por dentro.</h2></div><p>Selecione uma área da planta para visualizar os ambientes e decisões daquele espaço.</p></div>
      <div class="obra-floorplan__layout">
        <div class="obra-floorplan__map">
          <img src="${esc(plan.imageUrl)}" alt="${esc(plan.alt)}" loading="lazy" decoding="async">
          ${plan.hotspots.map((hotspot,index)=>`<button type="button" class="obra-floorplan__hotspot" data-floorplan-hotspot="${index}" aria-label="Abrir ${esc(hotspot.label)}" aria-pressed="false" style="left:${hotspot.x}%;top:${hotspot.y}%;width:${hotspot.w}%;height:${hotspot.h}%"><span>${String(index+1).padStart(2,'0')}</span></button>`).join('')}
          <div class="obra-floorplan__hint">Toque em uma área da planta</div>
        </div>
        <div class="obra-floorplan__viewer" aria-live="polite">
          <div class="obra-floorplan__viewer-stage"><div class="obra-floorplan__empty"><span>Planta interativa</span><strong>Escolha um ambiente.</strong></div></div>
          <div class="obra-floorplan__controls" hidden><span data-floorplan-count></span><div class="obra-floorplan__thumbs" data-floorplan-thumbs></div><div><button type="button" data-floorplan-prev aria-label="Imagem anterior">←</button><button type="button" data-floorplan-next aria-label="Próxima imagem">→</button></div></div>
        </div>
      </div>
    </div>`;

    let activeHotspot=-1;
    let activeImage=0;
    const stage=section.querySelector('.obra-floorplan__viewer-stage');
    const controls=section.querySelector('.obra-floorplan__controls');
    const count=section.querySelector('[data-floorplan-count]');
    const thumbs=section.querySelector('[data-floorplan-thumbs]');
    const prev=section.querySelector('[data-floorplan-prev]');
    const nextButton=section.querySelector('[data-floorplan-next]');
    const hint=section.querySelector('.obra-floorplan__hint');
    const buttons=[...section.querySelectorAll('[data-floorplan-hotspot]')];

    function renderImage(){
      const hotspot=plan.hotspots[activeHotspot];
      if(!hotspot)return;
      activeImage=(activeImage+hotspot.images.length)%hotspot.images.length;
      const image=hotspot.images[activeImage];
      const previous=stage.firstElementChild;
      const next=document.createElement('div');
      next.style.cssText='position:absolute;inset:0';
      next.innerHTML=`<img src="${esc(image.url)}" alt="${esc(image.alt)}"><div class="obra-floorplan__viewer-copy"><span>Ambiente ${String(activeHotspot+1).padStart(2,'0')}</span><h3>${esc(hotspot.label)}</h3>${image.caption?`<p>${esc(image.caption)}</p>`:''}</div>`;
      stage.appendChild(next);
      if(previous){
        if(reduceMotion)previous.remove();
        else{
          next.animate([{opacity:0,transform:'scale(1.025)'},{opacity:1,transform:'scale(1)'}],{duration:520,easing:'cubic-bezier(.16,1,.3,1)',fill:'both'});
          previous.animate([{opacity:1},{opacity:0}],{duration:220,fill:'forwards'}).finished.catch(()=>{}).then(()=>previous.remove());
        }
      }
      const multiple=hotspot.images.length>1;
      count.textContent=multiple?`${String(activeImage+1).padStart(2,'0')} / ${String(hotspot.images.length).padStart(2,'0')}`:'';
      thumbs.innerHTML=multiple?hotspot.images.map((item,index)=>`<button type="button" class="obra-floorplan__thumb ${index===activeImage?'is-active':''}" data-floorplan-thumb="${index}" aria-label="Abrir imagem ${index+1}"><img src="${esc(item.url)}" alt="" loading="lazy"></button>`).join(''):'';
      thumbs.querySelectorAll('[data-floorplan-thumb]').forEach(button=>button.addEventListener('click',()=>{activeImage=Number(button.dataset.floorplanThumb);renderImage();}));
      prev.hidden=!multiple;
      nextButton.hidden=!multiple;
      controls.hidden=false;
    }

    function selectHotspot(index){
      activeHotspot=index;activeImage=0;
      buttons.forEach((button,i)=>{
        const active=i===index;
        button.classList.toggle('is-active',active);
        button.setAttribute('aria-pressed',active?'true':'false');
      });
      hint?.remove();
      renderImage();
    }

    buttons.forEach((button,index)=>button.addEventListener('click',()=>selectHotspot(index)));
    prev.addEventListener('click',()=>{if(activeHotspot<0)return;activeImage-=1;renderImage();});
    nextButton.addEventListener('click',()=>{if(activeHotspot<0)return;activeImage+=1;renderImage();});
    section.addEventListener('keydown',event=>{
      if(activeHotspot<0||plan.hotspots[activeHotspot].images.length<2)return;
      if(event.key==='ArrowLeft'){event.preventDefault();activeImage-=1;renderImage();}
      if(event.key==='ArrowRight'){event.preventDefault();activeImage+=1;renderImage();}
    });
    return section;
  }

  async function start(){
    const slug=currentSlug();
    if(!slug)return;
    try{
      const row=await load(slug);
      const plan=normalize(row?.interactive_plan);
      if(!plan||document.querySelector('.obra-floorplan'))return;
      ensureStyle();
      const section=createSection(plan);
      const story=document.querySelector('.obra-story');
      const gallery=document.querySelector('.obra-gallery');
      const previous=story||gallery;
      if(previous)previous.parentNode.insertBefore(section,previous.nextSibling);
      else{
        const next=document.querySelector('.obra-services,.obra-cta,.footer');
        if(next)next.parentNode.insertBefore(section,next);
        else document.querySelector('main')?.appendChild(section);
      }
      requestAnimationFrame(()=>section.classList.add('visible'));
    }catch(error){console.warn('[AZO Planta] Conteúdo interativo indisponível.',error);}
  }

  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});else start();
})();
