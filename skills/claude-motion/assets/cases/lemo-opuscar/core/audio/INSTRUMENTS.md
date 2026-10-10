# 真实乐器工具链：sampler（采样）+ pluck（物理建模拨弦）

给 Lemo-Opuscar 各风格短片写**原创配乐**用。全部 numpy/soxr 离线合成，**48 kHz**，和 `sfx.py` 同一套约定（`SR`、`add()`、`limit()`）。
目标是"听起来像真乐器"：能用采样就用采样（97 件，真人录音），采样库里没有的民族拨弦（古琴、琵琶、三味线……）用物理建模补上（11 个预设）。

- 试听：仓库里没有现成的试听文件（`core/audio/*.wav` 不进 git，也不在采样包里）。下载采样包后，用下面第 1 节的写法给每件乐器弹一个根音-五度-八度的小动机，自己渲一段听
- 采样库：`core/audio/instruments/`（FLAC 无损；每个库保留原 LICENSE/README）。不在 git 里，按库下载，只下片子用到的：`sh tools/fetch.sh instruments <lib>`（`vsco2ce` 395 MB、`vcsl` 271 MB、`salamander` 218 MB、`freepats` 397 MB、`karoryfer` 74 MB），或 `instruments all`（约 1.4 GB）。第 5 节的「来源」列就是所在的库：VSCO 2 CE → `vsco2ce`，VCSL → `vcsl`，Salamander → `salamander`，FreePats 和 MuldjordKit → `freepats`，Karoryfer → `karoryfer`
- 索引：`core/audio/instruments/index.json`（每个库的包里都带一份：每个采样的音高、力度层、起音点、电平；导入即用，不用重建）

---

## 1. 三十秒上手

```python
import sys; sys.path.insert(0, '.')   # 在仓库根目录运行
import numpy as np, soundfile as sf
from core.audio import sampler as S, pluck as P
from core.audio.sfx import SR, add, limit

x = S.note('cellos', 'D3', 4.0, vel=.6)            # 大提琴组长音 4 秒（采样不够长会自动无缝延长）
y = S.hit('snare', 'roll', .5)                       # 无音高打击：乐器 + 变体 + 力度
z = P.pluck('guqin', 'A3', 3, vel=.7, bend=[(.5, 0), (.9, 2)])   # 古琴按音上滑一个全音

# 写谱：(时间s, 乐器, 音高, 时值s, 力度0-1, 声像-1..1[, 增益])
mix = S.render([
    (0.0, 'piano',   'D4', 1.0, .70, -.2),
    (0.0, 'cellos',  'D3', 4.0, .55,  .2),
    (0.5, 'violins', 'A4', 3.5, .50,  .3),
    dict(t=1.0, inst='harp', pitch='F#5', dur=1, vel=.6, pan=-.4),
    (2.0, 'gong', None, None, .5, 0),              # 无音高：pitch 写变体名或 None
], dur=8)                                           # → (N,2) float32，超 0.95 自动逐声道限幅
mix = S.room(mix, size=.45, mix=.18)                # 简易卷积混响（可选）
sf.write('cue.wav', mix, SR)
```

> 单独调用 `note()/hit()/pluck()` 得到的是**单声道 float32 @48k**，长度 ≈ `dur + release`，用 `sfx.add(buf, x, t, gain, pan)` 摆进立体声 buffer。

---

## 2. sampler.py 用法

| 函数 | 作用 |
|---|---|
| `load(name)` | 按名加载乐器（懒加载 + 缓存；首次只读索引，采样用到才读盘）。返回 `Inst`，`print` 可见音域/力度层/变体 |
| `note(inst, pitch, dur, vel=.8, release=None, attack=0, var=None)` | 单音。`pitch` 可写 `'C#4'` `'Db3'` `'Bb-1'` 或 midi 号（**C4=60**，允许小数=微分音）。`dur`=按住时长；`release`=止音后的释放秒数（默认按乐器）；`attack>0` 给弦乐铺底加淡入 |
| `hit(inst, name_or_index=None, vel=.8, dur=None)` | 无音高打击。变体名可写前缀/去下划线（`'kick'`→`kick_drum_left`，`'hihat_open'`）；整数=第 n 个变体（`hit('timpani', 2)`=第 3 面鼓）；`dur` 截短（带 30 ms 淡出）。对有音高乐器也可用：`hit('piano','A3')` 播放整条自然衰减 |
| `chord(inst, pitches, dur, vel, strum=0)` | 和弦（单声道）；`strum>0` 逐音延迟（琶音/扫弦） |
| `render(events, dur=None, master=True)` | 写谱 → 立体声。事件是元组 `(t, inst, pitch, dur, vel, pan[, gain])` 或 dict（可带 `release`/`attack`/`var`） |
| `room(x, size=.5, mix=.2, predelay=.015, damp=.5)` | 去相关指数衰减噪声 IR 的卷积混响；`size` 0–1 → RT60 0.4–3.4 s；返回 (N,2) 同长度 |
| `credits(names)` | 按你用到的乐器列表，生成片尾 CREDITS 行（CC BY 必写的原文 + CC0 致谢） |
| `info(name=None)` / `instruments(fam=None)` | 打印概况 / 列名字（`fam` 取 弦乐/木管/铜管/打击/键盘/拨弦/民族） |
| `midi(p)` / `hz(p)` / `name(m)` / `seed(n)` | 音名工具；`seed` 固定轮换随机（同样调用顺序 → 同样结果） |
| `build_index(names=None, force=False)` | 重扫采样并重建 `index.json`（换了/加了采样才需要；~15 s；要 librosa：`requirements-dev.txt`） |

