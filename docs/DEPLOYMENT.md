# Deployment

## Build

```bash
npm ci
npm test
npm run build
```

The static site is written to `dist/`. `vite.config.ts` sets `base: './'`, so the same
build works at a root domain or beneath `/play/`. `public/arcade-client.js`,
`public/arcade-manifest.json` and the icons are copied verbatim.

## GitHub Pages

`.github/workflows/pages.yml` runs the tests and the build, uploads `dist/` and
deploys it on every push to `main`.

1. Initialise the repository and push it to `github.com/jd4rider/switchshot-adventures`.
2. Enable **Settings → Pages → Build and deployment → GitHub Actions**.
3. Push to `main` (or run the workflow manually).

Expected URL:

```text
https://jd4rider.github.io/switchshot-adventures/
```

The repository live at `github.com/jd4rider/switchshot-adventures` was published from
this workspace: the tree was initialised on `main`, pushed, and Pages was enabled with
`build_type=workflow`. The first run of this workflow deployed successfully, so the
URL above is the live build and every push to `main` republishes it.

The drop-in client is already configured with the public Supabase anon key that the
SDK ships (`packages/sdk/desktop/arcade-client.js`). That key is safe in a browser:
every table is protected by row-level security. Never add a service-role key.

## Little Joy Arcade catalogue

The catalogue is data for **deployed** games (`littlejoyarcade/src/data/games.ts`),
so add the entry only after the Pages URL resolves:

```ts
{
  id: 'switchshot-adventures',
  name: 'Switchshot Adventures',
  tagline: 'Every shot opens a new adventure.',
  description:
    'A portrait-first tap-to-shoot puzzle platformer. Pip climbs ten mechanical towers with the Switchshot, a blaster that opens hatches, powers circuits, pulls crates and grows platforms. 500 validated Journey rooms, four blaster modes, ten guardian encounters, Endless Tower, Speedrun, a daily room and six challenge rooms. Art, animation and audio are code-generated; the game uses the Little Joy Arcade drop-in client for identity and cloud-save mirroring and keeps progress local when offline.',
  categories: ['Arcade'],
  runtime: 'Phaser 3',
  version: '1.0.0',
  updated: '2026-11-11',
  status: 'live',
  playUrl: 'https://jd4rider.github.io/switchshot-adventures/',
  siteUrl: 'https://jd4rider.github.io/switchshot-adventures/',
  repoUrl: repo('switchshot-adventures'),
  releasesUrl: `${repo('switchshot-adventures')}/releases`,
  downloads: [],
  cover: { from: '#6ff2c8', to: '#ff8fc7', emoji: '🔫' },
  highlights: [
    '500 deterministic Journey rooms across ten worlds, all validated for shootable switches, climbable stairs and reachable exits',
    'Tap-to-shoot aiming that works while running, jumping and riding moving platforms',
    'Four blaster modes: Pulse, Volt, Growth and Gravity',
    'Ten guardian encounters with three weak points each',
    'Endless Tower, Speedrun, Daily Puzzle and six Challenge Rooms',
    'Thumb Glide, Classic Buttons, left-handed and aim-assist accessibility options',
    'Portrait-first 720×1280 presentation with multitouch, keyboard, mouse and gamepad input',
  ],
  howToPlay: [
    'Move with A/D or the arrow keys and jump with Space. On touch, drag the lower-left pad and flick up to jump.',
    'Tap anywhere in the room to fire toward that point. Shots travel through the world and can bounce off mirrors.',
    'Hit every switch on a hatch to open it, then climb the staircase to the next chamber.',
    'Switch blasters with 1–4. Volt powers circuits, Growth grows platforms and Gravity slides crates onto plates.',
    'Collect the required gems to light the portal and reach it. Optional gems and a clean run earn the extra stars.',
    'Escape pauses and R restarts a room.',
  ],
  levels: '500 rooms · 10 worlds · 5 modes',
  saveKey: 'switchshot-adventures-save-v1',
},
```

Add a matching row through the portal's publish path (or a new migration under
`littlejoyarcade/supabase/migrations/`; never edit an applied migration), then open the
game through the portal and confirm:

- the game boots and the arcade shell identifies the player;
- a completed room's stars appear in the cloud save and restore on a second browser;
- guest play still saves locally with the shell blocked or offline.

## Acceptance checks

- `npm test` passes all 36 tests, including the 500-room validation sweep.
- `npm run build` succeeds.
- `node tools/smoke.mjs <preview-url>` passes with zero console errors.
- A phone-sized browser can drag-move, flick-jump, tap-shoot, pause and clear a room.
- A guardian clear saves `wX-50`; a hard reload restores progress.
- The portal's live version, the deployment and the database row agree.

## Rollback

Keep the previous successful Pages artifact in Actions history and re-run it, or
revert the catalogue row and its migration. Local saves are versioned; do not rename
`switchshot-adventures-save-v1` without a schema migration in `src/core/save.ts`.
