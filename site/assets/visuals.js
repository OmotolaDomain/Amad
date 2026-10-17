/* AMAD visual explanations: small interactive diagrams that sit inside the idea reader.
   Each one: title, a text alternative (caption), and a mount(root) that wires its own controls.
   Colours come from the world's CSS variables (--shadow / --hi) set on the reader. */
(() => {
  "use strict";
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const pct = (n) => `${Math.round(n)}%`;

  const V = {
    kernel: {
      title: "The kernel of a strategy",
      caption: "Three linked parts: a diagnosis of the challenge, a guiding policy, and coherent actions. Tap each part to see an illustrative example.",
      mount(root) {
        const parts = [
          ["Diagnosis", "What's really going on?", "Customers now research online, so our reps arrive after the shortlist is made."],
          ["Guiding policy", "Our overall approach", "Win by being the expert adviser in the first 30 days of a project."],
          ["Coherent actions", "Steps that reinforce each other", "Publish specification guides, move reps to early-stage leads, and pay commission on first orders."],
        ];
        root.innerHTML = `<div class="kernel">${parts.map((p, i) => `<button class="kernel-node" data-i="${i}" aria-pressed="${i === 0}"><b>${p[0]}</b><span>${p[1]}</span></button>${i < 2 ? '<span class="kernel-link" aria-hidden="true"></span>' : ""}`).join("")}</div>
          <p class="viz-out" aria-live="polite"></p><p class="viz-note">Illustrative example: a regional distributor losing share to online rivals.</p>`;
        const out = root.querySelector(".viz-out");
        const show = (i) => { root.querySelectorAll(".kernel-node").forEach((b, j) => b.setAttribute("aria-pressed", j === i)); out.textContent = parts[i][2]; out.classList.remove("in"); void out.offsetWidth; out.classList.add("in"); };
        root.addEventListener("click", (e) => { const b = e.target.closest(".kernel-node"); if (b) show(+b.dataset.i); });
        show(0);
      },
    },

    cascade: {
      title: "Five linked choices",
      caption: "Playing to Win's cascade: aspiration, where to play, how to win, capabilities and management systems. Each choice must support the one above.",
      mount(root) {
        const steps = [
          ["Winning aspiration", "Be the default choice for mid-size logistics firms in Europe."],
          ["Where to play", "Mid-size logistics firms, sold directly and through partners, in the EU."],
          ["How to win", "The fastest implementation in the market: live in 30 days."],
          ["Capabilities", "Pre-built integrations and a proven implementation playbook."],
          ["Management systems", "Time-to-value tracked weekly; bonuses tied to customer go-lives."],
        ];
        let n = 1;
        root.innerHTML = `<ol class="cascade"></ol><div class="viz-controls"><button class="vbtn" data-act="next">Add the next choice</button><button class="vbtn ghost" data-act="reset">Start again</button></div><p class="viz-note">Illustrative example: a B2B software firm.</p>`;
        const ol = root.querySelector("ol"), next = root.querySelector('[data-act="next"]');
        const draw = () => {
          ol.innerHTML = steps.slice(0, n).map((s, i) => `<li class="cascade-step" style="--i:${i}"><b>${s[0]}</b><span>${s[1]}</span></li>`).join("");
          next.disabled = n >= steps.length;
        };
        root.addEventListener("click", (e) => { const a = e.target.closest("[data-act]")?.dataset.act; if (a === "next" && n < steps.length) n++; if (a === "reset") n = 1; if (a) draw(); });
        draw();
      },
    },

    premortem: {
      title: "Run it forward, then look back",
      caption: "A pre-mortem imagines the project has already failed, then works back to the causes while there is still time to act.",
      mount(root) {
        const reasons = ["Our champion left halfway through", "Scope kept growing and the launch slipped", "Pricing confused the buyers", "Nobody owned the customer handover"];
        root.innerHTML = `<div class="pm-line"><span class="pm-stop">Today</span><span class="pm-stop">Launch</span><span class="pm-stop fail">12 months: it failed</span><span class="pm-marker" aria-hidden="true"></span></div>
          <ul class="pm-reasons"></ul><div class="viz-controls"><button class="vbtn" data-act="go">Imagine it failed</button></div>`;
        const line = root.querySelector(".pm-line"), ul = root.querySelector(".pm-reasons"), btn = root.querySelector("button");
        btn.addEventListener("click", () => {
          if (line.classList.contains("done")) { line.classList.remove("done"); ul.innerHTML = ""; btn.textContent = "Imagine it failed"; return; }
          line.classList.add("done");
          ul.innerHTML = reasons.map((r, i) => `<li style="--i:${i}">${esc(r)}</li>`).join("") + `<li class="pm-fix" style="--i:${reasons.length}">Each of these becomes a risk you can fix before kickoff.</li>`;
          btn.textContent = "Rewind";
        });
      },
    },

    errc: {
      title: "The ERRC grid: Cirque du Soleil",
      caption: "Kim and Mauborgne's example. Cirque du Soleil eliminated star performers and animal shows, reduced thrill and danger, raised the venue, and created theme and artistic music and dance.",
      mount(root) {
        const q = [
          ["Eliminate", "Star performers · Animal shows · Aisle concession sales · Multiple show arenas"],
          ["Raise", "Unique venue"],
          ["Reduce", "Fun and humour · Thrill and danger"],
          ["Create", "Theme · Refined watching environment · Multiple productions · Artistic music and dance"],
        ];
        root.innerHTML = `<div class="errc">${q.map((x, i) => `<button class="errc-cell" data-i="${i}" aria-expanded="false"><b>${x[0]}</b><span>${esc(x[1]).replaceAll(" · ", "<br>")}</span></button>`).join("")}</div><p class="viz-note">Tap a square to open it. Source: Blue Ocean Strategy, HBR (2004).</p>`;
        root.addEventListener("click", (e) => { const c = e.target.closest(".errc-cell"); if (c) c.setAttribute("aria-expanded", c.getAttribute("aria-expanded") !== "true"); });
      },
    },

    "buying-group": {
      title: "Where a buying group's time goes",
      caption: "Gartner found B2B buyers spend about 27% of buying time researching online, 18% researching offline, 22% meeting their own buying group, 17% meeting suppliers and 16% on other tasks.",
      mount(root) {
        const seg = [["Researching online", 27], ["Researching offline", 18], ["Meeting their buying group", 22], ["Meeting suppliers", 17], ["Other", 16]];
        let vendors = 3;
        root.innerHTML = `<div class="donut-wrap"><svg class="donut" viewBox="0 0 42 42" aria-hidden="true"></svg><div class="donut-center"><b class="vend-share"></b><span>of their time with you</span></div></div>
          <ul class="legend">${seg.map((s, i) => `<li class="lg-${i}"><i></i>${s[0]} <b>${s[1]}%</b></li>`).join("")}</ul>
          <label class="viz-slider">Suppliers being considered: <b class="vend-n"></b><input type="range" min="1" max="5" value="3"></label>
          <p class="viz-note">Source: Gartner B2B buying journey research.</p>`;
        const svg = root.querySelector("svg"), input = root.querySelector("input");
        const draw = () => {
          let off = 25, h = "";
          seg.forEach((s, i) => {
            if (i === 3) {
              const per = s[1] / vendors;
              for (let v = 0; v < vendors; v++) { h += `<circle class="arc lg-3 ${v === 0 ? "you" : "rival"}" cx="21" cy="21" r="15.9" stroke-dasharray="${per - 0.4} ${100 - per + 0.4}" stroke-dashoffset="${off}"/>`; off -= per; }
            } else { h += `<circle class="arc lg-${i}" cx="21" cy="21" r="15.9" stroke-dasharray="${s[1] - 0.4} ${100 - s[1] + 0.4}" stroke-dashoffset="${off}"/>`; off -= s[1]; }
          });
          svg.innerHTML = h;
          root.querySelector(".vend-share").textContent = `${(17 / vendors).toFixed(1)}%`;
          root.querySelector(".vend-n").textContent = vendors;
        };
        input.addEventListener("input", () => { vendors = +input.value; draw(); });
        draw();
      },
    },

    meddicc: {
      title: "Score a deal with MEDDICC",
      caption: "Mark each MEDDICC element you can evidence for a real deal. Unknown elements are the work to do next.",
      mount(root) {
        const L = [["M", "Metrics"], ["E", "Economic buyer"], ["D", "Decision criteria"], ["D", "Decision process"], ["I", "Identified pain"], ["C", "Champion"], ["C", "Competition"]];
        root.innerHTML = `<div class="medd">${L.map((l, i) => `<button class="medd-chip" data-i="${i}" aria-pressed="false"><b>${l[0]}</b><span>${l[1]}</span></button>`).join("")}</div>
          <div class="meter"><span></span></div><p class="viz-out" aria-live="polite"></p>`;
        const upd = () => {
          const known = root.querySelectorAll('[aria-pressed="true"]').length;
          root.querySelector(".meter span").style.transform = `scaleX(${known / 7})`;
          root.querySelector(".viz-out").textContent = known === 7 ? "7 of 7: well qualified. Keep checking as the deal moves." : known >= 5 ? `${known} of 7: promising. Close the gaps before forecasting.` : `${known} of 7: this deal is less real than it looks. Book meetings to fill the gaps.`;
        };
        root.addEventListener("click", (e) => { const c = e.target.closest(".medd-chip"); if (c) { c.setAttribute("aria-pressed", c.getAttribute("aria-pressed") !== "true"); upd(); } });
        upd();
      },
    },

    "map-timeline": {
      title: "Work back from go-live",
      caption: "A mutual action plan lists every step both sides must complete, working backwards from the customer's go-live date.",
      mount(root) {
        const steps = [["Go-live", 12], ["Contract signed", 10], ["Legal and procurement", 8], ["Security review passed", 6], ["Pilot success criteria met", 4], ["Business case approved", 2]];
        root.innerHTML = `<ol class="map-tl">${steps.map((s) => `<li><span class="wk">Week ${s[1]}</span><b>${s[0]}</b></li>`).join("")}</ol>
          <div class="viz-controls"><button class="vbtn">Work backwards</button></div><p class="viz-note">Illustrative 12-week plan.</p>`;
        const ol = root.querySelector("ol");
        root.querySelector("button").addEventListener("click", (e) => { ol.classList.toggle("on"); e.target.textContent = ol.classList.contains("on") ? "Reset" : "Work backwards"; });
      },
    },

    balance: {
      title: "Equal accounts, unequal opportunity",
      caption: "Five territories with the same number of accounts can hold very different potential. Rebalancing by potential brings every territory closer to quota.",
      mount(root) {
        const byCount = [180, 60, 140, 90, 230], balanced = [142, 136, 140, 138, 144], quota = 140;
        root.innerHTML = `<div class="bars">${byCount.map((_, i) => `<div class="bar"><span></span><i>T${i + 1}</i></div>`).join("")}<div class="quota" style="--q:${quota / 250}"><em>Quota</em></div></div>
          <div class="seg" role="radiogroup"><button role="radio" aria-checked="true" data-m="count">Split by account count</button><button role="radio" aria-checked="false" data-m="pot">Balanced by potential</button></div>
          <p class="viz-out" aria-live="polite"></p><p class="viz-note">Illustrative potential, in £k.</p>`;
        const set = (m) => {
          const v = m === "count" ? byCount : balanced;
          root.querySelectorAll(".bar span").forEach((s, i) => { s.style.transform = `scaleY(${v[i] / 250})`; s.classList.toggle("over", v[i] > quota * 1.25); s.classList.toggle("under", v[i] < quota * 0.75); });
          root.querySelectorAll("[data-m]").forEach((b) => b.setAttribute("aria-checked", b.dataset.m === m));
          root.querySelector(".viz-out").textContent = m === "count" ? "T2 and T4 can't reach quota, while T5 has more than one rep can cover." : "Every territory now has enough potential to hit quota, and no rep is overloaded.";
        };
        root.addEventListener("click", (e) => { const b = e.target.closest("[data-m]"); if (b) set(b.dataset.m); });
        set("count");
      },
    },

    tiering: {
      title: "Fit × potential",
      caption: "Plot accounts by fit with your ideal customer profile and by potential spend. Tier 1 gets named reps, tier 2 pooled coverage and tier 3 digital coverage.",
      mount(root) {
        const rand = window.AMADArt.rng("tiering");
        const dots = Array.from({ length: 30 }, () => [rand(), rand()]);
        const tier = (x, y) => (x + y > 1.3 ? 1 : x + y > 0.8 ? 2 : 3);
        root.innerHTML = `<div class="matrix"><span class="ax-x">Fit with your ideal customer</span><span class="ax-y">Potential</span>${dots.map((d) => `<i class="mdot t${tier(d[0], d[1])}" style="left:${d[0] * 92 + 4}%;bottom:${d[1] * 88 + 6}%"></i>`).join("")}</div>
          <div class="seg">${[1, 2, 3].map((t) => `<button data-t="${t}" aria-pressed="false">Tier ${t}</button>`).join("")}</div><p class="viz-out" aria-live="polite">Tap a tier.</p>`;
        const txt = { 1: "Tier 1: named account reps and deep, multi-threaded coverage.", 2: "Tier 2: pooled or pod coverage with regular touchpoints.", 3: "Tier 3: digital and inside-sales motions." };
        root.addEventListener("click", (e) => {
          const b = e.target.closest("[data-t]"); if (!b) return;
          root.querySelectorAll("[data-t]").forEach((x) => x.setAttribute("aria-pressed", x === b));
          root.querySelector(".matrix").dataset.show = b.dataset.t;
          const n = root.querySelectorAll(`.mdot.t${b.dataset.t}`).length;
          root.querySelector(".viz-out").textContent = `${n} accounts. ${txt[b.dataset.t]}`;
        });
      },
    },

    whitespace: {
      title: "Find the empty cells",
      caption: "A grid of accounts against products. Filled cells are what customers buy today; empty cells are expansion opportunities with relationships you already have.",
      mount(root) {
        const acc = ["Northwind", "Contoso", "Fabrikam", "Tailspin", "Litware", "Adatum"], prod = ["Core", "Analytics", "Support+", "Training", "API"];
        const rand = window.AMADArt.rng("whitespace");
        const owned = acc.map(() => prod.map((_, j) => j === 0 || rand() > 0.62));
        root.innerHTML = `<div class="ws" style="--cols:${prod.length}"><span></span>${prod.map((p) => `<span class="ws-h">${p}</span>`).join("")}${acc.map((a, i) => `<span class="ws-r">${a}</span>${prod.map((_, j) => `<i class="ws-c ${owned[i][j] ? "own" : "gap"}"></i>`).join("")}`).join("")}</div>
          <div class="viz-controls"><button class="vbtn">Show the whitespace</button></div><p class="viz-out" aria-live="polite"></p><p class="viz-note">Illustrative accounts.</p>`;
        root.querySelector("button").addEventListener("click", (e) => {
          const g = root.querySelector(".ws"); g.classList.toggle("reveal");
          const gaps = root.querySelectorAll(".ws-c.gap").length;
          root.querySelector(".viz-out").textContent = g.classList.contains("reveal") ? `${gaps} expansion opportunities in accounts that already trust you.` : "";
          e.target.textContent = g.classList.contains("reveal") ? "Hide" : "Show the whitespace";
        });
      },
    },

    velocity: {
      title: "Sales velocity calculator",
      caption: "Velocity equals opportunities times win rate times deal size, divided by cycle length. Improving every lever by 10% compounds to about 48% more revenue per day.",
      mount(root) {
        const base = { opps: 40, win: 25, size: 30, cycle: 90 };
        let v = { ...base };
        const fields = [["opps", "Qualified opportunities", 10, 100, 1, ""], ["win", "Win rate", 5, 60, 1, "%"], ["size", "Average deal size", 5, 150, 1, "k"], ["cycle", "Sales cycle", 20, 240, 1, " days"]];
        root.innerHTML = `<div class="vel-out"><b class="vel-num"></b><span>£ per day in your pipeline</span><em class="vel-delta"></em></div>
          ${fields.map((f) => `<label class="viz-slider">${f[1]}: <b data-o="${f[0]}"></b><input type="range" data-k="${f[0]}" min="${f[2]}" max="${f[3]}" step="${f[4]}"></label>`).join("")}
          <div class="viz-controls"><button class="vbtn" data-act="boost">Improve every lever by 10%</button><button class="vbtn ghost" data-act="reset">Reset</button></div>`;
        const calc = (x) => (x.opps * (x.win / 100) * x.size * 1000) / x.cycle;
        const draw = () => {
          fields.forEach((f) => { root.querySelector(`[data-k="${f[0]}"]`).value = v[f[0]]; root.querySelector(`[data-o="${f[0]}"]`).textContent = `${f[0] === "size" ? "£" : ""}${Math.round(v[f[0]])}${f[5]}`; });
          const now = calc(v), d = (now / calc(base) - 1) * 100;
          root.querySelector(".vel-num").textContent = `£${Math.round(now).toLocaleString()}`;
          root.querySelector(".vel-delta").textContent = Math.abs(d) < 0.5 ? "" : `${d > 0 ? "+" : ""}${Math.round(d)}% vs start`;
        };
        root.addEventListener("input", (e) => { if (e.target.dataset.k) { v[e.target.dataset.k] = +e.target.value; draw(); } });
        root.addEventListener("click", (e) => {
          const a = e.target.closest("[data-act]")?.dataset.act;
          if (a === "boost") v = { opps: v.opps * 1.1, win: v.win * 1.1, size: v.size * 1.1, cycle: v.cycle * 0.9 };
          if (a === "reset") v = { ...base };
          if (a) draw();
        });
        draw();
      },
    },

    constraint: {
      title: "Find the constraint",
      caption: "A pipeline's output is limited by its tightest stage. Adding capacity anywhere else changes nothing; relieve the constraint and it moves.",
      mount(root) {
        const stages = [["Leads", 60], ["Qualified", 40], ["Solution demo", 14], ["Legal review", 22], ["Closed", 30]];
        root.innerHTML = `<div class="flow"></div><p class="viz-out" aria-live="polite"></p><p class="viz-note">Tap + to add capacity to a stage (deals per month). Illustrative numbers.</p>`;
        const flow = root.querySelector(".flow");
        const draw = () => {
          const min = Math.min(...stages.map((s) => s[1]));
          const ci = stages.findIndex((s) => s[1] === min);
          flow.innerHTML = stages.map((s, i) => `<div class="stage ${i === ci ? "con" : ""}"><span class="pipe" style="--w:${s[1] / 60}"></span><b>${s[0]}</b><em>${s[1]}/mo</em><button class="plus" data-i="${i}" aria-label="Add capacity to ${s[0]}">+</button></div>`).join("");
          root.querySelector(".viz-out").textContent = `Throughput: ${min} deals a month. The constraint is ${stages[ci][0]}.`;
        };
        root.addEventListener("click", (e) => { const b = e.target.closest(".plus"); if (b) { stages[+b.dataset.i][1] = Math.min(60, stages[+b.dataset.i][1] + 6); draw(); } });
        draw();
      },
    },

    nrr: {
      title: "From 100 to net revenue retention",
      caption: "Start with 100 of revenue from a group of customers. Add expansion, subtract contraction and churn: the result is NRR. Gross retention ignores expansion.",
      mount(root) {
        const v = { exp: 25, con: 5, churn: 8 };
        root.innerHTML = `<div class="wf"></div>
          <label class="viz-slider">Expansion: <b data-o="exp"></b><input type="range" data-k="exp" min="0" max="50" value="25"></label>
          <label class="viz-slider">Contraction: <b data-o="con"></b><input type="range" data-k="con" min="0" max="30" value="5"></label>
          <label class="viz-slider">Churn: <b data-o="churn"></b><input type="range" data-k="churn" min="0" max="40" value="8"></label>
          <p class="viz-out" aria-live="polite"></p>`;
        const draw = () => {
          const nrr = 100 + v.exp - v.con - v.churn, grr = 100 - v.con - v.churn, sc = 1 / 160;
          const bars = [["Start", 0, 100, "base"], ["Expansion", 100, v.exp, "up"], ["Contraction", 100 + v.exp - v.con, v.con, "down"], ["Churn", nrr, v.churn, "down"], ["NRR", 0, nrr, nrr >= 100 ? "good" : "bad"]];
          root.querySelector(".wf").innerHTML = bars.map((b) => `<div class="wf-col"><span class="wf-bar ${b[3]}" style="bottom:${b[1] * sc * 100}%;height:${Math.max(b[2], 0.5) * sc * 100}%"></span><i>${b[0]}</i><em>${Math.round(b[2])}</em></div>`).join("");
          Object.keys(v).forEach((k) => (root.querySelector(`[data-o="${k}"]`).textContent = `${v[k]}%`));
          root.querySelector(".viz-out").textContent = `Net revenue retention ${pct(nrr)} · gross retention ${pct(grr)}. ${nrr >= 100 ? "Your base grows on its own." : "Your base shrinks without new logos."}`;
        };
        root.addEventListener("input", (e) => { if (e.target.dataset.k) { v[e.target.dataset.k] = +e.target.value; draw(); } });
        draw();
      },
    },

    "relationship-map": {
      title: "Single-threaded or multi-threaded?",
      caption: "When everything runs through one contact, losing them puts the account at risk. Several threads at different levels keep it safe.",
      mount(root) {
        const people = [["CFO", 200, 40], ["COO", 320, 60], ["Champion", 120, 130], ["IT lead", 260, 150], ["Procurement", 60, 220], ["Ops manager", 330, 230]];
        let multi = false, gone = false;
        root.innerHTML = `<svg class="rmap" viewBox="0 0 400 300" role="img" aria-label="Relationship map"></svg>
          <div class="seg"><button data-a="single" aria-pressed="true">Single-threaded</button><button data-a="multi" aria-pressed="false">Multi-threaded</button></div>
          <div class="viz-controls"><button class="vbtn" data-a="leave">The champion leaves</button></div><p class="viz-out" aria-live="polite"></p>`;
        const svg = root.querySelector("svg");
        const draw = () => {
          const links = multi ? [0, 2, 3, 5] : [2];
          let h = "";
          people.forEach((p, i) => { if (links.includes(i) && !(gone && i === 2)) h += `<line class="rl" x1="200" y1="285" x2="${p[1]}" y2="${p[2] + 14}"/>`; });
          h += `<circle class="you" cx="200" cy="285" r="10"/><text class="rt" x="218" y="290">You</text>`;
          people.forEach((p, i) => { const off = gone && i === 2; h += `<g class="${off ? "left" : links.includes(i) ? "linked" : ""}"><circle cx="${p[1]}" cy="${p[2]}" r="13"/><text class="rt" x="${p[1]}" y="${p[2] - 20}" text-anchor="middle">${p[0]}</text></g>`; });
          svg.innerHTML = h;
          const alive = links.filter((i) => !(gone && i === 2)).length;
          root.querySelector(".viz-out").textContent = alive === 0 ? "No relationships left. The renewal is at serious risk." : gone ? `${alive} threads remain. The account survives the change.` : `${alive} relationship${alive > 1 ? "s" : ""} into this account.`;
          root.querySelectorAll("[data-a=single],[data-a=multi]").forEach((b) => b.setAttribute("aria-pressed", (b.dataset.a === "multi") === multi));
          root.querySelector('[data-a="leave"]').textContent = gone ? "Bring the champion back" : "The champion leaves";
        };
        root.addEventListener("click", (e) => { const a = e.target.closest("[data-a]")?.dataset.a; if (a === "single") multi = false; if (a === "multi") multi = true; if (a === "leave") gone = !gone; if (a) draw(); });
        draw();
      },
    },

    pyramid: {
      title: "Lead with the answer",
      caption: "The Pyramid Principle puts the recommendation first, then the supporting arguments, then the data. Compare the order a busy executive reads each version in.",
      mount(root) {
        root.innerHTML = `<div class="pyr" data-mode="top">
            <div class="pyr-row"><span class="pyr-box" data-o="1" data-b="7">Move two reps from Region A to Region B</span></div>
            <div class="pyr-row"><span class="pyr-box" data-o="2" data-b="4">B has twice A's untapped potential</span><span class="pyr-box" data-o="3" data-b="5">A's reps run at 60% capacity</span><span class="pyr-box" data-o="4" data-b="6">Cost stays neutral</span></div>
            <div class="pyr-row data"><span class="pyr-box" data-o="5" data-b="1">Potential model</span><span class="pyr-box" data-o="6" data-b="2">Activity data</span><span class="pyr-box" data-o="7" data-b="3">Budget</span></div>
          </div>
          <div class="seg"><button data-m="top" aria-pressed="true">Top-down</button><button data-m="bottom" aria-pressed="false">Bottom-up</button></div><p class="viz-out" aria-live="polite"></p>`;
        const set = (m) => {
          root.querySelector(".pyr").dataset.mode = m;
          root.querySelectorAll(".pyr-box").forEach((b) => b.style.setProperty("--n", m === "top" ? b.dataset.o : b.dataset.b));
          root.querySelectorAll("[data-m]").forEach((b) => b.setAttribute("aria-pressed", b.dataset.m === m));
          root.querySelector(".viz-out").textContent = m === "top" ? "The executive knows your recommendation in the first sentence." : "The recommendation arrives seventh. Many busy readers never get there.";
        };
        root.addEventListener("click", (e) => { const b = e.target.closest("[data-m]"); if (b) set(b.dataset.m); });
        set("top");
      },
    },

    "brand-activation": {
      title: "Short spikes, long growth",
      caption: "A simple illustrative model: activation creates short sales spikes that fade, while brand building lifts the baseline over time. Move the slider to change the budget split.",
      mount(root) {
        root.innerHTML = `<svg class="ba" viewBox="0 0 300 150" role="img" aria-label="Sales over twelve quarters"></svg>
          <label class="viz-slider">Share of budget on brand building: <b class="ba-v"></b><input type="range" min="0" max="100" value="60"></label>
          <p class="viz-out" aria-live="polite"></p><p class="viz-note">Illustrative model inspired by Binet &amp; Field. Not real data.</p>`;
        const svg = root.querySelector("svg"), input = root.querySelector("input");
        const draw = () => {
          const b = +input.value / 100, a = 1 - b;
          let base = 40, pts = [], total = 0;
          for (let q = 0; q < 12; q++) {
            base += b * 6 - 1.2;
            for (let k = 0; k < 4; k++) { const s = base + a * 38 * Math.exp(-k * 1.1); pts.push(s); total += s; }
          }
          const x = (i) => (i / (pts.length - 1)) * 290 + 5, y = (v) => 145 - Math.min(140, v) * 0.95;
          svg.innerHTML = `<path class="ba-line" d="${pts.map((v, i) => `${i ? "L" : "M"}${x(i).toFixed(1)} ${y(v).toFixed(1)}`).join("")}"/><line class="ba-axis" x1="5" y1="145" x2="295" y2="145"/>`;
          root.querySelector(".ba-v").textContent = `${input.value}%`;
          root.querySelector(".viz-out").textContent = b < 0.3 ? "Big spikes, but the baseline erodes." : b > 0.85 ? "Strong baseline growth, but few short-term sales." : "Spikes now and a rising baseline later.";
        };
        input.addEventListener("input", draw);
        draw();
      },
    },
  };

  /** Mount a visual into a container; returns its metadata or null when unknown. */
  function mount(name, el) {
    const v = V[name];
    if (!v) return null;
    el.innerHTML = `<div class="viz" data-viz="${esc(name)}"><h3 class="viz-title">${esc(v.title)}</h3><div class="viz-body"></div><p class="sr-only">${esc(v.caption)}</p></div>`;
    v.mount(el.querySelector(".viz-body"));
    return v;
  }
  window.AMADVisuals = { mount, names: Object.keys(V), get: (n) => V[n] };
})();