**它在背后做了什么**
- **选采样**：同时考虑"离目标音最近"和"力度层最接近"（代价 = 半音距离 + 4×力度差，向上移调略加罚），同一格里的多个 round-robin 随机轮换，避免机关枪效应。
- **移调**：`soxr` HQ 重采样（同时把 44.1k 转成 48k）。建议移调不超过 ±4 半音（采样点一般每 2–3 半音一个，默认就在这个范围内）。超出采样音域也能出声，但音色会变"卡通"。
- **力度**：多层乐器先选层，再在层内做 ±4 dB 的细调；只有一层的乐器按力度调增益并在弱奏时轻微压暗高频（真乐器弱奏更暗）。
- **长音延长**（`长音·可延长` 类）：`dur` 超过录音长度时，从录音的稳定段随机取 0.4–1 s 的颗粒，**按基频周期做互相关对齐**后 100 ms 升余弦交叉淡化拼接，并把每颗粒电平对齐到稳定段均值——不会硬截、不会出现循环的"嗡嗡"周期感。FreePats 的手风琴/风笛自带循环点，直接用它们的 loop 区间。
- **止音**：到 `dur` 后按 `release` 做指数衰减（-60 dB）+ 5 ms 归零；衰减型乐器（钢琴、拨奏、马林巴…）在 `dur` 前自然衰减，`dur` 到了按释放时间"制音"。钟琴/管钟/锣这类想让它一直响就把 `dur` 写长或 `release` 写大。
- **电平**：每件乐器已按录音实测归一（长音按最响 0.4 s 窗 RMS、衰减型按 0.1 s 窗、打击按每个变体的峰值），`vel=.8` 时各乐器响度大致相当（±6 dB 内）。写谱时直接用 `vel`/`gain` 做平衡即可。
- **音高校准**：索引里每个采样都用 yin 实测过基频。VSCO/VCSL 很多目录的文件名比实际音高**低一个八度**（例如 `VlnEns_susVib_A2` 实为 A3），Karoryfer 的二胡/贝斯文件名又**高一个八度**——这些都已按实测自动修正（index.json 里 `octave_fix`），并把偏离平均律 8–80 音分的采样微调到平均律（Salamander 用其官方 Retuned 表）。**你只管写实际音高。**

---

## 3. pluck.py 用法（物理建模拨弦）

```python
P.pluck(preset, pitch, dur=None, vel=.8, **kw)   # → 单声道 float32 @48k；dur=None 让它自然衰减完
P.strum(preset, pitches, dur, vel=.8, spread=.025, up=False)   # 扫弦/琶音
```

| 预设 | 说明 | 要点 |
|---|---|---|
| `guqin` | 古琴 | 丝弦、长余韵（~7 s）、琴体低频共鸣；支持按音滑音 `bend`、吟猱 `vib`，**滑动时会自动加丝弦摩擦声**；`harmonic=True` = 泛音（纯净钟声感） |
| `pipa` | 琵琶 | 明亮拨片、衰减 ~2.5 s；`trem=12~16` = 轮指 |
| `shamisen` | 三味线 | 拨子 + 蒙皮拍击 + **sawari 琴码碰撞蜂鸣**（`buzz` 0–1、`thr` 可调；实测持续段频谱重心 1.5k→2.0k Hz） |
| `koto` | 筝（日本） | `bend` 可做押手 |
| `banjo` | 班卓 | 鼓皮共鸣、衰减快、钢弦刚性 |
| `acoustic_guitar` | 钢弦民谣吉他 | 配 `strum()` 扫弦 |
| `nylon_guitar` | 尼龙弦吉他 | 暖（采样版见 `guitar_nylon`） |
| `upright_bass_pizz` | 低音提琴拨弦 | 指肚闷击 + 箱体低频（采样版见 `jazz_bass`，更真） |
| `harp` | 竖琴 | 弦中点拨，温暖（采样版见 `harp`） |
| `kalimba` | 卡林巴 | 模态合成：钢片分音 1 : 5.93 : 16.6 + 指甲声 + 共鸣箱（采样版见 `kalimba`） |
| `music_box` | 八音盒 | 模态合成：梳齿分音 1 : 6.27 : 17.55、双齿微拍频、机械"嗒"声、金属短衰减 |

通用关键字：
- `bend=[(t, 半音), ...]` 分段线性音高包络（相对 `pitch`）；`glide=(目标音高, 秒)` 滑到某音；`vib=(Hz, 深度半音, 起始秒)` 揉弦/吟猱
- `trem=Hz` 轮指/摇指（重复拨，力度略随机）；`harmonic=True` 泛音
- 覆盖物理参数：`t60`（基频衰减到 -60 dB 的秒数）、`damp`（0–0.9，越大越暗）、`pos`（拨弦位置 0–0.5，越小越亮）、`bright`、`buzz`/`thr`、`bmix`（琴体比例）、`noise`、`release`

