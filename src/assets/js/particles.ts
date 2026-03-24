/**
 * Particle system — visual note feedback.
 */

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  fadeIn: number;
  fadingIn: boolean;
  decay: number;
  size: number;
  hue: number;
  sat: number;
  light: number;
}

const particles: Particle[] = [];
const MAX_PARTICLES = 200;

export function spawnNoteParticle(
  _note: string,
  velocity: number,
  valence: number,
): void {
  if (particles.length >= MAX_PARTICLES) particles.shift();

  const x = 0.05 + Math.random() * 0.9;
  const y = 0.05 + Math.random() * 0.9;

  const hue = valence * 40 + (1 - valence) * 220;
  const sat = 40 + Math.random() * 30;
  const light = 55 + velocity * 25 + Math.random() * 15;

  particles.push({
    x, y,
    vx: (Math.random() - 0.5) * 0.0008,
    vy: (Math.random() - 0.5) * 0.0008,
    life: 0.0,
    fadeIn: 0.015 + Math.random() * 0.01,
    fadingIn: true,
    decay: 0.002 + Math.random() * 0.003,
    size: 3 + velocity * 5 + Math.random() * 3,
    hue, sat, light,
  });
}

export function updateAndDrawParticles(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
): void {
  for (let i = particles.length - 1; i >= 0; i--) {
    const p = particles[i];
    p.x += p.vx;
    p.y += p.vy;

    if (p.fadingIn) {
      p.life += p.fadeIn;
      if (p.life >= 1.0) {
        p.life = 1.0;
        p.fadingIn = false;
      }
    } else {
      p.life -= p.decay;
    }

    if (p.life <= 0) {
      particles.splice(i, 1);
      continue;
    }

    const alpha = p.life * p.life;
    const px = p.x * w;
    const py = p.y * h;
    const r = p.size * (0.6 + p.life * 0.4);

    const grad = ctx.createRadialGradient(px, py, 0, px, py, r * 4);
    grad.addColorStop(0, `hsla(${p.hue}, ${p.sat}%, ${p.light}%, ${alpha * 0.8})`);
    grad.addColorStop(0.2, `hsla(${p.hue}, ${p.sat}%, ${p.light}%, ${alpha * 0.35})`);
    grad.addColorStop(1, `hsla(${p.hue}, ${p.sat}%, ${p.light}%, 0)`);

    ctx.beginPath();
    ctx.fillStyle = grad;
    ctx.arc(px, py, r * 4, 0, Math.PI * 2);
    ctx.fill();
  }
}