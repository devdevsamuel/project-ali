import { GAME_WIDTH, GAME_HEIGHT, GROUND_Y } from './config.js';
import { NEON, mixColor } from './palette.js';
import { Weather } from './Weather.js';
import { Life } from './Life.js';
import { ColonialCity } from './City.js';

const mod = (value, divisor) => ((value % divisor) + divisor) % divisor;

function randomSource(seed) {
  let state = seed >>> 0;
  return () => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 4294967296;
  };
}

/**
 * Layered parallax world with three emotional phases driven by one `mood`
 * value (0 = the turbulent solo storm, 1 = the awakened white city):
 * sky, stars and moon fade into sun and rainbow, the ruined neon city gives
 * way to white colonial facades, hills and plants turn green and flowery, and
 * the road becomes warm cobblestone. Weather, life (birds, butterflies) and
 * the colonial strip are small reusable modules owned here.
 */
export class Environment {
  constructor() {
    this.time = 0;
    this.reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const random = randomSource(20260214);

    this.weather = new Weather();
    this.life = new Life();
    this.colonial = new ColonialCity();

    this.stars = Array.from({ length: 58 }, () => ({
      x: random() * GAME_WIDTH,
      y: random() * 250,
      size: random() < 0.22 ? 4 : 2,
      phase: random() * 6.28,
      speed: 0.6 + random() * 2,
      color: [NEON.white, NEON.lavender, NEON.mint][Math.floor(random() * 3)],
    }));

    this.clouds = Array.from({ length: 5 }, (_, index) => ({
      x: (index / 5) * GAME_WIDTH + random() * 120,
      y: 56 + random() * 110,
      width: 70 + random() * 80,
      height: 12 + random() * 12,
    }));

    // The solo skyline: dark towers, some of them ruined and unsettling.
    this.buildings = [];
    let cursor = 0;
    while (cursor < 480) {
      const width = 34 + random() * 44;
      const height = 60 + random() * 130;
      const ruined = random() < 0.32;
      const windows = [];
      const columns = Math.max(1, Math.floor((width - 10) / 10));
      const rows = Math.max(1, Math.floor((height - 16) / 13));
      for (let column = 0; column < columns; column += 1) {
        for (let row = 0; row < rows; row += 1) {
          windows.push({
            x: 6 + column * 10,
            y: 8 + row * 13,
            litAt: random(),
            phase: random() * 6.28,
          });
        }
      }
      this.buildings.push({
        x: cursor, width, height, windows, ruined,
        antenna: !ruined && height > 150,
        phase: random() * 6.28,
      });
      cursor += width + 6 + random() * 12;
    }

    // Watching creatures: silhouettes on the hills with blinking glow eyes.
    this.watchers = Array.from({ length: 5 }, (_, index) => ({
      x: (index / 5) * GAME_WIDTH + random() * 90,
      size: 12 + random() * 14,
      phase: random() * 6.28,
      blinkOffset: random() * 4,
      hump: random() < 0.5,
    }));

    this.hillPlants = Array.from({ length: 14 }, () => ({
      x: random() * GAME_WIDTH,
      kind: ['mushroom', 'tuft', 'thorn'][Math.floor(random() * 3)],
      color: random() < 0.5 ? NEON.pink : NEON.lime,
      scale: 0.8 + random() * 0.6,
    }));

    this.nearPlants = Array.from({ length: 11 }, () => ({
      x: random() * GAME_WIDTH,
      kind: ['mushroom', 'thorn', 'tuft', 'rock'][Math.floor(random() * 4)],
      color: [NEON.lime, NEON.pink, '#8FE06A'][Math.floor(random() * 3)],
      scale: 1 + random() * 0.9,
    }));

    // The same spots bloom with flowers as the world awakens.
    this.bloomSpots = Array.from({ length: 14 }, () => ({
      x: random() * GAME_WIDTH,
      color: ['#FF69D4', '#FFFFFF', '#FFE66D'][Math.floor(random() * 3)],
      scale: 0.9 + random() * 0.7,
      sway: random() * 6.28,
    }));

    this.groundDetails = Array.from({ length: 9 }, () => ({
      x: random() * 240,
      kind: random() < 0.55 ? 'flower' : 'mushroom',
      color: random() < 0.5 ? NEON.hotPink : NEON.mint,
    }));

    this.foreground = Array.from({ length: 26 }, () => ({
      x: random() * GAME_WIDTH,
      width: 4 + random() * 5,
      height: 12 + random() * 26,
    }));

    this.motes = Array.from({ length: 14 }, () => ({
      x: random() * GAME_WIDTH,
      y: 120 + random() * 320,
      phase: random() * 6.28,
      speed: 0.3 + random() * 0.6,
      color: random() < 0.5 ? NEON.mint : NEON.lime,
    }));
  }

