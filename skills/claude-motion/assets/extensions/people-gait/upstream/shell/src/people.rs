//! The hall's people as sprites.
//!
//! A figure is drawn with shapes at four times its size, from a skeleton posed
//! by the joint angles of a real walk, then brought down to one pixel a block
//! by the commonest colour, cleaned, given a grain, a head drawn by hand and a
//! selective outline. That is the method the sprites of the adventure games of
//! the early nineties can be measured to follow, Indy's in Fate of Atlantis in
//! particular:
//!
//! - no outline round the figure: the shape is held by the darkest tone of
//!   each material on the side away from the light, the lit side left open;
//! - every material in four tones, lit from the upper left, the shadows
//!   drifting cool and the light warm, cloth broken into clusters;
//! - a head drawn pixel by pixel, because at nine pixels across a face
//!   reduced from shapes is noise.
//!
//! A sprite is drawn at fifty pixels tall, cached, and scaled to the depth it
//! stands at by the caller, as SCUMM scaled its actors.

use std::f32::consts::TAU;

use crate::fb::{Color, lerp_color};

/// How tall a sprite is drawn, in pixels, and how many times larger its
/// shapes are drawn before they are reduced. The hall's people stand between
/// 63 and 73 pixels tall, so a sprite drawn at 68 is scaled by less than a
/// tenth either way and nearly every pixel lands on one pixel: drawn smaller
/// and enlarged by a third, one pixel in three came out doubled and the heads
/// drawn by hand lost their shape.
pub const HEIGHT: i32 = 68;
const SS: i32 = 4;
/// The sprite's size, and where its feet are in it.
pub const W: i32 = 62;
pub const H: i32 = HEIGHT + 8;
pub const FOOT: (i32, i32) = (W / 2, H - 4);

/// A person's colours. Each becomes four tones.
#[derive(Clone, Copy, PartialEq)]
pub struct Palette {
    pub skin: Color,
    pub hair: Color,
    pub top: Color,
    pub shirt: Color,
    pub legs: Color,
    pub shoes: Color,
    pub mullet: bool,
    pub cap: Option<Color>,
}

/// What a figure is doing, as far as the drawing cares.
#[derive(Clone, Copy, PartialEq, Debug)]
pub enum View {
    /// In profile, walking or standing; `true` facing right.
    Side(bool),
    Toward,
    Away,
}

#[derive(Clone, Copy, PartialEq, Debug)]
pub enum Act {
    Walk,
    Play,
    Cheer,
    Over,
    Mop,
    /// Walking with the mop in one hand, its head off the floor.
    Carry,
}

pub struct Sprite {
    pub px: Vec<Option<Color>>,
    /// Where the mop's head touches the floor, in sprite pixels from the feet.
    pub mop: Option<(f32, f32)>,
}

impl Sprite {
    pub fn at(&self, x: i32, y: i32) -> Option<Color> {
        if x < 0 || y < 0 || x >= W || y >= H {
            return None;
        }
        self.px[(y * W + x) as usize]
    }
}

/// The sagittal joint angles of an ordinary walk through one stride, every
/// five per cent from the heel striking, after the normative curves of
/// Winter's gait laboratory: hip flexion, knee flexion, ankle dorsiflexion,
/// in degrees. What they say that drawn poses got wrong: the knee gives by
/// fifteen to twenty degrees as the heel takes the weight, so a leg under
/// load is never a post; it bends to sixty in swing, but only once the hip is
/// carrying the thigh forward, so the foot passes under the body instead of
/// kicking up behind it; and the foot is on the floor for three fifths of the
/// stride.
const JOINTS: [(f32, f32, f32); 20] = [
    (30.0, 5.0, 0.0),
    (27.0, 12.0, -4.0),
    (24.0, 18.0, -3.0),
    (19.0, 16.0, 2.0),
    (14.0, 11.0, 5.0),
    (8.0, 7.0, 7.0),
    (3.0, 5.0, 9.0),
    (-2.0, 4.0, 10.0),
    (-7.0, 6.0, 9.0),
    (-11.0, 9.0, 6.0),
    (-12.0, 17.0, 0.0),
    (-9.0, 32.0, -12.0),
    (-2.0, 48.0, -14.0),
    (7.0, 60.0, -8.0),
    (15.0, 63.0, -3.0),
    (22.0, 58.0, 0.0),
    (27.0, 46.0, 1.0),
    (30.0, 30.0, 1.0),
    (31.0, 15.0, 0.0),
    (31.0, 7.0, 0.0),
];
/// The thigh hangs from a pelvis tipped forward: its angle to the vertical is
/// the hip's flexion less this.
const PELVIS: f32 = 9.0;
/// The arm's swing at the shoulder either side of hanging, and how far it runs
/// behind the leg, as a part of the stride.
const ARM_SWING: f32 = 18.0;
const ARM_LAG: f32 = 0.05;
/// The thigh and the shin in hundredths of the figure's height.
pub const THIGH: f32 = 22.5;
pub const SHIN: f32 = 21.5;

/// Thigh angle to the vertical, knee bend and ankle tilt, in radians, at
/// `phase` of the stride, through the samples by a Catmull-Rom curve.
pub fn joints(phase: f32) -> (f32, f32, f32) {
    let n = JOINTS.len();
    let f = phase.rem_euclid(1.0) * n as f32;
    let i = f as usize % n;
    let t = f.fract();
    let p = |k: isize| JOINTS[((i as isize + k).rem_euclid(n as isize)) as usize];
    let (p0, p1, p2, p3) = (p(-1), p(0), p(1), p(2));
    let cr = |a: f32, b: f32, c: f32, d: f32| {
        0.5 * ((2.0 * b)
            + (-a + c) * t
            + (2.0 * a - 5.0 * b + 4.0 * c - d) * t * t
            + (-a + 3.0 * b - 3.0 * c + d) * t * t * t)
    };
    let hip = cr(p0.0, p1.0, p2.0, p3.0);
    let knee = cr(p0.1, p1.1, p2.1, p3.1);
    let ankle = cr(p0.2, p1.2, p2.2, p3.2);
    (
        (hip - PELVIS).to_radians(),
        knee.to_radians(),
        ankle.to_radians(),
    )
}

