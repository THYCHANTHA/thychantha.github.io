/*
 * python-cursor.js - site-wide python that follows the mouse on every page.
 *  - Move: a scaled python (head with eye, tapering body, glowing yellow trail) slithers after the cursor.
 *  - Hold (mouse down): it coils around the cursor, longer and thicker.
 *  - Fades when the mouse is idle (so reading isn't disturbed) and steps aside over the hero portrait,
 *    which has its own chrome version (hero-python.js).
 * Desktop pointers only; skipped for touch and prefers-reduced-motion. Plain WebGL, no libraries.
 */
(function () {
  'use strict';

  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  var fine = window.matchMedia('(hover: hover) and (pointer: fine)');
  // Desktop only, checked live: small windows, tablets and phones (also in "desktop site" or device-emulation mode) never show it.
  function enabled() { return fine.matches && window.innerWidth >= 1024; }
  if (!fine.matches) return; // real touch devices never load it

  var canvas = document.createElement('canvas');
  canvas.setAttribute('aria-hidden', 'true');
  canvas.className = 'python-cursor';
  var gl = canvas.getContext('webgl', { alpha: true, premultipliedAlpha: true, antialias: true });
  if (!gl) return;

  var N = 26;

  var VERT = 'attribute vec2 aPos; void main(){ gl_Position = vec4(aPos, 0.0, 1.0); }';

  var FRAG = [
    '#ifdef GL_FRAGMENT_PRECISION_HIGH',
    'precision highp float;',
    '#else',
    'precision mediump float;',
    '#endif',
    'uniform vec3 uPts[' + N + '];',
    'uniform vec2 uHeadDir; uniform float uTime, uVis, uWrap, uSpace;',
    'float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }',
    'float vnoise(vec2 p){',
    '  vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);',
    '  return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), f.x), mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), f.x), f.y);',
    '}',
    'void main(){',
    '  vec2 p = gl_FragCoord.xy;',
    '  float dmin = 1e9, uAt = 0.0, vAt = 0.0, rAt = 1.0;',
    '  for (int i = 0; i < ' + (N - 1) + '; i++) {',
    '    vec3 A = uPts[i]; vec3 B = uPts[i + 1]; if (B.z <= 0.0) continue;',
    '    vec2 ab = B.xy - A.xy; vec2 ap = p - A.xy;',
    '    float h = clamp(dot(ap, ab) / max(dot(ab, ab), 1e-4), 0.0, 1.0);',
    '    float r = mix(A.z, B.z, h);',
    '    float nd = length(ap - ab * h) / r;',
    '    if (nd < dmin) { dmin = nd; uAt = float(i) + h; rAt = r; vAt = sign(ab.x * ap.y - ab.y * ap.x) * nd; }',
    '  }',
    '  if (dmin > 6.0) { gl_FragColor = vec4(0.0); return; }',
    '  float tube = (1.0 - smoothstep(0.88, 1.0, dmin)) * uVis;',
    '  float tail = uAt / ' + (N - 1).toFixed(1) + ';',
    '  float v = clamp(vAt, -1.0, 1.0); float nz = sqrt(max(1.0 - v * v, 0.0));',
    '  float along = uAt * uSpace;',
    '  float chev = fract(along / (rAt * 2.7) + abs(v) * 0.55);',
    '  float yel = smoothstep(0.46, 0.54, chev) * (1.0 - smoothstep(0.93, 0.99, chev));',
    '  vec3 skin = mix(vec3(0.13, 0.36, 0.78), vec3(0.98, 0.80, 0.10), yel);',
    '  float su = along / (rAt * 0.52); float sv = v * 2.2 + 0.5 * mod(floor(su), 2.0);',
    '  vec2 f = fract(vec2(su, sv)) - 0.5;',
    '  float edge = smoothstep(0.33, 0.56, length(f));',
    '  skin *= (1.0 - 0.52 * edge) * (0.82 + 0.28 * hash(floor(vec2(su, sv))));',
    '  float spec = pow(nz, 16.0) * 0.55 + exp(-pow((v + 0.38) / 0.13, 2.0)) * 0.55;',
    '  skin = skin * (0.30 + 0.85 * nz) + spec;',
    '  vec2 hd = normalize(uHeadDir + vec2(1e-4)); vec2 hp = vec2(-hd.y, hd.x);',
    '  vec2 e = p - (uPts[0].xy + hd * uPts[0].z * 0.18 + hp * uPts[0].z * 0.52);',
    '  float eyeD = length(e) / (uPts[0].z * 0.20);',
    '  float eyeOn = (1.0 - step(1.0, eyeD)) * step(uAt, 1.2);',
    '  skin = mix(skin, mix(vec3(0.02), vec3(0.98, 0.82, 0.15), smoothstep(0.55, 0.95, eyeD)), eyeOn);',
    '  vec3 rgb = skin * tube; float a = tube;',
    '  float fl = vnoise(p * 0.07 + vec2(uTime * 1.6, -uTime * 0.7));',
    '  float glow = exp(-max(dmin - 0.9, 0.0) * 0.95) * (0.40 + 0.7 * tail) * (0.45 + 0.9 * fl) * uVis;',
    '  glow = min(glow, 1.0) * (1.0 - tube);',
    '  rgb += vec3(1.0, 0.83, 0.18) * glow * 0.8; a = max(a, glow * 0.8);',
    '  a = max(a, max(rgb.r, max(rgb.g, rgb.b)));',
    '  gl_FragColor = vec4(rgb, a);',
    '}'
  ].join('\n');

  function compile(type, src) {
    var s = gl.createShader(type);
    gl.shaderSource(s, src); gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s));
    return s;
  }

  var prog, uni = {};
  try {
    prog = gl.createProgram();
    gl.attachShader(prog, compile(gl.VERTEX_SHADER, VERT));
    gl.attachShader(prog, compile(gl.FRAGMENT_SHADER, FRAG));
    gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) throw new Error('link');
  } catch (e) { return; }
  gl.useProgram(prog);

  var buf = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buf);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
  var aPos = gl.getAttribLocation(prog, 'aPos');
  gl.enableVertexAttribArray(aPos);
  gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 0, 0);
  ['uPts', 'uHeadDir', 'uTime', 'uVis', 'uWrap', 'uSpace'].forEach(function (n) { uni[n] = gl.getUniformLocation(prog, n); });
  gl.enable(gl.BLEND);
  gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
  gl.enable(gl.SCISSOR_TEST);

  var dpr = 1, W = 0, H = 0;
  function size() {
    dpr = Math.min(window.devicePixelRatio || 1, 1.5);
    W = Math.round(window.innerWidth * dpr); H = Math.round(window.innerHeight * dpr);
    canvas.width = W; canvas.height = H;
    gl.viewport(0, 0, W, H);
    canvas.style.display = enabled() ? '' : 'none';
    if (!enabled()) { inside = false; held = false; }
  }
  size();
  window.addEventListener('resize', size);
  document.body.appendChild(canvas);

  /* ---- state (device px, origin bottom-left) ---- */
  var pts = [], target = { x: 0, y: 0 }, mouse = { x: 0, y: 0 };
  for (var i = 0; i < N; i++) pts.push({ x: 0, y: 0 });
  var inside = false, held = false, aside = false, lastMove = 0, vis = 0, wrap = 0, wrapT = 0, space = 5;
  var data = new Float32Array(N * 3), running = false, last = 0, t0 = performance.now();

  var HERO = null;
  function overHero(e) {
    HERO = HERO && HERO.isConnected ? HERO : document.querySelector('[data-python-hero]');
    if (!HERO) return false;
    var r = HERO.getBoundingClientRect();
    return e.clientX >= r.left && e.clientX <= r.right && e.clientY >= r.top && e.clientY <= r.bottom;
  }
  function isField(el) { return el && el.closest && el.closest('input, textarea, select, [contenteditable="true"]'); }

  function onMove(e) {
    if (e.pointerType === 'touch' || !enabled()) { inside = false; held = false; return; }
    var x = e.clientX * dpr, y = (window.innerHeight - e.clientY) * dpr;
    if (!inside) { for (var k = 0; k < N; k++) { pts[k].x = x; pts[k].y = y; } inside = true; }
    mouse.x = x; mouse.y = y; lastMove = performance.now();
    aside = overHero(e);
    schedule();
  }
  document.addEventListener('pointermove', onMove, { passive: true });
  document.addEventListener('pointerdown', function (e) {
    if (e.pointerType === 'touch' || !enabled() || e.button !== 0 || isField(e.target)) return;
    held = true; onMove(e);
  }, { passive: true });
  window.addEventListener('pointerup', function () { held = false; schedule(); });
  window.addEventListener('pointercancel', function () { held = false; schedule(); });
  document.documentElement.addEventListener('mouseleave', function () { inside = false; held = false; schedule(); });
  window.addEventListener('blur', function () { held = false; });

  function ease(cur, goal, k, dt) { return cur + (goal - cur) * (1 - Math.pow(k, dt)); }

  function step(now) {
    running = false;
    if (document.hidden) return;
    var dt = Math.min(0.05, (now - (last || now)) / 1000); last = now;
    var t = (now - t0) / 1000;
    var recentlyMoved = now - lastMove < 2600;
    var show = inside && !aside && (recentlyMoved || held);

    vis = ease(vis, show ? 1 : 0, 0.006, dt);
    wrap = ease(wrap, held ? 1 : 0, 0.02, dt);
    if (held) wrapT += dt;

    if (held) { // coil around the pointer
      var a = wrapT * 4.2, rr = dpr * (34 + 44 * wrap);
      target.x = mouse.x + Math.cos(a) * rr;
      target.y = mouse.y + Math.sin(a) * rr * 0.8 + Math.sin(a * 0.5) * rr * 0.5;
    } else { target.x = mouse.x; target.y = mouse.y; }

    var follow = 1 - Math.pow(held ? 0.02 : 0.0006, dt);
    pts[0].x += (target.x - pts[0].x) * follow;
    pts[0].y += (target.y - pts[0].y) * follow;

    space = dpr * (5.8 + 4.6 * wrap);
    for (var i = 1; i < N; i++) {
      var A = pts[i - 1], B = pts[i];
      var dx = B.x - A.x, dy = B.y - A.y, d = Math.sqrt(dx * dx + dy * dy) || 1;
      var wob = Math.sin(t * 5 - i * 0.55) * space * 0.20;
      B.x = A.x + (dx / d) * space + (-dy / d) * wob;
      B.y = A.y + (dy / d) * space + (dx / d) * wob;
    }

    var R = dpr * (12.5 + 6 * wrap), minX = 1e9, minY = 1e9, maxX = -1e9, maxY = -1e9;
    for (var k = 0; k < N; k++) {
      var tt = k / (N - 1);
      var rad = k === 0 ? 0.80 : k === 1 ? 1.08 : k === 2 ? 1.04 : 0.26 + 0.78 * Math.pow(1 - tt, 0.8);
      data[k * 3] = pts[k].x; data[k * 3 + 1] = pts[k].y; data[k * 3 + 2] = vis < 0.004 ? 0 : R * rad;
      minX = Math.min(minX, pts[k].x); maxX = Math.max(maxX, pts[k].x);
      minY = Math.min(minY, pts[k].y); maxY = Math.max(maxY, pts[k].y);
    }

    gl.disable(gl.SCISSOR_TEST);
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT);
    if (vis >= 0.004) {
      // only shade the box around the snake (plus its glow), not the whole viewport
      var m = R * 6;
      var sx = Math.max(0, Math.floor(minX - m)), sy = Math.max(0, Math.floor(minY - m));
      var sw = Math.min(W, Math.ceil(maxX + m)) - sx, sh = Math.min(H, Math.ceil(maxY + m)) - sy;
      if (sw > 0 && sh > 0) {
        gl.enable(gl.SCISSOR_TEST);
        gl.scissor(sx, sy, sw, sh);
        gl.uniform3fv(uni.uPts, data);
        gl.uniform2f(uni.uHeadDir, pts[0].x - pts[3].x, pts[0].y - pts[3].y);
        gl.uniform1f(uni.uTime, t);
        gl.uniform1f(uni.uVis, vis);
        gl.uniform1f(uni.uWrap, wrap);
        gl.uniform1f(uni.uSpace, space);
        gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
      }
    }
    if (show || vis >= 0.004) schedule();
  }
  function schedule() { if (!running) { running = true; requestAnimationFrame(step); } }
  document.addEventListener('visibilitychange', function () { if (!document.hidden) { last = 0; schedule(); } });
})();
