/* =====================================================================
   Student Access Portal — Zayed University (Vibe Code Jam 2026 demo)
   ---------------------------------------------------------------------
   All data is read at start-up from the CSV files in ./data.
   Nothing from the CSVs is hard-coded here: only the file names,
   the "today" date and the current term (given in the brief).
   ===================================================================== */
'use strict';
window.SAP_BOOTED = true;

const CONFIG = {
  today: '2026-11-18',        // Wednesday 18 November 2026
  currentTerm: '202610',      // 2026 Fall Semester
  dataDir: 'data/',
  absenceLimit: 0.15,         // grade_scale.csv: WF = "absences over 15%"
};

const FILES = [
  'students', 'programs', 'degree_requirements', 'courses', 'courses_full',
  'grades', 'grade_scale', 'transfer_credits', 'terms', 'enrollments', 'sections',
  'attendance', 'score_records', 'exam_schedule', 'holds', 'time_tickets',
  'faculty', 'news', 'entry_logs',
];

const DB = {};
let STATE = { sid: null, page: 'home', schedTab: 'list', auditFilter: 'all', calc: {} };

/* ---------- display preferences: language and theme (remembered in this browser) ---------- */
const PREF = {
  get: k => { try { return localStorage.getItem(k); } catch { return null; } },
  set: (k, v) => { try { localStorage.setItem(k, v); } catch { /* storage unavailable */ } },
};
STATE.lang = PREF.get('sap.lang') === 'ar' ? 'ar' : 'en';
STATE.theme = PREF.get('sap.theme') === 'dark' ? 'dark' : 'light';
const isAr = () => STATE.lang === 'ar';
function applyPrefs() {
  const h = document.documentElement;
  h.lang = STATE.lang; h.dir = isAr() ? 'rtl' : 'ltr'; h.dataset.theme = STATE.theme;
}
applyPrefs();

/* ------------------------------------------------------------------ */
/* Utilities                                                           */
/* ------------------------------------------------------------------ */
const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => [...el.querySelectorAll(s)];
const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const num = v => (v === '' || v == null || isNaN(+v)) ? null : +v;
const groupBy = (arr, fn) => arr.reduce((m, x) => { const k = fn(x); (m[k] = m[k] || []).push(x); return m; }, {});
const sum = (arr, fn = x => x) => arr.reduce((a, x) => a + fn(x), 0);
// GPA rounding to 2 decimals, the same way the official cumulative_gpa in students.csv is rounded:
// an exact tie (e.g. 3.125) goes to the even digit (3.12); everything else rounds normally.
const round2 = n => {
  const x = n * 100;
  if (Number.isInteger(n * 8) && !Number.isInteger(x)) { const f = Math.floor(x); return (f % 2 === 0 ? f : f + 1) / 100; }
  return +n.toFixed(2);
};
const fmt2 = n => (n == null || isNaN(n)) ? '—' : round2(n).toFixed(2);
const fmt1 = n => (n == null || isNaN(n)) ? '—' : n.toFixed(1);

function parseCSV(text) {
  text = text.replace(/^﻿/, '');
  const rows = []; let row = [], field = '', q = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) {
      if (c === '"') { if (text[i + 1] === '"') { field += '"'; i++; } else q = false; }
      else field += c;
    } else if (c === '"') q = true;
    else if (c === ',') { row.push(field); field = ''; }
    else if (c === '\n' || c === '\r') {
      if (c === '\r' && text[i + 1] === '\n') i++;
      row.push(field); rows.push(row); row = []; field = '';
    } else field += c;
  }
  if (field !== '' || row.length) { row.push(field); rows.push(row); }
  const head = (rows.shift() || []).map(h => h.trim());
  return rows.filter(r => r.some(v => v.trim() !== ''))
    .map(r => Object.fromEntries(head.map((h, i) => [h, (r[i] ?? '').trim()])));
}

// dates — "YYYY-MM-DD" or "YYYY-MM-DD HH:MM" as local time
function D(s) {
  if (!s) return null;
  const [y, m, d] = s.slice(0, 10).split('-').map(Number);
  const dt = new Date(y, m - 1, d);
  if (s.length > 10) { const [h, mi] = s.slice(11, 16).split(':').map(Number); dt.setHours(h, mi); }
  return dt;
}
const TODAY = D(CONFIG.today);
function NOW() { const n = new Date(); const t = new Date(TODAY); t.setHours(n.getHours(), n.getMinutes(), 0, 0); return t; }
const dayStart = dt => new Date(dt.getFullYear(), dt.getMonth(), dt.getDate());
const daysFrom = (a, b) => Math.round((dayStart(b) - dayStart(a)) / 864e5);
const fDate = (dt, o = { day: 'numeric', month: 'short', year: 'numeric' }) => dt ? dt.toLocaleDateString(isAr() ? 'ar-AE-u-nu-latn' : 'en-GB', o) : '—';
const fDay = dt => fDate(dt, { weekday: 'short', day: 'numeric', month: 'short' });
const toMin = t => { const [h, m] = (t || '0:0').split(':').map(Number); return h * 60 + m; };
const fTime = t => { if (!t) return ''; let [h, m] = t.split(':').map(Number); const ap = h >= 12 ? (isAr() ? 'م' : 'PM') : (isAr() ? 'ص' : 'AM'); h = h % 12 || 12; return `${h}:${String(m).padStart(2, '0')} ${ap}`; };
const relDays = n => n === 0 ? 'today' : n === 1 ? 'tomorrow' : n === -1 ? 'yesterday' : n > 0 ? `in ${n} days` : `${-n} days ago`;
const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'];
const DAY_LONG = { Sun: 'Sunday', Mon: 'Monday', Tue: 'Tuesday', Wed: 'Wednesday', Thu: 'Thursday', Fri: 'Friday', Sat: 'Saturday' };
const todayKey = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][TODAY.getDay()];

const PALETTE = ['#0f7d8f', '#c6952c', '#6941c6', '#d0573a', '#2f7d4f', '#3459c9', '#b4417a'];

/* ------------------------------------------------------------------ */
/* Icons (inline SVG, Feather-style)                                    */
/* ------------------------------------------------------------------ */
const P = {
  home: '<path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/>',
  transcript: '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/>',
  audit: '<polyline points="9 11 12 14 22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/>',
  schedule: '<rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>',
  attendance: '<path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="8.5" cy="7" r="4"/><polyline points="17 11 19 13 23 9"/>',
  holds: '<rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>',
  logout: '<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/>',
  clock: '<circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>',
  pin: '<path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/>',
  mail: '<path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/>',
  alert: '<path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>',
  ok: '<path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/>',
  info: '<circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/>',
  download: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>',
  print: '<polyline points="6 9 6 2 18 2 18 9"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect x="6" y="14" width="12" height="8"/>',
  book: '<path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/>',
  pen: '<path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/>',
  bell: '<path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/>',
  eye: '<path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/>',
  user: '<path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>',
  chev: '<polyline points="9 18 15 12 9 6"/>',
  dollar: '<line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/>',
  door: '<path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4"/><polyline points="10 17 15 12 10 7"/><line x1="15" y1="12" x2="3" y2="12"/>',
  list: '<line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/>',
  grid: '<rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/>',
  layers: '<polygon points="12 2 2 7 12 12 22 7 12 2"/><polyline points="2 17 12 22 22 17"/><polyline points="2 12 12 17 22 12"/>',
  moon: '<path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>',
  sun: '<circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/>',
  globe: '<circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/>',
  calc: '<rect x="4" y="2" width="16" height="20" rx="2"/><line x1="8" y1="6" x2="16" y2="6"/><line x1="8" y1="11" x2="8.01" y2="11"/><line x1="12" y1="11" x2="12.01" y2="11"/><line x1="16" y1="11" x2="16.01" y2="11"/><line x1="8" y1="15" x2="8.01" y2="15"/><line x1="12" y1="15" x2="12.01" y2="15"/><line x1="16" y1="15" x2="16" y2="18"/><line x1="8" y1="18" x2="12" y2="18"/>',
  map: '<polygon points="1 6 1 22 8 18 16 22 23 18 23 2 16 6 8 2 1 6"/><line x1="8" y1="2" x2="8" y2="18"/><line x1="16" y1="6" x2="16" y2="22"/>',
};
const ic = (n, cls = '') => `<svg class="svg ${cls}" viewBox="0 0 24 24" aria-hidden="true">${P[n] || ''}</svg>`;

// Language + theme switches (shown in the top bar and on the sign-in page)
const toolButtons = () => `
  <button type="button" class="tool-btn" data-tool="lang" title="${isAr() ? 'Switch to English' : 'التبديل إلى العربية'}">${ic('globe')}<span class="${isAr() ? '' : 'ar-lbl'}">${isAr() ? 'English' : 'العربية'}</span></button>
  <button type="button" class="tool-btn" data-tool="theme">${ic(STATE.theme === 'dark' ? 'sun' : 'moon')}<span>${STATE.theme === 'dark' ? 'Light mode' : 'Dark mode'}</span></button>`;
const toolsHtml = (cls = '') => `<div class="top-tools ${cls}">${toolButtons()}</div>`;
function bindTools() {
  $$('[data-tool]').forEach(b => b.onclick = () => {
    if (b.dataset.tool === 'lang') STATE.lang = isAr() ? 'en' : 'ar';
    else STATE.theme = STATE.theme === 'dark' ? 'light' : 'dark';
    PREF.set('sap.lang', STATE.lang); PREF.set('sap.theme', STATE.theme);
    applyPrefs();
    if (STATE.sid) renderApp(); else renderLogin('', $('#sid')?.value || '');
  });
}

/* ------------------------------------------------------------------ */
/* Loading the CSV files                                               */
/* ------------------------------------------------------------------ */
// Each file is fetched once, in parallel, with a timeout so a stalled request never hangs the app.
const LOADED = {};
function fetchCsv(f, timeoutMs = 15000) {
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), timeoutMs);
  // Works with a flat data/ folder or the competition layout data/core + data/extras.
  const tryAt = dirs => fetch(dirs[0] + f + '.csv', { signal: ctl.signal })
    .then(r => r.ok ? r.text() : dirs.length > 1 ? tryAt(dirs.slice(1)) : Promise.reject(new Error(`${f}.csv → HTTP ${r.status}`)));
  return tryAt([CONFIG.dataDir, CONFIG.dataDir + 'core/', CONFIG.dataDir + 'extras/'])
    .then(t => { LOADED[f] = parseCSV(t); bootProgress(); return LOADED[f]; })
    .catch(e => { throw e.name === 'AbortError' ? new Error(`${f}.csv timed out`) : e; })
    .finally(() => clearTimeout(timer));
}
function bootProgress() {
  const bar = $('#boot-bar'); if (bar) bar.style.width = (Object.keys(LOADED).length / FILES.length * 100) + '%';
}

async function loadFromPicker(fileList) {
  const out = {}; const missing = [];
  for (const f of FILES) {
    const re = new RegExp(`(^|[-_/\\\\ ])${f}\\.csv$`, 'i');
    const file = [...fileList].find(x => re.test(x.name) || x.name.toLowerCase() === `${f}.csv`);
    if (!file) { missing.push(f + '.csv'); continue; }
    out[f] = parseCSV(await file.text());
  }
  if (missing.length) throw new Error('Missing: ' + missing.join(', '));
  return out;
}

function showPicker(err) {
  $('#root').innerHTML = `
    <div class="boot"><div class="boot-card">
      <h2>Choose the data folder</h2>
      <p class="muted">The portal reads its data from CSV files at start-up, but the browser blocked reading
      <code>data/</code> directly (${esc(err.message)}). This usually happens when <code>index.html</code> is opened as a file.</p>
      <p>Either start a local server in this folder (<code>python3 -m http.server</code>, then open
      <code>http://localhost:8000</code>) or select the folder with the CSV files:</p>
      <label class="btn btn-primary">${ic('download')} Select CSV folder
        <input id="pick" type="file" webkitdirectory multiple accept=".csv" hidden></label>
      <label class="btn" style="margin-left:6px">Select CSV files
        <input id="pick2" type="file" multiple accept=".csv" hidden></label>
      <p id="pick-err" class="small" style="color:var(--bad)"></p>
    </div></div>`;
  const go = async e => {
    try { start(await loadFromPicker(e.target.files)); }
    catch (x) { $('#pick-err').textContent = x.message; }
  };
  $('#pick').addEventListener('change', go);
  $('#pick2').addEventListener('change', go);
}

/* ------------------------------------------------------------------ */
/* Indexes built once after loading                                    */
/* ------------------------------------------------------------------ */
function buildIndexes(raw) {
  Object.assign(DB, raw);
  const by = (arr, k) => Object.fromEntries(arr.map(r => [r[k], r]));
  DB.studentById = by(DB.students, 'student_id');
  DB.programByCode = by(DB.programs, 'program_code');
  DB.sectionByCrn = by(DB.sections, 'crn');
  DB.facultyById = by(DB.faculty, 'faculty_id');
  DB.termByCode = by(DB.terms, 'term_code');
  DB.courseByCode = { ...by(DB.courses, 'course_code') };
  DB.courses_full.forEach(c => { DB.courseByCode[c.course_code] = { ...DB.courseByCode[c.course_code], ...c }; });
  DB.scale = Object.fromEntries(DB.grade_scale.map(g => [g.letter_grade, g]));
  DB.currentTerm = DB.termByCode[CONFIG.currentTerm];
  DB.nextTerm = DB.terms.filter(t => t.term_code > CONFIG.currentTerm).sort((a, b) => a.term_code.localeCompare(b.term_code))[0];
}

const termName = code => DB.termByCode[code]?.term_name || code;
const shortTerm = code => termName(code).replace(' Semester', '');
const qp = letter => num(DB.scale[letter]?.quality_points);
const countsInGpa = letter => DB.scale[letter]?.counts_in_gpa === 'Yes';
const earnsCredit = letter => DB.scale[letter]?.earns_credit === 'Yes';
function letterFor(pct) {
  const s = Math.round(pct);
  const row = DB.grade_scale.find(g => g.min_score !== '' && s >= +g.min_score && s <= +g.max_score);
  return row ? row.letter_grade : '—';
}
const gradeCls = g => !g ? '' : g === 'TR' ? 'gr-tr' : g.startsWith('A') ? 'gr-a' : g.startsWith('B') ? 'gr-b' : g.startsWith('C') ? 'gr-c' : g.startsWith('D') ? 'gr-d' : (g === 'F' || g === 'WF') ? 'gr-f' : '';
const gradeChip = g => `<span class="grade ${gradeCls(g)}">${esc(g || '—')}</span>`;
const initials = s => (s.first_name[0] + (s.last_name.replace(/^Al\s+/i, '')[0] || '')).toUpperCase();

/* ------------------------------------------------------------------ */
/* Per-student context — the ONLY place data is filtered by student    */
/* ------------------------------------------------------------------ */
function studentContext(sid) {
  const s = DB.studentById[sid];
  const mine = t => DB[t].filter(r => r.student_id === sid);
  const program = DB.programByCode[s.program_code];
  const enrollments = mine('enrollments').filter(e => e.term_code === CONFIG.currentTerm);
  const sections = enrollments.map((e, i) => ({
    ...e, ...(DB.sectionByCrn[e.crn] || {}), course_title: e.course_title, credits: e.credits,
    color: PALETTE[i % PALETTE.length], status: e.registration_status,
  }));
  const attendance = mine('attendance').filter(a => a.term_code === CONFIG.currentTerm);
  const scores = mine('score_records');
  const myCrns = new Set(enrollments.map(e => e.crn));
  const exams = DB.exam_schedule.filter(x => myCrns.has(x.crn) && x.term_code === CONFIG.currentTerm);
  return {
    s, program,
    advisor: DB.facultyById[s.advisor_id],
    requirements: DB.degree_requirements.filter(r => r.program_code === s.program_code),
    grades: mine('grades'),
    transfers: mine('transfer_credits'),
    enrollments, sections, attendance, scores, exams,
    holds: mine('holds'),
    ticket: mine('time_tickets').find(t => t.term_code === DB.nextTerm?.term_code) || mine('time_tickets')[0],
    entries: mine('entry_logs').sort((a, b) => b.timestamp.localeCompare(a.timestamp)),
  };
}

