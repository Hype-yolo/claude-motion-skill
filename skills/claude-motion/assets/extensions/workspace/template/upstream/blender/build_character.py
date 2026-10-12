"""Builds the rigged office character with its animations and exports character.glb.

Usage (from the repository root):
    Blender --background --python assets/blender/build_character.py -- [--preview DIR]

`--preview DIR` renders one image per animation, with the character sitting at a desk, to check
the poses without the Blender UI.

The character sits 0.64 m in front of the desk center (desk local frame of the web client), facing
the desk: keyboard ≈ 0.5 m ahead at 0.77 m high, monitor ≈ 0.84 m ahead at 1.08 m.
"""

import math
import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)

import bpy  # noqa: E402
from mathutils import Vector  # noqa: E402

from character.rig import (  # noqa: E402
    aim,
    bone_head,
    build_accessories,
    build_armature,
    build_body,
    build_hair,
    key_pose,
    move,
    pose_reset,
    two_bone_ik,
)
from lib.kit import reset_scene  # noqa: E402

OUTPUT = os.path.normpath(os.path.join(HERE, "..", "..", "apps", "web", "public", "models", "character.glb"))
FPS = 24
SIT_DROP = -0.4  # Pelvis drop from standing to sitting on the chair.
KEYBOARD_Y = -0.5
KEYBOARD_Z = 0.78


def direction(pitch_forward, yaw=0.0):
    """Unit vector pointing up, tilted forward (toward -Y) by `pitch_forward` and turned by `yaw`."""
    forward = math.sin(pitch_forward)
    return Vector((-forward * math.sin(yaw), -forward * math.cos(yaw), math.cos(pitch_forward)))


def sit(arm, lean=0.12, head_pitch=0.2, head_yaw=0.0, head_roll=0.0, breathe=0.0):
    """Seated base pose: pelvis on the seat, thighs forward, feet on the floor, torso leaning."""
    move(arm, "hips", (0, 0.02, SIT_DROP))
    aim(arm, "spine", direction(lean * 0.6 + breathe * 0.3))
    aim(arm, "chest", direction(lean + breathe))
    aim(arm, "neck", direction(lean * 0.5 + head_pitch * 0.4, head_yaw * 0.4))
    tilt = direction(head_pitch, head_yaw)
    tilt.x += head_roll
    aim(arm, "head", tilt)
    for side, sign in (("L", 1), ("R", -1)):
        foot = (0.13 * sign, -0.44, 0.09)
        two_bone_ik(arm, f"thigh.{side}", f"shin.{side}", foot, (0, -1, 0.4))
        aim(arm, f"foot.{side}", (0.05 * sign, -1, -0.25))


def arm_to(arm, side, target, pole, hand_direction=(0, -1, -0.25)):
    two_bone_ik(arm, f"upper_arm.{side}", f"forearm.{side}", target, pole)
    aim(arm, f"hand.{side}", hand_direction)


def rest_hands_on_desk(arm, spread=0.24, y=-0.36):
    arm_to(arm, "L", (spread, y, KEYBOARD_Z - 0.01), (1, 0.4, -1.2), (0.1, -1, -0.1))
    arm_to(arm, "R", (-spread, y, KEYBOARD_Z - 0.01), (-1, 0.4, -1.2), (-0.1, -1, -0.1))


# ---- animations (t goes from 0 to 1 over the loop) ------------------------------------------------


def pose_typing(arm, t):
    sit(arm, lean=0.14, head_pitch=0.24 + 0.02 * math.sin(t * math.tau * 2), breathe=0.01 * math.sin(t * math.tau))
    for side, sign, phase in (("L", 1, 0.0), ("R", -1, 0.5)):
        tap = 0.014 * max(0.0, math.sin((t * 6 + phase) * math.tau))
        drift = 0.02 * math.sin((t * 2 + phase) * math.tau)
        target = (0.12 * sign + drift, KEYBOARD_Y + 0.02 * math.cos((t * 3 + phase) * math.tau), KEYBOARD_Z + tap)
        arm_to(arm, side, target, (1.2 * sign, 0.6, -1), (0.1 * sign, -1, -0.35))


