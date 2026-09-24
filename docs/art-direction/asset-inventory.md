# Complete procedural 3D asset inventory

Ratings are based on source and generated geometry, not a completed render review. “Usable” means a reasonable technical starting point; it does not mean approved. Repeated instances are listed separately in the plot manifest at the end. Small repeated parts sharing the same constructor, material role, and use are grouped as a kit, with their constituents named explicitly.

Source abbreviations: **S** = `src/town/scene.ts`; **E** = `src/town/environment.ts`; **L** = `src/town/landmarks.ts`; **R** = `src/town/residents.ts`; **M** = `src/town/materials.ts`. Factory names are the stable source locators; there are no corresponding model files yet.

## Buildings and structural pieces

| ID / asset and source | Current usage / category | Current quality | Target fit | Problems discovered | Action |
|---|---|---|---|---|---|
| B01 Cottage family, S `building(home)` | 29 homes; variants 0–4, stages 1–6 / building | Usable base | Partial | Repeated box masses; front-heavy ornament; insufficient roof pitch/controlled silhouette variety; desktop ~11k triangles per mature house | REDESIGN |
| B02 Castle and keep, S `building(castle)` | Central civic landmark, stages 2–6 / building | Blockout-to-mid | Weak | Tall box keep, shallow caps, thin courses and generic roof/wing additions; references require layered masonry and tall spires | REDESIGN |
| B03 Market / annex, S `building(market)` | Two sites, striped awnings / building | Basic | Partial | Generic civic shell; awnings read as slabs, limited market utility clutter | REDESIGN |
| B04 Tavern / inn, S `building(tavern)` | Two sites / building | Basic | Partial | Same civic shell; little distinctive entrance, sign, or service-yard identity | REDESIGN |
| B05 Forge / workshop, S `building(forge)` | Two stone sites, front block / building | Basic | Partial | Work activity represented by one block; no coherent hearth, anvil, or timber rack kit | REDESIGN |
| B06 Mill, S `building(mill)` | One site with four rotated box blades / building | Basic | Partial | Blades form symmetric crossing bars, weak hub/sail silhouette | REDESIGN |
| B07 Guild, S `building(guild)` | One stone civic site / building | Basic | Partial | Distinction depends mostly on kind/material rather than silhouette | REFINE |
| B08 Post, S `building(post)` | One site with pennant / building | Basic | Partial | Flag is the principal identifier; lacks integrated sign/postal props | REFINE |
| B09 Construction kit, S stages 1–2 | Footing, corner stakes, partial walls, supply box / structural | Usable | Partial | Supply box is undetailed; growth stages need the same modular grammar as mature structures | REFINE |
| B10 Cottage roof kit, S `gableRoof`, `hipRoof`, `tiledRoof`, `roofDetail`, `roofEdges` | Main roofs, wings, dormers and complex roofs / structural | Most developed kit | Good starting point | Large uniform grid; palette seed tied to material; gable end uses roof material; silhouette needs chips and uneven eaves; `roofDetail` assumes a Z ridge even for hip layouts | REFINE |
| B11 Timber facade / gables, S `beam`, `building` | Posts, cross-braces, sills, side rails / structural | Usable | Partial | Some duplicate trim layers; diagonal braces cross openings; not an explicit modular system | REFINE |
| B12 Stone foundation kit, S `stoneFooting`, footing boxes | Building bases / structural | Basic | Partial | Broad flat bands; much of footing sits below town terrain at Y≈0.48; lacks individual courses | REDESIGN |
| B13 Door and window kit, S `cottageWindow`, `building` | Door slab/frame/knob, windows, crossbars, shutters, sills / structural | Usable | Partial | Door height 1.7 versus resident height ~2.4–3 units; opaque facade-mounted recesses; projected trim intersections | REFINE |
| B14 Dormer, S `dormer` | Mature cottages except variant 2 / structural | Usable | Partial | Roof edges are added to parent origin rather than dormer X/Z offset; seating/roof intersection needs review | REFINE |
| B15 Porch and steps, S `porch` | Variant 2 cottage / structural | Basic | Partial | Flat sloping slab roof; very regular steps; must preserve extra porch collider | REFINE |
| B16 Chimney, S `chimney` | Stage ≥5 non-project buildings / structural | Basic | Partial | Plain shaft/cap; lacks broad masonry joints and controlled taper | REFINE |
| B17 Side shed and rear wing, S stages 5–6 | Mature non-project buildings / structural | Basic | Partial | Added to every kind including castle; slab shed roof; global offsets differ from collision approximation | REDESIGN |
| B18 Cottage bay, S variant 0 stage ≥5 | Small side projection / structural | Basic | Partial | Reads as extra box; attached roof integration needs review | REFINE |
| B19 Castle round tower kit, S `tower` | Four castle corner towers / structural | Basic | Weak | 10-sided shaft has shallow 6-sided cap; sparse slit windows and disconnected-looking crenels | REBUILD |
| B20 Castle arch / portcullis, S castle stage ≥4 | Central entrance facade / structural | Usable concept | Partial | Applied dark shape, chevron trim, and bars sit on solid mass; it is not an actual walk-through entrance | REDESIGN |
| B21 Castle parapet, keep cornice / finials, S castle stages 5–6 | Skyline and defensive trim / structural | Basic | Partial | Regular box merlons, no corbel system; finial scale inconsistent with tall spires in reference | REDESIGN |
| B22 Courtyard west/east kit, S `buildStructures` | Two home mergers after 32/48 min / structural | Basic | Partial | Connector beam, low walls, flat path, shrubs and small roof; merger attachments need shared joints | REFINE |
| B23 Market hall, S `buildStructures` | Merger at 35 min / building | Basic | Partial | Large roof uses `MAT.red`, bypassing tiled-roof generation; potential palette and surface discontinuity | REDESIGN |
| B24 Artisan yard, S `buildStructures` | Merger at 39 min / structural | Basic | Partial | Slab canopy, plain rear wall and three supply cubes | REDESIGN |
| B25 Grand inn, S `buildStructures` | Merger at 43 min / building | Basic | Partial | Upper connecting box needs convincing support/roof join and coherent window rhythm | REFINE |

