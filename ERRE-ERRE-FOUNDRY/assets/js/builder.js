/* ERRE ERRE FOUNDRY · BUILDER
   Tipografía modular tipo Meccano. Basado en la primera prueba en p5.js
   (mismas piezas, imantación por agujeros, trazo → piezas) pero reconstruido
   con HTML + Canvas para encajar en la retícula de la web.
   Unidades del lienzo: pt del catálogo de piezas (módulo M = 10,186; paso = 3 M). */
(function () {
  RR.noLayoutReset = true;
  RR.header({ active: 'builder', state: 0 });

  // ───────────────────────── medidas ─────────────────────────
  const MOD = 10.186, PITCH = 3 * MOD, HALFP = PITCH / 2;
  const INK = '#231f20', SEL = '#8a8889', DOT = '#c4c3c3';   // selección y trazo en gris
  const BASE_Y = 1.5 * MOD;                  // línea base invisible: borde inferior de una pieza con agujeros en la fila 0
  const UNITS = 700 / (15 * MOD);           // 5 agujeros de alto (15 M) = 700 unidades de fuente
  const SB = 1.5 * MOD;                      // espacio lateral de cada glifo

  // ───────────────────────── matrices (giros 90° y espejos) ─────────────────────────
  const ID = [1, 0, 0, 1], ROT_R = [0, 1, -1, 0], ROT_L = [0, -1, 1, 0], FLIP_H = [-1, 0, 0, 1], FLIP_V = [1, 0, 0, -1];
  const mul = (A, B) => [A[0] * B[0] + A[2] * B[1], A[1] * B[0] + A[3] * B[1], A[0] * B[2] + A[2] * B[3], A[1] * B[2] + A[3] * B[3]];
  const app = (m, x, y) => [m[0] * x + m[2] * y, m[1] * x + m[3] * y];
  const ORIENTS = []; { let r = ID; for (let i = 0; i < 4; i++) { ORIENTS.push(r, mul(r, FLIP_H)); r = mul(ROT_R, r); } }

  // ───────────────────────── piezas ─────────────────────────
  const DEF = {};
  const isQ = (v) => Math.abs(Math.round(v / HALFP) * HALFP - v) < 0.35;
  const qv = (v) => Math.round(v / HALFP) * HALFP;
  for (const p of PIECES) {
    const path = new Path2D();
    for (const sub of p.segs) for (const s of sub) {
      if (s[0] === 'M') path.moveTo(s[1], s[2]);
      else if (s[0] === 'L') path.lineTo(s[1], s[2]);
      else if (s[0] === 'C') path.bezierCurveTo(s[1], s[2], s[3], s[4], s[5], s[6]);
      else path.closePath();
    }
    // agujeros que caen en los puntos de la retícula (paso 3 M): el grupo más grande
    // que está a distancias exactas de la retícula. Esos son los que se imantan a los puntos.
    const onP = (v) => Math.abs(Math.round(v / PITCH) * PITCH - v) < 0.6, qp = (v) => Math.round(v / PITCH) * PITCH;
    let ref = 0, bestN = -1;
    p.holes.forEach((o, i) => { const n = p.holes.filter(h => onP(h[0] - o[0]) && onP(h[1] - o[1])).length; if (n > bestN) { bestN = n; ref = i; } });
    const o = p.holes[ref];
    const holes = p.holes.map(h => { const ok = onP(h[0] - o[0]) && onP(h[1] - o[1]); return { x: ok ? o[0] + qp(h[0] - o[0]) : h[0], y: ok ? o[1] + qp(h[1] - o[1]) : h[1], grid: ok }; });
    let ea = 0, eb = 0, dm = -1;
    for (let i = 0; i < holes.length; i++) for (let j = 0; j < holes.length; j++) { const d = Math.hypot(holes[i].x - holes[j].x, holes[i].y - holes[j].y); if (d > dm) { dm = d; ea = i; eb = j; } }
    DEF[p.id] = { ...p, path, holesQ: holes, ends: [ea, eb] };
  }
  // 6 tipos (como en PIEZAS_POR_TIPOS): pieza que los representa y ancho de la ficha
  const CATS = [
    { k: 'A', rep: '01', w: 1, name: 'Washers & strips' },
    { k: 'F', rep: '17', w: 1, name: 'Angles' },
    { k: 'C', rep: '08', w: 1, name: 'Discs' },
    { k: 'B', rep: '10', w: 1, name: 'Plates' },
    { k: 'D', rep: '11', w: 2, name: 'Arcs' },
    { k: 'E', rep: '19', w: 2, name: 'Diagonals' },
  ];

  // ───────────────────────── juegos de caracteres ─────────────────────────
  const SLOTS = Array.from({ length: 12 }, (_, i) => String.fromCharCode(0xE000 + i));   // huecos libres (uso privado)
  const SETS = {
    ABC: 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split(''),
    abc: 'abcdefghijklmnopqrstuvwxyz'.split(''),
    '123': '0123456789'.split(''),
    '@!?': ['Ñ', 'ñ', '.', ',', ':', ';', '!', '¡', '?', '¿', '@', '#', '&', '%', '(', ')', '-', '+', '=', '*', '/', "'", '"', '$', '€', ...SLOTS],
  };
  const ORDER = ['ABC', 'abc', '123', '@!?'];   // (Object.keys pondría '123' primero)
  const label = (ch) => SLOTS.includes(ch) ? 'S' + (SLOTS.indexOf(ch) + 1) : ch;

  // ───────────────────────── estado ─────────────────────────
  const STORE = 'rr-builder-v2';
  let glyphs = {}, current = 'A', set = 'ABC', mode = 'draw', cat = 'A';
  let selection = new Set(), undoStack = [], redoStack = [], clipboard = null, uid = 1;
  let view = { s: 1, ox: 0, oy: 0 }, drag = null, spaceDown = false, hover = null;
  const glyph = () => (glyphs[current] || (glyphs[current] = []));
  const newPiece = (t, x, y, m = ID) => ({ u: uid++, t, x, y, m: m.slice() });

  // ───────────────────────── geometría ─────────────────────────
  const hitCtx = document.createElement('canvas').getContext('2d');
  function holesOf(p, gridOnly) {
    const out = [];
    for (const h of DEF[p.t].holesQ) { if (gridOnly && !h.grid) continue; const w = app(p.m, h.x, h.y); out.push([p.x + w[0], p.y + w[1]]); }
    return out;
  }
  function bboxOf(p) {
    const b = DEF[p.t].bbox, c = [app(p.m, b[0], b[1]), app(p.m, b[2], b[1]), app(p.m, b[0], b[3]), app(p.m, b[2], b[3])];
    const xs = c.map(v => v[0] + p.x), ys = c.map(v => v[1] + p.y);
    return [Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)];
  }
  function bboxAll(list) {
    let bb = null;
    for (const p of list) { const b = bboxOf(p); bb = bb ? [Math.min(bb[0], b[0]), Math.min(bb[1], b[1]), Math.max(bb[2], b[2]), Math.max(bb[3], b[3])] : b; }
    return bb;
  }
  function hit(p, x, y) {
    const dx = x - p.x, dy = y - p.y, m = p.m;
    return hitCtx.isPointInPath(DEF[p.t].path, m[0] * dx + m[1] * dy, m[2] * dx + m[3] * dy, 'nonzero');
  }
  const topHit = (x, y) => { const g = glyph(); for (let i = g.length - 1; i >= 0; i--) if (hit(g[i], x, y)) return g[i]; return null; };
  // imantación: los agujeros caen SIEMPRE sobre los puntos de la retícula (nunca fuera de ella).
  // Se toma el primer agujero de retícula de la primera pieza; como todas están en la retícula,
  // al moverlas juntas siguen todas encajadas.
  function snap(moving, statics, radius) {
    for (const p of moving) {
      const h = holesOf(p, true)[0]; if (!h) continue;
      const gx = Math.round(h[0] / PITCH) * PITCH, gy = Math.round(h[1] / PITCH) * PITCH;
      return Math.hypot(gx - h[0], gy - h[1]) > radius ? [0, 0] : [gx - h[0], gy - h[1]];
    }
    return [0, 0];
  }
  // encaja cada pieza por separado (al cargar, al dibujar con el lápiz)
  const snapEach = (list) => { for (const p of list) { const s = snap([p], [], Infinity); p.x += s[0]; p.y += s[1]; } };
  const others = (moving) => glyph().filter(p => !moving.includes(p));
  const selected = () => glyph().filter(p => selection.has(p.u));

  // ───────────────────────── historial ─────────────────────────
  const snapshot = () => JSON.stringify({ glyphs });
  function commit(before) { undoStack.push(before || snapshot()); if (undoStack.length > 400) undoStack.shift(); redoStack = []; changed(); }
  function restore(s) { glyphs = JSON.parse(s).glyphs; for (const k in glyphs) snapEach(glyphs[k]); fixUids(); selection.clear(); changed(); }
  function undo() { if (!undoStack.length) return RR.toast('Nothing to undo'); redoStack.push(snapshot()); restore(undoStack.pop()); }
  function redo() { if (!redoStack.length) return RR.toast('Nothing to redo'); undoStack.push(snapshot()); restore(redoStack.pop()); }
  function fixUids() { let mx = 0; for (const k in glyphs) for (const p of glyphs[k]) mx = Math.max(mx, p.u || 0); uid = mx + 1; for (const k in glyphs) for (const p of glyphs[k]) if (!p.u) p.u = uid++; }
  let saveT;
  function changed() { render(); renderPicker(); clearTimeout(saveT); saveT = setTimeout(saveLocal, 400); }

  // ───────────────────────── lienzo ─────────────────────────
  const ws = document.getElementById('ws'), cv = document.getElementById('cv'), ctx = cv.getContext('2d');
  let W = 0, H = 0, dpr = 1;
  function resize() {
    const r = ws.getBoundingClientRect();
    const first = !W;
    W = r.width; H = r.height; dpr = Math.min(2, window.devicePixelRatio || 1);
    cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr);
    if (first) fit(); else render();
  }
  // encuadre inicial: altura de mayúscula centrada en el lienzo
  function fit(list) {
    const bb = list && list.length ? bboxAll(list) : [-PITCH * 2, -4 * PITCH - BASE_Y, 2 * PITCH, BASE_Y];
    const s = Math.max(0.4, Math.min(3, Math.min((W * 0.5) / (bb[2] - bb[0] + PITCH * 4), (H * 0.62) / (bb[3] - bb[1] + PITCH * 4))));
    view.s = list && list.length ? s : Math.min(2.2, Math.max(1, H / 330));
    view.ox = W / 2 - ((bb[0] + bb[2]) / 2) * view.s;
    view.oy = H * 0.46 - ((bb[1] + bb[3]) / 2) * view.s;
    render();
  }
  const toWorld = (sx, sy) => [(sx - view.ox) / view.s, (sy - view.oy) / view.s];
  const evPos = (e) => { const r = cv.getBoundingClientRect(); return [e.clientX - r.left, e.clientY - r.top]; };

  function paint(c, p, fill, stroke) {
    c.save(); c.translate(p.x, p.y); c.transform(p.m[0], p.m[1], p.m[2], p.m[3], 0, 0);
    c.fillStyle = fill; c.fill(DEF[p.t].path, 'evenodd');
    if (stroke) { c.strokeStyle = stroke; c.lineWidth = 1 / view.s; c.stroke(DEF[p.t].path); }
    c.restore();
  }
  let raf = 0;
  function render() { if (!raf) raf = requestAnimationFrame(draw); }
  function draw() {
    raf = 0;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, W, H);
    // retícula de puntos (paso 3 M)
    const step = PITCH * view.s;
    if (step > 5) {
      ctx.fillStyle = DOT;
      const r = Math.max(0.8, Math.min(1.6, step / 22));
      const x0 = ((view.ox % step) + step) % step, y0 = ((view.oy % step) + step) % step;
      ctx.beginPath();
      for (let y = y0; y < H; y += step) for (let x = x0; x < W; x += step) { ctx.moveTo(x + r, y); ctx.arc(x, y, r, 0, Math.PI * 2); }
      ctx.fill();
    }
    ctx.setTransform(dpr * view.s, 0, 0, dpr * view.s, dpr * view.ox, dpr * view.oy);
    for (const p of glyph()) paint(ctx, p, selection.has(p.u) ? SEL : INK);
    if (hover && !drag && mode === 'hand' && !selection.has(hover.u)) paint(ctx, hover, '#4a4647');
    // marco de selección
    if (selection.size && !(drag && drag.kind === 'marquee')) {
      const bb = bboxAll(selected());
      if (bb) { ctx.setLineDash([4 / view.s, 3 / view.s]); ctx.strokeStyle = SEL; ctx.lineWidth = 1 / view.s; const pad = 5 / view.s; ctx.strokeRect(bb[0] - pad, bb[1] - pad, bb[2] - bb[0] + pad * 2, bb[3] - bb[1] + pad * 2); ctx.setLineDash([]); }
    }
    if (drag && drag.kind === 'marquee') {
      ctx.fillStyle = 'rgba(35,31,32,.06)'; ctx.strokeStyle = SEL; ctx.lineWidth = 1 / view.s;
      const x = Math.min(drag.x0, drag.x1), y = Math.min(drag.y0, drag.y1), w = Math.abs(drag.x1 - drag.x0), h = Math.abs(drag.y1 - drag.y0);
      ctx.fillRect(x, y, w, h); ctx.strokeRect(x, y, w, h);
    }
    if (drag && drag.kind === 'draw' && drag.pts.length) {
      for (const p of strokeToPieces(drag.pts)) paint(ctx, p, 'rgba(35,31,32,.22)');
      ctx.strokeStyle = SEL; ctx.lineWidth = 2 / view.s; ctx.lineJoin = ctx.lineCap = 'round';
      ctx.beginPath(); drag.pts.forEach((p, i) => i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1])); ctx.stroke();
    }
    if (drag && drag.kind === 'new' && drag.ghost) paint(ctx, drag.ghost, drag.overPanel ? 'rgba(35,31,32,.25)' : 'rgba(35,31,32,.6)', SEL);
  }

  // ───────────────────────── interacción en el lienzo ─────────────────────────
  const overPanel = (e) => !!(e.target.closest && e.target.closest('.panel'));
  cv.addEventListener('pointerdown', (e) => {
    if (e.button === 2) return;
    cv.setPointerCapture(e.pointerId);
    closeMenus();
    const [sx, sy] = evPos(e), [x, y] = toWorld(sx, sy);
    if (spaceDown || e.button === 1) { drag = { kind: 'pan', sx, sy, ox: view.ox, oy: view.oy }; ws.classList.add('panning'); return; }
    if (mode === 'draw' && !e.altKey) { drag = { kind: 'draw', pts: [[x, y]] }; return; }
    const h = topHit(x, y);
    if (h) {
      if (e.shiftKey) { if (selection.has(h.u)) { selection.delete(h.u); render(); return; } selection.add(h.u); }
      else if (!selection.has(h.u)) { selection.clear(); selection.add(h.u); }
      const before = snapshot();
      let moving = selected();
      if (e.altKey) {                    // Alt + arrastrar = duplicar
        const copies = moving.map(p => newPiece(p.t, p.x, p.y, p.m));
        glyph().push(...copies); selection = new Set(copies.map(p => p.u)); moving = copies;
      }
      drag = { kind: 'move', before, sx, sy, starts: moving.map(p => [p, p.x, p.y]), axis: null };
    } else {
      if (!e.shiftKey) selection.clear();
      drag = { kind: 'marquee', x0: x, y0: y, x1: x, y1: y };
    }
    render();
  });
  cv.addEventListener('pointermove', (e) => {
    const [sx, sy] = evPos(e), [x, y] = toWorld(sx, sy);
    if (!drag) {
      const h = mode === 'hand' ? topHit(x, y) : null;
      if (h !== hover) { hover = h; render(); }
      cv.style.cursor = spaceDown ? 'grab' : mode === 'draw' ? 'crosshair' : h ? 'move' : 'default';
      return;
    }
    if (drag.kind === 'pan') { view.ox = drag.ox + sx - drag.sx; view.oy = drag.oy + sy - drag.sy; render(); return; }
    if (drag.kind === 'draw') { const l = drag.pts[drag.pts.length - 1]; if (Math.hypot(x - l[0], y - l[1]) > 1.5 / view.s) drag.pts.push([x, y]); render(); return; }
    if (drag.kind === 'marquee') { drag.x1 = x; drag.y1 = y; render(); return; }
    if (drag.kind === 'move') {
      let dx = (sx - drag.sx) / view.s, dy = (sy - drag.sy) / view.s;
      if (e.shiftKey) { if (!drag.axis && Math.hypot(dx, dy) > 4) drag.axis = Math.abs(dx) > Math.abs(dy) ? 'x' : 'y'; if (drag.axis === 'x') dy = 0; if (drag.axis === 'y') dx = 0; }
      for (const [p, px, py] of drag.starts) { p.x = px + dx; p.y = py + dy; }
      const mv = drag.starts.map(s => s[0]), s = snap(mv, others(mv), 12 / view.s);
      for (const p of mv) { p.x += s[0]; p.y += s[1]; }
      render();
    }
  });
  cv.addEventListener('pointerup', (e) => {
    const d = drag; drag = null; ws.classList.remove('panning');
    if (!d) return;
    if (d.kind === 'draw') {
      const made = strokeToPieces(d.pts); snapEach(made);
      if (made.length) { const b = snapshot(); for (const p of made) { p.u = uid++; glyph().push(p); } commit(b); }
    } else if (d.kind === 'move') {
      const mv = d.starts.map(s => s[0]);
      const r = document.getElementById('panel').getBoundingClientRect();
      if (e.clientX > r.left && e.clientX < r.right && e.clientY > r.top && e.clientY < r.bottom) {
        glyphs[current] = others(mv); selection.clear(); commit(d.before); RR.toast(mv.length > 1 ? mv.length + ' pieces deleted' : 'Piece deleted');
      } else {
        const s = snap(mv, others(mv), Infinity);
        for (const p of mv) { p.x += s[0]; p.y += s[1]; }
        glyphs[current] = others(mv).concat(mv);
        if (snapshot() !== d.before) commit(d.before);
      }
    } else if (d.kind === 'marquee') {
      const ax = Math.min(d.x0, d.x1), bx = Math.max(d.x0, d.x1), ay = Math.min(d.y0, d.y1), by = Math.max(d.y0, d.y1);
      if (bx - ax > 2 || by - ay > 2) {
        const inside = (x, y) => x >= ax && x <= bx && y >= ay && y <= by;
        for (const p of glyph()) { const b = bboxOf(p); if (inside((b[0] + b[2]) / 2, (b[1] + b[3]) / 2) || holesOf(p).some(h => inside(h[0], h[1]))) selection.add(p.u); }
      }
    }
    render();
  });
  // rueda: desplaza · Ctrl/Cmd + rueda (o pellizco): zoom
  cv.addEventListener('wheel', (e) => {
    e.preventDefault();
    const [sx, sy] = evPos(e);
    if (e.ctrlKey || e.metaKey) zoomAt(sx, sy, Math.exp(-e.deltaY * 0.0045));
    else { view.ox -= e.deltaX; view.oy -= e.deltaY; render(); }
  }, { passive: false });
  function zoomAt(sx, sy, k) {
    const ns = Math.max(0.25, Math.min(8, view.s * k)); k = ns / view.s;
    view.ox = sx - (sx - view.ox) * k; view.oy = sy - (sy - view.oy) * k; view.s = ns; render();
  }
  cv.addEventListener('contextmenu', e => e.preventDefault());

  // ───────────────────────── trazo → piezas (lápiz) ─────────────────────────
  const DIRS = [[1, 0], [1, 1], [0, 1], [-1, 1], [-1, 0], [-1, -1], [0, -1], [1, -1]];
  const STRAIGHT = [['12', 5], ['04', 4], ['03', 3], ['02', 2]], DIAG = [['20', 5], ['19', 3], ['18', 2]];
  function rdp(pts, eps) {
    if (pts.length < 3) return pts.slice();
    const a = pts[0], b = pts[pts.length - 1], L = Math.hypot(b[0] - a[0], b[1] - a[1]);
    if (L < eps) {
      let fi = 0, fd = 0; pts.forEach((p, i) => { const d = Math.hypot(p[0] - a[0], p[1] - a[1]); if (d > fd) { fd = d; fi = i; } });
      if (fd < eps) return [a, b];
      return rdp(pts.slice(0, fi + 1), eps).slice(0, -1).concat(rdp(pts.slice(fi), eps));
    }
    let idx = 0, dm = 0;
    for (let i = 1; i < pts.length - 1; i++) { const d = Math.abs((b[0] - a[0]) * (a[1] - pts[i][1]) - (a[0] - pts[i][0]) * (b[1] - a[1])) / L; if (d > dm) { dm = d; idx = i; } }
    return dm > eps ? rdp(pts.slice(0, idx + 1), eps).slice(0, -1).concat(rdp(pts.slice(idx), eps)) : [a, b];
  }
  const tmp = (t, x, y, m) => ({ u: 0, t, x, y, m: m.slice() });
  function placeAlong(t, pos, dir) {
    const d = DEF[t], A = d.holesQ[d.ends[0]], B = d.holesQ[d.ends[1]];
    const u = [B.x - A.x, B.y - A.y], ul = Math.hypot(u[0], u[1]), dl = Math.hypot(dir[0], dir[1]);
    for (const m of ORIENTS) {
      const v = app(m, u[0], u[1]);
      if (Math.abs(v[0] / ul - dir[0] / dl) < 0.01 && Math.abs(v[1] / ul - dir[1] / dl) < 0.01) { const a = app(m, A.x, A.y); return tmp(t, pos[0] * PITCH - a[0], pos[1] * PITCH - a[1], m); }
    }
    return tmp(t, pos[0] * PITCH, pos[1] * PITCH, ID);
  }
  function strokeToPieces(pts) {
    const out = []; if (!pts.length) return out;
    let len = 0; for (let i = 1; i < pts.length; i++) len += Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]);
    const sp = (p) => [Math.round(p[0] / PITCH), Math.round(p[1] / PITCH)];
    if (len < PITCH * 0.5) { const [i, j] = sp(pts[0]); out.push(tmp('01', i * PITCH, j * PITCH, ID)); return out; }
    const simp = rdp(pts, PITCH * 0.35);
    let cur = sp(simp[0]); const runs = [];
    for (let k = 1; k < simp.length; k++) {
      const v = [simp[k][0] - simp[k - 1][0], simp[k][1] - simp[k - 1][1]];
      if (Math.hypot(v[0], v[1]) < 1) continue;
      const di = ((Math.round(Math.atan2(v[1], v[0]) / (Math.PI / 4)) % 8) + 8) % 8, dir = DIRS[di], dl = Math.hypot(dir[0], dir[1]);
      const tg = [simp[k][0] / PITCH - cur[0], simp[k][1] / PITCH - cur[1]];
      const n = Math.round((tg[0] * dir[0] + tg[1] * dir[1]) / (dl * dl));
      if (n <= 0) continue;
      const last = runs[runs.length - 1];
      if (last && last.di === di) last.n += n; else runs.push({ start: cur.slice(), di, n });
      cur = [cur[0] + dir[0] * n, cur[1] + dir[1] * n];
    }
    for (const r of runs) {
      const dir = DIRS[r.di], list = dir[0] && dir[1] ? DIAG : STRAIGHT;
      let rem = r.n + 1, pos = r.start.slice();
      while (rem > 1) { const [t, h] = list.find(([, h]) => h <= rem); out.push(placeAlong(t, pos, dir)); pos = [pos[0] + dir[0] * (h - 1), pos[1] + dir[1] * (h - 1)]; rem -= h - 1; }
    }
    if (!out.length) { const [i, j] = sp(pts[0]); out.push(tmp('01', i * PITCH, j * PITCH, ID)); }
    return out;
  }

  // ───────────────────────── herramientas ─────────────────────────
  const ICONS = {
    draw: '<path d="M13.5 2.5l3 3L6.5 15.5 2.5 16.5l1-4z M11.5 4.5l3 3"/>',
    hand: '<path d="M6 9.5V4.2a1.2 1.2 0 0 1 2.4 0V9 M8.4 8.5V2.8a1.2 1.2 0 0 1 2.4 0V8.5 M10.8 8.6V3.8a1.2 1.2 0 0 1 2.4 0V9.4 M13.2 9V6a1.2 1.2 0 0 1 2.4 0v5.3c0 3.2-2.2 5.7-5.4 5.7H9.6c-1.8 0-3-.8-4-2.2L2.8 10.6a1.2 1.2 0 0 1 1.9-1.4L6 10.6"/>',
    flipH: '<path d="M9.5 1.5v16 M7 4.5 2 14.5h5z M12 4.5l5 10h-5z"/>',
    flipV: '<path d="M1.5 9.5h16 M4.5 7 14.5 2v5z M4.5 12l10 5v-5z"/>',
    rotL: '<path d="M4 6.5A6.5 6.5 0 1 1 3 10 M4 2.5v4h4"/>',
    rotR: '<path d="M15 6.5A6.5 6.5 0 1 0 16 10 M15 2.5v4h-4"/>',
    save: '<path d="M3 2.5h10.5l3 3v11H3z M6 2.5v4h6v-4 M6.5 16.5v-5h6v5"/><circle cx="9.5" cy="13.5" r="0"/>',
    load: '<path d="M2.5 5.5v11h14v-9h-7l-2-2z M9.5 15V9.5 M7 12l2.5-2.5L12 12"/>',
    download: '<path d="M9.5 2.5v10 M5.5 8.5l4 4 4-4 M3 13.5v3h13v-3"/>',
    clear: '<path d="M3 5h13 M7.5 5V3h4v2 M4.5 5l1 11.5h8L14.5 5 M8 8.5v5 M11 8.5v5"/>',
  };
  document.querySelectorAll('.tools .tb').forEach(b => {
    const k = b.dataset.tool || b.dataset.act;
    b.innerHTML = `<svg viewBox="0 0 19 19" fill="none" stroke="currentColor" stroke-width="1.1" stroke-linejoin="round" stroke-linecap="round">${ICONS[k]}</svg>`;
    b.addEventListener('click', (e) => { e.stopPropagation(); b.dataset.tool ? setMode(b.dataset.tool) : act(b.dataset.act); });
  });
  function setMode(m) {
    mode = m; hover = null;
    document.querySelectorAll('.tools [data-tool]').forEach(b => b.classList.toggle('on', b.dataset.tool === m));
    cv.style.cursor = m === 'draw' ? 'crosshair' : 'default';
    render();
  }
  const dlmenu = document.getElementById('dlmenu');
  function closeMenus() { dlmenu.classList.remove('on'); document.getElementById('help').classList.add('hide'); document.getElementById('helpbtn').classList.remove('on'); }
  dlmenu.querySelectorAll('[data-exp]').forEach(b => b.addEventListener('click', (e) => { e.stopPropagation(); dlmenu.classList.remove('on'); b.dataset.exp === 'otf' ? exportOTF() : exportGlyphs(); }));
  document.addEventListener('click', (e) => { if (!e.target.closest('.dlwrap') && !e.target.closest('#help') && !e.target.closest('#helpbtn')) closeMenus(); });

  function act(a) {
    switch (a) {
      case 'flipH': return transform(FLIP_H);
      case 'flipV': return transform(FLIP_V);
      case 'rotL': return transform(ROT_L);
      case 'rotR': return transform(ROT_R);
      case 'save': return saveFile();
      case 'load': return fileInput.click();
      case 'download': return dlmenu.classList.toggle('on');
      case 'clear':
        if (!glyph().length) return RR.toast('“' + label(current) + '” is already empty');
        { const b = snapshot(); glyphs[current] = []; selection.clear(); commit(b); }
        return RR.toast('“' + label(current) + '” cleared · Cmd/Ctrl+Z to undo');
    }
  }
  // gira / refleja la selección (o la letra entera si no hay nada seleccionado)
  function transform(R) {
    let t = selected(); if (!t.length) t = glyph();
    if (!t.length) return RR.toast('Nothing to transform');
    const b = snapshot(), bb = bboxAll(t);
    const px = Math.round((bb[0] + bb[2]) / 2 / PITCH) * PITCH, py = Math.round((bb[1] + bb[3]) / 2 / PITCH) * PITCH;
    for (const p of t) { const v = app(R, p.x - px, p.y - py); p.x = px + v[0]; p.y = py + v[1]; p.m = mul(R, p.m); }
    const s = snap(t, others(t), Infinity); for (const p of t) { p.x += s[0]; p.y += s[1]; }
    commit(b);
  }

  // ───────────────────────── panel de piezas ─────────────────────────
  function thumb(canvas, t, pad = 14) {
    const d = DEF[t], b = d.bbox, r = canvas.getBoundingClientRect(), k = Math.min(2, window.devicePixelRatio || 1);
    canvas.width = Math.max(1, Math.round(r.width * k)); canvas.height = Math.max(1, Math.round(r.height * k));
    const c = canvas.getContext('2d'), s = Math.min(1.25, (r.width - pad * 2) / (b[2] - b[0]), (r.height - pad * 2) / (b[3] - b[1]));
    c.setTransform(k * s, 0, 0, k * s, k * (r.width / 2 - (b[0] + b[2]) / 2 * s), k * (r.height / 2 - (b[1] + b[3]) / 2 * s));
    c.fillStyle = INK; c.fill(d.path, 'evenodd');
  }
  const cats = document.getElementById('cats'), list = document.getElementById('list');
  CATS.forEach(c => {
    const el = RR.h(`<div class="m tile ${c.w === 2 ? 'w2' : ''}" data-cat="${c.k}" title="${c.name}"><canvas></canvas></div>`);
    cats.appendChild(el);
    tileDrag(el, c.rep, () => { cat = cat === c.k ? null : c.k; renderList(); });
  });
  function renderList() {
    cats.querySelectorAll('.tile').forEach(t => t.classList.toggle('on', t.dataset.cat === cat));
    list.innerHTML = '';
    if (!cat) return;
    PIECES.filter(p => p.section === cat).forEach(p => {
      const w = p.bbox[2] - p.bbox[0] > 95 ? 2 : 1;
      const el = RR.h(`<div class="m tile ${w === 2 ? 'w2' : ''}" title="${p.name}"><canvas></canvas></div>`);
      list.appendChild(el);
      tileDrag(el, p.id, () => addAtCenter(p.id));
    });
    // si una pieza se queda sola en su fila, ocupa todo el ancho
    let col = 0, prev = null;
    list.querySelectorAll('.tile').forEach(el => {
      if (el.classList.contains('w2')) { if (col === 1) prev.classList.add('w2'); col = 0; }
      else { col = (col + 1) % 2; prev = el; }
    });
    if (col === 1) prev.classList.add('w2');
    requestAnimationFrame(drawThumbs);
  }
  function drawThumbs() {
    cats.querySelectorAll('.tile').forEach((t, i) => thumb(t.querySelector('canvas'), CATS[i].rep));
    list.querySelectorAll('.tile').forEach((t, i) => thumb(t.querySelector('canvas'), PIECES.filter(p => p.section === cat)[i].id));
  }
  function addAtCenter(t) {
    const [x, y] = toWorld(W / 2, H / 2);
    const d = DEF[t], p = newPiece(t, x - (d.bbox[0] + d.bbox[2]) / 2, y - (d.bbox[1] + d.bbox[3]) / 2);
    const s = snap([p], glyph(), Infinity); p.x += s[0]; p.y += s[1];
    const b = snapshot(); glyph().push(p); selection = new Set([p.u]); commit(b);
  }
  // arrastrar una ficha al lienzo (clic = acción alternativa)
  function tileDrag(el, t, onClick) {
    el.addEventListener('pointerdown', (e) => {
      if (e.button !== 0) return;
      el.setPointerCapture(e.pointerId);
      const x0 = e.clientX, y0 = e.clientY; let on = false;
      const mv = (ev) => {
        if (!on && Math.hypot(ev.clientX - x0, ev.clientY - y0) > 6) { on = true; drag = { kind: 'new', t }; document.body.classList.add('rr-dragging'); }
        if (!on) return;
        const r = cv.getBoundingClientRect(), [x, y] = toWorld(ev.clientX - r.left, ev.clientY - r.top), d = DEF[t];
        const g = { u: -1, t, x: x - (d.bbox[0] + d.bbox[2]) / 2, y: y - (d.bbox[1] + d.bbox[3]) / 2, m: ID };
        const pr = document.getElementById('panel').getBoundingClientRect();
        drag.overPanel = ev.clientX > pr.left;
        if (!drag.overPanel) { const s = snap([g], glyph(), Infinity); g.x += s[0]; g.y += s[1]; }
        drag.ghost = g; render();
      };
      const up = () => {
        el.removeEventListener('pointermove', mv); el.removeEventListener('pointerup', up);
        document.body.classList.remove('rr-dragging');
        if (!on) return onClick();
        const d = drag; drag = null;
        if (d && d.ghost && !d.overPanel) { const b = snapshot(); const p = newPiece(t, d.ghost.x, d.ghost.y); glyph().push(p); selection = new Set([p.u]); commit(b); setMode('hand'); }
        render();
      };
      el.addEventListener('pointermove', mv); el.addEventListener('pointerup', up);
    });
  }
  list.addEventListener('wheel', (e) => e.stopPropagation(), { passive: true });

  // ───────────────────────── navegación de glifos ─────────────────────────
  const setsEl = document.getElementById('sets'), cur = document.getElementById('cur'), picker = document.getElementById('picker'), gnav = document.getElementById('gnav'), menuBtn = document.getElementById('menu');
  ORDER.forEach(k => {
    const b = RR.h(`<button class="m t2" data-set="${k}">${k}</button>`);
    b.addEventListener('click', () => { set = k; if (!SETS[set].includes(current)) select(SETS[set][0]); else renderNav(); });
    setsEl.appendChild(b);
  });
  function select(ch) { if (ch === current) return renderNav(); current = ch; selection.clear(); hover = null; for (const k in SETS) if (SETS[k].includes(ch)) set = k; renderNav(); render(); saveLocal(); }
  function step(d) { const s = SETS[set], i = s.indexOf(current); select(s[(i + d + s.length) % s.length]); }
  document.getElementById('prev').addEventListener('click', () => step(-1));
  document.getElementById('next').addEventListener('click', () => step(1));
  const togglePicker = (on) => { gnav.classList.toggle('open', on); picker.classList.toggle('hide', !on); menuBtn.classList.toggle('on', on); renderPicker(); };
  cur.addEventListener('click', () => togglePicker(true));
  menuBtn.addEventListener('click', () => togglePicker(!gnav.classList.contains('open')));
  function renderNav() {
    setsEl.querySelectorAll('.m').forEach(b => { b.classList.toggle('on', b.dataset.set === set); b.classList.toggle('dim', b.dataset.set !== set); });
    cur.textContent = label(current);
    renderPicker();
  }
  function renderPicker() {
    if (picker.classList.contains('hide')) return;
    picker.innerHTML = '';
    const ks = [set];
    // primero el juego activo; pestañas para cambiar
    const tabs = RR.h('<div style="grid-column:1/-1;display:flex;gap:var(--gut)"></div>');
    ORDER.forEach(k => {
      const b = RR.h(`<button class="m t2 ${k === set ? 'on' : 'dim'}" style="--h:4;flex:1">${k}</button>`);
      b.addEventListener('click', () => { set = k; renderPicker(); });
      tabs.appendChild(b);
    });
    picker.appendChild(tabs);
    SETS[ks[0]].forEach(ch => {
      const has = (glyphs[ch] || []).length > 0;
      const b = RR.h(`<button class="m t2 ${has ? 'has' : 'dim'} ${ch === current ? 'on' : ''}" title="${label(ch)}"><span>${RR.esc(label(ch))}</span>${has ? '<canvas></canvas>' : ''}</button>`);
      b.addEventListener('click', () => { select(ch); togglePicker(false); });
      picker.appendChild(b);
      if (has) requestAnimationFrame(() => mini(b.querySelector('canvas'), glyphs[ch]));
    });
  }
  function mini(canvas, pieces) {
    const r = canvas.getBoundingClientRect(), k = 2, bb = bboxAll(pieces);
    canvas.width = r.width * k; canvas.height = r.height * k;
    const c = canvas.getContext('2d'), s = Math.min((r.width - 6) / (bb[2] - bb[0]), (r.height - 6) / (bb[3] - bb[1]));
    c.setTransform(k * s, 0, 0, k * s, k * (r.width / 2 - (bb[0] + bb[2]) / 2 * s), k * (r.height / 2 - (bb[1] + bb[3]) / 2 * s));
    for (const p of pieces) { c.save(); c.translate(p.x, p.y); c.transform(p.m[0], p.m[1], p.m[2], p.m[3], 0, 0); c.fillStyle = INK; c.fill(DEF[p.t].path, 'evenodd'); c.restore(); }
  }

  // ───────────────────────── teclado ─────────────────────────
  window.addEventListener('keydown', (e) => {
    if (RR.isTyping(e)) return;
    const mod = e.metaKey || e.ctrlKey, k = e.key.toLowerCase();
    if (e.key === ' ' && !spaceDown) { spaceDown = true; ws.classList.add('space'); cv.style.cursor = 'grab'; e.preventDefault(); return; }
    if (mod && k === 'z') { e.preventDefault(); return e.shiftKey ? redo() : undo(); }
    if (mod && k === 'y') { e.preventDefault(); return redo(); }
    if (mod && k === 's') { e.preventDefault(); return saveFile(); }
    if (mod && k === 'o') { e.preventDefault(); return fileInput.click(); }
    if (mod && k === 'e') { e.preventDefault(); return e.shiftKey ? exportGlyphs() : exportOTF(); }
    if (mod && k === 'a') { e.preventDefault(); glyph().forEach(p => selection.add(p.u)); setMode('hand'); return; }
    if (mod && (k === 'c' || k === 'x')) {
      e.preventDefault(); const s = selected(); if (!s.length) return;
      clipboard = JSON.stringify(s.map(p => ({ t: p.t, x: p.x, y: p.y, m: p.m })));
      if (k === 'x') { const b = snapshot(); glyphs[current] = others(s); selection.clear(); commit(b); }
      return RR.toast(s.length + (s.length > 1 ? ' pieces' : ' piece') + (k === 'x' ? ' cut' : ' copied'));
    }
    if (mod && k === 'v') {
      e.preventDefault(); if (!clipboard) return;
      const b = snapshot(), src = JSON.parse(clipboard), off = src.some(q => glyph().some(p => p.t === q.t && Math.abs(p.x - q.x) < .1 && Math.abs(p.y - q.y) < .1)) ? PITCH : 0;
      const ps = src.map(q => newPiece(q.t, q.x + off, q.y + off, q.m)); glyph().push(...ps); selection = new Set(ps.map(p => p.u)); setMode('hand'); return commit(b);
    }
    if (mod && k === 'd') {
      e.preventDefault(); const s = selected(); if (!s.length) return;
      const b = snapshot(), ps = s.map(p => newPiece(p.t, p.x + PITCH, p.y + PITCH, p.m)); glyph().push(...ps); selection = new Set(ps.map(p => p.u)); return commit(b);
    }
    if (mod && (k === '=' || k === '+')) { e.preventDefault(); return zoomAt(W / 2, H / 2, 1.25); }
    if (mod && k === '-') { e.preventDefault(); return zoomAt(W / 2, H / 2, 0.8); }
    if (mod && k === '0') { e.preventDefault(); return fit(glyph()); }
    if (mod && k === '1') { e.preventDefault(); return zoomAt(W / 2, H / 2, 1 / view.s); }
    if (mod && (e.key === 'ArrowLeft' || e.key === 'ArrowRight')) { e.preventDefault(); return step(e.key === 'ArrowLeft' ? -1 : 1); }
    if (mod) return;
    if (e.key === 'Delete' || e.key === 'Backspace') { e.preventDefault(); const s = selected(); if (!s.length) return; const b = snapshot(); glyphs[current] = others(s); selection.clear(); return commit(b); }
    if (e.key === 'Escape') { selection.clear(); togglePicker(false); closeMenus(); return render(); }
    const arrows = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] };
    if (arrows[e.key]) {
      e.preventDefault(); const s = selected(); if (!s.length) return;
      const n = e.shiftKey ? 3 : 1, b = snapshot();
      for (const p of s) { p.x += arrows[e.key][0] * PITCH * n; p.y += arrows[e.key][1] * PITCH * n; }
      return commit(b);
    }
    if (k === '[' || k === ']') return step(k === '[' ? -1 : 1);
    if (k === 'v' && e.shiftKey) return transform(FLIP_V);
    if (k === 'h' && e.shiftKey) return transform(FLIP_H);
    if (k === 'r') return transform(e.shiftKey ? ROT_L : ROT_R);
    if (k === 'v') return setMode('hand');
    if (k === 'p' || k === 'b') return setMode('draw');
    if (e.key === '?') return toggleHelp();
  });
  window.addEventListener('keyup', (e) => { if (e.key === ' ') { spaceDown = false; ws.classList.remove('space'); cv.style.cursor = mode === 'draw' ? 'crosshair' : 'default'; } });

  const HELP = [
    ['P / B', 'Pencil (draw pieces)'], ['V', 'Hand · move & select'], ['Space + drag', 'Pan the canvas'],
    ['Cmd/Ctrl + wheel', 'Zoom'], ['Cmd/Ctrl + 0 · 1', 'Fit glyph · 100 %'], ['Shift + click', 'Add to selection'],
    ['Alt + drag', 'Duplicate'], ['Shift + drag', 'Lock axis'], ['Alt + click (pencil)', 'Select without changing tool'],
    ['Arrows (+ Shift)', 'Nudge 1 (3) holes'], ['R · Shift + R', 'Rotate right · left'], ['Shift + H · Shift + V', 'Flip horizontal · vertical'],
    ['Cmd/Ctrl + C X V D', 'Copy · cut · paste · duplicate'], ['Cmd/Ctrl + Z', 'Undo (+ Shift: redo)'], ['Cmd/Ctrl + A', 'Select all'],
    ['Delete', 'Delete selection'], ['Drag onto pieces panel', 'Delete'], ['[ ] · Cmd/Ctrl + ← →', 'Previous / next glyph'],
    ['Cmd/Ctrl + S · O', 'Save · load progress'], ['Cmd/Ctrl + E (+ Shift)', 'Download OTF (.glyphs)'],
  ];
  const help = document.getElementById('help'), helpBtn = document.getElementById('helpbtn');
  help.innerHTML = HELP.map(([a, b]) => `<div><b>${a}</b>${b}</div>`).join('');
  function toggleHelp() { const on = help.classList.contains('hide'); help.classList.toggle('hide', !on); helpBtn.classList.toggle('on', on); }
  helpBtn.addEventListener('click', (e) => { e.stopPropagation(); toggleHelp(); });

  // ───────────────────────── guardar / cargar ─────────────────────────
  const clean = () => { const g = {}; for (const k in glyphs) if (glyphs[k] && glyphs[k].length) g[k] = glyphs[k].map(p => ({ u: p.u, t: p.t, x: +p.x.toFixed(3), y: +p.y.toFixed(3), m: p.m })); return g; };
  const state = () => ({ app: 'ERRE ERRE FOUNDRY Builder', version: 2, module: MOD, current, set, glyphs: clean() });
  function apply(o) {
    if (!o || typeof o.glyphs !== 'object') throw new Error('invalid file');
    const g = {};
    for (const k in o.glyphs) if (Array.isArray(o.glyphs[k])) g[k] = o.glyphs[k].filter(p => p && DEF[p.t] && isFinite(p.x) && isFinite(p.y)).map(p => ({ u: p.u, t: p.t, x: +p.x, y: +p.y, m: Array.isArray(p.m) && p.m.length === 4 ? p.m.map(Number) : ID.slice() }));
    glyphs = g; fixUids(); selection.clear();
    for (const k in glyphs) snapEach(glyphs[k]);
    if (typeof o.current === 'string') current = o.current;
    if (o.set && SETS[o.set]) set = o.set; else if (o.activeSet) set = { MAYUS: 'ABC', MINUS: 'abc', NUM: '123', SIMB: '@!?' }[o.activeSet] || 'ABC';
  }
  function saveLocal() { try { localStorage.setItem(STORE, JSON.stringify(state())); } catch (e) { } }
  function restoreLocal() {
    try {
      const s = localStorage.getItem(STORE) || localStorage.getItem('rr-foundry-builder-v1');
      if (!s) return;
      const o = JSON.parse(s);
      if (o.version !== 2) for (const k in o.glyphs) for (const p of o.glyphs[k]) p.y -= 14 * PITCH;  // prueba en p5: la base estaba en la fila 14
      apply(o);
    } catch (e) { }
  }
  const download = (blob, name) => { const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name; document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 4000); };
  function saveFile() { download(new Blob([JSON.stringify(state(), null, 1)], { type: 'application/json' }), 'erre-erre-builder.json'); RR.toast('Progress saved · ' + Object.keys(clean()).length + ' glyphs'); }
  const fileInput = Object.assign(document.createElement('input'), { type: 'file', accept: '.json,application/json' });
  fileInput.addEventListener('change', () => {
    const f = fileInput.files[0]; if (!f) return;
    const rd = new FileReader();
    rd.onload = () => { try { const b = snapshot(); apply(JSON.parse(rd.result)); commit(b); renderNav(); fit(glyph()); RR.toast('Progress loaded · ' + Object.keys(clean()).length + ' glyphs'); } catch (err) { RR.toast('Could not load: ' + err.message); } };
    rd.readAsText(f); fileInput.value = '';
  });

  // ───────────────────────── exportar ─────────────────────────
  // Cada pieza → contornos en unidades de fuente (y hacia arriba). El exterior va
  // antihorario y los agujeros horario: con relleno nonzero las piezas solapadas se
  // suman y los agujeros alineados de piezas apiladas quedan huecos, como en el montaje real.
  const FAMILY = 'Erre Erre Builder';
  function contours(list, minX) {
    const out = [];
    for (const p of list) {
      const d = DEF[p.t];
      const tr = (x, y) => { const w = app(p.m, x, y); return [Math.round((p.x + w[0] - minX + SB) * UNITS), Math.round((BASE_Y - (p.y + w[1])) * UNITS)]; };
      d.segs.forEach((sub, si) => {
        let start = null; const segs = [];
        for (const s of sub) {
          if (s[0] === 'M') start = tr(s[1], s[2]);
          else if (s[0] === 'L') segs.push({ L: tr(s[1], s[2]) });
          else if (s[0] === 'C') segs.push({ c1: tr(s[1], s[2]), c2: tr(s[3], s[4]), p: tr(s[5], s[6]) });
        }
        if (!start || !segs.length) return;
        // cierra y quita segmentos nulos
        let cl = segs.map(s => s.L ? { p: s.L } : s);
        const last = cl[cl.length - 1].p;
        if (last[0] !== start[0] || last[1] !== start[1]) cl.push({ p: start.slice() });
        let prev = start; cl = cl.filter(s => { const keep = s.c1 || s.p[0] !== prev[0] || s.p[1] !== prev[1]; if (keep) prev = s.p; return keep; });
        if (cl.length < 2) return;
        let c = { start, segs: cl };
        const pts = [start, ...cl.flatMap(s => s.c1 ? [s.c1, s.c2, s.p] : [s.p])];
        let A = 0; for (let i = 0; i < pts.length; i++) { const a = pts[i], b = pts[(i + 1) % pts.length]; A += a[0] * b[1] - b[0] * a[1]; }
        const outer = si === d.outer;
        if ((outer && A < 0) || (!outer && A > 0)) c = reverse(c);
        out.push(c);
      });
    }
    return out;
  }
  function reverse(c) {
    const nodes = [c.start, ...c.segs.map(s => s.p)];          // nodes[i] → nodes[i+1] con segs[i]
    const segs = [];
    for (let i = c.segs.length - 1; i >= 0; i--) { const s = c.segs[i], to = nodes[i]; segs.push(s.c1 ? { c1: s.c2, c2: s.c1, p: to } : { p: to }); }
    return { start: nodes[nodes.length - 1], segs };
  }
  function built() {
    return Object.keys(glyphs).filter(c => glyphs[c] && glyphs[c].length).sort((a, b) => a.codePointAt(0) - b.codePointAt(0))
      .map(ch => { const bb = bboxAll(glyphs[ch]); return { ch, adv: Math.round((bb[2] - bb[0] + 2 * SB) * UNITS), cs: contours(glyphs[ch], bb[0]) }; });
  }
  function exportOTF() {
    const G = built();
    if (!G.length) return RR.toast('Build at least one glyph first');
    const gl = [
      new opentype.Glyph({ name: '.notdef', unicode: 0, advanceWidth: 500, path: (() => { const p = new opentype.Path(); p.moveTo(50, 0); p.lineTo(450, 0); p.lineTo(450, 700); p.lineTo(50, 700); p.close(); p.moveTo(100, 50); p.lineTo(100, 650); p.lineTo(400, 650); p.lineTo(400, 50); p.close(); return p; })() }),
      new opentype.Glyph({ name: 'space', unicode: 32, advanceWidth: Math.round(9 * MOD * UNITS), path: new opentype.Path() }),
    ];
    for (const g of G) {
      const path = new opentype.Path();
      for (const c of g.cs) { path.moveTo(...c.start); for (const s of c.segs) s.c1 ? path.curveTo(...s.c1, ...s.c2, ...s.p) : path.lineTo(...s.p); path.close(); }
      gl.push(new opentype.Glyph({ name: gname(g.ch), unicode: g.ch.codePointAt(0), advanceWidth: g.adv, path }));
    }
    const font = new opentype.Font({ familyName: FAMILY, styleName: 'Regular', unitsPerEm: 1000, ascender: 800, descender: -250, designer: 'Erre Erre Foundry Builder', glyphs: gl });
    download(new Blob([font.toArrayBuffer()], { type: 'font/otf' }), 'ErreErreBuilder-Regular.otf');
    RR.toast('OTF downloaded · ' + G.length + ' glyphs');
  }
  function exportGlyphs() {
    const G = built();
    if (!G.length) return RR.toast('Build at least one glyph first');
    const q = (s) => /^[A-Za-z0-9._]+$/.test(s) ? s : '"' + s.replace(/\\/g, '\\\\').replace(/"/g, '\\"') + '"';
    const shape = (c) => {
      const nodes = [];
      c.segs.forEach(s => { if (s.c1) nodes.push(`(${s.c1[0]},${s.c1[1]},o)`, `(${s.c2[0]},${s.c2[1]},o)`, `(${s.p[0]},${s.p[1]},c)`); else nodes.push(`(${s.p[0]},${s.p[1]},l)`); });
      return `{\nclosed = 1;\nnodes = (\n${nodes.join(',\n')}\n);\n}`;
    };
    const glyphBlock = (name, uni, adv, cs) => `{\nglyphname = ${q(name)};\nlayers = (\n{\nlayerId = m01;\n${cs.length ? `shapes = (\n${cs.map(shape).join(',\n')}\n);\n` : ''}width = ${adv};\n}\n);\n${uni != null ? `unicode = ${uni};\n` : ''}}`;
    const body = [glyphBlock('space', 32, Math.round(9 * MOD * UNITS), []), ...G.map(g => glyphBlock(gname(g.ch), g.ch.codePointAt(0), g.adv, g.cs))];
    const txt = `{
.appVersion = "3260";
.formatVersion = 3;
date = "${new Date().toISOString().slice(0, 19).replace('T', ' ')} +0000";
familyName = ${q(FAMILY)};
fontMaster = (
{
id = m01;
metricValues = (
{pos = 800;},
{pos = 714;},
{pos = 428;},
{},
{pos = -250;}
);
name = Regular;
}
);
glyphs = (
${body.join(',\n')}
);
metrics = (
{type = ascender;},
{type = "cap height";},
{type = "x-height";},
{type = baseline;},
{type = descender;}
);
unitsPerEm = 1000;
versionMajor = 1;
versionMinor = 0;
}
`;
    download(new Blob([txt], { type: 'text/plain' }), 'ErreErreBuilder.glyphs');
    RR.toast('.glyphs downloaded · ' + G.length + ' glyphs');
  }
  const NAMES = { '.': 'period', ',': 'comma', ':': 'colon', ';': 'semicolon', '!': 'exclam', '¡': 'exclamdown', '?': 'question', '¿': 'questiondown', '@': 'at', '#': 'numbersign', '&': 'ampersand', '%': 'percent', '(': 'parenleft', ')': 'parenright', '-': 'hyphen', '+': 'plus', '=': 'equal', '*': 'asterisk', '/': 'slash', "'": 'quotesingle', '"': 'quotedbl', '$': 'dollar', '€': 'Euro', 'Ñ': 'Ntilde', 'ñ': 'ntilde', 0: 'zero', 1: 'one', 2: 'two', 3: 'three', 4: 'four', 5: 'five', 6: 'six', 7: 'seven', 8: 'eight', 9: 'nine' };
  function gname(ch) { if (/^[A-Za-z]$/.test(ch)) return ch; if (NAMES[ch]) return NAMES[ch]; return 'uni' + ch.codePointAt(0).toString(16).toUpperCase().padStart(4, '0'); }

  // ───────────────────────── arranque ─────────────────────────
  restoreLocal();
  setMode('draw');
  renderNav();
  renderList();
  resize();
  window.addEventListener('resize', () => { resize(); drawThumbs(); });
  if (RR.menu) RR.menu.el.addEventListener('rr:menu', () => setTimeout(() => { resize(); }, 750));
  new ResizeObserver(() => resize()).observe(ws);
  document.fonts.ready.then(drawThumbs);
  RR.debug = { get glyphs() { return glyphs; }, get current() { return current; }, select, exportGlyphs, exportOTF, built };
})();
