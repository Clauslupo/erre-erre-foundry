/* ERRE ERRE FOUNDRY · SONIDO
   Todo el sonido se genera en directo con Web Audio: no hay archivos.
   Siempre activo, sin botón. El navegador no deja sonar nada hasta el primer clic o tecla:
   a partir de ahí suena todo.
   PARA QUITARLO ENTERO: borra este archivo y las dos líneas <script src="…sound.js">
   (una en index.html y otra en builder/index.html). */
(function () {
  const KEY = 'rr-sound';
  const inBuilder = document.body.classList.contains('bld');
  let on = true;                                   // siempre activo
  let ac = null, master = null;
  function ctx() {
    if (!ac) {
      ac = new (window.AudioContext || window.webkitAudioContext)({ latencyHint: 'interactive' });
      master = ac.createGain(); master.gain.value = 0.22;
      const comp = ac.createDynamicsCompressor(); master.connect(comp); comp.connect(ac.destination);
    }
    if (ac.state === 'suspended') ac.resume();
    return ac;
  }
  const ready = () => on && (ac ? ac.state === 'running' || (ac.resume(), true) : (ctx(), true));

  // ───────── instrumentos ─────────
  function tone(f, { dur = .25, type = 'sine', gain = .5, at = 0, attack = .005, cutoff = 0, detune = 0 } = {}) {
    const c = ctx(), t = c.currentTime + at;
    const o = c.createOscillator(), g = c.createGain();
    o.type = type; o.frequency.value = f; o.detune.value = detune;
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(gain, t + attack); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    let n = o;
    if (cutoff) { const fl = c.createBiquadFilter(); fl.type = 'lowpass'; fl.frequency.value = cutoff; o.connect(fl); n = fl; }
    n.connect(g); g.connect(master); o.start(t); o.stop(t + dur + .05);
  }
  function noise({ dur = .02, gain = .4, at = 0, freq = 3000, q = 1, type = 'bandpass' } = {}) {
    const c = ctx(), t = c.currentTime + at, len = Math.max(1, Math.floor(c.sampleRate * dur));
    const buf = c.createBuffer(1, len, c.sampleRate), d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const s = c.createBufferSource(), f = c.createBiquadFilter(), g = c.createGain();
    s.buffer = buf; f.type = type; f.frequency.value = freq; f.Q.value = q; g.gain.value = gain;
    s.connect(f); f.connect(g); g.connect(master); s.start(t);
  }
  // ── sonidos de taller: ataques secos, colas cortas, nada de ecos ──
  // golpe sordo (el cuerpo de la máquina): tono que cae en picado
  function thump(f = 110, { gain = .5, at = 0, dur = .07 } = {}) {
    const c = ctx(), t = c.currentTime + at, o = c.createOscillator(), g = c.createGain();
    o.type = 'sine'; o.frequency.setValueAtTime(f, t); o.frequency.exponentialRampToValueAtTime(f * .4, t + dur);
    g.gain.setValueAtTime(gain, t); g.gain.exponentialRampToValueAtTime(.0001, t + dur);
    o.connect(g); g.connect(master); o.start(t); o.stop(t + dur + .02);
  }
  // chapa: ruido muy resonante + parciales cuadrados que se apagan enseguida
  function clank(f, { gain = .35, at = 0, dur = .14 } = {}) {
    noise({ dur: .012, gain: gain * 1.2, at, freq: f * 3, q: 1.5 });                // el golpe
    noise({ dur, gain: gain * .9, at, freq: f, q: 18 });                              // la chapa vibrando
    [[1, .25], [2.32, .12], [4.07, .06]].forEach(([r, a]) => tone(f * r, { dur: dur * .7, gain: gain * a, at, type: 'square', attack: .001, cutoff: f * 6 }));
  }
  // clic seco (trinquete, tecla, engranaje)
  const click = (freq = 3500, gain = .45, at = 0) => noise({ dur: .004, gain, at, freq, q: 3, type: 'bandpass' });
  // golpe metálico pesado = cuerpo + chapa
  const metal = (f, { gain = .35, at = 0, dur = .16 } = {}) => { thump(f / 2.5, { gain: gain * 1.1, at }); clank(f, { gain, at, dur }); };
  // escala pentatónica para que todo suene bien junto
  const PENTA = [0, 2, 4, 7, 9];
  const note = (i, base = 220) => base * Math.pow(2, (Math.floor(i / 5) * 12 + PENTA[((i % 5) + 5) % 5]) / 12);

  // ───────── botón SOUND (el 4.º botón del menú: CATALOGUE · RESOURCES · BUILDER · SOUND · SUBMIT · ABOUT) ─────────
  function setOn(v, from) {
    on = v;
    try { localStorage.setItem(KEY, on ? 'on' : 'off'); } catch (e) {}
    document.querySelectorAll('a[href="#sound"] .label').forEach(l => l.textContent = on ? 'SOUND ON' : 'SOUND OFF');
    if (!inBuilder && from !== 'frame') { const f = document.getElementById('bldFrame'); if (f && f.contentWindow) f.contentWindow.postMessage({ rrSound: on }, '*'); }
    if (on && from === 'click') chord(1.2);
  }
  // el audio arranca con el primer clic o tecla (antes el navegador lo bloquea)
  const unlock = () => { try { ctx(); } catch (e) {} };
  ['pointerdown', 'keydown', 'touchstart'].forEach(ev => window.addEventListener(ev, unlock, { capture: true, passive: true }));

  // ───────── 6 · Intro: acorde que se pliega con el menú ─────────
  function chord(sec = .8) {
    if (!on) return;
    ctx();
    let t = 0, gap = .025;
    while (t < sec) { click(2600 + Math.random() * 600, .4, t); t += gap; gap *= 1.16; }   // engranaje que se frena
    metal(160, { gain: .4, at: t + .02, dur: .2 });                                            // y la máquina se cierra
  }
  // ───────── PLAYGROUND: choque de letras (suena aunque SOUND esté apagado: es parte de la herramienta) ─────────
  let hits = 0, hitsT = 0;
  function hit(v, size = 1) {
    if (!ac || ac.state !== 'running') return;
    const now = performance.now(); if (now - hitsT > 100) { hitsT = now; hits = 0; } if (++hits > 4) return;   // como mucho 4 golpes cada 0,1 s
    const g = Math.min(.5, .08 + v * .00045);
    const f = 900 / Math.max(.4, Math.min(2.2, size)) * (.9 + Math.random() * .2);   // letras grandes más graves
    clank(f, { gain: g, dur: .09 + Math.min(.12, v * .0001) });
    if (v > 500) thump(f / 4, { gain: g * .9 });
  }
  window.RRSound = { chord, hit, unlock: () => ctx(), toggle: () => setOn(!on, 'click'), get on() { return on; } };
  if (inBuilder) { builderHooks(); return; }

  // ───────── 1 · Bloques: nota según su altura ─────────
  const BL = 10.186;
  let lastBlock = null;
  document.addEventListener('pointerover', e => {
    const b = e.target.closest && e.target.closest('.block');
    if (b === lastBlock) return; lastBlock = b;
    if (!b || !ready() || b.classList.contains('white') || document.body.classList.contains('dragging')) return;
    const lines = Math.round(b.getBoundingClientRect().height / BL);
    // pequeños agudos, grandes graves (3 · 5 · 11 · 23 · 47 líneas)
    // como una tecla o una palanca: clic + golpe; cuanto más grande, más grave y más cuerpo
    const f = lines <= 3 ? 4200 : lines <= 5 ? 3400 : lines <= 11 ? 2400 : lines <= 23 ? 1500 : 900;
    click(f, .35);
    thump(lines <= 5 ? 220 : lines <= 11 ? 160 : lines <= 23 ? 110 : 75, { gain: .18 + lines / 200, dur: .05 + lines / 900 });
  });

  // ───────── 2 · Barra del menú: trinquete en cada línea y golpe al soltar ─────────
  let lastLine = null, wasDragging = false;
  new MutationObserver(() => {
    const dragging = document.body.classList.contains('dragging');
    const lines = Math.round(parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--header-h')) / BL);
    if (dragging && ready()) {
      if (lastLine !== null && lines !== lastLine) { click(3000, .5); noise({ dur: .02, gain: .12, freq: 1800, q: 12 }); }
    }
    lastLine = lines;
  }).observe(document.documentElement, { attributes: true, attributeFilter: ['style'] });
  new MutationObserver(() => {
    const dragging = document.body.classList.contains('dragging');
    if (!dragging && wasDragging && ready()) metal(150, { gain: .42, dur: .18 });
    wasDragging = dragging;
  }).observe(document.body, { attributes: true, attributeFilter: ['class'] });

  // ───────── 3 · Caritas: tic-tac al girar ─────────
  let lastTick = Math.floor(scrollY * 0.6 / 30), tickAlt = false;
  addEventListener('scroll', () => {
    const k = Math.floor(scrollY * 0.6 / 30);       // un tic cada 30° de giro
    if (k === lastTick) return; lastTick = k;
    if (!ready() || !document.querySelector('.smiley')) return;
    tickAlt = !tickAlt;
    click(tickAlt ? 4200 : 3100, .4);
    noise({ dur: .015, gain: .08, freq: tickAlt ? 2600 : 2200, q: 25 });                // diente del engranaje
  }, { passive: true });

  // ───────── 4 · Probador: cada letra suena según su peso y su anchura ─────────
  const mctx = document.createElement('canvas').getContext('2d');
  const WEIGHT = [['thin', 100], ['hair', 100], ['light', 300], ['book', 400], ['regular', 400], ['medium', 500], ['semi', 600], ['bold', 700], ['extra', 800], ['black', 900], ['heavy', 900]];
  document.addEventListener('beforeinput', e => {
    const t = e.target; if (!t.classList || !t.classList.contains('tester-text') || !e.data || !ready()) return;
    const ch = [...e.data].pop(), cs = getComputedStyle(t);
    mctx.font = `100px ${cs.fontFamily}`;
    const w = mctx.measureText(ch).width / 100;                       // anchura (0.2 estrecha · 1 ancha)
    const name = ((t.closest('section') || document).querySelector('.wn') || {}).textContent || '';
    const wt = (WEIGHT.find(([k]) => name.toLowerCase().includes(k)) || [0, 400])[1];
    const italic = /italic/i.test(name);
    const i = Math.max(0, Math.min(14, Math.round(14 - w * 12)));      // estrecha = aguda
    // como una máquina de escribir: el peso da el golpe, la anchura el tono del metal
    const f = 1200 + (14 - i) * -60 + i * 180;
    click(f * 2, .3 + wt / 2500);
    thump(90 + i * 6, { gain: .15 + wt / 1800, dur: .04 + wt / 20000 });
    noise({ dur: .03, gain: .06 + wt / 9000, freq: f, q: italic ? 6 : 14 });
    if (ch === ' ') { thump(70, { gain: .35, dur: .08 }); noise({ dur: .05, gain: .12, freq: 600, q: 1 }); }
  });

  // ───────── 6 · intro (cuando el menú se pliega solo al principio) ─────────
  let introDone = false;
  const startH = () => parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--header-h')) || 0;
  const h0 = startH();
  const iv = setInterval(() => {
    if (introDone) return clearInterval(iv);
    if (startH() < h0 - BL * 4) { introDone = true; clearInterval(iv); if (ready()) chord(.8); }
  }, 60);
  setTimeout(() => clearInterval(iv), 6000);

  // ───────── 5 · Builder: sonido dentro del iframe ─────────
  function builderHooks() {
    const D = () => window.RR && RR.debug;
    const BASE = { A: 330, B: 247, C: 392, D: 196, E: 294, F: 262 };   // cada tipo de pieza, su metal
    const sectionOf = t => (typeof PIECES !== 'undefined' && (PIECES.find(p => p.id === t) || {}).section) || 'A';
    let snap = null;
    const take = () => { const d = D(); return d ? JSON.stringify(d.glyphs[d.current] || []) : ''; };
    function check() {
      const now = take();
      if (snap !== null && now !== snap && ready()) {
        const a = JSON.parse(snap || '[]'), b = JSON.parse(now || '[]');
        const moved = b.filter(p => !a.some(q => q.u === p.u && q.x === p.x && q.y === p.y && q.m.join() === p.m.join()));
        if (moved.length) { click(5000, .35); metal(BASE[sectionOf(moved[0].t)] * 2, { gain: .32, dur: .12 }); }
        else if (b.length < a.length) { thump(80, { gain: .3 }); noise({ dur: .06, gain: .2, freq: 700, q: 1 }); }
      }
      snap = now;
    }
    setTimeout(() => { snap = take(); }, 500);
    addEventListener('pointerup', () => setTimeout(check, 30), true);
    addEventListener('keyup', () => setTimeout(check, 30), true);
    addEventListener('click', () => setTimeout(check, 30), true);

    // tocar la letra como una partitura: de izquierda a derecha, la altura de cada pieza es su nota
    const st = document.createElement('style');
    st.textContent = `.play-btn { position: absolute; left: calc(var(--bl) * 2 + var(--half)); bottom: var(--bl); width: var(--half); --h: 4; z-index: 3; color: var(--dim); }
      .play-btn:hover, .play-btn.on { color: var(--ink); } .play-btn svg { width: 12px; height: 14px; }`;
    document.head.appendChild(st);
    const ws = document.getElementById('ws');
    const pb = document.createElement('button');
    pb.className = 'm play-btn t2'; pb.title = 'Play this glyph (sound on)';
    pb.innerHTML = '<svg viewBox="0 0 12 14"><path d="M1 1v12l10-6z" fill="currentColor"/></svg>';
    ws.appendChild(pb);
    pb.addEventListener('click', e => {
      e.stopPropagation();
      if (!on) { RR.toast && RR.toast('Turn SOUND ON in the menu'); return; }
      const d = D(); const g = (d && d.glyphs[d.current]) || [];
      if (!g.length) { RR.toast && RR.toast('Nothing to play yet'); return; }
      const xs = g.map(p => p.x), ys = g.map(p => p.y);
      const x0 = Math.min(...xs), y0 = Math.min(...ys), y1 = Math.max(...ys), P = 30.558;
      pb.classList.add('on');
      let end = 0;
      [...g].sort((a, b) => a.x - b.x).forEach(p => {
        const at = (p.x - x0) / P * .14;
        const i = Math.round((y1 - p.y) / P);                         // más arriba = más agudo
        clank(note(i + 6, BASE[sectionOf(p.t)] / 2), { gain: .3, at, dur: .12 }); click(4500, .25, at);
        end = Math.max(end, at);
      });
      setTimeout(() => pb.classList.remove('on'), (end + .8) * 1000);
    });
  }
})();
