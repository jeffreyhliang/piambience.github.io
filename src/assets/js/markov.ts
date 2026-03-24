/**
 * Markov chain tables and transition logic for chord progressions.
 */

// ============================================================
// TYPES
// ============================================================

export type MinorNumeral = 'i' | 'ii°' | 'III' | 'iv' | 'v' | 'VI' | 'VII';
export type MajorNumeral = 'I' | 'ii' | 'iii' | 'IV' | 'V' | 'vi' | 'vii°';
export type ChordNumeral = MinorNumeral | MajorNumeral;

export type ChordQuality = 'major' | 'minor' | 'diminished';

export interface ChordInfo {
  numeral: ChordNumeral;
  root: number;          // semitones from tonic
  quality: ChordQuality;
  intervals: number[];   // semitones from root [0, 3, 7] etc.
}

interface Transition {
  target: ChordNumeral;
  weight: number;
}

// ============================================================
// CHORD DEFINITIONS
// ============================================================

// Semitone offset from tonic for each chord root
const MINOR_CHORDS: Record<MinorNumeral, ChordInfo> = {
  'i':   { numeral: 'i',   root: 0,  quality: 'minor',      intervals: [0, 3, 7] },
  'ii°': { numeral: 'ii°', root: 2,  quality: 'diminished', intervals: [0, 3, 6] },
  'III': { numeral: 'III', root: 3,  quality: 'major',      intervals: [0, 4, 7] },
  'iv':  { numeral: 'iv',  root: 5,  quality: 'minor',      intervals: [0, 3, 7] },
  'v':   { numeral: 'v',   root: 7,  quality: 'minor',      intervals: [0, 3, 7] },
  'VI':  { numeral: 'VI',  root: 8,  quality: 'major',      intervals: [0, 4, 7] },
  'VII': { numeral: 'VII', root: 10, quality: 'major',      intervals: [0, 4, 7] },
};

const MAJOR_CHORDS: Record<MajorNumeral, ChordInfo> = {
  'I':    { numeral: 'I',    root: 0,  quality: 'major',      intervals: [0, 4, 7] },
  'ii':   { numeral: 'ii',   root: 2,  quality: 'minor',      intervals: [0, 3, 7] },
  'iii':  { numeral: 'iii',  root: 4,  quality: 'minor',      intervals: [0, 3, 7] },
  'IV':   { numeral: 'IV',   root: 5,  quality: 'major',      intervals: [0, 4, 7] },
  'V':    { numeral: 'V',    root: 7,  quality: 'major',      intervals: [0, 4, 7] },
  'vi':   { numeral: 'vi',   root: 9,  quality: 'minor',      intervals: [0, 3, 7] },
  'vii°': { numeral: 'vii°', root: 11, quality: 'diminished', intervals: [0, 3, 6] },
};

// ============================================================
// TRANSITION TABLES
// ============================================================

// Minor mode: Chopin-esque progressions
// Heavy on i↔iv↔v, with VI and III for color
const MINOR_TRANSITIONS: Record<MinorNumeral, Transition[]> = {
  'i':   [{ target: 'iv',  weight: 0.30 }, { target: 'v',   weight: 0.20 },
          { target: 'VI',  weight: 0.20 }, { target: 'III', weight: 0.15 },
          { target: 'VII', weight: 0.10 }, { target: 'ii°', weight: 0.05 }],

  'ii°': [{ target: 'v',   weight: 0.40 }, { target: 'i',   weight: 0.25 },
          { target: 'VII', weight: 0.15 }, { target: 'iv',  weight: 0.10 },
          { target: 'VI',  weight: 0.10 }],

  'III': [{ target: 'VI',  weight: 0.30 }, { target: 'iv',  weight: 0.25 },
          { target: 'i',   weight: 0.15 }, { target: 'VII', weight: 0.15 },
          { target: 'v',   weight: 0.15 }],

  'iv':  [{ target: 'v',   weight: 0.30 }, { target: 'i',   weight: 0.25 },
          { target: 'VI',  weight: 0.20 }, { target: 'ii°', weight: 0.10 },
          { target: 'III', weight: 0.10 }, { target: 'VII', weight: 0.05 }],

  'v':   [{ target: 'i',   weight: 0.35 }, { target: 'VI',  weight: 0.25 },
          { target: 'iv',  weight: 0.15 }, { target: 'III', weight: 0.15 },
          { target: 'VII', weight: 0.10 }],

  'VI':  [{ target: 'III', weight: 0.25 }, { target: 'iv',  weight: 0.25 },
          { target: 'v',   weight: 0.20 }, { target: 'i',   weight: 0.15 },
          { target: 'VII', weight: 0.10 }, { target: 'ii°', weight: 0.05 }],

  'VII': [{ target: 'i',   weight: 0.30 }, { target: 'III', weight: 0.25 },
          { target: 'VI',  weight: 0.20 }, { target: 'v',   weight: 0.15 },
          { target: 'iv',  weight: 0.10 }],
};

