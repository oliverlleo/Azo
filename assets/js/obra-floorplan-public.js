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
    link.href=new URL('../css/obra-floorplan.css?v=20260810-2128',SCRIPT_URL).href;
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
      <div class="obra-floorplan__head"><div><div class="eyebrow">Explore a obra</div><h2>A planta,<br>por dentro.</h2></div><p>Os ambientes percorrem a obra automaticamente. Selecione uma área da planta para fixar aquele espaço e explorar suas imagens.</p></div>
      <div class="obra-floorplan__layout">
        <div class="obra-floorplan__map">
          <img src="${esc(plan.imageUrl)}" alt="${esc(plan.alt)}" loading="lazy" decoding="async">
          ${plan.hotspots.map((hotspot,index)=>`<button type="button" class="obra-floorplan__hotspot" data-floorplan-hotspot="${index}" aria-label="Selecionar ${esc(hotspot.label)}" aria-pressed="false" style="left:${hotspot.x}%;top:${hotspot.y}%;width:${hotspot.w}%;height:${hotspot.h}%"><span>${String(index+1).padStart(2,'0')}</span></button>`).join('')}
          <div class="obra-floorplan__hint">Selecione uma área para fixar</div>
        </div>
        <div class="obra-floorplan__viewer" aria-live="polite">
          <div class="obra-floorplan__viewer-stage" data-floorplan-stage role="button" tabindex="0" aria-label="Ampliar imagem do ambiente">
            <button type="button" class="obra-floorplan__expand" data-floorplan-expand aria-label="Ampliar imagem"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 3H3v5M16 3h5v5M8 21H3v-5M21 16v5h-5"/><path d="M3 8l6-6M21 8l-6-6M3 16l6 6M21 16l-6 6"/></svg></button>
            <div class="obra-floorplan__viewer-progress" data-floorplan-progress></div>
          </div>
          <div class="obra-floorplan__viewer-bottom">
            <div class="obra-floorplan__viewer-status"><div><span data-floorplan-mode>Tour automático</span><strong data-floorplan-label></strong></div><span data-floorplan-count></span></div>
            <div class="obra-floorplan__thumbs" data-floorplan-thumbs></div>
          </div>
        </div>
      </div>
    </div>
    <div class="obra-floorplan__modal" data-floorplan-modal aria-hidden="true" role="dialog" aria-modal="true" aria-label="Galeria ampliada da planta">
      <div class="obra-floorplan__modal-backdrop" data-floorplan-close></div>
      <div class="obra-floorplan__modal-shell">
        <div class="obra-floorplan__modal-top"><div><span data-floorplan-modal-eyebrow>Ambiente</span><strong data-floorplan-modal-title></strong></div><button type="button" class="obra-floorplan__modal-close" data-floorplan-close aria-label="Fechar imagem ampliada">×</button></div>
        <div class="obra-floorplan__modal-stage"><button type="button" class="obra-floorplan__modal-nav obra-floorplan__modal-nav--prev" data-floorplan-modal-prev aria-label="Imagem anterior">←</button><figure><img data-floorplan-modal-image alt=""><figcaption data-floorplan-modal-caption></figcaption></figure><button type="button" class="obra-floorplan__modal-nav obra-floorplan__modal-nav--next" data-floorplan-modal-next aria-label="Próxima imagem">→</button></div>
        <div class="obra-floorplan__modal-foot"><span data-floorplan-modal-count></span></div>
      </div>
    </div>`;

    const CYCLE_MS=5200;
    const slides=plan.hotspots.flatMap((hotspot,hotspotIndex)=>hotspot.images.map((image,imageIndex)=>({hotspotIndex,imageIndex,image})));
    let activeHotspot=0;
    let activeImage=0;
    let locked=false;
    let modalOpen=false;
    let timer=null;
    let lastFocused=null;

    const stage=section.querySelector('[data-floorplan-stage]');
    const progress=section.querySelector('[data-floorplan-progress]');
    const mode=section.querySelector('[data-floorplan-mode]');
    const label=section.querySelector('[data-floorplan-label]');
    const count=section.querySelector('[data-floorplan-count]');
    const thumbs=section.querySelector('[data-floorplan-thumbs]');
    const expand=section.querySelector('[data-floorplan-expand]');
    const hint=section.querySelector('.obra-floorplan__hint');
    const buttons=[...section.querySelectorAll('[data-floorplan-hotspot]')];
    const modal=section.querySelector('[data-floorplan-modal]');
    const modalImage=section.querySelector('[data-floorplan-modal-image]');
    const modalTitle=section.querySelector('[data-floorplan-modal-title]');
    const modalCaption=section.querySelector('[data-floorplan-modal-caption]');
    const modalCount=section.querySelector('[data-floorplan-modal-count]');
    const modalPrev=section.querySelector('[data-floorplan-modal-prev]');
    const modalNext=section.querySelector('[data-floorplan-modal-next]');

    function currentHotspot(){return plan.hotspots[activeHotspot];}

    function currentSlideIndex(){
      return slides.findIndex(item=>item.hotspotIndex===activeHotspot&&item.imageIndex===activeImage);
    }

    function setHotspotState(){
      buttons.forEach((button,index)=>{
        const active=index===activeHotspot;
        button.classList.toggle('is-active',active);
        button.classList.toggle('is-locked',active&&locked);
        button.setAttribute('aria-pressed',active?'true':'false');
      });
      mode.textContent=locked?'Ambiente selecionado':'Tour automático';
      section.classList.toggle('is-floorplan-locked',locked);
    }

    function restartProgress(){
      if(!progress)return;
      progress.style.animation='none';
      void progress.offsetWidth;
      if(!reduceMotion&&!locked&&!modalOpen&&!document.hidden)progress.style.animation=`obraFloorplanProgress ${CYCLE_MS}ms linear forwards`;
    }

    function renderThumbs(){
      const hotspot=currentHotspot();
      thumbs.innerHTML=hotspot.images.map((item,index)=>`<button type="button" class="obra-floorplan__thumb ${index===activeImage?'is-active':''}" data-floorplan-thumb="${index}" aria-label="Mostrar imagem ${index+1} de ${esc(hotspot.label)}"><img src="${esc(item.url)}" alt="" loading="lazy" decoding="async"><span>${String(index+1).padStart(2,'0')}</span></button>`).join('');
      thumbs.querySelectorAll('[data-floorplan-thumb]').forEach(button=>button.addEventListener('click',event=>{
        event.stopPropagation();
        activeImage=Number(button.dataset.floorplanThumb)||0;
        renderImage();
        schedule();
      }));
    }

    function renderImage(){
      const hotspot=currentHotspot();
      if(!hotspot)return;
      activeImage=(activeImage+hotspot.images.length)%hotspot.images.length;
      const image=hotspot.images[activeImage];
      const previous=stage.querySelector('.obra-floorplan__media');
      const next=document.createElement('div');
      next.className='obra-floorplan__media';
      next.innerHTML=`<img src="${esc(image.url)}" alt="${esc(image.alt)}"><div class="obra-floorplan__viewer-copy"><span>Ambiente ${String(activeHotspot+1).padStart(2,'0')}</span><h3>${esc(hotspot.label)}</h3>${image.caption?`<p>${esc(image.caption)}</p>`:''}</div>`;
      stage.insertBefore(next,expand);
      if(previous){
        if(reduceMotion)previous.remove();
        else{
          next.animate([{opacity:0,transform:'scale(1.025)'},{opacity:1,transform:'scale(1)'}],{duration:560,easing:'cubic-bezier(.16,1,.3,1)',fill:'both'});
          previous.animate([{opacity:1},{opacity:0}],{duration:260,fill:'forwards'}).finished.catch(()=>{}).then(()=>previous.remove());
        }
      }
      label.textContent=hotspot.label;
      count.textContent=`${String(activeImage+1).padStart(2,'0')} / ${String(hotspot.images.length).padStart(2,'0')}`;
      setHotspotState();
      renderThumbs();
      restartProgress();
      if(modalOpen)renderModal();
    }

    function schedule(){
      clearTimeout(timer);
      if(reduceMotion||locked||modalOpen||document.hidden||slides.length<2)return;
      timer=setTimeout(()=>{
        const current=currentSlideIndex();
        const next=slides[(current+1+slides.length)%slides.length];
        activeHotspot=next.hotspotIndex;
        activeImage=next.imageIndex;
        renderImage();
        schedule();
      },CYCLE_MS);
    }

    function selectHotspot(index){
      activeHotspot=index;
      activeImage=0;
      locked=true;
      hint?.remove();
      clearTimeout(timer);
      renderImage();
    }

    function renderModal(){
      const hotspot=currentHotspot();
      const image=hotspot?.images?.[activeImage];
      if(!image)return;
      modalImage.src=image.url;
      modalImage.alt=image.alt;
      modalTitle.textContent=hotspot.label;
      modalCaption.textContent=image.caption||'';
      modalCaption.hidden=!image.caption;
      modalCount.textContent=`${String(activeImage+1).padStart(2,'0')} / ${String(hotspot.images.length).padStart(2,'0')}`;
      const multiple=hotspot.images.length>1;
      modalPrev.hidden=!multiple;
      modalNext.hidden=!multiple;
    }

    function openModal(){
      if(!currentHotspot())return;
      lastFocused=document.activeElement;
      modalOpen=true;
      clearTimeout(timer);
      restartProgress();
      renderModal();
      modal.classList.add('is-open');
      modal.setAttribute('aria-hidden','false');
      document.body.classList.add('no-scroll');
      section.querySelector('.obra-floorplan__modal-close')?.focus();
    }

    function closeModal(){
      if(!modalOpen)return;
      modalOpen=false;
      modal.classList.remove('is-open');
      modal.setAttribute('aria-hidden','true');
      document.body.classList.remove('no-scroll');
      if(lastFocused instanceof HTMLElement)lastFocused.focus({preventScroll:true});
      restartProgress();
      schedule();
    }

    function modalMove(direction){
      const hotspot=currentHotspot();
      if(!hotspot?.images?.length)return;
      activeImage=(activeImage+direction+hotspot.images.length)%hotspot.images.length;
      renderImage();
      renderModal();
    }

    buttons.forEach((button,index)=>button.addEventListener('click',()=>selectHotspot(index)));
    stage.addEventListener('click',event=>{if(event.target.closest('[data-floorplan-expand]'))return;openModal();});
    stage.addEventListener('keydown',event=>{if(event.key==='Enter'||event.key===' '){event.preventDefault();openModal();}});
    expand.addEventListener('click',event=>{event.stopPropagation();openModal();});
    section.querySelectorAll('[data-floorplan-close]').forEach(button=>button.addEventListener('click',closeModal));
    modalPrev.addEventListener('click',()=>modalMove(-1));
    modalNext.addEventListener('click',()=>modalMove(1));
    document.addEventListener('visibilitychange',()=>{
      if(document.hidden){clearTimeout(timer);restartProgress();}
      else{restartProgress();schedule();}
    });
    addEventListener('keydown',event=>{
      if(!modalOpen)return;
      if(event.key==='Escape')closeModal();
      if(event.key==='ArrowLeft'){event.preventDefault();modalMove(-1);}
      if(event.key==='ArrowRight'){event.preventDefault();modalMove(1);}
    });

    renderImage();
    schedule();
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