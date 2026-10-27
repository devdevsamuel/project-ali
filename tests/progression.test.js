import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  CRYSTAL_COUNT, CRYSTAL_DISTANCES, SOLO_MESSAGES, KICK_QUIPS, KICK_KEYS,
  PIXELS_PER_METER, GAME_WIDTH, POPAYAN_MESSAGE, STARTING_MONEY, ROBBED_MONEY,
  RAIN_BASE_DROPS, RAIN_MAX_INTENSITY, RAIN_INTENSITY_PER_CRYSTAL,
} from '../src/game/config.js';
import { hasGlyph } from '../src/game/font.js';
import { BOY_SPEC } from '../src/game/characterSpec.js';

test('the solo section needs exactly four crystals', () => {
  assert.equal(CRYSTAL_COUNT, 4);
  assert.ok(CRYSTAL_DISTANCES.length >= CRYSTAL_COUNT);
});

test('the UI and source have no leftover seven-crystal references', () => {
  const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
  const main = readFileSync(new URL('../src/main.js', import.meta.url), 'utf8');
  for (const source of [html, main]) {
    assert.ok(!/seven/i.test(source), 'no "seven" wording remains');
    assert.ok(!/\/\s*7\b/.test(source), 'no "/7" counter remains');
  }
  assert.match(html, /0\/4/, 'the HUD counter shows four crystals');
});

test('the five personal messages are exact, well spaced and renderable', () => {
  assert.deepEqual(SOLO_MESSAGES.map((message) => message.text), [
    'Te amo, Ali',
    'Lo siento, mi amor',
    'Vuelve, te necesito',
    'I NEEED U </3',
    'Te extrañamos',
  ]);

  const screenMeters = GAME_WIDTH / PIXELS_PER_METER;
  SOLO_MESSAGES.forEach((message, index) => {
    if (index > 0) {
      const gap = message.distance - SOLO_MESSAGES[index - 1].distance;
      assert.ok(gap > screenMeters, `messages ${index} and ${index + 1} share a screen`);
    }
    for (const crystal of CRYSTAL_DISTANCES.slice(0, CRYSTAL_COUNT)) {
      assert.ok(
        Math.abs(crystal - message.distance) > 8,
        `message "${message.text}" sits on top of a crystal`,
      );
    }
    for (const character of Array.from(message.text)) {
      if (character === ' ') {
        continue;
      }
      assert.ok(hasGlyph(character), `missing glyph for "${character}"`);
    }
  });
});

test('the combat quips match the brief and are all renderable', () => {
  assert.deepEqual(KICK_QUIPS, ['Aléjate, bichi', 'Muere', 'Buen intento']);
  for (const quip of KICK_QUIPS) {
    for (const character of Array.from(quip)) {
      if (character === ' ') {
        continue;
      }
      assert.ok(hasGlyph(character), `missing glyph for "${character}" in "${quip}"`);
    }
  }
});

test('the kick keys are configurable and avoid jump, pause and advance', () => {
  assert.ok(KICK_KEYS.length > 0);
  for (const key of KICK_KEYS) {
    assert.ok(!['Space', 'ArrowUp', 'KeyP', 'Escape', 'Enter'].includes(key));
  }
});

test('the road opens with the Popayán sign pointing the way', () => {
  assert.equal(POPAYAN_MESSAGE.text, 'Popayán');
  assert.equal(POPAYAN_MESSAGE.arrow, 'right');
  // It stands before the first personal message, so it opens the run.
  assert.ok(POPAYAN_MESSAGE.distance < SOLO_MESSAGES[0].distance);
  for (const character of Array.from(POPAYAN_MESSAGE.text)) {
    assert.ok(hasGlyph(character), `missing glyph for "${character}"`);
  }
});

test('the "Te extrañamos" sign carries little pixel dogs', () => {
  const thought = SOLO_MESSAGES.find((message) => message.text === 'Te extrañamos');
  assert.ok(thought, 'the thought sign exists');
  assert.equal(thought.kind, 'float');
  assert.ok(thought.dogs >= 2, 'the sign shows at least two dogs');
});

test('the rain gets heavier as the crystals come in', () => {
  assert.ok(RAIN_INTENSITY_PER_CRYSTAL > 0, 'the storm has room to build');
  assert.ok(RAIN_MAX_INTENSITY > RAIN_INTENSITY_PER_CRYSTAL);
  assert.ok(RAIN_BASE_DROPS > 0);
});

test('the boy wears a gray zip-up jacket', () => {
  const { top, topDark, hem, trim } = BOY_SPEC.colors;
  // A gray outfit: every channel is close to the others and none is a
  // saturated neon color.
  const grays = [top, topDark, hem, trim];
  for (const color of grays) {
    const r = parseInt(color.slice(1, 3), 16);
    const g = parseInt(color.slice(3, 5), 16);
    const b = parseInt(color.slice(5, 7), 16);
    const spread = Math.max(r, g, b) - Math.min(r, g, b);
    assert.ok(spread <= 40, `${color} is not a gray tone (spread ${spread})`);
    assert.ok(r > 60 && r < 220, `${color} is not a mid gray`);
  }
  // The zip is the bright accent line on the chest.
  assert.notEqual(trim, top);
});

test('the money starts positive and ends in the red', () => {
  assert.equal(STARTING_MONEY, 100);
  assert.equal(ROBBED_MONEY, -20);
  assert.ok(ROBBED_MONEY < 0);
});
