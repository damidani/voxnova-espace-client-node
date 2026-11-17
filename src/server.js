import { randomBytes, timingSafeEqual } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import express from 'express';
import cookieSession from 'cookie-session';
import ejs from 'ejs';
import { api, ApiError } from './api.js';
import { checkConfig, config } from './config.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const app = express();
app.disable('x-powered-by');
if (process.env.TRUST_PROXY === 'true') app.set('trust proxy', 1);
app.use(express.urlencoded({ extended: false, limit: '100kb' }));
app.use('/static', express.static(path.join(root, 'public'), { maxAge: '1d' }));
// couleur de la marque (feuille de style générée : la politique de sécurité interdit les styles en ligne)
app.get('/theme.css', (_req, res) => res.type('text/css').set('Cache-Control', 'public, max-age=3600').send(`:root{--brand:${config.brand.color}}`));

// en-têtes de sécurité : aucun script, aucune ressource externe sauf images (logo) et lecture audio de la plateforme
app.use((_req, res, next) => {
  res.set({
    'Content-Security-Policy': `default-src 'self'; img-src 'self' data: https:; media-src 'self' ${config.apiUrl}; style-src 'self'; script-src 'none'; form-action 'self' ${config.apiUrl}; frame-ancestors 'none'; base-uri 'none'`,
    'X-Content-Type-Options': 'nosniff', 'Referrer-Policy': 'same-origin', 'X-Frame-Options': 'DENY',
    ...(config.production ? { 'Strict-Transport-Security': 'max-age=31536000' } : {}),
  });
  next();
});

app.use(cookieSession({ name: 'espace', keys: [config.sessionSecret || 'configuration-manquante'], httpOnly: true, sameSite: 'lax', secure: config.production, maxAge: 8 * 3600_000 }));

// ------------------------------------------------------------------ outils
const views = path.join(root, 'views');
const money = (cents) => (Number(cents || 0) / 100).toLocaleString('fr-FR', { style: 'currency', currency: 'EUR' });
const dateFr = (d) => (d ? new Date(d).toLocaleDateString('fr-FR', { timeZone: 'Europe/Paris' }) : '—');
const dateTimeFr = (d) => (d ? new Date(d).toLocaleString('fr-FR', { timeZone: 'Europe/Paris', dateStyle: 'short', timeStyle: 'short' }) : '—');
const duration = (s) => { s = Number(s || 0); return s >= 3600 ? `${Math.floor(s / 3600)} h ${String(Math.floor((s % 3600) / 60)).padStart(2, '0')}` : `${Math.floor(s / 60)} min ${String(s % 60).padStart(2, '0')}`; };
const phone = (n) => { const m = String(n ?? '').match(/^\+33(\d)(\d{2})(\d{2})(\d{2})(\d{2})$/); return m ? `0${m[1]} ${m[2]} ${m[3]} ${m[4]} ${m[5]}` : (n ?? ''); };
const helpers = { money, dateFr, dateTimeFr, duration, phone };

const csrf = (req) => (req.session.csrf ??= randomBytes(24).toString('hex'));
async function render(req, res, view, data = {}, status = 200) {
  const me = req.session.user ?? null;
  const locals = { ...helpers, brand: config.brand, me, path: req.path, csrf: csrf(req), flash: req.session.flash ?? null, allowSignup: config.allowSignup, ...data };
  req.session.flash = null;
  const body = await ejs.renderFile(path.join(views, `${view}.ejs`), locals);
  res.status(status).send(await ejs.renderFile(path.join(views, 'layout.ejs'), { ...locals, body }));
}
const flash = (req, type, text) => { req.session.flash = { type, text }; };
const as = (req) => ({ org: req.session.user.orgId, user: req.session.user.id });

// formulaires : jeton anti-falsification obligatoire
app.use((req, res, next) => {
  if (req.method !== 'POST') return next();
  const sent = Buffer.from(String(req.body?._csrf ?? ''));
  const expected = Buffer.from(String(req.session.csrf ?? ''));
  if (!expected.length || sent.length !== expected.length || !timingSafeEqual(sent, expected)) return res.status(403).send('Formulaire expiré : rechargez la page.');
  next();
});

