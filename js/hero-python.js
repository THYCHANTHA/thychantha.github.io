/*
 * hero-python.js - interactive hero portrait (two-image reveal).
 *  - Base layer: the normal portrait.  Reveal layer: the same portrait as a chrome statue with a real python
 *    coiled around it (images/hero-chrome.webp, aligned to the base).
 *  - Hover: a glowing, flickering lens shaped like a slithering snake follows the pointer and reveals the
 *    chrome layer wherever it passes.
 *  - Hold (pointer down): the lens sweeps over the whole figure, revealing the full chrome + python image.
 *  - On load an automatic intro plays: the snake slithers up the body from the feet in coils, wraps the whole
 *    figure at the top, then fades back to the normal portrait, so visitors see the effect without interacting.
 * Plain WebGL, no libraries. Falls back to the static <img> if WebGL, the chrome image or motion is unavailable.
 */
(function () {
  'use strict';

  var frame = document.querySelector('[data-python-hero]');
  if (!frame) return;
  var img = frame.querySelector('img');
  var chromeSrc = frame.getAttribute('data-chrome');
  if (!img || !chromeSrc) return;
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

  var canvas = document.createElement('canvas');
  canvas.setAttribute('aria-hidden', 'true');
  canvas.className = 'python-canvas';
  var gl = canvas.getContext('webgl', { alpha: true, premultipliedAlpha: true, antialias: true });
  if (!gl) return;

  var N = 28; // joints of the slithering lens

  var VERT = 'attribute vec2 aPos; void main(){ gl_Position = vec4(aPos, 0.0, 1.0); }';

  var FRAG = [
    '#ifdef GL_FRAGMENT_PRECISION_HIGH',
    'precision highp float;',
    '#else',
    'precision mediump float;',
    '#endif',
    'uniform sampler2D uTex; uniform sampler2D uTex2; uniform vec4 uRect;',
    'uniform vec3 uPts[' + N + '];',
    'uniform float uTime, uLens, uVis;',
    'float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }',
    'float vnoise(vec2 p){',
    '  vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);',
    '  return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), f.x), mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), f.x), f.y);',
    '}',
    'void main(){',
    '  vec2 p = gl_FragCoord.xy;',
    '  vec2 uv = (p - uRect.xy) / uRect.zw;',
    '  vec4 base = vec4(0.0), chr = vec4(0.0);',
    '  if (uv.x >= 0.0 && uv.x <= 1.0 && uv.y >= 0.0 && uv.y <= 1.0) { base = texture2D(uTex, uv); chr = texture2D(uTex2, uv); }',
    '  vec3 rgb = base.rgb; float a = base.a;',
    '  if (uVis > 0.003) {',
    '    float field = 0.0;',
    '    for (int i = 0; i < ' + N + '; i++) {',
    '      vec3 s = uPts[i]; if (s.z <= 0.0) continue;',
    '      vec2 d = p - s.xy; float R = s.z * uLens;',
    '      float q = max(1.0 - dot(d, d) / (R * R), 0.0); field += q * q;',
    '    }',
    '    float n1 = vnoise(p * 0.045 + vec2(uTime * 1.4, -uTime * 0.6));',
    '    float n2 = vnoise(p * 0.11 + vec2(-uTime * 2.1, uTime * 0.9));',
    '    float fN = field + (n1 - 0.5) * 0.10;',               // ragged, flickering edge
    '    float lens = smoothstep(0.25, 0.37, fN) * uVis;',
    '    float rim = smoothstep(0.17, 0.26, fN) * (1.0 - smoothstep(0.28, 0.40, fN)) * uVis;',
    '    float halo = smoothstep(0.02, 0.25, fN) * (1.0 - lens) * uVis * (0.5 + 0.8 * n2);',
    '    rgb = base.rgb * (1.0 - lens) + chr.rgb * lens;',
    '    a = base.a * (1.0 - lens) + chr.a * lens;',
    '    float g = halo * 0.55 + rim * (0.55 + 0.6 * n2);',
    '    rgb += vec3(1.0, 0.83, 0.20) * g; a = max(a, min(g, 1.0));',
    '    a = max(a, max(rgb.r, max(rgb.g, rgb.b)));',
    '  }',
    '  gl_FragColor = vec4(rgb, a);',
    '}'
  ].join('\n');

  function compile(type, src) {
    var s = gl.createShader(type);
    gl.shaderSource(s, src); gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s));
    return s;
  }

  var prog, uni = {}, tex1, tex2, rect = { x: 0, y: 0, w: 1, h: 1 }, dpr = 1, W = 0, H = 0, chrome;
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
  ['uRect', 'uTex', 'uTex2', 'uPts', 'uTime', 'uLens', 'uVis'].forEach(function (n) { uni[n] = gl.getUniformLocation(prog, n); });
  gl.enable(gl.BLEND);
  gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);

  /* ---- state (pixel space, origin bottom-left) ---- */
  var pts = [], target = { x: 0, y: 0 }, pointerIn = false, held = false, ready = false;
  var vis = 0, wrap = 0, wrapT = 0, space = 10;
  var introUntil = 0, introStart = 0, introDone = false, introWrap = 0, loaded = false, data = new Float32Array(N * 3);
  var INTRO_MS = 5200;   // overridable with data-intro-ms on the frame (used for testing)

  function upload(unit, tex, source, w, h) {
    var off = document.createElement('canvas');
    off.width = Math.max(1, Math.round(w)); off.height = Math.max(1, Math.round(h));
    var c2 = off.getContext('2d');
    c2.imageSmoothingEnabled = true; c2.imageSmoothingQuality = 'high';
    c2.drawImage(source, 0, 0, off.width, off.height);
    gl.activeTexture(gl.TEXTURE0 + unit);
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
    gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, true);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, off);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  }

  function layout() {
    var r = frame.getBoundingClientRect();
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    W = Math.max(2, Math.round(r.width * dpr)); H = Math.max(2, Math.round(r.height * dpr));
    canvas.width = W; canvas.height = H;
    gl.viewport(0, 0, W, H);
    // portrait placement mirrors the CSS: contain, bottom aligned, 93% of the frame height
    var iw = img.naturalWidth || 1000, ih = img.naturalHeight || 1374;
    var s = Math.min(W / iw, (H * 0.93) / ih);
    rect.w = iw * s; rect.h = ih * s; rect.x = (W - rect.w) / 2; rect.y = 0;
    if (!tex1) { tex1 = gl.createTexture(); tex2 = gl.createTexture(); }
    upload(0, tex1, img, rect.w, rect.h);
    upload(1, tex2, chrome, rect.w, rect.h);   // chrome layer is pre-aligned to the portrait
    if (!pts.length) for (var i = 0; i < N; i++) pts.push({ x: W * 0.5, y: H * 0.5 });
  }

  function toCanvas(e) {
    var r = frame.getBoundingClientRect();
    return { x: (e.clientX - r.left) * dpr, y: (r.bottom - e.clientY) * dpr };
  }
  function onMove(e) {
    var p = toCanvas(e);
    if (!pointerIn) { for (var i = 0; i < N; i++) { pts[i].x = p.x; pts[i].y = p.y; } }
    target.x = p.x; target.y = p.y; pointerIn = true; introUntil = 0; introDone = true; schedule();
    if (frame.parentNode) frame.parentNode.classList.add('hint-on');
  }
  frame.addEventListener('pointerenter', onMove);
  frame.addEventListener('pointermove', onMove);
  frame.addEventListener('pointerdown', function (e) { held = true; onMove(e); });
  window.addEventListener('pointerup', function () { held = false; schedule(); });
  window.addEventListener('pointercancel', function () { held = false; schedule(); });
  frame.addEventListener('pointerleave', function () { pointerIn = false; held = false; schedule(); });
  frame.addEventListener('contextmenu', function (e) { if (held) e.preventDefault(); });

  /* ---- loop ---- */
  var running = false, visible = true, last = 0, t0 = performance.now();
  function ease(cur, goal, k, dt) { return cur + (goal - cur) * (1 - Math.pow(k, dt)); }

  function step(now) {
    running = false;
    if (!pts.length || !visible || document.hidden) return;  // not laid out yet (images still loading)
    var dt = Math.min(0.05, (now - (last || now)) / 1000); last = now;
    var t = (now - t0) / 1000;
    var intro = introUntil > now;
    var active = pointerIn || held || intro;

    vis = ease(vis, active ? 1 : 0, 0.004, dt);
    wrap = ease(wrap, held ? 1 : introWrap, 0.02, dt);
    if (held) wrapT += dt;

    if (held) {                              // sweep over the whole figure, up and down
      var a = wrapT * 3.4;
      target.x = rect.x + rect.w * (0.5 + Math.cos(a) * 0.36);
      target.y = H * (0.46 + Math.sin(a * 0.30) * 0.30) + Math.sin(a) * H * 0.035;
    } else if (intro && !pointerIn) {        // scripted: slither up the body in coils, wrap, release
      var p = (now - introStart) / INTRO_MS;
      var climbEnd = 0.74;
      if (p < climbEnd) {
        var u = p / climbEnd, e = u * u * (3 - 2 * u);
        target.x = rect.x + rect.w * (0.5 + 0.36 * Math.sin(u * 3.2 * 6.2832 + 0.4) * (1 - 0.15 * u));
        target.y = rect.h * (0.04 + 0.86 * e) + Math.sin(u * 3.2 * 6.2832 * 2) * H * 0.012;
        introWrap = 0.40 + 0.25 * u;
      } else {                              // reached the head: wrap the whole figure, then let go
        var w = (p - climbEnd) / (1 - climbEnd);
        target.x = rect.x + rect.w * (0.5 + 0.30 * Math.cos(w * 6));
        target.y = rect.h * (0.78 - 0.30 * w);
        introWrap = w < 0.7 ? 1 : 0.5;
      }
    } else { introWrap = 0; }
    var follow = 1 - Math.pow(held ? 0.02 : 0.0008, dt);
    pts[0].x += (target.x - pts[0].x) * follow;
    pts[0].y += (target.y - pts[0].y) * follow;

    space = W * (0.0155 + 0.016 * wrap);
    for (var i = 1; i < N; i++) {
      var A = pts[i - 1], B = pts[i];
      var dx = B.x - A.x, dy = B.y - A.y, d = Math.sqrt(dx * dx + dy * dy) || 1;
      var wob = Math.sin(t * 4.5 - i * 0.55) * space * 0.20;
      B.x = A.x + (dx / d) * space + (-dy / d) * wob;
      B.y = A.y + (dy / d) * space + (dx / d) * wob;
    }

    var R = W * 0.050 * (1 + 0.55 * wrap);
    for (var k = 0; k < N; k++) {
      var tt = k / (N - 1);
      var rad = k === 0 ? 0.80 : k === 1 ? 1.08 : k === 2 ? 1.04 : 0.26 + 0.78 * Math.pow(1 - tt, 0.8);
      data[k * 3] = pts[k].x; data[k * 3 + 1] = pts[k].y;
      data[k * 3 + 2] = vis < 0.003 ? 0 : R * rad;
    }

    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.uniform4f(uni.uRect, rect.x, rect.y, rect.w, rect.h);
    gl.uniform1i(uni.uTex, 0);
    gl.uniform1i(uni.uTex2, 1);
    gl.uniform3fv(uni.uPts, data);
    gl.uniform1f(uni.uTime, t);
    gl.uniform1f(uni.uLens, 2.1 + 5.6 * wrap);
    gl.uniform1f(uni.uVis, vis);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);

    if (!ready) { ready = true; frame.classList.add('gl-on'); }
    if (active || vis > 0.003) schedule();
  }
  function schedule() { if (!running) { running = true; requestAnimationFrame(step); } }

  function start() {
    layout();
    frame.appendChild(canvas);
    last = 0; schedule();
    loaded = true;
    // play the intro once the page has settled (and the hero is on screen)
    if (document.readyState === 'complete') setTimeout(maybeIntro, 600);
    else window.addEventListener('load', function () { setTimeout(maybeIntro, 600); }, { once: true });
  }

  function maybeIntro() {
    if (introDone || !loaded || !visible || pointerIn || !pts.length) return;
    introDone = true;
    var sx = rect.x + rect.w * 0.5 + rect.w * 0.36 * Math.sin(0.4), sy = rect.h * 0.04;
    for (var i = 0; i < N; i++) { pts[i].x = sx; pts[i].y = sy; }   // emerge from the feet
    target.x = sx; target.y = sy;
    INTRO_MS = parseInt(frame.getAttribute('data-intro-ms'), 10) || INTRO_MS;
    introStart = performance.now(); introUntil = introStart + INTRO_MS; last = 0;
    setTimeout(function () { var f = frame.parentNode; if (f) f.classList.add('hint-on'); }, INTRO_MS - 300);
    schedule();
  }

  if ('IntersectionObserver' in window) {
    new IntersectionObserver(function (en) {
      visible = en[0].isIntersecting;
      if (visible) { last = 0; schedule(); maybeIntro(); }
    }, { threshold: 0.4 }).observe(frame);
  }
  document.addEventListener('visibilitychange', function () { if (!document.hidden) { last = 0; schedule(); } });

  var rz, lastW = 0, lastH = 0;
  function relayout() {
    var r = frame.getBoundingClientRect();
    if (Math.abs(r.width - lastW) < 1 && Math.abs(r.height - lastH) < 1) return;
    lastW = r.width; lastH = r.height;
    layout(); schedule();
  }
  if ('ResizeObserver' in window) {
    new ResizeObserver(function () { clearTimeout(rz); rz = setTimeout(function () { if (ready) relayout(); }, 60); }).observe(frame);
  } else {
    window.addEventListener('resize', function () { clearTimeout(rz); rz = setTimeout(function () { if (ready) relayout(); }, 150); });
  }

  // wait for both images, then start; if the chrome image fails the static portrait simply stays
  var pending = 2;
  function done() { if (--pending === 0) start(); }
  if (img.complete && img.naturalWidth) done(); else img.addEventListener('load', done, { once: true });
  chrome = new Image();
  chrome.onload = done;
  chrome.src = chromeSrc;
})();
