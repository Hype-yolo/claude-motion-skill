# NASA GISTEMP v4 全球海陆温度距平（基准 1951–1980）→ 每年夏季（JJA，6–8 月）距平
# 输入 data/GLB.Ts+dSST.csv（原样下载，公版）→ 输出 data/jja.json + 打印叙事里用到的事实
import csv, json, os
H = os.path.dirname(os.path.abspath(__file__)); D = os.path.join(H, '..', 'data')
rows = list(csv.reader(open(os.path.join(D, 'GLB.Ts+dSST.csv'))))
hdr = rows[1]; j = hdr.index('JJA')
out = []
for r in rows[2:]:
    if r and r[0].isdigit() and r[j] not in ('***', ''):
        out.append([int(r[0]), float(r[j])])
json.dump({'source': 'NASA GISTEMP v4, GLB.Ts+dSST.csv, column JJA (Jun-Aug), anomaly vs 1951-1980, degC',
           'downloaded': '2026-09-26', 'years': [y for y, _ in out], 'jja': [v for _, v in out]},
          open(os.path.join(D, 'jja.json'), 'w'))
V = dict(out)
life = [(y, V[y]) for y in range(1926, 2027)]
print('years', out[0][0], '-', out[-1][0], 'n', len(out), '| life n', len(life))
m7100 = sum(V[y] for y in range(1971, 2001)) / 30; print('1971-2000 mean %.3f' % m7100)
print('life min', min(life, key=lambda x: x[1]), 'max', max(life, key=lambda x: x[1]))
print('record max all years', max(out, key=lambda x: x[1]))
mx = -9; rec = []
for y, v in life:
    if v > mx: mx = v; rec.append((y, v))
print('running records from 1926:', rec)
mx = max(v for y, v in out if y < 1926); rec2 = []
for y, v in out:
    if y >= 1926 and v > mx: mx = v; rec2.append(y)
print('records vs whole record since 1880:', rec2)
print('last summer below 0:', max(y for y, v in life if v < 0))
print('1926-1976 range', min(V[y] for y in range(1926, 1977)), max(V[y] for y in range(1926, 1977)))
print('first half mean 1926-1975 %.2f' % (sum(V[y] for y in range(1926, 1976)) / 50))
