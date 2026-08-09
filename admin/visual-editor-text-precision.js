import { auth, db } from '../assets/js/firebase-config.js';
import { doc, getDoc, setDoc, serverTimestamp } from 'https://www.gstatic.com/firebasejs/12.16.0/firebase-firestore.js';

const $=(s,r=document)=>r.querySelector(s), $$=(s,r=document)=>[...r.querySelectorAll(s)];
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot',"'":'&#39;'}[c]));
let selected=null;

function toast(message,type='success'){
 const stack=$('#toast-stack');
 if(!stack)return alert(message);
 const el=document.createElement('div');
 el.className=`toast ${type}`;
 el.innerHTML=`<b>${type==='error'?'!':'✓'}</b><span>${esc(message)}</span>`;
 stack.appendChild(el);
 setTimeout(()=>el.remove(),3500);
}
function frame(){return $('#ve3-frame');}
function frameDoc(){return frame()?.contentDocument||null;}
function pageId(){return $('#ve3-page')?.value||'index';}
function pageLabel(){return $('#ve3-page')?.selectedOptions?.[0]?.textContent||'Página do site';}
function point(e){const r=$('#ve3-glass')?.getBoundingClientRect();return r?{x:e.clientX-r.left,y:e.clientY-r.top}:null;}

function pathOf(el,root){
 const parts=[];
 for(let n=el;n&&n.nodeType===1;n=n.parentElement){
  let p=n.tagName.toLowerCase(),par=n.parentElement;
  if(par){const same=[...par.children].filter(c=>c.tagName===n.tagName);if(same.length>1)p+=`:nth-of-type(${same.indexOf(n)+1})`;}
  parts.unshift(p);if(n===root)break;
 }
 return parts.join('>');
}
function textKey(node,docu){
 const p=node?.parentElement;if(!p)return'';
 const i=[...p.childNodes].filter(n=>n.nodeType===3).indexOf(node);
 return `text:${pathOf(p,docu.body)}::${i}`;
}
function hrefKey(a,docu){return `attr:${pathOf(a,docu.body)}::href`;}
function projectManaged(el){return Boolean(el?.closest('.project-info__name,.project-info__meta,.portfolio-card[data-gallery] h3,.portfolio-card[data-gallery] .portfolio-card__text div span,[data-cms-project] h3,[data-cms-project] .portfolio-card__text div span'));}
function textNodeAt(docu,x,y){
 try{
  if(typeof docu.caretPositionFromPoint==='function'){
   const pos=docu.caretPositionFromPoint(x,y),n=pos?.offsetNode;
   if(n?.nodeType===3&&n.nodeValue?.trim())return n;
  }
  if(typeof docu.caretRangeFromPoint==='function'){
   const range=docu.caretRangeFromPoint(x,y),n=range?.startContainer;
   if(n?.nodeType===3&&n.nodeValue?.trim())return n;
  }
 }catch(_){ }
 return null;
}
function blockRoot(node){
 const p=node?.parentElement;if(!p)return null;
 return p.closest('a,button,[role="button"],h1,h2,h3,h4,p,blockquote,figcaption,label,.hero__kicker,.hero__copy,.section-title,.section-copy')||p;
}
function textsInBlock(node){
 const root=blockRoot(node);if(!root)return[node];
 const docu=root.ownerDocument,NF=docu.defaultView.NodeFilter;
 const w=docu.createTreeWalker(root,NF.SHOW_TEXT,{acceptNode(n){
  if(!n.nodeValue?.trim()||n.parentElement?.closest('svg,script,style,noscript,.loader,.page-transition'))return NF.FILTER_REJECT;
  return NF.FILTER_ACCEPT;
 }});
 const out=[];let n;while((n=w.nextNode()))out.push(n);
 return out.length?out.slice(0,30):[node];
}
function section(el){
 if(el?.closest('.site-header,.mobile-nav'))return'Menu principal';
 if(el?.closest('.hero,.inner-hero'))return'Topo da página';
 if(el?.closest('.services'))return'Seção Serviços';
 if(el?.closest('.projects,.projects-grid'))return'Seção Projetos';
 if(el?.closest('.method'))return'Seção Como trabalhamos';
 if(el?.closest('.about-teaser'))return'Seção Sobre a AZO';
 if(el?.closest('.cta'))return'Chamada para contato';
 if(el?.closest('.footer'))return'Rodapé';
 if(el?.closest('form'))return'Formulário';
 return pageLabel();
}
function kind(el){
 const action=el?.closest('a,button,[role="button"]');
 if(action)return action.tagName==='A'?'Botão / link':'Botão';
 const t=el?.tagName?.toLowerCase();
 if(t==='h1')return'Título principal';if(t==='h2')return'Título da seção';if(t==='h3')return'Título';
 if(el?.classList?.contains('eyebrow'))return'Texto pequeno acima do título';
 return'Texto';
}
async function pageItems(){
 const s=await getDoc(doc(db,'sitePages',pageId())).catch(()=>null);
 return s?.exists()&&Array.isArray(s.data().items)?s.data().items:[];
}
async function saveItems(items){
 const user=auth.currentUser;if(!user)throw new Error('Sua sessão expirou. Entre novamente.');
 await setDoc(doc(db,'sitePages',pageId()),{page:pageId(),items,updatedAt:serverTimestamp(),updatedBy:user.uid},{merge:true});
}
function highlight(el){
 const d=frameDoc();if(!d||!el)return;
 d.querySelectorAll('.ve3-selected').forEach(x=>x.classList.remove('ve3-selected'));
 el.classList.add('ve3-selected');
}
async function openText(node){
 const d=frameDoc(),side=$('#ve3-side');
 if(!d||!side||!node?.parentElement||projectManaged(node.parentElement))return;
 const element=node.parentElement,action=element.closest('a,button,[role="button"]');
 const key=textKey(node,d),hKey=action?.tagName==='A'?hrefKey(action,d):null;
 const items=await pageItems(),nodes=textsInBlock(node);
 selected={node,element,action,key,hrefKey:hKey,href:action?.tagName==='A'?(action.getAttribute('href')||''):'',value:node.nodeValue.trim(),nodes};
 highlight(element);
 const has=items.some(i=>i.key===key)||(hKey&&items.some(i=>i.key===hKey));
 side.innerHTML=`<p class="eyebrow">${action?'Editar botão ou link':'Editar texto'}</p><h3>${esc(section(element))} — ${esc(kind(element))}</h3><span class="ve3-loc">${esc(pageLabel())}</span><div class="ve3-field"><label>Texto que aparece no site</label><textarea id="ve3-text-priority">${esc(selected.value)}</textarea></div>${hKey?`<div class="ve3-field"><label>Para onde este botão/link leva</label><input id="ve3-href-priority" value="${esc(selected.href)}"></div>`:''}<div class="ve3-actions"><button class="btn btn-primary" id="ve3-save-text-priority">Salvar alteração</button>${has?'<button class="btn btn-ghost" id="ve3-restore-text-priority">Voltar ao original</button>':''}</div>${nodes.length>1?`<div class="ve3-note"><b>Há ${nodes.length} textos neste mesmo bloco.</b> Você pode escolher outro abaixo.</div><div class="ve3-list">${nodes.map((n,i)=>`<button class="ve3-pick" type="button" data-text-priority="${i}"><span class="num">${i+1}</span><span><strong>${n===node?'Texto selecionado':'Outro texto'}</strong><small>${esc(n.nodeValue.trim().slice(0,100))}</small></span><b>→</b></button>`).join('')}</div>`:''}`;
 $('#ve3-save-text-priority').addEventListener('click',saveText);
 $('#ve3-restore-text-priority')?.addEventListener('click',restoreText);
 $$('[data-text-priority]',side).forEach(b=>b.addEventListener('click',()=>openText(nodes[Number(b.dataset.textPriority)])));
}
async function saveText(){
 if(!selected)return;
 const b=$('#ve3-save-text-priority'),value=$('#ve3-text-priority')?.value??'',href=selected.hrefKey?($('#ve3-href-priority')?.value.trim()||'#'):null;
 b.disabled=true;b.textContent='Salvando...';
 try{
  const cur=await pageItems(),keys=new Set([selected.key,selected.hrefKey].filter(Boolean)),next=cur.filter(i=>!keys.has(i.key));
  next.push({key:selected.key,type:'text',value});
  if(selected.hrefKey)next.push({key:selected.hrefKey,type:'attribute',attribute:'href',value:href});
  await saveItems(next);
  const raw=selected.node.nodeValue||'',lead=raw.match(/^\s*/)?.[0]||'',trail=raw.match(/\s*$/)?.[0]||'';
  selected.node.nodeValue=`${lead}${value}${trail}`;
  if(selected.action?.tagName==='A'&&href)selected.action.setAttribute('href',href);
  toast('Texto alterado no site.');
  await openText(selected.node);
 }catch(e){toast(e.message||'Não foi possível salvar o texto.','error');}
 finally{b.disabled=false;b.textContent='Salvar alteração';}
}
async function restoreText(){
 if(!selected)return;
 try{
  const cur=await pageItems(),keys=new Set([selected.key,selected.hrefKey].filter(Boolean));
  await saveItems(cur.filter(i=>!keys.has(i.key)));
  toast('Conteúdo original restaurado.');
  $('#ve3-reload')?.click();
 }catch(e){toast(e.message||'Não foi possível restaurar.','error');}
}
function badge(text,e){
 const b=$('#ve3-badge'),p=point(e);if(!b||!p)return;
 b.textContent=text;b.style.left=`${Math.max(8,Math.min(520,p.x+12))}px`;b.style.top=`${Math.max(48,p.y-34)}px`;b.style.display='block';
}
function onMove(e){
 if(!e.target.closest?.('#ve3-glass'))return;
 const d=frameDoc(),p=point(e);if(!d||!p)return;
 const node=textNodeAt(d,p.x,p.y);
 if(node?.parentElement&&!projectManaged(node.parentElement)){
  e.stopPropagation();e.stopImmediatePropagation();
  const count=textsInBlock(node).length;
  badge(count>1?`✎ Editar texto · ${count} textos neste bloco`:'✎ Editar texto',e);
 }
}
function onClick(e){
 if(!e.target.closest?.('#ve3-glass'))return;
 const d=frameDoc(),p=point(e);if(!d||!p)return;
 const node=textNodeAt(d,p.x,p.y);
 if(node?.parentElement&&!projectManaged(node.parentElement)){
  e.preventDefault();e.stopPropagation();e.stopImmediatePropagation();
  openText(node);
 }
}
// Capture on document runs before the glass' own image/group handler.
// If the pointer is truly on text, text wins. Otherwise the normal V3 image/project handler continues.
document.addEventListener('mousemove',onMove,true);
document.addEventListener('click',onClick,true);
