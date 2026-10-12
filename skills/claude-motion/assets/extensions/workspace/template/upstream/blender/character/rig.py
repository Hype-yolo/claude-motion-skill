"""Armature, skinned low-poly body and posing helpers for the office characters.

The character stands 1.76 m tall, faces Blender -Y (glTF +Z), origin between the feet. Every body
part is a rigid piece weighted 100 % to one bone, with ball joints hiding the seams (toy-like,
stylized look). Poses are set by aiming bones at world-space directions, with an analytic
two-bone IK for arms and legs, so animations can target real positions (keyboard, face, chair).
"""

import math

import bpy
from mathutils import Matrix, Quaternion, Vector

from lib.kit import cylinder, material, rod, sphere, box

# name: (head, tail, parent)
BONES = {
    "root": ((0, 0, 0), (0, 0, 0.2), None),
    "hips": ((0, 0, 0.94), (0, 0, 1.06), "root"),
    "spine": ((0, 0, 1.06), (0, 0, 1.26), "hips"),
    "chest": ((0, 0, 1.26), (0, 0, 1.47), "spine"),
    "neck": ((0, 0, 1.47), (0, 0, 1.55), "chest"),
    "head": ((0, 0, 1.55), (0, 0, 1.82), "neck"),
}
for side, sign in (("L", 1), ("R", -1)):
    BONES[f"upper_arm.{side}"] = ((0.2 * sign, 0.0, 1.43), (0.235 * sign, 0.0, 1.16), "chest")
    BONES[f"forearm.{side}"] = ((0.235 * sign, 0.0, 1.16), (0.255 * sign, -0.01, 0.91), f"upper_arm.{side}")
    BONES[f"hand.{side}"] = ((0.255 * sign, -0.01, 0.91), (0.26 * sign, -0.015, 0.8), f"forearm.{side}")
    BONES[f"thigh.{side}"] = ((0.1 * sign, 0.0, 0.92), (0.1 * sign, 0.0, 0.5), "hips")
    BONES[f"shin.{side}"] = ((0.1 * sign, 0.0, 0.5), (0.1 * sign, 0.0, 0.09), f"thigh.{side}")
    BONES[f"foot.{side}"] = ((0.1 * sign, 0.0, 0.09), (0.1 * sign, -0.14, 0.03), f"shin.{side}")

CHARACTER_MATERIALS = {
    "skin": "#e0ac85",
    "hair": "#3b2a20",
    "shirt": "#3d85c6",
    "pants": "#2f3e46",
    "shoes": "#1f2328",
    "eyes": "#15171a",
    "lips": "#b5655a",
    "cup": "#ece8e1",
    "coffee": "#3b2416",
}


def char_material(name):
    existing = bpy.data.materials.get(name)
    if existing:
        return existing
    mat = bpy.data.materials.new(name)
    mat.use_nodes = True
    bsdf = mat.node_tree.nodes.get("Principled BSDF")
    from lib.kit import hex_to_linear

    bsdf.inputs["Base Color"].default_value = hex_to_linear(CHARACTER_MATERIALS[name])
    bsdf.inputs["Roughness"].default_value = 0.35 if name == "eyes" else 0.75
    return mat


def build_armature():
    data = bpy.data.armatures.new("CharacterRig")
    arm = bpy.data.objects.new("CharacterRig", data)
    bpy.context.scene.collection.objects.link(arm)
    bpy.context.view_layer.objects.active = arm
    bpy.ops.object.mode_set(mode="EDIT")
    for name, (head, tail, parent) in BONES.items():
        bone = data.edit_bones.new(name)
        bone.head = Vector(head)
        bone.tail = Vector(tail)
        bone.roll = 0
        if parent:
            bone.parent = data.edit_bones[parent]
            bone.use_connect = False
    bpy.ops.object.mode_set(mode="OBJECT")
    return arm


def _skin(obj, bone, mat):
    """Assigns a part to a bone (vertex group) and a character material."""
    obj.data.materials.clear()
    obj.data.materials.append(char_material(mat))
    group = obj.vertex_groups.new(name=bone)
    group.add(list(range(len(obj.data.vertices))), 1.0, "REPLACE")
    return obj


