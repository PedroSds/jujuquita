let editorDirty = false;
let galleryDraft = [];
let productOptions;
const optionLabels = {sizes:'Tamanhos', colors:'Cores'};
const defaultOptions = {sizes:'Único', colors:'Única'};
const variantKey = (size, color) => JSON.stringify([size, color]);

function productFields(item, name, photo, publication) {
  const priceField = (field, label, value, required = '') =>
    `<label>${label}<input name="${field}" inputmode="decimal" maxlength="8" placeholder="0,00" ${required} value="${value ? (value / 100).toFixed(2).replace('.', ',') : ''}"></label>`;
  return `<section class="editor-section"><h3>Informações do produto</h3>
    <div class="editor-columns">${name}<label>Categoria<select name="category" required><option value="">Selecione uma categoria</option>${options(catalog.categories, item.category)}</select>
      ${catalog.categories.length ? '' : '<small>Crie uma categoria no menu Categorias antes de salvar.</small>'}</label></div>
    <label>Descrição <small>Opcional</small><textarea name="description" rows="3" maxlength="1000">${escapeHtml(item.description)}</textarea></label>
  </section>
  <section class="editor-section"><h3>Preços</h3><div class="editor-columns">
    ${priceField('price','Preço de venda (R$)',item.price,'required')}
    ${priceField('promotion','Preço promocional (R$)',item.promotion)}
    </div><small>Deixe o preço promocional em branco se o produto estiver sem desconto.</small>
  </section>
  <section class="editor-section"><h3>Fotos do produto</h3>${photo}</section>
  <section class="editor-section"><h3>Variações e estoque</h3>
    <div class="editor-columns">${Object.entries(optionLabels).map(([key,label]) => `<div class="variant-option">
      <label for="product-${key}">${label}</label>
      <div class="variant-options" data-options="${key}"></div>
      <div class="variant-add"><input id="product-${key}" maxlength="40" placeholder="${key === 'sizes' ? 'Ex.: P, M, 4 anos' : 'Ex.: Rosa, Azul'}"><button type="button" class="outline" data-add-option="${key}" aria-label="Adicionar ${key === 'sizes' ? 'tamanho' : 'cor'}">Adicionar</button></div>
    </div>`).join('')}</div>
    <label class="switch"><span><input name="track-stock" type="checkbox" ${item.stock != null || item.variants?.length ? 'checked' : ''}> Controlar estoque</span></label>
    <div class="stock-fields"><label>Estoque padrão por variação<input name="stock" type="number" min="0" max="2147483647" step="1" placeholder="Sem limite" value="${item.stock ?? ''}"></label>
      <div class="variant-table"><table><thead><tr><th scope="col">Tamanho</th><th scope="col">Cor</th><th scope="col">Estoque específico</th></tr></thead><tbody></tbody></table></div>
      <small>Deixe uma combinação em branco para usar o estoque padrão. Digite 0 para marcar como esgotada.</small></div>
  </section>
  <details class="editor-section"><summary>Detalhes opcionais</summary>
    <label>Código do produto (SKU)<input name="sku" placeholder="Gerado automaticamente" value="${escapeHtml(item.sku)}"></label>
    <label>Guia de medidas<input name="measurements" value="${escapeHtml(item.measurements)}"></label>
    <label>Tecido e cuidados<input name="care" value="${escapeHtml(item.care)}"></label>
  </details>
  <section class="editor-section"><h3>Visibilidade</h3>${publication}<small>Deixe desmarcado para salvar como rascunho.</small></section>`;
}

function captureStock() {
  editor.querySelectorAll('[data-variant-stock]').forEach(input => {
    const key = input.dataset.variantStock;
    if (input.value === '') productOptions.stock.delete(key);
    else productOptions.stock.set(key, input.value);
  });
}

