const database = (() => {
  const url = 'https://wzagqyfliroobrajqzxt.supabase.co';
  const key = 'sb_publishable_QI8gSRIEuRR5Ptorsxky1Q_2EpbQnIg';
  let session;
  let revision;
  let refresh;
  async function request(path, { method = 'GET', body, authenticated = false, mediaType, prefer } = {}) {
    if (authenticated && session && session.deadline < Date.now() + 30000) {
      refresh ??= renewSession().finally(() => { refresh = null; });
      await refresh;
    }
    if (authenticated && !session) throw Error('Entre novamente no painel.');
    const headers = { apikey: key };
    if (authenticated) headers.Authorization = 'Bearer ' + session.access_token;
    if (body !== undefined) headers['Content-Type'] = mediaType || 'application/json';
    if (prefer) headers.Prefer = prefer;
    let response;
    try {
      response = await fetch(url + path, {
        method, headers, body: mediaType || body === undefined ? body : JSON.stringify(body),
        cache: 'no-store', signal: AbortSignal.timeout(15000)
      });
    } catch (error) {
      if (error.name === 'TimeoutError') throw Error('O Supabase demorou para responder. Confira a conexão e tente novamente.');
      if (error instanceof TypeError) throw Error('Não foi possível conectar ao Supabase. Confira a conexão e tente novamente.');
      throw error;
    }
    const result = await response.json().catch(() => null);
    if (!response.ok) {
      const error = Error(result?.message || result?.msg || result?.error_description || 'Erro de comunicação com a loja.');
      error.code = result?.code;
      throw error;
    }
    return result;
  }
  async function adminSession(action, password) {
    const send = async () => {
      const response = await fetch('/api/admin-session', {
        method:'POST', credentials:'same-origin', cache:'no-store',
        headers:{'Content-Type':'application/json'}, body:JSON.stringify({action,password}),
        signal:AbortSignal.timeout(18000)
      });
      const result = await response.json().catch(() => null);
      if (response.status === 401 && action === 'restore') return null;
      if (!response.ok) throw Error(result?.message || 'Não foi possível acessar o painel. Tente novamente.');
      if (action !== 'logout' && !result?.access_token) throw Error('Não foi possível acessar o painel. Tente novamente.');
      return result;
    };
    return navigator.locks ? navigator.locks.request('juju-admin-session', send) : send();
  }
  async function renewSession(action = 'restore', password) {
    const result = await adminSession(action, password);
    session = result && {access_token:result.access_token, deadline:Date.now() + result.expires_in * 1000};
    return Boolean(session);
  }
  async function loadAdminCatalog() {
    const snapshot = await readAdminSnapshot();
    revision = snapshot.revision;
    return snapshot.catalog;
  }
  const read = (table, query, authenticated) => request('/rest/v1/' + table + '?' + query, { authenticated });
  async function readAll(table, query, authenticated) {
    const rows = [];
    const pageSize = 250;
    for (let offset = 0; ; offset += pageSize) {
      const page = await read(table, query + '&limit=' + pageSize + '&offset=' + offset, authenticated);
      rows.push(...page);
      if (page.length < pageSize) return rows;
    }
  }
  async function readCatalog(admin = false) {
    const data = await Promise.all([
      readAll('juju_categories','order=sort_order,id',admin), readAll('juju_products','order=sort_order,id',admin),
      readAll('juju_product_images','order=sort_order,id',admin), readAll('juju_variants','select=product_id,size,color,stock&order=product_id,size,color',admin),
      readAll('juju_highlights','order=sort_order,product_id',admin), read('juju_settings','id=eq.true',admin)
    ]);
    const [categories, products, images, variants, highlights, [settings]] = data;
    return normalizeCatalog({
      categories: categories.map(row => ({ ...row, image:row.image_url })),
      products: products.map(row => {
        const photos = images.filter(image => image.product_id === row.id).map(image => image.image_url);
        return { ...row, category:row.category_id, price:row.price_cents, promotion:row.promotion_cents,
          image:photos[0], gallery:photos.slice(1), variants:variants.filter(entry => entry.product_id === row.id) };
      }),
      highlights: highlights.map(row => ({ ...row, id:row.product_id, product:row.product_id })),
      whatsapp:settings?.whatsapp || '',
      settings: { ...settings, name:settings?.store_name || '' }
    });
  }
  async function upload(image) {
    if (!image || isCatalogImageUrl(image)) return image || null;
    const type = /^data:image\/(png|jpeg|webp);base64,/.exec(image)?.[1];
    if (!type) throw Error('Foto inválida.');
    const bytes = Uint8Array.from(atob(image.slice(image.indexOf(',') + 1)), char => char.charCodeAt(0));
    if (bytes.byteLength > 500000) throw Error('A foto deve ter até 500 KB.');
    const path = '/storage/v1/object/juju-media/' + crypto.randomUUID() + '.' + type;
    await request(path, {method:'POST', body:bytes, mediaType:'image/' + type, authenticated:true});
    return url + path.replace('/object/', '/object/public/');
  }
  async function saveCatalog(next, expected = revision) {
    const images = [], variants = [];
    const categories = await Promise.all(next.categories.map(async (item, sort_order) => ({
      id:item.id,name:item.name,active:item.active,sort_order,show_name:item.show_name !== false,image_url:await upload(item.image)
    })));
    const products = await Promise.all(next.products.map(async (item, sort_order) => {
      const photos = await Promise.all([item.image,...(item.gallery || [])].filter(Boolean).map(upload));
      item.image = photos[0] || null;
      item.gallery = photos.slice(1);
      photos.forEach((image_url,index)=>images.push({product_id:item.id,image_url,sort_order:index}));
      (item.variants || []).forEach(({ size, color, stock })=>variants.push({product_id:item.id,size,color,stock}));
      return {id:item.id,category_id:item.category,name:item.name,sku:item.sku,description:item.description || '',
        price_cents:item.price,promotion_cents:item.promotion || null,sizes:item.sizes,colors:item.colors,active:item.active,
        measurements:item.measurements || '',care:item.care || '',stock:item.stock,sort_order};
    }));
    categories.forEach((row,index)=>{ next.categories[index].image=row.image_url; });
    const highlights = next.highlights.map((item,sort_order)=>({product_id:item.product,active:item.active,sort_order}));
    const settings = Object.fromEntries(['instagram','hours','delivery','payment','returns'].map(field=>[field,next.settings[field] || '']));
    settings.store_name = next.settings.name?.trim() || '';
    settings.whatsapp = next.whatsapp;
    revision = await request('/rest/v1/rpc/juju_save',{method:'POST',authenticated:true,body:{
      payload:{categories,products,images,variants,highlights,settings},expected
    }});
  }
  async function readAdminSnapshot() {
    const [row] = await read('juju_revision','select=current',true);
    const catalog = await readCatalog(true);
    return {catalog, revision:row.current};
  }
  function editableRecord(kind, item) {
    if (!item) return null;
    const fields = kind === 'products'
      ? ['name','active','category','price','promotion','description','sku','measurements','care','sizes','colors','stock','image','gallery']
      : ['name','active','image','product','show_name'];
    const values = fields.map(field => item[field] ?? null);
    const variants = (item.variants || []).map(({size,color,stock}) => JSON.stringify([size,color,stock])).sort();
    return JSON.stringify([values, variants]);
  }
  const isSaveConflict = error => error.code === 'PT409' || error.code === '40001';
  async function saveCatalogEdit(next, before, {kind, id}) {
    try {
      await saveCatalog(next);
      return {catalog:next, before};
    } catch (error) {
      if (!isSaveConflict(error)) throw error;
    }
    const latest = await readAdminSnapshot();
    const records = latest.catalog[kind];
    const index = records.findIndex(record => record.id === id);
    const current = records[index];
    const original = before[kind].find(record => record.id === id);
    const draft = next[kind].find(record => record.id === id);
    if (original && !current) throw Error('Este cadastro foi removido em outra aba. Suas alterações continuam abertas no formulário.');
    if (editableRecord(kind, original) !== editableRecord(kind, current)) {
      throw Error('Este cadastro mudou em outra aba. Seus dados continuam no formulário. Confira a versão mais recente em outra aba antes de sair.');
    }
    if (kind === 'products' && !latest.catalog.categories.some(category => category.id === draft.category)) {
      throw Error('A categoria escolhida foi removida. Reabra o cadastro com uma categoria disponível.');
    }
    if (kind === 'highlights' && draft && !latest.catalog.products.some(product => product.id === draft.product)) {
      throw Error('Este produto foi removido em outra aba.');
    }
    const updated = structuredClone(latest.catalog);
    if (!draft) {
      if (index !== -1) updated[kind].splice(index, 1);
    } else if (index === -1) updated[kind].push(draft);
    else updated[kind][index] = draft;
    try { await saveCatalog(updated, latest.revision); }
    catch (error) {
      if (isSaveConflict(error)) throw Error('O catálogo acabou de mudar. Tente salvar novamente. Seus dados continuam no formulário.');
      throw error;
    }
    return {catalog:updated, before:latest.catalog};
  }
  function cart(items) {
    let id = document.cookie.match(/(?:^|; )juju_cart=([0-9a-f-]{36})(?:;|$)/)?.[1];
    if (!id && items === undefined) return Promise.resolve([]);
    if (!id) {
      id = crypto.randomUUID();
      document.cookie = 'juju_cart=' + id + '; Path=/; SameSite=Lax; Max-Age=2592000' + (location.protocol === 'https:' ? '; Secure' : '');
    }
    return request('/rest/v1/rpc/juju_cart',{method:'POST',body:{cart_key:id,cart_items:items ?? null}});
  }
  return {
    readCatalog, saveCatalog, saveCatalogEdit, cart,
    async login(password) {
      await renewSession('login',password);
      return loadAdminCatalog();
    },
    async restoreAdmin() {
      return await renewSession() ? loadAdminCatalog() : null;
    },
    async password(current, password) {
      await renewSession('login',current);
      await request('/auth/v1/user',{method:'PUT',authenticated:true,body:{password}});
    },
    async logout() {
      await adminSession('logout');
      session = null;
    },
    clearSession:() => { session = null; },
    orders:()=>read('juju_orders','order=created_at.desc&limit=100',true),
    async order(id, message) {
      try { await request('/rest/v1/juju_orders',{method:'POST',body:{id,message},prefer:'return=minimal'}); }
      catch (error) { if (error.code !== '23505') throw error; }
    }
  };
})();
