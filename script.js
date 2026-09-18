
(function () {
  "use strict";

  /* ---------- palette (kept in sync with style.css) ---------- */
  var COLOR = {
    red: "#ff4757",
    black: "#2f3542",
    nil: "#3a3a4e",
    nilText: "#8a8aa0",
    sel: "#ffd700",
    edge: "#555a6e",
    text: "#ffffff",
    muted: "#6c7280"
  };

  var GAP_X = 62;   // horizontal spacing between in-order positions
  var GAP_Y = 76;   // vertical spacing between levels
  var RADIUS = 20;

  /* ============================================================
     Tree engine
     ============================================================ */

  var NIL = { key: null, color: "B", nil: true };
  NIL.left = NIL.right = NIL.parent = NIL;

  var root = NIL;
  var steps = [];   // recorded snapshots for the current insert batch

  function clone(n) {
    if (n === NIL) return null;
    return { key: n.key, color: n.color, left: clone(n.left), right: clone(n.right) };
  }

  function snap(text, cls, highlight) {
    steps.push({
      tree: clone(root),
      text: text,
      cls: cls || "log-info",
      hl: highlight || []
    });
  }

  function leftRotate(x) {
    var y = x.right;
    x.right = y.left;
    if (y.left !== NIL) y.left.parent = x;
    y.parent = x.parent;
    if (x.parent === NIL) root = y;
    else if (x === x.parent.left) x.parent.left = y;
    else x.parent.right = y;
    y.left = x;
    x.parent = y;
  }

  function rightRotate(x) {
    var y = x.left;
    x.left = y.right;
    if (y.right !== NIL) y.right.parent = x;
    y.parent = x.parent;
    if (x.parent === NIL) root = y;
    else if (x === x.parent.right) x.parent.right = y;
    else x.parent.left = y;
    y.right = x;
    x.parent = y;
  }

  function contains(k) {
    var x = root;
    while (x !== NIL) {
      if (k === x.key) return true;
      x = k < x.key ? x.left : x.right;
    }
    return false;
  }

  function insert(k) {
    if (contains(k)) {
      snap("Key " + k + " already exists — skipped.", "log-info", [k]);
      return;
    }

    var z = { key: k, color: "R", left: NIL, right: NIL, parent: NIL };
    var y = NIL, x = root, path = [];

    while (x !== NIL) {
      y = x;
      path.push(x.key + (k < x.key ? "→L" : "→R"));
      x = k < x.key ? x.left : x.right;
    }

    z.parent = y;
    if (y === NIL) root = z;
    else if (k < y.key) y.left = z;
    else y.right = z;

    if (y === NIL) {
      snap("Tree empty: " + k + " inserted as root (RED for now).", "log-info", [k]);
    } else {
      snap(
        "BST descent " + path.join(" ") + " — " + k + " becomes the " +
        (k < y.key ? "LEFT" : "RIGHT") + " child of " + y.key + ", coloured RED.",
        "log-info", [k]
      );
    }

    fixup(z);
  }

  function fixup(z) {
    while (z.parent.color === "R") {
      var p = z.parent, g = p.parent;
      var pk = p.key, gk = g.key, zk = z.key;
      var mirror = p === g.right;
      var uncle = mirror ? g.left : g.right;
      var m = mirror ? "'" : "";

      if (uncle.color === "R") {
        /* Case 1: red uncle — recolour, push the violation two levels up */
        p.color = "B";
        uncle.color = "B";
        g.color = "R";
        snap(
          "Case " + (mirror ? "1'" : "1") + ": parent " + pk + " and uncle " + uncle.key +
          " are both RED → recolour both BLACK, grandparent " + gk +
          " RED. Continue from " + gk + ".",
          "log-fix", [pk, uncle.key, gk]
        );
        z = g;
      } else {
        /* Case 2: black uncle, inner grandchild — rotate into case 3 */
        var inner = mirror ? (z === p.left) : (z === p.right);
        if (inner) {
          z = p;
          if (mirror) rightRotate(z); else leftRotate(z);
          snap(
            "Case 2" + m + ": uncle is BLACK and " + zk + " is an inner grandchild → " +
            (mirror ? "RIGHT" : "LEFT") + "-ROTATE at " + pk + ". Now it is case 3" + m + ".",
            "log-rotate", [zk, pk]
          );
        }
        /* Case 3: black uncle, outer grandchild — recolour + rotate, loop ends */
        var np = z.parent, ng = np.parent;
        np.color = "B";
        ng.color = "R";
        if (mirror) leftRotate(ng); else rightRotate(ng);
        snap(
          "Case 3" + m + ": uncle is BLACK, path is straight → colour " + np.key +
          " BLACK, " + ng.key + " RED, then " + (mirror ? "LEFT" : "RIGHT") +
          "-ROTATE at " + ng.key + ". " + np.key + " takes over the subtree.",
          "log-rotate", [np.key, ng.key]
        );
      }
    }

    if (root.color !== "B") {
      root.color = "B";
      snap("Property 2: root " + root.key + " repainted BLACK.", "log-fix", [root.key]);
    }

    var t = clone(root);
    snap(
      "Balanced. Nodes: " + countNodes(t) + ", height: " + height(t) +
      ", black-height: " + blackHeight(t) + ".",
      "log-step", []
    );
  }

  /* ---------- measurements on a plain cloned tree ---------- */

  function countNodes(t) { return t ? 1 + countNodes(t.left) + countNodes(t.right) : 0; }
  function height(t) { return t ? 1 + Math.max(height(t.left), height(t.right)) : 0; }

  function blackHeight(t) {
    function go(n) {
      if (!n) return 1;
      var l = go(n.left), r = go(n.right);
      if (l < 0 || r < 0 || l !== r) return -1;
      return l + (n.color === "B" ? 1 : 0);
    }
    var h = go(t);
    return h < 0 ? "violated" : h;
  }

  function noRedRed(t) {
    if (!t) return true;
    if (t.color === "R") {
      if (t.left && t.left.color === "R") return false;
      if (t.right && t.right.color === "R") return false;
    }
    return noRedRed(t.left) && noRedRed(t.right);
  }

  function inorder(t, out) {
    out = out || [];
    if (t) { inorder(t.left, out); out.push(t.key); inorder(t.right, out); }
    return out;
  }

  /* ============================================================
     Layout + SVG rendering
     ============================================================ */

  function layout(t) {
    var i = 0, nodes = [], edges = [];

    function walk(n, depth, id) {
      if (!n) {
        var leaf = { id: "nil" + id, nil: true, x: (i++) * GAP_X, y: depth * GAP_Y };
        nodes.push(leaf);
        return leaf;
      }
      var me = { id: "k" + n.key, key: n.key, color: n.color, y: depth * GAP_Y };
      var L = walk(n.left, depth + 1, id + "L");
      me.x = (i++) * GAP_X;
      var R = walk(n.right, depth + 1, id + "R");
      nodes.push(me);
      edges.push([me, L]);
      edges.push([me, R]);
      return me;
    }

    if (t) walk(t, 0, "r");

    var w = Math.max(1, i) * GAP_X;
    var h = nodes.reduce(function (m, n) { return Math.max(m, n.y); }, 0) + GAP_Y;
    return { nodes: nodes, edges: edges, w: w, h: h };
  }

  var SVGNS = "http://www.w3.org/2000/svg";

  function make(tag, attrs) {
    var e = document.createElementNS(SVGNS, tag);
    for (var k in attrs) e.setAttribute(k, attrs[k]);
    return e;
  }

  var svg = document.getElementById("treeSvg");

  function drawTree(t, hl) {
    while (svg.firstChild) svg.removeChild(svg.firstChild);
    svg.setAttribute("preserveAspectRatio", "xMidYMid meet");

    if (!t) {
      svg.setAttribute("viewBox", "0 0 400 200");
      var msg = make("text", {
        x: 200, y: 100, fill: COLOR.muted, "font-size": 15,
        "font-family": "Segoe UI, sans-serif", "text-anchor": "middle"
      });
      msg.textContent = "Tree is empty — enter keys and press Insert.";
      svg.appendChild(msg);
      return;
    }

    var L = layout(t);
    var g = make("g", {});

    L.edges.forEach(function (pair) {
      g.appendChild(make("line", {
        x1: pair[0].x, y1: pair[0].y, x2: pair[1].x, y2: pair[1].y,
        stroke: COLOR.edge, "stroke-width": 1.6
      }));
    });

    L.nodes.forEach(function (n) {
      var ng = make("g", { transform: "translate(" + n.x + "," + n.y + ")" });

      if (n.nil) {
        ng.appendChild(make("rect", {
          x: -13, y: -11, width: 26, height: 22, rx: 3,
          fill: COLOR.nil, stroke: "#2a2a3e"
        }));
        var nt = make("text", {
          fill: COLOR.nilText, "font-size": 10, "text-anchor": "middle",
          "dominant-baseline": "central", "font-family": "Consolas, monospace"
        });
        nt.textContent = "NIL";
        ng.appendChild(nt);
      } else {
        var selected = hl && hl.indexOf(n.key) !== -1;
        ng.appendChild(make("circle", {
          r: RADIUS,
          fill: n.color === "R" ? COLOR.red : COLOR.black,
          stroke: selected ? COLOR.sel : "#1a1a2a",
          "stroke-width": selected ? 4 : 2
        }));
        var kt = make("text", {
          fill: COLOR.text, "font-size": 15, "font-weight": "600",
          "text-anchor": "middle", "dominant-baseline": "central",
          "font-family": "Segoe UI, sans-serif"
        });
        kt.textContent = n.key;
        ng.appendChild(kt);
      }
      g.appendChild(ng);
    });

    svg.appendChild(g);

    var pad = 44;
    svg.setAttribute("viewBox",
      (-pad) + " " + (-pad) + " " +
      (L.w - GAP_X + pad * 2 + 24) + " " + (L.h - GAP_Y + pad * 2 + 24));
  }

  /* ============================================================
     Log
     ============================================================ */

  var logBox = document.getElementById("log");

  function logLine(text, cls) {
    var d = document.createElement("div");
    d.className = "log-entry " + (cls || "log-info");
    d.textContent = text;
    logBox.appendChild(d);
    logBox.scrollTop = logBox.scrollHeight;
  }

  function clearLog() { logBox.innerHTML = ""; }

  /* ============================================================
     Playback
     ============================================================ */

  var playlist = [];     // queued snapshots
  var cursor = -1;       // index of the snapshot currently on screen
  var timer = null;
  var speed = 800;

  var keyInput = document.getElementById("keyInput");
  var insertBtn = document.getElementById("insertBtn");
  var demoBtn = document.getElementById("demoBtn");
  var resetBtn = document.getElementById("resetBtn");
  var stepBtn = document.getElementById("stepBtn");
  var speedRange = document.getElementById("speedRange");
  var speedVal = document.getElementById("speedVal");

  function atEnd() { return cursor >= playlist.length - 1; }

  function syncButtons() {
    var playing = timer !== null;
    insertBtn.disabled = playing;
    demoBtn.disabled = playing;
    stepBtn.disabled = atEnd();
    stepBtn.textContent = playing ? "Pause" : "Step";
  }

  function showStep(i) {
    cursor = i;
    var s = playlist[i];
    drawTree(s.tree, s.hl);
    logLine(s.text, s.cls);
    syncButtons();
  }

  function stopPlay() {
    if (timer) { clearTimeout(timer); timer = null; }
    syncButtons();
  }

  function tick() {
    if (atEnd()) { stopPlay(); return; }
    showStep(cursor + 1);
    if (atEnd()) { stopPlay(); return; }
    timer = setTimeout(tick, speed);
  }

  function play() {
    if (atEnd()) return;
    stopPlay();
    timer = setTimeout(tick, 0);
    syncButtons();
  }

  function enqueue(newSteps) {
    playlist = playlist.concat(newSteps);
    syncButtons();
  }

  /* ---------- input parsing ---------- */

  function parseKeys(raw) {
    var parts = String(raw).split(/[\s,]+/).filter(Boolean);
    if (!parts.length) return { error: "Enter at least one key." };
    var keys = [];
    for (var i = 0; i < parts.length; i++) {
      var n = Number(parts[i]);
      if (!Number.isInteger(n)) return { error: '"' + parts[i] + '" is not a whole number.' };
      keys.push(n);
    }
    if (keys.length > 40) return { error: "Insert at most 40 keys at a time." };
    return { keys: keys };
  }

  /* ---------- actions ---------- */

  function runInserts(keys, label) {
    var batch = [];
    keys.forEach(function (k) {
      steps = [];
      var before = clone(root);
      batch.push({ tree: before, text: "── " + label + " " + k + " ──", cls: "log-step", hl: [] });
      insert(k);
      batch = batch.concat(steps);
    });
    enqueue(batch);
    play();
  }

  insertBtn.addEventListener("click", function () {
    var parsed = parseKeys(keyInput.value);
    if (parsed.error) { logLine("⚠ " + parsed.error, "log-fix"); return; }
    runInserts(parsed.keys, "INSERT");
    keyInput.value = "";
  });

  demoBtn.addEventListener("click", function () {
    hardReset();
    keyInput.value = "41, 38, 31, 12, 19, 8";
    logLine("CLRS demo — inserting 41, 38, 31, 12, 19, 8 into an empty tree.", "log-step");
    runInserts([41, 38, 31, 12, 19, 8], "INSERT");
  });

  resetBtn.addEventListener("click", function () {
    hardReset();
    logLine("Tree cleared.", "log-step");
  });

  stepBtn.addEventListener("click", function () {
    if (timer) { stopPlay(); return; }   // acting as Pause while playing
    if (!atEnd()) showStep(cursor + 1);
  });

  keyInput.addEventListener("keydown", function (e) {
    if (e.key === "Enter" && !insertBtn.disabled) insertBtn.click();
  });

  speedRange.addEventListener("input", function () {
    speed = Number(speedRange.value);
    speedVal.textContent = speed + " ms";
  });

  function hardReset() {
    stopPlay();
    root = NIL;
    steps = [];
    playlist = [];
    cursor = -1;
    clearLog();
    drawTree(null, []);
    syncButtons();
  }

  /* ---------- boot ---------- */

  speed = Number(speedRange.value);
  speedVal.textContent = speed + " ms";
  drawTree(null, []);
  syncButtons();
  logLine("Ready. Enter keys, or press “Run CLRS Demo”.", "log-step");

  /* Exposed for quick console checks: rbt.tree(), rbt.inorder(), rbt.check() */
  window.rbt = {
    tree: function () { return clone(root); },
    inorder: function () { return inorder(clone(root)); },
    check: function () {
      var t = clone(root);
      return {
        rootBlack: !t || t.color === "B",
        noRedRed: noRedRed(t),
        blackHeight: blackHeight(t),
        nodes: countNodes(t),
        height: height(t)
      };
    }
  };
})();