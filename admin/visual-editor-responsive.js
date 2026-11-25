// Scale only the admin's preview; the iframe retains its real device viewport.
export function previewGeometry(available,device){
 const width=device==='mobile'?390:device==='tablet'?820:Math.max(1100,Math.floor(available));
 const height=820,scale=Math.min(1,available/width);
 return {width,height,scale,displayWidth:width*scale,displayHeight:height*scale};
}
export function previewPoint(event,frame=document.querySelector('#ve3-frame')){
 const rect=frame?.getBoundingClientRect();
 if(!rect?.width||!rect.height)return null;
 return {x:(event.clientX-rect.left)*frame.clientWidth/rect.width,y:(event.clientY-rect.top)*frame.clientHeight/rect.height};
}
export function mountResponsivePreview(canvas,fit,stage){
 if(!canvas||!fit||!stage)return;
 function resize(){
  const css=getComputedStyle(canvas);
  const available=canvas.clientWidth-parseFloat(css.paddingLeft)-parseFloat(css.paddingRight);
  if(!(available>0))return; // hidden panel: ResizeObserver reruns when displayed
  const g=previewGeometry(available,stage.dataset.device);
  stage.style.width=g.width+'px';
  stage.style.height=g.height+'px';
  stage.style.transform='scale('+g.scale+')';
  fit.style.width=g.displayWidth+'px';
  fit.style.height=g.displayHeight+'px';
 }
 const observer=new ResizeObserver(resize);
 observer.observe(canvas);
 new MutationObserver(resize).observe(stage,{attributes:true,attributeFilter:['data-device']});
 resize();
}
