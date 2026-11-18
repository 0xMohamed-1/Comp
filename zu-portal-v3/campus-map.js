/* ==================================================================== */
/* 8. CAMPUS MAP (extra) — "Where are the classrooms?"                   */
/* ==================================================================== */
// A schematic of the Zayed University Abu Dhabi campus, redrawn from the official
// "ZU Campus Plan, Abu Dhabi" drawing (May 2023). This file holds only the drawing
// (building outlines and positions), like an image would. It holds no student or
// course data: those still come from the CSV files in ./data.
// Loaded after app.js, so it can use $, esc, ic, applyLang, STATE and PAGES.

const CM_CAT = {
  teach:   { label: 'Teaching building (classrooms)', short: 'Teaching' },
  mixed:   { label: 'Teaching spaces + student activities', short: 'Teaching + activities' },
  spec:    { label: 'Specialist teaching (science / arts)', short: 'Specialist' },
  fac:     { label: 'Faculty offices', short: 'Faculty' },
  central: { label: 'Central / shared', short: 'Dining / IS' },
  other:   { label: 'Residence, sports, services', short: 'Other' },
};
const CM_SIDE = { F: 'Female campus', M: 'Male campus', C: 'Central campus' };

// x, y = centre on the plan; w, h = size; a = rotation in degrees.
const CM_BUILDINGS = [
  // female side
  { c: 'F1', n: 'Teaching Building', cat: 'teach', s: 'F', x: 640, y: 728, w: 110, h: 68, a: 17 },
  { c: 'F2', n: 'Teaching Building', cat: 'teach', s: 'F', x: 665, y: 628, w: 92, h: 58, a: 17 },
  { c: 'F8', n: 'Teaching Building', cat: 'teach', s: 'F', x: 662, y: 795, w: 128, h: 58, a: 17 },
  { c: 'F3', n: 'Student Activities / Teaching Spaces', cat: 'mixed', s: 'F', x: 585, y: 616, w: 70, h: 50, a: 17 },
  { c: 'F4', n: 'Student Activities / Teaching Spaces', cat: 'mixed', s: 'F', x: 560, y: 688, w: 60, h: 46, a: 17 },
  { c: 'F5', n: 'Science Building', cat: 'spec', s: 'F', x: 720, y: 574, w: 140, h: 56, a: 17 },
  { c: 'F6', n: 'Arts Building', cat: 'spec', s: 'F', x: 745, y: 500, w: 124, h: 56, a: 17 },
  { c: 'F9', n: 'Early Childhood Centre', cat: 'other', s: 'F', x: 635, y: 862, w: 110, h: 50, a: 17 },
  { c: 'FF1', n: 'Faculty Building', cat: 'fac', s: 'F', x: 805, y: 612, w: 72, h: 54, a: 17 },
  { c: 'FF2', n: 'Faculty Building', cat: 'fac', s: 'F', x: 793, y: 665, w: 72, h: 50, a: 17 },
  { c: 'FF3', n: 'Faculty Building', cat: 'fac', s: 'F', x: 772, y: 745, w: 72, h: 50, a: 17 },
  { c: 'FSP', n: 'Sports and Recreation Centre', cat: 'other', s: 'F', x: 478, y: 622, w: 70, h: 112, a: 17 },
  { c: 'FR1', n: "Women's Residence", cat: 'other', s: 'F', x: 522, y: 815, w: 42, h: 110, a: 0 },
  { c: 'SV1', n: 'Service Building 1', cat: 'other', s: 'F', x: 180, y: 805, w: 120, h: 56, a: 0 },
  // male side
  { c: 'M1', n: 'Teaching Building', cat: 'teach', s: 'M', x: 1268, y: 728, w: 82, h: 60, a: -17 },
  { c: 'M2', n: 'Teaching Building', cat: 'teach', s: 'M', x: 1240, y: 620, w: 82, h: 56, a: -17 },
  { c: 'M3', n: 'Student Activities / Teaching Spaces', cat: 'mixed', s: 'M', x: 1322, y: 622, w: 70, h: 50, a: -17 },
  { c: 'M4', n: 'Student Activities / Teaching Spaces', cat: 'mixed', s: 'M', x: 1343, y: 688, w: 60, h: 46, a: -17 },
  { c: 'MF1', n: 'Faculty Building', cat: 'fac', s: 'M', x: 1092, y: 618, w: 72, h: 54, a: -17 },
  { c: 'MF2', n: 'Faculty Building', cat: 'fac', s: 'M', x: 1105, y: 672, w: 72, h: 50, a: -17 },
  { c: 'MF3', n: 'Faculty Building', cat: 'fac', s: 'M', x: 1125, y: 745, w: 72, h: 50, a: -17 },
  { c: 'MR1', n: "Men's Residence", cat: 'other', s: 'M', x: 1375, y: 815, w: 42, h: 110, a: 0 },
  { c: 'SV2', n: 'Service Building 2', cat: 'other', s: 'M', x: 1680, y: 860, w: 110, h: 56, a: 0 },
  // central
  { c: 'CON', n: 'Convention Centre', cat: 'central', s: 'C', x: 945, y: 455, shape: 'ellipse', w: 120, h: 80 },
  { c: 'ADM', n: 'Administration Building', cat: 'central', s: 'C', x: 950, y: 532, shape: 'arc' },
  { c: 'LIB', n: 'Library', cat: 'central', s: 'C', x: 945, y: 800, shape: 'ellipse', w: 92, h: 118 },
  { c: 'FDH', alias: ['FIS', 'FDH/FIS'], n: 'Female Dining Hall / Interdisciplinary Studies', cat: 'central', s: 'C', x: 855, y: 724, w: 104, h: 34, a: 13, label: 'FDH/FIS' },
  { c: 'MDH', alias: ['MIS', 'MDH/MIS'], n: 'Male Dining Hall / Interdisciplinary Studies', cat: 'central', s: 'C', x: 1043, y: 724, w: 104, h: 34, a: -13, label: 'MDH/MIS' },
];
const CM_NOTES = {
  F1: 'On the Female Promenade, just south of F2. Main teaching block on the female side.',
  F2: 'On the Female Promenade between F3 and FF2.',
  F8: 'South of F1, next to the Early Childhood Centre (F9). Reception B is nearby.',
  F3: 'West end of the Female Promenade, beside the Sports and Recreation Centre.',
  F4: 'West end of the Female Promenade, just below F3.',
  F5: 'Science labs, north of F2 and next to the faculty building FF1.',
  F6: 'Arts studios at the north end of the female campus, near Reception A.',
  M1: 'On the Male Promenade, south side, near MF3.',
  M2: 'On the Male Promenade, north side, east of MF1/MF2.',
  M3: 'East end of the Male Promenade, north side.',
  M4: 'East end of the Male Promenade, south side.',
  FDH: 'Links the female wing to the Library. The plan lists Interdisciplinary Studies here alongside the dining hall.',
  MDH: 'Links the male wing to the Library. The plan lists Interdisciplinary Studies here alongside the dining hall.',
};
const CM_CLASSROOMS = {
  teach: 'Yes — general teaching building.', mixed: 'Yes — teaching spaces, shared with student activities.',
  spec: 'Yes — specialist labs or studios.', fac: 'No — faculty offices (go here for office hours).',
  central: 'Not a main classroom block.', other: 'No.',
};
const CM_GATES = [
  { g: '01', x: 432, y: 242 }, { g: '02', x: 862, y: 242 }, { g: '03', x: 922, y: 242 }, { g: '04', x: 980, y: 242 }, { g: '05', x: 1042, y: 242 }, { g: '06', x: 1497, y: 242 },
  { g: '07', x: 1613, y: 1005, b: 1 }, { g: '08', x: 1231, y: 1005, b: 1 }, { g: '09', x: 667, y: 1005, b: 1 }, { g: '10', x: 288, y: 1005, b: 1 },
];
const CM_RECEPTIONS = [{ r: 'Reception A', x: 672, y: 468 }, { r: 'Reception B', x: 582, y: 880 }, { r: 'Reception C', x: 470, y: 712 }];

