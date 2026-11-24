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
function picture(item) {
  if (isCatalogImageUrl(item.image) || /^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/.test(item.image || '')) {
    return `<img class="catalog-image" loading="lazy" decoding="async" src="${escapeHtml(item.image)}" alt="${escapeHtml(item.name)}">`;
  }
  return '<div class="catalog-image missing-photo">Sem foto</div>';
}
