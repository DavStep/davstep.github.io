# Proposed GPT-6 Sol High production assignments

These are dispatch-ready briefs, not active agents or completed work. Model: **GPT-6 Sol**; reasoning: **high**. Blender MCP is mandatory under the current brief. It is unavailable in the current session; do not dispatch modeling agents until access is confirmed, or the user explicitly changes the workflow.

All agents must read `art-direction.md`, `modeling-standards.md`, their inventory rows, both supplied references, and the original generated geometry. Use the supplied references as appearance constraints. None may establish an independent palette, change plot positions, alter collision envelopes, remove growth states, or expand scope into UI/gameplay.

## Agent A — architectural pilot

**Bounded assets:** B01 pilot cottage variant 0, B10 roof system, B19 tower, N06 masonry kit and N07 spire. Existing sources: `scene.ts` `building`, `tiledRoof`, `tower`; geometry census includes stages and bounds. Existing `.blend` files do not exist; the integration owner must first transfer originals for inspection.

**Working file/objects:** proposed `art/blender/architecture-pilot.blend`; `ENV_Cottage_A_LOD0`, `ENV_Cottage_A_LOD1`, `ENV_Castle_Tower_A_LOD0`, `ENV_Castle_Tower_A_LOD1`; source originals in a separate reference collection excluded from export.

**Direction:** Reference A timber/plaster body and dominant steep gable with broad overlapping shingles, deep eaves, restrained asymmetry and integrated stone footing. Reference B round masonry tower, projecting collar, steep orange tiled spire and narrow finial. Keep cottage core 3.8×3.5 and mature original world-space envelope; preserve tower center and lower footprint. Roof/trim must align at the dormer and gables. Do not reuse the castle's current shallow cone proportions.

**Geometry/material constraints:** cottage total 3k–5k desktop / 1.2k–2k mobile; tower module 1.2k initial desktop ceiling, request art-director reallocation if silhouette needs more. Shared palette only; one-segment visible bevels; no baked lighting. Pilot stone blocks, windows and roof tiles must support later civic/castle reuse. Preserve stage roots and sockets; provide stage 1/2 construction correspondence for the cottage.

**Deliverables:** editable Blender source, desktop/mobile GLBs, material map, triangle/bounds reports, original/replacement overlay, front/side/three-quarter neutral renders, daylight render at gameplay scale, brief on modular reuse.

**Acceptance:** roof dominates appropriately; individual tile edges remain legible without a noisy grid; timber feels structural; round tower and spire resemble B; no displaced dormer trim; scale/clearances match originals; both quality levels export cleanly. Parent reviews before any other houses/castle parts are produced.

## Agent B — vegetation pilot

**Bounded assets:** V01/V02 one shared pine family in three silhouettes (tall, broad, sapling), V06 shrub cluster, N10 fern/ground plant cluster. Inspect original town/forest trunks and crowns first; do not modify scatter code.

**Working file/objects:** proposed `art/blender/vegetation-pilot.blend`; `ENV_Pine_Tall_A`, `ENV_Pine_Broad_B`, `ENV_Pine_Sapling_C`, `ENV_Shrub_A`, `ENV_Fern_A`, each with desktop/mobile variants.

**Direction:** Reference A's irregular angular branch skirts near camera, simplified Reference B silhouettes at distance. Four to six staggered masses with visible trunk gaps and taper; crown height roughly cottage-ridge height for large nearby pines, saplings about half. No smooth blob crowns or identical three-cone stacks. Shrubs use 3–5 broad uneven lobes rooted into a common base, ferns few readable tapered fronds.

**Constraints:** preserve roots and current tree obstacle radii; increase no trunk collision footprint. Pines 180–420 triangles desktop / 70–160 mobile, shrubs 40–160 / 20–70. Use shared dark/mid/light olive values, strongest light at tips; no new texture per tree. Linked/shared meshes suitable for instancing; variation deterministic at placement time, not random export changes.

**Deliverables:** source/GLBs, pivots/bounds/counts/material map, silhouette comparison sheet, house-scale composition using Agent A's approved pilot, near/distant comparison.

**Acceptance:** variants differ before rotation; no branch interpenetration artifacts; crown readable at overview and roam scales; palette relates to A; planted ground contact; mobile silhouette preserved. Do not mass-produce or alter the forest until parent approval.

## Agent C — ground and crafted-prop pilot

**Bounded assets:** W05 three stepping-stone shapes, E05–E07 three fracture-rock shapes, W10/N04 one fence return kit, N01 barrel and N03 crate. Roads stay in runtime code; provide modular stone/edge pieces and material guidance rather than a new route layout.

**Working file/objects:** proposed `art/blender/ground-props-pilot.blend`; `ENV_Stone_Path_A/B/C`, `ENV_Rock_Slab_A/B/C`, `ENV_Fence_Post_A`, `ENV_Fence_Panel_A`, `ENV_Barrel_A`, `ENV_Crate_A`, quality variants as applicable.

**Direction:** A's pale uneven stones embedded in warm earth, dark uneven timber fence and useful domestic clutter; A/B shared broad angular rock fracture planes. Barrel has slight belly, thick staves, two dark hoops and inset top. Crate has broad visible plank construction and one diagonal brace. Fence includes an open corner/return, modest leaning posts and uneven upper outline.

**Constraints:** rock 24–96 desktop triangles; prop 80–300 desktop / 24–120 mobile. One shared timber palette, one stone family and iron bands. Root pivots at ground center; fence sockets at panel ends. Existing paths 1.2–2.8 units wide need passable centers; no new collision shape or route obstruction. Rocks partially buried; no floaters. Do not add cannons or bridges in this pilot.

**Deliverables:** editable source/GLBs, technical reports, modular sockets, neutral views, a compact house+path+fence+tree+prop vignette assembled from approved A/B pilots.

**Acceptance:** useful silhouettes at gameplay distance; wood and stone share architecture's edge treatment; cluster placement leaves doors and path centers open; no obvious repeated fence/stone grid; bounds and budgets verified.

## Parent integration and follow-up batches

The parent imports and reviews every pilot through Blender MCP, requests specific revisions, and sets APPROVED only after both art and technical review. Then assign bounded follow-ups: A cottage/civic/castle variants, B remaining trees/shore plants and terrain planting, C lantern/sign/firewood and wall/ground kits. Landmarks are a separate later batch with explicit project-identity constraints. The parent owns shared source edits and runtime integration, preventing agents from independently changing the monolithic `scene.ts`.

No shared Blender mutations in parallel without verified per-file targeting. When only one active Blender scene is available, serialize inspection/modeling/export operations while agents independently prepare review reports and briefs.
