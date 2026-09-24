# Project landmark art pass

The five project buildings now use purpose-built designs from `art/blender/hero_landmarks.py`, authored and exported in the connected Blender through `build_landmarks.py`. This replaces the earlier pass that mostly reduced subdivisions on the original primitive models.

| Project | Design | Mature desktop / mobile triangles |
|---|---|---:|
| Idle Outpost | Timber trading hall, striped canopy, covered counter, watchtower, barrels and supply crate | 3,342 / 1,382 |
| Sandship | Tracked factory crawler, shaped hull, cabin, boiler pair, conveyor, railings and unequal smokestacks | 3,918 / 2,030 |
| Battle Cards | Circular tournament yard, covered red/blue stands, duelling dais, framed duck champion card and trophy | 2,980 / 1,248 |
| Idle Wizard | Tapered masonry observatory, book room, arched door, individual violet spire shingles, brass ring and telescope | 3,871 / 1,679 |
| Drunk Dwarves | Fractured rock portal, timber braces, pulley hoist, rail cart, ore, miners' lodge and tankard sign | 2,140 / 1,056 |

All retain growth stages 3–6, fixed project positions and gameplay timing. The designs stay inside each original stage envelope while deliberately changing its silhouette; the tests now check containment rather than requiring the exact old bounds. All five fit the existing picking boxes, including the rebuilt mine, which removes its previous rock overhang.

## Review and validation

The parent inspected all five individual neutral Blender renders, the desktop and mobile library lineups, and the combined town view. Revisions fixed unsupported flagpoles, canopy braces protruding through the fabric, the duck helmet, door geometry, cargo clipping into the factory deck, and an overly plain arena. The observatory's violet shingles export as vertex colors through the existing shared roof material.

- All 10 mature desktop/mobile GLBs round-trip with matching triangle counts.
- All **31 tests pass**, including growth stages, historical envelopes, picker containment, finite normals, nondegenerate triangles and source-buffer lifetime during town rebuilds.
- Production build passes. Vite still reports the existing large combined JS chunk: about 11.11 MB raw / 1.24 MB gzip.
- The runtime adapter is `src/town/authored-landmarks.ts`; the baked data is `src/town/generated/landmarks.json`.
- Editable source: `art/blender/landmarks.blend`. Historical source remains in its separate comparison scene.
- Neutral lineup and individual views: `art/reviews/landmarks/`. Technical counts and bounds: `triangle-report.json` in that directory.
- Integrated layout renders: `art/reviews/world/`, generated from actual runtime geometry with neutral Blender lighting.

These are modeled and integrated assets with Blender visual review. Live game camera, night/rain and mobile visual approval remain open because browser capture has been unavailable. Blender previews do not reproduce the runtime atmosphere shaders.