def _join(parts, name, arm):
    depsgraph = bpy.context.evaluated_depsgraph_get()
    baked = []
    for obj in parts:
        evaluated = obj.evaluated_get(depsgraph)
        mesh = bpy.data.meshes.new_from_object(evaluated, preserve_all_data_layers=True, depsgraph=depsgraph)
        new = bpy.data.objects.new(obj.name + "_b", mesh)
        new.matrix_world = obj.matrix_world.copy()
        for group in obj.vertex_groups:
            new.vertex_groups.new(name=group.name)
        bpy.context.scene.collection.objects.link(new)
        # new_from_object keeps the deform weights; recreating the groups in the same order maps them back.
        baked.append(new)
    for obj in parts:
        bpy.data.objects.remove(obj, do_unlink=True)
    root = baked[0]
    with bpy.context.temp_override(active_object=root, object=root, selected_objects=baked,
                                   selected_editable_objects=baked):
        bpy.ops.object.join()
    root.name = name
    root.data.name = name
    with bpy.context.temp_override(active_object=root, object=root, selected_objects=[root],
                                   selected_editable_objects=[root]):
        bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
    root.parent = arm
    modifier = root.modifiers.new("Armature", "ARMATURE")
    modifier.object = arm
    return root


def _limb(bone, radius_a, radius_b, mat, vertices=10):
    """Tapered cylinder along a bone: `radius_a` at its head, `radius_b` at its tail."""
    head, tail, _ = BONES[bone]
    part = rod(head, tail, radius_a, "plastic_gray", vertices=vertices)
    # rod() builds the cylinder along its local Z axis, tail at +Z.
    scale = radius_b / radius_a
    for vertex in part.data.vertices:
        if vertex.co.z > 0:
            vertex.co.x *= scale
            vertex.co.y *= scale
    return _skin(part, bone, mat)


def build_body(arm):
    parts = []
    # Head, face and neck.
    parts.append(_skin(sphere(0.135, (0, 0.005, 1.675), "plastic_gray", segments=16, rings=12, scale=(0.95, 0.98, 1.1)),
                       "head", "skin"))
    parts.append(_skin(sphere(0.022, (0, -0.132, 1.655), "plastic_gray", segments=8, rings=6, scale=(0.9, 0.8, 1.1)),
                       "head", "skin"))
    for sign in (1, -1):
        parts.append(_skin(sphere(0.03, (0.13 * sign, 0.0, 1.67), "plastic_gray", segments=8, rings=6,
                                  scale=(0.5, 0.9, 1.2)), "head", "skin"))
        parts.append(_skin(sphere(0.017, (0.048 * sign, -0.118, 1.695), "plastic_gray", segments=8, rings=6),
                           "head", "eyes"))
        parts.append(_skin(box((0.038, 0.01, 0.008), (0.048 * sign, -0.124, 1.728), "plastic_gray", bevel=0.002),
                           "head", "hair"))
    parts.append(_skin(box((0.042, 0.006, 0.007), (0, -0.131, 1.612), "plastic_gray", bevel=0.002), "head", "lips"))
    parts.append(_skin(cylinder(0.052, 0.1, (0, 0.005, 1.515), "plastic_gray", vertices=12), "neck", "skin"))

    # Torso: chest and waist in the shirt, pelvis in the pants.
    parts.append(_skin(box((0.37, 0.22, 0.26), (0, 0.0, 1.34), "plastic_gray", bevel=0.06, segments=3), "chest", "shirt"))
    parts.append(_skin(box((0.33, 0.2, 0.2), (0, 0.0, 1.15), "plastic_gray", bevel=0.05, segments=3), "spine", "shirt"))
    parts.append(_skin(box((0.34, 0.21, 0.14), (0, 0.0, 0.98), "plastic_gray", bevel=0.05, segments=3), "hips", "pants"))

    for side, sign in (("L", 1), ("R", -1)):
        shoulder = Vector(BONES[f"upper_arm.{side}"][0])
        elbow = Vector(BONES[f"forearm.{side}"][0])
        wrist = Vector(BONES[f"hand.{side}"][0])
        parts.append(_skin(sphere(0.07, shoulder + Vector((0.005 * sign, 0, 0.005)), "plastic_gray", segments=12, rings=8),
                           f"upper_arm.{side}", "shirt"))
        parts.append(_limb(f"upper_arm.{side}", 0.056, 0.05, "shirt"))
        parts.append(_skin(sphere(0.043, elbow, "plastic_gray", segments=10, rings=6), f"forearm.{side}", "skin"))
        parts.append(_limb(f"forearm.{side}", 0.043, 0.036, "skin"))
        parts.append(_skin(sphere(0.045, wrist + Vector((0.002 * sign, -0.005, -0.045)), "plastic_gray", segments=10,
                                  rings=8, scale=(0.75, 0.55, 1.25)), f"hand.{side}", "skin"))
        hip = Vector(BONES[f"thigh.{side}"][0])
        knee = Vector(BONES[f"shin.{side}"][0])
        ankle = Vector(BONES[f"foot.{side}"][0])
        parts.append(_skin(sphere(0.085, hip + Vector((0, 0, -0.02)), "plastic_gray", segments=12, rings=8), f"thigh.{side}",
                           "pants"))
        parts.append(_limb(f"thigh.{side}", 0.08, 0.066, "pants"))
        parts.append(_skin(sphere(0.066, knee, "plastic_gray", segments=10, rings=8), f"shin.{side}", "pants"))
        parts.append(_limb(f"shin.{side}", 0.062, 0.05, "pants"))
        parts.append(_skin(box((0.1, 0.25, 0.08), ankle + Vector((0, -0.06, -0.05)), "plastic_gray", bevel=0.03,
                               segments=3), f"foot.{side}", "shoes"))
    return _join(parts, "Body", arm)


