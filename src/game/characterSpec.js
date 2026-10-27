// Shared character proportions, colors and time-based pose computation.
// One rig serves both characters so silhouettes and proportions stay coherent
// across every animation state. All pose coordinates are in game units,
// relative to the feet: x grows forward (right), y grows up as negative.

import {
  KICK_WINDUP, KICK_ACTIVE_START, KICK_ACTIVE_END, KICK_END, KICK_REACH,
} from './config.js';

const TAU = Math.PI * 2;
const lerp = (a, b, t) => a + (b - a) * t;
const clamp01 = (value) => Math.max(0, Math.min(1, value));

// The boy: taller and slim, dark streetwear, a shaggy black wolf cut and
// oversized black platform boots.
export const BOY_SPEC = {
  style: 'boy',
  height: 74,
  shoeH: 13,
  shoeLen: 26,
  thigh: 13,
  shin: 14,
  torso: 16,
  headW: 17,
  headH: 16,
  hipHalf: 6,
  shoulderHalf: 8,
  armThick: 4,
  foreThick: 3,
  handSize: 4,
  thighThick: 7,
  shinThick: 5,
  armLen: 13,
  armReach: 7,
  stride: 15,
  lift: 13,
  cycleSeconds: 0.38,
  bobAmp: 1.5,
  leanBase: 5,
  hairFlutter: 2,
  shoeStyle: 'boot',
  // How far his head drops to meet hers in the kiss (74 vs 64 tall).
  kissAlign: 10,
  hair: {
    style: 'wolf',
    // Short nape layers, shortest at the top of the stack.
    strands: [
      { ox: -12, oy: 3, len: 13, w: 4 },
      { ox: -9, oy: 5, len: 16, w: 4 },
      { ox: -5, oy: 4, len: 12, w: 3 },
      { ox: -2, oy: 6, len: 9, w: 3 },
    ],
  },
  colors: {
    skin: '#FFD3B0',
    skinShade: '#E8A883',
    hair: '#120E22',
    hairDark: '#0A0716',
    hairShine: '#4C3A86',
    brow: '#120E22',
    eye: '#1B1230',
    eyeHi: '#FFFFFF',
    eyeWhite: '#FFF5FC',
    mouth: '#4A1338',
    tongue: '#FF69D4',
    teeth: '#FFF5FC',
    blush: '#FF69D4',
    // Gray zip-up jacket: a cool gray body with darker shading and a light
    // collar, so the silhouette still reads against the storm.
    top: '#8A8FA3',
    topDark: '#666C80',
    hem: '#4A4F60',
    hood: '#767C90',
    trim: '#C8CEDE',
    pin: '#B7FF4A',
    shorts: '#1C1433',
    shortsDark: '#140E26',
    stripe: '#FF38B8',
    sock: '#EDE6FF',
    sockBand: '#B7FF4A',
    // Boot: black leather tones plus gunmetal hardware, no bright accents.
    shoe: '#17141F',
    shoeShade: '#221E30',
    shoePanel: '#2A2733',
    shoeAccent: '#8E86A8',
    sole: '#2A2733',
    soleDark: '#0F0D14',
    collar: '#0C0A12',
    lace: '#8E86A8',
    rim: '#7A63C8',
  },
};

