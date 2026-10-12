      /* Little Neighbourhood. All artwork, animation, puzzles and synthesized sound are procedural code. */

      const PI = Math.PI,
        TAU = PI * 2;
      const {
        sin,
        cos,
        abs,
        min,
        max,
        hypot,
        atan2,
        floor,
        sqrt,
        exp,
        pow,
        sign,
      } = Math;
      const clamp = (v, a, b) => (v < a ? a : v > b ? b : v),
        lerp = (a, b, t) => a + (b - a) * t;
      const sstep = (a, b, x) => {
        x = clamp((x - a) / (b - a), 0, 1);
        return x * x * (3 - 2 * x);
      };
      const ease = (t) => (t < 0.5 ? 2 * t * t : 1 - pow(-2 * t + 2, 2) / 2);
      function hash(n) {
        n = Math.imul(n ^ (n >>> 16), 0x45d9f3b);
        n = Math.imul(n ^ (n >>> 16), 0x45d9f3b);
        return ((n ^ (n >>> 16)) >>> 0) / 4294967296;
      }
      function noise1(x, seed) {
        const i = floor(x),
          f = x - i,
          u = f * f * (3 - 2 * f),
          s = (seed * 104729) | 0;
        return (
          lerp(hash((i * 7919 + s) | 0), hash(((i + 1) * 7919 + s) | 0), u) *
            2 -
          1
        );
      }
      function RNG(seed) {
        let s = seed >>> 0;
        const r = () => {
          s = (s + 0x6d2b79f5) | 0;
          let t = Math.imul(s ^ (s >>> 15), 1 | s);
          t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
          return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
        };
        r.range = (a, b) => a + (b - a) * r();
        r.int = (a, b) => floor(r.range(a, b + 1));
        r.pick = (a) => a[floor(r() * a.length)];
        r.chance = (p) => r() < p;
        r.wpick = (o) => {
          let t = 0;
          for (const k in o) t += o[k];
          let x = r() * t;
          for (const k in o) {
            x -= o[k];
            if (x <= 0) return k;
          }
          return Object.keys(o)[0];
        };
        return r;
      }

      /* ───────────────────────── 2. paper + ink ───────────────────────── */
      const PAPER = "#f3eee3",
        INK = "#292820",
        ACCENT = "#c36b51";
      const cv = document.createElement("canvas");
      let ctx = cv.getContext("2d");
      let W = 0,
        H = 0,
        DPR = 1,
        paper = null,
        grain = null,
        BOIL = 0,
        SC = 1; // SC = current head scale (px per head-unit / 60)

      function makePaper(w, h) {
        const c = document.createElement("canvas");
        c.width = w;
        c.height = h;
        const g = c.getContext("2d"),
          r = RNG(7);
        g.fillStyle = "#fff";
        g.fillRect(0, 0, w, h);
        for (let i = 0; i < 110; i++) {
          const x = r() * w,
            y = r() * h,
            rad = r.range(0.06, 0.28) * max(w, h),
            gr = g.createRadialGradient(x, y, 0, x, y, rad);
          gr.addColorStop(
            0,
            r.chance(0.6) ? "rgba(142,126,95,.025)" : "rgba(163,146,113,.018)",
          );
          gr.addColorStop(1, "rgba(0,0,0,0)");
          g.fillStyle = gr;
          g.fillRect(x - rad, y - rad, rad * 2, rad * 2);
        }
        const t = document.createElement("canvas");
        t.width = t.height = 256;
        const tg = t.getContext("2d"),
          id = tg.createImageData(256, 256);
        for (let i = 0; i < id.data.length; i += 4) {
          const v = r() * 255;
          id.data[i] = id.data[i + 1] = id.data[i + 2] = v;
          id.data[i + 3] = r() * 10;
        }
        tg.putImageData(id, 0, 0);
        g.globalCompositeOperation = "multiply";
        g.fillStyle = g.createPattern(t, "repeat");
        g.fillRect(0, 0, w, h);
        return c;
      }
      function makeGrain() {
        const t = document.createElement("canvas");
        t.width = t.height = 200;
        const g = t.getContext("2d"),
          id = g.createImageData(200, 200),
          r = RNG(99);
        for (let i = 0; i < id.data.length; i += 4) {
          id.data[i] = 238;
          id.data[i + 1] = 235;
          id.data[i + 2] = 227;
          id.data[i + 3] = r() < 0.08 ? r() * 65 : 0;
        }
        g.putImageData(id, 0, 0);
        return ctx.createPattern(t, "repeat");
      }

      /* a pen stroke = filled ribbon: wobbles along its length, swells in the middle, tapers at the ends */
      function ink(pts, w, seed, closed, amp) {
        const n = pts.length;
        if (n < 2) return;
        w *= SC;
        seed = (seed | 0) + BOIL * 31;
        const d = new Float32Array(n);
        let L = 0;
        for (let i = 1; i < n; i++) {
          L += hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]);
          d[i] = L;
        }
        if (L < 0.6) {
          ctx.beginPath();
          ctx.arc(pts[0][0], pts[0][1], w * 0.55, 0, TAU);
          ctx.fill();
          return;
        }
        amp = (amp == null ? 0.36 : amp) * SC;
        const lx = [],
          ly = [],
          rx = [],
          ry = [];
        for (let i = 0; i < n; i++) {
          const a = pts[closed ? (i - 1 + n) % n : max(i - 1, 0)],
            b = pts[closed ? (i + 1) % n : min(i + 1, n - 1)];
          let tx = b[0] - a[0],
            ty = b[1] - a[1];
          const tl = hypot(tx, ty) || 1;
          tx /= tl;
          ty /= tl;
          const t = d[i] / L,
            s = (d[i] * 0.05) / SC,
            wob = noise1(s + seed * 0.37, seed) * amp;
          let ww = w * (0.8 + 0.32 * noise1(s * 1.9 + 4.2, seed + 11));
          if (!closed) ww *= min(1, 0.28 + min(t, 1 - t) * 8);
          const px = pts[i][0] - ty * wob,
            py = pts[i][1] + tx * wob;
          lx.push(px - ty * ww * 0.5);
          ly.push(py + tx * ww * 0.5);
          rx.push(px + ty * ww * 0.5);
          ry.push(py - tx * ww * 0.5);
        }
        ctx.beginPath();
        ctx.moveTo(lx[0], ly[0]);
        for (let i = 1; i < n; i++) ctx.lineTo(lx[i], ly[i]);
        if (closed) {
          ctx.closePath();
          ctx.moveTo(rx[n - 1], ry[n - 1]);
          for (let i = n - 2; i >= 0; i--) ctx.lineTo(rx[i], ry[i]);
          ctx.closePath();
        } else {
          for (let i = n - 1; i >= 0; i--) ctx.lineTo(rx[i], ry[i]);
          ctx.closePath();
        }
        ctx.fill();
      }
      function chaikin(p, closed, it) {
        for (let k = 0; k < (it || 1); k++) {
          const q = [],
            n = p.length;
          if (!closed) q.push(p[0]);
          for (let i = 0; i < (closed ? n : n - 1); i++) {
            const a = p[i],
              b = p[(i + 1) % n];
            q.push(
              [a[0] * 0.75 + b[0] * 0.25, a[1] * 0.75 + b[1] * 0.25],
              [a[0] * 0.25 + b[0] * 0.75, a[1] * 0.25 + b[1] * 0.75],
            );
          }
          if (!closed) q.push(p[n - 1]);
          p = q;
        }
        return p;
      }
      function path(pts, close) {
        ctx.beginPath();
        ctx.moveTo(pts[0][0], pts[0][1]);
        for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]);
        if (close) ctx.closePath();
      }
      function fillPoly(pts, col) {
        if (pts.length < 3) return;
        path(pts, 1);
        ctx.fillStyle = col;
        ctx.fill();
        ctx.fillStyle = INK;
      }
      function dot(x, y, r) {
        ctx.beginPath();
        ctx.arc(x, y, r * SC, 0, TAU);
        ctx.fill();
      }
      function hull(P) {
        P.sort((a, b) => a[0] - b[0] || a[1] - b[1]);
        const n = P.length;
        if (n < 3) return P;
        const Hh = [];
        const cr = (o, a, b) =>
          (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
        for (let i = 0; i < n; i++) {
          while (
            Hh.length >= 2 &&
            cr(Hh[Hh.length - 2], Hh[Hh.length - 1], P[i]) <= 0
          )
            Hh.pop();
          Hh.push(P[i]);
        }
        const t = Hh.length + 1;
        for (let i = n - 2; i >= 0; i--) {
          while (
            Hh.length >= t &&
            cr(Hh[Hh.length - 2], Hh[Hh.length - 1], P[i]) <= 0
          )
            Hh.pop();
          Hh.push(P[i]);
        }
        Hh.pop();
        return Hh;
      }

      /* A species is a family of proportions, not a flat sticker. */
      const SPECIES = [
        {
          id: "cat",
          name: "cat",
          fur: "#d8b184",
          light: "#f3e5c9",
          ear: "point",
          rx: 0.99,
          ry: 0.86,
          rz: 0.86,
          muzzle: 0.14,
          whiskers: true,
          food: "fish",
          names: ["Miso", "Nori", "Clover", "Fig"],
        },
        {
          id: "bunny",
          name: "bunny",
          fur: "#eee5d8",
          light: "#faf3e8",
          ear: "long",
          rx: 0.85,
          ry: 0.93,
          rz: 0.88,
          muzzle: 0.11,
          whiskers: true,
          food: "carrot",
          names: ["Clover", "Crumble", "Pip", "Cottontail"],
        },
        {
          id: "dog",
          name: "puppy",
          fur: "#bb895a",
          light: "#f1dfbe",
          ear: "flop",
          rx: 0.93,
          ry: 0.91,
          rz: 0.92,
          muzzle: 0.27,
          food: "biscuit",
          names: ["Biscuit", "Waffles", "Peanut", "Pudding"],
        },
        {
          id: "fox",
          name: "fox",
          fur: "#c98353",
          light: "#f6e9d3",
          ear: "point",
          rx: 0.89,
          ry: 0.9,
          rz: 0.9,
          muzzle: 0.37,
          whiskers: true,
          food: "berry",
          names: ["Fern", "Rusty", "Maple", "Juniper"],
        },
        {
          id: "bear",
          name: "bear",
          fur: "#ad9275",
          light: "#e6d4ad",
          ear: "round",
          rx: 1.02,
          ry: 0.94,
          rz: 0.94,
          muzzle: 0.24,
          food: "honey",
          names: ["Honey", "Bruno", "Mochi", "Teddy"],
        },
        {
          id: "panda",
          name: "panda",
          fur: "#f3edde",
          light: "#faf3e6",
          ear: "round",
          rx: 1.06,
          ry: 0.97,
          rz: 0.98,
          muzzle: 0.1,
          food: "bamboo",
          names: ["Bao", "Dumpling", "Boba", "Pebble"],
        },
        {
          id: "raccoon",
          name: "raccoon",
          fur: "#aaa99a",
          light: "#e7e2d1",
          ear: "point",
          rx: 0.99,
          ry: 0.86,
          rz: 0.86,
          muzzle: 0.2,
          whiskers: true,
          food: "biscuit",
          names: ["Bandit", "Pocket", "Pickle", "Cricket"],
        },
        {
          id: "koala",
          name: "koala",
          fur: "#b8beb2",
          light: "#e5e6d7",
          ear: "fuzz",
          rx: 0.99,
          ry: 0.93,
          rz: 0.86,
          muzzle: 0.06,
          food: "leaf",
          names: ["Eucalyptus", "Bean", "Olive", "Dozy"],
        },
        {
          id: "otter",
          name: "otter",
          fur: "#a28267",
          light: "#e5d2b0",
          ear: "small",
          rx: 1.04,
          ry: 0.8,
          rz: 0.9,
          muzzle: 0.2,
          whiskers: true,
          food: "fish",
          names: ["Otto", "Puddle", "Pebble", "Poppy"],
        },
        {
          id: "sheep",
          name: "lamb",
          fur: "#f0e5cf",
          light: "#eee0c6",
          ear: "side",
          rx: 0.85,
          ry: 0.91,
          rz: 0.86,
          muzzle: 0.1,
          food: "leaf",
          names: ["Cloud", "Woolly", "Mallow", "Bramble"],
        },
        {
          id: "pig",
          name: "piglet",
          fur: "#e5b7a6",
          light: "#f2c6b5",
          ear: "fold",
          rx: 0.99,
          ry: 0.94,
          rz: 0.94,
          muzzle: 0.2,
          food: "apple",
          names: ["Truffle", "Peaches", "Button", "Rosie"],
        },
        {
          id: "deer",
          name: "deer",
          fur: "#bf9a6d",
          light: "#efe2c7",
          ear: "leaf",
          rx: 0.8,
          ry: 1.02,
          rz: 0.9,
          muzzle: 0.24,
          food: "apple",
          names: ["Fawn", "Willow", "Bambi", "Acorn"],
        },
      ];
      function makeDNA(seed, index) {
        const r = RNG(seed),
          sp = SPECIES[index % SPECIES.length],
          d = { seed, sp, kind: sp.id, fur: sp.fur, light: sp.light };
        d.rx = sp.rx * r.range(0.95, 1.07);
        d.ry = sp.ry * r.range(0.95, 1.05);
        d.rz = sp.rz;
        d.jaw = sp.id === "fox" ? 0.28 : r.range(0.03, 0.12);
        d.sq = r.range(0.015, 0.08);
        d.chin = 0.025;
        d.cheek = 0.05;
        d.back = 0;
        d.flat = 0.01;
        d.jd = 0;
        d.eyeX = r.range(0.36, 0.43);
        d.eyeY = r.range(0.06, 0.15);
        d.eyeW = r.range(0.115, 0.14);
        d.eyeH = d.eyeW * r.range(0.88, 1.08);
        d.eyeTilt = r.range(-0.08, 0.08);
        d.eyeStyle = ["fox", "cat"].includes(d.kind) ? "almond" : "round";
        d.pupil = 0.59;
        if (d.kind === "fox") {
          d.eyeW *= 0.9;
          d.eyeH *= 0.81;
        }
        if (d.kind === "bear" || d.kind === "otter") {
          d.eyeW *= 0.87;
          d.eyeH *= 0.86;
        }
        if (d.kind === "bunny") {
          d.eyeH *= 1.15;
        }
        d.iris = false;
        d.lidHeavy = false;
        d.lid = d.kind === "cat" ? r.range(0.81, 0.98) : r.range(0.93, 1);
        d.glasses = "none";
        d.mouthY = -0.48;
        d.mouthW = r.range(0.19, 0.25);
        d.mood = r.range(0.3, 0.65);
        d.lips = "line";
        d.noseTip = -0.2;
        d.noseLen = sp.muzzle;
        d.noseDrop = 0;
        d.noseSide = 1;
        d.hair = "bald";
        d.hairFront = 2;
        d.hairWig = 0;
        d.hairSide = 2;
        d.hairBack = 2;
        d.hairLift = 0;
        d.quiff = 0;
        d.speed = r.range(0.72, 1.3);
        d.headGain = r.range(0.48, 0.68);
        d.nerve = r();
        d.phase = r.range(0, 100);
        d.earLen = r.range(0.88, 1.12);
        d.flopSide = r() < 0.5 ? -1 : 1;
        d.mark = r();
        d.scarf = r() < 0.29;
        d.scarfColor = r.pick(["#80917b", "#c68d73", "#a5a088", "#9eaaad"]);
        d.earring = false;
        d.name = r.pick(sp.names);
        return d;
      }

      function surf(d, az, el, lift) {
        const ce = cos(el),
          dx = sin(az) * ce,
          dy = -sin(el),
          dz = cos(az) * ce,
          dn = -el,
          q = 1 - d.sq,
          caz = cos(az),
          k = 1 + (lift || 0);
        const f =
          1 -
          d.jaw * sstep(0, 1.35, dn) +
          d.cheek * exp((-(el + 0.45) * (el + 0.45)) / 0.09) * abs(sin(az));
        return [
          sign(dx) * pow(abs(dx), q) * d.rx * f * k,
          (sign(dy) *
            pow(abs(dy), q) *
            d.ry *
            (1 - d.flat * sstep(0.6, 1.5, el)) +
            d.jd * sstep(0.5, 1.25, dn)) *
            k,
          (dz * d.rz * f +
            d.chin * sstep(0.5, 1.3, dn) * max(0, caz) -
            d.back * max(0, -caz) * ce * sstep(-0.3, 0.7, el)) *
            k,
        ];
      }
      function hairEl(d, az) {
        const a = abs(az > PI ? az - TAU : az);
        const e =
          a < 1.35
            ? lerp(d.hairFront, d.hairSide, sstep(0.45, 1.25, a))
            : lerp(d.hairSide, d.hairBack, sstep(1.5, 2.6, a));
        return (
          e +
          d.hairWig *
            noise1(az * 3.1 + (d.seed % 97), d.seed) *
            (a < 2 ? 1 : 0.3)
        );
      }
      const NA = 40,
        NE = 20,
        HK = 7;
      function putVert(d, P, N, o, p) {
        P[o] = p[0];
        P[o + 1] = p[1];
        P[o + 2] = p[2];
        const nx = p[0] / (d.rx * d.rx),
          ny = p[1] / (d.ry * d.ry),
          nz = p[2] / (d.rz * d.rz),
          l = hypot(nx, ny, nz) || 1;
        N[o] = nx / l;
        N[o + 1] = ny / l;
        N[o + 2] = nz / l;
      }
      function buildSkin(h, jmax) {
        const d = h.d;
        if (!h.sk) {
          h.sk = new Float32Array((NE + 1) * NA * 3);
          h.skn = new Float32Array((NE + 1) * NA * 3);
        }
        for (let j = 0; j <= jmax; j++) {
          const el = -PI / 2 + (PI * j) / NE;
          for (let i = 0; i < NA; i++)
            putVert(
              d,
              h.sk,
              h.skn,
              (j * NA + i) * 3,
              surf(d, (TAU * i) / NA - PI, el, 0),
            );
        }
        h.jdBuilt = d.jd;
      }
      function buildHair(h) {
        const d = h.d;
        if (d.hair === "bald") {
          h.hr = null;
          return;
        }
        const n = NA * (HK + 1);
        h.hr = new Float32Array(n * 3);
        h.hrn = new Float32Array(n * 3);
        h.hp = new Float32Array(n * 2);
        for (let i = 0; i < NA; i++) {
          const az = (TAU * i) / NA - PI,
            e0 = hairEl(d, az);
          for (let k = 0; k <= HK; k++) {
            const t = k / HK,
              el = lerp(e0, PI / 2, t);
            const lift =
              d.hairLift * (0.22 + 0.78 * sstep(0, 0.45, t)) +
              d.quiff *
                exp((-az * az) / 0.5) *
                exp(-pow((el - d.hairFront - 0.2) / 0.35, 2));
            putVert(
              d,
              h.hr,
              h.hrn,
              (i * (HK + 1) + k) * 3,
              surf(d, az, el, lift),
            );
          }
        }
      }
      function setPose(h) {
        const cy = cos(h.yaw),
          sy = sin(h.yaw),
          cp = cos(h.pitch),
          sp = sin(h.pitch),
          c = cos(h.roll),
          s = sin(h.roll);
        h.M = [
          cy * c - sy * sp * s,
          -cy * s - sy * sp * c,
          sy * cp,
          cp * s,
          cp * c,
          sp,
          -sy * c - cy * sp * s,
          sy * s - cy * sp * c,
          cy * cp,
        ];
      }
      function xf(h, p) {
        const m = h.M,
          v = h.pv,
          x = p[0] - v[0],
          y = p[1] - v[1],
          z = p[2] - v[2];
        const X = m[0] * x + m[1] * y + m[2] * z + v[0],
          Y = m[3] * x + m[4] * y + m[5] * z + v[1],
          Z = m[6] * x + m[7] * y + m[8] * z + v[2],
          f = h.S * (1 + Z * 0.11);
        return [h.cx + X * f, h.cy + Y * f, Z, 1];
      }
      function projectSet(h, P, N, out, cand) {
        const m = h.M,
          v = h.pv,
          S = h.S;
        for (let i = 0, o = 0; o < P.length; i++, o += 3) {
          const x = P[o] - v[0],
            y = P[o + 1] - v[1],
            z = P[o + 2] - v[2],
            Z = m[6] * x + m[7] * y + m[8] * z + v[2],
            f = S * (1 + Z * 0.11);
          const sx = h.cx + (m[0] * x + m[1] * y + m[2] * z + v[0]) * f,
            sy = h.cy + (m[3] * x + m[4] * y + m[5] * z + v[1]) * f;
          if (out) {
            out[i * 2] = sx;
            out[i * 2 + 1] = sy;
          }
          const nz = m[6] * N[o] + m[7] * N[o + 1] + m[8] * N[o + 2];
          if (nz < 0.34 && nz > -0.3) cand.push([sx, sy]);
        }
      }
      function projectHead(h) {
        if (abs(h.d.jd - h.jdBuilt) > 0.004) buildSkin(h, 8);
        setPose(h);
        const cand = [];
        projectSet(h, h.sk, h.skn, null, cand);
        if (h.hr) projectSet(h, h.hr, h.hrn, h.hp, cand);
        h.out = chaikin(hull(cand), true, 2);
      }
      // a point on the skin → [screenX, screenY, depth, facing]   (facing > 0 means we can see it)
      function proj(h, az, el, lift) {
        const d = h.d,
          p = surf(d, az, el, lift),
          m = h.M;
        const nx = p[0] / (d.rx * d.rx),
          ny = p[1] / (d.ry * d.ry),
          nz = p[2] / (d.rz * d.rz),
          l = hypot(nx, ny, nz) || 1,
          q = xf(h, p);
        q[3] = (m[6] * nx + m[7] * ny + m[8] * nz) / l;
        return q;
      }
      function runs(pts, thr) {
        const out = [];
        let cur = null;
        thr = thr == null ? 0.04 : thr;
        for (const p of pts) {
          if (p[3] > thr) {
            if (!cur) out.push((cur = []));
            cur.push(p);
          } else cur = null;
        }
        return out;
      }
      function curve(h, fn, n, lift) {
        const pts = [];
        for (let i = 0; i <= n; i++) {
          const a = fn(i / n);
          pts.push(proj(h, a[0], a[1], a[2] == null ? lift : a[2]));
        }
        return pts;
      }
      function strokeOn(h, fn, n, w, seed, lift, thr) {
        for (const r of runs(curve(h, fn, n, lift == null ? 0.012 : lift), thr))
          if (r.length > 1) ink(r, w, seed);
      }
      function loopOn(h, fn, n, lift) {
        const pts = curve(h, fn, n, lift == null ? 0.012 : lift);
        pts.pop();
        return pts;
      }
      const facing = (pts, thr) => {
        let s = 0;
        for (const p of pts) s += p[3];
        return s / pts.length > (thr == null ? 0.1 : thr);
      };

      /* ───────────────────────── 5. features — each one is a function of the head ───────────────────────── */

      const F = {};
      F.eye = (h, s) => {
        const d = h.d,
          e = h.ex,
          az0 = s * d.eyeX,
          el0 = d.eyeY,
          ew = d.eyeW,
          eh = d.eyeH * (1 + e.wide * 0.45),
          sd = h.seed + 100 + s * 7;
        if (d.glasses === "patch" && s === d.noseSide) return;
        if (proj(h, az0, el0, 0.01)[3] < 0.1) return;
        const th = d.eyeTilt * s,
          ct = cos(th),
          st = sin(th),
          at = (u, v) => [az0 + u * ct - v * st, el0 + u * st + v * ct];
        const open = clamp(
          (s < 0 ? e.openL : e.openR) *
            h.blink *
            (1 - e.squeeze) *
            (1 - e.happy),
          0,
          1,
        );
        const round = d.eyeStyle !== "almond",
          up = (x) =>
            round
              ? eh * sqrt(max(0, 1 - x * x))
              : eh * pow(max(0, 1 - x * x), 0.75),
          lo = (x) =>
            round ? -eh * sqrt(max(0, 1 - x * x)) : -eh * 0.62 * (1 - x * x);
        if (e.squeeze > 0.5) {
          ink(
            curve(
              h,
              (u) => {
                const x = abs(u * 2 - 1);
                return at(
                  s * ew * (x * 1.4 - 0.4),
                  (u < 0.5 ? 1 : -1) * eh * 0.75 * x,
                );
              },
              6,
              0.012,
            ),
            1.8,
            sd,
          );
          return;
        }
        if (open < 0.14 || (d.eyeStyle === "dot" && open < 0.4)) {
          const hp = e.happy > 0.4;
          ink(
            curve(
              h,
              (u) => {
                const x = u * 2 - 1;
                return at(x * ew, hp ? eh * 0.55 * (1 - x * x) : lo(x) * 0.55);
              },
              8,
              0.012,
            ),
            1.9,
            sd,
          );
          return;
        }
        const pr = d.pupil * min(ew, eh * 1.35) * (1 + 0.25 * e.wide),
          pu =
            clamp(e.gx * 0.55 - s * e.cross * 0.6, -0.8, 0.8) * (ew - pr * 0.6),
          pv = clamp(e.gy, -0.8, 0.8) * 0.5 * eh - (1 - open) * eh * 0.25;
        const pupil = (r) =>
          loopOn(
            h,
            (u) => at(pu + cos(u * TAU) * r, pv + sin(u * TAU) * r * 1.05),
            10,
            0.014,
          );
        if (d.eyeStyle === "dot") {
          fillPoly(pupil(pr * (1.15 + 0.3 * e.wide)), INK);
          return;
        }
        const lid = (x) => lerp(lo(x), up(x), open),
          N = 9,
          top = curve(h, (u) => at((u * 2 - 1) * ew, lid(u * 2 - 1)), N, 0.012),
          bot = curve(h, (u) => at((1 - u * 2) * ew, lo(1 - u * 2)), N, 0.012),
          all = top.concat(bot.slice(1, -1));
        fillPoly(all, "#faf7ef");
        ctx.save();
        path(all, 1);
        ctx.clip();
        if (e.dizzy > 0.5) {
          const sp = curve(
            h,
            (u) => {
              const a = u * TAU * 2.6 + T * 7 * s,
                r = u * ew * 0.95;
              return at(cos(a) * r, sin(a) * r * 0.9);
            },
            26,
            0.014,
          );
          ink(sp, 1.2, sd + 3, false, 0);
        } else if (d.iris) {
          ink(pupil(pr * 1.75), 0.9, sd + 2, true, 0);
          fillPoly(pupil(pr * 0.62), INK);
        } else fillPoly(pupil(pr), INK);
        if (e.dizzy < 0.5) {
          fillPoly(
            loopOn(
              h,
              (u) =>
                at(
                  pu - pr * 0.27 + cos(u * TAU) * pr * 0.21,
                  pv + pr * 0.3 + sin(u * TAU) * pr * 0.21,
                ),
              8,
              0.018,
            ),
            "#faf5e7",
          );
        }
        ctx.restore();
        ink(top, d.lidHeavy ? 2.5 : 1.6, sd);
        ink(bot, 1, sd + 1);
        if (d.lidHeavy && open < 0.8)
          ink(
            curve(
              h,
              (u) => at((u * 2 - 1) * ew * 0.85, up(u * 2 - 1) * 0.95 + 0.012),
              6,
              0.012,
            ),
            0.8,
            sd + 4,
          );
      };

      const seen = (pts) => pts.filter((p) => p[3] > 0.02);
      F.mouth = (h) => {
        const d = h.d,
          e = h.ex,
          sd = h.seed + 300,
          my = d.mouthY,
          mw = d.mouthW * (1 - 0.6 * e.pucker) * (1 + 0.14 * max(0, e.smile)),
          sm = e.smile * 0.085,
          open = e.mopen * 0.36 + e.pucker * 0.07;
        const wob = (x) => e.dizzy * 0.028 * sin(x * 8 + T * 5),
          base = (x) => my + sm * (x * x - 0.4) + wob(x);
        const up = (u) => {
            const x = u * 2 - 1;
            return [x * mw, base(x) + (1 - x * x) * 0.012 * (1 + 2 * e.pucker)];
          },
          lo = (u) => {
            const x = 1 - u * 2;
            return [x * mw, base(x) - (1 - x * x) * (open + 0.012)];
          };
        if (open < 0.035) {
          strokeOn(h, up, 12, 1.8, sd);
          if (d.lips === "lower")
            strokeOn(
              h,
              (u) => [(u - 0.5) * mw * 0.9, my - 0.078 - sm * 0.2],
              4,
              1,
              sd + 1,
            );
          else if (d.lips === "full")
            strokeOn(
              h,
              (u) => {
                const x = u * 2 - 1;
                return [
                  x * mw * 0.7,
                  my - 0.025 - sm * 0.3 - 0.07 * (1 - x * x),
                ];
              },
              8,
              1.1,
              sd + 1,
            );
          if (e.smile > 0.5)
            for (const s of [-1, 1])
              strokeOn(
                h,
                (u) => [
                  s * (mw + 0.02 + 0.018 * sin(u * PI)),
                  my + sm * 0.6 + (u - 0.5) * 0.08,
                ],
                3,
                1,
                sd + 2 + s,
              );
          return;
        }
        const U = curve(h, up, 10, 0.012),
          L = curve(h, lo, 10, 0.012),
          all = seen(U.concat(L.slice(1, -1)));
        if (all.length < 4) return;
        fillPoly(all, INK);
        ctx.save();
        path(all, 1);
        ctx.clip();
        if (e.mopen > 0.5)
          fillPoly(
            loopOn(
              h,
              (u) => [
                cos(u * TAU) * mw * 0.55,
                my - sm * 0.4 - open * 0.8 + sin(u * TAU) * open * 0.3,
              ],
              12,
              0.012,
            ),
            ACCENT,
          );
        if (e.smile > 0.3 && e.mopen > 0.1 && e.pucker < 0.3) {
          const th = min(0.045, open * 0.5),
            Tt = curve(
              h,
              (u) => {
                const x = 1 - u * 2,
                  p = up(1 - u);
                return [p[0], p[1] - th * sqrt(max(0, 1 - x * x))];
              },
              10,
              0.012,
            );
          fillPoly(seen(U.concat(Tt)), PAPER);
        }
        ctx.restore();
        ink(all, 1.2, sd, true);
      };

      /* All attachments share the skull's transform, including the bits that stick out. */
      function ovalOn(h, x, y, rx, ry, color, seed, tilt = 0, lift = 0.024) {
        const c = cos(tilt),
          s = sin(tilt),
          pts = loopOn(
            h,
            (u) => {
              const a = u * TAU,
                U = cos(a) * rx,
                V = sin(a) * ry;
              return [x + U * c - V * s, y + U * s + V * c];
            },
            22,
            lift,
          );
        if (facing(pts, 0.02)) {
          fillPoly(seen(pts), color);
          if (seed != null) {
            ctx.fillStyle = INK;
            ink(seen(pts), 0.75, seed, true, 0.13);
          }
        }
      }
      function blob3(h, c, rx, ry, rz, col, sd, width = 1.2) {
        const m = h.M,
          n = [m[6] * rx, m[7] * ry, m[8] * rz],
          len = hypot(...n) || 1;
        for (let i = 0; i < 3; i++) n[i] /= len;
        let u = abs(n[1]) < 0.95 ? [n[2], 0, -n[0]] : [1, 0, 0],
          ul = hypot(...u) || 1;
        u = u.map((v) => v / ul);
        const v = [
            n[1] * u[2] - n[2] * u[1],
            n[2] * u[0] - n[0] * u[2],
            n[0] * u[1] - n[1] * u[0],
          ],
          pts = [];
        for (let i = 0; i < 24; i++) {
          const a = (i / 24) * TAU;
          pts.push(
            xf(h, [
              c[0] + rx * (u[0] * cos(a) + v[0] * sin(a)),
              c[1] + ry * (u[1] * cos(a) + v[1] * sin(a)),
              c[2] + rz * (u[2] * cos(a) + v[2] * sin(a)),
            ]),
          );
        }
        fillPoly(pts, col);
        if (width) {
          ctx.fillStyle = INK;
          ink(pts, width, sd, true, 0.21);
        }
        return pts;
      }
      function line3(h, points, w, sd, color = INK) {
        ctx.fillStyle = color;
        ink(
          points.map((p) => xf(h, p)),
          w,
          sd,
          false,
          0.22,
        );
        ctx.fillStyle = INK;
      }
      function curve3(h, fn, n, w, sd, color = INK) {
        const ps = [];
        for (let i = 0; i <= n; i++) ps.push(fn(i / n));
        line3(h, ps, w, sd, color);
      }
      function poly3(h, pts, color, sd, w = 1.25) {
        const p = pts.map((a) => xf(h, a));
        fillPoly(p, color);
        if (w) ink(p, w, sd, true, 0.22);
      }
      const smooth3 = (points, it = 2) => {
        let p = points;
        for (let k = 0; k < it; k++) {
          const q = [];
          for (let i = 0; i < p.length; i++) {
            const a = p[i],
              b = p[(i + 1) % p.length];
            q.push(
              a.map((v, j) => v * 0.75 + b[j] * 0.25),
              a.map((v, j) => v * 0.25 + b[j] * 0.75),
            );
          }
          p = q;
        }
        return p;
      };
      function ear(h, s, pass) {
        const d = h.d,
          kind = d.sp.ear,
          r = d.rx,
          S = d.seed,
          ec = [s * r * 0.76, -d.ry * 0.65, 0.025],
          front = xf(h, ec)[2] > -0.03;
        if (front !== (pass === 1)) return;
        const twitch = h.ear[s > 0 ? 1 : 0],
          a = twitch + s * 0.08 * sin(T * 1.2 + d.phase),
          cc = cos(a),
          ss = sin(a),
          map = (x, y, z) => [
            ec[0] + s * (x * cc - y * ss),
            ec[1] + x * ss + y * cc,
            ec[2] + z,
          ];
        let points, inner;
        const dark = d.kind === "panda" ? "#4b4b41" : d.fur;
        if (kind === "round" || kind === "small" || kind === "fuzz") {
          const rr = kind === "small" ? 0.22 : kind === "fuzz" ? 0.47 : 0.33,
            c = map(0.12, -0.07, 0);
          blob3(
            h,
            c,
            rr,
            rr * (kind === "fuzz" ? 1.05 : 1),
            0.19,
            dark,
            S + s,
            1.3,
          );
          if (xf(h, map(0.12, -0.07, 0.15))[2] > -0.12) {
            blob3(
              h,
              map(0.12, -0.07, 0.14),
              rr * 0.58,
              rr * 0.66,
              0.08,
              d.kind === "panda" ? "#706b5e" : d.light,
              S + s + 5,
              0.7,
            );
            if (kind === "fuzz")
              for (let j = 0; j < 9; j++) {
                const a = (j / 9) * TAU;
                line3(
                  h,
                  [
                    map(
                      0.12 + cos(a) * rr * 0.72,
                      -0.07 + sin(a) * rr * 0.8,
                      0.12,
                    ),
                    map(0.12 + cos(a) * rr * 0.94, -0.07 + sin(a) * rr, 0.08),
                  ],
                  0.65,
                  S + j,
                );
              }
          }
          return;
        }
        if (kind === "long") {
          const len = d.earLen * (s === d.flopSide ? 0.99 : 1.17),
            fold = (s === d.flopSide ? 0.26 : 0.06) + max(0, h.ex.happy) * 0.12;
          points = [
            [-0.18, 0.2, 0],
            [-0.24, -0.46 * len, 0.03],
            [-0.14, -1.29 * len, 0.04],
            [0.05, -1.39 * len, 0.07],
            [0.26, -1.12 * len, 0.06],
            [0.2 + fold, -0.55 * len, 0.06],
            [0.2, 0.2, 0.05],
          ];
          inner = [
            [-0.04, 0.06, 0.08],
            [-0.12, -0.52 * len, 0.1],
            [-0.04, -1.13 * len, 0.11],
            [0.075, -1.2 * len, 0.11],
            [0.14, -1.01 * len, 0.11],
            [0.1 + fold * 0.6, -0.53 * len, 0.11],
            [0.08, 0.04, 0.09],
          ];
        } else if (kind === "flop") {
          const len = d.earLen * (s === d.flopSide ? 1.07 : 0.93),
            f = 0.1 * sin(T * 2 + d.phase) + twitch * 0.9;
          points = [
            [-0.24, -0.15, 0.04],
            [0.16, -0.28, 0.02],
            [0.42, 0.0, 0.04],
            [0.53 + f, 0.66 * len, 0.09],
            [0.34 + f, 0.97 * len, 0.17],
            [0.04, 0.91 * len, 0.25],
            [-0.05, 0.58 * len, 0.3],
            [-0.09, 0.13, 0.2],
          ];
          inner = [
            [0.1, 0.0, 0.1],
            [0.25, 0.02, 0.1],
            [0.35 + f, 0.61 * len, 0.21],
            [0.23 + f, 0.75 * len, 0.24],
            [0.13, 0.65 * len, 0.27],
          ];
        } else if (kind === "side" || kind === "leaf") {
          points = [
            [-0.09, 0.1, 0],
            [0.07, -0.23, 0.02],
            [0.53, -0.37, 0.03],
            [0.76, -0.16, 0.03],
            [0.48, 0.16, 0.1],
            [0.13, 0.22, 0.1],
          ];
          inner = [
            [0.07, 0.07, 0.1],
            [0.2, -0.09, 0.12],
            [0.53, -0.16, 0.12],
            [0.36, 0.07, 0.15],
          ];
        } else if (kind === "fold") {
          points = [
            [-0.22, 0.1, 0.01],
            [-0.13, -0.42, 0.02],
            [0.11, -0.64, 0.07],
            [0.4, -0.17, 0.12],
            [0.24, 0.21, 0.18],
            [0.1, -0.1, 0.21],
          ];
          inner = [
            [-0.02, -0.06, 0.12],
            [0.05, -0.41, 0.13],
            [0.21, -0.12, 0.2],
            [0.2, 0.07, 0.21],
          ];
        } else {
          const e = d.kind === "fox" ? 1.17 : d.kind === "raccoon" ? 0.74 : 1;
          points = [
            [-0.25, 0.12, 0],
            [-0.2, -0.3 * e, 0.02],
            [0.02, -0.67 * e, 0.02],
            [0.18, -0.59 * e, 0.03],
            [0.34, -0.07 * e, 0.04],
            [0.25, 0.22, 0.06],
          ];
          inner = [
            [-0.08, 0.02, 0.075],
            [-0.08, -0.23 * e, 0.08],
            [0.055, -0.48 * e, 0.08],
            [0.2, -0.07 * e, 0.1],
            [0.15, 0.08, 0.1],
          ];
        }
        poly3(h, smooth3(points.map((p) => map(...p))), dark, S + s + 20, 1.35);
        if (front || abs(h.yaw) < 0.9)
          poly3(
            h,
            smooth3(inner.map((p) => map(...p))),
            d.kind === "dog"
              ? "#815c42"
              : d.kind === "fox"
                ? "#604d3a"
                : "#d8b3a0",
            S + s + 30,
            0.65,
          );
      }
      function antlers(h, pass) {
        if (h.d.kind !== "deer" || h.d.mark < 0.28) return;
        for (const s of [-1, 1]) {
          const front = xf(h, [s * 0.5, -0.8, 0])[2] > 0;
          if (front !== (pass === 1)) continue;
          line3(
            h,
            [
              [s * 0.44, -0.65, -0.1],
              [s * 0.52, -1.04, -0.14],
              [s * 0.55, -1.3, -0.1],
              [s * 0.71, -1.57, -0.08],
            ],
            4,
            h.seed + 202,
            "#8d7757",
          );
          line3(
            h,
            [
              [s * 0.55, -1.18, -0.11],
              [s * 0.89, -1.33, -0.1],
              [s * 0.98, -1.53, -0.07],
            ],
            2.7,
            h.seed + 203,
            "#8d7757",
          );
          line3(
            h,
            [
              [s * 0.58, -1.32, -0.1],
              [s * 0.34, -1.47, -0.08],
              [s * 0.34, -1.63, -0.08],
            ],
            2.3,
            h.seed + 204,
            "#8d7757",
          );
        }
      }
      function wool(h, pass) {
        if (h.d.kind !== "sheep") return;
        for (let i = 0; i < 11; i++) {
          const a = (i / 11) * TAU,
            p = [cos(a) * h.d.rx * 0.84, -0.15 + sin(a) * h.d.ry * 0.81, -0.14],
            front = xf(h, p)[2] > 0.14;
          if (front !== (pass === 1)) continue;
          blob3(h, p, 0.29, 0.3, 0.23, h.d.fur, h.seed + i + 900, 1.1);
        }
      }
      function markings(h) {
        const d = h.d,
          S = h.seed;
        if (d.kind === "panda")
          for (const s of [-1, 1])
            ovalOn(
              h,
              s * d.eyeX,
              d.eyeY - 0.01,
              0.25,
              0.285,
              "#555347",
              S + 10 + s,
              s * 0.42,
            );
        if (d.kind === "raccoon") {
          for (const s of [-1, 1]) {
            ovalOn(h, s * 0.46, 0.12, 0.4, 0.19, d.light, null, -s * 0.12);
            ovalOn(h, s * 0.47, 0.035, 0.4, 0.15, "#53574c", null, s * 0.08);
          }
          ovalOn(h, 0, -0.1, 0.16, 0.48, d.light, null);
        }
        if (d.kind === "fox")
          for (const s of [-1, 1]) {
            const p = loopOn(
              h,
              (u) => {
                const a = u * TAU;
                return [s * (0.49 + cos(a) * 0.5), -0.44 + sin(a) * 0.28];
              },
              24,
              0.012,
            );
            if (facing(p, 0.0)) fillPoly(seen(p), d.light);
          }
        if (d.kind === "cat") {
          ctx.fillStyle = "#8b714d";
          for (let j = -1; j <= 1; j++)
            strokeOn(
              h,
              (t) => [j * 0.23 * (1 - t * 0.3), 0.72 - t * 0.33],
              7,
              2.9 - abs(j) * 0.4,
              S + 33 + j,
              0.022,
            );
          for (const s of [-1, 1])
            for (let j = 0; j < 2; j++)
              strokeOn(
                h,
                (t) => [s * (0.71 + t * 0.3), -0.16 - j * 0.15 + t * 0.05],
                7,
                2.5,
                S + 42 + j + s,
                0.018,
              );
          ctx.fillStyle = INK;
        }
        if (d.kind === "dog" && d.mark > 0.23)
          ovalOn(h, -d.eyeX, 0.12, 0.32, 0.43, "#8a6449", null, -0.12);
        if (d.kind === "otter") ovalOn(h, 0, -0.4, 0.86, 0.33, d.light, null);
        if (d.kind === "deer") {
          for (const s of [-1, 1]) {
            ovalOn(h, s * 0.61, -0.1, 0.24, 0.34, d.light, null, -s * 0.2);
            for (let j = 0; j < 3; j++)
              ovalOn(
                h,
                s * (0.64 + j * 0.07),
                0.29 + j * 0.11,
                0.044,
                0.055,
                "#f7ecd5",
                null,
              );
          }
        }
        if (d.kind === "bunny" && d.mark > 0.48)
          ovalOn(
            h,
            d.flopSide * 0.4,
            0.42,
            0.22,
            0.4,
            "#d4cab9",
            null,
            d.flopSide * 0.16,
          );
        if (d.kind === "sheep") {
          const rim = [];
          for (let i = 0; i <= 28; i++) {
            const t = i / 28,
              az = lerp(-0.87, 0.87, t),
              el = 0.72 + 0.06 * sin(t * TAU * 6);
            rim.push(proj(h, az, el, 0.065));
          }
          const top = curve(h, (u) => [lerp(0.87, -0.87, u), 1.25], 20, 0.06);
          fillPoly(seen(rim.concat(top)), d.fur);
          for (const r of runs(rim, 0.01)) ink(r, 1.05, S + 80);
          for (let i = 0; i < 5; i++)
            strokeOn(
              h,
              (u) => [
                (i - 2) * 0.24 + sin(u * PI * 1.35) * 0.085,
                0.93 + cos(u * PI * 1.35) * 0.1,
              ],
              10,
              0.7,
              S + i + 89,
              0.073,
              0.07,
            );
        }
      }
      function furDetails(h) {
        const d = h.d;
        ctx.save();
        ctx.globalAlpha = 0.47;
        ctx.fillStyle = INK;
        const r = RNG(h.seed + 471);
        for (let i = 0; i < 22; i++) {
          const side = i & 1 ? 1 : -1,
            az = side * r.range(0.78, 1.23),
            el = r.range(-0.51, 0.42),
            len = r.range(0.035, 0.065);
          strokeOn(
            h,
            (u) => [az + side * u * 0.045, el - u * len],
            3,
            0.53,
            h.seed + i + 881,
            0.016,
            0.11,
          );
        }
        if (["cat", "fox", "dog", "bear", "otter", "raccoon"].includes(d.kind))
          for (let i = 0; i < 5; i++) {
            const x = (i - 2) * 0.09;
            strokeOn(
              h,
              (u) => [x + u * 0.018, 0.88 + u * 0.09],
              4,
              0.65,
              h.seed + i + 921,
              0.018,
              0.09,
            );
          }
        ctx.restore();
        ctx.fillStyle = INK;
      }
      const muzzleCenter = (h) => {
        const d = h.d;
        return [0, 0.23, d.rz * 0.9 + d.sp.muzzle * 0.7];
      };
      function noseTip(h) {
        const p = muzzleCenter(h);
        return xf(h, [0, p[1] - 0.055, p[2] + 0.15]);
      }
      const mouthPos = (h) =>
        xf(h, [0, 0.44, h.d.rz * 0.89 + h.d.sp.muzzle * 0.68]);
      function muzzle(h, pass) {
        const d = h.d,
          k = d.kind,
          base = proj(h, 0, -0.2, 0);
        if ((base[3] > 0 ? 1 : 0) !== pass || base[3] < -0.4) return;
        const c = muzzleCenter(h),
          face = h.M[8] > -0.05,
          ns =
            k === "fox" || k === "dog"
              ? 0.145
              : k === "bear"
                ? 0.16
                : k === "koala"
                  ? 0.22
                  : 0.11;
        if (k === "pig") {
          blob3(
            h,
            [0, 0.25, d.rz + 0.14],
            0.34,
            0.24,
            0.19,
            "#d89684",
            h.seed + 700,
            1.45,
          );
          if (face)
            for (const s of [-1, 1])
              blob3(
                h,
                [s * 0.125, 0.25, d.rz + 0.325],
                0.046,
                0.072,
                0.012,
                "#865b4d",
                h.seed + s,
                0,
              );
        } else if (k === "koala") {
          blob3(
            h,
            [0, 0.17, d.rz + 0.05],
            0.22,
            0.29,
            0.15,
            "#505249",
            h.seed + 701,
            1.3,
          );
          if (face)
            curve3(
              h,
              (u) => [
                -0.08 + u * 0.1,
                -0.025 + sin(u * PI) * -0.015,
                d.rz + 0.18,
              ],
              5,
              0.9,
              h.seed + 17,
              "#9da294",
            );
        } else {
          const mw = k === "fox" ? 0.29 : k === "bunny" ? 0.23 : 0.31,
            my = k === "fox" ? 0.19 : 0.2;
          if (k === "bear" || k === "dog")
            blob3(
              h,
              [0, 0.32, c[2] - 0.04],
              0.46,
              0.34,
              0.2,
              d.light,
              h.seed + 640,
              0.7,
            );
          else
            for (const s of [-1, 1])
              blob3(
                h,
                [s * mw * 0.46, c[1] + 0.1, c[2] - 0.012],
                mw,
                my,
                0.14,
                d.light,
                h.seed + 640 + s,
                0.65,
              );
          blob3(
            h,
            [0, c[1] - 0.045, c[2] + 0.12],
            ns,
            ns * 0.68,
            0.075,
            k === "bunny" || k === "cat" ? "#a17b71" : "#45463c",
            h.seed + 700,
            1.1,
          );
          if (face) {
            curve3(
              h,
              (u) => [
                -ns * 0.35 + u * ns * 0.55,
                c[1] - 0.069 - sin(u * PI) * 0.018,
                c[2] + 0.186,
              ],
              4,
              0.6,
              h.seed + 17,
              "#dbd2b8",
            );
            line3(
              h,
              [
                [0, c[1] + 0.01, c[2] + 0.16],
                [0, c[1] + 0.12, c[2] + 0.13],
              ],
              0.9,
              h.seed + 711,
            );
            for (const s of [-1, 1])
              curve3(
                h,
                (u) => [
                  s * u * 0.16,
                  c[1] + 0.12 + sin(u * PI) * 0.06,
                  c[2] + 0.12 - 0.045 * u,
                ],
                8,
                1.05,
                h.seed + s + 721,
              );
          }
        }
        if (pass === 1 && face) {
          const open = h.ex.mopen * (1 - 0.45 * h.ex.happy),
            sm = h.ex.smile;
          if (open > 0.06) {
            const y = 0.44 + open * 0.08,
              z = c[2] + 0.055;
            blob3(
              h,
              [0, y, z],
              0.15 * (1 + sm * 0.2),
              max(0.026, open * 0.2),
              0.025,
              INK,
              h.seed + 722,
              0.4,
            );
            if (open > 0.24)
              blob3(
                h,
                [0, y + open * 0.1, z + 0.032],
                0.105,
                open * 0.105,
                0.016,
                "#d49a8c",
                h.seed + 723,
                0.6,
              );
          }
          if (h.ex.pucker > 0.3 && h.act?.name !== "gum") {
            blob3(
              h,
              [0, 0.43, c[2] + 0.095],
              0.084,
              0.068,
              0.033,
              d.light,
              h.seed + 739,
              1,
            );
            blob3(
              h,
              [0, 0.43, c[2] + 0.134],
              0.039,
              0.032,
              0.01,
              INK,
              h.seed + 740,
              0,
            );
          }
          if (h.ex.blep > 0.01) {
            const b = h.ex.blep;
            blob3(
              h,
              [0, 0.43 + b * 0.085, c[2] + 0.09],
              0.084,
              0.055 + b * 0.1,
              0.035,
              "#d69686",
              h.seed + 733,
              0.8,
            );
            line3(
              h,
              [
                [0, 0.43, c[2] + 0.13],
                [0, 0.48 + b * 0.11, c[2] + 0.13],
              ],
              0.55,
              h.seed + 734,
              "#aa786c",
            );
          }
          if (k === "bunny" && open < 0.26) {
            const ps = [
              [-0.084, 0.41, c[2] + 0.065],
              [0.084, 0.41, c[2] + 0.065],
              [0.071, 0.53, c[2] + 0.065],
              [-0.067, 0.53, c[2] + 0.065],
            ];
            poly3(h, ps, "#faf7ee", h.seed + 725, 0.7);
            line3(
              h,
              [
                [0, 0.425, c[2] + 0.075],
                [0, 0.52, c[2] + 0.075],
              ],
              0.6,
              h.seed + 726,
            );
          }
          if (d.sp.whiskers) {
            const shiver =
              sin(T * (h.act?.name === "sniff" ? 29 : 3) + d.phase) * 0.012 +
              (h.ear[0] - h.ear[1]) * 0.06;
            for (const s of [-1, 1]) {
              for (let i = 0; i < 3; i++) {
                const a = [s * 0.22, 0.29 + i * 0.065, c[2] + 0.065],
                  b = [s * 0.88, 0.19 + i * 0.15 + shiver, c[2] - 0.18];
                curve3(
                  h,
                  (u) => [
                    lerp(a[0], b[0], u),
                    lerp(a[1], b[1], u) - sin(u * PI) * 0.035,
                    lerp(a[2], b[2], u),
                  ],
                  8,
                  0.62,
                  h.seed + s * 10 + i,
                );
              }
              for (let i = 0; i < 3; i++) {
                const p = xf(h, [
                  s * (0.19 + i * 0.045),
                  0.27 + (i % 2) * 0.075,
                  c[2] + 0.1,
                ]);
                dot(p[0], p[1], 0.65);
              }
            }
          }
        }
      }
      function blush(h) {
        const a = h.affection * 0.32 + (h.act?.name === "boop" ? 0.12 : 0);
        if (a < 0.015) return;
        ctx.globalAlpha = min(0.38, a);
        for (const s of [-1, 1])
          ovalOn(h, s * 0.64, -0.23, 0.15, 0.085, "#c96c53", null);
        ctx.globalAlpha = 1;
      }
      function brows(h) {
        const e = h.ex,
          d = h.d;
        for (const s of [-1, 1]) {
          ctx.fillStyle = INK;
          strokeOn(
            h,
            (u) => [
              s * d.eyeX + (u - 0.5) * 0.21,
              d.eyeY + d.eyeH + 0.115 + e.brow * 0.09 + 0.025 * sin(u * PI),
            ],
            6,
            0.9,
            h.seed + 110 + s,
            0.035,
            0.11,
          );
        }
      }
      function bib(h) {
        const d = h.d,
          S = h.S,
          x = h.bx,
          y = h.by,
          sd = h.seed;
        const P = (u, v) => [x + u * S, y + v * S],
          outer = chaikin(
            [
              P(-0.35, 0.64),
              P(-0.36, 0.85),
              P(-0.64, 1.03),
              P(-0.76, 1.16),
              P(-0.3, 1.23),
              P(0.2, 1.22),
              P(0.74, 1.16),
              P(0.64, 1.03),
              P(0.36, 0.85),
              P(0.35, 0.64),
            ],
            true,
            2,
          );
        fillPoly(outer, d.fur);
        ctx.fillStyle = INK;
        ink(
          chaikin(
            [P(-0.35, 0.65), P(-0.36, 0.85), P(-0.63, 1.03), P(-0.75, 1.15)],
            false,
            2,
          ),
          1.05,
          sd + 950,
        );
        ink(
          chaikin(
            [P(0.35, 0.65), P(0.36, 0.85), P(0.63, 1.03), P(0.75, 1.15)],
            false,
            2,
          ),
          1.05,
          sd + 951,
        );
        ctx.save();
        ctx.globalAlpha = 0.6;
        for (const s of [-1, 1])
          for (let j = 0; j < 3; j++)
            ink(
              [
                P(s * (0.36 + j * 0.06), 1.02 + j * 0.016),
                P(s * (0.4 + j * 0.065), 1.12 + j * 0.006),
              ],
              0.55,
              sd + j + s,
            );
        ctx.restore();
        if (d.scarf) {
          const q = [
            P(-0.4, 0.89),
            P(-0.02, 1.01),
            P(0.4, 0.87),
            P(0.36, 1.03),
            P(0.02, 1.15),
            P(-0.37, 1.04),
          ];
          fillPoly(q, d.scarfColor);
          ink(q, 0.95, sd + 955, true);
          const tail = [
            P(0.18, 1.04),
            P(0.39, 1.33),
            P(0.2, 1.32),
            P(0.08, 1.08),
          ];
          fillPoly(tail, d.scarfColor);
          ink(tail, 0.8, sd + 956, true);
        }
      }
      function paw(h, s, wave) {
        const S = h.S,
          phase = wave ? sin(h.act.t * 14) * 0.23 : 0,
          x = h.cx + s * S * (wave ? 1.02 : 0.65),
          y = h.cy + S * (wave ? 0.12 : 0.9),
          r = S * 0.22;
        ctx.save();
        ctx.translate(x, y);
        ctx.rotate(s * (-0.3 + phase));
        const pts = [];
        for (let i = 0; i < 24; i++) {
          const a = (i / 24) * TAU;
          pts.push([cos(a) * r, sin(a) * r * 1.15]);
        }
        fillPoly(pts, h.d.fur);
        ink(pts, 1.2, h.seed + s + 961, true);
        if (wave) {
          ctx.fillStyle = "#c6937f";
          ctx.beginPath();
          ctx.ellipse(0, r * 0.21, r * 0.35, r * 0.4, 0, 0, TAU);
          ctx.fill();
          for (let i = -1; i <= 1; i++) {
            ctx.beginPath();
            ctx.ellipse(
              i * r * 0.48,
              -r * 0.39 + abs(i) * r * 0.12,
              r * 0.17,
              r * 0.22,
              -i * 0.2,
              0,
              TAU,
            );
            ctx.fill();
          }
        } else
          for (let i = -1; i <= 1; i++)
            ink(
              [
                [i * r * 0.43, r * 0.36],
                [i * r * 0.43, r * 0.75],
              ],
              0.55,
              h.seed + i + 973,
            );
        ctx.restore();
        ctx.fillStyle = INK;
      }
      function star(x, y, r, rot) {
        const p = [];
        for (let i = 0; i < 10; i++) {
          const a = rot + (i * PI) / 5,
            q = i & 1 ? r * 0.42 : r;
          p.push([x + cos(a) * q, y + sin(a) * q]);
        }
        fillPoly(p, "#b4a063");
        ink(p, 0.7, 7, true, 0);
      }
      function drawHead(h) {
        const d = h.d;
        SC = h.S / 62;
        BOIL = reduced ? 0 : floor(T * 4 + d.phase) % 3;
        ctx.fillStyle = INK;
        h.cx = h.bx;
        h.cy =
          h.by - h.hop + (reduced ? 0 : sin(T * 1.5 + d.phase) * h.S * 0.009);
        projectHead(h);
        ear(h, -1, 0);
        ear(h, 1, 0);
        antlers(h, 0);
        wool(h, 0);
        muzzle(h, 0);
        fillPoly(h.out, d.fur);
        markings(h);
        furDetails(h);
        blush(h);
        brows(h);
        F.eye(h, -1);
        F.eye(h, 1);
        ctx.fillStyle = INK;
        ink(h.out, 1.55, h.seed + 20, true, 0.29);
        ear(h, -1, 1);
        ear(h, 1, 1);
        antlers(h, 1);
        wool(h, 1);
        muzzle(h, 1);
        if (
          h.act?.name === "gum" &&
          h.act.t > 1.25 &&
          h.act.t < 4 &&
          h.M[8] > -0.1
        ) {
          const q = (h.act.t - 1.25) / 2.75,
            rad = 0.045 + q * q * 0.49,
            p = muzzleCenter(h);
          ctx.save();
          ctx.globalAlpha = 0.88;
          blob3(
            h,
            [0, 0.4, p[2] + rad * 0.95],
            rad,
            rad * 0.97,
            rad,
            "#e4b6ab",
            h.seed + 994,
            1.0,
          );
          ctx.restore();
          const cc = xf(h, [0, 0.4, p[2] + rad * 0.95]);
          SC = h.S / 62;
          ctx.fillStyle = "#f8e9da";
          const lp = [];
          for (let n = 0; n < 7; n++) {
            const a = -2.4 + n * 0.13;
            lp.push([
              cc[0] + cos(a) * rad * h.S * 0.69,
              cc[1] + sin(a) * rad * h.S * 0.69,
            ]);
          }
          ink(lp, 1.1, h.seed + 995);
          ctx.fillStyle = INK;
        }
        if (h.act?.name === "dizzy")
          for (let i = 0; i < 3; i++) {
            const a = T * 4 + (i * TAU) / 3;
            star(
              h.cx + cos(a) * h.S * 0.85,
              h.cy - h.S * 1.12 + sin(a) * h.S * 0.17,
              h.S * 0.12,
              a,
            );
          }
        if (h.act?.name === "eat" && h.act.t < 0.42) {
          const p = mouthPos(h);
          drawSnack(p[0], p[1] + h.S * 0.23, h.S * 0.26, d.sp.food, -0.2);
        }
      }
      function drawHeart(x, y, r, rot = 0) {
        ctx.save();
        ctx.translate(x, y);
        ctx.rotate(rot);
        ctx.beginPath();
        ctx.moveTo(0, r * 0.8);
        ctx.bezierCurveTo(
          -r * 1.5,
          -r * 0.14,
          -r * 0.72,
          -r * 1.06,
          0,
          -r * 0.35,
        );
        ctx.bezierCurveTo(r * 0.72, -r * 1.06, r * 1.5, -r * 0.14, 0, r * 0.8);
        ctx.fillStyle = ACCENT;
        ctx.fill();
        ctx.restore();
        ctx.fillStyle = INK;
      }
      function drawSnack(x, y, size, type, rot = 0) {
        ctx.save();
        ctx.translate(x, y);
        ctx.rotate(rot);
        SC = size / 15;
        BOIL = 0;
        ctx.lineWidth = 1.1 * SC;
        ctx.strokeStyle = INK;
        ctx.fillStyle = "#c7a471";
        const oval = (x, y, rx, ry, color) => {
          ctx.beginPath();
          ctx.ellipse(x * SC, y * SC, rx * SC, ry * SC, 0, 0, TAU);
          ctx.fillStyle = color;
          ctx.fill();
          ctx.stroke();
        };
        if (type === "carrot") {
          fillPoly(
            [
              [-5 * SC, -8 * SC],
              [7 * SC, -6 * SC],
              [-2 * SC, 14 * SC],
            ],
            "#c78352",
          );
          ctx.fillStyle = INK;
          ink(
            [
              [-5 * SC, -8 * SC],
              [7 * SC, -6 * SC],
              [-2 * SC, 14 * SC],
              [-5 * SC, -8 * SC],
            ],
            1,
            34,
          );
          ctx.fillStyle = "#7d9471";
          for (let i = -1; i <= 1; i++)
            ink(
              [
                [SC, -7 * SC],
                [i * 5 * SC, (-14 + abs(i) * 2) * SC],
              ],
              2,
              i + 5,
            );
          ctx.fillStyle = INK;
          ink(
            [
              [-3 * SC, -1 * SC],
              [2 * SC, 0],
            ],
            0.7,
            6,
          );
        } else if (type === "fish") {
          polySnack(
            [
              [-9, 0],
              [-16, -7],
              [-16, 7],
            ],
            "#a2b7b4",
          );
          oval(0, 0, 12, 7, "#b8ccc5");
          ctx.fillStyle = INK;
          dot(7 * SC, -1 * SC, 1);
          ink(
            [
              [0, -5 * SC],
              [2 * SC, 0],
              [0, 5 * SC],
            ],
            0.6,
            9,
          );
        } else if (type === "leaf" || type === "bamboo") {
          ctx.fillStyle = "#879e76";
          const p = [
            [-12 * SC, 7 * SC],
            [-10 * SC, -4 * SC],
            [3 * SC, -11 * SC],
            [13 * SC, -7 * SC],
            [8 * SC, 6 * SC],
            [-12 * SC, 7 * SC],
          ];
          fillPoly(chaikin(p, true, 2), "#96a986");
          ctx.fillStyle = INK;
          ink(
            [
              [-13 * SC, 9 * SC],
              [9 * SC, -6 * SC],
            ],
            0.8,
            4,
          );
          if (type === "bamboo") {
            ctx.fillStyle = "#8b9b67";
            ink(
              [
                [-9 * SC, 14 * SC],
                [11 * SC, -13 * SC],
              ],
              3,
              5,
            );
          }
        } else if (type === "apple" || type === "berry") {
          oval(-4, 2, 8, 10, type === "berry" ? "#948aa1" : "#c28363");
          oval(4, 2, 8, 10, type === "berry" ? "#948aa1" : "#c28363");
          ctx.fillStyle = INK;
          ink(
            [
              [0, -6 * SC],
              [SC, -13 * SC],
            ],
            1.3,
            4,
          );
          ctx.fillStyle = "#87966b";
          ink(
            [
              [SC, -10 * SC],
              [7 * SC, -12 * SC],
            ],
            3,
            5,
          );
        } else if (type === "honey") {
          oval(0, 0, 11, 12, "#d2b365");
          ctx.fillStyle = "#c7a251";
          ink(
            [
              [-8 * SC, -9 * SC],
              [8 * SC, -9 * SC],
            ],
            3,
            5,
          );
          ctx.fillStyle = INK;
          ctx.font = `italic ${11 * SC}px Georgia`;
          ctx.textAlign = "center";
          ctx.fillText("h", 0, 4 * SC);
        } else {
          oval(0, 0, 12, 10, "#c7a471");
          ctx.fillStyle = INK;
          for (let i = 0; i < 5; i++)
            dot(
              (hash(i + 4) - 0.5) * 14 * SC,
              (hash(i + 50) - 0.5) * 11 * SC,
              1,
            );
        }
        ctx.restore();
        ctx.fillStyle = INK;
        function polySnack(p, c) {
          fillPoly(
            p.map(([x, y]) => [x * SC, y * SC]),
            c,
          );
          ink(
            p.map(([x, y]) => [x * SC, y * SC]),
            1,
            7,
            true,
          );
        }
      }

      /* A little society. Eyes lead; skulls, ears, and feelings take a moment to catch up. */
let T=0;const reduced=false,rainOn=false;
      function makeHead(seed, index, x, y, S, col, row) {
        const d = makeDNA(seed, index),
          r = RNG(seed ^ 0x96ab13),
          h = {
            seed,
            d,
            r,
            index,
            bx: x,
            by: y,
            cx: x,
            cy: y,
            S,
            col,
            row,
            yaw: r.range(-0.14, 0.14),
            pitch: 0,
            roll: 0,
            hop: 0,
            vyaw: 0,
            vpitch: 0,
            vroll: 0,
            vhop: 0,
            pv: [0, d.ry * 0.5, -d.rz * 0.12],
            blink: 1,
            ear: [0, 0],
            vear: [0, 0],
            affection: 0,
            lastPet: -90,
            lastBoop: -90,
            petCount: 0,
            ex: {
              openL: 1,
              openR: 1,
              wide: 0,
              gx: 0,
              gy: 0,
              brow: 0,
              frown: 0,
              smile: d.mood,
              mopen: 0,
              pucker: 0,
              dizzy: 0,
              cross: 0,
              happy: 0,
              squeeze: 0,
              blep: 0,
            },
            tg: {},
            act: null,
            pending: null,
            nextAct: r.range(2, 10),
            blinkAt: r.range(0.4, 5),
            blinkT: -9,
            wander: { x, y, until: 0 },
          };
        buildSkin(h, NE);
        return h;
      }
      function line(points, w = 1, seed = 1, color = INK) {
        if (points.length === 2)
          points = [
            points[0],
            [
              (points[0][0] + points[1][0]) / 2,
              (points[0][1] + points[1][1]) / 2,
            ],
            points[1],
          ];
        ctx.fillStyle = color;
        ink(points, w, seed, false, 0.28);
        ctx.fillStyle = INK;
      }
      function box(x, y, w, h, col = PAPER, lw = 1.3, seed = 1) {
        const p = [
          [x, y],
          [x + w, y],
          [x + w, y + h],
          [x, y + h],
        ];
        fillPoly(p, col);
        if (lw) ink(p, lw, seed, true, 0.2);
      }
      function oval(x, y, rx, ry, color, lw = 1, seed = 1) {
        const p = [];
        for (let i = 0; i < 28; i++) {
          const a = (i / 28) * TAU;
          p.push([x + cos(a) * rx, y + sin(a) * ry]);
        }
        fillPoly(p, color);
        if (lw) ink(p, lw, seed, true, 0.2);
      }
      function ik(ax, ay, bx, by, l1, l2, bend) {
        let dx = bx - ax,
          dy = by - ay,
          d = hypot(dx, dy) || 0.01;
        if (d > l1 + l2 - 0.05) {
          const k = (l1 + l2 - 0.05) / d;
          dx *= k;
          dy *= k;
          d = l1 + l2 - 0.05;
        }
        const a = (l1 * l1 - l2 * l2 + d * d) / (2 * d),
          hh = sqrt(max(0, l1 * l1 - a * a)),
          ux = dx / d,
          uy = dy / d;
        return [
          ax + ux * a - uy * hh * bend,
          ay + uy * a + ux * hh * bend,
          ax + dx,
          ay + dy,
        ];
      }
      function limb(a, j, b, w0, w1, col, seed) {
        const c = chaikin([a, j, b], false, 2),
          L = [],
          R = [];
        for (let i = 0; i < c.length; i++) {
          const p = c[max(0, i - 1)],
            q = c[min(c.length - 1, i + 1)],
            n = hypot(q[0] - p[0], q[1] - p[1]) || 1,
            nx = -(q[1] - p[1]) / n,
            ny = (q[0] - p[0]) / n,
            w = lerp(w0, w1, i / (c.length - 1)) * 0.5;
          L.push([c[i][0] + nx * w, c[i][1] + ny * w]);
          R.push([c[i][0] - nx * w, c[i][1] - ny * w]);
        }
        fillPoly(L.concat(R.reverse()), col);
        ink(L, 0.9, seed);
        ink(R, 0.9, seed + 1);
      }
      function drawResident(p) {
        const atStation =
          hypot(p.x - p.home.x, p.y - p.home.y) < 75 &&
          !p.playing &&
          !p.helping &&
          !allDone();
        const k = p.k,
          h = p.h,
          moving = (p.walkBlend || 0) > 0.015,
          walk = p.walkBlend || 0,
          bob = abs(sin(p.ph)) * 2 * walk,
          foot = p.y - p.air - h.hop - (p.playHop || 0),
          hipY = foot - 33 * k + 7 * p.squash,
          shY = hipY - 31 * k + 3 * p.squash - bob,
          shX = p.x + (moving ? p.dir * 1.2 : sin(T * 0.7 + p.id) * 0.4),
          sw = 12 * k;
        SC = 0.65;
        BOIL = reduced ? 0 : floor(T * 4 + p.id) % 3;
        ctx.globalAlpha = 0.13;
        oval(p.x + 3, p.y + 2, 19 * k, 5 * k, INK, 0);
        ctx.globalAlpha = 1;
        if (["cat", "fox", "raccoon", "dog"].includes(h.d.kind)) {
          const tx = p.x - p.dir * 11,
            ty = hipY + 4;
          line(
            [
              [tx, ty],
              [tx - p.dir * 13, ty - 2],
              [tx - p.dir * (19 + sin(T * 3) * 3), ty - 15],
            ],
            h.d.kind === "fox" ? 9 : 4,
            p.id + 505,
            h.d.fur,
          );
          if (h.d.kind === "fox")
            line(
              [
                [tx - p.dir * 17, ty - 9],
                [tx - p.dir * (19 + sin(T * 3) * 3), ty - 15],
              ],
              4,
              p.id + 506,
              h.d.light,
            );
        }
        for (let i = 0; i < 2; i++) {
          const s = i ? 1 : -1,
            a = p.ph + i * PI,
            fx0 =
              p.x +
              s * 6 * k +
              cos(a) * 10 * k * walk +
              (i === 1 ? p.dir * (p.playKick || 0) * 13 : 0),
            fy =
              foot -
              max(0, -sin(a)) * 7 * walk -
              (i === 1 ? (p.playKick || 0) * 7 : 0),
            j = ik(p.x + s * 5 * k, hipY, fx0, fy, 18 * k, 18 * k, -s * 0.55);
          limb(
            [p.x + s * 5 * k, hipY],
            j,
            [j[2], j[3]],
            9 * k,
            6 * k,
            p.outfit === "overalls" ? p.color : "#858979",
            p.id * 40 + i * 5,
          );
          oval(
            j[2] + p.dir * 2.5,
            j[3] - 1,
            7 * k,
            3.5 * k,
            "#5e6458",
            0.8,
            p.id + i,
          );
        }
        const hand = [],
          elbow = [];
        for (let i = 0; i < 2; i++) {
          const s = i ? 1 : -1,
            ax = shX + s * sw,
            ay = shY + 3;
          let hx = ax + s * 3,
            hy = shY + 28;
          if (p.held) {
            hx = ax + s * 11;
            hy = shY - 12 + sin(T * 9 + i) * 3;
          } else if ((p.waveBlend || 0) > 0.01 && i === 1) {
            hx = lerp(hx, ax + 8 + sin(T * 9) * 5, p.waveBlend);
            hy = lerp(hy, shY - 21, p.waveBlend);
          } else if (moving) {
            hx = ax + sin(p.ph + i * PI) * 7 * walk;
            hy = shY + 27;
          } else if (atStation && ["developer", "office"].includes(p.job)) {
            hx =
              ax -
              s * 7 +
              sin(T * (p.job === "developer" ? 13 : 6) + i * 3) * 3;
            hy = shY + 21 + sin(T * 10 + i) * 1.6;
          } else if (atStation && p.job === "mechanic" && i === 1) {
            hx = ax + 8 + sin(T * 3) * 3;
            hy = shY + 4 - max(0, sin(T * 5)) * 22;
          } else if (atStation && p.job === "math" && i === 1) {
            hx = ax + 9;
            hy = shY - 10 + sin(T * 2.2) * 8;
          } else if (atStation && p.job === "baker") {
            hx = shX + s * 8;
            hy = shY + 19 + sin(T * 4) * 5;
          } else if (p.job === "reader") {
            hx = shX + s * 11;
            hy = shY + 17;
          } else if (p.job === "gardener" && i === 1) {
            hx = ax + 14;
            hy = shY + 23;
          }
          if (p.reactionBlend > 0.01) {
            const r = p.reaction,
              amount = p.reactionBlend;
            let rx = hx,
              ry = hy;
            if (r?.kind === "clap") {
              rx = shX + s * (3 + max(0, sin((T - r.start) * 10)) * 7);
              ry = shY + 10;
            } else if (r?.kind === "thanks" && i === 1) {
              rx = shX - 2;
              ry = shY + 9;
            } else if (r?.kind === "wonder" && i === 1) {
              rx = shX + 9;
              ry = shY - 5;
            } else if (r?.kind === "laugh") {
              rx = shX + s * 11;
              ry = shY + 10 + sin(T * 8) * 2;
            }
            hx = lerp(hx, rx, amount);
            hy = lerp(hy, ry, amount);
          }
          if (p.snack > 0.01 && !p.helping && !p.playing && i === 1) {
            hx = lerp(hx, p.x + 5, p.snack);
            hy = lerp(hy, shY - 4, p.snack);
          }
          const special = handTarget(p, i, hx, hy);
          if (special) {
            hx = lerp(hx, special.point[0], special.blend);
            hy = lerp(hy, special.point[1], special.blend);
          }
          const j = ik(ax, ay, hx, hy, 17 * k, 17 * k, -s);
          hand.push([j[2], j[3]]);
          elbow.push(j);
        }
        const arm = (i) => {
          const s = i ? 1 : -1;
          limb(
            [shX + s * sw, shY + 3],
            elbow[i],
            hand[i],
            7.5 * k,
            5 * k,
            p.outfit === "apron" ? "#ddd5be" : p.color,
            p.id * 40 + 10 + i * 4,
          );
          oval(
            hand[i][0],
            hand[i][1],
            3.8 * k,
            3.5 * k,
            h.d.fur,
            0.9,
            p.id * 40 + 29 + i,
          );
        };
        arm(0);
        const hem =
            hipY + (p.outfit === "dress" ? 12 : p.outfit === "coat" ? 6 : 2),
          hw = p.outfit === "dress" ? 16 : 10.5;
        const body = [
          [shX - sw, shY + 2],
          [shX - sw * 0.5, shY - 3],
          [shX + sw * 0.5, shY - 3],
          [shX + sw, shY + 2],
          [p.x + hw * k, hem],
          [p.x - hw * k, hem],
        ];
        fillPoly(body, p.color);
        ink(body, 1.3, p.id + 10, true, 0.2);
        if (p.outfit === "suit") {
          fillPoly(
            [
              [shX - 5, shY - 3],
              [shX, shY + 12],
              [shX + 5, shY - 3],
            ],
            "#eee5cd",
          );
          fillPoly(
            [
              [shX, shY + 1],
              [shX + 2, shY + 9],
              [shX, shY + 14],
              [shX - 2, shY + 9],
            ],
            "#b97e63",
          );
        } else if (p.outfit === "overalls") {
          box(shX - 7, shY + 7, 14, 13, p.color, 1, p.id + 52);
          line(
            [
              [shX - 8, shY - 2],
              [shX - 6, shY + 8],
            ],
            1.5,
            p.id + 53,
          );
          line(
            [
              [shX + 8, shY - 2],
              [shX + 6, shY + 8],
            ],
            1.5,
            p.id + 54,
          );
          box(shX - 4, shY + 12, 8, 6, p.color, 0.7, p.id + 55);
        } else if (p.outfit === "stripes")
          for (let j = 0; j < 4; j++)
            line(
              [
                [shX - sw + 2, shY + 7 + j * 6],
                [shX + sw - 2, shY + 7 + j * 6],
              ],
              1.6,
              p.id + j,
              "#e4e4d0",
            );
        else if (p.outfit === "apron") {
          fillPoly(
            [
              [shX - 6, shY + 4],
              [shX + 6, shY + 4],
              [p.x + 13, hipY + 8],
              [p.x - 13, hipY + 8],
            ],
            "#efe7d5",
          );
          line(
            [
              [shX - 6, shY + 5],
              [shX - 4, shY - 3],
            ],
            1,
            p.id + 67,
          );
          line(
            [
              [shX + 6, shY + 5],
              [shX + 4, shY - 3],
            ],
            1,
            p.id + 68,
          );
          box(shX - 5, shY + 20, 10, 7, "#e8dfcb", 0.6, p.id + 69);
        } else {
          line(
            [
              [shX - 5, shY - 3],
              [shX, shY + 4],
              [shX + 5, shY - 3],
            ],
            0.8,
            p.id + 61,
          );
          for (let j = 0; j < 3; j++) {
            ctx.fillStyle = INK;
            dot(shX, shY + 10 + j * 7, 0.8);
          }
        }
        const headPose = { bx: h.bx, by: h.by, S: h.S };
        h.bx = shX;
        h.by = shY - 4 - h.S * 0.82 + h.hop;
        h.S = 20.8 * k;
        drawHead(h);
        Object.assign(h, headPose);
        SC = 0.65;
        BOIL = reduced ? 0 : floor(T * 4) % 3;
        arm(1);
        if (p.prop === "mail" && !p.payHand) {
          box(p.x + 13, hipY - 4, 16, 13, "#af9472", 1, p.id);
          line(
            [
              [shX - 8, shY],
              [p.x + 19, hipY],
            ],
            1.5,
            p.id,
          );
          box(hand[1][0] - 6, hand[1][1] - 6, 13, 9, "#f4e9cd", 0.8, p.id);
          line(
            [
              [hand[1][0] - 6, hand[1][1] - 6],
              [hand[1][0], hand[1][1]],
              [hand[1][0] + 7, hand[1][1] - 6],
            ],
            0.6,
            p.id,
          );
        }
        if (atStation && p.job === "mechanic" && !moving) {
          const H = hand[1],
            a = -0.8 + sin(T * 5) * 0.45;
          line(
            [
              [H[0], H[1]],
              [H[0] + cos(a) * 13, H[1] + sin(a) * 13],
            ],
            2,
            p.id,
            "#ab916d",
          );
          box(
            H[0] + cos(a) * 13 - 6,
            H[1] + sin(a) * 13 - 3,
            12,
            6,
            "#747e74",
            0.8,
            p.id,
          );
          if (sin(T * 5) > 0.95) {
            ctx.fillStyle = "#b19b68";
            line(
              [
                [p.x + 28, hipY - 6],
                [p.x + 31, hipY - 9],
              ],
              1,
              p.id,
            );
          }
        }
        if (p.job === "reader" && !p.playing) {
          const xx = p.x,
            yy = shY + 12;
          fillPoly(
            [
              [xx - 14, yy],
              [xx, yy + 3],
              [xx + 14, yy],
              [xx + 13, yy + 19],
              [xx, yy + 21],
              [xx - 13, yy + 19],
            ],
            "#dfd6bc",
          );
          line(
            [
              [xx, yy + 3],
              [xx, yy + 21],
            ],
            0.8,
            p.id,
          );
          for (const s of [-1, 1])
            for (let j = 0; j < 3; j++)
              line(
                [
                  [xx + s * 3, yy + 8 + j * 4],
                  [xx + s * 10, yy + 6 + j * 4],
                ],
                0.5,
                p.id + j,
              );
        }
        if (p.prop === "cup" && p.job === "walker" && !p.playing && !p.payHand)
          cup(hand[1][0], hand[1][1], 0.7);
        if (p.job === "gardener" && !moving) {
          const H = hand[1];
          box(H[0], H[1], 15, 12, "#91a697", 1, p.id);
          line(
            [
              [H[0] + 15, H[1] + 3],
              [H[0] + 27, H[1] - 2],
            ],
            2,
            p.id,
            "#849e8e",
          );
          for (let j = 0; j < 4; j++) {
            const q = (T * 1.1 + j * 0.23) % 1;
            ctx.fillStyle = "#94b7aa";
            dot(H[0] + 27 + q * 11, H[1] - 2 + q * q * 31, 1.1);
          }
        }
        if (atStation && p.job === "math" && !moving)
          line(
            [
              [hand[1][0], hand[1][1]],
              [hand[1][0] + 5, hand[1][1] - 4],
            ],
            2,
            p.id,
            "#e7ead7",
          );
        drawPlayProp(p, hand);
        if (rainOn && !sheltered(p) && p.job !== "gardener" && !p.payHand) {
          const ux = shX + 7,
            uy = h.cy - h.S * 1.8;
          line(
            [
              [hand[1][0], hand[1][1]],
              [ux, uy],
            ],
            1.2,
            p.id,
          );
          const dm = [];
          for (let i = 0; i <= 16; i++) {
            const a = PI + (i / 16) * PI;
            dm.push([ux + cos(a) * 34, uy + sin(a) * 19]);
          }
          dm.push([ux + 15, uy + 4], [ux, uy], [ux - 15, uy + 4]);
          fillPoly(dm, ["#a8b99e", "#ccac88", "#adbbb2"][p.id % 3]);
          ink(dm, 1.3, p.id, true);
        }
      }
function allDone(){return true}function drawPlayProp(){}function handTarget(p,i,hx,hy){return p.target?{point:p.target[i],blend:1}:null}
export function createResident(seed,id,kind,color,outfit){let h=makeHead(seed,id,0,0,22,0,0);if(kind){h.d.kind=kind;h.d.sp=SPECIES.find(a=>a.id===kind)||h.d.sp;}return {id,h,k:1,x:0,y:0,home:{x:-9999,y:0},air:0,squash:0,dir:1,ph:0,color,outfit,job:'walker',reactionBlend:0,walkBlend:0,playing:false,helping:true};}
export function begin(c,t){ctx=c;T=t;BOIL=Math.floor(t*4)%3;SC=1}
export{drawResident,ink,box,oval,line,makePaper};
