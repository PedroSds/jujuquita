const { cpSync, mkdirSync, readdirSync, rmSync } = require('node:fs');
const { join } = require('node:path');

const output = join(__dirname, 'dist');
const pages = ['index.html', 'colecao.html', 'produto.html'];
const assets = readdirSync(join(__dirname, 'assets'), { withFileTypes: true })
  .filter(entry => entry.isFile() && /\.(png|jpe?g|webp|svg)$/i.test(entry.name))
  .map(entry => 'assets/' + entry.name);
const scripts = ['bootstrap.js', 'catalog.js', 'database.js', 'store.js',
  'store-enhancements.js', 'admin.js', 'admin-enhancements.js'];
const styles = ['style.css', 'hero.css', 'demo.css', 'admin.css'];

rmSync(output, { recursive: true, force: true });
mkdirSync(join(output, 'assets'), { recursive: true });
for (const file of [...pages, ...assets, ...scripts, ...styles]) {
  cpSync(join(__dirname, file), join(output, file));
}
