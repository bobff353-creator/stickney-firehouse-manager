// Local presentation fixture using real board components. No API or live records.
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { projectFleet, renderApparatusRow, renderEquipmentSummary } from '../tests/helpers/board-apparatus-render.mjs';

const fleet = ['1201', '1203', '1204', '1205', '1207', '1208', '1209', '1210', '1211'].map(unitNumber => ({ unitNumber, name: 'Fixture only', status: unitNumber === '1204' ? 'out_of_service' : 'in_service' }));
createServer(async (req, res) => {
  const url = new URL(req.url, 'http://localhost');
  if (url.pathname === '/style.css') {
    res.setHeader('Content-Type', 'text/css');
    return res.end(await readFile(new URL('../app/globals.css', import.meta.url)));
  }
  const apparatus = projectFleet(fleet, url.searchParams.has('clear') ? [] : [{ respondingUnits: '1203' }]);
  const summary = renderEquipmentSummary({ apparatus: url.searchParams.has('missing') ? undefined : apparatus, confirmedAt: '2026-09-18T17:00:00Z', delayed: url.searchParams.has('delayed') });
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.end(`<!doctype html><meta name="viewport" content="width=device-width, initial-scale=1"><title>Local fixture — TV equipment</title><link rel="stylesheet" href="/style.css"><main class="tv-shell"><section class="operations-board tv-display"><header class="board-header"><h1>LOCAL TEST ONLY — no live records</h1></header><div class="board-summary"><article><strong>Fixture data only</strong></article></div><div class="board-grid redesigned"><section class="board-panel chief-board-panel"><header><h2>Left panel placeholder</h2></header></section><section class="board-panel staffing staffing-rotation-panel"><header><h2>Staffing placeholder</h2></header></section><section class="board-panel equipment rotating-panel"><header><h2>Equipment issues</h2></header><div class="rotation-content"><div class="rotation-slide">${summary}</div></div></section></div>${renderApparatusRow({ apparatus, feedDegraded: url.searchParams.has('delayed') })}</section></main>`);
}).listen(6183, '127.0.0.1', () => console.log('Local fixture: http://127.0.0.1:6183'));
