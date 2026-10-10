import sys, glob, os
from PIL import Image, ImageDraw
files = sys.argv[2:]; out = sys.argv[1]
cols = 2; w, h = 960, 540
rows = (len(files) + cols - 1) // cols
S = Image.new('RGB', (cols * w, rows * h), 'white'); d = ImageDraw.Draw(S)
for i, f in enumerate(files):
    im = Image.open(f).convert('RGB').resize((w, h), Image.LANCZOS)
    x, y = (i % cols) * w, (i // cols) * h; S.paste(im, (x, y)); d.rectangle([x, y, x + 110, y + 28], fill='black'); d.text((x + 6, y + 6), os.path.basename(f)[2:-4], fill='white')
S.save(out, quality=88)
