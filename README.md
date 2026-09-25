# Living Town choice game

The homepage is a short Three.js town game built around ten decisions and visible cause and effect. Inspect a plan, see which needs it meets, commit it, then watch connected systems respond. People tend timber, timber supports tools, tools build crossings, and crossings bring supplies. Each idea has eight authored stages. All orders can recover and complete the valley; the order determines when reactions happen. A secret order reveals Storybook Night. The five project landmarks remain clickable portfolio entries.

The decision panel offers a five-chapter suggested route without locking other choices. Completed ideas remain inspectable. The town journal reconstructs every decision and its reasons from the saved order. Reaction scenes group simultaneous upgrades and show sources before outcomes, with distinct visual treatments for settling, fortification, growth, forging, crossings, trade, irrigation, harvest, knowledge, and astronomy.

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

- `src/town/action-rules.ts` is the shared rulebook for prerequisites and their physical purpose. Expansion requires water, food, protection, plans, and surveys rather than a count of placed ideas. Early walls can gain gates once developed roads arrive.
- `src/town/game.ts` evaluates choices in simultaneous causal waves and emits the trace used by previews, playback, and the journal. The existing `davstep.choice-town.v1` save remains readable; saved orders are evaluated with the new recoverable rules. Best scores and secret discoveries are retained.
- `src/town/action-story.ts` and `decision-panel.ts` provide chapter guidance, forecasts, motives, outcomes, and inspection. `reaction-effects.ts` draws temporary supply connections and action-specific payoffs; existing construction, river digging, wheat, and Sandship systems provide persistent world changes.
- `src/town/game-snapshot.ts` maps idea levels to authored 3D building stages. `src/town/town-plan.ts` defines the building sites and the existing road and wall layout.
- `src/town/game-path.ts` and `src/town/game-scenery.ts` add the windmill stream, growing wheat, moving sails, bridge, grove, and secret-ending birds. `src/town/environment.ts` carves the stream bed into the terrain.
- `src/town/scene.ts` builds staged cottages, landmarks, civic buildings, roads, and fortifications from shared materials and geometry. Mobile uses simpler geometry.
- `src/town/residents.ts` and `src/town/collision.ts` handle townspeople and walking collision. `src/town/main.ts` runs the game, choice animations, camera, portfolio panels, controls, reduced motion, and WebGL fallback.
- `src/town/projects.ts` holds the real-world project copy and public links. The fictional town's upgrade levels do not imply a change in project status.

## Visual and performance previews

In development, `?fallback=1` previews the WebGL fallback. `?profile` exposes browser metrics as `data-*` attributes on `<body>`. The game is deterministic and saves the complete decision before playback. Skip, restart, and reload cannot leave half-applied choices. `?playtest=1` in development uses a separate save key for manual QA.

The production scene targets 60 fps on desktop and 30 fps on mobile, with adaptive pixel ratio and a paused render loop in hidden tabs. Project artwork loads when its panel opens. The HTML poster and navigation appear before Three.js initializes.

Drag the world to orbit, use the zoom controls to inspect it, and recenter for the overview. The portfolio remains available from the menu and each project landmark.
