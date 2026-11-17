import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';

// Espace client branché sur une fausse API : connexion, double authentification, pages, protection des formulaires
const calls = [];
const fake = createServer((req, res) => {
  let body = '';
  req.on('data', (d) => { body += d; });
  req.on('end', () => {
    calls.push({ method: req.method, url: req.url, org: req.headers['x-organization'], user: req.headers['x-user'], auth: req.headers.authorization, body: body ? JSON.parse(body) : null });
    const send = (status, data) => { res.writeHead(status, { 'content-type': 'application/json' }); res.end(JSON.stringify(data)); };
    if (req.url === '/api/reseller/portal/login') {
      const b = JSON.parse(body);
      if (b.password !== 'Bon-mot-de-passe') return send(401, { error: 'E-mail ou mot de passe incorrect' });
      if (b.email === 'mfa@exemple.fr' && !b.code) return send(200, { mfaRequired: true });
      return send(200, { user: { id: 'u1', email: b.email, name: 'Julie', role: 'ORG_ADMIN' }, organization: { id: 'o1', slug: 'garage', name: 'Garage', status: 'ACTIVE' } });
    }
    if (req.url === '/api/org/overview') return send(200, { org: { status: 'ACTIVE' }, usage: { used: 3, seats: 5 }, service: { ok: true }, license: null, counts: { extensions: 3, devices: 1, calls30d: 4, talkTimeSec: 120 }, callsPerDay: [{ day: '2026-11-01', inbound: 3, outbound: 1, missed: 1 }] });
    if (req.url === '/api/centrex/numbers') return send(200, [{ id: 'n1', number: '+33199000001', label: 'Accueil', destType: null }]);
    if (req.url === '/api/v1/sms' && req.method === 'POST') return send(200, { id: 's1', to: '+33612345678', status: 'queued', segments: 1 });
    send(404, { error: 'Introuvable' });
  });
});
await new Promise((r) => fake.listen(0, '127.0.0.1', r));
process.env.API_URL = `http://127.0.0.1:${fake.address().port}`;
process.env.API_KEY = 'vxr_test_cle';
process.env.SESSION_SECRET = 'x'.repeat(40);
process.env.PUBLIC_URL = 'http://localhost';
const { default: app } = await import('../src/server.js');
const server = app.listen(0);
const base = `http://127.0.0.1:${server.address().port}`;

let cookie = '';
const get = async (path) => { const r = await fetch(base + path, { headers: { cookie }, redirect: 'manual' }); const c = r.headers.get('set-cookie'); if (c) cookie = c.split(/,(?=\s*espace)/).map((x) => x.split(';')[0]).join('; '); return { status: r.status, text: await r.text(), location: r.headers.get('location') }; };
const csrfOf = (html) => html.match(/name="_csrf" value="([^"]+)"/)?.[1];
const post = async (path, form) => { const r = await fetch(base + path, { method: 'POST', headers: { cookie, 'content-type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams(form), redirect: 'manual' }); const c = r.headers.get('set-cookie'); if (c) cookie = c.split(/,(?=\s*espace)/).map((x) => x.split(';')[0]).join('; '); return { status: r.status, text: await r.text(), location: r.headers.get('location') }; };

test('connexion, tableau de bord, envoi de SMS au nom du client, formulaires protégés', async () => {
  assert.equal((await get('/')).location, '/connexion', 'non connecté : redirection');
  let page = await get('/connexion');
  assert.match(page.text, /Connexion/);
  assert.equal((await post('/connexion', { email: 'julie@exemple.fr', password: 'Bon-mot-de-passe' })).status, 403, 'sans jeton anti-falsification');
  let csrf = csrfOf(page.text);
  const bad = await post('/connexion', { _csrf: csrf, email: 'julie@exemple.fr', password: 'faux' });
  assert.match(bad.text, /mot de passe incorrect/);
  const ok = await post('/connexion', { _csrf: csrf, email: 'julie@exemple.fr', password: 'Bon-mot-de-passe' });
  assert.equal(ok.location, '/');
  page = await get('/');
  assert.match(page.text, /Tableau de bord/);
  assert.match(page.text, /01 99 00 00 01/);
  // la clé n'apparaît jamais dans les pages ; les appels portent X-Organization et X-User
  assert.ok(!page.text.includes('vxr_test_cle'));
  const ov = calls.find((c) => c.url === '/api/org/overview');
  assert.equal(ov.auth, 'Bearer vxr_test_cle');
  assert.equal(ov.org, 'o1');
  assert.equal(ov.user, 'u1');
  csrf = csrfOf(page.text);
  const sms = await post('/sms', { _csrf: csrf, to: '0612345678', text: 'Bonjour' });
  assert.equal(sms.location, '/sms');
  assert.deepEqual(calls.find((c) => c.url === '/api/v1/sms').body, { to: '0612345678', text: 'Bonjour' });
});

test('double authentification : le code est demandé avant d’ouvrir la session', async () => {
  cookie = '';
  const page = await get('/connexion');
  const step = await post('/connexion', { _csrf: csrfOf(page.text), email: 'mfa@exemple.fr', password: 'Bon-mot-de-passe' });
  assert.match(step.text, /Code de vérification/);
  const done = await post('/connexion', { _csrf: csrfOf(step.text), email: 'mfa@exemple.fr', password: 'Bon-mot-de-passe', code: '123456' });
  assert.equal(done.location, '/');
  server.close();
  fake.close();
});
