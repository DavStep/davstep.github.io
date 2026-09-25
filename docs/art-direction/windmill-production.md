# Windmill redesign — 25 September 2026

The former house with small sails stood at `(17, -30)`, radius 34.48, overlapping the radius-34 inner wall. The replacement stands at `(37, -25)` in the farming area between the inner fortifications and the outer road. Its entire sail sweep and grain stores clear both road and wall rings. The entrance lane approaches from the front, with a connecting farm track to the east-gate spoke when the game has no outer ring road. Scenery scattering reserves this approach.

The Blender source now builds a tapered, faceted masonry tower, pale limewashed upper stories, slate cap with overlapping shingles, framed windows, a fixed shaft bearing, and four large timber-framed linen sails. Attached stores retain the later growth stages. The grain-store roof seats directly on its gable. Construction stages 1–2 use a circular footing, frame and unfinished round wall.

The game rotor uses the same exported meshes as the static mill, translated around the authored socket `(0, 6.45, 2.65)`. Tower batches omit these meshes during animated gameplay. Rotor meshes own their disposable geometry and materials; cleanup cannot dispose shared town resources. Wheat placement follows the relocated site, and ground collision follows the round foundation. Existing stream progression remains intact.

Blender MCP produced desktop/mobile GLBs and synchronous runtime JSON. Desktop: 3,712 triangles. Mobile: 2,144 triangles. Both re-imported GLBs contain zero degenerate triangles. Regression checks cover construction stages, triangle budgets, full rotor rotation, ground and wall clearance, identical static/animated placement, walkable access, game visibility/rotation and material ownership.

Evidence: `art/reviews/civic/mill-front.png`, `mill-mobile.png`, `windmill-technical-review.json`, and `art/reviews/world/windmill-site.png`. These are neutral Blender renders, including exported game geometry for the site view; they are not live browser screenshots.

Validation: `npm run check` passed TypeScript and all 47 tests; `npm run build` passed. Vite reports the existing large-chunk advisory. Other civic families retain identical runtime geometry and palette values.
