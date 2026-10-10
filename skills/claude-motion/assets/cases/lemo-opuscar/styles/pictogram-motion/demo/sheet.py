import sys
from PIL import Image, ImageDraw
files = sys.argv[2:]; out = sys.argv[1]
cols = 3 if len(files) > 4 else 2
w, h = 640, 360
rows = (len(files) + cols - 1) // cols
S = Image.new('RGB', (cols * w, rows * h), 'black')
for i, f in enumerate(files):
    im = Image.open(f).resize((w, h), Image.LANCZOS)
    d = ImageDraw.Draw(im); lab = f.split('t_')[-1].rsplit('.', 1)[0]
    d.rectangle([0, 0, 8 * len(lab) + 12, 20], fill='black'); d.text((6, 4), lab, fill='white')
    S.paste(im, ((i % cols) * w, (i // cols) * h))
S.save(out, quality=88)
