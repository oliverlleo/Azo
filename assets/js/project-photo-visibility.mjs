// One logical photograph includes its desktop and mobile variants.
export const PROJECT_KEYS = ['AS','HL','JT','MN','SE','EF'];
export const VISIBILITY_PREFIX = 'azo-project-photo-';
export function projectPhotoPath(value = '') {
  const match = String(value).match(/(?:^|\/)assets\/images\/projects\/(as|hl|jt|mn|se|ef)-([1-6])(?:-sm)?\.webp(?:[?#].*)?$/i);
  return match ? `assets/images/projects/${match[1].toLowerCase()}-${match[2]}.webp` : '';
}
export function photoRecordId(path) {
  const canonical = projectPhotoPath(path);
  return canonical ? VISIBILITY_PREFIX + canonical.split('/').pop().replace('.webp','') : '';
}
export function visibleProjectPhotos(key, hidden) {
  if (!PROJECT_KEYS.includes(key) || !(hidden instanceof Set)) return [];
  return Array.from({length:6}, (_,i)=>`assets/images/projects/${key.toLowerCase()}-${i+1}.webp`).filter(path=>!hidden.has(path));
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
