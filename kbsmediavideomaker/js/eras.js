/* ==========================================================================
   KBS Media Video Maker — era style system (1991 → 2026)
   --------------------------------------------------------------------------
   Every year from 1991 to 2026 maps to a broadcast "look": typeface stack,
   palette, title geometry, animation preset and default tape filter.
   Years inside an era share a family resemblance but each individual year
   nudges the animation (speed, overshoot, hold, tracking, hue) so that
   clicking a year visibly changes the motion, not just the colours.

   Typefaces are open-licence Korean families (SIL OFL) chosen because their
   skeletons match what Korean broadcast captions actually looked like in each
   period — Myeongjo-style serifs through the analogue 90s, Gothic sans as
   digital titling arrived, geometric/variable sans in the streaming era.
   No broadcaster-owned font, logo, music or recording ships with this tool.
   ========================================================================== */

export const FONT_FAMILIES = [
  'Nanum Myeongjo', 'Song Myung', 'Gowun Batang', 'Hahmlet',
  'Nanum Gothic', 'Gothic A1', 'Noto Sans KR', 'IBM Plex Sans KR',
  'Black Han Sans', 'Do Hyeon', 'Jua', 'Gowun Dodum', 'Nanum Pen Script',
  'Nanum Gothic Coding'
];

/* Weight/size probes the canvas needs warmed before first paint — a canvas
   will silently fall back to a system face if the webfont isn't resolved. */
export const FONT_PROBES = [
  '400 64px "Nanum Myeongjo"', '800 64px "Nanum Myeongjo"',
  '400 64px "Song Myung"', '400 64px "Gowun Batang"', '700 64px "Gowun Batang"',
  '300 64px "Hahmlet"', '700 64px "Hahmlet"',
  '400 64px "Nanum Gothic"', '800 64px "Nanum Gothic"',
  '300 64px "Gothic A1"', '500 64px "Gothic A1"', '900 64px "Gothic A1"',
  '200 64px "Noto Sans KR"', '400 64px "Noto Sans KR"', '700 64px "Noto Sans KR"', '900 64px "Noto Sans KR"',
  '300 64px "IBM Plex Sans KR"', '600 64px "IBM Plex Sans KR"',
  '400 64px "Black Han Sans"', '400 64px "Do Hyeon"', '400 64px "Jua"',
  '400 64px "Gowun Dodum"', '400 64px "Nanum Pen Script"', '400 32px "Nanum Gothic Coding"'
];

/* --------------------------------------------------------------------------
   Font stacks
   The webfonts come from Google Fonts, which is not reachable everywhere —
   corporate networks block it, and the Artifact sandbox blocks it outright.
   Each stack therefore falls through to the Korean faces that ship with
   macOS/iOS, Windows and Android/Linux, so an era still reads as Myeongjo
   (serif) or Gothic (sans) even when nothing downloads.
   -------------------------------------------------------------------------- */
const SERIF_FALLBACK = 'AppleMyungjo, Batang, "Noto Serif KR", "Noto Serif CJK KR", "Source Han Serif K", serif';
const SANS_FALLBACK = '"Apple SD Gothic Neo", "Malgun Gothic", "Noto Sans CJK KR", "Source Han Sans K", NanumGothic, Dotum, sans-serif';
const serif = (...names) => names.map(n => `"${n}"`).join(', ') + ', ' + SERIF_FALLBACK;
const sans = (...names) => names.map(n => `"${n}"`).join(', ') + ', ' + SANS_FALLBACK;

/* --------------------------------------------------------------------------
   Eras
   -------------------------------------------------------------------------- */
