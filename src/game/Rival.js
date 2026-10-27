import { drawText, measureText, wrapText } from './font.js';

/**
 * Solo-stage obstacles reimagined as original, cartoonish rival characters:
 * fictional stand-ins for romantic frustration, never based on real people.
 * Three silhouettes with readable behaviour — a flashy diva who simply blocks
 * the path, a sarcastic rival who sidesteps, and a fast runner who closes in.
 * All of them can be jumped or kicked; a kicked rival tumbles out of the way.
 */
const VARIANTS = {
  diva: {
    width: 46, height: 64,
    hair: '#C13B8F', hairDark: '#8F2A6B', hairShine: '#F79ED0',
    top: '#2FB8B0', topDark: '#1E8A85', accent: '#7A4BC9',
    skin: '#F7C9A9', skinShade: '#E0A989', shoe: '#F2C14E', shoeDark: '#D99A2E',
  },
  snark: {
    width: 40, height: 54,
    hair: '#2E5A6B', hairDark: '#1C3B47', hairShine: '#5FA0B8',
    top: '#8FA83A', topDark: '#6C8229', accent: '#E8622C',
    skin: '#F2C6A6', skinShade: '#DBA886', shoe: '#3A2A66', shoeDark: '#241745',
  },
  dash: {
    width: 36, height: 56,
    hair: '#6B3FA0', hairDark: '#4A2A73', hairShine: '#B98CF0',
    top: '#E8452C', topDark: '#B62E1C', accent: '#FFD86E',
    skin: '#F4C3A2', skinShade: '#DDA484', shoe: '#FFF5FC', shoeDark: '#D9CBDD',
  },
};

const DASH_EXTRA_SPEED = 66;
const SNARK_DODGE = 14;

// Dark contour used behind every major block, so each rival keeps a crisp
// silhouette against the storm. A soft light halo sits outside it: in the
// dark, wet solo stage the pale rim is what makes her pop out of the rain
// and shadow, while the dark line keeps the edge crisp on lighter patches.
const OUTLINE = '#140E22';
const HALO = '#FFF5FC';

function contour(view, x, y, width, height, alpha = 0.95) {
  view.rect(x - 4, y - 4, width + 8, height + 8, HALO, alpha * 0.2);
  view.rect(x - 2, y - 2, width + 4, height + 4, OUTLINE, alpha);
}

// Teasing bubble metrics: text at the same unit the dialogue uses, wrapped so
// the longest phrase fits without clipping.
const SIGN_UNIT = 2;
const SIGN_MAX_WIDTH = 180;
const SIGN_PAD_X = 8;
const SIGN_PAD_Y = 5;

export class Rival {
  constructor(x, groundY, variant = 'diva') {
    const spec = VARIANTS[variant] ?? VARIANTS.diva;
    this.variant = VARIANTS[variant] ? variant : 'diva';
    this.x = x;
    this.groundY = groundY;
    this.width = spec.width;
    this.height = spec.height;
    this.y = groundY - this.height;
    this.colors = spec;
    this.kickable = true;
    this.knocked = false;
    this.remove = false;
    this.offsetX = 0;
    this.time = 0;
    this.knockTime = 0;
    this.knockVelocity = { x: 0, y: 0 };
    this.phase = Math.random() * 6.28;
  }

  update(travelDistance, deltaTime = 0) {
    this.time += deltaTime;
    if (this.knocked) {
      this.knockTime += deltaTime;
      this.x += this.knockVelocity.x * deltaTime - travelDistance;
      this.knockVelocity.y += 1500 * deltaTime;
      this.y += this.knockVelocity.y * deltaTime;
      if (this.y + this.height >= this.groundY) {
        this.y = this.groundY - this.height;
        this.knockVelocity.y = 0;
      }
      if (this.knockTime > 1.05) {
        this.remove = true;
      }
      return;
    }

    this.x -= travelDistance;
    if (this.variant === 'snark') {
      // Sidestep: her hitbox moves with her, so a kick still has to be timed.
      this.offsetX = Math.sin(this.time * 3.1 + this.phase) * SNARK_DODGE;
    } else {
      this.offsetX = 0;
    }
    if (this.variant === 'dash') {
      this.x -= DASH_EXTRA_SPEED * deltaTime;
    }
  }

