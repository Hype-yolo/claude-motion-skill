# 《一个月饼的相思》配乐候选

所有候选曲都没有试听过。筛选依据是来源页面的元数据（标题、标签、描述、乐器表），再加上 librosa 分析。原始数据在 `analysis.json`。

**怎么读数据**
- **arc** 是每 5 秒窗口的 RMS 响度，单位 dB，以整首曲子最响的一帧为 0 dB。每行 30 秒，数值越接近 0 越响。
- **RMS dBFS** 是整首曲子的平均电平，混音前用它来对齐几首曲子的音量。
- **Tempo** 是 librosa 的节拍估计。自由速度的钢琴曲和民乐独奏，这个值不可靠。
- **perc** 是 HPSS 分离后打击成分的能量占比，小于 0.05 基本可以认为没有鼓。
- **pent** 是和声声部 chroma 能量落在最佳匹配大调五声音阶上的比例。数值高（大于 0.75）说明是纯五声调式，也就是中国宫调式的听感；日本都节 / 阴音阶里的半音在这项上会拿低分。

**旁白时间参考**：根据 `vo/dur.json` 加每句 0.9 s 的间隔估算，旁白总长约 111 s。按 125 s 成片等比放大约 ×1.12 后，大致时间点如下：
- 厨房段 L03–L06 ≈ 10–28 s
- "我出发了" L10 ≈ 45 s
- 旅途 L11–L14 ≈ 47–72 s
- 拆盒、外婆字条 L16–L17 ≈ 79–86 s
- 反转 L19–L21 ≈ 93–107 s
- 苏轼 / "但愿人长久" L22–L23 ≈ 109–117 s
- "中秋快乐" L25 ≈ 122 s

---

## 推荐排名

### 第 1 名（首选）：Ripples → Nu Flute 双曲接力（Kevin MacLeod，CC BY 4.0）
- **为什么选它**
  - 真实的古筝（Ripples）和竹笛 + 弦乐（Nu Flute）。
  - Ripples 的五声占比 0.83，是纯宫调式，听感偏中国而不是日本。
  - 两首都没有鼓（perc 0.017 / 0.006）。
  - 调性兼容，都以 C 五声为中心，可以直接交叉淡化。
  - 许可证最干净：CC BY 4.0，没有 Content ID 风险。
- **拼接方案**
  1. Ripples 从 0:00 起用，成片 0–约 46 s 覆盖厨房、装盒、"我出发了"。开头 10 s 很轻（-18/-17 dB），10 s 后古筝才真正进来。
  2. Nu Flute 在成片约 42 s 处用 4 s 交叉淡化进入，自然播完 82.8 s，刚好落在成片 125 s。
  3. 这样 Nu Flute 自身的时间点对应到成片是：
     - 35 s 的抬升（+3.8 dB）→ 成片约 77 s，也就是拆盒、外婆字条。
     - 65 s 的回落（-6.3 dB）→ 成片约 107 s，苏轼那句前面留出一口气。
     - 70 s 的再抬升（+4.3 dB）→ 成片约 112 s，正好是"但愿人长久"。
     - 80 s 后收尾 → 最后的"中秋快乐"。
  4. 如果旁白最终时间有变，平移 Nu Flute 的起点，让它的 70 s 峰落在 L23 上就行。
- **电平**：Ripples 平均约 -22 dBFS，Nu Flute 约 -18.7 dBFS。接的时候把 Nu Flute 压低约 3 dB。
- **风险**
  - Nu Flute 标签里有 "Somber"，整体偏淡淡的忧伤，好在也有 "Uplifting"，和"相思 + 团圆"的调子一致。
  - Ripples 在 incompetech 的乐器表里写成 "Koto"，但描述里明确说是中国古筝，chroma 分析也支持五声。