export const ERAS = [
  {
    id: 'analogue',
    from: 1991, to: 1994,
    ko: '아날로그 명조', en: 'Analogue Myeongjo',
    blurb: '4:3 명조체 자막. 두꺼운 검은 그림자, 크림색 글자, 느린 페이드.',
    aspect: '4:3',
    filter: 'vhs91',
    fonts: { display: serif('Nanum Myeongjo'), body: serif('Nanum Myeongjo'), caption: serif('Nanum Myeongjo') },
    weights: { display: 800, body: 400 },
    pal: { bg: '#000000', fg: '#f4ecda', sub: '#d8cbae', accent: '#d9412f', rule: '#c8a02c', plate: 'rgba(0,0,0,0)' },
    type: { track: 0.015, lineGap: 1.34, titleScale: 1.0, shadow: { x: 5, y: 5, blur: 0, color: 'rgba(0,0,0,.92)' }, stroke: 0 },
    anim: { card: 'fadeHold', lower: 'fadeHold', roll: 'rollUp', episode: 'fadeHold' },
    plate: 'none', rule: 'double', bug: 'corner-text', letterbox: 0
  },
  {
    id: 'gold',
    from: 1995, to: 1998,
    ko: '금장 고딕', en: 'Gold-Bevel Gothic',
    blurb: '금색 그라데이션 제목, 좌우 와이프, 굵은 고딕 부제.',
    aspect: '4:3',
    filter: 'svhs95',
    fonts: { display: serif('Song Myung', 'Nanum Myeongjo'), body: sans('Nanum Gothic'), caption: sans('Nanum Gothic') },
    weights: { display: 400, body: 800 },
    pal: { bg: '#050403', fg: '#ffe9a8', sub: '#efe3c8', accent: '#e8b53c', rule: '#8d6a1c', plate: 'rgba(0,0,0,0)' },
    type: { track: 0.03, lineGap: 1.3, titleScale: 1.02, shadow: { x: 3, y: 4, blur: 2, color: 'rgba(0,0,0,.85)' }, stroke: 0 },
    anim: { card: 'wipeH', lower: 'wipeH', roll: 'rollUp', episode: 'wipeH' },
    plate: 'none', rule: 'single', bug: 'corner-text', letterbox: 0,
    gradient: ['#fff6d4', '#e8b53c', '#8d6a1c', '#f7dd94']
  },
  {
    id: 'digital',
    from: 1999, to: 2002,
    ko: '디지털 도입', en: 'Digital Onset',
    blurb: '파란 그라데이션 판, 좌측 슬라이드 인, 자막 바.',
    aspect: '4:3',
    filter: 'beta99',
    fonts: { display: sans('Nanum Gothic'), body: sans('Nanum Gothic'), caption: sans('Nanum Gothic') },
    weights: { display: 800, body: 400 },
    pal: { bg: '#02060f', fg: '#ffffff', sub: '#c9dcf5', accent: '#2f7fe0', rule: '#1b4d8f', plate: 'rgba(12,42,88,.86)' },
    type: { track: 0.0, lineGap: 1.28, titleScale: 0.98, shadow: { x: 2, y: 2, blur: 3, color: 'rgba(0,0,0,.7)' }, stroke: 0 },
    anim: { card: 'slidePlate', lower: 'slidePlate', roll: 'rollUp', episode: 'slidePlate' },
    plate: 'gradient', rule: 'single', bug: 'corner-plate', letterbox: 0
  },
  {
    id: 'soft',
    from: 2003, to: 2007,
    ko: '부드러운 고딕', en: 'Soft Gothic',
    blurb: '레터박스 16:9, 은은한 글로우 디졸브, 반투명 바.',
    aspect: '16:9',
    filter: 'dv03',
    fonts: { display: sans('Gothic A1'), body: sans('Gothic A1'), caption: sans('Nanum Gothic') },
    weights: { display: 900, body: 400 },
    pal: { bg: '#04060a', fg: '#ffffff', sub: '#d6dee8', accent: '#5fb0e8', rule: '#2a4054', plate: 'rgba(6,14,24,.62)' },
    type: { track: 0.01, lineGap: 1.3, titleScale: 0.96, shadow: { x: 0, y: 2, blur: 12, color: 'rgba(0,0,0,.75)' }, stroke: 0 },
    anim: { card: 'glowDissolve', lower: 'glowDissolve', roll: 'rollUp', episode: 'glowDissolve' },
    plate: 'soft', rule: 'single', bug: 'corner-plate', letterbox: 0.06
  },
  {
    id: 'hd',
    from: 2008, to: 2012,
    ko: 'HD 전환', en: 'HD Transition',
    blurb: '가는 고딕, 얇은 괘선, 블러 인. 완전한 16:9.',
    aspect: '16:9',
    filter: 'hd08',
    fonts: { display: sans('Noto Sans KR'), body: sans('Noto Sans KR'), caption: sans('Noto Sans KR') },
    weights: { display: 300, body: 300 },
    pal: { bg: '#06080b', fg: '#ffffff', sub: '#b9c3cf', accent: '#7fd3ff', rule: '#3b4854', plate: 'rgba(8,12,18,.55)' },
    type: { track: 0.08, lineGap: 1.4, titleScale: 0.9, shadow: { x: 0, y: 1, blur: 8, color: 'rgba(0,0,0,.55)' }, stroke: 0 },
    anim: { card: 'blurIn', lower: 'blurIn', roll: 'rollUp', episode: 'blurIn' },
    plate: 'rule', rule: 'hair', bug: 'corner-plate', letterbox: 0
  },
  {
    id: 'flat',
    from: 2013, to: 2017,
    ko: '플랫 타이포', en: 'Flat Typography',
    blurb: '넓은 자간, 마스크 와이프, 얇은 선. 플랫 디자인.',
    aspect: '16:9',
    filter: 'dig14',
    fonts: { display: sans('Noto Sans KR'), body: sans('Gothic A1'), caption: sans('Gothic A1') },
    weights: { display: 700, body: 400 },
    pal: { bg: '#0a0c10', fg: '#ffffff', sub: '#aab4c0', accent: '#ff5a5f', rule: '#ffffff', plate: 'rgba(255,255,255,.06)' },
    type: { track: 0.16, lineGap: 1.45, titleScale: 0.86, shadow: { x: 0, y: 0, blur: 0, color: 'rgba(0,0,0,0)' }, stroke: 0 },
    anim: { card: 'maskWipe', lower: 'maskWipe', roll: 'rollUp', episode: 'maskWipe' },
    plate: 'flat', rule: 'hair', bug: 'corner-flat', letterbox: 0
  },
  {
    id: 'kinetic',
    from: 2018, to: 2022,
    ko: '키네틱', en: 'Kinetic Display',
    blurb: '굵은 기하 고딕, 글자별 스태거 팝, 강한 대비.',
    aspect: '16:9',
    filter: 'uhd21',
    fonts: { display: sans('Black Han Sans', 'Noto Sans KR'), body: sans('Noto Sans KR'), caption: sans('Noto Sans KR') },
    weights: { display: 400, body: 500 },
    pal: { bg: '#08090c', fg: '#ffffff', sub: '#9aa3b2', accent: '#ffd166', rule: '#ffd166', plate: 'rgba(255,209,102,.14)' },
    type: { track: -0.01, lineGap: 1.18, titleScale: 1.06, shadow: { x: 0, y: 6, blur: 22, color: 'rgba(0,0,0,.6)' }, stroke: 0 },
    anim: { card: 'kineticPop', lower: 'kineticPop', roll: 'rollUp', episode: 'kineticPop' },
    plate: 'accent', rule: 'thick', bug: 'corner-flat', letterbox: 0
  },
  {
    id: 'modern',
    from: 2023, to: 2026,
    ko: '현대 스트리밍', en: 'Streaming Modern',
    blurb: '가변 굵기, 스프링 스택 등장, 미니멀 그라데이션.',
    aspect: '16:9',
    filter: 'none',
    fonts: { display: sans('IBM Plex Sans KR'), body: sans('IBM Plex Sans KR'), caption: sans('Noto Sans KR') },
    weights: { display: 600, body: 300 },
    pal: { bg: '#0b0d12', fg: '#f5f7fb', sub: '#96a0b0', accent: '#8b7bff', rule: '#8b7bff', plate: 'rgba(139,123,255,.12)' },
    type: { track: 0.02, lineGap: 1.24, titleScale: 0.94, shadow: { x: 0, y: 10, blur: 34, color: 'rgba(0,0,0,.55)' }, stroke: 0 },
    anim: { card: 'springStack', lower: 'springStack', roll: 'rollUp', episode: 'springStack' },
    plate: 'glass', rule: 'hair', bug: 'corner-flat', letterbox: 0
  }
];

