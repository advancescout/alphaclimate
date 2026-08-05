/* ==========================================================================
   KBS Media Video Maker — sequence templates
   Builds a full opening or ending sequence (title card, staff lower-thirds,
   cast list, credit roll) from the chosen year, programme type and metadata.
   ========================================================================== */

import { programmeType, yearStyle } from './eras.js';

export const uid = (() => { let n = 0; return p => `${p}_${(++n).toString(36)}${Math.random().toString(36).slice(2, 6)}`; })();

/* Placeholder names are deliberately generic Korean staff/actor names — they
   are meant to be typed over, not shipped as real credits. */
const SAMPLE_STAFF = ['김영수', '박지훈', '이수진', '정민호', '한서연', '오재현', '윤가은', '조성우', '배다혜', '신동하'];
const SAMPLE_CAST = ['강희정', '문태식', '서지연', '남기범', '류혜원', '표승철', '연미주', '하윤성'];

function pick(arr, i) { return arr[i % arr.length]; }

/* --------------------------------------------------------------------------
   Opening sequence
   -------------------------------------------------------------------------- */
export function buildOpening(meta) {
  const st = yearStyle(meta.year);
  const pt = programmeType(meta.type);
  const s = 1 / (st.motion.speed || 1);          // era pacing multiplier
  const clips = [];
  let t = 0;

  const push = (c, dur) => { clips.push({ id: uid('c'), layer: 0, start: +t.toFixed(2), dur: +dur.toFixed(2), ...c }); t += dur; };

  // 1 — production ident / advisory slate
  push({
    type: 'ident',
    line1: meta.studio || '제작 · 스튜디오명',
    line2: pt.dubNotes ? '한국어판 제작' : '제 작',
    align: 'center'
  }, 2.4 * s);

  // 2 — main title card
  push({
    type: 'card',
    kicker: meta.kicker || (pt.dubNotes ? '외화 시리즈' : ''),
    title: meta.title || '프로그램 제목',
    sub: meta.subtitle || '',
    align: 'center'
  }, 3.6 * s);

  // 3 — episode number + episode title
  if (meta.epNo) {
    push({
      type: 'ep',
      epNo: meta.epNo,
      epLabelPre: pt.titleLabel,
      epLabelPost: pt.epLabel,
      epTitle: meta.epTitle || '',
      align: 'center'
    }, 2.8 * s);
  }

  // 4 — staff lower-thirds, two roles at a time
  const roles = pt.roles.slice(0, 6);
  roles.forEach((role, i) => {
    push({
      type: 'lower',
      role,
      name: pick(SAMPLE_STAFF, i),
      align: st.id === 'flat' || st.id === 'modern' ? 'left' : 'center',
      pos: 'lower'
    }, 1.9 * s);
  });

  // 5 — cast / voice cast block
  push({
    type: 'roll',
    header: pt.castLabel,
    mode: 'block',
    rows: SAMPLE_CAST.slice(0, 6).map(n => ({ role: '', name: n })),
    align: 'center'
  }, 4.0 * s);

  return { clips, duration: +t.toFixed(2) };
}

/* --------------------------------------------------------------------------
   Ending / credit roll
   -------------------------------------------------------------------------- */
export function buildEnding(meta) {
  const st = yearStyle(meta.year);
  const pt = programmeType(meta.type);
  const s = 1 / (st.motion.speed || 1);
  const clips = [];
  let t = 0;
  const push = (c, dur) => { clips.push({ id: uid('c'), layer: 0, start: +t.toFixed(2), dur: +dur.toFixed(2), ...c }); t += dur; };

  const rows = [];
  if (pt.dubNotes) {
    rows.push({ role: pt.castLabel, name: '' });
    SAMPLE_CAST.slice(0, 5).forEach(n => rows.push({ role: '', name: n }));
    rows.push({ role: '', name: '' });
  }
  pt.roles.forEach((role, i) => rows.push({ role, name: pick(SAMPLE_STAFF, i + 3) }));
  rows.push({ role: '', name: '' });
  rows.push({ role: '', name: meta.studio || '스튜디오명' });

  // A roll's duration is driven by how far the list has to travel.
  const rollDur = Math.max(8, rows.length * 1.15) * s;

  push({
    type: 'roll',
    header: '',
    mode: 'scroll',
    rows,
    align: 'split'
  }, rollDur);

  push({
    type: 'card',
    kicker: '',
    title: meta.nextTitle || '다음 회 예고',
    sub: meta.nextSub || '',
    align: 'center'
  }, 3.0 * s);

  return { clips, duration: +t.toFixed(2) };
}

/* --------------------------------------------------------------------------
   Dub caption band — one subtitle clip per line of dialogue.
   Lines arrive as "0:02.5 대사 내용" or plain lines (auto-timed).
   -------------------------------------------------------------------------- */
export function buildCaptions(text, startAt = 0, perLine = 2.6) {
  const out = [];
  let t = startAt;
  text.split('\n').map(l => l.trim()).filter(Boolean).forEach(line => {
    const m = line.match(/^(\d+):(\d+(?:\.\d+)?)\s+(.*)$/);
    let start = t, body = line;
    if (m) { start = (+m[1]) * 60 + parseFloat(m[2]); body = m[3]; }
    const speaker = body.match(/^([^:：]{1,12})[:：]\s*(.*)$/);
    out.push({
      id: uid('c'), layer: 0, type: 'sub', start: +start.toFixed(2), dur: perLine,
      speaker: speaker ? speaker[1] : '', text: speaker ? speaker[2] : body
    });
    t = start + perLine;
  });
  return out;
}

/* --------------------------------------------------------------------------
   A brand-new empty project.
   -------------------------------------------------------------------------- */
export function newProject() {
  return {
    version: 3,
    meta: {
      title: '이름 없는 프로그램',
      subtitle: '',
      kicker: '',
      epNo: 1,
      epTitle: '',
      studio: '',
      nextTitle: '다음 회 예고',
      nextSub: '',
      year: 1997,
      type: 'anime-dub',
      bugText: ''
    },
    filter: 'svhs95',
    aspect: 'auto',
    showBug: true,
    showSafe: false,
    layers: [
      { id: uid('L'), name: '1 · 기본 (자막 · 타이틀)', kind: 'base', visible: true, opacity: 1 },
      { id: uid('L'), name: '2 · 미디어 (영상 · 이미지)', kind: 'media', visible: true, opacity: 1 }
    ],
    layerOrder: 'media-under',   // media-under | media-over
    clips: [],
    audio: [
      { id: uid('A'), role: 'music', name: '음악 (오프닝/엔딩)', src: null, fileName: '', volume: .8, start: 0, fadeIn: 1.0, fadeOut: 2.0, trimIn: 0 },
      { id: uid('A'), role: 'dub', name: '더빙 (성우 녹음)', src: null, fileName: '', volume: 1.0, start: 0, fadeIn: 0, fadeOut: 0, trimIn: 0 }
    ],
    duration: 20
  };
}
