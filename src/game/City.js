import { GAME_WIDTH, GROUND_Y } from './config.js';

// Warm whites and creams for the facades, terracotta roofs, painted wood and
// lush greens — the palette of a sunny colonial street.
const WALL = '#FBF4E4';
const WALL_SHADE = '#EFE3CB';
const WALL_TEXTURE = '#E6D9BE';
const ROOF = '#C96A4A';
const ROOF_LIGHT = '#DB8262';
const ROOF_DARK = '#A34F35';
const WOOD = '#8A5A3A';
const WOOD_DARK = '#6B4429';
const SHUTTER = '#5F8A54';
const OPENING = '#3A2A22';
const FOLIAGE = '#3E8E4E';
const FOLIAGE_LIGHT = '#5CB86A';
const FLOWER = '#FF69D4';
const FLOWER_LIGHT = '#FFB3E8';
const FLOWER_SUN = '#FFE66D';

const TILE_WIDTH = 620;
const STREET_TILE = 300;

function randomSource(seed) {
  let state = seed >>> 0;
  return () => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 4294967296;
  };
}

const mod = (value, divisor) => ((value % divisor) + divisor) % divisor;

/**
 * A tiling strip of white colonial houses inspired by Popayán: whitewashed
 * facades, terracotta rooflines, arched doorways, wooden balconies with
 * flower boxes, climbing vines, trees and a church tower in the distance.
 * Generated once from a fixed seed and drawn with a single alpha so it can
 * fade in over the dark solo city.
 */
export class ColonialCity {
  constructor() {
    const random = randomSource(19590412);
    this.buildings = [];
    let cursor = 12;
    while (cursor < TILE_WIDTH - 60) {
      const width = 66 + random() * 58;
      const twoStory = random() < 0.62;
      const height = (twoStory ? 96 : 68) + random() * 22;
      const windows = [];
      const columns = Math.max(1, Math.floor((width - 24) / 30));
      for (let column = 0; column < columns; column += 1) {
        windows.push({
          x: 16 + column * 30,
          hasBalcony: twoStory && random() < 0.75,
          shutters: random() < 0.7,
          flowers: random() < 0.8,
        });
      }
      this.buildings.push({
        x: cursor,
        width,
        height,
        twoStory,
        doorOffset: 10 + random() * (width - 34),
        windows,
        vine: random() < 0.45,
        textureSeed: Math.floor(random() * 1000),
        tower: random() < 0.34,
      });
      cursor += width + 8 + random() * 14;
    }
  }

  draw(view, scroll, alpha) {
    if (alpha <= 0.02) {
      return;
    }
    const shift = mod(scroll, TILE_WIDTH);
    for (let base = -shift - TILE_WIDTH; base < GAME_WIDTH + TILE_WIDTH; base += TILE_WIDTH) {
      for (const building of this.buildings) {
        const x = base + building.x;
        if (x > GAME_WIDTH || x + building.width < 0) {
          continue;
        }
        if (building.tower) {
          this.drawTower(view, x + building.width * 0.5 - 14, building, alpha);
        }
        this.drawHouse(view, x, building, alpha);
      }
      this.drawTree(view, base + 4, alpha);
      this.drawTree(view, base + TILE_WIDTH - 26, alpha);
    }
  }

  drawTower(view, x, building, alpha) {
    const base = GROUND_Y + 16;
    const height = building.height + 64;
    const top = base - height;
    view.rect(x, top + 22, 28, height - 22, WALL, alpha);
    view.rect(x, top + 22, 3, height - 22, WALL_SHADE, alpha);
    view.rect(x + 25, top + 22, 3, height - 22, WALL_SHADE, alpha * 0.8);
    // Belfry with arched openings.
    view.rect(x + 2, top + 4, 24, 20, WALL, alpha);
    view.rect(x + 8, top + 8, 12, 16, OPENING, alpha);
    view.rect(x + 10, top + 5, 8, 4, OPENING, alpha);
    view.rect(x - 2, top, 32, 4, ROOF, alpha);
    view.rect(x - 2, top - 2, 32, 2, ROOF_LIGHT, alpha);
    // Small stepped dome and finial.
    view.rect(x + 4, top - 8, 20, 6, ROOF, alpha);
    view.rect(x + 7, top - 13, 14, 5, ROOF, alpha);
    view.rect(x + 10, top - 17, 8, 4, ROOF_DARK, alpha);
    view.rect(x + 13, top - 21, 2, 4, WALL, alpha);
  }

