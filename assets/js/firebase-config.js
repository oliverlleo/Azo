// Compatibilidade temporária para módulos antigos do AZO Studio.
// Não há Firebase neste arquivo: toda a implementação vive em supabase-config.js.
export * from './supabase-config.js';

if(location.pathname.includes('/admin/')){
  import('../../admin/content-blog.js').catch(error=>console.warn('[AZO Studio] módulo Conteúdos indisponível.',error));
}else{
  import('./content-nav.js').catch(error=>console.warn('[AZO Conteúdos] integração pública indisponível.',error));
}
