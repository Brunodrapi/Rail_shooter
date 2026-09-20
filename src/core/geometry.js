import { col, shade } from './color.js';

/** Boite pleine, ancree par le centre de sa base (x, z) et son sol y. */
export function box(x, y, z, w, h, d, hex) {
  const base = typeof hex === 'string' ? col(hex) : hex;
  const x0 = x - w / 2,
    x1 = x + w / 2,
    z0 = z - d / 2,
    z1 = z + d / 2,
    y0 = y,
    y1 = y + h;
  const top = shade(base, 1.3);
  const front = shade(base, 1.0);
  const side = shade(base, 0.74);
  return [
    { p: [[x0, y1, z0], [x1, y1, z0], [x1, y1, z1], [x0, y1, z1]], c: top },
    { p: [[x0, y0, z0], [x1, y0, z0], [x1, y1, z0], [x0, y1, z0]], c: front },
    { p: [[x1, y0, z1], [x0, y0, z1], [x0, y1, z1], [x1, y1, z1]], c: front },
    { p: [[x0, y0, z1], [x0, y0, z0], [x0, y1, z0], [x0, y1, z1]], c: side },
    { p: [[x1, y0, z0], [x1, y0, z1], [x1, y1, z1], [x1, y1, z0]], c: side },
  ];
}

/** Rectangle horizontal (sol, flaque, marquage au sol). */
export function slab(x, y, z, w, d, hex) {
  const c = typeof hex === 'string' ? col(hex) : hex;
  const x0 = x - w / 2,
    x1 = x + w / 2,
    z0 = z - d / 2,
    z1 = z + d / 2;
  return [{ p: [[x0, y, z0], [x1, y, z0], [x1, y, z1], [x0, y, z1]], c }];
}

/** Panneau vertical face a -Z / +Z (affiches, vitrines, portes). */
export function panel(x, y, z, w, h, hex) {
  const c = typeof hex === 'string' ? col(hex) : hex;
  const x0 = x - w / 2,
    x1 = x + w / 2;
  return [{ p: [[x0, y, z], [x1, y, z], [x1, y + h, z], [x0, y + h, z]], c }];
}

/** Rangee d'immeubles le long d'un axe Z, cote gauche ou droit. */
export function buildingRow(sideX, zFrom, zTo, opts = {}) {
  const {
    depth = 6,
    minH = 6,
    maxH = 16,
    step = 5,
    palette = ['#2a3247', '#232a3c', '#313a52', '#1d2434'],
    lit = '#ffcf7a',
  } = opts;
  const out = [];
  let seed = Math.abs(sideX * 977 + zFrom * 131) | 0;
  const rnd = () => {
    seed = (seed * 1103515245 + 12345) & 0x7fffffff;
    return seed / 0x7fffffff;
  };
  for (let z = zFrom; z < zTo; z += step) {
    const h = minH + rnd() * (maxH - minH);
    const w = step * (0.82 + rnd() * 0.16);
    const hex = palette[(rnd() * palette.length) | 0];
    const cx = sideX + (sideX > 0 ? depth / 2 : -depth / 2);
    out.push(...box(cx, 0, z + step / 2, depth, h, w, hex));
    // Fenetres allumees : petits panneaux lumineux sur la facade interieure
    const faceX = sideX;
    const rows = Math.max(2, (h / 2.4) | 0);
    for (let r = 0; r < rows; r++) {
      if (rnd() > 0.45) continue;
      const wy = 1.4 + r * 2.2;
      if (wy + 1 > h) break;
      const c = rnd() > 0.75 ? '#8fd0ff' : lit;
      const wz = z + step * (0.25 + rnd() * 0.45);
      out.push({
        p: [
          [faceX, wy, wz],
          [faceX, wy, wz + 0.9],
          [faceX, wy + 1.1, wz + 0.9],
          [faceX, wy + 1.1, wz],
        ],
        c: col(c),
      });
    }
  }
  return out;
}

/** Bande de route avec trottoirs et marquage central. */
export function street(zFrom, zTo, width = 9, opts = {}) {
  const { road = '#14161f', walk = '#242838', mark = '#6b6f55' } = opts;
  const len = zTo - zFrom;
  const cz = (zFrom + zTo) / 2;
  const out = [];
  out.push(...slab(0, 0, cz, width, len, road));
  out.push(...slab(-width / 2 - 1.2, 0.16, cz, 2.6, len, walk));
  out.push(...slab(width / 2 + 1.2, 0.16, cz, 2.6, len, walk));
  for (let z = zFrom + 1; z < zTo; z += 4) {
    out.push(...slab(0, 0.02, z, 0.24, 1.8, mark));
  }
  return out;
}
