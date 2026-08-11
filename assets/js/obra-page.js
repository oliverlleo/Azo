(() => {
  const $=(selector,root=document)=>root.querySelector(selector);
  const $$=(selector,root=document)=>[...root.querySelectorAll(selector)];

  if(!document.querySelector('script[data-obra-floorplan-runtime]')){
    const runtime=document.createElement('script');
    const source=document.currentScript?.src||new URL('assets/js/obra-page.js',location.origin+'/').href;
    runtime.src=new URL('./obra-floorplan-public.js?v=20260810-2218',source).href;
    runtime.defer=true;
    runtime.dataset.obraFloorplanRuntime='1';
    document.head.appendChild(runtime);
  }

  const header=$('.site-header');
  const toggle=$('.menu-toggle');
  const mobile=$('.mobile-nav');
  const reduceMotion=matchMedia('(prefers-reduced-motion: reduce)').matches;

  function closeMenu(){
    mobile?.classList.remove('open');
    toggle?.classList.remove('open');
    toggle?.setAttribute('aria-expanded','false');
    document.body.classList.remove('no-scroll');
  }

  toggle?.addEventListener('click',()=>{
    const open=mobile?.classList.toggle('open');
    toggle.classList.toggle('open',Boolean(open));
    toggle.setAttribute('aria-expanded',open?'true':'false');
    document.body.classList.toggle('no-scroll',Boolean(open));
  });
  $$('.mobile-nav a').forEach(link=>link.addEventListener('click',closeMenu));

  const syncHeader=()=>header?.classList.toggle('scrolled',scrollY>18);
  syncHeader();
  addEventListener('scroll',syncHeader,{passive:true});

  const heroVideo=$('.obra-hero video');
  if(heroVideo){
    heroVideo.muted=true;
    heroVideo.defaultMuted=true;
    heroVideo.loop=true;
    heroVideo.playsInline=true;
    heroVideo.autoplay=true;
    heroVideo.preload='auto';
    heroVideo.setAttribute('muted','');
    heroVideo.setAttribute('playsinline','');
    heroVideo.setAttribute('loop','');
    heroVideo.setAttribute('autoplay','');

    let retryTimer=null;
    const tryPlay=()=>{
      if(document.hidden)return;
      clearTimeout(retryTimer);
      const attempt=heroVideo.play();
      if(attempt?.catch){
        attempt.catch(()=>{
          retryTimer=setTimeout(()=>{
            if(!document.hidden)heroVideo.play().catch(()=>{});
          },450);
        });
      }
    };

    if(heroVideo.readyState===0)heroVideo.load();
    heroVideo.addEventListener('loadedmetadata',tryPlay,{once:true});
    heroVideo.addEventListener('loadeddata',tryPlay,{once:true});
    heroVideo.addEventListener('canplay',tryPlay);
    heroVideo.addEventListener('canplaythrough',tryPlay,{once:true});
    heroVideo.addEventListener('stalled',()=>setTimeout(tryPlay,300));
    heroVideo.addEventListener('suspend',()=>{if(heroVideo.paused)setTimeout(tryPlay,150);});
    heroVideo.addEventListener('error',()=>{
      console.error('[AZO Obras] O navegador não conseguiu decodificar o vídeo principal.',heroVideo.error);
    });
    addEventListener('pageshow',tryPlay);
    document.addEventListener('visibilitychange',()=>{if(!document.hidden)tryPlay();});
    tryPlay();
  }

  function setupStorySwitcher(){
    const story=$('.obra-story');
    if(!story)return;

    const tabs=$$('[data-story-target]',story);
    const panels=$$('[data-story-panel]',story);
    if(!tabs.length||!panels.length)return;

    const entries=tabs.map(tab=>({
      tab,
      panel:panels.find(panel=>panel.dataset.storyPanel===tab.dataset.storyTarget)
    })).filter(entry=>entry.panel);
    if(!entries.length)return;

    let activeIndex=Math.max(0,entries.findIndex(({tab})=>tab.getAttribute('aria-selected')==='true'));
    let timer=null;
    const CYCLE_MS=6800;

    function applyState(){
      entries.forEach(({tab,panel},index)=>{
        const active=index===activeIndex;
        tab.classList.toggle('is-active',active);
        tab.setAttribute('aria-selected',active?'true':'false');
        tab.tabIndex=active?0:-1;
        panel.hidden=!active;
        panel.classList.add('visible');
      });
    }

    function restartProgress(tab){
      tab.classList.add('is-active');
    }

    function schedule(){
      clearTimeout(timer);
      if(entries.length<2||document.hidden)return;
      timer=setTimeout(()=>switchTo((activeIndex+1)%entries.length),CYCLE_MS);
    }

    function switchTo(nextIndex,{manual=false}={}){
      if(nextIndex<0||nextIndex>=entries.length)return;

      if(nextIndex===activeIndex){
        entries[nextIndex].tab.classList.add('is-active');
        schedule();
        return;
      }

      const previous=entries[activeIndex];
      const next=entries[nextIndex];

      previous.tab.classList.remove('is-active');
      previous.tab.setAttribute('aria-selected','false');
      previous.tab.tabIndex=-1;
      next.tab.classList.add('is-active');
      next.tab.setAttribute('aria-selected','true');
      next.tab.tabIndex=0;

      if(reduceMotion){
        previous.panel.hidden=true;
        next.panel.hidden=false;
      }else{
        const out=previous.panel.animate([
          {opacity:1,transform:'translateY(0)'},
          {opacity:0,transform:'translateY(-10px)'}
        ],{duration:220,easing:'cubic-bezier(.4,0,.2,1)',fill:'forwards'});
        out.finished.catch(()=>{}).then(()=>{
          previous.panel.hidden=true;
          previous.panel.getAnimations().forEach(animation=>animation.cancel());
        });
        next.panel.hidden=false;
        next.panel.animate([
          {opacity:0,transform:'translateY(18px)'},
          {opacity:1,transform:'translateY(0)'}
        ],{duration:520,easing:'cubic-bezier(.16,1,.3,1)',fill:'both'});
      }

      activeIndex=nextIndex;
      restartProgress(next.tab);
      schedule();
    }

    entries.forEach(({tab},index)=>{
      tab.addEventListener('click',()=>switchTo(index,{manual:true}));
      tab.addEventListener('keydown',event=>{
        if(!['ArrowDown','ArrowRight','ArrowUp','ArrowLeft'].includes(event.key))return;
        event.preventDefault();
        const direction=(event.key==='ArrowDown'||event.key==='ArrowRight')?1:-1;
        const next=(index+direction+entries.length)%entries.length;
        entries[next].tab.focus();
        switchTo(next,{manual:true});
      });
    });

    document.addEventListener('visibilitychange',()=>{
      if(document.hidden)clearTimeout(timer);
      else schedule();
    });

    applyState();
    restartProgress(entries[activeIndex].tab);
    schedule();
  }

  setupStorySwitcher();

  const reveals=$$('.obra-reveal').filter(el=>!el.closest('.obra-story__body'));
  if('IntersectionObserver' in window&&!reduceMotion){
    const observer=new IntersectionObserver(entries=>{
      for(const entry of entries){
        if(entry.isIntersecting){
          entry.target.classList.add('visible');
          observer.unobserve(entry.target);
        }
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
    const open=next=>{
      index=next;
      render();
      lightbox.classList.add('open');
      document.body.classList.add('no-scroll');
    };
    const close=()=>{
      lightbox.classList.remove('open');
      document.body.classList.remove('no-scroll');
    };

    gallery.forEach((item,i)=>{
      item.tabIndex=0;
      item.setAttribute('role','button');
      item.addEventListener('click',()=>open(i));
      item.addEventListener('keydown',event=>{
        if(event.key==='Enter'||event.key===' '){event.preventDefault();open(i);}
      });
    });

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

  if(!reduceMotion&&'IntersectionObserver' in window){
    const internalVideos=$$('video[data-observe-play]');
    const videoObserver=new IntersectionObserver(entries=>{
      for(const entry of entries){
        const video=entry.target;
        if(entry.isIntersecting)video.play().catch(()=>{});
        else video.pause();
      }
    },{threshold:.25});
    internalVideos.forEach(video=>videoObserver.observe(video));
  }
})();