const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const adminSession = require('./api/admin-session');
const adminPage = require('./api/admin-page');
const storePage = require('./api/store-page');
const types = {'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.png':'image/png','.webp':'image/webp','.woff2':'font/woff2','.txt':'text/plain; charset=utf-8'};
const host = '127.0.0.1';
const port = Number(process.env.JUJUQUITA_PORT || 4173);
const root = process.argv.includes('--dist') ? path.join(__dirname, 'dist') : __dirname;
const server = http.createServer((request, response) => {
  const route = new URL(request.url, 'http://localhost').pathname;
  if (route === '/api/admin-session') return adminSession.local(request, response);
  if (/^\/jujuadmin(?:\/index\.html|\/)?$/.test(route)) return adminPage.local(request, response);
  const publicPage = {'/':'index','/index.html':'index','/colecao.html':'colecao','/produto.html':'produto'}[route];
  if (publicPage) return storePage.local(request,response,publicPage);
  const relative = route === '/' ? 'index.html' : route.slice(1);
  const file = path.resolve(root, relative);
  const type = types[path.extname(file)];
  if (/^api\//i.test(relative) || !file.startsWith(root + path.sep) || !type) { response.writeHead(404).end(); return; }
  fs.readFile(file, (error, data) => {
    if (error) { response.writeHead(404).end(); return; }
    response.writeHead(200, {'Content-Type':type,'Cache-Control':'no-store'}).end(data);
  });
});
server.listen(port, host, () => console.log(`Vitrine: http://${host}:${port}/\nPainel:  http://${host}:${port}/jujuadmin`));