// Class rooms → map buildings (ASSUMED, shown as approximate on screen).
// Rooms in sections.csv look like AUH-G3-034: campus, building letter + digit, room number.
// Those building codes (A1–G3) are not the ones on the campus plan (F1–F9, M1–M4), so each
// building letter is assigned to a teaching building on the student's side of campus.
// The one real match: a female student's room in F1 or F2 is placed in F1 / F2 on the plan.
const CM_ROOM_ASSUMED = {
  A: { F: 'F1', M: 'M1' }, B: { F: 'F2', M: 'M2' }, C: { F: 'F8', M: 'M1' }, D: { F: 'F3', M: 'M3' },
  E: { F: 'F4', M: 'M4' }, F: { F: 'F1', M: 'M2' }, G: { F: 'F5', M: 'M3' },
};
const CM_MAP_CAMPUS = 'AUH';   // the campus the drawing covers

// Where is this class on the map? Returns null when the room can't be read.
function cmRoomLocation(room, student) {
  const m = /^([A-Z]+)-([A-Z])(\d+)-(\S+)$/.exec(String(room || '').trim().toUpperCase());
  if (!m) return null;
  const [, campus, letter, digit, num] = m;
  const dataBldg = letter + digit;
  if (campus !== CM_MAP_CAMPUS) return { campus, dataBldg, num, onMap: false };
  const side = student && student.gender === 'Male' ? 'M' : 'F';
  const real = CM_BY_CODE[dataBldg];
  if (real && real.s === side && ['teach', 'mixed', 'spec'].includes(real.cat)) return { campus, dataBldg, num, onMap: true, code: real.c, exact: true };
  const guess = CM_ROOM_ASSUMED[letter] && CM_ROOM_ASSUMED[letter][side];
  return guess ? { campus, dataBldg, num, onMap: true, code: guess, exact: false } : { campus, dataBldg, num, onMap: false };
}

