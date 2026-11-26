// Registration checkpoints are deliberately unpublished until final confirmation.
// Browser-local queue contains pending files, never credentials.
export function imageRecord(image,index,title){
 return {id:image.id,url:image.url,storagePath:image.storagePath||'',alt:image.alt||title+' — imagem '+(index+1),order:index};
}
export function completedImages(queue,title){
 return queue.filter(i=>i.url).map((i,index)=>imageRecord(i,index,title));
}
export function sameImages(a,b){
 return Array.isArray(a)&&a.length===b.length&&b.every((i,n)=>a[n]?.id===i.id&&a[n]?.url===i.url);
}
export async function registerProject({queue,metadata,existing,write,read,upload,persist,stage,paused}){
 // Keep an already published project untouched until all edits succeed.
 const incremental=!existing||existing.published===false;
 const verify=async payload=>{
  await write(payload);
  const actual=await read();
  if(!actual||actual.title!==payload.title||actual.published!==payload.published||!sameImages(actual.images,payload.images))throw Error('O banco não confirmou o salvamento. Tente novamente.');
  return actual;
 };
 const payload=(published)=>{const images=completedImages(queue,metadata.title);return {...metadata,published,images,coverUrl:images[0]?.url||'',coverAlt:images[0]?.alt||metadata.title}};
 await persist();
 if(incremental){stage('draft');await verify(payload(false))}
 for(let i=0;i<queue.length;i++){
  if(paused())return {paused:true};
  const image=queue[i];
  if(image.url)continue;
  if(!image.file)throw Error('Selecione novamente a imagem pendente.');
  stage('optimize',i);
  const result=await upload(image,i,phase=>stage(phase,i));
  if(!result?.url)throw Error('O envio não retornou o endereço da imagem.');
  Object.assign(image,{url:result.url,storagePath:result.storagePath||'',isNew:false});
  await persist();
  stage('checkpoint',i);
  if(incremental)await verify(payload(false));
  stage('complete',i);
 }
 if(paused())return {paused:true};
 stage('final');
 const saved=await verify(payload(metadata.published));
 return {saved};
}
