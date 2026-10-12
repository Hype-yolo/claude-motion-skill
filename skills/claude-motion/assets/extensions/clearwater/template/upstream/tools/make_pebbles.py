"""Generate the seamless pebble-bed texture used by Clearwater (1024x1024, tiles on a torus).
Every stone is procedural: packed ellipses with irregular outlines, muted mineral colours,
speckle, the odd quartz vein, and baked sunlight with soft shadows and occlusion.
Usage: python3 make_pebbles.py  ->  pebbles.png / pebbles.jpg  (needs numpy, scipy, pillow)
To embed: base64 the JPEG into the <script id="pebbles-texture"> block at the end of index.html."""
import numpy as np
from PIL import Image
from scipy.ndimage import gaussian_filter
rng=np.random.default_rng(11)
S=1024           # tile = 0.62 m
H=np.full((S,S),-1.0,np.float32)   # height
ID=np.full((S,S),-1,np.int32)
# --- dart-throwing packing on a torus, big to small ---
stones=[]
def pack(layer, sizes, overlap, zbase):
    placed=[]
    def ok(x,y,r):
        for (sx,sy,sr) in placed:
            dx=abs(x-sx); dx=min(dx,S-dx); dy=abs(y-sy); dy=min(dy,S-dy)
            if dx*dx+dy*dy < (overlap*(r+sr))**2: return False
        return True
    for rmax,tries in sizes:
        for _ in range(tries):
            r=rmax*rng.uniform(0.72,1.0); x=rng.uniform(0,S); y=rng.uniform(0,S)
            if ok(x,y,r):
                placed.append((x,y,r))
                stones.append((x,y,r,rng.uniform(0.5,0.95),rng.uniform(0,np.pi),zbase+rng.uniform(0,0.08)))
pack(0,[(30,1500),(22,3000),(15,5000),(10,5000)],0.80,-0.35)   # buried bottom layer, fills the gaps
pack(1,[(46,300),(36,900),(28,2500),(21,4000),(15,5000)],0.88,0.0)
print(len(stones))
# palette (sRGB 0..1): greys, blue-greys, beige, tan, a few rusty and white quartz
pal=np.array([[.62,.62,.61],[.50,.51,.53],[.42,.44,.47],[.66,.63,.57],[.58,.53,.45],[.52,.47,.40],
              [.36,.37,.38],[.72,.70,.66],[.47,.43,.39],[.55,.57,.60],[.60,.50,.42],[.82,.80,.76]])
pw=np.array([12,8,6,10,6,4,3,7,3,5,1.5,3]); pw/=pw.sum()
COL=np.zeros((S,S,3),np.float32)
yy,xx=np.mgrid[0:S,0:S]
for i,(x,y,r,asp,ang,z) in enumerate(stones):
    a=r*1.12; b=a*asp
    R=int(a+3)
    xs=np.arange(int(x)-R,int(x)+R+1); ys=np.arange(int(y)-R,int(y)+R+1)
    X,Y=np.meshgrid(xs,ys)
    dx=X-x; dy=Y-y
    c,s=np.cos(ang),np.sin(ang)
    u=(dx*c+dy*s)/a; v=(-dx*s+dy*c)/b
    th=np.arctan2(v,u); p=2.0+rng.uniform(-0.3,0.9)
    lob=1+0.07*np.sin(2*th+rng.uniform(0,6.3))+0.05*np.sin(3*th+rng.uniform(0,6.3))+0.03*np.sin(5*th+rng.uniform(0,6.3))
    d2=((np.abs(u)**p+np.abs(v)**p)**(2/p))/lob**2
    m=d2<1
    # rounded but flattened dome, slightly irregular outline
    h=np.sqrt(np.clip(1-d2,0,1))**0.65*(0.55+0.45*asp)*r/40 + z*0.05
    Xw=X%S; Yw=Y%S
    cur=H[Yw,Xw]
    upd=m&(h>cur)
    H[Yw[upd],Xw[upd]]=h[upd]; ID[Yw[upd],Xw[upd]]=i
# per-stone colour + texture
ns=len(stones)
cidx=rng.choice(len(pal),ns,p=pw)
base=pal[cidx]*rng.uniform(0.88,1.1,(ns,1))
base=np.clip(base+rng.normal(0,0.008,(ns,3)),0,1)
lum=base.mean(1,keepdims=True); base=lum+(base-lum)*0.8
gap=ID<0
col=base[np.clip(ID,0,None)]
# stone surface: fine speckle + soft mottling + occasional quartz veins
def tnoise(sig,amp):
    n=rng.normal(0,1,(S,S)).astype(np.float32); n=gaussian_filter(n,sig,mode='wrap'); return n/n.std()*amp
speck=tnoise(0.6,0.045)+tnoise(1.8,0.035)+tnoise(7,0.05)+tnoise(20,0.04)
col=col*(1+speck[...,None])
vein_stones=rng.random(ns)<0.06
vang=rng.uniform(0,np.pi,ns); voff=rng.uniform(0,6.28,ns)
sid=np.clip(ID,0,None)
proj=xx*np.cos(vang[sid])+yy*np.sin(vang[sid])
cx=np.array([st[0]*np.cos(a)+st[1]*np.sin(a) for st,a in zip(stones,vang)])
vein=(np.abs(proj-cx[sid]-(voff[sid]-3.1)*3.0)<2.0)&vein_stones[sid]&~gap
col[vein]=col[vein]*0.55+np.array([.85,.84,.80])*0.45
# gaps: coarse sand/grit, dark
grit=0.22+0.05*tnoise(1.0,1)+0.04*tnoise(4,1)
col[gap]=np.stack([grit*1.05,grit,grit*0.9],-1)[gap]
# shading from height (baked sun from upper-left, like a photo) + ambient occlusion
Hs=np.where(gap,-0.15,H)
Hs=gaussian_filter(Hs,0.8,mode='wrap')
gy,gx=np.gradient(Hs)
k=14.0
nx,ny,nz=-gx*k,-gy*k,np.ones_like(gx)
nl=np.sqrt(nx*nx+ny*ny+nz*nz); nx/=nl; ny/=nl; nz/=nl
L=np.array([-0.45,-0.55,0.70]); L/=np.linalg.norm(L)
diff=np.clip(nx*L[0]+ny*L[1]+nz*L[2],0,1)
ao=np.clip(0.55+ (Hs-gaussian_filter(Hs,14,mode='wrap'))*2.2,0.25,1.15)
# cast-shadow-ish: height compared to height shifted toward the light
sh=np.roll(np.roll(Hs,6,0),5,1)
sh2=np.roll(np.roll(Hs,11,0),9,1)
shadow=np.clip(1-np.maximum(sh-Hs,(sh2-Hs)*0.7)*4.0,0.35,1)
spec=np.clip(nx*0.2+ny*0.3+nz*0.93,0,1)**40*0.08
shade=(0.28+1.0*diff)*ao*shadow
img=col*shade[...,None]+spec[...,None]
img=np.clip(img*1.32,0,1)
Image.fromarray((img*255).astype(np.uint8)).save('pebbles.png')
im=Image.fromarray((img*255).astype(np.uint8)); im.save('pebbles.jpg',quality=86)