// "Show on map" link used on the schedule and home pages (app.js calls it if this file loaded).
function cmMapLink(c, student, compact) {
  const loc = cmRoomLocation(c.room, student);
  if (!loc || !loc.onMap) return compact ? '' : `<span class="map-link off">No campus map for ${esc(loc ? loc.campus : c.campus)}</span>`;
  return `<a class="map-link" href="#/campus?crn=${encodeURIComponent(c.crn)}" title="Show on map">${ic('map')}${compact ? '' : '<span>Show on map</span>'}</a>`;
}

const CM_BY_CODE = {};
CM_BUILDINGS.forEach(b => { CM_BY_CODE[b.c] = b; (b.alias || []).forEach(a => { CM_BY_CODE[a] = b; }); });
const CM_CODES = Object.keys(CM_BY_CODE).sort((a, b) => b.length - a.length);   // longest first, so FF1 wins over F1

const cmNearestGates = b => CM_GATES.map(g => ({ g: g.g, d: Math.hypot(g.x - b.x, g.y - b.y) })).sort((p, q) => p.d - q.d).slice(0, 2);
const cmLabel = b => b.label || b.c;
const cmShort = b => b.cat === 'spec' ? (b.c === 'F5' ? 'Science' : 'Arts') : CM_CAT[b.cat].short;

