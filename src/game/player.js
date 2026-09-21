import { approach, clamp } from '../core/math.js';

export const STAND_EYE = 1.62;
export const CROUCH_EYE = 0.92;

// Sortie de cachette volontairement rapide : au pistolet, la pedale et la
// detente sont pressees quasi ensemble.
const EXPOSE_TIME = 0.15;
const EXPOSED_AT = 0.4;

export class Player {
  constructor() {
    this.reset();
  }

  reset() {
    this.maxHp = 5;
    this.hp = 5;
    this.magSize = 6;
    this.ammo = this.magSize;
    this.score = 0;
    this.combo = 0;
    this.bestCombo = 0;
    this.shotsFired = 0;
    this.shotsHit = 0;
    this.hostagesHit = 0;

    this.exposure = 0; // 0 = a couvert, 1 = sorti
    this.wantExposed = false;
    this.reloadT = 0;
    this.coverReload = false;
    this.invuln = 0;
    this.recoil = 0;
    this.hurtFlash = 0;
    this.penaltyFlash = 0;
    this.dead = false;
  }

  get exposed() {
    return this.exposure > EXPOSED_AT;
  }
  get inCover() {
    return this.exposure < 0.2;
  }
  get reloading() {
    return this.reloadT > 0;
  }

  update(dt, hasCover) {
    const target = hasCover ? (this.wantExposed ? 1 : 0) : 1;
    this.exposure = approach(this.exposure, target, 1 / EXPOSE_TIME, dt);

    // Se relever solde immediatement le rechargement a couvert. Sans cela le
    // joueur se leve et reste incapable de tirer pendant presque une
    // demi-seconde, ce qui donne l'impression que la detente ne repond pas.
    if (this.coverReload && (this.wantExposed || !hasCover)) {
      this.reloadT = 0;
      this.ammo = this.magSize;
      this.coverReload = false;
    }

    if (this.reloadT > 0) {
      this.reloadT -= dt;
      if (this.reloadT <= 0) {
        this.ammo = this.magSize;
        this.coverReload = false;
      }
    }
    // Rechargement automatique a couvert, comme sur borne.
    if (this.inCover && hasCover && this.ammo < this.magSize && !this.reloading) {
      this.reloadT = 0.45;
      this.coverReload = true;
    }
    this.invuln = Math.max(0, this.invuln - dt);
    this.recoil = Math.max(0, this.recoil - dt * 6);
    this.hurtFlash = Math.max(0, this.hurtFlash - dt * 2);
    this.penaltyFlash = Math.max(0, this.penaltyFlash - dt * 1.6);
  }

  canShoot() {
    return !this.dead && this.exposed && !this.reloading && this.ammo > 0;
  }

  consumeShot() {
    this.ammo--;
    this.shotsFired++;
    this.recoil = 1;
  }

  startReload() {
    if (this.reloading || this.ammo === this.magSize) return false;
    this.reloadT = 0.6;
    this.coverReload = false;
    return true;
  }

  damage(n = 1) {
    if (this.invuln > 0 || this.dead) return false;
    this.hp = clamp(this.hp - n, 0, this.maxHp);
    this.invuln = 1.1;
    this.hurtFlash = 1;
    this.combo = 0;
    if (this.hp <= 0) this.dead = true;
    return true;
  }

  penalty(n = 1) {
    this.hostagesHit++;
    this.penaltyFlash = 1;
    this.combo = 0;
    this.score = Math.max(0, this.score - 500);
    this.hp = clamp(this.hp - n, 0, this.maxHp);
    if (this.hp <= 0) this.dead = true;
  }

  award(base) {
    this.combo++;
    if (this.combo > this.bestCombo) this.bestCombo = this.combo;
    const mult = 1 + Math.min(this.combo - 1, 9) * 0.25;
    const pts = Math.round(base * mult);
    this.score += pts;
    this.shotsHit++;
    return { pts, mult };
  }
}
