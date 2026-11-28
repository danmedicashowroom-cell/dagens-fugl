# Henter AVONET (Tobias m.fl. 2022, Ecology Letters, CC BY 4.0) og gemmer vægt og levested for arterne i data/cache.
import json, os, re, sys, glob, urllib.request, io
import openpyxl
UA = {'User-Agent': 'dagensfugl.dk (dagensfugl1@gmail.com)'}
page = urllib.request.urlopen(urllib.request.Request('https://figshare.com/s/b990722d72a26b5bfead', headers=UA)).read().decode('utf8', 'ignore')
ids = re.findall(r'ndownloader/files/(\d+)', page)
print('fil-id:', ids[:6])
data = None
for fid in dict.fromkeys(ids):
    url = f'https://figshare.com/ndownloader/files/{fid}?private_link=b990722d72a26b5bfead'
    b = urllib.request.urlopen(urllib.request.Request(url, headers=UA)).read()
    print(fid, len(b))
    if len(b) > 15_000_000: data = b; break
wb = openpyxl.load_workbook(io.BytesIO(data), read_only=True, data_only=True)
print(wb.sheetnames)
want = {}
for f in glob.glob('data/cache/*.json'):
    d = json.load(open(f))
    names = [d.get('names', {}).get('accepted')] + d.get('names', {}).get('synonyms', [])
    for n in filter(None, names): want.setdefault(n.lower(), d['key'])
out = {}
for sheet in ['AVONET2_eBird', 'AVONET3_BirdTree', 'AVONET1_BirdLife']:
    if sheet not in wb.sheetnames: continue
    ws = wb[sheet]; rows = ws.iter_rows(values_only=True); head = [str(h) for h in next(rows)]
    ix = {h: i for i, h in enumerate(head)}
    sp = next(h for h in head if h.startswith('Species'))
    for r in rows:
        n = str(r[ix[sp]] or '').lower().replace('_', ' ')
        k = want.get(n)
        if not k or k in out: continue
        g = lambda c: r[ix[c]] if c in ix else None
        out[k] = {'mass': g('Mass'), 'wing': g('Wing.Length'), 'habitat': g('Habitat'), 'density': g('Habitat.Density'), 'migration': g('Migration'), 'trophic': g('Trophic.Niche'), 'lifestyle': g('Primary.Lifestyle')}
    print(sheet, len(out))
os.makedirs('tjek', exist_ok=True)
json.dump(out, open('tjek/avonet.json', 'w'), indent=0)
