const clamp=(value,min,max)=>Math.max(min,Math.min(max,value));
const clone=value=>JSON.parse(JSON.stringify(value));
const esc=(value='')=>String(value??'').replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));

function normalize(value){
  const source=value&&typeof value==='object'?value:{};
  return {
    enabled:source.enabled===true,
    imageUrl:String(source.imageUrl||''),
    storagePath:String(source.storagePath||''),
    alt:String(source.alt||''),
    hotspots:Array.isArray(source.hotspots)?source.hotspots.map((item,index)=>({
      id:String(item?.id||crypto.randomUUID()),
      label:String(item?.label||`Área ${index+1}`),
      x:clamp(Number(item?.x)||0,0,100),
      y:clamp(Number(item?.y)||0,0,100),
      w:clamp(Number(item?.w)||12,2,100),
      h:clamp(Number(item?.h)||12,2,100),
      images:Array.isArray(item?.images)?item.images.filter(image=>image?.url).map(image=>({
        id:String(image.id||crypto.randomUUID()),
        url:String(image.url||''),
        storagePath:String(image.storagePath||''),
        alt:String(image.alt||''),
        caption:String(image.caption||'')
      })):[]
    })):[]
  };
}

function ext(name=''){return (name.split('.').pop()||'bin').toLowerCase();}

