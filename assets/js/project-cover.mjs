// Independent cover records avoid changing gallery order or project metadata.
export const COVER_PREFIX='azo-project-cover-';
export function coverId(kind,id){
 if(!['builtin','custom'].includes(kind)||typeof id!=='string'||!/^[a-zA-Z0-9_-]{1,100}$/.test(id))throw Error('Projeto inválido.');
 return COVER_PREFIX+kind+'-'+id;
}
export function safeCoverURL(value,origin){
 try{const u=new URL(value);return u.origin===origin&&u.pathname.startsWith('/storage/v1/object/public/azo-media/site/assets/project-covers/')?u.href:''}catch{return ''}
}
export function parseCover(row,origin){
 const item=Array.isArray(row?.items)?row.items.find(i=>i.key==='cover'&&i.type==='project-cover'):null;
 const v=item?.value;
 if(v?.mode==='gallery'&&typeof v.key==='string'&&v.key.length<=512)return {mode:'gallery',key:v.key};
 if(v?.mode==='upload'){const url=safeCoverURL(v.url,origin);if(url)return {mode:'upload',url}}
 return null;
}
export function chooseCover(setting,photos,fallback=''){
 if(setting?.mode==='upload')return {url:setting.url,selected:true};
 if(setting?.mode==='gallery'){const photo=photos.find(p=>p.key===setting.key);if(photo)return {...photo,selected:true}}
 return {url:fallback||photos[0]?.url||'',selected:false};
}