  // One kick sends her tumbling clear of the path.
  hit() {
    if (this.knocked) {
      return false;
    }
    this.knocked = true;
    this.knockTime = 0;
    this.knockVelocity = { x: 300, y: -280 };
    return true;
  }

  getBounds() {
    if (this.knocked) {
      return null;
    }
    return {
      x: this.x + this.offsetX + 4,
      y: this.y + 5,
      width: this.width - 8,
      height: this.height - 7,
    };
  }

  draw(view) {
    if (this.knocked) {
      // The tumble takes the sign with it: kicked rivals stop talking.
      this.drawFallen(view);
      return;
    }
    const cx = this.x + this.width / 2 + this.offsetX;
    view.rect(cx - this.width / 2 - 4, this.groundY - 2, this.width + 8, 4, '#0B0618', 0.5);
    if (this.variant === 'snark') {
      this.drawSnark(view, cx);
    } else if (this.variant === 'dash') {
      this.drawDashRival(view, cx);
    } else {
      this.drawDiva(view, cx);
    }
    if (this.sign) {
      this.drawSign(view, cx);
    }
  }

  // A small speech bubble with one teasing line, drawn above her shoulder and
  // biased to the right so it never sits over Samuel (he is always to the
  // left). It fades and rises in once, then simply rides the entity.
  drawSign(view, cx) {
    const sign = this.sign;
    if (!sign.lines) {
      sign.lines = wrapText(sign.text, SIGN_MAX_WIDTH, SIGN_UNIT);
    }
    const lineW = Math.max(...sign.lines.map((line) => measureText(line, SIGN_UNIT)));
    const width = lineW + SIGN_PAD_X * 2;
    const lineHeight = 20;
    const height = sign.lines.length * lineHeight + SIGN_PAD_Y * 2;
    const halfW = width / 2;

    const intro = Math.min(1, this.time / 0.35);
    const bob = Math.sin(this.time * 1.8 + sign.phase) * 1.5;
    // Keep the whole bubble to the right of her centre so it can never cover
    // the runner while she closes in on him.
    const centerX = cx + Math.max(20, halfW - 30);
    const top = this.groundY - this.height - height - 6 + bob + (1 - intro) * 4;
    const alpha = intro;

    // Tail pointing back down at her head.
    const tailX = centerX - halfW + 14;
    view.rect(tailX - 5, top + height, 10, 4, '#FF69D4', alpha * 0.9);
    view.rect(tailX - 3, top + height + 4, 6, 3, '#150C2E', alpha);
    // Border, dark slab, then the wrapped text: the same language as the
    // kick comments, so the whole game shares one speech-bubble style.
    view.rect(centerX - halfW - 3, top - 3, width + 6, height + 6, '#FF69D4', alpha * 0.85);
    view.rect(centerX - halfW, top, width, height, '#150C2E', alpha);
    view.rect(centerX - halfW + 3, top + 3, width - 6, 2, '#C8A7FF', alpha * 0.6);
    drawText(view, sign.lines, centerX, top + SIGN_PAD_Y, {
      unit: SIGN_UNIT, color: '#FFF5FC', align: 'center', alpha,
    });
  }

