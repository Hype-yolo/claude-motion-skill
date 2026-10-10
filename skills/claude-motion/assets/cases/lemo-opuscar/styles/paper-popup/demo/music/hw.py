import librosa, numpy as np
for f in ['Heartwarming.wav', 'Dreamy_Flashback.wav']:
    y, sr = librosa.load(f, sr=22050, mono=True)
    rms = librosa.feature.rms(y=y, hop_length=512)[0]; db = 20*np.log10(rms+1e-6); tt = librosa.frames_to_time(np.arange(len(db)), sr=sr, hop_length=512)
    end = tt[np.where(db > db.max()-35)[0][-1]]
    on = librosa.onset.onset_detect(y=y, sr=sr, units='time', backtrack=True)
    st = librosa.onset.onset_strength(y=y, sr=sr)
    tempo, b = librosa.beat.beat_track(y=y, sr=sr, units='time')
    print(f, 'len', len(y)/sr, 'end', round(end,2), 'tempo', tempo)
    # 每秒响度
    print(' db/s', ' '.join(f"{int(t)}:{db[(tt>=t)&(tt<t+1)].mean():.0f}" for t in range(0, int(len(y)/sr), 2)))
    # 候选起点：end-27.7 附近的强起音
    tgt = end - 27.7
    near = [o for o in on if abs(o - tgt) < 4]
    print(' onsets near', round(tgt,2), [round(o,2) for o in near])
