import { drawText, measureText } from './font.js';
import { NEON } from './palette.js';
import { GAME_WIDTH } from './config.js';

/**
 * Big, loud kick comments. Each one pops near the impact point, drifts
 * upward and fades out. They live in the canvas (not in the DOM toast) so
 * they sit right next to the kick and scale with the action.
 *
 * A comment is a plain object: { text, x, y, life, maxLife, scale, color }.
 * The field owns the list and the draw pass; the game only pushes one in.
 */
export class CommentField {
  constructor() {
    this.comments = [];
  }

  clear() {
    this.comments = [];
  }

  // Adds a comment at the impact point. `scale` grows the text; a scale
  // above 1 makes it a headline. The x is nudged so a long line never runs
  // off the edge of the screen.
  push(text, x, y, options = {}) {
    const { scale = 1, color = NEON.white, accent = NEON.hotPink } = options;
    const life = options.life ?? 0.9;
    const width = measureText(text, 2 * scale);
    // Keep the whole line inside the frame.
    const margin = 12;
    const clamped = Math.max(margin + width / 2, Math.min(GAME_WIDTH - margin - width / 2, x));
    this.comments.push({
      text,
      x: clamped,
      y,
      scale,
      color,
      accent,
      life,
      maxLife: life,
      rise: options.rise ?? 34,
    });
  }

  update(deltaTime) {
    for (const comment of this.comments) {
      comment.life -= deltaTime;
      // Comments drift up as they fade.
      comment.y -= (comment.rise / comment.maxLife) * deltaTime;
    }
    this.comments = this.comments.filter((comment) => comment.life > 0);
  }

  draw(view) {
    for (const comment of this.comments) {
      const alpha = Math.min(1, comment.life / comment.maxLife);
      // The text grows in fast, then holds, then fades.
      const age = 1 - alpha;
      const pop = age < 0.18 ? 0.5 + (age / 0.18) * 0.5 : 1;
      const unit = 2 * comment.scale * pop;
      const width = measureText(comment.text, unit);
      const x = comment.x;
      const y = comment.y;

      // A dark slab behind the words so the comment stays readable over the
      // storm, the city and the effects.
      view.rect(x - width / 2 - 8, y - 4, width + 16, 18 * comment.scale, '#120A26', alpha * 0.72);
      view.rect(x - width / 2 - 8, y - 4, width + 16, 2, comment.accent, alpha * 0.9);
      view.rect(x - width / 2 - 8, y + 18 * comment.scale - 6, width + 16, 2, comment.accent, alpha * 0.9);

      // A shadow copy first, then the bright face on top.
      drawText(view, comment.text, x + unit / 2, y + unit / 2, {
        unit, color: '#2A0F3E', align: 'center', alpha: alpha * 0.85,
      });
      drawText(view, comment.text, x, y, {
        unit, color: comment.color, align: 'center', alpha,
      });
    }
  }
}
