import { clamp, rand } from '../core/math.js';
import { drawHuman, drawMuzzle, drawTargetRing, F } from './sprites.js';

export const KINDS = {
  // Preneur d'otage standard, surgit d'une rangee de sieges
  pirate: {
    hp: 1, aim: 1.7, shots: 1, cool: 0.9, score: 100,
    w: 0.78, h: 1.76, cloth: '#2b3446', accent: '#8d2230', skin: '#c79371',
  },
  // Chef de cabine arme, encaisse plusieurs balles
  lourd: {
    hp: 3, aim: 2.3, shots: 2, cool: 1.0, score: 300,
    w: 0.95, h: 1.88, cloth: '#1d2533', accent: '#c1662a', skin: '#a9764f',
  },
  // Tireur au fond de la cabine, vise vite
  tireur: {
    hp: 1, aim: 1.15, shots: 1, cool: 0.8, score: 200,
    w: 0.74, h: 1.72, cloth: '#33263a', accent: '#b0354f', skin: '#d0a07d',
  },
  // Passager : lever les mains, ne jamais tirer dessus
  otage: {
    hp: 1, aim: 0, shots: 0, cool: 0, score: 0,
    w: 0.76, h: 1.7, cloth: '#5f7fa8', accent: '#e8e2d2', skin: '#d8ab86',
    friendly: true, linger: 3.4,
  },
  // Pirate retranche derriere un otage : viser le cote expose
  bouclier: {
    hp: 1, aim: 2.6, shots: 1, cool: 1.2, score: 500,
    w: 0.8, h: 1.74, cloth: '#241c2e', accent: '#9d2b3f', skin: '#bb8a66',
    shield: true,
  },
  // Meneur, dans le cockpit
  meneur: {
    hp: 8, aim: 1.5, shots: 3, cool: 0.55, score: 1500,
    w: 1.0, h: 1.92, cloth: '#15202e', accent: '#d8a13a', skin: '#b7855c',
    boss: true,
  },
};

let uid = 1;

export class Enemy {
  constructor(def) {
    const k = KINDS[def.kind] || KINDS.pirate;
    this.id = uid++;
    this.kind = def.kind || 'pirate';
    this.cfg = k;
    this.x = def.x;
    this.z = def.z;
    this.groundY = def.y || 0;
    this.hp = def.hp || k.hp;
    this.delay = def.delay || 0;
    this.aimTime = def.aim || k.aim;
    this.shotsLeft = def.shots !== undefined ? def.shots : k.shots;
    this.riseFrom = def.rise !== undefined ? def.rise : -1.15;
    this.lean = def.lean || 0;
    this.friendly = !!k.friendly;
    this.shield = !!k.shield;
    this.boss = !!k.boss;

    // Repli de duree variable : sans cela les ennemis se synchronisent.
    this.hideTime = def.hide || rand(0.8, 1.9);
    // Un ennemi ne quitte la scene que mort : sinon il replonge derriere
    // les sieges et ressort, indefiniment.

    this.state = 'wait';
    this.t = 0;
    this.y = this.groundY + this.riseFrom;
    this.flash = 0;
    this.fallT = 0;
    this.muzzle = 0;
    this.rect = null;
    this.shieldRect = null;
    this.done = false;
    this.killed = false;
    this.aimProgress = 0;
    this.linger = k.linger || 0;
  }

  get alive() {
    return this.state !== 'dead' && this.state !== 'gone';
  }

  /** Cible tirable par le joueur ? */
  get targetable() {
    return (
      this.alive &&
      this.state !== 'wait' &&
      this.state !== 'hidden' &&
      this.state !== 'dying' &&
      this.rect !== null
    );
  }

  update(dt, ctx) {
    this.t += dt;
    this.flash = Math.max(0, this.flash - dt * 5);
    this.muzzle = Math.max(0, this.muzzle - dt * 8);

    switch (this.state) {
      case 'wait':
        if (this.t >= this.delay) this.setState('rise');
        break;
      case 'rise': {
        const p = clamp(this.t / 0.34, 0, 1);
        this.y = this.groundY + this.riseFrom * (1 - p);
        if (p >= 1) this.setState(this.friendly ? 'plead' : 'aim');
        break;
      }
      case 'plead':
        if (this.t >= this.linger) this.setState('duck');
        break;
      case 'aim': {
        this.aimProgress = clamp(this.t / this.aimTime, 0, 1);
        if (this.aimProgress >= 1) {
          this.setState('fire');
          ctx.onFire(this);
          this.muzzle = 1;
        }
        break;
      }
      case 'fire':
        if (this.t > 0.18) {
          this.shotsLeft--;
          this.setState(this.shotsLeft > 0 ? 'cool' : 'duck');
        }
        break;
      case 'cool':
        this.aimProgress = 0;
        if (this.t >= this.cfg.cool) this.setState('aim');
        break;
      case 'duck': {
        const p = clamp(this.t / 0.35, 0, 1);
        this.y = this.groundY + this.riseFrom * p;
        if (p >= 1) {
          if (this.friendly) {
            this.state = 'gone';
            this.done = true;
          } else {
            this.setState('hidden');
          }
        }
        break;
      }
      case 'hidden':
        // Repli temporaire : il recharge et repart a l'assaut.
        if (this.t >= this.hideTime) {
          this.shotsLeft = this.cfg.shots;
          this.hideTime = rand(0.8, 1.9);
          this.setState('rise');
        }
        break;
      case 'dying': {
        this.fallT = clamp(this.t / 0.55, 0, 1);
        if (this.fallT >= 1) {
          this.state = 'dead';
          this.done = true;
        }
        break;
      }
      default:
        break;
    }
  }

