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
  imageFilter: 'all',
  imageSearch: '',
  pendingAssetPath: null,
  projects: [],
  projectImages: [],
  removedProjectStorage: [],
  projectObjectUrls: []
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
  const snap = await getDocs(collection(db, 'assets'));
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
  let paths = state.assetManifest.filter(path => {
    if (search && !path.toLowerCase().includes(search)) return false;
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
    const src = override?.url || `../${path}`;
    return `<article class="asset-card ${override ? 'replaced' : ''}" data-asset="${escapeHtml(path)}">
      <div class="asset-preview"><img src="${escapeHtml(src)}" alt="${escapeHtml(imageLabel(path))}" loading="lazy"></div>
      <div class="asset-info"><strong title="${escapeHtml(imageLabel(path))}">${escapeHtml(imageLabel(path))}</strong><small title="${escapeHtml(path)}">${escapeHtml(path)}</small></div>
      <div class="asset-actions"><button class="btn btn-ghost" data-replace-asset="${escapeHtml(path)}">Substituir</button>${override ? `<button class="btn btn-danger" data-restore-asset="${escapeHtml(path)}">Restaurar</button>` : ''}</div>
    </article>`;
  }).join('');
  $$('[data-replace-asset]', root).forEach(button => button.addEventListener('click', () => {
    state.pendingAssetPath = button.dataset.replaceAsset;
    $('#asset-file-input').value = '';
    $('#asset-file-input').click();
  }));
  $$('[data-restore-asset]', root).forEach(button => button.addEventListener('click', () => restoreAsset(button.dataset.restoreAsset)));
}

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
      const url = await getDownloadURL(task.snapshot.ref);
      resolve({ url, storagePath: task.snapshot.ref.fullPath });
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
      fileName: file.name,
      contentType: file.type,
      size: file.size,
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
    const snap = await getDocs(collection(db, 'projects'));
    state.projects = snap.docs.map(item => ({ id: item.id, ...item.data() })).sort((a,b) => (Number(a.order) || 9999) - (Number(b.order) || 9999));
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
    const cover = project.coverUrl || project.images?.[0]?.url || '';
    return `<article class="project-row">
      <div class="project-thumb">${cover ? `<img src="${escapeHtml(cover)}" alt="">` : ''}</div>
      <div class="project-meta"><h3>${escapeHtml(project.title || 'Sem título')}</h3><p>${escapeHtml(project.category || 'Projeto')} · ${project.images?.length || 0} imagem(ns)</p><div class="chips"><span class="status ${project.published === false ? 'off' : 'ok'}">${project.published === false ? 'Rascunho' : 'Publicado'}</span><span class="chip">Ordem ${Number(project.order) || 100}</span></div></div>
      <div class="project-actions"><button class="btn btn-ghost" data-edit-project="${project.id}">Editar</button><button class="btn btn-danger" data-delete-project="${project.id}">Excluir</button></div>
    </article>`;
  }).join('');
  $$('[data-edit-project]', root).forEach(button => button.addEventListener('click', () => openProjectModal(button.dataset.editProject)));
  $$('[data-delete-project]', root).forEach(button => button.addEventListener('click', () => deleteProject(button.dataset.deleteProject)));
}

function cleanupObjectUrls() {
  state.projectObjectUrls.forEach(url => URL.revokeObjectURL(url));
  state.projectObjectUrls = [];
}

function openProjectModal(projectId = '') {
  cleanupObjectUrls();
  state.removedProjectStorage = [];
  const project = projectId ? state.projects.find(item => item.id === projectId) : null;
  $('#project-id').value = project?.id || '';
  $('#project-title').value = project?.title || '';
  $('#project-category').value = project?.category || '';
  $('#project-description').value = project?.description || '';
  $('#project-order').value = Number(project?.order) || 100;
  $('#project-published').checked = project?.published !== false;
  $('#project-modal-title').textContent = project ? 'Editar projeto' : 'Novo projeto';
  $('#project-files').value = '';
  state.projectImages = (project?.images || []).map((image, index) => ({ ...image, id: image.id || `existing-${index}`, isNew: false }));
  renderProjectImages();
  $('#project-modal').hidden = false;
  document.body.style.overflow = 'hidden';
}

function closeProjectModal() {
  $('#project-modal').hidden = true;
  document.body.style.overflow = '';
  cleanupObjectUrls();
}

