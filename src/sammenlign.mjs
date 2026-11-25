// Sammenligning: arter der ofte forveksles, på lyd og på udseende.
// Én side pr. art (sammenlign/<slug>/), hvor arten står først og dens forvekslingsarter ved siden af.
// Parrene og teksterne står i data/sammenligninger.json – hvert par har sine kilder.

export function loadPairs(readJson, file, byKey) {
  const raw = readJson(file, []) || [];
  return raw.filter((p) => byKey.has(p.a) && byKey.has(p.b) && (p.se || p.lyd));
}

export function sammenlignPages(pairs, h) {
  const { esc, url, abs, size, credit, displayName, page, SITE_NAME, photoOf } = h;
  const nm = (d) => displayName(d);
  const lc = (s) => s.charAt(0).toLowerCase() + s.slice(1);
  const cmpUrl = (d) => `sammenlign/${d.slug}/`;
  const andList = (arr) => (arr.length > 1 ? `${arr.slice(0, -1).join(', ')} og ${arr[arr.length - 1]}` : arr[0] || '');

  // Arter med mindst ét par, og deres par
  const bySlug = new Map();
  for (const p of pairs) for (const d of [p.A, p.B]) {
    if (!bySlug.has(d.slug)) bySlug.set(d.slug, { d, pairs: [] });
    bySlug.get(d.slug).pairs.push(p);
  }
  const all = [...bySlug.values()].sort((x, y) => nm(x.d).localeCompare(nm(y.d), 'da'));

  function search(current) {
    return `<form class="cmp-search" role="search" onsubmit="return false">
    <label for="cmp-q">${current ? 'Sammenlign en anden fugl' : 'Find en fugl'}</label>
    <input id="cmp-q" type="search" list="cmp-arter" autocomplete="off" placeholder="Fx gransanger">
    <datalist id="cmp-arter">${all.map(({ d }) => `<option value="${esc(nm(d))}" data-url="${esc(url(cmpUrl(d)))}"></option>`).join('')}</datalist>
    <p class="cmp-msg" id="cmp-msg" aria-live="polite"></p>
  </form>`;
  }

  function bird(d, focal) {
    const ph = photoOf(d);
    const so = d.sound?.src?.length ? d.sound : null;
    const lic = so ? (so.licenseUrl ? `<a href="${esc(so.licenseUrl)}" rel="license noopener" target="_blank">${esc(so.license)}</a>` : esc(so.license)) : '';
    return `<div class="cmp-bird${focal ? ' focal' : ''}">
    ${ph ? `<figure><img src="${esc(ph.medium)}" srcset="${esc(ph.medium)} 500w, ${esc(size(ph, 'large'))} 1024w" sizes="(min-width: 1100px) 540px, (min-width: 700px) 45vw, 100vw" alt="${esc(nm(d))}" loading="lazy" decoding="async"><figcaption>${credit(ph)}</figcaption></figure>` : '<div class="cmp-noimg" aria-hidden="true"></div>'}
    <p class="cmp-name"><a href="${url(`fugle/${d.slug}/`)}">${esc(nm(d))}</a> <i>${esc(d.names.accepted)}</i></p>
    ${so ? `<audio controls preload="none" aria-label="Lyd: ${esc(nm(d))}">${so.src.map((x) => `<source src="${esc(x.u)}"${x.type && x.type !== 'application/ogg' ? ` type="${esc(x.type)}"` : ''}>`).join('')}</audio>
    <p class="cmp-credit">Optaget af ${esc(so.artist || 'ukendt')}, ${lic}, via <a href="${esc(so.page)}" rel="noopener" target="_blank">${esc(so.via || 'xeno-canto')}</a>.</p>` : '<p class="cmp-credit">Ingen lydoptagelse.</p>'}
    ${!focal && bySlug.has(d.slug) ? `<p class="cmp-more"><a href="${url(cmpUrl(d))}">Sammenlign ${esc(lc(nm(d)))} →</a></p>` : ''}
  </div>`;
  }

  // Tabel for ét par, set fra fokusartens side (fokusarten i første kolonne)
  function table(p, kind, F, many) {
    const part = p[kind];
    if (!part) return '';
    const O = p.A === F ? p.B : p.A;
    const flip = p.A !== F;
    const rows = (part.rows || []).map((r) => [r[0], flip ? r[2] : r[1], flip ? r[1] : r[2]]).filter((r) => r[1] !== '–' || r[2] !== '–');
    return `<div class="cmp-pair">
      ${many ? `<h3>${esc(nm(F))} og ${esc(lc(nm(O)))}</h3>` : ''}
      ${part.intro ? `<p>${esc(part.intro)}</p>` : ''}
      ${rows.length ? `<div class="cmp-rows" role="table" aria-label="${esc(nm(F))} og ${esc(lc(nm(O)))}">
        <div class="cmp-row cmp-head" role="row"><span class="cl" role="columnheader">Kendetegn</span><span role="columnheader">${esc(nm(F))}</span><span role="columnheader">${esc(nm(O))}</span></div>
        ${rows.map((r) => `<div class="cmp-row" role="row"><span class="cl" role="rowheader">${esc(r[0])}</span><span role="cell" data-n="${esc(nm(F))}">${esc(r[1])}</span><span role="cell" data-n="${esc(nm(O))}">${esc(r[2])}</span></div>`).join('')}
      </div>` : ''}
    </div>`;
  }

  function speciesPage({ d: F, pairs: ps }) {
    const others = ps.map((p) => (p.A === F ? p.B : p.A));
    const otherNames = andList(others.map((o) => lc(nm(o))));
    const lyd = ps.filter((p) => p.lyd);
    const se = ps.filter((p) => p.se);
    const kilder = [];
    for (const p of ps) for (const k of p.kilder) if (!kilder.some((x) => x.u === k.u)) kilder.push(k);
    const body = `<div class="wrap cmp-page">
  <nav class="crumbs" aria-label="Brødkrumme"><a href="${url('')}">Forside</a> › <a href="${url('sammenlign/')}">Fugle der ligner hinanden</a> › ${esc(nm(F))}</nav>
  <header class="cmp-intro">
    <p class="cmp-kicker">Sammenlign</p>
    <h1>${esc(nm(F))}</h1>
    <p class="lead">Forveksles ofte med ${esc(otherNames)}. Hør optagelserne og se billederne side om side.</p>
  </header>
  <div class="cmp-birds n${others.length + 1}">${bird(F, true)}${others.map((o) => bird(o, false)).join('')}</div>
  ${lyd.length ? `<section class="cmp-part"><h2><span>1</span> Hør forskellen</h2>${lyd.map((p) => table(p, 'lyd', F, lyd.length > 1)).join('')}</section>` : ''}
  ${se.length ? `<section class="cmp-part"><h2><span>${lyd.length ? 2 : 1}</span> Se forskellen</h2>${se.map((p) => table(p, 'se', F, se.length > 1)).join('')}</section>` : ''}
  <p class="cmp-src">Kilder: ${kilder.map((k) => `<a href="${esc(k.u)}" rel="noopener" target="_blank">${esc(k.n)}</a>`).join(' · ')}. Gengivet med egne ord. Kendetegnene gælder voksne fugle, medmindre andet står.</p>
  <p class="cmp-back"><a class="btn" href="${url(`fugle/${F.slug}/`)}">Læs mere om ${esc(lc(nm(F)))}</a></p>
  ${search(true)}
</div>`;
    return {
      path: `${cmpUrl(F)}index.html`,
      html: page({
        title: `${nm(F)} eller ${otherNames}? Hør og se forskellen | ${SITE_NAME}`,
        description: `Sådan kender du ${lc(nm(F))} fra ${otherNames}: lyd og billeder side om side og de vigtigste kendetegn, med kilder.`,
        canonical: abs(cmpUrl(F)),
        image: photoOf(F)?.large || photoOf(F)?.medium,
        body,
        bodyClass: 'cmp-body',
      }),
    };
  }

  const index = `<div class="wrap cmp-page">
  <nav class="crumbs" aria-label="Brødkrumme"><a href="${url('')}">Forside</a> › Fugle der ligner hinanden</nav>
  <header class="cmp-intro">
    <h1>Fugle der ligner hinanden</h1>
    <p class="lead">Vælg en fugl og se de arter, den oftest forveksles med – først på lyden, så på udseendet.</p>
  </header>
  ${search(false)}
  <ul class="cmp-grid">${all.map(({ d, pairs: ps }) => {
    const ph = photoOf(d);
    const others = ps.map((p) => lc(nm(p.A === d ? p.B : p.A)));
    return `<li><a href="${url(cmpUrl(d))}">${ph ? `<img src="${esc(size(ph, 'small'))}" alt="" loading="lazy" width="72" height="72">` : '<span class="cmp-noimg"></span>'}<span><strong>${esc(nm(d))}</strong><span>forveksles med ${esc(andList(others))}</span></span></a></li>`;
  }).join('')}</ul>
  <aside class="cmp-about"><h2>Om sammenligningerne</h2><p>Her er kun arter med, hvor forskellen er beskrevet i en kilde – oftest Store norske leksikon og Lex – Danmarks Nationalleksikon. Kilderne står på hver side, og teksten er gengivet med egne ord. Fugle varierer, og lys og afstand snyder, så brug kendetegnene som hjælp, ikke som facit.</p></aside>
</div>`;

  return [
    { path: 'sammenlign/index.html', html: page({ title: `Fugle der ligner hinanden – hør og se forskellen | ${SITE_NAME}`, description: `Sammenlign danske fugle, der ofte forveksles: gransanger og løvsanger, fjordterne og havterne, musvåge og fjeldvåge m.fl. Med lyd, billeder og kilder.`, canonical: abs('sammenlign/'), body: index, bodyClass: 'cmp-body' }) },
    ...all.map(speciesPage),
  ];
}
