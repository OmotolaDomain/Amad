/* AMAD art: seeded line-art motifs, one per world (see DESIGN.md §2).
   Every stroke uses pathLength="1" so CSS can "draw" it with stroke-dashoffset. */
(() => {
  "use strict";

  function rng(seedStr) {
    let h = 2166136261;
    for (let i = 0; i < seedStr.length; i++) h = Math.imul(h ^ seedStr.charCodeAt(i), 16777619);
    return () => { h += 0x6d2b79f5; let t = h; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  }
  const f = (n) => Math.round(n * 10) / 10;
  const path = (d, cls = "", extra = "") => `<path pathLength="1" class="${cls}" d="${d}" ${extra}/>`;

  // Each motif draws into a 400 x 500 box; the SVG uses "slice" so it fills any cover shape.
  const motifs = {
    // Strategy: a chessboard ghost with a knight's L-shaped path across it.
    knight(r) {
      const s = 50, out = [];
      for (let x = 0; x < 8; x++) for (let y = 0; y < 10; y++) if ((x + y) % 2) out.push(`<rect class="faint" x="${x * s}" y="${y * s}" width="${s}" height="${s}"/>`);
      let x = 1 + Math.floor(r() * 2), y = 7 + Math.floor(r() * 2);
      const pts = [[x, y]];
      const moves = [[1, -2], [2, -1], [-1, -2], [1, -2], [2, -1], [-2, -1]];
      for (let i = 0; i < 4; i++) {
        let m = moves[Math.floor(r() * moves.length)];
        if (x + m[0] < 0 || x + m[0] > 7) m = [-m[0], m[1]];
        if (y + m[1] < 0) m = [m[0], -m[1]];
        // knight moves as an L: two straight segments
        pts.push([x + m[0], y]); x += m[0]; y += m[1]; pts.push([x, y]);
      }
      const c = (p) => `${p[0] * s + s / 2} ${p[1] * s + s / 2}`;
      out.push(path("M" + pts.map(c).join(" L"), "stroke"));
      const end = pts[pts.length - 1];
      out.push(`<circle class="dot pop" cx="${end[0] * s + s / 2}" cy="${end[1] * s + s / 2}" r="9"/>`);
      return out.join("");
    },
    // Enterprise: a buying group, nodes linked into a network with one champion path.
    network(r) {
      const n = 9, nodes = [];
      for (let i = 0; i < n; i++) nodes.push([40 + r() * 320, 60 + r() * 380]);
      const out = [];
      nodes.forEach((a, i) => {
        const near = nodes.map((b, j) => [Math.hypot(a[0] - b[0], a[1] - b[1]), j]).sort((p, q) => p[0] - q[0]).slice(1, 3);
        near.forEach(([, j]) => { if (j > i) out.push(path(`M${f(a[0])} ${f(a[1])} L${f(nodes[j][0])} ${f(nodes[j][1])}`, "stroke thin")); });
      });
      nodes.forEach((p, i) => out.push(`<circle class="${i === 0 ? "dot pop" : "ring-dot"}" cx="${f(p[0])}" cy="${f(p[1])}" r="${i === 0 ? 10 : 6}"/>`));
      return out.join("");
    },
    // Territory: topographic contour lines around one or two summits.
    contour(r) {
      const out = [], peaks = [[120 + r() * 160, 140 + r() * 220]];
      if (r() > 0.4) peaks.push([60 + r() * 280, 300 + r() * 160]);
      const ph = [r() * 6, r() * 6, r() * 6];
      peaks.forEach((c, pi) => {
        for (let k = 1; k <= 7; k++) {
          const base = k * 26 + pi * 6;
          let d = "";
          for (let a = 0; a <= 64; a++) {
            const t = (a / 64) * Math.PI * 2;
            const rad = base * (1 + 0.16 * Math.sin(3 * t + ph[0] + k * 0.3) + 0.08 * Math.sin(5 * t + ph[1]) + 0.05 * Math.cos(2 * t + ph[2]));
            d += `${a ? "L" : "M"}${f(c[0] + rad * Math.cos(t))} ${f(c[1] + rad * 1.1 * Math.sin(t))}`;
          }
          out.push(path(d + "Z", k === 4 ? "stroke" : "stroke thin"));
        }
      });
      out.push(`<circle class="dot pop" cx="${f(peaks[0][0])}" cy="${f(peaks[0][1])}" r="7"/>`);
      return out.join("");
    },
    // Performance: speed lines and a compounding curve.
    velocity(r) {
      const out = [];
      for (let i = 0; i < 9; i++) {
        const y = 60 + i * 48 + r() * 10, x = r() * 120;
        out.push(path(`M${f(x)} ${f(y)} L${f(x + 120 + r() * 200)} ${f(y)}`, "stroke thin"));
      }
      let d = "M20 470";
      for (let x = 20; x <= 380; x += 10) d += ` L${x} ${f(470 - 400 * Math.pow((x - 20) / 360, 2.4))}`;
      out.push(path(d, "stroke"));
      out.push(`<circle class="dot pop" cx="380" cy="70" r="9"/>`);
      return out.join("");
    },
    // Accounts: concentric growth rings, slightly off-centre, like a tree cross-section.
    rings(r) {
      const out = [], cx = 140 + r() * 120, cy = 180 + r() * 160;
      for (let k = 1; k <= 9; k++) {
        const rad = k * 24 + r() * 6, wob = 0.04 + r() * 0.05;
        let d = "";
        for (let a = 0; a <= 72; a++) {
          const t = (a / 72) * Math.PI * 2;
          const rr = rad * (1 + wob * Math.sin(4 * t + k));
          d += `${a ? "L" : "M"}${f(cx + rr * Math.cos(t))} ${f(cy + rr * Math.sin(t))}`;
        }
        out.push(path(d + "Z", k % 3 === 0 ? "stroke" : "stroke thin"));
      }
      out.push(`<circle class="dot pop" cx="${f(cx)}" cy="${f(cy)}" r="7"/>`);
      return out.join("");
    },
    // Executive: a spotlight cone falling on a single point.
    spotlight(r) {
      const sx = 60 + r() * 280, tx = 120 + r() * 160;
      const out = [
        path(`M${f(sx - 14)} 0 L${f(tx - 110)} 430`, "stroke thin"),
        path(`M${f(sx + 14)} 0 L${f(tx + 110)} 430`, "stroke thin"),
        path(`M${f(tx - 110)} 430 A110 26 0 1 0 ${f(tx + 110)} 430 A110 26 0 1 0 ${f(tx - 110)} 430`, "stroke"),
      ];
      for (let i = 0; i < 14; i++) out.push(`<circle class="mote" cx="${f(tx - 80 + r() * 160)}" cy="${f(80 + r() * 320)}" r="${f(1 + r() * 2)}"/>`);
      out.push(`<circle class="dot pop" cx="${f(tx)}" cy="430" r="8"/>`);
      return out.join("");
    },
    // Branding: one beam enters a prism and leaves as a spectrum.
    prism(r) {
      const cx = 180 + r() * 40, cy = 240 + r() * 40;
      const tri = `M${cx} ${cy - 90} L${cx + 80} ${cy + 50} L${cx - 80} ${cy + 50} Z`;
      const out = [path(`M0 ${f(cy + 40 + r() * 30)} L${cx - 40} ${cy}`, "stroke"), path(tri, "stroke")];
      for (let i = 0; i < 6; i++) out.push(path(`M${cx + 40} ${cy} L400 ${f(cy - 120 + i * 50)}`, `stroke thin ray ray-${i}`));
      return out.join("");
    },
  };

  /** Returns an inline SVG string for a world motif, deterministic for a given seed. */
  function motif(name, seed) {
    const draw = motifs[name] || motifs.knight;
    return `<svg class="motif motif-${name}" viewBox="0 0 400 500" preserveAspectRatio="xMidYMid slice" aria-hidden="true" focusable="false">${draw(rng(name + seed))}</svg>`;
  }

  window.AMADArt = { motif, rng };
})();
