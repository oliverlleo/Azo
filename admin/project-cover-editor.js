import {auth,db,collection,getDocs,storage,ref,uploadBytesResumable,getDownloadURL} from '../assets/js/firebase-config.js';
import {readProjectPhotoVisibility,requirePhotoAdmin} from '../assets/js/project-photo-store.js';
import {visibleProjectPhotos} from '../assets/js/project-photo-visibility.mjs';
import {readProjectCovers,saveProjectCover} from '../assets/js/project-cover-store.js';
import {coverId,chooseCover} from '../assets/js/project-cover.mjs';
const $=(s,r=document)=>r.querySelector(s);
export async function builtinCoverPhotos(key,visibility,assets){
 return visibleProjectPhotos(key,visibility.hidden,visibility.additions).map(path=>({key:path,url:visibility.additions.get(path)?.url||assets.get(path)||'../'+path}));
}
export function customCoverPhotos(project){return (project.images||[]).filter(i=>i?.url).map(i=>({key:i.url,url:i.url}))}
export async function loadCoverContext(){
 const [covers,visibility,snap]=await Promise.all([readProjectCovers(),readProjectPhotoVisibility(),getDocs(collection(db,'assets'))]);
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
style.textContent='.azo-cover-dialog{width:min(760px,calc(100% - 24px));max-height:90dvh;overflow:auto;padding:24px;border:1px solid var(--line);border-radius:24px;background:#fff;color:var(--ink);box-shadow:0 24px 80px #071b1f44}.azo-cover-dialog::backdrop{background:#071b1f99}.azo-cover-dialog h2{font:400 2rem Georgia,serif;margin:8px 0}.azo-cover-dialog p{font-size:.8rem;color:var(--muted);line-height:1.5}.azo-cover-current{display:grid;grid-template-columns:140px 1fr;gap:14px;align-items:center;padding:10px;background:var(--paper);border-radius:14px;margin:14px 0}.azo-cover-current img{width:100%;aspect-ratio:1.2;object-fit:cover;border-radius:10px}.azo-cover-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(115px,1fr));gap:10px;max-height:300px;overflow:auto;padding:3px}.azo-cover-choice{display:grid;gap:6px;min-width:0;padding:5px;border:1px solid var(--line);border-radius:12px;background:white;cursor:pointer;color:var(--ink);font-size:.72rem;text-align:center}.azo-cover-choice[aria-pressed=true]{outline:2px solid var(--ink);background:#edf3f1}.azo-cover-choice img{width:100%;aspect-ratio:1.2;object-fit:cover;border-radius:8px}.azo-cover-upload{display:grid;gap:8px;border:1px dashed var(--line);padding:12px;border-radius:12px;margin:14px 0;font-size:.78rem}.azo-cover-dialog footer{display:flex;justify-content:flex-end;flex-wrap:wrap;gap:8px;margin-top:14px}.azo-cover-dialog [role=alert]{color:var(--danger)}.azo-cover-dialog [hidden]{display:none!important}@media(max-width:500px){.azo-cover-dialog{padding:16px}.azo-cover-current{grid-template-columns:100px 1fr}.azo-cover-dialog footer .btn{flex:1}}';
document.head.append(style);
export async function openCoverEditor({kind,id,title,photos,setting,fallback,onSaved}){
 if($('#azo-cover-dialog'))return;
 try{await requirePhotoAdmin(auth.currentUser)}catch(e){alert(e.message);return}
 const dialog=document.createElement('dialog');dialog.id='azo-cover-dialog';dialog.className='azo-cover-dialog';dialog.setAttribute('aria-labelledby','azo-cover-title');
 dialog.innerHTML='<p class="eyebrow">Portfólio · imagem de capa</p><h2 id="azo-cover-title"></h2><p>Escolha a foto que aparece no cartão deste projeto. A galeria e a ordem das fotos não serão alteradas.</p><div class="azo-cover-current"><img alt="Prévia da capa"><div><b>Prévia da capa</b><p data-cover-status></p></div></div><p><b>Selecionar uma foto do projeto</b></p><div class="azo-cover-grid"></div><label class="azo-cover-upload"><b>Ou enviar uma nova capa</b><span>Imagem exclusiva da capa, até 30 MB.</span><input type="file" accept="image/jpeg,image/png,image/webp,image/avif,image/gif"></label><p role="status"></p><p role="alert" hidden></p><footer><button class="btn btn-ghost" type="button" data-default>Usar capa padrão</button><button class="btn btn-ghost" type="button" data-cancel>Cancelar</button><button class="btn btn-primary" type="button" data-save>Salvar capa</button></footer>';
 $('#azo-cover-title',dialog).textContent=title||'Editar capa';
 const grid=$('.azo-cover-grid',dialog),preview=$('.azo-cover-current img',dialog),fileInput=$('input',dialog),save=$('[data-save]',dialog),error=$('[role=alert]',dialog);
 let choice=setting||null,file=null,objectUrl='',busy=false;
 function refresh(){
  const resolved=chooseCover(choice,photos,fallback);preview.src=file?objectUrl:resolved.url||'';preview.hidden=!file&&!resolved.url;
  $('[data-cover-status]',dialog).textContent=file?'Nova imagem selecionada':resolved.selected?'Capa personalizada':'Capa padrão do projeto';
  for(const b of grid.querySelectorAll('button'))b.setAttribute('aria-pressed',String(!file&&choice?.mode==='gallery'&&choice.key===b.dataset.key));
 }
 function clearFile(){file=null;fileInput.value='';if(objectUrl)URL.revokeObjectURL(objectUrl);objectUrl=''}
 photos.forEach((p,i)=>{const b=document.createElement('button');b.type='button';b.className='azo-cover-choice';b.dataset.key=p.key;const img=document.createElement('img');img.src=p.url;img.alt='Foto '+(i+1);img.loading='lazy';const label=document.createElement('span');label.textContent='Foto '+(i+1);b.append(img,label);b.onclick=()=>{clearFile();choice={mode:'gallery',key:p.key};refresh()};grid.append(b)});
 if(!photos.length)grid.textContent='Nenhuma foto disponível na galeria.';
 fileInput.onchange=()=>{const f=fileInput.files[0];if(!f)return;if(!['image/jpeg','image/png','image/webp','image/avif','image/gif'].includes(f.type)||f.size>30*1024*1024){clearFile();error.textContent='Selecione uma imagem válida de até 30 MB.';error.hidden=false;refresh();return}if(objectUrl)URL.revokeObjectURL(objectUrl);file=f;objectUrl=URL.createObjectURL(f);error.hidden=true;refresh()};
 $('[data-default]',dialog).onclick=()=>{clearFile();choice=null;refresh()};
 $('[data-cancel]',dialog).onclick=()=>dialog.close();
 dialog.addEventListener('cancel',e=>{if(busy)e.preventDefault()});
 dialog.addEventListener('close',()=>{clearFile();dialog.remove()},{once:true});
 save.onclick=async()=>{
  if(busy)return;busy=true;error.hidden=true;const controls=[...dialog.querySelectorAll('button,input')];controls.forEach(el=>el.disabled=true);save.textContent='Salvando…';
  try{
   const user=auth.currentUser;await requirePhotoAdmin(user);
   let value=choice;
   if(file)value={mode:'upload',url:await upload(file,kind,id,n=>{$('[role=status]',dialog).textContent='Enviando imagem… '+n+'%'})};
   await saveProjectCover(kind,id,value,user);
   dialog.close();await onSaved?.();
  }catch(e){error.textContent=e.message||'Não foi possível salvar a capa.';error.hidden=false}
  finally{busy=false;controls.forEach(el=>el.disabled=false);save.textContent='Salvar capa'}
 };
 document.body.append(dialog);refresh();dialog.showModal();
}
