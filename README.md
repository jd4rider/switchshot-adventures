# Switchshot Adventures

A portrait-first tap-to-shoot puzzle platformer for Little Joy Arcade.

Pip climbs ten mechanical towers with the Switchshot, a blaster that opens hatches,
powers circuits, pulls crates and grows platforms. Every room is a compact vertical
puzzle: move, jump, tap where you want to shoot, and reach the portal.

- Phaser 3.90, TypeScript strict, Vite 6, Arcade Physics
- Logical resolution 720 × 1280, portrait first, letterboxed on landscape desktops
- 500 Journey rooms across 10 worlds, each deterministically generated and validated
- Four blaster modes: Pulse, Volt, Growth, Gravity
- Endless Tower, Speedrun, Daily Puzzle and six Challenge Rooms
- 22 achievements, persistent statistics, versioned local saves with arcade cloud mirroring

## Controls

| Action | Touch | Keyboard / mouse |
| --- | --- | --- |
| Move | Drag the lower-left pad left/right | A/D or arrows |
| Jump | Flick the pad up | Space / W / Up |
| Shoot | Tap anywhere in the room | Left-click, or aim with the mouse |
| Blaster mode | Tap the mode chip in the HUD | 1–4, mouse wheel |
| Pause / restart | HUD pause button | Esc / R |

Alternative Classic Buttons (left, right, jump) and left-handed, scale, opacity and
reduced-motion options live in Settings.

## Scripts

```bash
npm ci
npm run dev        # http://127.0.0.1:5184
npm test           # 36 unit, content and level-validation tests
npm run build      # typecheck + production bundle in dist/
npm run preview -- --port 4321
node tools/smoke.mjs http://127.0.0.1:4321/   # real Chrome, 390×844 touch
```

## Layout

```text
src/
  config.ts              tuning constants, palette, version
  core/                  rng, save, progress, synthesized audio
  data/                  worlds, levels, blasters, achievements, challenges
  generator/             deterministic room generator + geometric validator
  player/                movement math, physics body, Pip's animation
  weapons/               pooled projectile system, blaster skins
  world/                 textures, parallax backdrop, level rendering, enemies
  scenes/                boot, menu, journey, challenges, game, results, settings, trophies
  ui/                    HUD, touch controls, shared widgets
  platform/              Little Joy Arcade adapter
tests/                   vitest suites
tools/smoke.mjs          production-browser acceptance test
```

The validator proves, for every generated room, that each required switch or seed
has a firing line (including mirror bounces), that the staircase rises within jump
range, that hatches sit above their switches, and that the exit is reachable. See
`src/generator/validation.ts`.

## Little Joy Arcade

`index.html` loads the supported drop-in client from `public/arcade-client.js` with
`data-game-id="switchshot-adventures"`. The client owns identity and cloud-save
mirroring of `switchshot-adventures-save-v1`; `src/platform/arcade.ts` reads only the
public surface it exposes and falls back to local play when it is unavailable. No
secret keys are used in the browser.

Deployment, catalogue and rollback steps: [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md).
Verification results and limitations: [docs/QA_REPORT.md](docs/QA_REPORT.md).
