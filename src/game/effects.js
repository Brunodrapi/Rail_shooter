/** Effets en espace ecran : impacts, textes de score, impacts de balles. */
export class Effects {
  constructor() {
    this.list = [];
  }

  reset() {
    this.list.length = 0;
  }

  spark(x, y, size = 1, color = '#ffd24a') {
    this.list.push({ type: 'spark', x, y, t: 0, life: 0.34, size, color });
  }

  ring(x, y, size = 1, color = '#ff5a3c') {
    this.list.push({ type: 'ring', x, y, t: 0, life: 0.45, size, color });
  }

  text(x, y, label, color = '#ffd24a', size = 20) {
    this.list.push({ type: 'text', x, y, t: 0, life: 0.9, label, color, size });
  }

  update(dt) {
    for (let i = this.list.length - 1; i >= 0; i--) {
      const f = this.list[i];
      f.t += dt;
      if (f.t >= f.life) this.list.splice(i, 1);
    }
  }

  render(ctx) {
    for (const f of this.list) {
      const k = f.t / f.life;
      ctx.save();
      if (f.type === 'spark') {
        ctx.globalAlpha = 1 - k;
        const r = f.size * (6 + 26 * k);
        const g = ctx.createRadialGradient(f.x, f.y, 0, f.x, f.y, r);
        g.addColorStop(0, '#ffffff');
        g.addColorStop(0.4, f.color);
        g.addColorStop(1, 'rgba(255,120,0,0)');
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(f.x, f.y, r, 0, Math.PI * 2);
        ctx.fill();
      } else if (f.type === 'ring') {
        ctx.globalAlpha = 1 - k;
        ctx.strokeStyle = f.color;
        ctx.lineWidth = 3 * (1 - k) + 1;
        ctx.beginPath();
        ctx.arc(f.x, f.y, f.size * (10 + 60 * k), 0, Math.PI * 2);
        ctx.stroke();
      } else if (f.type === 'text') {
        ctx.globalAlpha = 1 - k * k;
        ctx.font = `700 ${f.size}px system-ui, sans-serif`;
        ctx.textAlign = 'center';
        ctx.lineWidth = 4;
        ctx.strokeStyle = 'rgba(0,0,0,.75)';
        ctx.strokeText(f.label, f.x, f.y - 46 * k);
        ctx.fillStyle = f.color;
        ctx.fillText(f.label, f.x, f.y - 46 * k);
      }
      ctx.restore();
    }
  }
}
