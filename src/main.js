import { Renderer } from './core/renderer.js';
import { Input } from './core/input.js';
import { SoundBank } from './core/audio.js';
import { Game, STATE } from './game/game.js';

const canvas = document.getElementById('game');
const renderer = new Renderer(canvas);
const input = new Input(canvas);
const audio = new SoundBank();
const game = new Game(renderer, input, audio);

const el = (id) => document.getElementById(id);
const overlay = el('overlay');
const pauseScreen = el('pause');
const resultScreen = el('result');

const TOGGLE_KEY = 'railshooter.pedalToggle';
const chkToggle = el('chk-toggle');
chkToggle.checked = localStorage.getItem(TOGGLE_KEY) === '1';
game.pedalToggle = chkToggle.checked;
chkToggle.addEventListener('change', () => {
  game.pedalToggle = chkToggle.checked;
  localStorage.setItem(TOGGLE_KEY, chkToggle.checked ? '1' : '0');
});

/* ------------------------------------------------------------------ */
function resize() {
  renderer.resize();
}
window.addEventListener('resize', resize);
window.addEventListener('orientationchange', resize);
document.addEventListener('fullscreenchange', () => setTimeout(resize, 60));

function show(screen) {
  for (const s of [overlay, pauseScreen, resultScreen])
    s.classList.toggle('hidden', s !== screen);
  document.body.classList.toggle('playing', screen === null);
  input.enabled = screen === null;
  if (screen === null) input.clearQueued();
}

async function goFullscreen() {
  if (!el('chk-fs').checked) return;
  try {
    if (!document.fullscreenElement) await document.documentElement.requestFullscreen();
  } catch (err) {
    console.warn('Plein écran refusé :', err && err.message);
  }
}

async function startGame() {
  audio.unlock();
  await goFullscreen();
  resize();
  game.start();
  show(null);
}

el('btn-start').addEventListener('click', startGame);
el('btn-again').addEventListener('click', startGame);
el('btn-resume').addEventListener('click', () => {
  game.setState(STATE.PLAYING);
  show(null);
});
el('btn-quit').addEventListener('click', () => {
  game.setState(STATE.MENU);
  show(overlay);
});

game.onStateChange = (s) => {
  if (s === STATE.PAUSED) show(pauseScreen);
  else if (s === STATE.OVER || s === STATE.WIN) {
    const st = game.stats();
    el('result-title').textContent =
      s === STATE.WIN
        ? 'OTAGES LIBÉRÉS'
        : st.reason === 'time'
        ? 'TEMPS ÉCOULÉ'
        : 'MISSION ÉCHOUÉE';
    el('result-score').textContent =
      `Score ${st.score} · Précision ${st.accuracy}% · Meilleur combo ×${st.bestCombo}` +
      (st.hostages ? ` · Otages touchés ${st.hostages}` : '');
    el('result-path').textContent = 'Itinéraire : ' + st.path.join(' → ');
    show(resultScreen);
  } else if (s === STATE.PLAYING) show(null);
};

/* ------------------------------------------------------------------ */
const STEP = 1 / 60;
let last = performance.now();
let acc = 0;

function frame(now) {
  let dt = (now - last) / 1000;
  last = now;
  if (dt > 0.25) dt = 0.25;
  acc += dt;
  input.beginFrame();
  if (input.takeDebug()) game.debug = !game.debug;
  let guard = 0;
  while (acc >= STEP && guard++ < 6) {
    game.update(STEP);
    acc -= STEP;
  }
  if (acc > STEP) acc = 0;
  game.render();
  requestAnimationFrame(frame);
}

resize();
show(overlay);
requestAnimationFrame(frame);

// Utile pour deboguer depuis la console du navigateur.
window.__game = game;
