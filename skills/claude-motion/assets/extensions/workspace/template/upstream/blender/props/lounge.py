"""Lounge, kitchen and meeting furniture."""

import math

from lib.kit import box, cylinder, ico, join, sphere, torus, vessel


def sofa():
    parts = [
        box((2.0, 0.85, 0.22), (0, 0, 0.2), "fabric_blue", bevel=0.03, segments=3),
        box((2.0, 0.22, 0.5), (0, 0.32, 0.55), "fabric_blue", bevel=0.05, segments=3, rotation=(-6, 0, 0)),
    ]
    for x in (-0.95, 0.95):
        parts.append(box((0.18, 0.85, 0.55), (x, 0, 0.37), "fabric_blue", bevel=0.05, segments=3))
    for x in (-0.45, 0.45):
        parts.append(box((0.85, 0.62, 0.13), (x, -0.07, 0.37), "fabric_blue", bevel=0.05, segments=3))
    for x in (-0.9, 0.9):
        for y in (-0.35, 0.35):
            parts.append(cylinder(0.025, 0.09, (x, y, 0.045), "wood_dark", vertices=8))
    parts.append(box((0.4, 0.14, 0.34), (-0.6, 0.12, 0.62), "fabric_orange", bevel=0.06, segments=3,
                     rotation=(-12, 0, 8)))
    return join(parts, "sofa")


def armchair():
    parts = [
        box((0.8, 0.8, 0.2), (0, 0, 0.22), "fabric_green", bevel=0.04, segments=3),
        box((0.8, 0.2, 0.48), (0, 0.3, 0.56), "fabric_green", bevel=0.05, segments=3, rotation=(-8, 0, 0)),
        box((0.62, 0.6, 0.12), (0, -0.07, 0.38), "fabric_green", bevel=0.05, segments=3),
    ]
    for x in (-0.36, 0.36):
        parts.append(box((0.12, 0.78, 0.36), (x, 0, 0.42), "fabric_green", bevel=0.05, segments=3))
    for x in (-0.33, 0.33):
        for y in (-0.33, 0.33):
            parts.append(cylinder(0.022, 0.12, (x, y, 0.06), "wood_dark", vertices=8, radius_top=0.016))
    return join(parts, "armchair")


def coffee_table():
    parts = [box((1.1, 0.6, 0.04), (0, 0, 0.42), "wood_light", bevel=0.01, segments=2)]
    for x in (-0.48, 0.48):
        for y in (-0.24, 0.24):
            parts.append(cylinder(0.022, 0.4, (x, y, 0.2), "wood_dark", vertices=8, radius_top=0.018))
    parts.append(box((0.22, 0.3, 0.02), (0.25, 0.05, 0.45), "book_2", bevel=0.003, rotation=(0, 0, 12)))
    parts.append(box((0.2, 0.28, 0.018), (0.25, 0.05, 0.469), "book_3", bevel=0.003, rotation=(0, 0, -5)))
    parts.append(cylinder(0.12, 0.05, (-0.25, 0, 0.465), "ceramic_white", vertices=20, radius_top=0.16))
    for i, color in enumerate(("red", "yellow", "green")):
        angle = i / 3 * math.tau
        parts.append(sphere(0.04, (-0.25 + 0.05 * math.cos(angle), 0.05 * math.sin(angle), 0.51), color,
                            segments=10, rings=6))
    return join(parts, "coffee_table")


def rug():
    parts = [
        box((2.4, 1.7, 0.012), (0, 0, 0.006), "fabric_beige", bevel=0.004),
        box((2.2, 1.5, 0.004), (0, 0, 0.013), "fabric_orange", bevel=0.0),
        box((2.0, 1.3, 0.004), (0, 0, 0.015), "fabric_beige", bevel=0.0),
    ]
    return join(parts, "rug")


