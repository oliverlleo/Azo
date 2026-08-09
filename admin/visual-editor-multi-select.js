import { auth, db, storage } from '../assets/js/firebase-config.js';
import { doc, getDoc, setDoc, deleteDoc, serverTimestamp } from 'https://www.gstatic.com/firebasejs/12.16.0/firebase-firestore.js';
import { ref, uploadBytesResumable, getDownloadURL, deleteObject } from 'https://www.gstatic.com/firebasejs/12.16.0/firebase-storage.js';
import { assetDocId } from '../assets/js/cms-core.js';

const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
const esc = value => String(value ?? '').replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));

let selected = null;
let wiredGlass = null;

function toast(message, type = 'success') {
  const stack = $('#toast-stack');
  if (!stack) return alert(message);
  const item = document.createElement('div');
  item.className = `toast ${type}`;
  item.innerHTML = `<b>${type === 'error' ? '!' : '✓'}</b><span>${esc(message)}</span>`;
  stack.appendChild(item);
  setTimeout(() => item.remove(), 3600);
}

function installStyles() {
  if ($('#ve2-multi-style')) return;
  const style = document.createElement('style');
  style.id = 've2-multi-style';
  style.textContent = `
    .ve2-multi-title{margin-top:16px;font-size:.7rem;font-weight:900;text-transform:uppercase;letter-spacing:.08em;color:var(--muted)}
    .ve2-text-options,.ve2-image-options{display:grid;gap:8px;margin-top:9px}
    .ve2-text-option,.ve2-image-option{width:100%;border:1px solid var(--line);background:#fff;border-radius:14px;padding:10px;text-align:left;cursor:pointer;display:grid;gap:3px;transition:.18s}
    .ve2-text-option:hover,.ve2-image-option:hover{border-color:#0d2f35;box-shadow:0 7px 18px rgba(13,47,53,.07)}
    .ve2-text-option.active,.ve2-image-option.active{border-color:#0d2f35;box-shadow:0 0 0 3px rgba(13,47,53,.08)}
    .ve2-text-option strong,.ve2-image-option strong{font-size:.75rem;line-height:1.35}.ve2-text-option small,.ve2-image-option small{font-size:.63rem;color:var(--muted);line-height:1.35}
    .ve2-image-option{grid-template-columns:72px 1fr;align-items:center}.ve2-image-option img{width:72px;height:54px;border-radius:9px;object-fit:cover;background:#eee}
    .ve2-multi-note{margin-top:10px;padding:10px 11px;border-radius:12px;background:#edf3f1;color:#355154;font-size:.69rem;line-height:1.45}
  `;
  document.head.appendChild(style);
}

function frameDocument() {
  return $('#ve2-frame')?.contentDocument || null;
}

function pageId() {
  return $('#ve2-page')?.value || 'index';
}

function pageLabel() {
  const select = $('#ve2-page');
  return select?.selectedOptions?.[0]?.textContent || 'Página do site';
}

function pointFromEvent(event) {
  const glass = $('#ve2-glass');
  if (!glass) return { x: 0, y: 0 };
  const rect = glass.getBoundingClientRect();
  return { x: event.clientX - rect.left, y: event.clientY - rect.top };
}

function elementPath(element, root) {
  const parts = [];
  for (let node = element; node && node.nodeType === 1; node = node.parentElement) {
    let part = node.tagName.toLowerCase();
    const parent = node.parentElement;
    if (parent) {
      const siblings = [...parent.children].filter(child => child.tagName === node.tagName);
      if (siblings.length > 1) part += `:nth-of-type(${siblings.indexOf(node) + 1})`;
    }
    parts.unshift(part);
    if (node === root) break;
  }
  return parts.join('>');
}

function textKey(node, docu) {
  const parent = node?.parentElement;
  if (!parent) return '';
  const index = [...parent.childNodes].filter(child => child.nodeType === 3).indexOf(node);
  return `text:${elementPath(parent, docu.body)}::${index}`;
}

function hrefKey(anchor, docu) {
  return `attr:${elementPath(anchor, docu.body)}::href`;
}

function textNodeAtPoint(docu, x, y) {
  try {
    if (typeof docu.caretPositionFromPoint === 'function') {
      const pos = docu.caretPositionFromPoint(x, y);
      const node = pos?.offsetNode;
      if (node?.nodeType === 3 && node.nodeValue?.trim()) return node;
    }
    if (typeof docu.caretRangeFromPoint === 'function') {
      const range = docu.caretRangeFromPoint(x, y);
      const node = range?.startContainer;
      if (node?.nodeType === 3 && node.nodeValue?.trim()) return node;
    }
  } catch (_) {}
  return null;
}