def pose_idle(arm, t):
    look = 0.35 * math.sin(t * math.tau)
    sit(arm, lean=0.08, head_pitch=0.12, head_yaw=look, breathe=0.015 * math.sin(t * math.tau * 3))
    rest_hands_on_desk(arm)


def pose_lean_back(arm, t):
    sway = 0.04 * math.sin(t * math.tau)
    sit(arm, lean=-0.18, head_pitch=-0.12 + sway, head_yaw=0.15 * math.sin(t * math.tau), breathe=sway * 0.3)
    head = bone_head(arm, "head")
    for side, sign in (("L", 1), ("R", -1)):
        arm_to(arm, side, head + Vector((0.07 * sign, 0.1, 0.12)), (1.5 * sign, 0.3, 0.6), (-0.4 * sign, 0.2, 0.2))


def pose_raise_hand(arm, t):
    wave = math.sin(t * math.tau * 2)
    sit(arm, lean=0.02, head_pitch=-0.1, head_yaw=-0.35, head_roll=0.05)
    arm_to(arm, "L", (0.24, -0.36, KEYBOARD_Z - 0.01), (1, 0.4, -1.2), (0.1, -1, -0.1))
    shoulder = bone_head(arm, "upper_arm.R")
    hand = shoulder + Vector((-0.08 + 0.1 * wave, -0.12, 0.5))
    arm_to(arm, "R", hand, (-1, 0.3, 0), (-0.1 + 0.4 * wave, -0.1, 1))


def pose_drink(arm, t):
    # 0-0.25 rest, 0.25-0.4 raise, 0.4-0.65 sip, 0.65-0.8 lower, 0.8-1 rest.
    if t < 0.25 or t >= 0.8:
        lift = 0.0
    elif t < 0.4:
        lift = (t - 0.25) / 0.15
    elif t < 0.65:
        lift = 1.0
    else:
        lift = 1 - (t - 0.65) / 0.15
    lift = 0.5 - 0.5 * math.cos(lift * math.pi)
    sit(arm, lean=0.06 - 0.08 * lift, head_pitch=0.12 - 0.3 * lift)
    arm_to(arm, "L", (0.24, -0.36, KEYBOARD_Z - 0.01), (1, 0.4, -1.2), (0.1, -1, -0.1))
    head = bone_head(arm, "head")
    mouth = head + Vector((-0.02, -0.17, 0.05))
    rest = Vector((-0.22, -0.4, KEYBOARD_Z + 0.04))
    target = rest.lerp(mouth, lift)
    arm_to(arm, "R", target, (-1, 0.5, -1.2), (0.3 * lift - 0.1, -1, 0.6 * lift))


def pose_head_in_hands(arm, t):
    sway = 0.03 * math.sin(t * math.tau)
    sit(arm, lean=0.42, head_pitch=0.55 + sway, head_yaw=0.08 * math.sin(t * math.tau * 2))
    head = bone_head(arm, "head")
    for side, sign in (("L", 1), ("R", -1)):
        target = head + Vector((0.09 * sign, -0.1, 0.02))
        arm_to(arm, side, target, (0.6 * sign, -0.3, -1.5), (-0.3 * sign, -0.2, 1))


def pose_sleep(arm, t):
    breathe = 0.02 * math.sin(t * math.tau)
    sit(arm, lean=-0.08 + breathe, head_pitch=0.75, head_roll=0.25)
    for side, sign in (("L", 1), ("R", -1)):
        arm_to(arm, side, (0.13 * sign, -0.3, 0.63), (0.8 * sign, 0.3, -1), (0.2 * sign, -1, -0.6))


# ---- standing animations (walks to the lounge, visits to colleagues) ------------------------------

