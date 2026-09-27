/* =============================================================
   SRI GAMINI CENTRAL COLLEGE — student portal

   Everything in this file renders ONE student's own records.
   The guard at the top of init() means no view can run without a
   valid student session, and every query below is scoped to
   `me.id`, so a student can never list the class register.

   Swapping to a backend: replace these queries with API calls that
   are already filtered server-side by the authenticated uid.
   ============================================================= */
(function (global) {
  'use strict';
  const SGC = global.SGC = global.SGC || {};
  const U = SGC.utils, D = SGC.dash;
  const { esc, qs, formatDate, todayISO, toast, emptyState } = U;

  const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
  const dayIndex = () => (new Date().getDay() + 6) % 7;   /* 0 = Monday */

  let me = null;    /* the student record from schoolStudents */
  let sess = null;  /* the auth session */

  /* ---------------- queries, all scoped to this student ---------------- */
  const attendance = () => SGC.db.all('schoolAttendance')
    .filter((a) => a.studentId === me.id).sort((a, b) => String(b.date).localeCompare(String(a.date)));
  const results = () => SGC.db.all('schoolResults')
    .filter((r) => r.studentId === me.id).sort((a, b) => String(b.date).localeCompare(String(a.date)));
  const timetable = () => SGC.db.all('schoolTimetable')
    .filter((t) => t.classId === me.classId).sort((a, b) => a.period - b.period);
  const assignments = () => SGC.db.all('schoolAssignments')
    .filter((a) => a.classId === me.classId).sort((a, b) => String(a.dueDate).localeCompare(String(b.dueDate)));
  const noticesForMe = () => SGC.notices.live().filter((n) =>
    !Array.isArray(n.audience) || !n.audience.length || n.audience.includes('student') || n.audience.includes('all'));
  const messagesForMe = () => SGC.db.all('schoolMessages')
    .filter((m) => m.to === me.id || m.from === me.id || m.to === 'all')
    .sort((a, b) => String(b.date).localeCompare(String(a.date)));
  const unread = () => messagesForMe().filter((m) => m.to === me.id && !m.read);
  const doneIds = () => SGC.db.all('schoolSubmissions').filter((s) => s.studentId === me.id).map((s) => s.assignmentId);

  function attSummary() {
    const rows = attendance();
    const c = { Present: 0, Absent: 0, Late: 0 };
    rows.forEach((r) => { c[r.status] = (c[r.status] || 0) + 1; });
    const rate = rows.length ? Math.round(((c.Present + c.Late) / rows.length) * 100) : 0;
    return { rows, c, rate, days: rows.length };
  }

  function markAverage() {
    const rows = results();
    if (!rows.length) return 0;
    return Math.round(rows.reduce((s, r) => s + (r.marks / (r.total || 100)) * 100, 0) / rows.length);
  }

  /* Subjects the student actually takes: timetable first, then anything
     a teacher has already marked, then the core list as a last resort. */
  function subjectsTaken() {
    const ids = [];
    timetable().forEach((t) => { if (!ids.includes(t.subjectId)) ids.push(t.subjectId); });
    results().forEach((r) => { if (!ids.includes(r.subjectId)) ids.push(r.subjectId); });
    if (!ids.length) SGC.db.all('schoolSubjects').filter((s) => s.core).forEach((s) => ids.push(s.id));
    return ids.map((id) => SGC.db.findData('schoolSubjects', id)).filter(Boolean);
  }

  function teacherFor(subjectId) {
    const slot = timetable().find((t) => t.subjectId === subjectId);
    if (slot) return SGC.db.teacherName(slot.teacherId);
    const t = SGC.db.all('schoolTeachers').find((x) => (x.subjectIds || []).includes(subjectId));
    return t ? t.fullName : 'To be allocated';
  }

  function dueState(a) {
    if (doneIds().includes(a.id)) return 'done';
    const due = new Date(a.dueDate + 'T23:59:59');
    if (isNaN(due)) return 'open';
    if (due < new Date()) return 'overdue';
    return Math.ceil((due - new Date()) / 86400000) <= 2 ? 'soon' : 'open';
  }

  const dueBadge = (s) => ({
    done: '<span class="badge badge--live">Handed in</span>',
    overdue: '<span class="badge badge--urgent">Overdue</span>',
    soon: '<span class="badge badge--gold">Due within 2 days</span>',
    open: '<span class="badge badge--general">Set</span>',
  }[s]);

  const prefs = () => SGC.db.loadData('schoolUserPrefs', {}) || {};
  function setPref(k, v) {
    const allP = SGC.db.loadData('schoolUserPrefs', {}) || {};
    allP[me.id] = Object.assign({}, allP[me.id], { [k]: v });
    SGC.db.saveData('schoolUserPrefs', allP);
  }

  /* ---------------- shared shells ---------------- */
  function mustStudent() {
    if (!me) {
      sess = SGC.auth.requireAuth(['student']);
      if (!sess) return false;
      me = SGC.db.findData('schoolStudents', sess.linkedId);
    }
    if (!me) {
      const m = qs('#dashMain');
      if (m) m.innerHTML = emptyState({ icon: '⚠', title: 'Your student record is missing',
        text: 'The office has not created a student file for this account yet. Please sign in from the login page or contact the college office.' });
      return false;
    }
    return true;
  }

  const wrap = (html) => '<div class="split" style="margin-bottom:var(--sp-3)">' + html + '</div>';
  const spacer = () => '<div style="height:var(--sp-3)"></div>';

  /* ======================= VIEWS ======================= */

  function stHome() {
    if (!mustStudent()) return;
    const a = attSummary();
    const pend = assignments().filter((x) => dueState(x) === 'overdue' || dueState(x) === 'soon').length;
    const cls = SGC.db.className(me.classId);
    const sub = qs('#stHomeSub');
    if (sub) sub.textContent = 'Welcome back, ' + D.firstNameOf(me.fullName) + ' · ' + cls +
      ' · admission ' + (me.admissionNo || '—');

    const w = qs('#stWidgets');
    if (w) w.innerHTML = D.widgets([
      { icon: '📅', value: a.rate + '%', label: 'Attendance this term', variant: a.rate >= 90 ? 'ok' : 'err', trend: a.c.Absent + ' absent', trendDown: a.c.Absent > 0 },
      { icon: '📊', value: results().length ? markAverage() + '%' : '—', label: 'Term mark average', variant: 'gold' },
      { icon: '📝', value: String(pend), label: 'Assignments due soon' },
      { icon: '✉', value: String(unread().length), label: 'Unread messages', variant: unread().length ? 'ok' : '' },
    ]);

    /* today's periods */
    const today = qs('#stToday');
    if (today) {
      const di = dayIndex();
      const slots = timetable().filter((t) => t.day === DAYS[di]);
      if (di > 4) {
        today.innerHTML = '<p class="muted">There are no lessons on ' + DAYS[di] + '. The timetable below covers Monday to Friday.</p>';
      } else if (!slots.length) {
        today.innerHTML = '<p class="muted">Your class timetable has not been published yet. Check back after the office releases it.</p>';
      } else {
        const nowHm = new Date().toTimeString().slice(0, 5);
        today.innerHTML = '<ul class="mini">' + slots.map((t) => '<li><span class="mini__i" aria-hidden="true">' + t.period + '</span>' +
          '<div><b>' + esc(SGC.i18n.loc(SGC.db.findData('schoolSubjects', t.subjectId) || {}, 'name')) + '</b>' +
          '<span>' + esc(t.start) + ' – ' + esc(t.end) + ' · ' + esc(t.room || 'room to be advised') + ' · ' + esc(SGC.db.teacherName(t.teacherId)) + '</span></div>' +
          (t.start <= nowHm && nowHm <= t.end ? '<span class="mini__end"><span class="badge badge--gold">Now</span></span>' : '') +
          '</li>').join('') + '</ul>';
      }
    }

    D.noticeList(qs('#stHomeNotices'), noticesForMe().slice(0, 4));

    const att = qs('#stHomeAtt');
    if (att) {
      att.innerHTML = '<div style="display:flex;align-items:center;gap:.75rem;margin-bottom:.9rem">' +
        '<span class="pct">' + a.rate + '%</span>' + D.bar(a.rate, a.rate >= 90 ? 'ok' : 'err') + '</div>' +
        D.miniHTML([
          { icon: '✔', title: a.c.Present + ' days present', meta: 'Counted in the attendance rate' },
          { icon: '⏰', title: a.c.Late + ' times late', meta: 'Marked by the duty teacher' },
          { icon: '✖', title: a.c.Absent + ' days absent', meta: 'A guardian note is on file where supplied' },
        ]) +
        (a.rows.length ? spacer() + D.attGridHTML(a.rows.slice(0, 5)) : '');
    }

    const subs = qs('#stHomeSubjects');
    if (subs) {
      const list = subjectsTaken();
      subs.innerHTML = '<ul class="mini">' + list.map((s) => {
        const marks = results().filter((r) => r.subjectId === s.id);
        const avg = marks.length ? Math.round(marks.reduce((x, r) => x + r.marks, 0) / marks.length) : null;
        return '<li><span class="mini__i" aria-hidden="true">' + esc(s.code) + '</span>' +
          '<div><b>' + esc(SGC.i18n.loc(s, 'name')) + '</b><span>' + esc(teacherFor(s.id)) + '</span></div>' +
          '<span class="mini__end">' + (avg === null ? '<span class="muted">no marks yet</span>' : D.gradeChip(marks[0].grade)) + '</span></li>';
      }).join('') + '</ul>';
    }
  }

  function stProfile() {
    if (!mustStudent()) return;
    const mount = qs('#stProfileBody');
    if (!mount) return;
    const st = SGC.db.getSettings();
    const cls = SGC.db.findData('schoolClasses', me.classId) || {};
    const row = (k, v) => '<dt>' + esc(k) + '</dt><dd>' + esc(v || '—') + '</dd>';

    mount.innerHTML =
      '<div class="profile-card">' +
        '<div class="profile-card__cover"><img src="' + esc(U.rootURL('assets/school-front.jpg')) + '" alt="' + esc(st.schoolName) + '"></div>' +
        '<div class="profile-card__in">' +
          '<div class="profile-card__av">' + U.avatarHTML({ fullName: me.fullName, photo: me.photo, folder: 'students' }, 112) + '</div>' +
          '<div class="profile-card__id"><h1>' + esc(me.fullName) + '</h1>' +
            '<p>' + esc(me.nameWithInitials || me.fullName) + ' · ' + esc(SGC.db.className(me.classId)) + '</p>' +
            '<p style="margin-top:.35rem"><span class="badge badge--gold">' + esc(st.shortName || 'SGCC') + '</span> ' +
            '<span class="badge">' + esc(me.status || 'Active') + '</span></p></div>' +
          '<div class="profile-card__acts"><a class="btn btn--ghost btn--sm" href="profile.html">Edit my details</a>' +
            '<a class="btn btn--primary btn--sm" href="index.html">College website</a></div>' +
        '</div>' +
        '<div class="profile-body">' +
          '<h3 class="section-h">Enrolment</h3>' +
          '<dl class="info-grid">' +
            row('Student ID', me.studentId) + row('Admission number', me.admissionNo) +
            row('Grade', me.grade) + row('Class', cls.name) + row('Stream', cls.stream) +
            row('Room', cls.room) + row('Date of birth', me.dob ? formatDate(me.dob) : '') +
            row('Gender', me.gender) +
          '</dl>' +
          '<h3 class="section-h">Guardian and contact</h3>' +
          '<dl class="info-grid">' +
            row('Guardian', me.guardianName) + row('Relationship', me.relationship) +
            row('Telephone', me.phone) + row('Email', me.email) + row('Address', me.address) +
          '</dl>' +
          '<p class="form-hint" style="margin-top:var(--sp-3)">Details shown here are held by the college office. ' +
            'If anything is wrong, use Settings to notify the office rather than editing this page — a front-end edit ' +
            'would not be seen by anyone else.</p>' +
        '</div>' +
      '</div>';
  }

  function stClasses() {
    if (!mustStudent()) return;
    const mount = qs('#stClassesBody');
    if (!mount) return;
    const cls = SGC.db.findData('schoolClasses', me.classId) || {};
    const list = subjectsTaken();
    const slots = timetable();

    mount.innerHTML =
      wrap(
        D.panel({ title: 'My class', body:
          '<dl class="info-grid">' +
            '<dt>Class</dt><dd>' + esc(cls.name || '—') + '</dd>' +
            '<dt>Grade</dt><dd>' + esc(cls.grade || '—') + '</dd>' +
            '<dt>Stream</dt><dd>' + esc(cls.stream || '—') + '</dd>' +
            '<dt>Room</dt><dd>' + esc(cls.room || '—') + '</dd>' +
            '<dt>Registered in class</dt><dd>' + esc(String(SGC.db.all('schoolStudents').filter((s) => s.classId === me.classId).length)) + ' students</dd>' +
          '</dl>' }) +
        D.panel({ title: 'Subjects offered', body:
          '<p class="muted" style="margin-top:0">A national school follows the national curriculum. Your class takes the following subjects this term.</p>' +
          '<ul class="tick-list">' + list.map((s) => '<li><b>' + esc(SGC.i18n.loc(s, 'name')) + '</b> — ' +
            esc(s.department) + (s.core ? ' · core' : ' · optional') + '</li>').join('') + '</ul>' })
      ) +
      (slots.length
        ? D.panel({ title: 'Period allocation', flush: true, body:
            D.tableHTML({
              caption: 'Periods taught to ' + (cls.name || 'my class'),
              cols: [
                { key: 'period', label: 'Period', sortable: true, cell: (r) => esc(String(r.period)) },
                { key: 'day', label: 'Day', sortable: true },
                { key: 'subjectId', label: 'Subject', cell: (r) => esc(SGC.i18n.loc(SGC.db.findData('schoolSubjects', r.subjectId) || {}, 'name')) },
                { key: 'teacherId', label: 'Teacher', cell: (r) => esc(SGC.db.teacherName(r.teacherId)) },
                { key: 'start', label: 'Time', cell: (r) => esc(r.start + ' – ' + r.end) },
              ],
              rows: slots, sort: { key: 'period', dir: 'asc' },
            }) })
        : '<p class="muted">No period allocation has been published for ' + esc(cls.name || 'your class') + ' yet.</p>');
  }

  function stResults() {
    if (!mustStudent()) return;
    const mount = qs('#stResultsBody');
    if (!mount) return;
    const rows = results();
    if (!rows.length) {
      mount.innerHTML = emptyState({ icon: '📊', title: 'No results published yet',
        text: 'When your subject teachers enter marks for an examination they appear here immediately.' });
      return;
    }
    const bySubject = {};
    rows.forEach((r) => { bySubject[r.subjectId] = (bySubject[r.subjectId] || 0) + r.marks / (r.total || 100) * 100; });
    const chart = Object.keys(bySubject).map((id) => ({
      label: (SGC.db.findData('schoolSubjects', id) || {}).code || id,
      value: Math.round(bySubject[id] / rows.filter((r) => r.subjectId === id).length),
    }));

    mount.innerHTML =
      wrap(
        D.panel({ title: 'Overall', body:
          '<div style="display:flex;align-items:center;gap:.75rem"><span class="pct" style="font-size:1.2rem">' + markAverage() + '%</span>' +
          D.bar(markAverage(), 'gold') + '</div>' +
          '<p class="muted" style="font-size:.82rem">' + rows.length + ' papers marked across ' +
            Object.keys(bySubject).length + ' subjects.</p>' +
          '<p class="muted" style="font-size:.82rem">Grades follow the national scheme: A ≥ 80, B+ ≥ 75, B ≥ 70, C ≥ 60, S ≥ 50, W below 50.</p>' }) +
        D.panel({ title: 'Average mark by subject', body: '<div id="stResChart"></div>' })
      ) +
      D.panel({ title: 'Every paper marked', flush: true, body:
        D.tableHTML({
          caption: 'Examination results for ' + me.fullName,
          cols: [
            { key: 'date', label: 'Date', sortable: true, cell: (r) => esc(formatDate(r.date)) },
            { key: 'examName', label: 'Examination', sortable: true },
            { key: 'subjectId', label: 'Subject', cell: (r) => esc(SGC.i18n.loc(SGC.db.findData('schoolSubjects', r.subjectId) || {}, 'name')) },
            { key: 'marks', label: 'Marks', num: true, sortable: true, cell: (r) => esc(r.marks + ' / ' + r.total) },
            { key: 'grade', label: 'Grade', cell: (r) => D.gradeChip(r.grade) },
            { key: 'enteredBy', label: 'Entered by', cell: (r) => esc(SGC.db.teacherName(r.enteredBy)) },
          ],
          rows, empty: { title: 'No papers marked', text: 'Nothing has been entered for you yet.' },
        }) });
    const c = qs('#stResChart');
    if (c) SGC.charts.bar(c, chart, { title: null });
  }

  function stAttendance() {
    if (!mustStudent()) return;
    const mount = qs('#stAttendanceBody');
    if (!mount) return;
    const a = attSummary();
    if (!a.rows.length) {
      mount.innerHTML = emptyState({ icon: '📅', title: 'No register entries yet',
        text: 'Your class teacher marks the register each day; entries appear here the same day.' });
      return;
    }
    mount.innerHTML =
      D.widgets([
        { icon: '✔', value: String(a.c.Present), label: 'Days present', variant: 'ok' },
        { icon: '⏰', value: String(a.c.Late), label: 'Times late', variant: 'gold' },
        { icon: '✖', value: String(a.c.Absent), label: 'Days absent', variant: 'err' },
        { icon: '%', value: a.rate + '%', label: 'Attendance rate' },
      ]) + spacer() +
      '<p class="muted" style="font-size:.82rem">The rate counts present and late sessions. A student below 90% is ' +
        'seen by the class teacher and the guardian is informed.</p>' +
      spacer() + D.attGridHTML(a.rows) + spacer() +
      D.panel({ title: 'Register detail', flush: true, body:
        D.tableHTML({
          caption: 'Daily register entries for ' + me.fullName,
          cols: [
            { key: 'date', label: 'Date', sortable: true, cell: (r) => esc(formatDate(r.date)) },
            { key: 'status', label: 'Status', sortable: true, cell: (r) => '<span class="badge badge--' +
                (r.status === 'Present' ? 'academic' : r.status === 'Late' ? 'gold' : 'urgent') + '">' + esc(r.status) + '</span>' },
            { key: 'reason', label: 'Reason', cell: (r) => esc(r.reason || '—') },
            { key: 'markedBy', label: 'Marked by', cell: (r) => esc(SGC.db.teacherName(r.markedBy)) },
          ],
          rows: a.rows,
        }) });
  }

  function stAssignments() {
    if (!mustStudent()) return;
    const mount = qs('#stAssignmentsBody');
    if (!mount) return;
    const rows = assignments();
    if (!rows.length) {
      mount.innerHTML = emptyState({ icon: '📝', title: 'No assignments set',
        text: 'Your subject teachers publish coursework here. Nothing is outstanding right now.' });
      return;
    }
    mount.innerHTML = '<div class="split">' + rows.map((x) => {
      const s = dueState(x);
      const t = new Date(x.dueDate);
      const days = Math.ceil((t - new Date()) / 86400000);
      return D.panel({
        title: SGC.i18n.loc(SGC.db.findData('schoolSubjects', x.subjectId) || {}, 'name'),
        action: dueBadge(s),
        body: '<h4 style="margin:0 0 .4rem;font-family:var(--font)">' + esc(x.title) + '</h4>' +
          '<p style="margin:0 0 .7rem;color:var(--text-2);font-size:.9rem">' + esc(x.instructions) + '</p>' +
          '<dl class="info-grid"><dt>Due</dt><dd>' + esc(formatDate(x.dueDate)) +
            (s === 'overdue' ? ' (overdue by ' + Math.abs(days) + ' day' + (Math.abs(days) === 1 ? '' : 's') + ')'
              : s === 'soon' ? ' (in ' + days + ' day' + (days === 1 ? '' : 's') + ')' : '') + '</dd>' +
            '<dt>Maximum marks</dt><dd>' + esc(String(x.maxMarks)) + '</dd>' +
            '<dt>Set by</dt><dd>' + esc(SGC.db.teacherName(x.assignedBy)) + '</dd></dl>' +
          (s === 'done'
            ? '<p class="muted" style="font-size:.8rem;margin-top:.7rem">Marked as handed in on your record.</p>'
            : '<button type="button" class="btn btn--ghost btn--sm" data-handin="' + esc(x.id) + '" style="margin-top:.7rem">Mark as handed in</button>'),
      });
    }).join('') + '</div>';
    mount.querySelectorAll('[data-handin]').forEach((b) => b.addEventListener('click', () => {
      const a = SGC.db.findData('schoolAssignments', b.dataset.handin);
      if (!a) return;
      U.confirmDialog({
        title: 'Confirm submission',
        message: 'Record "' + a.title + '" as handed in?',
        detail: 'This only marks the date on your own record so you can track your work. The teacher still grades the paper itself.',
        confirmText: 'Mark as handed in',
      }).then((ok) => {
        if (!ok) return;
        SGC.db.insertData('schoolSubmissions', { assignmentId: a.id, studentId: me.id, submittedAt: todayISO(), note: '' });
        toast('Recorded as handed in.', 'success');
        stAssignments();
      });
    }));
  }

  function stExams() {
    if (!mustStudent()) return;
    const mount = qs('#stExamsBody');
    if (!mount) return;
    const rows = results();
    const byExam = {};
    rows.forEach((r) => { (byExam[r.examName] = byExam[r.examName] || []).push(r); });
    const names = Object.keys(byExam);
    const examNotices = noticesForMe().filter((n) => n.category === 'Exam');

    let h = '';
    if (!names.length) {
      h = emptyState({ icon: '🖊', title: 'No examinations recorded',
        text: 'Papers you have sat will be listed here with the marks entered by your teachers.' });
    } else {
      h = '<div class="split">' + names.map((n) => {
        const rs = byExam[n];
        const got = rs.reduce((s, r) => s + r.marks, 0);
        const out = rs.reduce((s, r) => s + (r.total || 100), 0);
        return D.panel({
          title: n,
          action: '<span class="badge badge--exam">' + rs.length + ' papers</span>',
          body: D.tableHTML({
            caption: n + ' results',
            cols: [
              { key: 'subjectId', label: 'Subject', cell: (r) => esc(SGC.i18n.loc(SGC.db.findData('schoolSubjects', r.subjectId) || {}, 'name')) },
              { key: 'marks', label: 'Mark', num: true, cell: (r) => esc(r.marks + '/' + r.total) },
              { key: 'grade', label: 'Grade', cell: (r) => D.gradeChip(r.grade) },
            ],
            rows: rs,
          }) + '<p style="margin:.8rem 0 0"><b>' + got + ' / ' + out + '</b> aggregate · ' +
            Math.round((got / out) * 100) + '% overall</p>',
        });
      }).join('') + '</div>';
    }

    h += spacer();
    if (examNotices.length) {
      h += '<h3 class="section-h">Examination notices</h3>' + '<div class="notice-list" id="stExamNotices"></div>';
    }
    mount.innerHTML = h;
    if (examNotices.length) SGC.notices.renderList(qs('#stExamNotices'), examNotices);
  }

  function stTimetable() {
    if (!mustStudent()) return;
    const mount = qs('#stTimetableBody');
    if (!mount) return;
    const slots = timetable();
    if (!slots.length) {
      mount.innerHTML = emptyState({ icon: '🕒', title: 'Timetable not published',
        text: 'The office has not released a period timetable for ' + SGC.db.className(me.classId) + ' yet.' });
      return;
    }
    const di = dayIndex();
    const nowHm = new Date().toTimeString().slice(0, 5);
    mount.innerHTML = DAYS.slice(0, 5).map((day) => {
      const rows = slots.filter((t) => t.day === day).sort((a, b) => a.period - b.period);
      if (!rows.length) return '';
      return '<h3 class="section-h">' + esc(day) + (day === DAYS[di] ? ' · today' : '') + '</h3>' +
        '<div class="tt">' + rows.map((t) => {
          const now = day === DAYS[di] && t.start <= nowHm && nowHm <= t.end;
          return '<div class="tt__cell' + (now ? ' is-now' : '') + '">' +
            '<div class="tt__p">Period ' + esc(String(t.period)) + ' · ' + esc(t.start) + '–' + esc(t.end) + '</div>' +
            '<div class="tt__s">' + esc(SGC.i18n.loc(SGC.db.findData('schoolSubjects', t.subjectId) || {}, 'name')) + '</div>' +
            '<div class="tt__t">' + esc(SGC.db.teacherName(t.teacherId)) + (t.room ? ' · ' + esc(t.room) : '') + '</div></div>';
        }).join('') + '</div>';
    }).join('') +
    '<p class="form-hint" style="margin-top:var(--sp-3)">Periods run from 08:00 to 13:45 with a break after the third ' +
      'period. A change issued by the office is announced as a notice before it takes effect.</p>';
  }

  function stNotices() {
    if (!mustStudent()) return;
    D.noticeList(qs('#stNoticesBody'), noticesForMe());
  }

  function stEvents() {
    if (!mustStudent()) return;
    const list = qs('#stEventsBody');
    if (list) {
      const up = SGC.events.upcoming();
      list.innerHTML = up.length ? up.map((e) => SGC.events.cardHTML(e)).join('')
        : emptyState({ icon: '🗓', title: 'No upcoming events', text: 'The college calendar is quiet right now.' });
    }
    const cal = qs('#stEventsCal');
    if (cal) SGC.events.renderCalendar(cal);
  }

  function stDownloads() {
    if (!mustStudent()) return;
    const mount = qs('#stDownloadsBody');
    if (mount) SGC.downloads.renderList(mount, SGC.db.all('schoolDownloads').filter((d) => d.published !== false));
  }

  function msgHTML(m) {
    const mine = m.from === me.id;
    return '<article class="msg' + (!m.read && !mine ? ' is-unread' : '') + '" data-msg="' + esc(m.id) + '" tabindex="0" role="button">' +
      '<div class="msg__body">' +
        '<div class="msg__from">' + esc(mine ? 'You → ' + resolveName(m.to) : resolveName(m.from)) +
          (mine ? '' : ' <span class="tag-me">to me</span>') + '</div>' +
        '<p class="msg__sub">' + esc(m.subject || '(no subject)') + '</p>' +
        '<p class="msg__txt">' + esc(m.body) + '</p>' +
      '</div>' +
      '<span class="mini__end">' + esc(formatDate(m.date)) + '</span></article>';
  }

  function resolveName(id) {
    if (id === 'all') return 'All members';
    if (id === 'admin') return "Principal's Office";
    return SGC.db.studentName(id) === '—' ? SGC.db.teacherName(id) : SGC.db.studentName(id);
  }

  function stMessages() {
    if (!mustStudent()) return;
    const mount = qs('#stMessagesBody');
    if (!mount) return;
    refreshPills();
    const rows = messagesForMe();
    mount.innerHTML =
      D.widgets([
        { icon: '✉', value: String(rows.length), label: 'Threads' },
        { icon: '●', value: String(unread().length), label: 'Unread', variant: 'ok' },
        { icon: '➤', value: String(rows.filter((m) => m.from === me.id).length), label: 'Sent by you' },
      ]) + spacer() +
      '<div class="toolbar"><span></span><button type="button" class="btn btn--primary btn--sm" data-newmsg>✎ Write to a teacher</button></div>' +
      '<div id="stMsgList">' + (rows.length ? rows.map(msgHTML).join('')
        : emptyState({ icon: '✉', title: 'Your inbox is empty', text: 'Messages from your teachers and the office appear here.' })) + '</div>';

    /* Delegated listeners are bound once per mount; re-rendering replaces
       the children but not the mount itself. */
    if (!mount.dataset.wired) {
      mount.dataset.wired = '1';
      U.on(mount, 'click', '[data-msg]', (e, node) => openMessage(node.dataset.msg));
      U.on(mount, 'keydown', '[data-msg]', (e, node) => {
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openMessage(node.dataset.msg); }
      });
      U.on(mount, 'click', '[data-newmsg]', () => compose());
    }
  }

  function openMessage(id) {
    const m = SGC.db.findData('schoolMessages', id);
    if (!m) return;
    if (!m.read && m.to === me.id) { SGC.db.updateData('schoolMessages', id, { read: true }); refreshPills(); }
    const mine = m.from === me.id;
    U.modal({
      title: m.subject || 'Message',
      body: '<p class="muted" style="margin-top:0;font-size:.82rem">From ' + esc(resolveName(m.from)) +
        ' · ' + esc(formatDate(m.date)) + '</p>' +
        '<div class="prose"><p style="white-space:pre-wrap">' + esc(m.body) + '</p></div>' +
        (mine ? '' : '<div class="field" style="margin-top:var(--sp-3)"><label class="label" for="rp">Reply</label>' +
          '<textarea class="textarea" id="rp" rows="4" placeholder="Write your reply to ' + esc(resolveName(m.from)) + '"></textarea></div>' +
          '<button type="button" class="btn btn--primary" data-send>Send reply</button>'),
      onOpen(modal) {
        U.on(modal.root, 'click', '[data-send]', () => {
          const ta = qs('#rp', modal.root);
          const text = (ta.value || '').trim();
          if (text.length < 5) { toast('Write a little more before sending.', 'error'); ta.focus(); return; }
          SGC.db.insertData('schoolMessages', {
            from: me.id, fromName: me.fullName, to: m.from, subject: 'Re: ' + (m.subject || 'message'),
            body: text, date: todayISO(), read: false, threadId: m.threadId || U.uid('TH'), role: 'student',
          });
          toast('Reply sent.', 'success');
          modal.close();
          stMessages();
          refreshPills();
        });
      },
    });
    if (!mine) refreshPills();
  }

  function compose() {
    const teachers = SGC.db.all('schoolTeachers');
    const h = U.modal({
      title: 'Write to the college',
      body: '<div class="field"><label class="label" for="cm-to">Recipient</label><select class="select" id="cm-to">' +
          teachers.map((t) => '<option value="' + esc(t.id) + '">' + esc(t.fullName) + ' · ' + esc(t.department) + '</option>').join('') +
          '<option value="admin">Principal\u2019s Office</option></select></div>' +
        '<div class="field"><label class="label" for="cm-sub">Subject</label><input class="input" id="cm-sub" maxlength="90"></div>' +
        '<div class="field"><label class="label" for="cm-body">Message</label><textarea class="textarea" id="cm-body" rows="5"></textarea></div>',
      footer: '<button type="button" class="btn btn--ghost" data-close>Cancel</button>' +
        '<button type="button" class="btn btn--primary" data-send>Send</button>',
      onOpen(modal) {
        U.on(modal.root, 'click', '[data-send]', () => {
          const to = qs('#cm-to', modal.root).value;
          const subject = qs('#cm-sub', modal.root).value.trim();
          const body = qs('#cm-body', modal.root).value.trim();
          if (!subject || body.length < 10) { toast('Add a subject and at least a sentence.', 'error'); return; }
          SGC.db.insertData('schoolMessages', {
            from: me.id, fromName: me.fullName, to, subject, body, date: todayISO(), read: false,
            threadId: U.uid('TH'), role: 'student',
          });
          toast('Message sent to ' + resolveName(to) + '.', 'success');
          modal.close();
          stMessages();
        });
      },
    });
    if (h) qs('#cm-sub', h.root).focus();
  }

  function stSettings() {
    if (!mustStudent()) return;
    const mount = qs('#stSettingsBody');
    if (!mount) return;
    const p = prefs()[me.id] || {};
    mount.innerHTML =
      D.panel({ title: 'Portal preferences', body:
        D.setRow({ title: 'Notice e-mail digest', text: 'In a connected build this asks the server to e-mail new notices to your guardian. Stored on this device only for the demo.',
          control: D.switchHTML('prefDigest', 'Notice digest', p.digest !== false) }) +
        D.setRow({ title: 'Assignment reminders', text: 'Highlight work due within two days on the dashboard.',
          control: D.switchHTML('prefRemind', 'Assignment reminders', p.remind !== false) }) +
        D.setRow({ title: 'Language', text: 'Switching to සිංහල changes the portal labels and any notice that carries a Sinhala version.',
          control: '<div class="row-actions"><button type="button" class="btn btn--ghost btn--sm" data-lang="en">English</button>' +
            '<button type="button" class="btn btn--ghost btn--sm" data-lang="si">සිංහල</button></div>' }) +
        D.setRow({ title: 'Appearance', text: 'The theme follows the college website setting and is remembered on this device.',
          control: '<button type="button" class="btn btn--ghost btn--sm" data-theme-toggle>Toggle dark mode</button>' }) }) +
      spacer() +
      D.panel({ title: 'Password', body:
        '<p class="muted" style="margin-top:0">This demo stores the password in plain text inside your browser so the ' +
        'dashboards can be tried without a server. A production build hashes on the authentication server and the ' +
        'browser never sees the stored value.</p>' +
        '<form id="pwForm"><div class="form-grid">' +
          '<div class="field"><label class="label" for="pw1">New password</label><input class="input" id="pw1" type="password" autocomplete="new-password" minlength="6"></div>' +
          '<div class="field"><label class="label" for="pw2">Repeat password</label><input class="input" id="pw2" type="password" autocomplete="new-password" minlength="6"></div>' +
        '</div><button class="btn btn--primary" type="submit">Change password</button></form>' }) +
      spacer() +
      D.panel({ title: 'Account', body:
        '<dl class="info-grid">' +
          '<dt>Sign-in ID</dt><dd>' + esc(me.studentId) + '</dd>' +
          '<dt>Role</dt><dd>Student</dd>' +
          '<dt>Account</dt><dd>' + esc(sess.userId) + '</dd>' +
          '<dt>Last sign-in</dt><dd>' + esc((SGC.db.findData('schoolUsers', sess.userId) || {}).lastLogin ? formatDate((SGC.db.findData('schoolUsers', sess.userId) || {}).lastLogin) : 'this session') + '</dd>' +
        '</dl>' + spacer() +
        '<button type="button" class="btn btn--danger btn--sm" data-signout>Sign out of this device</button>' });

    const f = qs('#pwForm');
    if (f) f.addEventListener('submit', async (e) => {
      e.preventDefault();
      const a = qs('#pw1').value, b = qs('#pw2').value;
      if (a !== b) { toast('The two passwords do not match.', 'error'); return; }
      const r = await SGC.auth.setPassword(sess.userId, a);
      toast(r.ok ? 'Password changed. Use it the next time you sign in.' : r.error, r.ok ? 'success' : 'error');
      if (r.ok) { qs('#pw1').value = ''; qs('#pw2').value = ''; }
    });
    qs('#prefDigest').addEventListener('change', (e) => { setPref('digest', e.target.checked); toast('Preference saved on this device.', 'info'); });
    qs('#prefRemind').addEventListener('change', (e) => { setPref('remind', e.target.checked); toast('Preference saved on this device.', 'info'); });
    if (!mount.dataset.wired) {
      mount.dataset.wired = '1';
      U.on(mount, 'click', '[data-signout]', () => {
        SGC.auth.logout();
        toast('You have been signed out.', 'info');
        setTimeout(() => { global.location.href = 'index.html'; }, 500);
      });
    }
  }

  /* ---------------- chrome bits shared by the portal ---------------- */
  function refreshPills() {
    const n = qs('#pillNotices');
    if (n) { const c = me ? noticesForMe().length : 0; n.textContent = c ? String(c) : ''; n.hidden = !c; }
    const m = qs('#pillMessages');
    if (m) { const c = me ? unread().length : 0; m.textContent = c ? String(c) : ''; m.hidden = !c; }
  }

  const VIEWS = { stHome, stProfile, stClasses, stResults, stAttendance, stAssignments, stExams,
    stTimetable, stNotices, stEvents, stDownloads, stMessages, stSettings };

  function activeView() {
    const v = qs('.view.is-active');
    return v ? v.dataset.view : 'stHome';
  }

  Object.keys(VIEWS).forEach((k) => { SGC.pages[k] = VIEWS[k]; });

  SGC.pages['student-dashboard'] = {
    init() {
      sess = SGC.auth.requireAuth(['student']);
      if (!sess) return;
      me = SGC.db.findData('schoolStudents', sess.linkedId);
      if (!me) {
        sess = null;
        stHome();
        return;
      }
      const st = SGC.db.getSettings();
      D.shell(sess, (me.classId ? SGC.db.className(me.classId) : 'Student') + ' · ' + me.studentId);
      const side = qs('#sideSchool');
      if (side) side.textContent = st.shortName || 'SGCC';
      refreshPills();
      stHome();
      document.addEventListener('sgc:lang', () => { const fn = VIEWS[activeView()]; if (fn) fn(); });
    },
  };
})(window);
