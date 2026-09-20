import { box, slab, panel } from '../core/geometry.js';
import { col } from '../core/color.js';

// Gabarit d'un gros porteur : deux allees, trois blocs de sieges.
export const CABIN = {
  halfWidth: 3.95,
  ceiling: 2.3,
  seatPitch: 0.86,
  aisleLeft: -1.4,
  aisleRight: 1.4,
  blocks: [
    { x0: -3.78, x1: -1.9 },
    { x0: -0.95, x1: 0.95 },
    { x0: 1.9, x1: 3.78 },
  ],
};

const PAL = {
  floor: '#2b2733',
  carpet: '#3b3243',
  wall: '#4b5160',
  panelLow: '#3c414e',
  ceiling: '#3a3f4b',
  bin: '#565c6b',
  seat: '#2d3550',
  seatTop: '#39425f',
  headrest: '#a9b1c1',
  window: '#0b1226',
  strip: '#ffd6a0',
  exit: '#1f8a4c',
};

/** Tronçon de fuselage : sol, parois, plafond, coffres, hublots. */
export function cabinShell(zFrom, zTo, opts = {}) {
  const { seg = 1.72, lightEvery = 3, exitAt = null } = opts;
  const hw = CABIN.halfWidth;
  const ch = CABIN.ceiling;
  const out = [];
  const cz = (zFrom + zTo) / 2;
  const len = zTo - zFrom;

  out.push(...slab(0, 0, cz, hw * 2, len, PAL.floor));
  out.push(...slab(CABIN.aisleLeft, 0.012, cz, 0.92, len, PAL.carpet));
  out.push(...slab(CABIN.aisleRight, 0.012, cz, 0.92, len, PAL.carpet));

  let i = 0;
  for (let z = zFrom; z < zTo; z += seg, i++) {
    const z1 = Math.min(z + seg, zTo);
    const zc = (z + z1) / 2;
    const d = z1 - z;

    for (const s of [-1, 1]) {
      const x = s * hw;
      // Paroi verticale
      out.push({
        p: [[x, 0, z], [x, 0, z1], [x, 1.62, z1], [x, 1.62, z]],
        c: col(PAL.wall),
      });
      // Retour incline vers le plafond
      out.push({
        p: [[x, 1.62, z], [x, 1.62, z1], [s * 3.2, ch, z1], [s * 3.2, ch, z]],
        c: col(PAL.panelLow),
      });
      // Coffres a bagages
      out.push(...box(s * 3.35, 1.66, zc, 1.05, 0.46, d * 0.94, PAL.bin));
      // Hublot
      out.push({
        p: [
          [x - s * 0.02, 1.12, zc - 0.26],
          [x - s * 0.02, 1.12, zc + 0.26],
          [x - s * 0.02, 1.52, zc + 0.26],
          [x - s * 0.02, 1.52, zc - 0.26],
        ],
        c: col(PAL.window),
      });
    }

    out.push({
      p: [[-3.2, ch, z], [3.2, ch, z], [3.2, ch, z1], [-3.2, ch, z1]],
      c: col(PAL.ceiling),
    });
    // Coffre central et bandeau lumineux
    out.push(...box(0, 1.92, zc, 2.1, 0.34, d * 0.94, PAL.bin));
    if (i % lightEvery === 0) {
      for (const s of [-1, 1]) {
        out.push({
          p: [
            [s * 2.2, ch - 0.01, zc - 0.5],
            [s * 2.9, ch - 0.01, zc - 0.5],
            [s * 2.9, ch - 0.01, zc + 0.5],
            [s * 2.2, ch - 0.01, zc + 0.5],
          ],
          c: col(PAL.strip),
        });
      }
    }
  }

  if (exitAt !== null) {
    for (const s of [-1, 1]) {
      out.push(...panel(s * (hw - 0.03), 0.9, exitAt, 0.9, 0.34, PAL.exit));
    }
  }
  return out;
}

/** Une rangee de sieges (assise + dossier + appuie-tete) pour chaque bloc. */
export function seatRow(z, blocks = CABIN.blocks) {
  const out = [];
  for (const b of blocks) {
    const w = b.x1 - b.x0;
    const cx = (b.x0 + b.x1) / 2;
    // Assise reduite a sa face superieure : elle n'est jamais vue de dos.
    out.push(...slab(cx, 0.46, z + 0.1, w, 0.5, PAL.seat));
    out.push(...box(cx, 0.46, z - 0.24, w, 0.68, 0.16, PAL.seatTop));
    const seats = Math.max(1, Math.round(w / 0.63));
    for (let i = 0; i < seats; i++) {
      const sx = b.x0 + (w / seats) * (i + 0.5);
      out.push(...panel(sx, 1.0, z - 0.33, 0.34, 0.15, PAL.headrest));
    }
  }
  return out;
}

export function seatRows(zFrom, zTo, blocks) {
  const out = [];
  for (let z = zFrom; z <= zTo; z += CABIN.seatPitch) out.push(...seatRow(z, blocks));
  return out;
}

/** Chariot de service : la cachette naturelle dans une allee. */
export function cart(x, z) {
  return [
    ...box(x, 0, z, 0.56, 1.06, 0.48, '#7d8593'),
    ...box(x, 1.06, z, 0.58, 0.05, 0.5, '#8d95a5'),
  ];
}

export const CABIN_PALETTE = PAL;