# One walk loop: each foot slides back WALK_STRIDE * 2 on the ground during half of the loop, so the
# character moves forward at 4 * WALK_STRIDE / WALK_SECONDS m/s (1.1 m/s): the web client moves it
# at that speed along its path.
WALK_STRIDE = 0.22
WALK_SECONDS = 0.8


def stand(arm, lean=0.03, head_pitch=0.05, head_yaw=0.0, breathe=0.0, drop=-0.02):
    """Standing base pose: slightly bent knees, feet under the hips."""
    move(arm, "hips", (0, 0, drop))
    aim(arm, "spine", direction(lean * 0.6 + breathe * 0.3))
    aim(arm, "chest", direction(lean + breathe))
    aim(arm, "neck", direction(lean * 0.5 + head_pitch * 0.4, head_yaw * 0.4))
    aim(arm, "head", direction(head_pitch, head_yaw))
    for side, sign in (("L", 1), ("R", -1)):
        two_bone_ik(arm, f"thigh.{side}", f"shin.{side}", (0.1 * sign, 0.0, 0.09), (0, -1, 0.1))
        aim(arm, f"foot.{side}", (0.03 * sign, -1, -0.4))


def hang_arm(arm, side, sign, forward=0.0):
    """Arm hanging along the body; `forward` swings the hand forward (-Y) or back (+Y)."""
    shoulder = bone_head(arm, f"upper_arm.{side}")
    hand = shoulder + Vector((0.07 * sign, -forward, -0.52 + 0.08 * abs(forward)))
    arm_to(arm, side, hand, (0.3 * sign, 1, 0), (0.02 * sign, -forward * 0.6, -1))


def pose_walk(arm, t):
    bob = 0.015 * math.cos(t * math.tau * 2)
    stand(arm, lean=0.06, head_pitch=0.06, drop=-0.07 + bob)
    for side, sign, offset in (("L", 1, 0.0), ("R", -1, 0.5)):
        phase = (t + offset) % 1.0
        if phase < 0.5:
            # Stance: the foot stays on the ground and slides from the front (-Y) to the back.
            y = -WALK_STRIDE + 2 * WALK_STRIDE * (phase / 0.5)
            z = 0.09
            foot_pitch = -0.4
        else:
            # Swing: the foot comes back to the front, lifted.
            swing = (phase - 0.5) / 0.5
            y = WALK_STRIDE - 2 * WALK_STRIDE * (0.5 - 0.5 * math.cos(swing * math.pi))
            z = 0.09 + 0.07 * math.sin(swing * math.pi)
            foot_pitch = -0.4 + 0.25 * math.sin(swing * math.pi)
        two_bone_ik(arm, f"thigh.{side}", f"shin.{side}", (0.1 * sign, y, z), (0, -1, 0.1))
        aim(arm, f"foot.{side}", (0.03 * sign, -1, foot_pitch))
        # Arms swing opposite to the leg on the same side.
        hang_arm(arm, side, sign, forward=0.16 * math.cos((phase + 0.5) * math.tau) * -1)


def pose_stand(arm, t):
    look = 0.3 * math.sin(t * math.tau)
    stand(arm, head_yaw=look, breathe=0.012 * math.sin(t * math.tau * 3))
    hang_arm(arm, "L", 1, forward=0.02)
    hang_arm(arm, "R", -1, forward=0.02)


