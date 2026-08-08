// Friendly-language layer for the AZO owner panel.
// Only presentation labels are changed here; the saved site content is untouched.

const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
const setText = (el, value) => { if (el && el.textContent !== value) el.textContent = value; };
const setHtml = (el, value) => { if (el && el.innerHTML !== value) el.innerHTML = value; };

const PAGE_NAMES = {
  index: 'Página inicial',
  servicos: 'Página Serviços',
  projetos: 'Página Projetos',
  sobre: 'Página Sobre a AZO',
  contato: 'Página Contato',
  'projeto-arquitetonico': 'Página Projeto arquitetônico',
  interiores: 'Página Interiores',
  'gestao-de-obras': 'Página Gestão de obras'
};

const IMAGE_LABELS = {
  'assets/images/logo-azo.png': ['Logo da AZO', 'Aparece no cabeçalho e no rodapé do site'],
  'assets/images/hero.webp': ['Imagem de fundo do topo da página inicial', 'Versão para computador'],
  'assets/images/hero-sm.webp': ['Imagem de fundo do topo da página inicial', 'Versão para celular'],
  'assets/images/about.webp': ['Imagem da seção “Sobre a AZO”', 'Versão para computador'],
  'assets/images/about-sm.webp': ['Imagem da seção “Sobre a AZO”', 'Versão para celular'],
  'assets/images/project-feature.webp': ['Imagem de destaque da página Projetos', 'Versão para computador'],
  'assets/images/project-feature-sm.webp': ['Imagem de destaque da página Projetos', 'Versão para celular'],
  'assets/images/service-architecture.webp': ['Imagem do serviço “Projeto arquitetônico”', 'Versão para computador'],
  'assets/images/service-architecture-sm.webp': ['Imagem do serviço “Projeto arquitetônico”', 'Versão para celular'],
  'assets/images/service-interiors.webp': ['Imagem do serviço “Interiores”', 'Versão para computador'],
  'assets/images/service-interiors-sm.webp': ['Imagem do serviço “Interiores”', 'Versão para celular'],
  'assets/images/service-build.webp': ['Imagem do serviço “Gestão de obras”', 'Versão para computador'],
  'assets/images/service-build-sm.webp': ['Imagem do serviço “Gestão de obras”', 'Versão para celular'],
  'assets/images/team.webp': ['Foto da equipe / seção sobre a empresa', 'Versão para computador'],
  'assets/images/team-sm.webp': ['Foto da equipe / seção sobre a empresa', 'Versão para celular']
};

function pageName() {
  const id = $('#page-select')?.value || 'index';
  return PAGE_NAMES[id] || 'Página do site';
}

function imageInfo(path = '') {
  if (IMAGE_LABELS[path]) return IMAGE_LABELS[path];
  const project = path.match(/assets\/images\/projects\/([a-z]+)-(\d+)(-sm)?\.webp$/i);
  if (project) {
    const code = project[1].toUpperCase();
    const number = Number(project[2]);
    return [
      `Casa ${code} — foto ${number}`,
      project[3] ? 'Galeria do projeto — versão para celular' : 'Galeria do projeto — versão para computador'
    ];
  }
  return ['Imagem do site', 'Imagem usada em uma área do site'];
}

function areaFromContext(raw = '') {
  const value = raw.toLowerCase();
  if (value.includes('site-header') || value.includes('.nav') || value.includes('mobile-nav')) return 'Menu principal';
  if (value.includes('footer')) return 'Rodapé';
  if (value.includes('inner-hero') || value.includes('hero')) return 'Topo da página';
  if (value.includes('service')) return 'Seção Serviços';
  if (value.includes('project') || value.includes('portfolio')) return 'Seção Projetos';
  if (value.includes('method')) return 'Seção Como trabalhamos';
  if (value.includes('about')) return 'Seção Sobre a AZO';
  if (value.includes('contact') || value.includes('form-') || value.includes('lead-form')) return 'Formulário de contato';
  if (value.includes('cta')) return 'Chamada para contato';
  if (value.includes('ticker')) return 'Faixa de destaques';
  return '';
}

