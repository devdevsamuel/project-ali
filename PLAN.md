# Love Runner — Gameplay Improvements Plan

## Baseline (before changes)
- `npm test` script was broken: `node --test tests/` → MODULE_NOT_FOUND. Fixed to
  `node --test "tests/*.test.js"`.
- 5 of 14 pre-existing tests failed: they referenced APIs absent from the source
  (`game.obstacles`, `game.textPops`, `game.projectiles`, `game.getReunionCrop()`)
  and an English notice string in a Spanish-language game.

## Task checklist

- [x] T1 Kick feel: faster, stronger, anticipation → extension → recovery
- [x] T2 Airborne kick (single + double jump)
- [x] T3 Kick VFX: trails, impact burst, particles, hit-stop
- [x] T4 Screen shake on bishi kick
- [x] T5 Hitbox tuning + fair collision (kick guard window)
- [x] T6 Large in-canvas kick comments near impact
- [x] T7 Remove armed shooter (Robber, bullets, damage, spawn logic)
- [x] T8 Popayán sign at game start
- [x] T9 Rain intensifies after 2 gems
- [x] T10 Gray zip-up jacket for the boy
- [x] T11 Money counter ($100) + robbery event (-$20, red, once per run)
- [x] T12 Dog icons on "Te extrañamos" sign
- [x] T13 Kick success counter + "¡Súper exitoso!" at 5
- [x] T14 Run project checks, fix regressions

## Verification checklist
- [x] V1 Ground and airborne kicks work, incl. double jumps (unit tests + screenshots)
- [x] V2 Kick effects, hitboxes, shake, comments verified numerically and visually
- [x] V3 Shooter fully removed — no projectiles, no damage, no leftovers
- [x] V4 Popayán sign, rain progression, jacket, dog sign, money, robbery, success counter
- [x] V5 `npm test` 25/25 pass, `npm run build` succeeds

## Notes / decisions
- The kick now owns the player's state (`stateLock`), so the vertical physics
  cannot overwrite it mid-kick. This is what makes an airborne kick possible.
- A kick guards the runner from the wind-up to the end of the recovery, so a
  close rival can never punish the kick before the leg lands.
- The camera crop bottom edge was overflowing the buffer (`REUNION_CROP_Y` 197 +
  height 135 > 270); corrected to 135.
- The couple stage keeps the kick disabled: the road is lined with props there.
- Debug params for visual checks: `?kick=`, `?robbery=`, `?kicks=`, `?distance=`,
  `?t=`, `?crystals=`.