  update(deltaTime, mood = 0) {
    this.time += deltaTime;
    this.weather.update(deltaTime, mood);
    this.life.update(deltaTime, mood);
  }

  // Raises the storm. The weather eases toward the target, so the rain
  // builds up smoothly instead of switching off between two states.
  setRainIntensity(level) {
    this.weather.setIntensity(level);
  }

  resetLife() {
    this.life.reset();
  }

  hillHeight(x) {
    return 62
      + 26 * Math.sin((x * Math.PI * 2) / 480 + 0.6)
      + 14 * Math.sin((x * Math.PI * 2) / 320 + 1.9);
  }

  // Draw a wrapped element twice so tiles join seamlessly at the screen edges.
  eachWrapped(tileWidth, offset, draw) {
    const shift = mod(offset, tileWidth);
    for (let base = -shift - tileWidth; base < GAME_WIDTH + tileWidth; base += tileWidth) {
      draw(base);
    }
  }

  drawBack(view, scroll, progress, mood) {
    const calm = Math.max(0, 1 - mood);
    const horizon = mixColor(
      mixColor('#4A1B57', '#F7B8D4', mood),
      '#FFE9C9',
      Math.max(0, mood - 0.5) * 2,
    );
    view.fillVerticalGradient([
      [0, mixColor(mixColor(NEON.violet, '#1B0F38', progress * 0.5), '#3E93DE', mood)],
      [0.55, mixColor('#22123F', '#8FCDF2', mood)],
      [1, horizon],
    ]);

    this.drawStars(view, scroll, calm);
    this.drawSkyLight(view, scroll, mood);
    this.life.drawRainbow(view, mood);
    this.weather.drawClouds(view, scroll, mood);
    this.weather.drawBolt(view, mood);

    this.drawCityLayer(view, scroll * 0.16, mood);
    this.drawHills(view, scroll * 0.34, mood);
    this.drawNearPlants(view, scroll * 0.62, mood);
    this.life.drawBirds(view, mood);
  }

  drawStars(view, scroll, calm) {
    const alpha = Math.max(0, Math.min(1, calm * 1.2 - 0.15));
    if (alpha <= 0.02) {
      return;
    }
    const starOffset = scroll * 0.05;
    for (const star of this.stars) {
      const x = mod(star.x - starOffset, GAME_WIDTH);
      const twinkle = this.reducedMotion ? 0.75 : 0.35 + 0.65 * (0.5 + 0.5 * Math.sin(this.time * star.speed + star.phase));
      view.rect(x, star.y, star.size, star.size, star.color, twinkle * alpha);
      if (star.size === 4) {
        view.rect(x - 4, star.y, 2, 2, star.color, twinkle * 0.6 * alpha);
        view.rect(x + 6, star.y, 2, 2, star.color, twinkle * 0.6 * alpha);
        view.rect(x, star.y - 4, 2, 2, star.color, twinkle * 0.6 * alpha);
        view.rect(x, star.y + 6, 2, 2, star.color, twinkle * 0.6 * alpha);
      }
    }
  }

