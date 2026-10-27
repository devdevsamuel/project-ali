/**
 * Couple-stage hazards for the bright colonial street: low barriers, fallen
 * flower pots, broken cobblestones and small gaps in the road. They keep the
 * same interface as the solo rivals (update / getBounds / draw plus a
 * `kickable` flag), but they are props, not characters, so the kick leaves
 * them untouched.
 *
 * Visibility: the street behind them is a bright white colonial city, so
 * every prop is painted in a vivid amber-orange with a deep violet-black
 * contour and a small cream highlight. The palette is deliberately far from
 * Ali's pink, Benjamin's onesie, the crystals and the signs, and the drawn
 * silhouette always matches the hitbox returned by getBounds().
 */
const mod = (value, divisor) => ((value % divisor) + divisor) % divisor;

// High-contrast hazard palette.
const OUTLINE = '#2A0B3A';
const MAIN = '#FF8A1F';
const LIGHT = '#FFC46B';
const DARK = '#C25C10';
const HIGHLIGHT = '#FFF3D6';

export class Obstacle {
  constructor(x, groundY, width, height, variant = 'barrier') {
    this.x = x;
    this.groundY = groundY;
    this.variant = variant;
    this.width = width;
    this.height = variant === 'gap' ? 22 : height;
    this.y = groundY - this.height;
    this.kickable = false;
    this.knocked = false;
    this.remove = false;
    this.phase = Math.random() * 6.28;
  }

  update(distance) {
    this.x -= distance;
  }

  getBounds() {
    if (this.variant === 'gap') {
      return {
        x: this.x + 6,
        y: this.groundY - 18,
        width: this.width - 12,
        height: 18,
      };
    }
    return {
      x: this.x + 2,
      y: this.y + 2,
      width: this.width - 4,
      height: this.height - 2,
    };
  }

  draw(view, time) {
    // A warm halo so the prop separates from the pale road and the white
    // facades at a glance. Purely visual — the hitbox never changes.
    view.glow(this.x - 4, this.y - 4, this.width + 8, this.height + 8, MAIN, 0.1, 2);
    if (this.variant === 'pot') {
      this.drawPot(view, time);
    } else if (this.variant === 'cobble') {
      this.drawCobble(view, time);
    } else if (this.variant === 'gap') {
      this.drawGap(view, time);
    } else {
      this.drawBarrier(view, time);
    }
  }

  // Low street barrier: a bright plank with dark warning stripes, standing
  // on two legs. The contour hugs the silhouette, so nothing shows through.
  drawBarrier(view, time) {
    const { x, y, width, height } = this;
    const top = y + 4;
    const glint = 0.55 + 0.45 * Math.sin(time * 2.6 + this.phase);
    view.rect(x - 2, this.groundY - 3, width + 4, 4, OUTLINE, 0.5);
    // Contour: one around the plank, one around each leg.
    view.rect(x - 2, top - 4, width + 4, 16, OUTLINE, 0.95);
    view.rect(x + 2, top, 10, this.groundY - top, OUTLINE, 0.95);
    view.rect(x + width - 12, top, 10, this.groundY - top, OUTLINE, 0.95);
    view.rect(x + 4, top, 6, this.groundY - top, DARK);
    view.rect(x + width - 10, top, 6, this.groundY - top, DARK);
    view.rect(x, top, width, 12, MAIN);
    view.rect(x, top, width, 2, LIGHT);
    view.rect(x, top + 10, width, 2, DARK);
    for (let stripe = 0; stripe < 3; stripe += 1) {
      view.rect(x + 6 + stripe * (width / 3), top + 2, width / 6, 8, OUTLINE, 0.9);
    }
    view.rect(x, top - 3, 4, 6, HIGHLIGHT);
    view.rect(x + width - 4, top - 3, 4, 6, HIGHLIGHT);
    // Warm highlight travelling along the top: the line you have to clear.
    const glintX = x + mod(time * 46 + this.phase * 20, width + 24) - 12;
    view.rect(glintX, top - 1, 12, 2, HIGHLIGHT, 0.8 * glint);
  }

