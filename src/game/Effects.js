import { NEON } from './palette.js';

const MAX_PARTICLES = 170;

// Lightweight, short-lived particles. Counts are capped and reduced when the
// player prefers reduced motion; nothing here ever touches gameplay.
export class Effects {
  constructor() {
    this.particles = [];
    this.time = 0;
    this.reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  }

  clear() {
    this.particles = [];
  }

  add(particle) {
    if (this.particles.length >= MAX_PARTICLES) {
      this.particles.shift();
    }
    this.particles.push({
      vx: 0, vy: 0, gravity: 0, size: 4, life: 0.5, kind: 'dust',
      sway: 0, phase: Math.random() * 6.28, speed: 0, radius: 0,
      ...particle,
    });
    this.particles[this.particles.length - 1].maxLife = particle.life ?? 0.5;
  }

  burst(count, factory) {
    const total = this.reducedMotion ? Math.ceil(count / 2) : count;
    for (let index = 0; index < total; index += 1) {
      this.add(factory(index, total));
    }
  }

  landing(x, y) {
    this.burst(12, () => {
      const direction = Math.random() < 0.5 ? -1 : 1;
      return {
        x: x + (Math.random() - 0.5) * 20, y: y - 4,
        vx: direction * (50 + Math.random() * 120),
        vy: -(40 + Math.random() * 120), gravity: 460,
        size: Math.random() < 0.5 ? 4 : 6, life: 0.4 + Math.random() * 0.2,
        color: [NEON.lavender, '#8E6FD6', NEON.white][Math.floor(Math.random() * 3)],
      };
    });
    this.add({ kind: 'pulse', x, y: y - 2, radius: 6, speed: 190, life: 0.38, color: NEON.mint });
    this.burst(4, () => ({
      kind: 'spark', x, y: y - 6,
      vx: (Math.random() - 0.5) * 200, vy: -Math.random() * 160, gravity: 380,
      size: 4, life: 0.35, color: NEON.lime,
    }));
  }

  jumpPuff(x, y) {
    this.burst(5, () => ({
      x: x + (Math.random() - 0.5) * 16, y: y - 4,
      vx: (Math.random() - 0.5) * 120, vy: -(30 + Math.random() * 80), gravity: 320,
      size: 4, life: 0.3, color: NEON.lavender,
    }));
  }

  // The couple's second jump: a luminous ring under each runner plus a small
  // neon burst, quick and restrained so it never fights the action.
  doubleJump(x, y, tint = NEON.pink) {
    this.add({ kind: 'ring', x, y: y - 4, radius: 8, speed: 210, life: 0.42, color: tint });
    this.burst(7, (index) => {
      const angle = (index / 7) * Math.PI * 2;
      return {
        kind: 'spark', x, y: y - 8,
        vx: Math.cos(angle) * 120, vy: Math.sin(angle) * 46 - 60,
        size: 4, life: 0.4,
        color: [tint, NEON.lavender, NEON.white][index % 3],
      };
    });
  }

  // Collecting a crystal: a bright core pop with a rising shimmer.
  crystalCollect(x, y, tint = NEON.lavender) {
    this.burst(12, (index, total) => {
      const angle = (index / total) * Math.PI * 2;
      return {
        kind: 'spark', x, y,
        vx: Math.cos(angle) * (110 + Math.random() * 110),
        vy: Math.sin(angle) * (110 + Math.random() * 110),
        size: 4, life: 0.5,
        color: [NEON.white, tint, NEON.pink][index % 3],
      };
    });
    this.burst(4, () => ({
      kind: 'spark', x: x + (Math.random() - 0.5) * 10, y,
      vx: (Math.random() - 0.5) * 30, vy: -120 - Math.random() * 60,
      gravity: 120, size: 4, life: 0.7, color: NEON.white,
    }));
    this.add({ kind: 'ring', x, y, radius: 6, speed: 150, life: 0.5, color: tint });
  }

  // A soft cloud of hearts and pink light around the kiss.
  kissSparkle(x, y) {
    this.burst(5, () => ({
      kind: 'heart', x: x + (Math.random() - 0.5) * 44, y: y - Math.random() * 30,
      vx: (Math.random() - 0.5) * 40, vy: -50 - Math.random() * 70,
      gravity: 20, life: 1.4 + Math.random() * 0.5, size: Math.random() < 0.35 ? 12 : 8,
      color: Math.random() < 0.5 ? NEON.pink : NEON.hotPink, sway: 22,
    }));
    this.burst(6, () => ({
      kind: 'spark', x: x + (Math.random() - 0.5) * 40, y: y - 10 - Math.random() * 40,
      vx: (Math.random() - 0.5) * 50, vy: -30 - Math.random() * 40,
      size: 4, life: 1.0, color: [NEON.white, NEON.lavender, '#FFC2E0'][Math.floor(Math.random() * 3)],
    }));
    this.add({ kind: 'ring', x, y: y - 26, radius: 10, speed: 90, life: 1.2, color: NEON.pink });
  }