function projectManagedElement(element) {
  return Boolean(element?.closest(
    '.project-info__name,.project-info__meta,.portfolio-card[data-gallery] h3,.portfolio-card[data-gallery] .portfolio-card__text div span,[data-cms-project] h3,[data-cms-project] .portfolio-card__text div span'
  ));
}

function logicalTextBlock(node) {
  const parent = node?.parentElement;
  if (!parent) return null;
  return parent.closest('a,button,[role="button"],h1,h2,h3,h4,p,blockquote,figcaption,label,.hero__kicker,.hero__copy,.section-title,.section-copy') || parent;
}

function textNodesInBlock(node) {
  const root = logicalTextBlock(node);
  if (!root) return [node];
  const docu = root.ownerDocument;
  const NF = docu.defaultView.NodeFilter;
  const walker = docu.createTreeWalker(root, NF.SHOW_TEXT, {
    acceptNode(current) {
      if (!current.nodeValue?.trim()) return NF.FILTER_REJECT;
      if (current.parentElement?.closest('script,style,noscript,svg')) return NF.FILTER_REJECT;
      return NF.FILTER_ACCEPT;
    }
  });
  const nodes = [];
  let current;
  while ((current = walker.nextNode())) {
    if (!nodes.includes(current)) nodes.push(current);
  }
  return nodes.length ? nodes.slice(0, 20) : [node];
}

function canonicalAsset(img) {
  const src = img?.dataset?.cmsSource || img?.getAttribute('src') || '';
  if (!src) return '';
  if (src.startsWith('assets/')) return src;
  if (src.startsWith('../assets/')) return src.slice(3);
  try {
    return decodeURIComponent(new URL(src, location.href).pathname).match(/(assets\/images\/.*)$/)?.[1] || '';
  } catch (_) {
    return '';
  }
}

function imageName(path, img, index = 0) {
  const project = path.match(/assets\/images\/projects\/([a-z]+)-(\d+)(-sm)?\.webp$/i);
  if (project) return `Casa ${project[1].toUpperCase()} — foto ${Number(project[2])}${project[3] ? ' — celular' : ''}`;
  if (path.includes('hero')) return `Imagem do topo${index ? ` — cena ${index + 1}` : ''}`;
  if (path.includes('service-architecture')) return 'Imagem do serviço Projeto arquitetônico';
  if (path.includes('service-interiors')) return 'Imagem do serviço Interiores';
  if (path.includes('service-build')) return 'Imagem do serviço Gestão de obras';
  if (path.includes('project-feature')) return 'Imagem de destaque dos projetos';
  if (path.includes('team')) return 'Foto da equipe';
  if (path.includes('about')) return 'Imagem da seção Sobre a AZO';
  if (path.includes('logo')) return 'Logo da AZO';
  return img?.alt || `Imagem ${index + 1}`;
}

function imagesAtPoint(docu, x, y) {
  const result = [];
  for (const img of [...docu.images]) {
    const rect = img.getBoundingClientRect();
    if (rect.width < 2 || rect.height < 2) continue;
    const style = docu.defaultView.getComputedStyle(img);
    if (style.display === 'none' || style.visibility === 'hidden') continue;
    if (x < rect.left || x > rect.right || y < rect.top || y > rect.bottom) continue;
    const path = canonicalAsset(img);
    const identity = path || img.currentSrc || img.src;
    if (!identity || result.some(item => item.identity === identity)) continue;
    result.push({ img, path, identity, rect });
  }
  return result;
}

function highlight(element) {
  const docu = frameDocument();
  if (!docu || !element) return;
  docu.querySelectorAll('.ve2-selected').forEach(item => item.classList.remove('ve2-selected'));
  element.classList.add('ve2-selected');
}

async function pageItems() {
  const snap = await getDoc(doc(db, 'sitePages', pageId())).catch(() => null);
  return snap?.exists() && Array.isArray(snap.data().items) ? snap.data().items : [];
}

async function savePageItems(items) {
  const user = auth.currentUser;
  if (!user) throw new Error('Sua sessão expirou. Entre novamente.');
  await setDoc(doc(db, 'sitePages', pageId()), {
    page: pageId(),
    items,
    updatedAt: serverTimestamp(),
    updatedBy: user.uid
  }, { merge: true });
}

