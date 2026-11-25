function normalizeCatalog(value) {
  value.settings = {name:'', instagram:'', hours:'', delivery:'', payment:'', returns:'', ...value.settings};
  value.products = value.products.map(item => ({colors:['Única'], sku:'JUJU-' + item.id, stock:null, care:'', measurements:'Consulte as medidas com a loja.', ...item}));
  return value;
}
function salePrice(item) {
  return Number.isInteger(item.promotion) && item.promotion > 0 && item.promotion < item.price ? item.promotion : item.price;
}
function stockFor(item, size, color) {
  const variant = item.variants?.find(entry => entry.size === size && entry.color === color);
  return variant && Number.isInteger(variant.stock) ? variant.stock : Number.isInteger(item.stock) ? item.stock : 99;
}
const normalizeSearch = value => String(value).normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLocaleLowerCase('pt-BR');
const escapeHtml = value => String(value ?? '').replace(/[&<>"']/g, char =>
  ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'})[char]);
const money = cents => new Intl.NumberFormat('pt-BR', {style:'currency',currency:'BRL'}).format(cents / 100);
function isCatalogImageUrl(value) {
  return /^https:\/\/wzagqyfliroobrajqzxt\.supabase\.co\/storage\/v1\/object\/public\/juju-media\/[a-z0-9._-]+$/i.test(value || '');
}
function picture(item, priority = false) {
  if (isCatalogImageUrl(item.image) || /^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/.test(item.image || '')) {
    return `<img class="catalog-image" loading="${priority ? 'eager' : 'lazy'}" ${priority ? 'fetchpriority="high"' : ''} decoding="async" src="${escapeHtml(item.image)}" alt="${escapeHtml(item.name)}">`;
  }
  return '<div class="catalog-image missing-photo">Sem foto</div>';
}

const storeView = (() => {
  const activeCategories = data => data.categories.filter(item => item.active);
  function visibleProducts(data) {
    const categories = new Set(activeCategories(data).map(item => item.id));
    const featured = new Set(data.highlights.filter(item => item.active).map(item => item.product));
    return data.products.filter(item => item.active && (categories.has(item.category) || featured.has(item.id)));
  }
  const collectionProducts = data => {
    const ids = new Set(activeCategories(data).map(item => item.id));
    return visibleProducts(data).filter(item => ids.has(item.category));
  };
  function matchesSearch(data, item, query) {
    const category = data.categories.find(entry => entry.id === item.category);
    const searchable = normalizeSearch([item.name, item.description, item.sku, category?.name, ...item.colors, ...item.sizes].join(' '));
    return normalizeSearch(query).trim().split(/\s+/).every(term => searchable.includes(term));
  }
  const categoryButton = (item, active = null) => `<button data-category="${item.id}"${active === item.id ? ' class="active" aria-pressed="true"' : ''}>${escapeHtml(item.name)}</button>`;
  const categoryRail = data => activeCategories(data).map(item => {
    const imageOnly = item.show_name === false && Boolean(item.image);
    return `<button class="category${imageOnly ? ' category-art' : ''}" data-category="${item.id}" aria-label="${escapeHtml(item.name)}">${picture(item)}${imageOnly ? '' : `<span class="category-label">${escapeHtml(item.name)}</span>`}</button>`;
  }).join('');
  const productCard = (item, priority = false) => `<article class="product"><button class="product-photo" data-product="${item.id}" aria-label="Ver ${escapeHtml(item.name)}">${picture(item, priority)}</button><h3>${escapeHtml(item.name)}</h3><p>${money(salePrice(item))}</p><div class="product-actions"><button class="btn" data-quick-add="${item.id}">Adicionar à sacola</button><button class="outline" data-product="${item.id}">Ver detalhes</button></div></article>`;
  const highlights = data => {
    const visible = new Map(visibleProducts(data).map(item => [item.id, item]));
    const featured = [...new Set(data.highlights.filter(item => item.active).map(item => item.product))].map(id => visible.get(id)).filter(Boolean);
    return featured.length ? `<h2>Destaques</h2><div class="products featured-products">${featured.map(item => productCard(item)).join('')}</div>` : '';
  };
  const option = values => values.map(value => `<option>${escapeHtml(value)}</option>`).join('');
  function collectionSelection(data, params, filters = new URLSearchParams()) {
    const categories = activeCategories(data);
    const categoryId = categories.find(item => item.id === Number(params.get('categoria')))?.id || 0;
    const searchTerm = params.get('busca')?.trim() || '';
    const items = collectionProducts(data);
    const filtered = items.filter(item => (!categoryId || item.category === categoryId) && matchesSearch(data, item, searchTerm) &&
      (!filters.get('size') || item.sizes.includes(filters.get('size'))) &&
      (!filters.get('color') || item.colors.includes(filters.get('color'))) &&
      (!filters.get('max') || salePrice(item) <= Math.round(Number(filters.get('max')) * 100)));
    filtered.sort((a,b) => filters.get('sort') === 'low' ? salePrice(a)-salePrice(b) : filters.get('sort') === 'high' ? salePrice(b)-salePrice(a) : b.id-a.id);
    return {categories, categoryId, searchTerm, items, filtered};
  }
  const collectionCards = (items, limit) => items.slice(0,limit).map((item,index) => productCard(item,index < 2)).join('') || '<p>Nenhuma peça encontrada. Experimente ampliar os filtros.</p>';
  const resultCount = count => count === 1 ? '1 produto encontrado' : count + ' produtos encontrados';
  function collection(data, params) {
    const {categories, categoryId, searchTerm, items, filtered} = collectionSelection(data, params);
    const sizes = [...new Set(items.flatMap(item => item.sizes))];
    const colors = [...new Set(items.flatMap(item => item.colors))];
    return `<h1>Nossa coleção</h1>
      <div class="filters" aria-label="Categorias">${[{id:0,name:'Todos'},...categories].map(item => categoryButton(item,categoryId)).join('')}</div>
      ${searchTerm ? `<p>Resultados para “${escapeHtml(searchTerm)}” · <a href="colecao.html">Limpar busca</a></p>` : ''}
      <form id="catalog-filters" class="catalog-controls"><label>Tamanho<select name="size"><option value="">Todos</option>${option(sizes)}</select></label><label>Cor<select name="color"><option value="">Todas</option>${option(colors)}</select></label><label>Até R$<input name="max" type="number" min="0" step=".01" placeholder="Qualquer valor"></label><label>Ordenar<select name="sort"><option value="new">Novidades</option><option value="low">Menor preço</option><option value="high">Maior preço</option></select></label><button type="reset" class="outline">Limpar filtros</button></form><p id="catalog-count" aria-live="polite">${resultCount(filtered.length)}</p>
      <div class="products">${collectionCards(filtered,12)}</div>${filtered.length > 12 ? '<button id="load-more" class="outline">Ver mais produtos</button>' : ''}`;
  }
  function product(data,item) {
    if (!item) return '<h1>Produto indisponível</h1><a class="btn" href="colecao.html">Explorar coleção</a>';
    const images = [...new Set([item.image,...(item.gallery || [])].filter(Boolean))];
    return `<p><a href="colecao.html">Nossa coleção</a> / ${escapeHtml(item.name)}</p><div class="product-page-grid">
      <div><div id="main-photo">${picture(item,true)}</div><div class="photo-thumbnails">${images.map((image,index)=>`<button data-gallery="${index}" aria-label="Ver foto ${index+1}">${picture({name:item.name,image})}</button>`).join('')}</div></div>
      <form id="product-form"><h1>${escapeHtml(item.name)}</h1>
      <p class="product-price">${item.promotion ? `<del>${money(item.price)}</del> ` : ''}${money(salePrice(item))}</p><p>${escapeHtml(item.description)}</p>
      <label>Tamanho<select name="size" required><option value="">Selecione</option>${option(item.sizes)}</select></label>
      <label>Cor<select name="color" required>${option(item.colors)}</select></label>
      <p id="availability" role="status">Escolha um tamanho.</p><button class="btn" disabled>Adicionar à sacola</button>
      <p id="product-feedback" role="status"></p>
      <details><summary>Guia de medidas</summary><p>${escapeHtml(item.measurements || 'Consulte as medidas com a loja.')}</p></details>
      <details><summary>Tecido e cuidados</summary><p>${escapeHtml(item.care || 'Consulte os detalhes com a loja.')}</p></details>
      ${['delivery','payment','returns'].map((key,index)=>`<details><summary>${['Entrega','Pagamento','Trocas'][index]}</summary><p>${escapeHtml(data.settings[key])}</p></details>`).join('')}</form></div>`;
  }
  return {activeCategories, visibleProducts, collectionProducts, matchesSearch, categoryButton, categoryRail, productCard, highlights, collectionSelection, collectionCards, resultCount, collection, product};
})();
if (typeof module !== 'undefined' && module.exports) module.exports = {normalizeCatalog, storeView, escapeHtml};