// The girl: a little shorter, pink dress with a soft flowing skirt and a
// big silhouette of defined caramel curls.
export const GIRL_SPEC = {
  style: 'girl',
  height: 64,
  shoeH: 8,
  shoeLen: 16,
  thigh: 11,
  shin: 13,
  torso: 14,
  headW: 16,
  headH: 16,
  hipHalf: 5,
  shoulderHalf: 7,
  armThick: 4,
  foreThick: 3,
  handSize: 4,
  thighThick: 6,
  shinThick: 4,
  armLen: 13,
  armReach: 7,
  stride: 12,
  lift: 11,
  cycleSeconds: 0.33,
  bobAmp: 2.2,
  leanBase: 4,
  hairFlutter: 3,
  lash: true,
  dress: true,
  shoeStyle: 'sneaker',
  // She is the shorter one: she stays planted and lets him bend down.
  kissAlign: 0,
  hair: {
    style: 'curls',
    volume: { ox: -10, oy: -1, w: 15, h: 26 },
    curls: [
      { ox: -13, oy: 2, r: 5 },
      { ox: -11, oy: 9, r: 6 },
      { ox: -12, oy: 16, r: 5 },
      { ox: -7, oy: -3, r: 5 },
      { ox: -4, oy: -4, r: 4 },
      { ox: -8, oy: 4, r: 5 },
      { ox: -6, oy: 11, r: 6 },
      { ox: -8, oy: 18, r: 5 },
      { ox: -3, oy: 17, r: 4 },
      { ox: -14, oy: -1, r: 4 },
    ],
  },
  colors: {
    skin: '#FFDFC7',
    skinShade: '#EDB795',
    // Almost black, with a plum sheen and a warm mid tone so the ringlets
    // stay readable against both the storm and the white city.
    hair: '#241A2E',
    hairMid: '#3A2B44',
    hairDark: '#150F1D',
    hairShine: '#7A5F8C',
    brow: '#241A2E',
    eye: '#2A1840',
    eyeHi: '#FFFFFF',
    eyeWhite: '#FFF5FC',
    mouth: '#5A1B45',
    tongue: '#FF69D4',
    teeth: '#FFF5FC',
    blush: '#FF5FA8',
    top: '#FF6FB8',
    topDark: '#E8479B',
    hem: '#C9307E',
    dressLight: '#FFC2E0',
    collar: '#FFE3F1',
    pin: '#FFF5FC',
    bow: '#FF38B8',
    sock: '#FFFFFF',
    sockBand: '#FFB3D9',
    shoe: '#FF8FC6',
    shoeShade: '#D95FA0',
    shoeAccent: '#FFE3F1',
    sole: '#FFF5FC',
    soleDark: '#E4CBDD',
    collarShoe: '#FFD9EC',
    lace: '#FFD9EC',
    rim: '#FFD9EC',
  },
};

function basePose(spec) {
  const hipY = -(spec.shoeH + spec.thigh + spec.shin);
  const point = () => ({ x: 0, y: 0 });
  return {
    squashX: 1,
    squashY: 1,
    hip: { x: 0, y: hipY },
    chest: { x: 0, y: hipY - spec.torso },
    head: { x: 1, y: hipY - spec.torso - 2 - spec.headH / 2, tilt: 0 },
    arms: {
      front: { elbow: point(), hand: point() },
      back: { elbow: point(), hand: point() },
    },
    legs: {
      front: { knee: point(), foot: point() },
      back: { knee: point(), foot: point() },
    },
    hair: { trail: -2, lift: 0, sway: 0 },
    skirt: { sway: 0, lift: 0 },
    face: { eye: 'open', mouth: 'smile', look: 0, brow: 0 },
    wave: 0,
  };
}

function skirtFor(spec, pose, trail, lift) {
  if (!spec.dress) {
    return;
  }
  pose.skirt = { sway: trail, lift };
}

function legIK(spec, hip, footX, footY, bend) {
  return {
    knee: {
      x: (hip.x + footX) / 2 + 3 + 3 * bend,
      y: (hip.y + footY) / 2 + 2 - 4 * bend,
    },
    foot: { x: footX, y: footY },
  };
}

function armIK(spec, shoulder, handX, handY) {
  return {
    elbow: {
      x: (shoulder.x + handX) / 2 + 2,
      y: (shoulder.y + handY) / 2 + 2,
    },
    hand: { x: handX, y: handY },
  };
}

// Contact phase: the foot slides back on the ground. Swing phase: it lifts and
// swings forward, with the knee bending further as the foot rises.
function runLeg(spec, hip, phase) {
  const footX = spec.stride * Math.cos(phase);
  const lift = Math.max(0, -Math.sin(phase)) * spec.lift;
  return legIK(spec, hip, footX, -spec.shoeH - lift, lift / spec.lift);
}