// tentatives de connexion limitées par adresse (10 par minute)
const attempts = new Map();
const tooMany = (ip) => {
  const now = Date.now();
  const a = (attempts.get(ip) ?? []).filter((t) => now - t < 60_000);
  a.push(now);
  attempts.set(ip, a);
  if (attempts.size > 10_000) attempts.clear();
  return a.length > 10;
};

const signedIn = (req, res, next) => (req.session.user ? next() : res.redirect('/connexion'));
const adminOnly = (req, res, next) => (req.session.user?.role === 'ORG_ADMIN' ? next() : render(req, res, 'restricted', { title: 'Accès réservé' }, 403));
/** Exécute une page ; une erreur de l'API s'affiche dans la page (ou en bandeau après une action). */
const page = (fn) => async (req, res) => {
  try { await fn(req, res); } catch (e) {
    if (!(e instanceof ApiError)) { console.error(e); return render(req, res, 'error', { title: 'Erreur', message: 'Une erreur est survenue.' }, 500); }
    if (req.method === 'POST') { flash(req, 'error', e.message); return res.redirect(req.get('referer')?.startsWith(config.publicUrl) ? req.get('referer') : req.path); }
    render(req, res, 'error', { title: 'Erreur', message: e.status === 401 ? 'Clé d’API refusée : vérifiez la configuration de l’espace client.' : e.message }, e.status === 404 ? 404 : 500);
  }
};

// ------------------------------------------------------------------ connexion
app.get('/connexion', (req, res) => (req.session.user ? res.redirect('/') : render(req, res, 'login', { title: 'Connexion', step: 'password', email: '' })));
app.post('/connexion', page(async (req, res) => {
  const email = String(req.body.email ?? '').trim();
  const password = String(req.body.password ?? '');
  const code = String(req.body.code ?? '').replace(/\s/g, '');
  if (tooMany(req.ip)) return render(req, res, 'login', { title: 'Connexion', step: 'password', email, error: 'Trop de tentatives : réessayez dans une minute.' }, 429);
  try {
    const r = await api('POST', '/api/reseller/portal/login', { body: { email, password, ...(code ? { code } : {}), clientIp: req.ip } });
    if (r.mfaRequired) return render(req, res, 'login', { title: 'Connexion', step: 'code', email, password });
    req.session.user = { id: r.user.id, email: r.user.email, name: r.user.name, role: r.user.role, orgId: r.organization.id, orgName: r.organization.name };
    req.session.csrf = randomBytes(24).toString('hex');
    res.redirect('/');
  } catch (e) {
    if (!(e instanceof ApiError) || e.status >= 500) throw e;
    render(req, res, 'login', { title: 'Connexion', step: code ? 'code' : 'password', email, password: code ? password : '', error: e.message }, e.status);
  }
}));
app.post('/deconnexion', (req, res) => { req.session = null; res.redirect('/connexion'); });

app.get('/mot-de-passe-oublie', (req, res) => render(req, res, 'forgot', { title: 'Mot de passe oublié' }));
app.post('/mot-de-passe-oublie', page(async (req, res) => {
  if (tooMany(req.ip)) return render(req, res, 'forgot', { title: 'Mot de passe oublié', error: 'Trop de tentatives : réessayez dans une minute.' }, 429);
  await api('POST', '/api/reseller/portal/forgot', { body: { email: String(req.body.email ?? '').trim(), resetUrl: `${config.publicUrl}/reinitialiser`, clientIp: req.ip } });
  render(req, res, 'forgot', { title: 'Mot de passe oublié', sent: true });
}));
app.get('/reinitialiser', (req, res) => render(req, res, 'reset', { title: 'Nouveau mot de passe', token: String(req.query.token ?? '') }));
app.post('/reinitialiser', page(async (req, res) => {
  const token = String(req.body.token ?? '');
  if (req.body.password !== req.body.confirm) return render(req, res, 'reset', { title: 'Nouveau mot de passe', token, error: 'Les deux mots de passe ne correspondent pas.' }, 400);
  try {
    await api('POST', '/api/auth/reset', { body: { token, password: String(req.body.password ?? '') } });
  } catch (e) { if (e instanceof ApiError && e.status < 500) return render(req, res, 'reset', { title: 'Nouveau mot de passe', token, error: e.message }, 400); throw e; }
  flash(req, 'success', 'Mot de passe enregistré : vous pouvez vous connecter.');
  res.redirect('/connexion');
}));

