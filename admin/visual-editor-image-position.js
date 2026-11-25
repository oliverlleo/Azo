import {auth,db,doc,getDoc,setDoc,serverTimestamp} from '../assets/js/firebase-config.js';
import {deviceForWidth,validPosition,positionItemKey,nextPositionItems,cropTravel,dragPosition,imagePositionKey,applyPosition,savedPosition,computedPosition,applyImagePositionItems} from '../assets/js/image-position.mjs';
const $=(s,r=document)=>r.querySelector(s),labels={desktop:'Computador',tablet:'Tablet',mobile:'Celular'};
let active=null;
const style=document.createElement('style');
style.textContent=`
.ve3-position-button{grid-column:1/-1;gap:8px}
.ve3-position-button[aria-pressed=true]{background:var(--ink);color:white;border-color:var(--ink)}
.ve3-position-controls{margin-top:14px;padding:14px;border:1px solid var(--line);border-radius:15px;background:#faf8f3}
.ve3-position-controls p{margin:0 0 12px}
.ve3-position-controls label{display:grid;grid-template-columns:1fr auto;gap:6px;font-size:.72rem;font-weight:800;margin:10px 0}
.ve3-position-controls input[type=range]{grid-column:1/-1;width:100%;accent-color:var(--ink);padding:0}
.ve3-position-tools{display:flex;gap:8px;flex-wrap:wrap;margin-top:12px}
.ve3-position-tools .btn{min-height:38px;font-size:.68rem;padding:0 12px;flex:1}
.ve3-position-controls [role=alert]{color:var(--danger)}
#ve3-glass[data-positioning]{cursor:grab;touch-action:none}
#ve3-glass[data-positioning]:active{cursor:grabbing}
#ve3-glass[data-positioning]::before{content:'MODO POSICIONAR • ARRASTE A IMAGEM';background:#a65c3a;white-space:nowrap}
#ve3-glass[data-positioning] #ve3-badge{display:none!important}
`;
document.head.appendChild(style);
function notice(message,type='success'){
 const stack=$('#toast-stack');if(!stack)return;
 const el=document.createElement('div');el.className='toast '+type;
 const mark=document.createElement('b');mark.textContent=type==='error'?'!':'✓';
 const label=document.createElement('span');label.textContent=message;
 el.append(mark,label);stack.appendChild(el);setTimeout(()=>el.remove(),3800);
}
function travelFor(img){return cropTravel(img.clientWidth,img.clientHeight,img.naturalWidth,img.naturalHeight,img.ownerDocument.defaultView.getComputedStyle(img).objectFit)}
function controls(a){
 a.box.querySelector('[data-position-device]').textContent=labels[a.device];
 a.box.querySelectorAll('input[type=range]').forEach((input,i)=>{input.value=a.value[i];input.parentElement.querySelector('output').textContent=a.value[i].toFixed(1).replace(/\.0$/,'')+'%'});
 const t=travelFor(a.img);
 a.box.querySelector('[data-position-hint]').textContent=Math.abs(t[0])<.5&&Math.abs(t[1])<.5?'Esta imagem não tem área de recorte neste tamanho de tela.':'Arraste a foto na prévia ou ajuste os controles. Clique em Concluir para salvar.';
}
function paint(a,value,reset=false){a.value=value;a.reset=reset;a.dirty=true;applyPosition(a.img,a.device,reset?null:value);controls(a)}
function showScene(a){
 const d=a.img.ownerDocument;
 if(!d.getElementById('azo-position-editor-scene')){
  const s=d.createElement('style');s.id='azo-position-editor-scene';
  s.textContent='html img[data-azo-position-key][data-position-editing]{animation:none!important;transform:none!important;transition:none!important} [data-position-group]>.hero-slide:not([data-position-scene]),[data-position-group]>.project-shot:not([data-position-scene]),[data-position-group]>.service-scene:not([data-position-scene]){opacity:0!important;visibility:hidden!important} [data-position-scene]{opacity:1!important;visibility:visible!important;clip-path:none!important;transform:none!important;transition:none!important;z-index:3!important}';
  d.head.appendChild(s);
 }
 a.img.setAttribute('data-position-editing','');
 a.scene=a.img.closest('.hero-slide,.project-shot,.service-scene');
 if(a.scene){a.group=a.scene.parentElement;a.group.setAttribute('data-position-group','');a.scene.setAttribute('data-position-scene','')}
}
function finish(a,revert=false){
 if(active!==a)return;
 if(revert)applyPosition(a.img,a.device,a.original);
 a.img.removeAttribute('data-position-editing');a.group?.removeAttribute('data-position-group');a.scene?.removeAttribute('data-position-scene');
 $('#ve3-glass')?.removeAttribute('data-positioning');
 for(const [el,disabled] of a.locked)el.disabled=disabled;
 a.button.setAttribute('aria-pressed','false');a.button.textContent='Posicionar';a.button.disabled=false;
 a.box.hidden=true;a.box.querySelector('[role=alert]').hidden=true;active=null;
}
async function save(a){
 if(a.saving)return;
 if(!a.dirty){finish(a);return}
 a.saving=true;a.button.disabled=true;a.button.textContent='Salvando…';
 const errorEl=a.box.querySelector('[role=alert]');errorEl.hidden=true;
 a.box.querySelectorAll('button,input').forEach(el=>el.disabled=true);
 try{
  const user=auth.currentUser,uid=user?.id||user?.uid;
  if(!uid)throw Error('Sua sessão expirou. Entre novamente.');
  const admin=await getDoc(doc(db,'admins',uid));
  if(!admin.exists()||admin.data().active!==true)throw Error('Acesso administrativo necessário.');
  const ref=doc(db,'sitePages',a.page),before=await getDoc(ref);
  const items=before.exists()&&Array.isArray(before.data().items)?before.data().items:[];
  const value=a.reset?null:a.value,next=nextPositionItems(items,a.key,a.device,value);
  await setDoc(ref,{page:a.page,items:next,updatedAt:serverTimestamp(),updatedBy:uid},{merge:true});
  const after=await getDoc(ref),stored=after.exists()&&Array.isArray(after.data().items)?after.data().items:[];
  const row=stored.find(i=>i.key===positionItemKey(a.key,a.device)&&i.type==='image-position');
  if(!after.exists()||(value===null?Boolean(row):!validPosition(row?.value)||row.value.some((n,i)=>n!==value[i])))throw Error('Não foi possível confirmar o enquadramento salvo.');
  const win=a.img.ownerDocument.defaultView;
  if(win?.AZO_CMS?.updateImagePositions)win.AZO_CMS.updateImagePositions(stored);else applyImagePositionItems(a.img,stored);
  finish(a);notice('Posição salva para '+labels[a.device]+'.');
 }catch(e){errorEl.textContent=e.message||'Não foi possível salvar a posição.';errorEl.hidden=false;a.button.disabled=false;a.button.textContent='Concluir posicionamento'}
 finally{a.saving=false;a.box.querySelectorAll('button,input').forEach(el=>el.disabled=false)}
}
function start(button,box,img){
 if(active||!img.isConnected)return;
 const frame=$('#ve3-frame'),key=imagePositionKey(img);
 if(!key||!frame?.contentWindow||frame.contentDocument!==img.ownerDocument)return;
 if(!frame.contentWindow.AZO_CMS?.imagePositionsReady){notice('Aguarde o carregamento das configurações da página ou atualize a prévia.','error');return}
 const chosen=$('#ve3-stage')?.dataset.device||'desktop',device=deviceForWidth(frame.contentWindow.innerWidth);
 if(chosen!==device){notice('A prévia ainda não está no tamanho correto. Tente novamente.','error');return}
 const original=savedPosition(img,device);
 const a={button,box,img,key,device,page:$('#ve3-page')?.value||'index',original,value:original||computedPosition(img),locked:[],dirty:false,reset:false,saving:false,drag:null};
 active=a;
 for(const el of document.querySelectorAll('#ve3-page,#ve3-reload,[data-ve3-device],#ve3-side .ve3-back,#ve3-side .ve3-actions button,#ve3-side input[type=file]')){
  if(el===button)continue;a.locked.push([el,el.disabled]);el.disabled=true;
 }
 button.setAttribute('aria-pressed','true');button.textContent='Concluir posicionamento';box.hidden=false;
 $('#ve3-glass')?.setAttribute('data-positioning','');
 img.ownerDocument.querySelectorAll('.ve3-hover').forEach(el=>el.classList.remove('ve3-hover'));
 showScene(a);controls(a);
}
export function mountImagePositioning(img,side){
 const actions=side?.querySelector('.ve3-actions');if(!actions||!imagePositionKey(img))return;
 if(active&&!active.saving)finish(active,true);
 const button=document.createElement('button');button.type='button';button.className='btn btn-ghost ve3-position-button';button.textContent='Posicionar';button.setAttribute('aria-pressed','false');
 const box=document.createElement('div');box.className='ve3-position-controls';box.hidden=true;
 box.innerHTML='<p><b>Enquadramento · <span data-position-device></span></b></p><p data-position-hint></p><label>Horizontal <output></output><input type="range" min="0" max="100" step="0.1" aria-label="Posição horizontal"></label><label>Vertical <output></output><input type="range" min="0" max="100" step="0.1" aria-label="Posição vertical"></label><div class="ve3-position-tools"><button type="button" class="btn btn-ghost" data-position-reset>Voltar à posição original</button><button type="button" class="btn btn-ghost" data-position-cancel>Cancelar</button></div><p role="alert" hidden></p>';
 actions.appendChild(button);actions.after(box);
 button.addEventListener('click',()=>active?.button===button?save(active):start(button,box,img));
 box.querySelectorAll('input[type=range]').forEach((input,i)=>input.addEventListener('input',()=>{if(active?.button!==button||active.saving)return;const v=[...active.value];v[i]=Number(input.value);paint(active,v)}));
 box.querySelector('[data-position-reset]').addEventListener('click',()=>{const a=active;if(a?.button!==button||a.saving)return;applyPosition(a.img,a.device,null);paint(a,computedPosition(a.img),true)});
 box.querySelector('[data-position-cancel]').addEventListener('click',()=>{if(active?.button===button&&!active.saving)finish(active,true)});
}
function block(e){e.preventDefault();e.stopImmediatePropagation()}
function glassEvent(e){return Boolean(e.target?.closest?.('#ve3-glass'))}
window.addEventListener('pointerdown',e=>{
 const a=active;if(!a||!glassEvent(e))return;block(e);if(a.saving||e.button!==0)return;
 const frame=$('#ve3-frame'),r=frame.getBoundingClientRect(),ir=a.img.getBoundingClientRect(),sx=frame.clientWidth/r.width,sy=frame.clientHeight/r.height,x=(e.clientX-r.left)*sx,y=(e.clientY-r.top)*sy;
 if(x<ir.left||x>ir.right||y<ir.top||y>ir.bottom)return;
 a.drag={id:e.pointerId,x:e.clientX,y:e.clientY,sx,sy,start:[...a.value],travel:travelFor(a.img)};
 e.target.setPointerCapture?.(e.pointerId);
},true);
window.addEventListener('pointermove',e=>{
 const a=active;if(!a||(!a.drag&&!glassEvent(e)))return;block(e);
 const d=a.drag;if(!d||d.id!==e.pointerId||a.saving)return;
 const value=dragPosition(d.start,(e.clientX-d.x)*d.sx,(e.clientY-d.y)*d.sy,d.travel);
 if(value.some((n,i)=>n!==a.value[i]))paint(a,value);
},true);
for(const event of ['pointerup','pointercancel','lostpointercapture'])window.addEventListener(event,e=>{const a=active;if(a?.drag?.id===e.pointerId){a.drag=null;block(e)}},true);
for(const event of ['click','mousemove','mousedown','mouseup','dblclick','contextmenu','wheel'])window.addEventListener(event,e=>{if(active&&glassEvent(e))block(e)},{capture:true,passive:false});
window.addEventListener('keydown',e=>{if(active&&e.key==='Escape'&&!active.saving){block(e);finish(active,true)}},true);
window.addEventListener('click',e=>{if(active&&!active.saving&&e.target.closest?.('.nav-item:not(#ve3-nav),#logout-button'))finish(active,true)},true);
new MutationObserver(()=>{if(active&&!active.saving&&(!active.button.isConnected||!active.img.isConnected||$('#ve3-frame')?.contentDocument!==active.img.ownerDocument))finish(active,true)}).observe(document.documentElement,{childList:true,subtree:true});