### 第 2 名：NastelBom "Asian - Asian China Chinese Music"（Pixabay，单曲自带起伏）
- **为什么选它**
  - 是这批里中国味最正的一首：五声占比 0.84，纯宫调式；描述写的是 "traditional Chinese instruments"，分类是弦乐四重奏。
  - 没有鼓（perc 0.01）。
  - 单曲自带弧线：开头 0–20 s 很轻 → 20 s 全面进入 → 110–130 s 回落 → 130 s 大幅抬升（+6.3 dB），一直到 170 s 结束。
- **用法**：原曲长 178 s，套到 125 s 成片上需要剪一刀。
  - 删掉曲中 20–110 s 的平台段里约 25 s，例如 55→80 s，接点放在小节线上。
  - 删完后，回落落在成片约 85–105 s（反转段），抬升落在约 105 s（苏轼 / 月亮）。
- **风险（重要）**
  - Pixabay 页面标注了 **"Content ID Registered"**。发 YouTube 可能被自动认领，需要保留 Pixabay 下载页作为授权证明去申诉。国内平台一般不受影响。
  - 这首曲子的母带很响（-13.5 dBFS），要压低约 8 dB 才能和其他曲子对齐。

### 第 3 名：Scott Buckley "Echoes Of Home"（CC BY 4.0，西洋管弦，弧线最好）
- **为什么选它**
  - 响度曲线是一条教科书式的长渐强：-22 dB 起，55 s 到 -14，75 s 到 -12，峰值在 145–155 s 左右（-7 dB）。
  - 作者描述是温暖怀旧的管弦乐，风格接近 Zelda / 吉卜力。
  - 没有鼓（perc 0.028）。
- **用法**：从曲中 35 s 处开始放，对应成片 0 s。
  - 峰值会落在成片约 110–120 s，正好是"但愿人长久"。
  - 成片最后 5 s 淡出。
- **不足**：没有中国乐器（五声占比 0.63，是西洋和声）。如果想要中国味，可以作为兜底，或者和第 1 名混搭（开头用古筝，高潮换这首的管弦）。

### 第 4 名：NourishedByMusic "Mo Li Hua - Chinese Jasmine Flower"（Pixabay）
- 竹笛为主。五声占比 0.79，没有鼓，几乎没有低频（<250 Hz 的能量只占 0.4%）。
- 母带非常轻（-27.8 dBFS），需要提升约 8 dB。
- **弧线**：前 100 s 平稳 → 100–135 s 回落 → 135 s 重新进入（+8.8 dB）→ 170 s 起淡出。
- **没排更前的原因**：《茉莉花》旋律辨识度太高，容易抢旁白的注意力，也会把联想带到江南 / 茉莉，而不是月亮和思乡。

### 第 5 名：Scott Buckley "The Long Way Home"（CC BY 4.0）
- **特点**
  - 作者描述是简单怀旧的钢琴，像摇篮曲，配柔和的弦乐和合成器。
  - 最安静、最不抢戏。
  - 约 125 s 后进入安静尾声。
- **不足**：开头没有弱起（第一个窗口就是 -8 dB），整体几乎是平的，也没有中国味。适合做"只要柔、不要抢"的保底。

---

## 候选曲目详情

### 1. `km_Ripples.mp3`
- **曲名 / 作者**：Ripples / Kevin MacLeod
- **许可证**：CC BY 4.0（https://creativecommons.org/licenses/by/4.0/）
- **署名**："Ripples" Kevin MacLeod (incompetech.com) / Licensed under Creative Commons: By Attribution 4.0 License / http://creativecommons.org/licenses/by/4.0/
- **来源**：https://incompetech.com/music/royalty-free/mp3-royaltyfree/Ripples.mp3（目录页：https://incompetech.com/music/royalty-free/music.html）
- **时长**：3:25（205.5 s）
- **Tempo**：目录标 57 BPM；librosa 估 117（是双倍误判）
- **来源页的乐器和情绪**
  - 乐器表写 "Koto"。
  - 描述说这是中国古筝孤独的拨弦，像流水一样宁静，适合内省、亚洲题材的内容。
  - Feel 标签：Calming, Mystical, Relaxed。
- **分析**
  - RMS -22.2 dBFS，频谱质心 893 Hz。
  - 能量分布：低 0.17 / 中 0.82 / 高 0.01。
  - perc 0.017，pent(C) 0.83。