function runArm(spec, shoulder, phase) {
  const handX = shoulder.x + spec.armReach * Math.cos(phase);
  const handY = shoulder.y + spec.armLen - 3 * Math.max(0, Math.cos(phase));
  return armIK(spec, shoulder, handX, handY);
}

function runPose(spec, pose, input, options = {}) {
  const phase = input.cycle * TAU;
  const hipY = -(spec.shoeH + spec.thigh + spec.shin);
  const bob = -(options.bobAmp ?? spec.bobAmp) * Math.cos(2 * phase);
  const lean = options.lean ?? spec.leanBase;

  pose.hip = { x: Math.sin(2 * phase) * 0.6, y: hipY - bob };
  pose.chest = {
    x: pose.hip.x + lean + 1.5 * Math.sin(2 * phase),
    y: pose.hip.y - spec.torso,
  };
  pose.head = {
    x: pose.chest.x + 1.5,
    y: pose.chest.y - 2 - spec.headH / 2,
    tilt: 0.5 * Math.sin(2 * phase + 1),
  };
  pose.legs.front = runLeg(spec, pose.hip, phase);
  pose.legs.back = runLeg(spec, pose.hip, phase + Math.PI);

  const shoulder = { x: pose.chest.x, y: pose.chest.y + 4 };
  pose.arms.front = runArm(spec, shoulder, phase + Math.PI);
  pose.arms.back = runArm(spec, shoulder, phase);
  pose.hair = {
    trail: -4 - 2 * Math.sin(2 * phase + 0.7),
    lift: Math.sin(2 * phase + 2),
    sway: Math.sin(2 * phase + 1.4) * 2,
  };
  // The skirt trails the stride and lifts with the swing leg, never reshaping.
  skirtFor(spec, pose, -3 - 1.6 * Math.sin(2 * phase + 0.7), Math.max(0, Math.sin(2 * phase)) * 1.6);
  pose.face = { eye: 'open', mouth: 'grin', look: 0, brow: 0, ...options.face };
  if (options.look !== undefined) {
    pose.face.look = options.look;
  }
}

function idlePose(spec, pose, input) {
  const breath = 0.8 * Math.sin(input.time * 2.1);
  const hipY = -(spec.shoeH + spec.thigh + spec.shin);
  pose.hip = { x: 0.4 * Math.sin(input.time * 0.7), y: hipY + 0.5 - breath * 0.5 };
  pose.chest = {
    x: pose.hip.x + 1 + breath * 0.3,
    y: pose.hip.y - spec.torso - breath * 0.8,
  };
  pose.head = {
    x: pose.chest.x + 1,
    y: pose.chest.y - 2 - spec.headH / 2 - breath * 0.5,
    tilt: Math.sin(input.time * 0.6) * 0.6,
  };
  pose.legs.front = legIK(spec, pose.hip, 5, -spec.shoeH, 0.15);
  pose.legs.back = legIK(spec, pose.hip, -6, -spec.shoeH, 0.1);
  const shoulder = { x: pose.chest.x, y: pose.chest.y + 4 };
  const sway = Math.sin(input.time * 1.4) * 0.8;
  pose.arms.front = armIK(spec, shoulder, shoulder.x + 3 + sway, shoulder.y + spec.armLen);
  pose.arms.back = armIK(spec, shoulder, shoulder.x - 4 + sway, shoulder.y + spec.armLen);
  pose.hair = {
    trail: -2 + Math.sin(input.time * 1.1),
    lift: Math.sin(input.time * 1.7) * 1.5,
    sway: Math.sin(input.time * 1.3) * 1.5,
  };
  skirtFor(spec, pose, Math.sin(input.time * 1.6) * 1.2, 0);
  pose.face = { eye: 'open', mouth: 'smile', look: 0, brow: 0, ...input.faceOverride };
}

