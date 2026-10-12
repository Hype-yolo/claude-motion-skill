"""edge-tts 配音（微软神经语音，中文首选，也能念其它语言）：
    python core/tts/tts_zh.py lines.json out_dir [--voice zh-CN-XiaoxiaoNeural] [--rate +0%] [--pitch +0Hz]
lines.json = [{"id":..., "text":..., "voice":"zh-CN-YunxiNeural", "rate":"+10%", "pitch":"-2Hz", "say":"..."}, ...]
  "say"（可选）= 实际送去朗读的文字，默认同 "text"（数字、缩写要写成读法时用；字幕仍用 text）。
  也认 tts.py 的 "speed"（倍速，1.1 → +10%）。声音列表：python -m edge_tts --list-voices
输出与 tts.py 完全一致：out_dir/<id>.wav（24kHz 单声道，去首尾静音）与 out_dir/dur.json。
  中间的 mp3 缓存在 out_dir/.cache/，文字/声音/语速没变就不再联网（先写 .part 再改名，Ctrl-C 不会留下半个文件被下次当成好的；
  缓存里已经坏了的 mp3 会自动删掉重下）。

需要联网：这是微软的在线语音服务，不是本地模型。用它做的声音能不能商用，请自己看微软的服务条款。
网络不通、被防火墙挡住时报错退出（退出码 2；输入或配置有误是 1）；离线的替代：tts.py 的 "lang":"cmn"（Kokoro，音色一般，用 asr_check.py 校对）。
"""
import sys, io, json, os, re, asyncio, hashlib, subprocess, argparse
import numpy as np, soundfile as sf
SR = 24000


def rate_of(L, default):
    r = L.get('rate')
    if r is None and 'speed' in L: r = float(L['speed'])
    if isinstance(r, (int, float)): r = f'{round((float(r) - 1) * 100):+d}%'   # 数字当倍速
    return r or default


async def synth(text, voice, rate, pitch, path):
    """下载到 path：先写 path.part，成功了才改名，所以 path 存在就一定是完整的（任何中断，包括 Ctrl-C，都不会留下半个文件）"""
    import edge_tts
    part = path + '.part'
    last = None
    try:
        for attempt in range(3):   # 偶发的网络抖动重试两次
            try:
                await edge_tts.Communicate(text, voice, rate=rate, pitch=pitch).save(part)
                if os.path.getsize(part) == 0: raise OSError('the service returned an empty file')
                os.replace(part, path); return
            except Exception as e:
                last = e
                if type(e).__name__ == 'NoAudioReceived': break   # 声音名/文字不对，重试没用
                await asyncio.sleep(1.5 * (attempt + 1))
        raise last
    finally:
        if os.path.exists(part): os.remove(part)   # 失败、Ctrl-C 都清掉


def to_wav(mp3):
    """解码成 24 kHz 单声道；文件坏了返回 None（调用者删掉缓存重下）"""
    try:
        r = subprocess.run(['ffmpeg', '-y', '-loglevel', 'error', '-i', mp3, '-ar', str(SR), '-ac', '1', '-f', 'wav', '-'], capture_output=True, check=True)
    except FileNotFoundError: sys.exit('tts_zh.py: ffmpeg is needed to decode the audio (install it and make sure it is on PATH)')
    except subprocess.CalledProcessError: return None
    try: a, sr = sf.read(io.BytesIO(r.stdout), dtype='float32')
    except Exception: return None
    return (a, sr) if len(a) else None


