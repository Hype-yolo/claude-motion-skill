import librosa, numpy as np
y, sr = librosa.load('Jaunty_Gumption.wav', sr=22050, mono=True)
beats = np.load('jg_beats.npy'); hop = 512
bf0 = librosa.time_to_frames(beats, sr=sr, hop_length=hop)
chroma = librosa.feature.chroma_cqt(y=y, sr=sr, hop_length=hop)
mf = librosa.feature.mfcc(y=y, sr=sr, hop_length=hop, n_mfcc=20)
C = librosa.util.sync(chroma, bf0, aggregate=np.median)[:, 1:]; C = C / (np.linalg.norm(C, axis=0) + 1e-9)
M = librosa.util.sync(mf, bf0)[:, 1:]; M = (M - M.mean(1, keepdims=True)) / (M.std(1, keepdims=True) + 1e-9); M = M / (np.linalg.norm(M, axis=0) + 1e-9)
S = C.T @ C; T = M.T @ M; n = S.shape[0]; W = 8
endt = 118.4
out = []
for a in range(W, n - W):
    for b in range(a + 16, n - W):
        if (b - a) % 4: continue
        tot = beats[a] + (endt - beats[b])
        if not (87.8 < tot < 90.8): continue
        s = np.mean([S[a + k, b + k] for k in range(-W, W)]); t = np.mean([T[a + k, b + k] for k in range(-W, W)])
        out.append((s + .5 * t, s, t, a, b, tot))
out.sort(reverse=True)
for c in out[:10]: print(f"a={beats[c[3]]:.2f} b={beats[c[4]]:.2f} tot={c[5]:.2f} chroma={c[1]:.3f} timbre={c[2]:.3f} beats={c[4]-c[3]}")
# 整曲的自相似：看段落结构
import matplotlib; matplotlib.use('Agg'); import matplotlib.pyplot as plt
plt.figure(figsize=(8, 8)); plt.imshow(S + .5 * T, origin='lower', extent=[beats[1], beats[-1], beats[1], beats[-1]]); plt.colorbar(); plt.savefig('jg_ssm.png', dpi=70)
