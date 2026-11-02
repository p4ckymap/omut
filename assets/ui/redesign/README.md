# UI artwork — approved slate / ice-blue pixel direction

These illustrations belong to the interface, not the card set. Original fronts,
backs, tokens, card data and gameplay remain separate and unchanged.

- `menu-hero-clean.png`: transparent raven, lantern and lakeside vignette. The
  foreground is empty stone; MenuScene draws the three existing, interactive card
  images over it. `menu-hero.png` is the earlier source before removing decorative
  painted cards.
- `settings-lantern.png`: transparent lantern / water vignette.
- `avatar-raven.png`: player avatar.

Built-in image generation was used. Direction: restrained dark slate pixel art,
ice-blue edge light, warm amber lantern, no lettering or UI baked into artwork.
The final menu edit prompt removed only the three decorative cards and restored
empty stone, preserving the raven, lantern, water, reeds and transparency.

Runtime WebP copies are in `public/art/ui/redesign`. Repack only this UI artwork:

```sh
node scripts/pack-redesign-ui.mjs
```

Typography: locally bundled Tiny5 (OFL-1.1) for pixel headings and larger labels;
Golos Text for explanatory text. License metadata ships with `@fontsource/tiny5`.
