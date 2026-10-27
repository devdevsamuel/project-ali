import { GAME_WIDTH, GROUND_Y } from './config.js';

const BUTTERFLY_COLORS = [
  { wing: '#FF69D4', light: '#FFB3E8' },
  { wing: '#C8A7FF', light: '#E4D4FF' },
  { wing: '#4DFFD2', light: '#B8FFF0' },
  { wing: '#FFE66D', light: '#FFF5C2' },
];

const mod = (value, divisor) => ((value % divisor) + divisor) % divisor;

/**
 * Reusable, non-colliding life: birds crossing the sky, butterflies drifting
 * near the couple and the distant rainbow. All of it wakes up with `mood`
 * (0 = storm, 1 = the world has come alive) and stays cheap: a handful of
 * entities, a few snapped rects each.
 */
export class Life {
  constructor() {
    this.time = 0;
    this.birds = [];
    this.butterflies = [];
    this.birdTimer = 0.6;
    this.butterflyTimer = 1.2;
  }

  reset() {
    this.birds = [];
    this.butterflies = [];
    this.birdTimer = 0.6;
    this.butterflyTimer = 1.2;
  }

  update(deltaTime, mood) {
    this.time += deltaTime;

    if (mood > 0.12) {
      this.birdTimer -= deltaTime;
      if (this.birdTimer <= 0 && this.birds.length < 5) {
        this.birdTimer = 2.4 + Math.random() * 3.4;
        const size = 5 + Math.random() * 5;
        this.birds.push({
          x: GAME_WIDTH + 20,
          y: 54 + Math.random() * 150,
          speed: 34 + Math.random() * 46,
          size,
          phase: Math.random() * 6.28,
          flapSpeed: 6 + Math.random() * 4,
        });
      }
    }

    if (mood > 0.3) {
      this.butterflyTimer -= deltaTime;
      if (this.butterflyTimer <= 0 && this.butterflies.length < 4) {
        this.butterflyTimer = 1.8 + Math.random() * 2.6;
        const palette = BUTTERFLY_COLORS[Math.floor(Math.random() * BUTTERFLY_COLORS.length)];
        this.butterflies.push({
          x: Math.random() < 0.5 ? -14 : GAME_WIDTH + 14,
          y: GROUND_Y - 40 - Math.random() * 130,
          speed: 16 + Math.random() * 16,
          phase: Math.random() * 6.28,
          flutter: 1.6 + Math.random() * 1.4,
          colors: palette,
        });
      }
    }

    for (const bird of this.birds) {
      bird.x -= bird.speed * deltaTime;
      bird.phase += bird.flapSpeed * deltaTime;
      bird.y += Math.sin(this.time * 0.9 + bird.phase * 0.2) * 6 * deltaTime;
    }
    this.birds = this.birds.filter((bird) => bird.x > -30 && bird.y > 20);

    for (const butterfly of this.butterflies) {
      butterfly.phase += butterfly.flutter * deltaTime;
      butterfly.y += Math.sin(butterfly.phase * 1.3) * 26 * deltaTime;
      butterfly.y += Math.cos(butterfly.phase * 0.7) * 10 * deltaTime;
    }
    this.butterflies = this.butterflies.filter(
      (butterfly) => butterfly.x > -24 && butterfly.x < GAME_WIDTH + 24,
    );
  }

  // Butterflies stay near a focus point (the couple) without ever colliding.
  pullToward(focusX, deltaTime) {
    for (const butterfly of this.butterflies) {
      const target = focusX + Math.sin(butterfly.phase * 0.5) * 150;
      const pull = (target - butterfly.x) * 0.5;
      butterfly.x += (pull - butterfly.speed) * deltaTime;
    }
  }

