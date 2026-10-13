# v0.4.0-beta.1 验证记录

在 macOS 上把发布 ZIP 解压到独立目录，执行 `npm ci`、`npm run setup`、`npm run check`。Node.js 26.0.0、FFmpeg 8.1.1；使用已缓存的同版本 Playwright Chromium，未声称全新操作系统验证。npm 审计报告 0 个已知漏洞，Skill 格式校验通过。

分别通过 `create-extension.mjs` 创建本版机械、动物、纸艺工程，用解压包内的 `scripts/render.mjs` 重新导出。清空 NODE_PATH 与 MOTION_PLAYWRIGHT_MODULE 环境覆盖，不借用研究工程的 node_modules；狐狸在 macOS 使用 `--page index.html --gpu metal`，另外两支使用默认后端。

三支均导出 18 秒、1280×720、24 fps、432 帧的无声 MP4；完整解码通过，重复寻帧图像一致，浏览器错误与外部网络请求记录为空。查看导出静帧确认三类场景正常出现。详细指标与输出哈希见 [validation.json](validation.json)。

文件校验通过：47 条案例、20 个源码组件（1,002 个组件文件）、30 个物件包、14 个场景入口、5 套制作系统、10 个示例、36 个预览、1,464 个上游源码文件。没有逐一运行所有案例或所有动物物种。

这是安装与示例导出验证，不是新题材审美实验。本轮用户认可狐狸片质感提升；机械和纸艺因二维/三维差异暂不认定收益。Windows/Linux 未实机验证。
