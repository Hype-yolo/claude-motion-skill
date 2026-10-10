<div align="center">

# Lemo-Opuscar

**<!--n-->43<!--/n--> film styles, each with a short film made entirely in code.**<br>
**<!--n-->43<!--/n--> 种影片风格，每种都配一支完全用代码做出来的短片。**

Pick a style, bring your own story, and let your coding agent direct the film.<br>
选一个风格，带上你自己的故事，让你的编程 agent 来当导演。

[**▶ Watch the gallery · 看图鉴**](https://lemomo-ai.github.io/lemo-opuscar/)

**New · 新增：** Copperplate Engraving 铜版画 · Sci-fi Hologram HUD 科幻全息界面 · Mid-century Cartoon 50s 扁平卡通 · Silkscreen Travel Poster 丝印旅行海报

</div>

## 🎬 Feature presentation · 特别放映：OPUSCAR 98

<div align="center">

<a href="https://lemomo-ai.github.io/lemo-opuscar/#opuscar98"><img src="docs/opuscar98.jpg" alt="OPUSCAR 98 — 98 Years of Best Picture" width="100%"></a>

**98 Years of Best Picture · 1927 – 2025 · 6:25**<br>
**98 年最佳影片 · 1927 – 2025 · 6 分 25 秒**

One Clawd walks through all 98 Best Picture winners, each one redrawn in a style that fits the film.<br>
Every frame, every note and every cut was written in code by Claude Opus 5.5.<br>
一个 Clawd 走过 98 部最佳影片，每一部都换成贴合那部电影的画风。<br>
每一帧画面、每一个音符、每一刀剪辑，都是 Claude Opus 5.5 写代码做出来的。

[**▶ Watch · 观看**](https://lemomo-ai.github.io/lemo-opuscar/#opuscar98) · [**Download 1080p · 下载**](https://github.com/lemomo-ai/lemo-opuscar/releases/download/films/opuscar98.mp4)

</div>

## 👋 About me · 关于我

I'm **Lemomo** ([@lemomo-ai](https://github.com/lemomo-ai)). More about me on my profile.<br>
我是 **Lemomo**，更多信息见我的 [GitHub 主页](https://github.com/lemomo-ai)。

> **Not an awesome list.** Every film here was made by me, with Claude Opus 5.5. The styles are tuned for Opus 5.5; other models may not reproduce them.
>
> **这不是一个 awesome 合集。** 这里所有的片子都是我自己用 Claude Opus 5.5 做的。风格是按 Opus 5.5 调出来的，换成其他模型不保证能做出同样的效果。

![All styles · 全部风格](docs/cover.jpg)

Every film was directed, drawn, scored and mixed by an AI agent writing code: canvas and WebGL pages rendered frame by frame, original music from free sample libraries, text-to-speech narration. No video generation, no stock footage.

每一支片子都是 AI agent 写代码导演、作画、配乐、混音的：Canvas 和 WebGL 页面逐帧渲染，用免费采样库写原创配乐，TTS 配音。不用视频生成，也不用素材库画面。

## How to use · 怎么用

Two ways in; the skill is the easiest. · 两种用法，推荐装 skill，最省事。

### Option 1: install the skill (recommended) · 方式一：装成 skill（推荐）

In your terminal · 在终端里：

```sh
claude plugin marketplace add lemomo-ai/lemo-opuscar
claude plugin install lemo-opuscar@lemolab
```

Then use it from any folder. On first use it downloads the guides, tools and style prompts to `~/lemo-opuscar`, shared by all your films. Each film's project, from source to finished video, goes in the folder you started from. For other agents, copy [`plugin/skills/lemo-opuscar/`](plugin/skills/lemo-opuscar/) into their skills folder.

之后在任何目录都能用。第一次使用时，它会把指南、工具和风格提示词下载到 `~/lemo-opuscar`，所有片子共用这一份；每支片子的工程，从源码到成片，都放在你发起时所在的文件夹里。其他 agent 可以把 [`plugin/skills/lemo-opuscar/`](plugin/skills/lemo-opuscar/) 复制到它们的 skills 目录。

### Option 2: clone the repo · 方式二：clone 仓库

```sh
git clone https://github.com/lemomo-ai/lemo-opuscar.git
cd lemo-opuscar
claude
```

Films go into `films/<name>/` inside the repo.

片子做到仓库里的 `films/<名字>/`。

### Then just say what you want · 然后直接说

> Make a 45-second film in the **watercolor** style about the coffee farm my family runs. Warm female narrator.
>
> 用**油画厚涂**风格做一支 30 秒的片子，讲我家那只每天在窗台等我下班的橘猫。

Name the style in English or Chinese; the [style index](styles/README.md) lists them all. · 风格用英文名或中文名都行，全部风格见[风格索引](styles/README.md)。

It asks you once, up front: anything it can't decide about your topic, whether you have your own **voice, music or other material**, and whether you want to see a **storyboard** first. Say yes and it stops once to show you the key shots in the real style; otherwise it goes straight to the finished film.

它开工前只问你一次：主题里它定不了的事、你有没有自己的**配音、音乐或其他素材**、要不要先看**分镜故事板**。要看的话，它会停一次，给你看用真实风格画出来的关键镜头；不看就直接做完成片。

The agent reads three guides and works like a small studio · agent 会读三份指南，像一个小工作室一样开工：

| File · 文件 | What it gives the agent · 给 agent 的东西 |
|---|---|
| [`DIRECTOR.md`](DIRECTOR.md) | how to direct: story, sound, rhythm, camera, performance, self-checks<br>怎么导：故事、声音、节奏、镜头、表演、自检 |
| [`TECHNIQUE.md`](TECHNIQUE.md) | how to build: frame-by-frame rendering, voice, music, mixing<br>怎么做：逐帧渲染、配音、配乐、混音 |
| `styles/<style>/STYLE.md` | what the style looks and sounds like; the story is yours<br>这个风格长什么样、听起来什么样；故事由你定 |

### Before you start · 开始之前

- A film takes an agent about 30–60 minutes and a fair amount of tokens. · 一支片子 agent 大约要做 30–60 分钟，token 用量不小。
- You need Node 20+, ffmpeg and Python 3.11+ (or [uv](https://docs.astral.sh/uv/)); the agent installs the rest. · 需要 Node 20+、ffmpeg 和 Python 3.11+（或 uv），其余由 agent 安装。
- Default output 1920×1080, 24 fps; other sizes on request. · 默认输出 1920×1080、24 fps，其他尺寸可以指定。

Update: `claude plugin marketplace update lemolab && claude plugin update lemo-opuscar@lemolab`, then restart Claude Code (the library in `~/lemo-opuscar` updates itself on the next film); uninstall with `claude plugin uninstall lemo-opuscar@lemolab` and delete `~/lemo-opuscar`. If a step stays stuck, [open an issue](https://github.com/lemomo-ai/lemo-opuscar/issues). · 更新：`claude plugin marketplace update lemolab && claude plugin update lemo-opuscar@lemolab`，然后重启 Claude Code（`~/lemo-opuscar` 里的库会在下一次做片时自动更新）；卸载：`claude plugin uninstall lemo-opuscar@lemolab` 并删除 `~/lemo-opuscar`。一直卡住就[提个 issue](https://github.com/lemomo-ai/lemo-opuscar/issues)。

## The styles · 风格

Click a frame for its `STYLE.md` · 点图片看它的 `STYLE.md`。

<!-- styles:start -->

### Hand-drawn & Painting · 手绘与绘画

<table>
<tr>
<td width="33%" valign="top"><a href="styles/crayon-book/STYLE.md"><img src="docs/frames/crayon-book.jpg" alt="Crayon Picture Book"></a><br><b>Crayon Picture Book</b> · 蜡笔儿童绘本<br><i>The Moon Can&#x27;t Sleep</i><br><sub>The moon can&#x27;t sleep, so a little girl climbs onto the roof to sing it a lullaby.<br>月亮失眠了，小女孩爬上屋顶给它唱摇篮曲。</sub></td>
<td width="33%" valign="top"><a href="styles/watercolor/STYLE.md"><img src="docs/frames/watercolor.jpg" alt="Watercolor Brush"></a><br><b>Watercolor Brush</b> · 水彩笔刷<br><i>Follow the Rain</i><br><sub>Follow the rain from Australia&#x27;s red desert heart to its green coast in one unbroken painted walk.<br>跟着降雨从澳洲红色腹地一路画到绿色海岸，一镜到底。</sub></td>
<td width="33%" valign="top"><a href="styles/ink-wash/STYLE.md"><img src="docs/frames/ink-wash.jpg" alt="Chinese Ink Wash"></a><br><b>Chinese Ink Wash</b> · 中国水墨<br><i>The Swordsman and the River</i><br><sub>A swordsman crosses the river on the water and splits the current with a single stroke.<br>侠客踏水过江，一剑断流。</sub></td>
</tr>
<tr>
<td width="33%" valign="top"><a href="styles/impasto/STYLE.md"><img src="docs/frames/impasto.jpg" alt="Impasto Oil Painting"></a><br><b>Impasto Oil Painting</b> · 油画厚涂<br><i>The Colour of Rain</i><br><sub>In a grey, rainy square one red umbrella opens, and a waltz paints the whole plaza in colour.<br>灰色雨中广场，第一把红伞撑开，圆舞曲把整个广场刷上颜色。</sub></td>
<td width="33%" valign="top"><a href="styles/one-line/STYLE.md"><img src="docs/frames/one-line.jpg" alt="One-line Drawing"></a><br><b>One-line Drawing</b> · 一笔画<br><i>The Line That Never Lifted</i><br><sub>One unbroken line draws a whole life, then the pen passes to a child.<br>一根不离纸的线画完一个人的一生，再把笔交给孩子。</sub></td>
<td width="33%" valign="top"><a href="styles/whiteboard/STYLE.md"><img src="docs/frames/whiteboard.jpg" alt="Whiteboard Explainer"></a><br><b>Whiteboard Explainer</b> · 白板讲解<br><i>Einstein in Your Pocket</i><br><sub>How your phone knows where you are: GPS, atomic clocks, and the 38 microseconds relativity adds every day.<br>手机怎么知道你在哪：GPS、原子钟，和相对论每天多出的 38 微秒。</sub></td>
</tr>
<tr>
<td width="33%" valign="top"><a href="styles/urban-sketch/STYLE.md"><img src="docs/frames/urban-sketch.jpg" alt="Urban Sketch · Pen &amp; Wash"></a><br><b>Urban Sketch · Pen &amp; Wash</b> · 钢笔淡彩<br><i>Where the Wind Went</i><br><sub>A park that is only a pen sketch; wherever the wind carries her straw hat, colour follows.<br>公园只是一张钢笔速写，风把草帽吹到哪里，哪里才有颜色。</sub></td>
</tr>
</table>

### East Asian Traditions · 东方传统

<table>
<tr>
<td width="33%" valign="top"><a href="styles/shadow-puppet/STYLE.md"><img src="docs/frames/shadow-puppet.jpg" alt="Shadow Puppetry"></a><br><b>Shadow Puppetry</b> · 皮影戏<br><i>Hou Yi Shoots the Suns</i><br><sub>Ten suns scorch the earth until the archer Hou Yi draws his bow, told with leather puppets on a lit screen.<br>十日炙烤大地，后羿张弓射日。</sub></td>
<td width="33%" valign="top"><a href="styles/ukiyoe/STYLE.md"><img src="docs/frames/ukiyoe.jpg" alt="Ukiyo-e"></a><br><b>Ukiyo-e</b> · 浮世绘<br><i>A Journey Toward the Mountain</i><br><sub>A traveller walks toward a distant mountain; every shot is a woodblock print, ending in a great wave.<br>旅人走向远山，每个镜头都是一幅版画，最后迎来一道巨浪。</sub></td>
<td width="33%" valign="top"><a href="styles/papercut-red/STYLE.md"><img src="docs/frames/papercut-red.jpg" alt="Red Paper-cut"></a><br><b>Red Paper-cut</b> · 红色窗花剪纸<br><i>Nian Comes to Town</i><br><sub>On New Year&#x27;s Eve the beast Nian comes to town, and one girl&#x27;s giant paper-cut lights up the village to scare it off.<br>除夕年兽进村，小女孩剪出的大窗花照亮全村，把它吓跑。</sub></td>
</tr>
<tr>
<td width="33%" valign="top"><a href="styles/paper-lantern/STYLE.md"><img src="docs/frames/paper-lantern.jpg" alt="Paper-cut Lightbox"></a><br><b>Paper-cut Lightbox</b> · 纸雕灯影<br><i>A Mooncake&#x27;s Longing</i><br><sub>A single mooncake tells the Mid-Autumn story of reunion and longing inside a glowing paper-cut lightbox.<br>一枚月饼讲中秋的团圆与思念，纸雕灯箱层层透光。</sub></td>
</tr>
</table>

### Print & Printmaking · 印刷与版画

<table>
<tr>
<td width="33%" valign="top"><a href="styles/risograph/STYLE.md"><img src="docs/frames/risograph.jpg" alt="Risograph Print"></a><br><b>Risograph Print</b> · Risograph 丝网印刷<br><i>Sunday Ride</i><br><sub>A Sunday-morning bike ride through the city — bakery, park, riverside — in two misregistered inks.<br>周日早晨骑车穿过城市：面包店、公园、河边。</sub></td>
<td width="33%" valign="top"><a href="styles/halftone-dossier/STYLE.md"><img src="docs/frames/halftone-dossier.jpg" alt="Halftone Dossier"></a><br><b>Halftone Dossier</b> · 复古半调案卷<br><i>Case File: Chubby</i><br><sub>A chubby orange cat stands trial for testing gravity and 4 a.m. parkour, and walks free.<br>橘猫胖橘被立案审查：测试重力、凌晨跑酷，最后无罪释放。</sub></td>
<td width="33%" valign="top"><a href="styles/woodcut/STYLE.md"><img src="docs/frames/woodcut.jpg" alt="Woodcut Print"></a><br><b>Woodcut Print</b> · 木刻版画<br><i>The Bell Founder</i><br><sub>A village spends a whole winter casting one bell; the first time it rings, the snow stops.<br>村子用一整个冬天铸一口钟，钟声第一次响起，雪停了。</sub></td>
</tr>
<tr>
<td width="33%" valign="top"><a href="styles/engraving/STYLE.md"><img src="docs/frames/engraving.jpg" alt="Copperplate Engraving"></a><br><b>Copperplate Engraving</b> · 铜版画<br><i>The Honeybee, Plate VII</i><br><sub>A natural-history plate engraves itself: the burin cuts the copper, the bee builds up line by line, and a watercolour wash brings it to life.<br>一张博物志图版自己刻出来：雕刀推开铜版，蜜蜂一线线成形，最后手工水彩上色。</sub></td>
<td width="33%" valign="top"><a href="styles/silkscreen-poster/STYLE.md"><img src="docs/frames/silkscreen-poster.jpg" alt="Silkscreen Travel Poster"></a><br><b>Silkscreen Travel Poster</b> · 丝印旅行海报<br><i>Three Trails</i><br><sub>Three trail posters are screen-printed one ink at a time, then climbed in one long take from noon to dusk.<br>三条步道各一张丝印海报，一色一刮印出来，再沿山脊一镜到底从正午爬到黄昏。</sub></td>
</tr>
</table>

### Graphic & Type · 图形与排版

<table>
<tr>
<td width="33%" valign="top"><a href="styles/swiss-motion/STYLE.md"><img src="docs/frames/swiss-motion.jpg" alt="Swiss Motion Graphics"></a><br><b>Swiss Motion Graphics</b> · 瑞士动态排版<br><i>Five Rules for a Poster</i><br><sub>A concert poster lays itself out by five Swiss design rules; the fifth is to break just one.<br>一张音乐会海报按瑞士设计的五条规则自己排版，第五条是只打破一条。</sub></td>
<td width="33%" valign="top"><a href="styles/spy-titles/STYLE.md"><img src="docs/frames/spy-titles.jpg" alt="60s Spy Title Sequence"></a><br><b>60s Spy Title Sequence</b> · 60s 间谍片头<br><i>The Velvet Cipher</i><br><sub>Opening titles for an imaginary 1964 spy film: a chase for a stolen key until the shapes lock into the title.<br>虚构 1964 年间谍片的片头：追一把被偷的钥匙，几何碎片最后拼成片名。</sub></td>
<td width="33%" valign="top"><a href="styles/art-deco/STYLE.md"><img src="docs/frames/art-deco.jpg" alt="Art Deco"></a><br><b>Art Deco</b> · 装饰艺术<br><i>Midnight at the Starlight Hotel</i><br><sub>A grand hotel, 1930: a bellboy races lifts and revolving doors to deliver one letter before midnight.<br>1930 年的大饭店，门童赶在午夜前把一封信送上顶楼。</sub></td>
</tr>
<tr>
<td width="33%" valign="top"><a href="styles/blueprint/STYLE.md"><img src="docs/frames/blueprint.jpg" alt="Blueprint"></a><br><b>Blueprint</b> · 蓝图 / 工程制图<br><i>Patent Pending: The Cloud Catcher</i><br><sub>An inventor&#x27;s blueprint draws, explodes and assembles a cloud-catching machine, and its revision cloud starts to rain.<br>发明家的蓝图自己画出一台接云机器，修订云线变成了真的雨云。</sub></td>
<td width="33%" valign="top"><a href="styles/stained-glass/STYLE.md"><img src="docs/frames/stained-glass.jpg" alt="Stained Glass"></a><br><b>Stained Glass</b> · 彩色玻璃窗<br><i>The Dragon of the East Window</i><br><sub>Sunlight crosses a cathedral window from dawn to dusk, waking each pane of a knight-and-dragon tale.<br>阳光从清晨移到黄昏，照到哪一格花窗，哪一格的故事就动起来。</sub></td>
<td width="33%" valign="top"><a href="styles/pictogram-motion/STYLE.md"><img src="docs/frames/pictogram-motion.jpg" alt="Pictogram Motion"></a><br><b>Pictogram Motion</b> · 象形运动图形<br><i>Aichi-Nagoya 2026 — All 43 Sports</i><br><sub>All 43 sports of the 2026 Asian Games as beat-locked geometric pictograms.<br>2026 亚运会 43 个大项，几何象形人卡着节拍快闪。</sub></td>
</tr>
<tr>
<td width="33%" valign="top"><a href="styles/ascii-crt/STYLE.md"><img src="docs/frames/ascii-crt.jpg" alt="ASCII / CRT Terminal"></a><br><b>ASCII / CRT Terminal</b> · ASCII / CRT 终端<br><i>Tranquility.log</i><br><sub>A moon-base AI wakes after forty years to a signal from Earth, and replies by drawing “home” in characters.<br>月球基地的 AI 沉睡 40 年后被唤醒，用字符画出“家”来回复。</sub></td>
</tr>
</table>

### Information & Keynote · 信息与发布

<table>
<tr>
<td width="33%" valign="top"><a href="styles/dataviz/STYLE.md"><img src="docs/frames/dataviz.jpg" alt="Data Storytelling"></a><br><b>Data Storytelling</b> · 数据叙事<br><i>A Hundred Summers</i><br><sub>A hundred years of summer temperatures, where the chart itself tells the story.<br>一百年的夏季气温，图表本身就是故事。</sub></td>
<td width="33%" valign="top"><a href="styles/iso-infographic/STYLE.md"><img src="docs/frames/iso-infographic.jpg" alt="Isometric Infographic"></a><br><b>Isometric Infographic</b> · 等距信息图<br><i>From Bean to Cup</i><br><sub>A coffee&#x27;s journey from the plantation to your hands, across one isometric world.<br>一杯咖啡从种植园到你手里的旅程。</sub></td>
<td width="33%" valign="top"><a href="styles/dark-keynote/STYLE.md"><img src="docs/frames/dark-keynote.jpg" alt="Dark Tech Keynote"></a><br><b>Dark Tech Keynote</b> · 暗色科技发布<br><i>Room to Think</i><br><sub>Launch film for Tidy, a fictional app: one buried cursor snaps hundreds of windows back into place.<br>虚构 app Tidy 的发布片：被埋掉的光标一键把几百个窗口归位。</sub></td>
</tr>
<tr>
<td width="33%" valign="top"><a href="styles/living-screencast/STYLE.md"><img src="docs/frames/living-screencast.jpg" alt="Living Screencast"></a><br><b>Living Screencast</b> · 活体实机录屏<br><i>Clawd Moves In</i><br><sub>Clawd, the Claude Code pixel mascot, hops out of the terminal into the Claude app and acts out plan mode, diff comments and self-checks in a one-take screencast.<br>像素小人 Clawd 跳出终端、搬进 Claude 应用，在一镜到底的录屏里演示 Plan 模式、diff 评论和自检。</sub></td>
<td width="33%" valign="top"><a href="styles/hologram-hud/STYLE.md"><img src="docs/frames/hologram-hud.jpg" alt="Sci-fi Hologram HUD"></a><br><b>Sci-fi Hologram HUD</b> · 科幻全息界面<br><i>Volt · Spec Scan</i><br><sub>An e-bike is scanned into a hologram; target boxes lock onto the battery, motor and brakes, and each spec rolls into place.<br>一辆电助力车被扫描成全息线框，目标框依次锁定电池、电机、刹车，参数逐个滚到真值。</sub></td>
</tr>
</table>

### Cartoon & Anime · 卡通与动画

<table>
<tr>
<td width="33%" valign="top"><a href="styles/rubber-hose/STYLE.md"><img src="docs/frames/rubber-hose.jpg" alt="1930s Rubber Hose Cartoon"></a><br><b>1930s Rubber Hose Cartoon</b> · 1930s 橡皮管卡通<br><i>Coffee Cup Chase</i><br><sub>A coffee cup chases a runaway sugar cube around the kitchen, 1930s-cartoon style.<br>一只咖啡杯满厨房追一块逃跑的方糖。</sub></td>
<td width="33%" valign="top"><a href="styles/cel-anime-80s/STYLE.md"><img src="docs/frames/cel-anime-80s.jpg" alt="80s Cel Anime"></a><br><b>80s Cel Anime</b> · 80 年代赛璐璐动画<br><i>City Lights, 1987</i><br><sub>A courier girl rides through a rain-soaked neon city to deliver a tape before the dawn launch.<br>快递少女骑车穿过雨后霓虹都市，赶在黎明发射前送到一盘磁带。</sub></td>
<td width="33%" valign="top"><a href="styles/scifi-toon/STYLE.md"><img src="docs/frames/scifi-toon.jpg" alt="Sci-Fi Sitcom Toon"></a><br><b>Sci-Fi Sitcom Toon</b> · 科幻情景喜剧卡通<br><i>Coffee Run</i><br><sub>A jaded genius opens a portal just to buy coffee and tumbles through ever-stranger universes.<br>厌世天才开传送门只想买杯咖啡，却穿过越来越离谱的平行宇宙。</sub></td>
</tr>
<tr>
<td width="33%" valign="top"><a href="styles/midcentury-toon/STYLE.md"><img src="docs/frames/midcentury-toon.jpg" alt="Mid-century Cartoon"></a><br><b>Mid-century Cartoon</b> · 50s 扁平卡通<br><i>Meet Pip</i><br><sub>A robot vacuum set up in three steps, told like a 1950s classroom film: place the dock, connect the app, press start.<br>用 50 年代教育片的口吻，三步教你装好一台扫地机：放充电座、连 app、按开始。</sub></td>
</tr>
</table>

### Games · 游戏

<table>
<tr>
<td width="33%" valign="top"><a href="styles/pixel-rpg/STYLE.md"><img src="docs/frames/pixel-rpg.jpg" alt="16-bit Pixel RPG"></a><br><b>16-bit Pixel RPG</b> · 16-bit 像素 RPG<br><i>The Last Save Point</i><br><sub>At the final boss door a hero saves the game, and the save screen replays the whole journey.<br>勇士在最终 Boss 门前存档，存档画面闪回一路冒险。</sub></td>
<td width="33%" valign="top"><a href="styles/hd-2d/STYLE.md"><img src="docs/frames/hd-2d.jpg" alt="HD-2D"></a><br><b>HD-2D</b><br><i>The Lampbearer</i><br><sub>The lighthouse goes dark; a girl carries the last flame through a night forest and up the storm cliffs.<br>灯塔熄灭，孙女提着最后一簇火穿过夜林、爬上风暴悬崖。</sub></td>
<td width="33%" valign="top"><a href="styles/microgame/STYLE.md"><img src="docs/frames/microgame.jpg" alt="Microgame Frenzy"></a><br><b>Microgame Frenzy</b> · 微游戏快闪（瓦里奥制造式）<br><i>Five-Second Astronaut</i><br><sub>A clumsy cadet survives a five-second boot camp, faster and faster, until the boss: landing home.<br>见习宇航员闯五秒训练营，越来越快，Boss 关亲手降落回地球。</sub></td>
</tr>
<tr>
<td width="33%" valign="top"><a href="styles/game-show/STYLE.md"><img src="docs/frames/game-show.jpg" alt="Game Show Flat"></a><br><b>Game Show Flat</b> · 综艺节奏扁平<br><i>Rhythm of AI, 1997 → 2026</i><br><sub>The history of AI as a rhythm game: models take the stage on the beat, and a report card closes the show.<br>把 AI 发展史做成一局节奏游戏，模型踩着拍登场，最后发成绩单。</sub></td>
</tr>
</table>

### Cinema & Eras · 电影与时代

<table>
<tr>
<td width="33%" valign="top"><a href="styles/silent-film/STYLE.md"><img src="docs/frames/silent-film.jpg" alt="1920s Silent Film"></a><br><b>1920s Silent Film</b> · 1920s 默片<br><i>The Runaway Loaf</i><br><sub>A baker&#x27;s boy chases a runaway loaf downhill, then breaks it in half for a hungry girl.<br>面包店学徒追一个滚走的面包，最后掰成两半分给饿肚子的小女孩。</sub></td>
<td width="33%" valign="top"><a href="styles/backrooms/STYLE.md"><img src="docs/frames/backrooms.jpg" alt="Liminal Found Footage"></a><br><b>Liminal Found Footage</b> · 后室 / 新怪谈<br><i>Night Shift Orientation</i><br><sub>A new night-shift hire films their first night in an endless yellow office, following the rules on the wall.<br>新夜班员工拍下入职第一晚：无尽的黄色办公空间，和墙上的员工守则。</sub></td>
</tr>
</table>

### Materials & 3D · 材质与 3D

<table>
<tr>
<td width="33%" valign="top"><a href="styles/brick-toy/STYLE.md"><img src="docs/frames/brick-toy.jpg" alt="Brick Toy"></a><br><b>Brick Toy</b> · 积木玩具<br><i>Rocket from Spare Parts</i><br><sub>A brick astronaut builds a rocket from spare parts and flies to a brick moon.<br>积木宇航员用零件拼出火箭，飞向积木月亮。</sub></td>
<td width="33%" valign="top"><a href="styles/paper-popup/STYLE.md"><img src="docs/frames/paper-popup.jpg" alt="Paper Pop-up Book"></a><br><b>Paper Pop-up Book</b> · 纸片立体书<br><i>Pip&#x27;s Paper Adventure</i><br><sub>A pop-up book opens on a desk; a sprite named Pip adventures through paper worlds and jumps out into ours.<br>立体书在书桌上打开，小精灵 Pip 在纸片世界冒险，最后跳出书外。</sub></td>
<td width="33%" valign="top"><a href="styles/tilt-shift/STYLE.md"><img src="docs/frames/tilt-shift.jpg" alt="Tilt-Shift Miniature"></a><br><b>Tilt-Shift Miniature</b> · 移轴微缩<br><i>Toy Town Rush Hour</i><br><sub>Morning rush hour in a town that looks like a model: traffic, trains and tiny people.<br>玩具城的早高峰，一切都像模型。</sub></td>
</tr>
<tr>
<td width="33%" valign="top"><a href="styles/lowpoly-island/STYLE.md"><img src="docs/frames/lowpoly-island.jpg" alt="Low-poly Isometric Island"></a><br><b>Low-poly Isometric Island</b> · 低多边形等距<br><i>The Island That Grew</i><br><sub>An island and its village grow tile by tile from an empty sea, each tile a note, into a starry night.<br>空海里一格格长出小岛和村庄，每放一块响一个音符，直到星空。</sub></td>
<td width="33%" valign="top"><a href="styles/glass-product/STYLE.md"><img src="docs/frames/glass-product.jpg" alt="Glass Product Render"></a><br><b>Glass Product Render</b> · 玻璃质感产品<br><i>Aura — Hear the Light</i><br><sub>Unboxing and close-ups of Aura, fictional glass earbuds, in strip-light sweeps and caustics.<br>虚构玻璃耳机 Aura 的开箱与特写。</sub></td>
</tr>
</table>
<!-- styles:end -->

## Licence · 授权

Made by **LemoLab × Claude Opus 5.5**. MIT licensed. Third-party assets in the demos keep their own licences (see each demo's `CREDITS`); you are responsible for the materials you use in your films.<br>
**LemoLab × Claude Opus 5.5** 出品，MIT 协议。样片中的第三方素材沿用各自的授权（见各样片的 `CREDITS`）；你在自己片子里使用的素材由你负责。
