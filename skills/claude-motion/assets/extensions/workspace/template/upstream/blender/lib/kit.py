"""Shared helpers to build low-poly props with Blender's Python API (run headless).

Conventions for every prop:
- units are meters, origin at the bottom center of the prop;
- the front of the prop faces Blender -Y, which becomes +Z in glTF / three.js;
- each prop is joined into a single mesh object named after the prop, with shared palette materials.
"""

import math
from collections import defaultdict

import bmesh
import bpy
from mathutils import Euler, Vector

# ---- palette -----------------------------------------------------------------------------------

PALETTE = {
    "wood_light": ("#c9a27e", 0.65, 0.0),
    "wood_mid": ("#a97c56", 0.65, 0.0),
    "wood_dark": ("#6f4e37", 0.6, 0.0),
    "metal_dark": ("#3a3f47", 0.45, 0.6),
    "metal_light": ("#b7bcc4", 0.35, 0.8),
    "chrome": ("#d9dde3", 0.2, 1.0),
    "plastic_black": ("#1f2328", 0.5, 0.0),
    "plastic_gray": ("#6b7280", 0.55, 0.0),
    "plastic_white": ("#eef0f2", 0.45, 0.0),
    "plastic_silver": ("#c3c7cd", 0.45, 0.0),
    "key_dark": ("#2b2f36", 0.6, 0.0),
    "key_mid": ("#4d535d", 0.6, 0.0),
    "screen_black": ("#0b0e13", 0.2, 0.0),
    "fabric_gray": ("#5b6270", 0.95, 0.0),
    "fabric_dark": ("#30343b", 0.95, 0.0),
    "fabric_blue": ("#3d5a80", 0.95, 0.0),
    "fabric_orange": ("#e07a5f", 0.95, 0.0),
    "fabric_green": ("#6a8f6b", 0.95, 0.0),
    "fabric_beige": ("#d8c8ad", 0.95, 0.0),
    "leather_brown": ("#7b4a32", 0.6, 0.0),
    "leaf_green": ("#4f8a4b", 0.8, 0.0),
    "leaf_dark": ("#2f6b3a", 0.8, 0.0),
    "leaf_light": ("#7fb069", 0.8, 0.0),
    "soil": ("#3b2a20", 1.0, 0.0),
    "terracotta": ("#c46a4a", 0.85, 0.0),
    "ceramic_white": ("#e9e6e0", 0.35, 0.0),
    "ceramic_blue": ("#4a78b5", 0.35, 0.0),
    "ceramic_yellow": ("#f2cc8f", 0.35, 0.0),
    "paper": ("#f5f1e6", 0.9, 0.0),
    "cardboard": ("#b68b5e", 0.95, 0.0),
    "glass": ("#bcd7e6", 0.05, 0.0),
    "water": ("#8fc7e8", 0.1, 0.0),
    "red": ("#c0392b", 0.5, 0.0),
    "yellow": ("#f4c542", 0.5, 0.0),
    "green": ("#2e9e5b", 0.5, 0.0),
    "blue": ("#2f6fb5", 0.5, 0.0),
    "book_1": ("#3d5a80", 0.8, 0.0),
    "book_2": ("#e07a5f", 0.8, 0.0),
    "book_3": ("#81b29a", 0.8, 0.0),
    "book_4": ("#f2cc8f", 0.8, 0.0),
    "book_5": ("#9b72cf", 0.8, 0.0),
    "book_6": ("#2f3e46", 0.8, 0.0),
    "light_warm": ("#fff4dc", 0.5, 0.0),
    "coffee": ("#3b2416", 0.2, 0.0),
    "rubber": ("#15171a", 0.9, 0.0),
    "concrete": ("#9a9690", 0.95, 0.0),
    "wall_white": ("#ecebe7", 0.9, 0.0),
    # Outdoors.
    "lamp_glow": ("#fff1c9", 0.5, 0.0),
    "bark": ("#5b4332", 0.95, 0.0),
    "birch_bark": ("#e3ded4", 0.9, 0.0),
    "concrete_light": ("#bdb8ae", 0.95, 0.0),
    "car_red": ("#b8352d", 0.3, 0.2),
    "car_blue": ("#2f5d8a", 0.3, 0.2),
    "car_white": ("#e6e6e1", 0.3, 0.2),
    "headlight": ("#f4f1e6", 0.3, 0.0),
    "tail_light": ("#a3201a", 0.3, 0.0),
    "flower_pink": ("#e87ea1", 0.8, 0.0),
    "flower_purple": ("#8e6cc4", 0.8, 0.0),
    "flower_white": ("#f3efe6", 0.8, 0.0),
}

