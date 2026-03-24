/**
 * Mood state — shared smooth values that audio and visuals read from.
 */

let targetX = 0.5;
let targetY = 0.35;
let smoothX = 0.5;
let smoothY = 0.35;

const EASE = 0.03;

export function getSmooth(): { x: number; y: number } {
  return { x: smoothX, y: smoothY };
}

export function updateTarget(clientX: number, clientY: number): void {
  targetX = clientX / window.innerWidth;
  targetY = 1.0 - clientY / window.innerHeight;
}

export function tickSmoothing(): void {
  smoothX += (targetX - smoothX) * EASE;
  smoothY += (targetY - smoothY) * EASE;
}

export function getMoodLabel(v: number, a: number): string {
  if (v > 0.6 && a > 0.6) return 'euphoric';
  if (v > 0.6 && a < 0.4) return 'serene';
  if (v < 0.4 && a > 0.6) return 'intense';
  if (v < 0.4 && a < 0.4) return 'melancholic';
  if (v > 0.55 && a > 0.45 && a < 0.6) return 'hopeful';
  if (v < 0.45 && a > 0.4 && a < 0.6) return 'contemplative';
  if (a < 0.3) return 'dreamy';
  if (a > 0.7) return 'restless';
  return 'reflective';
}