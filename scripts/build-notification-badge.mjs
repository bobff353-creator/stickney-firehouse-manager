import sharp from 'sharp';
import { fileURLToPath } from 'node:url';

// Compile the source vector to a universally supported notification PNG.
// No background/flatten: Android needs an alpha mask, not the color app icon.
const source = new URL('../public/icons/notification-badge-v1.svg', import.meta.url);
const target = new URL('../public/icons/notification-badge-v1.png', import.meta.url);
await sharp(fileURLToPath(source)).resize(96, 96).ensureAlpha().png().toFile(fileURLToPath(target));
console.log('Built transparent 96 x 96 fire-service notification badge.');
