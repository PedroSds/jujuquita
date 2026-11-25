const {test} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const {storeView,normalizeCatalog} = require('../catalog.js');
const {renderPage} = require('../api/store-page.js');
const template = name => fs.readFileSync(path.join(__dirname,'..',name+'.html'),'utf8');
const item = (id,category,name,active=true) => ({id,category,name,active,price:9000,sizes:['8'],colors:['Azul'],description:'Moda & carinho'});
const data = normalizeCatalog({
  categories:[{id:1,name:'Meninas',active:true},{id:2,name:'Baby',active:false}],
  products:[item(1,1,'Vestido Azul'),item(2,2,'Vestido Rosa'),item(3,2,'Rascunho',false),item(4,2,'Fora da vitrine')],
  highlights:[{product:1,active:true},{product:2,active:true},{product:3,active:true}],
  settings:{name:'Jujuquita',hours:'Seg. a sex.',instagram:'https://www.instagram.com/jujuquita.kids'}
});

test('Homepage has the final categories and featured cards before JavaScript executes',()=>{
  const html=renderPage(template('index'),'index',data,new URLSearchParams());
  assert.match(html,/data-store-rendered/);
  assert.doesNotMatch(html,/data-loading/);
  assert.equal((html.match(/class="product"/g)||[]).length,2);
  assert.match(html,/data-product="2"/);
  assert.doesNotMatch(html,/data-product="3"/);
  assert.doesNotMatch(html,/data-product="4"/);
  assert.match(html,/Seg\. a sex\./);
  const raw=html.match(/<script type="application\/json" id="public-catalog">([\s\S]*?)<\/script>/)[1];
  assert.deepEqual(JSON.parse(raw),data);
});

test('Collection SSR and subsequent filtering use the same visibility and search rules',()=>{
  const html=renderPage(template('colecao'),'colecao',data,new URLSearchParams('busca=azul'));
  assert.match(html,/1 produto encontrado/);
  assert.match(html,/data-product="1"/);
  assert.doesNotMatch(html,/data-product="2"/);
  assert.match(html,/id="catalog-filters"/);
  assert.equal(storeView.collectionSelection(data,new URLSearchParams(),new URLSearchParams('color=Azul')).filtered.length,1);
});

test('Product pages confirm availability, preserve escaped content and handle missing products',()=>{
  const html=renderPage(template('produto'),'produto',data,new URLSearchParams('id=2'));
  assert.match(html,/<title>Vestido Rosa \| Jujuquita<\/title>/);
  assert.match(html,/id="product-form"/);
  assert.match(html,/Moda &amp; carinho/);
  assert.match(html,/class="btn" disabled/);
  const missing=renderPage(template('produto'),'produto',data,new URLSearchParams('id=3'));
  assert.match(missing,/Produto indisponível/);
  assert.doesNotMatch(missing,/id="product-form"/);
});
