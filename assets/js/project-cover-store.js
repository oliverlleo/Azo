import {supabase,supabaseConfig,db,doc,getDoc,setDoc,serverTimestamp} from './firebase-config.js';
import {requirePhotoAdmin} from './project-photo-store.js';
import {COVER_PREFIX,coverId,parseProjectPresentation} from './project-cover.mjs';
export const coverOrigin=new URL(supabaseConfig.url).origin;
let pendingRead;
export function readProjectPresentation(){
 if(!pendingRead)pendingRead=readAll().finally(()=>{pendingRead=null});
 return pendingRead;
}
async function readAll(){
 const result=new Map();
 for(let offset=0;;offset+=100){
  const {data,error}=await supabase.from('site_pages').select('id,items').like('id',COVER_PREFIX+'%').order('id').range(offset,offset+99);
  if(error)throw error;
  for(const row of data||[]){const value=parseProjectPresentation(row,coverOrigin);if(value)result.set(row.id,value)}
  if(!data||data.length<100)break;
 }
 return result;
}
export async function saveProjectPresentation(kind,id,{cover,...value},user){
 const uid=await requirePhotoAdmin(user),key=coverId(kind,id),target=doc(db,'sitePages',key);
 const items=[{key:'presentation',type:'project-presentation',value}];
 if(cover)items.push({key:'cover',type:'project-cover',value:cover});
 const expected=parseProjectPresentation({items},coverOrigin);
 if((cover&&!expected.cover)||expected.section!==value.section||expected.order!==value.order||(value.position!==null&&!expected.position)){
  throw Error('Configuração de portfólio inválida.');
 }
 await setDoc(target,{page:key,items,updatedAt:serverTimestamp(),updatedBy:uid});
 const saved=await getDoc(target),actual=parseProjectPresentation(saved.exists()?saved.data():null,coverOrigin);
 if(!saved.exists()||JSON.stringify(expected)!==JSON.stringify(actual))throw Error('Não foi possível confirmar a gravação do portfólio.');
 return actual;
}