// Major mode: common practice + pop progressions
// Strong V→I resolution, rich ii→V→I and I→vi→IV→V paths
const MAJOR_TRANSITIONS: Record<MajorNumeral, Transition[]> = {
  'I':    [{ target: 'IV',   weight: 0.25 }, { target: 'V',    weight: 0.25 },
           { target: 'vi',   weight: 0.20 }, { target: 'ii',   weight: 0.15 },
           { target: 'iii',  weight: 0.10 }, { target: 'vii°', weight: 0.05 }],

  'ii':   [{ target: 'V',    weight: 0.40 }, { target: 'vii°', weight: 0.15 },
           { target: 'IV',   weight: 0.15 }, { target: 'I',    weight: 0.15 },
           { target: 'iii',  weight: 0.10 }, { target: 'vi',   weight: 0.05 }],

  'iii':  [{ target: 'vi',   weight: 0.30 }, { target: 'IV',   weight: 0.25 },
           { target: 'ii',   weight: 0.20 }, { target: 'I',    weight: 0.15 },
           { target: 'V',    weight: 0.10 }],

  'IV':   [{ target: 'V',    weight: 0.30 }, { target: 'I',    weight: 0.25 },
           { target: 'ii',   weight: 0.15 }, { target: 'vi',   weight: 0.15 },
           { target: 'iii',  weight: 0.10 }, { target: 'vii°', weight: 0.05 }],

  'V':    [{ target: 'I',    weight: 0.40 }, { target: 'vi',   weight: 0.20 },
           { target: 'IV',   weight: 0.15 }, { target: 'iii',  weight: 0.10 },
           { target: 'ii',   weight: 0.10 }, { target: 'vii°', weight: 0.05 }],

  'vi':   [{ target: 'IV',   weight: 0.25 }, { target: 'ii',   weight: 0.25 },
           { target: 'V',    weight: 0.20 }, { target: 'iii',  weight: 0.15 },
           { target: 'I',    weight: 0.10 }, { target: 'vii°', weight: 0.05 }],

  'vii°': [{ target: 'I',    weight: 0.35 }, { target: 'iii',  weight: 0.20 },
           { target: 'vi',   weight: 0.20 }, { target: 'V',    weight: 0.15 },
           { target: 'IV',   weight: 0.10 }],
};


// ============================================================
// MOOD BIASING
// ============================================================

/**
 * Adjust transition weights based on mood.
 *
 * Arousal biases toward "active" chords:
 *   high arousal  → boost V, VII, ii°, vii° (tension/dominant chords)
 *   low arousal   → boost I/i, IV/iv, VI (restful chords)
 *
 * The valence axis selects the table (minor vs major),
 * but near the boundary (0.4–0.6) we can mix in modal borrowing.
 */

const TENSION_CHORDS = new Set<ChordNumeral>(['V', 'v', 'VII', 'vii°', 'ii°']);
const REST_CHORDS = new Set<ChordNumeral>(['I', 'i', 'IV', 'iv', 'VI', 'vi']);

function biasWeights(transitions: Transition[], arousal: number): Transition[] {
  // arousal 0→1 maps to rest→tension bias
  const tensionBoost = 1.0 + arousal * 0.8;       // up to 1.8x for tension chords
  const restBoost = 1.0 + (1.0 - arousal) * 0.8;  // up to 1.8x for rest chords

  const biased = transitions.map(t => {
    let w = t.weight;
    if (TENSION_CHORDS.has(t.target)) w *= tensionBoost;
    if (REST_CHORDS.has(t.target)) w *= restBoost;
    return { target: t.target, weight: w };
  });

  // renormalize
  const sum = biased.reduce((s, t) => s + t.weight, 0);
  return biased.map(t => ({ target: t.target, weight: t.weight / sum }));
}


