/**
 * Note generation — orchestrates chord engine, melody, bass, arpeggios.
 * Tick-driven: external clock calls tickChord / tickMelody / tickBass.
 */

import { ChordEngine } from './markov.js';
import type { ChordInfo } from './markov.js';

// ============================================================
// NOTE UTILITIES
// ============================================================

const CHROMATIC = ['C','Db','D','Eb','E','F','Gb','G','Ab','A','Bb','B'] as const;

const ROOT_OFFSETS: Record<string, number> = {
  'C': 0, 'Db': 1, 'D': 2, 'Eb': 3, 'E': 4, 'F': 5,
  'Gb': 6, 'G': 7, 'Ab': 8, 'A': 9, 'Bb': 10, 'B': 11,
  'C#': 1, 'D#': 3, 'F#': 6, 'G#': 8, 'A#': 10,
};

const SCALE_INTERVALS = {
  major:         [0, 2, 4, 5, 7, 9, 11],
  natural_minor: [0, 2, 3, 5, 7, 8, 10],
} as const;

export function noteToMidi(note: string): number {
  const match = note.match(/^([A-Ga-g][b#]?)(\d+)$/);
  if (!match) return 60;
  const [, name, octStr] = match;
  const key = name.charAt(0).toUpperCase() + name.slice(1);
  return (parseInt(octStr) + 1) * 12 + (ROOT_OFFSETS[key] ?? 0);
}

export function midiToNote(midi: number): string {
  const octave = Math.floor(midi / 12) - 1;
  return `${CHROMATIC[midi % 12]}${octave}`;
}

function getScaleMidi(tonic: number, mode: 'major' | 'minor'): number[] {
  const intervals = mode === 'major'
    ? SCALE_INTERVALS.major
    : SCALE_INTERVALS.natural_minor;
  const notes: number[] = [];
  for (let midi = 36; midi <= 96; midi++) {
    const degree = (midi - tonic + 120) % 12;
    if ((intervals as readonly number[]).includes(degree)) {
      notes.push(midi);
    }
  }
  return notes;
}


// ============================================================
// ARPEGGIO / BASS PATTERNS
// ============================================================

export type PatternStyle = 'whole' | 'fifth' | 'alberti' | 'ascending' | 'descending' | 'broken';

interface Pattern {
  /** Returns chord-tone indices for each step in the pattern */
  steps: number[][];
  /** How many transport subdivisions this pattern spans */
  length: number;
}

/**
 * Generate a bass/arpeggio pattern from chord tones.
 * Each step is an array of indices into the chord voicing.
 */
function buildPattern(style: PatternStyle): Pattern {
  switch (style) {
    case 'whole':
      // single root, held for full bar
      return { steps: [[0]], length: 1 };

    case 'fifth':
      // root then fifth, half notes
      return { steps: [[0], [2]], length: 2 };

    case 'alberti':
      // classic: root, fifth, third, fifth (repeating 8ths)
      return { steps: [[0], [2], [1], [2], [0], [2], [1], [2]], length: 8 };

    case 'ascending':
      // sweep up through chord tones
      return { steps: [[0], [1], [2], [3]], length: 4 };

    case 'descending':
      // sweep down
      return { steps: [[3], [2], [1], [0]], length: 4 };

    case 'broken':
      // root, fifth, third, octave — open voicing feel
      return { steps: [[0], [2], [1], [3], [0], [2], [1], [3]], length: 8 };
  }
}

/** Choose a pattern style based on arousal */
function choosePatternStyle(arousal: number): PatternStyle {
  if (arousal < 0.2) return 'whole';
  if (arousal < 0.35) return 'fifth';
  if (arousal < 0.5) return 'ascending';
  if (arousal < 0.65) return 'alberti';
  if (arousal < 0.8) return 'broken';
  // high energy: mix of ascending and broken
  return Math.random() < 0.5 ? 'broken' : 'descending';
}


// ============================================================
// MELODY STATE
// ============================================================

let lastMelodyMidi: number = 67; // G4


// ============================================================
// MELODY PICKER — intervals, harmony, grace notes
// ============================================================

type IntervalType = 'single' | 'third_above' | 'third_below' | 'sixth_above' | 'octave';

/**
 * Choose what kind of interval to add based on arousal.
 */
function chooseIntervalType(arousal: number): IntervalType {
  const roll = Math.random();

  if (arousal < 0.3) {
    // calm: mostly single notes, rare open intervals
    if (roll < 0.88) return 'single';
    if (roll < 0.95) return 'sixth_above';
    return 'octave';
  } else if (arousal < 0.6) {
    // moderate: some thirds
    if (roll < 0.65) return 'single';
    if (roll < 0.80) return 'third_above';
    if (roll < 0.88) return 'third_below';
    if (roll < 0.95) return 'sixth_above';
    return 'octave';
  } else {
    // energetic: frequent intervals
    if (roll < 0.45) return 'single';
    if (roll < 0.62) return 'third_above';
    if (roll < 0.75) return 'third_below';
    if (roll < 0.87) return 'sixth_above';
    return 'octave';
  }
}

/**
 * Given a primary MIDI note, find the best harmony note of the given interval
 * that stays within the current scale.
 */
function findHarmonyNote(
  primary: number,
  intervalType: IntervalType,
  scaleMidi: number[],
): number | null {
  if (intervalType === 'single') return null;

  // target intervals in semitones
  const targets: Record<Exclude<IntervalType, 'single'>, number[]> = {
    'third_above':  [3, 4],       // minor or major third up
    'third_below':  [-3, -4],     // minor or major third down
    'sixth_above':  [8, 9],       // minor or major sixth up
    'octave':       [12],         // octave up
  };

  const offsets = targets[intervalType];

  // try each target offset, prefer ones that land on a scale tone
  for (const offset of offsets) {
    const candidate = primary + offset;
    if (candidate >= 48 && candidate <= 96 && scaleMidi.includes(candidate)) {
      return candidate;
    }
  }

  // fallback: try the other option even if not in scale
  for (const offset of offsets) {
    const candidate = primary + offset;
    if (candidate >= 48 && candidate <= 96) {
      return candidate;
    }
  }

  return null;
}

/**
 * Decide whether to add a chromatic grace note (half step approach).
 * More likely at moderate arousal (expressive), less at extremes.
 */
function maybeGraceNote(
  primary: number,
  arousal: number,
): number | null {
  // grace notes are most expressive in the mid-arousal range
  const chance = arousal < 0.2 ? 0.03
    : arousal < 0.4 ? 0.12
    : arousal < 0.7 ? 0.15
    : 0.08;

  if (Math.random() > chance) return null;

  // approach from half step below or above (both chromatic)
  const direction = Math.random() < 0.7 ? -1 : 1; // mostly from below
  const grace = primary + direction;

  if (grace >= 48 && grace <= 96) return grace;
  return null;
}

/**
 * Pick primary melody note using weighted stepwise motion.
 */
function pickPrimaryNote(
  chordTonesMidi: number[],
  scaleMidi: number[],
  arousal: number,
): number {
  const range = arousal > 0.6 ? 7 : 4;
  const candidates = scaleMidi.filter(
    m => Math.abs(m - lastMelodyMidi) <= range && m >= 60 && m <= 84
  );

  if (candidates.length === 0) {
    const fallback = chordTonesMidi.filter(m => m >= 60 && m <= 84);
    if (fallback.length > 0) {
      lastMelodyMidi = fallback[Math.floor(Math.random() * fallback.length)];
    }
    return lastMelodyMidi;
  }

  const weights = candidates.map(m => {
    let w = 1.0;
    const dist = Math.abs(m - lastMelodyMidi);
    if (dist <= 2) w *= 4.0;
    else if (dist <= 4) w *= 2.0;
    else w *= 0.5;

    const degree = (m + 120) % 12;
    const isChordTone = chordTonesMidi.some(ct => (ct + 120) % 12 === degree);
    if (isChordTone) w *= 2.5;

    return w;
  });

  const sum = weights.reduce((s, w) => s + w, 0);
  let roll = Math.random() * sum;
  for (let i = 0; i < candidates.length; i++) {
    roll -= weights[i];
    if (roll <= 0) {
      lastMelodyMidi = candidates[i];
      return lastMelodyMidi;
    }
  }

  lastMelodyMidi = candidates[0];
  return lastMelodyMidi;
}

/**
 * Full melody pick: primary note + possible harmony interval + possible grace note.
 */
function pickMelodyNotes(
  chordTonesMidi: number[],
  scaleMidi: number[],
  arousal: number,
): { notes: number[]; graceNote: number | null } {
  const primary = pickPrimaryNote(chordTonesMidi, scaleMidi, arousal);

  // interval harmony
  const intervalType = chooseIntervalType(arousal);
  const harmony = findHarmonyNote(primary, intervalType, scaleMidi);
  const notes = harmony ? [primary, harmony] : [primary];

  // grace note (chromatic approach)
  const grace = maybeGraceNote(primary, arousal);

  return { notes, graceNote: grace };
}


// ============================================================
// DYNAMICS
// ============================================================

let noteInPhrase: number = 0;
let phraseLength: number = 4 + Math.floor(Math.random() * 5);
let barCount: number = 0;
const ENVELOPE_PERIOD = 12;

function computeVelocity(valence: number, arousal: number): number {
  const envelopePhase = (barCount / ENVELOPE_PERIOD) * Math.PI * 2;
  const slowBreath = 0.3 + 0.15 * Math.sin(envelopePhase);

  const phrasePos = noteInPhrase / phraseLength;
  const phraseArc = Math.sin(phrasePos * Math.PI);

  let velocity = slowBreath * (0.7 + 0.3 * phraseArc);
  velocity *= 0.6 + arousal * 0.5;
  velocity *= 0.85 + valence * 0.15;

  noteInPhrase++;
  if (noteInPhrase >= phraseLength) {
    noteInPhrase = 0;
    phraseLength = 4 + Math.floor(Math.random() * 5);
  }

  return Math.max(0.08, Math.min(0.95, velocity));
}


// ============================================================
// NOTE ENGINE — tick-driven public API
// ============================================================

const TONIC = 0; // C
const chordEngine = new ChordEngine();

// current chord state (updated once per bar)
let currentChord: ChordInfo = chordEngine.currentChord;
let chordTonesMidi: number[] = [];
let scaleMidi: number[] = [];

// bass pattern state
let currentPattern: Pattern = buildPattern('whole');
let bassStep: number = 0;

// bass voicing: chord tones in bass register (C2–C4)
let bassVoicing: number[] = [];

function rebuildChordState(): void {
  const chordRoot = TONIC + currentChord.root;

  // chord tones across full range (for melody weighting)
  chordTonesMidi = [];
  for (let oct = 2; oct <= 5; oct++) {
    const base = (oct + 1) * 12 + chordRoot;
    currentChord.intervals.forEach(i => chordTonesMidi.push(base + i));
  }

  // bass voicing: root position in octave 2–3
  bassVoicing = [];
  for (let oct = 2; oct <= 3; oct++) {
    const base = (oct + 1) * 12 + chordRoot;
    currentChord.intervals.forEach(i => {
      const midi = base + i;
      if (midi >= 36 && midi <= 60) bassVoicing.push(midi);
    });
  }
  // add octave above root for patterns that reference index 3
  if (bassVoicing.length > 0) {
    bassVoicing.push(bassVoicing[0] + 12);
  }

  scaleMidi = getScaleMidi(TONIC, chordEngine.mode);
}

// initialize
rebuildChordState();


/** Emitted by tick functions so the caller knows what to play */
export interface NoteEvent {
  notes: string[];       // note names (simultaneous)
  velocity: number;      // 0–1
  duration: string;      // Tone.js duration string
  graceNote?: string;    // optional: played slightly before the main notes
}

/**
 * Call once per bar (or every N beats for faster harmonic rhythm).
 * Advances the chord and rebuilds voicings.
 */
export function tickChord(valence: number, arousal: number): void {
  currentChord = chordEngine.next(valence, arousal);
  barCount++;
  rebuildChordState();

  // pick new bass pattern based on current arousal
  const style = choosePatternStyle(arousal);
  currentPattern = buildPattern(style);
  bassStep = 0;
}

/**
 * Call on each melody subdivision (e.g. every 8th note).
 * Returns a single melody note event, or null for a rest.
 */
export function tickMelody(valence: number, arousal: number): NoteEvent | null {
  // occasional rests make it breathe — more rests when calm
  const restChance = arousal < 0.3 ? 0.4 : arousal < 0.6 ? 0.2 : 0.08;
  if (Math.random() < restChance) return null;

  const { notes: midiNotes, graceNote } = pickMelodyNotes(chordTonesMidi, scaleMidi, arousal);
  const velocity = computeVelocity(valence, arousal);

  // duration varies with arousal
  let duration: string;
  if (arousal < 0.3) {
    duration = Math.random() < 0.6 ? '4n' : '2n';
  } else if (arousal < 0.6) {
    duration = Math.random() < 0.5 ? '8n' : '4n';
  } else {
    duration = Math.random() < 0.6 ? '8n' : '16n';
  }

  return {
    notes: midiNotes.map(midiToNote),
    velocity,
    duration,
    graceNote: graceNote ? midiToNote(graceNote) : undefined,
  };
}

/**
 * Call on each bass subdivision (e.g. every 8th note).
 * Steps through the current arpeggio/bass pattern.
 * Returns a note event, or null if the pattern doesn't have a note on this step.
 */
export function tickBass(valence: number, arousal: number): NoteEvent | null {
  if (bassVoicing.length === 0) return null;

  // get current step in pattern
  const stepIdx = bassStep % currentPattern.length;
  const chordIndices = currentPattern.steps[stepIdx];
  bassStep++;

  if (!chordIndices || chordIndices.length === 0) return null;

  // map pattern indices to actual MIDI notes
  const notes = chordIndices
    .map(idx => bassVoicing[Math.min(idx, bassVoicing.length - 1)])
    .filter((m): m is number => m !== undefined)
    .map(midiToNote);

  if (notes.length === 0) return null;

  const velocity = computeVelocity(valence, arousal) * 0.7; // bass sits back

  // bass duration: longer notes when calm
  let duration: string;
  if (arousal < 0.3) {
    duration = '2n';
  } else if (arousal < 0.5) {
    duration = '4n';
  } else {
    duration = '8n';
  }

  return {
    notes,
    velocity,
    duration,
  };
}

/**
 * Get current chord name for debug/display.
 */
export function getCurrentChord(): string {
  return chordEngine.current;
}