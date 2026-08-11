import { supabase, onAuthStateChanged, auth } from '../assets/js/supabase-config.js';

const SITE_BASE = new URL('../', import.meta.url);
const BUCKET = 'azo-media';
const VIDEO_LIMIT = 80 * 1024 * 1024;

const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
const escapeHtml = (value = '') => String(value ?? '').replace(/[&<>"']/g, char => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
}[char]));
const slugify = value => String(value || '')
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .toLowerCase()
  .trim()
  .replace(/[^a-z0-9]+/g, '-')
  .replace(/^-+|-+$/g, '')
  .slice(0, 80);
const obraUrl = slug => {
  const url = new URL('obras/', SITE_BASE);
  url.searchParams.set('obra', String(slug || '').trim());
  return url.href;
};
const qrUrl = obra => {
  const url = new URL('obras/', SITE_BASE);
  url.searchParams.set('q', String(obra?.slug || '').trim());
  return url.href;
};

let user = null;
let rows = [];
let current = null;
let originalSlug = '';
let gallery = [];
let dirty = false;
let qrModule = null;
let pendingStorageDeletes = [];

function toast(message, type = 'success') {
  const stack = $('#toast-stack');
  if (!stack) return;
  const element = document.createElement('div');
  element.className = `toast ${type}`;
  element.innerHTML = `<b>${type === 'error' ? '!' : '✓'}</b><span>${escapeHtml(message)}</span>`;
  stack.appendChild(element);
  setTimeout(() => element.remove(), 3800);
}

function setSaveState(message, error = false) {
  const element = $('#obra-save-state');
  if (!element) return;
  element.textContent = message;
  element.classList.toggle('error', error);
}

function markDirty() {
  dirty = true;
  setSaveState('Alterações não salvas');
  updatePreview();
  updateSeoPreview();
}

function isPersisted() {
  return Boolean(current && rows.some(row => row.id === current.id));
}

function ensureUi() {
  const nav = $('.sidebar-nav');
  if (!nav || $('#obra-nav')) return;

  const security = nav.querySelector('[data-view="security"]');
  const navButton = document.createElement('button');
  navButton.className = 'nav-item';
  navButton.id = 'obra-nav';
  navButton.dataset.view = 'obras';
  navButton.innerHTML = '<i>▱</i><span>Obras</span><em class="obras-nav-badge" id="obras-nav-count">0</em>';
  nav.insertBefore(navButton, security || null);

  const view = document.createElement('div');
  view.className = 'view obras-view';
  view.id = 'view-obras';
  view.innerHTML = `
    <div id="obras-list-screen">
      <div class="obras-kpis">
        <article class="obra-kpi"><span>Total</span><strong id="obra-kpi-total">0</strong></article>
        <article class="obra-kpi"><span>Publicadas</span><strong id="obra-kpi-pub">0</strong></article>
        <article class="obra-kpi"><span>No Google</span><strong id="obra-kpi-seo">0</strong></article>
        <article class="obra-kpi"><span>Com QR</span><strong id="obra-kpi-qr">0</strong></article>
      </div>

      <div class="toolbar panel slim obras-toolbar">
        <div class="search-box"><span>⌕</span><input id="obra-search" type="search" placeholder="Buscar obra, cidade ou slug..."></div>
        <div class="filter-pills">
          <button class="active" data-obra-filter="all">Todas</button>
          <button data-obra-filter="published">Publicadas</button>
          <button data-obra-filter="draft">Rascunhos</button>
          <button data-obra-filter="archived">Arquivadas</button>
        </div>
        <div class="toolbar-spacer"></div>
        <button class="btn btn-primary" id="new-obra">+ Nova obra</button>
      </div>

      <div class="notice"><b>Módulo independente.</b> Obras criadas aqui não alteram nem reutilizam o cadastro existente de Projetos.</div>
      <div class="obra-list" id="obra-list"></div>
    </div>

    <div class="obras-editor" id="obras-editor">
      <div class="obras-editor-head">
        <div class="obras-editor-head__title">
          <button class="btn btn-ghost" id="obra-back">← Voltar</button>
          <h3 id="obra-editor-title">Nova obra</h3>
        </div>
        <div class="obras-editor-actions">
          <span class="obra-save-state" id="obra-save-state">Rascunho não salvo</span>
          <button class="btn btn-ghost" id="obra-preview">Visualizar</button>
          <button class="btn btn-primary" id="obra-save">Salvar obra</button>
        </div>
      </div>

      <div class="obra-editor-grid">
        <div class="obra-editor-main">
          <div class="obra-tabs">
            <button class="active" data-obra-tab="geral">Geral</button>
            <button data-obra-tab="conteudo">Conteúdo</button>
            <button data-obra-tab="midia">Mídia</button>
            <button data-obra-tab="seo">SEO</button>
            <button data-obra-tab="visibilidade">Visibilidade</button>
          </div>
          <div class="obra-tab active" data-obra-panel="geral"></div>
          <div class="obra-tab" data-obra-panel="conteudo"></div>
          <div class="obra-tab" data-obra-panel="midia"></div>
          <div class="obra-tab" data-obra-panel="seo"></div>
          <div class="obra-tab" data-obra-panel="visibilidade"></div>
        </div>

        <aside class="obra-preview-column">
          <div id="obra-live-preview"></div>
          <div class="obra-qr-card">
            <p class="eyebrow">Código QR</p>
            <div class="obra-qr-canvas" id="obra-qr-canvas"><small>Salve a obra para gerar o QR.</small></div>
            <div class="obra-qr-url" id="obra-qr-url"></div>
            <div class="obra-qr-actions">
              <button class="btn btn-ghost" id="obra-copy-url">Copiar link</button>
              <button class="btn btn-ghost" id="obra-qr-png">PNG</button>
              <button class="btn btn-ghost" id="obra-qr-svg">SVG</button>
            </div>
          </div>
        </aside>
      </div>
    </div>`;

  $('.workspace').appendChild(view);

  navButton.addEventListener('click', openModule);
  $('#new-obra').addEventListener('click', () => openEditor());
  $('#obra-back').addEventListener('click', () => closeEditor());
  $('#obra-save').addEventListener('click', saveCurrent);
  $('#obra-preview').addEventListener('click', openPublicPreview);
  $('#obra-copy-url').addEventListener('click', copyQrUrl);
  $('#obra-qr-png').addEventListener('click', downloadQrPng);
  $('#obra-qr-svg').addEventListener('click', downloadQrSvg);
  $('#obra-search').addEventListener('input', renderList);

  $$('[data-obra-filter]', view).forEach(button => button.addEventListener('click', () => {
    $$('[data-obra-filter]', view).forEach(item => item.classList.remove('active'));
    button.classList.add('active');
    renderList();
  }));

  $$('[data-obra-tab]', view).forEach(button => button.addEventListener('click', () => activateTab(button.dataset.obraTab)));
}

