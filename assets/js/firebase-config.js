// Compatibilidade temporária para módulos antigos do AZO Studio.
// Não há Firebase neste arquivo: toda a implementação vive em supabase-config.js.
export * from './supabase-config.js';

// Integra a nova área editorial ao menu/footer e injeta os conteúdos recentes na home.
// O módulo é defensivo e não executa nada dentro de /admin/.
import('./content-nav.js').catch(error=>console.warn('[AZO Conteúdos] integração pública indisponível.',error));