function sectionName(element) {
  if (element?.closest('.site-header,.mobile-nav')) return 'Menu principal';
  if (element?.closest('.hero,.inner-hero')) return 'Topo da página';
  if (element?.closest('.services')) return 'Seção Serviços';
  if (element?.closest('.projects,.projects-grid')) return 'Seção Projetos';
  if (element?.closest('.method')) return 'Seção Como trabalhamos';
  if (element?.closest('.about-teaser')) return 'Seção Sobre a AZO';
  if (element?.closest('.footer')) return 'Rodapé';
  if (element?.closest('form')) return 'Formulário';
  return pageLabel();
}

function renderTextOptions(nodes, activeNode) {
  if (nodes.length < 2) return '';
  return `<div class="ve2-multi-title">Textos neste mesmo bloco</div><div class="ve2-text-options">${nodes.map((node, index) => {
    const value = node.nodeValue.trim();
    return `<button type="button" class="ve2-text-option ${node === activeNode ? 'active' : ''}" data-multi-text="${index}"><strong>${esc(value.slice(0, 85))}</strong><small>${node === activeNode ? 'Selecionado agora' : 'Clique para editar este texto'}</small></button>`;
  }).join('')}</div>`;
}

async function openTextEditor(node) {
  const docu = frameDocument();
  const side = $('#ve2-side');
  if (!docu || !side || !node?.parentElement) return;
  const element = node.parentElement;
  if (projectManagedElement(element)) return;

  const action = element.closest('a,button,[role="button"]');
  const key = textKey(node, docu);
  const actionHrefKey = action?.tagName === 'A' ? hrefKey(action, docu) : null;
  const items = await pageItems();
  const nodes = textNodesInBlock(node);
  selected = {
    type: 'text',
    node,
    element,
    action,
    key,
    hrefKey: actionHrefKey,
    href: action?.tagName === 'A' ? (action.getAttribute('href') || '') : '',
    value: node.nodeValue.trim(),
    nodes
  };
  highlight(element);
  const hasOverride = items.some(item => item.key === key) || (actionHrefKey && items.some(item => item.key === actionHrefKey));

  side.innerHTML = `
    <p class="eyebrow">${action ? 'Editar botão ou link' : 'Editar texto'}</p>
    <h3>${esc(sectionName(element))}</h3>
    <span class="ve2-loc">${esc(pageLabel())}</span>
    <div class="ve2-field"><label>Texto que aparece no site</label><textarea id="ve2-multi-text-value">${esc(selected.value)}</textarea></div>
    ${actionHrefKey ? `<div class="ve2-field"><label>Para onde este botão/link leva</label><input id="ve2-multi-href" value="${esc(selected.href)}"></div>` : ''}
    <div class="ve2-actions"><button class="btn btn-primary" id="ve2-multi-save-text" type="button">Salvar alteração</button>${hasOverride ? '<button class="btn btn-ghost" id="ve2-multi-restore-text" type="button">Voltar ao original</button>' : ''}</div>
    ${renderTextOptions(nodes, node)}
    ${nodes.length > 1 ? '<div class="ve2-multi-note">Este bloco tem vários textos. Agora cada um pode ser selecionado e alterado separadamente.</div>' : ''}
  `;

  $('#ve2-multi-save-text').addEventListener('click', saveText);
  $('#ve2-multi-restore-text')?.addEventListener('click', restoreText);
  $$('[data-multi-text]').forEach(button => button.addEventListener('click', () => {
    const next = nodes[Number(button.dataset.multiText)];
    if (next) openTextEditor(next);
  }));
}

async function saveText() {
  if (selected?.type !== 'text') return;
  const button = $('#ve2-multi-save-text');
  const value = $('#ve2-multi-text-value')?.value ?? '';
  const href = selected.hrefKey ? ($('#ve2-multi-href')?.value.trim() || '#') : null;
  if (button) { button.disabled = true; button.textContent = 'Salvando...'; }
  try {
    const current = await pageItems();
    const keys = new Set([selected.key, selected.hrefKey].filter(Boolean));
    const next = current.filter(item => !keys.has(item.key));
    next.push({ key: selected.key, type: 'text', value });
    if (selected.hrefKey) next.push({ key: selected.hrefKey, type: 'attribute', attribute: 'href', value: href });
    await savePageItems(next);

    const raw = selected.node.nodeValue || '';
    const lead = raw.match(/^\s*/)?.[0] || '';
    const trail = raw.match(/\s*$/)?.[0] || '';
    selected.node.nodeValue = `${lead}${value}${trail}`;
    if (selected.action?.tagName === 'A' && href) selected.action.setAttribute('href', href);
    toast('Texto alterado no site.');
    await openTextEditor(selected.node);
  } catch (error) {
    toast(error.message || 'Não foi possível salvar o texto.', 'error');
  } finally {
    if (button) { button.disabled = false; button.textContent = 'Salvar alteração'; }
  }
}