/// How far forward of the hip the ankle is, in hundredths of the height.
fn ankle_ahead(phase: f32) -> f32 {
    let (a1, a2, _) = joints(phase);
    THIGH * a1.sin() + SHIN * (a1 - a2).sin()
}

/// The ground covered in one stride, in figure heights. The foot is planted
/// from the heel striking to the heel lifting, half the stride, and the body
/// must pass over it by as much as it moves back or it slides.
pub fn stride() -> f32 {
    (ankle_ahead(0.0) - ankle_ahead(0.5)) / 0.5 / 100.0
}

/// Four tones from a base: light, base, shade, dark. The shadows drift cool
/// and the light warm, as pixel artists of the period shaded.
fn ramp(c: Color) -> [Color; 4] {
    let (r, g, b) = ((c >> 16) as f32, ((c >> 8) & 255) as f32, (c & 255) as f32);
    let t = |k: f32, m: (f32, f32, f32)| -> Color {
        let q = |v: f32, n: f32| (v * k * n).clamp(0.0, 255.0) as u32;
        (q(r, m.0) << 16) | (q(g, m.1) << 8) | q(b, m.2)
    };
    let cool = (0.92, 0.88, 1.08);
    [t(1.16, (1.06, 1.04, 0.92)), c, t(0.74, cool), t(0.48, cool)]
}

struct Tones {
    skin: [Color; 4],
    hair: [Color; 4],
    top: [Color; 4],
    shirt: [Color; 4],
    legs: [Color; 4],
    shoes: [Color; 4],
    cap: Option<[Color; 4]>,
}

impl Tones {
    fn of(p: &Palette) -> Self {
        Tones {
            skin: ramp(p.skin),
            hair: ramp(p.hair),
            top: ramp(p.top),
            shirt: ramp(p.shirt),
            legs: ramp(p.legs),
            shoes: ramp(p.shoes),
            cap: p.cap.map(ramp),
        }
    }
}

/// The large canvas shapes are drawn on, in figure units: a hundredth of the
/// height, the feet at the origin.
struct Pen {
    px: Vec<Option<Color>>,
    w: i32,
    h: i32,
    ox: f32,
    oy: f32,
    u: f32,
}

impl Pen {
    fn new() -> Self {
        let (w, h) = (W * SS, H * SS);
        Pen {
            px: vec![None; (w * h) as usize],
            w,
            h,
            ox: w as f32 / 2.0,
            oy: (FOOT.1 * SS) as f32,
            u: HEIGHT as f32 * SS as f32 / 100.0,
        }
    }

    fn p(&self, x: f32, y: f32) -> (f32, f32) {
        (self.ox + x * self.u, self.oy + y * self.u)
    }

    fn poly(&mut self, pts: &[(f32, f32)], c: Color) {
        let v: Vec<(f32, f32)> = pts.iter().map(|&(x, y)| self.p(x, y)).collect();
        let (mut y0, mut y1) = (f32::MAX, f32::MIN);
        for &(_, y) in &v {
            y0 = y0.min(y);
            y1 = y1.max(y);
        }
        let mut xs = Vec::with_capacity(8);
        for y in (y0.floor() as i32).max(0)..=(y1.ceil() as i32).min(self.h - 1) {
            let cy = y as f32 + 0.5;
            xs.clear();
            for k in 0..v.len() {
                let (a, b) = (v[k], v[(k + 1) % v.len()]);
                if (a.1 <= cy && b.1 > cy) || (b.1 <= cy && a.1 > cy) {
                    xs.push(a.0 + (cy - a.1) / (b.1 - a.1) * (b.0 - a.0));
                }
            }
            xs.sort_by(|a, b| a.total_cmp(b));
            for pair in xs.chunks(2) {
                if let [a, b] = pair {
                    let (xa, xb) = ((a - 0.5).ceil() as i32, (b - 0.5).floor() as i32);
                    for x in xa.max(0)..=xb.min(self.w - 1) {
                        self.px[(y * self.w + x) as usize] = Some(c);
                    }
                }
            }
        }
    }

    fn ellipse(&mut self, cx: f32, cy: f32, rx: f32, ry: f32, c: Color) {
        let (px, py) = self.p(cx, cy);
        let (rx, ry) = (rx * self.u, ry * self.u);
        for y in ((py - ry).floor() as i32).max(0)..=((py + ry).ceil() as i32).min(self.h - 1) {
            for x in ((px - rx).floor() as i32).max(0)..=((px + rx).ceil() as i32).min(self.w - 1) {
                let dx = (x as f32 + 0.5 - px) / rx.max(0.01);
                let dy = (y as f32 + 0.5 - py) / ry.max(0.01);
                if dx * dx + dy * dy <= 1.0 {
                    self.px[(y * self.w + x) as usize] = Some(c);
                }
            }
        }
    }

    /// A tapered segment with round ends.
    fn seg(&mut self, a: (f32, f32), b: (f32, f32), ra: f32, rb: f32, c: Color) {
        let (dx, dy) = (b.0 - a.0, b.1 - a.1);
        let l = dx.hypot(dy).max(1e-6);
        let (nx, ny) = (-dy / l, dx / l);
        self.poly(
            &[
                (a.0 + nx * ra, a.1 + ny * ra),
                (b.0 + nx * rb, b.1 + ny * rb),
                (b.0 - nx * rb, b.1 - ny * rb),
                (a.0 - nx * ra, a.1 - ny * ra),
            ],
            c,
        );
        self.ellipse(a.0, a.1, ra, ra, c);
        self.ellipse(b.0, b.1, rb, rb, c);
    }

    /// A round limb lit from the upper left: the shade over all of it, the
    /// base shifted toward the light, a thin light along the lit edge. A far
    /// limb takes the tones one step darker and no light.
    fn limb(&mut self, a: (f32, f32), b: (f32, f32), ra: f32, rb: f32, t: &[Color; 4], far: bool) {
        let (light, base, shade) = if far {
            (t[1], t[2], t[3])
        } else {
            (t[0], t[1], t[2])
        };
        self.seg(a, b, ra, rb, shade);
        let (ox, oy) = (-0.32, -0.2);
        self.seg(
            (a.0 + ra * ox, a.1 + ra * oy),
            (b.0 + rb * ox, b.1 + rb * oy),
            ra * 0.66,
            rb * 0.66,
            base,
        );
        if !far {
            self.seg(
                (a.0 - ra * 0.55, a.1 - ra * 0.3),
                (b.0 - rb * 0.55, b.1 - rb * 0.3),
                ra * 0.16,
                rb * 0.16,
                light,
            );
        }
    }
}

