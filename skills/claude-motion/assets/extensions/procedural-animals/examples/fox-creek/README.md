# 溪边的清晨

独立可编辑工程，18 秒、1280×720、24 fps，无声无字幕。许可和来源见 SOURCE.json、LICENSE、LICENSE.adapter、vendor/LICENSE.three 与 ADAPTATION.md。

预览：`node preview.mjs`，打开 http://127.0.0.1:8789 。

导出：

```sh
npm install
npx playwright install chromium
node render.mjs --root . --page index.html --out film.mp4 --fps 24
```

macOS 可追加 `--gpu metal`；需要 Node 22+ 和 FFmpeg/ffprobe。已有 Playwright 可用 `MOTION_PLAYWRIGHT_MODULE=/absolute/path/playwright/index.mjs`，无需在项目安装。浏览器依赖都在工程内，无 CDN。

`scene.js` 中 control 编排行走/饮水/观察/离开；render 调整相机与水纹。`procedural-animals.js` 直接接入上游，120 Hz 预采样后确定性 seek。狐狸雕塑、骨架、IK、DQS、毛层与眼睛源代码在 upstream/src。

本机交付 film.mp4、poster.png，首个完整版本 film-v1.mp4 保留；示例模板中不携带导出视频或 node_modules。
