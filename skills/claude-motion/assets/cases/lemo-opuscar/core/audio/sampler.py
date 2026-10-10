"""采样乐器（numpy/soxr 离线）：按名加载 CC0/CC-BY 真实乐器采样，自动移调/力度层/轮换/延音循环。
所有 note/hit 返回单声道 float32 @ SR；render 返回立体声 (N,2)。用法见 INSTRUMENTS.md。

    from core.audio import sampler as S
    x = S.note('cellos', 'D3', 2.0, vel=.7)            # 大提琴组长音 2 秒（不够长自动交叉淡化延长）
    y = S.hit('snare', 'roll', .6)                       # 无音高打击
    mix = S.render([(0, 'piano', 'C4', 1, .7, -.2), (0, 'violins', 'E5', 4, .6, .3)], 6)
"""
import os, re, json, math, glob, threading
from collections import OrderedDict
import numpy as np
import soundfile as sf
import soxr
from scipy.signal import butter, sosfilt, fftconvolve
from scipy.ndimage import uniform_filter1d

try:
    from .sfx import SR, add, limit
except ImportError:  # 直接 import sampler 时
    from sfx import SR, add, limit

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'instruments')
INDEX = os.path.join(ROOT, 'index.json')
_rng = np.random.default_rng(20260925)
_lock = threading.RLock()


def seed(n):
    """重设轮换/随机种子（同样的调用顺序 → 同样的结果）"""
    global _rng; _rng = np.random.default_rng(n)


# —— 音高 ——
_PC = {'C': 0, 'D': 2, 'E': 4, 'F': 5, 'G': 7, 'A': 9, 'B': 11}


def midi(p):
    """'C#4' / 'Db3' / 'Bb-1' / 61 / 61.5 → midi（C4=60，允许小数=微分音）"""
    if isinstance(p, (int, float, np.integer, np.floating)): return float(p)
    m = re.fullmatch(r'\s*([A-Ga-g])([#sb♯♭]*)(-?\d+)\s*', str(p))
    if not m: raise ValueError(f'无法解析音高 {p!r}')
    acc = m.group(2).count('#') + m.group(2).count('s') + m.group(2).count('♯') - m.group(2).count('b') - m.group(2).count('♭')
    return float(12 * (int(m.group(3)) + 1) + _PC[m.group(1).upper()] + acc)


def hz(p): return 440.0 * 2 ** ((midi(p) - 69) / 12)


def name(m):
    m = int(round(m)); return ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'][m % 12] + str(m // 12 - 1)


