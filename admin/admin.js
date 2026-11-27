import {registerProject,completedImages} from './project-registration.mjs?v=20261126-resume';
import {saveQueue,loadQueue,removeQueue,listQueues} from './project-registration-local.js?v=20261126-resume';
import {prepareImageUpload} from '../assets/js/image-upload.js?v=20261126-resume';
import {supabase,supabaseConfig} from '../assets/js/firebase-config.js';
import {openCoverEditor,customCoverPhotos} from './project-cover-editor.js?v=20261127-portfolio';
import {readProjectPresentation} from '../assets/js/project-cover-store.js';
import {coverId,chooseCover,portfolioDetails} from '../assets/js/project-cover.mjs';
let customCovers=new Map();
import { auth, db, storage } from '../assets/js/firebase-config.js';
import {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut,
  sendPasswordResetEmail
} from 'https://www.gstatic.com/firebasejs/12.16.0/firebase-auth.js';
import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  deleteDoc,
  serverTimestamp
} from 'https://www.gstatic.com/firebasejs/12.16.0/firebase-firestore.js';
import {
  ref,
  uploadBytesResumable,
  getDownloadURL,
  deleteObject
} from 'https://www.gstatic.com/firebasejs/12.16.0/firebase-storage.js';
import { scanDocument, assetDocId } from '../assets/js/cms-core.js';
import { PROJECT_KEYS, projectPhotoPath, isAddedPhoto } from '../assets/js/project-photo-visibility.mjs';
import { readProjectPhotoVisibility, setProjectPhotoHidden, addProjectPhoto, requirePhotoAdmin } from '../assets/js/project-photo-store.js';

const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];

const PAGES = [
  { id: 'index', file: 'index.html', label: 'Início' },
  { id: 'servicos', file: 'servicos.html', label: 'Serviços' },
  { id: 'projetos', file: 'projetos.html', label: 'Projetos' },
  { id: 'sobre', file: 'sobre.html', label: 'Sobre' },
  { id: 'contato', file: 'contato.html', label: 'Contato' },
  { id: 'projeto-arquitetonico', file: 'projeto-arquitetonico.html', label: 'Projeto arquitetônico' },
  { id: 'interiores', file: 'interiores.html', label: 'Interiores' },
  { id: 'gestao-de-obras', file: 'gestao-de-obras.html', label: 'Gestão de obras' }
];

const state = {
  user: null,
  admin: null,
  currentView: 'dashboard',
  currentPage: 'index',
  contentItems: [],
  assetManifest: [],
  assetOverrides: new Map(),
  hiddenProjectPhotos: new Set(),
  addedProjectPhotos: new Map(),
  imageFilter: 'all',
  imageSearch: '',
  pendingAssetPath: null,
  projects: [],
  projectImages: [],
  removedProjectStorage: [],
  projectObjectUrls: [],
  projectSaving:false, projectPause:false, projectDirty:false, projectId:'', projectLocal:false, projectAfterPause:null, projectPhase:'', projectOpenToken:0
};

const viewMeta = {
  dashboard: ['Painel administrativo', 'Visão geral'],
  content: ['Conteúdo do site', 'Textos & títulos'],
  images: ['Firebase Storage', 'Todas as imagens'],
  projects: ['Portfólio', 'Projetos'],
  security: ['Acesso administrativo', 'Segurança']
};

function escapeHtml(value = '') {
  return String(value).replace(/[&<>'"]/g, char => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', "'":'&#39;', '"':'&quot;' }[char]));
}

function toast(message, type = 'success', timeout = 3600) {
  const stack = $('#toast-stack');
  const el = document.createElement('div');
  el.className = `toast ${type}`;
  el.innerHTML = `<b>${type === 'error' ? '!' : '✓'}</b><span>${escapeHtml(message)}</span>`;
  stack.appendChild(el);
  setTimeout(() => el.remove(), timeout);
}

function setSync(message, error = false) {
  const el = $('#sync-status');
  el.classList.toggle('error', error);
  el.lastChild.textContent = message;
}

function friendlyAuthError(error) {
  const code = error?.code || '';
  if (code.includes('invalid-credential') || code.includes('wrong-password') || code.includes('user-not-found')) return 'E-mail ou senha incorretos.';
  if (code.includes('too-many-requests')) return 'Muitas tentativas. Aguarde alguns minutos e tente novamente.';
  if (code.includes('network-request-failed')) return 'Não foi possível conectar ao Firebase.';
  return error?.message || 'Não foi possível entrar.';
}

function setLoginMessage(message, error = true) {
  const el = $('#login-message');
  el.textContent = message || '';
  el.style.color = error ? 'var(--danger)' : 'var(--ok)';
}

function showLogin() {
  $('#login-screen').hidden = false;
  $('#app-shell').hidden = true;
}

function showApp() {
  $('#login-screen').hidden = true;
  $('#app-shell').hidden = false;
  $('#user-email').textContent = state.user.email || '';
  $('#security-email').textContent = state.user.email || '—';
  $('#security-uid').textContent = state.user.uid;
  const name = state.admin?.name || 'Administrador';
  $('#user-name').textContent = name;
  $('#user-avatar').textContent = name.slice(0, 1).toUpperCase();
  populatePageSelect();
  navigate('dashboard');
}

async function verifyAdmin(user) {
  const snap = await getDoc(doc(db, 'admins', user.uid));
  if (!snap.exists()) return null;
  const data = snap.data();
  return data.active === true ? data : null;
}

$('#login-form').addEventListener('submit', async event => {
  event.preventDefault();
  setLoginMessage('');
  const button = event.currentTarget.querySelector('button[type="submit"]');
  button.disabled = true;
  button.querySelector('span').textContent = 'Entrando...';
  try {
    await signInWithEmailAndPassword(auth, $('#login-email').value.trim(), $('#login-password').value);
  } catch (error) {
    setLoginMessage(friendlyAuthError(error));
  } finally {
    button.disabled = false;
    button.querySelector('span').textContent = 'Entrar no painel';
  }
});

