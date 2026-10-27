import { KICK_KEYS } from './config.js';

const JUMP_KEYS = new Set(['Space', 'ArrowUp']);
const PAUSE_KEYS = new Set(['KeyP', 'Escape']);
// Enter advances the reunion dialogue on its own; Space doubles as the
// advance key there because the game routes it while the scene is frozen.
const ADVANCE_KEYS = new Set(['Enter', 'NumpadEnter']);

export class Input {
  constructor({ onJump, onPause, onKick = () => {}, onAdvance = () => {} }) {
    this.onJump = onJump;
    this.onPause = onPause;
    this.onKick = onKick;
    this.onAdvance = onAdvance;
    this.heldJumpKeys = new Set();
    this.kickKeys = new Set(KICK_KEYS);

    this.handleKeyDown = this.handleKeyDown.bind(this);
    this.handleKeyUp = this.handleKeyUp.bind(this);
    this.clearHeldKeys = this.clearHeldKeys.bind(this);

    window.addEventListener('keydown', this.handleKeyDown);
    window.addEventListener('keyup', this.handleKeyUp);
    window.addEventListener('blur', this.clearHeldKeys);
  }

  handleKeyDown(event) {
    if (event.target instanceof HTMLElement && event.target.closest('input, textarea, select, [contenteditable="true"]')) {
      return;
    }

    if (JUMP_KEYS.has(event.code)) {
      event.preventDefault();
      if (event.repeat || this.heldJumpKeys.has(event.code)) {
        return;
      }

      this.heldJumpKeys.add(event.code);
      this.onJump();
      return;
    }

    if (ADVANCE_KEYS.has(event.code)) {
      event.preventDefault();
      if (!event.repeat) {
        this.onAdvance();
      }
      return;
    }

    if (this.kickKeys.has(event.code)) {
      event.preventDefault();
      if (!event.repeat) {
        this.onKick();
      }
      return;
    }

    if (PAUSE_KEYS.has(event.code)) {
      event.preventDefault();
      if (!event.repeat) {
        this.onPause();
      }
    }
  }

  handleKeyUp(event) {
    this.heldJumpKeys.delete(event.code);
  }

  clearHeldKeys() {
    this.heldJumpKeys.clear();
  }
}