```python
# 古琴一句：散音 → 按音上滑 → 吟 → 泛音
buf = np.zeros((int(8 * SR), 2), np.float32)
add(buf, P.pluck('guqin', 'D3', 2.5, .75), 0.0)
add(buf, P.pluck('guqin', 'A3', 3.0, .7, bend=[(0, 0), (.6, 0), (1.1, 2)], vib=(4.5, .2, 1.5)), 1.2)
add(buf, P.pluck('guqin', 'D5', 3.0, .6, harmonic=True), 4.0, .8, .2)
# 琵琶轮指 + 三味线
add(buf, P.pluck('pipa', 'E4', 1.5, .7, trem=14), 0, .7, -.3)
add(buf, P.pluck('shamisen', 'C4', .6, .8, buzz=.7), 2, .8, .3)
```

---

## 4. 授权与片尾归属（必读）

| 库 | 目录 | 授权 | 片尾要写什么 |
|---|---|---|---|
| VS Chamber Orchestra: Community Edition（Versilian Studios，github.com/sgossner/VSCO-2-CE） | `instruments/vsco2ce/` | **CC0 1.0** | 不强制；作者希望致谢 "Versilian Studios / Sam Gossner"（管风琴为 Ivy Audio / Simon Dalzell） |
| Versilian Community Sample Library（github.com/sgossner/VCSL） | `instruments/vcsl/` | **CC0 1.0** | 不强制 |
| FreePats（freepats.zenvoid.org）：古典吉他、尤克里里、清音电吉他、指弹电贝斯、卡林巴、手碟、手风琴、水杯琴、老式钢琴、风笛、世界打击 | `instruments/freepats/<名>/` | **CC0 1.0** | 不强制 |
| Karoryfer Samples（github.com/sfzinstruments）：二胡 aliexpress-erhu、爵士低音提琴 Sneakybass、中音萨克斯 Weresax | `instruments/karoryfer/` | **CC0 1.0** | 不强制 |
| **Salamander Grand Piano V3**（Alexander Holm；FreePats FLAC 版） | `instruments/salamander/` | **CC BY 3.0** | **用了 `piano` 就必须写** ↓ |
| **MuldjordKit**（Lars Muldjord；FreePats 版） | `instruments/freepats/muldjord_kit/` | **CC BY 4.0** | **用了 `drum_kit` 就必须写** ↓ |

用到 `piano`，CREDITS 里原样写：

```
Piano: "Salamander Grand Piano V3" by Alexander Holm, licensed under CC BY 3.0 (https://creativecommons.org/licenses/by/3.0/)
```

用到 `drum_kit`，CREDITS 里原样写：

```
Drums: "MuldjordKit" by Lars Muldjord (drumgizmo.org), FreePats version, licensed under CC BY 4.0 (https://creativecommons.org/licenses/by/4.0/)
```

建议（CC0 部分，非强制，一行即可）：`Samples (CC0): Versilian Studios VSCO 2 CE & VCSL, FreePats, Karoryfer Samples`。
最省事：`print('\n'.join(S.credits(['piano', 'cellos', 'drum_kit'])))` 自动生成。`pluck.py` 是纯合成，无授权要求。

对采样的处理（均在授权允许范围内）：VSCO/VCSL/Karoryfer 的 WAV 已**无损**转为 FLAC（逐样本比对一致）；Salamander 只保留 16 个力度层中的 5 层（v2/v6/v10/v13/v16）；FreePats 包里的照片（部分为 CC BY-NC）已删除，只留音频与 sfz/说明。

---

## 5. 可用乐器清单

"采样音域"是实际录音覆盖的范围（已校正为实际发声音高，C4=60），超出几度也能用，只是移调变远。"力度层"=该乐器同一音的录音层数（1 = 只靠增益 + 压暗模拟力度）。

### 弦乐

| 名字 | 说明 | 来源 | 授权 | 采样音域 | 力度层 | 类型 |
|---|---|---|---|---|---|---|
| `violins` | 小提琴组 长音（揉弦） | VSCO 2 CE | CC0 1.0 | G3–D6 | 2 | 长音·可延长 |
| `violins_trem` | 小提琴组 震音 | VSCO 2 CE | CC0 1.0 | G3–D6 | 2 | 长音·可延长 |
| `violins_pizz` | 小提琴组 拨奏 | VSCO 2 CE | CC0 1.0 | G3–D6 | 2 | 自然衰减 |
| `violins_spic` | 小提琴组 跳弓（短音） | VSCO 2 CE | CC0 1.0 | G3–D6 | 2 | 自然衰减 |
| `violin` | 独奏小提琴 长音 | VSCO 2 CE | CC0 1.0 | G3–C7 | 2 | 长音·可延长 |
| `violin_pizz` | 独奏小提琴 拨奏 | VSCO 2 CE | CC0 1.0 | G3–C7 | 2 | 自然衰减 |
| `violas` | 中提琴组 长音 | VSCO 2 CE | CC0 1.0 | C3–D6 | 2 | 长音·可延长 |
| `violas_pizz` | 中提琴组 拨奏 | VSCO 2 CE | CC0 1.0 | C3–D6 | 2 | 自然衰减 |
| `cellos` | 大提琴组 长音 | VSCO 2 CE | CC0 1.0 | C2–F5 | 2 | 长音·可延长 |
| `cellos_pizz` | 大提琴组 拨奏 | VSCO 2 CE | CC0 1.0 | C2–F5 | 2 | 自然衰减 |
| `cellos_spic` | 大提琴组 跳弓 | VSCO 2 CE | CC0 1.0 | C2–F5 | 2 | 自然衰减 |
| `contrabass` | 低音提琴 长音 | VSCO 2 CE | CC0 1.0 | F#1–B3 | 2 | 长音·可延长 |
| `contrabass_pizz` | 低音提琴 古典拨奏 | VSCO 2 CE | CC0 1.0 | E1–B3 | 2 | 自然衰减 |
| `harp` | 竖琴 | VCSL | CC0 1.0 | E1–F7 | 4 | 自然衰减 |

