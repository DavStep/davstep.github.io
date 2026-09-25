# Growing countryside

Five areas outside the moat now develop from the ten choices. They are consequences of town levels, with no separate buttons or saved counters.

| Area | First appearance | Developed | Full activity |
| --- | --- | --- | --- |
| Western woodland | Grove: saplings | Grove 2 + Workshop: trees and forester cottage | Grove 3 + Roads 2: timber stacks and moving wagon |
| Eastern farms | Settlers: plowed fields and fence | River 2: vegetables and farmhouse | Market 2 + Roads 2: golden wheat, second farmhouse and crates |
| Southern orchard | Grove: saplings and fence | Grove 2 + River 2: leafy trees | Grove 3 + Market 2: fruit, harvest barrels and cottage |
| Southern caravan stop | Roads: signposts | Roads 2 + Settlers: inn, bench and connecting lane | Market 2: trading cottage, cargo and moving wagon |
| Western pond fishery | River: landing markers | River 2 + Settlers: shelter and pier | Market 2 + Roads 2: drying net, crates and bobbing boat |

Each later tier also requires the preceding tier. Roads 2 extends dry country lanes from the outer bridge approaches. Existing blockers still govern the town levels used here. The overview widens as countryside areas become active, including on saved-game load.

Runtime geometry uses the existing Blender cottage, tree, prop and wheat assets. New fences, nets, orchard trees, wagons and pier use batched geometry. Ground paths clip to the same terrain triangles as the repaired hill roads. Static forest, rocks, grass and flowers reserve these districts and road corridors. Reduced motion freezes wagon and boat movement; restarting hides the developed areas. Shared asset buffers and materials survive disposal.

Verification: `npm run check`, `npm run build`; desktop/mobile progression, dry lanes, reset, reduced motion and shared-resource tests. Review scenes export actual runtime geometry to Blender using `scripts/export-town-review.mjs --game --outskirts` and `art/blender/review_outskirts.py`. Images in `art/reviews/outskirts/` use neutral review lighting; they are not browser screenshots.
