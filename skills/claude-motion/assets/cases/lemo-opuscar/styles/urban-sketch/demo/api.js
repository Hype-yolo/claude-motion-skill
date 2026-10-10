// DEMO.md（Engine reference）的最小示例：?api=1
import { sketchShape, sparkle, penStroke, drawPen, hex } from './engine.js';
const ctx = document.getElementById('c').getContext('2d');
window.DUR = 1;
window.render = () => {
  ctx.fillStyle = '#f5eede'; ctx.fillRect(0, 0, 1920, 1080);
  const star = sparkle(960, 540, 120, .24);
  sketchShape(ctx, star, hex('#D97757'), { ink: 3, wash: .7, offset: 3, seed: 7 });
  drawPen(ctx, penStroke([[1040, 610], [1180, 640], [1300, 646]], { w: 3, wob: 1.2, over: 6, seed: 8 }), 1);
};
window.READY = true;
