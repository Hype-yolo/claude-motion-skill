# Claude Motion · v0.1.0-beta.1

让 Agent 从真实的动画源码里选一种合适的表现方式，再改编成新短片。

这是一个 **案例辅助的代码动画 Skill**：按题目查找开源实现，保留其中的造型、笔触、材质和运动机制，重写故事与镜头，交付可编辑源码和 MP4。它探索更有“Claude 感”的视觉效果，不是模型训练，也不保证每个题目都优于直接生成。

## 包含什么

- 47 套源码案例：43 套 Lemo Opuscar＋4 套 ReelMimic，来自 2 个导入仓库；不意味着 47 种完全不同的风格。
- 36 套实际原例抽帧预览，其中 35 套使用字体回退；11 套仍有运行缺口。抽帧不代表完整原片已复现。
- 案例检索、源码提取、来源与许可清单、确定性 MP4 导出。
- 一支既有“谣言传播”影片的编排源码，可重现验证安装，无需再调用模型。

[查看 Skill](skills/claude-motion/SKILL.md) · [各案例状态与依赖](skills/claude-motion/references/case-status.md) · [安装到导出](skills/claude-motion/references/installation.md) · [验证记录](VALIDATION.md)

## 安装

下载 Release 压缩包，或者：

```sh
git clone https://github.com/Hype-yolo/claude-motion-skill.git
```

将 `skills/claude-motion` 完整复制到宿主的 Skill 目录。Codex 默认是 `~/.codex/skills/claude-motion`。已有同名版本请先备份；不要直接合并覆盖。

准备 Node 22+、FFmpeg 与 ffprobe。在复制后的 Skill 目录运行：

```sh
npm ci
```

```sh
npm run setup
```

```sh
npm run check
```

也可以先在仓库内的 `skills/claude-motion` 目录执行以上命令，再复制整个已安装文件夹。导出器优先解析 Skill 内安装的 Playwright，不要求创作目录另装一份。

## 使用

向 Agent 输入：

> 使用 $claude-motion：一只小狐狸在初雪前归还丢失的手套。做成可编辑短片并导出 MP4。

不指定画风时由 Agent 选择案例。可读取案例源码和现有预览，因此这不是“完全无参考”的生成。新增 AI 生图并非必需。导出器只读取本地资源；声音需要单独实现，无音频时影片就是无声。

## 已经观察到什么

早期三个题目的定性比较中，作者更认可或总体偏向 GPT＋Skill、不新增参考图的版本。这些反馈是在已接触条件说明后获得，不能称为严格盲评。

随后五题、十支影片的隐藏条件比较中，作者认出了四组 Skill 版本，但认为沙漠与谣言两题没有明显改进，台灯的直接生成版本也很好。“认出来”不算质量胜出。两轮分别使用当时冻结的 Skill；不能把早期结果归因于后来增加的案例。

当前未证明稳定增强 Claude 感或降低粗糙作品的比例。欢迎分别反馈风格偏好和完成度，允许两版都好、无明显区别或两版都不好。

## 来源与许可

主要绘图实现归原作者：

- [Lemo Opuscar](https://github.com/lemomo-ai/lemo-opuscar)，固定提交 `c4bc370eb15d36c88e074fdba1b0248b62a8e419`，MIT 代码。
- [ReelMimic](https://github.com/edenfunf/reelmimic)，固定提交 `73492b0dac349bb46a3ae8a8bf6fb2b34cf3b02e`，选定模板及渲染器沿用各自 MIT 署名。

1,362 个导入文件的原始哈希可通过 `npm run check` 检验。第三方素材保留各自许可；未捆绑外部音乐、字体、摄影、模型和纹理。[详细许可说明](skills/claude-motion/THIRD_PARTY_NOTICES.md)。研究索引中的其他仓库不等于已导入或已授权再分发的素材。

这是独立社区项目，与 Anthropic/OpenAI 无隶属或背书关系。Claude/Opus 来源标签是上游作者声明，不是我们核验过的模型调用日志。
