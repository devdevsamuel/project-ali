import {
  GAME_WIDTH, GROUND_Y, PLAYER_X, PIXELS_PER_METER,
  CRYSTAL_COUNT, CRYSTAL_DISTANCES, CRYSTAL_RESPAWN_GAP,
} from './config.js';

// Three luminous cores so the five crystals feel like a set, not clones.
const CORES = [
  { light: '#FFB3E8', main: '#FF69D4', deep: '#C22690' },
  { light: '#E4D4FF', main: '#C8A7FF', deep: '#7A52C7' },
  { light: '#B8FFF0', main: '#4DFFD2', deep: '#1E9E86' },
];

// Low crystals can be grabbed on the run; high ones need a jump.
const HEIGHTS = [52, 116, 74, 128];

/**
 * The collectible crystals of the solo section. Their world position is
 * derived from the run distance, so placement is stable and never lands on a
 * hazard; a crystal the runner outruns reschedules itself later instead of
 * becoming unreachable.
 */
export class CrystalField {
  constructor() {
    this.entries = CRYSTAL_DISTANCES.slice(0, CRYSTAL_COUNT).map((distance, index) => ({
      index,
      distance,
      height: HEIGHTS[index % HEIGHTS.length],
      collected: false,
      phase: index * 1.37,
      core: CORES[index % CORES.length],
    }));
    this.collected = 0;
  }

  reset() {
    for (let index = 0; index < this.entries.length; index += 1) {
      const entry = this.entries[index];
      entry.distance = CRYSTAL_DISTANCES[index];
      entry.collected = false;
    }
    this.collected = 0;
  }

  get complete() {
    return this.collected >= CRYSTAL_COUNT;
  }

  screenX(entry, distance) {
    return PLAYER_X + (entry.distance - distance) * PIXELS_PER_METER;
  }

  // The next uncollected crystal the runner still has ahead of them, if any.
  nextAhead(distance) {
    return this.entries.find((entry) => !entry.collected && entry.distance > distance - 1);
  }

  // While a crystal is on or near the screen, hazards stay away from it.
  blocksHazards(distance) {
    return this.entries.some((entry) => {
      if (entry.collected) {
        return false;
      }
      const x = this.screenX(entry, distance);
      return x > -80 && x < GAME_WIDTH + 260;
    });
  }

  // Crystals scroll past the player only when missed; bring them back later.
  reschedulePassed(distance) {
    for (const entry of this.entries) {
      if (!entry.collected && this.screenX(entry, distance) < -70) {
        entry.distance = distance + CRYSTAL_RESPAWN_GAP;
        entry.height = HEIGHTS[(entry.index + Math.floor(entry.distance / 100)) % HEIGHTS.length];
      }
    }
  }

  collect(entry) {
    if (entry.collected) {
      return false;
    }
    entry.collected = true;
    this.collected += 1;
    return true;
  }

  boundsOf(entry, distance, time) {
    const x = this.screenX(entry, distance);
    const bob = Math.sin(time * 2 + entry.phase) * 5;
    return { x: x - 11, y: GROUND_Y - entry.height + bob - 13, width: 22, height: 26 };
  }

  draw(view, distance, time) {
    for (const entry of this.entries) {
      if (entry.collected) {
        continue;
      }
      const x = this.screenX(entry, distance);
      if (x < -40 || x > GAME_WIDTH + 40) {
        continue;
      }
      drawCrystal(view, x, GROUND_Y - entry.height, time, entry);
    }
  }
}

// A floating faceted gem: gentle bob, a fake rotation from a squash cycle, a
// pulsing core and two orbiting motes. Restrained enough to stay cheap.
function drawCrystal(view, x, y, time, entry) {
  const { core, phase, index } = entry;
  const pulse = 0.7 + 0.3 * Math.sin(time * 3 + phase);
  const squash = 0.72 + 0.28 * Math.abs(Math.cos(time * 2.1 + phase));
  const bob = Math.sin(time * 2 + phase) * 5;

  view.glow(x - 16, y + bob - 18, 32, 34, core.main, 0.1 + 0.05 * pulse, 2);

  // Outer silhouette in deep tone so the gem stays readable on any sky.
  view.rect(x - 9 * squash, y + bob - 12, 18 * squash, 24, core.deep, 0.55);

  // Faceted body: pointed top, wide belly, tapered tip.
  view.rect(x - 4 * squash, y + bob - 14, 8 * squash, 4, core.main);
  view.rect(x - 7 * squash, y + bob - 10, 14 * squash, 6, core.main);
  view.rect(x - 8 * squash, y + bob - 4, 16 * squash, 10, core.main);
  view.rect(x - 5 * squash, y + bob + 6, 10 * squash, 6, core.deep);
  view.rect(x - 3 * squash, y + bob + 12, 6 * squash, 3, core.deep);

  // Light facet, bright core and shaded edge.
  view.rect(x - 6 * squash, y + bob - 9, 3 * squash, 15, core.light, 0.9);
  view.rect(x - 1, y + bob - 6, 2, 12, '#FFFFFF', 0.5 + 0.45 * pulse);
  view.rect(x + 5 * squash, y + bob - 8, 2 * squash, 14, core.deep, 0.8);

  // Blinking sparkle above the tip and two slow orbiting motes.
  const sparkle = Math.sin(time * 5 + phase * 2) > 0.3;
  if (sparkle) {
    view.rect(x - 1, y + bob - 19, 2, 4, '#FFFFFF', 0.9);
    view.rect(x - 3, y + bob - 17, 6, 2, '#FFFFFF', 0.9);
  }
  for (let dot = 0; dot < 2; dot += 1) {
    const angle = time * 1.7 + phase + dot * Math.PI;
    view.rect(
      x + Math.cos(angle) * 15 - 1,
      y + bob + Math.sin(angle) * 8 - 5,
      2, 2, core.light, 0.55 + 0.3 * Math.sin(time * 3 + index),
    );
  }
}
