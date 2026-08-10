// Mantém o editor visual aberto enquanto apenas a página da prévia é trocada.
// Também restaura a página selecionada se o Firebase revalidar a sessão e o admin
// tentar voltar para a Visão geral.

const VISUAL_VIEW_ID = 'view-visual-v3';
const PAGE_KEY = 'azo-visual-editor-page';
const OPEN_KEY = 'azo-visual-editor-open';

const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];

let intentionalNavigationUntil = 0;
let restoringPage = false;
let scheduled = false;

function visualOpen() {
  return sessionStorage.getItem(OPEN_KEY) === '1';
}

function rememberVisualOpen() {
  sessionStorage.setItem(OPEN_KEY, '1');
}

function forgetVisualOpen() {
  sessionStorage.removeItem(OPEN_KEY);
}

function rememberPage(value) {
  if (value) sessionStorage.setItem(PAGE_KEY, value);
}

function restoreSelectedPage() {
  const select = $('#ve3-page');
  const saved = sessionStorage.getItem(PAGE_KEY);
  if (!select || !saved || select.value === saved || restoringPage) return;
  if (![...select.options].some(option => option.value === saved)) return;

  restoringPage = true;
  select.value = saved;
  // Dispara o listener original do editor para atualizar seu estado interno e
  // recarregar SOMENTE o iframe com a página que estava selecionada.
  select.dispatchEvent(new Event('change', { bubbles: false }));
  queueMicrotask(() => { restoringPage = false; });
}

function keepVisualEditorOpen() {
  scheduled = false;
  if (!visualOpen()) return;
  if (performance.now() < intentionalNavigationUntil) return;

  const shell = $('#app-shell');
  const visual = $(`#${VISUAL_VIEW_ID}`);
  if (!shell || shell.hidden || !visual) return;

  // Nunca navega o documento principal. Apenas mantém a view já existente ativa.
  $$('.view').forEach(view => view.classList.toggle('active', view === visual));
  $$('.nav-item').forEach(button => button.classList.remove('active'));
  $('#ve3-nav')?.classList.add('active');

  const kicker = $('#view-kicker');
  const title = $('#view-title');
  if (kicker) kicker.textContent = 'Edição direta no site';
  if (title) title.textContent = 'Editar visualmente';

  restoreSelectedPage();
}

function scheduleKeep() {
  if (scheduled) return;
  scheduled = true;
  requestAnimationFrame(keepVisualEditorOpen);
}

// Marcar entrada intencional no editor visual.
document.addEventListener('click', event => {
  if (event.target.closest('#ve3-nav,[data-ve3-open]')) {
    rememberVisualOpen();
    scheduleKeep();
    return;
  }

  // Se a pessoa escolheu de propósito outra área do painel, não forçamos o editor.
  if (event.target.closest('.nav-item[data-view],[data-go]')) {
    intentionalNavigationUntil = performance.now() + 700;
    forgetVisualOpen();
  }

  if (event.target.closest('#logout-button')) {
    forgetVisualOpen();
    sessionStorage.removeItem(PAGE_KEY);
  }
}, true);

// Trocar "Página do site" deve alterar só o iframe; o painel permanece no editor.
document.addEventListener('change', event => {
  const select = event.target.closest?.('#ve3-page');
  if (!select) return;

  rememberVisualOpen();
  rememberPage(select.value);

  // O listener original do V3 troca o src do iframe. Depois dele, garantimos que
  // nenhuma revalidação de sessão consiga reativar a Visão geral.
  queueMicrotask(scheduleKeep);
  setTimeout(scheduleKeep, 60);
  setTimeout(scheduleKeep, 250);
  setTimeout(scheduleKeep, 900);
}, true);

// O admin e o editor criam/alteram views dinamicamente. Se uma revalidação do
// Firebase mudar classes ou hidden, restauramos a view visual sem recarregar a página.
const observer = new MutationObserver(scheduleKeep);
observer.observe(document.documentElement, {
  subtree: true,
  childList: true,
  attributes: true,
  attributeFilter: ['class', 'hidden']
});

// Se a aba/documento for restaurado, manter exatamente o editor e a página usados.
document.addEventListener('visibilitychange', () => {
  if (!document.hidden) scheduleKeep();
});
document.addEventListener('DOMContentLoaded', scheduleKeep);
setTimeout(scheduleKeep, 0);
setTimeout(scheduleKeep, 400);
setTimeout(scheduleKeep, 1200);
