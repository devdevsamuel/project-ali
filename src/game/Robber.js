import { ROBBER_APPROACH_SECONDS, ROBBER_THREAT_SECONDS } from './config.js';

/**
 * The petty thief. He is not armed and he does not shoot: he slips out from
 * behind the runner, asks for the wallet, takes the money and runs off.
 *
 * The encounter is a small scripted beat with four phases:
 *   sneak  he walks in from behind, closing the distance;
 *   threat he stops, waves and demands the wallet;
 *   steal  he takes the cash (the game applies the balance change);
 *   flee   he bolts away and the encounter is over.
 *
 * He never touches the player's hitbox and never deals damage, so the
 * encounter can interrupt the run without endangering it.
 */
export class Robber {
  constructor(groundY) {
    this.groundY = groundY;
    this.width = 34;
    this.height = 52;
    this.x = 0;
    this.y = groundY - this.height;
    this.state = 'sneak';
    this.time = 0;
    this.phaseTime = 0;
    this.done = false;
    this.bobPhase = 0;
  }

  // Places the thief just behind the runner and starts the approach.
  start(playerX) {
    // He comes in from behind, on the ground, so he is clearly the one
    // sneaking up on the runner.
    this.x = playerX - 58;
    this.y = this.groundY - this.height;
    this.state = 'sneak';
    this.time = 0;
    this.phaseTime = 0;
    this.done = false;
  }

  // Advances the encounter. Returns an event name when the game has to react:
  // 'steal' when the money is taken, 'done' when the thief is gone.
  update(deltaTime, playerX) {
    this.time += deltaTime;
    this.phaseTime += deltaTime;
    this.bobPhase += deltaTime;

    if (this.state === 'sneak') {
      // He hurries up from behind until he is right next to the runner.
      const target = playerX - 34;
      const step = 78 * deltaTime;
      this.x += Math.min(step, Math.max(0, target - this.x));
      if (this.phaseTime >= ROBBER_APPROACH_SECONDS) {
        this.setPhase('threat');
      }
      return null;
    }

    if (this.state === 'threat') {
      // He keeps pace with the runner so he never falls behind.
      this.x += (playerX - 34 - this.x) * Math.min(1, deltaTime * 4);
      if (this.phaseTime >= ROBBER_THREAT_SECONDS) {
        this.setPhase('steal');
        return 'steal';
      }
      return null;
    }

    if (this.state === 'steal') {
      this.x += (playerX - 30 - this.x) * Math.min(1, deltaTime * 6);
      if (this.phaseTime >= 0.45) {
        this.setPhase('flee');
      }
      return null;
    }

    // Flee: he bolts forward and off the screen.
    this.x += 300 * deltaTime;
    if (this.x > 1400) {
      this.done = true;
      return 'done';
    }
    return null;
  }

  setPhase(phase) {
    this.state = phase;
    this.phaseTime = 0;
  }

  // Never lethal: the thief has no hitbox at all.
  getBounds() {
    return null;
  }

  draw(view) {
    const cx = this.x + this.width / 2;
    const ground = this.groundY;
    const bob = Math.sin(this.bobPhase * 9) * 2;
    const base = ground + bob;

    view.rect(cx - 14, ground - 2, 28, 4, '#0B0618', 0.45);

    // Legs and sneakers.
    view.rect(cx - 7, base - 16, 6, 12, '#3A2A66');
    view.rect(cx + 2, base - 16, 6, 12, '#2E2152');
    view.rect(cx - 9, base - 6, 9, 5, '#1B1230');
    view.rect(cx + 1, base - 6, 9, 5, '#141022');

    // A striped tee under an open vest.
    view.rect(cx - 8, base - 38, 16, 22, '#2FB8B0');
    view.rect(cx - 8, base - 34, 16, 3, '#1E8A85');
    view.rect(cx - 8, base - 26, 16, 3, '#1E8A85');
    view.rect(cx - 10, base - 39, 8, 23, '#241745');
    view.rect(cx + 3, base - 39, 8, 23, '#1C1136');
    view.rect(cx - 10, base - 39, 8, 3, '#3A2A66');

    // A masked head with a beanie; he faces the runner on his right.
    view.rect(cx - 7, base - 51, 14, 12, '#E8B98F');
    view.rect(cx + 1, base - 46, 8, 4, '#1B1230');
    view.rect(cx + 3, base - 45, 3, 2, '#FFF5FC');
    view.rect(cx - 9, base - 55, 18, 6, '#2E2152');
    view.rect(cx - 9, base - 51, 18, 2, '#1C1136');

    // A little satchel — this is the money bag he runs off with.
    view.rect(cx - 13, base - 30, 7, 8, '#C4693B');
    view.rect(cx - 13, base - 30, 7, 2, '#E08A52');

    if (this.state === 'threat') {
      // A raised hand and a warning bubble above him.
      const wave = Math.sin(this.time * 12) * 3;
      view.rect(cx + 6, base - 44, 5, 10, '#2FB8B0');
      view.rect(cx + 6, base - 54 + wave, 5, 11, '#E8B98F');
      const markX = cx;
      const markY = base - 72;
      view.rect(markX - 11, markY - 2, 22, 20, '#FFF5FC', 0.92);
      view.rect(markX - 9, markY, 18, 16, '#B6303C');
      view.rect(markX - 1, markY + 3, 3, 7, '#FFF5FC');
      view.rect(markX - 1, markY + 12, 3, 3, '#FFF5FC');
    } else if (this.state === 'steal') {
      // Both hands out, grabbing the wallet.
      view.rect(cx + 5, base - 40, 12, 5, '#E8B98F');
      view.rect(cx + 5, base - 34, 12, 5, '#DDA484');
    } else if (this.state === 'flee') {
      // Arms up as he bolts.
      view.rect(cx + 5, base - 46, 5, 12, '#2FB8B0');
      view.rect(cx + 6, base - 56, 5, 11, '#E8B98F');
    } else {
      // Sneaking: hunched over, tiptoeing.
      view.rect(cx + 4, base - 36, 5, 10, '#E8B98F');
    }
  }
}