  // Moon fading out while a warm sun rises on the other side of the sky.
  drawSkyLight(view, scroll, mood) {
    const night = Math.max(0, 1 - mood * 1.25);
    if (night > 0.02) {
      const moonX = 770 - mod(scroll * 0.03, 40);
      view.circle(moonX, 96, 52, NEON.lavender, 0.05 * night);
      view.circle(moonX, 96, 40, NEON.lavender, 0.09 * night);
      view.circle(moonX, 96, 30, NEON.white, night);
      view.circle(moonX - 8, 100, 25, '#E9DBFF', 0.7 * night);
      view.rect(moonX - 10, 88, 8, 6, NEON.lavender, 0.55 * night);
      view.rect(moonX + 4, 104, 6, 4, NEON.lavender, 0.45 * night);
    }
    const day = Math.max(0, Math.min(1, (mood - 0.35) / 0.45));
    if (day > 0.02) {
      const sunX = 190 - mod(scroll * 0.02, 30);
      view.circle(sunX, 92, 54, '#FFF6C9', 0.16 * day);
      view.circle(sunX, 92, 38, '#FFE68A', 0.3 * day);
      view.circle(sunX, 92, 26, '#FFFBEB', day);
    }
    // Soft clouds kept from the original night sky, now warming with the day.
    for (const cloud of this.clouds) {
      const x = mod(cloud.x - scroll * 0.1, GAME_WIDTH + 200) - 100;
      const y = cloud.y - mood * 30;
      const alpha = (0.55 - mood * 0.25) * Math.max(0, 1 - mood * 0.8) + 0.1;
      view.rect(x, y, cloud.width, cloud.height, mixColor('#3A1F5E', '#FFFFFF', mood), alpha);
      view.rect(x + 12, y - 8, cloud.width * 0.55, 10, mixColor('#3A1F5E', '#FFFFFF', mood), alpha * 0.8);
      view.rect(x, y, cloud.width, 2, mixColor(NEON.hotPink, '#FFE9C9', mood), 0.18 + mood * 0.2);
    }
  }

  drawCityLayer(view, offset, mood) {
    if (mood < 0.995) {
      this.drawRuinedCity(view, offset, Math.max(0, 1 - mood * 1.35));
    }
    if (mood > 0.02) {
      this.colonial.draw(view, offset, Math.min(1, mood * 1.25));
    }
  }

  drawRuinedCity(view, offset, alpha) {
    if (alpha <= 0.02) {
      return;
    }
    const litThreshold = 0.62;
    for (const building of this.buildings) {
      const x = mod(building.x - offset, 480);
      for (const copy of [x, x - 480]) {
        if (copy > GAME_WIDTH || copy + building.width < 0) {
          continue;
        }
        const top = GROUND_Y + 10 - building.height;
        view.rect(copy, top, building.width, building.height, '#1B0F35', alpha);
        view.rect(copy, top, building.width, 2, '#2E1A52', alpha);
        view.rect(copy + building.width - 3, top, 3, building.height, '#150B28', alpha);
        if (building.ruined) {
          // Broken, jagged roofline and a sickly rim of decay.
          for (let step = 0; step < 4; step += 1) {
            const stepWidth = building.width / 4;
            const drop = ((step * 37 + building.height) % 3) * 7;
            view.rect(copy + step * stepWidth, top - 8 + drop, stepWidth + 1, 10, '#1B0F35', alpha);
          }
          view.rect(copy, top, building.width, 2, '#5E8F2A', 0.22 * alpha);
        } else if (building.antenna) {
          view.rect(copy + building.width / 2, top - 14, 2, 14, '#2E1A52', alpha);
          const blink = Math.sin(this.time * 2 + building.phase) > 0 ? 0.9 : 0.15;
          view.rect(copy + building.width / 2 - 1, top - 16, 4, 4, NEON.pink, blink * alpha);
        }
        for (const window of building.windows) {
          if (building.ruined) {
            view.rect(copy + window.x, top + window.y, 4, 5, '#241645', 0.5 * alpha);
          } else if (window.litAt > litThreshold) {
            view.rect(copy + window.x, top + window.y, 4, 4, '#241645', alpha);
          } else {
            const flicker = 0.75 + 0.25 * Math.sin(this.time * 0.7 + window.phase);
            const color = [NEON.pink, NEON.lime, NEON.mint, NEON.lavender][Math.floor(window.litAt * 4) % 4];
            view.rect(copy + window.x, top + window.y, 4, 5, color, flicker * 0.85 * alpha);
          }
        }
      }
    }
  }