  drawHouse(view, x, building, alpha) {
    const base = GROUND_Y + 16;
    const top = base - building.height;
    const { width } = building;

    // Whitewashed facade with a shaded edge and a hint of plaster texture.
    view.rect(x, top, width, building.height, WALL, alpha);
    view.rect(x, top, 3, building.height, WALL_SHADE, alpha);
    view.rect(x + width - 3, top, 3, building.height, WALL_SHADE, alpha * 0.75);
    const texture = randomSource(building.textureSeed)();
    for (let mark = 0; mark < 4; mark += 1) {
      const tx = x + 6 + ((texture * 977 * (mark + 3)) % (width - 16));
      const ty = top + 8 + ((texture * 613 * (mark + 5)) % (building.height - 26));
      view.rect(tx, ty, 4, 2, WALL_TEXTURE, alpha * 0.8);
    }

    // Terracotta roofline with overhanging eaves.
    view.rect(x - 5, top - 9, width + 10, 6, ROOF, alpha);
    view.rect(x - 5, top - 11, width + 10, 2, ROOF_LIGHT, alpha);
    view.rect(x - 5, top - 3, width + 10, 3, ROOF_DARK, alpha);
    for (let tile = 0; tile < width + 10; tile += 8) {
      view.rect(x - 5 + tile, top - 9, 2, 6, ROOF_DARK, alpha * 0.5);
    }

    // Arched doorway.
    const doorX = x + building.doorOffset;
    view.rect(doorX - 3, base - 34, 20, 3, WALL_SHADE, alpha);
    view.rect(doorX, base - 32, 14, 32, WOOD_DARK, alpha);
    view.rect(doorX + 1, base - 28, 12, 28, OPENING, alpha);
    view.rect(doorX + 3, base - 30, 8, 4, OPENING, alpha);
    view.rect(doorX + 12, base - 16, 2, 3, FLOWER_SUN, alpha);

    // Upper windows with shutters, balconies and flower boxes.
    for (const window of building.windows) {
      const wx = x + window.x;
      const wy = building.twoStory ? top + 16 : top + 12;
      view.rect(wx - 2, wy - 2, 14, 16, WALL_SHADE, alpha);
      view.rect(wx, wy, 10, 12, OPENING, alpha);
      view.rect(wx + 4, wy, 2, 12, WALL_SHADE, alpha * 0.9);
      view.rect(wx, wy + 5, 10, 2, WALL_SHADE, alpha * 0.9);
      if (window.shutters) {
        view.rect(wx - 4, wy, 4, 12, SHUTTER, alpha);
        view.rect(wx + 10, wy, 4, 12, SHUTTER, alpha);
      }
      if (window.hasBalcony) {
        view.rect(wx - 5, wy + 13, 20, 3, WOOD, alpha);
        view.rect(wx - 5, wy + 10, 20, 2, WOOD_DARK, alpha);
        for (let rail = 0; rail < 5; rail += 1) {
          view.rect(wx - 4 + rail * 4, wy + 5, 2, 6, WOOD_DARK, alpha);
        }
        view.rect(wx - 5, wy + 3, 20, 2, WOOD, alpha);
        if (window.flowers) {
          view.rect(wx - 3, wy + 1, 16, 3, FOLIAGE, alpha);
          for (let bloom = 0; bloom < 4; bloom += 1) {
            view.rect(wx - 2 + bloom * 4, wy - 1, 2, 2, bloom % 2 ? FLOWER_LIGHT : FLOWER, alpha);
          }
        }
      } else if (building.twoStory) {
        view.rect(wx - 3, wy + 13, 16, 2, WALL_SHADE, alpha);
      }
    }

    // Ground-floor window with a small flower bed.
    if (building.twoStory) {
      const gx = x + 10;
      view.rect(gx, base - 26, 12, 14, OPENING, alpha);
      view.rect(gx, base - 26, 12, 2, SHUTTER, alpha);
      view.rect(gx + 5, base - 26, 2, 14, WALL_SHADE, alpha * 0.9);
      view.rect(gx - 2, base - 8, 16, 4, FOLIAGE, alpha);
      view.rect(gx, base - 11, 3, 3, FLOWER, alpha);
      view.rect(gx + 7, base - 11, 3, 3, FLOWER_LIGHT, alpha);
      view.rect(gx + 11, base - 10, 2, 2, FLOWER_SUN, alpha);
    }

    // Climbing vine along one edge of the facade.
    if (building.vine) {
      for (let step = 0; step < 7; step += 1) {
        const vy = base - 6 - step * (building.height / 8);
        const vx = x + width - 8 - (step % 3) * 3;
        view.rect(vx, vy, 5, 4, step % 2 ? FOLIAGE : FOLIAGE_LIGHT, alpha);
      }
      view.rect(x + width - 9, base - 6, 4, 6, FOLIAGE, alpha);
    }
  }

  drawTree(view, x, alpha) {
    const base = GROUND_Y + 14;
    view.rect(x + 6, base - 22, 4, 22, '#7A5236', alpha);
    view.rect(x, base - 34, 16, 12, FOLIAGE, alpha);
    view.rect(x + 3, base - 40, 11, 9, FOLIAGE, alpha);
    view.rect(x - 2, base - 29, 20, 8, FOLIAGE, alpha);
    view.rect(x + 3, base - 38, 5, 4, FOLIAGE_LIGHT, alpha);
    view.rect(x + 10, base - 30, 4, 3, FOLIAGE_LIGHT, alpha);
  }

