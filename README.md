# Living Town choice game

The homepage is a short, replayable Three.js town game inspired by order-dependent GROW games. Choose eight ideas once each. Buildings gain three distinct forms, earlier choices react to later ones, and the surroundings change with them. A windmill upgrade draws a stream from the main river, turns its sails, and grows wheat. One order brings every idea to MAX; another reveals a secret ending. The five project landmarks remain clickable portfolio entries throughout. The old 2D homepage is preserved at the annotated `webpage-1.0` tag.

## Run locally

```sh
npm ci
npm run dev
npm run check
npm run build
npx vite preview
```

The production build is in `dist/`. The staging script copies the existing `idle-wizard/ota/` and `idle-whitch-craft/` trees, project artwork, and favicon so their public URLs remain available on GitHub Pages.

## Town systems

- `src/town/game.ts` evaluates each choice and its chain reactions. A missed prerequisite cannot be recovered during that run. The game save uses `davstep.choice-town.v1` and keeps the current run, best MAX count, and secret discovery.
- `src/town/game-snapshot.ts` maps idea levels to authored 3D building stages. `src/town/town-plan.ts` defines the building sites and the existing road and wall layout.
- `src/town/game-path.ts` and `src/town/game-scenery.ts` add the windmill stream, growing wheat, moving sails, bridge, grove, and secret-ending birds. `src/town/environment.ts` carves the stream bed into the terrain.
- `src/town/scene.ts` builds staged cottages, landmarks, civic buildings, roads, and fortifications from shared materials and geometry. Mobile uses simpler geometry.
- `src/town/residents.ts` and `src/town/collision.ts` handle townspeople and walking collision. `src/town/main.ts` runs the game, choice animations, camera, portfolio panels, controls, reduced motion, and WebGL fallback.
- `src/town/projects.ts` holds the real-world project copy and public links. The fictional town's upgrade levels do not imply a change in project status.

## Visual and performance previews

In development, `?fallback=1` previews the WebGL fallback. `?profile` exposes browser metrics as `data-*` attributes on `<body>`. The game itself is deterministic and saves after every choice.

The production scene targets 60 fps on desktop and 30 fps on mobile, with adaptive pixel ratio and a paused render loop in hidden tabs. Project artwork loads when its panel opens. The HTML poster and navigation appear before Three.js initializes.

Choose **Roam** to explore on foot. WASD or arrow keys move, Shift moves faster, dragging turns the view, and Escape returns to the overview. On touch screens a joystick appears for movement. The portfolio remains available from the menu and each project landmark.
