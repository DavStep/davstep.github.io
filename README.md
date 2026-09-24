# Living Town portfolio

The 2.0 homepage is a TypeScript and Three.js town that grows with elapsed time. The old 2D homepage is preserved at the annotated `webpage-1.0` tag.

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

- `src/town/model.ts` defines seeded plots, milestone timing, section-by-section roads and walls, seasons, renovations, and eligible neighbor mergers. A snapshot is calculated directly from elapsed time, including time spent away.
- `src/town/residents.ts` defines the road graph, cached routes, resident roles, destinations, schedules, and instanced character parts.
- `src/town/scene.ts` builds the procedural structures and environment from shared matte materials. Static structure geometry is batched by material; repeated walls, trees, lights, and residents are instanced. Mobile uses simpler geometry.
- `src/town/main.ts` handles local saves, the camera, portfolio panels, history, controls, reduced motion, adaptive resolution, and the WebGL poster fallback.
- `src/town/projects.ts` holds the real-world project copy and public links. Town construction stages describe the fictional settlement and do not imply a change in project status.

Saves use the versioned `davstep.town.v2` local storage key. They include a seed, creation and last-visit timestamps, event progress, and a monotonic elapsed-time floor. Corrupt or older saves start a new settlement.

## Visual and performance previews

In development, `?age=7`, `?age=16`, `?age=23`, `?age=30`, and `?age=50` preview milestone states without advancing the saved town. `?fallback=1` previews the WebGL fallback. `?profile` exposes browser metrics as `data-*` attributes on `<body>`; pairing it with `&age=30` works in the production build for release profiling. These previews do not change the stored creation time.

The production scene targets 60 fps on desktop and 30 fps on mobile, with adaptive pixel ratio and a paused render loop in hidden tabs. Project artwork loads when its panel opens. The HTML poster and navigation appear before Three.js initializes.
