// Draws Archi3D icon candidates as SVG (isometric, the app's colours) and renders them to PNG.
//   node scripts/icons.mjs [outDir]          → <outDir>/icon-<n>.svg/.png and sheet.png
//   node scripts/icons.mjs --extension       → vscode/icon.png + vscode/icon.svg (EXTENSION_ICON)
import { copyFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { chromium } from '@playwright/test';

const C = {
  navy: '#1f3a56', navyDark: '#132638', ink: '#1f2933', teal: '#14a3a3', red: '#d64545', orange: '#e8871e',
  plate: ['#b9c7d2', '#9fb3c4', '#7f97ad'], block: ['#f4f6f7', '#d5dde4', '#aab8c4'],
};

/** Isometric projection: x to the lower right, y to the lower left, z up. */
const iso = (u, cx, cy) => (x, y, z) => [cx + (x - y) * u * 0.866, cy + (x + y) * u * 0.5 - z * u];
const pts = (P, list) => list.map(([x, y, z]) => P(x, y, z).map((v) => v.toFixed(1)).join(',')).join(' ');

/** A box with its three visible faces (top, front-left, front-right). colors = [top, right, left]. */
function box(P, x, y, z, w, d, h, colors, stroke = 'rgba(0,0,0,0.18)') {
  const [top, right, left] = colors;
  return [
    `<polygon points="${pts(P, [[x, y + d, z], [x + w, y + d, z], [x + w, y + d, z + h], [x, y + d, z + h]])}" fill="${left}" stroke="${stroke}" stroke-width="1"/>`,
    `<polygon points="${pts(P, [[x + w, y, z], [x + w, y + d, z], [x + w, y + d, z + h], [x + w, y, z + h]])}" fill="${right}" stroke="${stroke}" stroke-width="1"/>`,
    `<polygon points="${pts(P, [[x, y, z + h], [x + w, y, z + h], [x + w, y + d, z + h], [x, y + d, z + h]])}" fill="${top}" stroke="${stroke}" stroke-width="1"/>`,
  ].join('');
}

const dot = (P, x, y, z, r, fill) => { const [sx, sy] = P(x, y, z); return `<circle cx="${sx.toFixed(1)}" cy="${sy.toFixed(1)}" r="${r}" fill="${fill}" stroke="#fff" stroke-width="2"/>`; };

/** Quadratic arc between two 3D points, apex raised by `lift`. */
function arc(P, a, b, lift, color, width = 7, dash = '') {
  const [ax, ay] = P(...a), [bx, by] = P(...b);
  const mid = P((a[0] + b[0]) / 2, (a[1] + b[1]) / 2, Math.max(a[2], b[2]) + lift);
  const cx = 2 * mid[0] - (ax + bx) / 2, cy = 2 * mid[1] - (ay + by) / 2;
  return `<path d="M${ax.toFixed(1)},${ay.toFixed(1)} Q${cx.toFixed(1)},${cy.toFixed(1)} ${bx.toFixed(1)},${by.toFixed(1)}" fill="none" stroke="${color}" stroke-width="${width}" stroke-linecap="round" ${dash ? `stroke-dasharray="${dash}"` : ''}/>`;
}

const tile = (bg, body, rounded = true) =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256" width="256" height="256">` +
  (bg ? `<rect width="256" height="256" rx="${rounded ? 48 : 0}" fill="${bg}"/>` : '') + `<g class="art">${body}</g></svg>`;

/** In the browser: scale and centre the drawing so it fills the tile with an even margin. */
const FIT = `(() => {
  const svg = document.querySelector('svg');
  const g = svg.querySelector('g.art');
  const b = g.getBBox();
  const k = Math.min(184 / b.width, 184 / b.height);
  g.setAttribute('transform', 'translate(' + (128 - (b.x + b.width / 2) * k).toFixed(2) + ',' + (128 - (b.y + b.height / 2) * k).toFixed(2) + ') scale(' + k.toFixed(4) + ')');
  return svg.outerHTML;
})()`;

const plateColors = (i) => [C.plate[i], '#8aa0b4', '#6f879d'];
const blockColors = ['#f7f9fa', '#c9d3dc', '#a3b2bf'];

/** Icon 2 refined: a plate, a white and an orange block, a thick arc between their ports. */
function bridge2({ bg = '#eef1f5', arcColor = C.navy, blockH = 2.0, levels = false, plate = ['#c3d1dd', '#8fa5b9', '#6f879d'] }) {
  const P = iso(15, 128, 92);
  const edge = 'rgba(19,38,56,0.35)';
  const top = 0.8 + blockH;
  return tile(bg, [
    levels ? box(P, -0.9, -0.9, -2.2, 9.8, 9.8, 0.6, ['#a9bccd', '#8aa0b4', '#748ba0'], edge) : '',
    box(P, 0, 0, 0, 8, 8, 0.8, plate, edge),
    box(P, 0.6, 5.0, 0.8, 2.4, 2.4, blockH, ['#ffffff', '#d5dde4', '#b3c0cc'], edge),
    box(P, 5.0, 0.6, 0.8, 2.4, 2.4, blockH, [C.orange, '#c9701a', '#a85d16'], edge),
    arc(P, [1.8, 6.2, top], [6.2, 1.8, top], 3.4, arcColor, 9),
    dot(P, 1.8, 6.2, top, 8.5, C.red), dot(P, 6.2, 1.8, top, 8.5, C.teal),
  ].join(''));
}

export const icons = {
  // 1. Stacked levels: three plates, two blocks on top, an orange link.
  stack: () => {
    const P = iso(13.5, 128, 70);
    return tile(C.navy, [
      box(P, 0, 0, 0, 9, 9, 0.6, plateColors(2)),
      box(P, 1, 1, 2.2, 7, 7, 0.6, plateColors(1)),
      box(P, 2, 2, 4.4, 5, 5, 0.6, plateColors(0)),
      box(P, 2.3, 4.6, 5.0, 1.6, 1.6, 1.4, blockColors),
      box(P, 4.9, 2.2, 5.0, 1.6, 1.6, 1.4, blockColors),
      arc(P, [3.1, 5.4, 6.4], [5.7, 3.0, 6.4], 2.6, C.orange, 6),
      dot(P, 3.1, 5.4, 6.4, 5.5, C.red), dot(P, 5.7, 3.0, 6.4, 5.5, C.teal),
    ].join(''));
  },
  // 2. Blocks and an arc on one plate, light tile.
  bridge: () => {
    const P = iso(15, 128, 92);
    return tile('#eef1f5', [
      box(P, 0, 0, 0, 8, 8, 0.7, plateColors(0)),
      box(P, 0.6, 5.2, 0.7, 2.2, 2.2, 1.8, blockColors),
      box(P, 5.2, 0.6, 0.7, 2.2, 2.2, 1.8, [C.orange, '#c9701a', '#a85d16']),
      arc(P, [1.7, 6.3, 2.5], [6.3, 1.7, 2.5], 3.2, C.navy, 6.5),
      dot(P, 1.7, 6.3, 2.5, 6, C.red), dot(P, 6.3, 1.7, 2.5, 6, C.teal),
    ].join(''));
  },
  // 3. Stepped cube: nested containers as stairs, monochrome blue.
  steps: () => {
    const P = iso(16, 128, 60);
    const blues = (k) => [['#dfe8f1', '#b6c8da', '#8fa8c0'], ['#c3d4e5', '#9ab4cd', '#7894b0'], ['#a6bfd8', '#7f9fbf', '#5f7f9f']][k];
    return tile(C.navyDark, [
      box(P, 0, 0, 0, 7, 7, 2, blues(2)),
      box(P, 0, 0, 2, 5, 5, 2, blues(1)),
      box(P, 0, 0, 4, 3, 3, 2, blues(0)),
      dot(P, 3, 1.5, 5, 6, C.red), dot(P, 5, 2.5, 3, 6, C.teal),
    ].join(''));
  },
  // 4. Line icon: a cube outline with linked nodes, for a flat look.
  graph: () => {
    const P = iso(17, 128, 52);
    const e = (a, b) => `<line x1="${P(...a)[0].toFixed(1)}" y1="${P(...a)[1].toFixed(1)}" x2="${P(...b)[0].toFixed(1)}" y2="${P(...b)[1].toFixed(1)}" stroke="#9fb3c8" stroke-width="5" stroke-linecap="round"/>`;
    const s = 6;
    return tile(C.ink, [
      e([0, 0, s], [s, 0, s]), e([s, 0, s], [s, s, s]), e([s, s, s], [0, s, s]), e([0, s, s], [0, 0, s]),
      e([s, 0, s], [s, 0, 0]), e([s, s, s], [s, s, 0]), e([0, s, s], [0, s, 0]), e([s, 0, 0], [s, s, 0]), e([s, s, 0], [0, s, 0]),
      `<g stroke="${C.orange}" stroke-width="6" stroke-linecap="round" fill="none">` +
      `<polyline points="${pts(P, [[1.5, 1.5, s], [4.5, 1.5, s], [4.5, 4.5, s]])}"/>` +
      `<polyline points="${pts(P, [[s, 2, 4.5], [s, 4.5, 4.5], [s, 4.5, 1.5]])}"/></g>`,
      dot(P, 1.5, 1.5, s, 9, C.teal), dot(P, 4.5, 4.5, s, 9, C.red),
      dot(P, s, 2, 4.5, 8, C.teal), dot(P, s, 4.5, 1.5, 8, C.red),
    ].join(''));
  },
  // 5. Exploded layers: three floating plates joined by a vertical link (an "AOSP stack").
  layers: () => {
    const P = iso(14, 128, 66);
    return tile('#f7f9fb', [
      box(P, 0, 0, 0, 8, 8, 0.6, ['#9fb3c4', '#7f97ad', '#6a8399']),
      box(P, 0, 0, 3.3, 8, 8, 0.6, ['#c3d1dd', '#9fb3c4', '#8aa0b4']),
      `<line x1="${P(4, 4, 0.6)[0]}" y1="${P(4, 4, 0.6)[1]}" x2="${P(4, 4, 6.6)[0]}" y2="${P(4, 4, 6.6)[1]}" stroke="${C.orange}" stroke-width="7" stroke-linecap="round"/>`,
      box(P, 0, 0, 6.6, 8, 8, 0.6, [C.navy, '#18304a', '#10233a']),
      dot(P, 4, 4, 7.2, 8, C.orange),
    ].join(''));
  },
  // 6. A closed container (lid) linked to a component — semantic zoom in one picture.
  lid: () => {
    const P = iso(14, 128, 80);
    return tile(C.navy, [
      box(P, 0, 0, 0, 5.5, 5.5, 3.2, ['#c3d1dd', '#8fa5b9', '#6f879d']),
      box(P, 7.0, 0.4, 0, 2.2, 2.2, 1.6, blockColors),
      arc(P, [2.75, 2.75, 3.2], [8.1, 1.5, 1.6], 3.0, C.orange, 7),
      dot(P, 2.75, 2.75, 3.2, 6, C.red), dot(P, 8.1, 1.5, 1.6, 6, C.teal),
    ].join(''));
  },

  // Combinations of 1 (stack), 2 (bridge) and 5 (layers).
  // 7. Floating levels on navy; two components on top joined by an arc.
  'float-arc': () => {
    const P = iso(13, 128, 70);
    return tile(C.navy, [
      box(P, 0, 0, 0, 8, 8, 0.6, ['#7f97ad', '#667f96', '#556d83']),
      box(P, 0, 0, 2.8, 8, 8, 0.6, ['#a9bccd', '#8aa0b4', '#748ba0']),
      box(P, 0, 0, 5.6, 8, 8, 0.6, ['#d3dee8', '#aebfce', '#97aabc']),
      box(P, 0.9, 5.0, 6.2, 2.1, 2.1, 1.7, blockColors),
      box(P, 5.0, 0.9, 6.2, 2.1, 2.1, 1.7, [C.orange, '#c9701a', '#a85d16']),
      arc(P, [1.95, 6.05, 7.9], [6.05, 1.95, 7.9], 2.8, '#ffffff', 6),
      dot(P, 1.95, 6.05, 7.9, 5.5, C.red), dot(P, 6.05, 1.95, 7.9, 5.5, C.teal),
    ].join(''));
  },
  // 8. Same, on the light tile of 2.
  'float-arc-light': () => {
    const P = iso(13, 128, 70);
    return tile('#eef1f5', [
      box(P, 0, 0, 0, 8, 8, 0.6, ['#9fb3c4', '#7f97ad', '#6a8399']),
      box(P, 0, 0, 2.8, 8, 8, 0.6, ['#c3d1dd', '#9fb3c4', '#8aa0b4']),
      box(P, 0, 0, 5.6, 8, 8, 0.6, [C.navy, '#18304a', '#10233a']),
      box(P, 0.9, 5.0, 6.2, 2.1, 2.1, 1.7, blockColors),
      box(P, 5.0, 0.9, 6.2, 2.1, 2.1, 1.7, [C.orange, '#c9701a', '#a85d16']),
      arc(P, [1.95, 6.05, 7.9], [6.05, 1.95, 7.9], 2.8, C.navy, 6),
      dot(P, 1.95, 6.05, 7.9, 5.5, C.red), dot(P, 6.05, 1.95, 7.9, 5.5, C.teal),
    ].join(''));
  },
  // 9. A link that crosses levels: from a component on the top level down to one below.
  'cross-level': () => {
    const P = iso(13, 128, 66);
    const pipe = (a, b) => `<line x1="${P(...a)[0].toFixed(1)}" y1="${P(...a)[1].toFixed(1)}" x2="${P(...b)[0].toFixed(1)}" y2="${P(...b)[1].toFixed(1)}" stroke="${C.orange}" stroke-width="6" stroke-linecap="round"/>`;
    return tile(C.navy, [
      box(P, 0, 0, 0, 8, 8, 0.6, ['#a9bccd', '#8aa0b4', '#748ba0']),
      box(P, 5.0, 0.9, 0.6, 2.1, 2.1, 1.7, [C.orange, '#c9701a', '#a85d16']),
      pipe([6.05, 1.95, 2.3], [6.05, 1.95, 4.2]),
      box(P, 0, 0, 4.2, 8, 8, 0.6, ['#d3dee8', '#aebfce', '#97aabc']),
      box(P, 0.9, 5.0, 4.8, 2.1, 2.1, 1.7, blockColors),
      arc(P, [1.95, 6.05, 6.5], [6.05, 1.95, 4.8], 2.6, '#ffffff', 6),
      dot(P, 1.95, 6.05, 6.5, 5.5, C.red), dot(P, 6.05, 1.95, 4.8, 5.5, C.teal),
    ].join(''));
  },
  // 10. Shrinking floating levels (stack + layers) with the arc on top.
  'pyramid-arc': () => {
    const P = iso(13.5, 128, 70);
    return tile(C.navy, [
      box(P, 0, 0, 0, 9, 9, 0.6, ['#7f97ad', '#667f96', '#556d83']),
      box(P, 1, 1, 2.6, 7, 7, 0.6, ['#a9bccd', '#8aa0b4', '#748ba0']),
      box(P, 2, 2, 5.2, 5, 5, 0.6, ['#d3dee8', '#aebfce', '#97aabc']),
      box(P, 2.4, 5.2, 5.8, 1.5, 1.5, 1.4, blockColors),
      box(P, 5.2, 2.4, 5.8, 1.5, 1.5, 1.4, [C.orange, '#c9701a', '#a85d16']),
      arc(P, [3.15, 5.95, 7.2], [5.95, 3.15, 7.2], 2.4, '#ffffff', 5.5),
      dot(P, 3.15, 5.95, 7.2, 5, C.red), dot(P, 5.95, 3.15, 7.2, 5, C.teal),
    ].join(''));
  },

  // Refinements of 2 (bridge): stronger at small sizes.
  'bridge-bold': () => bridge2({}),
  'bridge-tall': () => bridge2({ blockH: 2.7 }),
  'bridge-dark': () => bridge2({ bg: C.navy, arcColor: '#ffffff', plate: ['#d3dee8', '#aebfce', '#97aabc'] }),
  'bridge-levels': () => bridge2({ levels: true }),
};

export async function renderIcons(outDir) {
  mkdirSync(outDir, { recursive: true });
  const browser = await chromium.launch({ channel: process.env.PW_CHANNEL || undefined });
  const page = await browser.newPage({ viewport: { width: 256, height: 256 }, deviceScaleFactor: 1 });
  const names = process.env.ICONS ? process.env.ICONS.split(',') : Object.keys(icons);
  const fitted = {};
  for (const name of names) {
    const base = join(outDir, `icon-${Object.keys(icons).indexOf(name) + 1}-${name}`);
    await page.setContent(`<html><body style="margin:0;background:transparent">${icons[name]()}</body></html>`);
    fitted[name] = await page.evaluate(FIT);
    writeFileSync(`${base}.svg`, fitted[name]);
    await page.screenshot({ path: `${base}.png`, omitBackground: true, clip: { x: 0, y: 0, width: 256, height: 256 } });
  }
  // Contact sheet: each icon large, and small on light and dark (as in the Extensions list).
  const cells = names.map((n) => {
    const svg = fitted[n];
    return `<figure><div class="big">${svg}</div><div class="small"><span class="light">${svg}</span><span class="dark">${svg}</span></div><figcaption>${Object.keys(icons).indexOf(n) + 1} · ${n}</figcaption></figure>`;
  }).join('');
  await page.setViewportSize({ width: 1000, height: Math.ceil(names.length / 3) * 340 + 40 });
  await page.setContent(`<html><head><style>
    body{margin:0;padding:20px;font:600 16px system-ui;background:#fff;display:grid;grid-template-columns:repeat(3,1fr);gap:16px}
    figure{margin:0;text-align:center} .big svg{width:200px;height:200px}
    .small{display:flex;justify-content:center;gap:10px;margin-top:8px}
    .small span{padding:8px;border-radius:6px} .small svg{width:42px;height:42px}
    .light{background:#f3f3f3} .dark{background:#1e1e1e} figcaption{margin-top:6px;color:#333}
  </style></head><body>${cells}</body></html>`);
  await page.screenshot({ path: join(outDir, 'sheet.png') });
  await browser.close();
}

/** The extension's icon. */
export const EXTENSION_ICON = 'bridge';

if (process.argv[1] && import.meta.url.endsWith(process.argv[1].split('/').pop())) {
  if (process.argv.includes('--extension')) {
    // vscode/icon.png (+ icon.svg, the source) from the chosen design.
    const tmp = resolve('test-results', 'icon-build');
    process.env.ICONS = EXTENSION_ICON;
    await renderIcons(tmp);
    const n = Object.keys(icons).indexOf(EXTENSION_ICON) + 1;
    for (const ext of ['png', 'svg']) copyFileSync(join(tmp, `icon-${n}-${EXTENSION_ICON}.${ext}`), resolve('vscode', `icon.${ext}`));
    console.log(`vscode/icon.png and vscode/icon.svg from "${EXTENSION_ICON}"`);
  } else {
    await renderIcons(resolve(process.argv[2] ?? 'artifacts/icons'));
    console.log('icons written');
  }
}
