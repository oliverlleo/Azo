// One logical photograph includes its desktop and mobile variants.
export const PROJECT_KEYS = ['AS','HL','JT','MN','SE','EF'];
export const VISIBILITY_PREFIX = 'azo-project-photo-';
export function projectPhotoPath(value = '') {
  const match = String(value).match(/(?:^|\/)assets\/images\/projects\/(as|hl|jt|mn|se|ef)-([1-6]|extra-[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})(?:-sm)?\.webp(?:[?#].*)?$/i);
  return match ? `assets/images/projects/${match[1].toLowerCase()}-${match[2]}.webp` : '';
}
export function photoRecordId(path) {
  const canonical = projectPhotoPath(path);
  return canonical ? VISIBILITY_PREFIX + canonical.split('/').pop().replace('.webp','') : '';
}
export function visibleProjectPhotos(key, hidden, additions = new Map()) {
  if (!PROJECT_KEYS.includes(key) || !(hidden instanceof Set)) return [];
  const prefix=`assets/images/projects/${key.toLowerCase()}-`;
  const original=Array.from({length:6}, (_,i)=>prefix+(i+1)+'.webp');
  const extra=[...additions.values()].filter(item=>item.key.startsWith(prefix)).sort((a,b)=>a.createdAt.localeCompare(b.createdAt)||a.key.localeCompare(b.key)).map(item=>item.key);
  return [...original,...extra].filter(path=>!hidden.has(path));
}
export function hiddenProjectPhotos(rows) {
  const hidden = new Set();
  for (const row of rows || []) {
    if (!String(row.id).startsWith(VISIBILITY_PREFIX)) continue;
    for (const item of Array.isArray(row.items) ? row.items : []) {
      const path = projectPhotoPath(item.key);
      if (path && photoRecordId(path) === row.id && item.type === 'project-photo-visibility' && item.value === true) hidden.add(path);
    }
  }
  return hidden;
}

export function isAddedPhoto(path) { return projectPhotoPath(path).includes('-extra-'); }
export function addedProjectPhotos(rows, storageOrigin) {
  const photos=new Map();
  for(const row of rows||[]) {
    for(const item of Array.isArray(row.items)?row.items:[]) {
      const key=projectPhotoPath(item.key);
      if(!isAddedPhoto(key)||photoRecordId(key)!==row.id||item.type!=='project-photo-added')continue;
      try {
        const url=new URL(item.url);
        if(url.origin!==storageOrigin||!url.pathname.startsWith('/storage/v1/object/public/azo-media/site/assets/'))continue;
        photos.set(key,{key,url:url.href,createdAt:String(item.createdAt||''),name:String(item.name||'Foto adicionada')});
      } catch {}
    }
  }
  return photos;
}