export function createFloorPlanEditor({root,value,obraId,supabase,bucket,onChange,onDeletePath}){
  if(!root)return{destroy(){}};
  let state=normalize(value);
  let selected=state.hotspots[0]?.id||'';
  let drawing=false;
  let replacing='';
  let start=null;
  let draft=null;
  let destroyed=false;
  const listeners=[];

  const emit=()=>onChange?.(clone(state));
  const active=()=>state.hotspots.find(item=>item.id===selected)||null;
  const clearListeners=()=>listeners.splice(0).forEach(off=>off());
  const listen=(target,type,handler,options)=>{target?.addEventListener(type,handler,options);listeners.push(()=>target?.removeEventListener(type,handler,options));};
  const pointer=(event,stage)=>{
    const rect=stage.getBoundingClientRect();
    return {x:clamp((event.clientX-rect.left)/rect.width*100,0,100),y:clamp((event.clientY-rect.top)/rect.height*100,0,100)};
  };

  async function upload(file,kind){
    if(!file)return null;
    const path=`obras/${obraId}/floorplan/${kind}/${Date.now()}-${crypto.randomUUID()}.${ext(file.name)}`;
    const {error}=await supabase.storage.from(bucket).upload(path,file,{upsert:false,contentType:file.type,cacheControl:'31536000'});
    if(error)throw error;
    return {url:supabase.storage.from(bucket).getPublicUrl(path).data.publicUrl,path};
  }

  async function setPlanImage(file){
    try{
      const result=await upload(file,'plan');
      if(!result)return;
      if(state.storagePath)onDeletePath?.(state.storagePath);
      state.imageUrl=result.url;
      state.storagePath=result.path;
      state.enabled=true;
      emit();
      render();
    }catch(error){alert(error.message||'Não foi possível enviar a planta.');}
  }

  async function addHotspotImages(files){
    const hotspot=active();
    if(!hotspot||!files.length)return;
    try{
      for(const file of files){
        const result=await upload(file,`hotspots/${hotspot.id}`);
        hotspot.images.push({id:crypto.randomUUID(),url:result.url,storagePath:result.path,alt:hotspot.label,caption:''});
      }
      emit();render();
    }catch(error){alert(error.message||'Não foi possível enviar as imagens da área.');}
  }

  function removePlan(){
    if(state.storagePath)onDeletePath?.(state.storagePath);
    state.hotspots.forEach(item=>item.images.forEach(image=>image.storagePath&&onDeletePath?.(image.storagePath)));
    state={enabled:false,imageUrl:'',storagePath:'',alt:'',hotspots:[]};
    selected='';emit();render();
  }

  function removeHotspot(id){
    const item=state.hotspots.find(h=>h.id===id);
    item?.images?.forEach(image=>image.storagePath&&onDeletePath?.(image.storagePath));
    state.hotspots=state.hotspots.filter(h=>h.id!==id);
    selected=state.hotspots[0]?.id||'';emit();render();
  }

  function removeHotspotImage(id){
    const hotspot=active();if(!hotspot)return;
    const image=hotspot.images.find(item=>item.id===id);
    if(image?.storagePath)onDeletePath?.(image.storagePath);
    hotspot.images=hotspot.images.filter(item=>item.id!==id);emit();render();
  }

  function beginDraw(replaceId=''){
    if(!state.imageUrl)return;
    drawing=true;replacing=replaceId;draft=null;
    root.classList.add('is-drawing');
    root.querySelector('.fp-draw-hint')?.removeAttribute('hidden');
  }

  function cancelDraw(){drawing=false;replacing='';draft=null;root.classList.remove('is-drawing');root.querySelector('.fp-draw-hint')?.setAttribute('hidden','');root.querySelector('.fp-draft')?.remove();}

  function finishDraw(){
    if(!draft||draft.w<2||draft.h<2){cancelDraw();return;}
    if(replacing){
      const hotspot=state.hotspots.find(item=>item.id===replacing);
      if(hotspot)Object.assign(hotspot,draft);
    }else{
      const hotspot={id:crypto.randomUUID(),label:`Área ${state.hotspots.length+1}`,images:[],...draft};
      state.hotspots.push(hotspot);selected=hotspot.id;
    }
    emit();cancelDraw();render();
  }

  function render(){
    if(destroyed)return;
    clearListeners();
    const hotspot=active();
    root.innerHTML=`
      <div class="fp-editor-head">
        <div><strong>Planta interativa</strong><small>Desenhe áreas sobre a planta e associe imagens a cada espaço.</small></div>
        ${state.imageUrl?`<label class="fp-toggle"><input type="checkbox" data-fp-enabled ${state.enabled?'checked':''}><span></span><b>Mostrar no site</b></label>`:''}
      </div>
      ${!state.imageUrl?`
        <label class="fp-upload fp-upload--plan"><input type="file" accept="image/jpeg,image/png,image/webp,image/avif" data-fp-plan><b>＋</b><strong>Carregar planta</strong><small>Use uma imagem limpa e legível da planta baixa.</small></label>`:`
        <div class="fp-workspace">
          <div class="fp-plan-column">
            <div class="fp-toolbar"><button type="button" class="obra-mini-btn" data-fp-add>＋ Criar área</button><label class="obra-mini-btn fp-file-button">Trocar planta<input type="file" accept="image/jpeg,image/png,image/webp,image/avif" data-fp-plan></label><button type="button" class="obra-mini-btn danger" data-fp-remove-plan>Remover planta</button></div>
            <div class="fp-draw-hint" hidden>Arraste sobre a planta para marcar a área.</div>
            <div class="fp-stage" data-fp-stage>
              <img src="${esc(state.imageUrl)}" alt="${esc(state.alt||'Planta da obra')}" draggable="false">
              ${state.hotspots.map((item,index)=>`<button type="button" class="fp-hotspot ${item.id===selected?'is-active':''}" data-fp-hotspot="${item.id}" style="left:${item.x}%;top:${item.y}%;width:${item.w}%;height:${item.h}%"><span>${String(index+1).padStart(2,'0')}</span><strong>${esc(item.label)}</strong></button>`).join('')}
            </div>
            <label class="obra-field fp-alt"><span>Texto alternativo da planta</span><input data-fp-alt value="${esc(state.alt)}" placeholder="Ex.: Planta térrea da residência"></label>
          </div>
          <aside class="fp-inspector">
            ${hotspot?`
              <div class="fp-inspector-head"><div><span>Área selecionada</span><strong>${esc(hotspot.label)}</strong></div><button type="button" class="obra-mini-btn danger" data-fp-delete>Excluir</button></div>
              <label class="obra-field"><span>Nome da área</span><input data-fp-label value="${esc(hotspot.label)}" placeholder="Ex.: Cozinha integrada"></label>
              <div class="fp-inspector-actions"><button type="button" class="obra-mini-btn" data-fp-redraw>Redesenhar área</button><span>${hotspot.images.length} imagem(ns)</span></div>
              <label class="fp-upload fp-upload--images"><input type="file" accept="image/*" multiple data-fp-images><b>＋</b><strong>Adicionar imagens desta área</strong><small>Você pode carregar várias imagens.</small></label>
              <div class="fp-image-list">${hotspot.images.map((image,index)=>`<article class="fp-image-item"><img src="${esc(image.url)}" alt=""><div><input data-fp-image-alt="${image.id}" value="${esc(image.alt)}" placeholder="Texto alternativo"><input data-fp-image-caption="${image.id}" value="${esc(image.caption)}" placeholder="Legenda opcional"><button type="button" class="obra-mini-btn danger" data-fp-image-remove="${image.id}">Remover</button></div><em>${String(index+1).padStart(2,'0')}</em></article>`).join('')}</div>`:
              `<div class="fp-empty-inspector"><b>Selecione ou crie uma área</b><p>Cada retângulo da planta pode abrir uma ou várias imagens no site.</p></div>`}
          </aside>
        </div>`}`;

    const planInput=root.querySelector('[data-fp-plan]');listen(planInput,'change',event=>setPlanImage(event.target.files?.[0]));
    const enabled=root.querySelector('[data-fp-enabled]');listen(enabled,'change',event=>{state.enabled=event.target.checked;emit();});
    const alt=root.querySelector('[data-fp-alt]');listen(alt,'input',event=>{state.alt=event.target.value;emit();});
    const add=root.querySelector('[data-fp-add]');listen(add,'click',()=>beginDraw());
    const removePlanButton=root.querySelector('[data-fp-remove-plan]');listen(removePlanButton,'click',()=>{if(confirm('Remover a planta interativa e todas as áreas?'))removePlan();});
    root.querySelectorAll('[data-fp-hotspot]').forEach(button=>listen(button,'click',event=>{if(drawing)return;event.stopPropagation();selected=button.dataset.fpHotspot;render();}));
    const label=root.querySelector('[data-fp-label]');listen(label,'input',event=>{const item=active();if(item){item.label=event.target.value;emit();const button=root.querySelector(`[data-fp-hotspot="${item.id}"] strong`);if(button)button.textContent=item.label;}});
    const redraw=root.querySelector('[data-fp-redraw]');listen(redraw,'click',()=>beginDraw(selected));
    const del=root.querySelector('[data-fp-delete]');listen(del,'click',()=>{if(confirm('Excluir esta área e as imagens associadas?'))removeHotspot(selected);});
    const images=root.querySelector('[data-fp-images]');listen(images,'change',event=>addHotspotImages([...event.target.files||[]]));
    root.querySelectorAll('[data-fp-image-remove]').forEach(button=>listen(button,'click',()=>removeHotspotImage(button.dataset.fpImageRemove)));
    root.querySelectorAll('[data-fp-image-alt]').forEach(input=>listen(input,'input',()=>{const item=active()?.images.find(image=>image.id===input.dataset.fpImageAlt);if(item){item.alt=input.value;emit();}}));
    root.querySelectorAll('[data-fp-image-caption]').forEach(input=>listen(input,'input',()=>{const item=active()?.images.find(image=>image.id===input.dataset.fpImageCaption);if(item){item.caption=input.value;emit();}}));

    const stage=root.querySelector('[data-fp-stage]');
    if(stage){
      listen(stage,'pointerdown',event=>{if(!drawing||event.target.closest('[data-fp-hotspot]'))return;event.preventDefault();start=pointer(event,stage);draft={x:start.x,y:start.y,w:0,h:0};const el=document.createElement('div');el.className='fp-draft';stage.appendChild(el);stage.setPointerCapture?.(event.pointerId);});
      listen(stage,'pointermove',event=>{if(!drawing||!start||!draft)return;const now=pointer(event,stage);draft.x=Math.min(start.x,now.x);draft.y=Math.min(start.y,now.y);draft.w=Math.abs(now.x-start.x);draft.h=Math.abs(now.y-start.y);const el=stage.querySelector('.fp-draft');if(el)el.style.cssText=`left:${draft.x}%;top:${draft.y}%;width:${draft.w}%;height:${draft.h}%`;});
      listen(stage,'pointerup',event=>{if(!drawing||!start)return;stage.releasePointerCapture?.(event.pointerId);start=null;finishDraw();});
      listen(stage,'pointercancel',()=>{start=null;cancelDraw();});
    }
  }

  render();
  return {destroy(){destroyed=true;clearListeners();root.innerHTML='';}};
}