  // Distant layered arc; fades in as the world awakens and never glows hard.
  drawRainbow(view, mood) {
    const appear = Math.max(0, Math.min(1, (mood - 0.28) / 0.5));
    if (appear <= 0) {
      return;
    }
    const centerX = 690;
    const centerY = 560;
    const bands = ['#FF6B6B', '#FFB347', '#FFE66D', '#7BE495', '#4DCCFF', '#B388FF'];
    for (let band = 0; band < bands.length; band += 1) {
      const radius = 250 + band * 10;
      // Small tangent steps keep the arc continuous instead of dashed.
      for (let angle = 202; angle <= 338; angle += 2) {
        const radians = (angle * Math.PI) / 180;
        view.rect(
          centerX + Math.cos(radians) * radius - 4,
          centerY + Math.sin(radians) * radius,
          9, 9, bands[band], 0.38 * appear,
        );
      }
    }
    // A soft white bloom along the top of the arc.
    for (let angle = 240; angle <= 300; angle += 2) {
      const radians = (angle * Math.PI) / 180;
      view.rect(
        centerX + Math.cos(radians) * 247 - 4,
        centerY + Math.sin(radians) * 247,
        9, 5, '#FFFFFF', 0.14 * appear,
      );
    }
  }

  drawBirds(view, mood) {
    const alpha = Math.max(0, Math.min(1, (mood - 0.1) / 0.3));
    if (alpha <= 0.02) {
      return;
    }
    for (const bird of this.birds) {
      const scale = bird.size / 8;
      const body = '#3E4A66';
      const belly = '#7C89A8';
      view.rect(bird.x, bird.y, 7 * scale, 3 * scale, body, alpha);
      view.rect(bird.x + 6 * scale, bird.y - scale, 3 * scale, 3 * scale, body, alpha);
      view.rect(bird.x + 9 * scale, bird.y, 2 * scale, 2 * scale, '#FFB347', alpha);
      view.rect(bird.x - 3 * scale, bird.y, 3 * scale, 2 * scale, body, alpha);
      view.rect(bird.x + 1 * scale, bird.y + 2 * scale, 4 * scale, 1 * scale, belly, alpha * 0.9);
      // Two-frame wing beat: raised V, then swept down.
      if (Math.sin(bird.phase) > 0) {
        view.rect(bird.x + 1 * scale, bird.y - 4 * scale, 3 * scale, 4 * scale, body, alpha);
        view.rect(bird.x + 4 * scale, bird.y - 3 * scale, 3 * scale, 3 * scale, belly, alpha * 0.8);
      } else {
        view.rect(bird.x + 1 * scale, bird.y + 3 * scale, 3 * scale, 3 * scale, body, alpha);
        view.rect(bird.x + 4 * scale, bird.y + 2 * scale, 3 * scale, 2 * scale, belly, alpha * 0.8);
      }
    }
  }

  drawButterflies(view, mood) {
    const alpha = Math.max(0, Math.min(1, (mood - 0.3) / 0.3));
    if (alpha <= 0.02) {
      return;
    }
    for (const butterfly of this.butterflies) {
      const spread = 2.6 + Math.abs(Math.sin(butterfly.phase)) * 2.6;
      const tilt = Math.sin(butterfly.phase * 1.3) > 0 ? 0 : 1;
      view.rect(butterfly.x - spread, butterfly.y + tilt, spread, 3.6, butterfly.colors.wing, alpha);
      view.rect(butterfly.x + 2, butterfly.y + (1 - tilt), spread, 3.6, butterfly.colors.wing, alpha);
      view.rect(butterfly.x - spread + 1, butterfly.y + tilt, spread - 1, 1.4, butterfly.colors.light, alpha * 0.85);
      view.rect(butterfly.x + 2, butterfly.y + (1 - tilt), spread - 1, 1.4, butterfly.colors.light, alpha * 0.85);
      view.rect(butterfly.x, butterfly.y - 0.5, 2, 5, '#4A3325', alpha);
      view.rect(butterfly.x - 1, butterfly.y - 1.5, 1, 1.5, '#4A3325', alpha);
    }
  }
}
