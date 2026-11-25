function renderProductPage() {
  const page = $('#product-page');
  if (!page) return;
  const item = products.find(product => product.id === Number(params.get('id')));
  if (!item) { page.innerHTML='<h1>Produto indisponível</h1><a class="btn" href="colecao.html">Explorar coleção</a>'; return; }
  document.title = item.name + ' | Jujuquita';
  const images = [...new Set([item.image,...(item.gallery || [])].filter(Boolean))];
  page.innerHTML = `<p><a href="colecao.html">Nossa coleção</a> / ${escapeHtml(item.name)}</p><div class="product-page-grid">
    <div><div id="main-photo">${picture(item)}</div><div class="photo-thumbnails">${images.map((image,index)=>`<button data-gallery="${index}" aria-label="Ver foto ${index+1}">${picture({name:item.name,image})}</button>`).join('')}</div></div>
    <form id="product-form"><h1>${escapeHtml(item.name)}</h1>
    <p class="product-price">${item.promotion ? `<del>${money(item.price)}</del> ` : ''}${money(salePrice(item))}</p><p>${escapeHtml(item.description)}</p>
    <label>Tamanho<select name="size" required><option value="">Selecione</option>${item.sizes.map(size=>`<option>${escapeHtml(size)}</option>`).join('')}</select></label>
    <label>Cor<select name="color" required>${item.colors.map(color=>`<option>${escapeHtml(color)}</option>`).join('')}</select></label>
    <p id="availability" role="status">Escolha um tamanho.</p><button class="btn">Adicionar à sacola</button>
    <p id="product-feedback" role="status"></p>
    <details><summary>Guia de medidas</summary><p>${escapeHtml(item.measurements || 'Consulte as medidas com a loja.')}</p></details>
    <details><summary>Tecido e cuidados</summary><p>${escapeHtml(item.care || 'Consulte os detalhes com a loja.')}</p></details>
    ${['delivery','payment','returns'].map((key,index)=>`<details><summary>${['Entrega','Pagamento','Trocas'][index]}</summary><p>${escapeHtml(catalog.settings[key])}</p></details>`).join('')}</form></div>`;
  page.querySelectorAll('[data-gallery]').forEach(button=>button.onclick=()=>$('#main-photo').innerHTML=picture({name:item.name,image:images[Number(button.dataset.gallery)]}));
  const form=$('#product-form');
  form.onchange=()=>{
    const size=form.elements.size.value;
    const stock=size ? stockFor(item,size,form.elements.color.value) : 0;
    $('#availability').textContent = !size ? 'Escolha um tamanho.' : stock > 0 ? 'Disponível para pedido' : 'Variação esgotada';
    form.querySelector('button').disabled=!size || stock===0;
  };
  form.onchange();
  form.onsubmit=async event=>{
    event.preventDefault();
    const size=form.elements.size.value, color=form.elements.color.value;
    $('#product-feedback').textContent = await addToBag(item, size, color);
  };
}
function enhanceCollection() {
  const page=$('#collection-page');
  if (!page) return;
  const sizes=[...new Set(collectionProducts.flatMap(item=>item.sizes))];
  const colors=[...new Set(collectionProducts.flatMap(item=>item.colors))];
  const options=values=>values.map(value=>`<option>${escapeHtml(value)}</option>`).join('');
  page.querySelector('.products').insertAdjacentHTML('beforebegin',`<form id="catalog-filters" class="catalog-controls"><label>Tamanho<select name="size"><option value="">Todos</option>${options(sizes)}</select></label><label>Cor<select name="color"><option value="">Todas</option>${options(colors)}</select></label><label>Até R$<input name="max" type="number" min="0" step=".01" placeholder="Qualquer valor"></label><label>Ordenar<select name="sort"><option value="new">Novidades</option><option value="low">Menor preço</option><option value="high">Maior preço</option></select></label><button type="reset" class="outline">Limpar filtros</button></form><p id="catalog-count" aria-live="polite"></p>`);
  const controls=$('#catalog-filters');
  let limit=12;
  function update() {
    const state=new FormData(controls);
    const filtered=collectionProducts.filter(item=>(!categoryId || item.category===categoryId) &&
      matchesSearch(item,searchTerm) &&
      (!state.get('size') || item.sizes.includes(state.get('size'))) &&
      (!state.get('color') || item.colors.includes(state.get('color'))) &&
      (!state.get('max') || salePrice(item)<=Math.round(Number(state.get('max'))*100)));
    filtered.sort((a,b)=>state.get('sort')==='low' ? salePrice(a)-salePrice(b) : state.get('sort')==='high' ? salePrice(b)-salePrice(a) : b.id-a.id);
    page.querySelector('.products').innerHTML=filtered.slice(0,limit).map(productCard).join('') || '<p>Nenhuma peça encontrada. Experimente ampliar os filtros.</p>';
    $('#catalog-count').textContent=`${filtered.length} produtos encontrados`;
    $('#load-more')?.remove();
    if(filtered.length>limit) {
      page.insertAdjacentHTML('beforeend','<button id="load-more" class="outline">Ver mais produtos</button>');
      $('#load-more').onclick=()=>{limit+=12;update();};
    }
  }
  controls.oninput=()=>{limit=12;update();};
  controls.onreset=()=>setTimeout(()=>{limit=12;update();});
  controls.onsubmit=event=>event.preventDefault();
  update();
}
const basicShowBag=showBag;
const deliveryDraft = {};
showBag=()=>{
  basicShowBag();
  const rows=$('#modal-content').querySelectorAll('.bag-row');
  rows.forEach((element,index)=>{
    const row=bag[index], item=products.find(product=>product.id===row.id);
    if(!item)return;
    element.insertAdjacentHTML('afterbegin',`<div class="bag-photo">${picture(item)}</div>`);
    element.querySelector('strong').insertAdjacentHTML('afterend',`<small class="bag-unit"> ${escapeHtml(row.color || 'Única')} · ${money(salePrice(item))}/un.</small>`);
  });
  const link=$('#modal-content a[href^="https://wa.me/"]');
  const preview=$('#modal-content .order-preview');
  dialog.scrollTop = 0;
  $('#modal-content h2').insertAdjacentHTML('beforebegin', '<p class="checkout-step">Etapa 1 de 3</p>');
  if(!preview)return;
  const content = $('#modal-content');
  const reviewButton = content.querySelector('[data-collection]');
  const originalPreview = preview.closest('details');
  const checkoutNotice = originalPreview.nextElementSibling;
  originalPreview.remove();
  if (checkoutNotice !== reviewButton) checkoutNotice?.remove();
  const stockProblem=bag.some(row=>{
    const item=products.find(product=>product.id===row.id);
    return !item || !item.colors.includes(row.color || 'Única') || row.qty>stockFor(item,row.size,row.color || 'Única');
  });
  if(stockProblem) {
    reviewButton.insertAdjacentHTML('beforebegin','<p role="alert">Revise as variações ou quantidades indisponíveis antes de continuar.</p>');
    return;
  }
  reviewButton.insertAdjacentHTML('beforebegin', '<button type="button" class="btn" id="start-checkout">Finalizar compra</button> ');
  $('#start-checkout').onclick = () => showDelivery();
  const deliveryFields = [
    ['name','Nome completo','name'],
    ['zip','CEP','postal-code',' inputmode="numeric" maxlength="9" pattern="[0-9]{5}-?[0-9]{3}" placeholder="00000-000" title="Digite os 8 dígitos do CEP"'],
    ['street','Rua ou avenida','address-line1'],
    ['number','Número','off',' placeholder="Ex.: 123 ou s/n"'],
    ['district','Bairro','address-level3'],
    ['city','Cidade','address-level2'],
    ['state','Estado (UF)','address-level1',' maxlength="2" pattern="[A-Za-z]{2}" placeholder="Ex.: SP"'],
    ['extra','Complemento (opcional)','address-line2']
  ];
  function showDelivery() {
    modal(`<p class="checkout-step">Etapa 2 de 3</p><h2 tabindex="-1">Dados de entrega</h2><p>Preencha os campos obrigatórios para continuar.</p>
    <form id="customer-info" class="customer-info">${deliveryFields.map(([key,label,autocomplete,attributes]) =>
      `<label>${label}<input name="${key}" autocomplete="${autocomplete}" ${key === 'extra' ? '' : 'required'} ${attributes || 'maxlength="120"'}></label>`).join('')}
      <label>Observações (opcional)<textarea name="notes" maxlength="500"></textarea></label>
      <div class="buttons"><button type="submit" class="btn">Revisar pedido</button><button type="button" class="outline" id="back-to-bag">Voltar à sacola</button></div>
    </form>`);
    focusCheckoutStep();
  const form = $('#customer-info');
  const fields = [...form.querySelectorAll('input, textarea')];
  for (const field of fields) field.value = deliveryDraft[field.name] || '';
  $('#back-to-bag').onclick = () => { showBag(); $('#start-checkout')?.focus(); };
  form.oninput = event => {
    event.target.setCustomValidity('');
    deliveryDraft[event.target.name] = event.target.value;
  };
  form.onsubmit = event => {
    event.preventDefault();
    for (const field of fields) {
      field.setCustomValidity(field.required && !field.value.trim() ? 'Preencha este campo.' : '');
      deliveryDraft[field.name] = field.value;
    }
    if (form.reportValidity()) showReview();
  };
  }
  function focusCheckoutStep() {
    dialog.scrollTop = 0;
    $('#modal-content h2').focus({preventScroll:true});
  }
  function showReview() {
    const greeting = `Olá, ${catalog.settings.name || 'Jujuquita'}! Gostaria de consultar este pedido:`;
    const confirmation = 'Pode confirmar a disponibilidade das peças, o frete e as formas de pagamento?';
    const prices = bag.map(row => {
      const item=products.find(product=>product.id===row.id);
      return { label: `${row.qty} × ${item.name} [${item.sku}] · ${row.size} / ${row.color || 'Única'} · `, amount: salePrice(item) * row.qty };
    });
    const pricedLines = [...prices, { label: 'Subtotal: ', amount: prices.reduce((sum, row) => sum + row.amount, 0) }];
    const delivery = [];
    for (const [key,label] of [...deliveryFields, ['notes','Observações']]) {
      const value = (deliveryDraft[key] || '').trim();
      if (value) delivery.push(label.replace(' (opcional)', '') + ': ' + (key === 'state' ? value.toUpperCase() : value));
    }
    const deliveryText = delivery.join('\n');
    const message = [greeting, pricedLines.map(row => `${row.label}*${money(row.amount)}*`).join('\n'), 'Dados de entrega\n' + deliveryText, confirmation].join('\n\n');
    const previewHtml = [escapeHtml(greeting), pricedLines.map(row => `${escapeHtml(row.label)}<strong>${escapeHtml(money(row.amount))}</strong>`).join('\n'), '<strong>Dados de entrega</strong>\n' + escapeHtml(deliveryText), escapeHtml(confirmation)].join('\n\n');
    modal(`<p class="checkout-step">Etapa 3 de 3</p><h2 tabindex="-1">Confira seu pedido</h2>
      <p class="order-preview">${previewHtml}</p><p>Frete e pagamento serão confirmados pela loja.</p>
      <div class="buttons" id="checkout-actions"><button class="outline" id="edit-delivery">Voltar aos dados de entrega</button></div>`);
    focusCheckoutStep();
    $('#edit-delivery').onclick = showDelivery;
    if (!link) {
      if (checkoutNotice) $('#checkout-actions').before(checkoutNotice);
      return;
    }
    $('#checkout-actions').insertAdjacentHTML('beforebegin', '<p id="order-feedback" role="status"></p>');
    $('#checkout-actions').insertAdjacentHTML('afterbegin', '<button class="btn" id="submit-order">Enviar pedido pelo WhatsApp</button>');
    const submit = $('#submit-order');
    const id = crypto.randomUUID();
    submit.onclick = async () => {
      submit.disabled = true;
      const text = 'Pedido ' + id + '\n' + message;
      try {
        const latest = await database.readCatalog();
        const publishedProducts = visibleProducts(latest);
        const changed = bag.some(row => {
          const old = products.find(item => item.id === row.id);
          const current = publishedProducts.find(item => item.id === row.id);
          return !current || !old || !current.sizes.includes(row.size) || !current.colors.includes(row.color || 'Única') ||
            row.qty > stockFor(current, row.size, row.color || 'Única') ||
            salePrice(current) !== salePrice(old) || current.name !== old.name || current.sku !== old.sku;
        });
        if (changed || latest.whatsapp !== catalog.whatsapp) {
          catalog.whatsapp = latest.whatsapp;
          products.splice(0, products.length, ...publishedProducts);
          showBag();
          $('#modal-content h2').insertAdjacentHTML('afterend', '<p role="alert">O catálogo ou o atendimento mudou. Revise sua sacola antes de continuar.</p>');
          return;
        }
        await database.order(id, text);
        location.assign('https://wa.me/' + catalog.whatsapp + '?text=' + encodeURIComponent(text));
      } catch {
        const feedback = $('#order-feedback');
        if (feedback) feedback.textContent = 'Não foi possível registrar o pedido. Tente novamente.';
        submit.disabled = false;
      }
    };
  }
};
$('#bag').onclick=showBag;
renderProductPage();
enhanceCollection();
const footerContact=document.querySelector('footer .footer-grid>div:last-child');
if(footerContact && catalog.settings.hours)footerContact.insertAdjacentHTML('beforeend',`<p>${escapeHtml(catalog.settings.hours)}</p>`);
