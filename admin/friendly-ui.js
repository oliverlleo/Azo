// Friendly-language layer for the AZO owner panel.
// This file intentionally changes only labels/help text in the admin UI.

const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];

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
    const mobile = Boolean(project[3]);
    return [
      `Casa ${code} — foto ${number}`,
      mobile ? 'Galeria do projeto — versão para celular' : 'Galeria do projeto — versão para computador'
    ];
  }
  const file = path.split('/').pop() || 'imagem';
  return ['Imagem do site', file];
}

function areaFromContext(raw = '') {
  const value = raw.toLowerCase();
  if (value.includes('site-header') || value.includes('.nav') || value.includes('mobile-nav')) return 'Menu principal';
  if (value.includes('footer')) return 'Rodapé';
  if (value.includes('hero')) return 'Topo da página';
  if (value.includes('service')) return 'Seção Serviços';
  if (value.includes('project')) return 'Seção Projetos';
  if (value.includes('method')) return 'Seção Como trabalhamos';
  if (value.includes('about')) return 'Seção Sobre a AZO';
  if (value.includes('contact') || value.includes('form-') || value.includes('lead-form')) return 'Formulário de contato';
  if (value.includes('cta')) return 'Chamada para contato';
  if (value.includes('ticker')) return 'Faixa de destaques';
  if (value.includes('inner-hero')) return 'Topo da página';
  if (value.includes('portfolio')) return 'Lista de projetos';
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
  if (lower.includes('eyebrow')) return `${areaFromContext(raw) || 'Seção'} — texto pequeno acima do título`;
  if (lower.includes('nav-cta')) return 'Menu principal — botão “Solicitar orçamento”';
  if (lower.includes('brand')) return 'Nome/identificação da marca';
  if (lower.includes('project-info__name')) return 'Seção Projetos — nome do projeto em destaque';
  if (lower.includes('project-info__meta')) return 'Seção Projetos — tipo do projeto em destaque';
  if (lower.includes('project-counter')) return 'Seção Projetos — contador de projetos';
  if (lower.includes('service-tab')) return 'Seção Serviços — nome de um serviço';
  if (lower.includes('footer-bottom')) return 'Rodapé — informação final';

  const area = areaFromContext(raw);
  const type = typeFromContext(raw);
  if (area) return `${area} — ${type}`;

  const text = String(original || '').trim();
  if (/solicitar orçamento|solicitar uma conversa/i.test(text)) return 'Botão de contato';
  if (/serviços|projetos|sobre|contato|como trabalhamos/i.test(text) && text.length < 35) return 'Item do menu ou título curto';
  return `${pageName()} — ${type}`;
}

function makeContentFriendly() {
  $$('#content-fields .content-card').forEach(card => {
    const label = $('.content-card-head span', card);
    if (!label || label.dataset.friendly === '1') return;
    const raw = label.textContent.trim();
    const original = $('.original-text', card)?.textContent.replace(/^Original:\s*/i, '').trim() || '';
    label.dataset.technicalLabel = raw;
    label.textContent = friendlyTextLabel(raw, original);
    label.title = `Local técnico: ${raw}`;
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
    if (strong) {
      strong.textContent = title;
      strong.title = title;
    }
    if (small) {
      small.textContent = description;
      small.title = `Arquivo interno: ${path}`;
    }
    const replace = $('[data-replace-asset]', card);
    const restore = $('[data-restore-asset]', card);
    if (replace) replace.textContent = 'Trocar imagem';
    if (restore) restore.textContent = 'Voltar para original';
  });
}

function simplifyStaticInterface() {
  const search = $('#image-search');
  if (search) search.placeholder = 'Buscar imagem, serviço ou projeto...';

  const noticeImages = $('#view-images .notice');
  if (noticeImages) noticeImages.innerHTML = '<b>Todas as imagens do site.</b> Escolha visualmente a foto que deseja alterar e clique em “Trocar imagem”. As versões para computador e celular aparecem identificadas separadamente.';

  const noticeContent = $('#view-content .notice');
  if (noticeContent) noticeContent.innerHTML = '<b>Escolha a página e altere os textos.</b> Cada campo informa em linguagem simples onde aquele texto aparece no site. Depois clique em “Salvar alterações”.';

  const dashboardCopy = $('#view-dashboard .hero-panel p:last-child');
  if (dashboardCopy) dashboardCopy.textContent = 'Altere textos, títulos, imagens e projetos sem mexer em código. O que for salvo aqui passa a ser usado pelo site.';

  const replacementsLabel = $('#stat-replacements')?.parentElement?.querySelector('span');
  if (replacementsLabel) replacementsLabel.textContent = 'Imagens alteradas';
  const replacementsHelp = $('#stat-replacements')?.parentElement?.querySelector('small');
  if (replacementsHelp) replacementsHelp.textContent = 'trocadas pelo painel';

  const sync = $('#sync-status');
  if (sync && /firebase/i.test(sync.textContent)) sync.lastChild.textContent = ' Alterações online';

  const securityTitle = $('#view-security .security-grid article:nth-child(2) .panel-head h3');
  if (securityTitle) securityTitle.textContent = 'Como o painel protege o acesso';

  const securityItems = $$('#view-security .security-grid article:nth-child(2) .security-summary > div');
  const securityTexts = [
    ['Login protegido', 'A senha é conferida pelo sistema de login e não fica gravada dentro do site.'],
    ['Conta autorizada', 'Somente contas aprovadas pelo administrador conseguem entrar no painel.'],
    ['Alterações protegidas', 'Pessoas sem autorização não conseguem trocar textos, imagens nem projetos.']
  ];
  securityItems.forEach((item, index) => {
    const pair = securityTexts[index];
    if (!pair) return;
    const strong = $('strong', item);
    const small = $('small', item);
    if (strong) strong.textContent = pair[0];
    if (small) small.textContent = pair[1];
  });

  const uidTerm = $$('#view-security dt').find(dt => dt.textContent.trim() === 'UID');
  if (uidTerm) uidTerm.textContent = 'Identificador da conta';
}

function runFriendlyPass() {
  simplifyStaticInterface();
  makeContentFriendly();
  makeImagesFriendly();
}

const observer = new MutationObserver(() => runFriendlyPass());
observer.observe(document.documentElement, { childList: true, subtree: true });
document.addEventListener('DOMContentLoaded', runFriendlyPass);
runFriendlyPass();