  drawHills(view, offset, mood) {
    const calm = Math.max(0, 1 - mood);
    const hillBody = mixColor('#1A0D34', '#2F7A3E', mood);
    const hillRim = mixColor(NEON.lime, '#8FE06A', mood);
    for (let x = 0; x < GAME_WIDTH; x += 2) {
      const top = GROUND_Y - this.hillHeight(x + offset);
      view.rect(x, top, 2, GROUND_Y - top + 4, hillBody);
      view.rect(x, top, 2, 2, hillRim, 0.35 + mood * 0.3);
    }
    // A soft ridge of distant sunlit hills behind the first row.
    if (mood > 0.05) {
      for (let x = 0; x < GAME_WIDTH; x += 4) {
        const top = GROUND_Y - this.hillHeight(x + offset * 0.55) * 0.6 - 26;
        view.rect(x, top, 4, GROUND_Y - top, mixColor('#2E1B52', '#7CC27A', mood), 0.5 * mood);
      }
    }
    this.drawWatchers(view, offset, calm);
    for (const plant of this.hillPlants) {
      const x = mod(plant.x - offset, GAME_WIDTH);
      const base = GROUND_Y - this.hillHeight(x + offset);
      this.drawPlant(view, plant, x, base, 0.75, calm);
    }
    if (mood > 0.05) {
      for (const bloom of this.bloomSpots) {
        const x = mod(bloom.x - offset * 1.1, GAME_WIDTH);
        const base = GROUND_Y - this.hillHeight(x + offset) - 6;
        this.drawFlower(view, bloom, x, base, 0.7, mood);
      }
    }
  }

  // Dark watchers with blinking eyes; atmosphere only, never a hazard.
  drawWatchers(view, offset, calm) {
    if (calm < 0.05) {
      return;
    }
    for (const watcher of this.watchers) {
      const x = mod(watcher.x - offset * 0.9, GAME_WIDTH);
      const base = GROUND_Y - this.hillHeight(x + offset) + 4;
      const size = watcher.size;
      view.rect(x, base - size, size * 1.4, size, '#120A26', 0.9 * calm);
      if (watcher.hump) {
        view.rect(x + 2, base - size - 5, size, 6, '#120A26', 0.9 * calm);
        view.rect(x - 4, base - 6, size * 1.8, 6, '#120A26', 0.9 * calm);
      } else {
        view.rect(x + size * 0.4, base - size - 6, 3, 7, '#120A26', 0.9 * calm);
      }
      const blinkCycle = (this.time + watcher.blinkOffset) % 4.4;
      const awake = blinkCycle < 3.4 || blinkCycle > 3.7;
      if (awake) {
        const eyeGlow = 0.6 + 0.4 * Math.sin(this.time * 2 + watcher.phase);
        view.rect(x + size * 0.3, base - size + 3, 3, 2, '#B7FF4A', eyeGlow * calm);
        view.rect(x + size * 0.3 + 6, base - size + 3, 3, 2, '#B7FF4A', eyeGlow * calm);
      }
    }
  }

  drawNearPlants(view, offset, mood) {
    const calm = Math.max(0, 1 - mood);
    if (calm > 0.03) {
      for (const plant of this.nearPlants) {
        const x = mod(plant.x - offset, GAME_WIDTH);
        this.drawPlant(view, plant, x, GROUND_Y, 1, calm);
      }
    }
    if (mood > 0.03) {
      // The street the couple runs through, then flowers and bushes in front.
      this.colonial.drawStreet(view, offset, Math.min(1, mood * 1.3));
      for (const bloom of this.bloomSpots) {
        const x = mod(bloom.x - offset, GAME_WIDTH);
        this.drawFlower(view, bloom, x, GROUND_Y, 1, mood);
        if (bloom.scale > 1.3) {
          this.drawBush(view, x + 14, GROUND_Y, bloom.scale, mood);
        }
      }
    }
  }

