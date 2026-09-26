"""Civic identity kits: bold, stage-by-stage silhouettes that make each shop
read as what it is from the game camera (a market, a tavern, a forge, a guild,
an office) instead of another cottage with a different roof colour.

The kits are added on top of the authored civic shells (build_civic.py). They
stay inside the tested civic footprint (x +/-3, z +/-2.76, front = +Z) and rise
above the roofline, where the elevated game camera reads them best.

Run in the live Blender session via scripts/blender-mcp-run.py, or headless:
    python -c "import bpy, runpy; runpy.run_path('art/blender/build_civic_identity.py')"
Exports src/town/generated/civic-identity.json (same part format as civic.json)
and saves art/blender/civic-identity.blend.
"""
import json
import math
from pathlib import Path

import bpy
from mathutils import Euler, Matrix, Vector

ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / "src/town/generated/civic-identity.json"
BLEND = ROOT / "art/blender/civic-identity.blend"

bpy.ops.wm.read_factory_settings(use_empty=True)
scene = bpy.context.scene

PREVIEW = {  # sRGB preview colours only; runtime uses the shared MAT palette
    "red": "be7062", "white": "f5f0dd", "gold": "f2ca63", "woodDark": "704a37", "woodLight": "b68458",
    "wood": "946345", "stone": "bab4a4", "stoneDark": "858b84", "iron": "576a72", "copper": "b8775d",
    "lamp": "ffd390", "roofBlue": "5e95ad", "blue": "668db0", "purple": "8d729e", "leaf": "5b995e",
    "roof": "d76b4d", "plaster": "f0d7ac", "emerald": "5aab85", "violet": "664b89", "ink": "34384b", "window": "50433d", "ember": "ff8a3d",
}
materials = {}


def material(key):
    if key not in materials:
        mat = bpy.data.materials.new("MAT_Identity_" + key)
        h = PREVIEW[key]
        mat.diffuse_color = (*(int(h[i:i + 2], 16) / 255 for i in (0, 2, 4)), 1)
        mat["runtime"] = key
        materials[key] = mat
    return materials[key]


# Each authored object carries: family, stage range and runtime material.
objects = []
current = {}


def kit(family, lo, hi=8):
    current.update(family=family, lo=lo, hi=hi)


def to_blender(x, y, z):
    """Three.js (Y up, +Z front) -> Blender (Z up, -Y front)."""
    return (x, -z, y)


def place(obj, key, rot=(0, 0, 0), lods=(0, 1)):
    """Rotations are given around Three.js axes (x, y, z) in radians."""
    rx, ry, rz = rot
    obj.rotation_euler = Euler((rx, -rz, ry), "YZX")
    obj.data.materials.append(material(key))
    obj["family"], obj["lo"], obj["hi"] = current["family"], current["lo"], current["hi"]
    obj["material"], obj["lods"] = key, list(lods)
    objects.append(obj)
    return obj


def box(key, pos, size, rot=(0, 0, 0), bevel=0.0, lods=(0, 1)):
    bpy.ops.mesh.primitive_cube_add(size=1, location=to_blender(*pos))
    obj = bpy.context.object
    sx, sy, sz = size
    obj.scale = (sx, sz, sy)
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    if bevel:
        mod = obj.modifiers.new("soft", "BEVEL"); mod.width = bevel; mod.segments = 2
        bpy.context.view_layer.objects.active = obj; bpy.ops.object.modifier_apply(modifier=mod.name)
    return place(obj, key, rot, lods)


def cylinder(key, pos, radius, height, sides=12, rot=(0, 0, 0), top=None, lods=(0, 1)):
    """Vertical (Three Y) cylinder or cone centred at pos."""
    bpy.ops.mesh.primitive_cone_add(vertices=sides, radius1=radius, radius2=radius if top is None else top,
                                    depth=height, location=to_blender(*pos))
    return place(bpy.context.object, key, rot, lods)


