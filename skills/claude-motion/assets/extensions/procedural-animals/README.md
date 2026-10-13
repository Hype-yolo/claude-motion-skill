# Procedural Animals — 可重复跳转的程序动物

实际接入 Majid Manzarpour 的 threejs-procedural-animals，固定提交 `c95ae49346aa8e140a924376cec6cf0073d99512`，MIT。保留上游全部 JavaScript 源码；当前验证动物为赤狐，其他物种虽有源码但未逐项验证。它是造型、骨架和动作组件，不能计作独立画风，狐狸新片已获用户明确的质感提升反馈；不外推其他物种。

```sh
node create-project.mjs --out /absolute/new-project
cd /absolute/new-project
npm install
npx playwright install chromium
node render.mjs --root . --page index.html --out film.mp4 --fps 24
```

本机 macOS 可加 `--gpu metal`。已有 Playwright 时通过 `MOTION_PLAYWRIGHT_MODULE=/absolute/playwright/index.mjs` 复用。另需 Node 22+ 和 FFmpeg/ffprobe。Three.js **0.186.0** 与 Reflector 已固定 vendored，浏览器没有 CDN 请求；不要换成现有 Skill 的 0.170，因为上游着色器使用 r186 的 SunLight/材质字段。

本地可播放预览：在作品目录运行 `node preview.mjs`，打开提示的 localhost 地址。`index.html` 提供 `READY`, `DUR=18`, `CAPTURE`, `render(t)`。

`createTimelineAnimal(species, {scene, duration, hz, seed, control, ...animalOptions})` 位于 `procedural-animals.js`。它调用上游 `createAnimal`，120 Hz 预演整段真实 IK/动作，把 DQ 数据、毛力和眼睛状态保存下来；`seek(t)` 恢复最近的采样，随机眨眼也固定种子。原版 `createAnimal` 同时导出用于交互式时间推进。缓存量随动物数量和时长线性增加；不适合无限时间流。

`examples/fox-creek/` 是完整可编辑工程《溪边的清晨》：18 秒、1280×720、24 fps、无声、无字幕。编辑 `scene.js:38` 的 `control` 编排行走、停步、饮水和看向对岸；`scene.js:49` 改镜头和涟漪。场景是新编排，非上游转台。饮水期间必须调用 `move({speed:0})` 解除 `follow`，因为上游会把 follow 视作移动并中断 drink。

许可：`LICENSE` 是上游 MIT，`LICENSE.adapter` 是新增封装/示例 MIT，`vendor/LICENSE.three` 是 Three.js MIT。完整来源与 SHA-256 在 `SOURCE.json`；改编、QA、故障和边界见示例 `ADAPTATION.md`。组件不包含 MP4 或 node_modules。
