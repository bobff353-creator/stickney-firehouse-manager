// Isolated layout fixture: no API calls and no department records are written.
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
const css = new URL('../app/globals.css', import.meta.url);
createServer(async (req, res) => {
  const url = new URL(req.url, 'http://127.0.0.1');
  if (url.pathname === '/globals.css') {
    res.setHeader('Content-Type', 'text/css'); res.end(await readFile(css)); return;
  }
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  if (url.pathname !== '/frame') {
    const width = Number(url.searchParams.get('width')) === 1920 ? 1920 : 1280;
    const height = width === 1920 ? 1080 : 720;
    res.end(`<!doctype html><title>TV layout preview only</title><h2>Preview only — ${width} × ${height}</h2><iframe title="TV layout" src="/frame?roads=${url.searchParams.get('roads') || '0'}" style="width:${width}px;height:${height}px;border:0;transform:scale(.6);transform-origin:top left"></iframe>`); return;
  }
  res.end(`<!doctype html><html><head><title>Isolated TV layout</title><link rel="stylesheet" href="/globals.css"></head><body><main class="tv-shell"><section class="operations-board tv-display">
  <button class="board-exit-tv">Exit full screen</button><div class="board-display-controls">Updated · Pause rotation · Call sound · TV full screen</div>
  <header class="board-header"><div class="board-header-rotation"><p>Stickney Fire Department</p><div class="board-weather-slide"><span class="weather-day">Tomorrow’s Berwyn weather</span><h1>Showers And Thunderstorms</h1><div><strong>83°</strong><span>High</span><b>67°</b><span>Low</span><small>80% rain · Wind 10 mph</small></div><a href="#">Full Berwyn forecast on Weather.com ↗</a></div></div><div class="board-clock"><strong>10:39:47 AM</strong><span>Tuesday, September 8</span><small>Preview only — not live weather</small></div></header>
  ${url.searchParams.get('roads') === '1' ? '<section class="board-road-closures"><header>Preview road-closure notice</header><article>Layout fixture only</article></section>' : ''}
  <div class="board-summary"><article><strong>Preview only</strong></article></div><div class="board-grid redesigned"><section class="board-panel"><h2>Content region</h2></section></div><footer>Preview footer</footer></section></main>
  <script>addEventListener('load',()=>{const h=document.querySelector('.board-header').getBoundingClientRect();const nodes=[...document.querySelectorAll('.board-weather-slide *')];const fits=nodes.every(n=>{const r=n.getBoundingClientRect();return r.top>=h.top&&r.bottom<=h.bottom&&r.left>=h.left&&r.right<=h.right;});const result=document.createElement('p');result.textContent='Header bounds: '+(fits?'PASS':'FAIL')+' · Controls hidden: '+(getComputedStyle(document.querySelector('.board-display-controls')).display==='none'?'PASS':'FAIL');document.querySelector('footer').append(result);});</script></body></html>`);
}).listen(4178, '127.0.0.1', () => console.log('Isolated TV layout preview http://127.0.0.1:4178'));
