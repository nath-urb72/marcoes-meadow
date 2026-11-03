/* pixel-art.js - code-drawn pixel sprites for Garden Simulator (display only, no image files).
   PixelArt.url(name, stage)        -> data: URL of a 16x16 sprite. stage = 0-3 or seed/seedling/sprout/mature
   PixelArt.img(name, stage, size)  -> <img> HTML string (CSS class "px" keeps it crisp)
   PixelArt.icon(name, size, color) -> 8x8 UI icon <img> (heart takes a tier color)
   Each sprite is built from shapes with automatic bevel shading and a dark outline. */
const PixelArt = (() => {
  "use strict";
  const N = 16, OUT = "#24160e", STAGES = ["seed", "seedling", "sprout", "mature"];

  // ---- palettes: [dark, mid, light] ----
  const C = {
    red: ["#9e1b22", "#e03a36", "#ff8f7e"], orange: ["#bf560c", "#f28a1e", "#ffc266"],
    yellow: ["#c4861a", "#f4c93c", "#fff29a"], gold: ["#a8701c", "#e1a83a", "#f8d67c"],
    pink: ["#d03f78", "#ff7fae", "#ffc6da"], purple: ["#45207a", "#7a3fb8", "#bb8cf2"],
    blue: ["#27388a", "#4a66d8", "#a3b8ff"], brown: ["#40260f", "#7a4a26", "#b07a42"],
    tan: ["#8a6a3a", "#c49c5c", "#e6c98f"], cream: ["#b9b09a", "#eee8d8", "#ffffff"],
    plum: ["#5a1f4a", "#9c3d7f", "#d27fb0"], avo: ["#2e4f14", "#6a9a2e", "#b4d86a"],
    cuke: ["#2b6b22", "#4cae3a", "#a6e07a"], pep: ["#2b6b22", "#4fb43a", "#9be06a"],
    egg: ["#33165a", "#6a2d9e", "#a56bd6"], bloss: ["#d4628c", "#ffa3c4", "#ffe0ec"],
    mango: ["#b8400f", "#f0782a", "#ffd05a"], peach: ["#e0605a", "#ff9f7a", "#ffd2a8"],
    hib: ["#c4264f", "#ff4f81", "#ff9ab8"], chry: ["#e08ab8", "#f7bfdc", "#ffffff"],
    sun: ["#d98a10", "#ffc928", "#fff07a"], sbrown: ["#2e1a0e", "#5a3418", "#8a5a2a"],
    bt: ["#5a8a3a", "#8fc65a", "#c8f08a"]
  };
  const LF = {
    lush: ["#245f2a", "#3f9a3f", "#7fd06a"], deep: ["#1b4a2a", "#2b7a3c", "#56b45c"],
    lime: ["#3f8a2a", "#79c63e", "#bff27a"], olive: ["#4a6a24", "#7a9a34", "#b0cf5c"],
    teal: ["#17604a", "#2f9d73", "#7fe0b0"]
  };
  const WOOD = C.brown, TR = ["#3a2412", "#6b4423", "#9a6538"], SOIL = ["#3d2412", "#5e3a1c", "#8a5a30"];
  const TIERS = { RED: "#e03a36", ORANGE: "#f28a1e", YELLOW: "#f4c93c", GREEN: "#5a9e2e", VIOLET: "#7a3fb8", PINK: "#ff7fae", BROWN: "#7a4a26" };

  // ---- drawing helpers ----
  const blank = () => Array.from({ length: N }, () => Array(N).fill(null));
  const inb = (x, y) => x >= 0 && y >= 0 && x < N && y < N;
  const put = (g, x, y, c) => { x = Math.round(x); y = Math.round(y); if (inb(x, y)) g[y][x] = c; };
  const ell = (cx, cy, rx, ry) => (x, y) => ((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2 <= 1;
  const box = (x0, y0, w, h) => (x, y) => x >= x0 && x < x0 + w && y >= y0 && y < y0 + h;
  const any = (...f) => (x, y) => f.some(h => h(x, y));

  // Paint a mask with bevel shading: light on top/left edges, dark on bottom/right edges.
  function shape(g, f, p) {
    const m = (x, y) => inb(x, y) && f(x, y);
    for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) if (m(x, y))
      g[y][x] = (!m(x, y + 1) || !m(x + 1, y)) ? p[0] : (!m(x, y - 1) || !m(x - 1, y)) ? p[2] : p[1];
  }
  function line(g, x0, y0, x1, y1, c) {
    x0 = Math.round(x0); y0 = Math.round(y0); x1 = Math.round(x1); y1 = Math.round(y1);
    const dx = Math.abs(x1 - x0), dy = -Math.abs(y1 - y0), sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1;
    let e = dx + dy; const pts = [];
    for (;;) {
      put(g, x0, y0, c); pts.push([x0, y0]);
      if (x0 === x1 && y0 === y1) break;
      const e2 = 2 * e; if (e2 >= dy) { e += dy; x0 += sx; } if (e2 <= dx) { e += dx; y0 += sy; }
    }
    return pts;
  }
  const frond = (g, x0, y0, x1, y1, p, thick) => {
    line(g, x0, y0 + 1, x1, y1 + 1, p[0]); line(g, x0, y0, x1, y1, p[1]);
    if (thick) line(g, x0, y0 - 1, x1, y1 - 1, p[2]);
  };
  // Small bitmaps: L/M/D = light/mid/dark of the palette, S = stem green, Y = yellow, W = white.
  const KEY = { L: 2, M: 1, D: 0 };
  function bmp(g, x, y, rows, p, s) {
    rows.forEach((r, j) => [...r].forEach((ch, i) => {
      const c = ch in KEY ? p[KEY[ch]] : ch === "S" ? (s || "#3f8a2a") : ch === "Y" ? "#ffe066" : ch === "W" ? "#fff" : null;
      if (c) put(g, x + i, y + j, c);
    }));
  }
  function outline(g) {
    const o = g.map(r => r.slice());
    for (let y = 0; y < N; y++) for (let x = 0; x < N; x++)
      if (!g[y][x] && [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => inb(x + dx, y + dy) && g[y + dy][x + dx])) o[y][x] = OUT;
    return o;
  }
  const soil = g => shape(g, any(box(5, 13, 6, 1), box(3, 14, 10, 1)), SOIL);

  // ---- fruit bitmaps ----
  const FR = {
    dot: ["LM", "MD"], big: ["LMM", "MMD", "MDD"], lemon: [".MM.", "LMMD", ".DD."],
    pear: [".M.", "LMD", "MMD", "MDD"], mango: ["LMM.", "MMMD", "MMDD", ".DD."],
    cherry: ["..SS.", ".S..S", "LM.LM", "MD.MD"], chili: ["SS", "LM", "MM", "MD", ".D"],
    bell: ["LMMM", "MMMD", "MMMD", ".DD."], egg: ["SS.", "LMM", "MMD", "MMD", ".DD"],
    straw: ["MLM", "MYD", ".D."], cuke: ["LM", "MM", "MM", "MD", ".D"], bunch: ["LML", "MMD", "MDD", ".D."],
    heart: ["L.M", "MMD", ".D."]
  };

  // ---- growth stages shared by every plant ----
  // Seed shape depends on the body shape; the seed coat uses the plant's main color, with a leaf-tinted tip.
  const SEEDS = {
    tree: [8, 11, ["LM", "MD"]], palm: [7, 11, ["LMM", "MDD"]], bush: [7, 11, ["LM", "MD"]],
    root: [7, 10, [".M", "LM", "MD"]], head: [6, 11, ["LMM", "MMD"]], stalk: [8, 10, ["L", "M", "D"]],
    flower: [7, 11, ["LM", "MD", ".."]], vine: [6, 11, ["LM..LM", "MD..MD"]]
  };
  function seed(g, o) {
    const [x, y, rows] = SEEDS[o.a]; bmp(g, x, y, rows, o.m); put(g, x + 1, y - 1, o.lf[1]);
  }
  const SEEDLINGS = {
    tree: ["LM..ML", ".MMMM.", "..DD..", "..DD.."], palm: ["L....L", ".LMML.", "..DD..", "..DD.."],
    bush: ["LM..ML", "MMMMMM", "..DD..", "..DD.."], root: ["..L...", ".LM.L.", "..MLM.", "..DD.."],
    head: ["......", "LMMMML", "MMMMMM", "..DD.."], stalk: ["..LM..", "..MD..", "..DD..", "..DD.."],
    flower: ["..MM..", ".LMML.", "..DD..", "..DD.."], vine: ["LM....", ".MM.ML", "..DDM.", "..DD.."]
  };
  function seedling(g, o) {
    bmp(g, 5, 9, SEEDLINGS[o.a], o.lf); put(g, 5, 9, o.m[1]); put(g, 10, 9, o.m[1]);
  }
  function sprout(g, o) {
    const lv = (cx, cy, rx, ry, p) => shape(g, ell(cx, cy, rx, ry), p || o.lf);
    switch (o.a) {
      case "tree": shape(g, box(7, 8, 2, 5), TR); lv(7.5, 6, 3, 2.5); break;
      case "palm": shape(g, box(7, 8, 2, 5), o.tp || TR);
        frond(g, 8, 8, 4, 5, o.lf); frond(g, 8, 8, 12, 5, o.lf); frond(g, 8, 8, 8, 4, o.lf); break;
      case "bush": lv(7.5, 10, 4, 2.5); lv(5.5, 9, 2.5, 2); lv(9.5, 9, 2.5, 2); break;
      case "root": [[5, 7], [8, 5], [11, 7]].forEach(([x, y]) => { line(g, 8, 12, x, y, o.lf[1]); put(g, x, y, o.lf[2]); }); break;
      case "head": lv(7.5, 10.5, 4, 2.5); lv(7.5, 9, 2.5, 2); break;
      case "stalk": shape(g, box(7, 4, 2, 9), o.lf); frond(g, 7, 9, 4, 7, o.lf); frond(g, 8, 7, 12, 5, o.lf); break;
      case "flower": shape(g, box(7, 7, 2, 6), o.lf); lv(5, 10, 2, 1.2); lv(10.5, 9.5, 2, 1.2); lv(7.5, 5.5, 1.5, 2, o.m); break;
      case "vine": line(g, 11, 4, 11, 12, WOOD[1]); shape(g, box(7, 9, 2, 4), o.lf); lv(5, 9, 2.5, 1.5); lv(10, 8, 2, 1.5); break;
    }
    // a bud in the plant's own color hints at what it will become
    const bud = { tree: [8, 3], palm: [8, 3], bush: [8, 7], root: [8, 4], head: [8, 7], stalk: [8, 3], vine: [8, 8] }[o.a];
    if (bud) put(g, bud[0], bud[1], o.m[1]);
  }

  // ---- mature drawings, one family per body shape ----
  const R = {
    carrot(g, o) {
      shape(g, any(box(6, 9, 4, 2), box(7, 11, 2, 2)), o.m);
      [[5, 2], [8, 1], [11, 2], [3, 5], [13, 5]].forEach(([x, y]) =>
        line(g, 8, 9, x, y, o.lf[1]).forEach(([px, py], i) => { if (i % 2 && py < 8) { put(g, px - 1, py, o.lf[2]); put(g, px + 1, py, o.lf[0]); } }));
    },
    potato(g, o) {
      shape(g, any(ell(4.5, 10.5, 3, 2), ell(10.5, 10.5, 3, 2), ell(7.5, 11, 2.5, 1.5)), o.m);
      [[4, 10], [10, 11], [8, 11], [5, 12]].forEach(([x, y]) => put(g, x, y, o.m[0]));
      shape(g, box(7, 6, 2, 4), o.lf);
      shape(g, any(ell(7.5, 4.5, 3.5, 2.5), ell(4.5, 6, 2, 1.5), ell(10.5, 6, 2, 1.5)), o.lf);
      put(g, 8, 2, "#fff"); put(g, 7, 2, "#ffe066");
    },
    sweet(g, o) {
      shape(g, any(ell(4.5, 11, 3, 1.5), ell(10.5, 11, 3, 1.5)), o.m);
      [[3, 5], [10, 4], [6, 2]].forEach(([x, y]) => { line(g, 8, 10, x + 1, y + 1, o.lf[0]); bmp(g, x, y, FR.heart, o.lf); });
    },
    onion(g, o) {
      shape(g, any(ell(7.5, 10, 4, 2.5), box(7, 7, 2, 2)), o.m);
      line(g, 7, 8, 5, 2, o.lf[1]); line(g, 8, 8, 8, 1, o.lf[1]); line(g, 8, 8, 11, 3, o.lf[1]);
      line(g, 9, 8, 9, 2, o.lf[2]); put(g, 8, 10, o.m[0]); put(g, 8, 11, o.m[0]); put(g, 6, 11, o.m[0]);
    },
    garlic(g, o) {
      shape(g, any(ell(7.5, 10, 4, 2.5), box(7, 6, 2, 3)), o.m);
      [6, 9].forEach(x => { put(g, x, 10, o.m[0]); put(g, x, 11, o.m[0]); });
      put(g, 5, 11, "#c9a0d8"); put(g, 10, 11, "#c9a0d8");
      line(g, 8, 6, 8, 3, o.lf[2]); line(g, 8, 3, 10, 1, o.lf[2]); put(g, 11, 1, o.lf[1]);
    }
  };
  const H = {
    lettuce(g, o) {
      shape(g, any(ell(7.5, 9, 6, 3.5), ell(4, 9, 2.5, 2.5), ell(11, 9, 2.5, 2.5)), o.lf);
      shape(g, ell(7.5, 7.5, 3.5, 2.5), ["#6fbf3f", "#a8e36a", "#ddfaa0"]);
      [[7, 10], [8, 11], [5, 9], [10, 10], [3, 8], [12, 8]].forEach(([x, y]) => put(g, x, y, o.lf[0]));
    },
    broc(g, o) {
      shape(g, box(7, 9, 2, 4), LF.lime);
      const f = any(ell(4.5, 6.5, 3, 2.5), ell(10.5, 6.5, 3, 2.5), ell(7.5, 4.5, 3.5, 3), ell(7.5, 7.5, 5, 2.5));
      shape(g, f, o.lf);
      for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) if (f(x, y)) {
        if ((x * 3 + y * 5) % 7 === 0) g[y][x] = o.lf[0]; else if ((x * 5 + y * 3) % 11 === 0) g[y][x] = o.lf[2];
      }
    }
  };
  const S = {
    corn(g, o) {
      shape(g, box(7, 3, 2, 10), o.lf);
      frond(g, 7, 10, 3, 8, o.lf); put(g, 2, 9, o.lf[0]); frond(g, 8, 7, 13, 4, o.lf); put(g, 14, 6, o.lf[0]);
      shape(g, box(9, 7, 3, 4), o.m);
      for (let y = 7; y <= 10; y++) for (let x = 9; x <= 11; x++) if ((x + y) % 2 === 0) put(g, x, y, o.m[2]);
      shape(g, box(9, 10, 3, 3), o.lf);
      [[10, 6], [11, 5], [7, 2], [8, 2], [8, 1]].forEach(([x, y]) => put(g, x, y, "#e0c07a"));
    },
    sun(g, o) {
      shape(g, box(7, 8, 2, 5), o.lf);
      shape(g, any(ell(4.5, 10.5, 2.5, 1.5), ell(11, 10, 2.5, 1.5)), o.lf);
      shape(g, ell(7.5, 5, 5, 4.5), o.m);
      for (let y = 0; y < N; y++) for (let x = 0; x < N; x++)
        if (g[y][x] && Math.hypot(x - 7.5, y - 5) > 3.6 && (x + y) % 2 === 0 && y < 10) g[y][x] = o.m[2];
      shape(g, ell(7.5, 5, 2.5, 2.5), C.sbrown);
      [[6, 4], [9, 5], [7, 6]].forEach(([x, y]) => put(g, x, y, C.sbrown[2]));
    }
  };
  const F = {
    tulip(g, o) {
      shape(g, box(7, 8, 2, 5), o.lf); frond(g, 7, 12, 4, 8, o.lf); frond(g, 8, 12, 11, 9, o.lf);
      bmp(g, 5, 3, ["M.LL.M", "MLLLMD", "MMMMMD", ".MMMD.", "..DD.."], o.m);
    },
    hib(g, o) {
      shape(g, any(ell(4, 10.5, 2.5, 2), ell(11, 10.5, 2.5, 2)), o.lf); shape(g, box(7, 8, 2, 5), o.lf);
      const pet = [0, 1, 2, 3, 4].map(k => { const a = -Math.PI / 2 + k * Math.PI * 2 / 5; return ell(7.5 + 2.8 * Math.cos(a), 5 + 2.8 * Math.sin(a), 2, 2); });
      shape(g, any(...pet), o.m);
      [[7, 4], [8, 4], [7, 5], [8, 5]].forEach(([x, y]) => put(g, x, y, "#8a1a3a"));
      line(g, 8, 5, 12, 8, "#ffd23a"); put(g, 12, 8, "#ff8a1a"); put(g, 13, 8, "#ff8a1a");
    },
    chry(g, o) {
      shape(g, box(7, 9, 2, 4), o.lf); shape(g, any(ell(4, 11, 2.5, 1.5), ell(11, 11, 2.5, 1.5)), o.lf);
      shape(g, ell(7.5, 5.5, 5, 4.5), o.m);
      for (let y = 0; y < N; y++) for (let x = 0; x < N; x++)
        if (g[y][x] && Math.hypot(x - 7.5, y - 5.5) > 1.8 && (x + y) % 2 === 0 && y < 11) g[y][x] = o.m[2];
      shape(g, ell(7.5, 5.5, 1.5, 1.5), C.yellow);
    }
  };
  const V = {
    cuke(g, o) {
      line(g, 2, 3, 2, 12, WOOD[1]); line(g, 13, 3, 13, 12, WOOD[1]); line(g, 2, 3, 13, 3, WOOD[2]);
      shape(g, any(ell(5, 5, 2.5, 2), ell(10.5, 5.5, 2.5, 2), ell(7.5, 4.5, 2, 1.5)), o.lf);
      bmp(g, 5, 7, FR.cuke, o.m); bmp(g, 9, 6, FR.cuke, o.m); put(g, 7, 9, "#ffe066"); put(g, 11, 10, "#ffe066");
    },
    grape(g, o) {
      line(g, 1, 2, 14, 2, WOOD[2]); line(g, 1, 2, 1, 12, WOOD[1]); line(g, 14, 2, 14, 12, WOOD[1]);
      shape(g, any(ell(4, 4, 3, 1.5), ell(11, 4, 3, 1.5), ell(7.5, 3.5, 2.5, 1.5)), o.lf);
      [[4, 5], [6, 5], [8, 5], [10, 5], [5, 7], [7, 7], [9, 7], [6, 9], [8, 9], [7, 11]].forEach(([x, y]) => bmp(g, x, y, FR.dot, o.m));
    }
  };
  const A = {
    tree(g, o) {
      shape(g, box(7, 8, 2, 5), TR);
      const cn = {
        round: any(ell(7.5, 5.5, 5, 4), ell(4, 7, 3, 2.5), ell(11, 7, 3, 2.5)),
        tall: any(ell(7.5, 5, 4, 4.5), ell(7.5, 7, 5, 3)),
        wide: any(ell(7.5, 6.5, 6, 3.5), ell(7.5, 4.5, 4, 2.5))
      }[o.cn || "round"];
      shape(g, cn, o.lf);
      (o.pts || []).forEach(([x, y]) => bmp(g, x, y, FR[o.fr], o.m));
      if (o.bl) [[4, 5], [8, 3], [11, 6], [6, 7], [9, 5], [5, 3], [12, 8]].forEach(([x, y], i) => put(g, x, y, i % 2 ? "#fff" : o.m[0]));
    },
    palm(g, o) {
      shape(g, any(box(7, 10, 2, 3), box(8, 6, 2, 4)), o.tp || TR);
      [[-7, -2], [-6, 2], [-3, -5], [3, -5], [5, -2], [5, 2]].forEach(([dx, dy]) => frond(g, 9, 6, 9 + dx, 6 + dy, o.lf, o.th));
      if (o.k === "banana") { bmp(g, 10, 7, FR.bunch, o.m); put(g, 11, 11, "#7a2a6a"); put(g, 11, 12, "#5a1f4a"); }
      else [[7, 7], [10, 7], [9, 9]].forEach(([x, y]) => bmp(g, x, y, FR.dot, o.m));
    },
    bush(g, o) {
      if (o.stake) shape(g, box(13, 2, 1, 11), WOOD);
      shape(g, o.low ? any(ell(7.5, 10.5, 6, 2), ell(4, 10, 3, 1.5), ell(11, 10, 3, 1.5))
        : any(ell(7.5, 9, 6, 3.5), ell(4.5, 8.5, 3.5, 3), ell(10.5, 8, 3.5, 3)), o.lf);
      (o.pts || []).forEach(([x, y]) => { bmp(g, x, y, FR[o.fr], o.m); if (o.cap) put(g, x + 1, y - 1, "#3f8a2a"); });
      if (o.low) { put(g, 5, 8, "#fff"); put(g, 5, 7, "#ffe066"); put(g, 10, 8, "#fff"); put(g, 10, 7, "#ffe066"); }
    },
    root: (g, o) => R[o.k](g, o), head: (g, o) => H[o.k](g, o), stalk: (g, o) => S[o.k](g, o),
    flower: (g, o) => F[o.k](g, o), vine: (g, o) => V[o.k](g, o)
  };

  // ---- the 30 plants, in tier order (t = tier, a = body shape, lf = leaves, m = main color) ----
  const P = {
    Tomato: { t: "RED", a: "bush", lf: LF.lush, m: C.red, fr: "big", cap: 1, stake: 1, pts: [[2, 7], [6, 6], [10, 6], [5, 9], [10, 9]] },
    Apple: { t: "RED", a: "tree", lf: LF.lush, m: C.red, fr: "dot", pts: [[3, 5], [7, 3], [11, 5], [5, 7], [9, 7], [12, 8]] },
    Strawberry: { t: "RED", a: "bush", low: 1, lf: LF.lime, m: C.red, fr: "straw", pts: [[2, 9], [7, 10], [11, 9]] },
    "Chili Pepper": { t: "RED", a: "bush", lf: LF.deep, m: C.red, fr: "chili", pts: [[3, 6], [6, 8], [9, 7], [11, 6]] },
    Cherry: { t: "RED", a: "tree", lf: LF.deep, m: C.red, fr: "cherry", pts: [[3, 4], [8, 5]] },
    Carrot: { t: "ORANGE", a: "root", k: "carrot", lf: LF.lime, m: C.orange },
    Tangerine: { t: "ORANGE", a: "tree", lf: LF.lush, m: C.orange, fr: "big", pts: [[3, 5], [8, 3], [10, 6], [6, 7]] },
    Corn: { t: "YELLOW", a: "stalk", k: "corn", lf: LF.lime, m: C.yellow },
    Banana: { t: "YELLOW", a: "palm", k: "banana", lf: LF.lime, m: C.yellow, tp: C.bt, th: 1 },
    Lemon: { t: "YELLOW", a: "tree", cn: "tall", lf: LF.lime, m: C.yellow, fr: "lemon", pts: [[4, 4], [8, 3], [5, 7], [9, 6]] },
    Sunflower: { t: "YELLOW", a: "stalk", k: "sun", lf: LF.deep, m: C.sun },
    Mango: { t: "YELLOW", a: "tree", cn: "wide", lf: LF.deep, m: C.mango, fr: "mango", pts: [[2, 5], [10, 5], [6, 6]] },
    Lettuce: { t: "GREEN", a: "head", k: "lettuce", lf: LF.lime, m: LF.lime },
    Cucumber: { t: "GREEN", a: "vine", k: "cuke", lf: LF.lush, m: C.cuke },
    "Bell Pepper": { t: "GREEN", a: "bush", lf: LF.deep, m: C.pep, fr: "bell", pts: [[2, 7], [6, 6], [10, 7]] },
    Broccoli: { t: "GREEN", a: "head", k: "broc", lf: LF.deep, m: LF.deep },
    Avocado: { t: "GREEN", a: "tree", cn: "tall", lf: LF.deep, m: C.avo, fr: "pear", pts: [[4, 3], [9, 3], [3, 7], [11, 7]] },
    Grapes: { t: "VIOLET", a: "vine", k: "grape", lf: LF.teal, m: C.purple },
    "Sweet Potato": { t: "VIOLET", a: "root", k: "sweet", lf: LF.olive, m: C.plum },
    Eggplant: { t: "VIOLET", a: "bush", lf: LF.deep, m: C.egg, fr: "egg", pts: [[3, 6], [7, 7], [11, 6]] },
    Blueberry: { t: "VIOLET", a: "bush", lf: LF.olive, m: C.blue, fr: "dot", pts: [[2, 7], [5, 6], [8, 6], [11, 7], [4, 9], [7, 9], [10, 9]] },
    Chrysanthemum: { t: "PINK", a: "flower", k: "chry", lf: LF.lush, m: C.chry },
    Tulip: { t: "PINK", a: "flower", k: "tulip", lf: LF.lime, m: C.pink },
    Peach: { t: "PINK", a: "tree", cn: "wide", lf: LF.lime, m: C.peach, fr: "big", pts: [[3, 5], [7, 6], [10, 4], [11, 7]] },
    Hibiscus: { t: "PINK", a: "flower", k: "hib", lf: LF.deep, m: C.hib },
    "Cherry Blossom": { t: "PINK", a: "tree", lf: C.bloss, m: C.bloss, bl: 1 },
    Potato: { t: "BROWN", a: "root", k: "potato", lf: LF.lush, m: C.tan },
    Onion: { t: "BROWN", a: "root", k: "onion", lf: LF.lime, m: C.gold },
    Garlic: { t: "BROWN", a: "root", k: "garlic", lf: LF.olive, m: C.cream },
    Coconut: { t: "BROWN", a: "palm", k: "coconut", lf: LF.teal, m: C.brown }
  };
  const ORDER = {};
  Object.keys(P).forEach(n => (ORDER[P[n].t] = ORDER[P[n].t] || []).push(n));

  // ---- public API ----
  const stageIdx = s => typeof s === "number" ? Math.max(0, Math.min(3, s | 0)) : Math.max(0, STAGES.indexOf(String(s).toLowerCase()));
  function grid(name, stage) {
    const o = P[name]; if (!o) return null;
    const g = blank(); soil(g);
    [seed, seedling, sprout, (gg, oo) => A[oo.a](gg, oo)][stageIdx(stage)](g, o);
    return outline(g);
  }
  const cache = new Map();
  function url(name, stage) {
    const i = stageIdx(stage), k = name + "|" + i;
    if (cache.has(k)) return cache.get(k);
    const g = grid(name, i); if (!g) return "";
    const c = document.createElement("canvas"); c.width = c.height = N;
    const x = c.getContext("2d");
    g.forEach((row, y) => row.forEach((col, xx) => { if (col) { x.fillStyle = col; x.fillRect(xx, y, 1, 1); } }));
    const u = c.toDataURL(); cache.set(k, u); return u;
  }
  const img = (name, stage, size = 48) =>
    `<img class="px" src="${url(name, stage)}" width="${size}" height="${size}" alt="${name}" draggable="false">`;

  // ---- Night Defense sprites (Topic 7): corrupted plants, blighted ground and Wards ----
  // A plant the blight reaches TRANSFORMS into a black slime with white eyes, overgrown with purple
  // moss, sprouts and crystals. Its growth stage picks the creature: seed -> a tuft of moss,
  // seedling -> a sprout, sprout -> a crystal, mature -> the big mossy one with a flower.
  const SLIME = ["#07040c", "#150e20", "#2e2340"], MOSS = ["#3a1a6a", "#7a3fb8", "#c08cf2"];
  const CRYSTAL = ["#5a2aa8", "#b06af5", "#f0d4ff"], LEAF = ["#4a2488", "#9a5ae0", "#d4a8ff"];
  const BLIGHT_BY_STAGE = { seed: 3, seedling: 1, sprout: 2, mature: 0 };
  const blightForStage = s => BLIGHT_BY_STAGE[String(s).toLowerCase()] ?? 3;
  function blightGrid(variant) {
    const g = blank();
    if (variant === 4) {            // blighted ground with no plant: a bubbling purple pool
      shape(g, ell(8, 11.5, 6.6, 3.2), ["#1a0f2e", "#33204f", "#5a3a86"]);
      [[5, 11], [9, 10], [11, 12], [7, 12]].forEach(([x, y]) => put(g, x, y, MOSS[2]));
      [[4, 6], [11, 5], [8, 4], [13, 8]].forEach(([x, y]) => put(g, x, y, CRYSTAL[1]));
      return outline(g);
    }
    shape(g, ell(8, 11, 6.2, 3.8), SLIME);
    [[4, 10], [5, 10], [4, 11], [10, 10], [11, 10], [10, 11]].forEach(([x, y]) => put(g, x, y, "#ffffff"));
    put(g, 5, 11, SLIME[0]); put(g, 11, 11, SLIME[0]);
    if (variant === 0) {            // big: moss dome, a sprout with a flower, a crystal
      shape(g, (x, y) => ell(8, 8.3, 5.2, 2.6)(x, y) && y <= 9, MOSS);
      line(g, 8, 7, 8, 4, LEAF[1]);
      [[7, 5], [6, 5], [9, 6], [10, 6]].forEach(([x, y]) => put(g, x, y, LEAF[2]));
      [[8, 2], [7, 3], [9, 3], [8, 4]].forEach(([x, y]) => put(g, x, y, CRYSTAL[1]));
      put(g, 8, 3, CRYSTAL[2]);
      [[3, 5], [4, 5], [3, 6], [4, 6], [5, 6], [4, 7], [5, 7]].forEach(([x, y]) => put(g, x, y, CRYSTAL[1]));
      put(g, 3, 5, CRYSTAL[2]);
    } else if (variant === 1) {     // a sprout
      shape(g, (x, y) => ell(8, 8.4, 2.8, 1.4)(x, y) && y <= 9, MOSS);
      line(g, 8, 8, 8, 5, LEAF[1]);
      [[7, 6], [6, 5], [5, 5], [9, 5], [10, 4], [11, 4]].forEach(([x, y]) => put(g, x, y, LEAF[2]));
      put(g, 6, 6, LEAF[0]); put(g, 10, 5, LEAF[0]);
    } else if (variant === 2) {     // a crystal
      shape(g, (x, y) => ell(8, 8.4, 3.2, 1.5)(x, y) && y <= 9, MOSS);
      shape(g, any(box(7, 3, 3, 5), box(8, 2, 1, 1), box(5, 5, 2, 3), box(10, 5, 1, 3)), CRYSTAL);
    } else {                        // a small tuft of moss
      shape(g, (x, y) => ell(6, 8.8, 3.6, 1.7)(x, y) && y <= 9, MOSS);
      [[10, 8], [11, 9], [9, 9]].forEach(([x, y]) => put(g, x, y, MOSS[1]));
    }
    return outline(g);
  }
  // A Ward: a carved stone with a rune. Inside a barrier (3+ linked Wards) the rune glows gold.
  const STONE = ["#3c414c", "#7d8694", "#bcc5d3"];
  function wardGrid(barrier) {
    const g = blank();
    shape(g, any(box(5, 4, 6, 9), box(6, 2, 4, 2), box(7, 1, 2, 1), box(3, 12, 10, 2)), STONE);
    const rune = barrier ? "#ffd84a" : "#5b6b86";
    [[8, 6], [7, 7], [8, 7], [9, 7], [8, 8], [8, 9], [7, 10], [9, 10]].forEach(([x, y]) => put(g, x, y, rune));
    if (barrier) [[3, 4], [12, 4], [2, 8], [13, 8], [4, 1], [11, 1]].forEach(([x, y]) => put(g, x, y, "#fff1a8"));
    return outline(g);
  }
  // The Shadow Hound (Topic 10): a black hound with a purple mane and glowing eyes, facing right.
  function houndGrid() {
    const g = blank();
    shape(g, any(ell(7, 9.8, 5, 2.3), box(10, 6, 3, 4), ell(12.5, 6, 2.4, 2.1), box(14, 6, 2, 2),
      box(11, 2, 1, 3), box(13, 2, 1, 3), box(3, 11, 2, 4), box(6, 11, 2, 4), box(9, 12, 2, 3), box(11, 12, 2, 3)), SLIME);
    line(g, 2, 9, 1, 5, SLIME[1]); line(g, 3, 9, 2, 5, SLIME[0]);
    [[4, 7], [6, 6], [8, 6], [10, 5]].forEach(([x, y]) => put(g, x, y, MOSS[2]));
    [[4, 8], [6, 7], [8, 7]].forEach(([x, y]) => put(g, x, y, MOSS[1]));
    put(g, 12, 5, "#e6b8ff"); put(g, 13, 5, CRYSTAL[1]);
    put(g, 15, 8, "#ffffff"); put(g, 14, 8, SLIME[0]);
    return outline(g);
  }
  // The Magpie (Topic 11): black head and back, white belly, a shimmering blue-purple wing and tail.
  function magpieGrid() {
    const g = blank();
    shape(g, any(ell(7, 9, 4.6, 2.7), ell(12, 6.5, 2.2, 2), box(14, 6, 2, 1)), SLIME);
    shape(g, (x, y) => ell(7, 10.6, 3.2, 1.4)(x, y) && y >= 10, ["#cfcfd6", "#ffffff", "#ffffff"]);
    shape(g, any(box(3, 7, 6, 2), box(0, 9, 4, 2), box(1, 11, 3, 1)), ["#3b2a7a", "#6b4fd0", "#a58cf5"]);
    put(g, 12, 5, "#ffffff"); put(g, 13, 5, SLIME[0]); put(g, 15, 6, "#e8c04a");
    put(g, 6, 12, SLIME[0]); put(g, 8, 12, SLIME[0]); put(g, 6, 13, SLIME[0]); put(g, 8, 13, SLIME[0]);
    return outline(g);
  }
  const spriteCache = new Map();
  function spriteUrl(key, build) {
    if (spriteCache.has(key)) return spriteCache.get(key);
    const c = document.createElement("canvas"); c.width = c.height = N;
    const x = c.getContext("2d");
    build().forEach((row, y) => row.forEach((col, xx) => { if (col) { x.fillStyle = col; x.fillRect(xx, y, 1, 1); } }));
    const u = c.toDataURL(); spriteCache.set(key, u); return u;
  }
  const spriteImg = (src, size, alt) => `<img class="px" src="${src}" width="${size}" height="${size}" alt="${alt}" draggable="false">`;
  const blightImg = (variant, size = 48) => spriteImg(spriteUrl("blight|" + variant, () => blightGrid(variant)), size, "Blight");
  const magpieImg = (size = 48) => spriteImg(spriteUrl("magpie", magpieGrid), size, "Magpie");
  const houndImg = (size = 48) => spriteImg(spriteUrl("hound", houndGrid), size, "Shadow Hound");
  const wardImg = (barrier, size = 48) => spriteImg(spriteUrl("ward|" + !!barrier, () => wardGrid(barrier)), size, "Ward");

  // ---- 8x8 UI icons (letters map to IC colors; h/H = a heart's own tier color) ----
  const IC = { o: "#24160e", g: "#5aa832", G: "#2f6b1c", r: "#e03a36", R: "#9e1b22", y: "#f4c93c", Y: "#c4861a", w: "#fff7e0", b: "#4a9be0", B: "#27508a", n: "#8a5a2a", N: "#4a2e17", s: "#b8c0c8", S: "#6a727a", c: "#f4e8c8" };
  const ICONS = {
    heart: [".hh..hh.", "hwhhhhhH", "hhhhhhhH", "hhhhhhhH", ".hhhhhH.", "..hhhH..", "...hH...", "........"],
    coin: ["..oooo..", ".oyyyYo.", "oywyyyYo", "oyyyyyYo", "oyyyyyYo", "oyyyyYYo", ".oYYYYo.", "..oooo.."],
    drop: ["...bb...", "...bb...", "..bbbb..", ".bwbbbB.", ".bwbbbB.", ".bbbbBB.", "..bBBB..", "...BB..."],
    tonic: ["..oooo..", "...ss...", "..oooo..", ".orrrrR.", ".orwrrR.", ".orrrrR.", ".oRRRRR.", "..oooo.."],
    sprout: [".gg..gg.", "gggGGggg", ".gGGGGg.", "...GG...", "...GG...", "..nnnn..", ".nNNNNn.", "........"],
    can: ["...ss...", "..s..s..", "bsssssS.", "bsSSSSS.", ".sSSSSS.", ".sSSSSS.", ".sssSSS.", "........"],
    basket: ["..nnnn..", ".n....n.", "n......n", "nnnnnnnn", "nNnNnNnN", "nNnNnNnN", ".nNnNnN.", "..nnnn.."],
    shovel: [".....nn.", "....nn..", "...nn...", "..nn....", ".ssS....", "sssSS...", "sssS....", ".SS....."],
    moon: ["..yyy...", ".yy.....", "yy......", "yy......", "yy......", ".yy...Y.", "..yyyY..", "........"],
    book: ["oooooo..", "obbbbbo.", "obwwwbo.", "obwwwbo.", "obbbbbo.", "oBBBBBo.", "oooooo..", "........"],
    box: ["........", "nnnnnnnn", "nNNNNNNn", "nnnnnnnn", "nNNnnNNn", "nNNnnNNn", "nnnnnnnn", "........"],
    store: ["rwrwrwrw", "rwrwrwrw", ".n....n.", ".n....n.", ".nnnnnn.", ".nYYYYn.", ".nnnnnn.", "........"],
    bag: ["...nn...", "..n..n..", ".nnnnnn.", "nnnyynnn", "nnyyyynn", "nnnyynnn", ".nnnnnN.", "........"],
    code: ["........", ".gg..gg.", ".g....g.", ".g....g.", ".g....g.", ".g....g.", ".gg..gg.", "........"],
    cloud: ["..cccc..", ".cccccc.", "cccccccc", ".cccccc.", "...yy...", "..yy....", "...yy...", "..y....."],
    scroll: [".nnnnnn.", "nwwwwwwn", "nwSSSwwn", "nwwwwwwn", "nwSSwwwn", "nwwwwwwn", "nwSSSwwn", ".nnnnnn."],
    barrel: [".nnnnnn.", "nNNNNNNn", "ssssssss", "nnnnnnnn", "nnnnnnnn", "ssssssss", "nNNNNNNn", ".nnnnnn."],
    play: ["..g.....", "..gg....", "..ggg...", "..gggg..", "..ggg...", "..gg....", "..g.....", "........"],
    ff: ["g..g....", "gg.gg...", "ggggg...", "gggggg..", "ggggg...", "gg.gg...", "g..g....", "........"],
    lock: ["..ssss..", ".s....s.", ".s....s.", "yyyyyyyy", "yyyooyyY", "yyyyoyyY", "yYYYYYYY", "........"],
    tree: ["..gggg..", ".gggggg.", "gggggggg", ".gggggg.", "...nn...", "...nn...", "..nnnn..", "........"],
    sun: ["...yy...", "y.yyyy.y", ".yYYYYy.", "yyYYYYyy", "yyYYYYyy", ".yYYYYy.", "y.yyyy.y", "...yy..."],
    flake: ["w..bb..w", ".w.bb.w.", "..wbbw..", "bbbwwbbb", "bbbwwbbb", "..wbbw..", ".w.bb.w.", "w..bb..w"],
    ice: ["...ww...", "..wbbB..", ".wbbbbB.", "wbbwbbbB", ".bbbbbBB", "..bbbBB.", "...bBB..", "....B..."],
    party: ["...hh...", "...hh...", "hhhhhhhh", ".hhhhhh.", "..hhhh..", ".hhhhhh.", ".hh..hh.", "hh....hh"],
    clover: [".gg..gg.", "gggggggg", ".gggggg.", "..gGGg..", ".gggggg.", "gggggggg", ".gg.nn.g", "....n..."],
    ward: ["..ssss..", ".sSSSSs.", ".sSwwSs.", ".sSwySs.", ".sSwwSs.", ".sSSSSs.", "sssssssS", "........"],
    spray: ["..ssS...", ".sS.....", "..ooo...", "..bbb...", ".obbbo..", ".obwbo..", ".obbbo..", "..ooo..."],
    lens: [".ssss...", "sbwbbs..", "sbbbbs..", "sbbbbs..", ".ssss...", "....nn..", ".....nn.", "......nn"],
    radar: ["..gggg..", ".g....g.", "g..gg..g", "g.gGGg.g", "g..gg..g", ".g...yg.", "..gggg..", "........"],
    shield: ["yyyyyyyy", "ysssssSy", "yswwssSy", "yswsssSy", ".ysssSy.", ".ysssSy.", "..ysSy..", "...yy..."]
  };
  const shade = (hex, f) => "#" + [1, 3, 5].map(i => Math.max(0, Math.min(255, Math.round(parseInt(hex.substr(i, 2), 16) * f))).toString(16).padStart(2, "0")).join("");
  const iconCache = new Map();
  function iconUrl(name, color) {
    const k = name + "|" + (color || ""); if (iconCache.has(k)) return iconCache.get(k);
    const rows = ICONS[name]; if (!rows) return "";
    const pal = Object.assign({}, IC, { h: color || "#e03a36", H: shade(color || "#e03a36", 0.65) });
    const c = document.createElement("canvas"); c.width = c.height = 8;
    const x = c.getContext("2d");
    rows.forEach((r, y) => [...r].forEach((ch, i) => { if (pal[ch]) { x.fillStyle = pal[ch]; x.fillRect(i, y, 1, 1); } }));
    const u = c.toDataURL(); iconCache.set(k, u); return u;
  }
  // size should be a multiple of 8 (16, 24, 32) so the pixels stay square
  const icon = (name, size = 16, color) =>
    `<img class="px" src="${iconUrl(name, color)}" width="${size}" height="${size}" alt="" draggable="false">`;

  return { PLANTS: P, ORDER, TIERS, STAGES, ICONS, grid, url, img, icon, blightGrid, wardGrid, blightImg, wardImg, blightForStage, houndGrid, houndImg, magpieGrid, magpieImg };
})();
if (typeof module !== "undefined") module.exports = PixelArt;

