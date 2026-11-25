let initialCatalog;
let initialBag;
const scriptRoot = document.currentScript.src;
function loadScript(src) {
  return new Promise((resolve, reject) => {
    const script = document.createElement('script');
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
    await loadScript('photo-crop.js');
    await loadScript('admin.js');
    await loadScript('admin-enhancements.js');
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
  Promise.all([database.readCatalog(), database.cart()]).then(async ([catalog, bag]) => {
    initialCatalog = catalog;
    initialBag = bag;
    await loadScript('store.js');
    await loadScript('store-enhancements.js');
  }).catch(() => {
    const message = document.createElement('p');
    message.className = 'wrap';
    message.setAttribute('role', 'alert');
    message.textContent = 'Não foi possível carregar a loja. Atualize a página para tentar novamente.';
    document.querySelector('main').prepend(message);
  });
}
