// Draws the yacht as one SVG string. Each square is 100 × 100 units.

import { objectName } from './rules.js';

const S = 100;
const MARGIN = { left: 42, top: 40, right: 8, bottom: 22 };

const INK = '#2f2636';
const WALL = '#2a2230';
const FURN = '#8f7c9b';
const FURN_DARK = '#5e4f69';
const LIGHT = '#fcfaf7';

export function viewBox(puzzle) {
  const w = puzzle.cols * S + MARGIN.left + MARGIN.right;
  const h = puzzle.rows * S + MARGIN.top + MARGIN.bottom;
  return `${-MARGIN.left} ${-MARGIN.top} ${w} ${h}`;
}

const esc = (s) => String(s).replace(/[&<>"]/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[ch]);
const key = (r, c) => `${r},${c}`;

/**
 * view: {
 *   placed:   { id: {r, c} }
 *   notes:    { "r,c": "AB" }
 *   crosses:  { "r,c": true }
 *   selected: person id or null
 *   shade:    shade rows/columns already taken
 *   failing:  Set of person ids to ring in red
 *   focus:    Set of person ids to ring in blue
 * }
 */
export function boardSvg(puzzle, grid, view) {
  const people = puzzle.people;
  const out = [];

  out.push(`<defs>
    <filter id="tok-shadow" x="-40%" y="-40%" width="180%" height="180%">
      <feDropShadow dx="0" dy="3" stdDeviation="3" flood-color="#1a1020" flood-opacity=".32"/>
    </filter>
  </defs>`);

  // Axis numbers
  out.push('<g class="axis" font-size="28" font-weight="700" text-anchor="middle" fill="#8b8091">');
  for (let c = 1; c <= puzzle.cols; c++) out.push(`<text x="${(c - 0.5) * S}" y="-11">${c}</text>`);
  for (let r = 1; r <= puzzle.rows; r++) out.push(`<text x="-22" y="${(r - 0.5) * S + 10}">${r}</text>`);
  out.push('</g>');

  // Compass in the open water at the top right
  out.push(`<g class="compass" transform="translate(${puzzle.cols * S - 62} 62)" fill="#8b8091">
    <circle r="34" fill="none" stroke="#c9c1cc" stroke-width="3"/>
    <path d="M0 -26 L10 4 L0 -2 L-10 4 Z" fill="#8b8091"/>
    <text y="27" font-size="22" font-weight="700" text-anchor="middle">N</text>
  </g>`);

  // Floors
  out.push('<g class="floors">');
  for (const cell of grid.cells) {
    if (!cell.inside) continue;
    const color = puzzle.rooms[cell.room].color;
    out.push(`<rect x="${(cell.c - 1) * S}" y="${(cell.r - 1) * S}" width="${S}" height="${S}" fill="${color}"/>`);
  }
  out.push('</g>');

  // Thin lines between squares of the same room
  const thin = [];
  for (const cell of grid.cells) {
    if (!cell.inside) continue;
    const x = (cell.c - 1) * S;
    const y = (cell.r - 1) * S;
    const right = grid.get(cell.r, cell.c + 1);
    const below = grid.get(cell.r + 1, cell.c);
    if (right && right.inside && right.room === cell.room) thin.push(`M${x + S} ${y}V${y + S}`);
    if (below && below.inside && below.room === cell.room) thin.push(`M${x} ${y + S}H${x + S}`);
  }
  out.push(`<path d="${thin.join('')}" stroke="#3a2f44" stroke-opacity=".22" stroke-width="2" fill="none"/>`);

  // Furniture
  out.push('<g class="furniture">');
  for (const o of puzzle.objects) out.push(drawObject(o));
  out.push('</g>');

  // Walls: between rooms, and around the hull
  const inner = [];
  const outer = [];
  for (const cell of grid.cells) {
    if (!cell.inside) continue;
    const x = (cell.c - 1) * S;
    const y = (cell.r - 1) * S;
    const sides = [
      [grid.get(cell.r - 1, cell.c), `M${x} ${y}H${x + S}`, false],
      [grid.get(cell.r, cell.c + 1), `M${x + S} ${y}V${y + S}`, true],
      [grid.get(cell.r + 1, cell.c), `M${x} ${y + S}H${x + S}`, true],
      [grid.get(cell.r, cell.c - 1), `M${x} ${y}V${y + S}`, false],
    ];
    for (const [n, d, own] of sides) {
      if (!n || !n.inside) outer.push(d);
      else if (n.room !== cell.room && own) inner.push(d);
    }
  }
  out.push(`<path d="${inner.join('')}" stroke="${WALL}" stroke-width="7" stroke-linecap="round" fill="none"/>`);
  out.push(`<path d="${outer.join('')}" stroke="${WALL}" stroke-width="10" stroke-linecap="round" fill="none"/>`);

  // Room name tags
  out.push('<g class="room-labels" font-size="20" font-weight="800" letter-spacing="0.5">');
  for (const room of Object.values(puzzle.rooms)) {
    const text = room.name.toUpperCase();
    const textLength = text.length * 12.4;
    const w = textLength + 24;
    const h = 32;
    const cx = room.label[0] * S;
    const cy = room.label[1] * S;
    out.push(`<g>
      <rect x="${cx - w / 2}" y="${cy - h / 2}" width="${w}" height="${h}" rx="${h / 2}" fill="#fffdf9" stroke="${WALL}" stroke-width="3"/>
      <text x="${cx}" y="${cy + 7}" text-anchor="middle" fill="${WALL}" textLength="${textLength}" lengthAdjust="spacingAndGlyphs">${esc(text)}</text>
    </g>`);
  }
  out.push('</g>');

  const occupied = new Map();
  for (const p of people) {
    const pos = view.placed[p.id];
    if (pos) occupied.set(key(pos.r, pos.c), p);
  }

  // Shade rows and columns that already hold someone
  if (view.shade) {
    const shaded = new Set();
    for (const p of people) {
      const pos = view.placed[p.id];
      if (!pos) continue;
      for (const cell of grid.cells) {
        if (!cell.inside || (cell.r === pos.r && cell.c === pos.c)) continue;
        if (cell.r === pos.r || cell.c === pos.c) shaded.add(key(cell.r, cell.c));
      }
    }
    out.push('<g class="shade" fill="#2a1840" fill-opacity=".16">');
    for (const k of shaded) {
      if (occupied.has(k)) continue;
      const [r, c] = k.split(',').map(Number);
      out.push(`<rect x="${(c - 1) * S}" y="${(r - 1) * S}" width="${S}" height="${S}"/>`);
    }
    out.push('</g>');
  }

  // Crosses
  out.push(`<g class="crosses" stroke="#b3263e" stroke-width="7" stroke-linecap="round" stroke-opacity=".85">`);
  for (const k of Object.keys(view.crosses)) {
    if (occupied.has(k)) continue;
    const [r, c] = k.split(',').map(Number);
    const x = (c - 1) * S;
    const y = (r - 1) * S;
    out.push(`<path d="M${x + 24} ${y + 24}L${x + 76} ${y + 76}M${x + 76} ${y + 24}L${x + 24} ${y + 76}"/>`);
  }
  out.push('</g>');

  // Pencil notes: one fixed slot per person in a 3 × 3 layout
  out.push('<g class="notes" font-size="28" font-weight="800" text-anchor="middle" stroke="#fffdf9" stroke-width="6" paint-order="stroke" stroke-linejoin="round">');
  for (const [k, letters] of Object.entries(view.notes)) {
    if (occupied.has(k) || !letters) continue;
    const [r, c] = k.split(',').map(Number);
    const x = (c - 1) * S;
    const y = (r - 1) * S;
    people.forEach((p, i) => {
      if (!letters.includes(p.id)) return;
      const nx = x + 21 + (i % 3) * 29;
      const ny = y + 31 + Math.floor(i / 3) * 28;
      out.push(`<text x="${nx}" y="${ny}" fill="${p.color}">${p.id}</text>`);
    });
  }
  out.push('</g>');

  // People
  out.push('<g class="tokens">');
  for (const p of people) {
    const pos = view.placed[p.id];
    if (!pos) continue;
    const cx = (pos.c - 0.5) * S;
    const cy = (pos.r - 0.5) * S;
    if (view.failing.has(p.id)) {
      out.push(`<circle cx="${cx}" cy="${cy}" r="45" fill="#fff" fill-opacity=".55" stroke="#d1202f" stroke-width="7" stroke-dasharray="13 7"/>`);
    }
    if (view.focus.has(p.id)) {
      out.push(`<circle class="focus-ring" cx="${cx}" cy="${cy}" r="46" fill="none" stroke="#1d6fe0" stroke-width="7"/>`);
    }
    if (view.selected === p.id) {
      out.push(`<circle cx="${cx}" cy="${cy}" r="41" fill="none" stroke="${INK}" stroke-width="3.5" stroke-dasharray="7 5"/>`);
    }
    out.push(`<g filter="url(#tok-shadow)">
      <circle cx="${cx}" cy="${cy}" r="33" fill="${p.color}" stroke="#fff" stroke-width="4"/>
      <text x="${cx}" y="${cy + 13}" font-size="38" font-weight="800" text-anchor="middle" fill="#fff">${p.id}</text>
    </g>`);
  }
  out.push('</g>');

  // Click targets
  out.push('<g class="hits">');
  for (const cell of grid.cells) {
    if (!cell.inside) continue;
    const label = `Row ${cell.r}, column ${cell.c}, ${puzzle.rooms[cell.room].name}${cell.object ? `, ${objectName(cell.object)}` : ''}`;
    out.push(`<rect class="hit" data-r="${cell.r}" data-c="${cell.c}" x="${(cell.c - 1) * S}" y="${(cell.r - 1) * S}" width="${S}" height="${S}"><title>${esc(label)}</title></rect>`);
  }
  out.push('</g>');

  return out.join('');
}

// ---- Furniture drawings -----------------------------------------------------

function drawObject(o) {
  const x = (o.c - 1) * S;
  const y = (o.r - 1) * S;
  const w = (o.w || 1) * S;
  const h = (o.h || 1) * S;
  switch (o.type) {
    case 'chair':
      return chair(x, y);
    case 'plant':
      return plant(x, y);
    case 'shelf':
      return shelf(x, y);
    case 'table':
      return table(x, y, w, h, o.deco);
    case 'tv':
      return tv(x, y);
    case 'bed':
      return bed(x, y, w, h);
    case 'carpet':
      return carpet(x, y, w, h);
    case 'crate':
      return crate(x, y);
    case 'sink':
      return sink(x, y);
    default:
      return '';
  }
}

function chair(x, y) {
  const st = `fill="${LIGHT}" stroke="${FURN}" stroke-width="3"`;
  return `<g>
    <rect x="${x + 22}" y="${y + 14}" width="56" height="26" rx="11" ${st}/>
    <rect x="${x + 28}" y="${y + 34}" width="44" height="46" rx="8" ${st}/>
    <rect x="${x + 15}" y="${y + 30}" width="17" height="52" rx="8" ${st}/>
    <rect x="${x + 68}" y="${y + 30}" width="17" height="52" rx="8" ${st}/>
  </g>`;
}

function plant(x, y) {
  const leaves = [-62, -32, 0, 32, 62]
    .map(
      (a) =>
        `<ellipse cx="${x + 50}" cy="${y + 36}" rx="8" ry="25" transform="rotate(${a} ${x + 50} ${y + 60})" fill="#6f9c58" stroke="#3f6a33" stroke-width="2.5"/>`,
    )
    .join('');
  return `<g>
    ${leaves}
    <path d="M${x + 31} ${y + 60}H${x + 69}L${x + 63} ${y + 88}H${x + 37}Z" fill="#c78d88" stroke="${INK}" stroke-width="2.5" stroke-linejoin="round"/>
  </g>`;
}

function shelf(x, y) {
  const books = [];
  const rows = [y + 18, y + 43, y + 68];
  rows.forEach((by, i) => {
    const count = 3 + (i % 2);
    for (let k = 0; k < count; k++) {
      books.push(`<rect x="${x + 22 + k * 15}" y="${by}" width="9" height="17" rx="1.5" fill="#efe8f3"/>`);
    }
  });
  return `<g>
    <rect x="${x + 13}" y="${y + 10}" width="74" height="80" rx="5" fill="${FURN_DARK}" stroke="${INK}" stroke-width="3"/>
    <path d="M${x + 13} ${y + 38}H${x + 87}M${x + 13} ${y + 63}H${x + 87}" stroke="${INK}" stroke-width="3"/>
    ${books.join('')}
  </g>`;
}

function table(x, y, w, h, deco) {
  let extra = '';
  const cx = x + w / 2;
  const cy = y + h / 2 - 4;
  if (deco === 'mug') {
    extra = `<rect x="${cx - 11}" y="${cy - 10}" width="20" height="22" rx="4" fill="${LIGHT}" stroke="${INK}" stroke-width="2"/>
      <path d="M${cx + 9} ${cy - 4}a6 6 0 0 1 0 12" fill="none" stroke="${INK}" stroke-width="2.5"/>`;
  } else if (deco === 'wrench') {
    extra = `<path d="M${cx - 22} ${cy + 8}L${cx + 12} ${cy - 6}" stroke="#6b6472" stroke-width="7" stroke-linecap="round"/>
      <circle cx="${cx + 16}" cy="${cy - 8}" r="7" fill="none" stroke="#6b6472" stroke-width="5"/>`;
  } else if (deco === 'plate') {
    extra = `<ellipse cx="${cx}" cy="${y + 34}" rx="24" ry="16" fill="#e7e2ea" stroke="${INK}" stroke-width="2"/>`;
  } else if (deco === 'glass') {
    extra = `<rect x="${cx - 9}" y="${y + h / 2 - 12}" width="18" height="24" rx="5" fill="#dcd8e2" stroke="${INK}" stroke-width="2"/>`;
  }
  return `<g>
    <rect x="${x + 10}" y="${y + 10}" width="${w - 20}" height="${h - 20}" rx="7" fill="${FURN}" stroke="${INK}" stroke-width="3"/>
    <rect x="${x + 10}" y="${y + h - 26}" width="${w - 20}" height="16" rx="5" fill="${FURN_DARK}" stroke="${INK}" stroke-width="3"/>
    ${extra}
  </g>`;
}

function tv(x, y) {
  return `<g>
    <rect x="${x + 14}" y="${y + 56}" width="72" height="30" rx="5" fill="${FURN_DARK}" stroke="${INK}" stroke-width="3"/>
    <rect x="${x + 18}" y="${y + 14}" width="64" height="46" rx="6" fill="#4a3f55" stroke="${INK}" stroke-width="3"/>
    <rect x="${x + 25}" y="${y + 20}" width="50" height="33" rx="3" fill="#f2eef6"/>
    <text x="${x + 50}" y="${y + 45}" font-size="24" text-anchor="middle" fill="${INK}">♪</text>
  </g>`;
}

function bed(x, y, w, h) {
  const horizontal = w > h;
  const frame = `<rect x="${x + 8}" y="${y + 8}" width="${w - 16}" height="${h - 16}" rx="10" fill="${LIGHT}" stroke="${FURN}" stroke-width="3"/>`;
  if (horizontal) {
    return `<g>${frame}
      <rect x="${x + 16}" y="${y + 18}" width="46" height="${h - 36}" rx="9" fill="#fff" stroke="${FURN}" stroke-width="3"/>
      <rect x="${x + 74}" y="${y + 8}" width="${w - 82}" height="${h - 16}" rx="10" fill="#b8a5c8" stroke="${FURN}" stroke-width="3"/>
    </g>`;
  }
  return `<g>${frame}
    <rect x="${x + 18}" y="${y + 16}" width="${w - 36}" height="40" rx="9" fill="#fff" stroke="${FURN}" stroke-width="3"/>
    <rect x="${x + 8}" y="${y + 70}" width="${w - 16}" height="${h - 78}" rx="10" fill="#b8a5c8" stroke="${FURN}" stroke-width="3"/>
  </g>`;
}

function carpet(x, y, w, h) {
  return `<g>
    <rect x="${x + 12}" y="${y + 12}" width="${w - 24}" height="${h - 24}" rx="4" fill="#ede7f1" stroke="#8e7f99" stroke-width="4"/>
    <rect x="${x + 21}" y="${y + 21}" width="${w - 42}" height="${h - 42}" rx="2" fill="none" stroke="#b6a9bf" stroke-width="2.5"/>
  </g>`;
}

function crate(x, y) {
  return `<g>
    <rect x="${x + 11}" y="${y + 11}" width="78" height="78" rx="4" fill="${FURN_DARK}" stroke="${INK}" stroke-width="3"/>
    <rect x="${x + 19}" y="${y + 19}" width="62" height="62" fill="#a495ad" stroke="${INK}" stroke-width="2.5"/>
    <path d="M${x + 19} ${y + 19}L${x + 81} ${y + 81}M${x + 19} ${y + 50}H${x + 81}" stroke="${INK}" stroke-width="4"/>
  </g>`;
}

function sink(x, y) {
  return `<g>
    <rect x="${x + 12}" y="${y + 10}" width="76" height="76" rx="6" fill="${FURN}" stroke="${INK}" stroke-width="3"/>
    <rect x="${x + 12}" y="${y + 72}" width="76" height="14" rx="4" fill="${FURN_DARK}" stroke="${INK}" stroke-width="3"/>
    <ellipse cx="${x + 50}" cy="${y + 44}" rx="25" ry="18" fill="#6f6a78" stroke="${INK}" stroke-width="2.5"/>
    <circle cx="${x + 50}" cy="${y + 20}" r="4" fill="${INK}"/>
  </g>`;
}