function openModule() {
  $$('.nav-item[data-view]').forEach(button => button.classList.toggle('active', button.id === 'obra-nav'));
  $$('.view').forEach(view => view.classList.toggle('active', view.id === 'view-obras'));
  $('#view-kicker').textContent = 'Conteúdo comercial & QR';
  $('#view-title').textContent = 'Obras';
  $('#app-shell')?.classList.remove('menu-open');
  closeEditor(false);
  loadObras();
}

function activateTab(name) {
  $$('[data-obra-tab]').forEach(button => button.classList.toggle('active', button.dataset.obraTab === name));
  $$('[data-obra-panel]').forEach(panel => panel.classList.toggle('active', panel.dataset.obraPanel === name));
}

async function loadObras() {
  const root = $('#obra-list');
  if (!root) return;
  root.innerHTML = '<div class="loading-grid"><div class="skeleton"></div><div class="skeleton"></div></div>';

  const { data, error } = await supabase
    .from('obras')
    .select('*')
    .order('sort_order')
    .order('updated_at', { ascending: false });

  if (error) {
    root.innerHTML = '<div class="empty-state">Não foi possível carregar as obras.</div>';
    toast(error.message, 'error');
    return;
  }

  rows = data || [];
  updateKpis();
  renderList();
}

function updateKpis() {
  $('#obra-kpi-total').textContent = rows.filter(row => !row.archived).length;
  $('#obra-kpi-pub').textContent = rows.filter(row => row.published && !row.archived).length;
  $('#obra-kpi-seo').textContent = rows.filter(row => row.published && row.allow_index && !row.archived).length;
  $('#obra-kpi-qr').textContent = rows.filter(row => row.qr_enabled && !row.archived).length;
  $('#obras-nav-count').textContent = rows.filter(row => !row.archived).length;
}

function renderList() {
  const root = $('#obra-list');
  if (!root) return;

  const query = $('#obra-search')?.value.toLowerCase().trim() || '';
  const filter = $('[data-obra-filter].active')?.dataset.obraFilter || 'all';
  const items = rows.filter(row => {
    if (query && !`${row.internal_name} ${row.title} ${row.slug} ${row.location_public}`.toLowerCase().includes(query)) return false;
    if (filter === 'published') return row.published && !row.archived;
    if (filter === 'draft') return !row.published && !row.archived;
    if (filter === 'archived') return row.archived;
    return !row.archived;
  });

  if (!items.length) {
    root.innerHTML = '<div class="obras-empty"><h3>Nenhuma obra aqui ainda.</h3><p>Crie uma obra independente com página própria, SEO, vídeo, galeria e QR exclusivo.</p><button class="btn btn-primary" data-empty-new>+ Nova obra</button></div>';
    root.querySelector('[data-empty-new]')?.addEventListener('click', () => openEditor());
    return;
  }

  root.innerHTML = items.map(row => `
    <article class="obra-row">
      <div class="obra-row__media">${row.hero_image_url ? `<img src="${escapeHtml(row.hero_image_url)}" alt="">` : '<b>AZO</b>'}</div>
      <div class="obra-row__copy">
        <h3>${escapeHtml(row.internal_name || row.title)}</h3>
        <p>${escapeHtml(obraUrl(row.slug))}</p>
        <div class="obra-row__meta">
          <span class="status ${row.published ? 'ok' : 'off'}">${row.published ? 'Publicada' : 'Rascunho'}</span>
          ${row.allow_index && row.published ? '<span class="chip">SEO ativo</span>' : ''}
          ${row.show_in_menu ? '<span class="chip">No menu</span>' : ''}
          ${row.qr_enabled ? '<span class="chip">QR</span>' : ''}
        </div>
      </div>
      <div class="obra-row__actions">
        <button class="btn btn-ghost" data-edit-obra="${row.id}">Editar</button>
        ${row.published ? `<a class="btn btn-ghost" href="${escapeHtml(obraUrl(row.slug))}" target="_blank" rel="noopener">Abrir ↗</a>` : ''}
        <button class="btn btn-ghost" data-duplicate-obra="${row.id}">Duplicar</button>
        <button class="btn btn-danger" data-archive-obra="${row.id}">${row.archived ? 'Restaurar' : 'Arquivar'}</button>
      </div>
    </article>`).join('');

  $$('[data-edit-obra]', root).forEach(button => button.addEventListener('click', () => openEditor(rows.find(row => row.id === button.dataset.editObra))));
  $$('[data-duplicate-obra]', root).forEach(button => button.addEventListener('click', () => duplicateObra(rows.find(row => row.id === button.dataset.duplicateObra))));
  $$('[data-archive-obra]', root).forEach(button => button.addEventListener('click', () => toggleArchive(rows.find(row => row.id === button.dataset.archiveObra))));
}

