import {
  GAME_WIDTH, GROUND_Y, PLAYER_X, PIXELS_PER_METER, SOLO_MESSAGES, POPAYAN_MESSAGE,
} from './config.js';
import { drawText, measureText } from './font.js';

/**
 * Emotional traces along the solo path: pixel signs, handwritten notes, neon
 * messages, spray-painted graffiti and short floating thoughts. Positions
 * derive from world distance like the crystals, so they scroll with the road
 * and stay behind the characters, hazards and crystals. The list lives in
 * config (`SOLO_MESSAGES`); spacing guarantees only one is ever on screen.
 *
 * The road also opens with the Popayán sign, which points the way.
 */
export class SignField {
  constructor(messages = SOLO_MESSAGES) {
    this.entries = messages.map((message, index) => ({
      ...message,
      phase: index * 1.9,
    }));
    // The opening sign stands at the very start of the road.
    this.popayan = { ...POPAYAN_MESSAGE, phase: 0 };
  }

  screenX(entry, distance) {
    return PLAYER_X + (entry.distance - distance) * PIXELS_PER_METER;
  }

  draw(view, distance, time) {
    // The Popayán landmark sign is drawn first so it sits behind the others.
    const popayanX = this.screenX(this.popayan, distance);
    if (popayanX > -360 && popayanX < GAME_WIDTH + 360) {
      drawPopayanSign(view, this.popayan, popayanX, time);
    }

    for (const entry of this.entries) {
      const x = this.screenX(entry, distance);
      if (x < -320 || x > GAME_WIDTH + 40) {
        continue;
      }
      switch (entry.kind) {
        case 'neon':
          drawNeon(view, entry, x, time);
          break;
        case 'float':
          drawThought(view, entry, x, time);
          break;
        case 'note':
          drawNote(view, entry, x, time);
          break;
        case 'graffiti':
          drawGraffiti(view, entry, x, time);
          break;
        default:
          drawBoard(view, entry, x);
      }
    }
  }
}

const TEXT_UNIT = 2;

function textWidth(entry) {
  return measureText(entry.text, TEXT_UNIT);
}

// The road opens with a big white landmark in the spirit of the Hollywood
// sign: large uppercase letters standing on the hillside, lattice struts
// behind them, and a chunky arrow pointing the way the runner is travelling.
// It stays well above the road, so nothing about gameplay is obscured.
function drawPopayanSign(view, entry, x, time) {
  const unit = 6;
  const width = measureText(entry.text, unit);
  const height = 9 * unit;
  const left = x - width / 2;
  const baseY = GROUND_Y - 96;
  const top = baseY - height;

  // Lattice struts holding the letters up on the slope.
  for (let strut = 10; strut < width - 12; strut += 46) {
    view.rect(left + strut, baseY, 3, 15, '#6A6F7E');
    view.rect(left + strut + 9, baseY, 3, 15, '#565B6B', 0.85);
    view.rect(left + strut, baseY + 7, 12, 2, '#6A6F7E', 0.7);
    // A little scrub at the foot of each strut roots it in the hillside.
    view.rect(left + strut - 4, baseY + 13, 11, 4, '#3E7A3E', 0.9);
  }

  // Drop shadow first, then the letters, so white stays readable against the
  // storm sky and the bright day sky alike.
  drawText(view, entry.text, x + 4, top + 4, { unit, color: '#1E2433', align: 'center' });
  drawText(view, entry.text, x, top, { unit, color: '#FFFFFF', align: 'center' });

  // Arrow pointing down the road: the runner travels to the right, so the
  // sign points right. It bobs gently to catch the eye without pulsing hard.
  const arrowX = left + width + 26;
  const arrowY = top + height / 2;
  const bob = Math.sin(time * 2.2) * 3;
  drawArrow(view, arrowX + bob, arrowY, '#1E2433', 36);
  drawArrow(view, arrowX + bob, arrowY, '#FFFFFF', 30);
}

// A wooden board on a stake, planted beside the road. When the entry carries
// an arrow, a chunky pixel arrow is painted on the board pointing the way.
function drawBoard(view, entry, x) {
  const arrow = entry.arrow ? ARROW_WIDTH : 0;
  const gap = entry.arrow ? 14 : 0;
  const width = textWidth(entry) + 30 + arrow + gap;
  const height = 34;
  const left = x - width / 2;
  const top = GROUND_Y - 170;

  view.rect(x - 4, top + height, 8, GROUND_Y - top - height, '#3A2414');
  view.rect(x - 4, top + height, 2, GROUND_Y - top - height, '#5B3A22', 0.8);
  view.rect(left, top, width, height, '#5B3A22');
  view.rect(left + 2, top + 2, width - 4, height - 4, '#3A2414');
  view.rect(left, top, width, 2, '#7A4E2E');
  view.rect(left, top + height - 2, width, 2, '#241408');

  // The words sit on the left of the board, the arrow on the right.
  const textCenter = left + 15 + textWidth(entry) / 2;
  drawText(view, entry.text, textCenter, top + 7, {
    unit: TEXT_UNIT, color: '#FFE9C9', align: 'center',
  });
  if (entry.arrow) {
    drawArrow(view, left + 15 + textWidth(entry) + gap + 8, top + height / 2, '#FFE9C9');
  }
}

// Width of the painted arrow on a sign, in game units.
const ARROW_WIDTH = 20;