def water_cooler():
    parts = [
        box((0.34, 0.34, 1.0), (0, 0, 0.5), "plastic_white", bevel=0.02),
        box((0.2, 0.08, 0.2), (0, -0.19, 0.78), "plastic_gray", bevel=0.01),
        box((0.16, 0.1, 0.02), (0, -0.2, 0.66), "plastic_gray", bevel=0.004),
        cylinder(0.012, 0.03, (-0.04, -0.21, 0.73), "blue", vertices=8),
        cylinder(0.012, 0.03, (0.04, -0.21, 0.73), "red", vertices=8),
        cylinder(0.14, 0.42, (0, 0, 1.22), "water", vertices=20),
        sphere(0.14, (0, 0, 1.43), "water", segments=20, rings=8, scale=(1, 1, 0.35)),
        cylinder(0.05, 0.06, (0, 0, 1.03), "blue", vertices=12),
    ]
    return join(parts, "water_cooler")


def kitchen_counter():
    """2.4 m counter with cabinets, sink and a kettle; faces -Y."""
    parts = [
        box((2.4, 0.62, 0.86), (0, 0, 0.43), "wall_white", bevel=0.006),
        box((2.44, 0.66, 0.04), (0, 0, 0.88), "wood_dark", bevel=0.006),
    ]
    for i in range(4):
        x = -0.9 + i * 0.6
        parts.append(box((0.57, 0.012, 0.7), (x, -0.315, 0.45), "wall_white", bevel=0.004))
        parts.append(box((0.012, 0.02, 0.16), (x + (0.22 if i % 2 else -0.22), -0.33, 0.62), "metal_dark", bevel=0.002))
    parts.append(box((0.5, 0.38, 0.02), (0.55, 0.0, 0.9), "metal_light", bevel=0.004))
    parts.append(cylinder(0.012, 0.25, (0.55, 0.2, 1.02), "chrome", vertices=8))
    parts.append(cylinder(0.01, 0.14, (0.55, 0.14, 1.14), "chrome", vertices=8, rotation=(90, 0, 0)))
    parts.append(cylinder(0.08, 0.2, (-0.8, 0.05, 1.0), "metal_light", vertices=16, radius_top=0.065))
    parts.append(box((0.04, 0.03, 0.12), (-0.72, 0.05, 1.02), "plastic_black", bevel=0.005))
    parts.append(box((0.35, 0.25, 0.02), (-0.2, 0.05, 0.91), "wood_light", bevel=0.003))
    return join(parts, "kitchen_counter")


def coffee_machine():
    parts = [
        box((0.3, 0.38, 0.4), (0, 0, 0.2), "plastic_black", bevel=0.02),
        box((0.26, 0.2, 0.12), (0, 0.06, 0.46), "metal_light", bevel=0.01),
        box((0.18, 0.1, 0.02), (0, -0.16, 0.06), "metal_dark", bevel=0.004),
        box((0.1, 0.08, 0.06), (0, -0.16, 0.3), "metal_dark", bevel=0.006),
        box((0.12, 0.004, 0.06), (0, -0.191, 0.36), "screen_black", bevel=0.0),
        cylinder(0.035, 0.07, (0, -0.15, 0.105), "ceramic_white", vertices=14),
    ]
    return join(parts, "coffee_machine")


def fridge():
    parts = [
        box((0.7, 0.7, 1.85), (0, 0, 0.925), "metal_light", bevel=0.02),
        box((0.68, 0.01, 1.2), (0, -0.352, 0.62), "metal_light", bevel=0.006),
        box((0.68, 0.01, 0.6), (0, -0.352, 1.53), "metal_light", bevel=0.006),
        box((0.03, 0.04, 0.4), (-0.3, -0.37, 1.0), "metal_dark", bevel=0.006),
        box((0.03, 0.04, 0.25), (-0.3, -0.37, 1.4), "metal_dark", bevel=0.006),
        box((0.1, 0.004, 0.1), (0.15, -0.36, 1.1), "yellow", bevel=0.0),
        box((0.12, 0.004, 0.08), (0.05, -0.36, 1.25), "paper", bevel=0.0),
    ]
    return join(parts, "fridge")


def microwave():
    parts = [
        box((0.5, 0.36, 0.3), (0, 0, 0.15), "metal_light", bevel=0.01),
        box((0.34, 0.01, 0.24), (-0.06, -0.18, 0.15), "screen_black", bevel=0.003),
        box((0.1, 0.01, 0.24), (0.18, -0.18, 0.15), "plastic_black", bevel=0.003),
    ]
    return join(parts, "microwave")


