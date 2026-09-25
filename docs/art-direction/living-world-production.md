# Wildlife and river trade

Implemented 25 September 2026 for the playable nine-choice town. Animals and shipping are consequences of the existing levels; they do not add new choice cards or change puzzle solutions.

## Habitat progression

| Improvement | Visible response on desktop |
|---|---|
| Empty world | No added wildlife, landing or shipping. |
| Grove LV 1 | Four birds circle above the hill. |
| Grove LV 2 | Six birds and two deer in the western woodland clearing. |
| Grove MAX | Eight birds and four deer. A working Windmill brings the bird count to ten. |
| Settlers LV 2 + any Grove | Three sheep graze beyond the east wall. |
| Working Windmill | The established flock gains two sheep. |
| Settlers MAX | The established flock gains another two sheep, up to seven. |

Birds flap their wings while circling. Deer and sheep alternate walking and grazing with articulated heads and legs. Reserved meadow areas keep random trees and rocks off their routes. Animal counts follow habitat and husbandry levels, not the number of arbitrary buildings placed.

Mobile caps are six birds, two deer and four sheep. Their prerequisite rules are identical. Reduced motion preserves the population and freezes movement, wingbeats, grazing poses, ship bobbing and crane loading.

## Port progression

| Port stage | Requirements | World change |
|---|---|---|
| Landing | Roads LV 2+ and Windmill LV 1+ | Timber quay, mooring posts, gangplanks and a path from the north gate to the near bank. |
| Trading port | Landing + Windmill LV 2+ + Market LV 2+ | Shore cargo and one visiting merchant boat. |
| Developed port | Windmill, Market and Workshop all MAX | Cargo crane, harbor lantern, animated loading and a second merchant boat on the route. |

Boats are shallow-draft cargo sailboats sized for the river. They travel along the main river, match its changing height and tangent, pause beside the quay, then depart. Boats use staggered visits so only one berths at a time. The mill's smaller branch is not the shipping lane. A failed supply chain or sealed-wall order cannot produce active river trade.

The current Windmill represents river improvements in the nine-choice build. A later implementation of the ten-choice redesign can move these conditions onto its water-management states. No tidal cycle, fishery economy, animal population simulation or additional resource production is implied by this visual layer.

## Assets and implementation

`art/blender/build_living_world.py` authors the models in isolated LivingWorld scenes through Blender MCP, preserves other scenes, exports desktop/mobile GLBs and writes the articulated runtime buffers. Editable source: `art/blender/living-world.blend`. GLBs: `ENV_LivingWorld_LOD0.glb` and `ENV_LivingWorld_LOD1.glb`.

| Family | Desktop triangles | Mobile triangles |
|---|---:|---:|
| Bird | 56 | 56 |
| Sheep | 464 | 312 |
| Deer | 484 | 352 |
| Merchant boat | 210 | 170 |

Both exported GLBs passed Blender reimport checks: 1,214 and 890 triangles respectively. Runtime merges mesh pieces by articulation group and material, shares source geometry across animals, and batches static port structures. Counts are bounded and restarting hides the entire addition. Owned port buffers are disposed without disposing shared materials or model buffers.

Files: `living-world-state.ts` derives counts and port stages; `living-world.ts` owns models, animation and river visits; `game-scenery.ts` projects levels and reduced-motion settings. Choice narration calls out new wildlife and port development. Terrain resolution was expanded along the main river after a visual review exposed coarse triangles covering portions of the navigable water.

## Validation and review

Automated checks cover prerequisites, failed/blocked trade, desktop/mobile counts, restart, frozen reduced-motion transforms, resource ownership, habitat containment, valid model triangles, boat bank/bed clearance across 201 route samples, and clearance against the actual triangulated terrain in both detail tiers. The full suite has 61 passing tests; the production build passes with the pre-existing large-chunk warning.

Browser checks cover scene initialization, progression narration, skip, reset and completion. Browser screenshot capture remains unavailable in this session. Review PNGs in `art/reviews/living-world/` are Blender renders of exported runtime geometry under neutral lighting. River color is approximated for review; the runtime shader's animated ripples are not reproduced.

Reproduce the desktop review:

```sh
node --import tsx scripts/export-town-review.mjs --game --life
```

Then execute `art/blender/review_living_world.py` through Blender MCP. Add `--mobile` to export the mobile tier. Intermediate runtime geometry is ignored by Git. Changes are local and have not been deployed.