// A chunky right-pointing arrow drawn from small squares. `size` scales the
// whole shape so the landmark sign can use a much larger version.
function drawArrow(view, x, y, color, size = 20) {
  const s = size / 20;
  // The shaft.
  view.rect(x - 9 * s, y - 2 * s, 9 * s, 4 * s, color);
  // The head: a stack of shrinking squares pointing right.
  for (let step = 0; step < 4; step += 1) {
    const box = (9 - step * 2) * s;
    view.rect(x - 4 * s + step * 2 * s, y - box / 2, box, box, color);
  }
}

// A handwritten note pinned to a leaning stick.
function drawNote(view, entry, x, time) {
  const width = textWidth(entry) + 24;
  const height = 30;
  const left = x - width / 2;
  const top = GROUND_Y - 150 + Math.sin(time * 1.1 + entry.phase) * 1.5;

  view.rect(x - 3, top + height - 4, 6, GROUND_Y - top - height + 4, '#4A3A2E');
  view.rect(left, top, width, height, '#F6E7C6');
  view.rect(left, top, width, 2, '#FFFFFF', 0.7);
  view.rect(left + width - 3, top + 3, 3, height - 3, '#D9C7A2');
  view.rect(left + width - 3, top + height - 6, 3, 6, '#D9C7A2');
  view.rect(x - 2, top - 3, 4, 6, '#FF38B8');
  drawText(view, entry.text, x, top + 5, {
    unit: TEXT_UNIT, color: '#3A2450', align: 'center',
  });
}

// A flickering neon message hung in the storm.
function drawNeon(view, entry, x, time) {
  const top = GROUND_Y - 290;
  const width = textWidth(entry);
  const flicker = Math.sin(time * 7.3 + entry.phase) < -0.92 ? 0.35 : 1;
  view.glow(x - width / 2 - 10, top - 10, width + 20, 38, '#FF38B8', 0.11 * flicker, 2);
  drawText(view, entry.text, x, top, {
    unit: TEXT_UNIT, color: '#FF69D4', align: 'center', shadow: '#7A1050',
  });
  drawText(view, entry.text, x, top, {
    unit: TEXT_UNIT, color: '#FFF5FC', align: 'center', alpha: 0.35 * flicker,
  });
}

// A short thought drifting in the air, no support needed. Little pixel dogs
// can sit beside the words — the pixel renderer has no emoji font, so the
// dogs are drawn by hand.
function drawThought(view, entry, x, time) {
  const dogs = entry.dogs ?? 0;
  const dogWidth = dogs > 0 ? DOG_SLOT * dogs : 0;
  const width = textWidth(entry) + dogWidth;
  const top = GROUND_Y - 215 + Math.sin(time * 1.4 + entry.phase) * 6;
  const glow = 0.09 + 0.04 * Math.sin(time * 2.2 + entry.phase);
  view.glow(x - width / 2 - 8, top - 8, width + 16, 34, '#C8A7FF', glow, 2);
  drawText(view, entry.text, x - dogWidth / 2, top, {
    unit: TEXT_UNIT, color: '#E9DBFF', align: 'center', alpha: 0.92,
  });
  if (dogs > 0) {
    const textLeft = x - dogWidth / 2 - textWidth(entry) / 2;
    for (let index = 0; index < dogs; index += 1) {
      const dogX = textLeft + 6 + index * DOG_SLOT;
      // The dogs bounce gently, one after the other.
      const hop = Math.abs(Math.sin(time * 3 + index * 1.1)) * 3;
      drawPixelDog(view, dogX, top + 14 - hop);
    }
  }
}

// Horizontal space each little dog takes on the sign.
const DOG_SLOT = 16;

// A hand-drawn pixel dog: a round head, two ears, a snout and a tail.
function drawPixelDog(view, x, y) {
  const fur = '#E8B98F';
  const furDark = '#C4946B';

  // Tail.
  view.rect(x - 6, y - 4, 3, 3, furDark);
  // Body and head.
  view.rect(x - 4, y - 8, 9, 8, fur);
  view.rect(x - 4, y - 8, 9, 2, furDark);
  // Ears.
  view.rect(x - 5, y - 12, 3, 5, furDark);
  view.rect(x + 2, y - 12, 3, 5, furDark);
  // Snout and eye.
  view.rect(x + 4, y - 6, 3, 3, '#FFF5FC');
  view.rect(x + 2, y - 9, 2, 2, '#241A2E');
  view.rect(x + 5, y - 5, 2, 2, '#241A2E');
}

// Spray paint on a dark wall, with a couple of drips.
function drawGraffiti(view, entry, x, time) {
  const width = textWidth(entry) + 26;
  const height = 32;
  const left = x - width / 2;
  const top = GROUND_Y - 190;
  view.rect(left, top, width, height, '#241745');
  view.rect(left, top, width, 2, '#3A2A66');
  view.rect(left, top + height - 2, width, 2, '#160C2E');
  const pulse = 0.75 + 0.25 * Math.sin(time * 2 + entry.phase);
  drawText(view, entry.text, x, top + 6, {
    unit: TEXT_UNIT, color: '#8FE06A', align: 'center', alpha: pulse,
  });
  view.rect(x - 6, top + height, 2, 8, '#8FE06A', 0.5 * pulse);
  view.rect(x + 12, top + height, 2, 5, '#8FE06A', 0.4 * pulse);
}
