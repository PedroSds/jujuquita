const {readSessionCookie, readLegacyCookie, writeSessionCookie} = require('../lib/admin-cookie.cjs');
const supabase = 'https://wzagqyfliroobrajqzxt.supabase.co';
const key = 'sb_publishable_QI8gSRIEuRR5Ptorsxky1Q_2EpbQnIg';
const adminEmail = process.env.JUJUQUITA_ADMIN_EMAIL || 'ateliejujuquita@gmail.com';

function reply(res, status, body) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.end(JSON.stringify(body));
}

async function supabaseRequest(path, options = {}) {
  return fetch(supabase + path, {
    ...options,
    headers: {apikey:key, ...options.headers},
    signal: AbortSignal.timeout(7000)
  });
}

function exchange(grant, values) {
  return supabaseRequest('/auth/v1/token?grant_type=' + grant, {
    method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify(values)
  });
}

async function readBody(req) {
  if (req.body !== undefined) {
    return typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
  }
  const chunks = [];
  let size = 0;
  for await (const chunk of req) {
    size += chunk.length;
    if (size > 4096) return null;
    chunks.push(chunk);
  }
  return JSON.parse(Buffer.concat(chunks).toString('utf8'));
}

async function adminSession(req, res, secure) {
  res.setHeader('Cache-Control', 'no-store, private');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return reply(res, 405, {message:'Método não permitido.'});
  }
  const origin = (secure ? 'https://' : 'http://') + req.headers.host;
  if (req.headers.origin !== origin || !/^application\/json(?:;|$)/i.test(req.headers['content-type'] || '')) {
    return reply(res, 403, {message:'Origem não autorizada.'});
  }
  const legacyToken = readLegacyCookie(req, secure);
  const refreshToken = readSessionCookie(req, secure) || legacyToken;
  const setCookie = token => writeSessionCookie(res, token, secure, Boolean(legacyToken));
  let data;
  try { data = await readBody(req); }
  catch { return reply(res, 400, {message:'Pedido inválido.'}); }

  try {
    if (data?.action === 'logout') {
      setCookie('');
      if (refreshToken) {
        const response = await exchange('refresh_token', {refresh_token:refreshToken});
        if (response.ok) {
          const session = await response.json();
          await supabaseRequest('/auth/v1/logout?scope=local', {
            method:'POST', headers:{Authorization:'Bearer ' + session.access_token}
          });
        }
      }
      return reply(res, 200, {signedOut:true});
    }
    const login = data?.action === 'login';
    if (!login && data?.action !== 'restore') return reply(res, 400, {message:'Pedido inválido.'});
    if (login && (typeof data.password !== 'string' || !data.password || data.password.length > 1024)) {
      return reply(res, 400, {message:'Informe a senha do painel.'});
    }
    if (!login && !refreshToken) return reply(res, 401, {code:'session_missing'});
    const response = login
      ? await exchange('password', {email:adminEmail, password:data.password})
      : await exchange('refresh_token', {refresh_token:refreshToken});
    if (!response.ok) {
      if (response.status === 429 || response.status >= 500) {
        return reply(res, 503, {message:'O acesso está temporariamente indisponível. Tente novamente.'});
      }
      if (!login) setCookie('');
      return reply(res, 401, login ? {message:'Senha incorreta. Confira e tente novamente.'} : {code:'session_missing'});
    }
    const session = await response.json();
    const membership = await supabaseRequest('/rest/v1/juju_admins?select=user_id&limit=1', {
      headers:{Authorization:'Bearer ' + session.access_token}
    });
    if (!membership.ok) return reply(res, 503, {message:'Não foi possível verificar o acesso ao painel.'});
    const admins = await membership.json();
    if (!admins.length) {
      setCookie('');
      return reply(res, 403, {message:'Acesso administrativo não autorizado.'});
    }
    setCookie(session.refresh_token);
    return reply(res, 200, {access_token:session.access_token, expires_in:session.expires_in});
  } catch {
    if (data?.action === 'logout') return reply(res, 200, {signedOut:true});
    return reply(res, 503, {message:'Não foi possível conectar ao serviço de acesso. Tente novamente.'});
  }
}

module.exports = (req, res) => adminSession(req, res, true);
module.exports.local = (req, res) => adminSession(req, res, false);
