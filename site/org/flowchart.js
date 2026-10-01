/*
 * QnA Markup — interactive flowchart of a parsed QnA.
 *
 *   var flow = QnAFlow.render(container, QnA.parse(markup), options);   // options: the QnA's style settings
 *   flow.fit(); flow.toPng().then(blob => ...); flow.toSvg(); QnAFlow.clearMemory() forgets dragged positions
 *
 * A START pill points at the first question. Nodes are questions (Q tags). Edges are answers: an A tag's text labels the
 * edge from its question to the question nested under it; an X tag is drawn
 * the same way but labelled "Input: <variable name>" (the parent Q's id) in
 * italics. A question whose text ends in GOTO gets a dashed edge to the
 * target; a question that is *only* a GOTO is not drawn at all — the answer
 * leading to it goes straight to the target. Answers with nothing under them
 * end in a small terminal dot. Questions with a DOC tag carry a page marker;
 * questions whose HTML holds named form fields carry a text-box marker
 * (hover it for the field names).
 * Two things a script can do are drawn when their arguments are literals:
 * an answer that calls loadQnA() leads to an "External QnA" box (its
 * find/replace targets get dotted "JS GOTO" edges back from the box), and
 * a goto('name') in an answer's or question's script is a dotted "JS GOTO"
 * edge to that question.
 *
 * Drag nodes to rearrange (the START pill, the terminal dots and the External
 * QnA boxes included); drag the background to pan; wheel to zoom.
 * Lines can be rearranged too: the label in the middle of a line (a small
 * grip dot when the line has no label) is a handle. Drag it and the line is
 * re-routed through wherever it is dropped, to untangle lines that overlap;
 * double-click it to put that line back on its automatic route. A moved
 * handle is stored as an offset from the line's automatic midpoint, so it
 * follows along when the boxes at either end are dragged afterwards.
 * Dragged positions (boxes by question id, lines by answer id) are remembered
 * across re-renders (live preview) until "Reset layout".
 */