// opts.id: prefix for element ids (so two drawings can share a page); opts.viewBox: crop;
// opts.on: building codes to highlight (others are dimmed); opts.extra: SVG drawn on top (pins).
function cmSvg(opts = {}) {
  const p = opts.id || 'cm', on = opts.on || null;
  const gates = CM_GATES.map(g => `<g class="cm-gate" data-g="${g.g}"><circle cx="${g.x}" cy="${g.y}" r="7"/>
    <text x="${g.x}" y="${g.b ? g.y + 30 : g.y - 14}">${['02', '03', '04', '05'].includes(g.g) ? g.g : 'GATE ' + g.g}</text></g>`).join('');
  const recs = CM_RECEPTIONS.map(r => `<rect class="cm-rec" x="${r.x - 6}" y="${r.y - 6}" width="12" height="12" rx="2"/>
    <text class="cm-rec-lbl" x="${r.x - 11}" y="${r.y + 5}" text-anchor="end">${r.r}</text>`).join('');
  const bldgs = CM_BUILDINGS.map(b => {
    let shape;
    if (b.shape === 'ellipse') shape = `<ellipse class="cm-shape" cx="${b.x}" cy="${b.y}" rx="${b.w / 2}" ry="${b.h / 2}"/>`;
    else if (b.shape === 'arc') shape = `<path class="cm-shape" d="M858 560 C870 505 1030 505 1042 560 L1020 572 C1005 530 895 530 880 572 Z"/>`;
    else shape = `<rect class="cm-shape" x="${b.x - b.w / 2}" y="${b.y - b.h / 2}" width="${b.w}" height="${b.h}" rx="6" transform="rotate(${b.a || 0} ${b.x} ${b.y})"/>`;
    const lbl = cmLabel(b);
    if (opts.static) return `<g class="cm-bldg cm-${b.cat} ${on && on.has(b.c) ? 'on mine' : ''}">${shape}
      <text x="${b.x}" y="${b.shape === 'arc' ? b.y + 12 : b.y}" ${b.a ? `transform="rotate(${b.a} ${b.x} ${b.y})"` : ''} ${lbl.length > 4 ? 'style="font-size:14px"' : ''}>${esc(lbl)}</text></g>`;
    return `<g class="cm-bldg cm-${b.cat}" tabindex="0" role="button" aria-label="${esc(b.c)} ${esc(b.n)}" data-c="${esc(b.c)}" data-cat="${b.cat}">${shape}
      <text x="${b.x}" y="${b.shape === 'arc' ? b.y + 12 : b.y}" ${b.a ? `transform="rotate(${b.a} ${b.x} ${b.y})"` : ''} ${lbl.length > 4 ? 'style="font-size:14px"' : ''}>${esc(lbl)}</text></g>`;
  }).join('');
  return `<svg class="cm-svg ${on ? 'dim' : ''} ${opts.cls || ''}" viewBox="${opts.viewBox || '40 175 1760 880'}" role="img" aria-label="Schematic map of the Zayed University Abu Dhabi campus">
    <defs><pattern id="${p}-hatch" width="8" height="8" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><line x1="0" y1="0" x2="0" y2="8" class="cm-hatch-line"/></pattern></defs>
    <path class="cm-ground" d="M118 242 L1753 242 L1753 1005 L125 1005 L48 600 Z"/>
    <path class="cm-wash-f" d="M118 242 L880 242 L880 1005 L125 1005 L48 600 Z"/>
    <path class="cm-wash-m" d="M1020 242 L1753 242 L1753 1005 L1020 1005 Z"/>
    <g class="cm-parking" fill="url(#${p}-hatch)">
      <rect x="430" y="300" width="130" height="80" rx="10" transform="rotate(14 495 340)"/><rect x="585" y="335" width="120" height="80" rx="10" transform="rotate(14 645 375)"/>
      <rect x="720" y="370" width="95" height="75" rx="10" transform="rotate(14 767 407)"/><rect x="1090" y="370" width="95" height="75" rx="10" transform="rotate(-14 1137 407)"/>
      <rect x="1200" y="335" width="120" height="80" rx="10" transform="rotate(-14 1260 375)"/><rect x="1340" y="300" width="130" height="80" rx="10" transform="rotate(-14 1405 340)"/>
      <rect x="325" y="725" width="140" height="160" rx="10"/><rect x="1440" y="725" width="140" height="160" rx="10"/>
      <rect x="430" y="920" width="110" height="75" rx="10"/><rect x="1360" y="920" width="110" height="75" rx="10"/>
      <rect x="770" y="860" width="55" height="130" rx="10" transform="rotate(14 797 925)"/><rect x="1075" y="860" width="55" height="130" rx="10" transform="rotate(-14 1102 925)"/>
    </g>
    <rect class="cm-field" x="352" y="590" width="80" height="70" rx="6"/><rect class="cm-field" x="358" y="520" width="60" height="55" rx="6" transform="rotate(45 388 547)"/>
    <g class="cm-heli" transform="translate(1112 298) rotate(45)"><rect x="-28" y="-28" width="56" height="56"/><text x="0" y="1" transform="rotate(-45)">H</text></g>
    <path class="cm-court" d="M875 600 C900 560 1000 560 1025 600 C1045 640 1045 690 1025 720 C990 745 910 745 875 720 C855 690 855 640 875 600 Z"/>
    <text x="950" y="668" class="cm-lbl cm-lbl-sm">Central Courtyard</text>
    <path class="cm-prom" d="M540 655 L830 742" stroke-width="34"/><path class="cm-prom" d="M1070 742 L1360 655" stroke-width="34"/>
    <path class="cm-prom cm-prom-thin" d="M660 470 L640 880" stroke-width="16"/><path class="cm-prom cm-prom-thin" d="M1250 590 L1275 760" stroke-width="16"/>
    <path class="cm-arc" d="M830 1005 C860 900 1040 900 1070 1005"/>
    <text x="160" y="290" class="cm-lbl cm-lbl-f" text-anchor="start">Female Campus</text>
    <text x="1740" y="290" class="cm-lbl cm-lbl-m" text-anchor="end">Male Campus</text>
    <text x="950" y="985" class="cm-lbl">Central Campus</text>
    <text x="952" y="205" class="cm-gates-title">GATES</text>
    <g>${gates}</g><g>${recs}</g><g>${bldgs}</g>
    ${opts.extra || ''}
    <circle id="${p}-pulse" class="cm-pulse" cx="0" cy="0" r="20"/>
  </svg>`;
}

