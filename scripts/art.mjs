// npm run art — prepares every runtime image from assets/ into public/art/.
// Cards are only cropped and downscaled (never upscaled or recoloured).
import sharp from 'sharp';
import { mkdir, readFile, writeFile, access } from 'node:fs/promises';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '..');
const src = (...p) => path.join(root, 'assets', ...p);
const out = (...p) => path.join(root, 'public', 'art', ...p);
const exists = p => access(p).then(() => true, () => false);
const cards = JSON.parse(await readFile(path.join(root, 'src/data/cards.json'), 'utf8'));
for (const d of ['cards', 'tokens', 'worlds', 'ui', 'icons']) await mkdir(out(d), { recursive: true });

// Token frame: the art window under the name block, 76:80. Per-card overrides in [x%, y%] of the top-left.
const TOKEN_FOCUS = { svyat: [8, 18], yaga: [8, 18], kraken: [8, 20], smey: [8, 20], ognz: [8, 18], frog: [8, 22], zhaba: [8, 24] };

// Rounded alpha corners baked into the image, so the art never pokes out of a rounded frame.
const rounded = (w, h, r) => Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}"><rect width="${w}" height="${h}" rx="${r}" ry="${r}" fill="#fff"/></svg>`);
const clip = (img, w, h, r) => img.composite([{ input: rounded(w, h, r), blend: 'dest-in' }]);

let count = 0;
for (const c of cards) {
  const front = await sharp(src('cards', 'front', `${c.id}.png`)).trim({ threshold: 1 }).toBuffer({ resolveWithObject: true });
  const back = await sharp(src('cards', 'back', `${c.id}.png`)).trim({ threshold: 1 }).toBuffer();
  const { width: W, height: H } = front.info;
  await sharp(front.data).resize({ width: 720 }).webp({ quality: 88, alphaQuality: 90 }).toFile(out('cards', `${c.id}.webp`));
  await sharp(back).resize({ width: 720 }).webp({ quality: 88, alphaQuality: 90 }).toFile(out('cards', `${c.id}-back.webp`));
  await sharp(front.data).resize({ width: 336 }).webp({ quality: 90 }).toFile(out('cards', `${c.id}-s.webp`));
  if (c.kind === 'creature') {
    const [fx, fy] = TOKEN_FOCUS[c.id] ?? [8, 18];
    const w = Math.round(W * 0.84), h = Math.round(w * 80 / 76);
    const left = Math.round(W * fx / 100), top = Math.min(Math.round(H * fy / 100), H - h);
    const tok = await sharp(front.data).extract({ left, top, width: w, height: h }).resize(228, 240).png().toBuffer();
    await clip(sharp(tok), 228, 240, 18).webp({ quality: 90, alphaQuality: 90 }).toFile(out('tokens', `${c.id}.webp`));
  }
  count++;
}

// Worlds: the dedicated art when present (assets/worlds/<id>.png). Until then the world is painted from the
// background of a card that lives there: the art window, softened so the figure turns into atmosphere.
const WORLD_FROM_CARD = { chasha: 'kiki', puchina: 'smey', peklo: 'fire', omut: 'poglot', yav: 'istoch', nav: 'mertv' }; // yav/nav only if their art goes missing
for (const id of ['yav', 'nav', 'chasha', 'puchina', 'peklo', 'omut']) {
  let base;
  if (await exists(src('worlds', `${id}.png`))) base = sharp(src('worlds', `${id}.png`)).resize(264, 570, { fit: 'cover', position: 'attention' });
  else {
    const f = await sharp(src('cards', 'front', `${WORLD_FROM_CARD[id]}.png`)).trim({ threshold: 1 }).toBuffer({ resolveWithObject: true });
    const { width: W, height: H } = f.info, top = Math.round(H * 0.17), h = Math.round(H * 0.67), w = Math.round(h * 0.62);
    base = sharp(await sharp(f.data).extract({ left: Math.round((W - w) / 2), top, width: w, height: h }).resize(264, 570).blur(14)
      .modulate({ brightness: id === 'peklo' ? 0.34 : 0.58, saturation: id === 'peklo' ? 0.75 : 1.05 }).png().toBuffer());
  }
  const wb = await base.png().toBuffer();
  await clip(sharp(wb), 264, 570, 24).webp({ quality: 86, alphaQuality: 90 }).toFile(out('worlds', `${id}.webp`));
}

// Lake: sky and horizon from the approved menu concept (above the logo and the corner buttons).
const concept = src('ui', 'menu-concept.png');
await sharp(concept).extract({ left: 0, top: 105, width: 941, height: 410 }).resize({ width: 1170 }).webp({ quality: 88 }).toFile(out('ui', 'lake.webp'));
// Water strip, mirrored so it tiles seamlessly while drifting.
const strip = await sharp(concept).extract({ left: 0, top: 445, width: 941, height: 70 }).resize(1170, 87).png().toBuffer();
const flipped = await sharp(strip).flop().toBuffer();
await sharp({ create: { width: 2340, height: 87, channels: 3, background: '#000' } })
  .composite([{ input: strip, left: 0, top: 0 }, { input: flipped, left: 1170, top: 0 }]).webp({ quality: 86 }).toFile(out('ui', 'water.webp'));
// Menu: the moonlit Nav landscape, full screen 9:16.
await sharp(src('worlds', 'nav.png')).resize(1170, 2532, { fit: 'cover', position: 'top' }).webp({ quality: 86 }).toFile(out('ui', 'menu-bg.webp'));
for (const f of ['avatar-bot', 'avatar-me']) {
  const a = await sharp(src('ui', `${f}.png`)).extract({ left: 4, top: 4, width: 78, height: 76 }).resize(132, 132, { fit: 'cover' }).png().toBuffer();
  await clip(sharp(a), 132, 132, 22).webp({ quality: 92, alphaQuality: 90 }).toFile(out('ui', `${f}.webp`));
}
await sharp(src('ui', 'card-back.png')).webp({ quality: 92 }).toFile(out('ui', 'card-back.webp'));

// Icons: integer nearest-neighbour scales only, one sheet per canvas zoom.
for (const z of [1, 2, 3, 4]) {
  await sharp(path.join(root, 'docs/icons/icons-16.png')).resize(128 * z, 64 * z, { kernel: 'nearest' }).png().toFile(out('icons', `icons@${z}x.png`));
}
await writeFile(out('icons', 'icons.json'), await readFile(path.join(root, 'docs/icons/icons.json')));
console.log(`art: ${count} cards, 6 worlds, ui, icons -> public/art`);
