// Pixel-art rendering of the shared character rig. Everything is drawn from
// small snapped clusters on the shared art grid: fine silhouettes, a couple of
// shade tones per material, and selective neon highlights.
//
// `spec.style` drives the few parts that must differ between the two runners:
// shoes, hair (straight strands vs. defined ringlets) and outfit details.

function drawArm(view, spec, shoulder, arm, isFront) {
  const colors = spec.colors;
  const sleeve = isFront ? colors.top : colors.topDark;
  const skin = isFront ? colors.skin : colors.skinShade;
  if (spec.dress) {
    // Puff sleeve keeps her shoulder line soft and readable.
    view.rect(shoulder.x - 4, shoulder.y - 3, 8, 6, sleeve);
    view.rect(shoulder.x - 4, shoulder.y - 3, 8, 2, colors.dressLight);
  }
  view.line(shoulder.x, shoulder.y, arm.elbow.x, arm.elbow.y, spec.armThick, sleeve);
  view.line(arm.elbow.x, arm.elbow.y, arm.hand.x, arm.hand.y, spec.foreThick, skin);
  const size = spec.handSize;
  view.rect(arm.hand.x - size / 2, arm.hand.y - size / 2, size, size, skin);
}

function drawLeg(view, spec, hip, leg, isFront) {
  const colors = spec.colors;
  const shorts = isFront ? colors.shorts : colors.shortsDark;
  const skin = isFront ? colors.skin : colors.skinShade;
  const shortsT = spec.dress ? 0.45 : 0.72;
  const mid = {
    x: hip.x + (leg.knee.x - hip.x) * shortsT,
    y: hip.y + (leg.knee.y - hip.y) * shortsT,
  };
  // Shorts on the upper thigh, bare leg below, then sock and shoe.
  view.line(hip.x, hip.y, mid.x, mid.y, spec.thighThick + 1, shorts);
  view.line(mid.x, mid.y, leg.knee.x, leg.knee.y, spec.thighThick - 1, skin);
  view.line(leg.knee.x, leg.knee.y, leg.foot.x, leg.foot.y, spec.shinThick, skin);
  view.rect(leg.foot.x - 3, leg.foot.y - 2, 6, 4, colors.sock);
  view.rect(leg.foot.x - 3, leg.foot.y - 2, 6, 2, colors.sockBand);
  drawShoe(view, spec, leg.foot, isFront);
}

// Oversized black platform boot in the spirit of New Rock: a chunky lug-sole
// stack, rounded toe, buckle straps and gunmetal studs. All black — the
// hardware is the only light detail, so it reads at gameplay size.
function drawPlatformBoot(view, colors, ankle, isFront) {
  const length = 26;
  const height = 13;
  const heel = ankle.x - length * 0.42;
  const toe = ankle.x + length * 0.58;
  const shade = isFront ? 1 : 0.78;
  const metal = colors.lace;

  // Lug platform sole: outsole, chunky mid platform, welt line, tread notches.
  view.rect(heel, ankle.y + height - 3, length, 3, colors.soleDark, shade);
  view.rect(heel, ankle.y + height - 8, length, 5, colors.sole, shade);
  view.rect(heel, ankle.y + height - 8, length, 1, '#4A4557', shade);
  for (let notch = 0; notch < 4; notch += 1) {
    view.rect(heel + 4 + notch * 6, ankle.y + height - 3, 3, 2, '#000000', 0.45 * shade);
  }

  // Boot upper: rounded toe, heel counter and a padded collar over the ankle.
  view.rect(heel + 2, ankle.y + 2, length - 6, height - 9, colors.shoe, shade);
  view.rect(toe - 9, ankle.y + height - 11, 9, 4, colors.shoe, shade);
  view.rect(toe - 6, ankle.y + height - 8, 6, 2, colors.shoeShade, shade);
  view.rect(heel + 2, ankle.y + 2, 5, height - 10, colors.shoeShade, shade);
  view.rect(heel + 3, ankle.y, 10, 3, colors.collar, shade);
  view.rect(heel + 4, ankle.y, 8, 1, colors.shoePanel, shade);

  // Two buckle straps with gunmetal studs.
  view.rect(ankle.x - 4, ankle.y + 4, 11, 2, colors.shoePanel, shade);
  view.rect(ankle.x - 1, ankle.y + 4, 3, 2, metal, shade);
  view.rect(ankle.x - 4, ankle.y + 8, 11, 2, colors.shoePanel, shade);
  view.rect(ankle.x + 3, ankle.y + 8, 3, 2, metal, shade);
  view.rect(heel + 3, ankle.y + 5, 2, 2, metal, shade);
  view.rect(heel + 6, ankle.y + 5, 2, 2, metal, 0.7 * shade);
}