$('#forgot-password').addEventListener('click', async () => {
  const email = $('#login-email').value.trim();
  if (!email) return setLoginMessage('Digite seu e-mail primeiro.');
  try {
    await sendPasswordResetEmail(auth, email);
    setLoginMessage('E-mail de redefinição enviado.', false);
  } catch (error) {
    setLoginMessage(friendlyAuthError(error));
  }
});

$('#logout-button').addEventListener('click', () => signOut(auth));
$('#reset-password').addEventListener('click', async () => {
  if (!state.user?.email) return;
  try {
    await sendPasswordResetEmail(auth, state.user.email);
    toast('E-mail de redefinição de senha enviado.');
  } catch (error) {
    toast(friendlyAuthError(error), 'error');
  }
});

onAuthStateChanged(auth, async user => {
  if (!user) {
    state.user = null;
    state.admin = null;
    showLogin();
    return;
  }
  try {
    const admin = await verifyAdmin(user);
    if (!admin) {
      await signOut(auth);
      setLoginMessage('Esta conta não possui permissão administrativa.');
      return;
    }
    state.user = user;
    state.admin = admin;
    showApp();
  } catch (error) {
    await signOut(auth).catch(() => {});
    setLoginMessage('Não foi possível validar a permissão administrativa. Verifique as regras do Firestore.');
  }
});

function navigate(view) {
  state.currentView = view;
  $$('.nav-item[data-view]').forEach(button => button.classList.toggle('active', button.dataset.view === view));
  $$('.view').forEach(panel => panel.classList.toggle('active', panel.id === `view-${view}`));
  $('#view-kicker').textContent = viewMeta[view]?.[0] || 'Administração';
  $('#view-title').textContent = viewMeta[view]?.[1] || view;
  $('#app-shell').classList.remove('menu-open');
  if (view === 'dashboard') loadDashboard();
  if (view === 'content') loadContentEditor();
  if (view === 'images') loadImages();
  if (view === 'projects') loadProjects();
}

$$('.nav-item[data-view]').forEach(button => button.addEventListener('click', () => navigate(button.dataset.view)));
$$('[data-go]').forEach(button => button.addEventListener('click', () => navigate(button.dataset.go)));
$('#mobile-menu').addEventListener('click', () => $('#app-shell').classList.toggle('menu-open'));

async function loadDashboard() {
  try {
    setSync('Sincronizando...');
    const [projectsSnap, assetsSnap] = await Promise.all([
      getDocs(collection(db, 'projects')),
      getDocs(collection(db, 'assets'))
    ]);
    $('#stat-projects').textContent = projectsSnap.size;
    $('#stat-replacements').textContent = assetsSnap.size;
    setSync('Firebase conectado');
  } catch (error) {
    $('#stat-projects').textContent = '—';
    $('#stat-replacements').textContent = '—';
    setSync('Falha de conexão', true);
  }
}

function populatePageSelect() {
  const select = $('#page-select');
  select.innerHTML = PAGES.map(page => `<option value="${page.id}">${escapeHtml(page.label)}</option>`).join('');
  select.value = state.currentPage;
}

$('#page-select').addEventListener('change', event => {
  state.currentPage = event.target.value;
  loadContentEditor();
});
$('#reload-content').addEventListener('click', loadContentEditor);

async function fetchPageDocument(page) {
  const response = await fetch(`../${page.file}?cms-editor=${Date.now()}`, { cache: 'no-store' });
  if (!response.ok) throw new Error(`Não foi possível carregar ${page.file}`);
  const html = await response.text();
  return new DOMParser().parseFromString(html, 'text/html');
}

function renderContentFields(items) {
  const root = $('#content-fields');
  if (!items.length) {
    root.innerHTML = '<div class="empty-state">Nenhum texto editável encontrado nesta página.</div>';
    return;
  }
  root.innerHTML = items.map((item, index) => `
    <article class="content-card" data-index="${index}">
      <div class="content-card-head"><div><span>${escapeHtml(item.context || item.type)}</span></div><button type="button" data-restore="${index}">Restaurar original</button></div>
      <textarea data-content-input="${index}" spellcheck="true">${escapeHtml(item.value)}</textarea>
      <div class="original-text"><b>Original:</b> ${escapeHtml(item.original)}</div>
    </article>`).join('');

  $$('[data-content-input]', root).forEach(input => input.addEventListener('input', event => {
    const index = Number(event.target.dataset.contentInput);
    state.contentItems[index].value = event.target.value;
    event.target.closest('.content-card').classList.toggle('changed', event.target.value !== state.contentItems[index].original);
  }));
  $$('[data-restore]', root).forEach(button => button.addEventListener('click', () => {
    const index = Number(button.dataset.restore);
    const item = state.contentItems[index];
    item.value = item.original;
    const textarea = root.querySelector(`[data-content-input="${index}"]`);
    textarea.value = item.original;
    textarea.closest('.content-card').classList.remove('changed');
  }));
}

async function loadContentEditor() {
  const root = $('#content-fields');
  root.innerHTML = '<div class="loading-grid"><div class="skeleton"></div><div class="skeleton"></div><div class="skeleton"></div></div>';
  const page = PAGES.find(item => item.id === state.currentPage) || PAGES[0];
  try {
    setSync('Carregando conteúdo...');
    const [pageDoc, savedSnap] = await Promise.all([
      fetchPageDocument(page),
      getDoc(doc(db, 'sitePages', page.id))
    ]);
    const scanned = scanDocument(pageDoc).filter(item => item.type === 'text' || item.type === 'head');
    const saved = savedSnap.exists() && Array.isArray(savedSnap.data().items) ? savedSnap.data().items : [];
    const overrides = new Map(saved.map(item => [item.key, item]));
    state.contentItems = scanned.map(item => ({ ...item, value: overrides.get(item.key)?.value ?? item.original }));
    renderContentFields(state.contentItems);
    setSync('Firebase conectado');
  } catch (error) {
    root.innerHTML = `<div class="empty-state">${escapeHtml(error.message || 'Falha ao carregar a página.')}</div>`;
    setSync('Falha ao carregar', true);
  }
}

