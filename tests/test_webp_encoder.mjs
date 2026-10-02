// Exercise the exact vendored encoder used in the admin. Decode/compare with Pillow.
import {readFile,writeFile,mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import assert from 'node:assert/strict';
import createEncoder from '../assets/vendor/webp/webp_enc.js';
const python=process.env.CODEX_PRIMARY_RUNTIME_PYTHON||'python3';
const directory=await mkdtemp(path.join(tmpdir(),'azo-webp-test-'));
try {
  const width=128,height=96;
  const source=new Uint8ClampedArray(width*height*4);
  for(let i=0;i<source.length;i+=4){source[i]=i%251;source[i+1]=75;source[i+2]=23;source[i+3]=(i%3===0?127:255);}
  const wasmBinary=await readFile(new URL('../assets/vendor/webp/webp_enc.wasm',import.meta.url));
  const encoder=await createEncoder({wasmBinary,noInitialRun:true});
  const result=encoder.encode(source,width,height,{
    quality:100,target_size:0,target_PSNR:0,method:6,sns_strength:50,
    filter_strength:60,filter_sharpness:0,filter_type:1,partitions:0,
    segments:4,pass:1,show_compressed:0,preprocessing:0,autofilter:0,
    partition_limit:0,alpha_compression:1,alpha_filtering:1,alpha_quality:100,
    lossless:1,exact:1,image_hint:0,emulate_jpeg_size:0,thread_level:0,
    low_memory:0,near_lossless:100,use_delta_palette:0,use_sharp_yuv:0
  });
  assert(result?.length);
  await writeFile(path.join(directory,'original.rgba'),source);
  await writeFile(path.join(directory,'converted.webp'),result);
  const checked=spawnSync(python,['-c',
    `from PIL import Image;from pathlib import Path;p=Path(__import__('sys').argv[1]);im=Image.open(p/'converted.webp');assert im.size==(${width},${height});assert im.convert('RGBA').tobytes()==(p/'original.rgba').read_bytes();print('Admin WASM: identical pixels, dimensions and alpha verified.')`,directory],{encoding:'utf8'});
  assert.equal(checked.status,0,checked.stderr);
  console.log(checked.stdout.trim());
} finally {await rm(directory,{recursive:true,force:true});}
// Environments without browser encoders must pass originals through unchanged.
const {prepareImageUpload,uploadMedia}=await import('../assets/js/image-upload.js');
const file=new File(['original-data'],'photo.jpg',{type:'image/jpeg'});
const prepared=await prepareImageUpload(file,'site/photo.jpg');
assert.equal(prepared.file,file);
assert.equal(prepared.path,'site/photo.jpg');
const calls=[];
const bucket={upload:async(...args)=>{calls.push(args);return {error:null};},getPublicUrl:name=>({data:{publicUrl:'https://example.test/'+name}})};
const uploaded=await uploadMedia({storage:{from:()=>bucket}},'azo-media','site/photo.jpg',file,{upsert:false});
assert.equal(calls.length,1);
assert.equal(calls[0][1],file);
assert.equal(uploaded.contentType,'image/jpeg');
assert.equal(uploaded.size,file.size);
assert.equal(uploaded.path,'site/photo.jpg');
console.log('Original file fallback and stored MIME/size verified.');