// Her small pink sneaker: white sole, strap and a soft toe cap.
function drawSneaker(view, colors, ankle) {
  const length = 16;
  const height = 8;
  const heel = ankle.x - length * 0.4;
  const toe = ankle.x + length * 0.6;

  view.rect(heel, ankle.y + height - 3, length, 3, colors.sole);
  view.rect(heel, ankle.y + height - 1, length, 1, colors.soleDark);
  view.rect(heel + 1, ankle.y + 1, length - 3, height - 3, colors.shoe);
  view.rect(toe - 6, ankle.y + height - 6, 6, 3, colors.shoeAccent);
  view.rect(heel + 1, ankle.y + 1, 3, height - 3, colors.shoeShade);
  view.rect(ankle.x - 2, ankle.y + 2, 6, 2, colors.collarShoe);
  view.rect(ankle.x + 5, ankle.y + 3, 2, 2, colors.lace);
}

function drawShoe(view, spec, ankle, isFront) {
  if (spec.shoeStyle === 'boot') {
    drawPlatformBoot(view, spec.colors, ankle, isFront);
  } else {
    drawSneaker(view, spec.colors, ankle);
  }
}

function drawTorsoBase(view, spec, pose, colors) {
  const hipWidth = spec.hipHalf * 2;
  const chestWidth = spec.shoulderHalf * 2;
  const slabHeight = spec.torso / 3;
  for (let index = 0; index < 3; index += 1) {
    const t = (index + 0.5) / 3;
    const x = pose.hip.x + (pose.chest.x - pose.hip.x) * t;
    const y = pose.hip.y + (pose.chest.y - pose.hip.y) * t;
    const width = hipWidth + (chestWidth - hipWidth) * t;
    view.rect(x - width / 2, y - slabHeight / 2, width, slabHeight + 2, colors.top);
    view.rect(x - width / 2, y - slabHeight / 2, 3, slabHeight + 2, colors.topDark);
  }
}

// The gray zip-up jacket: a mid-gray body with darker side shading, a full
// center zip with a small pull tab, a stand collar and two welt pockets. The
// violet rim light down the back keeps the gray from sinking into the storm.
function drawBoyTorso(view, spec, pose, colors) {
  drawTorsoBase(view, spec, pose, colors);
  const hipWidth = spec.hipHalf * 2;
  view.rect(pose.hip.x - hipWidth / 2, pose.hip.y - 2, hipWidth, 3, colors.hem);

  // The zip: a bright line down the middle with a lighter pull tab.
  view.rect(pose.chest.x - 1, pose.chest.y - 1, 2, spec.torso + 2, colors.trim);
  view.rect(pose.chest.x - 2, pose.chest.y + 1, 4, 2, colors.topDark);

  // Welt pockets on both sides of the zip.
  view.rect(pose.chest.x - spec.shoulderHalf + 2, pose.chest.y + spec.torso - 5, 6, 2, colors.topDark);
  view.rect(pose.chest.x + spec.shoulderHalf - 8, pose.chest.y + spec.torso - 5, 6, 2, colors.topDark);

  // A small lime pin keeps one bright accent on the outfit.
  view.rect(pose.chest.x + 3, pose.chest.y + 3, 2, 2, colors.pin);

  // Rim light down the back edge.
  view.rect(pose.chest.x - spec.shoulderHalf, pose.chest.y - 1, 2, spec.torso + 2, colors.rim, 0.5);
  view.rect(pose.hip.x - hipWidth / 2, pose.hip.y - 4, 2, 4, colors.rim, 0.4);
}