// inscription en ligne (essai) : facultative
app.get('/inscription', (req, res) => (config.allowSignup ? render(req, res, 'signup', { title: 'Créer mon compte', v: {} }) : res.redirect('/connexion')));
app.post('/inscription', page(async (req, res) => {
  if (!config.allowSignup) return res.redirect('/connexion');
  if (tooMany(req.ip)) return render(req, res, 'signup', { title: 'Créer mon compte', v: req.body, error: 'Trop de tentatives : réessayez dans une minute.' }, 429);
  const v = { company: String(req.body.company ?? '').trim(), name: String(req.body.name ?? '').trim(), email: String(req.body.email ?? '').trim() };
  try {
    await api('POST', '/api/reseller/clients', { body: { ...v, password: String(req.body.password ?? ''), product: 'CENTREX_HOSTED', trialDays: config.trialDays } });
    const r = await api('POST', '/api/reseller/portal/login', { body: { email: v.email, password: String(req.body.password ?? ''), clientIp: req.ip } });
    req.session.user = { id: r.user.id, email: r.user.email, name: r.user.name, role: r.user.role, orgId: r.organization.id, orgName: r.organization.name };
    flash(req, 'success', 'Bienvenue ! Votre compte est prêt.');
    res.redirect('/');
  } catch (e) { if (e instanceof ApiError && e.status < 500) return render(req, res, 'signup', { title: 'Créer mon compte', v, error: e.message }, 400); throw e; }
}));

// ------------------------------------------------------------------ espace client
app.get('/', signedIn, page(async (req, res) => {
  if (req.session.user.role !== 'ORG_ADMIN') return render(req, res, 'home-user', { title: 'Accueil' });
  const [o, numbers] = await Promise.all([api('GET', '/api/org/overview', { as: as(req) }), api('GET', '/api/centrex/numbers', { as: as(req) })]);
  render(req, res, 'dashboard', { title: 'Tableau de bord', o, numbers });
}));

app.get('/utilisateurs', signedIn, adminOnly, page(async (req, res) => {
  const [users, extensions] = await Promise.all([api('GET', '/api/org/users', { as: as(req) }), api('GET', '/api/org/extensions', { as: as(req) })]);
  render(req, res, 'users', { title: 'Utilisateurs', users, extensions });
}));
app.post('/utilisateurs', signedIn, adminOnly, page(async (req, res) => {
  await api('POST', '/api/org/users', { as: as(req), body: { email: String(req.body.email ?? '').trim(), name: String(req.body.name ?? '').trim(), role: req.body.role === 'ORG_ADMIN' ? 'ORG_ADMIN' : 'USER', sendInvite: true } });
  flash(req, 'success', 'Utilisateur ajouté : il reçoit une invitation par e-mail.');
  res.redirect('/utilisateurs');
}));
app.post('/utilisateurs/:id/supprimer', signedIn, adminOnly, page(async (req, res) => {
  await api('DELETE', `/api/org/users/${encodeURIComponent(req.params.id)}`, { as: as(req) });
  flash(req, 'success', 'Utilisateur supprimé.');
  res.redirect('/utilisateurs');
}));

