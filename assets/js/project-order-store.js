import {supabase} from './firebase-config.js';
import {requirePhotoAdmin} from './project-photo-store.js';
import {COVER_PREFIX,PORTFOLIO_SECTIONS} from './project-cover.mjs';

const prefix='azo-project-order-';
const projectId=new RegExp(`^${COVER_PREFIX}(?:builtin|custom)-[a-zA-Z0-9_-]{1,100}$`);
let pendingRead;

function orderIds(ids){
  return Array.isArray(ids)?[...new Set(ids.filter(id=>typeof id==='string'&&projectId.test(id)))]:[];
}

async function readOrders(){
  const {data,error}=await supabase.from('site_pages').select('id,items').in('id',PORTFOLIO_SECTIONS.map(section=>prefix+section));
  if(error)throw error;
  const rows=new Map((data||[]).map(row=>[row.id,row.items]));
  return new Map(PORTFOLIO_SECTIONS.map(section=>{
    const items=rows.get(prefix+section);
    const item=Array.isArray(items)?items.find(item=>item?.key==='order'&&item.type==='project-order'):null;
    return [section,orderIds(item?.value)];
  }));
}

export function readPortfolioOrders(){
  pendingRead??=readOrders().finally(()=>{pendingRead=null});
  return pendingRead;
}

export async function savePortfolioOrders(orders,user){
  const uid=await requirePhotoAdmin(user);
  const updatedAt=new Date().toISOString();
  const rows=[...orders].map(([section,ids])=>{
    if(!PORTFOLIO_SECTIONS.includes(section)||!Array.isArray(ids)||orderIds(ids).length!==ids.length){
      throw Error('A ordem dos projetos é inválida.');
    }
    const id=prefix+section;
    return {id,page:id,items:[{key:'order',type:'project-order',value:ids}],updated_by:uid,updated_at:updatedAt};
  });
  if(!rows.length)return;
  const {error}=await supabase.from('site_pages').upsert(rows,{onConflict:'id'});
  if(error)throw error;
  const saved=await readOrders();
  for(const [section,ids] of orders){
    const actual=saved.get(section);
    if(actual.length!==ids.length||actual.some((id,index)=>id!==ids[index])){
      throw Error('O site não confirmou a nova ordem. Reabra a lista para conferir.');
    }
  }
}
