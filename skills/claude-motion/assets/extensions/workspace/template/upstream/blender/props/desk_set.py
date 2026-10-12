"""Everything found on and around a workstation."""

import math
import random

from lib.kit import box, cylinder, ico, join, polyhedron, rod, sphere, torus, vessel

DESK_HEIGHT = 0.74


def desk():
    parts = [box((1.5, 0.75, 0.035), (0, 0, DESK_HEIGHT - 0.0175), "wood_light", bevel=0.006, segments=3)]
    for x in (-0.68, 0.68):
        for y in (-0.3, 0.3):
            parts.append(box((0.05, 0.05, 0.705), (x, y, 0.3525), "metal_dark", bevel=0.004))
        parts.append(box((0.06, 0.7, 0.03), (x, 0, 0.015), "metal_dark", bevel=0.006))
        parts.append(box((0.04, 0.66, 0.04), (x, 0, 0.68), "metal_dark", bevel=0.004))
    parts.append(box((1.3, 0.03, 0.09), (0, 0.3, 0.63), "metal_dark", bevel=0.004))
    # Drawer pedestal on the right, drawers facing the person sitting at the desk (front, -Y).
    parts.append(box((0.4, 0.5, 0.52), (0.44, -0.04, 0.28), "wood_mid", bevel=0.006))
    for z in (0.12, 0.29, 0.46):
        parts.append(box((0.37, 0.012, 0.15), (0.44, -0.295, z), "wood_light", bevel=0.003))
        parts.append(box((0.12, 0.02, 0.015), (0.44, -0.305, z + 0.04), "metal_light", bevel=0.003))
    parts.append(cylinder(0.03, 0.004, (0.55, 0.28, DESK_HEIGHT + 0.001), "plastic_black", vertices=16))
    return join(parts, "desk")


def office_chair():
    parts = []
    for i in range(5):
        angle = math.radians(i * 72 + 90)
        parts.append(box((0.3, 0.05, 0.035), (0.14 * math.cos(angle), 0.14 * math.sin(angle), 0.085),
                         "plastic_black", bevel=0.008, rotation=(0, 0, math.degrees(angle))))
        parts.append(sphere(0.028, (0.28 * math.cos(angle), 0.28 * math.sin(angle), 0.03), "rubber", segments=10,
                            rings=6))
    parts.append(cylinder(0.05, 0.06, (0, 0, 0.09), "plastic_black", vertices=16))
    parts.append(cylinder(0.024, 0.28, (0, 0, 0.26), "chrome", vertices=12))
    parts.append(box((0.22, 0.22, 0.04), (0, 0, 0.405), "plastic_black", bevel=0.006))
    parts.append(box((0.5, 0.48, 0.08), (0, 0, 0.465), "fabric_dark", bevel=0.03, segments=3))
    parts.append(box((0.07, 0.04, 0.34), (0, 0.24, 0.56), "plastic_black", bevel=0.01))
    parts.append(box((0.46, 0.07, 0.56), (0, 0.27, 0.86), "fabric_dark", bevel=0.03, segments=3,
                     rotation=(-8, 0, 0)))
    for x in (-0.27, 0.27):
        parts.append(box((0.035, 0.04, 0.2), (x, 0.03, 0.56), "plastic_black", bevel=0.006))
        parts.append(box((0.06, 0.25, 0.03), (x, 0.0, 0.665), "plastic_black", bevel=0.01))
    return join(parts, "office_chair")


def monitor():
    parts = [
        box((0.24, 0.17, 0.012), (0, 0.01, 0.006), "metal_dark", bevel=0.004),
        box((0.05, 0.03, 0.24), (0, 0.035, 0.13), "metal_dark", bevel=0.006),
        box((0.64, 0.028, 0.385), (0, 0.0, 0.335), "plastic_black", bevel=0.005),
        # Screen surface; the web client overlays the live terminal preview on it.
        box((0.605, 0.004, 0.345), (0, -0.0145, 0.338), "screen_black", bevel=0.0),
    ]
    return join(parts, "monitor")


