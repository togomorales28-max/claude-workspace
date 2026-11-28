/*!
 * Cotizador de herrería para tu página web.
 *
 * Uso en tu página:
 *   <div id="cotizador-herreria"></div>
 *   <script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.45.4/dist/umd/supabase.min.js"></script>
 *   <script src="config.js"></script>
 *   <script src="cotizador.js"></script>
 *
 * Los precios se leen de Supabase y se actualizan solos cuando el dueño los cambia en admin.html.
 * Cada cotización se guarda en Supabase y aparece al momento en el panel del dueño.
 */
(function (root) {
  'use strict';

  /* ═══════════════ Configuración inicial (la misma que se carga en Supabase) ═══════════════ */
  var DEFAULT_CONFIG = {
    "business": "Mi Herrería",
    "whatsapp": "+526313029172",
    "countryCode": "1",
    "currency": "USD",
    "unit": "ft",
    "rangePct": 15,
    "roundTo": 17,
    "wastePct": 10,
    "labor": {
      "payPerDay": 40,
      "minPerPerson": 40,
      "maxPersons": 2
    },
    "disclaimer": "Este es un estimado automático. El precio final puede variar según las medidas exactas, el diseño, los materiales y la instalación. Te confirmamos el precio después de revisar tu proyecto.",
    "metals": [
      {
        "id": "tc2",
        "name": "Tubo cuadrado 2\" × 2\" cal. 14",
        "price": 3.0
      },
      {
        "id": "tc15",
        "name": "Tubo cuadrado 1½\" × 1½\" cal. 16",
        "price": 1.8
      },
      {
        "id": "tc1",
        "name": "Tubo cuadrado 1\" × 1\" cal. 16",
        "price": 1.1
      },
      {
        "id": "tc34",
        "name": "Tubo cuadrado ¾\" × ¾\" cal. 18",
        "price": 0.75
      },
      {
        "id": "bc12",
        "name": "Barra cuadrada maciza ½\"",
        "price": 1.0
      },
      {
        "id": "ang",
        "name": "Ángulo 1½\" × 1½\" × ⅛\"",
        "price": 1.6
      }
    ],
    "types": [
      {
        "id": "porton",
        "name": "Portón",
        "mode": "area",
        "frameMetal": "tc2",
        "barMetal": "tc1",
        "rails": 2,
        "height": 0,
        "postEvery": 0,
        "material": 0,
        "refA": 10,
        "refB": 24,
        "refPersons": 2,
        "refDays": 1,
        "min": 280,
        "active": true
      },
      {
        "id": "reja",
        "name": "Reja / protección de ventana",
        "mode": "area",
        "frameMetal": "tc1",
        "barMetal": "bc12",
        "rails": 1,
        "height": 0,
        "postEvery": 0,
        "material": 0,
        "refA": 4,
        "refB": 4,
        "refPersons": 1,
        "refDays": 0.5,
        "min": 400,
        "active": false
      },
      {
        "id": "barandal",
        "name": "Barandal",
        "mode": "lineal",
        "frameMetal": "tc15",
        "barMetal": "tc34",
        "rails": 2,
        "height": 3,
        "postEvery": 6,
        "material": 0,
        "refA": 10,
        "refB": 0,
        "refPersons": 1,
        "refDays": 1,
        "min": 200,
        "active": false
      },
      {
        "id": "puerta",
        "name": "Puerta de herrería",
        "mode": "area",
        "frameMetal": "tc15",
        "barMetal": "tc1",
        "rails": 2,
        "height": 0,
        "postEvery": 0,
        "material": 0,
        "refA": 3,
        "refB": 7,
        "refPersons": 1,
        "refDays": 1,
        "min": 0,
        "active": true
      }
    ],
    "designs": [
      {
        "id": "sencillo",
        "name": "Sencillo",
        "desc": "Líneas rectas, barrotes lisos",
        "spacing": 5,
        "pct": 0
      },
      {
        "id": "medio",
        "name": "Con detalles",
        "desc": "Remates, combinación de perfiles",
        "spacing": 4,
        "pct": 25
      },
      {
        "id": "decorado",
        "name": "Decorado",
        "desc": "Forja, figuras, lámina cortada",
        "spacing": 4,
        "pct": 60
      }
    ],
    "features": [
      {
        "id": "curvas",
        "name": "Curvas o arcos",
        "desc": "Partes dobladas, arco arriba, ondas",
        "pct": 20,
        "keywords": "arco, curva, curvo, curveado, onda, ondulado, redondo, media luna"
      },
      {
        "id": "forja",
        "name": "Forja y adornos",
        "desc": "Figuras, flores, lanzas, espirales",
        "pct": 30,
        "keywords": "forja, figura, adorno, flor, lanza, punta, roseta, voluta, espiral, decorado, colonial, rustico"
      },
      {
        "id": "lamina",
        "name": "Lámina calada o cortada",
        "desc": "Diseños cortados en lámina o placa",
        "pct": 25,
        "keywords": "calado, calada, laser, plasma, perforad, letras, logo, recortad"
      },
      {
        "id": "peatonal",
        "name": "Puerta peatonal integrada",
        "desc": "Puerta chica dentro del portón",
        "pct": 15,
        "keywords": "peatonal, puerta chica, puertita, puerta pequena, entrada de personas"
      },
      {
        "id": "corredizo",
        "name": "Corredizo o abatible doble",
        "desc": "Rieles, ruedas, dos hojas",
        "pct": 10,
        "keywords": "corrediz, riel, rueda, dos hojas, doble hoja, abatible"
      },
      {
        "id": "motor",
        "name": "Preparación para motor",
        "desc": "Para abrir con control",
        "pct": 10,
        "keywords": "motor, automatic, control remoto, electrico"
      },
      {
        "id": "acabado",
        "name": "Acabado especial",
        "desc": "Galvanizado, dos colores, pintura especial",
        "pct": 10,
        "keywords": "galvaniz, dos colores, electrostatic, pintura especial, dorado, cobre, oxidado"
      },
      {
        "id": "acceso",
        "name": "Difícil acceso o altura",
        "desc": "Segundo piso, escaleras, andamio",
        "pct": 15,
        "keywords": "segundo piso, segunda planta, andamio, azotea, balcon, dificil acceso"
      }
    ],
    "examplePrices": true
  };

  /* ═══════════════ Núcleo de cálculo (sin pantalla; se usa en la web, en el panel y en las pruebas) ═══════════════
     MATERIAL: pies de metal según la forma del trabajo × precio por pie del proveedor × (1 + desperdicio).
       Área (portón, reja, puerta): marco = 2·(ancho + alto); travesaños = n × ancho;
         barrotes verticales cada S pulgadas = (⌈ancho·12 / S⌉ − 1) × alto.
       Largo (barandal): pasamanos = n × largo; postes cada P pies = (⌈largo / P⌉ + 1) × alto;
         barrotes = (⌈largo·12 / S⌉ − 1) × alto.
       Pieza: material fijo.
     MANO DE OBRA: el ejemplo del dueño (personas × días para un tamaño) se escala al tamaño del cliente.
       Personas = 1 si cabe en un día de una persona; si no, hasta el máximo. Días en medios días.
       Cada persona cobra días × pago diario, con mínimo por persona.
     DIFICULTAD: estilo de diseño (%) + detalles que el cliente pide (%), sobre material + mano de obra.
  */
  function num(v) { var n = parseFloat(String(v == null ? '' : v).replace(',', '.')); return isFinite(n) ? n : 0; }
  function U(cfg) {
    return cfg.unit === 'm'
      ? { len: 'm', one: 'metro', area: 'm²', sub: 'cm', subPer: 100 }
      : { len: 'pies', one: 'pie', area: 'pies²', sub: 'pulg', subPer: 12 };
  }
  function money(cfg, n, dec) {
    dec = dec || 0;
    return new Intl.NumberFormat(cfg.currency === 'MXN' ? 'es-MX' : 'en-US', { style: 'currency', currency: cfg.currency || 'USD', minimumFractionDigits: dec, maximumFractionDigits: dec }).format(n || 0);
  }
  function fmt(n, d) { return new Intl.NumberFormat('en-US', { maximumFractionDigits: d == null ? 2 : d }).format(n || 0); }
  function roundUp(cfg, n) { var r = num(cfg.roundTo); return r > 0 ? Math.ceil(n / r - 1e-9) * r : Math.round(n); }
  function roundDown(cfg, n) { var r = num(cfg.roundTo); return r > 0 ? Math.floor(n / r) * r : Math.round(n); }
  function metal(cfg, id) { return (cfg.metals || []).find(function (m) { return m.id === id; }) || null; }
  function metalPrice(cfg, id) { var m = metal(cfg, id); return m ? num(m.price) : 0; }
  function sizeOf(t, a, b) { return t.mode === 'area' ? num(a) * num(b) : t.mode === 'lineal' ? num(a) : 1; }

  function metalFeet(cfg, t, a, b, spacing) {
    var u = U(cfg), A = num(a), B = num(b), S = num(spacing), parts = [], bars;
    if (t.mode === 'area') {
      if (A <= 0 || B <= 0) return parts;
      parts.push({ id: t.frameMetal, what: 'marco y travesaños', len: 2 * (A + B) + Math.max(0, Math.floor(num(t.rails))) * A });
      if (S > 0 && t.barMetal) {
        bars = Math.max(0, Math.ceil((A * u.subPer) / S) - 1);
        if (bars) parts.push({ id: t.barMetal, what: bars + ' barrotes', len: bars * B });
      }
    } else if (t.mode === 'lineal') {
      var H = num(t.height), P = num(t.postEvery);
      if (A <= 0) return parts;
      var posts = P > 0 ? Math.ceil(A / P) + 1 : 2;
      parts.push({ id: t.frameMetal, what: 'pasamanos y ' + posts + ' postes', len: Math.max(0, Math.floor(num(t.rails))) * A + posts * H });
      if (S > 0 && t.barMetal && H > 0) {
        bars = Math.max(0, Math.ceil((A * u.subPer) / S) - 1);
        if (bars) parts.push({ id: t.barMetal, what: bars + ' barrotes', len: bars * H });
      }
    }
    return parts;
  }
  function materialCost(cfg, t, a, b, spacing) {
    if (t.mode === 'pieza') return { cost: num(t.material), parts: [], missing: !(num(t.material) > 0) };
    var parts = metalFeet(cfg, t, a, b, spacing), missing = false, cost = 0;
    parts.forEach(function (p) { var pr = metalPrice(cfg, p.id); if (!(pr > 0)) missing = true; cost += p.len * pr; });
    return { cost: cost * (1 + num(cfg.wastePct) / 100), parts: parts, missing: missing };
  }
  function laborFor(cfg, t, sizeTotal) {
    var L = cfg.labor || {};
    var refSize = sizeOf(t, t.refA, t.refB), refLoad = num(t.refPersons) * num(t.refDays);
    if (!(refSize > 0) || !(refLoad > 0) || !(sizeTotal > 0)) return { persons: 0, days: 0, perPerson: 0, cost: 0 };
    var load = refLoad * (sizeTotal / refSize);
    var max = Math.max(1, Math.floor(num(L.maxPersons) || 1));
    var persons = load <= 1 ? 1 : Math.min(max, Math.ceil(load));
    var days = Math.max(0.5, Math.ceil((load / persons) * 2 - 1e-9) / 2);
    var perPerson = Math.max(num(L.minPerPerson), days * num(L.payPerDay));
    return { persons: persons, days: days, perPerson: perPerson, cost: persons * perPerson };
  }
  function priced(cfg, t) {
    if (!t.active) return false;
    var refOk = sizeOf(t, t.refA, t.refB) > 0 && num(t.refPersons) > 0 && num(t.refDays) > 0;
    if (t.mode === 'pieza') return refOk && num(t.material) > 0;
    return refOk && metalPrice(cfg, t.frameMetal) > 0 && (!t.barMetal || metalPrice(cfg, t.barMetal) > 0);
  }
  function norm(x) { return String(x || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, ''); }
  function detected(f, text) {
    var t = norm(text);
    if (!t.trim()) return false;
    return String(f.keywords || '').split(',').map(function (k) { return norm(k).trim(); }).filter(Boolean).some(function (k) {
      // la palabra clave debe empezar una palabra: «arco» no cuenta dentro de «marco»
      return new RegExp('(^|[^a-z0-9])' + k.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).test(t);
    });
  }
  function itemFeatures(cfg, it) {
    return (cfg.features || []).filter(function (f) {
      var o = it.featOver ? it.featOver[f.id] : undefined;
      return o === undefined ? detected(f, it.desc) : o;
    });
  }
  function difficulty(pct) { return pct <= 0 ? 'Normal' : pct <= 25 ? 'Media' : pct <= 60 ? 'Alta' : 'Muy alta'; }
  function design(cfg, id) { return (cfg.designs || []).find(function (x) { return x.id === id; }) || (cfg.designs || [])[0] || null; }

  function itemCalc(cfg, it) {
    var t = (cfg.types || []).find(function (x) { return x.id === it.typeId; });
    if (!t) return null;
    var d = design(cfg, it.designId);
    var qty = Math.max(1, Math.floor(num(it.qty) || 1));
    var complete = t.mode === 'area' ? num(it.a) > 0 && num(it.b) > 0 : t.mode === 'lineal' ? num(it.a) > 0 : true;
    var m = materialCost(cfg, t, it.a, it.b, d && d.spacing);
    var material = m.cost * qty;
    var labor = laborFor(cfg, t, sizeOf(t, it.a, it.b) * qty);
    var base = material + labor.cost;
    var feats = itemFeatures(cfg, it);
    var extraPct = num(d && d.pct) + feats.reduce(function (s, f) { return s + num(f.pct); }, 0);
    var designExtra = base * (extraPct / 100);
    var total = base + designExtra;
    if (total > 0) total = roundUp(cfg, total);
    var minTotal = num(t.min) * qty;
    var minApplied = total > 0 && total < minTotal; // el mínimo se respeta exacto, sin redondear
    if (minApplied) total = minTotal;
    return { t: t, d: d, qty: qty, complete: complete, parts: m.parts, material: material, labor: labor, designExtra: designExtra,
      extraPct: extraPct, feats: feats, total: total, minApplied: minApplied, size: sizeOf(t, it.a, it.b) };
  }
  function estimate(cfg, items) {
    var calcs = items.map(function (it) { return itemCalc(cfg, it); }).filter(function (c) { return c && c.complete && c.total > 0; });
    var total = calcs.reduce(function (s, c) { return s + c.total; }, 0);
    var p = num(cfg.rangePct) / 100;
    return { calcs: calcs, total: total, low: roundDown(cfg, total * (1 - p)), high: roundUp(cfg, total * (1 + p)) };
  }
  function laborText(l) { return l.persons ? l.persons + ' ' + (l.persons === 1 ? 'persona' : 'personas') + ' × ' + fmt(l.days, 1) + ' ' + (l.days === 1 ? 'día' : 'días') : ''; }
  function partsText(cfg, parts, qty) {
    return parts.map(function (p) { var m = metal(cfg, p.id); return fmt(p.len * qty, 1) + ' ' + U(cfg).len + ' de ' + (m ? m.name : 'metal') + ' (' + p.what + ')'; }).join('; ');
  }
  function digits(s) { return String(s || '').replace(/\D/g, ''); }
  /** El número se guarda como +[código de país][número], p. ej. +16025550123. */
  function intlPhone(_cfg, raw) { return '+' + digits(raw); }
  /** Obligatorio con + y código de país: «+1 602 555 0123». Acepta espacios, guiones y paréntesis. */
  function phoneOk(raw) {
    var s = String(raw || '').trim(), d = digits(s);
    return /^\+[0-9\s().-]+$/.test(s) && d.length >= 8 && d.length <= 15;
  }
  function folio() {
    var t = new Date(); var p = function (n) { return String(n).padStart(2, '0'); };
    return 'C' + String(t.getFullYear()).slice(2) + p(t.getMonth() + 1) + p(t.getDate()) + '-' + p(t.getHours()) + p(t.getMinutes()) + String(Math.floor(Math.random() * 90) + 10);
  }
  function describeItem(cfg, c, it) {
    var u = U(cfg);
    var m = c.t.mode === 'area' ? fmt(num(it.a)) + ' × ' + fmt(num(it.b)) + ' ' + u.len + ' (' + fmt(c.size) + ' ' + u.area + ')'
      : c.t.mode === 'lineal' ? fmt(num(it.a)) + ' ' + u.len + ' de largo' : 'por pieza';
    return c.t.name + ' — ' + m + (c.qty > 1 ? ' × ' + c.qty : '') + ' — diseño ' + (c.d ? c.d.name.toLowerCase() : '');
  }
  /** Arma la cotización completa a partir de lo que capturó el cliente. */
  function buildQuote(cfg, items, contact) {
    var e = estimate(cfg, items);
    var lines = items.map(function (it) { return { it: it, c: itemCalc(cfg, it) }; })
      .filter(function (x) { return x.c && x.c.complete && x.c.total > 0; })
      .map(function (x) {
        var c = x.c;
        return {
          text: describeItem(cfg, c, x.it), total: c.total, material: Math.round(c.material * 100) / 100, labor: c.labor.cost,
          laborText: laborText(c.labor), metal: partsText(cfg, c.parts, c.qty), extra: Math.round(c.designExtra * 100) / 100,
          extraPct: c.extraPct, minApplied: c.minApplied, desc: String(x.it.desc || '').trim(), photo: !!x.it.photo,
          extraText: [c.d && num(c.d.pct) ? c.d.name.toLowerCase() + ' +' + fmt(num(c.d.pct), 1) + ' %' : null]
            .concat(c.feats.map(function (f) { return f.name.toLowerCase() + ' +' + fmt(num(f.pct), 1) + ' %'; })).filter(Boolean).join(', '),
        };
      });
    return {
      folio: folio(), name: String(contact.name || '').trim(), phone: intlPhone(cfg, contact.phone), via: contact.via === 'sms' ? 'sms' : 'whatsapp',
      address: String(contact.address || '').trim(), notes: String(contact.notes || '').trim(),
      items: lines, total: e.total, low: e.low, high: e.high, currency: cfg.currency,
    };
  }
  function ownerMessage(cfg, s) {
    var out = [
      '*Nueva cotización ' + s.folio + '*',
      'Cliente: ' + s.name,
      (s.via === 'sms' ? 'Celular (prefiere SMS)' : 'WhatsApp') + ': ' + s.phone,
      s.via === 'whatsapp' ? 'Abrir chat: https://wa.me/' + digits(s.phone) : null,
      s.address ? 'Ubicación: ' + s.address : null,
      '',
    ];
    s.items.forEach(function (x, i) {
      out.push([
        (i + 1) + ') ' + x.text,
        x.metal ? '   Metal: ' + x.metal : null,
        '   Material: ' + money(cfg, x.material) + ' · Mano de obra: ' + money(cfg, x.labor) + ' (' + x.laborText + ')',
        x.desc ? '   Lo que pide: "' + x.desc + '"' : null,
        x.extra ? '   Dificultad ' + difficulty(x.extraPct).toLowerCase() + ': ' + x.extraText + ' = +' + money(cfg, x.extra) : null,
        x.photo ? '   Tiene foto o dibujo del diseño' : null,
        x.minApplied ? '   (se aplicó el precio mínimo)' : null,
        '   Estimado: ' + money(cfg, x.total),
      ].filter(function (l) { return l !== null; }).join('\n'));
    });
    out.push('', '*Estimado total: ' + money(cfg, s.total) + '*', 'Rango: ' + money(cfg, s.low) + ' – ' + money(cfg, s.high),
      s.notes ? '\nComentarios: ' + s.notes : null, '', '_Estimado automático. El precio final puede variar._');
    return out.filter(function (l) { return l !== null; }).join('\n').replace(/\n{3,}/g, '\n\n');
  }
  function waLink(to, text) { return 'https://wa.me/' + digits(to) + (text ? '?text=' + encodeURIComponent(text) : ''); }

  var core = {
    num: num, U: U, money: money, fmt: fmt, roundUp: roundUp, roundDown: roundDown, metal: metal, metalPrice: metalPrice,
    sizeOf: sizeOf, metalFeet: metalFeet, materialCost: materialCost, laborFor: laborFor, priced: priced, detected: detected,
    itemFeatures: itemFeatures, difficulty: difficulty, design: design, itemCalc: itemCalc, estimate: estimate, laborText: laborText,
    partsText: partsText, digits: digits, intlPhone: intlPhone, phoneOk: phoneOk, describeItem: describeItem, buildQuote: buildQuote,
    ownerMessage: ownerMessage, waLink: waLink,
  };

  /* ═══════════════ Almacenamiento: Supabase (real) o modo de prueba (este navegador) ═══════════════ */
  function createStore(conf) {
    conf = conf || {};
    var hasSb = conf.supabaseUrl && conf.supabaseAnonKey && root.supabase && root.supabase.createClient;
    return hasSb ? supabaseStore(conf) : demoStore();
  }

  function supabaseStore(conf) {
    var sb = root.supabase.createClient(conf.supabaseUrl, conf.supabaseAnonKey, { auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true, storageKey: 'rojo-cotizador-auth' } });
    var cfgChannel = null, cfgListeners = [];
    return {
      demo: false,
      client: sb,
      loadConfig: function () {
        return sb.from('cotizador_config').select('data, updated_at').eq('id', 1).maybeSingle().then(function (r) {
          if (r.error) throw r.error;
          return r.data ? r.data.data : null;
        });
      },
      onConfig: function (cb) {
        cfgListeners.push(cb);
        if (!cfgChannel) {
          cfgChannel = sb.channel('cotizador-config')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'cotizador_config' }, function (p) {
              if (p.new && p.new.data) cfgListeners.forEach(function (fn) { fn(p.new.data); });
            })
            .subscribe();
        }
        return function () { cfgListeners = cfgListeners.filter(function (fn) { return fn !== cb; }); };
      },
      saveQuote: function (q) {
        return sb.from('cotizador_quotes').insert({
          folio: q.folio, client_name: q.name, client_phone: q.phone, contact_via: q.via, address: q.address || null,
          notes: q.notes || null, total: q.total, low: q.low, high: q.high, currency: q.currency, detail: q.items, message: q.message,
        }).then(function (r) { if (r.error) throw r.error; return true; });
      },
      // ── Solo para el panel del dueño ──
      session: function () { return sb.auth.getSession().then(function (r) { return r.data.session; }); },
      onAuth: function (cb) { var s = sb.auth.onAuthStateChange(function (ev, session) { cb(session, ev); }); return function () { s.data.subscription.unsubscribe(); }; },
      signIn: function (email, password) {
        return sb.auth.signInWithPassword({ email: email, password: password }).then(function (r) { if (r.error) throw r.error; return r.data.session; });
      },
      signUp: function (email, password, redirectTo) {
        return sb.auth.signUp({ email: email, password: password, options: { emailRedirectTo: redirectTo } }).then(function (r) { if (r.error) throw r.error; return r.data; });
      },
      resetPassword: function (email, redirectTo) {
        return sb.auth.resetPasswordForEmail(email, { redirectTo: redirectTo }).then(function (r) { if (r.error) throw r.error; });
      },
      updatePassword: function (password) {
        return sb.auth.updateUser({ password: password }).then(function (r) { if (r.error) throw r.error; });
      },
      savePushSub: function (sub, email) {
        return sb.from('cotizador_push_subs').delete().eq('endpoint', sub.endpoint).then(function () {
          return sb.from('cotizador_push_subs').insert({ owner_email: String(email || '').toLowerCase(), endpoint: sub.endpoint, p256dh: sub.p256dh, auth: sub.auth, device: sub.device || null });
        }).then(function (r) { if (r.error) throw r.error; });
      },
      deletePushSub: function (endpoint) {
        return sb.from('cotizador_push_subs').delete().eq('endpoint', endpoint).then(function (r) { if (r.error) throw r.error; });
      },
      signOut: function () { return sb.auth.signOut(); },
      isOwner: function () { return sb.rpc('cotizador_is_owner').then(function (r) { if (r.error) throw r.error; return !!r.data; }); },
      saveConfig: function (cfg) {
        return sb.from('cotizador_config').update({ data: cfg, updated_at: new Date().toISOString() }).eq('id', 1).select('id').then(function (r) {
          if (r.error) throw r.error;
          if (!r.data || !r.data.length) { var e = new Error('Tu correo no tiene permiso para cambiar precios.'); e.code = 'not_owner'; throw e; }
          return true;
        });
      },
      listQuotes: function () {
        return sb.from('cotizador_quotes').select('*').order('created_at', { ascending: false }).limit(200).then(function (r) { if (r.error) throw r.error; return r.data; });
      },
      onQuotes: function (cb) {
        var ch = sb.channel('cotizador-quotes')
          .on('postgres_changes', { event: '*', schema: 'public', table: 'cotizador_quotes' }, function () { cb(); })
          .subscribe();
        return function () { sb.removeChannel(ch); };
      },
      updateQuote: function (id, patch) {
        return sb.from('cotizador_quotes').update(patch).eq('id', id).then(function (r) { if (r.error) throw r.error; });
      },
      deleteQuote: function (id) {
        return sb.from('cotizador_quotes').delete().eq('id', id).then(function (r) { if (r.error) throw r.error; });
      },
    };
  }

  // Modo de prueba: guarda en este navegador y sincroniza pestañas abiertas (para probar sin Supabase).
  function demoStore() {
    var CK = 'cotizador-demo-config', QK = 'cotizador-demo-quotes';
    var bc = typeof BroadcastChannel !== 'undefined' ? new BroadcastChannel('cotizador-demo') : null;
    var listeners = { cfg: [], q: [] };
    function read(k, d) { try { var v = localStorage.getItem(k); return v ? JSON.parse(v) : d; } catch (e) { return d; } }
    function write(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* sin almacenamiento */ } }
    if (bc) bc.onmessage = function (ev) {
      if (ev.data === 'cfg') listeners.cfg.forEach(function (cb) { cb(read(CK, DEFAULT_CONFIG)); });
      if (ev.data === 'q') listeners.q.forEach(function (cb) { cb(); });
    };
    return {
      demo: true,
      loadConfig: function () { return Promise.resolve(read(CK, JSON.parse(JSON.stringify(DEFAULT_CONFIG)))); },
      onConfig: function (cb) { listeners.cfg.push(cb); return function () {}; },
      saveQuote: function (q) {
        var all = read(QK, []);
        all.unshift({ id: Date.now(), created_at: new Date().toISOString(), folio: q.folio, client_name: q.name, client_phone: q.phone, contact_via: q.via,
          address: q.address, notes: q.notes, total: q.total, low: q.low, high: q.high, currency: q.currency, detail: q.items, message: q.message, status: 'nueva' });
        write(QK, all.slice(0, 200)); if (bc) bc.postMessage('q');
        return Promise.resolve(true);
      },
      session: function () { return Promise.resolve({ user: { email: 'modo de prueba' } }); },
      onAuth: function () { return function () {}; },
      signIn: function () { return Promise.resolve({ user: { email: 'modo de prueba' } }); },
      signUp: function () { return Promise.resolve({}); },
      resetPassword: function () { return Promise.resolve(); },
      updatePassword: function () { return Promise.resolve(); },
      savePushSub: function () { return Promise.resolve(); },
      deletePushSub: function () { return Promise.resolve(); },
      signOut: function () { return Promise.resolve(); },
      isOwner: function () { return Promise.resolve(true); },
      saveConfig: function (cfg) { write(CK, cfg); if (bc) bc.postMessage('cfg'); return Promise.resolve(true); },
      listQuotes: function () { return Promise.resolve(read(QK, [])); },
      onQuotes: function (cb) { listeners.q.push(cb); return function () {}; },
      updateQuote: function (id, patch) { write(QK, read(QK, []).map(function (q) { return q.id === id ? Object.assign({}, q, patch) : q; })); return Promise.resolve(); },
      deleteQuote: function (id) { write(QK, read(QK, []).filter(function (q) { return q.id !== id; })); return Promise.resolve(); },
    };
  }

  /* ═══════════════ Cotizador para la página del cliente ═══════════════ */
  var CSS = ":host { --cz-accent: #1f6fe5; --cz-ink: #121821; --cz-ink2: #3c4757; --cz-mute: #687486; --cz-line: #dbe1e8; --cz-bg: #ffffff; --cz-bg2: #f5f7fa; --cz-soft: #e6eefc; --cz-ok: #1a8a60; --cz-warn: #a3650f; --cz-warnbg: #fbf0dc; --cz-bad: #c23a30; display: block; color: var(--cz-ink); font-family: inherit; }\n* { box-sizing: border-box; }\n.cz { font-size: 15px; line-height: 1.5; font-weight: 400; }\nbutton, a, input, textarea { touch-action: manipulation; }\n.cz-load { padding: 24px; text-align: center; color: var(--cz-mute); }\n.cz-grid { display: grid; gap: 18px; grid-template-columns: minmax(0, 1fr) 320px; align-items: start; }\n@media (max-width: 820px) { .cz-grid { grid-template-columns: minmax(0, 1fr); } }\n.cz-stack { display: grid; gap: 14px; }\n.cz-side { position: sticky; top: 16px; }\n@media (max-width: 820px) { .cz-side { position: static; } }\n.cz-card { background: var(--cz-bg); border: 1px solid var(--cz-line); border-radius: 12px; padding: 16px; }\n.cz-empty { text-align: center; padding: 32px 16px; } .cz-empty h3 { margin: 0 0 6px; }\n.cz-head { display: flex; justify-content: space-between; align-items: center; gap: 10px; margin-bottom: 10px; }\n.cz-head h3 { margin: 0; font-size: 17px; } .cz-head h3 b { color: var(--cz-accent); font-size: 12px; font-weight: 600; margin-right: 4px; font-variant-numeric: tabular-nums; }\n.cz-label { font-size: 13px; color: var(--cz-mute); margin: 14px 0 6px; }\n.cz-choices { display: grid; gap: 8px; grid-template-columns: repeat(auto-fill, minmax(140px, 1fr)); }\n.cz-choice { text-align: left; border: 1.5px solid var(--cz-line); background: var(--cz-bg2); color: var(--cz-ink); border-radius: 10px; padding: 10px 12px; font: inherit; cursor: pointer; transition: border-color .15s, background-color .15s; }\n.cz-choice:hover { border-color: var(--cz-accent); }\n.cz-choice[aria-pressed=\"true\"] { border-color: var(--cz-accent); background: var(--cz-soft); }\n.cz-choice .t { display: block; font-weight: 600; font-size: 14.5px; } .cz-choice .d { display: block; font-size: 12.5px; color: var(--cz-mute); }\n.cz-row { display: grid; gap: 10px; grid-template-columns: repeat(auto-fit, minmax(100px, 1fr)); margin-top: 14px; }\n.cz-f { display: grid; gap: 5px; font-size: 13px; font-weight: 500; color: var(--cz-ink2); min-width: 0; }\n.cz-f .u { font-weight: 400; color: var(--cz-mute); font-size: 12px; }\n.cz-in { width: 100%; height: 44px; border: 1px solid var(--cz-line); border-radius: 8px; background: var(--cz-bg); color: var(--cz-ink); font: inherit; font-size: 16px; padding: 0 11px; }\ntextarea.cz-in { height: auto; min-height: 72px; padding: 9px 11px; resize: vertical; }\n.cz-in:focus { outline: 2px solid var(--cz-accent); outline-offset: -1px; border-color: transparent; }\n.cz-in.bad { border-color: var(--cz-bad); }\n.cz-sketch { display: flex; gap: 14px; align-items: center; margin-top: 12px; padding: 10px; border-radius: 10px; background: var(--cz-bg2); font-size: 13px; color: var(--cz-ink2); }\n.cz-sketch svg { width: 120px; height: 84px; flex: none; fill: none; stroke: none; }\n.cz-sketch svg text { fill: var(--cz-ink2); stroke: none; font-family: inherit; }\n.cz-sketch svg .acc { stroke: var(--cz-accent); } .cz-sketch svg .fill { fill: var(--cz-soft); }\n.cz-design { margin-top: 14px; padding-top: 14px; border-top: 1px dashed var(--cz-line); }\n.cz-hint { font-size: 13px; color: var(--cz-mute); margin: 10px 0 6px; }\n.cz-chips { display: flex; flex-wrap: wrap; gap: 6px; }\n.cz-chip { border: 1px solid var(--cz-line); background: var(--cz-bg2); color: var(--cz-ink2); border-radius: 999px; padding: 6px 12px; font: inherit; font-size: 13px; cursor: pointer; }\n.cz-chip[aria-pressed=\"true\"] { background: var(--cz-soft); border-color: var(--cz-accent); color: var(--cz-ink); }\n.cz-chip[aria-pressed=\"true\"]::before { content: \"✓ \"; color: var(--cz-accent); }\n.cz-diff { display: flex; justify-content: space-between; gap: 10px; margin-top: 10px; padding: 8px 12px; border-radius: 9px; font-size: 13.5px; background: var(--cz-bg2); }\n.cz-diff[data-level=\"Media\"] b { color: var(--cz-accent); } .cz-diff[data-level=\"Alta\"] b, .cz-diff[data-level=\"Muy alta\"] b { color: var(--cz-warn); }\n.cz-check { display: flex; gap: 8px; align-items: center; margin-top: 10px; font-size: 13.5px; cursor: pointer; }\n.cz-check input { width: 18px; height: 18px; accent-color: var(--cz-accent); }\n.cz-eyebrow { font-size: 11px; letter-spacing: .12em; text-transform: uppercase; color: var(--cz-mute); }\n.cz-big { font-size: 34px; font-weight: 600; letter-spacing: -0.02em; line-height: 1.15; margin-top: 4px; font-variant-numeric: tabular-nums; }\n.cz-range { font-size: 14px; color: var(--cz-ink2); font-weight: 400; font-variant-numeric: tabular-nums; }\n.cz-lines { display: grid; gap: 8px; margin: 12px 0; padding-top: 12px; border-top: 1px solid var(--cz-line); font-size: 13.5px; }\n.cz-line > div:first-child { display: flex; justify-content: space-between; gap: 10px; }\n.cz-num { font-variant-numeric: tabular-nums; white-space: nowrap; }\n.cz-muted { color: var(--cz-mute); } .cz-small { font-size: 12.5px; }\n.cz-notice { border-radius: 9px; padding: 10px 12px; font-size: 12.5px; line-height: 1.45; background: var(--cz-warnbg); color: var(--cz-warn); margin: 12px 0 0; }\n.cz-btn { display: inline-flex; align-items: center; justify-content: center; gap: 8px; min-height: 46px; padding: 0 18px; border-radius: 9px; border: 1px solid var(--cz-line); background: var(--cz-bg); color: var(--cz-ink); font: inherit; font-weight: 600; font-size: 15px; cursor: pointer; text-decoration: none; }\n.cz-btn:hover { background: var(--cz-bg2); }\n.cz-btn:disabled { opacity: .5; pointer-events: none; }\n.cz-primary { background: var(--cz-accent); border-color: var(--cz-accent); color: #fff; margin-top: 12px; }\n.cz-primary:hover { background: var(--cz-accent); filter: brightness(.92); }\n.cz-wa { background: #1fa855; border-color: #1fa855; color: #fff; } .cz-wa:hover { background: #188a46; }\n.cz-block { width: 100%; }\n.cz-link { border: 0; background: none; color: var(--cz-mute); font: inherit; font-size: 13.5px; cursor: pointer; text-decoration: underline; }\n:focus-visible { outline: 2px solid var(--cz-accent); outline-offset: 2px; }\n/* Panel */\n.cz-overlay { position: fixed; inset: 0; background: rgba(10, 14, 20, .55); z-index: 2147483000; }\n.cz-overlay.cz-anim { animation: czfade .18s ease-out; }\n.cz-panel { position: fixed; z-index: 2147483001; right: 0; top: 0; bottom: 0; width: min(460px, 100%); background: var(--cz-bg); color: var(--cz-ink); overflow-y: auto; padding: 28px 22px calc(24px + env(safe-area-inset-bottom, 0px)); box-shadow: -12px 0 40px rgba(0,0,0,.18); display: grid; gap: 12px; align-content: start; font-size: 15px; line-height: 1.5; }\n.cz-panel.cz-anim { animation: czslide .26s cubic-bezier(.2,.7,.2,1); }\n@media (max-width: 560px) { .cz-panel { top: auto; max-height: 92dvh; border-radius: 16px 16px 0 0; } .cz-panel.cz-anim { animation-name: czup; } }\n.cz-x { position: absolute; top: 10px; right: 12px; width: 38px; height: 38px; border: 0; border-radius: 8px; background: var(--cz-bg2); font-size: 22px; line-height: 1; cursor: pointer; color: var(--cz-ink2); }\n.cz-title { margin: 2px 40px 0 0; font-size: 22px; }\n.cz-form { display: grid; gap: 12px; }\n.cz-seg-row { display: flex; flex-wrap: wrap; gap: 8px; align-items: center; justify-content: space-between; }\n.cz-seg { display: inline-flex; border: 1px solid var(--cz-line); border-radius: 8px; padding: 2px; background: var(--cz-bg2); }\n.cz-seg button { border: 0; background: none; font: inherit; font-size: 13.5px; color: var(--cz-mute); padding: 6px 12px; border-radius: 6px; cursor: pointer; }\n.cz-seg button[aria-pressed=\"true\"] { background: var(--cz-bg); color: var(--cz-ink); box-shadow: 0 0 0 1px var(--cz-line); }\n.cz-err { color: var(--cz-bad); font-size: 13px; margin: 0; }\n.cz-seg-row.bad .cz-seg { box-shadow: 0 0 0 2px var(--cz-bad); }\n.cz-ok { width: 46px; height: 46px; border-radius: 50%; background: #e1f4ec; color: var(--cz-ok); display: grid; place-items: center; font-size: 22px; font-weight: 700; }\n.cz-summary { display: grid; gap: 8px; padding: 12px; border-radius: 10px; background: var(--cz-bg2); font-size: 14px; }\n.cz-summary > div { display: flex; justify-content: space-between; gap: 12px; }\n.cz-total { border-top: 1px solid var(--cz-line); padding-top: 8px; font-weight: 600; }\n@keyframes czfade { from { opacity: 0; } }\n@keyframes czslide { from { transform: translateX(24px); opacity: 0; } }\n@keyframes czup { from { transform: translateY(24px); opacity: 0; } }\n@media (prefers-reduced-motion: reduce) { .cz-overlay, .cz-panel { animation: none; } }\n";

  var PANEL_CSS = [
    '.czp[hidden] { display: none; }',
    '.czp-overlay { position: fixed; inset: 0; background: rgba(10, 14, 20, .6); z-index: 2147482000; }',
    '.czp-sheet { position: fixed; z-index: 2147482001; top: 0; right: 0; bottom: 0; width: min(1080px, 100%); background: var(--cz-bg2); color: var(--cz-ink); display: flex; flex-direction: column; box-shadow: -16px 0 48px rgba(0,0,0,.25); }',
    '.czp-anim .czp-overlay { animation: czfade .2s ease-out; } .czp-anim .czp-sheet { animation: czslide .3s cubic-bezier(.2,.7,.2,1); }',
    '@media (max-width: 640px) { .czp-anim .czp-sheet { animation-name: czup; } }',
    '.czp-head { display: flex; justify-content: space-between; align-items: center; gap: 12px; background: var(--cz-bg); border-bottom: 1px solid var(--cz-line); padding: calc(12px + env(safe-area-inset-top, 0px)) max(16px, env(safe-area-inset-right, 0px)) 12px max(16px, env(safe-area-inset-left, 0px)); }',
    '.czp-head strong { font-size: 18px; } .czp-head .cz-x { position: static; flex: none; }',
    '.czp-body { flex: 1; overflow-y: auto; -webkit-overflow-scrolling: touch; overscroll-behavior: contain; padding: 18px max(16px, env(safe-area-inset-right, 0px)) calc(28px + env(safe-area-inset-bottom, 0px)) max(16px, env(safe-area-inset-left, 0px)); }',
    '.czp-body .cz-side { top: 0; }',
    '.czp-step { max-width: 560px; margin: 0 auto; display: grid; gap: 12px; background: var(--cz-bg); border: 1px solid var(--cz-line); border-radius: 12px; padding: 20px; }',
    '.czp-step .cz-title { margin-right: 0; } .czp-back { justify-self: start; padding: 0; }',
    '.cz-seg-row.bad .cz-seg { box-shadow: 0 0 0 2px var(--cz-bad); }',
    '.czp-fab { position: fixed; right: max(18px, env(safe-area-inset-right, 0px)); bottom: calc(18px + env(safe-area-inset-bottom, 0px)); z-index: 2147481000; border: 0; border-radius: 999px; padding: 14px 24px; background: var(--cz-accent); color: #fff; font: inherit; font-weight: 700; font-size: 16px; box-shadow: 0 8px 24px rgba(0,0,0,.25); cursor: pointer; }',
    '.czp-fab:hover { filter: brightness(.93); }',
    '.czp-fab-left { right: auto; left: max(16px, env(safe-area-inset-left, 0px)); }',
    '.czp-fab { touch-action: manipulation; transition: transform .1s; } .czp-fab:active { transform: scale(.95); }',
    '.czp-sheet { font-weight: 400; }',
  ].join('\n');

  function esc(v) { return String(v == null ? '' : v).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function uid() { return Math.random().toString(36).slice(2, 9); }

  /**
   * mode 'inline': el cotizador vive dentro de la página y los datos del cliente se piden en un panel lateral.
   * mode 'panel':  todo el cotizador se abre encima de la página (como «Personalizar»), sin salir de ella.
   */
  function mount(container, options) {
    options = options || {};
    var mode = options.mode || 'inline';
    var conf = options.config || root.COTIZADOR_CONFIG || {};
    var store = options.store || createStore(conf);
    var shadow = container.attachShadow ? container.attachShadow({ mode: 'open' }) : container;
    var accent = container.getAttribute('data-color') || conf.color;
    var accentCss = accent && /^#[0-9a-f]{3,8}$/i.test(accent) ? ':host{--cz-accent:' + accent + '}' : '';
    var lastFocus = null;
    if (mode === 'panel') {
      shadow.innerHTML = '<style>' + CSS + PANEL_CSS + accentCss + '</style>' +
        (conf.floatingButton ? '<button class="czp-fab' + (conf.floatingButtonSide === 'left' ? ' czp-fab-left' : '') + '" type="button" data-act="show">' + esc(conf.floatingButtonText || 'Cotizar') + '</button>' : '') +
        '<div class="czp" hidden><div class="czp-overlay" data-act="close"></div>' +
        '<div class="czp-sheet" role="dialog" aria-modal="true" aria-labelledby="czp-title">' +
        '<header class="czp-head"><div><div class="cz-eyebrow" data-biz></div><strong id="czp-title">Cotiza tu proyecto</strong></div>' +
        '<button class="cz-x" type="button" data-act="close" aria-label="Cerrar">×</button></header>' +
        '<div class="czp-body"><div class="cz" part="cotizador"><div class="cz-load">Cargando precios…</div></div></div></div></div><div class="cz-modal-root"></div>';
    } else {
      shadow.innerHTML = '<style>' + CSS + accentCss + '</style><div class="cz" part="cotizador"><div class="cz-load">Cargando precios…</div></div><div class="cz-modal-root"></div>';
    }
    var $root = shadow.querySelector('.cz');
    var $modal = shadow.querySelector('.cz-modal-root');
    var $wrap = shadow.querySelector('.czp');
    var $body = shadow.querySelector('.czp-body');
    var cfg = null;
    var emptyContact = function () { return { name: '', phone: '', via: '', address: '', notes: '' }; };
    var state = { items: [], contact: emptyContact(), tried: false, modal: null, step: 'calc', sending: false, sent: null, error: '' };
    var isOpen = function () { return mode === 'panel' ? !!($wrap && !$wrap.hidden) : !!state.modal; };

    function show() {
      if (mode !== 'panel' || !$wrap.hidden) return;
      lastFocus = document.activeElement;
      $wrap.hidden = false; $wrap.classList.add('czp-anim');
      setTimeout(function () { $wrap.classList.remove('czp-anim'); }, 400);
      document.documentElement.style.overflow = 'hidden';
      var x = shadow.querySelector('.czp-head .cz-x'); if (x) x.focus();
    }
    function hide() {
      if (mode !== 'panel' || $wrap.hidden) return;
      $wrap.hidden = true;
      document.documentElement.style.overflow = '';
      if (state.step === 'done') reset();
      if (lastFocus && lastFocus.focus) lastFocus.focus();
    }
    function reset() {
      state.items = [newItem()]; state.contact = emptyContact(); state.tried = false; state.sent = null; state.step = 'calc'; state.error = '';
      render();
    }
    function toTop() { if ($body) $body.scrollTop = 0; }

    function newItem() {
      var first = (cfg.types || []).find(function (t) { return core.priced(cfg, t); });
      return { id: uid(), typeId: first ? first.id : '', a: '', b: '', qty: 1, designId: (cfg.designs[0] || {}).id || '', desc: '', featOver: {}, photo: false };
    }
    function money(n) { return core.money(cfg, n); }

    function render() {
      var biz = shadow.querySelector('[data-biz]'); if (biz) biz.textContent = cfg.business || '';
      if (mode === 'panel' && state.step !== 'calc') {
        $root.innerHTML = '<div class="czp-step">' + (state.step === 'form'
          ? '<button class="cz-link czp-back" type="button" data-act="back">← Volver a mi proyecto</button>' + formView()
          : doneView()) + '</div>';
        return;
      }
      var available = cfg.types.filter(function (t) { return core.priced(cfg, t); });
      if (!available.length) { $root.innerHTML = '<div class="cz-card cz-empty"><h3>Muy pronto</h3><p>Estamos preparando nuestros precios. Vuelve más tarde para cotizar al instante.</p></div>'; return; }
      state.items.forEach(function (it) { if (!available.some(function (t) { return t.id === it.typeId; })) it.typeId = available[0].id; });
      $root.innerHTML = '<div class="cz-grid"><div class="cz-stack">' + state.items.map(function (it, i) { return itemView(it, i, available); }).join('') +
        '<button class="cz-btn" type="button" data-act="add-item">+ Agregar otro trabajo</button></div>' +
        '<aside class="cz-side"><section class="cz-card cz-est" data-est aria-live="polite"></section></aside></div>';
      refreshEstimate();
    }

    function itemView(it, i, available) {
      var t = cfg.types.find(function (x) { return x.id === it.typeId; });
      var u = core.U(cfg);
      var fields = !t ? '' : t.mode === 'area'
        ? field('Ancho', u.len, it, 'a') + field('Alto', u.len, it, 'b')
        : t.mode === 'lineal' ? field('Largo', u.len, it, 'a') : '';
      return '<section class="cz-card" aria-label="Trabajo ' + (i + 1) + '">' +
        '<div class="cz-head"><h3><b>0' + (i + 1) + '</b> ¿Qué necesitas?</h3>' + (state.items.length > 1 ? '<button class="cz-link" type="button" data-act="del-item" data-i="' + it.id + '">Quitar</button>' : '') + '</div>' +
        '<div class="cz-choices">' + available.map(function (x) {
          return '<button type="button" class="cz-choice" data-act="type" data-i="' + it.id + '" data-v="' + esc(x.id) + '" aria-pressed="' + (x.id === it.typeId) + '"><span class="t">' + esc(x.name) + '</span><span class="d">' + (x.mode === 'area' ? 'Ancho × alto' : x.mode === 'lineal' ? 'Por largo' : 'Por pieza') + '</span></button>';
        }).join('') + '</div>' +
        (t ? '<div class="cz-row">' + fields + field('Cantidad', '', it, 'qty', 'numeric') + '</div>' +
          (t.mode !== 'pieza' ? '<div class="cz-sketch" data-sk="' + it.id + '">' + sketch(it, t) + '</div>' : '') +
          '<div class="cz-label">Estilo</div><div class="cz-choices">' + cfg.designs.map(function (d) {
            return '<button type="button" class="cz-choice" data-act="design" data-i="' + it.id + '" data-v="' + esc(d.id) + '" aria-pressed="' + (d.id === it.designId) + '"><span class="t">' + esc(d.name) + '</span><span class="d">' + esc(d.desc) + '</span></button>';
          }).join('') + '</div>' +
          '<div class="cz-design"><label class="cz-f">Describe el diseño que quieres <span class="u">opcional</span>' +
          '<textarea class="cz-in" data-i="' + it.id + '" data-k="desc" placeholder="Ej.: portón corredizo con arco arriba, puerta peatonal y lanzas de forja">' + esc(it.desc) + '</textarea></label>' +
          '<div data-feat="' + it.id + '">' + featBlock(it) + '</div>' +
          '<label class="cz-check"><input type="checkbox" data-act="photo" data-i="' + it.id + '"' + (it.photo ? ' checked' : '') + '> Tengo foto o dibujo del diseño</label></div>' : '') +
        '</section>';
    }
    function field(label, unit, it, k, mode) {
      return '<label class="cz-f">' + label + (unit ? ' <span class="u">' + unit + '</span>' : '') + '<input class="cz-in" data-i="' + it.id + '" data-k="' + k + '" value="' + esc(it[k]) + '" inputmode="' + (mode || 'decimal') + '"></label>';
    }
    function featBlock(it) {
      var list = cfg.features || [];
      if (!list.length) return '';
      var on = core.itemFeatures(cfg, it).map(function (f) { return f.id; });
      var d = core.design(cfg, it.designId);
      var pct = core.num(d && d.pct) + list.filter(function (f) { return on.indexOf(f.id) >= 0; }).reduce(function (s, f) { return s + core.num(f.pct); }, 0);
      var level = core.difficulty(pct);
      return '<div class="cz-hint">¿Qué lleva tu diseño? ' + (String(it.desc || '').trim() ? 'Marcamos lo que encontramos en tu descripción; corrige si hace falta.' : 'Marca lo que aplique.') + '</div>' +
        '<div class="cz-chips">' + list.map(function (f) {
          return '<button type="button" class="cz-chip" data-act="feat" data-i="' + it.id + '" data-v="' + esc(f.id) + '" aria-pressed="' + (on.indexOf(f.id) >= 0) + '" title="' + esc(f.desc) + '">' + esc(f.name) + '</button>';
        }).join('') + '</div>' +
        '<div class="cz-diff" data-level="' + esc(level) + '"><span>Dificultad del trabajo</span><b>' + level + (pct > 0 ? ' · +' + core.fmt(pct, 1) + ' %' : '') + '</b></div>';
    }
    function sketch(it, t) {
      var u = core.U(cfg), d = core.design(cfg, it.designId), S = core.num(d && d.spacing);
      if (t.mode === 'lineal') {
        var L = core.num(it.a), P = core.num(t.postEvery);
        var posts = L > 0 && P > 0 ? Math.min(12, Math.ceil(L / P) + 1) : 4, svg = '';
        for (var k = 0; k < posts; k++) svg += '<path d="M' + (8 + (104 / (posts - 1)) * k) + ' 60V22" stroke="currentColor" stroke-width="2.6"/>';
        for (k = 0; k < 20; k++) svg += '<path d="M' + (10 + k * 5.2) + ' 56V26" class="acc" stroke-width=".8" opacity=".5"/>';
        return '<svg viewBox="0 0 120 84" aria-hidden="true"><path d="M8 58h104M8 24h104" class="acc" stroke-width="2.4"/>' + svg +
          '<text x="60" y="80" text-anchor="middle" font-size="10">' + (L ? core.fmt(L) + ' ' + u.len : 'largo') + '</text></svg>' +
          '<div><div class="cz-muted">Medida a cotizar</div><div class="cz-num">' + (L ? core.fmt(L * Math.max(1, core.num(it.qty))) + ' ' + u.len + ' lineales' : 'Escribe el largo') + '</div>' + (L ? '<div class="cz-muted">' + posts + ' postes</div>' : '') + '</div>';
      }
      var A = core.num(it.a), B = core.num(it.b), W = 82, H = 56, w = W, h = H;
      if (A > 0 && B > 0) { var kk = Math.min(W / A, H / B); w = Math.max(10, A * kk); h = Math.max(10, B * kk); }
      var x = 10 + (W - w) / 2, y = 6 + (H - h) / 2;
      var realBars = A > 0 && S > 0 ? Math.max(0, Math.ceil((A * u.subPer) / S) - 1) : 6;
      var drawBars = Math.min(realBars, 40), rails = Math.max(0, Math.floor(core.num(t.rails))), bars = '';
      for (var i = 0; i < drawBars; i++) bars += '<path d="M' + (x + (w / (drawBars + 1)) * (i + 1)) + ' ' + y + 'v' + h + '" class="acc" stroke-width=".8" opacity=".6"/>';
      for (i = 0; i < rails; i++) bars += '<path d="M' + x + ' ' + (y + (h / (rails + 1)) * (i + 1)) + 'h' + w + '" class="acc" stroke-width="1.6"/>';
      return '<svg viewBox="0 0 120 84" aria-hidden="true"><rect x="' + x + '" y="' + y + '" width="' + w + '" height="' + h + '" class="fill acc" stroke-width="2"/>' + bars +
        '<path d="M' + x + ' 72h' + w + 'M' + x + ' 69v6M' + (x + w) + ' 69v6" stroke="currentColor" stroke-width=".8" opacity=".5"/>' +
        '<text x="' + (x + w / 2) + '" y="82" text-anchor="middle" font-size="9.5">' + (A ? core.fmt(A) : 'ancho') + '</text>' +
        '<text x="' + (x + w + 4) + '" y="' + (y + h / 2 + 3) + '" font-size="9.5">' + (B ? core.fmt(B) : 'alto') + '</text></svg>' +
        '<div><div class="cz-muted">Superficie</div><div class="cz-num">' + (A && B ? core.fmt(A * B * Math.max(1, core.num(it.qty))) + ' ' + u.area : 'Escribe ancho y alto') + '</div>' +
        (A && B && S ? '<div class="cz-muted">' + realBars + ' barrotes cada ' + core.fmt(S) + ' ' + u.sub + '</div>' : '') + '</div>';
    }

    function refreshEstimate() {
      var box = shadow.querySelector('[data-est]');
      if (!box) return;
      var e = core.estimate(cfg, state.items);
      var pending = state.items.some(function (it) { var c = core.itemCalc(cfg, it); return !c || !c.complete; });
      box.innerHTML = e.total > 0
        ? '<div class="cz-eyebrow">Tu estimado</div><div class="cz-big">' + money(e.total) + '</div><div class="cz-range">Entre ' + money(e.low) + ' y ' + money(e.high) + '</div>' +
          '<div class="cz-lines">' + e.calcs.map(function (c) {
            return '<div class="cz-line"><div><span>' + esc(c.t.name) + (c.qty > 1 ? ' × ' + c.qty : '') + ' <span class="cz-muted">· ' + esc(c.d ? c.d.name : '') + '</span></span><span class="cz-num">' + money(c.total) + '</span></div>' +
              '<div class="cz-muted cz-small">Material y mano de obra (' + esc(core.laborText(c.labor)) + ')' + (c.extraPct > 0 ? ' · dificultad ' + core.difficulty(c.extraPct).toLowerCase() + ' +' + core.fmt(c.extraPct, 1) + ' %' : '') + '</div></div>';
          }).join('') + (pending ? '<div class="cz-muted cz-small">Completa las medidas que faltan</div>' : '') + '</div>' +
          '<p class="cz-notice">' + esc(cfg.disclaimer) + '</p>' +
          '<button class="cz-btn cz-primary cz-block" type="button" data-act="open">Obtener mi cotización</button>'
        : '<div class="cz-eyebrow">Tu estimado</div><div class="cz-big cz-muted">—</div><p class="cz-muted cz-small">Elige el trabajo y escribe las medidas: el precio aparece al instante.</p>';
    }

    /* ── Panel (se abre encima de la misma página) ── */
    function focusName() { setTimeout(function () { var f = shadow.querySelector('[data-c="name"]'); if (f) f.focus(); }, 30); }
    function openPanel() {
      state.error = '';
      if (mode === 'panel') { state.step = 'form'; render(); toTop(); focusName(); return; }
      state.modal = 'form'; state.animate = true; renderModal(); focusName();
    }
    function closePanel() { if (mode === 'panel') { hide(); return; } state.modal = null; renderModal(); }
    function refreshForm() { if (mode === 'panel') render(); else renderModal(); }
    function renderModal() {
      if (!state.modal) { $modal.innerHTML = ''; document.documentElement.style.overflow = ''; return; }
      document.documentElement.style.overflow = 'hidden';
      var body = state.modal === 'done' ? doneView() : formView();
      var anim = state.animate ? ' cz-anim' : ''; state.animate = false; // sólo se anima al abrir, no al actualizarse
      $modal.innerHTML = '<div class="cz-overlay' + anim + '" data-act="close"></div><div class="cz-panel' + anim + '" role="dialog" aria-modal="true" aria-label="Tu cotización">' +
        '<button class="cz-x" type="button" data-act="close" aria-label="Cerrar">×</button>' + body + '</div>';
    }
    function formView() {
      var e = core.estimate(cfg, state.items), c = state.contact, bad = function (ok) { return state.tried && !ok ? ' bad' : ''; };
      return '<div class="cz-eyebrow">Tu cotización</div><h3 class="cz-title">' + money(e.total) + ' <span class="cz-range">(' + money(e.low) + ' – ' + money(e.high) + ')</span></h3>' +
        '<p class="cz-muted cz-small">Déjanos tus datos para enviarte la cotización y comunicarnos contigo.</p>' +
        '<form class="cz-form" data-form novalidate>' +
        '<label class="cz-f">Nombre<input class="cz-in' + bad(c.name.trim()) + '" data-c="name" value="' + esc(c.name) + '" autocomplete="name" required></label>' +
        '<label class="cz-f">Número de WhatsApp o celular <span class="u">obligatorio, con + y código de país</span><input class="cz-in' + bad(core.phoneOk(c.phone)) + '" data-c="phone" value="' + esc(c.phone) + '" inputmode="tel" autocomplete="tel" placeholder="+1 602 555 0123" required></label>' +
        '<div class="cz-seg-row' + (state.tried && !c.via ? ' bad' : '') + '"><span class="cz-small">¿Por dónde te contactamos? <span class="cz-muted">(obligatorio)</span></span><div class="cz-seg">' +
        '<button type="button" data-act="via" data-v="whatsapp" aria-pressed="' + (c.via === 'whatsapp') + '">WhatsApp</button><button type="button" data-act="via" data-v="sms" aria-pressed="' + (c.via === 'sms') + '">Mensaje SMS</button></div></div>' +
        '<label class="cz-f">Ciudad o colonia <span class="u">opcional</span><input class="cz-in" data-c="address" value="' + esc(c.address) + '"></label>' +
        '<label class="cz-f">Comentarios <span class="u">opcional</span><textarea class="cz-in" data-c="notes" placeholder="Color, si incluye instalación…">' + esc(c.notes) + '</textarea></label>' +
        (state.error ? '<p class="cz-err" role="alert">' + esc(state.error) + '</p>' : '') +
        '<button class="cz-btn cz-primary cz-block" type="submit"' + (state.sending ? ' disabled' : '') + '>' + (state.sending ? 'Enviando…' : 'Enviar mi cotización') + '</button>' +
        '<p class="cz-notice">' + esc(cfg.disclaimer) + '</p></form>';
    }
    function doneView() {
      var s = state.sent, msg = s.message;
      return '<div class="cz-ok">✓</div><div class="cz-eyebrow">Cotización ' + esc(s.folio) + '</div>' +
        '<h3 class="cz-title">¡Listo, ' + esc(s.name.split(' ')[0]) + '! Recibimos tu cotización</h3>' +
        '<p class="cz-muted cz-small">Te contactaremos por ' + (s.via === 'sms' ? 'mensaje SMS' : 'WhatsApp') + ' al ' + esc(s.phone) + '.</p>' +
        '<div class="cz-summary">' + s.items.map(function (x) { return '<div><span>' + esc(x.text) + '</span><span class="cz-num">' + money(x.total) + '</span></div>'; }).join('') +
        '<div class="cz-total"><span>Estimado total</span><span class="cz-num">' + money(s.total) + '</span></div>' +
        '<div class="cz-muted cz-small"><span>Rango posible</span><span class="cz-num">' + money(s.low) + ' – ' + money(s.high) + '</span></div></div>' +
        '<p class="cz-notice">' + esc(cfg.disclaimer) + '</p>' +
        (core.phoneOk(cfg.whatsapp) ? '<a class="cz-btn cz-wa cz-block" href="' + esc(core.waLink(cfg.whatsapp, msg)) + '" target="_blank" rel="noopener">Escribirnos por WhatsApp (opcional)</a>' +
          (s.items.some(function (x) { return x.photo; }) ? '<p class="cz-muted cz-small" style="text-align:center">Mándanos ahí la foto o dibujo de tu diseño.</p>' : '') : '') +
        '<button class="cz-btn cz-block" type="button" data-act="new">Hacer otra cotización</button>';
    }
    function submit() {
      state.tried = true;
      var c = state.contact, e = core.estimate(cfg, state.items);
      if (!e.total) { state.error = 'Completa las medidas del trabajo.'; refreshForm(); return; }
      var err = !c.name.trim() ? 'Escribe tu nombre.'
        : !String(c.phone || '').trim() ? 'El número de WhatsApp o celular es obligatorio. Escríbelo con + y código de país, por ejemplo: +1 602 555 0123'
        : !core.phoneOk(c.phone) ? 'Escribe tu número con + y código de país, por ejemplo: +1 602 555 0123'
        : !c.via ? 'Elige si te contactamos por WhatsApp o por mensaje SMS.' : '';
      if (err) { state.error = err; refreshForm(); var b = shadow.querySelector('.cz-in.bad'); if (b) b.focus(); return; }
      var q = core.buildQuote(cfg, state.items, c);
      q.message = core.ownerMessage(cfg, q);
      state.sending = true; state.error = ''; refreshForm();
      store.saveQuote(q).then(function () {
        state.sending = false; state.sent = q;
        if (mode === 'panel') { state.step = 'done'; render(); toTop(); } else { state.modal = 'done'; renderModal(); }
      }).catch(function () {
        state.sending = false; state.error = 'No pudimos enviar tu cotización. Revisa tu conexión e intenta de nuevo.'; refreshForm();
      });
    }

    /* ── Eventos ── */
    shadow.addEventListener('click', function (ev) {
      var el = ev.target.closest ? ev.target.closest('[data-act]') : null;
      if (!el) return;
      var act = el.getAttribute('data-act'), id = el.getAttribute('data-i'), v = el.getAttribute('data-v');
      var item = state.items.find(function (x) { return x.id === id; });
      if (act === 'type' && item) { item.typeId = v; render(); }
      else if (act === 'design' && item) { item.designId = v; render(); }
      else if (act === 'add-item') { state.items.push(newItem()); render(); }
      else if (act === 'del-item') { state.items = state.items.filter(function (x) { return x.id !== id; }); render(); }
      else if (act === 'feat' && item) {
        var on = core.itemFeatures(cfg, item).some(function (f) { return f.id === v; });
        item.featOver = Object.assign({}, item.featOver, (function () { var o = {}; o[v] = !on; return o; })());
        var box = shadow.querySelector('[data-feat="' + item.id + '"]'); if (box) box.innerHTML = featBlock(item);
        refreshEstimate();
      }
      else if (act === 'photo' && item) item.photo = el.checked;
      else if (act === 'open') openPanel();
      else if (act === 'close') closePanel();
      else if (act === 'show') show();
      else if (act === 'back') { state.step = 'calc'; state.error = ''; render(); toTop(); }
      else if (act === 'via') { state.contact.via = v; if (state.error) state.error = ''; refreshForm(); }
      else if (act === 'new') {
        if (mode === 'panel') { reset(); toTop(); return; }
        state.items = [newItem()]; state.contact = emptyContact(); state.tried = false; state.sent = null;
        closePanel(); render(); container.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    });
    shadow.addEventListener('submit', function (ev) { ev.preventDefault(); submit(); });
    shadow.addEventListener('input', function (ev) {
      var el = ev.target, k = el.getAttribute('data-k'), i = el.getAttribute('data-i'), c = el.getAttribute('data-c');
      if (c) { state.contact[c] = el.value; if (state.error) { state.error = ''; var er = shadow.querySelector('.cz-err'); if (er) er.remove(); } if (state.tried) el.classList.toggle('bad', c === 'name' ? !el.value.trim() : c === 'phone' ? !core.phoneOk(el.value) : false); return; }
      if (!i || !k) return;
      var it = state.items.find(function (x) { return x.id === i; });
      if (!it) return;
      it[k] = el.value;
      var t = cfg.types.find(function (x) { return x.id === it.typeId; });
      var sk = shadow.querySelector('[data-sk="' + it.id + '"]'); if (sk && t) sk.innerHTML = sketch(it, t);
      if (k === 'desc') { var fb = shadow.querySelector('[data-feat="' + it.id + '"]'); if (fb) fb.innerHTML = featBlock(it); }
      refreshEstimate();
    });
    document.addEventListener('keydown', function (ev) { if (ev.key === 'Escape' && isOpen()) closePanel(); });

    /* ── Arranque y actualización automática de precios ── */
    function applyConfig(next) {
      cfg = next || JSON.parse(JSON.stringify(DEFAULT_CONFIG));
      if (!state.items.length) state.items = [newItem()];
      var focused = shadow.activeElement;
      var keep = focused && focused.getAttribute ? { k: focused.getAttribute('data-k'), i: focused.getAttribute('data-i'), c: focused.getAttribute('data-c'), pos: focused.selectionStart } : null;
      render();
      if (state.modal) renderModal();
      if (keep && (keep.k || keep.c)) {
        var sel = keep.c ? '[data-c="' + keep.c + '"]' : '[data-i="' + keep.i + '"][data-k="' + keep.k + '"]';
        var again = shadow.querySelector(sel);
        if (again) { again.focus(); try { again.setSelectionRange(keep.pos, keep.pos); } catch (e) { /* no aplica */ } }
      }
    }
    if (store.demo && root.console) console.info('[cotizador] Modo de prueba: falta configurar Supabase en config.js. Los datos se guardan solo en este navegador.');
    store.loadConfig().then(function (c) { applyConfig(c); }).catch(function () {
      applyConfig(null);
      if (root.console) console.warn('[cotizador] No se pudieron leer los precios de Supabase; se usan los precios incluidos en cotizador.js.');
    });
    store.onConfig(function (c) { applyConfig(c); });
    return { store: store, open: show, close: hide };
  }

  var api = { core: core, createStore: createStore, mount: mount, DEFAULT_CONFIG: DEFAULT_CONFIG };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  root.Cotizador = api;

  /* Montaje automático:
     - <div id="cotizador-herreria"></div>  → cotizador dentro de la página
     - Cualquier botón o enlace con data-cotizar o href="#cotizar" → abre el panel completo encima de la página
     - Botón flotante «Cotizar» si config.js trae floatingButton: true
     - Abrir tuweb.com/#cotizar abre el panel directamente */
  if (typeof document !== 'undefined' && !root.COTIZADOR_NO_AUTOMOUNT) {
    var start = function () {
      var conf = root.COTIZADOR_CONFIG || {};
      var store = createStore(conf);
      var el = document.getElementById('cotizador-herreria');
      if (el && !el.__cz) { el.__cz = true; mount(el, { store: store }); }
      if (conf.panel === false || document.getElementById('cotizador-herreria-panel')) return;
      var host = document.createElement('div');
      host.id = 'cotizador-herreria-panel';
      document.body.appendChild(host);
      var panel = mount(host, { mode: 'panel', store: store, config: conf });
      api.open = panel.open; api.close = panel.close;
      document.addEventListener('click', function (ev) {
        var t = ev.target.closest && ev.target.closest('[data-cotizar], a[href="#cotizar"], a[href$="/#cotizar"]');
        if (!t) return;
        ev.preventDefault();
        panel.open();
      });
      if (location.hash === '#cotizar') panel.open();
      window.addEventListener('hashchange', function () { if (location.hash === '#cotizar') panel.open(); });
    };
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start); else start();
  }
})(typeof window !== 'undefined' ? window : globalThis);