def pose_stand_drink(arm, t):
    # 0-0.3 hold, 0.3-0.45 raise, 0.45-0.65 sip, 0.65-0.8 lower, 0.8-1 hold.
    if t < 0.3 or t >= 0.8:
        lift = 0.0
    elif t < 0.45:
        lift = (t - 0.3) / 0.15
    elif t < 0.65:
        lift = 1.0
    else:
        lift = 1 - (t - 0.65) / 0.15
    lift = 0.5 - 0.5 * math.cos(lift * math.pi)
    stand(arm, lean=0.02 - 0.06 * lift, head_pitch=0.1 - 0.35 * lift, head_yaw=0.15 * math.sin(t * math.tau))
    hang_arm(arm, "L", 1, forward=0.03)
    head = bone_head(arm, "head")
    shoulder = bone_head(arm, "upper_arm.R")
    hold = shoulder + Vector((0.02, -0.3, -0.3))
    mouth = head + Vector((-0.02, -0.17, 0.05))
    # Pointing the hand forward keeps the cup upright; raising it tilts the cup toward the mouth.
    arm_to(arm, "R", hold.lerp(mouth, lift), (-1, 0.5, -1.2), (0.3 * lift - 0.05, -1, 0.6 * lift))


def pose_talk(arm, t):
    nod = 0.06 * math.sin(t * math.tau * 3)
    stand(arm, lean=0.05, head_pitch=0.08 + nod, head_yaw=0.1 * math.sin(t * math.tau))
    for side, sign, phase in (("L", 1, 0.0), ("R", -1, 0.35)):
        shoulder = bone_head(arm, f"upper_arm.{side}")
        gesture = math.sin((t + phase) * math.tau * 2)
        hand = shoulder + Vector((0.1 * sign + 0.04 * gesture * sign, -0.3, -0.32 + 0.07 * gesture))
        arm_to(arm, side, hand, (0.8 * sign, 0.4, -1), (0.2 * sign, -1, 0.3 + 0.3 * gesture))


ANIMATIONS = {
    # name: (pose function, seconds per loop, key every N frames)
    "Typing": (pose_typing, 2.0, 2),
    "Idle": (pose_idle, 6.0, 6),
    "LeanBack": (pose_lean_back, 5.0, 6),
    "RaiseHand": (pose_raise_hand, 1.5, 3),
    "Drink": (pose_drink, 6.0, 4),
    "HeadInHands": (pose_head_in_hands, 3.0, 6),
    "Sleep": (pose_sleep, 4.0, 6),
    "Walk": (pose_walk, WALK_SECONDS, 1),
    "Stand": (pose_stand, 5.0, 6),
    "StandDrink": (pose_stand_drink, 6.0, 4),
    "Talk": (pose_talk, 3.0, 3),
}


STANDING_ANIMATIONS = {"Walk", "Stand", "StandDrink", "Talk"}
CUP_ANIMATIONS = {"Drink", "StandDrink"}


def bake_animations(arm):
    arm.animation_data_create()
    for name, (pose, seconds, step) in ANIMATIONS.items():
        action = bpy.data.actions.new(name)
        arm.animation_data.action = action
        frames = int(seconds * FPS)
        for frame in range(0, frames + 1, step):
            pose_reset(arm)
            pose(arm, (frame % frames) / frames)
            key_pose(arm, frame)
        track = arm.animation_data.nla_tracks.new()
        track.name = name
        track.strips.new(name, 0, action)
        arm.animation_data.action = None
        print(f"[character] {name}: {frames} frames")
    pose_reset(arm)


def export(arm, meshes):
    bpy.ops.object.select_all(action="DESELECT")
    arm.select_set(True)
    for mesh in meshes:
        mesh.select_set(True)
    bpy.context.view_layer.objects.active = arm
    os.makedirs(os.path.dirname(OUTPUT), exist_ok=True)
    bpy.ops.export_scene.gltf(filepath=OUTPUT, export_format="GLB", use_selection=True, export_apply=False,
                              export_yup=True, export_skins=True, export_animations=True,
                              export_animation_mode="ACTIONS", export_force_sampling=True,
                              export_optimize_animation_size=True, export_def_bones=False)
    print(f"[character] exported to {OUTPUT}")


