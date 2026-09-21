import { clamp, lerp, lerpAngle, smoothstep } from '../core/math.js';
import { Enemy, Bullet } from './enemy.js';
import { CAMPAIGN } from '../data/campaign.js';

export const PHASE = {
  TITLE: 'title',
  TRAVEL: 'travel',
  COMBAT: 'combat',
  CLEAR: 'clear',
  BRANCH: 'branch',
  FINISH: 'finish',
};

const BRANCH_TIME = 6;

/**
 * Enchaine les sections du scenario. Chaque section est une suite de "beats" :
 * la camera avance sur son rail jusqu'a un point d'arret, une vague apparait,
 * on la nettoie, puis on repart. En fin de section, un embranchement.
 */
export class Director {
  constructor(game) {
    this.game = game;
    this.campaign = CAMPAIGN;
  }

  reset() {
    this.sectionId = null;
    this.section = null;
    this.mesh = [];
    this.beatIndex = -1;
    this.beat = null;
    this.enemies = [];
    this.bullets = [];
    this.phase = PHASE.TITLE;
    this.phaseT = 0;
    this.pose = { x: 0, y: 1.62, z: -12, yaw: 0 };
    this.fromPose = { ...this.pose };
    this.beatTimer = 0;
    this.path = [];
    this.exits = null;
    this.branchT = 0;
    this.pendingNext = null;
    this.walkPhase = 0;
    this.enterSection(this.campaign.start);
  }

  enterSection(id) {
    const sec = this.campaign.sections[id];
    if (!sec) {
      this.phase = PHASE.FINISH;
      return;
    }
    this.sectionId = id;
    this.section = sec;
    this.mesh = sec.build();
    this.beatIndex = -1;
    this.beat = null;
    this.enemies.length = 0;
    this.bullets.length = 0;
    this.exits = null;
    this.path.push(sec.title);
    this.setPhase(PHASE.TITLE);
    // Place la camera un peu en retrait du premier point d'arret.
    const first = sec.beats[0].cam;
    this.pose = { ...first, z: first.z - 3.2 };
    this.fromPose = { ...this.pose };
  }

  setPhase(p) {
    this.phase = p;
    this.phaseT = 0;
  }

  get hasCover() {
    return this.phase === PHASE.COMBAT && !!(this.beat && this.beat.cover);
  }

  get coverMesh() {
    return this.beat && this.beat.cover ? this.beat.cover.mesh : null;
  }

  nextBeat() {
    this.beatIndex++;
    if (this.beatIndex >= this.section.beats.length) {
      this.startBranch();
      return;
    }
    this.beat = this.section.beats[this.beatIndex];
    this.fromPose = { ...this.pose };
    this.setPhase(PHASE.TRAVEL);
  }

  spawnWave() {
    this.enemies.length = 0;
    for (const def of this.beat.enemies) this.enemies.push(new Enemy(def));
    this.beatTimer = this.beat.limit || 30;
    this.setPhase(PHASE.COMBAT);
    if (this.beat.boss) this.game.audio.alarm();
  }

  startBranch() {
    const exits = this.section.exits || [];
    if (exits.length === 0) {
      this.setPhase(PHASE.FINISH);
      return;
    }
    if (exits.length === 1) {
      this.enterSection(exits[0].to);
      return;
    }
    this.exits = exits.map((x) => ({ ...x, rect: null }));
    this.branchT = BRANCH_TIME;
    this.setPhase(PHASE.BRANCH);
    this.game.audio.branch();
  }

  chooseExit(exit) {
    if (this.phase !== PHASE.BRANCH) return;
    this.pendingNext = exit.to;
    this.game.audio.branch();
    this.exits = null;
    this.setPhase(PHASE.CLEAR);
    this.phaseT = -0.55; // petit temps mort avant la transition
  }

  update(dt, player) {
    this.phaseT += dt;
    this.walkPhase += dt;

    switch (this.phase) {
      case PHASE.TITLE:
        if (this.phaseT > 1.9) this.nextBeat();
        break;

      case PHASE.TRAVEL: {
        const dur = this.beat.travel || 2;
        const t = clamp(this.phaseT / dur, 0, 1);
        const k = smoothstep(t);
        const a = this.fromPose;
        const b = this.beat.cam;
        this.pose.x = lerp(a.x, b.x, k);
        this.pose.y = lerp(a.y, b.y, k);
        this.pose.z = lerp(a.z, b.z, k);
        this.pose.yaw = lerpAngle(a.yaw || 0, b.yaw || 0, k);
        if (t >= 1) this.spawnWave();
        break;
      }

      case PHASE.COMBAT: {
        this.beatTimer -= dt;
        if (this.beatTimer <= 0) {
          this.beatTimer = 0;
          player.damage(1);
          this.game.audio.hurt();
          for (const en of this.enemies) en.retreat();
        }
        this.updateActors(dt, player);
        const remaining = this.enemies.some((en) => !en.friendly && !en.done);
        if (!remaining && this.bullets.length === 0) {
          this.setPhase(PHASE.CLEAR);
        }
        break;
      }

      case PHASE.CLEAR:
        this.updateActors(dt, player);
        if (this.phaseT > 0.7) {
          if (this.pendingNext) {
            const next = this.pendingNext;
            this.pendingNext = null;
            this.enterSection(next);
          } else {
            this.nextBeat();
          }
        }
        break;

      case PHASE.BRANCH:
        this.branchT -= dt;
        this.updateActors(dt, player);
        if (this.branchT <= 0) this.chooseExit(this.section.exits[0]);
        break;

      default:
        break;
    }
  }