EMISSIVE = {"light_warm": 4.0}


def hex_to_linear(value):
    value = value.lstrip("#")
    srgb = [int(value[i : i + 2], 16) / 255 for i in (0, 2, 4)]
    return [c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4 for c in srgb] + [1.0]


def material(name):
    """Returns the shared palette material `name`, creating it on first use."""
    existing = bpy.data.materials.get(name)
    if existing:
        return existing
    color, roughness, metallic = PALETTE[name]
    mat = bpy.data.materials.new(name)
    mat.use_nodes = True
    bsdf = mat.node_tree.nodes.get("Principled BSDF")
    bsdf.inputs["Base Color"].default_value = hex_to_linear(color)
    bsdf.inputs["Roughness"].default_value = roughness
    bsdf.inputs["Metallic"].default_value = metallic
    if name == "glass":
        bsdf.inputs["Alpha"].default_value = 0.35
        mat.surface_render_method = "BLENDED"
    if name in EMISSIVE:
        bsdf.inputs["Emission Color"].default_value = hex_to_linear(color)
        bsdf.inputs["Emission Strength"].default_value = EMISSIVE[name]
    return mat


# ---- scene ---------------------------------------------------------------------------------------


def reset_scene():
    bpy.ops.wm.read_factory_settings(use_empty=True)


def _link(obj):
    bpy.context.scene.collection.objects.link(obj)
    return obj


def _finish(obj, mat, bevel, segments, smooth, location, rotation):
    obj.location = Vector(location)
    obj.rotation_euler = Euler([math.radians(a) for a in rotation])
    obj.data.materials.append(material(mat))
    if bevel > 0:
        modifier = obj.modifiers.new("Bevel", "BEVEL")
        modifier.width = bevel
        modifier.segments = segments
        modifier.limit_method = "ANGLE"
        modifier.harden_normals = False
    if smooth:
        obj.data.shade_smooth()
        obj.data.set_sharp_from_angle(angle=math.radians(40))
    else:
        obj.data.shade_flat()
    return obj


def box(size, location=(0, 0, 0), mat="plastic_gray", bevel=0.004, segments=2, rotation=(0, 0, 0), smooth=True):
    """Box of `size` (x, y, z) whose center is at `location`."""
    bpy.ops.mesh.primitive_cube_add(size=1)
    obj = bpy.context.active_object
    obj.scale = Vector(size)
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    return _finish(obj, mat, bevel, segments, smooth, location, rotation)


def polyhedron(vertices, faces, mat="plastic_gray", bevel=0.0, segments=2, smooth=False, name="polyhedron"):
    """Mesh built from explicit `vertices` (x, y, z) and `faces` (vertex index lists), in place."""
    mesh = bpy.data.meshes.new(name)
    mesh.from_pydata([Vector(v) for v in vertices], [], faces)
    mesh.validate()
    obj = _link(bpy.data.objects.new(name, mesh))
    return _finish(obj, mat, bevel, segments, smooth, (0, 0, 0), (0, 0, 0))


def cylinder(radius, depth, location=(0, 0, 0), mat="plastic_gray", vertices=16, bevel=0.0, segments=2,
             rotation=(0, 0, 0), radius_top=None, smooth=True):
    """Cylinder (or cone when `radius_top` differs) along Z, centered at `location`."""
    if radius_top is None:
        bpy.ops.mesh.primitive_cylinder_add(vertices=vertices, radius=radius, depth=depth)
    else:
        bpy.ops.mesh.primitive_cone_add(vertices=vertices, radius1=radius, radius2=radius_top, depth=depth)
    obj = bpy.context.active_object
    return _finish(obj, mat, bevel, segments, smooth, location, rotation)


