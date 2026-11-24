import { supabase, db, doc, getDoc, setDoc, serverTimestamp } from './firebase-config.js';
import { projectPhotoPath, photoRecordId, hiddenProjectPhotos, VISIBILITY_PREFIX } from './project-photo-visibility.mjs';

// Use the existing protected CMS table. Each photograph has its own row,
// so editing texts or another photograph cannot overwrite its visibility.
export async function readProjectPhotoVisibility() {
  const {data,error} = await supabase.from('site_pages').select('id,items').like('id', VISIBILITY_PREFIX+'%');
  if (error) throw error;
  return hiddenProjectPhotos(data);
}
export async function setProjectPhotoHidden(path, hidden, user) {
  const canonical = projectPhotoPath(path);
  const id = photoRecordId(canonical);
  const uid = user?.id || user?.uid;
  if (!id || !uid || typeof hidden !== 'boolean') throw new Error('Operação inválida.');
  const admin = await getDoc(doc(db,'admins',uid));
  if (!admin.exists() || admin.data().active !== true) throw new Error('Acesso administrativo necessário.');
  const target = doc(db,'sitePages',id);
  const item = {key:canonical,type:'project-photo-visibility',value:hidden};
  await setDoc(target,{page:id,items:[item],updatedAt:serverTimestamp(),updatedBy:uid});
  const saved = await getDoc(target);
  if (!saved.exists() || !saved.data().items?.some(entry=>entry.key===canonical && entry.type===item.type && entry.value===hidden)) {
    throw new Error('Não foi possível confirmar a alteração no banco.');
  }
}
