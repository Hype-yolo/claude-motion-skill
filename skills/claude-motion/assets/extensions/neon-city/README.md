# 雨夜城市、程序幕墙与无状态雨

创建：`node skills/claude-motion/assets/extensions/neon-city/create.mjs --out <新目录>`。输出必须不存在。

实际上游：https://github.com/billpwchan/neon-zenith/tree/27ad04ef04aa9e1e1366fccc63e15a379b999f01，许可证原文和 SOURCE.json 中的 SHA-256 随工程复制。

实际保留：Original corporate/rngFor tier geometry, complete createBuildings procedural TSL window/parallax/grime/neon-spill material, makeNoiseTexture, original stateless createRain streak and splash shaders, chunkedInstances. The city chooses original GLASS style to use the procedural branch, with neutral array placeholders for the unused captured-facade branch.

新题材：New canal, stone bridge, paper canopy with ribs, maintenance quadrotor with retrieval tether, umbrella fall/drift/retrieval and a moving camera.

边界：Three 0.170.0 bundled. Original upstream is 0.186.1; this adaptation was actually rendered with 0.170.0. Native WebGL backend, not a full WebGPU/game port.

资产许可：MIT code. Concrete and shutter maps are CC0 according to upstream CREDITS: Poly Haven. No CC BY external vehicle/shop/building models, photographic facade atlases, fonts, HDRI or audio are included.

创建的是可编辑的新故事示例，不能复制样片后只改标题称作另一支新片。工程不调用外部服务或生图。静态预览使用本地服务器；preview.html 在导出后播放 MP4。

导出：`node <skill>/scripts/render.mjs --root <out> --page index.html --out <out>/film.mp4 --fps 24 --gpu metal`。
