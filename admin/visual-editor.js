import { auth, db, storage } from '../assets/js/firebase-config.js';
import { doc, getDoc, setDoc, deleteDoc, serverTimestamp } from 'https://www.gstatic.com/firebasejs/12.16.0/firebase-firestore.js';
import { onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/12.16.0/firebase-auth.js';
import { ref, uploadBytesResumable, getDownloadURL, deleteObject } from 'https://www.gstatic.com/firebasejs/12.16.0/firebase-storage.js';
import { assetDocId } from '../assets/js/cms-core.js';

const $=(s,r=document)=>r.querySelector(s);
const $$=(s,r=document)=>[...r.querySelectorAll(s)];
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

const PAGES=[
 {id:'index',file:'index.html',label:'Página inicial'},
 {id:'servicos',file:'servicos.html',label:'Serviços'},
 {id:'projetos',file:'projetos.html',label:'Projetos'},
 {id:'sobre',file:'sobre.html',label:'Sobre a AZO'},
 {id:'contato',file:'contato.html',label:'Contato'},
 {id:'projeto-arquitetonico',file:'projeto-arquitetonico.html',label:'Projeto arquitetônico'},
 {id:'interiores',file:'interiores.html',label:'Interiores'},
 {id:'gestao-de-obras',file:'gestao-de-obras.html',label:'Gestão de obras'}
];
const BUILTINS={
 AS:{title:'Casa AS',category:'Arquitetura residencial'},HL:{title:'Casa HL',category:'Arquitetura residencial'},
 JT:{title:'Casa JT',category:'Projeto residencial'},MN:{title:'Casa MN',category:'Arquitetura + construção'},
 SE:{title:'Casa SE',category:'Projeto residencial'},EF:{title:'Casa EF',category:'Interiores + área de lazer'}
};
const IMAGE_NAMES={
 'assets/images/logo-azo.png':'Logo da AZO','assets/images/hero.webp':'Imagem de fundo do topo da página inicial',
 'assets/images/hero-sm.webp':'Imagem de fundo do topo da página inicial — celular','assets/images/about.webp':'Imagem da seção Sobre a AZO',
 'assets/images/about-sm.webp':'Imagem da seção Sobre a AZO — celular','assets/images/project-feature.webp':'Imagem de destaque da página Projetos',
 'assets/images/project-feature-sm.webp':'Imagem de destaque da página Projetos — celular','assets/images/service-architecture.webp':'Imagem do serviço Projeto arquitetônico',
 'assets/images/service-architecture-sm.webp':'Imagem do serviço Projeto arquitetônico — celular','assets/images/service-interiors.webp':'Imagem do serviço Interiores',
 'assets/images/service-interiors-sm.webp':'Imagem do serviço Interiores — celular','assets/images/service-build.webp':'Imagem do serviço Gestão de obras',
 'assets/images/service-build-sm.webp':'Imagem do serviço Gestão de obras — celular','assets/images/team.webp':'Foto da equipe','assets/images/team-sm.webp':'Foto da equipe — celular'
};
const state={user:null,page:PAGES[0],selected:null,frameReady:false,device:'desktop'};

function toast(message,type='success'){
 const stack=$('#toast-stack'); if(!stack)return alert(message);
 const el=document.createElement('div'); el.className=`toast ${type}`; el.innerHTML=`<b>${type==='error'?'!':'✓'}</b><span>${esc(message)}</span>`;
 stack.appendChild(el); setTimeout(()=>el.remove(),3600);
}
function injectAdminStyle(){
 if($('#azo-visual-admin-style'))return;
 const s=document.createElement('style'); s.id='azo-visual-admin-style'; s.textContent=`
 .visual-mode-choice{margin-top:18px}.visual-choice-grid{display:grid;grid-template-columns:1fr 1fr;gap:12px}.visual-choice{border:1px solid var(--line);background:var(--card);border-radius:20px;padding:20px;display:grid;grid-template-columns:48px 1fr auto;gap:14px;align-items:center;text-align:left;cursor:pointer}.visual-choice.recommended{background:#0d2f35;color:#fff;border-color:#0d2f35}.visual-choice>i{width:48px;height:48px;border-radius:14px;background:var(--ink);color:#fff;display:grid;place-items:center;font-style:normal}.visual-choice.recommended>i{background:var(--sand);color:var(--ink)}.visual-choice strong,.visual-choice small{display:block}.visual-choice small{margin-top:4px;color:var(--muted);line-height:1.45}.visual-choice.recommended small{color:rgba(255,255,255,.68)}
 .visual-toolbar{display:flex;align-items:end;gap:12px;position:sticky;top:126px;z-index:16}.visual-toolbar .field{min-width:240px}.visual-device{display:flex;gap:5px;border:1px solid var(--line);background:#fff;border-radius:999px;padding:4px}.visual-device button{border:0;background:transparent;border-radius:999px;padding:8px 12px;font-size:.68rem;font-weight:800;cursor:pointer;color:var(--muted)}.visual-device button.active{background:var(--ink);color:#fff}
 .visual-layout{display:grid;grid-template-columns:340px minmax(0,1fr);gap:16px;margin-top:16px;align-items:start}.visual-side{position:sticky;top:205px;min-height:420px}.visual-side h3{font-family:Georgia,'Times New Roman',serif;font-size:1.8rem;font-weight:400;letter-spacing:-.035em;margin:0 0 8px}.visual-side p{color:var(--muted);font-size:.78rem;line-height:1.6}.visual-location{display:inline-flex!important;background:#f1eee7;border-radius:999px;padding:7px 10px!important;color:#586364!important;font-size:.66rem!important;font-weight:800;margin:0 0 14px!important}.visual-editor-field{display:grid;gap:8px;margin-top:14px}.visual-editor-field label{font-size:.72rem;font-weight:800}.visual-editor-field textarea,.visual-editor-field input{width:100%;border:1px solid var(--line);border-radius:14px;padding:13px 14px;outline:none}.visual-editor-field textarea{min-height:130px;resize:vertical;line-height:1.5}.visual-actions{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:14px}.visual-actions .btn:only-child{grid-column:1/-1}.visual-image-preview{border-radius:16px;overflow:hidden;background:#ece9e2;aspect-ratio:1.35;margin-top:12px}.visual-image-preview img{width:100%;height:100%;object-fit:cover}.visual-warning{background:#fff5e8;border:1px solid #ead6ba;border-radius:14px;padding:12px;font-size:.72rem;line-height:1.5;color:#695846;margin-top:14px}
 .visual-canvas-shell{background:#d7d8d5;border-radius:24px;padding:18px;min-height:720px;overflow:auto;display:flex;justify-content:center}.visual-frame-wrap{width:100%;min-height:820px;background:#fff;border-radius:15px;overflow:hidden;box-shadow:0 24px 70px rgba(0,0,0,.16);transition:width .3s}.visual-frame-wrap[data-device='tablet']{width:820px}.visual-frame-wrap[data-device='mobile']{width:390px}.visual-frame{width:100%;height:820px;border:0;display:block;background:#fff}
 @media(max-width:1100px){.visual-layout{grid-template-columns:1fr}.visual-side{position:static}.visual-choice-grid{grid-template-columns:1fr}}@media(max-width:700px){.visual-toolbar{top:105px;align-items:stretch;flex-wrap:wrap}.visual-toolbar .field{min-width:100%}.visual-device{width:100%;justify-content:center}.visual-canvas-shell{padding:8px}.visual-frame-wrap[data-device='mobile']{width:100%}}
 `; document.head.appendChild(s);
}
function emptySide(){
 const side=$('#visual-side-panel'); if(!side)return;
 side.innerHTML=`<p class="eyebrow">Modo visual</p><h3>Clique no que deseja alterar.</h3><p>Neste modo os botões do site não navegam. O clique serve apenas para selecionar textos, botões e imagens.</p><div class="visual-warning"><b>Dica:</b> passe o mouse sobre o site. O item editável fica marcado antes de você clicar.</div>`;
}
function ensureUI(){
 if($('#view-visual'))return;
 injectAdminStyle();
 const sidebar=$('.sidebar-nav');
 if(sidebar&&!$('#visual-editor-nav')){
  const nav=document.createElement('button'); nav.className='nav-item'; nav.type='button'; nav.id='visual-editor-nav'; nav.innerHTML='<i>◫</i><span>Editar visualmente</span>';
  sidebar.insertBefore(nav,sidebar.children[1]||null); nav.addEventListener('click',openVisual);
 }
 const dash=$('#view-dashboard'),hero=dash?.querySelector('.hero-panel');
 if(hero&&!$('.visual-mode-choice')){
  const box=document.createElement('section'); box.className='panel visual-mode-choice'; box.innerHTML=`<div class="panel-head"><div><p class="eyebrow">Escolha como editar</p><h3>Use o modo que preferir.</h3></div></div><div class="visual-choice-grid"><button class="visual-choice recommended" type="button" data-vopen><i>◫</i><span><strong>Editar diretamente no site</strong><small>Clique no texto, botão ou imagem que quer mudar.</small></span><b>→</b></button><button class="visual-choice" type="button" data-copen><i>☷</i><span><strong>Modo completo</strong><small>Use as telas de textos, imagens e projetos.</small></span><b>→</b></button></div>`;
  hero.insertAdjacentElement('afterend',box); $('[data-vopen]',box).addEventListener('click',openVisual); $('[data-copen]',box).addEventListener('click',()=>document.querySelector('[data-view="content"]')?.click());
 }
 const workspace=$('.workspace'); if(!workspace)return;
 const view=document.createElement('div'); view.className='view'; view.id='view-visual'; view.innerHTML=`<div class="visual-toolbar panel slim"><div class="field"><label>Página do site</label><select id="visual-page-select">${PAGES.map(p=>`<option value="${p.id}">${esc(p.label)}</option>`).join('')}</select></div><div class="visual-device"><button type="button" class="active" data-device="desktop">Computador</button><button type="button" data-device="tablet">Tablet</button><button type="button" data-device="mobile">Celular</button></div><div style="flex:1"></div><button class="btn btn-ghost" type="button" id="visual-reload">Atualizar página</button></div><div class="visual-layout"><aside class="panel visual-side" id="visual-side-panel"></aside><div class="visual-canvas-shell"><div class="visual-frame-wrap" id="visual-frame-wrap" data-device="desktop"><iframe class="visual-frame" id="visual-frame" title="Site editável"></iframe></div></div></div>`;
 workspace.appendChild(view); emptySide();
 $('#visual-page-select').addEventListener('change',e=>{state.page=PAGES.find(p=>p.id===e.target.value)||PAGES[0];state.selected=null;emptySide();loadFrame();});
 $('#visual-reload').addEventListener('click',loadFrame); $$('[data-device]').forEach(b=>b.addEventListener('click',()=>setDevice(b.dataset.device))); $('#visual-frame').addEventListener('load',wireFrame);
 document.addEventListener('click',e=>{if(e.target.closest('.nav-item[data-view]'))$('#visual-editor-nav')?.classList.remove('active');},true);
}
function openVisual(){
 ensureUI(); $$('.view').forEach(v=>v.classList.toggle('active',v.id==='view-visual')); $$('.nav-item').forEach(b=>b.classList.remove('active')); $('#visual-editor-nav')?.classList.add('active');
 $('#view-kicker').textContent='Edição direta no site'; $('#view-title').textContent='Editar visualmente'; $('#app-shell')?.classList.remove('menu-open'); if(!state.frameReady)loadFrame();
}
function setDevice(device){state.device=device;$('#visual-frame-wrap')?.setAttribute('data-device',device);$$('[data-device]').forEach(b=>b.classList.toggle('active',b.dataset.device===device));}
function loadFrame(){const frame=$('#visual-frame');if(!frame)return;state.frameReady=false;frame.src=`../${state.page.file}?azoVisualEditor=1&v=${Date.now()}`;}

function elementPath(el,root){
 const parts=[]; let node=el; while(node&&node.nodeType===1){let part=node.tagName.toLowerCase(),parent=node.parentElement;if(parent){const same=[...parent.children].filter(c=>c.tagName===node.tagName);if(same.length>1)part+=`:nth-of-type(${same.indexOf(node)+1})`;}parts.unshift(part);if(node===root)break;node=parent;}return parts.join('>');
}
function directTextNode(el){
 const direct=[...el.childNodes].find(n=>n.nodeType===Node.TEXT_NODE&&n.nodeValue?.trim()); if(direct)return direct;
 const w=el.ownerDocument.createTreeWalker(el,NodeFilter.SHOW_TEXT,{acceptNode(n){if(!n.nodeValue?.trim()||n.parentElement?.closest('svg,script,style,noscript'))return NodeFilter.FILTER_REJECT;return NodeFilter.FILTER_ACCEPT;}}); return w.nextNode();
}
function textKey(node,doc){const parent=node?.parentElement;if(!parent)return'';const idx=[...parent.childNodes].filter(n=>n.nodeType===Node.TEXT_NODE).indexOf(node);return `text:${elementPath(parent,doc.body)}::${idx}`;}
function canonicalAsset(img){
 const src=img?.dataset?.cmsSource||img?.getAttribute('src')||''; if(src.startsWith('assets/'))return src;if(src.startsWith('../assets/'))return src.slice(3);
 try{const u=new URL(src,location.href),m=decodeURIComponent(u.pathname).match(/(assets\/images\/.*)$/);return m?.[1]||'';}catch{return'';}
}
function imageName(path,img){if(IMAGE_NAMES[path])return IMAGE_NAMES[path];const m=path.match(/assets\/images\/projects\/([a-z]+)-(\d+)(-sm)?\.webp$/i);if(m)return `Casa ${m[1].toUpperCase()} — foto ${Number(m[2])}${m[3]?' — celular':''}`;return img?.alt||'Imagem do site';}
function sectionName(el){if(el.closest('.site-header,.mobile-nav'))return'Menu principal';if(el.closest('.hero,.inner-hero'))return'Topo da página';if(el.closest('.services'))return'Seção Serviços';if(el.closest('.projects,.projects-grid'))return'Seção Projetos';if(el.closest('.method'))return'Seção Como trabalhamos';if(el.closest('.about-teaser'))return'Seção Sobre a AZO';if(el.closest('.cta'))return'Chamada para contato';if(el.closest('.footer'))return'Rodapé';if(el.closest('form'))return'Formulário';return state.page.label;}
function kind(el,text=''){const tag=el.tagName?.toLowerCase();if(tag==='h1')return'Título principal';if(tag==='h2')return'Título da seção';if(tag==='h3')return'Título';if(tag==='button')return'Texto do botão';if(tag==='a')return /solicitar|ver|conhecer|entender|abrir/i.test(text)?'Texto do botão':'Texto do link';if(el.classList?.contains('eyebrow'))return'Texto pequeno acima do título';return'Texto';}
function detectBuiltin(el){
 const card=el.closest('.portfolio-card[data-gallery]'); if(card){const key=String(card.dataset.gallery||'').toUpperCase();if(BUILTINS[key]){if(el.closest('h3'))return{key,field:'title'};if(el.closest('.portfolio-card__text')&&!el.closest('h3'))return{key,field:'category'};}}
 const home=el.closest('section.projects'); if(home){const key=String(home.querySelector('.project-open')?.dataset.gallery||'').toUpperCase();if(BUILTINS[key]){if(el.closest('.project-info__name'))return{key,field:'title'};if(el.closest('.project-info__meta'))return{key,field:'category'};}} return null;
}
function detectDynamic(el){const card=el.closest('[data-cms-project]');if(!card)return null;const id=card.dataset.cmsProject;if(el.closest('h3'))return{id,field:'title'};if(el.closest('.portfolio-card__text')&&!el.closest('h3'))return{id,field:'category'};return null;}
function resolveCandidate(node){
 if(!(node instanceof Element))return null;
 const img=node.closest('img'); if(img&&!img.closest('.loader'))return{type:'image',element:img};
 const action=node.closest('a,button,[role="button"]'); if(action&&!action.closest('.loader,.lightbox,.cms-project-lightbox')){
  const b=detectBuiltin(action); if(b)return{type:'builtin',element:action,...b}; const d=detectDynamic(action); if(d)return{type:'dynamic',element:action,...d};
  const tn=directTextNode(action); if(tn)return{type:'text',element:action,textNode:tn};
 }
 const el=node.closest('h1,h2,h3,h4,p,strong,em,small,span,label,blockquote,figcaption,.eyebrow,.hero__kicker,.hero__copy'); if(!el||el.closest('svg,.loader,.page-transition'))return null;
 const b=detectBuiltin(el);if(b)return{type:'builtin',element:el,...b};const d=detectDynamic(el);if(d)return{type:'dynamic',element:el,...d};const tn=directTextNode(el);return tn?{type:'text',element:el,textNode:tn}:null;
}
function candidateFromPoint(doc,x,y,target){
 const direct=resolveCandidate(target); if(direct)return direct;
 for(const el of doc.elementsFromPoint(x,y)){const c=resolveCandidate(el);if(c)return c;} return null;
}
function wireFrame(){
 const frame=$('#visual-frame'),doc=frame?.contentDocument;if(!doc?.body)return;state.frameReady=true;
 const style=doc.createElement('style');style.textContent=`.loader,.page-transition{display:none!important}.hero__veil,.hero__blueprint,.hero__orb,.ambient,.service-progress{pointer-events:none!important}.azo-edit-hover{outline:2px solid #a65c3a!important;outline-offset:3px!important;cursor:pointer!important}.azo-edit-selected{outline:3px solid #0d2f35!important;outline-offset:4px!important;box-shadow:0 0 0 7px rgba(213,192,166,.42)!important}#azo-edit-badge{position:fixed;z-index:2147483647;pointer-events:none;background:#0d2f35;color:#fff;border-radius:999px;padding:7px 10px;font:700 11px/1 system-ui;display:none;box-shadow:0 8px 22px rgba(0,0,0,.25)}`;doc.head.appendChild(style);
 const badge=doc.createElement('div');badge.id='azo-edit-badge';doc.body.appendChild(badge);let hover=null;
 doc.addEventListener('mousemove',e=>{const c=candidateFromPoint(doc,e.clientX,e.clientY,e.target),el=c?.element;if(el===hover)return;hover?.classList.remove('azo-edit-hover');hover=el||null;if(!el){badge.style.display='none';return;}el.classList.add('azo-edit-hover');const r=el.getBoundingClientRect();badge.textContent=c.type==='image'?`Imagem: ${imageName(canonicalAsset(el),el)}`:`${sectionName(el)} — ${kind(el,el.textContent?.trim()||'')}`;badge.style.left=`${Math.max(8,r.left)}px`;badge.style.top=`${Math.max(8,r.top-34)}px`;badge.style.display='block';},true);
 const block=e=>{e.preventDefault();e.stopPropagation();e.stopImmediatePropagation();}; doc.addEventListener('submit',block,true);doc.addEventListener('auxclick',block,true);
 doc.addEventListener('click',e=>{const c=candidateFromPoint(doc,e.clientX,e.clientY,e.target);block(e);if(!c)return;doc.querySelectorAll('.azo-edit-selected').forEach(el=>el.classList.remove('azo-edit-selected'));c.element.classList.add('azo-edit-selected');select(c,doc);},true);
 doc.addEventListener('keydown',e=>{if(e.key==='Enter'&&e.target.closest('a,button,[role="button"]'))block(e);},true);
}
async function select(c,doc){
 if(c.type==='text'){const key=textKey(c.textNode,doc);state.selected={type:'text',key,element:c.element,textNode:c.textNode,value:c.textNode.nodeValue.trim()};return renderText();}
 if(c.type==='image'){const path=canonicalAsset(c.element);state.selected={type:'image',path,element:c.element,label:imageName(path,c.element)};return renderImage();}
 if(c.type==='builtin'){state.selected={type:'builtin',key:c.key,field:c.field,element:c.element,value:c.element.textContent.trim()};return renderProject(false);}
 if(c.type==='dynamic'){state.selected={type:'dynamic',id:c.id,field:c.field,element:c.element,value:c.element.textContent.trim()};return renderProject(true);}
}
async function renderText(){
 const s=state.selected,side=$('#visual-side-panel');const snap=await getDoc(doc(db,'sitePages',state.page.id)).catch(()=>null);const items=snap?.exists()&&Array.isArray(snap.data().items)?snap.data().items:[];s.hasOverride=items.some(i=>i.key===s.key);
 const isAction=s.element.matches('a,button,[role="button"]');side.innerHTML=`<p class="eyebrow">${isAction?'Editar botão ou link':'Editar texto'}</p><h3>${esc(sectionName(s.element))} — ${esc(kind(s.element,s.value))}</h3><p class="visual-location">${esc(state.page.label)}</p><div class="visual-editor-field"><label>Texto que aparece no site</label><textarea id="visual-text-value">${esc(s.value)}</textarea></div>${isAction&&s.element.tagName==='A'?`<div class="visual-warning">Destino atual: <b>${esc(s.element.getAttribute('href')||'')}</b>. No modo visual o botão fica bloqueado para não sair da página.</div>`:''}<div class="visual-actions"><button class="btn btn-primary" id="visual-save-text" type="button">Salvar alteração</button>${s.hasOverride?'<button class="btn btn-ghost" id="visual-restore-text" type="button">Voltar ao original</button>':''}</div>`;
 $('#visual-save-text').addEventListener('click',saveText);$('#visual-restore-text')?.addEventListener('click',restoreText);
}
async function saveText(){
 const s=state.selected;if(s?.type!=='text'||!state.user)return;const value=$('#visual-text-value').value,button=$('#visual-save-text');button.disabled=true;button.textContent='Salvando...';
 try{const r=doc(db,'sitePages',state.page.id),snap=await getDoc(r),cur=snap.exists()&&Array.isArray(snap.data().items)?snap.data().items:[],next=cur.filter(i=>i.key!==s.key);next.push({key:s.key,type:'text',value});await setDoc(r,{page:state.page.id,items:next,updatedAt:serverTimestamp(),updatedBy:state.user.uid},{merge:true});const raw=s.textNode.nodeValue||'',lead=raw.match(/^\s*/)?.[0]||'',trail=raw.match(/\s*$/)?.[0]||'';s.textNode.nodeValue=`${lead}${value}${trail}`;s.value=value;s.hasOverride=true;toast('Alteração salva.');await renderText();}catch(err){toast(err.message||'Não foi possível salvar.','error');}finally{button.disabled=false;button.textContent='Salvar alteração';}
}
async function restoreText(){
 const s=state.selected;if(s?.type!=='text'||!state.user)return;try{const r=doc(db,'sitePages',state.page.id),snap=await getDoc(r);if(snap.exists()){const cur=Array.isArray(snap.data().items)?snap.data().items:[];await setDoc(r,{items:cur.filter(i=>i.key!==s.key),updatedAt:serverTimestamp(),updatedBy:state.user.uid},{merge:true});}toast('Conteúdo original restaurado.');emptySide();loadFrame();}catch(err){toast(err.message||'Não foi possível restaurar.','error');}
}
async function renderImage(){
 const s=state.selected,side=$('#visual-side-panel');if(!s.path){side.innerHTML='<p class="eyebrow">Imagem</p><h3>Imagem de projeto novo</h3><p>Gerencie esta imagem pela área Projetos do modo completo.</p>';return;}
 const snap=await getDoc(doc(db,'assets',assetDocId(s.path))).catch(()=>null);s.override=snap?.exists()?snap.data():null;side.innerHTML=`<p class="eyebrow">Trocar imagem</p><h3>${esc(s.label)}</h3><p class="visual-location">${esc(state.page.label)}</p><div class="visual-image-preview"><img src="${esc(s.element.src)}" alt=""></div><div class="visual-editor-field"><label>Escolha a nova imagem</label><input id="visual-image-file" type="file" accept="image/*"></div><div class="visual-actions"><button class="btn btn-primary" id="visual-save-image" type="button">Trocar imagem</button>${s.override?'<button class="btn btn-ghost" id="visual-restore-image" type="button">Voltar ao original</button>':''}</div>`;$('#visual-save-image').addEventListener('click',saveImage);$('#visual-restore-image')?.addEventListener('click',restoreImage);
}
function safe(v=''){return v.normalize('NFKD').replace(/[^a-zA-Z0-9._-]+/g,'-').replace(/^-+|-+$/g,'')||'imagem';}
function upload(file,path,progress){return new Promise((resolve,reject)=>{const task=uploadBytesResumable(ref(storage,path),file,{contentType:file.type,cacheControl:'public,max-age=31536000,immutable'});task.on('state_changed',s=>progress?.(s.bytesTransferred/s.totalBytes),reject,async()=>resolve({url:await getDownloadURL(task.snapshot.ref),storagePath:task.snapshot.ref.fullPath}));});}
async function saveImage(){
 const s=state.selected,file=$('#visual-image-file')?.files?.[0];if(s?.type!=='image'||!s.path||!file||!state.user)return toast('Escolha uma imagem primeiro.','error');if(!file.type.startsWith('image/'))return toast('Escolha um arquivo de imagem.','error');if(file.size>30*1024*1024)return toast('A imagem deve ter no máximo 30 MB.','error');const b=$('#visual-save-image');b.disabled=true;
 try{const previous=s.override,up=await upload(file,`site/visual/${Date.now()}-${safe(file.name)}`,f=>b.textContent=`Enviando ${Math.round(f*100)}%`);await setDoc(doc(db,'assets',assetDocId(s.path)),{path:s.path,url:up.url,storagePath:up.storagePath,fileName:file.name,contentType:file.type,size:file.size,updatedAt:serverTimestamp(),updatedBy:state.user.uid});if(previous?.storagePath&&previous.storagePath!==up.storagePath)deleteObject(ref(storage,previous.storagePath)).catch(()=>{});const fd=$('#visual-frame')?.contentDocument;fd?.querySelectorAll('img').forEach(img=>{if(canonicalAsset(img)===s.path){img.dataset.cmsSource=s.path;img.src=up.url;img.removeAttribute('srcset');}});s.element.src=up.url;s.override={url:up.url,storagePath:up.storagePath};toast('Imagem alterada.');await renderImage();}catch(err){toast(err.message||'Não foi possível trocar a imagem.','error');}finally{b.disabled=false;b.textContent='Trocar imagem';}
}
async function restoreImage(){const s=state.selected;if(s?.type!=='image'||!s.override)return;try{await deleteDoc(doc(db,'assets',assetDocId(s.path)));if(s.override.storagePath)deleteObject(ref(storage,s.override.storagePath)).catch(()=>{});toast('Imagem original restaurada.');emptySide();loadFrame();}catch(err){toast(err.message||'Não foi possível restaurar a imagem.','error');}}
async function renderProject(dynamic){
 const s=state.selected,field=s.field==='title'?'Nome do projeto':'Tipo do projeto',side=$('#visual-side-panel');side.innerHTML=`<p class="eyebrow">Projeto</p><h3>${field}</h3><p class="visual-location">${esc(state.page.label)}</p><div class="visual-editor-field"><label>${field}</label><textarea id="visual-project-value">${esc(s.value)}</textarea></div><div class="visual-actions"><button class="btn btn-primary" id="visual-save-project" type="button">Salvar alteração</button></div><div class="visual-warning">Para adicionar ou remover fotos, use a área Projetos no modo completo.</div>`;$('#visual-save-project').addEventListener('click',()=>saveProject(dynamic));
}
async function saveProject(dynamic){
 const s=state.selected,value=$('#visual-project-value').value.trim();if(!value||!state.user)return toast('Esse campo não pode ficar vazio.','error');const b=$('#visual-save-project');b.disabled=true;b.textContent='Salvando...';
 try{if(dynamic){const r=doc(db,'projects',s.id),snap=await getDoc(r);if(!snap.exists())throw new Error('Projeto não encontrado.');await setDoc(r,{[s.field]:value,updatedAt:serverTimestamp(),updatedBy:state.user.uid},{merge:true});}else{const base=BUILTINS[s.key],r=doc(db,'projectSettings',`builtin-${s.key}`),snap=await getDoc(r),saved=snap.exists()?snap.data():{};await setDoc(r,{builtinKey:s.key,title:s.field==='title'?value:(saved.title||base.title),category:s.field==='category'?value:(saved.category||base.category),published:saved.published!==false,updatedAt:serverTimestamp(),updatedBy:state.user.uid},{merge:true});}s.element.textContent=value;s.value=value;toast('Projeto atualizado.');}catch(err){toast(err.message||'Não foi possível salvar o projeto.','error');}finally{b.disabled=false;b.textContent='Salvar alteração';}
}

onAuthStateChanged(auth,user=>{state.user=user;if(!user)return;const start=()=>ensureUI();if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});else start();});
