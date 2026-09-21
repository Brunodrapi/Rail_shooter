import { clamp, lerp, rand } from '../core/math.js';
import { Player, CROUCH_EYE } from './player.js';
import { Director, PHASE } from './director.js';
import { Effects } from './effects.js';
import { renderHud, renderCrosshair, renderDiagnostics } from './hud.js';

const inRect = (r, x, y) =>
  r && x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h;

// Coup garde en memoire quand la detente part pendant le relevement.
const SHOT_BUFFER = 0.3;

export const STATE = {
  MENU: 'menu',
  PLAYING: 'playing',
  PAUSED: 'paused',
  OVER: 'over',
  WIN: 'win',
};

export class Game {
  constructor(renderer, input, audio) {
    this.renderer = renderer;
    this.input = input;
    this.audio = audio;
    this.player = new Player();
    this.director = new Director(this);
    this.effects = new Effects();
    this.state = STATE.MENU;
    this.overReason = null;
    this.shotBuffer = 0;
    this.lastBlock = '';
    this.debug = false;
    this.pedalToggle = false;
    this._toggleState = false;
    this.onStateChange = () => {};
    this.director.reset();
  }

  start() {
    this.overReason = null;
    this.player.reset();
    this.effects.reset();
    this.director.reset();
    this.input.clearQueued();
    this.shotBuffer = 0;
    this.lastBlock = '';
    this._toggleState = false;
    this.setState(STATE.PLAYING);
  }

  setState(s) {
    this.state = s;
    this.onStateChange(s);
  }

  update(dt) {
    if (this.state !== STATE.PLAYING) return;

    if (this.input.takePause()) {
      this.setState(STATE.PAUSED);
      return;
    }

    const d = this.director;
    const p = this.player;

    // Pedale : maintien par defaut, bascule optionnelle pour les tests clavier.
    if (this.pedalToggle) {
      if (this.input.coverHeld && !this._heldPrev) this._toggleState = !this._toggleState;
      this._heldPrev = this.input.coverHeld;
      p.wantExposed = this._toggleState;
    } else {
      p.wantExposed = this.input.coverHeld;
    }

    while (this.input.takeReload()) {
      if (p.startReload()) this.audio.reload();
    }
    while (this.input.takeTrigger()) this.shoot();

    p.update(dt, d.hasCover);

    // Le coup mis en attente part des que le joueur est debout et pret.
    if (this.shotBuffer > 0) {
      this.shotBuffer -= dt;
      if (p.canShoot()) {
        this.shotBuffer = 0;
        this.lastBlock = '';
        this.fire(this.input.x, this.input.y);
      }
    }

    d.update(dt, p);
    this.effects.update(dt);
    this.updateCamera(dt);

    if (d.timeUp) {
      this.overReason = 'time';
      this.setState(STATE.OVER);
    } else if (p.dead) {
      this.overReason = 'hp';
      this.setState(STATE.OVER);
    } else if (d.phase === PHASE.FINISH) {
      this.setState(STATE.WIN);
    }
  }

  updateCamera(dt) {
    const d = this.director;
    const p = this.player;
    const base = d.pose;
    const cam = this.renderer.cam;
    let x = base.x,
      y = base.y,
      z = base.z;

    const cover = d.hasCover ? d.beat.cover : null;
    if (cover) {
      const e = p.exposure;
      x = lerp(base.x + (cover.camDX || 0), base.x, e);
      y = lerp(CROUCH_EYE, base.y, e);
      z = lerp(base.z + (cover.camDZ || 0), base.z, e);
    }

    const bob = d.bob();
    cam.x = x + bob.x;
    cam.y = y + bob.y;
    cam.z = z;
    cam.yaw = base.yaw || 0;

    const shake = p.recoil * 4 + p.hurtFlash * 9;
    this.renderer.shakeX = rand(-shake, shake);
    this.renderer.shakeY = rand(-shake, shake);
    this.renderer.horizon = -p.recoil * 12;
  }

  shoot() {
    const d = this.director;
    const p = this.player;
    const x = this.input.x;
    const y = this.input.y;

    // Choix d'itineraire : on tire sur le panneau voulu.
    if (d.phase === PHASE.BRANCH && d.exits) {
      for (const ex of d.exits) {
        if (inRect(ex.rect, x, y)) {
          this.effects.ring(x, y, 1.3, '#ffd24a');
          this.audio.hit();
          d.chooseExit(ex);
          return;
        }
      }
    }

    if (!p.exposed || p.reloading) {
      // A couvert on ne tire pas, comme sur Time Crisis. Mais si le joueur est
      // en train de se lever, le coup est garde en memoire au lieu d'etre
      // avale : au pistolet, pedale et detente partent quasi ensemble.
      if (!d.hasCover || p.wantExposed) {
        this.shotBuffer = SHOT_BUFFER;
        this.lastBlock = p.reloading ? 'rechargement en cours' : 'relevement';
      } else {
        this.lastBlock = 'a couvert';
      }
      return;
    }
    if (p.ammo <= 0) {
      this.audio.empty();
      this.effects.text(x, y, 'RECHARGEZ', '#ff5544', 16);
      this.lastBlock = 'chargeur vide';
      return;
    }
    this.lastBlock = '';
    this.fire(x, y);
  }