def render_previews(arm, meshes, directory):
    from lib.kit import _link, material  # noqa: F401
    from props.desk_set import desk, keyboard, monitor, office_chair

    os.makedirs(directory, exist_ok=True)
    # Desk scene in the character's frame: the desk center is 0.64 m ahead (-Y).
    furniture = []
    for builder, location, rotation in ((desk, (0, -0.64, 0), 0), (monitor, (0, -0.84, 0.74), 0),
                                        (keyboard, (0, -0.54, 0.74), 0), (office_chair, (0, 0.08, 0), 0)):
        obj = builder()
        obj.location = Vector(location)
        obj.rotation_euler.z = math.radians(rotation)
        furniture.append(obj)

    scene = bpy.context.scene
    scene.render.engine = "BLENDER_EEVEE"
    scene.render.resolution_x, scene.render.resolution_y = 900, 700
    world = bpy.data.worlds.new("World")
    world.use_nodes = True
    world.node_tree.nodes["Background"].inputs["Color"].default_value = (0.6, 0.62, 0.66, 1)
    scene.world = world
    sun = bpy.data.lights.new("Sun", "SUN")
    sun.energy = 3.0
    sun_object = bpy.data.objects.new("Sun", sun)
    sun_object.rotation_euler = (math.radians(45), 0, math.radians(-30))
    bpy.context.scene.collection.objects.link(sun_object)
    camera_data = bpy.data.cameras.new("Camera")
    camera = bpy.data.objects.new("Camera", camera_data)
    bpy.context.scene.collection.objects.link(camera)
    scene.camera = camera
    target = Vector((0, -0.35, 0.95))
    camera.location = Vector((1.9, 0.9, 1.7))
    camera.rotation_euler = (target - camera.location).to_track_quat("-Z", "Y").to_euler()

    for name, (_, seconds, _) in ANIMATIONS.items():
        # Standing animations happen away from the desk; the cup only shows while drinking.
        standing = name in STANDING_ANIMATIONS
        for obj in furniture:
            obj.hide_render = standing
        # Standing: full body, three-quarter front view.
        camera.location = Vector((1.5, -2.6, 1.35)) if standing else Vector((1.9, 0.9, 1.7))
        look_at = Vector((0, 0, 0.9)) if standing else target
        camera.rotation_euler = (look_at - camera.location).to_track_quat("-Z", "Y").to_euler()
        for mesh in meshes:
            mesh.hide_render = mesh.name not in ("Body", "hair_short", "cup" if name in CUP_ANIMATIONS else "")
        arm.animation_data.action = bpy.data.actions[name]
        scene.frame_set(int(seconds * FPS * 0.45))
        scene.render.filepath = os.path.join(directory, f"{name}.png")
        bpy.ops.render.render(write_still=True)
    arm.animation_data.action = None

    # Standing front view of every hairstyle, to review faces and hair.
    scene.frame_set(0)
    pose_reset(arm)
    for obj in bpy.data.objects:
        if obj.type == "MESH" and obj not in meshes:
            obj.hide_render = True
    camera.location = Vector((0.0, -2.2, 1.5))
    target = Vector((0, 0, 1.5))
    camera.rotation_euler = (target - camera.location).to_track_quat("-Z", "Y").to_euler()
    camera.data.lens = 70
    for style in ("hair_short", "hair_long", "hair_bun", "hair_curly", "hair_cap"):
        for mesh in meshes:
            mesh.hide_render = mesh.name not in ("Body", style, "glasses" if style == "hair_bun" else "")
        scene.render.filepath = os.path.join(directory, f"front_{style}.png")
        bpy.ops.render.render(write_still=True)


def main():
    argv = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
    preview = os.path.abspath(argv[argv.index("--preview") + 1]) if "--preview" in argv else None
    reset_scene()
    arm = build_armature()
    body = build_body(arm)
    hair = build_hair(arm)
    accessories = build_accessories(arm)
    bake_animations(arm)
    export(arm, [body, *hair, *accessories])
    if preview:
        render_previews(arm, [body, *hair, *accessories], preview)


main()
