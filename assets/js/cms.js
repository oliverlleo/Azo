import {readProjectPresentation} from './project-cover-store.js';
import {coverId,chooseCover,portfolioDetails} from './project-cover.mjs';
import {setPortfolioProjects} from './project-portfolio.js';
import {readPortfolioOrders} from './project-order-store.js';
import {renderTeamHotspots,isTeamPhoto,TEAM_SELECTOR} from './team-hotspots.mjs?v=20261125-team';
import { db, collection, doc, getDoc, getDocs } from './firebase-config.js';
import { normalizePageId, applyPageOverrides, normalizeAssetPath } from './cms-core.js';
import { imagePositionKey, applyImagePositionItems, ensurePositionStyle } from './image-position.mjs';

const assetMap = new Map();
const pageId = document.documentElement.dataset.azoPreviewPage || normalizePageId(location.pathname);
let positionItems=null,teamItems=[];
// Mark the original team photo before asset replacement changes its URL.
document.querySelectorAll(TEAM_SELECTOR).forEach(img=>{if(isTeamPhoto(img))img.setAttribute('data-azo-team-photo','')});
ensurePositionStyle(document);
document.querySelectorAll('img').forEach(imagePositionKey);
let gateTimedOut = false;
let readySignaled = false;

const paintGate = document.createElement('style');
paintGate.id = 'azo-cms-paint-gate';
paintGate.textContent = `
  html[data-cms-pending="true"] .site-header,
  html[data-cms-pending="true"] .mobile-nav,
  html[data-cms-pending="true"] main,
  html[data-cms-pending="true"] .footer { visibility:hidden!important; }
`;
document.head.appendChild(paintGate);
document.documentElement.dataset.cmsPending = 'true';

const gateTimer = setTimeout(() => {
  gateTimedOut = true;
  signalReady(false);
}, 3000);

function canonicalAsset(value) {
  const path = normalizeAssetPath(value, location.href);
  const idx = path.indexOf('assets/');
  return idx >= 0 ? path.slice(idx) : path;
}

function isStorageUrl(value = '') {
  return /supabase\.co\/storage\/v1\/object\//i.test(value);
}

function resolveAsset(value) {
  if (!value || isStorageUrl(value)) return value;
  return assetMap.get(canonicalAsset(value))?.url || value;
}

function resolveImage(img) {
  if (!(img instanceof HTMLImageElement)) return;
  const current = img.getAttribute('src') || '';
  if (current && !isStorageUrl(current)) {
    const replacement = resolveAsset(current);
    if (replacement && replacement !== current) {
      img.setAttribute('data-cms-source', canonicalAsset(current));
      img.setAttribute('src', replacement);
    }
  }
  const srcset = img.getAttribute('srcset');
  if (srcset && !isStorageUrl(srcset)) {
    const mapped = srcset.split(',').map(part => {
      const bits = part.trim().split(/\s+/);
      if (!bits[0]) return part;
      const replacement = resolveAsset(bits[0]);
      bits[0] = replacement;
      return bits.join(' ');
    }).join(', ');
    if (mapped !== srcset) img.setAttribute('srcset', mapped);
  }
}

function applyManagedPosition(img){
  if(img.hasAttribute('data-portfolio-crop')){
    applyImagePositionItems(img,[]);
  }else if(positionItems){
    applyImagePositionItems(img,positionItems);
  }
}

function resolveAllImages(root = document) {
  root.querySelectorAll?.('img').forEach(resolveImage);
}

function watchImages() {
  const observer = new MutationObserver(records => {
    for (const record of records) {
      if (record.type === 'attributes' && record.target instanceof HTMLImageElement) resolveImage(record.target);
      for (const node of record.addedNodes || []) {
        if (node instanceof HTMLImageElement) {
          resolveImage(node);
          applyManagedPosition(node);
        } else if (node instanceof Element) {
          resolveAllImages(node);
          node.querySelectorAll('img').forEach(applyManagedPosition);
        }
      }
    }
  });
  observer.observe(document.documentElement, { subtree: true, childList: true, attributes: true, attributeFilter: ['src','srcset'] });
}

async function loadAssets() {
  const snap = await getDocs(collection(db, 'assets'));
  if (gateTimedOut) return;
  snap.forEach(item => {
    const data = item.data();
    if (data?.path && data?.url) assetMap.set(data.path, data);
  });
  resolveAllImages();
}

