import { initializeApp, getApps } from 'https://www.gstatic.com/firebasejs/12.16.0/firebase-app.js';
import { getAuth, setPersistence, browserLocalPersistence } from 'https://www.gstatic.com/firebasejs/12.16.0/firebase-auth.js';
import { getFirestore } from 'https://www.gstatic.com/firebasejs/12.16.0/firebase-firestore.js';
import { getStorage } from 'https://www.gstatic.com/firebasejs/12.16.0/firebase-storage.js';

const firebaseConfig = {
  apiKey: 'AIzaSyDSr_8pZ99SL5qbZz38guDnIaQ1780Cxrw',
  authDomain: 'projectazo-9ed9d.firebaseapp.com',
  projectId: 'projectazo-9ed9d',
  storageBucket: 'projectazo-9ed9d.firebasestorage.app',
  messagingSenderId: '265937179992',
  appId: '1:265937179992:web:432a13556c1f991a65c12d',
  measurementId: 'G-Q71SM637B4'
};

const app = getApps().length ? getApps()[0] : initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const storage = getStorage(app);

setPersistence(auth, browserLocalPersistence).catch(() => {});

export { app, auth, db, storage, firebaseConfig };

// Load the correct management layer without exposing any admin link on the public site.
if (/\/admin\/?(?:index\.html)?$/i.test(location.pathname) || location.pathname.includes('/admin/')) {
  import('../../admin/existing-projects.js').catch(error => console.warn('[AZO Admin] Projetos existentes indisponíveis.', error));
} else {
  import('./project-overrides.js').catch(error => console.warn('[AZO] Alterações de projetos existentes indisponíveis.', error));
}
