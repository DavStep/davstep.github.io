# Reactive castle mount

Implemented 25 September 2026. Mont-Saint-Michel is the composition reference: a dominant summit building with the settlement stepping down around it. This implementation keeps the existing river valley, adds a 16-unit-high central mount, and retains the portfolio landmarks' X/Z locations.

This is a world presentation layer for the **currently playable nine-choice game**. The ten-choice progression redesign in `docs/design/town-progression-redesign.md` remains a separate proposal. The quarry here belongs to Workshop; it is not yet a tenth player choice.

## Reactions in the playable build

| Choice / condition | Landscape response |
|---|---|
| Before any choice | Natural mount, flat castle summit, building shelves and four graded approaches. No worked masonry, quarry, cistern or cultivated beds. |
| Settlers LV 1+ | Summit retaining masonry appears as settlement foundations. |
| Roads LV 2+ | Additional worked terrace edges appear on the hillside. |
| Walls LV 2+ | Summit buttresses reinforce the upper terrace. Existing town walls follow their new ground elevations. |
| Workshop LV 1+ | West quarry face, dressed blocks and short rails appear. |
| Workshop LV 2+ with Roads LV 2+ | A loaded quarry handcart works a local spur. It never crosses a sealed town wall. |
| Grove LV 1+ | Four cultivated beds appear on the lower slope. |
| Grove MAX with Windmill LV 2+ | Planted rows and irrigation furrows appear in those beds. |
| Windmill LV 1+ | A stone cistern appears below the town. |
| Windmill MAX | The cistern visibly holds water. Existing mill-channel carving remains progression driven. |
| Archive LV 2+ | Survey stakes mark the project district. |
| All nine at MAX | A gold beacon and halo appear over the summit castle. |

Landscape groups reconcile directly from the settled levels on load, skip and restart. The underlying hill is stable, so scenery, labels and buildings do not slide when a choice resolves. The stream bed still changes during its existing progression. These are visual consequences, not additional resource rules or flood simulation.

## Runtime integration

- `topography.ts`: hill, stable shelves, summit escarpment, mill clearance and concentrated terrain mesh resolution.
- `environment.ts`: hill terrain and deeper stream excavation where the channel meets the slope.
- `scene.ts`: elevated building factories, terrain-following walls, summit road loop, raised picking boxes and plot contacts.
- `residents.ts`: routes around the summit rather than through the castle, with ground-height sampling.
- `main.ts`: elevated camera focus, labels and landscape obstacles for construction crews.
- `landscape-state.ts`: pure level-to-landscape projection and worksite reservations.
- `hillside.ts`: instanced Blender masonry, cultivation, handcart and beacon. Shared geometry/materials survive disposal; instance buffers and owned geometry/materials are released.

## Blender source and budget

`art/blender/build_castle_mount.py` creates isolated CastleMount scenes through Blender MCP. It preserves the user's original scene and saved project. The editable source is `art/blender/castle-mount.blend`; both `ENV_CastleMount_Kit_LOD0.glb` and `ENV_CastleMount_Kit_LOD1.glb` are exported. Runtime uses `src/town/generated/castle-mount.json`, with explicit Y-up coordinate conversion and shared material lookup.

| Family | Desktop triangles | Mobile triangles |
|---|---:|---:|
| Retaining module | 168 | 72 |
| Buttress | 24 | 24 |
| Quarry | 132 | 108 |
| Cistern | 312 | 168 |
| Total source kit | 636 | 372 |

Both GLBs were reimported into temporary Blender scenes and their triangle totals verified. The roundtrip and geometry reports are in `art/reviews/castle-mount/`.

## Review and validation

The tests cover the level summit, clear cardinal approaches, stream clearance at 101 samples, landscape dependencies and reset, reduced-motion cart stability, disposal, both LOD budgets, and nondegenerate exported triangles. Full TypeScript/test and production-build checks pass; the existing large-JavaScript-chunk build warning remains.

Browser interactions verified a full nine-choice all-MAX run, skipping animations, persistence on reload and restart to turn zero without console errors. Screenshot capture was unavailable from the browser tool, so these are interaction checks, not a completed browser screenshot review. Blender renders use the actual exported runtime geometry with neutral lighting. Water shader motion and browser postprocessing are not represented by those renders.

Reproduce a desktop review:

```sh
node --import tsx scripts/export-town-review.mjs --game --mount
```

Then execute `art/blender/review_castle_mount.py` through Blender MCP. Add `--mobile` for the mobile geometry tier or `--turn=0` for the untouched hill. Generated intermediate geometry is ignored by Git. No site deployment is part of this change.