function typeFromContext(raw = '') {
  const value = raw.toLowerCase();
  if (value.startsWith('h1')) return 'Título principal';
  if (value.startsWith('h2')) return 'Título da seção';
  if (value.startsWith('h3')) return 'Título';
  if (value.startsWith('h4')) return 'Título pequeno';
  if (value.startsWith('p')) return 'Texto';
  if (value.startsWith('a')) return value.includes('button') || value.includes('cta') ? 'Texto do botão' : 'Texto do link';
  if (value.startsWith('button')) return 'Texto do botão';
  if (value.startsWith('label')) return 'Nome do campo';
  if (value.startsWith('strong')) return 'Texto em destaque';
  if (value.startsWith('small')) return 'Texto auxiliar';
  if (value.startsWith('span')) return 'Texto curto';
  if (value.startsWith('div')) return 'Texto da seção';
  return 'Texto';
}

function friendlyTextLabel(raw = '', original = '') {
  const fixed = {
    'Título da página': 'Título que aparece na aba do navegador',
    'Descrição SEO': 'Descrição que pode aparecer no Google',
    'Título para compartilhamento': 'Título ao compartilhar o site',
    'Descrição para compartilhamento': 'Descrição ao compartilhar o site'
  };
  if (fixed[raw]) return fixed[raw];

  const lower = raw.toLowerCase();
  const area = areaFromContext(raw);
  if (lower.includes('eyebrow')) return `${area || 'Seção'} — texto pequeno acima do título`;
  if (lower.includes('nav-cta')) return 'Menu principal — botão “Solicitar orçamento”';
  if (lower.includes('project-info__name')) return 'Seção Projetos — nome do projeto em destaque';
  if (lower.includes('project-info__meta')) return 'Seção Projetos — tipo do projeto em destaque';
  if (lower.includes('project-counter')) return 'Seção Projetos — contador de projetos';
  if (lower.includes('service-tab')) return 'Seção Serviços — nome do serviço';
  if (lower.includes('footer-bottom')) return 'Rodapé — informação final';
  if (area) return `${area} — ${typeFromContext(raw)}`;

  const text = String(original || '').trim();
  if (/solicitar orçamento|solicitar uma conversa/i.test(text)) return 'Botão de contato';
  if (/serviços|projetos|sobre|contato|como trabalhamos/i.test(text) && text.length < 35) return 'Item do menu ou título curto';
  return `${pageName()} — ${typeFromContext(raw)}`;
}

function makeContentFriendly() {
  $$('#content-fields .content-card').forEach(card => {
    const label = $('.content-card-head span', card);
    if (!label || label.dataset.friendly === '1') return;
    const raw = label.textContent.trim();
    const original = $('.original-text', card)?.textContent.replace(/^Original:\s*/i, '').trim() || '';
    label.dataset.technicalLabel = raw;
    setText(label, friendlyTextLabel(raw, original));
    label.title = `Onde aparece: ${friendlyTextLabel(raw, original)}`;
    label.dataset.friendly = '1';
  });
}

function makeImagesFriendly() {
  $$('#asset-grid .asset-card').forEach(card => {
    const path = card.dataset.asset || $('.asset-info small', card)?.title || '';
    if (!path) return;
    const [title, description] = imageInfo(path);
    const strong = $('.asset-info strong', card);
    const small = $('.asset-info small', card);
    setText(strong, title);
    if (strong) strong.title = title;
    setText(small, description);
    if (small) small.title = `Arquivo interno: ${path}`;
    setText($('[data-replace-asset]', card), 'Trocar imagem');
    setText($('[data-restore-asset]', card), 'Voltar para original');
  });
}

