"""Outdoor props around the office: vegetation, street furniture, cars, terrace, entrance."""

import math
import random

from lib.kit import box, cylinder, ico, join, rod, sphere, torus, vessel


# ---- vegetation ------------------------------------------------------------------------------------


def tree_round():
    """Broadleaf tree, about 4.4 m high."""
    parts = [cylinder(0.14, 2.2, (0, 0, 1.1), "bark", vertices=8, radius_top=0.09)]
    blobs = [
        ((0, 0, 3.0), 1.3, "leaf_green", (1, 1, 0.9)),
        ((0.65, 0.3, 2.65), 0.9, "leaf_dark", (1, 1, 0.85)),
        ((-0.6, -0.35, 2.75), 0.85, "leaf_light", (1, 1, 0.9)),
        ((0.15, -0.55, 3.55), 0.8, "leaf_green", (1, 1, 0.9)),
        ((-0.25, 0.55, 3.5), 0.75, "leaf_dark", (1, 1, 0.9)),
    ]
    # Each blob turned differently: identical orientations could leave faces of two blobs in one plane.
    for index, (location, radius, color, scale) in enumerate(blobs):
        parts.append(ico(radius, location, color, subdivisions=1, scale=scale, rotation=(0, 0, index * 37)))
    return join(parts, "tree_round")


def tree_birch():
    """Slim tree with a pale trunk, about 5.2 m high."""
    parts = [cylinder(0.09, 3.2, (0, 0, 1.6), "birch_bark", vertices=8, radius_top=0.06)]
    for index, (location, radius, color) in enumerate((
        ((0, 0, 3.6), 0.85, "leaf_light"),
        ((0.35, 0.2, 4.3), 0.65, "leaf_green"),
        ((-0.3, -0.15, 4.45), 0.6, "leaf_light"),
        ((0.1, -0.35, 3.05), 0.6, "leaf_green"),
        ((-0.2, 0.3, 2.9), 0.55, "leaf_light"),
    )):
        parts.append(ico(radius, location, color, subdivisions=1, scale=(1, 1, 1.25), rotation=(0, 0, index * 37)))
    return join(parts, "tree_birch")


def tree_conifer():
    """Conifer, about 5.6 m high."""
    parts = [cylinder(0.12, 1.0, (0, 0, 0.5), "bark", vertices=8)]
    for bottom, height, radius in ((0.7, 2.2, 1.5), (2.1, 1.9, 1.15), (3.4, 2.2, 0.8)):
        parts.append(cylinder(radius, height, (0, 0, bottom + height / 2), "leaf_dark", vertices=9, radius_top=0.0))
    return join(parts, "tree_conifer")


def bush():
    parts = []
    for index, (location, radius, color) in enumerate((
        ((0, 0, 0.42), 0.52, "leaf_green"),
        ((0.38, 0.12, 0.34), 0.4, "leaf_dark"),
        ((-0.34, -0.1, 0.36), 0.42, "leaf_light"),
    )):
        parts.append(ico(radius, location, color, subdivisions=1, scale=(1, 1, 0.8), rotation=(0, 0, index * 41)))
    return join(parts, "bush")


def hedge():
    """A 2 m section of trimmed hedge; sections are placed end to end."""
    parts = [box((2.0, 0.7, 0.85), (0, 0, 0.425), "leaf_dark", bevel=0.12, segments=2)]
    for x in (-0.7, -0.2, 0.3, 0.75):
        parts.append(ico(0.3, (x, 0.02, 0.83), "leaf_green", subdivisions=1, scale=(1.5, 1.05, 0.55)))
    return join(parts, "hedge")


def flower_bed():
    """Round concrete planter with flowers."""
    rng = random.Random(3)
    parts = vessel(0.62, 0.45, (0, 0, 0.225), "concrete_light", vertices=18, wall=0.07, fill=(0.37, "soil"))
    colors = ("flower_pink", "flower_purple", "flower_white", "yellow")
    for i in range(16):
        angle = rng.uniform(0, math.tau)
        radius = rng.uniform(0.05, 0.42)
        x, y = radius * math.cos(angle), radius * math.sin(angle)
        parts.append(ico(0.09, (x, y, 0.45), "leaf_green", subdivisions=1, scale=(1, 1, 0.7)))
        parts.append(ico(0.055, (x + 0.02, y, 0.53), colors[i % len(colors)], subdivisions=1))
    return join(parts, "flower_bed")


