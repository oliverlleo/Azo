import { supabase } from '../assets/js/supabase-config.js';
import { createFloorPlanEditor } from './obra-floorplan.js';

const BUCKET='azo-media';
let mountedSlug='';
let editor=null;
let record=null;
let pendingPlan=null;
let pendingDeletes=[];
let mounting=false;
let dirty=false;

function ensureStyle(){
  if(document.querySelector('link[data-azo-floorplan-style]'))return;
  const link=document.createElement('link');
  link.rel='stylesheet';
  link.href=new URL('./obra-floorplan.css?v=20260810-1740',import.meta.url).href;
  link.dataset.azoFloorplanStyle='1';
  document.head.appendChild(link);
}

function slug(){return document.querySelector('#obra-slug')?.value?.trim().toLowerCase()||'';}
function mediaPanel(){return document.querySelector('[data-obra-panel="midia"]');}
function ownsPath(path){return Boolean(record?.id&&String(path||'').startsWith(`obras/${record.id}/floorplan/`));}
function setState(text,type=''){
  const el=document.querySelector('#obra-floorplan-save-state');
  if(!el)return;
  el.textContent=text;
  el.dataset.state=type;
}

async function flushDeletes(){
  const paths=[...new Set(pendingDeletes)].filter(ownsPath);
  pendingDeletes=[];
  if(!paths.length)return;
  const {error}=await supabase.storage.from(BUCKET).remove(paths);
  if(error)console.warn('[AZO Planta] Planta salva, mas alguns arquivos antigos não foram removidos.',error);
}

async function save({silent=false}={}){
  if(!record?.id||!pendingPlan)return true;
  const button=document.querySelector('#obra-floorplan-save');
  if(button)button.disabled=true;
  setState('Salvando…');
  const {error}=await supabase.from('obras').update({interactive_plan:pendingPlan,updated_at:new Date().toISOString()}).eq('id',record.id);
  if(error){
    setState('Erro ao salvar','error');
    if(button)button.disabled=false;
    if(!silent)alert(error.message||'Não foi possível salvar a planta.');
    else console.error('[AZO Planta] Não foi possível salvar antes de trocar de obra.',error);
    return false;
  }
  await flushDeletes();
  record.interactive_plan=structuredClone(pendingPlan);
  dirty=false;
  setState('Planta salva','ok');
  if(button)button.disabled=false;
  return true;
}

function renderShell(message=''){
  const panel=mediaPanel();
  if(!panel)return null;
  let shell=panel.querySelector('#obra-floorplan-card');
  if(!shell){
    shell=document.createElement('section');
    shell.id='obra-floorplan-card';
    shell.className='obra-form-card';
    panel.appendChild(shell);
  }
  shell.innerHTML=message?`<div class="fp-editor-head"><div><strong>Planta interativa</strong><small>${message}</small></div></div>`:`<div id="obra-floorplan-editor"></div><div class="fp-savebar"><span id="obra-floorplan-save-state">${dirty?'Alterações não salvas':'Sem alterações'}</span><button type="button" class="btn btn-primary" id="obra-floorplan-save">Salvar planta</button></div>`;
  if(dirty)setState('Alterações não salvas','dirty');
  return shell;
}

function mountEditor(){
  renderShell();
  const root=document.querySelector('#obra-floorplan-editor');
  editor=createFloorPlanEditor({
    root,
    value:pendingPlan,
    obraId:record.id,
    supabase,
    bucket:BUCKET,
    onChange(value){pendingPlan=value;dirty=true;setState('Alterações não salvas','dirty');},
    onDeletePath(path){if(ownsPath(path))pendingDeletes.push(path);}
  });
  document.querySelector('#obra-floorplan-save')?.addEventListener('click',()=>save());
}

async function mount(force=false){
  ensureStyle();
  const panel=mediaPanel();
  if(!panel||!document.querySelector('#obras-editor.open'))return;
  const currentSlug=slug();
  if(!currentSlug){editor?.destroy?.();editor=null;mountedSlug='';record=null;pendingPlan=null;dirty=false;renderShell('Defina o slug e salve a obra antes de configurar a planta.');return;}
  if(!force&&currentSlug===mountedSlug&&panel.querySelector('#obra-floorplan-card'))return;
  if(mounting)return;
  mounting=true;
  try{
    editor?.destroy?.();editor=null;

    if(currentSlug===mountedSlug&&record?.id&&pendingPlan){
      mountEditor();
      return;
    }

    if(dirty&&mountedSlug&&currentSlug!==mountedSlug){
      const saved=await save({silent:true});
      if(!saved){renderShell('Não foi possível salvar a planta anterior. Tente novamente antes de trocar de obra.');return;}
    }

    mountedSlug=currentSlug;
    record=null;
    pendingPlan=null;
    pendingDeletes=[];
    dirty=false;
    renderShell('Carregando o editor da planta…');
    const {data,error}=await supabase.from('obras').select('id,slug,interactive_plan').eq('slug',currentSlug).maybeSingle();
    if(error)throw error;
    if(!data){renderShell('Salve a obra primeiro. Depois volte em Mídia para desenhar as áreas da planta.');return;}
    record=data;
    pendingPlan=data.interactive_plan||{enabled:false,imageUrl:'',storagePath:'',alt:'',hotspots:[]};
    mountEditor();
  }catch(error){console.error('[AZO Planta]',error);renderShell('Não foi possível carregar a planta interativa agora.');}
  finally{mounting=false;}
}

const observer=new MutationObserver(()=>{
  if(mediaPanel()&&document.querySelector('#obras-editor.open'))queueMicrotask(()=>mount());
});
observer.observe(document.documentElement,{childList:true,subtree:true});

document.addEventListener('click',event=>{
  if(event.target.closest('[data-obra-tab="midia"]'))setTimeout(()=>mount(true),0);
  if(event.target.closest('[data-edit-obra]')||event.target.closest('#new-obra'))setTimeout(()=>mount(true),80);
});
document.addEventListener('input',event=>{if(event.target?.id==='obra-slug')setTimeout(()=>mount(true),120);});

ensureStyle();
setTimeout(()=>mount(),0);