// The heads, drawn by hand. h hair, l its light, H its shadow, b its darkest
// (the brow), s skin, S skin in shade, d in deep shade, m the mouth, e the
// eye, c the cap and C its brim or shade.
const HEAD_SIDE: [&str; 13] = [
    "...hhhhh....",
    ".hhlllllhh..",
    "hhhhhhhhhhh.",
    "hHhhhhhhhhs.",
    "hHhhhhhhsss.",
    "HHhhSssbbss.",
    "HHhSdsssesS.",
    "HHhSdSsssssS",
    ".HHSSssssss.",
    ".HHSSsssmm..",
    "..HSSssss...",
    "...dSSSS....",
    "....dSS.....",
];
const HEAD_SIDE_MULLET: [&str; 14] = [
    "...hhhhh....",
    ".hhlllllhh..",
    "hhhhhhhhhhh.",
    "hHhhhhhhhhs.",
    "hHhhhhhhsss.",
    "HHhhSssbbss.",
    "HHhSdsssesS.",
    "HHhSdSsssssS",
    "HHHSSssssss.",
    "HHHSSsssmm..",
    "HHH.Sssss...",
    "HHH.dSSS....",
    ".HH.dSS.....",
    "..H.........",
];
const HEAD_SIDE_CAP: [&str; 13] = [
    "...ccccc....",
    ".ccccccccc..",
    "cccccccccccc",
    "hCCCCCCCCCCC",
    "hHhhhhhhsss.",
    "HHhhSssbbss.",
    "HHhSdsssesS.",
    "HHhSdSsssssS",
    ".HHSSssssss.",
    ".HHSSsssmm..",
    "..HSSssss...",
    "...dSSSS....",
    "....dSS.....",
];
const HEAD_FRONT: [&str; 13] = [
    "...hhhhhh...",
    "..hlllllhh..",
    ".hhhhhhhhhh.",
    "hhhhhhhhhhhh",
    "hHssssssssHh",
    "HSbbsSSbbsSH",
    "HSsesSSsesSH",
    "dSsssSSsssSd",
    ".SsssSSsssS.",
    ".SssssssssS.",
    "..SssmmssS..",
    "...SSssSS...",
    "....dSSd....",
];
const HEAD_FRONT_CAP: [&str; 13] = [
    "...cccccc...",
    "..cccccccc..",
    ".cccccccccc.",
    "cCCCCCCCCCCc",
    "hHssssssssHh",
    "HSbbsSSbbsSH",
    "HSsesSSsesSH",
    "dSsssSSsssSd",
    ".SsssSSsssS.",
    ".SssssssssS.",
    "..SssmmssS..",
    "...SSssSS...",
    "....dSSd....",
];
const HEAD_FRONT_OPEN: [&str; 13] = [
    "...hhhhhh...",
    "..hlllllhh..",
    ".hhhhhhhhhh.",
    "hhhhhhhhhhhh",
    "hHssssssssHh",
    "HSbbsSSbbsSH",
    "HSsesSSsesSH",
    "dSsssSSsssSd",
    ".SsssSSsssS.",
    ".SssdddsssS.",
    "..SsdddssS..",
    "...SSddSS...",
    "....dSSd....",
];
const HEAD_BACK: [&str; 13] = [
    "...hhhhhh...",
    "..hlllllhh..",
    ".hhhhhhhhhh.",
    "hhhhhhhhhhhh",
    "hhhhhhhhhhhH",
    "hhhhhhhhhhhH",
    "dhhhhhhhhhHd",
    "dHhhhhhhhhHd",
    ".HhhhhhhhhH.",
    ".HHhhhhhhHH.",
    "..HHHHHHHH..",
    "...SSSSSS...",
    "....SSSS....",
];
const HEAD_BACK_MULLET: [&str; 15] = [
    "...hhhhhh...",
    "..hlllllhh..",
    ".hhhhhhhhhh.",
    "hhhhhhhhhhhh",
    "hhhhhhhhhhhH",
    "hhhhhhhhhhhH",
    "hhhhhhhhhhHH",
    "HhhhhhhhhhHH",
    "HHhhhhhhhHHH",
    "HHhhhhhhhhHH",
    ".HHhhhhhhHH.",
    ".HHHHHHHHHH.",
    "..HHHHHHHH..",
    "...HHHHHH...",
    "....HHHH....",
];
const HEAD_BACK_CAP: [&str; 13] = [
    "...cccccc...",
    "..cccccccc..",
    ".cccccccccc.",
    "cCCCCCCCCCCc",
    "hhhhhhhhhhhH",
    "hhhhhhhhhhhH",
    "dhhhhhhhhhHd",
    "dHhhhhhhhhHd",
    ".HhhhhhhhhH.",
    ".HHhhhhhhHH.",
    "..HHHHHHHH..",
    "...SSSSSS...",
    "....SSSS....",
];

fn head(grid: &[&str], t: &Tones, flip: bool) -> Vec<(i32, i32, Color)> {
    let cap = t.cap.unwrap_or(t.hair);
    let w = grid[0].len() as i32;
    let mut out = Vec::new();
    for (y, row) in grid.iter().enumerate() {
        for (x, ch) in row.bytes().enumerate() {
            let c = match ch {
                b'h' => t.hair[1],
                b'l' => t.hair[0],
                b'H' => t.hair[2],
                b'b' => t.hair[3],
                b's' => t.skin[1],
                b'S' => t.skin[2],
                b'd' | b'm' => t.skin[3],
                b'e' => 0x1a1216,
                b'c' => cap[1],
                b'C' => cap[2],
                _ => continue,
            };
            let x = if flip { w - 1 - x as i32 } else { x as i32 };
            out.push((x, y as i32, c));
        }
    }
    out
}