# —— 乐器注册表 ——
# src: 相对 instruments/ 的目录（或 (目录, 文件名正则)）；kind: sus=可延长长音 / dec=自然衰减（dur 到了就按 rel 止音）/ hit=无音高
# pp: 音高解析 upper(文件名 C#4) | lower(karoryfer 小写 ab2) | sal | organ | detect(无名字，用 yin 测) | sfz
# rel: 默认释放时间(s)；var: 无音高/多鼓的变体 {名: 文件名正则}；lic: 授权键（见 LIC）
V, C, F, K, SAL = 'vsco2ce/', 'vcsl/', 'freepats/', 'karoryfer/', 'salamander/'
VI, VM = C + 'Idiophones/Struck Idiophones/', C + 'Membranophones/Struck Membranophones/'
REG = {
    # 弦乐
    'violins':        dict(src=V + 'Strings/Violin Section/susVib', kind='sus', rel=.35, fam='弦乐', desc='小提琴组 长音（揉弦）'),
    'violins_trem':   dict(src=V + 'Strings/Violin Section/Trem', kind='sus', rel=.3, fam='弦乐', desc='小提琴组 震音'),
    'violins_pizz':   dict(src=V + 'Strings/Violin Section/Pizz', kind='dec', rel=.15, fam='弦乐', desc='小提琴组 拨奏'),
    'violins_spic':   dict(src=V + 'Strings/Violin Section/Spic', kind='dec', rel=.1, fam='弦乐', desc='小提琴组 跳弓（短音）'),
    'violin':         dict(src=V + 'Strings/Solo Violin/Arco Vib', kind='sus', rel=.3, fam='弦乐', desc='独奏小提琴 长音'),
    'violin_pizz':    dict(src=V + 'Strings/Solo Violin/Pizz', kind='dec', rel=.15, fam='弦乐', desc='独奏小提琴 拨奏'),
    'violas':         dict(src=V + 'Strings/Viola Section/susvib', kind='sus', rel=.35, fam='弦乐', desc='中提琴组 长音'),
    'violas_pizz':    dict(src=V + 'Strings/Viola Section/pizz', kind='dec', rel=.15, fam='弦乐', desc='中提琴组 拨奏'),
    'cellos':         dict(src=V + 'Strings/Cello Section/susvib', kind='sus', rel=.4, fam='弦乐', desc='大提琴组 长音'),
    'cellos_pizz':    dict(src=V + 'Strings/Cello Section/pizzT', kind='dec', rel=.2, fam='弦乐', desc='大提琴组 拨奏'),
    'cellos_spic':    dict(src=V + 'Strings/Cello Section/spic', kind='dec', rel=.12, fam='弦乐', desc='大提琴组 跳弓'),
    'contrabass':     dict(src=V + 'Strings/Solo Contrabass/SusVib', kind='sus', rel=.4, fam='弦乐', desc='低音提琴 长音'),
    'contrabass_pizz': dict(src=V + 'Strings/Solo Contrabass/Pizz', kind='dec', rel=.2, fam='弦乐', desc='低音提琴 古典拨奏'),
    'harp':           dict(src=C + 'Chordophones/Composite Chordophones/Concert Harp', kind='dec', rel=1.2, fam='弦乐', desc='竖琴'),
    # 木管
    'flute':          dict(src=V + 'Woodwinds/Flute/susvib', kind='sus', rel=.25, fam='木管', desc='长笛 长音'),
    'flute_stac':     dict(src=V + 'Woodwinds/Flute/stac', kind='dec', rel=.1, fam='木管', desc='长笛 断奏'),
    'piccolo':        dict(src=V + 'Woodwinds/Piccolo/Sus', kind='sus', rel=.2, fam='木管', desc='短笛'),
    'clarinet':       dict(src=V + 'Woodwinds/Clarinet/susLong', kind='sus', rel=.25, fam='木管', desc='单簧管 长音'),
    'clarinet_stac':  dict(src=V + 'Woodwinds/Clarinet/stac', kind='dec', rel=.1, fam='木管', desc='单簧管 断奏'),
    'oboe':           dict(src=V + 'Woodwinds/Oboe/Vib', kind='sus', rel=.25, fam='木管', desc='双簧管 长音'),
    'oboe_stac':      dict(src=V + 'Woodwinds/Oboe/Stacc', kind='dec', rel=.1, fam='木管', desc='双簧管 断奏'),
    'bassoon':        dict(src=V + 'Woodwinds/Bassoon/sus', kind='sus', rel=.25, fam='木管', desc='巴松 长音'),
    'bassoon_stac':   dict(src=V + 'Woodwinds/Bassoon/stac', kind='dec', rel=.1, fam='木管', desc='巴松 断奏'),
    'recorder':       dict(src=C + 'Aerophones/Edge-blown Aerophones/Baroque Alto Recorder/Sustain', kind='sus', rel=.15, fam='木管', desc='中音竖笛（巴洛克）'),
    'ocarina':        dict(src=(C + 'Aerophones/Edge-blown Aerophones/Ocarina, Typical/Sustains', r'_Sus_'), kind='sus', rel=.15, fam='木管', desc='陶笛'),
    'tenor_sax':      dict(src=C + 'Aerophones/Reed Aerophones/Tenor Saxophone/Vibrato', kind='sus', rel=.2, fam='木管', desc='次中音萨克斯 揉音'),
    'tenor_sax_nv':   dict(src=C + 'Aerophones/Reed Aerophones/Tenor Saxophone/Non-Vibrato', kind='sus', rel=.2, fam='木管', desc='次中音萨克斯 直音'),
    'tenor_sax_stac': dict(src=C + 'Aerophones/Reed Aerophones/Tenor Saxophone/Staccato', kind='dec', rel=.08, fam='木管', desc='次中音萨克斯 断奏'),
    'alto_sax':       dict(src=K + 'weresax/Samples/alto', kind='sus', rel=.2, pp='lower', fam='木管', desc='中音萨克斯（Weresax）'),
    'harmonica':      dict(src=(C + 'Aerophones/Free Aerophones/Harmonica-Hohner-Super64/Sustains', r'_Normal'), kind='sus', rel=.15, fam='木管', desc='半音阶口琴'),
    # 铜管
    'trumpet':        dict(src=V + 'Brass/Trumpet/sus', kind='sus', rel=.25, fam='铜管', desc='小号 长音'),
    'trumpet_stac':   dict(src=V + 'Brass/Trumpet/stac', kind='dec', rel=.1, fam='铜管', desc='小号 断奏'),
    'trumpet_mute':   dict(src=V + 'Brass/Trumpet/straightM-sus', kind='sus', rel=.2, fam='铜管', desc='小号 直弱音器'),
    'horn':           dict(src=V + 'Brass/F Horn/sus', kind='sus', rel=.35, fam='铜管', desc='圆号 长音'),
    'horn_stac':      dict(src=V + 'Brass/F Horn/stac', kind='dec', rel=.12, fam='铜管', desc='圆号 断奏'),
    'trombone':       dict(src=V + 'Brass/Tenor Trombone/sus', kind='sus', rel=.3, fam='铜管', desc='长号 长音'),
    'trombone_stac':  dict(src=V + 'Brass/Tenor Trombone/stac', kind='dec', rel=.12, fam='铜管', desc='长号 断奏'),
    'tuba':           dict(src=V + 'Brass/Tuba/sus', kind='sus', rel=.3, fam='铜管', desc='大号 长音'),
    'tuba_stac':      dict(src=V + 'Brass/Tuba/stac', kind='dec', rel=.12, fam='铜管', desc='大号 断奏'),
    # 有音高打击
    'timpani':        dict(src=V + 'Percussion/Timpani', kind='dec', rel=1.5, pp='detect', fam='打击', desc='定音鼓（5 面鼓；音高=主振动模 (1,1) 频谱实测）',
                           roots={'drum1': 41.47, 'drum2': 46.81, 'drum3': 49.57, 'drum4': 52.5, 'drum5': 54.63},
                           var={f'drum{i}': f'Timpani{i}_' for i in range(1, 6)}),
    'glockenspiel':   dict(src=VI + 'Glockenspiel', kind='dec', rel=1.5, fam='打击', desc='钟琴'),
    'xylophone':      dict(src=VI + 'Xylophone/Medium Mallets', kind='dec', rel=.5, fam='打击', desc='木琴'),
    'marimba':        dict(src=VI + 'Marimba', kind='dec', rel=.8, fam='打击', desc='马林巴'),
    'vibraphone':     dict(src=VI + 'Vibraphone/Soft Mallets', kind='dec', rel=1.5, fam='打击', desc='颤音琴 软槌'),
    'vibraphone_hard': dict(src=VI + 'Vibraphone/Hard Mallets', kind='dec', rel=1.5, fam='打击', desc='颤音琴 硬槌'),
    'vibraphone_bowed': dict(src=VI + 'Vibraphone/Bowed', kind='sus', rel=1.0, fam='打击', desc='颤音琴 弓奏（空灵长音）'),
    'tubular_bells':  dict(src=VI + 'Tubular Bells 1', kind='dec', rel=3.0, retune=False, fam='打击', desc='管钟'),
    'hand_chimes':    dict(src=VI + 'Hand Chimes', kind='dec', rel=2.0, fam='打击', desc='手摇钟（柔和钟声）'),
    'kalimba':        dict(src=F + 'kalimba', kind='dec', rel=1.2, pp='sfz', fam='打击', desc='卡林巴（拇指琴）'),
    'mbira':          dict(src=C + 'Idiophones/Plucked Idiophones/Kalimba, Tanzania', kind='dec', rel=1.2, fam='打击', desc='姆比拉/坦桑尼亚卡林巴（更粗粝；原琴非平均律，已按实测校到平均律）'),
    'hang':           dict(src=F + 'hang', kind='dec', rel=3.0, pp='sfz', fam='打击', desc='手碟 Hang（D 小调，仅原琴音最好听）'),
    'glass':          dict(src=F + 'glass', kind='dec', rel=2.0, pp='sfz', fam='打击', desc='水杯琴'),
    # 键盘
    'piano':          dict(src=SAL + 'samples', kind='dec', rel=.4, pp='sal', fam='键盘', desc='Salamander 三角钢琴（Yamaha C5，5 力度层）', lic='salamander'),
    'upright':        dict(src=V + 'Keys/Upright Nr1', kind='dec', rel=.35, retune=False, fam='键盘', desc='立式钢琴（温暖、略旧）'),
    'honky_tonk':     dict(src=F + 'piano_fb', kind='dec', rel=.4, pp='sfz', fam='键盘', desc='老式自动钢琴（酒馆 honky-tonk 味）'),
    'harpsichord':    dict(src=C + 'Chordophones/Zithers/Harpsichord, Italian/Sustains', kind='dec', rel=.15, fam='键盘', desc='羽管键琴（意大利式）'),
    'organ':          dict(src=(V + 'Keys/Organ/Loud', r'Man3'), kind='sus', rel=.2, pp='organ', oct=0, fam='键盘', desc='管风琴 手键盘全开（含 16\' 音栓，厚重）'),
    'organ_soft':     dict(src=(V + 'Keys/Organ/Quiet', r'Man3'), kind='sus', rel=.2, pp='organ', oct=0, fam='键盘', desc='管风琴 手键盘柔和音栓'),
    'organ_pedal':    dict(src=(V + 'Keys/Organ', r'Pedal'), kind='sus', rel=.3, pp='detect', fam='键盘', desc='管风琴 踏板低音（音高按实测）'),
    'accordion':      dict(src=F + 'accordion', kind='sus', rel=.13, pp='sfz', fam='键盘', desc='按键手风琴'),
    # 拨弦 / 民族
    'guitar_nylon':   dict(src=F + 'spanish_guitar', kind='dec', rel=.3, pp='sfz', fam='拨弦', desc='尼龙弦古典吉他'),
    'ukulele':        dict(src=F + 'ukulele', kind='dec', rel=.3, pp='sfz', fam='拨弦', desc='尤克里里'),
    'electric_guitar': dict(src=F + 'eguitar_clean', kind='dec', rel=.3, pp='sfz', fam='拨弦', desc='清音电吉他'),
    'electric_bass':  dict(src=F + 'finger_bass', kind='dec', rel=.12, pp='sfz', fam='拨弦', desc='电贝斯 指弹'),
    'jazz_bass':      dict(src=K + 'sneakybass/Samples/finger', kind='dec', rel=.15, pp='lower', oct=-12, fam='拨弦', desc='低音提琴 爵士拨弦（Sneakybass）'),
    'strumstick':     dict(src=C + 'Chordophones/Composite Chordophones/Strumstick/Finger', kind='dec', rel=.4, fam='拨弦', desc='Strumstick 民谣扬琴式拨弦（钢弦民谣感）'),
    'dan_tranh':      dict(src=C + 'Chordophones/Zithers/Dan Tranh/Normal', kind='dec', rel=1.0, fam='拨弦', desc='越南筝 Đàn tranh（与古筝同源，可作古筝）'),
    'dan_tranh_trem': dict(src=C + 'Chordophones/Zithers/Dan Tranh/Tremolo', kind='sus', rel=.5, fam='拨弦', desc='越南筝 摇指'),
    'erhu':           dict(src=K + 'erhu/Samples/sus', kind='sus', rel=.25, pp='lower', fam='民族', desc='二胡 长音'),
    'erhu_stac':      dict(src=K + 'erhu/Samples/stac', kind='dec', rel=.1, pp='lower', fam='民族', desc='二胡 短弓'),
    'bagpipe':        dict(src=F + 'bagpipe', kind='sus', rel=.4, pp='sfz', fam='民族', desc='风笛（旋律管；G2/G3 为持续低音管）'),
    # 无音高打击
    'bass_drum':      dict(src=(V + 'Percussion', r'^BDrumNewhit'), kind='hit', fam='打击', desc='音乐会大鼓（7 力度层）'),
    'gran_cassa':     dict(src=VM + 'Bass Drum 2', kind='hit', fam='打击', desc='大鼓 2（含滚奏/渐强）',
                           var={'hit': r'_hit_', 'roll': r'_roll_(pp|mp|mf|ff|f)\.', 'roll_fast': r'_roll_fast_\w+(?<!_rel)\.', 'cresc': r'_cresc_', 'rub': r'_rub'}),
    'snare':          dict(src=(V + 'Percussion', r'^Snare2-'), kind='hit', fam='打击', desc='军鼓（管弦）',
                           var={'on': r'HitSN', 'off': r'HitNS', 'roll': r'rollSN', 'roll_off': r'rollNS'}),
    'snare2':         dict(src=VM + 'Snare Drum, Modern 1', kind='hit', fam='打击', desc='军鼓 2（近拾音）',
                           var={'on': r'HitSN', 'off': r'HitNS', 'roll': r'rollSN', 'stick': r'_stick_', 'taps': r'_taps_'}),
    'toms':           dict(src=(VM, r'Tom [12]/'), kind='hit', fam='打击', desc='通鼓（高/低 × 鼓棒/槌）',
                           var={'high': r'TomH_HitS', 'low': r'TomL_HitS', 'high_mallet': r'TomH_HitM', 'low_mallet': r'TomL_HitM', 'roll': r'Roll'}),
    'crash':          dict(src=(V + 'Percussion', r'^cymbal-crash1'), kind='hit', fam='打击', desc='对镲（管弦）'),
    'clash':          dict(src=VI + 'Clash Cymbals 1', kind='hit', fam='打击', desc='对镲 2', var={'crash': r'crash1_(pp|mp|mf|ff)\d', 'short': r'short'}),
    'sus_cymbal':     dict(src=VI + 'Suspended Cymbal 1', kind='hit', fam='打击', desc='吊镲（软槌/棒/镲帽/滚奏/渐强/弓）',
                           var={'hit': r'_hit_(pp|mp|f|fff)\d', 'stick': r'_hit_stick', 'bell': r'_hit_bell', 'roll': r'_roll_\w+_nloop',
                                'cresc': r'_cresc_', 'bow': r'_bow_', 'scrape': r'_scrape'}),
    'gong':           dict(src=(V + 'Percussion', r'^gongHit'), kind='hit', fam='打击', desc='大锣/Tam-tam'),
    'gong2':          dict(src=VI + 'Gong 1', kind='hit', fam='打击', desc='锣 2（含小锣、刮奏）', var={'big': r'^gong_(p|mf|f|fff)\.', 'small': r'gong_2_', 'scrape': r'scrape'}),
    'triangle':       dict(src=VI + 'Triangles', kind='hit', fam='打击', desc='三角铁',
                           var={'open': r'_Hit_', 'muted': r'_HitM_', 'semi': r'(?i)_hitFM_', 'roll': r'_Roll'}),
    'tambourine':     dict(src=(V + 'Percussion', r'^Tamb1'), kind='hit', fam='打击', desc='铃鼓'),
    'claves':         dict(src=(V + 'Percussion', r'^Claves1'), kind='hit', fam='打击', desc='响棒'),
    'cowbell':        dict(src=(V + 'Percussion', r'^Cowbell1'), kind='hit', fam='打击', desc='牛铃'),
    'sleighbells':    dict(src=(V + 'Percussion', r'^Sleighbells'), kind='hit', fam='打击', desc='雪橇铃'),
    'log_drum':       dict(src=(V + 'Percussion', r'^LogDrum'), kind='hit', fam='打击', desc='木鱼鼓/裂缝鼓', var={'hi': 'LogDrumHi', 'lo': 'LogDrumLo'}),
    'woodblock':      dict(src=VI + 'Woodblock', kind='hit', fam='打击', desc='木块', var={'a': r'wood_click_', 'b': r'wood_click2', 'c': r'wood_click3'}),
    'frame_drum':     dict(src=VM + 'Frame Drum', kind='hit', fam='打击', desc='手鼓/框鼓',
                           var={'large': r'HDrumL_Hit_', 'small': r'HDrumS_Hit_', 'large_muted': r'HDrumL_HitMuted', 'small_muted': r'HDrumS_HitMuted', 'hand': r'_Hand'}),
    'hihat':          dict(src=VI + 'Hi-Hat Cymbal', kind='hit', fam='打击', desc='踩镲', var={'closed': r'HitC_', 'open': r'HitO_', 'loose': r'HitLoose', 'pedal': r'_Close_'}),
    'cajon':          dict(src=VI + 'Cajon', kind='hit', fam='打击', desc='卡洪鼓', var={'bass': 'hit1', 'slap': 'hit2', 'tone': 'hit3'}),
    'conga':          dict(src=VM + 'Conga', kind='hit', fam='打击', desc='康加鼓', var={'conga': r'^Conga_HitN', 'quinto': r'^Quinto_HitN', 'tumba': r'^Tumba_HitN', 'muted': r'HitFM'}),
    'claps':          dict(src=VI + 'Claps', kind='hit', fam='打击', desc='拍手', var={'group': r'^Clap_', 'solo': r'^SoloClap'}),
    'shaker':         dict(src=VI + 'Shaker, Small', kind='hit', fam='打击', desc='沙锤', var={'down': r'Double_Down', 'up': r'Double_Up', 'slap': r'Slap', 'roll': r'Roll'}),
    'nepal_bells':    dict(src=VI + 'Hand Bells, Nepalese', kind='hit', fam='打击', desc='尼泊尔手铃'),
    'world_perc':     dict(src=F + 'world_perc', kind='hit', pp='sfz', fam='打击', desc='世界打击（卡洪/邦戈/蛋沙锤/响板/达布卡等，变体见 info()）'),
    'drum_kit':       dict(src=F + 'muldjord_kit', kind='hit', pp='sfz', fam='打击', desc='流行鼓组 MuldjordKit（CC BY 4.0）', lic='muldjord'),
}
ALIASES = {'strings': 'violins', 'cello': 'cellos', 'viola': 'violas', 'double_bass': 'contrabass', 'upright_bass_pizz': 'jazz_bass',
           'french_horn': 'horn', 'glock': 'glockenspiel', 'vibes': 'vibraphone', 'chimes': 'tubular_bells', 'grand_piano': 'piano',
           'acoustic_guitar': 'guitar_nylon', 'guzheng': 'dan_tranh', 'zither': 'dan_tranh', 'sax': 'tenor_sax', 'kick': 'bass_drum',
           'cymbal': 'crash', 'tamtam': 'gong', 'celesta': 'glockenspiel'}

