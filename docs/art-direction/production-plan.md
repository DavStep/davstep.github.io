# Inconsistencies and prioritized production plan

## Major inconsistencies

1. **The world has primitive silhouettes despite expensive geometry.** Mature desktop cottages contain 10,742–11,505 triangles for variants 0–3; the same mobile houses are 2,205–2,613. Much of the difference comes from subdivided rounded boxes rather than useful silhouette detail. Redirect it into roof edges, timber profiles, stone joins and foreground clutter.
2. **Castle hierarchy does not match Reference B.** The 11×10 core, box keep and shallow cone caps lack tall orange spires, substantial masonry courses, round-tower articulation, hanging banners and attached rock terraces. Rebuild the tower/roof kit first, preserving existing footprints.
3. **Roads read as geometric bands.** Uniform rectangular spokes and concentric pale ring segments contradict Reference A's warm earth and irregular grouped stones. Preserve route centerlines and growth timing while replacing their visible surfaces and shoulders. Desktop roads currently use 53,300 source triangles.
4. **Vegetation is split across inconsistent generators.** Town and forest pines use different cone segment counts, heights and colors. Both need one varied crown family, supported by intentional shrub/grass clusters rather than uniform scatter.
5. **Rocks lack the shared fracture language.** Town, river, forest and mine rocks derive largely from an icosahedron; distant terrain is a radial triangular ridge. Use angular slab geology locally while preserving the connected distant silhouette and water shape.
6. **The settlement lacks the reference's domestic context.** Barrels, firewood, crafted crates, hanging signs, framed lanterns and proper fence returns are absent or represented by anonymous primitives. These should appear in purposeful clusters after primary silhouettes are approved.
7. **Landmarks have incompatible presentation bases and accent intensity.** Keep their game motifs, but unify material response, support structures, edge treatment and surrounding ground. The giant card and floating factory are intentional identity exceptions, not reasons to abandon world consistency.
8. **Scale and attachments require inspection before replacement.** Residents are taller than doorway openings; mature cottage roofs/wings extend well beyond core sizes; Dwarves' rock cluster exceeds the nominal project collider. `dormer()` places its trim at parent X/Z rather than its own offset. Merged market roofs bypass tile generation. Resolve the visual system and measured bounds before changing colliders or dimensions.
9. **The runtime has no authored-model pipeline.** All assets are code-generated; there are no Blender sources, GLB files, model loader, LOD switcher or export validation reports. Runtime batching strips most vertex colors/UVs. Blender production therefore needs a deliberate import/integration bridge.
10. **Existing lighting work needs reconciliation.** Contact-shadow meshes and lighting updates appeared during the audit. Preserve and review these changes with the new assets instead of blindly superseding them. Screenshot capture is currently unavailable, so lighting and overall appearance have not passed art review.

## Prioritized batches

| Priority | Assets / outcome | Dependency | Review requirement |
|---|---|---|---|
| P0 | Establish stable audit snapshot, Blender MCP connection, original-geometry transfer and neutral scale fixture | Missing Blender MCP resolved | Scene inspection and source hash match; no modeling before existing geometry can be compared |
| P1 | Pilot cottage A, steep tiled roof kit, one round castle tower/spire, stone course/arch kit | P0 + standards | Reference A/B silhouette match; existing envelope and root preserved; no ornamental noise |
| P2 | Dirt/stone path family, foreground pine variants, shrub/fern cluster, local fractured rocks | P1 palette/scale anchors | House + path + tree + fence/rock test composition; centerlines and tree/water obstacles retained |
| P3 | Cottage variations, civic shells, full castle, staged walls/gates and meaningful construction phases | Approved P1/P2 kits | Ages 0/7/16/23/30, all sides readable, clear gates, silhouette diversity |
| P4 | Fence, lantern, crate, barrel, firewood, sign; cottage/market/civic clustering | Approved structures and route margins | Clutter located by use; passages clear; no repeated identical arrangement |
| P5 | Five project landmarks and five merger additions integrated into the shared world | Shared material/edge standards stable | Project identity and selection retained; no isolated display-plinth appearance |
| P6 | Terrain/shore transitions, distant forest/rocks, resident scale/detail reconciliation, mobile simplification | Near scene approved | Balanced foreground/background hierarchy and measurable geometry savings |
| P7 | Full scene art/technical review, revisions, final production build | Every delegated asset reviewed | Reference-aligned compositions, runtime checks, performance and state matrix all pass |

Optional N11 plank approach and N12 cannons follow the main gates only if they improve the civic scene without changing traversal. They are not prerequisites for redesigning the live town. Remove dormant E08 only after confirming it still has no callers at integration time.

## Production sequence and ownership

Use three GPT-6 Sol agents at **high** reasoning for bounded pilot production, not whole-world independent reinterpretations. The primary art director owns palette, scale fixture, source snapshot, reference interpretation, review decisions, loader/batching/collision integration, and final scene composition. See the exact [agent briefs](agent-assignments.md).

Run the pilots in separate Blender files to avoid overwriting the same active scene. If a single Blender MCP server cannot address multiple independent documents, serialize Blender mutations. Parallel agents may prepare specifications and validate exports independently; they may not concurrently mutate an unidentified shared Blender scene.

After pilot review, send concrete revisions such as “increase spire rise while keeping eave radius and pivot unchanged” or “replace three uniform cone tiers with five offset branch skirts; retain obstacle radius.” Do not accept an asset because it merely exists or passes export.

## Required completion evidence

- Every inventory/tracker row resolved, including explicit disposition of missing and optional families.
- At least the village and civic review compositions inspected in Blender, and integrated town views inspected in-browser.
- Per-asset desktop/mobile counts, material mapping, clean transforms, normal/duplicate checks and round-trip export results.
- All growth stages, project selections, mergers, water and gate constraints checked; no save schema change unless independently required.
- Existing automated checks and production build pass; baseline/final profiling recorded at the same camera, viewport, age, weather, and pixel ratio.
- Remaining deviations recorded precisely. No APPROVED or INTEGRATED status based solely on code inspection.

Current state: Blender MCP connected; the first cottage family is authored, exported, technically reviewed, and wired into the runtime. See cottage-production.md for evidence and remaining live visual approval. Other planned families remain queued. Inconsistencies above describe the pre-production baseline.
