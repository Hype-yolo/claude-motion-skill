# 《书页里的小港口》制作记录

## 来源与保留

实际调用 Alex Greenshpun / alexgreensh/anidoodle，固定提交 `06f8be2bef0faa94e7eb6009ef23b36a0ae7b8a8`；Apache-2.0，LICENSE 与 NOTICE 原样附带。未带入任何上游例外媒体、音频、参考画作、字体或原视频。`SOURCE.json` 记录原文件哈希；`upstream/` 保留原文。

`lib/paper-materials.js` 由 `src/paper-materials.ts` 编译，其材料绘制函数是源代码抽取，非看完源码后从零仿写。具体调用：

| 新代码位置 | 上游实际机制 |
|---|---|
| `scene.js` / `card()` | paperCraft 的 `gouache` / `cutPath`，scrapbookKit 的 `fibres` / `scissor` |
| `background()` | paperCraft 的 `woodPrint`，书脊使用 card 材质 |
| `bookLayer()` | `newsPrint` / `wavePrint` / `woodPrint`，纸面水粉和纤维 |
| `bridge()` | `stonePrint` / `gouache` / `fibres` / `cutPath`，新增 evenodd 桥洞 |
| `foldedBoat()` | 原船船体及双帆四片几何比例、`newsPrint` / `fibres` / `cutPath`；新增时间驱动折叠 |

选定函数只移除未使用依赖并导出，TypeScript 类型在编译中去除；动态纸边阴影由新 card 包装执行。包中尚有 shadeSide、dotPrint、diamondPrint 等备用函数，影片未调用，不能算本片机制收益。

## 新写内容

夜间书店书架、月亮窗、桌面、厚页展开书、书页河道、纸桥、灯与码头均为此次新几何。0–5.35 秒从扁平纸页合拢两侧再抬起帆面；5.35–15.4 秒沿河道航行，桥墩/拱面实际遮挡船；15.4 秒后在灯旁停靠，末尾保持静止。镜头先靠近折纸，4.4–7.6 秒拉开。没有画内文字、配乐或音轨。

## QA 与修改记录

- 第一组 8 帧（0 / 1.6 / 3.6 / 5.2 / 9 / 10.5 / 12 / 17 秒）已视觉自查。
- 视觉修订 1：书页原印刷密度抢眼；把实际 newsPrint 画入离屏层再降低透明度，避免其内部 globalAlpha 覆盖外部设置。增大开头折纸占比，起航后拉开。
- 视觉修订 2：开头相机平移露出 62 像素未绘背景边缘，修正相机中心并复查覆盖。未改变故事事件。
- 最终不少于 6 帧自查及完整导出验证结果由项目内 QA.json、film-render-report.json 记录。首次完整 MP4 直接保存 film.mp4；完整导出后如有修改将另开版本，不覆盖首个影片。

## 验证边界

这是二维纸艺插画与分层遮挡，折叠是艺术化铰链/顶点动画，不是物理折纸教程。纸船与台灯已造型化；河流波纹是印刷纸纹并非水体模拟。没有将原海边玩具剧场换标题。技术检查包含 seek 确定性、浏览器报错、外网阻断、视频解码和规格；不代表已通过用户审美认可或已证明相对其他方案的收益。没有读取对照组，未发布。

## 实际导出结果

已用 create-project.mjs 创建独立工程并导出首个完整 film.mp4：1280×720、18.000 秒、24fps、432 帧，无音轨。FFmpeg 完整解码通过；重复任意寻帧像素一致；浏览器错误 0，外部网络请求 0。最终 9 帧完成视觉检查。首片 SHA-256：`05fb9f02ea5bf7fd01de57488d37cad9327c9edee596453f2b64508563b57118`。海报取 9 秒；未进行第三次视觉修订。