def sphere(key, pos, radius, scale=(1, 1, 1), segments=10, lods=(0, 1)):
    bpy.ops.mesh.primitive_uv_sphere_add(segments=segments, ring_count=max(4, segments // 2), radius=radius, location=to_blender(*pos))
    obj = bpy.context.object
    obj.scale = (scale[0], scale[2], scale[1])
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    return place(obj, key, (0, 0, 0), lods)


def pennant(key, pos, length, height, rot=(0, 0, 0), lods=(0, 1)):
    """A flat triangular flag pointing +X from pos (Three coords)."""
    x, y, z = pos
    verts = [to_blender(0, 0, 0), to_blender(0, height, 0), to_blender(length, height * .5, 0),
             to_blender(0, 0, .05), to_blender(0, height, .05), to_blender(length, height * .5, .05)]
    mesh = bpy.data.meshes.new("pennant")
    mesh.from_pydata(verts, [], [(0, 2, 1), (3, 4, 5), (0, 3, 5, 2), (1, 2, 5, 4), (0, 1, 4, 3)])
    obj = bpy.data.objects.new("pennant", mesh); scene.collection.objects.link(obj)
    obj.location = to_blender(x, y, z)
    return place(obj, key, rot, lods)


def striped_awning(pos, width, depth, drop, stripes, colors=("red", "white"), lods=(0, 1)):
    """A sloped, striped canvas awning with a scalloped valance along the front."""
    x0, y0, z0 = pos
    slope = math.atan2(drop, depth)
    length = math.hypot(depth, drop)
    w = width / stripes
    for i in range(stripes):
        cx = x0 - width / 2 + w * (i + .5)
        key = colors[i % 2]
        box(key, (cx, y0 - drop / 2, z0 + depth / 2), (w * 1.01, .08, length), rot=(slope, 0, 0), lods=lods)
        # scallop: small half-disc below the front edge
        sphere(key, (cx, y0 - drop - .02, z0 + depth - .05), w * .48, scale=(1, .55, .25), segments=8, lods=tuple(l for l in lods if l == 0) or (0,))


def bunting(start, end, sag, count, colors, lods=(0,)):
    """A sagging string of small triangular flags between two Three.js points."""
    a, b = Vector(start), Vector(end)
    for i in range(count):
        t = (i + .5) / count
        p = a.lerp(b, t)
        p.y -= sag * 4 * t * (1 - t)
        heading = math.atan2(-(b.z - a.z), b.x - a.x)
        pennant(colors[i % len(colors)], (p.x, p.y - .35, p.z), .3, .38, rot=(0, heading, -math.pi / 2), lods=lods)
    # the cord
    mid = a.lerp(b, .5); mid.y -= sag
    for seg_a, seg_b in ((a, mid), (mid, b)):
        d = seg_b - seg_a
        c = seg_a.lerp(seg_b, .5)
        yaw = math.atan2(-d.z, d.x)
        pitch = math.atan2(d.y, math.hypot(d.x, d.z))
        box("woodDark", tuple(c), (d.length, .03, .03), rot=(0, yaw, pitch), lods=lods)


def banner_pole(base, height, flag_key, flag_len=1.4, lods=(0, 1)):
    x, y, z = base
    cylinder("woodDark", (x, y + height / 2, z), .07, height, sides=8, lods=lods)
    sphere("gold", (x, y + height + .08, z), .12, segments=8, lods=lods)
    pennant(flag_key, (x + .05, y + height - .75, z), flag_len, .7, lods=lods)


# ---------------------------------------------------------------- MARKET ----
# Striped canopies, bunting and banners: reads as a market from any angle.
kit("market", 3)
striped_awning((0, 2.75, 2.1), 4.8, .6, .62, 8)
box("woodDark", (0, 2.76, 2.12), (4.9, .12, .12))
banner_pole((0, 4.3, 1.9), 2.8, "red", flag_len=1.6)
kit("market", 4)
bunting((0, 4.9, 2.55), (-2.6, 2.7, 2.55), .35, 6, ("red", "gold", "blue", "emerald"))
bunting((0, 4.9, 2.55), (2.6, 2.7, 2.55), .35, 6, ("gold", "red", "emerald", "blue"))
kit("market", 5)
box("gold", (0, 3.55, 2.58), (1.9, .78, .1), bevel=.03)          # gable signboard
box("red", (0, 3.55, 2.64), (1.55, .5, .04))
sphere("red", (-.36, 3.55, 2.66), .17, scale=(1, 1, .5), segments=8)    # apple
sphere("gold", (.3, 3.55, 2.66), .16, scale=(1, 1, .4), segments=8)     # coin
kit("market", 6)
banner_pole((0, 4.3, -1.9), 2.2, "gold", flag_len=1.2)
kit("market", 7)
for i in range(7):
    sphere("lamp", (-2.2 + i * .73, 2.08, 2.62), .1, segments=6, lods=(0,))
kit("market", 8)
striped_awning((0, 6.95, 1.45), 1.3, .5, .35, 4, colors=("gold", "red"), lods=(0,))

# ---------------------------------------------------------------- TAVERN ----
# A big swinging sign, barrels on the roof deck, chimneys and warm lanterns.
kit("tavern", 3)
box("iron", (2.3, 3.1, 2.25), (.08, .08, 1.0))                     # bracket arm
box("iron", (2.3, 2.8, 2.66), (.06, .6, .06))
box("woodDark", (2.3, 2.3, 2.66), (1.05, .9, .1), bevel=.03)       # sign board
box("gold", (2.3, 2.3, 2.72), (.8, .66, .03))
cylinder("woodLight", (2.3, 2.26, 2.72), .17, .06, sides=10, rot=(math.pi / 2, 0, 0))  # mug body (flat)
box("white", (2.3, 2.5, 2.745), (.36, .1, .02))                    # foam
cylinder("stone", (1.3, 5.2, -1.4), .42, 2.2, sides=8)             # chimney
cylinder("stoneDark", (1.3, 6.35, -1.4), .5, .16, sides=8)
kit("tavern", 4)
for dx in (-2.35, -1.75):
    cylinder("wood", (dx, .45, 2.3), .3, .82, sides=10)            # barrels at the door
    for yy in (.2, .7):
        cylinder("iron", (dx, yy, 2.3), .315, .06, sides=10)
kit("tavern", 5)
for dx in (-.95, .95):
    box("iron", (dx, 2.05, 2.55), (.06, .06, .3))
    box("lamp", (dx, 1.9, 2.6), (.2, .3, .2), bevel=.02)
    box("woodDark", (dx, 2.08, 2.6), (.26, .06, .26))
kit("tavern", 6)
banner_pole((-.2, 4.9, .6), 2.2, "gold", flag_len=1.2)
kit("tavern", 7)
bunting((-2.6, 2.75, 2.62), (2.6, 2.75, 2.62), .3, 9, ("lamp",), lods=(0,))
kit("tavern", 8)
cylinder("stone", (-1.2, 5.4, -1.5), .36, 2.0, sides=8, lods=(0,))
cylinder("stoneDark", (-1.2, 6.45, -1.5), .44, .14, sides=8, lods=(0,))

# ----------------------------------------------------------------- FORGE ----
# A towering stone stack with glowing embers and a giant cog: the smithy.
kit("forge", 3)
box("stone", (1.75, 4.2, -1.5), (1.25, 5.6, 1.25), bevel=.05)      # main stack
box("stoneDark", (1.75, 7.1, -1.5), (1.45, .3, 1.45), bevel=.04)
box("ember", (1.75, 7.28, -1.5), (.8, .08, .8))                    # ember glow at the top
box("ember", (1.75, 1.15, 2.58), (1.1, .9, .12))                   # furnace mouth in front
box("stoneDark", (1.75, 1.7, 2.62), (1.4, .22, .16))
kit("forge", 4)
cylinder("iron", (-1.2, 3.35, 2.62), .78, .14, sides=16, rot=(math.pi / 2, 0, 0))  # cog wheel
for i in range(8):
    a = i * math.pi / 4
    box("iron", (-1.2 + math.cos(a) * .86, 3.35 + math.sin(a) * .86, 2.62), (.24, .24, .14), rot=(0, 0, a))
cylinder("copper", (-1.2, 3.35, 2.7), .26, .12, sides=10, rot=(math.pi / 2, 0, 0))
kit("forge", 5)
cylinder("iron", (-1.6, 5.0, -1.6), .28, 3.2, sides=10)            # iron smokestack
cylinder("stoneDark", (-1.6, 6.65, -1.6), .36, .14, sides=10)
kit("forge", 6)
box("ink", (-2.35, .5, 2.3), (.5, .9, .5), bevel=.04)              # anvil on its block
box("iron", (-2.35, 1.03, 2.3), (.7, .18, .3), bevel=.03)
box("iron", (-2.02, 1.03, 2.3), (.2, .1, .18))
kit("forge", 7)
for dx in (-.6, .1):
    box("ember", (dx, 1.5, 2.66), (.42, .5, .05))                   # glowing windows
kit("forge", 8)
banner_pole((1.75, 7.3, -1.5), 1.6, "red", flag_len=1.1, lods=(0,))

# ----------------------------------------------------------------- GUILD ----
# A belfry tower with a bell and a tall spire, heraldic shield and flags.
kit("guild", 3)
box("stone", (0, 4.8, -.4), (1.6, 3.4, 1.6), bevel=.05)            # tower shaft through the roof
box("stoneDark", (0, 6.55, -.4), (1.85, .22, 1.85), bevel=.03)
for dx, dz in ((0, .81), (0, -.81), (.81, 0), (-.81, 0)):
    box("ink", (dx, 7.15, -.4 + dz), (.62 if dz else .06, .8, .06 if dz else .62))   # open arches
sphere("gold", (0, 7.05, -.4), .32, scale=(1, 1.15, 1), segments=8)                 # bell
box("stone", (0, 7.65, -.4), (1.75, .2, 1.75))
cylinder("roofBlue", (0, 8.55, -.4), 1.3, 1.6, sides=4, top=0.02, rot=(0, math.pi / 4, 0))
kit("guild", 4)
box("blue", (0, 3.45, 2.66), (1.0, 1.2, .08), bevel=.04)           # heraldic shield
sphere("blue", (0, 2.9, 2.66), .5, scale=(1, .5, .16), segments=10, lods=(0,))
box("gold", (-.2, 3.3, 2.72), (.14, .7, .03), rot=(0, 0, .6))      # chevron
box("gold", (.2, 3.3, 2.72), (.14, .7, .03), rot=(0, 0, -.6))
sphere("gold", (0, 3.75, 2.72), .12, scale=(1, 1, .25), segments=8)
kit("guild", 5)
for dx, dz in ((-.85, .45), (.85, -1.25)):
    banner_pole((dx, 7.65, dz), 1.4, "blue", flag_len=.9)
kit("guild", 6)
cylinder("white", (0, 6.1, .43), .45, .06, sides=12, rot=(math.pi / 2, 0, 0), lods=(0,))   # clock face
box("ink", (0, 6.2, .47), (.05, .32, .02)); box("ink", (.1, 6.1, .47), (.24, .05, .02))
kit("guild", 7)
cylinder("roofBlue", (0, 9.7, -.4), .5, 1.2, sides=4, top=0.01, rot=(0, math.pi / 4, 0), lods=(0,))
kit("guild", 8)
sphere("gold", (0, 10.4, -.4), .18, segments=8)
pennant("gold", (0.02, 10.1, -.4), .8, .4)

# ------------------------------------------------------------------ POST ----
# Offices: a domed cupola with a lantern, a clock and a big letterbox.
kit("post", 3)
cylinder("plaster", (0, 4.9, -.2), .75, 1.2, sides=12)             # cupola drum
for i in range(6):
    a = i * math.pi / 3
    box("window", (math.cos(a) * .72, 5.0, -.2 + math.sin(a) * .72), (.18, .5, .18))
sphere("roofBlue", (0, 5.55, -.2), .85, scale=(1, .8, 1), segments=12)
cylinder("gold", (0, 6.4, -.2), .08, .6, sides=6)
sphere("gold", (0, 6.75, -.2), .16, segments=8)
kit("post", 4)
box("red", (2.3, .75, 2.4), (.6, 1.1, .5), bevel=.08)              # big red letterbox
box("ink", (2.3, 1.0, 2.66), (.4, .06, .02))
sphere("red", (2.3, 1.3, 2.4), .3, scale=(1, .5, .83), segments=10)
kit("post", 5)
cylinder("white", (0, 3.5, 2.66), .42, .06, sides=16, rot=(math.pi / 2, 0, 0))   # gable clock
cylinder("gold", (0, 3.5, 2.63), .5, .05, sides=16, rot=(math.pi / 2, 0, 0))
box("ink", (0, 3.6, 2.7), (.04, .26, .02)); box("ink", (.08, 3.5, 2.7), (.2, .04, .02))
kit("post", 6)
banner_pole((0, 6.9, -.2), 1.3, "purple", flag_len=.9)
kit("post", 7)
for dx in (-1.1, 1.1):
    box("lamp", (dx, 2.0, 2.6), (.18, .28, .18), bevel=.02, lods=(0,))
kit("post", 8)
sphere("lamp", (0, 6.0, -.2), .22, segments=8)

# ------------------------------------------------------------------- MILL ----
# Grain sacks and a hay bale at the door; the mill silhouette is already strong.
kit("mill", 4)
for i, (dx, dz) in enumerate(((1.7, 1.9), (2.1, 1.5), (1.9, 1.75))):
    sphere("plaster" if i % 2 == 0 else "white", (dx, .35 + (i == 2) * .45, dz), .36, scale=(1, 1.1, .9), segments=10)
cylinder("gold", (-1.9, .4, 1.9), .45, .8, sides=12, rot=(0, 0, math.pi / 2))


# ---------------------------------------------------------------- EXPORT ----
def triangles(obj):
    depsgraph = bpy.context.evaluated_depsgraph_get()
    evaluated = obj.evaluated_get(depsgraph)
    mesh = evaluated.to_mesh()
    mesh.calc_loop_triangles()
    world = obj.matrix_world
    normal_matrix = world.to_3x3().inverted_safe().transposed()
    positions, normals = [], []
    for tri in mesh.loop_triangles:
        face_normal = (normal_matrix @ tri.normal).normalized()
        for loop_index in tri.loops:
            v = world @ mesh.vertices[mesh.loops[loop_index].vertex_index].co
            n = face_normal if not tri.use_smooth else (normal_matrix @ mesh.loops[loop_index].normal).normalized()
            positions.extend((round(v.x, 4), round(v.z, 4), round(-v.y, 4)))
            normals.extend((round(n.x, 4), round(n.z, 4), round(-n.y, 4)))
    evaluated.to_mesh_clear()
    return positions, normals


groups = {}
for obj in objects:
    for lod in obj["lods"]:
        key = (obj["family"], lod, obj["lo"], obj["hi"], obj["material"])
        groups.setdefault(key, [[], []])
        p, n = triangles(obj)
        groups[key][0].extend(p)
        groups[key][1].extend(n)

parts = []
for (family, lod, lo, hi, mat), (positions, normals) in sorted(groups.items()):
    count = len(positions) // 3
    parts.append({
        "name": f"ENV_Civic_{family}_LOD{lod}_kit_stage{lo}_{mat}",
        "family": family, "lod": lod, "minStage": lo, "maxStage": hi, "material": mat,
        "positions": positions, "normals": normals, "indices": list(range(count)),
    })
OUT.write_text(json.dumps({"version": 1, "coordinates": "three-y-up", "parts": parts}, separators=(",", ":")))

report = {}
for part in parts:
    k = f"{part['family']}_LOD{part['lod']}"
    report[k] = report.get(k, 0) + len(part["indices"]) // 3
bpy.ops.wm.save_as_mainfile(filepath=str(BLEND))
print("CIVIC_IDENTITY", json.dumps(report), "parts", len(parts))
