import { col } from '../core/color.js';

const FOG = col('#121a2c');
const cache = new Map();

/** Couleur hex assombrie par le brouillard de distance, en chaine CSS. */
export function F(hex, t) {
  const key = hex + '|' + (t * 24 | 0);
  let v = cache.get(key);
  if (v) return v;
  let c = cache.get(hex + '|raw');
  if (!c) {
    c = col(hex);
    cache.set(hex + '|raw', c);
  }
  v = `rgb(${(c.r + (FOG.r - c.r) * t) | 0},${(c.g + (FOG.g - c.g) * t) | 0},${
    (c.b + (FOG.b - c.b) * t) | 0
  })`;
  cache.set(key, v);
  return v;
}

/**
 * Silhouette humaine dessinee proceduralement dans un rectangle ecran.
 * Aucun asset : tout est du canvas, ce qui garde le prototype autonome.
 */
export function drawHuman(ctx, rect, opts) {
  const {
    skin = '#c79371',
    cloth = '#2b3446',
    accent = '#8d2230',
    fog = 0,
    pose = 'idle', // idle | aim | armsUp | fall
    lean = 0, // -1 penche a gauche, +1 a droite
    flash = 0,
    alpha = 1,
    fallT = 0,
  } = opts;

  const w = rect.w;
  const h = rect.h;
  if (w < 1 || h < 1) return;
  const cx = rect.x + w / 2;
  const top = rect.y;

  ctx.save();
  ctx.globalAlpha = alpha;
  if (fallT > 0) {
    ctx.translate(cx, rect.y + h);
    ctx.rotate((lean >= 0 ? 1 : -1) * fallT * 1.25);
    ctx.translate(-cx, -(rect.y + h));
    ctx.globalAlpha = alpha * (1 - fallT * 0.65);
  }
  if (lean) {
    ctx.translate(cx, rect.y + h);
    ctx.rotate(lean * 0.12);
    ctx.translate(-cx, -(rect.y + h));
  }

  const C = (hex) => F(hex, fog);
  const shadow = C('#0a0d16');

  // Ombre au sol
  ctx.fillStyle = 'rgba(0,0,0,.35)';
  ctx.beginPath();
  ctx.ellipse(cx, rect.y + h, w * 0.42, h * 0.026, 0, 0, Math.PI * 2);
  ctx.fill();

  // Jambes
  ctx.fillStyle = shadow;
  ctx.fillRect(cx - w * 0.21, top + h * 0.56, w * 0.17, h * 0.44);
  ctx.fillRect(cx + w * 0.04, top + h * 0.56, w * 0.17, h * 0.44);

  // Torse
  ctx.fillStyle = C(cloth);
  ctx.fillRect(cx - w * 0.27, top + h * 0.19, w * 0.54, h * 0.4);
  // Gilet / accent
  ctx.fillStyle = C(accent);
  ctx.fillRect(cx - w * 0.27, top + h * 0.27, w * 0.54, h * 0.1);

  // Tete
  ctx.fillStyle = C(skin);
  ctx.beginPath();
  ctx.arc(cx, top + h * 0.11, h * 0.082, 0, Math.PI * 2);
  ctx.fill();

  const armW = w * 0.15;
  ctx.fillStyle = C(cloth);
  if (pose === 'armsUp') {
    // Bras levés, ouverts vers l'extérieur : lecture immédiate « ne tirez pas »
    ctx.save();
    ctx.translate(cx - w * 0.24, top + h * 0.24);
    ctx.rotate(-0.34);
    ctx.fillRect(-armW / 2, -h * 0.3, armW, h * 0.32);
    ctx.restore();
    ctx.save();
    ctx.translate(cx + w * 0.24, top + h * 0.24);
    ctx.rotate(0.34);
    ctx.fillRect(-armW / 2, -h * 0.3, armW, h * 0.32);
    ctx.restore();
    ctx.fillStyle = C(skin);
    ctx.beginPath();
    ctx.arc(cx - w * 0.42, top - h * 0.05, h * 0.036, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(cx + w * 0.42, top - h * 0.05, h * 0.036, 0, Math.PI * 2);
    ctx.fill();
  } else if (pose === 'aim') {
    ctx.fillRect(cx - w * 0.05, top + h * 0.24, w * 0.52, h * 0.09);
    ctx.fillStyle = shadow;
    ctx.fillRect(cx + w * 0.32, top + h * 0.22, w * 0.38, h * 0.08);
    ctx.fillRect(cx + w * 0.44, top + h * 0.28, w * 0.07, h * 0.1);
  } else {
    ctx.fillRect(cx - w * 0.36, top + h * 0.21, armW, h * 0.33);
    ctx.fillRect(cx + w * 0.21, top + h * 0.21, armW, h * 0.33);
  }

  if (flash > 0) {
    ctx.globalAlpha = alpha * flash;
    ctx.fillStyle = '#fff';
    ctx.fillRect(rect.x, rect.y, w, h);
  }
  ctx.restore();
}

/** Eclair de bouche, en screen space. */
export function drawMuzzle(ctx, x, y, r, a) {
  ctx.save();
  ctx.globalAlpha = a;
  const g = ctx.createRadialGradient(x, y, 0, x, y, r);
  g.addColorStop(0, '#fff6d0');
  g.addColorStop(0.35, '#ffc43d');
  g.addColorStop(1, 'rgba(255,120,0,0)');
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

/**
 * Reticule facon Virtua Cop : un cercle et quatre equerres qui se resserrent
 * autour de la cible en passant du vert au rouge a l'approche du tir.
 * @param {number} t 0 = vient d'apparaitre, 1 = tire maintenant
 */
export function drawTargetRing(ctx, rect, t, opts = {}) {
  const { friendly = false, alpha = 1, locked = false } = opts;
  const cx = rect.x + rect.w / 2;
  const cy = rect.y + rect.h * 0.42;
  const base = Math.max(rect.w * 0.62, rect.h * 0.34);
  const r = base * (1.5 - 0.55 * t);
  if (r < 3) return;

  let color;
  if (friendly) color = '#4cc9ff';
  else {
    const hue = 118 - 118 * Math.min(1, t);
    color = `hsl(${hue},92%,${52 + 10 * t}%)`;
  }

  ctx.save();
  ctx.globalAlpha = alpha * (friendly ? 0.85 : 0.6 + 0.4 * t);
  ctx.strokeStyle = color;
  ctx.lineWidth = Math.max(1.4, base * 0.055);
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.stroke();

  // Equerres
  const a = r * 1.02;
  const len = r * 0.42;
  ctx.lineWidth = Math.max(1.6, base * 0.075);
  const corners = [
    [-1, -1],
    [1, -1],
    [-1, 1],
    [1, 1],
  ];
  for (const [sx, sy] of corners) {
    const px = cx + sx * a;
    const py = cy + sy * a;
    ctx.beginPath();
    ctx.moveTo(px - sx * len, py);
    ctx.lineTo(px, py);
    ctx.lineTo(px, py - sy * len);
    ctx.stroke();
  }

  if (friendly) {
    ctx.globalAlpha = alpha * 0.9;
    ctx.lineWidth = Math.max(1.6, base * 0.07);
    ctx.beginPath();
    ctx.moveTo(cx - r * 0.42, cy - r * 0.42);
    ctx.lineTo(cx + r * 0.42, cy + r * 0.42);
    ctx.moveTo(cx + r * 0.42, cy - r * 0.42);
    ctx.lineTo(cx - r * 0.42, cy + r * 0.42);
    ctx.stroke();
  } else if (locked) {
    ctx.globalAlpha = alpha;
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(cx, cy, Math.max(2, base * 0.07), 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}