  collect(x, y) {
    this.burst(10, (index, total) => {
      const angle = (index / total) * Math.PI * 2;
      return {
        kind: 'spark', x, y,
        vx: Math.cos(angle) * (90 + Math.random() * 130),
        vy: Math.sin(angle) * (90 + Math.random() * 130),
        size: 4, life: 0.45,
        color: [NEON.lime, NEON.mint, NEON.white][index % 3],
      };
    });
    this.burst(3, () => ({
      kind: 'heart', x: x + (Math.random() - 0.5) * 14, y,
      vx: (Math.random() - 0.5) * 60, vy: -110 - Math.random() * 40,
      gravity: 40, life: 0.9, size: 8, color: NEON.hotPink, sway: 24,
    }));
  }

  meetBurst(x, y) {
    this.burst(10, () => ({
      kind: 'heart', x: x + (Math.random() - 0.5) * 40, y: y + (Math.random() - 0.5) * 30,
      vx: (Math.random() - 0.5) * 110, vy: -80 - Math.random() * 90,
      gravity: 30, life: 1.1 + Math.random() * 0.4, size: 8,
      color: Math.random() < 0.5 ? NEON.pink : NEON.hotPink, sway: 30,
    }));
    this.burst(14, (index, total) => {
      const angle = (index / total) * Math.PI * 2;
      return {
        kind: 'spark', x, y,
        vx: Math.cos(angle) * 220, vy: Math.sin(angle) * 220,
        size: 4, life: 0.5,
        color: [NEON.white, NEON.pink, NEON.lavender][index % 3],
      };
    });
    this.add({ kind: 'pulse', x, y: y + 40, radius: 8, speed: 240, life: 0.5, color: NEON.pink });
  }

  ambientHeart(x, y) {
    this.add({
      kind: 'heart', x, y, vx: -14, vy: -34, life: 2.4, size: 8,
      color: NEON.hotPink, sway: 14,
    });
  }

  // A successful kick: a bright impact ring with a couple of sparks.
  kickImpact(x, y) {
    this.add({ kind: 'ring', x, y, radius: 5, speed: 220, life: 0.32, color: NEON.lime });
    this.burst(9, (index, total) => {
      const angle = (index / total) * Math.PI * 2;
      return {
        kind: 'spark', x, y,
        vx: Math.cos(angle) * (120 + Math.random() * 130),
        vy: Math.sin(angle) * (120 + Math.random() * 90),
        size: 4, life: 0.35,
        color: [NEON.lime, NEON.white, NEON.pink][index % 3],
      };
    });
  }

  // The heavy landing of a kick: a starburst of shards, a shockwave ring and
  // a spray of sparks. Bigger and brighter than the plain impact, because
  // this is the frame the player is meant to feel.
  kickImpactBig(x, y) {
    this.add({ kind: 'ring', x, y, radius: 4, speed: 340, life: 0.38, color: NEON.white });
    this.add({ kind: 'ring', x, y, radius: 6, speed: 210, life: 0.46, color: NEON.lime });
    this.add({ kind: 'pulse', x, y, radius: 8, speed: 260, life: 0.3, color: NEON.hotPink });
    // Shards fly outward in a star pattern.
    this.burst(12, (index, total) => {
      const angle = (index / total) * Math.PI * 2 + 0.2;
      return {
        kind: 'spark', x, y,
        vx: Math.cos(angle) * (200 + Math.random() * 190),
        vy: Math.sin(angle) * (200 + Math.random() * 150) - 40,
        gravity: 420, size: 6, life: 0.42,
        color: [NEON.white, NEON.lime, NEON.hotPink][index % 3],
      };
    });
    // A slower ring of embers that lingers a moment longer.
    this.burst(6, () => ({
      kind: 'spark', x: x + (Math.random() - 0.5) * 14, y: y + (Math.random() - 0.5) * 14,
      vx: (Math.random() - 0.5) * 120, vy: -60 - Math.random() * 90,
      gravity: 260, size: 4, life: 0.6,
      color: [NEON.lavender, NEON.pink][Math.floor(Math.random() * 2)],
    }));
  }

  // The motion trail of the kicking leg: a short streak left behind the foot
  // while the leg snaps through the active window.
  kickTrail(x, y, vx = 0, vy = 0) {
    this.add({
      kind: 'trail', x, y,
      vx: vx * 0.35 - 40, vy: vy * 0.35,
      size: 8, life: 0.2, color: NEON.lavender,
    });
  }

