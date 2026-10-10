const q = new URLSearchParams(location.search);
const mod = await import(q.get('test') ? './test.js' : './film.js');
const draw = await mod.setup(document.getElementById('c'));
window.render = t => draw(t);
render(0); window.READY = true;