function airPose(spec, pose, input) {
  const rising = input.state === 'rise';
  const takeoff = Math.min(1, input.airTime / 0.12);
  const hipY = -(spec.shoeH + spec.thigh + spec.shin);
  const lean = rising ? 7 : 2;
  const double = input.doubleJump ? 1 : 0;
  pose.hip = { x: 2, y: hipY - (rising ? 1 : -1) };
  pose.chest = { x: pose.hip.x + lean, y: pose.hip.y - spec.torso };
  pose.head = {
    x: pose.chest.x + 1,
    y: pose.chest.y - 2 - spec.headH / 2,
    tilt: rising ? 1 : -0.5,
  };

  if (rising) {
    const tuck = 10 * takeoff + 4 * double;
    pose.legs.front = legIK(spec, pose.hip, 8 + 3 * takeoff, -spec.shoeH - tuck, 0.85);
    pose.legs.back = legIK(spec, pose.hip, -2 - 8 * takeoff, -spec.shoeH - 4 * takeoff, 0.4);
  } else {
    pose.legs.front = legIK(spec, pose.hip, 12, -spec.shoeH - 3, 0.5);
    pose.legs.back = legIK(spec, pose.hip, -7, -spec.shoeH - 8, 0.6);
  }

  const shoulder = { x: pose.chest.x, y: pose.chest.y + 4 };
  if (rising) {
    // The second jump throws both arms up: an easy, readable flourish.
    const reach = 6 + 6 * double;
    pose.arms.front = armIK(spec, shoulder, shoulder.x + 7, shoulder.y - reach - 2 * takeoff);
    pose.arms.back = armIK(spec, shoulder, shoulder.x - 10 - 3 * double, shoulder.y + 6 - 4 * double);
  } else {
    pose.arms.front = armIK(spec, shoulder, shoulder.x + 9, shoulder.y - 10);
    pose.arms.back = armIK(spec, shoulder, shoulder.x - 9, shoulder.y - 7);
  }
  pose.hair = {
    trail: rising ? -3 : -2,
    lift: rising ? 5 : -6,
    sway: Math.sin(input.time * 8) * 1.5,
  };
  skirtFor(spec, pose, rising ? -2 : 2, rising ? 3.5 : -3);
  pose.face = rising
    ? { eye: 'open', mouth: double ? 'open' : 'grin', look: 0, brow: -2 }
    : { eye: 'wide', mouth: 'small', look: 0, brow: -2 };
}

function landPose(spec, pose, input) {
  const ease = input.landT * input.landT;
  const hipY = -(spec.shoeH + spec.thigh + spec.shin);
  pose.squashX = 1 + 0.09 * ease;
  pose.squashY = 1 - 0.14 * ease;
  pose.hip = { x: 2, y: hipY + 6 * ease };
  pose.chest = { x: pose.hip.x + 3, y: pose.hip.y - (spec.torso - 3 * ease) };
  pose.head = {
    x: pose.chest.x + 1,
    y: pose.chest.y - 2 - spec.headH / 2,
    tilt: 1.5 * ease,
  };
  pose.legs.front = legIK(spec, pose.hip, 7, -spec.shoeH, 0.2 + 0.9 * ease);
  pose.legs.back = legIK(spec, pose.hip, -8, -spec.shoeH, 0.7 * ease);
  const shoulder = { x: pose.chest.x, y: pose.chest.y + 4 };
  pose.arms.front = armIK(spec, shoulder, shoulder.x + 12, shoulder.y + 12);
  pose.arms.back = armIK(spec, shoulder, shoulder.x - 11, shoulder.y + 11);
  pose.hair = { trail: 3 * ease - 5, lift: 6 * ease, sway: 0 };
  skirtFor(spec, pose, 3 * ease, 2.5 * ease);
  pose.face = {
    eye: input.landT > 0.55 ? 'closed' : 'open',
    mouth: input.landT > 0.5 ? 'small' : 'smile',
    look: 0,
    brow: 0,
  };
}

