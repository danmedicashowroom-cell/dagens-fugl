// Engangsværktøj (køres i GitHub Actions, workflow »Tjek fotos«):
// 1) finder fotos fra iNaturalist-observationer, der er annoteret som æg, fjer, rede, knogler, spor, ekskrementer eller død fugl
// 2) laver kontaktark (100 små billeder pr. ark med nummer) til manuel gennemgang
// Kræver dist/fotos-brugt.json (kør node src/build.mjs først).
import fs from 'node:fs';
import { execFileSync } from 'node:child_process';
const brugt = JSON.parse(fs.readFileSync('dist/fotos-brugt.json', 'utf8'));
fs.mkdirSync('tjek/thumbs', { recursive: true });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function json(u) {
  for (let t = 0; t < 4; t++) {
    const r = await fetch(u, { headers: { 'User-Agent': 'dagensfugl.dk foto-tjek' } });
    if (r.ok) return r.json();
    await sleep(3000 * (t + 1));
  }
  return null;
}
const ids = new Set(brugt.map((x) => x.i));
// --- 1) annoteringer ---
const terms = (await json('https://api.inaturalist.org/v1/controlled_terms'))?.results || [];
const wanted = [];
for (const t of terms) {
  const tl = t.label.toLowerCase();
  for (const v of t.values || []) {
    const vl = v.label.toLowerCase();
    if ((tl === 'evidence of presence' && vl !== 'organism') || (tl === 'life stage' && vl === 'egg') || (tl === 'alive or dead' && vl === 'dead')) wanted.push([t.id, v.id, `${t.label}: ${v.label}`]);
  }
}
console.log('Annoteringer der tjekkes:', wanted.map((w) => w[2]).join(', '));
const flagged = [];
const taxa = [...new Set(brugt.map((x) => x.inat).filter(Boolean))];
for (let b = 0; b < taxa.length; b += 60) {
  const tx = taxa.slice(b, b + 60).join(',');
  for (const [tid, vid, label] of wanted) {
    for (let page = 1; page <= 50; page++) {
      const d = await json(`https://api.inaturalist.org/v1/observations?taxon_id=${tx}&term_id=${tid}&term_value_id=${vid}&photos=true&per_page=200&page=${page}&order_by=id`);
      await sleep(1100);
      for (const o of d?.results || []) for (const ph of o.photos || []) if (ids.has(ph.id)) flagged.push({ id: ph.id, label, obs: o.id });
      if (!d || (d.results || []).length < 200) break;
    }
  }
  console.log(`  ${Math.min(b + 60, taxa.length)}/${taxa.length} arter tjekket, ${flagged.length} fundet`);
}
fs.writeFileSync('tjek/annoteret.json', JSON.stringify(flagged, null, 1));
console.log(`Annoterede fotos i brug: ${flagged.length}`);
// --- 2) kontaktark ---
const list = brugt.map((x, n) => ({ ...x, n }));
await Promise.all(Array.from({ length: 16 }, async (_, w) => {
  for (let j = w; j < list.length; j += 16) {
    const x = list[j]; const f = `tjek/thumbs/${String(x.n).padStart(5, '0')}.jpg`;
    try { const r = await fetch(x.u.replace('/medium.', '/small.')); if (r.ok) fs.writeFileSync(f, Buffer.from(await r.arrayBuffer())); } catch { /* */ }
  }
}));
const files = fs.readdirSync('tjek/thumbs').sort();
for (let s = 0; s * 100 < files.length; s++) {
  const part = files.slice(s * 100, s * 100 + 100).map((f) => `tjek/thumbs/${f}`);
  const args = [];
  for (const f of part) args.push('-label', String(Number(f.match(/(\d+)\.jpg$/)[1])), f);
  execFileSync('montage', [...args, '-tile', '10x10', '-geometry', '120x120+2+2', '-pointsize', '14', `tjek/ark-${String(s).padStart(3, '0')}.jpg`]);
}
fs.writeFileSync('tjek/indeks.json', JSON.stringify(list.map((x) => ({ nr: x.n, id: x.i, art: x.k }))));
console.log(`Kontaktark: ${Math.ceil(files.length / 100)}`);
