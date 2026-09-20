/**
 * Entrees pensees pour la Sinden Light Gun.
 * Le pistolet se presente comme une souris en position ABSOLUE :
 *  - on lit pointermove, jamais le Pointer Lock (qui casserait la visee)
 *  - gachette         = bouton 0
 *  - tir hors ecran   = bouton 2 (clic droit) -> rechargement facon Time Crisis
 *  - bouton cachette  = bouton 1, Espace ou Maj (selon le mapping du logiciel Sinden)
 * Une manette branchee est aussi lue, pour une pedale USB vue comme gamepad.
 */
const COVER_KEYS = new Set(['Space', 'ShiftLeft', 'ShiftRight', 'KeyC']);
const RELOAD_KEYS = new Set(['KeyR']);

export class Input {
  constructor(canvas) {
    this.canvas = canvas;
    this.x = 0;
    this.y = 0;
    this.hasPointer = false;

    this.coverHeld = false;
    this._coverKey = false;
    this._coverMouse = false;
    this._coverPad = false;

    this._triggerQueued = 0;
    this._reloadQueued = 0;
    this._pauseQueued = 0;
    this._padTriggerPrev = false;
    this._padReloadPrev = false;

    this.enabled = true;
    this._bind();
  }

  _bind() {
    const rect = () => this.canvas.getBoundingClientRect();

    const move = (e) => {
      const r = rect();
      this.x = e.clientX - r.left;
      this.y = e.clientY - r.top;
      this.hasPointer = true;
    };
    window.addEventListener('pointermove', move, { passive: true });
    window.addEventListener('pointerdown', (e) => {
      move(e);
      if (!this.enabled) return;
      if (e.button === 0) this._triggerQueued++;
      else if (e.button === 2) this._reloadQueued++;
      else if (e.button === 1) this._coverMouse = true;
    });
    window.addEventListener('pointerup', (e) => {
      if (e.button === 1) this._coverMouse = false;
    });
    // Indispensable : le tir hors ecran de la Sinden envoie un clic droit.
    window.addEventListener('contextmenu', (e) => e.preventDefault());
    window.addEventListener('dragstart', (e) => e.preventDefault());

    window.addEventListener('keydown', (e) => {
      if (e.repeat) return;
      if (COVER_KEYS.has(e.code)) {
        this._coverKey = true;
        e.preventDefault();
      } else if (RELOAD_KEYS.has(e.code)) {
        this._reloadQueued++;
      } else if (e.code === 'Escape') {
        this._pauseQueued++;
      } else if (e.code === 'Enter') {
        this._triggerQueued++;
      }
    });
    window.addEventListener('keyup', (e) => {
      if (COVER_KEYS.has(e.code)) this._coverKey = false;
    });
    window.addEventListener('blur', () => {
      this._coverKey = false;
      this._coverMouse = false;
    });
  }

  pollGamepad() {
    if (!navigator.getGamepads) return;
    const pads = navigator.getGamepads();
    let trigger = false,
      reload = false,
      cover = false;
    for (const p of pads) {
      if (!p || !p.buttons) continue;
      if (p.buttons[0] && p.buttons[0].pressed) trigger = true;
      if (p.buttons[1] && p.buttons[1].pressed) cover = true;
      if (p.buttons[2] && p.buttons[2].pressed) reload = true;
      if (p.buttons[7] && p.buttons[7].pressed) trigger = true;
      if (p.buttons[6] && p.buttons[6].pressed) cover = true;
    }
    if (trigger && !this._padTriggerPrev && this.enabled) this._triggerQueued++;
    if (reload && !this._padReloadPrev && this.enabled) this._reloadQueued++;
    this._padTriggerPrev = trigger;
    this._padReloadPrev = reload;
    this._coverPad = cover;
  }

  beginFrame() {
    this.pollGamepad();
    this.coverHeld = this._coverKey || this._coverMouse || this._coverPad;
  }

  /** Consomme un appui : renvoie true une seule fois par appui. */
  takeTrigger() {
    if (this._triggerQueued > 0) {
      this._triggerQueued--;
      return true;
    }
    return false;
  }

  takeReload() {
    if (this._reloadQueued > 0) {
      this._reloadQueued--;
      return true;
    }
    return false;
  }

  takePause() {
    if (this._pauseQueued > 0) {
      this._pauseQueued--;
      return true;
    }
    return false;
  }

  clearQueued() {
    this._triggerQueued = 0;
    this._reloadQueued = 0;
    this._pauseQueued = 0;
  }
}
