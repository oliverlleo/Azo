// Complemento desacoplado: campos de projetos relacionados são renderizados depois do load.
// Reaproveita o autosave já existente no editor sem acessar estado interno do módulo.
document.addEventListener('change', event => {
  if (!(event.target instanceof HTMLInputElement)) return;
  if (!event.target.matches('[data-related-project]')) return;
  const topic = document.querySelector('#blog-topic');
  if (topic) topic.dispatchEvent(new Event('input', { bubbles:true }));
});
