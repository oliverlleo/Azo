import { auth, db, doc, getDoc, setDoc, deleteDoc, serverTimestamp, onAuthStateChanged } from '../assets/js/firebase-config.js';

const BUILTINS = [
  { key:'AS', title:'Casa AS', category:'Arquitetura residencial', order:10 },
  { key:'HL', title:'Casa HL', category:'Arquitetura residencial', order:20 },
  { key:'JT', title:'Casa JT', category:'Projeto residencial', order:30 },
  { key:'MN', title:'Casa MN', category:'Arquitetura + construção', order:40 },
  { key:'SE', title:'Casa SE', category:'Projeto residencial', order:50 },
  { key:'EF', title:'Casa EF', category:'Interiores + área de lazer', order:60 }
];

const $ = (s,r=document)=>r.querySelector(s);
const escapeHtml = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
let data = [];
let user = null;

function toast(message, type='success') {
  const stack = $('#toast-stack');
  if (!stack) return alert(message);
  const el = document.createElement('div');
  el.className = `toast ${type}`;
  el.innerHTML = `<b>${type === 'error' ? '!' : '✓'}</b><span>${escapeHtml(message)}</span>`;
  stack.appendChild(el);
  setTimeout(()=>el.remove(),3500);
}

function ensurePanel() {
  const view = $('#view-projects');
  if (!view || $('#existing-projects-panel')) return;
  const panel = document.createElement('section');
  panel.id = 'existing-projects-panel';
  panel.className = 'panel';
  panel.style.marginBottom = '18px';
  panel.innerHTML = `
    <div class="panel-head">
      <div><p class="eyebrow">Projetos que já estão no site</p><h3>Gerencie os projetos atuais</h3></div>
    </div>
    <div class="notice" style="margin-top:0"><b>Aqui ficam os projetos que vieram com o site.</b> Você pode mudar o nome, o tipo, ocultar, mostrar novamente ou abrir diretamente as fotos daquele projeto.</div>
    <div id="existing-project-list" class="project-list"></div>`;
  const toolbar = view.querySelector('.toolbar');
  view.insertBefore(panel, toolbar || view.firstChild);
  ensureModal();
}

function ensureModal() {
  if ($('#existing-project-modal')) return;
  const modal = document.createElement('div');
  modal.className = 'modal';
  modal.id = 'existing-project-modal';
  modal.hidden = true;
  modal.innerHTML = `
    <div class="modal-backdrop" data-existing-close></div>
    <section class="modal-card" role="dialog" aria-modal="true">
      <header><div><p class="eyebrow">Projeto atual do site</p><h2 id="existing-modal-title">Editar projeto</h2></div><button class="icon-button" type="button" data-existing-close aria-label="Fechar">×</button></header>
      <form id="existing-project-form">
        <input type="hidden" id="existing-project-key">
        <label>Nome do projeto<input id="existing-project-title" maxlength="90" required></label>
        <label>Tipo do projeto<input id="existing-project-category" maxlength="90"></label>
        <label>Descrição do projeto<textarea id="existing-project-description" rows="3" maxlength="600" placeholder="Opcional"></textarea></label>
        <label class="switch-field">Mostrar no site <span class="switch"><input id="existing-project-published" type="checkbox"><i></i></span></label>
        <div class="notice" style="margin:0"><b>Fotos:</b> use o botão “Gerenciar fotos” na lista para trocar qualquer imagem deste projeto.</div>
        <footer><button class="btn btn-ghost" type="button" data-existing-close>Cancelar</button><button class="btn btn-primary" type="submit">Salvar alterações</button></footer>
      </form>
    </section>`;
  document.body.appendChild(modal);
  modal.querySelectorAll('[data-existing-close]').forEach(el=>el.addEventListener('click',closeModal));
  $('#existing-project-form').addEventListener('submit',saveProject);
}

function render() {
  ensurePanel();
  const root = $('#existing-project-list');
  if (!root) return;
  root.innerHTML = data.map(project => `
    <article class="project-row">
      <div class="project-thumb"><img src="../assets/images/projects/${project.builtinKey.toLowerCase()}-1.webp" alt="${escapeHtml(project.title)}"></div>
      <div class="project-meta">
        <h3>${escapeHtml(project.title)}</h3>
        <p>${escapeHtml(project.category || 'Projeto')}</p>
        <div class="chips"><span class="status ${project.published ? 'ok' : 'off'}">${project.published ? 'Aparece no site' : 'Oculto do site'}</span><span class="chip">Projeto original</span></div>
      </div>
      <div class="project-actions" style="flex-wrap:wrap;justify-content:flex-end">
        <button class="btn btn-ghost" type="button" data-existing-edit="${project.builtinKey}">Editar</button>
        <button class="btn btn-ghost" type="button" data-existing-photos="${project.builtinKey}">Gerenciar fotos</button>
        <button class="btn ${project.published ? 'btn-danger' : 'btn-primary'}" type="button" data-existing-toggle="${project.builtinKey}">${project.published ? 'Remover do site' : 'Mostrar novamente'}</button>
        ${project.hasOverride ? `<button class="btn btn-ghost" type="button" data-existing-restore="${project.builtinKey}">Voltar ao original</button>` : ''}
      </div>
    </article>`).join('');

  root.querySelectorAll('[data-existing-edit]').forEach(btn=>btn.addEventListener('click',()=>openModal(btn.dataset.existingEdit)));
  root.querySelectorAll('[data-existing-photos]').forEach(btn=>btn.addEventListener('click',()=>openPhotos(btn.dataset.existingPhotos)));
  root.querySelectorAll('[data-existing-toggle]').forEach(btn=>btn.addEventListener('click',()=>toggleProject(btn.dataset.existingToggle)));
  root.querySelectorAll('[data-existing-restore]').forEach(btn=>btn.addEventListener('click',()=>restoreProject(btn.dataset.existingRestore)));
}

