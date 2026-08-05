/* ==========================================================================
   KBS Media Video Maker — frame renderer
   --------------------------------------------------------------------------
   Composites two layers (titles + media) onto an offscreen canvas, then runs
   the frame through a tape/camera filter chain built entirely from 2D canvas
   composite ops and `ctx.filter` — no per-pixel JS loops, so it holds 30fps
   at 1280×720 in a browser tab while it is also recording.
   ========================================================================== */

import { withAlpha, filterById } from './eras.js';

/* ---------- small maths ---------- */
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const easeOutCubic = p => 1 - Math.pow(1 - p, 3);
const easeInCubic = p => p * p * p;
const easeOutBack = (p, s = 1.7) => 1 + (s + 1) * Math.pow(p - 1, 3) + s * Math.pow(p - 1, 2);
const easeInOut = p => p < .5 ? 4 * p * p * p : 1 - Math.pow(-2 * p + 2, 3) / 2;

function mulberry32(a) {
  return function () {
    a |= 0; a = a + 0x6D2B79F5 | 0;
    let t = Math.imul(a ^ a >>> 15, 1 | a);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}

/* ---------- tracked (letter-spaced) text ---------- */
function layoutChars(ctx, text, trackPx) {
  const chars = [];
  let x = 0;
  for (const ch of Array.from(text)) {
    const w = ctx.measureText(ch).width;
    chars.push({ ch, x, w });
    x += w + trackPx;
  }
  return { chars, width: Math.max(0, x - (text.length ? trackPx : 0)) };
}

function drawTracked(ctx, text, cx, y, trackPx, align, perChar) {
  const { chars, width } = layoutChars(ctx, text, trackPx);
  let x0 = cx;
  if (align === 'center') x0 = cx - width / 2;
  else if (align === 'right') x0 = cx - width;
  chars.forEach((c, i) => {
    if (perChar) {
      ctx.save();
      const r = perChar(i, chars.length, c);
      if (r === false) { ctx.restore(); return; }
      ctx.fillText(c.ch, x0 + c.x, y);
      ctx.restore();
    } else {
      ctx.fillText(c.ch, x0 + c.x, y);
    }
  });
  return width;
}

/* Shrink the font until the string fits `maxW`. */
function fitFont(ctx, text, maxW, size, weight, family, track) {
  let s = size;
  for (let i = 0; i < 40; i++) {
    ctx.font = `${weight} ${s}px ${family}`;
    const w = layoutChars(ctx, text, s * track).width;
    if (w <= maxW || s <= 12) break;
    s *= Math.max(.86, maxW / w);
  }
  ctx.font = `${weight} ${s}px ${family}`;
  return s;
}

function applyShadow(ctx, sh) {
  if (!sh || (!sh.blur && !sh.x && !sh.y)) { ctx.shadowColor = 'transparent'; ctx.shadowBlur = 0; ctx.shadowOffsetX = 0; ctx.shadowOffsetY = 0; return; }
  ctx.shadowColor = sh.color; ctx.shadowBlur = sh.blur; ctx.shadowOffsetX = sh.x; ctx.shadowOffsetY = sh.y;
}
function clearShadow(ctx) { ctx.shadowColor = 'transparent'; ctx.shadowBlur = 0; ctx.shadowOffsetX = 0; ctx.shadowOffsetY = 0; }

function roundRect(ctx, x, y, w, h, r) {
  const rr = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + rr, y);
  ctx.arcTo(x + w, y, x + w, y + h, rr);
  ctx.arcTo(x + w, y + h, x, y + h, rr);
  ctx.arcTo(x, y + h, x, y, rr);
  ctx.arcTo(x, y, x + w, y, rr);
  ctx.closePath();
}

/* ==========================================================================
   Animation envelope
   Returns how "present" a clip is, plus the raw in/out progress an individual
   preset can use for direction-dependent motion.
   ========================================================================== */
function envelope(local, dur, st) {
  const s = 1 / (st.motion.speed || 1);
  const inDur = Math.min(0.85 * s, dur * 0.34);
  const outDur = Math.min(0.65 * s, dur * 0.30);
  const inP = inDur <= 0 ? 1 : clamp(local / inDur, 0, 1);
  const outP = outDur <= 0 ? 0 : clamp((local - (dur - outDur)) / outDur, 0, 1);
  return { inP, outP, alpha: Math.min(inP, 1 - outP), s };
}

/* ==========================================================================
   Text presets — each era's title move
   Every preset receives a draw() callback so the same layout code is reused
   across all eight looks; the preset only decides transform / clip / alpha.
   ========================================================================== */