/// The pose a sprite is drawn in.
#[derive(Clone, Copy, PartialEq, Debug)]
pub struct Pose {
    pub view: View,
    pub act: Act,
    /// Where in the stride, 0 to 1.
    pub phase: f32,
    /// How much of a stride the legs make, 0 standing to 1 walking.
    pub amount: f32,
    /// Seconds into whatever it is doing, for the small motions of playing,
    /// cheering and mopping.
    pub t: f32,
}

/// Draw a figure.
pub fn sprite(pal: &Palette, pose: &Pose) -> Sprite {
    build(pal, pose, &mut |_, _, _, _| {})
}

/// A figure at each step of its making, for the study plates: the shapes at
/// four times the size, then the reduction, the cleaning, the grain, the head
/// and the edge, each with its width and height.
pub fn stages(pal: &Palette, pose: &Pose) -> Vec<(&'static str, i32, i32, Vec<Option<Color>>)> {
    let mut out = Vec::new();
    build(pal, pose, &mut |name, w, h, px| {
        out.push((name, w, h, px.to_vec()))
    });
    out
}

type Stage<'a> = dyn FnMut(&'static str, i32, i32, &[Option<Color>]) + 'a;

fn build(pal: &Palette, pose: &Pose, stage: &mut Stage) -> Sprite {
    let t = Tones::of(pal);
    let mut pen = Pen::new();
    let (head_at, mop, grid): (_, _, &[&str]) = match pose.view {
        View::Side(_) => {
            let (h, m) = side(&mut pen, &t, pose);
            let grid: &[&str] = if pal.cap.is_some() {
                &HEAD_SIDE_CAP
            } else if pal.mullet {
                &HEAD_SIDE_MULLET
            } else {
                &HEAD_SIDE
            };
            (h, m, grid)
        }
        View::Toward | View::Away => {
            let away = pose.view == View::Away;
            let h = frontal(&mut pen, &t, pose, away);
            let grid: &[&str] = match (away, pal.cap.is_some(), pal.mullet) {
                (false, true, _) => &HEAD_FRONT_CAP,
                (false, false, _) if pose.act == Act::Cheer => &HEAD_FRONT_OPEN,
                (false, false, _) => &HEAD_FRONT,
                (true, true, _) => &HEAD_BACK_CAP,
                (true, false, true) => &HEAD_BACK_MULLET,
                (true, false, false) => &HEAD_BACK,
            };
            (h, None, grid)
        }
    };
    stage("shapes", pen.w, pen.h, &pen.px);
    let mut px = reduce(&pen);
    stage("reduced", W, H, &px);
    clean(&mut px);
    stage("cleaned", W, H, &px);
    grain(&mut px, &t);
    stage("grain", W, H, &px);
    let (hx, hy) = (
        (head_at.0 / SS as f32).round() as i32 - 6,
        (head_at.1 / SS as f32).round() as i32 - 6,
    );
    for (x, y, c) in head(grid, &t, false) {
        let (x, y) = (hx + x, hy + y);
        if (0..W).contains(&x) && (0..H).contains(&y) {
            px[(y * W + x) as usize] = Some(c);
        }
    }
    stage("head", W, H, &px);
    let mut px = selout(&px);
    stage("edge", W, H, &px);
    let mut mop = mop.map(|(x, y)| (x * HEIGHT as f32 / 100.0, y * HEIGHT as f32 / 100.0));
    if pose.view == View::Side(false) {
        for y in 0..H {
            px[(y * W) as usize..((y + 1) * W) as usize].reverse();
        }
        mop = mop.map(|(x, y)| (-x, y));
    }
    Sprite { px, mop }
}