### 木管

| 名字 | 说明 | 来源 | 授权 | 采样音域 | 力度层 | 类型 |
|---|---|---|---|---|---|---|
| `flute` | 长笛 长音 | VSCO 2 CE | CC0 1.0 | C4–C7 | 1 | 长音·可延长 |
| `flute_stac` | 长笛 断奏 | VSCO 2 CE | CC0 1.0 | A4–C7 | 4 | 自然衰减 |
| `piccolo` | 短笛 | VSCO 2 CE | CC0 1.0 | G5–G7 | 1 | 长音·可延长 |
| `clarinet` | 单簧管 长音 | VSCO 2 CE | CC0 1.0 | D3–F#6 | 3 | 长音·可延长 |
| `clarinet_stac` | 单簧管 断奏 | VSCO 2 CE | CC0 1.0 | D3–F6 | 3 | 自然衰减 |
| `oboe` | 双簧管 长音 | VSCO 2 CE | CC0 1.0 | A#3–F6 | 2 | 长音·可延长 |
| `oboe_stac` | 双簧管 断奏 | VSCO 2 CE | CC0 1.0 | A#3–F6 | 3 | 自然衰减 |
| `bassoon` | 巴松 长音 | VSCO 2 CE | CC0 1.0 | A#1–D#5 | 2 | 长音·可延长 |
| `bassoon_stac` | 巴松 断奏 | VSCO 2 CE | CC0 1.0 | A#1–C5 | 2 | 自然衰减 |
| `recorder` | 中音竖笛（巴洛克） | VCSL | CC0 1.0 | F4–E6 | 1 | 长音·可延长 |
| `ocarina` | 陶笛 | VCSL | CC0 1.0 | A4–C#6 | 1 | 长音·可延长 |
| `tenor_sax` | 次中音萨克斯 揉音 | VCSL | CC0 1.0 | A#2–D6 | 1 | 长音·可延长 |
| `tenor_sax_nv` | 次中音萨克斯 直音 | VCSL | CC0 1.0 | G#2–E6 | 2 | 长音·可延长 |
| `tenor_sax_stac` | 次中音萨克斯 断奏 | VCSL | CC0 1.0 | G#2–E6 | 2 | 自然衰减 |
| `alto_sax` | 中音萨克斯（Weresax） | Karoryfer | CC0 1.0 | C#3–G#5 | 2 | 长音·可延长 |
| `harmonica` | 半音阶口琴 | VCSL | CC0 1.0 | C3–C7 | 1 | 长音·可延长 |

### 铜管

| 名字 | 说明 | 来源 | 授权 | 采样音域 | 力度层 | 类型 |
|---|---|---|---|---|---|---|
| `trumpet` | 小号 长音 | VSCO 2 CE | CC0 1.0 | F3–C6 | 2 | 长音·可延长 |
| `trumpet_stac` | 小号 断奏 | VSCO 2 CE | CC0 1.0 | F3–C6 | 3 | 自然衰减 |
| `trumpet_mute` | 小号 直弱音器 | VSCO 2 CE | CC0 1.0 | A#3–A5 | 2 | 长音·可延长 |
| `horn` | 圆号 长音 | VSCO 2 CE | CC0 1.0 | A1–F5 | 4 | 长音·可延长 |
| `horn_stac` | 圆号 断奏 | VSCO 2 CE | CC0 1.0 | A1–F5 | 3 | 自然衰减 |
| `trombone` | 长号 长音 | VSCO 2 CE | CC0 1.0 | A#1–F4 | 3 | 长音·可延长 |
| `trombone_stac` | 长号 断奏 | VSCO 2 CE | CC0 1.0 | A#1–F4 | 4 | 自然衰减 |
| `tuba` | 大号 长音 | VSCO 2 CE | CC0 1.0 | F1–D4 | 3 | 长音·可延长 |
| `tuba_stac` | 大号 断奏 | VSCO 2 CE | CC0 1.0 | A1–D4 | 2 | 自然衰减 |

### 打击

