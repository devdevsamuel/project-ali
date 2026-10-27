// Neon-romantic palette. Dark violet anchors the scene; pink and electric
// green are reserved for readable, important elements.
export const NEON = {
  pink: '#FF38B8',
  hotPink: '#FF69D4',
  lime: '#B7FF4A',
  mint: '#4DFFD2',
  violet: '#170D2E',
  purple: '#291442',
  lavender: '#C8A7FF',
  white: '#FFF5FC',
};

function channel(value) {
  return Math.max(0, Math.min(255, Math.round(value)));
}

// Blend two #rrggbb colors; used for gradual background progression.
export function mixColor(first, second, amount) {
  const t = Math.max(0, Math.min(1, amount));
  const parse = (hex) => [
    parseInt(hex.slice(1, 3), 16),
    parseInt(hex.slice(3, 5), 16),
    parseInt(hex.slice(5, 7), 16),
  ];
  const [ar, ag, ab] = parse(first);
  const [br, bg, bb] = parse(second);
  const toHex = (v) => channel(v).toString(16).padStart(2, '0');
  return `#${toHex(ar + (br - ar) * t)}${toHex(ag + (bg - ag) * t)}${toHex(ab + (bb - ab) * t)}`;
}
