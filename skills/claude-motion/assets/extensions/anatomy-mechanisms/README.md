# Anatomy 机械结构组件

上游：wheresryan22/anatomy，固定提交 `689dcf966e63d92be10a5d593c6e19e10acd4422`，MIT。

`vendor/iso-kit.mjs` 原样保留投影、轮廓拉伸、面法线分层着色、圆角、倒角及曲面刻度。`mechanisms.js` 将上游输出的路径交给 Canvas Path2D；另提供齿轮、螺丝和安装板。新主体的轴、支架、传动与记录路径仍需要编排，组件不自动求解机械设计或碰撞。

创建：`node create-project.mjs --out /absolute/new-project`。
导出：`node <skill>/scripts/render.mjs --root /absolute/new-project --out /absolute/new-project/film.mp4 --fps 24`。

主要接口：`solid(ctx,k.cylinder(...),materials.brass)`、`solid(ctx,k.slabOf(...),materials.enamel)`、`gear(ctx,{x,y,z,radius,teeth,angle,height,projection})`。`k` 为上游所有原始导出。`path()` 支持直接绘制上游 `segment`、`ring`、`coil` 等路径。

同一平面啮合齿轮应使用相同模数，并按齿数反比、反方向转动。本地齿形为视觉近似，不是制造级渐开线齿形。物件按空间关系排序，遮挡需要在新镜头中实际检查。此组件是正交投影路径实现，不是自由摄影机的三维网格。

默认创建已经改编的风速仪起点；另附 mechanism-study 基础几何示例。新题目仍须重新编写主体和事件，不把风速仪换标题当新片。没有外部音频、贴图或字体。可复用几何能力不等于保证画面提升。