  /** Tir effectif, une fois toutes les conditions reunies. */
  fire(x, y) {
    const d = this.director;
    const p = this.player;
    p.consumeShot();
    this.audio.shot();
    this.effects.spark(x, y, 0.55, '#fff0b8');

    // Balles ennemies : abattables en vol
    for (let i = d.bullets.length - 1; i >= 0; i--) {
      const b = d.bullets[i];
      if (inRect(b.rect, x, y)) {
        d.bullets.splice(i, 1);
        const a = p.award(50);
        this.effects.ring(x, y, 0.8, '#4cc9ff');
        this.effects.text(x, y, `+${a.pts}`, '#4cc9ff', 16);
        this.audio.hit();
        return;
      }
    }

    // Cibles, de la plus proche a la plus lointaine
    const targets = d.enemies
      .filter((en) => en.targetable)
      .sort((a, b) => (a.rect.depth || 0) - (b.rect.depth || 0));

    for (const en of targets) {
      if (en.shield) {
        const r = en.rect;
        const side = en.lean >= 0 ? 1 : -1;
        // Seule la moitie exposee du preneur d'otage compte
        const exposedRect = {
          x: side > 0 ? r.x + r.w * 0.5 : r.x,
          y: r.y,
          w: r.w * 0.5,
          h: r.h * 0.72,
        };
        if (inRect(exposedRect, x, y)) {
          this.hitEnemy(en, x, y, y < r.y + r.h * 0.22);
          return;
        }
        if (inRect(en.shieldRect, x, y)) {
          this.hitHostage(x, y);
          return;
        }
        continue;
      }
      if (inRect(en.rect, x, y)) {
        if (en.friendly) {
          this.hitHostage(x, y);
          return;
        }
        this.hitEnemy(en, x, y, y < en.rect.y + en.rect.h * 0.22);
        return;
      }
    }

    // Raté
    this.player.combo = 0;
  }

  /** Vague nettoyee : secondes rendues + points pour le temps epargne. */
  onWaveCleared(bonus, saved) {
    const w = this.renderer.w;
    const h = this.renderer.h;
    this.audio.bonus();
    this.effects.text(w / 2, h * 0.3, `TEMPS +${bonus.toFixed(0)}s`, '#6fe07a', 40);
    const pts = Math.round(saved * 150);
    if (pts > 0) {
      this.player.score += pts;
      this.effects.text(w / 2, h * 0.38, `RAPIDITÉ +${pts}`, '#ffd24a', 24);
    }
  }

  hitEnemy(en, x, y, head) {
    const killed = en.hitBy(head ? 3 : 1);
    if (head) {
      this.audio.headshot();
      this.effects.ring(x, y, 1, '#ffd24a');
    } else {
      this.audio.hit();
    }
    this.effects.spark(x, y, 0.8, '#ff9a3c');
    if (killed) {
      const a = this.player.award(en.cfg.score * (head ? 1.5 : 1));
      this.effects.text(
        x,
        y,
        head ? `TÊTE +${a.pts}` : `+${a.pts}`,
        head ? '#ffd24a' : '#fff',
        head ? 22 : 18
      );
    }
  }

  hitHostage(x, y) {
    this.player.penalty(1);
    this.audio.hurt();
    this.effects.ring(x, y, 1.4, '#ff3b30');
    this.effects.text(x, y, '−500', '#ff3b30', 20);
  }

  onPlayerHit() {
    const p = this.player;
    if (p.exposed) {
      if (p.damage(1)) {
        this.audio.hurt();
        this.effects.ring(this.renderer.w / 2, this.renderer.h / 2, 2.4, '#ff3b30');
      }
    } else {
      this.effects.spark(
        this.renderer.w / 2 + rand(-120, 120),
        this.renderer.h * 0.8,
        0.6,
        '#8fa6c8'
      );
    }
  }

  render() {
    const r = this.renderer;
    r.begin();
    this.director.render(r);
    r.flush();
    const ctx = r.ctx;
    this.vignette(ctx);
    this.effects.render(ctx);
    if (this.state === STATE.PLAYING || this.state === STATE.PAUSED) {
      renderHud(ctx, this);
      renderCrosshair(ctx, this);
    }
    if (this.debug) renderDiagnostics(ctx, this);
  }

  vignette(ctx) {
    const { w, h } = this.renderer;
    const g = ctx.createRadialGradient(w / 2, h / 2, h * 0.34, w / 2, h / 2, h * 0.85);
    g.addColorStop(0, 'rgba(0,0,0,0)');
    g.addColorStop(1, 'rgba(0,0,0,.45)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
  }

  stats() {
    const p = this.player;
    const acc = p.shotsFired ? Math.round((p.shotsHit / p.shotsFired) * 100) : 0;
    return {
      score: p.score,
      accuracy: acc,
      bestCombo: p.bestCombo,
      reason: this.overReason,
      clock: this.director.clock,
      hostages: p.hostagesHit,
      path: this.director.path.slice(),
    };
  }
}