| 名字 | 说明 | 来源 | 授权 | 采样音域 | 力度层 | 类型 |
|---|---|---|---|---|---|---|
| `timpani` | 定音鼓（5 面鼓；音高=主振动模 (1,1) 频谱实测）；变体：`drum1` `drum2` `drum3` `drum4` `drum5` | VSCO 2 CE | CC0 1.0 | F2–G3 | 3 | 自然衰减 |
| `glockenspiel` | 钟琴 | VCSL | CC0 1.0 | G5–C8 | 3 | 自然衰减 |
| `xylophone` | 木琴 | VCSL | CC0 1.0 | G4–C8 | 2 | 自然衰减 |
| `marimba` | 马林巴 | VCSL | CC0 1.0 | F2–C7 | 3 | 自然衰减 |
| `vibraphone` | 颤音琴 软槌 | VCSL | CC0 1.0 | F3–E6 | 2 | 自然衰减 |
| `vibraphone_hard` | 颤音琴 硬槌 | VCSL | CC0 1.0 | F3–E6 | 2 | 自然衰减 |
| `vibraphone_bowed` | 颤音琴 弓奏（空灵长音） | VCSL | CC0 1.0 | A3–E6 | 1 | 长音·可延长 |
| `tubular_bells` | 管钟 | VCSL | CC0 1.0 | C4–E5 | 5 | 自然衰减 |
| `hand_chimes` | 手摇钟（柔和钟声） | VCSL | CC0 1.0 | C4–C7 | 1 | 自然衰减 |
| `kalimba` | 卡林巴（拇指琴） | FreePats | CC0 1.0 | F3–C#5 | 1 | 自然衰减 |
| `mbira` | 姆比拉/坦桑尼亚卡林巴（更粗粝；原琴非平均律，已按实测校到平均律） | VCSL | CC0 1.0 | G2–C#7 | 1 | 自然衰减 |
| `hang` | 手碟 Hang（D 小调，仅原琴音最好听） | FreePats | CC0 1.0 | A3–D5 | 1 | 自然衰减 |
| `glass` | 水杯琴 | FreePats | CC0 1.0 | A#4–F6 | 1 | 自然衰减 |
| `bass_drum` | 音乐会大鼓（7 力度层） | VSCO 2 CE | CC0 1.0 | — | 7 | 无音高 |
| `gran_cassa` | 大鼓 2（含滚奏/渐强）；变体：`hit` `roll` `roll_fast` `cresc` `rub` | VCSL | CC0 1.0 | — | 5 | 无音高 |
| `snare` | 军鼓（管弦）；变体：`on` `off` `roll` `roll_off` | VSCO 2 CE | CC0 1.0 | — | 5 | 无音高 |
| `snare2` | 军鼓 2（近拾音）；变体：`on` `off` `roll` `stick` `taps` | VCSL | CC0 1.0 | — | 5 | 无音高 |
| `toms` | 通鼓（高/低 × 鼓棒/槌）；变体：`high` `low` `high_mallet` `low_mallet` `roll` | VCSL | CC0 1.0 | — | 3 | 无音高 |
| `crash` | 对镲（管弦） | VSCO 2 CE | CC0 1.0 | — | 4 | 无音高 |
| `clash` | 对镲 2；变体：`crash` `short` | VCSL | CC0 1.0 | — | 4 | 无音高 |
| `sus_cymbal` | 吊镲（软槌/棒/镲帽/滚奏/渐强/弓）；变体：`hit` `stick` `bell` `roll` `cresc` `bow` `scrape` | VCSL | CC0 1.0 | — | 4 | 无音高 |
| `gong` | 大锣/Tam-tam | VSCO 2 CE | CC0 1.0 | — | 4 | 无音高 |
| `gong2` | 锣 2（含小锣、刮奏）；变体：`big` `small` `scrape` | VCSL | CC0 1.0 | — | 4 | 无音高 |
| `triangle` | 三角铁；变体：`open` `muted` `semi` `roll` | VCSL | CC0 1.0 | — | 2 | 无音高 |
| `tambourine` | 铃鼓 | VSCO 2 CE | CC0 1.0 | — | 2 | 无音高 |
| `claves` | 响棒 | VSCO 2 CE | CC0 1.0 | — | 3 | 无音高 |
| `cowbell` | 牛铃 | VSCO 2 CE | CC0 1.0 | — | 4 | 无音高 |
| `sleighbells` | 雪橇铃 | VSCO 2 CE | CC0 1.0 | — | 1 | 无音高 |
| `log_drum` | 木鱼鼓/裂缝鼓；变体：`hi` `lo` | VSCO 2 CE | CC0 1.0 | — | 3 | 无音高 |
| `woodblock` | 木块；变体：`a` `b` `c` | VCSL | CC0 1.0 | — | 4 | 无音高 |
| `frame_drum` | 手鼓/框鼓；变体：`large` `small` `large_muted` `small_muted` `hand` | VCSL | CC0 1.0 | — | 2 | 无音高 |
| `hihat` | 踩镲；变体：`closed` `open` `loose` `pedal` | VCSL | CC0 1.0 | — | 4 | 无音高 |
| `cajon` | 卡洪鼓；变体：`bass` `slap` `tone` | VCSL | CC0 1.0 | — | 3 | 无音高 |
| `conga` | 康加鼓；变体：`conga` `quinto` `tumba` `muted` | VCSL | CC0 1.0 | — | 4 | 无音高 |
| `claps` | 拍手；变体：`group` `solo` | VCSL | CC0 1.0 | — | 4 | 无音高 |
| `shaker` | 沙锤；变体：`down` `up` `slap` `roll` | VCSL | CC0 1.0 | — | 1 | 无音高 |
| `nepal_bells` | 尼泊尔手铃 | VCSL | CC0 1.0 | — | 1 | 无音高 |
| `world_perc` | 世界打击（卡洪/邦戈/蛋沙锤/响板/达布卡等，变体见 info()）；变体：`cajon_flamenco_1` `cajon_flamenco_3` `cajon_flamenco_2` `bongo_muted` `bongo_high` `bongo_low_low_velocity` `bongo_low_high_velocity` `egg_shaker_slow` `egg_shaker_fast` `egg_shaker_soft` `tambourine` `tambourine_fast` `hand_clap` `claves` `castanets` `conga` `low_conga` `high_conga` `muted_conga` `muted_low_conga` `maracas_fw` `maracas_bw` `darbuka_doom` `darbuka_tak` `darbuka_pa` | FreePats | CC0 1.0 | — | 2 | 无音高 |
| `drum_kit` | 流行鼓组 MuldjordKit（CC BY 4.0）；变体：`kick_drum_left` `kick_drum_right` `snare_1` `snare_2` `hi_hat_closed` `hi_hat_open` `ride_left` `ride_bell_left` `ride_right` `ride_bell_right` `crash_left` `crash_right` `china` `tom_1` `tom_2` `tom_3` `tom_4` `snare_rest_1` `snare_rest_2` | MuldjordKit | CC BY 4.0 | — | 16 | 无音高 |

