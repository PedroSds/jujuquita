let initialCatalog;
let initialBagPromise;
const scriptRoot = document.currentScript.src;
function loadScript(src) {
  return new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.async = false;
    script.src = new URL(src, scriptRoot);
    script.onload = resolve;
    script.onerror = () => reject(Error('Não foi possível carregar a página. Atualize para tentar novamente.'));
    document.body.append(script);
  });
}

const loginForm = document.querySelector('#admin-login');
if (loginForm) {
  const loginScreen = document.querySelector('#login-screen');
  const sidebar = document.querySelector('.sidebar');
  const workspace = document.querySelector('.workspace');
  const submit = loginForm.querySelector('button');
  const feedback = document.querySelector('#login-status');
  const channel = typeof BroadcastChannel === 'function' ? new BroadcastChannel('juju-admin') : null;
  async function showAdmin(catalog) {
    initialCatalog = catalog;
    await Promise.all(['photo-crop.js','admin.js','admin-enhancements.js'].map(loadScript));
    loginScreen.hidden = true;
    sidebar.hidden = workspace.hidden = false;
    sidebar.inert = workspace.inert = false;
    document.body.dataset.adminEntry = 'ready';
  }
  loginForm.onsubmit = async event => {
    event.preventDefault();
    if (submit.disabled) return;
    submit.disabled = true;
    feedback.textContent = 'Entrando…';
    try {
      await startup;
      if (loginScreen.hidden) return;
      const catalog = await database.login(loginForm.elements.password.value);
      loginForm.reset();
      await showAdmin(catalog);
    } catch (error) { feedback.textContent = error.message; }
    finally { submit.disabled = false; }
  };
  const logout = async () => {
    try {
      await database.logout();
      channel?.postMessage('signed-out');
      location.reload();
    } catch {
      document.querySelector('#status').textContent = 'Não foi possível sair do painel. Tente novamente.';
    }
  };
  document.querySelectorAll('#logout, [data-logout]').forEach(button => { button.onclick = logout; });
  if (channel) channel.onmessage = event => {
    if (event.data !== 'signed-out') return;
    database.clearSession();
    if (loginScreen.hidden) location.reload();
  };
  const startup = database.restoreAdmin().then(catalog => {
    if (catalog) return showAdmin(catalog);
  }).catch(error => { feedback.textContent = error.message; })
    .finally(() => {
      if (!loginScreen.hidden) document.body.dataset.adminEntry = 'login';
    });
} else {
  const searchInput = document.querySelector('#search');
  if (searchInput && document.querySelector('#collection-page')) {
    searchInput.value = new URLSearchParams(location.search).get('busca')?.trim() || '';
  }
  initialBagPromise = database.cart().catch(() => null);
  const embedded = document.querySelector('#public-catalog');
  const catalogReady = embedded ? Promise.resolve().then(() => normalizeCatalog(JSON.parse(embedded.textContent))) : database.readCatalog();
  catalogReady.then(async catalog => {
    initialCatalog = catalog;
    await Promise.all(['store.js','store-enhancements.js'].map(loadScript));
    document.body.classList.remove('store-loading');
    window.storeMotion?.observe();
  }).catch(() => {
    document.body.classList.remove('store-loading');
    document.querySelectorAll('[data-loading]').forEach(element => element.remove());
    const message = document.createElement('div');
    message.className = 'wrap store-error';
    message.setAttribute('role', 'alert');
    message.innerHTML = '<p>Não foi possível carregar a loja. Confira sua conexão e tente novamente.</p><button class="outline" type="button">Tentar novamente</button>';
    message.querySelector('button').onclick = () => location.reload();
    document.querySelector('main').prepend(message);
  });
}