function runPreset(ctx, preset, env, st, box, draw) {
  const { inP, outP } = env;
  const a = Math.min(easeOutCubic(inP), 1 - easeInCubic(outP));
  const os = st.motion.overshoot || 1;

  switch (preset) {
    case 'fadeHold': {
      ctx.globalAlpha *= a;
      draw();
      break;
    }
    case 'wipeH': {
      // gold era — a hard left→right reveal, closing right→left on exit
      ctx.save();
      const w = box.w * easeInOut(inP);
      const off = box.w * easeInOut(outP);
      ctx.beginPath();
      ctx.rect(box.x + off, box.y, Math.max(0, w - off), box.h);
      ctx.clip();
      draw();
      ctx.restore();
      break;
    }
    case 'slidePlate': {
      const dx = (1 - easeOutCubic(inP)) * -box.w * 0.35 + easeInCubic(outP) * box.w * 0.35;
      ctx.save();
      ctx.translate(dx, 0);
      ctx.globalAlpha *= a;
      draw();
      ctx.restore();
      break;
    }
    case 'glowDissolve': {
      ctx.save();
      ctx.globalAlpha *= a;
      const g = (1 - easeOutCubic(inP)) * 26;
      if (g > .5) { ctx.shadowColor = withAlpha(st.pal.accent, .9); ctx.shadowBlur = g; }
      draw();
      ctx.restore();
      break;
    }
    case 'blurIn': {
      ctx.save();
      const b = (1 - easeOutCubic(inP)) * 14 + easeInCubic(outP) * 10;
      if (b > .4) ctx.filter = `blur(${b.toFixed(2)}px)`;
      ctx.globalAlpha *= a;
      const sc = 1 + (1 - easeOutCubic(inP)) * 0.04;
      ctx.translate(box.x + box.w / 2, box.y + box.h / 2);
      ctx.scale(sc, sc);
      ctx.translate(-(box.x + box.w / 2), -(box.y + box.h / 2));
      draw();
      ctx.restore();
      break;
    }
    case 'maskWipe': {
      ctx.save();
      const h = box.h * easeInOut(inP);
      ctx.beginPath();
      ctx.rect(box.x, box.y + (box.h - h) / 2, box.w, h);
      ctx.clip();
      ctx.globalAlpha *= (1 - easeInCubic(outP));
      draw();
      ctx.restore();
      break;
    }
    case 'kineticPop': {
      ctx.save();
      const sc = inP < 1 ? easeOutBack(inP, 1.9 * os) : 1;
      const fall = easeInCubic(outP);
      ctx.globalAlpha *= (1 - fall);
      ctx.translate(box.x + box.w / 2, box.y + box.h / 2);
      ctx.scale(clamp(sc, .01, 3), clamp(sc, .01, 3));
      ctx.translate(0, fall * box.h * .5);
      ctx.translate(-(box.x + box.w / 2), -(box.y + box.h / 2));
      draw();
      ctx.restore();
      break;
    }
    case 'springStack': {
      ctx.save();
      const y = (1 - easeOutBack(inP, 1.2 * os)) * 34 + easeInCubic(outP) * -18;
      ctx.globalAlpha *= a;
      ctx.translate(0, y);
      draw();
      ctx.restore();
      break;
    }
    default: {
      ctx.globalAlpha *= a;
      draw();
    }
  }
}

/* ==========================================================================
   Layout blocks
   ========================================================================== */
function titleFill(ctx, st, x, y, w, h) {
  if (st.gradient) {
    const g = ctx.createLinearGradient(0, y - h * .6, 0, y + h * .35);
    st.gradient.forEach((c, i) => g.addColorStop(i / (st.gradient.length - 1), c));
    return g;
  }
  return st.pal.fg;
}

function drawPlate(ctx, st, x, y, w, h) {
  switch (st.plate) {
    case 'gradient': {
      const g = ctx.createLinearGradient(x, y, x, y + h);
      g.addColorStop(0, withAlpha('#1a5fb4', .92));
      g.addColorStop(1, withAlpha('#062a58', .95));
      ctx.fillStyle = g;
      ctx.fillRect(x, y, w, h);
      ctx.fillStyle = withAlpha(st.pal.accent, .95);
      ctx.fillRect(x, y + h - 3, w, 3);
      break;
    }
    case 'soft': {
      ctx.fillStyle = st.pal.plate;
      roundRect(ctx, x, y, w, h, 6); ctx.fill();
      break;
    }
    case 'rule': {
      ctx.fillStyle = withAlpha(st.pal.rule, .55);
      ctx.fillRect(x, y + h - 1, w, 1);
      break;
    }
    case 'flat': {
      ctx.fillStyle = st.pal.plate;
      ctx.fillRect(x, y, w, h);
      ctx.fillStyle = st.pal.accent;
      ctx.fillRect(x, y, 4, h);
      break;
    }
    case 'accent': {
      ctx.fillStyle = st.pal.plate;
      roundRect(ctx, x, y, w, h, 4); ctx.fill();
      break;
    }
    case 'glass': {
      ctx.fillStyle = withAlpha('#ffffff', .06);
      roundRect(ctx, x, y, w, h, 14); ctx.fill();
      ctx.strokeStyle = withAlpha('#ffffff', .14); ctx.lineWidth = 1;
      roundRect(ctx, x + .5, y + .5, w - 1, h - 1, 14); ctx.stroke();
      break;
    }
  }
}