  // Flashy and overconfident: huge teased curls, shades, hoop earrings,
  // hand on the hip and an occasional hair flip and wink. She does not move;
  // she simply refuses to budge.
  drawDiva(view, cx) {
    const c = this.colors;
    const ground = this.groundY;
    const sway = Math.sin(this.time * 2.3 + this.phase) * 1.6;
    const flip = ((this.time + this.phase) % 3.2) < 0.55;
    const wink = ((this.time + this.phase) % 4.4) < 0.35;
    const cxTop = cx + sway;

    // Contours first: every major block gets a dark edge so she reads
    // against both the dark storm and the bright city walls.
    contour(view, cxTop + 5, ground - 78, 26, 15); // streaming ponytail
    contour(view, cxTop - 13, ground - 73, 26, 21); // teased hair
    contour(view, cxTop - 9, ground - 67, 17, 15); // head
    contour(view, cxTop - 14, ground - 57, 28, 16); // jacket + shoulders
    contour(view, cxTop - 15, ground - 38, 30, 15); // flared skirt
    contour(view, cx - 12, ground - 22, 8, 15); // back leg
    contour(view, cx + 2, ground - 22, 8, 15); // front leg
    contour(view, cx - 14, ground - 9, 13, 9); // back boot
    contour(view, cx + 1, ground - 9, 13, 9); // front boot
    contour(view, cxTop - 15, ground - 67, 8, 17); // raised arm
    contour(view, cxTop + 7, ground - 52, 9, 13); // arm on the hip

    // Ponytail streaming behind her (to the right, away from the runner).
    view.rect(cxTop + 6, ground - 70, 16, 6, c.hairDark);
    view.rect(cxTop + 12, ground - 74, 12, 6, c.hair);
    view.rect(cxTop + 18, ground - 77, 8, 5, c.hair);
    view.rect(cxTop + 16, ground - 76, 6, 2, c.hairShine, 0.8);

    // Legs, heeled boots and a flared skirt.
    view.rect(cx - 11, ground - 20, 7, 12, c.skin);
    view.rect(cx + 3, ground - 20, 7, 12, c.skinShade);
    view.rect(cx - 13, ground - 8, 11, 7, c.shoe);
    view.rect(cx + 2, ground - 8, 11, 7, c.shoeDark);
    view.rect(cx - 13, ground - 8, 11, 2, '#FFF5FC', 0.7);
    view.rect(cx + 2, ground - 8, 11, 2, '#FFF5FC', 0.5);
    // A stacked heel on each boot: one more confident detail in silhouette.
    view.rect(cx - 13, ground - 2, 4, 2, c.shoeDark);
    view.rect(cx + 8, ground - 2, 4, 2, c.shoeDark);
    for (let row = 0; row < 3; row += 1) {
      const t = row / 2;
      const half = 9 + t * 4;
      view.rect(cxTop - half, ground - 36 + row * 6, half * 2, 7, c.accent);
      view.rect(cxTop - half, ground - 36 + row * 6, 2, 7, '#FFF5FC', 0.25);
    }

    // Jacket with big shoulder pads, lapels and a bare midriff.
    view.rect(cxTop - 9, ground - 54, 18, 12, c.top);
    view.rect(cxTop - 9, ground - 54, 18, 2, c.topDark);
    view.rect(cxTop + 6, ground - 54, 3, 12, c.topDark);
    view.rect(cxTop - 7, ground - 44, 14, 4, c.skin);
    view.rect(cxTop - 12, ground - 55, 6, 5, c.top);
    view.rect(cxTop + 6, ground - 55, 6, 5, c.top);
    view.rect(cxTop - 6, ground - 54, 4, 9, c.accent);
    view.rect(cxTop + 2, ground - 54, 4, 9, c.accent, 0.85);
    // Belt with a gold buckle at the midriff.
    view.rect(cxTop - 8, ground - 45, 16, 2, '#1B1230');
    view.rect(cxTop - 1, ground - 45, 4, 2, '#F2C14E');
    view.rect(cxTop - 1, ground - 45, 2, 1, '#FFF5FC', 0.8);

    // Hands: one on the hip, the other flipping her hair when the mood hits.
    view.rect(cxTop + 8, ground - 46, 5, 5, c.skinShade);
    view.rect(cxTop + 10, ground - 50, 3, 6, c.skinShade);
    if (flip) {
      view.rect(cxTop - 13, ground - 64, 4, 12, c.skin);
      view.rect(cxTop - 14, ground - 68, 5, 5, c.skin);
    } else {
      view.rect(cxTop - 12, ground - 50, 4, 12, c.skin);
      view.rect(cxTop - 12, ground - 39, 5, 5, c.skin);
    }

    // Head, curls and shades — the face sits on the left, toward the runner.
    view.rect(cxTop - 8, ground - 66, 15, 13, c.skin);
    view.rect(cxTop - 8, ground - 66, 15, 2, c.skinShade, 0.5);
    view.rect(cxTop - 12, ground - 72, 22, 9, c.hair);
    view.rect(cxTop - 12, ground - 64, 5, 8, c.hairDark);
    view.rect(cxTop + 4, ground - 64, 5, 8, c.hair);
    view.rect(cxTop - 9, ground - 71, 6, 3, c.hairShine, 0.85);
    // A gold streak in the curls: style, and extra contrast in the silhouette.
    view.rect(cxTop + 1, ground - 70, 4, 3, '#F2C14E', 0.9);
    // Hoop earring.
    view.rect(cxTop - 9, ground - 55, 2, 4, '#F2C14E');
    view.rect(cxTop - 9, ground - 52, 2, 2, '#FFF5FC', 0.7);
    // Star shades with a glint — or a cheeky wink under them.
    view.rect(cxTop - 10, ground - 61, 11, 4, '#1B1230');
    if (wink) {
      view.rect(cxTop - 8, ground - 60, 7, 1, '#FFFFFF', 0.9);
    } else {
      view.rect(cxTop - 9, ground - 60, 3, 2, '#FFFFFF', 0.9);
    }
    // Confident smirk.
    view.rect(cxTop - 6, ground - 55, 5, 2, '#B6264E');
    view.rect(cxTop - 4, ground - 56, 3, 1, '#B6264E');
  }

