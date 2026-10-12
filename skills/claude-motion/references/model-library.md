# 具体模型与使用边界

`node <skill>/scripts/route.mjs --models` 查看模型；普通 `--query` 同时返回匹配的 modelCandidates。

`node <skill>/scripts/create-model.mjs --model <id> --out <新目录>` 会校验源文件、复制模型/署名/许可证和可离线运行的 8 秒检视工程。导出命令使用 `render.mjs --page index.html`；检视默认无音轨。需要先安装 Skill 依赖。

| ID | 能复用的内容 | 来源类型 |
| --- | --- | --- |
| fox | 完整低模狐狸、材质、骨骼，Survey/Walk/Run 三段动作 | Khronos 托管；PixelMannen 模型 CC0，tomkranis 动画和 AsoboStudio/scurest 转换 CC-BY-4.0 |
| boombox | 收音机网格、PBR 贴图 | Microsoft CC0，非 Claude 案例 |
| lantern | 木架、链条、灯笼与贴图 | sbtron/Microsoft，CC0，非 Claude 案例 |
| aura-bud | makeBud、makeCase、explode、setPulses，含各零件几何 | 原 Lemo 玻璃产品案例完整 product.js，MIT；作者声明 Claude 创作 |
| hourglass | 连续玻璃腔体、框架，makeHourglass/update，上下沙堆共享体积 | 本项目修订代码 MIT，非新增 Claude 来源 |
| turntable | 木底座、唱盘、配重、唱臂/抬落铰链、唱头和唱针 | 本项目修订代码 MIT，非新增 Claude 来源 |

| delivery-truck | 完整货车、车轮动画 | Cesium CC-BY-4.0；原标志的额外说明保留，不表示商标授权 |
| toy-car | 玩具车、红色织物与底座、原 PBR 材质 | Guido Odendahl / Eric Chadwick，CC0；这是完整场景，非已拆好的单车 |
| avocado | 牛油果外皮、切面与果核贴图模型 | Microsoft CC0，静态，无骨骼动作 |
| expressive-robot | 全身骨骼、表情变形与多个原动作 | Tomás Laulhé / Don McCurdy，CC0；并非 Claude 来源 |

这些是 30 个物件包，不代表 30 种新风格。外部模型共 27 个，接通已有完整源模型 1 套，本地修订物件 2 个。山顶包裹成片得到正向评价，不能把它推广到所有物件。

先选适合场景的轮廓、比例和材质，再决定使用哪种灯光或风格系统；完整模型也可能与背景不协调。静态 GLB 不自带动作，不能把转相机算作获得主体动作。不要因为狐狸可用就把所有角色换成狐狸。

优先保留建模结构与功能关系。产品片验证正面/侧面轮廓、轴心和接触位置；沙漏检查沙堆体积及是否越过玻璃；唱机检查唱针是否落在唱片有效半径内。不需要给不相关题材机械套这些检查。

2026-10-10 用户指出：HD2D 室内蓝背景显得没搭完，森林角色生硬，Clawd 不是 Claude 感，玻璃沙漏/唱机原型质量不合格。因此原 glass 两支不再默认创建；handdrawn 不再自动推荐原吉祥物范例。这不否定原材质、墨线或影棚模块，而是禁止把可运行当作视觉成功。

文件级来源、上游提交、散列及许可证见各包 IMPORT.json / UPSTREAM.md。可再分发条件按资产自身许可保留，不能给整个模型库统一盖 MIT。

模型检视优先播放 Idle，其次 Survey；可在源码页使用 `?clip=Walking` 等实际片段名切换。动作名称以 modelAudit.animations 为准，不能从模型外观推断。静态物件的旋转检视不算主体动作。

## 本轮补充：20 个具体对象

8 个 Kenney 家具：写字桌、书桌椅、开放书架、沙发、落地灯、咖啡机、炉灶、床。8 个 Kenney 自然物件：橡树、松树、木桥、独木舟、帐篷、岩石、红花、篝火木堆。全部静态模型，无骨骼动作；篝火仅木堆，不含燃烧模拟。

4 个 Quaternius 动物：鹿、马、柴犬、羊驼，带原始骨骼动作。用预览底部动作选择器切换实际片段；通过模型目录 capabilities.clips 查找名字。跑步片段不等于角色已经沿场景路径行走，位移、转弯与接地仍需编排。原 glTF 同时保留，GLB 为无损容器转换。

来源：Kenney Furniture Kit / Nature Kit；Quaternius Ultimate Animated Animal Pack，均按官方 CC0 声明和包内文件记录。所有文件有本地 SHA256；网站素材没有 Git 提交时以下载 URL 和包散列定位，不编造提交号。通用开源模型不是 Claude 源码案例。
