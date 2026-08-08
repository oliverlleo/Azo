import { db } from './firebase-config.js';
import { collection, getDocs } from 'https://www.gstatic.com/firebasejs/12.16.0/firebase-firestore.js';

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

function current(key){
  const saved = overrides.get(key) || {};
  return {...DEFAULTS[key],...saved,published:saved.published !== false};
}

function applyProjectsPage(){
  if (!document.querySelector('.projects-grid')) return;
  for(const key of ORDER){
    const project=current(key);
    const card=document.querySelector(`.portfolio-card[data-gallery="${key}"]`);
    if(!card) continue;
    card.hidden=!project.published;
    card.style.display=project.published?'':'none';
    const title=card.querySelector('h3');
    const meta=card.querySelector('.portfolio-card__text div span');
    const img=card.querySelector('img');
    if(title) title.textContent=project.title;
    if(meta) meta.textContent=`${project.category || 'Projeto'} · abrir galeria`;
    if(img) img.alt=project.title;
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
  const visible=ORDER.filter(key=>current(key).published);
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
    if(shot){shot.classList.remove('active');stage.insertBefore(shot,info);}
    if(thumb){thumb.classList.remove('active');strip.appendChild(thumb);}
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
    const snap=await getDocs(collection(db,'projects'));
    snap.forEach(item=>{
      const data=item.data();
      if(data?.builtinKey && ORDER.includes(String(data.builtinKey).toUpperCase())){
        overrides.set(String(data.builtinKey).toUpperCase(),data);
      }
    });
    applyProjectsPage();
    rebuildHomeProjects();
    installLightboxTitleSync();
  }catch(error){
    console.warn('[AZO] Não foi possível aplicar alterações dos projetos existentes.',error);
  }
}

if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',load,{once:true}); else load();
