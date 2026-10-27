import { ALI_THINK_SECONDS } from './config.js';

/**
 * Reunion dialogue content only: what is said, by whom, how long each beat
 * stays on screen and which pose/expression the characters hold. Progression
 * lives in Game (the reunion state), rendering lives in dialogueRender.js,
 * so new lines can be added here without touching either.
 *
 * Beat 5 is Ali's deliberate silence: it has no line and advances on its own
 * after `hold` seconds, and it ignores input, so a held key can never skip
 * her pause.
 */
export const REUNION_BEATS = [
  {
    id: 'apology',
    speaker: 'boy',
    line: 'Perdóname, mi amor, te amo con todo mi corazón.',
    hold: 0.6,
    boy: { state: 'kneel', face: { eye: 'open', mouth: 'sad', brow: 1.6 } },
    ali: { state: 'idle', face: { eye: 'wide', mouth: 'small', look: 1, brow: 1.2 } },
  },
  {
    id: 'light',
    speaker: 'boy',
    line: 'Eres la luz de mi vida.',
    hold: 0.45,
    boy: { state: 'kneel', face: { eye: 'open', mouth: 'small', look: 1, brow: 0.6 } },
    ali: { state: 'idle', face: { eye: 'open', mouth: 'small', look: 1, brow: 0.5 } },
  },
  {
    id: 'fear',
    speaker: 'boy',
    line: 'No te quiero perder </3',
    hold: 0.45,
    boy: { state: 'kneel', face: { eye: 'open', mouth: 'sad', look: 1, brow: 2 } },
    ali: { state: 'idle', face: { eye: 'open', mouth: 'small', look: 1, brow: 0.2 } },
  },
  {
    id: 'chance',
    speaker: 'boy',
    line: 'Déjame demostrarte que ya soy mejor.',
    hold: 0.45,
    boy: { state: 'kneel', face: { eye: 'open', mouth: 'small', look: 1, brow: 1 } },
    ali: { state: 'idle', face: { eye: 'open', mouth: 'small', look: 1, brow: 0.3 } },
  },
  {
    id: 'ali-pause',
    speaker: 'ali',
    line: '',
    hold: ALI_THINK_SECONDS,
    auto: true,
    boy: { state: 'kneel', face: { eye: 'open', mouth: 'small', look: 1, brow: 1.6 } },
    ali: { state: 'think' },
  },
  {
    id: 'ali-answer',
    speaker: 'ali',
    line: 'Eres un chamako perro estúpido, pero te amo.',
    hold: 0.5,
    boy: { state: 'kneel', face: { eye: 'open', mouth: 'small', look: 1, brow: 0.6 } },
    ali: { state: 'idle', face: { eye: 'open', mouth: 'smile', look: 1, brow: -0.5 } },
  },
  {
    id: 'ali-condition',
    speaker: 'ali',
    line: 'Tendrás que demostrarlo.',
    hold: 0.5,
    boy: { state: 'kneel', face: { eye: 'happy', mouth: 'smile', look: 1, brow: -0.5 } },
    ali: { state: 'idle', face: { eye: 'happy', mouth: 'smile', look: 1, brow: -1 } },
  },
];

// Name shown in the dialogue box for each speaker, plus the accent color.
export const SPEAKER_LABELS = { boy: 'TÚ', ali: 'ALI' };
export const SPEAKER_COLORS = { boy: '#B7FF4A', ali: '#FF6FB8' };
