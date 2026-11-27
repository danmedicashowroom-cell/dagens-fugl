// Finder landet i iNaturalists stednavn (som står på mange sprog) og giver det danske landenavn.
// Kendes landet ikke, vises intet sted – hellere intet end et sted på et fremmed sprog.
const norm = (s) => String(s).toLowerCase().normalize('NFKC').replace(/&/g, 'and').replace(/[.'’]/g, '').replace(/\s+/g, ' ').trim();
const LOCS = ['en', 'ru', 'es', 'fr', 'de', 'pt', 'nl', 'it', 'ja', 'zh', 'zh-Hant', 'sv', 'nb', 'fi', 'pl', 'tr', 'el', 'he', 'ar', 'ko', 'th', 'id', 'vi', 'uk', 'cs', 'hu', 'ro', 'da', 'is', 'ca', 'hr', 'sk', 'bg', 'sr', 'et', 'lv', 'lt', 'sl', 'ms', 'hi', 'fa', 'kk', 'af'];
const MAP = new Map();
const EXTRA = {
  usa: 'US', 'united states of america': 'US', uk: 'GB', 'great britain': 'GB', england: 'GB', scotland: 'GB', wales: 'GB', 'northern ireland': 'GB',
  'republic of korea': 'KR', 'south korea': 'KR', 'czech republic': 'CZ', 'the netherlands': 'NL', holland: 'NL', 'russian federation': 'RU', turkey: 'TR',
  'ivory coast': 'CI', 'democratic republic of the congo': 'CD', 'republic of the congo': 'CG', 'viet nam': 'VN', 'lao pdr': 'LA', brasil: 'BR', 'hong kong': 'HK',
  'south georgia and the south sandwich islands': 'GS', 'falkland islands (malvinas)': 'FK', eswatini: 'SZ', swaziland: 'SZ', burma: 'MM', 'suid-afrika': 'ZA',
  galápagos: 'EC', galapagos: 'EC', hawaii: 'US', 'svalbard und jan mayen': 'SJ', шпицберген: 'SJ', 台灣: 'TW', 台湾: 'TW', 中国: 'CN', 日本: 'JP',
  'western cape': 'ZA', 'eastern cape': 'ZA', 'kwazulu-natal': 'ZA', gauteng: 'ZA', 'kruger national park': 'ZA', gujarat: 'IN', kerala: 'IN', 'tamil nadu': 'IN',
};
// Amerikanske delstater og canadiske provinser (forkortelser og navne)
const US = 'AL AK AZ AR CA CO CT DE FL GA HI ID IL IN IA KS KY LA ME MD MA MI MN MS MO MT NE NV NH NJ NM NY NC ND OH OK OR PA RI SC SD TN TX UT VT VA WA WV WI WY DC'.split(' ');
const USN = 'alabama alaska arizona arkansas california colorado connecticut delaware florida georgia idaho illinois indiana iowa kansas kentucky louisiana maine maryland massachusetts michigan minnesota mississippi missouri montana nebraska nevada new-hampshire new-jersey new-mexico new-york north-carolina north-dakota ohio oklahoma oregon pennsylvania rhode-island south-carolina south-dakota tennessee texas utah vermont virginia washington west-virginia wisconsin wyoming'.split(' ').map((x) => x.replace(/-/g, ' '));
const CAN = 'BC AB SK MB ON QC NB NS PE NL YT NT NU'.split(' ');
const CANN = ['british columbia', 'alberta', 'saskatchewan', 'manitoba', 'ontario', 'quebec', 'québec', 'new brunswick', 'nova scotia', 'prince edward island', 'newfoundland and labrador', 'yukon'];
(function init() {
  const en = new Intl.DisplayNames(['en'], { type: 'region' });
  for (let a = 65; a < 91; a++) for (let b = 65; b < 91; b++) {
    const c = String.fromCharCode(a, b); let n; try { n = en.of(c); } catch { continue; }
    if (!n || n === c) continue;
    for (const l of LOCS) { try { MAP.set(norm(new Intl.DisplayNames([l], { type: 'region' }).of(c)), c); } catch { /* */ } }
  }
  for (const [k, v] of Object.entries(EXTRA)) MAP.set(norm(k), v);
})();
const NAMES = [...MAP.keys()].filter((k) => k.length >= 4 || /[　-鿿]/.test(k)).sort((a, b) => b.length - a.length);
const da = new Intl.DisplayNames(['da'], { type: 'region' });

export function landKode(place) {
  if (!place) return null;
  const parts = String(place).split(/[,，、]/).map(norm).filter(Boolean);
  // iNaturalist slutter ofte med landekoden (»Moskva, RU«)
  const last = parts.at(-1) || '';
  if (/^[a-z]{2}$/.test(last)) { const c = last.toUpperCase() === 'UK' ? 'GB' : last.toUpperCase(); try { if (da.of(c) !== c) return c; } catch { /* */ } }
  for (let i = parts.length - 1; i >= 0; i--) {
    const p = parts[i].replace(/^\d+\s+/, '').replace(/\s+\d+$/, '');
    if (MAP.has(p)) return MAP.get(p);
    if (/^us-[a-z]{2}$/.test(p) || US.includes(p.toUpperCase()) && i === parts.length - 1 && parts.length > 1 || USN.includes(p)) return 'US';
    if (/^ca-[a-z]{2}$/.test(p) || CAN.includes(p.toUpperCase()) && i === parts.length - 1 && parts.length > 1 || CANN.includes(p)) return 'CA';
  }
  // Sidste udvej: et landenavn inde i teksten (fx »Dubai - United Arab Emirates«, »台灣宜蘭縣«)
  const all = parts.join(' ');
  for (const n of NAMES) if (all.includes(n)) return MAP.get(n);
  return null;
}

export function landDa(place) {
  const c = landKode(place);
  if (!c) return null;
  try { return da.of(c); } catch { return null; }
}