# ---- keyboard -------------------------------------------------------------------------------------

KEY_PITCH = 0.019  # One key unit (u), as on a real keyboard.
KEY_GAP = 0.0012  # Space between two keycaps at their base.
KEY_TAPER = 0.0029  # A keycap's top is that much smaller than its base on each side.
KEY_HEIGHT = 0.0062
KEYBOARD_MARGIN = (0.011, 0.01)  # Case border around the keys: sides, front/back.
KEYBOARD_HEIGHT = (0.01, 0.021)  # Case thickness at the front and at the back (it slopes up).

# ANSI full-size layout, rows from the front (space bar) to the back (function keys). Each entry is
# (width in u, color); a width of None is a gap of `color` u. Main block 15u, arrows/navigation 3u,
# numeric keypad 4u, with 0.25u between blocks.
_M, _A = "key_mid", "key_dark"  # Modifiers and function keys / letters and digits.
MAIN_ROWS = [
    [(1.25, _M), (1.25, _M), (1.25, _M), (6.25, _A), (1.25, _M), (1.25, _M), (1.25, _M), (1.25, _M)],
    [(2.25, _M)] + [(1, _A)] * 10 + [(2.75, _M)],
    [(1.75, _M)] + [(1, _A)] * 11 + [(2.25, _M)],
    [(1.5, _M)] + [(1, _A)] * 12 + [(1.5, _A)],
    [(1, _A)] * 13 + [(2, _M)],
]
FUNCTION_ROW = [(1, _M), (None, 1)] + [(1, _M)] * 4 + [(None, 0.5)] + [(1, _M)] * 4 + [(None, 0.5)] + [(1, _M)] * 4
NAVIGATION_ROWS = [  # Same row order; None for an empty spot.
    [(0, 1), (1, 1), (2, 1)],  # Arrows: left, down, right.
    [(1, 1)],  # Up.
    [],
    [(0, 1), (1, 1), (2, 1)],  # Delete, End, Page down.
    [(0, 1), (1, 1), (2, 1)],  # Insert, Home, Page up.
]
# Numeric keypad: (column, row from the front, width, height) in u.
KEYPAD = [(0, 0, 2, 1), (2, 0, 1, 1), (3, 0, 1, 2)] + [(c, 1, 1, 1) for c in range(3)] + \
    [(c, 2, 1, 1) for c in range(3)] + [(c, 3, 1, 1) for c in range(3)] + [(3, 2, 1, 2)] + \
    [(c, 4, 1, 1) for c in range(4)]
KEYPAD_OPERATORS = {(3, 0), (3, 2), (0, 4), (1, 4), (2, 4), (3, 4)}  # Enter, +, Num Lock, /, *, -.