  setState(s) {
    this.state = s;
    this.t = 0;
    if (s === 'aim') this.aimProgress = 0;
  }

  hitBy(dmg) {
    this.hp -= dmg;
    this.flash = 1;
    if (this.hp <= 0) {
      this.killed = true;
      this.setState('dying');
      this.lean = this.lean || (Math.random() < 0.5 ? -1 : 1);
      return true;
    }
    return false;
  }

  /** Progression du reticule : 0 = calme, 1 = tir imminent. */
  ringProgress() {
    if (this.friendly) return 0;
    if (this.state === 'aim') return this.aimProgress;
    if (this.state === 'fire') return 1;
    return 0;
  }

  render(renderer) {
    const k = this.cfg;
    this.rect = null;
    this.shieldRect = null;

    if (
      this.state === 'wait' ||
      this.state === 'hidden' ||
      this.state === 'gone' ||
      this.state === 'dead'
    )
      return;

    const alpha = this.state === 'dying' ? 1 : 1;

    if (this.shield) {
      // Otage devant, pirate decale derriere : deux boites de collision
      renderer.billboard(
        this.x + 0.42 * (this.lean || 1),
        this.y,
        this.z + 0.35,
        k.w,
        k.h,
        (ctx, rect, fog) => {
          drawHuman(ctx, rect, {
            cloth: k.cloth,
            accent: k.accent,
            skin: k.skin,
            pose: this.state === 'fire' || this.state === 'aim' ? 'aim' : 'idle',
            fog,
            flash: this.flash,
            fallT: this.fallT,
            lean: this.lean * 0.4,
            alpha,
          });
          if (this.muzzle > 0)
            drawMuzzle(
              ctx,
              rect.x + rect.w * (this.lean >= 0 ? 0.92 : 0.08),
              rect.y + rect.h * 0.27,
              rect.w * 0.6,
              this.muzzle
            );
          this.rect = rect;
        },
        0.02
      );
      renderer.billboard(
        this.x - 0.3 * (this.lean || 1),
        this.y,
        this.z,
        KINDS.otage.w,
        KINDS.otage.h,
        (ctx, rect, fog) => {
          drawHuman(ctx, rect, {
            cloth: KINDS.otage.cloth,
            accent: KINDS.otage.accent,
            skin: KINDS.otage.skin,
            pose: 'armsUp',
            fog,
            alpha,
          });
          this.shieldRect = rect;
          if (this.state !== 'dying') {
            drawTargetRing(ctx, rect, 0, { friendly: true, alpha: 0.9 });
          }
        }
      );
      renderer.push(0.001, (ctx) => {
        if (!this.rect || this.state === 'dying') return;
        drawTargetRing(ctx, this.rect, this.ringProgress(), {
          locked: this.state === 'fire',
        });
      });
      return;
    }

    renderer.billboard(
      this.x,
      this.y,
      this.z,
      k.w,
      k.h,
      (ctx, rect, fog) => {
        drawHuman(ctx, rect, {
          cloth: k.cloth,
          accent: k.accent,
          skin: k.skin,
          pose: this.friendly
            ? 'armsUp'
            : this.state === 'aim' || this.state === 'fire'
            ? 'aim'
            : 'idle',
          fog,
          flash: this.flash,
          fallT: this.fallT,
          lean: this.lean * (this.state === 'dying' ? 1 : 0.2),
          alpha,
        });
        if (this.muzzle > 0)
          drawMuzzle(
            ctx,
            rect.x + rect.w * 0.9,
            rect.y + rect.h * 0.27,
            rect.w * 0.7,
            this.muzzle
          );
        this.rect = rect;
        if (this.state !== 'dying' && this.state !== 'rise') {
          drawTargetRing(ctx, rect, this.ringProgress(), {
            friendly: this.friendly,
            locked: this.state === 'fire',
          });
        }
      }
    );
  }
}

/** Projectile ennemi : file vers la camera, peut etre abattu en vol. */
export class Bullet {
  constructor(x, y, z, cam, speed = 11) {
    this.x = x;
    this.y = y;
    this.z = z;
    const dx = cam.x - x,
      dy = cam.y - y,
      dz = cam.z - z;
    const len = Math.hypot(dx, dy, dz) || 1;
    this.vx = (dx / len) * speed;
    this.vy = (dy / len) * speed;
    this.vz = (dz / len) * speed;
    this.life = 3;
    this.rect = null;
    this.dead = false;
    this.spin = rand(0, Math.PI);
  }

  update(dt, cam) {
    this.x += this.vx * dt;
    this.y += this.vy * dt;
    this.z += this.vz * dt;
    this.life -= dt;
    const d = Math.hypot(cam.x - this.x, cam.y - this.y, cam.z - this.z);
    if (d < 0.55) return 'impact';
    if (this.life <= 0) {
      this.dead = true;
      return 'expire';
    }
    return null;
  }

  render(renderer) {
    this.rect = renderer.billboard(
      this.x,
      this.y + 0.16,
      this.z,
      0.33,
      0.33,
      (ctx, rect) => {
        const cx = rect.x + rect.w / 2;
        const cy = rect.y + rect.h / 2;
        const r = Math.max(2, rect.w / 2);
        const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, r);
        g.addColorStop(0, '#fff');
        g.addColorStop(0.35, '#ffd24a');
        g.addColorStop(1, 'rgba(255,90,0,0)');
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(cx, cy, r, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = F('#ff7a2f', 0);
        ctx.lineWidth = Math.max(1, r * 0.22);
        ctx.beginPath();
        ctx.arc(cx, cy, r * 0.72, this.spin, this.spin + Math.PI * 1.2);
        ctx.stroke();
      },
      -0.05
    );
  }
}
