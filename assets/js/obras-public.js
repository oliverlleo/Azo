import { supabase } from './supabase-config.js';

const SITE_BASE = new URL('../../', import.meta.url);
const obraHref = slug => {
  const url = new URL('obras/', SITE_BASE);
  url.searchParams.set('obra', slug);
  return url.href;
};

function insertMenuLink(container, obra, before) {
  if (!container || container.querySelector(`[data-obra-menu="${CSS.escape(obra.id)}"]`)) return;
  const link = document.createElement('a');
  link.href = obraHref(obra.slug);
  link.textContent = obra.menu_label || obra.title;
  link.dataset.obraMenu = obra.id;
  if (before) container.insertBefore(link, before);
  else container.appendChild(link);
}

async function loadObraMenu() {
  try {
    const { data, error } = await supabase
      .from('obras')
      .select('id,slug,title,menu_label,sort_order')
      .eq('published', true)
      .eq('archived', false)
      .eq('show_in_menu', true)
      .order('sort_order');
    if (error) throw error;
    if (!data?.length) return;

    const desktop = document.querySelector('.site-header .nav');
    const desktopCta = desktop?.querySelector('.nav-cta') || null;
    const mobile = document.querySelector('.mobile-nav');
    const mobileSmall = mobile?.querySelector('small') || null;

    for (const obra of data) {
      insertMenuLink(desktop, obra, desktopCta);
      insertMenuLink(mobile, obra, mobileSmall);
    }
  } catch (error) {
    console.warn('[AZO] Não foi possível carregar links públicos de obras.', error);
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', loadObraMenu, { once:true });
} else {
  loadObraMenu();
}