/* ---------- Home page: where are today's classes? ---------- */
// Draws a numbered pin on the building of each of today's classes (or, on a day with no classes,
// every class this term). Pins link to the full campus map for that class. The next class pulses.
function cmHomeCard(ctx, todays) {
  const s = ctx.s;
  if (s.campus && s.campus !== CM_MAP_CAMPUS) return '';            // the drawing only covers Abu Dhabi
  const isToday = todays.length > 0;
  const list = (isToday ? todays : [...ctx.sections].sort((a, b) => toMin(a.start_time) - toMin(b.start_time)))
    .map(c => ({ c, loc: cmRoomLocation(c.room, s) })).filter(x => x.loc && x.loc.onMap);
  if (!list.length) return '';
  const now = NOW(), nm = now.getHours() * 60 + now.getMinutes();
  const next = isToday ? list.find(x => toMin(x.c.end_time) > nm) : null;   // in progress or upcoming
  // pins: classes in the same building sit side by side above it
  const perBldg = {};
  const pins = list.map((x, i) => {
    const b = CM_BY_CODE[x.loc.code];
    const k = perBldg[b.c] = (perBldg[b.c] || 0) + 1;
    const same = list.filter(y => y.loc.code === b.c).length;
    const px = b.x + (k - 1 - (same - 1) / 2) * 48, py = b.y - (b.h ? b.h / 2 : 40) - 34;
    const done = isToday && toMin(x.c.end_time) <= nm;
    return `<a href="#/campus?crn=${encodeURIComponent(x.c.crn)}" class="hm-pin ${done ? 'done' : ''} ${next === x ? 'next' : ''}" style="--cc:${x.c.color || 'var(--brand)'}">
      <title>${esc(x.c.course_code)} · ${esc(fTime(x.c.start_time))} · ${esc(x.c.room)}</title>
      <line x1="${b.x}" y1="${b.y}" x2="${px}" y2="${py}"/>
      ${next === x ? `<circle class="hm-ring" cx="${px}" cy="${py}" r="24"/>` : ''}
      <circle cx="${px}" cy="${py}" r="21"/><text x="${px}" y="${py}">${i + 1}</text></a>`;
  }).join('');
  // crop to the student's side of campus plus the central buildings
  const side = s.gender === 'Male' ? 'M' : 'F';
  const viewBox = side === 'M' ? '820 400 960 560' : '120 400 960 560';
  const svg = cmSvg({ id: 'hm', static: true, viewBox, on: new Set(list.map(x => x.loc.code)), extra: `<g>${pins}</g>`, cls: 'hm-svg' });
  const anyApprox = list.some(x => !x.loc.exact);
  const rows = list.map((x, i) => `<li><a href="#/campus?crn=${encodeURIComponent(x.c.crn)}" class="hm-row ${next === x ? 'next' : ''}" style="--cc:${x.c.color || 'var(--brand)'}">
      <span class="hm-num">${i + 1}</span>
      <span class="grow"><span class="code">${esc(x.c.course_code)}</span> <span class="small muted mono">${esc(isToday ? fTime(x.c.start_time) : (x.c.days || '').split(',').join(', '))}</span>
        <span class="small muted hm-room"><span class="mono">${esc(x.c.room)}</span> → <b class="mono">${esc(x.loc.code)}</b> <span>${esc(CM_BY_CODE[x.loc.code].n)}</span>${x.loc.exact ? '' : ' <small>(approx.)</small>'}</span></span>
      ${next === x ? `<span class="badge b-ok">${toMin(x.c.start_time) <= nm ? 'Now' : 'Next'}</span>` : ''}</a></li>`).join('');
  return `<div class="card hm-card"><div class="card-head"><h3>${ic('map')} ${isToday ? "Where are today's classes?" : 'Your class buildings this term'}</h3><a href="#/campus" class="small">Campus map</a></div>
    <div class="hm-map">${svg}</div>
    <ul class="hm-list">${rows}</ul>
    ${anyApprox ? `<p class="small muted hm-note">Approximate location: room codes in the data don't match the campus plan, so most buildings are a best guess.</p>` : ''}
  </div>`;
}

// The class the student opened from their schedule (shown above the building details).
function cmClassHtml(c, loc) {
  if (!c || !loc) return '';
  const days = (c.days || '').split(',').map(d => DAY_LONG[d] || d).join(' & ');
  return `<div class="cm-class" style="--cc:${c.color || 'var(--brand)'}">
    <div class="cm-class-k">Your class</div>
    <div><span class="code">${esc(c.course_code)}</span> <span>${esc(c.course_title)}</span></div>
    <div class="small muted"><span>${esc(days)}</span> · <span class="mono">${esc(fTime(c.start_time))}–${esc(fTime(c.end_time))}</span> · <span>${esc(c.instructor_name)}</span></div>
    <div class="cm-class-room">${ic('pin')}<span>Room</span> <b class="mono">${esc(c.room)}</b></div>
    ${loc.exact
      ? `<div class="cm-approx ok">${ic('ok')}<span>The room's building code matches this building on the campus plan.</span></div>`
      : `<div class="cm-approx">${ic('info')}<span>Approximate location: room codes in the data don't match the campus plan, so this building is a best guess. Check signage on the day.</span></div>`}
  </div>`;
}

function cmInfoHtml(b, cls) {
  if (!b) return `<div class="cm-empty muted">Nothing selected yet. Pick a building on the map, a code below, or search for a room.</div>`;
  const ng = cmNearestGates(b);
  return `${cls || ''}<div class="cm-code">${esc(cmLabel(b))}</div>
    <div class="cm-name">${esc(b.n)}</div>
    <div class="cm-tags"><span class="cm-tag cm-${b.cat}">${esc(CM_CAT[b.cat].label)}</span><span class="cm-tag">${esc(CM_SIDE[b.s])}</span></div>
    <p><b>Classrooms:</b> <span>${esc(CM_CLASSROOMS[b.cat])}</span></p>
    ${CM_NOTES[b.c] ? `<p>${esc(CM_NOTES[b.c])}</p>` : ''}
    <p><b>Closest gates on the plan:</b> <span>Gate ${ng[0].g}, Gate ${ng[1].g}</span></p>`;
}

function renderCampus(ctx) {
  const s = ctx.s;
  const groups = [{ t: 'Female campus', s: 'F' }, { t: 'Male campus', s: 'M' }, { t: 'Central (dining / interdisciplinary)', s: 'C', only: ['FDH', 'MDH'] }];
  const chips = groups.map(gr => {
    const list = CM_BUILDINGS.filter(b => b.s === gr.s && (gr.only ? gr.only.includes(b.c) : ['teach', 'mixed', 'spec'].includes(b.cat)));
    return `<div class="cm-group"><h4>${esc(gr.t)}</h4><div class="cm-chips">${list.map(b =>
      `<button type="button" class="cm-chip" data-c="${esc(b.c)}"><span class="code">${esc(cmLabel(b))}</span><small>${esc(cmShort(b))}</small></button>`).join('')}</div></div>`;
  }).join('');
  // This term's classes (sections.csv via enrollments.csv) with the building each one maps to.
  const myClasses = ctx.sections.map(c => {
    const loc = cmRoomLocation(c.room, s);
    const days = (c.days || '').split(',').join(', ');
    const where = loc && loc.onMap
      ? `<span class="cm-goto">${ic('map')}<b class="mono">${esc(loc.code)}</b>${loc.exact ? '' : '<small>approx.</small>'}</span>`
      : `<span class="small muted">Not on this map</span>`;
    return `<button type="button" class="cm-myclass" data-crn="${esc(c.crn)}" ${loc && loc.onMap ? '' : 'disabled'} style="--cc:${c.color || 'var(--brand)'}">
      <span class="cm-myclass-main"><span class="code">${esc(c.course_code)}</span> <span class="small muted mono">${esc(days)} · ${esc(fTime(c.start_time))}</span><br><span class="small mono">${esc(c.room)}</span></span>${where}</button>`;
  }).join('');
  const classesCard = ctx.sections.length ? `<div class="card"><div class="card-head"><h3>${ic('schedule')} Your classes this term</h3></div>
    <div class="cm-myclasses">${myClasses}</div>
    <p class="small muted cm-myclasses-note">Room codes in the data don't match the campus plan, so most class buildings are a best guess (marked approx.).</p></div>` : '';
  // Campus comes from students.csv. The drawing only covers Abu Dhabi, so say so for anyone else.
  const otherCampus = s.campus && s.campus !== 'AUH'
    ? `<div class="alert a-info">${ic('alert')}<div><b>This map shows the Abu Dhabi campus.</b><span>Your classes are on the ${esc(s.campus)} campus, so check the rooms on your class schedule.</span></div></div>` : '';
  return `
  ${otherCampus}
  <div class="toolbar">
    <div class="muted">Click a building, or type a building or room code such as F2 or M1-112, to see where it is and which gates are closest.</div>
    <form class="cm-search" id="cm-search" autocomplete="off">
      <input class="input" id="cm-q" placeholder="Building or room code…" aria-label="Building or room code">
      <button class="btn btn-primary" type="submit">Find</button>
    </form>
  </div>
  <div class="cm-msg small muted" id="cm-msg" aria-live="polite"></div>
  <div class="grid g-main">
    <div class="card cm-mapcard">
      <div class="cm-mapscroll" id="cm-map">${cmSvg()}</div>
      <div class="cm-legend" id="cm-legend">${Object.entries(CM_CAT).map(([k, v]) =>
        `<button type="button" data-cat="${k}" aria-pressed="false"><span class="cm-sw cm-${k}"></span><span>${esc(v.label)}</span></button>`).join('')}</div>
      <div class="cm-legend cm-legend-static">
        <span><span class="cm-sw cm-sw-prom"></span><span>Promenade (main walkway)</span></span>
        <span><span class="cm-sw cm-sw-rec"></span><span>Reception</span></span>
        ${ctx.sections.length ? '<span><span class="cm-sw cm-sw-mine"></span><span>Your classes this term</span></span>' : ''}
        <span>Tip: click a colour above to show only that type</span>
      </div>
    </div>
    <div class="stack">
      <div class="card"><div class="card-head"><h3>${ic('home')} Selected</h3></div><div class="cm-info" id="cm-info">${cmInfoHtml(null)}</div></div>
      ${classesCard}
      <div class="card"><div class="card-head"><h3>${ic('book')} Buildings with classrooms</h3></div><div class="cm-groups">${chips}</div></div>
    </div>
  </div>
  <p class="small muted">Redrawn as a schematic from the official “ZU Campus Plan, Abu Dhabi” drawing (May 2023). Building positions are approximate and not to scale. “Closest gates” are measured in a straight line on the plan, so check signage and your access rules on the day. Room codes are matched by their building prefix only; floor and room layouts aren’t in the source plan.</p>`;
}

