/**
 * Couple-stage hazards for the bright colonial street: low barriers, fallen
 * flower pots, broken cobblestones and small gaps in the road. They keep the
 * same interface as the solo rivals (update / getBounds / draw plus a
 * `kickable` flag), but they are props, not characters, so the kick leaves
 * them untouched. Every silhouette carries a dark outline and a warm accent
 * so hazards never blend into the white facades behind them.
 */
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

  // Low street barrier: white plank with terracotta stripes and sturdy legs.
  drawBarrier(view) {
    const { x, y, width, height } = this;
    const top = y + 4;
    view.rect(x - 2, this.groundY - 3, width + 4, 4, '#6B4A32', 0.45);
    view.rect(x + 4, top, 6, this.groundY - top, '#8C7C66');
    view.rect(x + width - 10, top, 6, this.groundY - top, '#7C6D58');
    view.rect(x, top, width, 12, '#F3E9D6');
    view.rect(x, top, width, 2, '#FFFFFF');
    view.rect(x, top + 10, width, 2, '#C9B99E');
    for (let stripe = 0; stripe < 3; stripe += 1) {
      view.rect(x + 6 + stripe * (width / 3), top + 2, width / 6, 8, '#C4693B');
    }
    view.rect(x, top - 3, 4, 6, '#E8A03D');
    view.rect(x + width - 4, top - 3, 4, 6, '#E8A03D');
  }

  // A toppled flower pot with its bloom spilled across the cobbles.
  drawPot(view, time) {
    const { x, width } = this;
    const ground = this.groundY;
    const sway = Math.sin(time * 1.8 + this.phase) * 1;
    view.rect(x - 3, ground - 3, width + 6, 4, '#6B4A32', 0.45);
    // The pot lies on its side.
    view.rect(x + 8, ground - 20, 22, 17, '#C4693B');
    view.rect(x + 8, ground - 20, 22, 3, '#E08A52');
    view.rect(x + 26, ground - 22, 6, 21, '#A9532C');
    view.rect(x + 26, ground - 22, 6, 3, '#C4693B');
    view.rect(x + 8, ground - 4, 22, 3, '#8C4524');
    // Spilled soil and a fallen bloom with a couple of petals.
    view.rect(x, ground - 6, 12, 5, '#6B4A32');
    view.rect(x - 2 + sway, ground - 12, 8, 6, '#FF69D4');
    view.rect(x, ground - 14, 4, 3, '#FFB3E8');
    view.rect(x + 10 + sway, ground - 9, 4, 3, '#FFE66D');
    view.rect(x - 8, ground - 3, 4, 2, '#FF69D4', 0.8);
    view.rect(x + 2, ground - 16, 3, 3, '#FFE66D', 0.7);
    // The plant's leaves still sticking out of the mouth of the pot.
    view.rect(x + 4, ground - 16, 6, 4, '#3E8E4E');
    view.rect(x + 2, ground - 18, 5, 3, '#5CB86A');
  }

  // Broken cobblestones heaped on the road.
  drawCobble(view) {
    const { x, y, width, height } = this;
    view.rect(x - 2, this.groundY - 3, width + 4, 4, '#6B4A32', 0.4);
    view.rect(x, y + height * 0.45, width, height * 0.55, '#A8977C');
    view.rect(x + width * 0.12, y, width * 0.76, height * 0.5, '#C6B79E');
    view.rect(x + width * 0.12, y, width * 0.76, 2, '#EFE6D2');
    view.rect(x + width * 0.4, y + 2, 3, height * 0.4, '#8C7C66');
    view.rect(x + width * 0.2, y + height * 0.5, width * 0.45, 2, '#8C7C66');
    view.rect(x + width * 0.62, y + height * 0.62, 2, height * 0.3, '#8C7C66');
    view.rect(x + 3, y + height * 0.62, 4, 3, '#E8A03D', 0.8);
  }

  // A small gap in the cobbles: dark below, chipped rim above.
  drawGap(view) {
    const { x, width } = this;
    const ground = this.groundY;
    view.rect(x, ground - 3, width, 4, '#5A4632');
    view.rect(x + 2, ground - 1, width - 4, 26, '#2A1D14');
    view.rect(x + 4, ground + 3, width - 8, 22, '#150D08');
    view.rect(x, ground - 3, 6, 3, '#8C7C66');
    view.rect(x + width - 8, ground - 3, 8, 3, '#8C7C66');
    view.rect(x + 10, ground - 5, 5, 3, '#C6B79E');
    view.rect(x + width - 18, ground - 4, 4, 2, '#C6B79E');
  }
}

// Variant pool for the couple stage, with the size each one is spawned at.
export const COUPLE_VARIANTS = [
  { variant: 'barrier', width: 50, height: 40 },
  { variant: 'pot', width: 42, height: 44 },
  { variant: 'cobble', width: 46, height: 26 },
  { variant: 'gap', width: 58, height: 22 },
];
