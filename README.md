# Claude Motion · v0.3.0-beta.1

让 GPT 按题目查找可用的动画源码和物件，保留造型、材质与运动实现，再改编成新短片。

**这是一套案例辅助的代码动画 Skill。** 包含使用说明、绘图源码、模型、可编辑示例与 MP4 导出工具。默认不要求额外生图；没有训练或修改模型权重。

[十四组视频对照](https://hypeyolo.com/motion/) · [下载发布包](https://github.com/Hype-yolo/claude-motion-skill/releases/tag/v0.3.0-beta.1) · [完整制作逻辑](skills/claude-motion/references/how-it-works.md) · [Skill 入口](skills/claude-motion/SKILL.md) · [安装与导出](skills/claude-motion/references/installation.md) · [验证记录](VALIDATION.md)

## 包含什么

| 内容 | 数量与状态 |
| --- | --- |
| 源码案例 | 47 条：Lemo 43、ReelMimic 4；36 个原例预览、11 个预览缺口 |
| 制作系统 | 5 套、10 个可编辑开发示例 |
| 场景入口 | 14 个：11 个既有入口、3 个实验组件；含 7 个 animate 来源示例 |
| 物件包 | 30 条：27 个外部模型、1 套既有产品几何、2 个本地模型 |
| 新接通源码组件 | 17 个：每个提供实际绘制/材质/动作实现、创建入口、预览与许可 |
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

把下面这段直接发给 Codex（或其他支持 Skill 的 Agent）：

> 请从 https://github.com/Hype-yolo/claude-motion-skill 安装最新版 Claude Motion Skill，入口是仓库里的 skills/claude-motion。已有同名版本先备份，再检查并安装 Node.js 22+、FFmpeg/ffprobe、npm 依赖和 Playwright Chromium，运行 npm run check。完成后，用 $claude-motion 按我的题目制作短片，交付 MP4、可编辑源码和可播放预览。

安装说明见 [installation.md](skills/claude-motion/references/installation.md)。已有同名版本先备份，不合并覆盖；依赖和浏览器不捆绑在ZIP中。当前实际验证macOS，不声称Windows/Linux已实机测试。

例如：

> 使用 $claude-motion：一间海边修理铺，店主修好旧收音机，窗外天色渐亮。做成18秒短片，交付MP4和可编辑源码；画风由你按题目选择。

这是新的使用示例，不是本文已验证影片。声音需要工程提供，没有音频接口就无声，也不因为中文聊天默认加中文字幕。

## 对照怎样解读

目前公开展示十四组、二十八支原片。最前七组来自新增源码组件的同题有无Skill对照，双方18秒、720p、24fps、无额外生图、静音，按用户选择公开；题目针对素材能力选择，计算时长未严格匹配。

旧七组中，天文台、山顶包裹、信号图解和街区投递为同题对照；阅览室右侧是精修片，两侧修改经历不同；灯塔和光圈比较同一GPT使用本包与Lemo官方Skill。每组条件和署名在展示页单列。

这些是筛选后的作品，不代表全部实验胜率、严格独立盲评或跨题材保证；没有把旧影片伪装成用最终发布包重新生成的结果。库里本来就复用了部分Lemo源码，不表示两套源码完全独立。新接通组件各有新题材开发片，原片没有换标题冒充新片。安装包提供源码、资产和静帧，不包含研究视频、私有记录或对照代理输入。

## 来源与许可

主要来源为 [Lemo Opuscar](https://github.com/lemomo-ai/lemo-opuscar)、[ReelMimic](https://github.com/edenfunf/reelmimic)、[animate](https://github.com/cth9191/animate)、[ClaudeAnimationBase](https://github.com/JohnHeibel/ClaudeAnimationBase)，以及 Khronos 示例资产、Kenney、Quaternius。新增组件来源可查看 [17个源码组件](skills/claude-motion/references/source-extensions.md)。

固定提交、来源与完整许可见 [第三方声明](skills/claude-motion/THIRD_PARTY_NOTICES.md) 和各资源清单。原创工具采用 MIT；外部字体、模型、绘图库沿用各自许可。特别是应用发布组件的Remotion4依赖不是MIT；车辆组件不含上游单独排除的Collect车型。分发包不包含私人研究记录、聊天、服务器信息或旧实验输入。

独立社区项目，与 Anthropic、OpenAI 无隶属或背书关系。名称指希望接近的视觉方向；源码作者的模型归属声明未经独立 API 日志审计。
