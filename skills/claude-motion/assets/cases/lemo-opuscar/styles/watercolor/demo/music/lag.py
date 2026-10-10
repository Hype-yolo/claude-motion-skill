import librosa, numpy as np, json, os
HERE = os.path.dirname(os.path.abspath(__file__)); os.chdir(HERE)  # 原项目读 ../../photo-film/music/Wildflowers.wav，已复制到本目录
y, sr = librosa.load(os.path.join(HERE, 'Wildflowers.wav'), sr=22050, mono=True)
d=json.load(open('wf_beats.json')); beats=np.array(d['beats'])
hop=512
chroma = librosa.feature.chroma_cqt(y=y, sr=sr, hop_length=hop)
mfcc = librosa.feature.mfcc(y=y, sr=sr, hop_length=hop, n_mfcc=13)
bf = librosa.time_to_frames(beats, sr=sr, hop_length=hop)
C = librosa.util.sync(chroma, bf, aggregate=np.median)[:,1:]
C = C/(np.linalg.norm(C,axis=0)+1e-9)
S = C.T@C; n=S.shape[0]
print('n beats',n, 'beat period', np.median(np.diff(beats)))
# best lag per beat position in final section: for each lag, mean diagonal similarity over windows
res=[]
for lag in range(40, n-20):
    dg=np.array([S[i,i+lag] for i in range(n-lag)])
    res.append((dg.mean(),lag))
res.sort(reverse=True)
for m,l in res[:12]: print('lag beats',l,'sec',round(l*0.5805,1),'meansim',round(m,3))
# for lag around 210s: windowed similarity (16-beat window) vs start position
for L in [l for _,l in res[:4]]:
    dg=np.array([S[i,i+L] for i in range(n-L)])
    w=np.convolve(dg,np.ones(16)/16,'valid')
    print('L',L, ' '.join(f"{beats[i+1]:.0f}:{w[i]:.2f}" for i in range(0,len(w),8)))
