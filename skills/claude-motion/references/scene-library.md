# 可运行的场景起点

2026-10-11 本地扩充：11 个可创建工程的入口，包含 **7 套新增来源示例 + 4 套已有 Lemo 案例的适配**。这不是 11 种新风格，也不是 11 支原创影片。47 条旧源码目录保持其原统计口径；新增来源登记在 scene-catalog.json，统一查询同时检索两者。

```sh
node <skill>/scripts/route.mjs --scenes
node <skill>/scripts/route.mjs --query '一个人放下手机，看向窗外'
node <skill>/scripts/create-scene.mjs --scene lemo-midcentury-toon --out <新目录>
node <skill>/scripts/render.mjs --root <新目录> --page index.html --out <新目录>/film.mp4
```

| ID | 已接通的实现 | 应改写的位置 / 限制 |
| --- | --- | --- |
| lemo-midcentury-toon | 几何人物、手指与手臂关节、道具、墨线与纸纹 | film.js；人物原模型复用，身体是有限动画，不自带完整走路 |
| lemo-scifi-toon | 咖啡馆、店员、杯子、屏幕空间线条抖动 | film.js；目前是短递杯片段，不是整部叙事 |
| lemo-paper-popup | 立体书铰链、实体书页、纸片谷与折叠飞机 | film.js；保留原布局，新情节需要改造景物，不只换封面 |
| lemo-lowpoly-island | 六边形陆地、房屋、海浪、灯塔、AO 与后期 | film.js；预览保留原第 28–40 秒事件，不能称原创故事 |
| animate-sketchbook | 手绘本、涂鸦轮廓、形状过渡、合成音乐 | src/* 与 piece.json，修改后 node rebuild.mjs |
| animate-crosshatch | 排线、纸纹、桌面物件、音乐 | 同上；原例 |
| animate-riso | 多层网点、套色与叠印 | 同上；避免只取配色而抛弃合成机制 |
| animate-isometric | 等距线描、设备形变 | 同上；线描本身留白较多，不适合强行满足所有题材 |
| animate-pixel | 像素网格、抖色、角色与景物 | 同上；角色是原例角色 |
| animate-cut-paper | 彩纸、分层室内、过渡与音效 | 同上；原例时长 8 秒，其余 animate 原例 6 秒 |
| animate-math | 图形、公式、关系说明 | 同上；适用于数学讲解，不自动变成三维叙事引擎 |

每个工程自带来源、许可证、可编辑代码、确定性时间接口；Three.js 依赖从 Skill 已安装的 0.170.0 复制并保留 LICENSE。animate 工程含必要 kit、style kit 与上游 build.mjs，拷出后可独立重建；不依赖本机研究文件夹。录制入口 index.html 为确定性静帧接口，播放成片用导出的 MP4；并非所有原生源码页面都有交互播放器。

来源：cth9191/animate @ 7e5eb56feb2dd573f890e1b7b34748af43d58263（MIT）；lemomo-ai/lemo-opuscar @ c4bc370eb15d36c88e074fdba1b0248b62a8e419（MIT）。源包保留原字节与 IMPORT 清单。作者声称的模型来源未经调用日志审计。系统字体回退与原网站字体可能不同。

选择时先看预览，再看题目所需的人物动作、物件结构与景深；不因为某个案例含吉祥物就认定适配。没有合适模型时，应明确补造型/动作，不用现成角色硬替。原例的漂亮画面不证明改编后仍成立：先验证关键动作，再做完整影片。

场景入口具备运行证据。后续各次成片评价见 [观察记录](observed-feedback.md)，不能从原例预览或单个作品推断跨题材普遍改善。

## 定向补缺开发候选

另接通 3 个实验工程：reading-room、contact-workshop、botanical-ink。合计 14 个可创建场景入口，其中 3 个仍为实验组件，默认路由不推荐。详见 [定向组件](targeted-components.md)。这次增加 14 个新接通家具 GLB（不是 14 种风格），一个本地接触模块和一个 RoughJS 绘图库集成；未增加 Claude 来源案例计数。