function drawRule(ctx, st, cx, y, w) {
  ctx.save();
  clearShadow(ctx);
  ctx.fillStyle = st.pal.rule;
  switch (st.rule) {
    case 'double':
      ctx.fillRect(cx - w / 2, y, w, 2);
      ctx.fillRect(cx - w / 2, y + 5, w, 1);
      break;
    case 'thick':
      ctx.fillRect(cx - w / 2, y, w, 5);
      break;
    case 'hair':
      ctx.globalAlpha *= .6;
      ctx.fillRect(cx - w / 2, y, w, 1);
      break;
    default:
      ctx.fillRect(cx - w / 2, y, w, 2);
  }
  ctx.restore();
}

/* ---- individual clip painters ------------------------------------------ */

function paintIdent(ctx, clip, st, W, H, env) {
  const cx = W / 2, cy = H / 2;
  const box = { x: W * .1, y: cy - H * .16, w: W * .8, h: H * .32 };
  runPreset(ctx, 'fadeHold', env, st, box, () => {
    ctx.textBaseline = 'alphabetic';
    applyShadow(ctx, st.type.shadow);

    const s2 = fitFont(ctx, clip.line2 || '', W * .5, H * .045, st.weights.body, st.fonts.body, st.type.track + .12);
    ctx.fillStyle = st.pal.sub;
    drawTracked(ctx, clip.line2 || '', cx, cy - H * .06, s2 * (st.type.track + .12), 'center');

    const s1 = fitFont(ctx, clip.line1 || '', W * .74, H * .085, st.weights.display, st.fonts.display, st.type.track);
    ctx.fillStyle = titleFill(ctx, st, cx, cy + H * .04, W * .74, s1);
    drawTracked(ctx, clip.line1 || '', cx, cy + H * .045, s1 * st.type.track, 'center');

    clearShadow(ctx);
    drawRule(ctx, st, cx, cy + H * .085, Math.min(W * .34, 320));
  });
}

function paintCard(ctx, clip, st, W, H, env) {
  const cx = W / 2, cy = H * .5;
  const box = { x: W * .06, y: cy - H * .26, w: W * .88, h: H * .52 };

  runPreset(ctx, st.anim.card, env, st, box, () => {
    ctx.textBaseline = 'alphabetic';

    // kicker
    if (clip.kicker) {
      applyShadow(ctx, st.type.shadow);
      const ks = fitFont(ctx, clip.kicker, W * .6, H * .038, st.weights.body, st.fonts.caption, st.type.track + .18);
      ctx.fillStyle = st.pal.accent;
      drawTracked(ctx, clip.kicker, cx, cy - H * .17, ks * (st.type.track + .18), 'center');
    }

    // title — the one place per-character motion is worth the cost
    applyShadow(ctx, st.type.shadow);
    const ts = fitFont(ctx, clip.title || '', W * .82, H * .17 * st.type.titleScale, st.weights.display, st.fonts.display, st.type.track);
    ctx.fillStyle = titleFill(ctx, st, cx, cy, W * .82, ts);
    const stagger = st.motion.stagger;
    const tw = drawTracked(ctx, clip.title || '', cx, cy + ts * .32, ts * st.type.track, 'center',
      stagger > 0 ? (i, n) => {
        const d = clamp((env.inP - i * stagger) / Math.max(.08, 1 - n * stagger * .5), 0, 1);
        ctx.globalAlpha *= easeOutCubic(d);
        ctx.translate(0, (1 - easeOutBack(d, 1.4)) * ts * .22);
      } : null);

    clearShadow(ctx);
    if (st.rule !== 'none') drawRule(ctx, st, cx, cy + ts * .62, Math.min(Math.max(tw * .9, 160), W * .7));

    // subtitle
    if (clip.sub) {
      applyShadow(ctx, st.type.shadow);
      const ss = fitFont(ctx, clip.sub, W * .7, H * .052, st.weights.body, st.fonts.body, st.type.track + .06);
      ctx.fillStyle = st.pal.sub;
      drawTracked(ctx, clip.sub, cx, cy + ts * .62 + H * .085, ss * (st.type.track + .06), 'center');
    }
  });
}

