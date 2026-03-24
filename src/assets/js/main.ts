/**
 * Main — orchestrator. Transport-driven clock for musical timing.
 */

declare const Tone: any;

import { synth, startAudio } from './audio.js';
import { getSmooth, tickSmoothing, getMoodLabel } from './mood.js';
import { tickChord, tickMelody, tickBass } from './notes.js';
import type { NoteEvent } from './notes.js';
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


// ---- Transport setup ----

// Nocturne tempo: slow and expressive
Tone.Transport.bpm.value = 66;

// Time signature: 4/4
Tone.Transport.timeSignature = 4;

/**
 * Play a NoteEvent through the synth and spawn particles.
 * Handles grace notes by scheduling them slightly before the main notes.
 */
function playEvent(event: NoteEvent | null, time: number, valence: number): void {
  if (!event) return;

  // grace note: quick, soft, just before the main note
  if (event.graceNote) {
    const graceTime = time - 0.06; // ~60ms before
    if (graceTime > 0) {
      synth.triggerAttackRelease(event.graceNote, '32n', graceTime, event.velocity * 0.5);
      spawnNoteParticle(event.graceNote, event.velocity * 0.4, valence);
    }
  }

  synth.triggerAttackRelease(event.notes, event.duration, time, event.velocity);
  event.notes.forEach(note => spawnNoteParticle(note, event.velocity, valence));
}

/**
 * Schedule all musical events on the Transport.
 *
 * Bar structure (4/4 at ~66 bpm):
 *   - Chord advances every bar (beat 0)
 *   - Bass pattern ticks every 8th note
 *   - Melody ticks every 8th note (offset slightly for feel)
 */

// Chord: once per bar
Tone.Transport.scheduleRepeat((time: number) => {
  const { x: valence, y: arousal } = getSmooth();
  tickChord(valence, arousal);
}, '1m');

// Bass: every 8th note
Tone.Transport.scheduleRepeat((time: number) => {
  const { x: valence, y: arousal } = getSmooth();
  const event = tickBass(valence, arousal);
  playEvent(event, time, valence);
}, '8n');

// Melody: every 8th note, offset by a 16th for slight stagger
// This prevents melody and bass from hitting at exactly the same instant,
// which sounds more natural — like two hands playing independently.
Tone.Transport.scheduleRepeat((time: number) => {
  const { x: valence, y: arousal } = getSmooth();
  const event = tickMelody(valence, arousal);
  playEvent(event, time, valence);
}, '8n', '16n');


// ---- Click to start ----

let started = false;

window.addEventListener('click', async () => {
  if (started) return;
  await startAudio();
  Tone.Transport.start();
  started = true;
}, { once: true });


// ---- Render loop (visuals only, no audio logic) ----

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