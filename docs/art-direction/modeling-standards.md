# Modeling, export and runtime standards

These are production requirements, not claims that the current assets satisfy them. Verify the audit source hashes before editing a moving workspace.

## Scale and coordinates

- Adopt one Three.js world unit = one Blender meter as a pipeline convention. The current stylized character/door proportions are not physically consistent; this is not permission to rescale the town.
- Runtime is right-handed, Y-up, ground plane XZ. Buildings currently face local +Z. Blender is Z-up with building fronts toward -Y; glTF export performs the axis conversion. Do not rotate an exported GLB a second time.
- Keep each asset's root origin at the center of its ground footprint, ground plane zero. The runtime placement adapter is responsible for terrain elevation. Existing factories use absolute Y values near terrain Y=0.48; compare the old/new world-space bases during integration instead of blindly adding another offset.
- Maintain all plot X/Z positions and stage timing. Cottage core is 3.8×3.5, civic core 5×4.5, castle core 11×10 units. Existing mature additions already extend those boxes; use the per-stage bounds in the geometry census, not only core dimensions.
- Preserve collision envelopes: main half-extents home 2.3×2.15, civic 3×2.75, castle 5.9×5.5, project 4.85×4.35. Porches and stage 5/6 wings have separate boxes. A decorative asset must not silently create an obstacle beyond those proxies.
- Retain wall radii 34/55, 32 segments, gates at every eighth segment, road ring radii 31.5/52, four spokes, water extents, and tree obstacle centers. Account for the walker radius (0.75 default, 0.9 used when choosing a roam spawn).
- Do not turn the castle facade arch into an implied navigable entrance: it currently fronts a solid collider. Changes to actual entrances require coordinated geometry, routing, and collision work.

## Naming, hierarchy, pivots and transforms

Use `ENV_<family>_<variant>_LOD0`, e.g. `ENV_Cottage_A_LOD0`, `ENV_Pine_Tall_B_LOD0`, `ENV_Castle_Tower_A_LOD0`. Child names describe parts: `roof`, `wall_plaster`, `frame`, `foundation`, `door`, `window`, `prop_cluster`.

Hierarchy: a single asset root, named static submeshes, explicit optional stage groups, optional sockets, and separate collision metadata. Keep construction stages independently addressable. Do not include lights, cameras, backdrops, or duplicated hidden authoring meshes in exports.

Static meshes: applied rotation/scale, scale (1,1,1), no negative determinants, no unapplied object transforms except named root placement. Keep intentional child translations only where required by sockets or articulation. Door pivot is at hinge, wheel pivot at axle, mill pivot at hub, hanging sign pivot at bracket. Existing resident part transforms are animation interfaces and must remain stable.

Use explicit variant and stage names in Blender collections. Do not rely on object ordering, selection state, active camera, or auto-generated `.001` names for integration.

## Geometry and shading

- Prefer a single bevel segment on visible timber and stone edges. Apply modifiers in the export copy; preserve an editable source collection. No subdivision surface modifier on broad static boxes.
- Apply triangulation deterministically for export. Remove accidental duplicate surfaces, zero-area faces, loose elements, and internal faces that have no visible or collision purpose. Open surfaces such as a grass blade may be intentional; document them.
- Recalculate outward normals. Hard edges follow material/plane breaks; smooth barrel/tower sidewalls with deliberate rims. Flat-shaded fractured rock and crowns must not become rounded through automatic smoothing.
- Standardize coarse tile size across houses. Near tiles may have a thick lip and one chip; distant roofs use simplified strips or an atlas. No high-frequency geometry invisible at the default camera distance.
- Avoid coplanar overlays. Stone paths sit just above terrain or integrate into it; walls/props penetrate the supporting surface enough to avoid floating edges.

## Materials, textures and UVs

Material names: `MAT_Plaster_Warm`, `MAT_Wood_Dark`, `MAT_Wood_Cut`, `MAT_Roof_Clay`, `MAT_Roof_Slate`, `MAT_Roof_Timber`, `MAT_Stone_Warm`, `MAT_Stone_Cool`, `MAT_Foliage_Shadow`, `MAT_Foliage_Mid`, `MAT_Foliage_Light`, `MAT_Iron`, and restricted project accent materials. Map these to the runtime's shared `MAT` instances; do not clone one material per asset.

