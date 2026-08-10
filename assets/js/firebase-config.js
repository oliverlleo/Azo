import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const supabaseUrl = 'https://jjrsbbgnqfiezhokxbqz.supabase.co';
const supabaseKey = 'sb_publishable_8LlV4bOH3d_axQBQLlHVkA_arQl6nu-';
const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
    storageKey: 'azo-admin-auth'
  }
});

const TABLES = {
  admins: 'admins',
  sitePages: 'site_pages',
  assets: 'assets',
  projects: 'projects',
  projectSettings: 'project_settings'
};
const BUCKET = 'azo-media';

function tableName(name) {
  const value = TABLES[name];
  if (!value) throw new Error(`Coleção desconhecida: ${name}`);
  return value;
}

function toClient(collectionName, row = {}) {
  if (!row) return row;
  if (collectionName === 'sitePages') return {
    ...row,
    updatedAt: row.updated_at ?? row.updatedAt,
    updatedBy: row.updated_by ?? row.updatedBy
  };
  if (collectionName === 'assets') return {
    ...row,
    storagePath: row.storage_path ?? row.storagePath,
    fileName: row.file_name ?? row.fileName,
    contentType: row.content_type ?? row.contentType,
    updatedAt: row.updated_at ?? row.updatedAt,
    updatedBy: row.updated_by ?? row.updatedBy
  };
  if (collectionName === 'projects') return {
    ...row,
    order: row.sort_order ?? row.order,
    coverUrl: row.cover_url ?? row.coverUrl,
    coverAlt: row.cover_alt ?? row.coverAlt,
    createdAt: row.created_at ?? row.createdAt,
    updatedAt: row.updated_at ?? row.updatedAt,
    updatedBy: row.updated_by ?? row.updatedBy
  };
  if (collectionName === 'projectSettings') return {
    ...row,
    builtinKey: row.builtin_key ?? row.builtinKey,
    order: row.sort_order ?? row.order,
    updatedAt: row.updated_at ?? row.updatedAt,
    updatedBy: row.updated_by ?? row.updatedBy
  };
  if (collectionName === 'admins') return {
    ...row,
    createdAt: row.created_at ?? row.createdAt,
    updatedAt: row.updated_at ?? row.updatedAt
  };
  return row;
}

function timestampValue(value) {
  if (value && value.__serverTimestamp === true) return new Date().toISOString();
  return value;
}

function toDb(collectionName, input = {}) {
  const row = {};
  for (const [key, raw] of Object.entries(input)) {
    const value = timestampValue(raw);
    if (key === 'id') { row.id = value; continue; }
    if (collectionName === 'sitePages') {
      const map = { updatedAt:'updated_at', updatedBy:'updated_by' };
      row[map[key] || key] = value;
      continue;
    }
    if (collectionName === 'assets') {
      const map = { storagePath:'storage_path', fileName:'file_name', contentType:'content_type', updatedAt:'updated_at', updatedBy:'updated_by' };
      row[map[key] || key] = value;
      continue;
    }
    if (collectionName === 'projects') {
      const map = { order:'sort_order', coverUrl:'cover_url', coverAlt:'cover_alt', createdAt:'created_at', updatedAt:'updated_at', updatedBy:'updated_by' };
      row[map[key] || key] = value;
      continue;
    }
    if (collectionName === 'projectSettings') {
      const map = { builtinKey:'builtin_key', order:'sort_order', updatedAt:'updated_at', updatedBy:'updated_by' };
      row[map[key] || key] = value;
      continue;
    }
    if (collectionName === 'admins') {
      const map = { createdAt:'created_at', updatedAt:'updated_at' };
      row[map[key] || key] = value;
      continue;
    }
    row[key] = value;
  }
  return row;
}

function makeDocSnapshot(collectionName, id, row) {
  return {
    id,
    exists: () => Boolean(row),
    data: () => row ? toClient(collectionName, row) : undefined
  };
}

function makeQuerySnapshot(collectionName, rows = []) {
  const docs = rows.map(row => makeDocSnapshot(collectionName, String(row.id), row));
  return {
    docs,
    size: docs.length,
    empty: docs.length === 0,
    forEach(callback) { docs.forEach(callback); }
  };
}

const db = { provider: 'supabase' };
const storage = { provider: 'supabase', bucket: BUCKET };

function collection(_db, name) {
  return { kind:'collection', name };
}

function doc(first, second, third) {
  if (first?.kind === 'collection') {
    return { kind:'doc', collectionName:first.name, id: second || crypto.randomUUID() };
  }
  return { kind:'doc', collectionName:second, id: third || crypto.randomUUID() };
}

async function getDoc(refDoc) {
  const table = tableName(refDoc.collectionName);
  const { data, error } = await supabase.from(table).select('*').eq('id', refDoc.id).maybeSingle();
  if (error) throw error;
  return makeDocSnapshot(refDoc.collectionName, refDoc.id, data);
}

