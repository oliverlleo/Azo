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

  const reveals = $$('.obra-reveal');
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
