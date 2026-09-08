// Local CSS fixture only. No API calls or operational records.
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
createServer(async (req, res) => {
  const url = new URL(req.url, 'http://localhost');
  if (url.pathname === '/style.css') {
    res.setHeader('Content-Type', 'text/css');
    return res.end(await readFile(new URL('../app/globals.css', import.meta.url)));
  }
  const tv = url.searchParams.has('tv');
  const member = url.searchParams.has('member');
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.end(`<!doctype html><title>Preview only - board spacing</title><link rel="stylesheet" href="/style.css">
  <main class="${tv ? 'tv-shell' : ''}"><section class="operations-board ${tv ? 'tv-display' : ''}">
  <header class="board-header"><h1>Preview only — board spacing</h1></header><div class="board-summary"><article>Isolated layout test — no live data</article></div>
  <div class="board-grid redesigned">
  <section class="board-panel chief-board-panel"><header><h2>River gauge preview</h2></header><div class="chief-board-content"><article class="river-gauge-slide"><div class="river-gauge-heading"><span>Preview gauge</span><strong>No flooding</strong></div><div class="river-gauge-reading"><strong>10.83</strong><span>ft</span><div><b>Current river stage</b><small>Preview observation only</small></div></div><div class="river-stage-meter"><div class="river-stage-fill" style="width:65%"></div></div><div class="river-thresholds">${['Action','Minor','Moderate','Major'].map(x=>`<span><small>${x}</small><b>16.0 ft</b></span>`).join('')}</div><a class="river-source-link" href="#">Open gauge and hydrograph ↗</a></article></div></section>
  <section class="board-panel staffing staffing-rotation-panel"><header><h2>${member ? 'New member' : 'Upcoming crew · 1 of 3'}</h2><span>Preview only</span></header><div class="staffing-rotation-body">${member ? `<div class="new-member-spotlight"><div class="new-member-photo"><img alt="Portrait placeholder" src="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 120 160'%3E%3Crect width='120' height='160' fill='%23425d6c'/%3E%3Ccircle cx='60' cy='45' r='26' fill='%239fb0bb'/%3E%3Cpath d='M10 160V115Q60 60 110 115V160' fill='%239fb0bb'/%3E%3C/svg%3E"></div><div><span>Welcome to Stickney Fire Department</span><strong>Preview, Member</strong><p>Firefighter</p><dl><div><dt>Employee ID</dt><dd>Preview</dd></div><div><dt>Start date</dt><dd>September 7, 2026</dd></div></dl><small>Started yesterday</small></div></div>` : `<div class="schedule-24-list">${Array.from({length:6},(_,i)=>`<div><time>Noon – 6:00 PM</time><strong>Preview member ${i+1}</strong><small>Firefighter</small></div>`).join('')}</div>`}</div></section>
  <section class="board-panel rotating-panel news"><header><h2>News preview</h2></header><div class="rotation-content"><div class="rotation-slide"><div class="close-call-list">${Array.from({length:3},(_,i)=>`<a href="#"><time>Sep 8</time><div><strong>Preview incident headline ${i+1}</strong><p>${'Preview summary text. '.repeat(18)}</p><small>Read the complete report ↗</small></div></a>`).join('')}</div></div></div></section></div><footer>Preview only</footer></section></main>`);
}).listen(4179, '127.0.0.1', () => console.log('Preview at http://127.0.0.1:4179'));
