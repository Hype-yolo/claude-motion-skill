# Anidoodle 纸艺绘图组件

从 Alex Greenshpun 的 `alexgreensh/anidoodle` 固定提交 `06f8be2bef0faa94e7eb6009ef23b36a0ae7b8a8` 提取实际纸艺实现。Apache-2.0；随包保留原始 LICENSE、NOTICE 和未改源码。组件是绘图能力和一个新题材工程，不计作独立新画风，也不保证审美收益。

## 创建和运行

```sh
node create-project.mjs --out /absolute/new-directory
cd /absolute/new-directory
npm install
npx playwright install chromium
npm run render
```

已有 Playwright 时可设置 `MOTION_PLAYWRIGHT_MODULE=/absolute/path/to/playwright/index.mjs`，直接 `node render.mjs --root . --out film.mp4 --fps 24`。`index.html` 是可拖动时间轴的本地预览，运行 `npm run preview` 后打开 localhost:8815。画面 1280×720、18 秒、24fps，无声、无字幕。播放页按钮不写入画面。

## 实际复用

`src/paper-materials.ts` 是保留原语句的选定源码抽取；`examples/paper-harbor/lib/paper-materials.js` 是 esbuild 0.25.11 预编译的浏览器模块，运行无需依赖。新工程保留 TS，可 `npm run build` 重建。改编者新增公开导出、去除未需要的场景依赖，未重新手写替代材质算法。

- `paperCraft.ts`：水粉短笔触 `gouache`、纸边剪影/厚度轮廓 `cutPath`、波纹印刷 `wavePrint`、报纸印刷 `newsPrint`、木纹 `woodPrint`、石纹 `stonePrint`。原纸船四片折面比例被改编为可折起的新船。
- `scrapbookKit.ts`：`fibres` 纸纤维/染色、`scissor` 重采样剪刀边、`path`。
- `core.ts` / `gallery.ts`：种子随机数、颜色混合、边界、弧长重采样。
- 另保留 `shadeSide`、`dotPrint`、`diamondPrint` 等导出用于后续改编，但当前影片不调用它们。

`scene.js` 的 `card()` 实際调用前述材质和 cutPath；`bookLayer()` 调用报纸/木纹/波纹；`bridge()` 调用石纹、水粉及纤维；`foldedBoat()` 调用纸边、报纸、纤维。新写书店、摊开的书、河道、桥孔、台灯、折叠关键帧、航行与镜头。原海边玩具剧场的布景/镜头不进入新片。

## 编辑入口和边界

- `background()`：书架、夜窗、书店桌面。
- `bookLayer()` / `riverY()`：页面、河道、码头。
- `foldedBoat()` / `finalFaces`：角页合拢、中央帆面抬起和纸船折面。
- `bridge()`：偶奇规则的真实负形遮挡，船在桥后绘制。
- `render()`：绝对时间、镜头、航线、靠岸。

纸艺是二维分层绘制，折叠为艺术化铰链与顶点动画，并非可按步骤复做的物理折纸仿真；桥为前景负形遮挡而非三维碰撞。原项目所有媒体（图片、声包、音视频、字体）均未引入。预览和视频的画面表现需单独评价；技术可用不等于用户认可。
