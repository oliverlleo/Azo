import {auth,db,doc,getDoc,setDoc,serverTimestamp} from '../assets/js/firebase-config.js';
import {isTeamPhoto,photoSource,photoGeometry,photoPoint,visibleArea,changeArea,readHotspots,nextHotspotItems,normalizeHotspots,HOTSPOT_KEY} from '../assets/js/team-hotspots.mjs?v=20261125-team';
import {previewPoint} from './visual-editor-responsive.js?v=20261125-responsive';
const $=(s,r=document)=>r.querySelector(s);
let active=null;
const style=document.createElement('style');
style.textContent='.ve3-hotspot-toggle{grid-column:1/-1}.ve3-hotspot-panel{margin-top:14px;padding:14px;border:1px solid var(--line);border-radius:16px;background:#faf8f3}.ve3-hotspot-panel label{display:grid;gap:6px;margin:10px 0;font-size:.75rem;font-weight:800}.ve3-hotspot-panel input,.ve3-hotspot-panel select{width:100%;min-width:0;padding:9px;border:1px solid var(--line);border-radius:10px;background:white}.ve3-hotspot-tools{display:flex;flex-wrap:wrap;gap:6px;margin-top:10px}.ve3-hotspot-tools button{flex:1;min-height:38px;padding:0 9px}.ve3-hotspot-panel [role=alert]{color:var(--danger)}#ve3-glass[data-hotspots]{cursor:crosshair}#ve3-glass[data-hotspots]::before{content:"IDENTIFICAR PESSOAS";background:#a65c3a}#ve3-glass[data-hotspots] #ve3-badge{display:none!important}.ve3-hotspot-layer{position:absolute;inset:0;pointer-events:none;overflow:hidden}.ve3-hotspot-rect{position:absolute;border:2px dashed #fff;background:#0d2f3525;pointer-events:none;box-shadow:0 0 0 1px #0d2f35}.ve3-hotspot-rect.active{border:2px solid #d5c0a6;background:#0d2f3540;cursor:move}.ve3-hotspot-rect span{position:absolute;left:0;top:0;background:#0d2f35;color:#fff;padding:4px 7px;font:600 12px system-ui;max-width:100%;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.ve3-hotspot-handle{position:absolute;width:16px;height:16px;background:#fff;border:2px solid #0d2f35;border-radius:4px;pointer-events:none}.ve3-hotspot-panel [hidden]{display:none!important}';
document.head.append(style);
function message(a,msg){const p=$('[role=alert]',a.box);p.textContent=msg;p.hidden=!msg}
function chosen(a){return a.rows.find(r=>r.id===a.selected)}
function sync(a){
 const select=$('[data-person]',a.box);select.replaceChildren();
 const none=document.createElement('option');none.value='';none.textContent='Selecione uma pessoa';select.append(none);
 for(const [i,r] of a.rows.entries()){const opt=document.createElement('option');opt.value=r.id;opt.textContent=r.name||'Pessoa '+(i+1);select.append(opt)}
 select.value=a.selected||'';
 const r=chosen(a);$('[data-fields]',a.box).hidden=!r;
 $('[data-name]',a.box).value=r?.name||'';$('[data-role]',a.box).value=r?.role||'';
 $('[data-new]',a.box).textContent=a.drawing?'Arraste sobre a pessoa…':'Nova identificação';
 $('[data-new]',a.box).disabled=a.rows.length>=30||a.saving;
}
function draw(a){
 if(active!==a)return;
 if(!a.button.isConnected||!a.img.isConnected||$('#ve3-frame')?.contentDocument!==a.img.ownerDocument||!$('#view-visual-v3')?.classList.contains('active')){if(!a.saving)finish(a);return}
 const g=photoGeometry(a.img);a.layer.replaceChildren();
 if(g){
  const maxW=$('#ve3-frame').clientWidth,maxH=$('#ve3-frame').clientHeight;
  for(const [i,r] of a.rows.entries()){
   const v=visibleArea(g,r);if(!v||v.left+v.width<0||v.top+v.height<0||v.left>maxW||v.top>maxH)continue;
   const node=document.createElement('div');node.className='ve3-hotspot-rect'+(r.id===a.selected?' active':'');
   Object.assign(node.style,{left:v.left+'px',top:v.top+'px',width:v.width+'px',height:v.height+'px'});
   const label=document.createElement('span');label.textContent=r.name||'Pessoa '+(i+1);node.append(label);
   if(r.id===a.selected)for(const [x,y] of [[0,0],[1,0],[0,1],[1,1]]){
    const h=document.createElement('i');h.className='ve3-hotspot-handle';h.style.left=(x*100)+'%';h.style.top=(y*100)+'%';h.style.transform='translate(-50%,-50%)';node.append(h);
   }
   a.layer.append(node);
  }
 }
 a.raf=requestAnimationFrame(()=>draw(a));
}
function finish(a){
 if(active!==a)return;
 cancelAnimationFrame(a.raf);a.layer.remove();$('#ve3-glass')?.removeAttribute('data-hotspots');
 for(const [el,disabled] of a.locked)el.disabled=disabled;
 a.button.textContent='Identificar pessoas';a.button.setAttribute('aria-pressed','false');a.button.disabled=false;a.box.hidden=true;
 a.img.style.animationPlayState=a.animation;
 active=null;
}
async function start(button,box,img){
 if(active||$('#ve3-glass')?.hasAttribute('data-positioning'))return;
 const frame=$('#ve3-frame'),glass=$('#ve3-glass');if(!frame||!glass||frame.contentDocument!==img.ownerDocument)return;
 button.disabled=true;box.hidden=false;
 try{
  const page=$('#ve3-page').value;
  const snap=await getDoc(doc(db,'sitePages',page));
  if(!button.isConnected||frame.contentDocument!==img.ownerDocument||$('#ve3-page').value!==page){box.hidden=true;return}
  if(!photoGeometry(img))throw Error('Aguarde a foto carregar antes de identificar as pessoas.');
  const rows=readHotspots(snap.exists()&&Array.isArray(snap.data().items)?snap.data().items:[],img);
  const layer=document.createElement('div');layer.className='ve3-hotspot-layer';glass.append(layer);glass.setAttribute('data-hotspots','');
  const a={button,box,img,layer,page,source:photoSource(img),rows,selected:rows[0]?.id||'',drawing:rows.length===0,locked:[],saving:false,animation:img.style.animationPlayState};
  img.style.animationPlayState='paused';
  active=a;
  for(const el of document.querySelectorAll('#ve3-page,#ve3-reload,[data-ve3-device],#ve3-side .ve3-back,#ve3-side .ve3-actions button,#ve3-side input[type=file]')){
   if(el!==button){a.locked.push([el,el.disabled]);el.disabled=true}
  }
  button.textContent='Salvar identificações';button.setAttribute('aria-pressed','true');
  message(a,'');sync(a);draw(a);
 }catch(e){$('[role=alert]',box).textContent=e.message||'Não foi possível carregar as identificações.';$('[role=alert]',box).hidden=false;$('[data-fields]',box).hidden=true}
 finally{button.disabled=false}
}
async function save(a){
 if(a.saving)return;
 if(a.rows.some(r=>!r.name.trim()))return message(a,'Preencha o nome de todas as pessoas antes de salvar.');
 if(photoSource(a.img)!==a.source)return message(a,'A foto foi alterada. Reabra o editor.');
 a.saving=true;a.button.disabled=true;a.button.textContent='Salvando…';message(a,'');
 const controls=[...a.box.querySelectorAll('input,button,select')];controls.forEach(el=>el.disabled=true);
 try{
  const u=auth.currentUser,uid=u?.id||u?.uid;if(!uid)throw Error('Sua sessão expirou.');
  const admin=await getDoc(doc(db,'admins',uid));if(!admin.exists()||admin.data().active!==true)throw Error('Acesso administrativo necessário.');
  const ref=doc(db,'sitePages',a.page),before=await getDoc(ref),items=before.exists()&&Array.isArray(before.data().items)?before.data().items:[];
  const expected=normalizeHotspots(a.rows),next=nextHotspotItems(items,a.img,expected);
  await setDoc(ref,{page:a.page,items:next,updatedAt:serverTimestamp(),updatedBy:uid},{merge:true});
  const after=await getDoc(ref),stored=after.exists()&&Array.isArray(after.data().items)?after.data().items:[];
  const actual=readHotspots(stored,a.img);
  if(!after.exists()||JSON.stringify(actual)!==JSON.stringify(expected)||(!expected.length&&stored.some(i=>i.key===HOTSPOT_KEY)))throw Error('Não foi possível confirmar a gravação.');
  finish(a);$('#ve3-reload')?.click();
 }catch(e){message(a,e.message||'Não foi possível salvar.');a.button.textContent='Salvar identificações';a.button.disabled=false}
 finally{a.saving=false;controls.forEach(el=>el.disabled=false);if(active===a)sync(a)}
}
export function mountTeamIdentification(img,side){
 if(!isTeamPhoto(img)||!side?.querySelector('.ve3-actions'))return;
 const button=document.createElement('button');button.type='button';button.className='btn btn-ghost ve3-hotspot-toggle';button.textContent='Identificar pessoas';button.setAttribute('aria-pressed','false');
 const box=document.createElement('div');box.className='ve3-hotspot-panel';box.hidden=true;
 box.innerHTML='<p><b>Identificar pessoas</b></p><p>Desenhe um retângulo sobre a pessoa na prévia. Arraste o centro para mover ou os cantos para redimensionar.</p><label>Identificações<select data-person></select></label><div data-fields hidden><label>Nome<input data-name maxlength="80" autocomplete="off"></label><label>Cargo (opcional)<input data-role maxlength="100" autocomplete="off"></label><button type="button" class="btn btn-danger" data-remove>Excluir identificação</button></div><div class="ve3-hotspot-tools"><button class="btn btn-ghost" type="button" data-new>Nova identificação</button><button class="btn btn-ghost" type="button" data-cancel>Cancelar</button></div><p role="alert" hidden></p>';
 side.querySelector('.ve3-actions').append(button);side.append(box);
 button.addEventListener('click',()=>active?.button===button?save(active):start(button,box,img));
 $('[data-person]',box).addEventListener('change',e=>{if(active?.button!==button)return;active.selected=e.target.value;active.drawing=false;sync(active)});
 for(const [key,field] of [['name','[data-name]'],['role','[data-role]']])$(field,box).addEventListener('input',e=>{if(active?.button!==button)return;const r=chosen(active);if(r){r[key]=e.target.value;const opt=$('[data-person]',box).selectedOptions[0];if(key==='name'&&opt)opt.textContent=r.name||'Pessoa sem nome'}});
 $('[data-new]',box).addEventListener('click',()=>{if(active?.button!==button||active.rows.length>=30)return;active.drawing=true;active.selected='';sync(active)});
 $('[data-remove]',box).addEventListener('click',()=>{if(active?.button!==button)return;active.rows=active.rows.filter(r=>r.id!==active.selected);active.selected=active.rows[0]?.id||'';sync(active)});
 $('[data-cancel]',box).addEventListener('click',()=>{if(active?.button===button&&!active.saving)finish(active);else box.hidden=true});
}
function stop(e){e.preventDefault();e.stopImmediatePropagation()}
function inside(e){return !!e.target?.closest?.('#ve3-glass')}
function hit(g,r,p){const v=visibleArea(g,r);return v&&p.x>=v.left-8&&p.x<=v.left+v.width+8&&p.y>=v.top-8&&p.y<=v.top+v.height+8}
window.addEventListener('pointerdown',e=>{
 const a=active;if(!a||!inside(e))return;stop(e);if(a.saving||e.button!==0)return;
 const p=previewPoint(e),g=photoGeometry(a.img);if(!p||!g)return;
 const q=photoPoint(g,p.x,p.y);
 let row=chosen(a),mode='move';
 if(a.drawing){
  if(p.x<g.clip.left||p.x>g.clip.right||p.y<g.clip.top||p.y>g.clip.bottom)return;
  row={id:crypto.randomUUID(),name:'',role:'',x:q.x,y:q.y,w:0,h:0};a.rows.push(row);a.selected=row.id;mode='draw';
 }else{
  if(!row||!hit(g,row,p))row=[...a.rows].reverse().find(r=>hit(g,r,p));
  if(!row)return;
  a.selected=row.id;const v=visibleArea(g,row),l=Math.abs(p.x-v.left)<14,r=Math.abs(p.x-v.left-v.width)<14,t=Math.abs(p.y-v.top)<14,b=Math.abs(p.y-v.top-v.height)<14;
  if((l||r)&&(t||b))mode=(t?'n':'s')+(l?'w':'e');
 }
 a.drag={id:e.pointerId,start:q,row:{...row},mode};sync(a);$('#ve3-glass').setPointerCapture?.(e.pointerId);
},true);
window.addEventListener('pointermove',e=>{
 const a=active;if(!a||(!inside(e)&&!a.drag))return;stop(e);if(a.saving||a.drag?.id!==e.pointerId)return;
 const g=photoGeometry(a.img),p=previewPoint(e);if(!g||!p)return;
 const q=photoPoint(g,p.x,p.y),d=a.drag,dx=q.x-d.start.x,dy=q.y-d.start.y;
 const r=d.mode==='draw'?{...d.row,x:Math.min(q.x,d.start.x),y:Math.min(q.y,d.start.y),w:Math.abs(dx),h:Math.abs(dy)}:changeArea(d.row,d.mode,dx,dy);
 a.rows=a.rows.map(v=>v.id===r.id?r:v);
},true);
for(const evt of ['pointerup','pointercancel','lostpointercapture'])window.addEventListener(evt,e=>{
 const a=active;if(!a||a.drag?.id!==e.pointerId)return;stop(e);
 if(a.drag.mode==='draw'){const r=chosen(a);if(!r||r.w<.015||r.h<.015){a.rows=a.rows.filter(v=>v.id!==a.selected);a.selected=''}else{a.drawing=false;sync(a);$('[data-name]',a.box).focus()}}
 a.drag=null;sync(a);
},true);
for(const evt of ['click','mousemove','mousedown','mouseup','dblclick','contextmenu'])window.addEventListener(evt,e=>{if(active&&inside(e))stop(e)},true);
window.addEventListener('wheel',e=>{if(active&&inside(e)){stop(e);$('#ve3-frame')?.contentWindow?.scrollBy({top:e.deltaY,left:e.deltaX})}},{capture:true,passive:false});
window.addEventListener('keydown',e=>{if(active&&e.key==='Escape'&&!active.saving){stop(e);finish(active)}},true);
