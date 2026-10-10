import numpy as np
from PIL import Image, ImageDraw, ImageFilter
W,H=1920,1080; rng=np.random.default_rng(3)
base=np.array([241,233,218],np.float32)
def smooth_noise(scale):
    h,w=H//scale+2,W//scale+2
    n=rng.standard_normal((h,w)).astype(np.float32)
    im=Image.fromarray(((n-n.min())/(n.max()-n.min())*255).astype(np.uint8)).resize((W+2*scale,H+2*scale),Image.BICUBIC)
    a=np.asarray(im,np.float32)[scale:scale+H,scale:scale+W]/255-0.5
    return a
m=smooth_noise(240)*0.9+smooth_noise(90)*0.5+smooth_noise(25)*0.25
img=base[None,None,:]*(1+m[...,None]*0.035)
# fibres
fib=Image.new('L',(W,H),0); d=ImageDraw.Draw(fib)
for _ in range(2600):
    x,y=rng.uniform(0,W),rng.uniform(0,H); a=rng.uniform(0,np.pi); L=rng.uniform(8,40)
    pts=[(x,y)]
    for k in range(4):
        a+=rng.normal(0,.35); x+=np.cos(a)*L/4; y+=np.sin(a)*L/4; pts.append((x,y))
    d.line(pts,fill=int(rng.uniform(40,140)),width=1)
fib=np.asarray(fib.filter(ImageFilter.GaussianBlur(.6)),np.float32)/255
sign=np.where(smooth_noise(6)>0,1,-1)
img=img*(1-fib[...,None]*0.035*sign[...,None])
img+=rng.normal(0,1.6,(H,W,1))
yy,xx=np.mgrid[0:H,0:W]; v=((xx-W/2)/(W*0.62))**2+((yy-H/2)/(H*0.62))**2
img*=(1-0.05*np.clip(v,0,1.5))[...,None]
Image.fromarray(np.clip(img,0,255).astype(np.uint8)).save('paper.jpg',quality=95)
