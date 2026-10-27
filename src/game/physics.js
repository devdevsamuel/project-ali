// Shared vertical movement for both runners. Each character owns its own
// instance of these fields, so the couple can jump independently while the
// landing rules stay identical.
//
// The vertical motion owns the fall and rise states, but it never touches a
// state that another action claimed. `stateLock` lets the player keep the
// 'kick' state while the legs are still moving, so an airborne kick is not
// overwritten by the jump animation.

const LAND_DURATION = 0.22;

export function stepVertical(entity, deltaTime, gravity) {
  const wasGrounded = entity.grounded;
  entity.verticalVelocity += gravity * deltaTime;
  entity.y += entity.verticalVelocity * deltaTime;

  const restY = entity.groundY - entity.height;
  if (entity.y + entity.height >= entity.groundY) {
    entity.y = restY;
    entity.verticalVelocity = 0;
    entity.grounded = true;
    entity.jumpsUsed = 0;
  } else {
    entity.grounded = false;
  }

  if (!entity.grounded) {
    entity.airTime += deltaTime;
    if (!entity.stateLock) {
      entity.state = entity.verticalVelocity < 0 ? 'rise' : 'fall';
    }
  } else if (!wasGrounded) {
    entity.landTimer = LAND_DURATION;
    if (!entity.stateLock) {
      entity.state = 'land';
    }
  }
}

export { LAND_DURATION };
