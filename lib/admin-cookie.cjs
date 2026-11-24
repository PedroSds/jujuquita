const endpoint = '/api/admin-session';
const lifetime = 8 * 60 * 60;
const name = secure => secure ? '__Host-juju_admin' : 'juju_admin';
const oldName = secure => secure ? '__Secure-juju_admin' : 'juju_admin_local';

function readCookie(req, key) {
  return (req.headers.cookie || '').split(';').map(value => value.trim())
    .find(value => value.startsWith(key + '='))?.slice(key.length + 1);
}

function writeSessionCookie(res, token, secure, clearLegacy) {
  const flags = '; HttpOnly; SameSite=Strict' + (secure ? '; Secure' : '');
  const cookies = [`${name(secure)}=${token}; Path=/; Max-Age=${token ? lifetime : 0}${flags}`];
  if (clearLegacy) cookies.push(`${oldName(secure)}=; Path=${endpoint}; Max-Age=0${flags}`);
  res.setHeader('Set-Cookie', cookies);
}

module.exports = {
  readSessionCookie:(req, secure) => readCookie(req, name(secure)),
  readLegacyCookie:(req, secure) => readCookie(req, oldName(secure)),
  writeSessionCookie
};
