"""Room furniture and fixtures."""

import math
import random

from lib.kit import box, cylinder, ico, join, sphere, torus, vessel

BOOK_COLORS = ["book_1", "book_2", "book_3", "book_4", "book_5", "book_6", "paper"]


def _books(rng, x_start, x_end, z, depth, parts, max_height=0.28):
    x = x_start
    while x < x_end - 0.03:
        thickness = rng.uniform(0.018, 0.045)
        if x + thickness > x_end:
            break
        height = rng.uniform(0.17, max_height)
        if rng.random() < 0.12:
            x += rng.uniform(0.04, 0.12)  # Gap on the shelf.
            continue
        tilt = rng.uniform(-8, 0) if rng.random() < 0.08 else 0
        parts.append(box((thickness, depth * rng.uniform(0.7, 0.9), height), (x + thickness / 2, 0, z + height / 2),
                         rng.choice(BOOK_COLORS), bevel=0.002, rotation=(0, tilt, 0)))
        x += thickness + 0.002


def bookshelf():
    rng = random.Random(11)
    width, depth, height = 0.9, 0.32, 1.85
    parts = [
        box((0.025, depth, height), (-width / 2 + 0.0125, 0, height / 2), "wood_mid", bevel=0.003),
        box((0.025, depth, height), (width / 2 - 0.0125, 0, height / 2), "wood_mid", bevel=0.003),
        # Back panel between the sides and under the top board, never flush with them.
        box((width - 0.05, 0.012, height - 0.025), (0, depth / 2 - 0.006, (height - 0.025) / 2), "wood_dark",
            bevel=0.0),
    ]
    shelves = [0.06, 0.42, 0.78, 1.14, 1.5, height - 0.0125]
    for z in shelves:
        parts.append(box((width - 0.05, depth - 0.01, 0.025), (0, -0.005, z), "wood_mid", bevel=0.003))
    for z in shelves[:-1]:
        if rng.random() < 0.8:
            _books(rng, -width / 2 + 0.03, width / 2 - 0.03, z + 0.0125, depth, parts)
        else:
            parts.append(box((0.3, 0.25, 0.2), (0.15, 0, z + 0.11), "cardboard", bevel=0.004))
            parts.append(ico(0.07, (-0.2, 0, z + 0.1), "leaf_green", subdivisions=1))
    return join(parts, "bookshelf")


def filing_cabinet():
    parts = [box((0.45, 0.6, 1.02), (0, 0, 0.51), "metal_light", bevel=0.006)]
    for z in (0.18, 0.51, 0.84):
        parts.append(box((0.42, 0.01, 0.3), (0, -0.302, z), "metal_light", bevel=0.004))
        parts.append(box((0.14, 0.025, 0.02), (0, -0.315, z + 0.08), "metal_dark", bevel=0.004))
        parts.append(box((0.08, 0.004, 0.035), (0, -0.308, z + 0.12), "paper", bevel=0.0))
    return join(parts, "filing_cabinet")


def trash_bin():
    parts = [
        *vessel(0.14, 0.32, (0, 0, 0.16), "plastic_gray", vertices=20, radius_top=0.16, wall=0.008,
                fill=(0.12, "plastic_black")),
        # Crumpled paper on the bag.
        ico(0.04, (0.03, 0.02, 0.15), "paper", subdivisions=1, scale=(1, 0.9, 0.8), rotation=(20, 30, 10)),
        ico(0.03, (-0.05, -0.03, 0.14), "paper", subdivisions=1, rotation=(-10, 50, 0)),
    ]
    return join(parts, "trash_bin")