async function loadPage() {
  const snap = await getDoc(doc(db, 'sitePages', pageId));
  const data=snap.exists()?snap.data():{};
  const items=Array.isArray(data.items)?data.items:[];
  teamItems=items.filter(i=>i.type==='image-hotspot');
  positionItems=items.filter(i=>i.type==='image-position');
  if(!gateTimedOut)applyPageOverrides(document,items);
  document.querySelectorAll('img').forEach(applyManagedPosition);
}

function injectProjectStyles() {
  if (document.getElementById('azo-cms-project-style')) return;
  const style = document.createElement('style');
  style.id = 'azo-cms-project-style';
  style.textContent = `
  .cms-project-lightbox{position:fixed;inset:0;z-index:10050;background:#071b1f;color:#fff;display:none;grid-template-rows:auto 1fr auto;opacity:0;transition:opacity .35s ease}.cms-project-lightbox.open{display:grid;opacity:1}.cms-project-lightbox__top,.cms-project-lightbox__controls{display:flex;align-items:center;justify-content:space-between;gap:20px;padding:20px 28px}.cms-project-lightbox__top{border-bottom:1px solid rgba(255,255,255,.14)}.cms-project-lightbox__title{font-family:Georgia,'Times New Roman',serif;font-size:clamp(1.3rem,3vw,2.4rem)}.cms-project-lightbox__stage{display:grid;place-items:center;min-height:0;padding:20px}.cms-project-lightbox__stage img{width:100%;height:100%;max-height:76vh;object-fit:contain}.cms-project-lightbox button{border:1px solid rgba(255,255,255,.28);background:transparent;color:#fff;border-radius:999px;padding:12px 18px;cursor:pointer}.cms-project-lightbox__close{width:46px;height:46px;padding:0!important;font-size:1.6rem}.cms-project-lightbox__count{font-size:.72rem;letter-spacing:.14em;opacity:.7}@media(max-width:700px){.cms-project-lightbox__top,.cms-project-lightbox__controls{padding:16px}.cms-project-lightbox__stage{padding:10px}}
  `;
  document.head.appendChild(style);
}

let activeProject = null;
let activeProjectIndex = 0;
let previousProjectFocus = null;

function getCmsLightbox() {
  let box = document.querySelector('.cms-project-lightbox');
  if (box) return box;
  injectProjectStyles();
  box = document.createElement('div');
  box.className = 'cms-project-lightbox';
  box.setAttribute('role', 'dialog');
  box.setAttribute('aria-modal', 'true');
  box.setAttribute('aria-labelledby', 'cms-project-title');
  box.innerHTML = `
    <div class="cms-project-lightbox__top"><div><div class="cms-project-lightbox__title" id="cms-project-title"></div><div class="cms-project-lightbox__count"></div></div><button class="cms-project-lightbox__close" aria-label="Fechar">×</button></div>
    <div class="cms-project-lightbox__stage"><img alt=""></div>
    <div class="cms-project-lightbox__controls"><button class="cms-project-prev">← Anterior</button><button class="cms-project-next">Próxima →</button></div>`;
  document.body.appendChild(box);
  box.querySelector('.cms-project-lightbox__close').addEventListener('click', closeProject);
  box.querySelector('.cms-project-prev').addEventListener('click', () => moveProject(-1));
  box.querySelector('.cms-project-next').addEventListener('click', () => moveProject(1));
  box.addEventListener('click', event => { if (event.target === box) closeProject(); });
  return box;
}

function renderProjectImage() {
  if (!activeProject) return;
  const images = Array.isArray(activeProject.images) ? activeProject.images : [];
  const box = getCmsLightbox();
  const current = images[activeProjectIndex];
  const image = box.querySelector('.cms-project-lightbox__stage img');
  if (current?.url) image.src = current.url;
  image.alt = current?.alt || `${activeProject.title || 'Projeto'} — imagem ${activeProjectIndex + 1}`;
  box.querySelector('.cms-project-lightbox__title').textContent = activeProject.title || 'Projeto';
  box.querySelector('.cms-project-lightbox__count').textContent = images.length ? `${String(activeProjectIndex + 1).padStart(2,'0')} / ${String(images.length).padStart(2,'0')}` : '';
}

