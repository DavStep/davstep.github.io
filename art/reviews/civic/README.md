# Civic asset batch

`art/blender/civic.blend` contains the editable `Civic_Library`, the six-family
`Civic_Review`, and `Civic_Before_Comparison` with the captured original
procedural buildings beside the replacements. The library retains separate
collections for the foundation (stage 1+), construction posts (stages 1–2),
half walls (stage 2), completed shell and roof (stage 3+), family details
(stage 4+), east shed (stage 5+), and west wing (stage 6).

Run `art/blender/build_civic.py` through `scripts/blender-mcp-run.py` to export
the twelve `ENV_Civic_<family>_LOD<0|1>.glb` files and synchronous
`src/town/generated/civic.json`. The Blender axes are X right, Y back, Z up;
the JSON converts to Three.js X right, Y up, Z forward. Runtime roots sit at
terrain Y = 0.48. The 5 × 4.5 main body, stage 5 shed, and stage 6 wing fit
the existing collider boxes. The original comparison snapshot is embedded in
the `.blend`; `/tmp/town-original-civic.json` is only the optional build input.

The JSON `material` keys use shared `MAT` instances. Only `roofTiles` has
vertex colors, preserving the coarse clay, timber, and slate palettes in the
existing material batching path. No per-shingle runtime mesh is created.

`geometry-report.json` records mature triangle counts, bounds, and material
keys by family and LOD. `technical-review.json` records mesh validation and
GLB import round trips. `families-review.png` shows all six families together;
the six `<family>-front.png` images show equal-scale front three-quarter views.
