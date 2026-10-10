from faster_whisper import WhisperModel
import os; os.chdir(os.path.dirname(os.path.abspath(__file__)))   # voices/ 相对 demo/
m = WhisperModel("base.en", device="cpu", compute_type="int8")
for v in ['v04', 'v05', 'v07', 'v10', 'v14']:
    segs, _ = m.transcribe(f"voices/{v}.wav", word_timestamps=True)
    print(v, ' '.join(f"{w.word.strip()}@{w.start:.2f}" for s in segs for w in s.words))