def vessel(radius, height, location=(0, 0, 0), mat="plastic_gray", vertices=16, radius_top=None, wall=0.006,
           fill=None, rotation=(0, 0, 0)):
    """Open container (cup, pot, bin): a hollow cylinder or cone with a bottom, centered at `location`
    like `cylinder`. `fill=(level, mat)` adds a surface (coffee, soil, bin bag) `level` meters above
    its base. Returns a list of parts.

    A solid cylinder with a disk on top would either hide the disk or z-fight with it."""
    radius_top = radius if radius_top is None else radius_top
    bm = bmesh.new()
    rings = []
    for z, r in ((-height / 2, radius), (height / 2, radius_top)):
        rings.append([bm.verts.new((r * math.cos(i / vertices * math.tau), r * math.sin(i / vertices * math.tau), z))
                      for i in range(vertices)])
    for i in range(vertices):
        j = (i + 1) % vertices
        bm.faces.new((rings[0][i], rings[0][j], rings[1][j], rings[1][i]))
    bm.faces.new(list(reversed(rings[0])))
    mesh = bpy.data.meshes.new("vessel")
    bm.to_mesh(mesh)
    bm.free()
    obj = _link(bpy.data.objects.new("vessel", mesh))
    # Normals point outward: a negative offset grows the wall inward, the rim closes its top.
    solidify = obj.modifiers.new("Solidify", "SOLIDIFY")
    solidify.thickness = wall
    solidify.offset = -1.0
    solidify.use_even_offset = True
    solidify.use_rim = True
    parts = [_finish(obj, mat, 0, 1, True, location, rotation)]
    if fill:
        level, fill_mat = fill
        outer = radius + (radius_top - radius) * level / height
        # The disk edge ends inside the wall, so no gap shows around it.
        offset = Vector((0, 0, level - height / 2))
        offset.rotate(Euler([math.radians(angle) for angle in rotation]))
        parts.append(cylinder(outer - wall / 2, 0.004, Vector(location) + offset, fill_mat, vertices=vertices,
                              rotation=rotation))
    return parts


def sphere(radius, location=(0, 0, 0), mat="plastic_gray", segments=16, rings=10, scale=(1, 1, 1), rotation=(0, 0, 0)):
    bpy.ops.mesh.primitive_uv_sphere_add(segments=segments, ring_count=rings, radius=radius)
    obj = bpy.context.active_object
    obj.scale = Vector(scale)
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    return _finish(obj, mat, 0, 1, True, location, rotation)


def ico(radius, location=(0, 0, 0), mat="leaf_green", subdivisions=1, scale=(1, 1, 1), rotation=(0, 0, 0)):
    """Faceted blob, handy for stylized foliage."""
    bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=subdivisions, radius=radius)
    obj = bpy.context.active_object
    obj.scale = Vector(scale)
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    return _finish(obj, mat, 0, 1, False, location, rotation)


def torus(major, minor, location=(0, 0, 0), mat="ceramic_white", rotation=(0, 0, 0), major_segments=16, minor_segments=8):
    bpy.ops.mesh.primitive_torus_add(major_radius=major, minor_radius=minor, major_segments=major_segments,
                                     minor_segments=minor_segments)
    obj = bpy.context.active_object
    return _finish(obj, mat, 0, 1, True, location, rotation)


def rod(start, end, radius, mat="metal_dark", vertices=10):
    """Cylinder going from point `start` to point `end`."""
    start, end = Vector(start), Vector(end)
    direction = end - start
    bpy.ops.mesh.primitive_cylinder_add(vertices=vertices, radius=radius, depth=direction.length)
    obj = bpy.context.active_object
    obj.rotation_mode = "QUATERNION"
    obj.rotation_quaternion = direction.to_track_quat("Z", "Y")
    obj.location = (start + end) / 2
    obj.data.materials.append(material(mat))
    obj.data.shade_smooth()
    obj.data.set_sharp_from_angle(angle=math.radians(40))
    return obj


def join(objects, name):
    """Applies modifiers, then joins `objects` into one mesh object called `name`."""
    depsgraph = bpy.context.evaluated_depsgraph_get()
    baked = []
    for obj in objects:
        evaluated = obj.evaluated_get(depsgraph)
        mesh = bpy.data.meshes.new_from_object(evaluated)
        new_obj = bpy.data.objects.new(obj.name + "_baked", mesh)
        new_obj.matrix_world = obj.matrix_world.copy()
        _link(new_obj)
        baked.append(new_obj)
    for obj in objects:
        bpy.data.objects.remove(obj, do_unlink=True)
    root = baked[0]
    with bpy.context.temp_override(active_object=root, object=root, selected_objects=baked,
                                   selected_editable_objects=baked):
        bpy.ops.object.join()
    root.name = name
    root.data.name = name
    # Put the origin at the world origin (bottom center by construction) with identity transform.
    with bpy.context.temp_override(active_object=root, object=root, selected_objects=[root],
                                   selected_editable_objects=[root]):
        bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
    return root


def _islands(mesh):
    """Index of the connected part (as built, before joining) of every face of `mesh`."""
    bm = bmesh.new()
    bm.from_mesh(mesh)
    bm.faces.ensure_lookup_table()
    island_of = [-1] * len(bm.faces)
    island = 0
    for start in bm.faces:
        if island_of[start.index] != -1:
            continue
        stack = [start]
        island_of[start.index] = island
        while stack:
            face = stack.pop()
            for edge in face.edges:
                for other in edge.link_faces:
                    if island_of[other.index] == -1:
                        island_of[other.index] = island
                        stack.append(other)
        island += 1
    bm.free()
    return island_of


