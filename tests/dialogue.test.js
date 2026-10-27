import test from 'node:test';
import assert from 'node:assert/strict';
import { REUNION_BEATS, SPEAKER_LABELS } from '../src/game/dialogue.js';
import { hasGlyph } from '../src/game/font.js';

const EXPECTED = [
  ['boy', 'Perdóname, mi amor, te amo con todo mi corazón.'],
  ['boy', 'Eres la luz de mi vida.'],
  ['boy', 'No te quiero perder </3'],
  ['boy', 'Déjame demostrarte que ya soy mejor.'],
  ['ali', ''], // Beat 5: her deliberate silence.
  ['ali', 'Eres un chamako perro estúpido, pero te amo.'],
  ['ali', 'Tendrás que demostrarlo.'],
];

test('the reunion dialogue has seven beats in the exact order', () => {
  assert.equal(REUNION_BEATS.length, 7);
  REUNION_BEATS.forEach((beat, index) => {
    assert.equal(beat.speaker, EXPECTED[index][0], `speaker of beat ${index + 1}`);
    assert.equal(beat.line, EXPECTED[index][1], `line of beat ${index + 1}`);
  });
});

test('Ali pauses as beat 5: silent, deliberate, and auto-advancing', () => {
  const pause = REUNION_BEATS[4];
  assert.equal(pause.line, '');
  assert.equal(pause.auto, true);
  assert.ok(pause.hold >= 2, 'the pause lasts a few seconds');
  assert.equal(pause.ali.state, 'think');
});

test('the boy kneels through his four lines', () => {
  for (let index = 0; index < 4; index += 1) {
    assert.equal(REUNION_BEATS[index].boy.state, 'kneel');
    assert.equal(REUNION_BEATS[index].speaker, 'boy');
    assert.ok(REUNION_BEATS[index].hold >= 0.4, 'each line stays readable');
  }
});

test('every dialogue character exists in the pixel font', () => {
  const text = `${REUNION_BEATS.map((beat) => beat.line).join('')}${
    Object.values(SPEAKER_LABELS).join('')}`;
  for (const character of Array.from(text)) {
    if (character === ' ') {
      continue;
    }
    assert.ok(hasGlyph(character), `missing glyph for "${character}"`);
  }
});