function openProject(project,trigger) {
  if (!project?.images?.length) return;
  previousProjectFocus=trigger;
  activeProject = project;
  activeProjectIndex = 0;
  const box = getCmsLightbox();
  renderProjectImage();
  box.classList.add('open');
  document.body.classList.add('no-scroll');
  box.querySelector('.cms-project-lightbox__close').focus();
}

function closeProject() {
  document.querySelector('.cms-project-lightbox')?.classList.remove('open');
  document.body.classList.remove('no-scroll');
  activeProject = null;
  previousProjectFocus?.focus({preventScroll:true});
  previousProjectFocus=null;
}

function moveProject(delta) {
  if (!activeProject?.images?.length) return;
  activeProjectIndex = (activeProjectIndex + delta + activeProject.images.length) % activeProject.images.length;
  renderProjectImage();
}

async function loadProjects() {
  if (pageId !== 'projetos') return;
  if (!document.querySelector('.project-portfolio')) return;
  const [snap,settings,orders]=await Promise.all([
    getDocs(collection(db,'projects')),
    readProjectPresentation().catch(()=>new Map()),
    readPortfolioOrders().catch(()=>null)
  ]);
  const projects = snap.docs.map(item => ({ id: item.id, ...item.data() }))
    .filter(project => project.published !== false);
  const cards=[];
  for (const project of projects) {
    if (!project?.title || !project?.images?.length) continue;
    const id=coverId('custom',project.id);
    const setting=settings.get(id);
    const details=portfolioDetails(setting,project.order);
    const cover=chooseCover(setting?.cover,project.images.filter(i=>i?.url).map(i=>({key:i.url,url:i.url})),project.coverUrl||project.images[0]?.url).url;
    if (!cover) continue;
    const card = document.createElement('article');
    card.className = 'portfolio-card';
    card.dataset.cmsProject = project.id;
    card.tabIndex = 0;
    card.setAttribute('role','button');
    card.setAttribute('aria-label', `Abrir galeria ${project.title}`);
    card.innerHTML = `<img loading="lazy" decoding="async" alt=""><div class="portfolio-card__text" data-cms-ignore><div><h3></h3><span></span></div><span class="portfolio-card__arrow" aria-hidden="true">→</span></div>`;
    const image=card.querySelector('img');
    image.src=cover;
    card.querySelector('h3').textContent = project.title;
    card.querySelector('.portfolio-card__text div span').textContent = project.category || 'Projeto';
    card.addEventListener('click', () => openProject(project,card));
    card.addEventListener('keydown', event => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); openProject(project,card); } });
    cards.push({id,card,title:project.title,...details});
  }
  setPortfolioProjects('custom',cards,orders);
}

addEventListener('keydown', event => {
  if (!activeProject) return;
  if (event.key === 'Escape') closeProject();
  if (event.key === 'ArrowLeft') moveProject(-1);
  if (event.key === 'ArrowRight') moveProject(1);
  if (event.key === 'Tab') {
    const buttons=[...getCmsLightbox().querySelectorAll('button')];
    const first=buttons[0],last=buttons.at(-1);
    if(event.shiftKey&&document.activeElement===first){event.preventDefault();last.focus();}
    if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first.focus();}
  }
});

function signalReady(ok) {
  if (readySignaled) return;
  readySignaled = true;
  clearTimeout(gateTimer);
  document.documentElement.dataset.cmsReady = ok ? 'true' : 'failed';
  delete document.documentElement.dataset.cmsPending;
  paintGate.remove();
  window.dispatchEvent(new CustomEvent('azo:cms-ready', { detail: { ok } }));
}

window.AZO_CMS = { assetMap, resolveAsset, canonicalAsset,
  get imagePositionsReady(){return positionItems!==null},
  updateImagePositions(items){
    positionItems=items.filter(i=>i.type==='image-position');
    document.querySelectorAll('img').forEach(applyManagedPosition);
  }
};

(async () => {
  try {
    watchImages();
    // Start project reads independently; the first-paint timeout must never discard published projects.
    await Promise.all([loadAssets(), loadPage(), loadProjects().catch(error=>{
      setPortfolioProjects('custom',null);
      throw error;
    })]);
    renderTeamHotspots(document,teamItems);
    if (gateTimedOut) return;
    signalReady(true);
  } catch (error) {
    console.warn('[AZO CMS] Conteúdo dinâmico indisponível; site estático mantido.', error);
    signalReady(false);
  }
})();
