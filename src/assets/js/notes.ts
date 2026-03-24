/**
 * Note selection — scales and picking logic.
 * This module will eventually house the Markov chain engine.
 */

const SCALES = {
  minor: ['C3','Eb3','F3','G3','Bb3','C4','Eb4','F4','G4','Bb4','C5'],
  major: ['B3','C3','D3','E3','G3','A3','B4','C4','D4','E4','G4','A4','B5','C5'],
} as const;

type ScaleKey = keyof typeof SCALES;

export function pickNotes(valence: number, _arousal: number): string[] {
  const key: ScaleKey = valence < 0.5 ? 'minor' : 'major';
  const candidates = SCALES[key];
  const numNotes = Math.floor(Math.random() * candidates.length);
  const idx = new Array(numNotes)
    .fill(0)
    .map(() => Math.floor(Math.random() * candidates.length));
  return idx.map(i => candidates[i]);
}