function renderProductOptions() {
  for (const [key, label] of Object.entries(optionLabels)) {
    const values = productOptions[key];
    editor.querySelector(`[data-options="${key}"]`).innerHTML = values.length ? values.map((value, index) =>
      `<span class="variant-chip">${escapeHtml(value)}<button type="button" data-remove-option="${key}" data-index="${index}" aria-label="Remover ${escapeHtml(value)}">×</button></span>`).join('') :
      `<small>${label}: ${defaultOptions[key]}</small>`;
  }
  const sizes = productOptions.sizes.length ? productOptions.sizes : [defaultOptions.sizes];
  const colors = productOptions.colors.length ? productOptions.colors : [defaultOptions.colors];
  editor.querySelector('.variant-table tbody').innerHTML = sizes.flatMap(size => colors.map(color => {
    const key = variantKey(size, color);
    return `<tr><th scope="row">${escapeHtml(size)}</th><td>${escapeHtml(color)}</td><td><input type="number" min="0" max="2147483647" step="1" placeholder="Padrão" aria-label="Estoque de ${escapeHtml(size)} / ${escapeHtml(color)}" data-variant-stock="${escapeHtml(key)}" value="${escapeHtml(productOptions.stock.get(key))}"></td></tr>`;
  })).join('');
  updateStockFields();
}

function updateStockFields() {
  const enabled = editor.elements['track-stock'].checked;
  const fields = editor.querySelector('.stock-fields');
  fields.hidden = !enabled;
  fields.querySelectorAll('input').forEach(input => { input.disabled = !enabled; });
}

function addProductOptions(key) {
  const input = editor.querySelector('#product-' + key);
  const values = input.value.split(',').map(value => value.trim()).filter(Boolean);
  if (!values.length) return;
  captureStock();
  for (const value of values) {
    if (!productOptions[key].some(existing => normalizeSearch(existing) === normalizeSearch(value))) productOptions[key].push(value);
  }
  input.value = '';
  editorDirty = true;
  renderProductOptions();
}