function blankObra() {
  return {
    id: crypto.randomUUID(),
    internal_name: '', slug: '', title: '', eyebrow: 'Obra AZO', excerpt: '',
    location_public: '', work_type: '', area_label: '', year_label: '', status_label: '', scope_label: '',
    intro_title: 'A obra', intro_body: '', challenge_title: 'O desafio', challenge_body: '', solution_title: 'A solução', solution_body: '',
    highlights: [], services: [], related_obra_ids: [], gallery: [],
    hero_media_type: 'image', hero_image_url: '', hero_image_storage_path: '', hero_image_alt: '',
    hero_video_url: '', hero_video_storage_path: '', hero_video_poster_url: '', hero_video_poster_storage_path: '',
    hero_media_position_x: 50, hero_media_position_y: 50, hero_overlay: 34,
    cta_title: 'Planejando uma obra?',
    cta_text: 'Converse com a AZO sobre o seu terreno, imóvel ou obra.',
    cta_label: 'Solicitar uma conversa', cta_url: '/contato.html',
    seo_title: '', meta_description: '', og_image_url: '', allow_index: true,
    published: false, show_in_menu: false, menu_label: '', show_in_obras_index: true, show_related: true,
    qr_enabled: true, qr_campaign: '', sort_order: 100, archived: false
  };
}

function openEditor(row = null) {
  current = structuredClone(row || blankObra());
  originalSlug = row?.slug || '';
  gallery = Array.isArray(current.gallery) ? structuredClone(current.gallery) : [];
  pendingStorageDeletes = [];
  dirty = false;

  $('#obras-list-screen').hidden = true;
  $('#obras-editor').classList.add('open');
  $('#obra-editor-title').textContent = row ? current.internal_name || current.title : 'Nova obra';
  renderForm();
  updatePreview();
  renderQr();
  setSaveState(row ? 'Sem alterações' : 'Nova obra');
}

function closeEditor(confirmDirty = true) {
  if (confirmDirty && dirty && !confirm('Sair sem salvar as alterações desta obra?')) return;
  current = null;
  gallery = [];
  pendingStorageDeletes = [];
  dirty = false;
  $('#obras-list-screen').hidden = false;
  $('#obras-editor')?.classList.remove('open');
}

function field(id, label, value = '', options = {}) {
  let input;
  if (options.textarea) {
    input = `<textarea id="${id}" rows="${options.rows || 4}" ${options.max ? `maxlength="${options.max}"` : ''}>${escapeHtml(value)}</textarea>`;
  } else if (options.select) {
    input = `<select id="${id}">${options.options.map(option => `<option value="${escapeHtml(option[0])}" ${String(value) === String(option[0]) ? 'selected' : ''}>${escapeHtml(option[1])}</option>`).join('')}</select>`;
  } else {
    const range = options.type === 'range' ? ' min="0" max="100" step="1"' : '';
    input = `<input id="${id}" type="${options.type || 'text'}" value="${escapeHtml(value)}"${range} ${options.max ? `maxlength="${options.max}"` : ''} ${options.placeholder ? `placeholder="${escapeHtml(options.placeholder)}"` : ''}>`;
  }
  return `<label class="obra-field"><span>${label}</span>${input}${options.help ? `<small>${escapeHtml(options.help)}</small>` : ''}</label>`;
}

function switchRow(id, title, help, checked) {
  return `<label class="obra-switch-row"><div><strong>${escapeHtml(title)}</strong><small>${escapeHtml(help)}</small></div><span class="switch"><input id="${id}" type="checkbox" ${checked ? 'checked' : ''}><i></i></span></label>`;
}

