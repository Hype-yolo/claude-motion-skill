import librosa, numpy as np
y, sr = librosa.load('Jaunty_Gumption.wav', sr=22050, mono=True)
L = len(y) / sr
tempo, bf0 = librosa.beat.beat_track(y=y, sr=sr, hop_length=512, start_bpm=144, tightness=200)
beats = librosa.frames_to_time(bf0, sr=sr, hop_length=512)
print('len', L, 'tempo', tempo, 'nbeats', len(beats), 'first', beats[:6])
hop = 512
chroma = librosa.feature.chroma_cqt(y=y, sr=sr, hop_length=hop)
mf = librosa.feature.mfcc(y=y, sr=sr, hop_length=hop, n_mfcc=20)
C = librosa.util.sync(chroma, bf0, aggregate=np.median)[:, 1:]; C = C / (np.linalg.norm(C, axis=0) + 1e-9)
M = librosa.util.sync(mf, bf0)[:, 1:]; M = (M - M.mean(1, keepdims=True)) / (M.std(1, keepdims=True) + 1e-9); M = M / (np.linalg.norm(M, axis=0) + 1e-9)
S = C.T @ C; T = M.T @ M; n = S.shape[0]; W = 8
rms = librosa.feature.rms(y=y, hop_length=hop)[0]
# 音乐结尾（最后一个响度>阈值的点）
db = 20*np.log10(rms+1e-6); endt = librosa.frames_to_time(np.where(db > db.max()-30)[0][-1], sr=sr, hop_length=hop)
print('music end ~', endt)
TARGET = 104.28 - 15.0   # 需要的时长（开头到结尾）
cands = []
for a in range(W, n - W):
    for b in range(a + 16, n - W):
        tot = beats[a] + (endt - beats[b])
        if abs(tot - TARGET) > .35: continue
        s = np.mean([S[a + k, b + k] for k in range(-W, W)]); t = np.mean([T[a + k, b + k] for k in range(-W, W)])
        cands.append((s + .5 * t, s, t, a, b, tot))
cands.sort(reverse=True)
for c in cands[:12]: print(f"a={beats[c[3]]:.2f} b={beats[c[4]]:.2f} tot={c[5]:.2f} chroma={c[1]:.3f} timbre={c[2]:.3f} phase={(c[4]-c[3])%4}")
np.save('jg_beats.npy', beats)
