const $ = selector => document.querySelector(selector);
const catalog = initialCatalog;
const categories = catalog.categories.filter(item => item.active);
function visibleProducts(data) {
  const visibleCategories = new Set(data.categories.filter(item => item.active).map(item => item.id));
  const featured = new Set(data.highlights.filter(item => item.active).map(item => item.product));
  return data.products.filter(item => item.active && (visibleCategories.has(item.category) || featured.has(item.id)));
}
const products = visibleProducts(catalog);
const collectionProducts = products.filter(item => categories.some(category => category.id === item.category));
const dialog = $('#modal');
const params = new URLSearchParams(location.search);
const categoryId = categories.find(item => item.id === Number(params.get('categoria')))?.id || 0;
const searchTerm = params.get('busca')?.trim() || '';
let bag = initialBag.filter(row => row && Number.isInteger(row.id) && Number.isInteger(row.qty) && row.qty > 0 && row.qty <= 99 && typeof row.size === 'string');
let savingBag = false;
function updateBagCount() {
  $('#count').textContent = bag.reduce((sum, row) => sum + row.qty, 0);
}
async function persistBag(next) {
  if (savingBag) throw Error('Aguarde a atualização da sacola.');
  savingBag = true;
  try {
    await database.cart(next);
    bag = next;
    updateBagCount();
  } finally { savingBag = false; }
}
function modal(content) {
  $('#modal-content').innerHTML = content;
  if (!dialog.open) dialog.showModal();
}
function categoryButton(item) {
  return `<button data-category="${item.id}">${escapeHtml(item.name)}</button>`;
}
function productCard(item) {
  return `<article class="product"><button class="product-photo" data-product="${item.id}" aria-label="Ver ${escapeHtml(item.name)}">${picture(item)}</button><h3>${escapeHtml(item.name)}</h3><p>${money(salePrice(item))}</p><div class="product-actions"><button class="btn" data-quick-add="${item.id}">Adicionar à sacola</button><button class="outline" data-product="${item.id}">Ver detalhes</button></div></article>`;
}
async function addToBag(item, size, color) {
  if (!item.sizes.includes(size) || !item.colors.includes(color)) return 'Selecione um tamanho e uma cor.';
  const next = structuredClone(bag);
  const row = next.find(entry => entry.id === item.id && entry.size === size && (entry.color || 'Única') === color);
  const stock = stockFor(item, size, color);
  if (stock <= 0) return 'Esta opção está esgotada.';
  if ((row?.qty || 0) >= Math.min(99, stock)) return 'Quantidade máxima disponível atingida.';
  if (row) row.qty++;
  else next.push({id:item.id, size, color, qty:1, price:salePrice(item)});
  try { await persistBag(next); }
  catch { return 'Não foi possível salvar a sacola. Tente novamente.'; }
  showBag();
  return '';
}
async function quickAdd(id) {
  const item = products.find(record => record.id === id);
  if (!item) return;
  const single = item.sizes.length === 1 && item.colors.length === 1;
  const error = single ? await addToBag(item, item.sizes[0], item.colors[0]) : '';
  if (single && !error) return;
  const options = values => values.map(value => `<option>${escapeHtml(value)}</option>`).join('');
  modal(`<h2>${escapeHtml(item.name)}</h2><p>${money(salePrice(item))}</p>
    <form id="quick-add-form" class="customer-info">
      <label>Tamanho<select name="size" required>${item.sizes.length > 1 ? '<option value="">Selecione</option>' : ''}${options(item.sizes)}</select></label>
      <label>Cor<select name="color" required>${item.colors.length > 1 ? '<option value="">Selecione</option>' : ''}${options(item.colors)}</select></label>
      <p id="quick-add-status" role="status">${escapeHtml(error)}</p>
      <button class="btn">Adicionar à sacola</button>
    </form>`);
  $('#quick-add-form').onsubmit = async event => {
    event.preventDefault();
    const {size, color} = event.currentTarget.elements;
    const message = await addToBag(item, size.value, color.value);
    if (message && $('#quick-add-status')) $('#quick-add-status').textContent = message;
  };
}
function collection() {
  const page = $('#collection-page');
  if (!page) return;
  const query = searchTerm.toLocaleLowerCase('pt-BR');
  const visible = collectionProducts.filter(item => (!categoryId || categoryId === item.category) && item.name.toLocaleLowerCase('pt-BR').includes(query));
  page.innerHTML = `<h1>Nossa coleção</h1>
    <div class="filters" aria-label="Categorias">${[{id:0,name:'Todos'}, ...categories].map(categoryButton).join('')}</div>
    ${searchTerm ? `<p>Resultados para “${escapeHtml(searchTerm)}” · <a href="colecao.html">Limpar busca</a></p>` : ''}
    <div class="products">${visible.map(productCard).join('') || '<p>Nenhuma peça encontrada.</p>'}</div>`;
  const active = page.querySelector(`[data-category="${categoryId}"]`);
  active.classList.add('active');
  active.setAttribute('aria-pressed', 'true');
  $('#search').value = searchTerm;
}
function openCollection(category = 0, search = '') {
  const url = new URL('colecao.html', location.href);
  if (category) url.searchParams.set('categoria', category);
  if (search) url.searchParams.set('busca', search);
  location.assign(url);
}
function detail(id) { location.assign('produto.html?id=' + id); }
function showBag() {
  const rows = bag.map((row, index) => {
    const item = products.find(product => product.id === row.id && product.sizes.includes(row.size));
    const limit = item ? Math.min(99, stockFor(item, row.size, row.color || 'Única')) : 0;
    return {...row, item, index, limit};
  });
  const invalid = rows.some(row => !row.item);
  const changed = rows.some(row => row.item && salePrice(row.item) !== row.price);
  const subtotal = rows.reduce((sum, row) => sum + (row.item ? salePrice(row.item) : 0) * row.qty, 0);
  const message = ['Olá, Jujuquita! Gostaria de consultar este pedido:', ...rows.filter(row => row.item).map(row =>
    `${row.qty} × ${row.item.name} (tamanho ${row.size}) · ${money(salePrice(row.item) * row.qty)}`), `Subtotal: ${money(subtotal)}`, 'Pode confirmar disponibilidade, frete e pagamento?'].join('\n');
  const number = /^[1-9]\d{9,14}$/.test(catalog.whatsapp) ? catalog.whatsapp : '';
  modal(`<h2>Sua sacola</h2>${rows.map(row => `<div class="bag-row"><div><strong>${escapeHtml(row.item?.name || 'Peça indisponível')}</strong><br>Tamanho ${escapeHtml(row.size)} · ${row.qty} un. ${row.item ? '· ' + money(salePrice(row.item) * row.qty) : ''}</div><div>${row.item ? `<button data-qty="${row.index}" data-step="-1" aria-label="Diminuir quantidade">−</button><button data-qty="${row.index}" data-step="1" aria-label="Aumentar quantidade" ${row.qty >= row.limit ? 'disabled' : ''}>+</button>` : ''}<button data-remove="${row.index}">Remover</button></div></div>`).join('') || '<p>Sua sacola está vazia.</p>'}
    ${rows.length ? `<p class="bag-subtotal"><strong>Subtotal ${money(subtotal)}</strong></p>` : ''}
    ${invalid ? '<p>Remova os itens indisponíveis para continuar.</p>' : ''}
    ${changed ? '<p>Um preço mudou. Revise o subtotal atualizado.</p>' : ''}
    ${rows.length && !invalid ? `<details><summary>Prévia do pedido</summary><p class="order-preview">${escapeHtml(message)}</p></details>
      ${number ? `<p><a class="btn" href="https://wa.me/${number}?text=${encodeURIComponent(message)}" target="_blank" rel="noopener">Enviar pedido pelo WhatsApp</a></p>` : '<p>O WhatsApp da loja ainda não foi configurado.</p>'}` : ''}
    <button class="outline" data-collection>Continuar comprando</button>`);
}
if ($('#categories')) $('#categories').innerHTML = categories.map(item => `<button class="category" data-category="${item.id}" aria-label="${escapeHtml(item.name)}">${picture(item)}${item.show_name === false && item.image ? '' : `<span class="category-label">${escapeHtml(item.name)}</span>`}</button>`).join('');
document.querySelectorAll('[data-category-menu]').forEach(menu => menu.innerHTML = categories.map(categoryButton).join(''));
const featuredIds = [...new Set(catalog.highlights.filter(item => item.active).map(item => item.product))];
const highlights = featuredIds.map(id => products.find(product => product.id === id)).filter(Boolean);
if ($('#highlights')) $('#highlights').innerHTML = highlights.length ? `<h2>Destaques</h2><div class="products featured-products">${highlights.map(productCard).join('')}</div>` : '';
document.addEventListener('click', async event => {
  const button = event.target.closest('button');
  if (!button) return;
  if (button.matches('[data-category]')) {
    openCollection(Number(button.dataset.category), button.closest('#collection-page') ? searchTerm : '');
  } else if (button.matches('[data-collection]')) {
    if ($('#collection-page')) dialog.close();
    else openCollection();
  } else if (button.dataset.quickAdd) {
    quickAdd(Number(button.dataset.quickAdd));
  } else if (button.dataset.product) {
    detail(Number(button.dataset.product));
  } else if (button.dataset.qty !== undefined || button.dataset.remove !== undefined) {
    const index = Number(button.dataset.qty ?? button.dataset.remove);
    const next = structuredClone(bag);
    const row = next[index];
    if (!row) return;
    const item = products.find(product => product.id === row.id);
    const change = Number(button.dataset.step);
    if (change > 0 && (!item || row.qty >= stockFor(item, row.size, row.color || 'Única'))) return;
    if (button.dataset.remove !== undefined || (row.qty === 1 && change === -1)) next.splice(index, 1);
    else row.qty = Math.min(99, row.qty + change);
    try { await persistBag(next); }
    catch { alert('Não foi possível atualizar a sacola. Tente novamente.'); return; }
    showBag();
  }
});
$('.close').onclick = () => dialog.close();
$('#bag').onclick = showBag;
$('#search').addEventListener('keydown', event => {
  if (event.key !== 'Enter') return;
  openCollection(0, event.currentTarget.value.trim());
});
document.querySelectorAll('.contact').forEach(button => button.onclick = () => {
  const number = catalog.whatsapp;
  modal(/^[1-9]\d{9,14}$/.test(number) ? `<h2>Fale com a Jujuquita</h2><a class="btn" href="https://wa.me/${number}" target="_blank" rel="noopener">Abrir WhatsApp</a>` : '<h2>Fale com a Jujuquita</h2><p>O WhatsApp da loja ainda não foi configurado.</p>');
});
const instagram = /^https:\/\/(?:www\.)?instagram\.com\/[\w.]+\/?$/i.test(catalog.settings.instagram) ? catalog.settings.instagram : '';
document.querySelectorAll('[data-instagram]').forEach(link => {
  if (!instagram) return;
  link.href = instagram;
  link.hidden = false;
});
if ($('#about')) $('#about').onclick = () => modal(`<h2>Um universo de carinho</h2><p>Moda infantil para acompanhar cada descoberta.</p>${instagram ? `<a class="btn" href="${escapeHtml(instagram)}" target="_blank" rel="noopener">Conheça nosso perfil no Instagram</a>` : ''}`);
const policy = document.querySelector('[data-store-policies]');
if (policy) {
  const details = [['delivery', 'Entrega'], ['payment', 'Pagamento'], ['returns', 'Trocas']]
    .filter(([field]) => catalog.settings[field]);
  if (details.length) policy.innerHTML = details.map(([field, label]) =>
    `<p><strong>${label}</strong><br>${escapeHtml(catalog.settings[field])}</p>`).join('');
}
collection();
updateBagCount();