$('#save-content').addEventListener('click', async () => {
  const page = PAGES.find(item => item.id === state.currentPage) || PAGES[0];
  const button = $('#save-content');
  button.disabled = true;
  button.textContent = 'Salvando...';
  try {
    const refDoc = doc(db, 'sitePages', page.id);
    const existingSnap = await getDoc(refDoc);
    const existingItems = existingSnap.exists() && Array.isArray(existingSnap.data().items) ? existingSnap.data().items : [];
    const preserved = existingItems.filter(item => item.type !== 'text' && item.type !== 'head');
    const changed = state.contentItems
      .filter(item => item.value !== item.original)
      .map(item => ({ key: item.key, type: item.type, value: item.value }));
    await setDoc(refDoc, {
      page: page.id,
      items: [...preserved, ...changed],
      updatedAt: serverTimestamp(),
      updatedBy: state.user.uid
    }, { merge: true });
    $$('.content-card').forEach((card, index) => card.classList.toggle('changed', state.contentItems[index]?.value !== state.contentItems[index]?.original));
    toast(`Conteúdo de ${page.label} salvo.`);
  } catch (error) {
    toast(error.message || 'Não foi possível salvar.', 'error');
  } finally {
    button.disabled = false;
    button.textContent = 'Salvar alterações';
  }
});

async function ensureImageData() {
  if (!state.assetManifest.length) {
    const response = await fetch('../assets/data/image-manifest.json', { cache: 'no-store' });
    if (!response.ok) throw new Error('Manifesto de imagens não encontrado.');
    const data = await response.json();
    state.assetManifest = data.assets || [];
    $('#stat-images').textContent = data.count || state.assetManifest.length;
  }
  const [snap, visibility] = await Promise.all([getDocs(collection(db, 'assets')), readProjectPhotoVisibility()]);
  state.hiddenProjectPhotos = visibility.hidden;
  state.addedProjectPhotos = visibility.additions;
  state.assetOverrides = new Map();
  snap.forEach(item => {
    const data = item.data();
    if (data?.path) state.assetOverrides.set(data.path, { id: item.id, ...data });
  });
}

function imageCategory(path) {
  return path.includes('/projects/') ? 'projects' : 'main';
}

function imageLabel(path) {
  return path.split('/').pop() || path;
}

function renderAssets() {
  const root = $('#asset-grid');
  const search = state.imageSearch.toLowerCase();
  let paths = [...state.assetManifest,...state.addedProjectPhotos.keys()].filter(path => {
    if (search && !path.toLowerCase().includes(search)) return false;
    if (state.imageFilter === 'hidden') return state.hiddenProjectPhotos.has(projectPhotoPath(path));
    if (state.imageFilter === 'replaced') return state.assetOverrides.has(path);
    if (state.imageFilter === 'projects') return imageCategory(path) === 'projects';
    if (state.imageFilter === 'main') return imageCategory(path) === 'main';
    return true;
  });
  if (!paths.length) {
    root.innerHTML = '<div class="empty-state">Nenhuma imagem encontrada com esse filtro.</div>';
    return;
  }
  root.innerHTML = paths.map(path => {
    const override = state.assetOverrides.get(path);
    const added = state.addedProjectPhotos.get(path);
    const src = added?.url || override?.url || `../${path}`;
    const photo = projectPhotoPath(path);
    const hidden = photo && state.hiddenProjectPhotos.has(photo);
    return `<article class="asset-card ${override ? 'replaced' : ''} ${hidden ? 'asset-hidden' : ''}" data-asset="${escapeHtml(path)}">
      <div class="asset-preview"><img src="${escapeHtml(src)}" alt="${escapeHtml(imageLabel(path))}" loading="lazy"></div>
      <div class="asset-info"><strong title="${escapeHtml(imageLabel(path))}">${escapeHtml(imageLabel(path))}</strong><small title="${escapeHtml(path)}">${escapeHtml(path)}</small></div>
      ${hidden ? '<div class="asset-visibility-status">Excluída do site</div>' : ''}
      <div class="asset-actions">
        ${added ? '' : `<button class="btn btn-ghost" data-replace-asset="${escapeHtml(path)}">Substituir</button>`}
        ${override ? `<button class="btn btn-ghost" data-restore-asset="${escapeHtml(path)}">Restaurar</button>` : ''}
        ${photo ? hidden ? `<button class="btn btn-primary" data-show-photo="${escapeHtml(photo)}">Mostrar novamente</button>` : `<button class="btn btn-danger" data-delete-photo="${escapeHtml(photo)}">Excluir imagem</button>` : ''}
      </div>
    </article>`;
  }).join('');
  $$('[data-replace-asset]', root).forEach(button => button.addEventListener('click', () => {
    state.pendingAssetPath = button.dataset.replaceAsset;
    $('#asset-file-input').value = '';
    $('#asset-file-input').click();
  }));
  $$('[data-restore-asset]', root).forEach(button => button.addEventListener('click', () => restoreAsset(button.dataset.restoreAsset)));
  $$('[data-delete-photo]', root).forEach(button => button.addEventListener('click', () => confirmPhotoDeletion(button.dataset.deletePhoto)));
  $$('[data-show-photo]', root).forEach(button => button.addEventListener('click', async () => {
    button.disabled = true;
    try {
      await setProjectPhotoHidden(button.dataset.showPhoto, false, state.user);
      state.hiddenProjectPhotos.delete(button.dataset.showPhoto);
      renderAssets();
      toast('Imagem voltou a aparecer no site.');
    } catch (error) { toast(error.message || 'Não foi possível restaurar a visibilidade.', 'error'); }
    finally { button.disabled = false; }
  }));
}