## Project landmarks and attached components

These five landmarks are interactive portfolio entry points. Preserve project identity, selection keys, plot placement, and growth states. They should become local interpretations within the shared material system, not be replaced by unrelated cottages.

| ID / asset and source | Current usage / category | Current quality | Target fit | Problems discovered | Action |
|---|---|---|---|---|---|
| L01 Outpost exchange, L `outpost` | Counter, canopy, lookout platforms, supplies, signals / landmark | Recognizable assembly | Partial | Flat roof and square goods; freestanding poles rather than grounded timber joinery; 11,504 triangles on both desktop/mobile | REDESIGN |
| L02 Sandship dock/factory, L `sandship` | Hull, bow, outriggers, dock rails, cabins, stacks, smoke puffs, turbines, antenna / landmark | Distinct silhouette | Intentional exception | Large iron/copper slabs and cyan surfaces contrast with reference; mobile has no geometry reduction (12,032 triangles) | REFINE |
| L03 Battle Cards arena, L `battle` | Circular dais, rings, giant card, duck archer relief, bow/arrow, poles, seats, trophy / landmark | Distinct concept | Intentional exception | Giant graphic card needs crafted frame and grounded surroundings; crossed rods visually compete with civic skyline | REFINE |
| L04 Wizard tower, L `wizard` | Shaft, ring courses, glowing windows, crystal crown, posts, annex, orbit hoop, stones / landmark | Recognizable | Partial | Crystal crown replaces architectural roof language; flat annex roof; glowing trim is widespread | REDESIGN |
| L05 Dwarven mine, L `dwarves` | Rock portal, timber supports, rails, cart, ore, lamps, gantry and hoist / landmark | Strong concept | Partial | Icosahedral rock cluster rather than fracture slabs; rock extents exceed nominal project collider; shares chunky timber potential | REFINE |
| L06 Landmark platforms, L `base`, arena/wizard cylinders | Rectangular and circular plinths / terrain integration | Basic | Weak | Separate display bases emphasize isolated objects; need soil/stone transitions | REDESIGN |
| L07 Wheels and axle hubs, L `wheel` | Mine cart / utility | Usable | Good starting point | Solid discs; use readable broad hub/rim shape and shared weathered timber/iron | REFINE |
| L08 Hoops, rods, gems and pennants, L helpers | Reused landmark detail primitives / miscellaneous | Functional | Partial | 24-segment torus repeated even when tiny; shared primitive does not establish consistent asset-scale edge treatment | REFINE |

