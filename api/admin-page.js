const {readFileSync} = require('node:fs');
const {join} = require('node:path');
const {readSessionCookie} = require('../lib/admin-cookie.cjs');

const login = readFileSync(join(__dirname, '..', 'jujuadmin', 'index.html'), 'utf8');
const panel = login.replace('data-admin-entry="login"', 'data-admin-entry="restore"');

function adminPage(req, res, secure) {
  res.setHeader('Cache-Control', 'private, no-store');
  res.setHeader('Vary', 'Cookie');
  res.setHeader('X-Robots-Tag', 'noindex, nofollow');
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    res.statusCode = 405;
    res.setHeader('Allow', 'GET, HEAD');
    return res.end();
  }
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  return res.end(req.method === 'HEAD' ? undefined : readSessionCookie(req, secure) ? panel : login);
}

module.exports = (req, res) => adminPage(req, res, true);
module.exports.local = (req, res) => adminPage(req, res, false);