function confirmPhotoDeletion(path) {
  if (!state.user || !state.admin || !projectPhotoPath(path) || document.getElementById('photo-delete-dialog')) return;
  const [code,number] = path.split('/').pop().replace('.webp','').split('-');
  const dialog = document.createElement('dialog');
  dialog.id = 'photo-delete-dialog';
  dialog.className = 'photo-delete-dialog';
  dialog.setAttribute('aria-labelledby','photo-delete-title');
  dialog.setAttribute('aria-describedby','photo-delete-description');
  dialog.innerHTML = `
    <div class="photo-delete-heading"><span class="photo-delete-icon" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18M8 6V4h8v2M5 6l1 14h12l1-14M10 10v6M14 10v6"/></svg></span><button type="button" class="icon-button photo-delete-close" aria-label="Fechar">×</button></div>
    <p class="eyebrow">Gerenciar galeria</p>
    <h2 id="photo-delete-title">Excluir esta imagem?</h2>
    <div class="photo-delete-preview"><img alt=""><div><strong></strong><small>Imagem do projeto</small></div></div>
    <p id="photo-delete-description">A foto deixará de aparecer no site, inclusive na galeria e na versão para celular. As demais fotos do projeto serão mantidas. Você poderá mostrar esta imagem novamente pelo painel.</p>
    <p class="photo-delete-error" role="alert" hidden></p>
    <footer><button type="button" class="btn btn-ghost photo-delete-cancel" autofocus>Cancelar</button><button type="button" class="btn btn-danger photo-delete-confirm">Excluir imagem</button></footer>`;
  const preview = state.addedProjectPhotos.get(path)?.url || state.assetOverrides.get(path)?.url || '../'+path;
  dialog.querySelector('img').src = preview;
  dialog.querySelector('strong').textContent = `Casa ${code.toUpperCase()} — ${isAddedPhoto(path)?'foto adicionada':'foto '+number}`;
  const cancel = dialog.querySelector('.photo-delete-cancel');
  const close = dialog.querySelector('.photo-delete-close');
  const confirm = dialog.querySelector('.photo-delete-confirm');
  const errorMessage = dialog.querySelector('.photo-delete-error');
  let saving = false;
  dialog.addEventListener('close',()=>dialog.remove(),{once:true});
  dialog.addEventListener('cancel',event=>{if(saving)event.preventDefault();});
  cancel.addEventListener('click',()=>dialog.close());
  close.addEventListener('click',()=>dialog.close());
  confirm.addEventListener('click',async()=>{
    if (saving) return;
    saving=true;
    cancel.disabled=close.disabled=confirm.disabled=true;
    confirm.textContent='Excluindo...';
    errorMessage.hidden=true;
    try {
      await setProjectPhotoHidden(path,true,state.user);
      state.hiddenProjectPhotos.add(path);
      dialog.close();
      renderAssets();
      toast('Imagem excluída do site.');
    } catch (error) {
      errorMessage.textContent=error.message || 'Não foi possível excluir. Tente novamente.';
      errorMessage.hidden=false;
    } finally {
      saving=false;
      cancel.disabled=close.disabled=confirm.disabled=false;
      confirm.textContent='Excluir imagem';
    }
  });
  document.body.appendChild(dialog);
  dialog.showModal();
}

function openAddPhotosDialog(initialKey) {
  if(!state.user||!state.admin||$('#photo-add-dialog'))return;
  const dialog=document.createElement('dialog');
  dialog.id='photo-add-dialog';dialog.className='photo-delete-dialog';
  dialog.setAttribute('aria-labelledby','photo-add-title');
  dialog.innerHTML=`<p class="eyebrow">Gerenciar galeria</p><h2 id="photo-add-title">Adicionar fotos</h2><p>Escolha o projeto e selecione uma ou mais imagens. As novas fotos serão exibidas na mesma galeria.</p><form><label>Projeto<select name="project" required>${PROJECT_KEYS.map(key=>`<option value="${key}">Casa ${key}</option>`).join('')}</select></label><label>Imagens (até 30 MB cada)<input type="file" name="photos" accept="image/jpeg,image/png,image/webp,image/avif,image/gif" multiple required></label><p class="photo-add-progress" role="status"></p><p class="photo-delete-error" role="alert" hidden></p><footer><button type="button" class="btn btn-ghost photo-add-cancel">Cancelar</button><button type="submit" class="btn btn-primary">Adicionar fotos</button></footer></form>`;
  const form=dialog.querySelector('form'), cancel=dialog.querySelector('.photo-add-cancel'), submit=form.querySelector('[type=submit]'), progress=dialog.querySelector('.photo-add-progress'), errorEl=dialog.querySelector('.photo-delete-error');
  if(PROJECT_KEYS.includes(initialKey))form.elements.project.value=initialKey;
  let busy=false;
  dialog.addEventListener('close',()=>dialog.remove(),{once:true});
  dialog.addEventListener('cancel',event=>{if(busy)event.preventDefault()});
  cancel.addEventListener('click',()=>dialog.close());
  form.addEventListener('submit',async event=>{
    event.preventDefault();if(busy)return;
    const key=form.elements.project.value, selected=[...form.elements.photos.files];
    if(!PROJECT_KEYS.includes(key)||!selected.length)return;
    if(selected.some(file=>!['image/jpeg','image/png','image/webp','image/avif','image/gif'].includes(file.type)||file.size>30*1024*1024)){
      errorEl.textContent='Selecione imagens válidas de até 30 MB cada.';errorEl.hidden=false;return;
    }
    busy=true;cancel.disabled=submit.disabled=true;form.elements.project.disabled=form.elements.photos.disabled=true;errorEl.hidden=true;
    let completed=0;
    try{
      await requirePhotoAdmin(state.user);
      for(const file of selected){
        const id=crypto.randomUUID(),path=`assets/images/projects/${key.toLowerCase()}-extra-${id}.webp`;
        progress.textContent=`Enviando ${completed+1} de ${selected.length}…`;
        const uploaded=await uploadFile(file,`site/assets/projects/${key.toLowerCase()}-${id}-${safeStorageSegment(file.name)}`);
        await addProjectPhoto(path,uploaded,state.user);
        completed++;
      }
      dialog.close();
      if(state.currentView==='images')await loadImages();
      toast(`${completed} foto(s) adicionada(s) ao projeto.`);
    }catch(error){
      errorEl.textContent=`${completed} foto(s) salva(s). ${error.message||'Falha ao adicionar as demais.'} Selecione apenas as fotos que faltaram para tentar novamente.`;errorEl.hidden=false;
      form.elements.photos.value='';
      if(state.currentView==='images')await loadImages();
    }finally{busy=false;cancel.disabled=submit.disabled=false;form.elements.project.disabled=form.elements.photos.disabled=false;progress.textContent='';}
  });
  document.body.appendChild(dialog);dialog.showModal();
}
$('#add-project-photos').addEventListener('click',()=>openAddPhotosDialog());
window.addEventListener('azo:add-project-photos',event=>openAddPhotosDialog(event.detail?.key));