## Roads, terrain, walls and fences

| ID / asset and source | Current usage / category | Current quality | Target fit | Problems discovered | Action |
|---|---|---|---|---|---|
| W01 Four dirt spokes, S `buildRoads` | Main axial routes / road | Functional | Weak | Perfect straight box bands with rounded edges; expensive desktop rounded boxes | REBUILD |
| W02 Inner ring, S `buildRoads` | 40 progressing dirt/stone segments / road | Functional | Weak | Full-width uniform pale stone ribbon; reference uses earth with stone clusters | REBUILD |
| W03 Outer ring, S `buildRoads` | 48 growing dirt segments / road | Functional | Partial | Repeated tangential rectangles; no organic shoulder | REBUILD |
| W04 Plot access lanes, S `buildRoads`, `accessPathFor` | All occupied plots except castle / path | Functional | Partial | Center-to-road strip need not reach the visible +Z door; art must retain current centerline until navigation is coordinated | REDESIGN |
| W05 Path pebbles / cottage stepping stones, S `buildRoads`, `building` | Flattened icosahedra and box slabs / path | Usable concept | Partial | Regular paired spacing and generic round facets; uneven inset slabs needed | REBUILD |
| W06 Civic square, E `buildTerrain` | Radius 7.8 disk / path | Basic | Partial | Perfect disk under castle; no transition or peripheral activity areas | REFINE |
| W07 Timber ring walls, S `wallSectorGeometry`, `buildWalls` | Inner/outer 32-segment systems / wall | Basic | Weak | Continuous curved sheets, occasional posts; no individual palisade rhythm or timber braces | REDESIGN |
| W08 Stone ring walls, S `buildWalls` | Inner wall upgrade / wall | Basic | Partial | Smooth sectors with three merlons each; shader provides horizontal joints but no proper vertical block relief | REDESIGN |
| W09 Ring gate kit, S `buildWalls` | Four potential gates per ring / structural | Basic | Partial | Box posts and lintel; lacks masonry arch or framed timber gate character; opening positions are collision-critical | REDESIGN |
| W10 Cottage fences, S `building` stage ≥5 | Two posts and two horizontal rails beside homes / fence | Basic | Partial | No irregular pickets or fence returns; limited controlled variation | REBUILD |
| E01 Main terrain, E `buildTerrain`, `terrainHeight` | 700×700 heightfield, carved water / terrain | Functional | Partial | Broad smooth plane; needs local ground transitions and cliff integration; desktop grid alone 80,000 triangles | REFINE |
| E02 Mountain ridge, E `buildMountains` | Distant connected ring with passes / terrain | Usable | Partial | Triangular radial bands rather than large fractured layered rock masses; keep lower distant detail | REFINE |
| E03 River surface/banks, E `buildWater` | Curved stream and quad banks / terrain | Usable | Partial | Banks are regular strips; geometric placement must continue matching water collision | REFINE |
| E04 Pond surface/shores, E `buildWater` | Two ponds with radial shores / terrain | Usable | Partial | Circular repetition; natural inset stone/plant clusters needed | REFINE |
| E05 Riverbank stones, E `buildWater` | 52 desktop / 28 mobile / rock | Basic | Partial | Same icosahedron stretched along banks; little fracture vocabulary | REBUILD |
| E06 Forest rocks, E `buildForest` | 95 desktop / 50 mobile / rock | Basic | Weak | Single 20-face form, random scatter; needs slab family and clustered placement | REBUILD |
| E07 Town stones, S `createDecor` | Stones among plants / rock | Basic | Weak | Uniform small scatter; shape duplication across paths and cliff geology | REBUILD |
| E08 Dormant island base, S `createLand` | Uncalled cylinder earth/grass/square/50 flat patches / unused terrain | Obsolete | Weak | Duplicate alternate terrain path; not called by current constructor | REMOVE |

## Vegetation

