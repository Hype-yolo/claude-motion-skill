# 定向补缺组件 · 2026-10-11

这批增加 3 个可复制工程，属于开发候选。14 个新接通的家具 GLB 来自已下载的 Kenney Furniture Kit；RoughJS 是新绘图库；接触动作是本地实现。它们不是 3 种经过验证的 Claude 风格，也不增加 47 条 Claude 相关源码案例的计数。

用 `route.mjs --query '室内阅览室' --include-experimental` 查候选，用 `create-scene.mjs --scene reading-room --out <新目录>` 创建自带资源的工程。`--scenes` 列出所有状态。默认题目路由不自动推荐这 3 个实验条目；用户明确试用或对标它们时才选择。

| ID | 实际新增能力 | 新题材验证 | 适用限制 |
| --- | --- | --- | --- |
| reading-room | 14 个新接通家具；按材质角色协调的室内组装、真实比例、木地板/布料/灰泥、曲面翻页与布帘 | 风翻过书页 | 静态低模家具；第二版使用 6 个 GLB，书柜/圆桌/窗体/书本为本地模型；其余资产仅随包保留；不代表写实室内渲染 |
| contact-workshop | 解析两连杆 IK、闭合夹爪、持物跟随、释放后固定、齿轮结构 | 装回音乐盒齿轮 | 平面双连杆，不能直接当成人体/四足步态；无碰撞、力学和真实机械传动仿真 |
| botanical-ink | RoughJS 4.6.6 的真实路径/排线调用、叶脉、齿叶、种子冠毛与生命周期动画 | 蒲公英的远行 | 新建的二维植物插画组件，尚未证明 Claude 感；不适合强套到空间交互或产品三维 |

## 编辑与复用

### reading-room
`room-kit.js` 提供 `world()`、`asset(id,height,pos,turn)`、`box/cyl/rod` 和按用途区分的材质。家具保持原 GLB 几何，将带名称的 wood/carpet/plant 材质映射到同一场景调色，不直接将整件家具刷成同一颜色。`asset` 默认按高度归一化：薄地毯必须改按水平跨度缩放，不能只按厚度放大。模型平面位置、桌面接触高度和书架内摆放需要针对新场景确认。

`film.js` 包含原创建模的曲面书页。更换故事时改写物体和镜头，不能仅改标题。`ASSETS.json` 与 `KENNEY-LICENSE.txt` 保留官方来源和原文件哈希。

### contact-workshop
`contact-motion.js` 不依赖 DOM/Three，可单独导入：

```js
const pose = solveTwoLink([baseX, baseY], [targetX, targetY], upperLength, lowerLength, 1);
// pose.shoulder / pose.elbow 是局部转角；tip 是实际解出的端点。
// reachable=false 表示目标超出工作范围；不能继续把物件放在不可达 target 上冒充握持。
const state = pickPlace(t, {home:[x,y], pick:[x,y], place:[x,y], lift:1.5});
// 18 秒示例时序；通过 track(t,keys) 改写时间、停留与运动路径。
```

夹爪末端偏移由影片显式处理，握持期间物体中心和求解端点相差固定偏移。改臂长、拾取点、落点后重新采样检查全路径是否可达、接触/释放有无跳变。数学误差小并不证明镜头里的接触一定清楚。

### botanical-ink
`botanical-kit.js` 提供 `makeDrawing(canvas)`，其 `path/line/leaf/seed/dandelion/paper` 使用有种子的 RoughJS 路径和排线。植物结构由项目编写；不是只给普通几何加噪点，也不是 Claude 原片的截帧。固定种子、按绝对时间绘制，静态高细节层可缓存。保留 `ROUGHJS-LICENSE`。

## 当前证据边界

三个组件包含修订后的代码与包内预览。阅览室修订窗体、书签和书页接触；工作台修订夹爪、盒盖与取放；植物修订种子脱离、落地和萌芽连接。

后续与独立 GPT 成片对照时，工作台与植物未获得明确改善评价；阅览室保留为精修前提下的观感展示，不能据此声称三套组件均有效。默认候选资格不变，不把第 10 轮未证明有效的冗长流程加入正式 Skill。完整研究视频未捆绑，使用 create-scene.mjs 可复制当前修订工程并自行导出。
