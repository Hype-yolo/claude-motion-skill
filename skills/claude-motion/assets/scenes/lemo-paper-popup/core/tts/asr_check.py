"""whisper 逐句校对：python core/tts/asr_check.py lines.json voices_dir [--lang en|zh|auto] [--model base|small|…] [--threshold 0.92]
逐句对比原文与转写：前后补 0.6s 静音再转写（短句不补容易听错），输出逐词时间戳 voices_dir/words.json（口型、断句用）。
lines.json 里可加 "asr" 字段覆盖期望文本（专有名词、拟声词、数字的读法，例如 "三十八" 而不是 "38"）。
--lang  auto（默认）按文本里有没有汉字判断；en 要求去掉标点和大小写后逐词完全一致（0–999 的数字两边都换成读法，所以
        "forty" 和 "40" 算一样；更大的数、年份、序数 3rd、带标点的数（3.5、1:30、1,000、40%）不换，期望的转写写进 "asr" 字段）；zh（也可用 ja / ko）按字符相似度，
        去标点、全半角、汉字数字变阿拉伯数字后 difflib 相似度 ≥ --threshold（默认 0.92）算通过。
模型：--model（或环境变量 WHISPER_MODEL；模型名，或本地目录，离线可用）；默认 en → base.en，其它语言 → base（多语言）。
      base 把某句听错、而你听着没错时，换 --model small 再查（更准，约 480 MB，慢几倍）。
      首次运行会从 Hugging Face 下载（base / base.en ≈ 145 MB）；防火墙后面：HF_ENDPOINT=https://hf-mirror.com，
      或者事先下好，再 --model /path/to/model-dir。
退出码：0 全部通过；1 有不一致；2 检查没能运行（模型加载失败等）。
"""
import sys, json, re, os, argparse, difflib, unicodedata

CJK = re.compile('[㐀-鿿豈-﫿぀-ヿ가-힯]')
CHAR_LANGS = {'zh', 'ja', 'ko'}           # 这些语言按字符比，其余按词比
_DIGITS = str.maketrans('零〇一二三四五六七八九', '00123456789')


_ONES = 'zero one two three four five six seven eight nine ten eleven twelve thirteen fourteen fifteen sixteen seventeen eighteen nineteen'.split()
_TENS = 'x x twenty thirty forty fifty sixty seventy eighty ninety'.split()