// He spots her down the path: a small stagger back, hands half raised.
function surprisePose(spec, pose, input) {
  const t = Math.min(1, input.stateTime / 0.4);
  const tremble = Math.sin(input.time * 15) * (1 - t) * 1.4;
  const hipY = -(spec.shoeH + spec.thigh + spec.shin);
  pose.hip = { x: -2 - tremble, y: hipY + 1 };
  pose.chest = { x: pose.hip.x - 3 + tremble * 0.5, y: pose.hip.y - spec.torso + 1 };
  pose.head = {
    x: pose.chest.x + 2,
    y: pose.chest.y - 2 - spec.headH / 2,
    tilt: -1.2,
  };
  pose.legs.front = legIK(spec, pose.hip, 7, -spec.shoeH, 0.3);
  pose.legs.back = legIK(spec, pose.hip, -8, -spec.shoeH, 0.25);
  const shoulder = { x: pose.chest.x, y: pose.chest.y + 4 };
  const bounce = Math.sin(input.time * 7) * 1.5;
  pose.arms.front = armIK(spec, shoulder, shoulder.x + 8, shoulder.y - 3 - bounce);
  pose.arms.back = armIK(spec, shoulder, shoulder.x - 9, shoulder.y - 1 + bounce);
  pose.hair = { trail: -1 + tremble, lift: 2, sway: Math.sin(input.time * 9) * 2 };
  skirtFor(spec, pose, 1, 0);
  pose.face = { eye: 'wide', mouth: 'open', look: 1, brow: -2 };
}

// She sees him coming: bright eyes, one hand waving high.
function greetPose(spec, pose, input) {
  idlePose(spec, pose, input);
  const shoulder = { x: pose.chest.x, y: pose.chest.y + 4 };
  pose.arms.front = {
    elbow: { x: shoulder.x + 9, y: shoulder.y - 1 },
    hand: { x: shoulder.x + 8, y: shoulder.y - 11 - 3 * Math.sin(input.time * 9) },
  };
  pose.arms.back = armIK(spec, shoulder, shoulder.x - 5, shoulder.y + spec.armLen);
  pose.head.tilt = -1.4 + 0.4 * Math.sin(input.time * 4);
  pose.face = { eye: 'happy', mouth: 'open', look: 1, brow: -1 };
  pose.wave = 1;
  skirtFor(spec, pose, Math.sin(input.time * 3.2) * 2, 0.5);
}

// The shared kiss pose: lean forward onto the toes, eyes closed, a soft
// pucker. Mirroring the whole rig gives the boy the same pose facing her.
function kissPose(spec, pose, input) {
  const t = Math.max(0, Math.min(1, input.kissT ?? 1));
  const settle = Math.sin(input.time * 2.4) * 0.4;
  const hipY = -(spec.shoeH + spec.thigh + spec.shin);
  // Height match: the taller partner bends while the shorter one stays
  // planted, so their heads meet on the same line instead of passing over.
  const align = (spec.kissAlign ?? 0) * t;
  pose.squashY = 1 + 0.015 * t;
  pose.hip = { x: 2.5 * t, y: hipY - 1.5 * t + align * 0.6 };
  pose.chest = { x: pose.hip.x + 6 * t, y: pose.hip.y - spec.torso + 0.5 * t };
  pose.head = {
    x: pose.chest.x + 4.5 * t,
    y: pose.chest.y - 1 - spec.headH / 2 + settle * 0.3 + align * 0.4,
    tilt: 2.2 * t,
  };
  // Both feet stay planted: the bend comes from the knees, never from a
  // floating foot that would read as a positioning error.
  pose.legs.front = legIK(spec, pose.hip, 4 + 4 * t, -spec.shoeH, 0.25 + 0.35 * t + align * 0.05);
  pose.legs.back = legIK(spec, pose.hip, -6 - 3 * t, -spec.shoeH, 0.2 + align * 0.04);
  const shoulder = { x: pose.chest.x, y: pose.chest.y + 4 };
  pose.arms.front = armIK(spec, shoulder, shoulder.x + 9 * t + 2, shoulder.y + 6 - 5 * t);
  pose.arms.back = armIK(spec, shoulder, shoulder.x - 6, shoulder.y + spec.armLen - 1);
  pose.hair = { trail: -2 - 1.5 * t, lift: 1.5 * t, sway: settle };
  skirtFor(spec, pose, -1 - 1.5 * t, 1.2 * t);
  pose.face = { eye: 'closed', mouth: 'pucker', look: 0, brow: -0.5 };
}