  updateActors(dt, player) {
    const cam = this.game.renderer.cam;
    const ctx = {
      onFire: (en) => {
        const ox = en.shield ? en.x + 0.42 * (en.lean || 1) : en.x;
        this.bullets.push(
          new Bullet(ox, en.y + en.cfg.h * 0.72, en.z, cam, en.boss ? 13 : 10.5)
        );
        this.game.audio.enemyShot();
      },
    };
    for (let i = this.enemies.length - 1; i >= 0; i--) {
      const en = this.enemies[i];
      en.update(dt, ctx);
      if (en.state === 'dead' || en.state === 'gone') {
        if (en.friendly || en.killed) this.enemies.splice(i, 1);
      }
    }
    for (let i = this.bullets.length - 1; i >= 0; i--) {
      const b = this.bullets[i];
      const r = b.update(dt, cam);
      if (r === 'impact') {
        this.bullets.splice(i, 1);
        this.game.onPlayerHit();
      } else if (r === 'expire') {
        this.bullets.splice(i, 1);
      }
    }
  }

  /** Oscillation de marche, discrete, pour donner de la vie au rail. */
  bob() {
    const moving = this.phase === PHASE.TRAVEL;
    const amp = moving ? 0.035 : 0.009;
    const sp = moving ? 7.5 : 1.6;
    return {
      y: Math.sin(this.walkPhase * sp) * amp,
      x: Math.cos(this.walkPhase * sp * 0.5) * amp * 0.6,
    };
  }

  render(renderer) {
    renderer.mesh(this.mesh);
    const cm = this.coverMesh;
    if (cm) renderer.mesh(cm);
    for (const en of this.enemies) en.render(renderer);
    for (const b of this.bullets) b.render(renderer);

    if (this.exits) this.renderExits(renderer);
  }

  /**
   * Panneaux d'embranchement. Ils sont ancres sur le point de destination
   * mais repartis en espace ecran : au pistolet, une cible minuscule ou deux
   * panneaux qui se chevauchent rendraient le choix injouable.
   */
  renderExits(renderer) {
    const ctx = renderer.ctx;
    const u = Math.max(0.6, Math.min(renderer.w / 1280, renderer.h / 720));
    const fs = Math.round(26 * u);
    const h = 86 * u;
    const pulse = 0.5 + 0.5 * Math.sin(this.phaseT * 6);

    const items = this.exits.map((ex) => {
      const p = ex.marker
        ? renderer.project(ex.marker.x, ex.marker.y, ex.marker.z)
        : null;
      ctx.font = `700 ${fs}px system-ui, sans-serif`;
      const tw = ctx.measureText(ex.label).width;
      return {
        ex,
        w: Math.max(230 * u, tw + 44 * u),
        px: p ? p.x : renderer.w / 2,
        py: p ? p.y : renderer.h * 0.42,
      };
    });
    items.sort((a, b) => a.px - b.px);

    const n = items.length;
    const span = renderer.w * 0.78;
    const left = renderer.w * 0.11;
    items.forEach((it, i) => {
      const slot = left + (span * (i + 0.5)) / n;
      const cx = clamp(slot * 0.72 + it.px * 0.28, it.w / 2 + 8, renderer.w - it.w / 2 - 8);
      const cy = clamp(it.py, h * 0.9, renderer.h * 0.62);
      const rect = { x: cx - it.w / 2, y: cy - h / 2, w: it.w, h, depth: 1 };
      it.ex.rect = rect;
      renderer.push(-1, (c) => {
        c.save();
        c.fillStyle = 'rgba(8,13,24,.9)';
        c.fillRect(rect.x, rect.y, rect.w, rect.h);
        c.strokeStyle = `rgba(255,${(170 + 70 * pulse) | 0},60,${0.65 + 0.35 * pulse})`;
        c.lineWidth = Math.max(2, 3 * u);
        c.strokeRect(rect.x, rect.y, rect.w, rect.h);
        c.textAlign = 'center';
        c.textBaseline = 'middle';
        c.fillStyle = '#ffd24a';
        c.font = `700 ${fs}px system-ui, sans-serif`;
        c.fillText(it.ex.label, cx, rect.y + h * 0.37);
        c.fillStyle = 'rgba(255,255,255,.72)';
        c.font = `600 ${Math.round(fs * 0.55)}px system-ui, sans-serif`;
        c.fillText('TIREZ POUR CHOISIR', cx, rect.y + h * 0.71);
        c.restore();
      });
    });
  }
}