LIC = {
    'vsco2ce': ('VS Chamber Orchestra: Community Edition (Versilian Studios)', 'CC0 1.0', ''),
    'vcsl': ('Versilian Community Sample Library (Versilian Studios)', 'CC0 1.0', ''),
    'freepats': ('FreePats project (freepats.zenvoid.org)', 'CC0 1.0', ''),
    'karoryfer': ('Karoryfer Samples / sfzinstruments', 'CC0 1.0', ''),
    'salamander': ('Salamander Grand Piano V3 by Alexander Holm', 'CC BY 3.0',
                   'Piano: "Salamander Grand Piano V3" by Alexander Holm, licensed under CC BY 3.0 (https://creativecommons.org/licenses/by/3.0/)'),
    'muldjord': ('MuldjordKit by Lars Muldjord (FreePats version)', 'CC BY 4.0',
                 'Drums: "MuldjordKit" by Lars Muldjord (drumgizmo.org), FreePats version, licensed under CC BY 4.0 (https://creativecommons.org/licenses/by/4.0/)'),
}


def _lic(nm):
    s = REG[ALIASES.get(nm, nm)]
    if s.get('lic'): return s['lic']
    return (s['src'][0] if isinstance(s['src'], tuple) else s['src']).split('/')[0]


# —— 文件名解析 ——
_DYN = {'pppp': 1, 'ppp': 2, 'pp': 3, 'p': 4, 'mp': 5, 'mf': 6, 'f': 7, 'ff': 8, 'fff': 9, 'soft': 3, 'quiet': 3,
        'med': 6, 'medium': 6, 'normal': 6, 'loud': 8, 'accented': 8}


