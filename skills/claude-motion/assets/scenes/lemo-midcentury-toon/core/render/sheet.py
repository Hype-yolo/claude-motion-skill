"""缩略图总览（审片用）：python core/render/sheet.py out.jpg img1 img2 ... [--cols 4] [--w 480]"""
import sys
from PIL import Image, ImageDraw
args = sys.argv[1:]; cols = 4; w = 480
if '--cols' in args: i = args.index('--cols'); cols = int(args[i + 1]); del args[i:i + 2]
if '--w' in args: i = args.index('--w'); w = int(args[i + 1]); del args[i:i + 2]
out, files = args[0], args[1:]
im0 = Image.open(files[0]); h = w * im0.height // im0.width; rows = (len(files) + cols - 1) // cols
S = Image.new('RGB', (cols * w, rows * (h + 22)), (20, 20, 24)); d = ImageDraw.Draw(S)
for k, f in enumerate(files):
    im = Image.open(f).convert('RGB').resize((w, h)); x, y = (k % cols) * w, (k // cols) * (h + 22)
    S.paste(im, (x, y + 22)); d.text((x + 6, y + 5), f.split('/')[-1], fill=(230, 230, 230))
S.save(out, quality=88); print(out, S.size)