(function (root) {
  'use strict';

  var PAD_X = 12, PAD_Y = 10, MAX_LINES = 4, GAP_X = 40, GAP_Y = 90, END_R = 6;
  var SVG_NS = 'http://www.w3.org/2000/svg';

  // Colours and type come from the QnA's own settings (System Text / Body Text)
  function theme(opts) {
    var o = (root.QnA && root.QnA.normalizeOptions) ? root.QnA.normalizeOptions(opts || {}) : (opts || {});
    var fs = Math.max(10, Math.min(20, parseInt(o.fontSize, 10) || 16));
    return {
      font: o.fontFamily || "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, sans-serif",
      fs: fs, lh: Math.round(fs * 1.35), labelFs: Math.max(9, fs - 2),
      bg: '#' + (o.compBg || '5489eb'), txt: '#' + (o.compTxt || 'ffffff'),
      nodeW: Math.max(190, Math.round(fs * 14))
    };
  }
  function css(t) {
    return [
      '.qf-node rect{fill:' + t.bg + ';stroke:' + t.bg + ';stroke-width:1;rx:10;ry:10;}',
      '.qf-node text{fill:' + t.txt + ';font-family:' + t.font + ';font-size:' + t.fs + 'px;pointer-events:none;}',
      '.qf-node .qf-id{fill:' + t.txt + ';fill-opacity:.7;font-size:' + Math.max(8, t.fs - 3) + 'px;}',
      // outlined boxes (START, External QnA) have no fill, so the whole box must be declared a hit area or only the outline could be grabbed
      '.qf-node.qf-startnode rect{fill:none;stroke:' + t.bg + ';stroke-width:2;pointer-events:all;}',
      '.qf-node.qf-startnode text{fill:' + t.bg + ';font-weight:bold;letter-spacing:.08em;}',
      '.qf-node.qf-dragging rect{stroke:#ffb300;stroke-width:2;}',
      '.qf-node.qf-dragging .qf-end{stroke:#ffb300;stroke-width:2;}',
      '.qf-node{cursor:grab;}',
      '.qf-doc{fill:' + t.txt + ';stroke:' + t.bg + ';stroke-width:1;}',
      '.qf-doc-line{stroke:' + t.bg + ';stroke-width:1;}',
      '.qf-field{fill:' + t.txt + ';stroke:' + t.bg + ';stroke-width:1;}',
      '.qf-field-line{stroke:' + t.bg + ';stroke-width:1.5;}',
      '.qf-node.qf-external .qf-field{fill:none;}',
      '.qf-edge{fill:none;stroke:#6b7280;stroke-width:1.5;}',
      '.qf-edge.qf-goto{stroke-dasharray:6 4;}',
      '.qf-edge.qf-jsgoto{stroke-dasharray:1.5 4;stroke-linecap:round;}',
      '.qf-node.qf-external rect{fill:none;stroke:' + t.bg + ';stroke-width:1.5;stroke-dasharray:5 3;pointer-events:all;}',
      '.qf-node.qf-external text{fill:' + t.bg + ';}',
      '.qf-node.qf-external .qf-id{fill:' + t.bg + ';}',
      '.qf-label{font-family:' + t.font + ';font-size:' + t.labelFs + 'px;fill:#1d2330;}',
      '.qf-label.qf-var{font-style:italic;}',
      '.qf-label.qf-goto,.qf-label.qf-jsgoto{font-size:' + Math.max(8, t.labelFs - 1) + 'px;}',
      '.qf-label-bg{fill:#fff;fill-opacity:.9;stroke:none;}',
      '.qf-handle{cursor:grab;}',
      '.qf-handle:hover .qf-label-bg,.qf-handle.qf-moved .qf-label-bg{stroke:#9aa1ab;stroke-width:1;}',
      '.qf-handle.qf-dragging .qf-label-bg,.qf-handle.qf-dragging .qf-grip{stroke:#ffb300;stroke-width:2;}',
      '.qf-grip{fill:#fff;stroke:#6b7280;stroke-width:1.5;}',
      '.qf-grip-hit{fill:transparent;stroke:none;}',
      '.qf-edge.qf-dragging{stroke:#ffb300;}',
      '.qf-end{fill:#9aa1ab;stroke:#6b7280;stroke-width:1;}',
      '.qf-end-hit{fill:transparent;stroke:none;}',   // a finger-sized target around the small end dot
      '.qf-arrow{fill:#6b7280;}'
    ].join('\n');
  }

  function el(name, attrs, parent) {
    var e = root.document.createElementNS(SVG_NS, name);
    for (var k in attrs) if (attrs[k] !== undefined && attrs[k] !== null) e.setAttribute(k, attrs[k]);
    if (parent) parent.appendChild(e);
    return e;
  }
  function stripHtml(s) {
    return String(s).replace(/<(script|style)\b[^>]*>[\s\S]*?<\/\1\s*>/gi, ' ').replace(/<br\s*\/?>/gi, ' ').replace(/<[^>]*>/g, '').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/\s+/g, ' ').trim();
  }
  // rough text measure without a canvas: average glyph widths for Verdana-ish fonts
  function textWidth(s, size) { return s.length * size * 0.58; }
  function wrap(text, maxW, size, maxLines) {
    var words = text.split(' '), lines = [], cur = '';
    for (var i = 0; i < words.length; i++) {
      var t = cur ? cur + ' ' + words[i] : words[i];
      if (textWidth(t, size) <= maxW || !cur) cur = t; else { lines.push(cur); cur = words[i]; }
      if (lines.length === maxLines) break;
    }
    if (lines.length < maxLines && cur) lines.push(cur);
    if (lines.length === maxLines && (words.join(' ').length > lines.join(' ').length)) {
      var last = lines[maxLines - 1];
      while (textWidth(last + '…', size) > maxW && last.length > 1) last = last.slice(0, -1);
      lines[maxLines - 1] = last.replace(/\s+$/, '') + '…';
    }
    return lines.length ? lines : [''];
  }
  function truncate(s, n) { return s.length > n ? s.slice(0, n - 1).replace(/\s+$/, '') + '…' : s; }

  /* ------------------------------------------------------------------ */
  /*  Graph model                                                        */
  /* ------------------------------------------------------------------ */

  function buildGraph(result, t) {
    var byLabel = {}, nodes = [], edges = [], ends = [];
    result.questions.forEach(function (q) { byLabel[q.label] = q; });
    // a question that is only a GOTO is skipped: resolve to its eventual target
    function resolve(label, guard) {
      var q = byLabel[label];
      guard = guard || 0;
      if (!q) return null;
      if (q.goto !== null && /^(\s|&nbsp;|<br\s*\/?>)*$/i.test(q.display) && guard < 100) return resolve(q.goto, guard + 1);
      return q.label;
    }
    var drawn = {};
    result.questions.forEach(function (q) {
      if (q.goto !== null && /^(\s|&nbsp;|<br\s*\/?>)*$/i.test(q.display)) return;   // pure jump, not drawn
      var text = stripHtml(q.display) || '(blank)';
      var lines = wrap(text, t.nodeW - 2 * PAD_X, t.fs, MAX_LINES);
      var node = { id: q.label, name: q.name, lines: lines, doc: q.doc !== null, fields: (q.fields || []).slice(), w: t.nodeW, h: PAD_Y * 2 + t.fs + lines.length * t.lh, children: [], x: 0, y: 0 };
      nodes.push(node); drawn[q.label] = node;
    });
    var externals = [];
    result.answers.forEach(function (a) {
      var from = drawn[a.parent];
      if (!from) return;
      var label = a.isVar ? ((a.inputType === 'number' ? 'Number: ' : 'Input: ') + from.name) : truncate(stripHtml(a.text) || (a.value ? stripHtml(a.value) : '(blank)'), 34);
      if (a.loads) {
        // loadQnA(): the loaded QnA takes over here. Its file name captions the box when the URL is a literal.
        var file = typeof a.loads === 'string' ? a.loads.replace(/[?#][\s\S]*$/, '').replace(/\/+$/, '').split('/').pop() || a.loads : '';
        var ext = { id: 'ext-' + a.label, external: true, name: 'External QnA', lines: [truncate(file || (typeof a.loads === 'string' ? a.loads : ''), 30)], w: t.nodeW, h: PAD_Y * 2 + t.fs + t.lh, children: [], x: 0, y: 0 };
        if (!ext.lines[0]) { ext.lines = ['External QnA']; ext.name = ''; }
        nodes.push(ext); externals.push(ext); from.children.push(ext);
        edges.push({ key: 'a:' + a.label, from: from, to: ext, label: label, isVar: a.isVar, jump: false });
        (a.returns || []).forEach(function (r) {
          var rt = resolve(r);
          if (rt && drawn[rt]) edges.push({ key: 'r:' + a.label + ':' + rt, from: ext, to: drawn[rt], label: 'JS GOTO', jsgoto: true, jump: true });
        });
        return;
      }
      var target = resolve(a.label);
      if (target && drawn[target]) {
        var to = drawn[target];
        edges.push({ key: 'a:' + a.label, from: from, to: to, label: label, isVar: a.isVar, jump: target !== a.label });
        if (target === a.label) from.children.push(to);       // tree edge for layout
      } else {
        var end = { id: 'end-' + a.label, end: true, w: END_R * 2, h: END_R * 2, children: [], x: 0, y: 0 };
        ends.push(end); from.children.push(end);
        edges.push({ key: 'a:' + a.label, from: from, to: end, label: label, isVar: a.isVar, jump: false });
      }
    });
    result.questions.forEach(function (q) {
      var n = drawn[q.label];
      if (n && q.goto !== null) {
        var t = resolve(q.goto);
        if (t && drawn[t]) edges.push({ key: 'g:' + n.id, from: n, to: drawn[t], label: 'GOTO', goto: true, jump: true });
      }
    });
    // goto('name') written as a literal in a script: a dotted edge from the question whose script it is
    // (a question's own <script>, or the script of one of its answers) to the target
    var jsSeen = {};
    var jsEdge = function (fromLabel, target) {
      var n = drawn[fromLabel], to = resolve(target);
      if (!n || !to || !drawn[to] || jsSeen[fromLabel + '>' + to]) return;
      jsSeen[fromLabel + '>' + to] = true;
      edges.push({ key: 'j:' + fromLabel + ':' + to, from: n, to: drawn[to], label: 'JS GOTO', jsgoto: true, jump: true });
    };
    result.questions.forEach(function (q) { (q.jumps || []).forEach(function (j) { jsEdge(q.label, j); }); });
    result.answers.forEach(function (a) { (a.jumps || []).forEach(function (j) { jsEdge(a.parent, j); }); });
    // roots: drawn nodes that are not any tree child
    var isChild = {};
    nodes.concat(ends).forEach(function (n) { n.children.forEach(function (c) { isChild[c.id] = true; }); });
    var roots = nodes.filter(function (n) { return !isChild[n.id]; });
    // a START marker pointing at the first question
    var start = null;
    if (nodes.length) {
      start = { id: '__start', start: true, w: Math.round(t.fs * 5.5), h: Math.round(t.fs * 2), children: [nodes[0]], x: 0, y: 0 };
      var ri = roots.indexOf(nodes[0]);
      if (ri >= 0) roots[ri] = start; else roots.unshift(start);
      edges.unshift({ key: 'start', from: start, to: nodes[0], label: '', start: true, jump: false });
    }
    return { nodes: nodes, ends: ends, edges: edges, roots: roots, start: start };
  }

  /* --- tidy tree layout: subtree widths, parents centred over children --- */
  function layout(g) {
    function width(n) {
      if (n._w !== undefined) return n._w;
      if (!n.children.length) return (n._w = n.w);
      var w = 0;
      n.children.forEach(function (c) { w += width(c); });
      w += GAP_X * (n.children.length - 1);
      return (n._w = Math.max(w, n.w));
    }
    function place(n, left, depth) {
      var w = width(n);
      n.x = left + w / 2;
      n.y = depth * GAP_Y + (n.end ? 0 : 0);
      var cx = left + (w - (n.children.reduce(function (s, c) { return s + width(c); }, 0) + GAP_X * (n.children.length - 1))) / 2;
      n.children.forEach(function (c) { place(c, cx, depth + 1); cx += width(c) + GAP_X; });
    }
    var x = 0;
    g.roots.forEach(function (r) { place(r, x, 0); x += width(r) + GAP_X * 2; });
    // row heights vary (multi-line nodes): push each depth down by the tallest node above it
    var rows = {};
    var all = g.nodes.concat(g.ends).concat(g.start ? [g.start] : []);
    all.forEach(function (n) { var d = Math.round(n.y / GAP_Y); rows[d] = Math.max(rows[d] || 0, n.h); });
    var offset = 0, cum = {};
    Object.keys(rows).map(Number).sort(function (a, b) { return a - b; }).forEach(function (d) { cum[d] = offset; offset += rows[d] + GAP_Y; });
    all.forEach(function (n) { var d = Math.round(n.y / GAP_Y); n.y = cum[d] + (n.end ? (rows[d] - n.h) / 2 : 0); });
  }

  /* ------------------------------------------------------------------ */
  /*  Renderer                                                           */
  /* ------------------------------------------------------------------ */

  // dragged positions, keyed by QnA (its question ids joined): .nodes by question id, .edges by edge key
  // (a line's handle is kept as an offset {dx, dy} from the midpoint of its automatic route)
  var memory = {};
  function memKey(result) { return result.questions.map(function (q) { return q.label; }).join('|'); }

  function render(container, result, opts) {
    var d = root.document, t = theme(opts);
    container.innerHTML = '';
    var g = buildGraph(result, t);
    layout(g);
    var mem = memory[memKey(result)] || (memory[memKey(result)] = { nodes: {}, edges: {} });
    g.nodes.concat(g.ends).concat(g.start ? [g.start] : []).forEach(function (n) { if (mem.nodes[n.id]) { n.x = mem.nodes[n.id].x; n.y = mem.nodes[n.id].y; } });
    g.edges.forEach(function (e) { var o = mem.edges[e.key]; e.off = o ? { dx: o.dx, dy: o.dy } : null; });

    var svg = el('svg', { xmlns: SVG_NS, 'class': 'qf-svg', width: '100%', height: '100%' }, container);
    svg.style.display = 'block'; svg.style.touchAction = 'none'; svg.style.userSelect = 'none';
    var style = el('style', {}, svg); style.textContent = css(t);
    var defs = el('defs', {}, svg);
    var m = el('marker', { id: 'qf-arrow', viewBox: '0 0 10 10', refX: 9, refY: 5, markerWidth: 7, markerHeight: 7, orient: 'auto-start-reverse' }, defs);
    el('path', { d: 'M0,0 L10,5 L0,10 z', 'class': 'qf-arrow' }, m);
    var world = el('g', { 'class': 'qf-world' }, svg);
    var edgeLayer = el('g', {}, world), nodeLayer = el('g', {}, world);

    /* --- edges --- */
    var edgeEls = g.edges.map(function (e) {
      var grp = el('g', {}, edgeLayer);
      var cls = 'qf-edge' + (e.goto ? ' qf-goto' : e.jsgoto ? ' qf-jsgoto' : e.isVar ? ' qf-var' : '');
      var path = el('path', { 'class': cls, 'marker-end': 'url(#qf-arrow)' }, grp);
      // the handle: the label (or, for a line without one, a small grip dot) can be dragged to re-route the line
      var handle = el('g', { 'class': 'qf-handle', 'data-edge': e.key }, grp);
      var tip = el('title', {}, handle); tip.textContent = 'Drag to move this line · double-click to reset it';
      var bg = el('rect', { 'class': 'qf-label-bg', rx: 3, ry: 3 }, handle);
      var txt = el('text', { 'class': 'qf-label' + (e.goto ? ' qf-goto' : e.jsgoto ? ' qf-jsgoto' : e.isVar ? ' qf-var' : ''), 'text-anchor': 'middle' }, handle);
      txt.textContent = e.label;
      var grip = null, hit = null;
      if (!e.label) { hit = el('circle', { 'class': 'qf-grip-hit', r: 11 }, handle); grip = el('circle', { 'class': 'qf-grip', r: 4 }, handle); }
      return { e: e, grp: grp, handle: handle, path: path, bg: bg, txt: txt, grip: grip, hit: hit };
    });
    var r1 = function (v) { return Math.round(v * 10) / 10; };
    // where a line through point p should meet node n: the middle of the side facing p, and that side's outward normal
    function port(n, p) {
      // (the side p lies furthest beyond, so a handle beside a wide, short box leaves from its side, not its top)
      var cx = n.x, cy = n.y + n.h / 2, dx = p.x - cx, dy = p.y - cy;
      if (Math.abs(dx) - n.w / 2 > Math.abs(dy) - n.h / 2) { var sx = dx < 0 ? -1 : 1; return { x: cx + sx * n.w / 2, y: cy, nx: sx, ny: 0 }; }
      var sy = dy < 0 ? -1 : 1; return { x: cx, y: cy + sy * n.h / 2, nx: 0, ny: sy };
    }
    function routeEdges() {
      edgeEls.forEach(function (o) {
        var e = o.e, a = e.from, b = e.to;
        var x1 = a.x, y1 = a.y + a.h, x2 = b.x, y2 = b.y;
        var down = y2 >= y1;
        var dpath;
        if (down) {
          var c = Math.max(30, (y2 - y1) / 2);
          dpath = 'M' + x1 + ',' + y1 + ' C' + x1 + ',' + (y1 + c) + ' ' + x2 + ',' + (y2 - c) + ' ' + x2 + ',' + y2;
        } else {
          // back/jump edge: leave from the side and come around. When the target
          // sits in the same column, loop out and back on the same side so the
          // curve never crosses the nodes in between.
          var sameCol = Math.abs(x2 - x1) < (a.w + b.w) / 2;
          var side = sameCol ? 1 : (x2 >= x1 ? 1 : -1);
          var sx = a.x + side * a.w / 2, sy = a.y + a.h / 2;
          var tx = sameCol ? b.x + side * b.w / 2 : b.x - side * b.w / 2, ty = b.y + b.h / 2;
          var bow = (sameCol ? 110 : 60) + Math.abs(y1 - y2) * 0.15;
          dpath = 'M' + sx + ',' + sy + ' C' + (sx + side * bow) + ',' + sy + ' ' + (tx + (sameCol ? side : -side) * bow) + ',' + ty + ' ' + tx + ',' + ty;
        }
        o.path.setAttribute('d', dpath);
        var len = o.path.getTotalLength ? o.path.getTotalLength() : 0;
        var mid = len ? o.path.getPointAtLength(len / 2) : { x: (x1 + x2) / 2, y: (y1 + y2) / 2 };
        e.auto = { x: mid.x, y: mid.y };          // midpoint of the automatic route; a dragged handle is relative to it
        if (e.off) {
          // Re-route through the handle: two curves that leave one box and arrive at the other at right
          // angles, and pass through the handle heading from one end towards the other.
          mid = { x: mid.x + e.off.dx, y: mid.y + e.off.dy };
          // Each end attaches to whichever side of its box faces the handle.
          var pa = port(a, mid), pb = port(b, mid);
          var p1 = { x: pa.x, y: pa.y }, p2 = { x: pb.x, y: pb.y }, t1 = { x: pa.nx, y: pa.ny }, t2 = { x: -pb.nx, y: -pb.ny };   // t: direction of travel
          var vx = p2.x - p1.x, vy = p2.y - p1.y, vl = Math.sqrt(vx * vx + vy * vy) || 1;
          var d1 = Math.sqrt(Math.pow(mid.x - p1.x, 2) + Math.pow(mid.y - p1.y, 2)), d2 = Math.sqrt(Math.pow(p2.x - mid.x, 2) + Math.pow(p2.y - mid.y, 2));
          var k1 = d1 / 3, k2 = d2 / 3, c1 = Math.max(24, d1 / 2.5), c2 = Math.max(24, d2 / 2.5);
          vx /= vl; vy /= vl;
          dpath = 'M' + r1(p1.x) + ',' + r1(p1.y) +
            ' C' + r1(p1.x + t1.x * c1) + ',' + r1(p1.y + t1.y * c1) + ' ' + r1(mid.x - vx * k1) + ',' + r1(mid.y - vy * k1) + ' ' + r1(mid.x) + ',' + r1(mid.y) +
            ' C' + r1(mid.x + vx * k2) + ',' + r1(mid.y + vy * k2) + ' ' + r1(p2.x - t2.x * c2) + ',' + r1(p2.y - t2.y * c2) + ' ' + r1(p2.x) + ',' + r1(p2.y);
          o.path.setAttribute('d', dpath);
        }
        e.mid = mid;
        o.handle.classList[e.off ? 'add' : 'remove']('qf-moved');
        if (o.grip) { o.grip.setAttribute('cx', mid.x); o.grip.setAttribute('cy', mid.y); o.hit.setAttribute('cx', mid.x); o.hit.setAttribute('cy', mid.y); }
        o.txt.setAttribute('x', mid.x); o.txt.setAttribute('y', mid.y + 4);
        var w = e.label ? textWidth(e.label, t.labelFs) + 8 : 0, h = e.label ? t.labelFs + 6 : 0;
        o.bg.setAttribute('x', mid.x - w / 2); o.bg.setAttribute('y', mid.y - h / 2); o.bg.setAttribute('width', w); o.bg.setAttribute('height', h);
      });
    }

    /* --- nodes --- */
    var nodeEls = [];
    if (g.start) {
      var sg = el('g', { 'class': 'qf-node qf-startnode', 'data-id': '__start' }, nodeLayer);
      el('rect', { width: g.start.w, height: g.start.h, rx: g.start.h / 2, ry: g.start.h / 2 }, sg);
      var st = el('text', { x: g.start.w / 2, y: g.start.h / 2 + t.fs * 0.35, 'text-anchor': 'middle' }, sg); st.textContent = 'START';
      nodeEls.push({ n: g.start, grp: sg });
    }
    g.nodes.forEach(function (n) {
      var grp = el('g', { 'class': 'qf-node' + (n.external ? ' qf-external' : ''), 'data-id': n.id }, nodeLayer);
      el('rect', { width: n.w, height: n.h }, grp);
      var id = el('text', { 'class': 'qf-id', x: PAD_X, y: PAD_Y + t.fs * 0.7 }, grp); id.textContent = n.name;
      var tx = el('text', { x: PAD_X, y: PAD_Y + t.fs + t.lh - 4 }, grp);
      n.lines.forEach(function (line, i) { var ts = el('tspan', { x: PAD_X, dy: i ? t.lh : 0 }, tx); ts.textContent = line; });
      if (n.doc) {
        var dx = n.w - 20, dy = 6;
        el('path', { 'class': 'qf-doc', d: 'M' + dx + ',' + dy + ' h9 l4,4 v10 h-13 z' }, grp);
        el('path', { 'class': 'qf-doc-line', d: 'M' + (dx + 3) + ',' + (dy + 8) + ' h7 M' + (dx + 3) + ',' + (dy + 11) + ' h7' }, grp);
      }
      if (n.fields && n.fields.length) {
        // a form-field marker (a small text box with a cursor) beside the page marker; the tooltip names the fields
        var fx = n.w - (n.doc ? 40 : 22), fy = 8;
        var fg = el('g', { 'class': 'qf-fields' }, grp);
        var ft = el('title', {}, fg); ft.textContent = 'Form field' + (n.fields.length > 1 ? 's' : '') + ': ' + n.fields.join(', ');
        el('rect', { 'class': 'qf-field', x: fx, y: fy, width: 16, height: 10, rx: 1.5, ry: 1.5 }, fg);
        el('path', { 'class': 'qf-field-line', d: 'M' + (fx + 3) + ',' + (fy + 2.5) + ' v5' }, fg);
      }
      nodeEls.push({ n: n, grp: grp });
    });
    g.ends.forEach(function (n) {
      var grp = el('g', { 'class': 'qf-node qf-endnode', 'data-id': n.id }, nodeLayer);
      el('circle', { 'class': 'qf-end-hit', cx: END_R, cy: END_R, r: END_R + 6 }, grp);
      el('circle', { 'class': 'qf-end', cx: END_R, cy: END_R, r: END_R }, grp);
      nodeEls.push({ n: n, grp: grp });
    });
    function placeNodes() {
      nodeEls.forEach(function (o) { o.grp.setAttribute('transform', 'translate(' + (o.n.x - o.n.w / 2) + ',' + o.n.y + ')'); });
      routeEdges();
    }
    placeNodes();

    /* --- pan / zoom --- */
    var view = { x: 0, y: 0, k: 1 };
    function applyView() { world.setAttribute('transform', 'translate(' + view.x + ',' + view.y + ') scale(' + view.k + ')'); }
    function bounds() {
      var all = g.nodes.concat(g.ends).concat(g.start ? [g.start] : []);
      if (!all.length) return { x: 0, y: 0, w: 100, h: 100 };
      var minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
      all.forEach(function (n) { minX = Math.min(minX, n.x - n.w / 2); maxX = Math.max(maxX, n.x + n.w / 2); minY = Math.min(minY, n.y); maxY = Math.max(maxY, n.y + n.h); });
      // jump edges bow out sideways
      var bow = g.edges.some(function (e) { return e.jump || e.goto || e.jsgoto; }) ? 130 : 0;
      minX -= bow; maxX += bow;
      // lines that were re-routed by hand can reach outside the boxes
      g.edges.forEach(function (e) {
        if (!e.off || !e.mid) return;
        var hw = (e.label ? textWidth(e.label, t.labelFs) + 8 : 12) / 2 + 6, hh = t.labelFs / 2 + 9;
        minX = Math.min(minX, e.mid.x - hw); maxX = Math.max(maxX, e.mid.x + hw); minY = Math.min(minY, e.mid.y - hh); maxY = Math.max(maxY, e.mid.y + hh);
      });
      return { x: minX, y: minY, w: maxX - minX, h: maxY - minY };
    }
    function fit() {
      var b = bounds(), cw = container.clientWidth || 600, ch = container.clientHeight || 400, m = 24;
      var k = Math.min((cw - 2 * m) / b.w, (ch - 2 * m) / b.h, 1.5);
      if (!isFinite(k) || k <= 0) k = 1;
      view.k = k; view.x = (cw - b.w * k) / 2 - b.x * k; view.y = m - b.y * k;
      applyView();
    }
    function zoomBy(f) {
      var cw = container.clientWidth || 600, ch = container.clientHeight || 400, mx = cw / 2, my = ch / 2;
      var k2 = Math.max(0.15, Math.min(4, view.k * f));
      view.x = mx - (mx - view.x) * (k2 / view.k); view.y = my - (my - view.y) * (k2 / view.k); view.k = k2;
      applyView();
    }
    function toWorld(cx, cy) { var r = svg.getBoundingClientRect(); return { x: (cx - r.left - view.x) / view.k, y: (cy - r.top - view.y) / view.k }; }

    var drag = null, lastTap = null;
    svg.addEventListener('pointerdown', function (ev) {
      var t = ev.target.closest ? ev.target.closest('.qf-node') : null;
      var hd = !t && ev.target.closest ? ev.target.closest('.qf-handle') : null;
      var p = toWorld(ev.clientX, ev.clientY);
      if (hd) {
        var eo = edgeEls.filter(function (x) { return x.handle === hd; })[0];
        drag = { edge: eo, ox: p.x - eo.e.mid.x, oy: p.y - eo.e.mid.y, cx: ev.clientX, cy: ev.clientY, moved: false };
        hd.classList.add('qf-dragging'); eo.path.classList.add('qf-dragging'); edgeLayer.appendChild(eo.grp);
      } else if (t) {
        var o = nodeEls.filter(function (x) { return x.grp === t; })[0];
        drag = { node: o.n, grp: t, ox: p.x - o.n.x, oy: p.y - o.n.y, moved: false };
        t.classList.add('qf-dragging'); nodeLayer.appendChild(t);
      } else {
        drag = { pan: true, sx: ev.clientX - view.x, sy: ev.clientY - view.y };
        svg.style.cursor = 'grabbing';
      }
      svg.setPointerCapture(ev.pointerId); ev.preventDefault();
    });
    svg.addEventListener('pointermove', function (ev) {
      if (!drag) return;
      if (drag.pan) { view.x = ev.clientX - drag.sx; view.y = ev.clientY - drag.sy; applyView(); return; }
      var p = toWorld(ev.clientX, ev.clientY);
      if (drag.edge) {
        var de = drag.edge.e;
        if (!drag.moved && Math.abs(ev.clientX - drag.cx) + Math.abs(ev.clientY - drag.cy) < 3) return;   // a click, not a drag
        de.off = { dx: p.x - drag.ox - de.auto.x, dy: p.y - drag.oy - de.auto.y }; drag.moved = true;
        routeEdges(); return;
      }
      drag.node.x = p.x - drag.ox; drag.node.y = p.y - drag.oy; drag.moved = true;
      placeNodes();
    });
    function endDrag() {
      if (!drag) return;
      if (drag.node) { drag.grp.classList.remove('qf-dragging'); if (drag.moved) mem.nodes[drag.node.id] = { x: drag.node.x, y: drag.node.y }; }
      if (drag.edge) {
        drag.edge.handle.classList.remove('qf-dragging'); drag.edge.path.classList.remove('qf-dragging');
        if (drag.moved) mem.edges[drag.edge.e.key] = { dx: drag.edge.e.off.dx, dy: drag.edge.e.off.dy };
        else {
          // Double-click (two presses without a drag): back to the automatic route. Counted here because
          // the pointer is captured by the svg while it is down, so dblclick events never name the handle.
          var now = Date.now(), key = drag.edge.e.key;
          if (lastTap && lastTap.key === key && now - lastTap.t < 500) {
            drag.edge.e.off = null; delete mem.edges[key]; lastTap = null; routeEdges();
          } else lastTap = { key: key, t: now };
        }
      }
      svg.style.cursor = ''; drag = null;
    }
    svg.addEventListener('pointerup', endDrag); svg.addEventListener('pointercancel', endDrag);
    svg.addEventListener('wheel', function (ev) {
      ev.preventDefault();
      var f = Math.exp(-ev.deltaY * 0.0015), r = svg.getBoundingClientRect();
      var mx = ev.clientX - r.left, my = ev.clientY - r.top;
      var k2 = Math.max(0.15, Math.min(4, view.k * f));
      view.x = mx - (mx - view.x) * (k2 / view.k); view.y = my - (my - view.y) * (k2 / view.k); view.k = k2;
      applyView();
    }, { passive: false });

    fit();

    /* --- export (transparent background) --- */
    function exportSvg() {
      var b = bounds(), m = 20;
      var w = Math.ceil(b.w + 2 * m), h = Math.ceil(b.h + 2 * m);
      var clone = svg.cloneNode(true);
      clone.setAttribute('width', w); clone.setAttribute('height', h);
      clone.setAttribute('viewBox', (b.x - m) + ' ' + (b.y - m) + ' ' + w + ' ' + h);
      clone.removeAttribute('style'); clone.removeAttribute('class');
      clone.querySelector('.qf-world').removeAttribute('transform');
      Array.prototype.forEach.call(clone.querySelectorAll('.qf-dragging'), function (n) { n.classList.remove('qf-dragging'); });
      // editing affordances stay out of the picture: grip dots, tooltips, the outline on moved labels
      Array.prototype.forEach.call(clone.querySelectorAll('.qf-grip, .qf-grip-hit, .qf-end-hit, .qf-handle title, .qf-fields title'), function (n) { n.parentNode.removeChild(n); });
      Array.prototype.forEach.call(clone.querySelectorAll('.qf-moved'), function (n) { n.classList.remove('qf-moved'); });
      return { xml: '<?xml version="1.0" encoding="UTF-8"?>\n' + new XMLSerializer().serializeToString(clone), w: w, h: h };
    }
    function toSvg() { return exportSvg().xml; }
    function toPng(scale) {
      scale = scale || 2;
      var ex = exportSvg(), w = ex.w, h = ex.h;
      var url = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(ex.xml);
      return new Promise(function (resolve, reject) {
        var img = new Image();
        img.onload = function () {
          var c = d.createElement('canvas'); c.width = w * scale; c.height = h * scale;
          var ctx = c.getContext('2d'); ctx.scale(scale, scale); ctx.drawImage(img, 0, 0);
          if (c.toBlob) c.toBlob(function (blob) { blob ? resolve(blob) : reject(new Error('PNG encode failed')); }, 'image/png');
          else { try { resolve(c.toDataURL('image/png')); } catch (e) { reject(e); } }
        };
        img.onerror = function () { reject(new Error('Could not rasterize the flowchart')); };
        img.src = url;
      });
    }

    return {
      svg: svg, graph: g, fit: fit, toPng: toPng, toSvg: toSvg, zoomIn: function () { zoomBy(1.25); }, zoomOut: function () { zoomBy(0.8); },
      positions: function () { return g.nodes.map(function (n) { return { id: n.id, x: n.x, y: n.y }; }); },
      // lines moved by hand: [{ key, dx, dy }], the handle's offset from the midpoint of the automatic route
      edgeOffsets: function () { return g.edges.filter(function (e) { return e.off; }).map(function (e) { return { key: e.key, dx: e.off.dx, dy: e.off.dy }; }); }
    };
  }

  root.QnAFlow = { render: render, clearMemory: function () { memory = {}; } };
})(typeof window !== 'undefined' ? window : this);
