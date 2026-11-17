/* Espace client : petites améliorations de l'interface et éditeur de scénarios d'appel.
   Aucune dépendance. Toutes les pages restent utilisables sans ce script, sauf l'éditeur de scénarios. */
(function () {
  'use strict';
  var $ = function (sel, root) { return (root || document).querySelector(sel); };
  var $$ = function (sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); };
  var csrf = (document.querySelector('meta[name="csrf"]') || {}).content || '';
  var esc = function (s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); };
  var icon = function (name, cls) { return '<svg class="ico ' + (cls || '') + '" aria-hidden="true"><use href="#i-' + name + '"/></svg>'; };
  var phone = function (n) { var m = String(n || '').match(/^\+33(\d)(\d{2})(\d{2})(\d{2})(\d{2})$/); return m ? '0' + m[1] + ' ' + m[2] + ' ' + m[3] + ' ' + m[4] + ' ' + m[5] : String(n || ''); };
  var postJson = function (url, body) {
    return fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': csrf }, body: JSON.stringify(body), credentials: 'same-origin' })
      .then(function (r) { return r.json().catch(function () { return {}; }).then(function (j) { if (!r.ok) { var e = new Error(j.error || 'Erreur ' + r.status); e.details = j.errors || []; throw e; } return j; }); });
  };

  // ---------------------------------------------------------------- confirmation avant une action destructive
  document.addEventListener('submit', function (e) {
    var msg = e.target.getAttribute('data-confirm');
    if (msg && !window.confirm(msg)) e.preventDefault();
  });

  // ---------------------------------------------------------------- compteur de SMS
  var GSM = /^[@£$¥èéùìòÇ\nØø\rÅåΔ_ΦΓΛΩΠΨΣΘΞÆæßÉ !"#¤%&'()*+,\-./0-9:;<=>?¡A-ZÄÖÑÜ§¿a-zäöñüà^{}\\[~\]|€]*$/;
  $$('textarea[data-sms-counter]').forEach(function (ta) {
    var out = document.createElement('div');
    out.className = 'hint';
    ta.insertAdjacentElement('afterend', out);
    var upd = function () {
      var t = ta.value, gsm = GSM.test(t), one = gsm ? 160 : 70, part = gsm ? 153 : 67;
      var n = !t ? 0 : t.length <= one ? 1 : Math.ceil(t.length / part);
      out.textContent = t.length + ' caractère' + (t.length > 1 ? 's' : '') + ' · ' + n + ' SMS' + (n > 1 ? ' comptés' : '') + (!gsm && t ? ' · accents spéciaux ou emoji : 70 caractères par SMS' : '');
    };
    ta.addEventListener('input', upd);
    upd();
  });

  // ---------------------------------------------------------------- graphique des appels (30 jours)
  $$('[data-chart]').forEach(function (el) {
    var days = [];
    try { days = JSON.parse(el.getAttribute('data-chart')); } catch (e) { return; }
    if (!days.length) return;
    var W = 720, H = 210, P = { l: 28, r: 8, t: 10, b: 24 };
    var max = Math.max(1, Math.max.apply(null, days.map(function (d) { return d.inbound + d.outbound; })));
    var step = Math.pow(10, Math.floor(Math.log10(max))); var top = Math.ceil(max / step) * step;
    var bw = (W - P.l - P.r) / days.length, y = function (v) { return H - P.b - (v / top) * (H - P.t - P.b); };
    var s = '';
    for (var g = 0; g <= 4; g++) { var v = Math.round((top / 4) * g); s += '<line class="grid-line" x1="' + P.l + '" x2="' + (W - P.r) + '" y1="' + y(v) + '" y2="' + y(v) + '"/><text x="' + (P.l - 6) + '" y="' + (y(v) + 3) + '" text-anchor="end">' + v + '</text>'; }
    days.forEach(function (d, i) {
      var x = P.l + i * bw + bw * 0.18, w = bw * 0.64, yi = y(d.inbound), yo = y(d.inbound + d.outbound);
      var title = '<title>' + new Date(d.day + 'T12:00:00').toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' }) + ' : ' + d.inbound + ' reçu(s), ' + d.outbound + ' passé(s), ' + d.missed + ' manqué(s)</title>';
      s += '<g>' + title + '<rect class="bar-in" x="' + x + '" y="' + yi + '" width="' + w + '" height="' + (H - P.b - yi) + '" rx="2"/>';
      s += '<rect class="bar-out" x="' + x + '" y="' + yo + '" width="' + w + '" height="' + (yi - yo) + '" rx="2"/>';
      s += '</g>';
      if (i % 5 === 0 || i === days.length - 1) s += '<text x="' + (x + w / 2) + '" y="' + (H - 6) + '" text-anchor="middle">' + new Date(d.day + 'T12:00:00').toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' }) + '</text>';
    });
    el.innerHTML = '<svg class="chart" viewBox="0 0 ' + W + ' ' + H + '" preserveAspectRatio="none" role="img" aria-label="Appels des 30 derniers jours">' + s + '</svg>';
  });

  // ---------------------------------------------------------------- appels en cours (tableau de bord)
  var live = $('[data-live]');
  if (live) {
    var draw = function (r) {
      var calls = (r && r.calls) || [];
      if (r && r.online === false && !calls.length) { live.innerHTML = '<div class="empty small">État des appels indisponible pour le moment.</div>'; return; }
      if (!calls.length) { live.innerHTML = '<div class="empty">' + icon('phone') + '<b>Aucun appel en cours</b><span class="small">Les appels apparaissent ici en direct.</span></div>'; return; }
      live.innerHTML = '<ul class="list">' + calls.map(function (c) {
        return '<li><span class="dir in">' + icon('phone') + '</span><div class="grow"><b>' + esc(c.fromName || phone(c.from)) + '</b><span class="small mut">vers ' + esc(c.to || '') + '</span></div><span class="badge ok"><span class="live-dot"></span> ' + esc(c.state === 'ACTIVE' ? 'En ligne' : 'Sonne') + '</span></li>';
      }).join('') + '</ul>';
    };
    var poll = function () { fetch(live.getAttribute('data-live'), { credentials: 'same-origin' }).then(function (r) { return r.json(); }).then(draw).catch(function () {}); };
    poll();
    setInterval(poll, 10000);
  }

  // ================================================================= éditeur de scénarios d'appel
  var root = $('#flow-editor');
  if (!root) return;
  var base = root.getAttribute('data-base');
  var TYPES = {
    start: { label: 'Début', icon: 'flag', desc: 'L’appel arrive' },
    play: { label: 'Annonce', icon: 'volume', desc: 'Diffuser un message' },
    menu: { label: 'Menu à touches', icon: 'hash', desc: '« Tapez 1, tapez 2 »' },
    time: { label: 'Horaires', icon: 'clock', desc: 'Ouvert ou fermé' },
    queue: { label: 'File d’attente', icon: 'queue', desc: 'Attente jusqu’à un agent' },
    transfer: { label: 'Transfert', icon: 'arrow', desc: 'Poste, groupe, numéro…' },
    voicemail: { label: 'Messagerie', icon: 'voicemail', desc: 'Laisser un message' },
    message: { label: 'SMS', icon: 'message', desc: 'Envoyer un SMS à l’appelant' },
    callback: { label: 'Rappel', icon: 'callback', desc: 'Rappeler dès que possible' },
    hangup: { label: 'Raccrocher', icon: 'x', desc: 'Fin de l’appel' },
  };
  var EDITABLE = ['play', 'menu', 'time', 'queue', 'transfer', 'voicemail', 'message', 'callback', 'hangup'];
  var DEFAULTS = {
    play: function () { return { audioId: null }; },
    menu: function () { return { digits: ['1', '2'], timeoutSeconds: 5, maxTries: 3 }; },
    time: function () { return { rules: [{ days: [1, 2, 3, 4, 5], from: '09:00', to: '18:00' }], closedDates: [], closedRanges: [], openRanges: [] }; },
    queue: function () { return { queueId: firstId('QUEUE'), priority: 0 }; },
    transfer: function () { var t = firstId('RING_GROUP') ? 'RING_GROUP' : 'EXTENSION'; return { destType: t, destId: firstId(t) }; },
    voicemail: function () { return { extensionId: firstId('VOICEMAIL') }; },
    message: function () { return { pref: 'sms', toMode: 'caller', text: 'Merci pour votre appel. Nous revenons vers vous rapidement.' }; },
    callback: function () { return { targetType: 'queue', targetId: firstId('QUEUE') }; },
    hangup: function () { return { cause: 'NORMAL_CLEARING' }; },
  };
  var OUT_LABELS = { next: 'Ensuite', invalid: 'Mauvaise touche', noinput: 'Aucune touche', open: 'Ouvert', closed: 'Fermé', fallback: 'Personne ne répond', exit: 'L’appelant quitte la file', success: 'Succès', error: 'Erreur', 'true': 'Oui', 'false': 'Non', a: 'Groupe A', b: 'Groupe B', premium: 'Premium', found: 'Client connu', notfound: 'Client inconnu', noanswer: 'Pas de réponse', none: 'Aucun' };
  var DAYS = ['L', 'M', 'M', 'J', 'V', 'S', 'D'];
  var DEST_TYPES = { EXTENSION: 'Poste', RING_GROUP: 'Groupe d’appel', QUEUE: 'File d’attente', IVR: 'Standard vocal', EXTERNAL: 'Numéro externe' };

  var state = { flow: null, graph: { nodes: [], edges: [] }, catalog: {}, sel: null, adding: null, dirty: false, isNew: false };

  function firstId(type) { var l = state.catalog[type] || []; return l.length ? l[0].id : ''; }
  function nameOf(type, id) { var l = state.catalog[type] || []; for (var i = 0; i < l.length; i++) if (l[i].id === id) return l[i].label; return ''; }
  function audioName(id) { var l = state.catalog.audio || []; for (var i = 0; i < l.length; i++) if (l[i].id === id) return l[i].name; return ''; }
  function node(id) { for (var i = 0; i < state.graph.nodes.length; i++) if (state.graph.nodes[i].id === id) return state.graph.nodes[i]; return null; }
  function outputs(n) {
    switch (n.type) {
      case 'start': case 'play': case 'set': case 'notify': case 'message': return ['next'];
      case 'menu': return (n.data.digits || []).concat(['invalid', 'noinput']);
      case 'collect': return ['next', 'invalid', 'noinput'];
      case 'http': return ['success', 'error'];
      case 'condition': return ['true', 'false'];
      case 'time': return ['open', 'closed'];
      case 'split': return ['a', 'b'];
      case 'queue': return ['fallback', 'exit'];
      case 'support': return ['premium', 'found', 'notfound'];
      case 'assigned': return ['noanswer', 'none'];
      default: return [];
    }
  }
  function edgeOf(src, handle) {
    for (var i = 0; i < state.graph.edges.length; i++) { var e = state.graph.edges[i]; if (e.source === src && (e.sourceHandle || 'next') === handle) return e; }
    return null;
  }
  function newId() { return 'n' + Date.now().toString(36) + Math.floor(Math.random() * 1e6).toString(36); }
  function summary(n) {
    var d = n.data || {};
    switch (n.type) {
      case 'start': return 'Point de départ de l’appel';
      case 'play': return d.audioId ? '« ' + (audioName(d.audioId) || 'annonce') + ' »' : 'Annonce d’accueil par défaut';
      case 'menu': return 'Touches ' + (d.digits || []).join(', ');
      case 'time': return (d.rules || []).map(function (r) { return r.days.map(function (x) { return DAYS[x - 1]; }).join('') + ' ' + r.from + '–' + r.to; }).join(' · ') || 'Aucune plage';
      case 'queue': return nameOf('QUEUE', d.queueId) || 'File à choisir';
      case 'transfer': return d.destType === 'EXTERNAL' ? 'Vers ' + (d.destValue || 'numéro à saisir') : (nameOf(d.destType, d.destId) || 'Destination à choisir');
      case 'voicemail': return d.sharedId ? nameOf('SHARED_VOICEMAIL', d.sharedId) : (nameOf('VOICEMAIL', d.extensionId) || 'Messagerie à choisir');
      case 'message': return '« ' + String(d.text || '').slice(0, 60) + (String(d.text || '').length > 60 ? '…' : '') + ' »';
      case 'callback': return 'Rappel par ' + (d.targetType === 'extension' ? nameOf('EXTENSION', d.targetId) : nameOf('QUEUE', d.targetId)) || 'à choisir';
      case 'hangup': return 'L’appel se termine';
      default: return 'Bloc avancé : modifiable dans le panneau complet';
    }
  }
  function typeInfo(t) { return TYPES[t] || { label: t, icon: 'zap', desc: '' }; }

  // ---------------------------------------------------------------- dessin de l'arbre
  function render() {
    var canvas = $('#flow-canvas');
    var start = state.graph.nodes.filter(function (n) { return n.type === 'start'; })[0];
    var seen = {};
    var html = start ? draw(start.id, seen) : '<div class="empty"><b>Aucun bloc « Début »</b></div>';
    var orphans = state.graph.nodes.filter(function (n) { return !seen[n.id]; });
    if (orphans.length) html += '<div class="card" style=""><h3>Blocs non reliés</h3><p class="small mut">Ils ne sont jamais atteints : reliez-les ou supprimez-les.</p>' + orphans.map(function (n) { return cardHtml(n); }).join('<div class="next"></div>') + '</div>';
    canvas.innerHTML = html.replace(' style=""', '');
    $$('[data-node]', canvas).forEach(function (b) { b.addEventListener('click', function () { select(b.getAttribute('data-node')); }); });
    $$('[data-add]', canvas).forEach(function (b) { b.addEventListener('click', function () { startAdd(b.getAttribute('data-add'), b.getAttribute('data-handle')); }); });
    $$('[data-goto]', canvas).forEach(function (b) { b.addEventListener('click', function () { select(b.getAttribute('data-goto')); }); });
    $('#flow-save').disabled = !state.dirty && !state.isNew;
  }
  function cardHtml(n) {
    var t = typeInfo(n.type);
    var cls = TYPES[n.type] ? 't-' + n.type : 't-other';
    return '<button type="button" class="node ' + cls + (state.sel === n.id ? ' sel' : '') + '" data-node="' + esc(n.id) + '"><span class="chip">' + icon(t.icon) + '</span><span><span class="t">' + esc(t.label) + '</span><span class="d">' + esc((n.data && n.data.label) || summary(n)) + '</span>' + (n.data && n.data.label ? '<span class="x">' + esc(summary(n)) + '</span>' : '') + '</span></button>';
  }
  function draw(id, seen) {
    var n = node(id);
    if (!n) return '';
    seen[id] = true;
    var out = cardHtml(n);
    var outs = outputs(n);
    var child = function (h) {
      var e = edgeOf(n.id, h);
      if (!e || !node(e.target)) return '<button type="button" class="add" data-add="' + esc(n.id) + '" data-handle="' + esc(h) + '">' + icon('plus') + ' Ajouter</button>';
      if (seen[e.target]) return '<button type="button" class="goto" data-goto="' + esc(e.target) + '">' + icon('arrow') + ' Retour à « ' + esc((node(e.target).data || {}).label || typeInfo(node(e.target).type).label) + ' »</button>';
      return draw(e.target, seen);
    };
    if (outs.length === 1) out += '<div class="next">' + child(outs[0]) + '</div>';
    else if (outs.length > 1) out += '<div class="branches">' + outs.map(function (h) { return '<div class="branch"><span class="lbl">' + (n.type === 'menu' && /^[0-9*#]$/.test(h) ? 'Touche ' + esc(h) : esc(OUT_LABELS[h] || h)) + '</span><div>' + child(h) + '</div></div>'; }).join('') + '</div>';
    return out;
  }

  // ---------------------------------------------------------------- panneau de droite : ajout, réglages
  function startAdd(src, handle) {
    state.adding = { src: src, handle: handle };
    state.sel = null;
    render();
    var p = $('#flow-panel');
    p.innerHTML = '<div class="card"><div class="card-head"><h2>Ajouter un bloc</h2><button type="button" class="btn ghost sm" id="add-cancel">Annuler</button></div><div class="palette">' + EDITABLE.map(function (t) {
      return '<button type="button" class="t-' + t + '" data-type="' + t + '">' + icon(TYPES[t].icon) + '<span>' + esc(TYPES[t].label) + '<br><span class="small mut">' + esc(TYPES[t].desc) + '</span></span></button>';
    }).join('') + '</div></div>';
    $('#add-cancel').addEventListener('click', function () { state.adding = null; showHelp(); });
    $$('[data-type]', p).forEach(function (b) { b.addEventListener('click', function () { add(b.getAttribute('data-type')); }); });
  }
  function add(type) {
    var n = { id: newId(), type: type, position: { x: 0, y: 0 }, data: DEFAULTS[type]() };
    state.graph.nodes.push(n);
    if (state.adding) state.graph.edges.push({ id: 'e' + newId(), source: state.adding.src, sourceHandle: state.adding.handle, target: n.id });
    state.adding = null;
    changed();
    select(n.id);
  }
  function remove(id) {
    state.graph.nodes = state.graph.nodes.filter(function (n) { return n.id !== id; });
    state.graph.edges = state.graph.edges.filter(function (e) { return e.source !== id && e.target !== id; });
    state.sel = null;
    changed();
    showHelp();
  }
  function changed() { state.dirty = true; render(); }

  function opts(list, value, empty) {
    return (empty ? '<option value="">' + esc(empty) + '</option>' : '') + (list || []).map(function (o) { return '<option value="' + esc(o.id) + '"' + (o.id === value ? ' selected' : '') + '>' + esc(o.label || o.name) + '</option>'; }).join('');
  }
  function select(id) {
    state.sel = id;
    state.adding = null;
    render();
    var n = node(id);
    if (!n) return;
    var d = n.data || (n.data = {});
    var t = typeInfo(n.type);
    var f = '';
    if (n.type !== 'start') f += '<label for="f-label">Nom du bloc</label><input class="input" id="f-label" data-f="label" value="' + esc(d.label || '') + '" placeholder="' + esc(t.label) + '" maxlength="80">';
    switch (n.type) {
      case 'start': f += '<p class="mut small">Le scénario commence ici dès que l’appel arrive sur un numéro (ou le numéro interne) qui l’utilise.</p>'; break;
      case 'play':
        f += '<label for="f-audio">Message diffusé</label><select id="f-audio" data-f="audioId">' + opts(state.catalog.audio, d.audioId, 'Annonce d’accueil par défaut') + '</select><p class="hint">Vos fichiers audio s’ajoutent dans le panneau complet (Annonces et musiques).</p>'; break;
      case 'menu':
        f += '<label for="f-audio">Message du menu</label><select id="f-audio" data-f="audioId">' + opts(state.catalog.audio, d.audioId, 'Message par défaut') + '</select>';
        f += '<label>Touches proposées</label><div class="checks">' + ['1', '2', '3', '4', '5', '6', '7', '8', '9', '0', '*', '#'].map(function (k) { return '<label><input type="checkbox" data-digit="' + k + '"' + ((d.digits || []).indexOf(k) >= 0 ? ' checked' : '') + '> ' + k + '</label>'; }).join('') + '</div>';
        f += '<label for="f-timeout">Attente d’une touche (secondes)</label><input class="input" id="f-timeout" type="number" min="2" max="30" data-f="timeoutSeconds" data-num value="' + esc(d.timeoutSeconds || 5) + '">'; break;
      case 'time':
        f += '<label>Plages d’ouverture</label><div id="rules">' + (d.rules || []).map(function (r, i) {
          return '<div class="rule"><div class="days">' + DAYS.map(function (x, j) { return '<label title="' + ['lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi', 'dimanche'][j] + '"><input type="checkbox" data-rday="' + i + ':' + (j + 1) + '"' + (r.days.indexOf(j + 1) >= 0 ? ' checked' : '') + '>' + x + '</label>'; }).join('') + '</div>'
            + '<input class="input" type="time" data-rfrom="' + i + '" value="' + esc(r.from) + '"><input class="input" type="time" data-rto="' + i + '" value="' + esc(r.to) + '"><button type="button" class="btn danger sm" data-rdel="' + i + '" aria-label="Retirer la plage">' + icon('x') + '</button></div>';
        }).join('') + '</div><button type="button" class="btn ghost sm" id="rule-add">' + icon('plus') + ' Ajouter une plage</button><p class="hint">En dehors de ces plages, l’appel suit la sortie « Fermé ». Jours fériés et congés : panneau complet.</p>'; break;
      case 'queue':
        f += '<label for="f-queue">File d’attente</label><select id="f-queue" data-f="queueId">' + opts(state.catalog.QUEUE, d.queueId, 'Choisir…') + '</select>';
        f += '<label for="f-prio">Priorité (0 à 9)</label><input class="input" id="f-prio" type="number" min="0" max="9" data-f="priority" data-num value="' + esc(d.priority || 0) + '"><p class="hint">« Personne ne répond » : l’attente maximale de la file est dépassée ou aucun agent n’est connecté.</p>'; break;
      case 'transfer':
        f += '<label for="f-dt">Vers</label><select id="f-dt" data-f="destType">' + Object.keys(DEST_TYPES).map(function (k) { return '<option value="' + k + '"' + (d.destType === k ? ' selected' : '') + '>' + DEST_TYPES[k] + '</option>'; }).join('') + '</select>';
        f += d.destType === 'EXTERNAL'
          ? '<label for="f-dv">Numéro</label><input class="input" id="f-dv" data-f="destValue" type="tel" value="' + esc(d.destValue || '') + '" placeholder="06 12 34 56 78">'
          : '<label for="f-di">Destination</label><select id="f-di" data-f="destId">' + opts(state.catalog[d.destType], d.destId, 'Choisir…') + '</select>'; break;
      case 'voicemail':
        f += '<label for="f-vm">Messagerie</label><select id="f-vm" data-vm>' + '<optgroup label="Messagerie d’un poste">' + (state.catalog.VOICEMAIL || []).map(function (o) { return '<option value="e:' + esc(o.id) + '"' + (!d.sharedId && d.extensionId === o.id ? ' selected' : '') + '>' + esc(o.label) + '</option>'; }).join('') + '</optgroup>'
          + ((state.catalog.SHARED_VOICEMAIL || []).length ? '<optgroup label="Messagerie partagée">' + state.catalog.SHARED_VOICEMAIL.map(function (o) { return '<option value="s:' + esc(o.id) + '"' + (d.sharedId === o.id ? ' selected' : '') + '>' + esc(o.label) + '</option>'; }).join('') + '</optgroup>' : '') + '</select>'; break;
      case 'message':
        f += '<label for="f-pref">Canal</label><select id="f-pref" data-f="pref"><option value="sms"' + (d.pref === 'sms' ? ' selected' : '') + '>SMS</option><option value="wa_sms"' + (d.pref === 'wa_sms' ? ' selected' : '') + '>WhatsApp si possible, sinon SMS</option><option value="wa"' + (d.pref === 'wa' ? ' selected' : '') + '>WhatsApp uniquement</option></select>';
        f += '<label for="f-tom">Destinataire</label><select id="f-tom" data-f="toMode"><option value="caller"' + (d.toMode !== 'fixed' ? ' selected' : '') + '>L’appelant</option><option value="fixed"' + (d.toMode === 'fixed' ? ' selected' : '') + '>Un numéro précis</option></select>';
        if (d.toMode === 'fixed') f += '<label for="f-to">Numéro</label><input class="input" id="f-to" data-f="to" type="tel" value="' + esc(d.to || '') + '" placeholder="06 12 34 56 78">';
        f += '<label for="f-text">Message</label><textarea id="f-text" rows="4" maxlength="1000" data-f="text">' + esc(d.text || '') + '</textarea><p class="hint">Variables : {{caller}} (numéro de l’appelant), {{did}} (numéro appelé). Le message part pendant que l’appel continue.</p>'; break;
      case 'callback':
        f += '<label for="f-tt">Rappel par</label><select id="f-tt" data-f="targetType"><option value="queue"' + (d.targetType !== 'extension' ? ' selected' : '') + '>Une file d’attente</option><option value="extension"' + (d.targetType === 'extension' ? ' selected' : '') + '>Un poste</option></select>';
        f += '<label for="f-ti">Qui rappelle</label><select id="f-ti" data-f="targetId">' + opts(d.targetType === 'extension' ? state.catalog.EXTENSION : state.catalog.QUEUE, d.targetId, 'Choisir…') + '</select><p class="hint">L’appelant entend une confirmation et raccroche ; il est rappelé dès qu’un agent se libère.</p>'; break;
      case 'hangup': f += '<p class="mut small">L’appel se termine.</p>'; break;
      default: f += '<div class="alert info">Ce bloc avancé (' + esc(n.type) + ') se règle dans le panneau complet. Il est conservé tel quel.</div>';
    }
    $('#flow-panel').innerHTML = '<div class="card ' + (TYPES[n.type] ? 't-' + n.type : 't-other') + '"><div class="card-head"><h2>' + icon(t.icon) + ' ' + esc(t.label) + '</h2>' + (n.type !== 'start' ? '<button type="button" class="btn danger sm" id="node-del">' + icon('trash') + ' Supprimer</button>' : '') + '</div>' + f + '</div>' + testPanel();
    bindPanel(n);
    bindTest();
  }
  function bindPanel(n) {
    var p = $('#flow-panel'), d = n.data;
    $$('[data-f]', p).forEach(function (el) {
      el.addEventListener(el.tagName === 'SELECT' ? 'change' : 'input', function () {
        var k = el.getAttribute('data-f'), v = el.value;
        d[k] = el.hasAttribute('data-num') ? Number(v) : (v === '' && (k === 'audioId') ? null : v);
        if (k === 'destType') { if (v === 'EXTERNAL') { delete d.destId; d.destValue = ''; } else { delete d.destValue; d.destId = firstId(v); } }
        if (k === 'targetType') d.targetId = firstId(v === 'extension' ? 'EXTENSION' : 'QUEUE');
        changed();
        if (el.tagName === 'SELECT') select(n.id);
      });
    });
    var vm = $('[data-vm]', p);
    if (vm) vm.addEventListener('change', function () { var v = vm.value; if (v.indexOf('s:') === 0) { d.sharedId = v.slice(2); delete d.extensionId; } else { d.extensionId = v.slice(2); delete d.sharedId; } changed(); });
    $$('[data-digit]', p).forEach(function (cb) {
      cb.addEventListener('change', function () {
        var all = $$('[data-digit]', p).filter(function (x) { return x.checked; }).map(function (x) { return x.getAttribute('data-digit'); });
        d.digits = all;
        // sorties retirées : liaisons supprimées
        state.graph.edges = state.graph.edges.filter(function (e) { return e.source !== n.id || all.indexOf(e.sourceHandle) >= 0 || ['invalid', 'noinput'].indexOf(e.sourceHandle) >= 0; });
        changed();
      });
    });
    $$('[data-rday]', p).forEach(function (cb) {
      cb.addEventListener('change', function () {
        var parts = cb.getAttribute('data-rday').split(':'), r = d.rules[Number(parts[0])], day = Number(parts[1]);
        r.days = cb.checked ? r.days.concat([day]).sort() : r.days.filter(function (x) { return x !== day; });
        changed();
      });
    });
    $$('[data-rfrom]', p).forEach(function (el) { el.addEventListener('change', function () { d.rules[Number(el.getAttribute('data-rfrom'))].from = el.value; changed(); }); });
    $$('[data-rto]', p).forEach(function (el) { el.addEventListener('change', function () { d.rules[Number(el.getAttribute('data-rto'))].to = el.value; changed(); }); });
    $$('[data-rdel]', p).forEach(function (b) { b.addEventListener('click', function () { d.rules.splice(Number(b.getAttribute('data-rdel')), 1); changed(); select(n.id); }); });
    var ra = $('#rule-add', p);
    if (ra) ra.addEventListener('click', function () { d.rules.push({ days: [1, 2, 3, 4, 5], from: '09:00', to: '18:00' }); changed(); select(n.id); });
    var del = $('#node-del', p);
    if (del) del.addEventListener('click', function () { if (window.confirm('Supprimer ce bloc ? Les blocs qui le suivent restent, sans liaison.')) remove(n.id); });
  }
  function showHelp() {
    $('#flow-panel').innerHTML = '<div class="card"><h2>' + icon('sparkles') + ' Comment ça marche</h2><p class="small">Le scénario part du bloc <b>Début</b> et descend de bloc en bloc. Cliquez sur <b>Ajouter</b> au bout d’une branche pour la compléter, ou sur un bloc pour le régler.</p><p class="small">Pour qu’il serve, choisissez-le comme destination d’un numéro (page <a href="/numeros">Numéros</a>), ou donnez-lui un numéro interne.</p></div>' + testPanel();
    bindTest();
  }

  // ---------------------------------------------------------------- test (simulation, rien n'est appelé)
  function testPanel() {
    return '<div class="card"><h2>' + icon('play') + ' Tester le scénario</h2><p class="small mut">Simulation : aucun appel n’est passé.</p>'
      + '<div class="row"><div><label for="sim-caller">Numéro de l’appelant</label><input class="input" id="sim-caller" value="0612345678"></div><div><label for="sim-digits">Touches tapées</label><input class="input" id="sim-digits" placeholder="ex. 1"></div></div>'
      + '<label for="sim-at">Date et heure de l’appel</label><input class="input" id="sim-at" type="datetime-local">'
      + '<div class="form-end"><button type="button" class="btn soft" id="sim-run">' + icon('play') + ' Lancer le test</button></div><div id="sim-out"></div></div>';
  }
  function bindTest() {
    var run = $('#sim-run');
    if (!run) return;
    run.addEventListener('click', function () {
      var out = $('#sim-out');
      out.innerHTML = '<p class="small mut">Simulation…</p>';
      var at = $('#sim-at').value;
      postJson(base + '/simuler', { graph: graphForSave(), caller: $('#sim-caller').value || '0612345678', digits: ($('#sim-digits').value || '').replace(/[^0-9*#]/g, '').split(''), at: at ? new Date(at).toISOString() : undefined })
        .then(function (r) {
          var trace = (r.trace || []).filter(function (s) { return s.type !== 'start'; });
          out.innerHTML = '<ol class="trace">' + trace.map(function (s) { return '<li><span><b>' + esc(s.label || typeInfo(s.type).label) + '</b> <span class="mut">' + esc(s.detail || '') + '</span></span></li>'; }).join('')
            + '<li class="end"><span><b>Résultat</b> <span class="mut">' + esc(endLabel(r.end)) + '</span></span></li></ol>';
        })
        .catch(function (e) { out.innerHTML = '<div class="alert error">' + esc(e.message) + '</div>'; });
    });
  }
  function endLabel(e) {
    if (!e) return '';
    return ({ transfer: 'transfert ', voicemail: 'messagerie ', hangup: 'fin de l’appel', callback: 'demande de rappel enregistrée', end: 'fin du scénario', error: 'erreur : ' }[e.kind] || e.kind + ' ') + (e.kind === 'hangup' ? '' : (e.detail || ''));
  }

  // ---------------------------------------------------------------- enregistrement
  function graphForSave() {
    // positions calculées (arbre) pour un affichage propre dans le panneau complet
    var start = state.graph.nodes.filter(function (n) { return n.type === 'start'; })[0];
    var row = 0, placed = {};
    var place = function (id, depth) {
      var n = node(id);
      if (!n || placed[id]) return;
      placed[id] = true;
      n.position = { x: depth * 300, y: row * 130 };
      var outs = outputs(n), first = true;
      outs.forEach(function (h) { var e = edgeOf(id, h); if (e && !placed[e.target]) { if (!first) row++; first = false; place(e.target, depth + 1); } });
    };
    if (start) place(start.id, 0);
    state.graph.nodes.forEach(function (n) { if (!placed[n.id]) { row++; n.position = { x: 0, y: row * 130 }; } });
    return { nodes: state.graph.nodes, edges: state.graph.edges.map(function (e) { return { id: e.id || 'e' + newId(), source: e.source, sourceHandle: e.sourceHandle || null, target: e.target }; }) };
  }
  function save() {
    var btn = $('#flow-save'), msg = $('#flow-msg');
    btn.disabled = true;
    msg.innerHTML = '';
    var number = $('#flow-number').value.trim();
    postJson(base + '/donnees', { name: $('#flow-name').value.trim() || 'Scénario', number: number || null, enabled: $('#flow-enabled').checked, graph: graphForSave() })
      .then(function (f) {
        state.dirty = false;
        if (state.isNew) { window.location.href = root.getAttribute('data-list') + '/' + encodeURIComponent(f.id); return; }
        msg.innerHTML = '<div class="alert success">' + icon('check') + ' Scénario enregistré' + (f.enabled ? ' et actif.' : ' (brouillon, désactivé).') + '</div>';
        render();
      })
      .catch(function (e) {
        btn.disabled = false;
        msg.innerHTML = '<div class="alert error">' + icon('alert') + '<div><b>' + esc(e.message) + '</b>' + (e.details && e.details.length > 1 ? '<ul class="issues">' + e.details.map(function (x) { return '<li>' + esc(x) + '</li>'; }).join('') + '</ul>' : '') + '<div class="small">Pour enregistrer un scénario incomplet, décochez « Actif » (brouillon).</div></div></div>';
      });
  }

  // ---------------------------------------------------------------- modèles (nouveau scénario)
  function tplGraph(key) {
    var N = [], E = [], id = function () { return newId() + N.length; };
    var mk = function (type, data, label) { var n = { id: id(), type: type, position: { x: 0, y: 0 }, data: Object.assign(DEFAULTS[type] ? DEFAULTS[type]() : {}, data || {}, label ? { label: label } : {}) }; N.push(n); return n.id; };
    var link = function (a, h, b) { E.push({ id: 'e' + newId() + E.length, source: a, sourceHandle: h, target: b }); };
    var s = mk('start', {});
    var vm = function (label) { return mk('voicemail', {}, label || 'Messagerie'); };
    if (key === 'accueil') { var p = mk('play', {}, 'Message d’accueil'); link(s, 'next', p); link(p, 'next', mk('transfer', {}, 'Vers l’accueil')); }
    if (key === 'horaires') {
      var t = mk('time', {}, 'Heures d’ouverture'); link(s, 'next', t);
      var q = mk('queue', {}, 'File d’attente'); link(t, 'open', q); link(q, 'fallback', vm('Personne de libre'));
      var c = mk('play', {}, 'Message « fermé »'); link(t, 'closed', c); link(c, 'next', vm('Messagerie hors horaires'));
    }
    if (key === 'menu') {
      var m = mk('menu', { digits: ['1', '2'] }, 'Menu principal'); link(s, 'next', m);
      link(m, '1', mk('queue', {}, 'Service commercial')); link(m, '2', mk('transfer', {}, 'Support'));
      link(m, 'noinput', mk('transfer', {}, 'Accueil'));
    }
    if (key === 'rappel') {
      var q2 = mk('queue', {}, 'File d’attente'); link(s, 'next', q2);
      link(q2, 'fallback', mk('callback', {}, 'Proposer d’être rappelé'));
      link(q2, 'exit', vm());
    }
    if (key === 'sms') {
      var t2 = mk('time', {}, 'Heures d’ouverture'); link(s, 'next', t2);
      link(t2, 'open', mk('transfer', {}, 'Accueil'));
      var sm = mk('message', { text: 'Merci pour votre appel. Nous sommes fermés : nous vous rappelons dès notre réouverture.' }, 'SMS « nous sommes fermés »'); link(t2, 'closed', sm); link(sm, 'next', vm());
    }
    return { nodes: N, edges: E };
  }

  // ---------------------------------------------------------------- démarrage
  fetch(base + '/donnees', { credentials: 'same-origin' })
    .then(function (r) { if (!r.ok) throw new Error('Chargement impossible'); return r.json(); })
    .then(function (data) {
      state.catalog = data.catalog || {};
      state.isNew = !data.flow;
      var tpl = root.getAttribute('data-template');
      state.flow = data.flow || { name: '', number: null, enabled: true };
      state.graph = data.flow ? JSON.parse(JSON.stringify(data.flow.graph || { nodes: [], edges: [] })) : tplGraph(tpl || 'vierge');
      state.graph.nodes = state.graph.nodes || []; state.graph.edges = state.graph.edges || [];
      state.graph.nodes.forEach(function (n) { if (!n.data || Array.isArray(n.data)) n.data = {}; });
      if (!state.graph.nodes.some(function (n) { return n.type === 'start'; })) state.graph.nodes.unshift({ id: 'debut', type: 'start', position: { x: 0, y: 0 }, data: {} });
      $('#flow-name').value = state.flow.name || root.getAttribute('data-name') || '';
      $('#flow-number').value = state.flow.number || '';
      $('#flow-enabled').checked = state.flow.enabled !== false;
      ['#flow-name', '#flow-number', '#flow-enabled'].forEach(function (s) { $(s).addEventListener('input', function () { state.dirty = true; render(); }); $(s).addEventListener('change', function () { state.dirty = true; render(); }); });
      $('#flow-save').addEventListener('click', save);
      window.addEventListener('beforeunload', function (e) { if (state.dirty) { e.preventDefault(); e.returnValue = ''; } });
      render();
      showHelp();
    })
    .catch(function (e) { $('#flow-canvas').innerHTML = '<div class="alert error">' + esc(e.message) + '</div>'; });
})();
