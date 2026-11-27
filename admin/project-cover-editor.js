import {auth,db,collection,getDocs,storage,ref,uploadBytesResumable,getDownloadURL} from '../assets/js/firebase-config.js';
import {readProjectPhotoVisibility,requirePhotoAdmin} from '../assets/js/project-photo-store.js';
import {visibleProjectPhotos} from '../assets/js/project-photo-visibility.mjs';
import {readProjectPresentation,saveProjectPresentation} from '../assets/js/project-cover-store.js';
import {chooseCover,portfolioDetails,COVER_RATIOS} from '../assets/js/project-cover.mjs';
import {cropTravel,dragPosition} from '../assets/js/image-position.mjs';
const $=(s,r=document)=>r.querySelector(s);
export async function builtinCoverPhotos(key,visibility,assets){
 return visibleProjectPhotos(key,visibility.hidden,visibility.additions).map(path=>({key:path,url:visibility.additions.get(path)?.url||assets.get(path)||'../'+path}));
}
export function customCoverPhotos(project){return (project.images||[]).filter(i=>i?.url).map(i=>({key:i.url,url:i.url}))}
export async function loadCoverContext(){
 const [covers,visibility,snap]=await Promise.all([readProjectPresentation(),readProjectPhotoVisibility(),getDocs(collection(db,'assets'))]);
 const assets=new Map();snap.forEach(row=>{const x=row.data();if(x?.path&&x.url)assets.set(x.path,x.url)});
 return {covers,visibility,assets};
}
function upload(file,kind,id,progress){
 const path='site/assets/project-covers/'+kind+'/'+id+'/'+crypto.randomUUID()+'-'+file.name.replace(/[^a-zA-Z0-9._-]/g,'-');
 return new Promise((resolve,reject)=>{
  const task=uploadBytesResumable(ref(storage,path),file,{contentType:file.type,cacheControl:'public,max-age=31536000,immutable'});
  task.on('state_changed',s=>progress(Math.round(s.bytesTransferred/s.totalBytes*100)),reject,async()=>{try{resolve(await getDownloadURL(task.snapshot.ref))}catch(e){reject(e)}});
 });
}
const style=document.createElement('style');
style.textContent=`
 .azo-cover-dialog{width:min(760px,calc(100% - 24px));max-height:90dvh;overflow:auto;padding:24px;border:1px solid var(--line);border-radius:24px;background:#fff;color:var(--ink);box-shadow:0 24px 80px #071b1f44}
 .azo-cover-dialog::backdrop{background:#071b1f99}
 .azo-cover-dialog h2{font:400 2rem Georgia,serif;margin:8px 0}
 .azo-cover-dialog p{font-size:.8rem;color:var(--muted);line-height:1.5}
 .azo-cover-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(115px,1fr));gap:10px;max-height:250px;overflow:auto;padding:3px}
 .azo-cover-choice{display:grid;gap:6px;min-width:0;padding:5px;border:1px solid var(--line);border-radius:12px;background:white;cursor:pointer;color:var(--ink);font-size:.72rem;text-align:center}
 .azo-cover-choice[aria-pressed=true]{outline:2px solid var(--ink);background:#edf3f1}
 .azo-cover-choice img{width:100%;aspect-ratio:1.2;object-fit:cover;border-radius:8px}
 .azo-cover-upload{display:grid;gap:8px;border:1px dashed var(--line);padding:12px;border-radius:12px;margin:14px 0;font-size:.78rem}
 .azo-cover-dialog footer{position:sticky;bottom:-24px;display:flex;justify-content:flex-end;flex-wrap:wrap;gap:8px;margin-top:14px;padding:12px 0;background:white;border-top:1px solid var(--line)}
 .azo-cover-dialog [role=alert]{color:var(--danger)}
 .azo-cover-dialog [hidden]{display:none!important}
 @media(max-width:500px){.azo-cover-dialog{padding:16px}.azo-cover-dialog footer{bottom:-16px}.azo-cover-dialog footer .btn{flex:1;min-height:40px}}
 .azo-cover-fields label{display:grid;gap:6px;font-size:.78rem;font-weight:800}
 .azo-cover-fields input,.azo-cover-fields select{width:100%;border:1px solid var(--line);border-radius:12px;background:white;color:var(--ink);padding:10px}
 .azo-cover-category{max-width:300px}
 .azo-cover-crop{background:var(--paper);border-radius:16px;padding:14px;margin:14px 0}
 .azo-cover-crop .azo-cover-fields{max-width:310px;margin-bottom:12px}
 .azo-cover-frame{width:min(100%,480px);margin-inline:auto;overflow:hidden;border-radius:12px;background:var(--ink);touch-action:none;cursor:grab}
 .azo-cover-frame:active{cursor:grabbing}
 .azo-cover-frame img{display:block;width:100%;height:100%;object-fit:cover;user-select:none}
 .azo-cover-ranges label{display:grid;grid-template-columns:1fr auto;gap:6px;font-size:.75rem;font-weight:800}
 .azo-cover-ranges output{font-variant-numeric:tabular-nums}
 .azo-cover-ranges input{grid-column:1/-1;width:100%;margin:0;accent-color:var(--ink)}
 .azo-cover-crop .btn{min-height:36px;margin-top:12px}
`;
document.head.append(style);
export async function openCoverEditor({kind,id,title,photos,setting,fallback,order,onSaved}){
 if($('#azo-cover-dialog'))return;
 try{await requirePhotoAdmin(auth.currentUser)}catch(e){alert(e.message);return}
 if($('#azo-cover-dialog'))return;
 const dialog=document.createElement('dialog');dialog.id='azo-cover-dialog';dialog.className='azo-cover-dialog';dialog.setAttribute('aria-labelledby','azo-cover-title');
 dialog.innerHTML=`
  <form>
   <p class="eyebrow">Portfólio e capa</p>
   <h2 id="azo-cover-title"></h2>
   <div class="azo-cover-fields azo-cover-category">
    <label>Categoria do portfólio<select name="section"><option value="exteriores">Exteriores</option><option value="interiores">Interiores</option></select></label>
   </div>
   <div class="azo-cover-crop">
    <div class="azo-cover-fields">
     <label>Formato da prévia<select name="format"><option value="featured">Destaque lado a lado</option><option value="wide">Destaque panorâmico</option><option value="carousel">Carrossel</option></select></label>
    </div>
    <div class="azo-cover-frame"><img alt="Prévia da capa" draggable="false"></div>
    <p>Arraste a foto ou use os controles para ajustar o enquadramento.</p>
    <div class="form-grid azo-cover-ranges">
     <label>Horizontal <output></output><input type="range" min="0" max="100" step="0.1" aria-label="Posição horizontal"></label>
     <label>Vertical <output></output><input type="range" min="0" max="100" step="0.1" aria-label="Posição vertical"></label>
    </div>
    <button class="btn btn-ghost" type="button" data-center>Centralizar capa</button>
   </div>
   <p><b>Selecionar uma foto do projeto</b></p><div class="azo-cover-grid"></div>
   <label class="azo-cover-upload"><b>Ou enviar uma nova capa</b><span>Imagem exclusiva da capa, até 30 MB.</span><input type="file" accept="image/jpeg,image/png,image/webp,image/avif,image/gif"></label>
   <p role="status"></p><p role="alert" hidden></p>
   <footer><button class="btn btn-ghost" type="button" data-default>Usar capa padrão</button><button class="btn btn-ghost" type="button" data-cancel>Cancelar</button><button class="btn btn-primary" type="submit" data-save>Salvar portfólio e capa</button></footer>
  </form>`;
 $('#azo-cover-title',dialog).textContent=title||'Editar projeto';
 const form=$('form',dialog),grid=$('.azo-cover-grid',dialog),frame=$('.azo-cover-frame',dialog),preview=$('img',frame);
 const fileInput=$('input[type=file]',dialog),save=$('[data-save]',dialog),error=$('[role=alert]',dialog);
 const sectionInput=form.elements.section,formatInput=form.elements.format;
 const ranges=[...form.querySelectorAll('input[type=range]')];
 const details=portfolioDetails(setting,order);
 sectionInput.value=details.section;
 let choice=setting?.cover||null,position=details.position,file=null,objectUrl='',busy=false,drag=null;
 function paintPosition(){
  const [x,y]=position||[50,50];
  preview.style.objectPosition=x+'% '+y+'%';
  ranges.forEach((input,index)=>{
   const value=index===0?x:y;
   input.value=value;
   input.parentElement.querySelector('output').textContent=value+'%';
  });
 }
 function paintFormat(){ frame.style.aspectRatio=COVER_RATIOS[formatInput.value]; }
 function refresh(){
  const resolved=chooseCover(choice,photos,fallback);preview.src=file?objectUrl:resolved.url||'';frame.hidden=!(file||resolved.url);
  for(const b of grid.querySelectorAll('button'))b.setAttribute('aria-pressed',String(!file&&choice?.mode==='gallery'&&choice.key===b.dataset.key));
 }
 ranges.forEach((input,index)=>input.addEventListener('input',()=>{
  position=[...(position||[50,50])];position[index]=Number(input.value);paintPosition();
 }));
 formatInput.addEventListener('change',paintFormat);
 $('[data-center]',dialog).onclick=()=>{position=[50,50];paintPosition()};
 frame.addEventListener('pointerdown',event=>{
  if(busy||!event.isPrimary||event.button!==0||!preview.naturalWidth)return;
  drag={id:event.pointerId,x:event.clientX,y:event.clientY,start:position||[50,50],travel:cropTravel(preview.clientWidth,preview.clientHeight,preview.naturalWidth,preview.naturalHeight,'cover')};
  frame.setPointerCapture(event.pointerId);
 });
 frame.addEventListener('pointermove',event=>{
  if(busy||drag?.id!==event.pointerId)return;
  const next=dragPosition(drag.start,event.clientX-drag.x,event.clientY-drag.y,drag.travel);
  if(next.some((value,i)=>value!==(position||[50,50])[i])){position=next;paintPosition()}
 });
 frame.addEventListener('lostpointercapture',()=>{drag=null});
 function clearFile(){file=null;fileInput.value='';if(objectUrl)URL.revokeObjectURL(objectUrl);objectUrl=''}
 photos.forEach((p,i)=>{const b=document.createElement('button');b.type='button';b.className='azo-cover-choice';b.dataset.key=p.key;const img=document.createElement('img');img.src=p.url;img.alt='Foto '+(i+1);img.loading='lazy';const label=document.createElement('span');label.textContent='Foto '+(i+1);b.append(img,label);b.onclick=()=>{clearFile();choice={mode:'gallery',key:p.key};refresh()};grid.append(b)});
 if(!photos.length)grid.textContent='Nenhuma foto disponível na galeria.';
 fileInput.onchange=()=>{const f=fileInput.files[0];if(!f)return;if(!['image/jpeg','image/png','image/webp','image/avif','image/gif'].includes(f.type)||f.size>30*1024*1024){clearFile();error.textContent='Selecione uma imagem válida de até 30 MB.';error.hidden=false;refresh();return}if(objectUrl)URL.revokeObjectURL(objectUrl);file=f;objectUrl=URL.createObjectURL(f);error.hidden=true;refresh()};
 $('[data-default]',dialog).onclick=()=>{clearFile();choice=null;refresh()};
 $('[data-cancel]',dialog).onclick=()=>dialog.close();
 dialog.addEventListener('cancel',e=>{if(busy)e.preventDefault()});
 dialog.addEventListener('close',()=>{clearFile();dialog.remove()},{once:true});
 form.onsubmit=async event=>{
  event.preventDefault();
  if(busy)return;
  const section=sectionInput.value;
  busy=true;error.hidden=true;const controls=[...form.elements];controls.forEach(el=>el.disabled=true);save.textContent='Salvando…';
  try{
   const user=auth.currentUser;await requirePhotoAdmin(user);
   if(file){choice={mode:'upload',url:await upload(file,kind,id,n=>{$('[role=status]',dialog).textContent='Enviando imagem… '+n+'%'})};clearFile();refresh()}
   await saveProjectPresentation(kind,id,{cover:choice,section,order:details.order,position},user);
   dialog.close();await onSaved?.();
  }catch(e){$('[role=status]',dialog).textContent='';error.textContent=e.message||'Não foi possível salvar o portfólio.';error.hidden=false}
  finally{busy=false;controls.forEach(el=>el.disabled=false);save.textContent='Salvar portfólio e capa'}
 };
 document.body.append(dialog);refresh();paintFormat();paintPosition();dialog.showModal();
}