def bar_stool():
    parts = [
        cylinder(0.2, 0.03, (0, 0, 0.015), "metal_dark", vertices=20),
        cylinder(0.025, 0.68, (0, 0, 0.36), "chrome", vertices=10),
        torus(0.15, 0.01, (0, 0, 0.3), "chrome", rotation=(0, 0, 0)),
        cylinder(0.19, 0.06, (0, 0, 0.72), "leather_brown", vertices=20, bevel=0.015),
    ]
    return join(parts, "bar_stool")


def high_table():
    parts = [
        cylinder(0.4, 0.04, (0, 0, 1.06), "wood_light", vertices=28, bevel=0.008),
        cylinder(0.035, 1.02, (0, 0, 0.53), "metal_dark", vertices=12),
        cylinder(0.28, 0.03, (0, 0, 0.015), "metal_dark", vertices=24),
    ]
    return join(parts, "high_table")


def meeting_table():
    parts = [box((2.4, 1.1, 0.045), (0, 0, 0.735), "wood_light", bevel=0.01, segments=3)]
    for x in (-0.9, 0.9):
        parts.append(box((0.08, 0.8, 0.7), (x, 0, 0.35), "metal_dark", bevel=0.006))
    parts.append(box((0.3, 0.12, 0.02), (0, 0, 0.768), "plastic_black", bevel=0.004))
    return join(parts, "meeting_table")


def meeting_chair():
    parts = [
        box((0.46, 0.46, 0.06), (0, 0, 0.46), "fabric_orange", bevel=0.02, segments=3),
        box((0.44, 0.05, 0.4), (0, 0.22, 0.72), "fabric_orange", bevel=0.02, segments=3, rotation=(-6, 0, 0)),
    ]
    for x in (-0.2, 0.2):
        for y in (-0.2, 0.2):
            parts.append(cylinder(0.014, 0.44, (x, y, 0.22), "metal_dark", vertices=8))
    return join(parts, "meeting_chair")


def tv_screen():
    parts = [
        box((1.45, 0.05, 0.84), (0, 0, 0.42), "plastic_black", bevel=0.006),
        box((1.39, 0.004, 0.78), (0, -0.026, 0.42), "screen_black", bevel=0.0),
    ]
    return join(parts, "tv_screen")


def bean_bag():
    return join([sphere(0.4, (0, 0, 0.3), "fabric_orange", segments=20, rings=12, scale=(1.05, 1.0, 0.75)),
                 sphere(0.25, (0, 0.18, 0.55), "fabric_orange", segments=16, rings=8, scale=(1.3, 0.8, 0.8))],
                "bean_bag")


def fruit_bowl():
    parts = vessel(0.14, 0.07, (0, 0, 0.035), "wood_light", vertices=20, radius_top=0.18, wall=0.01)
    # Fruits resting in the bowl, one on top of the others.
    for i, color in enumerate(("red", "yellow", "green", "red")):
        angle = i / 4 * math.tau
        parts.append(sphere(0.045, (0.075 * math.cos(angle), 0.075 * math.sin(angle), 0.06), color, segments=10,
                            rings=6))
    parts.append(sphere(0.045, (0.0, 0.0, 0.11), "yellow", segments=10, rings=6))
    return join(parts, "fruit_bowl")


def planter_box():
    parts = [box((1.2, 0.35, 0.45), (0, 0, 0.225), "wood_dark", bevel=0.01)]
    for i in range(8):
        x = -0.5 + i * 0.14
        parts.append(ico(0.13, (x, 0, 0.5 + (i % 3) * 0.05), "leaf_green" if i % 2 else "leaf_light", subdivisions=1,
                         scale=(1, 0.9, 1.1)))
    return join(parts, "planter_box")


PROPS = {
    "sofa": sofa,
    "armchair": armchair,
    "coffee_table": coffee_table,
    "rug": rug,
    "water_cooler": water_cooler,
    "kitchen_counter": kitchen_counter,
    "coffee_machine": coffee_machine,
    "fridge": fridge,
    "microwave": microwave,
    "bar_stool": bar_stool,
    "high_table": high_table,
    "meeting_table": meeting_table,
    "meeting_chair": meeting_chair,
    "tv_screen": tv_screen,
    "bean_bag": bean_bag,
    "fruit_bowl": fruit_bowl,
    "planter_box": planter_box,
}
