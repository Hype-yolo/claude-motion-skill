# 已接通的制作组件（本地试点）

这些入口保留有来源的实际绘图模块，创建可导出的独立工程。下文前两节记录最初试点；末节列出本轮五套系统的统一入口。可调用系统数量与源码案例数量分开统计，其余案例不自动继承验证状态。

## 像素微缩景：lemo-hd-2d

```sh
node <skill>/scripts/create-hd2d.mjs --out <新的作品目录>
node <skill>/scripts/render.mjs --root <作品目录> --page index.html --out <作品目录>/film.mp4 --frames 2,10,12
node <skill>/scripts/verify-hd2d.mjs --root <作品目录>
node <skill>/scripts/render.mjs --root <作品目录> --page index.html --out <作品目录>/film.mp4 --fps 24
```

先在 Skill 目录运行 `npm ci` 和 `npm run setup`。固定依赖 Three.js 0.170.0。生成器把所需 Three.js 文件复制进工程；成片绘制没有网络依赖。首次工程是《末班电车》示例：新题目需要改写 `film.js` 的布景、主体、事件、镜头、字幕选择与 `score.js`，不能只改标题。`engine.js` 提供场景、灯光和后期组合，`engine/upstream/` 保持上游字节不变。新物件用 `kit` 的几何/像素材质；新像素角色通过 `PX` 和 `atlas` 创建，再用 `billboard` 接入真实光照和透明轮廓投影。简单建筑可程序建模，不需要把所有角色做成三维。

实际保留：`px.js` 的像素纹理/受光平面、`kit.js` 的世界 UV 和建筑、`fx.js` 的天空、`chars.js` 的图集工具、`post_ts.js` 的有符号深度景深/移轴/辉光/调色。角色图案、车站、电车与叙事是本项目新绘制；没有使用上游剧情、旧角色造型或原音乐。

本轮没有接入全部 HD-2D 特效：无海面反射/暴风雨/配音；AO 关闭，720p 内部按 1 倍渲染。完整的是本片需要的空间、受光、阴影和景深，不宣称复现上游所有能力。

页面契约为 `READY`、`DUR`、`render(t)`、最终合成画布 `CAPTURE`，可选 `audioWav()`。原生 WebGL 渲染完才复制到导出画布；不得用画二维椭圆光晕替代实际光源。`setFeature(name,on)` 支持 lights/shadows/dof；新场景沿用接口后可运行验证。验证保存同一时刻的关闭效果图、请求到的原模块与哈希、乱序重绘；这些证明机制工作，不是审美评分。

特别留意：门廊/前景可能挡住动作；角色前方需要适量补光，背后的灯照不到面向镜头的平面；亮光可能烧白像素图，可在角色着色器中限制受光上限；关键动作的焦点要跟主体。先用最终代码画几个有代表性的镜头和一段动作，修好遮挡、曝光、景深再扩全片。

## 红纸剪纸：lemo-papercut-red

```sh
node <skill>/scripts/create-papercut.mjs --out <新的作品目录>
node <skill>/scripts/render.mjs --root <作品目录> --out <作品目录>/film.mp4 --frames 2,7.5,15
node <skill>/scripts/verify-papercut.mjs --root <作品目录>
node <skill>/scripts/render.mjs --root <作品目录> --out <作品目录>/film.mp4 --fps 24
```

首次工程是《纸池跃月》示例。新题目改写 `scene.js` 的轮廓、部件、动作、构图以及 `score.js`。保留 `paper.js` 的实际负形切割、随纸片固定的纤维、刀口、纸影；`motifs.js` 的月牙/旋涡等切割函数；`rig.js` 的部件矩阵绘制。不要把透明孔洞换成背景色斑块。造型可以完全不同，但轮廓与内部纹样必须仍由原纸片合成器生成。

本例是二维分片运动，没有调用原折纸模拟、背光与原角色骨架；不能把旋转平面纸片称为真实三维折叠。需要折叠、纸灯透射时进一步接入对应模块并单独验证。

## 制作前后的证据

先决定本题要保留哪些视觉机制，再检查它们是否真实生效。检查代表画面、关键动作及最终播放，不机械要求所有题目用同样镜头数量。源模块被 import 只证明加载；改变光源/景深开关后的画面差异、纸片内部真实透明像素等才进一步证明效果生效。最终仍由观片判断风格与完成度。

