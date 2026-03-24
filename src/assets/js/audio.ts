/**
 * Audio engine — synth and effects configuration.
 * Tone.js is loaded as a global via <script> tag.
 */

declare const Tone: any;

const reverb = new Tone.Reverb({ decay: 3.5, wet: 0.4 }).toDestination();

export const synth = new Tone.PolySynth(Tone.Synth, {
  oscillator: { type: 'fatsine2', spread: 12 },
  envelope: {
    attack: 0.005,
    decay: 0.6,
    sustain: 0.02,
    release: 2.5,
  },
  volume: 5,
}).connect(reverb);

export async function startAudio(): Promise<void> {
  await Tone.start();
}