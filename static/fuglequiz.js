// Fuglequiz med sværhedsgrader. Data: /fuglequiz.json (bygges af src/build.mjs).
(function () {
  var BASE = window.DF_BASE || '';
  var root = document.getElementById('fq');
  if (!root) return;
  var $ = function (id) { return document.getElementById(id); };
  var form = $('fq-form'), setup = $('fq-setup'), play = $('fq-play'), end = $('fq-end');
  var writeBox = $('fq-write'), writeWrap = $('fq-write-wrap'), bestEl = $('fq-best');
  var SKEY = 'dagensfugl-fuglequiz';
  var LVN = { 1: 'Lette', 2: 'Almindelige', 3: 'Svære', 4: 'Ekspert', fejl: 'Dem du tager fejl af' };
  var TYN = { foto: 'Foto', lyd: 'Lyd', navn: 'Navn', blandet: 'Blandet' };
  var PAIRS = [], DATA = null, cfg = null, qs = [], qi = 0, score = 0, wrongs = [], answered = false;

  function load() { try { return JSON.parse(localStorage.getItem(SKEY) || '{}') || {}; } catch (e) { return {}; } }
  function save(o) { try { localStorage.setItem(SKEY, JSON.stringify(o)); } catch (e) {} }
  function el(tag, cls, text) { var e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; }
  function shuffle(a) { a = a.slice(); for (var i = a.length - 1; i > 0; i--) { var j = Math.floor(Math.random() * (i + 1)); var t = a[i]; a[i] = a[j]; a[j] = t; } return a; }
  function pick(a) { return a[Math.floor(Math.random() * a.length)]; }
  function cfgKey(c) { return c.lv + '-' + c.type + '-' + c.n + (c.write ? '-w' : ''); }

  function readForm() {
    var f = new FormData(form);
    var c = { lv: f.get('lv') === 'fejl' ? 'fejl' : Number(f.get('lv')), type: f.get('type'), n: Number(f.get('n')), write: !!writeBox.checked };
    if (c.lv === 4 && c.type !== 'navn') c.write = true;
    if (c.type === 'navn') c.write = false;
    return c;
  }
  function fejlOption() {
    var n = Object.keys(misses()).length;
    var box = form.querySelector('.fq-choices.lv'); var ex = document.getElementById('fq-fejl');
    if (n >= 3 && !ex) {
      var l = el('label', 'fq-choice'); l.id = 'fq-fejl';
      var r = el('input'); r.type = 'radio'; r.name = 'lv'; r.value = 'fejl';
      var s = el('span'); s.appendChild(el('b', null, 'Dem du tager fejl af')); s.appendChild(el('small', null, n + ' arter, du har svaret forkert på'));
      l.appendChild(r); l.appendChild(s); box.appendChild(l);
    } else if (ex) ex.querySelector('small').textContent = n + ' arter, du har svaret forkert på';
  }
  function syncForm() {
    fejlOption();
    var c = readForm();
    writeWrap.hidden = c.type === 'navn';
    writeBox.disabled = c.lv === 4;
    if (c.lv === 4) writeBox.checked = true;
    var best = load()[cfgKey(c)];
    bestEl.textContent = best ? 'Dit bedste resultat med disse valg: ' + best + ' af ' + c.n + ' rigtige.' : '';
  }
  form.addEventListener('change', function (e) {
    if (e.target.name === 'lv' && e.target.value !== '4' && writeBox.disabled) writeBox.checked = false;
    syncForm();
  });
  syncForm();

  // ---- Svarmuligheder ----
  function byKey(k) { for (var i = 0; i < DATA.length; i++) if (DATA[i].k === k) return DATA[i]; return null; }
  function poolFor(lv) {
    if (lv === 'fejl') { var m = misses(); return DATA.filter(function (x) { return m[x.k] > 0; }); }
    return DATA.filter(function (x) { return x.l <= lv; });
  }
  // Arter man tager fejl af huskes i browseren og kommer oftere igen
  function misses() { return load().fejl || {}; }
  function noteMiss(k, wrong) {
    var st = load(); var m = st.fejl || {};
    if (wrong) m[k] = Math.min(5, (m[k] || 0) + 2); else if (m[k]) { m[k]--; if (m[k] <= 0) delete m[k]; }
    st.fejl = m; save(st);
  }
  function weightedPick(list, n) {
    var m = misses();
    var w = list.map(function (x) { return { x: x, r: Math.pow(Math.random(), 1 / (1 + 2 * (m[x.k] || 0))) }; });
    w.sort(function (a, b) { return b.r - a.r; });
    return w.slice(0, n).map(function (o) { return o.x; });
  }
  function distractors(ans, pool, k, lv, needSnd) {
    var others = pool.filter(function (x) { return x.k !== ans.k && (!needSnd || x.snd); });
    var out = [];
    var add = function (list, max) { shuffle(list).forEach(function (x) { if (out.length < max && out.indexOf(x) < 0) out.push(x); }); };
    if (lv >= 3) {
      add(others.filter(function (x) { return x.g === ans.g; }), k);
      add(others.filter(function (x) { return x.f === ans.f; }), k);
    } else if (lv === 2) {
      add(others.filter(function (x) { return x.f === ans.f; }), 1);
    }
    add(others, k);
    return out;
  }
  function photoOf(sp, lv) {
    var ok = sp.p.filter(function (p) { return lv >= 3 || !p.j; });
    return pick(ok.length ? ok : sp.p);
  }

  function build(c) {
    var lvn = c.lv === 'fejl' ? 3 : c.lv;
    var pool = poolFor(c.lv);
    var dpool = c.lv === 'fejl' ? poolFor(3) : pool;
    var withSnd = pool.filter(function (x) { return x.snd; });
    var src = c.type === 'lyd' ? withSnd : pool;
    var chosen = c.lv === 'fejl' ? shuffle(src).slice(0, c.n) : weightedPick(src, c.n);
    var k = lvn >= 3 ? 5 : 3;
    return chosen.map(function (sp) {
      var t = c.type;
      if (t === 'blandet') t = pick(sp.snd ? ['foto', 'lyd', 'navn'] : ['foto', 'navn']);
      var q = { sp: sp, t: t, write: c.write && t !== 'navn' };
      if (t === 'foto') q.photo = photoOf(sp, lvn);
      if (!q.write) q.opts = shuffle([sp].concat(distractors(sp, dpool, k, lvn, false)));
      if (t === 'navn') q.photos = q.opts.map(function (o) { return photoOf(o, lvn); });
      return q;
    });
  }

  // ---- Skriv navnet: tål små stavefejl ----
  function norm(s) { return String(s || '').toLowerCase().normalize('NFC').replace(/[^a-zæøåäöüé]/g, ''); }
  function lev(a, b) {
    var m = a.length, n = b.length, d = [], i, j;
    for (i = 0; i <= m; i++) d[i] = [i];
    for (j = 0; j <= n; j++) d[0][j] = j;
    for (i = 1; i <= m; i++) for (j = 1; j <= n; j++) { d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1)); if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) d[i][j] = Math.min(d[i][j], d[i - 2][j - 2] + 1); }
    return d[m][n];
  }
  function matches(input, sp) {
    var v = norm(input);
    if (!v) return 0;
    var names = [sp.n].concat(sp.a || [], [sp.sci]).map(norm);
    if (names.indexOf(v) > -1) return 2;
    // Et andet arts navn stavet rigtigt er forkert, også selv om det ligner
    var other = (DATA || []).some(function (x) { return x.k !== sp.k && [x.n].concat(x.a || [], [x.sci]).map(norm).indexOf(v) > -1; });
    if (other) return 0;
    for (var i = 0; i < names.length; i++) {
      var tol = names[i].length >= 10 ? 2 : names[i].length >= 5 ? 1 : 0;
      if (tol && lev(v, names[i]) <= tol) return 1;
    }
    return 0;
  }

  // ---- Visning ----
  function credit(p, showSrc, prefix) {
    var c = el('p', 'source fq-credit');
    c.appendChild(document.createTextNode((prefix || 'Foto: ') + p.c));
    if (showSrc && p.s) { c.appendChild(document.createTextNode(' · ')); var a = el('a', null, 'original'); a.href = p.s; a.target = '_blank'; a.rel = 'noopener'; c.appendChild(a); }
    return c;
  }
  function spLink(sp) {
    var span = el('span');
    var a = el('a', null, sp.n); a.href = sp.u; a.target = '_blank'; a.rel = 'noopener';
    span.appendChild(a); span.appendChild(document.createTextNode(' ')); span.appendChild(el('i', null, sp.sci));
    return span;
  }

  function show() {
    var q = qs[qi]; answered = false;
    $('fq-count').textContent = 'Spørgsmål ' + (qi + 1) + ' af ' + qs.length;
    $('fq-score').textContent = score + ' rigtige';
    $('fq-prog').style.width = (qi / qs.length * 100) + '%';
    $('fq-next').hidden = true;
    var fb = $('fq-feedback'); fb.innerHTML = ''; fb.className = 'fq-feedback';
    var media = $('fq-media'); media.innerHTML = '';
    var ans = $('fq-answer'); ans.innerHTML = '';
    var h = $('fq-q');
    if (q.t === 'foto') {
      h.textContent = 'Hvilken fugl er det?';
      if (q.lydFejl) media.appendChild(el('p', 'fq-note', 'Lyden kunne ikke hentes, så her er et billede i stedet. Fejlen er meldt.'));
      var fr = el('div', 'fq-photo'); var img = el('img'); img.src = q.photo.u; img.alt = 'Fuglen du skal gætte'; fr.appendChild(img);
      media.appendChild(fr); media.appendChild(credit(q.photo, false));
    } else if (q.t === 'lyd') {
      h.textContent = 'Hvilken fugl er det, du hører?';
      var box = el('div', 'fq-sound');
      var pl = el('div', 'player'); pl.setAttribute('data-player', '');
      var pb = el('button', 'play'); pb.type = 'button'; pb.setAttribute('aria-label', 'Afspil lyden');
      pb.innerHTML = '<svg class="i-play" width="20" height="20" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M7 4v16l13-8z"/></svg><svg class="i-pause" width="20" height="20" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M6 4h4v16H6zM14 4h4v16h-4z"/></svg>';
      var tr = el('div', 'track'); tr.setAttribute('aria-hidden', 'true'); tr.appendChild(el('span'));
      pl.appendChild(pb); pl.appendChild(tr); pl.appendChild(el('span', 'time', '0:00'));
      var au = el('audio'); au.controls = true; au.preload = 'none'; au.src = q.sp.snd.u;
      box.appendChild(pl); box.appendChild(au); media.appendChild(box);
      if (window.dfPlayer) window.dfPlayer(pl);
      media.appendChild(credit(q.sp.snd, false, 'Lyd: '));
      setTimeout(function () { var p = au.play(); if (p && p.catch) p.catch(function () {}); }, 50);
      // Kan lyden ikke hentes, skiftes spørgsmålet til et billede af samme fugl, og fejlen meldes automatisk
      var failed = false;
      var fail = function () {
        if (failed || answered || qs[qi] !== q) return; failed = true;
        sendFb({ kind: 'Lyden kunne ikke afspilles (automatisk)', art: q.sp.n + ' (' + q.sp.k + ')', medie: q.sp.snd.u });
        q.t = 'foto'; q.photo = photoOf(q.sp, cfg.lv === 'fejl' ? 3 : cfg.lv); q.lydFejl = true; show();
      };
      au.addEventListener('error', fail);
      setTimeout(function () { if (au.readyState < 1 && au.networkState !== 1) fail(); else if (au.readyState < 1) setTimeout(function () { if (au.readyState < 1) fail(); }, 7000); }, 8000);
    } else {
      h.textContent = 'Hvilket billede viser ' + q.sp.n.toLowerCase() + '?';
    }

    if (q.t === 'navn') {
      var grid = el('div', 'fq-grid n' + q.opts.length);
      q.opts.forEach(function (o, i) {
        var b = el('button', 'fq-imgopt'); b.type = 'button';
        var im = el('img'); im.src = q.photos[i].u; im.alt = 'Svarmulighed ' + (i + 1); im.loading = 'lazy';
        b.appendChild(im);
        var cap = el('span', 'fq-imgcap', q.photos[i].c.replace(/ · vist som udsnit$/, ''));
        b.appendChild(cap);
        b.addEventListener('click', function () { choose(o, b, grid); });
        b.dataset.k = o.k;
        grid.appendChild(b);
      });
      ans.appendChild(grid);
      ans.appendChild(el('p', 'source', 'Fotos fra iNaturalist, vist som udsnit.'));
    } else if (q.write) {
      var f = el('form', 'fq-write');
      var inp = el('input'); inp.type = 'text'; inp.autocomplete = 'off'; inp.autocapitalize = 'off'; inp.spellcheck = false; inp.placeholder = 'Skriv fuglens navn'; inp.setAttribute('aria-label', 'Fuglens navn');
      var sb = el('button', 'btn primary', 'Svar'); sb.type = 'submit';
      var dk = el('button', 'btn', 'Ved ikke'); dk.type = 'button';
      f.appendChild(inp); f.appendChild(sb); f.appendChild(dk);
      f.addEventListener('submit', function (e) { e.preventDefault(); if (inp.value.trim()) typed(inp.value, f); });
      dk.addEventListener('click', function () { typed('', f); });
      ans.appendChild(f);
      if (q.t !== 'lyd') setTimeout(function () { inp.focus(); }, 30);
    } else {
      var wrap = el('div', 'fq-opts n' + q.opts.length);
      q.opts.forEach(function (o) {
        var b = el('button', 'fq-opt', o.n); b.type = 'button'; b.dataset.k = o.k;
        b.addEventListener('click', function () { choose(o, b, wrap); });
        wrap.appendChild(b);
      });
      ans.appendChild(wrap);
    }
    root.scrollIntoView({ block: 'start', behavior: 'smooth' });
  }

  // ---- Feedback direkte fra quizzen (gemmes og sendes til Dagens Fugl) ----
  var FB = root.getAttribute('data-fb');
  function sendFb(o) {
    if (!FB) return Promise.resolve();
    var body = new URLSearchParams({ a: 'feedback', t: String(Date.now() - (window.__fqT || 0)), kind: o.kind || '', art: o.art || '', medie: o.medie || '', besked: o.besked || '', side: location.pathname, website: '' });
    return fetch(FB, { method: 'POST', body: body, mode: 'no-cors' }).catch(function () {});
  }
  function fbBox(q) {
    var wrap = el('div', 'fq-fb');
    var open = el('button', 'fq-fb-open', 'Noget galt med spørgsmålet? Giv feedback'); open.type = 'button';
    wrap.appendChild(open);
    open.addEventListener('click', function () {
      open.remove();
      var f = el('form', 'fq-fb-form');
      var kinds = q.t === 'lyd' ? ['Lyden virker ikke', 'Der er ingen fuglestemme at høre', 'Det er ikke den art', 'Andet']
        : q.t === 'navn' ? ['Et af billederne er dårligt', 'Et billede viser ikke den art', 'Andet']
        : ['Dårligt billede (fx æg, fjer eller ingen fugl)', 'Billedet viser ikke den art', 'Andet'];
      var ch = el('div', 'fq-fb-kinds');
      kinds.forEach(function (k, i) {
        var l = el('label'); var r = el('input'); r.type = 'radio'; r.name = 'kind'; r.value = k; if (!i) r.checked = true;
        l.appendChild(r); l.appendChild(document.createTextNode(' ' + k)); ch.appendChild(l);
      });
      f.appendChild(ch);
      var t = el('input'); t.type = 'text'; t.name = 'besked'; t.maxLength = 500; t.placeholder = 'Uddyb gerne (valgfrit)'; t.setAttribute('aria-label', 'Uddybning');
      f.appendChild(t);
      var b = el('button', 'btn', 'Send'); b.type = 'submit'; f.appendChild(b);
      f.addEventListener('submit', function (e) {
        e.preventDefault(); b.disabled = true;
        var medie = q.t === 'lyd' ? q.sp.snd.u : q.t === 'foto' ? 'foto ' + q.photo.i : q.opts.map(function (o, i) { return o.n + ': foto ' + q.photos[i].i; }).join('; ');
        sendFb({ kind: f.kind.value, art: q.sp.n + ' (' + q.sp.k + ')', medie: medie, besked: t.value.trim() }).then(function () {
          f.replaceWith(el('p', 'fq-fb-tak', 'Tak! Din feedback er sendt.'));
        });
      });
      wrap.appendChild(f);
      t.focus({ preventScroll: true });
    });
    return wrap;
  }

  // Efter svaret: artens kendetegn og – hvis der findes en sammenligning – hvordan den kendes fra den anden art
  function pairOf(a, b) { for (var i = 0; i < PAIRS.length; i++) { var p = PAIRS[i]; if ((p.a === a && p.b === b) || (p.a === b && p.b === a)) return p; } return null; }
  function learn(q, ok, picked) {
    var sp = q.sp;
    var box = el('div', 'fq-learn');
    var lyd = q.t === 'lyd';
    var main = lyd ? (sp.st || sp.kt) : (sp.kt || sp.st);
    if (main) { var p1 = el('p'); p1.appendChild(el('b', null, (lyd && sp.st ? 'Stemme: ' : 'Kendetegn: '))); p1.appendChild(document.createTextNode(main)); box.appendChild(p1); }
    var other = picked && picked.k !== sp.k ? picked : null;
    var pair = other ? pairOf(sp.k, other.k) : null;
    if (!pair && q.opts) for (var i = 0; i < q.opts.length && !pair; i++) if (q.opts[i].k !== sp.k && pairOf(sp.k, q.opts[i].k)) { other = q.opts[i]; pair = pairOf(sp.k, other.k); }
    if (pair) {
      var part = (lyd && pair.lyd) || pair.se || pair.lyd;
      var flip = pair.a !== sp.k;
      var h = el('p'); h.appendChild(el('b', null, 'Sådan kender du ' + sp.n.toLowerCase() + ' fra ' + other.n.toLowerCase() + ':'));
      box.appendChild(h);
      if (part.intro) box.appendChild(el('p', null, part.intro));
      if (part.rows && part.rows.length) {
        var tb = el('table', 'fq-cmp'); var hr = el('tr');
        ['', sp.n, other.n].forEach(function (t) { hr.appendChild(el('th', null, t)); }); tb.appendChild(hr);
        part.rows.forEach(function (r) { var tr = el('tr'); [r[0], flip ? r[2] : r[1], flip ? r[1] : r[2]].forEach(function (t, j) { tr.appendChild(el(j ? 'td' : 'th', null, t)); }); tb.appendChild(tr); });
        box.appendChild(tb);
      }
      var a = el('a', null, 'Se og hør dem side om side'); a.href = pair.u; a.target = '_blank'; a.rel = 'noopener';
      var pa = el('p'); pa.appendChild(a); box.appendChild(pa);
    } else {
      // Artens egen tekst om forveksling: den valgte art først, ellers en af de andre svarmuligheder
      var fvOf = function (o) { return (sp.fv || []).filter(function (f) { return f.art === o.k; })[0]; };
      var cand = (picked && picked.k !== sp.k ? [picked] : []).concat((q.opts || []).filter(function (o) { return o.k !== sp.k; }));
      for (var j = 0; j < cand.length; j++) {
        var f = fvOf(cand[j]);
        if (f) { var pf = el('p'); pf.appendChild(el('b', null, 'Forskel fra ' + cand[j].n.toLowerCase() + ': ')); pf.appendChild(document.createTextNode(f.tekst)); box.appendChild(pf); break; }
      }
    }
    return box.childNodes.length ? box : null;
  }

  function reveal(ok, text, picked) {
    var q = qs[qi];
    answered = true;
    if (ok) score++; else wrongs.push(q);
    noteMiss(q.sp.k, !ok);
    var fb = $('fq-feedback');
    fb.className = 'fq-feedback ' + (ok ? 'ok' : 'bad');
    var p = el('p');
    p.appendChild(el('b', null, ok ? (text || 'Rigtigt! ') : 'Ikke helt. '));
    p.appendChild(document.createTextNode(ok ? 'Det er ' : 'Det var '));
    p.appendChild(spLink(q.sp));
    p.appendChild(document.createTextNode('.'));
    fb.appendChild(p);
    var info = learn(q, ok, picked);
    if (info) fb.appendChild(info);
    fb.appendChild(fbBox(q));
    var media = $('fq-media');
    var cr = media.querySelector('.fq-credit');
    if (cr) cr.replaceWith(q.t === 'lyd' ? credit(q.sp.snd, true, 'Lyd: ') : credit(q.photo, true));
    $('fq-score').textContent = score + ' rigtige';
    var nx = $('fq-next'); nx.hidden = false; nx.textContent = qi + 1 < qs.length ? 'Næste' : 'Se resultat'; nx.focus({ preventScroll: true });
  }
  function choose(o, btn, wrap) {
    if (answered) return;
    var q = qs[qi]; var ok = o.k === q.sp.k;
    [].forEach.call(wrap.children, function (b) {
      b.disabled = true;
      if (b.dataset.k === q.sp.k) b.classList.add('right');
      if (b.classList.contains('fq-imgopt')) {
        var sp = byKey(b.dataset.k);
        var lab = el('span', 'fq-imgname');
        lab.appendChild(el('b', null, sp.n)); lab.appendChild(el('i', null, ' ' + sp.sci));
        b.insertBefore(lab, b.querySelector('.fq-imgcap'));
        b.title = sp.n;
      }
    });
    if (!ok) btn.classList.add('wrong');
    reveal(ok, null, o);
  }
  function typed(v, f) {
    if (answered) return;
    var q = qs[qi]; var m = matches(v, q.sp);
    [].forEach.call(f.elements, function (x) { x.disabled = true; });
    f.classList.add(m ? 'right' : 'wrong');
    var nv = norm(v); var other = nv ? DATA.filter(function (x) { return x.k !== q.sp.k && [x.n].concat(x.a || [], [x.sci]).map(norm).indexOf(nv) > -1; })[0] : null;
    reveal(!!m, m === 1 ? 'Rigtigt (lidt stavet anderledes)! ' : null, other);
  }
  $('fq-next').addEventListener('click', function () { if (++qi < qs.length) show(); else finish(); });

  function finish() {
    play.hidden = true; end.hidden = false; end.innerHTML = '';
    var store = load(); var key = cfgKey(cfg); var prev = store[key] || 0;
    if (score > prev) { store[key] = score; save(store); }
    end.appendChild(el('p', 'kicker', 'Fuglequiz · ' + LVN[cfg.lv] + ' · ' + TYN[cfg.type]));
    end.appendChild(el('h2', 'fq-result', score + ' af ' + qs.length + ' rigtige'));
    var pct = score / qs.length;
    var msg = pct === 1 ? 'Alle rigtige – flot!' : pct >= 0.8 ? 'Rigtig godt gået.' : pct >= 0.5 ? 'Godt gået. Prøv igen og se, om du kan slå det.' : 'Øvelse gør mester – prøv en gang til.';
    if (score > prev && prev) msg += ' Nyt bedste resultat (før ' + prev + ').';
    end.appendChild(el('p', 'lede', msg));
    if (wrongs.length) {
      end.appendChild(el('h3', null, wrongs.length === 1 ? 'Den du ikke fik' : 'Dem du ikke fik'));
      var ul = el('ul', 'fq-wrongs');
      wrongs.forEach(function (q) {
        var li = el('li'); var a = el('a'); a.href = q.sp.u;
        var im = el('img'); im.src = (q.photo || q.sp.p[0]).u.replace('/medium.', '/small.'); im.alt = ''; im.loading = 'lazy'; im.width = 56; im.height = 56;
        a.appendChild(im); var t = el('span'); t.appendChild(el('strong', null, q.sp.n)); t.appendChild(el('i', null, q.sp.sci)); a.appendChild(t);
        li.appendChild(a); ul.appendChild(li);
      });
      end.appendChild(ul);
    }
    var bar = el('p', 'fq-endbtns');
    var again = el('button', 'btn primary', 'Prøv igen'); again.type = 'button'; again.addEventListener('click', function () { start(cfg); });
    var nw = el('button', 'btn', 'Vælg en anden quiz'); nw.type = 'button'; nw.addEventListener('click', function () { end.hidden = true; setup.hidden = false; syncForm(); root.scrollIntoView({ block: 'start' }); });
    var share = el('button', 'btn', 'Del resultatet'); share.type = 'button';
    share.addEventListener('click', function () {
      var txt = 'Jeg fik ' + score + ' af ' + qs.length + ' rigtige i Fuglequizzen (' + LVN[cfg.lv] + ', ' + TYN[cfg.type].toLowerCase() + '). Kan du slå det?';
      var u = location.origin + location.pathname + '?ref=del';
      if (navigator.share) navigator.share({ title: 'Fuglequiz – Dagens Fugl', text: txt, url: u }).catch(function () {});
      else if (navigator.clipboard) navigator.clipboard.writeText(txt + ' ' + u).then(function () { share.textContent = 'Kopieret – sæt ind hvor du vil'; });
    });
    bar.appendChild(again); bar.appendChild(share); bar.appendChild(nw); end.appendChild(bar);
    root.scrollIntoView({ block: 'start', behavior: 'smooth' });
  }

  function start(c) {
    window.__fqT = Date.now();
    cfg = c; qs = build(c); qi = 0; score = 0; wrongs = [];
    if (!qs.length) { bestEl.textContent = 'Der er ingen spørgsmål med disse valg.'; return; }
    setup.hidden = true; end.hidden = true; play.hidden = false;
    show();
  }
  form.addEventListener('submit', function (e) {
    e.preventDefault();
    var c = readForm();
    var btn = form.querySelector('.fq-start'); btn.disabled = true;
    (DATA ? Promise.resolve(DATA) : fetch(BASE + '/fuglequiz.json').then(function (r) { return r.json(); }))
      .then(function (d) { DATA = d.arter || d; PAIRS = d.par || []; btn.disabled = false; start(c); })
      .catch(function () { btn.disabled = false; bestEl.textContent = 'Quizzen kunne ikke hentes. Prøv igen om lidt.'; });
  });
})();