function drawGirlDress(view, spec, pose, colors) {
  drawTorsoBase(view, spec, pose, colors);
  const hipWidth = spec.hipHalf * 2;
  // Fitted bodice highlight and lace collar.
  view.rect(pose.chest.x + 1, pose.chest.y + 1, 3, spec.torso - 4, colors.dressLight);
  view.rect(pose.chest.x - 4, pose.chest.y - 2, 9, 3, colors.collar);
  view.rect(pose.chest.x + 2, pose.chest.y + 4, 4, 3, colors.bow);
  view.rect(pose.chest.x + 3, pose.chest.y + 5, 2, 2, colors.pin);
  view.rect(pose.chest.x - spec.shoulderHalf, pose.chest.y - 1, 2, spec.torso + 2, colors.rim, 0.45);

  // Skirt: a flared trapezoid that sways and lifts with the stride without
  // changing shape unpredictably.
  const sway = pose.skirt.sway;
  const lift = pose.skirt.lift;
  const waistY = pose.hip.y - 3;
  const hemY = pose.hip.y + 13 - lift;
  const layers = 4;
  for (let index = 0; index < layers; index += 1) {
    const t = index / (layers - 1);
    const y = waistY + (hemY - waistY) * t;
    const halfWidth = hipWidth / 2 + t * 8;
    const offset = sway * t;
    view.rect(pose.hip.x - halfWidth + offset, y, halfWidth * 2, (hemY - waistY) / layers + 2, colors.top);
    view.rect(pose.hip.x - halfWidth + offset, y, 3, (hemY - waistY) / layers + 2, colors.dressLight, 0.8);
    view.rect(pose.hip.x + halfWidth - 3 + offset, y, 3, (hemY - waistY) / layers + 2, colors.topDark, 0.85);
  }
  const hemHalf = hipWidth / 2 + 8;
  view.rect(pose.hip.x - hemHalf + sway, hemY, hemHalf * 2, 3, colors.hem);
  view.rect(pose.hip.x - hemHalf + sway, hemY, hemHalf * 2, 1, colors.dressLight, 0.7);
  view.rect(pose.hip.x - hemHalf + sway, hemY + 2, hemHalf * 2, 1, colors.hem);
  view.rect(hipWidth / 2 * -1 + pose.hip.x, pose.hip.y - 3, hipWidth, 2, colors.topDark, 0.6);
}

// A tapered hair flick: shrinking slabs that end in a point — the building
// block of a shaggy wolf cut.
function drawFlick(view, x, y, width, length, color, bend = 0) {
  view.rect(x, y, width, length * 0.42, color);
  view.rect(x + bend * 0.5, y + length * 0.42, Math.max(2, width - 1), length * 0.34, color);
  view.rect(x + bend, y + length * 0.76, Math.max(2, width - 2), Math.max(2, length * 0.26), color);
}

