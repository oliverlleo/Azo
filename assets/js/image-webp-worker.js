// Conversion runs off the UI thread. No lossy encoding or resizing.
import createEncoder from '../vendor/webp/webp_enc.js';
let encoder;
const options = {
  quality:100,target_size:0,target_PSNR:0,method:6,sns_strength:50,
  filter_strength:60,filter_sharpness:0,filter_type:1,partitions:0,
  segments:4,pass:1,show_compressed:0,preprocessing:0,autofilter:0,
  partition_limit:0,alpha_compression:1,alpha_filtering:1,alpha_quality:100,
  lossless:1,exact:1,image_hint:0,emulate_jpeg_size:0,thread_level:0,
  low_memory:0,near_lossless:100,use_delta_palette:0,use_sharp_yuv:0
};
async function pixels(blob) {
  const bitmap = await createImageBitmap(blob);
  try {
    if (bitmap.width > 16383 || bitmap.height > 16383 || bitmap.width * bitmap.height > 24000000) {
      throw new Error('Image exceeds safe lossless encoding limits.');
    }
    const canvas = new OffscreenCanvas(bitmap.width, bitmap.height);
    const context = canvas.getContext('2d', {colorSpace:'srgb',willReadFrequently:true});
    context.drawImage(bitmap, 0, 0);
    return context.getImageData(0, 0, bitmap.width, bitmap.height);
  } finally { bitmap.close(); }
}
export function samePixels(a,b) {
  return a.width === b.width && a.height === b.height && a.data.length === b.data.length && a.data.every((v,i)=>v===b.data[i]);
}
self.onmessage = async ({data:{file}}) => {
  try {
    const source = await pixels(file);
    encoder ||= createEncoder({noInitialRun:true});
    const module = await encoder;
    const bytes = module.encode(source.data,source.width,source.height,options);
    if (!bytes) throw new Error('Lossless WebP encoding failed.');
    const blob = new Blob([bytes],{type:'image/webp'});
    if (blob.size >= file.size) return self.postMessage({reason:'not-smaller'});
    const decoded = await pixels(blob);
    if (!samePixels(source,decoded)) return self.postMessage({reason:'pixel-mismatch'});
    self.postMessage({blob,width:source.width,height:source.height});
  } catch { self.postMessage({reason:'unsupported-or-failed'}); }
};