  // Sarcastic: bob haircut, round glasses, a trailing scarf, arms crossed,
  // always sidestepping with a smug raised eyebrow.
  drawSnark(view, cx) {
    const c = this.colors;
    const ground = this.groundY;
    const lean = -Math.sign(Math.sin(this.time * 3.1 + this.phase)) * 2;
    const cxTop = cx + lean;
    const bob = Math.abs(Math.sin(this.time * 3.1 + this.phase)) * 2;

    // Contours first, so she reads on any background.
    contour(view, cx - 10, ground - 19 - bob * 0.4, 8, 13); // legs
    contour(view, cx - 12, ground - 7, 12, 8); // back shoe
    contour(view, cx, ground - 7, 12, 8); // front shoe
    contour(view, cx - 9, ground - 29, 18, 12); // shorts
    contour(view, cxTop - 10, ground - 46 - bob * 0.5, 20, 21); // jacket
    contour(view, cxTop - 11, ground - 41 - bob * 0.5, 22, 12); // crossed arms
    contour(view, cxTop - 8, ground - 57 - bob * 0.6, 16, 15); // head
    contour(view, cxTop - 10, ground - 61 - bob * 0.6, 20, 10); // bob hair

    // Sneakers and legs, with a racing stripe across each shoe.
    view.rect(cx - 9, ground - 18 - bob * 0.4, 6, 10, c.skin);
    view.rect(cx + 2, ground - 18 - bob * 0.4, 6, 10, c.skinShade);
    view.rect(cx - 11, ground - 6, 10, 6, c.shoe);
    view.rect(cx + 1, ground - 6, 10, 6, c.shoeDark);
    view.rect(cx - 11, ground - 6, 10, 2, '#FFF5FC', 0.6);
    view.rect(cx + 1, ground - 6, 10, 2, '#FFF5FC', 0.45);
    view.rect(cx - 9, ground - 3, 6, 1, c.accent, 0.9);
    view.rect(cx + 3, ground - 3, 6, 1, c.accent, 0.75);

    // Shorts and a slouchy jacket.
    view.rect(cx - 8, ground - 28, 16, 10, '#3A2A66');
    view.rect(cx - 8, ground - 28, 16, 2, '#4A3A7E');
    view.rect(cxTop - 9, ground - 44 - bob * 0.5, 18, 17, c.top);
    view.rect(cxTop - 9, ground - 44 - bob * 0.5, 18, 3, c.topDark);
    view.rect(cxTop - 9, ground - 32 - bob * 0.5, 18, 3, c.accent);

    // Crossed arms: two slabs over the chest, with a scarf tail behind.
    view.rect(cxTop + 5, ground - 47 - bob * 0.5, 12, 4, c.accent);
    view.rect(cxTop + 13, ground - 45 - bob * 0.5, 5, 9, c.accent);
    view.rect(cxTop + 13, ground - 37 - bob * 0.5, 4, 5, c.accent, 0.75);
    view.rect(cxTop - 10, ground - 39 - bob * 0.5, 20, 5, c.skin);
    view.rect(cxTop - 10, ground - 34 - bob * 0.5, 20, 5, c.skinShade);
    view.rect(cxTop - 12, ground - 40 - bob * 0.5, 4, 8, c.topDark);
    view.rect(cxTop + 8, ground - 40 - bob * 0.5, 4, 8, c.topDark);

    // Head, bob haircut, round glasses and a smug half-lidded stare.
    view.rect(cxTop - 7, ground - 56 - bob * 0.6, 14, 13, c.skin);
    view.rect(cxTop - 9, ground - 60 - bob * 0.6, 18, 8, c.hair);
    view.rect(cxTop - 9, ground - 53 - bob * 0.6, 4, 8, c.hairDark);
    view.rect(cxTop + 5, ground - 53 - bob * 0.6, 4, 8, c.hairDark);
    view.rect(cxTop - 8, ground - 59 - bob * 0.6, 7, 2, c.hairShine, 0.8);
    // One eyebrow raised higher than the other: pure attitude.
    view.rect(cxTop - 8, ground - 54 - bob * 0.6, 5, 1, '#1C3B47');
    view.rect(cxTop - 1, ground - 53 - bob * 0.6, 5, 1, '#1C3B47');
    view.rect(cxTop - 8, ground - 52 - bob * 0.6, 6, 5, '#1B1230', 0.85);
    view.rect(cxTop - 1, ground - 52 - bob * 0.6, 6, 5, '#1B1230', 0.85);
    view.rect(cxTop - 7, ground - 51 - bob * 0.6, 2, 2, '#FFFFFF', 0.85);
    view.rect(cxTop, ground - 51 - bob * 0.6, 2, 2, '#FFFFFF', 0.85);
    // Stud earring and a lopsided smirk.
    view.rect(cxTop - 8, ground - 47 - bob * 0.6, 2, 2, '#F2C14E');
    view.rect(cxTop - 5, ground - 48 - bob * 0.6, 6, 3, '#5A1B45');
    view.rect(cxTop - 3, ground - 49 - bob * 0.6, 4, 1, '#5A1B45');
  }