// Wolf cut: short flicked layers on the crown, tapered pieces at the nape and
// a violet rim so the black never merges into the storm sky.
function drawWolfCutHair(view, spec, pose, head) {
  const colors = spec.colors;
  const halfW = spec.headW / 2;
  const halfH = spec.headH / 2;
  const { trail, lift, sway } = pose.hair;

  // Nape layers, shortest first, each flicking back with the run cycle.
  for (let index = 0; index < spec.hair.strands.length; index += 1) {
    const strand = spec.hair.strands[index];
    const lag = trail * (0.5 + index * 0.28);
    const drop = lift * (0.4 + index * 0.32);
    const flutter = Math.sin(pose.head.tilt + sway + index * 1.9) * spec.hairFlutter;
    const x = head.x + strand.ox + lag - strand.w / 2;
    const y = head.y - halfH + strand.oy + drop;
    drawFlick(view, x, y, strand.w, strand.len, index % 2 ? colors.hair : colors.hairDark, lag * 0.3 + flutter * 0.5);
  }

  // Occipital volume, tapered to a point at the nape.
  view.rect(head.x - halfW - 4, head.y - halfH - 2, 8, spec.headH + 3, colors.hair);
  view.rect(head.x - halfW - 3, head.y + halfH + 1, 6, 4, colors.hair);
  view.rect(head.x - halfW - 2, head.y + halfH + 5, 4, 3, colors.hairDark);
  view.rect(head.x - halfW - 4, head.y - halfH - 2, 2, spec.headH + 1, colors.rim, 0.45);

  // Uneven crown flicks: the wolf-cut signature silhouette.
  const crown = [
    { ox: -7, h: 6, w: 4 },
    { ox: -2, h: 5, w: 4 },
    { ox: 3, h: 4, w: 3 },
  ];
  for (const flick of crown) {
    const tilt = Math.sin(pose.head.tilt + sway + flick.ox) * spec.hairFlutter * 0.5;
    view.rect(head.x + flick.ox - flick.w / 2 + tilt * 0.4, head.y - halfH - flick.h, flick.w, flick.h, colors.hair);
    view.rect(head.x + flick.ox - flick.w / 2 + tilt * 0.6, head.y - halfH - flick.h, 2, 2, colors.hairShine, 0.7);
  }
  // Sheen across the crown layers.
  view.rect(head.x - halfW + 2, head.y - halfH - 3, 6, 2, colors.hairShine, 0.5);
  view.rect(head.x - halfW + 4, head.y - halfH - 1, 4, 2, colors.hairShine, 0.32);
}

function drawCurl(view, cx, cy, radius, colors, lit) {
  const body = lit ? (colors.hairMid || colors.hair) : colors.hairDark;
  view.rect(cx - radius, cy - radius + 1, radius * 2, radius * 2 - 2, body);
  view.rect(cx - radius + 1, cy - radius, radius * 2 - 2, radius * 2, body);
  if (lit) {
    view.rect(cx - radius + 1, cy - radius + 1, 2, 2, colors.hairShine);
  } else {
    view.rect(cx + radius - 3, cy + radius - 3, 2, 2, colors.hair, 0.7);
  }
}

// Abundant, defined ringlets: a soft volume mass with curl clusters layered
// over its edge, so the silhouette reads as curls rather than straight hair.
function drawCurlHair(view, spec, pose, head) {
  const colors = spec.colors;
  const { trail, lift, sway } = pose.hair;
  const halfW = spec.headW / 2;
  const halfH = spec.headH / 2;
  const volume = spec.hair.volume;
  const vx = head.x + volume.ox + trail * 0.5;
  const vy = head.y + volume.oy + lift * 0.6;

  // Dark base mass keeps the cluster reading as one head of hair.
  view.rect(vx - volume.w / 2, vy - volume.h / 2, volume.w, volume.h, colors.hairDark);
  view.rect(vx - volume.w / 2 - 2, vy - volume.h / 2 + 4, volume.w + 4, volume.h - 10, colors.hairDark);
  view.rect(vx - volume.w / 2 - 2, vy - volume.h / 2 + 4, 2, volume.h - 10, colors.rim, 0.5);

  for (let index = 0; index < spec.hair.curls.length; index += 1) {
    const curl = spec.hair.curls[index];
    const flutter = Math.sin(pose.head.tilt * 1.4 + sway + index * 1.7) * spec.hairFlutter;
    const cx = head.x + curl.ox + trail * (0.4 + index * 0.05) + flutter;
    const cy = head.y + curl.oy + lift * (0.4 + index * 0.06);
    // Curls on the lit (front) side catch the light; back ones stay shaded.
    drawCurl(view, cx, cy, curl.r, colors, curl.ox > -8);
  }
  // Caramel glints where the light catches the front ringlets.
  view.rect(head.x + halfW - 13, head.y - halfH - 4, 4, 2, colors.hairShine, 0.85);
  view.rect(head.x - 3, head.y - halfH - 6, 4, 2, colors.hairShine, 0.7);
  view.rect(head.x + halfW - 9, head.y - halfH + 4, 2, 2, colors.hairShine, 0.6);
  view.rect(head.x - halfW - 2, head.y - halfH - 4, spec.headW + 2, 3, colors.hair);
  view.rect(head.x - halfW, head.y - halfH - 6, spec.headW - 4, 3, colors.hair);
  view.rect(head.x - halfW + 2, head.y - halfH - 6, 4, 2, colors.hairShine, 0.8);
}

