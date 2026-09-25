# Environment production tracker

Snapshot: 24 September 2026. Blender MCP is installed and connected. The cottage pilot is followed by a production batch from three GPT-6 Sol High agents covering castle/props, civic, and nature/landmarks. The parent serialized Blender access, reviewed the assets and integrated the runtime. See [world production evidence](world-production.md).

The cottage batch is wired into the live home factory and passes technical checks. Its formal status remains ART REVIEW until live gameplay views can be visually checked; the Blender art/mesh review and browser error smoke check passed. See [cottage production evidence](cottage-production.md).

Status flow: AUDIT → REFERENCE ANALYSIS → QUEUED → IN PROGRESS → ART REVIEW → TECH REVIEW → REVISION (if needed) → APPROVED → INTEGRATED. KEEP entries still require visual review. Optional assets require an explicit disposition, not automatic production.

Coverage: **92 inventory entries** — KEEP: 5, MISSING: 12, REBUILD: 16, REDESIGN: 24, REFINE: 34, REMOVE: 1.

| Asset | Status | Assigned agent | Current action | Review result | Remaining issues |
|---|---|---|---|---|---|
| B01 Cottage family, `cottages.ts` | ART REVIEW | Parent + GPT-6 Sol High integration | Three families wired into all home plots | Blender review, round-trip, stage/disposal tests passed | Live roam/mobile/night/rain visual approval |
| B02 Castle and keep, S `building(castle)` | ART REVIEW | GPT-6 Sol High castle | Authored LODs and growth stages wired into runtime | Neutral art review, mesh checks and tests pass | Live gameplay visual approval |
| B03 Market / annex, S `building(market)` | ART REVIEW | GPT-6 Sol High civic | Authored LODs and growth stages wired into runtime | Neutral art review, mesh checks and tests pass | Live gameplay visual approval |
| B04 Tavern / inn, S `building(tavern)` | ART REVIEW | GPT-6 Sol High civic | Authored LODs and growth stages wired into runtime | Neutral art review, mesh checks and tests pass | Live gameplay visual approval |
| B05 Forge / workshop, S `building(forge)` | ART REVIEW | GPT-6 Sol High civic | Authored LODs and growth stages wired into runtime | Neutral art review, mesh checks and tests pass | Live gameplay visual approval |
| B06 Mill, S `building(mill)` | INTEGRATED | Parent | Rebuilt tower windmill, shared animated sails, relocated outside inner wall | [Windmill model/site review and regression checks](windmill-production.md) | Live browser visual review not captured |
| B07 Guild, S `building(guild)` | ART REVIEW | GPT-6 Sol High civic | Authored LODs and growth stages wired into runtime | Neutral art review, mesh checks and tests pass | Live gameplay visual approval |
| B08 Post, S `building(post)` | ART REVIEW | GPT-6 Sol High civic | Authored LODs and growth stages wired into runtime | Neutral art review, mesh checks and tests pass | Live gameplay visual approval |
| B08a Archive hero / Great Library | INTEGRATED | Parent | Dedicated reading hall, stepped gables, book crest, scriptorium and map room | [Archive production evidence](archive-production.md) | Live browser screenshot not captured |
| B09 Construction kit, S stages 1–2 | ART REVIEW | Parent / cottage batch | Cottage/civic components authored and wired | Blender technical + visual review passed | Live gameplay visual approval |
| B10 Cottage roof kit, S `gableRoof`, `hipRoof`, `tiledRoof`, `roofDetail`, `roofEdges` | ART REVIEW | Parent / cottage batch | Cottage/civic components authored and wired | Blender technical + visual review passed | Live gameplay visual approval |
| B11 Timber facade / gables, S `beam`, `building` | ART REVIEW | Parent / cottage batch | Cottage/civic components authored and wired | Blender technical + visual review passed | Live gameplay visual approval |
| B12 Stone foundation kit, S `stoneFooting`, footing boxes | ART REVIEW | Parent / cottage batch | Cottage/civic components authored and wired | Blender technical + visual review passed | Live gameplay visual approval |
| B13 Door and window kit, S `cottageWindow`, `building` | ART REVIEW | Parent / cottage batch | Cottage/civic components authored and wired | Blender technical + visual review passed | Live gameplay visual approval |
| B14 Dormer, S `dormer` | ART REVIEW | Parent | Replaced by gable opening / grounded wing in cottages | Broken floating component retired from home factory | Live scene visual approval |
| B15 Porch and steps, S `porch` | ART REVIEW | Parent / cottage batch | Cottage/civic components authored and wired | Blender technical + visual review passed | Live gameplay visual approval |
| B16 Chimney, S `chimney` | ART REVIEW | Parent / cottage batch | Cottage/civic components authored and wired | Blender technical + visual review passed | Live gameplay visual approval |
| B17 Side shed and rear wing, S stages 5–6 | ART REVIEW | Parent / cottage batch | Cottage/civic components authored and wired | Blender technical + visual review passed | Live gameplay visual approval |
| B18 Cottage bay, S variant 0 stage ≥5 | ART REVIEW | Parent | Replaced by gable opening / grounded wing in cottages | Broken floating component retired from home factory | Live scene visual approval |
| B19 Castle round tower kit, S `tower` | ART REVIEW | GPT-6 Sol High castle | Authored LODs and growth stages wired into runtime | Neutral art review, mesh checks and tests pass | Live gameplay visual approval |
| B20 Castle arch / portcullis, S castle stage ≥4 | ART REVIEW | GPT-6 Sol High castle | Authored LODs and growth stages wired into runtime | Neutral art review, mesh checks and tests pass | Live gameplay visual approval |
| B21 Castle parapet, keep cornice / finials, S castle stages 5–6 | ART REVIEW | GPT-6 Sol High castle | Authored LODs and growth stages wired into runtime | Neutral art review, mesh checks and tests pass | Live gameplay visual approval |
| B22 Courtyard west/east kit, S `buildStructures` | QUEUED | Proposed A | REFINE queued | Source audit only; not approved | Resolve inventory findings; art + technical gates pending |
| B23 Market hall, S `buildStructures` | QUEUED | Proposed A | REDESIGN queued | Source audit only; not approved | Resolve inventory findings; art + technical gates pending |
| B24 Artisan yard, S `buildStructures` | QUEUED | Proposed A | REDESIGN queued | Source audit only; not approved | Resolve inventory findings; art + technical gates pending |
| B25 Grand inn, S `buildStructures` | QUEUED | Proposed A | REFINE queued | Source audit only; not approved | Resolve inventory findings; art + technical gates pending |
| L01 Outpost exchange, L `outpost` | ART REVIEW | Parent / hero landmark pass | Purpose-built designs integrated across stages 3–6 | Ten GLBs round-trip; art, envelope, picker and mesh checks pass | Live camera/mobile/night/rain visual approval |
| L02 Sandship dock/factory, L `sandship` | ART REVIEW | Parent / hero landmark pass | Purpose-built designs integrated across stages 3–6 | Ten GLBs round-trip; art, envelope, picker and mesh checks pass | Live camera/mobile/night/rain visual approval |
| L03 Battle Cards arena, L `battle` | ART REVIEW | Parent / hero landmark pass | Purpose-built designs integrated across stages 3–6 | Ten GLBs round-trip; art, envelope, picker and mesh checks pass | Live camera/mobile/night/rain visual approval |
| L04 Wizard tower, L `wizard` | ART REVIEW | Parent / hero landmark pass | Purpose-built designs integrated across stages 3–6 | Ten GLBs round-trip; art, envelope, picker and mesh checks pass | Live camera/mobile/night/rain visual approval |
| L05 Dwarven mine, L `dwarves` | ART REVIEW | Parent / hero landmark pass | Purpose-built designs integrated across stages 3–6 | Ten GLBs round-trip; art, envelope, picker and mesh checks pass | Live camera/mobile/night/rain visual approval |
| L06 Landmark platforms, L `base`, arena/wizard cylinders | ART REVIEW | Parent / hero landmark pass | Purpose-built designs integrated across stages 3–6 | Ten GLBs round-trip; art, envelope, picker and mesh checks pass | Live camera/mobile/night/rain visual approval |
| L07 Wheels and axle hubs, L `wheel` | ART REVIEW | Parent / hero landmark pass | Purpose-built designs integrated across stages 3–6 | Ten GLBs round-trip; art, envelope, picker and mesh checks pass | Live camera/mobile/night/rain visual approval |
| L08 Hoops, rods, gems and pennants, L helpers | ART REVIEW | Parent / hero landmark pass | Purpose-built designs integrated across stages 3–6 | Ten GLBs round-trip; art, envelope, picker and mesh checks pass | Live camera/mobile/night/rain visual approval |
| W01 Four dirt spokes, S `buildRoads` | ART REVIEW | Parent + castle/props agent | Authored props and ground-following routes integrated | Mesh review and runtime tests pass | Live scene visual approval; separate gate redesign remains |
| W02 Inner ring, S `buildRoads` | ART REVIEW | Parent + castle/props agent | Authored props and ground-following routes integrated | Mesh review and runtime tests pass | Live scene visual approval; separate gate redesign remains |
| W03 Outer ring, S `buildRoads` | ART REVIEW | Parent + castle/props agent | Authored props and ground-following routes integrated | Mesh review and runtime tests pass | Live scene visual approval; separate gate redesign remains |
| W04 Plot access lanes, S `buildRoads`, `accessPathFor` | ART REVIEW | Parent + castle/props agent | Authored props and ground-following routes integrated | Mesh review and runtime tests pass | Live scene visual approval; separate gate redesign remains |
| W05 Path pebbles / cottage stepping stones, S `buildRoads`, `building` | ART REVIEW | Parent + castle/props agent | Authored props and ground-following routes integrated | Mesh review and runtime tests pass | Live scene visual approval; separate gate redesign remains |
| W06 Civic square, E `buildTerrain` | QUEUED | Proposed C / parent integration | REFINE queued | Source audit only; not approved | Resolve inventory findings; art + technical gates pending |
| W07 Timber ring walls, S `wallSectorGeometry`, `buildWalls` | ART REVIEW | Parent + castle/props agent | Authored props and ground-following routes integrated | Mesh review and runtime tests pass | Live scene visual approval; separate gate redesign remains |
| W08 Stone ring walls, S `buildWalls` | IN PROGRESS | Parent | Authored shallow masonry facing added | Source integration complete | Full wall/gate silhouette redesign and live review remain |
| W09 Ring gate kit, S `buildWalls` | QUEUED | Proposed C / parent integration | REDESIGN queued | Source audit only; not approved | Resolve inventory findings; art + technical gates pending |
| W10 Cottage fences, S `building` stage ≥5 | ART REVIEW | Parent + castle/props agent | Authored props and ground-following routes integrated | Mesh review and runtime tests pass | Live scene visual approval; separate gate redesign remains |
| E01 Main terrain, E `buildTerrain`, `terrainHeight` | QUEUED | Proposed C / parent integration | REFINE queued | Source audit only; not approved | Resolve inventory findings; art + technical gates pending |
| E02 Mountain ridge, E `buildMountains` | QUEUED | Proposed C / parent integration | REFINE queued | Source audit only; not approved | Resolve inventory findings; art + technical gates pending |
| E03 River surface/banks, E `buildWater` | QUEUED | Proposed C / parent integration | REFINE queued | Source audit only; not approved | Resolve inventory findings; art + technical gates pending |
| E04 Pond surface/shores, E `buildWater` | QUEUED | Proposed C / parent integration | REFINE queued | Source audit only; not approved | Resolve inventory findings; art + technical gates pending |
| E05 Riverbank stones, E `buildWater` | ART REVIEW | GPT-6 Sol High nature + parent | Authored nature library instanced at existing sites | Neutral art review and runtime tests pass | Live visual approval; broadleaf slots intentionally use firs |
| E06 Forest rocks, E `buildForest` | ART REVIEW | GPT-6 Sol High nature + parent | Authored nature library instanced at existing sites | Neutral art review and runtime tests pass | Live visual approval; broadleaf slots intentionally use firs |
| E07 Town stones, S `createDecor` | ART REVIEW | GPT-6 Sol High nature + parent | Authored nature library instanced at existing sites | Neutral art review and runtime tests pass | Live visual approval; broadleaf slots intentionally use firs |
| E08 Dormant island base, S `createLand` | QUEUED | Proposed C / parent integration | Removal queued, not executed | Source audit only; not approved | Reconfirm no callers before removal |
| V01 Forest pine family, E `buildForest` | ART REVIEW | GPT-6 Sol High nature + parent | Authored nature library instanced at existing sites | Neutral art review and runtime tests pass | Live visual approval; broadleaf slots intentionally use firs |
| V02 Town pine family, S `createDecor` | ART REVIEW | GPT-6 Sol High nature + parent | Authored nature library instanced at existing sites | Neutral art review and runtime tests pass | Live visual approval; broadleaf slots intentionally use firs |
| V03 Forest broadleaf tree, E `buildForest` | ART REVIEW | GPT-6 Sol High nature + parent | Authored nature library instanced at existing sites | Neutral art review and runtime tests pass | Live visual approval; broadleaf slots intentionally use firs |
| V04 Town broadleaf tree, S `createDecor` | ART REVIEW | GPT-6 Sol High nature + parent | Authored nature library instanced at existing sites | Neutral art review and runtime tests pass | Live visual approval; broadleaf slots intentionally use firs |
| V05 Trunk kit, E/S tree builders | ART REVIEW | GPT-6 Sol High nature + parent | Authored nature library instanced at existing sites | Neutral art review and runtime tests pass | Live visual approval; broadleaf slots intentionally use firs |
| V06 Town shrubs, S `createDecor` | ART REVIEW | GPT-6 Sol High nature + parent | Authored nature library instanced at existing sites | Neutral art review and runtime tests pass | Live visual approval; broadleaf slots intentionally use firs |
| V07 Cottage/courtyard plants, S `building`, `buildStructures` | QUEUED | Proposed B | REDESIGN queued | Source audit only; not approved | Resolve inventory findings; art + technical gates pending |
| V08 Meadow grass, E `buildGrass` | QUEUED | Proposed B | REFINE queued | Source audit only; not approved | Resolve inventory findings; art + technical gates pending |
| V09 Pond reeds, E `buildWater` | QUEUED | Proposed B | REBUILD queued | Source audit only; not approved | Resolve inventory findings; art + technical gates pending |
| P01 Street lanterns, S `createDecor` | ART REVIEW | Parent + castle/props agent | Authored props and ground-following routes integrated | Mesh review and runtime tests pass | Live scene visual approval; separate gate redesign remains |
| P02 Awning kit, S `awning` | IN PROGRESS | Parent + family production agents | Included in relevant family; independent kit coverage partial | Family checks pass | Finish uncovered variants and live review |
| P03 Flags / banners, S `flag`, L `pennant` | IN PROGRESS | Parent + family production agents | Included in relevant family; independent kit coverage partial | Family checks pass | Finish uncovered variants and live review |
| P04 Crates / supply boxes, S/L block calls | IN PROGRESS | Parent + family production agents | Included in relevant family; independent kit coverage partial | Family checks pass | Finish uncovered variants and live review |
| P05 Goods / counter / work surfaces, L Outpost; S market merger | QUEUED | Parent / later bounded batch | REFINE queued | Source audit only; not approved | Resolve inventory findings; art + technical gates pending |
| P06 Forge block, S forge stage ≥4 | IN PROGRESS | Parent + family production agents | Included in relevant family; independent kit coverage partial | Family checks pass | Finish uncovered variants and live review |
| P07 Mine cart / rail kit, L `dwarves` | IN PROGRESS | Parent + family production agents | Included in relevant family; independent kit coverage partial | Family checks pass | Finish uncovered variants and live review |
| P08 Mine gantry / crane, L `dwarves` | IN PROGRESS | Parent + family production agents | Included in relevant family; independent kit coverage partial | Family checks pass | Finish uncovered variants and live review |
| P09 Ore / crystals, L `gem`, Wizard/Dwarves | IN PROGRESS | Parent + family production agents | Included in relevant family; independent kit coverage partial | Family checks pass | Finish uncovered variants and live review |
| P10 Character family, R `Residents` | QUEUED | Parent / later bounded batch | REFINE queued | Source audit only; not approved | Resolve inventory findings; art + technical gates pending |
| P11 Character body / costume kit, R `PARTS` | QUEUED | Parent / later bounded batch | REFINE queued | Source audit only; not approved | Resolve inventory findings; art + technical gates pending |
| P12 Carried props, R `shield`, `parcel`, `food` | QUEUED | Parent / later bounded batch | REFINE queued | Source audit only; not approved | Resolve inventory findings; art + technical gates pending |
| P13 Project picking volumes, S `pickBoxes` | QUEUED | Parent / later bounded batch | Retain; schedule review | Source audit only; not approved | Visual/state review still required |
| P14 Collision shapes, `collision.ts` | QUEUED | Parent / later bounded batch | Retain; schedule review | Source audit only; not approved | Visual/state review still required |
| F01 Shared material library, M `MAT`, `painted` | QUEUED | Parent / later bounded batch | REFINE queued | Source audit only; not approved | Resolve inventory findings; art + technical gates pending |
| F02 Sky dome, `sky.ts` | QUEUED | Parent / later bounded batch | Retain; schedule review | Source audit only; not approved | Visual/state review still required |
| F03 River/pond shader, E `waterMaterial` | QUEUED | Parent / later bounded batch | Retain; schedule review | Source audit only; not approved | Visual/state review still required |
| F04 Rain streaks/splash rings, `rain.ts` | QUEUED | Parent / later bounded batch | Retain; schedule review | Source audit only; not approved | Visual/state review still required |
| F05 Contact shadow meshes/texture, `contact-shadows.ts` | QUEUED | Parent / later bounded batch | REFINE queued | Source audit only; not approved | Resolve inventory findings; art + technical gates pending |
| F06 Primitive geometry library, S/L/R shared constants | QUEUED | Parent / later bounded batch | REFINE queued | Source audit only; not approved | Resolve inventory findings; art + technical gates pending |
| N01 Coopered barrel / tub / pot | ART REVIEW | Parent + castle/props agent | Authored props and ground-following routes integrated | Mesh review and runtime tests pass | Live scene visual approval; separate gate redesign remains |
| N02 Split log / stacked firewood | ART REVIEW | Parent + castle/props agent | Authored props and ground-following routes integrated | Mesh review and runtime tests pass | Live scene visual approval; separate gate redesign remains |
| N03 Proper crate family | ART REVIEW | Parent + castle/props agent | Authored props and ground-following routes integrated | Mesh review and runtime tests pass | Live scene visual approval; separate gate redesign remains |
| N04 Irregular fence / gate family | ART REVIEW | Parent + castle/props agent | Authored props and ground-following routes integrated | Mesh review and runtime tests pass | Live scene visual approval; separate gate redesign remains |
| N05 Fractured cliff / terrace kit | QUEUED | Proposed C / parent integration | MISSING queued | Source audit only; not approved | Create canonical family after pilot approval |
| N06 Masonry course / voussoir / corbel kit | ART REVIEW | GPT-6 Sol High castle | Authored LODs and growth stages wired into runtime | Neutral art review, mesh checks and tests pass | Live gameplay visual approval |
| N07 Tall tiled spire kit | ART REVIEW | GPT-6 Sol High castle | Authored LODs and growth stages wired into runtime | Neutral art review, mesh checks and tests pass | Live gameplay visual approval |
| N08 Hanging sign / bracket | IN PROGRESS | Parent + family production agents | Included in relevant family; independent kit coverage partial | Family checks pass | Finish uncovered variants and live review |
| N09 Lantern housing / wall bracket | IN PROGRESS | Parent + family production agents | Included in relevant family; independent kit coverage partial | Family checks pass | Finish uncovered variants and live review |
| N10 Rock-edge ground transition / fern cluster | QUEUED | Proposed B | MISSING queued | Source audit only; not approved | Create canonical family after pilot approval |
| N11 Plank approach / short bridge kit | QUEUED | Proposed C / parent integration | MISSING queued | Source audit only; not approved | Optional; decide need after civic scene review |
| N12 Cannon / carriage | QUEUED | Proposed C / parent integration | MISSING queued | Source audit only; not approved | Optional; decide need after civic scene review |

## Completed pre-production work

- Complete source-family and 44-site inventory, including unused terrain and newly added contact shadows.
- Reference analysis, palette/shape rules, pipeline standards, priorities and bounded agent briefs.
- Desktop/mobile executable geometry census with source hashes.
- Existing TypeScript and 12 tests pass.

## Open review work

- Neutral Blender family reviews and technical checks are complete for the delivered batch; combined runtime geometry renders are in `art/reviews/world/`.
- TypeScript, 31 tests and production build pass. Desktop/mobile production censuses are saved separately from the baseline.
- Live desktop/mobile roam, night/rain and performance review remains open: browser screenshots failed and later browser-control calls timed out.
- Complete the still-queued merged complexes, terrain and shoreline detail, grass/reeds and character families.
- Validate concurrent atmosphere/contact-shadow work against the final assets and optimize the combined asset bundle.

## Regular-building development pass

Homes and regular civic families now have eight authored development states, with growing district buildings and derived progression. See [development evidence](building-development.md).