def plant_tall():
    rng = random.Random(21)
    parts = [
        *vessel(0.17, 0.42, (0, 0, 0.21), "ceramic_white", vertices=20, radius_top=0.2, wall=0.012,
                fill=(0.39, "soil")),
    ]
    for i in range(9):
        angle = i / 9 * math.tau + rng.uniform(-0.2, 0.2)
        height = rng.uniform(0.7, 1.35)
        lean = rng.uniform(10, 28)
        stem_len = height - 0.4
        cx = math.cos(angle) * math.sin(math.radians(lean)) * stem_len / 2
        cy = math.sin(angle) * math.sin(math.radians(lean)) * stem_len / 2
        parts.append(cylinder(0.008, stem_len, (cx, cy, 0.4 + stem_len / 2), "leaf_dark", vertices=6,
                              rotation=(-lean * math.sin(angle), lean * math.cos(angle), 0)))
        parts.append(ico(0.16, (cx * 2, cy * 2, height), "leaf_green" if i % 3 else "leaf_dark", subdivisions=1,
                         scale=(1.0, 0.25, 0.7), rotation=(rng.uniform(-30, 30), rng.uniform(-20, 20),
                                                           math.degrees(angle) + 90)))
    return join(parts, "plant_tall")


def plant_snake():
    rng = random.Random(5)
    parts = vessel(0.13, 0.3, (0, 0, 0.15), "terracotta", vertices=16, radius_top=0.15, wall=0.01,
                   fill=(0.27, "soil"))
    for i in range(11):
        angle = rng.uniform(0, math.tau)
        radius = rng.uniform(0, 0.08)
        height = rng.uniform(0.35, 0.7)
        parts.append(ico(0.05, (radius * math.cos(angle), radius * math.sin(angle), 0.3 + height / 2),
                         "leaf_dark" if i % 2 else "leaf_light", subdivisions=1, scale=(0.6, 0.25, height / 0.1),
                         rotation=(rng.uniform(-8, 8), rng.uniform(-8, 8), math.degrees(angle))))
    return join(parts, "plant_snake")


def ceiling_light():
    parts = [
        box((1.2, 0.3, 0.05), (0, 0, 0.025), "metal_light", bevel=0.005),
        box((1.14, 0.24, 0.006), (0, 0, -0.002), "light_warm", bevel=0.0),
    ]
    return join(parts, "ceiling_light")


def floor_lamp():
    parts = [
        cylinder(0.16, 0.025, (0, 0, 0.0125), "metal_dark", vertices=24),
        cylinder(0.012, 1.45, (0, 0, 0.74), "metal_dark", vertices=10),
        cylinder(0.2, 0.28, (0, 0, 1.5), "fabric_beige", vertices=24, radius_top=0.14),
        sphere(0.05, (0, 0, 1.42), "light_warm", segments=10, rings=6),
    ]
    return join(parts, "floor_lamp")


def printer():
    parts = [
        box((0.5, 0.42, 0.3), (0, 0, 0.15), "plastic_white", bevel=0.01),
        box((0.36, 0.2, 0.012), (0, -0.25, 0.14), "plastic_gray", bevel=0.003),
        box((0.34, 0.26, 0.04), (0, 0.02, 0.31), "plastic_gray", bevel=0.006),
        box((0.1, 0.012, 0.05), (0.17, -0.21, 0.25), "plastic_black", bevel=0.002),
        box((0.21, 0.28, 0.01), (0, -0.2, 0.15), "paper", bevel=0.0),
    ]
    return join(parts, "printer")


def printer_stand():
    parts = [box((0.6, 0.5, 0.7), (0, 0, 0.35), "wood_mid", bevel=0.006)]
    parts.append(box((0.56, 0.01, 0.3), (0, -0.25, 0.47), "wood_light", bevel=0.003))
    parts.append(box((0.56, 0.01, 0.3), (0, -0.25, 0.16), "wood_light", bevel=0.003))
    return join(parts, "printer_stand")


