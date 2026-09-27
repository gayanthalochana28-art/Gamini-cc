/* =============================================================
   SRI GAMINI CENTRAL COLLEGE — teacher portal

   A teacher may read and write only the classes allocated to them on
   the period timetable. `myClasses()` is the single scope used by every
   query and every form below, so a register left open on a shared staff
   room machine still cannot reach another teacher's classes.

   Swapping to a backend: the same scope must be enforced by the server
   from the authenticated uid — a browser-side filter is not a permission.
   ============================================================= */
(function (global) {
  'use strict';
  const SGC = global.SGC = global.SGC || {};
  const U = SGC.utils, D = SGC.dash;
  const { esc, qs, formatDate, todayISO, toast, emptyState } = U;

  const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
  const dayIndex = () => (new Date().getDay() + 6) % 7;
  const STATUSES = ['Present', 'Late', 'Absent'];
  const gradeOf = (m) => (m >= 80 ? 'A' : m >= 75 ? 'B+' : m >= 70 ? 'B' : m >= 60 ? 'C' : m >= 50 ? 'S' : 'W');

  let me = null;
  let sess = null;

  /* ---------------- scope ---------------- */
  const slots = () => SGC.db.all('schoolTimetable').filter((t) => t.teacherId === me.id).sort((a, b) => a.period - b.period);
  function myClasses() {
    const seen = [];
    slots().forEach((t) => { if (!seen.includes(t.classId)) seen.push(t.classId); });
    return seen.map((id) => SGC.db.findData('schoolClasses', id)).filter(Boolean);
  }
  const myClassIds = () => myClasses().map((c) => c.id);
  const studentsIn = (classId) => SGC.db.all('schoolStudents').filter((s) => s.classId === classId)
    .sort((a, b) => a.fullName.localeCompare(b.fullName));
  function subjectsFor(classId) {
    const ids = [];
    slots().filter((t) => t.classId === classId).forEach((t) => { if (!ids.includes(t.subjectId)) ids.push(t.subjectId); });
    return ids.map((id) => SGC.db.findData('schoolSubjects', id)).filter(Boolean);
  }
  const myAssignments = () => SGC.db.all('schoolAssignments')
    .filter((a) => myClassIds().includes(a.classId)).sort((a, b) => String(b.createdAt || '').localeCompare(String(a.createdAt || '')));
  const myResults = () => SGC.db.all('schoolResults').filter((r) => myClassIds().includes(r.classId));
  function noticesForMe() {
    return SGC.notices.live().filter((n) => !Array.isArray(n.audience) || !n.audience.length ||
      n.audience.includes('teacher') || n.audience.includes('all'));
  }
  const messagesForMe = () => SGC.db.all('schoolMessages')
    .filter((m) => m.to === me.id || m.from === me.id || m.to === 'all')
    .sort((a, b) => String(b.date).localeCompare(String(a.date)));
  const unread = () => messagesForMe().filter((m) => m.to === me.id && !m.read);
  const markedOn = (date) => SGC.db.all('schoolAttendance').filter((a) => a.date === date && myClassIds().includes(a.classId));

  function mustTeacher() {
    if (!me) {
      sess = SGC.auth.requireAuth(['teacher']);
      if (!sess) return false;
      me = SGC.db.findData('schoolTeachers', sess.linkedId);
    }
    if (!me) {
      const m = qs('#dashMain');
      if (m) m.innerHTML = emptyState({ icon: '⚠', title: 'No staff record for this account',
        text: 'The administration office has not created a staff file for this sign-in yet.' });
      return false;
    }
    return true;
  }

  const spacer = () => '<div style="height:var(--sp-3)"></div>';
  const wrap = (html) => '<div class="split" style="margin-bottom:var(--sp-3)">' + html + '</div>';

  function classOptions(sel) {
    return myClasses().map((c) => '<option value="' + c.id + '"' + (c.id === sel ? ' selected' : '') + '>' + esc(c.name) + '</option>').join('');
  }

  const prefs = () => SGC.db.loadData('schoolUserPrefs', {}) || {};
  function setPref(k, v) {
    const allP = SGC.db.loadData('schoolUserPrefs', {}) || {};
    allP[me.id] = Object.assign({}, allP[me.id], { [k]: v });
    SGC.db.saveData('schoolUserPrefs', allP);
  }

  /* ======================= VIEWS ======================= */

  function teHome() {
    if (!mustTeacher()) return;
    const cls = myClasses();
    const regToday = markedOn(todayISO());
    const expected = cls.reduce((s, c) => s + studentsIn(c.id).length, 0);
    const sub = qs('#teHomeSub');
    if (sub) sub.textContent = me.position + ' · ' + cls.length + ' class' + (cls.length === 1 ? '' : 'es') +
      ' · ' + expected + ' students on your registers';

    const w = qs('#teWidgets');
    if (w) w.innerHTML = D.widgets([
      { icon: '🏫', value: String(cls.length), label: 'Classes allocated' },
      { icon: '🎓', value: String(expected), label: 'Students taught' },
      { icon: '📅', value: regToday.length + '/' + expected, label: 'Register marked today',
        variant: regToday.length >= expected && expected ? 'ok' : 'gold', trend: regToday.length >= expected && expected ? 'complete' : 'pending', trendDown: regToday.length < expected },
      { icon: '✉', value: String(unread().length), label: 'Unread messages', variant: 'ok' },
    ]);

    const today = qs('#teToday');
    if (today) {
      const rows = slots().filter((t) => t.day === DAYS[dayIndex()]);
      today.innerHTML = dayIndex() > 4
        ? '<p class="muted">No teaching periods on ' + DAYS[dayIndex()] + '.</p>'
        : (rows.length ? D.miniHTML(rows.map((t) => ({
            icon: String(t.period),
            title: SGC.i18n.loc(SGC.db.findData('schoolSubjects', t.subjectId) || {}, 'name') + ' · ' + SGC.db.className(t.classId),
            meta: t.start + ' – ' + t.end + ' · ' + (t.room || 'room to be advised'),
          }))) : '<p class="muted">You have no periods timetabled today.</p>');
    }

    const reg = qs('#teHomeReg');
    if (reg) {
      reg.innerHTML = cls.length
        ? '<ul class="mini">' + cls.map((c) => {
            const n = SGC.db.all('schoolAttendance').filter((a) => a.date === todayISO() && a.classId === c.id).length;
            const total = studentsIn(c.id).length;
            return '<li><span class="mini__i" aria-hidden="true">' + (n >= total && total ? '✔' : '…') + '</span>' +
              '<div><b>' + esc(c.name) + '</b><span>' + n + ' of ' + total + ' marked today</span></div>' +
              '<span class="mini__end">' + D.bar(total ? (n / total) * 100 : 0, n >= total && total ? 'ok' : 'gold') + '</span></li>';
          }).join('') + '</ul>'
        : '<p class="muted">No classes are allocated to you on the current timetable.</p>';
    }

    D.noticeList(qs('#teHomeNotices'), noticesForMe().slice(0, 4));

    const asg = qs('#teHomeAsg');
    if (asg) {
      const rows = myAssignments().slice(0, 5);
      asg.innerHTML = rows.length ? D.miniHTML(rows.map((a) => ({
        icon: '📝',
        title: a.title,
        meta: SGC.db.className(a.classId) + ' · due ' + formatDate(a.dueDate),
        end: String(a.maxMarks) + ' marks',
      }))) : '<p class="muted">You have not set any coursework yet.</p>';
    }
  }

  function teProfile() {
    if (!mustTeacher()) return;
    const mount = qs('#teProfileBody');
    if (!mount) return;
    const st = SGC.db.getSettings();
    const row = (k, v) => '<dt>' + esc(k) + '</dt><dd>' + esc(v || '—') + '</dd>';
    mount.innerHTML =
      '<div class="profile-card">' +
        '<div class="profile-card__cover"><img src="' + esc(U.rootURL('assets/school-front.jpg')) + '" alt="' + esc(st.schoolName) + '"></div>' +
        '<div class="profile-card__in">' +
          '<div class="profile-card__av">' + U.avatarHTML({ fullName: me.fullName, photo: me.photo, folder: 'teachers' }, 112) + '</div>' +
          '<div class="profile-card__id"><h1>' + esc(me.fullName) + '</h1><p>' + esc(me.position) + ' · ' + esc(me.department) + '</p>' +
            '<p style="margin-top:.35rem"><span class="badge badge--gold">' + esc(me.teacherId) + '</span> ' +
            '<span class="badge">' + esc(me.status || 'Active') + '</span></p></div>' +
          '<div class="profile-card__acts"><a class="btn btn--ghost btn--sm" href="profile.html">Edit my details</a>' +
            '<a class="btn btn--primary btn--sm" href="pages/teachers.html">Public staff card</a></div>' +
        '</div>' +
        '<div class="profile-body">' +
          '<h3 class="section-h">Appointment</h3><dl class="info-grid">' +
            row('Staff number', me.teacherId) + row('Position', me.position) + row('Department', me.department) +
            row('Joined', me.joinedOn ? formatDate(me.joinedOn) : '') +
            row('Subjects', (me.subjectIds || []).map((id) => SGC.i18n.loc(SGC.db.findData('schoolSubjects', id) || {}, 'name')).join(', ')) +
            row('Classes allocated', myClasses().map((c) => c.name).join(', ')) +
          '</dl>' +
          '<h3 class="section-h">Contact</h3><dl class="info-grid">' +
            row('College e-mail', me.email) + row('Telephone', me.phone) + row('Address', me.address) +
          '</dl>' +
          '<h3 class="section-h">Biography shown on the website</h3>' +
          '<p class="prose" style="font-size:.92rem">' + esc(me.bio) + '</p>' +
        '</div>' +
      '</div>';
  }

  function teClasses() {
    if (!mustTeacher()) return;
    const mount = qs('#teClassesBody');
    if (!mount) return;
    const cls = myClasses();
    if (!cls.length) {
      mount.innerHTML = emptyState({ icon: '🏫', title: 'No classes allocated',
        text: 'The timetable office has not placed you on a class register for this term yet.' });
      return;
    }
    mount.innerHTML = '<div class="split">' + cls.map((c) => D.panel({
      title: c.name,
      action: '<span class="badge">' + esc(c.stream) + '</span>',
      body: '<dl class="info-grid">' +
        '<dt>Grade</dt><dd>' + esc(String(c.grade)) + '</dd>' +
        '<dt>Room</dt><dd>' + esc(c.room) + '</dd>' +
        '<dt>On register</dt><dd>' + studentsIn(c.id).length + ' students</dd>' +
        '<dt>Your subjects</dt><dd>' + esc(subjectsFor(c.id).map((s) => SGC.i18n.loc(s, 'name')).join(', ')) + '</dd>' +
        '<dt>Periods with you</dt><dd>' + slots().filter((t) => t.classId === c.id).length + ' a week</dd>' +
      '</dl>' + spacer() +
      '<button type="button" class="btn btn--ghost btn--sm" data-goto="teAttendance" data-preselect="' + esc(c.id) + '">Open register</button>',
    })).join('') + '</div>';
  }

  function teStudents() {
    if (!mustTeacher()) return;
    const mount = qs('#teStudentsBody');
    if (!mount) return;
    const cls = myClasses();
    if (!cls.length) { mount.innerHTML = '<p class="muted">You are not allocated to a class register yet.</p>'; return; }
    mount.innerHTML =
      '<p class="muted" style="margin-top:0">Student records are visible to the office and to the teachers of that ' +
      'class only. They are never published on the public website.</p>' +
      '<div id="teStudTable"></div>';
    D.dataTable(qs('#teStudTable'), {
      caption: 'Students in the classes I teach',
      searchPlaceholder: 'Search name, ID, admission number…',
      searchKeys: ['fullName', 'studentId', 'admissionNo', 'email', 'guardianName'],
      pageSize: 12,
      defaultSort: { key: 'fullName', dir: 'asc' },
      filters: [{ key: 'classId', label: 'All my classes', options: cls.map((c) => ({ value: c.id, label: c.name })) }],
      rows: () => cls.reduce((acc, c) => acc.concat(studentsIn(c.id)), []),
      empty: { title: 'No student matches', text: 'Try a different name or clear the class filter.' },
      cols: [
        { key: 'studentId', label: 'ID', sortable: true },
        { key: 'fullName', label: 'Student', sortable: true, cell: (r) =>
            '<div style="display:flex;align-items:center;gap:.55rem">' + U.avatarHTML({ fullName: r.fullName, photo: r.photo, folder: 'students' }, 32) +
            '<div><b>' + esc(r.fullName) + '</b><div class="muted" style="font-size:.76rem">' + esc(r.nameWithInitials || '') + '</div></div></div>' },
        { key: 'classId', label: 'Class', sortable: true, cell: (r) => esc(SGC.db.className(r.classId)) },
        { key: 'gender', label: 'Gender' },
        { key: 'guardianName', label: 'Guardian', sortable: true },
        { key: 'phone', label: 'Telephone' },
        { key: 'status', label: 'Status', sortable: true, cell: (r) => '<span class="badge badge--' + (r.status === 'Active' ? 'live' : 'draft') + '">' + esc(r.status) + '</span>' },
      ],
    });
  }

  /* ---------------- attendance register ---------------- */
  let regClass = '';
  function teAttendance() {
    if (!mustTeacher()) return;
    const mount = qs('#teAttendanceBody');
    if (!mount) return;
    const cls = myClasses();
    if (!cls.length) { mount.innerHTML = '<p class="muted">Registers appear once the timetable office allocates you a class.</p>'; return; }
    if (!regClass || !cls.some((c) => c.id === regClass)) regClass = cls[0].id;

    mount.innerHTML =
      D.panel({ title: 'Daily register', body:
        '<div class="toolbar">' +
          '<div><label class="label" for="regCls">Class</label><select class="select" id="regCls">' + classOptions(regClass) + '</select></div>' +
          '<div><label class="label" for="regDate">Date</label><input class="input" id="regDate" type="date" value="' + esc(qs('#regDate') ? qs('#regDate').value : todayISO()) + '" max="' + todayISO() + '"></div>' +
          '<div style="align-self:flex-end"><button type="button" class="btn btn--primary" id="regGo">Open register</button></div>' +
        '</div>' +
        '<p class="form-hint">The register is marked once per class per day. Correcting an entry overwrites the ' +
          'previous value and is stamped with your staff number.</p>' }) +
      spacer() + '<div id="regWrap"></div>';

    qs('#regCls').value = regClass;
    qs('#regGo').addEventListener('click', () => { regClass = qs('#regCls').value; drawRegister(qs('#regDate').value); });
    drawRegister(todayISO());
  }

  function drawRegister(date) {
    const wrapEl = qs('#regWrap');
    if (!wrapEl) return;
    const list = studentsIn(regClass);
    if (!list.length) { wrapEl.innerHTML = '<p class="muted">No students are on the register for this class.</p>'; return; }
    const existing = SGC.db.all('schoolAttendance').filter((a) => a.date === date && a.classId === regClass);
    const find = (sid) => existing.find((a) => a.studentId === sid);

    wrapEl.innerHTML = D.panel({
      title: 'Register · ' + SGC.db.className(regClass) + ' · ' + formatDate(date),
      action: '<span class="badge badge--' + (existing.length >= list.length ? 'live' : 'gold') + '">' +
        existing.length + ' / ' + list.length + ' marked</span>',
      flush: true,
      body: '<div class="table-wrap"><table class="table"><caption class="sr-only">Attendance register</caption><thead><tr>' +
        '<th scope="col">Student</th><th scope="col">ID</th><th scope="col">Status</th><th scope="col">Reason / note</th>' +
        '</tr></thead><tbody>' + list.map((s) => {
          const e = find(s.id);
          return '<tr><td><b>' + esc(s.fullName) + '</b></td><td>' + esc(s.studentId) + '</td>' +
            '<td><label class="sr-only" for="st-' + esc(s.id) + '">Attendance status for ' + esc(s.fullName) + '</label>' +
              '<select class="select" id="st-' + esc(s.id) + '" data-st="' + esc(s.id) + '" style="min-width:130px">' +
              STATUSES.map((x) => '<option' + ((e ? e.status : 'Present') === x ? ' selected' : '') + '>' + x + '</option>').join('') +
              '</select></td>' +
            '<td><label class="sr-only" for="rs-' + esc(s.id) + '">Reason for ' + esc(s.fullName) + '</label>' +
              '<input class="input" id="rs-' + esc(s.id) + '" data-reason="' + esc(s.id) + '" value="' + esc(e ? (e.reason || '') : '') + '" placeholder="Optional"></td></tr>';
        }).join('') + '</tbody></table></div>' +
        '<div class="panel__body"><button type="button" class="btn btn--primary" id="regSave">Save register</button> ' +
        '<button type="button" class="btn btn--ghost" id="regAll">Mark everyone present</button></div>',
    });

    /* Listeners go on the freshly rendered buttons, not the persistent
       wrapper, so each redraw closes over its own date and class. */
    qs('#regAll', wrapEl).addEventListener('click', () => {
      wrapEl.querySelectorAll('select[data-st]').forEach((x) => { x.value = 'Present'; });
      toast('All students set to present — press Save to record it.', 'info');
    });
    qs('#regSave', wrapEl).addEventListener('click', () => {
      let n = 0;
      wrapEl.querySelectorAll('select[data-st]').forEach((sel) => {
        const sid = sel.dataset.st;
        const status = sel.value;
        const reason = (qs('[data-reason="' + sid + '"]', wrapEl).value || '').trim();
        const prior = find(sid);
        if (prior) SGC.db.updateData('schoolAttendance', prior.id, { status, reason, markedBy: me.id, date });
        else SGC.db.insertData('schoolAttendance', { date, studentId: sid, classId: regClass, status, markedBy: me.id, reason });
        n++;
      });
      toast(n + ' register entries saved for ' + SGC.db.className(regClass) + '.', 'success');
      drawRegister(qs('#regDate') ? qs('#regDate').value : date);
      teHome();
    });
  }

  /* ---------------- assignments ---------------- */
  function teAssignments() {
    if (!mustTeacher()) return;
    const mount = qs('#teAssignmentsBody');
    if (!mount) return;
    if (!myClasses().length) { mount.innerHTML = '<p class="muted">Assign a class through the timetable before setting coursework.</p>'; return; }
    mount.innerHTML = '<div id="teAsgTable"></div>';
    const table = D.dataTable(qs('#teAsgTable'), {
      caption: 'Coursework set for my classes',
      searchPlaceholder: 'Search title…',
      searchKeys: ['title', 'instructions'],
      defaultSort: { key: 'dueDate', dir: 'asc' },
      filters: [{ key: 'classId', label: 'All my classes', options: myClasses().map((c) => ({ value: c.id, label: c.name })) }],
      rows: myAssignments,
      empty: { title: 'No coursework set', text: 'Use Add assignment to publish work to a class.' },
      addLabel: 'Add assignment',
      onAdd: () => asgForm(null),
      cols: [
        { key: 'title', label: 'Assignment', sortable: true, cell: (r) =>
            '<b>' + esc(r.title) + '</b><div class="muted" style="font-size:.76rem">' + esc(SGC.i18n.loc(SGC.db.findData('schoolSubjects', r.subjectId) || {}, 'name')) + '</div>' },
        { key: 'classId', label: 'Class', sortable: true, cell: (r) => esc(SGC.db.className(r.classId)) },
        { key: 'dueDate', label: 'Due', sortable: true, cell: (r) => esc(formatDate(r.dueDate)) },
        { key: 'maxMarks', label: 'Marks', num: true, sortable: true },
        { key: 'assignedBy', label: 'Set by', cell: (r) => esc(r.assignedBy === me.id ? 'You' : SGC.db.teacherName(r.assignedBy)) },
        { key: 'id', label: '', cell: (r) => D.rowActions(r.id, { view: false }) },
      ],
    });
    U.on(table.root, 'click', '[data-act]', (e, btn) => {
      const a = SGC.db.findData('schoolAssignments', btn.dataset.id);
      if (!a) return;
      if (btn.dataset.act === 'edit') asgForm(a);
      else U.confirmDialog({ title: 'Delete assignment', message: 'Remove "' + a.title + '"?',
        detail: 'Students will no longer see this in their portal. This cannot be undone.', danger: true, confirmText: 'Delete' })
        .then((ok) => { if (!ok) return; SGC.db.deleteData('schoolAssignments', a.id); toast('Assignment deleted.', 'info'); table.refresh(); });
    });
  }

  function asgForm(existing) {
    const a = existing || {};
    const subs = me.subjectIds || [];
    U.modal({
      title: existing ? 'Edit assignment' : 'Set a new assignment',
      body: '<div class="form-grid">' +
        '<div class="field"><label class="label" for="af-cls">Class <span class="req">*</span></label>' +
          '<select class="select" id="af-cls">' + classOptions(a.classId || regClassFor()) + '</select></div>' +
        '<div class="field"><label class="label" for="af-sub">Subject <span class="req">*</span></label>' +
          '<select class="select" id="af-sub">' + (subs.length ? subs : ['SUB01']).map((id) => {
            const s = SGC.db.findData('schoolSubjects', id) || {};
            return '<option value="' + id + '"' + (a.subjectId === id ? ' selected' : '') + '>' + esc(s.name || id) + '</option>';
          }).join('') + '</select></div>' +
        '<div class="field"><label class="label" for="af-due">Due date <span class="req">*</span></label>' +
          '<input class="input" id="af-due" type="date" value="' + esc(a.dueDate || todayISO()) + '"></div>' +
        '<div class="field"><label class="label" for="af-max">Maximum marks</label>' +
          '<input class="input" id="af-max" type="number" min="1" max="100" value="' + esc(a.maxMarks || 20) + '"></div>' +
      '</div>' +
      '<div class="field"><label class="label" for="af-title">Title <span class="req">*</span></label>' +
        '<input class="input" id="af-title" maxlength="90" value="' + esc(a.title || '') + '" placeholder="e.g. Complex numbers — problem set 4"></div>' +
      '<div class="field"><label class="label" for="af-ins">Instructions for students</label>' +
        '<textarea class="textarea" id="af-ins" rows="4">' + esc(a.instructions || '') + '</textarea></div>',
      footer: '<button type="button" class="btn btn--ghost" data-close>Cancel</button>' +
        '<button type="button" class="btn btn--primary" data-save>' + (existing ? 'Save changes' : 'Publish to class') + '</button>',
      onOpen(m) {
        U.on(m.root, 'click', '[data-save]', () => {
          const rec = {
            classId: qs('#af-cls', m.root).value,
            subjectId: qs('#af-sub', m.root).value,
            dueDate: qs('#af-due', m.root).value,
            maxMarks: Number(qs('#af-max', m.root).value) || 20,
            title: qs('#af-title', m.root).value.trim(),
            instructions: qs('#af-ins', m.root).value.trim(),
            assignedBy: me.id,
          };
          if (!rec.title) { toast('Give the assignment a title.', 'error'); return; }
          if (!rec.dueDate) { toast('Choose a due date.', 'error'); return; }
          if (existing) SGC.db.updateData('schoolAssignments', existing.id, rec);
          else SGC.db.insertData('schoolAssignments', Object.assign({ createdAt: U.nowISO() }, rec));
          toast(existing ? 'Assignment updated.' : 'Assignment published to ' + SGC.db.className(rec.classId) + '.', 'success');
          m.close();
          teAssignments();
        });
      },
    });
  }
  const regClassFor = () => (myClasses()[0] || {}).id || '';

  /* ---------------- examinations ---------------- */
  function teExams() {
    if (!mustTeacher()) return;
    const mount = qs('#teExamsBody');
    if (!mount) return;
    const rows = myResults();
    const byExam = {};
    rows.forEach((r) => { (byExam[r.examName] = byExam[r.examName] || []).push(r); });
    const examNotices = SGC.notices.live().filter((n) => n.category === 'Exam');

    mount.innerHTML =
      wrap(
        D.panel({ title: 'Publish examination information', body:
          '<p class="muted" style="margin-top:0">Examination dates, invigilation and syllabus coverage reach students ' +
          'as notices in the Exam category, so they also appear on the public notices page and in the student portal.</p>' +
          '<div class="field"><label class="label" for="ex-title">Headline <span class="req">*</span></label>' +
            '<input class="input" id="ex-title" maxlength="90" placeholder="e.g. Term III preliminary examination timetable"></div>' +
          '<div class="field"><label class="label" for="ex-body">Details <span class="req">*</span></label>' +
            '<textarea class="textarea" id="ex-body" rows="4" placeholder="Dates, reporting times, rooms, what students must bring"></textarea></div>' +
          '<div class="form-grid">' +
            '<div class="field"><label class="label" for="ex-pri">Priority</label><select class="select" id="ex-pri">' +
              SGC.notices.PRIORITIES.map((p) => '<option' + (p === 'High' ? ' selected' : '') + '>' + p + '</option>').join('') + '</select></div>' +
            '<div class="field"><label class="label" for="ex-exp">Remove after</label><input class="input" id="ex-exp" type="date"></div>' +
          '</div>' +
          '<button type="button" class="btn btn--primary" id="exSend">Publish to students and parents</button>' }) +
        D.panel({ title: 'Papers marked in your classes', flush: true, body:
          Object.keys(byExam).length
            ? D.tableHTML({
                caption: 'Examinations recorded',
                cols: [
                  { key: 'name', label: 'Examination', cell: (r) => esc(r.name) },
                  { key: 'papers', label: 'Papers', num: true },
                  { key: 'avg', label: 'Average', num: true, cell: (r) => esc(r.avg + '%') },
                  { key: 'date', label: 'Last entered', cell: (r) => esc(formatDate(r.date)) },
                ],
                rows: Object.keys(byExam).map((n) => {
                  const rs = byExam[n];
                  return { name: n, papers: rs.length, date: rs.map((x) => x.date).sort().slice(-1)[0],
                    avg: Math.round(rs.reduce((s, r) => s + (r.marks / (r.total || 100)) * 100, 0) / rs.length) };
                }),
              })
            : '<div class="panel__body"><p class="muted">No marks have been entered from your classes yet.</p></div>' })
      ) +
      (examNotices.length ? '<h3 class="section-h">Examination notices now live</h3><div class="notice-list" id="teExamNotices"></div>' : '');

    if (examNotices.length) SGC.notices.renderList(qs('#teExamNotices'), examNotices);

    qs('#exSend').addEventListener('click', () => {
      const title = qs('#ex-title').value.trim();
      const body = qs('#ex-body').value.trim();
      if (title.length < 6 || body.length < 20) { toast('Add a real headline and at least a couple of sentences.', 'error'); return; }
      SGC.db.insertData('schoolNotices', {
        title, titleSi: '', body, bodySi: '',
        date: todayISO(), expiryDate: qs('#ex-exp').value || '', category: 'Exam', priority: qs('#ex-pri').value,
        audience: ['student', 'parent', 'teacher'], attachment: null,
        author: me.fullName, published: true, views: 0, createdAt: U.nowISO(), updatedAt: U.nowISO(),
      });
      toast('Examination information published.', 'success');
      qs('#ex-title').value = ''; qs('#ex-body').value = '';
      teExams();
      teHome();
    });
  }

  /* ---------------- results entry ---------------- */
  let resClass = '', resSubject = '', resExam = 'Term II Preliminary Examination';
  function teResults() {
    if (!mustTeacher()) return;
    const mount = qs('#teResultsBody');
    if (!mount) return;
    const cls = myClasses();
    if (!cls.length) { mount.innerHTML = '<p class="muted">Results appear once you are allocated a class.</p>'; return; }
    if (!cls.some((c) => c.id === resClass)) { resClass = cls[0].id; resSubject = ''; }
    const subs = subjectsFor(resClass);
    if (!subs.some((s) => s.id === resSubject)) resSubject = (subs[0] || {}).id || '';

    mount.innerHTML =
      D.panel({ title: 'Enter marks', body:
        '<div class="toolbar">' +
          '<div><label class="label" for="rsCls">Class</label><select class="select" id="rsCls">' + classOptions(resClass) + '</select></div>' +
          '<div><label class="label" for="rsSub">Subject</label><select class="select" id="rsSub">' +
            (subs.length ? subs.map((s) => '<option value="' + s.id + '"' + (s.id === resSubject ? ' selected' : '') + '>' + esc(s.name) + '</option>').join('')
              : '<option value="">No subject allocated</option>') + '</select></div>' +
          '<div><label class="label" for="rsExam">Examination</label><input class="input" id="rsExam" value="' + esc(resExam) + '" maxlength="60"></div>' +
          '<div><label class="label" for="rsDate">Paper date</label><input class="input" id="rsDate" type="date" value="' + todayISO() + '"></div>' +
          '<div style="align-self:flex-end"><button type="button" class="btn btn--primary" id="rsGo">Load sheet</button></div>' +
        '</div>' +
        '<p class="form-hint">Marks are out of the total shown. The grade is derived from the national ' +
          'percentage scheme and students see the paper as soon as you save it.</p>' }) +
      spacer() + '<div id="rsWrap"></div>';

    if (!mount.dataset.wired) {
      mount.dataset.wired = '1';
      U.on(mount, 'change', '#rsCls', () => { resClass = qs('#rsCls').value; teResults(); });
    }
    qs('#rsGo').addEventListener('click', () => {
      resSubject = qs('#rsSub').value;
      resExam = qs('#rsExam').value.trim() || 'Untitled examination';
      drawSheet(qs('#rsDate').value);
    });
    drawSheet(todayISO());
  }

  function drawSheet(date) {
    const wrapEl = qs('#rsWrap');
    if (!wrapEl) return;
    if (!resSubject) { wrapEl.innerHTML = '<p class="muted">Choose the subject you marked.</p>'; return; }
    const list = studentsIn(resClass);
    if (!list.length) { wrapEl.innerHTML = '<p class="muted">This class has no students on register.</p>'; return; }
    const existing = SGC.db.all('schoolResults').filter((r) => r.classId === resClass && r.subjectId === resSubject && r.examName === resExam);
    const find = (sid) => existing.find((r) => r.studentId === sid);

    wrapEl.innerHTML = D.panel({
      title: resExam + ' · ' + SGC.db.className(resClass) + ' · ' +
        SGC.i18n.loc(SGC.db.findData('schoolSubjects', resSubject) || {}, 'name'),
      action: '<span class="badge badge--exam">' + existing.length + ' / ' + list.length + ' entered</span>',
      flush: true,
      body: '<div class="table-wrap"><table class="table"><caption class="sr-only">Marks sheet</caption><thead><tr>' +
        '<th scope="col">Student</th><th scope="col">ID</th><th scope="col" class="num">Mark</th><th scope="col" class="num">Out of</th><th scope="col">Grade</th>' +
        '</tr></thead><tbody>' + list.map((s) => {
          const e = find(s.id);
          return '<tr><td><b>' + esc(s.fullName) + '</b></td><td>' + esc(s.studentId) + '</td>' +
            '<td class="num"><label class="sr-only" for="mk-' + esc(s.id) + '">Mark for ' + esc(s.fullName) + '</label>' +
              '<input class="input num" style="width:84px;text-align:right" id="mk-' + esc(s.id) + '" data-mark="' + esc(s.id) + '" type="number" min="0" max="100" value="' + esc(e ? e.marks : '') + '"></td>' +
            '<td class="num"><label class="sr-only" for="tt-' + esc(s.id) + '">Total for ' + esc(s.fullName) + '</label>' +
              '<input class="input" style="width:84px;text-align:right" id="tt-' + esc(s.id) + '" data-total="' + esc(s.id) + '" type="number" min="1" max="100" value="' + esc(e ? e.total : 100) + '"></td>' +
            '<td data-grade="' + esc(s.id) + '">' + (e ? D.gradeChip(e.grade) : '<span class="muted">—</span>') + '</td></tr>';
        }).join('') + '</tbody></table></div>' +
        '<div class="panel__body"><button type="button" class="btn btn--primary" id="rsSave">Save marks</button></div>',
    });

    wrapEl.querySelectorAll('input[data-mark]').forEach((inp) => {
      inp.addEventListener('input', () => {
        const sid = inp.dataset.mark;
        const m = Number(inp.value);
        const tot = Number(qs('[data-total="' + sid + '"]', wrapEl).value) || 100;
        const cell = qs('[data-grade="' + sid + '"]', wrapEl);
        cell.innerHTML = (isNaN(m) || inp.value === '') ? '<span class="muted">—</span>'
          : D.gradeChip(gradeOf(Math.round((m / tot) * 100)));
      });
    });

    qs('#rsSave', wrapEl).addEventListener('click', () => {
      let n = 0, skipped = 0;
      wrapEl.querySelectorAll('input[data-mark]').forEach((inp) => {
        const sid = inp.dataset.mark;
        if (inp.value === '') { skipped++; return; }
        const marks = Math.max(0, Math.min(100, Number(inp.value)));
        const total = Math.max(1, Number(qs('[data-total="' + sid + '"]', wrapEl).value)) || 100;
        const pct = Math.round((marks / total) * 100);
        const rec = {
          studentId: sid, subjectId: resSubject, classId: resClass, examName: resExam,
          term: resExam.indexOf('Term I ') === 0 ? 'Term I' : resExam.indexOf('Term II') === 0 ? 'Term II' : 'Term III',
          year: String(new Date().getFullYear()), marks, total, grade: gradeOf(pct), date, enteredBy: me.id,
        };
        const prior = find(sid);
        if (prior) SGC.db.updateData('schoolResults', prior.id, rec);
        else SGC.db.insertData('schoolResults', rec);
        n++;
      });
      toast(n + ' mark' + (n === 1 ? '' : 's') + ' saved' + (skipped ? ', ' + skipped + ' left blank' : '') + '.', 'success');
      drawSheet(date);
    });
  }

  function teTimetable() {
    if (!mustTeacher()) return;
    const mount = qs('#teTimetableBody');
    if (!mount) return;
    const rows = slots();
    if (!rows.length) {
      mount.innerHTML = emptyState({ icon: '🕒', title: 'No periods allocated',
        text: 'The timetable office has not published your periods for this term.' });
      return;
    }
    const di = dayIndex();
    const nowHm = new Date().toTimeString().slice(0, 5);
    mount.innerHTML = D.widgets([
      { icon: '🕒', value: String(rows.length), label: 'Periods a week' },
      { icon: '🏫', value: String(myClasses().length), label: 'Classes' },
      { icon: '📚', value: String(new Set(rows.map((r) => r.subjectId)).size), label: 'Subjects' },
    ]) + spacer() +
      DAYS.slice(0, 5).map((day) => {
        const r = rows.filter((x) => x.day === day);
        if (!r.length) return '';
        return '<h3 class="section-h">' + esc(day) + (day === DAYS[di] ? ' · today' : '') + '</h3>' +
          '<div class="tt">' + r.map((t) => {
            const now = day === DAYS[di] && t.start <= nowHm && nowHm <= t.end;
            return '<div class="tt__cell' + (now ? ' is-now' : '') + '">' +
              '<div class="tt__p">Period ' + esc(String(t.period)) + ' · ' + esc(t.start) + '–' + esc(t.end) + '</div>' +
              '<div class="tt__s">' + esc(SGC.db.className(t.classId)) + '</div>' +
              '<div class="tt__t">' + esc(SGC.i18n.loc(SGC.db.findData('schoolSubjects', t.subjectId) || {}, 'name')) +
                (t.room ? ' · ' + esc(t.room) : '') + '</div></div>';
          }).join('') + '</div>';
      }).join('');
  }

  function teNotices() {
    if (!mustTeacher()) return;
    D.noticeList(qs('#teNoticesBody'), noticesForMe());
    refreshPills();
  }

  function resolveName(id) {
    if (id === 'all') return 'All members';
    if (id === 'admin') return "Principal's Office";
    const t = SGC.db.findData('schoolTeachers', id);
    if (t) return t.fullName;
    const s = SGC.db.findData('schoolStudents', id);
    return s ? s.fullName : id;
  }

  function msgHTML(m) {
    const mine = m.from === me.id;
    return '<article class="msg' + (!m.read && !mine ? ' is-unread' : '') + '" data-msg="' + esc(m.id) + '" tabindex="0" role="button">' +
      '<div class="msg__body"><div class="msg__from">' + esc(mine ? 'You → ' + resolveName(m.to) : resolveName(m.from)) +
        (mine ? '' : ' <span class="tag-me">to me</span>') + '</div>' +
        '<p class="msg__sub">' + esc(m.subject || '(no subject)') + '</p>' +
        '<p class="msg__txt">' + esc(m.body) + '</p></div>' +
      '<span class="mini__end">' + esc(formatDate(m.date)) + '</span></article>';
  }

  function teMessages() {
    if (!mustTeacher()) return;
    const mount = qs('#teMessagesBody');
    if (!mount) return;
    refreshPills();
    const rows = messagesForMe();
    mount.innerHTML =
      D.widgets([
        { icon: '✉', value: String(rows.length), label: 'Threads' },
        { icon: '●', value: String(unread().length), label: 'Unread', variant: 'ok' },
        { icon: '➤', value: String(rows.filter((m) => m.from === me.id).length), label: 'Sent by you' },
      ]) + spacer() +
      '<div class="toolbar"><span></span><button type="button" class="btn btn--primary btn--sm" data-newmsg>✎ New message</button></div>' +
      '<div id="teMsgList">' + (rows.length ? rows.map(msgHTML).join('')
        : emptyState({ icon: '✉', title: 'Nothing in the inbox', text: 'Messages from students, colleagues and the office appear here.' })) + '</div>';

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
      body: '<p class="muted" style="margin-top:0;font-size:.82rem">From ' + esc(resolveName(m.from)) + ' · ' + esc(formatDate(m.date)) + '</p>' +
        '<div class="prose"><p style="white-space:pre-wrap">' + esc(m.body) + '</p></div>' +
        (mine ? '' : '<div class="field" style="margin-top:var(--sp-3)"><label class="label" for="rp">Reply</label>' +
          '<textarea class="textarea" id="rp" rows="4"></textarea></div><button type="button" class="btn btn--primary" data-send>Send reply</button>'),
      onOpen(modal) {
        U.on(modal.root, 'click', '[data-send]', () => {
          const text = qs('#rp', modal.root).value.trim();
          if (text.length < 5) { toast('Write a little more before sending.', 'error'); return; }
          SGC.db.insertData('schoolMessages', {
            from: me.id, fromName: me.fullName, to: m.from, subject: 'Re: ' + (m.subject || 'message'),
            body: text, date: todayISO(), read: false, threadId: m.threadId || U.uid('TH'), role: 'teacher',
          });
          toast('Reply sent.', 'success');
          modal.close();
          teMessages();
        });
      },
    });
  }

  function compose() {
    const students = myClassIds().reduce((acc, c) => acc.concat(studentsIn(c)), []);
    const colleagues = SGC.db.all('schoolTeachers').filter((t) => t.id !== me.id);
    U.modal({
      title: 'New message',
      body: '<div class="field"><label class="label" for="cm-to">Recipient</label><select class="select" id="cm-to">' +
          '<optgroup label="The office"><option value="admin">Principal\u2019s Office</option></optgroup>' +
          (students.length ? '<optgroup label="My students">' + students.map((s) => '<option value="' + esc(s.id) + '">' + esc(s.fullName) + ' · ' + esc(SGC.db.className(s.classId)) + '</option>').join('') + '</optgroup>' : '') +
          '<optgroup label="Colleagues">' + colleagues.map((t) => '<option value="' + esc(t.id) + '">' + esc(t.fullName) + ' · ' + esc(t.department) + '</option>').join('') + '</optgroup>' +
        '</select></div>' +
        '<div class="field"><label class="label" for="cm-sub">Subject</label><input class="input" id="cm-sub" maxlength="90"></div>' +
        '<div class="field"><label class="label" for="cm-body">Message</label><textarea class="textarea" id="cm-body" rows="5"></textarea></div>',
      footer: '<button type="button" class="btn btn--ghost" data-close>Cancel</button><button type="button" class="btn btn--primary" data-send>Send</button>',
      onOpen(modal) {
        U.on(modal.root, 'click', '[data-send]', () => {
          const to = qs('#cm-to', modal.root).value;
          const subject = qs('#cm-sub', modal.root).value.trim();
          const body = qs('#cm-body', modal.root).value.trim();
          if (!subject || body.length < 10) { toast('Add a subject and at least a sentence.', 'error'); return; }
          SGC.db.insertData('schoolMessages', { from: me.id, fromName: me.fullName, to, subject, body,
            date: todayISO(), read: false, threadId: U.uid('TH'), role: 'teacher' });
          toast('Message sent to ' + resolveName(to) + '.', 'success');
          modal.close();
          teMessages();
        });
      },
    });
  }

  function teSettings() {
    if (!mustTeacher()) return;
    const mount = qs('#teSettingsBody');
    if (!mount) return;
    const p = prefs()[me.id] || {};
    mount.innerHTML =
      D.panel({ title: 'Portal preferences', body:
        D.setRow({ title: 'Daily register reminder', text: 'In a connected build the server sends this reminder at 14:00. Stored on this device only for the demo.',
          control: D.switchHTML('prefReg', 'Register reminder', p.register !== false) }) +
        D.setRow({ title: 'Show my card publicly', text: 'Your photograph, subject, department and biography appear on the public Teachers page.',
          control: D.switchHTML('prefPub', 'Public staff card', p.public !== false) }) +
        D.setRow({ title: 'Language', text: 'Sinhala changes portal labels and any notice carrying a Sinhala version.',
          control: '<div class="row-actions"><button type="button" class="btn btn--ghost btn--sm" data-lang="en">English</button>' +
            '<button type="button" class="btn btn--ghost btn--sm" data-lang="si">සිංහල</button></div>' }) +
        D.setRow({ title: 'Appearance', text: 'Shared with the college website and remembered on this device.',
          control: '<button type="button" class="btn btn--ghost btn--sm" data-theme-toggle>Toggle dark mode</button>' }) }) +
      spacer() +
      D.panel({ title: 'Password', body:
        '<p class="muted" style="margin-top:0">Demo only: the password is kept in this browser so the portal can be ' +
        'tried without a server. A production build authenticates against Firebase, Supabase or a PHP endpoint and ' +
        'never exposes the stored hash.</p>' +
        '<form id="pwForm"><div class="form-grid">' +
          '<div class="field"><label class="label" for="pw1">New password</label><input class="input" id="pw1" type="password" autocomplete="new-password" minlength="6"></div>' +
          '<div class="field"><label class="label" for="pw2">Repeat password</label><input class="input" id="pw2" type="password" autocomplete="new-password" minlength="6"></div>' +
        '</div><button class="btn btn--primary" type="submit">Change password</button></form>' }) +
      spacer() +
      D.panel({ title: 'Account', body:
        '<dl class="info-grid"><dt>Staff number</dt><dd>' + esc(me.teacherId) + '</dd>' +
        '<dt>Role</dt><dd>Teacher</dd><dt>Account</dt><dd>' + esc(sess.userId) + '</dd></dl>' + spacer() +
        '<button type="button" class="btn btn--danger btn--sm" data-signout>Sign out of this device</button>' });

    qs('#pwForm').addEventListener('submit', async (e) => {
      e.preventDefault();
      const a = qs('#pw1').value, b = qs('#pw2').value;
      if (a !== b) { toast('The two passwords do not match.', 'error'); return; }
      const r = await SGC.auth.setPassword(sess.userId, a);
      toast(r.ok ? 'Password changed.' : r.error, r.ok ? 'success' : 'error');
      if (r.ok) { qs('#pw1').value = ''; qs('#pw2').value = ''; }
    });
    qs('#prefReg').addEventListener('change', (e) => { setPref('register', e.target.checked); toast('Preference saved on this device.', 'info'); });
    qs('#prefPub').addEventListener('change', (e) => {
      setPref('public', e.target.checked);
      SGC.db.updateData('schoolTeachers', me.id, { showPublicly: e.target.checked });
      toast(e.target.checked ? 'Your staff card is listed publicly.' : 'Your staff card is hidden from the Teachers page.', 'info');
    });
    if (!mount.dataset.wired) {
      mount.dataset.wired = '1';
      U.on(mount, 'click', '[data-signout]', () => {
        SGC.auth.logout();
        toast('You have been signed out.', 'info');
        setTimeout(() => { global.location.href = 'index.html'; }, 500);
      });
    }
  }

  function refreshPills() {
    const n = qs('#pillNotices');
    if (n) { const c = me ? noticesForMe().length : 0; n.textContent = c ? String(c) : ''; n.hidden = !c; }
    const m = qs('#pillMessages');
    if (m) { const c = me ? unread().length : 0; m.textContent = c ? String(c) : ''; m.hidden = !c; }
  }

  const VIEWS = { teHome, teProfile, teClasses, teStudents, teAttendance, teAssignments,
    teExams, teResults, teTimetable, teNotices, teMessages, teSettings };
  Object.keys(VIEWS).forEach((k) => { SGC.pages[k] = VIEWS[k]; });

  function activeView() {
    const v = qs('.view.is-active');
    return v ? v.dataset.view : 'teHome';
  }

  SGC.pages['teacher-dashboard'] = {
    init() {
      sess = SGC.auth.requireAuth(['teacher']);
      if (!sess) return;
      me = SGC.db.findData('schoolTeachers', sess.linkedId);
      if (!me) { sess = null; teHome(); return; }
      D.shell(sess, me.position + ' · ' + me.teacherId);
      /* a card on My Classes can jump straight to that register */
      U.on(document, 'click', '[data-preselect]', (e, btn) => { regClass = btn.dataset.preselect; });
      refreshPills();
      teHome();
      document.addEventListener('sgc:lang', () => { const fn = VIEWS[activeView()]; if (fn) fn(); });
    },
  };
})(window);