// Joy right after the kiss: arms up, eyes happy, a little bounce.
function cheerPose(spec, pose, input) {
  const bounce = Math.abs(Math.sin(input.time * 5.4));
  const hipY = -(spec.shoeH + spec.thigh + spec.shin);
  pose.squashY = 1 + 0.02 * bounce;
  pose.hip = { x: 1, y: hipY - 3 * bounce };
  pose.chest = { x: pose.hip.x + 1, y: pose.hip.y - spec.torso };
  pose.head = {
    x: pose.chest.x + 1,
    y: pose.chest.y - 2 - spec.headH / 2 - 1.5 * bounce,
    tilt: -0.8,
  };
  pose.legs.front = legIK(spec, pose.hip, 6, -spec.shoeH - 5 * bounce, 0.25);
  pose.legs.back = legIK(spec, pose.hip, -7, -spec.shoeH - 3 * bounce, 0.2);
  const shoulder = { x: pose.chest.x, y: pose.chest.y + 4 };
  const spread = 10 + 3 * bounce;
  pose.arms.front = armIK(spec, shoulder, shoulder.x + spread, shoulder.y - 9 - 4 * bounce);
  pose.arms.back = armIK(spec, shoulder, shoulder.x - spread, shoulder.y - 8 - 4 * bounce);
  pose.hair = { trail: -2, lift: 3 * bounce, sway: Math.sin(input.time * 6) * 2 };
  skirtFor(spec, pose, -1.5, 2 * bounce);
  pose.face = { eye: 'happy', mouth: 'open', look: 0, brow: -1.5 };
}

function defeatPose(spec, pose) {
  const hipY = -(spec.shoeH + spec.thigh + spec.shin);
  pose.squashY = 0.98;
  pose.hip = { x: -2, y: hipY + 2 };
  pose.chest = { x: pose.hip.x - 3, y: pose.hip.y - spec.torso + 2 };
  pose.head = {
    x: pose.chest.x + 2,
    y: pose.chest.y - 2 - spec.headH / 2 + 2,
    tilt: -1.5,
  };
  pose.legs.front = legIK(spec, pose.hip, 8, -spec.shoeH, 0.2);
  pose.legs.back = legIK(spec, pose.hip, -9, -spec.shoeH, 0.2);
  const shoulder = { x: pose.chest.x, y: pose.chest.y + 4 };
  pose.arms.front = armIK(spec, shoulder, shoulder.x + 3, shoulder.y + spec.armLen + 2);
  pose.arms.back = armIK(spec, shoulder, shoulder.x - 4, shoulder.y + spec.armLen + 2);
  pose.hair = { trail: -2, lift: 4, sway: 0 };
  skirtFor(spec, pose, 1, -1);
  pose.face = { eye: 'closed', mouth: 'sad', look: 0, brow: 2 };
}