  drawPlant(view, plant, x, base, depth, alpha) {
    const scale = plant.scale * depth;
    if (plant.kind === 'mushroom') {
      const height = 12 * scale;
      view.glow(x - 8 * scale, base - height - 6 * scale, 18 * scale, 8 * scale, plant.color, 0.12 * alpha, 2);
      view.rect(x - 2 * scale, base - height, 4 * scale, height, '#3A2A66', alpha);
      view.rect(x - 8 * scale, base - height - 6 * scale, 18 * scale, 6 * scale, plant.color, alpha);
      view.rect(x - 5 * scale, base - height - 9 * scale, 12 * scale, 4 * scale, plant.color, alpha);
      view.rect(x - 3 * scale, base - height - 8 * scale, 4 * scale, 2 * scale, NEON.white, 0.85 * alpha);
      view.rect(x + 4 * scale, base - height - 5 * scale, 3 * scale, 2 * scale, NEON.white, 0.6 * alpha);
    } else if (plant.kind === 'thorn') {
      // Jagged bramble: a readable dark silhouette with sickly tips.
      const height = 20 * scale;
      view.rect(x - 6 * scale, base - height * 0.5, 3 * scale, height * 0.5, '#1B1230', alpha);
      view.rect(x + 2 * scale, base - height * 0.7, 3 * scale, height * 0.7, '#1B1230', alpha);
      view.rect(x - 2 * scale, base - height, 3 * scale, height, '#221740', alpha);
      view.rect(x - 8 * scale, base - height * 0.35, 6 * scale, 3 * scale, '#1B1230', alpha);
      view.rect(x + 4 * scale, base - height * 0.55, 7 * scale, 3 * scale, '#1B1230', alpha);
      view.rect(x - 2 * scale, base - height - 2, 3 * scale, 2, '#8FE06A', 0.8 * alpha);
      view.rect(x + 2 * scale, base - height * 0.7 - 2, 3 * scale, 2, '#8FE06A', 0.55 * alpha);
      view.rect(x - 8 * scale, base - height * 0.35 - 2, 3 * scale, 2, '#6E7A2A', 0.7 * alpha);
    } else if (plant.kind === 'rock') {
      const height = 12 * scale;
      view.rect(x - 5 * scale, base - height * 0.6, 12 * scale, height * 0.6, '#1E1440', alpha);
      view.rect(x - 3 * scale, base - height, 8 * scale, height * 0.5, '#241950', alpha);
      view.rect(x - 3 * scale, base - height, 8 * scale, 2, '#4A3A7E', 0.7 * alpha);
    } else {
      for (let blade = 0; blade < 4; blade += 1) {
        const bx = x + blade * 4 * scale;
        const height = (6 + ((blade * 7) % 9)) * scale;
        view.rect(bx, base - height, 2 * scale, height, plant.color, 0.55 * alpha);
      }
    }
  }

  drawFlower(view, bloom, x, base, depth, alpha) {
    const scale = bloom.scale * depth;
    const sway = Math.sin(this.time * 1.6 + bloom.sway) * 1.2 * scale;
    view.rect(x, base - 10 * scale, 2 * scale, 10 * scale, '#3E8E4E', alpha);
    view.rect(x - 3 * scale + sway, base - 13 * scale, 7 * scale, 4 * scale, bloom.color, alpha);
    view.rect(x - 1 * scale + sway, base - 15 * scale, 3 * scale, 2 * scale, bloom.color, alpha);
    view.rect(x - 1 * scale + sway, base - 12 * scale, 2 * scale, 2 * scale, '#FFF6C9', alpha * 0.9);
    view.rect(x - 4 * scale, base - 5 * scale, 4 * scale, 2 * scale, '#5CB86A', alpha * 0.9);
    view.rect(x + 2 * scale, base - 7 * scale, 4 * scale, 2 * scale, '#5CB86A', alpha * 0.8);
  }

  drawBush(view, x, base, scale, alpha) {
    view.rect(x - 10 * scale, base - 12 * scale, 22 * scale, 12 * scale, '#2F7A3E', alpha);
    view.rect(x - 7 * scale, base - 17 * scale, 16 * scale, 8 * scale, '#3E8E4E', alpha);
    view.rect(x - 6 * scale, base - 16 * scale, 5 * scale, 3 * scale, '#5CB86A', alpha);
    view.rect(x + 2 * scale, base - 12 * scale, 3 * scale, 3 * scale, '#FF69D4', alpha);
    view.rect(x - 8 * scale, base - 8 * scale, 3 * scale, 3 * scale, '#FFB3E8', alpha);
    view.rect(x + 6 * scale, base - 15 * scale, 3 * scale, 3 * scale, '#FFE66D', alpha);
  }

