import { PHASE } from './director.js';

const FONT = 'system-ui, "Segoe UI", Roboto, sans-serif';

function shadowText(ctx, text, x, y, size, color, align = 'left', weight = 700) {
  ctx.font = `${weight} ${size}px ${FONT}`;
  ctx.textAlign = align;
  ctx.textBaseline = 'alphabetic';
  ctx.lineWidth = Math.max(3, size * 0.16);
  ctx.strokeStyle = 'rgba(0,0,0,.72)';
  ctx.strokeText(text, x, y);
  ctx.fillStyle = color;
  ctx.fillText(text, x, y);
}

export function renderHud(ctx, game) {
  const { w, h } = game.renderer;
  const p = game.player;
  const d = game.director;
  const u = Math.max(0.62, Math.min(w / 1280, h / 720));

  // Voile de degats / penalite otage
  if (p.hurtFlash > 0) {
    const g = ctx.createRadialGradient(w / 2, h / 2, h * 0.25, w / 2, h / 2, h * 0.78);
    g.addColorStop(0, 'rgba(180,0,0,0)');
    g.addColorStop(1, `rgba(190,10,10,${0.66 * p.hurtFlash})`);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
  }
  if (p.penaltyFlash > 0) {
    ctx.fillStyle = `rgba(255,240,190,${0.3 * p.penaltyFlash})`;
    ctx.fillRect(0, 0, w, h);
    shadowText(ctx, 'OTAGE TOUCHÉ', w / 2, h * 0.3, 44 * u, '#ff4d4d', 'center');
  }

  // Bandeau haut : titre de section
  shadowText(ctx, d.section ? d.section.title : '', 22 * u, 34 * u, 20 * u, '#ffd24a');
  if (d.section && d.section.subtitle)
    shadowText(
      ctx,
      d.section.subtitle,
      22 * u,
      54 * u,
      13 * u,
      'rgba(255,255,255,.62)',
      'left',
      500
    );

  // Score
  shadowText(ctx, String(p.score).padStart(6, '0'), w - 22 * u, 34 * u, 24 * u, '#fff', 'right');
  if (p.combo > 1)
    shadowText(
      ctx,
      `COMBO ×${p.combo}`,
      w - 22 * u,
      56 * u,
      14 * u,
      '#ffd24a',
      'right'
    );

  // Chrono de vague
  if (d.phase === PHASE.COMBAT) {
    const t = Math.max(0, d.beatTimer);
    const crit = t < 6;
    shadowText(
      ctx,
      t.toFixed(1),
      w / 2,
      44 * u,
      crit ? 38 * u : 30 * u,
      crit ? '#ff5544' : '#fff',
      'center'
    );
  }

  // Vies
  const hx = 22 * u,
    hy = h - 30 * u;
  for (let i = 0; i < p.maxHp; i++) {
    const on = i < p.hp;
    ctx.fillStyle = on ? '#ff4d5e' : 'rgba(255,255,255,.16)';
    ctx.beginPath();
    ctx.roundRect(hx + i * 24 * u, hy - 14 * u, 17 * u, 17 * u, 3 * u);
    ctx.fill();
  }
  shadowText(ctx, 'VIES', hx, hy - 22 * u, 11 * u, 'rgba(255,255,255,.5)', 'left', 600);

  // Munitions
  const ax = w - 22 * u;
  for (let i = 0; i < p.magSize; i++) {
    const on = i < p.ammo;
    const bx = ax - (p.magSize - i) * 15 * u;
    ctx.fillStyle = on ? '#ffd24a' : 'rgba(255,255,255,.16)';
    ctx.beginPath();
    ctx.roundRect(bx, hy - 18 * u, 8 * u, 21 * u, 2 * u);
    ctx.fill();
  }
  shadowText(
    ctx,
    p.reloading ? 'RECHARGEMENT' : p.ammo === 0 ? 'VIDE — CACHEZ-VOUS' : 'MUNITIONS',
    ax,
    hy - 26 * u,
    11 * u,
    p.ammo === 0 && !p.reloading ? '#ff5544' : 'rgba(255,255,255,.5)',
    'right',
    600
  );

  // Etat de couverture
  if (d.hasCover) {
    const label = p.exposed ? 'DÉCOUVERT' : p.inCover ? 'À COUVERT' : '…';
    shadowText(
      ctx,
      label,
      w / 2,
      h - 26 * u,
      16 * u,
      p.exposed ? '#ff8a4d' : '#6fe07a',
      'center'
    );
    shadowText(
      ctx,
      'MAINTENIR ESPACE / PÉDALE POUR SORTIR',
      w / 2,
      h - 10 * u,
      10 * u,
      'rgba(255,255,255,.42)',
      'center',
      600
    );
  }

  // Embranchement
  if (d.phase === PHASE.BRANCH) {
    shadowText(ctx, 'CHOISISSEZ VOTRE ITINÉRAIRE', w / 2, h * 0.16, 26 * u, '#ffd24a', 'center');
    shadowText(
      ctx,
      Math.ceil(d.branchT).toString(),
      w / 2,
      h * 0.16 + 32 * u,
      22 * u,
      '#fff',
      'center'
    );
  }

  if (d.phase === PHASE.TITLE) {
    ctx.fillStyle = 'rgba(4,7,14,.55)';
    ctx.fillRect(0, h * 0.36, w, h * 0.2);
    shadowText(ctx, d.section.title, w / 2, h * 0.47, 44 * u, '#ffd24a', 'center');
    shadowText(
      ctx,
      d.section.subtitle || '',
      w / 2,
      h * 0.52,
      15 * u,
      'rgba(255,255,255,.7)',
      'center',
      500
    );
  }
}

/** Viseur : suit la souris ou le pistolet, avec retour visuel sur touche. */
export function renderCrosshair(ctx, game) {
  const inp = game.input;
  if (!inp.hasPointer) return;
  const p = game.player;
  const x = inp.x;
  const y = inp.y;
  const u = Math.max(0.6, Math.min(game.renderer.w / 1280, game.renderer.h / 720));
  const ready = p.canShoot();
  const r = (13 + p.recoil * 9) * u;

  ctx.save();
  ctx.globalAlpha = ready ? 1 : 0.42;
  ctx.strokeStyle = p.ammo === 0 ? '#ff5544' : ready ? '#ff3b30' : '#9fb0c8';
  ctx.lineWidth = 2 * u;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(x - r * 1.9, y);
  ctx.lineTo(x - r * 0.45, y);
  ctx.moveTo(x + r * 0.45, y);
  ctx.lineTo(x + r * 1.9, y);
  ctx.moveTo(x, y - r * 1.9);
  ctx.lineTo(x, y - r * 0.45);
  ctx.moveTo(x, y + r * 0.45);
  ctx.lineTo(x, y + r * 1.9);
  ctx.stroke();
  ctx.fillStyle = '#fff';
  ctx.beginPath();
  ctx.arc(x, y, 1.6 * u, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}
