# Student Access Portal — Zayed University (Vibe Code Jam 2026 demo)

A modern student portal built with plain HTML, CSS and JavaScript (no build step, no libraries).
All data is **loaded from the CSV files in `data/` when the app starts** — nothing is copied into the code.

## Run it
**Windows:** right-click the ZIP → **Extract All**, open the extracted `zu-portal` folder and double-click
**`start.bat`**. A small server window opens and the portal opens in your browser at http://localhost:8000
(keep that window open while you use it). Do not open `index.html` from inside the ZIP.

**Mac / Linux / anywhere with Python:**
```
cd zu-portal
python3 -m http.server 8000
```
Open http://localhost:8000 and sign in with a `student_id` and `password` from `data/students.csv`
(e.g. `202312001` / `Zu@2001`).

If you open `index.html` directly as a file, the browser blocks reading `data/`; the app then
asks you to select the CSV folder (or the files) instead.

## Pages
1. **Home** – GPA, credits, term load, holds, alerts (attendance, probation, blocking holds),
   today's classes, upcoming finals, Spring 2027 time ticket, advisor, news, last campus entry.
2. **Academic transcript** – in-progress courses with live weighted scores and "score needed on the
   final" for A/B/C; completed terms with term and cumulative GPA; transfer credit; print/PDF.
3. **Degree audit** – every requirement matched against grades, transfer credit and current
   enrolments (incl. alternative courses and elective slots), prerequisites for remaining courses.
4. **Class schedule** – list view, weekly calendar (today highlighted, live "now" line),
   final-exam table with conflict/busy-day checks, export to calendar (.ics).
5. **Class attendance** – absences against the 15% limit per class, appeal status, campus gate log.
6. **Holds** – active and released holds, what blocks registration, steps to resolve, readiness timeline.
7. **GPA calculator** (extra) – pick an expected grade for each current course and see the projected term and
   cumulative GPA, using exactly the transcript rules (a passing retake replaces an earlier F).
8. **Campus map** (extra) – "Where are the classrooms?": a schematic of the Abu Dhabi campus. Click a building
   or type a building/room code (e.g. `F2` or `M1-112`) to see what it is, whether it has classrooms and the
   two closest gates. Colour legend doubles as a filter. Students on another campus (from `students.csv`) see a
   note that the map covers Abu Dhabi only. The drawing lives in `campus-map.js`; it is a redrawn campus plan
   (like an image), not data from the CSV files.
   **Class rooms on the map:** every class on the schedule (list and weekly calendar) and in Home's
   "today's classes" has a **Show on map** link, and the map page lists "Your classes this term". Rooms in
   `sections.csv` (e.g. `AUH-G3-034`) use building codes A1–G3, which are not the codes on the campus plan,
   so each building letter is assigned to a teaching building on the student's side of campus
   (`CM_ROOM_ASSUMED` in `campus-map.js`) and the page labels it **approximate**. Only a female student's
   room in F1/F2 matches the plan exactly. Dubai (DXB) rooms show "No campus map for DXB".
   **Home page mini-map** ("Where are today's classes?"): a map of the student's side of campus with a
   numbered pin on the building of each of today's classes; finished classes fade, the next class pulses,
   and each pin opens the full map. On a day without classes it shows all of this term's class buildings.
   Abu Dhabi students only.

Top bar on every page (and on the sign-in page): **العربية / English** switch with a full right-to-left
Arabic layout, and a **Dark mode / Light mode** switch. Both choices are remembered in the browser.

## 2-minute demo script
1. Wrong ID `999999999` → "No student account found"; right ID, wrong password → "Incorrect password".
2. **202412006 Sara** – Home: name, program, Status Active, Academic Probation, advisor, GPA 1.89, today's classes, time ticket.
   Transcript: FYE155 F replaced by a later C. Degree audit: ART205 retake needed, AAH322 in progress.
3. **202412004 Reem** – Transcript: transfer credits (TR, not in GPA). Degree audit: TR courses fill requirements.
4. Schedule: list → weekly calendar → final exams → "Add to calendar".
5. **202512003 Dana** – Attendance: COM200 20% (above 15%, appeal pending), COM230 13.3% (second warning).
6. **202412002 Omar** – Holds: Financial hold, "Blocks registration".
7. **202612007 Ahmed** – new student: no GPA yet, live course scores only.

Extras: GPA calculator, campus map, Arabic and English, dark mode, final exam schedule, live course scores + "score needed on the final", campus gate log, news,
advisor card, print/PDF transcript, calendar export (.ics), phone layout.

## Where the numbers come from
- **GPA** = sum(quality points × credits) ÷ sum(credits) over grades that count in GPA (grade_scale.csv).
  Transfer credits are excluded; if a failed course is passed later, the passing grade replaces the F (both stay on the transcript).
- **Degree audit**: each row of degree_requirements.csv is matched to a passed grade, a transfer credit or a
  current enrolment (alternative codes allowed). Progress = completed requirement credits ÷ 120.
- **Attendance %** = absences ÷ meetings_allotted (attendance.csv).
- **Holds**: active when released_date is empty; blocks_registration = Yes blocks registration.

## Rules used
- Today is fixed to Wednesday 18 Nov 2026 and the current term to 202610 (`CONFIG` in `app.js`).
- Repeated courses: a later passing attempt replaces the earlier attempt in the GPA (this reproduces every `cumulative_gpa` in students.csv).
- GPAs are rounded to 2 decimals the same way students.csv does it (an exact tie like 3.125 shows as 3.12).
- Attendance: absence % = absences ÷ `meetings_allotted`; warning at 5%, second warning at 10%, above 15% → WF.
- Elective slots are filled automatically (AAH → Art History, program subjects → Program Elective, anything else → ZU Elective).

## Note
This is a client-side demo: the browser downloads all CSVs (including passwords) and filters to the
signed-in student. A real deployment must do authentication and filtering on a server.