/// The figure in profile, facing right: it is mirrored for the left. Returns
/// where the head goes on the large canvas, and the mop's foot if there is one.
fn side(pen: &mut Pen, t: &Tones, pose: &Pose) -> ((f32, f32), Option<(f32, f32)>) {
    let s = 1.0;
    let (phase, amount) = (pose.phase, pose.amount);
    let mut legs = [((0.0, 0.0), (0.0, 0.0), 0.0f32); 2];
    for (k, leg) in legs.iter_mut().enumerate() {
        let (a1, a2, _) = joints(phase + k as f32 * 0.5);
        let (a1, a2) = (a1 * amount, a2 * amount);
        let knee = (s * THIGH * a1.sin(), THIGH * a1.cos());
        let ank = (
            knee.0 + s * SHIN * (a1 - a2).sin(),
            knee.1 + SHIN * (a1 - a2).cos(),
        );
        *leg = (knee, ank, a2);
    }
    let reach = legs[0].1.1.max(legs[1].1.1);
    let playing = pose.act == Act::Play;
    let hip = (s * 0.5, -(reach + 4.0));
    let lean = if playing { 2.5 } else { 0.0 };
    // The mop goes to and fro about once a second, well out and back, and
    // the shoulders go with it while the feet hardly move.
    let mop_sweep = if pose.act == Act::Mop {
        (pose.t * 6.0).sin() * 7.0
    } else {
        0.0
    };
    let lean = lean
        + if pose.act == Act::Mop {
            1.5 + mop_sweep * 0.2
        } else {
            0.0
        };
    let top = (hip.0 + s * (1.8 + lean), hip.1 - 31.0);
    // The pelvis turns a few degrees with the leg that swings forward and the
    // chest the other way, which from the side slides each hip and shoulder a
    // pixel or so forward and back.
    let turn = (TAU * phase).cos() * amount;
    let hips = [
        (hip.0 + s * 0.8 * turn, hip.1),
        (hip.0 - s * 0.8 * turn, hip.1),
    ];
    let shoulders = [
        (top.0 - s * 1.0 - s * 1.4 * turn, top.1 + 4.0),
        (top.0 - s * 1.0 + s * 1.4 * turn, top.1 + 4.0),
    ];
    let sweep = mop_sweep;
    let handle = (
        (top.0 + s * 11.0, top.1 + 7.0),
        (hip.0 + s * (30.0 + sweep), -1.0),
    );
    // Carried, the mop hangs from the near hand a little ahead of the hip,
    // its head a hand's breadth off the floor.
    let carry_hand = (hip.0 + s * 6.0, hip.1 + 1.0);
    let on_handle = |f: f32| {
        (
            handle.0.0 + (handle.1.0 - handle.0.0) * f,
            handle.0.1 + (handle.1.1 - handle.0.1) * f,
        )
    };

    let leg = |pen: &mut Pen, i: usize, far: bool| {
        let (knee, ank, bend) = legs[i];
        let root = hips[i];
        let hk = (root.0 + knee.0, root.1 + knee.1);
        let ha = (root.0 + ank.0, root.1 + ank.1);
        pen.limb(root, hk, 6.8, 5.2, &t.legs, far);
        pen.limb(hk, ha, 5.2, 4.0, &t.legs, far);
        // the crease behind a bent knee
        if bend > 0.3 {
            pen.seg(
                (hk.0 - s * 2.0, hk.1 - 1.5),
                (hk.0 - s * 0.5, hk.1 + 1.5),
                0.55,
                0.55,
                t.legs[3],
            );
        }
        // The foot turns with the leg: toe up as the heel strikes, heel up as
        // the toe pushes off, flat while it carries the weight.
        let (th, kn, an) = joints(phase + i as f32 * 0.5);
        let tilt = ((th - kn) + an) * amount;
        let (c, sn) = (tilt.cos(), tilt.sin());
        let r = |dx: f32, dy: f32| (ha.0 + s * (dx * c + dy * sn), ha.1 + (-dx * sn + dy * c));
        let (top_c, sole) = if far {
            (t.shoes[2], t.shoes[3])
        } else {
            (t.shoes[1], t.shoes[3])
        };
        pen.poly(
            &[
                r(-2.8, -1.8),
                r(1.8, -2.8),
                r(7.4, 0.2),
                r(7.6, 2.4),
                r(-3.0, 2.4),
            ],
            top_c,
        );
        pen.poly(
            &[r(-3.0, 1.2), r(7.6, 1.2), r(7.6, 2.6), r(-3.0, 2.6)],
            sole,
        );
        if !far {
            pen.seg(r(-1.8, -1.4), r(1.2, -2.2), 0.5, 0.5, t.shoes[0]);
        }
    };

    let arm = |pen: &mut Pen, i: usize, far: bool| {
        let sh = shoulders[i];
        let skin = if far { t.skin[2] } else { t.skin[1] };
        let carrying = pose.act == Act::Carry && i == 0;
        let (el, wr) = if carrying {
            // the near hand holds the handle at the hip, the arm straight
            let hand = carry_hand;
            let el = ((sh.0 + hand.0) / 2.0 - s * 0.8, (sh.1 + hand.1) / 2.0 + 1.0);
            (el, hand)
        } else if pose.act == Act::Mop {
            // both hands on the handle, the near one higher
            let hand = on_handle(if i == 0 { 0.08 } else { 0.3 });
            let el = ((sh.0 + hand.0) / 2.0 - s * 1.0, (sh.1 + hand.1) / 2.0 + 3.5);
            (el, hand)
        } else if playing {
            // the forearms out to the controls, working
            let jig = (pose.t * if i == 0 { 11.0 } else { 7.0 }).sin() * 0.7;
            let el = (sh.0 + s * 4.0, sh.1 + 11.5);
            (el, (el.0 + s * 11.0, el.1 - 3.0 + jig))
        } else {
            // Each arm swings against the leg on its own side: furthest back
            // as that heel strikes, furthest forward half a stride later, a
            // little behind the leg, as a pendulum hung from the shoulder is.
            // The elbow bends from about fourteen degrees behind to forty in
            // front, the thirty degrees or so measured in walkers.
            let w = TAU * (phase + i as f32 * 0.5 - ARM_LAG);
            let sw = -ARM_SWING.to_radians() * w.cos() * amount;
            let elbow = (14.0 + 26.0 * (1.0 - w.cos()) / 2.0).to_radians() * amount
                + 10f32.to_radians() * (1.0 - amount);
            let (up, fore) = (14.5, 13.5);
            let el = (sh.0 + s * up * sw.sin(), sh.1 + up * sw.cos());
            let bend = sw + elbow;
            (el, (el.0 + s * fore * bend.sin(), el.1 + fore * bend.cos()))
        };
        pen.limb(sh, el, 4.6, 3.8, &t.top, far);
        pen.limb(el, wr, 3.8, 3.2, &t.top, far);
        // the fold at the inside of the elbow
        pen.seg(
            (el.0 + s * 1.2, el.1 - 0.8),
            (el.0 + s * 2.4, el.1 + 0.6),
            0.5,
            0.5,
            t.top[3],
        );
        pen.ellipse(wr.0 + s * 0.3, wr.1 + 1.6, 2.3, 2.7, skin);
    };

    leg(pen, 1, true);
    arm(pen, 1, true);

    // the jacket: shoulders a little rounded, the back broad, the hem past
    // the hips
    let (hx, hy) = hip;
    let (tx, ty) = top;
    let tt = &t.top;
    pen.poly(
        &[
            (tx - s * 10.5, ty + 3.0),
            (tx - s * 3.0, ty - 1.2),
            (tx + s * 8.5, ty),
            (tx + s * 12.0, ty + 5.5),
            (hx + s * 11.8, hy + 4.4),
            (hx - s * 11.4, hy + 4.6),
            (tx - s * 12.6, ty + 9.0),
        ],
        tt[2],
    );
    pen.poly(
        &[
            (tx - s * 7.5, ty + 2.4),
            (tx - s * 2.6, ty + 0.2),
            (tx + s * 6.0, ty + 1.0),
            (tx + s * 8.8, ty + 5.4),
            (hx + s * 9.0, hy + 2.4),
            (hx - s * 7.4, hy + 2.6),
            (tx - s * 9.2, ty + 9.0),
        ],
        tt[1],
    );
    // the light across the back and the top of the shoulder
    pen.poly(
        &[
            (tx - s * 6.5, ty + 2.4),
            (tx - s * 2.6, ty + 0.4),
            (tx - s * 0.5, ty + 1.2),
            (tx - s * 3.5, ty + 4.0),
            (hx - s * 5.0, hy - 6.0),
            (hx - s * 6.4, hy + 2.6),
            (tx - s * 8.0, ty + 9.0),
        ],
        tt[0],
    );
    // the darker front where the jacket turns from the light
    pen.poly(
        &[
            (tx + s * 7.2, ty + 4.4),
            (tx + s * 9.8, ty + 5.0),
            (hx + s * 10.4, hy + 3.2),
            (hx + s * 7.4, hy + 3.2),
        ],
        tt[2],
    );
    // the hem and its shadow
    pen.poly(
        &[
            (hx - s * 10.2, hy + 3.0),
            (hx + s * 10.6, hy + 2.8),
            (hx + s * 10.6, hy + 4.6),
            (hx - s * 10.2, hy + 4.8),
        ],
        tt[3],
    );
    // a fold across the back from the arm's swing
    pen.seg(
        (tx - s * 1.0, ty + 10.0),
        (hx - s * 2.5, hy - 6.0),
        0.45,
        0.45,
        tt[2],
    );
    // the collar turned up at the back of the neck, and the shirt at the front
    pen.poly(
        &[
            (tx - s * 2.6, ty - 0.6),
            (tx + s * 0.8, ty - 1.6),
            (tx + s * 1.8, ty + 1.8),
            (tx - s * 1.8, ty + 2.6),
        ],
        tt[2],
    );
    pen.poly(
        &[
            (tx + s * 1.8, ty - 0.2),
            (tx + s * 5.2, ty + 0.6),
            (tx + s * 3.2, ty + 4.6),
        ],
        t.shirt[1],
    );

    leg(pen, 0, false);

    // the neck; the head is drawn by hand after the reduction
    let (hcx, hcy) = (tx + s * 2.6, ty - 7.8);
    pen.seg(
        (tx + s * 0.6, ty + 0.6),
        (hcx - s * 0.2, hcy + 4.2),
        2.8,
        2.8,
        t.skin[2],
    );
    arm(pen, 0, false);

    if pose.act == Act::Carry {
        let hand = carry_hand;
        let foot = (hand.0 + s * 9.0, -7.0);
        let up = (
            hand.0 - (foot.0 - hand.0) * 0.45,
            hand.1 - (foot.1 - hand.1) * 0.45,
        );
        mop_head(pen, up, foot, false);
    }
    let mut mop = None;
    if pose.act == Act::Mop {
        let (a, b) = handle;
        mop_head(pen, a, b, true);
        mop = Some((b.0, 0.0));
    }
    (pen.p(hcx, hcy), mop)
}