function renderForm() {
  const general = $('[data-obra-panel="geral"]');
  const content = $('[data-obra-panel="conteudo"]');
  const media = $('[data-obra-panel="midia"]');
  const seo = $('[data-obra-panel="seo"]');
  const visibility = $('[data-obra-panel="visibilidade"]');

  general.innerHTML = `
    <section class="obra-form-card"><h4>Identificação</h4><div class="obra-fields">
      ${field('obra-internal', 'Nome interno', current.internal_name, { help: 'Só aparece no AZO Studio.' })}
      ${field('obra-title', 'Título público', current.title, { help: 'H1 da página.' })}
      ${field('obra-slug', 'Slug', current.slug, { help: 'Endereço permanente. Alterações futuras criam redirect.' })}
      ${field('obra-eyebrow', 'Eyebrow', current.eyebrow)}
    </div><div class="obra-url-preview"><span>URL</span><b id="obra-url-live">${escapeHtml(obraUrl(current.slug || 'sua-obra'))}</b></div></section>
    <section class="obra-form-card"><h4>Dados da obra</h4><div class="obra-fields three">
      ${field('obra-location', 'Localização pública', current.location_public, { placeholder: 'Sorocaba · SP' })}
      ${field('obra-type', 'Tipo', current.work_type, { placeholder: 'Residencial' })}
      ${field('obra-area', 'Área', current.area_label, { placeholder: '320 m²' })}
      ${field('obra-year', 'Ano', current.year_label)}
      ${field('obra-status-label', 'Status', current.status_label, { placeholder: 'Concluída' })}
      ${field('obra-scope', 'Escopo', current.scope_label, { placeholder: 'Arquitetura + execução' })}
    </div></section>
    <section class="obra-form-card"><h4>Apresentação</h4><div class="obra-fields one">
      ${field('obra-excerpt', 'Resumo comercial', current.excerpt, { textarea: true, rows: 4, max: 420, help: 'Aparece no hero e explica rapidamente por que essa obra importa.' })}
    </div></section>`;

  content.innerHTML = `
    <section class="obra-form-card"><h4>Narrativa da obra</h4><p class="help">Conteúdo útil para vender e para SEO. Escreva o contexto real, não texto genérico.</p>
      <div class="obra-fields">${field('obra-intro-title', 'Título — introdução', current.intro_title)}${field('obra-challenge-title', 'Título — desafio', current.challenge_title)}</div>
      <div class="obra-fields one">
        ${field('obra-intro-body', 'Introdução', current.intro_body, { textarea: true, rows: 7 })}
        ${field('obra-challenge-body', 'Desafio', current.challenge_body, { textarea: true, rows: 7 })}
        ${field('obra-solution-title', 'Título — solução', current.solution_title)}
        ${field('obra-solution-body', 'Solução', current.solution_body, { textarea: true, rows: 8 })}
      </div>
    </section>
    <section class="obra-form-card"><h4>CTA comercial</h4><div class="obra-fields">
      ${field('obra-cta-title', 'Título', current.cta_title)}
      ${field('obra-cta-label', 'Texto do botão', current.cta_label)}
      ${field('obra-cta-text', 'Texto', current.cta_text, { textarea: true, rows: 4 })}
      ${field('obra-cta-url', 'Destino', current.cta_url, { help: 'Página interna, WhatsApp, telefone ou URL HTTPS.' })}
    </div></section>
    <section class="obra-form-card"><h4>Outras obras</h4><div class="obra-related-select" id="obra-related-select"></div></section>`;

  media.innerHTML = `
    <section class="obra-form-card"><h4>Mídia principal</h4><div class="obra-fields">
      ${field('obra-media-type', 'Tipo', current.hero_media_type, { select: true, options: [['image', 'Imagem'], ['video', 'Vídeo em loop']] })}
      ${field('obra-image-alt', 'Alt da imagem', current.hero_image_alt)}
    </div>
    <div class="obra-media-grid">
      <div><div class="obra-upload-card ${current.hero_image_url ? 'has-media' : ''}">${current.hero_image_url ? `<img src="${escapeHtml(current.hero_image_url)}" alt="">` : '<div class="obra-upload-card__empty"><b>＋</b><strong>Imagem principal</strong><small>WebP, AVIF, JPG ou PNG</small></div>'}<input id="obra-image-file" type="file" accept="image/jpeg,image/png,image/webp,image/avif"></div></div>
      <div><div class="obra-upload-card ${current.hero_video_url ? 'has-media' : ''}">${current.hero_video_url ? `<video src="${escapeHtml(current.hero_video_url)}" muted loop autoplay playsinline></video>` : '<div class="obra-upload-card__empty"><b>▶</b><strong>Vídeo em loop</strong><small>MP4 ou WebM · até 80 MB</small></div>'}<input id="obra-video-file" type="file" accept="video/mp4,video/webm"></div></div>
    </div>
    <div class="obra-fields three" style="margin-top:14px">
      ${field('obra-pos-x', 'Enquadramento horizontal', current.hero_media_position_x, { type: 'range' })}
      ${field('obra-pos-y', 'Enquadramento vertical', current.hero_media_position_y, { type: 'range' })}
      ${field('obra-overlay', 'Overlay', current.hero_overlay, { type: 'range' })}
    </div></section>
    <section class="obra-form-card"><h4>Poster do vídeo</h4><div class="obra-upload-card ${current.hero_video_poster_url ? 'has-media' : ''}">${current.hero_video_poster_url ? `<img src="${escapeHtml(current.hero_video_poster_url)}" alt="">` : '<div class="obra-upload-card__empty"><b>＋</b><strong>Poster / fallback</strong><small>Mostrado antes do vídeo carregar e com movimento reduzido.</small></div>'}<input id="obra-poster-file" type="file" accept="image/jpeg,image/png,image/webp,image/avif"></div></section>
    <section class="obra-form-card"><h4>Galeria</h4><p class="help">As imagens são exclusivas deste módulo e independentes dos Projetos existentes.</p><div class="obra-upload-card" style="min-height:110px"><div class="obra-upload-card__empty"><b>＋</b><strong>Adicionar imagens à galeria</strong><small>Selecione várias de uma vez.</small></div><input id="obra-gallery-file" type="file" accept="image/*" multiple></div><div class="obra-gallery-editor" id="obra-gallery-editor" style="margin-top:12px"></div></section>`;

  seo.innerHTML = `<section class="obra-form-card"><h4>SEO</h4><div class="obra-fields one">
    ${field('obra-seo-title', 'Título SEO', current.seo_title, { max: 90 })}
    ${field('obra-meta', 'Meta description', current.meta_description, { textarea: true, rows: 4, max: 220 })}
    ${field('obra-og', 'Imagem social / Open Graph', current.og_image_url, { help: 'Se vazio, usa poster ou imagem principal.' })}
  </div><div class="obra-seo-preview" id="obra-seo-preview"></div><div class="obra-checklist" id="obra-seo-checklist"></div></section>`;

  visibility.innerHTML = `
    <section class="obra-form-card"><h4>Publicação e visibilidade</h4><div class="obra-switch-list">
      ${switchRow('obra-published', 'Publicar página', 'Quando desligado, a obra é apenas rascunho no Studio.', current.published)}
      ${switchRow('obra-index', 'Permitir indexação', 'Entra no Google e no sitemap quando publicada.', current.allow_index)}
      ${switchRow('obra-index-list', 'Aparecer em Obras', 'Mostra a obra na página pública /obras/.', current.show_in_obras_index)}
      ${switchRow('obra-menu', 'Aparecer no menu', 'Adiciona esta obra ao menu desktop e mobile.', current.show_in_menu)}
      ${switchRow('obra-related', 'Mostrar como relacionada', 'Permite aparecer em “Outras obras”.', current.show_related)}
      ${switchRow('obra-qr', 'QR ativo', 'Gera QR exclusivo para esta página.', current.qr_enabled)}
    </div><div class="obra-fields" style="margin-top:15px">
      ${field('obra-menu-label', 'Nome no menu', current.menu_label, { help: 'Usado apenas quando “Aparecer no menu” estiver ligado.' })}
      ${field('obra-sort', 'Ordem', current.sort_order, { type: 'number' })}
      ${field('obra-qr-campaign', 'Campanha do QR', current.qr_campaign, { help: 'Identificador opcional usado no rastreio após o scan. Não aumenta o tamanho do QR.' })}
    </div></section>
    <section class="obra-form-card obra-danger"><h4>Arquivamento</h4><p class="help">Arquivar remove a obra das áreas públicas sem apagar o cadastro nem o histórico do endereço.</p><button class="btn btn-danger" id="obra-archive-current">${current.archived ? 'Restaurar obra' : 'Arquivar obra'}</button></section>`;

  bindForm();
  renderRelated();
  renderGallery();
  updateSeoPreview();
}