function paintEp(ctx, clip, st, W, H, env) {
  const cx = W / 2, cy = H * .5;
  const box = { x: W * .1, y: cy - H * .2, w: W * .8, h: H * .4 };
  const label = `${clip.epLabelPre || '제'} ${clip.epNo} ${clip.epLabelPost || '화'}`;

  runPreset(ctx, st.anim.episode, env, st, box, () => {
    ctx.textBaseline = 'alphabetic';
    applyShadow(ctx, st.type.shadow);
    const ls = fitFont(ctx, label, W * .6, H * .11, st.weights.display, st.fonts.display, st.type.track + .05);
    ctx.fillStyle = titleFill(ctx, st, cx, cy, W * .6, ls);
    drawTracked(ctx, label, cx, cy - H * .01, ls * (st.type.track + .05), 'center');

    clearShadow(ctx);
    drawRule(ctx, st, cx, cy + H * .035, Math.min(W * .3, 280));

    if (clip.epTitle) {
      applyShadow(ctx, st.type.shadow);
      const es = fitFont(ctx, clip.epTitle, W * .78, H * .072, st.weights.body, st.fonts.body, st.type.track + .04);
      ctx.fillStyle = st.pal.fg;
      drawTracked(ctx, clip.epTitle, cx, cy + H * .13, es * (st.type.track + .04), 'center');
    }
  });
}

function paintLower(ctx, clip, st, W, H, env) {
  const leftAlign = clip.align === 'left';
  const padX = W * .085;
  const barH = H * .155;
  const y = H * .70;
  const bx = leftAlign ? padX : W * .17;
  const bw = leftAlign ? W * .5 : W * .66;
  const box = { x: bx, y, w: bw, h: barH };

  runPreset(ctx, st.anim.lower, env, st, box, () => {
    drawPlate(ctx, st, bx, y, bw, barH);
    ctx.textBaseline = 'alphabetic';
    const cx = leftAlign ? bx + W * .022 : W / 2;
    const al = leftAlign ? 'left' : 'center';

    applyShadow(ctx, st.type.shadow);
    const rs = fitFont(ctx, clip.role || '', bw * .8, H * .04, st.weights.body, st.fonts.caption, st.type.track + .16);
    ctx.fillStyle = st.pal.accent;
    drawTracked(ctx, clip.role || '', cx, y + barH * .36, rs * (st.type.track + .16), al);

    applyShadow(ctx, st.type.shadow);
    const ns = fitFont(ctx, clip.name || '', bw * .86, H * .085, st.weights.display, st.fonts.display, st.type.track);
    ctx.fillStyle = titleFill(ctx, st, cx, y + barH * .8, bw, ns);
    drawTracked(ctx, clip.name || '', cx, y + barH * .84, ns * st.type.track, al);
    clearShadow(ctx);
  });
}

function paintSub(ctx, clip, st, W, H, env) {
  const a = Math.min(easeOutCubic(env.inP), 1 - easeInCubic(env.outP));
  ctx.save();
  ctx.globalAlpha *= a;
  ctx.textBaseline = 'alphabetic';

  const line = (clip.speaker ? `${clip.speaker} : ` : '') + (clip.text || '');
  const size = H * .058;
  const modern = st.id === 'flat' || st.id === 'kinetic' || st.id === 'modern' || st.id === 'hd';
  const fs = fitFont(ctx, line, W * .86, size, modern ? 500 : 800, st.fonts.caption, .01);
  const y = H * .885;

  if (modern) {
    const w = layoutChars(ctx, line, fs * .01).width;
    ctx.fillStyle = 'rgba(0,0,0,.55)';
    roundRect(ctx, W / 2 - w / 2 - 18, y - fs * .95, w + 36, fs * 1.5, 6); ctx.fill();
    ctx.fillStyle = '#ffffff';
  } else {
    // analogue captions: heavy black outline, warm yellow — how tape-era
    // Korean dub subtitles actually read against bright picture
    ctx.lineWidth = Math.max(3, fs * .14);
    ctx.strokeStyle = 'rgba(0,0,0,.95)';
    ctx.lineJoin = 'round';
    const { chars, width } = layoutChars(ctx, line, fs * .01);
    let x0 = W / 2 - width / 2;
    chars.forEach(c => ctx.strokeText(c.ch, x0 + c.x, y));
    ctx.fillStyle = '#ffe98a';
  }
  drawTracked(ctx, line, W / 2, y, fs * .01, 'center');
  ctx.restore();
}