def build_hair(arm):
    """Several hairstyles skinned to the head; the web client shows one per character."""
    styles = {}
    # Cap slightly larger than the skull, shifted up and back so the face stays uncovered.
    top = Vector((0, 0.03, 1.705))
    cap_scale = (0.98, 0.966, 0.9)
    styles["hair_short"] = [sphere(0.145, top, "plastic_gray", segments=16, rings=10, scale=cap_scale)]
    styles["hair_long"] = [sphere(0.148, top, "plastic_gray", segments=16, rings=10, scale=cap_scale),
                           box((0.27, 0.1, 0.3), (0, 0.085, 1.56), "plastic_gray", bevel=0.05, segments=3)]
    styles["hair_bun"] = [sphere(0.145, top, "plastic_gray", segments=16, rings=10, scale=cap_scale),
                          sphere(0.065, (0, 0.13, 1.8), "plastic_gray", segments=12, rings=8)]
    curly = []
    for i in range(14):
        angle = i / 14 * math.tau
        ring = 0 if i < 9 else 1
        radius = 0.11 if ring == 0 else 0.06
        z = 1.74 if ring == 0 else 1.8
        curly.append(sphere(0.055, (radius * math.cos(angle), 0.02 + radius * math.sin(angle), z), "plastic_gray",
                            segments=8, rings=6))
    for offset in ((0, 0.03, 1.83), (0.045, 0.0, 1.815), (-0.045, 0.0, 1.815), (0, 0.08, 1.8), (0, -0.04, 1.81)):
        curly.append(sphere(0.055, offset, "plastic_gray", segments=8, rings=6))
    styles["hair_curly"] = curly
    styles["hair_cap"] = [sphere(0.15, top + Vector((0, 0, 0.01)), "plastic_gray", segments=16, rings=10,
                                 scale=(0.98, 0.97, 0.85)),
                          box((0.19, 0.1, 0.012), (0, -0.155, 1.775), "plastic_gray", bevel=0.005, rotation=(-8, 0, 0))]
    objects = []
    for name, parts in styles.items():
        for part in parts:
            # A cap takes the shirt color; everything else is hair.
            _skin(part, "head", "shirt" if name == "hair_cap" else "hair")
        objects.append(_join(parts, name, arm))
    glasses_parts = []
    for sign in (1, -1):
        from lib.kit import torus

        glasses_parts.append(torus(0.028, 0.004, (0.05 * sign, -0.132, 1.695), "plastic_gray", rotation=(90, 0, 0),
                                   major_segments=14, minor_segments=4))
    glasses_parts.append(box((0.04, 0.006, 0.006), (0, -0.133, 1.7), "plastic_gray", bevel=0.0))
    for part in glasses_parts:
        _skin(part, "head", "eyes")
    objects.append(_join(glasses_parts, "glasses", arm))
    return objects


