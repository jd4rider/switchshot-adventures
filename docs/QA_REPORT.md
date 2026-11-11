# Switchshot Adventures 1.0.0 — QA Report

Date: 2026-11-11

## What was verified

| Check | Result |
| --- | --- |
| `npx tsc --noEmit` | Pass, strict mode |
| `npm test` | Pass, 36 tests in 4 files |
| Level validation sweep | Pass, all 500 generated rooms free of geometry, shooting, climb and objective errors |
| `npm run build` | Pass, `dist/` 1,632 kB JS (382 kB gzip) |
| Browser smoke, 390×844 touch | Pass, 0 console errors (`node tools/smoke.mjs`) |
| Little Joy Arcade client | Pass, drop-in client installs and reports `switchshot-adventures` |
| Canvas fit | Pass, 475×844 in a 390×844 viewport, centred |
| Thumb Glide | Pass, drag moved Pip 441 → 575 |
| Flick jump | Pass, upward flick on the movement pad left the ground |
| Multitouch tap-to-shoot | Pass, second finger fired while the first kept moving |
| Tap-to-shoot collision | Pass, tapping the room's switch activated it and opened its hatch |
| Pause / resume | Pass, both driven through the real HUD and overlay controls |
| Room completion | Pass, all required gems, lit portal, Results scene, stars and score saved |
| Endless Tower | Pass, generated floor boots without a guardian |
| Guardian room | Pass, exit sealed until the guardian falls, clear saved to `w1-50` |
| Reload persistence | Pass, progress survives a hard reload |

The unit suites cover horizontal acceleration and frame-rate independence, coyote
time, jump buffering and the variable-height cut, save sanitisation and result
recording, catalogue integrity (500 levels, 10 worlds, 22 achievements, 6 challenge
rooms, 4 blasters), mirror reflection maths and the 500-room validation sweep.

## Defects found and fixed during verification

1. **Start/exit ordering was inverted.** The validator rejected all 500 rooms with
   "start is not below the exit" because the comparison was backwards in screen
   coordinates (y grows downward). Fixed in `src/generator/validation.ts`.
2. **Guardian arenas contained stray patrolling enemies,** which the boss rules
   forbid. Enemies no longer spawn in the final chamber of a boss room.
3. **Challenge rooms varied in length.** Challenge mode now pins the room to six
   chambers, so every challenge is the intended compact five-hatch layout.
4. **HUD controls fell outside the visible width on tall phones.** The pause button
   (x 686) and blaster chip (x 630) were cropped away by the ENVELOP scale on a
   390-wide viewport. Pause, blaster chip, hearts and timer moved inside the safe
   width, and their shot-blocking rects moved with them.
5. **Pause and blaster-mode buttons were dead once the camera scrolled.** Interactive
   objects inside a fixed container are still hit-tested against world coordinates,
   so both buttons only worked at the very bottom of a room. HUD and pause-overlay
   taps are now routed through a scene-level pointer handler in screen space.
6. **The pause overlay was drawn off-screen in tall rooms.** The layer now uses
   `setScrollFactor(0)`.
7. **Escape cancelled itself out.** The key was handled twice per press — once by a
   `keydown-ESC` listener and once by `JustDown` in `update()` — toggling pause on
   and back off. Only the per-frame path remains.
8. **Completing a room threw and blocked the Results scene.** The shutdown handler
   destroyed pooled projectiles, enemies and the backdrop after Phaser had already
   torn down their groups, raising `Cannot read properties of undefined (reading
   'size')` mid-shutdown. Teardown is now left to the scene, which owns those objects.

## Limitations

- **Deployment is not performed.** This workspace is not a git repository, so the
  Pages workflow, the live URL and the Little Joy Arcade catalogue row are prepared
  and documented in `docs/DEPLOYMENT.md` but cannot be verified from here. The
  catalogue entry is intentionally left out until the URL resolves, because the
  catalogue is data for deployed games.
- **No physical device was available.** Mobile coverage is Chrome with CDP touch
  emulation at 390×844, including real multitouch events. iOS Safari, Android Chrome
  and real tablets were not exercised.
- **Cloud sync is not verified end to end.** The drop-in client installs and is
  configured with the public anon key, but signing in and round-tripping a save
  through Supabase was not tested; local saves are verified, including across reloads.
- **Content is deterministic, not hand-authored.** All 500 Journey rooms are
  generated from world-tuned parameters and validated geometrically (switch firing
  lines including mirror bounces, staircase rise and gaps, hatch placement, exit
  reachability). They are proven completable, not individually play-tuned.
- **Guardians share one framework** with distinct names, palettes, weak-point layouts
  and shot intervals rather than ten separate encounter scripts.
- **Boss and enemy coverage in the smoke test runs through the debug surface**
  (`defeatBoss`, `standOnStair`), not through a human-played fight.
- **Audio is synthesised** with the Web Audio API; there are no recorded assets, and
  music/ambience were not judged by ear on a device.
- **Achievements are local.** The arcade client exposes identity and save mirroring,
  not leaderboard endpoints, so no competitive results are claimed as authoritative.
- **Landscape desktop shows the whole portrait stage** (letterboxed) by design, and
  the game does not attempt a landscape layout.