def keyboard():
    width_u = 15 + 0.25 + 3 + 0.25 + 4
    depth_u = 6.5  # Five rows, half a row of gap, the function row.
    side, edge = KEYBOARD_MARGIN
    width = width_u * KEY_PITCH + 2 * side
    depth = depth_u * KEY_PITCH + 2 * edge
    front, back = -depth / 2, depth / 2  # The front faces the typist (-Y).
    low, high = KEYBOARD_HEIGHT

    def surface(y):
        """Height of the case's top at `y`: it slopes up toward the back."""
        return low + (y - front) / (back - front) * (high - low)

    case = polyhedron(
        [(-width / 2, front, 0), (width / 2, front, 0), (width / 2, back, 0), (-width / 2, back, 0),
         (-width / 2, front, low), (width / 2, front, low), (width / 2, back, high), (-width / 2, back, high)],
        [(0, 3, 2, 1), (4, 5, 6, 7), (0, 1, 5, 4), (1, 2, 6, 5), (2, 3, 7, 6), (3, 0, 4, 7)],
        "plastic_silver", bevel=0.003, segments=2, smooth=True, name="keyboard_case",
    )

    caps = {_M: ([], []), _A: ([], [])}

    def key(x_u, row, w_u, color, h_u=1.0):
        """A tapered keycap: `x_u` from the left edge of the keys, `row` from the front."""
        x0 = -width / 2 + side + x_u * KEY_PITCH + KEY_GAP / 2
        x1 = x0 + w_u * KEY_PITCH - KEY_GAP
        y0 = front + edge + row * KEY_PITCH + KEY_GAP / 2
        y1 = y0 + h_u * KEY_PITCH - KEY_GAP
        vertices, faces = caps[color]
        base = len(vertices)
        # Base slightly sunk into the case; top parallel to the case's slope.
        for x, y in ((x0, y0), (x1, y0), (x1, y1), (x0, y1)):
            vertices.append((x, y, surface(y) - 0.001))
        for x, y in ((x0 + KEY_TAPER, y0 + KEY_TAPER), (x1 - KEY_TAPER, y0 + KEY_TAPER),
                     (x1 - KEY_TAPER, y1 - KEY_TAPER), (x0 + KEY_TAPER, y1 - KEY_TAPER)):
            vertices.append((x, y, surface(y) + KEY_HEIGHT))
        faces += [
            (base + 4, base + 5, base + 6, base + 7),  # Top.
            (base + 0, base + 1, base + 5, base + 4),
            (base + 1, base + 2, base + 6, base + 5),
            (base + 2, base + 3, base + 7, base + 6),
            (base + 3, base + 0, base + 4, base + 7),
        ]

    for row, entries in enumerate(MAIN_ROWS):
        x = 0.0
        for w, color in entries:
            key(x, row, w, color)
            x += w
    x = 0.0
    for w, value in FUNCTION_ROW:
        if w is None:
            x += value
            continue
        key(x, 5.5, w, value)
        x += w
    nav = 15.25
    for row, entries in enumerate(NAVIGATION_ROWS):
        for column, w in entries:
            key(nav + column, row, w, _M)
    for column in range(3):  # Print Screen, Scroll Lock, Pause.
        key(nav + column, 5.5, 1, _M)
    pad = nav + 3.25
    for column, row, w, h in KEYPAD:
        key(pad + column, row, w, _M if (column, row) in KEYPAD_OPERATORS else _A, h)

    parts = [case]
    for color, (vertices, faces) in caps.items():
        parts.append(polyhedron(vertices, faces, color, smooth=True, name=f"keycaps_{color}"))
    return join(parts, "keyboard")


MOUSE_LENGTH = 0.105
MOUSE_WIDTH = 0.062
MOUSE_HEIGHT = 0.036


def _mouse_section(t):
    """Half width and height of the mouse at `t` (0 = front tip, 1 = back): higher under the palm."""
    t = min(max(t, 0.0), 1.0)
    width = MOUSE_WIDTH / 2 * math.sin(math.pi * t ** 1.1) ** 0.4
    height = MOUSE_HEIGHT * math.sin(math.pi * t ** 1.3) ** 0.5
    return width, height


def _mouse_point(t, a, lift=0.0):
    """Surface point at `t` along the mouse and angle `a` (0 = right side, pi = left side)."""
    width, height = _mouse_section(t)
    c, s = math.cos(a), math.sin(a)
    # Superellipse cross-section: rounder than a box, fuller than an ellipse.
    x = math.copysign(abs(c) ** 0.75, c) * width
    z = abs(s) ** 0.75 * height
    # Built with the buttons toward -Y, then turned around (see `_turned`).
    y = -MOUSE_LENGTH / 2 + t * MOUSE_LENGTH
    return (x, y, z + lift)


def _turned(points):
    """Half a turn around Z: the buttons point at the screen (+Y), the palm rests near the typist."""
    return [(-x, -y, z) for x, y, z in points]


