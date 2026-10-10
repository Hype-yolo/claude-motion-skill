# 工具使用

复制 assets/runtime 到自己的作品目录后，用相对 ES module import。Canvas 逻辑尺寸推荐 1280×720；core.paper 固定此尺寸。材质库支持任意尺寸。不包含现成人物、道具、场景或完整片段。

## 原有 core.js

- 数学：clamp(x,a=0,b=1)、mix(a,b,p)、phase(t,start,end)、hash(seed)、TAU。
- 图形：rect(g,x,y,w,h,color,radius)、ellipse(g,x,y,rx,ry,color,rotation)、disc(g,x,y,r,color)、poly(g,points,color,stroke,width)、line(g,points,color,width,closed)。
- 文字：text(g,string,x,y,size,color,align,font,weight)，默认中文字体不代表自动有字体，未安装则 fallback；用明确系统字体或自行本地载入。fitText 自动缩小超宽文字。
- 变换：withX(g,x,y,scale,rotation,fn)、alpha(g,opacity,fn)、clip(g,pathCallback,drawCallback)。
- 画材：paper(g,color,seed)、brush(g,points,color,width,reveal,seed,wet)、wash、hatch。paper 在屏幕/当前变换空间画固定画幅底材。
- 路径：curve(a,b,c,d,n)、arcPts、pathPart(points,progress)、drawPath(g,points,progress,color,width)。
- 空间：project(point,view) 为正交投影；box、shadow 是简化示意，不冒充物理渲染。
- score 为可选简易合成音演示；不是默认配乐，故事声音应另外设计。

## material.js

- paperSurface(width,height,{color,seed,density}) → 缓存 Canvas。固定随机种子，不随帧闪烁。
- cutPaper(g,points,{color,seed,lift,light,edge,texture})：纸形、局部纹理和偏移阴影。在物件的 translate/rotate 内调用，纹理才跟物件一起走。它不负责三维折叠。
- inkPlate(g,drawCallback,{color,opacity,offset,blend})：设置叠色后绘制一个色版。
- halftone(g,{x,y,width,height,cell,coverage,angle,color})：均匀灰度网点；先 clip 可限制形状。不是完整 RGB 分色引擎。cell 至少 2 像素；coverage 0..1。
- pressureStroke(g,points,{color,width,seed,reveal,dry})：按弧长揭示带起收笔宽度的笔触。不是流体模拟。

## motion.js

- progress(t,start,end)、ease(u)、track(t,[[time,value],...],curve)：标量或数组关键帧，按任意时间求值。
- impulse(t,[[time,amplitude],...],decay)：事件后的衰减脉冲。
- settle(t,at,{amplitude,frequency,damping,duration})：有结束时间的余振。
- camera2D(g,{x,y,zoom,rotation,width,height},draw)：以世界坐标中心取景。
- perspective([x,y,z],{eye,target,focal,cx,cy,near}) → {x,y,depth,scale} 或 null。世界 y 向上，屏幕 y 向下。
- drawDepth(g,[{position:[x,y,z],draw(g,projection)}],view)：按相机深度排序。
- hinge(point,origin,axis,angle)：绕轴旋转三维顶点，角度为弧度。

## 导出合同

scene.js 必需 `export const width=1280,height=720,duration=24; export function render(ctx,t){...}`。每帧绘制完整背景，时间由导出器传入。可选 `export const ready=...` 等待字体；可选 audioWav() 返回 WAV 的 base64 字符串或 Uint8Array。资源必须在 --root 内，相对 scene.js 寻址。不能引用项目外部的历史场景。

render.mjs --root <作品目录> --out <mp4路径> --fps 24；--frames 0,3,8 只输出 PNG。输出 render-report.json 包含实际解码、尺寸、帧数、脚本错误和重复 seek 检验。导出器拒绝网络资源。无 audioWav 则无声音轨，不自动补声音。