async function restoreText() {
  if (selected?.type !== 'text') return;
  try {
    const current = await pageItems();
    const keys = new Set([selected.key, selected.hrefKey].filter(Boolean));
    await savePageItems(current.filter(item => !keys.has(item.key)));
    toast('Conteúdo original restaurado.');
    $('#ve2-reload')?.click();
  } catch (error) {
    toast(error.message || 'Não foi possível restaurar.', 'error');
  }
}

function renderImageChooser(images) {
  const side = $('#ve2-side');
  if (!side) return;
  side.innerHTML = `
    <p class="eyebrow">Imagens no mesmo lugar</p>
    <h3>Escolha qual imagem quer alterar.</h3>
    <span class="ve2-loc">${esc(pageLabel())}</span>
    <div class="ve2-multi-note">Existem ${images.length} imagens ocupando esta mesma área porque elas ficam alternando no site. Agora você pode escolher qualquer uma.</div>
    <div class="ve2-image-options">${images.map((item, index) => `<button type="button" class="ve2-image-option" data-multi-image="${index}"><img src="${esc(item.img.currentSrc || item.img.src)}" alt=""><span><strong>${esc(imageName(item.path, item.img, index))}</strong><small>${item.path ? esc(item.path.split('/').pop()) : 'Imagem do projeto'}</small></span></button>`).join('')}</div>
  `;
  $$('[data-multi-image]').forEach(button => button.addEventListener('click', () => {
    const item = images[Number(button.dataset.multiImage)];
    if (item) openImageEditor(item, images);
  }));
}

function safeName(value = '') {
  return value.normalize('NFKD').replace(/[^a-zA-Z0-9._-]+/g, '-').replace(/^-+|-+$/g, '') || 'imagem';
}

function upload(file, path, onProgress) {
  return new Promise((resolve, reject) => {
    const task = uploadBytesResumable(ref(storage, path), file, { contentType: file.type, cacheControl: 'public,max-age=31536000,immutable' });
    task.on('state_changed', snap => onProgress?.(snap.bytesTransferred / snap.totalBytes), reject, async () => {
      resolve({ url: await getDownloadURL(task.snapshot.ref), storagePath: task.snapshot.ref.fullPath });
    });
  });
}

async function openImageEditor(item, siblings = []) {
  const side = $('#ve2-side');
  if (!side) return;
  if (!item.path) {
    side.innerHTML = '<p class="eyebrow">Imagem</p><h3>Imagem de um projeto criado pelo painel</h3><p>Esta imagem deve ser gerenciada na área Projetos do modo completo.</p>';
    return;
  }
  const snap = await getDoc(doc(db, 'assets', assetDocId(item.path))).catch(() => null);
  selected = { type: 'image', ...item, override: snap?.exists() ? snap.data() : null, siblings };
  highlight(item.img);
  side.innerHTML = `
    <p class="eyebrow">Trocar imagem</p>
    <h3>${esc(imageName(item.path, item.img, siblings.indexOf(item)))}</h3>
    <span class="ve2-loc">${esc(pageLabel())}</span>
    <div class="ve2-preview"><img src="${esc(item.img.currentSrc || item.img.src)}" alt=""></div>
    <div class="ve2-field"><label>Escolha a nova imagem</label><input id="ve2-multi-image-file" type="file" accept="image/*"></div>
    <div class="ve2-actions"><button class="btn btn-primary" id="ve2-multi-save-image" type="button">Trocar imagem</button>${selected.override ? '<button class="btn btn-ghost" id="ve2-multi-restore-image" type="button">Voltar ao original</button>' : ''}</div>
    ${siblings.length > 1 ? '<button class="btn btn-ghost" id="ve2-multi-back-images" type="button" style="width:100%;margin-top:9px">Escolher outra imagem deste conjunto</button>' : ''}
  `;
  $('#ve2-multi-save-image').addEventListener('click', saveImage);
  $('#ve2-multi-restore-image')?.addEventListener('click', restoreImage);
  $('#ve2-multi-back-images')?.addEventListener('click', () => renderImageChooser(siblings));
}