def num_words(n):
    """0–999 → 英文读法的词列表：40 → ['forty']，105 → ['one', 'hundred', 'five']"""
    out = []
    if n >= 100: out += [_ONES[n // 100], 'hundred']; n %= 100
    if n >= 20: out.append(_TENS[n // 10]); n %= 10
    if n or not out: out.append(_ONES[n])   # 整百（100、200…）不再补 zero；0 本身要读 zero
    return out


_SENTENCE_PUNCT = '.,;:!?"()[]{}\u2026\u201c\u201d\u2018\u2019'   # 词两头的标点（句号、逗号、括号…）；百分号不在其内


def _is_formatted_number(raw):
    """数字之间带标点的写法：小数 3.5、时间 1:30、日期 12/25、千分位 1,000，以及带百分号的 40%。
    去掉标点后它们会和另一个数长得一样（3.5 → 35），所以不能转成读法。"""
    core = raw.strip(_SENTENCE_PUNCT)
    return bool(re.search(r'\d[.,:/]\d', core) or ('%' in core and re.search(r'\d', core)))


def norm_en(s):
    """英文比较用的词表：小写、去标点；0–999 的整数（whisper 常把 forty 写成 40）换成读法，"hundred and" 的 and 不计。
    保持原样（只去标点，不换成读法）的：更大的数、年份、序数（3rd）、以及带标点的数（小数 3.5、时间 1:30、千分位 1,000、百分数 40%）——
    否则 3.5 会变成 35、和 "thirty five" 混淆。它们的读法请在 lines.json 的 asr 字段里写出期望的转写。"""
    out = []
    for raw in s.lower().replace("'", '').replace('-', ' ').split():
        w = re.sub(r"[^a-z0-9]", '', raw)
        if not w: continue
        if re.fullmatch(r'0|[1-9]\d{0,2}', w) and not _is_formatted_number(raw): out += num_words(int(w))
        elif w == 'and' and out and out[-1] == 'hundred': pass
        else: out.append(w)
    return out


def norm_zh(s):
    s = unicodedata.normalize('NFKC', s).lower().translate(_DIGITS)   # NFKC：全角→半角、兼容字形归一
    return ''.join(c for c in s if unicodedata.category(c)[0] in 'LN')   # 只留字母/汉字/数字，标点空白全去掉


def detect_lang(texts):
    cjk = sum(len(CJK.findall(t)) for t in texts); latin = sum(len(re.findall('[A-Za-z]', t)) for t in texts)
    return 'zh' if cjk and cjk >= 0.3 * (cjk + latin) else 'en'


def compare(want, got, lang, threshold=0.92):
    """返回 (是否通过, 相似度 0..1)"""
    if lang in CHAR_LANGS:
        a, b = norm_zh(want), norm_zh(got)
        r = difflib.SequenceMatcher(None, a, b).ratio() if (a or b) else 1.0
        return r >= threshold, r
    a, b = norm_en(want), norm_en(got)
    return a == b, 1.0 if a == b else difflib.SequenceMatcher(None, a, b).ratio()


def load_model(name):
    try: from faster_whisper import WhisperModel
    except ImportError: sys.exit('asr_check.py: faster-whisper is missing: install the voice tier: sh plugin/skills/lemo-opuscar/scripts/setup.sh deps voice')
    try:
        return WhisperModel(name, device='cpu', compute_type='int8')
    except Exception as e:
        msg = f'{type(e).__name__}: {e}'
        print(f"asr_check.py: cannot load the whisper model '{name}'.\n  {msg[:300]}", file=sys.stderr)
        if not os.path.isdir(name):
            print("  The model is downloaded from huggingface.co on first use. If that site is blocked or you are offline:\n"
                  "    set HF_ENDPOINT=https://hf-mirror.com (a mirror), or download the model once and pass --model /path/to/model-dir", file=sys.stderr)
        sys.exit(2)


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument('lines'); ap.add_argument('voices_dir')
    ap.add_argument('--lang', default='auto'); ap.add_argument('--model'); ap.add_argument('--threshold', type=float, default=0.92)
    a = ap.parse_args()
    lines = json.load(open(a.lines, encoding='utf-8'))
    want = {L['id']: L.get('asr', L['text']) for L in lines}
    lang = detect_lang(list(want.values())) if a.lang == 'auto' else a.lang
    name = a.model or os.environ.get('WHISPER_MODEL') or ('base.en' if lang == 'en' else 'base')
    if lang != 'en' and os.path.basename(name.rstrip('/')).endswith('.en'):
        print(f"asr_check.py: model '{name}' is English-only but the lines are '{lang}'. Use a multilingual model (e.g. --model base or --model small).", file=sys.stderr); sys.exit(2)
    import numpy as np, soundfile as sf, soxr
    m = load_model(name)
    bad, words = 0, {}
    for L in lines:
        y, sr = sf.read(os.path.join(a.voices_dir, L['id'] + '.wav'))
        if y.ndim > 1: y = y.mean(1)
        y = soxr.resample(y, sr, 16000, quality='HQ'); pad = np.zeros(int(.6 * 16000))   # 与 librosa 默认的 soxr_hq 相同
        kw = dict(initial_prompt='以下是普通话的句子。') if lang == 'zh' else {}          # 提示成简体，避免转写出繁体
        segs, _ = m.transcribe(np.concatenate([pad, y, pad]).astype(np.float32), beam_size=5, language=lang, word_timestamps=True, **kw)
        tail = (len(y) + len(pad)) / 16000 - .5   # Whisper sometimes repeats the line inside the trailing pad: drop such no-speech segments
        segs = [s for s in segs if not (s.no_speech_prob > .5 and s.start > tail)]; got = ' '.join(s.text.strip() for s in segs)
        words[L['id']] = [(w.word.strip(), round(w.start - .6, 3), round(w.end - .6, 3)) for s in segs for w in s.words]
        ok, r = compare(want[L['id']], got, lang, a.threshold); bad += not ok
        print(('OK  ' if ok else 'DIFF'), L['id'], '|', want[L['id']], '→', got, ('' if ok or lang == 'en' else f'   (similarity {r:.2f} < {a.threshold})'))
    json.dump(words, open(os.path.join(a.voices_dir, 'words.json'), 'w', encoding='utf-8'), indent=0, ensure_ascii=False)
    print('mismatches:', bad, f'(lang={lang}, model={name})')
    sys.exit(1 if bad else 0)


if __name__ == '__main__':
    main()