const DEST_LABELS = { EXTENSION: 'Poste', RING_GROUP: 'Groupe d’appel', IVR: 'Standard vocal', QUEUE: 'File d’attente', VOICEMAIL: 'Messagerie vocale', CONFERENCE: 'Conférence', TIME_CONDITION: 'Horaires', FLOW: 'Scénario', SHARED_VOICEMAIL: 'Messagerie partagée', AI_AGENT: 'Standardiste IA', APPLICATION: 'Application' };
app.get('/numeros', signedIn, adminOnly, page(async (req, res) => {
  const [numbers, destinations] = await Promise.all([api('GET', '/api/centrex/numbers', { as: as(req) }), api('GET', '/api/centrex/destinations', { as: as(req) })]);
  const area = /^0[1-59]$/.test(String(req.query.zone ?? '')) ? String(req.query.zone) : '';
  const shop = area ? await api('GET', '/api/billing/numbers', { as: as(req), query: { area } }) : null;
  render(req, res, 'numbers', { title: 'Numéros', numbers, destinations, labels: DEST_LABELS, area, shop });
}));
app.post('/numeros/acheter', signedIn, adminOnly, page(async (req, res) => {
  const r = await api('POST', '/api/billing/numbers', { as: as(req), body: { number: String(req.body.number ?? '') } });
  flash(req, 'success', `Numéro ${phone(r.number)} ajouté${r.chargedCents ? ` (${money(r.chargedCents)} TTC facturés au prorata)` : ''}. Choisissez maintenant où il sonne.`);
  res.redirect('/numeros');
}));
app.post('/numeros/:id', signedIn, adminOnly, page(async (req, res) => {
  const [destType, destId] = String(req.body.dest ?? '').split(':');
  await api('PUT', `/api/centrex/numbers/${encodeURIComponent(req.params.id)}`, { as: as(req), body: destType ? { destType, destId: destId || null, destValue: null } : { destType: null, destId: null, destValue: null } });
  flash(req, 'success', 'Destination du numéro enregistrée.');
  res.redirect('/numeros');
}));

const STRATEGIES = { 'longest-idle-agent': 'L’agent libre depuis le plus longtemps', 'ring-all': 'Tous les agents en même temps', 'round-robin': 'Chacun son tour', 'top-down': 'Dans l’ordre de la liste', 'agent-with-least-talk-time': 'L’agent qui a le moins parlé', random: 'Au hasard' };
const members = (body) => [].concat(body.members ?? []).map(String).filter(Boolean);
app.get('/files', signedIn, adminOnly, page(async (req, res) => {
  const [queues, extensions] = await Promise.all([api('GET', '/api/centrex/queues', { as: as(req) }), api('GET', '/api/org/extensions', { as: as(req) })]);
  render(req, res, 'queues', { title: 'Files d’attente', queues, extensions, strategies: STRATEGIES });
}));
app.post('/files', signedIn, adminOnly, page(async (req, res) => {
  await api('POST', '/api/centrex/queues', { as: as(req), body: { number: String(req.body.number ?? '').trim(), name: String(req.body.name ?? '').trim(), strategy: STRATEGIES[req.body.strategy] ? req.body.strategy : 'longest-idle-agent', members: members(req.body), maxWaitSeconds: Number(req.body.maxWaitSeconds) || 300 } });
  flash(req, 'success', 'File d’attente créée.');
  res.redirect('/files');
}));
app.post('/files/:id', signedIn, adminOnly, page(async (req, res) => {
  await api('PUT', `/api/centrex/queues/${encodeURIComponent(req.params.id)}`, { as: as(req), body: { name: String(req.body.name ?? '').trim(), strategy: STRATEGIES[req.body.strategy] ? req.body.strategy : undefined, members: members(req.body), maxWaitSeconds: Number(req.body.maxWaitSeconds) || undefined } });
  flash(req, 'success', 'File d’attente enregistrée.');
  res.redirect('/files');
}));
app.post('/files/:id/supprimer', signedIn, adminOnly, page(async (req, res) => {
  await api('DELETE', `/api/centrex/queues/${encodeURIComponent(req.params.id)}`, { as: as(req) });
  flash(req, 'success', 'File d’attente supprimée.');
  res.redirect('/files');
}));

app.get('/appels', signedIn, adminOnly, page(async (req, res) => {
  const pageNo = Math.max(1, Number(req.query.page) || 1);
  const direction = ['INBOUND', 'OUTBOUND', 'INTERNAL'].includes(req.query.sens) ? req.query.sens : '';
  const answered = ['yes', 'no'].includes(req.query.repondu) ? req.query.repondu : '';
  const cdr = await api('GET', '/api/centrex/cdr', { as: as(req), query: { page: pageNo, pageSize: 50, direction, answered } });
  render(req, res, 'calls', { title: 'Journal des appels', cdr, pageNo, direction, answered });
}));