/// A mop from the top of its handle to its head: on the floor its strands
/// spread; carried they hang together.
fn mop_head(pen: &mut Pen, a: (f32, f32), b: (f32, f32), down: bool) {
    pen.seg(a, b, 0.95, 0.95, 0x96764a);
    pen.seg((a.0 - 0.4, a.1), (b.0 - 0.4, b.1), 0.35, 0.35, 0xc8a46c);
    pen.poly(
        &[
            (b.0 - 2.0, b.1 - 2.6),
            (b.0 + 2.0, b.1 - 2.6),
            (b.0 + 2.4, b.1 - 1.2),
            (b.0 - 2.4, b.1 - 1.2),
        ],
        0x787878,
    );
    let (spread, drop) = if down { (2.2, 1.6) } else { (1.3, 4.0) };
    for k in -3..=3 {
        let c = if k % 2 != 0 { 0xcec8b8 } else { 0xa8a496 };
        let k = k as f32;
        pen.seg(
            (b.0 + k * 1.1, b.1 - 1.4),
            (b.0 + k * spread, b.1 + drop),
            0.6,
            0.6,
            c,
        );
    }
}

/// The figure walking toward the camera or away from it: the same joint
/// curves seen end on, a leg swinging forward shortening and lifting its foot,
/// a bent knee shortening the leg.
fn frontal(pen: &mut Pen, t: &Tones, pose: &Pose, away: bool) -> (f32, f32) {
    let (phase, amount) = (pose.phase, pose.amount);
    let toward = if away { -1.0 } else { 1.0 };
    let mut feet = [(0.0f32, 0.0f32, 0.0f32, 0.0f32); 2];
    for (k, foot) in feet.iter_mut().enumerate() {
        let (a1, a2, _) = joints(phase + k as f32 * 0.5);
        let (a1, a2) = (a1 * amount, a2 * amount);
        let ky = THIGH * a1.cos();
        let ay = ky + SHIN * (a1 - a2).cos();
        // forward of the body is nearer the camera from the front: a little
        // lower on the screen
        let depth = (THIGH * a1.sin() + SHIN * (a1 - a2).sin()) * toward;
        *foot = (ky, ay, depth, a2);
    }
    let reach = feet
        .iter()
        .map(|f| f.1 + f.2 * 0.12)
        .fold(f32::MIN, f32::max);
    let mut hip_y = -(reach + 4.0);
    if pose.act == Act::Cheer {
        hip_y -= (pose.t * 7.0).sin().abs() * 4.0;
    }
    let over = pose.act == Act::Over;
    let top_y = hip_y - 31.0 + if over { 1.5 } else { 0.0 };
    // the weight over the leg that carries it
    let sway = 0.9 * (TAU * phase).sin() * amount;
    let tt = &t.top;
    let g = &t.legs;

    let mut order = [0usize, 1];
    order.sort_by(|&a, &b| feet[a].2.total_cmp(&feet[b].2));
    for k in order {
        let (ky, ay, depth, bend) = feet[k];
        let sx = if k == 0 { -4.6 } else { 4.6 };
        let root = (sx, hip_y);
        let knee = (sx * 1.02, hip_y + ky + depth * 0.06);
        let ank = (sx * 0.9, hip_y + ay + depth * 0.12);
        pen.limb(root, knee, 6.2, 5.0, g, false);
        pen.limb(knee, ank, 5.0, 4.0, g, false);
        if bend > 0.5 {
            pen.seg(
                (knee.0 - 1.5, knee.1 - 0.5),
                (knee.0 + 1.5, knee.1 - 0.5),
                0.5,
                0.5,
                g[3],
            );
        }
        let sh = &t.shoes;
        let w = 3.4;
        if !away {
            pen.ellipse(ank.0, ank.1 + 1.6, w, 2.2, sh[1]);
            pen.seg(
                (ank.0 - w + 0.8, ank.1 + 2.6),
                (ank.0 + w - 0.8, ank.1 + 2.6),
                0.6,
                0.6,
                sh[3],
            );
            pen.seg(
                (ank.0 - 1.8, ank.1 + 0.6),
                (ank.0 - 0.4, ank.1 + 0.4),
                0.5,
                0.5,
                sh[0],
            );
        } else {
            pen.ellipse(ank.0, ank.1 + 1.4, w * 0.85, 1.9, sh[2]);
            pen.seg(
                (ank.0 - w + 1.2, ank.1 + 2.6),
                (ank.0 + w - 1.2, ank.1 + 2.6),
                0.7,
                0.7,
                sh[3],
            );
        }
    }
    // the trousers' seat, joining the legs under the jacket
    pen.poly(
        &[
            (-9.5, hip_y - 2.0),
            (9.5, hip_y - 2.0),
            (8.0, hip_y + 5.0),
            (-8.0, hip_y + 5.0),
        ],
        g[1],
    );
    pen.poly(
        &[
            (-9.5, hip_y - 2.0),
            (-3.0, hip_y - 2.0),
            (-3.5, hip_y + 5.0),
            (-8.0, hip_y + 5.0),
        ],
        g[0],
    );

    let sw_ = |pts: &[(f32, f32)]| -> Vec<(f32, f32)> {
        pts.iter().map(|&(x, y)| (x + sway, y)).collect()
    };
    pen.poly(
        &sw_(&[
            (-10.5, top_y + 2.5),
            (-5.0, top_y),
            (5.0, top_y),
            (10.5, top_y + 2.5),
            (11.8, top_y + 8.0),
            (10.8, hip_y + 4.4),
            (-10.8, hip_y + 4.4),
            (-11.8, top_y + 8.0),
        ]),
        tt[2],
    );
    pen.poly(
        &sw_(&[
            (-9.8, top_y + 2.6),
            (-4.6, top_y + 0.6),
            (4.6, top_y + 0.6),
            (9.2, top_y + 3.0),
            (9.6, hip_y + 3.4),
            (-9.8, hip_y + 3.4),
        ]),
        tt[1],
    );
    pen.poly(
        &sw_(&[
            (-9.8, top_y + 2.6),
            (-4.6, top_y + 0.6),
            (-2.0, top_y + 0.8),
            (-5.5, hip_y + 3.4),
            (-9.8, hip_y + 3.4),
        ]),
        tt[0],
    );
    pen.poly(
        &sw_(&[
            (-10.8, hip_y + 2.6),
            (10.8, hip_y + 2.6),
            (10.8, hip_y + 4.6),
            (-10.8, hip_y + 4.6),
        ]),
        tt[3],
    );
    if !away {
        // open at the front on the shirt, the lapels in shade
        pen.poly(
            &sw_(&[
                (-2.6, top_y + 0.4),
                (2.6, top_y + 0.4),
                (1.6, hip_y + 2.6),
                (-1.6, hip_y + 2.6),
            ]),
            t.shirt[1],
        );
        pen.poly(
            &sw_(&[
                (-3.6, top_y + 0.2),
                (-1.2, top_y + 5.0),
                (-2.2, hip_y + 2.6),
                (-3.2, hip_y + 2.6),
            ]),
            tt[2],
        );
        pen.poly(
            &sw_(&[
                (3.6, top_y + 0.2),
                (1.2, top_y + 5.0),
                (2.2, hip_y + 2.6),
                (3.2, hip_y + 2.6),
            ]),
            tt[3],
        );
    } else {
        // the seam down the back and a fold from each shoulder blade
        pen.seg((sway, top_y + 3.0), (sway, hip_y + 2.0), 0.45, 0.45, tt[2]);
        pen.seg(
            (sway - 6.0, top_y + 6.0),
            (sway - 4.0, top_y + 12.0),
            0.45,
            0.45,
            tt[2],
        );
        pen.seg(
            (sway + 6.0, top_y + 6.0),
            (sway + 4.0, top_y + 12.0),
            0.45,
            0.45,
            tt[3],
        );
    }

    for k in 0..2 {
        let sx = if k == 0 { -1.0 } else { 1.0 };
        let sh = (sx * 11.2 + sway, top_y + 4.5 + if over { 1.0 } else { 0.0 });
        let skin = if away { t.skin[2] } else { t.skin[1] };
        match pose.act {
            Act::Cheer => {
                let wave = (pose.t * 7.0 + k as f32).sin() * 1.5;
                let el = (sh.0 + sx * 5.0, sh.1 - 10.0 + wave);
                let wr = (el.0 + sx * 1.5, el.1 - 11.0 + wave);
                pen.limb(sh, el, 4.4, 3.8, tt, false);
                pen.limb(el, wr, 3.8, 3.2, tt, false);
                pen.ellipse(wr.0, wr.1 - 1.0, 2.6, 2.8, skin);
            }
            Act::Play => {
                // from behind the forearms are in front of him: the upper
                // arms go down and out to the controls, the elbows working
                let jig = (pose.t * if k == 0 { 11.0 } else { 7.0 }).sin() * 0.8;
                let el = (sh.0 + sx * 2.5, sh.1 + 11.0 + jig);
                pen.limb(sh, el, 4.4, 3.9, tt, false);
            }
            _ => {
                let w = TAU * (phase + k as f32 * 0.5 - ARM_LAG);
                let sw = -ARM_SWING.to_radians() * w.cos() * amount;
                let elbow = (14.0 + 26.0 * (1.0 - w.cos()) / 2.0).to_radians() * amount;
                let (up, fore) = (14.5 * sw.cos(), 13.5 * (sw + elbow).cos());
                let el = (sh.0 + sx * 1.0, sh.1 + up);
                let wr = (el.0 - sx * 0.6 * sw.max(0.0).sin(), el.1 + fore);
                pen.limb(sh, el, 4.4, 3.8, tt, false);
                pen.limb(el, wr, 3.8, 3.2, tt, false);
                pen.ellipse(wr.0, wr.1 + 1.6, 2.2, 2.6, skin);
            }
        }
    }
    if pose.act == Act::Carry {
        // upright beside him, in the hand on the right of the picture
        let x = 12.5 + sway;
        mop_head(pen, (x + 0.8, top_y - 2.0), (x + 1.5, -6.5), false);
    }
    // a nod to the game while he plays, the head down at a game lost
    let nod = if pose.act == Act::Play {
        (pose.t * 4.2).sin().max(0.0) * 0.9
    } else {
        0.0
    } + if over { 2.5 } else { 0.0 };
    pen.seg(
        (sway, top_y + 1.0),
        (sway, top_y - 3.0),
        2.8,
        2.8,
        t.skin[2],
    );
    pen.p(sway, top_y - 7.8 + nod)
}