function bindForm() {
  const fieldMap = {
    'obra-internal': 'internal_name', 'obra-title': 'title', 'obra-slug': 'slug', 'obra-eyebrow': 'eyebrow',
    'obra-excerpt': 'excerpt', 'obra-location': 'location_public', 'obra-type': 'work_type', 'obra-area': 'area_label',
    'obra-year': 'year_label', 'obra-status-label': 'status_label', 'obra-scope': 'scope_label',
    'obra-intro-title': 'intro_title', 'obra-intro-body': 'intro_body', 'obra-challenge-title': 'challenge_title',
    'obra-challenge-body': 'challenge_body', 'obra-solution-title': 'solution_title', 'obra-solution-body': 'solution_body',
    'obra-cta-title': 'cta_title', 'obra-cta-text': 'cta_text', 'obra-cta-label': 'cta_label', 'obra-cta-url': 'cta_url',
    'obra-image-alt': 'hero_image_alt', 'obra-media-type': 'hero_media_type', 'obra-seo-title': 'seo_title',
    'obra-meta': 'meta_description', 'obra-og': 'og_image_url', 'obra-menu-label': 'menu_label',
    'obra-qr-campaign': 'qr_campaign', 'obra-sort': 'sort_order', 'obra-pos-x': 'hero_media_position_x',
    'obra-pos-y': 'hero_media_position_y', 'obra-overlay': 'hero_overlay'
  };

  const numeric = new Set(['sort_order', 'hero_media_position_x', 'hero_media_position_y', 'hero_overlay']);
  for (const [id, key] of Object.entries(fieldMap)) {
    $(`#${id}`)?.addEventListener('input', event => {
      let value = event.target.value;
      if (numeric.has(key)) value = Number(value) || 0;
      current[key] = value;

      if (id === 'obra-title' && !originalSlug && !current.slug) {
        current.slug = slugify(value);
        $('#obra-slug').value = current.slug;
      }
      if (id === 'obra-slug') {
        current.slug = slugify(value);
        event.target.value = current.slug;
      }
      $('#obra-url-live').textContent = obraUrl(current.slug || 'sua-obra');
      markDirty();
      renderQr();
    });
  }

  const booleanMap = {
    'obra-published': 'published', 'obra-index': 'allow_index', 'obra-index-list': 'show_in_obras_index',
    'obra-menu': 'show_in_menu', 'obra-related': 'show_related', 'obra-qr': 'qr_enabled'
  };
  for (const [id, key] of Object.entries(booleanMap)) {
    $(`#${id}`)?.addEventListener('change', event => {
      current[key] = event.target.checked;
      markDirty();
      renderQr();
    });
  }

  $('#obra-image-file')?.addEventListener('change', event => uploadHeroImage(event.target.files?.[0]));
  $('#obra-video-file')?.addEventListener('change', event => uploadHeroVideo(event.target.files?.[0]));
  $('#obra-poster-file')?.addEventListener('change', event => uploadPoster(event.target.files?.[0]));
  $('#obra-gallery-file')?.addEventListener('change', event => uploadGallery([...event.target.files || []]));
  $('#obra-archive-current')?.addEventListener('click', () => toggleArchive(current, true));
}