  drawGroundLayer(view, scroll, progress, mood) {
    view.rect(0, GROUND_Y, GAME_WIDTH, 24, mixColor('#241345', '#C6B79E', mood));
    view.rect(0, GROUND_Y + 24, GAME_WIDTH, GAME_HEIGHT - GROUND_Y - 24, mixColor('#1C0E38', '#B4A48B', mood));
    view.rect(0, GROUND_Y + 66, GAME_WIDTH, GAME_HEIGHT - GROUND_Y - 66, mixColor('#160B2E', '#A2917A', mood));

    // The edge accent: electric lime in the storm, natural grass in the sun.
    view.rect(0, GROUND_Y + 2, GAME_WIDTH, 6, mixColor(NEON.mint, '#8FE06A', mood), 0.12 + progress * 0.06);
    view.rect(0, GROUND_Y - 2, GAME_WIDTH, 4, mixColor(NEON.lime, '#63BB4A', mood));
    view.rect(0, GROUND_Y + 2, GAME_WIDTH, 2, mixColor('#5E9E2A', '#4E9E3E', mood));
    view.rect(0, GROUND_Y + 4, GAME_WIDTH, 4, mixColor(NEON.lime, '#7CCF58', mood), 0.08 + mood * 0.06);
    view.rect(0, GROUND_Y + 8, GAME_WIDTH, 6, mixColor(NEON.mint, '#A5E07A', mood), 0.04 + mood * 0.04);

    const grassOffset = mod(scroll, 24);
    for (let x = -grassOffset; x < GAME_WIDTH; x += 24) {
      const tuft = mixColor(NEON.lime, '#63BB4A', mood);
      view.rect(x + 2, GROUND_Y - 6, 2, 4, tuft);
      view.rect(x + 6, GROUND_Y - 8, 2, 6, tuft, 0.85);
      view.rect(x + 12, GROUND_Y - 4, 2, 2, mixColor(NEON.mint, '#A5E07A', mood), 0.8);
      view.rect(x + 18, GROUND_Y - 6, 2, 4, tuft, 0.7);
    }

    // Broken road marks fade away as warm cobblestones roll in.
    const dashOffset = mod(scroll, 48);
    for (let x = -dashOffset; x < GAME_WIDTH; x += 48) {
      view.rect(x, GROUND_Y + 28, 26, 4, '#3A2360', 1 - mood);
      view.rect(x + 20, GROUND_Y + 52, 12, 4, '#2C1A50', 1 - mood);
    }
    if (mood > 0.02) {
      const cobbleOffset = mod(scroll, 40);
      for (let row = 0; row < 4; row += 1) {
        const y = GROUND_Y + 10 + row * 18;
        const stagger = row % 2 === 0 ? 0 : 20;
        for (let x = -cobbleOffset - 40 + stagger; x < GAME_WIDTH + 40; x += 40) {
          view.rect(x, y, 34, 13, '#D8CCB4', 0.22 * mood);
          view.rect(x, y + 11, 34, 3, '#8C7C66', 0.28 * mood);
          view.rect(x + 2, y + 1, 12, 2, '#EFE6D2', 0.2 * mood);
          view.rect(x + 20, y + 3, 10, 2, '#EFE6D2', 0.14 * mood);
        }
      }
    }

    const pebbleOffset = mod(scroll, 36);
    for (let x = -pebbleOffset; x < GAME_WIDTH; x += 36) {
      view.rect(x + 6, GROUND_Y + 40, 6, 2, mixColor('#2A1850', '#8C7C66', mood), 0.9);
      view.rect(x + 22, GROUND_Y + 74, 8, 2, mixColor('#241345', '#7C6D58', mood), 0.9);
      view.rect(x + 14, GROUND_Y + 88, 4, 2, mixColor('#0F0722', '#6B5D4A', mood), 0.9);
    }

    // Cracked slabs in the storm, tiny ground flowers in the sun.
    const detailOffset = mod(scroll, 240);
    for (const detail of this.groundDetails) {
      const x = mod(detail.x - detailOffset, 240);
      for (const copy of [x, x + 240, x + 480, x + 720]) {
        if (copy > GAME_WIDTH) {
          continue;
        }
        if (detail.kind === 'flower') {
          view.rect(copy, GROUND_Y - 10, 2, 8, mixColor('#5E9E2A', '#3E8E4E', mood), 1 - mood * 0.4);
          view.rect(copy - 2, GROUND_Y - 13, 6, 4, detail.color);
          view.rect(copy, GROUND_Y - 12, 2, 2, NEON.white);
          view.rect(copy + 26, GROUND_Y - 6, 2, 6, '#3E8E4E', mood * 0.9);
          view.rect(copy + 24, GROUND_Y - 9, 6, 3, '#FFE66D', mood * 0.9);
        } else {
          view.rect(copy, GROUND_Y - 6, 3, 4, '#3A2A66', 1 - mood);
          view.rect(copy - 3, GROUND_Y - 9, 9, 4, detail.color, 1 - mood);
          view.rect(copy - 6, GROUND_Y + 6, 14, 2, '#180C30', 0.7 * (1 - mood));
        }
      }
    }

    // Fireflies in the storm become drifting pollen in the sun.
    if (!this.reducedMotion) {
      for (const mote of this.motes) {
        const x = mod(mote.x - scroll * 0.8 + Math.sin(this.time * mote.speed + mote.phase) * 14, GAME_WIDTH);
        const y = mote.y + Math.sin(this.time * mote.speed * 0.7 + mote.phase) * 18;
        const alpha = 0.16 + 0.12 * Math.sin(this.time * mote.speed + mote.phase);
        view.rect(x, y, 2, 2, mixColor(mote.color, '#FFF6C9', mood), Math.max(0.05, alpha) * (1 - mood * 0.3));
      }
    }
  }

