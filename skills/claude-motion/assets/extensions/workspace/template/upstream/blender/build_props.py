"""Builds every prop and exports them into one GLB (one named mesh per prop).

Usage (from the repository root):
    Blender --background --python assets/blender/build_props.py -- [--preview out.png] [--only name,name]

The GLB is written to apps/web/public/models/props.glb. `--preview` renders a contact sheet.
"""

import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)

from lib.kit import export_glb, find_coplanar_overlaps, render_preview, reset_scene  # noqa: E402
from props import desk_set, lounge, outdoor, room  # noqa: E402

MODULES = [desk_set, room, lounge, outdoor]
OUTPUT = os.path.normpath(os.path.join(HERE, "..", "..", "apps", "web", "public", "models", "props.glb"))


def parse_args():
    argv = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
    options = {"preview": None, "only": None}
    for index, arg in enumerate(argv):
        if arg == "--preview":
            options["preview"] = os.path.abspath(argv[index + 1])
        if arg == "--only":
            options["only"] = set(argv[index + 1].split(","))
    return options


def main():
    options = parse_args()
    reset_scene()
    built = []
    overlaps = []
    for module in MODULES:
        for name, builder in module.PROPS.items():
            if options["only"] and name not in options["only"]:
                continue
            obj = builder()
            assert obj.name == name, f"prop {name} was named {obj.name}"
            built.append(obj)
            print(f"[props] {name}: {len(obj.data.vertices)} vertices")
            for first, second, height in find_coplanar_overlaps(obj):
                overlaps.append(f"{name}: {first} / {second} at z={height}")

    # Coplanar faces of two parts flicker in the browser (z-fighting): refuse to export them.
    for line in overlaps:
        print(f"[props] coplanar overlap: {line}")
    if overlaps:
        sys.exit(1)

    if not options["only"]:
        os.makedirs(os.path.dirname(OUTPUT), exist_ok=True)
        export_glb(OUTPUT, built)
        print(f"[props] exported {len(built)} props to {OUTPUT}")
    if options["preview"]:
        render_preview(options["preview"], built)
        print(f"[props] preview written to {options['preview']}")


main()
