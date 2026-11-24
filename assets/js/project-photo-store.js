import { supabase, supabaseConfig, db, doc, getDoc, setDoc, serverTimestamp } from './firebase-config.js';
import { projectPhotoPath, photoRecordId, hiddenProjectPhotos, addedProjectPhotos, isAddedPhoto, VISIBILITY_PREFIX } from './project-photo-visibility.mjs';

export async function readProjectPhotoVisibility() {
  // Paginate to preserve all records as the galleries grow.
  const rows=[];
  for(let offset=0;;offset+=100){
    const {data,error}=await supabase.from('site_pages').select('id,items').like('id',VISIBILITY_PREFIX+'%').order('id').range(offset,offset+99);
    if(error)throw error;
    rows.push(...(data||[]));
    if(!data||data.length<100)break;
  }
  return {hidden:hiddenProjectPhotos(rows),additions:addedProjectPhotos(rows,new URL(supabaseConfig.url).origin)};
}
export async function requirePhotoAdmin(user) {
  const uid=user?.id||user?.uid;
  if(!uid)throw new Error('Acesso administrativo necessário.');
  const admin=await getDoc(doc(db,'admins',uid));
  if(!admin.exists()||admin.data().active!==true)throw new Error('Acesso administrativo necessário.');
  return uid;
}
async function writeRecord(path,items,uid) {
  const id=photoRecordId(path),target=doc(db,'sitePages',id);
  await setDoc(target,{page:id,items,updatedAt:serverTimestamp(),updatedBy:uid});
  const saved=await getDoc(target);
  if(!saved.exists()||!items.every(item=>saved.data().items?.some(entry=>entry.key===item.key&&entry.type===item.type&&entry.value===item.value&&entry.url===item.url)))throw new Error('Não foi possível confirmar a alteração no banco.');
}
export async function setProjectPhotoHidden(path,hidden,user) {
  const canonical=projectPhotoPath(path),id=photoRecordId(canonical);
  if(!id||typeof hidden!=='boolean')throw new Error('Operação inválida.');
  const uid=await requirePhotoAdmin(user);
  const prior=await getDoc(doc(db,'sitePages',id));
  const items=prior.exists()&&Array.isArray(prior.data().items)?prior.data().items:[];
  if(isAddedPhoto(canonical)&&!items.some(i=>i.key===canonical&&i.type==='project-photo-added'))throw new Error('Foto não encontrada.');
  await writeRecord(canonical,[...items.filter(i=>i.type!=='project-photo-visibility'),{key:canonical,type:'project-photo-visibility',value:hidden}],uid);
}
export async function addProjectPhoto(path,uploaded,user) {
  const canonical=projectPhotoPath(path);
  if(!isAddedPhoto(canonical))throw new Error('Identificador inválido.');
  const uid=await requirePhotoAdmin(user);
  const item={key:canonical,type:'project-photo-added',url:uploaded.url,name:uploaded.fileName||'Foto adicionada',createdAt:new Date().toISOString()};
  if(!addedProjectPhotos([{id:photoRecordId(canonical),items:[item]}],new URL(supabaseConfig.url).origin).has(canonical))throw new Error('URL de armazenamento inválida.');
  await writeRecord(canonical,[item],uid);
}