| ID / asset and source | Current usage / category | Current quality | Target fit | Problems discovered | Action |
|---|---|---|---|---|---|
| V01 Forest pine family, E `buildForest` | Most of 506 desktop / 245 mobile forest trees / tree | Basic | Partial | Three centered 7-sided cone tiers; crown variation mostly scale/color | REBUILD |
| V02 Town pine family, S `createDecor` | Two-thirds of 55 town trees / tree | Basic | Partial | Separate 6-sided construction and palette from forest; should share canonical pine family | REBUILD |
| V03 Forest broadleaf tree, E `buildForest` | Every fifth forest instance / tree | Basic | Supporting only | Two stretched icosahedral crowns; repeated lollipop structure; should remain a minor supporting family | REDESIGN |
| V04 Town broadleaf tree, S `createDecor` | One-third of town trees / tree | Basic | Supporting only | Single round crown, separate system from forest tree | REDESIGN |
| V05 Trunk kit, E/S tree builders | Short tapered cylinders / tree | Basic | Partial | Root contact/branch support weak; preserve obstruction centers/radii while refining above-ground forms | REFINE |
| V06 Town shrubs, S `createDecor` | Low flattened icosahedra / bush | Basic | Partial | Single lobes, uniform scatter, limited corner clusters | REBUILD |
| V07 Cottage/courtyard plants, S `building`, `buildStructures` | Red/green balls, planter earth boxes, renovation additions / plant | Basic | Weak | Red balls ambiguously flowers/produce; recipe repeated along regular rows | REDESIGN |
| V08 Meadow grass, E `buildGrass` | Instanced five-blade tufts, wind shader / plant | Usable | Partial | Dense generic scatter; must support composition and clear paths; recently changed to lit material externally | REFINE |
| V09 Pond reeds, E `buildWater` | Nine four-sided cones per pond / plant | Basic | Weak | Solid spikes rather than grouped reeds | REBUILD |

## Props, furnishings, signs and gameplay-related assets

| ID / asset and source | Current usage / category | Current quality | Target fit | Problems discovered | Action |
|---|---|---|---|---|---|
| P01 Street lanterns, S `createDecor` | 24 posts and emissive cubes / utility | Basic | Weak | Bare luminous blocks; missing framed lantern, cap, arm and mounting logic | REBUILD |
| P02 Awning kit, S `awning` | Cottage doors and market / decorative | Basic | Partial | Solid slabs and paired poles; no edge cut or fabric/wood distinction | REDESIGN |
| P03 Flags / banners, S `flag`, L `pennant` | Buildings, castle and landmarks / sign | Basic | Partial | Short rigid rectangles; castle reference requires elongated hanging banners with shaped lower edge | REDESIGN |
| P04 Crates / supply boxes, S/L block calls | Construction, Outpost, Sandship, artisan yard / utility | Basic | Partial | Mostly plain cubes without board layout, diagonal brace, inset top or banding | REBUILD |
| P05 Goods / counter / work surfaces, L Outpost; S market merger | Counter blocks, goods lumps, market tables / furniture | Basic | Partial | No shared crafted table/counter/produce families | REFINE |
| P06 Forge block, S forge stage ≥4 | Front stone block / utility | Blockout | Weak | No recognizable forge/anvil construction | REBUILD |
| P07 Mine cart / rail kit, L `dwarves` | Cart body, rim, iron rails, timber sleepers / utility | Usable | Good starting point | Flat solid body and independent primitive materials; unify plank thickness, bands, wheels | REFINE |
| P08 Mine gantry / crane, L `dwarves` | Timber uprights, beam, hoist rods and block / utility | Basic | Partial | Rod joints and suspended hook/block need intentional construction | REFINE |
| P09 Ore / crystals, L `gem`, Wizard/Dwarves | Landmark identity props / gameplay-themed | Usable | Intentional exception | Bright accents numerous; retain identity but concentrate glow and match grounding | REFINE |
| P10 Character family, R `Residents` | Up to 24 desktop / 12 mobile; builder, merchant, guard, mage, warrior, resident, artist, miner / animated | Developed primitive assembly | Not defined by references | Heads/eyes dominate detail; 152,016 desktop triangles total including hidden parts; residents taller than door openings | REFINE |
| P11 Character body / costume kit, R `PARTS` | Torso, head, hair, fringe, eye whites/pupils, nose, mouth, ears, collar, belt, buckle, legs, feet, arms, hands, hats, mage hat, apron / animated | Functional | Supporting | 29 instanced part types; nearly-zero hidden instances still cost geometry; preserve animation transforms | REFINE |
| P12 Carried props, R `shield`, `parcel`, `food` | Warrior shield, worker package, eating prop / interactive | Basic | Partial | Box/round placeholders; use consistent wood/metal palette without altering role animation | REFINE |
| P13 Project picking volumes, S `pickBoxes` | Five invisible axis-aligned hit boxes / interaction | Functional | N/A | Fixed 10.6×20×10 envelope; new silhouette must remain clickable and avoid overlap | KEEP |
| P14 Collision shapes, `collision.ts` | Building boxes, wing/porch boxes, wall segments, tree circles, water regions / gameplay | Functional | N/A | Several current decorative bounds exceed collision proxies; review in context before modifying | KEEP |