def coat_rack():
    parts = [
        cylinder(0.2, 0.03, (0, 0, 0.015), "metal_dark", vertices=20),
        cylinder(0.018, 1.75, (0, 0, 0.89), "wood_dark", vertices=10),
        sphere(0.03, (0, 0, 1.77), "wood_dark", segments=10, rings=6),
    ]
    for i in range(4):
        angle = i * 90
        parts.append(cylinder(0.01, 0.16, (0.06 * math.cos(math.radians(angle)), 0.06 * math.sin(math.radians(angle)),
                                           1.64), "wood_dark", vertices=8, rotation=(0, 55, angle)))
    # A coat hanging from one hook: narrow shoulders, wider hem.
    parts.append(cylinder(0.13, 0.7, (0.1, 0, 1.25), "fabric_green", vertices=12, radius_top=0.075,
                          rotation=(0, 4, 0)))
    parts.append(sphere(0.06, (0.09, 0, 1.6), "fabric_green", segments=10, rings=6, scale=(1.3, 0.8, 0.6)))
    return join(parts, "coat_rack")


def wall_clock():
    parts = [
        cylinder(0.17, 0.04, (0, 0, 0), "plastic_black", vertices=32, rotation=(90, 0, 0)),
        cylinder(0.155, 0.006, (0, -0.02, 0), "plastic_white", vertices=32, rotation=(90, 0, 0)),
    ]
    for i in range(12):
        angle = math.radians(i * 30)
        length = 0.03 if i % 3 == 0 else 0.015
        parts.append(box((0.008, 0.004, length), (0.13 * math.sin(angle), -0.024, 0.13 * math.cos(angle)),
                         "plastic_black", bevel=0.0, rotation=(0, math.degrees(angle), 0)))
    return join(parts, "wall_clock")


def radiator():
    parts = []
    for i in range(14):
        parts.append(box((0.045, 0.08, 0.55), (-0.33 + i * 0.05, 0, 0.35), "wall_white", bevel=0.01))
    parts.append(box((0.72, 0.02, 0.02), (0, 0, 0.1), "wall_white", bevel=0.004))
    parts.append(box((0.72, 0.02, 0.02), (0, 0, 0.6), "wall_white", bevel=0.004))
    return join(parts, "radiator")


def fire_extinguisher():
    parts = [
        cylinder(0.075, 0.45, (0, 0, 0.225), "red", vertices=16),
        sphere(0.075, (0, 0, 0.45), "red", segments=16, rings=8, scale=(1, 1, 0.5)),
        cylinder(0.02, 0.06, (0, 0, 0.5), "plastic_black", vertices=8),
        box((0.1, 0.03, 0.02), (0.03, 0, 0.54), "plastic_black", bevel=0.003),
        cylinder(0.01, 0.25, (0.07, -0.03, 0.35), "plastic_black", vertices=6, rotation=(0, 15, 0)),
        box((0.09, 0.004, 0.12), (0, -0.076, 0.25), "paper", bevel=0.0),
    ]
    return join(parts, "fire_extinguisher")


def door():
    """Door leaf with handle, 0.9 x 2.1, hinge on the left; the frame is built by the web client."""
    parts = [
        box((0.88, 0.045, 2.08), (0, 0, 1.04), "wood_light", bevel=0.004),
        box((0.3, 0.004, 0.6), (0, -0.024, 1.45), "glass", bevel=0.0),
        cylinder(0.025, 0.02, (0.36, -0.035, 1.02), "chrome", vertices=12, rotation=(90, 0, 0)),
        box((0.12, 0.018, 0.018), (0.31, -0.05, 1.02), "chrome", bevel=0.004),
    ]
    return join(parts, "door")


def storage_boxes():
    rng = random.Random(2)
    parts = []
    z = 0
    for i in range(3):
        w, d, h = 0.5 - i * 0.06, 0.38 - i * 0.03, 0.28 - i * 0.03
        parts.append(box((w, d, h), (rng.uniform(-0.03, 0.03), rng.uniform(-0.02, 0.02), z + h / 2), "cardboard",
                         bevel=0.004, rotation=(0, 0, rng.uniform(-6, 6))))
        parts.append(box((w * 0.9, 0.004, 0.006), (0, -d / 2 - 0.001, z + h * 0.65), "paper", bevel=0.0))
        z += h
    return join(parts, "storage_boxes")


