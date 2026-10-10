# whisper 回听：逐条转写 voices/v*.wav，和 tts/lines.json 对照（VOICES=dir 可改目录）
from faster_whisper import WhisperModel
import glob, os
D = os.path.abspath(os.environ.get('VOICES', os.path.join(os.path.dirname(os.path.abspath(__file__)), 'voices')))
m = WhisperModel("base.en", device="cpu", compute_type="int8")
for f in sorted(glob.glob(f"{D}/v*.wav")):
    segs, _ = m.transcribe(f, beam_size=5)
    print(f[-7:-4], " ".join(s.text.strip() for s in segs))
