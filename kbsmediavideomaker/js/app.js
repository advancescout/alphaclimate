/* ==========================================================================
   KBS Media Video Maker — editor
   ========================================================================== */

import {
  ERAS, YEAR_MIN, YEAR_MAX, yearStyle, eraForYear,
  PROGRAMME_TYPES, programmeType, FILTERS, filterById, FONT_PROBES
} from './eras.js';
import { Renderer } from './render.js';
import { newProject, buildOpening, buildEnding, buildCaptions, uid } from './templates.js';

/* ---------- tiny DOM helpers ---------- */
const $ = s => document.querySelector(s);
const h = (tag, attrs = {}, ...kids) => {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (v == null || v === false) continue;
    if (k === 'class') el.className = v;
    else if (k === 'text') el.textContent = v;
    else if (k.startsWith('on')) el.addEventListener(k.slice(2).toLowerCase(), v);
    else if (k in el && k !== 'list' && typeof v !== 'object') el[k] = v;
    else el.setAttribute(k, v);
  }
  kids.flat().forEach(k => k != null && el.append(k.nodeType ? k : document.createTextNode(k)));
  return el;
};
/* Element.append() turns a null into the literal text "null" — filter first. */
const append = (el, ...kids) => { kids.flat().filter(k => k != null).forEach(k => el.append(k)); return el; };
const fmt = t => {
  const s = Math.max(0, t);
  return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(Math.floor(s % 60)).padStart(2, '0')}.${Math.floor((s % 1) * 10)}`;
};

/* ---------- state ---------- */
const LS_KEY = 'kbsmvm.project.v3';
let P = load() || newProject();
let selected = null;
let time = 0;
let playing = false;
let dirty = true;
let lastTick = 0;

const media = new Map();          // clipId → HTMLVideoElement | HTMLImageElement
const mediaMeta = new Map();      // clipId → { url, kind, fileName }
const audioEls = new Map();       // audioId → HTMLAudioElement
const audioNodes = new Map();     // audioId → { src, gain }
const clipAudioNodes = new Map(); // clipId  → { src, gain }

let actx = null, recDest = null;
const canvas = $('#screen');
const renderer = new Renderer(canvas);

const PPS = 74;                   // timeline pixels per second
const LBL = 96;                   // timeline lane-label width

/* ==========================================================================
   Boot
   ========================================================================== */
(async function boot() {
  try {
    await Promise.race([
      Promise.all(FONT_PROBES.map(f => document.fonts.load(f, '가나다ABC123'))),
      new Promise(r => setTimeout(r, 6000))
    ]);
    await document.fonts.ready;
  } catch (e) { /* fall through — worst case the canvas uses a fallback face */ }

  buildYears();
  buildTypes();
  buildFilters();
  bindTopbar();
  bindTransport();
  bindAddBar();
  bindMeta();
  syncAll();
  requestAnimationFrame(frame);

  const boot = $('#boot');
  boot.classList.add('boot--gone');
  setTimeout(() => boot.remove(), 400);

  if (!localStorage.getItem('kbsmvm.seen')) {
    $('#about').hidden = false;
    localStorage.setItem('kbsmvm.seen', '1');
  }
})();

/* ==========================================================================
   Derived
   ========================================================================== */
function style() { return yearStyle(P.meta.year); }

function dims() {
  const st = style();
  const a = P.aspect === 'auto' ? st.aspect : P.aspect;
  return a === '4:3' ? { W: 960, H: 720 } : { W: 1280, H: 720 };
}

function projectDuration() {
  let d = 6;
  P.clips.forEach(c => { d = Math.max(d, c.start + c.dur); });
  P.audio.forEach(a => { if (a.src && a.duration) d = Math.max(d, a.start + a.duration - a.trimIn); });
  return Math.ceil(d * 10) / 10;
}

/* ==========================================================================
   Left rail — years
   ========================================================================== */
function buildYears() {
  const wrap = $('#years');
  wrap.textContent = '';
  for (let y = YEAR_MIN; y <= YEAR_MAX; y++) {
    const era = eraForYear(y);
    wrap.append(h('button', {
      class: 'yr', type: 'button', text: String(y), 'data-y': y, 'data-e': era.id,
      title: `${y} — ${era.ko} (${era.en})`,
      onclick: () => setYear(y)
    }));
  }
}

function setYear(y) {
  P.meta.year = y;
  // The era carries a default filter; adopt it unless the user has pinned one.
  if (!P.filterPinned) P.filter = eraForYear(y).filter;
  syncAll();
  save();
}

function syncYears() {
  document.querySelectorAll('.yr').forEach(b => b.classList.toggle('is-on', +b.dataset.y === P.meta.year));
  const st = style();
  const card = $('#eraCard');
  card.textContent = '';
  append(card,
    h('b', { text: `${st.year} · ${st.ko}` }),
    h('em', { text: st.en }),
    h('p', { text: st.blurb }),
    st.note ? h('div', { class: 'quirk', text: `이 해의 특징: ${st.note}` }) : null,
    h('div', { class: 'specs' },
      h('i', { text: st.aspect }),
      h('i', { text: `자간 ${(st.type.track * 100).toFixed(1)}%` }),
      h('i', { text: `속도 ×${st.motion.speed.toFixed(2)}` }),
      h('i', { text: st.anim.card })
    )
  );
}

/* ==========================================================================
   Left rail — programme type / filters
   ========================================================================== */
function buildTypes() {
  const wrap = $('#types');
  wrap.textContent = '';
  PROGRAMME_TYPES.forEach(t => wrap.append(h('button', {
    class: 'chip', type: 'button', text: t.ko, 'data-t': t.id, title: t.en,
    onclick: () => { P.meta.type = t.id; syncAll(); save(); }
  })));
}

function buildFilters() {
  const wrap = $('#filters');
  wrap.textContent = '';
  FILTERS.forEach(f => wrap.append(h('button', {
    class: 'chip', type: 'button', text: f.ko, 'data-f': f.id, title: f.en,
    onclick: () => { P.filter = f.id; P.filterPinned = f.id !== eraForYear(P.meta.year).filter; syncAll(); save(); }
  })));
}

function syncChips() {
  document.querySelectorAll('#types .chip').forEach(c => c.classList.toggle('is-on', c.dataset.t === P.meta.type));
  document.querySelectorAll('#filters .chip').forEach(c => c.classList.toggle('is-on', c.dataset.f === P.filter));
  const f = filterById(P.filter);
  $('#filterNote').textContent = `${f.en} — ${f.desc}`;
}

/* ==========================================================================
   Left rail — layers
   ========================================================================== */
function syncLayers() {
  const wrap = $('#layers');
  wrap.textContent = '';
  P.layers.forEach((L, i) => {
    const count = P.clips.filter(c => (c.type === 'media') === (i === 1)).length;
    wrap.append(h('div', { class: 'lyr' },
      h('div', { class: 'lyr__top' },
        h('button', {
          class: 'lyr__eye' + (L.visible ? '' : ' is-off'), type: 'button',
          text: L.visible ? '◉' : '○', title: L.visible ? '숨기기' : '보이기',
          onclick: () => { L.visible = !L.visible; syncLayers(); mark(); save(); }
        }),
        h('span', { class: 'lyr__name', text: L.name })
      ),
      h('div', { class: 'lyr__meta', text: `${count}개 클립 · ${i === 0 ? '텍스트 · 자막 · 크레딧' : '영상 · 이미지'}` }),
      h('label', { class: 'lyr__op' },
        h('span', { text: '불투명도' }),
        h('input', {
          type: 'range', min: 0, max: 1, step: .01, value: L.opacity ?? 1,
          oninput: e => { L.opacity = +e.target.value; mark(); },
          onchange: save
        })
      )
    ));
  });
  $('#layerOrder').value = P.layerOrder;
}

/* ==========================================================================
   Left rail — audio
   ========================================================================== */
function syncAudio() {
  const wrap = $('#audioPanes');
  wrap.textContent = '';
  P.audio.forEach(A => {
    const fileInput = h('input', {
      type: 'file', accept: 'audio/*',
      onchange: e => { const f = e.target.files[0]; if (f) attachAudio(A, f); }
    });
    wrap.append(h('div', { class: 'aud' },
      h('div', { class: 'aud__h' }, h('b', { text: A.name }), h('span', { class: 'tag', text: A.role })),
      h('div', { class: 'aud__file', text: A.fileName || '' }),
      fileInput,
      h('label', { class: 'row' }, h('span', { text: '음량' }),
        h('input', {
          type: 'range', min: 0, max: 1.5, step: .01, value: A.volume,
          oninput: e => { A.volume = +e.target.value; }, onchange: save
        })),
      h('label', { class: 'row' }, h('span', { text: '시작 (초)' }),
        h('input', {
          type: 'number', min: 0, step: .1, value: A.start,
          onchange: e => { A.start = +e.target.value || 0; syncTimeline(); save(); }
        })),
      h('label', { class: 'row' }, h('span', { text: '페이드 인' }),
        h('input', { type: 'number', min: 0, step: .1, value: A.fadeIn, onchange: e => { A.fadeIn = +e.target.value || 0; save(); } })),
      h('label', { class: 'row' }, h('span', { text: '페이드 아웃' }),
        h('input', { type: 'number', min: 0, step: .1, value: A.fadeOut, onchange: e => { A.fadeOut = +e.target.value || 0; save(); } })),
      A.src ? h('button', {
        class: 'btn btn--sm', type: 'button', text: '음원 제거',
        onclick: () => { detachAudio(A); }
      }) : null
    ));
  });
}

function ensureCtx() {
  if (!actx) {
    actx = new (window.AudioContext || window.webkitAudioContext)();
    recDest = actx.createMediaStreamDestination();
    // A MediaRecorder stalls outright on an audio track that never delivers
    // samples — a project with no audio would otherwise export a zero-byte
    // file. Keep a silent source feeding the recording destination.
    const keep = actx.createConstantSource();
    const mute = actx.createGain();
    mute.gain.value = 0;
    keep.connect(mute); mute.connect(recDest);
    keep.start();
  }
  if (actx.state === 'suspended') actx.resume();
  return actx;
}

function attachAudio(A, file) {
  detachAudio(A);
  const url = URL.createObjectURL(file);
  A.src = url; A.fileName = file.name;
  const el = new Audio(url);
  el.preload = 'auto';
  el.addEventListener('loadedmetadata', () => { A.duration = el.duration; syncTimeline(); });
  audioEls.set(A.id, el);
  ensureCtx();
  const src = actx.createMediaElementSource(el);
  const gain = actx.createGain();
  gain.gain.value = 0;
  src.connect(gain); gain.connect(actx.destination); gain.connect(recDest);
  audioNodes.set(A.id, { src, gain });
  syncAudio(); save();
}

function detachAudio(A) {
  const el = audioEls.get(A.id);
  if (el) { el.pause(); audioEls.delete(A.id); }
  const n = audioNodes.get(A.id);
  if (n) { try { n.gain.disconnect(); n.src.disconnect(); } catch (e) {} audioNodes.delete(A.id); }
  if (A.src) URL.revokeObjectURL(A.src);
  A.src = null; A.fileName = ''; A.duration = 0;
  syncAudio(); save();
}

/* ==========================================================================
   Media import
   ========================================================================== */
$('#btnAddMedia').addEventListener('click', () => $('#mediaFile').click());
$('#mediaFile').addEventListener('change', e => {
  const files = Array.from(e.target.files || []);
  let at = time;
  files.forEach(f => { at = addMediaClip(f, at); });
  e.target.value = '';
});

/* Drag a file straight onto the picture: video/image joins layer 2, audio
   goes to the music track (or the dub track if music is already taken). */
['dragover', 'drop'].forEach(ev => $('#viewport').addEventListener(ev, e => {
  e.preventDefault();
  if (ev !== 'drop') return;
  let at = time;
  Array.from(e.dataTransfer.files || []).forEach(f => {
    if (f.type.startsWith('audio')) {
      const track = P.audio.find(a => !a.src) || P.audio[0];
      attachAudio(track, f);
    } else if (f.type.startsWith('video') || f.type.startsWith('image')) {
      at = addMediaClip(f, at);
    }
  });
}));

function addMediaClip(file, at) {
  const isVid = file.type.startsWith('video');
  const url = URL.createObjectURL(file);
  const clip = {
    id: uid('m'), layer: 1, type: 'media', start: +at.toFixed(2), dur: isVid ? 5 : 4,
    kind: isVid ? 'video' : 'image', fileName: file.name,
    fit: 'cover', scale: 1, x: 0, y: 0, rot: 0, opacity: 1, blend: 'normal',
    trimIn: 0, volume: isVid ? 1 : 0, noFade: false
  };
  mediaMeta.set(clip.id, { url, kind: clip.kind, fileName: file.name });

  if (isVid) {
    const v = document.createElement('video');
    v.src = url; v.preload = 'auto'; v.playsInline = true; v.muted = false;
    v.addEventListener('loadedmetadata', () => {
      clip.dur = Math.min(30, v.duration || 5);
      clip.srcDuration = v.duration;
      syncTimeline(); mark();
    }, { once: true });
    media.set(clip.id, v);
    ensureCtx();
    try {
      const src = actx.createMediaElementSource(v);
      const gain = actx.createGain();
      gain.gain.value = 0;
      src.connect(gain); gain.connect(actx.destination); gain.connect(recDest);
      clipAudioNodes.set(clip.id, { src, gain });
    } catch (err) { /* element already routed */ }
  } else {
    const img = new Image();
    img.src = url;
    img.addEventListener('load', () => { mark(); }, { once: true });
    media.set(clip.id, img);
  }

  P.clips.push(clip);
  select(clip.id);
  syncTimeline(); mark(); save();
  return clip.start + clip.dur;
}

/* ==========================================================================
   Clips
   ========================================================================== */
function laneOf(c) { return c.type === 'media' ? 2 : c.type === 'sub' ? 1 : 0; }

function defaultClip(type) {
  const st = style(), pt = programmeType(P.meta.type);
  const base = { id: uid('c'), layer: 0, type, start: +time.toFixed(2), dur: 3 };
  switch (type) {
    case 'ident': return { ...base, dur: 2.4, line1: P.meta.studio || '제작 · 스튜디오명', line2: pt.dubNotes ? '한국어판 제작' : '제 작' };
    case 'card': return { ...base, dur: 3.6, kicker: P.meta.kicker || '', title: P.meta.title || '프로그램 제목', sub: P.meta.subtitle || '' };
    case 'ep': return { ...base, dur: 2.8, epNo: P.meta.epNo || 1, epLabelPre: pt.titleLabel, epLabelPost: pt.epLabel, epTitle: P.meta.epTitle || '' };
    case 'lower': return { ...base, dur: 2.0, role: pt.roles[0] || '연출', name: '이름', align: st.id === 'flat' || st.id === 'modern' ? 'left' : 'center' };
    case 'sub': return { ...base, dur: 2.6, speaker: '', text: '대사를 입력하세요.' };
    case 'roll': return {
      ...base, dur: 10, mode: 'scroll', align: 'split', header: '',
      rows: pt.roles.map(r => ({ role: r, name: '이름' }))
    };
    default: return base;
  }
}

function bindAddBar() {
  document.querySelectorAll('[data-add]').forEach(b => b.addEventListener('click', () => {
    const c = defaultClip(b.dataset.add);
    P.clips.push(c);
    select(c.id);
    syncTimeline(); mark(); save();
  }));

  $('#btnOpening').addEventListener('click', () => applyTemplate(buildOpening(P.meta), '오프닝'));
  $('#btnEnding').addEventListener('click', () => applyTemplate(buildEnding(P.meta), '엔딩'));

  $('#btnBulkCaps').addEventListener('click', () => {
    const txt = $('#bulkCaps').value;
    if (!txt.trim()) { toast('대사를 먼저 입력해 주세요.', true); return; }
    const caps = buildCaptions(txt, time);
    P.clips.push(...caps);
    syncTimeline(); mark(); save();
    toast(`자막 클립 ${caps.length}개를 ${fmt(time)} 부터 추가했습니다.`);
  });
}

function applyTemplate(seq, label) {
  const keepMedia = P.clips.filter(c => c.type === 'media');
  P.clips = [...keepMedia, ...seq.clips];
  selected = null;
  seek(0);
  syncTimeline(); syncInspector(); mark(); save();
  toast(`${label} 시퀀스를 ${style().year}년 ${style().ko} 스타일로 구성했습니다 (${seq.duration.toFixed(1)}초).`);
}

function select(id) { selected = id; syncTimeline(); syncInspector(); }

function deleteClip(id) {
  const c = P.clips.find(x => x.id === id);
  if (!c) return;
  if (c.type === 'media') {
    const mm = mediaMeta.get(id);
    if (mm) URL.revokeObjectURL(mm.url);
    media.delete(id); mediaMeta.delete(id);
    const n = clipAudioNodes.get(id);
    if (n) { try { n.gain.disconnect(); n.src.disconnect(); } catch (e) {} clipAudioNodes.delete(id); }
  }
  P.clips = P.clips.filter(x => x.id !== id);
  if (selected === id) selected = null;
  syncTimeline(); syncInspector(); mark(); save();
}

/* ==========================================================================
   Timeline
   ========================================================================== */
const LANES = [
  { name: '1 · 타이틀', sub: '카드 · 하단자막 · 롤' },
  { name: '1 · 더빙자막', sub: '대사 캡션' },
  { name: '2 · 미디어', sub: '영상 · 이미지' }
];

function syncTimeline() {
  const dur = projectDuration();
  P.duration = dur;
  const width = LBL + dur * PPS + 60;

  const ruler = $('#tlRuler');
  ruler.textContent = '';
  ruler.style.width = width + 'px';
  const step = dur > 60 ? 10 : dur > 24 ? 5 : 1;
  for (let s = 0; s <= dur; s += step) {
    ruler.append(h('div', { class: 'tl__tick', text: fmt(s).replace(/\.\d$/, ''), style: `left:${LBL + s * PPS}px` }));
  }

  const tracks = $('#tlTracks');
  tracks.textContent = '';
  tracks.style.width = width + 'px';
  LANES.forEach((L, li) => {
    const row = h('div', { class: 'trk' },
      h('div', { class: 'trk__lbl' }, h('b', { text: L.name }), L.sub)
    );
    P.clips.filter(c => laneOf(c) === li).forEach(c => row.append(clipEl(c)));
    row.addEventListener('dblclick', e => {
      if (e.target !== row) return;
      seek((e.offsetX - LBL) / PPS);
    });
    tracks.append(row);
  });

  $('#scrub').max = dur;
  $('#tcTotal').textContent = fmt(dur);
  moveHead();
}

function clipLabel(c) {
  switch (c.type) {
    case 'ident': return c.line1 || '제작 슬레이트';
    case 'card': return c.title || '타이틀';
    case 'ep': return `${c.epLabelPre} ${c.epNo} ${c.epLabelPost}`;
    case 'lower': return `${c.role} · ${c.name}`;
    case 'sub': return (c.speaker ? c.speaker + ': ' : '') + (c.text || '');
    case 'roll': return c.mode === 'scroll' ? '크레딧 롤' : (c.header || '명단');
    case 'media': return c.fileName || '미디어';
  }
  return c.type;
}
const KIND = { ident: 'SLATE', card: 'TITLE', ep: 'EP', lower: 'L/3', sub: 'CC', roll: 'ROLL', media: 'MEDIA' };

function clipEl(c) {
  const el = h('div', {
    class: 'clip' + (selected === c.id ? ' is-sel' : ''),
    'data-t': c.type, 'data-id': c.id,
    style: `left:${LBL + c.start * PPS}px;width:${Math.max(26, c.dur * PPS)}px`,
    title: clipLabel(c)
  },
    h('span', { class: 'clip__k', text: KIND[c.type] || '' }),
    h('span', { class: 'clip__t', text: clipLabel(c) }),
    h('div', { class: 'clip__grab clip__grab--l' }),
    h('div', { class: 'clip__grab clip__grab--r' })
  );
  el.addEventListener('pointerdown', e => startDrag(e, c, el));
  return el;
}

function startDrag(e, c, el) {
  e.preventDefault();
  select(c.id);
  const mode = e.target.classList.contains('clip__grab--l') ? 'l'
    : e.target.classList.contains('clip__grab--r') ? 'r' : 'move';
  const x0 = e.clientX, s0 = c.start, d0 = c.dur;
  const live = document.querySelector(`.clip[data-id="${c.id}"]`) || el;
  live.setPointerCapture(e.pointerId);

  const onMove = ev => {
    const dx = (ev.clientX - x0) / PPS;
    const snap = v => Math.round(v * 10) / 10;
    if (mode === 'move') c.start = Math.max(0, snap(s0 + dx));
    else if (mode === 'l') {
      const ns = Math.max(0, Math.min(s0 + d0 - .2, snap(s0 + dx)));
      c.dur = snap(d0 + (s0 - ns)); c.start = ns;
    } else {
      c.dur = Math.max(.2, snap(d0 + dx));
    }
    live.style.left = (LBL + c.start * PPS) + 'px';
    live.style.width = Math.max(26, c.dur * PPS) + 'px';
    mark();
  };
  const onUp = () => {
    live.removeEventListener('pointermove', onMove);
    live.removeEventListener('pointerup', onUp);
    syncTimeline(); syncInspector(); save();
  };
  live.addEventListener('pointermove', onMove);
  live.addEventListener('pointerup', onUp);
}

function moveHead() {
  const head = $('#tlHead');
  head.style.left = (LBL + time * PPS) + 'px';
  const tl = $('#timeline');
  const x = LBL + time * PPS;
  if (playing && (x < tl.scrollLeft + LBL + 20 || x > tl.scrollLeft + tl.clientWidth - 40)) {
    tl.scrollLeft = Math.max(0, x - tl.clientWidth * .45);
  }
}

/* ==========================================================================
   Inspector
   ========================================================================== */
function field(label, node) {
  return h('label', { class: 'row' }, h('span', { text: label }), node);
}
function txt(get, set, ph) {
  return h('input', { type: 'text', value: get() ?? '', placeholder: ph || '', oninput: e => { set(e.target.value); mark(); syncTimelineLabels(); }, onchange: save });
}
function num(get, set, opts = {}) {
  return h('input', {
    type: 'number', value: get(), min: opts.min ?? 0, max: opts.max, step: opts.step ?? .1,
    oninput: e => { set(+e.target.value); mark(); }, onchange: () => { syncTimeline(); save(); }
  });
}
function sel(get, set, options) {
  const s = h('select', { onchange: e => { set(e.target.value); mark(); syncTimeline(); save(); } });
  options.forEach(([v, l]) => s.append(h('option', { value: v, text: l, selected: get() === v })));
  return s;
}
function rng(get, set, opts = {}) {
  return h('input', {
    type: 'range', min: opts.min ?? 0, max: opts.max ?? 1, step: opts.step ?? .01, value: get(),
    oninput: e => { set(+e.target.value); mark(); }, onchange: save
  });
}

function syncTimelineLabels() {
  P.clips.forEach(c => {
    const el = document.querySelector(`.clip[data-id="${c.id}"] .clip__t`);
    if (el) el.textContent = clipLabel(c);
  });
}

function syncInspector() {
  const box = $('#inspector');
  box.textContent = '';
  const c = P.clips.find(x => x.id === selected);
  if (!c) { box.append(h('p', { class: 'empty', text: '타임라인에서 클립을 선택하세요.' })); return; }

  const rows = h('div', { class: 'insp__rows' });
  box.append(h('div', { class: 'insp__type', text: `${KIND[c.type]} · ${c.type}` }), rows);

  rows.append(
    field('시작 (초)', num(() => c.start, v => c.start = Math.max(0, v))),
    field('길이 (초)', num(() => c.dur, v => c.dur = Math.max(.2, v)))
  );

  switch (c.type) {
    case 'ident':
      rows.append(field('윗줄', txt(() => c.line2, v => c.line2 = v)), field('아랫줄', txt(() => c.line1, v => c.line1 = v)));
      break;
    case 'card':
      rows.append(
        field('머리말', txt(() => c.kicker, v => c.kicker = v, '선택')),
        field('제목', txt(() => c.title, v => c.title = v)),
        field('부제', txt(() => c.sub, v => c.sub = v, '선택'))
      );
      break;
    case 'ep':
      rows.append(
        field('앞 표기', txt(() => c.epLabelPre, v => c.epLabelPre = v)),
        field('회차 번호', num(() => c.epNo, v => c.epNo = v, { step: 1 })),
        field('뒤 표기', txt(() => c.epLabelPost, v => c.epLabelPost = v)),
        field('회차 제목', txt(() => c.epTitle, v => c.epTitle = v, '선택'))
      );
      break;
    case 'lower':
      rows.append(
        field('역할', txt(() => c.role, v => c.role = v)),
        field('이름', txt(() => c.name, v => c.name = v)),
        field('정렬', sel(() => c.align, v => c.align = v, [['center', '가운데'], ['left', '왼쪽']]))
      );
      break;
    case 'sub':
      rows.append(
        field('화자', txt(() => c.speaker, v => c.speaker = v, '선택')),
        field('대사', txt(() => c.text, v => c.text = v))
      );
      break;
    case 'roll': {
      rows.append(
        field('방식', sel(() => c.mode, v => c.mode = v, [['scroll', '위로 흐름 (엔딩)'], ['block', '한 화면 (명단)']])),
        field('머리말', txt(() => c.header, v => c.header = v, '예: 성우')),
        field('정렬', sel(() => c.align, v => c.align = v, [['split', '역할/이름 양쪽'], ['center', '가운데']]))
      );
      const list = h('div', { class: 'rollrows' });
      const redraw = () => {
        list.textContent = '';
        c.rows.forEach((r, i) => list.append(h('div', { class: 'rollrow' },
          h('input', { type: 'text', value: r.role, placeholder: '역할', oninput: e => { r.role = e.target.value; mark(); }, onchange: save }),
          h('input', { type: 'text', value: r.name, placeholder: '이름', oninput: e => { r.name = e.target.value; mark(); }, onchange: save }),
          h('button', { type: 'button', text: '−', title: '줄 삭제', onclick: () => { c.rows.splice(i, 1); redraw(); mark(); save(); } })
        )));
      };
      redraw();
      rows.append(list, h('div', { class: 'row row--btns' },
        h('button', { class: 'btn btn--sm', type: 'button', text: '＋ 줄 추가', onclick: () => { c.rows.push({ role: '', name: '' }); redraw(); mark(); save(); } }),
        h('button', {
          class: 'btn btn--sm', type: 'button', text: '유형 역할 불러오기',
          onclick: () => { c.rows = programmeType(P.meta.type).roles.map(r => ({ role: r, name: '이름' })); redraw(); mark(); save(); }
        })
      ));
      break;
    }
    case 'media': {
      rows.append(
        field('파일', h('input', { type: 'text', value: c.fileName, readOnly: true })),
        field('맞춤', sel(() => c.fit, v => c.fit = v, [['cover', '화면 채우기'], ['contain', '전체 보이기']])),
        field('확대', rng(() => c.scale, v => c.scale = v, { min: .2, max: 3, step: .01 })),
        field('가로 위치', rng(() => c.x, v => c.x = v, { min: -.5, max: .5, step: .005 })),
        field('세로 위치', rng(() => c.y, v => c.y = v, { min: -.5, max: .5, step: .005 })),
        field('회전 °', num(() => c.rot, v => c.rot = v, { min: -180, max: 180, step: 1 })),
        field('불투명도', rng(() => c.opacity, v => c.opacity = v)),
        field('합성', sel(() => c.blend, v => c.blend = v, [
          ['normal', '보통'], ['screen', '스크린'], ['multiply', '곱하기'],
          ['overlay', '오버레이'], ['lighter', '더하기'], ['difference', '차이']
        ])),
        field('페이드 없음', h('input', { type: 'checkbox', checked: !!c.noFade, onchange: e => { c.noFade = e.target.checked; mark(); save(); } }))
      );
      if (c.kind === 'video') {
        rows.append(
          field('영상 시작점', num(() => c.trimIn, v => c.trimIn = Math.max(0, v))),
          field('원본 음량', rng(() => c.volume, v => c.volume = v, { max: 1.5 }))
        );
      }
      break;
    }
  }

  box.append(h('button', { class: 'btn btn--sm insp__del', type: 'button', text: '이 클립 삭제', onclick: () => deleteClip(c.id) }));
}

/* ==========================================================================
   Programme metadata
   ========================================================================== */
function bindMeta() {
  const bind = (id, key, cast) => {
    const el = $(id);
    el.addEventListener('input', () => {
      P.meta[key] = cast ? cast(el.value) : el.value;
      mark();
    });
    el.addEventListener('change', save);
  };
  bind('#mTitle', 'title'); bind('#mSubtitle', 'subtitle'); bind('#mKicker', 'kicker');
  bind('#mEpNo', 'epNo', v => +v || 1); bind('#mEpTitle', 'epTitle');
  bind('#mStudio', 'studio'); bind('#mBug', 'bugText');
  $('#mShowBug').addEventListener('change', e => { P.showBug = e.target.checked; mark(); save(); });
  $('#mShowSafe').addEventListener('change', e => { P.showSafe = e.target.checked; mark(); save(); });
  $('#layerOrder').addEventListener('change', e => { P.layerOrder = e.target.value; mark(); save(); });
}

function syncMeta() {
  $('#mTitle').value = P.meta.title || '';
  $('#mSubtitle').value = P.meta.subtitle || '';
  $('#mKicker').value = P.meta.kicker || '';
  $('#mEpNo').value = P.meta.epNo || 1;
  $('#mEpTitle').value = P.meta.epTitle || '';
  $('#mStudio').value = P.meta.studio || '';
  $('#mBug').value = P.meta.bugText || '';
  $('#mShowBug').checked = !!P.showBug;
  $('#mShowSafe').checked = !!P.showSafe;
}

/* ==========================================================================
   Transport & playback
   ========================================================================== */
function bindTransport() {
  $('#btnPlay').addEventListener('click', () => playing ? pause() : play());
  $('#btnStop').addEventListener('click', () => { pause(); seek(0); });
  $('#scrub').addEventListener('input', e => seek(+e.target.value));
  document.addEventListener('keydown', e => {
    if (/^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName)) return;
    if (e.code === 'Space') { e.preventDefault(); playing ? pause() : play(); }
    if (e.code === 'Home') seek(0);
    if (e.code === 'ArrowLeft') seek(time - (e.shiftKey ? 1 : .1));
    if (e.code === 'ArrowRight') seek(time + (e.shiftKey ? 1 : .1));
    if (e.code === 'Delete' || e.code === 'Backspace') { if (selected) deleteClip(selected); }
  });
}

function play() {
  ensureCtx();
  playing = true;
  lastTick = performance.now();
  $('#btnPlay').textContent = '❚❚';
}
function pause() {
  playing = false;
  $('#btnPlay').textContent = '▶';
  audioEls.forEach(el => el.pause());
  media.forEach(el => { if (el.tagName === 'VIDEO') el.pause(); });
  audioNodes.forEach(n => n.gain.gain.value = 0);
  clipAudioNodes.forEach(n => n.gain.gain.value = 0);
}
function seek(t) {
  time = Math.max(0, Math.min(projectDuration(), t));
  $('#scrub').value = time;
  $('#tc').textContent = fmt(time);
  syncMediaTime(true);
  moveHead();
  mark();
}
function mark() { dirty = true; }

function syncMediaTime(force) {
  // videos
  P.clips.filter(c => c.type === 'media' && c.kind === 'video').forEach(c => {
    const v = media.get(c.id);
    if (!v) return;
    const inside = time >= c.start && time < c.start + c.dur;
    const want = (time - c.start) + (c.trimIn || 0);
    if (inside) {
      if (force || Math.abs(v.currentTime - want) > .34) { try { v.currentTime = Math.max(0, want); } catch (e) {} }
      if (playing && v.paused) v.play().catch(() => {});
      if (!playing && !v.paused) v.pause();
    } else if (!v.paused) v.pause();
  });
  // audio tracks
  P.audio.forEach(A => {
    const el = audioEls.get(A.id);
    if (!el) return;
    const dur = A.duration || 0;
    const inside = time >= A.start && (!dur || time < A.start + dur - (A.trimIn || 0));
    const want = (time - A.start) + (A.trimIn || 0);
    if (inside) {
      if (force || Math.abs(el.currentTime - want) > .34) { try { el.currentTime = Math.max(0, want); } catch (e) {} }
      if (playing && el.paused) el.play().catch(() => {});
      if (!playing && !el.paused) el.pause();
    } else if (!el.paused) el.pause();
  });
}

function applyGains() {
  const now = actx ? actx.currentTime : 0;
  P.audio.forEach(A => {
    const n = audioNodes.get(A.id);
    if (!n) return;
    const local = time - A.start;
    const dur = A.duration ? A.duration - (A.trimIn || 0) : Infinity;
    let g = 0;
    if (playing && local >= 0 && local < dur) {
      g = A.volume;
      if (A.fadeIn > 0) g *= Math.min(1, local / A.fadeIn);
      if (A.fadeOut > 0 && dur !== Infinity) g *= Math.min(1, Math.max(0, (dur - local) / A.fadeOut));
    }
    n.gain.gain.setTargetAtTime(g, now, .02);
  });
  P.clips.filter(c => c.type === 'media' && c.kind === 'video').forEach(c => {
    const n = clipAudioNodes.get(c.id);
    if (!n) return;
    const inside = playing && time >= c.start && time < c.start + c.dur;
    const layerOn = P.layers[1] && P.layers[1].visible;
    n.gain.gain.setTargetAtTime(inside && layerOn ? (c.volume ?? 1) : 0, now, .02);
  });
}

/* ---------- main loop ---------- */
function frame(now) {
  requestAnimationFrame(frame);
  // rAF hands back the frame-start timestamp, which can precede the
  // performance.now() we stored in play() — clamp so the clock never runs back.
  const dt = Math.max(0, Math.min(.25, (now - lastTick) / 1000));
  lastTick = now;

  if (playing) {
    time += dt;
    const dur = projectDuration();
    if (time >= dur) {
      if ($('#loop').checked) { time = 0; syncMediaTime(true); }
      else { time = dur; pause(); if (recorder) stopExport(); }
    }
    $('#scrub').value = time;
    $('#tc').textContent = fmt(time);
    syncMediaTime(false);
    moveHead();
    dirty = true;
  }
  applyGains();

  if (!dirty && !playing) return;
  dirty = false;
  draw();
}

function draw() {
  const { W, H } = dims();
  renderer.resize(W, H);
  const st = style();
  P.recording = !!recorder;
  renderer.render(P, time, media, st);
  const f = filterById(P.filter);
  $('#vpBadge').textContent = `${W}×${H} · ${st.year} ${st.ko} · ${f.ko}`;
}

/* ==========================================================================
   Export (WebM)
   ========================================================================== */
let recorder = null, chunks = [];

function pickMime() {
  const c = ['video/webm;codecs=vp9,opus', 'video/webm;codecs=vp8,opus', 'video/webm', 'video/mp4'];
  return c.find(m => window.MediaRecorder && MediaRecorder.isTypeSupported(m)) || '';
}

async function startExport() {
  if (!window.MediaRecorder || !canvas.captureStream) {
    toast('이 브라우저는 화면 녹화를 지원하지 않습니다. 크롬 또는 파이어폭스를 사용해 주세요.', true);
    return;
  }
  // The audio graph has to be running before the recorder starts, otherwise
  // the recorder waits forever on an audio track that never produces samples.
  try { await ensureCtx().resume(); } catch (e) { /* already running */ }
  pause(); seek(0);
  draw();

  const stream = canvas.captureStream(30);
  recDest.stream.getAudioTracks().forEach(t => stream.addTrack(t));

  const mime = pickMime();
  try {
    recorder = new MediaRecorder(stream, mime ? { mimeType: mime, videoBitsPerSecond: 9_000_000 } : undefined);
  } catch (e) {
    toast('녹화를 시작할 수 없습니다: ' + e.message, true);
    recorder = null; return;
  }
  chunks = [];
  recorder.ondataavailable = e => { if (e.data.size) chunks.push(e.data); };
  recorder.onstop = finishExport;
  recorder.start(200);

  $('#btnExport').classList.add('is-rec');
  $('#btnExport').lastChild.textContent = '녹화 중지';
  $('#loop').checked = false;
  toast(`실시간 녹화 중입니다 (${projectDuration().toFixed(1)}초). 이 탭을 열어 두세요.`);
  play();
}

function stopExport() {
  if (recorder && recorder.state !== 'inactive') recorder.stop();
}

function finishExport() {
  const type = recorder.mimeType || 'video/webm';
  recorder = null;
  pause();
  $('#btnExport').classList.remove('is-rec');
  $('#btnExport').lastChild.textContent = '내보내기 (WebM)';
  const blob = new Blob(chunks, { type });
  chunks = [];
  const url = URL.createObjectURL(blob);
  const name = (P.meta.title || 'kbs-media').replace(/[^\w가-힣.-]+/g, '_');
  const a = h('a', { href: url, download: `${name}_${P.meta.year}.${type.includes('mp4') ? 'mp4' : 'webm'}` });
  document.body.append(a); a.click();
  setTimeout(() => a.remove(), 1000);
  setTimeout(() => URL.revokeObjectURL(url), 20000);
  toast(`내보내기 완료 — ${(blob.size / 1048576).toFixed(1)} MB`);
  draw();
}

/* ==========================================================================
   Save / load / topbar
   ========================================================================== */
function serialisable() {
  const copy = JSON.parse(JSON.stringify(P));
  // object URLs are meaningless outside this session — drop them, keep names
  copy.clips.forEach(c => { if (c.type === 'media') { c.src = null; c.relink = true; } });
  copy.audio.forEach(a => { a.src = null; if (a.fileName) a.relink = true; });
  delete copy.recording;
  return copy;
}

function save() {
  try { localStorage.setItem(LS_KEY, JSON.stringify(serialisable())); } catch (e) { /* quota */ }
}

function load() {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (!raw) return null;
    const p = JSON.parse(raw);
    if (p.version !== 3) return null;
    // media clips can't survive a reload — their files live only in the tab
    p.clips = (p.clips || []).filter(c => c.type !== 'media');
    (p.audio || []).forEach(a => { a.src = null; a.fileName = ''; a.duration = 0; });
    return p;
  } catch (e) { return null; }
}

function bindTopbar() {
  $('#btnNew').addEventListener('click', () => {
    if (!confirm('새 프로젝트를 시작할까요? 저장하지 않은 내용은 사라집니다.')) return;
    P.clips.filter(c => c.type === 'media').forEach(c => deleteClip(c.id));
    P.audio.forEach(a => detachAudio(a));
    P = newProject();
    selected = null; seek(0); syncAll(); save();
  });

  $('#btnSave').addEventListener('click', () => {
    const blob = new Blob([JSON.stringify(serialisable(), null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const name = (P.meta.title || 'kbs-media').replace(/[^\w가-힣.-]+/g, '_');
    const a = h('a', { href: url, download: `${name}.kbsmvm.json` });
    document.body.append(a); a.click();
    setTimeout(() => a.remove(), 1000);
    setTimeout(() => URL.revokeObjectURL(url), 10000);
    toast('프로젝트를 저장했습니다. 영상 · 음원 파일은 다시 올려 주세요.');
  });

  $('#btnLoad').addEventListener('click', () => $('#projFile').click());
  $('#projFile').addEventListener('change', async e => {
    const f = e.target.files[0]; e.target.value = '';
    if (!f) return;
    try {
      const p = JSON.parse(await f.text());
      if (!p.meta || !p.clips) throw new Error('형식이 올바르지 않습니다.');
      P.clips.filter(c => c.type === 'media').forEach(c => deleteClip(c.id));
      P.audio.forEach(a => detachAudio(a));
      p.clips = p.clips.filter(c => c.type !== 'media');
      (p.audio || []).forEach(a => { a.src = null; a.fileName = ''; a.duration = 0; });
      P = p;
      selected = null; seek(0); syncAll(); save();
      toast('프로젝트를 불러왔습니다. 영상 · 음원은 다시 올려 주세요.');
    } catch (err) { toast('불러오기 실패: ' + err.message, true); }
  });

  $('#btnExport').addEventListener('click', () => recorder ? stopExport() : startExport());

  $('#btnAbout').addEventListener('click', () => { $('#about').hidden = false; });
  document.querySelectorAll('#about [data-close]').forEach(b => b.addEventListener('click', () => { $('#about').hidden = true; }));
  document.addEventListener('keydown', e => { if (e.key === 'Escape') $('#about').hidden = true; });
}

/* ==========================================================================
   Misc
   ========================================================================== */
let toastT = null;
function toast(msg, err) {
  const t = $('#toast');
  t.textContent = msg;
  t.classList.toggle('toast--err', !!err);
  t.hidden = false;
  clearTimeout(toastT);
  toastT = setTimeout(() => { t.hidden = true; }, err ? 6000 : 4000);
}

function syncAll() {
  syncYears(); syncChips(); syncLayers(); syncAudio(); syncMeta(); syncTimeline(); syncInspector();
  mark();
}

window.addEventListener('beforeunload', save);
