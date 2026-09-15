import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const root = new URL('../', import.meta.url);
const badge = new URL('public/icons/notification-badge-v1.png', root);

test('small notification badge has a white silhouette and transparent background, not an opaque square', async () => {
  const metadata = await sharp(fileURLToPath(badge)).metadata();
  assert.equal(metadata.format, 'png');
  assert.equal(metadata.width, 96);
  assert.equal(metadata.height, 96);
  assert.equal(metadata.hasAlpha, true);
  for (const size of [96, 24]) {
    const { data, info } = await sharp(fileURLToPath(badge)).resize(size, size).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
    assert.equal(info.channels, 4);
    let visible = 0;
    for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
      const i = (y * size + x) * 4, alpha = data[i + 3];
      if (x === 0 || y === 0 || x === size - 1 || y === size - 1) assert.equal(alpha, 0, 'outer edge stays transparent');
      if (alpha > 0) {
        // Measure the mask at half opacity, not faint resampling edge pixels.
        if (alpha >= 128) visible++;
        // Downsampling premultiplied alpha can round white edge pixels to 254.
        assert.equal(data[i], data[i + 1]);
        assert.equal(data[i], data[i + 2]);
        assert.ok(data[i] >= 250, 'visible silhouette stays monochrome white');
      }
    }
    assert.ok(visible > size * size * 0.3 && visible < size * size * 0.7, 'recognizable silhouette with substantial negative space');
    const centerAlpha = data[((size / 2) * size + size / 2) * 4 + 3];
    assert.ok(centerAlpha <= (size === 96 ? 0 : 8), 'center cutout stays clear, allowing faint downsampling ringing');
  }
});

test('committed PNG matches the source vector', async () => {
  const rendered = await sharp(fileURLToPath(new URL('public/icons/notification-badge-v1.svg', root))).resize(96, 96).ensureAlpha().raw().toBuffer();
  assert.deepEqual(await sharp(fileURLToPath(badge)).ensureAlpha().raw().toBuffer(), rendered);
});

test('new server payloads use the badge even before an older service worker updates', async () => {
  const cad = await readFile(new URL('app/cad-push.ts', root), 'utf8');
  assert.match(cad, /badge: "\/icons\/notification-badge-v1\.png"/);
  assert.match(cad, /icon: "\/icons\/pwa-192\.png"/);
  const worker = await readFile(new URL('public/sw.js', root), 'utf8');
  assert.match(worker, /stickney-firehouse-shell-v3/);
  assert.match(worker, /SAFE_STATIC_ASSETS = \[[\s\S]*?NOTIFICATION_BADGE/);
  const config = await readFile(new URL('next.config.ts', root), 'utf8');
  assert.match(config, /source: "\/sw\.js"[\s\S]*?must-revalidate/);
});