Prefer solid PBR colors plus vertex color variation. If a texture materially improves readable surfaces, use a shared atlas, normally 512–1024 px for a family; larger only with a demonstrated close-view need. Base-color textures are sRGB; roughness/normal/data textures are linear. Do not bake studio light or hard ambient occlusion into base color. UVs must have sane density, padded islands, and documented intentional overlaps; no unique UVs required for plain vertex-color-only surfaces.

Current Three.js world-space surface shaders and the wind/water/rain shaders are runtime code, not transferable glTF materials. A Blender asset can use an approximate preview material, but final acceptance requires runtime material mapping. Avoid assuming a Blender material node graph will survive GLB export.

`buildStructures` currently preserves vertex colors only for `MAT.roofTiles` and removes other vertex-color/UV attributes when merging. Imported assets that need UVs or colors require an explicit batching adapter; they cannot be pushed through that collector unchanged. Coordinate this centrally before producing texture-dependent assets.

## Initial triangle budgets

Budgets count export triangles including attached props and roof layers, before GPU shadows. They are ceilings for planning; visual approval and measured performance determine the final allocations.

| Asset | Desktop LOD0 | Mobile / distant |
|---|---:|---:|
| Mature cottage | 3,000–5,000 | 1,200–2,000 |
| Civic shop / tavern / forge | 3,500–6,000 | 1,500–2,500 |
| Complete castle | 15,000–22,000 | 5,000–8,000 |
| Project landmark | 4,000–9,000 | 1,800–4,000 |
| Foreground pine | 180–420 | 70–160 |
| Broadleaf tree | 200–450 | 80–180 |
| Shrub / fern cluster | 40–160 | 20–70 |
| Rock / slab | 24–96 | 12–48 |
| Barrel / crate / fence panel | 80–300 | 24–120 |
| Tower/wall submodule | 250–1,200 | 100–500 |

Aim to reduce the mature resident family below 2,000 triangles per desktop character before adding environment detail. It is supporting work, not license to change behavior. Replace hidden full-size part allocations with an appropriate batching strategy only if actual profiling warrants it.

Prefer shared geometry and instancing for trees, tiles, rocks, fences, lights and props. Merge static geometry by compatible material/attribute layout. Do not create one draw call per shingle, stone block, or leaf. Target mature whole-scene source geometry below roughly 600k desktop / 300k mobile as an initial optimization goal, then validate rendering cost with shadow passes and screen resolution included.

No dynamic LOD system exists today. Deliver a desktop and simplified mobile/distant mesh with matching root, sockets and silhouette; introducing distance switching is a separate integration task. Landmark builders currently ignore the mobile quality tier and must gain equivalent simplification.

## Deliverables and integration

Working source: `art/blender/<family>.blend`. Approved runtime exports: `public/assets/town/<family>/<asset>.glb` (Vite copies `public/` to `dist/`; verify final URLs in the actual build). These locations are proposed; no fictional files are represented as present.

Each delivery includes editable `.blend`, GLB, material mapping, triangle and bounds report, desktop/mobile variants, stage mapping if relevant, and inspection renders. Use glTF 2.0 binary with applied modifiers, normals, UVs/colors as needed. Test a round-trip import before integration. The app currently has no GLTFLoader or asynchronous model-loading path: the integration owner must add loading, caching, disposal, fallback, stage switching, and picking support before substituting exported assets.

Keep a copy of original procedural geometry in the Blender review scene alongside the replacement for scale/bounds comparison. For an approved procedural workflow alternative, retain these same shape and budget rules, and change the factories instead of falsely labeling them Blender-authored.

## Review gates

1. **Silhouette gate:** neutral material, front/side/three-quarter views, current asset alongside reference and replacement; correct footprint and stage envelope.
2. **Technical gate:** measured export triangles, material count, normals, transforms, pivots, deterministic hierarchy, no duplicate geometry, round-trip import and disposal behavior.
3. **Scene gate:** village and civic compositions from `art-direction.md`; test at default and roam cameras, desktop/mobile, clear/night/rain.
4. **Integration gate:** ages 0/7/16/23/30/50, every project link, intact save progression/mergers/gates/water constraints, console clean, `npm run check`, `npm run build`, and release profiling at a fixed viewport/pixel ratio.

An asset becomes APPROVED only after artistic and technical gates pass; INTEGRATED requires the scene/integration gates too. Source inspection alone must never set either status.