// One knee on the ground, the other foot planted ahead, torso upright and a
// small breathing settle. Deliberately low and asymmetrical so the kneel
// still reads at gameplay scale.
function kneelPose(spec, pose, input) {
  const settle = Math.sin(input.time * 1.7) * 0.7;
  const hipY = -(spec.shoeH + spec.thigh + spec.shin);
  pose.hip = { x: -1, y: hipY + 13 + settle * 0.4 };
  pose.chest = { x: pose.hip.x + 2 + settle * 0.3, y: pose.hip.y - spec.torso - 1 };
  pose.head = {
    x: pose.chest.x + 2,
    y: pose.chest.y - 2 - spec.headH / 2 + settle * 0.3,
    tilt: 0.7 + settle * 0.3,
  };
  // Back leg folded: knee low to the ground, foot trailing behind.
  pose.legs.back = { knee: { x: -12, y: -8 }, foot: { x: -24, y: -spec.shoeH + 1 } };
  // Front leg: foot flat ahead, knee stacked over the ankle.
  pose.legs.front = {
    knee: { x: 9, y: -(spec.shoeH + spec.shin) + 3 },
    foot: { x: 13, y: -spec.shoeH },
  };
  const shoulder = { x: pose.chest.x, y: pose.chest.y + 4 };
  // One hand rests on the front knee, the other stays close to the chest.
  pose.arms.front = armIK(spec, shoulder, shoulder.x + 9, shoulder.y + spec.armLen - 2);
  pose.arms.back = armIK(spec, shoulder, shoulder.x - 2, shoulder.y + spec.armLen - 6);
  pose.hair = { trail: -2 + settle * 0.5, lift: settle, sway: settle * 0.6 };
  skirtFor(spec, pose, 1.5, 1.5);
  pose.face = { eye: 'open', mouth: 'small', look: 0, brow: 1, ...input.faceOverride };
}

// Hand to the chin: she looks away, considers it, then decides. The evolving
// expression is driven by how long the pose has been held.
function thinkPose(spec, pose, input) {
  idlePose(spec, pose, input);
  const t = Math.min(1, input.stateTime / 2.6);
  const sway = Math.sin(input.time * 1.5) * 0.8;
  const shoulder = { x: pose.chest.x, y: pose.chest.y + 4 };
  pose.arms.front = armIK(spec, shoulder, shoulder.x + 4 + sway, shoulder.y + spec.armLen - 9);
  pose.arms.back = armIK(spec, shoulder, shoulder.x - 5, shoulder.y + spec.armLen);
  pose.head.tilt = 1.7 - t * 0.8;
  pose.hair.sway += 0.4;
  if (t < 0.35) {
    pose.face = { eye: 'open', mouth: 'small', look: -1, brow: 1.4, ...input.faceOverride };
  } else if (t < 0.68) {
    pose.face = { eye: 'closed', mouth: 'small', look: -1, brow: 1, ...input.faceOverride };
  } else {
    pose.face = { eye: 'open', mouth: 'smile', look: 1, brow: -0.8, ...input.faceOverride };
  }
}

