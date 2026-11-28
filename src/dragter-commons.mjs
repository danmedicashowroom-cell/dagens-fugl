// Finder sommer- og vinterdragt-billeder på Wikimedia Commons for arterne på Den danske liste.
// Kun frie licenser uden »del på samme vilkår«: CC0, public domain og CC BY. Skriver tjek/dragter.json + kontaktark.
// Køres i GitHub Actions (workflow »Find dragter«).
import fs from 'node:fs';
import { execFileSync } from 'node:child_process';
const UA = 'dagensfugl.dk dragter (dagensfugl1@gmail.com)';
const API = 'https://commons.wikimedia.org/w/api.php';
let DBG = 0;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function api(params) {
  const u = `${API}?format=json&formatversion=2&${new URLSearchParams(params)}`;
  for (let t = 0; t < 4; t++) {
    try { const r = await fetch(u, { headers: { 'User-Agent': UA, 'Api-User-Agent': UA } }); if (r.ok) return r.json(); if (DBG++ < 5) console.log('HTTP', r.status, u.slice(0, 160)); } catch (e) { if (DBG++ < 5) console.log('fejl', e.message); }
    await sleep(2000 * (t + 1));
  }
  return null;
}
const dl = JSON.parse(fs.readFileSync('data/danske-liste.json', 'utf8'));
const species = [];
for (const k of Object.keys(dl)) {
  const f = `data/cache/${k}.json`;
  if (!fs.existsSync(f)) continue;
  const d = JSON.parse(fs.readFileSync(f, 'utf8'));
  species.push({ k, sci: d.names?.accepted, alt: [d.names?.accepted, ...(d.names?.synonyms || [])].filter(Boolean) });
}
const SEASON = [
  ['sommer', /\b(breeding|summer|nuptial|alternate) plumage\b/i, /non-?breeding/i],
  ['vinter', /\b(non-?breeding|winter|basic) plumage\b/i, null],
];
const LIC_OK = (s) => /^(cc0|public domain|pd\b|pdm|cc by \d|cc-by-\d|cc by\b)/i.test(s || '') && !/sa\b|share/i.test(s || '');
const plain = (h) => String(h || '').replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();
const out = {};
fs.mkdirSync('tjek/thumbs', { recursive: true });
for (const sp of species) {
  let cats = [];
  for (const name of sp.alt) {
    const r = await api({ action: 'query', list: 'categorymembers', cmtitle: `Category:${name}`, cmtype: 'subcat', cmlimit: '500' });
    cats = (r?.query?.categorymembers || []).map((c) => c.title);
    if (cats.length) break;
    await sleep(300);
  }
  if (species.indexOf(sp) < 3) console.log(sp.k, 'kategorier:', cats.slice(0, 40).join(' | '));
  const res = {};
  for (const [season, re, not] of SEASON) {
    let sc = cats.filter((c) => re.test(c) && !(not && not.test(c)));
    // et niveau dybere (fx »… in breeding plumage (males)«)
    for (const c of [...sc]) {
      const r = await api({ action: 'query', list: 'categorymembers', cmtitle: c, cmtype: 'subcat', cmlimit: '100' });
      sc.push(...(r?.query?.categorymembers || []).map((x) => x.title));
    }
    const files = new Set();
    for (const c of sc) {
      const r = await api({ action: 'query', list: 'categorymembers', cmtitle: c, cmtype: 'file', cmlimit: '200' });
      for (const m of r?.query?.categorymembers || []) if (/\.(jpe?g|png)$/i.test(m.title)) files.add(m.title);
      await sleep(200);
    }
    const cand = [];
    const list = [...files];
    for (let i = 0; i < list.length; i += 40) {
      const r = await api({ action: 'query', titles: list.slice(i, i + 40).join('|'), prop: 'imageinfo|categories', iiprop: 'url|size|extmetadata', iiurlwidth: '800', clcategories: 'Category:Quality images|Category:Featured pictures on Wikimedia Commons|Category:Valued images', cllimit: '500' });
      for (const p of r?.query?.pages || []) {
        const ii = p.imageinfo?.[0]; if (!ii) continue;
        const m = ii.extmetadata || {};
        const lic = m.LicenseShortName?.value || '';
        if (!LIC_OK(lic)) continue;
        if (ii.width < 800) continue;
        const q = (p.categories || []).length;
        cand.push({ t: p.title, u: ii.thumburl, page: ii.descriptionurl, w: ii.width, artist: plain(m.Artist?.value).slice(0, 80), lic, licUrl: m.LicenseUrl?.value || '', q });
      }
      await sleep(300);
    }
    cand.sort((a, b) => b.q - a.q || b.w - a.w);
    if (cand.length) res[season] = cand.slice(0, 4);
  }
  if (res.sommer && res.vinter) out[sp.k] = res;
  if (Object.keys(out).length % 10 === 0) console.log(`  ${sp.k}: ${Object.keys(out).length} arter med begge dragter`);
}
fs.writeFileSync('tjek/dragter.json', JSON.stringify(out, null, 1));
console.log(`Arter med både sommer- og vinterdragt: ${Object.keys(out).length}`);
// kontaktark: én række pr. art (op til 4 sommer + 4 vinter)
let n = 0; const rows = [];
for (const [k, r] of Object.entries(out)) {
  for (const s of ['sommer', 'vinter']) for (let i = 0; i < r[s].length; i++) {
    const f = `tjek/thumbs/${String(n).padStart(5, '0')}.jpg`;
    try { const x = await fetch(r[s][i].u.replace(/\/800px-/, '/240px-'), { headers: { 'User-Agent': UA } }); if (x.ok) { fs.writeFileSync(f, Buffer.from(await x.arrayBuffer())); rows.push({ n, k, s, i, f }); } } catch { /* */ }
    n++;
  }
}
fs.writeFileSync('tjek/dragter-indeks.json', JSON.stringify(rows.map(({ f, ...x }) => x)));
for (let s = 0; s * 80 < rows.length; s++) {
  const part = rows.slice(s * 80, s * 80 + 80);
  const args = [];
  for (const x of part) args.push('-label', `${x.n} ${x.k.slice(0, 14)} ${x.s[0].toUpperCase()}`, x.f);
  execFileSync('montage', [...args, '-tile', '8x10', '-geometry', '150x150+2+2', '-pointsize', '11', `tjek/dragter-ark-${String(s).padStart(3, '0')}.jpg`]);
}