## Rendering assets and unused helpers

| ID / asset and source | Current usage / category | Current quality | Target fit | Problems discovered | Action |
|---|---|---|---|---|---|
| F01 Shared material library, M `MAT`, `painted` | Matte colors and world-space surface shaders / material | Usable foundation | Partial | Wood grain orientation fixed in world coordinates; stone lacks vertical joints; shader marks cannot export to glTF | REFINE |
| F02 Sky dome, `sky.ts` | Gradient sphere, sun halo / environment | Usable | Good starting point | Artistic approval pending alongside revised lighting | KEEP |
| F03 River/pond shader, E `waterMaterial` | Flow, glints, foam and night value / material | Usable | Supporting | Custom unlit shader; preserve calm readability and bank relationship | KEEP |
| F04 Rain streaks/splash rings, `rain.ts` | Camera-relative weather volume and instanced splashes / VFX | Functional | Supporting | Not represented in references; needs final state review, not redesign priority | KEEP |
| F05 Contact shadow meshes/texture, `contact-shadows.ts` | Two batches, procedural 64×64 mask / lighting support | Newly added externally | Supports target | Added during audit; footprint expansion and opacity require actual render review | REFINE |
| F06 Primitive geometry library, S/L/R shared constants | Rounded boxes, boxes, icosahedra, cones, cylinders, spheres, octahedra / geometry | Functional | Mixed | Rounded boxes dominate small-component cost; no common one-segment bevel policy; mobile landmarks retain desktop geometry | REFINE |

## Missing reusable families

“MISSING” means no recognizable reusable asset exists, even where a plain cube or sphere currently stands in for it. Reference presence establishes relevance, not permission to add new gameplay.

| ID / asset | Proposed use / category | Current quality / fit | Missing requirement | Action |
|---|---|---|---|---|
| N01 Coopered barrel / tub / pot | House edges, market, castle storage / utility | Absent | Bulging staves, dark hoops, inset top; two sizes | MISSING |
| N02 Split log / stacked firewood | Cottage and forge storage / clutter | Absent | Bark sides, pale cut ends, irregular but coherent piles | MISSING |
| N03 Proper crate family | Market and civic storage / utility | Placeholder cubes only | Broad boards, diagonal brace, open and closed variants | MISSING |
| N04 Irregular fence / gate family | Domestic garden boundaries / fence | Basic rail stub only | Pickets, return panels, opening variant and tapered posts | MISSING |
| N05 Fractured cliff / terrace kit | Castle footing, village edges / rock | Distant ridge and round rocks only | Angular slabs and stacked block masses with shared geology | MISSING |
| N06 Masonry course / voussoir / corbel kit | Castle, wall, gate / structural | Bands/boxes only | Reusable bevelled blocks, arch wedge stones, projecting supports | MISSING |
| N07 Tall tiled spire kit | Castle and selected civic towers / structural | Shallow cones only | Steep orange tile courses, eave collar, narrow finial | MISSING |
| N08 Hanging sign / bracket | Tavern, forge, post, market / sign | Flags only | Readable plank silhouette, forged mounting, simple pictogram | MISSING |
| N09 Lantern housing / wall bracket | Street and building entrances / utility | Glowing cubes only | Framed light, dark cap/base, warm small center | MISSING |
| N10 Rock-edge ground transition / fern cluster | Foundations, cliff foot, fences / vegetation | Generic grass/shrub scatter | Deliberate ground-contact clusters, tapered leaves and earth shoulder | MISSING |
| N11 Plank approach / short bridge kit | Optional castle vignette / structural | Absent | Broad plank deck and stone parapet interface; no route changes without integration review | MISSING |
| N12 Cannon / carriage | Optional castle vignette / decorative prop | Absent | Stubby dark barrel, thick wooden wheels, clear non-gameplay use | MISSING |