def _inside(point, polygon):
    """Whether 2D `point` is strictly inside the convex-ish 2D `polygon` (even-odd rule, 1 mm margin)."""
    x, y = point
    inside = False
    for (x0, y0), (x1, y1) in zip(polygon, polygon[1:] + polygon[:1]):
        if (y0 > y) != (y1 > y):
            cross = x0 + (y - y0) * (x1 - x0) / (y1 - y0)
            if cross > x:
                inside = not inside
            if abs(cross - x) < 0.001:
                return False
    return inside


def find_coplanar_overlaps(obj, tolerance=0.0005):
    """Faces of different parts lying in the same plane with the same orientation and overlapping:
    they z-fight (flicker) in the browser. Returns (material, material, height) triples."""
    mesh = obj.data
    island_of = _islands(mesh)
    buckets = defaultdict(list)
    for polygon in mesh.polygons:
        normal = polygon.normal
        distance = normal.dot(polygon.center)
        key = (round(normal.x, 2), round(normal.y, 2), round(normal.z, 2), round(distance / (tolerance * 4)))
        buckets[key].append(polygon)
    names = [slot.material.name if slot.material else "?" for slot in obj.material_slots]
    found = []
    for faces in buckets.values():
        # Undersides resting on the floor are never seen.
        faces = [face for face in faces if not (face.normal.z < -0.99 and face.center.z < 0.001)]
        if len(faces) < 2:
            continue
        axis = max(range(3), key=lambda i: abs(faces[0].normal[i]))
        keep = [i for i in range(3) if i != axis]

        def flat(polygon):
            return [(mesh.vertices[v].co[keep[0]], mesh.vertices[v].co[keep[1]]) for v in polygon.vertices]

        for i, a in enumerate(faces):
            for b in faces[i + 1:]:
                # Two parts of the same color flicker invisibly.
                if island_of[a.index] == island_of[b.index] or a.material_index == b.material_index:
                    continue
                if abs(a.normal.dot(a.center) - b.normal.dot(b.center)) > tolerance:
                    continue
                pa, pb = flat(a), flat(b)
                ca = (a.center[keep[0]], a.center[keep[1]])
                cb = (b.center[keep[0]], b.center[keep[1]])
                if _inside(ca, pb) or _inside(cb, pa) or any(_inside(p, pb) for p in pa) or any(
                        _inside(p, pa) for p in pb):
                    found.append((names[a.material_index], names[b.material_index], round(a.center.z, 4)))
    return sorted(set(found))


def mirror_x(builder, offset):
    """Calls `builder(x)` for x = -offset and +offset; returns both results."""
    return [builder(-offset), builder(offset)]


# ---- material classes ----------------------------------------------------------------------------

# Palette colors are baked into vertex colors and faces are regrouped into a handful of material
# classes, so each prop renders in 1-3 draw calls and can be instanced cheaply in the browser.
# `lamp`: outdoor lights, which the web client only switches on at night.
CLASS_OF = {
    "light_warm": "emissive",
    "lamp_glow": "lamp",
    "glass": "glass",
    "water": "glass",
    "screen_black": "glossy",
}
CLASS_PARAMS = {
    "matte": (0.85, 0.0),
    "glossy": (0.35, 0.0),
    "metal": (0.35, 0.75),
    "emissive": (0.5, 0.0),
    "lamp": (0.5, 0.0),
    "glass": (0.05, 0.0),
}


def material_class(name):
    if name in CLASS_OF:
        return CLASS_OF[name]
    _, roughness, metallic = PALETTE[name]
    if metallic >= 0.5:
        return "metal"
    return "glossy" if roughness < 0.5 else "matte"


def class_material(class_name):
    name = f"class_{class_name}"
    existing = bpy.data.materials.get(name)
    if existing:
        return existing
    roughness, metallic = CLASS_PARAMS[class_name]
    mat = bpy.data.materials.new(name)
    mat.use_nodes = True
    nodes = mat.node_tree.nodes
    bsdf = nodes.get("Principled BSDF")
    bsdf.inputs["Roughness"].default_value = roughness
    bsdf.inputs["Metallic"].default_value = metallic
    # Use the vertex colors as base color, so the glTF exporter writes COLOR_0.
    attribute = nodes.new("ShaderNodeVertexColor")
    attribute.layer_name = "Color"
    mat.node_tree.links.new(attribute.outputs["Color"], bsdf.inputs["Base Color"])
    if class_name in ("emissive", "lamp"):
        mat.node_tree.links.new(attribute.outputs["Color"], bsdf.inputs["Emission Color"])
        bsdf.inputs["Emission Strength"].default_value = 3.0
    if class_name == "glass":
        bsdf.inputs["Alpha"].default_value = 0.35
        mat.surface_render_method = "BLENDED"
    return mat


