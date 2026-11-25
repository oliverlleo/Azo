// Coordinates belong to the original photograph, not to the visible crop.
import {computedPosition,cropTravel} from './image-position.mjs';
export const TEAM_SELECTOR='.about-media>img,.inner-hero__media>img';
export const HOTSPOT_KEY='team-photo-identifiers';
const clamp=(n,min=0,max=1)=>Math.max(min,Math.min(max,n));
export function isTeamPhoto(img){return !!img?.matches(TEAM_SELECTOR)&&(/(?:^|\/)team\.webp(?:$|[?#])/i.test(img.dataset.cmsSource||img.getAttribute('src')||'')||img.hasAttribute('data-azo-team-photo'))}
export function photoSource(img){return new URL(img.getAttribute('src')||img.currentSrc,img.ownerDocument.baseURI).href}
export function normalizeHotspots(value){
 if(!Array.isArray(value))return [];
 return value.slice(0,30).filter(r=>r&&typeof r.id==='string'&&typeof r.name==='string'&&[r.x,r.y,r.w,r.h].every(Number.isFinite)&&r.x>=0&&r.y>=0&&r.w>0&&r.h>0&&r.x+r.w<=1.00001&&r.y+r.h<=1.00001).map(r=>({id:r.id.slice(0,80),name:r.name.trim().slice(0,80),role:typeof r.role==='string'?r.role.trim().slice(0,100):'',x:r.x,y:r.y,w:r.w,h:r.h}));
}
export function readHotspots(items,img){const item=items.find(i=>i.key===HOTSPOT_KEY&&i.type==='image-hotspot');return item?.value?.source===photoSource(img)?normalizeHotspots(item.value.areas):[]}
export function nextHotspotItems(items,img,areas){return [...items.filter(i=>i.key!==HOTSPOT_KEY),...(areas.length?[{key:HOTSPOT_KEY,type:'image-hotspot',value:{source:photoSource(img),areas:normalizeHotspots(areas)}}]:[])]}
export function photoGeometry(img){
 const r=img.getBoundingClientRect(),w=img.clientWidth,h=img.clientHeight;
 if(!w||!h||!img.naturalWidth||!img.naturalHeight||!r.width||!r.height)return null;
 const css=img.ownerDocument.defaultView.getComputedStyle(img),[px,py]=computedPosition(img),[tx,ty]=cropTravel(w,h,img.naturalWidth,img.naturalHeight,css.objectFit);
 const sx=r.width/w,sy=r.height/h;
 return {left:r.left+tx*px/100*sx,top:r.top+ty*py/100*sy,width:(w-tx)*sx,height:(h-ty)*sy,clip:r};
}
export function photoPoint(g,x,y){return {x:clamp((x-g.left)/g.width),y:clamp((y-g.top)/g.height)}}
export function visibleArea(g,a){
 const l=Math.max(g.clip.left,g.left+a.x*g.width),t=Math.max(g.clip.top,g.top+a.y*g.height),r=Math.min(g.clip.right,g.left+(a.x+a.w)*g.width),b=Math.min(g.clip.bottom,g.top+(a.y+a.h)*g.height);
 return r>l&&b>t?{left:l,top:t,width:r-l,height:b-t}:null;
}
export function changeArea(a,mode,dx,dy){
 const min=.015;
 if(mode==='move')return {...a,x:clamp(a.x+dx,0,Math.max(0,1-a.w)),y:clamp(a.y+dy,0,Math.max(0,1-a.h))};
 let l=a.x,t=a.y,r=a.x+a.w,b=a.y+a.h;
 if(mode.includes('w'))l=clamp(l+dx,0,r-min);
 if(mode.includes('e'))r=clamp(r+dx,l+min,1);
 if(mode.includes('n'))t=clamp(t+dy,0,b-min);
 if(mode.includes('s'))b=clamp(b+dy,t+min,1);
 return {...a,x:l,y:t,w:r-l,h:b-t};
}
let cleanup=()=>{};
export function renderTeamHotspots(doc,items){
 cleanup();cleanup=()=>{};
 const img=[...doc.querySelectorAll(TEAM_SELECTOR)].find(isTeamPhoto);
 if(!img)return;
 img.setAttribute('data-azo-team-photo','');
 if(doc.documentElement.dataset.azoPreviewPage)return; // editor owns the interaction layer
 const rows=readHotspots(items,img).filter(a=>a.name);
 if(!rows.length)return;
 const host=img.closest('.about-media,.inner-hero');
 if(!host)return;
 const style=doc.createElement('style');
 style.textContent='.azo-team-hotspots{position:absolute;inset:0;z-index:1;pointer-events:none}.about-media>.azo-team-hotspots{z-index:3}.azo-team-hotspots button{position:absolute;pointer-events:auto;cursor:pointer;background:transparent;border:0;border-radius:10px;padding:0;touch-action:manipulation}.azo-team-hotspots button:focus-visible{outline:2px solid #d5c0a6;outline-offset:-2px}.azo-team-label{position:absolute;pointer-events:none;max-width:calc(100% - 20px);width:max-content;background:#0d2f35;color:#fff;border:1px solid #d5c0a6;border-radius:12px;padding:10px 16px;box-shadow:0 8px 26px #071b1f55;z-index:2;text-align:center;line-height:1.2}.azo-team-label[hidden]{display:none!important}.azo-team-label strong{display:block;font:400 1.15rem Georgia,serif;overflow-wrap:anywhere}.azo-team-label small{display:block;color:#d5c0a6;font:600 .68rem system-ui;margin-top:4px;overflow-wrap:anywhere}.azo-team-label:after{content:"";position:absolute;left:var(--arrow,50%);bottom:-5px;width:8px;height:8px;background:#0d2f35;border-right:1px solid #d5c0a6;border-bottom:1px solid #d5c0a6;transform:translateX(-50%) rotate(45deg)}.azo-team-label[data-below]:after{top:-5px;bottom:auto;transform:translateX(-50%) rotate(225deg)}';
 doc.head.append(style);
 const layer=doc.createElement('div');layer.className='azo-team-hotspots';layer.setAttribute('data-cms-ignore','');
 const label=doc.createElement('div');label.className='azo-team-label';label.hidden=true;label.id='azo-team-person-label';label.setAttribute('role','tooltip');
 const name=doc.createElement('strong'),role=doc.createElement('small');label.append(name,role);
 let current=null,pinned=false,raf=0;
 const entries=rows.map(a=>{
  const button=doc.createElement('button');button.type='button';button.setAttribute('aria-label',a.name+(a.role?', '+a.role:''));button.setAttribute('aria-expanded','false');
  const entry={a,button};
  button.addEventListener('pointerenter',e=>{if(e.pointerType==='mouse'&&!pinned)show(entry,false)});
  button.addEventListener('pointerleave',e=>{if(e.pointerType==='mouse'&&!pinned)hide()});
  button.addEventListener('focus',()=>{if(button.matches(':focus-visible'))show(entry,false)});
  button.addEventListener('blur',()=>{if(!pinned)hide()});
  button.addEventListener('click',()=>{if(current===entry&&pinned)hide();else show(entry,true)});
  layer.append(button);return entry;
 });
 layer.append(label);host.append(layer);
 function hide(){if(current)current.button.setAttribute('aria-expanded','false');current=null;pinned=false;label.hidden=true}
 function show(e,pin){if(current)current.button.setAttribute('aria-expanded','false');current=e;pinned=pin;name.textContent=e.a.name;role.textContent=e.a.role;role.hidden=!e.a.role;label.hidden=false;e.button.setAttribute('aria-expanded','true');layout()}
 function layout(){
  const g=photoGeometry(img),h=layer.getBoundingClientRect();if(!g||!h.width||!h.height)return;
  const sx=layer.clientWidth/h.width,sy=layer.clientHeight/h.height;
  for(const e of entries){
   const p=visibleArea(g,e.a);e.button.hidden=!p;if(!p){if(current===e)hide();continue}
   Object.assign(e.button.style,{left:(p.left-h.left)*sx+'px',top:(p.top-h.top)*sy+'px',width:p.width*sx+'px',height:p.height*sy+'px'});
  }
  if(current&&!label.hidden){const b=current.button,center=b.offsetLeft+b.offsetWidth/2,l=clamp(center-label.offsetWidth/2,10,Math.max(10,layer.clientWidth-label.offsetWidth-10)),above=b.offsetTop-label.offsetHeight-9,below=above<8;
   label.toggleAttribute('data-below',below);label.style.left=l+'px';label.style.top=clamp(below?b.offsetTop+b.offsetHeight+9:above,8,Math.max(8,layer.clientHeight-label.offsetHeight-8))+'px';label.style.setProperty('--arrow',clamp(center-l,10,label.offsetWidth-10)+'px');
  }
 }
 // Track the crop even during the existing hero breathing animation.
 const win=doc.defaultView;const tick=()=>{layout();raf=win.requestAnimationFrame(tick)};
 const observer=new win.IntersectionObserver(es=>{if(es[0]?.isIntersecting){if(!raf)tick()}else{win.cancelAnimationFrame(raf);raf=0;hide()}});
 observer.observe(host);
 const outside=e=>{if(!e.target.closest('.azo-team-hotspots button'))hide()};
 const key=e=>{if(e.key==='Escape')hide()};
 doc.addEventListener('pointerdown',outside);doc.addEventListener('keydown',key);
 cleanup=()=>{observer.disconnect();win.cancelAnimationFrame(raf);doc.removeEventListener('pointerdown',outside);doc.removeEventListener('keydown',key);layer.remove();style.remove()};
}