- **5 s 响度曲线（dB）**：
  - 0–25 s: -18 -17 -13 -15 -11 -12
  - 30–55 s: -16 -11 -14 -14 -16 -15
  - 60–85 s: -14 -16 -11 -13 -16 -12
  - 90–115 s: -10 -13 -14 -14 -13 -12
  - 120–145 s: -13 -14 -21 -13 -9 -12
  - 150–175 s: -10 -11 -13 -11 -16 -14
  - 180–205 s: -13 -9 -12 -21 -50 (end)
- **抬升点**：10 s（+4.1）、70 s（+3.8）、130 s 短暂停顿（-7.8）后 140 s 抬升（+8.4，全曲最大）、185 s（+4.3）；约 195 s 开始淡出。
- **结论**：平稳的古筝垫底，适合放在旁白下面。

### 2. `km_Nu_Flute.mp3`
- **曲名 / 作者**：Nu Flute / Kevin MacLeod
- **许可证**：CC BY 4.0
- **署名**："Nu Flute" Kevin MacLeod (incompetech.com) / Licensed under Creative Commons: By Attribution 4.0 License / http://creativecommons.org/licenses/by/4.0/
- **来源**：https://incompetech.com/music/royalty-free/mp3-royaltyfree/Nu%20Flute.mp3
- **时长**：1:23（82.8 s）
- **Tempo**：目录标 60 BPM；librosa 估 129（是双倍误判）
- **来源页的乐器和情绪**
  - 乐器表：Flute, Strings。描述说这是笛子（Dizi）。
  - Feel 标签：Calming, Relaxed, Somber, Uplifting。
- **分析**
  - RMS -18.7 dBFS，频谱质心 967 Hz。
  - 能量分布：低 0.31 / 中 0.68。
  - perc 0.006，pent(C) 0.61（弦乐和声里带 F，偏西洋配器）。
- **5 s 响度曲线（dB）**：
  - 0–25 s: -9 -8 -5 -9 -6 -8
  - 30–55 s: -9 -5 -6 -8 -8 -8
  - 60–80 s: -8 -14 -7 -10 -46 (end)
- **抬升点**：10 s（+3.9）、35 s（+3.8）、65 s 回落（-6.3）后 70 s 抬升（+4.3）；80 s 结束。
- **结论**：适合做结尾那一段。

### 3. `pb_NastelBom_Asian_China_Chinese_Music.mp3`
- **曲名 / 作者**：Asian - Asian China Chinese Music / NastelBom（Dmitrii Spis）
- **许可证**：Pixabay Content License（https://pixabay.com/service/license-summary/）
  - 可以免费用于商业和非商业用途，可以修改，不要求署名。
  - 不能把音乐单独出售或二次分发。
  - **页面标注 "Content ID Registered"**。
- **署名（自愿，建议加上）**：Music: "Asian - Asian China Chinese Music" by NastelBom via Pixabay
- **来源**：https://pixabay.com/music/classical-string-quartet-asian-asian-china-chinese-music-501705/
  - 音频地址：https://cdn.pixabay.com/download/audio/2026/03/13/audio_494876aaa5.mp3
- **时长**：2:59（178.5 s）
- **Tempo**：librosa 估 89
- **来源页的乐器和情绪**
  - 描述：使用中国传统乐器的氛围器乐曲。
  - 流派：Classical String Quartet / China。情绪：Relaxing, Peaceful。
  - 标签：Chinese flute, Chinese festival, Oriental。
  - Pixabay 没有标 AI 生成。
- **分析**
  - RMS -13.5 dBFS（很响），频谱质心 1465 Hz。
  - 能量分布：中频占 0.95。
  - perc 0.010，pent(B) 0.84。
- **5 s 响度曲线（dB）**：
  - 0–25 s: -18 -18 -16 -14 -8 -6
  - 30–55 s: -6 -6 -5 -6 -6 -6
  - 60–85 s: -7 -7 -7 -6 -7 -6
  - 90–115 s: -7 -6 -8 -6 -12 -13
  - 120–145 s: -13 -12 -6 -7 -6 -5
  - 150–175 s: -4 -6 -5 -7 -6 -32 (end)
