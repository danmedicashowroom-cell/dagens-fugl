(function () {
  var BASE = window.DF_BASE || '';

  // ---- Tilfældig fugl ----
  document.querySelectorAll('[data-random]').forEach(function (a) {
    a.addEventListener('click', function (e) {
      e.preventDefault();
      fetch(BASE + '/fugle.json').then(function (r) { return r.json(); }).then(function (list) {
        var here = location.pathname;
        var pick = here;
        for (var i = 0; i < 5 && pick === here; i++) pick = list[Math.floor(Math.random() * list.length)];
        location.href = pick;
      }).catch(function () { location.href = a.href; });
    });
  });

  // ---- Klik på billede: vis stort ----
  var lb = document.querySelector('dialog.lightbox');
  if (lb && lb.showModal) {
    var lbImg = lb.querySelector('img');
    var lbCap = lb.querySelector('.lb-caption');
    document.addEventListener('click', function (e) {
      var img = e.target.closest && e.target.closest('.species figure img');
      if (!img) return;
      var big = img.currentSrc || img.src;
      big = big.replace(/\/(small|medium|large)\.(jpe?g|png)/i, '/original.$2');
      lbImg.src = big;
      lbImg.alt = img.alt;
      var cap = img.closest('figure').querySelector('figcaption');
      lbCap.innerHTML = cap ? cap.innerHTML : '';
      lb.showModal();
    });
    lb.addEventListener('click', function (e) { if (e.target === lb || e.target.classList.contains('lb-close') || e.target === lbImg) lb.close(); });
    lb.addEventListener('close', function () { lbImg.removeAttribute('src'); });
  }

  // ---- Jeg har set den (gemmes kun i browseren) ----
  // Format: { art: { d: 'ÅÅÅÅ-MM-DD', p: 'sted' } } – ældre versioner gemte bare datoen som tekst.
  var KEY = 'dagensfugl-set';
  function loadSeen() {
    try {
      var o = JSON.parse(localStorage.getItem(KEY) || '{}') || {};
      Object.keys(o).forEach(function (k) { if (typeof o[k] === 'string') o[k] = { d: o[k], p: '' }; });
      return o;
    } catch (e) { return null; }
  }
  function saveSeen(o) { try { localStorage.setItem(KEY, JSON.stringify(o)); return true; } catch (e) { return false; } }
  function todayIso() { return new Intl.DateTimeFormat('sv-SE', { timeZone: 'Europe/Copenhagen' }).format(new Date()); }
  function fmtDate(iso) { return new Date(iso + 'T12:00:00').toLocaleDateString('da-DK', { day: 'numeric', month: 'short', year: 'numeric' }); }
  var seen = loadSeen();
  if (seen) {
    var arterP = null;
    function arter() { return arterP || (arterP = fetch(BASE + '/arter.json').then(function (r) { return r.json(); })); }

    document.querySelectorAll('.card[data-key]').forEach(function (c) { if (seen[c.dataset.key]) c.classList.add('seen'); });

    document.querySelectorAll('article.species[data-key]').forEach(function (art) {
      var box = art.querySelector('.seen-box');
      if (!box) return;
      var btn = box.querySelector('.seen-btn');
      var label = box.querySelector('.seen-label');
      var count = box.querySelector('.seen-count');
      var form = box.querySelector('.seen-note');
      var key = art.dataset.key;
      function render() {
        var e = seen[key];
        btn.setAttribute('aria-pressed', String(!!e));
        box.classList.toggle('on', !!e);
        label.textContent = e ? 'Set ' + fmtDate(e.d) + (e.p ? ' · ' + e.p : '') : 'Jeg har set den';
        btn.title = e ? 'Klik for at fjerne den fra Mine fugle' : '';
        if (form) {
          form.hidden = !e;
          if (e) { form.sted.value = e.p || ''; form.dato.value = e.d; }
        }
        var n = Object.keys(seen).length;
        if (!n) { count.textContent = 'Saml dine egne fugle i Mine fugle →'; return; }
        arter().then(function (list) {
          var dk = list.filter(function (a) { return a.r === 'dk'; });
          var dkSeen = dk.filter(function (a) { return seen[a.k]; }).length;
          count.textContent = 'Du har set ' + dkSeen + ' af ' + dk.length + ' danske fugle' + (n > dkSeen ? ' (+' + (n - dkSeen) + ' udenlandske)' : '') + ' →';
        }).catch(function () { count.textContent = 'Du har set ' + n + ' fugle →'; });
      }
      btn.addEventListener('click', function () {
        if (seen[key]) {
          if (seen[key].p && !window.confirm('Fjern ' + (art.querySelector('h1, h2') || {}).textContent + ' fra Mine fugle?')) return;
          delete seen[key];
        } else {
          seen[key] = { d: todayIso(), p: '' };
        }
        saveSeen(seen); render();
        if (seen[key] && form) form.sted.focus();
      });
      if (form) form.addEventListener('submit', function (ev) {
        ev.preventDefault();
        if (!seen[key]) return;
        seen[key] = { d: form.dato.value || seen[key].d, p: form.sted.value.trim().slice(0, 80) };
        saveSeen(seen); render();
        var ok = form.querySelector('.seen-saved'); ok.textContent = 'Gemt ✓'; setTimeout(function () { ok.textContent = ''; }, 2000);
      });
      box.hidden = false;
      render();
    });

    var mine = document.getElementById('mine-list');
    if (mine) {
      arter().then(function (list) {
        var mineList = list.filter(function (a) { return seen[a.k]; })
          .sort(function (a, b) { return seen[b.k].d < seen[a.k].d ? -1 : seen[b.k].d > seen[a.k].d ? 1 : 0; });
        var status = document.getElementById('mine-status');
        var dk = list.filter(function (a) { return a.r === 'dk'; });
        var dkSeen = dk.filter(function (a) { return seen[a.k]; }).length;
        if (!mineList.length) {
          status.textContent = 'Du har ikke markeret nogen fugle endnu. Tryk »Jeg har set den« på en fugleside, så kommer den her – og du kan skrive, hvor du så den. Listen gemmes kun i din egen browser.';
          return;
        }
        status.textContent = 'Du har set ' + mineList.length + (mineList.length === 1 ? ' fugl' : ' fugle') + ' – ' + dkSeen + ' af ' + dk.length + ' danske. Listen gemmes kun i din egen browser.';
        var bar = document.getElementById('mine-progress');
        if (bar) { bar.hidden = false; bar.querySelector('span').style.width = Math.round(100 * dkSeen / dk.length) + '%'; }
        mineList.forEach(function (a) {
          var e = seen[a.k];
          var li = document.createElement('li'); li.className = 'card seen';
          var link = document.createElement('a'); link.href = a.u;
          if (a.t) { var im = document.createElement('img'); im.src = a.t; im.alt = ''; im.loading = 'lazy'; link.appendChild(im); }
          var tx = document.createElement('span'); tx.className = 'card-text';
          var lab = document.createElement('span'); lab.className = 'card-label'; lab.textContent = fmtDate(e.d);
          var nm = document.createElement('span'); nm.className = 'card-name'; nm.textContent = a.n;
          tx.appendChild(lab); tx.appendChild(nm);
          if (e.p) { var pl = document.createElement('span'); pl.className = 'card-place'; pl.textContent = '📍 ' + e.p; tx.appendChild(pl); }
          else { var sc = document.createElement('i'); sc.textContent = a.s; tx.appendChild(sc); }
          link.appendChild(tx); li.appendChild(link); mine.appendChild(li);
        });
      });
    }
  }

  // ---- Seneste fund i Danmark (live fra iNaturalist) ----
  // ---- Seneste fund i Danmark: DOFbasen (via GBIF, ca. 3 ugers forsinkelse) + iNaturalist (nyeste) ----
  document.querySelectorAll('[data-latest]').forEach(function (sec) {
    var name = sec.getAttribute('data-latest');
    var list = sec.querySelector('.latest');
    var DOF = 'https://api.gbif.org/v1/occurrence/search?datasetKey=95db4db8-f762-11e1-a439-00145eb45e9a&limit=300&scientificName=' + encodeURIComponent(name);
    var INAT = 'https://api.inaturalist.org/v1/observations?taxon_name=' + encodeURIComponent(name) +
      '&swlat=54.5&swlng=8&nelat=57.8&nelng=15.2&order_by=observed_on&order=desc&per_page=30&verifiable=true&locale=da';
    var DAY = 864e5;
    var iso = function (t) { return new Date(t).toISOString().slice(0, 10); };
    var getj = function (u) { return fetch(u).then(function (r) { return r.json(); }); };
    // Find de nyeste fund: smalt tidsvindue først; er der for mange fund, halveres vinduet mod det seneste.
    var grab = function (from, to) {
      return getj(DOF + '&eventDate=' + iso(from) + ',' + iso(to)).then(function (j) {
        var res = j.results || [];
        if (j.count <= 300 || to - from <= DAY) return res;
        var mid = from + Math.floor((to - from) / 2 / DAY) * DAY;
        return grab(mid, to).then(function (later) { return later.length >= 8 ? later : later.concat(res); });
      });
    };
    var dof = function () {
      var now = Date.now(), spans = [45, 120, 365, 1095, 3650], i = 0;
      var next = function () {
        if (i >= spans.length) return Promise.resolve([]);
        var from = now - spans[i++] * DAY;
        return getj(DOF + '&limit=0&eventDate=' + iso(from) + ',' + iso(now)).then(function (j) {
          return j.count > 0 ? grab(from, now) : next();
        });
      };
      return next().then(function (res) {
        return res.filter(function (r) { return r.eventDate && r.locality; }).map(function (r) {
          var k = r.gadm && r.gadm.level2 && r.gadm.level2.name;
          return { d: r.eventDate.slice(0, 10), place: r.locality + (k && k !== r.locality ? ' (' + k + ')' : ''), n: r.individualCount, src: 'DOFbasen', url: 'https://www.gbif.org/occurrence/' + r.key, lat: r.decimalLatitude, lon: r.decimalLongitude };
        });
      });
    };
    var inat = function () {
      return getj(INAT).then(function (d) {
        return (d.results || []).filter(function (o) { return o.observed_on && /denmark|danmark|\bdk\b/i.test(o.place_guess || ''); })
          .map(function (o) { var c = o.geojson && o.geojson.coordinates; return { d: o.observed_on, place: String(o.place_guess || '').replace(/,?\s*(Denmark|Danmark|DK)\s*$/i, ''), n: null, src: 'iNaturalist', url: o.uri, lat: c && !o.obscured ? c[1] : null, lon: c && !o.obscured ? c[0] : null }; });
      });
    };
    var load = function () {
      inat().catch(function () { return []; }).then(function (all) {
        var seen = {};
        var rows = all.filter(function (x) {
          var k = x.d + '|' + x.place; if (seen[k]) return false; seen[k] = 1; return true;
        }).slice(0, 10);
        if (!rows.length) return;
        rows.forEach(function (o) {
          var li = document.createElement('li');
          var a = document.createElement('a'); a.href = o.url; a.target = '_blank'; a.rel = 'noopener';
          var dt = document.createElement('strong');
          dt.textContent = new Date(o.d + 'T12:00:00').toLocaleDateString('da-DK', { day: 'numeric', month: 'short', year: 'numeric' });
          var pl = document.createElement('span'); pl.textContent = o.place + (o.n ? ' · ' + o.n + (o.n === 1 ? ' fugl' : ' fugle') : '');
          var sr = document.createElement('em'); sr.textContent = o.src;
          a.appendChild(dt); a.appendChild(pl); a.appendChild(sr); li.appendChild(a); list.appendChild(li);
        });
        sec.hidden = false;
        var pts = rows.filter(function (o) { return o.lat != null && o.lon != null; }).map(function (o) {
          return { lat: o.lat, lon: o.lon, label: new Date(o.d + 'T12:00:00').toLocaleDateString('da-DK', { day: 'numeric', month: 'short' }) + ' · ' + o.place };
        });
        window.DF_FUND = pts;
        document.dispatchEvent(new CustomEvent('df:fund', { detail: pts }));
      });
    };
    (window.requestIdleCallback || function (f) { setTimeout(f, 800); })(load);
  });

  // ---- Tilmelding til morgenmail ----
  document.querySelectorAll('.signup-form').forEach(function (f) {
    var msg = f.parentNode.querySelector('.signup-msg');
    var t0 = Date.now(); // robotter udfylder formularen på under et par sekunder
    f.addEventListener('submit', function (ev) {
      ev.preventDefault();
      if (f.website.value) return;
      var btn = f.querySelector('button'); btn.disabled = true;
      var body = new URLSearchParams({ email: f.email.value, website: f.website.value, t: String(Date.now() - t0) });
      fetch(f.dataset.url, { method: 'POST', mode: 'no-cors', body: body }).then(function () {
        msg.textContent = 'Tak! Tjek din indbakke (og evt. spam) og bekræft tilmeldingen via linket i mailen.';
        f.reset();
      }).catch(function () {
        msg.textContent = 'Det gik desværre ikke. Prøv igen om lidt.';
      }).then(function () { btn.disabled = false; });
    });
  });

  // ---- Dagens gætteleg ----
  var QKEY = 'dagensfugl-quiz';
  function qLoad() { try { return JSON.parse(localStorage.getItem(QKEY) || 'null') || { days: {}, streak: 0, best: 0, lastWin: null }; } catch (e) { return { days: {}, streak: 0, best: 0, lastWin: null }; } }
  function qSave(s) { try { localStorage.setItem(QKEY, JSON.stringify(s)); } catch (e) {} }
  function addDay(iso, n) { var d = new Date(iso + 'T12:00:00Z'); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); }

  var dataEl = document.getElementById('quiz-data');
  var reveal = document.getElementById('reveal');
  if (dataEl) {
    var qd = JSON.parse(dataEl.textContent);
    var answer = atob(qd.a);
    var iso = qd.date;
    var s = qLoad();
    var day = s.days[iso] || (s.days[iso] = { guesses: [], won: false, done: false });
    if (!day.guesses) day.guesses = [];
    var steps = qd.steps;
    var MAX = steps.length;

    var stepsEl = document.getElementById('quiz-steps');
    var listen = document.getElementById('quiz-listen');
    var audio = document.getElementById('quiz-audio');
    var frame = document.getElementById('quiz-frame');
    var img = document.getElementById('quiz-img');
    var hintEl = document.getElementById('quiz-hint');
    var optsEl = document.getElementById('quiz-opts');
    var skip = document.getElementById('quiz-skip');
    var resEl = document.getElementById('quiz-result');
    var statsEl = document.getElementById('quiz-stats');

    if (qd.sound) {
      qd.sound.src.forEach(function (x) { var so = document.createElement('source'); so.src = x.u; if (x.type) so.type = x.type; audio.appendChild(so); });
      var srcs = audio.querySelectorAll('source');
      if (srcs.length) srcs[srcs.length - 1].addEventListener('error', function () {
        var m = document.getElementById('quiz-audio-credit'); m.textContent = 'Lyden kunne desværre ikke afspilles i din browser. Tryk »næste ledetråd« for at se billedet.';
      });
      var cr = document.getElementById('quiz-audio-credit');
      var a = document.createElement('a'); a.href = qd.sound.page; a.target = '_blank'; a.rel = 'noopener'; a.textContent = qd.sound.credit; cr.appendChild(a);
    }
    if (qd.img) { img.src = qd.img; img.style.transformOrigin = qd.fx + '% ' + qd.fy + '%'; }

    function stage() { return day.done ? MAX - 1 : Math.min(day.guesses.length, MAX - 1); }
    function streakNow() { return (s.lastWin === iso || s.lastWin === addDay(iso, -1)) ? s.streak : 0; }
    // 🟩 rigtigt · 🟥 forkert · ⬛ sprunget over · ⬜ ikke brugt
    function mark(i) { var g = day.guesses[i]; return g === undefined ? '⬜' : g === answer ? '🟩' : g === '-' ? '⬛' : '🟥'; }
    function marks() { return steps.map(function (st, i) { return mark(i); }).join(''); }
    var STEPNAME = { lyd: 'Lyd', billede: 'Billede', fakta: 'Fakta' };
    var STEPICON = { lyd: '🔊', billede: '📷', fakta: '💡' };
    function summary() {
      var n = day.guesses.length;
      if (!day.won) return 'Ikke gættet – alle ' + MAX + ' forsøg brugt';
      var t = steps[n - 1].t;
      var how = t === 'lyd' ? ' – kun på lyden' : t === 'billede' ? ' – på billedet' : ' – på fakta';
      return 'Gættet i ' + n + '. forsøg af ' + MAX + how;
    }

    function renderSteps() {
      stepsEl.innerHTML = '';
      var cur = stage();
      steps.forEach(function (st, i) {
        var li = document.createElement('li');
        li.textContent = (i + 1) + '. ' + st.label;
        var g = day.guesses[i];
        if (g === answer) li.className = 'ok';
        else if (g) li.className = 'used';
        else if (i === cur && !day.done) li.className = 'now';
        stepsEl.appendChild(li);
      });
    }
    function renderStage() {
      var cur = stage();
      var hasSound = steps.some(function (st) { return st.t === 'lyd'; });
      listen.hidden = !hasSound;
      // billedet vises fra første billedtrin
      var firstImg = -1, z = null;
      steps.forEach(function (st, i) { if (st.z && firstImg < 0) firstImg = i; });
      for (var i = 0; i <= cur; i++) if (steps[i].z) z = steps[i].z;
      if (day.done) z = 1;
      frame.hidden = !qd.img || z === null;
      if (z !== null) img.style.transform = 'scale(' + z + ')';
      var hintAt = -1; steps.forEach(function (st, i) { if (st.t === 'fakta') hintAt = i; });
      hintEl.hidden = !(day.done || cur >= hintAt);
      hintEl.textContent = '💡 Fakta: ' + qd.hint;
      if (qd.hintSrc) { var hs = document.createElement('small'); hs.className = 'source'; hs.textContent = ' (' + qd.hintSrc + ')'; hintEl.appendChild(hs); }
      var ic = document.getElementById('quiz-img-credit');
      if (ic) { ic.hidden = frame.hidden || !qd.imgCredit; if (qd.imgCredit && !ic.firstChild) { if (qd.imgLic) { var la = document.createElement('a'); la.href = qd.imgLic; la.target = '_blank'; la.rel = 'license noopener'; la.textContent = qd.imgCredit; ic.appendChild(la); } else ic.textContent = qd.imgCredit; } }
      // vis hvilket trin man er på
      var st = steps[cur];
      var lab = document.getElementById('quiz-step-label');
      if (lab) lab.textContent = day.done ? '' : (st.t === 'lyd' ? 'Gæt 1 af ' + MAX + ': Lyt til fuglen – hvem synger?' : st.t === 'billede' ? 'Gæt ' + (cur + 1) + ' af ' + MAX + ': Nu kan du se den. Hvem er det?' : 'Sidste gæt: Her er nogle fakta om fuglen.');
    }
    function renderOpts() {
      optsEl.innerHTML = '';
      qd.opts.forEach(function (o) {
        var b = document.createElement('button'); b.type = 'button'; b.className = 'quiz-opt'; b.textContent = o.n;
        var guessed = day.guesses.indexOf(o.k) !== -1;
        if (guessed) b.classList.add(o.k === answer ? 'right' : 'wrong');
        if (day.done && o.k === answer) b.classList.add('right');
        b.disabled = day.done || guessed;
        b.addEventListener('click', function () { guess(o.k); });
        optsEl.appendChild(b);
      });
      skip.hidden = day.done || day.guesses.length >= MAX - 1;
      skip.textContent = 'Jeg ved det ikke – gå videre';
    }
    function renderStats() {
      var played = 0, won = 0;
      Object.keys(s.days).forEach(function (k) { if (s.days[k].done) { played++; if (s.days[k].won) won++; } });
      var st = streakNow();
      var cells = [['Spillet', played], ['Gættet', played ? Math.round(100 * won / played) + ' %' : '–'], ['Stime', st + (st ? ' 🔥' : '')], ['Bedste stime', s.best || 0]];
      statsEl.innerHTML = '';
      cells.forEach(function (c) {
        var d = document.createElement('div'); d.className = 'stat';
        var b = document.createElement('strong'); b.textContent = c[1];
        var l = document.createElement('span'); l.textContent = c[0];
        d.appendChild(b); d.appendChild(l); statsEl.appendChild(d);
      });
    }
    function countdown() {
      var p = new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/Copenhagen', hour: '2-digit', minute: '2-digit', hour12: false }).format(new Date()).split(':');
      var left = 24 * 60 - (Number(p[0]) * 60 + Number(p[1]));
      return Math.floor(left / 60) + ' t ' + (left % 60) + ' min';
    }
    function iconMarks() { return steps.map(function (st, i) { return STEPICON[st.t] + mark(i); }).join(' '); }
    var ORD = ['første', 'andet', 'tredje'];
    // Billedkort til deling – samme udtryk som det mørke resultatkort
    function makeCard(cb) {
      var c = document.createElement('canvas');
      if (!c.getContext || !c.toBlob) return;
      var W = 1200, H = 630; c.width = W; c.height = H;
      var x = c.getContext('2d');
      var F = '"Inter", system-ui, -apple-system, "Segoe UI", sans-serif';
      var draw = function () {
        var n = day.guesses.length, green = '#5fd39a', fill = '#24996a', red = '#e0735c';
        function rr(px, py, w, h, r) { x.beginPath(); x.moveTo(px + r, py); x.arcTo(px + w, py, px + w, py + h, r); x.arcTo(px + w, py + h, px, py + h, r); x.arcTo(px, py + h, px, py, r); x.arcTo(px, py, px + w, py, r); x.closePath(); }
        x.fillStyle = '#0d0f0e'; x.fillRect(0, 0, W, H);
        rr(40, 40, W - 80, H - 80, 36); x.fillStyle = '#151816'; x.fill(); x.lineWidth = 2; x.strokeStyle = '#262b28'; x.stroke();
        var L = 100;
        x.textBaseline = 'alphabetic';
        x.fillStyle = '#f2f4f3'; x.font = '700 34px ' + F;
        if ('letterSpacing' in x) x.letterSpacing = '2px';
        x.fillText('DAGENS FUGL #' + qd.no, L, 128);
        if ('letterSpacing' in x) x.letterSpacing = '0px';
        // pille øverst til højre
        var pill = day.won ? 'Gættet!' : 'Ikke gættet';
        x.font = '600 28px ' + F; var pw = x.measureText(pill).width + 44;
        rr(W - 100 - pw, 92, pw, 50, 25); x.fillStyle = day.won ? '#16382a' : '#3a2019'; x.fill();
        x.fillStyle = day.won ? green : red; x.fillText(pill, W - 100 - pw + 22, 127);
        // overskrift og undertekst
        x.font = '700 84px ' + F; x.fillStyle = day.won ? green : '#f2f4f3';
        x.fillText(day.won ? n + '. forsøg' : 'Ikke i dag', L, 250);
        x.font = '400 34px ' + F; x.fillStyle = '#b9c0bc';
        x.fillText(day.won ? 'Fandt dagens fugl på ' + (ORD[n - 1] || n + '.') + ' forsøg!' : 'Dagens fugl slap væk – kan du gøre det bedre?', L, 312);
        // forsøgskasser
        var S = 96, G = 22, top = 360;
        steps.forEach(function (st, i) {
          var g = day.guesses[i], px = L + i * (S + G);
          rr(px, top, S, S, 20);
          if (g === answer) { x.fillStyle = fill; x.fill(); }
          else if (g === undefined) { x.fillStyle = '#242826'; x.fill(); }
          else if (g === '-') { x.fillStyle = '#1b1e1c'; x.fill(); x.setLineDash([8, 7]); x.lineWidth = 3; x.strokeStyle = '#4a514d'; x.stroke(); x.setLineDash([]); }
          else { x.fillStyle = '#2e1c17'; x.fill(); x.lineWidth = 3; x.strokeStyle = red; x.stroke(); }
          var cx = px + S / 2, cy = top + S / 2;
          x.lineCap = 'round'; x.lineJoin = 'round'; x.lineWidth = 7;
          if (g === answer) { x.strokeStyle = '#ffffff'; x.beginPath(); x.moveTo(cx - 18, cy + 1); x.lineTo(cx - 5, cy + 14); x.lineTo(cx + 19, cy - 13); x.stroke(); }
          else if (g === '-') { x.strokeStyle = '#7c847f'; x.beginPath(); x.moveTo(cx - 14, cy); x.lineTo(cx + 14, cy); x.stroke(); }
          else if (g !== undefined) { x.strokeStyle = red; x.beginPath(); x.moveTo(cx - 14, cy - 14); x.lineTo(cx + 14, cy + 14); x.moveTo(cx + 14, cy - 14); x.lineTo(cx - 14, cy + 14); x.stroke(); }
          else { x.fillStyle = '#9aa29e'; x.font = '600 38px ' + F; x.textAlign = 'center'; x.fillText(String(i + 1), cx, cy + 13); x.textAlign = 'left'; }
        });
        // bund
        x.fillStyle = '#262b28'; x.fillRect(L, 500, W - 2 * L, 2);
        x.font = '400 30px ' + F; x.fillStyle = '#b9c0bc'; x.fillText('Ny fugl hver dag', L, 556);
        x.font = '700 36px ' + F; x.fillStyle = '#f2f4f3'; x.textAlign = 'right'; x.fillText('dagensfugl.dk', W - L, 558); x.textAlign = 'left';
        c.toBlob(function (b) { if (b) cb(new File([b], 'dagens-fugl-' + qd.no + '.png', { type: 'image/png' })); }, 'image/png');
      };
      if (document.fonts && document.fonts.load) Promise.all([document.fonts.load('700 34px Inter'), document.fonts.load('400 34px Inter')]).then(draw, draw);
      else draw();
    }
    function renderResult() {
      if (!day.done) { resEl.hidden = true; return; }
      resEl.hidden = false; resEl.innerHTML = '';
      var n = day.guesses.length;
      var h = document.createElement('p'); h.className = 'big';
      h.textContent = day.won ? (n === 1 ? 'Wow – i første forsøg! ' : 'Rigtigt! ') + 'Dagens fugl er ' + qd.name.toLowerCase() + '.' : 'Ikke i dag – dagens fugl er ' + qd.name.toLowerCase() + '.';
      var line = document.createElement('div'); line.className = 'quiz-tries';
      var sum = document.createElement('p'); sum.className = 'quiz-tries-sum'; sum.textContent = summary() + '.';
      var row0 = document.createElement('ol'); row0.className = 'quiz-tries-row';
      steps.forEach(function (st, i) {
        var g = day.guesses[i];
        var li = document.createElement('li');
        li.className = g === undefined ? 'unused' : g === answer ? 'ok' : g === '-' ? 'skip' : 'bad';
        var state = g === undefined ? 'ikke brugt' : g === answer ? 'rigtigt' : g === '-' ? 'sprunget over' : 'forkert';
        li.setAttribute('aria-label', 'Forsøg ' + (i + 1) + ', ' + STEPNAME[st.t] + ': ' + state);
        var sq = document.createElement('span'); sq.className = 'sq'; sq.setAttribute('aria-hidden', 'true');
        sq.textContent = g === answer ? '✓' : g === '-' ? '–' : g === undefined ? '' : '✕';
        var lb = document.createElement('span'); lb.className = 'lbl'; lb.setAttribute('aria-hidden', 'true');
        lb.textContent = STEPICON[st.t] + ' ' + STEPNAME[st.t];
        li.appendChild(sq); li.appendChild(lb); row0.appendChild(li);
      });
      line.appendChild(row0); line.appendChild(sum);
      var row = document.createElement('div'); row.className = 'more';
      var share = document.createElement('button'); share.type = 'button'; share.className = 'button'; share.textContent = 'Del resultat';
      var shareFile = null;
      makeCard(function (f) { shareFile = f; });
      share.addEventListener('click', function () {
        var url = location.origin + BASE + '/';
        var short = 'Dagens Fugl #' + qd.no + ' – ' + (day.won ? 'gættet i ' + n + '. forsøg' + (n === 1 ? ' 🎉' : '') : 'ikke gættet i dag');
        var txt = 'Dagens Fugl #' + qd.no + ' 🪶\n' + (day.won ? 'Gættet i ' + n + '. forsøg' + (n === 1 ? ' 🎉' : '') : 'Ikke gættet i dag') + '\n' + iconMarks() + '\n' + url;
        // 1) Delemenu med billedkort (mobil, Chrome/Edge)
        if (shareFile && navigator.canShare && navigator.canShare({ files: [shareFile] })) {
          navigator.share({ files: [shareFile], text: short + '\n' + url }).catch(function () {});
          return;
        }
        // 2) Delemenu kun med tekst
        if (navigator.share) { navigator.share({ text: txt }).catch(function () {}); return; }
        // 3) Kopiér billede + tekst, ellers kun tekst
        var done = function (msg) { share.textContent = msg; };
        var copyText = function () {
          (navigator.clipboard ? navigator.clipboard.writeText(txt) : Promise.reject()).then(function () { done('Kopieret ✓'); }, function () { window.prompt('Kopiér dit resultat:', txt); });
        };
        if (shareFile && window.ClipboardItem && navigator.clipboard && navigator.clipboard.write) {
          navigator.clipboard.write([new ClipboardItem({ 'image/png': shareFile, 'text/plain': new Blob([txt], { type: 'text/plain' }) })])
            .then(function () { done('Billede kopieret ✓'); }, copyText);
        } else copyText();
      });
      var read = document.createElement('a'); read.className = 'button ghost'; read.href = '#reveal'; read.textContent = 'Læs om ' + qd.name.toLowerCase() + ' ↓';
      row.appendChild(share); row.appendChild(read);
      var next = document.createElement('p'); next.className = 'muted'; next.textContent = 'Ny fugl om ' + countdown() + '.';
      resEl.appendChild(h); resEl.appendChild(line); resEl.appendChild(row); resEl.appendChild(next);
    }
    function render() {
      renderSteps(); renderStage(); renderOpts(); renderResult(); renderStats();
      if (reveal) { if (day.done) reveal.removeAttribute('data-locked'); else reveal.setAttribute('data-locked', ''); }
    }
    function finish(won) {
      day.done = true; day.won = won;
      if (won) { s.streak = (s.lastWin === addDay(iso, -1)) ? s.streak + 1 : 1; s.lastWin = iso; s.best = Math.max(s.best || 0, s.streak); }
      else s.streak = 0;
    }
    function guess(k) {
      if (day.done || day.guesses.indexOf(k) !== -1) return;
      day.guesses.push(k);
      if (k === answer) finish(true);
      else if (day.guesses.length >= MAX) finish(false);
      qSave(s); render();
      if (day.done) document.dispatchEvent(new CustomEvent('df:quizdone', { detail: { won: day.won } }));
    }
    skip.addEventListener('click', function () {
      if (day.done || day.guesses.length >= MAX - 1) return;
      day.guesses.push('-'); qSave(s); render();
    });
    render();
  } else if (reveal) {
    reveal.removeAttribute('data-locked');
  }

  // ---- Kort (GBIF) ----
  var GBIF_BASE = 'https://tile.gbif.org/3857/omt/{z}/{x}/{y}@1x.png?style=gbif-light';
  var GBIF_BASE_DARK = 'https://tile.gbif.org/3857/omt/{z}/{x}/{y}@1x.png?style=gbif-dark';
  var DENSITY = 'https://api.gbif.org/v2/map/occurrence/density/{z}/{x}/{y}@1x.png?srs=EPSG:3857&bin=hex&hexPerTile=';

  function initMap(el) {
    if (el.dataset.ready || !window.L) return;
    el.dataset.ready = '1';
    var dk = el.dataset.map === 'dk';
    var th = document.documentElement.dataset.theme;
    var dark = th ? th === 'moerk' : window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
    var map = L.map(el, { scrollWheelZoom: false, worldCopyJump: !dk, attributionControl: true, minZoom: dk ? 5 : 1 });
    if (dk) map.fitBounds([[54.5, 7.9], [57.8, 15.3]]); else map.setView([25, 10], 1);
    L.tileLayer(dark ? GBIF_BASE_DARK : GBIF_BASE, {
      maxZoom: 12,
      attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>, © OpenMapTiles',
    }).addTo(map);
    L.tileLayer(DENSITY + (dk ? 45 : 70) + '&style=classic-noborder.poly&taxonKey=' + el.dataset.taxon + (dk ? '&country=DK' : ''), {
      maxZoom: 12, opacity: 0.85,
      attribution: 'Fund: <a href="https://www.gbif.org/species/' + el.dataset.taxon + '">GBIF.org</a>',
    }).addTo(map);
    // Prikker for de seneste fund (DOFbasen/iNaturalist), når listen er hentet
    if (dk) {
      var addPts = function (pts) {
        var col = getComputedStyle(document.documentElement).getPropertyValue('--accent').trim() || '#23573f';
        pts.forEach(function (p) {
          L.circleMarker([p.lat, p.lon], { radius: 6, color: '#ffffff', weight: 2, fillColor: col, fillOpacity: 1, className: 'fund-dot' })
            .bindTooltip(p.label).addTo(map);
        });
      };
      if (window.DF_FUND) addPts(window.DF_FUND); else document.addEventListener('df:fund', function (e) { addPts(e.detail); }, { once: true });
    }
  }

  function setupMaps() {
    var maps = document.querySelectorAll('.map[data-taxon]');
    if (!maps.length) return;
    if (!('IntersectionObserver' in window)) { maps.forEach(initMap); return; }
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) { if (en.isIntersecting) { initMap(en.target); io.unobserve(en.target); } });
    }, { rootMargin: '300px' });
    maps.forEach(function (m) { io.observe(m); });
  }
  if (window.L) setupMaps(); else window.addEventListener('load', setupMaps);

  // ---- Søg og filter på oversigten ----
  var q = document.getElementById('q');
  var all = document.getElementById('all');
  if (q && all) {
    var cards = Array.prototype.slice.call(all.querySelectorAll('.card'));
    var buttons = document.querySelectorAll('[data-filter]');
    var count = document.getElementById('count');
    var filter = 'all';
    function norm(s) { return s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, ''); }
    function apply() {
      var term = norm(q.value.trim());
      var shown = 0;
      cards.forEach(function (c) {
        var ok = (filter === 'all' || c.dataset.region === filter) && (!term || norm(c.dataset.name).indexOf(term) !== -1);
        c.hidden = !ok; if (ok) shown++;
      });
      count.textContent = shown === cards.length ? '' : shown + ' af ' + cards.length + ' arter';
    }
    q.addEventListener('input', apply);
    buttons.forEach(function (b) {
      b.addEventListener('click', function () {
        filter = b.dataset.filter;
        buttons.forEach(function (x) { x.setAttribute('aria-pressed', String(x === b)); });
        apply();
      });
    });
  }
})();