function drawFringe(view, spec, head) {
  const colors = spec.colors;
  const halfW = spec.headW / 2;
  const halfH = spec.headH / 2;
  if (spec.hair.style === 'wolf') {
    // Choppy fringe with uneven tips, a cheek tendril in front of the ear and
    // the signature cowlick.
    view.rect(head.x - halfW - 2, head.y - halfH - 1, spec.headW + 4, 4, colors.hair);
    view.rect(head.x + halfW - 7, head.y - halfH + 3, 5, 2, colors.hair);
    view.rect(head.x + halfW - 2, head.y - halfH + 5, 3, 2, colors.hair);
    view.rect(head.x - 2, head.y - halfH + 3, 4, 3, colors.hair);
    view.rect(head.x - halfW - 1, head.y - halfH + 2, 4, 4, colors.hair);
    view.rect(head.x - halfW + 2, head.y - halfH - 6, 7, 2, colors.hairShine);
    view.rect(head.x - halfW + 4, head.y - halfH - 4, 4, 2, colors.hairShine);
    view.rect(head.x - 3, head.y - halfH + 5, 3, 8, colors.hair);
    view.rect(head.x - 3, head.y + halfH - 4, 2, 3, colors.hairDark);
    // One unruly spike, the boy's signature cowlick.
    view.rect(head.x - 1, head.y - halfH - 8, 3, 2, colors.hair);
    view.rect(head.x + 1, head.y - halfH - 10, 2, 2, colors.hair);
    return;
  }
  // Ringlets above the brow and by the ear, never across her eyes.
  drawCurl(view, head.x + halfW - 5, head.y - halfH - 1, 4, colors, true);
  drawCurl(view, head.x + halfW - 12, head.y - halfH + 1, 4, colors, true);
  drawCurl(view, head.x - halfW + 1, head.y - halfH + 2, 3, colors, false);
  drawCurl(view, head.x - halfW - 2, head.y + 4, 4, colors, false);
  view.rect(head.x - halfW + 2, head.y - halfH - 1, spec.headW - 5, 3, colors.hair);
}

function drawFace(view, spec, pose, head) {
  const colors = spec.colors;
  const halfW = spec.headW / 2;
  const halfH = spec.headH / 2;
  const look = pose.face.look * 3;
  const face = pose.face;

  view.rect(head.x - halfW, head.y - halfH, spec.headW, spec.headH, colors.skin);
  view.rect(head.x - halfW, head.y - halfH, 3, spec.headH, colors.skinShade);
  view.rect(head.x - 3, head.y - 1, 3, 4, colors.skinShade);

  const eyeX = head.x + halfW - 6 + look;
  const eyeY = head.y - 1;
  view.rect(eyeX - 1, eyeY - 2 + face.brow * 0.5, 5, 2, colors.brow);
  if (face.eye === 'open') {
    view.rect(eyeX, eyeY, 4, 5, colors.eye);
    view.rect(eyeX + 2, eyeY, 2, 2, colors.eyeHi);
    if (spec.lash) {
      view.rect(eyeX + 3, eyeY - 2, 2, 2, colors.eye);
    }
  } else if (face.eye === 'wide') {
    view.rect(eyeX - 1, eyeY - 2, 6, 7, colors.eyeWhite);
    view.rect(eyeX + 1, eyeY, 4, 5, colors.eye);
    view.rect(eyeX + 3, eyeY + 1, 2, 2, colors.eyeHi);
  } else if (face.eye === 'happy') {
    view.rect(eyeX - 1, eyeY + 2, 2, 2, colors.eye);
    view.rect(eyeX, eyeY, 5, 2, colors.eye);
    view.rect(eyeX + 4, eyeY + 2, 2, 2, colors.eye);
    if (spec.lash) {
      view.rect(eyeX + 5, eyeY - 1, 2, 2, colors.eye);
    }
  } else {
    view.rect(eyeX, eyeY + 2, 4, 2, colors.eye);
    if (spec.lash) {
      view.rect(eyeX - 2, eyeY + 1, 2, 2, colors.eye);
    }
  }

  const blushing = face.mouth === 'pucker' || face.eye === 'happy';
  view.rect(head.x + halfW - 11 + look, head.y + 3, 4, 2, colors.blush, blushing ? 1 : 0.85);
  if (blushing) {
    view.rect(head.x + halfW - 12 + look, head.y + 4, 2, 2, colors.blush, 0.7);
  }
  view.rect(head.x + halfW - 1, head.y + 1, 2, 2, colors.skinShade);

  const mouthX = head.x + halfW - 6 + look;
  const mouthY = head.y + 5;
  switch (face.mouth) {
    case 'grin':
      view.rect(mouthX - 1, mouthY, 5, 4, colors.mouth);
      view.rect(mouthX, mouthY, 4, 2, colors.teeth);
      break;
    case 'open':
      view.rect(mouthX, mouthY - 1, 5, 5, colors.mouth);
      view.rect(mouthX + 1, mouthY + 2, 3, 2, colors.tongue);
      break;
    case 'pucker':
      view.rect(mouthX, mouthY, 4, 4, colors.mouth);
      view.rect(mouthX + 1, mouthY + 1, 2, 2, colors.tongue, 0.9);
      view.rect(mouthX - 1, mouthY + 1, 1, 2, colors.mouth, 0.7);
      break;
    case 'small':
      view.rect(mouthX, mouthY, 3, 2, colors.mouth);
      break;
    case 'sad':
      view.rect(mouthX - 2, mouthY + 2, 2, 2, colors.mouth);
      view.rect(mouthX, mouthY, 4, 2, colors.mouth);
      view.rect(mouthX + 3, mouthY + 2, 2, 2, colors.mouth);
      break;
    default:
      view.rect(mouthX - 1, mouthY, 4, 2, colors.mouth);
      view.rect(mouthX + 2, mouthY - 2, 2, 2, colors.mouth);
  }
}