/* characters.js - code-drawn 12x16 characters: two player choices and Marco (NPC).
   Characters.img(id, frame, scale) -> <img> HTML.  id: girl | boy | marco.  frame: idle | step (walk cycle). */
const Characters = (() => {
  const BASE = { o: "#2a1a0f", s: "#ffd9b0", r: "#e0605a", e: "#2a1a0f", w: "#fff3d6", k: "#5a3a2a" };
  const LEGS_BOY = { idle: ["..obb..bbo..", "..obb..bbo..", "..kkk..kkk.."], step: ["..obb..bbo..", ".obb....bbo.", ".kkk....kkk."] };
  const CH = {
    girl: {
      name: "Girl", pal: { h: "#7a4a2a", t: "#c9a2c9", b: "#4a4252" },
      rows: ["...oooooo...", "..ohhhhhho..", ".ohhhhhhhho.", ".ohssssssho.", ".ohsessesho.", ".ohssrrssho.", "..ohssssho..",
             ".ohttttttho.", ".ohttttttho.", ".ohttwwttho.", ".ohttwwttho.", "..obbbbbbo..", ".obbbbbbbbo."],
      legs: { idle: ["...ss..ss...", "...ss..ss...", "..kkk..kkk.."], step: ["...ss..ss...", "..ss....ss..", ".kkk....kkk."] },
    },
    boy: {
      name: "Boy", pal: { h: "#8a5a34", t: "#5a5a66", y: "#2f7fd0", b: "#3a3a44" },
      rows: ["...oooooo...", "..ohhhhhho..", ".ohhhhhhhho.", ".ohhhhhhhho.", ".osesssseso.", ".ossssrrsso.", "..osssssso..",
             "..otttttto..", ".owtwyywtwo.", ".owtwyywtwo.", ".osttttttso.", "..obbbbbbo..", "..obbbbbbo.."],
      legs: LEGS_BOY,
    },
    marco: {
      name: "Marco", pal: { y: "#d9a441", h: "#c9a56a", t: "#4a9b5a", b: "#6b4423" },
      rows: ["..oyyyyyyo..", ".oyyyyyyyyo.", "oyyyyyyyyyyo", ".osssssssso.", ".osesssseso.", ".ohhhhhhhho.", "..ohhhhhho..",
             "..otttttto..", ".otttwwttto.", ".ostwwwwtso.", ".ostwwwwtso.", "..owwwwwwo..", "..owwwwwwo.."],
      legs: LEGS_BOY,
    },
  };
  const cache = {};
  function url(id, frame = "idle") {
    const key = id + frame;
    if (cache[key]) return cache[key];
    const c = CH[id], rows = c.rows.concat(c.legs[frame] || c.legs.idle);
    const cv = document.createElement("canvas");
    cv.width = 12; cv.height = 16;
    const g = cv.getContext("2d");
    rows.forEach((row, y) => [...row].forEach((ch, x) => {
      const col = c.pal[ch] || BASE[ch];
      if (col) { g.fillStyle = col; g.fillRect(x, y, 1, 1); }
    }));
    return (cache[key] = cv.toDataURL());
  }
  const img = (id, frame = "idle", scale = 4, cls = "px") =>
    `<img class="${cls}" src="${url(id, frame)}" width="${12 * scale}" height="${16 * scale}" alt="${CH[id].name}" draggable="false">`;
  return { url, img, data: CH, names: ["girl", "boy"] };
})();