export const YEAR_MIN = 1991;
export const YEAR_MAX = 2026;

export function eraForYear(year) {
  const y = Math.min(YEAR_MAX, Math.max(YEAR_MIN, year | 0));
  return ERAS.find(e => y >= e.from && y <= e.to) || ERAS[ERAS.length - 1];
}

/* --------------------------------------------------------------------------
   Per-year motion tweak
   Within an era, the later years run a little tighter and quicker — the same
   drift real broadcast packages had as editing gear got faster. A handful of
   specific years also carry a one-off quirk (a wider tracking, a harder
   overshoot) so that no two years animate identically.
   -------------------------------------------------------------------------- */
const YEAR_QUIRKS = {
  1991: { hold: 1.25, speed: 0.82, note: '가장 느린 페이드' },
  1994: { track: 0.05 },
  1996: { overshoot: 1.06 },
  1998: { speed: 1.12 },
  2000: { track: 0.06, note: '밀레니엄 자간' },
  2002: { overshoot: 1.05 },
  2005: { hold: 1.1 },
  2009: { track: 0.12 },
  2011: { speed: 1.1 },
  2015: { track: 0.22, note: '가장 넓은 자간' },
  2018: { overshoot: 1.16 },
  2020: { speed: 0.94, hold: 1.12 },
  2024: { overshoot: 1.12 },
  2026: { speed: 1.18, note: '가장 빠른 등장' }
};

