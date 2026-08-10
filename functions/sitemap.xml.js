const SUPABASE_URL='https://jjrsbbgnqfiezhokxbqz.supabase.co';
const SUPABASE_KEY='sb_publishable_8LlV4bOH3d_axQBQLlHVkA_arQl6nu-';
const SITE='https://azocc.com.br';
const esc=v=>String(v||'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&apos;'}[c]));

async function rest(table,params={}){
  const url=new URL(`/rest/v1/${table}`,SUPABASE_URL);
  for(const [k,v] of Object.entries(params)) url.searchParams.set(k,v);
  const response=await fetch(url,{headers:{apikey:SUPABASE_KEY,Authorization:`Bearer ${SUPABASE_KEY}`}});
  if(!response.ok) throw new Error(`HTTP ${response.status}`);
  return response.json();
}

export async function onRequestGet(){
  const staticUrls=[
    ['/', '1.0'],['/servicos.html','0.9'],['/projetos.html','0.9'],['/sobre.html','0.7'],['/contato.html','0.8'],
    ['/projeto-arquitetonico.html','0.9'],['/interiores.html','0.9'],['/gestao-de-obras.html','0.9'],['/conteudos/','0.9']
  ];
  let posts=[],categories=[];
  try{
    [posts,categories]=await Promise.all([
      rest('content_posts',{select:'slug,updated_at,published_at,scheduled_at',order:'updated_at.desc',limit:'1000'}),
      rest('content_categories',{select:'slug,updated_at',order:'sort_order.asc',limit:'100'})
    ]);
  }catch(_){ }
  const now=new Date().toISOString();
  const rows=[
    ...staticUrls.map(([path,priority])=>`<url><loc>${esc(SITE+path)}</loc><lastmod>${now}</lastmod><changefreq>${path==='/conteudos/'?'weekly':'monthly'}</changefreq><priority>${priority}</priority></url>`),
    ...categories.map(c=>`<url><loc>${esc(`${SITE}/conteudos/categoria/${c.slug}/`)}</loc><lastmod>${esc(c.updated_at||now)}</lastmod><changefreq>weekly</changefreq><priority>0.7</priority></url>`),
    ...posts.map(p=>`<url><loc>${esc(`${SITE}/conteudos/${p.slug}/`)}</loc><lastmod>${esc(p.updated_at||p.published_at||p.scheduled_at||now)}</lastmod><changefreq>monthly</changefreq><priority>0.8</priority></url>`)
  ];
  const xml=`<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${rows.join('')}</urlset>`;
  return new Response(xml,{headers:{'content-type':'application/xml; charset=utf-8','cache-control':'public,max-age=300,s-maxage=900'}});
}
