// Garante que salvar no editor visual nunca leve o painel para a Visão geral
// nem recarregue a prévia na página inicial por engano.

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

const OPEN_KEY = 'azo-visual-editor-open';
const PAGE_KEY = 'azo-visual-editor-page';
const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];

let savingUntil = 0;
let pageBeingSaved = null;
let syncing = false;

function selectedPage() {
  return $('#ve3-page')?.value || pageBeingSaved || 'index';
}

function rememberEditor(page = selectedPage()) {
  pageBeingSaved = page;
  sessionStorage.setItem(OPEN_KEY, '1');
  sessionStorage.setItem(PAGE_KEY, page);
}

function keepVisualOpen() {
  const shell = $('#app-shell');
  const visual = $('#view-visual-v3');
  if (!shell || shell.hidden || !visual) return;

  $$('.view').forEach(view => view.classList.toggle('active', view === visual));
  $$('.nav-item').forEach(button => button.classList.remove('active'));
  $('#ve3-nav')?.classList.add('active');
  if ($('#view-kicker')) $('#view-kicker').textContent = 'Edição direta no site';
  if ($('#view-title')) $('#view-title').textContent = 'Editar visualmente';
}

function reloadExactlySavedPage() {
  if (syncing) return;
  const select = $('#ve3-page');
  const page = pageBeingSaved || sessionStorage.getItem(PAGE_KEY) || select?.value || 'index';
  if (!select || !PAGE_FILES[page]) return;

  syncing = true;
  rememberEditor(page);
  keepVisualOpen();

  // Atualiza também o estado interno do V3. O listener original do select
  // recarrega somente o iframe usando exatamente a página selecionada.
  if (select.value !== page) select.value = page;
  select.dispatchEvent(new Event('change', { bubbles: false }));

  queueMicrotask(() => { syncing = false; });
}

function isSaveButton(target) {
  return Boolean(target.closest?.(
    '#ve3-save-text-priority,#ve3-precision-save-text,#ve3-save-text,' +
    '#ve3-precision-save-image,#ve3-save-image'
  ));
}

// Executa antes dos handlers de persistência. Assim sabemos qual página estava
// sendo editada antes de qualquer atualização/revalidação assíncrona.
document.addEventListener('click', event => {
  if (isSaveButton(event.target)) {
    pageBeingSaved = $('#ve3-page')?.value || 'index';
    savingUntil = Date.now() + 12000;
    rememberEditor(pageBeingSaved);
    keepVisualOpen();
    return;
  }

  // visual-editor-persist.js usa .click() em "Atualizar página" depois de salvar.
  // Bloqueamos apenas esse clique PROGRAMÁTICO durante o salvamento, pois ele
  // dependia de um estado interno que podia estar em "index".
  if (event.target.closest?.('#ve3-reload') && !event.isTrusted && Date.now() < savingUntil) {
    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation();
    setTimeout(reloadExactlySavedPage, 0);
  }
}, true);

// Só após o próprio editor informar que o Firebase confirmou o salvamento,
// sincronizamos a prévia com a página que estava sendo editada.
const toastObserver = new MutationObserver(mutations => {
  for (const mutation of mutations) {
    for (const node of mutation.addedNodes) {
      if (!(node instanceof HTMLElement)) continue;
      const text = node.textContent || '';
      if (!/confirmad[oa] no Firebase/i.test(text)) continue;

      savingUntil = Date.now() + 2500;
      rememberEditor(pageBeingSaved || selectedPage());
      keepVisualOpen();
      setTimeout(reloadExactlySavedPage, 20);
      setTimeout(keepVisualOpen, 250);
      setTimeout(keepVisualOpen, 900);
    }
  }
});

const stack = $('#toast-stack');
if (stack) toastObserver.observe(stack, { childList: true });
