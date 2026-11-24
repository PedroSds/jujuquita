let catalog = initialCatalog;
let tab = 'overview';
let selected = null;
let previousCatalog;
let editorBusy = false;
const titles = {overview:'Visão geral', categories:'Categorias', products:'Produtos', highlights:'Destaques', settings:'Configurações'};
const descriptions = {
  overview:'Acompanhe seu catálogo e prepare a vitrine para receber pedidos.',
  categories:'Organize as peças para facilitar a navegação na loja.',
  products:'Gerencie fotos, preços, tamanhos e publicação das peças.',
  highlights:'Escolha quais produtos publicados aparecem na página inicial, mesmo com a categoria em rascunho.',
  settings:'Configure como a loja recebe os pedidos.'
};
const singular = {categories:'categoria', products:'produto', highlights:'destaque'};
const $admin = selector => document.querySelector(selector);
const editor = document.querySelector('#editor');
const adminIcon = name => `<svg class="icon" aria-hidden="true"><use href="#icon-${name}"></use></svg>`;
document.querySelectorAll('.sidebar [data-tab], .mobile-nav [data-tab]').forEach(button => {
  button.insertAdjacentHTML('afterbegin', adminIcon(button.dataset.tab));
});
const mobileMenu = $admin('#mobile-menu');
document.addEventListener('click', event => {
  if (mobileMenu.open && !mobileMenu.contains(event.target)) mobileMenu.open = false;
});
mobileMenu.addEventListener('keydown', event => {
  if (event.key !== 'Escape') return;
  mobileMenu.open = false;
  mobileMenu.querySelector('summary').focus();
});
function nextRecordId(data, kind) {
  return data[kind].reduce((highest, record) => Math.max(highest, record.id), Date.now()) + 1;
}
const status = document.querySelector('#status');
const editorDialog = $admin('#editor-dialog');
function report(message) {
  (editorDialog.open ? $admin('#form-status') : status).textContent = message;
}
let saving = false;
async function save(next, {edit, undo = false} = {}) {
  if (saving) { report('Aguarde o salvamento em andamento.'); return false; }
  saving = true;
  try {
    const before = catalog;
    if (edit) {
      const result = await database.saveCatalogEdit(next, before, edit);
      catalog = result.catalog;
      previousCatalog = result.before;
    } else {
      await database.saveCatalog(next);
      catalog = next;
      previousCatalog = undo ? null : before;
    }
    status.textContent = 'Alterações salvas.';
    return true;
  } catch (error) {
    report(error.message || 'Não foi possível salvar no Supabase.');
    return false;
  } finally { saving = false; }
}
function options(items, id) {
  return items.map(item => `<option value="${item.id}" ${item.id === id ? 'selected' : ''}>${escapeHtml(item.name)}</option>`).join('');
}
function draw() {
  const isCatalog = Boolean(singular[tab]);
  $admin('#title').textContent = titles[tab];
  $admin('#location').textContent = titles[tab];
  $admin('#description').textContent = descriptions[tab];
  document.querySelectorAll('.sidebar [data-tab], .mobile-nav [data-tab]').forEach(button => button.setAttribute('aria-pressed', button.dataset.tab === tab));
  mobileMenu.classList.toggle('selected', Boolean(mobileMenu.querySelector('[aria-pressed="true"]')));
  $admin('#settings').hidden = tab !== 'settings';
  $admin('#overview').hidden = tab !== 'overview';
  $admin('#list').hidden = !isCatalog;
  $admin('#create').hidden = !isCatalog || tab === 'highlights';
  const statusFilter = $admin('#publication');
  statusFilter.options[1].textContent = tab === 'highlights' ? 'Em destaque' : 'Publicados';
  statusFilter.options[2].textContent = tab === 'highlights' ? 'Fora dos destaques' : 'Rascunhos';
  if (tab === 'overview') {
    const firstStep = catalog.categories.length ? 'products' : 'categories';
    $admin('#overview').innerHTML = `<section class="overview-hero"><div><h2>${firstStep === 'categories' ? 'Comece pelo catálogo' : 'Cadastrar nova peça'}</h2><p>${firstStep === 'categories' ? 'Crie uma categoria para começar a cadastrar suas peças.' : 'Adicione fotos, preços e variações para publicar na vitrine.'}</p></div><button class="btn" data-new="${firstStep}">${firstStep === 'categories' ? 'Nova categoria' : 'Novo produto'}</button></section>
    <div class="metrics">${Object.keys(singular).map(key => `<button class="metric" data-tab="${key}"><span class="metric-icon">${adminIcon(key)}</span><span class="metric-name">${titles[key]}</span><strong>${catalog[key].length}</strong><small>${catalog[key].filter(item => item.active).length} ${key === 'highlights' ? 'selecionados' : 'com status publicado'}</small></button>`).join('')}</div>
    <div class="overview-links"><section class="panel overview-link">${adminIcon('orders')}<div><h2>Pedidos</h2><p>Consulte os pedidos preparados para WhatsApp.</p></div><button class="outline" data-tab="orders">Ver pedidos</button></section>
    <section class="panel overview-link">${adminIcon('settings')}<div><h2>WhatsApp da loja</h2><p>${catalog.whatsapp ? 'Número cadastrado para receber pedidos.' : 'Cadastre o número para receber pedidos.'}</p></div><button class="outline" data-tab="settings">Configurar</button></section></div>`;
  }
  if (isCatalog) {
    $admin('#create').textContent = (tab === 'categories' ? 'Nova ' : 'Novo ') + singular[tab];
    const categoryFilter = $admin('#category-filter');
    const selectedCategory = categoryFilter.value;
    categoryFilter.hidden = tab !== 'products';
    categoryFilter.innerHTML = '<option value="">Todas as categorias</option>' + options(catalog.categories, Number(selectedCategory));
    drawRecords();
  }
}
function drawRecords() {
  if (tab === 'highlights') {
    drawHighlightProducts();
    return;
  }
  const query = $admin('#filter').value.trim().toLocaleLowerCase('pt-BR');
  const publication = $admin('#publication').value;
  const category = $admin('#category-filter').value;
  const items = catalog[tab].filter(item => item.name.toLocaleLowerCase('pt-BR').includes(query) &&
    (!publication || item.active === (publication === 'active')) &&
    (tab !== 'products' || !category || item.category === Number(category)));
  $admin('#record-count').textContent = `${items.length} de ${catalog[tab].length} ${titles[tab].toLocaleLowerCase('pt-BR')}`;
  const empty = catalog[tab].length ? 'Nenhum cadastro corresponde aos filtros.' : tab === 'products' ? 'Nenhum produto cadastrado.' : 'Nenhuma categoria cadastrada.';
  $admin('#records').innerHTML = items.length ? `<div class="table-wrap"><table role="table"><thead><tr role="row"><th scope="col">${tab === 'products' ? 'Produto' : 'Nome'}</th><th scope="col">Status</th><th scope="col">Ações</th></tr></thead><tbody role="rowgroup">${items.map(record => `<tr role="row"><td role="cell">${recordName(record)}</td><td role="cell"><span class="badge ${record.active ? 'active' : ''}">${record.active ? 'Publicado' : 'Rascunho'}</span></td><td role="cell"><div class="row-actions"><button class="outline" data-edit="${record.id}" aria-label="Editar ${escapeHtml(record.name)}">Editar</button></div></td></tr>`).join('')}</tbody></table></div>` : `<p class="empty">${empty}</p>`;
}
function drawHighlightProducts() {
  const query = $admin('#filter').value.trim().toLocaleLowerCase('pt-BR');
  const publication = $admin('#publication').value;
  const featured = new Set(catalog.highlights.filter(item => item.active).map(item => item.product));
  const products = catalog.products.filter(item => item.name.toLocaleLowerCase('pt-BR').includes(query) &&
    (!publication || featured.has(item.id) === (publication === 'active')));
  $admin('#record-count').textContent = `${products.length} de ${catalog.products.length} produtos`;
  $admin('#records').innerHTML = products.length ? `<div class="table-wrap highlights-table"><table role="table"><thead><tr role="row"><th scope="col">Produto</th><th scope="col">Na página inicial</th></tr></thead><tbody role="rowgroup">${products.map(item => {
    const photo = item.image || item.box ? picture(item) : '<span>Sem foto</span>';
    return `<tr role="row"><td role="cell"><div class="product-record"><div class="photo-preview product-thumb" aria-hidden="true">${photo}</div><div><strong>${escapeHtml(item.name)}</strong><br><small>${money(item.price)}${item.active ? '' : ' · Aguardando publicação'}</small></div></div></td><td role="cell"><label class="highlight-toggle"><input type="checkbox" data-highlight="${item.id}" ${featured.has(item.id) ? 'checked' : ''} aria-label="Destacar ${escapeHtml(item.name)}"> Em destaque</label></td></tr>`;
  }).join('')}</tbody></table></div>` : '<p class="empty">Nenhum produto encontrado com esses filtros.</p>';
}
function recordName(record) {
  const name = escapeHtml(record.name);
  if (tab === 'highlights') return `<strong>${name}</strong>`;
  const category = catalog.categories.find(item => item.id === record.category);
  const photo = record.image || record.box ? picture(record) : '<span>Sem foto</span>';
  const details = tab === 'products' ? `<br><small>${money(record.price)} · ${escapeHtml(category?.name || 'Sem categoria')}</small>` : '';
  return `<div class="product-record"><div class="photo-preview product-thumb" aria-hidden="true">${photo}</div><div><strong>${name}</strong>${details}</div></div>`;
}
function openEditor(id = null) {
  delete editor.dataset.cover;
  selected = id;
  const items = catalog[tab];
  const item = items.find(record => record.id === selected) || {};
  const name = `<label>${tab === 'products' ? 'Nome do produto' : 'Nome'}<input name="name" required maxlength="100" value="${escapeHtml(item.name)}"></label>`;
  const photo = `<section class="photo-field" aria-label="Foto do cadastro">
      <div id="photo-preview" class="photo-preview">${item.image || item.box ? picture(item) : '<span>Sem foto</span>'}</div>
      <div><strong>Foto da vitrine</strong><p id="photo-status">${item.image || item.box ? 'Imagem atual do cadastro' : 'Adicione uma imagem para este cadastro.'}</p>
      <label class="outline photo-picker">${item.image || item.box ? 'Trocar foto' : 'Escolher foto'}<input name="image" type="file" accept="image/png,image/jpeg,image/webp"></label>
      <small>PNG, JPEG ou WebP · até 500 KB</small></div></section>`;
  const publication = `<label class="switch"><span><input name="active" type="checkbox" ${item.active ? 'checked' : ''}> Publicar na vitrine</span></label>`;
  const product = tab === 'products';
  editorDialog.classList.toggle('product-editor', product);
  editor.innerHTML = `<div class="editor-heading"><h2 id="editor-title">${selected ? 'Editar ' + singular[tab] : $admin('#create').textContent}</h2>${selected || product ? `<span class="badge ${item.active ? 'active' : ''}">${item.active ? 'Publicado' : 'Rascunho'}</span>` : ''}</div>
    ${product ? productFields(item, name, photo, publication) : name + (tab === 'highlights' ? `<label>Produto<select name="product" required><option value="">Selecione</option>${options(catalog.products, item.product)}</select></label>` : photo) + publication}
    <div class="form-actions editor-save"><p class="form-status" id="form-status" role="alert"></p><button type="button" class="outline" id="cancel">Cancelar</button><button class="btn">${product ? 'Salvar produto' : 'Salvar'}</button></div>`;
  editorDialog.setAttribute('aria-labelledby', 'editor-title');
  editorDialog.showModal();
  enhanceEditor(item);
}
let previewUrl;
editorDialog.addEventListener('close', () => {
  if (previewUrl) URL.revokeObjectURL(previewUrl);
  previewUrl = undefined;
});
editor.addEventListener('change', event => {
  if (event.target.name !== 'image') return;
  const file = event.target.files[0];
  if (!file) return;
  if (!validPhoto(file)) {
    event.target.value = '';
    const item = catalog[tab].find(record => record.id === selected);
    $admin('#photo-preview').innerHTML = item?.image || item?.box ? picture(item) : '<span>Sem foto</span>';
    $admin('#photo-status').textContent = item?.image || item?.box ? 'Imagem atual do cadastro' : 'Adicione uma imagem para este cadastro.';
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    previewUrl = undefined;
    report('Use uma foto PNG, JPEG ou WebP de até 500 KB.');
    return;
  }
  if (previewUrl) URL.revokeObjectURL(previewUrl);
  previewUrl = URL.createObjectURL(file);
  const image = document.createElement('img');
  image.alt = 'Prévia da nova foto';
  image.src = previewUrl;
  $admin('#photo-preview').replaceChildren(image);
  $admin('#photo-status').textContent = 'Nova foto · será aplicada ao salvar';
  report('');
});
function validPhoto(file) {
  return ['image/png','image/jpeg','image/webp'].includes(file.type) && file.size <= 500000;
}
document.addEventListener('click', event => {
  const button = event.target.closest('button');
  if (!button) return;
  const destination = button.dataset.tab || button.dataset.new;
  if (destination) {
    const fromMobile = Boolean(button.closest('.mobile-nav'));
    tab = destination;
    mobileMenu.open = false;
    status.textContent = '';
    $admin('#filter').value = '';
    $admin('#publication').value = '';
    $admin('#category-filter').value = '';
    draw();
    if (button.dataset.new) openEditor();
    else if (fromMobile) {
      $admin('#title').focus({preventScroll:true});
      window.scrollTo(0, 0);
    }
  }
  if (button.dataset.edit) openEditor(Number(button.dataset.edit));
  if (button.id === 'create') openEditor();
  if (button.id === 'cancel' && !editorBusy && (!editorDirty || confirm('Descartar as alterações deste cadastro?'))) editorDialog.close();
});
$admin('#filter').addEventListener('input', drawRecords);
$admin('#publication').addEventListener('change', drawRecords);
$admin('#category-filter').addEventListener('change', drawRecords);
$admin('#records').addEventListener('change', async event => {
  const checkbox = event.target;
  if (!checkbox.matches('[data-highlight]')) return;
  const product = catalog.products.find(item => item.id === Number(checkbox.dataset.highlight));
  if (!product) return;
  const next = structuredClone(catalog);
  const matches = next.highlights.filter(item => item.product === product.id);
  matches.forEach((item, index) => { item.active = checkbox.checked && index === 0; });
  if (checkbox.checked && !matches.length) {
    next.highlights.push({id:nextRecordId(next, 'highlights'), product:product.id, name:product.name, active:true});
  }
  if (!await save(next)) checkbox.checked = !checkbox.checked;
  else {
    drawRecords();
    $admin(`[data-highlight="${product.id}"]`)?.focus();
  }
});
editor.addEventListener('invalid', () => report('Confira os campos indicados antes de salvar.'), true);
editor.addEventListener('submit', async event => {
  event.preventDefault();
  if (editorBusy) return;
  report('');
  const form = new FormData(editor);
  const kind = tab;
  const next = structuredClone(catalog);
  const items = next[kind];
  const existing = items.find(item => item.id === selected);
  const item = {...existing, id: existing?.id ?? nextRecordId(next, kind),
    name: form.get('name').trim(), active: form.has('active')};
  if (!item.name) { report('Informe um nome.'); return; }
  if (kind === 'products') {
    item.category = Number(form.get('category'));
    item.description = form.get('description').trim();
    try { extendProduct(item, form); } catch (error) { report(error.message); return; }
  }
  if (kind === 'highlights') item.product = Number(form.get('product'));
  const file = form.get('image');
  if (file?.size && !validPhoto(file)) { report('Use uma foto PNG, JPEG ou WebP de até 500 KB.'); return; }
  const button = editor.querySelector('.editor-save .btn');
  const cancel = $admin('#cancel');
  const label = button.textContent;
  editorBusy = true;
  button.disabled = true;
  cancel.disabled = true;
  button.textContent = 'Salvando…';
  try {
    if (file?.size) {
      try { item.image = await readPhoto(file); }
      catch { report('Não foi possível carregar a foto.'); return; }
    }
    if (existing) items[items.indexOf(existing)] = item;
    else items.push(item);
    if (await save(next, {edit:{kind,id:item.id}})) { editorDialog.close(); draw(); }
  } finally {
    editorBusy = false;
    cancel.disabled = false;
    button.disabled = false;
    button.textContent = label;
  }
});
function readPhoto(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.onabort = reject;
    reader.readAsDataURL(file);
  });
}
const settings = document.querySelector('#settings');
settings.elements.whatsapp.value = catalog.whatsapp;
settings.addEventListener('submit', async event => {
  event.preventDefault();
  const whatsapp = settings.elements.whatsapp.value.replace(/\D/g, '');
  if (whatsapp && !/^[1-9]\d{9,14}$/.test(whatsapp)) {
    status.textContent = 'Informe o número com DDI e DDD.'; return;
  }
  const information = Object.fromEntries([...new FormData(settings)].filter(([key]) => key.startsWith('setting-')).map(([key,value]) => [key.slice(8),value.trim()]));
  await save({...catalog, whatsapp, settings:{...catalog.settings,...information}});
});
draw();