async function loadImages() {
  $('#asset-grid').innerHTML = '<div class="loading-grid"><div class="skeleton"></div><div class="skeleton"></div></div>';
  try {
    setSync('Carregando imagens...');
    await ensureImageData();
    renderAssets();
    setSync('Firebase conectado');
  } catch (error) {
    $('#asset-grid').innerHTML = `<div class="empty-state">${escapeHtml(error.message || 'Não foi possível carregar as imagens.')}</div>`;
    setSync('Falha ao carregar', true);
  }
}

$('#image-search').addEventListener('input', event => {
  state.imageSearch = event.target.value;
  renderAssets();
});
$$('[data-image-filter]').forEach(button => button.addEventListener('click', () => {
  $$('[data-image-filter]').forEach(item => item.classList.toggle('active', item === button));
  state.imageFilter = button.dataset.imageFilter;
  renderAssets();
}));

function safeStorageSegment(value = '') {
  return value.normalize('NFKD').replace(/[^a-zA-Z0-9._-]+/g, '-').replace(/^-+|-+$/g, '') || 'arquivo';
}

function uploadFile(file, storagePath, progressCallback) {
  return new Promise((resolve, reject) => {
    const fileRef = ref(storage, storagePath);
    const task = uploadBytesResumable(fileRef, file, { contentType: file.type, cacheControl: 'public,max-age=31536000,immutable' });
    task.on('state_changed', snapshot => {
      progressCallback?.(snapshot.bytesTransferred / snapshot.totalBytes);
    }, reject, async () => {
      try { const url = await getDownloadURL(task.snapshot.ref);if(!url)throw Error('Endereço da imagem indisponível.');resolve({ url, storagePath: task.snapshot.ref.fullPath, fileName: task.snapshot.fileName, contentType: task.snapshot.contentType, size: task.snapshot.size }); } catch(error){reject(error)}
    });
  });
}