def plausible(decoded):
    """缓存里的 mp3 解出来要像一句话：至少 0.15 秒且不是静音（半截文件常常"解码成功"但只剩一小段静音）"""
    if decoded is None: return False
    a, sr = decoded; return len(a) >= 0.15 * sr and float(np.abs(a).max()) > 1e-3


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument('lines'); ap.add_argument('out_dir')
    ap.add_argument('--voice', default='zh-CN-XiaoxiaoNeural'); ap.add_argument('--rate', default='+0%'); ap.add_argument('--pitch', default='+0Hz')
    a = ap.parse_args()
    lines = json.load(open(a.lines, encoding='utf-8'))
    for L in lines:
        r, p = rate_of(L, a.rate), L.get('pitch', a.pitch)
        if not re.fullmatch(r'[+-]\d+%', r): sys.exit(f"tts_zh.py: line '{L['id']}': rate must look like '+10%' or '-5%' (or a speed number like 1.1), got {r!r}")
        if not re.fullmatch(r'[+-]\d+Hz', p): sys.exit(f"tts_zh.py: line '{L['id']}': pitch must look like '-2Hz' or '+0Hz', got {p!r}")
    try: import edge_tts  # noqa: F401
    except ImportError: sys.exit('tts_zh.py: edge-tts is missing: install the voice tier: sh plugin/skills/lemo-opuscar/scripts/setup.sh deps voice')
    os.makedirs(os.path.join(a.out_dir, '.cache'), exist_ok=True); dur = {}
    for n in os.listdir(os.path.join(a.out_dir, '.cache')):
        if n.endswith('.part'): os.remove(os.path.join(a.out_dir, '.cache', n))   # 上次被打断留下的半成品
    for L in lines:
        voice, rate, pitch, say = L.get('voice', a.voice), rate_of(L, a.rate), L.get('pitch', a.pitch), L.get('say', L['text'])
        key = hashlib.sha1(json.dumps([voice, rate, pitch, say], ensure_ascii=False).encode('utf-8')).hexdigest()[:16]
        mp3 = os.path.join(a.out_dir, '.cache', key + '.mp3')
        decoded = to_wav(mp3) if os.path.exists(mp3) else None
        if not plausible(decoded): decoded = None
        if decoded is None and os.path.exists(mp3): os.remove(mp3); print(f"tts_zh.py: cached audio for line '{L['id']}' was damaged; fetching it again", file=sys.stderr)
        if decoded is None:
            try: asyncio.run(synth(say, voice, rate, pitch, mp3))
            except Exception as e:
                if type(e).__name__ == 'NoAudioReceived':
                    sys.exit(f"tts_zh.py: no audio came back for line '{L['id']}'. Is the voice name '{voice}' valid (python -m edge_tts --list-voices) and the text speakable?")
                if isinstance(e, ValueError):   # 参数本身不对（比如声音名不存在），根本没发请求
                    sys.exit(f"tts_zh.py: line '{L['id']}': {e}  (voices: python -m edge_tts --list-voices)")
                print(f"tts_zh.py: could not reach Microsoft's speech service for line '{L['id']}': {type(e).__name__}: {str(e)[:200]}\n"
                      "  edge-tts needs a network connection (and can be blocked by a firewall/proxy). Offline alternative: tts.py with \"lang\": \"cmn\".", file=sys.stderr)
                sys.exit(2)   # 退出码 2 = 网络问题；1 = 输入/配置有误
            decoded = to_wav(mp3)
            if decoded is None: sys.exit(f"tts_zh.py: the audio Microsoft returned for line '{L['id']}' could not be decoded (ffmpeg); try again")
        y, sr = decoded
        nz = np.where(np.abs(y) > (np.abs(y).max() if len(y) else 0) * .02)[0]
        if len(nz): y = y[max(0, nz[0] - int(.03 * sr)): nz[-1] + int(.10 * sr)]   # 去首尾静音；尾巴留长一点，免得吃掉句尾的余音
        else: print('warning: line', L['id'], 'is silent', file=sys.stderr)
        sf.write(os.path.join(a.out_dir, L['id'] + '.wav'), y, sr); dur[L['id']] = round(len(y) / sr, 3)
        print(L['id'], dur[L['id']], L['text'])
    json.dump(dur, open(os.path.join(a.out_dir, 'dur.json'), 'w', encoding='utf-8'), indent=1)


if __name__ == '__main__':
    main()