function openModal(key) {
  const project = data.find(p=>p.builtinKey===key);
  if (!project) return;
  $('#existing-project-key').value = key;
  $('#existing-project-title').value = project.title || '';
  $('#existing-project-category').value = project.category || '';
  $('#existing-project-description').value = project.description || '';
  $('#existing-project-published').checked = project.published !== false;
  $('#existing-modal-title').textContent = `Editar ${project.title}`;
  $('#existing-project-modal').hidden = false;
  document.body.style.overflow='hidden';
}

function closeModal() {
  $('#existing-project-modal').hidden = true;
  document.body.style.overflow='';
}

async function saveProject(event) {
  event.preventDefault();
  const key = $('#existing-project-key').value;
  const base = BUILTINS.find(p=>p.key===key);
  if (!base || !user) return;
  const button = event.currentTarget.querySelector('button[type="submit"]');
  button.disabled = true;
  button.textContent = 'Salvando...';
  try {
    await setDoc(doc(db,'projectSettings',`builtin-${key}`),{
      builtinKey:key,
      title:$('#existing-project-title').value.trim() || base.title,
      category:$('#existing-project-category').value.trim() || base.category,
      description:$('#existing-project-description').value.trim(),
      published:$('#existing-project-published').checked,
      order:base.order,
      updatedAt:serverTimestamp(),
      updatedBy:user.id || user.uid
    },{merge:true});
    closeModal();
    await load();
    toast('Projeto atualizado no site.');
  } catch (error) {
    toast(error.message || 'Não foi possível salvar o projeto.','error');
  } finally {
    button.disabled=false;
    button.textContent='Salvar alterações';
  }
}

async function toggleProject(key) {
  const project = data.find(p=>p.builtinKey===key);
  const base = BUILTINS.find(p=>p.key===key);
  if (!project || !base || !user) return;
  if (project.published && !confirm(`Remover “${project.title}” do site? As fotos originais não serão apagadas e você poderá mostrar o projeto novamente depois.`)) return;
  try {
    await setDoc(doc(db,'projectSettings',`builtin-${key}`),{
      builtinKey:key,
      title:project.title || base.title,
      category:project.category || base.category,
      description:project.description || '',
      published:!project.published,
      order:base.order,
      updatedAt:serverTimestamp(),
      updatedBy:user.id || user.uid
    },{merge:true});
    await load();
    toast(project.published ? 'Projeto removido do site.' : 'Projeto voltou a aparecer no site.');
  } catch (error) { toast(error.message || 'Não foi possível alterar o projeto.','error'); }
}

async function restoreProject(key) {
  const base = BUILTINS.find(p=>p.key===key);
  if (!base || !confirm(`Voltar “${base.title}” para o nome, tipo e visibilidade originais?`)) return;
  try {
    await deleteDoc(doc(db,'projectSettings',`builtin-${key}`));
    await load();
    toast('Projeto restaurado para o conteúdo original.');
  } catch (error) { toast(error.message || 'Não foi possível restaurar.','error'); }
}

function openPhotos(key) {
  const nav = document.querySelector('[data-view="images"]');
  nav?.click();
  const apply = () => {
    const input = $('#image-search');
    if (!input) return;
    input.value = `projects/${key.toLowerCase()}-`;
    input.dispatchEvent(new Event('input',{bubbles:true}));
  };
  setTimeout(apply,250);
  setTimeout(apply,850);
}

async function load() {
  ensurePanel();
  const root = $('#existing-project-list');
  if (root) root.innerHTML='<div class="loading-grid"><div class="skeleton"></div><div class="skeleton"></div></div>';
  const rows = [];
  for (const base of BUILTINS) {
    const snap = await getDoc(doc(db,'projectSettings',`builtin-${base.key}`));
    const saved = snap.exists() ? snap.data() : {};
    rows.push({
      ...base,
      ...saved,
      id:`builtin-${base.key}`,
      builtinKey:base.key,
      hasOverride:snap.exists(),
      published:saved.published !== false
    });
  }
  data = rows;
  render();
}

onAuthStateChanged(auth, current => {
  user = current;
  if (!current) return;
  const start = () => load().catch(error=>toast(error.message || 'Não foi possível carregar os projetos atuais.','error'));
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded',start,{once:true}); else start();
});