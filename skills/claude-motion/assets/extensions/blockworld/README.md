# 体素地形、AO 网格与橡树生成

创建：`node skills/claude-motion/assets/extensions/blockworld/create.mjs --out <新目录>`。输出必须不存在。

实际上游：https://github.com/L1vsun/BLOCKWORLD/tree/4d33550c023661beda4a012630e5d93819a6677e，许可证原文和 SOURCE.json 中的 SHA-256 随工程复制。

实际保留：Original game.js seeded terrain/noise, procedural block atlas, face-culling AO chunk mesher, sun/moon lighting/shadows and original oak() tree algorithm. Original bundled Three 0.180 renderer retained. Added rawSet/rebuildAll/blockMesh expose those mechanisms; tree blocks are produced by oak and displayed using the original atlas UV mapping.

新题材：New sculpted block hillside/bare patch, a new garden robot and planting arm, seed placement, tree growth by scaling source-generated oak geometry, and a deterministic observation camera.

边界：Original game port is deliberately bounded to a 4x4 chunk cinematic world. No claim that the full playable 224x72x224 game or block-edit interface is integrated; tree growth is new geometry scaling, not a biological simulation.

资产许可：MIT game code. Procedural textures and original vendor bundle retained with license notices; no downloaded model/texture/character assets.

创建的是可编辑的新故事示例，不能复制样片后只改标题称作另一支新片。工程不调用外部服务或生图。静态预览使用本地服务器；preview.html 在导出后播放 MP4。

导出：`node <skill>/scripts/render.mjs --root <out> --page index.html --out <out>/film.mp4 --fps 24 --gpu metal`。
