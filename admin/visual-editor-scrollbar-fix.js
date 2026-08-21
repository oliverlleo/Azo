const MIN_SCROLLBAR_GUTTER=18;

function reservePreviewScrollbar(){
  const frame=document.querySelector('#ve3-frame');
  const glass=document.querySelector('#ve3-glass');
  if(!frame||!glass)return;

  let scrollbarWidth=0;
  try{
    const win=frame.contentWindow;
    const doc=frame.contentDocument;
    if(win&&doc?.documentElement){
      scrollbarWidth=Math.max(0,win.innerWidth-doc.documentElement.clientWidth);
    }
  }catch(_){ }

  const gutter=Math.max(MIN_SCROLLBAR_GUTTER,scrollbarWidth+2);
  glass.style.setProperty('right',`${gutter}px`,'important');
}

const observer=new MutationObserver(()=>reservePreviewScrollbar());
observer.observe(document.documentElement,{childList:true,subtree:true});

document.addEventListener('load',event=>{
  if(event.target?.id==='ve3-frame')requestAnimationFrame(reservePreviewScrollbar);
},true);

window.addEventListener('resize',reservePreviewScrollbar,{passive:true});
requestAnimationFrame(reservePreviewScrollbar);
