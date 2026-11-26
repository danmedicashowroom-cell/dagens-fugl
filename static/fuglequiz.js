// Fuglequiz med sværhedsgrader. Data: /fuglequiz.json (bygges af src/build.mjs).
(function () {
  var BASE = window.DF_BASE || '';
  var root = document.getElementById('fq');
  if (!root) return;
  var $ = function (id) { return document.getElementById(id); };
  var form = $('fq-form'), setup = $('fq-setup'), play = $('fq-play'), end = $('fq-end');
  var writeBox = $('fq-write'), writeWrap = $('fq-write-wrap'), bestEl = $('fq-best');
  var SKEY = 'dagensfugl-fuglequiz';
  var LVN = { 1: 'Lette', 2: 'Almindelige', 3: 'Svære', 4: 'Ekspert' };
  var TYN = { foto: 'Foto', lyd: 'Lyd', navn: 'Navn', blandet: 'Blandet' };
  var DATA = null, cfg = null, qs = [], qi = 0, score = 0, wrongs = [], answered = false;

  function load() { try { return JSON.parse(localStorage.getItem(SKEY) || '{}') || {}; } catch (e) { return {}; } }
  function save(o) { try { localStorage.setItem(SKEY, JSON.stringify(o)); } catch (e) {} }
  function el(tag, cls, text) { var e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; }
  function shuffle(a) { a = a.slice(); for (var i = a.length - 1; i > 0; i--) { var j = Math.floor(Math.random() * (i + 1)); var t = a[i]; a[i] = a[j]; a[j] = t; } return a; }
  function pick(a) { return a[Math.floor(Math.random() * a.length)]; }
  function cfgKey(c) { return c.lv + '-' + c.type + '-' + c.n + (c.write ? '-w' : ''); }

  function readForm() {
    var f = new FormData(form);
    var c = { lv: Number(f.get('lv')), type: f.get('type'), n: Number(f.get('n')), write: !!writeBox.checked };
    if (c.lv === 4 && c.type !== 'navn') c.write = true;
    if (c.type === 'navn') c.write = false;
    return c;
  }
  function syncForm() {
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
  function poolFor(lv) { return DATA.filter(function (x) { return x.l <= lv; }); }
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
    var pool = poolFor(c.lv);
    var withSnd = pool.filter(function (x) { return x.snd; });
    var src = c.type === 'lyd' ? withSnd : pool;
    var chosen = shuffle(src).slice(0, c.n);
    var k = c.lv >= 3 ? 5 : 3;
    return chosen.map(function (sp) {
      var t = c.type;
      if (t === 'blandet') t = pick(sp.snd ? ['foto', 'lyd', 'navn'] : ['foto', 'navn']);
      var q = { sp: sp, t: t, write: c.write && t !== 'navn' };
      if (t === 'foto') q.photo = photoOf(sp, c.lv);
      if (!q.write) q.opts = shuffle([sp].concat(distractors(sp, pool, k, c.lv, false)));
      if (t === 'navn') q.photos = q.opts.map(function (o) { return photoOf(o, c.lv); });
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
      var fr = el('div', 'fq-photo'); var img = el('img'); img.src = q.photo.u; img.alt = 'Fuglen du skal gætte'; fr.appendChild(img);
      media.appendChild(fr); media.appendChild(credit(q.photo, false));
    } else if (q.t === 'lyd') {
      h.textContent = 'Hvilken fugl er det, du hører?';
      var au = el('audio'); au.controls = true; au.preload = 'none'; au.src = q.sp.snd.u;
      var box = el('div', 'fq-sound'); box.appendChild(au); media.appendChild(box);
      media.appendChild(credit(q.sp.snd, false, 'Lyd: '));
      setTimeout(function () { var p = au.play(); if (p && p.catch) p.catch(function () {}); }, 50);
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

  function reveal(ok, text) {
    var q = qs[qi];
    answered = true;
    if (ok) score++; else wrongs.push(q);
    var fb = $('fq-feedback');
    fb.className = 'fq-feedback ' + (ok ? 'ok' : 'bad');
    var p = el('p');
    p.appendChild(el('b', null, ok ? (text || 'Rigtigt! ') : 'Ikke helt. '));
    p.appendChild(document.createTextNode(ok ? 'Det er ' : 'Det var '));
    p.appendChild(spLink(q.sp));
    p.appendChild(document.createTextNode('.'));
    fb.appendChild(p);
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
    });
    if (!ok) btn.classList.add('wrong');
    reveal(ok);
  }
  function typed(v, f) {
    if (answered) return;
    var q = qs[qi]; var m = matches(v, q.sp);
    [].forEach.call(f.elements, function (x) { x.disabled = true; });
    f.classList.add(m ? 'right' : 'wrong');
    reveal(!!m, m === 1 ? 'Rigtigt (lidt stavet anderledes)! ' : null);
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
    bar.appendChild(again); bar.appendChild(nw); end.appendChild(bar);
    root.scrollIntoView({ block: 'start', behavior: 'smooth' });
  }

  function start(c) {
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
      .then(function (d) { DATA = d; btn.disabled = false; start(c); })
      .catch(function () { btn.disabled = false; bestEl.textContent = 'Quizzen kunne ikke hentes. Prøv igen om lidt.'; });
  });
})();
