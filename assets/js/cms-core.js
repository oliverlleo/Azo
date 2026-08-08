const SKIP_TEXT_TAGS = new Set(['SCRIPT','STYLE','NOSCRIPT','SVG','CANVAS','TEMPLATE']);

function normalizePageId(pathname = location.pathname) {
  let file = pathname.split('/').filter(Boolean).pop() || 'index.html';
  if (!file.includes('.')) file = 'index.html';
  return file.replace(/\.html?$/i, '') || 'index';
}

function elementPath(el, root = el?.ownerDocument?.body) {
  if (!el || !root) return '';
  const parts = [];
  let node = el;
  while (node && node.nodeType === 1) {
    const tag = node.tagName.toLowerCase();
    const parent = node.parentElement;
    let part = tag;
    if (parent) {
      const same = [...parent.children].filter(child => child.tagName === node.tagName);
      if (same.length > 1) part += `:nth-of-type(${same.indexOf(node) + 1})`;
    }
    parts.unshift(part);
    if (node === root) break;
    node = parent;
  }
  return parts.join('>');
}

function textNodeIndex(node) {
  if (!node?.parentNode) return 0;
  return [...node.parentNode.childNodes].filter(n => n.nodeType === Node.TEXT_NODE).indexOf(node);
}

function splitWhitespace(value = '') {
  const lead = value.match(/^\s*/)?.[0] || '';
  const trail = value.match(/\s*$/)?.[0] || '';
  const middle = value.slice(lead.length, value.length - trail.length);
  return { lead, middle, trail };
}

function scanTextNodes(doc) {
  const items = [];
  if (!doc?.body) return items;
  const walker = doc.createTreeWalker(doc.body, NodeFilter.SHOW_TEXT, {
    acceptNode(node) {
      const parent = node.parentElement;
      if (!parent || SKIP_TEXT_TAGS.has(parent.tagName)) return NodeFilter.FILTER_REJECT;
      const value = node.nodeValue || '';
      if (!value.trim()) return NodeFilter.FILTER_REJECT;
      if (parent.closest('[data-cms-ignore]')) return NodeFilter.FILTER_REJECT;
      return NodeFilter.FILTER_ACCEPT;
    }
  });
  let node;
  while ((node = walker.nextNode())) {
    const parent = node.parentElement;
    const raw = node.nodeValue || '';
    const { middle } = splitWhitespace(raw);
    const path = elementPath(parent, doc.body);
    const index = textNodeIndex(node);
    items.push({
      key: `text:${path}::${index}`,
      type: 'text',
      value: middle,
      original: middle,
      tag: parent.tagName.toLowerCase(),
      context: `${parent.tagName.toLowerCase()}${parent.className ? '.' + String(parent.className).trim().replace(/\s+/g,'.') : ''}`
    });
  }
  return items;
}

function scanHead(doc) {
  const items = [];
  const title = doc.querySelector('title');
  if (title) items.push({ key: 'head:title', type: 'head', field: 'title', value: title.textContent || '', original: title.textContent || '', context: 'Título da página' });
  const selectors = [
    ['meta[name="description"]','description','Descrição SEO'],
    ['meta[property="og:title"]','og:title','Título para compartilhamento'],
    ['meta[property="og:description"]','og:description','Descrição para compartilhamento']
  ];
  for (const [selector, field, label] of selectors) {
    const meta = doc.querySelector(selector);
    if (!meta) continue;
    const value = meta.getAttribute('content') || '';
    items.push({ key: `head:${field}`, type: 'head', field, value, original: value, context: label });
  }
  return items;
}

function scanImages(doc) {
  if (!doc?.body) return [];
  return [...doc.querySelectorAll('img')].map(img => {
    const rawSrc = img.getAttribute('src') || '';
    return {
      key: `image:${elementPath(img, doc.body)}`,
      type: 'image',
      value: rawSrc,
      original: rawSrc,
      alt: img.getAttribute('alt') || '',
      width: img.getAttribute('width') || '',
      height: img.getAttribute('height') || '',
      context: img.getAttribute('alt') || rawSrc || 'Imagem'
    };
  });
}

function scanDocument(doc) {
  return [...scanHead(doc), ...scanTextNodes(doc), ...scanImages(doc)];
}

function applyOverride(doc, item) {
  if (!item?.key) return;
  if (item.key.startsWith('head:')) {
    const field = item.key.slice(5);
    if (field === 'title') {
      const title = doc.querySelector('title');
      if (title && typeof item.value === 'string') title.textContent = item.value;
      return;
    }
    const selector = field === 'description' ? 'meta[name="description"]' : `meta[property="${field}"]`;
    const meta = doc.querySelector(selector);
    if (meta && typeof item.value === 'string') meta.setAttribute('content', item.value);
    return;
  }

  if (item.key.startsWith('text:')) {
    const marker = item.key.slice(5);
    const splitAt = marker.lastIndexOf('::');
    if (splitAt < 0) return;
    const path = marker.slice(0, splitAt);
    const index = Number(marker.slice(splitAt + 2));
    const parent = doc.querySelector(path);
    if (!parent || Number.isNaN(index)) return;
    const nodes = [...parent.childNodes].filter(n => n.nodeType === Node.TEXT_NODE);
    const node = nodes[index];
    if (!node || typeof item.value !== 'string') return;
    const { lead, trail } = splitWhitespace(node.nodeValue || '');
    node.nodeValue = `${lead}${item.value}${trail}`;
    return;
  }

  if (item.key.startsWith('image:')) {
    const path = item.key.slice(6);
    const img = doc.querySelector(path);
    if (!img) return;
    if (item.url) {
      img.setAttribute('src', item.url);
      img.removeAttribute('srcset');
    }
    if (typeof item.alt === 'string') img.setAttribute('alt', item.alt);
  }
}

function applyPageOverrides(doc, items = []) {
  for (const item of items) applyOverride(doc, item);
}

function normalizeAssetPath(value = '', base = location.href) {
  if (!value) return '';
  try {
    const url = new URL(value, base);
    if (url.protocol === 'data:' || url.protocol === 'blob:') return value;
    return decodeURIComponent(url.pathname).replace(/^\/+/, '');
  } catch {
    return String(value).replace(/^\.\//, '').replace(/^\/+/, '');
  }
}

function assetDocId(path) {
  return encodeURIComponent(path).replace(/\./g, '%2E');
}

export {
  normalizePageId,
  elementPath,
  scanDocument,
  scanTextNodes,
  scanImages,
  scanHead,
  applyPageOverrides,
  normalizeAssetPath,
  assetDocId
};