  // A toppled flower pot with its bloom spilled across the cobbles.
  drawPot(view, time) {
    const { x, width } = this;
    const ground = this.groundY;
    const sway = Math.sin(time * 1.8 + this.phase) * 1;
    view.rect(x - 3, ground - 3, width + 6, 4, OUTLINE, 0.5);
    // Tight contours around pot, neck, soil and bloom — no filled box.
    view.rect(x + 6, ground - 23, 28, 22, OUTLINE, 0.95);
    view.rect(x - 4, ground - 9, 20, 8, OUTLINE, 0.95);
    view.rect(x - 5, ground - 19, 15, 14, OUTLINE, 0.9);
    // The pot lies on its side.
    view.rect(x + 8, ground - 20, 22, 17, MAIN);
    view.rect(x + 8, ground - 20, 22, 3, LIGHT);
    view.rect(x + 26, ground - 22, 6, 21, DARK);
    view.rect(x + 26, ground - 22, 6, 3, MAIN);
    view.rect(x + 8, ground - 4, 22, 3, DARK);
    // Spilled soil and a fallen bloom with a couple of petals.
    view.rect(x, ground - 6, 12, 5, OUTLINE);
    view.rect(x - 2 + sway, ground - 12, 8, 6, '#FF3D9A');
    view.rect(x, ground - 14, 4, 3, '#FFB3E8');
    view.rect(x + 10 + sway, ground - 9, 4, 3, HIGHLIGHT);
    view.rect(x - 8, ground - 3, 4, 2, '#FF3D9A', 0.85);
    view.rect(x + 2, ground - 16, 3, 3, HIGHLIGHT, 0.8);
    // The plant's leaves still sticking out of the mouth of the pot.
    view.rect(x + 4, ground - 16, 6, 4, '#3E8E4E');
    view.rect(x + 2, ground - 18, 5, 3, '#5CB86A');
  }

  // Broken cobblestones heaped on the road.
  drawCobble(view, time) {
    const { x, y, width, height } = this;
    const glint = 0.5 + 0.5 * Math.sin(time * 2.2 + this.phase);
    view.rect(x - 2, this.groundY - 3, width + 4, 4, OUTLINE, 0.45);
    // Tight contours around each slab of the heap.
    view.rect(x - 2, y + height * 0.45 - 2, width + 4, height * 0.55 + 4, OUTLINE, 0.95);
    view.rect(x + width * 0.12 - 2, y - 2, width * 0.76 + 4, height * 0.5 + 4, OUTLINE, 0.95);
    view.rect(x, y + height * 0.45, width, height * 0.55, MAIN);
    view.rect(x + width * 0.12, y, width * 0.76, height * 0.5, LIGHT);
    view.rect(x + width * 0.12, y, width * 0.76, 2, HIGHLIGHT);
    view.rect(x + width * 0.4, y + 2, 3, height * 0.4, DARK);
    view.rect(x + width * 0.2, y + height * 0.5, width * 0.45, 2, DARK);
    view.rect(x + width * 0.62, y + height * 0.62, 2, height * 0.3, DARK);
    view.rect(x + 3, y + height * 0.62, 4, 3, HIGHLIGHT, 0.85);
    // Warm edge along the top: the height you have to clear.
    view.rect(x + width * 0.12, y - 1, width * 0.76, 2, HIGHLIGHT, 0.4 + 0.45 * glint);
  }

  // A small gap in the cobbles: dark below, bright chipped stones along the
  // near edge and a lit lip on the far side, so it reads as a hole to jump
  // rather than a black box.
  drawGap(view, time) {
    const { x, width } = this;
    const ground = this.groundY;
    const glint = 0.5 + 0.5 * Math.sin(time * 2.4 + this.phase);
    // Dark interior, kept shallow so it sits in the road surface band.
    view.rect(x + 2, ground - 1, width - 4, 17, OUTLINE);
    view.rect(x + 4, ground + 3, width - 8, 11, '#150D08');
    // Lit far lip: depth without leaving the surface.
    view.rect(x + 5, ground + 12, width - 10, 3, '#6B5A46', 0.9);
    view.rect(x + 5, ground + 12, width - 10, 1, '#8C7C66', 0.8);
    // Near rim: broken stones right at the road line, with a warm glint.
    view.rect(x - 2, ground - 5, width + 4, 5, OUTLINE, 0.95);
    view.rect(x, ground - 4, 8, 4, MAIN);
    view.rect(x + width - 10, ground - 4, 10, 4, MAIN);
    view.rect(x + 12, ground - 4, 6, 3, LIGHT);
    view.rect(x + width - 22, ground - 3, 5, 2, LIGHT);
    view.rect(x + 4, ground - 4, width - 8, 2, HIGHLIGHT, 0.4 + 0.5 * glint);
    // Shadowed road edge either side of the opening.
    view.rect(x - 5, ground - 2, 4, 6, '#5A4632', 0.8);
    view.rect(x + width + 1, ground - 2, 4, 6, '#5A4632', 0.8);
  }
}

// Variant pool for the couple stage, with the size each one is spawned at.
export const COUPLE_VARIANTS = [
  { variant: 'barrier', width: 50, height: 40 },
  { variant: 'pot', width: 42, height: 44 },
  { variant: 'cobble', width: 46, height: 26 },
  { variant: 'gap', width: 58, height: 22 },
];
