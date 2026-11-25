import {supabase,supabaseConfig,db,doc,getDoc,setDoc,serverTimestamp} from './firebase-config.js';
import {requirePhotoAdmin} from './project-photo-store.js';
import {COVER_PREFIX,coverId,parseCover} from './project-cover.mjs';
export const coverOrigin=new URL(supabaseConfig.url).origin;
export async function readProjectCovers(){
 const result=new Map();
 for(let offset=0;;offset+=100){
  const {data,error}=await supabase.from('site_pages').select('id,items').like('id',COVER_PREFIX+'%').order('id').range(offset,offset+99);
  if(error)throw error;
  for(const row of data||[]){const value=parseCover(row,coverOrigin);if(value)result.set(row.id,value)}
  if(!data||data.length<100)break;
 }
 return result;
}
export async function saveProjectCover(kind,id,value,user){
 const uid=await requirePhotoAdmin(user),key=coverId(kind,id),target=doc(db,'sitePages',key);
 const items=value?[{key:'cover',type:'project-cover',value}]:[];
 const expected=parseCover({items},coverOrigin);
 if(value&&!expected)throw Error('Capa inválida.');
 await setDoc(target,{page:key,items,updatedAt:serverTimestamp(),updatedBy:uid});
 const saved=await getDoc(target),actual=parseCover(saved.exists()?saved.data():null,coverOrigin);
 if(!saved.exists()||JSON.stringify(expected)!==JSON.stringify(actual))throw Error('Não foi possível confirmar a gravação da capa.');
 return actual;
}