def build_accessories(arm):
    """Objects the web client shows only for some animations: a coffee cup held in the right hand.

    Rigid on the hand bone. In the rest pose the hand hangs down, so the cup lies along -Y (opening
    toward -Y): it stands upright whenever the hand points forward, as when holding it in front of
    the chest.
    """
    from lib.kit import torus, vessel

    wrist = Vector(BONES["hand.R"][0])
    center = wrist + Vector((0.0, -0.05, -0.06))
    # rotation (90, 0, 0) turns the vessel's +Z (its opening) toward -Y.
    shell, coffee = vessel(0.036, 0.085, center, "plastic_gray", vertices=14, wall=0.004,
                           fill=(0.07, "plastic_gray"), rotation=(90, 0, 0))
    handle = torus(0.022, 0.006, center + Vector((0.04, 0, 0)), "plastic_gray", major_segments=10, minor_segments=4)
    for part in (shell, handle):
        _skin(part, "hand.R", "cup")
    _skin(coffee, "hand.R", "coffee")
    return [_join([shell, coffee, handle], "cup", arm)]


# ---- posing ------------------------------------------------------------------------------------


def pose_reset(arm):
    for pose_bone in arm.pose.bones:
        pose_bone.rotation_mode = "QUATERNION"
        pose_bone.rotation_quaternion = Quaternion()
        pose_bone.location = Vector()
    bpy.context.view_layer.update()


def bone_head(arm, name):
    return arm.pose.bones[name].head.copy()


def aim(arm, name, direction, twist=0.0):
    """Rotates bone `name` so that it points along world `direction` (armature space)."""
    pose_bone = arm.pose.bones[name]
    bone = pose_bone.bone
    if pose_bone.parent:
        rest_relative = bone.parent.matrix_local.inverted() @ bone.matrix_local
        base = pose_bone.parent.matrix @ rest_relative
    else:
        base = bone.matrix_local
    local = base.to_3x3().inverted() @ Vector(direction).normalized()
    rotation = Vector((0, 1, 0)).rotation_difference(local)
    if twist:
        rotation = rotation @ Quaternion((0, 1, 0), twist)
    pose_bone.rotation_quaternion = rotation
    bpy.context.view_layer.update()


def move(arm, name, offset):
    """Translates bone `name` by a world-space offset (armature space) from its rest position."""
    pose_bone = arm.pose.bones[name]
    rest = pose_bone.bone.matrix_local.to_3x3()
    pose_bone.location = rest.inverted() @ Vector(offset)
    bpy.context.view_layer.update()


def two_bone_ik(arm, upper, lower, target, pole):
    """Points `upper` and `lower` so that the end of `lower` reaches `target`, bending toward `pole`."""
    start = bone_head(arm, upper)
    length_a = (Vector(BONES[upper][1]) - Vector(BONES[upper][0])).length
    length_b = (Vector(BONES[lower][1]) - Vector(BONES[lower][0])).length
    to_target = Vector(target) - start
    distance = min(to_target.length, (length_a + length_b) * 0.999)
    u = to_target.normalized()
    pole_vector = Vector(pole)
    v = (pole_vector - u * pole_vector.dot(u)).normalized()
    cos_alpha = (length_a ** 2 + distance ** 2 - length_b ** 2) / (2 * length_a * distance)
    alpha = math.acos(max(-1.0, min(1.0, cos_alpha)))
    elbow = start + length_a * (math.cos(alpha) * u + math.sin(alpha) * v)
    aim(arm, upper, elbow - start)
    aim(arm, lower, (start + u * distance) - elbow)


def key_pose(arm, frame, bones=None):
    for pose_bone in arm.pose.bones:
        if bones and pose_bone.name not in bones:
            continue
        pose_bone.keyframe_insert("rotation_quaternion", frame=frame)
        pose_bone.keyframe_insert("location", frame=frame)