function paintRoll(ctx, clip, st, W, H, env, local) {
  const rows = clip.rows || [];
  ctx.textBaseline = 'alphabetic';

  if (clip.mode === 'scroll') {
    // credit roll — travels from below the frame to above it over the clip
    const lineH = H * .082;
    const total = rows.length * lineH;
    const travel = H + total;
    const p = clamp(local / Math.max(.001, clip.dur), 0, 1);
    const yTop = H - p * travel;

    ctx.save();
    ctx.globalAlpha *= Math.min(1, env.inP * 3);
    const roleSize = H * .036, nameSize = H * .05;
    rows.forEach((r, i) => {
      const y = yTop + i * lineH;
      if (y < -lineH || y > H + lineH) return;
      // fade the ends of the roll so it doesn't clip hard at frame edge
      const edge = Math.min(1, clamp(y / (H * .12), 0, 1), clamp((H - y) / (H * .12), 0, 1));
      ctx.save();
      ctx.globalAlpha *= .25 + .75 * edge;
      applyShadow(ctx, st.type.shadow);
      if (clip.align === 'split' && r.role) {
        ctx.font = `${st.weights.body} ${roleSize}px ${st.fonts.caption}`;
        ctx.fillStyle = st.pal.sub;
        drawTracked(ctx, r.role, W * .485, y, roleSize * (st.type.track + .1), 'right');
        ctx.font = `${st.weights.display} ${nameSize}px ${st.fonts.display}`;
        ctx.fillStyle = st.pal.fg;
        drawTracked(ctx, r.name || '', W * .515, y, nameSize * st.type.track, 'left');
      } else {
        const txt = r.role ? `${r.role}   ${r.name || ''}` : (r.name || '');
        ctx.font = `${st.weights.display} ${nameSize}px ${st.fonts.display}`;
        ctx.fillStyle = r.role ? st.pal.sub : st.pal.fg;
        drawTracked(ctx, txt, W / 2, y, nameSize * st.type.track, 'center');
      }
      ctx.restore();
    });
    ctx.restore();
    return;
  }

  // block mode — a static cast panel that animates in with the era preset
  const lineH = H * .078;
  const total = rows.length * lineH + (clip.header ? H * .1 : 0);
  const top = H / 2 - total / 2;
  const box = { x: W * .1, y: top - H * .04, w: W * .8, h: total + H * .08 };

  runPreset(ctx, st.anim.card, env, st, box, () => {
    let y = top;
    if (clip.header) {
      applyShadow(ctx, st.type.shadow);
      const hs = fitFont(ctx, clip.header, W * .5, H * .05, st.weights.body, st.fonts.caption, st.type.track + .2);
      ctx.fillStyle = st.pal.accent;
      drawTracked(ctx, clip.header, W / 2, y, hs * (st.type.track + .2), 'center');
      clearShadow(ctx);
      drawRule(ctx, st, W / 2, y + H * .028, Math.min(W * .26, 240));
      y += H * .1;
    }
    rows.forEach(r => {
      applyShadow(ctx, st.type.shadow);
      const txt = r.role ? `${r.role}   ${r.name || ''}` : (r.name || '');
      const ns = fitFont(ctx, txt, W * .74, H * .058, st.weights.display, st.fonts.display, st.type.track);
      ctx.fillStyle = r.role ? st.pal.sub : st.pal.fg;
      drawTracked(ctx, txt, W / 2, y, ns * st.type.track, 'center');
      y += lineH;
    });
    clearShadow(ctx);
  });
}

/* ---- media ------------------------------------------------------------- */
function paintMedia(ctx, clip, el, W, H, env) {
  if (!el) return;
  const nw = el.videoWidth || el.naturalWidth || 0;
  const nh = el.videoHeight || el.naturalHeight || 0;
  if (!nw || !nh) return;

  const a = clip.noFade ? 1 : Math.min(easeOutCubic(env.inP), 1 - easeInCubic(env.outP));
  ctx.save();
  ctx.globalAlpha *= a * (clip.opacity != null ? clip.opacity : 1);
  if (clip.blend && clip.blend !== 'normal') ctx.globalCompositeOperation = clip.blend;

  const scale = clip.scale != null ? clip.scale : 1;
  const fitCover = clip.fit !== 'contain';
  const r = fitCover ? Math.max(W / nw, H / nh) : Math.min(W / nw, H / nh);
  const dw = nw * r * scale, dh = nh * r * scale;
  const dx = (W - dw) / 2 + (clip.x || 0) * W;
  const dy = (H - dh) / 2 + (clip.y || 0) * H;

  ctx.translate(W / 2, H / 2);
  ctx.rotate((clip.rot || 0) * Math.PI / 180);
  ctx.translate(-W / 2, -H / 2);
  try { ctx.drawImage(el, dx, dy, dw, dh); } catch (e) { /* frame not ready */ }
  ctx.restore();
}

