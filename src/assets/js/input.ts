/**
 * Input handlers — mouse and touch events.
 */

import { updateTarget } from './mood.js';

export function initInput(): void {
  window.addEventListener('mousemove', (e: MouseEvent) => {
    updateTarget(e.clientX, e.clientY);
  });

  window.addEventListener('touchmove', (e: TouchEvent) => {
    e.preventDefault();
    updateTarget(e.touches[0].clientX, e.touches[0].clientY);
  }, { passive: false });

  window.addEventListener('touchstart', (e: TouchEvent) => {
    updateTarget(e.touches[0].clientX, e.touches[0].clientY);
  });
}