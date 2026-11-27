import {auth,db,collection,getDocs} from '../assets/js/firebase-config.js';
import {BUILTIN_PROJECTS,PORTFOLIO_SECTIONS,chooseCover,coverId,portfolioDetails,sortPortfolioProjects} from '../assets/js/project-cover.mjs';
import {readPortfolioOrders,savePortfolioOrders} from '../assets/js/project-order-store.js';
import {builtinCoverPhotos,customCoverPhotos,loadCoverContext} from './project-cover-editor.js?v=20261127-order';

const dialog=document.querySelector('#project-order-dialog');
const form=dialog.querySelector('form');
const category=form.elements.section;
const list=form.querySelector('ol');
const status=form.querySelector('[data-order-status]');
const error=form.querySelector('[data-order-error]');
const cancel=form.querySelector('[data-order-cancel]');
const save=form.querySelector('[type=submit]');
let saved=new Map(), drafts=new Map(), catalog=new Map();
let saving=false, generation=0, dragging=null;

async function loadCatalog(){
  const [originals,custom,context,orders]=await Promise.all([
    getDocs(collection(db,'projectSettings')),
    getDocs(collection(db,'projects')),
    loadCoverContext(),
    readPortfolioOrders()
  ]);
  const overrides=new Map(originals.docs.map(item=>[item.data().builtinKey,item.data()]));
  const projects=[];
  for(const base of BUILTIN_PROJECTS){
    const project={...base,...overrides.get(base.key)};
    if(project.published===false)continue;
    const photos=await builtinCoverPhotos(base.key,context.visibility,context.assets);
    if(!photos.length)continue;
    const id=coverId('builtin',base.key),setting=context.covers.get(id);
    const cover=chooseCover(setting?.cover,photos).url;
    projects.push({id,title:project.title,cover,...portfolioDetails(setting,project.order??base.order)});
  }
  for(const item of custom.docs){
    const project=item.data();
    if(project.published===false||!project.title||!project.images?.length)continue;
    const id=coverId('custom',item.id),setting=context.covers.get(id);
    const cover=chooseCover(setting?.cover,customCoverPhotos(project),project.coverUrl||project.images[0]?.url).url;
    if(cover)projects.push({id,title:project.title,cover,...portfolioDetails(setting,project.order)});
  }
  return {projects,orders};
}

function changedOrders(){
  return new Map([...drafts].filter(([section,ids])=>ids.some((id,index)=>id!==saved.get(section)[index])));
}

function showError(message){
  error.textContent=message;
  error.hidden=!message;
}

function renderOrder(focusId,moveDirection){
  const ids=drafts.get(category.value)||[];
  const rows=ids.map((id,index)=>{
    const {title,cover,position}=catalog.get(id);
    const row=document.createElement('li');
    row.dataset.projectKey=id;
    row.draggable=!saving;
    const image=document.createElement('img');
    image.src=cover;
    image.alt='';
    image.draggable=false;
    image.loading='lazy';
    if(position)image.style.objectPosition=position.map(value=>`${value}%`).join(' ');
    const info=document.createElement('div');
    const name=document.createElement('strong');
    name.textContent=title;
    const placement=document.createElement('small');
    placement.textContent=index<2?'Destaque lado a lado':index===2?'Destaque panorâmico':'Carrossel';
    info.append(name,placement);
    const actions=document.createElement('div');
    actions.className='project-order-actions';
    for(const [step,arrow,label] of [[-1,'↑','Subir'],[1,'↓','Descer']]){
      const button=document.createElement('button');
      button.type='button';
      button.className='icon-button';
      button.dataset.step=step;
      button.textContent=arrow;
      button.setAttribute('aria-label',`${label} ${title}`);
      button.disabled=saving||index+step<0||index+step>=ids.length;
      button.addEventListener('click',()=>moveProject(id,index+step,step));
      actions.append(button);
    }
    row.append(image,info,actions);
    return row;
  });
  list.replaceChildren(...rows);
  const dirty=changedOrders().size>0;
  save.disabled=saving||!dirty;
  cancel.textContent=dirty?'Cancelar':'Fechar';
  if(focusId){
    const row=rows.find(row=>row.dataset.projectKey===focusId);
    const preferred=row?.querySelector(`[data-step="${moveDirection}"]:not(:disabled)`);
    (preferred||row?.querySelector('button:not(:disabled)'))?.focus({preventScroll:true});
    row?.scrollIntoView({block:'nearest'});
  }
}

