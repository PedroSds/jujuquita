const { cpSync, mkdirSync, readdirSync, rmSync } = require('node:fs');
const { join } = require('node:path');

const output = join(__dirname, 'dist');
const assets = readdirSync(join(__dirname, 'assets'), { withFileTypes: true })
  .filter(entry => entry.isFile() && /\.(png|jpe?g|webp|svg|woff2|txt)$/i.test(entry.name) && !['reference.png','hero-children.png','hero-heart.png'].includes(entry.name))
  .map(entry => 'assets/' + entry.name);
const scripts = ['bootstrap.js', 'catalog.js', 'database.js', 'photo-crop.js', 'store.js',
  'store-enhancements.js', 'motion.js', 'hero-kite.js', 'admin.js', 'admin-enhancements.js'];
const styles = ['style.css', 'hero.css', 'demo.css', 'admin.css'];

rmSync(output, { recursive: true, force: true });
mkdirSync(join(output, 'assets'), { recursive: true });
// The public HTML templates are included in api/store-page.js on Vercel.
// Do not copy them into dist: static files would take priority over SSR rewrites.
for (const file of [...assets, ...scripts, ...styles]) {
  cpSync(join(__dirname, file), join(output, file));
}
