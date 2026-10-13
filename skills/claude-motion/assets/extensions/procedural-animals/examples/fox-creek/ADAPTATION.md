# 溪边的清晨 — 源码接入与新片改编

规格：1280×720，18 秒，24 fps，无声，无字幕。独立新片，不是上游 turntable。题目：赤狐在清晨沿溪岸走近，停下饮水，抬头望向对岸，再沿岸走远。

## 固定来源及实际调用

- Majid Manzarpour / threejs-procedural-animals，提交 `c95ae49346aa8e140a924376cec6cf0073d99512`，MIT。`upstream/src` 原样保留，SHA-256 清单见 SOURCE.json。
- Three.js 0.186.0 和 Reflector，MIT，固定文件在 vendor。
- `scene.js:38` 调用新封装 `createTimelineAnimal('fox', ...)`；新封装 `procedural-animals.js:6` 内部实际调用 `createAnimal`，每步调用 `Animal.update`。实际动物：seed 3、female、adult、red、high，75,225 顶点、149,272 三角形、39 骨骼。
- 上游 `src/species/fox/index.js` 调用 `foxRig`、`sculptFox`、`foxRegions`、`foxCoat`、`motion`；实际生成 SDF 身体、尖吻、大耳、白胸与尾梢、黑腿和毛层。狐狸没有换成简化自画几何体。
- 上游 `src/core/motion/quadruped.js` 保留四足 IK、着地、步态、颈头与尾部二次运动；`src/core/render/dqs.js` 保留双四元数蒙皮；`animalObject.js` 保留 GPU 毛层/轮廓毛片与眼球。
- `scene.js:41–46` 用原 API `follow`/`move`/`play('drink')`/`lookAt` 编排。饮水通过上游 `src/core/motion/actions.js:517` 的 `applyGround`，保留头部接近水面、下颌舔舐与前躯下降。
- `procedural-animals.js` 新增 120 Hz 固定时间采样，存 DQ/眼睛矩阵/毛力/眼部 uniforms，seek 恢复最近样本。上游眨眼的 Math.random 在初始化与采样期间固定种子，随后恢复。

## 新写部分

新写溪岸、石头、草、树、蕨类、程序噪声地面、水面倒影和涟漪。新写接近—停步转身—饮水—观察—离开的 18 秒时间轴与连续镜头。无外部模型、图像、字体或音频资产。

## 检查与修改记录

1. 技术故障：旧 Three 0.170 的材质字段与 NUM_SUN_LIGHTS 不兼容，导致狐狸 shader 编译失败。先通过浏览器控制台定位，改用上游开发依赖相同的固定 0.186.0；原版 source 未改。并把已移除 PCFSoftShadowMap 换为 PCFShadowMap。最终控制台检查没有 shader 错误。
2. 技术故障：`follow` 即使速度为零也会使上游立即中断 drink。停止段解除 follow，改 `move({speed:0})`，保留原动作层。没有人工摆放头部冒充饮水。
3. 首个完整导出 `film-v1.mp4` 保留；`first-complete-contact-sheet.png` 为 0、3、7.5、9、12、16.5 秒六帧。检查发现饮水点被岸石遮挡、水面呈平行条纹、近景主体偏小。
4. 视觉修订 1：清理饮水点岸石，调整岸线与近景镜头，减细草叶、增加雾层次、加地面细纹。检查同组六帧，饮水清楚，但水面出现过于规则的点阵。
5. 视觉修订 2（最后一轮）：加入真实平面倒影，改细水纹，修补岸线白缝，并清理离开路径近处的石块。`qa-v3-*` 六帧中，脚与岸面、低头与水面、抬头观察均可辨认，倒影与主体一致。
6. 最终导出由 `film-render-report.json` 记录实际尺寸/时长/432帧/音轨/解码/重复seek；`webgl-check.log` 记录最终 WebGL 检查。poster.png 使用最终12秒抬头画面。

## 边界

这是一套真实程序动物机制与新场景的开发示例，不代表新增一种 Claude 风格，也不表示用户审美认可。环境为简化的风格化三维森林，倒影是平面反射，水纹/涟漪是程序动画，未模拟流体。接触检查为画面与骨架机制层面的验证，不是全地形碰撞或生物力学验证。其余物种源码完整保留，但本次仅狐狸生成和影片导出经过验证。时间轴以最近的 1/120 秒样本播放，不能宣称任意采样率连续精确解算。未读取 before 对照、其他影片或实验历史，也没有公开发布。