function moveProject(id,to,step){
  const ids=drafts.get(category.value);
  const from=ids?.indexOf(id)??-1;
  if(saving||from<0||to<0||to>=ids.length||from===to)return;
  ids.splice(from,1);
  ids.splice(to,0,id);
  renderOrder(id,step);
  status.textContent=`${catalog.get(id).title} está na posição ${to+1}.`;
}

document.querySelector('#open-project-order').addEventListener('click',async()=>{
  const token=++generation;
  category.value=PORTFOLIO_SECTIONS[0];
  category.disabled=true;
  list.replaceChildren();
  save.disabled=true;
  cancel.textContent='Fechar';
  showError('');
  status.textContent='Carregando projetos…';
  dialog.showModal();
  try{
    const {projects,orders}=await loadCatalog();
    if(token!==generation)return;
    catalog=new Map(projects.map(project=>[project.id,project]));
    saved=new Map(PORTFOLIO_SECTIONS.map(section=>[
      section,
      sortPortfolioProjects(projects.filter(project=>project.section===section),orders.get(section)).map(project=>project.id)
    ]));
    drafts=new Map([...saved].map(([section,ids])=>[section,[...ids]]));
    category.disabled=false;
    updateCategory();
  }catch(err){
    if(token!==generation)return;
    status.textContent='';
    showError(err.message||'Não foi possível carregar os projetos.');
  }
});

function updateCategory(){
  renderOrder();
  status.textContent=drafts.get(category.value).length?'':'Nenhum projeto publicado nesta categoria.';
}
category.addEventListener('change',updateCategory);
cancel.addEventListener('click',()=>dialog.close());
dialog.addEventListener('close',()=>{generation++;dragging=null;});
dialog.addEventListener('cancel',event=>{if(saving)event.preventDefault();});
list.addEventListener('dragstart',event=>{
  const row=event.target.closest('[data-project-key]');
  if(!row||saving)return;
  dragging=row.dataset.projectKey;
  event.dataTransfer.setData('text/plain',dragging);
  event.dataTransfer.effectAllowed='move';
});
list.addEventListener('dragend',()=>{dragging=null;});
list.addEventListener('dragover',event=>{
  if(!dragging||!event.target.closest('[data-project-key]'))return;
  event.preventDefault();
  event.dataTransfer.dropEffect='move';
});
list.addEventListener('drop',event=>{
  const row=event.target.closest('[data-project-key]');
  if(!dragging||!row)return;
  event.preventDefault();
  const ids=drafts.get(category.value);
  const to=ids.indexOf(row.dataset.projectKey);
  moveProject(dragging,to,Math.sign(to-ids.indexOf(dragging)));
  dragging=null;
});

form.addEventListener('submit',async event=>{
  event.preventDefault();
  if(saving)return;
  const entries=changedOrders();
  if(!entries.size)return;
  saving=true;
  category.disabled=cancel.disabled=true;
  showError('');
  status.textContent='Salvando ordem…';
  renderOrder();
  try{
    await savePortfolioOrders(entries,auth.currentUser);
    saved=new Map([...drafts].map(([section,ids])=>[section,[...ids]]));
    status.textContent='Ordem salva no portfólio.';
  }catch(err){
    status.textContent='';
    showError(err.message||'Não foi possível salvar a ordem.');
  }finally{
    saving=false;
    category.disabled=cancel.disabled=false;
    renderOrder();
  }
});