  // Fast and determined: leaning sprint, streaming ponytail, pumping arms,
  // wristbands and a competitive grin.
  drawDashRival(view, cx) {
    const c = this.colors;
    const ground = this.groundY;
    const phase = this.time * 11 + this.phase;
    const lean = 5;
    const cxTop = cx - 2;

    // Contours first: limbs get a dark pass behind them so they never melt
    // into a bright wall or a dark storm.
    contour(view, cx - 17, ground - 24, 34, 22); // legs + shoes
    contour(view, cxTop - 10, ground - 48 - 0, 20, 22); // torso
    contour(view, cxTop - 15, ground - 47, 30, 13); // arms
    contour(view, cxTop - 11 - lean, ground - 61, 20, 16); // head
    contour(view, cxTop - 12 - lean, ground - 67, 30, 10); // hair + band

    // Pumping legs.
    const frontLeg = Math.sin(phase) * 8;
    view.line(cx - 4, ground - 22, cx - 10 + frontLeg, ground - 12, 8, OUTLINE);
    view.line(cx - 4, ground - 22, cx - 10 + frontLeg, ground - 12, 6, c.skin);
    view.line(cx - 10 + frontLeg, ground - 12, cx - 12 + frontLeg * 1.4, ground - 4, 7, OUTLINE);
    view.line(cx - 10 + frontLeg, ground - 12, cx - 12 + frontLeg * 1.4, ground - 4, 5, c.skinShade);
    view.rect(cx - 17 + frontLeg * 1.4, ground - 6, 13, 7, OUTLINE);
    view.rect(cx - 16 + frontLeg * 1.4, ground - 5, 11, 5, c.shoe);
    view.rect(cx - 15 + frontLeg * 1.4, ground - 3, 9, 1, c.accent, 0.9);
    view.line(cx + 3, ground - 22, cx + 8 - frontLeg, ground - 12, 8, OUTLINE);
    view.line(cx + 3, ground - 22, cx + 8 - frontLeg, ground - 12, 6, c.skinShade);
    view.line(cx + 8 - frontLeg, ground - 12, cx + 10 - frontLeg * 1.4, ground - 4, 7, OUTLINE);
    view.line(cx + 8 - frontLeg, ground - 12, cx + 10 - frontLeg * 1.4, ground - 4, 5, c.skin);
    view.rect(cx + 3 - frontLeg * 1.4, ground - 6, 13, 7, OUTLINE);
    view.rect(cx + 4 - frontLeg * 1.4, ground - 5, 11, 5, c.shoeDark);
    view.rect(cx + 5 - frontLeg * 1.4, ground - 3, 9, 1, c.accent, 0.75);

    // Shorts and tank top, tilted forward.
    view.rect(cxTop - 7, ground - 30, 15, 9, '#2A1F4A');
    for (let row = 0; row < 3; row += 1) {
      view.rect(cxTop - 7 - lean + row, ground - 46 + row * 5, 14, 6, row % 2 === 0 ? c.top : c.topDark);
    }
    view.rect(cxTop - 9 - lean, ground - 47, 17, 3, c.accent);
    // A little lightning patch on the tank: her team colours, and a bright
    // detail that survives at running speed.
    view.rect(cxTop + 1 - lean, ground - 43, 3, 4, '#FFF5FC', 0.95);
    view.rect(cxTop - 1 - lean, ground - 40, 5, 3, '#FFF5FC', 0.95);
    view.rect(cxTop - 3 - lean, ground - 37, 5, 3, c.accent, 0.95);

    // Pumping arms with wristbands at the ends.
    const armSwing = Math.sin(phase + Math.PI) * 7;
    view.line(cxTop - 6, ground - 44, cxTop - 12 + armSwing, ground - 36, 6, OUTLINE);
    view.line(cxTop - 6, ground - 44, cxTop - 12 + armSwing, ground - 36, 4, c.skin);
    view.rect(cxTop - 13 + armSwing, ground - 38, 5, 3, c.accent);
    view.line(cxTop + 5, ground - 44, cxTop + 10 - armSwing, ground - 37, 6, OUTLINE);
    view.line(cxTop + 5, ground - 44, cxTop + 10 - armSwing, ground - 37, 4, c.skinShade);
    view.rect(cxTop + 9 - armSwing, ground - 39, 5, 3, c.accent, 0.85);

    // Head with a headband (tails streaming), ponytail flying back, and a
    // determined glare over a competitive grin.
    view.rect(cxTop - 8 - lean, ground - 58, 14, 12, c.skin);
    view.rect(cxTop - 14 - lean, ground - 63, 7, 3, c.accent);
    view.rect(cxTop - 17 - lean, ground - 61, 6, 3, c.accent, 0.85);
    view.rect(cxTop - 6 - lean, ground - 54, 3, 3, '#1B1230');
    view.rect(cxTop - 2 - lean, ground - 53, 3, 2, '#1B1230');
    view.rect(cxTop - 3 - lean, ground - 50, 6, 2, '#5A1B45');
    view.rect(cxTop - 1 - lean, ground - 51, 4, 1, '#FFF5FC', 0.85);
    view.rect(cxTop - 9 - lean, ground - 60, 16, 5, c.accent);
    view.rect(cxTop - 10 - lean, ground - 65, 17, 6, c.hair);
    view.rect(cxTop + 4, ground - 64, 16, 5, c.hair);
    view.rect(cxTop + 12, ground - 60, 12, 4, c.hairDark);
    view.rect(cxTop - 8 - lean, ground - 64, 6, 2, c.hairShine, 0.8);
  }