# ---- street furniture ------------------------------------------------------------------------------


def bench():
    """Park bench, 1.6 m long, seat toward -Y."""
    parts = []
    for y in (-0.16, 0.0, 0.16):
        parts.append(box((1.6, 0.13, 0.04), (0, y, 0.45), "wood_mid", bevel=0.008))
    for z in (0.62, 0.78):
        parts.append(box((1.6, 0.04, 0.12), (0, 0.27, z), "wood_mid", bevel=0.008, rotation=(-12, 0, 0)))
    for x in (-0.68, 0.68):
        parts.append(box((0.06, 0.5, 0.05), (x, 0.0, 0.41), "metal_dark", bevel=0.01))
        for y in (-0.2, 0.2):
            parts.append(box((0.06, 0.06, 0.41), (x, y, 0.205), "metal_dark", bevel=0.01))
        parts.append(rod((x, 0.2, 0.43), (x, 0.3, 0.86), 0.025))
    return join(parts, "bench")


def street_lamp():
    """Street lamp, light head 4.6 m high overhanging toward -Y."""
    parts = [
        cylinder(0.14, 0.4, (0, 0, 0.2), "metal_dark", vertices=12, radius_top=0.1),
        cylinder(0.06, 4.3, (0, 0, 2.55), "metal_dark", vertices=10),
        rod((0, 0, 4.6), (0, -0.85, 4.72), 0.04),
        box((0.34, 0.56, 0.13), (0, -0.95, 4.66), "metal_dark", bevel=0.03),
        box((0.26, 0.44, 0.03), (0, -0.95, 4.585), "lamp_glow", bevel=0.0),
    ]
    return join(parts, "street_lamp")


def bollard():
    """Low light post, 0.9 m, with a glowing band."""
    parts = [
        cylinder(0.1, 0.9, (0, 0, 0.45), "metal_dark", vertices=12),
        cylinder(0.104, 0.07, (0, 0, 0.78), "lamp_glow", vertices=12),
        sphere(0.1, (0, 0, 0.9), "metal_dark", segments=12, rings=6, scale=(1, 1, 0.4)),
    ]
    return join(parts, "bollard")


def _bike(x):
    parts = []
    for y in (-0.52, 0.52):
        parts.append(torus(0.32, 0.025, (x, y, 0.34), "rubber", rotation=(0, 90, 0), major_segments=16,
                           minor_segments=4))
    frame = [((x, -0.52, 0.34), (x, 0.0, 0.36)), ((x, 0.0, 0.36), (x, 0.52, 0.34)),
             ((x, 0.0, 0.36), (x, 0.12, 0.8)), ((x, -0.4, 0.8), (x, 0.12, 0.66)),
             ((x, -0.52, 0.34), (x, -0.42, 0.85))]
    for start, end in frame:
        parts.append(rod(start, end, 0.018, "red"))
    parts.append(box((0.08, 0.22, 0.05), (x, 0.14, 0.83), "plastic_black", bevel=0.02))
    parts.append(rod((x - 0.24, -0.42, 0.88), (x + 0.24, -0.42, 0.88), 0.015))
    return parts


def bike_rack():
    """Three hoops with two bikes, parked along Y."""
    parts = []
    for x in (-0.6, 0.0, 0.6):
        parts.append(rod((x, -0.3, 0.0), (x, -0.3, 0.7), 0.025, "metal_light"))
        parts.append(rod((x, 0.3, 0.0), (x, 0.3, 0.7), 0.025, "metal_light"))
        parts.append(rod((x, -0.3, 0.7), (x, 0.3, 0.7), 0.025, "metal_light"))
    parts += _bike(-0.3) + _bike(0.3)
    return join(parts, "bike_rack")


def outdoor_bin():
    parts = [
        cylinder(0.24, 0.85, (0, 0, 0.425), "metal_dark", vertices=14),
        cylinder(0.26, 0.06, (0, 0, 0.87), "metal_light", vertices=14),
    ]
    return join(parts, "outdoor_bin")


# ---- cars ------------------------------------------------------------------------------------------