### 键盘

| 名字 | 说明 | 来源 | 授权 | 采样音域 | 力度层 | 类型 |
|---|---|---|---|---|---|---|
| `piano` | Salamander 三角钢琴（Yamaha C5，5 力度层） | Salamander | CC BY 3.0 | A0–C8 | 5 | 自然衰减 |
| `upright` | 立式钢琴（温暖、略旧） | VSCO 2 CE | CC0 1.0 | C1–G7 | 3 | 自然衰减 |
| `honky_tonk` | 老式自动钢琴（酒馆 honky-tonk 味） | FreePats | CC0 1.0 | G#0–B7 | 1 | 自然衰减 |
| `harpsichord` | 羽管键琴（意大利式） | VCSL | CC0 1.0 | F#1–B5 | 1 | 自然衰减 |
| `organ` | 管风琴 手键盘全开（含 16' 音栓，厚重） | VSCO 2 CE | CC0 1.0 | C2–C7 | 1 | 长音·可延长 |
| `organ_soft` | 管风琴 手键盘柔和音栓 | VSCO 2 CE | CC0 1.0 | C2–C7 | 1 | 长音·可延长 |
| `organ_pedal` | 管风琴 踏板低音（音高按实测） | VSCO 2 CE | CC0 1.0 | F#1–F#4 | 1 | 长音·可延长 |
| `accordion` | 按键手风琴 | FreePats | CC0 1.0 | B2–G5 | 1 | 长音·可延长 |

### 拨弦

| 名字 | 说明 | 来源 | 授权 | 采样音域 | 力度层 | 类型 |
|---|---|---|---|---|---|---|
| `guitar_nylon` | 尼龙弦古典吉他 | FreePats | CC0 1.0 | G1–C6 | 1 | 自然衰减 |
| `ukulele` | 尤克里里 | FreePats | CC0 1.0 | B2–C6 | 1 | 自然衰减 |
| `electric_guitar` | 清音电吉他 | FreePats | CC0 1.0 | C2–C#6 | 3 | 自然衰减 |
| `electric_bass` | 电贝斯 指弹 | FreePats | CC0 1.0 | E1–D#2 | 1 | 自然衰减 |
| `jazz_bass` | 低音提琴 爵士拨弦（Sneakybass） | Karoryfer | CC0 1.0 | C1–C4 | 1 | 自然衰减 |
| `strumstick` | Strumstick 民谣扬琴式拨弦（钢弦民谣感） | VCSL | CC0 1.0 | D3–A5 | 3 | 自然衰减 |
| `dan_tranh` | 越南筝 Đàn tranh（与古筝同源，可作古筝） | VCSL | CC0 1.0 | B2–B5 | 3 | 自然衰减 |
| `dan_tranh_trem` | 越南筝 摇指 | VCSL | CC0 1.0 | B2–B5 | 1 | 长音·可延长 |

### 民族

| 名字 | 说明 | 来源 | 授权 | 采样音域 | 力度层 | 类型 |
|---|---|---|---|---|---|---|
| `erhu` | 二胡 长音 | Karoryfer | CC0 1.0 | D4–A5 | 1 | 长音·可延长 |
| `erhu_stac` | 二胡 短弓 | Karoryfer | CC0 1.0 | D4–A5 | 1 | 自然衰减 |
| `bagpipe` | 风笛（旋律管；G2/G3 为持续低音管） | FreePats | CC0 1.0 | G2–G5 | 1 | 长音·可延长 |

### 物理建模（pluck.py）