def _toks(stem): return [t for t in re.split(r'[_\s\-\.]+', stem) if t]


def _parse_pitch(stem, mode):
    tk = _toks(stem)
    if mode == 'sal':
        m = re.match(r'([A-G]#?)(\d)v(\d+)$', stem); return midi(m.group(1) + m.group(2)) if m else None
    if mode == 'organ':
        n = next((int(t) for t in tk if re.fullmatch(r'\d{2,3}', t)), None)
        if n is None: return None
        ped = 'Pedal' in stem; n -= (63 if ped else 121) if n > 61 else 0
        return float((23 if ped else 35) + n)
    rx = r'([A-G])(#|b)?(-?\d)' if mode == 'upper' else r'([a-g])(#|b)?(\d)'
    for t in tk:
        m = re.fullmatch(rx, t)
        if m: return midi(m.group(1).upper() + (m.group(2) or '') + m.group(3))
    return None


def _parse_vel(stem, mode='upper'):
    tk = [t for t in _toks(stem) if not (mode == 'lower' and re.fullmatch(r'[a-g](#|b)?\d', t))]
    for t in tk:  # 先认明确的力度标记（v3 / vl2 / dyn1 / pp / mf2），再认 soft/loud 这类词
        m = re.fullmatch(r'(?i)v(?:l)?(\d+)|dyn(\d)', t)
        if m: return int(m.group(1) or m.group(2))
        b = re.sub(r'\d+$', '', t)
        if re.fullmatch(r'p{1,4}|mp|mf|f{1,3}', b): return _DYN[b]
    for t in tk:
        if t.lower() in _DYN: return _DYN[t.lower()]
    return None