生成器写入 `ENGINE-INPUT.json`，包含上游提交和原文件哈希，许可证在 `licenses/`。制作完成后增加 `ADAPTATION.md`，写清实际复用/新增/未采用的部分、依赖和观片发现。当前试点属于有参考改编，不是闭卷迁移或无 Skill 对照。

## 五套系统的扩展入口（本地开发版）

`references/engine-catalog.json` 是可运行组件目录，独立于 47 个来源案例目录。此轮新增三套系统，原两套各补两个新题材，共十支 18 秒、720p/24fps 的开发影片。以前的《末班电车》《纸池跃月》获用户认可，不代表本轮十支已获认可；也不是有无 Skill 的盲测。

```sh
node <skill>/scripts/route.mjs --engines
node <skill>/scripts/create-engine.mjs --engine handdrawn --example night-reader --out <新目录>
node <skill>/scripts/render.mjs --root <新目录> --page index.html --out <新目录>/film.mp4 --frames 3,9,14
node <skill>/scripts/render.mjs --root <新目录> --page index.html --out <新目录>/film.mp4 --fps 24
```

| engine | 示例 | 修改位置 | 保留机制与边界 |
|---|---|---|---|
| hd2d | clock-repair / fern-expedition | film.js、art.js | 原 PX 像素绘制、受光 billboard、像素纹理、三维光影和后期；新钟、齿轮、花瓣、探险者。花瓣是三维铰接，人物仍为受光平面。 |
| papercut | borrowed-umbrella / paper-orrery | scene.js、art.js | 原纸纤维、刀口、真实 alpha 镂空、分片矩阵与纸影；新人物、伞、齿轮。二维分片，不是真实折纸模拟。 |
| handdrawn | kite-mender / night-reader | story.js | 项目已改编的 ClaudeAnimationBase core/clawd/timeline，p5.brush 颜料、墨线、表情、多视图与动作。原角色明确复用；不是新人体模型或通用骨骼绑定。 |
| glass | light-hourglass / clear-turntable | film.js、world.js | 原 studio 动态环境光条、反射地面、product 的 glass 材质与 core 的景深/辉光；不调用原耳机模型。新物体为程序几何，沙粒为视觉动画，不是物理流体模拟。 |
| swiss | room-to-breathe / one-to-many | scene.js、engine/type.js | 原精确贝塞尔、拍点 snap、字体设置与基线遮罩揭示函数。字函数从原文件提取，保留来源；新网格、图形布局和时间线。此风格本来就是平面图形，不能拿材质丰富度作为唯一标准。 |

HD2D、handdrawn、glass 使用 `--page index.html`；papercut、swiss 使用默认 scene.js 导出方式。所有模板提供实时页面；完整有声观看用导出的 MP4。新入口拒绝覆盖已有目录。`STARTER.json` 只记录生成时文件，不继承其他工程的验证。自定义后要重新抽帧、导出和检查。

在 Skill 目录 `npm ci` 安装 p5 2.3.3、p5.brush 2.2.3、Three 0.170.0 与 Playwright。创建工程时复制本地依赖，运行影片不联网。手绘内部画布 1920×1080，最终导出缩到 1280×720；其余按 1280×720 绘制。保留底层引擎，但字体、摄影、构图和音频均需按题目设计。

本轮没有批量引入外部 3D 资产库。只有发现具体缺口时再选择资产，统一比例、材质与动作，并记录许可；数量增长不替代完成度。原模块不随意改写，必要适配另留文件并声明差异。

### 渲染性能与检验

macOS 可显式加 `--gpu metal` 使用 Chromium 的 Metal 后端；默认保持原浏览器配置，其他系统不要使用该参数。本机已实测 Metal 比默认软件 WebGL 快很多。切换后仍要重新检查代表画面、随机寻帧和最终解码，不能只凭速度认定结果相同。

`node <skill>/scripts/verify-engine.mjs --root <工程> [--gpu metal]` 核对来源模块哈希与网络加载、乱序重绘，并为 HD2D/剪纸/玻璃分别关闭相关效果保存差异。手绘与排版当前检查模块加载和重绘，不把空的 features 列表解读为全部视觉能力通过开关测试。新题材需要再看动作和接触关系；技术检查不能替代观片。
