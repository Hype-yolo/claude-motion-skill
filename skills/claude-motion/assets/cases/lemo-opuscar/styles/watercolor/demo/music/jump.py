import librosa, numpy as np, json, os
HERE = os.path.dirname(os.path.abspath(__file__)); os.chdir(HERE)  # 原项目读 ../../photo-film/music/Wildflowers.wav，已复制到本目录
y, sr = librosa.load(os.path.join(HERE, 'Wildflowers.wav'), sr=22050, mono=True)
d=json.load(open('wf_beats.json')); beats=np.array(d['beats'])
hop=512
chroma = librosa.feature.chroma_cqt(y=y, sr=sr, hop_length=hop)
mf = librosa.feature.mfcc(y=y, sr=sr, hop_length=hop, n_mfcc=20)
bf = librosa.time_to_frames(beats, sr=sr, hop_length=hop)
C = librosa.util.sync(chroma, bf, aggregate=np.median)[:,1:]; C=C/(np.linalg.norm(C,axis=0)+1e-9)
M = librosa.util.sync(mf, bf)[:,1:]; M=(M-M.mean(1,keepdims=True))/(M.std(1,keepdims=True)+1e-9); M=M/(np.linalg.norm(M,axis=0)+1e-9)
S = C.T@C; T=M.T@M
n=S.shape[0]; W=8
def sc(a,b):
    return np.mean([S[a+k,b+k] for k in range(-W,W)]), np.mean([T[a+k,b+k] for k in range(-W,W)])
bt=beats  # beat i starts at beats[i]; S index i ~ beat interval i
cands=[]
for a in range(W, n-W):
    if not (20<bt[a]<110): continue
    for b in range(W, n-W):
        if not (200<bt[b]<292): continue
        if not (100 < bt[a]+322-bt[b] < 128): continue
        s,t=sc(a,b); cands.append((s+0.5*t,s,t,a,b))
cands.sort(reverse=True)
seen=[]
for c in cands:
    tot,s,t,a,b=c
    if any(abs(a-x)<6 and abs(b-yv)<6 for x,yv in seen): continue
    seen.append((a,b)); print(f"a={bt[a]:.2f}s b={bt[b]:.2f}s total={bt[a]+322.0-bt[b]:.1f}s chroma={s:.3f} timbre={t:.3f} beatidx {a} {b} phase {(b-a)%4}")
    if len(seen)>=15: break