def mouse():
    """A mouse: egg-shaped shell, a groove between the two buttons and across their back, a wheel."""
    steps, around = 24, 16
    # Denser toward both tips, so they come out rounded.
    ts = [0.004 + 0.992 * (1 - math.cos(math.pi * i / (steps - 1))) / 2 for i in range(steps)]
    vertices, faces = [], []
    for t in ts:
        for j in range(around + 1):
            vertices.append(_mouse_point(t, math.pi * j / around))
    ring = around + 1
    for i in range(steps - 1):
        for j in range(around):
            a, b = i * ring + j, (i + 1) * ring + j
            faces.append((a, a + 1, b + 1, b))
    # Close both tips.
    front = len(vertices)
    vertices.append((0.0, -MOUSE_LENGTH / 2, 0.0))
    back = len(vertices)
    vertices.append((0.0, MOUSE_LENGTH / 2, 0.0))
    for j in range(around):
        faces.append((front, j + 1, j))
        last = (steps - 1) * ring
        faces.append((back, last + j, last + j + 1))
    shell = polyhedron(_turned(vertices), faces, "plastic_white", smooth=True, name="mouse_shell")

    # Grooves drawn as thin dark strips just above the surface.
    lift, half = 0.0009, 0.0007
    split = 0.42
    strip_vertices, strip_faces = [], []

    def strip(points):
        base = len(strip_vertices)
        strip_vertices.extend(points)
        for k in range(0, len(points) - 2, 2):
            strip_faces.append((base + k, base + k + 1, base + k + 3, base + k + 2))

    along = []
    for i in range(9):
        t = 0.05 + (split - 0.05) * i / 8
        _, height = _mouse_section(t)
        y = -MOUSE_LENGTH / 2 + t * MOUSE_LENGTH
        along += [(-half, y, height + lift), (half, y, height + lift)]
    strip(along)
    across = []
    for j in range(3, around - 2):
        a = math.pi * j / around
        x, y, z = _mouse_point(split, a, lift)
        across += [(x, y - half, z), (x, y + half, z)]
    strip(across)
    grooves = polyhedron(_turned(strip_vertices), strip_faces, "key_mid", smooth=False, name="mouse_grooves")

    wheel_t = 0.24
    _, wheel_top = _mouse_section(wheel_t)
    wheel = cylinder(0.0075, 0.005, (0, MOUSE_LENGTH / 2 - wheel_t * MOUSE_LENGTH, wheel_top - 0.0045),
                     "key_dark", vertices=16, rotation=(0, 90, 0))
    return join([shell, grooves, wheel], "mouse")


def mug(name="mug", color="ceramic_white"):
    parts = [
        *vessel(0.04, 0.095, (0, 0, 0.0475), color, vertices=20, wall=0.004, fill=(0.078, "coffee")),
        torus(0.025, 0.007, (0.045, 0, 0.05), color, rotation=(90, 0, 0)),
    ]
    return join(parts, name)


def mug_blue():
    return mug("mug_blue", "ceramic_blue")


def mug_yellow():
    return mug("mug_yellow", "ceramic_yellow")


def desk_lamp():
    elbow = (0, 0.06, 0.4)
    head = (0, -0.16, 0.45)
    parts = [
        cylinder(0.075, 0.02, (0, 0, 0.01), "metal_dark", vertices=24),
        sphere(0.018, (0, 0, 0.03), "metal_dark", segments=10, rings=6),
        rod((0, 0, 0.03), elbow, 0.011),
        sphere(0.016, elbow, "metal_dark", segments=10, rings=6),
        rod(elbow, head, 0.009),
        # Shade: a cone pointing down toward the desk.
        cylinder(0.025, 0.09, (head[0], head[1], head[2] - 0.035), "metal_dark", vertices=20, radius_top=0.07,
                 rotation=(180, 0, 0)),
        sphere(0.026, (head[0], head[1], head[2] - 0.075), "light_warm", segments=12, rings=8),
    ]
    return join(parts, "desk_lamp")