  // A kick that touched nothing: three soft puffs drifting past the foot.
  kickWhiff(x, y) {
    this.burst(3, (index) => ({
      x: x + index * 3, y: y + (Math.random() - 0.5) * 8,
      vx: 90 + Math.random() * 60, vy: -(20 + Math.random() * 30),
      size: 4, life: 0.32, color: '#8E7FB8',
    }));
    this.add({ kind: 'pulse', x, y, radius: 4, speed: 120, life: 0.26, color: '#8E7FB8' });
  }

  // The money the thief takes: a burst of coins that falls to the ground.
  coinBurst(x, y) {
    this.burst(10, (index) => ({
      kind: 'spark', x: x + (Math.random() - 0.5) * 20, y: y + (Math.random() - 0.5) * 12,
      vx: (Math.random() - 0.5) * 190, vy: -140 - Math.random() * 120,
      gravity: 620, size: 5, life: 0.75,
      color: [NEON.lime, '#FFE66D', '#FF9E3D'][index % 3],
    }));
    this.add({ kind: 'pulse', x, y, radius: 7, speed: 200, life: 0.4, color: NEON.lime });
  }

  defeat(x, y) {
    this.burst(12, () => ({
      x, y: y - 10, vx: (Math.random() - 0.5) * 260, vy: -Math.random() * 220,
      gravity: 520, size: 4, life: 0.6, color: NEON.lavender,
    }));
    this.burst(6, () => ({
      kind: 'heart', x: x + (Math.random() - 0.5) * 20, y: y - 30,
      vx: (Math.random() - 0.5) * 140, vy: -140 - Math.random() * 60,
      gravity: 620, life: 1.1, size: 8, color: NEON.pink,
    }));
  }

  update(deltaTime) {
    this.time += deltaTime;
    for (const particle of this.particles) {
      particle.life -= deltaTime;
      if (particle.kind === 'pulse' || particle.kind === 'ring') {
        particle.radius += particle.speed * deltaTime;
        continue;
      }
      particle.vy += particle.gravity * deltaTime;
      particle.x += (particle.vx + Math.sin(this.time * 6 + particle.phase) * particle.sway) * deltaTime;
      particle.y += particle.vy * deltaTime;
    }
    this.particles = this.particles.filter((particle) => particle.life > 0);
  }

  draw(view) {
    for (const particle of this.particles) {
      const alpha = Math.max(0, particle.life / particle.maxLife);
      if (particle.kind === 'pulse') {
        view.rect(particle.x - particle.radius, particle.y, particle.radius * 2, 2, particle.color, alpha * 0.7);
        view.rect(particle.x - particle.radius * 0.6, particle.y - 4, particle.radius * 1.2, 2, particle.color, alpha * 0.35);
      } else if (particle.kind === 'ring') {
        // Flattened luminous ring, as if seen on the ground in perspective.
        for (let step = 0; step < 20; step += 1) {
          const angle = (step / 20) * Math.PI * 2;
          view.rect(
            particle.x + Math.cos(angle) * particle.radius - 1,
            particle.y + Math.sin(angle) * particle.radius * 0.42 - 1,
            2, 2, particle.color, alpha * 0.8,
          );
        }
      } else if (particle.kind === 'heart') {
        drawHeart(view, particle.x, particle.y, particle.size, particle.color, alpha);
      } else if (particle.kind === 'trail') {
        // A short streak left by the kicking leg, fading as it dies.
        const stretch = particle.size * (1.6 + (1 - alpha) * 1.4);
        view.rect(particle.x - stretch / 2, particle.y - particle.size / 2, stretch, particle.size / 2, particle.color, alpha * 0.5);
        view.rect(particle.x - stretch / 4, particle.y - particle.size / 2, stretch / 2, particle.size / 2, NEON.white, alpha * 0.6);
      } else {
        view.rect(particle.x, particle.y, particle.size, particle.size, particle.color, alpha);
      }
    }
  }
}

// Small pixel heart used for pickups and celebration particles.
export function drawHeart(view, x, y, size, color, alpha = 1) {
  const cell = size / 4;
  view.rect(x, y, cell, cell, color, alpha);
  view.rect(x + cell * 3, y, cell, cell, color, alpha);
  view.rect(x, y + cell, cell * 4, cell * 2, color, alpha);
  view.rect(x + cell, y + cell * 3, cell * 2, cell, color, alpha);
  view.rect(x + cell, y + cell, cell, cell, NEON.white, alpha * 0.8);
}
