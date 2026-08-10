const SUPABASE_URL='https://jjrsbbgnqfiezhokxbqz.supabase.co';
const SUPABASE_KEY='sb_publishable_8LlV4bOH3d_axQBQLlHVkA_arQl6nu-';
const SITE='https://azocc.com.br';
const esc=v=>String(v||'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&apos;'}[c]));
async function posts(){
  const url=new URL('/rest/v1/content_posts',SUPABASE_URL);
  url.searchParams.set('select','title,slug,excerpt,published_at,scheduled_at,updated_at');
  url.searchParams.set('order','published_at.desc.nullslast,updated_at.desc');
  url.searchParams.set('limit','30');
  const response=await fetch(url,{headers:{apikey:SUPABASE_KEY,Authorization:`Bearer ${SUPABASE_KEY}`}});
  if(!response.ok) throw new Error(`HTTP ${response.status}`);
  return response.json();
}
export async function onRequestGet(){
  let data=[];try{data=await posts();}catch(_){ }
  const items=data.map(post=>{
    const link=`${SITE}/conteudos/${post.slug}/`;
    const date=new Date(post.published_at||post.scheduled_at||post.updated_at||Date.now()).toUTCString();
    return `<item><title>${esc(post.title)}</title><link>${esc(link)}</link><guid isPermaLink="true">${esc(link)}</guid><pubDate>${esc(date)}</pubDate><description>${esc(post.excerpt||'')}</description></item>`;
  }).join('');
  const xml=`<?xml version="1.0" encoding="UTF-8"?><rss version="2.0"><channel><title>Conteúdos — AZO Criação &amp; Construção</title><link>${SITE}/conteudos/</link><description>Arquitetura, interiores, planejamento e obra explicados pela AZO.</description><language>pt-BR</language>${items}</channel></rss>`;
  return new Response(xml,{headers:{'content-type':'application/rss+xml; charset=utf-8','cache-control':'public,max-age=300,s-maxage=900'}});
}