def plant_small():
    rng = random.Random(7)
    parts = [
        *vessel(0.06, 0.09, (0, 0, 0.045), "terracotta", vertices=16, radius_top=0.07, wall=0.006,
                fill=(0.075, "soil")),
    ]
    for i in range(7):
        angle = i / 7 * math.tau
        parts.append(ico(0.035, (0.03 * math.cos(angle), 0.03 * math.sin(angle), 0.11 + rng.random() * 0.03),
                         "leaf_light" if i % 2 else "leaf_green", subdivisions=1, scale=(0.6, 0.6, 1.4),
                         rotation=(math.degrees(0.4 * math.sin(angle)), math.degrees(0.4 * math.cos(angle)), 0)))
    return join(parts, "plant_small")


def notebook():
    parts = [
        box((0.15, 0.21, 0.012), (0, 0, 0.006), "book_1", bevel=0.002),
        box((0.14, 0.2, 0.01), (0.004, 0, 0.006), "paper", bevel=0.0),
        box((0.004, 0.2, 0.014), (-0.074, 0, 0.007), "metal_dark", bevel=0.0),
    ]
    return join(parts, "notebook")


def pen_holder():
    parts = vessel(0.035, 0.1, (0, 0, 0.05), "metal_dark", vertices=16, wall=0.003)
    for i, color in enumerate(("blue", "red", "plastic_black", "yellow")):
        angle = i / 4 * math.tau
        parts.append(cylinder(0.005, 0.15, (0.015 * math.cos(angle), 0.015 * math.sin(angle), 0.1), color,
                              vertices=6, rotation=(8 * math.sin(angle), 8 * math.cos(angle), 0)))
    return join(parts, "pen_holder")


def headphones():
    parts = [
        torus(0.085, 0.009, (0, 0, 0.1), "plastic_black", rotation=(90, 0, 0)),
        cylinder(0.04, 0.035, (-0.085, 0, 0.04), "plastic_black", vertices=16, rotation=(0, 90, 0)),
        cylinder(0.04, 0.035, (0.085, 0, 0.04), "plastic_black", vertices=16, rotation=(0, 90, 0)),
    ]
    return join(parts, "headphones")


def water_bottle():
    parts = [
        cylinder(0.035, 0.2, (0, 0, 0.1), "metal_light", vertices=16),
        cylinder(0.025, 0.03, (0, 0, 0.215), "plastic_black", vertices=16),
    ]
    return join(parts, "water_bottle")


def paper_stack():
    rng = random.Random(3)
    parts = []
    for i in range(6):
        parts.append(box((0.21, 0.297, 0.004), (rng.uniform(-0.01, 0.01), rng.uniform(-0.01, 0.01), 0.002 + i * 0.004),
                         "paper", bevel=0.0, rotation=(0, 0, rng.uniform(-6, 6))))
    return join(parts, "paper_stack")


def sticky_notes():
    parts = [box((0.076, 0.076, 0.02), (0, 0, 0.01), "yellow", bevel=0.001)]
    return join(parts, "sticky_notes")


def laptop():
    parts = [
        box((0.32, 0.22, 0.012), (0, 0, 0.006), "metal_light", bevel=0.004),
        box((0.28, 0.1, 0.002), (0, -0.02, 0.013), "plastic_gray", bevel=0.0),
        box((0.32, 0.012, 0.21), (0, 0.105, 0.11), "metal_light", bevel=0.004, rotation=(-15, 0, 0)),
        box((0.29, 0.002, 0.18), (0, 0.097, 0.112), "screen_black", bevel=0.0, rotation=(-15, 0, 0)),
    ]
    return join(parts, "laptop")


PROPS = {
    "desk": desk,
    "office_chair": office_chair,
    "monitor": monitor,
    "keyboard": keyboard,
    "mouse": mouse,
    "mug": mug,
    "mug_blue": mug_blue,
    "mug_yellow": mug_yellow,
    "desk_lamp": desk_lamp,
    "plant_small": plant_small,
    "notebook": notebook,
    "pen_holder": pen_holder,
    "headphones": headphones,
    "water_bottle": water_bottle,
    "paper_stack": paper_stack,
    "sticky_notes": sticky_notes,
    "laptop": laptop,
}
