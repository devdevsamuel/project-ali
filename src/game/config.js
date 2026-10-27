export const GAME_WIDTH = 960;
export const GAME_HEIGHT = 540;
export const GROUND_Y = 430;
export const PIXELS_PER_METER = 50;

// Logical units per art pixel. Every sprite detail snaps to this grid so the
// whole game shares one consistent pixel density.
export const ART = 2;

export const PLAYER_X = 150;

// Four crystals mark the solo section; the girl waits just past the last one.
export const CRYSTAL_COUNT = 4;
export const CRYSTAL_DISTANCES = [26, 62, 104, 148];
  // A crystal the runner outruns comes back a little later, so the reunion can
// never become unreachable.
export const CRYSTAL_RESPAWN_GAP = 38;
export const HEART_MIN_DISTANCE = 8;

// Emotional traces left along the solo path: pixel signs, a handwritten note,
// a neon message and a floating thought. Configurable list — spacing keeps at
// most one message on screen at a time (a screen is ~19 m of road).
export const SOLO_MESSAGES = [
  { text: 'Te amo, Ali', kind: 'board', distance: 13 },
  { text: 'Lo siento, mi amor', kind: 'note', distance: 47 },
  { text: 'Vuelve, te necesito', kind: 'graffiti', distance: 72 },
  { text: 'I NEEED U </3', kind: 'neon', distance: 92 },
  // The floating thought carries two little pixel dogs beside the words.
  { text: 'Te extrañamos', kind: 'float', distance: 126, dogs: 2 },
];

// The sign that opens the road, pointing the way to Popayán.
export const POPAYAN_MESSAGE = {
  text: 'Popayán',
  kind: 'board',
  distance: 6,
  arrow: 'right',
};

// Short combat quips shown once after a successful kick, never repeated
// back to back.
export const KICK_QUIPS = ['Aléjate, bichi', 'Muere', 'Buen intento'];

// The kick: brief wind-up, short active window with its own hitbox, recovery
// and cooldown so it cannot be mashed without limit.
// Faster and snappier than the original: the anticipation is short, the
// extension snaps out and the recovery is quick, so a kick reads as one
// decisive motion instead of a slow windmill.
export const KICK_WINDUP = 0.09;
export const KICK_ACTIVE_START = 0.09;
export const KICK_ACTIVE_END = 0.2;
export const KICK_END = 0.34;
export const KICK_COOLDOWN_END = 0.46;
// Hitbox is measured from the runner's bottom-right corner and never touches
// his normal movement box. `up` is the height of the hitbox above the
// runner's feet, so the same box can follow a jump.
export const KICK_HITBOX = { forward: 54, up: 50, height: 38 };
// How far the leg actually extends during the active window, in game units.
// The hitbox is slightly longer than the leg so the kick still connects at
// the very end of the snap.
export const KICK_REACH = 40;
// A kick freezes the world for a few frames. Short enough to feel like a
// punch landing, long enough to read as impact.
export const KICK_HITSTOP = 0.055;
// Screen shake when a kick connects, in game units of displacement.
export const KICK_SHAKE = 7;
export const KICK_SHAKE_DECAY = 12;
// Number of successful kicks before the celebratory message.
export const KICK_SUCCESS_TARGET = 5;

// Keyboard mapping for the kick (configurable).
export const KICK_KEYS = ['KeyX', 'KeyK'];

// The robbery encounter: a small thief steps out from behind the runner,
// demands the wallet, takes the money and leaves. It never costs health.
export const ROBBER_FIRST_DELAY = 9;
export const ROBBER_APPROACH_SECONDS = 1.6;
export const ROBBER_THREAT_SECONDS = 2.4;
// The runner starts with this much cash; the thief takes it all and leaves a
// debt behind.
export const STARTING_MONEY = 100;
export const ROBBED_MONEY = -20;

// The rain gets heavier as the run goes on: every collected crystal adds a
// step of intensity, on top of the base storm.
export const RAIN_BASE_DROPS = 64;
export const RAIN_MAX_DROPS = 150;
export const RAIN_INTENSITY_PER_CRYSTAL = 0.18;
export const RAIN_MAX_INTENSITY = 0.55;

