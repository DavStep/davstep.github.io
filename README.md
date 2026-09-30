# Games & little worlds

Project UI/UX skills are installed in `.agents/skills` and referenced by `AGENTS.md`. See [the design direction](docs/design/portfolio-ui.md) and [skill sources](.agents/skills/README.md).

The homepage is a readable, scrolling portfolio: an introduction, three Rockbite games with contributions, two independent playable projects, and about/contact sections. Project artwork and links are available without JavaScript. The introduction and interactive planet occupy their own opening area. On desktop, the world sits on the right with a soft fade behind the text; on phones, it sits below the introduction. Work, personal projects, About, and Contact occupy a separate reading surface below. The duplicate town invitation has been removed. It shares one renderer with the optional game opened from Play. The world loads after the readable page appears, pauses when the hero scrolls out of view or the tab is hidden, and holds still for reduced motion. Saved progress resumes when they play again.

Appearance defaults to the browser's light/dark preference, with dark as the fallback when neither preference is available. The header's System / Light / Dark control remembers manual choices and can return to following the browser. The theme is applied before first paint and shared by the portfolio, game HUD, and project panels.

The hero globe can be dragged in both directions with a mouse or turned horizontally by touch while vertical gestures scroll the page. Its small arrow controls also rotate it; focus the globe and use arrow keys, or Home to reset. Wheel, pinch, plus/minus keys, and small zoom buttons control the view. Drags coast into a slow spin when motion is allowed, and the Pause control stops ambient animation. Manual rotation works with reduced motion and preserves its view when returning from the game.

The town is a ten-choice game on a spherical world. Place each idea once; workers, timber, tools, water, surveys and transport develop its actual functions. Missing supplies can arrive later. A final building immediately uses everything already available. Eight authored geometry stages remain, but stages now follow named developments rather than a hidden ordering of reciprocal partnerships.

World events make order matter. A seaworthy ship retrieves a chest already visible on an island. Gold attracts a dragon after the next choice: a Wizard tames it and keeps a sleeping dragon and hoard beside the tower; otherwise it steals the gold and burns the harbor orchard. Volcanic smoke intensifies after choice six and the mountain erupts after choice eight. Surveyed dwarf diversion works contain the lava and yield an Ember Core; an unprepared eruption blocks the mountain wagon route until local mining machinery opens a bypass. A road caravan retrieves the Sky Lens from a pre-existing shrine. Core, retained gold and lens install in the Wizard tower and power its beacon. Failed events leave scars even after functional repairs.

Cinematics follow sources, journeys, collection and delivery. The rule engine saves each complete decision before playback. Skip, restart, reload, reduced motion, and WebGL fallback use the same deterministic outcomes. Warnings stay visible between choices, an artifact tray shows custody, and the final journal explains events and missing supplies. The five portfolio projects are visible on the homepage and remain available through My work while playing.

See [current rules](docs/design/current-progression.md), [event design](docs/design/world-event-progression.md), and [visual implementation notes](docs/design/world-event-visual-progress.md).

## Run locally

```sh
npm ci
npm run dev
npm run check
npm run build
npx vite preview
```

The production build is in `dist/`. The staging script copies the existing `idle-wizard/ota/` and `idle-whitch-craft/` trees, project artwork, and favicon so their public URLs remain available on GitHub Pages.

Run `node scripts/portfolio-smoke.mjs` against the local dev server to check the page, optional-game navigation, saved progress, and desktop/mobile layouts. Set `TOWN_URL` to check a preview server.

Run `node scripts/theme-smoke.mjs` to check both appearances, browser preference changes, persistence, dark fallback, storage restrictions, and game panels at desktop/mobile sizes.

Run `node scripts/hero-interaction-smoke.mjs` against a dev server to check globe dragging, keyboard controls, reduced motion, game transitions, and touch/page scrolling.

Run `node scripts/hero-production-smoke.mjs` against the preview server (or set `TOWN_URL` for the deployed site) to verify the planet's separate desktop column, unobstructed drag area, visible rotation, and animation/pause/resume in both themes without development-only hooks.

## Town systems

