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

    // Journal de diagnostic : sert a decouvrir sur quoi le logiciel Sinden
    // a mappe chaque bouton du pistolet.
    this.heldButtons = new Set();
    this.heldKeys = new Set();
    this.padButtons = [];
    this.log = [];
    this._debugQueued = 0;

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
      this.heldButtons.add(e.button);
      this.note('souris ' + e.button);
      if (!this.enabled) return;
      if (e.button === 0) this._triggerQueued++;
      else if (e.button === 2) this._reloadQueued++;
      else if (e.button === 1) this._coverMouse = true;
    });
    window.addEventListener('pointerup', (e) => {
      this.heldButtons.delete(e.button);
      if (e.button === 1) this._coverMouse = false;
    });
    // Le bouton du milieu declenche le defilement automatique du navigateur,
    // qui capture ensuite les clics gauches : la detente semble morte tant que
    // le bouton de cachette est maintenu. On le neutralise sur mousedown, seul
    // endroit ou le navigateur accepte de l'annuler.
    window.addEventListener(
      'mousedown',
      (e) => {
        if (e.button === 1 || e.button === 2) e.preventDefault();
      },
      { capture: true }
    );
    window.addEventListener('auxclick', (e) => e.preventDefault());
    // Indispensable : le tir hors ecran de la Sinden envoie un clic droit.
    window.addEventListener('contextmenu', (e) => e.preventDefault());
    window.addEventListener('dragstart', (e) => e.preventDefault());

    window.addEventListener('keydown', (e) => {
      if (e.repeat) return;
      this.heldKeys.add(e.code);
      this.note('touche ' + e.code);
      if (e.code === 'F1' || e.code === 'KeyI') {
        this._debugQueued++;
        e.preventDefault();
        return;
      }
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
      this.heldKeys.delete(e.code);
      if (COVER_KEYS.has(e.code)) this._coverKey = false;
    });
    window.addEventListener('blur', () => {
      this._coverKey = false;
      this._coverMouse = false;
      this.heldKeys.clear();
      this.heldButtons.clear();
    });
  }

  /** Retient le dernier appui de chaque source, pour l'ecran de diagnostic. */
  note(label) {
    if (this.log[0] === label) return;
    this.log.unshift(label);
    if (this.log.length > 6) this.log.pop();
  }

  pollGamepad() {
    if (!navigator.getGamepads) return;
    const pads = navigator.getGamepads();
    let trigger = false,
      reload = false,
      cover = false;
    this.padButtons.length = 0;
    for (const p of pads) {
      if (!p || !p.buttons) continue;
      for (let i = 0; i < p.buttons.length; i++) {
        if (p.buttons[i].pressed) {
          this.padButtons.push(i);
          this.note('manette ' + i);
        }
      }
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

  takeDebug() {
    if (this._debugQueued > 0) {
      this._debugQueued--;
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