/* ==========================================================================
   Renderer
   ========================================================================== */
export class Renderer {
  constructor(outCanvas) {
    this.out = outCanvas;
    this.octx = outCanvas.getContext('2d');
    this.base = document.createElement('canvas');
    this.bctx = this.base.getContext('2d');
    this.t1 = document.createElement('canvas'); this.c1 = this.t1.getContext('2d');
    this.t2 = document.createElement('canvas'); this.c2 = this.t2.getContext('2d');
    this.W = 0; this.H = 0;
    this.noise = [];
    this.scanPat = null;
    this.oddPat = null;
    this.vig = null;
  }

  resize(W, H) {
    if (this.W === W && this.H === H) return;
    this.W = W; this.H = H;
    for (const c of [this.out, this.base, this.t1, this.t2]) { c.width = W; c.height = H; }
    this._buildNoise();
    this._buildPatterns();
  }

  _buildNoise() {
    // eight pre-rendered monochrome tiles, cycled per frame — far cheaper
    // than generating noise every frame and visually indistinguishable
    this.noise = [];
    const N = 128;
    for (let k = 0; k < 8; k++) {
      const c = document.createElement('canvas'); c.width = N; c.height = N;
      const g = c.getContext('2d');
      const img = g.createImageData(N, N);
      const rnd = mulberry32(1337 + k * 7919);
      for (let i = 0; i < img.data.length; i += 4) {
        const v = 90 + rnd() * 165;
        img.data[i] = img.data[i + 1] = img.data[i + 2] = v;
        img.data[i + 3] = 255;
      }
      g.putImageData(img, 0, 0);
      this.noise.push(c);
    }
  }

  _buildPatterns() {
    const H = this.H;
    // scanlines
    const sc = document.createElement('canvas'); sc.width = 4; sc.height = 4;
    const sg = sc.getContext('2d');
    sg.fillStyle = '#ffffff'; sg.fillRect(0, 0, 4, 4);
    sg.fillStyle = '#000000'; sg.fillRect(0, 2, 4, 2);
    this.scanPat = this.octx.createPattern(sc, 'repeat');
    // odd-line mask for interlace comb
    const od = document.createElement('canvas'); od.width = 2; od.height = 2;
    const og = od.getContext('2d');
    og.fillStyle = '#fff'; og.fillRect(0, 0, 2, 1);
    this.oddPat = this.octx.createPattern(od, 'repeat');
    // vignette
    const v = document.createElement('canvas'); v.width = this.W; v.height = H;
    const vg = v.getContext('2d');
    const grd = vg.createRadialGradient(this.W / 2, H / 2, Math.min(this.W, H) * .28, this.W / 2, H / 2, Math.max(this.W, H) * .72);
    grd.addColorStop(0, 'rgba(255,255,255,1)');
    grd.addColorStop(1, 'rgba(0,0,0,1)');
    vg.fillStyle = grd; vg.fillRect(0, 0, this.W, H);
    this.vig = v;
  }