export function yearStyle(year) {
  const era = eraForYear(year);
  const span = Math.max(1, era.to - era.from);
  const t = (year - era.from) / span;            // 0 at era start → 1 at era end
  const q = YEAR_QUIRKS[year] || {};

  const style = structuredClone(era);
  style.year = year;
  style.motion = {
    // later years in an era animate ~18% quicker
    speed: (0.9 + t * 0.18) * (q.speed ?? 1),
    // and hold a touch less
    hold: (1.12 - t * 0.2) * (q.hold ?? 1),
    overshoot: q.overshoot ?? (era.id === 'kinetic' || era.id === 'modern' ? 1.08 : 1.0),
    stagger: era.id === 'kinetic' ? 0.03 : era.id === 'modern' ? 0.045 : 0.0
  };
  style.type = { ...era.type, track: era.type.track + (q.track != null ? q.track - era.type.track : t * 0.012) };
  // Accent hue drifts slightly across an era so 1991 ≠ 1994 on screen.
  style.pal = { ...era.pal, accent: shiftHue(era.pal.accent, (t - 0.5) * 16) };
  style.note = q.note || null;
  return style;
}

/* --------------------------------------------------------------------------
   Programme types — each brings its own credit vocabulary and layout bias.
   -------------------------------------------------------------------------- */
