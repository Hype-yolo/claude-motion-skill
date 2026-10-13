# 第 15 轮：三类源码能力

v0.4.0-beta.1 新增三个可调用组件。用户最新评价：狐狸片质感明显提升；机械、纸艺因二维/三维不同而暂按不相上下。原来的47套源码案例、30个物件包及14个场景口径不变。源码组件由17项变为20项，不等于新增三种独立画风。

| 入口 | 适用缺口 | 实际保留 | 限制 |
| --- | --- | --- | --- |
| anatomy-mechanisms | 机械主体、轴与安装件、剖面关系 | Anatomy 的 iso、extrude、面法线分层着色、圆角、倒角、表面路径；Canvas 桥接 | 正交投影，遮挡需编排；齿形是视觉近似，不是制造或物理模拟 |
| procedural-animals | 四足动物造型、骨架、落脚、饮水 | SDF 雕塑、39骨骼四足IK、DQS蒙皮、毛层、眼睛、动作状态；确定性采样封装 | 本轮只验证狐狸；其他物种源码存在不代表已逐一验证；缓存随时长增长 |
| anidoodle-paper | 水粉纸面、纤维、纸边、印刷与折面 | paperCraft、scrapbookKit 中真实材质函数、船体折面；原TS源码与编译实现 | 二维层叠，折叠是艺术化铰链；不提供任意形状折纸物理 |

检索 `node <skill>/scripts/route.mjs --extensions`，或按题目查询。创建：

```sh
node <skill>/scripts/create-extension.mjs --extension anatomy-mechanisms --out /absolute/new-film
node <skill>/scripts/create-extension.mjs --extension procedural-animals --out /absolute/new-film
node <skill>/scripts/create-extension.mjs --extension anidoodle-paper --out /absolute/new-film
```

每次指定一个不存在的新目录。创建结果给出对应导出入口。三类都可以用 Skill 的 render.mjs 导出；动物另加原生页面参数 `--page index.html`。纸艺工程也保留自带导出器。安装与具体命令见 installation.md。动物自带 Three.js 0.186.0，不能直接替换为其他组件的0.170.0；没有改变已有组件依赖。

## 来源与许可

- [wheresryan22/anatomy](https://github.com/wheresryan22/anatomy/tree/689dcf966e63d92be10a5d593c6e19e10acd4422)，MIT，原 kit 文件未修改。
- [majidmanzarpour/threejs-procedural-animals](https://github.com/majidmanzarpour/threejs-procedural-animals/tree/c95ae49346aa8e140a924376cec6cf0073d99512)，MIT；Three.js 的MIT单独保留。是作者的相关动物实现，不称为原像素巫师影片源码。
- [alexgreensh/anidoodle](https://github.com/alexgreensh/anidoodle/tree/06f8be2bef0faa94e7eb6009ef23b36a0ae7b8a8)，Apache-2.0，保留LICENSE和NOTICE；没有引入可选音频包、艺术参考图片或其他例外媒体。

各组件内 SOURCE.json 保存来源、固定提交与文件哈希。创建工程中的 ADAPTATION.md 记录实际调用、改写、视觉检查和未验证边界。

## 本轮新题材及证据边界

分别创作《风留下的笔迹》《溪边的清晨》《书页里的小港口》，均为18秒、720p、24fps无声新片；另有使用扩充前冻结 Skill 的三支同题影片。六支都已导出，用户选中的狐狸两支已加入公开展示。完整研究记录不随发行包提供，包内保留新作品的可编辑示例和改编说明。

旧版三题在独立上下文中制作；新版动物和纸艺用各自全新上下文，机械由集成主代理制作。共享文件系统，按指令隔离，不是操作系统沙箱；主代理不看旧组成片后修改新版。两组允许相同次数的自查，旧组个别动作不足按实际结果保留。

这轮比较整个创作结果，允许两组不同的选型；没有固定同一画风和全部参数。因此用户能判断新增能力是否对这些题目有帮助，但单次定向试作不能证明任何题目都改善。用户已确认狐狸这一支的质感提升；机械、纸艺没有证明新增收益。以后若检验这两类，应控制同一二维/三维表现方式及风格、渲染条件。勿把一支狐狸片的结果写成所有动物或所有题目的稳定收益。