  /* ---------------- compose ---------------- */
  render(state, time, media, styleFor) {
    const W = this.W, H = this.H;
    const st = styleFor;
    const b = this.bctx;

    b.setTransform(1, 0, 0, 1, 0, 0);
    b.globalCompositeOperation = 'source-over';
    b.globalAlpha = 1;
    b.filter = 'none';
    b.fillStyle = st.pal.bg;
    b.fillRect(0, 0, W, H);

    const active = state.clips
      .filter(c => time >= c.start - 0.0001 && time < c.start + c.dur)
      .sort((a, c) => a.start - c.start);

    const mediaClips = active.filter(c => c.type === 'media');
    const textClips = active.filter(c => c.type !== 'media');

    const layer = state.layers;
    const mediaVisible = layer[1] && layer[1].visible;
    const baseVisible = layer[0] && layer[0].visible;

    const paintMediaLayer = () => {
      if (!mediaVisible) return;
      b.save();
      b.globalAlpha = layer[1].opacity != null ? layer[1].opacity : 1;
      mediaClips.forEach(c => {
        const env = envelope(time - c.start, c.dur, st);
        paintMedia(b, c, media.get(c.id), W, H, env);
      });
      b.restore();
    };

    const paintBaseLayer = () => {
      if (!baseVisible) return;
      b.save();
      b.globalAlpha = layer[0].opacity != null ? layer[0].opacity : 1;
      textClips.forEach(c => {
        const local = time - c.start;
        const env = envelope(local, c.dur, st);
        b.save();
        switch (c.type) {
          case 'ident': paintIdent(b, c, st, W, H, env); break;
          case 'card': paintCard(b, c, st, W, H, env); break;
          case 'ep': paintEp(b, c, st, W, H, env); break;
          case 'lower': paintLower(b, c, st, W, H, env); break;
          case 'roll': paintRoll(b, c, st, W, H, env, local); break;
          case 'sub': paintSub(b, c, st, W, H, env); break;
        }
        b.restore();
      });
      b.restore();
    };

    if (state.layerOrder === 'media-over') { paintBaseLayer(); paintMediaLayer(); }
    else { paintMediaLayer(); paintBaseLayer(); }

    // letterbox bars (era-driven, e.g. 2003–2007 16:9 inside a 4:3 raster)
    if (st.letterbox > 0) {
      const bh = H * st.letterbox;
      b.fillStyle = '#000';
      b.fillRect(0, 0, W, bh);
      b.fillRect(0, H - bh, W, bh);
    }

    // station bug
    if (state.showBug && state.meta.bugText) {
      b.save();
      b.globalAlpha = .88;
      const size = H * .038;
      b.font = `${st.weights.display} ${size}px ${st.fonts.display}`;
      const txt = state.meta.bugText;
      const w = b.measureText(txt).width;
      const px = W - w - W * .045, py = H * .085;
      if (st.bug === 'corner-plate') {
        b.fillStyle = 'rgba(0,0,0,.42)';
        roundRect(b, px - 12, py - size, w + 24, size * 1.45, 4); b.fill();
      } else if (st.bug === 'corner-flat') {
        b.fillStyle = withAlpha(st.pal.accent, .18);
        b.fillRect(px - 12, py - size, w + 24, size * 1.45);
      }
      applyShadow(b, st.type.shadow);
      b.fillStyle = st.pal.fg;
      b.fillText(txt, px, py + size * .1);
      b.restore();
    }

    // safe-area guides (preview only, never recorded)
    if (state.showSafe && !state.recording) {
      b.save();
      b.strokeStyle = 'rgba(120,200,255,.5)'; b.lineWidth = 1; b.setLineDash([6, 6]);
      b.strokeRect(W * .05, H * .05, W * .9, H * .9);
      b.strokeStyle = 'rgba(255,180,120,.5)';
      b.strokeRect(W * .10, H * .10, W * .8, H * .8);
      b.restore();
    }

    this._filter(state, time);
  }

