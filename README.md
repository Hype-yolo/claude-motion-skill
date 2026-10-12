# Claude Motion · v0.2.0-beta.1

让 GPT 按题目查找可用的动画源码和物件，保留造型、材质与运动实现，再改编成新短片。

**这是一套案例辅助的代码动画 Skill。** 包含使用说明、绘图源码、模型、可编辑示例与 MP4 导出工具。默认不要求额外生图；没有训练或修改模型权重。

[五组视频对照](https://hypeyolo.com/motion/) · [下载发布包](https://github.com/Hype-yolo/claude-motion-skill/releases/tag/v0.2.0-beta.1) · [完整制作逻辑](skills/claude-motion/references/how-it-works.md) · [Skill 入口](skills/claude-motion/SKILL.md) · [安装与导出](skills/claude-motion/references/installation.md) · [验证记录](VALIDATION.md)

## 包含什么

| 内容 | 数量与状态 |
| --- | --- |
| 源码案例 | 47 条：Lemo 43、ReelMimic 4；36 个原例预览、11 个预览缺口 |
| 制作系统 | 5 套、10 个可编辑开发示例 |
| 场景入口 | 14 个：11 个既有入口、3 个实验组件；含 7 个 animate 来源示例 |
| 物件包 | 30 条：27 个外部模型、1 套既有产品几何、2 个本地模型 |
| 工具 | 检索、来源校验、工程创建、抽帧与 MP4 导出 |

分类存在重合，不能相加成风格总数。阅览室另含 14 个家具文件。模型资产具有自己的许可，不是全部 MIT，也不都由 Claude 生成。1,464 个导入源码文件有原始哈希；模型与场景另有文件清单。

## 从输入到成片

1. Agent 把题目拆成主体、动作和画面需求，用标签检索找到候选。
2. 阅读候选源码和预览，确定整片的造型、材质和运动规则。
3. 复制合适的实现或模型，重写新题目的场景、事件与镜头。
4. 缺少对象时组合或新建结构，并协调风格；模型库不会自动消除穿模。
5. 检查关键动作和代表片段，修正后导出 MP4 与可编辑源码。

检索排序不是美感评分，示例复制不是自动故事生成。Agent 仍需做选择、写代码、看画面和修改。

## 安装与使用

准备 Node.js 22+、FFmpeg、ffprobe。解压发布包，将整个 `skills/claude-motion` 放入 Agent 的 Skill 目录，例如 Codex 的 `~/.codex/skills/claude-motion`。已有同名版本先备份，不合并覆盖。

在 Skill 目录依次运行：

```sh
npm ci
```

```sh
npm run setup
```

```sh
npm run check
```

`status: passed` 表示包内文件校验通过。完整渲染复现见安装文档；当前只验证 macOS，不声称其他系统已经实机测试。

向 Agent 输入：

> 使用 $claude-motion：守塔人修好卡住的灯塔透镜，让小船找到港口。做成 18 秒短片，交付 MP4 和可编辑源码。

题目可以不同，风格也可指定。无 `audioWav()` 的工程不会自动有声音；不会因为中文对话就默认加中文字幕。

## 对照怎样解读

目前选取五组作品展示。天文台与山顶包裹使用同题独立生成的有无 Skill 对照；阅览室是精修版本与后补独立版本，修改经历不同。灯塔与光圈比较同一 GPT 使用本包和 Lemo 官方 Skill，二者各自选择风格。同轮围巾没有明显偏好。

这五组是筛选后的作品，不能当作全部实验胜率或跨题材保证。当前资源包与各次实验冻结版本并不完全相同；没有把旧成片伪装成用新版重跑的结果。我们的库也复用了部分 Lemo 源码，对照不表示两套源码完全独立。视频展示单独交付，不包含在 Skill 安装包中。

## 来源与许可

主要来源为 [Lemo Opuscar](https://github.com/lemomo-ai/lemo-opuscar)、[ReelMimic](https://github.com/edenfunf/reelmimic)、[animate](https://github.com/cth9191/animate)、[ClaudeAnimationBase](https://github.com/JohnHeibel/ClaudeAnimationBase)，以及 Khronos 示例资产、Kenney、Quaternius。

固定提交、来源与完整许可见 [第三方声明](skills/claude-motion/THIRD_PARTY_NOTICES.md) 和各资源清单。原创工具采用 MIT；外部字体、模型、绘图库沿用各自许可。分发包不包含私人研究记录、聊天、服务器信息或旧实验输入。

独立社区项目，与 Anthropic、OpenAI 无隶属或背书关系。名称指希望接近的视觉方向；源码作者的模型归属声明未经独立 API 日志审计。
