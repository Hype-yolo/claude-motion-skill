# 方法依据与实现边界

本页记录先前的纯方法/通用工具版本。runtime/core.js 来自本项目先前原创工具；material.js 和 motion.js 按通用图形学原理实现。这些工具本身不含外部场景。

当前默认已经改为案例辅助创作：外部源码另外打包在 assets/cases/，来源、固定提交、许可、预览状态见 case-catalog.json 及每个 package 的 IMPORT.json / LICENSE。不要将案例辅助生成称作原先的闭卷方法迁移。

- c5inco/motion-showreel，commit fa37a7dea6fd346b6fb2aeee9fa35e1632538222：完整 Motion.kt 和 Reel.kt。观察时间段、共享冲击、主体变形接续、排版布局与后处理。Android 作品未在本机运行，不把阅读当作完整成片观看。
- latent-variable/deep-learning-birthday，commit 810cd2a22e36977cc2bcf91b6e0bd9bf0185c5d8：完整 video/animation/src/riso/engine.js。观察图像/文字双层、分色网点、叠印、重置状态与转场。不导入外部角色、音乐、生成图。
- kirillshsh/claude-vs-codex，commit 0a73cb3451c1154cc3ad3639417274eb895ca9ea：cam3d.py 的相机、地面、billboard、shadow、world sorting 部分。观察投影、采样、距离缩放与遮挡，不带第三方角色资产。
- liustack/flipbook，commit ded82ddf805615cfac0eb1a666476042a0d2607b：纸张样例。观察 setup 生成底材与 seek 绘制内容的职责划分。

动作因果、剪影检验、风格选择与实验安排是项目综合推导，不能归为作者逐条原话，也不声称学会全部风格。闭卷生成不用打开上述仓库。详细研究与读取记录在项目 docs/research/，不作为 Skill 创作时的额外输入。