  /* ---------------- tape filter chain ---------------- */
  _filter(state, time) {
    const W = this.W, H = this.H;
    const o = this.octx;
    const f = filterById(state.filter);
    const p = f.p;

    o.setTransform(1, 0, 0, 1, 0, 0);
    o.globalCompositeOperation = 'source-over';
    o.globalAlpha = 1;
    o.filter = 'none';

    if (!p) { o.clearRect(0, 0, W, H); o.drawImage(this.base, 0, 0); return; }

    const frame = Math.max(0, Math.floor((Number.isFinite(time) ? time : 0) * 30));
    const rnd = mulberry32(frame * 2654435761 % 2147483647);

    // 1 — grade
    const c1 = this.c1;
    c1.setTransform(1, 0, 0, 1, 0, 0);
    c1.globalCompositeOperation = 'source-over'; c1.globalAlpha = 1;
    c1.clearRect(0, 0, W, H);
    c1.filter = `saturate(${p.sat}) contrast(${p.contrast})${p.warm ? ` sepia(${p.warm})` : ''}`;
    // tracking jitter / gate weave
    const jx = p.jitter ? (rnd() - .5) * p.jitter * 2 : 0;
    const jy = p.jitter ? (rnd() - .5) * p.jitter : 0;
    const wow = p.wow ? Math.sin(time * 3.1) * 2.4 + Math.sin(time * 7.7) * 1.1 : 0;
    c1.drawImage(this.base, jx + wow, jy);
    c1.filter = 'none';

    // 2 — chroma bleed (RGB split)
    o.clearRect(0, 0, W, H);
    o.fillStyle = '#000'; o.fillRect(0, 0, W, H);
    if (p.bleed > 0.05) {
      const ch = (colour, dx) => {
        const c2 = this.c2;
        c2.setTransform(1, 0, 0, 1, 0, 0);
        c2.globalCompositeOperation = 'source-over'; c2.globalAlpha = 1;
        c2.clearRect(0, 0, W, H);
        c2.drawImage(this.t1, 0, 0);
        c2.globalCompositeOperation = 'multiply';
        c2.fillStyle = colour; c2.fillRect(0, 0, W, H);
        c2.globalCompositeOperation = 'source-over';
        o.globalCompositeOperation = 'lighter';
        o.drawImage(this.t2, dx, 0);
      };
      ch('#ff0000', -p.bleed);
      ch('#00ff00', 0);
      ch('#0000ff', p.bleed);
      o.globalCompositeOperation = 'source-over';
    } else {
      o.drawImage(this.t1, 0, 0);
    }

    // 3 — bloom
    if (p.bloom > .01) {
      o.save();
      o.globalCompositeOperation = 'lighter';
      o.globalAlpha = p.bloom;
      o.filter = `blur(${(6 + p.bloom * 14).toFixed(1)}px)`;
      o.drawImage(this.t1, 0, 0);
      o.restore();
      o.filter = 'none';
    }

    // 4 — interlace comb: odd lines pulled sideways
    if (p.comb > .01) {
      const c2 = this.c2;
      c2.setTransform(1, 0, 0, 1, 0, 0);
      c2.globalCompositeOperation = 'source-over'; c2.globalAlpha = 1;
      c2.clearRect(0, 0, W, H);
      c2.drawImage(this.t1, p.comb * 2.2, 0);
      c2.globalCompositeOperation = 'destination-in';
      c2.fillStyle = this.oddPat; c2.fillRect(0, 0, W, H);
      c2.globalCompositeOperation = 'source-over';
      o.save(); o.globalAlpha = .55 * p.comb * 2; o.drawImage(this.t2, 0, 0); o.restore();
    }

    // 5 — scanlines
    if (p.scan > .01) {
      o.save();
      o.globalCompositeOperation = 'multiply';
      o.globalAlpha = p.scan * .55;
      o.fillStyle = this.scanPat;
      o.translate(0, (frame % 2) * .5);
      o.fillRect(0, 0, W, H + 2);
      o.restore();
    }

    // 6 — luma noise / film grain
    if (p.noise > .005 && this.noise.length) {
      const tile = this.noise[frame % this.noise.length];
      o.save();
      o.globalCompositeOperation = p.grain ? 'overlay' : 'soft-light';
      o.globalAlpha = p.noise;
      const ox = -rnd() * 128, oy = -rnd() * 128;
      for (let y = oy; y < H; y += 128) for (let x = ox; x < W; x += 128) o.drawImage(tile, x, y);
      o.restore();
    }

    // 7 — dropouts: short bright streaks where the tape lost contact
    if (p.dropout > .01) {
      o.save();
      const n = Math.floor(rnd() * 4 * p.dropout);
      for (let i = 0; i < n; i++) {
        const y = rnd() * H;
        const h = 1 + rnd() * 3 * p.dropout;
        const x = rnd() * W * .8;
        const w = 20 + rnd() * W * .35 * p.dropout;
        o.globalAlpha = .12 + rnd() * .5 * p.dropout;
        o.fillStyle = rnd() > .35 ? '#e8f0ff' : '#0a0a12';
        o.fillRect(x, y, w, h);
      }
      o.restore();
    }

    // 8 — head-switching noise at the bottom of the raster
    if (p.headSwitch > .01) {
      const bandH = Math.round(H * .028 * p.headSwitch);
      const sy = H - bandH;
      o.save();
      o.beginPath(); o.rect(0, sy, W, bandH); o.clip();
      const skew = (rnd() - .5) * 26 * p.headSwitch;
      o.drawImage(this.t1, 0, 0, W, H, skew, 0, W, H);
      o.globalAlpha = .55;
      const tile = this.noise[(frame + 3) % this.noise.length];
      o.globalCompositeOperation = 'lighter';
      if (tile) for (let x = -rnd() * 128; x < W; x += 128) o.drawImage(tile, x, sy - 40);
      o.restore();
    }

    // 9 — vignette
    if (p.vignette > .01) {
      o.save();
      o.globalCompositeOperation = 'multiply';
      o.globalAlpha = p.vignette;
      o.drawImage(this.vig, 0, 0);
      o.restore();
    }

    o.globalCompositeOperation = 'source-over';
    o.globalAlpha = 1;
    o.filter = 'none';
  }
}

export { envelope };
