import { PLAYER, SHOT, TUNING } from '../config'
import type { StarCount } from '../types'

export function approach(current: number, target: number, maxDelta: number): number {
  if (current < target) return Math.min(target, current + maxDelta)
  return Math.max(target, current - maxDelta)
}

/** Analog stick / thumb glide axis with a small dead zone. */
export function inputAxis(rawX: number, deadZone = 0.14): number {
  if (Math.abs(rawX) <= deadZone) return 0
  const sign = rawX < 0 ? -1 : 1
  return sign * Math.min(1, (Math.abs(rawX) - deadZone) / (1 - deadZone))
}

export function stepHorizontal(velocityX: number, axis: number, onGround: boolean, deltaSeconds: number): number {
  if (axis !== 0) {
    const acceleration = onGround ? TUNING.runAcceleration : TUNING.airAcceleration
    return approach(velocityX, axis * TUNING.runSpeed, acceleration * deltaSeconds)
  }
  const drag = onGround ? TUNING.groundDrag : TUNING.airDrag
  return approach(velocityX, 0, drag * deltaSeconds)
}

export function coyoteRemaining(current: number, onGround: boolean, deltaMs: number): number {
  if (onGround) return TUNING.coyoteMs
  return Math.max(0, current - deltaMs)
}

export function jumpBufferRemaining(current: number, pressed: boolean, deltaMs: number): number {
  if (pressed) return TUNING.jumpBufferMs
  return Math.max(0, current - deltaMs)
}

export function cutJump(velocityY: number): number {
  return Math.max(velocityY, TUNING.jumpCutVelocity)
}

export function clampFall(velocityY: number, maxFall: number = TUNING.maxFallSpeed): number {
  return Math.min(velocityY, maxFall)
}

export function jumpApex(): number {
  return (TUNING.jumpVelocity * TUNING.jumpVelocity) / (2 * TUNING.gravity)
}

/** Aim direction from the muzzle to a tapped world point. */
export function aimDirection(fromX: number, fromY: number, toX: number, toY: number): { x: number; y: number } {
  const dx = toX - fromX
  const dy = toY - fromY
  const length = Math.hypot(dx, dy)
  if (length < 0.0001) return { x: 0, y: -1 }
  return { x: dx / length, y: dy / length }
}

export function muzzleOffset(facing: number): { x: number; y: number } {
  return { x: facing * 22, y: -26 }
}

export function shotCooldownRemaining(current: number, deltaMs: number): number {
  return Math.max(0, current - deltaMs)
}

export function canFire(cooldownMs: number, paused: boolean, finishing: boolean): boolean {
  return !paused && !finishing && cooldownMs <= 0
}

/** Screen-space assist: pick the nearest eligible target within a radius. */
export function assistedTarget<T extends { x: number; y: number }>(
  tapX: number,
  tapY: number,
  targets: T[],
  radius: number,
): T | null {
  let best: T | null = null
  let bestDistance = radius
  for (const target of targets) {
    const distance = Math.hypot(target.x - tapX, target.y - tapY)
    if (distance <= bestDistance) {
      best = target
      bestDistance = distance
    }
  }
  return best
}

export interface StarInput {
  completed: boolean
  allGems: boolean
  noDamage: boolean
}

export function starsFor(input: StarInput): StarCount {
  if (!input.completed) return 0
  let stars = 1
  if (input.allGems) stars += 1
  if (input.noDamage) stars += 1
  return Math.min(3, stars) as StarCount
}

export function scoreForRun(gems: number, noDamage: boolean, timeMs: number, enemies: number): number {
  const base = gems * 120 + enemies * 60
  const speedBonus = Math.max(0, Math.round((120_000 - timeMs) / 400))
  return Math.max(0, base + speedBonus + (noDamage ? 900 : 0) + 500)
}

export function healthBarWidth(health: number, maxHealth: number = PLAYER.maxHealth): number {
  return Math.max(0, Math.min(1, health / maxHealth))
}

export function shotSpeed(multiplier = 1): number {
  return SHOT.speed * multiplier
}

export function aimAssistRadius(enabled: boolean): number {
  return enabled ? SHOT.aimAssistScreenPx : 0
}
