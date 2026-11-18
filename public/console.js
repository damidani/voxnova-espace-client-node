/* Espace client : « Toutes les fonctions » (chaque opération de l'API, formulaire généré depuis sa description)
   et pages de gestion (postes, groupes d'appel, standards vocaux, contacts, webhooks…).
   Les appels passent par l'espace client, qui utilise le SDK officiel : le navigateur ne voit jamais la clé d'API. */
(function () {
  'use strict';
  var $ = function (sel, root) { return (root || document).querySelector(sel); };
  var $$ = function (sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); };
  var csrf = (document.querySelector('meta[name="csrf"]') || {}).content || '';
  var esc = function (s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); };
  var icon = function (name) { return '<svg class="ico" aria-hidden="true"><use href="#i-' + name + '"/></svg>'; };
  var root = $('#console') || $('#resource');
  if (!root) return;
  var BASE = '/fonctions';

  // ---------------------------------------------------------------- appels vers l'espace client
  var opsCache = null;
  function loadOps() {
    if (opsCache) return opsCache;
    opsCache = fetch(BASE + '/operations', { credentials: 'same-origin' }).then(function (r) { if (!r.ok) throw new Error('Catalogue indisponible'); return r.json(); });
    return opsCache;
  }
  function call(id, params, body, query) {
    return fetch(BASE + '/appel', { method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': csrf }, body: JSON.stringify({ id: id, params: params || {}, body: body, query: query || {} }) })
      .then(function (r) { return r.json().catch(function () { return {}; }).then(function (j) { if (!r.ok) { var e = new Error(j.error || 'Erreur ' + r.status); e.details = j.errors || []; throw e; } return j.result; }); });
  }
  function fileUrl(id, params, query) { return BASE + '/fichier?op=' + encodeURIComponent(id) + '&params=' + encodeURIComponent(JSON.stringify(params || {})) + '&query=' + encodeURIComponent(JSON.stringify(query || {})); }
  var isDownload = function (op) { return op.method === 'GET' && /(\.csv|\.pdf|\/file$|\/listen$|\/preview$|\/download$|\/files\/)/.test(op.path); };

  // ---------------------------------------------------------------- libellés
  var LABELS = { id: 'Identifiant', name: 'Nom', number: 'Numéro', displayName: 'Nom affiché', enabled: 'Actif', email: 'E-mail', phone: 'Téléphone', mobile: 'Mobile', company: 'Société', firstName: 'Prénom', lastName: 'Nom', label: 'Libellé', description: 'Description', strategy: 'Répartition', members: 'Membres', ringSeconds: 'Durée de sonnerie (s)', timeoutSeconds: 'Délai (s)', url: 'Adresse', events: 'Événements', secret: 'Secret', status: 'État', createdAt: 'Créé le', updatedAt: 'Modifié le', startedAt: 'Début', durationSec: 'Durée (s)', type: 'Type', role: 'Rôle', note: 'Note', notes: 'Notes', password: 'Mot de passe', pin: 'Code', language: 'Langue', timezone: 'Fuseau horaire', destType: 'Destination', destId: 'Destination (identifiant)', destValue: 'Destination (valeur)', extensionId: 'Poste', queueId: 'File d’attente', userId: 'Utilisateur', callerId: 'Numéro présenté', voicemail: 'Messagerie', recordCalls: 'Enregistrer les appels', permission: 'Appels autorisés', direction: 'Sens', from: 'Du', to: 'Au', page: 'Page', pageSize: 'Par page', q: 'Recherche', search: 'Recherche', month: 'Mois', title: 'Titre', text: 'Texte', message: 'Message', address: 'Adresse', city: 'Ville', zip: 'Code postal', country: 'Pays', active: 'Actif', priority: 'Priorité', key: 'Clé', prefix: 'Préfixe', lastUsedAt: 'Dernière utilisation', online: 'En ligne', registered: 'Connecté', mac: 'Adresse MAC', model: 'Modèle', platform: 'Plateforme', version: 'Version', jobTitle: 'Fonction', favorite: 'Favori', tags: 'Étiquettes', shared: 'Partagé', emails: 'E-mails', phones: 'Téléphones', matchType: 'Règle', matchValue: 'Valeur', elseType: 'Sinon', elseValue: 'Sinon (valeur)', fallbackType: 'Si personne ne répond', fallbackValue: 'Si personne ne répond (valeur)', maxFailures: 'Essais', directDial: 'Numérotation directe', answered: 'Répondus', asr: 'Taux de réponse (%)', acdSec: 'Durée moyenne', talkSec: 'Temps de conversation', inboundMissed: 'Reçus manqués', costCents: 'Coût', perDay: 'Par jour', day: 'Jour', inbound: 'Reçus', outbound: 'Passés', internal: 'Internes', missed: 'Manqués', total: 'Total', lastStatus: 'Dernier envoi', topExtensions: 'Postes les plus actifs', byHour: 'Par heure', hour: 'Heure', calls: 'Appels', count: 'Nombre', duration: 'Durée', recording: 'Enregistrement', caller: 'Appelant', callerNumber: 'Appelant', callerName: 'Nom de l’appelant', destination: 'Destination', billSec: 'Durée facturée (s)', answeredAt: 'Décroché', endedAt: 'Fin', maxWaitSeconds: 'Attente maximale (s)', announceId: 'Annonce', musicId: 'Musique d’attente', greetingId: 'Accueil', invalidId: 'Message d’erreur', timeoutId: 'Message sans réponse', exitKey: 'Touche de sortie', targetType: 'Cible', targetId: 'Cible (identifiant)', origins: 'Sites autorisés', days: 'Jours', from_: 'De' };
  var label = function (k) { return LABELS[k] || String(k).replace(/([a-z])([A-Z])/g, '$1 $2').replace(/[_-]/g, ' ').replace(/^./, function (c) { return c.toUpperCase(); }); };
  var METHOD = { GET: 'Lire', POST: 'Créer / agir', PUT: 'Modifier', PATCH: 'Modifier', DELETE: 'Supprimer' };

  // ---------------------------------------------------------------- formulaire généré depuis un schéma
  function typeOf(s) {
    if (!s) return 'json';
    if (s.enum) return 'enum';
    var alt = s.anyOf || s.oneOf;
    if (alt) { var nn = alt.filter(function (x) { return x.type !== 'null'; }); if (nn.length === 1) return typeOf(nn[0]); if (nn.every(function (x) { return x.const !== undefined; })) return 'enum'; return 'json'; }
    var t = Array.isArray(s.type) ? s.type.filter(function (x) { return x !== 'null'; })[0] : s.type;
    if (t === 'array') { var it = s.items || {}; var ti = Array.isArray(it.type) ? it.type[0] : it.type; return (ti === 'string' || ti === 'integer' || ti === 'number') && !it.enum ? 'list' : (it.enum ? 'multi' : 'json'); }
    if (t === 'string' || t === 'integer' || t === 'number' || t === 'boolean') return t;
    if (t === 'object' && !s.properties) return 'json';
    return t === 'object' ? 'json' : (t || 'json');
  }
  function enumValues(s) {
    if (s.enum) return s.enum;
    var alt = (s.anyOf || s.oneOf || []).filter(function (x) { return x.type !== 'null'; });
    if (alt.length === 1 && alt[0].enum) return alt[0].enum;
    return alt.map(function (x) { return x.const; });
  }
  function field(name, s, value, required, prefix) {
    var id = (prefix || 'f') + '-' + name.replace(/[^\w]/g, '_');
    var t = typeOf(s);
    var lab = '<label for="' + id + '">' + esc(label(name)) + (required ? ' <span class="req">*</span>' : '') + (s && s.description ? ' <span class="mut small">· ' + esc(s.description) + '</span>' : '') + '</label>';
    var nullable = s && ((s.anyOf || s.oneOf || []).some(function (x) { return x.type === 'null'; }) || (Array.isArray(s.type) && s.type.indexOf('null') >= 0));
    var attrs = ' id="' + id + '" data-name="' + esc(name) + '" data-type="' + t + '"' + (nullable ? ' data-nullable="1"' : '') + (required ? ' data-required="1"' : '');
    var v = value === undefined || value === null ? '' : value;
    switch (t) {
      case 'boolean': return '<label class="switch field-bool"><input type="checkbox"' + attrs + (value === true || (value === undefined && s && s.default === true) ? ' checked' : '') + '> ' + esc(label(name)) + '</label>';
      case 'enum': {
        var vals = enumValues(s);
        return lab + '<select' + attrs + '>' + (required ? '' : '<option value="">—</option>') + vals.map(function (x) { return '<option value="' + esc(JSON.stringify(x)) + '"' + (x === value || (value === undefined && s.default === x) ? ' selected' : '') + '>' + esc(x) + '</option>'; }).join('') + '</select>';
      }
      case 'multi': {
        var opts = s.items.enum;
        return lab + '<div class="checks"' + attrs + '>' + opts.map(function (x) { return '<label><input type="checkbox" value="' + esc(JSON.stringify(x)) + '"' + ((value || []).indexOf(x) >= 0 ? ' checked' : '') + '> ' + esc(x) + '</label>'; }).join('') + '</div>';
      }
      case 'integer': case 'number': return lab + '<input class="input" type="number"' + (t === 'number' ? ' step="any"' : '') + attrs + ' value="' + esc(v) + '"' + (s.minimum !== undefined ? ' min="' + s.minimum + '"' : '') + (s.maximum !== undefined && s.maximum < 1e12 ? ' max="' + s.maximum + '"' : '') + ' placeholder="' + esc(s.default !== undefined ? s.default : '') + '">';
      case 'list': return lab + '<input class="input"' + attrs + ' value="' + esc(Array.isArray(value) ? value.join(', ') : v) + '" placeholder="valeur 1, valeur 2">';
      case 'string':
        if ((s.maxLength || 0) > 300 || /text|message|body|description|notes?|prompt|instructions/i.test(name)) return lab + '<textarea rows="4"' + attrs + '>' + esc(v) + '</textarea>';
        return lab + '<input class="input"' + attrs + ' value="' + esc(v) + '"' + (/password|secret/i.test(name) ? ' type="password" autocomplete="new-password"' : s.format === 'email' || name === 'email' ? ' type="email"' : s.format === 'date-time' ? ' placeholder="2026-12-01T09:00:00Z"' : '') + (s.maxLength ? ' maxlength="' + s.maxLength + '"' : '') + '>';
      default: return lab + '<textarea rows="5" class="mono"' + attrs + ' placeholder="' + esc('JSON, par exemple : ' + JSON.stringify(example(s))) + '">' + esc(value === undefined ? '' : JSON.stringify(value, null, 2)) + '</textarea>';
    }
  }
  /** Exemple de valeur JSON tiré du schéma (aide à la saisie des champs complexes). */
  function example(s, d) {
    d = d || 0;
    if (!s || d > 4) return null;
    if (s.default !== undefined) return s.default;
    if (s.enum) return s.enum[0];
    var alt = s.anyOf || s.oneOf;
    if (alt) return example(alt.filter(function (x) { return x.type !== 'null'; })[0], d + 1);
    var t = Array.isArray(s.type) ? s.type.filter(function (x) { return x !== 'null'; })[0] : s.type;
    if (t === 'array') { var e = example(s.items, d + 1); return e === null ? [] : [e]; }
    if (t === 'object' || s.properties) { var o = {}; Object.keys(s.properties || {}).slice(0, 6).forEach(function (k) { o[k] = example(s.properties[k], d + 1); }); return o; }
    return t === 'integer' || t === 'number' ? 0 : t === 'boolean' ? false : t === 'string' ? '…' : null;
  }
  function schemaFields(schema, values, prefix) {
    if (!schema) return '';
    var props = schema.properties;
    if (!props) return field('corps', schema, values, false, prefix);
    var req = schema.required || [];
    var keys = Object.keys(props).sort(function (a, b) { return (req.indexOf(b) >= 0) - (req.indexOf(a) >= 0); });
    return keys.map(function (k) { return '<div class="fld">' + field(k, props[k], values ? values[k] : undefined, req.indexOf(k) >= 0, prefix) + '</div>'; }).join('');
  }
  /** Lit les champs ; touched : seuls les champs remplis (ou modifiés) sont envoyés. */
  function readFields(box, original) {
    var out = {};
    var errors = [];
    $$('[data-name]', box).forEach(function (el) {
      var k = el.getAttribute('data-name'), t = el.getAttribute('data-type'), req = el.hasAttribute('data-required');
      var orig = original ? original[k] : undefined;
      var v;
      if (t === 'boolean') { v = el.checked; if (!req && orig === undefined && !v && !el.hasAttribute('data-touched')) return; }
      else if (t === 'multi') { v = $$('input:checked', el).map(function (x) { return JSON.parse(x.value); }); if (!v.length && !req && orig === undefined) return; }
      else {
        var raw = el.value.trim();
        if (raw === '') {
          if (req) errors.push(label(k) + ' : obligatoire');
          else if (orig !== undefined && orig !== null && orig !== '' && el.hasAttribute('data-nullable')) out[k] = null;
          else if (orig !== undefined && orig !== null && orig !== '' && t === 'string') out[k] = '';
          return;
        }
        if (t === 'integer' || t === 'number') v = Number(raw);
        else if (t === 'enum') v = JSON.parse(raw);
        else if (t === 'list') { var it = el.getAttribute('data-items'); v = raw.split(/\s*[,;\n]\s*/).filter(Boolean); }
        else if (t === 'json') { try { v = JSON.parse(raw); } catch (e) { errors.push(label(k) + ' : JSON invalide'); return; } }
        else v = raw;
      }
      out[k] = v;
    });
    if (errors.length) { var e = new Error(errors[0]); e.details = errors; throw e; }
    return out;
  }

  // ---------------------------------------------------------------- affichage des résultats
  var isScalar = function (v) { return v === null || ['string', 'number', 'boolean'].indexOf(typeof v) >= 0; };
  function fmt(k, v) {
    if (v === null || v === undefined || v === '') return '<span class="mut">—</span>';
    if (typeof v === 'boolean') return v ? '<span class="badge ok">Oui</span>' : '<span class="badge">Non</span>';
    if (typeof v === 'string' && /^\d{4}-\d{2}-\d{2}T/.test(v)) return esc(new Date(v).toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'short' }));
    if (typeof v === 'string' && /^\+33\d{9}$/.test(v)) return '<span class="num">' + esc(v.replace(/^\+33(\d)(\d{2})(\d{2})(\d{2})(\d{2})$/, '0$1 $2 $3 $4 $5')) + '</span>';
    if (/cents$/i.test(k) && typeof v === 'number') return esc((v / 100).toLocaleString('fr-FR', { style: 'currency', currency: 'EUR' }));
    if (Array.isArray(v)) return v.every(isScalar) ? esc(v.join(', ')) : '<span class="badge">' + v.length + ' élément' + (v.length > 1 ? 's' : '') + '</span>';
    if (typeof v === 'object') return '<span class="badge">' + Object.keys(v).length + ' champ' + (Object.keys(v).length > 1 ? 's' : '') + '</span>';
    return esc(v);
  }
  function columnsOf(rows, preferred) {
    if (preferred) return preferred;
    var keys = [];
    rows.slice(0, 20).forEach(function (r) { Object.keys(r || {}).forEach(function (k) { if (keys.indexOf(k) < 0 && isScalar(r[k])) keys.push(k); }); });
    var skip = ['id', 'orgId', 'resellerId', 'createdAt', 'updatedAt', 'passwordHash', 'secret', 'sipPassword'];
    var rank = ['number', 'name', 'displayName', 'label', 'firstName', 'lastName', 'company', 'email', 'phone', 'status', 'enabled', 'active', 'type', 'url'];
    keys = keys.filter(function (k) { return skip.indexOf(k) < 0 && !/Id$/.test(k); });
    keys.sort(function (a, b) { var ia = rank.indexOf(a), ib = rank.indexOf(b); return (ia < 0 ? 99 : ia) - (ib < 0 ? 99 : ib); });
    return keys.slice(0, 6);
  }
  var rowsOf = function (r) { return Array.isArray(r) ? r : r && Array.isArray(r.items) ? r.items : r && Array.isArray(r.rows) ? r.rows : null; };
  function table(rows, cols, actions) {
    if (!rows.length) return '<div class="empty">' + icon('grid') + '<b>Rien pour l’instant</b></div>';
    cols = columnsOf(rows, cols);
    return '<div class="scroll"><table class="table"><thead><tr>' + cols.map(function (c) { return '<th>' + esc(label(c)) + '</th>'; }).join('') + (actions ? '<th></th>' : '') + '</tr></thead><tbody>'
      + rows.map(function (r, i) { return '<tr>' + cols.map(function (c) { return '<td>' + fmt(c, r[c]) + '</td>'; }).join('') + (actions ? '<td class="row-actions">' + actions(r, i) + '</td>' : '') + '</tr>'; }).join('') + '</tbody></table></div>';
  }
  function show(result) {
    var rows = rowsOf(result);
    var html = '';
    if (rows && rows.every(function (x) { return x && typeof x === 'object'; })) html = table(rows) + (result && result.total !== undefined ? '<p class="small mut pad">' + result.total + ' au total</p>' : '');
    else if (result && typeof result === 'object' && !Array.isArray(result)) {
      var ks = Object.keys(result);
      html = '<dl class="kv">' + ks.map(function (k) { return '<dt>' + esc(label(k)) + '</dt><dd>' + fmt(k, result[k]) + '</dd>'; }).join('') + '</dl>';
    } else html = '<p class="pad">' + fmt('', result) + '</p>';
    return html + '<details class="raw"><summary>' + icon('hash') + ' Réponse complète (JSON)</summary><pre>' + esc(JSON.stringify(result, null, 2)) + '</pre></details>';
  }
  var errorBox = function (e) { return '<div class="alert error">' + icon('alert') + '<div><b>' + esc(e.message) + '</b>' + (e.details && e.details.length > 1 ? '<ul class="issues">' + e.details.map(function (x) { return '<li>' + esc(typeof x === 'string' ? x : JSON.stringify(x)) + '</li>'; }).join('') + '</ul>' : '') + '</div></div>'; };

  // =================================================================== console « Toutes les fonctions »
  if (root.id === 'console') {
    var state = { ops: [], q: '', sec: '', sel: null };
    var list = $('#ops-list'), detail = $('#op-detail');
    var renderList = function () {
      var q = state.q.toLowerCase();
      var shown = state.ops.filter(function (o) { return (!state.sec || o.section === state.sec) && (!q || (o.summary + ' ' + o.path + ' ' + o.section + ' ' + o.id).toLowerCase().indexOf(q) >= 0); });
      var bySec = {};
      shown.forEach(function (o) { (bySec[o.section] = bySec[o.section] || []).push(o); });
      list.innerHTML = Object.keys(bySec).map(function (s) {
        return '<div class="ops-sec"><h3>' + esc(s) + ' <span class="mut small">' + bySec[s].length + '</span></h3>' + bySec[s].map(function (o) {
          return '<button type="button" class="op' + (state.sel === o.id ? ' on' : '') + '" data-op="' + esc(o.id) + '"><span class="m m-' + o.method.toLowerCase() + '">' + o.method + '</span><span>' + esc(o.summary || o.path) + '</span></button>';
        }).join('') + '</div>';
      }).join('') || '<div class="empty"><b>Aucune fonction ne correspond</b></div>';
      $('#ops-count').textContent = shown.length + ' fonction' + (shown.length > 1 ? 's' : '');
      $$('[data-op]', list).forEach(function (b) { b.addEventListener('click', function () { open(b.getAttribute('data-op')); }); });
    };
    var open = function (id) {
      var o = state.ops.filter(function (x) { return x.id === id; })[0];
      if (!o) return;
      state.sel = id;
      try { history.replaceState(null, '', '#' + id); } catch (e) { /* aperçu */ }
      renderList();
      var dl = isDownload(o);
      detail.innerHTML = '<div class="card"><div class="op-head"><span class="m m-' + o.method.toLowerCase() + '">' + o.method + '</span><code>' + esc(o.path) + '</code>' + (o.access === 'user' ? '<span class="badge ok">Tous les utilisateurs</span>' : '<span class="badge warn">Administrateur</span>') + '</div>'
        + '<h2>' + esc(o.summary || o.id) + '</h2>' + (o.description ? '<p class="mut small">' + esc(o.description) + '</p>' : '')
        + '<p class="small mut">SDK : <code>vx.api.' + esc(o.id) + '(…)</code></p>'
        + '<form id="op-form" novalidate>'
        + (o.params.length ? '<h3 class="form-sec">Dans l’adresse</h3>' + o.params.map(function (p) { return '<div class="fld"><label for="p-' + esc(p) + '">' + esc(label(p)) + ' <span class="req">*</span></label><input class="input" id="p-' + esc(p) + '" data-param="' + esc(p) + '" required></div>'; }).join('') : '')
        + (o.query.length ? '<h3 class="form-sec">Filtres</h3><div class="q-fields">' + o.query.map(function (x) { return '<div class="fld">' + field(x.name, x.schema, undefined, x.required, 'q') + '</div>'; }).join('') + '</div>' : '')
        + (o.body && o.method !== 'GET' ? (o.multipart ? '<h3 class="form-sec">Fichier</h3><input class="input" type="file" name="file" id="op-file" required>' + (o.body.properties ? Object.keys(o.body.properties).filter(function (k) { return k !== 'file'; }).map(function (k) { return '<div class="fld"><label for="mp-' + esc(k) + '">' + esc(label(k)) + '</label><input class="input" id="mp-' + esc(k) + '" data-mp="' + esc(k) + '"></div>'; }).join('') : '') : '<h3 class="form-sec">Données</h3><div class="b-fields">' + schemaFields(o.body, undefined, 'b') + '</div>') : '')
        + '<div class="form-end">' + (dl ? '<button class="btn" type="submit">' + icon('arrow') + ' Télécharger</button>' : '<button class="btn" type="submit">' + icon('play') + ' ' + (o.method === 'GET' ? 'Afficher' : o.method === 'DELETE' ? 'Supprimer' : 'Envoyer') + '</button>') + '</div></form></div><div id="op-out"></div>';
      $$('.field-bool input', detail).forEach(function (x) { x.addEventListener('change', function () { x.setAttribute('data-touched', '1'); }); });
      $('#op-form').addEventListener('submit', function (ev) {
        ev.preventDefault();
        var out = $('#op-out');
        var params = {};
        $$('[data-param]', detail).forEach(function (x) { params[x.getAttribute('data-param')] = x.value.trim(); });
        var missing = o.params.filter(function (p) { return !params[p]; });
        if (missing.length) { out.innerHTML = errorBox(new Error(label(missing[0]) + ' : obligatoire')); return; }
        var query, body;
        try { query = $('.q-fields', detail) ? readFields($('.q-fields', detail)) : {}; body = $('.b-fields', detail) ? readFields($('.b-fields', detail)) : undefined; } catch (e) { out.innerHTML = errorBox(e); return; }
        if (dl) { window.location.href = fileUrl(o.id, params, query); return; }
        if (o.method === 'DELETE' && !window.confirm('Confirmer la suppression ?')) return;
        out.innerHTML = '<div class="card"><p class="mut">Envoi…</p></div>';
        var done = function (r) { out.innerHTML = '<div class="card flush"><div class="card-head"><h2>' + icon('check') + ' Résultat</h2></div>' + show(r) + '</div>'; };
        if (o.multipart) {
          var fd = new FormData();
          $$('[data-mp]', detail).forEach(function (x) { if (x.value) fd.append(x.getAttribute('data-mp'), x.value); });
          var f = $('#op-file').files[0];
          if (!f) { out.innerHTML = errorBox(new Error('Choisissez un fichier')); return; }
          fd.append('file', f, f.name);
          fetch(BASE + '/envoi?op=' + encodeURIComponent(o.id) + '&params=' + encodeURIComponent(JSON.stringify(params)), { method: 'POST', credentials: 'same-origin', headers: { 'X-CSRF-Token': csrf }, body: fd })
            .then(function (r) { return r.json().then(function (j) { if (!r.ok) { var e = new Error(j.error || 'Erreur'); e.details = j.errors; throw e; } return j.result; }); }).then(done).catch(function (e) { out.innerHTML = errorBox(e); });
          return;
        }
        call(o.id, params, body, query).then(done).catch(function (e) { out.innerHTML = errorBox(e); });
      });
      if (window.innerWidth < 1100) detail.scrollIntoView({ behavior: 'smooth' });
    };
    loadOps().then(function (ops) {
      state.ops = ops;
      var secs = [];
      ops.forEach(function (o) { if (secs.indexOf(o.section) < 0) secs.push(o.section); });
      $('#ops-sec').innerHTML = '<option value="">Toutes les rubriques (' + ops.length + ')</option>' + secs.sort().map(function (s) { return '<option>' + esc(s) + '</option>'; }).join('');
      $('#ops-q').addEventListener('input', function (e) { state.q = e.target.value; renderList(); });
      $('#ops-sec').addEventListener('change', function (e) { state.sec = e.target.value; renderList(); });
      renderList();
      var fromHash = function () { var h = decodeURIComponent((location.hash || '').slice(1)); if (h && h !== state.sel) open(h); };
      window.addEventListener('hashchange', fromHash);
      fromHash();
    }).catch(function (e) { list.innerHTML = errorBox(e); });
  }

  // =================================================================== pages de gestion
  if (root.id === 'resource') {
    var RES = {
      postes: { title: 'Postes', icon: 'phone', intro: 'Chaque utilisateur, téléphone ou application a son poste : numéro interne, renvois, messagerie, enregistrement.', list: 'org.extensions.list', create: 'org.extensions.create', update: 'org.extensions.update', remove: 'org.extensions.delete', cols: ['number', 'displayName', 'enabled'],
        actions: [{ label: 'Paramètres SIP', icon: 'shield', op: 'org.extensions.getSipAccount' }, { label: 'État', icon: 'zap', op: 'org.extensions.getStatus' }, { label: 'Nouveau mot de passe SIP', icon: 'alert', op: 'org.extensions.sipPassword', confirm: 'Les téléphones configurés avec l’ancien mot de passe seront déconnectés. Continuer ?' }] },
      groupes: { title: 'Groupes d’appel', icon: 'users', intro: 'Plusieurs postes sonnent ensemble ou à tour de rôle.', list: 'centrex.ringGroups.list', create: 'centrex.ringGroups.create', update: 'centrex.ringGroups.update', remove: 'centrex.ringGroups.delete' },
      standards: { title: 'Standards vocaux', icon: 'hash', intro: '« Tapez 1, tapez 2 » : menus vocaux simples. Pour des parcours complets, utilisez les scénarios d’appel.', list: 'centrex.ivr.list', create: 'centrex.ivr.create', update: 'centrex.ivr.update', remove: 'centrex.ivr.delete' },
      horaires: { title: 'Horaires', icon: 'clock', intro: 'Heures d’ouverture, jours fériés, fermetures : l’appel suit une destination différente selon le moment.', list: 'centrex.timeConditions.list', create: 'centrex.timeConditions.create', update: 'centrex.timeConditions.update', remove: 'centrex.timeConditions.delete' },
      conferences: { title: 'Conférences', icon: 'users', intro: 'Salles de réunion téléphoniques, avec code d’accès.', list: 'centrex.conferences.list', create: 'centrex.conferences.create', update: 'centrex.conferences.update', remove: 'centrex.conferences.delete', actions: [{ label: 'Participants', icon: 'users', op: 'centrex.conferences.getLive' }] },
      contacts: { title: 'Contacts', icon: 'users', intro: 'Annuaire partagé : nom affiché à l’appel, recherche depuis les téléphones et les applications.', list: 'contacts.list', create: 'contacts.create', update: 'contacts.update', remove: 'contacts.delete', exportOp: 'contacts.exportCsv.get', actions: [{ label: 'Appels', icon: 'history', op: 'contacts.getCalls' }] },
      appareils: { title: 'Appareils', icon: 'phone', intro: 'Applications mobiles et de bureau connectées par vos utilisateurs.', list: 'org.devices.get' },
      rappels: { title: 'Demandes de rappel', icon: 'callback', intro: 'Appelants qui ont demandé à être rappelés (scénarios, site internet, API).', list: 'org.callbacks.list', create: 'org.callbacks.create', remove: 'org.callbacks.delete', actions: [{ label: 'Bloquer ce numéro', icon: 'x', op: 'org.callbacks.block', confirm: 'Bloquer ce numéro pour les prochaines demandes ?' }] },
      webhooks: { title: 'Webhooks', icon: 'zap', intro: 'Votre logiciel reçoit les événements en direct : appel terminé, message vocal, SMS, facture…', list: 'centrex.webhooks.list', create: 'centrex.webhooks.create', update: 'centrex.webhooks.update', remove: 'centrex.webhooks.delete', cols: ['url', 'events', 'enabled', 'lastStatus'],
        actions: [{ label: 'Tester', icon: 'play', op: 'centrex.webhooks.test' }, { label: 'Journal des envois', icon: 'history', op: 'centrex.webhooks.getDeliveries' }] },
      cles: { title: 'Clés d’API', icon: 'shield', intro: 'Pour connecter votre logiciel à votre téléphonie. La clé complète n’est affichée qu’une fois, à la création.', list: 'centrex.apiKeys.list', create: 'centrex.apiKeys.create', remove: 'centrex.apiKeys.delete' },
      statistiques: { title: 'Statistiques', icon: 'chart', intro: 'Volumes d’appels, durées, appels manqués et postes les plus actifs.', view: 'centrex.stats.get', filters: true },
    };
    var key = root.getAttribute('data-resource');
    var R = RES[key];
    var box = $('#res-body');
    if (!R) { box.innerHTML = errorBox(new Error('Page inconnue')); return; }
    $('#res-title').textContent = R.title;
    $('#res-intro').textContent = R.intro;
    loadOps().then(function (ops) {
      var op = function (id) { return ops.filter(function (o) { return o.id === id; })[0]; };
      var rows = [];
      var modal = $('#res-form');
      var head = $('#res-actions');
      head.innerHTML = (R.exportOp && op(R.exportOp) ? '<a class="btn ghost" href="' + fileUrl(R.exportOp, {}, {}) + '">' + icon('arrow') + ' Exporter</a>' : '') + (R.create && op(R.create) ? '<button type="button" class="btn" id="res-new">' + icon('plus') + ' Ajouter</button>' : '') + '<a class="btn ghost" href="/fonctions#' + esc(R.list || R.view) + '">' + icon('grid') + ' Toutes les fonctions</a>';
      var form = function (title, schema, values, onSubmit) {
        modal.innerHTML = '<div class="card"><div class="card-head"><h2>' + esc(title) + '</h2><button type="button" class="btn ghost sm" id="res-cancel">Fermer</button></div><form id="res-f" novalidate><div class="form-grid">' + schemaFields(schema, values, 'r') + '</div><div class="form-end"><button class="btn">' + icon('check') + ' Enregistrer</button></div><div id="res-err"></div></form></div>';
        $$('.field-bool input', modal).forEach(function (x) { x.addEventListener('change', function () { x.setAttribute('data-touched', '1'); }); });
        $('#res-cancel').addEventListener('click', function () { modal.innerHTML = ''; });
        $('#res-f').addEventListener('submit', function (ev) {
          ev.preventDefault();
          var data;
          try { data = readFields($('#res-f'), values); } catch (e) { $('#res-err').innerHTML = errorBox(e); return; }
          onSubmit(data).then(function (r) { modal.innerHTML = r && (r.key || r.secret || r.token) ? '<div class="alert success">' + icon('check') + '<div><b>Enregistré.</b> À copier maintenant, elle ne sera plus affichée : <code class="copy">' + esc(r.key || r.secret || r.token) + '</code></div></div>' : ''; reload(); }).catch(function (e) { $('#res-err').innerHTML = errorBox(e); });
        });
        modal.scrollIntoView({ behavior: 'smooth', block: 'start' });
        var first = $('input, select, textarea', modal); if (first) first.focus();
      };
      if ($('#res-new')) $('#res-new').addEventListener('click', function () { var o = op(R.create); form('Ajouter', o.body, undefined, function (d) { return call(R.create, {}, d); }); });
      var reload = function () {
        if (R.view) {
          var q = {};
          if (R.filters) { var f = $('#res-from'), t = $('#res-to'); if (f && f.value) q.from = f.value; if (t && t.value) q.to = t.value; }
          box.innerHTML = '<div class="card"><p class="mut">Chargement…</p></div>';
          return call(R.view, {}, undefined, q).then(function (r) { box.innerHTML = (R.filters ? '<form class="card row" id="res-filter"><div><label for="res-from">Du</label><input class="input" type="date" id="res-from" value="' + esc(q.from || '') + '"></div><div><label for="res-to">Au</label><input class="input" type="date" id="res-to" value="' + esc(q.to || '') + '"></div><div class="fit"><button class="btn ghost">Afficher</button></div></form>' : '') + statsView(r); if ($('#res-filter')) $('#res-filter').addEventListener('submit', function (e) { e.preventDefault(); reload(); }); }).catch(function (e) { box.innerHTML = errorBox(e); });
        }
        box.innerHTML = '<div class="card"><p class="mut">Chargement…</p></div>';
        return call(R.list, {}, undefined, {}).then(function (r) {
          rows = rowsOf(r) || [];
          var acts = function (row, i) {
            return (R.update && op(R.update) ? '<button type="button" class="btn ghost sm" data-edit="' + i + '">Modifier</button>' : '')
              + (R.actions || []).filter(function (a) { return op(a.op); }).map(function (a, j) { return '<button type="button" class="btn ghost sm" data-act="' + i + ':' + j + '" title="' + esc(a.label) + '">' + icon(a.icon) + '<span class="sr-label">' + esc(a.label) + '</span></button>'; }).join('')
              + (R.remove && op(R.remove) ? '<button type="button" class="btn danger sm" data-del="' + i + '" aria-label="Supprimer">' + icon('trash') + '</button>' : '');
          };
          box.innerHTML = '<div class="card flush"><div class="card-head"><h2>' + esc(R.title) + '</h2><span class="mut small">' + rows.length + '</span></div>' + table(rows, R.cols, acts) + '</div><div id="res-out"></div>';
          $$('[data-edit]', box).forEach(function (b) { b.addEventListener('click', function () { var row = rows[Number(b.getAttribute('data-edit'))]; var o = op(R.update); form('Modifier', o.body, row, function (d) { return call(R.update, { id: row.id }, d); }); }); });
          $$('[data-del]', box).forEach(function (b) { b.addEventListener('click', function () { var row = rows[Number(b.getAttribute('data-del'))]; if (!window.confirm('Supprimer « ' + (row.name || row.displayName || row.number || row.label || row.url || row.id) + ' » ?')) return; call(R.remove, { id: row.id }).then(reload).catch(function (e) { $('#res-out').innerHTML = errorBox(e); }); }); });
          $$('[data-act]', box).forEach(function (b) {
            b.addEventListener('click', function () {
              var p = b.getAttribute('data-act').split(':'), row = rows[Number(p[0])], a = R.actions.filter(function (x) { return op(x.op); })[Number(p[1])];
              if (a.confirm && !window.confirm(a.confirm)) return;
              var o = op(a.op), params = {};
              o.params.forEach(function (k) { params[k] = row.id; });
              call(a.op, params, o.method === 'GET' ? undefined : {}).then(function (r) { $('#res-out').innerHTML = '<div class="card flush"><div class="card-head"><h2>' + icon(a.icon) + ' ' + esc(a.label) + '</h2><button type="button" class="btn ghost sm" id="res-out-x">Fermer</button></div>' + show(r) + '</div>'; $('#res-out-x').addEventListener('click', function () { $('#res-out').innerHTML = ''; }); $('#res-out').scrollIntoView({ behavior: 'smooth' }); if (o.method !== 'GET') reload(); }).catch(function (e) { $('#res-out').innerHTML = errorBox(e); });
            });
          });
        }).catch(function (e) { box.innerHTML = errorBox(e); });
      };
      var statsView = function (r) {
        var scalars = Object.keys(r || {}).filter(function (k) { return typeof r[k] === 'number'; });
        var lists = Object.keys(r || {}).filter(function (k) { return Array.isArray(r[k]) && r[k].length && typeof r[k][0] === 'object'; });
        var objs = Object.keys(r || {}).filter(function (k) { return r[k] && typeof r[k] === 'object' && !Array.isArray(r[k]); });
        return (scalars.length ? '<div class="grid k4">' + scalars.map(function (k) { return '<div class="card kpi"><span class="chip">' + icon('chart') + '</span><div><div class="v">' + esc(/sec/i.test(k) ? Math.round(r[k] / 60) + ' min' : r[k].toLocaleString('fr-FR')) + '</div><div class="l">' + esc(label(k)) + '</div></div></div>'; }).join('') + '</div>' : '')
          + objs.map(function (k) { return '<div class="card"><h2>' + esc(label(k)) + '</h2>' + show(r[k]).replace(/<details[\s\S]*<\/details>$/, '') + '</div>'; }).join('')
          + lists.map(function (k) { return '<div class="card flush"><div class="card-head"><h2>' + esc(label(k)) + '</h2></div>' + table(r[k]) + '</div>'; }).join('')
          + '<details class="raw card"><summary>' + icon('hash') + ' Données complètes (JSON)</summary><pre>' + esc(JSON.stringify(r, null, 2)) + '</pre></details>';
      };
      reload();
    }).catch(function (e) { box.innerHTML = errorBox(e); });
  }
})();