def bake_palette(obj):
    """Writes each face's palette color into a corner color attribute and swaps palette materials
    for class materials."""
    mesh = obj.data
    palette_names = [slot.material.name if slot.material else "plastic_gray" for slot in obj.material_slots]
    classes = []
    for name in palette_names:
        class_name = material_class(name)
        if class_name not in classes:
            classes.append(class_name)
    color = mesh.color_attributes.new("Color", "FLOAT_COLOR", "CORNER")
    for polygon in mesh.polygons:
        rgba = hex_to_linear(PALETTE[palette_names[polygon.material_index]][0])
        for loop_index in polygon.loop_indices:
            color.data[loop_index].color = rgba
    targets = [classes.index(material_class(palette_names[p.material_index])) for p in mesh.polygons]
    # Clearing the materials resets every face index, so assign the new indices afterwards.
    mesh.materials.clear()
    for class_name in classes:
        mesh.materials.append(class_material(class_name))
    for polygon, target in zip(mesh.polygons, targets):
        polygon.material_index = target
    mesh.color_attributes.active_color = color
    mesh.color_attributes.render_color_index = 0


# ---- export & preview ------------------------------------------------------------------------------


def export_glb(path, objects):
    for obj in objects:
        bake_palette(obj)
    bpy.ops.object.select_all(action="DESELECT")
    for obj in objects:
        obj.select_set(True)
    bpy.ops.export_scene.gltf(filepath=path, export_format="GLB", use_selection=True, export_apply=True,
                              export_yup=True, export_materials="EXPORT", export_animations=False,
                              export_extras=True)


def render_preview(path, objects, resolution=(1600, 1000), spacing=1.2, columns=6):
    """Lays out `objects` in a grid and renders a contact sheet, to review props without the GUI."""
    positions = []
    x = z_row = 0.0
    row_depth = 0.0
    for index, obj in enumerate(objects):
        size = obj.dimensions
        if index % columns == 0 and index:
            z_row -= row_depth + spacing
            x = 0.0
            row_depth = 0.0
        positions.append((obj, obj.location.copy()))
        obj.location = Vector((x + size.x / 2, z_row, 0))
        x += size.x + spacing
        row_depth = max(row_depth, size.y)

    scene = bpy.context.scene
    scene.render.engine = "BLENDER_EEVEE"
    scene.render.resolution_x, scene.render.resolution_y = resolution
    scene.render.film_transparent = False
    world = bpy.data.worlds.new("PreviewWorld")
    world.use_nodes = True
    world.node_tree.nodes["Background"].inputs["Color"].default_value = (0.55, 0.57, 0.6, 1)
    world.node_tree.nodes["Background"].inputs["Strength"].default_value = 0.8
    scene.world = world

    bpy.ops.mesh.primitive_plane_add(size=200, location=(0, 0, 0))
    ground = bpy.context.active_object
    ground.data.materials.append(material("concrete"))

    sun = bpy.data.lights.new("Sun", "SUN")
    sun.energy = 3.5
    sun_obj = bpy.data.objects.new("Sun", sun)
    sun_obj.rotation_euler = Euler((math.radians(50), 0, math.radians(35)))
    _link(sun_obj)

    min_corner = Vector((min(o.location.x - o.dimensions.x / 2 for o in objects),
                         min(o.location.y - o.dimensions.y / 2 for o in objects), 0))
    max_corner = Vector((max(o.location.x + o.dimensions.x / 2 for o in objects),
                         max(o.location.y + o.dimensions.y / 2 for o in objects),
                         max(o.dimensions.z for o in objects)))
    center = (min_corner + max_corner) / 2
    extent = max(max_corner.x - min_corner.x, (max_corner.y - min_corner.y) * 1.6, 2.0)

    camera_data = bpy.data.cameras.new("Camera")
    camera_data.lens = 50
    camera = bpy.data.objects.new("Camera", camera_data)
    _link(camera)
    camera.location = center + Vector((0, -extent * 1.35, extent * 0.85))
    direction = center - camera.location
    camera.rotation_euler = direction.to_track_quat("-Z", "Y").to_euler()
    scene.camera = camera
    scene.render.filepath = path
    bpy.ops.render.render(write_still=True)

    for obj, location in positions:
        obj.location = location
