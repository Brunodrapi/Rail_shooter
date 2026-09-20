import { box, slab, panel } from '../core/geometry.js';
import { cabinShell, seatRows, cart, CABIN } from './cabin.js';

const AL = CABIN.aisleLeft; // allee babord
const AR = CABIN.aisleRight; // allee tribord
const EYE = 1.62;

/*
 * Reperes de conception, a respecter si tu ajoutes des beats :
 *  - le premier arret d'une section reprend la position de fin de la
 *    precedente + 3.2 m, pour que la transition ne saute pas ;
 *  - les ennemis se placent entre 4 et 9 m devant l'arret : plus pres ils
 *    sont illisibles, plus loin le reticule devient minuscule ;
 *  - les tireurs prennent les allees (x = ±1.4), les otages les sieges
 *    (x = ±2.85 ou 0), ou ils n'emergent que du buste.
 */

const cartCover = (x, z, camDX = 0) => ({
  x,
  z,
  w: 0.58,
  h: 1.08,
  d: 0.5,
  mesh: cart(x, z),
  camDX,
});

const counterCover = (x, z, w = 1.6) => ({
  x,
  z,
  w,
  h: 1.12,
  d: 0.55,
  mesh: [
    ...box(x, 0, z, w, 1.06, 0.55, '#525967'),
    ...box(x, 1.06, z, w + 0.05, 0.06, 0.6, '#79808f'),
  ],
  camDX: 0,
});

function galleyBlock(z, opts = {}) {
  const { withDoors = true } = opts;
  const out = [];
  out.push(...box(-3.2, 0, z, 1.5, 2.0, 0.7, '#5b616f'));
  out.push(...box(3.2, 0, z, 1.5, 2.0, 0.7, '#5b616f'));
  out.push(...panel(-3.2, 0.55, z - 0.37, 1.3, 1.0, '#8d95a5'));
  out.push(...panel(3.2, 0.55, z - 0.37, 1.3, 1.0, '#8d95a5'));
  if (withDoors) {
    out.push(...panel(-3.93, 0.6, z + 1.1, 0.95, 1.55, '#39404e'));
    out.push(...panel(3.93, 0.6, z + 1.1, 0.95, 1.55, '#39404e'));
  }
  return out;
}

function exitSigns(zs) {
  const out = [];
  for (const z of zs) {
    out.push(...panel(-3.9, 1.9, z, 0.7, 0.26, '#1f8a4c'));
    out.push(...panel(3.9, 1.9, z, 0.7, 0.26, '#1f8a4c'));
  }
  return out;
}

const e = (kind, x, z, delay, extra = {}) => ({ kind, x, z, delay, ...extra });
// Un ennemi debout dans une allee se redresse d'un accroupi, pas du plancher.
const aisle = (kind, x, z, delay, extra = {}) =>
  e(kind, x, z, delay, { rise: -0.6, ...extra });

