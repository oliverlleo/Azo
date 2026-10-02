// One upload policy for every AZO admin image entry point.
// Unsupported, animated, larger or unverified conversions keep the original.
async function requiresOriginal(file) {
  const bytes = await file.arrayBuffer();
  const view = new DataView(bytes);
  if (bytes.byteLength < 8) return true;
  if (file.type === 'image/jpeg') {
    // Keep ICC-tagged, CMYK and higher precision JPEG intact instead of discarding color metadata.
    for (let offset=2; offset+4<bytes.byteLength;) {
      if (view.getUint8(offset)!==0xff) return true;
      const marker=view.getUint8(offset+1);
      if (marker===0xda || marker===0xd9) break;
      const length=view.getUint16(offset+2);
      if (length<2 || offset+2+length>bytes.byteLength) return true;
      if (marker===0xe2 && String.fromCharCode(...new Uint8Array(bytes,offset+4,Math.min(12,length-2))).startsWith('ICC_PROFILE')) return true;
      if ([0xc0,0xc1,0xc2].includes(marker) && (view.getUint8(offset+4)!==8 || view.getUint8(offset+9)===4)) return true;
      offset+=length+2;
    }
    return false;
  }
  if (view.getUint32(0)!==0x89504e47) return true;
  for (let offset=8; offset+12<=bytes.byteLength;) {
    const size=view.getUint32(offset);
    const kind=view.getUint32(offset+4);
    if (kind===0x6163544c) return true; // acTL: never flatten APNG.
    if (kind===0x49484452 && (size<13 || view.getUint8(offset+16)===16)) return true; // IHDR bit depth.
    if ([0x69434350,0x67414d41,0x6348524d,0x63494350].includes(kind)) return true; // ICC/gamma/gamut.
    if (kind===0x49454e44) break;
    offset+=12+size;
  }
  return false;
}
export function webpPath(path) {
  return /\.[^/.]+$/.test(path) ? path.replace(/\.[^/.]+$/,'.webp') : `${path}.webp`;
}
export async function prepareImageUpload(file,path) {
  const original={file,path,converted:false};
  if (!['image/jpeg','image/png'].includes(file.type)) return original;
  if (typeof Worker==='undefined' || typeof createImageBitmap==='undefined' || typeof OffscreenCanvas==='undefined') return original;
  try {
    if (await requiresOriginal(file)) return original;
    const result=await new Promise(resolve=>{
      const worker=new Worker(new URL('./image-webp-worker.js',import.meta.url),{type:'module'});
      const finish=value=>{clearTimeout(timer);worker.terminate();resolve(value);};
      const timer=setTimeout(()=>finish(null),120000);
      worker.onmessage=event=>finish(event.data);
      worker.onerror=()=>finish(null);
      worker.postMessage({file});
    });
    if (!result?.blob || result.blob.size>=file.size) return original;
    const output=new File([result.blob],webpPath(file.name),{type:'image/webp',lastModified:file.lastModified});
    return {file:output,path:webpPath(path),converted:true,width:result.width,height:result.height};
  } catch { return original; }
}
export async function uploadMedia(client,bucket,path,file,options={}) {
  const prepared=await prepareImageUpload(file,path);
  // Unique path prevents overwriting another file or a previous version.
  if (prepared.converted) prepared.path=prepared.path.replace(/\.webp$/,`-${crypto.randomUUID()}.webp`);
  const {error}=await client.storage.from(bucket).upload(prepared.path,prepared.file,{
    ...options,upsert:prepared.converted?false:(options.upsert??false),
    contentType:prepared.file.type||options.contentType
  });
  if(error)throw error;
  return {path:prepared.path,url:client.storage.from(bucket).getPublicUrl(prepared.path).data.publicUrl,
    fileName:prepared.file.name,contentType:prepared.file.type,size:prepared.file.size,converted:prepared.converted};
}
