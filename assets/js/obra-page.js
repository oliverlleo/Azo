(() => {
  const $ = (selector, root=document) => root.querySelector(selector);
  const $$ = (selector, root=document) => [...root.querySelectorAll(selector)];

  const header = $('.site-header');
  const toggle = $('.menu-toggle');
  const mobile = $('.mobile-nav');
  const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;

  function closeMenu(){
    mobile?.classList.remove('open');
    toggle?.classList.remove('open');
    toggle?.setAttribute('aria-expanded','false');
    document.body.classList.remove('no-scroll');
  }
  toggle?.addEventListener('click',()=>{
    const open = mobile?.classList.toggle('open');
    toggle.classList.toggle('open',Boolean(open));
    toggle.setAttribute('aria-expanded',open?'true':'false');
    document.body.classList.toggle('no-scroll',Boolean(open));
  });
  $$('.mobile-nav a').forEach(link=>link.addEventListener('click',closeMenu));

  const syncHeader=()=>header?.classList.toggle('scrolled',scrollY>18);
  syncHeader();
  addEventListener('scroll',syncHeader,{passive:true});

  const heroVideo = $('.obra-hero video');
  if(heroVideo){
    if(reduceMotion){heroVideo.pause();heroVideo.removeAttribute('autoplay');}
    else heroVideo.play().catch(()=>{});
  }

  function setupStorySwitcher(){
    const story=$('.obra-story');
    const nav=$('.obra-story__index',story);
    const body=$('.obra-story__body',story);
    if(!story||!nav||!body)return;

    if(!$('#obra-story-switcher-style')){
      const style=document.createElement('style');
      style.id='obra-story-switcher-style';
      style.textContent=`
        .obra-story__body{position:relative;min-height:390px;align-self:start}
        .obra-story__body>.obra-story-block[hidden]{display:none!important}
        .obra-story__index a{position:relative;overflow:hidden}
        .obra-story__index a.is-active{padding-left:10px;color:var(--rust)}
        .obra-story__index a.is-active::after{content:"";position:absolute;left:0;bottom:-1px;height:2px;width:100%;background:currentColor;transform-origin:left center;animation:obraStoryProgress 6.5s linear both}
        .obra-story.is-paused .obra-story__index a.is-active::after{animation-play-state:paused}
        .obra-story-gallery-preview{display:grid;gap:24px}
        .obra-story-gallery-preview h2{margin-bottom:0}
        .obra-story-gallery-preview__grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px}
        .obra-story-gallery-preview__grid img{width:100%;aspect-ratio:1.2;object-fit:cover;border-radius:18px;background:#ded9cf}
        .obra-story-gallery-preview__footer{display:flex;align-items:center;justify-content:space-between;gap:20px;padding-top:8px}
        .obra-story-gallery-preview__footer span{font-size:.72rem;letter-spacing:.08em;text-transform:uppercase;opacity:.58}
        .obra-story-gallery-preview__footer a{font-size:.7rem;letter-spacing:.08em;text-transform:uppercase;color:var(--rust)}
        @keyframes obraStoryProgress{from{transform:scaleX(0)}to{transform:scaleX(1)}}
        @media(max-width:720px){.obra-story__body{min-height:330px}.obra-story-gallery-preview__grid{grid-template-columns:1fr 1fr}.obra-story-gallery-preview__grid img{border-radius:12px}}
        @media(prefers-reduced-motion:reduce){.obra-story__index a.is-active::after{animation:none;transform:scaleX(1)}}
      `;
      document.head.appendChild(style);
    }

    const gallerySection=$('#galeria');
    let galleryPanel=null;
    const galleryLink=$('a[href="#galeria"]',nav);
    if(galleryLink&&gallerySection){
      const images=$$('.obra-gallery__item img',gallerySection).slice(0,4);
      if(images.length){
        galleryPanel=document.createElement('article');
        galleryPanel.className='obra-story-block obra-story-gallery-preview';
        galleryPanel.id='obra-story-galeria';

        const title=document.createElement('h2');
        title.innerHTML='A obra<br>em detalhes.';
        galleryPanel.appendChild(title);

        const previewGrid=document.createElement('div');
        previewGrid.className='obra-story-gallery-preview__grid';
        images.forEach(source=>{
          const image=document.createElement('img');
          image.src=source.currentSrc||source.src;
          image.alt=source.alt||'';
          image.loading='lazy';
          previewGrid.appendChild(image);
        });
        galleryPanel.appendChild(previewGrid);

        const footer=document.createElement('div');
        footer.className='obra-story-gallery-preview__footer';
        const count=document.createElement('span');
        count.textContent=`${$$('.obra-gallery__item',gallerySection).length} imagens`;
        const openGallery=document.createElement('a');
        openGallery.href='#galeria';
        openGallery.dataset.openFullGallery='';
        openGallery.textContent='Ver galeria completa ↓';
        footer.append(count,openGallery);
        galleryPanel.appendChild(footer);
        body.appendChild(galleryPanel);
      }
    }

    const entries=[];
    $$('a',nav).forEach(link=>{
      const hash=link.getAttribute('href')||'';
      let panel=null;
      if(hash==='#galeria')panel=galleryPanel;
      else if(hash.startsWith('#'))panel=$(hash,story);
      if(!panel){link.remove();return;}
      entries.push({link,panel,hash});
    });
    if(!entries.length)return;

    let activeIndex=Math.max(0,entries.findIndex(entry=>entry.hash===location.hash));
    let timer=null;
    let paused=false;
    const CYCLE_MS=6500;

    entries.forEach(({panel,link},index)=>{
      panel.hidden=index!==activeIndex;
      panel.classList.add('visible');
      link.classList.toggle('is-active',index===activeIndex);
      if(index===activeIndex)link.setAttribute('aria-current','true');
      else link.removeAttribute('aria-current');
    });

    function restartProgress(link){
      if(reduceMotion)return;
      link.classList.remove('is-active');
      void link.offsetWidth;
      link.classList.add('is-active');
    }

    function switchTo(nextIndex,{manual=false}={}){
      if(nextIndex<0||nextIndex>=entries.length||nextIndex===activeIndex){
        if(manual)schedule();
        return;
      }
      const previous=entries[activeIndex];
      const next=entries[nextIndex];

      previous.link.classList.remove('is-active');
      previous.link.removeAttribute('aria-current');
      next.link.classList.add('is-active');
      next.link.setAttribute('aria-current','true');

      if(reduceMotion){
        previous.panel.hidden=true;
        next.panel.hidden=false;
      }else{
        const out=previous.panel.animate([
          {opacity:1,transform:'translateY(0)'},
          {opacity:0,transform:'translateY(-16px)'}
        ],{duration:240,easing:'cubic-bezier(.2,.7,.2,1)',fill:'forwards'});
        out.finished.catch(()=>{}).then(()=>{
          previous.panel.hidden=true;
          previous.panel.getAnimations().forEach(animation=>animation.cancel());
        });
        next.panel.hidden=false;
        next.panel.animate([
          {opacity:0,transform:'translateY(24px)'},
          {opacity:1,transform:'translateY(0)'}
        ],{duration:560,easing:'cubic-bezier(.16,1,.3,1)',fill:'both'});
      }

      activeIndex=nextIndex;
      restartProgress(next.link);
      schedule();
    }

    function schedule(){
      clearTimeout(timer);
      if(reduceMotion||paused||entries.length<2||document.hidden)return;
      timer=setTimeout(()=>switchTo((activeIndex+1)%entries.length),CYCLE_MS);
    }

    entries.forEach(({link},index)=>{
      link.addEventListener('click',event=>{
        event.preventDefault();
        switchTo(index,{manual:true});
      });
    });

    $('[data-open-full-gallery]',galleryPanel)?.addEventListener('click',event=>{
      event.preventDefault();
      gallerySection.scrollIntoView({behavior:reduceMotion?'auto':'smooth',block:'start'});
    });

    const pause=()=>{paused=true;story.classList.add('is-paused');clearTimeout(timer);};
    const resume=()=>{paused=false;story.classList.remove('is-paused');schedule();};
    story.addEventListener('pointerenter',pause);
    story.addEventListener('pointerleave',resume);
    story.addEventListener('focusin',pause);
    story.addEventListener('focusout',event=>{if(!story.contains(event.relatedTarget))resume();});
    document.addEventListener('visibilitychange',()=>{if(document.hidden)clearTimeout(timer);else schedule();});

    restartProgress(entries[activeIndex].link);
    schedule();
  }

  setupStorySwitcher();

  const reveals = $$('.obra-reveal').filter(el=>!el.closest('.obra-story__body'));
  if('IntersectionObserver' in window && !reduceMotion){
    const observer=new IntersectionObserver(entries=>{
      for(const entry of entries){
        if(entry.isIntersecting){entry.target.classList.add('visible');observer.unobserve(entry.target);}
      }
    },{threshold:.12,rootMargin:'0px 0px -4%'});
    reveals.forEach(el=>observer.observe(el));
  }else reveals.forEach(el=>el.classList.add('visible'));

  const gallery=$$('.obra-gallery__item');
  const lightbox=$('.obra-lightbox');
  if(gallery.length&&lightbox){
    let index=0;
    const image=$('.obra-lightbox__stage img');
    const title=$('.obra-lightbox__title');
    const count=$('.obra-lightbox__count');
    const render=()=>{
      const source=gallery[index]?.querySelector('img');
      if(!source||!image)return;
      image.src=source.currentSrc||source.src;
      image.alt=source.alt;
      if(title)title.textContent=source.alt||document.querySelector('h1')?.textContent||'Obra AZO';
      if(count)count.textContent=`${String(index+1).padStart(2,'0')} / ${String(gallery.length).padStart(2,'0')}`;
    };
    const open=next=>{index=next;render();lightbox.classList.add('open');document.body.classList.add('no-scroll');};
    const close=()=>{lightbox.classList.remove('open');document.body.classList.remove('no-scroll');};
    gallery.forEach((item,i)=>{item.tabIndex=0;item.setAttribute('role','button');item.addEventListener('click',()=>open(i));item.addEventListener('keydown',event=>{if(event.key==='Enter'||event.key===' '){event.preventDefault();open(i);}});});
    $('.obra-lightbox__close')?.addEventListener('click',close);
    $('.obra-lightbox__prev')?.addEventListener('click',()=>{index=(index-1+gallery.length)%gallery.length;render();});
    $('.obra-lightbox__next')?.addEventListener('click',()=>{index=(index+1)%gallery.length;render();});
    lightbox.addEventListener('click',event=>{if(event.target===lightbox)close();});
    addEventListener('keydown',event=>{
      if(!lightbox.classList.contains('open'))return;
      if(event.key==='Escape')close();
      if(event.key==='ArrowLeft'){index=(index-1+gallery.length)%gallery.length;render();}
      if(event.key==='ArrowRight'){index=(index+1)%gallery.length;render();}
    });
  }

  if(!reduceMotion && 'IntersectionObserver' in window){
    const internalVideos=$$('video[data-observe-play]');
    const videoObserver=new IntersectionObserver(entries=>{
      for(const entry of entries){
        const video=entry.target;
        if(entry.isIntersecting)video.play().catch(()=>{});else video.pause();
      }
    },{threshold:.25});
    internalVideos.forEach(video=>videoObserver.observe(video));
  }
})();