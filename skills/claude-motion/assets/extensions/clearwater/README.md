# 实时浅水、FFT 波面与 RGB 焦散

创建：`node skills/claude-motion/assets/extensions/clearwater/create.mjs --out <新目录>`。输出必须不存在。

实际上游：https://github.com/Aureliengmz/clearwater/tree/4bc826134321043a25df3c2b6fed16fb7b9241e8，许可证原文和 SOURCE.json 中的 SHA-256 随工程复制。

实际保留：Entire original ocean-spectrum FFT, ripple wave equation, RGB refracted-grid caustics, Fresnel/absorption/refraction main water shader, procedural pebble bed and bloom/tone/grain.

新题材：New red maple geometry with lobes and veins, stones, wooden footbridge, timed leaf landing and drift. Added Three geometry is composited over the native water canvas with the same camera basis. The timeline advances the original ripple solver at fixed 60 Hz and resets on backward seek.

边界：Three 0.170.0 bundled. Use default Chromium software renderer for exact repeatability. Metal produced sub-pixel caustic accumulation differences in RGB; software passed identical repeated seek. Lens-diffraction glare is disabled; FFT water, caustics, and bloom are active. Stones/bridge added by an overlay are not part of the water shader reflection/refraction integrator.

资产许可：MIT code and embedded procedural pebble texture; README identifies tools/make_pebbles.py as its generator. No author portrait, brand artwork, music or third-party models copied into the visible scene.

创建的是可编辑的新故事示例，不能复制样片后只改标题称作另一支新片。工程不调用外部服务或生图。静态预览使用本地服务器；preview.html 在导出后播放 MP4。

导出：`node <skill>/scripts/render.mjs --root <out> --page index.html --out <out>/film.mp4 --fps 24`。
