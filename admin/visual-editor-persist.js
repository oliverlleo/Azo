import { auth, db } from '../assets/js/firebase-config.js';
import { doc, getDoc, setDoc, serverTimestamp } from 'https://www.gstatic.com/firebasejs/12.16.0/firebase-firestore.js';

const $ = (s, r = document) => r.querySelector(s);
const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

function toast(message, type = 'success') {
  const stack = $('#toast-stack');
  if (!stack) return alert(message);
  const el = document.createElement('div');
  el.className = `toast ${type}`;
  el.innerHTML = `<b>${type === 'error' ? '!' : '✓'}</b><span>${esc(message)}</span>`;
  stack.appendChild(el);
  setTimeout(() => el.remove(), 4200);
}

function frameDoc() { return $('#ve3-frame')?.contentDocument || null; }
function pageId() { return $('#ve3-page')?.value || 'index'; }

function pathOf(el, root) {
  const parts = [];
  for (let node = el; node && node.nodeType === 1; node = node.parentElement) {
    let part = node.tagName.toLowerCase();
    const parent = node.parentElement;
    if (parent) {
      const same = [...parent.children].filter(child => child.tagName === node.tagName);
      if (same.length > 1) part += `:nth-of-type(${same.indexOf(node) + 1})`;
    }
    parts.unshift(part);
    if (node === root) break;
  }
  return parts.join('>');
}

function textNodes(root) {
  if (!root) return [];
  const docu = root.ownerDocument;
  const NF = docu.defaultView.NodeFilter;
  const walker = docu.createTreeWalker(root, NF.SHOW_TEXT, {
    acceptNode(node) {
      if (!node.nodeValue?.trim()) return NF.FILTER_REJECT;
      if (node.parentElement?.closest('svg,script,style,noscript,.loader,.page-transition')) return NF.FILTER_REJECT;
      return NF.FILTER_ACCEPT;
    }
  });
  const out = [];
  let node;
  while ((node = walker.nextNode())) out.push(node);
  return out;
}

function keyForTextNode(node, docu) {
  const parent = node?.parentElement;
  if (!parent) return '';
  const index = [...parent.childNodes].filter(n => n.nodeType === 3).indexOf(node);
  return `text:${pathOf(parent, docu.body)}::${index}`;
}

function keyForHref(anchor, docu) {
  return `attr:${pathOf(anchor, docu.body)}::href`;
}

function currentTextControl() {
  return $('#ve3-text-priority') || $('#ve3-precision-text') || $('#ve3-text');
}

function currentSaveButton() {
  return $('#ve3-save-text-priority') || $('#ve3-precision-save-text') || $('#ve3-save-text');
}

function currentHrefControl() {
  return $('#ve3-href-priority') || $('#ve3-precision-href') || $('#ve3-href');
}

function bindSelectionMetadata() {
  const textarea = currentTextControl();
  const docu = frameDoc();
  const selected = docu?.querySelector('.ve3-selected');
  if (!textarea || !docu || !selected || textarea.dataset.persistReady === '1') return;

  const initial = textarea.value.trim();
  const nodes = textNodes(selected);
  let node = nodes.find(n => n.nodeValue.trim() === initial);
  if (!node && selected.childNodes) {
    node = [...selected.childNodes].find(n => n.nodeType === 3 && n.nodeValue?.trim());
  }
  if (!node && nodes.length === 1) node = nodes[0];
  if (!node) return;

  const key = keyForTextNode(node, docu);
  if (!key) return;

  textarea.dataset.persistReady = '1';
  textarea.dataset.persistKey = key;
  textarea.dataset.persistOriginal = node.nodeValue;

  const anchor = selected.closest('a') || (selected.tagName === 'A' ? selected : null);
  if (anchor) textarea.dataset.persistHrefKey = keyForHref(anchor, docu);
}

async function readItems(id) {
  const snap = await getDoc(doc(db, 'sitePages', id));
  return snap.exists() && Array.isArray(snap.data().items) ? snap.data().items : [];
}

async function persistText(event) {
  const button = event.target.closest('#ve3-save-text-priority,#ve3-precision-save-text,#ve3-save-text');
  if (!button) return;

  bindSelectionMetadata();
  const textarea = currentTextControl();
  if (!textarea?.dataset.persistKey) return;

  event.preventDefault();
  event.stopPropagation();
  event.stopImmediatePropagation();

  const user = auth.currentUser;
  if (!user) return toast('Sua sessão expirou. Entre novamente.', 'error');

  const id = pageId();
  const key = textarea.dataset.persistKey;
  const hrefKey = textarea.dataset.persistHrefKey || '';
  const value = textarea.value;
  const hrefControl = currentHrefControl();
  const href = hrefKey ? (hrefControl?.value.trim() || '#') : null;

  button.disabled = true;
  button.textContent = 'Salvando no Firebase...';

  try {
    const current = await readItems(id);
    const replace = new Set([key, hrefKey].filter(Boolean));
    const next = current.filter(item => !replace.has(item.key));
    next.push({ key, type: 'text', value });
    if (hrefKey) next.push({ key: hrefKey, type: 'attribute', attribute: 'href', value: href });

    await setDoc(doc(db, 'sitePages', id), {
      page: id,
      items: next,
      updatedAt: serverTimestamp(),
      updatedBy: user.uid
    }, { merge: true });

    // Do not claim success until Firestore returns the exact value we just wrote.
    const verifySnap = await getDoc(doc(db, 'sitePages', id));
    if (!verifySnap.exists()) throw new Error('O Firebase não devolveu o conteúdo salvo.');
    const verified = Array.isArray(verifySnap.data().items) ? verifySnap.data().items : [];
    const savedText = verified.find(item => item.key === key);
    if (!savedText || savedText.value !== value) throw new Error('O texto não foi confirmado no Firebase.');
    if (hrefKey) {
      const savedHref = verified.find(item => item.key === hrefKey);
      if (!savedHref || savedHref.value !== href) throw new Error('O destino do botão não foi confirmado no Firebase.');
    }

    toast('Salvo e confirmado no Firebase.');

    // Reload from the server instead of merely changing the preview locally.
    const reload = $('#ve3-reload');
    if (reload) setTimeout(() => reload.click(), 180);
  } catch (error) {
    console.error('[AZO visual editor] Falha ao persistir texto', error);
    toast(error.message || 'Não foi possível salvar no Firebase.', 'error');
  } finally {
    button.disabled = false;
    button.textContent = 'Salvar alteração';
  }
}

// The side editor is rebuilt on every selection, so capture its metadata whenever it changes.
const observer = new MutationObserver(() => queueMicrotask(bindSelectionMetadata));
observer.observe(document.documentElement, { childList: true, subtree: true });
document.addEventListener('click', persistText, true);
document.addEventListener('DOMContentLoaded', bindSelectionMetadata);
setInterval(bindSelectionMetadata, 500);
