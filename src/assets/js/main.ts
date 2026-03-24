/**
 * Main — orchestrator. Wires all modules together.
 */

import { synth, startAudio } from './audio.js';
import { getSmooth, tickSmoothing, getMoodLabel } from './mood.js';
import { pickNotes } from './notes.js';
import { spawnNoteParticle, updateAndDrawParticles } from './particles.js';
import { initInput } from './input.js';
import { initWebGL } from './shader.js';

// ---- DOM elements ----

const glCanvas = document.getElementById('c') as HTMLCanvasElement;
const pCanvas = document.getElementById('particles') as HTMLCanvasElement;
const pCtx = pCanvas.getContext('2d')!;
const labelEl = document.getElementById('mood-label')!;

// ---- Init ----

const shader = initWebGL(glCanvas);
initInput();

function resizeParticleCanvas() {
  pCanvas.width = window.innerWidth;
  pCanvas.height = window.innerHeight;
}
window.addEventListener('resize', resizeParticleCanvas);
resizeParticleCanvas();

// ---- Generative playback loop ----

let started = false;

function playNext(): void {
  if (!started) return;

  const { x: valence, y: arousal } = getSmooth();
  const notes = pickNotes(valence, arousal);
  const velocity = 0.15 + valence * 0.25;

  synth.triggerAttackRelease(notes, '1n', undefined, velocity);
  notes.forEach((note: string) => spawnNoteParticle(note, velocity, valence));

  const interval = (0.2 + (1.0 - arousal) * 0.8) / 2;
  setTimeout(playNext, interval * 1000);
}

window.addEventListener('click', async () => {
  if (started) return;
  await startAudio();
  started = true;
  playNext();
}, { once: true });

// ---- Render loop ----

const startTime = Date.now();

function frame(): void {
  tickSmoothing();

  const { x, y } = getSmooth();
  const elapsed = (Date.now() - startTime) / 1000;

  shader.render(elapsed, x, y);

  pCtx.clearRect(0, 0, pCanvas.width, pCanvas.height);
  updateAndDrawParticles(pCtx, pCanvas.width, pCanvas.height);

  labelEl.textContent = getMoodLabel(x, y);
  requestAnimationFrame(frame);
}
frame();