def _car(name, paint):
    """Compact car, 4.3 m long, front toward -Y."""
    parts = [
        box((1.8, 4.3, 0.6), (0, 0, 0.58), paint, bevel=0.12, segments=2),
        box((1.6, 2.2, 0.55), (0, 0.25, 1.1), paint, bevel=0.12, segments=2),
        # Side, front and rear windows: a dark band sticking out of the cabin.
        box((1.62, 2.24, 0.36), (0, 0.25, 1.13), "screen_black", bevel=0.05),
    ]
    for x in (-0.82, 0.82):
        for y in (-1.35, 1.35):
            parts.append(cylinder(0.33, 0.22, (x, y, 0.33), "rubber", vertices=14, rotation=(0, 90, 0)))
            parts.append(cylinder(0.17, 0.225, (x, y, 0.33), "metal_light", vertices=10, rotation=(0, 90, 0)))
    for x in (-0.6, 0.6):
        parts.append(box((0.32, 0.04, 0.12), (x, -2.14, 0.66), "headlight", bevel=0.02))
        parts.append(box((0.3, 0.04, 0.1), (x, 2.14, 0.7), "tail_light", bevel=0.02))
    return join(parts, name)


def car_red():
    return _car("car_red", "car_red")


def car_blue():
    return _car("car_blue", "car_blue")


def car_white():
    return _car("car_white", "car_white")


# ---- terrace and entrance --------------------------------------------------------------------------


def outdoor_table():
    parts = [
        cylinder(0.45, 0.03, (0, 0, 0.735), "metal_light", vertices=18),
        cylinder(0.03, 0.72, (0, 0, 0.36), "metal_dark", vertices=8),
        cylinder(0.25, 0.03, (0, 0, 0.015), "metal_dark", vertices=14),
    ]
    return join(parts, "outdoor_table")


def outdoor_chair():
    """Metal bistro chair, seat toward -Y."""
    parts = [
        box((0.42, 0.42, 0.03), (0, 0, 0.46), "metal_light", bevel=0.01),
        box((0.42, 0.03, 0.36), (0, 0.2, 0.68), "metal_light", bevel=0.01, rotation=(-8, 0, 0)),
    ]
    for x in (-0.18, 0.18):
        for y in (-0.18, 0.18):
            parts.append(rod((x, y, 0.45), (x * 1.1, y * 1.1, 0.0), 0.012, "metal_dark"))
    return join(parts, "outdoor_chair")


def parasol():
    parts = [
        cylinder(0.25, 0.08, (0, 0, 0.04), "concrete_light", vertices=14),
        rod((0, 0, 0.08), (0, 0, 2.35), 0.025, "wood_light"),
        cylinder(1.35, 0.4, (0, 0, 2.2), "fabric_beige", vertices=10, radius_top=0.06),
    ]
    return join(parts, "parasol")


def entrance_canopy():
    """Canopy over the entrance: its back (+Y) against the facade, 2.2 m deep, 2.8 m high."""
    parts = [box((2.6, 2.2, 0.16), (0, 0, 2.82), "concrete_light", bevel=0.02)]
    for x in (-1.15, 1.15):
        parts.append(cylinder(0.06, 2.74, (x, -0.95, 1.37), "metal_dark", vertices=10))
    parts.append(box((2.3, 0.04, 0.06), (0, -1.08, 2.7), "lamp_glow", bevel=0.0))
    return join(parts, "entrance_canopy")


def sign_monolith():
    """Freestanding sign; the web client writes the office name on the dark panel (front, -Y)."""
    parts = [
        box((2.6, 0.36, 1.3), (0, 0, 0.65), "concrete_light", bevel=0.03),
        box((2.3, 0.02, 0.8), (0, -0.19, 0.72), "plastic_black", bevel=0.0),
    ]
    return join(parts, "sign_monolith")


PROPS = {
    "tree_round": tree_round,
    "tree_birch": tree_birch,
    "tree_conifer": tree_conifer,
    "bush": bush,
    "hedge": hedge,
    "flower_bed": flower_bed,
    "bench": bench,
    "street_lamp": street_lamp,
    "bollard": bollard,
    "bike_rack": bike_rack,
    "outdoor_bin": outdoor_bin,
    "car_red": car_red,
    "car_blue": car_blue,
    "car_white": car_white,
    "outdoor_table": outdoor_table,
    "outdoor_chair": outdoor_chair,
    "parasol": parasol,
    "entrance_canopy": entrance_canopy,
    "sign_monolith": sign_monolith,
}
