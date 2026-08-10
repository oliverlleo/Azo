// Mantém o módulo Conteúdos compatível com GitHub Pages em subdiretório e domínio próprio.
// Não altera o editor: apenas normaliza URLs absolutas antigas criadas pelo módulo editorial.
const SITE_ROOT=new URL('../',import.meta.url);
const CONTENT_ROOT=new URL('conteudos/',SITE_ROOT);
const IS_GITHUB_PAGES=/\.github\.io$/i.test(location.hostname);

function normalizeContentUrl(value){
  if(!value||!IS_GITHUB_PAGES)return value;
  try{
    const url=new URL(value,location.href);
    if(url.origin!==location.origin)return value;
    if(url.pathname==='/conteudos/'||url.pathname.startsWith('/conteudos/')){
      const rest=url.pathname.replace(/^\/conteudos\/?/,'');
      if(!rest)return CONTENT_ROOT.href+url.search+url.hash;
      const slug=rest.replace(/\/$/,'');
      return `${CONTENT_ROOT.href}?artigo=${encodeURIComponent(decodeURIComponent(slug))}`;
    }
    return value;
  }catch(_){return value;}
}

const nativeOpen=window.open.bind(window);
window.open=(url,...args)=>nativeOpen(normalizeContentUrl(url),...args);

function fixAnchors(root=document){
  root.querySelectorAll?.('a[href]').forEach(anchor=>{
    const current=anchor.getAttribute('href');
    const next=normalizeContentUrl(current);
    if(next&&next!==current)anchor.setAttribute('href',next);
  });
}

let rewritingPreview=false;
function fixPreviewBase(){
  if(rewritingPreview)return;
  const frame=document.querySelector('#blog-preview-frame');
  if(!frame)return;
  const source=frame.getAttribute('srcdoc')||'';
  const oldBase=`<base href="${location.origin}/">`;
  if(source.includes(oldBase)){
    rewritingPreview=true;
    frame.setAttribute('srcdoc',source.replace(oldBase,`<base href="${SITE_ROOT.href}">`));
    queueMicrotask(()=>{rewritingPreview=false;});
  }
}

const observer=new MutationObserver(()=>{fixAnchors();fixPreviewBase();});
observer.observe(document.documentElement,{subtree:true,childList:true,attributes:true,attributeFilter:['href','srcdoc']});
fixAnchors();
fixPreviewBase();
