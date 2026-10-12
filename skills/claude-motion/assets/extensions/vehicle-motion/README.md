# 真实车辆动力与可寻址运动轨迹

创建：`node skills/claude-motion/assets/extensions/vehicle-motion/create.mjs --out <新目录>`。输出必须不存在。

实际上游：https://github.com/drcollect/demolition-derby/tree/f559fc60a7f2ee3a21a4faf77e998ae31ad67c43，许可证原文和 SOURCE.json 中的 SHA-256 随工程复制。

实际保留：Original Vehicle.step actually runs: raycast suspension springs/dampers, drive/brake/reverse, speed-dependent steering, friction ellipse, wheel slip/spin, engine and gear outputs. Original createWorld/120 Hz settings and collision groups. 2161 steps are baked to seekable transform/wheel tracks.

新题材：Three newly constructed delivery carts with no Collect geometry or named car designs, one-way bridge/river/banks, timed queue control and turn-by-turn crossing.

边界：Three 0.170.0 and Rapier 0.21.0 bundled. No deformation/damage, derby arena/game, Collect assets, audio or autonomous collision-avoidance capability claimed. New queue control supplies inputs to real vehicle dynamics; trajectory checks validate this one story.

资产许可：MIT code. All five Collect Car models, their geometry, designs and trademarks are explicitly excluded from MIT and are NOT copied into this extension or generated project. The exclusion notice is included only as documentation. New simple cart geometry is original local code. Rapier dependency has Apache-2.0 license.

创建的是可编辑的新故事示例，不能复制样片后只改标题称作另一支新片。工程不调用外部服务或生图。静态预览使用本地服务器；preview.html 在导出后播放 MP4。

导出：`node <skill>/scripts/render.mjs --root <out> --page index.html --out <out>/film.mp4 --fps 24 --gpu metal`。
