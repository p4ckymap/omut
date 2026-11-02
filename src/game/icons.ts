// Vector icon set, 24×24 viewBox. Rasterised at boot into crisp textures (`i:<name>`) at the canvas zoom.
// Each icon is a filled silhouette with a thin dark outline so it reads on top of card art.
const O = 'stroke="#0b0c0d" stroke-width="1.2" stroke-linejoin="round" paint-order="stroke"';

export const ICONS: Record<string, string> = {
  sun: `<circle cx="12" cy="12" r="5" fill="#F2C14E" ${O}/>
    <g fill="#F2C14E" ${O}>${[0, 45, 90, 135, 180, 225, 270, 315].map(a => `<rect x="11" y="1.5" width="2" height="4" rx="1" transform="rotate(${a} 12 12)"/>`).join('')}</g>`,
  skull: `<path d="M12 2.5c-4.6 0-8 3.2-8 7.6 0 2.6 1.2 4.3 2.8 5.3V19c0 .8.6 1.5 1.4 1.5h7.6c.8 0 1.4-.7 1.4-1.5v-3.6c1.6-1 2.8-2.7 2.8-5.3 0-4.4-3.4-7.6-8-7.6z" fill="#E6E2D6" ${O}/>
    <circle cx="8.8" cy="11" r="2.1" fill="#16181a"/><circle cx="15.2" cy="11" r="2.1" fill="#16181a"/>
    <path d="M12 13.4l-1.2 2.2h2.4z" fill="#16181a"/><path d="M9.6 18v2.4M12 18v2.4M14.4 18v2.4" stroke="#16181a" stroke-width="1"/>`,
  eye: `<path d="M1.8 12C4.4 7.4 8 5.2 12 5.2s7.6 2.2 10.2 6.8C19.6 16.6 16 18.8 12 18.8S4.4 16.6 1.8 12z" fill="#2c4a1f" ${O}/>
    <circle cx="12" cy="12" r="4.6" fill="#9BE06A"/><ellipse cx="12" cy="12" rx="1.4" ry="3.6" fill="#0b0c0d"/><circle cx="13.6" cy="10.2" r="1" fill="#fff" opacity=".8"/>`,
  tentacle: `<path d="M6 21.5c-1.4-5.2.6-9.6 4.6-11.6 3-1.5 4.4-3.4 3.6-5.6-.6-1.6-2.6-1.8-3.4-.5 2.6-3.2 7.6-1.7 7.8 2.4.2 3.6-2.6 5.8-5.4 7.4-2.8 1.6-3.6 4.6-2.4 7.9z" fill="#6FB3E8" ${O}/>
    <circle cx="10.4" cy="15.6" r=".9" fill="#2a5a85"/><circle cx="12.4" cy="12.6" r=".9" fill="#2a5a85"/><circle cx="15.4" cy="10.4" r=".9" fill="#2a5a85"/><circle cx="17.2" cy="7.2" r=".8" fill="#2a5a85"/>`,
  flame: `<path d="M12 1.8c.6 3.4 4.8 5.4 6 9.4 1.4 4.6-1.6 9.8-6 9.8s-7.4-3.6-6.4-8c.5-2.2 2-3.4 2.4-5.2.8 1.4.8 2.6.4 3.8 2.4-1.8 3.8-5.6 3.6-9.8z" fill="#FF7A33" ${O}/>
    <path d="M12 11.4c.4 2 2.8 2.8 2.8 5.4 0 2-1.3 3.2-2.8 3.2s-2.8-1.2-2.8-3c0-1.6 1.2-2.2 1.6-3.4.6.8.8 1.4.6 2 .8-1.2.8-2.6.6-4.2z" fill="#FFD36B"/>`,
  swirl: `<path d="M12 12.2c0-1 1.6-1 1.6.2 0 1.8-2.6 2-3.6.4-1.4-2.2.6-5 3.4-4.6 3.4.5 4.6 4.4 2.6 7.2-2.6 3.6-8.4 3-10.2-1.2C4.2 9.6 7.6 4.2 13 4.6c4.6.4 7.6 4.6 6.8 9" fill="none" stroke="#0b0c0d" stroke-width="4.2" stroke-linecap="round"/>
    <path d="M12 12.2c0-1 1.6-1 1.6.2 0 1.8-2.6 2-3.6.4-1.4-2.2.6-5 3.4-4.6 3.4.5 4.6 4.4 2.6 7.2-2.6 3.6-8.4 3-10.2-1.2C4.2 9.6 7.6 4.2 13 4.6c4.6.4 7.6 4.6 6.8 9" fill="none" stroke="#8FE0CF" stroke-width="2.2" stroke-linecap="round"/>`,
  heart: `<path d="M12 20.6S2.6 14.8 2.6 8.6C2.6 5.6 4.8 3.6 7.4 3.6c2 0 3.6 1.1 4.6 2.8 1-1.7 2.6-2.8 4.6-2.8 2.6 0 4.8 2 4.8 5 0 6.2-9.4 12-9.4 12z" fill="#E2483C" ${O}/>
    <path d="M6.4 7.2c.6-1.2 1.6-1.6 2.6-1.4" stroke="#ff9a90" stroke-width="1.4" stroke-linecap="round" fill="none"/>`,
  sword: `<path d="M19.8 2.6l1.6 1.6-11 11-2.8.8.8-2.8z" fill="#DADDE0" ${O}/>
    <path d="M5.2 13.6l5.2 5.2-1.4 1.4-1.8-1.8-2.6 2.6-1.4-1.4 2.6-2.6-1.8-1.8z" fill="#C79A3C" ${O}/>`,
  coin: `<circle cx="12" cy="12" r="9" fill="#E2B33C" ${O}/><circle cx="12" cy="12" r="6.4" fill="none" stroke="#A97E1C" stroke-width="1.4"/>
    <path d="M9.4 8.6c1-.8 3.8-.8 4.8 0" stroke="#FFE39A" stroke-width="1.4" stroke-linecap="round" fill="none"/>`,
  shield: `<path d="M12 2.4l8 3v6.2c0 5-3.4 8.4-8 10-4.6-1.6-8-5-8-10V5.4z" fill="#C9CED3" ${O}/>
    <path d="M12 4.6v15.2c3.4-1.4 6-4.2 6-8.2V6.8z" fill="#9aa1a8"/><path d="M12 7.6v8M8.6 11h6.8" stroke="#E2B33C" stroke-width="2" stroke-linecap="round"/>`,
  blood: `<path d="M12 2.6c3.2 4.6 6.4 8.2 6.4 11.8a6.4 6.4 0 01-12.8 0c0-3.6 3.2-7.2 6.4-11.8z" fill="#C8302A" ${O}/>
    <path d="M9.2 14.6c0 1.4.8 2.6 2 3" stroke="#ff8a80" stroke-width="1.4" stroke-linecap="round" fill="none"/>`,
  poison: `<path d="M12 4.2c3 4.2 6 7.4 6 10.6a6 6 0 01-12 0c0-3.2 3-6.4 6-10.6z" fill="#7FC25A" ${O}/>
    <circle cx="10" cy="15" r="1.6" fill="#c8f0a8"/><circle cx="13.6" cy="17.4" r="1" fill="#c8f0a8"/><circle cx="17.6" cy="4.6" r="1.6" fill="#7FC25A" ${O}/>`,
  hourglass: `<path d="M5.6 2.6h12.8v2.2h-1.4c0 3.6-3 5.4-3 7.2s3 3.6 3 7.2h1.4v2.2H5.6v-2.2H7c0-3.6 3-5.4 3-7.2S7 8.4 7 4.8H5.6z" fill="#D9B26A" ${O}/>
    <path d="M9 6.4h6c-.4 1.8-3 3.2-3 4.6 0-1.4-2.6-2.8-3-4.6zM8.8 19.4c.4-2.4 3.2-3.6 3.2-5.4 0 1.8 2.8 3 3.2 5.4z" fill="#6b4e1c"/>`,
  bolt: `<path d="M14.4 1.8L4.6 13.6h6.2l-1.4 8.6 10-12.2h-6.2z" fill="#F2C14E" ${O}/>`,
  arrow: `<path d="M3 21l13.4-13.4" stroke="#0b0c0d" stroke-width="4" stroke-linecap="round"/><path d="M3 21l13.4-13.4" stroke="#C9A06A" stroke-width="2" stroke-linecap="round"/>
    <path d="M21.4 2.6l-1.2 8-6.8-6.8z" fill="#ECE6D6" ${O}/><path d="M3.6 16.4l4 4M2.6 18.6l2.8 2.8" stroke="#E2483C" stroke-width="1.6" stroke-linecap="round"/>`,
  ram: `<path d="M3 4.6l7.4 7.4L3 19.4h4.4l7.4-7.4-7.4-7.4zM10 4.6l7.4 7.4-7.4 7.4h4.4l7.4-7.4-7.4-7.4z" fill="#FF7A33" ${O}/>`,
  steadfast: `<path d="M12 20.6S2.6 14.8 2.6 8.6C2.6 5.6 4.8 3.6 7.4 3.6c2 0 3.6 1.1 4.6 2.8 1-1.7 2.6-2.8 4.6-2.8 2.6 0 4.8 2 4.8 5 0 6.2-9.4 12-9.4 12z" fill="#B8BDC2" ${O}/>
    <path d="M12.6 6.6l-2 4.4 3 1.4-2.2 5" stroke="#16181a" stroke-width="1.6" fill="none" stroke-linejoin="round"/>`,
  greed: `<ellipse cx="12" cy="18" rx="7.4" ry="2.8" fill="#C99A2E" ${O}/><ellipse cx="12" cy="14" rx="7.4" ry="2.8" fill="#D6A835" ${O}/>
    <ellipse cx="12" cy="10" rx="7.4" ry="2.8" fill="#E2B33C" ${O}/><path d="M19.4 2.4v5M16.9 4.9h5" stroke="#94D36C" stroke-width="2" stroke-linecap="round"/>`,
  healer: `<path d="M12 20.6S2.6 14.8 2.6 8.6C2.6 5.6 4.8 3.6 7.4 3.6c2 0 3.6 1.1 4.6 2.8 1-1.7 2.6-2.8 4.6-2.8 2.6 0 4.8 2 4.8 5 0 6.2-9.4 12-9.4 12z" fill="#94D36C" ${O}/>
    <path d="M12 8v7M8.5 11.5h7" stroke="#fff" stroke-width="2.4" stroke-linecap="round"/>`,
  devour: `<rect x="2.6" y="5" width="18.8" height="14" rx="5" fill="#A35CFF" ${O}/><rect x="5" y="8.2" width="14" height="7.6" rx="2.4" fill="#1a0b2e"/>
    <path d="M6 8.2l1.6 2.6 1.6-2.6 1.6 2.6L12.4 8.2l1.6 2.6 1.6-2.6 1.6 2.6L18.4 8.2zM6 15.8l1.6-2.6 1.6 2.6 1.6-2.6 1.6 2.6 1.6-2.6 1.6 2.6 1.6-2.6 1.6 2.6z" fill="#ECE6D6"/>`,
  surface: `<path d="M12 2.4l6 6.2h-3.8v5.2H9.8V8.6H6z" fill="#8FE0CF" ${O}/>
    <path d="M2 16.4c2.2 0 2.2-1.6 4-1.6s1.8 1.6 4 1.6 2.2-1.6 4-1.6 1.8 1.6 4 1.6 2.2-1.6 4-1.6M2 20.6c2.2 0 2.2-1.6 4-1.6s1.8 1.6 4 1.6 2.2-1.6 4-1.6 1.8 1.6 4 1.6 2.2-1.6 4-1.6" stroke="#6FB3E8" stroke-width="1.8" fill="none" stroke-linecap="round"/>`,
  deathstrike: `<g><path d="M19.8 2.6l1.6 1.6-11 11-2.8.8.8-2.8z" fill="#DADDE0" ${O}/><path d="M5.2 13.6l5.2 5.2-1.4 1.4-1.8-1.8-2.6 2.6-1.4-1.4 2.6-2.6-1.8-1.8z" fill="#E2483C" ${O}/></g>
    <g transform="translate(24 0) scale(-1 1)"><path d="M19.8 2.6l1.6 1.6-11 11-2.8.8.8-2.8z" fill="#DADDE0" ${O}/><path d="M5.2 13.6l5.2 5.2-1.4 1.4-1.8-1.8-2.6 2.6-1.4-1.4 2.6-2.6-1.8-1.8z" fill="#E2483C" ${O}/></g>`,
  gear: `<path d="M10.4 2h3.2l.5 2.6 1.9.8 2.2-1.5 2.3 2.3-1.5 2.2.8 1.9 2.6.5v3.2l-2.6.5-.8 1.9 1.5 2.2-2.3 2.3-2.2-1.5-1.9.8-.5 2.6h-3.2l-.5-2.6-1.9-.8-2.2 1.5-2.3-2.3 1.5-2.2-.8-1.9L2 13.6v-3.2l2.6-.5.8-1.9-1.5-2.2 2.3-2.3 2.2 1.5 1.9-.8z" fill="#C9CED3" ${O}/><circle cx="12" cy="12" r="3.4" fill="#1f2225"/>`,
  exit: `<path d="M4 2.6h10v18.8H4z" fill="#8a8f95" ${O}/><path d="M6 4.6h6v14.8H6z" fill="#2a2d31"/><circle cx="10.4" cy="12" r=".9" fill="#E2B33C"/>
    <path d="M14.6 12h7M18.6 8.6L22 12l-3.4 3.4" stroke="#ECE6D6" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"/>`,
  deck: `<rect x="6.6" y="2.6" width="12" height="16" rx="2" fill="#3e6f68" ${O}/><rect x="4.6" y="4.6" width="12" height="16" rx="2" fill="#5aa79b" ${O}/>
    <rect x="2.6" y="6.6" width="12" height="15" rx="2" fill="#8FE0CF" ${O}/><circle cx="8.6" cy="14" r="3" fill="none" stroke="#16403a" stroke-width="1.6"/>`,
  grave: `<path d="M5.6 21V9.4a6.4 6.4 0 0112.8 0V21z" fill="#9D988C" ${O}/><path d="M12 8.4v7M9.4 10.8h5.2" stroke="#4a4740" stroke-width="1.8" stroke-linecap="round"/>
    <path d="M3 21.4h18" stroke="#5a7a3a" stroke-width="2" stroke-linecap="round"/>`,
  hammer: `<path d="M10.6 9.8l2.8 2.8-8 8a2 2 0 01-2.8-2.8z" fill="#9a6b3c" ${O}/><path d="M9 6.2l5.4-3.6 7 7-3.6 5.4z" fill="#C9CED3" ${O}/>`,
  rune: `<path d="M12 1.6l2.4 7.6 7.6 2.8-7.6 2.8L12 22.4l-2.4-7.6L2 12l7.6-2.8z" fill="#B79CFF" ${O}/><circle cx="12" cy="12" r="2.2" fill="#fff"/>`,
  flip: `<path d="M4 9a8 8 0 0114.4-3.4M20 15a8 8 0 01-14.4 3.4" stroke="#0b0c0d" stroke-width="4" fill="none" stroke-linecap="round"/>
    <path d="M4 9a8 8 0 0114.4-3.4M20 15a8 8 0 01-14.4 3.4" stroke="#ECE6D6" stroke-width="2" fill="none" stroke-linecap="round"/>
    <path d="M19.8 2.4v4.8H15zM4.2 21.6v-4.8H9z" fill="#ECE6D6" ${O}/>`,
  move: `<path d="M12 2l3.6 4H13v5h5V8.4l4 3.6-4 3.6V13h-5v5h2.6L12 22l-3.6-4H11v-5H6v2.6L2 12l4-3.6V11h5V6H8.4z" fill="#ECE6D6" ${O}/>`,
};

