# 组装 index.html = 通用框架头（frame_head.html：样式/滤镜/动画工具）+ 本集 main.js
# 收录进 Lemo-Opuscar 时：原来从 ../cat-case/index.html 截取「// 猫（胖橘）」之前的部分，
# 已把截出来的那段（标题已换成 AI 进化节拍）固化为 frame_head.html，不再依赖仓库外项目。
import os
os.chdir(os.path.dirname(os.path.abspath(__file__)))
head = open('frame_head.html', encoding='utf-8').read()
open('index.html', 'w', encoding='utf-8').write(head + '\n' + open('main.js', encoding='utf-8').read() + '\n</script>\n</body>\n</html>\n')
print('ok', head.count('\n'))