function renderRelated() {
  const root = $('#obra-related-select');
  if (!root) return;
  const options = rows.filter(row => row.id !== current.id && !row.archived);
  root.innerHTML = options.length
    ? options.map(row => `<label class="obra-related-option"><input type="checkbox" value="${row.id}" ${(current.related_obra_ids || []).includes(row.id) ? 'checked' : ''}><span>${escapeHtml(row.internal_name || row.title)}</span></label>`).join('')
    : '<small>Nenhuma outra obra cadastrada.</small>';

  $$('input', root).forEach(input => input.addEventListener('change', () => {
    current.related_obra_ids = $$('input:checked', root).map(item => item.value);
    markDirty();
  }));
}

function renderGallery() {
  const root = $('#obra-gallery-editor');
  if (!root) return;

  root.innerHTML = gallery.map((item, index) => `
    <article class="obra-gallery-item">
      <img src="${escapeHtml(item.url)}" alt="">
      <div class="obra-gallery-item__body">
        <input data-gallery-alt="${index}" value="${escapeHtml(item.alt || '')}" placeholder="Texto alternativo">
        <input data-gallery-caption="${index}" value="${escapeHtml(item.caption || '')}" placeholder="Legenda opcional">
        <div class="obra-gallery-item__actions">
          <button class="obra-mini-btn" data-gallery-up="${index}">↑</button>
          <button class="obra-mini-btn" data-gallery-down="${index}">↓</button>
          <button class="obra-mini-btn" data-gallery-remove="${index}">Excluir</button>
        </div>
      </div>
    </article>`).join('');

  $$('[data-gallery-alt]', root).forEach(input => input.addEventListener('input', () => {
    gallery[Number(input.dataset.galleryAlt)].alt = input.value;
    current.gallery = gallery;
    markDirty();
  }));
  $$('[data-gallery-caption]', root).forEach(input => input.addEventListener('input', () => {
    gallery[Number(input.dataset.galleryCaption)].caption = input.value;
    current.gallery = gallery;
    markDirty();
  }));
  $$('[data-gallery-up]', root).forEach(button => button.addEventListener('click', () => moveGallery(Number(button.dataset.galleryUp), -1)));
  $$('[data-gallery-down]', root).forEach(button => button.addEventListener('click', () => moveGallery(Number(button.dataset.galleryDown), 1)));
  $$('[data-gallery-remove]', root).forEach(button => button.addEventListener('click', () => removeGallery(Number(button.dataset.galleryRemove))));
}

function moveGallery(index, delta) {
  const target = index + delta;
  if (target < 0 || target >= gallery.length) return;
  [gallery[index], gallery[target]] = [gallery[target], gallery[index]];
  current.gallery = gallery;
  markDirty();
  renderGallery();
}

function removeGallery(index) {
  const [item] = gallery.splice(index, 1);
  if (item?.storagePath) pendingStorageDeletes.push(item.storagePath);
  current.gallery = gallery;
  markDirty();
  renderGallery();
}

async function upload(file, kind) {
  if (!file) return null;
  setSaveState(`Enviando ${kind}...`);
  const extension = (file.name.split('.').pop() || 'bin').toLowerCase();
  const path = `obras/${current.id}/${kind}/${Date.now()}-${crypto.randomUUID()}.${extension}`;
  const { error } = await supabase.storage.from(BUCKET).upload(path, file, {
    upsert: false,
    contentType: file.type,
    cacheControl: '31536000'
  });
  if (error) throw error;
  const url = supabase.storage.from(BUCKET).getPublicUrl(path).data.publicUrl;
  return { url, path };
}

async function uploadHeroImage(file) {
  try {
    const result = await upload(file, 'hero');
    if (!result) return;
    current.hero_image_url = result.url;
    current.hero_image_storage_path = result.path;
    if (!current.og_image_url) current.og_image_url = result.url;
    markDirty();
    renderForm();
    updatePreview();
    toast('Imagem principal enviada.');
  } catch (error) {
    toast(error.message, 'error');
    setSaveState('Falha no upload', true);
  }
}

async function uploadHeroVideo(file) {
  try {
    if (file && file.size > VIDEO_LIMIT) throw new Error('O vídeo excede o limite de 80 MB.');
    const result = await upload(file, 'video');
    if (!result) return;
    current.hero_video_url = result.url;
    current.hero_video_storage_path = result.path;
    current.hero_media_type = 'video';
    markDirty();
    renderForm();
    updatePreview();
    toast('Vídeo em loop enviado.');
  } catch (error) {
    toast(error.message, 'error');
    setSaveState('Falha no upload', true);
  }
}

async function uploadPoster(file) {
  try {
    const result = await upload(file, 'poster');
    if (!result) return;
    current.hero_video_poster_url = result.url;
    current.hero_video_poster_storage_path = result.path;
    markDirty();
    renderForm();
    updatePreview();
    toast('Poster enviado.');
  } catch (error) {
    toast(error.message, 'error');
    setSaveState('Falha no upload', true);
  }
}

async function uploadGallery(files) {
  if (!files.length) return;
  try {
    for (let index = 0; index < files.length; index += 1) {
      setSaveState(`Enviando galeria ${index + 1}/${files.length}...`);
      const result = await upload(files[index], 'gallery');
      gallery.push({
        url: result.url,
        storagePath: result.path,
        alt: current.title ? `${current.title} — imagem ${gallery.length + 1}` : '',
        caption: ''
      });
    }
    current.gallery = gallery;
    markDirty();
    renderGallery();
    toast(`${files.length} imagem(ns) adicionada(s).`);
  } catch (error) {
    toast(error.message, 'error');
    setSaveState('Falha no upload', true);
  }
}