const categoryRail = $('#categories');
if (categoryRail) enableCategoryRail(categoryRail);
function enableCategoryRail(categoryRail) {
let drag = null;
let suppressClick = false;
let direction = 1;
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
categoryRail.addEventListener('pointerdown', event => {
  suppressClick = false;
  if (event.pointerType !== 'mouse' || event.button !== 0 ||
      categoryRail.scrollWidth <= categoryRail.clientWidth) return;
  event.preventDefault();
  drag = {id:event.pointerId, x:event.clientX, left:categoryRail.scrollLeft};
});
categoryRail.addEventListener('pointermove', event => {
  if (!drag || drag.id !== event.pointerId) return;
  const delta = event.clientX - drag.x;
  if (!suppressClick && Math.abs(delta) < 6) return;
  if (!suppressClick) {
    suppressClick = true;
    categoryRail.setPointerCapture(event.pointerId);
    categoryRail.classList.add('dragging');
  }
  categoryRail.scrollLeft = drag.left - delta;
});
function finishCategoryDrag() {
  drag = null;
  categoryRail.classList.remove('dragging');
}
window.addEventListener('pointerup', finishCategoryDrag);
categoryRail.addEventListener('pointercancel', finishCategoryDrag);
categoryRail.addEventListener('dragstart', event => event.preventDefault());
categoryRail.addEventListener('click', event => {
  if (!suppressClick || event.detail === 0) return;
  suppressClick = false;
  event.preventDefault();
  event.stopPropagation();
}, true);
setInterval(() => {
  const limit = categoryRail.scrollWidth - categoryRail.clientWidth;
  if (limit < 2 || drag || document.hidden || dialog.open || reducedMotion.matches ||
      categoryRail.matches(':hover, :focus-within')) return;
  const bounds = categoryRail.getBoundingClientRect();
  if (bounds.bottom <= 0 || bounds.top >= window.innerHeight) return;
  const position = categoryRail.scrollLeft;
  if (position >= limit - 2) direction = -1;
  else if (position <= 2) direction = 1;
  const step = categoryRail.firstElementChild.getBoundingClientRect().width + 12;
  categoryRail.scrollTo({left:Math.max(0, Math.min(limit, position + step * direction)), behavior:'smooth'});
}, 3200);
}
