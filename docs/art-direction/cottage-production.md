# Cottage production — 24 September 2026

Blender MCP is installed, enabled, and verified against the running Blender 5.2.1 instance on localhost:9876. The Codex `blender` MCP entry uses `uvx mcp-for-blender`; telemetry is disabled. Authoring, mesh inspection, exports, round-trip imports, and review rendering were executed through the MCP protocol. The original Blender scene is preserved.

The first production batch replaces every `home` with three authored cottage families. Clay, timber-brown, and slate roofs share steep gables, overlapping shingles, warm plaster, dark framing, masonry footings, framed windows, and grounded doors. Growth stages retain foundations/posts, half walls, completed shell, occupied details, east shed, and west wing. The porch still follows the original variant slot; plot placement and collision rules are unchanged by this batch. Broken dormers and floating bays are replaced by gable openings and grounded additions. This is a house batch, not completion of the environment redesign.

## Deliverables

- Editable source: `art/blender/cottages.blend` (library, original geometry comparison, village review, and turnaround scenes).
- Reproducible authoring and QA: `art/blender/build_cottages.py`, `art/blender/review_cottages.py`.
- Interchange exports: six `ENV_Cottage_{A,B,C}_LOD{0,1}.glb` files plus two porch GLBs in `art/blender/`.
- Runtime geometry: `src/town/generated/cottages.json`; coordinates are already Three.js Y-up, local ground zero, facade toward +Z.
- Adapter: `src/town/cottages.ts`; placement adds the town ground elevation of 0.48. It caches source geometry and shares existing runtime materials. The existing structure collector merges copies by material and preserves roof vertex colors.
- Review images: `art/reviews/cottages/village-review.png`, `front.png`, `back.png`.
- QA reports: `art/reviews/cottages/technical-review.json`, `triangle-report.json`.

Vite has `publicDir: false`. The application imports baked geometry directly so construction remains synchronous, with no model download race or replacement flash. GLBs are authoring/interchange deliverables and are not fetched by the game. JSON and GLBs are generated from the same Blender meshes; models are not independently recreated by the TypeScript adapter.

To rebuild with Blender open and its MCP server running:

```sh
uv run --with mcp-for-blender python scripts/blender-mcp-run.py art/blender/build_cottages.py
uv run --with mcp-for-blender python scripts/blender-mcp-run.py art/blender/review_cottages.py
npm run check
npm run build
```

The rebuild replaces only named generated cottage scenes. The optional original comparison is populated from `/tmp/town-original-houses.json` when that audit snapshot is available; the delivered `.blend` already contains it. Solid-color materials need no texture images. Roof vertex colors are linear RGB; other materials map by the JSON `material` key into `MAT`.

## Review evidence

| Variant | Mature desktop triangles | Mature mobile triangles |
|---|---:|---:|
| A, clay | 4,680 | 2,020 |
| B, timber brown | 4,668 | 2,032 |
| C, slate | 4,680 | 1,900 |
| Optional porch addition | 764 | 380 |

These are authored geometry counts, excluding runtime renovation flowers. Mobile A/B are slightly above the initial 2,000-triangle target; porch variants also add their explicit geometry. Whole-scene performance has not been accepted from these counts alone.

Blender review: front, rear three-quarter, and a representative village composition inspected. All 179 exported part meshes have identity transforms, zero degenerate triangles, and zero non-manifold edges. The six mature cottage GLBs were re-imported and their triangle counts match the source; no cameras, lights, default cube, or unexpected objects appear in those exports. The source retains closed component volumes; concealed intersections at timber joints and roof/wall junctions are intentional assembly overlap.

Runtime review: all six stages and both LODs have geometry; porch selection, materials/colors, renovation flowers, and repeated structure rebuild/disposal are covered by focused tests. `npm run check` passed 16 tests and `npm run build` passed. A 30-minute preview loaded with an active WebGL canvas and no captured browser errors or warnings.

Remaining review: the browser screenshot tool could not capture the live canvas, so the Blender render is not represented as an in-game screenshot. Final in-game artistic approval at roam distance, mobile viewport, night, and rain remains open. Trees, paths, and fencing shown in the Blender composition are review set dressing, not new runtime environment exports. Castle, civic buildings, and the broader queued environment families remain separate production batches.
