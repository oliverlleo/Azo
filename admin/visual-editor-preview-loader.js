// Carregamento robusto da prévia do editor visual.
// Em vez de depender de iframe.src (que pode ser redirecionado/bloqueado pelo host),
// busca o HTML da página e injeta como srcdoc mantendo a mesma origem e os assets.

const PAGE_FILES = {
  index: 'index.html',
  servicos: 'servicos.html',
  projetos: 'projetos.html',
  sobre: 'sobre.html',
  contato: 'contato.html',
  'projeto-arquitetonico': 'projeto-arquitetonico.html',
  interiores: 'interiores.html',
  'gestao-de-obras': 'gestao-de-obras.html'
};

const $ = (selector, root = document) => root.querySelector(selector);
let loadToken = 0;
let internalUpdate = false;

function siteRootUrl() {
  return new URL('../', location.href);
}

function selectedPageId() {
  return $('#ve3-page')?.value || sessionStorage.getItem('azo-visual-editor-page') || 'index';
}

function errorDocument(message) {
  const safe = String(message || 'Não foi possível carregar a página.')
    .replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  return `<!doctype html><html><head><meta charset="utf-8"><style>html,body{margin:0;min-height:100%;font-family:system-ui;background:#f7f4ee;color:#0d2f35}body{display:grid;place-items:center;padding:40px;box-sizing:border-box}.box{max-width:620px;background:#fff;border:1px solid #ded9cf;border-radius:22px;padding:28px;box-shadow:0 20px 60px rgba(13,47,53,.08)}h1{font:400 32px/1.05 Georgia,serif;margin:0 0 12px}p{line-height:1.6;color:#667273}</style></head><body><div class="box"><h1>Prévia indisponível</h1><p>${safe}</p></div></body></html>`;
}

function prepareHtml(html, pageId) {
  const parser = new DOMParser();
  const doc = parser.parseFromString(html, 'text/html');

  // Garante que todos os links relativos, CSS, imagens e scripts continuem apontando
  // para a raiz real do site, mesmo dentro de about:srcdoc.
  doc.querySelector('base')?.remove();
  const base = doc.createElement('base');
  base.href = siteRootUrl().href;
  doc.head.prepend(base);

  // Informa ao CMS qual página está sendo visualizada, já que location.pathname em
  // srcdoc não contém o nome do arquivo original.
  doc.documentElement.dataset.azoPreviewPage = pageId;

  // O loader de 0–100 e a transição não fazem sentido dentro do editor visual.
  doc.querySelector('.loader')?.remove();
  doc.querySelector('.page-transition')?.remove();
  doc.body?.classList.remove('is-loading');

  const style = doc.createElement('style');
  style.id = 'azo-visual-preview-bootstrap';
  style.textContent = `
    html,body{min-height:100%!important}
    .loader,.page-transition{display:none!important}
  `;
  doc.head.appendChild(style);

  // Baseia o CMS no ID original da página antes dos módulos do site carregarem.
  const marker = doc.createElement('script');
  marker.textContent = `document.documentElement.dataset.azoPreviewPage=${JSON.stringify(pageId)};`;
  doc.head.appendChild(marker);

  return '<!doctype html>\n' + doc.documentElement.outerHTML;
}

async function loadPreview(reason = 'manual') {
  if (internalUpdate) return;
  const frame = $('#ve3-frame');
  const select = $('#ve3-page');
  if (!frame || !select) return;

  const pageId = selectedPageId();
  const file = PAGE_FILES[pageId] || PAGE_FILES.index;
  const token = ++loadToken;
  sessionStorage.setItem('azo-visual-editor-page', pageId);
  sessionStorage.setItem('azo-visual-editor-open', '1');

  try {
    frame.dataset.previewLoading = '1';
    const response = await fetch(new URL(file, siteRootUrl()).href + `?azo-editor-source=${Date.now()}`, {
      cache: 'no-store',
      credentials: 'same-origin'
    });
    if (!response.ok) throw new Error(`A página ${file} respondeu HTTP ${response.status}.`);
    const html = await response.text();
    if (token !== loadToken) return;
    if (!/<body[\s>]/i.test(html) || html.length < 300) throw new Error(`O servidor devolveu conteúdo inválido para ${file}.`);

    internalUpdate = true;
    // srcdoc tem prioridade sobre src e evita qualquer redirect do documento interno.
    frame.srcdoc = prepareHtml(html, pageId);
    frame.removeAttribute('src');
    frame.dataset.previewPage = pageId;
    frame.dataset.previewReason = reason;
    queueMicrotask(() => { internalUpdate = false; });
  } catch (error) {
    console.error('[AZO Studio] Falha ao carregar prévia visual', error);
    if (token !== loadToken) return;
    internalUpdate = true;
    frame.srcdoc = errorDocument(error?.message || error);
    frame.removeAttribute('src');
    queueMicrotask(() => { internalUpdate = false; });
  } finally {
    delete frame.dataset.previewLoading;
  }
}

function install() {
  const frame = $('#ve3-frame');
  const select = $('#ve3-page');
  if (!frame || !select || frame.dataset.robustPreview === '1') return false;
  frame.dataset.robustPreview = '1';

  // O V3 já possui seus próprios listeners. Rodamos após eles e substituímos apenas
  // a forma de carregar o documento; a seleção/edição continua sendo a mesma.
  select.addEventListener('change', () => setTimeout(() => loadPreview('page-change'), 0));
  $('#ve3-reload')?.addEventListener('click', () => setTimeout(() => loadPreview('reload'), 0));

  // Se o V3 tentar alterar src em algum fluxo antigo (ex.: pós-save), convertemos
  // novamente para a página escolhida em vez de deixar o iframe branco.
  new MutationObserver(records => {
    if (internalUpdate) return;
    if (records.some(record => record.type === 'attributes' && record.attributeName === 'src')) {
      setTimeout(() => loadPreview('src-intercept'), 0);
    }
  }).observe(frame, { attributes:true, attributeFilter:['src'] });

  loadPreview('initial');
  return true;
}

if (!install()) {
  const observer = new MutationObserver(() => {
    if (install()) observer.disconnect();
  });
  observer.observe(document.documentElement, { childList:true, subtree:true });
}