$('#asset-file-input').addEventListener('change', async event => {
  const file = event.target.files?.[0];
  const path = state.pendingAssetPath;
  if (!file || !path) return;
  if (!file.type.startsWith('image/')) return toast('Escolha um arquivo de imagem.', 'error');
  if (file.size > 30 * 1024 * 1024) return toast('A imagem deve ter no máximo 30 MB.', 'error');
  const previous = state.assetOverrides.get(path);
  const folder = path.replace(/^assets\/images\//, '').split('/').slice(0, -1).map(safeStorageSegment).join('/');
  const storagePath = `site/assets/${folder ? folder + '/' : ''}${Date.now()}-${safeStorageSegment(file.name)}`;
  try {
    setSync('Enviando imagem...');
    const uploaded = await uploadFile(file, storagePath);
    const id = assetDocId(path);
    await setDoc(doc(db, 'assets', id), {
      path,
      url: uploaded.url,
      storagePath: uploaded.storagePath,
      fileName: uploaded.fileName,
      contentType: uploaded.contentType,
      size: uploaded.size,
      updatedAt: serverTimestamp(),
      updatedBy: state.user.uid
    });
    if (previous?.storagePath && previous.storagePath !== uploaded.storagePath) deleteObject(ref(storage, previous.storagePath)).catch(() => {});
    await ensureImageData();
    renderAssets();
    toast(`${imageLabel(path)} substituída no Storage.`);
    setSync('Firebase conectado');
  } catch (error) {
    toast(error.message || 'Falha no upload da imagem.', 'error');
    setSync('Falha no upload', true);
  }
});

async function restoreAsset(path) {
  const override = state.assetOverrides.get(path);
  if (!override) return;
  if (!confirm(`Restaurar a imagem original de ${imageLabel(path)}?`)) return;
  try {
    await deleteDoc(doc(db, 'assets', override.id || assetDocId(path)));
    if (override.storagePath) deleteObject(ref(storage, override.storagePath)).catch(() => {});
    state.assetOverrides.delete(path);
    renderAssets();
    toast('Imagem original restaurada.');
  } catch (error) {
    toast(error.message || 'Não foi possível restaurar a imagem.', 'error');
  }
}

async function loadProjects() {
  const root = $('#project-list');
  root.innerHTML = '<div class="loading-grid"><div class="skeleton"></div><div class="skeleton"></div></div>';
  try {
    const [snap,covers]=await Promise.all([getDocs(collection(db, 'projects')),readProjectPresentation().catch(()=>new Map())]);customCovers=covers;
    state.projects = snap.docs.map(item => ({ id: item.id, ...item.data() })).sort((a,b) => (Number(a.order) || 9999) - (Number(b.order) || 9999));
    const pending=await listQueues(state.user?.id||state.user?.uid||'').catch(()=>[]);
    for(const draft of pending){if(!draft?.id||!draft.metadata)continue;const p=state.projects.find(p=>p.id===draft.id);if(p)p.pendingRegistration=true;else state.projects.push({id:draft.id,...draft.metadata,published:false,images:completedImages(draft.queue||[],draft.metadata.title),pendingRegistration:true,localOnly:true});}
    renderProjects();
  } catch (error) {
    root.innerHTML = `<div class="empty-state">${escapeHtml(error.message || 'Não foi possível carregar os projetos.')}</div>`;
  }
}

function renderProjects() {
  const root = $('#project-list');
  if (!state.projects.length) {
    root.innerHTML = '<div class="empty-state"><b>Nenhum projeto extra ainda.</b><br>Use “Novo projeto” para criar uma nova galeria no site.</div>';
    return;
  }
  root.innerHTML = state.projects.map(project => {
    const setting=customCovers.get(coverId('custom',project.id));
    const cover=chooseCover(setting?.cover,customCoverPhotos(project),project.coverUrl||project.images?.[0]?.url).url;
    const placement=portfolioDetails(setting,project.order);
    const portfolioLabel=placement.section==='interiores'?'Interiores':'Exteriores';
    return `<article class="project-row">
      <div class="project-thumb">${cover ? `<img src="${escapeHtml(cover)}" alt="">` : ''}</div>
      <div class="project-meta"><h3>${escapeHtml(project.title || 'Sem título')}</h3><p>${escapeHtml(project.category || 'Projeto')} · ${project.images?.length || 0} imagem(ns)</p><div class="chips"><span class="status ${project.published === false ? 'off' : 'ok'}">${project.published === false ? 'Rascunho' : 'Publicado'}</span><span class="chip">${portfolioLabel} · ordem ${placement.order}</span>${project.pendingRegistration?'<span class="chip">Cadastro pendente</span>':''}</div></div>
      <div class="project-actions"><button class="btn btn-ghost" data-edit-project="${escapeHtml(project.id)}">${project.pendingRegistration||project.published===false?'Continuar / editar':'Editar'}</button>${project.localOnly?'':`<button class="btn btn-ghost" data-cover-project="${escapeHtml(project.id)}">Editar portfólio e capa</button>`}<button class="btn btn-danger" data-delete-project="${escapeHtml(project.id)}">Excluir</button></div>
    </article>`;
  }).join('');
  $$('[data-cover-project]', root).forEach(btn=>btn.addEventListener('click',async()=>{btn.disabled=true;try{const project=state.projects.find(p=>p.id===btn.dataset.coverProject);if(!project)return;const covers=await readProjectPresentation();await openCoverEditor({kind:'custom',id:project.id,title:project.title,order:project.order,photos:customCoverPhotos(project),setting:covers.get(coverId('custom',project.id)),fallback:project.coverUrl||project.images?.[0]?.url,onSaved:async()=>{await loadProjects();toast('Portfólio e capa atualizados.')}})}catch(e){toast(e.message||'Não foi possível abrir o editor de portfólio.','error')}finally{btn.disabled=false}}));
  $$('[data-edit-project]', root).forEach(button => button.addEventListener('click', () => openProjectModal(button.dataset.editProject)));
  $$('[data-delete-project]', root).forEach(button => button.addEventListener('click', () => deleteProject(button.dataset.deleteProject)));
}

function cleanupObjectUrls() {
  state.projectObjectUrls.forEach(url => URL.revokeObjectURL(url));
  state.projectObjectUrls = [];
}

function projectMetadata(){
 return {title:$('#project-title').value.trim(),category:$('#project-category').value.trim()||'Projeto',description:$('#project-description').value.trim(),order:Number($('#project-order').value),published:$('#project-published').checked};
}
function applyProjectMetadata(p){
 $('#project-title').value=p?.title||'';$('#project-category').value=p?.category||'';$('#project-description').value=p?.description||'';
 $('#project-order').value=portfolioDetails(null,p?.order).order;$('#project-published').checked=p?.published!==false;
}
function projectError(message=''){const el=$('#project-save-error');el.textContent=message;el.hidden=!message}
async function openProjectModal(projectId=''){
 if(state.projectSaving)return;
 const token=++state.projectOpenToken;cleanupObjectUrls();state.removedProjectStorage=[];state.projectDirty=false;state.projectPause=false;state.projectLocal=false;
 const project=projectId?state.projects.find(p=>p.id===projectId):null;
 state.projectId=projectId||crypto.randomUUID();
 $('#project-id').value=projectId||'';applyProjectMetadata(project);
 $('#project-modal-title').textContent=project?'Editar projeto':'Novo projeto';$('#project-files').value='';
 state.projectImages=(project?.images||[]).map((image,index)=>({...image,id:image.id||'existing-'+index,isNew:false}));
 $('#project-progress').hidden=true;projectError();$('#project-local-warning').hidden=true;
 const uid=state.user?.id||state.user?.uid;
 if(projectId&&uid){
  const draft=await loadQueue(uid,projectId).catch(()=>null);
  if(token!==state.projectOpenToken)return;
  if(draft?.metadata&&Array.isArray(draft.queue)){
   applyProjectMetadata(draft.metadata);state.removedProjectStorage=draft.removed||[];
   state.projectImages=draft.queue.map(image=>{const item={...image,isNew:!image.url};if(item.file&&!item.url){item.preview=URL.createObjectURL(item.file);state.projectObjectUrls.push(item.preview)}return item});
   state.projectLocal=true;$('#project-modal-title').textContent='Continuar cadastro';
   $('#project-local-warning').textContent='Cadastro recuperado. As imagens já enviadas serão reaproveitadas.';$('#project-local-warning').hidden=false;
  }else if(project?.published===false){$('#project-local-warning').textContent='Rascunho salvo. Confira as fotos já enviadas e adicione as que faltam.';$('#project-local-warning').hidden=false}
 }
 renderProjectImages();$('#project-modal').hidden=false;document.body.style.overflow='hidden';
}
function closeProjectModalNow(){
 state.projectOpenToken++;$('#project-modal').hidden=true;document.body.style.overflow='';state.projectDirty=false;cleanupObjectUrls();
}
function askProjectExit(after){
 if($('#project-exit-dialog').open)return;
 const busy=state.projectSaving;
 $('#project-exit-message').textContent=busy?'O cadastro ainda está em andamento. Ao pausar, a etapa atual será concluída. As imagens já registradas serão preservadas; os arquivos pendentes poderão ser retomados neste navegador quando o armazenamento local estiver disponível.':'Há alterações neste formulário. Se sair, alterações ainda não salvas podem ser perdidas.';
 $('#project-exit-confirm').textContent=busy?'Pausar após esta etapa':'Sair mesmo assim';
 const d=$('#project-exit-dialog');
 $('#project-exit-confirm').onclick=()=>{d.close();if(state.projectSaving){state.projectPause=true;state.projectAfterPause=after;$('#project-progress-label').textContent='Pausa solicitada. Concluindo a etapa atual…';}else{closeProjectModalNow();after?.()}};
 d.showModal();
}
function requestProjectExit(after){
 if(state.projectSaving||state.projectDirty){askProjectExit(after);return}
 closeProjectModalNow();after?.();
}
$('#project-exit-stay').addEventListener('click',()=>$('#project-exit-dialog').close());
$('#new-project').addEventListener('click',()=>openProjectModal());
$$('[data-close-modal]').forEach(el=>el.addEventListener('click',()=>requestProjectExit()));
$('#project-form').addEventListener('input',()=>{if(!state.projectSaving)state.projectDirty=true});
window.addEventListener('beforeunload',event=>{if(state.projectSaving||(!$('#project-modal').hidden&&state.projectDirty)){event.preventDefault();event.returnValue=''}});
document.addEventListener('keydown',event=>{if(event.key==='Escape'&&!$('#project-modal').hidden&&!$('#project-exit-dialog').open){event.preventDefault();requestProjectExit()}});
document.addEventListener('click',event=>{
 const target=event.target.closest?.('.nav-item,[data-go],#logout-button');
 if(!target||$('#project-modal').hidden||(!state.projectSaving&&!state.projectDirty))return;
 event.preventDefault();event.stopImmediatePropagation();requestProjectExit(()=>target.click());
},true);

function addProjectFiles(files) {
  if(state.projectSaving)return;
  for (const file of files) {
    if (!file.type.startsWith('image/')) continue;
    if (file.size > 30 * 1024 * 1024) {
      toast(`${file.name} excede 30 MB.`, 'error');
      continue;
    }
    const preview = URL.createObjectURL(file);
    state.projectObjectUrls.push(preview);
    state.projectImages.push({ id: crypto.randomUUID(), file, preview, isNew: true, alt: '' });
    state.projectDirty=true;
  }
  renderProjectImages();
}

$('#project-files').addEventListener('change', event => addProjectFiles([...event.target.files]));
const uploadZone = $('#project-upload-zone');
['dragenter','dragover'].forEach(type => uploadZone.addEventListener(type, event => { event.preventDefault(); uploadZone.classList.add('drag'); }));
['dragleave','drop'].forEach(type => uploadZone.addEventListener(type, event => { event.preventDefault(); uploadZone.classList.remove('drag'); }));
uploadZone.addEventListener('drop', event => addProjectFiles([...event.dataTransfer.files]));

function renderProjectImages() {
  const root = $('#project-images');
  if (!state.projectImages.length) {
    root.innerHTML = '';
    return;
  }
  root.innerHTML = state.projectImages.map((image, index) => `
    <article class="project-image-item" data-project-image="${image.id}">
      <img src="${escapeHtml(image.preview || image.url || '')}" alt="">
      <footer><button type="button" data-move-image="up" data-index="${index}" ${index === 0 ? 'disabled' : ''}>↑</button><button type="button" data-move-image="down" data-index="${index}" ${index === state.projectImages.length - 1 ? 'disabled' : ''}>↓</button><button type="button" class="remove" data-remove-image="${index}">×</button></footer>
    </article>`).join('');
  $$('[data-move-image]', root).forEach(button => button.addEventListener('click', () => {
    const index = Number(button.dataset.index);
    const target = button.dataset.moveImage === 'up' ? index - 1 : index + 1;
    if (target < 0 || target >= state.projectImages.length) return;
    if(state.projectSaving)return;state.projectDirty=true;
    [state.projectImages[index], state.projectImages[target]] = [state.projectImages[target], state.projectImages[index]];
    renderProjectImages();
  }));
  $$('[data-remove-image]', root).forEach(button => button.addEventListener('click', () => {
    const index = Number(button.dataset.removeImage);
    if(state.projectSaving)return;state.projectDirty=true;
    const [removed] = state.projectImages.splice(index, 1);
    if (removed?.storagePath && !removed.isNew) state.removedProjectStorage.push(removed.storagePath);
    renderProjectImages();
  }));
}

function projectProgress(stage,index=-1){
 state.projectPhase=stage;
 const queue=state.projectImages,done=queue.filter(i=>i.url).length,total=queue.length;
 const messages={draft:'Registrando rascunho no banco…',optimize:'Otimizando imagem sem perda de qualidade…',upload:'Enviando imagem ao armazenamento…',checkpoint:'Confirmando imagem salva…',complete:'Imagem enviada e registrada.',final:'Confirmando o projeto completo no banco…'};
 $('#project-progress-label').textContent=state.projectPause?'Pausa solicitada. Concluindo a etapa atual…':(messages[stage]||stage)+(index>=0?' ('+(index+1)+' de '+total+')':'');
 // Only confirmed upload counts are shown; no fabricated byte percentages.
 $('#project-progress-bar').style.width=(total?Math.round(done/total*95):0)+'%';
 $('#project-progress-count').textContent=done+' de '+total+' imagens enviadas';
 const list=$('#project-progress-list');list.replaceChildren();
 for(const [i,image] of queue.entries()){
  const row=document.createElement('li'),mark=document.createElement('span'),name=document.createElement('span');
  let status=image.url?'Enviada':'Aguardando';
  if(i===index&&stage!=='complete')status={optimize:'Otimizando',upload:'Enviando',checkpoint:'Confirmando'}[stage]||status;
  mark.className='project-progress-dot '+(status==='Enviada'?'done':i===index?'working':'');mark.textContent=status==='Enviada'?'✓':i===index?'…':'○';
  name.textContent=(image.file?.name||image.alt||'Imagem '+(i+1))+' — '+status;row.append(mark,name);list.append(row)
 }
}
async function uploadRegistrationImage(image,index,stage){
 const file=image.file,base='site/projects/'+state.projectId+'/'+safeStorageSegment(image.id)+'-'+safeStorageSegment(file.name);
 const prepared=await prepareImageUpload(file,base,{timeoutMs:15000});
 stage('upload');
 const bucket=supabase.storage.from(supabaseConfig.bucket);
 const {error}=await bucket.upload(prepared.path,prepared.file,{upsert:true,contentType:prepared.file.type||file.type,cacheControl:'31536000'});
 if(error)throw error;
 const url=bucket.getPublicUrl(prepared.path).data.publicUrl;
 if(!url)throw Error('Endereço da imagem não retornado.');
 return {url,storagePath:prepared.path};
}
$('#project-form').addEventListener('submit',async event=>{
 event.preventDefault();if(state.projectSaving)return;
 const metadata=projectMetadata();
 if(!metadata.title)return toast('Informe o título do projeto.','error');
 if(!state.projectImages.length)return toast('Adicione pelo menos uma imagem ao projeto.','error');
 const form=event.currentTarget,submit=form.querySelector('[type=submit]'),cancel=form.querySelector('[data-close-modal]'),progress=$('#project-progress');
 const controls=[...form.querySelectorAll('input,textarea,button,select')].filter(el=>el!==cancel).map(el=>[el,el.disabled]);
 controls.forEach(([el])=>el.disabled=true);
 state.projectSaving=true;state.projectPause=false;state.projectAfterPause=null;state.projectDirty=true;projectError();
 submit.textContent='Salvando…';cancel.textContent='Pausar envio';progress.hidden=false;projectProgress('draft');progress.scrollIntoView({block:'nearest'});
 let uid,projectRef,localWarning=false,closeAfter=false,success=false;
 try{
  uid=await requirePhotoAdmin(state.user);projectRef=doc(db,'projects',state.projectId);
  const previous=await getDoc(projectRef),existing=previous.exists()?previous.data():null;
  const payloadMetadata={...metadata,updatedBy:uid};
  const persist=async()=>{
   try{
    const queue=state.projectImages.map(({preview,...image})=>{if(image.url){const {file,...saved}=image;return saved}return image});
    await saveQueue(uid,state.projectId,{id:state.projectId,metadata,queue,removed:state.removedProjectStorage});state.projectLocal=true;
   }catch(error){
    localWarning=true;state.projectLocal=false;const w=$('#project-local-warning');w.hidden=false;w.textContent='O navegador não conseguiu guardar os arquivos pendentes. As fotos confirmadas no banco serão mantidas; se sair, selecione novamente as que faltam.'
   }
  };
  let firstWrite=!existing;
  const write=async payload=>{
   // Merge uses the same admin-only table and fields already used by the project editor.
   const fields={...payload,updatedAt:serverTimestamp()};
   if(firstWrite)fields.createdAt=serverTimestamp();
   await setDoc(projectRef,fields,{merge:true});firstWrite=false;
  };
  const result=await registerProject({queue:state.projectImages,metadata:payloadMetadata,existing,write,read:async()=>{const snap=await getDoc(projectRef);return snap.exists()?snap.data():null},upload:uploadRegistrationImage,persist,stage:projectProgress,paused:()=>state.projectPause});
  if(result.paused){closeAfter=true;toast('Envio pausado. Continue o cadastro pela lista de projetos.');return}
  const saved=result.saved;
  try{await removeQueue(uid,state.projectId)}catch{ /* A confirmed project remains valid even if local cleanup fails. */ }
  const kept=new Set(saved.images.map(i=>i.storagePath));
  for(const path of state.removedProjectStorage)if(!kept.has(path))deleteObject(ref(storage,path)).catch(()=>{});
  $('#project-progress-bar').style.width='100%';$('#project-progress-label').textContent='Projeto confirmado no banco.';$('#project-progress-count').textContent=saved.images.length+' de '+saved.images.length+' imagens enviadas';
  state.projectDirty=false;success=true;closeAfter=true;
  state.projects=[...state.projects.filter(p=>p.id!==state.projectId),{...saved,id:state.projectId}].sort((a,b)=>(Number(a.order)||9999)-(Number(b.order)||9999));
  renderProjects();
  toast(saved.published?'Projeto salvo e confirmado no banco.':'Rascunho salvo e confirmado.');
 }catch(error){
  const message=error?.message||'Não foi possível salvar o projeto.';
  projectError(message+(localWarning?' Reabra o projeto e selecione as imagens faltantes se necessário.':' As imagens já confirmadas serão reaproveitadas ao tentar novamente.'));
  $('#project-progress-label').textContent='Cadastro interrompido. Confira o erro abaixo.';toast(message,'error',9000);
  if(state.projectPause)closeAfter=true;
 }finally{
  const next=state.projectAfterPause;state.projectSaving=false;state.projectPause=false;state.projectAfterPause=null;
  controls.forEach(([el,disabled])=>el.disabled=disabled);submit.textContent='Salvar projeto';cancel.textContent='Cancelar';renderProjectImages();
  if(closeAfter){closeProjectModalNow();await loadProjects();loadDashboard();next?.()}
  else if(!success){submit.textContent='Tentar novamente'}
 }
});

async function deleteProject(projectId) {
  const project = state.projects.find(item => item.id === projectId);
  if (!project || !confirm(`Excluir o projeto “${project.title}” e suas imagens enviadas ao Storage?`)) return;
  try {
    if(!project.localOnly)await deleteDoc(doc(db, 'projects', projectId));
    await removeQueue(state.user?.id||state.user?.uid||'',projectId).catch(()=>{});
    for (const image of project.images || []) {
      if (image.storagePath) deleteObject(ref(storage, image.storagePath)).catch(() => {});
    }
    toast('Projeto excluído.');
    await loadProjects();
    loadDashboard();
  } catch (error) {
    toast(error.message || 'Não foi possível excluir o projeto.', 'error');
  }
}