- **抬升点**：20 s（+6.9，全面进入）、25 s（+5.2）；110–125 s 回落段；130 s 抬升（+6.3），峰值在 150 s（-4）。
- **结论**：单曲弧线最完整，中国味最正。

### 4. `sb_EchoesOfHome.mp3`
- **曲名 / 作者**：Echoes Of Home / Scott Buckley
- **许可证**：CC BY 4.0
- **署名（作者指定格式）**：'Echoes Of Home' by Scott Buckley - released under CC-BY 4.0. www.scottbuckley.com.au
  - 作者要求：YouTube 视频的署名必须写在视频简介里。
- **来源**：https://www.scottbuckley.com.au/library/echoes-of-home/
  - 音频地址：https://www.scottbuckley.com.au/library/wp-content/uploads/2025/05/EchoesOfHome.mp3
- **时长**：4:52（291.7 s）
- **Tempo**：librosa 估 136（不可靠）
- **来源页的乐器和情绪**：温暖、怀旧的管弦乐，气质接近 Zelda 游戏和吉卜力电影。
- **分析**
  - RMS -17.2 dBFS，频谱质心 857 Hz。
  - 能量分布：低 0.72（弦乐和低音垫底厚）。
  - perc 0.028，pent 0.63（西洋和声）。
- **5 s 响度曲线（dB）**：
  - 0–25 s: -22 -24 -22 -20 -22 -22
  - 30–55 s: -21 -20 -20 -19 -19 -14
  - 60–85 s: -16 -14 -16 -12 -12 -14
  - 90–115 s: -12 -11 -12 -12 -12 -12
  - 120–145 s: -12 -11 -9 -10 -10 -7
  - 150–175 s: -7 -8 -10 -9 -10 -11
  - 180–205 s: -9 -10 -10 -12 -14 -13
  - 210–235 s: -14 -14 -14 -13 -12 -13
  - 240–265 s: -12 -12 -9 -8 -7 -10
  - 270–290 s: -9 -16 -20 -29 -55 (end)
- **抬升点**：55 s（+5.2）；130–155 s 缓升到主高潮（-7）；250–260 s 第二个高潮（-7）；275 s 起淡出。
- **结论**：整首是一条长渐强，高潮来得晚。

### 5. `pb_MoLiHua_JasmineFlower.mp3`
- **曲名 / 作者**：Mo Li Hua - Chinese Jasmine Flower / NourishedByMusic
- **许可证**：Pixabay Content License。不要求署名；页面没有标 Content ID，也没有标 AI 生成。
- **署名（自愿）**：Music: "Mo Li Hua - Chinese Jasmine Flower" by NourishedByMusic via Pixabay
- **来源**：https://pixabay.com/music/china-mo-li-hua-chinese-jasmine-flower-356371/
  - 音频地址：https://cdn.pixabay.com/download/audio/2025/06/07/audio_61d4f3c103.mp3
- **时长**：3:26（206.1 s）
- **Tempo**：librosa 估 99
- **来源页的乐器和情绪**
  - 标签：Chinese, Flute, Oriental, Classical, Instrumental, Ambient。
  - 情绪：Bright, Dreamy, Relaxing, Peaceful, Elegant, Floating。
  - 编曲基于传统民歌《茉莉花》。
- **分析**
  - RMS -27.8 dBFS（很轻），频谱质心 1759 Hz。
  - 能量分布：低 0.004，中 0.90，高 0.10。
  - perc 0.009，pent(C) 0.79。
- **5 s 响度曲线（dB）**：
  - 0–25 s: -6 -5 -5 -7 -6 -8
  - 30–55 s: -10 -6 -5 -6 -7 -6
  - 60–85 s: -8 -8 -5 -6 -6 -8
  - 90–115 s: -6 -9 -15 -13 -12 -13
  - 120–145 s: -12 -13 -15 -6 -5 -5
  - 150–175 s: -6 -6 -8 -9 -17 -16
  - 180–205 s: -20 -21 -17 -16 -18 -22
