import {COVER_RATIOS} from './project-cover.mjs';

const sources=new Map();
export const builtinPortfolioCards=[...document.querySelectorAll('.project-portfolio .portfolio-card[data-gallery]')];
let portfolio;

export function setPortfolioProjects(source,projects){
  const root=document.querySelector('.project-portfolio');
  if(!root)return;
  for(const {card,position} of projects||[]){
    if(!position)continue;
    const img=card.querySelector('img');
    img.dataset.portfolioCrop='';
    img.style.objectPosition=position.map(value=>`${value}%`).join(' ');
  }
  sources.set(source,projects);
  portfolio??=connectPortfolio(root);
  portfolio.render();
}

function connectPortfolio(root){
  const filters=[...root.querySelectorAll('[data-portfolio-section]')];
  const grid=root.querySelector('.projects-grid');
  const more=root.querySelector('.portfolio-more');
  const track=root.querySelector('.portfolio-track');
  const controls=root.querySelector('.portfolio-controls');
  const prev=controls.querySelector('[data-portfolio-prev]');
  const next=controls.querySelector('[data-portfolio-next]');
  const results=root.querySelector('#portfolio-results');
  const empty=root.querySelector('[data-portfolio-empty]');
  const error=root.querySelector('[data-portfolio-error]');
  const reducedMotion=matchMedia('(prefers-reduced-motion: reduce)');
  let section='exteriores';

  for(const [format,ratio] of Object.entries(COVER_RATIOS))root.style.setProperty(`--portfolio-${format}`,ratio);

  function updateControls(){
    if(more.hidden)return;
    const end=track.scrollWidth-track.clientWidth;
    controls.hidden=end<=2;
    prev.setAttribute('aria-disabled',String(track.scrollLeft<=2));
    next.setAttribute('aria-disabled',String(track.scrollLeft>=end-2));
  }

  function render(){
    const projects=[...sources.values()].flatMap(list=>list||[])
      .filter(project=>project.section===section)
      .sort((a,b)=>a.order-b.order||a.card.querySelector('h3').textContent.localeCompare(b.card.querySelector('h3').textContent,'pt-BR')||a.id.localeCompare(b.id));
    const previousScroll=track.scrollLeft;
    const featured=projects.slice(0,3).map(({card},index)=>{
      card.classList.toggle('portfolio-card--wide',index===2);
      card.querySelector('img').loading='eager';
      return card;
    });
    const others=projects.slice(3).map(({card})=>{
      card.classList.remove('portfolio-card--wide');
      return card;
    });
    const focused=document.activeElement;
    grid.replaceChildren(...featured);
    track.replaceChildren(...others);
    if(focused?.matches('.portfolio-card')&&root.contains(focused))focused.focus({preventScroll:true});
    grid.hidden=!featured.length;
    more.hidden=!others.length;
    const complete=sources.size===2;
    const failed=[...sources.values()].some(list=>list===null);
    results.setAttribute('aria-busy',String(!complete));
    empty.hidden=!complete||failed||projects.length>0;
    error.hidden=!complete||!failed||projects.length>0;
    track.scrollLeft=previousScroll;
    updateControls();
  }

  function move(direction){
    const first=track.firstElementChild;
    if(!first)return;
    const step=first.getBoundingClientRect().width+parseFloat(getComputedStyle(track).columnGap);
    track.scrollBy({left:direction*step,behavior:reducedMotion.matches?'instant':'smooth'});
  }

  for(const button of filters)button.addEventListener('click',()=>{
    if(section===button.dataset.portfolioSection)return;
    section=button.dataset.portfolioSection;
    filters.forEach(filter=>filter.setAttribute('aria-pressed',String(filter===button)));
    track.scrollLeft=0;
    render();
  });
  prev.addEventListener('click',()=>{if(prev.getAttribute('aria-disabled')==='false')move(-1)});
  next.addEventListener('click',()=>{if(next.getAttribute('aria-disabled')==='false')move(1)});
  track.addEventListener('scroll',updateControls,{passive:true});
  new ResizeObserver(updateControls).observe(track);
  return {render};
}
