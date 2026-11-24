import { db, collection, getDocs } from './firebase-config.js';
import { visibleProjectPhotos } from './project-photo-visibility.mjs';
import { readProjectPhotoVisibility } from './project-photo-store.js';

const ORDER = ['AS','HL','JT','MN','SE','EF'];
const DEFAULTS = {
  AS:{title:'Casa AS',category:'Arquitetura residencial'},
  HL:{title:'Casa HL',category:'Arquitetura residencial'},
  JT:{title:'Casa JT',category:'Projeto residencial'},
  MN:{title:'Casa MN',category:'Arquitetura + construção'},
  SE:{title:'Casa SE',category:'Projeto residencial'},
  EF:{title:'Casa EF',category:'Interiores + área de lazer'}
};
const overrides = new Map();
let hiddenPhotos = new Set();
let addedPhotos = new Map();

function photos(key){ return visibleProjectPhotos(key,hiddenPhotos,addedPhotos); }
function photoURL(path){return addedPhotos.get(path)?.url || new URL('../images/projects/'+path.split('/').pop(),import.meta.url).href;}
function cover(img,key,thumbnail=false){
  const first=photos(key)[0];
  if(!img || !first) return;
  const path=thumbnail&&!addedPhotos.has(first)?first.replace('.webp','-sm.webp'):first;
  const url=photoURL(path);
  img.removeAttribute('srcset');
  img.dataset.cmsSource=path;
  img.src=window.AZO_CMS?.resolveAsset(url)||url;
}

function current(key){
  const saved = overrides.get(key) || {};
  return {...DEFAULTS[key],...saved,published:saved.published !== false};
}

function applyProjectsPage(){
  for(const key of ORDER){
    const project=current(key);
    for(const card of document.querySelectorAll(`.portfolio-card[data-gallery="${key}"],.case-card[data-gallery="${key}"],.project-card[data-project="${key.toLowerCase()}"]`)){
      const visible=project.published && photos(key).length>0;
      card.hidden=!visible;
      card.style.display=visible?'':'none';
      if(!visible) continue;
      const title=card.querySelector('h3');
      const meta=card.querySelector('.portfolio-card__text div span');
      const img=card.querySelector('img');
      if(title) title.textContent=project.title;
      if(meta) meta.textContent=`${project.category || 'Projeto'} · abrir galeria`;
      if(img){img.alt=project.title;cover(img,key);}
    }
  }
}

function installLightboxTitleSync(){
  const title=document.querySelector('.lightbox__title');
  if(!title || title.dataset.projectOverrideWatch==='1') return;
  title.dataset.projectOverrideWatch='1';
  let busy=false;
  const sync=()=>{
    if(busy) return;
    const text=title.textContent || '';
    const match=text.match(/Casa\s+(AS|HL|JT|MN|SE|EF)\s*·\s*(\d+\/\d+)/i);
    if(!match) return;
    const key=match[1].toUpperCase();
    const project=current(key);
    const next=`${project.title} · ${match[2]}`;
    if(next!==text){busy=true;title.textContent=next;busy=false;}
  };
  new MutationObserver(sync).observe(title,{childList:true,characterData:true,subtree:true});
  sync();
}

function rebuildHomeProjects(){
  const oldSection=document.querySelector('section.projects');
  if(!oldSection || !oldSection.querySelector('.project-stage')) return;
  if(oldSection.dataset.projectOverridesReady==='1') return;

  const oldOpen=oldSection.querySelector('.project-open');
  const oldShots=[...oldSection.querySelectorAll('.project-shot')];
  const oldThumbs=[...oldSection.querySelectorAll('.project-thumb')];
  const visible=ORDER.filter(key=>current(key).published && photos(key).length>0);
  if(!visible.length){oldSection.style.display='none';return;}

  const fresh=oldSection.cloneNode(true);
  fresh.dataset.projectOverridesReady='1';
  const stage=fresh.querySelector('.project-stage');
  const info=stage.querySelector('.project-info');
  const strip=fresh.querySelector('.project-strip');
  fresh.querySelectorAll('.project-shot').forEach(el=>el.remove());
  strip.innerHTML='';

  visible.forEach(key=>{
    const originalIndex=ORDER.indexOf(key);
    const shot=oldShots[originalIndex]?.cloneNode(true);
    const thumb=oldThumbs[originalIndex]?.cloneNode(true);
    if(shot){cover(shot.querySelector('img'),key);shot.classList.remove('active');stage.insertBefore(shot,info);}
    if(thumb){cover(thumb.querySelector('img'),key,true);thumb.classList.remove('active');strip.appendChild(thumb);}
  });

  oldSection.replaceWith(fresh);

  const shots=[...fresh.querySelectorAll('.project-shot')];
  const thumbs=[...fresh.querySelectorAll('.project-thumb')];
  const name=fresh.querySelector('.project-info__name');
  const meta=fresh.querySelector('.project-info__meta');
  const count=fresh.querySelector('.project-counter');
  const open=fresh.querySelector('.project-open');
  const prev=fresh.querySelector('.project-prev');
  const next=fresh.querySelector('.project-next');
  let index=0;
  let timer;

  function setProject(i,user=false){
    index=(i+visible.length)%visible.length;
    const key=visible[index];
    const project=current(key);
    shots.forEach((el,n)=>el.classList.toggle('active',n===index));
    thumbs.forEach((el,n)=>el.classList.toggle('active',n===index));
    if(name) name.textContent=project.title;
    if(meta) meta.textContent=project.category || 'Projeto';
    if(count) count.textContent=`${String(index+1).padStart(2,'0')} / ${String(visible.length).padStart(2,'0')}`;
    if(open) open.dataset.gallery=key;
    if(user) restart();
  }
  function restart(){clearInterval(timer);timer=setInterval(()=>setProject(index+1),6800);}

  prev?.addEventListener('click',()=>setProject(index-1,true));
  next?.addEventListener('click',()=>setProject(index+1,true));
  thumbs.forEach((el,n)=>el.addEventListener('click',()=>setProject(n,true)));
  open?.addEventListener('click',()=>{
    const key=visible[index];
    if(!oldOpen) return;
    oldOpen.dataset.gallery=key;
    oldOpen.click();
  });
  setProject(0);
  restart();
}

async function load(){
  try{
    const [snap,visibility]=await Promise.all([getDocs(collection(db,'projectSettings')),readProjectPhotoVisibility()]);
    hiddenPhotos=visibility.hidden;
    addedPhotos=visibility.additions;
    snap.forEach(item=>{
      const data=item.data();
      if(data?.builtinKey && ORDER.includes(String(data.builtinKey).toUpperCase())){
        overrides.set(String(data.builtinKey).toUpperCase(),data);
      }
    });
    // Apply after text/image CMS overrides to prevent an old cover winning a race.
    if(!document.documentElement.dataset.cmsReady){
      await new Promise(resolve=>window.addEventListener('azo:cms-ready',resolve,{once:true}));
    }
    applyProjectsPage();
    rebuildHomeProjects();
    installLightboxTitleSync();
    window.AZO_PROJECT_PHOTOS={photos:key=>current(key).published?photos(key):[],url:photoURL};
    document.documentElement.dataset.azoProjectPhotosReady='true';
  }catch(error){
    document.documentElement.dataset.azoProjectPhotosReady='failed';
    console.warn('[AZO] Projetos originais ocultos até confirmar a visibilidade das fotos.',error);
  }
}

if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',load,{once:true}); else load();