function updatePreview() {
  const root = $('#obra-live-preview');
  if (!root || !current) return;

  const media = current.hero_media_type === 'video' && current.hero_video_url
    ? `<video src="${escapeHtml(current.hero_video_url)}" poster="${escapeHtml(current.hero_video_poster_url || current.hero_image_url)}" muted autoplay loop playsinline style="object-position:${current.hero_media_position_x}% ${current.hero_media_position_y}%"></video>`
    : current.hero_image_url
      ? `<img src="${escapeHtml(current.hero_image_url)}" alt="" style="object-position:${current.hero_media_position_x}% ${current.hero_media_position_y}%">`
      : '';

  root.innerHTML = `<div class="obra-phone"><div class="obra-phone__screen"><div class="obra-phone__hero">${media}<div class="obra-phone__veil" style="opacity:${Math.max(.35, (Number(current.hero_overlay) || 34) / 70)}"></div><div class="obra-phone__copy"><span>${escapeHtml(current.eyebrow || 'Obra AZO')}</span><h4>${escapeHtml(current.title || 'Título da obra')}</h4></div></div><div class="obra-phone__body"><p>${escapeHtml(current.excerpt || 'O resumo comercial da obra aparece aqui, com contexto e clareza para quem chegou pelo QR ou pelo Google.')}</p><span class="obra-phone__cta">${escapeHtml(current.cta_label || 'Solicitar uma conversa')} →</span></div></div></div>`;
}

function updateSeoPreview() {
  if (!current) return;
  const title = current.seo_title || `${current.title || 'Título da obra'} | AZO Criação & Construção`;
  const description = current.meta_description || current.excerpt || 'Descrição da obra para resultados de busca.';
  const preview = $('#obra-seo-preview');
  if (preview) {
    const previewUrl = new URL(obraUrl(current.slug || 'slug'));
    preview.innerHTML = `<small>${escapeHtml(previewUrl.host)} › obras › ${escapeHtml(current.slug || 'slug')}</small><h5>${escapeHtml(title)}</h5><p>${escapeHtml(description)}</p>`;
  }

  const checks = [
    ['Título público', current.title], ['Slug', current.slug], ['Resumo', current.excerpt],
    ['Título SEO', current.seo_title], ['Meta description', current.meta_description],
    ['Mídia principal', current.hero_image_url || current.hero_video_url],
    ['Texto da obra', current.intro_body || current.challenge_body || current.solution_body],
    ['CTA', current.cta_label && current.cta_url]
  ];
  const list = $('#obra-seo-checklist');
  if (list) list.innerHTML = checks.map(([label, ok]) => `<div class="obra-check ${ok ? '' : 'missing'}"><i>${ok ? '✓' : '!'}</i><span>${escapeHtml(label)}</span></div>`).join('');
}

async function flushPendingStorageDeletes() {
  const paths = [...new Set(pendingStorageDeletes)].filter(Boolean);
  pendingStorageDeletes = [];
  if (!paths.length) return;
  const { error } = await supabase.storage.from(BUCKET).remove(paths);
  if (error) console.warn('[AZO Studio] Cadastro salvo, mas alguns arquivos antigos não foram removidos.', error);
}

async function saveCurrent() {
  if (!current || !user) return;

  current.internal_name = current.internal_name.trim();
  current.title = current.title.trim();
  current.slug = slugify(current.slug || current.title);
  if (!current.internal_name || !current.title || !current.slug) return toast('Preencha nome interno, título e slug.', 'error');
  if (current.show_in_menu && !current.menu_label.trim()) return toast('Defina o nome que aparecerá no menu.', 'error');

  setSaveState('Salvando...');
  const { data: duplicate, error: duplicateError } = await supabase
    .from('obras')
    .select('id')
    .eq('slug', current.slug)
    .neq('id', current.id)
    .limit(1);

  if (duplicateError) {
    setSaveState('Erro ao validar slug', true);
    return toast(duplicateError.message, 'error');
  }
  if (duplicate?.length) {
    setSaveState('Slug já utilizado', true);
    return toast('Este slug já está sendo usado por outra obra.', 'error');
  }

  current.gallery = gallery;
  const existing = isPersisted();
  const payload = {
    ...current,
    updated_by: user.id,
    updated_at: new Date().toISOString()
  };
  delete payload.created_at;
  delete payload.created_by;

  if (current.published && !current.published_at) payload.published_at = new Date().toISOString();
  if (!current.published) payload.published_at = current.published_at || null;

  let error;
  if (existing) {
    ({ error } = await supabase.from('obras').update(payload).eq('id', current.id));
  } else {
    payload.created_by = user.id;
    ({ error } = await supabase.from('obras').insert(payload));
  }

  if (error) {
    setSaveState('Erro ao salvar', true);
    toast(error.message, 'error');
    return;
  }

  if (existing && originalSlug && originalSlug !== current.slug) {
    const { error: redirectError } = await supabase.from('obra_redirects').upsert({
      obra_id: current.id,
      from_slug: originalSlug,
      active: true
    }, { onConflict: 'from_slug' });
    if (redirectError) {
      setSaveState('Obra salva; redirect pendente', true);
      toast('A obra foi salva, mas o endereço antigo não pôde ser preservado. Não imprima um novo QR até corrigir isso.', 'error');
      return;
    }
    toast('Slug alterado; endereço antigo preservado com redirect.');
  }

  await flushPendingStorageDeletes();
  originalSlug = current.slug;
  dirty = false;
  setSaveState('Alterações salvas');
  toast(existing ? 'Obra atualizada.' : 'Obra criada.');

  await loadObras();
  current = structuredClone(rows.find(row => row.id === current.id) || current);
  gallery = Array.isArray(current.gallery) ? structuredClone(current.gallery) : [];
  renderForm();
  updatePreview();
  renderQr();
}