def _parse_rr(stem):
    for t in _toks(stem):
        m = re.fullmatch(r'(?i)r{1,2}(\d+)', t)
        if m: return int(m.group(1))
    return 1


# —— SFZ 解析（freepats 系） ——
def _sfz(path):
    txt = open(path, encoding='utf-8', errors='ignore').read()
    zones, glob_, grp, lab, pending = [], {}, {}, None, None
    for line in txt.splitlines():
        s = line.strip()
        if s.startswith('//'):
            c = s[2:].strip()
            if c and not c.startswith('+'): pending = c
            continue
        for part in re.split(r'(<\w+>)', s):
            part = part.strip()
            if not part: continue
            if part.startswith('<'):
                h = part[1:-1]
                if h in ('global', 'control'): cur = glob_ = {}
                elif h in ('group', 'master'): grp = dict(glob_); cur = grp; lab = pending or lab
                elif h == 'region': cur = dict(grp); zones.append(cur); cur['_lab'] = lab
                pending = None if h != 'region' else pending
                continue
            for k, v in re.findall(r'(\w+)=(.*?)(?=\s+\w+=|$)', part):
                cur[k] = v.strip()
    return zones


def _sfz_zones(d):
    fs = [f for f in glob.glob(os.path.join(ROOT, d, '*.sfz'))]
    if not fs: return []
    out, seen = [], {}
    for r in _sfz(fs[0]):
        if 'sample' not in r or r.get('trigger', 'attack') not in ('attack', 'first'): continue  # 跳过 release 触发的采样
        p = os.path.normpath(os.path.join(os.path.dirname(fs[0]), r['sample'].replace('\\', '/')))
        if not os.path.exists(p): continue
        key = r.get('pitch_keycenter', r.get('key'))
        root = float(key) - float(r.get('tune', 0)) / 100 if key is not None else None
        lo, hi = int(r.get('lovel', 1)), int(r.get('hivel', 127))
        rel = os.path.relpath(p, ROOT)
        if rel in seen:  # 同一采样在多个力度组里 → 合并力度范围
            z = seen[rel]; z['_lo'] = min(z['_lo'], lo); z['_hi'] = max(z['_hi'], hi); continue
        var = (r.get('_lab') or os.path.basename(os.path.dirname(p)))
        import unicodedata
        var = re.sub(r'[^a-z0-9]+', '_', unicodedata.normalize('NFKD', var).encode('ascii', 'ignore').decode().lower()).strip('_')
        z = dict(f=rel, root=root, _lo=lo, _hi=hi, rr=len(out), var=var,
                 loop=[int(r['loop_start']), int(r['loop_end'])] if 'loop_start' in r and 'loop_end' in r else None,
                 db=float(r.get('volume', 0)))
        seen[rel] = z; out.append(z)
    for z in out: z['vel'] = (z.pop('_lo') + z.pop('_hi')) / 2
    return out


def _scan(nm):
    """按注册表收集该乐器所有采样 → zone 列表（未分析）"""
    s = REG[nm]; src = s['src']; mode = s.get('pp', 'upper')
    if mode == 'sfz':
        zs = _sfz_zones(src)
    else:
        d, rx = src if isinstance(src, tuple) else (src, None)
        fs = sorted(glob.glob(os.path.join(ROOT, d, '**', '*.*'), recursive=True))
        zs = []
        for p in fs:
            if not p.lower().endswith(('.flac', '.wav')): continue
            rel = os.path.relpath(p, ROOT); st = os.path.splitext(os.path.basename(p))[0]
            if rx and not re.search(rx, os.path.relpath(p, os.path.join(ROOT, d))): continue
            v = int(st.split('v')[-1]) if mode == 'sal' else _parse_vel(st, mode)
            zs.append(dict(f=rel, root=None if mode == 'detect' else _parse_pitch(st, mode), vel=v, rr=_parse_rr(st), var=None, loop=None, db=0.0))
    var = s.get('var')
    if var:
        for z in zs:
            b = os.path.relpath(os.path.join(ROOT, z['f']), os.path.join(ROOT, src[0] if isinstance(src, tuple) else src))
            z['var'] = next((k for k, r in var.items() if re.search(r, b) or re.search(r, os.path.basename(b))), None)
        zs = [z for z in zs if z['var']]
    elif s['kind'] != 'hit':
        for z in zs: z['var'] = None
    if s['kind'] != 'hit' and mode != 'detect':
        zs = [z for z in zs if z['root'] is not None]
    return zs


# —— 分析（onset / 电平 / yin 实测音高），结果写 index.json ——
def _read(path):
    x, sr = sf.read(os.path.join(ROOT, path), dtype='float32', always_2d=True)
    return x.mean(1), sr


def _onset(x):
    pk = np.abs(x).max() + 1e-12
    i = int(np.argmax(np.abs(x) > pk * 10 ** (-40 / 20)))
    return max(0, i - 96)


