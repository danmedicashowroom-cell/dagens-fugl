// Sammenligningssiden: arter der ofte forveksles, på lyd og på udseende.
// Parrene og teksterne står i data/sammenligninger.json – hvert par har sine kilder.
// Kun par hvor begge arter har en side, kommer med.

export function loadPairs(readJson, file, byKey) {
  const raw = readJson(file, []) || [];
  return raw.filter((p) => byKey.has(p.a) && byKey.has(p.b) && (p.se || p.lyd));
}

export function sammenlignPage(pairs, h) {
  const { esc, url, abs, size, credit, displayName, page, SITE_NAME, photoOf } = h;
  const nm = (d) => displayName(d);
  const lc = (s) => s.charAt(0).toLowerCase() + s.slice(1);
  const pairId = (p) => `par-${p.A.slug}--${p.B.slug}`;

  function bird(d, cls) {
    const ph = photoOf(d);
    const so = d.sound?.src?.length ? d.sound : null;
    const lic = so ? (so.licenseUrl ? `<a href="${esc(so.licenseUrl)}" rel="license noopener" target="_blank">${esc(so.license)}</a>` : esc(so.license)) : '';
    return `<div class="cmp-bird ${cls}">
    ${ph ? `<figure><img src="${esc(ph.medium)}" srcset="${esc(ph.medium)} 500w, ${esc(size(ph, 'large'))} 1024w" sizes="(min-width: 760px) 340px, 50vw" alt="${esc(nm(d))}" loading="lazy" decoding="async"><figcaption>${credit(ph)}</figcaption></figure>` : '<div class="cmp-noimg" aria-hidden="true"></div>'}
    <p class="cmp-name"><a href="${url(`fugle/${d.slug}/`)}">${esc(nm(d))}</a> <i>${esc(d.names.accepted)}</i></p>
    ${so ? `<audio controls preload="none" aria-label="Lyd: ${esc(nm(d))}">${so.src.map((x) => `<source src="${esc(x.u)}"${x.type && x.type !== 'application/ogg' ? ` type="${esc(x.type)}"` : ''}>`).join('')}</audio>
    <p class="cmp-credit">Optaget af ${esc(so.artist || 'ukendt')}, ${lic}, via <a href="${esc(so.page)}" rel="noopener" target="_blank">${esc(so.via || 'xeno-canto')}</a>.</p>` : '<p class="cmp-credit">Ingen lydoptagelse.</p>'}
  </div>`;
  }

  function block(kind, part, A, B) {
    if (!part) return '';
    const rows = (part.rows || []).filter((r) => r[1] !== '–' || r[2] !== '–');
    return `<section class="cmp-part cmp-${kind}">
    <h3>${kind === 'lyd' ? 'Hør forskellen' : 'Se forskellen'}</h3>
    ${part.intro ? `<p>${esc(part.intro)}</p>` : ''}
    ${rows.length ? `<div class="cmp-rows" role="table" aria-label="${kind === 'lyd' ? 'Forskelle i lyd' : 'Forskelle i udseende'}">
      <div class="cmp-row cmp-head" role="row"><span class="cl" role="columnheader">Kendetegn</span><span class="ca" role="columnheader">${esc(nm(A))}</span><span class="cb" role="columnheader">${esc(nm(B))}</span></div>
      ${rows.map((r) => `<div class="cmp-row" role="row"><span class="cl" role="rowheader">${esc(r[0])}</span><span class="ca" role="cell" data-n="${esc(nm(A))}">${esc(r[1])}</span><span class="cb" role="cell" data-n="${esc(nm(B))}">${esc(r[2])}</span></div>`).join('')}
    </div>` : ''}
  </section>`;
  }

  function card(p) {
    const { A, B } = p;
    return `<article class="cmp" id="${pairId(p)}" data-a="${esc(A.slug)}" data-b="${esc(B.slug)}" data-lyd="${p.lyd ? 1 : 0}" data-se="${p.se ? 1 : 0}">
  <h2 class="cmp-title">${esc(nm(A))} og ${esc(lc(nm(B)))}</h2>
  <div class="cmp-birds">${bird(A, 'ca')}${bird(B, 'cb')}</div>
  ${block('lyd', p.lyd, A, B)}
  ${block('se', p.se, A, B)}
  <p class="cmp-src">Kilder: ${p.kilder.map((k) => `<a href="${esc(k.u)}" rel="noopener" target="_blank">${esc(k.n)}</a>`).join(' · ')}. Gengivet med egne ord.</p>
</article>`;
  }

  // Arter der indgår i mindst ét par
  const inPairs = new Map();
  for (const p of pairs) for (const d of [p.A, p.B]) inPairs.set(d.slug, d);
  const list = [...inPairs.values()].sort((a, b) => nm(a).localeCompare(nm(b), 'da'));

  const body = `<div class="wrap cmp-page">
  <nav class="crumbs" aria-label="Brødkrumme"><a href="${url('')}">Forside</a> › Sammenlign</nav>
  <header class="cmp-intro">
    <h1>Fugle der ligner hinanden</h1>
    <p class="lead">Vælg en fugl og se, hvilke arter den oftest forveksles med – først på lyden, så på udseendet. Hør optagelserne side om side og se, hvad du skal lægge mærke til.</p>
  </header>
  <form class="cmp-search" role="search" onsubmit="return false">
    <label for="cmp-q">Find en fugl</label>
    <div class="cmp-search-row">
      <input id="cmp-q" type="search" list="cmp-arter" autocomplete="off" placeholder="Fx gransanger">
      <button type="button" class="btn" id="cmp-clear" hidden>Vis alle</button>
    </div>
    <datalist id="cmp-arter">${list.map((d) => `<option value="${esc(nm(d))}" data-slug="${esc(d.slug)}"></option>`).join('')}</datalist>
    <p class="cmp-msg" id="cmp-msg" aria-live="polite"></p>
  </form>
  <div id="cmp-result"></div>
  <div id="cmp-all">
    <ul class="cmp-index">${pairs.map((p) => `<li><a href="#${pairId(p)}">${esc(nm(p.A))} og ${esc(lc(nm(p.B)))}</a>${p.lyd ? ' <span class="cmp-tag">lyd</span>' : ''}${p.se ? ' <span class="cmp-tag">udseende</span>' : ''}</li>`).join('')}</ul>
    ${pairs.map(card).join('\n')}
  </div>
  <aside class="cmp-about"><h2>Om sammenligningerne</h2><p>Her er kun par med, hvor forskellen er beskrevet i en kilde – oftest Store norske leksikon og Lex – Danmarks Nationalleksikon. Kilderne står under hvert par, og teksten er gengivet med egne ord. Kendetegnene gælder voksne fugle, medmindre andet står. Fugle varierer, og lys og afstand snyder, så brug kendetegnene som hjælp, ikke som facit.</p></aside>
</div>`;

  return page({
    title: `Fugle der ligner hinanden – hør og se forskellen | ${SITE_NAME}`,
    description: `Sammenlign ${pairs.length} par danske fugle, der ofte forveksles: gransanger og løvsanger, fjordterne og havterne, musvåge og fjeldvåge m.fl. Med lyd, billeder og kilder.`,
    canonical: abs('sammenlign/'),
    body,
    bodyClass: 'cmp-body',
  });
}