/// Four by four blocks to one pixel: the commonest colour, where more than
/// half the block is covered.
fn reduce(pen: &Pen) -> Vec<Option<Color>> {
    let mut out = vec![None; (W * H) as usize];
    let mut counts: Vec<(Color, u8)> = Vec::with_capacity(16);
    for y in 0..H {
        for x in 0..W {
            counts.clear();
            let mut n = 0;
            for yy in 0..SS {
                for xx in 0..SS {
                    let i = ((y * SS + yy) * pen.w + x * SS + xx) as usize;
                    if let Some(c) = pen.px[i] {
                        n += 1;
                        match counts.iter_mut().find(|e| e.0 == c) {
                            Some(e) => e.1 += 1,
                            None => counts.push((c, 1)),
                        }
                    }
                }
            }
            if n * 2 > SS * SS {
                // the first of the commonest, as the prototype chose
                let mut best = counts[0];
                for &e in &counts[1..] {
                    if e.1 > best.1 {
                        best = e;
                    }
                }
                out[(y * W + x) as usize] = Some(best.0);
            }
        }
    }
    out
}

/// A pixel whose four neighbours all share one other colour is noise at this
/// size: it takes theirs.
fn clean(px: &mut [Option<Color>]) {
    let src = px.to_vec();
    let at = |x: i32, y: i32| src[(y * W + x) as usize];
    for y in 1..H - 1 {
        for x in 1..W - 1 {
            let Some(c) = at(x, y) else { continue };
            let nb = [at(x + 1, y), at(x - 1, y), at(x, y + 1), at(x, y - 1)];
            if let Some(n) = nb[0]
                && nb.iter().all(|&m| m == Some(n))
                && n != c
            {
                px[(y * W + x) as usize] = Some(n);
            }
        }
    }
}

