import { GAME_WIDTH, GAME_HEIGHT, GROUND_Y } from './config.js';
import { drawText, measureText, wrapText } from './font.js';
import { SPEAKER_LABELS, SPEAKER_COLORS } from './dialogue.js';

// Classic RPG dialogue window: double border, a name tab, and text revealed
// with a typewriter effect. It is drawn in screen space after the reunion
// camera cut, so the box never zooms and never covers the characters, whose
// feet rest on the top edge of the window.
const BOX_X = 26;
const BOX_Y = GROUND_Y + 6;
const BOX_WIDTH = GAME_WIDTH - 52;
const BOX_HEIGHT = GAME_HEIGHT - BOX_Y - 10;
const TEXT_UNIT = 2;
const TEXT_X = BOX_X + 26;
const TEXT_Y = BOX_Y + 26;
const CHARS_PER_SECOND = 44;

export function drawDialogueBox(view, beat, beatTime, hold, canAdvance = true) {
  // Shadow, white border, violet border, dark fill.
  view.rect(BOX_X, BOX_Y, BOX_WIDTH, BOX_HEIGHT, '#0B0618', 0.55);
  view.rect(BOX_X + 3, BOX_Y + 3, BOX_WIDTH - 6, BOX_HEIGHT - 6, '#FFF5FC');
  view.rect(BOX_X + 7, BOX_Y + 7, BOX_WIDTH - 14, BOX_HEIGHT - 14, '#2A1F4A');
  view.rect(BOX_X + 9, BOX_Y + 9, BOX_WIDTH - 18, BOX_HEIGHT - 18, '#150C2E', 0.96);

  drawNameTab(view, beat);

  if (!beat.line) {
    drawThinkingDots(view, beatTime);
    return;
  }

  const innerWidth = BOX_WIDTH - 52;
  const lines = wrapText(beat.line, innerWidth, TEXT_UNIT);
  const total = lines.reduce((sum, line) => sum + Array.from(line).length, 0);
  const revealed = Math.floor(Math.max(0, beatTime - 0.12) * CHARS_PER_SECOND);
  const visible = [];
  let remaining = revealed;
  for (const line of lines) {
    const characters = Array.from(line);
    visible.push(characters.slice(0, Math.max(0, remaining)).join(''));
    remaining -= characters.length;
  }

  drawText(view, visible, TEXT_X, TEXT_Y, {
    unit: TEXT_UNIT,
    color: '#FFF5FC',
    shadow: '#2A1248',
  });

  const textDone = revealed >= total;
  const mayAdvance = beatTime >= hold && canAdvance;
  // The advance mark only shows when advancing actually does something: while
  // the current recording is still finishing, the box waits quietly.
  if (textDone && mayAdvance && Math.sin(beatTime * 6) > -0.4) {
    drawAdvanceMark(view);
  }
}

function drawNameTab(view, beat) {
  const label = SPEAKER_LABELS[beat.speaker];
  if (!label) {
    return;
  }
  const color = SPEAKER_COLORS[beat.speaker] ?? '#FFF5FC';
  const tagWidth = measureText(label, TEXT_UNIT) + 22;
  const tagX = BOX_X + 16;
  const tagY = BOX_Y - 7;
  const tagHeight = 24;
  view.rect(tagX, tagY, tagWidth, tagHeight, '#150C2E');
  view.rect(tagX, tagY, tagWidth, 3, color);
  view.rect(tagX, tagY + tagHeight - 3, tagWidth, 3, color);
  view.rect(tagX, tagY, 3, tagHeight, color);
  view.rect(tagX + tagWidth - 3, tagY, 3, tagHeight, color);
  drawText(view, label, tagX + 11, tagY + 3, { unit: TEXT_UNIT, color });
}

// Ali's silence: three slow dots instead of words.
function drawThinkingDots(view, beatTime) {
  for (let index = 0; index < 3; index += 1) {
    const lit = (beatTime * 2.4 - index * 0.35) % 3 > 0.4;
    view.rect(TEXT_X + index * 12, TEXT_Y + 8, 6, 6, '#C8A7FF', lit ? 0.95 : 0.35);
  }
}

function drawAdvanceMark(view) {
  const markX = BOX_X + BOX_WIDTH - 40;
  const markY = BOX_Y + BOX_HEIGHT - 22;
  const widths = [12, 8, 4];
  widths.forEach((width, index) => {
    view.rect(markX + (12 - width) / 2, markY + index * 3, width, 3, '#FF69D4');
  });
}