async function saveImage() {
  if (selected?.type !== 'image') return;
  const file = $('#ve2-multi-image-file')?.files?.[0];
  if (!file) return toast('Escolha uma imagem primeiro.', 'error');
  if (!file.type.startsWith('image/')) return toast('Escolha um arquivo de imagem.', 'error');
  if (file.size > 30 * 1024 * 1024) return toast('A imagem deve ter no máximo 30 MB.', 'error');
  const user = auth.currentUser;
  if (!user) return toast('Sua sessão expirou. Entre novamente.', 'error');
  const button = $('#ve2-multi-save-image');
  if (button) { button.disabled = true; button.textContent = 'Enviando...'; }
  try {
    const previous = selected.override;
    const uploaded = await upload(file, `site/visual/${Date.now()}-${safeName(file.name)}`, fraction => {
      if (button) button.textContent = `Enviando ${Math.round(fraction * 100)}%`;
    });
    await setDoc(doc(db, 'assets', assetDocId(selected.path)), {
      path: selected.path,
      url: uploaded.url,
      storagePath: uploaded.storagePath,
      fileName: file.name,
      contentType: file.type,
      size: file.size,
      updatedAt: serverTimestamp(),
      updatedBy: user.uid
    });
    if (previous?.storagePath && previous.storagePath !== uploaded.storagePath) deleteObject(ref(storage, previous.storagePath)).catch(() => {});

    const docu = frameDocument();
    docu?.querySelectorAll('img').forEach(img => {
      if (canonicalAsset(img) === selected.path) {
        img.dataset.cmsSource = selected.path;
        img.src = uploaded.url;
        img.removeAttribute('srcset');
      }
    });
    selected.img.dataset.cmsSource = selected.path;
    selected.img.src = uploaded.url;
    selected.override = uploaded;
    toast('Imagem alterada no site.');
    await openImageEditor(selected, selected.siblings || []);
  } catch (error) {
    toast(error.message || 'Não foi possível trocar a imagem.', 'error');
  } finally {
    if (button) { button.disabled = false; button.textContent = 'Trocar imagem'; }
  }
}

async function restoreImage() {
  if (selected?.type !== 'image' || !selected.override) return;
  try {
    await deleteDoc(doc(db, 'assets', assetDocId(selected.path)));
    if (selected.override.storagePath) deleteObject(ref(storage, selected.override.storagePath)).catch(() => {});
    toast('Imagem original restaurada.');
    $('#ve2-reload')?.click();
  } catch (error) {
    toast(error.message || 'Não foi possível restaurar.', 'error');
  }
}

function setBadge(text, x, y) {
  const badge = $('#ve2-badge');
  if (!badge) return;
  if (!text) { badge.style.display = 'none'; return; }
  badge.textContent = text;
  badge.style.left = `${Math.max(8, Math.min(520, x + 12))}px`;
  badge.style.top = `${Math.max(48, y - 34)}px`;
  badge.style.display = 'block';
}

function handleMouseMove(event) {
  const docu = frameDocument();
  if (!docu?.body) return;
  const { x, y } = pointFromEvent(event);
  const images = imagesAtPoint(docu, x, y);
  if (images.length > 1) {
    event.stopImmediatePropagation();
    setBadge(`✎ ${images.length} imagens aqui — clique para escolher`, x, y);
    return;
  }
  if (images.length === 1) {
    event.stopImmediatePropagation();
    setBadge(`✎ Editar imagem — ${imageName(images[0].path, images[0].img)}`, x, y);
    return;
  }
  const node = textNodeAtPoint(docu, x, y);
  if (node?.parentElement && !projectManagedElement(node.parentElement)) {
    event.stopImmediatePropagation();
    const nodes = textNodesInBlock(node);
    setBadge(nodes.length > 1 ? `✎ Editar este texto — bloco com ${nodes.length} textos` : `✎ Editar texto`, x, y);
  }
}

function handleClick(event) {
  const docu = frameDocument();
  if (!docu?.body) return;
  const { x, y } = pointFromEvent(event);
  const images = imagesAtPoint(docu, x, y);
  if (images.length) {
    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation();
    if (images.length > 1) renderImageChooser(images);
    else openImageEditor(images[0], images);
    return;
  }

  const node = textNodeAtPoint(docu, x, y);
  if (node?.parentElement && !projectManagedElement(node.parentElement)) {
    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation();
    openTextEditor(node);
  }
}

function wire() {
  installStyles();
  const glass = $('#ve2-glass');
  if (!glass || glass === wiredGlass) return;
  wiredGlass = glass;
  glass.addEventListener('mousemove', handleMouseMove, true);
  glass.addEventListener('click', handleClick, true);
}

const observer = new MutationObserver(wire);
observer.observe(document.documentElement, { childList: true, subtree: true });
document.addEventListener('DOMContentLoaded', wire);
setInterval(wire, 1000);
wire();