`guqin` `pipa` `shamisen` `koto` `banjo` `acoustic_guitar` `nylon_guitar` `upright_bass_pizz` `harp` `kalimba` `music_box`——任意音高（C4=60，可小数），见第 3 节。

### 别名

`strings`→violins，`cello`→cellos，`viola`→violas，`double_bass`→contrabass，`upright_bass_pizz`→jazz_bass，`french_horn`→horn，`glock`→glockenspiel，`vibes`→vibraphone，`chimes`→tubular_bells，`grand_piano`→piano，`acoustic_guitar`→guitar_nylon（sampler 里；pluck 里 `acoustic_guitar` 是钢弦模型），`guzheng`/`zither`→dan_tranh，`sax`→tenor_sax，`kick`→bass_drum，`cymbal`→crash，`tamtam`→gong，`celesta`→glockenspiel（没有钢片琴采样，钟琴最接近）。

---

## 6. 按风格挑乐器（速查）

| 想要的感觉 | 推荐组合 |
|---|---|
| 管弦 / 史诗 / 纪录片 | `violins` `violas` `cellos` `contrabass` 铺底（`attack=.3~.8` 淡入）+ `horn` `trombone` `tuba` + `timpani` `gran_cassa` `sus_cymbal:roll` `gong`；轻快段落用 `violins_spic` `cellos_pizz` `flute_stac` |
| 童话 / 温柔 / 手作 | `glockenspiel` `celesta→glockenspiel` `pluck:music_box` `kalimba` `harp` `vibraphone` `hand_chimes` `ukulele` `guitar_nylon` + `clarinet` `flute` |
| 中国风 | 采样：`erhu` `dan_tranh`（当古筝）`dan_tranh_trem`（摇指）`gong2:small` `frame_drum` `log_drum` `woodblock`；建模：`pluck:guqin`（含滑音/泛音）`pluck:pipa`（轮指）；笛/箫没有采样，用 `flute` `recorder` `ocarina` 代替 |
| 日式 | `pluck:shamisen` `pluck:koto` + `flute`/`recorder`（代尺八）+ `gran_cassa` `frame_drum:large` `toms:low_mallet`（没有 CC0/CC BY 太鼓，用这几样叠出来） |
| 爵士 / 咖啡馆 | `piano` `jazz_bass` `alto_sax` `tenor_sax` `trumpet_mute` `vibraphone_hard` + `drum_kit:ride` `drum_kit:hihat` `snare2:taps` `claps` |
| 复古 / 老电影 / 酒馆 | `honky_tonk` `upright` `accordion` `harmonica` `banjo` `clarinet` `tuba_stac` `strumstick` |
| 巴洛克 / 宫廷 | `harpsichord` `organ_soft` `recorder` `violin` `cellos` `oboe` `bassoon` |
| 教堂 / 神圣 | `organ` `organ_pedal` `tubular_bells` `hand_chimes` `vibraphone_bowed` + 长 `room(size=.8)` |
| 流行 / 轻快 | `drum_kit` `electric_bass` `electric_guitar` `piano` `glockenspiel` `claps` `shaker` `tambourine` |
| 世界 / 民谣 | `world_perc`（卡洪/邦戈/达布卡/响板/沙锤）`cajon` `conga` `mbira` `hang` `bagpipe` `pluck:banjo` `guitar_nylon` |
| 冷 / 空灵 / 科幻 | `vibraphone_bowed` `glass` `hang` `sus_cymbal:bow` `violins_trem`（弱力度）+ `room(size=.9, mix=.35)` |

---

## 7. 已知问题 / 注意事项

- **`organ`（全开音栓）含 16′**：实测基频比键名低一个八度（pyin 测到 D3 对应键 D4），这是管风琴本来的厚度；想要"键名=实际音高"用 `organ_soft`。`organ_pedal` 的音高按实测给出。
- **管钟 `tubular_bells`**：管钟的"击音"是虚拟音高（第 4/5/6 分音 2:3:4 的缺失基频），频谱核对无误，但 pyin 会报高八度/五度——属正常。
- **定音鼓 `timpani`**：只有 5 面鼓（主振动模频谱实测约 F2、B2、D3、E3、G3），`note('timpani', X)` 会从最近的鼓移调；最自然的用法是 `hit('timpani', 'drum1'...)` 或只写 F2–G3 之间的音。
- **手碟 `hang`**：原琴是 D 小调（A3 D4 E4 F4 G4 A4 C5 D5 等），弹原琴音最好听；其它音是移调得到的，泛音会跟着偏。
- **`tenor_sax`（揉音版）起音较慢**，短音请用 `tenor_sax_stac`/`tenor_sax_nv`；`contrabass` 长音录音里有真实的换弓起伏（约每 2.3 s 一次）。
- **长音延长**在 25 s 级别测试过：延长段电平与原录音中位数相差 <1 dB，相邻 0.1 s 的电平跳变多数 ≤3 dB（小提琴组/萨克斯因揉弦本身起伏最多 ~6 dB）。极端长（>1 分钟）的持续音建议分段重触发或加 `attack` 淡入叠接。
- **缺的乐器**：没找到 CC0/CC BY 授权的**太鼓、中国锣鼓（大鼓/钹/小锣整套）、钢片琴、八音盒采样、原声钢弦吉他采样、笛子/箫/尺八**（Floe/SCC 太鼓是 CC BY-SA，按要求不收）。替代：太鼓→`gran_cassa`+`frame_drum`+`toms:low_mallet`；锣→`gong`/`gong2:small`；钢片琴→`glockenspiel`（弱力度）；八音盒→`pluck:music_box`；钢弦吉他→`pluck:acoustic_guitar`/`strumstick`。
- 下载时个别文件缺失：FreePats 尤克里里的 `chuck.wav`（闷音扫弦）已用 7-Zip 补回；无其它缺失。
- 首次调用 `pluck` 会 JIT 编译（numba，~0.5 s，结果缓存在 `core/audio/__pycache__`）；`sampler` 首次读某采样 ~10 ms，之后走内存缓存（移调结果也缓存）。
- 立体声：采样读入时已混成单声道（接口统一），空间感靠 `pan` + `room()`。