// ============================================================
// CHORD ENGINE
// ============================================================

export class ChordEngine {
  private _mode: 'minor' | 'major' = 'minor';
  private _currentMinor: MinorNumeral = 'i';
  private _currentMajor: MajorNumeral = 'I';

  /** Current chord numeral */
  get current(): ChordNumeral {
    return this._mode === 'minor' ? this._currentMinor : this._currentMajor;
  }

  /** Full info about the current chord */
  get currentChord(): ChordInfo {
    return this._mode === 'minor'
      ? MINOR_CHORDS[this._currentMinor]
      : MAJOR_CHORDS[this._currentMajor];
  }

  get mode(): 'minor' | 'major' {
    return this._mode;
  }

  /**
   * Advance to the next chord.
   * @param valence  0–1, controls minor (0) vs major (1) mode
   * @param arousal  0–1, biases toward tension vs rest chords
   * @returns the new ChordInfo
   */
  next(valence: number, arousal: number): ChordInfo {
    // switch mode based on valence
    const newMode = valence < 0.45 ? 'minor' : valence > 0.55 ? 'major' : this._mode;

    // if mode changed, map to the parallel chord (e.g. iv → IV)
    if (newMode !== this._mode) {
      this._handleModeChange(newMode);
    }

    // get transitions and bias by arousal
    const table = this._mode === 'minor'
      ? MINOR_TRANSITIONS[this._currentMinor]
      : MAJOR_TRANSITIONS[this._currentMajor];

    const biased = biasWeights(table, arousal);

    // weighted random selection
    const roll = Math.random();
    let cumulative = 0;
    for (const t of biased) {
      cumulative += t.weight;
      if (roll <= cumulative) {
        if (this._mode === 'minor') {
          this._currentMinor = t.target as MinorNumeral;
        } else {
          this._currentMajor = t.target as MajorNumeral;
        }
        return this.currentChord;
      }
    }

    // fallback (shouldn't happen if weights sum to 1)
    return this.currentChord;
  }

  /**
   * Get concrete MIDI note numbers for the current chord in a given octave.
   * @param tonic  semitone value of the tonic (0=C, 7=G, etc.)
   * @param octave base octave for the chord voicing
   */
  chordNotes(tonic: number, octave: number): number[] {
    const chord = this.currentChord;
    const baseMidi = (octave + 1) * 12 + tonic + chord.root;
    return chord.intervals.map(i => baseMidi + i);
  }

  /**
   * Handle mode switch (minor ↔ major).
   * Maps the current chord to its parallel equivalent.
   */
  private _handleModeChange(newMode: 'minor' | 'major'): void {
    // rough parallel mapping by function
    const minorToMajor: Partial<Record<MinorNumeral, MajorNumeral>> = {
      'i': 'I', 'ii°': 'ii', 'III': 'iii', 'iv': 'IV',
      'v': 'V', 'VI': 'vi', 'VII': 'vii°',
    };
    const majorToMinor: Partial<Record<MajorNumeral, MinorNumeral>> = {
      'I': 'i', 'ii': 'ii°', 'iii': 'III', 'IV': 'iv',
      'V': 'v', 'vi': 'VI', 'vii°': 'VII',
    };

    if (newMode === 'major' && this._mode === 'minor') {
      this._currentMajor = minorToMajor[this._currentMinor] ?? 'I';
    } else if (newMode === 'minor' && this._mode === 'major') {
      this._currentMinor = majorToMinor[this._currentMajor] ?? 'i';
    }

    this._mode = newMode;
  }
}


// ============================================================
// CONVENIENCE: get chord info by numeral
// ============================================================

export function getChordInfo(numeral: ChordNumeral): ChordInfo | undefined {
  return (MINOR_CHORDS as Record<string, ChordInfo>)[numeral]
    ?? (MAJOR_CHORDS as Record<string, ChordInfo>)[numeral];
}

export { MINOR_CHORDS, MAJOR_CHORDS, MINOR_TRANSITIONS, MAJOR_TRANSITIONS };