/* ---------------- academic computations ---------------- */
function computeTranscript(ctx) {
  const rows = [...ctx.grades].sort((a, b) => a.term_code.localeCompare(b.term_code));
  // Repeat rule (SAP_Data.xlsx): if a course is passed in a later attempt, the passing grade replaces
  // the earlier attempt in the GPA. The transcript still lists every attempt.
  const replacedWithin = list => new Set(list.filter(r => list.some(o => o !== r && o.course_code === r.course_code
    && o.term_code > r.term_code && earnsCredit(o.letter_grade))));
  // Quality points are summed in tenths (whole numbers) so there is no floating-point drift.
  const tenths = r => Math.round(qp(r.letter_grade) * 10) * +r.credits;
  const gpaOf = list => {
    const g = list.filter(r => countsInGpa(r.letter_grade) && qp(r.letter_grade) != null);
    const cr = sum(g, r => +r.credits), pts10 = sum(g, tenths);
    return { cr, points: pts10 / 10, gpa: cr ? pts10 / 10 / cr : null };
  };
  const replaced = replacedWithin(rows);
  rows.forEach(r => { r._counted = !replaced.has(r); r._repeated = rows.some(o => o !== r && o.course_code === r.course_code); });
  const terms = groupBy(rows, r => r.term_code);
  const seen = [];
  const out = Object.keys(terms).sort().map(code => {
    const list = terms[code];
    const t = gpaOf(list);
    const att = sum(list, r => +r.credits);
    const earned = sum(list.filter(r => earnsCredit(r.letter_grade)), r => +r.credits);
    seen.push(...list);
    const gone = replacedWithin(seen);
    const cum = gpaOf(seen.filter(r => !gone.has(r)));
    return { code, list, attempted: att, earned, gpaCredits: t.cr, points: t.points, gpa: t.gpa, cumGpa: cum.gpa };
  });
  const counted = rows.filter(r => r._counted);
  const all = gpaOf(counted);
  const earned = sum(counted.filter(r => earnsCredit(r.letter_grade)), r => +r.credits) + sum(ctx.transfers, t => +t.credits);
  return { terms: out, gpa: all.gpa, gpaCredits: all.cr, points: all.points, earned };
}

function courseStanding(ctx, crn) {
  const recs = ctx.scores.filter(r => r.crn === crn).sort((a, b) => a.date.localeCompare(b.date));
  if (!recs.length) return null;
  const wDone = sum(recs, r => +r.weight_percent);
  const earned = sum(recs, r => (+r.score / +r.max_score) * +r.weight_percent);
  const pct = earned / wDone * 100;
  const remaining = Math.max(0, 100 - wDone);
  const need = target => remaining ? ((target - earned) / remaining) * 100 : null;
  return { recs, wDone, earned, pct, letter: letterFor(pct), remaining, need };
}

function attendanceInfo(a) {
  const allotted = +a.meetings_allotted, held = +a.meetings_held_to_date, abs = +a.absences;
  const allowed = Math.floor(allotted * CONFIG.absenceLimit + 1e-9);
  const left = allowed - abs;
  const pctAllotted = abs / allotted * 100;
  const rate = held ? (held - abs) / held * 100 : 100;
  // SAP_Data.xlsx rule: absence % = absences / meetings_allotted.
  // Warning at 5%, second warning at 10%, more than 15% leads to a WF grade.
  const level = pctAllotted > 15 ? 'bad' : pctAllotted >= 10 ? 'warn2' : pctAllotted >= 5 ? 'warn' : 'ok';
  const label = { bad: 'Over 15% · WF risk', warn2: 'Second warning (10%)', warn: 'First warning (5%)', ok: 'Below 5%' }[level];
  return { allotted, held, abs, allowed, left, pctAllotted, rate, level, label };
}

const PROGRAM_ELECTIVE_PREFIX = {
  'BFAGD': ['AGD', 'AVA', 'ADR', 'AAH', 'ART'],
  'BSCMS-MPS': ['MPS', 'COM', 'ISC', 'TCC', 'ARM'],
};
function computeAudit(ctx) {
  // Gather every course record the student has: graded (latest attempt), transfer, in progress.
  const best = {};
  const rank = r => r.state === 'done' ? 3 : r.state === 'prog' ? 2 : 1;
  const put = r => { const cur = best[r.code]; if (!cur || rank(r) > rank(cur)) { if (cur && cur.state === 'fail') r.prev = cur; best[r.code] = r; } else if (r.state === 'fail' && cur) cur.prev = r; };
  const latest = {};
  [...ctx.grades].sort((a, b) => a.term_code.localeCompare(b.term_code)).forEach(g => { latest[g.course_code] = g; });
  Object.values(latest).forEach(g => put({ code: g.course_code, title: g.course_title, credits: +g.credits, grade: g.letter_grade, term: g.term_code, state: earnsCredit(g.letter_grade) ? 'done' : 'fail', src: 'grade' }));
  ctx.transfers.forEach(t => put({ code: t.zu_equivalent_code, title: t.zu_equivalent_title, credits: +t.credits, grade: t.grade || 'TR', term: t.term_awarded, state: 'done', src: 'transfer', inst: t.institution, ext: t.external_course_code }));
  ctx.enrollments.filter(e => e.registration_status === 'Registered').forEach(e => put({ code: e.course_code, title: e.course_title, credits: +e.credits, grade: '', term: e.term_code, state: 'prog', src: 'enrolled' }));

  const used = new Set();
  const items = ctx.requirements.map(req => ({ req, rec: null }));
  // 1) specific course requirements (with alternatives)
  items.filter(it => it.req.course_code).forEach(it => {
    const codes = [it.req.course_code, it.req.alternative_course_code].filter(Boolean);
    const cands = codes.map(c => best[c]).filter(r => r && !used.has(r.code)).sort((a, b) => rank(b) - rank(a));
    if (cands[0]) { it.rec = cands[0]; used.add(cands[0].code); }
  });
  // 2) elective slots — most specific type first
  const prefixes = PROGRAM_ELECTIVE_PREFIX[ctx.s.program_code] || [];
  const pool = () => Object.values(best).filter(r => !used.has(r.code) && r.state !== 'fail')
    .sort((a, b) => rank(b) - rank(a) || a.term.localeCompare(b.term));
  const fits = {
    'Art History Elective': r => r.code.startsWith('AAH'),
    'Program Elective': r => prefixes.some(p => r.code.startsWith(p)),
    'ZU Elective': () => true,
  };
  ['Art History Elective', 'Program Elective', 'ZU Elective'].forEach(type => {
    items.filter(it => !it.req.course_code && it.req.requirement_type === type).forEach(it => {
      const c = pool().find(fits[type] || (() => true));
      if (c) { it.rec = c; used.add(c.code); }
    });
  });
  items.forEach(it => { it.state = it.rec ? it.rec.state : 'todo'; });
  const unapplied = Object.values(best).filter(r => !used.has(r.code));

  const cr = st => sum(items.filter(i => i.state === st), i => +i.req.credits);
  const total = +ctx.program.total_credits || sum(items, i => +i.req.credits);
  return { items, unapplied, best, done: cr('done'), prog: cr('prog'), fail: cr('fail'), todo: cr('todo'), total };
}

function registrationStatus(ctx) {
  const t = ctx.ticket;
  const activeHolds = ctx.holds.filter(h => !h.released_date);
  const blocking = activeHolds.filter(h => h.blocks_registration === 'Yes');
  if (!t) return { t, activeHolds, blocking, phase: 'none' };
  const start = D(t.registration_start), end = D(t.registration_end), now = NOW();
  const phase = now < start ? 'before' : now <= end ? 'open' : 'closed';
  return { t, start, end, phase, days: daysFrom(TODAY, start), activeHolds, blocking };
}

/* ------------------------------------------------------------------ */
/* Session                                                             */
/* ------------------------------------------------------------------ */
const SKEY = 'sap.sid';
const sessGet = () => { try { return sessionStorage.getItem(SKEY); } catch { return null; } };
const sessSet = v => { try { v ? sessionStorage.setItem(SKEY, v) : sessionStorage.removeItem(SKEY); } catch { /* storage unavailable */ } };

function start(raw) {
  buildIndexes(raw); DB.ready = true; READY = Promise.resolve();
  const saved = sessGet();
  if (saved && DB.studentById[saved]) STATE.sid = saved;
  window.addEventListener('hashchange', route);
  route();
}

