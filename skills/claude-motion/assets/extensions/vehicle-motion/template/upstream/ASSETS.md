# Car assets

The five cars are the **Collect Car** models (`~/Collect Car/export/<car>.glb`, the same files as
Patrick's shared links): hypercar, wedge, rally, endurance and streamliner. They are show models, too
heavy and not split the way a crash game needs, so `scripts/prepare_cars.py` rebuilds each one for the
game:

```bash
scripts/blender.sh -b --python scripts/prepare_cars.py            # all five
scripts/blender.sh -b --python scripts/prepare_cars.py -- rally   # just one
```

It writes `game/public/models/cars/<id>.glb`, `blend/car-<id>.blend` and
`game/public/models/cars/cars.json` (sizes measured from the built model). The script:

- merges each wheel's parts (tyre, rim, disc, glowing ring...) into one object with its origin at the wheel
  centre, so the game can spin and steer it;
- splits glass, headlights, tail lights and glowing accents into their own objects;
- picks the parts that tear off in a crash (the `LOOSE` table: wings, splitters, diffusers, mirrors, skid
  plates, fins, louvres);
- joins the rest into `Body`, decimates the car from 70k–390k triangles down to 31k–60k, then splits long
  edges so the body has a vertex at least every 20 cm to dent;
- renames materials to the game's names and moves the origin between the axles, with the wheels on the
  ground.

## What the game expects

Units are metres. In Blender the nose points at −Y; in the GLB (Y-up) it points at **+Z**, and the car's
**left is +X**. The origin is on the ground, halfway between the axles. All parts are direct children of
an empty called `Car_<id>`.

| Object | What it is |
|---|---|
| `Body` | Everything that isn't listed below. It dents, and its vertices also shape the physics hull. |
| `Wheel_FL`, `Wheel_FR`, `Wheel_RL`, `Wheel_RR` | A whole wheel each. Origin at the wheel centre, axle along X, no rotation. |
| `Glass_Front`, `Glass_Rear`, `Glass_L`, `Glass_R`... | Glass. It cracks, then crazes into milky safety glass (none of these cars has an interior behind it). |
| `Light_F1..n`, `Light_R1..n` | Headlights and tail lights. They go dark when hit. |
| `Glow_1..n` | Neon accent strips in the car's accent colour (for example the streamliner's light line). |
| `Loose_*` | Parts that tear off and fall into the arena as debris. |
| `Number_*` (optional) | Number panels. If there are none, the game projects door and hood numbers onto `Body`. |

**Materials** are matched by name and replaced by the game's own:
`Paint` (the livery colour, stripes, scratches, rust and mud), `Trim`, `Carbon`, `Metal`, `Void`, `Glass`,
`Headlight`, `Taillight`, `Glow` (the accent colour, also used on the hypercar's and streamliner's wheel
rings), `Rim`, `Tire`.

**Denting:** the game moves vertices near each hit, so `Body` needs evenly spread vertices. That is what the
densify step in the script is for. Budget: about 15k body triangles before densifying, and up to about
60k for the whole car.

## Liveries

Colours are not baked into the model. Each car has a default livery in `game/src/car/specs.ts` (paint,
neon accent, stripe style), and the garage lets the player change all three per car. AI cars get random
liveries.
