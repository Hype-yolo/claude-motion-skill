# 组装 main.js = main_v1.js 前 109 行（调色板/节拍/通用视觉，改 150 BPM、93 小节）+ main_v1 的角色库（robotDB … 舞台前）+ main_b.js（v2/v3 全部场景）
import os
os.chdir(os.path.dirname(os.path.abspath(__file__)))
L = open('main_v1.js', encoding='utf-8').read().split('\n')
segA = '\n'.join(L[0:109]).replace('const BPM = 140,', 'const BPM = 150,').replace('const END_BAR = 61;', 'const END_BAR = 93;')
start = next(i for i, l in enumerate(L) if l.startswith('function robotDB')); end = next(i for i, l in enumerate(L) if l.startswith('// 舞台')) - 1
open('main.js', 'w', encoding='utf-8').write(segA + '\n' + '\n'.join(L[start:end]) + '\n' + open('main_b.js', encoding='utf-8').read())
