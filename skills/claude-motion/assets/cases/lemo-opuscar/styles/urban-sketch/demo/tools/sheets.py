# 把 out/fr/t*.jpg 每 25 张拼一张总览 out/cs0..N.jpg（用仓库 .venv 的 PIL）
import glob, os, subprocess, sys
d = os.path.abspath(os.path.join(os.path.dirname(os.path.abspath(__file__)), '..')); root = os.path.abspath(os.path.join(d, '../../..'))
fs = sorted(glob.glob(os.path.join(d, 'out/fr/t*.jpg')))
for i in range(0, len(fs), 25):
    subprocess.run([os.path.join(root, '.venv/bin/python'), os.path.join(root, 'core/render/sheet.py'), os.path.join(d, f'out/cs{i // 25}.jpg'), *fs[i:i + 25], '--cols', '5', '--w', '384'], check=True)
