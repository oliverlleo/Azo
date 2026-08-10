// Complementos desacoplados do módulo editorial.
// 1) Mantém o autosave de projetos relacionados.
// 2) Corrige a base do srcdoc do preview para funcionar tanto em GitHub Pages
//    (ex.: /Azo/) quanto em domínio próprio, sem hardcode de host ou diretório.

const MODULE_URL = new URL(import.meta.url);
const SITE_ROOT = new URL('../', MODULE_URL);

function repairPreviewBase() {
  const frame = document.querySelector('#blog-preview-frame');
  if (!(frame instanceof HTMLIFrameElement) || !frame.srcdoc) return;

  const expectedBase = `<base href="${SITE_ROOT.href}">`;
  const repaired = frame.srcdoc.replace(/<base\s+href="[^"]*"\s*\/?>/i, expectedBase);
  if (repaired === frame.srcdoc) return;

  frame.srcdoc = repaired;
}

document.addEventListener('click', event => {
  const button = event.target instanceof Element ? event.target.closest('#blog-preview') : null;
  if (!button) return;

  // O handler principal monta o srcdoc no mesmo clique. Executamos logo depois
  // e reabrimos o mesmo HTML com a raiz correta para CSS, logo, imagens e motion.
  setTimeout(repairPreviewBase, 0);
}, true);

document.addEventListener('change', event => {
  if (!(event.target instanceof HTMLInputElement)) return;
  if (!event.target.matches('[data-related-project]')) return;
  const topic = document.querySelector('#blog-topic');
  if (topic) topic.dispatchEvent(new Event('input', { bubbles:true }));
});