// Narrative beats around the reunion, in seconds of scene time. The whole
// cinematic is a dedicated frozen state: only the characters, the camera and
// the dialogue keep moving.
export const REUNION_TRIGGER_AHEAD = 340;
export const REUNION_APPROACH = 0.9;
export const REUNION_ZOOM_IN = 0.9;
// How far he walks toward her before kneeling.
export const REUNION_STEP = 88;
// Outro: she steps closer, they share a short affection beat, then she runs
// around to his side while the camera pulls back.
export const OUTRO_STEP_END = 0.6;
export const OUTRO_KISS_END = 1.8;
export const OUTRO_PART_END = 2.5;
export const OUTRO_PULLBACK_START = 1.8;
export const OUTRO_PULLBACK = 0.7;
// Cinematic framing in buffer pixels: a 16:9 crop centred on the two of them.
// The crop sits on the ground line, so its bottom edge stays inside the
// 480x270 buffer.
export const REUNION_CROP_WIDTH = 240;
export const REUNION_CROP_HEIGHT = 135;
export const REUNION_CROP_Y = 135;
// How far ahead of the player she stands once all crystals are collected.
export const GIRL_WAIT_AHEAD = 700;
// Centre-to-center distance between the two when the kiss poses take over.
// Sized so their head boxes just touch and the puckered lips meet: the pose
// pushes each face ~21 units forward from its own centre, so 34 puts the
// mouths on the same pixel without the heads interpenetrating.
export const KISS_GAP = 34;
// How far she steps toward him as the outro begins.
export const GIRL_KISS_STEP = 22;
// Minimum seconds a dialogue beat must stay on screen before it can advance.
export const BEAT_HOLD = 0.45;
// Ali's deliberate silence before she answers (beat 5).
export const ALI_THINK_SECONDS = 2.6;
// Seconds the world takes to wake up into the white city after the fourth
// crystal.
export const AWAKEN_SECONDS = 6;

// Distance over which the background lighting/color gradually evolves.
export const PROGRESS_DISTANCE = 500;

// Audio assets (hosted files provided for the project). Kept here so the
// URLs stay configurable and out of the gameplay code.
export const AUDIO_ASSETS = {
  kick: 'https://firebasestorage.googleapis.com/v0/b/portfolio-bedf9.firebasestorage.app/o/project-ali%2Fmuerebich.ogg?alt=media&token=420b1d26-6287-4531-8fa1-2d7fd2c5a9b2',
  samuel: 'https://firebasestorage.googleapis.com/v0/b/portfolio-bedf9.firebasestorage.app/o/project-ali%2Faudio-samuel.ogg?alt=media&token=90de5b79-0c45-452f-bc93-e8fe95dd22bf',
  ali: 'https://firebasestorage.googleapis.com/v0/b/portfolio-bedf9.firebasestorage.app/o/project-ali%2Faudio-ali.ogg?alt=media&token=c4ea0e8b-1c68-4a4d-b3c6-9b60f359309c',
  solo: 'https://firebasestorage.googleapis.com/v0/b/portfolio-bedf9.firebasestorage.app/o/project-ali%2FSin%20Ti.mp3?alt=media&token=1962d3c1-0855-4f6c-b280-f8f014172ca9',
  couple: 'https://firebasestorage.googleapis.com/v0/b/portfolio-bedf9.firebasestorage.app/o/project-ali%2FContigo.mp3?alt=media&token=11278bd2-78d9-4479-a400-0e44f5427b5e',
};

// Per-track volume: songs sit under the action, speech stays fully audible.
export const AUDIO_VOLUMES = {
  kick: 0.9,
  samuel: 1,
  ali: 1,
  solo: 0.4,
  couple: 0.45,
};

// Target duration for each dialogue recording, in seconds. The manager reads
// the real length from the file and sets playbackRate so each turn lasts
// about this long. Rates are clamped so speech is never sped up — slowing a
// line slightly keeps the principal character easy to follow — and both
// recordings always play to the end.
export const VOICE_TARGET_SECONDS = {
  samuel: 6,
  ali: 7.5,
};
export const VOICE_RATE_MIN = 0.85;
export const VOICE_RATE_MAX = 1;