  drawFront(view, scroll, mood) {
    const offset = scroll * 1.3;
    const calm = Math.max(0, 1 - mood);
    for (const blade of this.foreground) {
      const x = mod(blade.x - offset, GAME_WIDTH);
      if (calm > 0.03) {
        view.rect(x, GAME_HEIGHT - blade.height, blade.width, blade.height + 4, '#0C0620', calm);
        view.rect(x, GAME_HEIGHT - blade.height, blade.width, 2, '#5E8F2A', 0.5 * calm);
      }
      if (mood > 0.03) {
        // Soft leafy silhouettes with a few blossoms close to the camera.
        const width = blade.width + 4;
        view.rect(x - 2, GAME_HEIGHT - blade.height * 0.8, width, blade.height * 0.8 + 4, '#2F7A3E', mood * 0.9);
        view.rect(x, GAME_HEIGHT - blade.height * 0.95, width - 2, 6, '#3E8E4E', mood * 0.9);
        view.rect(x + 1, GAME_HEIGHT - blade.height * 0.7, 3, 3, '#FF69D4', mood * 0.85);
        view.rect(x + width - 3, GAME_HEIGHT - blade.height * 0.45, 3, 3, '#FFE66D', mood * 0.8);
      }
    }

    this.weather.drawRain(view, scroll, mood);
    this.life.drawButterflies(view, mood);

    const context = view.contextBuffer;
    const bottom = view.buffer.height;
    const gradient = context.createLinearGradient(0, bottom - 40, 0, bottom);
    const nightEdge = [8, 3, 18];
    const dayEdge = [196, 176, 140];
    const tint = nightEdge.map((channel, index) => Math.round(channel + (dayEdge[index] - channel) * mood));
    gradient.addColorStop(0, `rgba(${tint[0]}, ${tint[1]}, ${tint[2]}, 0)`);
    gradient.addColorStop(1, `rgba(${tint[0]}, ${tint[1]}, ${tint[2]}, ${0.6 - mood * 0.25})`);
    context.fillStyle = gradient;
    context.fillRect(0, bottom - 40, view.buffer.width, 40);
  }
}