  // Shared tumble: knocked flat on her back, legs up, X eyes, quick fade.
  drawFallen(view) {
    const c = this.colors;
    const alpha = Math.max(0, 1 - this.knockTime / 1.05);
    const bounce = Math.abs(Math.sin(this.knockTime * 9)) * 4 * alpha;
    const ground = this.groundY - bounce;
    const cx = this.x + this.width / 2;

    view.rect(cx - 22, ground - 14, 14, 12, c.skin, alpha);
    view.rect(cx - 24, ground - 17, 18, 6, c.hair, alpha);
    view.rect(cx - 24, ground - 17, 18, 2, c.hairShine, alpha * 0.7);
    // X eyes and an open mouth.
    view.rect(cx - 19, ground - 11, 2, 2, '#1B1230', alpha);
    view.rect(cx - 16, ground - 11, 2, 2, '#1B1230', alpha);
    view.rect(cx - 18, ground - 11, 2, 2, '#1B1230', alpha);
    view.rect(cx - 19, ground - 9, 2, 2, '#1B1230', alpha);
    view.rect(cx - 18, ground - 6, 4, 3, '#5A1B45', alpha);
    // Body and limbs flung out.
    view.rect(cx - 9, ground - 12, 20, 10, c.top, alpha);
    view.rect(cx - 9, ground - 12, 20, 2, c.topDark, alpha);
    view.rect(cx - 8, ground - 22, 4, 10, c.skin, alpha);
    view.rect(cx + 2, ground - 24, 4, 12, c.skinShade, alpha);
    view.rect(cx + 10, ground - 20, 10, 5, c.shoe, alpha);
    view.rect(cx + 12, ground - 12, 10, 5, c.shoeDark, alpha);
    view.rect(cx - 14, ground - 6, 8, 4, c.accent, alpha);
  }
}