---

## 8. 已做的自检（我听不到声音，全部靠数据）

**验证了什么**
1. **音高**：全部 97 件采样乐器的每个采样都用 yin 测过基频，写进 `index.json`；按八度一致性投票修正了文件名的八度约定（VSCO/VCSL 多数 +12，Karoryfer −12，定音鼓用频谱主振动模）。61 件乐器的首音**单独渲染后用 librosa.pyin 抽查：59/61 在 ±50 音分内，通过者中位偏差 +3.7 音分、最大 16 音分**；2 个“失败”都是已知且核对过的：管钟（虚拟音高，频谱 2:3:4 分音确认击音正确）、`organ`（16′ 音栓，基频低八度）。在成片混音里直接抽查同样 61 个首音：57/61 通过，另外 4 个（钟琴、管钟、二胡、班卓）是被上一件乐器的余音干扰或虚拟音高，单独渲染/频谱核对均正确（钟琴单独渲染频谱峰 = D6 +12 音分）。
2. **物理建模**：11 个预设 × 2–3 个音高全部 pyin 命中（±1 音分内）；古琴 `bend` 的 pyin 轨迹与设定一致（0.8→1.4 s 从 50 滑到 52）；泛音音高正确；琵琶轮指实测 13.3 次/秒（设定 14）；三味线 sawari 开/关的持续段频谱重心 2030 Hz / 1500 Hz；衰减时间 guqin≈4.3 s、pipa≈2.1 s、shamisen≈0.9 s、banjo≈1.0 s（-30 dB 外推的 T60）。
3. **成片数值**：85.5 s、48 kHz 立体声、无 NaN/Inf、峰值 −2.0 dBFS、0 个削波样本；0.5 s RMS 中位 −24 dBFS。
4. **长音延长**：小提琴组/大提琴组/长笛/小号/圆号/单簧管/双簧管/手风琴/风笛/二胡/萨克斯/管风琴渲染 14–25 s 长音，延长段无静音洞、电平与原录音一致（见上条数据）。
5. **所有乐器**都实际加载并渲染过一次（无异常、无 NaN），所有打击变体各打一次，峰值已按变体归一到 ~0.4。

**没法验证的**
- 主观音色是否"像"、混音是否好听、力度层切换是否平滑、延长拼接处是否有可闻的相位/音色跳变——只能靠数据间接判断，建议第一次用时自己耳朵听一下（每件乐器弹一个小动机即可）。
- 物理建模的"民族味"（古琴的松沉、三味线的 sawari 质感）只按物理参数和频谱趋势调过，没有和真实录音做听感对比。
- 微分音、超出采样音域 ±6 半音以上的移调音色。

---

## 9. 目录结构

```
core/audio/
  sampler.py            采样乐器引擎（本文件第 2 节）
  pluck.py              物理建模拨弦 + 模态合成（第 3 节）
  instruments/
    index.json          音高/力度/电平索引（build_index() 可重建）
    vsco2ce/            VSCO 2 CE 精选（弦乐/木管/铜管/打击/立式钢琴/管风琴）  395 MB
    vcsl/               VCSL 精选（竖琴/颤音琴/管钟/马林巴/羽管键琴/萨克斯/口琴/越南筝/打击…） 271 MB
    salamander/         Salamander Grand Piano V3（5 力度层 FLAC 48k/24bit）  218 MB
    freepats/           FreePats CC0 各包 + MuldjordKit（CC BY 4.0）  397 MB
    karoryfer/          二胡 / Sneakybass / Weresax  74 MB
```

来源链接：VSCO 2 CE https://github.com/sgossner/VSCO-2-CE · VCSL https://github.com/sgossner/VCSL · Salamander https://freepats.zenvoid.org/Piano/acoustic-grand-piano.html · FreePats https://freepats.zenvoid.org/ · Karoryfer https://github.com/sfzinstruments （aliexpress-erhu / karoryfer.sneakybass / karoryfer.weresax）

可用性：采样库要先下载（`sh tools/fetch.sh instruments <lib>`，见文首）。用到没下载的库时，`sampler` 报错并给出要跑的那条命令。`sampler.py` 只需核心层 Python 包；`pluck.py` 需要 numba（`setup.sh deps music`）。