async function toggleArchive(row, fromEditor = false) {
  if (!row) return;
  const next = !row.archived;
  if (next && !confirm(`Arquivar “${row.internal_name || row.title}”? Ela deixará de aparecer publicamente.`)) return;

  const { error } = await supabase.from('obras').update({
    archived: next,
    published: next ? false : row.published,
    updated_by: user?.id
  }).eq('id', row.id);

  if (error) return toast(error.message, 'error');
  toast(next ? 'Obra arquivada.' : 'Obra restaurada como rascunho.');
  await loadObras();
  if (fromEditor) closeEditor(false);
}

async function duplicateObra(row) {
  if (!row) return;
  const copy = {
    ...row,
    id: crypto.randomUUID(),
    internal_name: `${row.internal_name || row.title} — cópia`,
    title: `${row.title} — cópia`,
    slug: `${row.slug}-copia-${String(Date.now()).slice(-4)}`,
    published: false,
    allow_index: false,
    archived: false,
    show_in_menu: false,
    menu_label: '',
    qr_campaign: '',
    published_at: null,
    created_by: user?.id,
    updated_by: user?.id,
    gallery: Array.isArray(row.gallery) ? row.gallery.map(item => ({ ...item, storagePath: '' })) : [],
    hero_image_storage_path: '',
    hero_video_storage_path: '',
    hero_video_poster_storage_path: ''
  };
  delete copy.created_at;
  delete copy.updated_at;

  const { error } = await supabase.from('obras').insert(copy);
  if (error) return toast(error.message, 'error');

  toast('Cópia criada como rascunho.');
  await loadObras();
  openEditor(rows.find(item => item.id === copy.id));
}

function openPublicPreview() {
  if (!current?.slug) return toast('Defina o slug primeiro.', 'error');
  if (!isPersisted()) return toast('Salve a obra primeiro. A prévia lateral já mostra o layout enquanto você edita.', 'error');
  if (!current.published) return toast('Esta obra ainda é rascunho. Use a prévia lateral ou publique para abrir a página pública.', 'error');
  window.open(obraUrl(current.slug), '_blank', 'noopener');
}

async function getQr() {
  if (qrModule) return qrModule;
  const module = await import('https://esm.sh/qrcode@1.5.4?bundle');
  qrModule = module.default || module;
  return qrModule;
}

async function renderQr() {
  const root = $('#obra-qr-canvas');
  const urlElement = $('#obra-qr-url');
  if (!root || !current) return;

  if (!current.qr_enabled || !current.slug) {
    root.innerHTML = '<small>QR desativado ou slug ainda não definido.</small>';
    urlElement.textContent = '';
    return;
  }
  if (!isPersisted()) {
    root.innerHTML = '<small>Salve a obra uma vez para fixar o endereço e gerar o QR.</small>';
    urlElement.textContent = obraUrl(current.slug);
    return;
  }

  const url = qrUrl(current);
  urlElement.textContent = url;
  try {
    const QR = await getQr();
    root.innerHTML = await QR.toString(url, {
      type: 'svg', margin: 2, errorCorrectionLevel: 'L',
      color: { dark: '#0d2f35', light: '#ffffff' }
    });
  } catch {
    root.innerHTML = '<small>Não foi possível gerar a prévia do QR agora.</small>';
  }
}

async function copyQrUrl() {
  if (!current?.slug || !current.qr_enabled || !isPersisted()) return toast('Salve a obra antes de copiar o QR.', 'error');
  await navigator.clipboard.writeText(qrUrl(current));
  toast('Link do QR copiado.');
}

function download(name, href) {
  const anchor = document.createElement('a');
  anchor.href = href;
  anchor.download = name;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
}

async function downloadQrPng() {
  if (!current?.slug || !current.qr_enabled || !isPersisted()) return toast('Salve a obra antes de baixar o QR.', 'error');
  try {
    const QR = await getQr();
    const data = await QR.toDataURL(qrUrl(current), {
      width: 1024, margin: 3, errorCorrectionLevel: 'L',
      color: { dark: '#0d2f35', light: '#ffffff' }
    });
    download(`qr-${current.slug}.png`, data);
  } catch {
    toast('Não foi possível gerar o PNG.', 'error');
  }
}

async function downloadQrSvg() {
  if (!current?.slug || !current.qr_enabled || !isPersisted()) return toast('Salve a obra antes de baixar o QR.', 'error');
  try {
    const QR = await getQr();
    const svg = await QR.toString(qrUrl(current), {
      type: 'svg', margin: 3, errorCorrectionLevel: 'L',
      color: { dark: '#0d2f35', light: '#ffffff' }
    });
    const blob = new Blob([svg], { type: 'image/svg+xml' });
    const url = URL.createObjectURL(blob);
    download(`qr-${current.slug}.svg`, url);
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  } catch {
    toast('Não foi possível gerar o SVG.', 'error');
  }
}

window.addEventListener('beforeunload', event => {
  if (!dirty || !current) return;
  event.preventDefault();
  event.returnValue = '';
});

ensureUi();
onAuthStateChanged(auth, nextUser => {
  user = nextUser;
  if (nextUser && $('#view-obras')?.classList.contains('active')) loadObras();
});