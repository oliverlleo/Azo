// Shared crop logic, used by the public site and the visual editor.
export const DEVICES=['desktop','tablet','mobile'];
export function deviceForWidth(w){return w<=680?'mobile':w<=1050?'tablet':'desktop'}
export function clamp(v){return Math.round(Math.max(0,Math.min(100,v))*100)/100}
export function validPosition(v){return Array.isArray(v)&&v.length===2&&v.every(n=>typeof n==='number'&&Number.isFinite(n)&&n>=0&&n<=100)}
export function positionItemKey(key,device){return DEVICES.includes(device)&&key?'image-position:'+device+':'+key:''}
export function nextPositionItems(items,key,device,value){
 const id=positionItemKey(key,device);
 if(!id||(value!==null&&!validPosition(value)))throw Error('Posição inválida.');
 return [...items.filter(i=>i.key!==id),...(value===null?[]:[{key:id,type:'image-position',value}])];
}
export function cropTravel(w,h,nw,nh,fit){
 if(!w||!h||!nw||!nh||fit==='fill')return [0,0];
 const x=w/nw,y=h/nh,scale=fit==='cover'?Math.max(x,y):fit==='contain'?Math.min(x,y):fit==='scale-down'?Math.min(1,x,y):1;
 return [w-nw*scale,h-nh*scale];
}
export function dragPosition(start,dx,dy,travel){return [clamp(start[0]+(Math.abs(travel[0])>.5?dx/travel[0]*100:0)),clamp(start[1]+(Math.abs(travel[1])>.5?dy/travel[1]*100:0))]}
function pathOf(el){
 const parts=[],root=el.ownerDocument.body;
 for(let n=el;n&&n.nodeType===1;n=n.parentElement){
  let part=n.tagName.toLowerCase();const same=n.parentElement?[...n.parentElement.children].filter(c=>c.tagName===n.tagName):[];
  if(same.length>1)part+=':nth-of-type('+(same.indexOf(n)+1)+')';
  parts.unshift(part);if(n===root)break;
 }
 return parts.join('>');
}
export function imagePositionKey(img){
 if(!img||img.tagName!=='IMG'||img.closest('.lightbox,.cms-project-lightbox,.loader,.project-modal'))return '';
 if(img.dataset.azoPositionKey)return img.dataset.azoPositionKey;
 const project=img.closest('[data-cms-project]');
 const key=project?'project:'+project.dataset.cmsProject+':cover':pathOf(img);
 img.dataset.azoPositionKey=key;return key;
}
export function ensurePositionStyle(doc){
 if(doc.getElementById('azo-image-position-style'))return;
 const s=doc.createElement('style');s.id='azo-image-position-style';
 const rule=d=>'img[data-azo-position-'+d+']{object-position:var(--azo-position-'+d+')!important;animation:none!important;transform:none!important;transition-property:opacity,filter!important}';
 s.textContent='@media(max-width:680px){'+rule('mobile')+'}@media(min-width:680.01px) and (max-width:1050px){'+rule('tablet')+'}@media(min-width:1050.01px){'+rule('desktop')+'}';
 doc.head.appendChild(s);
}
export function applyPosition(img,device,value){
 if(!DEVICES.includes(device)||!img)return;
 ensurePositionStyle(img.ownerDocument);
 const attr='data-azo-position-'+device,prop='--azo-position-'+device;
 if(!validPosition(value)){img.removeAttribute(attr);img.style.removeProperty(prop);return}
 img.setAttribute(attr,value.join(','));img.style.setProperty(prop,value[0]+'% '+value[1]+'%');
}
export function savedPosition(img,device){
 const raw=img.getAttribute('data-azo-position-'+device),v=raw===null?null:raw.split(',').map(Number);
 return validPosition(v)?v:null;
}
export function computedPosition(img){
 const raw=img.ownerDocument.defaultView.getComputedStyle(img).objectPosition;
 const v=raw.split(/\s+/).map(p=>p==='center'?50:p==='left'||p==='top'?0:p==='right'||p==='bottom'?100:p.endsWith('%')?parseFloat(p):NaN);
 return validPosition(v)?v:[50,50];
}
export function applyImagePositionItems(img,items){
 const key=imagePositionKey(img);if(!key)return;
 for(const d of DEVICES)applyPosition(img,d,items.find(i=>i.key===positionItemKey(key,d)&&i.type==='image-position')?.value);
}
