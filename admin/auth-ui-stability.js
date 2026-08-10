import { auth } from '../assets/js/firebase-config.js';
import { onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/12.16.0/firebase-auth.js';

const SESSION_HINT = 'azo-admin-session-active';
const login = () => document.getElementById('login-screen');
const app = () => document.getElementById('app-shell');

let appWasVisible = Boolean(app() && !app().hidden);
let releaseTimer = null;
let internalChange = false;

function hasSessionHint() {
  return sessionStorage.getItem(SESSION_HINT) === '1';
}

function rememberSession() {
  sessionStorage.setItem(SESSION_HINT, '1');
}

function forgetSession() {
  sessionStorage.removeItem(SESSION_HINT);
}

function suppressLoginFlash({ keepCurrentPanel = false } = {}) {
  const loginScreen = login();
  const shell = app();
  internalChange = true;
  if (loginScreen) loginScreen.hidden = true;
  if (keepCurrentPanel && shell && appWasVisible) shell.hidden = false;
  queueMicrotask(() => { internalChange = false; });
}

function releaseToRealLogin() {
  clearTimeout(releaseTimer);
  releaseTimer = null;
  forgetSession();
  const loginScreen = login();
  const shell = app();
  internalChange = true;
  if (shell) shell.hidden = true;
  if (loginScreen) loginScreen.hidden = false;
  queueMicrotask(() => { internalChange = false; });
}

// If this tab already had an authenticated admin session, never paint the login
// form while Firebase is merely restoring/revalidating that session.
if (hasSessionHint()) suppressLoginFlash();

const observer = new MutationObserver(() => {
  if (internalChange) return;
  const loginScreen = login();
  const shell = app();
  if (!loginScreen || !shell) return;

  if (!shell.hidden) {
    appWasVisible = true;
    rememberSession();
    if (!loginScreen.hidden) suppressLoginFlash({ keepCurrentPanel: true });
    return;
  }

  // admin.js temporarily shows the login whenever Firebase reports null.
  // If this document already had the panel open, keep the exact current panel
  // on screen during a short grace period instead of bouncing to the login.
  if (!loginScreen.hidden && hasSessionHint()) {
    suppressLoginFlash({ keepCurrentPanel: true });
    clearTimeout(releaseTimer);
    releaseTimer = setTimeout(() => {
      if (!auth.currentUser) releaseToRealLogin();
    }, 1600);
  }
});

observer.observe(document.documentElement, {
  subtree: true,
  attributes: true,
  attributeFilter: ['hidden']
});

onAuthStateChanged(auth, user => {
  clearTimeout(releaseTimer);
  releaseTimer = null;

  if (user) {
    rememberSession();
    suppressLoginFlash({ keepCurrentPanel: true });
    return;
  }

  if (!hasSessionHint()) return;

  // Do not treat a momentary null state as a logout. Firebase gets a short
  // grace period to restore the same user; only then is the real login shown.
  suppressLoginFlash({ keepCurrentPanel: true });
  releaseTimer = setTimeout(() => {
    if (!auth.currentUser) releaseToRealLogin();
  }, 1600);
});

// Explicit logout must bypass the grace period immediately.
document.getElementById('logout-button')?.addEventListener('click', () => {
  clearTimeout(releaseTimer);
  releaseTimer = null;
  appWasVisible = false;
  forgetSession();
});

// Returning to the browser tab should never make the login overlay flash on
// top of an already open admin screen.
document.addEventListener('visibilitychange', () => {
  if (!document.hidden && hasSessionHint()) {
    suppressLoginFlash({ keepCurrentPanel: true });
  }
});
