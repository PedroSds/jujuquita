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
  loginForm.onsubmit = async event => {
    event.preventDefault();
    const submit = loginForm.querySelector('button');
    const feedback = document.querySelector('#login-status');
    submit.disabled = true;
    feedback.textContent = 'Entrando…';
    try {
      initialCatalog = await database.login(loginForm.elements.password.value);
      loginForm.reset();
      await loadScript('admin.js');
      await loadScript('admin-enhancements.js');
      loginForm.hidden = true;
      document.querySelector('.sidebar').hidden = false;
      document.querySelector('.workspace').hidden = false;
    } catch (error) { feedback.textContent = error.message; }
    finally { submit.disabled = false; }
  };
  const logout = async () => {
    try { await database.logout(); } finally { location.reload(); }
  };
  document.querySelectorAll('#logout, [data-logout]').forEach(button => { button.onclick = logout; });
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