- `src/town/planet-geography.ts` defines the native spherical terrain and dry town sites. `planet-landscape.ts` renders the new terrain, ocean, forests, clouds, and routed fantasy paths. `planet-roads.ts` connects occupied sites over dry, gentle terrain, keeps river channels clear, and restricts wall crossings to open gates. Roads begin as worn dirt; increasing Roads levels expands irregular stone paving outward from town while rural paths remain dirt. The elevation field uses domain-warped continents and connected alpine ridges, shared at 1536 × 768 resolution by rendering and picking. `planet-materials.ts` shades continuous grass, rock strata, snow and beaches, plus depth-colored cartoon water with curved wave highlights and animated surf. Surface details use spherical or triplanar coordinates to avoid seams. `planet-clouds.ts` simulates wind belts, ocean moisture, inland drying and gradual cloud lifecycles using a fixed pool; it pauses for reduced motion and bounds elapsed time after hidden tabs. `planet-assets.ts` generates instanced fir crowns and fused cumulus meshes; the landscape uses separate desktop/mobile geometry budgets. `planet-layout.ts` maps existing town coordinates to this surface and back for picking. `planet-scene.ts` adapts the original town models and construction animations, including their shadow pass, to the new elevation map. `planet-placement.ts` keeps buildings facing their streets through upgrades, and makes the light stay fixed in the view as the globe turns. Thin town surfaces share the GPU ground lookup, and the planet camera uses a tighter near plane for depth precision. The previous valley and mountain ring are hidden. The planet uses `davstep.choice-planet.v3` storage and leaves older town saves intact.

- `src/town/action-rules.ts` defines named development stages, required capabilities and the functions they provide. `world-event-logic.ts` resolves supplies and once-only events in choice order; `world-event-types.ts` defines artifact custody and persistent world facts.
- `src/town/game.ts` validates version 3 decisions, reconstructs event history, and calculates results. Old saves remain under their previous keys and are not reinterpreted.
- `src/town/action-story.ts` combines adjacent growth stages while preserving the chronological order of deliveries, events and resulting developments. `main.ts` owns playback, automatic camera, pause/cancel, warning UI, artifact tray and final journal.
- `src/town/planet-world-events.ts` projects persistent event state and samples cinematics independently of frame rate. `world-event-dragon.ts`, `world-event-props.ts`, and `world-event-terrain.ts` provide native spherical models, safe/damaging lava routes, orchard states, and caravan access. The event model review source is saved in `art/blender/world-events-review.blend`.
- `src/town/game-snapshot.ts` maps idea levels to authored 3D building stages. `src/town/town-plan.ts` defines the building sites and the existing road and wall layout.
- `src/town/planet-rivers.ts` supplies the globe’s mill-side river, staged banks and flowing water, and dry crop plots. Oceans and clouds persist through restart; constructed channels and crops reset.
- `src/town/game-path.ts` and `src/town/game-scenery.ts` add the windmill stream, growing wheat, moving sails, bridge, grove, and secret-ending birds. `src/town/environment.ts` reveals the main river and forest from their choices and carves the stream bed into the terrain.
- `src/town/scene.ts` builds staged cottages, landmarks, civic buildings, roads, and fortifications from shared materials and geometry. Mobile uses simpler geometry.
- `src/town/choice-worker.ts` animates the single visiting worker, while `src/town/residents.ts` supplies its authored geometry and clear approach planning. `src/town/collision.ts` keeps its worksite clear. `src/town/main.ts` runs the game, choice animations, automatic camera, portfolio panels, reduced motion, and WebGL fallback.
- `src/town/projects.ts` holds the real-world project copy and public links. The fictional town's upgrade levels do not imply a change in project status.

## Visual and performance previews

In development, `?fallback=1` previews the WebGL fallback. `?profile` exposes browser metrics as `data-*` attributes on `<body>`. The game is deterministic and saves the complete decision before playback. Skip, restart, and reload cannot leave half-applied choices. `?playtest=1` in development uses a separate save key for manual QA.

The production scene targets 60 fps on desktop and 30 fps on mobile, with adaptive pixel ratio and a paused render loop in hidden tabs. The homepage renders from HTML and a small entry bundle; the larger Three.js bundle loads when the hero enters the viewport or a visitor plays. A transparent screenshot of the actual scene covers the initial load and unavailable WebGL. The hero demonstrates a complete town without changing the visitor’s saved decisions. The HTML poster and game navigation appear before Three.js initializes.

The [September 30 performance pass](docs/performance-results/2026-09-30-town-optimization/report.md) retains desktop/mobile-layout measurements, visual comparisons, restart checks, and the exact limits of the diagnostic. `scripts/performance-pass.mjs` repeats the local alternating controls; it requires an installed Playwright runtime and Chrome. Planet projection caches scene topology while still checking material replacements, and permanently hidden flat-world scenery stays outside the planet renderer's traversal.

The camera follows each construction reaction automatically. Back to portfolio restores the visitor’s scroll position. My work opens the project panels without ending a run. The game uses `#town` and its panels use `#town/<panel>` so normal Work, About, and Contact anchors remain ordinary page navigation.

## Idea card art

The ten idea cards use small dioramas rendered from the town's own builders, materials and daylight, so each card shows the building that grows in the valley. The front shows the idea at MAX; when a run ends, each card flips to the stage it reached. `src/icon-studio/icon-scenes.ts` composes each idea per level, `icon-studio.html` previews all 80 renders in development, and `node scripts/render-idea-icons.mjs` (requires Playwright) writes them to `assets/idea-icons/3d/<idea>-<level>.webp`. Re-run it after changing a building's authored geometry.