function prepareProductOptions(item) {
  productOptions = {
    sizes:[...(item.sizes || [])], colors:[...(item.colors || [])],
    stock:new Map((item.variants || []).map(({size,color,stock}) => [variantKey(size,color), stock]))
  };
  for (const key of Object.keys(optionLabels)) {
    const input = editor.querySelector('#product-' + key);
    input.onkeydown = event => {
      if (event.key !== 'Enter') return;
      event.preventDefault();
      addProductOptions(key);
    };
    editor.querySelector(`[data-add-option="${key}"]`).onclick = () => { addProductOptions(key); input.focus(); };
    editor.querySelector(`[data-options="${key}"]`).onclick = event => {
      const button = event.target.closest('[data-remove-option]');
      if (!button) return;
      captureStock();
      productOptions[key].splice(Number(button.dataset.index), 1);
      editorDirty = true;
      renderProductOptions();
      input.focus();
    };
  }
  editor.elements['track-stock'].onchange = updateStockFields;
  renderProductOptions();
}
editor.addEventListener('input', () => { editorDirty = true; });
window.addEventListener('beforeunload', event => {
  if (editorDialog.open && editorDirty) { event.preventDefault(); event.returnValue = ''; }
});
editorDialog.addEventListener('cancel', event => {
  event.preventDefault();
  closeEditor();
});
function confirmHideCategory(plural = false) {
  return confirmAction({
    title:plural ? 'Retirar categorias da vitrine?' : 'Retirar categoria da vitrine?',
    description:'As peças saem da coleção. Os produtos publicados em destaque continuam na página inicial.',
    label:plural ? 'Retirar categorias' : 'Retirar categoria'
  });
}
function enhanceEditor(item) {
  editorDirty = false;
  if (item.id) {
    editor.querySelector('.editor-save').insertAdjacentHTML('beforebegin', '<div class="form-actions"><button type="button" class="outline" id="duplicate">Duplicar</button>' + (tab === 'products' ? '' : '<button type="button" class="outline" id="archive">' + (item.active ? 'Retirar da vitrine' : 'Publicar cadastro') + '</button>') + '</div>');
    $admin('#duplicate').onclick=async()=>{
      if(editorBusy)return;
      const next=structuredClone(catalog), copy=structuredClone(item);
      copy.id=nextRecordId(next, tab);
      copy.name+=' (cópia)'; copy.active=false;
      if(tab==='products')copy.sku='JUJU-'+copy.id;
      next[tab].push(copy);
      if(await save(next)){editorDialog.close();draw();openEditor(copy.id);}
    };
    const archive = $admin('#archive');
    if (archive) archive.onclick=async()=>{
      if(editorBusy)return;
      if(tab==='categories' && item.active && !await confirmHideCategory())return;
      const next=structuredClone(catalog);
      next[tab].find(record=>record.id===item.id).active=!item.active;
      if(await save(next)){editorDialog.close();draw();}
    };
  }
  if (tab === 'categories') {
    editor.insertAdjacentHTML('beforeend', '<p>Ao retirar esta categoria da vitrine, seus produtos saem da coleção. Os destaques publicados continuam na página inicial.</p>');
    return;
  }
  if (tab !== 'products') return;
  galleryDraft = [...(item.gallery || [])];
  prepareProductOptions(item);
  editor.elements.active.onchange = () => {
    const badge = editor.querySelector('.editor-heading .badge');
    badge.classList.toggle('active', editor.elements.active.checked);
    badge.textContent = editor.elements.active.checked ? 'Publicado ao salvar' : 'Rascunho';
  };
  editor.querySelector('.photo-field').insertAdjacentHTML('afterend',
    '<section class="product-gallery-field"><h3>Outros ângulos do produto</h3><p>Adicione até 4 fotos além da principal. Você pode selecionar várias de uma vez.</p><label class="outline photo-picker">Adicionar fotos<input id="gallery-upload" type="file" multiple accept="image/png,image/jpeg,image/webp" aria-label="Adicionar fotos do produto"></label><small>PNG, JPEG ou WebP · até 500 KB por foto</small><div id="gallery-editor"></div><p id="gallery-status" role="status"></p></section>');
  renderGallery();
  $admin('#gallery-upload').onchange = async event => {
    if (editorBusy) return;
    const files = [...event.target.files];
    if (files.length + galleryDraft.length > 4 || files.some(file => !validPhoto(file))) {
      report('Escolha até 4 fotos de no máximo 500 KB cada.');
      event.target.value = '';
      return;
    }
    const saveButton=editor.querySelector('.editor-save .btn');
    const cancel=$admin('#cancel');
    editorBusy=true;
    saveButton.disabled=true;
    cancel.disabled=true;
    $admin('#gallery-status').textContent='Carregando fotos…';
    try {
      const images = await Promise.all(files.map(readPhoto));
      galleryDraft = [...new Set([...galleryDraft,...images])];
      editorDirty = true;
      renderGallery();
      report('');
    } catch { report('Não foi possível carregar as imagens.'); }
    finally { editorBusy=false; cancel.disabled=false; saveButton.disabled=false; event.target.value=''; }
  };
}
function renderGallery() {
  $admin('#gallery-editor').innerHTML = galleryDraft.map((image,index) =>
    `<div><img src="${escapeHtml(image)}" alt="Foto adicional ${index+1}" width="64"><button type="button" data-cover="${index}">Usar como capa</button>${index > 0 ? `<button type="button" data-photo-first="${index}">Mover para o início</button>` : ''}<button type="button" data-photo-remove="${index}">Remover foto</button></div>`).join('');
  $admin('#gallery-status').textContent=galleryDraft.length ? galleryDraft.length + ' foto(s) adicional(is). Salve o produto para aplicar.' : 'As fotos adicionais aparecerão na galeria do produto.';
}
document.addEventListener('click', event => {
  if (editorBusy) return;
  const button = event.target.closest('button');
  if (!button) return;
  if (button.dataset.photoRemove !== undefined) { galleryDraft.splice(Number(button.dataset.photoRemove),1); editorDirty=true; renderGallery(); }
  if (button.dataset.photoFirst !== undefined) {
    galleryDraft.unshift(galleryDraft.splice(Number(button.dataset.photoFirst),1)[0]);
    editorDirty=true;
    renderGallery();
  }
  if (button.dataset.cover !== undefined) {
    const index=Number(button.dataset.cover);
    const previous=editor.dataset.cover || catalog.products.find(item=>item.id===selected)?.image;
    const chosen=galleryDraft[index];
    if(previous && previous !== chosen)galleryDraft[index]=previous;
    else galleryDraft.splice(index,1);
    editor.dataset.cover = chosen;
    editor.elements.image.value='';
    $admin('#photo-preview').innerHTML = picture({name:'Nova capa',image:editor.dataset.cover});
    $admin('#photo-status').textContent = 'Nova capa · será aplicada ao salvar';
    editorDirty=true;
    renderGallery();
  }
});
function extendProduct(item, form) {
  const readPrice = (field, label) => {
    const value = form.get(field).trim();
    if (!/^\d{1,5}([.,]\d{1,2})?$/.test(value)) {
      const input = editor.elements[field];
      input.focus();
      throw Error(`Informe ${label} no formato 89,90.`);
    }
    return Math.round(Number(value.replace(',', '.')) * 100);
  };
  item.price = readPrice('price','o preço de venda');
  if (item.price <= 0) {
    editor.elements.price.focus();
    throw Error('O preço de venda deve ser maior que zero.');
  }
  item.promotion = form.get('promotion').trim() ? readPrice('promotion','o preço promocional') : null;
  if (item.promotion !== null && (item.promotion <= 0 || item.promotion >= item.price)) {
    editor.elements.promotion.focus();
    throw Error('O preço promocional deve ser maior que zero e menor que o preço de venda.');
  }
  for (const key of Object.keys(optionLabels)) {
    addProductOptions(key);
    item[key] = productOptions[key].length ? [...productOptions[key]] : [defaultOptions[key]];
  }
  item.sku = form.get('sku').trim() || 'JUJU-' + item.id;
  const tracked = form.has('track-stock');
  const stock = form.get('stock');
  item.stock = tracked && stock !== '' ? Number(stock) : null;
  item.measurements = form.get('measurements').trim();
  item.care = form.get('care').trim();
  item.gallery = [...galleryDraft];
  if (editor.dataset.cover) item.image = editor.dataset.cover;
  captureStock();
  item.variants = tracked ? [...productOptions.stock].flatMap(([key, quantity]) => {
    const [size,color] = JSON.parse(key);
    return item.sizes.includes(size) && item.colors.includes(color) ? [{size,color,stock:Number(quantity)}] : [];
  }) : [];
}
function enhanceSettings() {
  settings.insertAdjacentHTML('beforeend', '<h2>Informações da loja</h2>' +
    [['name','Nome da loja'],['instagram','Instagram'],['hours','Horário de atendimento'],['delivery','Entrega'],['payment','Pagamento'],['returns','Trocas']].map(([name,label]) =>
      `<label>${label}<input name="setting-${name}" value="${escapeHtml(catalog.settings[name])}"></label>`).join('') +
    '<h2>Backup local</h2><button type="button" class="outline" id="export">Baixar backup</button><label>Restaurar backup JSON<input id="import" type="file" accept=".json"></label>');
  $admin('#export').onclick = () => {
    const url = URL.createObjectURL(new Blob([JSON.stringify(catalog,null,2)],{type:'application/json'}));
    const link=document.createElement('a'); link.href=url; link.download='jujuquita-backup.json'; link.click(); setTimeout(()=>URL.revokeObjectURL(url),1000);
  };
  $admin('#import').onchange = async event => {
    try {
      const file = event.target.files[0];
      if (!file || file.size > 5000000) throw Error();
      const imported = JSON.parse(await file.text());
      if (!['products','categories','highlights'].every(key => Array.isArray(imported[key])) ||
          imported.products.some(item => !Number.isInteger(item.id) || typeof item.name !== 'string' || !Number.isInteger(item.price) || !Array.isArray(item.sizes)) ||
          imported.categories.some(item => !Number.isInteger(item.id) || typeof item.name !== 'string')) throw Error();
      if (!await confirmAction({
        title:'Restaurar este backup?',
        description:'Os produtos, categorias, destaques e configurações atuais serão substituídos pelos dados do arquivo.',
        label:'Restaurar backup',
        destructive:true
      })) return;
      if (await save(normalizeCatalog(imported))) {
        settings.elements.whatsapp.value = catalog.whatsapp || '';
        for (const [field,value] of Object.entries(catalog.settings)) {
          const input = settings.elements.namedItem('setting-' + field);
          if (input) input.value = value ?? '';
        }
        draw();
      }
    } catch { status.textContent='Backup inválido. Selecione um arquivo exportado pelo painel.'; }
    finally { event.target.value = ''; }
  };
}
enhanceSettings();
titles.security = 'Senha do painel';
descriptions.security = 'Alterar a senha de acesso à administração.';
const passwordForm = document.createElement('form');
passwordForm.className = 'panel form-panel';
passwordForm.hidden = true;
passwordForm.innerHTML = '<label>Senha atual<input name="current" type="password" required autocomplete="current-password"></label><label>Nova senha<input name="password" type="password" required minlength="12" autocomplete="new-password"></label><label>Repita a nova senha<input name="confirm" type="password" required autocomplete="new-password"></label><button class="btn">Alterar senha</button>';
$admin('#settings').after(passwordForm);
passwordForm.onsubmit = async event => {
  event.preventDefault();
  const fields = passwordForm.elements;
  if (fields.password.value !== fields.confirm.value) {
    status.textContent = 'As senhas novas precisam ser iguais.';
    return;
  }
  const button = passwordForm.querySelector('button');
  button.disabled = true;
  try {
    await database.password(fields.current.value, fields.password.value);
    passwordForm.reset();
    status.textContent = 'Senha atualizada.';
  } catch (error) { status.textContent = error.message; }
  finally { button.disabled = false; }
};
const originalDrawRecords = drawRecords;
drawRecords = () => {
  originalDrawRecords();
  const records=$admin('#records');
  if (tab === 'highlights') {
    records.querySelectorAll('[data-highlight]').forEach(input=>{
      const id=Number(input.dataset.highlight);
      if (catalog.highlights.some(item=>item.product===id)) {
        input.closest('td').insertAdjacentHTML('beforeend', ` <button type="button" class="outline delete-record" data-delete="${id}">Excluir destaque</button>`);
      }
    });
    records.insertAdjacentHTML('beforeend','<div class="toolbar"><button type="button" class="outline" id="undo-change">Desfazer última alteração</button></div>');
    return;
  }
  const table = records.querySelector('table');
  if (!table) {
    if (previousCatalog) records.insertAdjacentHTML('beforeend','<div class="toolbar bulk-toolbar"><button type="button" class="outline" id="undo-change">Desfazer última alteração</button></div>');
    return;
  }
  records.querySelectorAll('tbody tr').forEach(row=>{
    const id=Number(row.querySelector('[data-edit]').dataset.edit);
    const index=catalog[tab].findIndex(item=>item.id===id);
    row.querySelector('.row-actions').insertAdjacentHTML('beforeend', `<details class="record-actions"><summary class="outline" aria-label="Mais ações">${adminIcon('more')}</summary><div class="record-actions-panel">
      <button type="button" class="outline" data-move="${id}" data-step="-1" ${index === 0 ? 'disabled' : ''}>Mover para cima</button>
      <button type="button" class="outline" data-move="${id}" data-step="1" ${index === catalog[tab].length - 1 ? 'disabled' : ''}>Mover para baixo</button>
      <button type="button" class="outline delete-record" data-delete="${id}">Excluir</button></div></details>`);
    const cell=document.createElement('td');
    cell.setAttribute('role','cell');
    cell.innerHTML=`<label class="row-select"><input type="checkbox" data-bulk="${id}" aria-label="Selecionar ${escapeHtml(catalog[tab][index].name)}"></label>`;
    row.prepend(cell);
    row.draggable=true;
    row.ondragstart=event=>event.dataTransfer.setData('text/plain',id);
    row.ondragover=event=>event.preventDefault();
    row.ondrop=event=>{
      event.preventDefault();
      moveRecord(Number(event.dataTransfer.getData('text/plain')), index);
    };
  });
  table.querySelector('thead tr').insertAdjacentHTML('afterbegin','<th scope="col"><span class="sr-only">Seleção</span></th>');
  records.insertAdjacentHTML('afterbegin',`<div class="toolbar bulk-toolbar"><label><input type="checkbox" id="select-all"> Selecionar todos</label><div class="bulk-actions" hidden><button type="button" class="outline" data-bulk-action="publish">Publicar selecionados</button><button type="button" class="outline" data-bulk-action="hide">Retirar selecionados</button></div>${previousCatalog ? '<button type="button" class="outline" id="undo-change">Desfazer última alteração</button>' : ''}</div>`);
  const all=$admin('#select-all');
  const inputs=[...records.querySelectorAll('[data-bulk]')];
  const updateSelection=()=>{
    const total=inputs.filter(input=>input.checked).length;
    all.checked=total===inputs.length;
    all.indeterminate=total>0 && total<inputs.length;
    records.querySelector('.bulk-actions').hidden=total===0;
  };
  all.onchange=()=>{ inputs.forEach(input=>input.checked=all.checked); updateSelection(); };
  inputs.forEach(input=>{ input.onchange=updateSelection; });
};
async function moveRecord(id, end) {
  const kind=tab;
  const next=structuredClone(catalog), items=next[kind];
  const start=items.findIndex(item=>item.id===id);
  if(start<0 || end<0 || end>=items.length || start===end)return;
  items.splice(end,0,items.splice(start,1)[0]);
  if(await save(next) && tab===kind) {
    drawRecords();
    $admin(`[data-edit="${id}"]`)?.closest('.row-actions').querySelector('summary').focus();
  }
}
document.addEventListener('click',async event=>{
  if (confirmDialog.contains(event.target)) return;
  document.querySelectorAll('.record-actions[open]').forEach(menu=>{
    if(!menu.contains(event.target)) menu.open=false;
  });
  const button=event.target.closest('button');
  if(!button)return;
  if(button.dataset.move !== undefined) {
    const id=Number(button.dataset.move);
    return moveRecord(id,catalog[tab].findIndex(item=>item.id===id)+Number(button.dataset.step));
  }
  if(button.dataset.delete !== undefined) {
    const id=Number(button.dataset.delete);
    const record=tab==='highlights' ? catalog.products.find(item=>item.id===id) : catalog[tab].find(item=>item.id===id);
    if(!record)return;
    if(tab==='categories' && catalog.products.some(item=>item.category===id)){
      status.textContent='Mova os produtos vinculados para outra categoria antes de excluir.';
      return;
    }
    const heading = tab === 'highlights' ? 'Remover destaque?' : tab === 'products' ? 'Excluir produto?' : 'Excluir categoria?';
    const description = {
      highlights:`“${record.name}” sairá dos Destaques da página inicial. O produto continuará no catálogo.`,
      products:`“${record.name}” será removido do catálogo e da vitrine.`,
      categories:`“${record.name}” será removida da lista de categorias.`
    };
    if(!await confirmAction({
      title:heading,
      description:description[tab],
      label: tab === 'highlights' ? 'Remover destaque' : tab === 'products' ? 'Excluir produto' : 'Excluir categoria',
      destructive:true
    }))return;
    const next=structuredClone(catalog);
    const affected=tab==='products' ? ['products','highlights'] : [tab];
    affected.forEach(kind=>{
      next[kind]=next[kind].filter(item=> (kind==='highlights' ? item.product : item.id)!==id);
    });
    if(await save(next)){draw();status.textContent='Excluído. Você pode desfazer a última alteração.';}
    return;
  }
  if(button.id==='undo-change'){
    if(previousCatalog && await save(previousCatalog, {undo:true}))draw();
    return;
  }
  if(!button.dataset.bulkAction)return;
  const ids=[...document.querySelectorAll('[data-bulk]:checked')].map(input=>Number(input.dataset.bulk));
  if(!ids.length){status.textContent='Selecione pelo menos um cadastro.';return;}
  if(tab==='categories' && button.dataset.bulkAction==='hide' && !await confirmHideCategory(true))return;
  const next=structuredClone(catalog);
  next[tab].forEach(item=>{if(ids.includes(item.id))item.active=button.dataset.bulkAction==='publish';});
  if(await save(next))drawRecords();
});
titles.orders='Pedidos';
descriptions.orders='Mensagens preparadas para WhatsApp. Confirme o atendimento com a cliente.';
const baseDraw=draw;
draw=()=>{
  baseDraw();
  passwordForm.hidden = tab !== 'security';
  $admin('#orders-panel')?.remove();
  if(tab!=='orders')return;
  $admin('main').insertAdjacentHTML('beforeend','<section id="orders-panel" class="panel guide" role="status">Carregando pedidos…</section>');
  const panel = $admin('#orders-panel');
  database.orders().then(orders => {
    panel.innerHTML = orders.length ? orders.map(order => `<details><summary>${escapeHtml(order.id)} · ${escapeHtml(new Date(order.created_at).toLocaleString('pt-BR'))}</summary><p>Preparado para WhatsApp</p><pre style="white-space:pre-wrap">${escapeHtml(order.message)}</pre></details>`).join('') : '<p>Nenhum pedido preparado.</p>';
  }).catch(error => { panel.textContent = error.message; });

};
