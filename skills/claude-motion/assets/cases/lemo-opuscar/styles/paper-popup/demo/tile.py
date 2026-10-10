# python3 tile.py out.jpg cols files...
import sys
from PIL import Image, ImageDraw
out, cols, fs = sys.argv[1], int(sys.argv[2]), sys.argv[3:]
w, h = 960, 540
rows = (len(fs) + cols - 1) // cols
S = Image.new('RGB', (w * cols, h * rows), (20, 20, 20))
d = ImageDraw.Draw(S)
for i, f in enumerate(fs):
    im = Image.open(f).convert('RGB').resize((w, h))
    S.paste(im, ((i % cols) * w, (i // cols) * h))
    d.rectangle([(i % cols) * w, (i // cols) * h, (i % cols) * w + 150, (i // cols) * h + 34], fill=(0, 0, 0))
    d.text(((i % cols) * w + 8, (i // cols) * h + 8), f.split('t_')[-1].replace('.jpg', ''), fill=(255, 255, 0))
S.save(out, quality=88)
