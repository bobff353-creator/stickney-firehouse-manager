import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import { preplanLocationView, stickneyMapOverview } from '../app/preplan-map-location.ts';
import { detailedPreplanMapView } from '../app/preplan-fire-flow.ts';

test('missing or invalid locations use the town-wide Stickney overview', () => {
  for (const location of [undefined, null, {lat:null,lng:null}, {lat:41.8,lng:null}, {lat:null,lng:-87.77}, {lat:NaN,lng:-87.77}, {lat:41.8,lng:Infinity}, {lat:91,lng:-87.77}, {lat:41.8,lng:-181}, {lat:0,lng:0}, {lat:'41.8',lng:'-87.77'}]) {
    assert.deepEqual(preplanLocationView(location), {...stickneyMapOverview, located:false});
  }
  assert.equal(stickneyMapOverview.zoom, 14);
});

test('located addresses remain close-up; device GPS preserves its existing zoom', () => {
  const point={lat:41.82,lng:-87.775};
  assert.deepEqual(preplanLocationView(point), {center:point,zoom:20,located:true});
  assert.deepEqual(preplanLocationView(point,17), {center:point,zoom:17,located:true});
});

test('fallback results are not aliases for the overview coordinates', () => {
  const result=preplanLocationView();result.center.lat=1;
  assert.equal(preplanLocationView().center.lat,41.8189);
});

test('saved footprint fitting is unchanged', () => {
  const footprint=[{lat:41.819,lng:-87.7735},{lat:41.819,lng:-87.7733},{lat:41.81916,lng:-87.7733},{lat:41.81916,lng:-87.7735}];
  const view=detailedPreplanMapView(footprint,{lat:41.8189,lng:-87.7734});
  assert.ok(view.zoom>=20);
  assert.ok(Math.abs(view.center.lat-41.81908)<1e-7);
});

test('new and imported preplans and device failures use the shared fallback without saving', async () => {
  const source=await readFile(new URL('../app/field-preplans.tsx',import.meta.url),'utf8');
  assert.match(source,/useState\(stickneyMapOverview.zoom\)/);
  assert.match(source,/function beginNewPreplan\(\).*preplanLocationView/);
  assert.match(source,/function startImportedBuilding\(.*preplanLocationView\(\{lat:item.latitude,lng:item.longitude\}\)/);
  const locate=source.slice(source.indexOf('  function locate(){'),source.indexOf('  const locationLabel='));
  assert.match(locate,/if\(!navigator.geolocation\)\{fallback\(\);return;\}/);
  assert.match(locate,/\},fallback,/);
  const fallback=locate.slice(locate.indexOf('const fallback='),locate.indexOf('if(!navigator.geolocation)'));
  assert.doesNotMatch(fallback,/setDraft|fetch\(|save/);
  assert.match(source,/if\(cancelled\|\|currentUrl.searchParams.has\("preplan"\)\|\|currentUrl.searchParams.has\("hydrant"\)\)return;/);
});