app.get('/messagerie', signedIn, adminOnly, page(async (req, res) => {
  const vm = await api('GET', '/api/v1/voicemail', { as: as(req) });
  render(req, res, 'voicemail', { title: 'Messagerie vocale', vm });
}));
app.post('/messagerie/:ext/:uuid/ecouter', signedIn, adminOnly, page(async (req, res) => {
  const r = await api('POST', `/api/v1/voicemail/${encodeURIComponent(req.params.ext)}/${encodeURIComponent(req.params.uuid)}/url`, { as: as(req) });
  res.redirect(r.url);
}));
app.post('/messagerie/:ext/:uuid/supprimer', signedIn, adminOnly, page(async (req, res) => {
  await api('DELETE', `/api/v1/voicemail/${encodeURIComponent(req.params.ext)}/${encodeURIComponent(req.params.uuid)}`, { as: as(req) });
  flash(req, 'success', 'Message supprimé.');
  res.redirect('/messagerie');
}));

app.get('/sms', signedIn, adminOnly, page(async (req, res) => {
  const month = /^\d{4}-\d{2}$/.test(String(req.query.mois ?? '')) ? String(req.query.mois) : new Date().toISOString().slice(0, 7);
  const pageNo = Math.max(1, Number(req.query.page) || 1);
  const [balance, history] = await Promise.all([
    api('GET', '/api/v1/sms/balance', { as: as(req) }).catch((e) => ({ error: e.message })),
    api('GET', '/api/org/messaging/history', { as: as(req), query: { month, page: pageNo, pageSize: 50 } }).catch(() => null),
  ]);
  render(req, res, 'sms', { title: 'SMS', balance, history, month, pageNo });
}));
app.post('/sms', signedIn, adminOnly, page(async (req, res) => {
  const r = await api('POST', '/api/v1/sms', { as: as(req), body: { to: String(req.body.to ?? '').trim(), text: String(req.body.text ?? '').trim() } });
  flash(req, 'success', `SMS envoyé à ${phone(r.to)} (${r.segments} SMS compté${r.segments > 1 ? 's' : ''}). Il part dans quelques secondes.`);
  res.redirect('/sms');
}));

app.get('/factures', signedIn, adminOnly, page(async (req, res) => {
  const b = await api('GET', '/api/billing', { as: as(req) });
  render(req, res, 'invoices', { title: 'Abonnement et factures', b });
}));
app.get('/factures/:id.pdf', signedIn, adminOnly, page(async (req, res) => {
  const r = await api('GET', `/api/billing/invoices/${encodeURIComponent(req.params.id)}`, { as: as(req), raw: true });
  res.set({ 'Content-Type': 'application/pdf', 'Content-Disposition': r.headers.get('content-disposition') ?? 'inline', 'Cache-Control': 'private, no-store' });
  res.send(Buffer.from(await r.arrayBuffer()));
}));

// panneau complet (fonctions avancées) : lien de connexion à usage unique
app.post('/panneau', signedIn, page(async (req, res) => {
  const r = await api('POST', `/api/reseller/clients/${encodeURIComponent(req.session.user.orgId)}/login-link`, { body: { user: req.session.user.id, ttlSeconds: 60 } });
  // page intermédiaire : un formulaire ne peut pas rediriger vers un autre domaine (politique de sécurité)
  res.set('Cache-Control', 'no-store');
  render(req, res, 'open-panel', { title: 'Ouverture du panneau', url: r.url });
}));

app.use((req, res) => render(req, res, 'error', { title: 'Page introuvable', message: 'Cette page n’existe pas.' }, 404));

// ------------------------------------------------------------------ démarrage
const problems = checkConfig();
if (problems.length) {
  console.error(`Configuration incomplète :\n- ${problems.join('\n- ')}\nVoir .env.example.`);
  process.exit(1);
}
export default app;
if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  app.listen(config.port, () => console.log(`${config.brand.name} : espace client sur http://localhost:${config.port}`));
}