def _yin(x, sr, guess):
    try: import librosa
    except ImportError: raise ImportError('building the sample index needs librosa (maintainers): pip install -r requirements-dev.txt') from None
    y = x[:int(sr * 1.6)].astype(np.float64)
    if guess is None: fmin, fmax = 40.0, 2000.0
    else:
        g = 440 * 2 ** ((guess - 69) / 12); fmin, fmax = max(28.0, g / 4.2), min(sr / 4, g * 4.2)
    fl = int(2 ** math.ceil(math.log2(max(2048, 3 * sr / fmin))))
    try:
        f = librosa.yin(y, fmin=fmin, fmax=fmax, sr=sr, frame_length=fl, hop_length=fl // 4)
    except Exception: return None, 0.0
    e = uniform_filter1d(y ** 2, fl)[::fl // 4]; k = min(len(e), len(f)); e, f = e[:k], f[:k]
    ok = e > e.max() * 0.05
    if ok.sum() < 3: return None, 0.0
    m = 69 + 12 * np.log2(f[ok] / 440); med = float(np.median(m))
    return med, float(np.mean(np.abs(m - med) < .5))


def _analyze(nm, zs):
    s = REG[nm]; pitched = s['kind'] != 'hit'
    def one(z):
        x, sr = _read(z['f']); on = _onset(x); y = x[on:]
        w = int(sr * (.4 if s['kind'] == 'sus' else .1)); seg = y[:int(sr * 4)].astype(np.float64)  # rms 取前 4 秒最响的窗（长音 0.4s / 衰减型 0.1s）
        r = np.sqrt(uniform_filter1d(seg ** 2, w)[w // 2::w // 4].max()) if len(seg) > w else np.sqrt(np.mean(seg ** 2))
        z.update(on=on, n=len(y), sr=sr, rms=float(r) + 1e-9, pk=float(np.abs(y).max() + 1e-9))
        if pitched:
            det, conf = _yin(y, sr, z['root'])
            z.update(det=det, conf=conf)
        return z
    from concurrent.futures import ThreadPoolExecutor
    with ThreadPoolExecutor(8) as ex: zs = list(ex.map(one, zs))
    if pitched:
        good = [z for z in zs if z.get('det') is not None and z['conf'] > .6 and z['root'] is not None]
        off = 0
        if good:
            ks = [round((z['det'] - z['root']) / 12) * 12 for z in good]
            k = max(set(ks), key=ks.count)
            if ks.count(k) > len(ks) * .6: off = k
        off = s.get('oct', off)   # 注册表可强制八度（yin 在低音/管风琴上会犹豫）
        if s.get('roots'):        # 注册表直接给定音高（定音鼓：yin 抓不准主振动模）
            for z in zs: z['root'] = s['roots'][z['var']]
            return zs, 0
        for z in zs:
            if z['root'] is None:  # detect 模式：直接用实测
                z['root'] = round(z['det'], 2) if z.get('det') is not None else 48.0
                continue
            z['root'] += off
            dev = (z['det'] - z['root']) if z.get('det') is not None else 0
            if s.get('pp') not in ('sal', 'sfz') and s.get('retune', True) and z['conf'] > .6 and .08 < abs(dev) < .8:
                z['root'] = round(z['root'] + dev, 3)   # 按 yin 实测微调到平均律（<80 音分；钢琴/sfz 库/管钟除外）
        return zs, off
    return zs, 0


def build_index(names=None, force=False):
    """扫描 + 分析所有（或指定）乐器，写 instruments/index.json（随采样包一起下载，一般不用跑）"""
    idx = _load_index()
    for nm in (names or REG):
        if nm in idx and not force: continue
        zs, off = _analyze(nm, _scan(nm))
        idx[nm] = dict(zones=zs, octave_fix=off)
        print(f'{nm:18s} {len(zs):4d} zones  octave_fix={off:+d}', flush=True)
    tmp = INDEX + f'.{os.getpid()}.tmp'
    with open(tmp, 'w', encoding='utf-8') as f: json.dump(idx, f, ensure_ascii=False, separators=(',', ':'))
    os.replace(tmp, INDEX)
    global _IDX; _IDX = idx
    return idx


_IDX = None


def _load_index():
    global _IDX
    if _IDX is None:
        _IDX = json.load(open(INDEX, encoding='utf-8')) if os.path.exists(INDEX) else {}
    return _IDX


# —— 乐器对象 ——
class Inst:
    def __init__(self, nm):
        self.name, self.spec = nm, REG[nm]
        src = self.spec['src']; self.lib = (src[0] if isinstance(src, tuple) else src).split('/')[0]
        if not (os.path.isdir(os.path.join(ROOT, self.lib)) and os.path.exists(INDEX)):
            raise RuntimeError(f'{nm}: its sample library "{self.lib}" is not downloaded. Run, from the library root: sh tools/fetch.sh instruments {self.lib}')
        idx = _load_index()
        if nm not in idx:
            zs, off = _analyze(nm, _scan(nm)); idx[nm] = dict(zones=zs, octave_fix=off)
        self.zones = [dict(z, id=i) for i, z in enumerate(idx[nm]['zones'])]
        if not self.zones:
            raise RuntimeError(f'{nm}: no samples found in {ROOT}/{self.lib}. The download looks incomplete; run again: sh tools/fetch.sh instruments {self.lib}')
        self.kind, self.rel = self.spec['kind'], self.spec.get('rel', .3)
        # 力度层 → 0..1 位置（每个变体内分别排）
        groups = {}
        for z in self.zones: groups.setdefault(z.get('var'), []).append(z)
        for g in groups.values():
            vs = sorted({z['vel'] for z in g if z['vel'] is not None})
            for z in g:
                z['vp'] = .8 if z['vel'] is None or len(vs) < 2 else (vs.index(z['vel']) + .5) / len(vs)
        self.layers = max(len({z['vel'] for z in g}) for g in groups.values())
        vs = list(OrderedDict.fromkeys(z['var'] for z in self.zones if z.get('var')))
        order = list(self.spec.get('var') or {})  # 注册表里写的第一个变体 = 默认
        self.vars = [v for v in order if v in vs] + [v for v in vs if v not in order]
        # 电平归一：有音高 → 力度≈0.8 那层的中位 rms；打击 → 每个变体各自按峰值归一（滚奏/弓奏与单击一样好用）
        self.vgain = {}
        for k, g in groups.items():
            d0 = min(abs(z['vp'] - .8) for z in g); ref = [z for z in g if abs(z['vp'] - .8) <= d0 + 1e-6]
            self.vgain[k] = (.1 / np.median([z['rms'] for z in ref])) if self.kind != 'hit' else (.4 / np.median([z['pk'] for z in ref]))
        allref = [z for z in self.zones if abs(z['vp'] - .8) <= min(abs(w['vp'] - .8) for w in self.zones) + 1e-6]
        self.gain = (.1 / np.median([z['rms'] for z in allref])) if self.kind != 'hit' else 1.0
        if self.kind != 'hit':
            rs = [z['root'] for z in self.zones]; self.lo, self.hi = min(rs), max(rs)
        self._rr = 0

    def pick(self, m, vel, var=None):
        zs = [z for z in self.zones if var is None or z.get('var') == var] or self.zones
        if self.kind == 'hit' or m is None:
            cost = [abs(z['vp'] - vel) for z in zs]
        else:
            cost = [abs(z['root'] - m) + (.35 if z['root'] < m else 0) * min(1, abs(z['root'] - m)) + 4 * abs(z['vp'] - vel) for z in zs]
        c0 = min(cost); cand = [z for z, c in zip(zs, cost) if c <= c0 + .01]
        self._rr += 1
        return cand[int(_rng.integers(len(cand)))] if len(cand) > 1 else cand[0]

    def __repr__(self):
        r = f'{name(self.lo)}–{name(self.hi)}' if self.kind != 'hit' else 'unpitched'
        return f'<Inst {self.name} {self.kind} {len(self.zones)} zones {r} layers={self.layers}' + (f' vars={self.vars}' if self.vars else '') + '>'


_INST = {}


def load(nm):
    """按名加载乐器（懒加载 + 缓存）。返回 Inst（zones/range/vars 可查）"""
    nm = ALIASES.get(nm, nm)
    if nm not in REG: raise KeyError(f'未知乐器 {nm!r}；可用：{", ".join(sorted(REG))}')
    with _lock:
        if nm not in _INST: _INST[nm] = Inst(nm)
    return _INST[nm]


def instruments(fam=None): return [k for k, v in REG.items() if fam is None or v['fam'] == fam]


# —— 采样读取 / 移调缓存 ——
class _LRU(OrderedDict):
    def __init__(self, n): super().__init__(); self.n = n
    def get_or(self, k, fn):
        with _lock:
            if k in self: self.move_to_end(k); return self[k]
        v = fn()
        with _lock:
            self[k] = v
            while len(self) > self.n: self.popitem(last=False)
        return v


_RAW, _SHIFT = _LRU(160), _LRU(320)


def _raw(z):
    def f():
        x, sr = _read(z['f']); x = x[z['on']:].copy(); x[:96] *= np.linspace(0, 1, min(96, len(x)))
        return x, sr
    return _RAW.get_or(z['f'], f)


def _shifted(z, semis):
    """移调 semis 半音并重采样到 SR（soxr HQ）"""
    k = (z['f'], round(semis, 3))
    def f():
        x, sr = _raw(z)
        r = 2 ** (semis / 12)
        return soxr.resample(x, sr * r, SR, quality='HQ').astype(np.float32)
    return _SHIFT.get_or(k, f)


def _region(z, y, r):
    """可循环的稳定段 [a,b)（已移调后的样本坐标）"""
    if z.get('loop'):
        a, b = z['loop']; a = int((a - z['on']) * SR / (z['sr'] * r)); b = int((b - z['on']) * SR / (z['sr'] * r))
        if 0 < a < b <= len(y) and b - a > SR * .05: return a, b
    hop = int(.02 * SR); e = np.sqrt(uniform_filter1d(y.astype(np.float64) ** 2, hop)[::hop] + 1e-12)
    pk = e.max(); st = max(int(.3 * SR / hop), int(np.argmax(e > .5 * pk)))
    thr = .45 * np.median(e[e > .1 * pk]) if (e > .1 * pk).any() else 0
    good = e > thr; best, cur, bs = (0, 0), 0, 0
    for i in range(st, len(e)):
        if good[i]:
            if cur == 0: bs = i
            cur += 1
            if cur > best[1] - best[0]: best = (bs, i + 1)
        else: cur = 0
    a, b = best[0] * hop, best[1] * hop
    if b - a < .3 * SR: a, b = int(len(y) * .3), int(len(y) * .8)
    m = int((b - a) * .06); return a + m, b - m


def _extend(y, n, a, b, f0):
    """交叉淡化颗粒延长：从稳定段随机取片段，按基频周期对齐相位后拼接，直到 n 个样本"""
    if len(y) >= n: return y[:n]
    per = int(SR / f0) if f0 else 600
    L = b - a
    X = int(min(.1 * SR, L / 4)); W = min(X, 2048)
    G = int(min(max(.4 * SR, L * .5), L - X - W - 2 * per))
    if G < .05 * SR:  # 稳定段太短：退化为最后 0.2s 的周期对齐重复
        a, b = max(0, len(y) - int(.45 * SR)), len(y) - int(.05 * SR); L = b - a
        X = int(min(.06 * SR, L / 4)); W = min(X, 2048); G = max(int(L - X - W - 2 * per), int(.05 * SR))
    buf = np.zeros(n + G + X, np.float32); m = min(b, len(y)); buf[:m] = y[:m]
    fade = (0.5 - 0.5 * np.cos(np.linspace(0, np.pi, X))).astype(np.float32)
    ref_rms = np.sqrt(np.mean(y[a:b] ** 2)) + 1e-9
    while m < n:
        lo, hi = a + X + W, max(a + X + W + 1, b - G - 2 * per)
        s = int(_rng.integers(lo, hi))
        ref = buf[m - W:m]; seg = y[s - W:s + 2 * per]
        c = np.correlate(seg, ref, 'valid')
        en = np.sqrt(np.convolve(seg ** 2, np.ones(W), 'valid') + 1e-9)
        s += int(np.argmax(c / en[:len(c)]))
        g = float(np.clip(ref_rms / (np.sqrt(np.mean(y[s:s + G] ** 2)) + 1e-9), .75, 1.33))  # 每颗粒对齐到稳定段平均电平，不累积漂移
        buf[m - X:m] = buf[m - X:m] * (1 - fade) + y[s - X:s] * g * fade
        buf[m:m + G] = y[s:s + G] * g; m += G
    return buf[:n]


def _vel_tone(x, vel, single):
    """单力度层乐器：弱奏时轻微压暗（真实乐器弱奏高频少）"""
    if not single or vel >= .78: return x
    fc = float(np.clip(18000 * (vel / .8) ** 2.2, 900, 18000))
    return sosfilt(butter(1, fc, 'low', fs=SR, output='sos'), x).astype(np.float32)


def note(inst, pitch, dur, vel=.8, release=None, attack=0.0, var=None):
    """单音：inst 名或 Inst；pitch 'C#4'/midi（可小数）；dur 按住时长(s)；vel 0..1；
    release 止音后的释放(s，默认按乐器)；attack>0 时加淡入（弦乐铺底用）。返回 float32 @SR，长度≈dur+release"""
    I = inst if isinstance(inst, Inst) else load(inst)
    if I.kind == 'hit': return hit(I, var, vel)
    m = midi(pitch); vel = float(np.clip(vel, .01, 1))
    z = I.pick(m, vel, var)
    semis = m - z['root']; y = _shifted(z, semis)
    rel = I.rel if release is None else release
    dn, rn = int(dur * SR), int(max(rel, .005) * SR)
    if I.kind == 'sus' and len(y) < dn + rn:
        a, b = _region(z, y, 2 ** (semis / 12))
        y = _extend(y, dn + rn, a, b, hz(m))
    y = y[:dn + rn].copy()
    if len(y) > dn:  # 释放：指数衰减到 -60dB，末尾 5ms 归零
        t = np.arange(len(y) - dn) / SR
        env = np.exp(-6.9 * t / max(rel, .005)); env[-min(240, len(env)):] *= np.linspace(1, 0, min(240, len(env)))
        y[dn:] *= env.astype(np.float32)
    if attack > 0:
        k = min(len(y), int(attack * SR)); y[:k] *= (np.sin(np.linspace(0, np.pi / 2, k)) ** 2).astype(np.float32)
    single = I.layers < 2
    g = I.gain * 10 ** (z.get('db', 0) / 20) * ((vel / .8) ** 1.2 if single else float(np.clip((vel / z['vp']) ** .6, .5, 1.6)))
    return _vel_tone(y, vel, single) * np.float32(g)


def hit(inst, name_or_index=None, vel=.8, dur=None):
    """无音高打击：hit('snare','roll',.6) / hit('drum_kit','snare1') / hit('timpani',2)（第 3 面鼓）。
    name 可写前缀；dur 可截短（加 30ms 淡出）。有音高乐器也可用：整条自然衰减播放"""
    I = inst if isinstance(inst, Inst) else load(inst)
    var, m = name_or_index, None
    if isinstance(var, (int, np.integer)):
        if I.vars: var = I.vars[int(var) % len(I.vars)]
        else: rs = sorted({z['root'] for z in I.zones}); m = rs[int(var) % len(rs)]; var = None
    elif isinstance(var, str) and var not in I.vars:
        q = re.sub(r'[^a-z0-9]', '', var.lower()); key = {v: v.replace('_', '') for v in I.vars}
        c = [v for v in I.vars if key[v].startswith(q)] or [v for v in I.vars if q in key[v]]
        if c: var = c[0]
        elif I.kind != 'hit': m, var = midi(var), None
        else: raise KeyError(f'{I.name} 没有变体 {var!r}；可用 {I.vars}')
    vel = float(np.clip(vel, .01, 1))
    if var is None and I.vars and I.kind == 'hit': var = I.vars[0]
    z = I.pick(m, vel, var)
    y = _shifted(z, 0).copy()
    if dur is not None and len(y) > dur * SR:
        y = y[:int(dur * SR) + 1440]; y[-1440:] *= np.linspace(1, 0, 1440, dtype=np.float32)
    single = len({w['vel'] for w in I.zones if w.get('var') == z.get('var')}) < 2
    g = (I.vgain[z.get('var')] if I.kind == 'hit' else I.gain) * 10 ** (z.get('db', 0) / 20) * ((vel / .8) ** 1.3 if single else float(np.clip((vel / z['vp']) ** .7, .4, 1.8)))
    return y * np.float32(g)


def chord(inst, pitches, dur, vel=.8, strum=0.0, **kw):
    """和弦（单声道）：strum>0 时每个音依次延迟 strum 秒（吉他扫弦/竖琴琶音）"""
    xs = [note(inst, p, dur, vel * (1 - .04 * i), **kw) for i, p in enumerate(pitches)]
    n = max(len(x) + int(i * strum * SR) for i, x in enumerate(xs)); out = np.zeros(n, np.float32)
    for i, x in enumerate(xs): s = int(i * strum * SR); out[s:s + len(x)] += x
    return out


def render(events, dur=None, master=True):
    """写谱：events = [(t, inst, pitch, dur, vel, pan[, gain]), ...] 或 dict(t=,inst=,pitch=,dur=,vel=,pan=,gain=,release=,attack=)。
    无音高打击把 pitch 写成变体名或 None。返回立体声 float32 (N,2)；master=True 时逐声道前瞻限幅到 0.95"""
    evs = []
    for e in events:
        if isinstance(e, dict): evs.append(e)
        else:
            k = ['t', 'inst', 'pitch', 'dur', 'vel', 'pan', 'gain']; evs.append(dict(zip(k, e)))
    if dur is None: dur = max(e['t'] + (e.get('dur') or 1) + 3 for e in evs)
    buf = np.zeros((int(dur * SR), 2), np.float32)
    for e in evs:
        I = load(e['inst']); kw = {k: e[k] for k in ('release', 'attack') if e.get(k) is not None}
        if I.kind == 'hit': x = hit(I, e.get('pitch'), e.get('vel', .8), e.get('dur'))
        else: x = note(I, e['pitch'], e.get('dur') or .5, e.get('vel', .8), var=e.get('var'), **kw)
        add(buf, x, e['t'], e.get('gain', 1.0) if e.get('gain') is not None else 1.0, e.get('pan', 0.0) or 0.0)
    if master and np.abs(buf).max() > .95:
        buf = np.stack([limit(buf[:, 0], .95), limit(buf[:, 1], .95)], 1).astype(np.float32)
    return buf


def room(x, size=.5, mix=.2, predelay=.015, damp=.5, seed_=3):
    """简易卷积混响：去相关的指数衰减噪声 IR（高频衰减更快）。x 单声道或 (N,2)；返回 (N,2) 同长度。
    size 0..1 → RT60 0.4–3.4s；mix 湿声比例；damp 0..1 越大越暗"""
    x = np.asarray(x, np.float32); st = x if x.ndim == 2 else np.stack([x, x], 1)
    rt = .4 + 3.0 * size; n = int(rt * SR); t = np.arange(n) / SR
    r = np.random.default_rng(seed_); out = np.zeros_like(st)
    for c in range(2):
        w = r.standard_normal(n)
        lp_ = sosfilt(butter(1, 9000 * (1 - .75 * damp) + 1500, 'low', fs=SR, output='sos'), w)
        k = np.clip(t / rt, 0, 1) ** .6
        ir = (w * (1 - k) + lp_ * k * 1.4) * np.exp(-6.9 * t / rt)
        ir[:int(.004 * SR)] *= np.linspace(0, 1, int(.004 * SR))
        ir = np.concatenate([np.zeros(int(predelay * SR)), ir]); ir /= np.sqrt(np.sum(ir ** 2)) + 1e-9
        out[:, c] = fftconvolve(st[:, c], ir)[:len(st)] * .5
    return (st * (1 - mix) + out * mix * 2.2).astype(np.float32)


def info(nm=None):
    """打印一件或全部乐器的概况（音域/力度层/变体/授权）"""
    for k in ([ALIASES.get(nm, nm)] if nm else REG):
        I = load(k); print(I, '|', REG[k]['desc'], '|', LIC[_lic(k)][1])


def credits(names):
    """根据用到的乐器名，返回片尾 CREDITS 需要写的归属行（CC BY 的必写；CC0 的列为致谢）"""
    need, thanks = [], set()
    for n in names:
        n = ALIASES.get(n, n); l = _lic(n)
        if LIC[l][2]: need.append(LIC[l][2])
        else: thanks.add(LIC[l][0])
    return list(OrderedDict.fromkeys(need)) + ([f'Samples (CC0): {", ".join(sorted(thanks))}'] if thanks else [])