// The solo kick: a sharp anticipation (weight back, knee up), a fast and
// violent extension that snaps the leg out, then a quick recovery that pulls
// the foot home. The wind-up pulls the torso further back than before so the
// release reads as a real spring, and the extension overshoots slightly
// before settling.
function kickPose(spec, pose, input) {
  const t = Math.max(0, input.kickT ?? 0);
  const hipY = -(spec.shoeH + spec.thigh + spec.shin);
  const windup = clamp01(t / KICK_WINDUP);
  const extend = clamp01((t - KICK_ACTIVE_START) / (KICK_ACTIVE_END - KICK_ACTIVE_START));
  const recover = clamp01((t - KICK_ACTIVE_END) / (KICK_END - KICK_ACTIVE_END));

  let footX;
  let footY;
  let bend;
  let extension;
  if (t < KICK_ACTIVE_START) {
    // Anticipation: the knee chambers high and the body coils backwards.
    footX = lerp(3, 8, windup);
    footY = -spec.shoeH - 18 * windup;
    bend = lerp(0.25, 0.85, windup);
    extension = -0.6 * windup;
  } else if (t < KICK_ACTIVE_END) {
    // Extension: a fast ease-out that snaps the leg out to full reach.
    const eased = 1 - (1 - extend) ** 3;
    footX = lerp(8, KICK_REACH, eased);
    footY = -spec.shoeH - lerp(18, 26, extend);
    bend = lerp(0.85, 0.04, extend);
    extension = lerp(-0.6, 1.15, eased);
  } else {
    // Recovery: the leg snaps back quickly and settles into the run.
    const eased = 1 - (1 - recover) ** 2;
    footX = lerp(KICK_REACH, 5, eased);
    footY = lerp(-spec.shoeH - 26, -spec.shoeH, eased);
    bend = lerp(0.04, 0.25, eased);
    extension = lerp(1.15, 0, eased);
  }

  pose.hip = { x: -1 - 3.4 * extension, y: hipY + 2 };
  pose.chest = { x: pose.hip.x + 2 + 2.2 * extension, y: pose.hip.y - spec.torso };
  pose.head = {
    x: pose.chest.x + 2,
    y: pose.chest.y - 2 - spec.headH / 2,
    tilt: -1 - 0.9 * extension,
  };
  pose.legs.front = legIK(spec, pose.hip, footX, footY, bend);
  pose.legs.back = legIK(spec, pose.hip, -7 - 2.4 * extension, -spec.shoeH, 0.25);
  const shoulder = { x: pose.chest.x, y: pose.chest.y + 4 };
  pose.arms.front = armIK(spec, shoulder, shoulder.x - 6 - 4.4 * extension, shoulder.y + 8);
  pose.arms.back = armIK(spec, shoulder, shoulder.x + 5, shoulder.y + 6);
  pose.hair = {
    trail: -3 - 2.4 * extension,
    lift: 1.5 * extension,
    sway: Math.sin(input.time * 9) * 1.4,
  };
  skirtFor(spec, pose, -2 - 1.5 * extension, 1.5 * extension);
  pose.face = { eye: 'open', mouth: 'grin', look: 0.6, brow: -1 };
}

export function computePose(spec, input) {
  const pose = basePose(spec);
  switch (input.state) {
    case 'idle':
      idlePose(spec, pose, input);
      break;
    case 'run':
      runPose(spec, pose, input);
      break;
    case 'together':
      // Glancing either way still reads as a happy glance toward the partner.
      runPose(spec, pose, input, {
        lean: 4.5,
        look: -input.glance,
        face: { eye: Math.abs(input.glance) > 0.5 ? 'happy' : 'open', mouth: 'smile' },
      });
      break;
    case 'surprise':
      surprisePose(spec, pose, input);
      break;
    case 'greet':
      greetPose(spec, pose, input);
      break;
    case 'kiss':
      kissPose(spec, pose, input);
      break;
    case 'kneel':
      kneelPose(spec, pose, input);
      break;
    case 'think':
      thinkPose(spec, pose, input);
      break;
    case 'kick':
      kickPose(spec, pose, input);
      break;
    case 'cheer':
      cheerPose(spec, pose, input);
      break;
    case 'rise':
    case 'fall':
      airPose(spec, pose, input);
      break;
    case 'land':
      landPose(spec, pose, input);
      break;
    case 'defeat':
      defeatPose(spec, pose);
      break;
    default:
      idlePose(spec, pose, input);
  }
  // A simple talking cycle while a character owns the current dialogue beat.
  if (input.speaking && ['idle', 'kneel', 'think'].includes(input.state)) {
    pose.face.mouth = Math.sin(input.time * 12) > 0 ? 'open' : 'small';
  }
  if (input.blink && !['defeat', 'kiss', 'cheer'].includes(input.state)) {
    pose.face.eye = 'closed';
  }
  return pose;
}

// Frame-rate independent blending so state changes never pop. Numbers ease
// toward their targets; discrete face states switch immediately.
export function blendPose(current, target, amount) {
  if (current === null || current === undefined) {
    return target;
  }
  if (typeof target === 'number') {
    return lerp(current, target, amount);
  }
  if (typeof target !== 'object') {
    return target;
  }
  if (Array.isArray(target)) {
    return target.map((value, index) => blendPose(current[index], value, amount));
  }
  const result = {};
  for (const key of Object.keys(target)) {
    result[key] = blendPose(current[key], target[key], amount);
  }
  return result;
}
