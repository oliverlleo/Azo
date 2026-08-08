import { auth, db, storage } from '../assets/js/firebase-config.js';
import {
  doc,
  getDoc,
  setDoc,
  deleteDoc,
  serverTimestamp
} from 'https://www.gstatic.com/firebasejs/12.16.0/firebase-firestore.js';
import { onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/12.16.0/firebase-auth.js';
import {
  ref,
  uploadBytesResumable,
  getDownloadURL,
  deleteObject
} from 'https://www.gstatic.com/firebasejs/12.16.0/firebase-storage.js';
import { assetDocId } from '../assets/js/cms-core.js';

const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
const escapeHtml = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

const PAGES = [
  { id:'index', file:'index.html', label:'Página inicial' },
  { id:'servicos', file:'servicos.html', label:'Serviços' },
  { id:'projetos', file:'projetos.html', label:'Projetos' },
  { id:'sobre', file:'sobre.html', label:'Sobre a AZO' },
  { id:'contato', file:'contato.html', label:'Contato' },
  { id:'projeto-arquitetonico', file:'projeto-arquitetonico.html', label:'Projeto arquitetônico' },
  { id:'interiores', file:'interiores.html', label:'Interiores' },
  { id:'gestao-de-obras', file:'gestao-de-obras.html', label:'Gestão de obras' }
];

const BUILTIN_DEFAULTS = {
  AS:{title:'Casa AS',category:'Arquitetura residencial'},
  HL:{title:'Casa HL',category:'Arquitetura residencial'},
  JT:{title:'Casa JT',category:'Projeto residencial'},
  MN:{title:'Casa MN',category:'Arquitetura + construção'},
  SE:{title:'Casa SE',category:'Projeto residencial'},
  EF:{title:'Casa EF',category:'Interiores + área de lazer'}
};

const IMAGE_NAMES = {
  'assets/images/logo-azo.png':'Logo da AZO',
  'assets/images/hero.webp':'Imagem de fundo do topo da página inicial',
  'assets/images/hero-sm.webp':'Imagem de fundo do topo da página inicial — celular',
  'assets/images/about.webp':'Imagem da seção Sobre a AZO',
  'assets/images/about-sm.webp':'Imagem da seção Sobre a AZO — celular',
  'assets/images/project-feature.webp':'Imagem de destaque da página Projetos',
  'assets/images/project-feature-sm.webp':'Imagem de destaque da página Projetos — celular',
  'assets/images/service-architecture.webp':'Imagem do serviço Projeto arquitetônico',
  'assets/images/service-architecture-sm.webp':'Imagem do serviço Projeto arquitetônico — celular',
  'assets/images/service-interiors.webp':'Imagem do serviço Interiores',
  'assets/images/service-interiors-sm.webp':'Imagem do serviço Interiores — celular',
  'assets/images/service-build.webp':'Imagem do serviço Gestão de obras',
  'assets/images/service-build-sm.webp':'Imagem do serviço Gestão de obras — celular',
  'assets/images/team.webp':'Foto da equipe',
  'assets/images/team-sm.webp':'Foto da equipe — celular'
};

const state = {
  user:null,
  page:PAGES[0],
  selected:null,
  device:'desktop',
  frameReady:false
};

function toast(message, type='success') {
  const stack = $('#toast-stack');
  if (!stack) return alert(message);
  const el = document.createElement('div');
  el.className = `toast ${type}`;
  el.innerHTML = `<b>${type === 'error' ? '!' : '✓'}</b><span>${escapeHtml(message)}</span>`;
  stack.appendChild(el);
  setTimeout(()=>el.remove(),3800);
}

function injectStyles() {
  if ($('#azo-visual-admin-style')) return;
  const style = document.createElement('style');
  style.id = 'azo-visual-admin-style';
  style.textContent = `
  .visual-mode-choice{margin-top:18px}.visual-mode-choice .panel-head{margin-bottom:16px}.visual-choice-grid{display:grid;grid-template-columns:1fr 1fr;gap:12px}.visual-choice{border:1px solid var(--line);background:var(--card);border-radius:20px;padding:20px;display:grid;grid-template-columns:48px 1fr auto;gap:14px;align-items:center;text-align:left;cursor:pointer;transition:.25s}.visual-choice:hover{border-color:var(--ink);transform:translateY(-2px);box-shadow:0 12px 32px rgba(13,47,53,.08)}.visual-choice>i{width:48px;height:48px;border-radius:14px;background:var(--ink);color:#fff;display:grid;place-items:center;font-style:normal;font-size:1.1rem}.visual-choice strong,.visual-choice small{display:block}.visual-choice strong{font-size:.9rem}.visual-choice small{color:var(--muted);margin-top:4px;line-height:1.45}.visual-choice.recommended{background:#0d2f35;color:#fff;border-color:#0d2f35}.visual-choice.recommended>i{background:#d5c0a6;color:#0d2f35}.visual-choice.recommended small{color:rgba(255,255,255,.65)}
  .visual-toolbar{display:flex;align-items:end;gap:12px;position:sticky;top:126px;z-index:16}.visual-toolbar .field{min-width:240px}.visual-device{display:flex;gap:5px;border:1px solid var(--line);background:#fff;border-radius:999px;padding:4px}.visual-device button{border:0;background:transparent;border-radius:999px;padding:8px 12px;font-size:.68rem;font-weight:800;cursor:pointer;color:var(--muted)}.visual-device button.active{background:var(--ink);color:#fff}
  .visual-layout{display:grid;grid-template-columns:330px minmax(0,1fr);gap:16px;margin-top:16px;align-items:start}.visual-side{position:sticky;top:205px;min-height:420px}.visual-side h3{font-family:Georgia,'Times New Roman',serif;font-size:1.85rem;font-weight:400;letter-spacing:-.035em;margin:0 0 8px}.visual-side p{color:var(--muted);font-size:.78rem;line-height:1.6}.visual-help-list{display:grid;gap:10px;margin-top:18px}.visual-help-list div{display:grid;grid-template-columns:28px 1fr;gap:9px;align-items:start}.visual-help-list b{width:26px;height:26px;border-radius:50%;background:#edf3f1;display:grid;place-items:center;font-size:.68rem}.visual-location{display:inline-flex!important;background:#f1eee7;border-radius:999px;padding:7px 10px!important;color:#586364!important;font-size:.66rem!important;font-weight:800;margin:0 0 14px!important}.visual-editor-field{display:grid;gap:9px;margin-top:14px}.visual-editor-field label{font-size:.72rem;font-weight:800}.visual-editor-field textarea{width:100%;min-height:150px;resize:vertical;border:1px solid var(--line);border-radius:15px;padding:14px;outline:none;line-height:1.5}.visual-editor-field textarea:focus{border-color:var(--ink);box-shadow:0 0 0 4px rgba(13,47,53,.08)}.visual-actions{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:14px}.visual-actions .btn:only-child{grid-column:1/-1}.visual-image-preview{border-radius:16px;overflow:hidden;background:#ece9e2;aspect-ratio:1.35;margin-top:12px}.visual-image-preview img{width:100%;height:100%;object-fit:cover}.visual-file{display:grid;gap:8px;margin-top:12px}.visual-file input{width:100%;font-size:.72rem}.visual-warning{background:#fff5e8;border:1px solid #ead6ba;border-radius:14px;padding:12px;font-size:.72rem;line-height:1.5;color:#695846;margin-top:14px}
  .visual-canvas-shell{background:#d7d8d5;border-radius:24px;padding:18px;min-height:700px;overflow:auto;display:flex;justify-content:center;box-shadow:inset 0 0 0 1px rgba(13,47,53,.08)}.visual-frame-wrap{width:100%;min-height:820px;background:#fff;border-radius:15px;overflow:hidden;box-shadow:0 24px 70px rgba(0,0,0,.16);transition:width .35s var(--ease)}.visual-frame-wrap[data-device='tablet']{width:820px}.visual-frame-wrap[data-device='mobile']{width:390px}.visual-frame{width:100%;height:820px;border:0;display:block;background:#fff}.visual-loading{display:grid;place-items:center;height:820px;color:var(--muted);font-size:.8rem}
  @media(max-width:1100px){.visual-layout{grid-template-columns:1fr}.visual-side{position:static}.visual-canvas-shell{min-height:600px}.visual-choice-grid{grid-template-columns:1fr}}
  @media(max-width:700px){.visual-toolbar{top:105px;align-items:stretch;flex-wrap:wrap}.visual-toolbar .field{min-width:100%}.visual-device{width:100%;justify-content:center}.visual-layout{gap:10px}.visual-canvas-shell{padding:8px;border-radius:18px}.visual-frame-wrap[data-device='mobile']{width:100%}}
  `;
  document.head.appendChild(style);
}

function ensureUI() {
  if ($('#view-visual')) return;
  injectStyles();

  const sidebar = $('.sidebar-nav');
  const first = sidebar?.querySelector('.nav-item');
  if (sidebar) {
    const nav = document.createElement('button');
    nav.className = 'nav-item';
    nav.type = 'button';
    nav.id = 'visual-editor-nav';
    nav.innerHTML = '<i>◫</i><span>Editar visualmente</span>';
    if (first?.nextSibling) sidebar.insertBefore(nav, first.nextSibling); else sidebar.appendChild(nav);
    nav.addEventListener('click', openVisualMode);
  }

  const dashboard = $('#view-dashboard');
  const hero = dashboard?.querySelector('.hero-panel');
  if (dashboard && hero) {
    const chooser = document.createElement('section');
    chooser.className = 'panel visual-mode-choice';
    chooser.innerHTML = `
      <div class="panel-head"><div><p class="eyebrow">Escolha como editar</p><h3>Do jeito que for mais fácil para você.</h3></div></div>
      <div class="visual-choice-grid">
        <button class="visual-choice recommended" type="button" data-open-visual><i>◫</i><span><strong>Editar diretamente no site</strong><small>Abra a página, clique no texto ou na imagem e altere ali mesmo.</small></span><b>→</b></button>
        <button class="visual-choice" type="button" data-open-complete><i>☷</i><span><strong>Modo completo</strong><small>Continue usando as telas de textos, imagens e projetos que já existem.</small></span><b>→</b></button>
      </div>`;
    hero.insertAdjacentElement('afterend', chooser);
    chooser.querySelector('[data-open-visual]').addEventListener('click', openVisualMode);
    chooser.querySelector('[data-open-complete]').addEventListener('click', ()=>document.querySelector('[data-view="content"]')?.click());
  }

  const workspace = $('.workspace');
  if (!workspace) return;
  const view = document.createElement('div');
  view.className = 'view';
  view.id = 'view-visual';
  view.innerHTML = `
    <div class="visual-toolbar panel slim">
      <div class="field"><label for="visual-page-select">Página do site</label><select id="visual-page-select">${PAGES.map(p=>`<option value="${p.id}">${escapeHtml(p.label)}</option>`).join('')}</select></div>
      <div class="visual-device" aria-label="Tamanho da visualização">
        <button type="button" class="active" data-visual-device="desktop">Computador</button>
        <button type="button" data-visual-device="tablet">Tablet</button>
        <button type="button" data-visual-device="mobile">Celular</button>
      </div>
      <div style="flex:1"></div>
      <button class="btn btn-ghost" type="button" id="visual-reload">Atualizar página</button>
    </div>
    <div class="visual-layout">
      <aside class="panel visual-side" id="visual-side-panel">
        <p class="eyebrow">Modo visual</p>
        <h3>Clique no que deseja alterar.</h3>
        <p>Passe o mouse sobre o site. Textos e imagens editáveis ficarão marcados. Clique em um deles para abrir as opções aqui.</p>
        <div class="visual-help-list"><div><b>1</b><span>Escolha a página acima.</span></div><div><b>2</b><span>Clique em um texto ou imagem.</span></div><div><b>3</b><span>Faça a alteração e salve.</span></div></div>
      </aside>
      <div class="visual-canvas-shell">
        <div class="visual-frame-wrap" id="visual-frame-wrap" data-device="desktop"><iframe class="visual-frame" id="visual-frame" title="Pré-visualização editável do site"></iframe></div>
      </div>
    </div>`;
  workspace.appendChild(view);

  $('#visual-page-select').addEventListener('change', event => {
    state.page = PAGES.find(p=>p.id===event.target.value) || PAGES[0];
    state.selected = null;
    renderEmptySide();
    loadFrame();
  });
  $('#visual-reload').addEventListener('click', loadFrame);
  $$('[data-visual-device]').forEach(button=>button.addEventListener('click',()=>setDevice(button.dataset.visualDevice)));
  $('#visual-frame').addEventListener('load', wireFrame);

  document.addEventListener('click', event => {
    const normalNav = event.target.closest('.nav-item[data-view]');
    if (normalNav) $('#visual-editor-nav')?.classList.remove('active');
  }, true);
}

function openVisualMode() {
  ensureUI();
  $$('.view').forEach(view=>view.classList.toggle('active', view.id==='view-visual'));
  $$('.nav-item').forEach(button=>button.classList.remove('active'));
  $('#visual-editor-nav')?.classList.add('active');
  $('#view-kicker').textContent = 'Edição direta no site';
  $('#view-title').textContent = 'Editar visualmente';
  $('#app-shell')?.classList.remove('menu-open');
  if (!state.frameReady) loadFrame();
}

function setDevice(device) {
  state.device = device;
  $('#visual-frame-wrap')?.setAttribute('data-device',device);
  $$('[data-visual-device]').forEach(button=>button.classList.toggle('active',button.dataset.visualDevice===device));
}

function loadFrame() {
  const frame = $('#visual-frame');
  if (!frame) return;
  state.frameReady = false;
  frame.src = `../${state.page.file}?azoVisualEditor=1&visualRefresh=${Date.now()}`;
}

function elementPath(el, root) {
  if (!el || !root) return '';
  const parts=[];
  let node=el;
  while(node && node.nodeType===1){
    const tag=node.tagName.toLowerCase();
    const parent=node.parentElement;
    let part=tag;
    if(parent){
      const same=[...parent.children].filter(child=>child.tagName===node.tagName);
      if(same.length>1) part += `:nth-of-type(${same.indexOf(node)+1})`;
    }
    parts.unshift(part);
    if(node===root) break;
    node=parent;
  }
  return parts.join('>');
}

function directTextNode(el) {
  if (!el) return null;
  const direct=[...el.childNodes].find(node=>node.nodeType===Node.TEXT_NODE && node.nodeValue?.trim());
  if (direct) return direct;
  const doc=el.ownerDocument;
  const walker=doc.createTreeWalker(el,NodeFilter.SHOW_TEXT,{acceptNode(node){
    if(!node.nodeValue?.trim()) return NodeFilter.FILTER_REJECT;
    if(node.parentElement?.closest('svg,script,style,noscript')) return NodeFilter.FILTER_REJECT;
    return NodeFilter.FILTER_ACCEPT;
  }});
  return walker.nextNode();
}

function textKey(textNode, doc) {
  const parent=textNode?.parentElement;
  if(!parent) return '';
  const index=[...parent.childNodes].filter(node=>node.nodeType===Node.TEXT_NODE).indexOf(textNode);
  return `text:${elementPath(parent,doc.body)}::${index}`;
}

function canonicalAsset(img) {
  const source=img?.dataset?.cmsSource || img?.getAttribute('src') || '';
  if (!source) return '';
  if (source.startsWith('assets/')) return source;
  if (source.startsWith('../assets/')) return source.slice(3);
  try {
    const url=new URL(source,location.href);
    const match=decodeURIComponent(url.pathname).match(/(assets\/images\/.*)$/);
    return match?.[1] || '';
  } catch { return ''; }
}

function imageName(path,img) {
  if (IMAGE_NAMES[path]) return IMAGE_NAMES[path];
  const project=path.match(/assets\/images\/projects\/([a-z]+)-(\d+)(-sm)?\.webp$/i);
  if(project) return `Casa ${project[1].toUpperCase()} — foto ${Number(project[2])}${project[3]?' — celular':''}`;
  return img?.alt || 'Imagem do site';
}

function sectionName(el) {
  if(el.closest('.site-header,.mobile-nav')) return 'Menu principal';
  if(el.closest('.hero,.inner-hero')) return 'Topo da página';
  if(el.closest('.manifesto')) return 'Apresentação da AZO';
  if(el.closest('.services')) return 'Seção Serviços';
  if(el.closest('.integration')) return 'Seção Integração';
  if(el.closest('.projects,.projects-grid')) return 'Seção Projetos';
  if(el.closest('.method')) return 'Seção Como trabalhamos';
  if(el.closest('.about-teaser')) return 'Seção Sobre a AZO';
  if(el.closest('.cta')) return 'Chamada para contato';
  if(el.closest('.footer')) return 'Rodapé';
  if(el.closest('form')) return 'Formulário';
  return state.page.label;
}

function elementKind(el,text='') {
  const tag=el.tagName?.toLowerCase();
  if(tag==='h1') return 'Título principal';
  if(tag==='h2') return 'Título da seção';
  if(tag==='h3') return 'Título';
  if(tag==='h4') return 'Título pequeno';
  if(tag==='button') return 'Texto do botão';
  if(tag==='a') return /solicitar|ver|conhecer|entender|abrir/i.test(text)?'Texto do botão':'Texto do link';
  if(el.classList?.contains('eyebrow')) return 'Texto pequeno acima do título';
  if(tag==='label') return 'Nome do campo';
  if(tag==='small') return 'Texto auxiliar';
  if(tag==='strong') return 'Texto em destaque';
  return 'Texto';
}

function describeText(el,text) {
  return `${sectionName(el)} — ${elementKind(el,text)}`;
}

function detectBuiltinProject(el) {
  const card=el.closest('.portfolio-card[data-gallery]');
  if(card){
    const key=String(card.dataset.gallery || '').toUpperCase();
    if(!BUILTIN_DEFAULTS[key]) return null;
    if(el.closest('h3')) return {key,field:'title'};
    if(el.closest('.portfolio-card__text') && !el.closest('h3')) return {key,field:'category'};
  }
  const home=el.closest('section.projects');
  if(home){
    const key=String(home.querySelector('.project-open')?.dataset.gallery || '').toUpperCase();
    if(!BUILTIN_DEFAULTS[key]) return null;
    if(el.closest('.project-info__name')) return {key,field:'title'};
    if(el.closest('.project-info__meta')) return {key,field:'category'};
  }
  return null;
}

function detectDynamicProject(el) {
  const card=el.closest('[data-cms-project]');
  if(!card) return null;
  const id=card.dataset.cmsProject;
  if(!id) return null;
  if(el.closest('h3')) return {id,field:'title'};
  if(el.closest('.portfolio-card__text') && !el.closest('h3')) return {id,field:'category'};
  return {id,field:null};
}

function resolveEditableTarget(node) {
  if (!(node instanceof Element)) return null;
  const img=node.closest('img');
  if(img) return {type:'image',element:img};
  const el=node.closest('h1,h2,h3,h4,p,a,button,strong,em,small,span,label,blockquote,figcaption,.eyebrow,.hero__kicker,.hero__copy');
  if(!el || el.closest('svg,.loader,.page-transition')) return null;
  const projectBuiltin=detectBuiltinProject(el);
  if(projectBuiltin) return {type:'builtinProject',element:el,...projectBuiltin};
  const projectDynamic=detectDynamicProject(el);
  if(projectDynamic?.field) return {type:'dynamicProject',element:el,...projectDynamic};
  const textNode=directTextNode(el);
  if(!textNode) return null;
  return {type:'text',element:textNode.parentElement,textNode};
}

function wireFrame() {
  const frame=$('#visual-frame');
  const doc=frame?.contentDocument;
  if(!doc?.body) return;
  state.frameReady=true;

  const style=doc.createElement('style');
  style.id='azo-visual-edit-style';
  style.textContent=`
    html.azo-visual-editing *{scroll-behavior:auto!important}
    .azo-visual-hover{outline:2px solid #a65c3a!important;outline-offset:3px!important;cursor:pointer!important}
    .azo-visual-selected{outline:3px solid #0d2f35!important;outline-offset:4px!important;box-shadow:0 0 0 7px rgba(213,192,166,.45)!important}
    #azo-visual-badge{position:fixed;z-index:2147483647;pointer-events:none;background:#0d2f35;color:#fff;border-radius:999px;padding:7px 10px;font:700 11px/1 system-ui,sans-serif;box-shadow:0 8px 22px rgba(0,0,0,.25);display:none;max-width:280px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
  `;
  doc.head.appendChild(style);
  doc.documentElement.classList.add('azo-visual-editing');
  const badge=doc.createElement('div');
  badge.id='azo-visual-badge';
  doc.body.appendChild(badge);

  let hovered=null;
  const clearHover=()=>{hovered?.classList.remove('azo-visual-hover');hovered=null;badge.style.display='none';};
  doc.addEventListener('mouseover',event=>{
    const editable=resolveEditableTarget(event.target);
    const el=editable?.element;
    if(!el || el===hovered) return;
    clearHover();
    hovered=el;
    el.classList.add('azo-visual-hover');
    const rect=el.getBoundingClientRect();
    const label=editable.type==='image' ? `Imagem: ${imageName(canonicalAsset(el),el)}` : describeText(el,el.textContent?.trim()||'');
    badge.textContent=label;
    badge.style.left=`${Math.max(8,Math.min(innerWidth-290,rect.left))}px`;
    badge.style.top=`${Math.max(8,rect.top-34)}px`;
    badge.style.display='block';
  },true);
  doc.addEventListener('mouseout',event=>{
    if(hovered && !hovered.contains(event.relatedTarget)) clearHover();
  },true);
  doc.addEventListener('click',event=>{
    const editable=resolveEditableTarget(event.target);
    if(!editable) return;
    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation();
    doc.querySelectorAll('.azo-visual-selected').forEach(el=>el.classList.remove('azo-visual-selected'));
    editable.element.classList.add('azo-visual-selected');
    selectItem(editable,doc);
  },true);
  doc.addEventListener('submit',event=>{event.preventDefault();event.stopImmediatePropagation();},true);
}

async function selectItem(editable,doc) {
  if(editable.type==='text'){
    const key=textKey(editable.textNode,doc);
    state.selected={type:'text',key,element:editable.element,textNode:editable.textNode,value:editable.textNode.nodeValue.trim()};
    await renderTextEditor();
    return;
  }
  if(editable.type==='image'){
    const path=canonicalAsset(editable.element);
    state.selected={type:'image',path,element:editable.element,label:imageName(path,editable.element)};
    await renderImageEditor();
    return;
  }
  if(editable.type==='builtinProject'){
    state.selected={type:'builtinProject',key:editable.key,field:editable.field,element:editable.element,value:editable.element.textContent.trim()};
    await renderProjectFieldEditor(false);
    return;
  }
  if(editable.type==='dynamicProject'){
    state.selected={type:'dynamicProject',id:editable.id,field:editable.field,element:editable.element,value:editable.element.textContent.trim()};
    await renderProjectFieldEditor(true);
  }
}

function renderEmptySide() {
  const side=$('#visual-side-panel');
  if(!side) return;
  side.innerHTML=`<p class="eyebrow">Modo visual</p><h3>Clique no que deseja alterar.</h3><p>Passe o mouse sobre o site. Textos e imagens editáveis ficarão marcados. Clique em um deles para abrir as opções aqui.</p><div class="visual-help-list"><div><b>1</b><span>Escolha a página acima.</span></div><div><b>2</b><span>Clique em um texto ou imagem.</span></div><div><b>3</b><span>Faça a alteração e salve.</span></div></div>`;
}

async function renderTextEditor() {
  const selected=state.selected;
  const side=$('#visual-side-panel');
  const pageSnap=await getDoc(doc(db,'sitePages',state.page.id)).catch(()=>null);
  const items=pageSnap?.exists() && Array.isArray(pageSnap.data().items) ? pageSnap.data().items : [];
  const saved=items.find(item=>item.key===selected.key);
  selected.hasOverride=Boolean(saved);
  side.innerHTML=`
    <p class="eyebrow">Editar texto</p>
    <h3>${escapeHtml(describeText(selected.element,selected.value))}</h3>
    <p class="visual-location">${escapeHtml(state.page.label)}</p>
    <div class="visual-editor-field"><label>Texto que aparece no site</label><textarea id="visual-text-value" spellcheck="true">${escapeHtml(selected.value)}</textarea></div>
    <div class="visual-actions"><button class="btn btn-primary" id="visual-save-text" type="button">Salvar alteração</button>${selected.hasOverride?'<button class="btn btn-ghost" id="visual-restore-text" type="button">Voltar ao original</button>':''}</div>`;
  $('#visual-save-text').addEventListener('click',saveText);
  $('#visual-restore-text')?.addEventListener('click',restoreText);
}

async function saveText() {
  const selected=state.selected;
  if(selected?.type!=='text' || !state.user) return;
  const value=$('#visual-text-value').value;
  const button=$('#visual-save-text');
  button.disabled=true;button.textContent='Salvando...';
  try{
    const refDoc=doc(db,'sitePages',state.page.id);
    const snap=await getDoc(refDoc);
    const current=snap.exists() && Array.isArray(snap.data().items)?snap.data().items:[];
    const next=current.filter(item=>item.key!==selected.key);
    next.push({key:selected.key,type:'text',value});
    await setDoc(refDoc,{page:state.page.id,items:next,updatedAt:serverTimestamp(),updatedBy:state.user.uid},{merge:true});
    const raw=selected.textNode.nodeValue || '';
    const lead=raw.match(/^\s*/)?.[0]||'';
    const trail=raw.match(/\s*$/)?.[0]||'';
    selected.textNode.nodeValue=`${lead}${value}${trail}`;
    selected.value=value;selected.hasOverride=true;
    toast('Texto alterado no site.');
    await renderTextEditor();
  }catch(error){toast(error.message||'Não foi possível salvar o texto.','error');}
  finally{button.disabled=false;button.textContent='Salvar alteração';}
}

async function restoreText() {
  const selected=state.selected;
  if(selected?.type!=='text' || !state.user) return;
  try{
    const refDoc=doc(db,'sitePages',state.page.id);
    const snap=await getDoc(refDoc);
    if(snap.exists()){
      const current=Array.isArray(snap.data().items)?snap.data().items:[];
      await setDoc(refDoc,{items:current.filter(item=>item.key!==selected.key),updatedAt:serverTimestamp(),updatedBy:state.user.uid},{merge:true});
    }
    toast('Texto original restaurado.');
    loadFrame();
    renderEmptySide();
  }catch(error){toast(error.message||'Não foi possível restaurar o texto.','error');}
}

async function renderImageEditor() {
  const selected=state.selected;
  const side=$('#visual-side-panel');
  if(!selected.path){
    side.innerHTML=`<p class="eyebrow">Imagem</p><h3>Esta imagem pertence a um projeto criado pelo painel.</h3><p>Para trocar as fotos desse projeto, use a área <b>Projetos</b> no modo completo.</p><div class="visual-actions"><button class="btn btn-primary" id="visual-go-projects" type="button">Abrir Projetos</button></div>`;
    $('#visual-go-projects').addEventListener('click',()=>document.querySelector('[data-view="projects"]')?.click());
    return;
  }
  const assetRef=doc(db,'assets',assetDocId(selected.path));
  const snap=await getDoc(assetRef).catch(()=>null);
  selected.override=snap?.exists()?snap.data():null;
  side.innerHTML=`
    <p class="eyebrow">Trocar imagem</p>
    <h3>${escapeHtml(selected.label)}</h3>
    <p class="visual-location">${escapeHtml(state.page.label)}</p>
    <div class="visual-image-preview"><img src="${escapeHtml(selected.element.src)}" alt=""></div>
    <div class="visual-file"><label>Escolha a nova imagem</label><input id="visual-image-file" type="file" accept="image/*"></div>
    <div class="visual-actions"><button class="btn btn-primary" id="visual-save-image" type="button">Trocar imagem</button>${selected.override?'<button class="btn btn-ghost" id="visual-restore-image" type="button">Voltar ao original</button>':''}</div>
    <div class="visual-warning">A nova imagem é enviada ao armazenamento do site. O arquivo original continua preservado e pode ser restaurado.</div>`;
  $('#visual-save-image').addEventListener('click',saveImage);
  $('#visual-restore-image')?.addEventListener('click',restoreImage);
}

function safeStorageSegment(value=''){
  return value.normalize('NFKD').replace(/[^a-zA-Z0-9._-]+/g,'-').replace(/^-+|-+$/g,'')||'imagem';
}

function uploadFile(file,storagePath,progress){
  return new Promise((resolve,reject)=>{
    const task=uploadBytesResumable(ref(storage,storagePath),file,{contentType:file.type,cacheControl:'public,max-age=31536000,immutable'});
    task.on('state_changed',snap=>progress?.(snap.bytesTransferred/snap.totalBytes),reject,async()=>resolve({url:await getDownloadURL(task.snapshot.ref),storagePath:task.snapshot.ref.fullPath}));
  });
}

async function saveImage(){
  const selected=state.selected;
  const file=$('#visual-image-file')?.files?.[0];
  if(selected?.type!=='image'||!selected.path||!file||!state.user) return toast('Escolha uma imagem primeiro.','error');
  if(!file.type.startsWith('image/')) return toast('Escolha um arquivo de imagem.','error');
  if(file.size>30*1024*1024) return toast('A imagem deve ter no máximo 30 MB.','error');
  const button=$('#visual-save-image');button.disabled=true;button.textContent='Enviando...';
  try{
    const previous=selected.override;
    const storagePath=`site/visual/${Date.now()}-${safeStorageSegment(file.name)}`;
    const uploaded=await uploadFile(file,storagePath,f=>button.textContent=`Enviando ${Math.round(f*100)}%`);
    await setDoc(doc(db,'assets',assetDocId(selected.path)),{
      path:selected.path,url:uploaded.url,storagePath:uploaded.storagePath,fileName:file.name,contentType:file.type,size:file.size,updatedAt:serverTimestamp(),updatedBy:state.user.uid
    });
    if(previous?.storagePath && previous.storagePath!==uploaded.storagePath) deleteObject(ref(storage,previous.storagePath)).catch(()=>{});
    const frameDoc=$('#visual-frame')?.contentDocument;
    frameDoc?.querySelectorAll('img').forEach(img=>{
      if(canonicalAsset(img)===selected.path){img.dataset.cmsSource=selected.path;img.src=uploaded.url;img.removeAttribute('srcset');}
    });
    selected.override={...previous,url:uploaded.url,storagePath:uploaded.storagePath};
    selected.element.src=uploaded.url;
    toast('Imagem alterada no site.');
    await renderImageEditor();
  }catch(error){toast(error.message||'Não foi possível trocar a imagem.','error');}
  finally{button.disabled=false;button.textContent='Trocar imagem';}
}

async function restoreImage(){
  const selected=state.selected;
  if(selected?.type!=='image'||!selected.path||!selected.override) return;
  try{
    await deleteDoc(doc(db,'assets',assetDocId(selected.path)));
    if(selected.override.storagePath) deleteObject(ref(storage,selected.override.storagePath)).catch(()=>{});
    toast('Imagem original restaurada.');
    loadFrame();renderEmptySide();
  }catch(error){toast(error.message||'Não foi possível restaurar a imagem.','error');}
}

async function renderProjectFieldEditor(dynamic){
  const selected=state.selected;
  const side=$('#visual-side-panel');
  const fieldLabel=selected.field==='title'?'Nome do projeto':'Tipo do projeto';
  side.innerHTML=`
    <p class="eyebrow">Projeto</p>
    <h3>${escapeHtml(fieldLabel)}</h3>
    <p class="visual-location">${escapeHtml(state.page.label)}</p>
    <div class="visual-editor-field"><label>${escapeHtml(fieldLabel)}</label><textarea id="visual-project-value" style="min-height:100px">${escapeHtml(selected.value)}</textarea></div>
    <div class="visual-actions"><button class="btn btn-primary" id="visual-save-project-field" type="button">Salvar alteração</button>${dynamic?'':'<button class="btn btn-ghost" id="visual-restore-project-field" type="button">Voltar ao original</button>'}</div>
    <div class="visual-warning">Para adicionar, apagar ou reorganizar fotos do projeto, use a área “Projetos” no modo completo.</div>`;
  $('#visual-save-project-field').addEventListener('click',()=>saveProjectField(dynamic));
  $('#visual-restore-project-field')?.addEventListener('click',restoreBuiltinProjectField);
}

async function saveProjectField(dynamic){
  const selected=state.selected;
  if(!selected||!state.user) return;
  const value=$('#visual-project-value').value.trim();
  if(!value) return toast('Esse campo não pode ficar vazio.','error');
  const button=$('#visual-save-project-field');button.disabled=true;button.textContent='Salvando...';
  try{
    const target=dynamic?doc(db,'projects',selected.id):doc(db,'projectSettings',`builtin-${selected.key}`);
    await setDoc(target,{[selected.field]:value,...(!dynamic?{builtinKey:selected.key}:{}),updatedAt:serverTimestamp(),updatedBy:state.user.uid},{merge:true});
    selected.element.textContent=value;selected.value=value;
    toast('Projeto atualizado no site.');
  }catch(error){toast(error.message||'Não foi possível atualizar o projeto.','error');}
  finally{button.disabled=false;button.textContent='Salvar alteração';}
}

async function restoreBuiltinProjectField(){
  const selected=state.selected;
  if(selected?.type!=='builtinProject'||!state.user) return;
  const original=BUILTIN_DEFAULTS[selected.key]?.[selected.field];
  if(!original) return;
  try{
    await setDoc(doc(db,'projectSettings',`builtin-${selected.key}`),{builtinKey:selected.key,[selected.field]:original,updatedAt:serverTimestamp(),updatedBy:state.user.uid},{merge:true});
    selected.element.textContent=original;selected.value=original;
    $('#visual-project-value').value=original;
    toast('Valor original restaurado.');
  }catch(error){toast(error.message||'Não foi possível restaurar.','error');}
}

onAuthStateChanged(auth,user=>{
  state.user=user;
  if(!user) return;
  const start=()=>ensureUI();
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',start,{once:true}); else start();
});
