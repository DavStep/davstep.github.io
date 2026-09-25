# Archive redesign — 25 September 2026

The archive previously reused the ordinary post-office house. It now has a dedicated `archive` mesh family: a tall masonry reading hall, stepped stone gables, overlapping slate roof tiles, large pointed windows, blue-and-gold banners, an oversized open-book crest and visible shelves of bound volumes. Later growth adds a scriptorium and map room whose roofs sit directly on closed gables.

`civicFamilyFor` selects this geometry for the original `post` plot (the Archive hero) and the final `district-archive-great-library` expansion. Ordinary trade, design and route offices retain the original `post` family. Plot IDs, sites, stages, construction timing, saved progression and ground-collision footprints are preserved. The game's place label now reads Grand Archive.

The source is `art/blender/build_civic.py`; Blender MCP generates the shared civic library, dedicated desktop/mobile Archive GLBs and the synchronous runtime JSON. Mobile retains the front silhouette and book crest while reducing side-window, shelf and rear-parapet details. Random palette state is isolated so the additional family does not recolor existing buildings. Runtime part names are derived from stable metadata rather than Blender's temporary duplicate-name suffixes.

Review artifacts: `archive-front.png`, `archive-mobile.png`, `archive-technical-review.json` and `archive-campus.png` under `art/reviews/civic/`. The first two re-import exported GLBs. The campus view uses actual exported game geometry with neutral Blender lighting. These are Blender review renders, not live browser screenshots.

Validation: TypeScript and all **95 tests pass**, including first-choice Archive visibility, distinct model selection, office-model preservation, all six construction stages, collision envelopes and triangle budgets. The production build passes with its existing large-chunk advisory. Desktop has **5,380 triangles**; mobile has **2,244**. Both GLBs re-import without degenerate triangles. Existing civic families retain byte-identical runtime part data and their previous GLB exports.
