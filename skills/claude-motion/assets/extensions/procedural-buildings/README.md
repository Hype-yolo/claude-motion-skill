# 参数化建筑扩展

来源：achrefelouafi/ProceduralBuildingsThreeJS，固定提交 6c19f1b1f14408353989ad26cda27f1e1ede5e91。原代码 MIT，Three.js 0.185.1 MIT。原始纹理集合由上游 README 标记 ambientCG/Poly Haven CC0；房间照片 atlas 未纳入。

真正复用：French Building 的门窗、阳台、屋顶、墙饰 GLB 部件；float32 参数布局和随机实现；Kit 实例绘制；triplanar 色彩、粗糙度、bump、FBM 污渍；窗帘几何。原始 TypeScript 保存在 upstream/src，转换的模块在 template/system。新封装入口 template/building-system.js。

创建：`node create.mjs --out NEW_DIRECTORY`。生成的是新的开发故事“清晨送信”，可编辑 scene.js 的楼层/立面配置、街区位置、人物、动作与镜头。用同一个模板直接换标题不能作为新作。

渲染：`node <skill>/scripts/render.mjs --root NEW_DIRECTORY --page index.html --out NEW_DIRECTORY/film.mp4 --fps 24 --gpu metal`。macOS 已测 Metal；其他平台可以省略该参数，需核验 WebGL。模板自带 Three.js，运行不需要网络或重新编译。

房间灯光为新写的程序化板片，未使用原照片内景；本扩展不含 NYC/Chinese 两套完整节点系统及 .blend 文件。build.mjs 仅供开发者重新生成 JS，要求支持 stripTypeScriptTypes 的 Node；用户通常无需运行它。

技术验证：独立创建、任意时间重复绘制一致、关键帧加载无失败、本轮新故事导出 18 秒 1280×720/24fps 并完整解码通过。视觉提升待用户对照评价。骑车人和院内道具为本地新建，建筑细节继承原模型。
