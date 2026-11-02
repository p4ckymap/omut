import sharp from 'sharp';
import { mkdir } from 'node:fs/promises';

// Deliberately separate from art.mjs: never regenerates the approved cards or tokens.
await mkdir('public/art/ui/redesign', { recursive: true });
for (const [source, destination, width] of [
  ['menu-hero-clean', 'menu-hero', 900],
  ['settings-lantern', 'settings-lantern', 360],
  ['avatar-raven', 'avatar-raven', 192],
]) {
  await sharp(`assets/ui/redesign/${source}.png`)
    .resize({ width, withoutEnlargement: true, kernel: 'nearest' })
    .webp({ quality: 90, alphaQuality: 100 })
    .toFile(`public/art/ui/redesign/${destination}.webp`);
  console.log(`UI_ASSET ${destination}.webp OK`);
}
