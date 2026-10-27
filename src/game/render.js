import { GAME_WIDTH, GAME_HEIGHT, ART } from './config.js';

const snap = (value) => Math.round(value);

/**
 * Renders the game into a fixed 480x270 pixel buffer, then blits it to the
 * display canvas with nearest-neighbor scaling. All drawing is expressed in
 * game units (960x540) and snapped to the shared art grid, so characters,
 * backgrounds and particles share one pixel density and never blur.
 */
export class PixelView {
  constructor(canvas) {
    this.canvas = canvas;
    this.context = canvas.getContext('2d');
    this.buffer = document.createElement('canvas');
    this.buffer.width = GAME_WIDTH / ART;
    this.buffer.height = GAME_HEIGHT / ART;
    this.contextBuffer = this.buffer.getContext('2d');
    if (!this.context || !this.contextBuffer) {
      throw new Error('Canvas 2D is not available in this browser.');
    }
    this.context.imageSmoothingEnabled = false;
    this.contextBuffer.imageSmoothingEnabled = false;
    this.resize();
  }

  resize() {
    const bounds = this.canvas.getBoundingClientRect();
    const cssWidth = bounds.width || GAME_WIDTH;
    const cssHeight = bounds.height || cssWidth * (GAME_HEIGHT / GAME_WIDTH);
    const ratio = Math.min(window.devicePixelRatio || 1, 2);
    const width = Math.max(1, Math.round(cssWidth * ratio));
    const height = Math.max(1, Math.round(cssHeight * ratio));
    if (this.canvas.width !== width || this.canvas.height !== height) {
      this.canvas.width = width;
      this.canvas.height = height;
    }
    this.context.imageSmoothingEnabled = false;
  }

  begin() {
    this.contextBuffer.setTransform(1, 0, 0, 1, 0, 0);
    this.contextBuffer.globalAlpha = 1;
    this.contextBuffer.clearRect(0, 0, this.buffer.width, this.buffer.height);
  }

  // Offsets the whole buffer so a landed kick can jolt the frame. The
  // offset is applied in buffer pixels, which is what the canvas transform
  // works in.
  shake(offsetX, offsetY) {
    const context = this.contextBuffer;
    context.setTransform(1, 0, 0, 1, 0, 0);
    if (offsetX === 0 && offsetY === 0) {
      return;
    }
    context.translate(Math.round(offsetX / ART), Math.round(offsetY / ART));
  }

  present() {
    this.context.globalAlpha = 1;
    this.context.drawImage(
      this.buffer, 0, 0, this.buffer.width, this.buffer.height,
      0, 0, this.canvas.width, this.canvas.height,
    );
  }

  // Cinematic framing for the reunion: copies a sub-rectangle of the buffer
  // back over the whole buffer with nearest-neighbour scaling. The world is
  // drawn once, at full size and fully inside the viewport, so nothing can
  // clip, distort or leave the screen — the camera only chooses a crop. UI
  // drawn after this call stays in screen space.
  cutscene(rect) {
    const width = Math.max(8, Math.round(rect.width));
    const height = Math.max(8, Math.round(rect.height));
    const x = Math.max(0, Math.min(this.buffer.width - width, Math.round(rect.x)));
    const y = Math.max(0, Math.min(this.buffer.height - height, Math.round(rect.y)));
    const context = this.contextBuffer;
    context.save();
    context.setTransform(1, 0, 0, 1, 0, 0);
    context.globalAlpha = 1;
    context.imageSmoothingEnabled = false;
    context.drawImage(this.buffer, x, y, width, height, 0, 0, this.buffer.width, this.buffer.height);
    context.restore();
  }

  rect(x, y, width, height, color, alpha = 1) {
    const context = this.contextBuffer;
    const left = snap(x / ART);
    const top = snap(y / ART);
    const right = snap((x + width) / ART);
    const bottom = snap((y + height) / ART);
    if (right <= left || bottom <= top) {
      return;
    }
    context.globalAlpha = alpha;
    context.fillStyle = color;
    context.fillRect(left, top, right - left, bottom - top);
    context.globalAlpha = 1;
  }

  // Stepped, snapped line used for limbs and diagonal edges.
  line(x0, y0, x1, y1, thickness, color, alpha = 1) {
    const steps = Math.max(1, Math.ceil(Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0)) / (ART * 0.7)));
    for (let index = 0; index <= steps; index += 1) {
      const t = index / steps;
      this.rect(
        x0 + (x1 - x0) * t - thickness / 2,
        y0 + (y1 - y0) * t - thickness / 2,
        thickness, thickness, color, alpha,
      );
    }
  }

  // Cheap layered glow; far more predictable than canvas shadow blur.
  glow(x, y, width, height, color, alpha = 0.12, layers = 2) {
    for (let layer = 1; layer <= layers; layer += 1) {
      const spread = layer * ART * 2;
      this.rect(x - spread, y - spread, width + spread * 2, height + spread * 2, color, alpha / layer);
    }
  }

  // Draws a subtree horizontally mirrored around a game-unit center. Used for
  // the reunion kiss, where the boy has to face left without a second rig.
  mirror(centerX, draw) {
    const context = this.contextBuffer;
    context.save();
    context.setTransform(-1, 0, 0, 1, (centerX * 2) / ART, 0);
    draw();
    context.restore();
  }

  circle(centerX, centerY, radius, color, alpha = 1) {
    for (let dy = -radius; dy <= radius; dy += ART) {
      const halfWidth = Math.sqrt(Math.max(0, radius * radius - dy * dy));
      this.rect(centerX - halfWidth, centerY + dy, halfWidth * 2, ART, color, alpha);
    }
  }

  // Smooth gradients are reserved for the sky and vignette; sprites stay crisp.
  fillVerticalGradient(stops) {
    const context = this.contextBuffer;
    const gradient = context.createLinearGradient(0, 0, 0, this.buffer.height);
    for (const [offset, color] of stops) {
      gradient.addColorStop(offset, color);
    }
    context.globalAlpha = 1;
    context.fillStyle = gradient;
    context.fillRect(0, 0, this.buffer.width, this.buffer.height);
  }

  vignette() {
    const context = this.contextBuffer;
    const gradient = context.createRadialGradient(
      this.buffer.width / 2, this.buffer.height * 0.45, this.buffer.width * 0.3,
      this.buffer.width / 2, this.buffer.height * 0.45, this.buffer.width * 0.72,
    );
    gradient.addColorStop(0, 'rgba(8, 3, 18, 0)');
    gradient.addColorStop(1, 'rgba(8, 3, 18, 0.55)');
    context.fillStyle = gradient;
    context.fillRect(0, 0, this.buffer.width, this.buffer.height);
  }
}