- **抬升点**：100 s 回落（-7.3）；135 s 重新进入（+8.8）、140 s（+5.3）；170 s 起淡出。

### 6. `sb_TheLongWayHome.mp3`
- **曲名 / 作者**：The Long Way Home / Scott Buckley
- **许可证**：CC BY 4.0
- **署名**：'The Long Way Home' by Scott Buckley - released under CC-BY 4.0. www.scottbuckley.com.au
- **来源**：https://www.scottbuckley.com.au/library/the-long-way-home/
  - 音频地址：https://www.scottbuckley.com.au/library/wp-content/uploads/2021/05/sb_thelongwayhome.mp3
- **时长**：2:53（172.7 s）
- **Tempo**：librosa 估 185（不可靠，是自由速度的钢琴）
- **来源页的乐器和情绪**：柔和、简单、怀旧的钢琴，几乎像摇篮曲；柔和的弦乐和合成器托着它飘回家。
- **分析**
  - RMS -18.6 dBFS，频谱质心 482 Hz（很暗、很柔）。
  - perc 0.049。
- **5 s 响度曲线（dB）**：
  - 0–25 s: -8 -10 -8 -8 -9 -6
  - 30–55 s: -7 -7 -7 -9 -9 -8
  - 60–85 s: -7 -8 -9 -7 -7 -6
  - 90–115 s: -6 -5 -6 -5 -6 -5
  - 120–145 s: -6 -10 -13 -13 -14 -14
  - 150–170 s: -16 -15 -17 -34 -40 (end)
- **抬升点**：没有明显的突然进入；95–120 s 是温和的平台峰（-5）；125 s 起进入安静尾声。

---

## 看过但没选的曲目（附原因）
- **Kevin MacLeod**
  - Shenyang：二胡、琵琶、扬琴加打击乐，129 BPM，太欢快。
  - Guzheng City：带 dhol 鼓，定位是"酒店大堂"。
  - Cattails：班卓琴、手风琴加二胡，西部乡村味。
  - Senbazuru、Finding Movement、Ishikari Lore：都是 koto，日本味。
- **Scott Buckley**
  - Moonlight：钢琴加弦乐，2022 年作品，曲名很合适，但 25–150 s 是一整段平台，没有中国味。下载地址是 wp-content/uploads/2022/07/Moonlight.mp3，需要的话可以备用。
  - Amberlight：有久石让的气质，但时长 4:43，峰值在中段。
  - Home Was You：有民谣打击乐，perc 0.215。
- **Pixabay**
  - kaazoom 的全部作品（A Peaceful Morning、Back To Hong Kong、Bamboo and Paper Lanterns、Mountain Spring 等）：作者简介里自称全部作品都是 AI 生成。
  - RainStreetCat、Asian_Background_Music、AiCanvas、JorisVermeer "Gentle Chinese Flute & Strings"：要么标了 AI 生成，要么是批量 BGM。
  - VPRODMUSIC "Mid Autumn Festival"：打击乐加进行曲感，perc 0.14，低频很重；另外标了 Content ID Registered。
  - VPRODMUSIC "Hoi An Ancient Charm"：越南题材，标了 Content ID Registered。
  - "lasting sorrow"：上传者匿名（用户号 38534292），时长 14 分钟，基调悲伤。
  - Joylo1111 "Plum Blossom (pure piano)"：5:19，偏台湾流行钢琴。可以作为备选。
- **free-stock-music.com 上的中文分类**：几乎全是新年、史诗、EDM 类型，或者是 CC BY-NC / BY-SA 许可证，不符合要求。

## 片尾署名（如果用首选方案）
```
Music:
"Ripples" Kevin MacLeod (incompetech.com)
"Nu Flute" Kevin MacLeod (incompetech.com)
Licensed under Creative Commons: By Attribution 4.0 License
http://creativecommons.org/licenses/by/4.0/
```