function route() {
  if (!STATE.sid) return renderLogin();
  const page = (location.hash.replace(/^#\/?/, '') || 'home').split('?')[0];
  STATE.page = PAGES[page] ? page : 'home';
  renderApp();
}

/* ------------------------------------------------------------------ */
/* Login                                                               */
/* ------------------------------------------------------------------ */
function renderLogin(error = '', keepId = '') {
  document.title = 'Sign in · Student Access Portal';
  $('#root').innerHTML = `
  <div class="login">
    <section class="login-art">
      <div class="login-brand"><div class="mark">ZU</div><div>Zayed University<br><span class="small" style="opacity:.7;font-weight:500">Student Access Portal</span></div></div>
      <div class="login-hero">
        <span class="ar">جامعة زايد · بوابة الطالب</span>
        <h1>Everything about your studies, in one place.</h1>
        <p>Grades, degree progress, classes, attendance and holds — always up to date for ${esc(DB.currentTerm?.term_name || '')}.</p>
        <div class="login-feats"><span>Transcript</span><span>Degree audit</span><span>Weekly schedule</span><span>Attendance</span><span>Holds</span></div>
      </div>
      <div class="login-foot">Vibe Code Jam 2026 · demo with fictional data</div>
    </section>
    <section class="login-panel">
      ${toolsHtml('login-tools')}
      <form class="login-form" id="login" autocomplete="off" novalidate>
        <h2>Sign in</h2>
        <p>Use your student ID and portal password.</p>
        ${error ? `<div class="form-error">${ic('alert')}${esc(error)}</div>` : ''}
        <div class="field"><label for="sid">Student ID</label>
          <input class="input" id="sid" name="sid" inputmode="numeric" placeholder="9-digit student ID" required value="${esc(keepId)}" ${keepId ? '' : 'autofocus'}></div>
        <div class="field"><label for="pw">Password</label>
          <div class="input-wrap"><input class="input" id="pw" name="pw" type="password" placeholder="••••••••" required ${keepId ? 'autofocus' : ''}>
          <button type="button" class="eye" id="eye" aria-label="Show password">${ic('eye')}</button></div></div>
        <button class="btn btn-primary btn-block" type="submit">Sign in</button>
        <div class="login-note">Demo: data is read from <b>${FILES.length} CSV files</b> at start-up
          (${DB.students.length} student accounts). You only ever see your own record.</div>
      </form>
    </section>
  </div>`;
  applyLang($('#root')); bindTools();
  $('#eye').onclick = () => { const p = $('#pw'); p.type = p.type === 'password' ? 'text' : 'password'; };
  $('#login').onsubmit = e => {
    e.preventDefault();
    const id = $('#sid').value.trim(), pw = $('#pw').value;
    const s = DB.studentById[id];
    if (!id || !pw) return renderLogin('Enter your student ID and password.', id);
    if (!/^\d{9}$/.test(id)) return renderLogin('A student ID has 9 digits, for example 202312001.', id);
    if (!s) return renderLogin(`No student account found with ID ${id}. Check the number and try again.`, id);
    if (s.password !== pw) return renderLogin('Incorrect password for this student ID. Passwords are case-sensitive.', id);
    STATE.sid = id; STATE.calc = {}; sessSet(id);
    const go = () => { if (location.hash !== '#/home') location.hash = '#/home'; else route(); };
    if (DB.ready) return go();
    const btn = $('#login button[type=submit]');
    btn.disabled = true; btn.innerHTML = '<span class="spin"></span> Loading your records…';
    READY.then(go);
  };
}

function logout() { STATE.sid = null; STATE.calc = {}; sessSet(null); history.replaceState(null, '', location.pathname); renderLogin(); }

/* ------------------------------------------------------------------ */
/* App shell                                                           */
/* ------------------------------------------------------------------ */
const PAGES = {
  home: { label: 'Home', icon: 'home', render: renderHome },
  transcript: { label: 'Academic transcript', nav: 'Transcript', icon: 'transcript', render: renderTranscript },
  audit: { label: 'Degree audit', icon: 'audit', render: renderAudit },
  schedule: { label: 'Class schedule', icon: 'schedule', render: renderSchedule },
  attendance: { label: 'Class attendance', nav: 'Attendance', icon: 'attendance', render: renderAttendance },
  holds: { label: 'Holds', icon: 'holds', render: renderHolds },
  calculator: { label: 'GPA calculator', icon: 'calc', render: renderCalculator },
};

function renderApp() {
  const ctx = studentContext(STATE.sid);
  const s = ctx.s;
  const activeHolds = ctx.holds.filter(h => !h.released_date).length;
  const attRisk = ctx.attendance.filter(a => attendanceInfo(a).level !== 'ok');
  const attBad = attRisk.some(a => attendanceInfo(a).level === 'bad');
  const badges = {
    holds: activeHolds ? `<span class="badge">${activeHolds}</span>` : '',
    attendance: attRisk.length ? `<span class="badge ${attBad ? '' : 'b-warn'}">${attRisk.length}</span>` : '',
  };
  const term = DB.currentTerm;
  const week = Math.floor(daysFrom(D(term.start_date), TODAY) / 7) + 1;
  const page = PAGES[STATE.page];
  document.title = `${page.label} · Student Access Portal`;
  $('#root').innerHTML = `
  <div class="app">
    <aside class="sidebar">
      <div class="side-brand"><div class="mark">ZU</div><div><b>Student Access Portal</b><span>Zayed University</span></div></div>
      <nav class="nav">${Object.entries(PAGES).map(([k, p]) =>
        `<a href="#/${k}" class="${k === STATE.page ? 'active' : ''}" title="${esc(p.label)}">${ic(p.icon)}<span class="lbl">${esc(p.nav || p.label)}</span>${badges[k] || ''}</a>`).join('')}</nav>
      <div class="side-foot">
        <div class="side-user"><span class="avatar">${esc(initials(s))}</span><div><b>${esc(isAr() && s.full_name_ar ? s.full_name_ar : s.full_name)}</b><span>${esc(s.student_id)}</span></div></div>
        <button class="btn side-out" id="logout">${ic('logout')}<span>Sign out</span></button>
      </div>
    </aside>
    <div class="main">
      <header class="topbar">
        <div><div class="crumb">${esc(term.term_name)} · Week ${week}</div><h1>${esc(page.label)}</h1></div>
        <div class="top-tools"><span class="today-chip"><span class="dot"></span>${esc(fDate(TODAY, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }))}</span>${toolButtons()}</div>
      </header>
      <div class="view" id="view">${page.render(ctx)}</div>
      <div class="foot">Data loaded from CSV at start-up · Demo portal for Vibe Code Jam 2026 · Figures are calculated from the files and are not official records.</div>
    </div>
  </div>`;
  $('#logout').onclick = logout;
  applyLang($('#root')); bindTools();
  page.after?.(ctx);
  if (STATE.lastPage !== STATE.page) window.scrollTo(0, 0);
  STATE.lastPage = STATE.page;
}

/* ------------------------------------------------------------------ */
/* 1. HOME                                                             */
/* ------------------------------------------------------------------ */
function renderHome(ctx) {
  const { s } = ctx;
  const hour = new Date().getHours();
  const greet = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';
  const audit = computeAudit(ctx);
  const reg = registrationStatus(ctx);
  const credNow = sum(ctx.enrollments, e => +e.credits);
  const earned = +s.credits_earned, req = +s.credits_required;
  const standingCls = /probation/i.test(s.academic_standing) ? 'b-bad' : /new/i.test(s.academic_standing) ? 'b-info' : 'b-ok';

  // today's classes
  const now = NOW(), nm = now.getHours() * 60 + now.getMinutes();
  const todays = ctx.sections.filter(x => (x.days || '').split(',').includes(todayKey)).sort((a, b) => toMin(a.start_time) - toMin(b.start_time));
  const todayList = todays.length ? `<ul class="list">${todays.map(c => {
    const st = toMin(c.start_time), en = toMin(c.end_time);
    const tag = nm >= en ? '<span class="badge">Done</span>' : nm >= st ? '<span class="badge b-ok">In progress</span>' : '<span class="badge b-info">Upcoming</span>';
    return `<li><div class="time-col">${fTime(c.start_time)}<span>${fTime(c.end_time)}</span></div>
      <div class="grow"><div class="t"><span class="code">${esc(c.course_code)}</span> ${esc(c.course_title)}</div>
      <div class="small muted">${esc(c.room)} ${mapLink(c, s, true)} · ${esc(c.instructor_name)}</div></div>${tag}</li>`;
  }).join('')}</ul>` : `<div class="empty">${ic('ok')}<div>No classes today.</div></div>`;

  // alerts
  const alerts = [];
  if (reg.blocking.length) alerts.push(`<div class="alert a-bad">${ic('holds')}<div><b>${reg.blocking.length} hold${reg.blocking.length > 1 ? 's' : ''} will block your ${esc(shortTerm(reg.t?.term_code))} registration</b>
    ${reg.blocking.map(h => esc(h.hold_type) + ' — ' + esc(h.reason)).join('<br>')} · <a href="#/holds">View holds</a></div></div>`);
  ctx.attendance.forEach(a => {
    const i = attendanceInfo(a); const sec = DB.sectionByCrn[a.crn];
    const appeal = ctx.enrollments.find(e => e.crn === a.crn)?.attendance_appeal_status;
    if (i.level === 'bad') alerts.push(`<div class="alert a-bad">${ic('alert')}<div><b>${esc(a.course_code)}: absences over the 15% limit</b>${i.abs} absences of ${i.allotted} meetings (${fmt1(i.pctAllotted)}%). This can result in a WF grade.${appeal ? ` Attendance appeal: <b style="display:inline">${esc(appeal)}</b>.` : ''} <a href="#/attendance">Details</a></div></div>`);
    else if (i.level !== 'ok') alerts.push(`<div class="alert a-warn">${ic('alert')}<div><b>${esc(a.course_code)}: ${i.level === 'warn2' ? 'second attendance warning' : 'attendance warning'} (${fmt1(i.pctAllotted)}%)</b>${i.abs} absence${i.abs === 1 ? '' : 's'} of ${i.allotted} meetings in ${esc(sec?.course_title || a.course_code)}. More than 15% leads to a WF grade.</div></div>`);
  });
  if (/probation/i.test(s.academic_standing)) alerts.push(`<div class="alert a-warn">${ic('info')}<div><b>Academic standing: ${esc(s.academic_standing)}</b>Your cumulative GPA is below 2.00. Meet ${esc(s.advisor_name)} to plan your recovery.</div></div>`);

  // exams
  const exams = ctx.exams.map(x => ({ ...x, dt: D(x.exam_date) })).filter(x => x.dt >= TODAY).sort((a, b) => a.exam_date.localeCompare(b.exam_date) || a.start_time.localeCompare(b.start_time));
  const news = [...DB.news].sort((a, b) => b.date.localeCompare(a.date));
  const lastIn = ctx.entries.find(e => e.direction === 'In');

  const regCard = reg.t ? (() => {
    const status = reg.blocking.length ? `<span class="badge b-bad">Blocked by hold</span>` : reg.phase === 'open' ? `<span class="badge b-ok">Open now</span>` : reg.phase === 'before' ? `<span class="badge b-info">Opens ${relDays(reg.days)}</span>` : `<span class="badge">Closed</span>`;
    return `<div class="card card-pad">
      <div style="display:flex;justify-content:space-between;align-items:center;gap:10px"><div class="stat" style="padding:0"><span class="label">${ic('schedule')} ${esc(reg.t.term_name)} registration</span></div>${status}</div>
      <div style="font-size:20px;font-weight:800;margin:8px 0 2px">${esc(fDay(reg.start))}, ${esc(fTime(reg.t.registration_start.slice(11)))}</div>
      <div class="small muted">Your time ticket · closes ${esc(fDay(reg.end))}, ${esc(fTime(reg.t.registration_end.slice(11)))}</div>
      <div class="small" style="margin-top:10px">${audit.todo + audit.fail} credits still to plan in your degree · <a href="#/audit">Degree audit</a></div>
    </div>`;
  })() : '';

  return `
  <div class="stack">
    <section class="hero">
      <div>
        <p class="small" style="opacity:.75;margin-bottom:6px">${greet},</p>
        <h2>${esc(isAr() && s.full_name_ar ? s.full_name_ar : s.full_name)}</h2>
        <p class="${isAr() ? '' : 'ar'}">${esc(isAr() ? s.full_name : s.full_name_ar)}</p>
        <div class="hero-meta"><span>${esc(s.program_name)}${s.concentration ? ' · ' + esc(s.concentration) : ''}</span><span>${esc(s.campus)} campus</span><span>Semester ${esc(s.current_semester)}</span><span>ID ${esc(s.student_id)}</span></div>
      </div>
      <div class="right" style="display:flex;flex-direction:column;gap:6px;align-items:flex-end">
        <span class="badge b-ok" style="font-size:12.5px">Status: ${esc(s.status)}</span>
        <span class="badge ${standingCls}" style="font-size:12.5px">Standing: ${esc(s.academic_standing)}</span></div>
    </section>

    <div class="grid g-4">
      <div class="card stat"><span class="label">${ic('layers')} Cumulative GPA</span><span class="value">${s.cumulative_gpa ? esc((+s.cumulative_gpa).toFixed(2)) : '—'}<small> / 4.00</small></span><span class="sub">${s.cumulative_gpa ? 'Official record' : 'First GPA after this term'}</span></div>
      <div class="card stat"><span class="label">${ic('audit')} Credits earned</span><span class="value">${earned}<small> / ${req}</small></span>
        <div class="bar"><i style="width:${Math.min(100, earned / req * 100)}%"></i></div><span class="sub">${Math.round(earned / req * 100)}% of degree · ${credNow} in progress</span></div>
      <div class="card stat"><span class="label">${ic('book')} This term</span><span class="value">${ctx.enrollments.length}<small> courses</small></span><span class="sub">${credNow} credit hours · ${esc(DB.currentTerm.term_name)}</span></div>
      <div class="card stat"><span class="label">${ic('holds')} Holds</span><span class="value">${reg.activeHolds.length}<small> active</small></span><span class="sub">${reg.blocking.length ? `<span style="color:var(--bad);font-weight:600">${reg.blocking.length} blocking registration</span>` : 'Nothing blocking registration'}</span></div>
    </div>

    ${alerts.length ? `<div class="stack" style="gap:10px">${alerts.join('')}</div>` : `<div class="alert a-ok">${ic('ok')}<div><b>You're all set</b>No holds blocking registration and attendance is within limits in every class.</div></div>`}

    <div class="grid g-main">
      <div class="stack">
        <div class="card"><div class="card-head"><h3>${ic('clock')} Today · ${esc(DAY_LONG[todayKey])}</h3><a href="#/schedule" class="small">Full schedule</a></div><div class="card-body" style="padding-top:4px">${todayList}</div></div>
        ${typeof window.cmHomeCard === 'function' ? window.cmHomeCard(ctx, todays) : ''}
        <div class="card"><div class="card-head"><h3>${ic('pen')} Upcoming final exams</h3><a href="#/schedule?exams" class="small" onclick="STATE.schedTab='exams'">All exams</a></div><div class="card-body" style="padding-top:4px">
          ${exams.length ? `<ul class="list">${exams.slice(0, 4).map(x => `<li><div class="pill-date"><span>${esc(fDate(x.dt, { month: 'short' }))}</span><b>${x.dt.getDate()}</b></div>
            <div class="grow"><div class="t"><span class="code">${esc(x.course_code)}</span> ${esc(x.course_title)}</div><div class="small muted">${esc(fTime(x.start_time))}–${esc(fTime(x.end_time))} · ${esc(x.room)}</div></div>
            <span class="badge b-brand">${relDays(daysFrom(TODAY, x.dt))}</span></li>`).join('')}</ul>` : `<div class="empty">No final exams scheduled.</div>`}
        </div></div>
      </div>
      <div class="stack">
        ${regCard}
        <div class="card"><div class="card-head"><h3>${ic('user')} Your advisor</h3></div><div class="card-body">
          ${ctx.advisor ? `<div style="display:flex;gap:12px;align-items:center"><span class="avatar" style="background:linear-gradient(135deg,var(--zu-rose),var(--zu-maroon));color:#fff">${esc(ctx.advisor.first_name[0] + ctx.advisor.last_name[0])}</span>
            <div><b>${esc(ctx.advisor.full_name)}</b><div class="small muted">${esc(ctx.advisor.college)}</div></div></div>
            <div class="meta"><span>${ic('mail')}<a href="mailto:${esc(ctx.advisor.email)}">${esc(ctx.advisor.email)}</a></span><span>${ic('pin')}Office ${esc(ctx.advisor.office)} · ext. ${esc(ctx.advisor.phone_ext)}</span></div>`
            : esc(s.advisor_name)}
        </div></div>
        <div class="card"><div class="card-head"><h3>${ic('bell')} University news</h3></div><div class="card-body" style="padding-top:2px">
          <ul class="list news">${news.slice(0, 4).map(n => `<li style="align-items:flex-start"><div class="grow"><div class="t">${esc(n.title)}</div><div class="small muted">${esc(n.summary)}</div>
            <div class="small" style="margin-top:4px"><span class="badge tag b-gold">${esc(n.category)}</span> <span class="muted">${esc(fDate(D(n.date), { day: 'numeric', month: 'short' }))}</span></div></div></li>`).join('')}</ul>
        </div></div>
        ${lastIn ? `<div class="card card-pad small">${ic('door')} <b>Last on campus:</b> ${esc(fDay(D(lastIn.timestamp)))}, ${esc(fTime(lastIn.timestamp.slice(11)))} · ${esc(lastIn.campus)} ${esc(lastIn.gate)}</div>` : ''}
      </div>
    </div>
  </div>`;
}

/* ------------------------------------------------------------------ */
/* 2. TRANSCRIPT                                                       */
/* ------------------------------------------------------------------ */
function renderTranscript(ctx) {
  const { s } = ctx;
  const tr = computeTranscript(ctx);
  const credNow = sum(ctx.enrollments, e => +e.credits);
  const trCredits = sum(ctx.transfers, t => +t.credits);

  const inProg = ctx.sections.map(c => {
    const st = courseStanding(ctx, c.crn);
    const targets = [['A', 90], ['B', 80], ['C', 70]];
    return `<div class="card cc" style="--cc:${c.color}">
      <div class="cc-top"><div><span class="code">${esc(c.course_code)}</span> <span class="small muted">· ${esc(c.credits)} cr · CRN ${esc(c.crn)}</span><h4>${esc(c.course_title)}</h4></div>
      ${st ? `<div class="score"><b>${fmt1(st.pct)}%</b>${gradeChip(st.letter)}</div>` : '<span class="badge">No scores yet</span>'}</div>
      ${st ? `<div class="bar"><i style="width:${st.wDone}%;background:${c.color}"></i></div>
      <div class="small muted">${st.wDone}% of the grade assessed · ${st.remaining}% remaining (final assessment)</div>
      <div class="need">${targets.map(([l, t]) => { const n = st.need(t); return n == null ? '' : n <= 0 ? `<span class="badge b-ok">${l} secured</span>` : n > 100 ? `<span class="badge">${l} out of reach</span>` : `<span class="badge b-info">${l}: need ${Math.ceil(n)}%</span>`; }).join('')}</div>
      <details><summary>Assessment breakdown</summary><table class="assess">${st.recs.map(r => `<tr><td>${esc(r.assessment)}<div class="muted" style="font-size:11.5px">${esc(fDate(D(r.date), { day: 'numeric', month: 'short' }))} · weight ${esc(r.weight_percent)}%</div></td><td class="right mono"><b>${esc(r.score)}</b>/${esc(r.max_score)}</td></tr>`).join('')}</table></details>` : ''}
    </div>`;
  }).join('');

  const termBlocks = [...tr.terms].reverse().map((t, i) => `
    <details class="term" ${i < 2 ? 'open' : ''}>
      <summary>${ic('chev', 'chev')}<h3>${esc(termName(t.code))}</h3><span class="badge">${t.list.length} courses</span>
        <div class="sum-stats"><span>Credits <b>${t.earned}</b>/${t.attempted}</span><span>Term GPA <b>${fmt2(t.gpa)}</b></span><span>Cumulative <b>${fmt2(t.cumGpa)}</b></span></div></summary>
      <div class="table-wrap"><table class="tbl"><thead><tr><th>Course</th><th>Title</th><th class="right">Credits</th><th>Grade</th><th class="right">Quality pts</th><th></th></tr></thead><tbody>
      ${t.list.map(r => `<tr class="${r._counted ? '' : 'excluded'}"><td><span class="code">${esc(r.course_code)}</span></td><td>${esc(r.course_title)}</td><td class="right mono">${esc(r.credits)}</td><td>${gradeChip(r.letter_grade)}</td>
        <td class="right mono">${qp(r.letter_grade) != null ? (qp(r.letter_grade) * +r.credits).toFixed(1) : '—'}</td>
        <td>${!r._counted ? '<span class="badge">Replaced by later attempt</span>' : r._repeated ? '<span class="badge b-info">Repeat · counted</span>' : ''}</td></tr>`).join('')}
      </tbody></table></div>
    </details>`).join('');

  const transfers = ctx.transfers.length ? `<div class="section-title">Transfer credit</div>
    <div class="card"><div class="table-wrap"><table class="tbl"><thead><tr><th>Institution</th><th>External course</th><th>ZU equivalent</th><th class="right">Credits</th><th>Grade</th><th>Awarded</th></tr></thead><tbody>
    ${ctx.transfers.map(t => `<tr><td>${esc(t.institution)}</td><td>${esc(t.external_course_code)} · ${esc(t.external_course_title)}</td><td><span class="code">${esc(t.zu_equivalent_code)}</span> ${esc(t.zu_equivalent_title)}</td><td class="right mono">${esc(t.credits)}</td><td>${gradeChip(t.grade)}</td><td>${esc(shortTerm(t.term_awarded))}</td></tr>`).join('')}
    </tbody></table></div></div>` : '';

  return `
  <div class="toolbar"><div class="muted">Unofficial transcript · ${esc(s.full_name)} · ${esc(s.student_id)} · ${esc(s.program_name)}</div>
    <div class="actions"><button class="btn" onclick="$$('details.term').forEach(d=>d.open=true);window.print()">${ic('print')} Print / PDF</button></div></div>
  <div class="grid g-4">
    <div class="card stat"><span class="label">Cumulative GPA</span><span class="value">${s.cumulative_gpa ? esc((+s.cumulative_gpa).toFixed(2)) : '—'}</span><span class="sub">${tr.gpa != null ? `Recalculated: ${fmt2(tr.gpa)} (${tr.points.toFixed(1)} pts / ${tr.gpaCredits} cr)` : 'No graded terms yet'}</span></div>
    <div class="card stat"><span class="label">Credits earned</span><span class="value">${esc(s.credits_earned)}</span><span class="sub">${trCredits ? `incl. ${trCredits} transfer credits` : 'ZU coursework'}</span></div>
    <div class="card stat"><span class="label">In progress</span><span class="value">${credNow}<small> cr</small></span><span class="sub">${esc(DB.currentTerm.term_name)}</span></div>
    <div class="card stat"><span class="label">Academic standing</span><span class="value" style="font-size:19px;margin-top:6px">${esc(s.academic_standing)}</span><span class="sub">Entry: ${esc(shortTerm(s.entry_term))}</span></div>
  </div>

  <div class="section-title">${esc(DB.currentTerm.term_name)} · in progress</div>
  ${inProg ? `<div class="course-cards">${inProg}</div><p class="small muted">Current percentage = weighted average of the assessments marked so far; letters use the university grade scale. "Need" assumes the remaining weight is one final assessment.</p>` : `<div class="card empty">Not registered this term.</div>`}

  <div class="section-title">Completed terms</div>
  ${termBlocks || `<div class="card empty">${ic('book')}<div>No completed terms yet — your first grades will appear here after ${esc(DB.currentTerm.term_name)}.</div></div>`}
  ${transfers}
  <p class="small muted">Repeat rule: when a course is passed in a later attempt, the passing grade replaces the earlier attempt in the GPA. Every attempt stays on the transcript; replaced attempts are greyed out.</p>`;
}

/* ------------------------------------------------------------------ */
/* 3. DEGREE AUDIT                                                     */
/* ------------------------------------------------------------------ */
function prereqHtml(code, audit) {
  const txt = DB.courseByCode[code]?.prerequisites;
  if (!txt) return '';
  const html = esc(txt.replace(/^Pre-requisite:\s*/i, '')).replace(/\b([A-Z]{3})\s?(\d{3})\b/g, (m, a, b) => {
    const r = audit.best[a + b];
    const cls = r && r.state === 'done' ? 'met' : r && r.state === 'prog' ? 'met' : 'unmet';
    return `<span class="pc ${cls}" title="${cls === 'met' ? 'Completed / in progress' : 'Not yet completed'}">${a} ${b}</span>`;
  });
  return `<div class="prereq">Prerequisite: ${html}</div>`;
}

function renderAudit(ctx) {
  const a = computeAudit(ctx);
  const pDone = a.done / a.total * 100, pProg = a.prog / a.total * 100;
  const f = STATE.auditFilter;
  const statusOf = it => ({
    done: `<span class="req-status st-done"><span class="dot"></span>Completed</span>`,
    prog: `<span class="req-status st-prog"><span class="dot"></span>In progress</span>`,
    fail: `<span class="req-status st-fail"><span class="dot"></span>Retake needed</span>`,
    todo: `<span class="req-status st-todo"><span class="dot"></span>Not started</span>`,
  })[it.state];
  const visible = a.items.filter(it => f === 'all' || (f === 'remaining' ? it.state !== 'done' : it.state === 'done'));
  const sems = groupBy(visible, it => it.req.recommended_semester);
  const order = [...new Set(a.items.map(it => it.req.recommended_semester))];
  const semLabel = k => /^\d+$/.test(k) ? `Semester ${k}` : k;

  const rows = order.filter(k => sems[k]).map(k => {
    const list = sems[k];
    return `<tr class="sem-head"><td colspan="5">${esc(semLabel(k))} <span class="muted" style="text-transform:none;letter-spacing:0;font-weight:500">· ${list.filter(i => i.state === 'done').length}/${list.length} complete</span></td></tr>` +
      list.map(it => {
        const r = it.rec, q = it.req;
        const isElective = !q.course_code;
        const req = isElective ? `<b>${esc(q.requirement_type)}</b>` : `<span class="code">${esc(q.course_code)}</span>${q.alternative_course_code ? ` <span class="small muted">or ${esc(q.alternative_course_code)}</span>` : ''}<div>${esc(q.course_title)}</div>`;
        const sat = r ? `${isElective || r.code !== q.course_code ? `<span class="code">${esc(r.code)}</span> ${esc(r.title)}<br>` : ''}
          <span class="small muted">${r.src === 'transfer' ? `Transfer · ${esc(r.inst)}` : esc(shortTerm(r.term))}${r.prev ? ` · earlier attempt ${esc(r.prev.grade)} (${esc(shortTerm(r.prev.term))})` : ''}</span>` :
          (isElective ? '<span class="small muted">Choose any course from the list</span>' : prereqHtml(q.course_code, a));
        return `<tr><td>${req}</td><td>${sat}</td><td class="right mono">${esc(q.credits)}</td><td>${r && r.grade ? gradeChip(r.grade) : ''}</td><td>${statusOf(it)}</td></tr>`;
      }).join('');
  }).join('');

  const byType = groupBy(a.items, it => it.req.requirement_type);
  const typeCards = Object.entries(byType).map(([t, list]) => {
    const tot = sum(list, i => +i.req.credits), dn = sum(list.filter(i => i.state === 'done'), i => +i.req.credits), pg = sum(list.filter(i => i.state === 'prog'), i => +i.req.credits);
    return `<div class="card stat"><span class="label">${esc(t)}</span><span class="value" style="font-size:22px">${dn}<small> / ${tot} cr</small></span>
      <div class="bar"><i style="width:${(dn + pg) / tot * 100}%;background:var(--ring-q)"></i><i style="width:${dn / tot * 100}%"></i></div><span class="sub">${pg ? `${pg} cr in progress` : dn === tot ? 'Complete' : `${tot - dn} cr remaining`}</span></div>`;
  }).join('');

  return `
  <div class="card card-pad" style="display:flex;gap:28px;align-items:center;flex-wrap:wrap">
    <div class="ring" style="--p:${pDone};--q:${pProg}"><div><b>${Math.round(pDone)}%</b><span>complete</span></div></div>
    <div style="flex:1;min-width:240px">
      <div class="small muted">${esc(ctx.program.college)}</div>
      <h2 style="margin:2px 0 4px;font-size:20px">${esc(ctx.program.program_name)}</h2>
      ${ctx.program.concentration ? `<div style="margin-bottom:8px">Concentration: <b>${esc(ctx.program.concentration)}</b></div>` : ''}
      <div class="small muted">Program code ${esc(ctx.program.program_code)} · ${esc(ctx.program.total_credits)} credits · ${esc(ctx.program.source)}</div>
    </div>
    <div class="legend">
      <div><i style="background:var(--brand-2)"></i>Completed <b>${a.done}</b> cr</div>
      <div><i style="background:var(--ring-q)"></i>In progress <b>${a.prog}</b> cr</div>
      <div><i style="background:var(--track)"></i>Remaining <b>${a.todo + a.fail}</b> cr</div>
    </div>
  </div>

  <div class="grid g-4" style="margin-top:18px">${typeCards}</div>

  <div class="toolbar" style="margin-top:24px">
    <div class="tabs" id="af">${[['all', 'All requirements'], ['remaining', 'Still needed'], ['done', 'Completed']].map(([k, l]) => `<button data-f="${k}" class="${f === k ? 'on' : ''}">${l}</button>`).join('')}</div>
    <span class="small muted">${a.items.length} requirements · ${a.items.filter(i => i.state === 'done').length} met</span>
  </div>
  <div class="card"><div class="table-wrap"><table class="tbl"><thead><tr><th style="width:30%">Requirement</th><th>Satisfied by</th><th class="right">Cr</th><th>Grade</th><th>Status</th></tr></thead>
    <tbody>${rows || `<tr><td colspan="5" class="empty">Nothing to show for this filter.</td></tr>`}</tbody></table></div></div>

  ${a.unapplied.length ? `<div class="section-title">Courses not applied to a requirement</div>
  <div class="card"><div class="table-wrap"><table class="tbl"><thead><tr><th>Course</th><th>Term</th><th class="right">Cr</th><th>Grade</th><th>Note</th></tr></thead><tbody>
  ${a.unapplied.map(r => `<tr><td><span class="code">${esc(r.code)}</span> ${esc(r.title)}</td><td>${esc(shortTerm(r.term))}</td><td class="right mono">${r.credits}</td><td>${r.grade ? gradeChip(r.grade) : '<span class="badge b-info">In progress</span>'}</td>
    <td class="small muted">${r.state === 'fail' ? 'Not passed — no credit' : 'Extra course — all matching slots are already filled'}</td></tr>`).join('')}
  </tbody></table></div></div>` : ''}
  <p class="small muted">Elective slots are filled automatically: Art History electives with AAH courses, Program electives with courses from the program's own subject areas, ZU electives with any remaining course. Confirm elective choices with your advisor${ctx.advisor ? `, ${esc(ctx.advisor.full_name)}` : ''}.</p>`;
}
PAGES.audit.after = () => $$('#af button').forEach(b => b.onclick = () => { STATE.auditFilter = b.dataset.f; renderApp(); });

/* ------------------------------------------------------------------ */
/* 4. CLASS SCHEDULE                                                   */
/* ------------------------------------------------------------------ */
function renderSchedule(ctx) {
  if (location.hash.includes('exams')) STATE.schedTab = 'exams';
  const tab = STATE.schedTab;
  const credits = sum(ctx.sections, c => +c.credits);
  let body = '';
  if (!ctx.sections.length) body = `<div class="card empty">${ic('schedule')}<div>You are not registered for any classes in ${esc(DB.currentTerm.term_name)}.</div></div>`;
  else if (tab === 'list') body = schedList(ctx);
  else if (tab === 'week') body = schedWeek(ctx);
  else body = schedExams(ctx);
  return `
  <div class="toolbar">
    <div class="tabs" id="st">${[['list', 'list', 'List'], ['week', 'grid', 'Weekly calendar'], ['exams', 'pen', 'Final exams']].map(([k, i, l]) => `<button data-t="${k}" class="${tab === k ? 'on' : ''}">${ic(i)}${l}</button>`).join('')}</div>
    <div class="actions"><span class="small muted" style="align-self:center">${ctx.sections.length} classes · ${credits} credit hours</span>
      ${ctx.sections.length ? `<button class="btn" id="ics">${ic('download')} Add to calendar (.ics)</button>` : ''}</div>
  </div>${body}`;
}
PAGES.schedule.after = ctx => {
  $$('#st button').forEach(b => b.onclick = () => { STATE.schedTab = b.dataset.t; if (location.hash.includes('?')) history.replaceState(null, '', '#/schedule'); renderApp(); });
  $('#ics') && ($('#ics').onclick = () => downloadIcs(ctx));
};

function instructorOf(c) { return DB.facultyById[c.instructor_id]; }
// "Show on map" link for a class room (from campus-map.js; nothing if that file didn't load).
const mapLink = (c, s, compact) => typeof window.cmMapLink === 'function' ? window.cmMapLink(c, s, compact) : '';

function schedList(ctx) {
  const rows = [...ctx.sections].sort((a, b) => DAYS.indexOf((a.days || '').split(',')[0]) - DAYS.indexOf((b.days || '').split(',')[0]) || toMin(a.start_time) - toMin(b.start_time));
  return `<div class="stack" style="gap:12px">${rows.map(c => {
    const f = instructorOf(c);
    const days = (c.days || '').split(',').map(d => DAY_LONG[d] || d).join(' & ');
    return `<div class="card sched-card" style="--c:${c.color}"><div class="stripe"></div>
      <div><div><span class="code">${esc(c.course_code)}</span> <span class="small muted">· Section ${esc(c.section)} · CRN ${esc(c.crn)}</span></div>
        <h4>${esc(c.course_title)}</h4>
        <div class="meta"><span>${ic('clock')}${esc(days)} · ${esc(fTime(c.start_time))}–${esc(fTime(c.end_time))}</span><span>${ic('pin')}${esc(c.room)} (${esc(c.campus)}) ${mapLink(c, ctx.s)}</span>
          <span>${ic('user')}${esc(c.instructor_name)}${f ? ` · <a href="mailto:${esc(f.email)}">${esc(f.email)}</a>` : ''}</span></div></div>
      <div class="right"><span class="badge b-ok">${esc(c.status)}</span><div class="small muted" style="margin-top:6px">${esc(c.credits)} credit${+c.credits === 1 ? '' : 's'}<br>${esc(c.part_of_term || '')}</div></div>
    </div>`;
  }).join('')}</div>`;
}

function schedWeek(ctx) {
  const PX = 1.15, startH = 8, endH = 17;
  const H = (endH - startH) * 60 * PX;
  const monday = new Date(TODAY); monday.setDate(TODAY.getDate() - ((TODAY.getDay() + 6) % 7));
  const dates = DAYS.map((_, i) => { const d = new Date(monday); d.setDate(monday.getDate() + i); return d; });
  const now = NOW(), nm = now.getHours() * 60 + now.getMinutes();
  const times = []; for (let h = startH; h <= endH; h++) times.push(`<div style="top:${(h - startH) * 60 * PX}px">${h > 12 ? h - 12 : h}${h >= 12 ? ' PM' : ' AM'}</div>`);
  const cols = DAYS.map(d => {
    const evs = ctx.sections.filter(c => (c.days || '').split(',').includes(d)).map(c => {
      const st = toMin(c.start_time), en = toMin(c.end_time);
      return `<div class="ev" style="--c:${c.color};top:${(st - startH * 60) * PX}px;height:${(en - st) * PX - 2}px" title="${esc(`${c.course_code} ${c.course_title}\n${fTime(c.start_time)}–${fTime(c.end_time)} · ${c.room}\n${c.instructor_name}`)}">
        <b>${esc(c.course_code)}</b><span>${esc(fTime(c.start_time))}–${esc(fTime(c.end_time))}</span><span class="ev-room">${esc(c.room)}${mapLink(c, ctx.s, true)}</span><span>${esc(c.instructor_name)}</span></div>`;
    }).join('');
    const line = d === todayKey && nm >= startH * 60 && nm <= endH * 60 ? `<div class="now-line" style="top:${(nm - startH * 60) * PX}px"></div>` : '';
    return `<div class="week-col ${d === todayKey ? 'is-today' : ''}" style="height:${H}px;background-size:100% ${60 * PX}px">${evs}${line}</div>`;
  }).join('');
  return `<div class="card week"><div class="week-inner">
    <div class="week-head"><div></div>${DAYS.map((d, i) => `<div class="${d === todayKey ? 'is-today' : ''}">${DAY_LONG[d]}<span>${esc(fDate(dates[i], { day: 'numeric', month: 'short' }))}${d === todayKey ? ' · Today' : ''}</span></div>`).join('')}</div>
    <div class="week-body" style="padding:10px 0 14px"><div class="week-times" style="height:${H}px">${times.join('')}</div>${cols}</div>
  </div></div>
  <div class="need" style="margin-top:14px">${ctx.sections.map(c => `<span class="badge" style="background:color-mix(in srgb, ${c.color} 16%, var(--mix));color:var(--ink)"><span style="width:8px;height:8px;border-radius:50%;background:${c.color}"></span>${esc(c.course_code)} · ${esc(c.course_title)}</span>`).join('')}</div>`;
}

function examList(ctx) {
  return ctx.exams.map(x => ({ ...x, dt: D(x.exam_date), s: toMin(x.start_time), e: toMin(x.end_time) }))
    .sort((a, b) => a.exam_date.localeCompare(b.exam_date) || a.s - b.s);
}
function schedExams(ctx) {
  const ex = examList(ctx);
  const conflicts = new Set();
  ex.forEach((a, i) => ex.forEach((b, j) => { if (i < j && a.exam_date === b.exam_date && a.s < b.e && b.s < a.e) { conflicts.add(a.crn); conflicts.add(b.crn); } }));
  const byDay = groupBy(ex, x => x.exam_date);
  const heavy = Object.values(byDay).filter(l => l.length >= 2);
  const missing = ctx.sections.filter(c => !ex.some(x => x.crn === c.crn));
  const period = DB.news.find(n => /final exam/i.test(n.title));
  return `
  ${period ? `<div class="alert a-info" style="margin-bottom:14px">${ic('info')}<div><b>${esc(period.title)}</b>${esc(period.summary)}</div></div>` : ''}
  ${conflicts.size ? `<div class="alert a-bad" style="margin-bottom:14px">${ic('alert')}<div><b>Exam time conflict</b>Two of your exams overlap. Contact the Registrar's Office as soon as possible.</div></div>` : ''}
  ${!conflicts.size && heavy.length ? `<div class="alert a-warn" style="margin-bottom:14px">${ic('alert')}<div><b>Busy day${heavy.length > 1 ? 's' : ''}</b>You have two exams on ${heavy.map(l => esc(fDay(l[0].dt))).join(' and ')}. Plan your revision early.</div></div>` : ''}
  <div class="card"><div class="table-wrap"><table class="tbl"><thead><tr><th>Date</th><th>Time</th><th>Course</th><th>Room</th><th>Countdown</th></tr></thead><tbody>
  ${ex.map(x => { const n = daysFrom(TODAY, x.dt); return `<tr><td class="nowrap"><b>${esc(fDay(x.dt))}</b></td><td class="nowrap mono">${esc(fTime(x.start_time))}–${esc(fTime(x.end_time))}</td>
    <td><span class="code">${esc(x.course_code)}</span> ${esc(x.course_title)} ${conflicts.has(x.crn) ? '<span class="badge b-bad">Conflict</span>' : ''}</td><td class="nowrap">${esc(x.room)}</td>
    <td>${n < 0 ? '<span class="badge">Done</span>' : `<span class="badge ${n <= 14 ? 'b-warn' : 'b-brand'}">${relDays(n)}</span>`}</td></tr>`; }).join('')}
  ${missing.map(c => `<tr><td colspan="2" class="muted">No final exam</td><td><span class="code">${esc(c.course_code)}</span> ${esc(c.course_title)}</td><td colspan="2" class="small muted">Assessed by coursework or project — check with your instructor.</td></tr>`).join('')}
  </tbody></table></div></div>`;
}

function downloadIcs(ctx) {
  const term = DB.currentTerm;
  const pad = n => String(n).padStart(2, '0');
  const stamp = (dt, t) => `${dt.getFullYear()}${pad(dt.getMonth() + 1)}${pad(dt.getDate())}T${t.replace(':', '')}00`;
  const icsEsc = s => String(s).replace(/[\\,;]/g, m => '\\' + m).replace(/\n/g, '\\n');
  const BYDAY = { Mon: 'MO', Tue: 'TU', Wed: 'WE', Thu: 'TH', Fri: 'FR', Sun: 'SU', Sat: 'SA' };
  const firstExam = examList(ctx)[0]?.exam_date || term.end_date;
  const classesEnd = D(firstExam); classesEnd.setDate(classesEnd.getDate() - 1);
  const until = `${classesEnd.getFullYear()}${pad(classesEnd.getMonth() + 1)}${pad(classesEnd.getDate())}T235959`;
  const lines = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Student Access Portal demo//EN', 'CALSCALE:GREGORIAN'];
  ctx.sections.forEach(c => {
    const days = (c.days || '').split(',');
    const first = D(term.start_date);
    while (!days.includes(['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][first.getDay()])) first.setDate(first.getDate() + 1);
    lines.push('BEGIN:VEVENT', `UID:${c.crn}-${term.term_code}@sap.demo`, `DTSTAMP:${stamp(TODAY, '00:00')}`,
      `DTSTART:${stamp(first, c.start_time)}`, `DTEND:${stamp(first, c.end_time)}`,
      `RRULE:FREQ=WEEKLY;BYDAY=${days.map(d => BYDAY[d]).join(',')};UNTIL=${until}`,
      `SUMMARY:${icsEsc(c.course_code + ' ' + c.course_title)}`, `LOCATION:${icsEsc(c.room)}`, `DESCRIPTION:${icsEsc('CRN ' + c.crn + ' · ' + c.instructor_name)}`, 'END:VEVENT');
  });
  examList(ctx).forEach(x => lines.push('BEGIN:VEVENT', `UID:exam-${x.crn}@sap.demo`, `DTSTAMP:${stamp(TODAY, '00:00')}`, `DTSTART:${stamp(x.dt, x.start_time)}`, `DTEND:${stamp(x.dt, x.end_time)}`,
    `SUMMARY:${icsEsc('Final exam: ' + x.course_code + ' ' + x.course_title)}`, `LOCATION:${icsEsc(x.room)}`, 'END:VEVENT'));
  lines.push('END:VCALENDAR');
  const url = URL.createObjectURL(new Blob([lines.join('\r\n')], { type: 'text/calendar' }));
  const a = Object.assign(document.createElement('a'), { href: url, download: `schedule-${ctx.s.student_id}-${term.term_code}.ics` });
  document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/* ------------------------------------------------------------------ */
/* 5. ATTENDANCE                                                       */
/* ------------------------------------------------------------------ */
function renderAttendance(ctx) {
  const rows = ctx.attendance.map(a => ({ a, i: attendanceInfo(a), sec: DB.sectionByCrn[a.crn], enr: ctx.enrollments.find(e => e.crn === a.crn) }))
    .sort((x, y) => y.i.pctAllotted - x.i.pctAllotted);
  const totHeld = sum(rows, r => r.i.held), totAbs = sum(rows, r => r.i.abs);
  const overall = totHeld ? (totHeld - totAbs) / totHeld * 100 : 100;
  const asOf = rows[0]?.a.as_of_date;
  const color = l => l === 'bad' ? 'var(--bad)' : l === 'warn2' ? 'var(--warn)' : l === 'warn' ? 'var(--gold)' : 'var(--ok)';

  const badgeCls = l => ({ bad: 'b-bad', warn2: 'b-warn', warn: 'b-gold', ok: 'b-ok' })[l];
  const list = rows.map(({ a, i, sec, enr }) => {
    const scale = 20; // bar runs from 0% to 20% absences
    const msg = i.level === 'bad' ? `<b style="color:var(--bad)">Above the 15% limit.</b> This leads to a WF grade (0.0 in the GPA) unless an appeal is accepted.`
      : i.level === 'warn2' ? `<b style="color:var(--warn)">Second warning.</b> ${i.left > 0 ? `${i.left} more absence${i.left === 1 ? '' : 's'} allowed` : 'No more absences allowed'} before going over 15%.`
      : i.level === 'warn' ? `<b style="color:var(--gold-ink)">First warning.</b> ${i.left} more absence${i.left === 1 ? '' : 's'} allowed before going over 15%.`
      : `${i.left} absence${i.left === 1 ? '' : 's'} allowed before going over 15%.`;
    const appeal = enr?.attendance_appeal_status;
    return `<div class="att-row">
      <div><span class="code">${esc(a.course_code)}</span> <span class="small muted">· CRN ${esc(a.crn)}</span><h4>${esc(sec?.course_title || a.course_code)}</h4>
        <div class="small muted">${esc(sec?.days?.replace(',', ' & ') || '')} ${esc(fTime(sec?.start_time))} · ${esc(sec?.instructor_name || '')}</div>
        <div style="margin-top:6px;display:flex;gap:6px;flex-wrap:wrap"><span class="badge ${badgeCls(i.level)}">${esc(i.label)}</span>${appeal ? `<span class="badge b-info">Attendance appeal: ${esc(appeal)}</span>` : ''}</div></div>
      <div><div class="pbar"><i style="width:${Math.min(100, i.pctAllotted / scale * 100)}%;background:${color(i.level)}"></i>
          <span style="left:25%"></span><span style="left:50%"></span><span style="left:75%" class="lim"></span></div>
        <div class="pbar-lbl"><span style="left:25%">5%</span><span style="left:50%">10%</span><span style="left:75%">15%</span></div>
        <div class="small" style="margin-top:6px">${msg}</div>
        <div class="small muted" style="margin-top:2px">${i.abs} absences ÷ ${i.allotted} meetings allotted · ${i.held} meetings held so far</div></div>
      <div class="att-num"><b style="color:${color(i.level)}">${fmt1(i.pctAllotted)}%</b><span class="small muted">${i.abs} absence${i.abs === 1 ? '' : 's'}</span></div>
    </div>`;
  }).join('');

  // campus entry log grouped by day
  const days = groupBy(ctx.entries, e => e.timestamp.slice(0, 10));
  const visits = Object.keys(days).sort().reverse().slice(0, 8).map(d => {
    const ins = days[d].filter(e => e.direction === 'In').map(e => e.timestamp).sort();
    const outs = days[d].filter(e => e.direction === 'Out').map(e => e.timestamp).sort();
    const tin = ins[0], tout = outs[outs.length - 1];
    const mins = tin && tout ? toMin(tout.slice(11)) - toMin(tin.slice(11)) : null;
    const gate = days[d].find(e => e.direction === 'In')?.gate || days[d][0].gate;
    return `<tr><td class="nowrap"><b>${esc(fDay(D(d)))}</b></td><td class="mono">${tin ? esc(fTime(tin.slice(11))) : '—'}</td><td class="mono">${tout ? esc(fTime(tout.slice(11))) : '—'}</td>
      <td class="mono">${mins != null ? `${Math.floor(mins / 60)}h ${String(mins % 60).padStart(2, '0')}m` : '—'}</td><td>${esc(days[d][0].campus)} · ${esc(gate)}</td></tr>`;
  }).join('');

  return `
  <div class="grid g-3">
    <div class="card card-pad" style="display:flex;gap:16px;align-items:center"><div class="donut" style="--v:${overall};--dc:${overall >= 90 ? 'var(--ok)' : overall >= 85 ? 'var(--warn)' : 'var(--bad)'}"><span>${Math.round(overall)}%</span></div>
      <div><div class="small muted">Overall attendance</div><b style="font-size:18px">${totHeld - totAbs} of ${totHeld}</b><div class="small muted">meetings attended so far</div></div></div>
    <div class="card stat"><span class="label">Total absences</span><span class="value">${totAbs}</span><span class="sub">across ${rows.length} classes${asOf ? ` · as of ${esc(fDate(D(asOf), { day: 'numeric', month: 'short' }))}` : ''}</span></div>
    <div class="card stat"><span class="label">Classes needing attention</span><span class="value" style="color:${rows.some(r => r.i.level === 'bad') ? 'var(--bad)' : rows.some(r => r.i.level !== 'ok') ? 'var(--warn)' : 'var(--ok)'}">${rows.filter(r => r.i.level !== 'ok').length}</span><span class="sub">${rows.filter(r => r.i.level === 'bad').length} above 15% · ${rows.filter(r => r.i.level === 'warn2').length} at 10%+ · ${rows.filter(r => r.i.level === 'warn').length} at 5%+</span></div>
  </div>
  <div class="alert a-info" style="margin-top:18px">${ic('info')}<div><b>Attendance policy</b>Absence % = absences ÷ meetings allotted for the class. A first warning is given at 5%, a second warning at 10%, and more than 15% leads to a WF grade, which counts as 0.0 in your GPA.</div></div>
  <div class="section-title">By class</div>
  <div class="card">${list || `<div class="empty">No attendance records for this term.</div>`}</div>
  <div class="section-title">Campus gate log</div>
  <div class="card"><div class="table-wrap"><table class="tbl"><thead><tr><th>Day</th><th>First in</th><th>Last out</th><th>On campus</th><th>Gate</th></tr></thead><tbody>
    ${visits || `<tr><td colspan="5" class="empty">No gate entries recorded.</td></tr>`}</tbody></table></div></div>
  <p class="small muted">The gate log shows card taps at campus entrances. It is shown for your information and is separate from class attendance, which is recorded by your instructors.</p>`;
}

/* ------------------------------------------------------------------ */
/* 6. HOLDS                                                            */
/* ------------------------------------------------------------------ */
const HOLD_STYLE = {
  Financial: { icon: 'dollar', bg: 'var(--bad-soft)', fg: 'var(--bad)', steps: ['Check the amount due with the Finance Office.', 'Pay or agree a payment plan.', 'The hold is released once the payment is confirmed.'] },
  Advising: { icon: 'user', bg: 'var(--warn-soft)', fg: 'var(--warn)', steps: ['Book a meeting with your academic advisor.', 'Bring your degree audit and a draft plan for next term.', 'Your advisor releases the hold after the meeting.'] },
  Library: { icon: 'book', bg: 'var(--info-soft)', fg: 'var(--info)', steps: ['Return or renew the item at the Library desk.', 'Pay any overdue fine.'] },
  Registrar: { icon: 'transcript', bg: 'var(--brand-soft)', fg: 'var(--brand)', steps: ['Contact the office named on the hold.', 'Provide any missing document or return the item.'] },
};
function renderHolds(ctx) {
  const reg = registrationStatus(ctx);
  const active = reg.activeHolds.sort((a, b) => (b.blocks_registration === 'Yes') - (a.blocks_registration === 'Yes'));
  const released = ctx.holds.filter(h => h.released_date);
  const card = (h, isActive) => {
    const st = HOLD_STYLE[h.hold_type] || HOLD_STYLE.Registrar;
    const days = daysFrom(D(h.start_date), TODAY);
    const advisorLine = h.hold_type === 'Advising' && ctx.advisor ? `<div class="small" style="margin-top:8px">Your advisor: <b>${esc(ctx.advisor.full_name)}</b> · <a href="mailto:${esc(ctx.advisor.email)}">${esc(ctx.advisor.email)}</a> · Office ${esc(ctx.advisor.office)}</div>` : '';
    return `<div class="card hold">
      <div class="hold-ico" style="background:${isActive ? st.bg : 'var(--bg)'};color:${isActive ? st.fg : 'var(--muted)'}">${ic(st.icon)}</div>
      <div><h4>${esc(h.hold_type)} hold <span class="small muted" style="font-weight:500">· ${esc(h.hold_id)}</span></h4>
        <div>${esc(h.reason)}</div>
        <div class="meta"><span>${ic('pin')}${esc(h.office)}</span><span>${ic('clock')}Placed ${esc(fDate(D(h.start_date)))}${isActive ? ` (${days} days ago)` : ` · released ${esc(fDate(D(h.released_date)))}`}</span></div>
        ${isActive ? `<ol class="steps">${st.steps.map(x => `<li>${esc(x)}</li>`).join('')}</ol>${advisorLine}` : ''}</div>
      <div class="right">${isActive ? (h.blocks_registration === 'Yes' ? '<span class="badge b-bad">Blocks registration</span>' : '<span class="badge b-warn">Does not block registration</span>') : '<span class="badge b-ok">Released</span>'}</div>
    </div>`;
  };

  let regBox = '';
  if (reg.t) {
    const ready = !reg.blocking.length;
    const steps = [
      { l: 'Holds cleared', d: ready ? 'No blocking holds' : `${reg.blocking.length} blocking`, s: ready ? 'done' : 'cur' },
      { l: 'Time ticket opens', d: `${fDay(reg.start)}, ${fTime(reg.t.registration_start.slice(11))}`, s: reg.phase !== 'before' ? 'done' : ready ? 'cur' : '' },
      { l: 'Registration closes', d: `${fDay(reg.end)}, ${fTime(reg.t.registration_end.slice(11))}`, s: reg.phase === 'closed' ? 'done' : '' },
    ];
    regBox = `<div class="card card-pad">
      <div style="display:flex;justify-content:space-between;gap:12px;flex-wrap:wrap;align-items:center">
        <div><div class="small muted">Registration readiness</div><h3 style="margin:2px 0 0;font-size:18px">${esc(reg.t.term_name)}</h3></div>
        ${ready ? `<span class="badge b-ok" style="font-size:12.5px">${ic('ok')} Ready to register${reg.phase === 'before' ? ' ' + relDays(reg.days) : ''}</span>` : `<span class="badge b-bad" style="font-size:12.5px">${ic('alert')} Action needed before ${esc(fDate(reg.start, { day: 'numeric', month: 'short' }))}</span>`}
      </div>
      <div class="timeline" style="margin-top:18px">${steps.map(x => `<div class="tl-step ${x.s}"><b>${esc(x.l)}</b>${esc(x.d)}</div>`).join('')}</div>
    </div>`;
  }

  return `
  ${regBox}
  <div class="section-title">Active holds (${active.length})</div>
  ${active.length ? `<div class="stack" style="gap:12px">${active.map(h => card(h, true)).join('')}</div>`
    : `<div class="card empty">${ic('ok')}<div><b style="color:var(--ink)">No active holds</b><br>Nothing on your account is stopping registration or access to services.</div></div>`}
  ${released.length ? `<div class="section-title">Released holds</div><div class="stack" style="gap:12px">${released.map(h => card(h, false)).join('')}</div>` : ''}
  <p class="small muted">Resolution steps are general guidance; the office named on each hold has the final word.</p>`;
}


/* ------------------------------------------------------------------ */
/* 7. GPA CALCULATOR (extra)                                           */
/* ------------------------------------------------------------------ */
// Grades a student can pick: every letter in grade_scale.csv that counts in the GPA (WF excluded).
const calcLetters = () => DB.grade_scale.filter(g => countsInGpa(g.letter_grade) && qp(g.letter_grade) != null && g.letter_grade !== 'WF').map(g => g.letter_grade);

// Adds the picked grades as this term's results and runs the same transcript calculation,
// so the repeat rule and rounding are exactly the ones used on the transcript page.
function projectGpa(ctx, picks) {
  const now = computeTranscript(ctx);
  const rows = ctx.grades.map(r => ({ course_code: r.course_code, course_title: r.course_title, term_code: r.term_code, letter_grade: r.letter_grade, credits: r.credits }));
  const picked = ctx.sections.filter(c => picks[c.crn]);
  picked.forEach(c => rows.push({ course_code: c.course_code, course_title: c.course_title, term_code: CONFIG.currentTerm, letter_grade: picks[c.crn], credits: c.credits }));
  const proj = computeTranscript({ ...ctx, grades: rows });
  const term = proj.terms.find(t => t.code === CONFIG.currentTerm);
  return { now: now.gpa, term: term ? term.gpa : null, cum: proj.gpa, picked: picked.length, credits: sum(picked, c => +c.credits) };
}

function calcDefaults(ctx) {
  const out = {};
  ctx.sections.forEach(c => { const st = courseStanding(ctx, c.crn); if (st && st.letter !== '—') out[c.crn] = st.letter === 'WF' ? 'F' : st.letter; });
  return out;
}

function calcResultsHtml(ctx) {
  const r = projectGpa(ctx, STATE.calc);
  const diff = r.now != null && r.cum != null ? round2(r.cum) - round2(r.now) : null;
  const delta = diff == null ? '' : Math.abs(diff) < 0.005 ? `<span class="calc-delta">No change</span>`
    : `<span class="calc-delta ${diff > 0 ? 'up' : 'down'}">${diff > 0 ? '▲' : '▼'} ${Math.abs(diff).toFixed(2)} vs. now</span>`;
  const standing = r.cum == null ? '' : r.cum < 2 ? `<div class="alert a-bad">${ic('alert')}<div><b>Below 2.00 — Academic Probation</b>A cumulative GPA below 2.00 places you on academic probation. Talk to your advisor about a plan.</div></div>`
    : `<div class="alert a-ok">${ic('ok')}<div><b>2.00 or above — Good Standing</b>This result keeps your cumulative GPA at or above the 2.00 minimum.</div></div>`;
  return `
    <div class="card stat calc-out"><span class="label">${ic('layers')} Projected cumulative GPA</span><span class="value">${fmt2(r.cum)}<small> / 4.00</small></span>
      <span class="sub">Now: <b>${fmt2(r.now)}</b> ${delta}</span></div>
    <div class="card stat calc-out"><span class="label">${ic('book')} Projected term GPA</span><span class="value">${fmt2(r.term)}</span>
      <span class="sub">${r.picked} of ${ctx.sections.length} courses · ${r.credits} credits</span></div>
    ${standing}`;
}

function renderCalculator(ctx) {
  if (STATE.calc._sid !== ctx.s.student_id) STATE.calc = { ...calcDefaults(ctx), _sid: ctx.s.student_id };
  const letters = calcLetters();
  if (!ctx.sections.length) return `<div class="card empty">${ic('calc')}<div>You are not registered for any classes in ${esc(DB.currentTerm.term_name)}.</div></div>`;
  const rows = ctx.sections.map(c => {
    const st = courseStanding(ctx, c.crn);
    return `<div class="calc-row">
      <div><span class="code">${esc(c.course_code)}</span> <span class="small muted">· ${esc(c.credits)} cr</span><h4>${esc(c.course_title)}</h4></div>
      <div class="calc-now">${st ? `Current score<br><b class="mono">${fmt1(st.pct)}%</b> ${gradeChip(st.letter)}` : 'No scores yet'}</div>
      <select data-crn="${esc(c.crn)}" aria-label="Expected grade for ${esc(c.course_code)}">
        <option value="">Not counted</option>
        ${letters.map(l => `<option value="${esc(l)}" ${STATE.calc[c.crn] === l ? 'selected' : ''}>${esc(l)} (${esc((+DB.scale[l].quality_points).toFixed(1))})</option>`).join('')}
      </select>
    </div>`;
  }).join('');
  return `
  <div class="toolbar"><div class="muted">Pick an expected grade for each ${esc(DB.currentTerm.term_name)} course to see your GPA after this term.</div>
    <div class="actions"><button class="btn" id="calc-reset">${ic('layers')} Use my current scores</button><button class="btn" id="calc-clear">Clear all</button></div></div>
  <div class="grid g-main">
    <div class="card"><div class="card-head"><h3>${ic('book')} This term's courses</h3><span class="small muted">Expected grade</span></div>${rows}</div>
    <div class="stack" id="calc-out">${calcResultsHtml(ctx)}</div>
  </div>
  <p class="small muted">Same rules as the transcript: GPA = sum(quality points × credits) ÷ sum(credits) over grades that count in the GPA; transfer credits are not included; passing a course you failed before replaces the F. "Use my current scores" fills in the letter for your weighted score so far (score_records.csv).</p>`;
}
PAGES.calculator.after = ctx => {
  const refresh = () => { const out = $('#calc-out'); out.innerHTML = calcResultsHtml(ctx); applyLang(out); };
  $$('select[data-crn]').forEach(sel => sel.onchange = () => { STATE.calc[sel.dataset.crn] = sel.value; refresh(); });
  const reset = all => { STATE.calc = { ...(all ? calcDefaults(ctx) : {}), _sid: ctx.s.student_id }; renderApp(); };
  $('#calc-reset') && ($('#calc-reset').onclick = () => reset(true));
  $('#calc-clear') && ($('#calc-clear').onclick = () => reset(false));
};

/* ------------------------------------------------------------------ */
/* Arabic translation of the interface                                 */
/* ------------------------------------------------------------------ */
// The pages are written in English. In Arabic mode every text node is looked up here after
// rendering. Data values from the CSV files (course titles, reasons, rooms) are left as they are.
const AR = {
  // brand + login
  'Zayed University': 'جامعة زايد', 'Student Access Portal': 'بوابة الطالب',
  'Everything about your studies, in one place.': 'كل ما يخص دراستك، في مكان واحد.',
  'Transcript': 'كشف الدرجات', 'Degree audit': 'التدقيق الأكاديمي', 'Weekly schedule': 'الجدول الأسبوعي',
  'Attendance': 'الحضور', 'Holds': 'القيود', 'Vibe Code Jam 2026 · demo with fictional data': 'Vibe Code Jam 2026 · نسخة تجريبية ببيانات وهمية',
  'Sign in': 'تسجيل الدخول', 'Use your student ID and portal password.': 'استخدم رقمك الجامعي وكلمة مرور البوابة.',
  'Student ID': 'الرقم الجامعي', 'Password': 'كلمة المرور', 'Demo: data is read from': 'نسخة تجريبية: تُقرأ البيانات من',
  '9-digit student ID': 'رقم جامعي من 9 أرقام', 'Show password': 'إظهار كلمة المرور',
  'Enter your student ID and password.': 'أدخل رقمك الجامعي وكلمة المرور.',
  'A student ID has 9 digits, for example 202312001.': 'يتكون الرقم الجامعي من 9 أرقام، مثل 202312001.',
  'Incorrect password for this student ID. Passwords are case-sensitive.': 'كلمة المرور غير صحيحة لهذا الرقم الجامعي. كلمة المرور حساسة لحالة الأحرف.',
  'Dark mode': 'الوضع الداكن', 'Light mode': 'الوضع الفاتح', 'Switch to English': 'التبديل إلى الإنجليزية',
  // shell + nav
  'Home': 'الرئيسية', 'Academic transcript': 'كشف الدرجات الأكاديمي', 'Class schedule': 'الجدول الدراسي',
  'Class attendance': 'حضور المحاضرات', 'GPA calculator': 'حاسبة المعدل', 'Sign out': 'تسجيل الخروج',
  'Data loaded from CSV at start-up · Demo portal for Vibe Code Jam 2026 · Figures are calculated from the files and are not official records.':
    'تُحمَّل البيانات من ملفات CSV عند بدء التشغيل · بوابة تجريبية لـ Vibe Code Jam 2026 · الأرقام محسوبة من الملفات وليست سجلات رسمية.',
  // home
  'Good morning,': 'صباح الخير،', 'Good afternoon,': 'مساء الخير،', 'Good evening,': 'مساء الخير،',
  'Active': 'نشط', 'Good Standing': 'وضع أكاديمي جيد', 'New Student': 'طالب جديد', 'Pending': 'قيد المراجعة',
  'Cumulative GPA': 'المعدل التراكمي', 'Official record': 'السجل الرسمي', 'First GPA after this term': 'أول معدل بعد هذا الفصل',
  'Credits earned': 'الساعات المكتسبة', 'This term': 'هذا الفصل', 'courses': 'مقررات', 'active': 'نشطة',
  'Nothing blocking registration': 'لا شيء يمنع التسجيل', "You're all set": 'كل شيء على ما يرام',
  'No holds blocking registration and attendance is within limits in every class.': 'لا توجد قيود تمنع التسجيل، والحضور ضمن الحدود في جميع المقررات.',
  'Full schedule': 'الجدول الكامل', 'Done': 'انتهت', 'Upcoming': 'قادمة', 'In progress': 'قيد الدراسة',
  'No classes today.': 'لا توجد محاضرات اليوم.', 'Upcoming final exams': 'الامتحانات النهائية القادمة', 'All exams': 'كل الامتحانات',
  'No final exams scheduled.': 'لا توجد امتحانات نهائية مجدولة.', 'today': 'اليوم', 'tomorrow': 'غداً', 'yesterday': 'أمس',
  'Opens today': 'يفتح اليوم', 'Opens tomorrow': 'يفتح غداً', 'Open now': 'مفتوح الآن', 'Closed': 'مغلق', 'Blocked by hold': 'محظور بسبب قيد',
  'Your advisor': 'مرشدك الأكاديمي', 'University news': 'أخبار الجامعة', 'Last on campus:': 'آخر حضور في الحرم:', 'View holds': 'عرض القيود', 'Details': 'التفاصيل',
  'This leads to a WF grade (0.0 in the GPA) unless an appeal is accepted.': 'يؤدي ذلك إلى تقدير WF (صفر في المعدل) ما لم يُقبل التظلم.',
  // transcript
  'Print / PDF': 'طباعة / PDF', 'ZU coursework': 'مقررات جامعة زايد', 'cr': 'ساعة', 'Academic standing': 'الوضع الأكاديمي',
  'Assessment breakdown': 'تفاصيل التقييمات', 'No scores yet': 'لا توجد درجات بعد', 'Completed terms': 'الفصول المكتملة',
  'Credits': 'الساعات', 'Term GPA': 'معدل الفصل', 'Cumulative': 'التراكمي', 'Course': 'المقرر', 'Title': 'العنوان', 'Grade': 'التقدير',
  'Quality pts': 'نقاط الجودة', 'Repeat · counted': 'معاد · محتسب', 'Replaced by later attempt': 'استُبدل بمحاولة لاحقة',
  'Transfer credit': 'الساعات المعادلة', 'Institution': 'المؤسسة', 'External course': 'المقرر الخارجي', 'ZU equivalent': 'المعادل في جامعة زايد', 'Awarded': 'تاريخ المعادلة',
  'No graded terms yet': 'لا توجد فصول مقيّمة بعد', 'Not registered this term.': 'غير مسجل في هذا الفصل.',
  'Current percentage = weighted average of the assessments marked so far; letters use the university grade scale. "Need" assumes the remaining weight is one final assessment.':
    'النسبة الحالية = المتوسط الموزون للتقييمات المصححة حتى الآن؛ التقديرات حسب سلم درجات الجامعة. "تحتاج" تفترض أن الوزن المتبقي تقييم نهائي واحد.',
  'Repeat rule: when a course is passed in a later attempt, the passing grade replaces the earlier attempt in the GPA. Every attempt stays on the transcript; replaced attempts are greyed out.':
    'قاعدة الإعادة: عند النجاح في مقرر في محاولة لاحقة، يحل تقدير النجاح محل المحاولة السابقة في المعدل. تبقى جميع المحاولات في الكشف، وتظهر المحاولات المستبدلة باللون الرمادي.',
  // audit
  'complete': 'مكتمل', 'Concentration:': 'التخصص الفرعي:', 'Completed': 'مكتمل', 'Remaining': 'متبقٍ', 'Complete': 'مكتمل',
  'All requirements': 'كل المتطلبات', 'Still needed': 'المتبقية', 'Requirement': 'المتطلب', 'Satisfied by': 'تم استيفاؤه بـ',
  'Cr': 'ساعة', 'Status': 'الحالة', 'Not started': 'لم يبدأ', 'Retake needed': 'يجب الإعادة', 'Completed / in progress': 'مكتمل / قيد الدراسة',
  'Not yet completed': 'لم يكتمل بعد', 'Choose any course from the list': 'اختر أي مقرر من القائمة', 'Nothing to show for this filter.': 'لا يوجد ما يُعرض لهذا الفلتر.',
  'Prerequisite:': 'المتطلب السابق:', 'or': 'أو', 'and': 'و', ', or': '، أو', 'Courses not applied to a requirement': 'مقررات غير محتسبة ضمن المتطلبات',
  'Not passed — no credit': 'لم ينجح — بدون ساعات', 'Extra course — all matching slots are already filled': 'مقرر إضافي — جميع الخانات المناسبة ممتلئة',
  'Program Required': 'متطلبات البرنامج', 'General Education': 'التعليم العام', 'ZU Elective': 'اختياري جامعة زايد',
  'Program Elective': 'اختياري البرنامج', 'Art History Elective': 'اختياري تاريخ الفن', 'Term': 'الفصل', 'Note': 'ملاحظة',
  // schedule
  'List': 'قائمة', 'Weekly calendar': 'التقويم الأسبوعي', 'Final exams': 'الامتحانات النهائية', 'Add to calendar (.ics)': 'إضافة إلى التقويم (.ics)',
  'Registered': 'مسجل', 'Full Semester': 'الفصل كاملاً', 'Busy day': 'يوم مزدحم', 'Busy days': 'أيام مزدحمة', 'Date': 'التاريخ', 'Time': 'الوقت',
  'Room': 'القاعة', 'Countdown': 'العد التنازلي', 'No final exam': 'لا يوجد امتحان نهائي', 'Exam time conflict': 'تعارض في مواعيد الامتحانات',
  'Two of your exams overlap. Contact the Registrar\'s Office as soon as possible.': 'يتداخل اثنان من امتحاناتك. تواصل مع مكتب التسجيل في أقرب وقت.',
  'Conflict': 'تعارض', 'Assessed by coursework or project — check with your instructor.': 'يُقيَّم بالأعمال الفصلية أو مشروع — راجع أستاذ المقرر.',
  // attendance
  'Overall attendance': 'نسبة الحضور الكلية', 'meetings attended so far': 'محاضرة حضرتها حتى الآن', 'Total absences': 'مجموع الغياب',
  'Classes needing attention': 'مقررات تحتاج انتباهاً', 'Attendance policy': 'سياسة الحضور', 'By class': 'حسب المقرر',
  'Absence % = absences ÷ meetings allotted for the class. A first warning is given at 5%, a second warning at 10%, and more than 15% leads to a WF grade, which counts as 0.0 in your GPA.':
    'نسبة الغياب = عدد الغيابات ÷ عدد المحاضرات المقررة. يُعطى إنذار أول عند 5%، وإنذار ثانٍ عند 10%، وتجاوز 15% يؤدي إلى تقدير WF ويُحتسب صفراً في المعدل.',
  'Below 5%': 'أقل من 5%', 'First warning (5%)': 'إنذار أول (5%)', 'Second warning (10%)': 'إنذار ثانٍ (10%)', 'Over 15% · WF risk': 'أكثر من 15% · خطر WF',
  'Above the 15% limit.': 'تجاوز حد 15%.', 'Second warning.': 'إنذار ثانٍ.', 'First warning.': 'إنذار أول.',
  'No more absences allowed before going over 15%.': 'لا يُسمح بأي غياب إضافي قبل تجاوز 15%.', 'No attendance records for this term.': 'لا توجد سجلات حضور لهذا الفصل.',
  'Campus gate log': 'سجل بوابات الحرم', 'Day': 'اليوم', 'First in': 'أول دخول', 'Last out': 'آخر خروج', 'On campus': 'المدة في الحرم', 'Gate': 'البوابة',
  'No gate entries recorded.': 'لا توجد سجلات دخول.',
  'The gate log shows card taps at campus entrances. It is shown for your information and is separate from class attendance, which is recorded by your instructors.':
    'يعرض سجل البوابات تمرير البطاقة عند مداخل الحرم. وهو للاطلاع فقط ومنفصل عن حضور المحاضرات الذي يسجله الأساتذة.',
  // holds
  'Registration readiness': 'الجاهزية للتسجيل', 'Ready to register': 'جاهز للتسجيل', 'Holds cleared': 'إزالة القيود', 'No blocking holds': 'لا توجد قيود مانعة',
  'Time ticket opens': 'فتح موعد التسجيل', 'Registration closes': 'إغلاق التسجيل', 'No active holds': 'لا توجد قيود نشطة',
  'Nothing on your account is stopping registration or access to services.': 'لا يوجد في حسابك ما يمنع التسجيل أو الوصول إلى الخدمات.',
  'Released holds': 'القيود المرفوعة', 'Released': 'مرفوع', 'Blocks registration': 'يمنع التسجيل', 'Does not block registration': 'لا يمنع التسجيل',
  'Resolution steps are general guidance; the office named on each hold has the final word.': 'خطوات الحل إرشادات عامة؛ والقرار النهائي للجهة المذكورة في كل قيد.',
  'Your advisor:': 'مرشدك:',
  'Check the amount due with the Finance Office.': 'تحقق من المبلغ المستحق لدى الإدارة المالية.', 'Pay or agree a payment plan.': 'ادفع المبلغ أو اتفق على خطة سداد.',
  'The hold is released once the payment is confirmed.': 'يُرفع القيد بعد تأكيد الدفع.', 'Book a meeting with your academic advisor.': 'احجز موعداً مع مرشدك الأكاديمي.',
  'Bring your degree audit and a draft plan for next term.': 'أحضر التدقيق الأكاديمي ومسودة خطة الفصل القادم.', 'Your advisor releases the hold after the meeting.': 'يرفع مرشدك القيد بعد الاجتماع.',
  'Return or renew the item at the Library desk.': 'أعد المادة أو جدّد استعارتها في مكتب المكتبة.', 'Pay any overdue fine.': 'ادفع أي غرامة تأخير.',
  'Contact the office named on the hold.': 'تواصل مع الجهة المذكورة في القيد.', 'Provide any missing document or return the item.': 'قدّم أي مستند ناقص أو أعد المادة.',
  // calculator
  'Use my current scores': 'استخدم درجاتي الحالية', 'Clear all': 'مسح الكل', "This term's courses": 'مقررات هذا الفصل', 'Expected grade': 'التقدير المتوقع',
  'Current score': 'الدرجة الحالية', 'Not counted': 'غير محتسب', 'Projected cumulative GPA': 'المعدل التراكمي المتوقع', 'Projected term GPA': 'معدل الفصل المتوقع',
  'Now:': 'الآن:', 'No change': 'بدون تغيير', '2.00 or above — Good Standing': '2.00 أو أعلى — وضع أكاديمي جيد', 'Below 2.00 — Academic Probation': 'أقل من 2.00 — إنذار أكاديمي',
  'This result keeps your cumulative GPA at or above the 2.00 minimum.': 'هذه النتيجة تبقي معدلك التراكمي عند الحد الأدنى 2.00 أو أعلى.',
  'A cumulative GPA below 2.00 places you on academic probation. Talk to your advisor about a plan.': 'المعدل التراكمي الأقل من 2.00 يضعك تحت الإنذار الأكاديمي. تحدث مع مرشدك لوضع خطة.',
  'Same rules as the transcript: GPA = sum(quality points × credits) ÷ sum(credits) over grades that count in the GPA; transfer credits are not included; passing a course you failed before replaces the F. "Use my current scores" fills in the letter for your weighted score so far (score_records.csv).':
    'نفس قواعد كشف الدرجات: المعدل = مجموع (نقاط الجودة × الساعات) ÷ مجموع الساعات للتقديرات المحتسبة في المعدل؛ الساعات المعادلة غير محتسبة؛ والنجاح في مقرر رسبت فيه سابقاً يحل محل F. "استخدم درجاتي الحالية" يملأ التقدير حسب درجتك الموزونة حتى الآن (score_records.csv).',
  // campus map (campus-map.js)
  'Campus map': 'خريطة الحرم', 'Selected': 'المحدد', 'Buildings with classrooms': 'مبانٍ بها قاعات دراسية', 'Find': 'بحث',
  'Building or room code…': 'رمز المبنى أو القاعة…', 'Building or room code': 'رمز المبنى أو القاعة', 'is in': 'في',
  'Click a building, or type a building or room code such as F2 or M1-112, to see where it is and which gates are closest.':
    'انقر على مبنى، أو اكتب رمز مبنى أو قاعة مثل F2 أو M1-112، لمعرفة موقعه وأقرب البوابات إليه.',
  'No building matches that code. Try F1, F2, M1, M2…': 'لا يوجد مبنى بهذا الرمز. جرّب F1 أو F2 أو M1 أو M2…',
  'Nothing selected yet. Pick a building on the map, a code below, or search for a room.': 'لم يتم تحديد شيء بعد. اختر مبنى من الخريطة أو رمزاً من الأسفل، أو ابحث عن قاعة.',
  'Classrooms:': 'القاعات الدراسية:', 'Closest gates on the plan:': 'أقرب البوابات على المخطط:',
  'Teaching building (classrooms)': 'مبنى تدريس (قاعات دراسية)', 'Teaching spaces + student activities': 'مساحات تدريس + أنشطة طلابية',
  'Specialist teaching (science / arts)': 'تدريس تخصصي (علوم / فنون)', 'Faculty offices': 'مكاتب أعضاء الهيئة التدريسية',
  'Central / shared': 'مركزي / مشترك', 'Residence, sports, services': 'سكن، رياضة، خدمات',
  'Teaching': 'تدريس', 'Teaching + activities': 'تدريس + أنشطة', 'Specialist': 'تخصصي', 'Faculty': 'أعضاء هيئة التدريس', 'Dining / IS': 'مطعم / دراسات بينية',
  'Other': 'أخرى', 'Science': 'علوم', 'Arts': 'فنون',
  'Female campus': 'حرم الطالبات', 'Male campus': 'حرم الطلاب', 'Central campus': 'الحرم المركزي', 'Central (dining / interdisciplinary)': 'المركزي (المطاعم / الدراسات البينية)',
  'Female Campus': 'حرم الطالبات', 'Male Campus': 'حرم الطلاب', 'Central Campus': 'الحرم المركزي', 'Central Courtyard': 'الساحة المركزية', 'GATES': 'البوابات',
  'Reception A': 'الاستقبال A', 'Reception B': 'الاستقبال B', 'Reception C': 'الاستقبال C', 'Reception': 'الاستقبال',
  'Promenade (main walkway)': 'الممشى (الممر الرئيسي)', 'Tip: click a colour above to show only that type': 'نصيحة: انقر على لون أعلاه لعرض هذا النوع فقط',
  'Teaching Building': 'مبنى التدريس', 'Student Activities / Teaching Spaces': 'الأنشطة الطلابية / مساحات التدريس', 'Science Building': 'مبنى العلوم',
  'Arts Building': 'مبنى الفنون', 'Early Childhood Centre': 'مركز الطفولة المبكرة', 'Faculty Building': 'مبنى أعضاء هيئة التدريس',
  'Sports and Recreation Centre': 'مركز الرياضة والترفيه', "Women's Residence": 'سكن الطالبات', "Men's Residence": 'سكن الطلاب',
  'Service Building 1': 'مبنى الخدمات 1', 'Service Building 2': 'مبنى الخدمات 2', 'Convention Centre': 'مركز المؤتمرات',
  'Administration Building': 'مبنى الإدارة', 'Library': 'المكتبة',
  'Female Dining Hall / Interdisciplinary Studies': 'مطعم الطالبات / الدراسات البينية', 'Male Dining Hall / Interdisciplinary Studies': 'مطعم الطلاب / الدراسات البينية',
  'Yes — general teaching building.': 'نعم — مبنى تدريس عام.', 'Yes — teaching spaces, shared with student activities.': 'نعم — مساحات تدريس مشتركة مع الأنشطة الطلابية.',
  'Yes — specialist labs or studios.': 'نعم — مختبرات أو استوديوهات تخصصية.', 'No — faculty offices (go here for office hours).': 'لا — مكاتب أعضاء هيئة التدريس (للساعات المكتبية).',
  'Not a main classroom block.': 'ليس مبنى قاعات رئيسياً.', 'No.': 'لا.',
  'On the Female Promenade, just south of F2. Main teaching block on the female side.': 'على ممشى الطالبات، جنوب F2 مباشرة. مبنى التدريس الرئيسي في جانب الطالبات.',
  'On the Female Promenade between F3 and FF2.': 'على ممشى الطالبات بين F3 وFF2.',
  'South of F1, next to the Early Childhood Centre (F9). Reception B is nearby.': 'جنوب F1، بجوار مركز الطفولة المبكرة (F9). الاستقبال B قريب منه.',
  'West end of the Female Promenade, beside the Sports and Recreation Centre.': 'الطرف الغربي لممشى الطالبات، بجوار مركز الرياضة والترفيه.',
  'West end of the Female Promenade, just below F3.': 'الطرف الغربي لممشى الطالبات، أسفل F3 مباشرة.',
  'Science labs, north of F2 and next to the faculty building FF1.': 'مختبرات العلوم، شمال F2 وبجوار مبنى أعضاء هيئة التدريس FF1.',
  'Arts studios at the north end of the female campus, near Reception A.': 'استوديوهات الفنون في الطرف الشمالي من حرم الطالبات، قرب الاستقبال A.',
  'On the Male Promenade, south side, near MF3.': 'على ممشى الطلاب، الجهة الجنوبية، قرب MF3.',
  'On the Male Promenade, north side, east of MF1/MF2.': 'على ممشى الطلاب، الجهة الشمالية، شرق MF1/MF2.',
  'East end of the Male Promenade, north side.': 'الطرف الشرقي لممشى الطلاب، الجهة الشمالية.',
  'East end of the Male Promenade, south side.': 'الطرف الشرقي لممشى الطلاب، الجهة الجنوبية.',
  'Links the female wing to the Library. The plan lists Interdisciplinary Studies here alongside the dining hall.':
    'يربط جناح الطالبات بالمكتبة. يذكر المخطط الدراسات البينية هنا إلى جانب المطعم.',
  'Links the male wing to the Library. The plan lists Interdisciplinary Studies here alongside the dining hall.':
    'يربط جناح الطلاب بالمكتبة. يذكر المخطط الدراسات البينية هنا إلى جانب المطعم.',
  'This map shows the Abu Dhabi campus.': 'تعرض هذه الخريطة حرم أبوظبي.',
  'Show on map': 'عرض على الخريطة', 'Your class': 'محاضرتك', 'Your classes this term': 'محاضراتك هذا الفصل',
  'Not on this map': 'ليست على هذه الخريطة', 'approx.': 'تقريبي', '(approx.)': '(تقريبي)',
  "Where are today's classes?": 'أين محاضرات اليوم؟', 'Your class buildings this term': 'مباني محاضراتك هذا الفصل', 'Now': 'الآن', 'Next': 'التالية',
  "Approximate location: room codes in the data don't match the campus plan, so most buildings are a best guess.":
    'موقع تقريبي: رموز القاعات في البيانات لا تطابق مخطط الحرم، لذا معظم المباني تقديرية.',
  "The room's building code matches this building on the campus plan.": 'رمز مبنى القاعة يطابق هذا المبنى على مخطط الحرم.',
  "Approximate location: room codes in the data don't match the campus plan, so this building is a best guess. Check signage on the day.":
    'موقع تقريبي: رموز القاعات في البيانات لا تطابق مخطط الحرم، لذا هذا المبنى أفضل تقدير. راجع اللافتات في يومها.',
  "Room codes in the data don't match the campus plan, so most class buildings are a best guess (marked approx.).":
    'رموز القاعات في البيانات لا تطابق مخطط الحرم، لذا معظم مباني المحاضرات تقديرية (مُعلَّمة بـ «تقريبي»).',
  'Schematic map of the Zayed University Abu Dhabi campus': 'مخطط توضيحي لحرم جامعة زايد في أبوظبي',
  'Redrawn as a schematic from the official “ZU Campus Plan, Abu Dhabi” drawing (May 2023). Building positions are approximate and not to scale. “Closest gates” are measured in a straight line on the plan, so check signage and your access rules on the day. Room codes are matched by their building prefix only; floor and room layouts aren’t in the source plan.':
    'أُعيد رسمها كمخطط توضيحي من المخطط الرسمي «مخطط حرم جامعة زايد، أبوظبي» (مايو 2023). مواقع المباني تقريبية وليست بمقياس رسم. «أقرب البوابات» تُقاس بخط مستقيم على المخطط، لذا راجع اللافتات وقواعد الدخول في يومها. تُطابق رموز القاعات حسب بادئة المبنى فقط؛ ولا تتضمن الخطة الأصلية تفاصيل الطوابق والقاعات.',
};
const AR_DAYS = { Monday: 'الاثنين', Tuesday: 'الثلاثاء', Wednesday: 'الأربعاء', Thursday: 'الخميس', Friday: 'الجمعة', Saturday: 'السبت', Sunday: 'الأحد',
  Mon: 'الاثنين', Tue: 'الثلاثاء', Wed: 'الأربعاء', Thu: 'الخميس', Fri: 'الجمعة', Sat: 'السبت', Sun: 'الأحد' };
const AR_HOLD = { Financial: 'مالي', Advising: 'إرشاد أكاديمي', Library: 'مكتبة', Registrar: 'التسجيل' };
const pl = (n, one, many) => +n === 1 ? one : many;
// Pattern rules for sentences that contain numbers or names. Applied in this order.
const AR_RE = [
  [/(\d{4}) Fall Semester/g, 'فصل الخريف $1'], [/(\d{4}) Spring Semester/g, 'فصل الربيع $1'], [/(\d{4}) Summer Semester/g, 'الفصل الصيفي $1'],
  [/\b(\d{4}) Fall\b/g, 'خريف $1'], [/\b(\d{4}) Spring\b/g, 'ربيع $1'], [/\b(\d{4}) Summer\b/g, 'صيف $1'],
  [/\b(Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday|Mon|Tue|Wed|Thu|Fri|Sat|Sun)\b/g, (m, d) => AR_DAYS[d]],
  [/ & (?=[\u0600-\u06FF])/g, ' و'],
  [/^(\w+) campus$/, 'حرم $1'],
  [/^(\d+) (AM|PM)$/, (m, h, ap) => `${h} ${ap === 'AM' ? 'ص' : 'م'}`],
  [/^Today · /, 'اليوم · '], [/ · Today$/, ' · اليوم'],
  [/^Grades, degree progress, classes, attendance and holds — always up to date for (.+)\.$/, 'الدرجات والتقدم الدراسي والمحاضرات والحضور والقيود — محدّثة دائماً لـ$1.'],
  [/^(\d+) CSV files$/, '$1 ملف CSV'],
  [/^at start-up\s+\((\d+) student accounts\)\. You only ever see your own record\.$/, 'عند بدء التشغيل ($1 حساب طالب). لا ترى إلا سجلك الخاص.'],
  [/^No student account found with ID (\d+)\. Check the number and try again\.$/, 'لا يوجد حساب طالب بالرقم $1. تحقق من الرقم وحاول مرة أخرى.'],
  [/· Week (\d+)$/, '· الأسبوع $1'],
  [/^Semester (\d+)$/, 'الفصل الدراسي $1'], [/^Summer \(after semester (\d+)\)$/, 'صيفي (بعد الفصل الدراسي $1)'],
  [/^ID (\d+)$/, 'الرقم الجامعي $1'],
  [/Academic Probation (\d+)/, 'إنذار أكاديمي $1'],
  [/^Status: (.+)$/, (m, v) => 'الحالة: ' + (AR[v] || v)], [/^Standing: (.+)$/, (m, v) => 'الوضع الأكاديمي: ' + (AR[v] || v)],
  [/^Academic standing: (.+)$/, (m, v) => 'الوضع الأكاديمي: ' + (AR[v] || v)],
  [/^(\d+)% of degree · (\d+) in progress$/, '$1% من الخطة · $2 قيد الدراسة'],
  [/^(\d+) credit hours · (.+)$/, '$1 ساعة معتمدة · $2'], [/^(\d+) classes · (\d+) credit hours$/, '$1 مقررات · $2 ساعة معتمدة'],
  [/^in (\d+) days$/, 'بعد $1 يوم'], [/^(\d+) days ago$/, 'منذ $1 يوم'],
  [/^Opens in (\d+) days$/, 'يفتح بعد $1 يوم'],
  [/^Ready to register in (\d+) days$/, 'جاهز للتسجيل بعد $1 يوم'], [/^Ready to register (tomorrow|today)$/, (m, d) => 'جاهز للتسجيل ' + AR[d]],
  [/^(\d+) holds? will block your (.+) registration$/, (m, n, t) => `${n} ${pl(n, 'قيد سيمنع', 'قيود ستمنع')} تسجيلك في ${t}`],
  [/^(.*\d{4}) registration$/, 'تسجيل $1'],
  [/^Your time ticket · closes (.+)$/, 'موعد تسجيلك · يُغلق $1'],
  [/^(\d+) credits still to plan in your degree ·$/, 'متبقٍ $1 ساعة في خطتك ·'],
  [/^Office (\S+) · ext\. (\d+)$/, 'المكتب $1 · تحويلة $2'], [/^· Office (\S+)$/, '· المكتب $1'],
  [/^(Financial|Advising|Library|Registrar) — (.+)$/, (m, t, r) => `${AR_HOLD[t]} — ${r}`],
  [/^(Financial|Advising|Library|Registrar) hold$/, (m, t) => `قيد ${AR_HOLD[t]}`],
  [/^(.+): absences over the 15% limit$/, '$1: الغياب تجاوز حد 15%'],
  [/^(\d+) absences? of (\d+) meetings \(([\d.]+)%\)\. This can result in a WF grade\.( Attendance appeal:)?$/,
    (m, a, n, p, ap) => `${a} غياب من ${n} محاضرة (${p}%). قد يؤدي ذلك إلى تقدير WF.${ap ? ' حالة التظلم:' : ''}`],
  [/^(.+): second attendance warning \(([\d.]+)%\)$/, '$1: إنذار حضور ثانٍ ($2%)'], [/^(.+): attendance warning \(([\d.]+)%\)$/, '$1: إنذار حضور ($2%)'],
  [/^(\d+) absences? of (\d+) meetings in (.+)\. More than 15% leads to a WF grade\.$/, '$1 غياب من $2 محاضرة في $3. تجاوز 15% يؤدي إلى تقدير WF.'],
  [/^Your cumulative GPA is below 2\.00\. Meet (.+) to plan your recovery\.$/, 'معدلك التراكمي أقل من 2.00. قابل $1 لوضع خطة للتحسن.'],
  [/^Unofficial transcript · (.+)$/, 'كشف درجات غير رسمي · $1'],
  [/^Recalculated: ([\d.]+) \(([\d.]+) pts \/ (\d+) cr\)$/, 'محسوب: $1 ($2 نقطة / $3 ساعة)'],
  [/^incl\. (\d+) transfer credits$/, 'منها $1 ساعة معادلة'], [/^Entry: (.+)$/, 'القبول: $1'], [/^(.+) · in progress$/, '$1 · قيد الدراسة'],
  [/^(\d+)% of the grade assessed · (\d+)% remaining \(final assessment\)$/, 'تم تقييم $1% من الدرجة · متبقٍ $2% (التقييم النهائي)'],
  [/^([ABC]): need (\d+)%$/, '$1: تحتاج $2%'], [/^([ABC]) secured$/, '$1 مضمون'], [/^([ABC]) out of reach$/, '$1 غير ممكن'],
  [/^(.+) · weight (\d+)%$/, '$1 · الوزن $2%'],
  [/^(\d+) courses?$/, '$1 مقررات'], [/^(\d+) requirements · (\d+) met$/, '$1 متطلب · $2 مستوفى'], [/^· (\d+)\/(\d+) complete$/, '· $1/$2 مكتمل'],
  [/^\/ (\d+) cr$/, '/ $1 ساعة'], [/^(\d+) cr in progress$/, '$1 ساعة قيد الدراسة'], [/^(\d+) cr remaining$/, '$1 ساعة متبقية'],
  [/^· (\d+) cr · CRN (\d+)$/, '· $1 ساعة · CRN $2'], [/^· (\d+) cr$/, '· $1 ساعة'], [/^· Section (\S+) · CRN (\d+)$/, '· الشعبة $1 · CRN $2'],
  [/^(\d+) credits?$/, '$1 ساعة معتمدة'], [/^or ([A-Z]{2,4}\d+)$/, 'أو $1'],
  [/^Program code (\S+) · (\d+) credits · (.+)$/, 'رمز البرنامج $1 · $2 ساعة · $3'],
  [/^Elective slots are filled automatically:.*Confirm elective choices with your advisor(?:, (.+))?\.$/,
    (m, a) => `تُملأ خانات المقررات الاختيارية تلقائياً: اختياري تاريخ الفن بمقررات AAH، واختياري البرنامج بمقررات من مجالات البرنامج، واختياري الجامعة بأي مقرر متبقٍ. راجع اختياراتك مع مرشدك${a ? '، ' + a : ''}.`],
  [/(\d+) completed credit hours/g, '$1 ساعة معتمدة مكتملة'], [/Completed (\d+) credit hours/g, 'إكمال $1 ساعة معتمدة'],
  [/^Prerequisite: /, 'المتطلب السابق: '], [/^or (.+) or$/, 'أو $1 أو'], [/ or \($/, ' أو ('], [/^\) and$/, ') و'],
  [/^(.+) · earlier attempt (\S+) \((.+)\)$/, '$1 · محاولة سابقة $2 ($3)'], [/^Transfer · (.+)$/, 'معادلة · $1'],
  [/^No completed terms yet — your first grades will appear here after (.+)\.$/, 'لا توجد فصول مكتملة بعد — ستظهر أول درجاتك هنا بعد $1.'],
  [/^You are not registered for any classes in (.+)\.$/, 'لست مسجلاً في أي مقرر في $1.'],
  [/^You have two exams on (.+)\. Plan your revision early\.$/, 'لديك امتحانان يوم $1. خطط لمراجعتك مبكراً.'],
  [/^(\d+) of (\d+)$/, '$1 من $2'],
  [/^across (\d+) classes · as of (.+)$/, 'في $1 مقررات · حتى $2'], [/^across (\d+) classes$/, 'في $1 مقررات'],
  [/^(\d+) above 15% · (\d+) at 10%\+ · (\d+) at 5%\+$/, '$1 فوق 15% · $2 عند 10%+ · $3 عند 5%+'],
  [/^(\d+) (more )?absences? allowed before going over 15%\.$/, (m, n, more) => `يُسمح بـ${n} ${more ? 'غياب إضافي' : 'غياب'} قبل تجاوز 15%.`],
  [/^(\d+) absences? ÷ (\d+) meetings allotted · (\d+) meetings held so far$/, '$1 غياب ÷ $2 محاضرة مقررة · $3 محاضرة حتى الآن'],
  [/^(\d+) absences?$/, '$1 غياب'], [/^(\d+)h (\d+)m$/, '$1س $2د'],
  [/^Attendance appeal: (.+)$/, (m, v) => 'التظلم: ' + (AR[v] || v)], [/^Attendance appeal:$/, 'التظلم:'],
  [/^Active holds \((\d+)\)$/, 'القيود النشطة ($1)'], [/^(\d+) blocking registration$/, '$1 يمنع التسجيل'], [/^(\d+) blocking$/, '$1 قيد مانع'],
  [/^Action needed before (.+)$/, 'مطلوب إجراء قبل $1'],
  [/^Placed (.+?) \((\d+) days ago\)$/, 'وُضع في $1 (منذ $2 يوم)'], [/^Placed (.+?) · released (.+)$/, 'وُضع في $1 · رُفع في $2'],
  [/^Pick an expected grade for each (.+) course to see your GPA after this term\.$/, 'اختر التقدير المتوقع لكل مقرر في $1 لمعرفة معدلك بعد هذا الفصل.'],
  [/^([▲▼]) ([\d.]+) vs\. now$/, '$1 $2 مقارنة بالحالي'], [/^(\d+) of (\d+) courses · (\d+) credits$/, '$1 من $2 مقررات · $3 ساعة'],
  [/^Expected grade for (\S+)$/, 'التقدير المتوقع لـ $1'],
  // campus map
  [/^GATE (\d+)$/, 'بوابة $1'], [/^No campus map for (\S+)$/, 'لا توجد خريطة لحرم $1'], [/^Gate (\d+), Gate (\d+)$/, 'بوابة $1، بوابة $2'],
  [/^Your classes are on the (\S+) campus, so check the rooms on your class schedule\.$/, 'محاضراتك في حرم $1، لذا راجع القاعات في جدولك الدراسي.'],
];
function trText(t) {
  if (Object.prototype.hasOwnProperty.call(AR, t)) return AR[t];
  let out = t;
  for (const [re, rep] of AR_RE) out = out.replace(re, rep);
  return out;
}
function applyLang(root) {
  if (!isAr() || !root || !document.createTreeWalker) return;
  const walk = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  const nodes = []; while (walk.nextNode()) nodes.push(walk.currentNode);
  nodes.forEach(n => {
    const v = n.nodeValue, t = v.trim();
    if (!t || !/[A-Za-z]/.test(t)) return;
    const tr = trText(t);
    if (tr !== t) n.nodeValue = v.replace(t, tr);
  });
  root.querySelectorAll('[placeholder],[title],[aria-label]').forEach(el => ['placeholder', 'title', 'aria-label'].forEach(at => {
    const v = el.getAttribute(at); if (!v) return;
    const tr = trText(v); if (tr !== v) el.setAttribute(at, tr);
  }));
}

/* ------------------------------------------------------------------ */
/* Boot                                                                */
/* ------------------------------------------------------------------ */
window.addEventListener('beforeprint', () => $$('details.term').forEach(d => { d.open = true; }));

// Boot: start every download at once, but show the sign-in form as soon as the two files it
// needs (students, terms) have arrived. The rest keeps loading while the student types.
let READY = null;
(() => {
  const jobs = Object.fromEntries(FILES.map(f => [f, fetchCsv(f)]));
  Object.values(jobs).forEach(p => p.catch(() => {}));   // errors are handled below
  READY = Promise.all(FILES.map(f => jobs[f])).then(() => { buildIndexes(LOADED); DB.ready = true; });
  READY.catch(e => { console.warn('CSV load failed:', e); if (!STATE.sid || !DB.ready) showPicker(e); });
  Promise.all([jobs.students, jobs.terms]).then(() => {
    DB.students = LOADED.students; DB.terms = LOADED.terms;
    DB.studentById = Object.fromEntries(DB.students.map(r => [r.student_id, r]));
    DB.termByCode = Object.fromEntries(DB.terms.map(r => [r.term_code, r]));
    DB.currentTerm = DB.termByCode[CONFIG.currentTerm];
    window.addEventListener('hashchange', () => DB.ready && route());
    const saved = sessGet();
    if (saved && DB.studentById[saved]) { STATE.sid = saved; READY.then(route); }
    else renderLogin();
  }).catch(() => {});
})();
