# 安装与导出 · v0.2.0-beta.1

下载公开仓库或 Release 压缩包，将整个 `skills/claude-motion` 文件夹放入你的 Agent 的 Skill 目录。Codex 默认目录为 `~/.codex/skills/claude-motion`；已有同名版本时先备份，不合并覆盖。宿主提供安装工具时，也可以让它安装仓库中的 `skills/claude-motion` 子目录。

## 依赖

需要 Node.js 22+、npm、FFmpeg 和 ffprobe。Playwright 固定为 1.63.0。项目不捆绑 Node/FFmpeg；先确保 `node --version`、`ffmpeg -version` 与 `ffprobe -version` 可运行。

在 **Skill 所在目录** 安装固定版本依赖：

```sh
npm ci
```

下载该版本的 Chromium：

```sh
npm run setup
```

Linux 缺少浏览器系统库时，按 Playwright 提示安装对应系统依赖。当前发布验证在 macOS 上执行，不声称 Windows/Linux 已实机验证。

检查案例源码、路径及版权文件：

```sh
npm run check
```

## 用题目创作

向 Agent 输入：

> 使用 $claude-motion：一只小狐狸在初雪前归还丢失的手套。生成可编辑的短片并导出 MP4。

这是使用示例，不保证每次生成相同画面。Agent 会查找案例、检查实际实现，在新作品目录改编并运行导出器。新增生图不是必需步骤。

## 重现现有演示，验证安装

下面命令都在 Skill 目录执行。演示是已有五题对照中的“谣言传播”Skill 版本，无需调用模型或生图；用于检验代码到 MP4 的链路，不算新的生成实验。

先复制带许可的原案例。`demo-rumor` 必须是新目录：

```sh
node scripts/prepare-case.mjs --case lemo-midcentury-toon --out demo-rumor
```

复制现有影片的编排代码：

```sh
node -e "require('fs').copyFileSync('assets/examples/rumor/scene.js','demo-rumor/scene.js')"
```

导出：

```sh
node scripts/render.mjs --root demo-rumor --out demo-rumor/film.mp4 --fps 24
```

成功后得到 18 秒、1280×720、24 fps、432 帧、无声的 MP4，以及封面和 `film-render-report.json`。报告应为 `decode: passed`、`seekRepeat: identical`、空 `errors` 和 `blocked`。画面使用系统 Georgia；系统字体差异可能改变排版。

## 案例边界

原例预览与额外依赖见 [case-status.md](case-status.md)。11 套预览不可用的案例仍提供源码，使用前需要处理缺口。即使预览可用，也不能保证复制原网页就能完整播放；优先通过已检查的绘图模块改编。

所有资源必须位于作品目录中；标准导出器禁止外部网络资源。额外字体、声音、模型和纹理需自行合法取得并放入本地。无 `audioWav()` 即无声，不自动生成配音、配乐或字幕。

## 场景、模型与系统

本版本包含 5 套制作系统、14 个场景入口和 30 个物件包；统计互有重合，不相加作为风格数量。先阅读 [工作原理](how-it-works.md)，再按题目选择。

列出场景：

```sh
node scripts/route.mjs --scenes
```

创建阅览室修订示例，目录必须不存在：

```sh
node scripts/create-scene.mjs --scene reading-room --out demo-room
```

导出原生页面工程：

```sh
node scripts/render.mjs --root demo-room --page index.html --out demo-room/film.mp4 --fps 24
```

macOS WebGL 渲染较慢时可加 `--gpu metal`；其他平台保持默认。three、p5、p5.brush 通过 npm 锁文件安装；生成器按需复制依赖与许可进入工程。三个实验场景可以显式创建，默认题目检索不推荐，需要 `--include-experimental` 才纳入候选。

场景创建是在复制可编辑示例，换题仍需改写故事与时间线。包内开发示例不等于都比直接生成更好。