export const CAMPAIGN = {
  start: 'queue',
  sections: {
    /* ================================================================ */
    queue: {
      title: 'QUEUE DE L’APPAREIL',
      subtitle: 'Vol AF-218 · 214 passagers à bord',
      build() {
        return [
          ...cabinShell(-12, 22, { exitAt: -1.2 }),
          ...seatRows(-3, 21),
          ...galleyBlock(-9.6),
          ...box(-2.4, 0, -8.8, 0.6, 1.1, 0.5, '#9aa3b2'),
          ...box(2.4, 0, -8.8, 0.6, 1.1, 0.5, '#9aa3b2'),
          ...exitSigns([-1.2, 9]),
        ];
      },
      beats: [
        {
          cam: { x: 0, y: EYE, z: -8.2, yaw: 0 },
          travel: 2.2,
          cover: cartCover(0, -7.1),
          limit: 26,
          enemies: [
            e('otage', -2.85, -2.6, 0.2),
            aisle('pirate', 1.4, -3.8, 0.9),
            aisle('pirate', -1.4, -2.4, 2.2),
          ],
        },
        {
          cam: { x: 0, y: EYE, z: -5.6, yaw: 0 },
          travel: 2.0,
          cover: cartCover(0, -4.6),
          limit: 26,
          enemies: [
            e('otage', 0, -0.9, 0.3),
            aisle('pirate', -1.4, -1.2, 0.8),
            aisle('pirate', 1.4, 0.2, 1.8),
            e('tireur', 2.85, 1.4, 3.0),
          ],
        },
        {
          cam: { x: 0, y: EYE, z: -2.6, yaw: 0 },
          travel: 1.8,
          cover: cartCover(0, -1.6),
          limit: 30,
          enemies: [
            e('otage', -2.85, 1.6, 0.2),
            e('otage', 2.85, 2.4, 0.7),
            aisle('lourd', 1.4, 2.0, 1.0),
            aisle('pirate', -1.4, 3.2, 2.4),
            e('tireur', 2.85, 4.4, 3.6),
          ],
        },
      ],
      exits: [
        { to: 'allee_bab', label: 'ALLÉE BÂBORD', marker: { x: AL, y: 1.8, z: 2.6 } },
        { to: 'allee_tri', label: 'ALLÉE TRIBORD', marker: { x: AR, y: 1.8, z: 2.6 } },
      ],
    },

    /* ================================================================ */
    allee_bab: {
      title: 'ALLÉE BÂBORD',
      subtitle: 'Rangées 38 à 24',
      build() {
        return [
          ...cabinShell(-6, 28),
          ...seatRows(-5, 27),
          ...exitSigns([4, 14]),
          ...cart(AR, 6.2),
        ];
      },
      beats: [
        {
          cam: { x: AL, y: EYE, z: 0.6, yaw: 0 },
          travel: 2.4,
          cover: cartCover(AL, 1.7),
          limit: 26,
          enemies: [
            e('otage', -2.85, 4.6, 0.2),
            aisle('pirate', AL, 5.4, 0.9),
            e('tireur', 0, 6.8, 2.2),
          ],
        },
        {
          cam: { x: AL, y: EYE, z: 4.0, yaw: 0 },
          travel: 2.2,
          cover: cartCover(AL, 5.1),
          limit: 28,
          enemies: [
            e('otage', 0, 8.2, 0.3),
            aisle('pirate', AL, 8.6, 0.8),
            aisle('pirate', AR, 9.4, 1.8),
            e('lourd', -2.85, 10.6, 3.0),
          ],
        },
        {
          cam: { x: AL, y: EYE, z: 7.4, yaw: 0 },
          travel: 2.0,
          cover: cartCover(AL, 8.5),
          limit: 32,
          enemies: [
            e('otage', 0, 11.6, 0.2),
            aisle('bouclier', AL, 12.2, 0.6, { lean: 1 }),
            aisle('pirate', AR, 13.4, 2.4),
            e('tireur', -2.85, 15.0, 3.6),
          ],
        },
      ],
      exits: [{ to: 'office', label: 'OFFICE CENTRAL' }],
    },

    /* ================================================================ */
    allee_tri: {
      title: 'ALLÉE TRIBORD',
      subtitle: 'Rangées 37 à 23',
      build() {
        return [
          ...cabinShell(-6, 28),
          ...seatRows(-5, 27),
          ...exitSigns([4, 14]),
          ...cart(AL, 5.8),
        ];
      },
      beats: [
        {
          cam: { x: AR, y: EYE, z: 0.6, yaw: 0 },
          travel: 2.4,
          cover: cartCover(AR, 1.7),
          limit: 26,
          enemies: [
            e('otage', 2.85, 4.4, 0.2),
            aisle('pirate', AR, 5.6, 0.8),
            aisle('tireur', AL, 7.0, 2.0),
          ],
        },
        {
          cam: { x: AR, y: EYE, z: 4.0, yaw: 0 },
          travel: 2.2,
          cover: cartCover(AR, 5.1),
          limit: 28,
          enemies: [
            e('otage', 0, 8.0, 0.2),
            e('otage', 2.85, 9.0, 0.9),
            aisle('pirate', AR, 8.8, 1.2),
            aisle('pirate', AL, 10.0, 2.6),
          ],
        },
        {
          cam: { x: AR, y: EYE, z: 7.4, yaw: 0 },
          travel: 2.0,
          cover: cartCover(AR, 8.5),
          limit: 32,
          enemies: [
            e('otage', -2.85, 11.4, 0.2),
            aisle('bouclier', AR, 12.0, 0.5, { lean: -1 }),
            aisle('lourd', AL, 13.2, 1.8),
            e('tireur', 2.85, 15.2, 3.4),
          ],
        },
      ],
      exits: [{ to: 'office', label: 'OFFICE CENTRAL' }],
    },

    /* ================================================================ */
    office: {
      title: 'OFFICE CENTRAL',
      subtitle: 'Bloc sanitaire et escalier du pont supérieur',
      build() {
        return [
          ...cabinShell(4, 38),
          ...seatRows(5, 15),
          ...galleyBlock(17.6),
          ...box(-2.0, 0, 17.5, 1.1, 2.1, 1.0, '#4e5462'),
          ...box(2.0, 0, 17.5, 1.1, 2.1, 1.0, '#4e5462'),
          // Escalier vers le pont superieur, cote babord
          ...box(-2.9, 0.0, 19.6, 1.8, 0.24, 0.5, '#6a7080'),
          ...box(-2.9, 0.24, 20.1, 1.8, 0.24, 0.5, '#6a7080'),
          ...box(-2.9, 0.48, 20.6, 1.8, 0.24, 0.5, '#6a7080'),
          ...box(-2.9, 0.72, 21.1, 1.8, 0.24, 0.5, '#6a7080'),
          ...seatRows(22.5, 37),
          ...exitSigns([17.6]),
        ];
      },
      beats: [
        {
          cam: { x: 0, y: EYE, z: 10.6, yaw: 0 },
          travel: 2.6,
          cover: cartCover(0, 11.7),
          limit: 28,
          enemies: [
            e('otage', -2.85, 14.4, 0.2),
            aisle('pirate', AR, 14.8, 0.8),
            aisle('pirate', AL, 16.0, 2.0),
            e('tireur', 0, 17.2, 3.2),
          ],
        },
        {
          cam: { x: 0, y: EYE, z: 13.8, yaw: 0 },
          travel: 2.2,
          cover: counterCover(0, 14.9, 1.6),
          limit: 34,
          enemies: [
            e('otage', 0, 18.0, 0.2),
            aisle('lourd', AL, 18.4, 0.6),
            aisle('lourd', AR, 19.0, 1.8),
            aisle('bouclier', AL, 20.6, 3.4, { lean: 1 }),
          ],
        },
      ],
      exits: [
        { to: 'pont_sup', label: 'PONT SUPÉRIEUR', marker: { x: -2.9, y: 1.95, z: 20.4 } },
        { to: 'premiere', label: 'PREMIÈRE CLASSE', marker: { x: 1.9, y: 1.8, z: 21.0 } },
      ],
    },

    /* ================================================================ */
    pont_sup: {
      title: 'PONT SUPÉRIEUR',
      subtitle: 'Cabine haute, accès direct au poste',
      build() {
        const blocks = [
          { x0: -2.6, x1: -1.3 },
          { x0: 1.3, x1: 2.6 },
        ];
        return [
          ...cabinShell(13, 42, { seg: 1.6 }),
          ...seatRows(15, 38, blocks),
          ...slab(0, 0.014, 27, 1.5, 26, '#4a3a4e'),
          ...exitSigns([20, 32]),
        ];
      },
      beats: [
        {
          cam: { x: 0, y: EYE, z: 17.0, yaw: 0 },
          travel: 2.4,
          cover: cartCover(0, 18.1),
          limit: 26,
          enemies: [
            e('otage', -1.95, 21.0, 0.2),
            aisle('tireur', 0.8, 21.8, 0.8),
            aisle('pirate', -0.8, 23.0, 2.2),
          ],
        },
        {
          cam: { x: 0, y: EYE, z: 20.4, yaw: 0 },
          travel: 2.2,
          cover: cartCover(0, 21.5),
          limit: 32,
          enemies: [
            e('otage', 1.95, 24.2, 0.2),
            aisle('lourd', 0.8, 24.8, 0.6),
            aisle('bouclier', -0.8, 25.6, 2.0, { lean: 1 }),
            e('tireur', -1.95, 27.4, 3.4),
          ],
        },
      ],
      exits: [{ to: 'cockpit', label: 'POSTE DE PILOTAGE' }],
    },

    /* ================================================================ */
    premiere: {
      title: 'PREMIÈRE CLASSE',
      subtitle: 'Suites individuelles, cloisons hautes',
      build() {
        const out = [...cabinShell(13, 42)];
        for (let z = 16; z < 38; z += 2.4) {
          for (const sx of [-2.7, 0, 2.7]) {
            out.push(...slab(sx, 0.5, z + 0.2, 1.9, 1.3, '#3a3350'));
            out.push(...box(sx, 0.5, z - 0.72, 1.9, 0.95, 0.16, '#463d5f'));
            out.push(...box(sx - 0.98, 0, z, 0.1, 1.45, 1.7, '#565064'));
            out.push(...box(sx + 0.98, 0, z, 0.1, 1.45, 1.7, '#565064'));
          }
        }
        out.push(...exitSigns([20, 32]));
        return out;
      },
      beats: [
        {
          cam: { x: AR, y: EYE, z: 17.0, yaw: 0 },
          travel: 2.4,
          cover: cartCover(AR, 18.1),
          limit: 26,
          enemies: [
            e('otage', 2.7, 21.2, 0.2),
            aisle('pirate', AR, 21.8, 0.9),
            aisle('pirate', AL, 23.2, 2.1),
          ],
        },
        {
          cam: { x: AR, y: EYE, z: 20.4, yaw: 0 },
          travel: 2.2,
          cover: cartCover(AR, 21.5),
          limit: 32,
          enemies: [
            e('otage', 0, 24.0, 0.2),
            aisle('bouclier', AR, 24.8, 0.5, { lean: -1 }),
            aisle('lourd', AL, 26.0, 1.9),
            e('tireur', 2.7, 27.6, 3.4),
          ],
        },
      ],
      exits: [{ to: 'cockpit', label: 'POSTE DE PILOTAGE' }],
    },

    /* ================================================================ */
    cockpit: {
      title: 'POSTE DE PILOTAGE',
      subtitle: 'Le meneur tient le commandant de bord',
      final: true,
      build() {
        const out = [...cabinShell(20, 38, { seg: 1.4, lightEvery: 2 })];
        // Cloison blindee et passage
        out.push(...box(-2.7, 0, 28.5, 2.5, 2.3, 0.3, '#474d5b'));
        out.push(...box(2.7, 0, 28.5, 2.5, 2.3, 0.3, '#474d5b'));
        out.push(...box(0, 2.0, 28.5, 2.9, 0.3, 0.3, '#474d5b'));
        // Poste : pupitre, sieges pilotes, pare-brise de nuit
        out.push(...box(0, 0, 33.4, 3.4, 1.05, 0.7, '#2b303c'));
        out.push(...box(0, 1.05, 33.6, 3.4, 0.5, 0.35, '#1b2740'));
        out.push(...box(-1.0, 0, 31.6, 0.8, 0.5, 0.7, '#343b4a'));
        out.push(...box(1.0, 0, 31.6, 0.8, 0.5, 0.7, '#343b4a'));
        out.push(...box(-1.0, 0.5, 31.3, 0.8, 0.85, 0.16, '#3d4557'));
        out.push(...box(1.0, 0.5, 31.3, 0.8, 0.85, 0.16, '#3d4557'));
        out.push(...panel(0, 1.55, 34.2, 3.2, 0.7, '#071a2e'));
        return out;
      },
      beats: [
        {
          cam: { x: 0, y: EYE, z: 23.6, yaw: 0 },
          travel: 2.6,
          cover: cartCover(0, 24.7),
          limit: 24,
          enemies: [
            aisle('pirate', -1.6, 27.6, 0.5),
            aisle('pirate', 1.6, 27.6, 1.4),
            aisle('tireur', 0, 29.4, 2.8),
          ],
        },
        {
          cam: { x: 0, y: EYE, z: 26.6, yaw: 0 },
          travel: 2.0,
          cover: cartCover(0, 27.7),
          limit: 48,
          boss: true,
          enemies: [
            e('otage', -1.7, 31.0, 0.4),
            aisle('meneur', 0.7, 31.6, 1.0, { lean: -1 }),
            aisle('pirate', -2.4, 30.2, 5.0),
            aisle('pirate', 2.4, 30.2, 9.0),
          ],
        },
      ],
      exits: [],
    },
  },
};
