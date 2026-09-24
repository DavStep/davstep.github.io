# World production batch — 24 September 2026

This batch extends the cottage pilot with a castle, six civic families, nine nature families, five crafted props, and redesigns of five project landmarks. The models were generated, inspected, and exported through the connected Blender MCP. Runtime adapters now use the authored geometry at both quality levels while keeping plot positions and growth timing.

## Delivered work

| Family | Desktop triangles | Mobile triangles | Editable source / review |
|---|---:|---:|---|
| Castle, mature | 8,585 | 3,831 | `art/blender/castle.blend`; `art/reviews/castle/` |
| Market, tavern, forge, mill, guild, post | 4,072–4,712 each | 1,792–2,080 each | `art/blender/civic.blend`; `art/reviews/civic/` |
| Three pine silhouettes | 272–316 each | 92 each | `art/blender/nature.blend`; `art/reviews/nature/` |
| Two shrubs | 100 each | 30 each | Same nature library |
| Three rocks and path stone | 46 each | 18 each | Same nature library |
| Fence / barrel / crate | 92 / 284 / 120 | 48 / 130 / 72 | `art/blender/props.blend`; `art/reviews/props/` |
| Lantern / firewood | 132 / 144 | 72 / 72 | Same props library |
| Outpost / Sandship / Battle | 3,342 / 3,918 / 2,980 | 1,382 / 2,030 / 1,248 | `art/blender/landmarks.blend`; `art/reviews/landmarks/` |
| Wizard / Dwarves | 3,871 / 2,140 | 1,679 / 1,056 | Same landmark library |

Following feedback on the overly narrow silhouette, the castle now has a broad rectangular great hall between the curtain walls and upper keep, with sloped tiled roof shoulders, windows and raised banners. It appears in stages 5–6 and retains the existing footprint. The castle also received a second art pass to close the keep gable beneath its roof and add windows, corner masonry and tower masonry patches. Civic revisions corrected mill sails, guild facade depth and the stage 5–6 extension orientation against the existing collision shapes. The subsequent [landmark art pass](landmark-production.md) replaces the initial subdivision cleanup with five distinct authored designs and project-specific architecture.

The runtime now instances the authored trees, shrubs, rocks, street lanterns and fences. Broadleaf slots use the fir silhouettes to match the supplied village reference. Tree obstacle centers remain in place. Household barrels, crates and log piles accompany mature homes. Ground-following dirt ribbons replace raised road strips; irregular authored stones follow the existing routes. Timber ring walls use the new fence kit; stone walls receive shallow masonry facing. Stone gate silhouettes and large merged-building connectors still use their older procedural geometry.

## Validation and evidence

- TypeScript and all **31 tests pass**, including growth-stage coverage, collision envelopes, triangle budgets, road normals and shared-geometry lifetime across rebuilds.
- `npm run build` passes. Its single JS bundle is **11.11 MB uncompressed / 1.24 MB gzip**, with Vite's large-chunk warning. Both LOD libraries are currently packaged together; asset streaming remains an optimization opportunity.
- Civic, castle, props and landmark GLBs round-trip with matching triangle counts. Nature checks cover representative pine/path-stone exports. Reports and neutral renders are under `art/reviews/`.
- [Desktop production census](geometry-production-desktop.json) and [mobile production census](geometry-production-mobile.json) include hashes of runtime source and generated asset data. Regenerate with `node --import tsx scripts/audit-town-assets.mjs --production`, optionally adding `--mobile`.
- At 50 minutes, seed 12345, desktop structures are **230,548 triangles** versus the baseline 451,717; mobile structures are **99,824** versus 133,225. Paving and wall detail increase those categories. These are instantiated source geometry counts, not FPS results.
- The parent inspected the combined square render after correcting a Blender attribute-name collision in the review importer. Roof silhouettes, tree scale and existing road clearances are readable together; the remaining older merged connectors and simple wall silhouettes are still visible.
- `scripts/export-town-review.mjs` exports the actual 30-minute runtime layout. `art/blender/review_world.py` renders it in Blender with neutral review lighting; outer instanced scenery beyond radius 78 is omitted. These renders do not reproduce game shaders, weather or camera interaction.

## Remaining work

Art-review status remains provisional until live desktop/mobile roam views can be inspected. Browser screenshot capture failed and later browser-control calls timed out; a Blender geometry render is not being represented as a live game capture.

The four merged-building complexes, stone gates, main terrain/cliff transitions, pond reeds, grass, character models and carried props remain unfinished. Wall-mounted sign/lantern variants and optional bridges/cannons still need a separate disposition. The redesigned Dwarves landmark now fits its existing picking box. Concurrent atmosphere work in `main.ts`, `sky.ts`, `rain.ts` and `town-plan.ts` was preserved.
