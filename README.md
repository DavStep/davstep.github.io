# Town order puzzle

The homepage is a ten-choice order puzzle with a Three.js town as its result. Click any unused idea to place it immediately, watch the town react, then click another. Each button can be used once per run. Each idea has eight authored stages. Pairs of ideas have one-time collaborations: when the second partner arrives in the right order, both sites grow. Reversing a pair misses that collaboration for the run, while other partnerships can still advance both ideas. Complete all 28 collaborations and reach all 80 levels to solve the valley route. Starting with Archive opens a second complete route and its Storybook Night ending. Partial runs show their score and explain each missed collaboration. The five portfolio projects remain available from Work.

Reactions play in causal waves, with distinct visual treatments for settling, fortification, growth, forging, crossings, trade, irrigation, harvest, knowledge, and astronomy. A brief caption describes the current event after the player has chosen. The remaining buttons become available automatically when the reaction ends. One worker in the selected idea's card color arrives, works through that choice, and leaves; no residents roam between clicks. The opening valley has no trees or main river; Grove plants the forest in stages, and River carves and fills the main waterway. Later walls develop on the existing town ring rather than spawning distant forts.

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

- `src/town/action-rules.ts` defines the 28 named collaborations and the growth stages each gives its two partners.
- `src/town/game.ts` replays one-time collaborations in choice order, records missed links, and produces the event waves used by the scene. Version 2 saves use a new key so older runs are not silently reinterpreted under the new rules. Best scores and secret discoveries are retained within version 2.
- `src/town/action-story.ts` provides event titles, causal waves, and effect styles. `reaction-effects.ts` draws temporary supply connections and action-specific payoffs; existing construction, river digging, wheat, and Sandship systems provide persistent world changes.
- `src/town/game-snapshot.ts` maps idea levels to authored 3D building stages. `src/town/town-plan.ts` defines the building sites and the existing road and wall layout.
- `src/town/game-path.ts` and `src/town/game-scenery.ts` add the windmill stream, growing wheat, moving sails, bridge, grove, and secret-ending birds. `src/town/environment.ts` reveals the main river and forest from their choices and carves the stream bed into the terrain.
- `src/town/scene.ts` builds staged cottages, landmarks, civic buildings, roads, and fortifications from shared materials and geometry. Mobile uses simpler geometry.
- `src/town/choice-worker.ts` animates the single visiting worker, while `src/town/residents.ts` supplies its authored geometry and clear approach planning. `src/town/collision.ts` keeps its worksite clear. `src/town/main.ts` runs the game, choice animations, automatic camera, portfolio panels, reduced motion, and WebGL fallback.
- `src/town/projects.ts` holds the real-world project copy and public links. The fictional town's upgrade levels do not imply a change in project status.

## Visual and performance previews

In development, `?fallback=1` previews the WebGL fallback. `?profile` exposes browser metrics as `data-*` attributes on `<body>`. The game is deterministic and saves the complete decision before playback. Skip, restart, and reload cannot leave half-applied choices. `?playtest=1` in development uses a separate save key for manual QA.

The production scene targets 60 fps on desktop and 30 fps on mobile, with adaptive pixel ratio and a paused render loop in hidden tabs. Project artwork loads when its panel opens. The HTML poster and navigation appear before Three.js initializes.

The camera follows each construction reaction automatically. The portfolio remains available from the Work menu.