export function iconSvg(name: string, px: number) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${px}" height="${px}" viewBox="0 0 24 24">${PIXEL_ICONS[name] ?? ICONS[name]}</svg>`;
}

// Screen chrome is deliberately rectilinear. Card illustrations are separate, unchanged assets.
const ice = '#93B8C6', chalk = '#F1EBDD', ink = '#11191F';
const p = (d: string, fill = ice) => `<path d="${d}" fill="${fill}"/>`;
const PIXEL_ICONS: Record<string, string> = {
  back: p('M13 3h4v3h-3v3h-3v3H8v1h3v3h3v3h3v3h-4v-3h-3v-3H7v-3H4v-3h3V7h3V4h3z'),
  grid: p('M3 3h7v7H3zM14 3h7v7h-7zM3 14h7v7H3zM14 14h7v7h-7z'),
  pause: p('M5 4h5v16H5zM14 4h5v16h-5z'),
  book: p('M2 4h8v1h4V4h8v17h-8v1h-4v-1H2z', chalk) + p('M4 6h5v1h2v12H9v-1H4zM13 7h2V6h5v12h-5v1h-2z') + p('M5 9h4v1H5zM5 12h4v1H5zM5 15h4v1H5zM15 9h4v1h-4zM15 12h4v1h-4zM15 15h4v1h-4z', ink),
  gear: p('M9 2h6v3h3v3h3v7h-3v3h-3v3H9v-3H6v-3H3V8h3V5h3z') + p('M10 8h4v2h2v4h-2v2h-4v-2H8v-4h2z', ink),
  swirl: p('M7 1h10v2h3v3h2v11h-2v3h-4v2H7v-2H3v-4H1V8h2V5h3v3H5v8h2v2h9v-2h2V8h-2V6H9v2H7v7h6v-2h-3v-3h6v5h-2v2H8v-2H6V7h2V5h9v2h3V6h-2V4H7z'),
  deck: p('M8 2h13v17h-3v3H2V6h3V4h3z') + p('M10 4h9v13h-1V6h-8zM7 6h9v13H5V8h2z', ink) + p('M8 9h6v1H8zM8 12h6v1H8zM8 15h6v1H8z'),
  grave: p('M8 3h8v2h3v14h2v3H3v-3h2V5h3z') + p('M10 6h4v3h3v3h-3v6h-4v-6H7V9h3z', ink),
  heart: p('M3 4h5v2h2v2h4V6h2V4h5v2h2v7h-2v3h-3v3h-3v3H9v-3H6v-3H3v-3H1V6h2z', '#E2483C'),
  coin: p('M7 2h10v2h3v3h2v10h-2v3h-3v2H7v-2H4v-3H2V7h2V4h3z', '#E2B33C') + p('M8 5h8v2h2v10h-2v2H8v-2H6V7h2z', '#A87928') + p('M10 7h4v10h-4z', '#FFDB80'),
};
// Boot enumerates ICONS; include the newly introduced UI keys there as well.
for (const key of Object.keys(PIXEL_ICONS)) if (!(key in ICONS)) ICONS[key] = PIXEL_ICONS[key];
