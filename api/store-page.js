const {readFileSync} = require('node:fs');
const {join} = require('node:path');
const {storeView, escapeHtml} = require('../catalog.js');
const database = require('../database.js');

const templates = Object.fromEntries(['index','colecao','produto'].map(name =>
  [name,readFileSync(join(__dirname,'..',name+'.html'),'utf8')]));
const names = {home:'index',collection:'colecao',product:'produto'};
// Coalesce simultaneous requests, without retaining catalog data across requests.
let pending;
function readPublicCatalog() {
  if (!pending) pending = database.readCatalog().finally(() => { pending = null; });
  return pending;
}
function renderPage(template, page, data, params) {
  const categories = storeView.activeCategories(data);
  const menu = categories.map(item=>storeView.categoryButton(item)).join('');
  let html = template.replace('<body>', '<body data-store-rendered>')
    .replace(/<!--loading-start-->[\s\S]*?<!--loading-end-->/g,'');
  html = html.replace('<!--category-menu-->', () => menu);
  const instagram = /^https:\/\/(?:www\.)?instagram\.com\/[\w.]+\/?$/i.test(data.settings.instagram) ? data.settings.instagram : '';
  if (instagram) html = html.replace('<a data-instagram hidden', () => '<a data-instagram href="'+escapeHtml(instagram)+'"');
  html = html.replace('<!--contact-hours-->', () => data.settings.hours ? '<p>'+escapeHtml(data.settings.hours)+'</p>' : '');
  if (page === 'index') {
    html = html.replace('<!--category-content-->', () => storeView.categoryRail(data))
      .replace('<!--highlights-content-->', () => storeView.highlights(data));
  } else if (page === 'colecao') {
    html = html.replace('<!--collection-content-->', () => storeView.collection(data,params));
  } else {
    const item = storeView.visibleProducts(data).find(x=>x.id === Number(params.get('id')));
    html = html.replace('<!--product-content-->', () => storeView.product(data,item));
    if (item) html = html.replace('<title>Produto | Jujuquita</title>', () => '<title>'+escapeHtml(item.name)+' | Jujuquita</title>');
  }
  // Script data is inert JSON and cannot close its HTML element.
  const json=JSON.stringify(data).replace(/</g,'\\u003c').replace(/>/g,'\\u003e').replace(/&/g,'\\u0026');
  return html.replace('<!--public-catalog-->', () => '<script type="application/json" id="public-catalog">'+json+'</script>');
}
async function serve(req,res,localPage) {
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    res.statusCode=405; res.setHeader('Allow','GET, HEAD'); return res.end();
  }
  const params=new URL(req.url,'http://localhost').searchParams;
  for (const [key,value] of Object.entries(req.query || {})) if (!params.has(key) && typeof value === 'string') params.set(key,value);
  const requested = req.query?.page || params.get('page');
  const page=localPage || (Object.hasOwn(names,requested) ? names[requested] : 'index');
  res.setHeader('Content-Type','text/html; charset=utf-8');
  res.setHeader('Cache-Control','no-store');
  let html=templates[page];
  try {
    // Keep the static fallback available even if the database has a transient slow response.
    let timeout;
    const data=await Promise.race([readPublicCatalog(),new Promise((_,reject) => {timeout=setTimeout(()=>reject(Error('Catalog timeout')),3000);})]).finally(()=>clearTimeout(timeout));
    // The public read uses exactly the existing anonymous RLS policies; do not use an admin session.
    html=renderPage(html,page,data,params);
  } catch (error) {
    // If the backend is unavailable, return the static shell and let the client retry.
    console.warn('Public catalog unavailable:',error.message);
  }
  return res.end(req.method === 'HEAD' ? undefined : html);
}
module.exports=(req,res)=>serve(req,res);
module.exports.local=(req,res,page)=>serve(req,res,page);
module.exports.renderPage=renderPage;