$('#new-project').addEventListener('click', () => openProjectModal());
$$('[data-close-modal]').forEach(el => el.addEventListener('click', closeProjectModal));

function addProjectFiles(files) {
  for (const file of files) {
    if (!file.type.startsWith('image/')) continue;
    if (file.size > 30 * 1024 * 1024) {
      toast(`${file.name} excede 30 MB.`, 'error');
      continue;
    }
    const preview = URL.createObjectURL(file);
    state.projectObjectUrls.push(preview);
    state.projectImages.push({ id: `new-${crypto.randomUUID()}`, file, preview, isNew: true, alt: '' });
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
    [state.projectImages[index], state.projectImages[target]] = [state.projectImages[target], state.projectImages[index]];
    renderProjectImages();
  }));
  $$('[data-remove-image]', root).forEach(button => button.addEventListener('click', () => {
    const index = Number(button.dataset.removeImage);
    const [removed] = state.projectImages.splice(index, 1);
    if (removed?.storagePath && !removed.isNew) state.removedProjectStorage.push(removed.storagePath);
    renderProjectImages();
  }));
}

$('#project-form').addEventListener('submit', async event => {
  event.preventDefault();
  const title = $('#project-title').value.trim();
  if (!title) return toast('Informe o título do projeto.', 'error');
  if (!state.projectImages.length) return toast('Adicione pelo menos uma imagem ao projeto.', 'error');
  const existingId = $('#project-id').value;
  const projectRef = existingId ? doc(db, 'projects', existingId) : doc(collection(db, 'projects'));
  const projectId = projectRef.id;
  const progress = $('#project-progress');
  const progressBar = $('#project-progress-bar');
  const progressLabel = progress.querySelector('span');
  progress.hidden = false;
  progressBar.style.width = '0%';
  const submit = event.currentTarget.querySelector('button[type="submit"]');
  submit.disabled = true;
  submit.textContent = 'Salvando...';
  try {
    let completed = 0;
    const totalNew = state.projectImages.filter(image => image.isNew).length;
    const images = [];
    for (let index = 0; index < state.projectImages.length; index++) {
      const image = state.projectImages[index];
      if (!image.isNew) {
        images.push({ id: image.id || `img-${index}`, url: image.url, storagePath: image.storagePath || '', alt: image.alt || `${title} — imagem ${index + 1}`, order: index });
        continue;
      }
      progressLabel.textContent = `Enviando ${completed + 1} de ${totalNew} imagem(ns)...`;
      const storagePath = `site/projects/${projectId}/${Date.now()}-${index}-${safeStorageSegment(image.file.name)}`;
      const uploaded = await uploadFile(image.file, storagePath, fraction => {
        const overall = totalNew ? ((completed + fraction) / totalNew) * 100 : 100;
        progressBar.style.width = `${Math.min(100, overall)}%`;
      });
      completed++;
      images.push({ id: crypto.randomUUID(), url: uploaded.url, storagePath: uploaded.storagePath, alt: `${title} — imagem ${index + 1}`, order: index });
    }
    const payload = {
      title,
      category: $('#project-category').value.trim() || 'Projeto · abrir galeria',
      description: $('#project-description').value.trim(),
      order: Number($('#project-order').value) || 100,
      published: $('#project-published').checked,
      images,
      coverUrl: images[0]?.url || '',
      coverAlt: images[0]?.alt || title,
      updatedAt: serverTimestamp(),
      updatedBy: state.user.uid
    };
    if (!existingId) payload.createdAt = serverTimestamp();
    await setDoc(projectRef, payload, { merge: true });
    for (const storagePath of state.removedProjectStorage) deleteObject(ref(storage, storagePath)).catch(() => {});
    progressBar.style.width = '100%';
    toast(existingId ? 'Projeto atualizado.' : 'Projeto criado e pronto para o site.');
    closeProjectModal();
    await loadProjects();
    loadDashboard();
  } catch (error) {
    toast(error.message || 'Não foi possível salvar o projeto.', 'error');
  } finally {
    submit.disabled = false;
    submit.textContent = 'Salvar projeto';
    progress.hidden = true;
  }
});

async function deleteProject(projectId) {
  const project = state.projects.find(item => item.id === projectId);
  if (!project || !confirm(`Excluir o projeto “${project.title}” e suas imagens enviadas ao Storage?`)) return;
  try {
    await deleteDoc(doc(db, 'projects', projectId));
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