/// Cloth is never one flat tone in those sprites: blotches of the shade and
/// of the light break up the base, in pairs of pixels so they read as folds
/// and wear rather than noise.
fn grain(px: &mut [Option<Color>], t: &Tones) {
    let mut seed: u32 = 7;
    for (tones, every) in [(&t.top, 9u32), (&t.legs, 8)] {
        let (light, base, shade) = (tones[0], tones[1], tones[2]);
        for y in 0..H {
            for x in 0..W - 1 {
                let i = (y * W + x) as usize;
                if px[i] == Some(base) && px[i + 1] == Some(base) {
                    seed = seed.wrapping_mul(1103515245).wrapping_add(12345) & 0x7fff_ffff;
                    let r = seed % (every * 2);
                    if r == 0 {
                        px[i] = Some(shade);
                        if (seed >> 8) & 1 != 0 {
                            px[i + 1] = Some(shade);
                        }
                    } else if r == 1 {
                        px[i] = Some(light);
                    }
                }
            }
        }
    }
}

/// The edge on the shadow side only: an empty pixel to the right of or below
/// the figure takes a dark of what it borders. The lit side, to the left and
/// above, is left open.
fn selout(px: &[Option<Color>]) -> Vec<Option<Color>> {
    let mut out = px.to_vec();
    let dark = |c: Color| lerp_color(c, 0x000000, 0.45);
    for y in 0..H {
        for x in 0..W {
            let i = (y * W + x) as usize;
            if px[i].is_some() {
                continue;
            }
            let left = if x > 0 { px[i - 1] } else { None };
            let above = if y > 0 { px[i - W as usize] } else { None };
            if let Some(c) = left.or(above) {
                out[i] = Some(dark(c));
            }
        }
    }
    out
}

#[cfg(test)]
mod tests {
    use super::*;

    const P: Palette = Palette {
        skin: 0xcc8058,
        hair: 0x684026,
        top: 0x3e64aa,
        shirt: 0xd2d0c4,
        legs: 0x42465c,
        shoes: 0xd6d6d4,
        mullet: false,
        cap: None,
    };

    fn pose(view: View, act: Act) -> Pose {
        Pose {
            view,
            act,
            phase: 0.3,
            amount: 1.0,
            t: 0.5,
        }
    }

    #[test]
    fn every_view_draws_a_whole_figure() {
        for view in [
            View::Side(true),
            View::Side(false),
            View::Toward,
            View::Away,
        ] {
            for act in [Act::Walk, Act::Play, Act::Cheer, Act::Over, Act::Mop] {
                let s = sprite(&P, &pose(view, act));
                let n = s.px.iter().filter(|p| p.is_some()).count();
                assert!(n > 350, "{view:?} {act:?}: {n} pixels");
                // the feet reach the floor line
                let low = (0..H)
                    .rev()
                    .find(|&y| (0..W).any(|x| s.at(x, y).is_some()))
                    .unwrap();
                assert!((low - FOOT.1).abs() <= 3, "{view:?} {act:?}: feet at {low}");
            }
        }
    }

    #[test]
    fn a_sprite_is_the_same_every_time() {
        let a = sprite(&P, &pose(View::Side(true), Act::Walk));
        let b = sprite(&P, &pose(View::Side(true), Act::Walk));
        assert!(a.px == b.px);
    }

    #[test]
    fn the_left_is_the_right_mirrored() {
        let r = sprite(&P, &pose(View::Side(true), Act::Walk));
        let l = sprite(&P, &pose(View::Side(false), Act::Walk));
        for y in 0..H {
            for x in 0..W {
                assert_eq!(r.at(x, y), l.at(W - 1 - x, y));
            }
        }
    }

    #[test]
    fn the_stride_is_a_person_long() {
        // A stride, two steps, is about eighty per cent of a walker's height.
        let s = stride();
        assert!((0.6..1.0).contains(&s), "stride {s}");
    }
}
