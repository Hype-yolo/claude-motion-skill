# 新增可调用源码系统

已发布的 v0.3.0-beta.1 有17个可调用组件，每个都有实际源码、新题材开发成片、可编辑创建入口与许可。它们是17个项目组件，不代表17种独立画风。用户已选AB13的信号图解、街区投递，以及AB14的雨夜运河、池塘枫叶、工作室、车队、水彩、应用、地铁七题进入公开展示。选取不等于独立盲评或普遍收益。

v0.4.0-beta.1 另有3个新增组件，合计20个；新加入的机械、动物和纸艺代码与第15轮对照见 [本轮组件说明](source-expansion-15.md)。用户确认狐狸片质感提升；机械与纸艺的对照受二维/三维差异影响，暂不认定收益。狐狸对照已加入公开展示。

检索：`node scripts/route.mjs --extensions`；创建：`node scripts/create-extension.mjs --extension ID --out NEW_DIRECTORY`。创建给出对应导出命令。

|ID|保留的实际能力|来源与许可|
|---|---|---|
|songbie-crayon|crayon + PRESS<br>stroke and paper tooth<br>pinhole projection and depth sorting|[JohnnyWang8802/songbie](https://github.com/JohnnyWang8802/songbie/tree/97225eb54a351c9938ad896e04bef7a7020393fb) · MIT|
|lanshu-signal-explainer|真实 V2 DOM/SVG 信号组件：解码文字、章节进度、曲线绘制、Bezier 路径、目标锁定框、状态印章与 CSS 排版|[cclank/lanshu-create-ai-presenter-video](https://github.com/cclank/lanshu-create-ai-presenter-video/tree/762d3ee42623b75a4ec63ad6aa61ace69d78ce6e) · MIT|
|procedural-buildings|generateBuilding float32 facade layout<br>Kit + actual facade GLB<br>triplanar materials with bump/FBM grime<br>generateCurtains|[achrefelouafi/ProceduralBuildingsThreeJS](https://github.com/achrefelouafi/ProceduralBuildingsThreeJS/tree/6c19f1b1f14408353989ad26cda27f1e1ede5e91) · MIT code; CC0 texture sets; MIT Three.js|
|neon-city|procedural tiered buildings / TSL facades / rain|[billpwchan/neon-zenith](https://github.com/billpwchan/neon-zenith/tree/27ad04ef04aa9e1e1366fccc63e15a379b999f01) · MIT code; asset licenses separate|
|clearwater|FFT waves / ripples / caustics / refraction|[Aureliengmz/clearwater](https://github.com/Aureliengmz/clearwater/tree/4bc826134321043a25df3c2b6fed16fb7b9241e8) · MIT code; asset licenses separate|
|workspace|props geometry / vertex-color class materials / seeded plank grain|[Edd-io/Workspace](https://github.com/Edd-io/Workspace/tree/e50a203051a173f5191977d13e2259d1952de676) · MIT code; asset licenses separate|
|blockworld|procedural atlas / AO face-culling / seeded world / oak|[L1vsun/BLOCKWORLD](https://github.com/L1vsun/BLOCKWORLD/tree/4d33550c023661beda4a012630e5d93819a6677e) · MIT code; asset licenses separate|
|vehicle-motion|raycast suspension / friction ellipse / braking / steering / wheel spin|[drcollect/demolition-derby](https://github.com/drcollect/demolition-derby/tree/f559fc60a7f2ee3a21a4faf77e998ae31ad67c43) · MIT code; asset licenses separate|
|watercolor-memory|GPU max-dilation pigment transport with anisotropic paper thirst<br>torus-mapped simplex FBM<br>Beer-Lambert absorbance<br>wet-edge pooling, back-runs, paper tooth, graphite recollection|[iamtechartist/memory-fading-into-watercolor](https://github.com/iamtechartist/memory-fading-into-watercolor/tree/0bcc7cedfa9b0323437d746916174c9bba34026e) · MIT upstream code; retained dependencies keep their individual licenses|
|launch-graphics|original anim.ts E curves, frame tweens, SPR spring configurations, hitPulse<br>original RackFocus sharp/constant-blur crossfade<br>original Cursor path and press squash|[Leonxlnx/claude-launchvideo](https://github.com/Leonxlnx/claude-launchvideo/tree/f0906e8629fa524c7cedc1ac959bf987005ee846) · MIT upstream code; retained dependencies keep their individual licenses|
|neon-overdrive|original LineBatch instanced capsule SDF<br>HDR line rendering<br>original Post 7-level bloom pyramid, halation, grain, tone shoulder and texture HUD|[bizarro/evangelion](https://github.com/bizarro/evangelion/tree/8f670f3262c75a454d26e01e062da96db7eefb05) · MIT upstream code; retained dependencies keep their individual licenses|
|eudoom-motion|original four-ink PrintPost<br>actual 33-cube separation LUT<br>ink transmittance multiplication<br>dot screens, plate registration, ink grain, paper fibers|[Salmisaari/eudoom-video](https://github.com/Salmisaari/eudoom-video/tree/a7bb5ed43644cb214bd3546266c8492914177f98) · MIT upstream code; retained dependencies keep their individual licenses|
|functional-emotions|original GPU instanced brushstroke painter<br>edge-following source color sampling<br>dry-bristle stroke shader<br>canvas weave, vignette, light finish|[ledbetterljoshua/functional-emotions-video](https://github.com/ledbetterljoshua/functional-emotions-video/tree/b34c20a4f8f64ee87079a2ae2fdedf2cf1990a49) · MIT upstream code; retained dependencies keep their individual licenses|
|neighbourhood|original procedural animal head DNA and 3D projection<br>original species features, ears, muzzles, eyes, fur<br>original drawResident full body<br>original inverse-kinematics arms/legs<br>original paper and seeded ink line boil|[ChetasLua/little-neighbourhood](https://github.com/ChetasLua/little-neighbourhood/tree/7888ed552f85d63a57351efc7a69345b791936eb) · MIT upstream code; retained dependencies keep their individual licenses|
|bee-colony|core pathOf + deterministic grain/hatch<br>textures fibrePaper/sun/grass<br>nature bee and blossom|[buildwithhanif/claude-animation-skill](https://github.com/buildwithhanif/claude-animation-skill/tree/4ddb8c80fdec96dc9f55d4b9bdee60bde6f0134b) · MIT|
|pixel-birds|original BODY/AIR_LEGS/WING sprite grids<br>palette variants<br>paintGrid/widen/buildFrames|[simonw/tools](https://github.com/simonw/tools/tree/e12bd6da66e591ce2bc3fad88124e930126ac9eb) · Apache-2.0|
|people-gait|20 JOINTS samples + Catmull-Rom<br>pelvis/THIGH/SHIN proportions<br>stride and max-reach ground support|[stefanomainardi/omacrt](https://github.com/stefanomainardi/omacrt/tree/8a643fdeffc79f7cf965e68c5699caa0e1280771) · MIT|
|anatomy-mechanisms|iso投影、零件拉伸、面法线着色、倒角与表面路径|[wheresryan22/anatomy](https://github.com/wheresryan22/anatomy) · MIT|
|procedural-animals|SDF造型、骨架、IK步态、DQS蒙皮、毛层与饮水|[majidmanzarpour/threejs-procedural-animals](https://github.com/majidmanzarpour/threejs-procedural-animals) · MIT|
|anidoodle-paper|水粉、纸纤维、纸边和船体折面|[alexgreensh/anidoodle](https://github.com/alexgreensh/anidoodle) · Apache-2.0|

选择主体、动作和空间关系合适的组件，再改写故事与镜头；不能改标题交付原案例，也不因为新增就硬套画风。实际实现必须参与绘制。各组件README和SOURCE记录具体API、固定版本、资产排除和依赖许可。

Clearwater新主体为同机位合成，未接入全部水面反射折射求解。Neon为Three.js兼容的材质/几何适配，不是完整WebGPU游戏。Vehicle使用真实动力学，Collect车型不在代码MIT范围内且已排除。People只移植MIT旧版关节曲线，未使用文章图片。Launch组件原项目代码MIT，Remotion 4依赖按个人/公司条款，非MIT；使用者需遵守附带原许可。