function simplifyStaticInterface() {
  const search = $('#image-search');
  if (search && search.placeholder !== 'Buscar imagem, serviço ou projeto...') search.placeholder = 'Buscar imagem, serviço ou projeto...';

  setHtml($('#view-images .notice'), '<b>Todas as imagens do site.</b> Escolha visualmente a foto que deseja alterar e clique em “Trocar imagem”. As versões para computador e celular aparecem identificadas separadamente.');
  setHtml($('#view-content .notice'), '<b>Escolha a página e altere os textos.</b> Cada campo informa em linguagem simples onde aquele texto aparece no site. Depois clique em “Salvar alterações”.');
  setText($('#view-dashboard .hero-panel p:last-child'), 'Altere textos, títulos, imagens e projetos sem mexer em código. O que for salvo aqui passa a ser usado pelo site.');
  setText($('.login-copy > p:last-child'), 'Entre com seu e-mail e senha para alterar textos, imagens e projetos do site.');

  setText($('#stat-replacements')?.parentElement?.querySelector('span'), 'Imagens alteradas');
  setText($('#stat-replacements')?.parentElement?.querySelector('small'), 'trocadas pelo painel');

  const kicker = $('#view-kicker');
  if (kicker?.textContent === 'Firebase Storage') setText(kicker, 'Imagens do site');
  if (kicker?.textContent === 'Portfólio') setText(kicker, 'Projetos do site');

  const sync = $('#sync-status');
  if (sync && /firebase conectado/i.test(sync.textContent)) setText(sync.lastChild, ' Alterações online');

  setText($('#view-security .security-grid article:nth-child(2) .panel-head .eyebrow'), 'Proteção do painel');
  setText($('#view-security .security-grid article:nth-child(2) .panel-head h3'), 'Como o painel protege o acesso');

  const securityItems = $$('#view-security .security-grid article:nth-child(2) .security-summary > div');
  const securityTexts = [
    ['Login protegido', 'A senha é conferida pelo sistema de login e não fica gravada dentro do site.'],
    ['Conta autorizada', 'Somente contas aprovadas pelo administrador conseguem entrar no painel.'],
    ['Alterações protegidas', 'Pessoas sem autorização não conseguem trocar textos, imagens nem projetos.']
  ];
  securityItems.forEach((item, index) => {
    const pair = securityTexts[index];
    if (!pair) return;
    setText($('strong', item), pair[0]);
    setText($('small', item), pair[1]);
  });

  const uidTerm = $$('#view-security dt').find(dt => dt.textContent.trim() === 'UID');
  if (uidTerm) setText(uidTerm, 'Identificador da conta');

  const quickSecurity = $('#view-dashboard .dashboard-grid article:nth-child(2) .security-summary');
  if (quickSecurity) {
    const rows = $$('.security-summary > div', quickSecurity);
    const copy = [
      ['Sem acesso pelo site público', 'O painel não aparece em nenhum menu ou botão do site.'],
      ['Entrada somente com senha', 'Não existe criação pública de contas.'],
      ['Somente pessoas autorizadas', 'Só contas liberadas conseguem fazer alterações.']
    ];
    rows.forEach((row, index) => {
      if (!copy[index]) return;
      setText($('strong', row), copy[index][0]);
      setText($('small', row), copy[index][1]);
    });
  }

  $$('#project-form label').forEach(label => {
    const textNode = [...label.childNodes].find(node => node.nodeType === Node.TEXT_NODE && node.nodeValue.trim());
    if (!textNode) return;
    const current = textNode.nodeValue.trim();
    const replacements = {
      'Título': 'Nome do projeto',
      'Categoria': 'Tipo do projeto',
      'Descrição': 'Descrição do projeto',
      'Ordem': 'Posição na lista',
      'Publicado': 'Mostrar no site'
    };
    if (replacements[current]) textNode.nodeValue = `${replacements[current]} `;
  });
}

let scheduled = false;
function runFriendlyPass() {
  scheduled = false;
  simplifyStaticInterface();
  makeContentFriendly();
  makeImagesFriendly();
}
function scheduleFriendlyPass() {
  if (scheduled) return;
  scheduled = true;
  requestAnimationFrame(runFriendlyPass);
}

const observer = new MutationObserver(scheduleFriendlyPass);
observer.observe(document.documentElement, { childList: true, subtree: true });
document.addEventListener('DOMContentLoaded', scheduleFriendlyPass);
scheduleFriendlyPass();
