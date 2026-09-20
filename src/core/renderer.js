import { col } from './color.js';

/**
 * Rendu "fausse 3D" : projection perspective a la main, tout est dessine
 * en Canvas2D avec un algorithme du peintre (tri par profondeur).
 *  - quad()      : un polygone 3D a 4 sommets (murs, sol, caisses)
 *  - billboard() : un sprite toujours face camera (ennemis, props, marqueurs)
 * Convention : +Z vers l'avant, +Y vers le haut, yaw=0 regarde vers +Z.
 */
export class Renderer {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d', { alpha: false, desynchronized: true });
    this.w = 1;
    this.h = 1;
    this.dpr = 1;

    this.fov = Math.PI / 3.2;
    this.near = 0.3;
    this.cam = { x: 0, y: 1.7, z: 0, yaw: 0 };
    this.horizon = 0; // approximation du tangage, en pixels
    this.shakeX = 0;
    this.shakeY = 0;

    this.fog = col('#0c1220');
    this.skyTop = '#070b14';
    this.skyBottom = '#243352';
    this.fogStart = 7;
    this.fogEnd = 34;

    this.items = [];
    this._c = 1;
    this._s = 0;
    this._f = 1;
    this.cx = 0;
    this.cy = 0;
  }

  resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const r = this.canvas.getBoundingClientRect();
    const w = Math.max(1, Math.round(r.width));
    const h = Math.max(1, Math.round(r.height));
    this.canvas.width = Math.round(w * dpr);
    this.canvas.height = Math.round(h * dpr);
    this.w = w;
    this.h = h;
    this.dpr = dpr;
  }

  begin() {
    const ctx = this.ctx;
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    this._c = Math.cos(this.cam.yaw);
    this._s = Math.sin(this.cam.yaw);
    this._f = this.h / 2 / Math.tan(this.fov / 2);
    this.cx = this.w / 2 + this.shakeX;
    this.cy = this.h / 2 + this.horizon + this.shakeY;
    this.items.length = 0;
    this.drawSky();
  }

  drawSky() {
    const ctx = this.ctx;
    const g = ctx.createLinearGradient(0, 0, 0, this.h);
    g.addColorStop(0, this.skyTop);
    g.addColorStop(0.55, this.skyBottom);
    g.addColorStop(1, '#0c1220');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, this.w, this.h);
  }

  toCam(x, y, z) {
    const dx = x - this.cam.x;
    const dy = y - this.cam.y;
    const dz = z - this.cam.z;
    return {
      x: dx * this._c - dz * this._s,
      y: dy,
      z: dx * this._s + dz * this._c,
    };
  }

  projectCam(v) {
    const s = this._f / v.z;
    return { x: this.cx + v.x * s, y: this.cy - v.y * s, s };
  }

  /** Projette un point monde. Renvoie null si derriere le plan proche. */
  project(x, y, z) {
    const v = this.toCam(x, y, z);
    if (v.z <= this.near) return null;
    const p = this.projectCam(v);
    p.depth = v.z;
    return p;
  }

  fogColor(c, depth) {
    let t = (depth - this.fogStart) / (this.fogEnd - this.fogStart);
    t = t < 0 ? 0 : t > 1 ? 1 : t;
    const f = this.fog;
    return `rgb(${(c.r + (f.r - c.r) * t) | 0},${(c.g + (f.g - c.g) * t) | 0},${
      (c.b + (f.b - c.b) * t) | 0
    })`;
  }

  push(depth, fn) {
    this.items.push({ d: depth, fn });
  }

  /** Decoupe un polygone (espace camera) contre le plan proche. */
  clipNear(poly) {
    const out = [];
    const n = poly.length;
    for (let i = 0; i < n; i++) {
      const a = poly[i];
      const b = poly[(i + 1) % n];
      const ain = a.z > this.near;
      const bin = b.z > this.near;
      if (ain) out.push(a);
      if (ain !== bin) {
        const t = (this.near - a.z) / (b.z - a.z);
        out.push({
          x: a.x + (b.x - a.x) * t,
          y: a.y + (b.y - a.y) * t,
          z: this.near,
        });
      }
    }
    return out;
  }

  /**
   * @param {Array<[number,number,number]>} pts sommets monde
   * @param {{r,g,b}} color
   * @param {number} [bias] ajout de profondeur pour forcer l'ordre de tri
   */
  quad(pts, color, bias) {
    const camPts = new Array(pts.length);
    for (let i = 0; i < pts.length; i++) {
      const p = pts[i];
      camPts[i] = this.toCam(p[0], p[1], p[2]);
    }
    const clipped = this.clipNear(camPts);
    if (clipped.length < 3) return;

    let sum = 0;
    const screen = new Array(clipped.length);
    for (let i = 0; i < clipped.length; i++) {
      sum += clipped[i].z;
      screen[i] = this.projectCam(clipped[i]);
    }
    const depth = sum / clipped.length;
    const fill = this.fogColor(color, depth);

    this.push(depth + (bias || 0), (ctx) => {
      ctx.beginPath();
      ctx.moveTo(screen[0].x, screen[0].y);
      for (let i = 1; i < screen.length; i++) ctx.lineTo(screen[i].x, screen[i].y);
      ctx.closePath();
      ctx.fillStyle = fill;
      ctx.fill();
    });
  }

  /**
   * Dessine un lot de quads en ecartant d'abord ceux hors champ.
   * Sans ce tri grossier, une cabine entiere coute trop cher par image.
   */
  mesh(quads, bias) {
    const far = this.fogEnd + 8;
    const tanV = Math.tan(this.fov / 2);
    const tanH = tanV * (this.w / this.h);
    for (let i = 0; i < quads.length; i++) {
      const q = quads[i];
      if (q._r === undefined) {
        let cx = 0, cy = 0, cz = 0;
        for (const v of q.p) {
          cx += v[0];
          cy += v[1];
          cz += v[2];
        }
        const n = q.p.length;
        cx /= n;
        cy /= n;
        cz /= n;
        let r = 0;
        for (const v of q.p) {
          const d = Math.hypot(v[0] - cx, v[1] - cy, v[2] - cz);
          if (d > r) r = d;
        }
        q._cx = cx;
        q._cy = cy;
        q._cz = cz;
        q._r = r;
      }
      const v = this.toCam(q._cx, q._cy, q._cz);
      if (v.z + q._r < this.near) continue;
      if (v.z - q._r > far) continue;
      const zp = v.z > 0 ? v.z : 0;
      if (Math.abs(v.x) > zp * tanH + q._r + 0.6) continue;
      if (Math.abs(v.y) > zp * tanV + q._r + 0.6) continue;
      this.quad(q.p, q.c, bias);
    }
  }

  /**
   * Sprite face camera ancre par sa base.
   * fn(ctx, rect, fogT) dessine dans le rectangle ecran fourni.
   * Renvoie le rectangle ecran (utilise pour la detection de tir) ou null.
   */
  billboard(x, y, z, wWorld, hWorld, fn, bias) {
    const v = this.toCam(x, y, z);
    if (v.z <= this.near) return null;
    const p = this.projectCam(v);
    const w = wWorld * p.s;
    const h = hWorld * p.s;
    const rect = { x: p.x - w / 2, y: p.y - h, w, h, depth: v.z };
    const fogT = Math.min(
      1,
      Math.max(0, (v.z - this.fogStart) / (this.fogEnd - this.fogStart))
    );
    this.push(v.z + (bias || 0), (ctx) => fn(ctx, rect, fogT));
    return rect;
  }

  flush() {
    const ctx = this.ctx;
    this.items.sort((a, b) => b.d - a.d);
    for (let i = 0; i < this.items.length; i++) this.items[i].fn(ctx);
    this.items.length = 0;
  }
}
