// Isolated CSS preview: synthetic members, no API calls or saved records.
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
createServer(async (req, res) => {
  const url = new URL(req.url, 'http://localhost');
  if (url.pathname === '/globals.css' || url.pathname === '/mobile-usability.css') {
    res.setHeader('Content-Type', 'text/css');
    return res.end(await readFile(new URL(`../app${url.pathname}`, import.meta.url)));
  }
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  const cards = Array.from({length: 30}, (_, i) => `<label><input type="checkbox"><span><strong>Preview member ${i + 1}</strong><small>Deputy Chief · 2.00 hr suggested</small><small class="callback-employee-flag">Flag: No automatic callback condition matched; reviewer approval is required.</small></span></label>`).join('');
  res.end(`<!doctype html><meta name="viewport" content="width=device-width,initial-scale=1"><title>Callback layout preview only</title><link rel="stylesheet" href="/globals.css"><link rel="stylesheet" href="/mobile-usability.css"><main style="padding:16px"><h1>Preview only — no department records</h1><div class="logbook-page"><div class="call-entry"><div class="call-callback"><div class="callback-panel"><strong>Select members on this call</strong><label class="callback-search">Find a member<input placeholder="Search by name..."></label><p>Selections stay selected while searching.</p><div class="callback-employee-list">${cards}</div><div class="callback-submit-bar">Preview only — submission disabled</div></div></div></div></div></main>`);
}).listen(4180, '127.0.0.1');