export const PROGRAMME_TYPES = [
  {
    id: 'drama', ko: 'TV 드라마', en: 'TV series',
    titleLabel: '제', epLabel: '부',
    roles: ['극본', '연출', '촬영', '조명', '음악', '미술', '편집', '기술감독', '책임프로듀서'],
    castLabel: '출연',
    accentBias: 0
  },
  {
    id: 'animation', ko: '애니메이션', en: 'Animation',
    titleLabel: '제', epLabel: '화',
    roles: ['원작', '감독', '각본', '작화감독', '미술', '음악', '편집', '제작'],
    castLabel: '목소리 출연',
    accentBias: 14
  },
  {
    id: 'anime-dub', ko: '외화 더빙 (애니)', en: 'Anime — Korean dub',
    titleLabel: '제', epLabel: '화',
    roles: ['원작', '연출', '한국어판 연출', '번역', '녹음', '믹싱', '음악', '한국어판 제작'],
    castLabel: '성우',
    accentBias: 28,
    dubNotes: true
  },
  {
    id: 'kids', ko: '어린이 프로그램', en: 'Children’s programme',
    titleLabel: '제', epLabel: '회',
    roles: ['구성', '연출', '음악', '미술', '제작'],
    castLabel: '출연',
    accentBias: 42
  },
  {
    id: 'documentary', ko: '다큐멘터리', en: 'Documentary',
    titleLabel: '제', epLabel: '편',
    roles: ['구성', '연출', '촬영', '내레이션', '음악', '자료조사', '책임프로듀서'],
    castLabel: '내레이션',
    accentBias: -18
  },
  {
    id: 'music', ko: '음악 프로그램', en: 'Music programme',
    titleLabel: '제', epLabel: '회',
    roles: ['연출', '음악감독', '무대', '조명', '음향', '제작'],
    castLabel: '출연',
    accentBias: -34
  },
  {
    id: 'foreign-drama', ko: '외화 더빙 (드라마)', en: 'Foreign drama — Korean dub',
    titleLabel: '제', epLabel: '화',
    roles: ['원작', '한국어판 연출', '번역', '녹음', '믹싱', '한국어판 제작'],
    castLabel: '성우',
    accentBias: 8,
    dubNotes: true
  }
];

export function programmeType(id) {
  return PROGRAMME_TYPES.find(p => p.id === id) || PROGRAMME_TYPES[0];
}

/* --------------------------------------------------------------------------
   Tape / camera filters. `none` is a real option — the user asked to be able
   to see the picture with no VHS treatment at all.
   -------------------------------------------------------------------------- */