export function drawCharacter(view, spec, pose, position) {
  const colors = spec.colors;
  const { x, y } = position;
  const mapX = (value) => x + value * pose.squashX;
  const mapY = (value) => y + value * pose.squashY;
  const point = (p) => ({ x: mapX(p.x), y: mapY(p.y) });
  const hip = point(pose.hip);
  const chest = point(pose.chest);
  const head = { ...point(pose.head), tilt: pose.head.tilt };
  const shoulder = { x: chest.x, y: chest.y + 4 };

  const arms = {
    front: { elbow: point(pose.arms.front.elbow), hand: point(pose.arms.front.hand) },
    back: { elbow: point(pose.arms.back.elbow), hand: point(pose.arms.back.hand) },
  };
  const legs = {
    front: { knee: point(pose.legs.front.knee), foot: point(pose.legs.front.foot) },
    back: { knee: point(pose.legs.back.knee), foot: point(pose.legs.back.foot) },
  };

  drawArm(view, spec, shoulder, arms.back, false);
  drawLeg(view, spec, hip, legs.back, false);
  const hipWidth = spec.dress ? spec.hipHalf * 2 : spec.hipHalf * 2 + 4;
  view.rect(hip.x - hipWidth / 2, hip.y - 1, hipWidth, spec.dress ? 7 : 9, colors.shorts);

  if (spec.dress) {
    drawGirlDress(view, spec, { hip, chest, skirt: pose.skirt }, colors);
  } else {
    drawBoyTorso(view, spec, { hip, chest }, colors);
    // The zip-up jacket's stand collar around the neck.
    view.rect(chest.x - 8, chest.y - 4, 16, 5, colors.hood);
    view.rect(chest.x - 8, chest.y - 4, 16, 2, colors.topDark);
    view.rect(chest.x - 9, chest.y - 3, 2, 8, colors.rim, 0.5);
  }

  drawLeg(view, spec, hip, legs.front, true);

  if (spec.hair.style === 'curls') {
    drawCurlHair(view, spec, pose, head);
  } else {
    drawWolfCutHair(view, spec, pose, head);
  }
  drawFace(view, spec, pose, head);
  drawFringe(view, spec, head);
  drawArm(view, spec, shoulder, arms.front, true);
}