async function getDocs(refCollection) {
  const table = tableName(refCollection.name);
  const { data, error } = await supabase.from(table).select('*');
  if (error) throw error;
  return makeQuerySnapshot(refCollection.name, data || []);
}

async function setDoc(refDoc, payload, options = {}) {
  const table = tableName(refDoc.collectionName);
  const data = { id: refDoc.id, ...toDb(refDoc.collectionName, payload) };
  if (options?.merge) {
    const update = { ...data };
    delete update.id;
    const { data: updated, error: updateError } = await supabase.from(table).update(update).eq('id', refDoc.id).select('id');
    if (updateError) throw updateError;
    if (updated?.length) return;
  }
  const { error } = await supabase.from(table).upsert(data, { onConflict:'id' });
  if (error) throw error;
}

async function deleteDoc(refDoc) {
  const table = tableName(refDoc.collectionName);
  const { error } = await supabase.from(table).delete().eq('id', refDoc.id);
  if (error) throw error;
}

function serverTimestamp() {
  return { __serverTimestamp:true };
}

const authListeners = new Set();
let currentUser = null;
let authInitialized = false;

const auth = {
  get currentUser() { return currentUser; }
};

const authReady = supabase.auth.getSession().then(({ data, error }) => {
  if (error) throw error;
  currentUser = data.session?.user || null;
  authInitialized = true;
  return currentUser;
}).catch(error => {
  console.warn('[AZO Supabase] Falha ao restaurar sessão.', error);
  authInitialized = true;
  return null;
});

supabase.auth.onAuthStateChange((_event, session) => {
  currentUser = session?.user || null;
  authInitialized = true;
  for (const listener of authListeners) {
    try { listener(currentUser); } catch (error) { console.error(error); }
  }
});

function onAuthStateChanged(_auth, callback) {
  let active = true;
  authListeners.add(callback);
  authReady.then(() => { if (active) callback(currentUser); });
  return () => { active = false; authListeners.delete(callback); };
}

async function signInWithEmailAndPassword(_auth, email, password) {
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw error;
  currentUser = data.user || data.session?.user || null;
  return { user: currentUser };
}

async function signOut() {
  const { error } = await supabase.auth.signOut();
  if (error) throw error;
  currentUser = null;
}

async function sendPasswordResetEmail(_auth, email) {
  const redirectTo = new URL('./', location.href).href;
  const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo });
  if (error) throw error;
}

function ref(_storage, fullPath) {
  return { fullPath };
}

function uploadBytesResumable(fileRef, file, metadata = {}) {
  const task = {
    snapshot: { ref:fileRef, bytesTransferred:0, totalBytes:file.size },
    on(eventName, progress, error, complete) {
      if (eventName !== 'state_changed') throw new Error('Evento de upload não suportado.');
      queueMicrotask(async () => {
        try {
          progress?.({ bytesTransferred:0, totalBytes:file.size });
          const { error: uploadError } = await supabase.storage.from(BUCKET).upload(fileRef.fullPath, file, {
            upsert: true,
            contentType: metadata.contentType || file.type,
            cacheControl: '31536000'
          });
          if (uploadError) throw uploadError;
          task.snapshot = { ref:fileRef, bytesTransferred:file.size, totalBytes:file.size };
          progress?.(task.snapshot);
          complete?.();
        } catch (uploadError) {
          error?.(uploadError);
        }
      });
      return () => {};
    }
  };
  return task;
}

async function getDownloadURL(fileRef) {
  const { data } = supabase.storage.from(BUCKET).getPublicUrl(fileRef.fullPath);
  return data.publicUrl;
}

async function deleteObject(fileRef) {
  const { error } = await supabase.storage.from(BUCKET).remove([fileRef.fullPath]);
  if (error) throw error;
}

const supabaseConfig = {
  url: supabaseUrl,
  publishableKey: supabaseKey,
  projectRef: 'jjrsbbgnqfiezhokxbqz',
  bucket: BUCKET
};

export {
  supabase,
  supabaseConfig,
  auth,
  db,
  storage,
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  deleteDoc,
  serverTimestamp,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut,
  sendPasswordResetEmail,
  ref,
  uploadBytesResumable,
  getDownloadURL,
  deleteObject,
  authReady
};

// Mantém o comportamento original: no site público carrega os overrides dos
// projetos nativos; no admin carrega o gerenciador dos projetos existentes.
if (/\/admin\/?(?:index\.html)?$/i.test(location.pathname) || location.pathname.includes('/admin/')) {
  import('../../admin/existing-projects.js').catch(error => console.warn('[AZO Admin] Projetos existentes indisponíveis.', error));
} else {
  import('./project-overrides.js').catch(error => console.warn('[AZO] Alterações de projetos existentes indisponíveis.', error));
}