export const FILTERS = [
  { id: 'none', ko: '필터 없음', en: 'No filter', desc: '깨끗한 디지털 화면.',
    p: null },
  { id: 'vhs91', ko: 'VHS 1991', en: 'VHS (worn)', desc: '심한 색번짐, 트래킹 흔들림, 헤드 스위칭 노이즈.',
    p: { bleed: 5, noise: .30, scan: .30, headSwitch: .95, jitter: 1.6, sat: .82, contrast: .94, bloom: .18, vignette: .40, dropout: .35, comb: 0 } },
  { id: 'vhs94', ko: 'VHS 재복사', en: 'VHS (n-th generation)', desc: '여러 번 복사한 테이프. 드롭아웃과 워우플러터.',
    p: { bleed: 8, noise: .46, scan: .34, headSwitch: 1, jitter: 3.0, sat: .68, contrast: .86, bloom: .26, vignette: .5, dropout: .8, comb: 0, wow: 1 } },
  { id: 'svhs95', ko: 'S-VHS 1995', en: 'S-VHS', desc: '선명하지만 여전히 아날로그. 옅은 색번짐.',
    p: { bleed: 2.5, noise: .17, scan: .22, headSwitch: .5, jitter: .7, sat: .92, contrast: 1.0, bloom: .12, vignette: .28, dropout: .12, comb: 0 } },
  { id: 'beta99', ko: '베타캠 1999', en: 'Betacam SP', desc: '방송용 아날로그. 인터레이스 빗살과 옅은 블룸.',
    p: { bleed: 1.2, noise: .10, scan: .12, headSwitch: 0, jitter: .25, sat: 1.0, contrast: 1.04, bloom: .16, vignette: .2, dropout: 0, comb: .5 } },
  { id: 'dv03', ko: 'DV 2003', en: 'DV / DigiBeta', desc: '디지털 테이프. 또렷한 대비, 미세한 노이즈.',
    p: { bleed: .5, noise: .07, scan: .06, headSwitch: 0, jitter: .1, sat: 1.05, contrast: 1.08, bloom: .08, vignette: .16, dropout: 0, comb: .28 } },
  { id: 'hd08', ko: 'HD 2008', en: 'Early HD', desc: '부드러운 블룸만 남은 초기 HD 룩.',
    p: { bleed: 0, noise: .04, scan: 0, headSwitch: 0, jitter: 0, sat: 1.02, contrast: 1.02, bloom: .14, vignette: .12, dropout: 0, comb: 0 } },
  { id: 'dig14', ko: '디지털 2014', en: 'Digital broadcast', desc: '깨끗함. 아주 옅은 비네트만.',
    p: { bleed: 0, noise: .02, scan: 0, headSwitch: 0, jitter: 0, sat: 1.04, contrast: 1.03, bloom: .06, vignette: .08, dropout: 0, comb: 0 } },
  { id: 'uhd21', ko: 'UHD 2021', en: 'UHD / HDR-ish', desc: '넓은 채도와 강한 대비.',
    p: { bleed: 0, noise: .012, scan: 0, headSwitch: 0, jitter: 0, sat: 1.12, contrast: 1.06, bloom: .10, vignette: .06, dropout: 0, comb: 0 } },
  { id: 'kine', ko: '텔레시네', en: 'Telecine (film)', desc: '필름 그레인, 게이트 위빙, 따뜻한 색.',
    p: { bleed: .4, noise: .28, scan: 0, headSwitch: 0, jitter: 1.1, sat: .95, contrast: 1.1, bloom: .2, vignette: .34, dropout: .05, comb: 0, warm: .16, grain: 1 } }
];

export function filterById(id) { return FILTERS.find(f => f.id === id) || FILTERS[0]; }

/* --------------------------------------------------------------------------
   Colour helpers
   -------------------------------------------------------------------------- */
export function hexToRgb(hex) {
  const h = hex.replace('#', '');
  const n = parseInt(h.length === 3 ? h.split('').map(c => c + c).join('') : h, 16);
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
}
export function rgbToHex(r, g, b) {
  const c = v => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0');
  return '#' + c(r) + c(g) + c(b);
}
export function shiftHue(hex, deg) {
  const { r, g, b } = hexToRgb(hex);
  const [h, s, l] = rgbToHsl(r, g, b);
  const [nr, ng, nb] = hslToRgb((h + deg / 360 + 1) % 1, s, l);
  return rgbToHex(nr, ng, nb);
}
function rgbToHsl(r, g, b) {
  r /= 255; g /= 255; b /= 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  let h = 0, s = 0; const l = (max + min) / 2;
  if (max !== min) {
    const d = max - min;
    s = l > .5 ? d / (2 - max - min) : d / (max + min);
    if (max === r) h = (g - b) / d + (g < b ? 6 : 0);
    else if (max === g) h = (b - r) / d + 2;
    else h = (r - g) / d + 4;
    h /= 6;
  }
  return [h, s, l];
}
function hslToRgb(h, s, l) {
  if (s === 0) { const v = l * 255; return [v, v, v]; }
  const q = l < .5 ? l * (1 + s) : l + s - l * s;
  const p = 2 * l - q;
  const f = t => {
    if (t < 0) t += 1; if (t > 1) t -= 1;
    if (t < 1 / 6) return p + (q - p) * 6 * t;
    if (t < 1 / 2) return q;
    if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
    return p;
  };
  return [f(h + 1 / 3) * 255, f(h) * 255, f(h - 1 / 3) * 255];
}
export function withAlpha(hex, a) {
  const { r, g, b } = hexToRgb(hex);
  return `rgba(${r},${g},${b},${a})`;
}