PAGES.campus = { label: 'Campus map', icon: 'map', render: renderCampus };

PAGES.campus.after = ctx => {
  const svg = $('#cm-map svg');
  if (!svg) return;
  const view = $('#view');

  // Opened from "Show on map" (#/campus?crn=…): remember the class, then tidy the address.
  const q = new URLSearchParams((location.hash.split('?')[1]) || '');
  if (q.get('crn')) { STATE.campusClass = q.get('crn'); STATE.campusSel = null; history.replaceState(null, '', '#/campus'); }
  const classOf = crn => ctx.sections.find(c => c.crn === crn);
  if (STATE.campusClass && !classOf(STATE.campusClass)) STATE.campusClass = null;   // another student's class

  // Buildings that hold one of this student's classes get a dashed outline.
  const mine = new Set(ctx.sections.map(c => cmRoomLocation(c.room, ctx.s)).filter(l => l && l.onMap).map(l => l.code));
  $$('.cm-bldg', svg).forEach(g => g.classList.toggle('mine', mine.has(g.dataset.c)));

  const applyFilter = () => {
    const f = STATE.campusFilter || null;
    svg.classList.toggle('dim', !!f);
    $$('.cm-bldg', svg).forEach(g => g.classList.toggle('on', g.dataset.cat === f || g.classList.contains('sel')));
    $$('#cm-legend button').forEach(btn => { const on = btn.dataset.cat === f; btn.classList.toggle('active', on); btn.setAttribute('aria-pressed', on ? 'true' : 'false'); });
  };

  const select = (code, animate = true, crn = null) => {
    const b = CM_BY_CODE[code]; if (!b) return;
    STATE.campusSel = b.c; STATE.campusClass = crn;
    $$('.cm-myclass', view).forEach(x => x.classList.toggle('sel', x.dataset.crn === crn));
    $$('.cm-bldg', svg).forEach(g => g.classList.toggle('sel', g.dataset.c === b.c));
    $$('.cm-chip', view).forEach(c => c.classList.toggle('sel', c.dataset.c === b.c));
    const ng = cmNearestGates(b);
    $$('.cm-gate', svg).forEach(g => g.classList.toggle('near', ng.some(n => n.g === g.dataset.g)));
    const pulse = $('#cm-pulse', svg);
    pulse.setAttribute('cx', b.x); pulse.setAttribute('cy', b.y);
    pulse.classList.remove('go');
    if (animate) { void pulse.getBBox(); pulse.classList.add('go'); }
    applyFilter();
    const cls = crn ? classOf(crn) : null;
    const info = $('#cm-info'); info.innerHTML = cmInfoHtml(b, cls ? cmClassHtml(cls, cmRoomLocation(cls.room, ctx.s)) : ''); applyLang(info);
  };
  const selectClass = (crn, animate = true) => {
    const c = classOf(crn); const loc = c && cmRoomLocation(c.room, ctx.s);
    if (loc && loc.onMap) select(loc.code, animate, crn);
  };
  $$('.cm-myclass', view).forEach(x => { x.onclick = () => selectClass(x.dataset.crn); });

  $$('.cm-bldg', svg).forEach(g => {
    g.addEventListener('click', () => select(g.dataset.c));
    g.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); select(g.dataset.c); } });
  });
  $$('.cm-chip', view).forEach(c => { c.onclick = () => select(c.dataset.c); });
  $$('#cm-legend button').forEach(btn => {
    btn.onclick = () => { STATE.campusFilter = STATE.campusFilter === btn.dataset.cat ? null : btn.dataset.cat; applyFilter(); };
  });

  $('#cm-search').onsubmit = e => {
    e.preventDefault();
    const raw = $('#cm-q').value.toUpperCase().replace(/\s+/g, '');
    const msg = $('#cm-msg');
    if (!raw) { msg.innerHTML = ''; return; }
    const hit = CM_CODES.find(c => raw.startsWith(c.replace('/', '')) || raw.startsWith(c));
    if (hit) {
      const b = CM_BY_CODE[hit];
      const room = raw.slice(hit.replace('/', '').length).replace(/^[-_.]/, '');
      msg.innerHTML = room
        ? `<span>Room</span> <b class="mono">${esc(room)}</b> <span>is in</span> <b class="mono">${esc(cmLabel(b))}</b> — <span>${esc(b.n)}</span>`
        : `<b class="mono">${esc(cmLabel(b))}</b> — <span>${esc(b.n)}</span>`;
      select(hit);
    } else {
      msg.innerHTML = `<span>No building matches that code. Try F1, F2, M1, M2…</span>`;
    }
    applyLang(msg);
  };

  if (STATE.campusClass) {
    selectClass(STATE.campusClass, !!q.get('crn'));
    // renderApp scrolls to the top after this runs, so wait a tick (matters on phones, where the panel is below the map).
    if (q.get('crn')) setTimeout(() => $('#cm-info')?.closest('.card')?.scrollIntoView({ block: 'nearest' }), 0);
  } else if (STATE.campusSel) select(STATE.campusSel, false);
  else applyFilter();
};