## Complete placed building manifest

The following manifest is generated from the geometry census; coordinates and stage counts remain authoritative in `town-plan.ts` and `model.ts`. There are 44 sites: 29 homes, five project sites, and ten civic sites (including castle). Mature complex additions retain their children.

| Plot ID | Family | Variant | X / Z | Inspected stages | Stage 6 triangles (desktop) |
|---|---|---:|---|---|---:|
| project-outpost | outpost | 0 | -22 / 7 | 3–6 | 11,504 |
| project-sandship | sandship | 1 | 22 / 9 | 3–6 | 12,032 |
| project-battle | battle | 2 | 8 / -23 | 3–6 | 7,380 |
| project-wizard | wizard | 3 | -8 / 23 | 3–6 | 3,368 |
| home-east-square | home | 4 | 24 / -13 | 1–6 | 11,277 |
| project-dwarves | dwarves | 5 | -25 / -14 | 3–6 | 6,460 |
| castle | castle | 0 | 0 / 0 | 2–6 | 16,630 |
| market | market | 0 | -10 / -7 | 1–6 | 7,244 |
| market-annex | market | 1 | -14 / -8 | 1–6 | 7,196 |
| tavern | tavern | 0 | 14 / 19 | 1–6 | 5,444 |
| inn | tavern | 1 | 18 / 21 | 1–6 | 5,396 |
| forge | forge | 0 | -12 / -23 | 1–6 | 5,744 |
| workshop | forge | 1 | -17 / -24 | 1–6 | 5,696 |
| mill | mill | 0 | 17 / -30 | 1–6 | 6,944 |
| guild | guild | 0 | 10 / 28 | 1–6 | 5,444 |
| post | post | 0 | 10 / -8 | 1–6 | 6,044 |
| home-0 | home | 0 | -16 / 16 | 1–6 | 11,277 |
| home-1 | home | 1 | -17 / -2 | 1–6 | 10,742 |
| home-2 | home | 2 | -14 / 4 | 1–6 | 11,505 |
| home-3 | home | 3 | -5 / -14 | 1–6 | 11,042 |
| home-4 | home | 0 | 1 / -15 | 1–6 | 11,277 |
| home-5 | home | 1 | 15 / -5 | 1–6 | 10,742 |
| home-6 | home | 2 | 15 / 2 | 1–6 | 11,505 |
| home-7 | home | 3 | 15 / 10 | 1–6 | 11,042 |
| home-8 | home | 0 | 2 / 17 | 1–6 | 11,277 |
| home-9 | home | 1 | -18 / -17 | 1–6 | 10,742 |
| home-10 | home | 2 | -42 / 0 | 1–6 | 11,505 |
| home-11 | home | 3 | -40 / 11 | 1–6 | 11,042 |
| home-12 | home | 0 | -39 / -11 | 1–6 | 11,277 |
| home-13 | home | 1 | -34 / 24 | 1–6 | 10,742 |
| home-14 | home | 2 | -33 / -24 | 1–6 | 11,505 |
| home-15 | home | 3 | -27 / 34 | 1–6 | 11,042 |
| home-16 | home | 0 | -24 / -35 | 1–6 | 11,277 |
| home-17 | home | 1 | -13 / 39 | 1–6 | 10,742 |
| home-18 | home | 2 | -11 / -42 | 1–6 | 11,505 |
| home-19 | home | 3 | 1 / 41 | 1–6 | 11,042 |
| home-20 | home | 0 | 3 / -42 | 1–6 | 11,277 |
| home-21 | home | 1 | 15 / 38 | 1–6 | 10,742 |
| home-22 | home | 2 | 15 / -40 | 1–6 | 11,505 |
| home-23 | home | 3 | 28 / 32 | 1–6 | 11,042 |
| home-24 | home | 0 | 28 / -33 | 1–6 | 11,277 |
| home-25 | home | 1 | 39 / 17 | 1–6 | 10,742 |
| home-26 | home | 2 | 40 / -16 | 1–6 | 11,505 |
| home-27 | home | 3 | 43 / 2 | 1–6 | 11,042 |