def umbrella_stand():
    parts = vessel(0.12, 0.5, (0, 0, 0.25), "metal_dark", vertices=16, wall=0.004)
    for i, color in enumerate(("blue", "red", "plastic_black")):
        angle = i / 3 * math.tau
        parts.append(cylinder(0.01, 0.85, (0.04 * math.cos(angle), 0.04 * math.sin(angle), 0.55), "plastic_black",
                              vertices=6, rotation=(8 * math.sin(angle), 8 * math.cos(angle), 0)))
        parts.append(cylinder(0.035, 0.4, (0.06 * math.cos(angle), 0.06 * math.sin(angle), 0.8), color, vertices=8,
                              radius_top=0.012, rotation=(8 * math.sin(angle), 8 * math.cos(angle), 0)))
    return join(parts, "umbrella_stand")


def wall_shelf():
    rng = random.Random(4)
    parts = [box((0.9, 0.22, 0.025), (0, 0, 0.0125), "wood_mid", bevel=0.003)]
    for x in (-0.35, 0.35):
        parts.append(box((0.02, 0.15, 0.12), (x, 0.03, -0.06), "metal_dark", bevel=0.002))
    _books(rng, -0.42, 0.05, 0.025, 0.2, parts, max_height=0.22)
    parts.append(cylinder(0.05, 0.08, (0.22, 0, 0.065), "ceramic_white", vertices=14))
    parts.append(ico(0.06, (0.22, 0, 0.14), "leaf_green", subdivisions=1, scale=(1, 1, 0.8)))
    return join(parts, "wall_shelf")


def poster(name, colors):
    """Framed abstract print (0.6 x 0.8) hung on a wall; faces -Y."""
    parts = [
        box((0.62, 0.025, 0.82), (0, 0, 0), "plastic_black", bevel=0.003),
        box((0.56, 0.004, 0.76), (0, -0.013, 0), "paper", bevel=0.0),
    ]
    rng = random.Random(sum(map(ord, name)))
    for index, color in enumerate(colors):
        w, h = rng.uniform(0.12, 0.4), rng.uniform(0.12, 0.45)
        x, z = rng.uniform(-0.25 + w / 2, 0.25 - w / 2), rng.uniform(-0.35 + h / 2, 0.35 - h / 2)
        # Each shape stands 2 mm in front of the previous one: overlapping shapes in one plane flicker.
        y = -0.016 - index * 0.002
        if rng.random() < 0.4:
            parts.append(cylinder(min(w, h) / 2, 0.002, (x, y, z), color, vertices=24, rotation=(90, 0, 0)))
        else:
            parts.append(box((w, 0.002, h), (x, y, z), color, bevel=0.0))
    return join(parts, name)


def poster_a():
    return poster("poster_a", ["fabric_orange", "book_4", "book_1"])


def poster_b():
    return poster("poster_b", ["book_3", "book_6", "ceramic_yellow"])


def poster_c():
    return poster("poster_c", ["book_5", "fabric_orange", "book_3", "book_1"])


PROPS = {
    "bookshelf": bookshelf,
    "filing_cabinet": filing_cabinet,
    "trash_bin": trash_bin,
    "plant_tall": plant_tall,
    "plant_snake": plant_snake,
    "ceiling_light": ceiling_light,
    "floor_lamp": floor_lamp,
    "printer": printer,
    "printer_stand": printer_stand,
    "coat_rack": coat_rack,
    "wall_clock": wall_clock,
    "radiator": radiator,
    "fire_extinguisher": fire_extinguisher,
    "door": door,
    "storage_boxes": storage_boxes,
    "umbrella_stand": umbrella_stand,
    "wall_shelf": wall_shelf,
    "poster_a": poster_a,
    "poster_b": poster_b,
    "poster_c": poster_c,
}
