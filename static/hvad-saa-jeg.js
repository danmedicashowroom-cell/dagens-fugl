// »Hvad så jeg?« – rangerer danske arter efter sted, størrelse, farver og måned. Data: /hvad-saa-jeg.json
(function () {
  var BASE = window.DF_BASE || '';
  var form = document.getElementById('hs-form'); if (!form) return;
  var list = document.getElementById('hs-list'), head = document.getElementById('hs-h');
  var DATA = [];
  var HL = { have: 'have/by', skov: 'skov', soe: 'sø/å/mose', roer: 'rørskov', kyst: 'kyst', hav: 'hav', mark: 'mark/eng', krat: 'hede/krat' };
  var CL = { sort: 'sort', hvid: 'hvid', graa: 'grå', brun: 'brun', roed: 'rød/orange', gul: 'gul', groen: 'grøn', blaa: 'blå' };
  var SL = { 1: 'spurv', 2: 'solsort', 3: 'due/krage', 4: 'and/måge', 5: 'gås' };
  function vals(name) { return [].slice.call(form.querySelectorAll('input[name="' + name + '"]:checked')).map(function (i) { return i.value; }); }
  function el(t, c, x) { var e = document.createElement(t); if (c) e.className = c; if (x != null) e.textContent = x; return e; }
  function score(d, f) {
    var s = 0, why = [];
    if (f.h.length) { var hit = f.h.filter(function (h) { return d.h.indexOf(h) > -1; }); if (!hit.length) return null; s += 2; why.push(hit.map(function (h) { return HL[h]; }).join(', ')); }
    if (f.s) { if (!d.s) s -= 1; else { var diff = Math.abs(d.s - f.s); if (diff > 1) return null; s += diff ? 1 : 3; if (!diff) why.push('på størrelse med en ' + SL[d.s]); } }
    if (f.c.length) { var ch = f.c.filter(function (c) { return d.c.indexOf(c) > -1; }); var miss = f.c.length - ch.length; if (miss > 1 || (f.c.length === 1 && miss)) return null; s += 3 * ch.length - 3 * miss; if (ch.length) why.push(ch.map(function (c) { return CL[c]; }).join(', ')); }
    if (f.m !== '') { if (d.m) { var v = d.m[Number(f.m)]; if (v < 3) return null; s += v / 25; } }
    if (d.r && !f.r) return null;
    s += (d.f || 0) * 0.6; // almindelige arter ses oftere
    return { s: s, why: why };
  }
  function render() {
    var f = { h: vals('h'), s: Number(vals('s')[0] || 0), c: vals('c'), m: form.m.value, r: form.r.checked };
    var any = f.h.length || f.s || f.c.length || f.m !== '';
    list.innerHTML = '';
    if (!any) { head.textContent = 'Vælg mindst én ting ovenfor for at få forslag.'; return; }
    var res = DATA.map(function (d) { var r = score(d, f); return r && { d: d, s: r.s, why: r.why }; }).filter(Boolean).sort(function (a, b) { return b.s - a.s; });
    head.textContent = res.length ? (res.length > 24 ? 'De 24 bedste forslag (af ' + res.length + ')' : res.length + (res.length === 1 ? ' forslag' : ' forslag')) : 'Ingen arter passer. Prøv at fjerne en farve eller et sted.';
    res.slice(0, 24).forEach(function (r) {
      var li = el('li'); var a = el('a'); a.href = r.d.u;
      var im = el('img'); im.src = r.d.i; im.alt = ''; im.loading = 'lazy'; im.width = 88; im.height = 88; a.appendChild(im);
      var t = el('span'); t.appendChild(el('strong', null, r.d.n));
      if (r.d.kt) t.appendChild(el('span', 'hs-kt', r.d.kt));
      if (r.why.length) t.appendChild(el('span', 'hs-why', 'Passer: ' + r.why.join(' · ')));
      a.appendChild(t); li.appendChild(a); list.appendChild(li);
    });
  }
  form.addEventListener('change', render);
  form.addEventListener('reset', function () { setTimeout(render, 0); });
  fetch(BASE + '/hvad-saa-jeg.json').then(function (r) { return r.json(); }).then(function (d) {
    DATA = d; form.m.value = String(new Date().getMonth()); render();
  });
})();