  /**
   * Near-band street furniture: whitewashed garden walls with arched gates,
   * terracotta coping, flower pots and a warm lantern. Drawn close to the
   * road so the couple runs *through* the town, never as a gameplay hazard.
   */
  drawStreet(view, scroll, alpha) {
    if (alpha <= 0.02) {
      return;
    }
    const shift = mod(scroll, STREET_TILE);
    for (let base = -shift - STREET_TILE; base < GAME_WIDTH + STREET_TILE; base += STREET_TILE) {
      const ground = GROUND_Y + 6;
      const wallX = base + 8;
      const wallWidth = 176;
      const wallHeight = 28;

      // Whitewashed wall with shaded edge and terracotta coping.
      view.rect(wallX, ground - wallHeight, wallWidth, wallHeight, WALL, alpha);
      view.rect(wallX, ground - wallHeight, wallWidth, 2, '#FFFFFF', alpha * 0.8);
      view.rect(wallX, ground - 4, wallWidth, 4, WALL_SHADE, alpha);
      view.rect(wallX + wallWidth - 3, ground - wallHeight, 3, wallHeight, WALL_SHADE, alpha * 0.8);
      view.rect(wallX - 3, ground - wallHeight - 6, wallWidth + 6, 6, ROOF, alpha);
      view.rect(wallX - 3, ground - wallHeight - 8, wallWidth + 6, 2, ROOF_LIGHT, alpha);
      view.rect(wallX - 3, ground - wallHeight - 1, wallWidth + 6, 1, ROOF_DARK, alpha);

      // Arched garden gate, open to a sunlit courtyard.
      const gateX = wallX + 30;
      view.rect(gateX - 4, ground - wallHeight - 2, 34, 3, WALL_SHADE, alpha);
      view.rect(gateX, ground - 24, 26, 24, '#6BBF63', alpha);
      view.rect(gateX + 2, ground - 27, 22, 4, '#6BBF63', alpha);
      view.rect(gateX + 6, ground - 29, 14, 3, '#6BBF63', alpha);
      view.rect(gateX, ground - 24, 26, 3, '#4E9E4A', alpha * 0.8);
      view.rect(gateX + 4, ground - 18, 4, 3, FLOWER, alpha);
      view.rect(gateX + 16, ground - 12, 4, 3, FLOWER_SUN, alpha);
      view.rect(gateX + 10, ground - 8, 3, 3, FLOWER_LIGHT, alpha);
      view.rect(gateX - 2, ground - 26, 3, 26, WALL_SHADE, alpha);
      view.rect(gateX + 25, ground - 26, 3, 26, WALL_SHADE, alpha);

      // Climbing vine and flower pots along the coping.
      for (let step = 0; step < 5; step += 1) {
        view.rect(wallX + wallWidth - 16 - (step % 2) * 4, ground - 6 - step * 6, 6, 5, step % 2 ? FOLIAGE : FOLIAGE_LIGHT, alpha);
      }
      for (const potX of [wallX + 8, wallX + wallWidth - 40]) {
        view.rect(potX, ground - wallHeight - 13, 10, 6, ROOF, alpha);
        view.rect(potX, ground - wallHeight - 13, 10, 2, ROOF_LIGHT, alpha);
        view.rect(potX + 1, ground - wallHeight - 16, 8, 3, FOLIAGE, alpha);
        view.rect(potX + 1, ground - wallHeight - 18, 3, 2, FLOWER, alpha);
        view.rect(potX + 6, ground - wallHeight - 18, 3, 2, FLOWER_LIGHT, alpha);
      }

      // Gap: a warm lantern and a bush so the street keeps a gentle rhythm.
      const lampX = base + 206;
      view.rect(lampX + 4, ground - 40, 3, 40, WOOD_DARK, alpha);
      view.rect(lampX, ground - 46, 11, 8, '#FFE68A', alpha * 0.9);
      view.rect(lampX + 1, ground - 45, 9, 6, '#FFF6C9', alpha);
      view.rect(lampX - 1, ground - 48, 13, 3, ROOF_DARK, alpha);
      view.rect(lampX + 2, ground - 30, 7, 3, WOOD_DARK, alpha * 0.8);
      view.rect(base + 240, ground - 14, 26, 14, FOLIAGE, alpha);
      view.rect(base + 244, ground - 19, 18, 7, FOLIAGE_LIGHT, alpha);
      view.rect(base + 246, ground - 17, 4, 3, FLOWER, alpha);
      view.rect(base + 256, ground - 12, 4, 3, FLOWER_SUN, alpha);
    }
  }
}
